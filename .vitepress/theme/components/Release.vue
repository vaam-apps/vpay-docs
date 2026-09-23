<script setup lang="ts">
// The vpay release these pages are verified against, from vpay.lock.json.
// Use it in prose that means "the release these docs describe", so a lock bump
// does not rewrite every page. A mention that is history ("landed after
// v0.4.1") stays a literal: it must not move when the lock does.
import { computed } from "vue";
import { useData } from "vitepress";

const { theme } = useData();
const tag = computed(() => theme.value.vpayLock.vpay.tag as string);
</script>

<template>
  <code class="vpay-release">{{ tag }}</code>
</template>
