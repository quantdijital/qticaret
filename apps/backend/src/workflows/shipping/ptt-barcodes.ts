import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { PTT_BARCODE_MODULE } from "../../modules/ptt-barcode"
import type PttBarcodeModuleService from "../../modules/ptt-barcode/service"
import type { PttRangesView } from "../../modules/ptt-barcode/service"

/**
 * The shop's PTT barcode ranges (docs/entegrasyonlar/ptt.md), as Settings >
 * Shipping > PTT Kargo lists and changes them. A number handed out is
 * never handed out again: a range in use stays.
 */

const rangesOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<PttBarcodeModuleService>(PTT_BARCODE_MODULE)

/** The ranges with what is left, and whether to ask PTT for more soon. */
export const pttBarcodeRanges = (
  container: Pick<MedusaContainer, "resolve">
): Promise<PttRangesView> => rangesOf(container).overview()

/** Adds a range the shop got from PTT; undone by removing it (nothing was handed out yet). */
const addRangeStep = createStep(
  "ptt-add-barcode-range",
  async (input: { first: string; last: string }, { container }) => {
    const { id } = await rangesOf(container).addRange(input)
    return new StepResponse({ id }, id)
  },
  async (id, { container }) => {
    if (id) {
      await rangesOf(container).removeRange(id)
    }
  }
)

export const addPttBarcodeRangeWorkflow = createWorkflow(
  "ptt-add-barcode-range",
  (input: { first: string; last: string }) => new WorkflowResponse(addRangeStep(input))
)

/** Removes a range none of whose numbers was handed out; undone by adding it again. */
const removeRangeStep = createStep(
  "ptt-remove-barcode-range",
  async (input: { id: string }, { container }) => {
    const removed = await rangesOf(container).removeRange(input.id)
    return new StepResponse({ removed: removed !== null }, removed)
  },
  async (removed, { container }) => {
    if (removed) {
      await rangesOf(container).addRange({ first: removed.first, last: removed.last })
    }
  }
)

export const removePttBarcodeRangeWorkflow = createWorkflow(
  "ptt-remove-barcode-range",
  (input: { id: string }) => new WorkflowResponse(removeRangeStep(input))
)
