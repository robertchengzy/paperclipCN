import { useTranslation, setUiLanguage, type UiLanguage } from "@/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LanguageSwitcher({ variant = "select" }: { variant?: "select" | "toggle" }) {
  const { t, i18n } = useTranslation();
  const language: UiLanguage = i18n.resolvedLanguage === "en" ? "en" : "zh-CN";

  if (variant === "toggle") {
    const nextLanguage = language === "en" ? "zh-CN" : "en";
    const label = t(nextLanguage === "en" ? "app.language.switchToEnglish" : "app.language.switchToChinese");
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => { void setUiLanguage(nextLanguage); }}
          >
            {t(nextLanguage === "en" ? "app.language.englishShort" : "app.language.chineseShort")}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    );
  }

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
