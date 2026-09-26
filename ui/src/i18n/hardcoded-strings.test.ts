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
    expect(found).toEqual(["prop:Name", "prop:Saved", "jsx-attr:Open settings", "jsx-text:Save changes", "jsx-expr:ok"]);
  });

  it("flags lowercase copy at display positions and around dynamic values", () => {
    const source = `
      const columns = [{ label: "credits" }];
      export const X = () => <div title="review settings" className="flex gap-2">
        net<span>credits</span>
        <p>{agent.name} is not configured for low-trust review</p>
        <p>{"credits remaining: " + count}</p>
        <p>{count + " credits remaining"}</p>
        <p>{\`\${count} credits\`}</p>
        <p>{ready ? "ready" : "not ready"}</p>
      </div>;
    `;
    expect(scanSource("x.tsx", source, new Set()).map((item) => `${item.kind}:${item.text}`)).toEqual([
      "prop:credits",
      "jsx-attr:review settings",
      "jsx-text:net",
      "jsx-text:credits",
      "jsx-text:is not configured for low-trust review",
      "jsx-expr:credits remaining:",
      "jsx-expr:credits remaining",
      "jsx-expr:credits",
      "jsx-expr:ready",
      "jsx-expr:not ready",
    ]);
  });

  it("does not confuse punctuation around displayed prose with paths or identifiers", () => {
    const source = `export const X = () => <p>{provider}. After connecting, continue with setup.<span>credits.</span><span>read-only</span></p>`;
    expect(scanSource("x.tsx", source, new Set()).map((item) => item.text)).toEqual([
      ". After connecting, continue with setup.",
      "credits.",
      "read-only",
    ]);
  });

  it("keeps program-only values and translation calls outside the display-copy check", () => {
    const source = `
      const status = "stopped";
      const classes = "flex gap-2";
      const typeMap = { primary: "managed-primary" };
      export const X = () => <div className={classes} data-state="stopped">
        {status === "stopped" ? t("status.stopped") : t("status.running")}
      </div>;
    `;
    expect(scanSource("x.tsx", source, new Set())).toEqual([]);
  });

  it("skips code-like values and exempt values", () => {
    const source = `
      const a = { label: "issue_status", title: "text-sm font-medium", description: "https://example.com" };
      export const B = () => <p aria-label="GitHub">&middot; {count}</p>;
    `;
    expect(scanSource("x.tsx", source, new Set(["GitHub", "text-sm font-medium"]))).toEqual([]);
  });

  it("ui/src has no untranslated user-visible literals", () => {
    expect(scanUi(srcDir, exemptions)).toEqual([]);
  }, 60_000);
});
