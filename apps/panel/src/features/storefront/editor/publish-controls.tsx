import { ExternalLink, Loader2, Rocket, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { BarButton } from "./bar-button"
import { PublishPages } from "./publish-pages"
import { useDraftPages } from "./use-content-pages"
import type { useEditorActions } from "./use-editor-actions"

const E = "storefront.editor"

interface PublishControlsProps {
  actions: ReturnType<typeof useEditorActions>
  /** The draft differs from what is live, or a change waits to join it. */
  changed: boolean
}

/** Throw the draft's changes away (asked first: it cannot be undone), or open it in a tab. */
export function DraftTools({ actions, changed }: PublishControlsProps) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  return (
    <>
      {changed ? (
        <BarButton
          variant="ghost"
          icon={<RotateCcw />}
          label={t(`${E}.discard.open`)}
          disabled={actions.busy}
          onClick={() => {
            setAsking(true)
          }}
        />
      ) : null}
      <BarButton
        variant="outline"
        icon={actions.previewing ? <Loader2 className="animate-spin" /> : <ExternalLink />}
        label={t(`${E}.preview.open`)}
        disabled={actions.previewing}
        onClick={() => void actions.openPreview()}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${E}.discard.title`)}
        description={t(`${E}.discard.text`)}
        confirmLabel={t(`${E}.discard.confirm`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          actions.discard()
        }}
      />
    </>
  )
}

/**
 * Put the draft live, once asked; the content pages in draft it lays out
 * may go live with it (adr/0073 Ek 2026-11-19 (2) K5), the one being
 * edited ticked.
 */
export function PublishButton({
  actions,
  changed,
  doc,
  editing = null,
}: PublishControlsProps & {
  doc: LayoutDocument
  /** The content page being edited, ticked to go live with the design. */
  editing?: string | null
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const pages = useDraftPages(doc)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  return (
    <>
      <BarButton
        wideOnly={false}
        icon={actions.publishing ? <Loader2 className="animate-spin" /> : <Rocket />}
        label={t(`${E}.publish.open`)}
        disabled={!changed || actions.busy}
        onClick={() => {
          setChosen(
            new Set(editing !== null && pages.some((page) => page.id === editing) ? [editing] : [])
          )
          setAsking(true)
        }}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${E}.publish.title`)}
        description={t(`${E}.publish.text`)}
        confirmLabel={t(`${E}.publish.confirm`)}
        onConfirm={() => {
          setAsking(false)
          void actions.publish(pages.filter((page) => chosen.has(page.id)).map((page) => page.id))
        }}
      >
        <PublishPages pages={pages} chosen={chosen} onChange={setChosen} />
      </ConfirmDialog>
    </>
  )
}
