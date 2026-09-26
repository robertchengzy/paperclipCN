// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { queryKeys } from "../lib/queryKeys";
import {
  SecretBindingPicker,
  SecretRefHintsContext,
  type SecretRefHintsContextValue,
} from "./SecretBindingPicker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockSecretsApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../api/secrets", () => ({
  secretsApi: mockSecretsApi,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

describe("SecretBindingPicker", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockSecretsApi.list.mockReset();
    mockSecretsApi.list.mockResolvedValue([]);
  });

  afterEach(async () => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    queryClient.clear();
    await i18n.changeLanguage("en");
  });

  async function render(context: SecretRefHintsContextValue | undefined) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <SecretRefHintsContext.Provider value={context}>
            <SecretBindingPicker
              value={{ secretId: "22222222-2222-2222-2222-222222222222" }}
              onChange={() => {}}
            />
          </SecretRefHintsContext.Provider>
        </QueryClientProvider>,
      );
    });
    // Let the secrets query settle so selectedMissing is based on real data.
    await act(async () => {
      await Promise.resolve();
    });
  }

  function readyContext(status: string): SecretRefHintsContextValue {
    return {
      status: "ready",
      hints: {
        "22222222-2222-2222-2222-222222222222": {
          name: "DAYTONA_API_KEY",
          status,
          companyId: "company-2",
          companyName: "Other Team",
        },
      },
    };
  }

  it("names an active cross-company secret and its owner instead of calling it missing", async () => {
    await render(readyContext("active"));

    expect(container.textContent).toContain("DAYTONA_API_KEY — Other Team");
    expect(container.textContent).toContain("Owned by the Other Team organization");
    expect(container.textContent).not.toContain("Missing secret");
    expect(container.querySelector("select")?.className).not.toContain("border-destructive");
  });

  it("reports a deleted hinted secret as deleted", async () => {
    await render(readyContext("deleted"));

    expect(container.textContent).toContain("DAYTONA_API_KEY — Other Team");
    expect(container.textContent).toContain("was deleted");
    expect(container.querySelector("select")?.className).toContain("border-destructive");
  });

  it("does not present a disabled cross-company secret as working", async () => {
    await render(readyContext("disabled"));

    expect(container.textContent).toContain("DAYTONA_API_KEY — Other Team");
    expect(container.textContent).toContain("This secret is disabled");
    expect(container.textContent).not.toContain("keeps working");
    expect(container.querySelector("select")?.className).toContain("border-destructive");
  });

  it.each([
    ["disabled", "已停用"],
    ["archived", "已归档"],
    ["future_status", "future_status"],
  ])("localizes the %s hint while preserving unknown status codes and secret identities", async (status, label) => {
    const context = readyContext(status);
    await render(context);
    expect(container.textContent).toContain(`This secret is ${status}`);
    await act(async () => { await i18n.changeLanguage("zh-CN"); });
    expect(container.textContent).toContain(`此密钥状态为 ${label}`);
    expect(container.textContent).toContain("DAYTONA_API_KEY — Other Team");
    expect(container.querySelector("select")?.className).toContain("border-destructive");
    expect(context.hints["22222222-2222-2222-2222-222222222222"].status).toBe(status);
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(container.textContent).toContain(`This secret is ${status}`);
  });

  it("localizes an existing inactive selection while retaining the credential key", async () => {
    const secretId = "22222222-2222-2222-2222-222222222222";
    const secrets = [{ id: secretId, name: "credential_name", key: "credential_key", status: "disabled", provider: "local_encrypted", latestVersion: 1 }];
    mockSecretsApi.list.mockResolvedValue(secrets);
    queryClient.setQueryData(queryKeys.secrets.list("company-1"), secrets);
    await render(undefined);
    expect(container.textContent).toContain("disabled");
    await act(async () => { await i18n.changeLanguage("zh-CN"); });
    expect(container.textContent).toContain("已停用");
    expect(container.textContent).toContain("credential_key");
    expect(mockSecretsApi.create).not.toHaveBeenCalled();
  });

  it("stays neutral while descriptors are loading", async () => {
    await render({ status: "loading", hints: {} });

    expect(container.textContent).toContain("Checking this secret reference");
    expect(container.textContent).not.toContain("Missing secret");
    expect(container.querySelector("select")?.className).not.toContain("border-destructive");
  });

  it("stays neutral when the descriptor lookup failed", async () => {
    await render({ status: "error", hints: {} });

    expect(container.textContent).toContain("Could not load this secret reference");
    expect(container.textContent).not.toContain("Missing secret");
    expect(container.querySelector("select")?.className).not.toContain("border-destructive");
  });

  it("treats an unknown id as missing once descriptors are ready", async () => {
    await render({ status: "ready", hints: {} });

    expect(container.textContent).toContain("Missing secret");
    expect(container.textContent).toContain("no longer available");
    expect(container.querySelector("select")?.className).toContain("border-destructive");
  });

  it("keeps the generic missing-secret treatment when no hint context exists", async () => {
    await render(undefined);

    expect(container.textContent).toContain("Missing secret");
    expect(container.textContent).toContain("no longer available");
    expect(container.querySelector("select")?.className).toContain("border-destructive");
  });
});
