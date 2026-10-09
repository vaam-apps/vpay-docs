import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import Mermaid from "./components/Mermaid.vue";
import PageProvenance from "./components/PageProvenance.vue";
import PageStatus from "./components/PageStatus.vue";
import Status from "./components/Status.vue";
import SkillTable from "./components/SkillTable.vue";
import Release from "./components/Release.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-before": () => h(PageStatus),
      "doc-footer-before": () => h(PageProvenance),
    }),
  enhanceApp({ app }) {
    app.component("Mermaid", Mermaid);
    app.component("Status", Status);
    app.component("SkillTable", SkillTable);
    app.component("Release", Release);
  },
} satisfies Theme;
