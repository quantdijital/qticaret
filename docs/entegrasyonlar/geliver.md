# Geliver Fulfillment Provider

> Doküman: docs.geliver.io. Resmi SDK'lar mevcut; Node/TS SDK yoksa REST + OpenAPI'den tip üret.

## Medusa metot eşlemesi
| Medusa | Geliver | Not |
|---|---|---|
| getFulfillmentOptions | — | Statik seçenekler: standart, hızlı, (tenant ayarına göre) kapıda ödeme |
| validateFulfillmentData / validateOption | — | Seçenek ve adres doğrulama |
| canCalculate / calculatePrice | Teklif alma | Desi = (en×boy×yük)/3000 vs ağırlık, büyüğü; cache'li |
| createFulfillment | Gönderi oluştur + teklif kabul | Etiket PDF → S3; tracking no fulfillment data'ya |
| cancelFulfillment | İptal | |
| createReturnFulfillment | İade gönderisi | İade kodu müşteriye bildirilir |

## Takip
- Prod: webhook (`POST /hooks/geliver`), doğrulama + idempotency.
- Test ortamında takip durumu sorgu ile ilerler; polling job'u bu davranışla test edilir.
- Takip numarası teklif kabulünde hemen oluşmayabilir; paket şubeye verildiğinde dolar → UI bunu "bekleniyor" olarak gösterir.

## Durum eşlemesi
Sağlayıcı durumları → iç enum: `created`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `returned`, `failed`.

## Env
`GELIVER_API_TOKEN`, `GELIVER_BASE_URL`, `GELIVER_WEBHOOK_SECRET` (varsa)

## Gelecek
Doğrudan kargo firması entegrasyonları (Yurtiçi, Aras, MNG) aynı provider arayüzüyle ayrı modüller olarak eklenir.
