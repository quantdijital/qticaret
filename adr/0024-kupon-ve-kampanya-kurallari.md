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
