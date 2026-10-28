# Quant Ticaret

Quant Dijital'in Türkiye odaklı, çok müşterili (instance-per-tenant) e-ticaret altyapısı.
Medusa.js v2 tabanlı backend + admin. Mimari ve yol haritası: `docs/`, güncel durum: `PROGRESS.md`.

## Gereksinimler
- Node.js 24 LTS (`.nvmrc`; `nvm use` veya `fnm use`)
- pnpm 11 (`corepack enable` veya `npm i -g pnpm@11`) — sürüm `package.json` → `packageManager` ile sabit
- Docker (Docker Desktop veya OrbStack): Postgres 16, Redis 7, Mailpit, SeaweedFS (S3)
- `openssl` (yerel secret üretimi), `jq` (Claude Code prettier hook'u için)
- `gitleaks` (commit öncesi secret taraması; macOS: `brew install gitleaks`). Kurulu değilse commit reddedilir.

## Kurulum
```sh
pnpm env:init          # infra/docker/.env, apps/backend/.env(.test) — secret'lar rastgele üretilir
pnpm db:up             # geliştirme servisleri (aşağıdaki tablo)
pnpm install
pnpm --filter @qticaret/backend medusa db:migrate
pnpm --filter @qticaret/backend dev     # API http://localhost:9000; panel: pnpm --filter panel dev (http://localhost:5173)
```
Admin kullanıcısı. `EPOSTA` yerine kendi adresini yaz. Şifre ekrana yazılmadan sorulur ve shell
geçmişine düşmez. Komut çalışırken şifre `ps` çıktısında görünebilir, bu yüzden bunu yalnızca yerel makinede yap:
```sh
read -rs "PW?Şifre: " && echo && pnpm --filter @qticaret/backend medusa user -e EPOSTA -p "$PW"; unset PW
```
(bash'te `read -rsp "Şifre: " PW` kullan.)

Panelin uçtan uca testleri (backend açıkken; kendi geçici yöneticisini açıp siler):
```sh
pnpm --filter @qticaret/panel exec playwright install chromium   # bir kez
pnpm --filter @qticaret/panel test:e2e
```
Env şablonları `env.example` adındadır (gerçek `.env*` dosyaları git'e ve Claude Code'a kapalı).
Şablona yeni değişken eklendiğinde `pnpm env:init` tekrar çalıştırılır; mevcut değerlere dokunmadan eksikleri ekler.

### Geliştirme servisleri
Hepsi yalnızca `127.0.0.1`'e bağlıdır. Portlar, makinedeki yerel kurulumlarla çakışmasın diye varsayılanın dışındadır.

| Servis | Adres | Not |
|---|---|---|
| Postgres 16 | `localhost:55432` | DB `qticaret`, kullanıcı `postgres` |
| Redis 7 | `localhost:56379` | Dev'de opsiyonel |
| Mailpit | SMTP `localhost:51025`, arayüz http://localhost:58025 | Giden e-postaları yakalar |
| SeaweedFS (S3) | http://localhost:58333 | Bucket `qticaret`; anonim yalnızca okuma (adr/0006) |

Yerel veritabanını sıfırlamak için `pnpm db:down -v` kullan. Bu komut volume'ları siler; Postgres şifresi
yalnızca boş volume'da uygulandığı için env dosyalarını yeniden üretirken de bu gerekir.

## Komutlar
| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Tüm uygulamaları geliştirme modunda çalıştırır (Turborepo) |
| `pnpm build` | Tüm paketleri derler |
| `pnpm lint` | ESLint (strict, type-checked) |
| `pnpm typecheck` | `tsc --noEmit`; backend, Medusa'nın ürettiği tipleri (`.medusa/types`) okur: önce bir kez `pnpm dev` ya da `pnpm build` |
| `pnpm test` | Unit testler |
| `pnpm --filter @qticaret/backend test:integration:http` | HTTP entegrasyon testleri (Postgres gerekir); bir dosya için sonuna adını ekleyin. Hepsi tek komutta: jest, belleği büyüyen süreci dosya arasında yeniler |
| `pnpm --filter @qticaret/backend messaging:samples` | Bütün e-posta şablonlarını örnek değerlerle Mailpit'e gönderir (http://localhost:58025); `EMAIL_TRANSPORT=mailpit`, `MAILPIT_URL` ve `EMAIL_FROM` gerekir, Mailpit dışında çalışmaz |
| `pnpm db:up` / `pnpm db:down` | Geliştirme servislerini başlat / durdur |
| `pnpm env:init` | Eksik env dosyalarını ve değişkenlerini şablondan tamamla (mevcut değeri değiştirmez) |
| `pnpm format` / `pnpm format:check` | Prettier yaz / kontrol et (Markdown hariç) |

## Yapı
```
apps/
  backend/   Medusa v2.21.2 — API, worker, admin (adr/0001); storefront F18'de gelir
packages/
  config/    paylaşılan tsconfig (strict), ESLint flat config, Prettier
  types/     paylaşılan tipler ve Store API sözleşmeleri
infra/docker/ geliştirme compose dosyası
scripts/     yerel ortam yardımcıları
docs/        mimari, yol haritası, güvenlik, SEO
adr/         mimari karar kayıtları
```

## Git hook'ları
`pnpm install` hook'ları kurar (husky).
- **pre-commit:** gitleaks staged değişiklikleri secret için tarar (`.gitleaks.toml`). Ardından lint-staged
  değişen dosyalarda prettier ve o paketin ESLint config'ini çalıştırır.
- **commit-msg:** commitlint, conventional commits biçimini zorunlu kılar: `type(scope): subject`, İngilizce.

`--no-verify` hook'ları atlar, ama CI tüm geçmişi yeniden taradığı için hata sadece ertelenmiş olur.

## Tedarik zinciri güvenliği
- Sürümler tam sabit (`saveExact`), lockfile zorunlu.
- 14 günden genç paket sürümleri kurulmaz (`minimumReleaseAge`).
- Bağımlılıkların install/postinstall script'leri kapalıdır; açmak için paketin script'ini inceleyip
  `pnpm-workspace.yaml` → `allowBuilds` altına eklemek gerekir.
- Renovate (`renovate.json`, Mend Renovate GitHub App) her pazartesi 14 günden eski güncellemeleri PR olarak açar.
  Major güncellemeler Dependency Dashboard'dan onay bekler. Güvenlik yaması prosedürü: docs/04.
- CI: `.github/workflows/ci.yml` (lint, typecheck, test, build, entegrasyon) ve `security.yml` (gitleaks,
  pnpm audit, Semgrep, Trivy, SBOM). Kritik bulgu build'i kırar.

## Claude Code
İlk komut: `/oturum-baslat`. Çalışma düzeni: `docs/09-claude-code-is-akisi.md`.
