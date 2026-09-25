import { useContext, useState, type CSSProperties } from "react";
import { IssueGalleryContext } from "@/context/IssueGalleryContext";
import { ArtifactPreview } from "@/components/artifacts/ArtifactCard";
import { MediaArtifactCard } from "@/components/artifacts/MediaArtifactCard";
import { ImageGalleryModal } from "@/components/ImageGalleryModal";
import { isImageLikeOutput, isVideoLikeOutput } from "@/lib/issue-output";
import { attachmentDownloadPath } from "@/lib/issue-attachments";
import type { IssueWorkProduct } from "@paperclipai/shared";
import {
  ExternalLink,
  Maximize2,
  File,
  FileText,
  Film,
  GitBranch,
  GitCommit,
  Globe,
  Image,
  Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { cn } from "@/lib/utils";
import { t as translate, useTranslation } from "@/i18n";

type StateChip = {
  label: string;
  tone: "progress" | "failure" | "review" | "success" | "neutral";
  dashed?: boolean;
};

/** Resting states stay quiet. A completed work product never gets a chip. */
export function stateChipFor(
  kind: IssueWorkProduct["type"],
  status: string | null | undefined,
  reviewState: IssueWorkProduct["reviewState"] | string | null | undefined,
): StateChip | null {
  if (reviewState === "changes_requested" || status === "changes_requested") {
    return { label: translate("app.taskChat.richWorkProductCard.changesRequested"), tone: "failure" };
  }
  if (reviewState === "needs_board_review" || status === "ready_for_review") {
    return { label: translate("app.common.actions.review"), tone: "review" };
  }
  if (["failed", "unhealthy", "down"].includes(status ?? "")) {
    return { label: translate("app.common.states.failed"), tone: "failure" };
  }
  if (["pending", "opening"].includes(status ?? "")) {
    return { label: status === "opening" ? translate("app.taskChat.richWorkProductCard.opening") : translate("app.taskChat.richWorkProductCard.pending"), tone: "progress", dashed: true };
  }
  if (kind === "pull_request" && (status === "active" || status === "open")) {
    return { label: translate("app.taskChat.richWorkProductCard.open"), tone: "progress" };
  }
  if (kind === "pull_request" && status === "draft") {
    return { label: translate("app.common.states.draft"), tone: "review" };
  }
  if (kind === "pull_request" && status === "merged") {
    return { label: translate("app.taskChat.richWorkProductCard.merged"), tone: "success" };
  }
  if (kind === "pull_request" && status === "closed") {
    return { label: translate("app.taskChat.richWorkProductCard.closed"), tone: "neutral" };
  }
  if (kind === "runtime_service" && status === "active") {
    return { label: translate("app.common.states.running"), tone: "progress" };
  }
  if (kind === "runtime_service" && status === "closed") {
    return { label: translate("app.common.states.stopped"), tone: "failure" };
  }
  return null;
}

function stringMeta(metadata: Record<string, unknown> | null, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function numberMeta(metadata: Record<string, unknown> | null, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function urlLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function Chip({ chip }: { chip: StateChip }) {
  const cssVar = chip.tone === "failure"
    ? "--status-task-blocked"
    : chip.tone === "success"
      ? "--status-task-done"
      : chip.tone === "neutral"
        ? "--status-task-cancelled"
    : chip.tone === "review"
      ? "--status-task-in_review"
      : "--status-task-in_progress";
  return (
    <span
      className={cn(
        "status-chip inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-(length:--text-nano) font-medium leading-none",
        chip.dashed && "border-dashed",
      )}
      style={{ "--sc": `var(${cssVar})` } as CSSProperties}
    >
      {chip.label}
    </span>
  );
}

export interface RichWorkProductCardProps {
  workProduct: IssueWorkProduct;
  href: string | null;
  variant?: "card" | "compact" | "gallery";
}

export function RichWorkProductCard({ workProduct, href, variant = "card" }: RichWorkProductCardProps) {
  const { t } = useTranslation();
  const openIssueGallery = useContext(IssueGalleryContext);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const metadata = workProduct.metadata;
  const contentType = stringMeta(metadata, "contentType") ?? "";
  const isImage = isImageLikeOutput(contentType, stringMeta(metadata, "originalFilename") ?? workProduct.title);
  const isVideo = isVideoLikeOutput(contentType, stringMeta(metadata, "originalFilename") ?? workProduct.title);
  let Icon: LucideIcon = File;
  let meta: Array<string | null> = [];
  let action = t("app.taskChat.richWorkProductCard.openPreview");

  switch (workProduct.type) {
    case "pull_request": {
      Icon = GithubIcon;
      const repository = stringMeta(metadata, "repository", "repo", "repositoryName");
      const number = stringMeta(metadata, "number", "pullRequestNumber");
      const base = stringMeta(metadata, "baseRef", "base", "baseBranch");
      const head = stringMeta(metadata, "headRef", "head", "headBranch", "branch");
      meta = [repository, number ? `#${number.replace(/^#/, "")}` : null, base && head ? `${base} ← ${head}` : null, urlLabel(workProduct.url)];
      action = t("app.taskChat.richWorkProductCard.openOnGitHub");
      break;
    }
    case "commit":
      Icon = GitCommit;
      meta = [stringMeta(metadata, "shortSha", "sha")?.slice(0, 8) ?? workProduct.externalId?.slice(0, 8) ?? null, stringMeta(metadata, "branch", "branchName"), urlLabel(workProduct.url)];
      action = t("app.taskChat.richWorkProductCard.openOnGitHub");
      break;
    case "branch":
      Icon = GitBranch;
      meta = [stringMeta(metadata, "repository", "repo", "repositoryName"), stringMeta(metadata, "branch", "branchName") ?? workProduct.externalId, urlLabel(workProduct.url)];
      action = t("app.taskChat.richWorkProductCard.openOnGitHub");
      break;
    case "artifact": {
      Icon = isImage ? Image : isVideo ? Film : File;
      const size = numberMeta(metadata, "byteSize", "size");
      meta = [isImage ? t("app.taskChat.richWorkProductCard.image") : isVideo ? t("app.taskChat.richWorkProductCard.video") : stringMeta(metadata, "kind", "fileType") ?? t("app.taskChat.richWorkProductCard.file"), size === null ? null : formatBytes(size)];
      action = isImage || isVideo ? t("app.taskChat.richWorkProductCard.openGallery") : t("app.common.actions.download");
      break;
    }
    case "document":
      Icon = FileText;
      meta = [t("app.taskChat.richWorkProductCard.document"), stringMeta(metadata, "revision", "revisionNumber") ? t("app.taskChat.richWorkProductCard.revision", { revision: stringMeta(metadata, "revision", "revisionNumber") }) : null];
      action = t("app.taskChat.richWorkProductCard.openDocument");
      break;
    case "preview_url":
      Icon = Globe;
      meta = [urlLabel(workProduct.url)];
      action = t("app.taskChat.richWorkProductCard.openPreview");
      break;
    case "runtime_service":
      Icon = Server;
      meta = [stringMeta(metadata, "service", "serviceName") ?? workProduct.provider, stringMeta(metadata, "port") ? t("app.taskChat.richWorkProductCard.port", { port: stringMeta(metadata, "port") }) : null];
      action = t("app.taskChat.richWorkProductCard.openService");
      break;
  }

  const additions = numberMeta(metadata, "additions");
  const deletions = numberMeta(metadata, "deletions");
  const files = numberMeta(metadata, "files", "changedFiles");
  const unhealthyChip =
    workProduct.healthStatus === "unhealthy"
      ? workProduct.type === "preview_url"
        ? { label: t("app.taskChat.richWorkProductCard.down"), tone: "failure" as const }
        : workProduct.type === "runtime_service" && workProduct.status !== "closed"
          ? { label: t("app.taskChat.richWorkProductCard.unhealthy"), tone: "failure" as const }
          : null
      : null;
  const chip =
    unhealthyChip ??
    stateChipFor(
      workProduct.type,
      workProduct.type === "pull_request"
        ? stringMeta(metadata, "state") ?? workProduct.status
        : workProduct.type === "runtime_service" &&
        workProduct.status === "active" &&
        workProduct.healthStatus !== "healthy"
        ? null
        : workProduct.status,
      workProduct.reviewState,
    );
  const visibleMeta = meta.filter((value): value is string => Boolean(value));
  const changeCounts = [additions === null ? null : `+${additions}`, deletions === null ? null : `−${deletions}`]
    .filter(Boolean)
    .join(" ");
  const fileCount = files === null ? null : files === 1 ? t("app.taskChat.richWorkProductCard.oneFile", { count: files }) : t("app.taskChat.richWorkProductCard.manyFiles", { count: files });
  const statsLabel = [changeCounts || null, fileCount].filter(Boolean).join(" · ");
  const compact = variant === "compact";
  const mediaPath = workProduct.type === "artifact" && (isImage || isVideo)
    ? stringMeta(metadata, "contentPath", "openPath") ?? href
    : null;
  const artifactContentPath = stringMeta(metadata, "contentPath")
    ?? (href && /^\/api\/attachments\/[^/?#]+\/content$/.test(href) ? href : null);
  const actionHref = workProduct.type === "artifact" && !isImage && !isVideo
    ? stringMeta(metadata, "downloadPath") ?? (artifactContentPath
      ? attachmentDownloadPath({ contentPath: artifactContentPath })
      : href)
    : href;
  const openGallery = () => {
    if (mediaPath && !openIssueGallery?.(mediaPath)) setGalleryOpen(true);
  };

  if (variant === "gallery" && mediaPath) {
    return (
      <MediaArtifactCard
        id={workProduct.id}
        title={workProduct.title}
        contentPath={mediaPath}
        contentType={contentType}
        originalFilename={stringMeta(metadata, "originalFilename") ?? workProduct.title}
        downloadPath={stringMeta(metadata, "downloadPath") ?? undefined}
        detail={visibleMeta.join(" · ")}
        badge={chip ? <Chip chip={chip} /> : null}
      />
    );
  }

  return (
    <article
      className={cn(
        "@container relative flex min-w-0 rounded-md border border-border bg-card/60",
        (mediaPath || actionHref) && "hover:bg-accent/50",
        compact ? "items-center gap-2 px-2.5 py-1.5" : "items-start gap-3 px-3 py-2.5",
      )}
      data-testid={`task-chat-rich-work-product-${workProduct.type}`}
      data-variant={variant}
    >
      <div className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted/60 text-muted-foreground",
        mediaPath ? "w-20" : compact ? "h-8 w-8" : "h-10 w-10",
      )}>
        {mediaPath ? (
          <ArtifactPreview artifact={{ contentPath: mediaPath, title: workProduct.title, mediaKind: isVideo ? "video" : "image" }} />
        ) : (
          <Icon aria-hidden className={compact ? "h-4 w-4" : "h-5 w-5"} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-medium text-foreground">{workProduct.title}</strong>
        {visibleMeta.length > 0 ? <p className="mt-1 truncate text-xs text-muted-foreground">{visibleMeta.join(" · ")}</p> : null}
        {statsLabel ? <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{statsLabel}</p> : null}
      </div>
      <div className={cn("flex shrink-0 items-center", compact ? "gap-1.5" : "gap-2")}>
        {chip ? <Chip chip={chip} /> : null}
        {mediaPath ? (
          <button type="button" onClick={openGallery} aria-label={t("app.taskChat.richWorkProductCard.actionLabel", { action, title: workProduct.title })} className="inline-flex items-center gap-1 text-xs font-medium text-foreground after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
            {compact ? null : <span className="hidden @sm:inline">{action}</span>}<Maximize2 aria-hidden className="h-3 w-3" />
          </button>
        ) : actionHref ? (
          <a href={actionHref} aria-label={t("app.taskChat.richWorkProductCard.actionLabel", { action, title: workProduct.title })} className="inline-flex items-center gap-1 text-xs font-medium text-foreground after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" target={actionHref.startsWith("http") ? "_blank" : undefined} rel={actionHref.startsWith("http") ? "noreferrer" : undefined}>
            {compact ? null : <span className="hidden @sm:inline">{action}</span>}<ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      {galleryOpen && mediaPath ? (
        <ImageGalleryModal
          items={[{
            id: workProduct.id,
            contentPath: mediaPath,
            downloadPath: stringMeta(metadata, "downloadPath") ?? undefined,
            contentType,
            originalFilename: stringMeta(metadata, "originalFilename") ?? workProduct.title,
          }]}
          initialIndex={0}
          open
          onOpenChange={setGalleryOpen}
        />
      ) : null}
    </article>
  );
}
