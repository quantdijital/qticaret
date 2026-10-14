# 03 — Yol Haritası (Backend + Admin)

> Her görev tek bir Claude Code oturumuna sığacak büyüklüktedir.
> Görev bitince kabul kriterleri işaretlenir ve `PROGRESS.md` güncellenir.
> "KK" = Kabul Kriteri. Bir faz, tüm KK'ları sağlanmadan kapanmaz.

---

## F0 — Repo ve Araç Zinciri
**Hedef:** Tekrarlanabilir, temiz geliştirme ortamı.

- F0.1 Monorepo iskeleti: pnpm workspaces, Turborepo, `packages/config` (tsconfig strict, eslint, prettier)
- F0.2 Medusa v2 kurulumu `apps/backend` (güncel sürüm Context7 ile doğrulanır → adr/0001)
- F0.3 `infra/docker/compose.dev.yml`: Postgres, Redis, Mailpit (e-posta yakalama), MinIO (S3)
- F0.4 Git hooks (lint-staged), conventional commits, commitlint
- F0.5 CI iskeleti: lint, typecheck, unit test, build (GitHub Actions)
- F0.6 `.env.example` + ortam değişkeni şeması (Zod ile açılışta doğrulama; eksikse süreç başlamaz)

**KK:**
- [ ] `pnpm i && pnpm dev` temiz makinede çalışıyor (README adımlarıyla)
- [ ] CI yeşil
- [ ] Eksik env değişkeniyle backend açıklayıcı hatayla durur
- [ ] adr/0001 (Medusa sürümü + tenant modeli) yazıldı

---

## F1 — Medusa Çekirdek + TR Lokalizasyon
**Hedef:** Türkiye için doğru yapılandırılmış boş mağaza.

- F1.1 Region: Türkiye, para birimi TRY, varsayılan dil tr
- F1.2 Vergi: KDV oranları (tenant'ın ürün gruplarına göre tax rate'ler), fiyatlar KDV dahil gösterim ayarı
- F1.3 `tr-address` modülü: il/ilçe/mahalle referans verisi + import script'i + Store API endpoint'leri
  (`GET /store/tr-address/provinces`, `.../districts?province=`, `.../neighborhoods?district=`)
- F1.4 Adres doğrulama: telefon (TR formatı), posta kodu, il-ilçe tutarlılığı (Zod)
- F1.5 Müşteri alanları: bireysel/kurumsal ayrımı, TCKN / VKN + vergi dairesi (fatura için), maskeleme
- F1.6 Seed script: demo ürünler, kategoriler, kargo seçenekleri (sektörsüz, genel demo)
- F1.7 Admin dili Türkçe, i18n altyapısı (`src/admin/i18n`)

**KK:**
- [ ] Seed sonrası Store API'den TRY fiyatlı ürün listelenebiliyor
- [ ] Geçersiz il/ilçe kombinasyonu 400 döner
- [ ] TCKN loglarda ve admin listelerinde maskeli
- [ ] tr-address entegrasyon testleri geçiyor

---

## F2 — Platform Çekirdek Modülleri
**Hedef:** Sektörden bağımsızlığı ve denetlenebilirliği sağlayan temel.

- F2.1 `lib/clients`: ortak HTTP istemci (timeout, exponential retry, circuit breaker, header/body redaksiyonu, korelasyon ID)
- F2.2 `lib/errors`: `ProviderError`, `ValidationError`, `RetryableError` sınıfları ve Medusa hata eşleme
- F2.3 `platform-settings` modülü: mağaza ayarları + feature flag'ler (secret YOK), admin ayar sayfası
- F2.4 `product-attributes` modülü: şablon → alan tanımları; ürün ↔ attribute değerleri link'i;
  admin'de ürün detayına widget; Store API'de ürünle birlikte dönme
- F2.5 `audit-log` modülü: admin mutasyonlarını middleware/subscriber ile kaydetme (kim, ne, ne zaman, önce/sonra özeti)
- F2.6 `/admin/integrations/health` endpoint deseni: her provider kendi `healthCheck()`'ini sunar

**KK:**
- [ ] Feature flag kapalıyken ilgili endpoint/akış devreye girmiyor (testli)
- [ ] Attribute şablonu tanımlayıp ürüne değer atanabiliyor, Store API'de görünüyor
- [ ] Ürün fiyatı değişikliği audit log'da görünüyor
- [ ] HTTP istemci logunda Authorization/API key görünmüyor (testli)

---

## F3 — Ödeme: iyzico
**Hedef:** Üretime hazır iyzico payment provider. Detay: `docs/entegrasyonlar/iyzico.md`

- F3.1 `client.ts`: imzalı istek üretimi, sandbox/prod ayrımı (env), tip güvenli yanıtlar
- F3.2 `initiatePayment`: Checkout Form başlatma; basket item'lar sunucudaki sepetten üretilir
- F3.3 Callback akışı: `POST /hooks/iyzico/callback` → token ile sonuç sorgusu → cart complete workflow
- F3.4 `authorizePayment` / `capturePayment` / `getPaymentStatus` / `retrievePayment`
- F3.5 `refundPayment`: tam ve kısmi iade (kalem bazlı transaction ID eşlemesi)
- F3.6 `cancelPayment`: aynı gün iptal / sonrası iade mantığı
- F3.7 Webhook: imza doğrulama, idempotency tablosu, `getWebhookActionAndData`
- F3.8 Taksit: `POST /store/payment/installments` (BIN + tutar → banka/taksit tablosu), cache'li
- F3.9 Admin widget: sipariş detayında iyzico işlem bilgisi (paymentId, taksit, kart ailesi, son 4 hane maskeli)
- F3.10 Mock iyzico sunucusu (`packages/testing`) + entegrasyon testleri

**KK:**
- [ ] Sandbox'ta tek çekim + taksitli ödeme uçtan uca başarılı
- [ ] 3DS başarısız/iptal senaryosu sepeti bozmadan geri dönüyor
- [ ] Aynı callback iki kez gelirse tek sipariş oluşuyor
- [ ] Kısmi iade doğru kalemlerden düşüyor
- [ ] Tutar manipülasyonu (istemci tutarı) etkisiz (testli)
- [ ] Kapsam ≥ %80

---

## F4 — Ödeme: PayTR + Ödeme Yönlendirici
- F4.1 `payment-paytr` provider: iFrame token, HMAC hash, bildirim URL'i ("OK" yanıtı), iade
- F4.2 Region'a birden fazla provider tanımlama; tenant ayarıyla birincil/yedek seçimi
- F4.3 Yönlendirici kuralları (platform-settings): varsayılan provider, provider sağlık durumu kötüyse yedek
- F4.4 Ortak ödeme test paketi: her provider aynı sözleşme testlerinden geçer (contract tests)

**KK:**
- [ ] Birincil provider devre dışıyken checkout yedekle tamamlanıyor
- [ ] Her iki provider da ortak contract test paketini geçiyor

---

## F5 — Kargo: Geliver + İade
Detay: `docs/entegrasyonlar/geliver.md`

- F5.1 `fulfillment-geliver` provider: `getFulfillmentOptions`, `validateFulfillmentData`, `validateOption`
- F5.2 `canCalculate` / `calculatePrice`: desi hesaplama (ürün ölçü/ağırlık) + teklif, cache'li
- F5.3 `createFulfillment`: gönderi oluşturma, etiket PDF → obje depolama, takip no kaydı
- F5.4 `cancelFulfillment`, `createReturnFulfillment` (iade kodu)
- F5.5 Takip webhook'u: `POST /hooks/geliver` → imza/doğrulama → fulfillment durum güncelleme → event
- F5.6 Fallback: webhook gelmeyen gönderiler için scheduled job ile periyodik sorgu
- F5.7 Admin: toplu etiket basma, kargo durum sütunu, "kargoya hazır" listesi
- F5.8 Ürün ölçü/ağırlık zorunluluğu (fiziksel ürünlerde), koli birleştirme kuralı (ayar)

**KK:**
- [ ] Test ortamında sipariş → etiket → takip ilerlemesi → "teslim edildi" akışı çalışıyor
- [ ] Ölçüsü eksik ürünle kargo hesabı açıklayıcı hata veriyor
- [ ] İade talebinden iade koduna kadar akış çalışıyor
- [ ] Webhook ve polling aynı güncellemeyi iki kez uygulamıyor

---

## F6 — E-Fatura / E-Arşiv
Detay: `docs/entegrasyonlar/e-fatura.md`

- F6.1 `einvoice` modülü: Invoice modeli (sipariş ref, UUID, numara, durum, PDF url, hata)
- F6.2 `InvoiceAdapter` arayüzü + ilk adaptör (seçilen entegratör)
- F6.3 Fatura tipi belirleme: alıcı VKN'li ve e-fatura mükellefi ise e-Fatura, değilse e-Arşiv (mükellef sorgusu)
- F6.4 Workflow: tetikleme zamanı tenant ayarı (sipariş/kargo); retry + dead-letter
- F6.5 İade/iptal faturası akışı
- F6.6 Admin: fatura durumu widget'ı, PDF indir, "yeniden dene"

**KK:**
- [ ] Test ortamında bireysel (e-Arşiv) ve kurumsal (e-Fatura) fatura kesiliyor
- [ ] Entegratör hata verirse sipariş akışı bozulmuyor, fatura "beklemede" kalıp retry ediliyor
- [ ] Aynı sipariş için mükerrer fatura oluşmuyor

---

## F7 — Bildirimler
Detay: `docs/entegrasyonlar/sms.md`

- F7.1 `notification-email` provider (Resend/SES), dev'de Mailpit
- F7.2 `notification-sms` provider (Netgsm vb.)
- F7.3 Şablon sistemi: React Email veya MJML; tenant marka renkleri/logo `platform-settings`'ten
- F7.4 Olaylar: sipariş alındı, ödeme başarısız, kargoya verildi, teslim edildi, iade onaylandı, şifre sıfırlama
- F7.5 İşlemsel ↔ ticari ileti ayrımı; ticari iletiler İYS izni olmadan gönderilmez

**KK:**
- [ ] Tüm olaylar Mailpit'te doğru şablonla görünüyor
- [ ] İzni olmayan müşteriye ticari SMS gitmiyor (testli)

---

## F8 — Admin Genişletmeleri
Detay: `docs/06-admin-ux.md`

- F8.1 Dashboard widget'ları: günlük ciro, bekleyen siparişler, kargoya hazır, başarısız ödeme/fatura
- F8.2 "Entegrasyonlar" sayfası: provider durumu, bağlantı testi, son hatalar (secret göstermez)
- F8.3 Sipariş operasyon ekranı: filtreler (ödeme/kargo/fatura durumu), toplu işlemler
- F8.4 Ayarlar: feature flag'ler, attribute şablonları, yasal metin sürümleri
- F8.5 Audit log görüntüleyici
- F8.6 Rol bazlı yetki: owner, admin, operasyon, salt-okunur

**KK:**
- [ ] Operasyon rolü ayarları değiştiremiyor (testli)
- [ ] Tüm admin sayfaları Türkçe, boş/hata/yükleniyor durumları tasarlanmış

---

## F9 — Uyum ve Yasal Özellikler
- F9.1 `legal-consent`: sözleşme şablonları sürümlü (mesafeli satış, ön bilgilendirme, KVKK aydınlatma, çerez)
- F9.2 Checkout'ta onay kaydı: sürüm, zaman, IP, sipariş verisiyle doldurulmuş metnin snapshot'ı
- F9.3 Yaş doğrulama (feature flag `age_verification`): beyan + doğum tarihi kontrolü; ürün/kategori bazlı
- F9.4 Kısıtlı ürün kategorisi işareti (flag ile): satış öncesi ek onay / tenant uyarısı
- F9.5 KVKK: kişisel veri dışa aktarma ve silme/anonimleştirme talebi akışı, saklama süreleri job'u
- F9.6 Cayma hakkı süresi takibi ve iade penceresi kuralları

**KK:**
- [ ] Her siparişte ilgili sözleşme snapshot'ı ve onay kaydı mevcut
- [ ] Flag açıkken yaş onayı olmadan kısıtlı ürünlü sepet tamamlanamıyor
- [ ] Anonimleştirme sonrası siparişin muhasebe verisi korunuyor, kişisel veri temizleniyor

---

## F10 — Sertleştirme
- F10.1 Güvenlik review (`/guvenlik-review` + `security-reviewer` ajanı), bulguların kapatılması
- F10.2 Rate limiting, güvenlik header'ları, CORS sıkılaştırma
- F10.3 Yük testi (k6): checkout, ürün listeleme, webhook patlaması
- F10.4 Gözlemlenebilirlik: yapılandırılmış log (pino), OpenTelemetry trace, Sentry
- F10.5 Yedekleme ve geri yükleme provası

**KK:**
- [ ] Kritik/yüksek güvenlik bulgusu yok
- [ ] Hedef yük altında p95 < 500 ms (Store API okuma), checkout hata oranı < %0,5
- [ ] Geri yükleme provası dokümante ve başarılı

---

## F11 — Dağıtım ve Tenant Provisioning
Detay: `docs/08-devops.md`

- F11.1 Üretim Dockerfile (multi-stage, non-root), server/worker ayrı süreç
- F11.2 Tenant şablonu: env şablonu, DB oluşturma, migration, admin kullanıcı, seed
- F11.3 `infra/tenant/create-tenant` script'i (idempotent)
- F11.4 CI/CD: staging otomatik, prod onaylı; migration stratejisi (geri uyumlu)
- F11.5 Tüm tenant'lara sürüm yayma (rolling, canary tenant)

**KK:**
- [ ] Tek komutla yeni tenant ayağa kalkıyor ve health check yeşil
- [ ] Sürüm yükseltmede kesinti yok (rolling)

---

## F12 — Control Plane (sonraki)
Tenant kayıt, abonelik/faturalama, secret girişi (şifreli), provisioning tetikleme, sürüm yönetimi.
Ayrı uygulama (`apps/control-plane`). Başlamadan önce ayrı ADR.

---

## F13 — Storefront ve Çoklu Tema (sonraki aşama)
Şimdi kod yazılmaz, ama backend şu garantileri verir:
- Store API tema bağımsızdır; tema'ya özel alan backend'e sızmaz.
- Tema ayarları (renk, logo, layout seçimi) `platform-settings`'te JSON şema ile tutulabilir.
- `packages/types` Store API sözleşmesini taşır; temalar bu sözleşmeye bağlanır.
- Planlanan yapı: `apps/storefront` (Next.js) + `packages/themes/<tema>` + ortak `packages/ui`.
