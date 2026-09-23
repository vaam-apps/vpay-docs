// Build-time loader for the Agent skills page. Reads every SKILL.md from
// vpay-skills AT THE LOCKED REF (git show, not the working tree), and places
// each skill's own "Verified against vpay <sha>" stamp relative to the vpay
// release these docs are locked to. A skill may be newer than that release —
// the page says so rather than letting a reader assume they agree.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import { defineLoader } from "vitepress";

export interface Skill {
  name: string;
  description: string;
  stamp: string | null;
  stampDate: string | null;
  relation: "same" | "older" | "newer" | "unknown";
}
export interface SkillsData {
  ref: string;
  vpayTag: string;
  skills: Skill[];
  error: string | null;
}
declare const data: SkillsData;
export { data };

const root = resolve(__dirname, "..", "..");
const lock = JSON.parse(readFileSync(join(root, "vpay.lock.json"), "utf8"));
const skillsRepo = resolve(
  process.env.VPAY_SKILLS_REPO ?? join(root, "..", "vpay-skills"),
);
const vpayRepo = resolve(process.env.VPAY_REPO ?? join(root, "..", "vpay"));

function git(dir: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
const ok = (dir: string, ...args: string[]) => git(dir, ...args) !== null;

export default defineLoader({
  load(): SkillsData {
    const ref: string = lock.skills.ref;
    const tag: string = lock.vpay.tag;
    const base = { ref, vpayTag: tag };
    const listing = git(skillsRepo, "ls-tree", "--name-only", `${ref}:skills`);
    if (listing === null) {
      return {
        ...base,
        skills: [],
        error: `vpay-skills at ${ref.slice(0, 8)} is not available to this build (${skillsRepo}).`,
      };
    }
    const tagRef = git(vpayRepo, "rev-parse", `${tag}^{commit}`);
    const skills: Skill[] = [];
    for (const name of listing.split("\n").filter(Boolean)) {
      const text = git(skillsRepo, "show", `${ref}:skills/${name}/SKILL.md`);
      if (text === null) continue;
      const { data } = matter(text);
      const m =
        /Verified against vpay `([0-9a-f]{7,40})` \((\d{4}-\d{2}-\d{2})\)/.exec(
          text,
        );
      const stamp = m?.[1] ?? null;
      let relation: Skill["relation"] = "unknown";
      if (stamp && tagRef) {
        const full = git(vpayRepo, "rev-parse", `${stamp}^{commit}`);
        if (full === tagRef) relation = "same";
        else if (
          full &&
          ok(vpayRepo, "merge-base", "--is-ancestor", full, tagRef)
        )
          relation = "older";
        else if (
          full &&
          ok(vpayRepo, "merge-base", "--is-ancestor", tagRef, full)
        )
          relation = "newer";
      }
      skills.push({
        name,
        description: String(data.description ?? ""),
        stamp,
        stampDate: m?.[2] ?? null,
        relation,
      });
    }
    // `vpay` is the orientation skill every other one routes from.
    skills.sort((a, b) =>
      a.name === "vpay"
        ? -1
        : b.name === "vpay"
          ? 1
          : a.name.localeCompare(b.name),
    );
    return { ...base, skills, error: null };
  },
});
