---
title: Notch Pay
description:
  How vpay's Notch Pay adapter collects MTN MoMo and Orange Money through one
  aggregator account, why it was admitted only after ADR-0031 amended the rules,
  the production risk that admission accepts, how its webhooks are checked,
  and what six payments in Notch Pay's real sandbox did and did not prove.
status: partial
sources:
  - docs/flows/adapter-notchpay.md
  - docs/status/verification/2026-10-21-notchpay-step5.md
  - docs/status/verification/2026-10-22-notchpay-b3b.md
  - docs/status/verification/2026-10-22-notchpay-refunds.md
  - docs/status/verification/2026-10-23-two-step-submit.md
  - docs/status/verification/2026-10-23-needs-reconciliation.md
  - docs/adr/0031-a-status-read-authenticated-by-a-server-side-key.md
  - docs/adr/0032-a-rail-issued-reference-is-committed-before-the-prompt.md
  - docs/rfc/0013-vpay-registers-its-own-callbacks.md
  - docs/rfc/0014-verifying-rail-callbacks.md
  - docs/status/verification/2026-10-23-notchpay-sandbox-two-step-and-channels.md
  - docs/status/verification/2026-10-23-notchpay-defaults-and-wrong-network.md
  - docs/status/verification/2026-10-23-webhook-signatures.md
  - docs/status/verification/2026-10-23-method-type-routing.md
  - docs/status/providers.md
  - docs/reference/vpay-notchpay.md
  - docs/runbooks/notchpay-sandbox-test.md
  - config/application-notchpay-sandbox.yml
skills:
  - vpay-notchpay
  - vpay-provider-adapters
---

# Notch Pay

Notch Pay is an **aggregator**: one merchant account collects MTN MoMo and
Orange Money in Cameroon, through `cm.mtn` or `cm.orange` when the payer chose
a network, else through `cm.mobile`. In vpay it is the
`notchpay` rail, added in v0.9.0. It is a **push** rail, like MTN: the
payer is prompted on their own handset, the payment is addressed on Notch Pay
by **Notch Pay's own reference** (`trx.…`), and only the authenticated status
read moves money.

The adapter is `backends/crates/vpay-adapter-notchpay`, on a separate client
crate, `backends/crates/vpay-notchpay`. Its calls were transcribed from Notch
Pay's documentation and its `openapi.yaml` 2.1.0, then corrected on 2026-10-21
from what Notch Pay's sandbox answered.

::: danger Notch Pay's sandbox has been called through the adapter. Its production never has.
On 2026-10-21 Notch Pay's real sandbox answered RFC-0012's sandbox questions
through `vpay-notchpay`'s probe, **not through the adapter**
([verification](vpay:docs/status/verification/2026-10-21-notchpay-sandbox-run.md)).
It contradicted the adapter's addressing: process and read take Notch Pay's
`trx.…` reference, and vpay's own reference is a `404`. The adapter was fixed
the same day, in v0.9.1. **Six test-mode payments have since gone through vpay
itself** (server, worker and Postgres, `livemode=false`, test keys, the
maintainer's own machine), on Notch Pay's documented sandbox outcome numbers:

- **Step 5, 2026-10-21**
  ([verification](vpay:docs/status/verification/2026-10-21-notchpay-step5.md)):
  an MTN success, an MTN "other failure", and an "insufficient funds" number
  that read `complete` for less than its amount and was refused, never a
  success.
- **Runbook B3b, 2026-10-22**
  ([verification](vpay:docs/status/verification/2026-10-22-notchpay-b3b.md)):
  an MTN timeout (`payer_timeout`), an MTN cancel by the payer
  (`payer_declined`), and an **Orange** success.

No real payer was prompted and no real money moved. **Still not proven:**

- Notch Pay's production, or any live key.
- A webhook: none has ever been delivered. An endpoint the probe created
  through Notch Pay's API, at a public URL, was stored with no URL and
  received nothing. vpay's own endpoint registration has never run against a
  real Notch Pay account, and its signature check has never checked a webhook
  Notch Pay sent.
- Any refund. `notchpay::refund` is `ProviderError::NotImplemented`, and the
  sandbox answered `403` to every `POST /refunds` the probe made.
- What changed on 2026-10-23, through vpay: the two-step submit, the channel
  that follows the payer's network, a wrong-network number as
  `invalid_payer`, the immediate escalation of an answer only a person can act
  on, and the signature check. Each is proven against a WireMock Notch Pay and
  a real Postgres, and vpay has sent none of them to Notch Pay. The probe
  measured Notch Pay's side of the two-step split and of the per-network
  channels that day, **not through vpay**
  ([verification](vpay:docs/status/verification/2026-10-23-notchpay-sandbox-two-step-and-channels.md)).

The shared conformance suite's `notchpay` row still runs against a WireMock
stub, which proves the adapter against that stub and nothing about Notch Pay.
The rail is not wired into the compose, demo or e2e stacks:
`config/application.yml` carries its block **commented out**.
:::

Agents working on this adapter should load [vpay-notchpay](skill:vpay-notchpay).

## Admitted under ADR-0031

[ADR-0029](/guide/decisions#architecture)'s third hard rule refused an adapter
to any provider whose status read accepts a publishable key. Notch Pay's
`GET /payments/{reference}` is documented as authenticated by the key Notch Pay
itself calls **public**. So `notchpay` does not pass that rule as written.

[ADR-0031](vpay:docs/adr/0031-a-status-read-authenticated-by-a-server-side-key.md)
amended the rule on 2026-10-20, for every provider: such a read is admissible
when the deployment keeps the key server-side and meets six conditions.
`notchpay` is admitted under that amendment, and vpay's provider matrix says so
in its own words rather than "rule 3 passes".

| Condition                                          | How `notchpay` meets it                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Every secret is sent on every call              | The client sends `X-Grant: <private_key>` on every request                                                                                        |
| 2. Boot refuses a configuration without the secret | `REQUIRED_RAIL_KEYS` requires both `public_key` and `private_key`                                                                                 |
| 3. The exposure is written where an operator reads | The flow's "Production risks", and comments beside the keys in `config/application.yml`, `.env.example` and the Helm values                       |
| 4. The process says it too                         | `ProviderAdapter::accepted_exposure`, logged at `WARN` at every boot of `serve` and `worker`. In livemode, boot also needs an explicit acceptance |
| 5. Integrity is checked on the answer              | A success counts only for the charge's own amount and currency; anything else needs an operator (`NeedsReconciliation`)                           |
| 6. The written question stays open                 | The question to Notch Pay, whether the read can require the private key, is unanswered                                                            |

## The production risk

Whoever holds a merchant's Notch Pay **public key** can, on that merchant's
account and without vpay ever learning of it, read any payment, initialize a
payment, send a USSD prompt in the merchant's name to **any** phone number, and
cancel any pending payment, including one of vpay's. Since v0.9.1 a
`canceled` read is `payer_declined` (see [status mapping](#status-mapping)), so
such a cancel arrives as a payer's decline: the read is evidence of a decline,
not proof of whose.

vpay keeps the key server-side and never hands it to a browser or an app. That
is all it can do. Notch Pay's own documentation calls public keys safe to put
in front-end code. **A merchant who does so has given every operation above to
anyone who loads that page.**

Every boot of a deployment that configures `notchpay` logs this risk at `WARN`;
in livemode the line opens with `LIVEMODE, REAL MONEY`, and it never prints a
key. **In livemode, boot refuses the rail until its block says
`settings.accept_public_key_exposure: true`.** Setting it is the operator's
written acceptance of the risk. It does not silence the warning.

The flow lists what else an operator takes on: a webhook is checked only where
the Hash Key is configured, and the check has never met one Notch Pay sent
([webhook signatures](#webhook-signatures)); no Notch Pay page names a licence
or a regulator; the merchant agreement reserves the service to natural
persons; and Notch Pay's fraud system rejects some payments outright.

## The push payment

A charge is **two port calls with a commit between them**
([ADR-0032](vpay:docs/adr/0032-a-rail-issued-reference-is-committed-before-the-prompt.md),
since 2026-10-23). The adapter declares `SubmitSteps::PrepareThenSubmit`, the
only rail that does.

```mermaid
sequenceDiagram
    autonumber
    participant API as vpay-api
    participant DB as Postgres
    participant A as notchpay adapter
    participant N as Notch Pay
    participant P as Payer handset
    participant W as vpay worker
    Note over A,N: The wire calls have met Notch Pay's real sandbox through vpay (six payments, 2026-10-21 and -22) and WireMock. vpay's two port calls and per-network channels have met WireMock only; the probe measured Notch Pay's side of both. Production never. No webhook has ever been delivered.
    API->>A: prepare(charge, config)
    A->>N: POST /payments (amount, XAF, phone, reference = charge UUID)
    N-->>A: 201 pending, reference trx.…, trxref = charge UUID
    A-->>API: notchpay_reference = trx.… (nobody prompted yet)
    API->>DB: commit trx.… on the charge, then the submit row
    API->>A: submit(charge, config)
    A->>N: POST /payments/{trx.…} (channel cm.mtn, cm.orange or cm.mobile; phone)
    N->>P: USSD prompt
    N-->>A: 202
    A-->>API: Submitted (no redirect)
    opt webhook (a hint only, never delivered)
        N->>API: POST /provider/notchpay/callback
        API->>A: verify_callback(headers, raw body)
        A-->>API: Verified, Invalid or NoSecret
        API-->>N: 202, poll pulled forward unless Invalid
    end
    W->>A: query_status(charge, config)
    A->>N: GET /payments/{trx.…}
    N-->>A: pending, complete, failed, expired, canceled, …
    A-->>W: ChargeStatus
```

Every call carries `Authorization: <public_key>`, `X-Grant: <private_key>` and
the configured request deadline, and the client follows no redirect.
**`prepare`** is `POST /payments` with vpay's own reference: it creates the
payment, **prompts nobody**, and returns Notch Pay's `trx.…`. The core commits
that reference on the charge, then writes the `submit` row. **`submit`** is
`POST /payments/{notchpay_reference}`, by the reference the charge now holds,
and is the call that prompts the payer. A first answer with no Notch Pay
reference, or one whose `trxref` is not this charge's, is `Malformed`, and
nothing is sent to the payer.

**The channel follows the payer's network.** Notch Pay is the first rail that
serves two payment-method types, `mtn_wallet` and `orange_wallet`, so the
[router](/rails/provider-port) can choose it for either. `submit` sends
`cm.mtn` for a charge whose method type is `mtn_wallet`, `cm.orange` for
`orange_wallet`, and `settings.channel` (`cm.mobile`) for a charge confirmed by
the rail code `notchpay`, which carries no type. That is proven against a
WireMock Notch Pay whose request journal shows the channel sent
([verification](vpay:docs/status/verification/2026-10-23-method-type-routing.md));
vpay itself has not sent `cm.mtn` or `cm.orange` to Notch Pay. The probe has:
every MTN outcome number on `cm.mtn` and every Orange one on `cm.orange` read
what it read on `cm.mobile`, each within about 5 seconds.

**A number the chosen network does not take is `invalid_payer`.** Sent on the
other network's channel, a number is refused at process with a `422` whose
`errors` name only `phone` ("Invalid CM Mobile Money", "Invalid CM Orange
Money", as the probe measured). The adapter maps exactly that to
`Rejected { invalid_payer }`, with a message of vpay's own so the number is
never quoted back. A `422` that names any other field stays `provider_error`,
as does the same refusal on initialize, which was not measured. Proven against
a WireMock Notch Pay that answers what the sandbox answered
([verification](vpay:docs/status/verification/2026-10-23-notchpay-defaults-and-wrong-network.md));
vpay has not sent such a number to Notch Pay.

The read is `GET /payments/{notchpay_reference}`, and its answer must name the
charge's own reference as `trxref`, or it is `Malformed`. A charge holding no
`notchpay_reference` needs an operator (`NeedsReconciliation`) before any
request: that is key material vpay lost, never `NotFound`.

Notch Pay's specification shows vpay's own reference in those paths. The
sandbox answered `404` "Payment Not Found" to every process and read by it and
accepted only its own `trx.…`. In every one of the six runs the charge held
its `trx.test_…` after submit, and every read made by it was answered.

**The crash window, closed on vpay's side.** Notch Pay's reference exists only
in the initialize answer, and the sandbox's `GET /payments?search=` does not
find a payment by vpay's reference. Before 2026-10-23 a crash between the
prompt and the reference being stored left a payment vpay could not read. Now
the reference is committed before anything prompts, so a crash leaves one of
three states:

| After the crash                              | What recovery does                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| a `prepare` row, no `trx.…`, no `submit` row | the retried `prepare` meets `409`; nobody was prompted, so the charge fails `provider_unavailable` and the payer can try again |
| the `trx.…` held, no `submit` row            | the retry skips `prepare` and prompts by the held reference: one initialize, one process                                       |
| the `trx.…` held, an unanswered `submit` row | the poll reads by the held reference; nothing is sent again                                                                    |

A charge left in flight by the earlier one-call build, with an unanswered
`submit` row and no `trx.…`, may have prompted the payer, and still needs an
operator. A lost initialize leaves a payment on Notch Pay that nobody
processed, which Notch Pay is expected to expire after three hours, by its own
wording. This is proven against WireMock and a real Postgres, each guard
mutation-checked
([verification](vpay:docs/status/verification/2026-10-23-two-step-submit.md)),
and vpay has **not** run the split against Notch Pay.

The probe measured Notch Pay's side of it on 2026-10-23
([verification](vpay:docs/status/verification/2026-10-23-notchpay-sandbox-two-step-and-channels.md)).
A payment initialized and never processed still read `pending` after an
hour. A process 300 s after its
initialize was accepted and read `complete` about 5 s later. The same
reference sent again answered `409` "Reference already existing", which is
what the adapter expects. A process 3600 s late was accepted, but the payment
stalled in `processing` and did not complete.

## Status mapping

| Notch Pay status                            | vpay `ChargeStatus`                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pending`, `processing`, `incomplete`       | `Pending`. `incomplete` (paid less than asked) is never a success                                            |
| `complete`, `refunded`, `partialy-refunded` | `Succeeded`, **only if** `amount`, `amounts.total` and currency are the charge's; else `NeedsReconciliation` |
| `canceled`                                  | `Failed(payer_declined)`                                                                                     |
| `failed`, `rejected`                        | `Failed(provider_error)`                                                                                     |
| `expired`, `abandoned`                      | `Failed(payer_timeout)`                                                                                      |
| any other status, or none                   | `Malformed`                                                                                                  |
| `404` "Payment not found"                   | `NotFound`, which is never on its own a failure ([crash safety](/payments/crash-safety))                     |

The read names no failure reason. On 2026-10-21 the sandbox's outcome numbers
read `complete` (MTN and Orange success), `failed` (other failure), `expired`
(timeout) and `canceled` (canceled by user), with no reason field. So this rail
produces `payer_timeout`, `payer_declined`, `provider_error`,
`provider_account_blocked`, `provider_unavailable` (the `409` for a payment
nobody was prompted for) and `invalid_payer` (a process `422` on the phone
alone). It never produces `insufficient_funds`. See
[failures](/payments/failures).

Through vpay, every one of those numbers has now run. The MTN and Orange
success numbers became `succeeded`, each with one balanced ledger capture and
the event `payment_intent.succeeded`. The "other failure" number became
`provider_error`, the timeout number `payer_timeout` and the cancel number
`payer_declined`, each with the intent back at `requires_payment_method`. Each
settled on the worker's second read, 11 to 15 seconds after create, with no
webhook. The failure numbers that ran through vpay were MTN's. Notch Pay's
testing page gives the same five outcome numbers for Orange, and the probe ran
Orange's on `cm.orange` on 2026-10-23, where they read as MTN's do; vpay itself
has not run Orange's failure path.

**The "insufficient funds" number reads `complete`, for less than was asked**
(`amount` 107, `amounts.total` 105, in step 1). Comparing `amount` alone would
have made it a success. A success needs `amounts.total` to be the charge's
too, and a read with no `amounts` is refused as well. In step 5 the charge
was refused on every read after the first and never succeeded; under the code
of that day it would have reached `unresolved` only after 24 hours.
**Since 2026-10-23** ([#313](https://github.com/vaam-apps/vpay/issues/313))
such an answer is `NeedsReconciliation`: the worker makes the charge
`unresolved` on the first read that says so, and an operator is alerted. That
is proven against WireMock and a real Postgres
([verification](vpay:docs/status/verification/2026-10-23-needs-reconciliation.md)),
not against Notch Pay.

A success with no `id` records Notch Pay's `trx.…` reference as the provider
transaction id, since the sandbox's answers carry no `id`.

## Configuration

```yaml
providers:
  - code: notchpay
    host:
      url: https://api.notchpay.co # one host for sandbox and production
      label: notchpay
    currency: XAF # the only one allowed
    settings:
      channel: cm.mobile # the only value this setting takes; a charge routed by method type is sent cm.mtn or cm.orange
      description: Payment # optional; the one free-text field Notch Pay receives
      accept_public_key_exposure: true # livemode refuses to boot without it
    credentials:
      public_key: ${NOTCHPAY_PUBLIC_KEY}
      private_key: ${NOTCHPAY_PRIVATE_KEY}
      callback_signing_secret: ${NOTCHPAY_HASH_KEY} # the endpoint's Hash Key
      # callback_signing_secret_previous: ${NOTCHPAY_HASH_KEY_PREVIOUS} # during a rotation only
    callbacks: # optional; absent (or `{}`) means `register: off` and `verify: on` on this rail
      register: off # or `check` (list, never create) or `ensure` (create vpay's endpoint)
      # verify: off # livemode without a Hash Key only: accept unverified webhooks
```

Boot refuses a block that lacks either key, names a channel other than
`cm.mobile` or a currency other than `XAF`. `cm.mtn` and `cm.orange` are chosen
per charge from the payer's network, never configured: set for a whole
deployment, either would fail every payer on the other network. Because Notch
Pay serves sandbox and production from one host, **the livemode rule is on the
keys**: in livemode a key containing `test.` or `test_` refuses to boot, and
outside livemode a key with neither does. The real test-mode keys carry
`test.`, which vpay measured and corrected for in v0.9.0. The error names the
key and never prints it.

The signing secret has boot rules of its own
([webhook signatures](#webhook-signatures)):

- **In livemode, a `callback_signing_secret` or `callbacks.verify: off`.**
  Outside livemode, a rail with no secret boots with a `WARN`; `verify: off`
  without a secret boots with one in either mode, at every boot.
- **Never both.** A configured secret is checked whatever `verify` says, so
  `off` beside one is refused.
- **No surrounding whitespace**, such as a trailing newline from the file the
  Secret came from, and **no previous secret without a current one**. Every
  boot logs a `WARN` while `callback_signing_secret_previous` is set.

Each refusal exits `78` and names the rule, never the secret.

The keys are the merchant's own Notch Pay account's. Provider credentials are
configured once per rail, so every merchant on a deployment collects into that
one account. Since the maintainer's decision of 2026-10-22 the rule is one
deployment per **legal entity**, not per merchant: projects of one company may
share a deployment, and a merchant that is another company, a subsidiary
included, needs its own
([RFC-0009](vpay:docs/rfc/0009-provider-accounts-per-merchant.md), revised, a
draft). Its phase A, which would make vpay refuse a second company at boot, is
not built, so nothing in code checks this yet. Whether Notch Pay lets a company
hold an account at all is an open question (RFC-0012 § 10 item 10).

## Callbacks

Notch Pay is not told a callback URL on each payment, so the account must hold
a webhook endpoint at `{public_base_url}/provider/notchpay/callback`.

**Since v0.12.0, vpay asks a Notch Pay account nothing unless told to.** With
`callbacks.register` unset, or `callbacks: {}`, the rail is `off`: its adapter
declares that default (`ProviderAdapter::default_callback_registration`), the
worker logs one `info` line saying so at start, and no pass lists or creates
anything on the account. The operator who wants callbacks registers vpay's URL
in Notch Pay's dashboard for the five payment events. That route is unmeasured
too: nothing has been delivered to vpay by either.

The maintainer chose this default after the sandbox run of 2026-10-23
([verification](vpay:docs/status/verification/2026-10-23-notchpay-sandbox-two-step-and-channels.md)).
The probe created an endpoint through `POST /webhooks`, the call vpay's own
registration makes, at a public URL that could receive. Notch Pay stored it
with `"url": null`, nothing reached the URL in 21 minutes, and `GET`, `PUT` and
`DELETE /webhooks/{id}` all answered `404`, so the endpoint could not be read,
repaired or removed through the API. Four payments processed after it existed
stayed `processing` for 3 to 55 minutes, where eleven before it settled in
about 5 seconds. That is a correlation, not a shown cause, and one more reason
not to write to a merchant's account unasked.

An explicit `register:` always wins
([RFC-0013](vpay:docs/rfc/0013-vpay-registers-its-own-callbacks.md)):

- **`ensure`**: the worker's `ensure_callbacks` job keeps an endpoint there, at
  every worker start and hourly, and `vpay-server callbacks ensure` runs the
  same pass by hand. A pass lists every endpoint, recognises vpay's by its
  description (the sandbox answers `"url": null` for every endpoint), creates
  one only when none exists, and never modifies or deletes anything. On the
  sandbox's evidence, the endpoint it creates delivers nothing.
- **`check`**: the pass only lists and reports. A hand-registered endpoint
  must then carry vpay's description, or the pass cannot see it.
- **`off`**: the pass skips the rail and counts nothing, so the alert
  `VpayCallbackEndpointUnconfirmed` cannot fire for it
  ([runbooks](/operate/runbooks#callback-endpoints)), and
  `vpay-server callbacks ensure` prints `notchpay off off -`.

The sandbox profile, `config/application-notchpay-sandbox.yml`, sets
`register: check`, so a worker started for the sandbox runbook lists and never
creates; registering is a step of its own, B4, which has not been run. **vpay's
registration is proven against a WireMock Notch Pay and a real Postgres,
including that an unset `register` sends nothing to the account, and has never
run against a real Notch Pay account.**

The endpoint is optional for correctness: in every sandbox run the worker's
authenticated read settled the payment, and no webhook was delivered. Notch
Pay's own reference asks a receiver for a `200` so that it does not retry, and
vpay answers `202`; whether Notch Pay counts that as delivered is an open
question.

## Webhook signatures

Notch Pay signs each webhook in `x-notch-signature`. Since v0.12.0
([RFC-0014](vpay:docs/rfc/0014-verifying-rail-callbacks.md)) vpay checks it:
the callback route hands the adapter the headers and the **raw body**
(`verify_callback`), and the adapter accepts the header when it is the hex
HMAC-SHA256 of that body under `credentials.callback_signing_secret` or, during
a rotation, `credentials.callback_signing_secret_previous`, compared in
constant time. The secret is the endpoint's **Hash Key**, copied from Notch
Pay's dashboard. Registering an endpoint does not supply it: Notch Pay's create
answer returned none in the sandbox.

| The webhook                                           | Verdict            | The charge's poll                       |
| ----------------------------------------------------- | ------------------ | --------------------------------------- |
| signed under the configured secret                    | `Verified`         | pulled forward                          |
| signed under the previous secret, during a rotation   | `VerifiedPrevious` | pulled forward                          |
| no header, a non-ASCII one, or one matching no secret | `Invalid`          | **left where it was**, logged at `WARN` |
| any, with no secret configured                        | `NoSecret`         | pulled forward                          |

Every answer is the same `202`, as for a reference no charge holds: a different
one would tell a caller the charge exists. Each verdict is counted on
`vpay_provider_callbacks_total{provider="notchpay",verdict}`; a
`verified_previous` count says the previous secret is still in use, so it is
how an operator knows a rotation can end. A steady `invalid` with no `verified` beside it usually means
the Hash Key was rotated in the dashboard and not in the Secret. No header
value, body byte or secret is logged. A webhook that passes is still only a
hint: the authenticated read is what moves money.

**Stub-proven, and never checked against a webhook Notch Pay sent**
([verification](vpay:docs/status/verification/2026-10-23-webhook-signatures.md)).
The scheme was transcribed from Notch Pay's guide, which signs the raw body in
its PHP and Python examples but `JSON.stringify(req.body)` in its Node one.
Those are the same bytes only for a body Notch Pay serialised compactly itself.
If the real scheme differs, every genuine webhook reads `Invalid`, and the cost
is latency: the poll ladder still settles each charge. The signature carries no
timestamp, so a captured genuine webhook verifies again; all it can do is pull
that charge's poll forward. Checking a real webhook needs the Hash Key **and**
an endpoint Notch Pay actually delivers to, and none has been delivered yet.

## Refunds: `NotImplemented`

Notch Pay's refunds guide documents full and partial refunds back to the
origin, so the adapter declares `supports_refunds: true`,
`supports_partial_refunds: true` and `refund_destination: Origin`. But the
guide's `POST /refunds` is absent from the specification and carries nothing
that would make a replay safe, so a lost answer re-sent would pay twice.
`refund` therefore returns the declared token
`NotImplemented("notchpay::refund")` until Notch Pay confirms a replay-safe
refund in writing. Account-holder lookup is `Unsupported`.

On 2026-10-22 the probe asked the sandbox. `POST /refunds` answered `403`
"Forbidden", with no message, to all four requests against a `complete`
payment, and refunded nothing
([verification](vpay:docs/status/verification/2026-10-22-notchpay-refunds.md)).
Whether that is an IP allowlist or refunds not being enabled for the account is
not known, and replay safety is still unmeasured. The probe did not ask again
on 2026-10-23: the payment it meant to refund stayed `processing`.

## Status in this release

| Part                                       | Status                   | Evidence                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submit and status read                     | <Status s="partial" />   | Six payments through the adapter against Notch Pay's real sandbox on 2026-10-21 and -22 (MTN and Orange outcome numbers, `cm.mobile`, XAF): two succeeded, three failed with the mapped code, one short collection was refused. The conformance suite's `notchpay` row is a WireMock stub         |
| Addressing by Notch Pay's `trx.…`          | <Status s="partial" />   | Met Notch Pay in all six runs: every charge held it after submit and every read by it was answered                                                                                                                                                                                                |
| The two-step submit (ADR-0032)             | <Status s="unproven" />  | Proven against WireMock and a real Postgres, each guard mutation-checked; vpay's two port calls have not met Notch Pay. The probe measured Notch Pay's side on 2026-10-23: an unprocessed payment stays `pending` for at least an hour, and a process 300 s late completes                        |
| A short collection is never a success      | <Status s="partial" />   | Refused on eleven reads of a real sandbox answer. Since 2026-10-23 it escalates to `unresolved` on the first such read, proven against WireMock and a real Postgres, not observed with Notch Pay                                                                                                  |
| Callback registration (RFC-0013)           | <Status s="unproven" />  | `off` on this rail unless `register` says otherwise. Proven against WireMock and a real Postgres, including that an unset `register` asks the account nothing; never run against a real Notch Pay account. The probe's endpoint, created through the same API, stored no URL and received nothing |
| Callback parsing                           | <Status s="unproven" />  | Parsed in conformance; no webhook has ever been delivered by Notch Pay                                                                                                                                                                                                                            |
| Boot rules and the exposure warning        | <Status s="built" />     | Tested in process, by running the real binary on a Notch Pay fixture configuration, and logged at every sandbox run's boot by both the server and the worker. The signing-secret rules are tested in process only                                                                                 |
| Webhook signature check (RFC-0014)         | <Status s="unproven" />  | The adapter's unit tests, the conformance case `a_forged_callback_is_refused_by_a_rail_that_checks`, and `a_webhook_the_rail_did_not_sign_moves_nothing_and_a_signed_one_settles` against WireMock and a real Postgres, each guard mutation-checked; never run on a webhook Notch Pay sent        |
| `refund`                                   | <Status s="not-built" /> | `NotImplemented("notchpay::refund")`; the sandbox answered `403` to `POST /refunds`                                                                                                                                                                                                               |
| `cm.mtn` and `cm.orange` channels          | <Status s="unproven" />  | Chosen from the payer's network; proven against WireMock by the stub's request journal. vpay has not sent either to Notch Pay; the probe ran every outcome number on both on 2026-10-23                                                                                                           |
| A wrong-network number is `invalid_payer`  | <Status s="unproven" />  | Proven against WireMock by `notchpay_a_number_on_the_other_network_is_an_invalid_payer`, whose stub answers what the sandbox answered the probe; vpay has not sent such a number to Notch Pay                                                                                                     |
| Production and a live key                  | <Status s="unproven" />  | Never called; a live key's prefix is a written question to Notch Pay                                                                                                                                                                                                                              |
| Wired into the compose, demo or e2e stacks | <Status s="not-built" /> | The block in `config/application.yml` is commented out. The real runs used the `notchpay-sandbox` profile on the maintainer's machine                                                                                                                                                             |

The runs are described in
[the runbook section](/operate/runbooks#test-notch-pay-against-its-sandbox):
Part A (the probe) and Part B (vpay itself, steps 5 and B3b). The probe's
2026-10-23 phases measured the two-step split and the per-network channels on
Notch Pay's side. None received a webhook, so Notch Pay's signature has not
been measured.

## Go deeper

- [Adapter: Notch Pay](vpay:docs/flows/adapter-notchpay.md): the calls, the
  production risks, and the "to confirm" items that decide whether the adapter
  is right, each marked with what the sandbox answered
- vpay's dated verification pages:
  [step 5](vpay:docs/status/verification/2026-10-21-notchpay-step5.md),
  [B3b](vpay:docs/status/verification/2026-10-22-notchpay-b3b.md),
  [the step 1 probe run](vpay:docs/status/verification/2026-10-21-notchpay-sandbox-run.md),
  [the addressing fix](vpay:docs/status/verification/2026-10-21-notchpay-trx-reference.md),
  [the refunds probe](vpay:docs/status/verification/2026-10-22-notchpay-refunds.md),
  [the two-step submit](vpay:docs/status/verification/2026-10-23-two-step-submit.md),
  [the immediate escalation](vpay:docs/status/verification/2026-10-23-needs-reconciliation.md),
  [the two-step split and channels in the sandbox](vpay:docs/status/verification/2026-10-23-notchpay-sandbox-two-step-and-channels.md),
  [the per-network channel](vpay:docs/status/verification/2026-10-23-method-type-routing.md),
  [the `off` default and `invalid_payer`](vpay:docs/status/verification/2026-10-23-notchpay-defaults-and-wrong-network.md)
  and [the signature check](vpay:docs/status/verification/2026-10-23-webhook-signatures.md)
- [The Notch Pay sandbox runbook](vpay:docs/runbooks/notchpay-sandbox-test.md):
  how both parts are run
- [ADR-0031](vpay:docs/adr/0031-a-status-read-authenticated-by-a-server-side-key.md):
  the amended admission rule and its six conditions;
  [ADR-0032](vpay:docs/adr/0032-a-rail-issued-reference-is-committed-before-the-prompt.md):
  the two-step submit
- [RFC-0013](vpay:docs/rfc/0013-vpay-registers-its-own-callbacks.md): vpay
  registering its own callback endpoints, and why Notch Pay's default is `off`;
  [RFC-0014](vpay:docs/rfc/0014-verifying-rail-callbacks.md): checking a
  rail's callbacks
- [Providers](vpay:docs/status/providers.md): vpay's matrix of every rail it
  ships or has designed, cell by cell
- [`vpay-notchpay`](vpay:docs/reference/vpay-notchpay.md): the client crate's
  reference
- [The provider port](/rails/provider-port) and
  [MTN MoMo](/rails/mtn-momo) on this site
- Skill: [vpay-notchpay](skill:vpay-notchpay)
