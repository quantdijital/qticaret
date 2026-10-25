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
│   │   │   │   ├── payment-bank-transfer/
│   │   │   │   ├── payment-cod/
│   │   │   │   ├── fulfillment-geliver/  fulfillment-<tasiyici>/   # doğrudan taşıyıcı adaptörü (F7.14)
│   │   │   │   ├── notification-sms/
│   │   │   │   ├── notification-email/
│   │   │   │   ├── einvoice/
│   │   │   │   │   ├── models/ service.ts index.ts
│   │   │   │   │   ├── ubl/                          # UBL-TR üretimi (bizde)
│   │   │   │   │   ├── taxpayers/                    # GİB mükellef listesi job'u
│   │   │   │   │   └── adapters/ (nilvera.ts, ...)   # InvoiceAdapter: imza + iletim
│   │   │   │   ├── platform-settings/
│   │   │   │   ├── product-attributes/
│   │   │   │   ├── legal-consent/
│   │   │   │   ├── audit-log/
│   │   │   │   ├── tr-address/
│   │   │   │   ├── url-registry/                     # (locale, path) unique; claim/release/resolve (F2.11)
│   │   │   │   ├── seo-redirects/  seo-advisor/ (rules/<alan>/<id>.ts)  seo-insights/  brands/  content/
│   │   │   │   ├── price-history/  product-qa/
│   │   │   │   ├── wishlist/  back-in-stock/  product-reviews/  marketing-feeds/
│   │   │   │   ├── accounting/                       # adapters/ (parasut.ts, ...)
│   │   │   │   ├── tenant-webhooks/  fraud-guard/
│   │   │   │   └── data-migration/                   # sources/ (shopify.ts, ticimax.ts, ...)
│   │   │   ├── workflows/
│   │   │   │   ├── payment/  fulfillment/  invoice/  notification/  legal/
│   │   │   │   ├── catalog/  seo/  inventory/  promotion/  returns/  exchanges/  marketing/  reports/  accounting/
│   │   │   │   └── <alan>/steps/
│   │   │   ├── api/
│   │   │   │   ├── middlewares.ts
│   │   │   │   ├── http/                       # istek ID'si, error handler, rate limit, CSRF, header'lar, upload kontrolü
│   │   │   │   │   └── audit/                  # denetim kaydı: mutasyon/okuma middleware'leri, kaynak kayıt defteri (adr/0011)
│   │   │   │   ├── validation/                 # core route'lara eklenen doğrulama middleware'leri
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
│   │   │   │   ├── clients/         # http istemci tabanı (timeout, retry, devre kesici, redaksiyon)
│   │   │   │   ├── integrations/    # health/: /admin/integrations/health kontrolleri
│   │   │   │   ├── crypto/          # imza/HMAC yardımcıları
│   │   │   │   ├── security/        # safe-fetch (SSRF), upload validator, csv-escape, safe-xml
│   │   │   │   ├── seo/             # slug (TR), başlık şablonları, piksel genişliği, jsonld builders (F3.12)
│   │   │   │   ├── money/           # tutar dönüşümleri
│   │   │   │   ├── errors/          # ortak hata tipleri
│   │   │   │   └── logging/         # pino logger, redaksiyon, istek bağlamı, Medusa logger adaptörü
│   │   │   └── scripts/             # seed, tr-address import, tenant bootstrap
│   │   └── integration-tests/
│   │       ├── http/  modules/  fixtures/
│   └── storefront/                  # F18 — ŞİMDİ BOŞ
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
