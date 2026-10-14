# CLAUDE.md — E-Ticaret Altyapı Platformu

> Bu dosya kısa tutulur. Detaylar `docs/` altındadır; sadece görevle ilgili dosyayı oku.

## Proje nedir
Çok müşterili (multi-tenant) bir e-ticaret **altyapı platformu**. Medusa.js v2 tabanlı backend + admin.
Sektörden bağımsızdır; ilk müşteri bıçak sektöründen ama **hiçbir kod sektöre özel yazılmaz** —
sektörel ihtiyaçlar feature flag ve attribute şablonlarıyla çözülür.
Model: **instance-per-tenant** (her müşteriye ayrı Medusa instance + ayrı DB).

## Şu anki odak
Backend + Admin. Storefront/temalar SONRAKİ aşama — şimdi storefront kodu yazma.
Güncel faz ve görevler: `PROGRESS.md`

## Stack
- Medusa.js v2 (Node.js, TypeScript strict), PostgreSQL, Redis
- pnpm workspaces + Turborepo monorepo
- Admin genişletmeleri: Medusa Admin SDK + `@medusajs/ui`
- Test: Vitest/Jest (Medusa test-utils), entegrasyon testleri zorunlu

## Komutlar
- `pnpm dev` — tüm uygulamalar
- `pnpm --filter backend dev` — sadece backend
- `pnpm --filter backend test:unit` / `test:integration:http` / `test:integration:modules`
- `pnpm lint` / `pnpm typecheck` / `pnpm format`
- `pnpm --filter backend medusa db:migrate` — migration
- `pnpm --filter backend medusa db:generate <modul>` — migration üret

## Altın kurallar
1. **Kod yazmadan önce** Medusa API'sini Context7 MCP ile doğrula. Hafızandan Medusa v1 API'si yazma.
2. Medusa çekirdeğini değiştirme. Her şey modül, module provider, workflow, subscriber, API route, admin extension.
3. İş mantığı **workflow**'larda; API route'lar ince kalır (doğrula → workflow çağır → dön).
4. Dış servis çağıran her adımın **compensation**'ı olur.
5. Fiyat/tutar istemciden asla kabul edilmez; sunucuda hesaplanır.
6. Secret'lar koda, loga, test fixture'ına girmez. `.env*` dosyalarını okuma.
7. Dosya başına ~300 satır üst sınır. Büyüyorsa böl.
8. Ödeme, kargo, fatura modüllerinde test olmadan PR yok.
9. Türkçe UI metinleri i18n anahtarlarıyla; kod, değişken, commit İngilizce.
10. Belirsizlikte varsayım yapma, sor. Mimari karar gerekiyorsa `adr/` altına ADR öner.

## Doküman haritası
| Konu | Dosya |
|---|---|
| Mimari, tenant modeli | docs/01-mimari.md |
| Klasör yapısı | docs/02-klasor-yapisi.md |
| Yol haritası + kabul kriterleri | docs/03-yol-haritasi.md |
| Güvenlik | docs/04-guvenlik.md |
| Performans | docs/05-performans.md |
| Admin UX | docs/06-admin-ux.md |
| Test | docs/07-test-stratejisi.md |
| DevOps | docs/08-devops.md |
| Claude Code çalışma düzeni, MCP | docs/09-claude-code-is-akisi.md |
| Kod standartları | docs/10-kod-standartlari.md |
| Entegrasyonlar | docs/entegrasyonlar/*.md |

## Oturum düzeni
Oturum başı: `PROGRESS.md` oku → tek görev seç → plan modu → onay → kodla → test → `/oturum-kapat`.
