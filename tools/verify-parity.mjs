#!/usr/bin/env node
// verify-parity — the gate that keeps these pages true of a vpay release.
//
// It fails in BOTH directions, the way vpay's `verify-status` and
// vpay-skills' `verify-coverage` do, because a one-directional map rots in the
// direction nobody looks:
//
//   vpay -> docs    a vpay page a human needs (every docs/flows/*.md, every
//                   runbook, every ADR, every SDK directory) that no page here
//                   names in its `sources:` frontmatter.
//
//   docs -> vpay    a `sources:` path, or a `vpay:` link, that does not exist
//                   in the vpay checkout.
//
//   docs <-> skills a `skills:` entry or `skill:` link naming a skill that
//                   vpay-skills does not have — and a skill vpay-skills has
//                   that no page here references.
//
// And one check that only `--release` turns on:
//
//   release         vpay.lock.json names the tag these pages were verified
//                   against. Run against a NEWER release, the gate fails and
//                   lists every page whose sources changed between the two
//                   tags: that list is the work the release created.
//
// Usage:
//   node tools/verify-parity.mjs [--vpay DIR] [--skills DIR]
//                                [--release [TAG]] [--report FILE]
//   VPAY_REPO / VPAY_SKILLS_REPO default to ../vpay and ../vpay-skills.
//
// Exit 0 = parity. 1 = gaps, each named with the file that closes it.
// 2 = a checkout is missing or is not what it claims to be.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const STATUSES = new Set(["built", "partial", "unproven", "not-built"]);

// ---- arguments --------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
};
const vpay = resolve(
  opt("--vpay") ?? process.env.VPAY_REPO ?? join(ROOT, "..", "vpay"),
);
const skillsRepo = resolve(
  opt("--skills") ??
    process.env.VPAY_SKILLS_REPO ??
    join(ROOT, "..", "vpay-skills"),
);
const releaseOpt = opt("--release");
const reportFile = opt("--report");

const lock = JSON.parse(readFileSync(join(ROOT, "vpay.lock.json"), "utf8"));

function die(msg) {
  console.error(`verify-parity: ${msg}`);
  process.exit(2);
}
if (!existsSync(join(vpay, "AGENTS.md"))) {
  die(
    `${vpay} does not look like a vpay checkout (no AGENTS.md). Pass --vpay DIR.`,
  );
}
if (!existsSync(join(skillsRepo, "skills"))) {
  die(
    `${skillsRepo} does not look like a vpay-skills checkout (no skills/). Pass --skills DIR.`,
  );
}

const git = (...args) => {
  try {
    return execFileSync("git", ["-C", vpay, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

// ---- what the checkout is ----------------------------------------------------
const head = git("rev-parse", "HEAD");
const headTag = git("describe", "--tags", "--exact-match", "HEAD");
const lockedRef = git("rev-parse", `${lock.vpay.tag}^{commit}`);

let releaseTag = null;
if (releaseOpt) {
  releaseTag = releaseOpt === true ? headTag : releaseOpt;
  if (!releaseTag)
    die(
      "--release given without a TAG, and the vpay checkout is not at a tag.",
    );
  const releaseRef = git("rev-parse", `${releaseTag}^{commit}`);
  if (!releaseRef)
    die(`tag ${releaseTag} does not exist in ${vpay}. Fetch tags first.`);
  if (head && releaseRef !== head) {
    die(
      `--release ${releaseTag} but the checkout is at ${head.slice(0, 8)}, not that tag.`,
    );
  }
}

// ---- the pages -----------------------------------------------------------------
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e === "public" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

const LINK = /\]\((vpay|skill):([^)\s]+)\)/g;
const pages = walk(DOCS).map((file) => {
  const { data, content } = matter(readFileSync(file, "utf8"));
  const links = { vpay: [], skill: [] };
  for (const m of content.matchAll(LINK)) links[m[1]].push(m[2].split("#")[0]);
  return {
    rel: relative(ROOT, file),
    data,
    sources: Array.isArray(data.sources) ? data.sources : [],
    skills: Array.isArray(data.skills) ? data.skills : [],
    links,
  };
});

const failures = [];
const fail = (section, msg) => failures.push({ section, msg });

// Every page says where it came from, or says why it cannot.
for (const p of pages) {
  const exempt = p.data.parity?.exempt;
  if (!p.sources.length && !exempt) {
    fail(
      "pages",
      `${p.rel}: no \`sources:\` frontmatter and no \`parity.exempt\` reason.`,
    );
  }
  if (p.data.status !== undefined && !STATUSES.has(p.data.status)) {
    fail(
      "pages",
      `${p.rel}: status "${p.data.status}" is not one of ${[...STATUSES].join(", ")}.`,
    );
  }
}

// ---- docs -> vpay ----------------------------------------------------------------
const exists = (path) => existsSync(join(vpay, path.replace(/\/+$/, "")));
for (const p of pages) {
  for (const s of p.sources) {
    if (!exists(s))
      fail("docs → vpay", `${p.rel}: source \`${s}\` does not exist in vpay.`);
  }
  for (const l of p.links.vpay) {
    if (!exists(l))
      fail(
        "docs → vpay",
        `${p.rel}: link \`vpay:${l}\` does not exist in vpay.`,
      );
  }
}

// ---- vpay -> docs ------------------------------------------------------------------
// What a human reader needs a page for. Deliberately NOT the status archive,
// plans, RFCs or reference/: those are vpay's own working record, and a
// human is sent to them by link from the pages that summarise them.
const ls = (dir, pred) =>
  existsSync(join(vpay, dir))
    ? readdirSync(join(vpay, dir))
        .filter((e) => pred(e, statSync(join(vpay, dir, e))))
        .map((e) => `${dir}/${e}`)
    : [];
const isPage = (e, st) => st.isFile() && e.endsWith(".md") && e !== "README.md";
const required = [
  ...ls("docs/flows", isPage),
  ...ls("docs/runbooks", isPage),
  ...ls("docs/adr", isPage),
  ...ls("sdks", (_, st) => st.isDirectory()),
];
const claimed = new Set(
  pages.flatMap((p) => p.sources.map((s) => s.replace(/\/+$/, ""))),
);
for (const r of required) {
  if (!claimed.has(r)) {
    fail(
      "vpay → docs",
      `\`${r}\` exists in vpay and no page lists it in \`sources:\`.`,
    );
  }
}

// ---- docs <-> skills ------------------------------------------------------------------
const skillNames = new Set(
  readdirSync(join(skillsRepo, "skills")).filter((n) =>
    existsSync(join(skillsRepo, "skills", n, "SKILL.md")),
  ),
);
const referenced = new Set();
for (const p of pages) {
  for (const s of [...p.skills, ...p.links.skill]) {
    referenced.add(s);
    if (!skillNames.has(s))
      fail(
        "docs → skills",
        `${p.rel}: skill \`${s}\` does not exist in vpay-skills.`,
      );
  }
}
for (const s of skillNames) {
  if (!referenced.has(s))
    fail(
      "skills → docs",
      `skill \`${s}\` exists in vpay-skills and no page references it.`,
    );
}

// ---- release -------------------------------------------------------------------------
// Pages whose vpay sources (or `vpay:` link targets) changed between two refs.
function staleBetween(fromRef, toRef) {
  const changed = (git("diff", "--name-only", fromRef, toRef) ?? "")
    .split("\n")
    .filter(Boolean);
  const touches = (path) => {
    const p = path.replace(/\/+$/, "");
    return changed.filter((c) => c === p || c.startsWith(`${p}/`));
  };
  const out = [];
  for (const p of pages) {
    const hits = [...new Set([...p.sources, ...p.links.vpay].flatMap(touches))];
    if (hits.length) out.push({ page: p.rel, hits });
  }
  return { changed: changed.length, stale: out };
}

let stale = [];
let drift = null;
if (!lockedRef) {
  fail(
    "lock",
    `vpay.lock.json names ${lock.vpay.tag}, which does not exist in this checkout.`,
  );
} else if (lockedRef !== lock.vpay.ref) {
  fail(
    "lock",
    `vpay.lock.json says ${lock.vpay.tag} is ${lock.vpay.ref.slice(0, 8)}; the checkout says ${lockedRef.slice(0, 8)}.`,
  );
}

if (releaseTag && lockedRef && releaseTag !== lock.vpay.tag) {
  const d = staleBetween(lockedRef, "HEAD");
  stale = d.stale;
  drift = {
    from: lock.vpay.tag,
    to: releaseTag,
    commits: Number(git("rev-list", "--count", `${lockedRef}..HEAD`) ?? 0),
    changed: d.changed,
  };
  fail(
    "release",
    `these pages are verified against ${lock.vpay.tag}; vpay has released ${releaseTag}. ` +
      `Re-read the ${stale.length} stale page(s) below, then bump vpay.lock.json.`,
  );
}

// A lock the parity bot moved, that no person has signed off yet. The bot
// (tools/bump-lock.mjs, from release-parity.yml) points the lock at a new tag
// and sets `verifiedAt: null`, keeping where it came from in `previous`. Until
// a person re-reads the stale pages and writes a date back, this fails and
// lists them — which is what makes the bot's PR red on exactly the work.
const unsigned = [
  lock.vpay.verifiedAt == null ? "vpay.verifiedAt" : null,
  lock.skills.verifiedAt == null ? "skills.verifiedAt" : null,
].filter(Boolean);
if (unsigned.length) {
  const prev = lock.vpay.previous;
  if (lock.vpay.verifiedAt == null && prev?.ref && lockedRef) {
    if (!git("rev-parse", `${prev.ref}^{commit}`)) {
      fail(
        "unverified",
        `vpay.lock.json's previous ref ${prev.ref.slice(0, 8)} (${prev.tag}) is not in this checkout; fetch full history.`,
      );
    } else {
      const d = staleBetween(prev.ref, lockedRef);
      stale = d.stale;
      drift = {
        from: prev.tag,
        to: lock.vpay.tag,
        commits: Number(
          git("rev-list", "--count", `${prev.ref}..${lockedRef}`) ?? 0,
        ),
        changed: d.changed,
      };
    }
  }
  fail(
    "unverified",
    `vpay.lock.json has ${unsigned.join(" and ")} unset: it was moved` +
      (lock.vpay.previous?.tag
        ? ` from ${lock.vpay.previous.tag} to ${lock.vpay.tag}`
        : "") +
      ` and nobody has signed it off. Re-read the ${stale.length} stale page(s) below` +
      ` against vpay ${lock.vpay.tag}, fix what changed, then set each to today's date.`,
  );
}

// ---- report --------------------------------------------------------------------------
const summary = [
  `vpay checkout: ${head ? head.slice(0, 8) : "(not a git checkout)"}${headTag ? ` (${headTag})` : ""}`,
  `locked:        ${lock.vpay.tag} (${lock.vpay.ref.slice(0, 8)}), ${lock.vpay.verifiedAt ? `verified ${lock.vpay.verifiedAt}` : "NOT signed off"}`,
  `pages:         ${pages.length}, claiming ${claimed.size} vpay paths; ${required.length} required`,
  `skills:        ${referenced.size} referenced of ${skillNames.size} in vpay-skills`,
];
if (drift)
  summary.push(
    `release drift: ${drift.from} → ${drift.to}, ${drift.commits} commits, ${drift.changed} files changed`,
  );

const md = [];
md.push(
  `## vpay-docs parity${releaseTag ? ` with vpay ${releaseTag}` : ""}`,
  "",
);
md.push("```text", ...summary, "```", "");
if (!failures.length)
  md.push(
    "**Parity holds.** Every required vpay page is covered and every claim resolves.",
  );
const sections = [...new Set(failures.map((f) => f.section))];
for (const s of sections) {
  md.push(`### ${s}`, "");
  for (const f of failures.filter((x) => x.section === s))
    md.push(`- ${f.msg}`);
  md.push("");
}
if (stale.length) {
  md.push(
    "### Stale pages",
    "",
    "Pages whose vpay sources changed in this release:",
    "",
  );
  for (const s of stale)
    md.push(`- \`${s.page}\` — ${s.hits.map((h) => `\`${h}\``).join(", ")}`);
  md.push("");
}
if (reportFile)
  writeFileSync(
    resolve(reportFile === true ? "parity-report.md" : reportFile),
    md.join("\n") + "\n",
  );

console.log(summary.join("\n"));
if (failures.length) {
  console.log(`\n${failures.length} gap(s):`);
  for (const f of failures) console.log(`  [${f.section}] ${f.msg}`);
  for (const s of stale)
    console.log(`  [stale] ${s.page} <- ${s.hits.join(", ")}`);
  process.exit(1);
}
console.log("\nparity holds.");
