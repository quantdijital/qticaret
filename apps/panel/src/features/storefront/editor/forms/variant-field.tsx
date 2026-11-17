import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { SECTION_VARIANTS } from "@qticaret/types"
import type { SectionVariant, VariantSectionType } from "@qticaret/types"
import { isUnbuilt } from "@/features/storefront/layout/variants"
import { VariantSketch } from "./variant-sketches"

const V = "storefront.editor.variants"

/**
 * How a section is drawn (adr/0049 Ek 2026-11-14 §2.6, §6): its type's
 * variants side by side, each drawn in small with its everyday name, as
 * the rail's columns are (Ek 2026-11-05); the preview shows the pick at once.
 */
export function VariantField<T extends VariantSectionType>({
  id,
  type,
  value,
  onChange,
}: {
  id: string
  type: T
  value: SectionVariant<T>
  onChange: (next: SectionVariant<T>) => void
}) {
  const { t } = useTranslation()
  const variants: readonly SectionVariant<T>[] = SECTION_VARIANTS[type]
  // What a variant does is in its group's (i); that the one picked is not drawn yet shows
  const kept = isUnbuilt(type, value)
  return (
    <div id={id} className="flex flex-col gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        // Apart, each choice keeps its whole edge (joined, a third one alone on its row lost its left side)
        spacing={2}
        aria-label={t("storefront.editor.panel.variant")}
        aria-describedby={kept ? `${id}-kept` : undefined}
        value={value}
        onValueChange={(next) => {
          if (next && next !== value) {
            onChange(next as SectionVariant<T>)
          }
        }}
        className="grid w-full grid-cols-2"
      >
        {variants.map((variant) => (
          <ToggleGroupItem
            key={variant}
            value={variant}
            disabled={variant !== value && isUnbuilt(type, variant)}
            className="h-auto flex-col gap-1.5 px-3 py-2.5 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            <VariantSketch type={type} variant={variant} />
            <span>
              {isUnbuilt(type, variant)
                ? t(`${V}.soon`, { name: t(`${V}.${type}.${variant}`) })
                : t(`${V}.${type}.${variant}`)}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {kept ? (
        <p id={`${id}-kept`} className="text-xs text-muted-foreground">
          {t(`${V}.kept`)}
        </p>
      ) : null}
    </div>
  )
}
