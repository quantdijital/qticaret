/**
 * The audit log's kinds of thing, grouped for its filter (F12.5): forty
 * names in one list are not a list to choose from. A type not named here
 * goes under "other"; the API adds them as Medusa adds routes.
 */
const GROUPS = {
  sales: [
    "order",
    "draft_order",
    "order_board",
    "return_request",
    "return",
    "fulfillment",
    "payment",
    "refund",
    "chargeback",
    "gift_card",
  ],
  catalog: [
    "product",
    "product_variant",
    "product_category",
    "collection",
    "brand",
    "attribute_template",
    "catalog",
    "inventory_item",
    "stock_location",
    "price_list",
    "media",
    "upload",
  ],
  customers: ["customer", "customer_group", "customer_segment", "review", "question"],
  marketing: [
    "campaign",
    "promotion",
    "marketing_feed",
    "content_entry",
    "landing",
    "landing_page",
    "seo_meta",
    "seo_redirect",
    "message_suppression",
    "notification",
  ],
  settings: [
    "platform_settings",
    "shipping_setup",
    "shipping_option",
    "region",
    "sales_channel",
    "feature",
    "integration_credentials",
    "api_access",
    "webhook",
    "accounting_package",
    // adr/0007 Ek 2026-11-04: the KDV rates and the default
    "vat_rate",
    "async_job",
    // F13.1: the contracts and policies, their drafts and publishing
    "legal_document",
  ],
  people: ["staff", "staff_role", "user", "auth_identity", "invite", "audit_log"],
} as const

export type ResourceGroup = keyof typeof GROUPS | "other"

const GROUP_OF = new Map<string, ResourceGroup>(
  Object.entries(GROUPS).flatMap(([group, types]) =>
    types.map((type): [string, ResourceGroup] => [type, group as ResourceGroup])
  )
)

const ORDER: ResourceGroup[] = [...(Object.keys(GROUPS) as ResourceGroup[]), "other"]

export interface ResourceOption {
  type: string
  label: string
}

/**
 * The types in their groups, each group in alphabetical order of its
 * labels (Turkish); two types with one label keep their own name beside it.
 */
export function groupResources(
  types: readonly string[],
  labelOf: (type: string) => string
): { group: ResourceGroup; options: ResourceOption[] }[] {
  const labels = types.map((type) => ({ type, label: labelOf(type) }))
  const seen = new Map<string, number>()
  for (const { label } of labels) {
    seen.set(label, (seen.get(label) ?? 0) + 1)
  }
  const options = labels.map(({ type, label }) => ({
    type,
    label: (seen.get(label) ?? 0) > 1 ? `${label} (${type})` : label,
  }))
  return ORDER.map((group) => ({
    group,
    options: options
      .filter((option) => (GROUP_OF.get(option.type) ?? "other") === group)
      .sort((a, b) => a.label.localeCompare(b.label, "tr")),
  })).filter(({ options: listed }) => listed.length > 0)
}
