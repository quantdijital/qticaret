// Admin GET routes that return personal data: [matcher, resource type, list,
// fields that show none] (adr/0011). A phase adding such a route adds it here
// (code-reviewer checklist).
export const SENSITIVE_READS: readonly [string, string, boolean, (readonly string[])?][] = [
  ["/admin/customers", "customer", true],
  ["/admin/customers/:id", "customer", false],
  ["/admin/customers/:id/addresses", "customer", false],
  ["/admin/customers/:id/addresses/:address_id", "customer", false],
  ["/admin/customers/:id/billing-profile", "customer", false],
  ["/admin/customer-groups/:id", "customer_group", false],
  ["/admin/orders", "order", true],
  ["/admin/dashboard/recent-orders", "order", true],
  ["/admin/order-board", "order", true],
  ["/admin/orders/:id", "order", false],
  ["/admin/orders/:id/preview", "order", false],
  ["/admin/orders/:id/changes", "order", false],
  ["/admin/draft-orders", "draft_order", true],
  ["/admin/draft-orders/:id", "draft_order", false],
  ["/admin/returns", "return", true],
  ["/admin/returns/:id", "return", false],
  ["/admin/claims", "claim", true],
  ["/admin/claims/:id", "claim", false],
  ["/admin/exchanges", "exchange", true],
  ["/admin/exchanges/:id", "exchange", false],
  ["/admin/notifications", "notification", true, ["id", "created_at"]],
  ["/admin/notifications/:id", "notification", false],
  // F4.6: a batch's unused codes each take a discount
  ["/admin/promotions/:id/code-batches/:campaign_id/codes", "promotion", false],
  // F4.8: a card's code spends it and its note names whom it was for; a
  // customer's store credit and its movements
  ["/admin/gift-cards", "gift_card", true],
  ["/admin/gift-cards/:id", "gift_card", false],
  ["/admin/gift-cards/:id/orders", "gift_card", false],
  [
    "/admin/store-credit-accounts",
    "store_credit_account",
    true,
    ["id", "currency_code", "balance", "credits", "debits"],
  ],
  ["/admin/store-credit-accounts/:id", "store_credit_account", false],
  ["/admin/store-credit-accounts/:id/transactions", "store_credit_account", false],
]
