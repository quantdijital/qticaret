import { ExternalLink, Loader2, Rocket, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { BarButton } from "./bar-button"
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

/** Put the draft live, once asked. */
export function PublishButton({ actions, changed }: PublishControlsProps) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <BarButton
        wideOnly={false}
        icon={actions.publishing ? <Loader2 className="animate-spin" /> : <Rocket />}
        label={t(`${E}.publish.open`)}
        disabled={!changed || actions.busy}
        onClick={() => {
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
          void actions.publish()
        }}
      />
    </>
  )
}
