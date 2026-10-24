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

## Doğrudan taşıyıcı adaptörleri (F7.14)
Geliver bir aracıdır (komisyon + tek nokta bağımlılığı). Aynı `AbstractFulfillmentProviderService` arayüzüyle doğrudan kargo firması modülleri
(`fulfillment-yurtici`, `fulfillment-aras`, `fulfillment-mng`, `fulfillment-ptt`, `fulfillment-surat`) eklenir; ilk müşterinin anlaşmalı firması F7.14'te yazılır.
- Her taşıyıcı adaptörü ortak contract test paketini (F6.4 deseni) ve durum eşleme tablosunu kullanır.
- Takip: taşıyıcı webhook'u varsa kullanılır, yoksa polling job'u (F7.6).
- Etiket PDF/ZPL üretimi taşıyıcıdan gelir; yoksa biz üretiriz (şablon).
- Tenant birden fazla taşıyıcıyı aynı anda kullanabilir; kargo kuralları (F7.8) seçimi yapar.
- Tüm etiket/irsaliye dosyaları private depolamada, presigned erişimle (kişisel veri içerir).
