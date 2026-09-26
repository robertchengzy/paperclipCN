// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthStatus } from "@/api/health";
import { AnnouncementWell } from "./AnnouncementWell";
import { announcementPreview } from "@/lib/announcement-preview";

const state = vi.hoisted(() => ({
  userId: "alice" as string | null, settled: true, companyId: "company", loading: false,
  onboardingOpen: false, toasts: [] as unknown[], dismiss: vi.fn(), hook: vi.fn(),
}));
vi.mock("@/api/companies-query", () => ({ useAccountIdentity: () => ({ userId: state.userId, settled: state.settled }) }));
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompanyId: state.companyId, loading: state.loading }) }));
vi.mock("@/context/DialogContext", () => ({ useDialogState: () => ({ onboardingOpen: state.onboardingOpen }) }));
vi.mock("@/context/ToastContext", () => ({ useOptionalToastActions: () => null, useOptionalToastState: () => state.toasts }));
vi.mock("@/hooks/useAnnouncement", () => ({ useAnnouncement: (options: { enabled: boolean }) => {
  state.hook(options);
  return { announcement: options.enabled ? announcementPreview : null, dismiss: state.dismiss };
} }));
vi.mock("./AnnouncementCard", () => ({ AnnouncementCard: ({ onDismiss }: { onDismiss: () => void }) => <button onClick={onDismiss}>Dismiss fixture</button> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("announcement placement gates", () => {
  let container: HTMLDivElement;
  let root: Root;
  let health: HealthStatus;
  const render = async () => { await act(async () => root.render(<AnnouncementWell health={health} />)); };
  const visible = () => Boolean(container.querySelector('[aria-label="Paperclip announcements"]'));
  beforeEach(() => {
    Object.assign(state, { userId: "alice", settled: true, companyId: "company", loading: false, onboardingOpen: false, toasts: [] });
    vi.clearAllMocks();
    health = { deploymentMode: "authenticated" } as HealthStatus;
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it("waits for identity, company and onboarding, and uses local-board in no-login mode", async () => {
    state.settled = false; await render(); expect(visible()).toBe(false);
    state.settled = true; state.loading = true; await render(); expect(visible()).toBe(false);
    state.loading = false; state.onboardingOpen = true; await render(); expect(visible()).toBe(false);
    state.onboardingOpen = false; await render(); expect(visible()).toBe(true);
    state.userId = null; await render(); expect(visible()).toBe(false);
    health = { deploymentMode: "local_trusted" } as HealthStatus; await render(); expect(visible()).toBe(true);
    expect(state.hook).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "local-board", enabled: true }));
  });
  it("yields to toasts and modal/command dialogs without dismissing", async () => {
    await render(); expect(visible()).toBe(true);
    state.toasts = [{}]; await render(); expect(visible()).toBe(false);
    state.toasts = []; await render(); expect(visible()).toBe(true);
    const dialog = document.createElement("div"); dialog.setAttribute("role", "dialog"); dialog.setAttribute("data-state", "open");
    await act(async () => { document.body.append(dialog); }); expect(visible()).toBe(false);
    await act(async () => { dialog.remove(); }); expect(visible()).toBe(true);
    expect(state.dismiss).not.toHaveBeenCalled();
  });
  it("measures only visible mobile action bars and releases the space when they leave", async () => {
    const width = Object.getOwnPropertyDescriptor(window, "innerWidth");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    let resize = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const bar = document.createElement("footer");
    bar.setAttribute("data-mobile-action-bar", "");
    let barHeight = 73;
    let naturalTop: number | null = null;
    bar.getBoundingClientRect = () => new DOMRect(0, naturalTop ?? (window.innerHeight - 64 - barHeight), 390, barHeight);
    document.body.append(bar);
    const announcement = () => container.querySelector<HTMLElement>(".announcement-well")!;
    const frame = async () => {
      await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
    };
    try {
      await render();
      expect(announcement().dataset.mobileActionArea).toBe("present");
      expect(announcement().style.getPropertyValue("--announcement-action-bar-inset")).toBe("137px");
      barHeight = 112;
      await act(async () => { resize(); });
      await frame();
      expect(announcement().style.getPropertyValue("--announcement-action-bar-inset")).toBe("176px");
      naturalTop = 300;
      await act(async () => { resize(); });
      await frame();
      expect(announcement().style.getPropertyValue("--announcement-action-bar-inset")).toBe(`${window.innerHeight - 300}px`);
      // Reduced motion changes the ancestor offset without transition events.
      naturalTop = 350;
      await act(async () => { document.body.style.setProperty("--mobile-action-bar-bottom", "34px"); });
      expect(announcement().style.getPropertyValue("--announcement-action-bar-inset")).toBe(`${window.innerHeight - 350}px`);
      await act(async () => { bar.remove(); });
      await frame();
      expect(announcement().dataset.mobileActionArea).toBeUndefined();
      expect(announcement().style.getPropertyValue("--announcement-action-bar-inset")).toBe("0px");
      expect(state.dismiss).not.toHaveBeenCalled();
    } finally {
      bar.remove();
      document.body.style.removeProperty("--mobile-action-bar-bottom");
      vi.unstubAllGlobals();
      if (width) Object.defineProperty(window, "innerWidth", width);
    }
  });

});
