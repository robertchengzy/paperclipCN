import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOOL_CONNECTION_HEALTH_STATUSES, TOOL_POLICY_DECISIONS, TOOL_RISK_LEVELS } from "@paperclipai/shared";
import { i18n } from "@/i18n";
import { CapabilityBadges, DecisionBadge, HealthBadge, RelativeTime, RiskBadge } from "./shared";

afterEach(async () => {
  vi.useRealTimers();
  await i18n.changeLanguage("en");
});

describe("tool badge localization", () => {
  it("translates every supported risk, connection health and policy decision", async () => {
    await i18n.changeLanguage("zh-CN");
    const risks = { low: "低", medium: "中", high: "高", critical: "严重", read: "读取", write: "写入", destructive: "破坏性操作" };
    const health = { unknown: "未知", healthy: "健康", degraded: "性能下降", failed: "失败", unchecked: "未检查", ok: "正常", error: "出错", missing_secret: "缺少密钥" };
    const decisions = { allow: "已允许", deny: "已拒绝", require_approval: "需要审批", rate_limited: "已限流", defer_runtime: "等待运行时处理" };
    for (const risk of TOOL_RISK_LEVELS) expect(renderToStaticMarkup(<RiskBadge risk={risk} />)).toContain(`>${risks[risk]}<`);
    for (const status of TOOL_CONNECTION_HEALTH_STATUSES) expect(renderToStaticMarkup(<HealthBadge status={status} />)).toContain(`>${health[status]}<`);
    for (const decision of TOOL_POLICY_DECISIONS) expect(renderToStaticMarkup(<DecisionBadge decision={decision} />)).toContain(`>${decisions[decision]}<`);
    expect(renderToStaticMarkup(<RiskBadge risk={null} />)).toContain(">未知<");
    const capabilities = renderToStaticMarkup(<CapabilityBadges isReadOnly isWrite isDestructive />);
    for (const label of ["只读", "写入", "破坏性操作"]) expect(capabilities).toContain(`>${label}<`);
  });

  it("preserves unknown diagnostic values and caller-supplied health labels", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(renderToStaticMarkup(<RiskBadge risk={"future_risk" as never} />)).toContain(">future_risk<");
    expect(renderToStaticMarkup(<HealthBadge status="future_health" />)).toContain(">future_health<");
    expect(renderToStaticMarkup(<HealthBadge status="healthy" label="Custom health detail" />)).toContain(">Custom health detail<");
    expect(renderToStaticMarkup(<DecisionBadge decision="future_decision" />)).toContain(">future_decision<");
  });

  it("uses the current language on each render and preserves English labels", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(renderToStaticMarkup(<DecisionBadge decision="require_approval" />)).toContain(">需要审批<");
    await i18n.changeLanguage("en");
    expect(renderToStaticMarkup(<DecisionBadge decision="require_approval" />)).toContain(">require approval<");
    expect(renderToStaticMarkup(<HealthBadge status="missing_secret" />)).toContain(">missing_secret<");
    expect(renderToStaticMarkup(<RiskBadge risk="critical" />)).toContain(">critical<");
  });
});

describe("tool relative time", () => {
  it("uses Chinese units for past and future and a locale-aware tooltip", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T08:30:00Z"));
    await i18n.changeLanguage("zh-CN");
    const past = new Date(Date.now() - 120_000);
    const markup = renderToStaticMarkup(<RelativeTime value={past} />);
    expect(markup).toContain(">2 分钟 前<");
    expect(markup).toContain(`title="${past.toLocaleString("zh-CN")}"`);
    expect(renderToStaticMarkup(<RelativeTime value={new Date(Date.now() + 7_200_000)} />)).toContain(">2 小时 后<");
    expect(renderToStaticMarkup(<RelativeTime value={new Date(Date.now() - 172_800_000)} />)).toContain(">2 天 前<");
    await i18n.changeLanguage("en");
    expect(renderToStaticMarkup(<RelativeTime value={past} />)).toContain(">2m ago<");
  });

  it("retains empty and invalid time fallbacks", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(renderToStaticMarkup(<RelativeTime value={null} />)).toContain(">从未<");
    expect(renderToStaticMarkup(<RelativeTime value="invalid-date" />)).toContain(">—<");
  });
});
