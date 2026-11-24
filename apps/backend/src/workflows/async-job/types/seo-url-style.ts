import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../../lib/errors"
import { updatePlatformSettingsWorkflow } from "../../platform-settings/update-platform-settings"
import { claimLandingsBelow } from "../../content/landing-paths"
import { movePaths, planUrlStyle } from "../../seo/url-style"
import type { JobType } from "./types"

const style = z.enum(["prefixed", "flat"])
// A category's tree without the prefix too (adr/0017 Ek 2026-11-23)
const categoryStyle = z.enum(["prefixed", "nested", "flat"])
const input = z.object({ product: style, category: categoryStyle, brand: style }).strict()

/**
 * Moves the shop to another URL style (docs/13 §2.2): plans again (the
 * catalog may have changed since the panel's check), claims every new
 * path, then saves the style, so the storefront links the new paths only
 * once they all answer. Old paths answer with a 301 throughout. Landing
 * pages follow their categories' new paths.
 */
export const seoUrlStyle: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress }, styles) => {
    const plan = await planUrlStyle(container, styles)
    if (plan.conflicts.length > 0) {
      throw new ValidationError("seo.url_style_conflicts")
    }
    await progress(0)
    await movePaths(container, plan.moves, async (done) => {
      await progress(Math.floor((done / Math.max(plan.moves.length, 1)) * 95))
    })
    // Landing pages sit under their category's path: they follow it (F3.16)
    await claimLandingsBelow(container, "all")
    await updatePlatformSettingsWorkflow(container).run({
      input: { section: "seo", values: { url_style: styles }, actor_id: job.requested_by ?? null },
    })
    return { summary: { moved: plan.moves.length, skipped: plan.skipped.length } }
  },
}
