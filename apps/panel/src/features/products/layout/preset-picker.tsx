import { useTranslation } from "react-i18next"
import { Kbd, KbdGroup } from "@qticaret/admin-ui/ui/kbd"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { PRESETS, applyPreset, presetOf } from "./presets"
import type { ProductLayout } from "./parts"

const L = "products.layout"

/**
 * "Basit · Standart · Gelişmiş" at the top of "Sayfayı düzenle": one click
 * fills the draft, the page behind follows; nothing is kept before
 * "Kaydet". The one the draft is now is pressed; arranged by hand, none.
 */
export function PresetPicker({
  layout,
  onDraft,
}: {
  layout: ProductLayout
  onDraft: (draft: ProductLayout) => void
}) {
  const { t } = useTranslation()
  const current = presetOf(layout)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{t(`${L}.presets`)}</h3>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={current ?? ""}
        aria-label={t(`${L}.presets`)}
        onValueChange={(next) => {
          const preset = PRESETS.find((each) => each === next)
          if (preset) {
            onDraft(applyPreset(preset, layout))
          }
        }}
        className="w-full"
      >
        {PRESETS.map((preset) => (
          <ToggleGroupItem key={preset} value={preset} className="flex-1">
            {t(`${L}.preset.${preset}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-[13px] text-muted-foreground">
        {t(`${L}.presetHint.${current ?? "custom"}`)}
      </p>
    </section>
  )
}

/** The page's shortcuts, said under the lists of "Sayfayı düzenle". */
export function ShortcutsHint() {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h3 className="text-xs font-medium text-muted-foreground">{t(`${L}.shortcuts`)}</h3>
      <dl className="flex flex-col gap-1.5 text-[13px]">
        {([["K", "shortcutGo"]] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t(`${L}.${label}`)}</dt>
            <dd>
              <KbdGroup>
                <Kbd>{t(`${L}.modKey`)}</Kbd>
                <Kbd>{key}</Kbd>
              </KbdGroup>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
