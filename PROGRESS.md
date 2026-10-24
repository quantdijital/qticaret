# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F0 — Repo ve araç zinciri**

## Son oturum özeti
2026-10-22 — Doküman genişletmesi (kod yok): güvenlik tabanı F0–F2'ye çekildi ve docs/04 genişletildi (upload, SSRF, CSV/XML, SMS kotası, ihlal müdahalesi);
SEO çekirdek özellik yapıldı (docs/13 mimari, docs/14 advisor kural seti; F3 yeniden yapılandırıldı, F10/F12/F14/F18 SEO görevleri);
rakip analizi docs/15; adr/0004 (Store auth modeli), adr/0005 (içerik önerileri: kural motoru + opsiyonel LLM);
F6.7 ters ibraz, F7.11–F7.14 değişim/sipariş düzenleme/müşteri iptali/doğrudan taşıyıcı, F8 UBL+mükellef listesi bizde, F13.10 ihlal runbook'u eklendi.
medusa-researcher ajanının Context7 araç adı düzeltildi.

## Sıradaki görev
- [ ] F0.1 Monorepo iskeleti (pnpm + Turborepo)

## Açık sorular / bloklayıcılar
- [ ] Hedef Medusa sürümü Context7 ile doğrulanacak ve `adr/0001` olarak kaydedilecek
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0004` Store API kimlik modeli (F1.8'de Context7 doğrulamasıyla kabul)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)
- [ ] Bekleyen doküman değişiklikleri commit edilmedi (kullanıcı onayı bekleniyor)

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
