# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F0 — Repo ve araç zinciri**

## Son oturum özeti
2026-10-24 — F0.1 tamamlandı. Ürün adı **Quant Ticaret** (kodda `@qticaret/*`), repo klasörü `qticaret`.
- pnpm 11 + Turborepo 2.11 monorepo; Node 22; tam sürüm sabitleme, 14 gün `minimumReleaseAge`, bağımlılık build script'leri varsayılan kapalı (`allowBuilds`).
- `@qticaret/config`: strict tsconfig (noUncheckedIndexedAccess, exactOptionalPropertyTypes), type-checked ESLint flat config (any/console/floating promise/boş catch/eksik switch yasak), Prettier (Markdown hariç).
- `@qticaret/types`: locale/para birimi sözleşmeleri (Node tiplerinden bağımsız; storefront da kullanacak).
- install, lint, typecheck, format:check yeşil; kasıtlı ihlallerle kuralların kırdığı doğrulandı. TypeScript 5.9.3 seçildi (typescript-eslint <6.1; Medusa uyumu F0.2'de doğrulanacak).
- Önceki oturum (2026-10-22): SEO/güvenlik/rakip dokümanları ve ADR-0003/4/5 — commit `ce4a784`.

## Sıradaki görev
- [ ] F0.2 Medusa v2 kurulumu `apps/backend` (14 günden eski kararlı sürüm; şu an 2.21.2 aday) → adr/0001

## Açık sorular / bloklayıcılar
- [ ] Hedef Medusa sürümü Context7 ile doğrulanacak ve `adr/0001` olarak kaydedilecek
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0004` Store API kimlik modeli (F1.8'de Context7 doğrulamasıyla kabul)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)
- [ ] Docker kurulu değil — F0.2 çalıştırma ve F0.3 için gerekli (Docker Desktop veya OrbStack)
- [ ] TypeScript sürümü: 5.9.3 ile başlandı; Medusa'nın TS 6 desteği F0.2'de doğrulanacak
- [ ] `f0-foundation` dalı main'e henüz birleştirilmedi

## Faz durumu
| Faz | Durum |
|---|---|
| F0 Repo & araçlar | ⏳ |
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
