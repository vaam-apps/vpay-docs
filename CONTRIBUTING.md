# Contributing to vpay-docs

## The rule

**Never make vpay look more finished than it is.** Every claim on a page must be
supported by vpay at the tag in `vpay.lock.json`. If vpay's own **Status**
section says something is only proven against WireMock, or never called, or
`NotImplemented`, the page says so too, in the same plain words. A designed but
unbuilt feature is never described in the present tense.

These pages summarise. vpay's `docs/` is the source of truth. Link to it with
`vpay:` links, and don't copy its dated history ("this said X until date Y")
here.

## A page

```markdown
---
title: Payment lifecycle
description: One sentence saying what the reader learns.
status: partial # built · partial · unproven · not-built
sources: # vpay paths this page summarises, at the locked tag
  - docs/flows/payment-lifecycle.md
skills: # vpay-skills skills on the same ground
  - vpay-payments
---
```

- `sources` is required. A page that genuinely has none says why, with
  `parity: { exempt: "<reason>" }`.
- `status` drives the chip at the top of the page. `skills` and `sources` drive
  the box at the bottom.
- New page? Add it to the sidebar in `.vitepress/config.ts`.

## Links

| Write                                  | Resolves to                                          |
| -------------------------------------- | ---------------------------------------------------- |
| `[flow](vpay:docs/flows/money.md)`     | vpay's file at the locked tag (checked by the gate)  |
| `[vpay-payments](skill:vpay-payments)` | the skill at the locked vpay-skills commit (checked) |
| `[Money](/payments/money)`             | a page here (checked by `vitepress build`)           |

Never hard-code `blob/v0.4.1/...`. It is wrong the day the lock moves.

## Diagrams and images

- **Mermaid** for anything that is a process, a state machine or a structure: a
  ` ```mermaid ` fence. It renders on the client and re-renders in dark mode.
  State and route names must be exactly vpay's. Something unbuilt is drawn as
  unbuilt: a dashed edge labelled so.
- **Illustrations** are hand-written SVGs in `docs/public/images/`, embedded as
  `![alt](/images/x.svg){.diagram}`. Each carries its own light background and a
  `<title>` and `<desc>`. After changing one, render it and look at it. "It
  parses" isn't "it's right".
- **No fabricated screenshots.** A picture of a UI must be a capture of vpay's
  real UI at the locked tag, and its caption says where it came from.

## Bumping the lock (a new vpay release)

The `release-parity` issue lists the work. Then:

1. `git -C ../vpay fetch --tags && git -C ../vpay checkout vX.Y.Z`
2. `node tools/verify-parity.mjs --release vX.Y.Z` prints the stale pages and
   any vpay page with no page here.
3. Re-read every stale page against vpay at the new tag. Fix what changed,
   including **Status** sections, and write pages for anything uncovered.
4. Update `vpay.lock.json`: `vpay.tag`, `vpay.ref`
   (`git -C ../vpay rev-parse vX.Y.Z^{commit}`), `vpay.tagDate`,
   `vpay.verifiedAt`. If vpay-skills moved, also `skills.ref` and
   `skills.verifiedAt`.
5. `pnpm verify && pnpm build`, then open the PR and link the parity issue.

A bump is a claim that someone read the pages. Don't bump it to turn a check
green.

## Before you open a PR

```bash
pnpm format
pnpm verify
pnpm build
```
