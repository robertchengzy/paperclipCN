import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import baseline from "./hardcoded-strings.baseline.json";
import exemptions from "./hardcoded-strings.exemptions.json";
import { countByFile, scanSource, scanUi } from "./hardcoded-strings";

/**
 * Coverage gate for the zh-CN localization: user-visible copy in ui/src must go
 * through t(). Anything that legitimately stays English (brand names, acronyms,
 * dev-only pages) belongs in hardcoded-strings.exemptions.json.
 *
 * While the migration is in progress, hardcoded-strings.baseline.json holds the
 * remaining per-file counts: a file may only go down. Regenerate it after
 * localizing files with `UPDATE_I18N_BASELINE=1 pnpm vitest run src/i18n/hardcoded-strings.test.ts`.
 */

const srcDir = path.resolve(__dirname, "..");

describe("hardcoded UI strings", () => {
  it("flags JSX text, copy attributes, copy properties and toast calls", () => {
    const source = `
      const columns = [{ key: "name", label: "Name" }];
      export function X() {
        pushToast({ title: "Saved", tone: "success" });
        return <div className="flex gap-2" title="Open settings" data-state="open">Save changes<span>{"ok"}</span></div>;
      }
    `;
    const found = scanSource("x.tsx", source, new Set()).map((item) => `${item.kind}:${item.text}`);
    expect(found).toEqual(["prop:Name", "prop:Saved", "jsx-attr:Open settings", "jsx-text:Save changes"]);
  });

  it("skips code-like values and exempt values", () => {
    const source = `
      const a = { label: "issue_status", title: "text-sm font-medium", description: "https://example.com" };
      export const B = () => <p aria-label="GitHub">&middot; {count}</p>;
    `;
    expect(scanSource("x.tsx", source, new Set(["GitHub"]))).toEqual([]);
  });

  it("ui/src adds no untranslated user-visible literals beyond the baseline", () => {
    const counts = countByFile(scanUi(srcDir, exemptions));
    if (process.env.UPDATE_I18N_BASELINE === "1") {
      fs.writeFileSync(path.join(__dirname, "hardcoded-strings.baseline.json"), `${JSON.stringify(counts, null, 2)}\n`);
      return;
    }
    const allowed = baseline as Record<string, number>;
    const regressions = Object.entries(counts)
      .filter(([file, count]) => count > (allowed[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (baseline ${allowed[file] ?? 0})`);
    expect(regressions).toEqual([]);
  }, 60_000);
});
