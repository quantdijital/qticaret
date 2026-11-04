import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { Eye, FileText, Loader2, Send } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { useCan } from "@/features/auth/api/staff"
import {
  legalKindQuery,
  legalStarterQuery,
  usePreviewLegal,
  usePublishLegal,
  useResetLegalDraft,
  useSaveLegalDraft,
} from "@/features/legal/api"
import type { LegalDetail, LegalKind } from "@/features/legal/api"
import { LegalEditorCard } from "@/features/legal/components/legal-editor-card"
import { LegalPreviewDialog } from "@/features/legal/components/legal-preview-dialog"
import { TokensCard, VersionsCard } from "@/features/legal/components/legal-side-cards"
import { LegalStateCard } from "@/features/legal/components/legal-state-card"
import { errorText } from "@/lib/errors"

const L = "settings.legal"
const route = getRouteApi("/_auth/settings/legal/$kind")

/** A kind with no text yet: start from the platform's starter, or from nothing. */
function StartCard({ kind }: { kind: LegalKind }) {
  const { t } = useTranslation()
  const can = useCan("legalTexts")
  const client = useQueryClient()
  const reset = useResetLegalDraft(kind)
  const save = useSaveLegalDraft(kind)
  const busy = reset.isPending || save.isPending
  const onError = (failure: unknown) => toast.error(errorText(t, failure))
  return (
    <SectionCard title={t(`${L}.start.title`)} description={t(`${L}.start.text`)}>
      {can ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              reset.mutate("starter", { onError })
            }}
          >
            {reset.isPending ? <Loader2 className="animate-spin" /> : <FileText />}
            {t(`${L}.start.starter`)}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              // The starter's title, the text left to write
              void client.query(legalStarterQuery(kind)).then(({ starter }) => {
                save.mutate(
                  { title: starter.title, body: { type: "doc", content: [{ type: "paragraph" }] } },
                  { onError }
                )
              }, onError)
            }}
          >
            {t(`${L}.start.blank`)}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${L}.start.readOnly`)}</p>
      )}
    </SectionCard>
  )
}

/** The page's own actions: see the text as customers will, and publish the draft. */
function Actions({ detail }: { detail: LegalDetail }) {
  const { t } = useTranslation()
  const can = useCan("legalTexts")
  const publish = usePublishLegal(detail.kind)
  const preview = usePreviewLegal(detail.kind)
  const [asking, setAsking] = useState(false)
  const shown = detail.draft ?? detail.published
  if (!shown || !can) {
    return null
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={preview.isPending}
        onClick={() => {
          preview.mutate(shown.body, { onError: (failure) => toast.error(errorText(t, failure)) })
        }}
      >
        {preview.isPending ? <Loader2 className="animate-spin" /> : <Eye />}
        {t(`${L}.actions.preview`)}
      </Button>
      {detail.draft ? (
        <Button
          disabled={publish.isPending}
          onClick={() => {
            setAsking(true)
          }}
        >
          {publish.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {t(`${L}.actions.publish`)}
        </Button>
      ) : null}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${L}.publish.title`, { version: detail.draft?.version ?? 0 })}
        description={t(`${L}.publish.text`)}
        confirmLabel={t(`${L}.actions.publish`)}
        onConfirm={() => {
          setAsking(false)
          publish.mutate(undefined, {
            onSuccess: () => toast.success(t(`${L}.publish.done`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
      {preview.data ? (
        <LegalPreviewDialog
          title={shown.title}
          html={preview.data}
          onClose={() => {
            preview.reset()
          }}
        />
      ) : null}
    </>
  )
}

/**
 * One legal text (F13.1): which version is in force and whether a draft
 * waits, the draft or published text in the editor, the tokens it may
 * use, every version published. Publishing makes the draft the text in
 * force; it is never changed again (adr/0041 §1).
 */
export function LegalKindPage() {
  const { t } = useTranslation()
  const { kind } = route.useParams()
  const query = useQuery(legalKindQuery(kind as LegalKind))
  // The editor's unsaved changes, which dropping or restarting the draft would lose
  const [dirty, setDirty] = useState(false)
  const back = { to: "/settings/legal", label: t(`${L}.title`) }
  const detail = query.data
  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t(`${L}.kinds.${kind}.name`)} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  const shown = detail?.draft ?? detail?.published ?? null
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${L}.kinds.${kind}.name`)}
        description={t(`${L}.kinds.${kind}.description`)}
        back={back}
        action={detail ? <Actions detail={detail} /> : undefined}
      />
      {!detail ? (
        <LoadingRows rows={4} />
      ) : !shown ? (
        // Nothing to edit yet: tokens and versions come with the first draft
        <StartCard kind={detail.kind} />
      ) : (
        <>
          <LegalStateCard detail={detail} dirty={dirty} />
          <PageGrid>
            <PageColumn span={8}>
              <LegalEditorCard
                key={`${shown.id}-${shown.updated_at}`}
                kind={detail.kind}
                stored={shown}
                isDraft={detail.draft !== null}
                onDirtyChange={setDirty}
              />
            </PageColumn>
            <PageColumn span={4}>
              <TokensCard kind={detail.kind} />
              <VersionsCard history={detail.history} />
            </PageColumn>
          </PageGrid>
        </>
      )}
    </div>
  )
}
