import { RotateCcw } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { SectionLook, SectionLookField, SectionLookStep } from "@qticaret/types"
import type { LookedSection } from "@/features/storefront/api/layout"
import {
  lookFieldsFor,
  lookStep,
  lookStepsFor,
  withLookStep,
} from "@/features/storefront/layout/look"
import { FIELD_IDS } from "./field-registry"
import { LookSketch } from "./look-sketches"

const LOOK = "storefront.editor.look"

// The steps side by side, as many columns as the field has steps
const COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

/**
 * One look field (adr/0049 Ek 2026-11-14 §6): its everyday Turkish name
 * with the technical term small beside it ("Dış boşluk" margin), its steps
 * side by side each drawn in small, and "Varsayılana dön" once a step is
 * set. No step picked is the theme's own drawing; picking the chosen one
 * again puts it back too.
 */
function LookField<F extends SectionLookField>({
  section,
  field,
  onChange,
}: {
  section: LookedSection
  field: F
  onChange: (step: SectionLook[F]) => void
}) {
  const { t } = useTranslation()
  // The settings search scrolls to it (`field-registry.ts`)
  const id = FIELD_IDS.look(section.id, field)
  const value = lookStep(section, field)
  const steps: readonly SectionLookStep<F>[] = lookStepsFor(section.type, field)
  const group = useRef<HTMLDivElement>(null)
  return (
    <div id={id} data-look-field={field} className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {t(`${LOOK}.${field}.label`)}{" "}
          <small className="text-[11px] font-normal text-muted-foreground">
            {t(`${LOOK}.${field}.term`)}
          </small>
        </span>
        {value !== null ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onChange(null)
              // The button goes once reset: the focus stays on the field, not the page
              group.current?.querySelector<HTMLElement>("[role=radio]")?.focus()
            }}
          >
            <RotateCcw />
            {t(`${LOOK}.reset`)}
          </Button>
        ) : null}
      </div>
      <ToggleGroup
        ref={group}
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        aria-describedby={value === null ? undefined : `${id}-hint`}
        value={value ?? ""}
        onValueChange={(next) => {
          onChange(next === "" ? null : (next as SectionLook[F]))
        }}
        className={cn("grid w-full", COLUMNS[steps.length])}
      >
        {steps.map((step) => (
          <ToggleGroupItem
            key={step}
            value={step}
            className="h-auto min-w-0 flex-col gap-1 px-1.5 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            <LookSketch field={field} step={step} />
            <span className="truncate">{t(`${LOOK}.${field}.${step}`)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {value === null ? null : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t(`${LOOK}.${field}.hint`)}
        </p>
      )}
    </div>
  )
}

/**
 * A body section's look, in the closed "Görünüm ayarları" group: only the
 * fields its type offers (no alignment where the words sit on a picture),
 * each set and reset on its own; every change shows in the preview at once.
 */
export function LookFields<S extends LookedSection>({
  section,
  onChange,
}: {
  section: S
  onChange: (section: S, field?: string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {lookFieldsFor(section.type).map((field) => (
        <LookField
          key={field}
          section={section}
          field={field}
          onChange={(step) => {
            // Each pick its own step in the history: "Geri al" brings the last one back
            onChange(withLookStep(section, field, step))
          }}
        />
      ))}
    </div>
  )
}
