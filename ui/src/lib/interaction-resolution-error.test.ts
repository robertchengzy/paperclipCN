import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { ApiError } from "../api/client";
import {
  describeInteractionResolutionFailure,
  interactionResolutionErrorCode,
  interactionResolutionErrorMessage,
  isInteractionAudienceDenial,
} from "./interaction-resolution-error";

const addressedAudience = { shortSummary: "Only CodexCoder or the board can respond", isOpen: false };
const humanOnlyAudience = { shortSummary: "Only the board can respond", isOpen: false };
const openAudience = { shortSummary: "Anyone can respond", isOpen: true };

afterEach(async () => { await i18n.changeLanguage("en"); });

/** Shapes an `ApiError` the way `errorHandler` serializes an `HttpError`. */
function denial(status: number, code: string, message: string) {
  return new ApiError(message, status, { error: message, code, details: { code } });
}

describe("interactionResolutionErrorCode", () => {
  it("reads the top-level code the API returns", () => {
    expect(interactionResolutionErrorCode(denial(403, "interaction_human_only", "human-only"))).toBe(
      "interaction_human_only",
    );
  });

  it("falls back to the code nested in details", () => {
    const error = new ApiError("nope", 403, { error: "nope", details: { code: "interaction_addressee_mismatch" } });
    expect(interactionResolutionErrorCode(error)).toBe("interaction_addressee_mismatch");
  });

  it("returns null for an error with no structured body", () => {
    expect(interactionResolutionErrorCode(new Error("network down"))).toBeNull();
  });
});

describe("isInteractionAudienceDenial", () => {
  it("recognizes every audience denial code the evaluator can return", () => {
    for (const code of [
      "interaction_human_only",
      "interaction_creator_excluded",
      "interaction_addressee_mismatch",
      "interaction_governed_action_denied",
      "interaction_run_attribution_required",
      "interaction_scope_denied",
    ]) {
      expect(isInteractionAudienceDenial(denial(403, code, "denied"))).toBe(true);
    }
  });

  it("treats an uncoded 403 as an authorization refusal", () => {
    expect(isInteractionAudienceDenial(new ApiError("Forbidden", 403, { error: "Forbidden" }))).toBe(true);
  });

  it("does not treat a server fault or a settled card as an audience denial", () => {
    expect(isInteractionAudienceDenial(new ApiError("boom", 500, { error: "boom" }))).toBe(false);
    expect(isInteractionAudienceDenial(denial(409, "interaction_already_resolved", "already resolved"))).toBe(false);
  });
});

describe("describeInteractionResolutionFailure", () => {
  it("keeps the server denial reason and names who can respond", () => {
    const failure = describeInteractionResolutionFailure(
      denial(403, "interaction_human_only", "This issue-thread interaction is human-only"),
      humanOnlyAudience,
    );

    expect(failure.kind).toBe("audience_denied");
    expect(failure.code).toBe("interaction_human_only");
    expect(failure.message).toBe(
      "This issue-thread interaction is human-only. Only the board can respond.",
    );
    // A policy denial is permanent: never invite a retry that will fail again.
    expect(failure.message).not.toMatch(/try again/i);
  });

  it("names the addressed responder for an addressee mismatch", () => {
    expect(
      interactionResolutionErrorMessage(
        denial(
          403,
          "interaction_addressee_mismatch",
          "Only the addressed agent or an authorized human may resolve this issue-thread interaction",
        ),
        addressedAudience,
      ),
    ).toContain("Only CodexCoder or the board can respond.");
  });

  it("still explains a denial when no audience is known", () => {
    const failure = describeInteractionResolutionFailure(
      denial(403, "interaction_creator_excluded", "This issue-thread interaction requires a resolver other than its creator"),
      null,
    );

    expect(failure.message).toBe(
      "This issue-thread interaction requires a resolver other than its creator.",
    );
    expect(failure.message).not.toMatch(/try again/i);
  });

  // PAP-17289: the responder clause explains a denial, so it must never
  // contradict it. An open card has no narrower audience to point at.
  it("does not append the open-default clause to a refusal it would refute", () => {
    const failure = describeInteractionResolutionFailure(
      denial(
        403,
        "interaction_addressee_mismatch",
        "Only the addressed agent can resolve this interaction",
      ),
      openAudience,
    );

    expect(failure.kind).toBe("audience_denied");
    expect(failure.message).toBe("Only the addressed agent can resolve this interaction.");
    expect(failure.message).not.toMatch(/anyone can respond/i);
  });

  it("keeps the server's own text for an uncoded 403 instead of inventing a cause", () => {
    const failure = describeInteractionResolutionFailure(
      new ApiError("Forbidden", 403, { error: "Forbidden" }),
      openAudience,
    );

    expect(failure).toMatchObject({ kind: "audience_denied", code: null, message: "Forbidden." });
    expect(failure.message).not.toMatch(/resolver audience/i);
    expect(failure.message).not.toMatch(/try again/i);
  });

  it("restates the refusal without claiming an audience cause when a 403 says nothing", () => {
    const failure = describeInteractionResolutionFailure(new ApiError("", 403, null), null);

    expect(failure.message).toBe("You do not have permission to respond to this card.");
    expect(failure.message).not.toMatch(/resolver audience/i);
  });

  it("does not ask for a retry when the card has already moved on", () => {
    const failure = describeInteractionResolutionFailure(
      denial(409, "interaction_superseded", "This confirmation was superseded by a newer request"),
      humanOnlyAudience,
    );

    expect(failure.kind).toBe("settled");
    expect(failure.message).toBe("This confirmation was superseded by a newer request.");
    expect(failure.message).not.toMatch(/try again/i);
  });

  it("keeps the retry prompt for a genuinely transient failure", () => {
    expect(
      describeInteractionResolutionFailure(new ApiError("Request failed: 503", 503, null), humanOnlyAudience),
    ).toMatchObject({ kind: "transient", message: "Request failed: 503. Try again." });
  });

  it("falls back to generic copy when nothing explains the failure", () => {
    expect(describeInteractionResolutionFailure(undefined, null)).toMatchObject({
      kind: "transient",
      message: "Couldn't submit. Try again.",
    });
  });

  it("leaves punctuation the server already wrote alone", () => {
    expect(
      interactionResolutionErrorMessage(denial(403, "interaction_human_only", "Agents cannot resolve this."), null),
    ).toBe("Agents cannot resolve this.");
  });

  it("does not invite retries for a review-policy refusal", () => {
    const failure = describeInteractionResolutionFailure(
      denial(403, "review_policy_denied", "A different writer must approve this request"),
    );
    expect(failure.kind).toBe("audience_denied");
    expect(failure.message).toBe("A different writer must approve this request.");
  });

  it.each([
    ["interaction_human_only", 403, "此交互仅允许人工回复。"],
    ["interaction_creator_excluded", 403, "此交互必须由创建者或创建它的运行之外的人员或智能体处理。"],
    ["interaction_addressee_mismatch", 403, "你不符合此交互指定的回复者要求。"],
    ["interaction_governed_action_denied", 403, "此交互关联的受管控操作需要单独授权。"],
    ["interaction_run_attribution_required", 422, "回复此交互需要有效且已通过身份验证的智能体运行。"],
    ["interaction_scope_denied", 403, "你没有处理此交互的访问权限。"],
    ["review_policy_denied", 403, "审核策略不允许你批准或拒绝此请求。"],
    ["interaction_not_found", 404, "找不到此交互。"],
    ["interaction_already_resolved", 409, "此交互已处理。"],
    ["interaction_superseded", 409, "此交互已被后续请求或回复取代。"],
    ["interaction_stale_target", 409, "此交互指向的目标已失效。"],
    ["interaction_issue_closed", 409, "任务已关闭，无法再处理此交互。"],
  ])("explains %s in Chinese while retaining the server diagnostic", async (code, status, expected) => {
    await i18n.changeLanguage("zh-CN");
    const failure = describeInteractionResolutionFailure(denial(Number(status), String(code), "Original server diagnostic"));
    expect(failure.code).toBe(code);
    expect(failure.message.startsWith(String(expected))).toBe(true);
    expect(failure.message).toContain("（服务端诊断：Original server diagnostic.）");
    expect(failure.message).not.toMatch(/重试|try again/i);
  });

  it("retains unknown server reasons without inventing a localized cause", async () => {
    await i18n.changeLanguage("zh-CN");
    const failure = describeInteractionResolutionFailure(denial(503, "new_backend_error", "New backend diagnostic"));
    expect(failure.message).toBe("New backend diagnostic. 请重试。");
    expect(failure.code).toBe("new_backend_error");
  });
});
