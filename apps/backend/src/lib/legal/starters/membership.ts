import type { Block } from "../../content"
import { bullets, draftNote, h2, p } from "./blocks"
import { disputeRoutes } from "./shared"

/**
 * Üyelik Sözleşmesi: the account's terms (adr/0037). Each order is still
 * its own distance sales contract; this text never narrows a consumer's
 * rights (Kanun md. 5, unfair terms).
 */
const NOTE = draftNote([
  "Üyelik için 18 yaş ve tam ehliyet şartı (2.2) bir mağaza tercihidir; satışlarınızda yaş sınırı varsa bununla uyumu.",
  "Mağazanın üyeliği askıya alma ve sona erdirme koşulları ile önceden bildirim süresi (9.3); 6502 sayılı Kanun md. 5 (haksız şartlar) karşısında yeterliliği.",
  "Üyelerin yorum ve sorularına verilen kullanım izninin kapsamı (6.3; 5846 sayılı Fikir ve Sanat Eserleri Kanunu).",
  "Sözleşme değişikliklerinin üyelere bildirilme ve kabul ettirilme yöntemi (10).",
  "Sosyal hesapla girişte (Google, Apple) üçüncü taraf koşullarına yapılacak atıf.",
])

export const membership: { title: string; content: Block[] } = {
  title: "Üyelik Sözleşmesi",
  content: [
    NOTE,
    h2("1. Taraflar ve Konu"),
    p(
      '1.1. Bu sözleşme; {mağaza_unvanı} ("Mağaza") ile {alan_adı} internet sitesinde üyelik hesabı oluşturan kişi ("Üye") arasında, üyelik hizmetinin koşullarını düzenlemek amacıyla kurulur.'
    ),
    bullets([
      "Mağaza unvanı: {mağaza_unvanı}",
      "Adres: {adres}",
      "MERSİS numarası: {mersis}",
      "KEP adresi: {kep}",
      "E-posta: {e_posta}",
      "Telefon: {telefon}",
    ]),
    p(
      "1.2. Üyelik ücretsizdir. Üyenin verdiği her sipariş, ayrıca kurulan Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu hükümlerine tabidir. Bu sözleşmenin hiçbir hükmü, Üyenin 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuattan doğan haklarını sınırlamaz."
    ),
    h2("2. Üyeliğin Kurulması"),
    p(
      "2.1. Üyelik, kayıt formunun doldurulması, bu sözleşmenin elektronik ortamda onaylanması ve e-posta adresinin doğrulanmasıyla kurulur. Üye, Google veya Apple hesabıyla da üye olabilir; bu durumda bu sözleşme aynı şekilde uygulanır."
    ),
    p(
      "2.2. Üye olabilmek için 18 yaşını doldurmuş ve fiil ehliyetine sahip olmak gerekir. Üyelik kişiye özeldir; başkasına devredilemez ve başkasına kullandırılamaz."
    ),
    h2("3. Üyenin Yükümlülükleri"),
    p("3.1. Üye:"),
    bullets([
      "Kayıt ve siparişlerde verdiği bilgilerin doğru, eksiksiz ve güncel olmasını sağlar;",
      "Şifresini gizli tutar, başkalarıyla paylaşmaz ve hesabının yetkisiz kullanıldığını fark ederse Mağazaya derhal bildirir;",
      "Siteyi hukuka, bu sözleşmeye ve dürüstlük kurallarına uygun kullanır;",
      "Başkasına ait ödeme araçlarını izinsiz kullanmaz, gerçeğe aykırı sipariş, yorum veya talep oluşturmaz;",
      "Sitenin işleyişini bozacak, güvenliğini tehlikeye atacak veya aşırı yük getirecek otomatik yazılım, veri toplama veya saldırı girişimlerinde bulunmaz;",
      "Yorum, soru ve mesajlarında hukuka aykırı, hakaret içeren, başkalarının kişilik veya fikri haklarını ihlal eden, kişisel veri veya reklam içeren içerik paylaşmaz.",
    ]),
    p(
      "3.2. Üyenin şifresinin kendi kusuruyla başkalarınca öğrenilmesinden doğan zarardan Mağaza sorumlu değildir; Mağazanın kendi kusurundan doğan sorumluluğu saklıdır."
    ),
    h2("4. Hesap Güvenliği"),
    p(
      "4.1. Mağaza, hesapları korumak için gerekli teknik tedbirleri alır: şifreler geri döndürülemez şekilde saklanır, yeni hesaplarda e-posta doğrulaması istenir ve giriş oturumu belirli bir süre sonra kendiliğinden kapanır."
    ),
    p(
      "4.2. Şüpheli işlem görülmesi halinde Mağaza, hesabı korumak için ek doğrulama isteyebilir veya ilgili işlemi geçici olarak durdurabilir; bu durumda Üyeyi gecikmeksizin bilgilendirir."
    ),
    h2("5. Üyelik Hizmetleri"),
    p(
      "5.1. Üye; sipariş geçmişini ve sözleşme kopyalarını görüntüleyebilir, adreslerini ve fatura bilgilerini kaydedebilir, favori listesi oluşturabilir, stok bildirimi isteyebilir, iade ve değişim talebinde bulunabilir, ileti izinlerini yönetebilir ve kişisel verilerine ilişkin başvurularını hesabından yapabilir."
    ),
    p(
      "5.2. Ürün yorumu yalnızca ürünü satın alıp teslim almış ve e-posta adresini doğrulamış Üyeler tarafından yazılabilir. Yorum ve sorular yayımlanmadan önce Mağazaca incelenir ve yazarın adı ve soyadının baş harfiyle gösterilir. Mağaza, 3.1 maddesine aykırı içerikleri yayımlamayabilir veya kaldırabilir; yorumları, olumlu veya olumsuz olmasına göre ayırt etmeden değerlendirir."
    ),
    h2("6. Fikri Haklar"),
    p(
      "6.1. Sitedeki marka, logo, tasarım, ürün görselleri ve metinler Mağazaya veya lisans verenlerine aittir ve 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunur. Bunlar Mağazanın yazılı izni olmadan kopyalanamaz, çoğaltılamaz ve ticari amaçla kullanılamaz."
    ),
    p("6.2. Üyenin yazdığı yorum ve soruların hakları Üyede kalır."),
    p(
      "6.3. Üye, yayımlanmak üzere gönderdiği yorum ve soruların, yayında kaldığı sürece sitede ve ürün sayfalarının arama motorlarına sunulan bilgilerinde ücretsiz olarak gösterilmesine izin verir. Üye, içeriğinin kaldırılmasını her zaman isteyebilir."
    ),
    h2("7. Ticari Elektronik İletiler"),
    p(
      "7.1. Kampanya ve duyuru içeren ticari elektronik iletiler yalnızca Üyenin ayrıca vereceği onayla gönderilir (6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun md. 6). Üye onayını hesabından veya iletilerdeki bağlantıdan istediği zaman ücretsiz olarak geri alabilir; ret talebinden sonra ileti gönderimi en geç 3 iş günü içinde durdurulur (md. 8)."
    ),
    p(
      "7.2. Üyelik, sipariş, teslimat, iade ve hesap güvenliğine ilişkin bilgilendirme iletileri ticari elektronik ileti değildir ve ayrıca onay gerektirmez."
    ),
    h2("8. Kişisel Veriler"),
    p(
      "8.1. Üyenin kişisel verileri, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında Mağazanın KVKK Aydınlatma Metninde açıklandığı şekilde işlenir. Sitede kullanılan çerezler Çerez Politikasında açıklanır."
    ),
    h2("9. Süre ve Sona Erme"),
    p("9.1. Bu sözleşme belirsiz süreli olarak kurulur."),
    p(
      '9.2. Üye, üyeliğini istediği zaman sona erdirebilir. Bunun için hesabındaki "Kişisel verilerim (KVKK)" bölümünden hesabının silinmesini isteyebilir ya da {e_posta} adresine yazabilir. Açık bir siparişi veya iade talebi varsa silme bunlar sonuçlandıktan sonra yapılır. Kanunen saklanması gereken sipariş, fatura ve sözleşme kayıtları yasal süre boyunca saklanır.'
    ),
    p(
      "9.3. Üyenin 3. maddedeki yükümlülüklerine aykırı davranması halinde Mağaza, aykırılığın giderilmesini Üyeden yazılı olarak ister; aykırılık sürer veya ağır nitelikteyse üyeliği sona erdirebilir. Sona erme, verilmiş siparişlerden doğan hak ve yükümlülükleri etkilemez."
    ),
    h2("10. Değişiklikler"),
    p(
      "10.1. Mağaza bu sözleşmeyi mevzuat veya hizmetlerindeki değişiklikler nedeniyle güncelleyebilir. Değişiklikler yürürlüğe girmeden önce Üyeye e-postayla veya hesabına girişte bildirilir. Değişikliği kabul etmeyen Üye üyeliğini sona erdirebilir. Değişiklikler, önceden verilmiş siparişlere uygulanmaz."
    ),
    h2("11. Bildirimler"),
    p(
      "11.1. Taraflar arasındaki bildirimler, Mağazanın yukarıdaki iletişim bilgileri ve Üyenin hesabında kayıtlı e-posta adresi üzerinden yapılır. Üye, e-posta adresini güncel tutmakla yükümlüdür."
    ),
    h2("12. Uyuşmazlıklar"),
    ...disputeRoutes("12", "Üye", "Mağaza"),
    h2("13. Yürürlük"),
    p(
      "13.1. Bu sözleşme, Üyenin kayıt sırasında sözleşmeyi elektronik ortamda onaylamasıyla yürürlüğe girer. Sözleşmenin güncel metni bu sayfada her zaman görüntülenebilir."
    ),
  ],
}
