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
  tagline:
    One API for MTN MoMo and Orange Money, with PaymentIntents, idempotency and
    signed webhooks. These docs cover it as it really is, release by release.
  image:
    src: /images/logo.svg
    alt: vpay
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
    title: Two rails, two journeys
    details:
      MTN MoMo prompts the payer's handset. Orange Money redirects them to
      Orange's page. vpay branches on the adapter's capability, never on the
      rail's name.
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

::: danger vpay is a scaffold. Do not deploy it.
It compiles, lints clean and its tests pass, but **it cannot take a payment**.
One real-rail call has ever happened: a single charge settled against **MTN's
sandbox** on 2026-09-15, using a test number the sandbox settles by itself. No
real payer has been prompted, no money has moved, Orange has never been called,
no refund has ever settled, and no cluster has ever run vpay. [What works today
→](/guide/status)
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
