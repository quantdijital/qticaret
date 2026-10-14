# 07 — Test Stratejisi

## Piramit
| Seviye | Araç | Kapsam |
|---|---|---|
| Unit | Jest/Vitest | Mapper'lar, hash/imza, tutar dönüşümü, desi hesabı, kurallar |
| Modül entegrasyon | Medusa test-utils (`moduleIntegrationTestRunner`) | Özel modül servisleri + DB |
| HTTP entegrasyon | Medusa test-utils (`medusaIntegrationTestRunner`) | API route + workflow + mock sağlayıcı |
| Contract | Ortak test paketi | Her payment/fulfillment provider aynı sözleşmeyi sağlar |
| E2E (admin) | Playwright | Kritik admin akışları (smoke) |
| Yük | k6 | F10 |

## Kurallar
- Dış servisler testte **asla** gerçek çağrılmaz. `packages/testing` altında mock sunucular (msw veya küçük HTTP sunucu):
  iyzico, PayTR, Geliver, e-fatura, SMS.
- Sandbox testleri ayrı etiketli (`@sandbox`) ve CI'da manuel tetiklenir; secret gerektirir.
- Her bug fix bir regresyon testiyle gelir.
- Kapsam hedefleri: ödeme/kargo/fatura modülleri ≥ %80, diğerleri ≥ %60.
- Fixture fabrikaları: `packages/testing/factories` (müşteri, sepet, sipariş, adres — gerçekçi TR verisi, sahte TCKN algoritmik geçerli).
- Test adları davranışı anlatır: `"kısmi iadede sadece seçilen kalemlerin transaction ID'si kullanılır"`.

## Zorunlu senaryolar (ödeme)
- Başarılı tek çekim / taksit
- 3DS başarısız, kullanıcı iptal, zaman aşımı
- Mükerrer callback / webhook
- İstemci tutar manipülasyonu
- Tam iade, kısmi iade, aynı gün iptal
- Sağlayıcı 5xx → retry → yedek sağlayıcı (F4)

## Zorunlu senaryolar (kargo)
- Ölçü eksik ürün, adres hatası, sağlayıcı teklif vermiyor
- Webhook + polling çakışması
- İptal edilmiş gönderiye gelen takip güncellemesi

## Zorunlu senaryolar (fatura)
- Bireysel/kurumsal ayrımı, mükellef sorgusu hatası
- Entegratör kapalı → retry → başarılı
- Mükerrer fatura engeli
