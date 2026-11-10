import { parseEnv } from "../env"
import type { CpStaffRole } from "../staff/roles"
import { format } from "./messages"
import type { MailMessageKey } from "./messages"
import type { OutgoingEmail } from "./transport"

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? ""
  )

/**
 * A panel page that takes a token. The token after `#`: a fragment reaches
 * no server's access log and no other site's Referer; the page takes it out
 * of the address bar once read (the shop's `inviteLink`).
 */
const panelLink = (page: string, token: string, base: string) =>
  `${base.replace(/\/+$/, "")}/${page}#${new URLSearchParams({ token }).toString()}`

/** The page that turns an invitation into an account. */
export const inviteLink = (token: string, base: string = parseEnv().CP_PANEL_URL): string =>
  panelLink("invite", token, base)

/** The page that sets 2FA up again after a reset (Ek C4, M3). */
export const enrolmentLink = (token: string, base: string = parseEnv().CP_PANEL_URL): string =>
  panelLink("enrol", token, base)

function linkEmail(
  to: string,
  link: string,
  keys: { subject: MailMessageKey; lines: string[] },
  template: string
): OutgoingEmail {
  const [intro = "", action = "", ...rest] = keys.lines
  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    `<p>${escapeHtml(action)}<br><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    ...rest.map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join("\n")
  return {
    to,
    subject: format(keys.subject),
    text: [intro, action, link, ...rest].join("\n\n"),
    html,
    template,
  }
}

/** An invitation's e-mail: the role, the link, its lifetime. */
export const inviteEmail = (to: string, role: CpStaffRole, link: string): OutgoingEmail =>
  linkEmail(
    to,
    link,
    {
      subject: "staff_invite.subject",
      lines: [
        format("staff_invite.intro", { role: format(`role.${role}`) }),
        format("staff_invite.action"),
        format("staff_invite.expiry"),
        format("staff_invite.ignore"),
      ],
    },
    "cp.staff_invite"
  )

/** A 2FA reset's e-mail: the single-use enrolment link. */
export const enrolmentEmail = (to: string, link: string): OutgoingEmail =>
  linkEmail(
    to,
    link,
    {
      subject: "staff_enrol.subject",
      lines: [
        format("staff_enrol.intro"),
        format("staff_enrol.action"),
        format("staff_enrol.expiry"),
        format("staff_enrol.ignore"),
      ],
    },
    "cp.staff_enrol"
  )
