# ADR-0024: Kupon ve kampanya kuralları

- **Durum:** Kabul edildi (2026-10-26, kullanıcı önerilen seçenekle onayladı)
- **Tarih:** 2026-10-26

## Bağlam

F4.4–F4.6 kuponları, otomatik kampanyaları ve promosyon güvenliğini ister. KK: kullanım limiti dolan kupon eşzamanlı isteklerde bile aşılmaz; kargo bedava eşiği doğru uygulanır.

Medusa 2.21.2'de doğrulananlar (F4 planlaması, kaynak kodu):

- Promosyonun kendi `limit`/`used` alanları var (2.12'den beri). Kampanya bütçeleri: `spend`, `usage`, `use_by_attribute` (ör. `customer_id` başına). `spend_by_attribute` enum'da var ama modül işlemiyor.
- Kullanım `completeCartWorkflow` içindeki `registerUsageStep`'te sayılıyor. Adım transaction içinde `promotion` ve `promotion_campaign_budget` satırlarını `FOR UPDATE` ile kilitliyor (`lock_timeout` 3 sn); aşımda `NOT_ALLOWED`. Telafi `revertUsage`.
- Uygulama türleri: yüzde/tutar; hedef sipariş/kalem/kargo; `buyget` (X al Y). Kurallar: müşteri grubu, ürün, kategori, koleksiyon, tür, etiket, bölge, ülke. Sepet tutarı kuralı (`item_total gte`) bağlamda var ama belgelenmemiş: testle doğrulanır.
- Birleştirme, öncelik ya da "tek başına" alanı yok; birden çok kod sırayla uygulanıyor.
- Kod benzersiz ama **büyük/küçük harfe duyarlı**; normalleştirme yok.
- Toplu tek kullanımlık kod üretimi için çekirdek API yok.
- Kod uygulayan Store uçları: `POST/DELETE /store/carts/:id/promotions` ve `promo_codes` alanıyla `POST /store/carts`, `POST /store/carts/:id`.
- Kargo bedava eşiği: düz fiyatlı kargo seçeneğine `item_total gte N` kurallı 0 TL fiyat (Medusa'nın belgelediği yol; `item_total` KDV dahil ve indirim sonrası).

## Karar

- **Kod biçimi:** kodlar büyük harfe ve ASCII'ye çevrilerek saklanır ve uygulanır (`İNDİRİM10` → `INDIRIM10`). Panel yazarken, Store uçları uygularken aynı fonksiyonla (`lib/promotions`).
- **Birleştirme kuralı:** sepette **en çok bir kod**; otomatik kampanyalar kodla birlikte uygulanır. İkinci kod Store ucunda açıklayıcı hatayla reddedilir (`promotions.one_code`). Mağaza ayarıyla "kodlar birleşebilir" açılabilir (varsayılan kapalı).
- **Limitler:** toplam limit promosyonun `limit`'i; kişi başı limit kampanya bütçesi `use_by_attribute` (`customer_id`; misafirde `customer_email`, küçük harfe çevrilmiş). Eşzamanlılık Medusa'nın satır kilidine bırakılır, KK testiyle kilitlenir.
- **Minimum sepet:** `item_total gte` kuralı; çalışmazsa sepet doğrulama hook'u (`complete-cart-validate` deseni) yedek yol.
- **Deneme sınırı:** F2'de tanımlı `coupon` profili (IP başına 10 dk'da 30, kimlik başına 10) bu üç Store ucuna bağlanır; yalnızca kod içeren istekler sayılır.
- **Tek kullanımlık kodlar:** iş (`promotion.codes`): şablon promosyonun kampanyasında `limit: 1`'li N promosyon, rastgele ve okunur kodlar (karışan karakterler yok: 0/O, 1/I), sonuç CSV. En çok 10.000 kod/iş.
- **Kargo bedava eşiği:** mağaza ayarı (`promotions.free_shipping_threshold`); kaydedilince düz fiyatlı kargo seçeneklerine `item_total gte` kurallı 0 TL fiyat yazılır. Promosyonla kargo indirimi ayrı (kampanya ekranından).

## Alternatifler

| Seçenek                                    | Artı                                         | Eksi                                                    |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------- |
| **Tek kod + otomatikler (seçilen)**        | Beklenen davranış, kötüye kullanımı sınırlar | Bazı mağazalar birleştirmek isteyebilir (ayarla açılır) |
| Medusa'nın davranışı (sınırsız kod)        | Ek kod yok                                   | Kod yığma; indirim hesabı öngörülemez                   |
| Kod başına ayrı model (kendi kupon modülü) | Tam denetim                                  | Medusa'nın sepet hesabını ve kilidini yeniden yazmak    |

## Sonuçlar

- `spend_by_attribute` (kişi başı harcama sınırı) Medusa işleyene kadar sunulmaz.
- Kodların normalleştirilmesi var olan küçük harfli kodları etkiler: migration script'i mevcut kodları büyük harfe çevirir, çakışmayı raporlar.
- Kampanya ekranı (panel) kapsam, minimum sepet, kişi başı limit ve "X al Y öde" ile genişler.

## Uygulama notu (F4 U4a, 2026-10-26)

- **Kod biçimi:** `src/lib/promotions/code.ts` (`normalizeCode`). Admin'de `POST /admin/promotions(/:id)`, Store'da sepet uçları yazmadan önce kodu çeviriyor. Mevcut kodlar `src/migration-scripts/promotion-codes-normalized.ts` ile bir kez çevriliyor; yeni biçimi başka bir promosyonda olan kod olduğu gibi kalıyor ve logda adıyla yazılıyor.
- **Ara katmanlar `methods` olmadan:** Medusa gövdeyi route'un kendi ara katmanında doğrulayıp `validatedBody`'den okuyor; `methods` verilen ara katmanlar ondan sonra çalıştığı için yeniden yazdıkları kod route'a ulaşmıyordu. `app.use` ile çalıştıkları için route parametreleri dolu değil; sepet kimliği ve işlem yoldan okunuyor (`cartRoute`). Kayıt: `src/api/http/promotion-routes.ts`.
- **Tek kod:** mağaza ayarı `promotions.combine_codes` (varsayılan kapalı). `POST /store/carts` ve `POST /store/carts/:id` kodları gönderilenlerle değiştiriyor (Medusa `REPLACE`), `POST /store/carts/:id/promotions` ekliyor (`ADD`): ikincisinde sepetteki elle girilmiş kodlar da sayılıyor. Hata `promotions.one_code`.
- **Deneme sınırı:** `coupon` profili (IP başına 10 dk'da 30, sepet başına 10) yalnızca kod gönderen sepet isteklerini sayıyor.
- **Doğrulananlar (HTTP testleri):** `item_total gte` kuralı Medusa'da çalışıyor (belgelenmemişti); kullanım limiti 1 olan kodla yarışan üç ödemeden yalnızca biri tamamlanıyor ve `used` 1 kalıyor (KK).

## Uygulama notu (F4 U5, 2026-10-26)

- **Kod üretimi:** `src/lib/promotions/single-use.ts`. Kod, şablonun kodu + `-` + 8 karakter. Alfabe 32 karakter, 0/O ve 1/I yok; `crypto.randomInt` kullanılır, toplam yaklaşık 10¹² olasılık. Kodlar saklanan biçimde üretilir (büyük harf, ASCII).
- **İş:** `promotion.codes` (`src/workflows/async-job/types/promotion-codes.ts`, `src/workflows/promotions/code-batches.ts`).
  - Şablon: kodlu, standart, otomatik olmayan ve kendisi bir partinin kopyası olmayan promosyon.
  - Her parti kendi kampanyasında. Tanımlayıcı `codes-<şablon kimliği>-<zaman>`, tarihler şablonun kampanyasından.
  - Kopyalar şablonun indirimini, hedef kurallarını ve en az sepet kuralını taşır; `limit: 1`.
  - Kodlar 500'lük parçalarla mağazadakilere karşı denetlenip yazılır. Yarıda kalan parti geri alınır.
  - Sonuç CSV'si 30 gün saklanır. Parti denetim kaydına `promotions.codes_created` olarak yazılır. Yerelde 10.000 kod 3,8 saniye sürdü.
- **Liste:** Medusa'nın promosyon listesi kampanyaya göre dışlamayı desteklemiyor. Panelin listesi bu yüzden `GET /admin/promotion-board`'dan okunur: parti kampanyaları dışarıda kalır, şablon başına parti sayısı verilir.
- **Partiler:** `GET /admin/promotions/:id/code-batches` kod ve kullanım sayılarını verir. `GET …/code-batches/:campaign_id/codes`, kodları "kullanıldı" bilgisiyle CSV olarak her zaman veritabanından verir; iş dosyasının süresi dolsa da indirilebilir.
- **Kullanım:** Kullanılmış kodu Medusa sepete uygulamaz, hata da vermez; ikinci sipariş indirimsiz tamamlanır (testli). Eşzamanlı kullanım sınırı U4'teki gibi `registerUsage` kilidiyle korunur.
- **Kanıt:** `lib/promotions/__tests__/single-use.unit.spec.ts`, `integration-tests/http/promotion-code-batches.spec.ts`.

## Uygulama notu (F4 U6, 2026-10-26)

- **Kargo bedava eşiği:** `promotions.free_shipping_threshold` (lira, KDV dahil, indirim sonrası; null kapalı).
  - Ayar kaydedilince `syncFreeShippingStep` düz fiyatlı kargo seçeneklerine, düz fiyatlarının olduğu her para biriminde, `item_total gte eşik` kurallı 0 TL fiyat yazar. Eşik değişince bu fiyatı taşır, eşik kalkınca siler (`src/workflows/promotions/free-shipping.ts`). Adımın geri alması önceki eşiğe döner.
  - Platformun fiyatı şöyle tanınır: tutarı 0 ve tek kuralı `item_total gte`. Mağazanın Medusa Admin'den girdiği başka kurallı fiyatlara dokunulmaz. Medusa, kimliğiyle verilen fiyatın yalnızca verilen alanlarını değiştirdiği için korunan fiyatlar kimlikleriyle geri gönderilir.
  - Yeni ya da değişen kargo seçeneği `shipping_option.created/updated` olaylarıyla aynı eşiği alır. İkinci geçiş değişiklik bulmadığı için döngü olmaz.
  - Taşıyıcının hesapladığı (`calculated`) seçenekler sağlayıcıya kalır (F7).
- **"X al Y öde":** Medusa'nın `buyget` türü.
  - Eşleme: `buy_rules_min_quantity: Y`, `apply_to_quantity: X − Y`, `%100`, `allocation: each`. Alım ve hedef kuralları aynı kapsamdır, kapsam zorunludur. `max_quantity: 1000` toplam bedava birim sınırıdır ve teklifin sepet büyüdükçe tekrarlanmasını sağlar.
  - Ölçüldü: 2 adette indirim yok; 3, 6 ve 9 adette 1, 2 ve 3 birim bedava; karışık sepette en ucuz ürün bedava. `max_quantity: 1` teklifi tek seferle sınırlıyor.
- **Sepette indirim:** otomatik + tüm sepet + en az tutar. Var olan formla kuruluyor, "X al Y öde" ile birlikte uygulanabiliyor (testli).
- **Kanıt:** `integration-tests/http/free-shipping.spec.ts` (KK), `integration-tests/http/promotion-offers.spec.ts` (panelin gövdesiyle), `workflows/promotions/__tests__/free-shipping.unit.spec.ts`; panelde `offer.spec.ts`, `form.spec.ts`.

## Uygulama notu (F4 kapanış incelemesi, 2026-10-27)

- **Ödeme anında yeniden denetim** (`workflows/hooks/complete-cart-validate.ts`):
  - Birleştirme kapalıyken sepette birden çok elle girilmiş kod varsa ödeme reddedilir (`promotions.one_code`). Kod eklerken yapılan denetimi yarışan istekler aşabiliyordu.
  - Sabit fiyatlı kargo yönteminin tutarı seçeneğin sepete göre güncel fiyatıyla karşılaştırılır; tutmazsa `cart.shipping_changed`. Medusa ürün değişince kargoyu yeniden fiyatlıyor, kod eklenince fiyatlamıyor: eşiğin altına inen sepette 0 TL kargo kalıyordu. Storefront (F18) kod ekleyince kargoyu yeniden seçtirmeli.
  - HTTP tamamlama yolunda testli. Aynı workflow doğrudan `.run()` ile çağrılınca kanca hatası tamamlamayı durdurmadı; alışverişçinin yolu HTTP olduğu için kayda geçirildi.
- **Kodlar:**
  - Admin'den kaydedilen kod sunucuda da `^[A-Z0-9_-]{3,40}$` (CSV'ye formül sızmasını da önler).
  - Bir Store isteğinde en çok 5 kod.
  - Tek kullanımlık kodun rastgele kısmı 12 karakter (yaklaşık 2^60).
  - Sepet başına deneme bütçesi IP'den bağımsız da sayılır (`perIdentityAnyIp`).
- **Doğrulanan, değişiklik gerekmeyen:**
  - Store `fields` bir promosyonun kampanyasına, diğer kodlarına, bütçesine ve kurallarına ulaşamıyor; Medusa izinsiz alanları düşürüyor (testli).
  - Bilinmeyen kodu silmek kod varlığını sızdırmıyor (200).
  - Kişi başı sınır misafiri de sayıyor: Medusa aynı e-postaya (büyük/küçük harf farkıyla da) aynı misafir müşteriyi bağlıyor. Karardaki `customer_email` yedeğine gerek kalmadı (testli).
- **Kayıt:** `POST /admin/promotions/:id/offer`. Panelin formu değişen parçaları tek istekle gönderir; tek bir workflow promosyon alanlarını, kapsamı ve "al" kurallarını, en az sepeti, kampanyanın günlerini ve kişi başı sınırını Medusa'nın kendi telafili workflow'larıyla uygular. Sonraki bir parça başarısız olursa öncekiler geri alınır (testli). Kampanyanın promosyona ait olup olmadığına sunucu karar verir.
- **Kod partileri:**
  - Tek workflow: şablon, kampanya, kodlar. Kampanya ve kodlar telafili.
  - CSV ya da denetim kaydı yazılamazsa parti silinir.
  - Parti, şablon kampanyanın bütçesinin kopyasını alır: kişi başı sınır geçer, toplam bütçe parti başına ayrı sayılır.
  - Parti panelden durdurulabilir: kampanyası şimdi biter, durdurma denetim kaydına girer.
  - Kod dökümü hassas okuma kaydına girer; CSV'ler `lib/security/csv` ile yazılır.
- **Denetim kaydı:** promosyon özeti kuralları, hedef ve "al" kurallarını, dağıtımı ve adetleri, bütçenin niteliğini içerir; kural toplu uçları ve kampanyaya üye ekleme de kayda girer.
- **Ücretsiz kargo:** tek workflow (`promotions-free-shipping-sync`); ayarlar workflow'u adım olarak çalıştırır, Medusa'nın güncellemesi sonraki hata durumunda fiyatları geri koyar.


## Ek (2026-11-26): kargo bedava eşiği adr/0087'ye geçti

Eşik artık fiyat kuralı değil hesaptır: bütün mağaza seçenekleri (sabit ücret, desi tablosu, Geliver [2026-11-26: Geliver kaldırıldı, ADR-0031 ek]) `lib/shipping/quote.ts`'teki `shippingQuote` ile fiyatlanır; sepet tutarı (`item_total`, KDV dahil, indirim sonrası) eşiği geçerse her seçenek 0 TL'dir. Sabit ücretli seçenekler hesaplanan seçeneğe çevrildi (tutar `data.amount`'ta; "Kendi gönderimim" `shop_shop` sağlayıcısında). `promotions-free-shipping-sync` iş akışı ve aboneliği kaldırıldı; tek seferlik geçiş eski eşik fiyatlarını da siler. Mağazadan teslim Medusa'nın düz fiyatında kalır. Kupon sepeti eşiğin altına indirirse "kargoyu yeniden seç" kuralı her seçenekte geçerlidir (`hasStaleShipping`).
