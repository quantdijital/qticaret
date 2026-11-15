/**
 * What a wholesaler's account messages say (ADR-0068 §3), by key: part of
 * the message catalog (`texts.ts`). An address invited to sign up, an
 * existing customer made a wholesaler.
 */
export const WHOLESALE_TEXTS: Readonly<Record<string, string>> = {
  "wholesale_invite.subject": "{{shop}} toptan hesabınız hazır",
  "wholesale_invite.preheader": "Toptan fiyatlarla alışveriş için hesabınızı açın.",
  "wholesale_invite.heading": "Toptan hesabınız hazır",
  "wholesale_invite.intro":
    "{{shop}} sizin için bir toptan hesabı açtı. Hesabınızı oluşturup giriş yaptığınızda ürünleri toptan fiyatlarla görür ve sipariş verirsiniz.",
  "wholesale_invite.same_email":
    "Hesabı bu e-postanın geldiği adresle açın; toptan fiyatlar yalnızca bu adresle açılan hesapta görünür.",
  "wholesale_invite.button": "Hesabımı aç",
  "wholesale_invite.expires": "Davet {{at}} tarihine kadar geçerlidir.",
  "wholesale_invite.ignore":
    "Bu daveti beklemiyorsanız e-postayı yok sayın; siz hesap açmadıkça hiçbir şey değişmez.",
  "wholesale_enabled.subject": "{{shop}} toptan hesabınız açıldı",
  "wholesale_enabled.preheader": "Giriş yaptığınızda toptan fiyatları görürsünüz.",
  "wholesale_enabled.heading": "Toptan hesabınız açıldı",
  "wholesale_enabled.intro":
    "{{shop}} hesabınızı toptan hesaba çevirdi. Giriş yaptığınızda ürünleri toptan fiyatlarla görür ve sipariş verirsiniz.",
  "wholesale_enabled.button": "Giriş yap",
  "wholesale_enabled.note":
    "Toptan siparişlerinizle ilgili sorularınız için mağazayla iletişime geçebilirsiniz.",
}
