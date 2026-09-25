import { t } from "@/i18n";
/**
 * Tiny best-effort cron → plain-English helper for the routine Triggers section.
 * Not a full cron parser: it covers the common shapes Paperclip schedule triggers
 * produce (every N minutes/hours, daily at HH:MM, weekday/weekend, day-of-week).
 * Falls back to the raw expression when it can't confidently describe it.
 */

function dayOfWeekName(index: number): string {
  switch (index) {
    case 0: return t("app.lib.cronReadable.sunday");
    case 1: return t("app.lib.cronReadable.monday");
    case 2: return t("app.lib.cronReadable.tuesday");
    case 3: return t("app.lib.cronReadable.wednesday");
    case 4: return t("app.lib.cronReadable.thursday");
    case 5: return t("app.lib.cronReadable.friday");
    default: return t("app.lib.cronReadable.saturday");
  }
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function describeTime(minute: string, hour: string): string | null {
  const m = Number(minute);
  const h = Number(hour);
  if (!Number.isInteger(m) || !Number.isInteger(h)) return null;
  if (m < 0 || m > 59 || h < 0 || h > 23) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

function describeDayOfWeekAt(dow: string, time: string): string | null {
  if (dow === "*" || dow === "?") return t("app.lib.cronReadable.everyDayAt", { time });
  if (dow === "1-5") return t("app.lib.cronReadable.everyWeekdayAt", { time });
  if (dow === "0,6" || dow === "6,0" || dow === "0,7") return t("app.lib.cronReadable.everyWeekendAt", { time });
  const parts = dow.split(",").map((part) => part.trim());
  const names = parts.map((part) => {
    const n = Number(part);
    if (!Number.isInteger(n)) return null;
    return dayOfWeekName(n % 7);
  });
  if (names.some((name) => name === null)) return null;
  if (names.length === 1) return t("app.lib.cronReadable.everyDayOfWeekAt", { day: names[0], time });
  return t("app.lib.cronReadable.everyDaysOfWeekAt", {
    days: names.slice(0, -1).join(t("app.lib.cronReadable.daySeparator")),
    last: names[names.length - 1],
    time,
  });
}

export function describeCron(expression: string | null | undefined): string | null {
  if (!expression) return null;
  const trimmed = expression.trim();
  const fields = trimmed.split(/\s+/);
  // Standard 5-field cron: minute hour day-of-month month day-of-week
  if (fields.length !== 5) return null;
  const [minute, hour, dom, month, dow] = fields;

  // Every N minutes
  const everyMinutes = minute.match(/^\*\/(\d+)$/);
  if (everyMinutes && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return t("app.lib.cronReadable.everyMinutes", { interval: everyMinutes[1] });
  }

  // Every N hours, on the minute
  const everyHours = hour.match(/^\*\/(\d+)$/);
  if (everyHours && /^\d+$/.test(minute) && dom === "*" && month === "*" && dow === "*") {
    return t("app.lib.cronReadable.everyHoursAt", { interval: everyHours[1], minute: pad2(Number(minute)) });
  }

  // Hourly
  if (/^\d+$/.test(minute) && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return t("app.lib.cronReadable.everyHourAt", { minute: pad2(Number(minute)) });
  }

  // Daily / weekly at a fixed time
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && month === "*") {
    const time = describeTime(minute, hour);
    if (!time) return null;
    if (dom === "*" && (dow === "*" || dow === "?")) {
      return t("app.lib.cronReadable.everyDayAt", { time });
    }
    if (dom === "*") {
      const dowText = describeDayOfWeekAt(dow, time);
      if (dowText) return dowText;
    }
    if (/^\d+$/.test(dom) && (dow === "*" || dow === "?")) {
      return t("app.lib.cronReadable.dayOfMonthAt", { day: dom, time });
    }
  }

  return null;
}
