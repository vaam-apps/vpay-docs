<script setup lang="ts">
// The generated half of the Agent skills page: one row per skill, read at
// build time from vpay-skills at the locked ref (docs/skills/skills.data.ts).
import { computed } from "vue";
import { data } from "../../../docs/skills/skills.data";

const repo = "vaam-apps/vpay-skills";
const rows = computed(() => data.skills);
const RELATION = {
  same: { text: "same as", cls: "built" },
  older: { text: "older than", cls: "partial" },
  newer: { text: "newer than", cls: "unproven" },
  unknown: { text: "unplaced vs", cls: "not-built" },
} as const;
const short = (s: string, n = 180) =>
  s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")} …` : s;
</script>

<template>
  <div v-if="data.error" class="warning custom-block">
    <p class="custom-block-title">Skill list not generated in this build</p>
    <p>{{ data.error }}</p>
  </div>
  <table v-else class="vpay-skill-table">
    <thead>
      <tr>
        <th>Skill</th>
        <th>What it briefs an agent on</th>
        <th>Verified against</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="s in rows" :key="s.name">
        <td>
          <a
            :href="`https://github.com/${repo}/tree/${data.ref}/skills/${s.name}`"
            target="_blank"
            rel="noreferrer"
            ><code>{{ s.name }}</code></a
          >
        </td>
        <td>{{ short(s.description) }}</td>
        <td>
          <template v-if="s.stamp">
            <code>{{ s.stamp.slice(0, 8) }}</code> ({{ s.stampDate }})<br />
            <span
              class="vpay-status"
              :class="`vpay-status--${RELATION[s.relation].cls}`"
              >{{ RELATION[s.relation].text }} {{ data.vpayTag }}</span
            >
          </template>
          <span v-else class="vpay-status vpay-status--not-built"
            >no stamp</span
          >
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.vpay-skill-table td:first-child {
  white-space: nowrap;
}
.vpay-skill-table td:last-child {
  white-space: nowrap;
  font-size: 0.85rem;
}
.vpay-skill-table td {
  vertical-align: top;
}
</style>
