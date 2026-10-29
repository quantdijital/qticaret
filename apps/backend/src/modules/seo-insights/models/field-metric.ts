import { model } from "@medusajs/framework/utils"

/**
 * The shop's Core Web Vitals from Chrome's users (CrUX, F10.11), p75 per
 * form factor: LCP and INP in ms, CLS in thousandths. No data: too few
 * visits for CrUX to report.
 */
export const FieldMetric = model
  .define("field_metric", {
    id: model.id({ prefix: "cwv" }).primaryKey(),
    form_factor: model.text(),
    has_data: model.boolean(),
    lcp_ms: model.number().nullable(),
    inp_ms: model.number().nullable(),
    cls_x1000: model.number().nullable(),
    collected_at: model.dateTime(),
  })
  .indexes([{ on: ["form_factor"], unique: true, where: "deleted_at IS NULL" }])
