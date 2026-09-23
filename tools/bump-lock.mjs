#!/usr/bin/env node
// Points vpay.lock.json at a newer vpay release, WITHOUT claiming anything.
//
//   node tools/bump-lock.mjs --tag vX.Y.Z [--vpay DIR] [--skills DIR]
//
// It is what release-parity.yml runs before it opens a draft PR. It records
// the tag, its commit and its date, moves `skills.ref` to the vpay-skills
// checkout's HEAD, keeps where the lock came from under `vpay.previous`, and
// sets BOTH `verifiedAt` fields to null. verify-parity.mjs fails on a null
// `verifiedAt` and lists every page whose vpay sources changed since
// `previous` — so the PR is red on exactly the pages a person must re-read,
// and only a person writing a date back turns it green.
//
// Exit 0 = lock written. 2 = a checkout is missing or the tag is not in it.
// 3 = the tag is not newer than the lock (not a descendant of its commit).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const tag = opt("--tag");
const vpay = resolve(
  opt("--vpay") ?? process.env.VPAY_REPO ?? join(ROOT, "..", "vpay"),
);
const skills = resolve(
  opt("--skills") ??
    process.env.VPAY_SKILLS_REPO ??
    join(ROOT, "..", "vpay-skills"),
);

function die(msg) {
  console.error(`bump-lock: ${msg}`);
  process.exit(2);
}
const git = (dir, ...args) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) die("pass --tag vX.Y.Z");
const ref = git(vpay, "rev-parse", `${tag}^{commit}`);
if (!ref) die(`tag ${tag} is not in ${vpay}; fetch tags first.`);
const tagDate = git(vpay, "log", "-1", "--format=%cs", ref);
const skillsRef = git(skills, "rev-parse", "HEAD");
if (!skillsRef) die(`${skills} is not a git checkout of vpay-skills.`);

const path = join(ROOT, "vpay.lock.json");
const lock = JSON.parse(readFileSync(path, "utf8"));
if (lock.vpay.tag === tag) die(`the lock already names ${tag}.`);
// Only forwards. A manual run for an older tag must never open a PR that
// moves the lock backwards; exit 3 tells release-parity.yml "nothing to do".
if (git(vpay, "merge-base", "--is-ancestor", lock.vpay.ref, ref) === null) {
  console.error(
    `bump-lock: ${tag} (${ref.slice(0, 8)}) does not descend from the locked ` +
      `${lock.vpay.tag} (${lock.vpay.ref.slice(0, 8)}); refusing to move the lock backwards.`,
  );
  process.exit(3);
}

lock.vpay = {
  repository: lock.vpay.repository,
  tag,
  ref,
  tagDate,
  verifiedAt: null,
  previous: { tag: lock.vpay.tag, ref: lock.vpay.ref },
};
lock.skills = {
  repository: lock.skills.repository,
  ref: skillsRef,
  verifiedAt: null,
};
writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`);
console.log(
  `bump-lock: ${lock.vpay.previous.tag} -> ${tag} (${ref.slice(0, 8)}, ${tagDate}); ` +
    `skills -> ${skillsRef.slice(0, 8)}; verifiedAt cleared`,
);
