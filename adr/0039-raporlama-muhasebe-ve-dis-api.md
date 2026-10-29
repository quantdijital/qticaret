# ADR-0039: Raporlama, muhasebe aktarımı, dış API ve giden webhook'lar

- **Durum:** Önerildi (2026-10-29; kullanıcının "önerileni uygula" kuralıyla otonom kabul edilir, PROGRESS "Gözden geçir"de)
- **Tarih:** 2026-10-29
- **İlgili:** F11.1–F11.8; ADR-0014 (iş altyapısı), ADR-0018 (tablo dışa aktarma), ADR-0027 (hesaplar panelden), ADR-0029 (ödeme yöntemleri), ADR-0034 (e-fatura, askıda), docs/entegrasyonlar/muhasebe.md, docs/04, docs/14 (S-SEARCH-01)

## Bağlam

Panelde bugün sabit dönemli (bugün, 7, 30, 90 gün) bir satış raporu var: ürün ve kategori listeleriyle, kişisel veri olmadan. Eksikler:
- serbest tarih aralığı ve dışa aktarma;
- finans, stok ve arama raporları;
- mali müşavire verilecek aktarım;
- mağazanın kendi sistemlerinin bağlanacağı dış API ve olay bildirimleri.

Kısıtlar:
- **Tutarlar sunucuda, kuruşla:** Raporun toplamı sipariş verisiyle birebir tutmalı (KK1).
- **Dışa aktarma güvenli olmalı:** Formül enjeksiyonu yok (KK5). Türkçe Excel noktalı virgülden böler; projenin XLSX yazıcısı ve CSV yardımcıları buna göre kaçışlar (ADR-0018, `lib/security/csv`).
- **Dış API anahtarları:** Medusa'nın secret API key mekanizması kullanılır, kendi anahtar sistemimiz yazılmaz. İptal edilen anahtar anında reddedilir ve hiçbir logda görünmez (KK4).
- **Giden webhook'lar:** İmzalı, yeniden denenir, iç ağ adreslerine gitmez (KK3). `lib/security/safe-fetch` F2'den hazır.
- **Muhasebe programına aktarım:** Program hata verirse sipariş akışı durmaz; aktarım bekler ve yeniden denenir, mükerrer kayıt oluşmaz (KK2).
- **E-fatura (F8) askıda:** UBL faturalar muhasebe paketine F8 açılınca eklenir.

## Karar

1. **Rapor altyapısı (F11.1).**
   - **Dönem:**
     - Tarih aralığı Türkiye saatine göre günle verilir (`from`, `to`, en çok 366 gün).
     - Hazır dönemler (bugün, 7, 30, 90 gün) aralığa çevrilir; panelin bugünkü özeti aynı hesaptan beslenir.
   - **Tutar:**
     - Tutarlar kuruşla toplanır; iptal edilen sipariş satış değildir.
     - İade, iade kaydından ayrı satır olarak düşülür; brüt, iade ve net ayrı gösterilir.
     - Her rapor bir "kaynak sorgu + saf toplama" çiftidir. Saf toplama birim testlidir. Fixture'lı HTTP testi toplamın sipariş verisiyle tuttuğunu doğrular (KK1).
   - **Dışa aktarma:**
     - Her rapor XLSX ve CSV olarak async işle (`report.export`) dışa aktarılır (ADR-0014).
     - XLSX projenin yazıcısıyla yazılır; CSV `;`, BOM ve formül kaçışıyla. Yeni bağımlılık yok.
     - Panelde rapor tablosu ile dosya aynı satırları verir.
2. **Satış raporları (F11.2):**
   - ciro, sipariş adedi, ortalama sepet;
   - ürün, kategori ve marka performansı;
   - iade ve değişim oranı;
   - promosyon etkisi: kod ve kampanya başına indirim ve ciro;
   - trafik kaynağı.
   - **Trafik kaynağı:**
     - Vitrinin sepete yazdığı ilk geliş bilgisinden okunur: `utm_source`, `utm_medium`, `utm_campaign`, yönlendiren alan adı, `gclid` veya `fbclid` var mı.
     - Bu bilgi çerez onayından bağımsızdır: kişisel veri değildir, IP veya tarayıcı kimliği tutulmaz.
     - Sınıflar: organik arama, ücretli arama, sosyal, e-posta, yönlendirme, doğrudan.
     - "SEO'dan gelen satış" organik arama sınıfıdır. Vitrin (F18) gelene kadar alan boş kalır ve rapor "bilinmiyor" der.
3. **Finans raporları (F11.3):**
   - KDV oranına göre satış dökümü (satırların vergi satırlarından; iade ayrı);
   - ödeme yöntemine göre tahsilat (tahsil edilen ve iade edilen, sağlayıcı başına);
   - ters ibraz listesi (`chargebacks` modülünden).
   - **Sağlayıcı mutabakatı:**
     - Günlük bir iş, PayTR ve iyzico'nun işlem listesini (resmî raporlama uçları, görev başında doğrulanır) siparişlerin ödemeleriyle eşler.
     - Eşleşmeyenler panelde listelenir. Sahte sunucularla test edilir.
4. **Stok raporları (F11.4).**
   - **Maliyet:** Medusa'da varyant maliyeti yok. Varyanta isteğe bağlı **birim maliyet** (KDV hariç, kuruş) eklenir: `variant_extension`, panelde varyant formu ve toplu düzenleme.
   - **Stok değeri:** Stok değeri maliyet × eldeki adettir. Maliyeti girilmemiş varyantlar değere katılmaz, ayrıca sayılır ve listelenir. Satış fiyatıyla tahmin yapılmaz.
   - **Devir hızı:** Devir hızı dönemde satılan adet / ortalama stoktur. Ortalama stok, F3'ün stok hareket defterinden (`stock-ledger`) dönem başı ve sonu adetle hesaplanır.
   - **Hareketsiz stok:** Stokta olup N gündür (varsayılan 90) satılmayan varyantlardır.
5. **Muhasebe aktarımı (F11.5).**
   - **Önce standart paket:** Ay seçilir. Paketin içeriği:
     - satışlar (sipariş, tarih, müşteri türü, KDV oranına göre matrah ve KDV);
     - iadeler;
     - tahsilatlar (yöntem, sağlayıcı, komisyon bilinmiyorsa boş);
     - KDV özeti.
     - Paket async işle tek XLSX (sayfa başına bir tablo) ve CSV zip'i olarak üretilir.
     - Kişisel veri en aza indirilir: bireysel müşteri için ad yok, kurumsal fatura profili için unvan ve VKN var. Bu bilgiyi mali müşavir zaten fatura için tutar.
   - **`accounting` modülü:**
     - `AccountingAdapter` arayüzü ve `accounting_sync` kaydı (kaynak türü, kaynak id, adaptör tekil; durum, deneme, son hata).
     - Bir iş bekleyenleri artan aralıkla dener; N denemede "durdu" olur ve panelde zile düşer. Sipariş akışı hiç beklemez.
     - İlk gerçek adaptör (Paraşüt, Logo, Mikro) mağazanın talebine göre seçilir. Bu fazda yalnızca sahte adaptörle KK2 testlenir.
6. **Dış API (F11.6).**
   - **Anahtarlar:**
     - Medusa'nın secret API key'leri kullanılır. Panelde Ayarlar > Dış API'de oluşturma (anahtar bir kez gösterilir), liste (yalnızca maskeli hâl), iptal.
     - Oluşturma ve iptal denetim kaydına düşer.
   - **Kapsam:**
     - Medusa anahtarlarında kapsam yok. Kendi `api_key_scope` tablomuz anahtar başına izinli alanları tutar: siparişleri okuma, ürün ve stok okuma, stok yazma, webhook yönetimi.
     - Anahtarla gelen istek yalnızca kapsamındaki uçlara geçer; geri kalan her `/admin` ucu anahtara kapalıdır.
     - Personel uçları (ayarlar, entegrasyonlar, kullanıcılar) zaten `requireUserActor` ile kapalı.
   - **Hız sınırı:** Anahtar başına.
   - **Loglar:** `sk_…` biçimi log redaksiyonuna eklenir (KK4).
   - **OpenAPI:**
     - Dış API'ye açılan uçların Zod şemalarından Zod 4'ün `z.toJSONSchema` özelliğiyle üretilir. Yeni bağımlılık yok.
     - `GET /admin/openapi.json` ve panelde indirme sunulur.
7. **Giden webhook'lar (F11.7).**
   - **Model:** `tenant-webhooks` modülü:
     - abonelik: HTTPS adresi, olay listesi, imza sırrı şifreli, yalnızca oluşturulurken bir kez gösterilir;
     - teslim kaydı: olay, durum kodu, süre, deneme, sonraki deneme.
   - **Olaylar:** Medusa olaylarının dar bir alt kümesi (sipariş verildi, iptal, kargoya verildi, teslim edildi, iade talebi, stok değişti). Görev başında 2.21.2 olay adları doğrulanır.
   - **Gövde:** Kimlikler ve durumdan oluşur; kişisel veri yok, alıcı ayrıntıyı API'den okur.
   - **İmza:** `X-Signature: t=<zaman>,v1=HMAC-SHA256(sır, zaman + "." + gövde)`.
   - **Gönderim:**
     - Teslim worker'da `safe-fetch` ile yapılır: özel ve iç adresler reddedilir, yönlendirme izlenmez.
     - 2xx dışı yanıtta 1 dk, 5 dk, 30 dk, 2 sa, 6 sa ve 24 saat aralıklarla yeniden denenir.
     - 8 başarısızlıkta abonelik devre dışı kalır ve zile düşer.
8. **Arama terimleri (F11.8).**
   - **Kayıt:** Store'un ürün aramasındaki terimler, sonuç sayısıyla günlük toplanır (terim, gün, aranma sayısı, sonuçsuz sayısı).
   - **Gizlilik:** Kişi, IP, oturum tutulmaz. Terim kişisel veri süzgecinden geçer (`redactPersonalData`) ve 80 karaktere kırpılır. Saklama 180 gündür.
   - **Kullanım:** Rapor "çok aranan" ve "sonuçsuz" listelerini verir. Danışmanın S-SEARCH-01 kuralı sonuçsuz terimleri odak kelime adayı olarak önerir.

## Doğrulanan Medusa 2.21.2 ayrıntıları (2026-10-29)
- **Secret anahtarlar:**
  - **İş akışları:** `createApiKeysWorkflow` (`{title, type: "secret", created_by}`), `revokeApiKeysWorkflow` (`revoke_in` boşsa hemen), `deleteApiKeysWorkflow` (yalnızca iptal edilmiş anahtar). Hiçbiri olay yaymaz; denetim kaydını kendi rotamız yazar.
  - **Saklama:** Anahtar `sk_` + 64 hex. Yalnızca scrypt özeti tutulur; düz anahtar yalnızca oluşturma yanıtında döner. `redacted` (`sk_abc***xyz`) panelde gösterilebilir.
  - **Kimlik doğrulama:** `Authorization: Basic base64("sk_…:")`. `auth_context` `{ actor_type: "api-key", actor_id: <apk_…> }` olur; anahtarı oluşturan kullanıcı `created_by`'dan okunur. İptal önbelleksiz, bir sonraki istekte reddedilir (KK4).
  - **Varsayılan erişim:** Medusa `/admin`'in tamamına `["bearer", "session", "api-key"]` uygular, yani **secret anahtar varsayılan olarak bütün Admin API'yi çağırabilir**. Kapsam katmanı bu yüzden varsayılan kapalıdır: `actor_type` `api-key` olan istek yalnızca kapsamına giren uçlara geçer. Dış API görevinin ilk işi budur.
- **Sipariş toplamları:**
  - `total`, `subtotal`, `tax_total`, `discount_total`, `shipping_total`, `item_total` (+`_tax_`/`original_` türevleri) yalnızca kök `total` (ya da başka bir kök toplam) istenince hesaplanır.
  - İade ve tahsilat `summary.paid_total` ve `summary.refunded_total` alanlarındadır. Satır vergisi `items.tax_lines.rate` alanındadır. Ödemeler `payment_collections.{captured_amount, refunded_amount}` ve `payments.{provider_id, captures.amount, refunds.amount}` alanlarındadır.
  - Tarih süzgeci `created_at: { $gte, $lte }`. `take` için belgelenmiş üst sınır yok; sayfalanarak okunur.
- **Olaylar (`@medusajs/framework/utils`):**
  - `order.placed`, `order.canceled`, `order.completed`, `order.fulfillment_created` (`{order_id, fulfillment_id}`);
  - `shipment.created`, `delivery.created` (`{id}`);
  - `order.return_requested` ve `order.return_received` (`{order_id, return_id}`);
  - `payment.captured` ve `payment.refunded` (`{id}`);
  - `product.updated`, `inventory-level.updated`.
  - `inventory-level.updated` sepetin tamamlanmasında ve rezervasyonda yayılmaz. "Stok değişti" webhook'u bu yüzden projenin stok hareket defterinden (`stock-ledger`) beslenir.
  - Olay yüklerinin tipi yoktur; elle tiplenir.
- **OpenAPI:** Resmî `@medusajs/medusa-oas-cli` Zod okumaz, JSDoc `@oas` yorumları ister. Karar §6'daki gibi kalır: dış API'ye açılan dar uç kümesi için şema, kendi Zod doğrulayıcılarımızdan `z.toJSONSchema` ile üretilir.
- **Maliyet:** Çekirdekte varyant maliyeti yok (doğrulandı); `variant_extension`'a eklenir. `InventoryLevel`: `stocked_quantity`, `reserved_quantity`, `incoming_quantity`, `available_quantity`.
- **Ödeme hareketleri (F11.3):**
  - Ödeme modülünde `listCaptures` ve `listRefunds` var; `created_at` süzgeci ISO metin alır, `payment` ilişkisi gelir (tip denetimiyle doğrulandı).
  - `query.graph` `payment` varlığında `captures`, `refunds` ve `payment_collection.order.{id, display_id}` alanlarını döner (HTTP testiyle doğrulandı).

## Stok raporu: uygulama (2026-10-29)
- **Maliyet:** `variant_extension.cost` (kuruş, KDV hariç). Katalog ucundan (`POST /admin/products/:id/catalog`, `variants.<id>.cost` lira) ve toplu düzenlemeden yazılır. Vitrin `fields` ile `variant_extension`'a dokunamaz.
- **Okuma:** `inventory_item` → `variants` → `variant_extension.cost` tek `query.graph` sorgusunda gelir (HTTP testiyle doğrulandı). Dönem başı ve sonu stok `stock-ledger`'ın `stockedAt` yöntemiyle okunur: anından önceki son hareket, yoksa sonraki ilk hareketin başlangıç adedi, hiç hareket yoksa bugünkü adet.
- **Liste:** Panel her listenin ilk 20 satırını gösterir; Excel ve CSV bütün kalemleri içerir.

## Arama terimleri: uygulama (2026-10-29)
- **Sayım:** `GET /store/products` rota ara katmanı (`api/http/search-terms.ts`) ilk sayfadaki `q`'yu normalleştirir ve Medusa'nın yanıt gövdesindeki `count`'ı okuyup `search_term_day`'e (gün + terim tekil, `ON CONFLICT` artırım) yazar. Yazım yanıtı beklemez.
- **Kişisel veri:** e-posta, web adresi, 6+ haneli sayı dizisi, görünmez karakterler içeren ya da 2–60 karakter dışındaki terim tutulmaz; IP, oturum, sepet hiç tutulmaz. 180 gün sonra silinir.
- **Danışman:** S-SEARCH-01 (bilgi), son 30 günde en az 3 kez sonuçsuz aranan terimler, ilk 20'si listelenir.

## Giden webhook'lar: uygulama (2026-10-29)
- **Kayıtlar:** `webhook_subscription` (adres, olaylar, `PII_ENCRYPTION_KEY` ile şifreli sır, durum, ardışık başarısızlık), `webhook_delivery` (abonelik + `event_id` tekil; durum, deneme, sonraki deneme, son durum kodu, süre, kod), `webhook_cursor` (stok defterinin okunduğu `seq`).
- **Kaynaklar:** sipariş ve iade olayları dinleyiciden; stok değişikliği dakikalık işin defteri imleçle okumasından (stok iş akışlarına dokunulmadı). Abonesi olmayan olay kuyruğa girmez.
- **Gönderim:** `deliverWebhookWorkflow` tek adım; gönderici `lib/webhooks/transport.ts` üzerinden `safe-fetch` (yönlendirme kapalı, 10 sn, yanıt en çok 64 KB). Adres oluştururken https, 443, kimlik bilgisi yok, iç IP ya da `localhost`/`.internal` değil; teslimde `safe-fetch` bağlandığı adresi yeniden denetler (KK3). Testler göndericiyi kendi alıcısına yönlendirir; canlıdaki koruma gevşetilmez.
- **Yeniden deneme ve kapanma:** teslim başına 8 deneme; abonelikte 8 ardışık başarısızlık aboneliği kapatır ve zil çalar. Yeniden açma serinin sayacını sıfırlar.

## Dış API: uygulama (2026-10-29)
- **Kapsam katmanı:** `api/http/api-key-guard.ts`, genel `/admin/*` ara katmanı. Medusa'nın genel kimlik doğrulaması önce çalışır (çekirdek genel ara katmanları uygulamanınkilerden önce; Context7), `auth_context.actor_type === "api-key"` olan istek `lib/api-access/scopes.ts` tablosundaki uçlardan kapsamına girenlere geçer, geri kalanı 403 alır. Yol `originalUrl`'den okunur: bağlı eşleştiricide `req.path` yalnızca kalan parçadır.
- **Kapsamlar:** `orders:read` (sipariş listesi ve ayrıntısı), `catalog:read` (ürün, kategori, stok kalemi, depo), `stock:write` (depo stok adedi, tekil ve toplu), `webhooks:manage` (R7'nin uçları). Kapsam kaydı olmayan anahtar (ör. Medusa'nın kendi `/admin/api-keys` ucuyla açılmış) hiçbir uca geçemez.
- **Anahtar yaşamı:** `createScopedApiKeyWorkflow` Medusa'nın `createApiKeysWorkflow`'unu adım olarak çalıştırır ve kapsamları telafili adımla yazar. Ham anahtar yalnızca oluşturma yanıtındadır. İptal `revokeApiKeysWorkflow`; bir sonraki istek 401 alır (KK4).
- **Günlük:** `sk_` ile başlayan 16+ karakter serbest metinde maskelenir; Basic başlığı zaten anahtar adıyla maskeleniyor.
- **OpenAPI:** `GET /admin/openapi.json`, kapsam tablosundan ve kendi Zod şemalarımızdan `z.toJSONSchema` ile; her işlemde `x-scope`.

## Muhasebe: uygulama (2026-10-29)
- **Paket:** `accounting.package` işi tek zip üretir (`muhasebe-paketi-AAAA-MM.xlsx` + `satislar`, `iadeler`, `tahsilatlar`, `kdv-ozeti` CSV'leri). Ay Türkiye saatiyle sayılır, en çok 24 ay geriye gider. İptal ve test ödemeli siparişler girmez. Kurumsal müşterinin VKN'si `revealTaxId` ile açılır; paket `sensitive_read` denetim kaydı yazar, iş sonucu kişisel veri sayılır.
- **Aktarım:** `accounting_sync` (kaynak türü `sale`/`payment`/`refund`, kaynak kimliği, program) tekildir. Kuyruğa alma `ON CONFLICT DO NOTHING`, sahiplenme `FOR UPDATE SKIP LOCKED` ve 10 dakikalık kirayla yapılır. Başarısızlıkta 1, 5, 15 dakika, sonra 1, 3, 6, 12 saat beklenir; 8. denemede kayıt durur ve zil çalar. Gönderim iş akışının son adımıdır ve referans olarak kaydın kimliğini taşır; adaptör aynı referansı aynı kayıt sayar, kaybolan yanıttan sonraki yeniden deneme mükerrer kayıt üretmez (KK2).
- **Program seçimi:** `accounting` ayar bölümü (`none` | `fake`). Sahte program canlı ve hazırlık ortamında seçilemez.

## Sağlayıcı mutabakatı: doğrulanan uçlar ve uygulama (2026-10-29)
- **PayTR:** `POST /rapor/islem-dokumu`, en çok 3 gün. **iyzico:** `GET /v2/reporting/payment/transactions`, gün ve sayfa ile. Ayrıntı: `docs/entegrasyonlar/paytr.md`, `docs/entegrasyonlar/iyzico.md`.
- **Pencere:** D günü için iki taraf da D-1..D+1 okunur. Gece yarısında alınıp sağlayıcının ertesi güne yazdığı ödeme böylece eşleşir.
- **Kurallar** (`lib/payments/statements/match.ts`):
  - D'de yakalanan her ödeme sağlayıcıda aynı tutarda satış olmalı; yoksa `missing_at_provider`, tutar farklıysa `amount_mismatch`.
  - Sağlayıcının D'deki her satışı mağazanın bir ödemesi olmalı; yoksa `unknown_at_shop`. Siparişe dönüşmeyip kurtarma kaydına (`payment-recovery`) girmiş ödeme bilinir sayılır.
  - D'de iki taraftan birinde iadesi olan referansın penceredeki iade toplamları eşit olmalı; değilse `refund_mismatch`.
- **Mod:** Hesabın moduyla aynı moddaki ödemeler karşılaştırılır. Sabah işi (08.30, dünü ve okunamamış ya da hiç denetlenmemiş son 3 günü) yalnızca canlı hesaplarda çalışır. Deneme hesabı elle denetlenebilir.
- **Kayıt:** `statement-checks` modülü, sağlayıcı ve gün başına tek sonuç (`matched`, `mismatched`, `failed`). Yeniden denetim öncekinin yerine geçer. İş akışında kaydın telafisi önceki sonucu geri koyar.
- **Görünürlük:**
  - Fark çıkınca zile düşer.
  - Raporlar > Finans'ta sağlayıcı durumu ve farklı günler listelenir; "Yeniden denetle" (`POST /admin/reports/statements`) en geç dünü, en çok bir yıl öncesini alır ve sağlayıcı kontrolü bütçesiyle sınırlıdır.
  - Kişisel veri yok: referans, sipariş numarası, tutar.

## Alternatifler

- **Satış fiyatıyla stok değeri:** Muhasebede yanlış yönlendirir; maliyet girilmemişse değer bilinmiyor demek dürüsttür.
- **Kendi API anahtar sistemimiz:** CLAUDE.md'nin "çekirdeği kullan" kuralına ve docs/entegrasyonlar/muhasebe.md'ye aykırı. Medusa anahtarları yeterli; eksik olan kapsam ince bir tabloyla gelir.
- **Webhook gövdesinde tam sipariş:** Kişisel veri dış sisteme loglanabilir hâlde gider. Kimlik ve durum yeterli, ayrıntı API'den okunur.
- **OpenAPI için ek paket (`zod-to-openapi` vb.):** Zod 4'ün yerleşik JSON Schema üretimi yeterli; yeni bağımlılık kullanıcı onayı ister.
- **İlk günden Paraşüt adaptörü:** Mağaza henüz muhasebe programını seçmedi; standart paket her programa ve mali müşavire uyar.

## Sonuçlar

- Kod dışı gereksinimler (docs/12):
  - mağazanın muhasebe programı ve mali müşavirin istediği biçim;
  - PayTR ve iyzico raporlama uçlarına erişim (hesap yetkisi).
- Vitrin (F18), ilk geliş bilgisini sepete yazar (trafik kaynağı) ve ürün aramasını Store API'nin `q` parametresiyle yapar (arama terimleri).
- F8 açılınca muhasebe paketine UBL faturalar ve `accounting` aktarımına fatura tetiği eklenir.
- Panel: Raporlar (Satış, Finans, Stok, Arama), Ayarlar > Muhasebe, Ayarlar > Dış API ve Webhook'lar.
