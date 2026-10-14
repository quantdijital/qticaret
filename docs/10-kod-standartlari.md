# 10 — Kod Standartları

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`. `any` yasak (zorunluysa `unknown` + daraltma).
- Dış servis yanıtları Zod ile parse edilir; tip "güvenmek" yerine doğrulanır.
- Enum yerine `as const` nesneler + union tipler.
- Para tutarları için tek yardımcı modül (`lib/money`); float aritmetiği yok, ondalık kütüphanesi veya tam sayı (kuruş) kullan.

## Medusa desenleri
```ts
// Workflow: dış çağrı + compensation
const createShipmentStep = createStep(
  "create-shipment",
  async (input: Input, { container }) => {
    const shipment = await provider.create(input)
    return new StepResponse(shipment, shipment.id) // ikinci arg: compensation girdisi
  },
  async (shipmentId, { container }) => {
    if (shipmentId) await provider.cancel(shipmentId)
  }
)
```
- Workflow ve step adları kebab-case, benzersiz, alan önekli: `invoice-create-for-order`.
- Subscriber'lar sadece workflow tetikler; iş mantığı içermez.
- Scheduled job'lar idempotent ve kilitli.

## Hata yönetimi
- Sağlayıcı hataları `ProviderError` ile sarılır: `{ provider, code, retryable, safeMessage }`.
- Kullanıcıya `safeMessage` (Türkçe, i18n), loga tam bağlam (redakte).
- `catch` edip yutmak yasak; ya ele al ya yeniden fırlat.

## Loglama
- `logger.info({ event, orderId, provider }, "mesaj")` — yapılandırılmış alanlar.
- Kişisel veri ve secret loglanmaz. Redaksiyon listesi: authorization, apiKey, secretKey, merchant_key,
  merchant_salt, cardNumber, tckn, identityNumber, password, token.

## İsimlendirme
- Dosya: `kebab-case.ts`; bileşen: `PascalCase.tsx`; fonksiyon/değişken: `camelCase`; sabit: `UPPER_SNAKE`.
- Boolean: `is/has/can` öneki.
- Kod ve commit İngilizce; UI metinleri i18n (tr varsayılan); dokümanlar Türkçe.

## Git
- Conventional commits: `feat(payment-iyzico): add partial refund`
- Küçük, tek amaçlı commit'ler. PR başına bir görev.
- PR şablonu: amaç, değişiklikler, test kanıtı, güvenlik etkisi, ilgili KK.

## Yapma listesi
- Medusa çekirdek dosyalarını patch'leme
- Modülden modüle doğrudan servis çağrısı
- Route içinde iş mantığı
- Request yolunda senkron ağır iş
- Sektöre özel `if` (`if (store.sector === "knife")`)
- Testsiz ödeme/kargo/fatura kodu
- Hafızadan Medusa API'si — Context7 ile doğrula
