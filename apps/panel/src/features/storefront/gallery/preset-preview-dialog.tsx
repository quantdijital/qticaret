import { useTranslation } from "react-i18next"
import { DialogHeading } from "@qticaret/admin-ui/patterns/dialog-heading"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@qticaret/admin-ui/ui/dialog"
import type { PresetCard } from "./api"
import { LookFacts } from "./look-facts"
import { PresetBadges, PresetPicture } from "./preset-card"

const G = "storefront.gallery"

interface PresetPreviewDialogProps {
  preset: PresetCard | null
  onClose: () => void
  onApply: (preset: PresetCard) => void
}

/**
 * A ready-made look up close (adr/0064 K6 a): its picture (or sketch)
 * large, the whole description and what it brings; "Uygula" from here too.
 */
export function PresetPreviewDialog({ preset, onClose, onApply }: PresetPreviewDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={preset !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      {preset ? (
        <DialogContent size="lg">
          <DialogHeading title={preset.name} />
          <DialogBody>
            <PresetPicture preset={preset} />
            {preset.preview_url ? null : (
              <p className="text-xs text-muted-foreground">{t(`${G}.presets.noPreview`)}</p>
            )}
            <PresetBadges preset={preset} />
            <p className="text-sm leading-6">{preset.description}</p>
            <LookFacts summary={preset.summary} />
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-5 text-muted-foreground">
              <li>{t(preset.has_menus ? `${G}.apply.menusReplaced` : `${G}.apply.menusKept`)}</li>
              <li>
                {t(
                  preset.has_header && preset.has_footer
                    ? `${G}.apply.frameReplaced`
                    : `${G}.presets.frameShop`
                )}
              </li>
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(preset)
              }}
            >
              {t(`${G}.presets.apply`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
