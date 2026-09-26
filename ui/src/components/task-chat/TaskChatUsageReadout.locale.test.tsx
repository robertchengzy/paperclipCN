// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { TaskChatStatusPill } from "./TaskChatStatusPill";
import { TaskChatUsageReadout } from "./TaskChatUsageReadout";
import { formatTaskChatTimestamp } from "./task-chat-adapter";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
});

describe("task chat usage locale", () => {
  it("updates usage text without changing numeric values, labels or costs", async () => {
    const numberFormat = Number.prototype.toLocaleString;
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (this: Number, locale, options) {
      return numberFormat.call(this, locale ?? "de-DE", options);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await i18n.changeLanguage("en");
        root.render(<>
          <TaskChatUsageReadout item={{ id: "usage", kind: "usage", label: "User label", usage: { used: 1234, size: 2000, inputTokens: 1234, outputTokens: 2000, costUsd: 1.25 } }} />
          <TaskChatStatusPill item={{ id: "status", kind: "status", status: "interrupted", label: "User status", tokens: { used: 1234, size: 2000 } }} />
        </>);
      });
      expect(container.textContent).toContain("1,234/2,000 ctx (62%)");
      expect(container.textContent).toContain("↑1,234 ↓2,000");
      await act(async () => { await i18n.changeLanguage("zh-CN"); });
      expect(container.textContent).toContain("1,234/2,000 上下文（62%）");
      expect(container.textContent).not.toContain("ctx");
      expect(container.textContent).toContain("User label");
      expect(container.textContent).toContain("User status");
      expect(container.textContent).toContain("$1.2500");
      await act(async () => { await i18n.changeLanguage("en"); });
      expect(container.textContent).toContain("1,234/2,000 ctx (62%)");
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  it("formats comment timestamps in the selected language and preserves invalid-date handling", async () => {
    const timestamp = new Date(2026, 8, 7, 13, 2);
    await i18n.changeLanguage("en");
    expect(formatTaskChatTimestamp(timestamp)).toBe("1:02 PM");
    await i18n.changeLanguage("zh-CN");
    expect(formatTaskChatTimestamp(timestamp)).toBe("13:02");
    expect(formatTaskChatTimestamp("invalid")).toBeUndefined();
    expect(formatTaskChatTimestamp(null)).toBeUndefined();
  });
});
