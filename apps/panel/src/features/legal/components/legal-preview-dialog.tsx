import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// A page of its own, as a storefront would show it: the browser's own colours
const FRAME_STYLE =
  "body{font:15px/1.6 system-ui,sans-serif;margin:24px;color:CanvasText;background:Canvas}" +
  "table{border-collapse:collapse}td,th{border:1px solid GrayText;padding:4px 8px;text-align:left}" +
  "blockquote{margin:0 0 16px;padding:8px 12px;border-left:3px solid GrayText}"

/**
 * The text as customers will read it, its tokens filled (a contract with a
 * made-up order). The server's HTML, in a frame that runs nothing.
 */
export function LegalPreviewDialog({
  title,
  html,
  onClose,
}: {
  title: string
  html: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("settings.legal.preview.hint")}</DialogDescription>
        </DialogHeader>
        <iframe
          title={t("settings.legal.preview.frame", { title })}
          sandbox=""
          srcDoc={`<!doctype html><meta charset="utf-8"><style>${FRAME_STYLE}</style>${html}`}
          className="h-[65vh] w-full rounded-md border"
        />
      </DialogContent>
    </Dialog>
  )
}
