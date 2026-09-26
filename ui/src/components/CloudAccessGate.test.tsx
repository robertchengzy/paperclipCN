// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUiLanguage } from "@/i18n";
import { queryKeys } from "@/lib/queryKeys";
import { useStreamlinedUiEnabled } from "@/hooks/useStreamlinedUiEnabled";
import { useSignOut } from "@/hooks/useSignOut";
import { CloudAccessGate } from "./CloudAccessGate";

const api = vi.hoisted(() => ({
  getSession: vi.fn(), signOut: vi.fn(), health: vi.fn(), settings: vi.fn(), access: vi.fn(), claim: vi.fn(),
}));
vi.mock("@/api/auth", () => ({ authApi: { getSession: api.getSession, signOut: api.signOut } }));
vi.mock("@/api/instanceSettings", () => ({ instanceSettingsApi: { getExperimental: api.settings } }));
vi.mock("@/api/health", () => ({ healthApi: { get: api.health } }));
vi.mock("@/api/access", () => ({ accessApi: { getCurrentBoardAccess: api.access, claimBootstrapAdmin: api.claim } }));
// Keep the real router; company-prefix resolution is unrelated to the gate.
vi.mock("@/lib/router", async () => await import("react-router-dom"));
vi.mock("@/components/AnimatedPaperclipIcon", () => ({ PaperclipLoading: () => <p>Loading</p> }));
vi.mock("@/components/BootstrapPendingPage", () => ({ BootstrapPendingPage: () => <p>Bootstrap pending</p> }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Session = { session: { id: string; userId: string }; user: { id: string; name: string } } | null;
const accountA: Session = { session: { id: "a", userId: "a" }, user: { id: "a", name: "Account A" } };
const accountB: Session = { session: { id: "b", userId: "b" }, user: { id: "b", name: "Account B" } };
const health = { status: "ok", deploymentMode: "authenticated", bootstrapStatus: "ready" };
const access = { isInstanceAdmin: true, companyIds: ["company-a"] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function GateWithLayoutSettings() {
  const { loaded } = useStreamlinedUiEnabled();
  return <CloudAccessGate contentReady={loaded} />;
}

function ProtectedPage() {
  const signOut = useSignOut();
  return <><p>Protected content</p><button onClick={() => signOut.mutate()}>Sign out</button>{signOut.error?.message}</>;
}

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><p>Login page</p><span>{location.search}</span><button onClick={() => navigate("/ACME/issues?tab=active")}>Return</button></>;
}

describe("CloudAccessGate sign-out integration", () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(async () => {
    await setUiLanguage("en");
    vi.resetAllMocks();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    api.health.mockResolvedValue(health);
    api.settings.mockResolvedValue({ enableStreamlinedUi: true });
    client.setQueryData(queryKeys.instance.experimentalSettings, { enableStreamlinedUi: true });
    api.getSession.mockResolvedValue(accountA);
    api.access.mockResolvedValue(access);
    api.signOut.mockResolvedValue({ success: true });
    client.setQueryData(queryKeys.health, health);
    client.setQueryData(queryKeys.auth.session, accountA);
    client.setQueryData(queryKeys.access.currentBoardAccess, access);
    client.setQueryData(queryKeys.issues.list("company-a"), [{ id: "private-a" }]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  async function render() {
    await act(async () => root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/ACME/issues?tab=active"]}>
          <Routes>
            <Route path="/auth" element={<LoginPage />} />
            <Route element={<GateWithLayoutSettings />}>
              <Route path="/ACME/issues" element={<ProtectedPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ));
  }

  async function click(label: string) {
    const button = Array.from(host.querySelectorAll("button")).find((el) => el.textContent === label);
    expect(button).toBeDefined();
    await act(async () => button!.click());
  }

  async function expectText(text: string) {
    await vi.waitFor(async () => {
      // Flush each notification turn before asserting, rather than holding an
      // act scope open while waiting for a router update that it batches.
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(host.textContent).toContain(text);
    });
  }

  it.each(["access-first", "session-first"])("reaches login despite a late access failure (%s)", async (order) => {
    const session = deferred<Session>();
    const board = deferred<typeof access>();
    api.getSession.mockReturnValue(session.promise);
    api.access.mockReturnValue(board.promise);
    await render();
    await click("Sign out");
    await vi.waitFor(() => expect(api.getSession).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(api.access).toHaveBeenCalledOnce());
    if (order === "access-first") {
      await act(async () => board.reject(new Error("Board authentication required")));
      await act(async () => session.resolve(null));
    } else {
      await act(async () => session.resolve(null));
      await expectText("Login page");
      await act(async () => board.reject(new Error("Board authentication required")));
    }
    await expectText("Login page");
    expect(host.textContent).toContain("?next=%2FACME%2Fissues%3Ftab%3Dactive");
    expect(host.textContent).not.toContain("Board authentication required");
    expect(host.textContent).not.toContain("Protected content");
    expect(client.getQueryData(queryKeys.issues.list("company-a"))).toBeUndefined();
    expect(client.getQueryData(queryKeys.auth.session)).toBeNull();

    // A new account must not inherit A's permissions, cached data or errors.
    api.getSession.mockResolvedValue(accountB);
    api.access.mockResolvedValue({ ...access, companyIds: ["company-b"] });
    await act(async () => { await client.fetchQuery({ queryKey: queryKeys.auth.session, queryFn: api.getSession, staleTime: 0 }); });
    await click("Return");
    await expectText("Protected content");
    expect(client.getQueryData(queryKeys.auth.session)).toEqual(accountB);
    expect(client.getQueryData(queryKeys.access.currentBoardAccess)).toEqual({ ...access, companyIds: ["company-b"] });
    expect(client.getQueryData(queryKeys.issues.list("company-a"))).toBeUndefined();
  });

  it("redirects after sign-out while the layout settings refetch stays pending", async () => {
    api.settings.mockReturnValue(new Promise(() => {}));
    api.getSession.mockResolvedValue(null);
    api.access.mockRejectedValue(new Error("Board authentication required"));
    await render();
    await click("Sign out");
    await expectText("Login page");
    expect(api.settings).toHaveBeenCalledOnce();
    expect(host.textContent).not.toContain("Protected content");
  });

  it("waits for layout settings before mounting authenticated content", async () => {
    client.removeQueries({ queryKey: queryKeys.instance.experimentalSettings });
    const settings = deferred<{ enableStreamlinedUi: boolean }>();
    api.settings.mockReturnValue(settings.promise);
    await render();
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Protected content");
    await act(async () => settings.resolve({ enableStreamlinedUi: false }));
    await expectText("Protected content");
  });

  it("keeps an authenticated account and its data when sign-out fails", async () => {
    api.signOut.mockRejectedValue(new Error("Sign-out request failed"));
    await render();
    await click("Sign out");
    await expectText("Sign-out request failed");
    expect(host.textContent).toContain("Protected content");
    expect(host.textContent).not.toContain("Login page");
    expect(client.getQueryData(queryKeys.auth.session)).toEqual(accountA);
    expect(client.getQueryData(queryKeys.issues.list("company-a"))).toEqual([{ id: "private-a" }]);
  });

  it("still surfaces access errors for a signed-in account", async () => {
    client.removeQueries({ queryKey: queryKeys.access.currentBoardAccess });
    api.access.mockRejectedValue(new Error("Access service unavailable"));
    await render();
    await expectText("Access service unavailable");
    expect(host.textContent).not.toContain("Login page");
  });

  it("still shows the no-membership page for a signed-in nonmember", async () => {
    client.setQueryData(queryKeys.access.currentBoardAccess, { isInstanceAdmin: false, companyIds: [] });
    await render();
    expect(host.textContent).not.toContain("Protected content");
    expect(host.textContent).not.toContain("Login page");
    expect(host.textContent).toContain("organization");
  });

  it("keeps bootstrap ahead of login even with an old access error", async () => {
    client.setQueryData(queryKeys.health, { ...health, bootstrapStatus: "bootstrap_pending" });
    client.setQueryData(queryKeys.auth.session, null);
    api.access.mockRejectedValue(new Error("Board authentication required"));
    await client.fetchQuery({ queryKey: queryKeys.access.currentBoardAccess, queryFn: api.access, staleTime: 0 }).catch(() => {});
    await render();
    expect(host.textContent).toContain("Bootstrap pending");
    expect(host.textContent).not.toContain("Board authentication required");
  });

  it("ignores old account-access errors in local trusted mode", async () => {
    client.setQueryData(queryKeys.health, { ...health, deploymentMode: "local_trusted" });
    api.access.mockRejectedValue(new Error("Board authentication required"));
    await client.fetchQuery({ queryKey: queryKeys.access.currentBoardAccess, queryFn: api.access, staleTime: 0 }).catch(() => {});
    await render();
    expect(host.textContent).toContain("Protected content");
  });
});
