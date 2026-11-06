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
- Açıklama alanı ürünün açıklamasıdır; boşsa kısa açıklamanın düz metni (adr/0055 Ek 2026-11-06). Hedeflerin hiçbirinde ayrı kısa açıklama/özet alanı yok (Google, Meta, Akakçe, Cimri şemaları). Uzun metin her hedefin sınırında (Google 5000, Meta 9999, Akakçe/Cimri 5000; başlık 150/200) kelime sınırında kesilip `…` ile biter; Merchant API aynı kesimi kullanır.
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
- Storefront'taki tarayıcı olaylarıyla mükerrer sayımı önlemek için ortak kimlik kullanılır: sipariş kimliği (Meta `event_id`, GA4 `transaction_id`); aşağıdaki "Vitrin olayları"na bakın.
- Tenant kimlik bilgileri (pixel ID, access token, measurement ID/secret) panelden girilir, gizli olanlar `integration-credentials`'ta şifreli durur (adr/0027).

## Vitrin (tarayıcı) olayları: GA4 etiketi ve Meta pikseli

Kod: `apps/storefront/src/lib/analytics` (adr/0046 Ek 2026-11-06 "dönüşüm olayları"). Kimlikler panelden (Pazarlama > Google Analytics 4: ölçüm kimliği `G-…`; Meta: piksel kimliği) girilir; vitrin onları `GET /store/seo/site` `tracking`'den okur.

| Sayfa / an | GA4 | Meta |
|---|---|---|
| her rota | `page_view` | `PageView` |
| kategori, marka, arama, mağaza listesi | `view_item_list` (`item_list_id/name`, sıra) | — |
| listede karta tıklama | `select_item` | — |
| arama (ilk, süzülmemiş sayfa) | `search` | `Search` |
| ürün sayfası | `view_item` | `ViewContent` |
| sepete ekleme (her yoldan: ürün, hızlı ekle, çekmece, sepet +) | `add_to_cart` | `AddToCart` |
| sepetten çıkarma / adet azaltma | `remove_from_cart` | — |
| sepet sayfası | `view_cart` | — |
| ödeme sayfası (sepet başına bir kez) | `begin_checkout` | `InitiateCheckout` |
| kargo seçildi | `add_shipping_info` (`shipping_tier`) | — |
| ödeme yolu seçilip gönderildi | `add_payment_info` (`payment_type`) | `AddPaymentInfo` |
| teşekkür sayfası (`?yeni=1`, sipariş başına tarayıcıda bir kez) | `purchase` (`transaction_id` = sipariş kimliği) | `Purchase` (`eventID` = sipariş kimliği) |
| e-posta doğrulandı | `sign_up` | `CompleteRegistration` |

- **Para:** `currency: "TRY"`, KDV dahil; fiyatlar sunucunun: ürün/listede `price-display` (otomatik kampanya dahil), sepet ve ödemede satırın sunucu toplamı / adet, satın almada sipariş toplamı (kargo dahil) ve birim fiyat, backend'in sunucu olayıyla aynı. Öğe kimliği varyantınki (listede ürünün).
- **İzin:** GA4 yalnız `analytics`, Meta yalnız `marketing` onayıyla; yanıt yokken ya da eski politikadayken hiçbir betik yüklenmez, CSP host'ları yalnız kimlik bağlıyken açılır, betikler yanıtın nonce'uyla ve sayfa yüklendikten sonra boşta eklenir. Onay verilmeden önceki olaylar sonradan gönderilmez. Consent Mode v2 varsayılanı `denied`; `ad_*` yalnız pazarlama onayıyla `granted`. İzin geri alınınca etiket durur, çerezleri (`_ga*`, `_fbp`, `_fbc`) ve vitrinin tuttukları silinir.
- **Mükerrer sayım yok:** sunucu olayları (yukarıda) ve tarayıcı aynı sipariş kimliğini kullanır. Meta `Purchase`'ı aynı `event_name` + `event_id` ile tekilleştirir; GA4 aynı `transaction_id`'li satın almaları tekilleştirir. Misafir siparişinin adresi `?token=` taşıdığından Meta pikseli o sayfada olay göndermez (satın alma Meta'ya sunucudan gider).

### Mağaza sahibi olayları nasıl görür (gerçek kimlikler girildikten sonra)

1. Vitrinde çerez bandında "Tümünü kabul et"i seçin (onaysız hiçbir etiket yüklenmez).
2. **GA4:** [Tag Assistant](https://tagassistant.google.com/) ile vitrin adresine bağlanın; bu, hata ayıklama modunu açar. GA4 > Yönetici > Veri görünümü > **DebugView**'de olaylar (`view_item`, `add_to_cart`, `purchase` …) parametreleriyle saniyeler içinde görünür. Gerçek zamanlı rapor da sayar; standart raporlar 24–48 saat gecikir.
3. **Meta:** Events Manager > veri kaynağı (piksel) > **Test Events** > "Web sitesi"ne vitrin adresini yazıp "Web sitesini aç"; açılan sekmedeki olaylar listede görünür. Sunucu olayı (`Purchase`) için Conversions API test kodu backend tarafındadır; tekilleştirme Events Manager'da "Yinelenenler kaldırıldı" olarak görünür.
4. Geliştirmede gerçek kimlik yoktur: vitrin birim testleri olayları sahte `gtag`/`fbq` kuyruklarında doğrular (`lib/analytics/__tests__`); tarayıcı denetimi Store API'nin `tracking` yanıtını sahte kimlikle dönen bir ara katmanla ve etiket betikleri Playwright'ta yakalanarak yapıldı.

## Env
`META_PIXEL_ID`, `META_CAPI_TOKEN`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`
