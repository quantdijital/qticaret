import { ArrowDown, ArrowUp, Check, ImagePlus, X } from "lucide-react"
import { useState } from "react"
import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@/components/ui/button"
import { DialogSection } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { MediaAsset } from "@/features/media/api/media"
import type { ProductDetail } from "@/features/products/api/products"
import { MAX_IMAGES } from "@/features/products/components/image-gallery"
import { cn } from "@/lib/utils"
import { ALT_MAX, moveTied, sortedImages, tiedTo } from "./variant-values"
import type { VariantImage, VariantValues } from "./variant-values"

const D = "products.variant"

/** The other variants each stored picture is tied to, by the picture's key. */
function tiesOf(product: ProductDetail, variantId: string): Map<string, string[]> {
  const titles = new Map((product.variants ?? []).map((each) => [each.id, each.title ?? ""]))
  return new Map(
    sortedImages(product).map((image) => [
      image.id,
      tiedTo(image)
        .filter((id) => id !== variantId)
        .map((id) => titles.get(id) ?? ""),
    ])
  )
}

/**
 * The variant's pictures (Medusa's variant images): picked from the
 * product's by clicking them, more added from the media library (they join
 * the product's gallery too), the variant's own put in order and each
 * described. A picture tied to no variant shows with all of them.
 */
export function VariantPictures({
  form,
  product,
  variantId,
}: {
  form: UseFormReturn<VariantValues>
  product: ProductDetail
  variantId: string
}) {
  const { t } = useTranslation()
  const images = useWatch({ control: form.control, name: "images" })
  const [picking, setPicking] = useState(false)
  const ties = tiesOf(product, variantId)
  const errors = form.formState.errors.images
  const set = (next: VariantImage[]) => {
    form.setValue("images", next, { shouldDirty: true })
  }
  const room = MAX_IMAGES - images.length
  const add = (assets: MediaAsset[]) => {
    const known = new Set(images.map((image) => image.url))
    const fresh = assets.filter((asset) => !known.has(asset.url)).slice(0, Math.max(room, 0))
    const urls = new Set(assets.map((asset) => asset.url))
    set([
      // One the product has already is tied, not added twice
      ...images.map((image) => (urls.has(image.url) ? { ...image, tied: true } : image)),
      ...fresh.map((asset) => ({
        key: `new-${asset.id}`,
        url: asset.url,
        imageId: null,
        mediaId: asset.id,
        alt: asset.alt ?? "",
        tied: true,
      })),
    ])
  }
  // A picture picked here and not saved yet leaves the dialog when untied; a stored one stays
  const toggle = (key: string) => {
    set(
      images.flatMap((each) =>
        each.key !== key
          ? [each]
          : each.tied && each.imageId === null
            ? []
            : [{ ...each, tied: !each.tied }]
      )
    )
  }
  const own = images.flatMap((image, index) => (image.tied ? [{ image, index }] : []))
  const stateOf = (image: VariantImage) => {
    const others = ties.get(image.key) ?? []
    return image.tied
      ? t(`${D}.pictureOwn`)
      : others.length > 0
        ? t(`${D}.pictureOthers`, { names: others.join(", ") })
        : t(`${D}.pictureAll`)
  }
  return (
    <DialogSection title={t(`${D}.pictures`)} description={t(`${D}.picturesHint`)}>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {images.map((image, index) => (
          <li key={image.key}>
            <button
              type="button"
              aria-pressed={image.tied}
              aria-label={t(`${D}.pictureToggle`, { position: index + 1, state: stateOf(image) })}
              title={stateOf(image)}
              onClick={() => {
                toggle(image.key)
              }}
              className={cn(
                "relative block aspect-square w-full overflow-hidden rounded-md border bg-muted outline-hidden transition-shadow focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
                image.tied ? "border-primary ring-2 ring-primary" : "hover:border-input"
              )}
            >
              <img src={image.url} alt="" className="size-full object-cover" />
              {image.tied ? (
                <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              ) : null}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={room <= 0}
            onClick={() => {
              setPicking(true)
            }}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground outline-hidden transition-colors hover:border-input hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {t(`${D}.addPicture`)}
          </button>
        </li>
      </ul>
      <div className="flex flex-col gap-1">
        <h4 className="text-[13px] font-medium">{t(`${D}.ownPictures`, { count: own.length })}</h4>
        {own.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t(`${D}.noOwnPictures`)}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {own.map(({ image, index }, at) => {
              const error = errors?.[index]?.alt?.message
              const id = `variant-alt-${String(at)}`
              return (
                <li key={image.key} className="flex items-start gap-3 py-2.5">
                  <img
                    src={image.url}
                    alt=""
                    className="size-12 shrink-0 rounded-md border object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <label htmlFor={id} className="text-xs text-muted-foreground">
                      {t("products.media.altLabel", { position: at + 1 })}
                    </label>
                    <Input
                      id={id}
                      value={image.alt}
                      maxLength={ALT_MAX}
                      disabled={image.mediaId === null}
                      placeholder={t(
                        image.mediaId ? "products.media.altPlaceholder" : "products.media.altLegacy"
                      )}
                      aria-invalid={Boolean(error)}
                      onChange={(event) => {
                        form.setValue(`images.${index}.alt`, event.target.value, {
                          shouldDirty: true,
                        })
                      }}
                    />
                    {error ? (
                      <p role="alert" className="text-xs text-destructive-text">
                        {t(error)}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-5 flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={at === 0}
                      aria-label={t(`${D}.moveUp`, { position: at + 1 })}
                      onClick={() => {
                        set(moveTied(images, image.key, -1))
                      }}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={at === own.length - 1}
                      aria-label={t(`${D}.moveDown`, { position: at + 1 })}
                      onClick={() => {
                        set(moveTied(images, image.key, 1))
                      }}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t(`${D}.untie`, { position: at + 1 })}
                      onClick={() => {
                        toggle(image.key)
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, room)}
        title={t(`${D}.addPictures`)}
        onSelect={add}
      />
    </DialogSection>
  )
}
