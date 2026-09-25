import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { installedHint, installAllWarning } from "./tool-installs";
import { describeToolInput, toolInputDetailLabel } from "./transcriptPresentation";

// These labels also act as identifiers; language switching must not mutate them.
describe("localized display labels", () => {
  afterEach(async () => { await i18n.changeLanguage("en"); });

  it("resolves install copy at call time after language changes", async () => {
    await i18n.changeLanguage("en");
    expect(installedHint()).toBe("Has access — tick to load its tools into this agent's context.");
    expect(installAllWarning()).toContain("Adds context cost");
    await i18n.changeLanguage("zh-CN");
    expect(installedHint()).toContain("已有访问权限");
    expect(installAllWarning()).toContain("上下文成本");
  });

  it("keeps input detail identities stable while translating display copy", async () => {
    await i18n.changeLanguage("zh-CN");
    const details = describeToolInput("Bash", { description: "User supplied intent", command: "pwd" });
    expect(details.some((detail) => detail.label === "Intent")).toBe(true);
    expect(details.some((detail) => detail.label === "Command")).toBe(false);
    expect(toolInputDetailLabel("Intent")).toBe("意图");
    expect(toolInputDetailLabel("User supplied label")).toBe("User supplied label");
    expect(toolInputDetailLabel("toString")).toBe("toString");
    await i18n.changeLanguage("en");
    expect(toolInputDetailLabel("Intent")).toBe("Intent");
  });
});
