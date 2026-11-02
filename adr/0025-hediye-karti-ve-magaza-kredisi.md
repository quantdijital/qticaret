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

## Ek: vergi modeli ve satış kararı (kullanıcı, 2026-10-31)

- **Vergi modeli:** genel amaçlı hediye kartı bir ödeme aracıdır (GİB'in ödeme aracı niteliğindeki hediye çeklerine ilişkin açıklaması). Kart satılırken fatura kesilmez, alınan para avans olarak izlenir. KDV kartla alışveriş yapılınca doğar; ürünün faturası tam bedelden kesilir, e-Arşiv ödeme tipi `ODEMEARACISI`. Tek bir ürüne bağlı kart desteklenmez (satışta mal teslimi sayılabilir).
- **Mağaza kredisi:** iadeden doğan kredi indirim değil ödeme/mahsup aracıdır; krediyle yapılan alışverişin faturası tam tutardan kesilir, kredi ödeme kısmında izlenir. Promosyon amaçlı kupon ise iskontodur.
- **Kartlar süresiz:** panelden bitiş tarihi kaldırılır, admin ucu bitiş tarihini reddeder. Kullanılmadan süresi dolan bakiye durumu oluşmaz.
- **Satış açılır, kodu F18 vitrinle birlikte:** vitrinde tutar seçilen kart; ödeme alınınca kart üretilip alıcıya ya da hediye edilen kişiye e-postayla gider; aylık muhasebe paketinde "satılan kart (avans)" ve "kullanılan kart" satırları; kart satın alan siparişte fraud puanı yükselir (çalıntı kartla hediye kartı alıp bozdurma). Kartın cayma hakkı avukata sorulacak (docs/12).

## Ek (2026-11-03): hediye kartı satışı

Vitrinde kart satışı (docs/20, F18). Sektörden bağımsız, fiyat sunucuda.

- **Ürün:** mağaza sıradan bir ürün açar (ör. "Hediye kartı"); varyantları tutarlardır (250 TL, 500 TL…), fiyat varyant fiyatıdır. Katalog uzantısında `is_gift_card` (migration `Migration20261102210437`) işaretlenir: `POST /admin/products/:id/catalog { is_gift_card }`, okuma aynı ucun `GET`'inde. İşaretlemek `promotions.gift_cards` bayrağını ister, kaldırmak istemez. Kart dijitaldir: işaretleyince tür `digital` olur (kargo profili ve kargo gerektiren stok kalemi gider; F3.2'nin yolu, `catalog.non_physical` bayrağı gerekmez), kart işaretliyken başka tür reddedilir (`catalog.gift_card_kind`).
- **Medusa'nın `is_giftcard`'ı kullanılmaz:** eklenti (`create-gift-card` subscriber'ı) o işaretli ürünün kartını `order.placed`'de, ödeme beklenirken ve zayıf koduyla üretir. Admin'in ürün ucunda `is_giftcard: true` reddedilir (`catalog.core_gift_card`; tekli, `create`/`update` toplu gövdeler).
- **Vitrin:** Store ürün yanıtında yalnızca `product_extension.is_gift_card` istenebilir (`fields=+product_extension.is_gift_card`; Medusa satırın `id`'sini de ekler). Uzantının başka sütunu ve `product_extension.*` 400.
- **Satın alma:** hediye satırının alıcısı satırın `metadata.qt_gift`'inde: `{ recipient_email, recipient_name?, message? (≤300), sender_name? (≤60) }`. Yazan tek uç `POST /store/carts/:id/line-items/:line_id/gift` (bayrak kapalıyken 404; checkout bütçesi IP ve sepet başına; e-posta tek yazımla, alan adı posta alıyor mu denetlenir). Metinler tek satır düz metin; bağlantı, web ya da e-posta adresi (`gift_card.text_link`) ve görünmez/yön değiştiren karakter reddedilir: e-posta mağaza adına bir yabancıya gider. Kart olmayan satır 400 `gift_card.not_gift_line`. `GET /store/carts/:id/gift-lines` sepetin hediye satırlarını ve alıcılarını verir.
- **Ödemeye hazır olma:** ödeme başlatılırken (`readCheckoutCartStep`, her ödeme yolu) ve sipariş oluşurken (`completeCartWorkflow` validate hook'u) denetlenir: bayrak kapalıysa `gift_card.sale_disabled`, alıcısız satır `gift_card.recipient_required`, sepette hediye kartı ya da mağaza kredisi satırı varsa ya da yol `credit` ise `gift_card.not_payable_with_credit`. **Hediye kartı, hediye kartı ya da mağaza kredisiyle alınamaz** (Shopify da böyle): kartla kart almak, çalıntı bakiyeyi yeni koda aktarıp izini kaybettirir. Tamamı indirimle 0'a düşen hediye satırı da satılamaz (ödenecek tutar yok, `credit` yolu kapalı).
- **Kartın üretimi:** ödeme alınınca. Kart ödemesi yetkilendirilirken yakalanır ve `payment.captured` yayınlanmaz; bu yüzden subscriber (`subscribers/gift-card-issue.ts`) hem `order.placed`'i hem `payment.captured`'ı dinler (havale onayı, kapıda tahsilat). Workflow (`workflows/gift-cards/issue-gift-cards.ts`) siparişin kilidi altında: siparişin ödemeleri borcunu karşılıyorsa (yakalanan ≥ net − kredi), iptal edilmemişse, test modunda ödenmemişse ve kart üretilmeden önce iade yapılmamışsa, her adet için eklentinin `createGiftCardsWorkflow`'u ile bir kart: değer = birim fiyat (KDV dahil, indirimden önce), TRY, süresiz, bizim 80 bit kodumuz, `reference: "order"`, `reference_id`, `line_item_id` ve `metadata.qt_issue_key = sipariş:satır:sıra`. Satırın mevcut kartları `line_item_id` ile sayılır, eksik kalan üretilir: olay iki kez gelse de, eşzamanlı gelse de kart bir kez çıkar (testli). Satırın `metadata.qt_gift_cards`'ına `{ id, last4 }` yazılır; tam kod hiçbir kayıtta ve logda yok. Yarıda kalan üretim bu çalıştırmada yaptığı kartları geri siler (henüz gönderilmedi); hata subscriber'dan fırlatılır.
- **E-posta:** `gift_card.issued` (işlemsel, yalnızca e-posta): kodlar, değer, gönderenin adı ve mesajı, nasıl kullanılacağı, "kodu paylaşmayın". Satırın bütün kartları üretilince gider; adres alıcınınki (yoksa siparişin e-postası). F9 altyapısı: günlük kota, aynı anahtar (`gift_card.issued:email:<sipariş>:<satır>`) bir kez, gönderilmeyen panelin ileti geçmişinde. E-postanın başarısızlığı kartı geri almaz. **Yeniden deneme:** saatlik `gift-card-issue` işi son 26 saatte parası yakalanan hediye satırlı siparişleri yeniden üretir (hiçbiri iki kez çıkmaz) ve e-postayı yeniden dener (gitmiş olan gitmez).
- **İptal/iade:** kart üretilmeden iptal ya da iade edilen siparişte kart üretilmez. Üretildikten sonra kart alıcınındır, iade otomatik geri almaz. Eklentinin 2.21.2 sürümünde kartın "kapalı" durumu yok (durumlar `pending`/`redeemed`); kartı kapatmanın yolu kalan bakiyeyi borçlandırmak (`/admin/store-credit-accounts/:id` borç hareketi, defter iz bırakır) ya da kartı silmek (`deleteGiftCardWorkflow`). Personel iade/iptalde kartı panelden kapatır (**açık**: panelde "kartı kapat").
- **Bakiye sorgusu:** `POST /store/gift-cards/balance { code }` → `{ balance, currency_code, expires_at }` ya da 404 `gift_card.unknown`; kod gövdede (URL'de, logda değil). Bayrak kapalıyken 404. IP başına dakikada 10, adres başına 15 dakikada 3 denemeden sonra iş kanıtı (`challengeOver("gift_card")`, 428); kod deneme bütçesi (`coupon`) de sayılır. Kod tek yazıma çevrilip aranır, sonra sabit sürede karşılaştırılır; alışverişçinin gördüğü alanlar `shopperGiftCard` ile sınırlı.
- **KVKK:** alıcının e-postası ve adı üçüncü kişinin kişisel verisi; hukuki sebep sözleşmenin ifası; siparişle birlikte saklanır, müşterinin silme talebinde sipariş ve sepet kaleminden silinir (kart kimliği ve son 4 karakter kalır), veri dökümünde kalemin `hediye` alanında (docs/kvkk-envanter.md).

**Açık soru: KDV anı.** Kartın çok amaçlı (mağazadaki her ürüne geçen, ödeme aracı) mı tek amaçlı (belli mal/hizmete bağlı) kupon mu sayılacağı ve KDV'nin satışta mı kullanımda mı doğacağı mali müşavire sorulacak (docs/mali-musavir-sorulari.md). 2026-10-31 eki "ödeme aracı, satışta fatura yok, avans" diyor; kod buna göre: kartın değeri birim fiyatın tamamıdır. Ama **satış faturası şu an hediye satırını da sıradan kalem gibi içerir** (e-fatura sahibi: hediye satırını satış faturasından çıkarıp avans olarak izlemeli; hediye ürününün vergi sınıfı %0 olmalı ki sepet KDV'si eklenmesin). Teyide kadar mağaza ürünü KDV'siz fiyatlandırmalı.

**Vitrin ve panelin ekleyeceği:**

- **Vitrin (yapıldı, 2026-11-03).** Ürün sayfası: `product_extension.is_gift_card` doğruysa tutar (varyant) seçimi ve alıcı formu (e-posta zorunlu; ad, mesaj ≤300, gönderen adı); sepete ekledikten sonra yeni satıra `…/gift`. Sepet/ödeme: `GET /store/carts/:id/gift-lines`, alıcısı olmayan satırda formu tekrar göster; `gift_card.*` hatalarını göster; hediye satırı varken hediye kartı/kredi alanını gizle. Sipariş sayfası: hediye satırında "Kart alıcıya e-postayla gönderildi" (`items.metadata.qt_gift_cards` doluysa). Bakiye sorgu sayfası (428'de iş kanıtı, `gift_card` kapsamı): `/hediye-karti/bakiye`; `hediye-karti` backend'de ayrılmış kök (`RESERVED_ROOT_SEGMENTS`), hiçbir kayıt bu yolu alamaz.
- Panel: ürün sayfasında "Hediye kartı" anahtarı (`is_gift_card`, bayrak kapalıyken gizli; işaretli üründe tür seçimi kilitli; varyantlar `manage_inventory: false` önerilir); sipariş sayfasında hediye satırının alıcısı ve kartları (son 4, kartın panel sayfasına bağlantı); kart sayfasında "kartı kapat" (kalan bakiyeyi borçlandır); ileti şablonları listesinde `gift_card.issued` etiketi.
- Ertelenen: kart satın alan siparişte fraud puanının artması (2026-10-31 eki), muhasebe paketinde "satılan kart (avans)" satırı, cayma hakkı (avukat).
