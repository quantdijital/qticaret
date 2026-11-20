import { useQuery } from "@tanstack/react-query"
import { Loader2, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { contentQuery, useDeleteContent, useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentCoverCard } from "@/features/content/components/content-cover-card"
import { ContentGeneralCard } from "@/features/content/components/content-general-card"
import { ContentSummaryCard } from "@/features/content/components/content-summary-card"
import { docText } from "@/features/content/doc-text"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { Panel } from "./panel-header"

const S = "storefront.editor.contentPage.settings"

/** Taslak or Yayında, saved at once. */
function StatusRow({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const live = entry.status === "published"
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-card">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor="page-settings-live" className="text-sm font-medium">
          {t(`${S}.live`)}
        </label>
        <p className="text-xs text-muted-foreground">{t(live ? `${S}.liveOn` : `${S}.liveOff`)}</p>
      </div>
      <Switch
        id="page-settings-live"
        checked={live}
        disabled={update.isPending}
        onCheckedChange={(next) => {
          update.mutate(
            { status: next ? "published" : "draft" },
            {
              onSuccess: () => toast.success(t(next ? "content.published" : "content.unpublished")),
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      />
    </div>
  )
}

/** The page deleted, once asked (a page that was live answers 410 at its address). */
function DeletePage({ entry, onDeleted }: { entry: ContentDetail; onDeleted: () => void }) {
  const { t } = useTranslation()
  const remove = useDeleteContent()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="self-start text-destructive"
        disabled={remove.isPending}
        onClick={() => {
          setAsking(true)
        }}
      >
        {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {t(`${S}.delete`)}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("content.deleteTitle", { title: entry.title })}
        description={t(entry.published_at ? "content.deleteLive" : "content.deleteDraft")}
        confirmLabel={t("content.delete")}
        destructive
        onConfirm={() => {
          setAsking(false)
          // Awaited, not `mutate`'s callbacks: the panel reads the page again and is gone by then
          void remove.mutateAsync(entry.id).then(
            () => {
              toast.success(t("content.deleted"))
              onDeleted()
            },
            (failure: unknown) => toast.error(errorText(t, failure))
          )
        }}
      />
    </>
  )
}

/**
 * A content page's own settings in the theme editor (adr/0073 Ek
 * 2026-11-19 (2) K5): its title and address (an old address goes on to
 * the new one), its search look (with the advisor's suggestion), summary
 * and cover, Taslak or Yayında, and deleting it. Each is saved at once,
 * apart from the draft: "Yayınla" puts the design live, not these.
 */
export function PageSettingsPanel({
  pageId,
  onBack,
  onDeleted,
}: {
  pageId: string
  onBack: () => void
  /** The page is gone: its layout leaves the draft and the editor picks none. */
  onDeleted: (id: string) => void
}) {
  const { t } = useTranslation()
  const entry = useQuery(contentQuery(pageId))
  const data = entry.data
  return (
    <Panel icon={Settings2} title={t(`${S}.title`)} onBack={onBack}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <p className="text-[13px] leading-5 text-muted-foreground">{t(`${S}.savedAtOnce`)}</p>
        {entry.isError ? (
          <ErrorState text={errorText(t, entry.error)} onRetry={() => void entry.refetch()} />
        ) : !data ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <>
            <ContentGeneralCard entry={data} />
            <StatusRow entry={data} />
            <SeoCard
              type="page"
              id={data.id}
              context={{
                path: data.path,
                tokens: { başlık: data.title },
                fallbackDescription: excerpt(
                  data.excerpt ?? docText(data.body),
                  DESCRIPTION_EXCERPT
                ),
              }}
            />
            <ContentSummaryCard entry={data} />
            <ContentCoverCard entry={data} />
            <DeletePage
              entry={data}
              onDeleted={() => {
                onDeleted(data.id)
              }}
            />
          </>
        )}
      </div>
    </Panel>
  )
}
