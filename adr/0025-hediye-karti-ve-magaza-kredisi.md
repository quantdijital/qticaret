# ADR-0025: Hediye kartı ve mağaza kredisi

- **Durum:** Kabul edildi (2026-10-26, kullanıcı önerilen seçenekle onayladı; vergi yönü mali müşavir teyidine bağlı, docs/12)
- **Tarih:** 2026-10-26

## Bağlam

F4.8: hediye kartı / mağaza kredisi çekirdekte ya da resmi eklentide varsa kullanılır, yoksa özel modül yazılır.

Medusa 2.21.2'de doğrulananlar (F4 planlaması):

- Çekirdekte hediye kartı ya da mağaza kredisi modülü yok.
- Resmi eklenti `@medusajs/loyalty-plugin`: 2.21.2 sürümü npm'de, MIT lisanslı. Peer bağımlılıkları Medusa 2.21.2'ye birebir sabit; en yenisi 2.22.1. İçinde `loyalty` (hediye kartı) ve `store-credit` modülleri var. Medusa Cloud şartı yok.

## Karar

- **Resmi eklenti kullanılır:** `@medusajs/loyalty-plugin@2.21.2` (exact; Medusa yükseltmesiyle birlikte yükseltilir). Kendi modülümüz yazılmaz.
- **Bayrakla açılır:** `promotions.gift_cards` (varsayılan kapalı). Kapalıyken eklentinin Store/Admin uçları 404 (`requireFeature` deseni).
- **Kapsam (F4):** panelden hediye kartı oluşturma ve bakiye görme, checkout'ta kullanma, iadede mağaza kredisine dönüş. Hediye kartının **satışı** (müşterinin ürün gibi satın alması) ve e-postayla gönderimi F9 bildirimleriyle.
- **Tutar:** eklentinin tutarları `lib/money` sınırından geçer; kısmi kullanım ve iade dağıtımı F4.7'nin dağıtım fonksiyonunu kullanır.
- **Güvenlik:** kart kodu en az 16 karakter, rastgele; kod denemesi `coupon` hız profiliyle sınırlanır; bakiye sorgusu kimlik başına sayılır.

## Alternatifler

| Seçenek                     | Artı                                                     | Eksi                                                              |
| --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Resmi eklenti (seçilen)** | Medusa'nın sepet ve ödeme akışına bağlı; bakım Medusa'da | Sürüm kilidi (2.21.2); eklentinin davranışına bağımlılık          |
| Kendi modülümüz             | Tam denetim, TR'ye özel kurallar                         | Sepet, ödeme ve iade entegrasyonu baştan; yüksek bakım            |
| F4 dışına ertelemek         | F4 kısalır                                               | KK dışı ama yol haritasında F4'te; ilk müşteride ihtiyaç belirsiz |

## Sonuçlar

- Hediye kartı satışının vergi ve e-fatura karşılığı (satışta mı, kullanımda mı KDV) mali müşavirle teyit edilir; teyide kadar yalnızca panelden verilen kart ve iade kredisi açılır (satış kapalı).
- Eklenti yeni bağımlılık: kurulum kendi oturumunda, exact sürüm ve ≥14 gün kuralıyla (2.21.2 bu şartı sağlıyor).
- Medusa 2.22 yükseltmesi eklentiyle birlikte yapılır.

## Uygulama notu (F4 U8, 2026-10-26)

- **Kurulum:** `@medusajs/loyalty-plugin@2.21.2` (exact), `medusa-config.ts` `plugins`. Eklentinin `loyalty` ve `store-credit` modüllerinin migration'ları Medusa'nınkilerle birlikte çalışıyor.
- **Bayrak:** `promotions.gift_cards` (varsayılan kapalı, tenant). Kapalıyken eklentinin altı ucu (`/admin/gift-cards`, `/admin/store-credit-accounts`, `/store/gift-cards`, `/store/store-credit-accounts`, `/store/carts/:id/gift-cards`, `/store/carts/:id/store-credits`) gövde doğrulanmadan ve eklentinin oturum kontrolünden önce 404 veriyor. Store `fields`'ta kartın hiçbir alanı istenemiyor (`src/api/http/gift-card-routes.ts`).
- **Ölçülen davranış (eklentinin 2.21.2 kaynağıyla doğrulandı):**
  - Sepete eklenen kart Medusa'nın kredi satırı olur, sipariş toplamından düşülür; ödeme kalan tutardır. Sepeti tamamen kapatan kartta ödeme oturumu gerekmez; sipariş "gönderilecek" aşamasına geçer.
  - Kart, sepet tamamlanırken (ödeme yetkilendirmesinden önce) borçlanır. Eklenti hesap satırını `FOR UPDATE` ile kilitleyip bakiyeyi yeniden denetliyor; yetmezse tamamlama başarısız. Aynı kartla ardışık ve eşzamanlı ödemelerde bakiye aşılmıyor (testli).
  - `POST /store/carts/:id/store-credits` isteğe bağlı `amount` alıyor; eklenti bunu bakiye ve sepet toplamıyla sınırlıyor, sıfır ve eksi tutarda satır açmıyor. Ama sepetin müşterisinin hesabını, kimin oturum açtığına bakmadan kullanıyor.
- **Kod:**
  - Eklentinin üreticisi 16 karakter için 10 rastgele bayt çekiyor ve 11. karakterden sonra baytları yeniden kullanıyor (yaklaşık 50 bit). Her karta bu yüzden kendi kodumuz yazılıyor: önek + `XXXX-XXXX-XXXX-XXXX`, her karakter ayrı çekiliyor (80 bit; `src/lib/promotions/gift-card-code.ts`).
  - Önek `GIFT`; mağazanın yazdığı kelime (en çok 20 harf, rakam ya da tire) yalnızca öneki değiştiriyor, rastgele kısım her zaman ekleniyor (`gift_cards.code_prefix`).
  - Kodlar promosyon kodları gibi büyük harf ve ASCII saklanıyor. Sepete eklenen ve sepetten çıkarılan kod aynı biçime çevriliyor (`src/api/validation/gift-card-codes.ts`). Kodla sorguda kod yol parametresi olduğu için çevrilmiyor: storefront büyük harfle gönderir (F18).
- **Deneme sınırı:** `coupon` profili, promosyon kodlarıyla ortak bütçe.
  - Sepete kod ekleme ve çıkarma: IP ve sepet başına (sepet kimliği route'un okuduğu gibi, çözülmüş).
  - Kodla kart sorgusu: IP başına, OPTIONS dışında her yöntem (Express HEAD'i GET route'uyla yanıtlar). Sorgunun kimliği kodun kendisi olduğu için ayrıca kimlik başına sayılmıyor (ADR'deki "kimlik başına" maddesinin uygulaması).
- **Alışverişçinin gördüğü:** kod, tutar, durum, bitiş ve bakiye (`src/api/http/shopper-gift-cards.ts`).
  - Eklenti `allowFields` ile her Store ucunda kartın bütün alanlarını seçilebilir yapıyor. Store `fields`'ta `gift_cards` yalnızca bu yapraklarla istenebiliyor; başka biçim 400.
  - Eklentinin kendi Store uçları kartı varsayılan olarak bütün alanlarıyla döndürüyor (kodla sorgu, sepet uçlarının `*gift_cards`'ı). Bu yanıtlar aynı alanlara indiriliyor.
  - Not, referans, metadata, satın alma satırı, hesabın sahibi ve kodu içeride kalıyor.
  - Kodla sorgunun yolundaki kod loglarda maskeleniyor, son dört karakteri kalıyor (`lib/logging`). Dev dışında Medusa'nın erişim logu logger'ı atlıyor (F2'den bilinen, F16 log politikası).
- **Mağaza kredisi:**
  - Hesap yalnızca üye müşteriye açılıyor (`gift_cards.guest_account`). Misafir oturum açıp krediyi harcayamaz; misafirin e-postasıyla sepet açan başkası harcayabilirdi.
  - Sepette kredi yalnızca sepetin kendi müşterisi oturum açmışken kullanılabiliyor; başkasının ya da misafirin sepeti 404 (`src/api/validation/store-credit.ts`).
  - Hesabı koduyla sahiplenme (`POST /store/store-credit-accounts/claim`) F18'e kadar kapalı: bu kodları alışverişçiye veren bir akış yok ve eklenti onları zayıf üretiyor (`SC-`, ~50 bit).
  - Panel: müşteri sayfasında (üye müşteride) bakiye ve "Kredi ekle". Eklenti tutarın sıfırdan büyük olmasını denetliyor ve her hareketi işlemi yapan kullanıcıyla kaydediyor.
- **Denetim kaydı:**
  - Kart oluşturma (tutar, para birimi, durum, bitiş; kod hiç yazılmıyor), kart güncellemesi, kredi ve borç bakiyenin önce/sonra özetiyle (`src/api/http/audit/resources/gift-cards.ts`). Kimlik deseni iki parçalı önekleri de tanıyor (`sc_acc_…`).
  - Kartları ve hesapları okumak hassas okuma kaydına giriyor (`sensitive-routes.ts`); hesap listesinde yalnızca bakiye alanlarını isteyen okuma kayıt dışı.
- **Sipariş parası:** `GET /admin/orders/:id/money` kredi satırlarıyla ödeneni `credit` olarak veriyor (Medusa'nın bütün kredi satırları; güncel sipariş sürümününkiler). Panelin ödeme kartında satır olarak görünüyor; tamamı krediyle ödenen sipariş "Kredi ile ödendi".
- **Ertelenenler:**
  - İadede kart/kredi payının satırlara dağıtılıp mağaza kredisine dönmesi F7 iade akışıyla (`returnRefundOf` kredi payını henüz ayırmıyor). O zamana kadar iade ödemenin `refundable` tavanıyla sınırlı; kredi payı panelden elle "Kredi ekle" ile verilir.
  - Kartın satışı ve e-postası F9'da. Kart düzenleme/iptal ve krediden düşme panelde yok (Medusa Admin'de).
- **Kanıt:** `integration-tests/http/gift-cards.spec.ts`, `gift-card-codes.spec.ts`, `store-credit.spec.ts`; birim: `lib/promotions/__tests__/gift-card-code`, `api/validation/__tests__/gift-card-codes`, `api/http/__tests__/shopper-gift-cards`, `gift-card-routes`, `audit`, `lib/logging/__tests__/redact`; panel: `gift-cards-page`, `new-gift-card-dialog`, `store-credit-card`, `payment-card` spec'leri.
