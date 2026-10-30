import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { Eye, FileText, Loader2, Send, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  legalKindQuery,
  legalStarterQuery,
  useDiscardLegalDraft,
  usePreviewLegal,
  usePublishLegal,
  useSaveLegalDraft,
} from "@/features/legal/api"
import type { LegalDetail, LegalKind } from "@/features/legal/api"
import { LegalEditorCard } from "@/features/legal/components/legal-editor-card"
import { LegalPreviewDialog } from "@/features/legal/components/legal-preview-dialog"
import { TokensCard, VersionsCard } from "@/features/legal/components/legal-side-cards"
import { LegalStatus } from "@/features/legal/components/legal-status"
import { errorText } from "@/lib/errors"

const L = "settings.legal"
const route = getRouteApi("/_auth/settings/legal/$kind")

/** A kind with no text yet: start from the drafted skeleton, or from nothing. */
function StartCard({ kind }: { kind: LegalKind }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveLegalDraft(kind)
  const start = async (blank: boolean) => {
    const { starter } = await client.query(legalStarterQuery(kind))
    save.mutate(
      blank
        ? { title: starter.title, body: { type: "doc", content: [{ type: "paragraph" }] } }
        : starter,
      { onError: (failure) => toast.error(errorText(t, failure)) }
    )
  }
  return (
    <SectionCard title={t(`${L}.start.title`)} description={t(`${L}.start.text`)}>
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => void start(false)}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <FileText />}
          {t(`${L}.start.starter`)}
        </Button>
        <Button variant="outline" disabled={save.isPending} onClick={() => void start(true)}>
          {t(`${L}.start.blank`)}
        </Button>
      </div>
    </SectionCard>
  )
}

function Actions({ detail }: { detail: LegalDetail }) {
  const { t } = useTranslation()
  const publish = usePublishLegal(detail.kind)
  const discard = useDiscardLegalDraft(detail.kind)
  const preview = usePreviewLegal(detail.kind)
  const [asking, setAsking] = useState<"publish" | "discard" | null>(null)
  const shown = detail.draft ?? detail.published
  if (!shown) {
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
        <>
          <Button
            variant="outline"
            onClick={() => {
              setAsking("discard")
            }}
          >
            <Trash2 />
            {t(`${L}.actions.discard`)}
          </Button>
          <Button
            onClick={() => {
              setAsking("publish")
            }}
          >
            <Send />
            {t(`${L}.actions.publish`)}
          </Button>
        </>
      ) : null}
      <ConfirmDialog
        open={asking === "publish"}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        title={t(`${L}.publish.title`, { version: detail.draft?.version ?? 0 })}
        description={t(`${L}.publish.text`)}
        confirmLabel={t(`${L}.actions.publish`)}
        onConfirm={() => {
          setAsking(null)
          publish.mutate(undefined, {
            onSuccess: () => toast.success(t(`${L}.publish.done`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
      <ConfirmDialog
        open={asking === "discard"}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        title={t(`${L}.discard.title`)}
        description={t(`${L}.discard.text`)}
        confirmLabel={t(`${L}.actions.discard`)}
        destructive
        onConfirm={() => {
          setAsking(null)
          discard.mutate(undefined, {
            onSuccess: () => toast.success(t(`${L}.discard.done`)),
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
 * One legal text (F13.1): its draft or published text in the editor, the
 * tokens it may use, every version published. Publishing makes the draft
 * the text in force; it is never changed again (adr/0041 §1).
 */
export function LegalKindPage() {
  const { t } = useTranslation()
  const { kind } = route.useParams()
  const query = useQuery(legalKindQuery(kind as LegalKind))
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
        badge={
          detail ? <LegalStatus published={detail.published} draft={detail.draft} /> : undefined
        }
        action={detail ? <Actions detail={detail} /> : undefined}
      />
      {!detail ? (
        <LoadingRows rows={4} />
      ) : !shown ? (
        // Nothing to edit yet: tokens and versions come with the first draft
        <StartCard kind={detail.kind} />
      ) : (
        <PageGrid>
          <PageColumn span={8}>
            <LegalEditorCard
              key={`${shown.id}-${shown.updated_at}`}
              kind={detail.kind}
              stored={shown}
              isDraft={detail.draft !== null}
            />
          </PageColumn>
          <PageColumn span={4}>
            <TokensCard kind={detail.kind} />
            <VersionsCard history={detail.history} />
          </PageColumn>
        </PageGrid>
      )}
    </div>
  )
}
