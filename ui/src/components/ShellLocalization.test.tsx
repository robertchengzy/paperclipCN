// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { ScheduleEditor, describeSchedule } from "./ScheduleEditor";
import { SourceResolvedFoldBadge } from "./SourceResolvedFoldBadge";
import { ISSUE_THINKING_EFFORT_OPTIONS } from "./issue-properties/helpers";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("shell localization language changes", () => {
  it("refreshes cron validation and default tooltips without remounting", async () => {
    await i18n.changeLanguage("en");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(<><ScheduleEditor value="0 8-18/2 * * 1-5" onChange={() => {}} /><SourceResolvedFoldBadge /></>);
      });
      expect(container.textContent).toContain("Valid cron.");
      expect(container.querySelector('[title="System folded this run as a source-resolved false positive."]')).not.toBeNull();
      await act(async () => { await i18n.changeLanguage("zh-CN"); });
      expect(container.textContent).toContain("Cron 有效。");
      expect(container.querySelector('[aria-label="Cron 表达式"]')).not.toBeNull();
      expect(container.querySelector('[title="系统已将此运行作为源任务已解决的误报折叠。"]')).not.toBeNull();
      await act(async () => { await i18n.changeLanguage("en"); });
      expect(container.textContent).toContain("Valid cron.");
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  it("evaluates exported option labels and schedule descriptions in the active language", async () => {
    await i18n.changeLanguage("en");
    expect(ISSUE_THINKING_EFFORT_OPTIONS.claude_local[0].label).toBe("Default");
    expect(describeSchedule("0 10 21 * *")).toBe("Monthly on the 21st at 10:00 AM");
    await i18n.changeLanguage("zh-CN");
    expect(ISSUE_THINKING_EFFORT_OPTIONS.claude_local[0].label).toBe("默认");
    expect(describeSchedule("0 10 21 * *")).toBe("每月 21 日 上午 10:00");
  });
});
