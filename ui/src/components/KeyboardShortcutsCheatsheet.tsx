import { t, useTranslation } from "@/i18n";
import { Trans } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShortcutEntry {
  keys: string[];
  label: string;
  /** Render keys as a simultaneous chord (joined with "+") rather than a
   *  t("app.shell.keyboardShortcutsCheatsheet.then") sequence. */
  combo?: boolean;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    get title() { return t("app.common.nouns.inbox"); },
    get shortcuts() { return [
      { keys: ["j"], label: t("app.shell.keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["↓"], label: t("app.shell.keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["k"], label: t("app.shell.keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["↑"], label: t("app.shell.keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["←"], label: t("app.shell.keyboardShortcutsCheatsheet.collapseSelectedGroup") },
      { keys: ["→"], label: t("app.shell.keyboardShortcutsCheatsheet.expandSelectedGroup") },
      { keys: ["Enter"], label: t("app.shell.keyboardShortcutsCheatsheet.openSelectedItem") },
      { keys: ["a"], label: t("app.shell.keyboardShortcutsCheatsheet.archiveItem") },
      { keys: ["y"], label: t("app.shell.keyboardShortcutsCheatsheet.archiveItem") },
      { keys: ["r"], label: t("app.shell.keyboardShortcutsCheatsheet.markAsRead") },
      { keys: ["U"], label: t("app.shell.keyboardShortcutsCheatsheet.markAsUnread") },
    ]; },
  },
  {
    get title() { return t("app.shell.keyboardShortcutsCheatsheet.taskDetail"); },
    get shortcuts() { return [
      { keys: ["y"], label: t("app.shell.keyboardShortcutsCheatsheet.quickArchiveBackToInbox") },
      { keys: ["g", "i"], label: t("app.shell.keyboardShortcutsCheatsheet.goToInbox") },
      { keys: ["g", "c"], label: t("app.shell.keyboardShortcutsCheatsheet.focusCommentComposer") },
    ]; },
  },
  {
    get title() { return t("app.shell.keyboardShortcutsCheatsheet.decisions"); },
    get shortcuts() { return [
      { keys: ["j"], label: t("app.shell.keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["↓"], label: t("app.shell.keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["k"], label: t("app.shell.keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["↑"], label: t("app.shell.keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["Enter"], label: t("app.shell.keyboardShortcutsCheatsheet.openOrCloseSelectedDecision") },
      { keys: ["x"], label: t("app.shell.keyboardShortcutsCheatsheet.dismissSelectedDecision") },
    ]; },
  },
  {
    get title() { return t("app.shell.keyboardShortcutsCheatsheet.global"); },
    get shortcuts() { return [
      { keys: ["/"], label: t("app.shell.keyboardShortcutsCheatsheet.searchCurrentPageOrQuickSearch") },
      { keys: ["c"], label: t("app.shell.keyboardShortcutsCheatsheet.newTask") },
      { keys: ["["], label: t("app.shell.keyboardShortcutsCheatsheet.toggleSidebar") },
      { keys: ["]"], label: t("app.shell.keyboardShortcutsCheatsheet.togglePanel") },
      { keys: ["?"], label: t("app.shell.keyboardShortcutsCheatsheet.showKeyboardShortcuts") },
    ]; },
  },
];

function KeyCap({ children }: { children: string }) {
  const { t } = useTranslation();
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-(--shadow-extract-10)">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  const { t } = useTranslation();
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="px-5 py-3">
            <h3 className="mb-2 text-(length:--text-micro) font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {shortcut.combo ? "+" : t("app.shell.keyboardShortcutsCheatsheet.then")}
                          </span>
                        )}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground"> <Trans i18nKey="app.shell.keyboardShortcutsCheatsheet.closeHelp" components={{ key: <KeyCap children="Esc" /> }} />
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{t("app.shell.keyboardShortcutsCheatsheet.keyboardShortcuts")}</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
