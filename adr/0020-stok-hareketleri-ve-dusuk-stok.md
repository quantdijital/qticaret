# ADR-0020: Stok hareket defteri, düşük stok uyarısı, ön sipariş ve kilit sağlayıcısı

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama F3.7, F3.8)
- **Tarih:** 2026-10-25

## Bağlam

F3.7 ve F3.8 şunları ister:

- Depo, stok seviyesi, sipariş anında rezervasyon, iptal ve iadede stoğun geri dönmesi.
- Düşük stok eşiği ve admin uyarısı (KK).
- Stoksuz satış (ön sipariş) ayarı.
- Stok hareket geçmişi.
- KK: aynı son ürün için eşzamanlı iki checkout'tan yalnızca biri tamamlanır.

Medusa 2.21.2'de doğrulananlar (Context7 + v2.21.2 kaynağı):

- **Rezervasyon:**
  - `completeCartWorkflow` → `reserveInventoryStep`, `locking.execute(inventory_item_id'ler)` içinde rezervasyon yazar.
  - Modül `available_quantity < quantity` ise NOT_ALLOWED fırlatır. İki farklı sepetten ikincisi hata alır.
  - Rezervasyon yalnızca `location_ids[0]`'dan yapılır.
- **Geri dönüş:** İptal rezervasyonu siler. İade teslim alımı stoğu artırır; hasarlı ya da dismissed kalemler hariç.
- **Backorder:** `allow_backorder` stok kontrolünü atlar. Ancak seviye kaydı yoksa yine NOT_FOUND döner.
- **Olmayanlar:** Düşük stok eşiği alanı ya da olayı yok; hareket geçmişi yok.
- **Olaylar:**
  - `inventory-level.updated` yalnızca `{ id, order_id? }` taşır; delta, kaynak ve aktör yok.
  - `reservation-item.created` ve `reservation-item.deleted` var (2.18+).
- **Kritik bulgu, kilit sağlayıcısı:**
  - `medusa-config.ts` Locking modülünü tanımlamıyor; Medusa bellek içi sağlayıcıyı kullanır ("only intended for use in a single-instance environment").
  - Birden çok süreç ya da replika olduğunda yukarıdaki stok kilidi süreçler arası çalışmaz.
  - Redis sağlayıcısı `@medusajs/medusa` ile gelir (`@medusajs/medusa/locking-redis`); yeni bağımlılık değildir.
  - Bugünkü plan bunu F16'ya bırakıyor (adr/0001, adr/0014, PROGRESS).
- **Bildirim:** Local notification sağlayıcısı `feed` kanalıyla admin'deki zil paneline düşer: `template: "admin-ui"`, `data: { title, description }` düz metin.

## Karar (öneri)

- **Kilit:** Locking modülü F3'te (T7) bağlanır, F16 beklenmez.
  - `REDIS_URL` varsa varsayılan `locking-redis`; yoksa bellek içi (dev ve test).
  - Anahtarlar tenant namespace'iyle ayrışır (`src/lib/redis`). Sağlayıcının anahtar öneki desteği T7 planında doğrulanır.
  - Event bus, workflow engine ve caching Redis modülleri F16'da kalır.
- **Eşzamanlı checkout testi:** Aynı son ürüne iki sepet, `Promise.all` ile iki `completeCart`. Biri sipariş olur, diğeri stok hatası alır, stokta negatif yok. Test çekirdek davranışını kilitler; Medusa yükseltmesinde kırılırsa haber verir.
- **Modül `stock-ledger`:** Append-only, audit-log gibi (`refuseWrite`).
  - Satır alanları:
    - `inventory_item_id`, `location_id`
    - `delta_stocked`, `stocked_after`, `delta_reserved`, `reserved_after`
    - `reason`: `manual` | `import` | `bulk_edit` | `order` | `return` | `cancel` | `reconcile` | `unknown`
    - `reference` (sipariş ya da iş ID'si), `actor_id` (biliniyorsa)
    - `created_at`
  - **Kendi yazma yollarımız:** İçe aktarma (F3.9) ve toplu düzenleme (F3.10) satırı nedeni ve aktörüyle kendi workflow adımında yazar.
  - **Çekirdek yollar:** Admin stok ekranı, sipariş, iade ve iptal subscriber'la yakalanır. `inventory-level.updated` ve `reservation-item.*` gelince:
    - seviye okunur;
    - defterdeki son `*_after` ile fark alınır;
    - fark sıfırsa yazılmaz; bu, tekrar gelen olayı (at-least-once) zararsız kılar;
    - seviye başına kilit (`stock-ledger:<level_id>`) aynı seviyenin iki olayını sıraya sokar.
  - **Neden:** `order_id` varsa `order`/`return`/`cancel`'dan biri, yoksa `manual`.
  - **Aktör:** Admin stok route'ları denetim kaydına (adr/0011) eklenir. Kimin değiştirdiği oradan, miktar zaman çizelgesi defterden okunur.
  - **Uzlaştırma işi:** Gece çalışır. Kaçan olayların farkını `reconcile` satırıyla kapatır.
- **Düşük stok:**
  - **Eşik:**
    - Tenant varsayılanı yeni `inventory` ayar bölümünde (platform-settings).
    - Kalem bazlı override, inventory item'a link'li küçük bir tabloda (aynı modülde).
  - **Ölçüm:** Kalemin tüm depolardaki `available` toplamı (stocked − reserved).
  - **Tetik:** Defter subscriber'ı yazdıktan sonra kontrol eder. Eşiğin üstünden eşiğe ya da altına inişte `feed` bildirimi yazılır.
  - **Tekrar bastırma:** `alerted` durumu tutulur; seviye eşiğin üstüne çıkınca sıfırlanır (histerezis).
  - **Metin:** Tenant varsayılan dilindeki i18n kataloğundan sunucuda çözülür, çünkü `data` düz metin alır.
- **Ön sipariş:** `preorder` özellik bayrağı (F2.3) ve varyant formunda "stoksuz satış".
  - Medusa'nın `allow_backorder` alanına eşlenir.
  - Seviye kaydı yoksa varsayılan depoda sıfır stoklu kayıt oluşturulur (NOT_FOUND'u önler).
  - JSON-LD `availability`: `BackOrder` ya da `PreOrder` (docs/13 §2.4).

## Alternatifler

| Seçenek                                            | Artı                                                           | Eksi                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Subscriber + kendi yollarımızda doğrudan yazım** | Çekirdek akışlara dokunmaz; tüm kaynakları yakalar; idempotent | Çekirdek yollarda neden kaba; olaylar asenkron (saniyelik gecikme)         |
| Yalnızca kendi workflow'larımız                    | Neden ve aktör kesin                                           | Admin stok ekranı, sipariş ve iade çekirdekte; defter eksik kalır          |
| Gece anlık görüntü farkı                           | Basit                                                          | Gün içi hareket görünmez; uyarı gecikir                                    |
| Kilidi F16'da bağlamak (bugünkü plan)              | F3 kapsamı küçük kalır                                         | KK tek süreçte geçer ama çok süreçte gerçek değildir; ön koşul gizli kalır |

## Sonuçlar

- **Olay zamanlaması (T7 planında doğrulanacak):**
  - Rezervasyon değişiminin `inventory-level.updated` da yayıp yaymadığı.
  - Admin stok route'larının yolları (denetim kaydı için).
  - Kilit anahtar öneki.
- **Bilinen sınır:** Medusa yalnızca ilk depodan rezerve eder; çok depolu dağıtım (F7) bunu genişletir.
- **Saklama:** Defter satırları için saklama süresi ve arşiv F13'te (KVKK değil, ticari kayıt).
