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
  "owner_invite.subject": "{shop} mağazanız hazır: yönetim paneline giriş",
  "owner_invite.intro":
    "{shop} mağazanız Quant Ticaret'te kuruldu. Mağazanın sahibi olarak yönetim paneli hesabınızı oluşturun.",
  "owner_invite.action": "Hesabınızı oluşturmak için bağlantıyı açın:",
  "owner_invite.expiry":
    "Bağlantı yalnızca bir kez kullanılır. Süresi dolarsa platform ekibinden yeni bağlantı isteyin.",
  "owner_invite.ignore": "Bu e-postayı beklemiyorsanız yok sayın.",
  "billing_reminder.subject.before": "{shop} aboneliği: ödeme günü {date}",
  "billing_reminder.subject.due": "{shop} aboneliği: ödeme günü bugün",
  "billing_reminder.subject.overdue": "{shop} aboneliği: ödemeniz gecikti",
  "billing_reminder.subject.restricted": "{shop} mağazanız kısıtlandı: abonelik ödemesi bekleniyor",
  "billing_reminder.greeting": "Merhaba {name},",
  "billing_reminder.greeting_plain": "Merhaba,",
  "billing_reminder.before":
    "{shop} mağazanızın {package} paketi için {period_start} – {period_end} dönemi ödemesinin son günü {date} ({days} gün sonra). Tutar: {amount}.",
  "billing_reminder.due":
    "{shop} mağazanızın {package} paketi için {period_start} – {period_end} dönemi ödemesinin son günü bugün, {date}. Tutar: {amount}.",
  "billing_reminder.overdue":
    "{shop} mağazanızın {date} tarihli {amount} tutarındaki abonelik ödemesi henüz bize ulaşmadı. Ödeme {grace_ends} tarihine kadar gelmezse mağaza paneliniz kısıtlanır; vitrininiz satışa devam eder.",
  "billing_reminder.restricted":
    "{shop} mağazanızın {date} tarihli {amount} tutarındaki abonelik ödemesi ek süre içinde bize ulaşmadığı için mağaza paneliniz kısıtlandı. Vitrininiz satışa devam ediyor, mevcut siparişlerinizi yönetebilirsiniz; ürün, kampanya ve ayar değişiklikleri ödeme kaydedilince yeniden açılır. Hiçbir veriniz silinmez.",
  "billing_reminder.instruction": "Ödeme bilgileri:",
  "billing_reminder.panel":
    "Abonelik ayrıntılarını mağaza panelinizde Ayarlar > Abonelik sayfasında görebilirsiniz.",
  "billing_reminder.paid":
    "Ödemenizi yaptıysanız bu e-postayı dikkate almayın; kaydınız en geç iki iş günü içinde güncellenir.",
  "billing_reminder.sign": "Quant Ticaret",
  "billing_reminder.month.1": "Ocak",
  "billing_reminder.month.2": "Şubat",
  "billing_reminder.month.3": "Mart",
  "billing_reminder.month.4": "Nisan",
  "billing_reminder.month.5": "Mayıs",
  "billing_reminder.month.6": "Haziran",
  "billing_reminder.month.7": "Temmuz",
  "billing_reminder.month.8": "Ağustos",
  "billing_reminder.month.9": "Eylül",
  "billing_reminder.month.10": "Ekim",
  "billing_reminder.month.11": "Kasım",
  "billing_reminder.month.12": "Aralık",
  "role.owner": "sahip",
  "role.operator": "operatör",
  "role.finance": "finans",
  "role.readonly": "salt okunur",
} as const satisfies Record<string, string> & Record<`role.${CpStaffRole}`, string>

export type MailMessageKey = keyof typeof MAIL_MESSAGES_TR

export const format = (key: MailMessageKey, values: Record<string, string> = {}): string =>
  MAIL_MESSAGES_TR[key].replace(/\{(\w+)\}/g, (all, name: string) => values[name] ?? all)
