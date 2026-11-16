import type { MedusaContainer } from "@medusajs/framework/types"
import type { FillLogoSizesResult } from "./steps/fill-logo-sizes"
import { fillBrandLogoSizesWorkflow } from "./workflows"

/**
 * Logo sizes for every brand whose logo was set before sizes were kept
 * (`brand-logo-sizes:backfill`, the demo catalogue): the workflow page by
 * page, each under its own hold of the brands lock, counts added up.
 */
export async function fillBrandLogoSizes(
  container: MedusaContainer,
  input: { apply: boolean; ids?: string[] | undefined }
): Promise<FillLogoSizesResult> {
  const total: FillLogoSizesResult = { missing: 0, measured: 0, unmeasured: [], written: 0 }
  let after: string | null = null
  do {
    const { result } = await fillBrandLogoSizesWorkflow(container).run({
      input: { ...input, after },
    })
    total.missing += result.missing
    total.measured += result.measured
    total.unmeasured.push(...result.unmeasured)
    total.written += result.written
    after = result.next
  } while (after)
  return total
}
