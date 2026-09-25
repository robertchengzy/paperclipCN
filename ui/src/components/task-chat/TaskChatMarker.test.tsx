// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import type { TaskChatMarkerItem } from "./task-chat-model";
import { buildActivityPhases, paperclipRunnerHistoryItems } from "./transcript-adapter";
import { ThemeProvider } from "@/context/ThemeContext";
import { TaskChatMarker } from "./TaskChatMarker";
import { TaskChatThreadView } from "./TaskChatThreadView";

vi.mock("@/lib/router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("TaskChatMarker", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:05:00.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    flushSync(() => root?.unmount());
    root = null;
    container.remove();
    vi.useRealTimers();
    await i18n.changeLanguage("en");
  });

  it("renders a failed run as a timestamped disclosure without divider rules", () => {
    flushSync(() =>
      root!.render(
        <ThemeProvider>
          <TaskChatMarker
            item={{
              id: "run-1:failure",
              kind: "marker",
              variant: "interrupted",
              label: "Run failed",
              detail:
                "The runner stopped before returning an answer (runner_exited).",
              collapsible: true,
              createdAtIso: "2026-09-01T12:00:00.000Z",
              runHref: "/agents/codex/runs/run-1",
            }}
          />
        </ThemeProvider>,
      ),
    );

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="task-chat-collapsible-marker"] button[aria-expanded]',
    )!;
    expect(toggle.textContent).toContain("Run failed");
    expect(toggle.textContent).toContain("5m ago");
    expect(
      container
        .querySelector('[data-testid="task-chat-collapsible-marker"]')
        ?.classList.contains("items-start"),
    ).toBe(true);
    expect(container.querySelector(".border-dashed")).toBeNull();
    expect(container.textContent).not.toContain("runner_exited");

    flushSync(() => toggle.click());

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("runner_exited");
    expect(
      container.querySelector('a[href="/agents/codex/runs/run-1"]')
        ?.textContent,
    ).toBe("View run");
  });

  it("keeps expected cancellation neutral when collapsed and expanded", () => {
    flushSync(() =>
      root!.render(
        <ThemeProvider>
          <TaskChatMarker
            item={{
              id: "cancelled",
              kind: "marker",
              variant: "interrupted",
              tone: "neutral",
              label: "Run cancelled",
              detail: "Cancelled by you.",
              collapsible: true,
            }}
          />
        </ThemeProvider>,
      ),
    );
    const toggle = container.querySelector<HTMLButtonElement>(
      "button[aria-expanded]",
    )!;
    expect(toggle.classList).toContain("text-muted-foreground");
    expect(container.querySelector(".text-destructive")).toBeNull();
    flushSync(() => toggle.click());
    expect(container.textContent).toContain("Cancelled by you.");
    expect(container.querySelector(".text-destructive")).toBeNull();
  });

  it("keeps Try again available without retry instructions in the detail", async () => {
    const onTryAgain = vi.fn();
    flushSync(() =>
      root!.render(
        <ThemeProvider>
          <TaskChatMarker
            item={{
              id: "run-1:failure",
              kind: "marker",
              variant: "interrupted",
              label: "Run failed",
              detail: "The runner stopped before returning an answer.",
              collapsible: true,
            }}
            onTryAgain={onTryAgain}
          />
        </ThemeProvider>,
      ),
    );

    const retry = container.querySelector<HTMLButtonElement>(
      '[data-testid="task-chat-run-failed-try-again"]',
    )!;
    expect(container.textContent).not.toContain(
      "You can retry this message now",
    );
    flushSync(() => retry.click());
    await Promise.resolve();
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it("routes Try again to the failed run retry callback", async () => {
    const onRetryFailedRun = vi.fn();
    flushSync(() =>
      root!.render(
        <ThemeProvider>
          <TaskChatThreadView
            scroll={false}
            items={[
              {
                id: "run-1:failure",
                kind: "marker",
                variant: "interrupted",
                label: "Run failed",
                detail: "The runner stopped before returning an answer.",
                collapsible: true,
                runId: "run-1",
              },
            ]}
            onRetryFailedRun={onRetryFailedRun}
          />
        </ThemeProvider>,
      ),
    );

    const retry = container.querySelector<HTMLButtonElement>(
      '[data-testid="task-chat-run-failed-try-again"]',
    )!;
    expect(retry).not.toBeNull();
    flushSync(() => retry.click());
    await Promise.resolve();
    expect(onRetryFailedRun).toHaveBeenCalledWith("run-1");
  });
  async function changeLanguage(language: "en" | "zh-CN") {
    let pending: ReturnType<typeof i18n.changeLanguage> | undefined;
    flushSync(() => { pending = i18n.changeLanguage(language); });
    await pending;
  }

  it.each([
    ["New session", "新会话"],
    ["Session started", "会话已开始"],
    ["Turn started", "轮次已开始"],
    ["Turn completed", "轮次已完成"],
    ["Interrupted", "已中断"],
    ["Waiting to resume", "等待恢复"],
    ["Approval required", "需要审批"],
    ["Usage limit reached", "已达到用量上限"],
    ["Run cancelled", "运行已取消"],
    ["Run interrupted", "运行已中断"],
    ["Run timed out", "运行超时"],
    ["Run failed", "运行失败"],
    ["Stopped", "已停止"],
    ["Couldn't start", "无法启动"],
    ["Run completed", "运行已完成"],
  ])("updates visible and accessible lifecycle label %s without changing its identifier", async (label, translated) => {
    for (const collapsible of [false, true]) {
      const item: TaskChatMarkerItem = Object.freeze({
        id: "stable-marker",
        kind: "marker",
        variant: "turn_boundary",
        label,
        collapsible,
        detail: "Provider detail stays verbatim.",
      });
      flushSync(() => root!.render(<ThemeProvider><TaskChatMarker item={item} /></ThemeProvider>));
      expect(container.textContent).toContain(label);
      await changeLanguage("zh-CN");
      expect(container.textContent).toContain(translated);
      if (collapsible) {
        const toggle = container.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
        expect(toggle.textContent).toContain(translated);
        if (toggle.getAttribute("aria-expanded") !== "true") flushSync(() => toggle.click());
        expect(container.textContent).toContain("Provider detail stays verbatim.");
      } else {
        expect(container.querySelector('[role="separator"]')?.getAttribute("aria-label")).toBe(translated);
      }
      expect(item.label).toBe(label);
      await changeLanguage("en");
      expect(container.textContent).toContain(label);
      expect(item.label).toBe(label);
    }
  });

  it.each(["User checkpoint: Run failed", "Provider custom event", "constructor"])(
    "preserves unknown or user-authored label %s in both languages",
    async (label) => {
      const item: TaskChatMarkerItem = Object.freeze({ id: "custom", kind: "marker", variant: "turn_boundary", label });
      flushSync(() => root!.render(<ThemeProvider><TaskChatMarker item={item} /></ThemeProvider>));
      await changeLanguage("zh-CN");
      expect(container.textContent).toContain(label);
      expect(container.querySelector('[role="separator"]')?.getAttribute("aria-label")).toBe(label);
      await changeLanguage("en");
      expect(container.textContent).toContain(label);
      expect(item.label).toBe(label);
    },
  );

  it.each(["Run failed", "Usage limit reached"])(
    "keeps retry routing for %s while rendering in Chinese",
    async (label) => {
      await changeLanguage("zh-CN");
      const item: TaskChatMarkerItem = Object.freeze({
        id: "run-localized:failure", kind: "marker", variant: "interrupted", label,
        collapsible: true, runId: "run-localized",
      });
      const onRetryFailedRun = vi.fn();
      flushSync(() => root!.render(
        <ThemeProvider><TaskChatThreadView scroll={false} items={[item]} onRetryFailedRun={onRetryFailedRun} /></ThemeProvider>,
      ));
      const retry = container.querySelector<HTMLButtonElement>('[data-testid="task-chat-run-failed-try-again"]');
      expect(retry).not.toBeNull();
      expect(container.textContent).toContain(label === "Run failed" ? "运行失败" : "已达到用量上限");
      flushSync(() => retry!.click());
      await Promise.resolve();
      expect(onRetryFailedRun).toHaveBeenCalledWith("run-localized");
      expect(item.label).toBe(label);
    },
  );

  it("retains runner history filtering after localized marker rendering", async () => {
    await changeLanguage("zh-CN");
    const items: TaskChatMarkerItem[] = ["Turn started", "Turn completed", "Provider checkpoint"].map((label) =>
      Object.freeze({ id: label, kind: "marker", variant: "turn_boundary", label }),
    );
    flushSync(() => root!.render(<ThemeProvider>{items.map((item) => <TaskChatMarker key={item.id} item={item} />)}</ThemeProvider>));
    expect(container.textContent).toContain("轮次已开始");
    expect(container.textContent).toContain("轮次已完成");
    expect(paperclipRunnerHistoryItems(items).map((item) => item.id)).toEqual(["Provider checkpoint"]);
    expect(items.map((item) => item.label)).toEqual(["Turn started", "Turn completed", "Provider checkpoint"]);
  });

  it("localizes the interrupted activity summary without translating its source marker", async () => {
    const item: TaskChatMarkerItem = Object.freeze({
      id: "summary", kind: "marker", variant: "interrupted", label: "Run failed",
    });
    expect(buildActivityPhases([item], false)[0]?.summary).toBe("Run failed");
    await changeLanguage("zh-CN");
    expect(buildActivityPhases([item], false)[0]?.summary).toBe("运行失败");
    const custom: TaskChatMarkerItem = Object.freeze({ ...item, label: "Provider checkpoint" });
    expect(buildActivityPhases([custom], false)[0]?.summary).toBe("Provider checkpoint");
    expect(item.label).toBe("Run failed");
    await changeLanguage("en");
    expect(buildActivityPhases([item], false)[0]?.summary).toBe("Run failed");
  });

});
