// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { act } from "react";
import { i18n } from "@/i18n";
import type { ToolCatalogEntry } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdvancedRule, WizardSelections } from "./profile-model";
import { WizardToolsStep } from "./WizardToolsStep";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function tool(id: string, toolName: string): ToolCatalogEntry {
  return {
    id,
    toolName,
    title: toolName,
    description: null,
    applicationId: "app-gmail",
    connectionId: "conn-1",
    isReadOnly: true,
    isWrite: false,
    isDestructive: false,
    riskLevel: "read",
  } as ToolCatalogEntry;
}

const appGroups = [
  {
    appKey: "app-gmail",
    applicationId: "app-gmail",
    connectionId: "conn-1",
    name: "Gmail",
    tools: [tool("gmail-read", "gmail.read"), tool("gmail-send", "gmail.send")],
  },
];

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("WizardToolsStep", () => {
  let container: HTMLDivElement;
  let root: Root;
  let selections: WizardSelections;
  let advancedRules: AdvancedRule[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    selections = {};
    advancedRules = [];
  });

  afterEach(async () => {
    flushSync(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  function render() {
    flushSync(() => {
      root.render(
        <WizardToolsStep
          appGroups={appGroups}
          catalogLoading={false}
          selections={selections}
          onSelectionsChange={(next) => {
            selections = next;
            render();
          }}
          advancedRules={advancedRules}
          onAdvancedRulesChange={(next) => {
            advancedRules = next;
            render();
          }}
          newToolsAction="deny"
          onNewToolsActionChange={() => undefined}
        />,
      );
    });
  }

  it("adds an advanced rule when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    vi.spyOn(Date, "now").mockReturnValue(1_780_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    render();

    const advancedTrigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Advanced rules",
    );
    flushSync(() => {
      advancedTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const patternInput = container.querySelector('input[placeholder="e.g. gmail.send*"]') as HTMLInputElement;
    flushSync(() => {
      setNativeValue(patternInput, "gmail.send*");
    });

    const addRuleButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Add rule",
    );
    flushSync(() => {
      addRuleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(advancedRules).toEqual([
      {
        id: "rule-mppy1i4g-4fzzzxjy",
        kind: "tool_name",
        value: "gmail.send*",
        riskLevel: undefined,
        effect: "include",
      },
    ]);
    expect(container.textContent).toContain("Allow tools matching gmail.send*");
  });

  it("translates risk rule summaries on language switch without changing rule values", async () => {
    const levels = ["low", "medium", "high", "critical", "read", "write", "destructive", "future_risk"];
    advancedRules = levels.map((level, index) => ({ id: `risk-${index}`, kind: "risk_level", value: level, riskLevel: level, effect: index % 2 === 0 ? "include" : "exclude" })) as AdvancedRule[];
    const originalRules = structuredClone(advancedRules);
    render();
    const trigger = [...container.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Advanced rules")!;
    flushSync(() => trigger.click());
    expect(container.textContent).toContain("Allow high tools");
    expect(container.textContent).toContain("Block future_risk tools");

    await act(async () => { await i18n.changeLanguage("zh-CN"); });
    const summaries = [...container.querySelectorAll("li")].map((item) => item.textContent);
    expect(summaries).toEqual([
      "允许 低风险 工具", "禁用 中风险 工具", "允许 高风险 工具", "禁用 严重风险 工具",
      "允许 只读 工具", "禁用 写入 工具", "允许 破坏性 工具", "禁用 future_risk 工具",
    ]);
    expect(advancedRules).toEqual(originalRules);
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(container.textContent).toContain("Allow high tools");
    expect(container.textContent).toContain("Block future_risk tools");
  });
});
