// The vaam-apps house theme (Material 3), extended with vpay's own pieces:
// the status strip above every page, the provenance box below it, the
// components pages use from Markdown, and the home page's hero illustration.
import Md3Theme from "@vaam-apps/vitepress-md3";
import type { Theme } from "vitepress";
import { h } from "vue";
import Mermaid from "./components/Mermaid.vue";
import PageProvenance from "./components/PageProvenance.vue";
import PageStatus from "./components/PageStatus.vue";
import Status from "./components/Status.vue";
import SkillTable from "./components/SkillTable.vue";
import Release from "./components/Release.vue";
import VpayHeroArt from "./components/VpayHeroArt.vue";
import "./custom.css";

export default {
  extends: Md3Theme,
  // Md3Theme.Layout wraps the default layout and passes these slots through.
  Layout: () =>
    h(Md3Theme.Layout!, null, {
      "doc-before": () => h(PageStatus),
      "doc-footer-before": () => h(PageProvenance),
      // Replaces the theme's default hero art (the hero image on Expressive
      // shapes) with vpay's own, drawn inline so it follows light and dark.
      "home-hero-image": () => h(VpayHeroArt),
    }),
  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid);
    app.component("Status", Status);
    app.component("SkillTable", SkillTable);
    app.component("Release", Release);
  },
} satisfies Theme;
