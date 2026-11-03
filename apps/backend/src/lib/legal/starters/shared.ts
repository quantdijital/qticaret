import type { Block } from "../../content"
import { bullets, p } from "./blocks"

/*
 * What the order's two contracts share (F13.7): the seller's and the
 * buyer's details, the order as a table, the exceptions to the right of
 * withdrawal and the routes to settle a dispute. Checked against the law
 * in force on 3 Kasım 2026 (docs/yasal-metinler.md).
 */

/**
 * The consumer arbitration boards' limit (TKHK md. 68): disputes under it
 * go to a board. Set each year by the Ministry of Trade; 2026's by the
 * Tebliğ in RG 23.12.2025/33116, in force 1.1.2026. Update it every
 * January (docs/yasal-metinler.md).
 */
export const ARBITRATION_LIMIT = { year: 2026, lira: "186.000 TL" } as const

/** The seller as the law asks a web shop to name itself (MSY md. 5/1-b, c; 6563 md. 3). */
export const SELLER: Block = bullets([
  "Unvan: {mağaza_unvanı}",
  "Adres: {adres}",
  "MERSİS numarası: {mersis}",
  "Vergi dairesi ve vergi kimlik numarası: {vergi_dairesi} / {vkn}",
  "Kayıtlı elektronik posta (KEP) adresi: {kep}",
  "E-posta: {e_posta}",
  "Telefon: {telefon}",
  "İnternet sitesi: {alan_adı}",
  "ETBİS kayıt numarası: {etbis}",
])

export const BUYER: Block = bullets([
  "Ad soyad: {alıcı_adı}",
  "Teslimat adresi: {teslimat_adresi}",
  "Fatura adresi: {fatura_adresi}",
  "E-posta: {alıcı_e_posta}",
  "Telefon: {alıcı_telefon}",
])

/** The order: its number and date, its lines as a table, its totals and the way it is paid. */
export const ORDER: Block[] = [
  p("Sipariş numarası: {sipariş_no}, sipariş tarihi: {sipariş_tarihi}"),
  p("{sipariş_kalemleri}"),
  bullets([
    "Ürünlerin toplam bedeli (KDV dahil): {ara_toplam}",
    "Kargo ücreti: {kargo_ücreti}",
    "İndirim: {indirim}",
    "Ödenecek toplam tutar (tüm vergiler dahil): {toplam}",
    "Ödeme yöntemi: {ödeme_yöntemi}",
  ]),
]

/**
 * MSY md. 15/1 as in force since 1.1.2026: (a)–(h). The 2022 additions
 * (ı), (j), (k) were annulled by Danıştay 10. Daire (6.5.2026,
 * E.2022/5534, K.2026/2753) and (i) repealed (RG 24.5.2025/32909)
 * before it applied, so none is listed.
 */
export const WITHDRAWAL_EXCEPTIONS: Block = bullets([
  "Fiyatı finansal piyasalardaki dalgalanmalara bağlı olarak değişen ve satıcının kontrolünde olmayan mal veya hizmetlere ilişkin sözleşmeler (md. 15/1-a).",
  "Alıcının istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallara ilişkin sözleşmeler (md. 15/1-b).",
  "Çabuk bozulabilen veya son kullanma tarihi geçebilecek malların teslimine ilişkin sözleşmeler (md. 15/1-c).",
  "Tesliminden sonra ambalaj, bant, mühür, paket gibi koruyucu unsurları açılmış olan mallardan, iadesi sağlık ve hijyen açısından uygun olmayanların teslimine ilişkin sözleşmeler (md. 15/1-ç).",
  "Tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan mallara ilişkin sözleşmeler (md. 15/1-d).",
  "Malın tesliminden sonra ambalaj, bant, mühür, paket gibi koruyucu unsurları açılmış olması halinde maddi ortamda sunulan kitap, dijital içerik ve bilgisayar sarf malzemelerine ilişkin sözleşmeler (md. 15/1-e).",
  "Abonelik sözleşmesi kapsamında sağlananlar dışında gazete ve dergi gibi süreli yayınların teslimine ilişkin sözleşmeler (md. 15/1-f).",
  "Belirli bir tarihte veya dönemde yapılması gereken konaklama, eşya taşıma, araba kiralama, yiyecek-içecek tedariki ve eğlence veya dinlenme amacıyla yapılan boş zamanın değerlendirilmesine ilişkin sözleşmeler (md. 15/1-g).",
  "Elektronik ortamda anında ifa edilen hizmetlere veya alıcıya anında teslim edilen gayrimaddi mallara ilişkin sözleşmeler (md. 15/1-ğ).",
  "Cayma hakkı süresi sona ermeden önce alıcının onayıyla ifasına başlanan hizmetlere ilişkin sözleşmeler (md. 15/1-h).",
])

/** Where a consumer takes a dispute (MSY md. 5/1-k as in force since 1.1.2026; TKHK md. 68, 73, 73/A). */
export function disputeRoutes(
  n: string,
  party: "Alıcı" | "Üye",
  shop: "Satıcı" | "Mağaza"
): Block[] {
  const { year, lira } = ARBITRATION_LIMIT
  return [
    p(
      `${n}.1. ${party}, şikâyet ve taleplerini öncelikle yukarıdaki iletişim bilgileri üzerinden ${shop === "Satıcı" ? "Satıcıya" : "Mağazaya"} iletebilir. Şikâyetler en kısa sürede yanıtlanır.`
    ),
    p(
      `${n}.2. Uyuşmazlık halinde ${party}; Ticaret Bakanlığınca her yıl ilan edilen parasal sınırın (${String(year)} yılı için ${lira}) altındaki uyuşmazlıklarda yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki il ya da ilçe tüketici hakem heyetine başvurabilir (6502 sayılı Tüketicinin Korunması Hakkında Kanun md. 68). Hakem heyetine başvuru e-Devlet Kapısı üzerinden de yapılabilir.`
    ),
    p(
      `${n}.3. Değeri bu sınıra eşit veya daha yüksek olan uyuşmazlıklarda tüketici mahkemesinde dava açılabilir. Dava açmadan önce arabulucuya başvurulması zorunludur (6502 sayılı Kanun md. 73/A). ${party}, davayı kendi yerleşim yerindeki tüketici mahkemesinde de açabilir (6502 sayılı Kanun md. 73).`
    ),
    p(`${n}.4. Bu metne Türkiye Cumhuriyeti hukuku uygulanır.`),
  ]
}
