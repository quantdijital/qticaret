# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F0 — Repo ve araç zinciri: tamamlandı.** Sıradaki faz: F1. `f0-foundation` → `main` PR'ının merge edilmesi bekleniyor.

## Son oturum özeti
2026-10-24: F0.2–F0.8 tamamlandı (`f0-foundation` push edildi; CI ve Security yeşil).

- **F0.2:** Medusa **2.21.2**, `apps/backend` (dtc-starter referanslı, exact sürümler).
  - **Node 24 LTS** (`engines >=24.11 <25`); TS 5.9.3 ve strict bayraklar korundu.
  - Admin paketleri doğrudan bağımlılık; tüm `allowBuilds` false; telemetri kapalı.
  - adr/0001 kabul edildi.
- **F0.3:** compose = Postgres 16.15, Redis 7.4.11, Mailpit, **SeaweedFS** (MinIO arşivlendi, adr/0006).
  - Portlar 55432/56379/51025/58025/58333 ve yalnızca 127.0.0.1; imajlar digest ile sabit.
  - `pnpm env:init` env dosyalarını şablondan (`env.example`) üretir ya da eksiklerini tamamlar.
- **F0.6:** Zod env şeması (`src/lib/env.ts`). Eksik ya da hatalı değişkenler adlarıyla listelenir, değerler asla yazılmaz.
- **F0.4:** husky hook'ları.
  - pre-commit: gitleaks (staged) + lint-staged.
  - commit-msg: commitlint (conventional).
  - `.gitleaks.toml`'de Markdown için dar kapsamlı istisna.
- **F0.5 / F0.7:** iki workflow, tüm action ve imajlar SHA/digest/checksum ile sabit.
  - `ci.yml`: lint, typecheck, test, build ve Postgres'li entegrasyon testi.
  - `security.yml`: gitleaks (tüm geçmiş), `pnpm audit` (kritikte kırılır), Semgrep CE, Trivy fs (dev bağımlılıkları dahil), CycloneDX SBOM.
  - KK kanıtı geçici `ci-selftest` dalıyla alındı, dal silindi.
  - Self-test, Trivy'nin dev bağımlılıklarını taramadığını ortaya çıkardı; düzeltildi.
- **F0.8:** `renovate.json`: haftalık, 14 gün, majorlar dashboard onaylı, Medusa paketleri gruplu. Doğrulayıcıdan geçti.
- Önceki oturumlar: F0.1 monorepo (2026-10-24 sabahı); SEO/güvenlik dokümanları (2026-10-22).

## Sıradaki görev
- [ ] `f0-foundation` → `main` PR'ını incele ve merge et (kullanıcı)
- [ ] F1.1 Region: Türkiye, TRY, varsayılan dil tr → fazı `/faz-baslat F1` ile başlat

## Açık sorular / bloklayıcılar
- [ ] **Renovate GitHub App kurulumu (kullanıcı):** github.com/apps/renovate → `denizcanmaya/eticaret-platform`. Kurulunca onboarding PR'ı kontrol edilecek.
- [ ] **Takip edilen açıklar** (adr/0001 "Bilinen açıklar"):
  - zod → 4.6.6: 2026-10-25'ten itibaren uygun; doğrudan bağımlılık + admin-sdk override.
  - body-parser → 1.20.9 ve multer → 2.5.0: 2026-11-05'ten itibaren uygun.
  - @graphql-tools/utils 10.x: kabul edilmiş risk (yalnızca build sırasında).
- [ ] Medusa 2.22.x yükseltmesi: en erken 2026-11-06 (2.22.1 için 14 gün); ayrı PR.
- [ ] Trivy imaj taraması: üretim Dockerfile'ı ile birlikte F16'da.
- [ ] GitHub Actions dakikaları: private repo, ücretsiz kota 2000 dk/ay; ilk ayda izlenecek.
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0004` Store API kimlik modeli (F1.8'de Context7 doğrulamasıyla kabul)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)

## Faz durumu
| Faz | Durum |
|---|---|
| F0 Repo & araçlar | ✅ |
| F1 Medusa çekirdek + TR lokalizasyon | ⬜ |
| F2 Platform çekirdek modülleri | ⬜ |
| F3 Katalog, SEO motoru ve stok | ⬜ |
| F4 Fiyatlandırma ve promosyon | ⬜ |
| F5 Ödeme: iyzico | ⬜ |
| F6 Ödeme: PayTR + havale/EFT + kapıda ödeme + yönlendirici + ters ibraz | ⬜ |
| F7 Kargo, sipariş operasyonu, iade ve değişim | ⬜ |
| F8 E-fatura | ⬜ |
| F9 Bildirimler (e-posta/SMS) | ⬜ |
| F10 Müşteri hesabı, etkileşim, pazarlama ve SEO ölçümü | ⬜ |
| F11 Raporlama, muhasebe ve dış API | ⬜ |
| F12 Admin genişletmeleri | ⬜ |
| F13 Uyum & yasal özellikler | ⬜ |
| F14 Veri taşıma ve geçiş araçları | ⬜ |
| F15 Sertleştirme (güvenlik/dolandırıcılık/yük) | ⬜ |
| F16 Dağıtım & tenant işletimi | ⬜ |
| F17 Control plane | ⬜ |
| F18 Storefront & temalar (sonraki aşama) | ⬜ |
| F19 Genişleme: pazaryeri, B2B, yurt dışı, ajan ticareti (sonraki aşama) | ⬜ |

Durum: ⬜ başlamadı · ⏳ devam · ✅ bitti · ⛔ bloklu
