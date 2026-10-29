import type {
  LabelFormat,
  ShippingSettings,
} from "../../modules/platform-settings/sections/shipping"
import { MM } from "../pdf"
import type { Sheet } from "../pdf"

/**
 * The page a shop prints its parcels' labels on (Settings > Shipping): a
 * label printer's roll in its size, or plain A4 with four labels to a
 * sheet for an office printer.
 */

export interface LabelSize {
  width_mm: number
  height_mm: number
}

const PRESETS: Record<Exclude<LabelFormat, "a4" | "custom">, LabelSize> = {
  "100x150": { width_mm: 100, height_mm: 150 },
  "100x100": { width_mm: 100, height_mm: 100 },
  "80x80": { width_mm: 80, height_mm: 80 },
}

/** On A4 each label is drawn at the usual roll size, then four go to a sheet. */
const A4_LABEL: LabelSize = { width_mm: 100, height_mm: 150 }

type LabelSettings = Pick<ShippingSettings, "label_format" | "label_custom">

/** The size one label is drawn at, where the platform draws it (Yurtiçi). */
export function labelSizeOf(settings: LabelSettings): LabelSize {
  switch (settings.label_format) {
    case "a4":
      return A4_LABEL
    case "custom":
      return settings.label_custom
    case "100x150":
    case "100x100":
    case "80x80":
      return PRESETS[settings.label_format]
  }
}

/** The page labels are printed on, and how many go to it. */
export function labelSheetOf(settings: LabelSettings): Sheet {
  if (settings.label_format === "a4") {
    return { width: 210 * MM, height: 297 * MM, columns: 2, rows: 2, margin: 5 * MM, guides: true }
  }
  const size = labelSizeOf(settings)
  return {
    width: size.width_mm * MM,
    height: size.height_mm * MM,
    columns: 1,
    rows: 1,
    margin: 0,
    guides: false,
  }
}
