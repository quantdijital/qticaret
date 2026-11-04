import { FileText, Loader2, PencilLine, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { useCan } from "@/features/auth/api/staff"
import { useDiscardLegalDraft, useResetLegalDraft } from "@/features/legal/api"
import type { LegalDetail, LegalVersion } from "@/features/legal/api"
import { DraftConfirm } from "@/features/legal/components/legal-draft-confirm"
import type { DraftAction } from "@/features/legal/components/legal-draft-confirm"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const S = "settings.legal.state"
const A = "settings.legal.actions"

/** One side of the text: what is in force or what is being written, its number and date. */
function StatePane({
  label,
  version,
  line,
  empty,
  editing,
  tone,
  children,
}: {
  label: string
  version: LegalVersion | null
  line: string
  empty: string
  /** Whether the editor below holds this one. */
  editing: boolean
  tone: "success" | "info"
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {version ? (
          <StatusBadge tone={tone}>{t(`${S}.version`, { version: version.version })}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{t(`${S}.none`)}</StatusBadge>
        )}
        {editing ? <StatusBadge tone="neutral">{t(`${S}.editing`)}</StatusBadge> : null}
      </div>
      <p className="text-[13px] text-muted-foreground">{version ? line : empty}</p>
      {children ? <div className="mt-auto flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}

/**
 * The text's state (the owner, 2026-11-04): the version in force and the
 * draft, each with its number and date, and what can be done with the
 * draft: open one from the published text, drop it, or start again from
 * the platform's starter. Whatever would be lost is asked about first.
 */
export function LegalStateCard({ detail, dirty }: { detail: LegalDetail; dirty: boolean }) {
  const { t } = useTranslation()
  const can = useCan("legalTexts")
  const reset = useResetLegalDraft(detail.kind)
  const discard = useDiscardLegalDraft(detail.kind)
  const [asking, setAsking] = useState<DraftAction | null>(null)
  const { published, draft } = detail
  const busy = reset.isPending || discard.isPending
  const pending: DraftAction | null = discard.isPending
    ? "discard"
    : reset.isPending
      ? reset.variables === "published"
        ? "editPublished"
        : "starter"
      : null

  const run = (action: DraftAction) => {
    setAsking(null)
    const handlers = {
      onSuccess: () => toast.success(t(`settings.legal.${action}.done`)),
      onError: (failure: unknown) => toast.error(errorText(t, failure)),
    }
    if (action === "discard") {
      discard.mutate(undefined, handlers)
    } else {
      reset.mutate(action === "editPublished" ? "published" : "starter", handlers)
    }
  }
  // Dropping asks always; the rest only when a draft or unsaved changes would go
  const start = (action: DraftAction) => {
    if (action === "discard" || dirty || (action === "starter" && draft !== null)) {
      setAsking(action)
    } else {
      run(action)
    }
  }
  const button = (action: DraftAction, icon: ReactNode) => (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => {
        start(action)
      }}
    >
      {pending === action ? <Loader2 className="animate-spin" /> : icon}
      {t(`${A}.${action}`)}
    </Button>
  )

  return (
    <SectionCard title={t(`${S}.title`)} description={t(`${S}.description`)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatePane
          label={t(`${S}.published`)}
          version={published}
          line={
            published?.published_at
              ? t(`${S}.publishedAt`, { date: formatDateTime(published.published_at) })
              : ""
          }
          empty={t(`${S}.noPublished`)}
          editing={draft === null}
          tone="success"
        >
          {can && published && !draft ? button("editPublished", <PencilLine />) : null}
        </StatePane>
        <StatePane
          label={t(`${S}.draft`)}
          version={draft}
          line={draft ? t(`${S}.savedAt`, { date: formatDateTime(draft.updated_at) }) : ""}
          empty={t(`${S}.noDraft`)}
          editing={draft !== null}
          tone="info"
        >
          {can ? (
            <>
              {draft ? button("discard", <Trash2 />) : null}
              {button("starter", <FileText />)}
            </>
          ) : null}
        </StatePane>
      </div>
      <DraftConfirm
        action={asking}
        hasDraft={draft !== null}
        hasPublished={published !== null}
        dirty={dirty}
        onCancel={() => {
          setAsking(null)
        }}
        onConfirm={run}
      />
    </SectionCard>
  )
}
