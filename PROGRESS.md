# PROGRESS — İlerleme Takibi

> Her oturum sonunda `/oturum-kapat` ile güncellenir. Claude oturuma buradan başlar.

## Aktif faz
**F1 — Medusa çekirdek + TR lokalizasyon: tamamlandı** (`f1-tr-localization`, push ve PR bekliyor). Sıradaki faz F2.

## Son oturum özeti
2026-10-24 (gece): F1'in sekiz görevi (S1–S8) tek oturumda bitirildi. Kullanıcı önerilen seçeneklerin uygulanmasını istedi. ADR 0004, 0007, 0008 ve 0009 kabul edildi.
- **S1–S2:**
  - İdempotent tenant bootstrap: TR region/TRY, KDV dahil fiyat, KDV20 varsayılan, KDV10 ve KDV1 ürün tipine bağlı.
  - Sektörsüz demo seed: 4 ürün, 3 kategori, TR kargo seçenekleri.
  - Script'ler: `tenant:bootstrap`, `seed:demo` (`--allow-non-local` olmadan yalnızca development/test'te çalışır).
- **S3–S5:**
  - `tr-address` modülü: Türkçe eşleştirme ve sıralama anahtarları, ASCII'ye katlanmış yedek eşleştirme.
  - Tek transaction'lı import (`tr-address:import`). 32.076 mahalle ilk yüklemede ~4,3 sn, yeniden yüklemede ~1,6 sn.
  - Store route'ları: limit ≤100, `Vary` başlığı.
  - Adres doğrulama: store middleware'i, sepet ve müşteri adresi workflow hook'ları. Hata kodları i18n anahtarı. Alan eşlemesi adr/0008 ekinde.
- **S6–S7:**
  - Admin i18n (tr/en). Login widget'ı admin'i ilk ziyarette bir kez Türkçe'ye çevirir.
  - `billing-profile` modülü: TCKN/VKN kontrol hanesi doğrulaması, AES-256-GCM (AAD müşteriye bağlı) ve HMAC, route sınırında şifreleme, müşteri bazlı kilit, maskeli store/admin API ve widget, müşteri silinince soft delete.
- **S8:** Cookie `HttpOnly`, `SameSite=Lax`, NODE_ENV açıkça local değilse `Secure`. Session ömrü 10 saat. Redis session store; staging/prod'da `REDIS_URL` zorunlu.
- **Kalite:**
  - Testler: 108 birim, 24 modül entegrasyon, 62 HTTP entegrasyon. CI artık modül testlerini de çalıştırıyor.
  - Bağımsız güvenlik ve kod incelemesi yapıldı; kritik veya yüksek bulgu yok. Orta ve düşük bulgular düzeltildi.
  - Dev sunucusunda Playwright ile doğrulandı: admin Türkçe açılıyor, müşteri detayında maskeli fatura widget'ı görünüyor.

Önceki oturumlar: F1 planlaması ve F0.2–F0.8 (2026-10-24), F0.1 monorepo (2026-10-24 sabahı), SEO ve güvenlik dokümanları (2026-10-22).

## Sıradaki görev
1. **Kullanıcı:**
   - `f1-tr-localization`'ı push edip PR açmak (CI'da modül testleri ilk kez çalışacak).
   - Yerel dev DB'deki doğrulama verisini isterse silmek: "Deneme Müşteri" ve demo seed. Ortam `pnpm db:down -v` ile sıfırlanabilir.
2. **F2 planlaması:** `/faz-baslat F2`.

## Açık sorular / bloklayıcılar
- [ ] **Renovate GitHub App kurulumu (kullanıcı):** github.com/apps/renovate → `denizcanmaya/eticaret-platform`. Kurulunca onboarding PR'ı kontrol edilecek.
- [ ] **Takip edilen açıklar** (adr/0001 "Bilinen açıklar"):
  - zod → 4.6.6: 2026-10-25'ten itibaren uygun; doğrudan bağımlılık + admin-sdk override.
  - body-parser → 1.20.9 ve multer → 2.5.0: 2026-11-05'ten itibaren uygun.
  - @graphql-tools/utils 10.x: kabul edilmiş risk (yalnızca build sırasında).
- [ ] Medusa 2.22.x yükseltmesi: en erken 2026-11-06 (2.22.1 için 14 gün); ayrı PR.
- [ ] **F1'den devreden işler:**
  - Kargo KDV oranı için `shipping_option` vergi kuralı, mali müşavir onayından sonra (docs/12).
  - Soft-delete edilmiş fatura profillerini kalıcı silme / KVKK imha işi (F13).
  - Locking modülünün Redis sağlayıcısına geçmesi ve üretim imajında `NODE_ENV=production` (F16).
  - Yapılandırılmış log sarmalayıcısı (`{ event, ... }`) ve pino redaksiyonu (F2.10). Script logları şimdilik düz metin.
  - Telefon E.164 normalizasyonu yalnızca Store API yolunda yapılıyor; workflow ile yazılan sepet adresi ham telefonu saklar (doğrulama iki yolda da var).
  - `tr-address` ve fatura profili Store API sözleşme tipleri `packages/types`'a (F18).
  - Tam vergi kimliğini gösterme: yetki (F12) ve okuma audit log'u (F2.5).
- [ ] Çok dilli içerik: Medusa Translation modülü feature flag arkasında, şimdilik kapalı. Ana içerik Türkçe; çok dil F19.
- [ ] Medusa'da CSRF koruması yok → F2.10'da Origin kontrolü + custom header (ADR-0004).
- [ ] Trivy imaj taraması: üretim Dockerfile'ı ile birlikte F16'da.
- [ ] GitHub Actions dakikaları: private repo, ücretsiz kota 2000 dk/ay; ilk ayda izlenecek.
- [ ] `adr/0003` hosting ve veri yerleşimi kararı (en geç F15 öncesi; KVKK danışmanı görüşü gerekli)
- [ ] Kod dışı gereksinimler takibi: `docs/12-kod-disi-gereksinimler.md` (avukat, mali müşavir, sağlayıcı anlaşmaları)
- [ ] `adr/0005` içerik önerileri: kural motoru + opsiyonel LLM (kabul bekliyor; LLM sağlayıcı seçimi F10.13 öncesi)
- [ ] Admin 2FA yöntemi ADR (F12.6 öncesi; Medusa'da yerleşik mi doğrulanacak)
- [ ] docs/15 açık doğrulamalar: ikas headless/API, Shopify B2B changelog, Google TR ücretsiz listeleme (tenant hesabında)

## Faz durumu
| Faz | Durum |
|---|---|
| F0 Repo & araçlar | ✅ |
| F1 Medusa çekirdek + TR lokalizasyon | ✅ |
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
