/** A subscription as the panel and an integration read it: never its secret. */
export const subscriptionView = (row: {
  id: string
  url: string
  events: string[]
  status: string
  failure_streak: number
  disabled_at: Date | string | null
  created_at: Date | string
}) => ({
  id: row.id,
  url: row.url,
  events: row.events,
  status: row.status,
  failure_streak: row.failure_streak,
  disabled_at: row.disabled_at,
  created_at: row.created_at,
})

export const SUBSCRIPTION_FIELDS = [
  "id",
  "url",
  "events",
  "status",
  "failure_streak",
  "disabled_at",
  "created_at",
]
