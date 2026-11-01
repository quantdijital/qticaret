// Admin GET routes that return personal data: [matcher, resource type, list,
// fields that show none] (adr/0011). A phase adding such a route adds it here
// (code-reviewer checklist).
export const SENSITIVE_READS: readonly [string, string, boolean, (readonly string[])?][] = [
  ["/admin/customers", "customer", true],
  ["/admin/customers/:id", "customer", false],
  ["/admin/customers/:id/addresses", "customer", false],
  ["/admin/customers/:id/addresses/:address_id", "customer", false],
  ["/admin/customers/:id/billing-profile", "customer", false],
  // F9.5: whether a customer takes commercial messages
  ["/admin/customers/:id/consents", "customer", false],
  // F9.6: addresses no message goes to (masked, still the shoppers')
  ["/admin/messaging/suppressions", "message_suppression", true],
  ["/admin/customer-groups/:id", "customer_group", false],
  ["/admin/orders", "order", true],
  // F15.6: the held orders' queue shows each buyer's e-mail
  ["/admin/fraud/reviews", "order", true],
  ["/admin/dashboard/recent-orders", "order", true],
  ["/admin/order-board", "order", true],
  // F12.9: the search box finds customers and orders by name
  ["/admin/global-search", "customer", true],
  ["/admin/orders/:id", "order", false],
  ["/admin/orders/:id/preview", "order", false],
  ["/admin/orders/:id/changes", "order", false],
  // F12.8: the team's notes are free text; what a customer was sent is theirs
  ["/admin/orders/:id/notes", "order", false],
  ["/admin/orders/:id/messages", "order", false],
  // F13.2: the shopper's IP address and the contracts filled with the order
  ["/admin/orders/:id/legal", "order", false],
  ["/admin/orders/:id/legal/:kind", "order", false],
  ["/admin/customers/:id/messages", "customer", false],
  // F6.7: a dispute's evidence holds the order's delivery address
  ["/admin/chargebacks/:id/evidence", "chargeback", false],
  // F7 (adr/0031): a parcel's label holds the recipient's address and phone
  ["/admin/orders/:id/fulfillments/:fulfillment_id/label", "order", false],
  ["/admin/shipping-labels", "order", true],
  // F7.9 (adr/0032): so does a return's label; the list names shoppers and their notes
  ["/admin/return-requests", "return_request", true],
  ["/admin/return-requests/:id/label", "return_request", false],
  // F18 D10 (adr/0047): what people wrote from the contact form, with their address and phone
  ["/admin/contact-messages", "contact_message", true],
  // F8 (adr/0034 §9): an invoice's contents name its buyer, tax id and all; its PDF too
  ["/admin/invoices/:id/draft", "invoice", false],
  ["/admin/invoices/:id/pdf", "invoice", false],
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
