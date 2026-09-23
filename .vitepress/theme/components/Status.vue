<script setup lang="ts">
// The vocabulary is vpay's own (docs/status.md): a feature is proven, partly
// built, or not built. "unproven" is the fourth case the status pages keep
// having to spell out — the code exists and has never met the real system.
import { computed } from "vue";

const props = defineProps<{
  s: "built" | "partial" | "unproven" | "not-built";
}>();
const LABELS = {
  built: "Built and tested",
  partial: "Partly built",
  unproven: "Written, never run against the real rail",
  "not-built": "Not built",
} as const;
const label = computed(() => LABELS[props.s] ?? props.s);
</script>

<template>
  <span class="vpay-status" :class="`vpay-status--${s}`"
    ><slot>{{ label }}</slot></span
  >
</template>
