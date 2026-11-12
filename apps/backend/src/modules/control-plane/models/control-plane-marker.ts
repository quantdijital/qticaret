import { model } from "@medusajs/framework/utils"

/**
 * That this shop has applied a verified plan document at least once
 * (adr/0061 Ek C19 takip LOW-3). Written with the first applied document,
 * under the same lock; removed only when that first apply is undone. With
 * it, a missing `control_plane_plan` row is a lost document (`restricted`
 * until a valid one arrives), not a shop before its first (`active`).
 */
export const ControlPlaneMarker = model
  .define("control_plane_marker", {
    id: model.id({ prefix: "cpmark" }).primaryKey(),
    tenant_id: model.text(),
    first_applied_at: model.dateTime(),
  })
  .indexes([{ on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" }])
