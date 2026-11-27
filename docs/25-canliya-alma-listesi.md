# Canlıya alma taslağı: My L'arte (ilk mağaza), F16

> Tarih: 2026-11-27. Durum: **taslak**. Sahibin kararlarıyla kesinleşir.
> Kaynaklar: `docs/03-yol-haritasi.md` (F16), `docs/08-devops.md`, `docs/04-guvenlik.md`, `docs/12-kod-disi-gereksinimler.md`, `docs/entegrasyonlar/*.md`, `docs/runbooks/*`, `adr/0003`, `adr/0061` ("F16'ya kalanlar"), `PROGRESS.md`, `progress/deniz.md`, `progress/oguzhan.md`, `apps/backend/env.example`, `apps/backend/src/lib/env.ts`, `apps/control-plane/env.example`, `apps/storefront/env.example`.
> Hedef sunucu: sahibin aaPanel VPS'i (Hosting Dünyam, İstanbul). Ubuntu 22.04, 4 çekirdek, 15 GB RAM (boş olan ~8 GB), 45 GB boş disk. Sunucuda PostgreSQL 16 ve Redis 7.4 yalnız yerelde çalışıyor; ayrıca Postfix ve 14 site daha var. Docker kurulu değil (`progress/deniz.md` 2026-11-10).

---

## 0. Kısa durum: önce bilinmesi gerekenler

1. **F16'nın kodu henüz yazılmadı.** Bugün depoda şunlar yok:
   - üretim Dockerfile'ı (`find` sonucu: hiçbir `Dockerfile` yok);
   - `DockerProvisioner` (`apps/control-plane/src/lib/provisioning/` altında yalnız `local` ve `fake` var);
   - üretim compose ya da systemd tanımı, ters vekil (nginx) yapılandırması;
   - `infra/tenant/create-tenant` (docs/08'e göre artık gerekmiyor; yerini provisioner aldı);
   - Trivy imaj taraması.

   `infra/` altında yalnız `backup/`, `docker/compose.dev.yml`, `k6/` ve `zap/` var. Canlıya almadan önce bunlar yazılmalı: aşağıda A1–A4.
2. **Sunucu ve işçi (worker) ayrımı yok.** `medusa-config.ts` `workerMode` ayarlamıyor, yani tek süreç hem API'yi hem 59 zamanlanmış işi koşuyor. İlk mağaza için bu yeterli. docs/08'deki "aynı imaj iki rolde" çalışma ise yazılmadı.
3. **Gerçek sağlayıcıyla doğrulanmış olan çok az.** Kanıtı olanlar:
   - iyzico sandbox'ı (2026-10-27 ve 2026-11-02);
   - TürkiyeAPI (geliştirmede gerçek API'ye gidiyor);
   - WordPress taşıma, mylarte'nin gerçek dışa aktarma dosyasıyla (2026-11-03);
   - Gemini ile metin önerisi ve Photoroom sandbox'ı (sahip, 2026-11-18);
   - PTT'ye tek bir uydurma hesap sorgusu (2026-11-27).

   PayTR, BirFatura, Aras, Yurtiçi, Netgsm, SMTP, Google, Meta ve GA4 **yalnız sahtelerle** sınandı. Ayrıntı §3'te.
4. **Mağaza üst panel olmadan canlıda açılmaz.** `lib/control-plane/env.ts` canlıda `CONTROL_PLANE_URL`, `CONTROL_PLANE_PUBLIC_KEYS`, `TENANT_ID` ve `TENANT_SIGNING_KEY` değişkenlerini zorunlu tutuyor. Bu yüzden üst panel de aynı sunucuda kurulmalı (ya da mağaza elle "yönetilen" kipte açılmalı, bkz. B2).
5. **Üst panel canlıda e-posta gönderemiyor.** Taşıyıcısı yalnız `mailpit` (`apps/control-plane/src/lib/env.ts:70`) ve canlıda reddediliyor. Davet bağlantısı onu oluşturan kişiye gösteriliyor. Ödeme hatırlatmaları gitmez (`adr/0061` "F16'ya kalanlar"). İlk mağaza için engel değil.
6. **Mağaza e-postası mağazanın kendi SMTP'sinden gider.** Mağaza SMTP hesabını kaydetmezse ve `EMAIL_TRANSPORT` da boşsa hiçbir e-posta gitmez (`lib/messaging/email/shop-transport.ts`). Canlıya almadan önce panelde SMTP kaydedilip deneme e-postası gönderilmeli.

---

## 1. Canlıya alma listesi (sıralı)

> Aşağıda ⛔ işareti canlıya çıkışı durduran maddeyi gösterir. ⚠ işareti yapılması gereken ama mağazanın açılmasını durdurmayan maddeyi gösterir.

### A. Sunucu ve altyapı

**A0. Karar ve boyut**
- [ ] ⛔ **Sunucu kararı:** aynı VPS mi, ayrı bir VPS mi? Öneri: ayrı VPS ya da mevcut VPS'e RAM eklemek. Gerekçe aşağıda.
  - Tahmini yük: Medusa (mağaza) ~1–1,5 GB, Next.js vitrin ~0,5 GB, üst panel ~0,8 GB, Postgres + Redis + SeaweedFS ~1 GB, ffmpeg tepe noktası ~1 GB ve 2 çekirdek. Toplam **~4–5 GB ve 2–3 çekirdek**.
  - Mevcut VPS'te boş olan ~8 GB ve 4 çekirdek 14 siteyle paylaşılıyor. Video dönüştürme ve kampanya anı aynı anda gelirse sıkışır.
  - Önerilen ayrı makine: 4 vCPU, 8 GB RAM, en az 80 GB SSD, İstanbul'da (KVKK veri yerleşimi, adr/0003).
- [ ] **İşletim sistemi ve ffmpeg:** imaj tabanı ffmpeg ≥ 7 vermeli (docs/08 "F16 açığı").
  - Ubuntu 22.04 ffmpeg 4.4, Ubuntu 24.04 ise 6.1 veriyor; ikisi de yetmez.
  - Bu yüzden uygulamalar Debian 13 tabanlı kapsayıcıda koşar. Ana makinede Docker Engine ve compose eklentisi kurulur.
- [ ] **Orkestrasyon:** adr/0003 "Docker + Coolify benzeri" diyor. Öneri: ilk mağazada **Docker Compose + systemd birimi** (Coolify'ı aaPanel'in yanına kurmak ikinci bir vekil demek).

**A1. İmaj ve süreçler (kod işi, yazılmadı)**
- [ ] ⛔ Çok aşamalı **Dockerfile** yaz: Medusa backend, panel statik dosyaları, vitrin (`next build`, `STOREFRONT_THEME=atolye`), üst panel ve üst panelin paneli.
  - Kapsayıcılar root olmayan kullanıcıyla çalışır.
  - İmaj `NODE_OPTIONS=--conditions=qt-compiled` taşır (docs/08).
  - Sağlık denetimi `/health` üzerinden yapılır. SIGTERM gelince süreç işini bitirip kapanır.
- [ ] ⛔ `FFMPEG_PATH` ve `FFPROBE_PATH` mutlak yolla yazılır. ffmpeg kapsayıcısına CPU ve bellek sınırı verilir (`cpus: 2`, `mem_limit`) ve makine başına tek dönüştürme yuvası açılır (docs/08, adr/0069 K9).
- [ ] ⚠ Trivy imaj taraması CI'a eklenir (`PROGRESS.md:794`).
- [ ] ⚠ `DockerProvisioner` yazılır (adr/0061 §6). İlk mağaza için elle kurulum da olur, bkz. B2. Bu durumda provisioner ikinci mağazaya kalır.

**A2. Veri katmanı**
- [ ] ⛔ **Postgres:** sunucudaki 16 kullanılır ya da kapsayıcıda yeni bir kurulum açılır.
  - Mağaza başına ayrı veritabanı ve en az yetkili rol: `qt_tenant_<slug>`. Üst panelin veritabanı ayrı: `qticaret_cp`.
  - Yalnız iç ağdan erişilir, TLS ve parola zorunlu (docs/08).
  - `pg_stat_statements` açılır, `log_min_error_statement=panic` yapılır (docs/08 "Gözlemlenebilirlik").
  - Denetim kaydı tablosunda UPDATE/DELETE yetkisi kaldırılır (docs/04:220).
- [ ] ⛔ **Redis:** mağaza başına ayrı Redis ya da yalnız kendi önekine izinli bir **ACL kullanıcısı**. Bu, canlıya çıkış kapısıdır (adr/0061 "F16'ya kalanlar" I2). Redis'e parola konur ve yalnız iç ağdan erişilir. Canlıda `REDIS_URL` zorunlu.
- [ ] ⛔ **Nesne depo (S3):** SeaweedFS kapsayıcısı (adr/0006).
  - Bucket genele kapalı olmalı. Özel dosyalar (fatura, etiket, dışa aktarma) yalnız imzalı bağlantıyla verilir (docs/04:84).
  - Sürümleme açılır.
  - `S3_*` değişkenlerinin hepsi zorunlu.
- [ ] ⚠ Dosya deposu için **ayrı origin** açılır (ör. `dosya.mylarte.com`) ve nginx'te `Content-Security-Policy: default-src 'none'; sandbox` ile `nosniff` başlıkları eklenir (SVG; docs/04:64, `progress/deniz.md` sıradaki iş 3).

**A3. Yedek**
- [ ] ⛔ `age` anahtar çifti **çevrimdışı bir makinede** üretilir. En az iki alıcı olur. Sunucuya yalnız `recipients.txt` konur (`docs/runbooks/yedek-ve-geri-yukleme.md`).
- [ ] ⛔ `infra/backup/backup.sh` her gün cron ya da systemd zamanlayıcısıyla koşar:
  - mağaza veritabanı ve `qticaret_cp` yedeklenir;
  - dökümler 35 gün, her ayın ilk dökümü 12 ay saklanır;
  - ikinci kopya Türkiye'de bir yere gider (adr/0003 soru 5; sahibin "drive" kararı bekliyor).
- [ ] ⛔ **Canlı sunucuda bir geri yükleme provası** yapılır: `restore.sh` ile boş bir veritabanına yüklenir, mağaza açılır, sipariş listesi görülür. Bugünkü tek prova geliştirmede yapıldı (2026-10-31).
- [ ] ⚠ Hedefler yazılır: RPO 24 saat (yalnız dökümle) ve RTO 4 saat. PITR/WAL sonraya kalabilir.
- [ ] ⛔ Emanet: mağazanın çalışma sırları (`JWT_SECRET`, `COOKIE_SECRET`, PII anahtarları, `CREDENTIALS_ENCRYPTION_KEYS`, `AUTH_MFA_ENCRYPTION_KEY`, `STOREFRONT_IP_SECRET`, `TENANT_SIGNING_KEY`, veritabanı parolası) `age` ile mühürlenip yedeklerin yanında saklanır (docs/08 "Emanet neyi kapsar"). **Bu sırlar kaybolursa vergi numaraları, sağlayıcı hesapları ve 2FA geri gelmez.**

**A4. Ağ, alan adı, vekil**
- [ ] ⛔ **Alan adları** kararlaştırılır. Öneri:
  - `mylarte.com`: vitrin;
  - `panel.mylarte.com`: panel ve mağaza API'si aynı origin'de (adr/0022 §4);
  - `dosya.mylarte.com`: depo;
  - üst panel için platform alan adı (`PLATFORM_DOMAIN` henüz kararlaştırılmadı). Şirketin alan adı yoksa üst panel geçici olarak IP listeli bir alt alan adında açılır.
- [ ] ⛔ **TLS:** her alan adına Let's Encrypt (aaPanel) ya da Cloudflare origin sertifikası. Yalnız TLS 1.2+ kullanılır, HTTP'den HTTPS'e 301, sertifika bitişinden 14 gün önce uyarı (`docs/runbooks/kenar-ve-pentest.md`).
- [ ] ⛔ **Ters vekil (aaPanel nginx):**
  - Vitrin alan adının tamamı Next.js'e gider. Vitrinin portu dışarı açık olmaz (adr/0077 §7).
  - Panel alan adında statik SPA sunulur. Şu yollar backend'e gider: `/admin`, `/auth`, `/store`, `/static`, `/health`, **`/google`** (OAuth dönüşü `/google/callback`; `apps/panel/vite.config.ts` `BACKEND_PATHS`) ve **`/hooks`**. `/hooks` şunlar için gerekir: PayTR bildirimi, iyzico dönüşü, BirFatura'nın `POST /hooks/birfatura/api/*` uçları, Resend.
  - Geri kalan her yol SPA'ya düşer (`index.html`). `/google/callback` ve `/hooks/*` SPA'ya **düşmemeli**.
  - `/.well-known/security.txt` backend'den sunulur.
- [ ] ⛔ **Vekil güvenilirliği:**
  - `X-Forwarded-For` başlığını yalnız kenar yazar, istemcinin gönderdiğini siler.
  - Backend'in güveni `trust proxy = 1` (docs/04:183). Önde Cloudflare ve nginx iki sekmeyse ya `TRUST_CF_CONNECTING_IP=on` açılır ve origin yalnız Cloudflare IP'lerine açılır, ya da sekme sayısı düzeltilir.
  - Vitrinde `STOREFRONT_TRUSTED_PROXY_HOPS` gerçek vekil sayısına eşit olur.
  - Üst panelde `trust proxy` doğrulanır (docs/08:84).
- [ ] ⛔ **Güvenlik başlıkları vekilde eklenir.** Medusa'nın kendi yanıtları (401, CORS ön isteği, `/static`) ve panelin HTML'i uygulamanın başlıklarını almaz. Panele `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` ve panel CSP'si konur (docs/04:198–199). e2e denetimiyle doğrulanır.
- [ ] ⚠ `/onizleme/<jeton>` yolu vekil ve CDN günlüklerinde maskelenir (docs/04:200).
- [ ] ⛔ **Kenar kuralları (`docs/runbooks/kenar-ve-pentest.md`):**
  - `Content-Encoding` taşıyan istek gövdesi 415 ile reddedilir (body-parser açığının önlemi, adr/0003);
  - gövde sınırları uygulamanınkiyle uyumlu olur;
  - IP başına genel üst sınır konur (ör. dakikada 600);
  - arama motoru botları ters DNS ile doğrulanıp geçirilir.
- [ ] ⛔ **Güvenlik duvarı (UFW):** yalnız 80, 443 ve SSH portu açık kalır. Postgres, Redis, SeaweedFS, 9000, 9100 ve 8000 portları dışarıya kapanır (yalnız `127.0.0.1` ya da Docker ağı).
  - Kapsayıcıdan SMTP'ye 587/465 çıkışı açık olmalı.
  - Sahibin daha önce önerdiği gibi 110 ve 143 kapatılır.
- [ ] ⚠ **Cloudflare** (adr/0003 soru 4; mylarte.com zaten Cloudflare arkasında):
  - proxy açık, origin yalnız Cloudflare IP'lerine açık;
  - önbellek: site haritası, `robots.txt`, ürün akışları ve `/store/products` kısa TTL'le;
  - üst panel IP listesi ya da Cloudflare Access ile korunur (docs/04:137).
- [ ] ⛔ **Sır yönetimi:**
  - Sırlar `.env` dosyalarında (0600, root), kapsayıcıya `env_file` ile verilir. Sırlar git'e, loga ya da sohbete girmez.
  - OpenBao Transit sonraya kalır (adr/0061 §4).
  - Sırlar `openssl rand -hex 32` ile üretilir. `PII_ENCRYPTION_KEY` ile `PII_HASH_KEY` farklı olmalı; aynıysa açılış durur.

**A5. Migration, işler, izleme**
- [ ] ⛔ `medusa db:migrate` mağaza veritabanında, `db:setup` ya da migrate `qticaret_cp`'de koşar. Migration adlarının benzersiz olduğu denetlenir (memory: migration-names-unique).
- [ ] ⛔ Zamanlanmış işler (59 iş, `apps/backend/src/jobs/`) aynı süreçte koşar. Açılıştan sonra loglarda şu işlerin döndüğü görülür: `control-plane-pull`, `search-index-minute`, `shipment-tracking`, `payment-recovery`, `paytr-reconcile`, `seo-sitemap-refresh`.
- [ ] ⚠ İzleme:
  - **en az:** üst panelin 5 dakikalık sağlık yoklaması (zaten var), dışarıdan bir uptime yoklaması (ör. UptimeRobot, ücretsiz), disk ve RAM uyarısı (aaPanel);
  - **hedef (adr/0045):** GlitchTip (`ERROR_TRACKING_DSN`) ve OTLP. İkisi de kurulmadı. İlk hafta pino JSON loglarına `journalctl`/`docker logs` ile bakmak yeterli. Log döndürme ayarlanır.
- [ ] ⚠ Uyarılar (docs/08:99): ödeme başarısızlık oranı, web kancası hata oranı, kuyruk birikmesi, fatura dead-letter. Bugün kodda yalnız log satırları var, uyarı kurulmadı.
- [ ] ⚠ Hız sınırları ve yük: uygulamanın `RATE_LIMIT_PROFILES` kuralları hazır. Canlı sunucuda k6 ile kısa bir ölçüm yapılır (`infra/k6`; `LOAD_TEST=on` canlıda reddedilir, bu yüzden ölçüm staging kipinde). Hedef: Store API p95 < 500 ms (F15 KK2).

### B. Uygulama

**B1. Ortam değişkenleri**

*Mağaza (`apps/backend`), canlıda **zorunlu** olanlar* (`lib/env.ts` açılışı durdurur):

| Değişken | Not |
|---|---|
| `NODE_ENV=production` | Boş bırakmak canlı sayılır; yine de açıkça yazılır |
| `DATABASE_URL` | Mağazanın kendi rolüyle; parola URL'de, dosya 0600 |
| `REDIS_URL` | Mağazanın ACL kullanıcısıyla (`rediss://` tercih edilir) |
| `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` | Sırasıyla `https://mylarte.com`, `https://panel.mylarte.com`, ikisi birden |
| `JWT_SECRET`, `COOKIE_SECRET` | Rastgele, ≥ 32 bayt |
| `PII_ENCRYPTION_KEY`, `PII_HASH_KEY` | 64 hex, birbirinden farklı. **Kaybolursa vergi numaraları okunamaz** |
| `CREDENTIALS_ENCRYPTION_KEYS` | Tek anahtarlı liste. Kaybolursa sağlayıcı hesapları yeniden girilir |
| `AUTH_MFA_ENCRYPTION_KEY` | Canlıda zorunlu |
| `STOREFRONT_IP_SECRET` | Vitrinin env'iyle aynı değer |
| `STOREFRONT_ORIGIN` | `https://mylarte.com` |
| `BACKEND_URL` | `https://panel.mylarte.com` (iyzico dönüşü ve Google yönlendirmesi buraya gelir) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_FILE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Hepsi birlikte |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile widget'ı. Test anahtarları canlıda reddedilir. Ücretsiz Cloudflare hesabından alınır |
| `CONTROL_PLANE_URL`, `CONTROL_PLANE_PUBLIC_KEYS`, `TENANT_ID`, `TENANT_SIGNING_KEY` | Dördü birlikte. Üst panel üretir (`cp:keys public-keys`) |
| `FFMPEG_PATH`, `FFPROBE_PATH` | docs/08 "zorunlu" diyor (kod zorlamıyor; yoksa video yükleme kapalı kalır) |
| `MEDUSA_DISABLE_TELEMETRY=true` | |

*Önerilen ya da isteğe bağlı olanlar*:

| Değişken | Not |
|---|---|
| `SECURITY_CONTACT`, `SECURITY_POLICY_URL` | security.txt için (F15 kalanı). İletişim adresi `guvenlik@quantdijital.com` olarak kararlaştırıldı, ama şirket kurulmadı |
| `TRUST_CF_CONNECTING_IP=on` | Yalnız Cloudflare arkasında ve origin kapalıysa |
| `ERROR_TRACKING_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER(_ARG)`, `RELEASE`, `LOG_LEVEL` | Gözlemlenebilirlik |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CRUX_API_KEY` | Platformun Google Cloud projesi (Merchant, Search Console, CrUX). Ayarlanmazsa panel "henüz açılmadı" der |
| `GOOGLE_AUTH_CLIENT_ID`, `GOOGLE_AUTH_CLIENT_SECRET`, `GOOGLE_AUTH_CALLBACK_URL` | Vitrinde "Google ile giriş": mağazanın kendi OAuth istemcisi (`docs/runbooks/google-cloud-kurulum.md` B) |
| `AI_DAILY_LIMIT_*`, `AI_STORE_SEARCH_DAILY_LIMIT`, `AI_ASSISTANT_*` | Yalnız varsayılanı düşürmek için |
| `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET` | Canlıdan sonra (memory: Paraşüt canlıdan sonra) |
| `EMAIL_TRANSPORT`, `EMAIL_FROM`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | **Boş bırakılır.** E-posta panelden kaydedilen SMTP'den gider. Resend yalnız seçenek olarak duruyor |

*Canlıda **boş kalması gerekenler*** (boş değer yok sayılır; dolu olursa açılış durur ya da istenmeyen davranış olur):
- **Sahte sağlayıcı adresleri:** `PAYTR_BASE_URL`, `IYZICO_BASE_URL`, `ARAS_BASE_URL`, `YURTICI_BASE_URL`, `DHL_ECOMMERCE_BASE_URL`, `SURAT_BASE_URL`, `PTT_BASE_URL`, `NETGSM_BASE_URL`, `GOOGLE_BASE_URL`, `PARASUT_BASE_URL`, `BIRFATURA_BASE_URL`, `SHOPIFY_BASE_URL`, `META_GRAPH_BASE_URL`, `GA4_BASE_URL`, `APPLE_AUTH_BASE_URL`, `RESEND_BASE_URL`, `TURKIYEAPI_BASE_URL`, `MAILPIT_URL`. Hepsi canlıda reddedilir (`lib/env.ts:378–405`). Geliştirme `.env`'ini kopyalamak bu yüzden açılışı durdurur.
- `EMAIL_TRANSPORT=mailpit`, `ADMIN_MFA=off`, `TURNSTILE=off`, `LOAD_TEST=on`: canlıda reddedilir.
- `PASSWORD_BREACH_CHECK`: env.example'da `off`. Canlıda **satır silinir**, böylece denetim açık olur.
- `CARRIER_DHLECOMMERCE_ENABLED`: **boş**. DHL eCommerce askıda (#472). `DHL_ECOMMERCE_CLIENT_ID` ve `DHL_ECOMMERCE_CLIENT_SECRET` da boş kalır.
- `MEDUSA_ADMIN`: boş. Medusa'nın kendi admin ekranı kapalı kalır.
- `SEO_INDEXING`: canlıda boş (açık). **Test sunucusunda `NODE_ENV=staging`** olur, bu da indekslemeyi kapatır.
- `SHIPMENT_POLL_MINUTES`: canlıda yok sayılır, silinir.

*Vitrin (`apps/storefront`)*: `MEDUSA_BACKEND_URL` (iç ağ adresi, ör. `http://backend:9000`), `STOREFRONT_ORIGIN`, `STOREFRONT_PUBLISHABLE_KEY` (canlıda **zorunlu**; geliştirmedeki `/dev/storefront-key` yardımı yok), `STOREFRONT_IP_SECRET`, `STOREFRONT_TRUSTED_PROXY_HOPS`, `STOREFRONT_THEME=atolye`.
- env.example "base varsayılan" diyor, ama `packages/themes` altında yalnız `atolye` var. Belge eskimiş; değeri açıkça yazmak güvenli.
- `PAYMENT_FRAME_ORIGINS` ve `PAYMENT_REDIRECT_ORIGINS` boş kalır (PayTR ve iyzico'nun gerçek adresleri varsayılan).

*Üst panel (`apps/control-plane`)*: `DATABASE_URL`, `REDIS_URL` (canlıda zorunlu), `ADMIN_CORS`, `AUTH_CORS`, `JWT_SECRET`, `COOKIE_SECRET`, `CP_HASH_KEY`, `AUTH_MFA_ENCRYPTION_KEY`, `CP_MASTER_KEY`, `CP_ESCROW_RECIPIENTS` (yedeklerin `age1…` alıcıları), `PLATFORM_DOMAIN`, `CP_PANEL_URL` (https), `CP_TENANT_API_HOSTS`, `MEDUSA_DISABLE_TELEMETRY=true`.
- **Boş kalanlar:** `EMAIL_TRANSPORT` (canlı taşıyıcı yok), `CP_PROVISIONER` (`local` canlıda reddedilir), `CP_LOCAL_*`, `ADMIN_MFA`, `LOAD_TEST`.
- `CP_INVOICING`: şirket kurulana kadar `off`.

**B2. İlk mağazanın kurulumu (üst panel)**
- [ ] ⛔ Üst paneli kur: önce `db:setup`, sonra `cp:create-owner email=…` (davet bağlantısı oluşturana gösterilir, e-posta gitmez), sonra sahibin 2FA'sı.
- [ ] ⛔ Paketi tanımla ve mağaza kaydını aç. Bugünkü provisioner yalnız yerelde çalıştığı için iki yol var:
  - (a) `DockerProvisioner` yazılır (temiz yol, kod işi);
  - (b) **elle kurulum:** veritabanı ve rol, env dosyası, `migrate`, `tenant:bootstrap`, ilk plan belgesi, `cp:fleet set-api-url`/`set-storefront-url`.

  Öneri: ilk mağaza (b) ile kurulur, adımlar runbook'a yazılır. (a) ikinci mağazaya kalır.
- [ ] ⛔ `cp:keys public-keys` çıktısını mağazanın env'ine yaz. Mağaza logunda `control_plane.stored_invalid` ya da `tenant_mismatch` görünmemeli.
- [ ] ⛔ **Yayın sırası:** önce mağazalar, sonra üst panel (adr/0061 C16, C20).
- [ ] ⚠ Hiçbir pakete yapay zekâ kredisi hakkı yazılmaz; önce bütün mağazalar sözleşmeyle dağıtılır (docs/08:56).

**B3. Hesaplar ve 2FA**
- [ ] ⛔ Mağaza sahibinin hesabı açılır, sahip rolü verilir, 2FA kurulur. Ayarlar > Güvenlik'te "ekip için 2FA zorunlu" anahtarı varsayılan olarak açık.
- [ ] ⛔ Personelin rolleri kontrol edilir. Ödeme hesabını yalnız sahip değiştirebilir (docs/04:124, adr/0040). ADR-0027'deki "ödeme uçları her personele açık" engeli F12.6 ile kapanmıştı.
- [ ] ⛔ Kurtarma kodları ve `AUTH_MFA_ENCRYPTION_KEY` emanete alınır.
- [ ] ⚠ Geliştirmeden kalan geçici e2e hesapları canlıya taşınmaz. Canlı veritabanı boş başlar.

**B4. Gerçek veri ve seed**
- [ ] ⛔ **`seed:demo` canlıda koşulmaz.** Demo katalog, Wikimedia görselleri ve test müşterisi (`customer:test`) yalnız geliştirmede kullanılır.
- [ ] ⛔ Canlıda yalnız bootstrap yapılır: bölge, KDV, `tr-address:import source=turkiyeapi`, kargo varsayılan paketi, Atölye görünümü.
- [ ] ⛔ **Katalog taşıma:** mylarte'nin WordPress dışa aktarması kuru çalıştırılır, sonra uygulanır. Ardından WooCommerce müşteri CSV'si yüklenir (`docs/runbooks/gecis.md` "WordPress'ten gelen mağaza").
- [ ] ⛔ Mağaza ayarları doldurulur:
  - künye ve yasal bilgiler (unvan, VKN, MERSİS, adres, ETBİS);
  - banka (havale) bilgisi;
  - kargo ücreti modu (mylarte'de bugün ₺150, ₺1.500 üzeri ücretsiz);
  - Aras ve Yurtiçi sayfalarında fatura unvanı ve VKN (sahipte açık iş);
  - SEO'da `canonical_host = mylarte.com`.
- [ ] ⚠ Eski site için seçilmiş ayarlar: Google ile giriş, WhatsApp düğmesi, yorumlar. Google İşletme Profili yorumları 2026-11-27'de kaldırıldı.

### C. Güvenlik

- [ ] ⛔ `security-reviewer` dağıtım dosyaları üzerinde koşturulur: Dockerfile, compose, nginx, env şablonları. Kritik/yüksek bulgu kalmaz (CLAUDE.md PR kuralı).
- [ ] ⛔ Açık kalan F16 güvenlik maddeleri:
  - mağaza başına Redis ACL (I2);
  - `/static`, panel ve Medusa yanıtlarının başlıkları vekilde (docs/04:64, 198–199);
  - denetim kaydı tablosunda UPDATE/DELETE kaldırma (docs/04:220);
  - XFF ve vekil sekme sayısı;
  - üst panelin dışarıya kapatılması.
- [ ] ⚠ Bilinen düşük riskler (kabul edilmiş): müşteri ve sipariş dışa aktarmalarında hız sınırı yok; kupon "ilk sipariş" yarışı (`progress/deniz.md` 2026-11-25/26).
- [ ] ⛔ **Hafif pentest (ilk mağaza için):**
  - OWASP ZAP taraması test sunucusuna (`infra/zap`; CI'da yok);
  - `securityheaders` ve SSL Labs (A notu);
  - elle senaryolar: `kenar-ve-pentest.md` "Öncelikli senaryolar", sahte sağlayıcılarla.

  Dış pentest (F15.8) bütçe gerektirir; ilk mağazadan sonraya kalabilir. Sahip kararı.
- [ ] ⚠ `security.txt` yayımlanır (`SECURITY_CONTACT`). Şirketin alan adı yoksa sahibin kendi adresi kullanılır.
- [ ] ⚠ Bağımlılıklar: fast-xml-parser 5.12.1 (2026-11-27'den sonra uygun), glob 13.0.7. picomatch ve @graphql-tools için düzeltme bekleniyor (`progress/deniz.md` iş 7).
- [ ] ⚠ Veri ihlali tatbikatı (F13 KK5): `docs/runbooks/veri-ihlali.md` rol tablosuna isimler yazılır, 60 dakikalık masa başı tatbikat yapılır. Kullanıcının kararı "canlıdan önce" idi.

### D. Hukuk ve mali (docs/12)

> **Quant Dijital kurulmadı, avukat ve KVKK danışmanı yok** (memory: no-company-no-advisers). Aşağıdakilerin çoğu mağazanın (My L'arte) kendi yükümlülüğüdür. Platformun şirketi olmadan kurulamayanlar ayrıca işaretli.

| Kalem | Kimin | Durum | Canlıya engel mi |
|---|---|---|---|
| Mesafeli satış, ön bilgilendirme, KVKK aydınlatma, çerez, üyelik, iade, kargo metinleri | Mağaza | Taslaklar hazır (`lib/legal/starters`). Not kutusu yayında kendiliğinden düşer (`docs/yasal-metinler.md`). Avukat kontrolü yok | ⛔ Metinler **yayında olmalı**. Avukat kontrolü sahibin kararı: yalnız taslakla mı çıkılacak? Eski metinler `docs/gecis/mylarte/eski-yasal-metinler/` altında |
| ETBİS kaydı | Mağaza | mylarte'nin alt bilgisinde ETBİS logosu var (`envanter.md`); kayıt mevcut. Alan adı aynı kalırsa güncelleme gerekmez | Yok (doğrula) |
| İYS marka kodu, Netgsm İYS erişimi | Mağaza | Bekleniyor (`PROGRESS.md:581`) | Yalnız ticari ileti (kampanya) için. İşlemsel ileti engellenmez |
| VERBİS | Mağaza | Değerlendirilmedi (çalışan ve bilanço eşiği). Danışman yok | ⚠ Sahip mali müşavire sorar |
| e-Arşiv ve e-Fatura | Mağaza ve BirFatura | Mağazanın BirFatura hesabı var (test hesabı sahipte) | ⛔ İlk satıştan önce BirFatura gerçek testi (bkz. §2) |
| BirFatura veri işleme sözleşmesi ve "veri Türkiye'de" yazılı teyidi | Mağaza ve BirFatura | Açık (docs/12:51) | ⚠ |
| 6136 ve yaş sınırı (bıçak) | Mağaza | Kendi beyanı yeterli (karar 2026-10-31); yaş beyanı ödeme adımında | Yok |
| Platform ↔ mağaza SaaS ve veri işleyen sözleşmesi | Platform | Şirket yok | ⚠ Şirket kurulunca. Bugün sahibin kendi mağazası olduğu için pratikte engel değil |
| Abonelik faturası (`CP_INVOICING`) | Platform | Şirket yok, kapalı | Yok |
| Cloudflare ve yapay zekâ servislerinin yurt dışı aktarımı aydınlatmada | Mağaza | Aydınlatma taslağında yazılmalı (adr/0003, adr/0071) | ⚠ |
| Yapay zekâ kredisi satışı (yeniden satış izni) | Platform | Şartlar okunmadı | Yok. Kredi kapalı, mağaza kendi anahtarını kullanır |

### E. SEO

- [ ] ⛔ `canonical_host = mylarte.com` (www'suz ya da www'li, eski siteyle aynı). Diğer biçim 301 ile yönlenir.
- [ ] ⛔ Test sunucusunda `NODE_ENV=staging` (indekslenmez) ve basic auth. Canlı açılışta `SEO_INDEXING` boş kalır.
- [ ] ⛔ `robots.txt` ve `sitemap.xml`: `seo-sitemap-refresh` işi döndükten sonra açılıp kontrol edilir.
- [ ] ⛔ **Eski adres eşlemesi (`docs/runbooks/gecis.md`):**
  - eski sitenin `sitemap_index.xml`'i (Rank Math) okutulur;
  - Search Console'un son 3 aylık CSV'si yüklenir;
  - "Karar bekleyen" adresler 301 ya da 410'a bağlanır;
  - rozet **Kesime hazır** olur.

  Şunlar kendiliğinden yönlenir: WordPress ek ve medya adresleri (`/wp-content/uploads/…`), `/feed/` (410), kategori kısa yolları (ADR-0059). 200 ürün adresinin listesi `docs/gecis/mylarte/urun-urlleri.txt` dosyasında.
- [ ] ⛔ Kesimden sonra rastgele 3 eski adres 301 vermeli. Search Console'a yeni site haritası gönderilir (alan adı aynıysa adres değişikliği aracı gerekmez).
- [ ] ⚠ Search Console ve Merchant bağlantısı panelden yapılır: platformun Google Cloud projesi gerekir (§2).
- [ ] ⚠ IndexNow anahtarı ve `seo-indexnow` işi. Akakçe ve Cimri akış adresleri satıcı panellerine girilir.

### F. Performans

- [ ] ⚠ Canlıda Lighthouse mobil çalıştırılır. Bütçe: LCP ≤ 2,5 sn, INP ≤ 200 ms, CLS ≤ 0,1 (docs/21). Yerel ölçüm bütçenin içinde (LCP ~1,8 sn); VPS ve Cloudflare'de yeniden ölçülür.
- [ ] ⚠ docs/21'in açık önerileri yapılmadı: seçilen yazı tipini önceden yükleme (−230 KB), geç yüklenen yerleşim JS'i. Engel değil.
- [ ] ⚠ Saha verisi (CrUX) `CRUX_API_KEY` gelince panelde görünür.

### G. Geri alma planı

- [ ] ⛔ Eski WordPress sitesi kesim günü **kapatılmaz**, en az 30 gün açık tutulur (gecis.md "Geri dönüş").
- [ ] ⛔ DNS TTL'i bir gün önceden 300 saniyeye indirilir. Geri dönüş DNS'i eski sunucuya çevirmektir. Karar **ilk 24 saatte** verilir. Yeni sitede alınan siparişler elle aktarılır.
- [ ] ⛔ Yeni sürümde geri alma: önceki imaj etiketine dönülür. Migration'lar geri uyumlu (docs/08 "Sürüm yayma"). Kesimden hemen önce bir yedek ve emanet kopyası alınır.
- [ ] ⚠ PayTR bildirim adresi **hesap başına tektir**. Kesimde WooCommerce eklentisinin adresinden yenisine çevrilir; geri dönüşte eskisine alınır. Bu adım geri alma listesine yazılır.

### H. Kesim günü (sıra)

1. T-1 gün: DNS TTL 300 saniye. Son yedek ve geri yükleme denemesi. Eski adreslerde "Kesime hazır" rozeti.
2. T-0, 1. saat: eski sitede sipariş ve üyelik dondurulur (bakım duyurusu).
3. Taşıma bir kez daha **uygulanır** (yalnız yeni kayıtlar gelir). Eski adresler yeniden uygulanır.
4. PayTR panelinde bildirim adresi `https://panel.mylarte.com/hooks/paytr/...` olarak değiştirilir. Test modu **kapatılır** (hesap test modunda onaylanmış olmalı).
5. BirFatura'da sipariş çekme adresi ve token canlı mağazaya göre ayarlanır.
6. DNS yeni sunucuya yöneltilir. Sertifika kontrol edilir.
7. Duman testi:
   - ana sayfa, kategori, ürün, arama, sepet;
   - **gerçek kartla küçük tutarlı bir sipariş**, ardından iade;
   - havaleyle bir sipariş;
   - e-posta geliyor mu, SMS geliyor mu;
   - panelde sipariş görünüyor mu, BirFatura siparişi çekiyor mu, kargo etiketi basılıyor mu.
8. 3 eski adres 301 veriyor mu bakılır. Panelde "Kesim yapıldı" işaretlenir. Search Console'a site haritası gönderilir.
9. Davetler başlatılır (taşınan müşterilere hesap e-postası). Önce SMTP günlük sınırı ve itibarı kontrol edilir; ilk gün düşük tutulur.

### I. Canlıdan sonraki kontroller

- [ ] İlk 24 saat: loglarda şunlar kontrol edilir: `paytr`, `payment-recovery`, `control_plane.*`, `integration_credentials.kek_*`, `ai.search_fallback reason=address_unknown` (vekil sekme sayısı yanlış demektir), `media.video_unavailable`.
- [ ] İlk hafta: her sabah yeni 404'ler eski adreslere eklenir (30 günlük izleme). Search Console kapsam raporu izlenir.
- [ ] İlk hafta: ilk gerçek kargo, ilk gerçek fatura (e-Arşiv numarası ve PDF'i), ilk iade ve iade faturası uçtan uca izlenir.
- [ ] Haftalık: yedek dosyası oluştu mu, disk doluluğu, sertifika bitişi.
- [ ] Ayda bir: geri yükleme provası (gerçek çevrimdışı anahtarla).
- [ ] 30. gün: eski sunucu kapatma kararı.

---

## 2. Entegrasyonlar tablosu

**Sütunlar:**
- **Hesap:** **P** platformun (bizim) hesabı ya da anahtarı; **M** mağazanın kendi hesabı (panelden girilir, `integration-credentials` içinde şifreli).
- **Durum:** ✅ gerçek sağlayıcıda doğrulandı · 🟡 yalnız sahteyle ya da kısmen · ⬜ hiç denenmedi · ⛔ askıda.
- **Canlıya:** **Şart** ilk mağazanın açılışı için gerekli · **Sonra** bekleyebilir.

| Entegrasyon | Hesap | Env (platform) | Durum ve kanıt | Doğrulanacaklar (belgenin açık listesi) | Güvenli test yolu | Engel | Canlıya |
|---|---|---|---|---|---|---|---|
| **PayTR** (kart, iFrame) | M (mağaza no, parola, gizli anahtar, test modu) | yok (`PAYTR_BASE_URL` canlıda boş) | 🟡 Yalnız sahte PayTR, vitrin çerçevesi uçtan uca (`progress/deniz.md` D7; `e2e/paytr-frame.e2e.ts`) | `user_basket` toplam kuralı, IPv6 `user_ip`, token ömrü, bildirim tekrar aralığı, taksit oranları API'sine erişim (`docs/entegrasyonlar/paytr.md:104,126–140`) | mylarte'nin **kendi hesabı test modunda** (memory). Bildirim adresi herkese açık HTTPS olmalı, yani test sunucusu gerekir. Test modundaki sipariş kargoya verilemez ve faturalanmaz (kod korumalı) | Bildirim adresi hesap başına tek: test sırasında WooCommerce'in bildirimleri kesilir. **Test, eski sitenin az satış yaptığı bir saatte** ya da kesim haftasında yapılır | **Şart** |
| **Havale/EFT** | M (IBAN) | yok | 🟡 Elle denendi (geliştirme, #638) | Yok | Panelde IBAN, vitrinde sipariş | Yok | **Şart** (mylarte'de %2 indirimli var) |
| **Kapıda ödeme** | M (taşıyıcı sözleşmesi) | yok | 🟡 Sahteyle | Aras ve Yurtiçi kapıda ödeme alanları sözleşmeyle (`aras.md:24`) | Taşıyıcının test ortamı | Sözleşme | Sonra |
| **iyzico** | M | yok | ✅ Sandbox: imza, ödeme, aynı gün iade (2026-10-27, 2026-11-02; `iyzico.md:28–114`) | Web kancası V3 (iyzico'ya açtırılmalı), taksitli sandbox ödemesi, canlı hesap | Sandbox (OTP 123456) | iyzico başvurusu ve sözleşmesi | Sonra (mylarte PayTR kullanıyor) |
| **BirFatura** (e-Arşiv/e-Fatura, sipariş çekme; birinci plan) | M (BirFatura hesabı; token'ı bizim sunucu üretir) | yok (`BIRFATURA_BASE_URL` canlıda boş) | ⬜ **Hiç denenmedi.** Yerel sahte de yok (sahibin kararı 2026-11-18) | e-Arşiv internet satışı alanları, `SendDocumentAnswer IPTAL`, `invoiceLinkUpdate` tekrar davranışı, PDF alan adı, `orderCargoUpdate` (BirFatura kargo modu), kimlik reddi kodu (`birfatura.md:42–184`) | Sahibin **BirFatura test hesabı** + test sunucusunun alan adı (memory). `/hooks/birfatura/api/*` dışarıdan erişilebilir olmalı | Test sunucusu | **Şart** (fatura kesilmeden satış olmaz) |
| **Paraşüt** | P (istemci kimliği ve sırrı, `destek@parasut.com`) + M (firma) | `PARASUT_CLIENT_ID/SECRET` | 🟡 Yalnız sahte (`e-fatura.md:72`) | Deneme ortamı, 429, iade faturası bağı | Paraşüt staging firması (istenmeli) | Şirket alan adı (karar: canlıdan sonra) | Sonra |
| **Aras Kargo** | M (kullanıcı, şifre, müşteri kodu) | yok | 🟡 Yalnız sahte | Canlı adres yolu (`/arascargoservice.asmx` mı?), `DURUM_KODU` 6, kapıda ödeme tipleri (`aras.md:9,24,31–33`) | `customerservicestest.araskargo.com.tr` + Aras'tan test kullanıcısı | Mağazanın Aras sözleşmesi ve API kullanıcısı ("Elimde Aras var") | **Şart** (bir taşıyıcı ya da BirFatura kargo modu) |
| **Yurtiçi Kargo** | M | yok | 🟡 Yalnız sahte | Hatalı giriş kodu (`LOGIN_REFUSED_CODES`), şubede Code 128 okunması, teslim `operationCode` (`yurtici.md:138–170`) | **Herkese açık test hesabı `YKTEST`** (`yurtici.md:11`). Bu hafta sözleşme olmadan denenebilir | Canlı kullanıcı bölge müdürlüğünden | Sonra (ya da Aras yerine) |
| **Sürat** | M | yok | 🟡 Yalnız sahte | Başarı metinlerinin izin listesi, takip eşlemesi, kapıda ödeme ayracı (`surat.md`) | **Test ortamı yok**: düşük tutarlı gerçek gönderi + hemen `GonderiSil` | Sözleşme | Sonra |
| **PTT** | M (müşteri no, şifre, barkod aralığı) | yok | 🟡 Sahte + tek gerçek çağrı (uydurma hesaba "Kayıt bulunamadı", `ptt.md:117`) | Yanlış şifre yanıtı, durum kodları, `odemesekli`, EPL etiket (`ptt.md`) | PTT test servisleri (panelde test modu; aralıktan numara harcar) | Sözleşme ve barkod aralığı | Sonra |
| **DHL eCommerce** | P (apizone uygulaması) + M | `DHL_ECOMMERCE_CLIENT_ID/SECRET`, `CARRIER_DHLECOMMERCE_ENABLED` | ⛔ Askıda (#472); sahteyle kodlandı | `dhlecommerce.md:212+` (IP izni, `createRecipient` zamanı) | sandbox.mngkargo.com.tr | Askıda | Sonra (boş kalır) |
| **E-posta: mağazanın SMTP'si** (aaPanel Postfix) | M (sunucu, port, kullanıcı, şifre) | yok (`EMAIL_TRANSPORT` boş) | 🟡 Mailpit ve test SMTP sunucusuyla (`smtp-server` yalnız testte). **Gerçek Postfix'e gönderim kaydı yok** | SPF/DKIM/DMARC/PTR, kapsayıcıdan 587/STARTTLS ve sertifika adı, SSRF kuralının genel IP'yle geçmesi (docs/08:66) | Panel > Bildirimler > "Deneme e-postası gönder" (yalnız giriş yapan personele gider) + mail-tester.com puanı | DNS kayıtları | **Şart** |
| **Netgsm SMS** | M (kullanıcı kodu, şifre, başlık) | yok (`NETGSM_BASE_URL` boş) | 🟡 Yalnız sahte | Gerçek gönderim, başlık onayı, Türkçe karakter parça sayımı | mylarte'nin Netgsm hesabı + panelde test SMS'i (küçük kredi harcar) | Başlık onayı | Sonra (e-posta yeterli; sipariş SMS'i isteniyorsa Şart) |
| **İYS (Netgsm üzerinden)** | M (marka kodu) | yok | 🟡 Yalnız sahte (`iys-sync`) | İzin iletimi | Netgsm İYS erişimi | Marka kodu | Sonra (kampanya gönderimi için) |
| **Cloudflare Turnstile** | P ya da M (site anahtarı + gizli) | `TURNSTILE_SITE_KEY/SECRET_KEY` | 🟡 Geliştirmede her zaman geçen test anahtarları | Gerçek anahtarla giriş, kayıt, iletişim formu ve ödeme | Ücretsiz Cloudflare hesabı; widget `mylarte.com` + `panel.mylarte.com` için açılır | Yok | **Şart** (canlıda zorunlu, yoksa açılış durur) |
| **Google: Merchant + Search Console + CrUX** | P (Google Cloud projesi + OAuth web istemcisi; hassas kapsam doğrulaması) + M (mağazanın Google hesabı) | `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `CRUX_API_KEY` | 🟡 Yalnız sahte Google | OAuth onay ekranı doğrulaması (`auth/content` hassas kapsam), yönlendirme adresi `https://panel.mylarte.com/google/callback` (`google-cloud-kurulum.md`) | Proje "Testing" kipinde, test kullanıcısı olarak mağaza sahibinin hesabı eklenir. Doğrulama beklemeden 100 kullanıcıya kadar çalışır | Doğrulama için şirket alan adı ve gizlilik sayfası (A1). **Şirket yok, kısmi engel** | Sonra (Merchant akışı XML ile de verilebilir) |
| **Google ile giriş (vitrin)** | M (mağazanın OAuth istemcisi) | `GOOGLE_AUTH_*` | 🟡 Yalnız sahte | Onay ekranında mağaza adı | Mağazanın kendi Google Cloud projesi (temel kapsam, doğrulama gerekmez) | Yok | Sonra (mylarte'de bugün var; kesimde olması iyi olur) |
| **GA4** (ölçüm kimliği + API sırrı) | M | yok (panelden) | 🟡 Sahte `gtag` ve Measurement Protocol (`pazarlama.md:61`) | DebugView'de olaylar, `purchase` sunucu olayı | Tag Assistant + DebugView (`pazarlama.md:59`) | Yok. mylarte'nin GA4'ü var (`G-L9R6CMMWTJ`) | **Şart** (kesimde ölçüm kopmasın) |
| **Meta Pixel + CAPI** | M (piksel no + erişim anahtarı) | yok (panelden) | 🟡 Yalnız sahte | Tekilleştirme, `Purchase` sunucu olayı | Events Manager > Test Events (test kodu) | Yok. Piksel `2082704909159013` | **Şart** (reklam varsa) |
| **Ürün akışları (Google, Meta, Akakçe, Cimri)** | M | yok | 🟡 Biçimler önceki siteden alındı, gerçek panele yüklenmedi | Satıcı panelinin akışı kabul etmesi | Akış adresi satıcı paneline girilir, hata raporu okunur | Satıcı hesapları | Sonra |
| **TürkiyeAPI** (il, ilçe, mahalle) | — (anahtarsız) | yok | ✅ Geliştirmede gerçek API'den içe aktarma (`turkiye-api.md:82`) | — | `tr-address:import` | Yok | **Şart** (bootstrap) |
| **WordPress/WooCommerce taşıma** | M (dışa aktarma dosyası) | yok | ✅ mylarte'nin gerçek WXR dosyasıyla kuru çalıştırma ve uygulama (2026-11-03: 201 ürün, 947 görsel, 54 yazı) | Müşteri CSV'si, eski adres kararları | Test sunucusunda kuru çalıştırma | Yok | **Şart** |
| **Shopify taşıma** | M (mağazanın Dev Dashboard uygulaması) | yok | 🟡 Yalnız sahte (`shopify.md:64`) | Kısıtlama yanıtı, büyük dosya, `barcode` alanı | Gerçek Shopify mağazasında salt okunur uygulama | — | Sonra (mylarte WooCommerce) |
| **Yapay zekâ: Gemini** | M (kendi anahtarı) ya da P (kredi, kapalı) | yok | ✅ Kısmen: metin önerisi sahibin ücretsiz anahtarıyla çalıştı. Görsel ücretsiz katmanda yok (429) (`progress/oguzhan.md:124`) | Görsel `maxOutputTokens` (N4) | Ücretli anahtarla 1–2 görsel işi | — | Sonra |
| **MiniMax** | M | yok | 🟡 Anahtar geçerli, bakiye 0 (402) | Gerçek çağrı | Küçük bakiye | — | Sonra |
| **DeepSeek, Qwen** | M | yok | ⬜ Kanıt yok (yalnız belgeden kayıt) | Gerçek çağrı | Kendi anahtarla duman testi (docs/22:60) | — | Sonra |
| **Photoroom** | M | yok | ✅ Sandbox'ta sahne çalıştı (filigranlı) | Canlı anahtar | — | — | Sonra |
| **Bria** | M | yok | ⬜ Kanıt yok | Veri işleme ülkesi (legal@bria.ai) | Deneme anahtarı | Teyit | Sonra |
| **Üst panel yapay zekâ kredi ağ geçidi** | P (platform anahtarları) | üst panelde | 🟡 Sahte servis; bayrak kapalı | Yeniden satış izni (docs/12:63) | — | Şartlar ve şirket | Sonra |
| **Resend** | P/M | `RESEND_*` | 🟡 Sahte | — | — | Sahip istemiyor | Kullanılmaz |
| **GlitchTip / OTLP** | P (kendi sunucumuz) | `ERROR_TRACKING_DSN`, `OTEL_*` | ⬜ Kurulmadı | — | — | — | Sonra (ilk hafta loglar yeterli) |
| **HIBP (sızmış şifre)** | — | `PASSWORD_BREACH_CHECK` boş | 🟡 Geliştirmede kapalı | Dış çağrı | Canlıda kendiliğinden açık | Yok | Şart (varsayılan) |

**Bu tabloda "platform hesabı" olarak bizden istenenler:**
- Google Cloud projesi;
- Cloudflare (Turnstile ve CDN);
- Paraşüt istemcisi (sonra);
- DHL apizone uygulaması (askıda);
- `age` yedek anahtarları;
- uptime ve hata izleme.

Geri kalan her hesap mağazanın, yani My L'arte'nin.

---

## 3. "Gerçekten çalışıyor mu": dürüst durum

### 3.1 Gerçek sağlayıcıda doğrulananlar (kanıtı olan)
- **iyzico sandbox:** imza, Checkout Form, test kartıyla ödeme, aynı gün iade, iade imzası (`docs/entegrasyonlar/iyzico.md:28–114`, `progress/deniz.md:1010,1025`). Vitrinde (`/odeme`) 2026-11-02'de denendi.
- **TürkiyeAPI:** geliştirme ortamı gerçek API'den adres verisi alıyor (`turkiye-api.md:82`).
- **WordPress taşıma:** mylarte'nin gerçek dışa aktarma dosyasıyla kuru çalıştırma ve uygulama yapıldı (`progress/deniz.md:275–279`). Uygulama bir kez dev sunucusunun yeniden başlamasıyla yarıda kaldı; tekrarlanınca kaldığı yerden sürdü.
- **Yapay zekâ (sahip, 2026-11-18):** Gemini ile metin çalıştı, Photoroom sandbox'ı çalıştı, MiniMax anahtarı geçerli ama bakiye yok (`progress/oguzhan.md:124`).
- **PTT:** gerçek servis uydurma bir hesaba yanıt verdi (`ptt.md:117`). Hesap davranışı doğrulanmış sayılmaz.

### 3.2 Yazıldı, yalnız sahtelerle ve testlerle sınandı
- **Ödeme:** PayTR (iFrame, bildirim, uzlaştırma, iade, sahipsiz ödeme kurtarma), havale, kapıda ödeme, ödeme yönlendirici, ters ibraz, ödeme bağlantıları. Sahte PayTR'yle uçtan uca (vitrin e2e).
- **Kargo:** Aras, Yurtiçi, Sürat, PTT ve askıdaki DHL. Ortak PDF etiket (`pdf-lib`, Code 128), takip işi (`shipment-tracking`), sabit iade kodu.
- **Fatura:** Paraşüt (sahte). **BirFatura'nın sahtesi bile yok.** Kod, HTTP testleriyle sınandı ama gerçek BirFatura hiç çağrılmadı.
- **Bildirim:** SMTP taşıyıcısı (testte `smtp-server`), Mailpit, Resend, Netgsm, İYS senkronu, kampanya gönderimi, müşteri mesaj şablonları.
- **Pazarlama:** GA4 ve Meta CAPI (sahte), ürün akışları, Merchant API (sahte Google), Search Console içgörüleri, IndexNow.
- **Giriş:** Google ve Apple sosyal giriş (sahte; Apple kapalı kalıyor), personel 2FA (TOTP; e2e).
- **Üst panel:** imzalı plan belgesi, kısıt/askı, kullanım raporu, sağlık yoklaması, zarf şifreleme ve döndürme. Bunlar yerel provisioner'la gerçek süreçlerde koşuyor, ama canlı ağda (TLS, ayrı makineler) hiç çalışmadı.

### 3.3 Yazılmadı (F16 kodu)
- Üretim Dockerfile'ı, compose, nginx yapılandırması, `DockerProvisioner`, `cp:tenant re-escrow`.
- Mağaza başına Redis ACL.
- Üst panelin SMTP taşıyıcısı.
- Dağıtım hattı ve kapıları: `credentials:keys status`, eski `kid` denetimi, filo sürüm denetimi.
- Trivy taraması, ZAP'ın CI'da koşması.
- GlitchTip/OTLP sunucusu, uyarılar.
- Destek erişimi (break-glass, F16.10), mağaza kapatma (F16.11), özel alan adı doğrulaması ve otomatik SSL (F16.7).

### 3.4 Panel ve arka plan araçları

| Araç | Nerede | Uçtan uca çalıştı mı |
|---|---|---|
| Zamanlanmış işler (59 adet, `apps/backend/src/jobs/`) | Medusa iş zamanlayıcısı, Redis kilitli | Geliştirmede sürekli dönüyor; birim ve HTTP testleri var. **Canlı ağda hiç** çalışmadı. Sahte sağlayıcıya bağlı olanlar (takip, uzlaştırma, İYS, Merchant) gerçek yanıt görmedi |
| Üst panel işleri (7: plan itme ve uzlaştırma, sağlık, faturalama, kredi uzlaştırma, yeniden sarma, saklama) | `apps/control-plane/src/jobs/` | Yerel provisioner'la gerçek süreçlerde |
| Arama dizini | Postgres tam metin (adr/0056; Meilisearch ertelendi); `search-index-minute` ve `search-index-nightly` | Geliştirmede evet. 200 ürünle sorun beklenmez |
| Görsel işleme | `sharp` 0.35.5 (yeniden boyutlandırma, WebP), SVG temizleme (DOMPurify + jsdom, worker thread) | Geliştirmede evet |
| Ürün videosu | ffmpeg (Debian/Ubuntu paketi); `media-video-queue` | Geliştirme makinesinde evet. **Canlı imajda ffmpeg ≥ 7 şartı açık**; VPS'te süre ölçülmedi |
| PDF | `pdf-lib`: kargo etiketleri, fatura PDF'i (Paraşüt sahtesi), toptan ve sipariş çıktıları | Geliştirmede evet. Şubede barkod okutma **doğrulanmadı** |
| E-posta gönderimi | `notification-email`: mağazanın SMTP'si, yoksa `EMAIL_TRANSPORT` | Mailpit'e evet. **Gerçek SMTP'ye kanıt yok**. Teslim edilebilirlik (SPF/DKIM/PTR) denenmedi |
| SMS | `notification-sms` (Netgsm) | Yalnız sahte Netgsm |
| Site haritası, robots, akışlar | `seo-sitemap-refresh`, `marketing-feeds` | Geliştirmede evet |
| Yedek | `infra/backup/backup.sh`, `restore.sh` | Geliştirmede prova edildi (2026-10-31). Canlıda zamanlama yok |
| Yük testi | `infra/k6` | Yerelde (2026-10-31, `docs/perf-raporlari/`). Staging'de yok |
| ZAP | `infra/zap` | Yerelde kural dosyası var. CI'da yok |
| Taşıma işleri (WordPress, Shopify, CSV, eski adresler, 404 izleme, davetler) | `migration-*` işleri | WordPress gerçek dosyayla. Davet e-postası ve 404 izleme yalnız geliştirmede |
| Hız sınırı, iş kanıtı, Turnstile, fraud-guard | `lib/security`, adr/0044 | Testli. Turnstile gerçek anahtarla denenmedi |

### 3.5 Belgelerde eskimiş satırlar (düzeltilmeli)
- `docs/08-devops.md:65` ve `docs/12:53`: "her mağazaya ayrı Resend hesabı" yazıyor. Karar değişti: mağazanın kendi SMTP'si.
- `docs/entegrasyonlar/sms.md:4,20`: "SMTP kütüphanesi yok" yazıyor; nodemailer var.
- `docs/entegrasyonlar/pazarlama.md:64`: `META_*` ve `GA4_*` env diye yazılmış; artık panelden giriliyor.
- `docs/12:46`: PayTR satırı memory'deki karara göre güncellenmeli.
- `apps/storefront/env.example`: "base varsayılan" yazıyor; yalnız `atolye` var.
- `apps/backend/env.example`: `BIRFATURA_BASE_URL=` boş satırı zararsız (boş değer yok sayılır) ama kafa karıştırıyor.

---

## 4. Önerilen sıra ve sahipten istenenler

### 4.1 Bu hafta (sıra önemli)
1. **Test sunucusu (staging), kod işi.** Dockerfile ve compose (backend, vitrin, panel, üst panel, Postgres, Redis ACL, SeaweedFS) ve nginx yapılandırması. Ayrıca ilk mağazanın elle kurulum runbook'u. Bir test alan adında açılır, ör. `test.mylarte.com` ve `panel-test.mylarte.com`, `NODE_ENV=staging` ve basic auth ile. **Bu adım olmadan hiçbir gerçek sağlayıcı testi yapılamaz:** PayTR bildirimi, BirFatura çekmesi ve Google dönüşü herkese açık HTTPS ister.
2. **SMTP.** Test sunucusunda panelden aaPanel Postfix hesabı kaydedilir, deneme e-postası gönderilir, mail-tester puanı alınır, SPF/DKIM/DMARC/PTR düzeltilir. Bedava ve hemen yapılabilir.
3. **Yurtiçi `YKTEST`.** Sözleşmesiz gerçek test ortamı. Gönderi açma, etiket, iptal ve takip denenir; hata kodları belgeye yazılır. **Aras** test ortamı için Aras'tan test kullanıcısı istenir.
4. **BirFatura test hesabı.** Sipariş çekme, e-Arşiv alanları, PDF bağlantısı, iptal. `birfatura.md` "doğrulanmadı" satırları sırayla kapatılır. Bunun için test sunucusu gerekir.
5. **PayTR test modu** (mylarte'nin hesabı). Bildirim adresi test sunucusuna çevrilir. Test kartlarıyla başarılı ve başarısız ödeme, taksit, iade ve uzlaştırma denenir; taksit oranları API'sine erişim görülür. **Bildirim adresi değişince eski sitenin bildirimleri durur**, bu yüzden düşük trafik saatinde yapılır ve sonra adres geri alınır.
6. **Turnstile, GA4 DebugView, Meta Test Events.** Gerçek kimliklerle, test sunucusunda.
7. **Taşıma provası.** Test sunucusunda WordPress kuru çalıştırma ve uygulama, müşteri CSV'si, eski adresler (sitemap ve Search Console CSV'si). Hedef: "Kesime hazır" rozeti.
8. **Yedek ve geri yükleme provası** test sunucusunda, gerçek `age` anahtarıyla.
9. **Hafif güvenlik turu.** ZAP, SSL Labs, securityheaders; `security-reviewer` dağıtım dosyalarına bakar.
10. (Sonra) Netgsm test SMS'i, Google Cloud projesi "Testing" kipinde Merchant ve Search Console bağlantısı.

### 4.2 Sahibin vermesi gereken kararlar ve hesaplar

**Kararlar**
1. Sunucu: aynı aaPanel VPS'i mi (RAM artırılmalı), ayrı VPS mi? Öneri: ayrı ya da 8 GB eklenmiş.
2. Alan adları: vitrin `mylarte.com`, `www` olacak mı; panel `panel.mylarte.com`; depo `dosya.mylarte.com`; test alt alan adları; üst panelin adresi (`PLATFORM_DOMAIN`).
3. Cloudflare önde kalsın mı (mylarte zaten Cloudflare'de)? Öneri: evet, origin yalnız Cloudflare'e açık.
4. İlk mağaza elle mi kurulsun (hızlı), `DockerProvisioner` mı yazılsın (temiz)? Öneri: elle, runbook'lu.
5. Yasal metinler avukatsız taslakla mı yayımlanacak, yoksa eski sitenin metinleri mi uyarlanacak?
6. Kargo: kesimde Aras mı, Yurtiçi mi, yoksa BirFatura kargo modu mu?
7. Dış pentest canlıdan önce mi, sonra mı (bütçe)?
8. Yedeğin ikinci kopyasının yeri ("drive" kararı): Türkiye'de S3, bulut sürücü ya da ofisteki disk.
9. Kesim tarihi ve sipariş dondurma saati.

**Hesaplar, bilgiler ve erişimler (sohbete yazılmaz; doğrudan sunucuya ya da panele girilir)**
- VPS'e root ya da sudo erişimi, Docker kurulum izni, aaPanel'de nginx site ekleme yetkisi.
- DNS yönetimi (Cloudflare hesabı) ve Turnstile widget'ı.
- PayTR mağaza paneli (test modu ve bildirim adresi alanı).
- BirFatura test hesabı (sahipte var).
- Aras API kullanıcısı ve test kullanıcısı. Yurtiçi canlı kullanıcısı istenirse bölge müdürlüğünden.
- Netgsm hesabı, SMS başlığı ve İYS marka kodu.
- Mağaza için aaPanel'de SMTP posta kutusu (ör. `bildirim@mylarte.com`) ve DNS'te DKIM kaydı.
- GA4 ölçüm kimliği ve Measurement Protocol sırrı; Meta piksel no ve CAPI erişim anahtarı.
- Google hesabı: Search Console ve Merchant Center mülkü. Platform Google Cloud projesi için kurumsal hesap (şirket yoksa sahibin hesabıyla "Testing" kipinde).
- `age` yedek anahtarlarını tutacak iki kişi ya da yer; veri ihlali rol tablosu için isim ve telefonlar.
- mylarte'nin güncel WordPress dışa aktarması, WooCommerce müşteri CSV'si, Search Console son 3 ay CSV'si (kesimden 1–2 hafta önce yeniden).
- Künye: unvan, VKN, MERSİS, adres, IBAN. Aras ve Yurtiçi için fatura unvanı ve VKN.
