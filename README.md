# vpay-docs

Human documentation for [vpay](https://github.com/vaam-apps/vpay), a
Stripe-shaped payment gateway for Cameroon mobile money rails. Built with
[VitePress](https://vitepress.dev) and published to GitHub Pages at
**[vpay-oss.vaam.store](https://vpay-oss.vaam.store)**.

> **vpay is a scaffold. It cannot take a payment. Do not deploy it.** These
> pages say so on every page that matters, because it is the most important
> thing a reader has to know, and the easiest thing for docs to quietly
> contradict.

## Three tiers, one rule

| Tier                                                               | For                                       | Pinned to                        |
| ------------------------------------------------------------------ | ----------------------------------------- | -------------------------------- |
| [vpay `docs/`](https://github.com/vaam-apps/vpay/tree/master/docs) | contributors: the exhaustive record       | the commit it lives in           |
| **vpay-docs** (this repository)                                    | people evaluating, integrating, operating | a vpay **release tag**           |
| [vpay-skills](https://github.com/vaam-apps/vpay-skills)            | coding agents already at work             | a vpay commit, stamped per skill |

vpay's rule is that a feature lands in three places or it hasn't landed. This
repository is the human tier, and it holds itself to vpay's standard: **a page
that lags is worse than none, because people trust it.**

## What keeps it true

[`vpay.lock.json`](vpay.lock.json) names the vpay release every page was
verified against, and the vpay-skills commit the skill references resolve to.
[`tools/verify-parity.mjs`](tools/verify-parity.mjs) fails in both directions:

- **vpay → docs**: a vpay flow doc, runbook, ADR or SDK package with no page
  here listing it in `sources:`
- **docs → vpay**: a `sources:` path or `vpay:` link that doesn't exist at the
  locked tag
- **docs ↔ skills**: a skill a page names that doesn't exist, or a skill that no
  page references
- **release**: with `--release vX.Y.Z`, every page whose vpay sources changed
  since the locked tag

Two workflows run it:

- [`verify.yml`](.github/workflows/verify.yml) runs on every PR and push. It
  does the parity check, prettier and a production build against exactly what
  the lock names. On `main` it deploys to Pages.
- [`release-parity.yml`](.github/workflows/release-parity.yml) runs every 3
  hours, and on demand. When vpay's latest release is newer than the lock, it
  goes red and opens one issue for that release listing the stale pages. **It
  never blocks vpay's release and never bumps the lock by itself.** A person
  re-reads the pages and bumps it.

The [How these docs stay current](docs/about/parity.md) page explains the same
loop for readers, with a diagram.

## Work on it

```bash
git clone https://github.com/vaam-apps/vpay-docs && cd vpay-docs
git clone https://github.com/vaam-apps/vpay ../vpay
git -C ../vpay checkout "$(node -p 'require("./vpay.lock.json").vpay.tag')"
git clone https://github.com/vaam-apps/vpay-skills ../vpay-skills
pnpm install
pnpm dev          # http://localhost:5173/
pnpm verify       # the parity gate
pnpm build        # what CI builds; needs ../vpay for the release notes
```

`VPAY_REPO` and `VPAY_SKILLS_REPO` override the `../vpay` and `../vpay-skills`
defaults. [CONTRIBUTING.md](CONTRIBUTING.md) covers page frontmatter, links,
diagrams and bumping the lock.

## Licence

Apache-2.0, the same as vpay. See [LICENSE](LICENSE).
