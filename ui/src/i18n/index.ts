import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";

export const LANGUAGE_STORAGE_KEY = "paperclip.ui.language";
export type UiLanguage = "en" | "zh-CN";

function initialLanguage(): UiLanguage {
  try {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === "en" || saved === "zh-CN" ? saved : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

const language = initialLanguage();

function updateDocumentLanguage(nextLanguage: string) {
  if (typeof document !== "undefined") document.documentElement.lang = nextLanguage;
}

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: language,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

updateDocumentLanguage(language);
i18n.on("languageChanged", (nextLanguage) => {
  updateDocumentLanguage(nextLanguage);
});

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;

export async function setUiLanguage(nextLanguage: UiLanguage) {
  await i18n.changeLanguage(nextLanguage);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  } catch {
    // Language switching still works when storage is unavailable.
  }
}

export { i18n };
