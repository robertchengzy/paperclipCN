import { t, useTranslation } from "@/i18n";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useAccountIdentity } from "@/api/companies-query";
import type { HealthStatus } from "@/api/health";
import { useCompany } from "@/context/CompanyContext";
import { useDialogState } from "@/context/DialogContext";
import { useOptionalToastActions, useOptionalToastState } from "@/context/ToastContext";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { AnnouncementCard } from "./AnnouncementCard";

// Includes the command palette, sheets and dialogs created outside DialogContext.
const MODAL_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [aria-modal="true"]:not([data-state="closed"]), dialog[open]';
function useModalOpen(enabled: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const scan = () => setOpen(Boolean(document.querySelector(MODAL_SELECTOR)));
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "aria-modal", "open"] });
    return () => observer.disconnect();
  }, [enabled]);
  return open;
}

/** Track the visible action boundary, including sticky bars still in normal flow. */
function useMobileActionBarInset(enabled: boolean, ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const well = ref.current;
    if (!enabled || !well) return;
    let bars: HTMLElement[] = [];
    let frame: number | null = null;
    const movingBars = new Set<HTMLElement>();
    const measure = () => {
      const nextInset = window.innerWidth >= 768 ? 0 : Math.max(0, ...bars.map((bar) => {
        const rect = bar.getBoundingClientRect();
        return rect.width > 0 && rect.top < window.innerHeight && rect.bottom > 0
          ? window.innerHeight - rect.top
          : 0;
      }));
      const inset = `${nextInset}px`;
      if (well.style.getPropertyValue("--announcement-action-bar-inset") !== inset) {
        well.style.setProperty("--announcement-action-bar-inset", inset);
      }
      if (nextInset > 0) well.dataset.mobileActionArea = "present";
      else delete well.dataset.mobileActionArea;
    };
    const tick = () => {
      frame = null;
      measure();
      if (movingBars.size > 0) scheduleMeasure();
    };
    const scheduleMeasure = () => {
      if (frame === null) frame = window.requestAnimationFrame(tick);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const findBars = () => {
      const nextBars = Array.from(document.querySelectorAll<HTMLElement>("[data-mobile-action-bar]"));
      for (const bar of bars) {
        if (!nextBars.includes(bar)) {
          resizeObserver?.unobserve(bar);
          movingBars.delete(bar);
        }
      }
      for (const bar of nextBars) if (!bars.includes(bar)) resizeObserver?.observe(bar);
      bars = nextBars;
      scheduleMeasure();
    };
    const onTransition = (event: TransitionEvent) => {
      const bar = event.target;
      if (!(bar instanceof HTMLElement) || !bars.includes(bar) || event.propertyName !== "bottom") return;
      if (event.type === "transitionrun") movingBars.add(bar);
      else movingBars.delete(bar);
      scheduleMeasure();
    };
    findBars();
    // Position the first card before paint. Subsequent pure-position transitions
    // need frame measurements because ResizeObserver only tracks size changes.
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    measure();
    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) findBars();
      // Reduced motion skips transition events. Observe only the action bar
      // and its ancestors so a nav offset jump is reflected before paint;
      // our own announcement style writes cannot feed back into measurement.
      if (records.some((record) => record.type === "attributes" && record.target instanceof Element
        && bars.some((bar) => (record.target as Element).contains(bar)))) measure();
    });
    mutationObserver.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"],
    });
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    window.addEventListener("transitionrun", onTransition, true);
    window.addEventListener("transitionend", onTransition, true);
    window.addEventListener("transitioncancel", onTransition, true);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("transitionrun", onTransition, true);
      window.removeEventListener("transitionend", onTransition, true);
      window.removeEventListener("transitioncancel", onTransition, true);
      well.style.removeProperty("--announcement-action-bar-inset");
      delete well.dataset.mobileActionArea;
    };
  }, [enabled, ref]);
}

export function AnnouncementWell({ health }: { health?: HealthStatus }) {
  const { t } = useTranslation();
  const { userId: accountId, settled } = useAccountIdentity();
  const { selectedCompanyId, loading } = useCompany();
  const { onboardingOpen } = useDialogState();
  const toastActions = useOptionalToastActions();
  const toasts = useOptionalToastState();
  const userId = health?.deploymentMode === "local_trusted" ? "local-board" : (settled ? accountId : null);
  const { announcement, dismiss } = useAnnouncement({
    userId, companyId: selectedCompanyId,
    enabled: Boolean(userId && !loading && selectedCompanyId && !onboardingOpen),
    onSaveFailure: (savedLocally) => toastActions?.pushToast({
      title: savedLocally ? t("app.shell.announcementWell.dismissedInThisBrowser") : t("app.shell.announcementWell.dismissedForThisVisit"),
      body: t("app.shell.announcementWell.couldnTSaveAcrossDevicesWeLl"),
      tone: "info", dedupeKey: "announcement-dismissal-sync",
    }),
  });
  const modalOpen = useModalOpen(Boolean(announcement));
  const visible = Boolean(announcement) && !modalOpen && (toasts?.length ?? 0) === 0;
  const wellRef = useRef<HTMLElement>(null);
  useMobileActionBarInset(visible, wellRef);
  if (!announcement || !visible) return null;
  return (
    <aside
      ref={wellRef}
      aria-label={t("app.shell.announcementWell.paperclipAnnouncements")} className="announcement-well fixed left-3 bottom-(--announcement-mobile-bottom) z-40 w-(--announcement-available-width) max-w-(--announcement-width) max-h-(--announcement-mobile-max-height) overflow-y-auto md:bottom-3 md:max-h-(--announcement-max-height)">
      <AnnouncementCard key={announcement.id} announcement={announcement} onDismiss={() => dismiss(announcement.id)} />
    </aside>
  );
}
