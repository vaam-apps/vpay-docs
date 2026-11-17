---
title: The staff dashboard
description:
  What the merchant dashboard is, what /dash/v1 serves and to whom, what the
  dashboard application does in this release (a sign-in and an account page,
  no data pages), and what has to happen before it shows a payment again.
status: partial
sources:
  - docs/flows/dashboard.md
  - docs/flows/dashboard/slice-1-gaps.md
  - docs/flows/dashboard/status-built-and-not-built.md
  - docs/flows/dashboard/status-read-seam-and-bff.md
  - docs/flows/dashboard/status-styling-and-demo.md
  - docs/adr/0008-dashboard-scope.md
  - docs/adr/0022-surface-isolation-and-independent-scaling.md
  - docs/status/frontend.md
  - docs/status/verification/2026-10-21-dashboard-md3e.md
  - docs/status/verification/2026-10-21-dashboard-hydration.md
  - docs/status/verification/2026-10-26-dashboard-cratestack-refine.md
  - docs/status/verification/2026-10-30-vpa5c-dashboard-e2e.md
  - frontends/apps/dashboard
  - docs/flows/webhooks.md
skills:
  - vpay-dashboard
  - vpay-frontend
---

# The staff dashboard

The dashboard is where a merchant's staff are meant to see what happened to
that merchant's payments. Its founding decision is that it **observes and does
not administer**: it reads records, never changes configuration, and never
holds a merchant credential
([ADR-0008](vpay:docs/adr/0008-dashboard-scope.md), which stands; the OIDC
session it assumed is superseded).

It has two halves, and in <Release /> they are in very different states:

- **`/dash/v1`, the backend surface**, serves this merchant's payments,
  refunds, webhook deliveries, customers and checkout sessions, read-only, to a
  request signed by a paired console key or, where the deployment serves staff
  sign-in, carrying a staff access token
  ([authentication](/dashboard/authentication)).
- **The dashboard application** (`frontends/apps/dashboard`, Next.js) **reads
  none of it.** In this release it signs a staff member in with a password and
  an authenticator code, or with single sign-on, and lands them on an account
  page that says who is signed in, which merchant they read, and offers Sign
  out. The Overview, the payments list and detail, and the refunds, deliveries,
  customers and checkouts lists that v0.15.0 shipped were **deleted** when the
  console moved to signed requests (VP-6a). They are not built in this
  release; vpay's plans bring them back with VP-6b.

No deployment of either is on record. Agents working on this should load
[vpay-dashboard](skill:vpay-dashboard).

## The boundary

> A `/dash/v1` request reads exactly one tenant's rows: the one
> `dashboard.merchant_id` names, fixed in YAML and checked at boot — unless the
> key or session behind it belongs to an administrator, who may name another
> registered merchant.

The tenant does **not** come from anything the request says. For a
non-administrator the `?merchant_id=` parameter is not even parsed. A deployment
whose staff must see two merchants needs two deployments; the field does not
become a list. A `dashboard.merchant_id` no merchant registers is a boot
refusal, because the alternative is an empty table that looks exactly like a
merchant with no payments. A deployment with neither `dashboard:` nor the
`human_login` blocks mounts no `/dash/v1` at all.

Between a request and a row:

1. **The credential.** A signature from a live console key, or, where
   `human_login` is served, a token whose audience is the dashboard client,
   whose `vpay_merchant_id` claim is the dashboard's tenant and which carries
   its single scope. No `client_credentials` token can carry that claim.
2. **The member.** Re-read on every request: active, and this merchant's.
3. **The tenancy.** One function resolves it for both doors.
4. **The query.** Every query filters by that merchant.

**Read-only is structural.** A write method on a read route is refused before
the router (`405` with `Allow: GET` from the signed layer), so a write mounted
later cannot arrive unlogged. ADR-0008's per-record writes, each with an
`audit_log` row, are designed and **not built**; so there is no `audit_log`.

## What `/dash/v1` serves

| Route                               | Answers                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dash/v1/payment_intents`      | The bound merchant's intents, newest first, cursor-paged; `?status=`, `?created_gte=`, `?created_lte=`. `?customer=` is a `400` naming `customer`           |
| `GET /dash/v1/payment_intents/{id}` | One intent, with its charge, its refunds and its event timeline, as `object: "dashboard.payment_detail"`                                                    |
| `POST /dash/v1/$procs/…`            | Five CrateStack search procedures: payment intents, refunds, webhook deliveries, customers and checkout sessions, offset-paged with vpay's own `totalCount` |

The procedure transport has an allowlist of those five searches: CrateStack's
generated router mounts every procedure in the schema, so the merchant write
procedures that serve [MCP](/api/mcp) are a `404` here, ahead of the signed
transport. The generated TypeScript client, `@vpay/dash-client`, still lists
all of them; the application may import it for its types only.

The dashboard is not an SDK surface: the merchant SDKs speak `/v1`, and a
`/dash/v1` method in one would be a merchant credential reaching for a staff
surface.

## The application today

| Route             | What it asks or shows                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`          | Asks vpay which methods it serves, then: an outage notice; "This console signs in with a paired key"; the variables to set; or the work email, then the password, with a single sign-on button where it is configured |
| `/login/totp`     | The six-digit code; a first sign-in also shows the QR code, with the typed key in a bottom sheet                                                                                                                      |
| `/login/password` | While the one-time password is in force: the current, the new, the new again                                                                                                                                          |
| `/`               | The account page: who is signed in, which merchant, Sign out. If vpay will not mint this person a token, it says so here with the request id                                                                          |
| `/signed-out`     | Forgets a dead session cookie, then `/login`                                                                                                                                                                          |
| `/healthz`        | "Next is answering"; probes nothing                                                                                                                                                                                   |

One screen asks one question, Continue stays disabled until the answer is valid,
and every choice is a bottom sheet: a test fails on any dropdown, and another on
any shadow. Every call to vpay has a five-second deadline, and a timeout is
shown as an outage, never as "paired key". How the sign-in itself works is
[Dashboard authentication](/dashboard/authentication).

**Configuration** is read once at start: `VPAY_DASH_API` (vpay's URL as this
server reaches it), the three client values `VPAY_DASHBOARD_CLIENT_ID`,
`VPAY_DASHBOARD_REDIRECT_URI` and `VPAY_DASHBOARD_SCOPE` (needed only where vpay
serves `human_login`; missing, `/login` names them and offers no form), and
optionally `VPAY_DASHBOARD_PUBLIC_ORIGIN` and `VPAY_DASHBOARD_SSO_ISSUER`.

**Deleted and staying deleted:** the BFF (`/api/dash/*`), `middleware.ts`, the
Refine data and auth providers and the client-side reads. The components that
drew the old screens (the payments table, filters, pager and detail, the
procedure list view) survive with their tests and Storybook stories, and are
rendered by no route.

### The rules VP-6b's pages inherit

The deleted screens were held to rules about **absence**, recorded in vpay's
[slice-1 gaps](vpay:docs/flows/dashboard/slice-1-gaps.md), and VP-6b's list of
end-to-end cases to restore includes them:

- the payer's masked phone is always a dash, because nothing writes
  `charges.payer_ref_masked`, and never falls back to the unmasked value;
- the payments list shows no page count, because its route returns cursors and
  `has_more`, never a total;
- an unknown status renders as text, not as a coloured pill;
- the event timeline names the two event types nothing writes,
  `payment_intent.created` and `payment_intent.processing` (see
  [Webhooks](/api/webhooks));
- a refused read is never drawn as an empty list or as `0`.

## What it cannot do

- **Show any record.** No page reads `/dash/v1` (VP-6b). The demo stack's
  sign-in therefore ends on the account page.
- **Hold a console key.** The application cannot generate, pair or sign with
  one until VP-6b, which also decides which credential wins when a browser holds
  both a session and a key.
- **Anything to a payment.** No write is built, so no `audit_log`.
- **Balances and the ledger, settings, rail health** (slices 4–6) are not
  started; webhook retries and signature replay are not started.
- **Run in a cluster, on record.** The Helm chart templates a Deployment for the
  application (`dashboard.enabled`, off by default) and a separate
  `/dash/v1`-only backend tier (`management.enabled`), but no Kubernetes pod of
  either, or of any other part of the chart, is on record.

::: warning Deployment traps, already documented
The management tier does **not** serve `POST /v1/oauth/token`, which mints
merchant credentials; the staff grant is `/dash/v1/oauth/token`, mounted only
where `human_login` is served. Publishing `/dash/v1` through the chart's
HTTPRoute with `networkPolicy.enabled` requires the Gateway's namespace in
`networkPolicy.managementIngress.namespaceSelector`, and a chart guard refuses
the combination. A proxy in front of the management pod must not add an
`Authorization` header: a signed request that carries one is a `400`. Whether
this tier should face a public gateway at all is an open maintainer decision.
See [Deployment](/operate/deployment).
:::

## Status in this release

| Part                                                            | Status                   | Evidence                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dash/v1` boundary, the two payment reads, the five searches   | <Status s="built" />     | `dashboard_read_surface.rs` and `dashboard_procedure_transport.rs` over a booted server and real Postgres, signed by console keys; `staff_sign_in.rs` reads it with a session too |
| The application's password sign-in and account page             | <Status s="built" />     | `dashboard-human-login.cy.ts` in a real browser against the compose stack: 7 of 7 on CI's first `e2e (compose)` run                                                               |
| The application's single sign-on                                | <Status s="partial" />   | Built, proven against a stubbed `fetch`; no browser has completed one                                                                                                             |
| Pages that read `/dash/v1` (Overview, payments, the four lists) | <Status s="not-built" /> | Deleted in VP-6a; VP-6b restores them and ten of the nineteen deleted end-to-end cases                                                                                            |
| A console key held by the application                           | <Status s="not-built" /> | VP-6b                                                                                                                                                                             |
| Writes and `audit_log`                                          | <Status s="not-built" /> | Refused at the boundary; ADR-0008's writes are designed, unbuilt                                                                                                                  |
| Slices 4–6                                                      | <Status s="not-built" /> | Not started                                                                                                                                                                       |
| Running in Kubernetes                                           | <Status s="not-built" /> | Chart templates exist; no pod is on record                                                                                                                                        |

vpay's own summary in [dashboard.md § Status](vpay:docs/flows/dashboard.md#status)
still describes the pages v0.15.0 had; the authority for this release is
[status/frontend.md](vpay:docs/status/frontend.md), which says what VPA-5a
built and what VP-6b must restore. Overall standing is on
[Status](/guide/status).

## Go deeper

- [The dashboard flow](vpay:docs/flows/dashboard.md): the invariant, the
  slices, the boundary
- [What slice 1 did not build](vpay:docs/flows/dashboard/slice-1-gaps.md),
  including the rules about absence
- [The frontend's status, and what VP-6b must restore](vpay:docs/status/frontend.md)
- [The application's README](vpay:frontends/apps/dashboard/README.md)
- [The sign-in, end to end](vpay:docs/status/verification/2026-10-30-vpa5c-dashboard-e2e.md)
- [ADR-0008: the dashboard observes; it does not administer](vpay:docs/adr/0008-dashboard-scope.md)
- [ADR-0022: surface isolation and independent scaling](vpay:docs/adr/0022-surface-isolation-and-independent-scaling.md)
- The history of the deleted screens:
  [the redesign](vpay:docs/status/verification/2026-10-21-dashboard-md3e.md),
  [the hydration fix](vpay:docs/status/verification/2026-10-21-dashboard-hydration.md),
  [the move to `@cratestack/refine`](vpay:docs/status/verification/2026-10-26-dashboard-cratestack-refine.md),
  [the read seam and the BFF](vpay:docs/flows/dashboard/status-read-seam-and-bff.md)
- Skills: [vpay-dashboard](skill:vpay-dashboard),
  [vpay-frontend](skill:vpay-frontend)
