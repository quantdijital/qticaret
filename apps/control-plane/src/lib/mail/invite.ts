import { parseEnv } from "../env"
import type { CpStaffRole } from "../staff/roles"
import { format } from "./messages"
import type { OutgoingEmail } from "./transport"

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? ""
  )

/**
 * The panel's page that turns an invitation into an account. The token
 * after `#`: a fragment reaches no server's access log and no other site's
 * Referer; the page takes it out of the address bar once read (the shop's
 * `inviteLink`).
 */
export const inviteLink = (token: string, base: string = parseEnv().CP_PANEL_URL): string =>
  `${base.replace(/\/+$/, "")}/invite#${new URLSearchParams({ token }).toString()}`

/** An invitation's e-mail: the role, the link, its lifetime. */
export function inviteEmail(to: string, role: CpStaffRole, link: string): OutgoingEmail {
  const lines = [
    format("staff_invite.intro", { role: format(`role.${role}`) }),
    format("staff_invite.action"),
    link,
    format("staff_invite.expiry"),
    format("staff_invite.ignore"),
  ]
  const html = [
    `<p>${escapeHtml(lines[0] ?? "")}</p>`,
    `<p>${escapeHtml(lines[1] ?? "")}<br><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    `<p>${escapeHtml(lines[3] ?? "")}</p>`,
    `<p>${escapeHtml(lines[4] ?? "")}</p>`,
  ].join("\n")
  return {
    to,
    subject: format("staff_invite.subject"),
    text: lines.join("\n\n"),
    html,
    template: "cp.staff_invite",
  }
}
