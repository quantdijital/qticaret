---
description: Payment / fulfillment / notification provider iskeleti
argument-hint: <payment|fulfillment|notification> <ad>
---
Argümanlar: $ARGUMENTS

1. İlgili dokümanı oku: `docs/entegrasyonlar/<ad>.md`.
2. Context7 ile ilgili abstract sınıfı ve zorunlu metotları doğrula
   (AbstractPaymentProvider / AbstractFulfillmentProviderService / AbstractNotificationProviderService).
3. Oluştur: `index.ts` (ModuleProvider), `service.ts`, `client.ts` (lib/clients tabanlı), `mappers.ts`,
   `webhook.ts` (gerekirse), `types.ts` (Zod şemaları), `__tests__/`.
4. `packages/testing/mocks/<ad>` altında mock sunucu iskeleti.
5. Provider ortak contract test paketine bağla.
6. Env değişkenlerini env şemasına ve `.env.example`'a ekle (değer yazmadan).
7. `healthCheck()` metodu ekle (entegrasyonlar sayfası için).
8. İlk aşamada metotları TODO ile bırakma; en az initiate/create yolunu testle birlikte bitir.
