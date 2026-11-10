import type { CpStaffRole } from "../staff/roles"

/**
 * The control plane's e-mail texts, by key (Turkish; the staff speak it).
 * `{name}` placeholders are filled by `format`, values escaped for HTML by
 * the caller.
 */
export const MAIL_MESSAGES_TR = {
  "staff_invite.subject": "Quant Ticaret üst paneline davet",
  "staff_invite.intro": "Quant Ticaret üst paneline {role} olarak davet edildiniz.",
  "staff_invite.action": "Daveti kabul etmek için bağlantıyı açın:",
  "staff_invite.expiry": "Bağlantı 24 saat geçerlidir ve yalnızca bir kez kullanılır.",
  "staff_invite.ignore": "Bu daveti beklemiyorsanız e-postayı yok sayın.",
  "staff_enrol.subject": "Quant Ticaret üst paneli: iki adımlı doğrulamayı yeniden kurun",
  "staff_enrol.intro":
    "Üst panel hesabınızın iki adımlı doğrulaması sıfırlandı. Yeniden kurmadan panele giremezsiniz.",
  "staff_enrol.action": "Kurulum için bağlantıyı açın:",
  "staff_enrol.expiry": "Bağlantı 24 saat geçerlidir ve yalnızca bir kez kullanılır.",
  "staff_enrol.ignore": "Bu sıfırlamayı beklemiyorsanız hemen platform sahibine haber verin.",
  "role.owner": "sahip",
  "role.operator": "operatör",
  "role.finance": "finans",
  "role.readonly": "salt okunur",
} as const satisfies Record<string, string> & Record<`role.${CpStaffRole}`, string>

export type MailMessageKey = keyof typeof MAIL_MESSAGES_TR

export const format = (key: MailMessageKey, values: Record<string, string> = {}): string =>
  MAIL_MESSAGES_TR[key].replace(/\{(\w+)\}/g, (all, name: string) => values[name] ?? all)
