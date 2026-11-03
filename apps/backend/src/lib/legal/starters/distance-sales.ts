import type { Block } from "../../content"
import { draftNote, h2, p } from "./blocks"
import { defectClause, withdrawalClause } from "./clauses"
import { BUYER, ORDER, SELLER, disputeRoutes } from "./shared"

/**
 * Mesafeli Satış Sözleşmesi: the contract made with each order (Kanun
 * md. 48; Yönetmelik; 6563 sayılı Kanun md. 3–4). Kept with the order,
 * filled with it; the pre-information form is its integral part.
 */
const NOTE = draftNote([
  "İade için öngörülen taşıyıcının adı (7.5; Yönetmelik md. 5/1-g): mağaza ayarlarında yok, metne siz yazmalısınız.",
  "Kısmi iadede gidiş kargo ücretinin iadesi (7.6) ve değer kaybı kesintisi (7.8, Yönetmelik md. 13/2).",
  "Teslim edilemeyen ya da teslim alınmayan gönderinin (yanlış adres, adreste bulunmama, kapıda ödemeli gönderinin reddi) yeniden gönderim ücretinin kime ait olacağı (4.6).",
  "Fatura için vergi kimlik numarası veren tacir alıcılar: tüketici olmayan alıcılar için ayrı hükümler (cayma hakkı, yetkili mahkeme) gerekip gerekmediği.",
  "Delil maddesinin (13) tüketici aleyhine haksız şart sayılmaması için kapsamı (Kanun md. 5).",
  "Hediye kartı ve kişiye özel ürün cümleleri: ön bilgilendirme formundaki notla aynı (sunucu 7. maddenin sonuna ekler).",
  "Tüketici hakem heyeti parasal sınırı (14.2) her yıl ocak ayında güncellenmeli.",
])

export const distanceSales: { title: string; content: Block[] } = {
  title: "Mesafeli Satış Sözleşmesi",
  content: [
    NOTE,
    h2("1. Taraflar"),
    p("1.1. Satıcı:"),
    SELLER,
    p("1.2. Alıcı:"),
    BUYER,
    p(
      '1.3. Bu sözleşmede 6502 sayılı Tüketicinin Korunması Hakkında Kanun "Kanun", Mesafeli Sözleşmeler Yönetmeliği "Yönetmelik" olarak anılır.'
    ),
    h2("2. Sözleşmenin Konusu"),
    p(
      "2.1. Bu sözleşmenin konusu, Alıcının Satıcıya ait {alan_adı} internet sitesi üzerinden {sipariş_tarihi} tarihinde elektronik ortamda verdiği {sipariş_no} numaralı siparişe konu ürünlerin satışı ve teslimi ile tarafların bu satıştan doğan hak ve yükümlülükleridir. Tarafların hak ve yükümlülükleri Kanun, Yönetmelik ve 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun hükümlerine tabidir."
    ),
    p(
      "2.2. Ön Bilgilendirme Formu bu sözleşmenin ayrılmaz parçasıdır. İkisi arasında farklılık bulunması halinde Alıcı lehine olan hüküm uygulanır."
    ),
    h2("3. Ürünler, Fiyat ve Ödeme"),
    ...ORDER,
    p(
      "3.1. Fiyatlar Türk lirasıdır ve tüm vergiler dahildir. Fiyat, siparişin onaylandığı andaki fiyattır; Satıcı onaylanmış siparişin bedelini sonradan artıramaz."
    ),
    p(
      "3.2. Kargo ücreti ve varsa kapıda ödeme bedeli gibi ek ücretler sipariş onaylanmadan önce ödeme adımında gösterilmiştir. Alıcının açıkça onaylamadığı ek bir ödeme tahsil edilmez; edilmişse derhal iade edilir (Yönetmelik md. 19)."
    ),
    p(
      "3.3. Kartla ödemelerde kart bilgileri Satıcıya iletilmez, doğrudan ödeme kuruluşunun güvenli ödeme sayfasında işlenir. Taksitli ödemelerde taksit sayısı ve varsa vade farkı ödeme sayfasında gösterilir; taksitlendirme kartı çıkaran kuruluşun koşullarına tabidir."
    ),
    p(
      "3.4. Havale/EFT ile ödemelerde sipariş tutarının ödeme adımında belirtilen süre içinde Satıcının hesabına ulaşması gerekir; ödeme bu süre içinde ulaşmazsa sipariş iptal edilir ve sözleşme kurulmamış sayılır."
    ),
    h2("4. Teslimat"),
    p(
      "4.1. Ürünler, Alıcının siparişte belirttiği teslimat adresine Satıcının anlaşmalı kargo firmasıyla gönderilir. Kargo ücreti yukarıdaki tabloda gösterilmiştir."
    ),
    p(
      "4.2. Ürünler, ödemenin onaylanmasından itibaren {hazırlama_süresi} içinde kargoya verilir ve kargo firması tarafından genellikle {kargo_süresi} içinde teslim edilir. Teslimat, her durumda siparişin Satıcıya ulaşmasından itibaren 30 günü geçemez; Alıcının istekleri doğrultusunda kişiye özel hazırlanan ürünlerde teslim süresi ürün sayfasında ayrıca belirtilir (Kanun md. 48/3; Yönetmelik md. 16/1)."
    ),
    p(
      "4.3. Satıcı ürünü bu süre içinde teslim etmezse Alıcı sözleşmeyi feshedebilir. Fesih halinde Satıcı, teslim masrafları da dahil olmak üzere tahsil ettiği tüm ödemeleri fesih bildiriminin kendisine ulaştığı tarihten itibaren 14 gün içinde, 3095 sayılı Kanuni Faiz ve Temerrüt Faizine İlişkin Kanun uyarınca kanuni faiziyle birlikte iade eder (Yönetmelik md. 16/2-3)."
    ),
    p(
      "4.4. Satıcı, siparişi teslim edemeyeceğini öğrenirse bunu öğrendiği tarihten itibaren 3 gün içinde Alıcıya yazılı olarak veya kalıcı veri saklayıcısıyla bildirir ve tahsil ettiği tüm ödemeleri bildirim tarihinden itibaren en geç 14 gün içinde iade eder. Ürünün stokta bulunmaması ifanın imkânsızlaşması sayılmaz (Yönetmelik md. 16/4)."
    ),
    p(
      "4.5. Ürün Alıcıya veya Alıcının belirlediği, taşıyıcı dışındaki bir kişiye teslim edilinceye kadar oluşan kayıp ve hasardan Satıcı sorumludur. Alıcı, Satıcının belirlediği taşıyıcı dışında bir taşıyıcıyla gönderim isterse ürünün o taşıyıcıya tesliminden sonraki kayıp ve hasardan Satıcı sorumlu değildir (Yönetmelik md. 17)."
    ),
    p(
      "4.6. Teslimat adresinin eksik veya hatalı bildirilmesi ya da gönderinin kargo şubesinde bekleme süresi içinde teslim alınmaması nedeniyle teslim edilemeyen ürün Satıcıya geri döner. Bu durumda Satıcı Alıcıyla iletişime geçer; Alıcının tercihine göre ürün yeniden gönderilir ya da sipariş iptal edilerek tahsil edilen tutar iade edilir."
    ),
    h2("5. Alıcının Yükümlülükleri"),
    p(
      "5.1. Alıcı, siparişte verdiği kimlik, iletişim, teslimat ve fatura bilgilerinin doğru ve güncel olduğunu, ödemede kendisine ait veya kullanmaya yetkili olduğu bir ödeme aracını kullandığını kabul eder."
    ),
    p(
      "5.2. Alıcının teslim sırasında paketi kontrol etmesi; paket hasarlıysa kargo görevlisine hasar tespit tutanağı düzenletmesi ve durumu Satıcıya bildirmesi önerilir. Tutanak düzenlenmemiş olması Alıcının ayıplı ürüne ilişkin yasal haklarını ortadan kaldırmaz."
    ),
    p(
      "5.3. Alıcı, cayma hakkını kullandığında ürünü 7. maddede belirtilen süre ve şekilde iade eder."
    ),
    h2("6. Satıcının Yükümlülükleri"),
    p(
      "6.1. Satıcı, ürünü siparişte belirtilen niteliklere uygun, sağlam ve eksiksiz olarak; mevzuat gereği gerekiyorsa garanti belgesi ve Türkçe tanıtma ve kullanma kılavuzuyla birlikte teslim eder (Kanun md. 9, 55, 56)."
    ),
    p(
      "6.2. Satıcı, siparişin alındığını Alıcıya gecikmeksizin elektronik ortamda bildirir ve bu sözleşmenin bir kopyasını kalıcı veri saklayıcısıyla Alıcıya sunar (6563 sayılı Kanun md. 4; Kanun md. 4)."
    ),
    p(
      "6.3. Satıcı, bilgilendirme, teslimat ve cayma hakkına ilişkin kayıtları 3 yıl süreyle saklar (Yönetmelik md. 20) ve Alıcının kişisel verilerini KVKK Aydınlatma Metninde açıklandığı şekilde korur."
    ),
    ...withdrawalClause("7"),
    ...defectClause("8"),
    h2("9. Temerrüt"),
    p(
      "9.1. Satıcının teslimatta temerrüde düşmesi halinde Alıcı 4.3 maddesindeki haklarını kullanabilir; Türk Borçlar Kanunu md. 117 ve devamındaki hükümler saklıdır."
    ),
    p(
      "9.2. Alıcının kredi kartıyla yaptığı ödemelerde kart borcunun ödenmemesi halinde, kart hamili ile kartı çıkaran kuruluş arasındaki sözleşme hükümleri uygulanır."
    ),
    h2("10. Mücbir Sebep"),
    p(
      "10.1. Tarafların kontrolü dışında gelişen, önceden öngörülemeyen ve önlenemeyen olaylar (doğal afet, salgın, savaş, genel grev, resmî makamların kararları ve benzeri) nedeniyle yükümlülüğünü süresinde yerine getiremeyen taraf, durumu diğer tarafa gecikmeksizin bildirir (Türk Borçlar Kanunu md. 136)."
    ),
    p(
      "10.2. Mücbir sebep, Alıcının Kanun ve Yönetmelikten doğan haklarını ortadan kaldırmaz. Teslimat 4.2 maddesindeki süreyi aşarsa Alıcı sözleşmeyi feshedebilir ve ödediği tutarın 4.3 maddesine göre iadesini isteyebilir."
    ),
    h2("11. Bildirimler ve Elektronik İletişim"),
    p(
      "11.1. Taraflar arasındaki bildirimler, Satıcının 1. maddedeki iletişim bilgileri ve Alıcının siparişte bildirdiği e-posta adresi ve telefon numarası üzerinden yapılır. Sipariş, ödeme, teslimat, iade ve iptal süreçlerine ilişkin bilgilendirme iletileri bu kapsamdadır ve ayrıca onay gerektirmez (6563 sayılı Kanun md. 6)."
    ),
    p(
      "11.2. Kampanya, indirim ve tanıtım amaçlı ticari elektronik iletiler yalnızca Alıcının ayrıca vereceği onayla gönderilir. Alıcı bu onayı, iletilerdeki bağlantıdan veya hesabından istediği zaman ve ücretsiz olarak geri alabilir; ret talebinden sonra ileti gönderimi en geç 3 iş günü içinde durdurulur (6563 sayılı Kanun md. 6, 8)."
    ),
    h2("12. Kişisel Veriler"),
    p(
      "12.1. Alıcının kişisel verileri, bu sözleşmenin kurulması ve ifası ile Satıcının yasal yükümlülükleri için 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, Satıcının KVKK Aydınlatma Metninde açıklandığı şekilde işlenir."
    ),
    h2("13. Delil"),
    p(
      "13.1. Uyuşmazlıklarda Satıcının ticari defterleri ile siparişe, ödemeye ve onaylara ilişkin elektronik kayıtları, 6100 sayılı Hukuk Muhakemeleri Kanunu md. 199 anlamında belge niteliğindedir. Bu hüküm Alıcının her türlü delille ispat hakkını sınırlamaz."
    ),
    h2("14. Uyuşmazlıkların Çözümü"),
    ...disputeRoutes("14", "Alıcı", "Satıcı"),
    h2("15. Yürürlük"),
    p(
      "15.1. Bu sözleşme, Alıcının ödeme adımında Ön Bilgilendirme Formunu ve bu sözleşmeyi elektronik ortamda onaylayıp siparişi tamamlamasıyla {sipariş_tarihi} tarihinde kurulur ve yürürlüğe girer. Sipariş bilgileriyle doldurulmuş kopyası, siparişin alındığını bildiren e-postadaki bağlantıdan ve sipariş sayfasından her zaman görüntülenebilir."
    ),
  ],
}
