import * as path from "node:path";
import { describe, expect, it } from "vitest";
import exemptions from "./hardcoded-strings.exemptions.json";
import { scanSource, scanUi } from "./hardcoded-strings";

/**
 * Coverage gate for the zh-CN localization: user-visible copy in ui/src must go
 * through t(). Anything that legitimately stays English (brand names, acronyms,
 * dev-only pages) belongs in hardcoded-strings.exemptions.json.
 *
 * The whole UI scan must be empty. Stable program data and developer-only
 * strings are reviewed as exact exemptions rather than accepted as UI copy.
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

  it("ui/src has no untranslated user-visible literals", () => {
    expect(scanUi(srcDir, exemptions)).toEqual([]);
  }, 60_000);
});
