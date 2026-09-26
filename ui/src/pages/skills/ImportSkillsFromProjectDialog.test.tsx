// @vitest-environment jsdom

import type {
  CompanySkillProjectScanCandidate,
  Project,
  ProjectWorkspace,
} from "@paperclipai/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  skillImportErrorCopy,
  defaultSelection,
  filterCandidates,
  groupCandidates,
  isScannableWorkspace,
  isSelectableCandidate,
  isValidSelectionSlug,
  scannableWorkspaces,
  selectAllSelection,
  selectionKey,
  suggestedConflictSlug,
} from "./ImportSkillsFromProjectDialog";

import { i18n } from "@/i18n";
import { ApiError } from "../../api/client";

const WS_A = "11111111-1111-1111-1111-111111111111";
const WS_B = "22222222-2222-2222-2222-222222222222";

function candidate(
  overrides: Partial<CompanySkillProjectScanCandidate> &
    Pick<CompanySkillProjectScanCandidate, "slug" | "relativePath" | "status">,
): CompanySkillProjectScanCandidate {
  return {
    name: overrides.slug,
    description: null,
    workspaceId: WS_A,
    workspaceName: "Workspace A",
    projectId: "33333333-3333-3333-3333-333333333333",
    projectName: "Project",
    directoryRoot: ".claude/skills",
    ...overrides,
  } as CompanySkillProjectScanCandidate;
}

/**
 * A mixed candidate set: two new skills, one selectable conflict, and two
 * disabled statuses.
 */
function mixedCandidates(): CompanySkillProjectScanCandidate[] {
  return [
    candidate({ slug: "alpha", relativePath: ".claude/skills/alpha", status: "new" }),
    candidate({ slug: "beta", relativePath: ".claude/skills/beta", status: "new" }),
    candidate({
      slug: "gamma",
      relativePath: ".claude/skills/gamma",
      status: "already_imported",
      existingSkillId: "44444444-4444-4444-4444-444444444444",
    }),
    candidate({
      slug: "delta",
      relativePath: ".claude/skills/delta",
      status: "conflict",
      reason: "Slug delta is already in use.",
    }),
    candidate({
      slug: "epsilon",
      relativePath: ".claude/skills/epsilon",
      status: "skipped",
      reason: "Could not parse SKILL.md.",
    }),
  ];
}

describe("ImportSkillsFromProjectDialog selection logic", () => {
  it("new and conflict candidates are selectable", () => {
    const candidates = mixedCandidates();
    const selectable = candidates.filter(isSelectableCandidate);
    expect(selectable.map((c) => c.slug)).toEqual(["alpha", "beta", "delta"]);
  });

  it("default selection leaves every candidate unchecked", () => {
    expect(defaultSelection(mixedCandidates())).toEqual(new Map());
  });

  it("select all checks new candidates and leaves conflicts unchecked", () => {
    const candidates = mixedCandidates();
    const selectAll = selectAllSelection(candidates);
    const defaultChecked = candidates.filter((candidate) => candidate.status === "new");
    expect(selectAll.size).toBe(defaultChecked.length);
    for (const c of defaultChecked) {
      expect(selectAll.has(selectionKey(c.workspaceId, c.relativePath))).toBe(true);
    }
    expect(selectAll.has(selectionKey(WS_A, ".claude/skills/delta"))).toBe(false);
  });

  it("deselect all yields an empty selection (N = 0)", () => {
    const deselectAll = new Map<string, { workspaceId: string; path: string }>();
    expect(deselectAll.size).toBe(0);
  });

  it("selection payload carries workspaceId + path for each checked new candidate", () => {
    const selection = selectAllSelection(mixedCandidates());
    const payload = Array.from(selection.values());
    expect(payload).toEqual([
      { workspaceId: WS_A, path: ".claude/skills/alpha" },
      { workspaceId: WS_A, path: ".claude/skills/beta" },
    ]);
  });

  it("toggling a single new candidate removes only that row from N", () => {
    const selection = selectAllSelection(mixedCandidates());
    const key = selectionKey(WS_A, ".claude/skills/alpha");
    selection.delete(key);
    expect(selection.size).toBe(1);
    expect(selection.has(key)).toBe(false);
    expect(selection.has(selectionKey(WS_A, ".claude/skills/beta"))).toBe(true);
  });

  it("groups folders beneath each workspace and sorts the primary workspace first", () => {
    const candidates = [
      candidate({ slug: "a", relativePath: ".claude/skills/a", status: "new" }),
      candidate({
        slug: "b",
        relativePath: "skills/b",
        directoryRoot: "skills",
        status: "new",
      }),
      candidate({
        slug: "c",
        relativePath: ".claude/skills/c",
        workspaceId: WS_B,
        workspaceName: "Workspace B",
        status: "new",
      }),
    ];
    const groups = groupCandidates(candidates, [
      workspace({ id: WS_A, name: "Workspace A", isPrimary: false }),
      workspace({ id: WS_B, name: "Workspace B", isPrimary: true }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.workspaceName)).toEqual(["Workspace B", "Workspace A"]);
    expect(groups[1]?.directories.map((directory) => directory.directoryRoot)).toEqual([
      ".claude/skills",
      "skills",
    ]);
  });

  it("filters candidates by name, slug, path, workspace, and status", () => {
    const candidates = mixedCandidates();
    expect(filterCandidates(candidates, "DELTA").map((entry) => entry.slug)).toEqual(["delta"]);
    expect(filterCandidates(candidates, "already_imported").map((entry) => entry.slug)).toEqual(["gamma"]);
    expect(filterCandidates(candidates, ".claude/skills/epsilon").map((entry) => entry.slug)).toEqual(["epsilon"]);
    expect(filterCandidates(candidates, "workspace a")).toHaveLength(candidates.length);
  });

  it("suggests and validates a URL-safe rename for conflicts", () => {
    const conflict = mixedCandidates().find((entry) => entry.status === "conflict")!;
    expect(suggestedConflictSlug(conflict)).toBe("delta-copy");
    expect(isValidSelectionSlug({ workspaceId: WS_A, path: conflict.relativePath, slug: "delta-copy" })).toBe(true);
    expect(isValidSelectionSlug({ workspaceId: WS_A, path: conflict.relativePath, slug: "Delta Copy" })).toBe(false);
    expect(isValidSelectionSlug({ workspaceId: WS_A, path: conflict.relativePath, slug: "" })).toBe(false);
  });
});

function workspace(overrides: Partial<ProjectWorkspace>): ProjectWorkspace {
  return {
    id: WS_A,
    companyId: "c",
    projectId: "p",
    name: "ws",
    sourceType: "local_path",
    cwd: "/srv/project",
    repoUrl: null,
    repoRef: null,
    defaultRef: null,
    visibility: "default",
    setupCommand: null,
    cleanupCommand: null,
    remoteProvider: null,
    remoteWorkspaceRef: null,
    sharedWorkspaceKey: null,
    metadata: null,
    runtimeConfig: null,
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProjectWorkspace;
}

describe("scannable workspace detection", () => {
  it("local/git/folder workspaces with a cwd are scannable", () => {
    expect(isScannableWorkspace(workspace({ sourceType: "local_path" }))).toBe(true);
    expect(isScannableWorkspace(workspace({ sourceType: "git_repo" }))).toBe(true);
    expect(isScannableWorkspace(workspace({ sourceType: "non_git_path" }))).toBe(true);
  });

  it("remote-managed workspaces are never scannable", () => {
    expect(
      isScannableWorkspace(workspace({ sourceType: "remote_managed", cwd: null })),
    ).toBe(false);
  });

  it("workspaces without a cwd are not scannable", () => {
    expect(isScannableWorkspace(workspace({ cwd: null }))).toBe(false);
    expect(isScannableWorkspace(workspace({ cwd: "   " }))).toBe(false);
  });

  it("a remote-only project has zero scannable workspaces", () => {
    const project = {
      workspaces: [
        workspace({ id: WS_A, sourceType: "remote_managed", cwd: null }),
        workspace({ id: WS_B, sourceType: "remote_managed", cwd: null }),
      ],
    } as unknown as Project;
    expect(scannableWorkspaces(project)).toHaveLength(0);
  });
});


describe("skill import denial copy", () => {
  afterEach(async () => { await i18n.changeLanguage("en"); });

  it("uses policy remediation instead of asking for a legacy skills grant", async () => {
    await i18n.changeLanguage("zh-CN");
    const copy = skillImportErrorCopy(new ApiError("Forbidden", 403, {
      code: "skill_policy_denied",
      remediation: "Contact a company administrator to change the skill policy.",
    }));
    expect(copy.restricted).toBe(true);
    expect(copy.title).toBe("此操作受组织策略限制。");
    expect(copy.message).toBe("组织管理员可以修改技能策略以允许此操作。");
  });

  it("explains workspace boundaries instead of asking an owner to grant access", async () => {
    await i18n.changeLanguage("zh-CN");
    const copy = skillImportErrorCopy(new ApiError("Forbidden", 403, {
      code: "skill_workspace_boundary_denied",
      remediation: "Import from a configured Paperclip workspace or the company managed-skill directory.",
    }));
    expect(copy.restricted).toBe(true);
    expect(copy.title).toBe("此技能来源不在允许的工作区内。");
    expect(copy.message).toContain("已配置的 Paperclip 工作区");
    expect(copy.message).not.toContain("授予");
  });

  it.each([403, 409, 500])("retains unknown %s diagnostics and the retry path", async (status) => {
    await i18n.changeLanguage("zh-CN");
    const copy = skillImportErrorCopy(new ApiError("Custom service diagnostic", status, {}));
    expect(copy).toEqual({ restricted: false, title: "扫描失败", message: "Custom service diagnostic" });
  });

  it("keeps known platform restrictions distinct in English too", async () => {
    await i18n.changeLanguage("en");
    const copy = skillImportErrorCopy(new ApiError("Forbidden", 403, { code: "skill_unsafe_content_blocked" }));
    expect(copy.restricted).toBe(true);
    expect(copy.message).toContain("unsafe pattern");
    expect(copy.message).not.toContain("grant");
  });
});
