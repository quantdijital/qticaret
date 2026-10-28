import { passwordReset, verifyEmail } from "./account"
import { announcement } from "./marketing"
import { orderLink } from "./order-link"
import { orderPlaced } from "./order-placed"
import { paymentFailed } from "./payment"
import { returnApproved, returnRefunded, returnRequested } from "./returns"
import { orderDelivered, orderShipped } from "./shipping"
import { staffBankTransfer, staffLowStock, staffNewOrder, staffSeoDigest } from "./staff"

export type { ResetVars, VerifyVars } from "./account"
export type { AnnouncementVars } from "./marketing"
export { renderEmail } from "./layout"
export type { EmailBlock, EmailBody } from "./layout"
export { orderSummary } from "./order-placed"
export type { OrderVars } from "./order-placed"
export type { OrderLinkVars } from "./order-link"
export type { PaymentFailedVars } from "./payment"
export type { ReturnVars } from "./returns"
export type { ParcelVars } from "./shipping"
export type { StaffOrderVars, StaffSeoVars, StaffStockVars } from "./staff"
export type { Brand, EmailContent, EmailContext, MessageKind, MessageTemplate } from "./types"

/** Every template the platform sends, by name (adr/0036). */
export const MESSAGE_TEMPLATES = {
  "order.placed": orderPlaced,
  "order.access_link": orderLink,
  "order.shipped": orderShipped,
  "order.delivered": orderDelivered,
  "return.requested": returnRequested,
  "return.approved": returnApproved,
  "return.refunded": returnRefunded,
  "account.password_reset": passwordReset,
  "account.verify_email": verifyEmail,
  "payment.failed": paymentFailed,
  "marketing.announcement": announcement,
  "staff.new_order": staffNewOrder,
  "staff.bank_transfer": staffBankTransfer,
  "staff.low_stock": staffLowStock,
  "staff.seo_digest": staffSeoDigest,
} as const

export type MessageTemplateName = keyof typeof MESSAGE_TEMPLATES
