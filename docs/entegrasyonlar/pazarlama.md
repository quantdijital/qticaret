# Pazarlama Entegrasyonları: Feed'ler ve Sunucu Taraflı Dönüşüm

> Güncel şema ve API'leri resmi dokümanlardan doğrula. Aşağıdakiler tasarım rehberidir.

## Ürün feed'leri (`marketing-feeds`)
| Hedef | Format | Not |
|---|---|---|
| Google Merchant Center | XML feed + **Merchant API** push | GTIN/marka/durum alanları; fiyat KDV dahil; Content API for Shopping 18 Ağustos 2026'da kapandı, kullanılmaz |
| Meta katalog | CSV/XML | Varyantlar `item_group_id` ile gruplanır |
| Akakçe, Cimri vb. | Her birinin XML şeması | Şema farkları adaptörde |

- Ortak arayüz: `FeedFormatter` (ürün → hedef formatı). Yeni hedef = yeni formatter.
- Üretim worker'da, periyodik job ile; çıktı S3'e, tahmin edilemez (imzalı veya gizli token'lı) URL ile sunulur.
- Stokta olmayan, yayında olmayan ve kısıtlı kategorideki (F13.4) ürünler varsayılan olarak dışarıda.
- Feed'deki fiyat/stok/GTIN, ürün sayfasındaki JSON-LD (F3.12) ile **aynı kaynaktan** üretilir; Google otomatik ürün güncellemeleri bu eşleşmeye bakar (docs/13 §10).
- Feed URL'leri tahmin edilemez token'lı; Merchant API push ile feed dosyasına bağımlılık azalır.
- Görsel, fiyat ve stok değişince bir sonraki üretimde güncellenir; tam yeniden üretim yerine artımlı olabilir.

## Sunucu taraflı dönüşüm olayları
| Hedef | Olaylar |
|---|---|
| Meta Conversions API | Purchase, (ileride) AddToCart, InitiateCheckout |
| GA4 Measurement Protocol | purchase, refund |

- Tetikleyici: `order.placed`, iade tamamlandı → subscriber → workflow (worker'da).
- **Çerez onayı (F13.8) yoksa olay gönderilmez.**
- E-posta/telefon gibi alanlar sağlayıcının istediği şekilde normalize edilip SHA-256 ile hash'lenir; ham hali loglanmaz.
- Storefront'taki tarayıcı olaylarıyla mükerrer sayımı önlemek için ortak `event_id` kullanılır.
- Tenant kimlik bilgileri (pixel ID, access token, measurement ID/secret) env/secret olarak gelir (adr/0002).

## Env
`META_PIXEL_ID`, `META_CAPI_TOKEN`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`
