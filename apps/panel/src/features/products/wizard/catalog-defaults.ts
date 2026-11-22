import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useFeatureState } from "@/features/settings/api/features"
import { sectionQuery } from "@/features/settings/api/sections"
import type { WizardValues } from "./schema"

/** The shop's catalog defaults (adr/0076 §12), set by a sector pack or the shop. */
export interface CatalogDefaults {
  new_product_kind: WizardValues["kind"]
  new_product_booking_mode: WizardValues["booking_mode"]
  dated_schema_type: "TouristTrip" | "Event"
}

/**
 * A new product's kind and booking mode as the shop's defaults say, where
 * its flags let it choose them: a digital or service kind only with
 * `catalog.non_physical`, sold by departure only with `catalog.booking`
 * and as a service. Null: the wizard's own defaults stay.
 */
export function startingKind(
  defaults: CatalogDefaults,
  flags: { nonPhysical: boolean; booking: boolean }
): Pick<WizardValues, "kind" | "booking_mode"> | null {
  if (!flags.nonPhysical || defaults.new_product_kind === "physical") {
    return null
  }
  const dated =
    flags.booking &&
    defaults.new_product_kind === "service" &&
    defaults.new_product_booking_mode === "departure"
  return { kind: defaults.new_product_kind, booking_mode: dated ? "departure" : "none" }
}

/**
 * Starts the wizard's kind as the shop's defaults say, once they and the
 * flags have loaded, unless the kind was already picked. The fields' own
 * defaults move with it, so the form is not marked changed.
 */
export function useCatalogDefaults(form: UseFormReturn<WizardValues>): void {
  const nonPhysical = useFeatureState("catalog.non_physical")
  const booking = useFeatureState("catalog.booking")
  const { data } = useQuery(sectionQuery<CatalogDefaults>("catalog"))
  const applied = useRef(false)
  useEffect(() => {
    const values = data?.values
    if (applied.current || !values || nonPhysical === undefined || booking === undefined) {
      return
    }
    applied.current = true
    const start = startingKind(values, { nonPhysical, booking })
    if (!start || form.getFieldState("kind").isDirty) {
      return
    }
    form.resetField("kind", { defaultValue: start.kind })
    form.resetField("booking_mode", { defaultValue: start.booking_mode })
  }, [data, nonPhysical, booking, form])
}
