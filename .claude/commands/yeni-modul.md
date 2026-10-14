---
description: Medusa v2 özel modül iskeleti oluştur
argument-hint: <modul-adi kebab-case>
---
Modül: $ARGUMENTS

1. Context7 ile güncel Medusa v2 modül yapısını doğrula (model.define, MedusaService, Module).
2. `apps/backend/src/modules/$ARGUMENTS/` altında oluştur:
   - `models/` (alanlar, indeksler, soft delete)
   - `service.ts` (MedusaService tabanlı, ek metotlar ince)
   - `index.ts` (Module export, modül adı sabiti)
   - `__tests__/` (moduleIntegrationTestRunner ile temel CRUD testi)
3. `medusa-config.ts` içine modülü kaydet.
4. Başka modüllerle ilişki gerekiyorsa `src/links/` altında link tanımı öner.
5. Migration üret komutunu belirt (`medusa db:generate $ARGUMENTS`), çalıştırmadan önce sor.
6. Sektöre özel isim veya mantık kullanma.
