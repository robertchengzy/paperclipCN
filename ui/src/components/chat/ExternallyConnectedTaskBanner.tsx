import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Paperclip, Radio } from "lucide-react";
import type {
  ChatPublicationState,
  ChatFileTransferPhase,
  IssueAttachment,
} from "@paperclipai/shared";
import {
  chatEndpointsApi,
  type ChatProvider,
  type ChatPublicationSummary,
  type ExternalChannelBindingSummary,
} from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/context/ToastContext";
import { Link } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { useChatConnectorsEnabled } from "@/hooks/useChatConnectorsEnabled";
import { t as translate, useTranslation } from "@/i18n";
import { issuesApi } from "@/api/issues";
import {
  boardSendDraftKey,
  clearBoardSendDraft,
  canDismissBoardSendBatch,
  readBoardSendDraft,
  readBoardSendRejection,
  writeBoardSendDraft,
  type BoardSendRejection,
  type RetainedBoardSend,
} from "./board-send-draft";

const providerNames: Record<ChatProvider, string> = {
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  agentmail: "AgentMail",
  "imessage-photon": "iMessage Photon",
};

type PublicationFeedback = {
  title: string;
  body: string;
  tone: "info" | "success" | "warn" | "error";
};

const publicationFeedbackKeys: Record<
  ChatPublicationState,
  { titleKey: string; bodyKey: string; tone: PublicationFeedback["tone"] }
> = {
  awaiting_consent: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.awaitingConsent.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.awaitingConsent.body",
    tone: "info",
  },
  published: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.published.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.published.body",
    tone: "success",
  },
  pending: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.pending.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.pending.body",
    tone: "info",
  },
  streaming: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.streaming.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.streaming.body",
    tone: "info",
  },
  retry: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.retry.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.retry.body",
    tone: "warn",
  },
  delivery_unknown: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.deliveryUnknown.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.deliveryUnknown.body",
    tone: "warn",
  },
  failed: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.failed.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.failed.body",
    tone: "error",
  },
  cancelled: {
    titleKey: "app.taskChat.externallyConnectedTaskBanner.publication.cancelled.title",
    bodyKey: "app.taskChat.externallyConnectedTaskBanner.publication.cancelled.body",
    tone: "info",
  },
};

function publicationFeedback(state: ChatPublicationState): PublicationFeedback {
  const entry = publicationFeedbackKeys[state];
  return { title: translate(entry.titleKey), body: translate(entry.bodyKey), tone: entry.tone };
}

const filePhaseLabelKeys: Record<ChatFileTransferPhase, string> = {
  consent_pending: "app.taskChat.externallyConnectedTaskBanner.filePhase.consentPending",
  consent_sending: "app.taskChat.externallyConnectedTaskBanner.filePhase.consentSending",
  consent_unknown: "app.taskChat.externallyConnectedTaskBanner.filePhase.consentUnknown",
  awaiting_consent: "app.taskChat.externallyConnectedTaskBanner.filePhase.awaitingConsent",
  upload_pending: "app.taskChat.externallyConnectedTaskBanner.filePhase.uploadPending",
  uploading: "app.taskChat.externallyConnectedTaskBanner.filePhase.uploading",
  upload_unknown: "app.taskChat.externallyConnectedTaskBanner.filePhase.uploadUnknown",
  file_info_pending: "app.taskChat.externallyConnectedTaskBanner.filePhase.fileInfoPending",
  file_info_sending: "app.taskChat.externallyConnectedTaskBanner.filePhase.fileInfoSending",
  file_info_unknown: "app.taskChat.externallyConnectedTaskBanner.filePhase.fileInfoUnknown",
  delivered: "app.taskChat.externallyConnectedTaskBanner.filePhase.delivered",
  declined: "app.taskChat.externallyConnectedTaskBanner.filePhase.declined",
  expired: "app.taskChat.externallyConnectedTaskBanner.filePhase.expired",
  cancelled: "app.taskChat.externallyConnectedTaskBanner.filePhase.cancelled",
  conflict: "app.taskChat.externallyConnectedTaskBanner.filePhase.conflict",
};

export function useIssueChatBinding(companyId: string, issueId: string) {
  const { enabled } = useChatConnectorsEnabled();
  const queryEnabled = enabled && Boolean(companyId && issueId) && !issueId.startsWith("chat:");
  const query = useQuery({
    queryKey: ["issue-chat-binding", companyId, issueId],
    queryFn: () => chatEndpointsApi.getIssueBinding(issueId),
    enabled: queryEnabled,
  });
  return {
    binding: queryEnabled ? (query.data ?? null) : null,
    isLoading: queryEnabled && query.isLoading,
  };
}

type ConnectedTaskProps = {
  attachments?: IssueAttachment[];
  companyId: string;
  issueId: string;
  issueCacheRefs?: string[];
};

export function ExternallyConnectedTaskBanner(props: ConnectedTaskProps) {
  const { binding } = useIssueChatBinding(props.companyId, props.issueId);
  if (!binding || binding.provider === "agentmail") return null;
  return (
    <ConnectedTaskComposer
      key={boardSendDraftKey(
        props.companyId,
        props.issueId,
        binding.endpointId,
        binding.conversationId,
      )}
      {...props}
      binding={binding}
    />
  );
}

function ConnectedTaskComposer({
  attachments = [],
  companyId,
  issueId,
  issueCacheRefs,
  binding,
}: ConnectedTaskProps & { binding: ExternalChannelBindingSummary }) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>(
    [],
  );
  const [publication, setPublication] = useState<ChatPublicationSummary | null>(
    null,
  );
  const idempotencyKey = useRef<string | null>(null);
  const retainedSend = useRef<RetainedBoardSend | null>(null);
  const retainedScopeKey = useRef<string | null>(null);
  const [unconfirmedRequest, setUnconfirmedRequest] = useState(false);
  const [rejection, setRejection] = useState<BoardSendRejection | null>(null);
  const [excludedAttachmentIds, setExcludedAttachmentIds] = useState<string[]>(
    [],
  );
  const [selectionNotice, setSelectionNotice] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(false);
  const mounted = useRef(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAttachments, setUploadedAttachments] = useState<
    IssueAttachment[]
  >([]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const storageKey = binding
    ? boardSendDraftKey(
        companyId,
        issueId,
        binding.endpointId,
        binding.conversationId,
      )
    : null;
  const loadedStorageKey = useRef<string | null>(null);
  useEffect(() => {
    if (!storageKey || loadedStorageKey.current === storageKey) return;
    loadedStorageKey.current = storageKey;
    try {
      const saved = readBoardSendDraft(storageKey);
      retainedScopeKey.current = storageKey;
      retainedSend.current = saved;
      idempotencyKey.current = saved?.idempotencyKey ?? null;
      setBody(saved?.body ?? "");
      setSelectedAttachmentIds(saved?.attachmentIds ?? []);
      setPublication(saved?.publication ?? null);
      setUnconfirmedRequest(
        Boolean(saved && !saved.publication && !saved.rejection),
      );
      setRejection(saved?.rejection ?? null);
      setComposing(Boolean(saved));
      setStorageError(null);
    } catch {
      setStorageError(
        t("app.taskChat.externallyConnectedTaskBanner.storage.readFailed"),
      );
      setComposing(true);
    }
  }, [storageKey]);
  const deliveryScopeReady = Boolean(
    storageKey &&
    loadedStorageKey.current === storageKey &&
    retainedScopeKey.current === storageKey,
  );
  const invalidateTask = useCallback(() => {
    for (const ref of new Set([issueId, ...(issueCacheRefs ?? [])])) {
      for (const queryKey of [
        queryKeys.issues.comments(ref),
        queryKeys.issues.attachments(ref),
        queryKeys.issues.detail(ref),
        queryKeys.issues.activity(ref),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }
  }, [issueId, issueCacheRefs, queryClient]);
  const finishPublication = useCallback(() => {
    if (storageKey) {
      try {
        clearBoardSendDraft(storageKey);
      } catch {
        /* The retained anchor remains safe to recheck after reload. */
      }
    }
    retainedSend.current = null;
    setUnconfirmedRequest(false);
    setRejection(null);
    setSelectionNotice(false);
    setPublication(null);
    idempotencyKey.current = null;
    setBody("");
    setSelectedAttachmentIds([]);
    setUploadedAttachments([]);
    setUploadError(null);
    setComposing(false);
    invalidateTask();
    pushToast(publicationFeedback("published"));
  }, [invalidateTask, pushToast, storageKey]);
  // Keep the first returned ID as the anchor. A batch's blocking row may
  // change as text and files finish; no read is allowed to submit another send.
  const publicationStatus = useQuery({
    queryKey: [
      "chat-publication-batch",
      companyId,
      binding?.endpointId,
      binding?.conversationId,
      publication?.id,
    ],
    queryFn: () =>
      chatEndpointsApi.getPublicationBatchStatus(
        binding!.endpointId,
        binding!.conversationId,
        publication!.id,
      ),
    enabled: deliveryScopeReady && Boolean(publication),
    staleTime: 0,
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    const batch = publicationStatus.data;
    if (
      publication &&
      batch &&
      batch.total > 0 &&
      batch.published === batch.total &&
      batch.publication.state === "published"
    ) {
      finishPublication();
    }
  }, [publication, publicationStatus.data, finishPublication]);
  const publish = useMutation({
    mutationFn: (input: {
      attachmentIds: string[];
      body: string;
      idempotencyKey: string;
      endpointId: string;
      conversationId: string;
    }) =>
      chatEndpointsApi.publishBoardMessage(
        input.endpointId,
        input.conversationId,
        input.body,
        input.idempotencyKey,
        input.attachmentIds,
      ),
    onSuccess: (result) => {
      invalidateTask();
      const feedback = publicationFeedback(result.state);
      setPublication(result.state === "published" ? null : result);
      if (result.state === "published") {
        finishPublication();
        return;
      }
      setUnconfirmedRequest(false);
      if (storageKey && retainedSend.current) {
        retainedSend.current = {
          ...retainedSend.current,
          publication: {
            id: result.id,
            state: result.state,
            attempts: result.attempts,
          },
        };
        try {
          writeBoardSendDraft(storageKey, retainedSend.current);
        } catch {
          // The pre-POST payload/key is already persisted. It remains a safe,
          // explicit same-request retry when the publication ID cannot be saved.
        }
      }
      pushToast({
        ...feedback,
        action: {
          label: t("app.taskChat.externallyConnectedTaskBanner.viewActivity"),
          href: `/apps/chat/${binding!.endpointId}/activity`,
        },
      });
    },
    onError: (error, request) => {
      const rejected = readBoardSendRejection(error, request);
      if (rejected && retainedSend.current && storageKey) {
        const saved = { ...retainedSend.current, rejection: rejected };
        try {
          // Keep the negative receipt through reload before offering a new key.
          writeBoardSendDraft(storageKey, saved);
        } catch {
          setStorageError(
            t("app.taskChat.externallyConnectedTaskBanner.storage.rejectionSaveFailed"),
          );
          return;
        }
        retainedSend.current = saved;
        setRejection(rejected);
        setUnconfirmedRequest(false);
        invalidateTask();
        pushToast({
          title: t("app.taskChat.externallyConnectedTaskBanner.updateNotSent"),
          body: t("app.taskChat.externallyConnectedTaskBanner.rejectedToastBody"),
          tone: "error",
        });
        return;
      }
      pushToast({
        title: t("app.taskChat.externallyConnectedTaskBanner.confirmFailedTitle"),
        body:
          error instanceof Error
            ? t("app.taskChat.externallyConnectedTaskBanner.confirmFailedBodyWithReason", { reason: error.message })
            : t("app.taskChat.externallyConnectedTaskBanner.confirmFailedBody"),
        tone: "error",
      });
    },
  });
  const uploadDisabled = Boolean(
    retainedSend.current ||
    publication ||
    publish.isPending ||
    publish.isError ||
    unconfirmedRequest ||
    storageError ||
    !deliveryScopeReady ||
    uploading,
  );
  async function uploadFile(file: File) {
    if (uploadDisabled || uploadInFlight.current || retainedSend.current)
      return;
    uploadInFlight.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const attachment = await issuesApi.uploadAttachment(
        companyId,
        issueId,
        file,
      );
      if (!mounted.current) return;
      setUploadedAttachments((current) => [...current, attachment]);
      setSelectedAttachmentIds((current) => [...current, attachment.id]);
      idempotencyKey.current = null;
    } catch (error) {
      if (mounted.current) {
        setUploadError(
          t("app.taskChat.externallyConnectedTaskBanner.uploadFailed", {
            reason: error instanceof Error ? error.message : t("app.taskChat.externallyConnectedTaskBanner.uploadNotConfirmed"),
          }),
        );
      }
    } finally {
      uploadInFlight.current = false;
      if (mounted.current) setUploading(false);
      // An interrupted response may still have stored the file on this task.
      invalidateTask();
    }
  }
  // Keep newly uploaded files usable before the task refetch completes. Once
  // present, server metadata wins (especially a file bound to a sent comment).
  const taskAttachments = [
    ...new Map(
      [...uploadedAttachments, ...attachments].map((attachment) => [
        attachment.id,
        attachment,
      ]),
    ).values(),
  ];
  useEffect(() => {
    // Metadata may arrive after this file was selected but before Send. Never
    // silently keep a now-hidden selection, and never rewrite a retained send.
    if (retainedSend.current) return;
    const newlyBound = attachments
      .filter((file) => file.issueCommentId !== null)
      .map((file) => file.id);
    if (!selectedAttachmentIds.some((id) => newlyBound.includes(id))) return;
    setSelectedAttachmentIds((current) =>
      current.filter((id) => !newlyBound.includes(id)),
    );
    setSelectionNotice(true);
    idempotencyKey.current = null;
  }, [attachments, selectedAttachmentIds]);
  const showingRetainedFiles = Boolean(retainedSend.current);
  // Comment binding removes files from new-send eligibility, not from the
  // immutable receipt for the current send. Saved names survive reload while
  // task metadata is loading (or a selected attachment has since been removed).
  const visibleAttachments = retainedSend.current
    ? retainedSend.current.attachmentIds.map((id) => ({
        id,
        originalFilename:
          retainedSend.current?.attachmentNames?.find((file) => file.id === id)
            ?.name ??
          taskAttachments.find((attachment) => attachment.id === id)
            ?.originalFilename ??
          t("app.taskChat.externallyConnectedTaskBanner.selectedFileUnavailable"),
      }))
    : taskAttachments.filter(
        (attachment) =>
          attachment.issueCommentId === null &&
          !excludedAttachmentIds.includes(attachment.id),
      );
  const currentPublication = publicationStatus.data?.publication ?? publication;
  const batch = publicationStatus.data;
  const dismissible =
    !publicationStatus.isError &&
    !publicationStatus.isFetching &&
    canDismissBoardSendBatch(batch);
  const mixedTerminal =
    canDismissBoardSendBatch(batch) && batch!.published < batch!.total;
  const currentFeedback = mixedTerminal
    ? {
        title: t("app.taskChat.externallyConnectedTaskBanner.mixedOutcomes.title"),
        body: t("app.taskChat.externallyConnectedTaskBanner.mixedOutcomes.body"),
        tone: "info" as const,
      }
    : currentPublication?.state === "cancelled" &&
        (batch?.awaitingConsent ?? 0) > 0
      ? {
          title: t("app.taskChat.externallyConnectedTaskBanner.remainingConsent.title"),
          body: t("app.taskChat.externallyConnectedTaskBanner.remainingConsent.body"),
          tone: "info" as const,
        }
      : currentPublication
        ? publicationFeedback(currentPublication.state)
        : null;
  const activityPath = `/apps/chat/${binding.endpointId}/activity`;
  return (
    <section
      aria-label={t("app.taskChat.externallyConnectedTaskBanner.externalConversation")}
      className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {t("app.taskChat.externallyConnectedTaskBanner.connectedTo", { provider: providerNames[binding.provider] })}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("app.taskChat.externallyConnectedTaskBanner.agentAssignmentFixed", { label: binding.externalLabel })}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {binding.externalUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={binding.externalUrl} target="_blank" rel="noreferrer">
                {t("app.taskChat.externallyConnectedTaskBanner.openProvider", { provider: providerNames[binding.provider] })} <ExternalLink />
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setComposing((value) => !value)}
          >
            {t("app.taskChat.externallyConnectedTaskBanner.sendToChannel")}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/apps/chat/${binding.endpointId}/conversations`}>
              {t("app.taskChat.externallyConnectedTaskBanner.connection")}
            </Link>
          </Button>
        </div>
      </div>
      {composing && (
        <div className="space-y-2 border-t border-border pt-3">
          <label
            className="text-xs font-medium"
            htmlFor="external-board-update"
          >
            {t("app.taskChat.externallyConnectedTaskBanner.boardUpdate")}
          </label>
          <Textarea
            id="external-board-update"
            value={body}
            disabled={
              Boolean(publication) ||
              Boolean(rejection) ||
              publish.isError ||
              unconfirmedRequest ||
              Boolean(storageError) ||
              !deliveryScopeReady
            }
            onChange={(event) => {
              setBody(event.target.value);
              idempotencyKey.current = null;
              publish.reset();
            }}
            placeholder={t("app.taskChat.externallyConnectedTaskBanner.bodyPlaceholder")}
          />
          {selectedAttachmentIds.length > 0 && !body.trim() && (
            <p className="text-xs text-muted-foreground">
              {t("app.taskChat.externallyConnectedTaskBanner.addMessageWithFiles")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              aria-label={t("app.taskChat.externallyConnectedTaskBanner.attachFileLabel")}
              disabled={uploadDisabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadDisabled}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip />
              {uploading ? t("app.taskChat.chatComposer.uploading") : t("app.taskChat.externallyConnectedTaskBanner.attachFile")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("app.taskChat.externallyConnectedTaskBanner.filesStayOnTask")}
            </p>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-destructive">
              {uploadError}
            </p>
          )}
          {selectionNotice && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("app.taskChat.externallyConnectedTaskBanner.selectionNotice")}
            </p>
          )}
          {visibleAttachments.length > 0 && (
            <fieldset
              className="space-y-2 rounded-md border border-border bg-background p-3"
              disabled={
                showingRetainedFiles ||
                Boolean(publication) ||
                publish.isError ||
                unconfirmedRequest ||
                Boolean(storageError) ||
                !deliveryScopeReady
              }
            >
              <legend className="px-1 text-xs font-medium">
                {showingRetainedFiles
                  ? t("app.taskChat.externallyConnectedTaskBanner.filesInThisSend")
                  : t("app.taskChat.externallyConnectedTaskBanner.includeTaskFiles")}
              </legend>
              <p className="text-xs text-muted-foreground">
                {binding.provider === "github"
                  ? t("app.taskChat.externallyConnectedTaskBanner.filesHint.github")
                  : binding.provider === "microsoft-teams" &&
                      !showingRetainedFiles
                    ? t("app.taskChat.externallyConnectedTaskBanner.filesHint.teams")
                    : showingRetainedFiles
                      ? t("app.taskChat.externallyConnectedTaskBanner.filesHint.retained")
                      : t("app.taskChat.externallyConnectedTaskBanner.filesHint.default")}
              </p>
              <div className="space-y-2">
                {visibleAttachments.map((attachment) => {
                  const label =
                    attachment.originalFilename ?? t("app.taskChat.externallyConnectedTaskBanner.unnamedAttachment");
                  return (
                    <label
                      className="flex items-center gap-2 text-xs"
                      key={attachment.id}
                    >
                      <Checkbox
                        disabled={showingRetainedFiles}
                        checked={selectedAttachmentIds.includes(attachment.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAttachmentIds((current) =>
                            checked === true
                              ? [...current, attachment.id]
                              : current.filter((id) => id !== attachment.id),
                          );
                          idempotencyKey.current = null;
                          publish.reset();
                        }}
                      />
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {storageError && (
            <p role="alert" className="text-xs text-destructive">
              {storageError}
            </p>
          )}
          {rejection && (
            <div
              role="alert"
              className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
            >
              <p className="font-medium">{t("app.taskChat.externallyConnectedTaskBanner.updateNotSent")}</p>
              <p className="text-muted-foreground">
                {t("app.taskChat.externallyConnectedTaskBanner.rejectedBody")}
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(storageError)}
                onClick={() => {
                  if (!storageKey || !retainedSend.current?.rejection) return;
                  try {
                    clearBoardSendDraft(storageKey);
                  } catch {
                    setStorageError(
                      t("app.taskChat.externallyConnectedTaskBanner.storage.rejectionClearFailed"),
                    );
                    return;
                  }
                  const invalidIds =
                    retainedSend.current.rejection.attachmentIds;
                  setExcludedAttachmentIds((current) => [
                    ...new Set([...current, ...invalidIds]),
                  ]);
                  setSelectedAttachmentIds((current) =>
                    current.filter((id) => !invalidIds.includes(id)),
                  );
                  setUploadedAttachments((current) =>
                    current.filter((file) => !invalidIds.includes(file.id)),
                  );
                  retainedSend.current = null;
                  idempotencyKey.current = null;
                  setRejection(null);
                  setUnconfirmedRequest(false);
                  setSelectionNotice(true);
                  publish.reset();
                }}
              >
                {t("app.taskChat.externallyConnectedTaskBanner.editRejectedSend")}
              </Button>
            </div>
          )}
          {!rejection &&
            (publish.isError || unconfirmedRequest) &&
            !publish.isPending &&
            !publication && (
              <div
                role="alert"
                className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
              >
                <p className="font-medium">{t("app.taskChat.externallyConnectedTaskBanner.resultNotConfirmed.title")}</p>
                <p className="text-muted-foreground">
                  {t("app.taskChat.externallyConnectedTaskBanner.resultNotConfirmed.body")}
                </p>
                <Link
                  className="inline-block font-medium underline underline-offset-4"
                  to={activityPath}
                >
                  {t("app.taskChat.externallyConnectedTaskBanner.openActivity")}
                </Link>
              </div>
            )}
          {publication && currentPublication && currentFeedback && (
            <div
              role={
                currentPublication.state === "failed" ||
                currentPublication.state === "delivery_unknown"
                  ? "alert"
                  : "status"
              }
              className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
            >
              <p className="font-medium">{currentFeedback.title}</p>
              <p className="text-muted-foreground">{currentFeedback.body}</p>
              {batch && (
                <p className="text-muted-foreground">
                  {batch.declined !== undefined &&
                  batch.expired !== undefined &&
                  batch.cancelled !== undefined &&
                  batch.awaitingConsent !== undefined
                    ? [
                        t("app.taskChat.externallyConnectedTaskBanner.batch.published", { count: batch.published }),
                        ...(batch.awaitingConsent
                          ? [t("app.taskChat.externallyConnectedTaskBanner.batch.awaitingConsent", { count: batch.awaitingConsent })]
                          : []),
                        ...(batch.declined
                          ? [t("app.taskChat.externallyConnectedTaskBanner.batch.declined", { count: batch.declined })]
                          : []),
                        ...(batch.expired ? [t("app.taskChat.externallyConnectedTaskBanner.batch.expired", { count: batch.expired })] : []),
                        ...(batch.cancelled
                          ? [t("app.taskChat.externallyConnectedTaskBanner.batch.cancelled", { count: batch.cancelled })]
                          : []),
                      ].join(" · ")
                    : t("app.taskChat.externallyConnectedTaskBanner.batch.partsPublished", { published: batch.published, total: batch.total })}
                </p>
              )}
              {batch?.parts?.some((part) => part.fileTransfer) && (
                <ul
                  className="space-y-1 text-muted-foreground"
                  aria-label={t("app.taskChat.externallyConnectedTaskBanner.fileDeliveryOutcomes")}
                >
                  {batch.parts
                    .filter((part) => part.fileTransfer)
                    .map((part) => (
                      <li key={part.id}>
                        {part.fileTransfer!.filename} —{" "}
                        {t(filePhaseLabelKeys[part.fileTransfer!.phase])}
                      </li>
                    ))}
                </ul>
              )}
              {publicationStatus.isError && (
                <p role="alert" className="text-muted-foreground">
                  {t("app.taskChat.externallyConnectedTaskBanner.statusRefreshFailed")}
                </p>
              )}
              {currentPublication.redactedError && (
                <p className="text-muted-foreground">
                  {t("app.taskChat.externallyConnectedTaskBanner.providerDetail", { detail: currentPublication.redactedError })}
                </p>
              )}
              <Link
                className="inline-block font-medium underline underline-offset-4"
                to={activityPath}
              >
                {t("app.taskChat.externallyConnectedTaskBanner.openActivity")}
              </Link>
              {dismissible && (
                <Button
                  className="ml-3"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (storageKey) {
                      try {
                        clearBoardSendDraft(storageKey);
                      } catch {
                        setStorageError(
                          t("app.taskChat.externallyConnectedTaskBanner.storage.clearFailed"),
                        );
                        return;
                      }
                    }
                    setStorageError(null);
                    retainedSend.current = null;
                    setUnconfirmedRequest(false);
                    setPublication(null);
                    setBody("");
                    setSelectedAttachmentIds([]);
                    setUploadedAttachments([]);
                    setUploadError(null);
                    idempotencyKey.current = null;
                    publish.reset();
                  }}
                >
                  {t("app.taskChat.externallyConnectedTaskBanner.dismissReceipt")}
                </Button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t("app.taskChat.externallyConnectedTaskBanner.ordinaryCommentsNote")}
            </p>
            <Button
              size="sm"
              disabled={
                !body.trim() ||
                publish.isPending ||
                uploading ||
                Boolean(publication) ||
                Boolean(rejection) ||
                Boolean(storageError) ||
                !deliveryScopeReady
              }
              onClick={() => {
                if (
                  uploadInFlight.current ||
                  !storageKey ||
                  loadedStorageKey.current !== storageKey ||
                  retainedScopeKey.current !== storageKey
                )
                  return;
                idempotencyKey.current ??= crypto.randomUUID();
                const input = retainedSend.current ?? {
                  attachmentIds: selectedAttachmentIds,
                  attachmentNames: selectedAttachmentIds.map((id) => ({
                    id,
                    name:
                      taskAttachments.find((attachment) => attachment.id === id)
                        ?.originalFilename ?? "Unnamed attachment",
                  })),
                  body: body.trim(),
                  idempotencyKey: idempotencyKey.current,
                  publication: null,
                };
                try {
                  if (!storageKey) throw new Error("Missing delivery scope");
                  writeBoardSendDraft(storageKey, input);
                } catch {
                  setStorageError(
                    t("app.taskChat.externallyConnectedTaskBanner.storage.writeFailed"),
                  );
                  return;
                }
                retainedSend.current = input;
                setUnconfirmedRequest(true);
                publish.mutate({
                  ...input,
                  endpointId: binding.endpointId,
                  conversationId: binding.conversationId,
                });
              }}
            >
              {publish.isPending
                ? t("app.taskChat.taskChatBubble.sending")
                : !rejection && (publish.isError || unconfirmedRequest)
                  ? t("app.taskChat.externallyConnectedTaskBanner.retrySafely")
                  : t("app.taskChat.externallyConnectedTaskBanner.sendToChannel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
