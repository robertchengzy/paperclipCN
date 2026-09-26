import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { decideByLabel } from "./attention";
import { formatMonitorAbsolute, formatMonitorAbsoluteFull } from "./issue-monitor";
import { displayLocale, formatCents, formatDate, formatDateTime, formatNumber } from "./utils";

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
});

describe("UI locale formatting", () => {
  it("follows language changes with a different host locale", async () => {
    const localTimestamp = new Date(2026, 8, 7, 13, 2, 54);
    const dateFormat = Date.prototype.toLocaleDateString;
    const dateTimeFormat = Date.prototype.toLocaleString;
    const numberFormat = Number.prototype.toLocaleString;
    // Model a German host: omitted locales must not leak into the UI.
    vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(function (this: Date, locale, options) {
      return dateFormat.call(this, locale ?? "de-DE", options);
    });
    vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (this: Date, locale, options) {
      return dateTimeFormat.call(this, locale ?? "de-DE", options);
    });
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (this: Number, locale, options) {
      return numberFormat.call(this, locale ?? "de-DE", options);
    });
    expect((1234.5).toLocaleString()).toBe("1.234,5");
    expect(localTimestamp.toLocaleDateString()).toBe("7.9.2026");

    for (const language of ["en", "zh-CN", "en"] as const) {
      await i18n.changeLanguage(language);
      expect(displayLocale()).toBe(language === "en" ? "en-US" : "zh-CN");
      expect(formatDate(localTimestamp)).toBe(language === "en" ? "Sep 7, 2026" : "2026年9月7日");
      expect(formatDateTime(localTimestamp, { includeSeconds: true })).toBe(
        language === "en" ? "Sep 7, 2026, 1:02:54 PM" : "2026年9月7日 13:02:54",
      );
      expect(formatNumber(1234.5)).toBe("1,234.5");
      expect(formatCents(123450)).toBe("$1,234.50");
      expect(decideByLabel("2026-09-07")).toBe(language === "en" ? "Sep 7" : "9月7日");
    }
  });

  it("uses the UI language while retaining monitor timezone and explicit locale overrides", async () => {
    const target = "2026-09-08T01:02:00.000Z";
    const now = "2026-09-07T15:00:00.000Z";
    const nativeDateTimeFormat = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locale, options) {
      return new nativeDateTimeFormat(locale ?? "de-DE", options);
    });

    await i18n.changeLanguage("en");
    expect(formatMonitorAbsolute(target, { timeZone: "America/Chicago" }, now)).toBe("Today, 8:02 PM");
    expect(formatMonitorAbsoluteFull(target, { timeZone: "America/Chicago" })).toBe(
      "Monday, September 7, 2026, 8:02:00 PM CDT",
    );
    await i18n.changeLanguage("zh-CN");
    const chinese = formatMonitorAbsoluteFull(target, { timeZone: "America/Chicago" });
    expect(chinese).toContain("2026年9月7日");
    expect(chinese).toContain("20:02:00");
    expect(formatMonitorAbsoluteFull(target, { locale: "en-US", timeZone: "America/Chicago" })).toContain(
      "Monday, September 7, 2026",
    );
  });
});
