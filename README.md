# Quant Ticaret

Quant Dijital'in Türkiye odaklı, çok müşterili (instance-per-tenant) e-ticaret altyapısı.
Medusa.js v2 tabanlı backend + admin. Mimari ve yol haritası: `docs/`, güncel durum: `PROGRESS.md`.

## Gereksinimler
- Node.js 22 (`.nvmrc`; `nvm use` veya `fnm use`)
- pnpm 11 (`corepack enable` veya `npm i -g pnpm@11`) — sürüm `package.json` → `packageManager` ile sabit
- Docker (F0.3'ten itibaren: Postgres, Redis, Mailpit, MinIO)
- `jq` (Claude Code prettier hook'u için)

## Kurulum
```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm format:check
```

## Komutlar
| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Tüm uygulamaları geliştirme modunda çalıştırır (Turborepo) |
| `pnpm build` | Tüm paketleri derler |
| `pnpm lint` | ESLint (strict, type-checked) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Testler |
| `pnpm format` / `pnpm format:check` | Prettier yaz / kontrol et (Markdown hariç) |

## Yapı
```
apps/        uygulamalar (backend F0.2'de gelir; storefront F18)
packages/
  config/    paylaşılan tsconfig (strict), ESLint flat config, Prettier
  types/     paylaşılan tipler ve Store API sözleşmeleri
docs/        mimari, yol haritası, güvenlik, SEO
adr/         mimari karar kayıtları
```

## Tedarik zinciri güvenliği
- Sürümler tam sabit (`saveExact`), lockfile zorunlu.
- 14 günden genç paket sürümleri kurulmaz (`minimumReleaseAge`).
- Bağımlılıkların install/postinstall script'leri kapalıdır; açmak için paketin script'ini inceleyip
  `pnpm-workspace.yaml` → `allowBuilds` altına eklemek gerekir.

## Claude Code
İlk komut: `/oturum-baslat`. Çalışma düzeni: `docs/09-claude-code-is-akisi.md`.
