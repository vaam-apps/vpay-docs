---
title: Invoices
description:
  vpay's invoice — a merchant's bill to one customer — its lines, its five-state
  machine, gap-free numbering, and what pay does on a market with no stored
  payment methods.
status: built
sources:
  - docs/flows/invoices.md
  - docs/adr/0024-customer-filters-and-manual-payments.md
  - docs/api/README.md
skills:
  - vpay-invoices
  - vpay-customers
---

# Invoices

An invoice (`in_…`) is a merchant's bill to one customer. It is Stripe's
`invoice` narrowed to what a Cameroon merchant needs to bill a phone: lines, a
number, a state machine, a way to get paid through the checkout page vpay
already has, and a way to record a payment the merchant received outside vpay. There is **no PDF, no e-mail, no tax, no credit note, no dunning
and no subscription** — see [What is not built](#what-is-not-built).

Agents working on invoices should load [vpay-invoices](skill:vpay-invoices).

## Two objects

**The invoice** has twenty-one keys:

| Field                                             | Meaning                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`, `object`                                    | `in_…`, `"invoice"`                                                                          |
| `customer`                                        | the `cus_…` this bills — **required**, never `null`                                          |
| `currency`                                        | lower-case; every line is in it                                                              |
| `status`                                          | `draft`, `open`, `paid`, `void` or `uncollectible`                                           |
| `number`                                          | `{prefix}-{000001}`, assigned at finalize, `null` while a draft                              |
| `amount_due` / `amount_paid` / `amount_remaining` | integer minor units                                                                          |
| `amount_refunded`                                 | how much of `amount_paid` has been given back, gross                                         |
| `paid_out_of_band`                                | Stripe's key: `true` when the merchant recorded payment outside vpay                         |
| `out_of_band_payment`                             | `null`, or `{id, method, reference, received_at}`; see [Paid out of band](#paid-out-of-band) |
| `due_date`                                        | unix seconds, **advisory** — nothing in vpay reads it                                        |
| `description`, `metadata`                         | the merchant's own                                                                           |
| `payment_intent`                                  | the `pi_…` paying it, or `null`                                                              |
| `hosted_invoice_url`                              | a checkout session for that intent, or `null` — not an invoice page                          |
| `lines`                                           | every line, always expanded, `has_more` always `false`                                       |
| `status_transitions`                              | `finalized_at`, `paid_at`, `voided_at`, `marked_uncollectible_at`                            |
| `created`, `livemode`                             | as everywhere else                                                                           |

`customer` is required because an invoice is a bill to _somebody_ — it carries a
number people quote and may be chased for months, and `pay` needs a payer to
bind an intent to.

**A line** (`ii_…`) is `id`, `description`, `quantity`, `unit_amount`, `amount`,
`currency`, `livemode` — nothing else. `amount` is never a parameter: it is
`quantity * unit_amount`, and the database checks it.

The route is `/v1/invoice_items` and the object is `line_item`, on purpose.
Stripe has two objects (a pending `invoiceitem` and an attached `line_item`);
vpay writes lines straight onto a named draft, so it keeps Stripe's route
spelling for existing clients and Stripe's `lines` spelling for handlers that
switch on it.

## The state machine

```mermaid
stateDiagram-v2
  [*] --> draft: POST /v1/invoices
  draft --> [*]: DELETE, lines and all
  draft --> open: finalize
  open --> paid: settlement of the intent pay minted
  open --> paid: pay with paid_out_of_band=true
  open --> void: void
  open --> uncollectible: mark_uncollectible
  paid --> [*]
  void --> [*]
  uncollectible --> [*]
```

`paid`, `void` and `uncollectible` are terminal: nothing in vpay moves an
invoice out of them. `open → paid` has two writers: the settlement of a
succeeded intent, and an [out-of-band payment](#paid-out-of-band). Both are
compare-and-swaps on `open` with no live intent attached, so the two cannot both
win. **Finalize** takes the next number under a row lock,
freezes the lines and sums `amount_due` once; a draft with no lines is a `400`.
Only a draft can be edited, have lines added, or be deleted — an issued invoice
is **voided**, never deleted, and keeps its number.

Three things enforce this, and none is a validation function: a CHECK closing
the five labels; every transition written as a compare-and-swap on the current
status, where "matched no row" _is_ the refusal; and five multi-column CHECKs
(`number_is_assigned_at_finalize`, `paid_means_nothing_remaining`,
`only_a_live_invoice_has_an_intent`, `amounts_add_up`, `amount_is_the_product`)
that make the combinations a broken transition would produce unstorable.

### Numbers without holes

A number is `{prefix}-{000001}`: an eight-character random prefix per merchant
from Crockford's upper-case alphabet (no `I`, `L`, `O` or `U` to misread off a
receipt), then that merchant's own 1-based sequence. The sequence is an ordinary
table row, not a Postgres `SEQUENCE`, so a finalize that rolls back burns no
number — because a tax authority reads a missing invoice number as a destroyed
document. Two concurrent finalizes take consecutive numbers.

## Paying, on a market with no stored payment methods

Stripe's `pay` charges a card already on file. On mobile money there is nothing
on file — a payment is a payer approving a prompt on their own handset — so
vpay's `POST /v1/invoices/{id}/pay` does something different:

```mermaid
sequenceDiagram
  autonumber
  participant M as Merchant backend
  participant V as vpay /v1
  participant P as Payer
  participant C as Hosted checkout
  M->>V: POST /v1/invoices/in_x/pay (success_url, cancel_url)
  V->>V: mint a pi_ for amount_remaining
  V->>V: create a hosted checkout session for it
  V->>V: attach the intent to the invoice (compare-and-swap)
  V-->>M: 200 invoice with payment_intent and hosted_invoice_url
  M->>P: send hosted_invoice_url
  P->>C: open it, pay on a rail
  Note over V: when the intent succeeds, the settlement transaction marks the invoice paid and emits invoice.paid
```

- **It needs `success_url` and `cancel_url`**, because a hosted session does.
  They can be sent on the request or configured once per merchant; a request's
  own values always win, and with neither there is one `400` naming both. vpay
  never invents a return page.

  ```yaml
  merchant_clients:
    - client_id: acme-cameroon
      merchant_id: acme-cameroon-tenant
      invoices:
        success_url: https://shop.acme.example/invoice-paid
        cancel_url: https://shop.acme.example/invoice-cancelled
  ```

- **No invoice page.** The payer sees the existing checkout page — merchant name
  and amount. The invoice number is in the intent's `description` but **the page
  does not show it**, which is a recorded gap.
- **Paid in the settlement transaction**, not afterwards, so there is no window
  where the intent is `succeeded` and the invoice still says money is owed.
- **A failed intent leaves the invoice `open`** and emits nothing about the
  invoice; the merchant hears `payment_intent.payment_failed`.
- **One payment at a time.** While an attached intent is not `canceled`, `pay`,
  `void` and `mark_uncollectible` are `409`. Cancel the intent to get them back.
  Partial payments are out of scope, enforced by the database.

Paying an invoice is exactly as proven as the rails are: apart from the MTN
sandbox testing, where over seven payments succeeded, and three payments through
Notch Pay's sandbox, every rail call vpay has made went to a WireMock stub.

## Paid out of band

Since vpay 0.6.0 a merchant can record that an **open** invoice was settled
outside vpay, in cash, by cheque, by a bank transfer received directly, or
otherwise ([ADR-0024](vpay:docs/adr/0024-customer-filters-and-manual-payments.md)).
It is Stripe's spelling, on the same route:

```text
POST /v1/invoices/{id}/pay
paid_out_of_band=true
out_of_band[method]=cash|cheque|bank_transfer|other   optional, default other
out_of_band[reference]=…                               optional, at most 500 characters
out_of_band[received_at]=<unix seconds>                optional, default now
```

- **`paid_out_of_band=true` alone is enough**, so a client written against
  Stripe reaches the same state; the method is then `other`.
- The invoice moves `open → paid` with nothing remaining, one `manual_payments`
  record (`mp_…`) is written, `invoice.paid` is emitted in the same transaction,
  and the answer carries `out_of_band_payment`.
- **It needs no URLs and accepts none.** Configured `merchant_clients[].invoices`
  URLs are never consulted on this path, and `success_url` or `cancel_url` sent
  with the flag is a `400`.
- `received_at` may be up to 30 seconds in the future, for clock skew, and no
  earlier than the second the invoice was finalized.
- A live attached intent refuses it with the same `409` as `void`; cancel the
  intent first. A canceled intent stays attached.
- Every refusal is a `400` naming its parameter, including an unknown
  `out_of_band[…]` key, which is named as `out_of_band` and never echoed.

**It is the merchant's statement and nothing more.** No money crossed a rail vpay
talks to, nothing in vpay verifies it, and nothing is posted to the
[ledger](/payments/ledger). A `reference` routinely names the payer, so a
customer's erasure redacts it in every stored copy, and once a customer is
erased a new reference on their invoice is refused. There is no way to undo an
out-of-band payment, and no operator or dashboard can record one: only the
merchant's `/v1` surface writes it.

## Refunds against a paid invoice

Decided, and not reachable. A refund leaves the invoice `paid` and adds to
`amount_refunded` (gross, beside the arithmetic, never more than `amount_paid`),
in the refund's own settlement transaction, with no second `invoice.paid`. But
nothing in vpay settles a `pending` refund and no rail has ever returned money,
so **`amount_refunded` is `0` on every invoice in every deployment**.

## Events

| Type                | Written by                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `invoice.created`   | `POST /v1/invoices`                                               |
| `invoice.finalized` | `POST /v1/invoices/{id}/finalize`                                 |
| `invoice.paid`      | the settlement transaction, or `pay` with `paid_out_of_band=true` |
| `invoice.voided`    | `POST /v1/invoices/{id}/void`                                     |

A refused transition writes none. Webhook bodies carry `lines.data` **empty**
(rendering lines inside the transaction would mean a second query while holding
the number lock); read `GET /v1/invoices/{id}` for them. The two writers of
`invoice.paid` are told apart by the body: `paid_out_of_band` and
`out_of_band_payment` are filled in on the out-of-band one. There is no
`invoice.marked_uncollectible` and no `invoice.payment_failed` — find write-offs
with `GET /v1/invoices?status=uncollectible`.

## The surface

| Route                                  | Methods                          | Notes                                                                                    |
| -------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `/v1/invoices`                         | `POST`, `GET`                    | list takes `customer`, `status` and the standard cursor                                  |
| `/v1/invoices/{id}`                    | `GET`, `POST`, `PATCH`, `DELETE` | `POST`/`PATCH` are one handler; writes are draft-only                                    |
| `/v1/invoices/{id}/finalize`           | `POST`                           |                                                                                          |
| `/v1/invoices/{id}/void`               | `POST`                           |                                                                                          |
| `/v1/invoices/{id}/mark_uncollectible` | `POST`                           | emits no event                                                                           |
| `/v1/invoices/{id}/pay`                | `POST`                           | `success_url`, `cancel_url` — sent or configured; or `paid_out_of_band=true` with no URL |
| `/v1/invoice_items`                    | `POST`                           | no collection `GET`                                                                      |
| `/v1/invoice_items/{id}`               | `GET`, `POST`, `PATCH`, `DELETE` | writes need a draft parent                                                               |

Another merchant's `in_…` is the same `404` as one that never existed on every
route, the transitions included, so a `409` naming a status cannot leak
existence.

## What is not built

- No PDF, no e-mail, no hosted invoice page — `hosted_invoice_url` is a checkout
  session.
- No taxes, discounts or credit notes; no subscriptions or recurring invoices.
- No dunning, reminders or automatic `uncollectible` — `due_date` is read by
  nothing.
- No partial payments; no invoice screen in the dashboard.
- No operator path to record an out-of-band payment, no verification of one, no
  automatic matching of a bank transfer to an invoice, and no undo.
- No invoice cases in the `stripe` compatibility suite, and no browser test from
  an invoice to a paid charge.
- Amounts above `2^53 - 1` minor units cannot be finalized.

## Status in this release

| Part                                     | Status                   | Evidence                                                                                 |
| ---------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| Routes, state machine, numbering         | <Status s="built" />     | Cases in `invoices.rs` against a real Postgres and the shipping router                   |
| Paid out of band                         | <Status s="built" />     | Thirteen more cases in `invoices.rs`, the erasure races included; both SDKs' live suites |
| Paid inside the settlement transaction   | <Status s="built" />     | `apply_succeeded_pays_the_invoice_the_intent_was_for` and its aborted twin               |
| Both merchant SDKs                       | <Status s="built" />     | stub-backed wire tests plus a live suite each, run in CI's `e2e` job                     |
| Paying through a real rail               | <Status s="unproven" />  | the rails behind `pay` are WireMock stubs                                                |
| Refund accounting (`amount_refunded`)    | <Status s="unproven" />  | written and tested at the database; no shipping path reaches it                          |
| PDF, e-mail, tax, dunning, subscriptions | <Status s="not-built" /> | out of scope, listed above                                                               |

The full record is
[docs/flows/invoices.md § Status](vpay:docs/flows/invoices.md#status).

## Go deeper

- [Invoices — object model, state machine, paying, refunds](vpay:docs/flows/invoices.md)
- [The invoice object in the API reference](vpay:docs/api/README.md)
- Related: [Customers](/api/customers), [Hosted checkout](/checkout/hosted)
- Skill: [vpay-invoices](skill:vpay-invoices)
