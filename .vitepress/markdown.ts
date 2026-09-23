import type MarkdownIt from "markdown-it";

/**
 * Two authoring conventions, both resolved here so a page never hard-codes a
 * version:
 *
 *   [text](vpay:docs/flows/money.md)   -> vpay's file AT THE LOCKED TAG
 *   [text](skill:vpay-payments)        -> the skill AT THE LOCKED REF
 *
 * A hard-coded `blob/v0.4.1/...` would be wrong the day the lock moves and
 * nothing would say so. tools/verify-parity.mjs reads the same two schemes and
 * fails a link whose target does not exist in the checkout it is given.
 */
export interface Lock {
  vpay: { repository: string; tag: string; ref: string };
  skills: { repository: string; ref: string };
}

export function vpayUrl(lock: Lock, path: string): string {
  const [p, hash] = path.split("#");
  const clean = p!.replace(/^\/+/, "").replace(/\/+$/, "");
  // GitHub redirects /blob/ to /tree/ for a directory, so one form serves both.
  return `https://github.com/${lock.vpay.repository}/blob/${lock.vpay.tag}/${clean}${hash ? `#${hash}` : ""}`;
}

export function skillUrl(lock: Lock, name: string): string {
  return `https://github.com/${lock.skills.repository}/tree/${lock.skills.ref}/skills/${name}`;
}

export function vpayMarkdown(lock: Lock) {
  return (md: MarkdownIt) => {
    md.core.ruler.after("inline", "vpay-links", (state) => {
      for (const block of state.tokens) {
        for (const t of block.children ?? []) {
          if (t.type !== "link_open") continue;
          const href = t.attrGet("href") ?? "";
          if (href.startsWith("vpay:"))
            t.attrSet("href", vpayUrl(lock, href.slice(5)));
          else if (href.startsWith("skill:"))
            t.attrSet("href", skillUrl(lock, href.slice(6)));
        }
      }
    });

    // ```mermaid fences become <Mermaid>, rendered on the client (mermaid
    // needs a DOM) and re-rendered when the reader toggles dark mode.
    const fence = md.renderer.rules.fence!;
    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx]!;
      if (token.info.trim() === "mermaid") {
        return `<Mermaid code="${encodeURIComponent(token.content)}" />`;
      }
      return fence(tokens, idx, options, env, self);
    };
  };
}
