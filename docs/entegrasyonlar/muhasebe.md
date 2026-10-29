# Muhasebe Entegrasyonu ve Dış API

> Hedef programların güncel API'lerini resmi dokümanlardan doğrula. Format kuralları mali müşavirle teyit edilir.

## `accounting` modülü
`einvoice` modülüyle aynı desen: model + iş mantığı modülde, programa özel kısım adaptörde.
```ts
interface AccountingAdapter {
  upsertCustomer(input: CustomerInput): Promise<ExternalRef>   // cari kart
  pushSale(input: SaleInput): Promise<ExternalRef>             // satış / fatura kaydı
  cancelSale(input: CancelInput): Promise<ExternalRef>         // aktarılmış satışın iptali
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
- **Uygulama (F11 R5, 2026-10-29):** `src/modules/accounting`, `src/lib/accounting` (arayüz, sahte program), `src/workflows/accounting`, `src/jobs/accounting-sync.ts`, `src/subscribers/accounting-queue.ts`. Ayrıntı ve kurallar: adr/0039 "Muhasebe: uygulama" ve "Kapanış güvenlik incelemesi" (tek tek sahiplenme, iptal ve atlama, saatlik tarama). Satış kaydı şimdilik sipariş verildiğinde kuyruğa girer; F8 gelince fatura kesildiğinde girecek.

## Tenant dış API'si
- Medusa'nın secret API key mekanizması kullanılır (Context7 ile doğrula); kendi anahtar sistemi yazılmaz.
- Anahtar oluşturma/iptal audit log'a düşer; anahtar yalnızca oluşturulduğu anda bir kez gösterilir.
- Rate limit anahtar başına.
- OpenAPI dokümanı açık uçların kendi Zod şemalarından `z.toJSONSchema` ile üretilir (`GET /admin/openapi.json`; adr/0039 "Dış API: uygulama").
- **Uygulama (F11 R6, 2026-10-29):** anahtar varsayılan olarak hiçbir uca geçemez; yalnızca kapsamındaki uçlar açıktır (`orders:read`, `catalog:read`, `stock:write`, `webhooks:manage`). Anahtar `fields` gönderemez; her uç kendi alanlarını döner. Panelde Ayarlar > Dış API.

## Giden webhook'lar (`tenant-webhooks`)
- Abonelik: URL + olay listesi + imza secret'ı (secret yalnızca oluşturulurken gösterilir).
- Gövde imzası: `X-Signature: HMAC-SHA256(secret, timestamp + "." + body)`; alıcının replay'i engelleyebilmesi için timestamp.
- Teslim worker'da; 2xx dışı yanıt → artan aralıkla retry → N denemede devre dışı + admin uyarısı.
- Teslim logu (durum kodu, süre, deneme) saklanır; gövdedeki kişisel veri logda maskelenir.
- Hedef URL'de SSRF koruması: özel/iç IP aralıkları reddedilir.
- **Uygulama (F11 R7, 2026-10-29):** başlıklar `X-Webhook-Id`, `X-Webhook-Event`, `X-Webhook-Signature: t=<zaman>,v1=<imza>`. Olaylar `order.placed`, `order.canceled`, `order.fulfilled`, `return.requested`, `return.received`, `stock.changed`. Gövdede kişisel veri yok, teslim kaydında gövde tutulmuyor. Mağaza başına en çok 20 abonelik; anahtar yalnızca kendi aboneliklerini yönetir ve yalnızca okuma kapsamının verdiği olaylara abone olur. Ayrıntı: adr/0039 "Giden webhook'lar: uygulama" ve "Kapanış güvenlik incelemesi".

## Env
`ACCOUNTING_PROVIDER`, `ACCOUNTING_API_KEY`, `ACCOUNTING_BASE_URL` (adaptöre göre ek alanlar)
