import { model } from "@medusajs/framework/utils"

/**
 * Calls claimed against the daily abuse ceiling (adr/0071 §8), per day in
 * Turkey and limit group (`text`, `image`, `video`; lib/ai/limits.ts).
 * A counter, so a claim is one statement that two asks at the last call
 * cannot both pass.
 */
export const AiDailyUsage = model
  .define("ai_daily_usage", {
    id: model.id({ prefix: "aiday" }).primaryKey(),
    /** `YYYY-MM-DD`, Turkey's day. */
    day: model.text(),
    limit_group: model.text(),
    count: model.number().default(0),
  })
  .indexes([
    {
      name: "IDX_ai_daily_usage_day_limit_group_unique",
      on: ["day", "limit_group"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
