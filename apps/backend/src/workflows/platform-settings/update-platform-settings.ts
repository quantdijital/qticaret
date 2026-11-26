import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { scopesForSection } from "../../lib/storefront/refresh"
import { removeIntegrationCredentialsWorkflow } from "../integration-credentials/remove-credentials"
import { attachMediaStep } from "../media/steps/attach-media"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import { brandImagesStep } from "./steps/brand-images"
import { pageRolesStep } from "./steps/page-roles"
import { saveSettingsSectionStep } from "./steps/save-settings-section"
import { shareImageMediaStep } from "./steps/share-image"
import type { SaveSettingsSectionInput } from "./steps/save-settings-section"

const providerOf = (values: unknown): unknown =>
  (values as Record<string, unknown> | null | undefined)?.["provider"]

/** The invoicing program moved from BirFatura to another (or to none). */
export const leftBirfatura = (section: string, before: unknown, after: unknown): boolean =>
  section === "invoicing" && providerOf(before) === "birfatura" && providerOf(after) !== "birfatura"

/**
 * Saves a settings section (F2.3, adr/0012); a later failing step puts the
 * old values back. Pages' SEO answers use the shop's name, templates and
 * host, so cached ones are forgotten. The promotions section's free
 * shipping threshold is read by the shipping quote at each pricing
 * (adr/0087 §2), so nothing is written for it here. The SEO
 * section's share image must be one of the shop's uploads, and is kept;
 * so must each newly chosen logo and site icon of the appearance section.
 * A section the storefront shows is shown at once (adr/0048 ek 2026-11-03).
 */
export const updatePlatformSettingsWorkflow = createWorkflow(
  "platform-settings-update-section",
  (input: SaveSettingsSectionInput) => {
    // The storefront's page roles by id (adr/0073 Açık kararlar 3); other sections as sent
    const roled = pageRolesStep(input)
    const shareImage = shareImageMediaStep(input)
    const brand = brandImagesStep(input)
    const saved = saveSettingsSectionStep(roled)
    // Kept like a page's cover: the nightly sweep leaves a used upload alone
    attachMediaStep(
      transform({ shareImage, brand }, ({ shareImage, brand }) => ({
        link: [...shareImage, ...brand],
        record: [],
      }))
    )
    forgetResolutionsStep()
    // adr/0072 §3: BirFatura no longer the program, its token goes: picking it again
    // asks the owner for a new one (every admin told, as for any account)
    when({ input, saved }, ({ input, saved }) =>
      leftBirfatura(input.section, saved.before, saved.after)
    ).then(() => {
      removeIntegrationCredentialsWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({
          provider: "birfatura" as const,
          actor_id: input.actor_id,
        })),
      })
    })
    refreshStorefrontStep(transform({ input }, ({ input }) => scopesForSection(input.section)))
    return new WorkflowResponse(saved)
  }
)
