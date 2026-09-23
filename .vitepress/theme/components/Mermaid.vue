<script setup lang="ts">
// Renders one ```mermaid fence. Client-only: mermaid needs a DOM, and the SSR
// pass emits the source in a <pre> so the page is readable without JS and
// search indexes the diagram's words.
import { onMounted, ref, watch } from "vue";
import { useData } from "vitepress";

const props = defineProps<{ code: string }>();
const source = decodeURIComponent(props.code);
const svg = ref("");
const failed = ref("");
const { isDark } = useData();
let seq = 0;

async function render() {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: isDark.value ? "dark" : "neutral",
    fontFamily: "var(--vp-font-family-base)",
    themeVariables: { fontSize: "15px" },
  });
  const id = `mmd-${Math.random().toString(36).slice(2)}-${seq++}`;
  try {
    svg.value = (await mermaid.render(id, source)).svg;
    failed.value = "";
  } catch (e) {
    // Visible, never swallowed: a diagram that silently vanishes is a page
    // that silently lies about what it shows.
    failed.value = String(e);
    document.getElementById(`d${id}`)?.remove();
  }
}

onMounted(render);
watch(isDark, render);
</script>

<template>
  <figure class="mermaid-figure">
    <div v-if="svg" class="mermaid-svg" v-html="svg" />
    <pre v-else class="mermaid-source"><code>{{ source }}</code></pre>
    <p v-if="failed" class="mermaid-error">
      Diagram failed to render: {{ failed }}
    </p>
  </figure>
</template>
