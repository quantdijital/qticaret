import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { mediaOf } from "../../content/rules"
import type { SaveSettingsSectionInput } from "./save-settings-section"

/**
 * The shop's share image (F12.10), when one is sent: an upload in its media
 * library, like a page's cover. Returns the record to mark kept; reads only.
 */
export const shareImageMediaStep = createStep(
  "platform-settings-share-image",
  async (input: SaveSettingsSectionInput, { container }) => {
    const url =
      input.section === "seo"
        ? (input.values as { default_og_image?: unknown }).default_og_image
        : undefined
    return new StepResponse(
      typeof url === "string" && url !== ""
        ? await mediaOf(container, [url], "default_og_image")
        : []
    )
  }
)
