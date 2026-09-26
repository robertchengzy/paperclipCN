// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { RoutineActivityRow } from "./RoutineActivityRow";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
});

describe("routine activity time locale", () => {
  it("updates displayed times on language changes without remounting or changing the host timezone", async () => {
    const original = Date.prototype.toLocaleTimeString;
    vi.spyOn(Date.prototype, "toLocaleTimeString").mockImplementation(function (this: Date, locale, options) {
      return original.call(this, Array.isArray(locale) && locale.length === 0 ? "de-DE" : locale ?? "de-DE", options);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        await i18n.changeLanguage("en");
        root.render(<RoutineActivityRow event={{ id: "test", action: "routine.created", details: null, createdAt: new Date(2026, 8, 7, 13, 2) }} />);
      });
      expect(container.textContent).toContain("01:02 PM");
      await act(async () => { await i18n.changeLanguage("zh-CN"); });
      expect(container.textContent).toContain("13:02");
      expect(container.textContent).not.toContain("PM");
      await act(async () => { await i18n.changeLanguage("en"); });
      expect(container.textContent).toContain("01:02 PM");
    } finally {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });
});
