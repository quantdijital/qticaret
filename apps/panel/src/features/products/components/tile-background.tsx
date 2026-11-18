import { useTranslation } from "react-i18next"
import { AiBackgroundDialog } from "@/features/ai/components/ai-background-dialog"

export interface TileBackgroundProps {
  /** The tile's picture: its media record and address. */
  source: { id: string; url: string }
  onClose: () => void
  /** Adds the new picture to the product, after its others; the page saves it as any added picture. */
  onAdd: (stored: { id: string; url: string }) => void
  /** No room left on the product: "Kullan" says why instead. */
  full: boolean
  max: number
}

/**
 * A product picture's "Arka planı temizle" (docs/22 PR 4-2): the new
 * picture is added to the product beside the original, which stays on
 * it; removing the original is the person's own choice.
 */
export function TileBackground({ source, onClose, onAdd, full, max }: TileBackgroundProps) {
  const { t } = useTranslation()
  return (
    <AiBackgroundDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      source={source}
      useNote={t("ai.background.useProduct")}
      blocked={full ? t("ai.background.full", { max }) : null}
      onUse={(picture) => {
        onAdd({ id: picture.file_id ?? picture.id, url: picture.url })
      }}
    />
  )
}
