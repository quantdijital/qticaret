# 16 — Proje Haritası: Bugün Ne Nerede

> İnsan okuyucu içindir (proje sahibi). Amaç: "şu nerede, bunu nereden kontrol ederim?" sorusuna hızlı cevap.
> Yalnızca **bugün var olanı** anlatır. Terimler için [docs/11](11-ogrenme-rehberi.md); ileride gelecek
> klasörler dahil hedef yapı için [docs/02](02-klasor-yapisi.md). Yeni klasör veya önemli dosya eklendiğinde güncellenir.
>
> Son güncelleme: 2026-10-25, F2 bitti (S1–S13).

---

## 1. Repo'nun en üst katı

| Yol | Ne | Ne zaman bakarsın |
|---|---|---|
| [PROGRESS.md](../PROGRESS.md) | Ne bitti, sıradaki iş, açık sorular | Her oturum başı; "nerede kalmıştık?" |
| [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md) | Claude'un uyduğu proje kuralları (altın kurallar) | Bir kuralın neden öyle olduğunu merak ettiğinde |
| [docs/](.) | Mimari, güvenlik, SEO, test, yol haritası dokümanları | Bir konunun "doğrusu ne?" sorusu |
| [adr/](../adr) | Mimari kararlar ve gerekçeleri (0001–0014) | "Bunu neden böyle yaptık?" |
| [apps/backend/](../apps/backend) | **Tek uygulama**: Medusa sunucusu + admin paneli | Kodun %95'i burada |
| [packages/config/](../packages/config) | Ortak eslint, prettier, tsconfig ayarları | Kod biçimi kurallarını değiştirirken |
| [packages/types/](../packages/types) | Paylaşılan tipler (şimdilik yalnızca dil/locale) | Storefront gelince büyüyecek |
| [infra/docker/compose.dev.yml](../infra/docker/compose.dev.yml) | Yerel servisler: Postgres, Redis, Mailpit, SeaweedFS | Yerel ortam açılmıyorsa |
| [scripts/init-dev-env.sh](../scripts/init-dev-env.sh) | İlk kurulumda `.env` dosyalarını üretir (`pnpm env:init`) | Yeni bilgisayarda kurulum |
| [.github/workflows/](../.github/workflows) | CI: `ci.yml` (lint, tip, test, build, entegrasyon), `security.yml` (secret taraması, bağımlılık denetimi) | PR'da kırmızı çıktığında |
| [.claude/](../.claude) | Claude'un komutları ve inceleme ajanları (bkz. bölüm 8) | `/oturum-baslat` gibi komutların ne yaptığını görmek için |
| `.husky/`, `lint-staged.config.mjs`, `commitlint.config.mjs`, `.gitleaks.toml` | Commit anında çalışan kontroller (bkz. bölüm 7) | Commit reddedildiğinde |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json` | Monorepo tanımı ve kök komutlar | Yeni paket/komut eklerken |

`.env` dosyaları (`apps/backend/.env`, `infra/docker/.env`) gizli anahtarları tutar ve git'e girmez.
Hangi değişkenlerin olması gerektiğini `env.example` dosyaları ve [lib/env.ts](../apps/backend/src/lib/env.ts) gösterir.

---

## 2. Backend'in içi: `apps/backend/`

```
apps/backend/
├── medusa-config.ts        ← hangi modüller açık, CORS listeleri, logger (uygulamanın "ana şalteri")
├── jest.config.js          ← test türleri (unit / http / modules)
├── env.example             ← gereken ortam değişkenleri (değersiz)
├── static/                 ← yerelde yüklenen dosyalar (git'e girmez)
├── integration-tests/      ← gerçek sunucu açan testler (bölüm 6)
└── src/
    ├── api/                ← dışarıya açılan kapılar: route'lar ve middleware'ler
    ├── workflows/          ← iş akışları (çok adımlı işler, geri alınabilir)
    ├── modules/            ← kendi veri modüllerimiz (tablolar + servisleri)
    ├── links/              ← bizim modüllerle Medusa'nın modülleri arasındaki bağlar
    ├── subscribers/        ← olay dinleyicileri (ör. sıraya alınan işi başlatan)
    ├── jobs/               ← zamanlanmış işler (yarıda kalan işleri kapatma, eski sonuçları silme)
    ├── admin/              ← admin paneline eklediğimiz parçalar (widget, çeviri)
    ├── lib/                ← her yerden kullanılan yardımcı kütüphaneler
    └── scripts/            ← elle çalıştırılan işler (kurulum, demo veri, adres içe aktarma)
```

### 2.1 `src/modules/`: kendi tablolarımız
Medusa'nın ürün, sipariş ve müşteri gibi hazır modülleri `node_modules` içinde; burada yalnızca **bizim eklediklerimiz** var:

| Modül | Ne tutar | Faz |
|---|---|---|
| [tr-address](../apps/backend/src/modules/tr-address) | İl / ilçe / mahalle verisi, adres doğrulama | F1 |
| [billing-profile](../apps/backend/src/modules/billing-profile) | Müşterinin fatura bilgisi; TCKN/VKN şifreli | F1 |
| [url-registry](../apps/backend/src/modules/url-registry) | Hangi URL hangi ürüne/sayfaya ait; aynı URL iki kez verilemez | F2 S7 |
| [audit-log](../apps/backend/src/modules/audit-log) | Kim neyi ne zaman değiştirdi/gördü; yalnızca ekleme | F2 S8 |
| [platform-settings](../apps/backend/src/modules/platform-settings) | Mağaza ve SEO ayarları, özellik bayrakları (`features.ts`) | F2 S9 |
| [product-attributes](../apps/backend/src/modules/product-attributes) | Ürün özellik şablonları (malzeme, ölçü, beden gibi), tanımlar ve ürün değerleri | F2 S11 |
| [async-job](../apps/backend/src/modules/async-job) | Uzun işlerin kaydı: durum, ilerleme, sonuç dosyası (dışa aktarma, ileride içe aktarma) | F2 S13 |

Her modülün iç yapısı aynıdır (örnek: billing-profile):
- `models/billing-profile.ts`: tablonun tanımı (kolonlar).
- `service.ts`: o tabloyla çalışan metotlar. Medusa `MedusaService` ile listeleme/oluşturma metotlarını kendisi üretir; biz şifreleme gibi kendi metotlarımızı ekleriz.
- `index.ts`: modülün kayıt adı (`billingProfile`).
- `migrations/`: tabloyu veritabanında oluşturan SQL (`db:generate` ile üretilir, elle yazılmaz).
- Ayrıca [medusa-config.ts](../apps/backend/medusa-config.ts) içinde kaydı ve [links/customer-billing-profile.ts](../apps/backend/src/links/customer-billing-profile.ts) ile müşteriye bağı vardır (ürün özellikleri de `links/product-attribute-*.ts` ile ürüne bağlıdır).

### 2.2 `src/workflows/`: iş akışları
İş mantığı burada yaşar (altın kural 3). Her workflow adımlardan (`steps/`) oluşur; bir adım hata verirse önceki adımlar geri alınır (compensation).
- [billing-profile/](../apps/backend/src/workflows/billing-profile): fatura profilini oluştur/güncelle (kilit al → var mı bak → güncelle ya da oluştur → müşteriye bağla).
- [tr-address/](../apps/backend/src/workflows/tr-address): adreslerin TR verisine uyduğunu doğrula.
- [audit-log/](../apps/backend/src/workflows/audit-log): `recordAuditEntryStep`, otomatik işleri (`system`) denetim kaydına yazan adım.
- [platform-settings/](../apps/backend/src/workflows/platform-settings): ayar bölümü kaydetme ve bayrak açıp kapama (geri alınabilir); `assertFeatureEnabledStep`.
- [product-attributes/](../apps/backend/src/workflows/product-attributes): şablon oluştur/güncelle/sil ve ürün değerlerini ürün başına kilitle kaydetme.
- [async-job/](../apps/backend/src/workflows/async-job): iş kuyruğa alma ve çalıştırma; `types/` iş tipleri (ilk tip: denetim kaydı CSV dışa aktarma).
- [hooks/](../apps/backend/src/workflows/hooks): Medusa'nın **kendi** workflow'larına takılan kancalar. Örnek: sepete adres yazılırken TR doğrulaması, müşteri silinince fatura profilinin silinmesi.

### 2.3 `src/api/`: dışarıya açılan kapılar
- [middlewares.ts](../apps/backend/src/api/middlewares.ts): **santral**. Hangi adrese hangi kontrolün uygulandığı tek bu dosyadan okunur. Bir istek hakkında soru varsa ilk buraya bak.
- [http/](../apps/backend/src/api/http): güvenlik ve hata katmanı:

  | Dosya | Görevi |
  |---|---|
  | `request-id.ts` | Her isteğe kimlik numarası (`X-Request-Id`); loglar bununla eşleşir |
  | `security-headers.ts` | Güvenlik header'ları (nosniff, DENY, CSP…) |
  | `csrf.ts` | Cookie oturumunda başka siteden gelen sahte isteği reddeder |
  | `rate-limit.ts` | Login/kayıt/şifre sıfırlama ve genel istek limitleri (429) |
  | `request-limits.ts` | `limit` en fazla 100; büyük yüklemeyi okumadan reddetme |
  | `request-path.ts` | Yolu Express'in gördüğü biçime çevirir (`/ADMIN/` = `/admin`) |
  | `upload-validator.ts` | Yüklenen dosyayı baytlarından kontrol eder |
  | `error-handler.ts`, `error-response.ts`, `reject.ts` | Hata yanıtları: iç detay sızdırmadan, `request_id` ile |
  | `audit/` | Denetim kaydı: admin değişikliklerini ve kişisel veri okumalarını yazar; `registry.ts` önce/sonra özeti çıkarılan kaynaklar |
- [validation/](../apps/backend/src/api/validation): Medusa'nın hazır route'larına eklediğimiz kontroller (TR adres, store'da hassas alan isteme yasağı).
- `store/...` ve `admin/...`: kendi route'larımız. **Klasör yolu = URL**. Örnek: `api/store/tr-address/provinces/route.ts` → `GET /store/tr-address/provinces`. Köşeli parantez parametredir: `admin/customers/[id]/billing-profile` → `/admin/customers/:id/billing-profile`.

### 2.4 `src/lib/`: ortak kütüphaneler

| Klasör | İçinde ne var |
|---|---|
| [env.ts](../apps/backend/src/lib/env.ts) | Ortam değişkenlerinin şeması: hangisi zorunlu, hangi biçimde. Eksikse uygulama açılmaz |
| [errors/](../apps/backend/src/lib/errors) | Ortak hata tipleri (`ValidationError`, `ProviderError`…) ve HTTP koduna çevirisi |
| [logging/](../apps/backend/src/lib/logging) | JSON logger (pino) ve **maskeleme**: şifre, token, TCKN, e-posta, telefon loga açık yazılmaz |
| [money/](../apps/backend/src/lib/money) | Kuruş hesapları ve oransal dağıtım (kuruş kaybı olmadan) |
| [tr/](../apps/backend/src/lib/tr) | TCKN/VKN doğrulama, telefon, posta kodu, Türkçe metin |
| [crypto/pii.ts](../apps/backend/src/lib/crypto/pii.ts) | Kişisel veriyi şifreleme (AES-256-GCM) ve aranabilir özet (HMAC) |
| [security/](../apps/backend/src/lib/security) | `safe-fetch` (dış URL'ye güvenli istek, SSRF), `rate-limit/` (sayaçlar), `upload/` (görsel tanıma), `csv.ts`, `xml.ts`, `zip.ts`, `timing-safe.ts` |
| [clients/](../apps/backend/src/lib/clients) | Ödeme/kargo gibi sağlayıcılara HTTP istemcisi: zaman aşımı, yeniden deneme, devre kesici |
| [integrations/health/](../apps/backend/src/lib/integrations/health) | `/admin/integrations/health`: dış servisler ayakta mı |
| [seo/](../apps/backend/src/lib/seo) | Türkçe slug, SEO başlık şablonları, Google'da başlık genişliği |
| [redis/](../apps/backend/src/lib/redis), [cache/](../apps/backend/src/lib/cache) | Kendi Redis istemcimiz, tenant ad alanı; ayarların süreç içi cache'i |

### 2.5 `src/admin/`: kaldırıldı (2026-10-28)
Medusa'nın kendi yönetim ekranına yazılan eklentiler (Başlangıç sayfası, ürün ve müşteri kutuları, Türkçe metin ezmeleri) silindi; karşılıkları kendi panelimizde (`apps/panel`). Medusa'nın yönetim ekranı (`/app`) varsayılan olarak kapalı (adr/0022 §3 eki); platform ekibi gerektiğinde `MEDUSA_ADMIN=on` ile açar.

### 2.6 `src/scripts/`: elle çalıştırılan işler

| Komut | Script | Ne yapar |
|---|---|---|
| `pnpm --filter backend tenant:bootstrap` | `bootstrap-tenant.ts` + `bootstrap/` | Yeni mağazanın temel kurulumu: mağaza, Türkiye bölgesi, TRY, KDV |
| `pnpm --filter backend seed:demo` | `seed-demo.ts` + `seed/` | Demo ürün ve kargo verisi |
| `pnpm --filter backend demo:remove` | `remove-demo.ts` + `demo-removal/` | Demo veriyi ve e2e artıklarını geliştirme veritabanından kaldırır (docs/09) |
| `pnpm --filter backend tr-address:import` | `import-tr-address.ts` | İl/ilçe/mahalle CSV'sini içe aktarır |

---

## 3. "X nerede?" tablosu

| Soru | Bak |
|---|---|
| Bu adrese hangi kontroller uygulanıyor? | [api/middlewares.ts](../apps/backend/src/api/middlewares.ts) |
| Login kaç denemede kilitleniyor, limitler ne? | [lib/security/rate-limit/profiles.ts](../apps/backend/src/lib/security/rate-limit/profiles.ts) |
| Müşteriye hata olarak ne gidiyor? | [api/http/error-handler.ts](../apps/backend/src/api/http/error-handler.ts), [error-response.ts](../apps/backend/src/api/http/error-response.ts) |
| Logda ne maskeleniyor? | [lib/logging/redact.ts](../apps/backend/src/lib/logging/redact.ts) |
| Hangi ortam değişkeni zorunlu? | [lib/env.ts](../apps/backend/src/lib/env.ts) |
| Hangi dosya türleri yüklenebiliyor? | [lib/security/upload/](../apps/backend/src/lib/security/upload), [api/http/upload-validator.ts](../apps/backend/src/api/http/upload-validator.ts) |
| Kim neyi değiştirdi / kim müşteri verisine baktı? | `GET /admin/audit-log` ([route](../apps/backend/src/api/admin/audit-log/route.ts)); kayıt mantığı [api/http/audit/](../apps/backend/src/api/http/audit) |
| Ürün özellikleri (şablon, değer) nerede tanımlı? | [modules/product-attributes](../apps/backend/src/modules/product-attributes); API `/admin/attribute-templates`, `/admin/products/:id/attributes`; ürünle bağı [links/](../apps/backend/src/links) |
| Arka plan işleri (dışa aktarma) nerede? | Ayarlar > İşler; API `/admin/async-jobs`; iş tipleri [workflows/async-job/types](../apps/backend/src/workflows/async-job/types) |
| Dosyalar nereye kaydediliyor? | Dev'de SeaweedFS (`localhost:58333`), testte yerel `static/`; ayar [medusa-config.ts](../apps/backend/medusa-config.ts) ve `S3_*` env |
| Bir özellik açık mı, nasıl açılır? | `GET /admin/features`; bayrak tanımları [features.ts](../apps/backend/src/modules/platform-settings/features.ts) |
| Mağaza / SEO ayarları nerede? | `GET /admin/platform-settings/store` ve `/seo`; alanlar [sections/](../apps/backend/src/modules/platform-settings/sections) |
| Hangi modüller açık? | [medusa-config.ts](../apps/backend/medusa-config.ts) |
| Bir tablo nasıl oluştu? | `src/modules/<ad>/migrations/` |
| TCKN nasıl saklanıyor? | [lib/crypto/pii.ts](../apps/backend/src/lib/crypto/pii.ts), [modules/billing-profile/service.ts](../apps/backend/src/modules/billing-profile/service.ts) |
| Paneldeki Türkçe metinler | [apps/panel/src/locales/tr.json](../apps/panel/src/locales/tr.json) |
| Yerel servislerin portları | [infra/docker/compose.dev.yml](../infra/docker/compose.dev.yml) (bölüm 5) |
| Bu özelliğin kabul kriteri ne, karşılandı mı? | [docs/03](03-yol-haritasi.md) (F2 bölümünde `[x]` işaretli olanlar) |
| Güvenlik kuralı ne diyor? | [docs/04](04-guvenlik.md) |
| Bir kararın gerekçesi | [adr/](../adr) (numarası docs'ta ve kod yorumlarında geçer: "adr/0009") |
| Bu özelliğin testi nerede? | Aynı klasörde `__tests__/` ya da `integration-tests/http/<konu>.spec.ts` |
| Hangi commit'te geldi? | `git log --oneline` (mesajlar İngilizce, `feat(...)`, `fix(...)` biçiminde) |

---

## 4. Bir isteğin yolculuğu (gerçek örnek)

Müşteri fatura bilgisini kaydediyor: `POST /store/customers/me/billing-profile`.

```
Tarayıcı / storefront
  │
  ▼  1. Medusa'nın kendi katmanı: gövde okuma, CORS, publishable key kontrolü
  ▼  2. Bizim "/*" kontrolleri (middlewares.ts):
  │       requestContext   → istek numarası, log bağlamı
  │       securityHeaders  → güvenlik header'ları
  │       csrfProtection   → cookie'li istek başka siteden mi?
  │       uploadSizeGate   → (yalnızca dosya yüklemede) boyut
  ▼  3. "/store/*" kontrolleri:
  │       rateLimit        → dakikada 600'den fazla mı? (429)
  │       storeLimitGuard  → limit ≤ 100
  │       rejectSensitiveStoreFields → gizli alan istenmiş mi?
  ▼  4. Bu adrese özel kontroller:
  │       authenticate("customer")   → giriş yapmış mı?
  │       validateAndTransformBody   → gövde Zod şemasına uyuyor mu? (validators.ts)
  ▼  5. Route: api/store/customers/me/billing-profile/route.ts
  │       vergi numarasını şifreler, workflow'u çağırır (route ince kalır)
  ▼  6. Workflow: workflows/billing-profile/upsert-customer-billing-profile.ts
  │       kilit al → profil var mı → güncelle ya da oluştur → müşteriye bağla → kilidi bırak
  ▼  7. Modül: modules/billing-profile/service.ts → Postgres tablosu
  ▼  8. Yanıt: vergi numarası maskeli döner
  
  Herhangi bir adımda hata → api/http/error-handler.ts → temizlenmiş hata + request_id
```

Bu akışın testi: [integration-tests/http/billing-profile.spec.ts](../apps/backend/integration-tests/http/billing-profile.spec.ts).
Admin tarafındaki karşılığı: `GET /admin/customers/:id/billing-profile` ve admin widget'ı.

---

## 5. Kendi bilgisayarında çalıştırma ve kontrol

| İş | Komut / adres |
|---|---|
| Yerel servisleri aç (Docker) | `pnpm db:up` (kapatmak: `pnpm db:down`) |
| Backend'i çalıştır | `pnpm --filter backend dev` → API `http://localhost:9000` |
| Admin paneli | `http://localhost:9000/app` |
| Yeni tabloları veritabanına uygula | `pnpm --filter backend medusa db:migrate` |
| Gönderilen e-postaları gör (Mailpit) | `http://localhost:58025` |
| Postgres / Redis portları | 55432 / 56379 (yalnızca kendi bilgisayarından erişilir) |
| Rate limit sayaçlarını gör | `redis-cli -p 56379 --scan --pattern 'qt:rl:*'` |
| Kendini kilitlediysen (429) | O anahtarları sil: `redis-cli -p 56379 --scan --pattern 'qt:rl:*' \| xargs redis-cli -p 56379 del` |

**Logları okumak:** Her satır bir JSON. Önemli alanlar: `level`, `msg`, `event` (ör. `rate_limit.store_failed`) ve `request_id`.
Tarayıcıda bir isteğin yanıtındaki `X-Request-Id` değerini loglarda aratırsan o isteğe ait bütün satırları bulursun.
Şifre, token, TCKN, e-posta ve telefon loglarda maskelidir; açık görürsen bu bir hatadır.

---

## 6. Testler

| Tür | Nerede | Komut | Ne zaman |
|---|---|---|---|
| Birim | `src/**/__tests__/*.unit.spec.ts` | `pnpm --filter backend test:unit` | Saniyeler sürer; tek fonksiyonu dener |
| HTTP entegrasyon | `integration-tests/http/*.spec.ts` | `pnpm --filter backend test:integration:http` | Gerçek sunucu + geçici veritabanı açar; birkaç dakika |
| Modül entegrasyon | `src/modules/*/__tests__/` | `pnpm --filter backend test:integration:modules` | Tek modülü gerçek veritabanıyla dener |
| Kalite | — | `pnpm lint`, `pnpm typecheck` | Kod biçimi ve tip hataları |

Tek bir dosyayı çalıştırmak için sonuna adını ekle: `pnpm --filter backend test:integration:http -- uploads`. Adsız çalıştırınca hepsi koşar. Her dosya Medusa'yı yeniden açtığı için bellek birikir; jest bu yüzden testleri tek bir alt süreçte koşar ve bu süreç 1 GB'ı geçince dosya arasında yenisiyle değiştirir (`jest.config.js`).

**Çıktıyı okumak:** `PASS` / `FAIL` dosya başına; `✓` geçen, `✕` kalan test; en altta `Tests: 87 passed, 87 total`.
Kalan testte `Expected` (beklenen) ve `Received` (gelen) satırlarına bak.

Testlerin ortak yardımcıları [integration-tests/helpers/](../apps/backend/integration-tests/helpers) içinde: admin kullanıcısı oluşturma, müşteri kaydı, storefront anahtarı, log yakalama.
Bugünkü sayılar: yaklaşık 790 birim, 87 HTTP, 47 modül testi.

---

## 7. Commit atınca neler oluyor

`git commit` dediğinde [.husky/](../.husky) sırayla şunları çalıştırır; biri başarısız olursa commit olmaz:
1. **gitleaks**: commit'e secret (şifre, anahtar) girmiş mi? (`no leaks found` görmelisin)
2. **lint-staged**: değişen dosyalarda prettier (biçim) ve eslint (kural).
3. **commitlint**: mesaj `feat(alan): ...`, `fix: ...`, `docs: ...` biçiminde mi?

CI ([ci.yml](../.github/workflows/ci.yml)) aynı kontrolleri ve tüm testleri GitHub'da tekrar çalıştırır; [security.yml](../.github/workflows/security.yml) bütün git geçmişini secret için tarar ve bağımlılıkları denetler.

---

## 8. Claude ile çalışma dosyaları

| Yol | Ne |
|---|---|
| [.claude/commands/](../.claude/commands) | Slash komutları: `/oturum-baslat`, `/oturum-kapat`, `/yeni-modul`, `/entegrasyon-provider`, `/test-yaz`, `/guvenlik-review`, `/faz-baslat` |
| [.claude/agents/](../.claude/agents) | Bağımsız inceleme ajanları: `code-reviewer`, `security-reviewer`, `medusa-researcher`, `test-writer` |
| [.claude/settings.json](../.claude/settings.json) | Claude'un izinleri: neyi okuyamaz (`.env`), neyi sormadan yapamaz (`git push`, `db:migrate`) |
| `CLAUDE.md` (kök ve `apps/backend/`) | Claude'un her oturumda okuduğu kurallar |
| `~/.claude/plans/` | Görev planları (repo dışında, senin bilgisayarında) |

---

## 9. Canlı turların sırası

Her tur tek konu ve kısa. Dosyaları VS Code'da açarak ilerleriz.

1. **Repo ve çalıştırma:** bölüm 1 ve 5. Servisleri aç, backend'i çalıştır, admin'e gir, bir isteğin logunu `request_id` ile bul.
2. **Medusa'nın yapı taşları:** bölüm 2. Modül, workflow, route, middleware, link; billing-profile üzerinden.
3. **Bir isteğin yolculuğu:** bölüm 4. Aynı isteği adım adım dosyalarda izle.
4. **Güvenlik katmanı:** `api/http/` ve `lib/security/`. Rate limit, CSRF, header'lar ve yükleme kontrolünü canlı dene.
5. **Testler:** bölüm 6. Bir testi çalıştır, bilerek kır, çıktıyı oku.
