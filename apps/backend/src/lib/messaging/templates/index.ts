import { orderPlaced } from "./order-placed"

export { renderEmail } from "./layout"
export type { EmailBlock, EmailBody } from "./layout"
export { orderSummary } from "./order-placed"
export type { OrderVars } from "./order-placed"
export type { Brand, EmailContent, MessageKind, MessageTemplate } from "./types"

/** Every template the platform sends, by name (adr/0036). */
export const MESSAGE_TEMPLATES = {
  "order.placed": orderPlaced,
} as const

export type MessageTemplateName = keyof typeof MESSAGE_TEMPLATES
