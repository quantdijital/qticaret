# ADR-0001: Tenant modeli ve Medusa sürümü

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-24

## Bağlam
Platform birden çok bağımsız mağazaya hizmet verecek. Medusa v2 tek mağaza varsayımıyla tasarlanmıştır.

## Karar
- **Instance-per-tenant:** Her tenant'a ayrı Medusa server + worker ve ayrı PostgreSQL veritabanı.
- **Medusa sürümü:** `@medusajs/medusa@2.21.2` (2026-09-28). Tüm `@medusajs/*` paketleri aynı sürüme exact sabitlenir.
  - 2.22.0 / 2.22.1 (2026-10-21 / 23) 14 günlük `minimumReleaseAge` kuralına takıldığı için seçilmedi.
- Sürüm sabitlenir (exact), yükseltmeler ayrı PR + canary tenant ile yapılır.
- **Node.js:** 24 LTS (`engines: >=24.11.0 <25`, `.nvmrc`). Medusa 20/22/24 LTS'i destekler. 24 en uzun destek süresine sahip ve Medusa Cloud storefront build'leri de onu kullanıyor. 25+ desteklenmiyor.
- **TypeScript:** 5.9.3. Medusa paketleri TS için üst sınır tanımlamıyor.

## Kurulum notları (F0.2'de doğrulandı)
- **Referans:** `medusa-starter-default` deprecated. Kurulum, resmi `medusajs/dtc-starter` reposunun
  `211454a` commit'i ("update @medusajs/* to v2.21.2") referans alınarak elle yapıldı. `create-medusa-app` en son sürümü çektiği için kullanılmadı.
- **pnpm 11:** `.npmrc`'den sadece auth/registry ayarlarını okuyor, bu yüzden Medusa dokümanındaki hoist desenleri etkisiz kalıyor.
  - Bunun yerine dtc-starter gibi admin paketleri `@qticaret/backend`'e doğrudan bağımlılık olarak eklendi: `@medusajs/dashboard`, `admin-shared`, `ui`, `@tanstack/react-query`, `react-i18next`, `react-router-dom`, `zod`.
  - `publicHoistPattern` kullanılmıyor.
- `@mikro-orm/*`, `awilix` ve `pg` doğrudan eklenmez. `@medusajs/framework/*` alt yollarından import edilir.
- **zod:** Workspace'te tek bir sürüm var (4.2.0). Route şemalarında `@medusajs/framework/zod`'dan import edilir, böylece framework ile aynı örnek kullanılır.
- Medusa'ya bağımlı paylaşılan workspace paketleri `@medusajs/framework`'ü **peerDependency** olarak tanımlamalı.
- **Install script'leri:** `@medusajs/telemetry`, `@swc/core`, `esbuild`, `msgpackr-extract`, `protobufjs` → `allowBuilds: false`.
  Hepsinin native binary'si opsiyonel bağımlılıklardan geliyor (gerekçeler `pnpm-workspace.yaml`'da). Admin build, dev server ve testler bu ayarla doğrulandı.
- **Bilinen uyarı:** `@medusajs/admin-vite-plugin` → `fdir@6.1.1` paketinin opsiyonel `picomatch@3` peer'i karşılanmıyor. Zararsız.
- **TS strict:** Paylaşılan strict bayraklar (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`) backend'de de açık.
  - Medusa için override edilenler: `module`/`moduleResolution: Node16`, `verbatimModuleSyntax: false` (CJS çıktı), decorator ayarları, `outDir: .medusa/server`.
- **Telemetri:** `MEDUSA_DISABLE_TELEMETRY=true`.
- **Redis:** Dev ortamında zorunlu değil (in-memory modüller). Prod için caching, event-bus, workflow-engine ve locking Redis modülleri ilgili fazda eklenecek.

## Bilinen açıklar (2026-10-24, F0.7)
CI kritik açıkta kırılır. Yüksek seviyedekiler aşağıda takip edilir; hiçbir tenant henüz canlıda değil.

| Paket | Kaynak | Durum |
|---|---|---|
| lodash <4.18.1 (CVE-2026-4800) | @graphql-codegen, build sırasında | `pnpm-workspace.yaml` override ile 4.18.1'e çekildi |
| zod 4.2.0 (CVE-2023-54404, DoS) | doğrudan bağımlılık + admin-sdk (exact) | 4.6.6, 14 gün kuralı 2026-10-25'te doluyor → bump + override |
| body-parser 1.20.8 (DoS) | express ~1.20.3 | 1.20.9, 2026-11-05'te uygun → override |
| multer 2.4.0 (DoS) | @medusajs/medusa ^2.3.0 | 2.5.0, 2026-11-05'te uygun → override |
| @graphql-tools/utils 10.11.0 (prototype pollution DoS) | @graphql-codegen ^10, build sırasında | v10 için yama yok, düzeltme 12.x (major). İstek yolunda değil, girdisi güvenilir şema; **kabul edilmiş risk**, Medusa yükseltmesinde tekrar bakılacak |

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Tek instance, multi-store/sales-channel | Düşük altyapı maliyeti | Veri izolasyonu zayıf, KVKK riski, özel geliştirme yükü |
| Tek DB, tenant_id kolonu | Ölçek verimliliği | Medusa çekirdeğiyle çatışma, sızıntı riski |
| **Instance-per-tenant** | İzolasyon, basit yedek, Medusa ile uyum | Tenant başına kaynak maliyeti, sürüm yayma otomasyonu gerekir |

## Sonuçlar
- F16'da provisioning otomasyonu zorunlu.
- Tenant sayısı arttığında kaynak optimizasyonu yeni ADR ile değerlendirilecek.
- 2.22.x'e yükseltme 14 günlük bekleme süresi dolduktan sonra (en erken 2026-11-06) ayrı PR olarak yapılabilir. 2.22 Node ≥22.22 istiyor, Node 24 bunu zaten karşılıyor.
