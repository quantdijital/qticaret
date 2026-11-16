/** The sidebar's sections (src/components/layout/navigation.ts) and the settings pages. */
export const SECTIONS = [
  "/",
  "/orders",
  // Payment links (adr/0051): the list and the new-order form, or why they are closed
  "/payment-links",
  "/payment-links/new",
  "/customers",
  // Carts left before payment, and the reminders sent for them
  "/customers/abandoned-carts",
  "/products",
  "/categories",
  "/brands",
  "/collections",
  "/inventory",
  "/reviews",
  "/reviews/questions",
  // Google reviews (adr/0058): the connection, or the reviews it brought
  "/reviews/google",
  "/customers/groups",
  // Wholesalers, their levels and orders (ADR-0068): the lists, or why they are closed while off
  "/wholesale",
  "/wholesale/tiers",
  "/wholesale/orders",
  "/customers/contact-messages",
  // Every alert of the bell, read and unread (adr/0020)
  "/notifications",
  "/promotions",
  "/promotions/price-lists",
  "/promotions/gift-cards",
  // Bulk e-mail and SMS (adr/0050): the list, or why it is closed while the flag is off
  "/bulk-messages",
  // The theme editor opens full screen, without the panel's menu (adr/0049); colour
  // swatches, trust badges and when a product card says "Az kaldı" are in it (adr/0049
  // Ek 2026-11-06)
  "/storefront/editor",
  // The storefront's preferences, a panel of the editor (the owner, 2026-11-16): the
  // contact form's page and the payment and shipping pages
  "/storefront/editor?open=preferences",
  // Ready-made and saved looks (adr/0064): the current one, the shop's, the gallery's
  "/storefront/looks",
  "/storefront/menus",
  "/content",
  // The media library: every picture the shop uploaded or brought in
  "/media",
  // The blog's categories, tags and authors (adr/0019 ek 2026-11-03)
  "/content?kind=category",
  "/content?kind=tag",
  "/content?kind=author",
  "/seo",
  "/reports",
  "/reports/products",
  "/reports/categories",
  "/reports/daily",
  "/reports/finance",
  "/reports/stock",
  "/reports/search",
  "/reports/brands",
  "/reports/marketing",
  "/seo/redirects",
  // Site search's synonym groups (adr/0056)
  "/seo/search",
  "/products/new",
  "/promotions/new",
  "/promotions/price-lists/new",
]
export const SETTINGS = [
  "/settings",
  "/settings/store",
  // The legal identity beside the ETBİS QR code
  "/settings/store?part=legal",
  // Maintenance mode and its bypass link (adr/0053)
  "/settings/maintenance",
  "/settings/payments",
  "/settings/payments/paytr",
  "/settings/payments/iyzico",
  "/settings/payments/bank_transfer",
  "/settings/payments/cash_on_delivery",
  "/settings/shipping",
  "/settings/shipping/geliver",
  "/settings/shipping/aras",
  "/settings/shipping/yurtici",
  "/settings/notifications",
  "/settings/notifications?part=sms",
  // The messages the shop sends its customers, and the staff's own alerts
  "/settings/notifications?part=templates",
  "/settings/notifications?part=staff",
  "/settings/sms/netgsm",
  "/orders/chargebacks",
  "/orders/review",
  "/orders/returns",
  "/orders/invoices",
  "/settings/integrations",
  "/settings/appearance",
  "/settings/shipping?part=locations",
  "/settings/seo",
  "/settings/attributes",
  "/settings/features",
  "/settings/jobs",
  "/settings/audit",
  "/settings/einvoice?part=accounting",
  "/settings/einvoice?part=vat",
  "/settings/einvoice",
  "/settings/migration",
  // adr/0061 Ek C14: the package, limits and payment (a shop without a plan says so)
  "/settings/subscription",
  "/settings/api",
  "/settings/marketing",
  "/settings/marketing?part=bulk",
  "/settings/marketing/meta",
  "/settings/marketing/ga4",
  // Opens on the member's own account (Hesabım); the team's two-step and the fraud rules beside
  "/settings/security",
  "/settings/security?part=team",
  "/settings/security?part=fraud",
  "/settings/team",
  "/settings/legal",
  "/settings/legal/distance_sales",
]
