import type { Block } from "../../content"
import { bullets, draftNote, h2, linked, p, table } from "./blocks"

/**
 * Çerez Politikası: the cookies the storefront itself sets (apps/storefront
 * `lib/cart/cookie.ts`, `lib/account/session.ts`, `lib/legal/cookies.ts`,
 * `lib/checkout/payment-cookie.ts`, `lib/cart/landing.ts`,
 * `lib/maintenance/rules.ts`) and the tags it loads with consent
 * (`lib/analytics`), against the KVKK Kurumu's Çerez Uygulamaları
 * Hakkında Rehber (2022). A cookie added to the storefront is added here.
 */
const NOTE = draftNote([
  "Kampanya kaynağı çerezi (__Host-qt_landing): onay beklenmeden yazılıyor; kişiyi tanımlayan bilgi tutmuyor ve oturum kapanınca siliniyor. Rehberdeki birinci taraf ölçüm istisnasına girip girmediği, yoksa analitik onayına bağlanması gerekip gerekmediği.",
  "Google Analytics ve Meta'ya yurt dışı aktarımın dayanağı (KVKK Aydınlatma Metnindeki notla aynı).",
  'Çerez bandında "Tümünü kabul et" ve "Yalnızca zorunlu" düğmeleri yan yana ve aynı boyutta, ancak "Tümünü kabul et" dolgulu (daha belirgin) çiziliyor; Rehber ve Kurulun 2026/347 sayılı İlke Kararı karşısında yeterliliği.',
  "Google ve Meta çerezlerinin süreleri sağlayıcıların kendi belgelerinden alındı (Google Analytics 2 yıl; Meta 90 gün); sağlayıcı değiştirirse tablo güncellenmeli.",
  "Ürün sayfasındaki YouTube videoları: oynatıcı yalnızca ziyaretçi videoyu oynattığında yüklenir (öncesinde YouTube'a istek gitmez) ve kapakta bunu söyleyen bir satır vardır. Bu tıklamanın yeterli sayılıp sayılmadığı, yoksa pazarlama çerezlerine onay verilmeden YouTube'un hiç oynatılmaması gerekip gerekmediği; YouTube'un oynatınca yazdığı çerezlerin ve yerel depolama kayıtlarının adları ve süreleri Google'ın belgelerinden doğrulanmadı.",
])

const COOKIES: Block = table(
  ["Çerez", "Kategori", "Amaç", "Sağlayıcı", "Süre"],
  [
    ["__Host-qt_cart", "Zorunlu", "Sepetinizi hatırlar.", "{alan_adı} (birinci taraf)", "30 gün"],
    [
      "__Host-qt_session",
      "Zorunlu",
      "Hesabınıza girişinizi sürdürür.",
      "{alan_adı} (birinci taraf)",
      "1 gün",
    ],
    [
      "__Host-qt_verify",
      "Zorunlu",
      "E-posta doğrulaması süren yeni hesabı tanır.",
      "{alan_adı} (birinci taraf)",
      "15 dakika",
    ],
    [
      "__Host-qt_invite",
      "Zorunlu",
      "Davet bağlantısıyla başlayan üyelik kaydını tamamlar.",
      "{alan_adı} (birinci taraf)",
      "1 gün",
    ],
    [
      "__Host-qt_pay",
      "Zorunlu",
      "Kartla ödeme sayfasının yalnızca sizin sepetiniz için açılmasını sağlar.",
      "{alan_adı} (birinci taraf)",
      "30 dakika",
    ],
    [
      "__Host-qt_vid",
      "Zorunlu",
      "Çerez tercihinizi hatırlamak için rastgele üretilen ziyaretçi kimliğini tutar.",
      "{alan_adı} (birinci taraf)",
      "13 ay",
    ],
    [
      "__Host-qt_landing",
      "Zorunlu",
      "Ziyaretinizin geldiği kampanyayı (kampanya etiketleri, yönlendiren sitenin adı, reklam tıklaması olup olmadığı) siparişinizle ilişkilendirir; sizi tanımlayan bilgi tutmaz.",
      "{alan_adı} (birinci taraf)",
      "Tarayıcı oturumu",
    ],
    [
      "__Host-qt_bypass",
      "Zorunlu",
      "Yalnızca mağaza yetkililerine: bakım sırasında sitenin önizlenmesini sağlar.",
      "{alan_adı} (birinci taraf)",
      "7 gün",
    ],
    [
      "_ga",
      "Analitik",
      "Ziyaretçileri birbirinden ayırt ederek sitenin kullanımını ölçer.",
      "Google Analytics",
      "2 yıl",
    ],
    [
      "_ga_<ölçüm kimliği>",
      "Analitik",
      "Ziyaret oturumunun durumunu tutar.",
      "Google Analytics",
      "2 yıl",
    ],
    [
      "_fbp",
      "Pazarlama",
      "Tarayıcınızı tanıyarak reklamların sonuçlarını ölçer.",
      "Meta",
      "90 gün",
    ],
    [
      "_fbc",
      "Pazarlama",
      "Siteye bir Meta reklamına tıklayarak geldiyseniz tıklamanın kimliğini tutar.",
      "Meta",
      "90 gün",
    ],
  ]
)

export const cookiePolicy: { title: string; content: Block[] } = {
  title: "Çerez Politikası",
  content: [
    NOTE,
    p(
      "Bu politika, {mağaza_unvanı} olarak {alan_adı} internet sitemizde kullandığımız çerezleri ve benzeri teknolojileri, bunların hangi amaçla kullanıldığını ve tercihlerinizi nasıl yönetebileceğinizi açıklar. Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve Kişisel Verileri Koruma Kurumunun Çerez Uygulamaları Hakkında Rehberi esas alınarak hazırlanmıştır. Çerezlerle işlenen kişisel verilere ilişkin ayrıntılar KVKK Aydınlatma Metnimizde yer alır."
    ),
    h2("1. Çerez Nedir?"),
    p(
      "Çerezler, ziyaret ettiğiniz internet sitesinin tarayıcınıza kaydettiği küçük metin dosyalarıdır. Tarayıcı kapanınca silinenlere oturum çerezi, belirli bir süre saklananlara kalıcı çerez denir. Ziyaret ettiğiniz sitenin kendi koyduğu çerezler birinci taraf, başka bir hizmet sağlayıcısının koyduğu çerezler üçüncü taraf çerezlerdir."
    ),
    h2("2. Çerez Kategorileri ve Hukuki Sebepleri"),
    bullets([
      "Zorunlu çerezler: Sitenin çalışması ve talep ettiğiniz hizmetin sunulması için gereklidir (sepet, oturum, ödeme güvenliği, çerez tercihinizin hatırlanması). Açık rızanız aranmaz; KVKK md. 5/2-c ve f uyarınca kullanılır. Kapatılamazlar; tarayıcınızdan engellerseniz sitenin bazı bölümleri çalışmaz.",
      "İşlevsel çerezler: Sitemiz, zorunlu olanlar dışında tercihlerinizi hatırlamak için ayrı bir çerez kullanmaz.",
      "Analitik çerezler: Sitenin nasıl kullanıldığını ölçmemize yardım eder (Google Analytics). Yalnızca açık rızanızla kullanılır (KVKK md. 5/1).",
      "Pazarlama çerezleri: Reklamların sonuçlarını ölçmek ve size uygun reklamlar göstermek için kullanılır (Meta). Bu kategoriye izin verdiyseniz Google Analytics verileri Google'ın reklam ölçümü ve reklam kişiselleştirme özelliklerinde de kullanılabilir. Yalnızca açık rızanızla kullanılır (KVKK md. 5/1).",
    ]),
    h2("3. Kullandığımız Çerezler"),
    COOKIES,
    p(
      "Analitik ve pazarlama çerezleri, yalnızca Mağaza ilgili hizmeti siteye bağlamışsa ve siz izin verdiyseniz yüklenir. Bu çerezler Google ve Meta'nın betikleri tarafından sitemizin alan adına yazılır; Google ve Meta ayrıca kendi alan adlarında kendi çerezlerini kullanabilir. Bu çerezler ilgili şirketlerin gizlilik politikalarına tabidir."
    ),
    p(
      "Üçüncü taraf: YouTube (Google), yalnız videoyu oynattığınızda. Ürün sayfalarındaki YouTube videoları, siz oynat düğmesine basana kadar yalnızca kendi sunucumuzdaki bir kapak görseli olarak gösterilir; bu sırada YouTube'a hiçbir istek gönderilmez ve çerez yazılmaz. Videoyu oynattığınızda oynatıcı YouTube'un gelişmiş gizlilik modundaki adresinden (youtube-nocookie.com) yüklenir; YouTube bu andan itibaren IP adresinizi işleyebilir, tarayıcınıza kendi çerezlerini ve yerel depolama kayıtlarını yazabilir. Bu işlemler Google'ın gizlilik politikasına tabidir."
    ),
    p(
      "Analitik veya pazarlama çerezlerine izin verdiyseniz, bir satın almanın yalnızca bir kez sayılması için tarayıcınızın oturum deposuna (sessionStorage) siparişe ait bir işaret yazılır; sekme kapanınca silinir."
    ),
    h2("4. Onayınızı Nasıl Alıyoruz?"),
    p(
      'Siteyi ilk ziyaretinizde açılan çerez bandında "Tümünü kabul et" ve "Yalnızca zorunlu" düğmeleri yan yana sunulur; "Tercihleri seç" ile kategorileri tek tek seçebilirsiniz. Kategoriler önceden işaretlenmez; siteyi gezmeye devam etmeniz onay sayılmaz. Seçim yapmadığınız sürece analitik ve pazarlama çerezleri yüklenmez ve bu hizmetlere hiçbir veri gönderilmez.'
    ),
    p(
      "Verdiğiniz yanıt, yanıtın verildiği politika sürümü ve zamanıyla birlikte kaydedilir. Bu politikayı güncellediğimizde tercihiniz yeniden sorulur; yeni yanıtınızı verene kadar analitik ve pazarlama çerezleri kullanılmaz."
    ),
    h2("5. Tercihlerinizi Değiştirme ve Onayınızı Geri Alma"),
    linked(
      'Tercihinizi istediğiniz zaman sayfanın altındaki "Çerez tercihleri" bağlantısından ya da ',
      "Çerez tercihleri",
      "/cerez-tercihleri",
      " sayfasından değiştirebilirsiniz. Onayınızı geri aldığınızda ilgili hizmetler durdurulur ve sitemizin alan adındaki _ga, _ga_<ölçüm kimliği>, _fbp ve _fbc çerezleri silinir. Geri alma, o ana kadar yapılan işlemlerin hukuka uygunluğunu etkilemez."
    ),
    p(
      "Tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz; zorunlu çerezleri engellemeniz halinde sepet, giriş ve ödeme gibi işlevler çalışmayabilir."
    ),
    h2("6. Saklama Süresi"),
    p(
      "Çerez tercihiniz 2 yıl süreyle kayıtlı tutulur. Tercihinizi hatırlayan çerez 13 ay sonra silinir ve tercihiniz yeniden sorulur. Diğer çerezlerin süreleri yukarıdaki tabloda yer alır."
    ),
    h2("7. Haklarınız"),
    p(
      "Çerezlerle işlenen kişisel verilerinize ilişkin KVKK md. 11'deki haklarınızı, KVKK Aydınlatma Metnimizde açıklanan yollarla veya {e_posta} adresine yazarak kullanabilirsiniz."
    ),
    h2("8. Değişiklikler"),
    p(
      "Bu politikayı sitede kullanılan çerezler veya mevzuat değiştiğinde güncelleriz. Güncel politika bu sayfada yayımlanır ve yayımlandığında çerez tercihiniz yeniden sorulur."
    ),
  ],
}
