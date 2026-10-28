import type { MedusaContainer } from "@medusajs/framework/types"
import type { MessageTemplateName } from "../../../lib/messaging/templates"
import type { VarsOf } from "../deliver"
import { loadPasswordReset, loadVerification } from "./account"
import { loadPaymentFailed } from "./cart"
import { loadOrderMessage } from "./order"
import { loadParcelMessage } from "./parcel"
import { loadReturnMessage } from "./return-request"
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
  "order.shipped": (container, id) => loadParcelMessage(container, id),
  "order.delivered": (container, id) => loadParcelMessage(container, id),
  "return.requested": (container, id) => loadReturnMessage(container, id),
  "return.approved": (container, id) => loadReturnMessage(container, id),
  "return.refunded": (container, id) => loadReturnMessage(container, id),
  "account.password_reset": loadPasswordReset,
  "account.verify_email": loadVerification,
  "payment.failed": (container, id) => loadPaymentFailed(container, id),
}
