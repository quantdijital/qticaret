import type { Block, ContentDoc } from "../content"
import type { Paragraph } from "../content/doc"
import type { LegalKind } from "./tokens"

/**
 * Starting drafts for each kind (F13.7, adr/0041 §1): a skeleton with the
 * headings such a text usually has and the shop's tokens in place. Not
 * legal advice: each opens with a note to have it checked by a lawyer
 * (docs/12), which the shop deletes once it has been.
 */

const text = (value: string) => ({ type: "text" as const, text: value })
const h = (value: string): Block => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
})
const p = (value: string): Paragraph => ({ type: "paragraph", content: [text(value)] })
const list = (items: readonly string[]): Block => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [text(item)] }],
  })),
})

const NOTE: Block = {
  type: "blockquote",
  content: [
    p(
      "TASLAK: Bu metin bir başlangıç iskeletidir, hukuki görüş değildir. Yayımlamadan önce avukatınıza kontrol ettirin ve bu notu silin."
    ),
  ],
}

const SELLER = list([
  "Unvan: {mağaza_unvanı}",
  "Adres: {adres}",
  "MERSİS: {mersis}",
  "Vergi dairesi ve no: {vergi_dairesi} {vkn}",
  "KEP: {kep}",
  "E-posta: {e_posta}, telefon: {telefon}",
])

const BUYER = list([
  "Ad soyad: {alıcı_adı}",
  "Teslimat adresi: {teslimat_adresi}",
  "Fatura adresi: {fatura_adresi}",
  "E-posta: {alıcı_e_posta}, telefon: {alıcı_telefon}",
])

const ORDER: Block[] = [
  p("Sipariş no: {sipariş_no}, tarih: {sipariş_tarihi}"),
  p("{sipariş_kalemleri}"),
  list([
    "Ara toplam: {ara_toplam}",
    "Kargo: {kargo_ücreti}",
    "İndirim: {indirim}",
    "Toplam (KDV dahil): {toplam}",
    "Ödeme yöntemi: {ödeme_yöntemi}",
  ]),
]

const STARTERS: Record<LegalKind, { title: string; content: Block[] }> = {
  pre_information: {
    title: "Ön Bilgilendirme Formu",
    content: [
      NOTE,
      h("1. Satıcı"),
      SELLER,
      h("2. Alıcı"),
      BUYER,
      h("3. Sözleşme konusu ürünler ve bedel"),
      ...ORDER,
      h("4. Teslimat"),
      p("Ürünler {teslimat_adresi} adresine kargo ile gönderilir."),
      h("5. Cayma hakkı"),
      p(
        "Alıcı, ürünü teslim aldığı günden başlayarak {iade_süresi} gün içinde gerekçe göstermeden cayma hakkını kullanabilir."
      ),
      h("6. Şikâyet ve itiraz"),
      p(
        "Şikâyet ve itirazlar için Tüketici Hakem Heyetine ya da Tüketici Mahkemesine başvurulabilir."
      ),
    ],
  },
  distance_sales: {
    title: "Mesafeli Satış Sözleşmesi",
    content: [
      NOTE,
      h("1. Taraflar"),
      p("Satıcı:"),
      SELLER,
      p("Alıcı:"),
      BUYER,
      h("2. Konu"),
      p(
        "Bu sözleşme, alıcının {alan_adı} üzerinden {sipariş_tarihi} tarihinde verdiği {sipariş_no} numaralı siparişe konu ürünlerin satışını ve teslimini düzenler."
      ),
      h("3. Ürünler ve ödeme"),
      ...ORDER,
      h("4. Teslimat"),
      p("Ürünler, yasal süre içinde {teslimat_adresi} adresine teslim edilir."),
      h("5. Cayma hakkı"),
      p(
        "Alıcı, teslimattan başlayarak {iade_süresi} gün içinde cayma hakkını kullanabilir; bildirim {e_posta} adresine yapılır."
      ),
      h("6. Uyuşmazlık"),
      p("Uyuşmazlıklarda Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir."),
    ],
  },
  privacy_notice: {
    title: "Kişisel Verilerin Korunması Aydınlatma Metni",
    content: [
      NOTE,
      h("Veri sorumlusu"),
      p("{mağaza_unvanı}, {adres}"),
      h("İşlenen veriler ve amaçları"),
      list([
        "Kimlik ve iletişim bilgileri: siparişin kurulması ve teslimi",
        "Sipariş ve ödeme bilgileri: sözleşmenin ifası ve yasal yükümlülükler",
        "İzin verildiyse iletişim tercihleri: kampanya bildirimleri",
      ]),
      h("Aktarım"),
      p(
        "Veriler kargo, ödeme ve e-posta hizmeti sağlayıcılarıyla yalnızca hizmetin gerektirdiği ölçüde paylaşılır."
      ),
      h("Haklarınız"),
      p("KVKK md. 11 kapsamındaki taleplerinizi {e_posta} adresine iletebilirsiniz."),
    ],
  },
  cookie_policy: {
    title: "Çerez Politikası",
    content: [
      NOTE,
      h("Kullandığımız çerezler"),
      list([
        "Zorunlu çerezler: sepet ve oturum için; kapatılamaz",
        "Analitik çerezler: siteyi geliştirmek için; izninizle",
        "Pazarlama çerezleri: reklamları ölçmek için; izninizle",
      ]),
      h("Tercihlerinizi değiştirme"),
      p(
        "Çerez tercihlerinizi sitenin altındaki çerez ayarlarından istediğiniz zaman değiştirebilirsiniz."
      ),
    ],
  },
  return_policy: {
    title: "İade ve Değişim Politikası",
    content: [
      NOTE,
      h("Cayma süresi"),
      p(
        "Ürünü teslim aldığınız günden başlayarak {iade_süresi} gün içinde iade talebinde bulunabilirsiniz."
      ),
      h("Nasıl iade edilir"),
      p("Hesabınızdaki siparişten ya da e-postadaki sipariş bağlantısından iade talebi oluşturun."),
      h("Para iadesi"),
      p("İade edilen ürün bize ulaşıp kontrol edildikten sonra ödeme yönteminize geri ödenir."),
    ],
  },
  shipping_policy: {
    title: "Kargo ve Teslimat Politikası",
    content: [
      NOTE,
      h("Gönderim"),
      p("Siparişler hazırlandıktan sonra anlaşmalı kargo firmasıyla gönderilir."),
      h("Kargo ücreti"),
      p("Kargo ücreti ödeme adımında gösterilir."),
    ],
  },
  membership: {
    title: "Üyelik Sözleşmesi",
    content: [
      NOTE,
      h("Taraflar"),
      p("{mağaza_unvanı} ile {alan_adı} üzerinde üye olan kişi arasındadır."),
      h("Üyelik"),
      p(
        "Üye, verdiği bilgilerin doğru olduğunu ve hesabının güvenliğinden sorumlu olduğunu kabul eder."
      ),
    ],
  },
}

/** A kind's starting draft: title and document. */
export function starterOf(kind: LegalKind): { title: string; body: ContentDoc } {
  const starter = STARTERS[kind]
  return { title: starter.title, body: { type: "doc", content: starter.content } }
}
