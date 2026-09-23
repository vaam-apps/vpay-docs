---
title: Run it locally
description:
  How to bring vpay up on one machine, walk six payments through it against stub
  rails, run the binaries directly and run the browser suite.
status: partial
sources:
  - README.md
  - docs/runbooks/demo.md
  - docs/runbooks/demo/what-it-proves.md
  - docs/runbooks/demo/dashboard-sign-in.md
  - examples/README.md
  - compose.yml
  - compose.e2e.yml
  - compose.demo.yml
  - justfile
skills:
  - vpay-tooling
  - vpay-troubleshooting
---

# Run it locally

A single command, `just demo`, starts vpay from nothing and walks six payments
through it. It covers both rails and every outcome each rail documents, and each
payment is settled by the worker and confirmed by a signed webhook. It is the
quickest way to see how vpay is shaped. It is also a good example of the
difference between _works_ and _proven_: every rail in the demo is a WireMock
container.

::: warning A green demo is not a payment
A `succeeded` in the demo means `vpay-worker` asked a stub and the stub answered
`SUCCESSFUL`. No money moved, and no real MTN or Orange endpoint was called. The
"do not deploy" banner still applies.
:::

## Prerequisites

- **Docker**, with Compose **v2.24 or later**. The demo overlay uses `!reset`.
- The Rust toolchain that `rust-toolchain.toml` pins.
- `just`, `jq`, `curl` and `openssl` on your `PATH`. Every recipe checks for the
  tools it needs and names any that are missing.
- `pnpm` only if you work on the web packages. `just demo` builds every image it
  needs inside Docker. The Node baseline is `.nvmrc` (`22.23.2`), and `.npmrc`
  sets `engine-strict=true`, so `pnpm install` **fails** on an older Node.

## Install and start the dev dependencies

```bash
just install          # toolchains + pnpm deps
just up               # Postgres + a WireMock host per rail
```

`just up` runs `compose.yml` alone. It starts Postgres on `:5432`,
`wiremock-mtn` on `:8081` and `wiremock-orange` on `:8082`. That is enough to
run the binaries directly (see below). `just down` removes those containers and
their volume. Run `just` with no argument to list every task.

## The demo

```bash
just demo-down          # start from nothing; safe when nothing is running
just demo               # keys + up --wait + the walkthrough
just demo-down          # containers AND volumes
```

`just demo` is two recipes run in sequence, and each can also be run on its own:

| Recipe             | What it does                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `just demo-up`     | Runs `gen-demo-keys`, then `docker compose up -d --build --wait`, then polls `/healthz`                             |
| `just demo-walk`   | Runs `examples/merchant-demo` against a stack that is already up. You can run it again: each run uses fresh intents |
| `just demo-status` | Shows what is running, under which project and on which host ports                                                  |
| `just demo-down`   | Stops the stack and deletes its volumes                                                                             |
| `just demo-staff`  | Creates a dashboard staff member and writes the one-time password to `.e2e/<demo_project>/staff-password.txt`       |

`gen-demo-keys` generates a throwaway RS256 key for the server's OAuth provider
and a second one for a demo merchant, both in `.e2e/`, which git ignores. It
registers the merchant's **public** JWK in a `demo` profile overlay.

### What `just demo-up` starts

The demo stacks three compose files (`compose.yml`, `compose.e2e.yml`,
`compose.demo.yml`) and starts the nine services the justfile lists in
`demo_services`. Every published port is bound to `127.0.0.1`.

```mermaid
flowchart LR
    WALK["examples/merchant-demo<br/>(just demo-walk)"] -->|"/v1"| SRV
    SHOP["vpay-shop<br/>:3001"] -->|"/v1"| SRV
    CO["vpay-checkout<br/>:3080"] -->|"/v1/browser"| SRV
    DASH["dashboard<br/>:3000"] -->|"/dash/v1"| SRV
    SRV["vpay-server<br/>:8080"] --> PG[("postgres<br/>not published")]
    WRK["vpay-worker<br/>command: worker"] --> PG
    SHOP --> PG
    SRV -->|"submit"| MTN["wiremock-mtn<br/>not published"]
    SRV -->|"submit"| ORA["wiremock-orange<br/>:8082"]
    WRK -->|"status query"| MTN
    WRK -->|"status query"| ORA
    WRK -->|"signed webhook"| RCV["wiremock-webhook<br/>:8083"]
    WRK -->|"signed webhook"| SHOP
```

`vpay-server` and `vpay-worker` come from the same image. The worker is the same
binary run with the `worker` subcommand. Those two containers are `FROM scratch`
and have no shell, so they cannot have a healthcheck. That is why `demo-up`
polls `/healthz` from the outside instead of trusting `--wait` alone.

### The walkthrough

`examples/merchant-demo` is a Rust program built on the real merchant SDK. It
runs six steps:

1. It fetches the OP's discovery document and JWKS.
2. It gets an access token with `client_credentials` + `private_key_jwt`, and
   prints the decoded claims, never the token itself.
3. It calls `/v1` **without** a token and gets a `401` with vpay's error
   envelope.
4. It makes **six payments**. Each is created, read back, confirmed and settled
   by the worker, and its webhook is read from the receiver's own journal and
   verified with the SDK:

   | #   | Rail           | Outcome                                             | `last_payment_error.code` | Event delivered                 |
   | --- | -------------- | --------------------------------------------------- | ------------------------- | ------------------------------- |
   | 1   | `mtn_momo`     | the payer approves → `succeeded`                    | —                         | `payment_intent.succeeded`      |
   | 2   | `mtn_momo`     | no balance → `requires_payment_method`              | `insufficient_funds`      | `payment_intent.payment_failed` |
   | 3   | `mtn_momo`     | the prompt expires → `requires_payment_method`      | `payer_timeout`           | `payment_intent.payment_failed` |
   | 4   | `orange_money` | `requires_action` + the redirect URL → `succeeded`  | —                         | `payment_intent.succeeded`      |
   | 5   | `orange_money` | the hosted page expires → `requires_payment_method` | `payer_timeout`           | `payment_intent.payment_failed` |
   | 6   | `orange_money` | the rail refuses → `requires_payment_method`        | `provider_error`          | `payment_intent.payment_failed` |

5. It creates one hosted and one embedded Checkout Session and reads them back.
   It stops there: it has no browser, and both sessions are still `open` when it
   exits.
6. It calls `GET /v1/account_holders` to show the three possible answers to a
   name lookup.

`demo-walk` takes about a minute.

**Every outcome is chosen at the rail stub, never in the demo.** MTN's outcome
is selected by the payer's MSISDN and Orange's by the amount. The three MSISDNs,
`237600000ce0`, `237600000f01` and `237600000f02`, are **not phone numbers**:
their last three characters are a hex code the stub reads. Nothing rewrites
stored state to force an outcome.

**Every demo payment is in XAF on both rails.** That is a property of the demo
overlay only. **MTN's real sandbox rejects XAF**, which is why
`config/application.yml` keeps `mtn_momo` on `currency: EUR`.

### What the demo proves, and what it does not

| Proves                                                                     | Does not prove                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| The `private_key_jwt` handshake works end to end                           | That MTN or Orange work                                                            |
| Both flow shapes and the exact failure code for each failing outcome       | That a payer can complete Orange's hosted page (the URL is printed, never clicked) |
| The API response and the stored row agree                                  | That vpay's checkout page or the shop works (the demo never opens either)          |
| Settlement is the worker asking the rail over HTTP                         | That a rail can call vpay back (no stub calls the callback route)                  |
| The webhook a merchant receives verifies with `vpay_sdk::webhooks::verify` | Anything about a deployment, and it is not a CI gate                               |

### After the walkthrough

- **The shop.** `vpay-shop` is a demo merchant storefront on
  `http://localhost:3001`. You can buy something with either rail, and an order
  turns `paid` only when the shop's own webhook handler has verified a delivery.
  See [Hosted checkout](/checkout/hosted) and
  [`docs/runbooks/checkout.md`](vpay:docs/runbooks/checkout.md).
- **The dashboard.** There is no sign-up. Run `just demo-staff` against the
  running stack, then sign in on `http://localhost:3000` with the one-time
  password it wrote. You will enrol TOTP and replace the password. By default it
  shows the **shop's** tenant, not the walkthrough's. See
  [Dashboard authentication](/dashboard/authentication).

### Two demos on one machine

The `just` variables move the Compose project and the published host ports:
`demo_project`, `demo_port`, `demo_receiver_port`, `demo_orange_port`,
`demo_checkout_port`, `demo_shop_port` and `demo_dashboard_port`. The server
still binds 8080 inside its container.

```bash
just demo_port=18080 demo_receiver_port=18083 demo
just demo_project=vpay-demo demo-down          # teardown needs no port
```

## Running the binaries directly

Both modes use a `clap` CLI in which every option can also come from an
environment variable. An explicit flag wins over its variable. `--help` shows
the flag set that is actually live:

```bash
cargo run -p vpay-server -- --help
cargo run -p vpay-server -- worker --help
```

The server signs merchant tokens, so it needs an RS256 key before it will start.
Generate one offline:

```bash
cargo xtask gen-signing-key --out ./secrets   # writes ./secrets/oauth-signing-key.pem
```

The rail credentials in `config/application.yml` are `${VAR}` placeholders, and
an unresolved placeholder is a fatal startup error. So every one of them must be
**set**, even if some are empty:

```bash
export MTN_SUBSCRIPTION_KEY=dev MTN_API_KEY=dev \
       MTN_API_USER=11111111-2222-3333-4444-555555555555 \
       MTN_DISBURSEMENT_SUBSCRIPTION_KEY= MTN_DISBURSEMENT_API_KEY= \
       MTN_DISBURSEMENT_API_USER= \
       ORANGE_MERCHANT_KEY=dev ORANGE_CLIENT_ID=dev ORANGE_CLIENT_SECRET=dev

# flags win over env vars
cargo run -p vpay-server -- \
  --config config/application.yml \
  --database-url postgres://vpay:vpay@localhost:5432/vpay \
  --oauth-signing-key-file ./secrets/oauth-signing-key.pem \
  --bind 127.0.0.1:8080 --log-format text
```

The three Disbursements variables are empty on purpose. No real MTN
Disbursements credential exists in the project, so a refund answers
`ProviderError::Config`, which names the blank variable.

| Flag                       | Env var                       | Required by                                      |
| -------------------------- | ----------------------------- | ------------------------------------------------ |
| `--config`                 | `VPAY_CONFIG`                 | every mode                                       |
| `--database-url`           | `DATABASE_URL`                | every mode                                       |
| `--oauth-signing-key-file` | `VPAY_OAUTH_SIGNING_KEY_FILE` | serve only (the worker does not accept it)       |
| `--bind`                   | `VPAY_BIND`                   | —                                                |
| `--log-format`             | `VPAY_LOG_FORMAT`             | —                                                |
| `--observability-bind`     | `VPAY_OBSERVABILITY_BIND`     | — (default `0.0.0.0:9090`: `/livez`, `/metrics`) |

If a required option is missing, the process exits with code **`78`**
(`EX_CONFIG`) before it binds the port. This is true in both modes. Both modes
call a rail. The server calls one when a merchant confirms, and the worker calls
one when it polls. Whether that rail is MTN, Orange or a WireMock stub is a line
in the YAML.

## Tests

| Command         | Needs                                           | Runs                                                                                                                             |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `just verify`   | Rust, and the pinned `cratestack` CLI on `PATH` | The repository's self-check gates, plus one advisory report                                                                      |
| `just test`     | **Docker**, and Node                            | `cargo nextest`, doctests and `pnpm -r test`. The Postgres suites use testcontainers and **fail**, never skip, without Docker    |
| `just test-e2e` | Docker, and Cypress's binary                    | Builds the images, boots the three compose files, runs four Cypress specs and tears the stack down. CI's `e2e` job does the same |
| `just ci`       | All of the above except the browser             | What to run before a PR: CI's self-checks, `rust`, `web` and supply-chain steps, in CI's order                                   |

```mermaid
flowchart LR
    V["just verify<br/>gates, seconds"] --> T["just test<br/>needs Docker"]
    T --> E["just test-e2e<br/>needs Docker + Cypress"]
    CI["just ci"] -.->|"covers"| V
    CI -.->|"covers"| T
    CI -.->|"does not cover"| E
```

## What can go wrong

| Symptom                                                                       | Cause and fix                                                                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `port is already allocated`                                                   | Another process holds a published port. Move it with the matching `demo_*` variable                                        |
| `invalid_client` at step 2                                                    | Another `demo-up` regenerated the shared keys, or `deployment.public_base_url` disagrees with `VPAY_BASE_URL`              |
| `/healthz` never answers in 120 s                                             | `demo-up` prints `docker compose ps` and the server log. Exit `78` means a config or CLI prerequisite is missing           |
| `vpay-shop` dies with `database "shop" does not exist`                        | A `pgdata` volume that is older than the shop. Run `just demo-down` (it deletes volumes), then `just demo`                 |
| A confirm answers `rail 'mtn_momo' settles in EUR; this PaymentIntent is XAF` | An old overlay. `just gen-demo-keys` regenerates it                                                                        |
| Cypress will not start                                                        | Its binary is not fetched by `pnpm install`. Run `pnpm exec cypress install`, or set `CYPRESS_INSTALL_BINARY=0` to skip it |
| Four `staff_sign_in.rs` cases fail on macOS with `os error 49`                | macOS gives only `127.0.0.1` to `lo0`. Run `just loopback-aliases` once per boot                                           |
| testcontainers cannot find Docker (rootless)                                  | `DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock cargo nextest run --workspace`                                          |
| `just build-dist` fails for the musl target                                   | `rustup target add x86_64-unknown-linux-musl`                                                                              |

## Status in this release

| Part                        | Status                  | Evidence                                                                                                  |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `just demo` from nothing    | <Status s="partial" />  | Green three times in a row on the merged Step 9 branch. It is a harness a person reads, not a build gate  |
| `just test-e2e`             | <Status s="built" />    | Green against the compose stack, and the MVP item for it is met. The rails are WireMock hosts             |
| Running against a real rail | <Status s="unproven" /> | Only one MTN sandbox charge has ever run, from a separate `live` profile. The demo never leaves its stubs |

The full procedure, with a real run's output pasted in, is
[`docs/runbooks/demo.md`](vpay:docs/runbooks/demo.md).

## Go deeper

- [docs/runbooks/demo.md](vpay:docs/runbooks/demo.md) and
  [§5, what it proves](vpay:docs/runbooks/demo/what-it-proves.md)
- [Signing in to the dashboard](vpay:docs/runbooks/demo/dashboard-sign-in.md)
- [examples/README.md](vpay:examples/README.md): every runnable integration, and
  which ones have run against a real vpay
- [compose.yml](vpay:compose.yml), [compose.e2e.yml](vpay:compose.e2e.yml),
  [compose.demo.yml](vpay:compose.demo.yml) and the [justfile](vpay:justfile)
- [Runbooks](/operate/runbooks) on this site
- Agents running or fixing the local stack should load
  [vpay-tooling](skill:vpay-tooling) and
  [vpay-troubleshooting](skill:vpay-troubleshooting).
