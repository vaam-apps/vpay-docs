import { readFileSync } from "node:fs";
import { defineConfig } from "vitepress";
import { vpayMarkdown, type Lock } from "./markdown";

const lock: Lock = JSON.parse(
  readFileSync(new URL("../vpay.lock.json", import.meta.url), "utf8"),
);

// The site is served at the root of its custom domain, vpay-oss.vaam.store,
// set in the repository's Pages settings. A workflow-deployed Pages site needs
// no CNAME file; GitHub ignores one. Set DOCS_BASE=/vpay-docs/ to preview the
// github.io project path instead.
const hostname = "https://vpay-oss.vaam.store";
const base = process.env.DOCS_BASE ?? "/";

export default defineConfig({
  srcDir: "docs",
  base,
  lang: "en",
  title: "vpay",
  description:
    "Human documentation for vpay, a payment orchestrator for Cameroon mobile money rails.",
  cleanUrls: true,
  sitemap: { hostname },
  // The build fails on a link to a page that does not exist. Links into vpay
  // itself are checked by tools/verify-parity.mjs instead, against the tag.
  ignoreDeadLinks: false,
  head: [
    [
      "link",
      { rel: "icon", type: "image/svg+xml", href: `${base}images/logo.svg` },
    ],
  ],

  markdown: {
    config: vpayMarkdown(lock),
  },

  // mermaid is the only large dependency, and Mermaid.vue imports it
  // dynamically, so its chunks load only on a page that draws a diagram.
  vite: { build: { chunkSizeWarningLimit: 2500 } },

  themeConfig: {
    logo: "/images/logo.svg",
    // Exposed to the theme so every page can say what it was verified against.
    // @ts-expect-error — custom key, read by PageProvenance.vue
    vpayLock: lock,
    nav: [
      { text: "Guide", link: "/guide/what-is-vpay", activeMatch: "/guide/" },
      {
        text: "Payments",
        link: "/payments/lifecycle",
        activeMatch: "/payments/",
      },
      {
        text: "Integrate",
        link: "/api/",
        activeMatch: "/(api|checkout|sdks)/",
      },
      {
        text: "Operate",
        link: "/operate/configuration",
        activeMatch: "/operate/",
      },
      { text: "Agent skills", link: "/skills/", activeMatch: "/skills/" },
      {
        text: lock.vpay.tag,
        items: [
          { text: "Release notes", link: "/releases/" },
          { text: "How these docs stay current", link: "/about/parity" },
          {
            text: `vpay ${lock.vpay.tag} on GitHub`,
            link: `https://github.com/${lock.vpay.repository}/tree/${lock.vpay.tag}`,
          },
        ],
      },
    ],

    sidebar: {
      "/": [
        {
          text: "Guide",
          items: [
            { text: "What is vpay?", link: "/guide/what-is-vpay" },
            { text: "What works today", link: "/guide/status" },
            { text: "Core concepts", link: "/guide/concepts" },
            { text: "Run it locally", link: "/guide/quickstart" },
            { text: "Architecture decisions", link: "/guide/decisions" },
          ],
        },
        {
          text: "Payments",
          items: [
            { text: "Payment lifecycle", link: "/payments/lifecycle" },
            { text: "Money", link: "/payments/money" },
            { text: "Crash safety", link: "/payments/crash-safety" },
            { text: "The reconciler", link: "/payments/reconciler" },
            { text: "The ledger", link: "/payments/ledger" },
            { text: "Failures", link: "/payments/failures" },
            { text: "Errors", link: "/payments/errors" },
          ],
        },
        {
          text: "Rails",
          items: [
            { text: "The provider port", link: "/rails/provider-port" },
            { text: "MTN MoMo", link: "/rails/mtn-momo" },
            { text: "Orange Money", link: "/rails/orange-money" },
            {
              text: "Account-holder lookup",
              link: "/rails/account-holder-lookup",
            },
          ],
        },
        {
          text: "Merchant API",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "Authentication", link: "/api/authentication" },
            { text: "Webhooks", link: "/api/webhooks" },
            { text: "Customers", link: "/api/customers" },
            { text: "Invoices", link: "/api/invoices" },
            { text: "Stripe compatibility", link: "/api/stripe-compat" },
          ],
        },
        {
          text: "Checkout",
          items: [
            { text: "Hosted checkout", link: "/checkout/hosted" },
            { text: "Browser checkout", link: "/checkout/browser" },
            { text: "Mobile checkout", link: "/checkout/mobile" },
          ],
        },
        {
          text: "SDKs",
          items: [
            { text: "Overview and parity", link: "/sdks/" },
            { text: "Node.js", link: "/sdks/nodejs" },
            { text: "Rust", link: "/sdks/rust" },
            { text: "Flutter", link: "/sdks/flutter" },
            { text: "Stripe-compatible SDKs", link: "/sdks/stripe" },
          ],
        },
        {
          text: "Dashboard",
          items: [
            { text: "The merchant dashboard", link: "/dashboard/" },
            { text: "Staff sign-in", link: "/dashboard/authentication" },
          ],
        },
        {
          text: "Operate",
          items: [
            { text: "Configuration", link: "/operate/configuration" },
            { text: "Deployment", link: "/operate/deployment" },
            { text: "Runbooks", link: "/operate/runbooks" },
          ],
        },
        {
          text: "For agents",
          items: [{ text: "Agent skills", link: "/skills/" }],
        },
        {
          text: "About these docs",
          items: [
            { text: "How they stay current", link: "/about/parity" },
            { text: "Release notes", link: "/releases/" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: `https://github.com/${lock.vpay.repository}` },
    ],
    editLink: {
      pattern: "https://github.com/vaam-apps/vpay-docs/edit/main/docs/:path",
      text: "Edit this page",
    },
    search: { provider: "local" },
    outline: [2, 3],
    footer: {
      message: `Verified against vpay ${lock.vpay.tag} (${lock.vpay.tagDate}). vpay is a scaffold — do not deploy it.`,
      copyright: "vaam-apps",
    },
  },
});
