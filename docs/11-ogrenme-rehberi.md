# 11 — Öğrenme Rehberi: Teknolojiler, Terimler, Kim Neyi Yönetir

> Bu doküman insan okuyucu içindir (proje sahibi). Claude'un görev için okuması gerekmez.
> Amaç: projede geçen her teknolojiyi ve terimi "ne, neden, nerede" sorularıyla hızlıca kavramak.

---

## 1. Tek paragrafta proje

Birçok farklı mağazaya (müşteri = **tenant**) e-ticaret altyapısı sağlıyoruz. Her mağazaya kendi
"dükkanı" kurulur: ayrı bir Medusa sunucusu ve ayrı veritabanı (**instance-per-tenant**). Mağaza sahibi
ürünlerini **Admin panel**den yönetir, müşteriler ileride **Storefront** (vitrin sitesi) üzerinden alışveriş
yapar. Ödeme (iyzico/PayTR), kargo (Geliver), e-fatura, SMS/e-posta gibi dış servisleri biz bağlarız ama
hesaplar mağazanın kendisine aittir. Kod hiçbir sektöre özel değildir; bıçak satan da giyim satan da
aynı kodu kullanır, farkı **ayarlar** (feature flag + attribute şablonu) belirler.

**Benzetme:** Bir AVM işletmecisi düşün. Her kiracıya (tenant) aynı projeden ama ayrı duvarlı, ayrı kasalı
bir dükkan inşa ediyorsun. Elektrik/su (ödeme, kargo, fatura) şirketleriyle bağlantıyı sen kuruyorsun,
ama faturayı kiracı kendi adına ödüyor.

---

## 2. Büyük resim: kim kimin üstünde

```
 [Müşteri tarayıcısı]        [Mağaza çalışanı]
        │                           │
   Storefront (F18)            Admin Panel (React, Medusa içinde)
        │  Store API                │  Admin API
        └────────────┬──────────────┘
                     ▼
          ┌─────── Medusa Backend (Node.js + TypeScript) ───────┐
          │  API route → Workflow → Step → Module/Provider      │
          │  Subscriber (olay dinler)   Job (zamanlı iş)        │
          │  server süreci (istek karşılar) + worker (ağır iş)  │
          └───┬───────────┬──────────────┬──────────────────────┘
              ▼           ▼              ▼
         PostgreSQL     Redis        S3 (SeaweedFS)      Dış servisler:
         (kalıcı veri)  (kuyruk,     (görsel, PDF)       iyzico, PayTR, Geliver,
                        cache, kilit)                    e-fatura, SMS, e-posta
```

Bunların hepsi **tek bir tenant** içindir. 10 mağaza = bu kutudan 10 tane. Bunları üstten yöneten
yapı ileride **Control Plane** (F17) olacak.

---

## 3. Teknolojiler — ne işe yarar, neden biz

### 3.1 Dil ve çalışma ortamı
| Teknoloji | Ne | Bizde ne yapar | Neden |
|---|---|---|---|
| **Node.js** | JavaScript'i sunucuda çalıştıran motor | Backend'in çalıştığı ortam | Medusa Node üzerine kurulu |
| **TypeScript** | Tip eklenmiş JavaScript | Tüm kod bununla yazılır | Hataları çalıştırmadan, yazarken yakalar |
| **strict mode** | TypeScript'in en katı ayarı | `any` yasak, null kontrolleri zorunlu | Ödeme kodunda "belki undefined" hatası para kaybettirir |
| **Zod** | Çalışma anında veri doğrulama kütüphanesi | Gelen istekleri, env değişkenlerini, dış API yanıtlarını doğrular | TypeScript sadece yazarken korur; Zod çalışırken korur |

### 3.2 Repo ve paket yönetimi
| Teknoloji | Ne | Bizde ne yapar | Neden |
|---|---|---|---|
| **Git** | Versiyon kontrol | Her değişikliğin geçmişi | Geri alma, kim neyi değiştirdi |
| **GitHub** | Git'in bulut evi | Repo (`eticaret-platform`), PR, CI | Yedek + iş birliği + otomasyon |
| **Monorepo** | Birden çok uygulama/paket tek repoda | `apps/backend`, ileride `apps/storefront`, `packages/*` | Ortak tipler ve ayarlar tek yerde, tek PR'da hepsi güncellenir |
| **pnpm** | Paket yöneticisi (npm alternatifi) | Bağımlılıkları kurar | Hızlı, disk tasarruflu, katı (gizli bağımlılığa izin vermez) |
| **pnpm workspaces** | Monorepo içindeki paketleri birbirine bağlar | `backend`, `packages/config`'i kullanabilir | Paketleri npm'e yayınlamadan paylaşmak |
| **Lockfile** (`pnpm-lock.yaml`) | Kurulan her paketin tam sürüm kaydı | Herkesin makinesinde aynı sürümler | "Bende çalışıyordu" sorununu bitirir; supply-chain güvenliği |
| **Turborepo** | Monorepo görev koşucusu | `pnpm lint/build/test`'i tüm paketlerde sırayla ve önbellekli çalıştırır | Değişmeyen paketi tekrar derlemez, zaman kazandırır |

### 3.3 Uygulama çatısı
| Teknoloji | Ne | Bizde ne yapar |
|---|---|---|
| **Medusa.js v2** | Açık kaynak "headless" e-ticaret motoru | Ürün, sepet, sipariş, müşteri, ödeme, kargo altyapısının hazır gelmesi |
| **Headless** | Arka uç ile görünümün ayrı olması | Backend sadece API sunar; vitrin (tema) tamamen ayrı yazılır → çoklu tema mümkün |
| **Medusa Admin** | Medusa ile gelen React yönetim paneli | Mağaza sahibinin kullandığı panel; biz widget/sayfa ekleyerek genişletiriz |
| **Admin SDK** | Admin'e eklenti yazma aracı | `defineWidgetConfig` (mevcut sayfaya kutu ekle), `defineRouteConfig` (yeni sayfa) |
| **@medusajs/ui** | Medusa'nın hazır bileşen kütüphanesi | Admin'de buton, tablo, form; görünüm tutarlı kalsın diye sadece bu |
| **TanStack Query** | Sunucudan veri çekme + önbellek (React) | Admin sayfalarında veri yükleme |
| **React Hook Form** | Form yönetimi | Admin formları (Zod ile doğrulanır) |
| **i18n** | Çoklu dil altyapısı | Ekran metinleri `tr.json`'dan anahtarla okunur, koda Türkçe metin gömülmez |

### 3.4 Veri ve altyapı servisleri
| Teknoloji | Ne | Bizde ne yapar | Benzetme |
|---|---|---|---|
| **PostgreSQL** | İlişkisel veritabanı | Ürün, sipariş, müşteri — kalıcı her şey | Arşiv dolabı |
| **Redis** | Bellek içi hızlı veri deposu | Event bus (olay kuyruğu), workflow motoru, cache, kilit (lock), rate limit sayacı | Masadaki not kâğıtları + sıra numaratörü |
| **S3 / obje depolama** | Dosya deposu | Ürün görselleri, kargo etiketi PDF, fatura PDF | Depo |
| **SeaweedFS** | S3'ün yerel (bilgisayarında çalışan) taklidi | Geliştirmede S3 yerine | Depo maketi |
| **Mailpit** | Sahte e-posta sunucusu | Geliştirmede giden e-postaları yakalar, tarayıcıda gösterir; gerçek kimseye gitmez | Postacının çantasına bakmak |
| **Meilisearch** | Arama motoru | İleride ürün araması (F18) | Kütüphane kataloğu |
| **CDN** | İçerik dağıtım ağı | Görselleri müşteriye yakın sunucudan hızlı verir | Şubeler |

### 3.5 Docker ve ortamlar
| Terim | Açıklama |
|---|---|
| **Docker** | Uygulamayı ve bağımlılıklarını "konteyner" denen paketlere koyar; her makinede aynı çalışır |
| **Image (imaj)** | Konteynerin kalıbı. Bir kere build edilir, her yerde aynı çalışır |
| **Container** | İmajın çalışan hali |
| **docker compose** | Birden çok konteyneri tek dosyayla ayağa kaldırır (`compose.dev.yml`: Postgres + Redis + Mailpit + SeaweedFS) |
| **Multi-stage Dockerfile** | Build araçlarını son imaja koymadan küçük, güvenli imaj üretme |
| **non-root** | Konteyner içinde yönetici olmayan kullanıcıyla çalışmak (saldırı olursa hasar sınırlı) |
| **local / staging / prod** | Senin makinen / test sunucusu (sandbox hesaplarla) / gerçek müşteriler |
| **sandbox** | Sağlayıcıların test ortamı: gerçek para dönmez, sahte kartlarla denenir |

### 3.6 Kod kalitesi araçları
| Araç | Görevi |
|---|---|
| **ESLint** | Kod hatası ve kötü desen yakalar ("linter") |
| **Prettier** | Kodu otomatik biçimlendirir (boşluk, tırnak) — stil tartışmasını bitirir |
| **tsconfig** | TypeScript ayar dosyası; `packages/config`'te ortak tutulur |
| **typecheck** | Tüm projede tip hatası taraması (`tsc --noEmit`) |
| **Git hooks** | Commit/push öncesi otomatik çalışan scriptler |
| **lint-staged** | Sadece değişen dosyalarda lint/format çalıştırır (hızlı hook) |
| **Conventional Commits** | Commit mesajı formatı: `feat(payment-iyzico): add partial refund` |
| **commitlint** | Bu formata uymayan commit'i reddeder |

### 3.7 Test araçları
| Araç | Seviye | Ne test eder |
|---|---|---|
| **Jest / Vitest** | Unit | Tek fonksiyon: tutar dönüşümü, imza hesabı, desi |
| **Medusa test-utils** | Entegrasyon | `moduleIntegrationTestRunner` (modül + gerçek DB), `medusaIntegrationTestRunner` (HTTP isteğinden veritabanına tüm yol) |
| **Mock sunucu / msw** | — | iyzico, Geliver vb.'nin sahtesi; testlerde gerçek servise asla gidilmez |
| **Contract test** | Sözleşme | iyzico ve PayTR aynı test paketinden geçer → yer değiştirilebilir oldukları kanıtlanır |
| **Playwright** | E2E | Gerçek tarayıcıda admin'i tıklayarak test |
| **axe** | Erişilebilirlik | Kontrast, klavye, ekran okuyucu uyumu |
| **k6** | Yük testi | "Dakikada 1000 istek gelirse ne olur?" |
| **Coverage (kapsam)** | Metrik | Kodun yüzde kaçı testlerle çalıştırıldı (ödeme/kargo/fatura ≥ %80) |

### 3.8 CI/CD ve bakım
| Terim | Açıklama |
|---|---|
| **CI** (Continuous Integration) | Her push'ta otomatik lint + typecheck + test + build. "CI yeşil" = hepsi geçti |
| **CD** (Continuous Delivery/Deployment) | Geçen kodu otomatik olarak sunucuya dağıtmak (staging otomatik, prod onaylı) |
| **GitHub Actions** | GitHub'ın CI/CD servisi (`.github/workflows/*.yml`) |
| **PR** (Pull Request) | "Bu değişikliği ana dala alalım mı?" talebi; review + CI burada olur |
| **Renovate** | Bağımlılık güncellemelerini otomatik PR olarak açan bot |
| **pnpm audit** | Bilinen güvenlik açığı olan paketleri raporlar |
| **gitleaks** | Repoya yanlışlıkla şifre/anahtar girmesini yakalar |

### 3.9 Gözlemlenebilirlik (canlıda ne oluyor?)
| Araç | Soru | Açıklama |
|---|---|---|
| **pino** | "Ne oldu?" | JSON formatında log; her satırda tenant + korelasyon ID |
| **Korelasyon ID** | "Bu log hangi isteğe ait?" | Bir isteğin tüm adımlarını birbirine bağlayan kimlik |
| **OpenTelemetry (trace)** | "Nerede yavaşladı?" | İsteğin hangi adımda ne kadar sürdüğünü gösterir |
| **Sentry** | "Neresi patladı?" | Hataları toplar, gruplar, bildirir |
| **Grafana / Tempo / Honeycomb** | Görselleştirme | Trace ve metrikleri grafikle izleme |
| **Health check** | "Sağ mı?" | `/health` gibi bir uç; yük dengeleyici buna bakıp trafiği yönlendirir |

---

## 4. Medusa kavramları sözlüğü (en önemli bölüm)

Medusa'yı bir **fabrika** gibi düşün:

| Kavram | Fabrika benzetmesi | Gerçek tanım | Kural |
|---|---|---|---|
| **Module** | Bir departman (depo, muhasebe) | Kendi veri modeli + servisi olan bağımsız birim (`product`, `order`, bizim `tr-address`) | Başka departmanın dolabını açamaz |
| **Service** | Departmanın memuru | Modülün içindeki iş fonksiyonları (`createProducts`, `listOrders`) | |
| **Data model** | Formun şablonu | Veritabanı tablosunun tanımı (`model.define(...)`) | |
| **Migration** | Dolap tadilatı planı | Veritabanı şemasını değiştiren sürümlü script | Geri uyumlu yazılır |
| **Module Provider** | Departmanın dış tedarikçi bağlantısı | Bir modülün dış servise açılan adaptörü: Payment modülü → iyzico provider | Dış servisin detayı dışarı sızmaz |
| **Link** | Departmanlar arası çapraz referans | İki modülün kaydını birbirine bağlar (sipariş ↔ fatura) | Modüller birbirini doğrudan çağırmaz, link kullanılır |
| **Query (`query.graph`)** | Tüm departmanlardan tek seferde rapor | Linkli verileri tek sorguda çeker | N+1 sorgu sorununu önler |
| **Workflow** | Bir iş emri (sipariş → etiket → fatura) | Birden çok adımı sırayla/paralel yürüten iş akışı | İş mantığının evi |
| **Step** | İş emrindeki tek görev | Workflow'un tek atomik parçası | **Idempotent** olmalı |
| **Compensation** | "Geri al" talimatı | Sonraki adım patlarsa önceki adımın etkisini geri alan fonksiyon | Dış servis çağıran her adımda zorunlu |
| **API Route** | Resepsiyon | HTTP isteğini alır: doğrula → workflow çağır → yanıt dön | İnce kalır, iş mantığı içermez |
| **Middleware** | Kapıdaki güvenlik | Route'tan önce çalışır: auth, rol kontrolü, doğrulama, rate limit | |
| **Store API** | Müşteri kapısı (`/store/...`) | Vitrinin kullandığı açık API | Tema bağımsız |
| **Admin API** | Personel kapısı (`/admin/...`) | Admin panelin kullandığı yetkili API | Rol kontrolü zorunlu |
| **Webhook / hooks route** | Dışarıdan gelen telefon | Sağlayıcının bize bildirim attığı uç (`/hooks/iyzico/...`) | İmza doğrula, hemen 200 dön |
| **Event** | Anons: "Sipariş verildi!" | `order.placed` gibi sistem olayları (Redis event bus üzerinden) | |
| **Subscriber** | Anonsu dinleyen kişi | Event gelince tepki verir (ör. e-posta workflow'unu başlat) | İnce kalır, workflow tetikler |
| **Scheduled Job** | Alarmlı görev | Belirli aralıkla çalışan iş (kargo durumu sorgula) | Kilitli + idempotent |
| **Container (DI)** | Fabrikanın santrali | Servislere isimle erişilen bağımlılık enjeksiyonu kutusu | |
| **workerMode** | Ön büro / arka atölye | `server` istekleri karşılar, `worker` ağır işleri (PDF, e-posta) yapar; geliştirmede `shared` | Prod'da ayrı süreçler |
| **Region** | Satış bölgesi | Ülke + para birimi + vergi + ödeme/kargo sağlayıcıları (bizde: Türkiye, TRY) | |
| **Sales Channel** | Satış kanalı | Web, mobil, pazaryeri gibi kanallar | |
| **Payment Collection / Session** | Kasa / kasadaki işlem | Bir sepetin ödeme kaydı ve sağlayıcıyla açılan ödeme oturumu | Session ID = iyzico `conversationId` |
| **Fulfillment** | Gönderi | Siparişin kargoya verilmesi; admin terimi "Gönderi" | |
| **Seed** | Fabrikaya ilk malzeme | Başlangıç verisi yükleyen script (region, vergi, demo ürün) | |

**Akılda tutulacak altın zincir:** `Route → Workflow → Step → Module/Provider`.
Yukarıdan aşağı çağrılır; aşağıdakiler yukarıyı bilmez.

---

## 5. E-ticaret ve Türkiye'ye özel terimler

### Ödeme
| Terim | Açıklama |
|---|---|
| **Hosted ödeme (Checkout Form / iFrame)** | Kart bilgisi bizim sistemimize hiç girmez; iyzico/PayTR'nin sayfasında girilir |
| **PCI DSS / SAQ-A** | Kart verisi güvenlik standardı. Hosted ödeme sayesinde en hafif seviyede (SAQ-A) kalırız |
| **3DS (3D Secure)** | Bankanın SMS şifresi adımı |
| **Taksit / BIN** | BIN = kartın ilk 6-8 hanesi; hangi banka/kart ailesi olduğunu ve taksit seçeneklerini belirler |
| **Authorize / Capture** | Provizyon (parayı ayır) / tahsil (parayı çek). iyzico ikisini birden yapar |
| **Refund / Cancel** | İade (sonradan para geri) / iptal (gün sonu öncesi işlemi silmek) |
| **Kısmi iade** | Siparişteki bazı kalemlerin iadesi; iyzico'da kalem bazlı `paymentTransactionId` ile |
| **Callback** | Ödeme sonrası kullanıcının tarayıcısının bize dönmesi. **Gövdesine güvenilmez**, sonuç API'den tekrar sorgulanır |
| **Ödeme yönlendirici** | Birincil sağlayıcı (iyzico) çökerse yedeğe (PayTR) geçme mantığı |

### Kargo
| Terim | Açıklama |
|---|---|
| **Geliver** | Birden çok kargo firmasını tek API'de toplayan aracı (aggregator) |
| **Desi** | Hacimsel ağırlık: (en × boy × yükseklik) / 3000. Ağırlıkla kıyaslanır, büyüğü ücretlendirilir |
| **Etiket** | Kolinin üstüne yapıştırılan barkodlu PDF |
| **Takip no / tracking** | Kargonun izlendiği numara |
| **Polling** | Webhook gelmezse periyodik olarak "ne durumda?" diye sormak |

### Fatura ve vergi
| Terim | Açıklama |
|---|---|
| **KDV** | Katma Değer Vergisi; ürün grubuna göre oranlar |
| **e-Fatura** | Alıcı da e-fatura mükellefiyse (şirketse) kesilen elektronik fatura |
| **e-Arşiv** | Alıcı mükellef değilse (bireysel) kesilen elektronik fatura |
| **Mükellef sorgusu** | VKN'nin e-fatura sistemine kayıtlı olup olmadığını kontrol etme |
| **VKN / TCKN** | Vergi Kimlik No (şirket) / TC Kimlik No (birey) |
| **Entegratör** | GİB'e fatura iletmemizi sağlayan özel firma (ör. Nilvera); biz adaptörle bağlanırız |
| **UBL-TR** | Türkiye e-fatura XML formatı |
| **Dead-letter** | Defalarca denenip başarısız olan işin düştüğü "insan baksın" kutusu |

### Hukuk ve uyum
| Terim | Açıklama |
|---|---|
| **KVKK** | Kişisel Verilerin Korunması Kanunu (Türkiye'nin GDPR'ı) |
| **Maskeleme** | `123******45` gibi kısmi gösterim |
| **Anonimleştirme** | Kişisel veriyi geri döndürülemez şekilde silmek; muhasebe kaydı korunur |
| **İYS** | İleti Yönetim Sistemi; ticari SMS/e-posta için izin kaydı zorunlu |
| **İşlemsel / ticari ileti** | "Siparişiniz kargoda" (izin gerekmez) / "Kampanya!" (İYS izni şart) |
| **Mesafeli satış sözleşmesi / Ön bilgilendirme** | Online satışta yasal zorunlu metinler; onay anının snapshot'ı saklanır |
| **Cayma hakkı** | Müşterinin belirli süre içinde gerekçesiz iade hakkı |

---

## 6. Mimari ve SaaS terimleri

| Terim | Açıklama |
|---|---|
| **Tenant** | Platformumuzu kullanan her mağaza (müşterimiz) |
| **Multi-tenant** | Tek platform, çok müşteri |
| **Instance-per-tenant** | Her tenant'a ayrı süreç + ayrı DB. Avantaj: izolasyon, KVKK, kolay yedek. Dezavantaj: maliyet, çok sunucuyu güncelleme otomasyonu |
| **Control Plane** | Tenant'ları yöneten üst uygulama: kayıt, abonelik, secret girişi, kurulum (F17) |
| **Provisioning** | Yeni tenant'ı otomatik kurma (DB, secret, migration, admin kullanıcı, başlatma) |
| **Feature flag** | Kodu değiştirmeden bir özelliği açıp kapatma anahtarı (`age_verification`, `cash_on_delivery`) |
| **Attribute şablonu** | Sektöre göre ürün alanları ("Kesici Alet" → çelik tipi; "Giyim" → beden) |
| **Provider deseni / Adapter** | Her dış servis aynı arayüzün arkasında; sağlayıcı değiştirmek = yeni adaptör yazmak |
| **ADR** (Architecture Decision Record) | "Neden böyle karar verdik?" belgesi (`adr/`). Sonradan "bunu neden yaptık?" sorusunun cevabı |
| **Canary tenant** | Yeni sürümü önce tek (kendi demo) mağazaya yaymak, sorun yoksa diğerlerine |
| **Rolling restart / deploy** | Sunucuları tek tek yeniden başlatmak → kesinti yok |
| **Expand → migrate → contract** | DB değişikliği 3 adımda: yeni kolonu ekle → veriyi taşı → eskiyi sil. Geri alma güvenli kalır |

---

## 7. Güvenlik terimleri

| Terim | Açıklama |
|---|---|
| **Secret** | API anahtarı, şifre gibi gizli değerler. Koda, loga, repoya asla girmez |
| **Env (ortam değişkeni)** | Uygulamaya dışarıdan verilen ayar (`IYZICO_API_KEY`). Geliştirmede `.env` dosyası (git'e girmez) |
| **`env.example`** | Hangi değişkenlerin gerektiğini gösteren, değerleri boş şablon (git'e girer). Yaygın adı `.env.example`; bu repoda başında nokta yok çünkü `.env*` Claude Code'a kapalı |
| **Secret manager** | Prod'da secret'ların şifreli tutulduğu kasa |
| **Redaksiyon** | Logda gizli alanları `[REDACTED]` yapmak |
| **HMAC / imza** | Gelen isteğin gerçekten iyzico/PayTR'den geldiğini kanıtlayan şifreli damga |
| **timingSafeEqual** | İmzayı karşılaştırırken süre farkından bilgi sızdırmayan karşılaştırma |
| **Idempotency** | Aynı istek 2 kez gelse de sonuç 1 kez uygulanır (mükerrer callback → tek sipariş) |
| **Replay attack** | Eski geçerli bir isteği tekrar göndermek; idempotency + zaman kontrolü ile önlenir |
| **RBAC** | Rol bazlı yetki: owner / admin / operasyon / salt-okunur |
| **2FA (TOTP)** | Şifre + telefondaki 6 haneli kod |
| **Rate limiting** | Belirli sürede izin verilen istek sayısı (kaba kuvvet saldırısına karşı) |
| **CORS** | Tarayıcıda hangi sitelerin API'mizi çağırabileceği |
| **HSTS / CSP / X-Frame-Options** | Tarayıcıya güvenlik talimatı veren HTTP başlıkları |
| **Least privilege** | Her kullanıcıya/servise yalnızca gerektiği kadar yetki |
| **Supply-chain saldırısı** | Kullandığımız bir npm paketinin ele geçirilmesi. Lockfile + audit + yeni sürümleri 14 gün bekletme ile korunuruz |

---

## 8. Performans ve dayanıklılık terimleri

| Terim | Açıklama |
|---|---|
| **p95** | İsteklerin %95'i bu süreden hızlı. Ortalamadan daha dürüst metrik |
| **Cache / TTL** | Sık sorulan cevabı geçici saklamak / saklama süresi |
| **N+1 sorgu** | 100 ürün için 1 + 100 ayrı sorgu atma hatası; `query.graph` ile tek sorguya indirilir |
| **İndeks** | DB'de arama hızlandıran fihrist |
| **Sayfalama (pagination)** | Listeyi parça parça getirmek (max 100) |
| **Connection pool** | DB bağlantılarını yeniden kullanmak için havuz |
| **Timeout** | Dış servis cevap vermezse ne kadar beklenecek |
| **Retry + exponential backoff** | Hata olursa tekrar dene; her denemede bekleme süresini artır |
| **Circuit breaker** | Servis sürekli hata veriyorsa bir süre hiç çağırma (sigorta gibi atar) |
| **Asenkron / kuyruk** | Ağır işi hemen yapmayıp worker'a bırakmak; kullanıcı beklemez |
| **Graceful shutdown** | Kapanırken elindeki işi bitirip öyle kapanmak |
| **PITR / WAL** | Veritabanını geçmişteki herhangi bir ana geri döndürebilme |

---

## 9. Bir siparişin yolculuğu (her şeyi birleştiren hikâye)

1. **Müşteri sepeti onaylar** → Store API → Payment Session açılır → **iyzico provider** `initiatePayment`
   ile Checkout Form başlatır. Tutar **sunucudaki sepetten** hesaplanır, istemciden alınmaz.
2. Müşteri iyzico sayfasında kartını girer, **3DS** onayı verir.
3. iyzico **callback** ile `/hooks/iyzico/callback`'e döner → biz sonucu iyzico API'den **tekrar sorgularız**
   → **idempotency** kontrolü → `cart complete` **workflow**'u çalışır → sipariş oluşur.
4. Sistem `order.placed` **event**'ini yayınlar (Redis event bus).
5. **Subscriber**'lar duyar: e-posta/SMS bildirim workflow'u (worker'da), yasal onay snapshot'ı siparişe bağlanır.
6. Depo çalışanı Admin'den **Gönderi** oluşturur → **Geliver provider** etiket alır → PDF **S3**'e →
   takip no kaydedilir. Bir adım patlarsa **compensation** gönderiyi iptal eder.
7. Geliver **webhook** ile durum güncellemesi gönderir (gelmezse **job** ile polling) → müşteriye bildirim.
8. Kargoya verilince **e-fatura workflow**'u: mükellef sorgusu → e-Fatura/e-Arşiv → entegratör →
   başarısızsa **retry**, sonunda **dead-letter** + admin uyarısı.
9. Her adım **pino** ile loglanır (TCKN maskeli, anahtarlar redakte), **Sentry** hataları yakalar.

---

## 10. Kim neyi yönetir? (sorumluluk haritası)

| Konu | Kim/ne yönetir | Nerede |
|---|---|---|
| Paket kurulumu ve sürümleri | pnpm + lockfile | `package.json`, `pnpm-lock.yaml` |
| Hangi paket hangi görevi çalıştırır | Turborepo | `turbo.json` |
| Ortak TS/lint/format kuralları | `packages/config` | `packages/config/` |
| Yerel servisler (DB, Redis, mail, S3) | docker compose | `infra/docker/compose.dev.yml` |
| Medusa ayarları (modüller, DB, Redis) | Medusa config | `apps/backend/medusa-config.ts` |
| Veritabanı şeması | Migration'lar | `src/modules/*/migrations` |
| İş akışları | Workflow'lar | `src/workflows/` |
| Dış servis bağlantıları | Module provider'lar | `src/modules/payment-*`, `fulfillment-*`, `notification-*` |
| Admin ekranları | Admin SDK | `src/admin/` |
| Env doğrulama | Zod şeması | F0.6'da kurulacak |
| Secret'lar | `.env` (dev) / secret manager (prod) | Asla git'te değil |
| Kod kalitesi kapısı | ESLint, Prettier, typecheck, git hooks, CI | `.github/workflows/` |
| Mimari kararlar | ADR | `adr/` |
| İlerleme ve sıradaki görev | PROGRESS | `PROGRESS.md` |
| Claude'un kuralları | CLAUDE.md | kök + `apps/backend/CLAUDE.md` |
| Claude'un izinleri ve hook'ları | settings | `.claude/settings.json` |

---

## 11. Takıldığımda nereye / kime bakmalıyım?

| Durum | İlk bak | Sonra |
|---|---|---|
| "Şu an ne yapıyorduk?" | `PROGRESS.md` | `/oturum-baslat` |
| "Şu iş kodda nerede?" | `docs/16-proje-haritasi.md` → "X nerede?" tablosu | `apps/backend/src/api/middlewares.ts` |
| "Bu fazın bitme şartı ne?" | `docs/03-yol-haritasi.md` → **KK** listesi | `/faz-baslat F#` |
| "Bunu neden böyle yaptık?" | `adr/` | Yoksa yeni ADR yaz (`adr/0000-sablon.md`) |
| Medusa API'si nasıl kullanılır? | Claude → Context7 / `medusa-researcher` ajanı | docs.medusajs.com, Medusa GitHub/Discord |
| iyzico / PayTR / Geliver davranışı | `docs/entegrasyonlar/*.md` | Sağlayıcının resmi dokümanı, sandbox, teknik destek |
| Test kırıldı | Test çıktısının son satırları | `/test-yaz`, `test-writer` ajanı |
| CI kırmızı | GitHub → Actions → hatalı adımın logu | Lokal'de aynı komutu çalıştır (`pnpm lint`/`typecheck`) |
| Ödeme/kargo/fatura/auth kodu değişti | `/guvenlik-review` | `security-reviewer` ajanı (zorunlu) |
| Kod kalitesinden emin değilim | `code-reviewer` ajanı | `docs/10-kod-standartlari.md` |
| Canlıda hata | Sentry → log (korelasyon ID ile) → trace | Health check, Redis kuyruğu, worker durumu |
| E-posta gitmedi mi? (dev) | Mailpit arayüzü | Notification provider logu |
| Fatura kuralı / KDV / VKN-TCKN | **Mali müşavir (muhasebeci)** | Entegratörün destek ekibi |
| KVKK, mesafeli satış, İYS, yaş sınırı | **Avukat / KVKK danışmanı** | `legal-consent` modülü tasarımı |
| Mimari tercih (ör. yeni servis, yeni DB) | Önce ADR öner | Karar senin; Claude seçenek + artı/eksi sunar |

**Altın kural:** Takılınca kod yazmaya devam etme. Ya ADR (karar), ya PROGRESS'e "Açık soru" (bloklayıcı)
olarak yaz, sonra sor.

---

## 12. Proje yönetimi terimleri

| Terim | Açıklama |
|---|---|
| **Faz (F0…F19)** | Büyük iş bloğu; her fazın bir hedefi var |
| **Görev (F0.1 gibi)** | Tek oturuma sığacak iş |
| **KK (Kabul Kriteri)** | "Bitti" demek için doğrulanması gereken somut şartlar. Faz, tüm KK'lar ✅ olmadan kapanmaz |
| **Bloklayıcı** | İlerlemeyi durduran açık soru/bağımlılık |
| **Review** | Kodun başka göz (insan veya ajan) tarafından incelenmesi |
| **Regresyon testi** | Düzeltilen hatanın geri gelmediğini garanti eden test |
| **Teknik borç** | "Şimdilik böyle" kısayolların ileride ödenecek bedeli |

---

## 13. Claude Code ile çalışma düzenimiz

| Parça | Ne işe yarar |
|---|---|
| **CLAUDE.md** | Claude'un her oturumda okuduğu kısa kurallar. Detay `docs/`'ta, gerektiğinde okunur (token tasarrufu) |
| **PROGRESS.md** | Oturumlar arası hafıza: nerede kaldık, sırada ne var |
| **Plan modu** | Claude önce plan yazar, sen onaylarsın, sonra kod. Sürpriz değişiklik olmaz |
| **Slash komutları** (`.claude/commands/`) | Hazır tarifler: `/oturum-baslat`, `/faz-baslat`, `/yeni-modul`, `/entegrasyon-provider`, `/test-yaz`, `/guvenlik-review`, `/oturum-kapat` |
| **Alt ajanlar** (`.claude/agents/`) | Uzman yardımcılar: `medusa-researcher`, `security-reviewer`, `test-writer`, `code-reviewer`. Ana sohbeti kirletmeden iş yapar |
| **MCP** | Claude'a dış araç bağlama protokolü. **Context7** = güncel kütüphane dokümanı, **Playwright** = tarayıcı kontrolü |
| **Hook** | Otomatik tetiklenen komut. Bizde: Claude dosya düzenleyince Prettier çalışır |
| **Permissions** | Claude'un neyi serbestçe, neyi sorarak yapacağı, neyi hiç yapamayacağı (`.env` okuma ve `rm -rf` yasak) |

**Oturum döngüsü:** `/oturum-baslat` → plan → onay → kod + test → (gerekirse) güvenlik review → commit → `/oturum-kapat` → `/clear`

---

## 14. Faz haritası — her fazda ne öğreneceksin

| Faz | Konu | Öğreneceğin ana kavramlar |
|---|---|---|
| F0 | Repo ve araçlar | Monorepo, pnpm, Turborepo, Docker, CI, env doğrulama |
| F1 | Medusa çekirdek + TR | Region, vergi, ilk özel modül, seed, i18n |
| F2 | Platform çekirdeği | Feature flag, link, middleware, audit log, HTTP istemci deseni |
| F3 | Katalog, SEO, stok | Varyant, slug, 301 yönlendirme, stok rezervasyonu, yarış durumu, asenkron içe aktarma |
| F4 | Fiyat ve promosyon | Fiyat listesi, fiyat geçmişi, kupon, kampanya kuralları, oransal indirim dağıtımı |
| F5 | iyzico | Payment provider, callback, webhook, idempotency, kısmi iade |
| F6 | PayTR + havale + kapıda ödeme | HMAC, contract test, yedek sağlayıcı, manuel onaylı ödeme |
| F7 | Geliver + iade yönetimi | Fulfillment provider, desi, webhook + polling, RMA |
| F8 | E-fatura | Adapter deseni, retry, dead-letter |
| F9 | Bildirimler | Notification provider, şablon, İYS, SPF/DKIM/DMARC |
| F10 | Müşteri ve pazarlama | Auth provider, yorum moderasyonu, feed, Conversions API |
| F11 | Rapor, muhasebe, dış API | Raporlama sorguları, muhasebe adaptörü, API anahtarı, giden webhook, SSRF |
| F12 | Admin | Widget, route, RBAC, UX durumları |
| F13 | Yasal uyum | Sözleşme sürümleme, snapshot, çerez onayı, KVKK anonimleştirme |
| F14 | Veri taşıma | Kaynak adaptörü, dry-run, idempotent geçiş, URL eşleme |
| F15 | Sertleştirme | Güvenlik review, fraud kuralları, WAF, k6, OpenTelemetry, Sentry |
| F16 | Dağıtım ve tenant işletimi | Prod Dockerfile, provisioning, canary, SSL, yedek, destek erişimi |
| F17 | Control Plane | Onboarding, paket/limit, abonelik faturalama, secret yönetimi |
| F18 | Storefront | Next.js, çoklu tema (sonraki aşama) |
| F19 | Genişleme | Pazaryeri, B2B, yurt dışı, sadakat (sonraki aşama) |

---

## 15. Önerilen öğrenme sırası

1. **Git temelleri** (commit, branch, PR) — her şeyin güvenlik ağı.
2. **TypeScript temelleri** — tip, interface, async/await.
3. **HTTP ve REST** — GET/POST, durum kodları (200, 400, 401, 404, 500), JSON.
4. **Medusa'nın "Learn" bölümü** — sırasıyla: Modules → Workflows → API Routes → Subscribers → Admin.
5. **SQL'in temelleri** — tablo, ilişki, indeks (Postgres'i anlamak için).
6. **Docker temelleri** — imaj, konteyner, compose.
7. Her faz başında ilgili `docs/entegrasyonlar/*.md` dosyasını oku; o fazın terimlerini bu rehberden tekrar et.
