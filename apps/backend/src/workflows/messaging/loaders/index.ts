import type { MedusaContainer } from "@medusajs/framework/types"
import type { MessageTemplateName } from "../../../lib/messaging/templates"
import { loadCampaignMessage } from "../../campaigns/loader"
import type { VarsOf } from "../deliver"
import { loadAnnouncement, loadPasswordReset, loadVerification } from "./account"
import { loadBookingCancel, loadBookingConfirmed, loadBookingReminder } from "./booking"
import { loadPaymentFailed } from "./cart"
import { loadCartReminder } from "./cart-reminder"
import { loadConsentRequest } from "./consent"
import { loadGiftCardMessage } from "./gift-card"
import { loadInvoiceMessage } from "./invoice"
import { loadMigrationInvite } from "./migration"
import { loadOrderLink, loadOrderMessage } from "./order"
import { loadParcelMessage } from "./parcel"
import { loadPaymentLinkMessage } from "./payment-link"
import { loadReturnMessage } from "./return-request"
import {
  loadSeoDigest,
  loadStaffContact,
  loadStaffInvite,
  loadStaffMfaChanged,
  loadStaffOrder,
  loadStaffPasswordReset,
  loadStaffStock,
} from "./staff"
import { loadStaffAccountChanged, loadStaffEmailConfirm } from "./staff-account"
import { loadStaffPaymentIssue } from "./payment-issue"
import { loadStaffSmtpRejections } from "./smtp-rejections"
import { loadStaffStockShort } from "./stock-short"
import { loadStockAlert } from "./stock"
import type { Loaded } from "./types"

export type { Loaded, MessageRecipients } from "./types"

type Loader<N extends MessageTemplateName> = (
  container: Pick<MedusaContainer, "resolve">,
  resourceId: string,
  /** What only the event knew (a reset link's token); never stored. */
  extra: Readonly<Record<string, string>>
) => Promise<Loaded<VarsOf<N>> | null>

/** How each template reads its values from its resource (adr/0036): one loader per template. */
export const MESSAGE_LOADERS: { readonly [N in MessageTemplateName]: Loader<N> } = {
  "order.placed": (container, id) => loadOrderMessage(container, id),
  "order.access_link": (container, id) => loadOrderLink(container, id),
  "order.shipped": (container, id) => loadParcelMessage(container, id),
  "order.delivered": (container, id) => loadParcelMessage(container, id),
  "order.invoiced": (container, id) => loadInvoiceMessage(container, id),
  // adr/0076 Ek D7b: the booking for its confirmation, a departure's use row for the rest
  "booking.confirmed": (container, id) => loadBookingConfirmed(container, id),
  "booking.reminder": (container, id) => loadBookingReminder(container, id),
  "booking.cancelled": loadBookingCancel,
  "booking.departure_cancelled": loadBookingCancel,
  "return.requested": (container, id) => loadReturnMessage(container, id),
  "return.approved": (container, id) => loadReturnMessage(container, id),
  "return.refunded": (container, id) => loadReturnMessage(container, id),
  "return.refused": (container, id) => loadReturnMessage(container, id),
  "return.canceled": (container, id) => loadReturnMessage(container, id),
  "account.password_reset": loadPasswordReset,
  "account.verify_email": loadVerification,
  "account.migration_invite": (container, id) => loadMigrationInvite(container, id),
  "payment.failed": (container, id) => loadPaymentFailed(container, id),
  "gift_card.issued": loadGiftCardMessage,
  "marketing.announcement": loadAnnouncement,
  "cart.reminder": loadCartReminder,
  "consent.confirm": loadConsentRequest,
  "stock.alert_confirm": loadStockAlert,
  "stock.back_in_stock": loadStockAlert,
  "staff.new_order": (container, id) => loadStaffOrder(container, id),
  "staff.bank_transfer": (container, id) => loadStaffOrder(container, id),
  "staff.low_stock": loadStaffStock,
  "staff.stock_short": (container, id) => loadStaffStockShort(container, id),
  "staff.payment_issue": loadStaffPaymentIssue,
  "staff.smtp_rejections": loadStaffSmtpRejections,
  "staff.seo_digest": (container) => loadSeoDigest(container),
  "staff.contact_message": (container, id) => loadStaffContact(container, id),
  "staff.invite": loadStaffInvite,
  "staff.password_reset": loadStaffPasswordReset,
  "staff.mfa_changed": loadStaffMfaChanged,
  "staff.email_confirm": loadStaffEmailConfirm,
  "staff.account_changed": loadStaffAccountChanged,
  // adr/0050: the campaign in `extra.campaign_id`, the recipient's record as the resource
  "marketing.campaign": loadCampaignMessage,
  // adr/0051 §7: the link's token from its sealed copy, so a retry carries no secret
  "payment_link.sent": (container, id) => loadPaymentLinkMessage(container, id),
}
