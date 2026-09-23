#!/usr/bin/env node
// Writes docs/releases/index.md from vpay's CHANGELOG.md AT THE LOCKED TAG —
// read with `git show <tag>:CHANGELOG.md`, so it is the tag's changelog
// whatever the checkout happens to have checked out. The file is generated,
// gitignored and never hand-edited: release-please owns the words.
//
//   node tools/sync-release-notes.mjs [--vpay DIR] [--allow-missing]
//
// --allow-missing is for `pnpm dev` without a vpay checkout. It writes a page
// that SAYS the notes are missing; it never invents them. `pnpm build` does
// not pass it, so a production build without the changelog fails.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const i = argv.indexOf("--vpay");
const vpay = resolve(
  i >= 0 ? argv[i + 1] : (process.env.VPAY_REPO ?? join(ROOT, "..", "vpay")),
);
const allowMissing = argv.includes("--allow-missing");
const lock = JSON.parse(readFileSync(join(ROOT, "vpay.lock.json"), "utf8"));
const tag = lock.vpay.tag;
const out = join(ROOT, "docs", "releases", "index.md");

let changelog = null;
try {
  changelog = execFileSync("git", ["-C", vpay, "show", `${tag}:CHANGELOG.md`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch {
  // falls through to the error below
}

const front = (extra = "") =>
  `---\ntitle: Release notes\nsources:\n  - CHANGELOG.md\n${extra}---\n\n`;

mkdirSync(dirname(out), { recursive: true });

if (!changelog) {
  const why = existsSync(join(vpay, ".git"))
    ? `tag ${tag} is not in ${vpay} (run \`git -C ${vpay} fetch --tags\`)`
    : `${vpay} is not a vpay git checkout`;
  if (!allowMissing) {
    console.error(`sync-release-notes: ${why}. Pass --vpay DIR.`);
    process.exit(2);
  }
  writeFileSync(
    out,
    front() +
      `# Release notes\n\n::: warning Not generated in this build\n` +
      `The release notes are read from vpay's \`CHANGELOG.md\` at \`${tag}\`, and ${why}.\n:::\n`,
  );
  console.warn(
    `sync-release-notes: ${why}; wrote a placeholder (--allow-missing).`,
  );
  process.exit(0);
}

// ---- parse: one entry per `## [x.y.z](compare) (date)` heading --------------
const releases = [];
let cur = null;
for (const line of changelog.split("\n")) {
  const h = /^## \[(\d+\.\d+\.\d+)\]\([^)]*\) \((\d{4}-\d{2}-\d{2})\)/.exec(
    line,
  );
  if (h) {
    cur = { version: h[1], date: h[2], sections: {}, section: null };
    releases.push(cur);
    continue;
  }
  if (!cur) continue;
  const s = /^### (.+)$/.exec(line);
  if (s) cur.section = s[1].trim();
  else if (/^\* /.test(line) && cur.section) {
    cur.sections[cur.section] = (cur.sections[cur.section] ?? 0) + 1;
  }
}
const total = (r) => Object.values(r.sections).reduce((a, b) => a + b, 0);
const chrono = [...releases].reverse();
const sectionNames = [
  ...new Set(releases.flatMap((r) => Object.keys(r.sections))),
];

const body = changelog.replace(/^# Changelog\s*/, "");
const quote = (s) => `"${s}"`;

const page =
  front() +
  `# Release notes

Every vpay release up to **${tag}**, the one these pages are verified against.
The text below is vpay's own \`CHANGELOG.md\` at that tag, written by
release-please from commit subjects. It is copied here at build time and
never edited.

::: tip These docs move with the releases
When vpay tags a release newer than ${tag}, the parity check opens a draft
pull request listing every page whose sources changed. See
[how these docs stay current](/about/parity).
:::

## At a glance

\`\`\`mermaid
timeline
  title vpay releases
${[...Map.groupBy(chrono, (r) => r.date)].map(([d, rs]) => `  ${d} : ${rs.map((r) => `v${r.version}`).join(" : ")}`).join("\n")}
\`\`\`

Changelog entries per release — a measure of how much each one carried, not of
how much it matters:

\`\`\`mermaid
xychart-beta
  title "Changelog entries per release"
  x-axis [${chrono.map((r) => quote(`v${r.version}`)).join(", ")}]
  y-axis "entries"
  bar [${chrono.map(total).join(", ")}]
\`\`\`

| Release | Date | ${sectionNames.join(" | ")} |
| --- | --- | ${sectionNames.map(() => "---:").join(" | ")} |
${releases
  .map(
    (r) =>
      `| v${r.version} | ${r.date} | ${sectionNames.map((s) => r.sections[s] ?? "").join(" | ")} |`,
  )
  .join("\n")}

## The changelog

::: v-pre
${body.replace(/^## /gm, "### ").replace(/^### (?!\[)/gm, "#### ")}
:::
`;

writeFileSync(out, page);
console.log(
  `sync-release-notes: ${releases.length} releases up to ${tag} -> docs/releases/index.md`,
);
