import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { presetFitQuery } from "./api"
import type { ApplyScope, PresetCard, UnfitSection } from "./api"

const A = "storefront.gallery.apply"
const SCOPES: readonly ApplyScope[] = ["style", "full"]

/** A section by the look's own title, else by its type's name in the editor. */
const sectionName = (t: TFunction, each: UnfitSection) =>
  each.title ?? t(`storefront.editor.types.${each.type}.name`, { defaultValue: each.type })

/**
 * The sections applying another sector's look whole would leave out in
 * this shop (owner, 2026-11-28), read before anything is written:
 * "3 bölüm bu mağazada karşılığı olmadığı için eklenmedi: …".
 */
function UnfitList({ preset }: { preset: PresetCard }) {
  const { t } = useTranslation()
  const fit = useQuery(presetFitQuery(preset))
  if (fit.isPending) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t(`${A}.fit.loading`)}
      </p>
    )
  }
  if (fit.isError) {
    return <p className="text-xs text-muted-foreground">{t(`${A}.fit.unknown`)}</p>
  }
  if (fit.data.length === 0) {
    return <p className="text-xs text-muted-foreground">{t(`${A}.fit.none`)}</p>
  }
  return (
    <div className="flex flex-col gap-1 text-xs leading-5 text-muted-foreground">
      <p>
        {t(`${A}.fit.left`, {
          count: fit.data.length,
          names: fit.data.map((each) => sectionName(t, each)).join(", "),
        })}
      </p>
    </div>
  )
}

/**
 * What of another sector's look the draft takes: its style alone (the
 * default: colours, type, corners, cards; the shop's sections stay), or
 * its sections with it, those bound to records the shop lacks left out
 * and listed here.
 */
export function ApplyScopePicker({
  preset,
  scope,
  onChange,
}: {
  preset: PresetCard
  scope: ApplyScope
  onChange: (scope: ApplyScope) => void
}) {
  const { t } = useTranslation()
  const ids = useId()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{t(`${A}.madeFor`, { sector: preset.sector.name })}</p>
      <RadioGroup
        aria-label={t(`${A}.scope.label`)}
        value={scope}
        onValueChange={(value) => {
          onChange(value === "full" ? "full" : "style")
        }}
        className="gap-2"
      >
        {SCOPES.map((each) => (
          <div
            key={each}
            className="flex items-start gap-2.5 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
          >
            <RadioGroupItem
              id={`${ids}-${each}`}
              value={each}
              aria-describedby={`${ids}-${each}-hint`}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`${ids}-${each}`} className="leading-5">
                {t(`${A}.scope.${each}`)}
              </Label>
              <p id={`${ids}-${each}-hint`} className="text-xs leading-5 text-muted-foreground">
                {t(`${A}.scope.${each}Hint`)}
              </p>
              {each === "full" && scope === "full" ? <UnfitList preset={preset} /> : null}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}
