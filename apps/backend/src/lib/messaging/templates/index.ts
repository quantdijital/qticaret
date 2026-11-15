import {
  migrationInvite,
  passwordReset,
  verifyEmail,
  wholesaleEnabled,
  wholesaleInvite,
} from "./account"
import { campaignMessage } from "./campaign"
import { cartReminder } from "./cart-reminder"
import { giftCardIssued } from "./gift-card"
import { consentConfirm } from "./consent"
import { orderInvoiced } from "./invoice"
import { announcement } from "./marketing"
import { orderLink } from "./order-link"
import { orderPlaced } from "./order-placed"
import { paymentFailed } from "./payment"
import { paymentLinkSent } from "./payment-link"
import {
  returnApproved,
  returnCanceled,
  returnRefunded,
  returnRefused,
  returnRequested,
} from "./returns"
import { orderDelivered, orderShipped } from "./shipping"
import { backInStock, stockAlertConfirm } from "./stock"
import {
  staffBankTransfer,
  staffContactMessage,
  staffInvite,
  staffLowStock,
  staffMfaChanged,
  staffNewOrder,
  staffPasswordReset,
  staffSeoDigest,
} from "./staff"
import { staffAccountChanged, staffEmailConfirm } from "./staff-account"
import { staffPaymentIssue } from "./staff-payment-issue"
import { staffSmtpRejections } from "./staff-smtp-rejections"
import { staffStockShort } from "./staff-stock-short"

export type {
  MigrationInviteVars,
  ResetVars,
  VerifyVars,
  WholesaleEnabledVars,
  WholesaleInviteVars,
} from "./account"
export type { AnnouncementVars } from "./marketing"
export type { CampaignVars } from "./campaign"
export type { CartReminderVars } from "./cart-reminder"
export type { ConsentConfirmVars } from "./consent"
export type { GiftCardVars } from "./gift-card"
export { renderEmail } from "./layout"
export type { EmailBlock, EmailBody } from "./layout"
export { orderSummary } from "./order-placed"
export type { OrderVars } from "./order-placed"
export type { LineAddonPick, MessageLineAddons } from "./line-addons"
export type { OrderLinkVars } from "./order-link"
export type { PaymentFailedVars } from "./payment"
export type { PaymentLinkVars } from "./payment-link"
export type { RefusedLineVars, ReturnVars } from "./returns"
export type { InvoiceVars } from "./invoice"
export type { ParcelVars } from "./shipping"
export type { StockAlertVars } from "./stock"
export type {
  StaffContactVars,
  StaffInviteVars,
  StaffOrderVars,
  StaffMfaVars,
  StaffResetVars,
  StaffSeoVars,
  StaffStockVars,
} from "./staff"
export type { StaffAccountVars, StaffEmailConfirmVars } from "./staff-account"
export type { StaffPaymentIssueVars } from "./staff-payment-issue"
export type { StaffStockShortVars } from "./staff-stock-short"
export type { Brand, EmailContent, EmailContext, MessageKind, MessageTemplate } from "./types"

/** Every template the platform sends, by name (adr/0036). */
export const MESSAGE_TEMPLATES = {
  "order.placed": orderPlaced,
  "order.access_link": orderLink,
  "order.shipped": orderShipped,
  "order.delivered": orderDelivered,
  // F8 (adr/0034 §7): the order's invoice, issued
  "order.invoiced": orderInvoiced,
  "return.requested": returnRequested,
  "return.approved": returnApproved,
  "return.refunded": returnRefunded,
  // adr/0032 Ek 2026-11-03: units refused at receipt, a sealed good opened
  "return.refused": returnRefused,
  // An approved request staff took back before anything came back (order #691)
  "return.canceled": returnCanceled,
  "account.password_reset": passwordReset,
  "account.verify_email": verifyEmail,
  // F14.5 (adr/0042 §6): a moved customer asked to open their account here
  "account.migration_invite": migrationInvite,
  // ADR-0068 §3: a wholesaler invited to sign up, an existing customer made one
  "account.wholesale_invite": wholesaleInvite,
  "account.wholesale_enabled": wholesaleEnabled,
  "payment.failed": paymentFailed,
  // adr/0025 Ek 2026-11-03: a sold gift card, to its recipient
  "gift_card.issued": giftCardIssued,
  "marketing.announcement": announcement,
  "cart.reminder": cartReminder,
  "consent.confirm": consentConfirm,
  "stock.alert_confirm": stockAlertConfirm,
  "stock.back_in_stock": backInStock,
  "staff.new_order": staffNewOrder,
  "staff.bank_transfer": staffBankTransfer,
  "staff.low_stock": staffLowStock,
  // adr/0026 Ek 2026-11-06: a paid order placed short of stock
  "staff.stock_short": staffStockShort,
  // Security review 2026-11-09: a paid cart stuck, refunded before its order, a raise lowered back
  "staff.payment_issue": staffPaymentIssue,
  // adr/0036 Ek 2026-11-10: the shop's mail server refusing too many recipients
  "staff.smtp_rejections": staffSmtpRejections,
  "staff.seo_digest": staffSeoDigest,
  // F18 D10 (adr/0047): a contact form message came
  "staff.contact_message": staffContactMessage,
  "staff.invite": staffInvite,
  "staff.password_reset": staffPasswordReset,
  "staff.mfa_changed": staffMfaChanged,
  // The owner, 2026-11-06: a staff member's own address confirmed, their password or address changed
  "staff.email_confirm": staffEmailConfirm,
  "staff.account_changed": staffAccountChanged,
  // adr/0050: a bulk e-mail or SMS, to one consented recipient
  "marketing.campaign": campaignMessage,
  // adr/0051 §7: a payment link staff made, to the customer who asked for the order
  "payment_link.sent": paymentLinkSent,
} as const

export type MessageTemplateName = keyof typeof MESSAGE_TEMPLATES
