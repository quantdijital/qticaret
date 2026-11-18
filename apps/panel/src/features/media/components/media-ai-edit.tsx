import { useQueryClient } from "@tanstack/react-query"
import { Wand2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { AiBackgroundDialog } from "@/features/ai/components/ai-background-dialog"
import { AiEditedBadge } from "@/features/ai/components/ai-edited-badge"
import { useBackgroundTask } from "@/features/ai/use-ai-background"
import { MEDIA_KEY } from "@/features/media/api/media"
import type { MediaDetail } from "@/features/media/api/media"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

const B = "ai.background"

// What a service can edit: a stored raster picture (an SVG logo is a document)
const EDITABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])

/**
 * "Arka planı temizle" under a library picture (docs/22 PR 4-2). "Kullan"
 * keeps the new picture in the library (registered there by its file, so
 * the nightly sweep of unused uploads leaves it); the original stays as
 * it is.
 */
export function MediaBackgroundAction({ media }: { media: MediaDetail }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { allowed } = useBackgroundTask()
  const [open, setOpen] = useState(false)
  if (!allowed || media.file_id === null || !EDITABLE.has(media.mime_type ?? "")) {
    return null
  }
  const keep = async (picture: MediaDetail) => {
    try {
      if (picture.file_id) {
        await sdk.client.fetch("/admin/media", {
          method: "POST",
          body: { file_ids: [picture.file_id], library: true },
        })
      }
      toast.success(t(`${B}.kept`, { name: picture.filename }))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      await client.invalidateQueries({ queryKey: MEDIA_KEY })
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Wand2 />
        {t(`${B}.button`)}
      </Button>
      {open ? (
        <AiBackgroundDialog
          open
          onOpenChange={setOpen}
          source={{ id: media.id, url: media.url }}
          useNote={t(`${B}.useLibrary`)}
          onUse={keep}
        />
      ) : null}
    </>
  )
}

/**
 * Where an AI version came from, among the picture's facts: the badge and
 * "Türetilmiş: <asıl>", or that the original is gone (it may be deleted
 * after; the version keeps its id, adr/0071 D3).
 */
export function MediaDerivedFact({ media }: { media: MediaDetail }) {
  const { t } = useTranslation()
  if (!media.ai_source) {
    return null
  }
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{t(`${B}.source`)}</dt>
      <dd className="flex min-w-0 flex-col items-start gap-1 break-words">
        <AiEditedBadge />
        {media.derived_from_id ? (
          <span className={media.derived_from ? undefined : "text-muted-foreground"}>
            {media.derived_from
              ? t(`${B}.derivedFrom`, { name: media.derived_from.filename })
              : t(`${B}.originalGone`)}
          </span>
        ) : null}
      </dd>
    </div>
  )
}
