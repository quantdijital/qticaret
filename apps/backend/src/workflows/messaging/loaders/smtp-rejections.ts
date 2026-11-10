import type { MedusaContainer } from "@medusajs/framework/types"
import type { StaffSmtpRejectionsVars } from "../../../lib/messaging/templates/staff-smtp-rejections"
import type { Loaded } from "./types"

const count = (value: string | undefined): string =>
  /^\d{1,6}$/.test(value ?? "") ? (value ?? "") : "—"

/** The mail server's refusals as the brake counted them; the numbers come with the alert. */
export function loadStaffSmtpRejections(
  _container: Pick<MedusaContainer, "resolve">,
  _resourceId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<StaffSmtpRejectionsVars> | null> {
  return Promise.resolve({
    vars: {
      rejections: count(extra["rejections"]),
      sends: count(extra["sends"]),
      minutes: count(extra["minutes"]),
    },
    recipients: {},
    receiverId: null,
    resourceType: "smtp",
  })
}
