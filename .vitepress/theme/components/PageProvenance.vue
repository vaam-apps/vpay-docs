<script setup lang="ts">
// Where a page came from, printed on the page. `sources` are paths in vpay at
// the locked tag; `skills` are the agent skills that brief an agent on the
// same ground. Both lists are the ones tools/verify-parity.mjs checks.
import { computed } from "vue";
import { useData } from "vitepress";

const { frontmatter, theme } = useData();
const lock = computed(() => theme.value.vpayLock);
const sources = computed<string[]>(() => frontmatter.value.sources ?? []);
const skills = computed<string[]>(() => frontmatter.value.skills ?? []);
const src = (p: string) =>
  `https://github.com/${lock.value.vpay.repository}/blob/${lock.value.vpay.tag}/${p}`;
const skill = (n: string) =>
  `https://github.com/${lock.value.skills.repository}/tree/${lock.value.skills.ref}/skills/${n}`;
</script>

<template>
  <aside v-if="sources.length || skills.length" class="vpay-provenance">
    <div v-if="sources.length">
      <p class="vpay-provenance__title">
        Source of truth in vpay <code>{{ lock.vpay.tag }}</code>
      </p>
      <ul>
        <li v-for="p in sources" :key="p">
          <a :href="src(p)" target="_blank" rel="noreferrer"
            ><code>{{ p }}</code></a
          >
        </li>
      </ul>
    </div>
    <div v-if="skills.length">
      <p class="vpay-provenance__title">Agent skills for this topic</p>
      <ul>
        <li v-for="n in skills" :key="n">
          <a :href="skill(n)" target="_blank" rel="noreferrer"
            ><code>{{ n }}</code></a
          >
        </li>
      </ul>
      <p class="vpay-provenance__hint">
        <code
          >npx skills add https://github.com/{{
            lock.skills.repository
          }}
          --skill {{ skills[0] }}</code
        >
      </p>
    </div>
  </aside>
</template>
