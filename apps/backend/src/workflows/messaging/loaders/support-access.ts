import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { StaffSupportAccessVars } from "../../../lib/messaging/templates/staff-support-access"
import type { Loaded } from "./types"

// What the session's start hands over: plain lines the grant's schema already held
const LINE = /^[^\p{Cc}\p{Cf}\u2028\u2029]{1,500}$/u
const TIME = /^\d{2}:\d{2}$/

/**
 * A support session's notice to one owner (adr/0061 Ek "Destek erişimi"):
 * the owner's own login address; who, why and until when come with it.
 */
export async function loadStaffSupportAccess(
  container: Pick<MedusaContainer, "resolve">,
  userId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffSupportAccessVars> | null> {
  const operator = extra["operator"] ?? ""
  const reason = extra["reason"] ?? ""
  const endsAt = extra["ends_at"] ?? ""
  if (!LINE.test(operator) || !LINE.test(reason) || !TIME.test(endsAt)) {
    return null
  }
  const [user] = await container
    .resolve(Modules.USER)
    .listUsers({ id: userId }, { select: ["email"], take: 1 })
  return user?.email
    ? {
        vars: { operator, reason, ends_at: endsAt },
        recipients: { email: user.email },
        receiverId: null,
        resourceType: "user",
      }
    : null
}
