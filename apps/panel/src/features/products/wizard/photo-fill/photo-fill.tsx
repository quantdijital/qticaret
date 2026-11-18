import { useQuery } from "@tanstack/react-query"
import { ImagePlus, Loader2, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import { useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { aiServicesQuery } from "@/features/ai/api/ai"
import type { AiEntity } from "@/features/ai/api/suggestions"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiSuggestionBox } from "@/features/ai/components/ai-suggestion-box"
import { serviceName } from "@/features/ai/failure-text"
import { hintClosed } from "@/features/ai/hint-state"
import { PRODUCT_FROM_PHOTO_TASK } from "@/features/ai/product-card"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"
import { categoriesQuery } from "@/features/products/api/lookups"
import { registerMedia } from "@/features/products/api/media"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import type { WizardValues } from "../schema"
import { productDefinitions, useWizardTemplate } from "../wizard-template"
import { cardFields } from "./apply-card"
import { PhotoCardPreview } from "./photo-card-preview"

const P = "products.wizard.photo"
// What the vision task reads (the media pipeline's stored masters); an SVG never
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif"
// The hook's record until a photo is uploaded; every ask names its own
const NO_PHOTO: AiEntity = { type: "media", id: "" }

interface Photo {
  mediaId: string
  fileId: string
  url: string
}

/** A file from this computer as a product image (F3.3), as the gallery uploads one. */
async function uploadPhoto(file: File): Promise<Photo> {
  const { files } = await sdk.admin.upload.create({ files: [file] })
  const stored = files[0]
  if (!stored) {
    throw new Error("upload returned no file")
  }
  const { media } = await registerMedia([stored.id])
  const [asset] = media
  if (!asset) {
    throw new Error("media registration returned no record")
  }
  return { mediaId: asset.id, fileId: stored.id, url: asset.url }
}

function PhotoFillDialog(props: {
  usable: string[]
  preference: string | null
  onClose: () => void
  onHintClosed: () => void
}) {
  const { usable, preference, onClose, onHintClosed } = props
  const { t } = useTranslation()
  const form = useFormContext<WizardValues>()
  const template = useWizardTemplate()
  const categories = useQuery(categoriesQuery())
  const suggestion = useAiSuggestion(PRODUCT_FROM_PHOTO_TASK, NO_PHOTO)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const several = usable.length > 1
  const remembered = preference && usable.includes(preference) ? preference : null
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const { state } = suggestion
  const busy = uploading || state.status === "loading"
  const definitions = productDefinitions(template)

  const ask = (mediaId: string, chosen: string = service) => {
    void suggestion.request({
      entity: { type: "media", id: mediaId },
      // With one service the backend picks it; the name is sent only when there was a choice
      ...(several ? { service: chosen } : {}),
      ...(template ? { templateId: template.id } : {}),
    })
  }

  const choose = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadPhoto(file)
      setPhoto(uploaded)
      ask(uploaded.mediaId)
    } catch (failure) {
      toast.error(`${t(`${P}.uploadFailed`)} ${errorText(t, failure)}`)
    } finally {
      setUploading(false)
    }
  }

  const close = () => {
    suggestion.dismiss()
    onClose()
  }

  const card = state.status === "suggestion" ? (state.suggestion.card ?? null) : null
  const categoryName = (id: string | null) =>
    id ? (categories.data?.find((each) => each.id === id)?.name ?? null) : null

  const use = async () => {
    if (!card || !photo) {
      return
    }
    await suggestion.accept()
    const next = cardFields(
      form.getValues(),
      card,
      { id: photo.fileId, url: photo.url },
      definitions,
      new Set((categories.data ?? []).map((each) => each.id))
    )
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      form.setValue(key, next[key], { shouldDirty: true })
    }
    toast.success(t(`${P}.used`))
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t(`${P}.title`)}</DialogTitle>
          <DialogDescription>{t(`${P}.description`)}</DialogDescription>
        </DialogHeader>
        {usable.length === 0 ? (
          <AiConnectHint
            words={`${P}.hint`}
            onClose={() => {
              onHintClosed()
              onClose()
            }}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {photo ? (
                <img
                  src={photo.url}
                  alt={t(`${P}.photoAlt`)}
                  className="size-20 rounded-md border object-cover"
                />
              ) : null}
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  void choose(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {uploading ? t(`${P}.uploading`) : t(photo ? `${P}.change` : `${P}.pick`)}
              </Button>
              <div className="min-w-48 flex-1">
                <AiServicePicker
                  services={usable}
                  value={service}
                  disabled={busy}
                  onChange={(id) => {
                    setPicked(id)
                    if (photo) {
                      ask(photo.mediaId, id)
                    }
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`${P}.note`, { name: serviceName(t, service) })}
            </p>
            {photo && state.status !== "idle" ? (
              <AiSuggestionBox
                state={state}
                preview={
                  card ? (
                    <PhotoCardPreview
                      card={card}
                      categoryName={categoryName(card.category_id)}
                      definitions={definitions}
                    />
                  ) : undefined
                }
                onUse={() => void use()}
                onRetry={() => void suggestion.retry()}
                onTryWith={(id) => {
                  if (usable.includes(id)) {
                    setPicked(id)
                  }
                  void suggestion.tryWith(id)
                }}
                onDismiss={close}
              />
            ) : null}
          </div>
        )}
        {photo && state.status !== "idle" && usable.length > 0 ? null : (
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              {t("ai.suggest.dismiss")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Fotoğraftan doldur" on the new product form (docs/22 "Aşama 6"): a
 * photo is uploaded, a card suggested, its fields shown, and "Kullan"
 * fills the form, the photo as its first picture. Nothing is saved until
 * the form is. No service: the same button opens the connect tip, until
 * it is closed for good; a role the task does not allow sees nothing.
 */
export function PhotoFillButton() {
  const { t } = useTranslation()
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === PRODUCT_FROM_PHOTO_TASK)
  const usable = view?.usable ?? []
  const [open, setOpen] = useState(false)
  const [hintGone, setHintGone] = useState(hintClosed)
  if (!view?.allowed || (usable.length === 0 && hintGone)) {
    return null
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Sparkles />
        {t(`${P}.button`)}
      </Button>
      {open ? (
        <PhotoFillDialog
          usable={usable}
          preference={view.preference}
          onClose={() => {
            setOpen(false)
          }}
          onHintClosed={() => {
            setHintGone(true)
          }}
        />
      ) : null}
    </>
  )
}
