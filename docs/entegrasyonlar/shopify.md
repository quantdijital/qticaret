# Shopify (F14.2 geçiş kaynağı)

> Karar: ADR-0042. Kod: `apps/backend/src/lib/migration/shopify/`. Sahte sunucu: `packages/testing/src/shopify/`.

Shopify'dan gelen bir mağazanın kataloğu, müşterileri, geçmiş siparişleri ve eski adresleri bir kez okunur. Yalnızca okuma yapılır; Shopify'da hiçbir şey değişmez.

## Mağaza sahibinin yapacakları

1. Shopify **Dev Dashboard**'da (dev.shopify.com) mağazanın bağlı olduğu organizasyonda bir uygulama oluşturur.
   - 1 Ocak 2026'dan beri yönetici panelinde yeni "eski tip özel uygulama" açılamıyor. Dev Dashboard uygulaması statik anahtar vermiyor; istemci kimliği ve gizli anahtarla günlük anahtar alınıyor (client credentials grant).
   - Uygulama ile mağaza aynı organizasyonda olmalı; değilse Shopify `shop_not_permitted` der ve panel mağaza adresini işaretler.
2. Uygulamaya yalnızca okuma kapsamları verir:
   - `read_products` (ürünler, varyantlar, koleksiyonlar)
   - `read_customers`
   - `read_orders` ve `read_all_orders` (60 günden eski siparişler; Shopify'ın korumalı erişim onayı gerekir)
   - `read_online_store_pages` ya da `read_content` (sayfalar, bloglar, yazılar)
3. Uygulamayı mağazaya yükler.
4. Panelde Shopify hesabını girer: mağaza adresi (`magaza-adi.myshopify.com`), Client ID, Client secret. Kayıtta bağlantı denenir.
5. Taşımayı önce kuru çalıştırır, raporu inceler, sonra uygular. Uygulama yeniden doğrulama ister.

## Nasıl okunur

- **API:** GraphQL Admin API, sürüm `2026-10` (kararlı; 2027-10'a kadar destekli).
- **Toplu sorgu (bulk operation):** her liste için bir `bulkOperationRunQuery`.
  - Shopify listeyi kendisi okur ve JSONL dosyası bırakır. Sorgu başı maliyet sınırı ve 25.000 nesnelik sayfalama sınırı yoktur.
  - Durum `bulkOperation(id:)` ile birkaç saniyede bir sorulur. Bu sırada işin canlılık sinyali gönderilir.
  - Dosya yalnızca `https://storage.googleapis.com` adresinden, SSRF kurallarıyla ve 512 MB sınırıyla indirilir.
  - Sıra: koleksiyonlar, ürünler, müşteriler, siparişler, sayfalar, bloglar.
- **Kısıtlama:** kısıtlanan çağrı (`THROTTLED`) bir saniye bekleyip yeniden gönderilir.

## Eşleme

| Shopify                         | Platform                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| Koleksiyon                      | Kategori (tek seviye), eski adres `/collections/{handle}`                |
| Ürün satıcısı (`vendor`)        | Marka (büyük-küçük harf farkı tek marka)                                 |
| Ürün                            | Ürün; ACTIVE yayında, diğerleri (taslak, arşiv, listelenmemiş) taslak     |
| Ürün tanıtıcısı                 | Platformun slug kuralına çevrilir; eski adres `/products/{handle}` 301 için |
| "Title / Default Title" seçeneği | Atılır (seçeneksiz ürün)                                                 |
| Varyant ağırlığı                | Grama çevrilir; ölçü Shopify'da yok (varsayılan paket ya da taslak)       |
| Üstü çizili fiyat               | Taşınmaz (ADR-0042 uygulama notu 4)                                      |
| Müşteri adresi                  | Yalnızca Türkiye adresleri                                               |
| E-posta / SMS izni              | Yalnızca `SUBSCRIBED` ve tarihliyse, o tarihle                           |
| Sipariş                         | Geçmiş sipariş; durum Türkçe ("Gönderildi", "İptal edildi" …)             |
| Sayfa, blog, yazı               | Eski adres (`/pages/…`, `/blogs/…`), yönlendirme kararı için (F14.7)     |
| Yorum                           | Shopify'ın kendi yorumu yok; bir uygulamanın yorumları geçiş paketiyle    |

- **Para birimi:** mağaza TRY dışında satıyorsa taşıma hiçbir şey okunmadan reddedilir. Fiyat asla çevrilmez.
- **Kaynak kimliği:** `shopify:<mağaza-adresi>`. Tekrarsızlık bu kimlik ve Shopify'ın genel kimlikleriyle (`gid://shopify/...`) sağlanır.

## Geliştirme ve test

- `pnpm dev:shopify`: sahte mağaza `http://127.0.0.1:9107`. Backend `SHOPIFY_BASE_URL` ile başlatılır.
  - Bu değişken staging ve production'da reddedilir.
  - Sahte değerler betiğin çıktısında yazar.
- Sahte sunucu şunları taklit eder:
  - Client credentials anahtarı ve `shop_not_permitted`.
  - `THROTTLED` yanıtı.
  - Toplu sorgunun ilk yoklamada `RUNNING`, sonra `COMPLETED` dönmesi ve JSONL dosyası.
- Testler:
  - `src/lib/migration/shopify/__tests__/` (eşleyiciler, istemci).
  - `integration-tests/http/migration-shopify.spec.ts` (bağlantı, kuru ve gerçek çalıştırma, ikinci çalıştırmada tekrarsızlık, para birimi reddi).

## Gerçek mağazayla denenecekler

- `barcode` alanı 2026-10'da kullanımdan kalkmış ama çalışıyor. Bir sonraki sürüme geçerken `barcodes` bağlantısına geçilir (sorgu başı beş bağlantı sınırına dikkat).
- Kısıtlama yanıtının tam gövdesi resmî sayfada yok; sahte sunucu `errors[].extensions.code = "THROTTLED"` döner.
- Büyük mağazada dosya boyutu (sipariş dosyası 512 MB'ı geçerse taşıma parça parça yapılır; G9'da akışlı okuma değerlendirilecek).
