---
layout: home
title: vpay
titleTemplate: Human documentation
sources:
  - README.md
  - docs/status.md

hero:
  name: vpay
  text: A Stripe-shaped gateway for Cameroon mobile money
  tagline: One API for MTN MoMo, Orange Money and the Notch Pay aggregator, with
    PaymentIntents, idempotency and signed webhooks. These docs cover it as it really is, release by release.
  actions:
    - theme: brand
      text: What is vpay?
      link: /guide/what-is-vpay
    - theme: alt
      text: What works today
      link: /guide/status
    - theme: alt
      text: Agent skills
      link: /skills/

features:
  - icon: 💳
    title: Payments that survive a crash
    details:
      One charge per intent, forever. The rail's reference is written down
      before the payer can act, and only the rail's authenticated status query
      moves money.
    link: /payments/lifecycle
    linkText: Payment lifecycle
  - icon: 📱
    title: Three rails, two journeys
    details:
      MTN MoMo and the Notch Pay aggregator prompt the payer's handset. Orange
      Money redirects them to Orange's page. vpay branches on the adapter's
      capability, never on the rail's name.
    link: /rails/provider-port
    linkText: The provider port
  - icon: 🔌
    title: Integrate the Stripe way
    details:
      Stripe's object model, idempotency and webhook signatures. Authentication
      is OAuth2 private_key_jwt, and the official stripe package works through
      an authenticator.
    link: /api/
    linkText: Merchant API
  - icon: 🤖
    title: Briefings for agents
    details:
      Every page names the agent skills that cover the same ground, and the
      parity check fails when the two drift apart.
    link: /skills/
    linkText: Agent skills
---

::: warning vpay is in live testing, not generally available
vpay is no longer a scaffold. Its maintainers are testing it for live use on
some clusters (the owner's statement, 2026-10-21), ahead of general
availability. What the evidence at <Release /> shows is narrower: over seven
payments settled against **MTN's real sandbox** on 2026-09-15, using a test
number the sandbox settles by itself. No result from the cluster tests is
recorded yet, and everything this site marks unproven is still unproven: vpay's
own record still shows no real payer prompted, no call to Orange or Notch Pay,
and no refund settled. Check each feature's status before you rely on it.
[What works today →](/guide/status)
:::

## The shape of it

![vpay architecture: merchants, payers and staff reach one vpay-server binary through /v1, /v1/browser and /dash/v1. The worker polls the rails and delivers webhooks. Everything is stored in PostgreSQL. Rails sit behind the provider port.](/images/architecture.svg){.diagram}

## Where to start

| If you want to…                     | Read                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| decide whether vpay fits            | [What is vpay?](/guide/what-is-vpay), then [What works today](/guide/status)                              |
| run it on your machine              | [Run it locally](/guide/quickstart)                                                                       |
| integrate a merchant backend        | [Merchant API](/api/), [Authentication](/api/authentication), [SDKs](/sdks/)                              |
| take a payment from a payer         | [Hosted checkout](/checkout/hosted), [Browser checkout](/checkout/browser)                                |
| understand where money can go wrong | [Payment lifecycle](/payments/lifecycle), [Crash safety](/payments/crash-safety)                          |
| operate it                          | [Configuration](/operate/configuration), [Deployment](/operate/deployment), [Runbooks](/operate/runbooks) |
| point a coding agent at it          | [Agent skills](/skills/)                                                                                  |
