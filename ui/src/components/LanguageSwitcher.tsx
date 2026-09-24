import { useTranslation, setUiLanguage, type UiLanguage } from "@/i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const language: UiLanguage = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";

  return (
    <select
      aria-label={t("app.language.label")}
      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={language}
      onChange={(event) => {
        void setUiLanguage(event.target.value as UiLanguage);
      }}
    >
      <option value="zh-CN">简体中文</option>
      <option value="en">English</option>
    </select>
  );
}
