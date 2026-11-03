import type { Block } from "../../content"
import { bullets, draftNote, h2, numbered, p } from "./blocks"
import { WITHDRAWAL_EXCEPTIONS } from "./shared"

/**
 * İade ve Değişim Politikası: how the shop runs withdrawal, returns and
 * exchanges (adr/0032, adr/0025, adr/0052), held to Yönetmelik md. 9–15
 * as in force since 1.1.2026 and to what the platform does (adr/0032 Ek
 * 2026-11-03): the return parcel always at the shop's cost (md. 12/5), a
 * withdrawal's outbound shipping refunded once, a part of the order too
 * (md. 12/1), a physical product's mark a sealed good refused at receipt
 * if opened (md. 15/1-ç), a digital or service one's an exclusion.
 */
const NOTE = draftNote([
  "İade için öngörülen kargo firmasının adı (4. madde; md. 5/1-g): mağaza ayarlarında yok. İade kargosu her zaman mağazanın hesabından açılır; platformda müşterinin ödediği bir iade kargosu seçeneği yoktur (md. 12/5).",
  "Kısmi iadede gidiş kargo ücreti (6. madde): siparişin yalnızca bir kısmı iade edildiğinde de platform siparişin kargo ücretinin tamamını ilk iadeyle bir kez iade ediyor ve metin bunu söylüyor. Yönetmeliğin kısmi iadede ücretin tamamının iadesini gerektirip gerektirmediği; gerektirmiyorsa bu bir mağaza tercihi olur.",
  'Kapıda ödeme bedeli (6. madde): metin, cayıldığında bu bedelin de iade edileceğini söylüyor; platform bugün bu bedeli iade tutarına kendiliğinden katmıyor, personelin ayrıca iade etmesi gerekiyor. Bedelin md. 12/1\'deki "tahsil ettiği tüm ödemeler"e girip girmediği.',
  "Değer kaybı kesintisi (5. madde; md. 13/2) yapılıp yapılmayacağı ve nasıl belgeleneceği. Platformda kesinti yok.",
  'Ürün düzeyinde "cayma hakkı dışında" işaretlediğiniz ürünler (2. ve 5. madde): fiziksel üründe işaret hijyen uyarısıdır. Talep kabul edilir, koruyucu ambalajı açılmış gelen ürün teslim almada reddedilir, bedeli iade edilmez ve müşteriye e-postayla bildirilir (md. 15/1-ç). Dijital ürün ve hizmette işaret cayma hakkını kaldırır (md. 15/1-ğ, h); hizmette ifaya cayma süresi içinde alıcının onayıyla başlanması gerekir. Bu işaretin ürün sayfasında siparişten önce gösterildiğini kontrol edin (md. 5/1-h, md. 6/2).',
  "Reddedilen ürünün müşteriye geri gönderim ücreti (5. madde): platformun müşteriye giden e-postası ürünün ücreti mağazaya ait olmak üzere geri gönderilebileceğini ya da mağazadan teslim alınabileceğini söylüyor. Ücretin müşteriden istenip istenemeyeceği.",
  "Hediye kartlarında cayma kuralı (2. madde): kartlardan harcama yapılmadıkça cayma var. md. 15/1-ğ karşısında yeterliliği.",
  "Kapıda ödeme ve havale iadelerinde banka hesabı (IBAN) istenmesi ve hesabın alıcı adına olması şartı (6. madde).",
  "İade talebi formu cayma süresi dolunca kapanıyor; ayıplı ürün başvuruları bu süreden sonra e-posta veya telefonla alınıyor (8. madde).",
])

export const returnPolicy: { title: string; content: Block[] } = {
  title: "İade ve Değişim Politikası",
  content: [
    NOTE,
    p(
      'Bu politika, {alan_adı} üzerinden verdiğiniz siparişlerde cayma hakkınızı nasıl kullanacağınızı, iade ve değişim sürecini ve para iadesinin nasıl yapılacağını açıklar. Haklarınız 6502 sayılı Tüketicinin Korunması Hakkında Kanun ("Kanun") ve Mesafeli Sözleşmeler Yönetmeliğine ("Yönetmelik") dayanır; bu politika yasal haklarınızı sınırlamaz. Siparişinize ait Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi de aynı kuralları içerir.'
    ),
    h2("1. Cayma Hakkı ve Süresi"),
    p(
      "Ürünü teslim aldığınız günden itibaren {iade_süresi} gün içinde hiçbir gerekçe göstermeden ve cezai şart ödemeden cayma hakkınızı kullanabilirsiniz (Yönetmelik md. 9). Siparişinizdeki ürünler ayrı ayrı teslim edildiyse süre son ürünü teslim aldığınız gün başlar. Ürün henüz teslim edilmeden de siparişinizden cayabilirsiniz; siparişiniz kargoya verilmediyse sipariş sayfasından iptal edebilirsiniz."
    ),
    h2("2. Cayma Hakkının Kullanılamadığı Ürünler"),
    p("Yönetmelik md. 15/1 uyarınca aşağıdaki ürün ve hizmetlerde cayma hakkı kullanılamaz:"),
    WITHDRAWAL_EXCEPTIONS,
    bullets([
      "Kişiye özel ürünler: Ürün üzerine yazı gibi, ürün sayfasında kişiye özel olduğu belirtilen bir seçenekle hazırlanan ürünlerde cayma hakkı yoktur (md. 15/1-b). Bu ürünler yalnızca ayıplı veya yanlış gönderildiyse iade edilebilir; değişim yapılmaz.",
      "Hijyen ürünleri: Ürün sayfasında koruyucu ambalajı açıldığında iade alınmadığı belirtilen ürünlerde, ambalaj açılmadığı sürece cayma hakkınız devam eder. Koruyucu ambalajı açılmış olarak geri gönderilen bu ürünler, iadesi sağlık ve hijyen açısından uygun olmadığından kabul edilmez (md. 15/1-ç; 5. madde).",
      "Dijital ürünler ve hizmetler: Ürün sayfasında cayma hakkı dışında olduğu belirtilen dijital içerik size teslim edildikten, hizmet ise cayma süresi içinde onayınızla ifasına başlandıktan sonra cayma hakkı kullanılamaz (md. 15/1-ğ, h).",
      "Hediye kartları: Kartlar alıcısına e-postayla gönderildiği günden itibaren {iade_süresi} gün içinde ve kartlardan hiç harcama yapılmamışsa cayma hakkınızı kullanabilirsiniz; bu durumda kartlar kapatılır ve ödediğiniz tutar iade edilir. Aynı ürün satırındaki kartlardan birinin bakiyesi kullanıldıktan sonra o ürün için cayma hakkı kullanılamaz. Hediye kartlarının son kullanma tarihi yoktur.",
    ]),
    h2("3. İade Talebi Nasıl Oluşturulur?"),
    numbered([
      'Üyeyseniz hesabınızdaki siparişlerinizden, üye değilseniz sipariş e-postanızdaki bağlantıdan veya sitedeki "Siparişimi bul" sayfasından siparişinizi açın ve "İade ya da değişim talep et" bölümüne gidin.',
      "İade etmek istediğiniz ürünleri ve adetleri seçin. Cayma hakkında neden göstermeniz gerekmez; formdaki neden seçimi yalnızca süreci kolaylaştırmak içindir.",
      "Talebiniz alındığında size e-postayla bildirilir. Talep onaylandığında iade kodu ve gönderim bilgileri e-postayla iletilir.",
      "Ürünü, cayma bildiriminizden itibaren en geç 14 gün içinde iade kodunu kullanarak kargoya verin (md. 13/1).",
    ]),
    p("Cayma bildiriminizi formu kullanmadan da yapabilirsiniz:"),
    bullets(["E-posta: {e_posta}", "KEP: {kep}", "Posta veya elden teslim: {adres}"]),
    p(
      "Bildiriminizde adınızı, sipariş numaranızı ve cayma hakkını kullandığınız ürünleri belirtmeniz yeterlidir; Mesafeli Sözleşmeler Yönetmeliğinin ekindeki örnek cayma formunu da kullanabilirsiniz. Bildiriminizin süre dolmadan bize ulaşması yeterlidir."
    ),
    h2("4. Ürünün Gönderilmesi"),
    p(
      "Ürünü, taşıma sırasında zarar görmeyecek şekilde paketleyin; varsa aksesuarlarını, kullanım kılavuzunu ve birlikte gönderilen hediyeleri de ekleyin. İade gönderimi, iade kodu ile anlaşmalı kargo firmamız aracılığıyla yapılır. Bu yolla gönderdiğiniz iade ve değişimlerde kargo ücreti sizden istenmez (Yönetmelik md. 12)."
    ),
    p(
      "Anlaşmalı kargo firmamızın bulunduğunuz yerde şubesi yoksa bize bildirin; ürün sizden ek ücret istenmeden alınır. Ürünü kendi seçtiğiniz başka bir kargo firmasıyla gönderirseniz gönderim ücreti size aittir."
    ),
    h2("5. İade Edilen Ürünün Kontrolü"),
    p(
      "İade edilen ürün bize ulaştığında kontrol edilir. Cayma süresi içinde ürünün işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun kullanımından doğan değişiklik ve bozulmalardan sorumlu değilsiniz (md. 13/2). Ürünün kontrolü, para iadesinin yasal süresini durdurmaz."
    ),
    p(
      "Koruyucu ambalajı açılmış olarak gelen hijyen ürünleri iade olarak kabul edilmez ve bedelleri iade edilmez; iadenizdeki diğer ürünlerin işlemi devam eder. Kabul edilmeyen ürünler size e-postayla bildirilir. Bu ürünler size aittir: ücreti tarafımızca karşılanarak adresinize geri gönderilebilir ya da bizden teslim alabilirsiniz; tercihinizi bize bildirin."
    ),
    h2("6. Para İadesi"),
    p(
      "Cayma hakkınızı kullandığınızda, iade ettiğiniz ürünlerin bedeli, siparişin kargo ücreti ve varsa kapıda ödeme bedeli dahil olmak üzere ödediğiniz tüm tutar en geç 14 gün içinde iade edilir. Siparişin yalnızca bir kısmını iade ettiğinizde de siparişin kargo ücreti ilk iadenizle birlikte bir kez iade edilir. Bu süre; ürün teslim edildikten sonra cayıldıysa ürünü iade kodu ile anlaşmalı kargo firmamıza teslim ettiğiniz tarihten, başka bir kargo firmasıyla gönderdiyseniz ürünün bize ulaştığı tarihten, ürün teslim edilmeden cayıldıysa bildiriminizin bize ulaştığı tarihten başlar (Yönetmelik md. 12)."
    ),
    bullets([
      "Kredi veya banka kartıyla yapılan ödemeler aynı karta iade edilir; tutar, kartı çıkaran kuruluşça kartınıza yansıtılır. Taksitli alışverişlerde iade tek seferde yapılır.",
      "Hediye kartı veya mağaza kredisiyle ödenen kısım aynı karta ya da krediye geri yüklenir.",
      "Kapıda ödeme veya havale/EFT ile yapılan ödemeler, bildireceğiniz ve adınıza kayıtlı banka hesabına havale/EFT ile iade edilir.",
      "Para iadesi için sizden ayrıca bir masraf alınmaz.",
    ]),
    h2("7. Değişim"),
    p(
      "Cayma süresi içinde ürünü aynı ürünün başka bir seçeneğiyle (beden, renk gibi) değiştirmek isterseniz iade talebinde değişim seçeneğini kullanabilirsiniz. Değişim stok durumuna bağlıdır; yeni ürünün gönderimi için ücret alınmaz ve iade edilen ürün bize ulaştıktan sonra yeni ürün kargoya verilir."
    ),
    p(
      "Yeni seçeneğin fiyatı daha düşükse aradaki fark size iade edilir; daha yüksekse farkın ödenmesi istenir. İndirimli alınan ürünler yalnızca aynı fiyattaki bir seçenekle değiştirilebilir. Değişim yerine paranızın iadesini isteme hakkınız her zaman saklıdır."
    ),
    h2("8. Ayıplı, Hasarlı veya Yanlış Ürünler"),
    p(
      "Ayıplı, hasarlı veya siparişinizden farklı bir ürün teslim edildiyse bu durum cayma hakkından bağımsızdır. Kanun md. 11 uyarınca sözleşmeden dönme, ayıp oranında bedel indirimi, ücretsiz onarım veya ayıpsız misliyle değiştirme haklarından birini seçebilirsiniz. Bu iadelerin kargo ücreti ve diğer masraflar bize aittir."
    ),
    p(
      'Cayma süresi içinde iade talebi formunda "Hasarlı geldi", "Yanlış ürün geldi" veya "Açıklamadaki gibi değil" nedenlerinden birini seçebilirsiniz. Bu süreden sonra da {e_posta} adresine veya {telefon} numarasına başvurabilirsiniz; ayıptan sorumluluk teslimden itibaren 2 yıl sürer (Kanun md. 12).'
    ),
    p(
      "Paket teslim sırasında hasarlı görünüyorsa kargo görevlisine hasar tespit tutanağı düzenletmenizi ve bize bildirmenizi öneririz. Tutanak düzenlenmemiş olması yasal haklarınızı ortadan kaldırmaz."
    ),
    h2("9. Siparişin İptali"),
    p(
      "Siparişiniz kargoya verilmeden önce sipariş sayfasından iptal edebilirsiniz. İptal edilen siparişin tutarı, iptal bildiriminizin bize ulaşmasından itibaren en geç 14 gün içinde, ödeme yönteminize uygun şekilde iade edilir."
    ),
    h2("10. İletişim"),
    bullets([
      "Unvan: {mağaza_unvanı}",
      "E-posta: {e_posta}",
      "Telefon: {telefon}",
      "Adres: {adres}",
    ]),
  ],
}
