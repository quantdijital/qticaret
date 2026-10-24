# Muhasebe Entegrasyonu ve Dış API

> Hedef programların güncel API'lerini resmi dokümanlardan doğrula. Format kuralları mali müşavirle teyit edilir.

## `accounting` modülü
`einvoice` modülüyle aynı desen: model + iş mantığı modülde, programa özel kısım adaptörde.
```ts
interface AccountingAdapter {
  upsertCustomer(input: CustomerInput): Promise<ExternalRef>   // cari kart
  pushSale(input: SaleInput): Promise<ExternalRef>             // satış / fatura kaydı
  pushPayment(input: PaymentInput): Promise<ExternalRef>       // tahsilat
  pushReturn(input: ReturnInput): Promise<ExternalRef>         // iade
  healthCheck(): Promise<HealthStatus>
}
```
- Adaptör adayları: Paraşüt, Logo, Mikro (ilk adaptör tenant talebine göre seçilir).
- `accounting_sync` kaydı: kaynak (sipariş/iade/tahsilat), external_ref, status, attempt_count, last_error.
  Unique: (kaynak tipi, kaynak id, adaptör) → mükerrer aktarım yok.
- Tetik: fatura kesildiğinde (F8) veya tenant ayarına göre günlük toplu aktarım (job).
- Hata → retry (artan aralık) → dead-letter + admin uyarısı; sipariş akışı asla bloklanmaz.

## Tenant dış API'si
- Medusa'nın secret API key mekanizması kullanılır (Context7 ile doğrula); kendi anahtar sistemi yazılmaz.
- Anahtar oluşturma/iptal audit log'a düşer; anahtar yalnızca oluşturulduğu anda bir kez gösterilir.
- Rate limit anahtar başına.
- OpenAPI dokümanı `packages/types` sözleşmesinden üretilir.

## Giden webhook'lar (`tenant-webhooks`)
- Abonelik: URL + olay listesi + imza secret'ı (secret yalnızca oluşturulurken gösterilir).
- Gövde imzası: `X-Signature: HMAC-SHA256(secret, timestamp + "." + body)`; alıcının replay'i engelleyebilmesi için timestamp.
- Teslim worker'da; 2xx dışı yanıt → artan aralıkla retry → N denemede devre dışı + admin uyarısı.
- Teslim logu (durum kodu, süre, deneme) saklanır; gövdedeki kişisel veri logda maskelenir.
- Hedef URL'de SSRF koruması: özel/iç IP aralıkları reddedilir.

## Env
`ACCOUNTING_PROVIDER`, `ACCOUNTING_API_KEY`, `ACCOUNTING_BASE_URL` (adaptöre göre ek alanlar)
