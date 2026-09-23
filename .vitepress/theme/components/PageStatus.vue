<script setup lang="ts">
// The strip at the top of a doc page: its status, and the vpay release the
// page was checked against. Status comes from frontmatter so the parity gate
// can read it too.
import { computed } from "vue";
import { useData } from "vitepress";
import Status from "./Status.vue";

const { frontmatter, theme } = useData();
const lock = computed(() => theme.value.vpayLock);
const status = computed(() => frontmatter.value.status as string | undefined);
</script>

<template>
  <div v-if="status" class="vpay-page-status">
    <Status :s="status as any" />
    <span class="vpay-page-status__ref"
      >as of vpay <code>{{ lock.vpay.tag }}</code></span
    >
  </div>
</template>
