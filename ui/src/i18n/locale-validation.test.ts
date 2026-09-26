import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_STORAGE_KEY, setUiLanguage, t } from ".";
import en from "./locales/en.json";
import zh from "./locales/zh-CN.json";
import { localeMessages } from "./locales";
import { validateLocaleMessages } from "./locale-validation";

describe("locale validation", () => {
  beforeEach(async () => {
    await setUiLanguage("zh-CN");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await setUiLanguage("en");
  });

  it("switches from Chinese to English with a stored preference", async () => {
    expect(t("app.noCompanies.title")).toBe(zh.app.noCompanies.title);
    const storage = { setItem: vi.fn() };
    const documentElement = { lang: "zh-CN" };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("document", { documentElement });

    await setUiLanguage("en");
    expect(t("app.noCompanies.title")).toBe(en.app.noCompanies.title);
    expect(documentElement.lang).toBe("en");
    expect(storage.setItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, "en");
    expect(t("app.missing", { defaultValue: "Fallback" })).toBe("Fallback");
    expect(t("app.missing")).toBe("app.missing");

    await setUiLanguage("zh-CN");
    expect(documentElement.lang).toBe("zh-CN");
  });

  it("can switch languages when browser storage is unavailable", async () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("storage unavailable"); } });
    await expect(setUiLanguage("en")).resolves.toBeUndefined();
    expect(t("app.noCompanies.title")).toBe(en.app.noCompanies.title);
    await setUiLanguage("zh-CN");
  });

  it("accepts registered locale files", () => {
    expect(Object.keys(localeMessages).sort()).toEqual(["en", "zh-CN"]);
    for (const [locale, messages] of Object.entries(localeMessages)) {
      expect(validateLocaleMessages(messages), locale).toEqual([]);
    }
  });

  it("rejects missing and extra nested keys", () => {
    expect(
      validateLocaleMessages({
        app: {
          noCompanies: {
            title: en.app.noCompanies.title,
            description: en.app.noCompanies.description,
            unexpected: "Unexpected",
          },
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        "app.noCompanies.newCompany is missing",
        "app.noCompanies.unexpected is not defined in English",
      ]),
    );
  });

  it("rejects non-string leaves", () => {
    expect(
      validateLocaleMessages({
        app: {
          noCompanies: {
            ...en.app.noCompanies,
            title: ["Create your first company"],
          },
        },
      }),
    ).toEqual(expect.arrayContaining(["app.noCompanies.title must be a string"]));
  });

  it("requires interpolation placeholders to match English", () => {
    const reference = {
      message: "Invite {{name}} to {{company}}",
    };

    expect(validateLocaleMessages({ message: "Invite {{name}}" }, reference)).toEqual([
      'message interpolation placeholders must match English exactly: expected ["company","name"], received ["name"]',
    ]);
  });

  it("rejects executable, raw HTML, and unexpected link payloads not present in English", () => {
    const reference = {
      script: "Create company",
      handler: "Create company",
      js: "Create company",
      data: "Create company",
      url: "Create company",
      html: "Create company",
    };

    expect(
      validateLocaleMessages(
        {
          script: "<script>alert(1)</script>",
          handler: '<span ONCLICK="alert(1)">Create</span>',
          js: "javascript:alert(1)",
          data: "data:text/html,hello",
          url: "https://example.test",
          html: "<strong>Create company</strong>",
        },
        reference,
      ),
    ).toEqual(
      expect.arrayContaining([
        "script contains disallowed <script",
        "handler contains disallowed event-handler attribute",
        "js contains disallowed javascript:",
        "data contains disallowed data:",
        "url contains disallowed unexpected URL",
        "html contains disallowed raw HTML tag",
      ]),
    );
  });

  it("caps localized string length relative to English", () => {
    expect(validateLocaleMessages({ message: "x".repeat(200) }, { message: "Short" })).toEqual([
      "message is too long: 200 characters exceeds 133",
    ]);
  });
});
