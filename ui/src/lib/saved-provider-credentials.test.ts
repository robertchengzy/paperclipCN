import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import type { AiManagedConnectionSummary, CompanySecret } from "@paperclipai/shared";
import type { MyUserSecretEntry } from "../api/secrets";
import {
  savedProviderKeys,
  savedCodexSubscriptions,
  savedManagedProviderAccounts,
} from "./saved-provider-credentials";

afterEach(async () => { await i18n.changeLanguage("en"); });
const secret = (overrides = {}) =>
  ({
    id: "s1",
    companyId: "c1",
    key: "ANTHROPIC_API_KEY",
    name: "Claude",
    scope: "company",
    status: "active",
    ...overrides,
  }) as CompanySecret;
const personal = (key = "ANTHROPIC_API_KEY.setup.abc", overrides = {}) =>
  ({
    definition: {
      id: "d1",
      companyId: "c1",
      key,
      name: "My Claude",
      status: "active",
      ...overrides,
    },
    secret: secret({ scope: "user" }),
  }) as MyUserSecretEntry;
describe("saved provider keys", () => {
  it("localizes labels without changing credential names or bindings", async () => {
    const inputs = [personal("ANTHROPIC_API_KEY.setup.abc", { name: "my_key" })];
    const english = savedProviderKeys("c1", "ANTHROPIC_API_KEY", inputs, [secret()]);
    await i18n.changeLanguage("zh-CN");
    const chinese = savedProviderKeys("c1", "ANTHROPIC_API_KEY", inputs, [secret()]);
    expect(chinese.map(({ label }) => label)).toEqual(["my_key（你的密钥）", "Claude（组织密钥）"]);
    expect(chinese.map(({ binding }) => binding)).toEqual(english.map(({ binding }) => binding));
    expect(savedCodexSubscriptions("c1", [secret({ name: "CODEX_HOME_team" })])[0].label).toBe("ChatGPT 账户 · team");
  });

  it("localizes managed account ownership without changing account selection", async () => {
    const shared = { id: "connection-1", grantId: "grant-1", companyId: "c1", provider: "openai", status: "connected", ownership: "shared", name: "Shared_team", method: "api_key" } as AiManagedConnectionSummary;
    const accounts = [shared, { ...shared, id: "connection-2", grantId: "grant-2", ownership: "personal", ownerUserId: "user-1", isDefault: true, name: "Personal_team" } as AiManagedConnectionSummary];
    const english = savedManagedProviderAccounts("c1", "openai", "user-1", accounts);
    await i18n.changeLanguage("zh-CN");
    const chinese = savedManagedProviderAccounts("c1", "openai", "user-1", accounts);
    expect(chinese.map(({ label }) => label)).toEqual(["Shared_team（组织共享）", "Personal_team（你的默认账户）"]);
    expect(chinese.map(({ aiConnection }) => aiConnection)).toEqual(english.map(({ aiConnection }) => aiConnection));
  });
  it("reuses canonical and setup keys with references, including normalized organization keys", () => {
    expect(
      savedProviderKeys(
        "c1",
        "ANTHROPIC_API_KEY",
        [personal()],
        [secret({ key: "anthropic_api_key" })],
      ),
    ).toEqual([
      {
        id: "user:d1",
        label: "My Claude (Your key)",
        binding: {
          type: "user_secret_ref",
          key: "ANTHROPIC_API_KEY.setup.abc",
          version: "latest",
        },
      },
      {
        id: "company:s1",
        label: "Claude (Organization key)",
        binding: { type: "secret_ref", secretId: "s1", version: "latest" },
      },
    ]);
  });
  it("excludes unavailable, wrong-provider, and foreign-company credentials", () => {
    expect(
      savedProviderKeys(
        "c1",
        "ANTHROPIC_API_KEY",
        [
          personal("OPENAI_API_KEY"),
          personal(undefined, { status: "disabled" }),
          { ...personal(), secret: null },
          { ...personal(), secret: secret({ status: "archived" }) },
          personal(undefined, { companyId: "c2" }),
        ],
        [
          secret({ companyId: "c2" }),
          secret({ status: "disabled" }),
          secret({ scope: "user" }),
          secret({ key: "ANTHROPIC_API_KEY_OTHER" }),
        ],
      ),
    ).toEqual([]);
  });
});

it("lists only active company Codex account connections", () => {
  const account = secret({ name: "CODEX_HOME_team" });
  expect(
    savedCodexSubscriptions("c1", [
      account,
      { ...account, status: "disabled" },
      { ...account, companyId: "c2" },
      secret(),
    ]),
  ).toEqual([
    {
      id: "company:s1",
      label: "ChatGPT account · team",
      binding: { type: "secret_ref", secretId: "s1", version: "latest" },
    },
  ]);
});
