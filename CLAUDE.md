# CLAUDE.md — E-Ticaret Altyapı Platformu

> Bu dosya kısa tutulur. Detaylar `docs/` altındadır; sadece görevle ilgili dosyayı oku.

## Proje nedir
Çok müşterili (multi-tenant) bir e-ticaret **altyapı platformu**. Medusa.js v2 tabanlı backend + admin.
Sektörden bağımsızdır; ilk müşteri bıçak sektöründen ama **hiçbir kod sektöre özel yazılmaz** —
sektörel ihtiyaçlar feature flag ve attribute şablonlarıyla çözülür.
Model: **instance-per-tenant** (her müşteriye ayrı Medusa instance + ayrı DB).

## Şu anki odak
F18 vitrin (`apps/storefront`, Next.js; tema sözleşmesi `packages/ui`, ilk tema `packages/themes/base`; adr/0046), kullanıcının 2026-11-01 isteğiyle F16'dan önce. Backend + kendi yönetici panelimiz (`apps/panel`, adr/0022) sürüyor; Medusa Admin'e yeni ekran yazılmaz. Ödeme deneme sayfası (adr/0028) vitrin ödemesi çalışınca silindi (2026-11-02); ödeme `localhost:8000/odeme`.
Güncel faz ve görevler: `PROGRESS.md`

## Stack
- Medusa.js v2 (Node.js, TypeScript strict), PostgreSQL, Redis
- pnpm workspaces + Turborepo monorepo
- Panel: React 19 + Vite, Tailwind v4 + shadcn/ui, TanStack Router/Query/Table, RHF + Zod (docs/18)
- Test: Vitest/Jest (Medusa test-utils), entegrasyon testleri zorunlu

## Komutlar
- `pnpm dev` — tüm uygulamalar
- `pnpm --filter backend dev` — sadece backend
- `pnpm --filter panel dev` — panel (backend'e proxy)
- `pnpm --filter storefront dev` — vitrin `localhost:8000` (backend açık ve `seed:demo` yapılmış olmalı)
- `pnpm dev:paytr` — sahte PayTR (panelden test hesabıyla bağlanır); vitrin ödemesi `localhost:8000/odeme`
- `pnpm --filter backend test:unit` / `test:integration:http` / `test:integration:modules`
- `pnpm lint` / `pnpm typecheck` / `pnpm format`
- `pnpm --filter backend medusa db:migrate` — migration
- `pnpm --filter backend medusa db:generate <modul>` — migration üret

## Altın kurallar
1. **Kod yazmadan önce** Medusa API'sini Context7 MCP ile doğrula. Hafızandan Medusa v1 API'si yazma.
2. Medusa çekirdeğini değiştirme. Her şey modül, module provider, workflow, subscriber, API route; arayüz panel ekranı.
3. İş mantığı **workflow**'larda; API route'lar ince kalır (doğrula → workflow çağır → dön).
4. Dış servis çağıran her adımın **compensation**'ı olur.
5. Fiyat/tutar istemciden asla kabul edilmez; sunucuda hesaplanır.
6. Secret'lar koda, loga, test fixture'ına girmez. `.env*` dosyalarını okuma.
7. Dosya başına ~300 satır üst sınır. Büyüyorsa böl.
8. Ödeme, kargo, fatura modüllerinde test olmadan PR yok.
9. Türkçe UI metinleri i18n anahtarlarıyla; kod, değişken, commit İngilizce.
10. Belirsizlikte varsayım yapma, sor. Mimari karar gerekiyorsa `adr/` altına ADR öner.
11. SEO çekirdek özelliktir: katalog/içerik dokunan her görevde `seo` payload, slug/301 ve advisor etkisi düşünülür (docs/13, docs/14).
12. Güvenlik tabanı (`lib/security`, rate limit, redaksiyon) F2'de hazırdır; sonraki fazlarda bunlar kullanılır, yeniden yazılmaz (docs/04).

## Doküman haritası
| Konu | Dosya |
|---|---|
| Mimari, tenant modeli | docs/01-mimari.md |
| Klasör yapısı | docs/02-klasor-yapisi.md |
| Yol haritası + kabul kriterleri | docs/03-yol-haritasi.md |
| Güvenlik | docs/04-guvenlik.md |
| Performans | docs/05-performans.md |
| Panel UX ve ekran planı | docs/06-admin-ux.md |
| Panel tasarım sistemi (token, tema, klasör) | docs/18-panel-tasarim-sistemi.md |
| Panel kullanılabilirlik denetimi | docs/17-yonetici-paneli-kullanilabilirlik.md |
| Test | docs/07-test-stratejisi.md |
| DevOps | docs/08-devops.md |
| Claude Code çalışma düzeni, MCP | docs/09-claude-code-is-akisi.md |
| Kod standartları | docs/10-kod-standartlari.md |
| Kod dışı gereksinimler (hukuk, mali, sağlayıcı) | docs/12-kod-disi-gereksinimler.md |
| KVKK veri envanteri ve saklama süreleri | docs/kvkk-envanter.md |
| SEO mimarisi (URL, 301, JSON-LD, sitemap, GEO) | docs/13-seo-mimarisi.md |
| SEO advisor kural seti ve öneri motoru | docs/14-seo-advisor-kural-seti.md |
| Rakip analizi ve farklılaşma | docs/15-rakip-analizi-ve-farklilasma.md |
| Entegrasyonlar | docs/entegrasyonlar/*.md |

## Oturum düzeni
Oturum başı: `PROGRESS.md` oku → tek görev seç → plan modu → onay → kodla → test → `/oturum-kapat`.
