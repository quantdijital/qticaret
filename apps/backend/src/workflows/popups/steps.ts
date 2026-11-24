import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { libraryImage } from "../../lib/media/library-image"
import { refuseSvgImages } from "../../lib/media/svg-use"
import { normalizePopup, popupProblem } from "../../lib/popups/eligibility"
import type { PopupRecord, PopupValues } from "../../lib/popups/eligibility"
import { POPUP_DEFAULTS } from "../../lib/popups/rules"
import { POPUPS_MODULE } from "../../modules/popups"
import type PopupsModuleService from "../../modules/popups/service"
import { promotionsById } from "./promotions"

type Container = Pick<MedusaContainer, "resolve">

const popups = (container: Container) => container.resolve<PopupsModuleService>(POPUPS_MODULE)

/** The fields a save may carry; left out, a new pop-up takes the default, a change keeps the value. */
export type PopupChanges = Partial<PopupValues>

export interface SavePopupInput {
  /** Absent: a new pop-up. */
  id?: string
  values: PopupChanges
}

type PopupRow = Omit<PopupValues, "pages" | "starts_at" | "ends_at"> & {
  starts_at: Date | null
  ends_at: Date | null
  /** Medusa types a JSON column as an object; `pages` is a list. */
  pages: Record<string, unknown>
}

const dateOf = (when: Date | string | null): Date | null => (when === null ? null : new Date(when))

/** The whole record as the module writes it. */
const row = (values: PopupValues): PopupRow => ({
  ...values,
  starts_at: dateOf(values.starts_at),
  ends_at: dateOf(values.ends_at),
  pages: values.pages as unknown as Record<string, unknown>,
})

const definedOnly = (values: PopupChanges): PopupChanges =>
  Object.fromEntries(
    Object.entries(values as Record<string, unknown>).filter(([, value]) => value !== undefined)
  )

/** The pop-up as it is, or a 404. */
export async function readPopup(container: Container, id: string): Promise<PopupRecord> {
  const [popup] = await popups(container).listPopups({ id }, { take: 1 })
  if (!popup) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "popups.unknown")
  }
  return popup as unknown as PopupRecord
}

/** A new pop-up's starting values: the defaults, then what was sent. */
function created(values: PopupChanges): PopupValues {
  return {
    starts_at: null,
    ends_at: null,
    body: null,
    image_url: null,
    image_alt: null,
    button_label: null,
    button_href: null,
    promotion_id: null,
    ...POPUP_DEFAULTS,
    pages: [],
    ...definedOnly(values),
  } as PopupValues
}

/**
 * The record a save would leave, checked as a whole (adr/0080 §1): what
 * the fields say together, the campaign's promotion (it must exist), the
 * picture (one of the media library's images, no SVG). Throws a 400 with
 * the field; reads only, so nothing to undo.
 */
export const checkPopupStep = createStep(
  "popups-check",
  async (input: SavePopupInput, { container }) => {
    const before = input.id ? await readPopup(container, input.id) : null
    const merged = before
      ? { ...kept(before), ...definedOnly(input.values) }
      : created(input.values)
    // Checked as sent, then emptied of what its choices do not use: a link or a promotion
    // on the wrong type is refused, not dropped unseen
    const problem = popupProblem(merged)
    if (problem) {
      throw new ValidationError(problem.key, { field: problem.field })
    }
    const values = normalizePopup(merged)
    if (values.promotion_id) {
      const found = await promotionsById(container, [values.promotion_id])
      if (!found.has(values.promotion_id)) {
        throw new ValidationError("popups.promotion_unknown", { field: "promotion_id" })
      }
    }
    if (values.image_url && values.image_url !== before?.image_url) {
      await refuseSvgImages(container, [values.image_url], "image_url")
      if (!(await libraryImage(container, { url: values.image_url }))) {
        throw new ValidationError("popups.image_unknown", { field: "image_url" })
      }
    }
    return new StepResponse(values)
  }
)

/** Writes a new pop-up; undone, it is gone. */
export const createPopupStep = createStep(
  "popups-create",
  async (values: PopupValues, { container }) => {
    const popup = await popups(container).createPopups(row(values))
    return new StepResponse({ id: popup.id }, popup.id)
  },
  async (id, { container }) => {
    if (id) {
      await popups(container).deletePopups([id])
    }
  }
)

/** Writes the pop-up's fields; undone, they are as they were. */
export const updatePopupStep = createStep(
  "popups-update",
  async (input: { id: string; values: PopupValues }, { container }) => {
    const before = await readPopup(container, input.id)
    await popups(container).updatePopups({ ...row(input.values), id: input.id })
    return new StepResponse({ id: input.id }, before)
  },
  async (before, { container }) => {
    if (before) {
      await popups(container).updatePopups({ ...row(kept(before)), id: before.id })
    }
  }
)

/** Turns it on or off; undone, the switch is as it was. */
export const setPopupActiveStep = createStep(
  "popups-set-active",
  async (input: { id: string; is_active: boolean }, { container }) => {
    const before = await readPopup(container, input.id)
    await popups(container).updatePopups({ id: input.id, is_active: input.is_active })
    return new StepResponse({ id: input.id }, { id: input.id, is_active: before.is_active })
  },
  async (before, { container }) => {
    if (before) {
      await popups(container).updatePopups(before)
    }
  }
)

/** Deletes it (soft); undone, it is back. Its counts stay with it. */
export const deletePopupStep = createStep(
  "popups-delete",
  async (id: string, { container }) => {
    await readPopup(container, id)
    await popups(container).softDeletePopups([id])
    return new StepResponse({ id }, id)
  },
  async (id, { container }) => {
    if (id) {
      await popups(container).restorePopups([id])
    }
  }
)

/** The record's own values, without its id and what the module manages. */
const MANAGED = new Set(["id", "created_at", "updated_at", "deleted_at"])

function kept(record: PopupRecord): PopupValues {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !MANAGED.has(key))
  ) as unknown as PopupValues
}
