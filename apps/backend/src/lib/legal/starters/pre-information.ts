import type { Block } from "../../content"
import { bullets, draftNote, h2, p } from "./blocks"
import { defectSummary, withdrawalClause } from "./clauses"
import { BUYER, ORDER, SELLER, disputeRoutes } from "./shared"

/**
 * Ön Bilgilendirme Formu: what the consumer must be told before the order
 * binds them (Yönetmelik md. 5 as in force since 1.1.2026, md. 6–8;
 * Kanun md. 48/2; 6563 md. 3, 4). Kept with the order, filled with it.
 */
const NOTE = draftNote([
  'İade için öngörülen taşıyıcı (Yönetmelik md. 5/1-g): mağaza ayarlarında bu bilgi yok. 5.5 maddesindeki "anlaşmalı olduğu kargo firması" ifadesinin yerine firmanın adını yazın. Taşıyıcı belirtilmezse iade masrafı alıcıdan istenemez (md. 12).',
  'Siparişin yalnızca bir kısmı iade edildiğinde gidiş kargo ücretinin iade edilip edilmeyeceği (5.6, "teslim masrafları dahil"). Platformun iade akışı kargo ücretini kendiliğinden iade etmiyor; personel teslim almada seçiyor.',
  "Değer kaybı: olağan kullanım dışında kullanılmış ürün için iade tutarından kesinti yapılıp yapılamayacağı ve bunun nasıl belgeleneceği (md. 13/2).",
  "Kişiye özel ürün ve hediye kartı cümleleri: sunucu, siparişte böyle satır varsa 5. maddenin sonuna kendi cümlesini ekler (kişiye özel: md. 15/1-b; hediye kartı: kartlardan harcama yapılmadıkça cayma var). Hediye kartı kuralının md. 15/1-ğ karşısında yeterliliği.",
  'Ürün düzeyinde "cayma hakkı dışında" işaretlenen ürünler vitrinde ürün sayfasında henüz gösterilmiyor (yalnızca kişiye özel ek seçenekler gösteriliyor); md. 5/1-h ve md. 6/2 bu bilginin siparişten önce verilmesini istiyor. Hijyen istisnası (md. 15/1-ç) yalnızca koruyucu ambalajı açılmış ürünlerde geçerlidir.',
  "Kapıda ödeme ve havale/EFT iadelerinde alıcıdan banka hesabı (IBAN) istenmesi ve hesabın alıcı adına olması şartı (5.7).",
  "Sektöre özel satış kısıtları (ör. yaş sınırı) varsa bu forma ayrı bir madde eklenmesi.",
  "Tüketici hakem heyeti parasal sınırı her yıl değişir (7.2). Metindeki yıl ve tutarı her ocak ayında güncelleyecek kişiyi belirleyin.",
])

export const preInformation: { title: string; content: Block[] } = {
  title: "Ön Bilgilendirme Formu",
  content: [
    NOTE,
    p(
      'Bu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ("Kanun") md. 48 ve Mesafeli Sözleşmeler Yönetmeliği ("Yönetmelik") md. 5 uyarınca, sipariş onaylanmadan önce Alıcının bilgilendirilmesi amacıyla düzenlenmiştir.'
    ),
    h2("1. Satıcı Bilgileri"),
    SELLER,
    p(
      "1.1. Şikâyet ve itirazlar da bu iletişim bilgileri üzerinden iletilebilir. Satıcıyla iletişim için kullanılan telefon hattı olağan tarifenin üzerinde ücretlendirilmez (Yönetmelik md. 18)."
    ),
    h2("2. Alıcı Bilgileri"),
    BUYER,
    h2("3. Ürünler, Fiyat ve Ödeme"),
    p(
      "3.1. Sözleşme konusu ürünlerin temel nitelikleri (tür, model, renk, beden, adet ve benzeri) ürün sayfasında ve aşağıdaki tabloda yer alır."
    ),
    ...ORDER,
    p(
      "3.2. Fiyatlar Türk lirasıdır ve tüm vergiler dahildir. Kargo ücreti ve varsa kapıda ödeme bedeli gibi ek ücretler, sipariş onaylanmadan önce ödeme adımında ayrıca gösterilir. Burada gösterilmeyen bir ek ücret Alıcıdan istenemez; Alıcının açıkça onaylamadığı ek ödemeler tahsil edilmez (Yönetmelik md. 5/3, md. 19)."
    ),
    p(
      "3.3. Satıcının sunduğu ödeme yöntemleri ödeme adımında listelenir; bu sipariş için seçilen yöntem yukarıda belirtilmiştir. Kartla ödemelerde kart bilgileri Satıcıya iletilmez, doğrudan ödeme kuruluşunun güvenli ödeme sayfasına girilir. Taksitli ödemelerde taksit sayısı ve varsa vade farkı, ödeme onaylanmadan önce ödeme sayfasında gösterilir."
    ),
    p(
      "3.4. Havale/EFT ile ödemelerde sipariş tutarının ödeme adımında belirtilen süre içinde Satıcının hesabına ulaşması gerekir; bu süre içinde ödenmeyen sipariş iptal edilir. Kapıda ödeme, yalnızca ödeme adımında sunulduğu siparişlerde kullanılabilir."
    ),
    p(
      "3.5. Satıcı, Alıcıdan depozito veya benzeri bir mali teminat istemez. Satıcının sattığı ürünler arasında dijital içerik bulunması halinde, dijital içeriğin işlevselliğini etkileyebilecek teknik koruma önlemleri ve uyumlu olduğu donanım ve yazılım ürün sayfasında belirtilir."
    ),
    h2("4. Teslimat"),
    p(
      "4.1. Ürünler, Alıcının belirttiği teslimat adresine kargo ile gönderilir. Siparişler Türkiye içindeki adreslere gönderilir."
    ),
    p(
      "4.2. Ürünler, ödemenin onaylanmasından itibaren {hazırlama_süresi} içinde kargoya verilir ve kargo firması tarafından genellikle {kargo_süresi} içinde teslim edilir. Teslimat, her durumda siparişin Satıcıya ulaşmasından itibaren 30 günü geçemez; Alıcının istekleri doğrultusunda kişiye özel hazırlanan ürünlerde teslim süresi ürün sayfasında ayrıca belirtilir (Kanun md. 48/3; Yönetmelik md. 16/1)."
    ),
    p(
      "4.3. Satıcı, siparişi teslim edemeyeceğini öğrenirse bunu öğrendiği tarihten itibaren 3 gün içinde Alıcıya yazılı olarak veya kalıcı veri saklayıcısıyla bildirir ve tahsil ettiği tüm ödemeleri bildirim tarihinden itibaren en geç 14 gün içinde iade eder. Ürünün stokta bulunmaması, ifanın imkânsızlaşması sayılmaz (Yönetmelik md. 16/4)."
    ),
    p(
      "4.4. Ürün Alıcıya veya Alıcının belirlediği, taşıyıcı dışındaki bir kişiye teslim edilinceye kadar oluşan kayıp ve hasardan Satıcı sorumludur (Yönetmelik md. 17)."
    ),
    ...withdrawalClause("5"),
    ...defectSummary("6"),
    h2("7. Şikâyet ve Uyuşmazlıkların Çözümü"),
    ...disputeRoutes("7", "Alıcı", "Satıcı"),
    h2("8. Ön Bilgilendirmenin Teyidi"),
    p(
      "8.1. Bu form, mesafeli satış sözleşmesinin ayrılmaz parçasıdır ve tarafların açık mutabakatı olmadıkça değiştirilemez (Yönetmelik md. 5/2)."
    ),
    p(
      "8.2. Siparişin onaylanması Alıcıya ödeme yükümlülüğü getirir (Kanun md. 48/2; Yönetmelik md. 8). Alıcı, siparişi onaylamadan önce bu formu okuduğunu ödeme adımında elektronik ortamda teyit eder (Yönetmelik md. 7)."
    ),
    p(
      "8.3. Bu formun ve mesafeli satış sözleşmesinin sipariş bilgileriyle doldurulmuş kopyası, siparişin alındığını bildiren e-postadaki bağlantıdan ve sipariş sayfasından her zaman görüntülenebilir. Satıcı, bilgilendirme, teslimat ve cayma hakkına ilişkin kayıtları 3 yıl süreyle saklar (Yönetmelik md. 20)."
    ),
    bullets(["Form tarihi: {sipariş_tarihi}", "Sipariş numarası: {sipariş_no}"]),
  ],
}
