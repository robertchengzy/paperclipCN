import type {
  WorkspaceOperation,
  WorkspaceReadiness,
  WorkspaceReadinessState,
  WorkspaceRuntimeService,
} from "@paperclipai/shared";
import { t } from "@/i18n";

/**
 * Derives the workspace access state the UI shows (PAP-17572).
 *
 * The board cannot read a cloned workspace's protected health directly, so state
 * comes from three server-side facts it *can* see: the live runtime rows, the
 * workspace operation log, and the readiness the control plane reported when it
 * last tried to mint a login handoff.
 *
 * Every state carries one concrete next action. The failure this replaces was a
 * generic "Load failed" (or worse, a green badge) that told an operator nothing
 * about whether to wait, start, repair, or read a log.
 */

export type WorkspaceAccessActionKind =
  | "open"
  | "start"
  | "repair"
  | "view_logs"
  /** Nothing to do but wait for a running operation. */
  | "wait";

export type WorkspaceAccessAction = {
  kind: WorkspaceAccessActionKind;
  label: string;
};

export type WorkspaceAccessNotice = {
  title: string;
  description: string;
  action: WorkspaceAccessAction;
};

export type WorkspaceAccessDisplayState = WorkspaceReadinessState | "stopped";

export type WorkspaceAccessState = {
  state: WorkspaceAccessDisplayState;
  title: string;
  description: string;
  action: WorkspaceAccessAction;
  /** True when a password-independent handoff is the expected way in. */
  handoffAvailable: boolean;
  /** A non-blocking historical failure that is still useful to inspect. */
  secondaryNotice?: WorkspaceAccessNotice;
};

/** What the control plane said the last time a handoff was requested. */
export type WorkspaceLoginHandoffFailureInfo = {
  reason: string;
  detail?: string | null;
  readiness?: WorkspaceReadiness | null;
};

function latestOperation(operations: WorkspaceOperation[], phase: WorkspaceOperation["phase"]) {
  return operations.find((operation) => operation.phase === phase) ?? null;
}

function describeSeedPhase(readiness: WorkspaceReadiness | null | undefined): string | null {
  if (!readiness?.failurePhase && !readiness?.seedPhase) return null;
  return readiness.failurePhase ?? readiness.seedPhase ?? null;
}

function timestampMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function failedRepairNotice(repair: WorkspaceOperation): WorkspaceAccessNotice {
  const phase = typeof repair.metadata?.repairPhase === "string" ? repair.metadata.repairPhase : null;
  return {
    title: t("app.issueDetail.toasts.repairFailed"),
    description: phase
      ? t("app.workspaces.workspaceAccessState.repairStoppedDuring", { phase })
      : t("app.workspaces.workspaceAccessState.repairStopped"),
    action: { kind: "view_logs", label: t("app.workspaces.workspaceAccessState.viewRepairLog") },
  };
}

function failedProvisionNotice(provision: WorkspaceOperation): WorkspaceAccessNotice {
  const phase = typeof provision.metadata?.seedFailurePhase === "string"
    ? provision.metadata.seedFailurePhase
    : null;
  return {
    title: t("app.workspaces.workspaceAccessState.provisioningFailed"),
    description: phase
      ? t("app.workspaces.workspaceAccessState.earlierCloneFailedDuring", { phase })
      : t("app.workspaces.workspaceAccessState.earlierCloneFailed"),
    action: { kind: "view_logs", label: t("app.workspaces.workspaceAccessState.viewProvisioningLog") },
  };
}

// Values are i18n keys, translated when read.
const HANDOFF_REASON_COPY_KEYS: Record<string, string> = {
  handoff_not_configured: "app.workspaces.workspaceAccessState.handoff.notConfigured",
  no_board_identity: "app.workspaces.workspaceAccessState.handoff.noBoardIdentity",
  runtime_not_running: "app.workspaces.workspaceAccessState.handoff.runtimeNotRunning",
  runtime_url_unusable: "app.workspaces.workspaceAccessState.handoff.runtimeUrlUnusable",
  workspace_not_ready: "app.workspaces.workspaceAccessState.handoff.workspaceNotReady",
};

const READINESS_FAILURE_COPY_KEYS: Record<string, string> = {
  database_unreachable: "app.workspaces.workspaceAccessState.readiness.databaseUnreachable",
  clone_data_missing: "app.workspaces.workspaceAccessState.readiness.cloneDataMissing",
  clone_data_unreadable: "app.workspaces.workspaceAccessState.readiness.cloneDataUnreadable",
  cloned_membership_missing: "app.workspaces.workspaceAccessState.readiness.clonedMembershipMissing",
  cloned_identity_unreadable: "app.workspaces.workspaceAccessState.readiness.clonedIdentityUnreadable",
  auth_handoff_not_configured: "app.workspaces.workspaceAccessState.readiness.authHandoffNotConfigured",
  seed_manifest_unreadable: "app.workspaces.workspaceAccessState.readiness.seedManifestUnreadable",
};

/**
 * Human cause for a readiness rejection, preferring the specific recorded phase
 * over a generic sentence so the copy names what to fix.
 */
export function describeWorkspaceReadinessCause(
  failure: WorkspaceLoginHandoffFailureInfo | null | undefined,
): string | null {
  if (!failure) return null;
  const phase = describeSeedPhase(failure.readiness);
  if (phase && READINESS_FAILURE_COPY_KEYS[phase]) return t(READINESS_FAILURE_COPY_KEYS[phase]);
  if (phase) return t("app.workspaces.workspaceAccessState.lastPhase", { phase });
  if (failure.detail && READINESS_FAILURE_COPY_KEYS[failure.detail]) return t(READINESS_FAILURE_COPY_KEYS[failure.detail]);
  const handoffKey = HANDOFF_REASON_COPY_KEYS[failure.reason];
  return handoffKey ? t(handoffKey) : null;
}

export function resolveWorkspaceAccessState(input: {
  runtimeServices: WorkspaceRuntimeService[] | null | undefined;
  operations: WorkspaceOperation[] | null | undefined;
  handoffFailure?: WorkspaceLoginHandoffFailureInfo | null;
}): WorkspaceAccessState {
  const operations = input.operations ?? [];
  const runtimeServices = input.runtimeServices ?? [];
  const repair = latestOperation(operations, "workspace_repair");
  const provision =
    latestOperation(operations, "workspace_seed")
    ?? latestOperation(operations, "workspace_runtime_provision")
    ?? latestOperation(operations, "workspace_provision");
  const failure = input.handoffFailure ?? null;
  const cause = describeWorkspaceReadinessCause(failure);
  const handoffAvailable = failure?.reason !== "handoff_not_configured" && failure?.reason !== "no_board_identity";
  const servingService = runtimeServices.find(
    (service) => service.status === "running" && service.healthStatus === "healthy" && service.url,
  );
  const startingService = runtimeServices.find(
    (service) => service.status === "provisioning" || service.status === "starting",
  );
  const repairFinishedAt = timestampMs(repair?.finishedAt);
  const servingServiceStartedAt = timestampMs(servingService?.startedAt);
  const provisionFinishedAt = timestampMs(provision?.finishedAt);
  const readinessConfirmsServing = Boolean(servingService && failure?.readiness?.state === "ready");
  const runtimeStartedAfterRepair = repairFinishedAt !== null
    && servingServiceStartedAt !== null
    && repairFinishedAt < servingServiceStartedAt;
  const repairFailureWasSuperseded = repair?.status === "failed" && Boolean(
    servingService
    && (readinessConfirmsServing || runtimeStartedAfterRepair),
  );
  const successfulRepairFinishedAt = repair?.status === "succeeded"
    ? timestampMs(repair.finishedAt)
    : null;
  // A failed seed is historical once the workspace is demonstrably serving,
  // or once a later repair has replaced and revalidated that database.
  const provisionFailureWasSuperseded = provision?.status === "failed" && Boolean(
    servingService
    || (
      provisionFinishedAt !== null
      && successfulRepairFinishedAt !== null
      && provisionFinishedAt < successfulRepairFinishedAt
    ),
  );
  const secondaryNotice = repair?.status === "failed" && repairFailureWasSuperseded
    ? failedRepairNotice(repair)
    : provision?.status === "failed" && provisionFailureWasSuperseded
      ? failedProvisionNotice(provision)
      : undefined;

  // A live repair outranks everything: it is already changing the answer.
  if (repair?.status === "running") {
    const phase = typeof repair.metadata?.repairPhase === "string" ? repair.metadata.repairPhase : null;
    return {
      state: "repairing",
      title: t("app.workspaces.workspaceAccessState.repairing"),
      description: phase
        ? t("app.workspaces.workspaceAccessState.repairingBodyPhase", { phase })
        : t("app.workspaces.workspaceAccessState.repairingBody"),
      action: { kind: "wait", label: t("app.workspaces.workspaceAccessState.repairInProgress") },
      handoffAvailable,
    };
  }
  if (repair?.status === "failed" && !repairFailureWasSuperseded) {
    const notice = failedRepairNotice(repair);
    return {
      state: "failed",
      ...notice,
      handoffAvailable,
    };
  }

  if (provision?.status === "running") {
    return {
      state: "provisioning",
      title: t("app.workspaces.workspaceAccessState.provisioningDatabase"),
      description: t("app.workspaces.workspaceAccessState.provisioningBody"),
      action: { kind: "wait", label: t("app.workspaces.workspaceAccessCard.state.provisioning") },
      handoffAvailable,
    };
  }
  if (provision?.status === "failed" && !provisionFailureWasSuperseded) {
    const seedPhase = typeof provision.metadata?.seedFailurePhase === "string"
      ? provision.metadata.seedFailurePhase
      : null;
    return {
      state: "failed",
      title: t("app.workspaces.workspaceAccessState.provisioningFailed"),
      description: seedPhase
        ? t("app.workspaces.workspaceAccessState.cloneFailedDuring", { phase: seedPhase })
        : t("app.workspaces.workspaceAccessState.cloneDidNotFinish"),
      action: { kind: "repair", label: t("app.workspaces.workspaceAccessState.repairWorkspace") },
      handoffAvailable,
    };
  }

  // Readiness the control plane actually observed beats anything inferred from
  // runtime rows, because it is the only signal that looked inside the clone.
  const staleNotReadyFailure = failure?.reason === "workspace_not_ready" && readinessConfirmsServing;
  if (failure && !staleNotReadyFailure) {
    if (failure.reason === "runtime_not_running" && !servingService && !startingService) {
      return {
        state: "stopped",
        title: t("app.workspaces.workspaceAccessState.notRunning"),
        description: t("app.workspaces.workspaceAccessState.startToPublish"),
        action: { kind: "start", label: t("app.workspaces.workspaceAccessState.startWorkspace") },
        handoffAvailable,
      };
    }
    if (failure.reason === "workspace_not_ready" || failure.reason === "runtime_url_unusable") {
      const readinessState = failure.readiness?.state;
      const validating = readinessState === "validating" || readinessState === "provisioning";
      return {
        state: validating ? "validating" : "degraded",
        title: validating ? t("app.workspaces.workspaceAccessCard.state.validating") : t("app.workspaces.workspaceAccessState.degraded"),
        description: [
          cause ?? t("app.workspaces.workspaceAccessState.readinessContractFailed"),
          validating ? t("app.workspaces.workspaceAccessState.stillConfirming") : t("app.workspaces.workspaceAccessState.boundedRepair"),
        ].join(" "),
        action: validating
          ? { kind: "wait", label: t("app.workspaces.workspaceAccessState.validating") }
          : { kind: "repair", label: t("app.workspaces.workspaceAccessState.repairWorkspace") },
        handoffAvailable,
      };
    }
    if (!handoffAvailable) {
      return {
        state: servingService ? "ready" : "degraded",
        title: servingService ? t("app.workspaces.workspaceAccessState.readySnapshotSignIn") : t("app.workspaces.workspaceAccessState.degraded"),
        description: cause ?? t("app.workspaces.workspaceAccessState.askForCredentials"),
        action: servingService
          ? { kind: "open", label: t("app.workspaces.workspaceAccessState.openWorkspace") }
          : { kind: "start", label: t("app.workspaces.workspaceAccessState.startWorkspace") },
        handoffAvailable: false,
        secondaryNotice,
      };
    }
  }

  if (startingService) {
    return {
      state: "provisioning",
      title: t("app.workspaces.workspaceAccessState.starting"),
      description: t("app.workspaces.workspaceAccessState.startingBody"),
      action: { kind: "wait", label: t("app.workspaces.workspaceAccessState.startingWorkspace") },
      handoffAvailable,
    };
  }

  if (servingService) {
    return {
      state: "ready",
      title: t("app.common.states.ready"),
      description: t("app.workspaces.workspaceAccessState.readyBody"),
      action: { kind: "open", label: t("app.workspaces.workspaceAccessState.openWorkspace") },
      handoffAvailable,
      secondaryNotice,
    };
  }

  const unhealthyService = runtimeServices.find(
    (service) => service.status === "running" && service.healthStatus !== "healthy",
  );
  if (unhealthyService) {
    return {
      state: "degraded",
      title: t("app.workspaces.workspaceAccessState.degraded"),
      description: cause
        ?? t("app.workspaces.workspaceAccessState.unhealthyBody"),
      action: { kind: "repair", label: t("app.workspaces.workspaceAccessState.repairWorkspace") },
      handoffAvailable,
    };
  }

  return {
    state: "stopped",
    title: t("app.workspaces.workspaceAccessState.notRunning"),
    description: t("app.workspaces.workspaceAccessState.startToPublish"),
    action: { kind: "start", label: t("app.workspaces.workspaceAccessState.startWorkspace") },
    handoffAvailable,
  };
}
