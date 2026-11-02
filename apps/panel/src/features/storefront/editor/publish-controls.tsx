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

/** Throw the draft's changes away, open it in a tab, or put it live: each asks first where it cannot be undone. */
export function PublishControls({ actions, changed }: PublishControlsProps) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState<"publish" | "discard" | null>(null)
  const close = (open: boolean) => {
    if (!open) {
      setAsking(null)
    }
  }
  return (
    <>
      {changed ? (
        <BarButton
          variant="ghost"
          icon={<RotateCcw />}
          label={t(`${E}.discard.open`)}
          disabled={actions.busy}
          onClick={() => {
            setAsking("discard")
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
      <BarButton
        wideOnly={false}
        icon={actions.publishing ? <Loader2 className="animate-spin" /> : <Rocket />}
        label={t(`${E}.publish.open`)}
        disabled={!changed || actions.busy}
        onClick={() => {
          setAsking("publish")
        }}
      />
      <ConfirmDialog
        open={asking === "publish"}
        onOpenChange={close}
        title={t(`${E}.publish.title`)}
        description={t(`${E}.publish.text`)}
        confirmLabel={t(`${E}.publish.confirm`)}
        onConfirm={() => {
          setAsking(null)
          void actions.publish()
        }}
      />
      <ConfirmDialog
        open={asking === "discard"}
        onOpenChange={close}
        title={t(`${E}.discard.title`)}
        description={t(`${E}.discard.text`)}
        confirmLabel={t(`${E}.discard.confirm`)}
        destructive
        onConfirm={() => {
          setAsking(null)
          actions.discard()
        }}
      />
    </>
  )
}
