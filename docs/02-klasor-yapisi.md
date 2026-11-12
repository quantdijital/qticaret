# 02 — Klasör Yapısı

```
repo/
├── CLAUDE.md
├── PROGRESS.md
├── adr/
├── docs/
├── .claude/ (commands, agents, settings.json)
├── apps/
│   ├── backend/                    # Medusa v2 (API + worker; Medusa Admin yalnızca platform ekibi için)
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
│   │   │   │   ├── payment-paytr/                    # provider (V2); PayTR API'si lib/payments/paytr'de
│   │   │   │   ├── integration-credentials/          # mağazanın sağlayıcı hesapları, şifreli, yalnız yazılır (F5, adr/0027)
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
│   │   │   │   ├── catalog-extension/                # ürün/varyant ek alanları: durum, tür, birincil kategori, halef, MPN (F3.1)
│   │   │   │   ├── legal-consent/
│   │   │   │   ├── audit-log/
│   │   │   │   ├── tr-address/
│   │   │   │   ├── url-registry/                     # (locale, path) unique; claim/release/resolve (F2.11)
│   │   │   │   ├── seo-meta/                         # sayfanın kendi SEO alanları (F3.4, adr/0015)
│   │   │   │   ├── seo-redirects/                    # kurallar + 404 günlüğü, tamponlu sayaçlar (F3.5, adr/0017)
│   │   │   │   ├── seo-sitemaps/                     # üretilen site haritası dosyaları + yenileme durumu (F3.6)
│   │   │   │   ├── brands/                           # marka sayfası, logo, ürün ↔ marka link'i (F3.11)
│   │   │   │   ├── seo-advisor/                      # sayfa değerlendirmeleri; kurallar lib/seo/advisor'da (F3.13)
│   │   │   │   ├── media/                            # görsel kayıtları: alt metin, türevler (F3.3, adr/0016)
│   │   │   │   ├── stock-ledger/                     # stok hareket defteri (yalnız ekleme) + kalem eşiği/uyarı durumu (F3.8, adr/0020)
│   │   │   │   ├── price-history/                    # satıştaki fiyatın geçmişi (yalnız ekleme), indirim öncesi fiyat kuralının (10 gün) kaynağı (F4.2, adr/0023)
│   │   │   │   ├── content/                          # içerik sayfası, blog yazısı ve facet landing sayfası (parmak izi, özgünlük); gövde belge JSON'u (F3.16, adr/0019)
│   │   │   │   ├── seo-insights/
│   │   │   │   ├── price-history/  product-qa/
│   │   │   │   ├── wishlist/  back-in-stock/  product-reviews/  marketing-feeds/
│   │   │   │   ├── accounting/                       # adapters/ (parasut.ts, ...)
│   │   │   │   ├── tenant-webhooks/  fraud-guard/
│   │   │   │   └── data-migration/                   # sources/ (shopify.ts, ticimax.ts, ...)
│   │   │   ├── workflows/
│   │   │   │   ├── payment/  fulfillment/  invoice/  notification/  legal/
│   │   │   │   ├── catalog/  seo/  inventory/  promotion/  returns/  exchanges/  marketing/  reports/  accounting/
│   │   │   │   ├── hooks/                            # çekirdek workflow hook'ları; hook başına tek dosya, tek handler
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
│   │   │   ├── migration-scripts/   # db:migrate'te mağaza başına bir kez çalışan veri işleri (ör. stok açılış bakiyeleri)
│   │   │   ├── links/
│   │   │   ├── admin/
│   │   │   │   ├── widgets/
│   │   │   │   ├── routes/
│   │   │   │   ├── components/      # admin'e özel paylaşılan bileşenler
│   │   │   │   ├── hooks/           # react-query hook'ları
│   │   │   │   └── i18n/            # tr.json, en.json
│   │   │   ├── lib/
│   │   │   │   ├── clients/         # http istemci tabanı (timeout, retry, devre kesici, redaksiyon)
│   │   │   │   ├── integrations/    # health/: /admin/integrations/health kontrolleri; account-check (sağlayıcı hesabı doğru mu)
│   │   │   │   ├── payments/        # paytr/: imzalar, tutar biçimleri, err_no eşlemesi, istemci (F5, sağlayıcı ve uygulama birlikte kullanır)
│   │   │   │   ├── crypto/          # PII şifreleme (adr/0009), sağlayıcı sırlarının mühürlenmesi (adr/0027)
│   │   │   │   ├── security/        # safe-fetch (SSRF), rate-limit, upload validator, csv-escape, safe-xml, zip
│   │   │   │   ├── redis/           # kendi Redis istemcimiz (hızlı vazgeçen), tenant ad alanı
│   │   │   │   ├── cache/           # süreç içi değer + Redis sürüm sayacı (ayarlar, adr/0012)
│   │   │   │   ├── seo/             # slug (TR), başlık şablonları, piksel genişliği, URL desenleri, rezerv yollar, redirects/ (güvenli desen, normalize yol), jsonld (F3.12), advisor/ (kural motoru, puan)
│   │   │   │   ├── catalog/         # GTIN doğrulama, ölçü/ağırlık kuralı (F3.1), id parçalama (IN listeleri)
│   │   │   │   ├── sheets/          # xlsx okuyucu (güvenli zip/XML) + yazl ile akan xlsx yazıcı, CSV/xlsx tanıma (F3.9, adr/0018)
│   │   │   │   ├── catalog-sheet/   # ürün tablosunun sütunları, hücre okuma (TR sayı), satırları ürüne toplama (F3.9)
│   │   │   │   ├── media/           # görsel temizleme ve türevler (sharp, F3.3), ürün adından alt metin önerisi (F3.10)
│   │   │   │   ├── money/           # tutar dönüşümleri
│   │   │   │   ├── orders/          # sipariş satırlarının kuruş payları, kısmi iade tutarı (F4.7, ADR-0010)
│   │   │   │   ├── pricing/         # indirim gösterimi: indirimden önceki 10 günün en düşüğü, otomatik kampanyalar (F4.3, ADR-0023)
│   │   │   │   ├── promotions/      # kod biçimi (büyük harf, ASCII), tek kullanımlık ve hediye kartı kodları (F4.4–F4.8, ADR-0024/0025)
│   │   │   │   ├── dashboard/       # panel okuma modelleri: dönem, sipariş aşaması, özet/rapor, sipariş ve stok panosu (adr/0022)
│   │   │   │   ├── checkout/        # checkout kuralları: KDV için ülke, kargo gerekmeyen sepette kargo yöntemi yok (F3.2)
│   │   │   │   ├── stock/           # hareket nedeni, düşük stok eşikleri (F3.8)
│   │   │   │   ├── content/         # zengin metin: izin listesi şeması, HTML oluşturucu, metin/yapı okuyucu (adr/0019); originality (MinHash parmak izi, F3.16)
│   │   │   │   ├── notifications/   # yönetici bildirimlerinin sunucu metin kataloğu (feed kanalı)
│   │   │   │   ├── errors/          # ortak hata tipleri
│   │   │   │   └── logging/         # pino logger, redaksiyon, istek bağlamı, Medusa logger adaptörü
│   │   │   └── scripts/             # seed, tr-address import, tenant bootstrap, katalog yollarını claim etme (F3.1)
│   │   └── integration-tests/
│   │       ├── http/  modules/  fixtures/
│   ├── control-plane/               # üst panel (F17, adr/0061): Medusa 2.21.2, port 9100, `qticaret_cp`; modules/ (tenants, plans, billing, fleet, provisioning, vault, cp-staff, cp-audit), workflows/, api/admin/cp + api/tenant-api, lib/provisioning (TenantProvisioner, LocalProvisioner), jobs/, scripts/ (cp:*)
│   ├── control-plane-panel/         # üst panelin arayüzü (Vite, 5174; panelle aynı yapı, admin-ui'dan)
│   ├── panel/                       # yönetici paneli, bizim SPA'mız (adr/0022; yapı docs/18 §6)
│   └── storefront/                  # F18 vitrin, Next.js App Router (adr/0046): app/ rotalar, screens/ varlık türüne göre sayfalar, lib/ Store API istemcisi, SEO, sepet, i18n
├── packages/
│   ├── types/                       # paylaşılan tipler (Store API sözleşmeleri; vitrin için `src/store/`; üst panel ↔ mağaza sözleşmesi `src/control-plane/`: plan belgesi, kullanım raporu, imza başlıkları, durum ve limit kayıt defteri, adr/0061)
│   ├── server-kit/                  # iki sunucunun ortak kodu (adr/0061 Ek C1): kripto, zarf şifreleme, Ed25519 imzalı belge ve istek, redaksiyon, hata gövdesi ve kodla loglama, env yardımcıları, hız sınırı, TR vergi no; Medusa bilmez
│   ├── ui/                          # tema sözleşmesi, görünüm modelleri, ortak vitrin parçaları (adr/0046 §7)
│   ├── admin-ui/                    # panellerin ortak arayüzü: shadcn ilkelleri, desenler, token ve tema motoru, `admin-ui` metinleri (adr/0061 §1.4; docs/18 §6)
│   ├── themes/atolye/               # vitrin teması (tek ve varsayılan, yön "Grafit", design.md; adr/0057): yalnızca sunum
│   ├── sector-packs/                # sektör paketleri, yalnız veri (adr/0061 F17.7, Ek C12): `packs/<kod>/` (manifest.json + attributes/categories/flags/seo.json); `src/` paketleri okuyan yükleyici (çalışma anında `packs/`'ten okur, `qt-compiled` ile derlenir); içeriği backend kendi Zod şemalarıyla denetler
│   ├── config/                      # eslint, tsconfig, prettier
│   └── testing/                     # sahte sağlayıcı sunucuları (PayTR; iyzico V8, Geliver F7), TR fixture'ları (geçerli sahte TCKN/VKN), her çalıştırmada üretilen test sırları
├── infra/
│   ├── docker/                      # Dockerfile'lar, compose (dev)
│   ├── tenant/                      # tenant şablonu, provisioning scriptleri
│   ├── tenants/local/<slug>/        # yerel provisioner'ın mağaza klasörü (git dışı, 0700; `.env` 0600, logs/, pid; adr/0061 Ek C10)
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
