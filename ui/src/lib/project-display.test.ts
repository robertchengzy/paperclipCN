import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { projectDisplayName } from "./project-display";
import { formatActivityVerb, formatIssueActivityAction, formatActivityEntityType } from "./activity-format";
import { buildCompanyUserProfileMap } from "./company-members";

afterEach(async () => { await i18n.changeLanguage("en"); });
describe("display-only Chinese labels", () => {
  it("changes known labels at call time and preserves custom names", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(projectDisplayName("Onboarding")).toBe("入门引导");
    expect(projectDisplayName("My Onboarding")).toBe("My Onboarding");
    expect(projectDisplayName("onboarding")).toBe("onboarding");
    expect(formatActivityVerb("agent.permissions_updated")).toBe("更新了智能体权限");
    expect(formatIssueActivityAction("decision_queue.created")).toBe("创建了决策队列");
    expect(formatActivityEntityType("instance_settings", "instance.settings.general_updated")).toBeNull();
    expect(formatActivityVerb("unknown.new_event")).toBe("unknown new event");
    expect(formatActivityVerb("toString")).toBe("toString");
    expect(formatActivityEntityType("future_entity", "unknown.event")).toBe("future_entity");
    await i18n.changeLanguage("en");
    expect(projectDisplayName("Onboarding")).toBe("Onboarding");
    expect(formatActivityVerb("agent.permissions_updated")).toBe("agent permissions updated");
  });
  it("separates a person's fallback name from the governing board", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("app.common.nouns.board")).toBe("董事会");
    expect(buildCompanyUserProfileMap([{ principalId: "local-board", status: "active", user: null }]).get("local-board")?.label).toBe("董事会成员");
  });
});
