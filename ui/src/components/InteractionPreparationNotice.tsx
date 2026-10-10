import { t as translateUiCopy, useTranslation as useUiCopyTranslation } from "@/i18n";
import { Loader2 } from "lucide-react";

export function InteractionPreparationNotice() {
  useUiCopyTranslation();
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {translateUiCopy("app.uiCopy.componentsInteractionPreparationNotice.preparingApproval")}
    </div>
  );
}
