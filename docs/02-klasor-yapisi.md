# 02 — Klasör Yapısı

```
repo/
├── CLAUDE.md
├── PROGRESS.md
├── adr/
├── docs/
├── .claude/ (commands, agents, settings.json)
├── apps/
│   ├── backend/                    # Medusa v2 (API + worker + admin)
│   │   ├── CLAUDE.md
│   │   ├── medusa-config.ts
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── payment-iyzico/
│   │   │   │   │   ├── index.ts            # ModuleProvider(Modules.PAYMENT, ...)
│   │   │   │   │   ├── service.ts          # AbstractPaymentProvider
│   │   │   │   │   ├── client.ts           # iyzico HTTP/SDK sarmalayıcı
│   │   │   │   │   ├── mappers.ts          # Medusa ⇄ iyzico veri dönüşümleri
│   │   │   │   │   ├── webhook.ts          # imza doğrulama + action eşleme
│   │   │   │   │   ├── types.ts
│   │   │   │   │   └── __tests__/
│   │   │   │   ├── payment-paytr/
│   │   │   │   ├── fulfillment-geliver/
│   │   │   │   ├── notification-sms/
│   │   │   │   ├── notification-email/
│   │   │   │   ├── einvoice/
│   │   │   │   │   ├── models/ service.ts index.ts
│   │   │   │   │   └── adapters/ (nilvera.ts, ...)   # InvoiceAdapter arayüzü
│   │   │   │   ├── platform-settings/
│   │   │   │   ├── product-attributes/
│   │   │   │   ├── legal-consent/
│   │   │   │   ├── audit-log/
│   │   │   │   └── tr-address/
│   │   │   ├── workflows/
│   │   │   │   ├── payment/  fulfillment/  invoice/  notification/  legal/
│   │   │   │   └── <alan>/steps/
│   │   │   ├── api/
│   │   │   │   ├── middlewares.ts
│   │   │   │   ├── admin/<kaynak>/route.ts
│   │   │   │   ├── store/<kaynak>/route.ts
│   │   │   │   └── hooks/<saglayici>/route.ts     # webhook'lar
│   │   │   ├── subscribers/
│   │   │   ├── jobs/
│   │   │   ├── links/
│   │   │   ├── admin/
│   │   │   │   ├── widgets/
│   │   │   │   ├── routes/
│   │   │   │   ├── components/      # admin'e özel paylaşılan bileşenler
│   │   │   │   ├── hooks/           # react-query hook'ları
│   │   │   │   └── i18n/            # tr.json, en.json
│   │   │   ├── lib/
│   │   │   │   ├── clients/         # http istemci tabanı (timeout, retry, redaksiyon)
│   │   │   │   ├── crypto/          # imza/HMAC yardımcıları
│   │   │   │   ├── money/           # tutar dönüşümleri
│   │   │   │   └── errors/          # ortak hata tipleri
│   │   │   └── scripts/             # seed, tr-address import, tenant bootstrap
│   │   └── integration-tests/
│   │       ├── http/  modules/  fixtures/
│   └── storefront/                  # F13 — ŞİMDİ BOŞ
├── packages/
│   ├── types/                       # paylaşılan tipler (Store API sözleşmeleri)
│   ├── config/                      # eslint, tsconfig, prettier
│   └── testing/                     # mock sunucular (iyzico/geliver sahte API), fixture fabrikaları
├── infra/
│   ├── docker/                      # Dockerfile'lar, compose (dev)
│   ├── tenant/                      # tenant şablonu, provisioning scriptleri
│   └── observability/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Kurallar
- **Feature/alan bazlı** klasörleme. `utils/` çöplüğü yok; `lib/` altında amaca göre klasör.
- Bir modülün içi kendi kendine yeter: tipleri, mapper'ları, testleri yanında durur.
- `index.ts` sadece dışa açılanları export eder.
- Dosya ~300 satırı geçerse böl; fonksiyon ~50 satırı geçerse böl.
- Dosya adları `kebab-case.ts`, React bileşenleri `PascalCase.tsx`.
- Test dosyası test edilen koda en yakın yerde (`__tests__/`), entegrasyon testleri `integration-tests/`.
