import { model } from "@medusajs/framework/utils"

/**
 * The service last chosen for a task (adr/0071 §4): a staff member's own
 * (`user_id`), and the shop's (`user_id` empty) that a new member starts
 * with. Learnt from a suggestion's `service`, never written by a route of
 * its own.
 */
export const AiPreference = model
  .define("ai_preference", {
    id: model.id({ prefix: "aipref" }).primaryKey(),
    user_id: model.text().nullable(),
    task: model.text(),
    service: model.text(),
  })
  .indexes([
    {
      name: "IDX_ai_preference_user_task_unique",
      on: ["user_id", "task"],
      unique: true,
      where: "user_id IS NOT NULL AND deleted_at IS NULL",
    },
    {
      name: "IDX_ai_preference_shop_task_unique",
      on: ["task"],
      unique: true,
      where: "user_id IS NULL AND deleted_at IS NULL",
    },
  ])
