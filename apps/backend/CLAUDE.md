# apps/backend — Medusa v2

## Klasörler (Medusa konvansiyonu — dışına çıkma)

- `src/modules/<ad>/` — özel modüller ve module provider'lar (models, service.ts, index.ts, migrations)
- `src/workflows/<alan>/` — workflow'lar; `steps/` alt klasöründe adımlar
- `src/api/admin/...`, `src/api/store/...`, `src/api/hooks/...` — route.ts dosyaları; `middlewares.ts`
- `src/subscribers/` — event dinleyicileri (ince; workflow çağırır)
- `src/jobs/` — zamanlanmış işler
- `src/links/` — modüller arası link tanımları
- `src/admin/widgets`, `src/admin/routes` — admin genişletmeleri
- `integration-tests/` — http ve modül testleri

## Kurallar

- Provider'lar `AbstractPaymentProvider`, `AbstractFulfillmentProviderService`, `AbstractNotificationProviderService` üzerinden.
- Modüller izoledir: bir modül başka modülün servisini doğrudan çağırmaz. Çapraz iş = workflow + link.
- Module provider'lar da izoledir: sadece kendi modülünün container'ına erişir. Mağazanın sağlayıcı hesabını (`integration-credentials`) çağrı anında `@medusajs/framework`'ün paylaşılan `container`'ından okur (adr/0027); hesap bilgisi `data`'ya ya da `context`'e konmaz. Dar istisnalar (adr/0027 ek, 2026-10-27): iyzico sağlayıcısı iade defterine (`order-refunds`) iade parçalarını yazar ve `payment-recovery`'yi okur; Geliver kargo sağlayıcısı mağazanın ağırlık/ölçü birimlerini ve desi ücret tablosunu (`platform-settings` `store`, `shipping`) okur (adr/0031); başka modül erişimi yok.
- Route'larda `validateAndTransformBody` + Zod şeması zorunlu.
- Dış API istemcileri `src/lib/clients/` altında, timeout + retry + log redaksiyonu ile.
- Tutar dönüşümleri (ör. iyzico'nun string tutarı) sadece provider sınırında yapılır.
- Yeni modül → `/yeni-modul`, yeni provider → `/entegrasyon-provider` komutunu kullan.
