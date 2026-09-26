import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { pieceNounPlural, readStageBreakdown } from "./pipeline-breakdown";
import type { PipelineStage } from "../api/pipelines";

describe("pipeline breakdown noun display", () => {
  afterEach(async () => { await i18n.changeLanguage("en"); });

  it("does not add an English suffix to a Chinese display noun", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(pieceNounPlural(" 子项 ")).toBe("子项");
    expect(pieceNounPlural("deliverable")).toBe("deliverable");
    expect(pieceNounPlural("")).toBe("piece");
  });

  it("keeps English plural behavior and responds to language switches", async () => {
    await i18n.changeLanguage("en");
    expect(pieceNounPlural("task")).toBe("tasks");
    expect(pieceNounPlural(" ")).toBe("pieces");
    await i18n.changeLanguage("zh-CN");
    expect(pieceNounPlural("task")).toBe("task");
    await i18n.changeLanguage("en");
    expect(pieceNounPlural("task")).toBe("tasks");
  });

  it("does not rewrite the persisted singular noun when displaying plural copy", async () => {
    const stage = { config: { breakdown: {
      targetPipelineId: "target", targetStageKey: "start", pieceNoun: "子项",
    } } } as unknown as PipelineStage;
    const before = JSON.stringify(stage);
    const config = readStageBreakdown(stage);
    expect(config?.pieceNoun).toBe("子项");
    await i18n.changeLanguage("zh-CN");
    expect(pieceNounPlural(config!.pieceNoun)).toBe("子项");
    expect(JSON.stringify(stage)).toBe(before);
  });
});
