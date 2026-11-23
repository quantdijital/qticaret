import type { Block } from "../../content"
import { bullets, draftNote, h2, p, table } from "./blocks"

/**
 * KVKK Aydınlatma Metni: 6698 sayılı Kanun md. 10 and the Aydınlatma
 * Yükümlülüğü Tebliği (RG 10.3.2018/30356) md. 5, written from
 * docs/kvkk-envanter.md (categories, purposes, recipients, retention).
 * Separate from any consent, as the Kurul's İlke Kararı 2026/347
 * (RG 24.3.2026/33203) asks.
 */
const NOTE = draftNote([
  "Yurt dışına aktarımın dayanağı (KVKK md. 9, 7499 sayılı Kanunla değişik, 1.6.2024'ten beri): içerik dağıtım ve güvenlik hizmeti ile e-posta gönderim hizmeti için Kurulun standart sözleşmesinin imzalanıp 5 iş günü içinde Kuruma bildirilmesi; Google ve Meta için açık rıza (yalnızca arızi aktarımda geçerli) mı standart sözleşme mi.",
  "Hizmet sağlayıcıların adlarının ve ülkelerinin metinde tek tek sayılması gerekip gerekmediği (metin kategori olarak yazıyor; platformun kullandığı sağlayıcılar docs/yasal-metinler.md'de).",
  "Ticari elektronik iletilerin hukuki sebebi: 6563 sayılı Kanun md. 6 onayı ile KVKK md. 5/1 açık rızasının birlikte aranması. Kurulun 2026/347 sayılı İlke Kararı aydınlatma ve açık rızanın ayrı metin ve ayrı beyanla alınmasını istiyor; ödeme adımındaki ve hesaptaki ileti izni kutusunun ayrı bir açık rıza metnine bağlanması.",
  "Saklama süreleri (7. madde) docs/kvkk-envanter.md'deki önerilerdir; KVKK danışmanı ve mali müşavirle kesinleştirin.",
  "VERBİS kayıt yükümlülüğünün mağazanız için doğup doğmadığı.",
  "İnternet sitesi trafik kayıtlarının 5651 sayılı Kanun kapsamında tutulma yükümlülüğü (yorum ve soru-cevap gibi kullanıcı içerikleri nedeniyle yer sağlayıcılık).",
  "Kapıda ödeme ve havale iadeleri için alınan banka hesap bilgisi (IBAN) platformda bir alanda tutulmuyor; personelin bu bilgiyi nasıl alacağı ve ne kadar saklayacağı.",
  'Vitrinde "kendi cümlenizle arayın" (yapay zekâ ile arama) özelliğini açacaksanız: arama cümlesinin Mağazanın kendi hesabıyla bağlandığı yurt dışındaki yapay zekâ servisine aktarımının dayanağı (Mağaza sözleşmenin tarafıdır); özelliği kullanmıyorsanız 6. maddedeki ilgili satırı silin.',
  "Yaş sınırlı ürünlerde yaş beyanının hukuki sebebi (sektörünüze özgü mevzuat).",
  "Ürün sayfasındaki YouTube videosu oynatıldığında Google'a (yurt dışı) aktarımın dayanağı: ziyaretçinin oynatma eylemiyle başlayan aktarımın md. 9/6 arızi aktarım hallerinden birine girip girmediği, yoksa açık rıza ya da standart sözleşme gerekip gerekmediği.",
])

const DATA: Block = table(
  ["Veri kategorisi", "İşlenen veriler"],
  [
    [
      "Kimlik",
      "Ad, soyad; fatura için verdiğiniz T.C. kimlik numarası veya vergi kimlik numarası ve vergi dairesi.",
    ],
    ["İletişim", "E-posta adresi, telefon numarası, teslimat ve fatura adresi."],
    [
      "Müşteri işlem",
      "Sepet ve sipariş bilgileri; iade, değişim ve iptal talepleri; favoriler ve stok bildirimi talepleri; ürün yorumları ve soruları; iletişim formu mesajları; ürün üzerine yazdırılmak üzere girdiğiniz metinler.",
    ],
    [
      "Finans",
      "Ödeme yöntemi, ödeme ve iade tutarları, ödeme işlem bilgileri (kartın yalnızca markası ve son dört hanesi), kapıda ödeme veya havale ile ödenmiş bir siparişin para iadesi için bildirdiğiniz banka hesap bilgisi. Kart numaranız, son kullanma tarihi ve güvenlik kodu Mağazaya iletilmez; doğrudan ödeme kuruluşunun güvenli ödeme sayfasında işlenir.",
    ],
    [
      "Pazarlama",
      "Ticari elektronik ileti izinleriniz ve İleti Yönetim Sistemi (İYS) kayıtları; çerez tercihiniz; ziyaretinizin geldiği kampanya bilgisi (kampanya etiketleri, yönlendiren sitenin adı); izin verdiyseniz ölçüm ve reklam çerezlerinin tanımlayıcıları.",
    ],
    [
      "İşlem güvenliği",
      "IP adresi (sözleşme onayınızın ve ileti izninizin kanıtı olarak şifrelenmiş veya özetlenmiş olarak saklanır); pazarlama çerezlerine izin verdiyseniz tarayıcı bilgisi; kötüye kullanımı ve dolandırıcılığı önlemek için tutulan, geri döndürülemez şekilde özetlenmiş e-posta, telefon ve IP kayıtları.",
    ],
    [
      "Hukuki işlem",
      "Mesafeli satış sözleşmesi ve ön bilgilendirme formu kopyaları, onay kayıtları, KVKK başvurularınız ve yanıtları, ödeme itirazı (ters ibraz) kayıtları.",
    ],
    [
      "Diğer",
      "Yaş sınırlı ürünlerde verdiğiniz yaş beyanı (doğum tarihiniz saklanmaz; yalnızca sınırı aştığınız beyanı tutulur); hediye kartı satın aldığınızda kartın gönderileceği kişinin adı, e-posta adresi ve hediye mesajı; sosyal hesapla giriş seçerseniz Google veya Apple'ın ilettiği ad ve e-posta adresi.",
    ],
  ]
)

const PURPOSES: Block = table(
  ["Amaç", "Hukuki sebep (KVKK)"],
  [
    ["Üyelik hesabının açılması ve yönetimi", "Sözleşmenin kurulması ve ifası (md. 5/2-c)"],
    [
      "Siparişin alınması, ödemenin alınması, ürünün teslimi, iade, değişim ve iptal işlemleri",
      "Sözleşmenin kurulması ve ifası (md. 5/2-c)",
    ],
    [
      "Hediye kartının alıcısına teslimi, kişiye özel ürünün hazırlanması",
      "Sözleşmenin ifası (md. 5/2-c)",
    ],
    [
      "Fatura düzenlenmesi; ticari defter, muhasebe ve vergi kayıtlarının tutulması",
      "Kanunlarda öngörülme ve hukuki yükümlülük (md. 5/2-a, ç)",
    ],
    [
      "Sözleşme, ön bilgilendirme ve onay kayıtlarının saklanması; tüketici mevzuatından doğan yükümlülükler",
      "Hukuki yükümlülük (md. 5/2-ç)",
    ],
    [
      "Satış sonrası destek; şikâyet, talep ve iletişim formu mesajlarının yanıtlanması",
      "Sözleşmenin ifası ve meşru menfaat (md. 5/2-c, f)",
    ],
    [
      "Yaş sınırlı ürünlerin satışında yasal sınırların gözetilmesi",
      "Hukuki yükümlülük ve hakkın korunması (md. 5/2-ç, e)",
    ],
    [
      "Bilgi güvenliğinin sağlanması; dolandırıcılığın ve kötüye kullanımın önlenmesi",
      "Meşru menfaat (md. 5/2-f)",
    ],
    [
      "Hukuki uyuşmazlıklarda ve ödeme itirazlarında haklarımızın korunması",
      "Bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e)",
    ],
    [
      "Yetkili kurum ve kuruluşların bilgi taleplerinin karşılanması",
      "Hukuki yükümlülük (md. 5/2-ç)",
    ],
    [
      "Sitenin çalışması için zorunlu çerezler; ziyaretin geldiği kampanyanın ölçülmesi",
      "Sözleşmenin ifası ve meşru menfaat (md. 5/2-c, f)",
    ],
    [
      "Kampanya, indirim ve duyuruların e-posta ve SMS ile gönderilmesi",
      "Açık rıza (md. 5/1) ve 6563 sayılı Kanun md. 6 uyarınca ticari elektronik ileti onayı",
    ],
    [
      "Sitenin kullanımının ölçülmesi (analitik çerezler); reklamların ölçülmesi ve kişiselleştirilmesi (pazarlama çerezleri)",
      "Açık rıza (md. 5/1)",
    ],
  ]
)

const RETENTION: Block = table(
  ["Kayıt", "Saklama süresi"],
  [
    [
      "Sipariş, fatura ve muhasebe kayıtları",
      "10 yıl (6102 sayılı Türk Ticaret Kanunu md. 82; 213 sayılı Vergi Usul Kanunu md. 253)",
    ],
    [
      "Mesafeli satış sözleşmesi, ön bilgilendirme formu ve onay kayıtları (IP adresi dahil)",
      "3 yıl (Mesafeli Sözleşmeler Yönetmeliği md. 20)",
    ],
    ["Üyelik bilgileri, kayıtlı adresler, favoriler", "Üyeliğiniz devam ettiği sürece"],
    [
      "Ticari elektronik ileti izinleri ve İYS kayıtları",
      "İzin geçerli olduğu sürece ve sona ermesinden itibaren 3 yıl (Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik md. 13)",
    ],
    ["Gönderilen e-posta ve SMS kayıtları (alıcı adresi)", "3 yıl"],
    ["Siparişe dönüşmeyen sepetler", "Son değişiklikten itibaren 90 gün"],
    ["Çerez tercihiniz", "2 yıl (tercihinizi hatırlayan çerez 13 ay)"],
    ["İletişim formu mesajları", "Gelişinden itibaren 1 yıl"],
    ["Stok bildirimi talepleri", "Bildirimin gönderilmesinden veya iptalinden itibaren 180 gün"],
    [
      "Ürün yorumları ve soruları",
      'Yayında kaldığı sürece; üyeliğiniz silinirse yazar adı "Anonim" olarak değiştirilir',
    ],
    [
      "Dolandırıcılık önleme kayıtları",
      "Kaydın geçerlilik süresince; IP adresi özetleri en çok 1 yıl",
    ],
    [
      "Ölçüm ve reklam tanımlayıcıları",
      "Meta'ya iletilen IP adresi, tarayıcı bilgisi ve çerez tanımlayıcıları gönderimden sonra, en geç 3 gün içinde silinir. Google Analytics istemci kimliği, kaydından itibaren cayma süresi ({iade_süresi} gün) ve 45 gün sonra silinir.",
    ],
    ["Toplu ileti gönderim kayıtları", "Kampanyanın bitiminden itibaren 90 gün"],
  ]
)

const RIGHTS: Block = bullets([
  "Kişisel verilerinizin işlenip işlenmediğini öğrenme,",
  "İşlenmişse buna ilişkin bilgi talep etme,",
  "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
  "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,",
  "Eksik veya yanlış işlenmişse düzeltilmesini isteme,",
  "KVKK md. 7'deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,",
  "Düzeltme, silme ve yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
  "İşlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,",
  "Kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme.",
])

export const privacyNotice: { title: string; content: Block[] } = {
  title: "Kişisel Verilerin Korunması Aydınlatma Metni",
  content: [
    NOTE,
    p(
      '{mağaza_unvanı} ("Mağaza") olarak {alan_adı} internet sitemizi ziyaret eden, üye olan, alışveriş yapan ve bizimle iletişime geçen kişilerin kişisel verilerini 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve ilgili mevzuata uygun olarak işliyoruz. Bu metin, KVKK md. 10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca sizi bilgilendirmek için hazırlanmıştır.'
    ),
    p(
      "Bu metin bir onay veya açık rıza metni değildir. Açık rızanıza dayanan işlemler (ticari elektronik iletiler, analitik ve pazarlama çerezleri) için izniniz ayrıca ve ayrı bir beyanla istenir; izin vermemeniz alışveriş yapmanıza engel değildir."
    ),
    h2("1. Veri Sorumlusu"),
    bullets([
      "Unvan: {mağaza_unvanı}",
      "Adres: {adres}",
      "MERSİS numarası: {mersis}",
      "KEP adresi: {kep}",
      "E-posta: {e_posta}",
      "Telefon: {telefon}",
    ]),
    h2("2. İşlenen Kişisel Veriler"),
    DATA,
    p(
      "Özel nitelikli kişisel veri (sağlık, biyometrik veri, din, dernek üyeliği gibi) işlemeyiz. Sipariş notu, yorum veya mesaj alanlarına bu tür bilgileri yazmamanızı rica ederiz."
    ),
    h2("3. İşleme Amaçları ve Hukuki Sebepler"),
    PURPOSES,
    h2("4. Toplama Yöntemi"),
    p(
      "Kişisel verileriniz; internet sitemizdeki üyelik, sipariş, ödeme, iletişim ve talep formları, hesabınız, çerezler ve benzeri teknolojiler aracılığıyla otomatik veya kısmen otomatik yollarla elektronik ortamda toplanır. Ödeme ve teslimat sonuçları ödeme kuruluşundan ve kargo firmasından; sosyal hesapla giriş seçtiğinizde ad ve e-posta adresiniz ilgili sağlayıcıdan; hediye kartı alıcısının bilgileri kartı satın alan kişiden alınır."
    ),
    h2("5. Kişisel Verilerin Aktarılması"),
    p(
      "Kişisel verileriniz, yukarıdaki amaçlarla ve bu amaçların gerektirdiği ölçüde, KVKK md. 8 ve 9'daki şartlara uygun olarak aşağıdaki alıcılara aktarılabilir:"
    ),
    bullets([
      "Kargo ve lojistik firmaları: ad, soyad, teslimat adresi ve telefon; kapıda ödemede tahsil edilecek tutar (teslimat).",
      "Ödeme kuruluşları ve bankalar: sipariş tutarı, ad, e-posta, telefon, adres ve fatura bilgileri (ödemenin alınması, iadesi ve dolandırıcılığın önlenmesi).",
      "E-fatura ve e-arşiv hizmet sağlayıcısı ile Gelir İdaresi Başkanlığı: fatura bilgileri (yasal yükümlülük).",
      "E-posta ve SMS gönderim hizmeti sağlayıcıları ile İleti Yönetim Sistemi: iletişim bilgileri ve ileti izinleri.",
      "Mali müşavir, muhasebe ve hukuk danışmanları: görevlerinin gerektirdiği bilgiler.",
      "Mağaza yazılımının, barındırma, altyapı ve siber güvenlik hizmetlerinin sağlayıcıları: Mağazanın talimatıyla ve hizmetin gerektirdiği ölçüde, veri işleyen sıfatıyla.",
      "İzin verdiyseniz Google (Google Analytics) ve Meta (reklam ölçümü): çerez tanımlayıcıları, görüntülenen sayfalar ve satın alma bilgileri. Meta'ya iletilen satın alma bildiriminde e-posta adresiniz ve telefon numaranız geri döndürülemez şekilde özetlenerek (SHA-256) gönderilir.",
      "Yetkili kamu kurum ve kuruluşları ile yargı mercileri: kanunen yetkili oldukları hallerde talep ettikleri bilgiler.",
    ]),
    h2("6. Yurt Dışına Aktarım"),
    p(
      "Veritabanımız, dosya depolama alanlarımız ve yedeklerimiz Türkiye'dedir. Ancak aşağıdaki hizmetler yurt dışında bulunan sağlayıcılarca sunulduğundan ilgili veriler, hizmetin gerektirdiği ölçüde yurt dışına aktarılabilir:"
    ),
    bullets([
      "İnternet sitesinin trafiğini ileten içerik dağıtım ve siber güvenlik hizmeti: IP adresi, tarayıcı bilgisi ve sayfa istekleri.",
      "E-posta gönderim hizmeti: e-posta adresiniz ve size gönderilen iletinin içeriği.",
      "İzin verdiyseniz ölçüm ve reklam hizmetleri (Google, Meta): 5. maddede sayılan bilgiler.",
      "Sosyal hesapla giriş seçtiyseniz Google veya Apple: girişin doğrulanması için gerekli bilgiler.",
      'Mağazamız "kendi cümlenizle arayın" özelliğini açtıysa ve bu özelliği kullanırsanız yapay zekâ hizmet sağlayıcısı: arama kutusuna yazdığınız cümle (e-posta, telefon, IBAN, kart ve T.C. kimlik numarası gibi bilgiler gönderilmeden önce ayıklanır; ad ve adres ayıklanamaz, bu nedenle arama kutusuna kişisel bilgi yazmayınız). Cümle Mağazada saklanmaz; yalnızca aramanızı süzgeçlere çevirmek için kullanılır.',
      "Bir ürün sayfasındaki YouTube videosunu oynattığınızda YouTube (Google): IP adresiniz, tarayıcı bilgileriniz ve YouTube'un kendi çerez ve yerel depolama tanımlayıcıları. Video oynatılmadan önce YouTube'a hiçbir bilgi gönderilmez; aktarım, videoyu oynatma eyleminizle ve yalnızca oynatıcının çalışması için gereken ölçüde gerçekleşir.",
    ]),
    p(
      "Bu aktarımlar KVKK md. 9'a uygun olarak; yeterlilik kararı bulunan hallerde bu karara, bulunmayan hallerde Kişisel Verileri Koruma Kurulunca ilan edilen standart sözleşme gibi uygun güvencelerden birine ya da md. 9/6'da sayılan arızi aktarım hallerine dayanılarak yapılır."
    ),
    h2("7. Saklama Süreleri"),
    RETENTION,
    p(
      "Süre dolduğunda veya işleme şartları ortadan kalktığında verileriniz silinir, yok edilir veya anonim hale getirilir (KVKK md. 7). Kanunen saklanması gereken kayıtlar, silme talebinizde de yasal süre sonuna kadar saklanır ve yalnızca bu amaçla kullanılır."
    ),
    h2("8. Haklarınız"),
    p("KVKK md. 11 uyarınca Mağazaya başvurarak:"),
    RIGHTS,
    h2("9. Başvuru Yolu"),
    p(
      "Haklarınıza ilişkin taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca aşağıdaki yollardan biriyle iletebilirsiniz:"
    ),
    bullets([
      'Üyeyseniz hesabınızdaki "Kişisel verilerim (KVKK)" bölümünden,',
      'İletişim sayfamızdaki formda "KVKK başvurusu" konusunu seçerek,',
      "Sistemimizde kayıtlı e-posta adresinizden {e_posta} adresine e-postayla,",
      "Kayıtlı elektronik posta (KEP) adresinizden, güvenli elektronik imza veya mobil imzayla {kep} adresine,",
      "Islak imzalı dilekçeyle {adres} adresine elden veya posta yoluyla.",
    ]),
    p(
      "Başvurunuzda adınız, soyadınız, yazılı başvurularda imzanız, T.C. kimlik numaranız (yabancıysanız uyruğunuz ve pasaport veya kimlik numaranız), tebligata esas yerleşim yeri veya iş yeri adresiniz, varsa bildirime esas e-posta adresiniz ve telefon numaranız ile talep konunuz bulunmalıdır. Kimliğinizi doğrulamak için ek bilgi isteyebiliriz."
    ),
    p(
      "Talebiniz niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz olarak sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi halinde Kişisel Verileri Koruma Kurulunca belirlenen tarifedeki ücret alınabilir (KVKK md. 13)."
    ),
    p(
      "Başvurunuz reddedilir, verilen cevabı yetersiz bulursanız veya süresinde cevap verilmezse; cevabı öğrendiğiniz tarihten itibaren 30 gün ve her halde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kuruluna şikâyette bulunabilirsiniz (KVKK md. 14)."
    ),
    h2("10. Veri Güvenliği"),
    p(
      "Kişisel verilerinizi korumak için KVKK md. 12 uyarınca gerekli teknik ve idari tedbirleri alırız: siteyle bağlantınız şifrelidir; T.C. kimlik numarası, sözleşme kopyaları ve IP adresi gibi veriler veritabanında şifreli saklanır; verilere erişim yetkili personelle sınırlıdır ve kayıt altına alınır. Verilerinizin hukuka aykırı olarak başkalarınca elde edilmesi halinde bu durum en kısa sürede size ve Kişisel Verileri Koruma Kuruluna bildirilir."
    ),
    h2("11. Değişiklikler"),
    p(
      "Bu metin, mevzuat veya veri işleme faaliyetlerimiz değiştiğinde güncellenir; güncel metin her zaman bu sayfada yayımlanır."
    ),
  ],
}
