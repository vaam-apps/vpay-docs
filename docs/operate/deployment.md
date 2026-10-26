---
title: Deployment
description:
  What a vpay release ships — three images, a Helm chart, compose files — how it
  boots, what it needs around it, and how little of it is proven in a
  cluster.
status: partial
sources:
  - docs/flows/deployment.md
  - docs/adr/0004-musl-mimalloc.md
  - docs/adr/0014-builder-host-musl-triple.md
  - docs/adr/0022-surface-isolation-and-independent-scaling.md
  - docs/adr/0013-database-backups-and-retention.md
  - deploy/helm/vpay/README.md
  - docs/runbooks/release.md
  - .github/workflows/notify-docs.yml
  - docs/adr/0030-staff-sign-in-federates-to-an-oidc-provider.md
  - docs/runbooks/migrations.md
  - docs/status/gates.md
  - docs/runbooks/callback-endpoints.md
  - deploy/helm/vpay/ci/prometheusrule.test.yaml
  - deploy/helm/vpay/values.yaml
skills:
  - vpay-ops
  - vpay-tooling
---

# Deployment

This page describes how a vpay build becomes a running deployment: what the
images contain, what has to exist around them, the order a process boots in, and
the guards that stop a bad configuration before it becomes an outage. Read it
with one fact in front of you.

::: warning Cluster runs are under test, not on record
The Helm chart renders, lints and validates against Kubernetes schemas in CI.
vpay is now being tested for live use on some clusters (the owner's statement,
2026-10-21), but at <Release /> vpay records **no pod running** in one — the
one cluster observation on record is a refusal, below. The places vpay is
recorded as having booted are Docker Compose and plain host processes on
developer machines, and CI. Treat everything this page marks unproven as
unproven.
:::

Agents working on deployment should load [vpay-ops](skill:vpay-ops); for the
compose files and `just` recipes, [vpay-tooling](skill:vpay-tooling).

## What ships

Three images, published to `ghcr.io/vaam-apps/vpay-{server,dashboard,checkout}`:

| Image            | Base             | Contents                                                                                                 |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `vpay-server`    | `scratch`        | One static musl binary with mimalloc, plus `config/` baked at `/config`. Runs **both** backend workloads |
| `vpay-dashboard` | `node:24-alpine` | The staff dashboard's Next.js standalone server                                                          |
| `vpay-checkout`  | `node:24-alpine` | vpay's own hosted/embedded payment page                                                                  |

The backend image has no shell, no package manager and no writable path
([ADR-0004](vpay:docs/adr/0004-musl-mimalloc.md)). Everything is observed from
outside the container — there is no `HEALTHCHECK` and no `kubectl exec` — and it
runs as the raw UID `65532` because `scratch` has no `/etc/passwd`. The binary
is built for the builder's _own_ musl target triple, so amd64 and arm64 are both
native builds rather than cross-compiles
([ADR-0014](vpay:docs/adr/0014-builder-host-musl-triple.md)).

**The worker is the server image with one argument.** `vpay-server` serves HTTP;
`vpay-server worker` runs the job loop. In compose that is
`command: ["worker"]`; in the chart it is `args: ["worker"]` — never `command:`,
which in Kubernetes replaces the entrypoint (measured: that spelling exits 127).
A separate `vpay-worker` image existed until it was retired; its GHCR package is
frozen and nothing publishes to it.

**The two Node images run as the numeric `USER 1000:1000`.** Each Deployment
sets `runAsNonRoot` with no UID of its own, and the kubelet cannot verify a
_named_ user against it: on 2026-10-18, on a real cluster with chart 0.6.0 and
`dashboard.enabled: true`, it refused the image that said `USER node`. Both
stages now say `USER 1000:1000`. No dashboard or checkout pod has yet been seen
starting under `runAsNonRoot: true`; `docker run`, which makes no such check, is
all the evidence so far.

## The shape of a Kubernetes deployment

```mermaid
flowchart TD
  subgraph edge["Ingress or Gateway API HTTPRoute"]
    V1["/v1"]
    TOK["/v1/oauth/token — tighter limit-rps"]
    PRV["/provider — rail callbacks"]
  end
  subgraph chart["deploy/helm/vpay — rendered, never applied"]
    SRV["-server Deployment, vpay-server image"]
    WRK["-worker Deployment, same image, args worker"]
    MGT["-management, optional: /dash/v1"]
    CHK["-checkout, optional"]
    DSH["-dashboard, optional"]
    CM["ConfigMap: profile overlay, subPath"]
  end
  subgraph operator["Created by the operator — the chart makes none"]
    SEC["Secrets: database, signingKey, rails"]
    PG[("Postgres")]
  end
  V1 --> SRV
  TOK --> SRV
  PRV --> SRV
  CM --> SRV
  CM --> WRK
  SEC --> SRV
  SEC --> WRK
  SRV --> PG
  WRK --> PG
  MGT --> PG
  DSH -->|"BFF, in-cluster, to -management or -server"| MGT
  WRK -->|"egress"| RAILS["MTN MoMo, Orange Money, Notch Pay"]
  SRV -->|"egress"| RAILS
  MGT -.->|"egress, staff SSO only"| IDP["OpenID Connect provider"]
```

The chart renders the server and worker always; the management tier, the
checkout page and the dashboard only behind their own `.enabled` flags (all off
by default). The management tier and the server autoscaler come from
[ADR-0022](vpay:docs/adr/0022-surface-isolation-and-independent-scaling.md),
which is still **Proposed**. The chart creates **no Secret and no database** —
backups, point-in-time recovery and retention are an obligation on whoever runs
Postgres, and the policy for them
([ADR-0013](vpay:docs/adr/0013-database-backups-and-retention.md)) is also only
proposed: no vpay database has ever been backed up.

### As a dependency of another chart

A wrapper chart can list this one under `dependencies:`. Helm hands the parent's
`global` values to every subchart and validates them against the subchart's
closed `values.schema.json`, so since vpay 0.6.0 the schema lists `global`.
Before that, every parent chart failed `helm lint` and `helm template` with
`additional properties 'global' not allowed`. **`global` has no effect**:
nothing in the chart reads it, and every other unknown key is still refused.
Configure vpay from the parent under the `vpay:` key. `just helm-check` lints
and renders a real parent chart that depends on this one by `file://` path; the
published OCI chart has not been consumed as a dependency from a registry.

### Staff single sign-on

Staff can sign in to the dashboard through an external OpenID Connect provider
([Staff sign-in](/dashboard/authentication#single-sign-on-through-an-openid-connect-provider)).
**It is configured in the profile overlay, not in a chart value**: a
`staff_auth.sso` block in `config.overlay` is the whole switch, and a release
whose overlay has none renders exactly what it did before. Three things the YAML
does not say:

- **The client secret is a new key in the `rails.existingSecret` Secret**,
  `VPAY_STAFF_SSO_CLIENT_SECRET`. Add it before the overlay that writes the
  block rolls out: an unresolved `${…}` is exit 78 on every vpay process, not
  an empty string.
- **`redirect_uri` is the dashboard's callback**,
  `<dashboard.publicOrigin>/api/auth/sso/callback`, registered at the provider.
  The chart cannot check it; a mismatch fails at sign-in, not at install.
- **The pod that serves `/dash/v1` now calls the provider over HTTPS**:
  `-management` when it is enabled, otherwise `-server`. A public provider on
  port 443 is already reachable under the chart's default egress rules. A
  provider on a private address, in the cluster or on another port needs
  `networkPolicy.idpEgress`, which renders on that one pod only.

None of this is on record as having run in a cluster or against a real provider
from this chart.

## What must exist before a pod can start

Both modes refuse to start rather than start half-configured:

| Needed                             | Supplied as                                                | Missing ⇒                                                 |
| ---------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `VPAY_CONFIG`                      | baked `ENV` in the image                                   | exit 78                                                   |
| `DATABASE_URL`                     | Secret (`database.existingSecret`)                         | exit 78, both modes                                       |
| Every `${VAR}` the config names    | Secret via `envFrom` (`rails.existingSecret`)              | exit 78, both modes                                       |
| The RS256 signing key              | Secret mounted as a **file** (`signingKey.existingSecret`) | exit 78, server only                                      |
| Postgres, reachable and migratable | outside the chart                                          | exit 69                                                   |
| `worker.concurrency` ≤ 5           | chart value                                                | exit 78, worker only — and a chart guard refuses it first |

The signing key is deliberately a file, never an environment value, and only the
server mounts it — the worker issues no tokens.
[Configuration](/operate/configuration) explains the `${VAR}` rules.

**A Notch Pay overlay adds three keys to the rails Secret**: the public and
private keys and, since v0.12.0, the webhook endpoint's Hash Key
(`NOTCHPAY_HASH_KEY`, read as `credentials.callback_signing_secret`). Add each
to the Secret before rolling an overlay that references it, since an
unresolved placeholder is exit 78. A livemode deployment without the Hash Key
refuses to boot unless the overlay says `callbacks: { verify: off }`. Create
the value without a trailing newline (`--from-literal` or `printf %s`, not
`echo` into a file): a value with surrounding whitespace is refused with exit
78 too ([Notch Pay](/rails/notchpay#webhook-signatures)).

## Boot, and migrations

```mermaid
flowchart LR
  A["signal handlers installed first"] --> B["parse flags and env"]
  B --> C["load and validate YAML"]
  C --> D["connect, run migrations"]
  D --> E["reconcile config into tables"]
  E --> F{"mode?"}
  F -->|"no subcommand"| G["bind VPAY_BIND, serve"]
  F -->|"worker"| H["start claim loop"]
  G --> O["last: bind :9090 for /livez and /metrics"]
  H --> O
```

**Migrations run at boot**, in both modes, through `sqlx::migrate!`, before the
listener binds — which is why the chart gives both workloads a startup probe
with a generous failure threshold. Two rules follow, and both bite on rollback:

- **There are no down-migrations.** An older image does not undo a migration a
  newer one ran; running old code against a new schema is unsupported and
  nothing checks for it.
- **A shipped migration file is never edited.** sqlx stores a hash of each
  file's bytes, comments included, and a changed file stops every database that
  applied the original from booting (exit 78). `MANIFEST.sha256` and
  `cargo xtask verify-migrations` make the rule a build failure; the
  [migrations runbook](/operate/runbooks#migrations) is the repair for a
  database already in that state.

`/livez` is bound _last_, so a liveness probe against a process still booting —
or about to exit 78 — is refused rather than answered `ok`.

## Probes, ports and shutdown

| Path           | Port | Answers                     | Role                     |
| -------------- | ---- | --------------------------- | ------------------------ |
| `GET /livez`   | 9090 | static `ok`, no database    | liveness, both workloads |
| `GET /metrics` | 9090 | Prometheus text             | scraping                 |
| `GET /healthz` | 8080 | `SELECT 1` against Postgres | readiness, server only   |

Metrics sit on a second port because `/metrics` names every rail, route and
error code, and 8080 is the one an Ingress fronts; the NetworkPolicy admits 9090
from the monitoring namespace only. **Nothing has ever scraped these metrics** —
the `ServiceMonitor` and `PrometheusRule` are off by default and every alert
threshold is proposed, not measured.

The `PrometheusRule` carries six alerts. The sixth, new in v0.11.0, is
`VpayCallbackEndpointUnconfirmed`: it fires when, for
`metrics.prometheusRule.callbackEndpointWindow` (`3h`, proposed), no pass of the
worker's `ensure_callbacks` job confirmed vpay's callback endpoint on a rail,
read from `vpay_callback_endpoint_checks_total{provider,state}`, the fourteenth
metric ([callback endpoints runbook](/operate/runbooks#callback-endpoints)). It
cannot fire for a rail whose `callbacks.register` is `off`, which is Notch
Pay's default since v0.12.0.

vpay emits fifteen metric names. The fifteenth, new in v0.12.0, is
`vpay_provider_callbacks_total{provider,verdict}`: one count per rail callback
that names a charge, with the rail's check's verdict (`verified`,
`verified_previous`, `not_checked`, `no_secret`, `invalid`, `unavailable`). A
steady `invalid` with no `verified` beside it is the deployment's own signing
secret gone stale, and `verified_previous` stops increasing once a rotation can
end. No alert reads it yet.
Since v0.11.0 `just test-alert-rules` renders all six and runs
`promtool test rules` against a firing and a silent case for each, in CI's
chart job. That proves each expression fires on the made-up series it is
written for, and nothing about the series a running vpay emits.

SIGTERM starts a drain bounded by `--shutdown-grace-seconds` (25 s). A non-zero
exit at the deadline means work was cut off, not that shutdown failed. The
chart's `grace-period` guard refuses to render unless
`terminationGracePeriodSeconds` (35) is at least the drain plus five seconds.

## Local and CI: compose

Compose is the only containerised shape that has run the whole stack. The two
sandbox runs, MTN's and Notch Pay's, were made with the server and worker as
host processes against a local Postgres, not with these files:

| File               | Adds                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `compose.yml`      | Postgres and the three WireMock rail stubs: MTN, Orange and Notch Pay                              |
| `compose.e2e.yml`  | `vpay-server`, `vpay-worker`, a WireMock webhook receiver, dashboard, checkout page, the demo shop |
| `compose.demo.yml` | The overlay `just demo`, `just test-e2e` and CI's `e2e` job run under                              |

Every rail and every webhook receiver in these stacks is a `wiremock/wiremock`
container reached over HTTP. See the [demo runbook](/operate/runbooks#demo).

## The release pipeline

`.github/workflows/release.yml` is the only thing that publishes.

```mermaid
flowchart TD
  M["merge to master"] --> B["build each image natively, amd64 and arm64"]
  T["push a v* tag"] --> B
  B --> MG["merge job: manifest list, tags, cosign sign keyless"]
  M -.->|"tags edge, sha-40hex"| MG
  T -.->|"tags 1.2.3, 1.2, sha-40hex"| MG
  MG --> PC["publish-chart, tags only"]
  PC --> OCI["oci://ghcr.io/vaam-apps/charts/vpay"]
  T --> NPM["publish-node-sdk, publish-stripe-js-sdk"]
  T -.->|"separate workflow, cannot block"| ND["notify-docs.yml: repository_dispatch to vpay-docs"]
```

There is deliberately no `latest` tag and no `edge` chart: a real deployment
pins an image digest and a chart `--version`. Signing is keyless cosign over the
GitHub OIDC token, so verification names the workflow, not a key — and only the
manifest-list digest is signed, not the per-architecture children. The chart's
`version:`, its `appVersion` and the git tag must all agree or `publish-chart`
refuses; its republish guard distinguishes "already published and signed" (stop)
from "published, not signed" (resume signing).

What has happened: the workflow has run on `master` and on tags, pushed and
signed images, and published and signed a chart. What has **not**: nobody has
run `cosign verify` against anything this repository produced, nobody has pulled
an image, and GHCR package visibility is unmeasured. The
[release runbook](/operate/runbooks#release) is the procedure.

A `v*` tag also triggers
[`notify-docs.yml`](vpay:.github/workflows/notify-docs.yml), a separate workflow
that tells this documentation site a release landed (a `repository_dispatch` of
type `vpay-release` to vaam-apps/vpay-docs). It has no `needs:` and no shared
concurrency with `release.yml`, so it cannot hold up or fail a release, and a
release that leaves these docs stale still ships. The release runbook at <Release />
records it as run on every `v*` tag from v0.5.0 to v0.10.2, each
run followed by a `release-parity` dispatch here; this site's own runs show the
same for v0.10.3, v0.10.4 and v0.11.0
([How these docs stay current](/about/parity)).

Installing from the registry takes the shape the chart README gives:

```bash
helm upgrade --install vpay oci://ghcr.io/vaam-apps/charts/vpay --version "$VERSION" -f your-values.yaml
```

## What can go wrong

- **A profile typo boots on sandbox configuration and reports healthy.** The
  overlay is merged only if the file exists; a wrong `VPAY_PROFILE` gives
  WireMock rail hosts and placeholder merchant keys with no error. Check the
  rendered mount path against `VPAY_PROFILE` in `helm template` output.
- **Mounting a ConfigMap _at_ `/config` deletes the baked base file.** The
  overlay must be a single-file `subPath` mount; the chart does this, and adds a
  checksum annotation so an edit rolls the pods (a `subPath` mount never updates
  in place).
- **An autoscaler can exhaust Postgres connections before CPU.** Each process
  holds a pool of 10 connections; the `connection-budget` guard compares
  `(maxReplicas + management + worker) × 10` against the database's budget.
- **Rolling the signing-key Secret back to a retired key crash-loops the server
  with exit 78.** Roll forward instead.
- **An un-upgraded cluster keeps pulling the frozen `vpay-worker` image**
  against a newer server and schema. Deleting that package is an open maintainer
  action.
- **Every rail callback 404s if `/provider` is not routed.** The chart now
  routes it by default and a guard refuses to turn it off silently.

## Status in this release

| Part                                             | Status                   | Evidence                                                                                                                                                          |
| ------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images built, published, signed by `release.yml` | <Status s="partial" />   | Runs green on `master` and tags; no pull, no `cosign verify` ever                                                                                                 |
| Helm chart                                       | <Status s="unproven" />  | `just helm-check`: lint, renders, 24 named guards, kubeconform — never applied to a cluster                                                                       |
| Chart published to OCI registry                  | <Status s="partial" />   | Published and signed on a tag; signature never verified                                                                                                           |
| Compose (local and CI)                           | <Status s="built" />     | Boots in CI's `e2e` job and `just demo`                                                                                                                           |
| Metrics and alerts                               | <Status s="unproven" />  | Series emitted and asserted in tests; the six rules tested by `promtool` against synthetic series in CI; never scraped, never evaluated against vpay's own series |
| Management tier and autoscaling (ADR-0022)       | <Status s="unproven" />  | Rendered and guarded; the ADR is Proposed                                                                                                                         |
| As a subchart of another chart                   | <Status s="partial" />   | A `file://` parent that sets `global` lints and renders in `just helm-check`                                                                                      |
| Staff SSO configuration and IdP egress           | <Status s="unproven" />  | Renders byte-identical without the block; never booted in a cluster or against a real IdP                                                                         |
| Database backups                                 | <Status s="not-built" /> | ADR-0013 proposed; no backup has ever been taken                                                                                                                  |

The full record is the Status section of
[docs/flows/deployment.md](vpay:docs/flows/deployment.md#status) and the chart's
own [README](vpay:deploy/helm/vpay/README.md).

## Go deeper

- [docs/flows/deployment.md](vpay:docs/flows/deployment.md) — images, boot,
  guards, observability
- [deploy/helm/vpay/README.md](vpay:deploy/helm/vpay/README.md) — every rendered
  object and value
- [docs/runbooks/release.md](vpay:docs/runbooks/release.md) — tagging,
  verifying, pinning
- [docs/runbooks/migrations.md](vpay:docs/runbooks/migrations.md) — the
  immutability rule
- [ADR-0004](vpay:docs/adr/0004-musl-mimalloc.md),
  [ADR-0014](vpay:docs/adr/0014-builder-host-musl-triple.md),
  [ADR-0022](vpay:docs/adr/0022-surface-isolation-and-independent-scaling.md),
  [ADR-0013](vpay:docs/adr/0013-database-backups-and-retention.md)
- [Runbooks](/operate/runbooks) — every operational procedure
- Skills: [vpay-ops](skill:vpay-ops), [vpay-tooling](skill:vpay-tooling)
