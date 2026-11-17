---
title: Node.js SDK
description:
  Using @vaam-apps/vpay-sdk from a merchant server — how it signs every call and
  opens every answer, a real payment-intent example, errors, webhook
  verification, the stripe-node httpClient, and what its tests actually talk to.
status: partial
sources:
  - sdks/nodejs
  - examples/merchant-node
  - examples/merchant-stripe-node
  - docs/sdks/parity.md
skills:
  - vpay-sdks
  - vpay-merchant-api
---

# Node.js SDK

`@vaam-apps/vpay-sdk` is the Node.js merchant SDK for vpay's `/v1` API. It runs
on your server, holds your Ed25519 key, and since <Release /> **seals every call
and opens every answer** — so your code reads like a Stripe integration while
each request on the wire is a signed message instead of a call with an API key.
The sealing is not reimplemented in TypeScript: it is the Rust SDK's own code,
compiled to WebAssembly (`sdks/rust/wasm`). It has zero runtime dependencies and
needs Node.js `>=22.11.0`.

Agents working on this SDK should load [vpay-sdks](skill:vpay-sdks); for the
`/v1` contract it implements, [vpay-merchant-api](skill:vpay-merchant-api).

## Install

Inside the vpay workspace it is a workspace package:

```bash
pnpm --filter @vaam-apps/vpay-sdk build
```

Building it there needs Rust, the `wasm32-unknown-unknown` target and
`wasm-bindgen-cli` at the version `Cargo.lock` pins (`just wasm-build` says
which to install). From the npm registry, the package ships the compiled
`.wasm` and there is nothing to build:

```bash
pnpm add @vaam-apps/vpay-sdk
```

::: info On npm since 2026-09-19
`release.yml`'s `publish-node-sdk` job publishes the package on every `v*` tag;
the first version on the registry was `0.2.1`, and the package's
[README](vpay:sdks/nodejs/README.md) records `0.2.1` through `0.4.1` listed on
2026-09-23. The manifest in <Release /> is version `0.16.0`. Being published
proves nothing about what the server it talks to serves — see
[What its tests talk to](#what-its-tests-talk-to).
:::

## What the SDK does for you

`/v1` never accepts an API key, and this SDK sends no token: it only seals
([Signed requests](/api/signed-requests)). You are a registered **Ed25519 public
key** (`merchant_clients[].cose_keys` in vpay's configuration), and vpay finds
you by the key that signed.

```mermaid
sequenceDiagram
  participant App as Your code
  participant SDK as VpayClient
  participant W as sdks/rust/wasm
  participant API as vpay /v1
  App->>SDK: paymentIntents.create(...)
  SDK->>W: bind the operation, the query and the Idempotency-Key
  W-->>SDK: COSE_Sign1 message (signed in WASM, or by your signer callback)
  SDK->>API: POST on node:http(s), body = the message
  API-->>SDK: a sealed answer
  SDK->>W: verify under serverKeys.current or .next, for this request and status
  W-->>SDK: the JSON
  SDK-->>App: intent
```

There is no token to cache and no re-authentication. A signed request is sent
**once** and never retried by the SDK: not on a `5xx`, not on a timeout, and
not on vpay's coarse `401`. The transport is `node:http(s)` rather than `fetch`,
because a sealed `GET` carries a body. The SDK follows no redirect and reads at
most 8 MiB of an answer. Your private key either goes in as a seed, and the
WebAssembly module signs, or stays in Node behind a `crypto.KeyObject` or a
`signer` callback, in which case the module only ever sees the bytes to sign.

A deployment whose `auth.methods` permits `machine_tokens` also accepts a bearer
token from other callers ([Authentication](/api/authentication)). This SDK does
not speak that half: its token code was deleted, and a token mode is planned
(VPA-6), not built.

## Usage

From the package README. Amounts are integer minor units; XAF is zero-decimal,
so `5000` is 5,000 FCFA ([Money](/payments/money)).

```ts
import { readFileSync } from "node:fs";
import { VpayClient } from "@vaam-apps/vpay-sdk";

const vpay = new VpayClient({
  baseUrl: "https://api.vpay.example",
  clientId: "merchant_a", // kept for logs; vpay finds you by your key
  // Your Ed25519 seed (32 bytes, unpadded base64url; `cargo xtask
  // gen-envelope-key` writes one), a PKCS#8 PEM or a crypto.KeyObject.
  privateKey: readFileSync("./merchant_a.seed", "utf8"),
  // vpay's two response keys, which it logs at boot: the one it signs with
  // now and the one it will after the next rotation.
  serverKeys: {
    current: readFileSync("./vpay-current.pub", "utf8").trim(),
    next: readFileSync("./vpay-next.pub", "utf8").trim(),
  },
});

const intent = await vpay.paymentIntents.create(
  {
    amount: 5000, // 5,000 FCFA — XAF is zero-decimal, see docs/flows/money.md
    currency: "xaf",
    payment_method_types: ["mtn_momo"],
    metadata: { order_id: "1234" },
  },
  { idempotencyKey: "order_1234_attempt_1" },
);

const confirmed = await vpay.paymentIntents.confirm(intent.id, {
  payment_method_data: {
    type: "mtn_momo",
    mtn_momo: { msisdn: "237670000000" },
  },
});

// `processing` means NOT YET. Wait for a payment_intent.succeeded webhook,
// or poll retrieve(). There is no `failed` status — see payment-lifecycle.md.
console.log(confirmed.status);

// Orange Money is a redirect rail:
const redirectConfirm = await vpay.paymentIntents.confirm(intent.id, {
  payment_method_data: { type: "orange_money" },
  return_url: "https://shop.example/return",
});
if (redirectConfirm.next_action?.type === "redirect_to_url") {
  // redirect the payer's browser to redirectConfirm.next_action.redirect_to_url.url
}
```

A push rail (MTN) moves the intent to `processing` while the payer approves on
their handset; a redirect rail (Orange) answers `requires_action` with a URL to
send the payer to ([Payment lifecycle](/payments/lifecycle)). The client also
exposes `refunds`, `events.list`, `checkout.sessions`, `customers`, `invoices`,
`invoiceItems`, `accountHolders` and `balance`; the package README covers each.
`PaymentMethodType` holds the three rail codes, `"mtn_momo" | "orange_money" |
"notchpay"` (`notchpay` since v0.9.0), and since v0.12.0 two **payment-method
types**, `"mtn_wallet" | "orange_wallet"`. A type names the payer's wallet
network and leaves the server's router to pick the rail at confirm
([Payment lifecycle](/payments/lifecycle#which-rail-a-confirm-reaches)). It is
meaningful in a create's `payment_method_types` only, and needs a server with
migration `0053`; an older one refuses it as an unknown rail.
`ConfirmPaymentIntentParams` still names rail codes only, so this SDK cannot
confirm by type or pin a rail with `payment_method_options[<type>][rail]`: a
dated ⛔ in the matrix.

Since v0.14.0 a `PaymentIntent` has `payment_method_details?:
PaymentMethodDetails | null`, both exported: `null` until the intent has a
charge, then `{ type, rail }`, where `type` is `string | null` and is `null`
when the charge records none. It is optional because an older vpay omits the
key.

Two additions from vpay 0.6.0 are worth knowing:

- **`paymentIntents.list`, `refunds.list` and `checkout.sessions.list` take
  `customer`** ([filtering a list by customer](/api/#filtering-a-list-by-customer)).
  A server older than 0.6.0 does not know the parameter and silently returns the
  **unfiltered** list, every customer's rows, with no error. Check the server's
  version before relying on it.
- **`invoices.pay` takes an optional `outOfBand` object** (`method`,
  `reference`, `receivedAt`) to record a payment made outside vpay
  ([paid out of band](/api/invoices#paid-out-of-band)). A `success_url` or
  `cancel_url` beside it is refused with a `VpayInvalidParamsError` naming the
  field, before any request. The hosted arm of `PayInvoiceParams` is the old
  shape, so existing callers are unaffected.
  `events.retrieve` does not exist in this SDK (a dated parity gap), and
  `balance.retrieve` is refused locally with a `VpayInvalidParamsError`, before
  anything is signed, because no operation in the contract table serves
  `/v1/balance`.

`create()` and `retrieve()` return the intent's `client_secret` — the payer
credential you hand to [the browser client](/sdks/stripe). It is absent from
list items and webhook bodies. Do not log it: on a `PaymentIntent`,
`console.log(intent)` prints it (a dated gap); a `CheckoutSession` redacts its
own secret from `util.inspect`.

## Configuration worth knowing

| Option       | Default   | Note                                                                                                                                         |
| ------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`    | —         | Required. Where this process sends the request                                                                                               |
| `clientId`   | —         | Required, kept for logs; not sent                                                                                                            |
| `privateKey` | —         | An Ed25519 seed (bytes or unpadded base64url), PKCS#8 PEM or a `KeyObject`. An RSA or P-256 key is a `VpayConfigError`                       |
| `signer`     | —         | Instead of `privateKey`: `{ publicKey, sign(tbs) }` for a key in a KMS or HSM. A signature that does not verify is refused before it is sent |
| `serverKeys` | —         | Required. `{ current, next? }`. Pin `next` before vpay rotates, so a rotation is not a flag day                                              |
| `audience`   | `baseUrl` | What every signature is addressed to: vpay's `deployment.public_base_url`                                                                    |
| `timeoutMs`  | `30000`   | Every resource call                                                                                                                          |
| `agent`      | global    | An `http.Agent`/`https.Agent` for a proxy or a pool; there is no `fetch` option                                                              |

**The one that bites:** if your server reaches vpay by an internal name (a
compose service, a private DNS name) while vpay's public base URL is something
else, set `audience` to the public URL. Otherwise every call is vpay's coarse
unsigned `401`, with nothing in it pointing at the cause.

## Errors

Every error extends `VpayError`. Branch on the subclass, then on `code`:

| Class                         | When                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `VpayApiError`                | A non-2xx from a `/v1` route — `status`, `type`, `code`, `message`, `param`       |
| `VpayUnsignedResponseError`   | vpay refused the call before handling it: the answer is not sealed. Never retried |
| `VpayUnverifiedResponseError` | The answer claims to be sealed and does not verify under `serverKeys`             |
| `VpayUnexpectedResponseError` | A verified answer that is not the shape the SDK expects                           |
| `VpayTransportError`          | DNS, TLS, refused connection, timeout                                             |
| `VpayConfigError`             | Misconfiguration, caught at construction where possible                           |
| `VpayInvalidParamsError`      | A parameter the SDK refuses to send, caught before anything is sent               |
| `WebhookSignatureError`       | `verifyWebhook` rejected a delivery                                               |

Two idempotency errors share status `400` and type `idempotency_error` and mean
opposite things: `idempotency_key_in_flight` (wait and resend the same call) and
`idempotency_key_in_use` (the key was used with a different body — a bug).

`VpayInvalidParamsError` is the SDK saying no before anything leaves your
process: nothing is signed and no request is built. `sdks/rust`'s
`Error::InvalidParams` is its twin. It carries `param`, the parameter's wire
name — `amount`, `unit_amount`, `id`, `success_url`, or a nested form path such
as `metadata[order_id]` — and its message reads
`invalid request parameter {param}: {detail}`. It is thrown for:

- an amount outside `0..=2^53-1`;
- a value the form encoder cannot put on the wire exactly: a number that is not
  a safe integer, a `Date`, a `Map` or a class instance;
- a `success_url` or `cancel_url` beside `outOfBand` on `invoices.pay`;
- an empty or all-dots `id` on any of the twenty-one methods that put one in
  the path. `""`, `.`, `..` or a longer run of dots is refused before any
  request, with one fixed message that never quotes the id. Those ids would
  otherwise be sent, and `fetch`'s URL parser resolves them before the request
  leaves, so `customers.del("..")` would be a `DELETE /v1/`.

It extends `VpayError`, so the one catch-all, `instanceof VpayError`, catches it
with the rest. **It is not a `TypeError`.** Through v0.9.1 these refusals were
bare `TypeError`s; since v0.10.0, code that tests `instanceof TypeError` for
them no longer matches, and cannot be made to — a class has one superclass, and
making `VpayError` a `TypeError` would make a network failure one too. Test
`instanceof VpayInvalidParamsError` instead. No signature changed, and nothing
that was sent before is refused now. See [Errors](/payments/errors).

## Webhook verification

Verify the **raw** request body — a parsed and re-serialised body breaks the
HMAC. Delivery is at-least-once and unordered, so dedupe on `event.id`. Trimmed
from the README's example:

```ts
import { verifyWebhook, WebhookSignatureError } from "@vaam-apps/vpay-sdk";

let event;
try {
  // The RAW request body must be used — parsing and re-stringifying it
  // breaks the HMAC. Do not run a body-parsing middleware before this.
  event = verifyWebhook({
    rawBody: raw,
    signatureHeader: header,
    secret: webhookSecret,
  });
} catch (err) {
  if (err instanceof WebhookSignatureError) {
    res.writeHead(400).end("bad signature");
    return;
  }
  throw err;
}
```

It accepts any matching `v1=` during a secret rotation and rejects a timestamp
more than five minutes from your clock. See [Webhooks](/api/webhooks).

## Using the official Stripe SDK

If you already have code written against `stripe`, `@vaam-apps/vpay-sdk/stripe`
exports `createStripeHttpClient`, a stripe-node `httpClient` that seals each
request and opens each answer. An `authenticator` can only add a header, and the
signature is the body, so the authenticator of earlier releases
(`createStripeAuthenticator`) is deleted. `stripe` is an optional peer
dependency:

```js
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { createStripeHttpClient } from "@vaam-apps/vpay-sdk/stripe";

const stripe = new Stripe("unused-placeholder", {
  httpClient: createStripeHttpClient({
    baseUrl: "http://localhost:8080",
    clientId: "acme-cameroon",
    privateKey: readFileSync("./merchant.seed", "utf8"),
    serverKeys: { current: CURRENT_PUB, next: NEXT_PUB },
  }),
  host: "localhost",
  port: "8080",
  protocol: "http",
  maxNetworkRetries: 0,
  timeout: 30_000,
  telemetry: false,
});
```

`host`, `port` and `protocol` are not optional: the client refuses to seal a
request addressed anywhere but `baseUrl`, so a message signed for vpay is never
sent to `api.stripe.com`. The placeholder key is never sent. A refusal comes
back once, as a Stripe error that stripe-node will not retry.
`examples/merchant-stripe-node` runs this against the compose stack. What does
and does not port is on [Stripe compatibility](/sdks/stripe) and
[Stripe-shaped API](/api/stripe-compat).

## What its tests talk to

Be precise about this, because it is the difference between "the SDK encodes the
right bytes" and "the SDK works against vpay".

- **Almost every test in `sdks/nodejs` runs against a `node:http` server the
  test starts** — a real socket and real bytes on the wire, but a stub
  answering, not vpay. That covers every resource method's path and body,
  errors and webhooks. What a signature and an answer bind is checked by
  `sealer.test.ts` against a verifier built from cratestack's own server
  envelope, not from the SDK's sealing code; 218 cases in nine files in all.
- **Two live suites drive a real `vpay-server`**: `src/invoices.live.test.ts`
  and `src/refunds.live.test.ts`, run by `pnpm test:live` (a separate vitest
  project), brought up locally by `just sdk-live` and run by CI's `e2e` job
  against the compose stack. They fail rather than skip when no stack answers.
  The rails behind that stack are WireMock. The change that made the SDK seal
  did not run them where it was written; CI's `e2e` job is their evidence.
- **`sdks/stripe-compat`** drives the official `stripe` package through this
  SDK's `httpClient` against a live compose stack, in CI's `e2e` job.
- **`examples/merchant-node`** is written against a hypothetical
  `api.vpay.example`, and no gate runs it against a stack. Since v0.9.0 its
  rail, number, amount and order come from environment variables, so vpay's
  Notch Pay sandbox runbook can use it for test-mode payments through vpay.
- **Real sandbox evidence:** over seven MTN sandbox payments succeeded on
  2026-09-15. A documented sandbox run minted a payment with
  `examples/checkout-browser/mint.mjs` through this SDK
  ([live sandbox test](/operate/runbooks#live-sandbox-test)). On 2026-10-21
  Part B of the Notch Pay runbook ran `examples/merchant-node` three times
  against a local `vpay-server`, worker and Postgres whose `notchpay` adapter
  called Notch Pay's real sandbox
  ([Notch Pay sandbox runbook](/operate/runbooks#test-notch-pay-against-its-sandbox)):
  one payment succeeded, one failed, and one that Notch Pay read as complete for
  less than its amount stayed `pending`. Test keys, no production, no real
  payer on record, and no webhook from Notch Pay.

## Status in this release

| Part                                                                 | Status                   | Evidence                                                                                                           |
| -------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Sealing and opening, through `sdks/rust/wasm`                        | <Status s="built" />     | `client.test.ts` (121), `sealer.test.ts` (14), `stripe-http-client.test.ts` (19); the "Signing" rows of the matrix |
| A bearer-token mode                                                  | <Status s="not-built" /> | Deleted with the signed transport; VPA-6                                                                           |
| `/v1` resource methods                                               | <Status s="built" />     | Every method's wire shape pinned; byte-identical to the Rust SDK                                                   |
| Refunds and invoices against a running vpay                          | <Status s="partial" />   | Live suites green against WireMock rails; no refund ever settles                                                   |
| Checkout sessions, customers, account holders against a running vpay | <Status s="unproven" />  | Stub-only (dated ⛔ rows)                                                                                          |
| Stripe `httpClient`                                                  | <Status s="built" />     | Its own 19 cases; `sdks/stripe-compat` runs it in CI's `e2e` job, with no measured count recorded since the change |
| An empty or all-dots path `id` refused before any request (v0.9.1)   | <Status s="built" />     | Four ✅ rows in the matrix's "Request validation"                                                                  |
| Every local refusal is a `VpayInvalidParamsError` (v0.10.0)          | <Status s="built" />     | A ✅ row in "Request validation"; no longer a `TypeError`, so a breaking change                                    |
| `mtn_wallet` and `orange_wallet` on a create (v0.12.0)               | <Status s="built" />     | A ✅ row; the same body byte for byte as the Rust SDK's                                                            |
| `payment_method_details` on a `PaymentIntent` (v0.14.0)              | <Status s="built" />     | A ✅ row: decodes both shapes and a server that omits the key                                                      |
| Confirm by payment-method type, or pinned to a rail                  | <Status s="not-built" /> | A dated ⛔ row: `ConfirmPaymentIntentParams` names rail codes only                                                 |
| Retries, `request-id`, `stripe-should-retry`, `events.retrieve`      | <Status s="not-built" /> | Dated ⛔ rows in the parity matrix                                                                                 |

The full record is the Node column of
[docs/sdks/parity.md](vpay:docs/sdks/parity.md) and the package's own
[README](vpay:sdks/nodejs/README.md).

## Go deeper

- [sdks/nodejs/README.md](vpay:sdks/nodejs/README.md) — every option, method and
  error
- [examples/merchant-node/index.mjs](vpay:examples/merchant-node/index.mjs) and
  [examples/merchant-stripe-node](vpay:examples/merchant-stripe-node)
- [docs/sdks/parity.md](vpay:docs/sdks/parity.md) — the Node column, cell by
  cell
- [SDK overview](/sdks/) and [Rust SDK](/sdks/rust)
- Skills: [vpay-sdks](skill:vpay-sdks),
  [vpay-merchant-api](skill:vpay-merchant-api)
