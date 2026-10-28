/** A segment as the panel shows it. */
export const segmentView = (segment: {
  id: string
  name: string
  rules: unknown
  customer_group_id: string
  member_count: number
  refreshed_at: Date | string | null
}) => ({
  id: segment.id,
  name: segment.name,
  rules: segment.rules,
  customer_group_id: segment.customer_group_id,
  member_count: segment.member_count,
  refreshed_at: segment.refreshed_at,
})
