# ADR-0061: Üst panel (control plane): teknoloji, veri modeli, güvenlik sınırı ve secret şifreleme

- **Durum:** Kabul edildi (2026-11-10, sahip "başla"; varsayılanlar: aylık ciro üst panele gelmez, ek süre 7 gün, kısıtta vitrin satmaya devam eder)
- **Tarih:** 2026-11-10
- **İlgili:** docs/03 §F17 ve §F16, docs/01 (genel görünüm), docs/04 (secret yönetimi, yönetici hesapları), docs/08 (tenant provisioning), adr/0001 (instance-per-tenant), adr/0003 (hosting), adr/0012 (`owner: platform` bayrakları), adr/0022 (kendi panelimiz), adr/0027 (sağlayıcı hesapları şifreli), adr/0034 (e-fatura), adr/0040 (roller, 2FA, yeniden doğrulama), adr/0053 (bakım modu), docs/18 (panel tasarım sistemi)

## Bağlam

- **Faz sırası (sahip, 2026-11-10):** F18 kapandı → F17 şimdi → F16 (canlıya çıkış) en son. F17, F16'nın dağıtım betikleri olmadan çalışmalı. Mağaza kurma bir arayüzden geçer; ilk uygulaması geliştirici makinesinde gerçek bir mağaza açar, üretim uygulaması (sahibin VPS'inde Docker) F16'da gelir. Hiçbir şey iki kez yazılmaz.
- **Sahibin hedefi:** "Bütün e-ticaret mağazalarını ve müşterilerini yöneteceğim bir panel. Mevcut müşterileri takip edeyim (süre, işlerin gidişi, gerekli alanlar), yeni mağazayı bilgilerini girerek arayüzden açayım."
- **Sahibin kararları (2026-11-10):**
  - Mağazayı yalnızca biz (platform personeli) açarız. Müşterinin kendi kendine kaydı şimdilik yok.
  - Abonelik ödemesi kartla otomatik çekilmez: takip ve hatırlatma. Personel ödemeyi "ödendi" işaretler. Süre + ek süre dolunca mağaza **kısıtlanır, veri hiç silinmez**.
  - Kendi e-faturamız tasarlanır ama kapalı kalır: Quant Dijital henüz kurulmadı.
  - Paketler üst panelde esnek tanımlanır (ad, fiyat, limitler); mağaza başına paket ve mağazaya özel istisna.
  - Platform alan adı belli değil: yapılandırma değeri. Geliştirmede yerel adresler.
  - Barındırma: sahibin VPS'i (Hosting Dünyam, İstanbul; Ubuntu 22.04, aaPanel, 4 çekirdek, 15 GB RAM; Docker F16'da). Üst panel başta aynı makinede çalışır.
- **Elimizde olan ve güvendiğimiz:** Medusa auth + yerleşik MFA ve kendi rol katmanımız (adr/0040), yeniden doğrulama, denetim kaydı (adr/0011), telafili workflow'lar, hız sınırları ve `lib/security`, redaksiyonlu loglama, AES-256-GCM mühür (`lib/crypto`), imzalı web kancası (`lib/webhooks/signature.ts`), sürümlü önbellek kalıbı, `tenant:bootstrap` betiği, panelin tasarım sistemi (docs/18) ve e2e altyapısı.
- **Medusa 2.21.2 (Context7 `/medusajs/medusa`, 2026-11-10):** `defineConfig` çekirdek modülleri her zaman ekler; kaldırılamaz, yalnızca değiştirilir ya da `disable` edilir. `admin.disable` Medusa Admin'i kapatır.

## Karar

### 1. Teknoloji

1. **Arka uç: ayrı bir Medusa 2.21.2 instance'ı, `apps/control-plane`.** Kendi veritabanı (`qticaret_cp`), kendi Redis ad alanı, kendi süreci. Bütün iş kendi modüllerimiz, workflow'larımız ve job'larımızdadır.
   - Neden: auth + 2FA, yeniden doğrulama, rol koruması, denetim kaydı, telafili workflow, kilitli scheduled job, migration ve test-utils zaten bildiğimiz ve sınadığımız biçimde gelir. Kurulum adımları (veritabanı aç, migration, başlat) tam olarak telafili workflow işidir. Ekip tek bir arka uç dilini konuşur.
   - Ticaret modülleri (ürün, sepet…) yüklü kalır ama kullanılmaz. Sınırı rota **izin listesi** çizer: yalnızca `/auth/*`, `/admin/cp/*`, `/tenant-api/*`, `/health`. Geri kalan her yol 404 (staff-guard deseniyle, ilk middleware). Modülleri `disable` etmek bağlantıları kırabilir; ilk görevde denenir, kırmıyorsa ek olarak kapatılır.
   - `admin.disable: true`; Medusa sürümü backend ile aynı exact sürüme sabitlenir ve birlikte yükseltilir.
2. **Ortak sunucu kodu: `packages/server-kit`.** Üst panelin ihtiyaç duyduğu, mağazaya özgü olmayan kütüphaneler backend'den bu pakete taşınır; backend de oradan içe alır. `@medusajs/framework` peerDependency'dir (adr/0001 kuralı).
   - İlk dilim: `crypto` (mühür, anahtar parmak izi, `canonicalJson`, yeni zarf şifreleme), imza (web kancası imzası + yeni Ed25519 imzalı istek), `timing-safe`, loglama redaksiyonu, env yardımcıları. Hız sınırı, `safe-fetch`, MFA ve yeniden doğrulama gerektiği görevde taşınır.
   - Medusa **modülleri** (denetim kaydı, personel rolleri) paylaşılmaz, üst panelde kendi sade kopyası yazılır: migration'ları kendi veritabanına aittir, kaynak türleri ve roller farklıdır. Kopyalanan kurallar aynı birim testleriyle gelir.
3. **Ön yüz: ayrı SPA, `apps/control-plane-panel`.** Panelle aynı yığın (React 19 + Vite, Tailwind v4 + shadcn/ui, TanStack Router/Query/Table, RHF + Zod, i18next, Vitest, Playwright; docs/18). Arka uçla aynı origin'den sunulur (adr/0022 §4): CORS yok, çerez oturumu, CSRF Origin denetimi.
4. **Bileşen paylaşımı: `packages/admin-ui`.** Panelin `components/ui` (shadcn ilkelleri), alan bilgisi taşımayan `components/patterns` (veri tablosu, form penceresi, sayfa başlığı, durum rozeti, boş/yükleniyor durumları, sihirbaz…), `lib/utils` ve token'lar (`tokens.css`, tema motoru) pakete taşınır. Panel ve üst panel ikisi de oradan alır.
   - Bağlanmama kuralı: paket uygulama koduna (`@/features`, `sdk`, uygulamanın i18n örneği) dokunmaz. Metinler paketin kendi i18n ad alanındadır (`admin-ui`), uygulama kendi örneğine ekler. Medya seçici gibi alan bileşenleri panelde kalır.
   - Üst panelin teması sabittir (marka rengi ayarı yok) ve mağaza panelinden **bilerek farklı** görünür: kalıcı "Üst panel" üst şeridi ve ayrı vurgu rengi. Personel hangi panelde olduğunu hiç karıştırmamalı.

### 2. Veri modeli (üst panelin veritabanı)

Kimlik önekleri `ten_`, `pkg_` gibi. Kişisel veri yalnızca bizim müşterimizin yetkililerine aittir (veri sorumlusu Quant Dijital); mağazaların müşteri verisi burada **yoktur** (§3).

| Modül | Tablo | Önemli alanlar |
| --- | --- | --- |
| `tenants` | `tenant` | `slug` (tekil, ayrılmış adlar reddedilir), görünen ad, `status`, `status_changed_at`, `sector_pack`, açan personel |
| | `tenant_company` | ünvan, vergi dairesi, VKN; şahıs firmasında TCKN mühürlü (§4), listede maskeli, görmek yeniden doğrulama + denetim |
| | `tenant_contact` | ad, rol (`owner`, `billing`, `technical`), e-posta, telefon; birincil faturalama kişisi |
| | `tenant_domain` | ana bilgisayar adı, tür (`platform_subdomain` \| `custom`), doğrulama durumu, birincil mi (özel alan adı doğrulaması F16.7) |
| | `tenant_status_change` | eski → yeni durum, neden kodu, personel ya da `system`, zaman |
| | `tenant_note` | personel notu (düz metin ≤ 2000), sabitlenebilir; etkinlik akışı notlar + durum değişikliği + ödeme + kurulum olaylarından birleşir |
| `plans` | `package` | kod, ad, fiyat (kuruş, `TRY`), dönem (`monthly` \| `yearly`), deneme günü, ek süre günü, `archived_at` |
| | `package_limit` | limit anahtarı (kodda kayıt defteri), değer (`null` = sınırsız) |
| | `package_feature` | `owner: platform` bayrak anahtarı (adr/0012 kayıt defteri), değer |
| | `tenant_override` | mağaza, limit ya da bayrak anahtarı, değer, gerekçe, isteğe bağlı bitiş tarihi |
| `billing` | `subscription` | mağaza, paket, o anki fiyat ve dönem (kopya), başlangıç, `current_period_end`, `trial_ends_at`, ek süre, durum (`trialing`, `active`, `past_due`, `restricted`, `cancelled`) |
| | `charge` | dönem, tutar, son ödeme günü, durum (`open`, `paid`, `waived`, `void`), ödeme tarihi, yöntem (`bank_transfer`, `card_manual`, `other`), dekont/referans, işaretleyen; fatura alanları (numara, ETTN, PDF) boş kalabilir |
| | `reminder` | ödeme, tür (`before_14`, `before_7`, `before_3`, `before_1`, `due`, `overdue_3`, `restricted`), kanal, gönderim zamanı; `(charge, kind)` tekil, yani her hatırlatma bir kez |
| `provisioning` | `provisioning_run` | mağaza, tür (`create`, `upgrade`, `apply_pack`, `rotate_keys`, `stop`, `start`, `close`), durum, isteyen, başlangıç/bitiş, sağlayıcı (`local` \| `docker`) |
| | `provisioning_step` | çalışma, ad, sıra, durum, deneme sayısı, `created` (bu çalışma mı yarattı: telafi yalnız onu geri alır), hata kodu, gizli olmayan çıktı |
| `fleet` | `plan_document` | mağaza, `serial` (artan), gövde, `kid`, imza, yayın ve teslim zamanı |
| | `tenant_key` | mağazanın Ed25519 açık anahtarı, `kid`, durum (`active`, `next`, `retired`) |
| | `usage_snapshot` | mağaza, zaman, yalnız toplamlar (§5.4) |
| | `health_check` | mağaza, zaman, sonuç, gecikme, HTTP kodu |
| | `release` / `tenant_version` | sürüm (semver + commit), not; mağazanın bildirdiği ve hedef sürümü |
| `secrets` | `secret_record` | zarf şifreli kayıt (§4): sahip (`platform` \| mağaza), ad, sürüm, `kek_id`, sarılı veri anahtarı, şifreli metin |
| | `secret_escrow` | mağazanın çalışma sırlarının çevrimdışı anahtara mühürlü kopyası (§4.3), sürüm, zaman |
| `cp-staff` + `audit-log` | personel rolleri, denetim kaydı | adr/0040 ve adr/0011 kalıbı (§3.5) |

**Mağaza durum yaşam döngüsü:**

| Geçiş | Kim |
| --- | --- |
| `provisioning` → `active` | kurulum, sağlık yeşil olunca. Hata olursa çalışma `failed`, mağaza `provisioning` kalır |
| `active` → `restricted` | job: son ödeme günü + ek süre doldu |
| `restricted` → `active` | personel ödemeyi "ödendi" işaretledi (ya da bağışladı) |
| `active` \| `restricted` → `suspended` | personel, yeniden doğrulamayla |
| `suspended` → `active` \| `restricted` | personel, yeniden doğrulamayla (ödeme durumuna göre) |
| `active` \| `restricted` \| `suspended` → `closing` → `closed` | `owner` rolü, yeniden doğrulama, mağaza adını yazarak onay |

- `restricted` otomatiktir (ödeme gecikmesi). `suspended` ve `closing` yalnızca personelin açık kararıdır; zamanlayıcı bir mağazanın vitrinini asla kendiliğinden kapatmaz (ödeme işareti elle tutulduğu için kendi hatamız müşterinin satışını durdurmasın).
- `closing`: dışa aktarma paketi, saklama süresi, secret iptali ve silme F16.11'dedir. F17'de durum ve süreçlerin durdurulması var; veri silme yok.
- Deneme süresi mağaza durumu değil, aboneliğin durumudur (`trialing`).

**Limit anahtarları kodda kayıt defteridir** (adr/0012 bayrak deseni): `products`, `orders_per_month`, `staff`, `storage_mb`, `llm_credits_per_month`, `custom_domains`. Paketler değerleri serbestçe verir; yeni anahtar kod incelemesinden geçer, çünkü mağaza onu nasıl uygulayacağını bilmeli.

### 3. Güvenlik sınırı

1. **Üst panel mağazanın müşteri verisini hiç tutmaz.** Mağaza veritabanlarına bağlanmaz, sorgu atmaz. Mağazadan gelen tek veri imzalı, katı şemalı toplamlardır (§5.4); bilinmeyen alan reddedilir (testli).
2. **Konuşma yönü ve kimlik: iki yönde Ed25519 imza, paylaşılan sır yok.**
   - **Üst panel → mağaza: imzalı plan belgesi.** Üst panelin imza anahtarı (`kid`'li) belgeyi imzalar. Mağaza açık anahtar(lar)ı env'den bilir (`CONTROL_PLANE_PUBLIC_KEYS`). Belge: `tenant_id`, `serial`, `issued_at`, durum, paket kodu, etkin limitler, platform bayrakları, faturalama özeti (durum, son ödeme günü, tutar). Sır içermez.
     - **İtme:** üst panel belgeyi `POST /hooks/control-plane/plan`'a gönderir. Uç sır istemez: belge imzalıdır. Mağaza imzayı, `tenant_id`'nin kendisi olduğunu ve `serial`'ın kayıtlıdan büyük olduğunu denetler. Eski belgenin tekrarı (replay) böylece reddedilir, aynısı etkisizdir. Hız sınırı ve gövde sınırı (16 KB) var.
     - **Çekme (yedek):** mağaza 15 dakikada bir ve açılışta `GET /tenant-api/v1/plan`'ı imzalı istekle çağırır. Kaçan itme böyle telafi edilir.
   - **Mağaza → üst panel: imzalı istek.** Kurulumda mağazaya kendi Ed25519 anahtar çifti üretilir; özel anahtar yalnız mağazanın sırrıdır (`TENANT_SIGNING_KEY`), açık anahtar üst panelde `tenant_key`'dedir. İmza: yöntem, yol, `tenant_id`, zaman, tek kullanımlık `nonce`, gövde özeti. Üst panel ±5 dakika dışını ve 10 dakika içinde görülmüş `nonce`'u reddeder.
   - Paylaşılan HMAC sırrı yerine asimetrik imza: üst panel ele geçirilse bile mağazaları taklit edemez; tek mağaza ele geçirilse bile başkası adına belge üretemez. Node `crypto` Ed25519'u yerleşik destekler, bağımlılık yok.
   - Taşıma TLS'tir (canlıda). mTLS şimdilik yok: işletme yükü yüksek, imza aynı güvenceyi veriyor; F16'da vekil sunucuda eklenebilir.
3. **Üst panel erişilemezse mağaza satmaya devam eder.** Mağaza son geçerli belgeyi kendi veritabanında tutar ve ona göre davranır. Erişilemezlik durumu hiçbir zaman değiştirmez: kısıtlama yalnızca imzalı bir belgeyle gelir. 24 saatten eski belge log'a uyarı yazar (F16 izlemesine bağlanır).
   - **Yönetimsiz kip:** `CONTROL_PLANE_PUBLIC_KEYS` yoksa (bugünkü geliştirme, testler) limit yok, durum `active`, platform bayrakları varsayılan. Canlı env şemasında değişken zorunludur; yanlış yapılandırılmış mağaza sessizce sınırsız kalmasın.
4. **En az yetki ve ağ.**
   - Üst panelin HTTP süreci Docker soketini ve Postgres yönetici rolünü **tutmaz**. Kurulum ayrıcalığı provisioner'dadır (§6). Yerelde geliştirici makinesi zaten tek güven alanıdır; F16'da üretim provisioner'ı ayrı, ayrıcalıklı bir süreçtir ve üst panelden yalnızca kapalı listedeki işleri alır.
   - Mağazalara açılan `/tenant-api/*` yalnız iç ağdan erişilir (aynı VPS'te Docker ağı). Üst panel ekranı genel internete açık değil: IP izin listesi ya da Cloudflare Access (biçimi F16'da), artı 2FA.
   - Provisioner'ın mağazada çalıştırabildiği komutlar kapalı listedir (`migrate`, `bootstrap`, `invite-owner`, `apply-pack`, `plan-import`); serbest kabuk komutu yok.
5. **Platform personeli.** Medusa kullanıcıları + `cp-staff` rolleri: `owner` (her şey; personel, kapatma, anahtar döndürme), `operator` (mağaza açma, kurulum, notlar, paket atama, istisna), `finance` (ödemeler, hatırlatmalar, paket fiyatları), `readonly`. Kapalı varsayılan, rota tablosu (adr/0040 deseni).
   - **2FA her zaman zorunlu**, kapatma anahtarı yok. `ADMIN_MFA=off` yalnız yerelde.
   - **Yeniden doğrulama:** askıya alma, geri açma, kapatma, personel daveti ve rol, anahtar döndürme, ödeme işaretleme ve bağışlama, paket fiyatı değişikliği, TCKN görme.
   - **Denetim kaydı:** her mutasyon (önce/sonra alan özeti), dışa aktarmalar ve TCKN okuma. Yalnızca ekleme.
6. **Ele geçirilme etki alanı.** Üst panel ele geçirilirse saldırgan: mağazaları kısıtlayabilir/limit değiştirebilir (imza anahtarıyla), kurulum tetikleyebilir. Okuyamadıkları: mağazaların müşteri verisi, veritabanı şifreleri, mağaza şifreleme anahtarları (§4.3). Önlem: imza anahtarı döndürülür, mağazalar yeni açık anahtarı alır; ağ erişimi kısıtlı; her eylem denetim kaydında.
7. **Destek erişimi (break-glass, F16.10) sonraya.** Taslak: üst panel kısa ömürlü (≤ 60 dk) imzalı bir destek izni üretir (personel, gerekçe, mağaza, rol); mağaza bunu doğrulayıp süreli oturum açar, sahibine zil + e-postayla bildirir, iki tarafta denetim kaydı. Aynı imza düzenini kullanır.

### 4. Secret şifreleme

1. **Zarf şifreleme (`server-kit/crypto/envelope`).** Her kayıt kendi rastgele veri anahtarıyla (DEK, 32 bayt) AES-256-GCM ile şifrelenir; DEK anahtar-şifreleme anahtarıyla (KEK) sarılır. Kayıtta `kek_id`, sarılı DEK, şifreli metin; AAD = sahip + ad + sürüm (başka satıra kopyalanan blok açılmaz, adr/0027 ile aynı ilke).
   - `KeyWrapper` arayüzü: `wrap`, `unwrap`, `kekId`. İlk uygulama **yerel anahtar** (`CP_MASTER_KEY`, 32 bayt, env). Sonraki uygulama **OpenBao Transit** (Vault'un açık kaynak çatalı; Türkiye'de kendi sunucumuzda, "en az dış bağımlılık" ilkesi). Bulut KMS yalnızca KMS anahtarı yurt dışında tutulmaya razı olunursa seçenek; şimdilik hayır.
   - **Döndürme:** KEK sürümlüdür. Yeni KEK eklenir, yeni kayıtlar onunla sarılır, arka plan işi eski DEK'leri yeniden sarar (veri yeniden şifrelenmez), bitince eski KEK kaldırılır. Kesinti yok.
2. **Üst panelin açabildiği sırlar azdır:** kendi imza anahtarı, kendi e-posta gönderim bilgisi, ileride kendi fatura entegrasyonu (Paraşüt) hesabı. Bunlar `secret_record`'da, platform sahipli.
3. **Mağazanın çalışma sırları: üret, teslim et, unut.** Veritabanı şifreleri, `JWT_SECRET`, `COOKIE_SECRET`, `PII_*`, `CREDENTIALS_ENCRYPTION_KEY`, `AUTH_MFA_ENCRYPTION_KEY`, `STOREFRONT_IP_SECRET`, `TENANT_SIGNING_KEY` kurulum adımında üretilir, doğrudan mağazanın sır deposuna yazılır (yerelde `0600` env dosyası, canlıda Docker secrets, F16) ve üst panelde açık hâlde tutulmaz.
   - **Emanet (escrow):** aynı sırlar, yedeklerin kullandığı `age` alıcısına (çevrimdışı anahtar, sahipte) mühürlenip `secret_escrow`'a yazılır. Üst panel bunları **açamaz**; mağaza sunucusu kaybolursa yedek + emanet çevrimdışı anahtarla geri getirilir (infra/backup ile tek kurtarma anahtarı). `age` aracı provisioner'da kabuksuz çağrılır.
   - Workflow girdisi, adım çıktısı ve logda sır yoktur (adr/0027: `store` kapalı; testli).
4. **Mağaza tarafı (F17.4): `integration-credentials` zarfa geçer.** Kayıt başına DEK; KEK önce mevcut `CREDENTIALS_ENCRYPTION_KEY` (yerel sarıcı), sonra mağaza başına Transit anahtarı. `CREDENTIALS_ENCRYPTION_KEYS` birden çok `kid` kabul eder: eski + yeni birlikte durur, yeniden sarma işi geçirir, eski kaldırılır. Eski biçimdeki kayıtlar okunur ve okunduğunda yeni biçime geçer. KK3 ("secret değişikliği kesintisiz, hiçbir yerde düz metin yok") buradan karşılanır.
5. **Döndürme planı (özet):**

   | Sır | Nasıl | Etkisi |
   | --- | --- | --- |
   | Üst panel imza anahtarı | yeni `kid` mağazalara eklenir → imza yeniye geçer → eskisi kaldırılır | yok |
   | Mağaza imza anahtarı | `rotate_keys` çalışması: yeni çift, açık anahtar `next`, mağaza geçer, eskisi `retired` | yok |
   | KEK (üst panel, mağaza) | §4.1 yeniden sarma | yok |
   | Veritabanı şifresi | yeni şifre → sır deposu → kayan yeniden başlatma (F16) | kısa |
   | `JWT_SECRET`, `COOKIE_SECRET` | aynı | açık oturumlar kapanır; olay sonrası |
   | `PII_ENCRYPTION_KEY` | iki anahtarlı okuma + yeniden şifreleme işi | ayrı ADR, gerektiğinde |

### 5. Mağaza tarafı değişiklikler (`apps/backend`)

1. **`control-plane` modülü:** son geçerli plan belgesi (gövde + imza + `serial`), çözülmüş değerler, son çekme zamanı. Sürümlü önbellek kalıbıyla bütün süreçlerde en geç 1 sn'de geçerli. Uçlar: `POST /hooks/control-plane/plan` (itme), job: 15 dk'da bir çekme.
2. **Platform bayrakları:** `owner: platform` bayrakların değeri belgeden gelir (adr/0012 Sonuçlar). Belge yoksa kayıt defterinin varsayılanı.
3. **Limit uygulaması (karışık: engel yalnız gereken yerde):**

   | Limit | Nerede | Aşınca |
   | --- | --- | --- |
   | `products` | ürün oluşturma, çoğaltma, içe aktarma (katalog tablosu, F14 taşıma) | yeni ürün 403 `plan.limit_reached`; içe aktarma kalanı rapora yazar |
   | `staff` | davet | 403 `plan.limit_reached` |
   | `storage_mb` | medya yükleme | 403 `plan.limit_reached` |
   | `llm_credits_per_month` | içerik taslağı (adr/0005) | 403 (maliyet bizde) |
   | `orders_per_month` | — | **asla engellenmez**; %80 ve %100'de panel uyarısı ve üst panele bildirim |
   | `custom_domains` | F16.7 | — |

   - Var olan hiçbir şey limit yüzünden gizlenmez, silinmez ya da yayından kalkmaz. %80'de panelde uyarı. Denetim kaba sayımla (ucuz sorgu, kısa önbellek) ve yazma uçlarının middleware'inde; Medusa workflow kancalarının uygunluğu görev başında Context7 ile doğrulanır.
4. **Kullanım ve sağlık bildirimi:** mağaza saatte bir imzalı `POST /tenant-api/v1/usage` gönderir: ürün sayısı, bu ayki sipariş sayısı, personel, depolama, LLM kullanımı, son sipariş zamanı, çalışan sürüm (semver + commit). Kişi, adres, e-posta, sipariş satırı yok. Aylık satış tutarı (ciro) şimdilik gönderilmez: mağazanın ticari bilgisidir, hizmet sözleşmesinde yer almadan toplanmaz (sahibe soru; "evet" olursa rapora tek bir toplam alan eklenir). Üst panel ayrıca mağazanın `/health`'ini ve vitrin ana sayfasını yoklar.
5. **Kısıtlı ve askıdaki mağaza:**

   | | Panel | Vitrin |
   | --- | --- | --- |
   | `active` (ek süre içinde dahil) | normal; ek sürede sahip ve yöneticiye ödeme şeridi | normal |
   | `restricted` (otomatik) | **okunur**; açık kalanlar: mevcut siparişlerin operasyonu (kargo, iade, iptal, para iadesi, fatura), stok düzeltme, KVKK talepleri, dışa aktarma, kendi hesabı, Ayarlar > Abonelik. Kapalı: katalog, kampanya, ayarlar, toplu gönderim, yeni personel (403 `plan.restricted`, panel neden ve ne yapılacağını söyler) | **normal, satış sürer**: son müşteri ve SEO etkilenmez |
   | `suspended` (personel kararı) | `restricted` ile aynı | 503 + `Retry-After` (adr/0053'ün bakım sayfası, metni platformun; mağaza kapatamaz), `robots.txt` ve site haritası 200; sepet tamamlama 503; ödeme sağlayıcısı dönüşleri ve web kancaları işlemeye devam eder |

   - Mevcut siparişlerin operasyonu hiçbir durumda kapanmaz: mağazanın son müşteriye yasal yükümlülükleri (iade, cayma, fatura) sürer. Veri hiç silinmez.
   - Uygulama: personel korumasının yanında bir `plan-guard` (izin listesi, kapalı varsayılan, birim testte her yazma ucunun kararı kayıtlı).
6. **Panel:** Ayarlar > Abonelik (salt okunur: paket, limitler ve kullanım çubukları, ödeme durumu, sonraki ödeme günü ve tutarı, ödeme talimatı metni), ek süre ve kısıt şeritleri, limit uyarıları ilgili ekranlarda.
7. **Yeni betikler (provisioner'ın kapalı komut listesi):** `tenant:invite-owner email=` (ilk kullanıcı sahip olur, adr/0040; bağlantı çıktıya yazılır, saklanmaz), `tenant:plan-import` (ilk belge), `tenant:apply-pack pack=`. `tenant:bootstrap` aynen kullanılır.

### 6. Kurulum (provisioning): bir kez yazılır

1. **Adımlar üst panelde tek yerde** (`provisioning` workflow'u), ortama özgü işler `TenantProvisioner` arayüzünde:

   ```ts
   interface TenantProvisioner {
     readonly kind: "local" | "docker"
     ensureDatabase(t): Promise<{ created: boolean }>   // DB + en az yetkili rol
     dropDatabase(t): Promise<void>                       // yalnız telafi, yalnız bu çalışmanın yarattığı
     writeRuntimeSecrets(t, secrets): Promise<void>       // yerelde 0600 env dosyası; canlıda Docker secrets
     removeRuntimeSecrets(t): Promise<void>
     runTenantCommand(t, cmd: TenantCommand): Promise<CommandResult> // kapalı liste, §3.4
     start(t): Promise<void>
     stop(t): Promise<void>
     probe(t): Promise<HealthResult>
   }
   ```

2. **Adımlar:** slug ve port ayırma → anahtar ve sırların üretimi (+ emanet) → veritabanı → sırların yazımı → migration → `tenant:bootstrap store-name=` → sektör paketi → ilk plan belgesi → başlatma → sağlık bekleme → sahip daveti (bağlantı üst panelin göndericisiyle sahibin e-postasına; üst panel bağlantıyı saklamaz, "yeniden gönder" adımı yeniden çalıştırır) → `active` ve abonelik başlangıcı.
   - Her adım idempotent ve telafilidir. Hata olursa Medusa telafiyi çalıştırır; adım yalnızca **bu çalışmada yarattığını** geri alır (`created`). "Yeniden dene" baştan çalışır, var olanı atlar. Çalışma ve adımlar ekranda canlı görünür.
3. **`LocalProvisioner` (şimdi, yalnız `development`):** geliştirme Postgres'inde `qt_tenant_<slug>` veritabanı ve rolü (`CP_LOCAL_PG_ADMIN_URL`, canlıda açılış reddedilir), `infra/tenants/local/<slug>/.env` (git dışı, 0600), derlenmiş backend'i (`.medusa/server`) o env ile `medusa start` olarak ayrı süreçte 9200–9299 portlarından birinde başlatır (pid dosyası; durdur/başlat üst panelden). Redis paylaşılır (ad alanı veritabanından türer), dosyalar yerel dosya sağlayıcısında mağaza klasöründe, e-posta Mailpit. Panel `PANEL_BACKEND_URL` ile o porta yönlendirilerek açılır; vitrin yerelde yalnız ana geliştirme mağazası içindir.
4. **`DockerProvisioner` (F16):** aynı arayüz; imajla `docker run --rm … medusa exec` ile aynı betikler, vekil sunucu ve SSL (F16.7). F16.4'ün "tek komutla mağaza" KK'sı aynı workflow'u çağıran bir CLI'dır (`cp:tenant-create`), ayrı betik yazılmaz.

### 7. Abonelik takibi

- **Dönem ve ödeme kaydı:** abonelik başlayınca ilk ödeme kaydı açılır; günlük job dönemi biten aboneliğe yenisini açar. Fiyat değişikliği bir sonraki dönemden geçerli; kıst hesap yok, gerekirse personel ödeme kaydının tutarını gerekçeyle düzeltir.
- **Hatırlatma:** her gün 09:00 (İstanbul) job'u: son ödeme gününden 14, 7, 3, 1 gün önce, gününde, 3 gün sonra; faturalama kişisine e-posta (üst panelin göndericisi), mağaza panelinde şerit (belgedeki faturalama özeti), üst panelde "yaklaşan / geciken" listesi. `(charge, kind)` tekil olduğu için tekrar gönderim yok.
- **Ek süre ve kısıt:** varsayılan ek süre 7 gün (paket başına, mağaza istisnasıyla değişir). Süre dolunca job durumu `restricted` yapar ve yeni belgeyi iter. "Ödendi" işareti (yeniden doğrulama) mağazayı hemen `active`'e döndürür.
- **Kendi e-faturamız:** `SubscriptionInvoiceIssuer` arayüzü; uygulamalar `none` (varsayılan) ve ileride Paraşüt (adr/0034'ün istemcisi `server-kit`'e taşınarak). `CP_INVOICING=off` şirket kurulana kadar; ödeme kaydında fatura alanları boş kalır.
- Kartla otomatik tahsilat ve müşterinin ödeme sayfası **yok** (sonraki aşama; platform müşteri adına para toplamaz ilkesi bizim kendi tahsilatımızı etkilemez ama ayrı ADR).

### 8. Şimdi ve sonra

| Konu | F17'de | Sonra |
| --- | --- | --- |
| F17.1 onboarding | personelin sihirbazı, yerel gerçek kurulum | **müşterinin kendi kaydı ertelendi** (KK1 değişir, aşağıda) |
| F17.2 paketler ve limitler | tamamı | depolama ölçümü canlı dosya deposunda F16 |
| F17.3 faturalama | takip, hatırlatma, kısıt | kartla tahsilat; e-fatura şirket kurulunca |
| F17.4 secret | zarf şifreleme, yerel KEK, döndürme, emanet | OpenBao Transit (F16 ile) |
| F17.5 sürüm | bildirilen sürüm, sürüm listesi, hedef sürüm alanı | dalga/canary yürütme F16.6 (`upgrade` çalışması `DockerProvisioner`'la) |
| F17.6 platform paneli | liste, durum, kullanım, sağlık, notlar | destek erişimi F16.10 (§3.7) |
| F17.7 sektör paketi | `packages/sector-packs/<kod>/` veri dosyaları (özellik şablonları, mağazanın kendi bayrak ön ayarları, SEO şablon seti), backend'in mevcut Zod şemalarıyla doğrulanır, idempotent uygulanır (eksik olanı ekler, mağazanın düzenlediğini ezmez). Kod paket adına göre dallanmaz | pakete yeni sürüm gelince "yeniden uygula" yalnız ekler |

**KK önerisi (docs/03 §F17):** "Yeni müşteri kendi kendine kayıt olup deneme mağazasını açabiliyor" yerine: "Platform personeli üst panelden bilgileri girerek yeni mağaza açabiliyor; mağaza yerelde gerçek olarak ayağa kalkıyor, sağlık yeşil ve sahip daveti gidiyor." Self-servis kayıt sonraki aşamaya.

## Alternatifler

| Arka uç | Artı | Eksi |
| --- | --- | --- |
| **Ayrı Medusa instance (seçilen)** | Auth + MFA, roller, denetim, telafili workflow, job, migration, test düzeni hazır ve sınanmış | Kullanılmayan ticaret modülleri yüklü (izin listesiyle kapalı); Medusa yükseltmesi iki uygulamada |
| Hafif Node servisi (Fastify/Hono + Drizzle) | Küçük, sade, hızlı açılış | Auth, 2FA, yeniden doğrulama, denetim, workflow telafisi yeniden yazılır; en riskli yerde (personel girişi) yeni kod |
| Mağaza backend'inde modül | Tek kod tabanı | Instance-per-tenant ile çelişir; her mağaza üst paneli taşır; sınır kalmaz |
| Yalnızca orkestrasyon aracı (Coolify vb.) arayüzü | Kurulum hazır | Abonelik, paket, müşteri takibi yok; F16 kararına bağlanır |

| Ön yüz paylaşımı | Artı | Eksi |
| --- | --- | --- |
| **Ortak paket `packages/admin-ui` (seçilen)** | Tek görsel dil, düzeltme iki yerde birden | Panelden taşıma işi (mekanik, testlerle doğrulanır) |
| Kopyalamak (shadcn usulü) | Bağımsız | İki kopya zamanla ayrışır; erişilebilirlik düzeltmeleri bir yerde kalır |
| Panelin klasörüne takma adla bağlanmak | İş yok | Üst panel panelin iç yapısına bağlanır; panel değişince üst panel kırılır |
| Üst paneli mağaza panelinin içine koymak | Tek uygulama | Personel ve mağaza sahibi aynı yüzde; güvenlik sınırı bulanık |

| Üst panel ↔ mağaza | Artı | Eksi |
| --- | --- | --- |
| **İmzalı belge (itme + çekme) ve imzalı rapor, Ed25519 (seçilen)** | Paylaşılan sır yok; tekrar saldırısı `serial` ve `nonce` ile kapalı; erişilemezlikte mağaza satar | İki yönlü imza düzeni yazılır |
| Paylaşılan HMAC sırrı | Basit, mevcut web kancası imzası | Üst panel mağazayı taklit edebilir; sır iki yerde |
| mTLS | Güçlü kimlik | Sertifika yönetimi; aaPanel/Docker ortamında işletme yükü |
| Üst panel mağaza veritabanına doğrudan yazar | En kolay | Etki alanı bütün müşteri verisi; kesinlikle hayır |

| Secret | Artı | Eksi |
| --- | --- | --- |
| **Zarf şifreleme, yerel KEK → OpenBao Transit (seçilen)** | Bugün çalışır, KMS'e arayüz değişmeden geçer; döndürme kesintisiz | Transit sunucusu işletilecek (F16) |
| Yalnız env (bugünkü) | Basit | Döndürme kesintili; KK3 karşılanmaz |
| Bulut KMS | Yönetilen | Anahtar yurt dışında; dış bağımlılık |
| Üst panel bütün mağaza sırlarını açık tutar | Kurtarma kolay | Üst panel ele geçince her mağazanın verisi açılır; emanet (`age`) aynı kurtarmayı açamadan sağlıyor |

| Kısıt biçimi | Artı | Eksi |
| --- | --- | --- |
| **Kısıtta panel okunur, vitrin satar; vitrini yalnız personel kapatır (seçilen)** | Kendi takip hatamız müşterinin satışını durdurmaz; SEO ve son müşteri korunur | Kısıt daha yumuşak bir baskı |
| Kısıtta vitrin de kapanır | Güçlü baskı | Elle tutulan ödeme kaydındaki hata vitrin kapatır; 503 uzarsa sayfalar dizinden düşer |
| Yalnız uyarı | Hiç sürtünme yok | KK2 karşılanmaz |

## Sonuçlar

- **Yeni uygulamalar ve paketler:** `apps/control-plane` (Medusa, port 9100, veritabanı `qticaret_cp`), `apps/control-plane-panel` (Vite, port 5174), `packages/server-kit`, `packages/admin-ui`, `packages/sector-packs`; `packages/types/src/control-plane` (belge, rapor ve imza sözleşmesi, Zod). docs/01, 02, 03 (§F17 KK), 04 (secret), 08 (provisioning), kvkk-envanter (üst paneldeki yetkili kişi verisi) kapanışta güncellenir.
- **Yeni env:** üst panelde `CP_SIGNING_KEY`, `CP_MASTER_KEY`, `CP_HASH_KEY` (C3), `CP_ESCROW_RECIPIENTS`, `PLATFORM_DOMAIN`, `CP_PROVISIONER` (`local` \| `docker`), `CP_LOCAL_PG_ADMIN_URL` (yalnız yerel), `CP_INVOICING`; mağazada `CONTROL_PLANE_URL`, `CONTROL_PLANE_PUBLIC_KEYS`, `TENANT_ID`, `TENANT_SIGNING_KEY`. `pnpm env:init` yerel değerleri üretir.
- **Mağazanın davranışı:** yönetimsiz kipte bugünküyle aynı; mevcut testler değişmeden geçer.
- **Bellek:** yerel kurulum ek bir `medusa start` süreci açar (≈ 400–600 MB). Mac'te aynı anda en çok bir yerel mağaza önerilir; bitince üst panelden durdurulur.
- **Bağımlılık:** yeni npm bağımlılığı yok (Ed25519 ve AES-GCM Node `crypto`'da; `age` zaten yedek aracı). Transit sunucusu F16'da.
- **Üst panelin kendi verisi** (müşteri yetkilileri, ödeme kayıtları) infra/backup ile mağazalar gibi yedeklenir.

## F17 görev planı

Sıra bağımlılığa göredir; her görev tek kodlama ajanının bir oturumuna sığar, kendi testleriyle doğrulanır. Tam test bir kez, kapanışta.

| # | Görev | Kabul |
| --- | --- | --- |
| C1 | **`packages/server-kit` ilk dilim:** `crypto` (mühür, parmak izi, `canonicalJson`), web kancası imzası, `timing-safe`, log redaksiyonu, env yardımcıları backend'den taşınır; backend oradan alır. Yeni: zarf şifreleme (`KeyWrapper`, yerel sarıcı) ve Ed25519 imzalı istek yardımcıları | backend typecheck + birim yeşil, davranış değişmedi; zarf ve imza birim testleri (yanlış AAD, yanlış `kid`, eski zaman, tekrar `nonce`) |
| C2 | **Sözleşme:** `packages/types/src/control-plane`: plan belgesi, kullanım raporu, imza başlıkları, limit ve durum kayıt defteri (Zod, katı) | sabit test vektörleriyle imzala/doğrula; bilinmeyen alan reddi |
| C3 | **`apps/control-plane` iskeleti:** Medusa 2.21.2, `qticaret_cp`, rota izin listesi, `admin.disable`, env şeması, güvenlik başlıkları, hız sınırı, `pnpm --filter control-plane dev` (9100); `disable` denemesi | `/health` 200, `/admin/products` ve `/store/*` 404; HTTP testi; lint/typecheck |
| C4 | **Platform personeli:** `cp-staff` rolleri ve rota tablosu, zorunlu 2FA, yeniden doğrulama, davet, denetim kaydı modülü, `cp:create-owner` betiği | 2FA'sız 403; rol tablosu birim testi (her uç kararlı); denetim satırları |
| C5 | **`packages/admin-ui`:** panelin ilkel bileşenleri, alan bilgisi taşımayan kalıplar, token'lar ve `admin-ui` i18n ad alanı taşınır; panel oradan alır | panel birim + e2e duman/axe/düzen yeşil, görünüm değişmedi |
| C6 | **`apps/control-plane-panel` kabuğu:** giriş, 2FA kurulumu, yeniden doğrulama penceresi, "Üst panel" şeridi ve menü, boş gösterge | Playwright duman + axe |
| C7 | **Mağazalar ve paketler:** `tenants`, `plans` modülleri, admin uçları, ekranlar (Mağazalar listesi/ayrıntı: firma, yetkililer, alan adları, notlar, etkinlik; Paketler; istisnalar) | HTTP testleri (doğrulama, roller, TCKN maskesi ve görme); panel testleri |
| C8 | **Secret deposu ve anahtarlar:** `secrets` modülü, üst panel imza anahtarı, mağaza anahtar çifti üretimi, `age` emaneti, KEK döndürme işi | sır DB'de, logda, workflow kaydında düz metin değil (test); döndürme sonrası okuma sürüyor |
| C9 | **Mağaza: plan belgesi alıcısı:** backend `control-plane` modülü, itme ucu, çekme job'u, yönetimsiz kip, platform bayraklarının kaynağı | sahte imza, başka mağazanın belgesi, eski `serial` reddi; üst panel kapalıyken son belgeyle çalışma; mevcut testler değişmeden yeşil |
| C10 | **Provisioner:** `TenantProvisioner`, `LocalProvisioner`, `provisioning` workflow'u (çalışma/adım kaydı, telafi, yeniden dene), backend betikleri `tenant:invite-owner`, `tenant:plan-import`; `cp:tenant-create` CLI | CLI'dan yerelde gerçek mağaza: DB, migration, bootstrap, başlatma, sağlık yeşil, Mailpit'te davet; ikinci çalıştırma etkisiz; ortadaki adımda hata telafiyle temizlenir |
| C11 | **Yeni mağaza sihirbazı:** Firma → Yetkililer → Paket → Adres (alt alan adı `PLATFORM_DOMAIN`'den) → Sektör paketi → Özet ve kur; ayrıntıda "Kurulum" sekmesi (canlı adımlar, yeniden dene, durdur/başlat) | e2e: arayüzden mağaza açılıyor, durum `active` |
| C12 | **Sektör paketleri:** `packages/sector-packs` (genel + ilk müşterinin şablonları, veri olarak), doğrulama, `tenant:apply-pack` idempotent | uygulama iki kez aynı sonuç; mağazanın düzenlediği şablon ezilmiyor |
| C13 | **Kullanım ve sağlık:** mağazanın saatlik imzalı raporu, `/tenant-api/v1/usage`, sağlık yoklama job'u, ayrıntıda kullanım ve sağlık | tekrar ve eski zaman reddi; bilinmeyen alan reddi; anlık görüntü kaydı |
| C14 | **Limit uygulaması ve Abonelik ekranı (mağaza):** ürün, personel, depolama, LLM engelleri; sipariş yalnız uyarı; Ayarlar > Abonelik, uyarılar | limitte yeni ürün 403 `plan.limit_reached`; sipariş limit üstünde de tamamlanıyor (test); panel testleri |
| C15 | **Kısıt ve askı (mağaza):** `plan-guard`, panel şeritleri ve açıklama, askıda vitrin 503 (robots/site haritası 200), sağlayıcı dönüşleri açık | her yazma ucunun kararı birim testte; kısıtta sipariş operasyonu açık, katalog kapalı; askıda vitrin 503 |
| C16 | **Abonelik takibi:** `billing` modülü, dönem job'u, ödendi/bağışla (yeniden doğrulama), hatırlatma job'u, ek süre → `restricted` → ödemeyle `active`, belge itme; Ödemeler ekranı; `SubscriptionInvoiceIssuer` (`none`) | zaman ilerletmeli testler; hatırlatma bir kez; KK2 testi (kısıt geliyor, veri yerinde) |
| C17 | **F17.4 mağaza hesapları zarfa:** `integration-credentials` kayıt başına DEK, `CREDENTIALS_ENCRYPTION_KEYS`, yeniden sarma işi, eski biçimi okuma | anahtar döndürme sırasında ödeme hesabı okunmaya devam ediyor (KK3); düz metin yok |
| C18 | **Sürüm ve gösterge:** sürüm listesi, mağazaların bildirdiği/hedef sürüm, gösterge (aktif mağaza, aylık tekrarlayan gelir, geciken ödemeler, yaklaşan yenilemeler, sağlıksız mağazalar) | panel testleri; e2e duman |
| C19 | **Kapanış:** `security-reviewer` + `/guvenlik-review`, docs güncellemeleri (Sonuçlar'daki liste), kvkk-envanter, tam test bir kez, KK işaretleri | bulgular kapalı; turbo yeşil |

## Ek: C1 uygulaması (2026-11-10)

- **Paket kaynak olarak alınır:** `@qticaret/server-kit` CommonJS'tir ve `exports` doğrudan `src/index.ts`'i gösterir (`@qticaret/testing` gibi). Medusa CLI her açılışta `ts-node`'u kaydettiği için `medusa develop`, `medusa exec` ve depodan `medusa start` (yerel provisioner dahil) onu derler; Jest swc ile dönüştürür. **F16:** `ts-node`'suz üretim imajında paket derlenmeli (`dist` + `exports.default`) ya da imaja birlikte paketlenmeli; şu hâliyle `ts-node`'suz çalıştırma `ERR_MODULE_NOT_FOUND` verir.
- **Taşınanlar:** `lib/crypto/{pii,secrets}`, `lib/webhooks/signature` (→ `signing/webhook`), `lib/security/timing-safe`, `lib/logging/redact` ve redaksiyonun dayandığı `lib/tr/tax-id` (TCKN/VKN denetimi; üst panelin firma kaydı da kullanacak). `lib/env.ts` şemasını tutar, yapı taşlarını (`nodeEnv`, `originList`, `secret`, `key256`, `isBareOrigin`, `isLocalEnv`, `isLoopbackUrl`, `EnvValidationError`, `parseEnvWith`) paketten alır. Barrel'lar (`lib/security`, `lib/logging`, `lib/webhooks`) paketten yeniden dışa verir; doğrudan içe alanlar pakete çevrildi. Çıktılar ve hata kodları değişmedi.
- **`@medusajs/framework` peerDependency'si eklenmedi:** ilk dilim yalnız `node:crypto` ve `zod` (4.6.6, framework'ün kopyasıyla aynı) kullanıyor; Medusa'ya dokunan ilk taşımada eklenir.
- **Zarf biçimi:** KEK kimliği anahtarın HMAC parmak izidir (`kekFingerprint`, 16 hex), elle ad verilmez; `CREDENTIALS_ENCRYPTION_KEYS` gibi listeler en yeni anahtar başta yazılır (`parseKekList`). AAD, kaydın bağlamı (ör. `{ owner, name, version }`) kanonik JSON olarak, hem veriye hem sarılı DEK'e bağlanır. Tek sütun biçimi `qtenv1.<kek_id>.<sarılı DEK>.<iv|tag|şifreli metin>` (base64url); hata kodları `envelope.*`.
- **İmza düzeni (§3.2'nin açık bıraktığı ayrıntılar):** Ed25519 anahtarları env'de ham 32 bayt base64url (özel anahtar tohum olarak); `kid` açık anahtarın alan ayrımlı SHA-256'sının ilk 16 hex'i, yani yanlış etiketlenemez. İmzalı istek başlıkları `x-qt-tenant`, `x-qt-key-id`, `x-qt-timestamp` (Unix saniye), `x-qt-nonce` (16 bayt base64url), `x-qt-signature`; imzalanan metin satır satır `QT-ED25519-V1`, yöntem, yol + sorgu (istek satırındaki gibi), `tenant_id`, zaman, `nonce`, `kid`, gövdenin SHA-256'sı (base64url). Doğrulama sırası: biçim → ±5 dk → anahtar → imza → `nonce` (yalnız geçerli imzadan sonra harcanır; anahtar `tenant:nonce`, 10 dk; `NonceStore` arayüzü, Redis `SET NX EX` ile uygulanır). Belge imzası `QT-ED25519-DOC-V1` + amaç (`plan` …) + derin kanonik JSON üzerinedir; tazelik `serial` kuralıyla alıcıdadır.

## Ek: C2 uygulaması (2026-11-10)

- **Yer ve biçim:** sözleşme `@qticaret/types/control-plane` alt yolundadır (kök dışa aktarıma girmez, vitrin ve panel paketleri etkilenmez). Klasör kendi `package.json`'ıyla **CommonJS**'tir: Medusa uygulamaları (C9 mağaza, C3+ üst panel) onu çalışma anında `ts-node` ile kaynaktan yükler; ES modül kaynağını `ts-node` `require` edemez (`ERR_REQUIRE_ESM`, denendi). Vite yine ESM olarak paketler (denendi). Bu yüzden `packages/types`'ta `verbatimModuleSyntax` kapalı; `import type`'ı ESLint denetler. `zod` 4.6.6 pakete bağımlılık olarak eklendi.
- **Belge alanları (§3.2'yi somutlaştırır):** `version: 1` (bilinmeyen sürüm reddedilir), `tenant_id` (`ten_…`), `serial` (pozitif güvenli tamsayı), `issued_at` (UTC ISO), `status`, `package_code`, `limits` (altı anahtarın hepsi zorunlu, `null` = sınırsız), `platform_flags` (`alan.ad` → boolean, en çok 100), `billing` (`status`, `due_on`, `grace_ends_on`, `amount` kuruş, `currency: "TRY"`). Taşıma ve saklama biçimi `{ document, kid, signature }`; gövde sınırı 16 KB. `comparePlanSerial`: büyük `serial` uygulanır, aynısı etkisiz, küçüğü reddedilir.
- **Kullanım raporu:** `version: 1`, `tenant_id`, `reported_at`, `period` (`YYYY-MM`, İstanbul ayı), `counts` (`products`, `orders_this_month`, `staff`, `storage_mb`, `llm_credits_this_month`), `last_order_at`, `release` (`version` semver, `commit`). Ciro alanı yok. Her düzey katıdır: bilinmeyen alan raporu düşürür.
- **Kayıt defterleri:** durumlar ve izinli geçişler (§2 tablosu), abonelik durumları, limit anahtarları ve uygulama biçimi (`block`; `orders_per_month` `warn`; `custom_domains` F16.7'ye kadar `later`), %80 uyarı oranı, bayrak anahtarı deseni. İmza başlıkları ve hata kodları server-kit'le aynı adlardır; sabit test vektörleri (yalnız test için, açık bir ifadeden türetilmiş anahtarlarla) iki paketin aynı tel biçimini konuştuğunu denetler.

## Ek: C3 uygulaması (2026-11-10)

- **Uygulama:** `apps/control-plane` (`@qticaret/control-plane`), Medusa 2.21.2, port 9100, veritabanı `qticaret_cp`. Araçlar backend'in aynısı (tsconfig, Jest + swc, ESLint, `medusa-config.ts` düzeni). Env şablonu `env.example` (depo kuralı; `pnpm env:init` `.env` ve `.env.test`'i üretir). İlk kurulum `pnpm --filter control-plane db:setup` (`qticaret_cp`'yi açar, migrate eder); entegrasyon testleri backend gibi aynı Postgres'te geçici veritabanı açar (`DB_*`).
- **`pnpm dev`'e girmez:** env'i olmayan makinede açılış hatası Turbo'nun bütün geliştirme görevlerini durdurur ve Mac'e bir Medusa süreci daha yükler. Kök `dev` onu dışarıda bırakır (`--filter=!@qticaret/control-plane`); ayrı komut `pnpm dev:cp`. Turbo'nun `lint`/`typecheck`/`test` görevleri onu kapsar.
- **İzin listesi ilk middleware değil, Medusa'nın ad alanı korumalarından sonra:** Medusa `/admin` (oturum) ve `/store` (publishable key) korumalarını ve CORS'u uygulamanın bütün middleware'lerinden önce kurar; sıra değiştirilemez. Sonuç: oturumsuz `/admin/products` Medusa'nın 401'ini, anahtarsız `/store/*` 400'ünü alır; ikisi de hiçbir core handler'a ulaşmaz. Oturumlu personel ve geçerli anahtarlı istek dahil bunların ötesindeki her core rota izin listesinden 404 alır (`/`, `/app`, `/hooks/*`, `/static/*`, `/auth/customer/*` her zaman 404). HTTP testi iki durumu da sabitler. Oturumsuz yoklamaların da 404 görmesi istenirse F16'da vekil sunucu aynı yol listesini uygular.
- **`/auth/*` daraltıldı:** yalnız `/auth/user/*`, `/auth/session`, `/auth/token/refresh`; burada müşteri yok, `/auth/customer/*` 404. `authMethodsPerActor` yalnız `user: ["emailpass"]`.
- **Disable denemesi:** kapatıldı ve migrate edilmiyor: product, promotion, customer, cart, region, tax, currency, payment, order, fulfillment, inventory, stock_location. Açık kalmak zorunda: sales_channel, store, pricing (Medusa açılışta varsayılanlar workflow'unu çalıştırıyor: varsayılan satış kanalı, mağaza, fiyat tercihleri; bunlar kapalıyken sunucu başlamıyor, denendi). Bilerek açık: auth, user, api_key (Medusa'nın admin kimlik doğrulaması çözer), notification, file, altyapı modülleri (cache, caching, event bus, workflows, locking, search, settings). Medusa'nın kendi migration betikleri ticaret verisini düzeltir (sepet para birimi, ürün seçeneği, vergi bölgesi, envanter) ve tablolar olmadan hata verir: `db:migrate` `--skip-scripts` ile çalışır. **Medusa yükseltmesinde** yeni core migration betikleri gözden geçirilir; auth/user'a dokunan olursa elle çalıştırılır.
- **Env:** `NODE_ENV`, `DATABASE_URL`, `REDIS_URL` (yerel dışında zorunlu), `ADMIN_CORS`, `AUTH_CORS` (üst panel paneli 5174; canlıda aynı origin), `JWT_SECRET` ≠ `COOKIE_SECRET`, `CP_HASH_KEY` (yeni: hız sınırının e-posta kimliğini anahtarlı özetle sayar; Sonuçlar listesine eklendi), `LOAD_TEST`. Sonraki görevler kendi anahtarlarını ekler. Personel çerezi `sameSite: strict`, 8 saat.
- **server-kit'e taşınanlar (backend oradan alır, davranış aynı):** hız sınırı sayaçları (bellek, yedekli, Redis; Redis istemcisi enjekte), `ipBucket`, profil biçimi, sınır denetimi (`retryAfterSeconds`), `perIpScale`, `/auth/*` rota türleri ve kimlik alanı, rota yolu normalleştirme ve belirsiz hedef reddi, güvenlik başlıkları ve HSTS değeri, istek kimliği doğrulaması, Redis istemcisi (kesinti bildirimi geri çağırmayla), `tenantNamespace`, `errorSummary`. `ioredis` 5.11.1 server-kit bağımlılığı oldu. Profillerin değerleri uygulamada kalır (üst panelinkiler daha sıkı).
- **Bilerek kopya, şimdilik:** Medusa'ya bağlı ince middleware'ler (`requestBasics`, `rejectAmbiguousPath`, `routeAllowlist`, `rateLimit`, `rejectRequest`) her uygulamada kendi istek/yanıt biçimiyle yazılı; kural ve sayaçlar paylaşılır. Loglama Medusa'nın varsayılan logger'ı: backend'in pino + redaksiyon + istek bağlamı logger'ı GlitchTip'e bağlı olduğu için taşınmadı; üst panel kişi verisi loglamaya başladığında (C4, C7) server-kit'e alınır. Bugün loga yalnız yöntem, sorgusuz yol, durum ve neden yazılır. Backend'in bağlantı yeniden deneme düzeni (`integration-tests/database.js`) yerine üst panelin az bağlantılı testi yalnız `ipv4first` kullanır.
- **Derleme notu (C1 Ek'i):** `@qticaret/server-kit` hâlâ kaynak olarak alınır; üst panel de `ts-node`'la çalışır. Durum kötüleşmedi: `ts-node`'suz üretim imajı için paket derlemesi F16'da.

## Ek: C4 uygulaması (2026-11-11)

- **Paylaşılanlar (`@qticaret/server-kit`):** `security/proofs`: yanlış kanıt sayaçları (15 dakikada 10, günde 30), dakikada 10 kanıt sınırı, TOTP kodunu iki dakika içinde bir kez alma ve 6 rakam kuralı. Backend `api/http/reauth.ts` aynı sayaç anahtarlarıyla (`reauth:wrong:*`, `reauth:burst:*`, `reauth:used:*`) bunları oradan alır; kişi anahtarı her uygulamanın kendi anahtarlı özetidir (backend `PII_HASH_KEY`, üst panel `CP_HASH_KEY`), davranış değişmedi. `security/step-up` yeni: kısa ömürlü yeniden doğrulama kanıtı (aşağıda). TOTP ve kurtarma kodları zaten Medusa'nın auth modülünde (adr/0040 §2); taşınacak kendi kodumuz yok.
- **Kopyalananlar (bilerek, üst panelin kendi biçimiyle):**
  - `cp-staff` modülü (`staff-roles`'tan): `cp_staff_member` (kullanıcı başına bir rol, `deactivated_at`). Önbellek yok: birkaç personel, istek başına tek dizinli satır, hiç bayat değil. Mağazadaki "ilk kullanıcı sahip olur" kuralı **yok**: ilk sahip yalnızca `cp:create-owner` ile gelir. Son etkin sahip korunur (`cp.last_owner`).
  - `cp-audit` modülü (`audit-log`'dan): `cp_audit_entry`; IP yerine anahtarlı özeti (`ip_hash`, `CP_HASH_KEY`), tarayıcı bilgisi yok, bu yüzden `forgetClients` de yok. Yalnızca ekleme; üretilen yazıcılar kapalı.
  - Davet iş akışları (rol davetin `metadata`'sında, kabul kendi ucumuzdan, giriş kaydı davet edilen adrese ait olmalı), oturum dizini ve oturum uçları (mağazanın `account-store` oturum yarısı ve `staff-sessions`), giriş kodunu bir kez alma (`signInCodeOnce`), Mailpit taşıyıcısı (en sade hâli: mağazanınki mağazanın HTTP istemcisine bağlı), TOTP test yardımcısı.
- **Rota tablosu (`lib/staff/route-table.ts`):** her `/admin/cp/*` ucu açıkça yazılı; erişim `public` (oturumsuz: davet bilgisi ve kabul), `setup` (2FA geçilmeden: `GET /me`, `POST /me/mfa`, `POST /me/mfa/verify`) ya da rol listesi. Listede olmayan uç herkese 404. Birim testi her `route.ts`'in her yöntemi için bir satır, her satır için bir dosya ister; `AUTHENTICATE = false` ile `public` birbirini tutmak zorunda. Aynı tablo yeniden doğrulamayı, denetim kaydının eylem adını ve kaynağını, hassas okumayı belirler.
  - Bugünkü uçlar: kendi hesabı (`me`, profil, 2FA, kurtarma kodları, yeniden doğrulama, oturumlar) bütün rollere; personel listesi, davet, davet geri çekme, rol değişikliği, pasifleştirme, yeniden etkinleştirme, 2FA sıfırlama ve **denetim kaydı yalnızca `owner`** (ADR denetim kaydının okurunu belirtmiyordu; mağazadaki gibi sahibin). `operator` ve `finance` uçları C7 ve C16 ile gelir.
  - Sıra: hız sınırı → denetim kaydı (yanıt sonrası yazılır; reddedilenler dahil) → personel koruması → uca özel doğrulama.
  - Kimlik: aktör `user` olmalı; gizli API anahtarı (Medusa `/admin`'de kabul eder) personel değildir: 401 `cp.not_staff`. Rolü olmayan ya da pasif kullanıcı: 403 `cp.no_role`. 2FA'sız: 403 `cp.mfa_required`. Rol yetmez: 403 `cp.forbidden`.
- **2FA:** her zaman zorunlu. `ADMIN_MFA=off` yalnızca `development`/`test`'te kabul edilir, canlıda env şeması açılışı durdurur. "2FA geçti" = oturumun Medusa işareti (`mfa_challenge_completed_at`) **ve** hâlâ etkin bir etken (her istekte bir sorgu): kişi kendi 2FA'sını kapatınca ya da sahip sıfırlayınca açık oturumlar kurulum dışında hiçbir yere geçemez.
  - **Sapma:** kurulum Medusa'nın `/auth/mfa/factors*` ve `/auth/mfa/recovery-codes` uçlarından değil, `/admin/cp/me/mfa*` uçlarından yapılır (şifre, yeniden doğrulama, denetim kaydı bizde). İzin listesine yalnız girişin ikinci adımı için `/auth/mfa/challenges/*` eklendi; Medusa'nın kurulum uçları 404 (testli).
  - Kurulum onayı ilk kod **ve şifre** ister (adr/0040 §3'teki gerekçe: oturum tek başına hesaba başkasının uygulamasını koyamasın); yanlış şifre ve yanlış kod kanıt sayacına girer. Onaylanan kod harcanır. Kurtarma kodları onay yanıtında bir kez gösterilir. Kurulumdan sonra kişi kodla yeniden girer.
  - 2FA işlemleri workflow değil, doğrudan auth modülü çağrısıdır: TOTP sırrı ve kurtarma kodları hiçbir workflow girdisine ya da çıktısına girmez (§4.3). Kurtarma kodu üretilemezse etken geri kapatılır.
- **Yeniden doğrulama (sapma, adr/0040 §3'ten):** istek başına başlıkta kanıt yerine **kısa ömürlü kanıt**: `POST /admin/cp/me/step-up` (`totp` bir kez ya da kurtarma kodu) 5 dakikalık bir belirteç verir; hassas istek onu `x-cp-step-up` başlığında taşır. Yoksa 428 `cp.step_up_required`, bozuk/süresi geçmiş/başkasının ise 428 `cp.step_up_invalid`, yanlış kod 403 `cp.step_up_failed`, kilit 429 `cp.step_up_locked`.
  - Belirteç AES-256-GCM ile mühürlüdür; anahtar `CP_HASH_KEY`'den HKDF ile türetilir (`qt.step_up.v1`). Bağ (kullanıcı, giriş kaydı, çerez oturumuysa oturum kimliği, bearer'da belirtecin `jti`'si; inceleme düzeltmesi L4) ek veri olarak bağlanır: başka kişi ya da başka oturum için açılmaz (testli). Durumsuzdur: süresi içinde geri alınamaz; oturum kapanınca o oturuma bağlı belirteç işe yaramaz, pasifleştirilen kişi koruma katmanında zaten durur.
  - Neden: görev tanımı ve panelde arka arkaya birkaç değişiklik (rol değiştir, pasifleştir) tek kanıtla. Kanıt yöntemi yalnız 2FA'dır; şifre yalnız kurulum onayında.
  - İsteyenler: kendi 2FA'sını kapatma, yeni kurtarma kodları, oturum kapatma (tek ve diğerleri), davet, rol değişikliği, pasifleştirme, yeniden etkinleştirme, başkasının 2FA'sını sıfırlama. Davet geri çekme sormaz (erişimi azaltır).
- **Davet ve ilk sahip:** davet `operator`, `finance`, `readonly` verir; `owner` yalnızca `cp:create-owner email=<adres>` (`medusa exec`) ile, `bootstrap: true` davetle ve **etkin sahip yokken** (kabulde yeniden denetlenir). Betik etkin sahip varsa ya da adresin hesabı varsa reddeder, aynı adrese açık daveti yeniler, sistem satırı yazar. E-posta gidebiliyorsa bağlantıyı yazmaz (adres maskeli); gidemiyorsa bağlantıyı bir kez yazar, saklamaz (mağazanın `tenant:invite-owner` kuralı, §5.7). Panelden davette bağlantı yanıtta bir kez döner (`mailed: false` ise elle iletilir), mağazadaki gibi. Davet bilgi ve kabul uçları oturumsuzdur, izin listesi genişlemedi (`/admin/cp/invites/*`, `AUTHENTICATE = false`).
- **Pasifleştirme:** üye silinmez; `deactivated_at` yazılır, bütün oturumları kapanır, bir sonraki isteği 403. Kendini ve son etkin sahibi pasifleştiremez. Yeniden etkinleştirme eski rolüyle.
- **Oturumlar:** `POST /auth/session` oturum kimliğini kişinin dizinine yazar, `DELETE /auth/session` siler. `GET /me/sessions` oturumları kimliğin anahtarlı özetiyle gösterir (kimliğin kendisi asla). Oturum ömrü 8 saat (C3).
- **Denetim kaydı:** her `/admin/cp/*` mutasyonu, reddedilenler dahil, yanıt bittikten sonra: aktör, eylem (tablonun kalıbı), kaynak türü ve kimliği, durum kodu, istek kimliği, IP özeti, gövdenin **yalnız alan adları** (kod, şifre, e-posta değeri asla; testli). Personel listesi ve denetim kaydı okuması `sensitive_read`. **C7 için not:** TCKN görme kuralı "önce yaz, yazılamazsa gösterme"dir; bugünkü yanıt sonrası yazım ona yetmez, C7 uçta önceden yazar.
- **E-posta:** `EMAIL_TRANSPORT=mailpit` (+ `MAILPIT_URL`, `EMAIL_FROM`) yalnızca yerelde; canlıda şema reddeder. Canlı taşıyıcı (Resend ya da SMTP, mağazanın istemcisi server-kit'e taşınarak) F16'da. Değişken yoksa hiçbir şey gönderilmez, davet bağlantısı yapanına döner. Testler hiç e-posta göndermez (`integration-tests/setup.js` değişkenleri boşaltır; `env:init` `.env.test`'e yazmaz). Metinler `lib/mail/messages.ts` kataloğunda.
- **Hız sınırları:** `cp_step_up` ve `cp_mfa_setup` (IP başına 15 dakikada 30, üye başına 10), `cp_invite_public` (IP başına saatte 20); üstüne server-kit'in yanlış kanıt kilidi. Giriş ve ikinci adım C3'ün `/auth/*` profillerinde.
- **Yeni env (Sonuçlar listesine ek):** `AUTH_MFA_ENCRYPTION_KEY` (zorunlu), `ADMIN_MFA` (yalnız yerelde `off`), `CP_PANEL_URL` (canlıda https), `EMAIL_TRANSPORT`, `MAILPIT_URL`, `EMAIL_FROM`. `pnpm env:init` mevcut dosyalara eksikleri ekler.
- **Migration'lar:** `cp_staff` `Migration20261110205421`, `cp_audit` `Migration20261110205422` (adlar iki uygulamada tekil).
- **Kalan riskler (ilk hâli; aşağıdaki inceleme düzeltmeleri günceller):** (1) Henüz 2FA kurmamış hesabın şifresini bilen kişi kendi uygulamasını kaydedebilir (ilk kullanımda güven); davet edilen kişi hemen kurduğu için pencere kısa. (2) Yeniden doğrulama kanıtı 5 dakika boyunca geri alınamaz. (3) IP özeti anahtarı bilen için IPv4'te kaba kuvvetle çözülebilir: takma addır, anonim değil. (4) Bearer belirteci (yalnız testler ve betikler; panel çerez kullanır) pasifleştirmede iptal edilmez, koruma katmanı durdurur. (5) Belirteç yenilemesi (`/auth/token/refresh`) MFA işaretini taşımayabilir (adr/0040 §2): kişi yeniden girer, güvenlik açığı değil.

### Ek: C4 güvenlik incelemesi düzeltmeleri (2026-11-11)

İnceleme 1 yüksek, 4 orta, 8 düşük bulgu verdi; hepsi kapatıldı, her biri testli.

- **Medusa 2.21.2'de doğrulananlar (Context7 `/medusajs/medusa` ve testler):**
  - `POST /auth/token/refresh` geçerli herhangi bir belirteçten yeni bir belirteç üretir (üçüncü taraf girişinden sonra kullanıcı bilgisini doldurmak için). Belirteç ömrünü sınırsız uzatır ve hiçbir iptali tanımaz: izin listesinden **çıkarıldı** (404, testli).
  - `projectConfig.http.jwtExpiresIn` varsayılanı `1d`; üst panelde `15m`.
  - MFA meydan okuması: tek kullanımlık, ömrü `mfa.challenge_ttl_seconds` (300 sn), deneme sınırı `mfa.challenge_max_attempts` (5). Belgelerde doğrulama ucu belirteçsiz görünür; 2.21.2'de uç girişin şifre adımındaki belirteci ister (testte görüldü). Kimliği yine de istekten değil, şifre adımında bizim not ettiğimiz eşlemeden okuruz.
  - `auth_context` alanları: `actor_id`, `actor_type`, `auth_identity_id`, `jti`, `mfa_enabled`, `mfa_challenge_completed_at` (ISO metin); `iat` yok, bearer'ın `iat`'ı doğrulanmış belirteçten okunur.
- **H1, 2FA geçişi etkene bağlı:** `cp_staff_member.mfa_valid_after`. Oturumun 2FA'yı geçtiği an (`mfa_challenge_completed_at`, ms) bu andan eski olamaz. Değişiklik anları: kurulum onayı, kendi 2FA'sını kapatma, sahip sıfırlaması, yeniden etkinleştirme. Kapatmada ve yeni etken onayında kişinin bu istek dışındaki bütün oturumları biter. Eski oturum ve belirteç, yeniden kurulumdan sonra da ölü kalır; spec ters çevrildi (`staff-sessions` H1).
- **M1, bearer belirteci kalıcı kimlik değil:**
  - **Oturum dizini yetkilidir.** Çerez oturumu yalnız kişinin dizininde varsa geçer. Bir oturumu bitirmek dizinden düşürmektir, ardından depo da siler. Oturum deposuna erişemeyen CLI de böylece bitirebilir.
  - **Bearer belirteci** `/admin/cp/*`'de yalnız `development`/`test`'te kabul edilir; yayında 401 `cp.session_required`. Panel belirteci yalnız oturum açmak için kullanır.
  - **`tokens_valid_after`:**
    - Kalan bearer bundan eskiyse 401 `cp.session_revoked`.
    - Ölçü: 2FA geçmiş belirteçte geçiş anı (ms); geçmemiş, yalnız kuruluma erişen belirteçte `iat` saniyesi (aynı saniye sayılır).
    - Öne alındığı yerler: diğer oturumları bitirme, 2FA kapatma/sıfırlama, pasifleştirme, yeniden etkinleştirme.
    - Şifre değişikliği ucu henüz yok.
  - **Pasifleştir → etkinleştir:** eski oturum ve belirteci geri getirmez.
- **M2, kanıt kilidi kişiyi değil kimlik bilgisini kilitler:**
  - Yanlış kanıtlar kişi + kimlik bilgisi kapsamında sayılır (`server-kit` `scopedProofsLocked`/`countScopedWrongProof`). Kapsam: oturum özeti ya da belirteç `jti`'si; sınırlar 15 dakikada 10, günde 30, dakikada 10.
  - Kapsamlar üstü günlük tavan 100.
  - Uç hız sınırı da (`cp_step_up`, `cp_mfa_setup`) üye + kimlik bilgisi başına.
  - Son 5 dakikada kodla geçilmiş giriş, "diğer oturumları bitir" için yeniden doğrulama yerine geçer (`freshSignIn`; kurtarma kodu da sayılır).
  - Acil durum betiği: `cp:end-sessions user=<e-posta>` dizini boşaltır, belirteçleri durdurur, sistem satırı yazar. Redis ister.
  - Mağaza (backend) eski kişi başına sayaçla kalır; davranışı değişmedi.
- **M3, rol 2FA ile verilir:**
  - **Davetle gelen:** üye beklemede (`enrol_by` = kabul + 24 saat). Yalnız kurulum uçlarına geçer; rol, ilk etken onaylanınca (`activate`) verilir.
  - **Süre dolunca:** kişi hiçbir yere geçemez (`cp.no_role`), sahip yeniden sıfırlayana dek.
  - **Sahip sıfırlaması:** etkenleri kapatır, oturum ve belirteçleri bitirir. Tek kullanımlık kayıt bağlantısı (`/enrol#token=`, özeti `enrol_token_hash`) e-postayla gider, e-posta yoksa yanıtta döner; süre 24 saat. Kurulum onayı bu belirteci de ister (`cp.enrolment_token_invalid`).
  - **Bekleyen sahip:** "etkin sahip" sayılmaz.
- **M4, girişin ikinci adımı:**
  - **Kimlik:** şifre adımı yanıtındaki meydan okuma kimliği, giriş kaydıyla eşlenip dizine yazılır (5 dk). İkinci adım kimliği buradan okur; bilinmeyen meydan okuma 401 `cp.challenge_unknown`.
  - **Sayaç:** yanlış kodlar o giriş kaydının ayrı `sign-in` kapsamında sayılır. Kilitlenince 429 `cp.sign_in_locked`; açık oturumların kanıtları etkilenmez.
  - **Giriş sınırı:** e-posta başına bütün adreslerden saatte 50 (`perIdentityAnyIp`). Adresi bilen kişi o saat girişi tutabilir; açık oturumlara dokunmaz. Bilinçli denge.
- **L1, kayıt kapalı:**
  - `POST /auth/user/emailpass/register` yalnız geçerli davetle (`x-cp-invite` başlığı) ve davetin adresiyle; yoksa 403 `cp.register_closed`.
  - Adrese önceden açılmış, kullanıcısız giriş kaydı (ele geçirme hazırlığı) kayıttan önce silinir.
  - `reset-password`, `update`, `callback` ve diğer sağlayıcılar 404: izin listesi artık tam yol listesidir.
- **L2:** önyükleme daveti 1 saat (kendi denetimimiz, `created_at`'ten). Bağlantı yalnız `print-link=yes` ile ve e-posta gidemediyse yazılır. Betik ve belge, çıktısı tutulan işte çalıştırmamayı söyler.
- **L3:** yeni önyükleme daveti açık bütün önyükleme davetlerini geri çeker. "Etkin sahip yok" denetimi bekleyen üye eklenirken ve rol verilirken sahiplerin `FOR UPDATE` kilidi altında yinelenir.
- **L4:** yeniden doğrulama kanıtı oturum kimliğine ya da belirtecin `jti`'sine bağlıdır, sabit `bearer`'a değil.
- **L5:** mağazanın CSRF Origin denetimi taşındı (`api/http/csrf.ts`). Çerezli mutasyon `ADMIN_CORS`/`AUTH_CORS` kökeninden gelmeli; `/admin` gövdesi JSON olmalı.
- **L6:** rol değişikliği, pasifleştirme, yeniden etkinleştirme ve 2FA kapatma/sıfırlama `{ from, to }` yazar. `/auth/*` olayları kaydedilir: giriş, ikinci adım, kayıt, oturum açma, çıkış. Adres anahtarlı özetle, değer yok.
- **L7:** oturum notu yanıttan önce yazılır. Yazılamazsa oturumun girişi silinir, olay günlüğe gider (`cp.session_note_failed`); dizinde olmayan oturum zaten geçmez.
- **L8:** env `JWT_SECRET`, `COOKIE_SECRET`, `CP_HASH_KEY`, `AUTH_MFA_ENCRYPTION_KEY` ikişer ikişer farklı olmalı (büyük/küçük harf duyarsız).
- **Bilgi notları:**
  - Davet kabulü workflow'u `store: false`; yürütme kaydı tutulmadığı testli.
  - Kurulum onayı kod biçimini `codeFirstUse`'dan önce denetler.
  - DELETE uçları sorgu dizesi almaz.
  - Gövdesi bozuk istekte de koruma önce karar verir (operatöre 403, testli).
- **Migration:** `cp_staff` `Migration20261110212907` (`enrol_by`, `enrol_token_hash`, `bootstrap`, `mfa_valid_after`, `tokens_valid_after`).
- **Kalan riskler (güncel):**
  - **Bekleyen üye:** 2FA kurmamış her üye artık bekleme süresiyle (24 saat) sınırlı; o süre içinde şifresini bilen kişi kendi uygulamasını kaydedebilir (ilk kullanımda güven).
  - **Yeniden doğrulama kanıtı:** 5 dakika geri alınamaz; bağlı olduğu oturum bitince işe yaramaz.
  - **IP özeti:** takma addır.
  - **Kullanıcı başına girişi tutma:** saatte 50, açık oturumlar etkilenmez.
  - **Kurulum belirteci aynı saniyede:** 2FA geçmemiş belirteç iptalle aynı saniyede verilmişse geçer, ama yalnız kuruluma erişir.
  - **Bellek dizini:** Redis'siz geliştirmede dizin süreç belleğindedir; `cp:end-sessions` o durumda reddeder.

## Ek: C5 uygulaması (2026-11-11)

- **Paket:** `packages/admin-ui` (`@qticaret/admin-ui`), kaynak olarak alınır: `exports` alt yolları `./ui/*`, `./patterns/*`, `./charts/*`, `./hooks/*`, `./lib/*`, `./theme`, `./i18n`, `./styles.css` doğrudan `src`'yi gösterir (`@qticaret/ui` gibi). İçeride göreli yollar; uygulama alt yoldan alır. React, i18next/react-i18next, TanStack Router/Query, React Hook Form ve sonner `peerDependencies` (uygulamanın tek kopyası; pnpm'de panelinkiyle aynı dizin, denetlendi). shadcn `components.json` pakete taşındı, CLI orada çalışır. Ayrıntı ve klasörler docs/18 §6.
- **Taşınanlar:** bütün `components/ui` (33 ilkel), `components/charts` (5), alan bilgisi taşımayan desenler (sayfa başlığı, ızgara, sekmeler, veri tablosu, filtre sekmeleri, arama, arama seçici, sayfalama, sihirbaz, adım göstergesi, kart formu, bölüm kartı, katlanır bölüm, form bölümü, form ve kayıt pencereleri, kayıt gezgini, onay ve ayrılma koruması, sayı alanı, etiket girişi, durum rozeti, boş satır, yükleniyor/hata/boş durumları, KPI kutusu, istatistik kartı, değişim rozeti, dönem seçici, gün aralığı süzgeci, bölüm gezintisi, bildirimler), kancalar (`use-mobile`, `use-record-walk`, `use-section-open`, `use-open-part`, `use-hold-step`, `use-two-way-sticky`), `lib` (`utils`, `format`, `money-input`, `number-step`, `days`, `forms`, `input-mode`, `page-spans`), tema (`tokens.css`, motor, renk, grafik ve menü türetimi, `apply.ts`) ve `globals.css`'in token/`@theme`/temel/odak kuralları (`styles.css`, kendi `@source`'uyla). Testleri birlikte taşındı; paketin kendi `house-rules.spec.ts`'i var.
- **Panelde kalanlar:** `MediaField`/`MediaPicker` (ortam kütüphanesi API'si), `AsyncBody` (`lib/errors` hata sözlüğüne bağlı), `components/layout/*` (gezinme, mağaza işareti, yeniden doğrulama), `theme/schema.ts` (görünüm formunun i18n anahtarlı şeması), `theme/storefront.ts` (vitrin renkleri), `lib`'in geri kalanı (sdk, errors, i18n örneği, csv, slug, gtin, reauth…). Giriş sayfası ve metin düzenleyici sınıfları (`.qt-auth-*`, `.qt-prose`) panelin `globals.css`'inde.
- **Metinler:** bileşenler `useTranslation("admin-ui")`; anahtarlar panelde oldukları adlarla (ör. `common.close`, `list.range`) ad alanına alındı, panelin artık kullanmadığı 33 anahtar `translation`'dan silindi. Panel `lib/i18n.ts`'te `ns: ["translation", "admin-ui"]` ile ekler.
- **Sapmalar (bağlanmama kuralı için):**
  - `useSectionOpen` oturumdaki kişiyi Query önbelleğinden (`@/features/auth/api/me`) okuyordu; artık `SectionOwner` bağlamından (kişiyi veren işlev, her çizimde sorulur). Panel `main.tsx`'te önbellekteki kullanıcıyı verir: davranış ve `localStorage` anahtarı (`qt.panel.section:<kişi>:<ad>`) aynı.
  - `PeriodPicker` dönem adlarını panelin `period.*` anahtarlarından okuyordu; artık `labelOf` alır (iki çağıran).
  - `DayRangeFilter` bugünü `features/reports/range` `turkishDay` ile buluyordu; aynı hesabı yapan `lib/days` `dayOf` kullanılır.
  - `PageTabs` ve `useOpenPart` uygulamanın rota türlerini bilmez: `?part=` yalnızca kendi anahtarıyla okunup yazılır.
- **Görünüm:** panelin üretim derlemesinin CSS'i taşımadan önceki ve sonraki hâliyle bayt bayt aynı (`index-eBGAcUx0.css`).
- **e2e:** çalışma ağacında koşulamadı: kurulum geçici yöneticiyi depo kökündeki backend'in `.env`'iyle (`medusa user`) açar; çalışma ağacının `pnpm env:init` ile ürettiği env yeni bir veritabanı şifresi taşır ve çalışan Postgres'e bağlanamaz. Birleştirmeden sonra ana çalışma kopyasında koşulur.

## Ek: C6 uygulaması (2026-11-11)

- **Uygulama:** `apps/control-plane-panel` (`@qticaret/control-plane-panel`), panelle aynı yığın (React 19 + Vite, Tailwind v4 + `@qticaret/admin-ui`, TanStack Router/Query, RHF + Zod, i18next `tr`/`en`, Vitest, Playwright + axe). Port **5174** (`strictPort`); Vite vekili yalnız üst panelin yanıtladığı yolları (`/auth`, `/admin/cp`, `/health`) 9100'e geçirir, tarayıcının `Origin`'i (5174) değişmeden gider: `ADMIN_CORS`/`AUTH_CORS` onu adlandırır (C3). Komutlar: `pnpm dev:cp` (API + panel), `dev:cp-api` (yalnız API), `dev:cp-panel` (yalnız panel); kök `pnpm dev` ikisini de dışarıda bırakır. Turbo `lint`/`typecheck`/`test` yeni paketi kapsar.
- **Ekranlar:** giriş (e-posta + şifre → TOTP ya da kurtarma kodu; 2FA'sı olmayan üye doğrudan kuruluma), davet (`/invite#token=`: bilgi → `x-cp-invite` ile kayıt → kabul → yeni şifreyle giriş → zorunlu 2FA kurulumu), 2FA kurulumu (`/security/setup`: QR + anahtar, ilk kod + şifre, kurtarma kodları bir kez, sonra kodla yeniden giriş), sıfırlama sonrası kurulum (`/enrol#token=`: belirteç bellekte tutulur, şifreyle girilir, kurulum `enrolment_token` ile onaylanır), yeniden doğrulama penceresi (428 → kod ya da kurtarma kodu → `POST /me/step-up` → istek `x-cp-step-up` ile yeniden; kanıt süresince bellekte tutulur, art arda değişiklikler tek kodla, çıkışta unutulur), Hesabım (profil, 2FA durumu, yeni kurtarma kodları, yeni telefona taşıma, oturumlar + kapatma + diğerlerini kapatma), Personel (sahip: liste, davet, rol, pasifleştirme/yeniden etkinleştirme, 2FA sıfırlama; e-posta gidemediyse bağlantı bir kez gösterilir; davet geri çekme), Denetim kaydı (sahip: sayfalı liste, satır → kayıt penceresi), boş Gösterge, erişimi olmayan üyenin sayfası (`cp.no_role`).
- **Hata eşleme:** üst panelin `cp.*` ve `errors.*` anahtarları `errors.cp.*`/`errors.api.*` Türkçe metinlerine; doğrulama cümlesinin içindeki `cp.*` anahtarı da bulunur; Medusa'nın İngilizce cümleleri ekrana çıkmaz (duruma göre metin). Yönlendirme: 401 → giriş, 403 `cp.mfa_required` → kurulum, 403 `cp.no_role` → erişim yok sayfası, 428 → yeniden doğrulama penceresi.
- **Sapmalar:**
  - **Port 5174 kaldı** (görev tanımı 5180 diyordu): ADR, C3/C4 env şablonu (`ADMIN_CORS`, `AUTH_CORS`, `CP_PANEL_URL`), davet bağlantıları ve C4 testleri 5174'ü sabitliyor; `pnpm env:init` var olan değerleri değiştirmediği için 5180 sahibin `.env`'ini elle düzeltmeyi gerektirirdi (CSRF Origin denetimi aksi hâlde 403 verir).
  - **Bağlantı yolları** arka ucun ürettiği `/invite` ve `/enrol` (görevdeki `/davet` değil).
  - **İstemci `@medusajs/js-sdk` değil, ince `fetch`** (`src/lib/api.ts`): akış oturum modunun gizlediği adımlara dayanıyor (şifre adımının belirteciyle meydan okuma doğrulaması, kayıt ve kabulde bearer, `x-cp-invite`, `x-cp-step-up`) ve yanıtlar anahtar taşıyor. Yeni bağımlılık yok; belirteç yalnız oturumu açmak için kullanılır, tarayıcıda saklanmaz.
  - **Oturum çerezinin adı `qt_cp.sid`** (`apps/control-plane/src/lib/session-cookie.ts`, `medusa-config.ts` `sessionOptions.name`, CSRF denetimi aynı adı okur; birim testli). Tarayıcı çerezi port değil ana bilgisayar adıyla tutar: aynı makinede mağaza paneli (5173 → 9000) ile üst panel aynı `connect.sid`'i kullanınca her girişte birbirinin oturumunu düşürüyordu. Güvenlik davranışı aynı; C4 HTTP testleri (66) yeşil.
  - **Sabit tema:** marka rengi `#5b21b6` (mor), koyu menü, açık/koyu sistemi izler; tarayıcıda hiçbir şey saklanmaz (`bootTheme` ve `qt.panel.appearance` anahtarı kullanılmaz). Kalıcı "Üst panel" şeridi (`--cp-bar-height` 2 rem, `bg-primary`) giriş sayfaları dahil her sayfanın üstünde, yapışkan; menü ve üst çubuk onun altına yerleşir.
  - **Gelecek bölümler** (Mağazalar, Paketler, Ödemeler, Sürümler) menüde görünür ama devre dışı, "Yakında" etiketiyle; Personel ve Denetim kaydı yalnız sahibe görünür (API yine karar verir).
  - **Telefonda menü çekmecesi** bir seçimden sonra kapanır (mağaza panelinde açık kalıyor; orada da düzeltilmesi önerilir).
- **e2e geçici sahibi:** `apps/control-plane/src/scripts/e2e-owner.ts` (`medusa exec … make <e-posta> <şifre>` / `remove <e-posta>`): yalnız `development`/`test`'te ve yalnız `cp-e2e-<13 hane>-<6 hex>@example.com` biçimindeki adresle çalışır (birim testli); sahip rolü verir, 2FA'yı kurmaz. Kurulum projesi 2FA'yı panelin kendi kurulum sayfasından kurar (anahtar sayfadan okunur, kod testte hesaplanır), kurtarma kodlarını çalıştırmanın klasöründe tutar; teardown oturumları, rolü, giriş kaydını ve kullanıcıyı siler (denetim satırları kalır: yalnız ekleme).
- **Testler:** Vitest 51 (giriş durumları, kurulum, davet, yeniden doğrulama penceresi ve yeniden deneme, hata eşleme, oturum yönlendirmeleri, menü, bağlantı belirteci; TR/EN anahtar eşleşmesi, Türkçede ünlem yok). Playwright 27 (`--workers=1`, masaüstü 1440 ve telefon Pixel 7): duman (her ekran, şerit, konsol hatası ve eksik çeviri yok), axe açık ve koyu (ciddi/kritik yok), gerçek üst panele karşı yeniden doğrulama (yanlış kod söylenir, kurtarma koduyla kanıt, değişiklik yapılır).
- **Şifre kuralı (C6 ardı):** mağazanın kuralı (adr/0043: 10–256 karakter, yaygın şifre listesi, adresin adı yok) `@qticaret/server-kit`'e taşındı (`passwordProblem`, `COMMON_PASSWORDS`; backend oradan alır, davranış aynı). Üst panel onu `/auth/user/emailpass/register`'da, davet denetiminden sonra ve giriş kaydı açılmadan uygular: 400 `auth.password_<sorun>` (mağazayla aynı anahtarlar); panel bunları Türkçe söyler, istemci alt sınırı 10. Şifre koyan başka uç yok (`update`, `reset-password` 404; kabul şifre almaz). Sızıntı listesi yoklaması yalnız mağazada kalır (dış servis); üst panelde kural çevrimdışıdır.
- **Kalan riskler:** üst panelde sızıntı listesi yoklaması yok (yukarıda); yeniden doğrulama kanıtı sekme belleğinde 5 dakika durur (sayfa yenilenince gider); `/invite` ve `/enrol` belirteci aynı sayfa yüklemesinde bellekte kalır.

## Ek: C7 uygulaması (2026-11-11)

- **Modüller:** `tenants` (`tenant`, `tenant_company`, `tenant_contact`, `tenant_domain`, `tenant_status_change`, `tenant_note`) ve `plans` (`package`, `package_limit`, `tenant_plan`, `tenant_override`). Kimlik önekleri `ten`, `tenco`, `tenct`, `tendm`, `tensc`, `tennt`, `pkg`, `pkglm`, `tenpl`, `tenov`. Durum, dönem ve limit anahtarları `@qticaret/types/control-plane` kayıt defterinden (üst panel artık bu pakete bağımlı). Mağaza kimliği `plans` modülünde düz metin sütundur (modül bağlantısı yok; kayıt yokluğu iş akışında denetlenir).
- **Migration'lar:** `tenants` `Migration20261110235654`, `plans` `Migration20261110235656` (adlar iki uygulamada tekil; `db:generate` "No changes").
- **Sapmalar ve somutlaştırmalar:**
  - **Paket ataması `tenant_plan`'da** (ADR'de paket aboneliğin alanıydı, abonelik C16). Mağaza başına bir satır; C16'nın aboneliği bu satırdan başlar ve fiyatla dönemin kopyasını tutar, hangi paketin limitleri uygulanacağını bu satır söyler.
  - **`package_feature` C9'a kaldı:** platform bayraklarının kayıt defteri mağazadadır ve belge onları C9'da taşır; C7'de kullanan yok. İstisna da şimdilik yalnız limit içindir.
  - **Durum geçiş uçları yok:** C7'de kayıt `provisioning` olarak açılır (ilk durum satırı `created`). Askıya alma/geri açma/kapatma, gönderilecek imzalı belge olmadan anlamsız olduğu için C9/C16 ile gelir. Kural servis yöntemindedir (`changeStatus`, sözleşmenin geçişleri dışını `cp.status_transition` ile reddeder); geliştirme tohumu My L'arte'ı onunla `active` yapar (neden `imported`, aktör `system`).
  - **"Yeni mağaza" basit kayıt penceresiyle** (ad, alt alan adı, isteğe bağlı paket): ADR yasaklamıyor. C11'in sihirbazı aynı iş akışıyla (`cp-tenant-create`) kaydı açar, sonra kurulumu başlatır. Alt alan adı (slug) değişmez: veritabanı, alan adı ve belge onunla adlanır. Biçim: küçük harf, rakam, tek tire, 3–30, harfle başlar; ayrılmış adlar listesi (`www`, `api`, `admin`, `panel`, `mail`, `quantticaret`…) `lib/tenants/slug.ts`'te.
  - **Roller (rota tablosu, birim testli):** okuma (liste, ayrıntı, etkinlik, paketler) herkese. Mağaza kaydı, ad, yetkililer, alan adları, notlar, paket ataması ve istisnalar `owner` + `operator`. Firma (fatura muhatabı) ve TCKN görme `owner` + `operator` + `finance`. Paket oluşturma, değiştirme, arşivleme `owner` + `finance` (ADR: finans paket fiyatlarının sahibi; operatör yalnız atar). Not düzenleme/silme notu yazana ya da sahibe (`cp.note_not_yours`).
  - **Yeniden doğrulama:** mağazanın ne ödeyeceğini belirleyen her uç kanıt ister: paket oluşturma (`POST /plans`, fiyat koyar), fiyat ve dönem (`POST /plans/:id/price`), mağazanın paketi (`POST /tenants/:id/plan`) ve paket adını taşıyabilen yeni kayıt (`POST /tenants`; güvenlik incelemesi M1). Paket adı, günler ve limitler istemez. TCKN görme kanıt ister. Roller değişmedi: paket atama sahip ve operatörün, paket oluşturma sahip ve finansın.
  - **TCKN:** `POST /tenants/:id/reveal-tckn` (GET değil: önbelleğe girmez, CSRF Origin denetiminden geçer; yanıt `Cache-Control: no-store`). Rota tablosuna `auditBefore` eklendi: uç `sensitive_read` satırını yanıttan **önce** ve beklenerek yazar, yazamazsa 503 `cp.audit_unavailable` ve TCKN gösterilmez; ara katman bu rotada yalnız reddedilenleri (428, 403, 404…) yazar. TCKN zarf şifrelemeyle mühürlenir (`CP_MASTER_KEY`, yerel KEK; bağlam `{ tenant_company, tckn, tenant_id }`, başka mağazanın satırına kopyalanan blok açılmaz), iş akışına mühürlü girer; son 4 hane maske için düz. Firma türü "şirket" yapılınca TCKN silinir; şirkete TCKN gönderilirse 400 `cp.tckn_company`.
  - **Mağaza ayrıntısını okumak önce kaydedilir** (`GET /tenants/:id`, `auditBefore`; inceleme M2): yetkililer kişisel veridir. Kayıt yazılamazsa 503 `cp.audit_unavailable`, veri gösterilmez. `readonly` rolü yetkililerin e-postasını (`s***@alan.com`) ve telefonunu (son iki hane) maskeli görür; sahip, operatör ve finans tam görür (başka her durum maskeli). Liste kişisel veri döndürmez, kaydedilmez.
  - **Etkinlik ayrı tablo değil:** `tenant_status_change` + mağazaya yazılmış denetim satırları (başarılı değişiklikler ve TCKN görme; okumalar ve kaydın açılışı hariç), yapanın adıyla. Bu yüzden her `/tenants/:id/*` kuralı kaynağı `tenant` + `:id` yazar (birim testli); kaydı açan uç kimliği `noteAuditResource` ile ekler. Denetim satırı yanıttan sonra yazıldığı için etkinlik bir anlık gecikebilir. Ödeme ve kurulum olayları C16 ve C10 ile katılır.
  - **Alan adları:** alt alan adı `<slug>.<PLATFORM_DOMAIN>` kayıtla açılır, doğrulanmış ve birincil; silinemez (`cp.domain_platform_kept`). Özel alan adı `pending` kaydedilir (doğrulama F16.7), bütün mağazalarda tekil (`cp.domain_taken`), platformun alanı altında olamaz. **Birincil yalnız doğrulanmış alan adı olur** (`cp.domain_unverified`: doğrulanmamış adres vitrinin bağlantılarını bozar, "bozuk müşteri çıktısı" sert engeli). Birincil özel alan adı silinince alt alan adı kendiliğinden birincil olur.
  - **Yetkililer:** telefon E.164'e çevrilir (Türkiye numaraları yazıldığı gibi; yabancı `+` ile). Birincil faturalama kişisi tektir (kısmi tekil dizin); yeni yetkili istenince alır, mağazanın ilk yetkilisi kendiliğinden alır, silinen birincilin yerine en eski faturalama yetkilisi geçer. Yetkili **kalıcı silinir** (yumuşak silme yok). Kişisel veri tutan iş akışları `store: false`; yürütme kaydı yok (testli).
  - **Paket arşivi uyarıdır, engel değil:** kullanımdaki paket arşivlenebilir; mağazaları onu ve limitlerini korur, yeni mağazaya verilmez (`cp.package_archived`), panel arşivlemeden önce kaç mağazada olduğunu söyler. Paket kodu değişmez (belge onu taşır). Fiyat kuruş, tam sayı; bir sonraki dönemden geçerli (§7).
  - **İstisna:** anahtar başına bir tane, gerekçe zorunlu (3–500), isteğe bağlı bitiş geçmiş olamaz (`cp.override_expired`). Uygulanan değer: süresi dolmamış istisna, yoksa paket; paketsiz mağazada limit yok (mağazanın yönetimsiz kipiyle aynı).
  - **Yeni env:** `CP_MASTER_KEY` (C8'den önce geldi, C8 aynı anahtarı kullanır; virgülle liste, yeni başta; diğer anahtarlardan farklı olmalı) ve `PLATFORM_DOMAIN` (geliştirmede `localhost`; tarayıcı `*.localhost`'u kendisi çözer; canlıda `localhost` reddedilir). `pnpm env:init` ikisini mevcut dosyalara ekler.
- **Uygulama notları:** MikroORM birim-iş akışı ekleri güncellemelerden önce yazar; aynı işlemde bir satırın birincil işaretini kaldırıp diğerine vermek için ara `flush` gerekir (`service.ts`). Medusa test koşucusu her testten önce veritabanını ilk `beforeEach` anının kopyasına döndürür: iç `describe`'ın `beforeAll`'da açtığı kayıt sonraki testte yoktur, `beforeEach` kullanılır.
- **Panel (`apps/control-plane-panel`):** menüde Mağazalar (`/tenants`) ve Paketler (`/packages`) açıldı; Ödemeler ve Sürümler "Yakında" kaldı.
  - **Mağazalar:** durum sekmeleri sayılarıyla, ad/adres araması (300 ms), sayfalama; görünüm adreste (`?status=&q=&page=`). Sütunlar: mağaza (ad + birincil adres), durum, paket, sonraki ödeme (C16'ya kadar "—"), açılış. Satır sayfayı açar. "Yeni mağaza" (sahip, operatör): ad, platform adresi (addan önerilir, elle yazılınca öneri durur, sonradan değişmez), isteğe bağlı paket; açılınca mağazanın sayfasına gider.
  - **Mağaza sayfası (docs/06 "Detay sayfası düzeni"):** başlıkta ad, durum, birincil adres · açılış günü. Eksik varken uyarı (engel değil): faturanın eksik firma alanları, faturalama kişisi yok, paket yok. Solda Firma (fatura bilgileri ve adres yan yana; TCKN maskeli, "Göster" yeniden doğrulamayla, bir dakika ya da "Gizle"ye kadar yalnız alanın belleğinde, sorgu önbelleğine girmez), sağda Özet (durum, paket ve fiyat, adres, sonraki ödeme, açılış, açan). Altta sekmeler: Yetkililer, Alan adları, Paket ve limitler, Notlar, Etkinlik (açık sekme `?part=`).
  - **Sapma (notlar sekmede):** docs/06 kısa notları sağ sütunun son kartına koyar; burada notlar sağda Özet'in altına konunca firma kartının yarısı boş kalıyordu (sahibin "boş alan yok" kuralı, ekran görüntüsüyle bakıldı). Notlar kendi sekmesinde; görev tanımı da sekme diyordu.
  - **Pencereler:** satıra tıklayınca tek standart pencere, ‹ n / m › ile: yetkili (`FormDialog`, kaydedilmemişte sorar, "Yetkiliyi sil" onaylı), alan adı (`DetailDialog`: "Birincil yap" doğrulanmamışta kapalı ve nedeni yazılı, "Kaldır" yalnız özel alan adında), paket (`FormDialog lg pane`: kod yeni pakette, ad, fiyat ₺ iki ondalık → kuruş, dönem, deneme ve ek süre, altı limit "Sınırsız" kutusuyla; fiyat ya da dönem değişince önce ad/gün/limitler kaydedilir, sonra yeniden doğrulamayla fiyat; "Arşivle" kaç mağazanın paketi koruyacağını söyleyerek sorar). Limit satırı istisna penceresini açar (değer ya da sınırsız, gerekçe, bitiş günü İstanbul gün sonu; "İstisnayı kaldır"). Firma tek pencerede düzenlenir; kayıtlı TCKN geri okunmaz, boş bırakılırsa kalır.
  - **Rol:** düğmeler rota tablosunun kararına göre gösterilir (okuma rolüne değişiklik düğmesi yok; finans firmayı düzenler ve TCKN'yi görür, paketleri yönetir; operatör mağaza ve istisnaları). API her istekte yeniden karar verir.
- **Testler:** HTTP 28 yeni (`tenants` 14, `tenants-tckn` 5, `plans` 9; `staff-audit` ve `route-allowlist` değişmeden yeşil, toplam koşulan 55), birim 181 (50 yeni: rota tablosu rolleri, env, alt alan adı/ayrılmış ad, alan adı, telefon, birincil faturalama kişisi, limitler, paket değişikliği özeti, TCKN mühürü). Panel Vitest 69 (16 yeni: liste, ayrıntı, TCKN gösterme ve önbellekte olmaması, eksik uyarısı, notlar, firma, istisna, etkinlik, paketler, fiyat yeniden doğrulaması, arşiv uyarısı, menü). Playwright 38 (`--workers=1`, masaüstü + telefon): duman ve axe yeni ekranlarla (`/tenants`, `/packages`, mağaza sayfası ve pencereleri açık/koyu), `shops.e2e.ts` (arama, mağaza sayfası ve sekmeleri, yeni mağaza penceresi kayıt açmadan kapanır, paket penceresi). E2e hiçbir kayıt yazmaz; mağaza sayfası için `cp:seed-dev` kayıtlarını kullanır, yoksa atlar.
- **Güvenlik incelemesi düzeltmeleri (2026-11-11; kritik ve yüksek bulgu yok):**
  - **M1:** yukarıdaki yeniden doğrulama satırı. Panel üçünü de mevcut pencereyle yapar (428 → kod → `x-cp-step-up` ile yeniden).
  - **M2:** yukarıdaki ayrıntı satırı.
  - **L1:** `auditBefore` uçlarında reddedilenler `sensitive_read` olarak yazılır (`mutation` değil). TCKN önce bellekte açılır, sonra kayıt yazılır, sonra gösterilir: açılamayan numara 500 olur ve geride "gösterildi" (200) satırı kalmaz. TCKN görme personel başına bütün adreslerden saatte 20 (`cp_tckn_reveal`, server-kit sayacı); aşılınca 429, kayıtlı.
  - **L2:** canlıda `PLATFORM_DOMAIN` en az iki etiket, alfabetik üst düzey etiket (IP adresi olamaz) ve `.localhost`, `.local`, `.test`, `.internal`, `.example`, `.invalid` olmayan bir ad olmalı (`publicDomainProblem`).
  - **L3:** `cp:seed-dev` ve e2e sahibi betiği yerel ortam dışında ve `DATABASE_URL` bu makinede değilse (`isLoopbackUrl`) reddeder; adres hata metnine girmez (`lib/local-only.ts`).
  - **L4:** ayrılmış adlara posta/altyapı (`mta-sts`, `autodiscover`, `autoconfig`, `webmail`, `wpad`, `ns3`, `ns4`, `www2`, `cpanel`, `aapanel`, `whm`, `pop3`, `smtp-relay`) ve taklit riski taşıyanlar (`login`, `giris`, `secure`, `fatura`…) eklendi.
  - **L5:** mağaza başına en çok 50 yetkili ve 50 özel alan adı (`cp.contacts_full`, `cp.domains_full`); okumalar bu sınırdan fazlasını alır. Paket–mağaza eşlemesi (`plansOf`) sayfa sayfa okunur, sessizce kesilmez. Paketin `custom_domains` limiti C14'te uygulanır.
  - **Testler (düzeltmelerle):** HTTP 100 (bütün takım; yeni `tenants-privacy` 3, `tenants-tckn` 2 yeni, rol ve kanıt testleri güncellendi), birim 196, panel Vitest 70.
- **Geliştirme tohumu:** `pnpm --filter control-plane cp:seed-dev` (yalnız yerel, tekrar çalıştırmak etkisiz): Başlangıç (490 TL/ay) ve Profesyonel (1.490 TL/ay) paketleri; My L'arte (`mylarte`, Profesyonel, `active`, `mylarte.com` doğrulama bekliyor, firma ve yetkililer boş, sabit not), Ege Zeytin Atölyesi (`active`) ve Kahve Durağı (şahıs firması, `provisioning`).

## Ek: C8 uygulaması (2026-11-11)

- **Modüller:** `vault` (ADR'nin `secrets`'ı: `secret_record`, `secret_escrow`, `cp_signing_key`) ve `fleet` (`tenant_key`; plan belgesi, kullanım ve sağlık C9/C13 ile gelir). Kimlik önekleri `secr`, `sesc`, `cpsk`, `tenkey`. Migration'lar: `vault` `Migration20261111015439`, `fleet` `Migration20261111015440` (adlar iki uygulamada tekil; `db:generate` "Skipped").
- **Sapma, modül adı `vault`:** ajanların araç izinleri `secrets/` adlı her klasörü okumayı reddediyor (`.claude` deny kuralı); bakımı yapanın okuyamadığı bir modül addan daha büyük risk. Tablolar ADR'deki adlarla kaldı.
- **`secret_record`:** sahip (`platform` \| `ten_…`), ad (küçük harf tanımlayıcı), sürüm, `kek_id`, `sealed` (C1'in tek sütun zarfı `qtenv1.<kek_id>.<sarılı DEK>.<şifreli metin>`; ADR'deki ayrı "sarılı veri anahtarı / şifreli metin" sütunları bu tek sütunda). AAD `{ table: "secret_record", owner, name, version }`: başka satıra, sahibe ya da sürüme kopyalanan blok açılmaz. Yeni değer yeni sürümdür (danışma kilidiyle sıralı, sürüm numarası silinmiş satırlarla da yeniden kullanılmaz). Servis: `putSecret`, `openSecret` (yalnız bellekte, `Buffer` döner, çağıran sıfırlar), `listSecretMeta` (değer ve mühürlü biçim asla), `secretCountsByKek`.
- **KEK listesi (karar):** ayrı `CP_MASTER_KEYS` yok; C7'nin `CP_MASTER_KEY`'i zaten virgüllü liste, yeni anahtar başta (`parseKekList`, kimlik `kekFingerprint`). Tek anahtarlı mevcut değerler aynen geçerli. Anahtar listesi `lib/vault/keks.ts`'te süreç belleğinde, env değeri değişince yeniden kurulur (TCKN mühürü de artık buradan alır).
- **Yeniden sarma:** `cp-sealed-rewrap` workflow'u (`store: false`) iki tabloyu dolaşır: `secret_record` ve C7'nin mühürlü TCKN'leri (`tenant_company.tckn_sealed`, KEK zarfın ikinci parçası). Yalnız yapılandırılmış ama güncel olmayan KEK altındakiler, 100'lük partilerle, kimlik imleciyle; her satır kendi işleminde karşılaştır-ve-değiştir (`WHERE sealed = <okunan>`). Veri yeniden şifrelenmez, yalnız DEK. Telafi yok, bilerek: yarım kalmış çalışma geçerli bir durumdur (eski ve yeni satır ikisi de açılır), sonraki çalışma bitirir; iki çalışma aynı anda zararsızdır. Açılamayan satır (bozuk, başka satırdan kopya) atlanır, yalnız kimliği loga yazılır. Çağıranlar: `POST /admin/cp/keys/rewrap`, `pnpm --filter control-plane cp:keys rewrap`, saatlik iş (`cp-sealed-rewrap`, :17; yalnız bekleyen varsa çalışır).
- **Eski KEK'i kaldırmak (karar: engel değil, açık uyarı):** KEK durumu üç sınıftır: `current`, `older` (yapılandırılmış), `missing` (satır var, anahtar yok). `removable` = içinde kayıt kalmamış eski anahtarlar. `cp:keys status` bekleyen ya da açılamayan kayıt varken 1 ile çıkar (anahtarı çıkarmadan önceki denetim); erken çıkarılmışsa panel kırmızı uyarı gösterir, saatlik iş her saat `cp.kek_missing` (yalnız parmak izi ve sayı) yazar, TCKN görme 500 `cp.tckn_unreadable` verir. Açılış reddedilmez: kayıp anahtar açılışı durdurmakla geri gelmez, sahibin "engel değil uyarı" kuralı; düzeltme anahtarı güncelin arkasına geri koyup yeniden sarmaktır (testli).
- **Üst panel imza anahtarı (sapma: env değil, depo):** ADR Sonuçlar'daki `CP_SIGNING_KEY` env değişkeni yok. Anahtar çifti üst panelde üretilir, tohum platform sırrı olarak (`cp_signing_key.<kid>`) depoda mühürlüdür; `cp_signing_key` satırı yalnız `kid`, açık anahtar ve durumu tutar. Tohum servis içinde üretilip doğrudan mühürlenir: workflow girdisine, çıktısına, yanıta ya da loga hiç girmez. Durumlar `next` → `active` → `previous` → `retired` (ADR'nin üç adımı dört durum ister: "geçildi ama hâlâ yayında" ile "kaldırıldı" ayrı). Adımlar: hazırla (ilk anahtar doğrudan `active`, sonrakiler `next`; ikinci `next` reddedilir), geç (`next` imzalar, eski `previous` olarak yayımda kalır; `previous` dururken ikinci geçiş reddedilir), kaldır (`previous` yayından çıkar, gizli yarısı **silinir**; geri alınamaz). Yayımlanan küme (`CONTROL_PLANE_PUBLIC_KEYS`, C9) = `active`, `next`, `previous`; uç ve `cp:keys public-keys` onu hazır env satırı olarak verir. `signPlanDocument` (C9 için hazır): `active` anahtarın tohumu yalnız o imza için bellekte açılır, `kid` satırla eşleşmezse imzalanmaz.
- **Mağaza anahtar çifti ve çalışma sırları:** `generateRuntimeSecrets()` saf işlevdir: `DATABASE_PASSWORD` (C10 `DATABASE_URL`'i kurar), `JWT_SECRET`, `COOKIE_SECRET`, `PII_ENCRYPTION_KEY`, `PII_HASH_KEY`, `CREDENTIALS_ENCRYPTION_KEY`, `AUTH_MFA_ENCRYPTION_KEY`, `STOREFRONT_IP_SECRET` (32 bayt hex) ve `TENANT_SIGNING_KEY` (Ed25519 tohumu). `issueTenantSecrets(container, tenantId)` setin emanet kopyasını mühürler, `cp-tenant-keys-record` workflow'u (`store: false`; yalnız açık anahtar ve mühürlü emanet taşır) açık anahtarı `tenant_key`'e (`active`, döndürmede `next`; `promoteTenantKey` `next` → `active`, eski `retired`) ve emaneti yazar; değerler yalnız çağırana döner. Emanet yazılamazsa açık anahtar telafiyle silinir (testli). Uç yok: C10'un kurulum adımı çağırır ve sırları doğrudan sağlayıcının deposuna yazar.
- **Emanet (`age`), sapma: npm bağımlılığı:** `age-encryption` 0.3.1 (age'in yazarı Filippo Valsorda'nın başvuru TypeScript uygulaması, BSD-3; 2026-08-28, ≥ 14 gün; bağımlılıkları `@noble/*`, `@scure/base`). ADR "yeni npm bağımlılığı yok, `age` aracı kabuksuz çağrılır" diyordu; ikili yerine süreç içi kütüphane: kabuk ve ikili sürüm bağımlılığı yok, Docker imajına araç eklenmez, testler her makinede koşar. `server-kit`'in kendi alt yolunda (`@qticaret/server-kit/escrow`), barrel'da değil: paket yalnız ES modülüdür, mağaza backend'i hiç yüklemez (kilit dosyası değişikliği yalnız bu paket ve jsdom'un isteğe bağlı `@noble/hashes` eşi). Node 24 `require(esm)` ile yüklenir; Medusa uygulamalarının `module: Node16`'sı statik içe almayı reddettiği için türü `resolution-mode: "import"` ile alınan bir `require`'dır. Jest (`--experimental-vm-modules`) ES modülünü `require` etmez: iki Jest yapılandırması `age-encryption`'ı Node'un kendi `require`'ına yönlendiren bir eşleme kullanır (`packages/server-kit/jest.age.cjs`, yalnız test).
  - Biçim: zırhlı age dosyası (`-----BEGIN AGE ENCRYPTED FILE-----`), içinde kanonik JSON `{ format: "qt-runtime-secrets-v1", tenant_id, issued_at, kid, secrets }`; sahip çevrimdışı kimlikle `age -d -i <anahtar>` ile açar. `secret_escrow.recipients` hangi açık anahtarlara mühürlendiğini tutar.
  - Üst panel emaneti açamaz: uygulama kodunda kimlik ve çözücü yok (birim testi `src`'de `AGE-SECRET-KEY`, `Decrypter`, `addIdentity`, `testing/age` arar). Gidiş-dönüş testi testin içinde üretilen kimlikle (`@qticaret/server-kit/testing/age`, yalnız testler).
- **Env:** `CP_ESCROW_RECIPIENTS` (ADR'deki çoğul ad; zorunlu): virgül ya da boşlukla ayrılmış 1–10 `age1…` alıcısı (X25519; kütüphanenin kabul ettiği ileri biçimler de), her biri kütüphanece denetlenir (bech32 sağlaması); `AGE-SECRET-KEY-` içeren değer açılışı durdurur, ileti değişkeni adlandırır, değeri asla. Canlıda değer `infra/backup`'ın `recipients.txt`'iyle aynı açık anahtarlardır (tek kurtarma anahtarı). `pnpm env:init` `__AGE_RECIPIENT__` yer tutucusunu `scripts/age-recipient.mjs` ile doldurur: `node:crypto` X25519 + BIP-173 bech32 (bağımlılıksız, kurulumdan önce çalışır), kimlik basılmadan atılır; geliştirmedeki emanetleri kimse açamaz, geliştirme verisi kurtarma istemez. `.env.test` de aynı yolla alır; testler kendi alıcılarını süreç içinde verir.
- **Uçlar ve roller (rota tablosu, birim testli):**

  | Uç | Kim | Yeniden doğrulama | Denetim |
  | --- | --- | --- | --- |
  | `GET /admin/cp/keys` | `owner` | — | — (sır yok, kişisel veri yok) |
  | `POST /admin/cp/keys/rewrap` | `owner` | evet | `cp_kek`; `rewrapped`, `failed`, `pending` sayıları |
  | `POST /admin/cp/keys/signing/prepare` | `owner` | evet | `cp_signing_key`; `kid` ve durum |
  | `POST /admin/cp/keys/signing/switch` | `owner` | evet | `active: { from: eski kid, to: yeni kid }` |
  | `POST /admin/cp/keys/signing/retire` | `owner` | evet | `retired: kid` |

  - Okuma da yalnız sahibin (karar): diğer rollerin anahtar bilgisine işi yok; açık anahtarlar gizli olmasa da hangi KEK'te kaç kayıt durduğu ve döndürmenin hangi adımda olduğu saldırgana yol gösterir. Yanıt `Cache-Control: no-store`. Gövde ve sorgu boş olmalı (`NoBody`/`NoQuery`). CLI'dan yapılan değişiklikler `system` satırı yazar.
- **Panel:** menüde Yönetim > Anahtarlar (`/keys`, yalnız sahip; Personel ve Denetim kaydının yanında). Yan yana eşit yükseklikte iki kart: İmza anahtarları (anahtar, durum, oluşturma, imzaya başlama; döndürmenin sıradaki adımı tek düğmede, adımın açıklaması altında; geçiş onaylı, kaldırma yıkıcı onaylı; mağazaların açık anahtar listesi kopyalanabilir) ve Şifreleme anahtarları (parmak izi, durum, sır ve TCKN sayısı; bekleyen/güncel satırı, açılamayan kayıtlar için kırmızı uyarı, çıkarılabilir anahtarlar; "Yeniden sar"). Her değişiklik mevcut yeniden doğrulama penceresinden.
- **Testler:** HTTP 108 (8 yeni: `keys` 4 — her rol ve her uç, kanıtsız 428 ve kaydı, üç adımlı döndürmede eski `kid`'in örtüşmede doğrulanması ve yeni belgelerin yeni anahtarla imzalanması, tohumun yanıtta, **bütün tablolarda** (hex/base64 biçimleri dahil), denetimde ve workflow kaydında olmaması; `vault-rotation` 4 — A ile yaz, B'yi başa ekle, yeniden sar, A'yı çıkar, TCKN ve sır okunuyor; erken çıkarılan anahtar açıkça söyleniyor ve CLI 1 ile çıkıyor, geri konup sarılınca okunuyor; çalışma sırları: açık anahtar ve emanet kayıtlı, değerler hiçbir tabloda ve logda yok, emanet test kimliğiyle açılıyor, döndürmede `next`/`retired`; emanet yazılamayınca açık anahtar geri alınıyor, bilinmeyen mağaza reddediliyor). Birim 213 (17 yeni: KEK sınıflaması, yeniden sarma A→B, akım/bilinmeyen/bozuk satırlar, çalışma sırları biçimleri, emanet gidiş-dönüşü, uygulama kodunda kimlik/çözücü yok, yerel alıcı betiği, env `CP_ESCROW_RECIPIENTS`, rota tablosu). server-kit 285 (5 yeni emanet). Panel Vitest 76 (6 yeni), Playwright 41 (`--workers=1`; `/keys` duman ve axe açık/koyu, masaüstü ve telefon; `keys.e2e.ts`: kartlar eşit yükseklikte, 64 hex hiçbir yerde yok, "Yeniden sar" yeniden doğrulama penceresini açıyor, yanıtlanmadan kapatılıyor, veri yazılmıyor).
- **Kalan riskler:** (1) Yerel KEK süreç belleğinde: süreç belleğini okuyan saldırgan bütün mühürlü değerleri açar (OpenBao Transit F16'da). (2) `openSecret` çağıranı değeri loglamamakla yükümlü; tek çağıran `signWithActiveKey` (tohumu kullanıp sıfırlar). (3) JavaScript dizeleri sıfırlanamaz: üretilen tohum ve çalışma sırları çöp toplayıcıya kadar bellekte kalır. (4) Kaldırılan imza anahtarının imzaladığı belgeler, mağazalar listeyi güncelleyene dek doğrulanmaya devam eder (C9'un dağıtımı). (5) Mağazaların listesinin gerçekten güncellendiği henüz denetlenmiyor (C9/C13): geçiş onayı bunu sahibe söyler, engellemez.

### Ek: C8 güvenlik incelemesi düzeltmeleri (2026-11-11)

İnceleme kritik, yüksek ya da orta bulgu vermedi; düşük bulgular ve bilgi notu kapatıldı, her biri testli.

- **L1, imza anahtarını geri alma:** telafi (`discardSigningKey`) kaldı (karar): bugün tek adımlı workflow'da tetiklenmez, ama C10'un bileşik akışında gerçek geri alma olur. Artık döndürmenin kilidi (`cp_signing_key`) altında ve koşul silmenin kendisinde (`WHERE id = ? AND status = 'next'`); mühürlü tohum yalnız satır silindiyse yok edilir. Araya giren bir geçiş anahtarı elinden alınamaz.
- **L2, yayımlanan küme:** `active`, `next`, `previous` doğrudan durumla sorgulanır (`publishedSigningKeys`), listeleme penceresinden hiç geçmez; liste en yeni başta. Test: 205 emekli anahtardan sonra imzalayan anahtar yayımda ve imzalıyor.
- **L3, `tenant_key`:** `kid` sunucuda açık anahtardan türetilir (`ed25519KeyId(publicKeyFromRaw(…))`); çağıranın `kid`'i farklıysa ya da anahtar geçersizse 400 `cp.tenant_key_invalid`. `promoteTenantKey` kaydetmeyle aynı danışma kilidini (`tenant_key:<mağaza>`) alır.
- **L4, yalnız test içe almaları:** ortak ESLint tabanında (`packages/config/eslint/base.js`, bütün paketler) `no-restricted-imports` ve `require` için `no-restricted-syntax`: `age-encryption` ve `@qticaret/server-kit/testing/*` test dosyaları, `integration-tests`, `e2e`, `src/test`, `escrow.ts`, `src/testing` ve `jest.age.cjs` dışında yasak. `testing/age.ts` `NODE_ENV` `test` değilse yüklenirken hata verir.
- **L5, `scripts/age-recipient.mjs`:** doğrudan çalıştırma denetimi `pathToFileURL(realpathSync(argv[1]))` (boşluklu yol, sembolik bağ); `init-dev-env.sh` betik başarısız olursa ya da `age1…` basmazsa durur, boş değer yazmaz.
- **Bilgi, firma kaydının geri alınması:** `restoreCompany` mühürlü TCKN'yi yalnız kayıt onu değiştirdiyse ve satır hâlâ kaydın yazdığı zarfı tutuyorsa geri yazar (karşılaştır-ve-değiştir); arada yeniden sarılmış zarf eski KEK'li zarfla ezilmez.
- **Testler (düzeltmelerle):** HTTP 112, birim 213, server-kit 285, panel Vitest 76; backend `tsc` ve `turbo run typecheck lint` (23 görev) yeşil.

## Ek: C9 uygulaması (2026-11-11)

- **Sözleşme (`@qticaret/types/control-plane`):**
  - **Platform bayraklarının listesi paylaşılır (karar):** `PLATFORM_FLAGS` (anahtar, varsayılan, `testOnly`), `platformFlags(nodeEnv)`, `isPlatformFlag`. Üst panel hangi bayrakları sunacağını buradan öğrenir. Mağazanın kayıt defteri (`platform-settings/features.ts`) uygulayan taraftır; backend birim testi (`platform-flags-contract.unit.spec.ts`) her `NODE_ENV` için iki tarafın anahtar ve varsayılanlarının aynı olduğunu denetler. Bugün iş bayrağı yok, yalnız testte `test.platform_sample` var (mağazanın kuralıyla aynı: yalnız `NODE_ENV=test`). Bu yüzden geliştirmede ve canlıda panel "bu sürümde özellik yok" der.
  - **Test vektörleri dışa açıldı:** `@qticaret/types/control-plane/testing` (`TEST_ONLY_*` tohumları, `planDocument`, `PLAN_VECTOR`). `NODE_ENV` `test` değilse yüklenirken hata verir. Mağazanın alıcı testleri sözleşmenin sabit imzasını bununla doğrular.
- **server-kit:** `RedisNonceStore` (`SET key 1 EX ttl NX`; Redis hatası fırlatılır, "görülmedi" sayılmaz). Üst panel `REDIS_URL` varsa onu kullanır (`qt:cp-nonce:<ad alanı>:`). Bellek deposu yalnız yerelde; canlıda zaten şema `REDIS_URL` ister.
- **Üst panel: belge.**
  - `fleet` modülünde `plan_document`: mağaza, `serial`, gövde, `content_hash`, `kid`, imza, `issued_at`, itme durumu (`pending`, `delivered`, `failed`, `superseded`), deneme sayısı, son hata kodu, `pushed_at`, `next_push_at`, `pulled_at`. Satırlar silinmez: mağazaya ne söylendiğinin geçmişi.
  - **Serial:** mağaza başına danışma kilidi (`plan_document:<mağaza>`) altında son + 1. İmza da kilidin içinde atılır: iki yayın aynı numarayı alamaz.
  - **Yalnız içerik değişince:** içerik (serial ve zaman hariç) kanonik JSON'un SHA-256'sı. Aynıysa yeni belge yok.
  - **Belge:** durum, paket kodu, altı limit (paket + süresi dolmamış istisna, `null` sınırsız), bayraklar (istisna, yoksa paket, yoksa listenin varsayılanı).
  - **Faturalama özeti C16'ya kadar nötr (karar):** `{ status: "active", due_on: null, grace_ends_on: null, amount: null, currency: "TRY" }`. Mağaza ödeme şeridi göstermez, durum bundan türemez.
  - Belge imzadan önce sözleşmenin katı şemasından geçer. İmza `signPlanDocument` (etkin anahtar), workflow `cp-plan-document-issue` (`store: false`); telafi, belge hâlâ en yeniyse siler.
  - **Paketsiz mağazaya belge yok (karar):** paket kodu sözleşmede zorunlu. Paketten çıkarılan mağaza son belgesiyle kalır.
- **Ne zaman yayınlanır:** paket ataması, yeni mağazanın paketi, paketin limit/bayrak/ad/gün değişikliği (o paketteki bütün mağazalar), limit ve bayrak istisnası ekleme/kaldırma. Fiyat tek başına içeriği değiştirmez (C16'ya kadar).
  - Yayın personel eyleminden **sonra** çalışır ve onu hiç bozmaz: hata loglanır (`cp.plan_issue_failed`).
  - `cp-plan-reconcile` işi (10 dakikada bir) bütün paketli mağazaları yeniden hesaplar. Böylece süresi dolan istisna ve başarısız yayın telafi edilir. İmza anahtarı yoksa çalışmaz, bir kez söyler.
  - İleride durum ve faturalama değişiklikleri (C15/C16) aynı `reissuePlanDocuments`'ı çağırır.
- **`package_feature` ve bayrak istisnası:**
  - `package_feature` (paket, anahtar, açık/kapalı). Satır yoksa varsayılan geçerlidir.
  - **Sapma, ayrı tablo `tenant_feature_override`:** ADR §2 limit ve bayrak istisnasını tek `tenant_override` tablosunda gösteriyordu. Ayrı tabloda anahtar ve değer tipleri kendi kısıtını korur (limit sayı ve kayıt defteri enum'u, bayrak boolean). Limit tarafının kodu değişmedi.
  - Kural aynı: gerekçe 3–500, isteğe bağlı bitiş geçmiş olamaz, anahtar başına bir istisna, `store: false` workflow, denetim `{ key, from, to }`.
  - **Uçlar:**
    - `POST /admin/cp/tenants/:id/feature-overrides` ve `DELETE …/:key`: `owner` + `operator`, yeniden doğrulama yok (limit istisnası gibi).
    - Paket bayrakları `POST /admin/cp/plans` ve `POST /admin/cp/plans/:id` gövdesinde `features`: `owner` + `finance`. Listede olmayan anahtar 400 `cp.flag_unknown`.
  - `GET /admin/cp/plans` `platform_flags` (anahtar + varsayılan) döner. Mağaza ayrıntısı `platform_flags`, `features` (paket/istisna/uygulanan) ve `feature_overrides` döner. `plan_document` (serial, zaman, itme, son çekme, itme hedefi) yalnız `owner` ve `operator`'a gider (finans ve okuma rolüne alan hiç gönderilmez).
- **`GET /tenant-api/v1/plan`:**
  - **Ayrı rota grubu (karar):** `lib/fleet/tenant-api-routes.ts` tablosu, `api/http/tenant-api.ts` koruması. İzin listesindeki `/tenant-api` öneki zaten vardı; tablo listede olmayan her yolu imzaya bakmadan 404 yapar. Personel tablosunda `/tenant-api` yoktur (birim testli), `/admin` altında değildir, personel kimliği okunmaz. Hız sınırı C3'ün `cp_tenant_api` profili.
  - **İmza:** mağazanın `active` ya da `next` `tenant_key`'i (`trustedTenantKey`), ±5 dk, `nonce` 10 dk. Gövde taşıyan GET 400.
  - **Ret kodları (karar):** biçim/eksik başlık 401 `signature.malformed`, zaman 401 `signature.stale`. Bilinmeyen anahtar, emekli anahtar, başka mağazanın kimliği ve yanlış imza aynı yanıtı alır: 401 `signature.invalid`, böylece mağazanın ya da anahtarın varlığı sızmaz. Tekrar 401 `signature.replayed` (yalnız geçerli imzadan sonra). Nonce deposu hatası 503 `tenant_api.unavailable`. Kesin neden yalnız logda.
  - Yanıt: en son belge `{ document, kid, signature }`, `Cache-Control: no-store`, `pulled_at` yazılır. Belge yoksa 404 `plan.none`.
- **İtme:**
  - `tenant.api_base_url` (boş olabilir) eklendi. C10'un kurulumu doldurur. Geliştirmede `pnpm --filter control-plane cp:fleet set-api-url <slug> <url|none>` (yalnız yerel, politika denetimli, sistem denetim satırı). Ayrıca `cp:fleet status <slug>` ve `cp:fleet issue <slug>`.
  - Yayından sonra beklemeden gönderilir. `cp-plan-pushes` işi her dakika vadesi gelenleri dener: 1, 2, 4… dk, en çok 60 dk, 12 deneme.
  - 5xx/408/429/ağ hatası yeniden denenir. Diğer yanıtlar (mağazanın reddi, ör. 409 eski serial, 404 yönetimsiz) kalıcı `failed` olur. Yeni belge eskisinin bekleyen itmesini `superseded` yapar.
  - **SSRF politikası (karar):** izin listesi `CP_TENANT_API_HOSTS` (ad ya da `.sonek`), yerelde ayrıca bu makine. Yalnız taban URL; `http` yalnız listedeki iç adlara. Yönlendirme izlenmez (`redirect: manual`, 3xx başarısız), 5 sn, yanıt gövdesi okunmaz. Canlıda liste boşsa itme yok, çekme yeter.
  - **Sapma, iç ağda IP sabitleme yok:** hedefler platformun kendi ağındaki adlardır; mağazanın `safe-fetch`'i genel adres kuralıyla bunları zaten reddederdi. docs/04'e işlendi.
- **Görünürlük:** mağaza sayfasında "Paket ve limitler" sekmesi limit kartının altında "Platform özellikleri" (satır → istisna penceresi) ve yalnız sahip/operatöre "Plan belgesi" kartını (sıra no, hazırlanma, gönderim durumu ve hata kodu, teslim, son çekme) gösterir. Paket penceresinde "Platform özellikleri" bölümü var (her bayrak bir onay kutusu, varsayılan yazılı). Bayrak yoksa bölüm bunu söyler, gövdeye `features` girmez.
- **Mağaza (`apps/backend`):**
  - **`control-plane` modülü** (`control_plane`): `control_plane_plan` tablosu (mağaza başına tek satır; `serial`, gövde, `kid`, imza, `received_at`, `confirmed_at`, `source` push/pull). Servis `planState()` sürümlü önbellekle çalışır (Redis işareti; süreçler en geç 1 sn'de görür). Durum, paket kodu, limitler, platform bayrakları, faturalama özeti, serial ve zamanları sunar. Yönetimsiz kipte `active`, limitsiz, bayrak yok.
  - **Limitler ve durum yalnız saklanır ve sunulur:** uygulama C14, durum etkileri C15.
  - **Doğrulama sırası** (`lib/control-plane/verify.ts`, saf): katı şema (bilinmeyen alan, bilinmeyen sürüm, eksik limit) → `kid` ile imza → `TENANT_ID`. Sonra serial kuralı servis içinde, danışma kilidi altında: itme ile çekme yarışamaz. Büyük uygulanır, aynısı yalnız `confirmed_at`'i ilerletir, küçüğü 409.
  - **`POST /hooks/control-plane/plan`:**
    - Gövde Medusa body-parser'ında 16 KB (413). `validateAndTransformBody(signedPlanDocumentSchema)` bilinmeyen alanda 400 verir.
    - İmza 401 (`signature.unknown_key` / `signature.invalid` mağaza tarafında ayrı söylenir: anahtarlar herkese açık, sızan bir şey yok), başka mağaza 403, eski 409, aynı 200 `{ applied: false }`, yönetimsiz 404 `control_plane.unmanaged`.
    - Hız sınırı `control_plane_push` (IP başına dakikada 60).
    - Rota envanteri testi değişmeden geçer (imzasız istek 400).
  - **Çekme:**
    - `control-plane-pull` işi her dakika çalışır. Açılıştan sonraki ilk çalışmada, sonra 15 dakikada bir çeker ("açılışta" = ilk dakika içinde; Medusa'nın açılış kancası yerine, karar).
    - İstek `TENANT_SIGNING_KEY` ile imzalıdır. `redirect: error`, 10 sn, yanıt 16 KB'tan büyükse okunmaz.
    - Yanıta itmeyle aynı denetimler uygulanır. Ulaşılamazsa son belge ve durum aynen kalır, `control_plane.pull_unreachable` loglanır.
    - **Sapma, `lib/clients` kullanılmaz:** imzalı isteğin `nonce`'u tek kullanımlıktır, istemcinin yeniden denemesi onu tekrar ederdi. Bu bir sağlayıcı değildir, Entegrasyonlar sayfasına hata yazmaz. Yeniden deneme bir sonraki çalışmadır.
  - **Eski belge uyarısı:** 24 saattir geçerli bir belge alınmadıysa (itme ya da çekme, `confirmed_at`) `control_plane.document_stale`, hiç belge yoksa `control_plane.no_document` uyarı kodu loglanır.
    - **Karar:** ölçü `issued_at` değil `confirmed_at`. İçerik değişmedikçe üst panel yeni belge yayınlamaz; `issued_at`'e bakılsaydı sağlıklı her mağaza bir gün sonra uyarırdı.
  - **Platform bayraklarının kaynağı (karar):**
    - Modüller yalıtıktır (backend CLAUDE.md). Bu yüzden `platform-settings` belge modülünü çağırmaz.
    - `control-plane-apply-plan-document` workflow'u (`store: false`) iki adımlıdır: belgeyi saklar, sonra bayrakları `platform-settings`'in yeni `platform_flag` tablosuna bütün küme olarak yazar (`syncPlatformFlags`). Her adımın telafisi var.
    - Mağazanın kayıt defterinde `owner: platform` olmayan anahtar yazılmaz, `control_plane.unknown_flags` ile loglanır, belge reddedilmez: yeni bir üst panel bayrağı eski bir mağazanın durumunu ve limitlerini kilitlemesin.
    - `isFeatureEnabled`/`listFeatures`/`readFeature` platform bayrağına yalnız yönetilen kipte bu değeri, aksi hâlde varsayılanı verir. Yönetimsiz kip bugünküyle aynıdır; değişken kaldırılınca saklı değerler de etkisiz kalır.
  - **Env:** `CONTROL_PLANE_URL`, `CONTROL_PLANE_PUBLIC_KEYS`, `TENANT_ID`, `TENANT_SIGNING_KEY` (`lib/control-plane/env.ts`). Biçim kuralları ve eşler şemadadır: anahtarlarla `TENANT_ID`, URL ile imza anahtarı birlikte, URL'de kimlik bilgisi ve sorgu yok, canlıda `http` yalnız tek etiketli iç ada ya da bu makineye. İletiler yalnız değişken adını taşır.
    - **Sapma:** "canlıda dördü zorunlu" kuralı açılışta `medusa-config`'te `assertControlPlaneConfigured` ile uygulanır. Şemanın `superRefine`'ında olsaydı mevcut env testlerinin tam canlı ortam örnekleri kırılırdı ("mevcut testler değişmeden" şartı). Etkisi aynıdır: dördü olmadan canlı mağaza açılmaz.
    - `env.example`'da dördü yorum satırıdır: geliştirme yönetimsiz kalır.
- **Migration'lar (adlar iki uygulamada tekil, yeniden `db:generate` "Skipped"):** üst panel `plans` `Migration20261111032638` (`package_feature`, `tenant_feature_override`), `tenants` `Migration20261111032639` (`api_base_url`), `fleet` `Migration20261111032640` (`plan_document`); mağaza `control-plane` `Migration20261111033457` (`control_plane_plan`), `platform-settings` `Migration20261111033458` (`platform_flag`).
- **Yeni env:** mağaza `CONTROL_PLANE_URL`, `CONTROL_PLANE_PUBLIC_KEYS`, `TENANT_ID`, `TENANT_SIGNING_KEY` (Sonuçlar listesinde zaten vardı); üst panel `CP_TENANT_API_HOSTS` (yeni, isteğe bağlı). Backend `@qticaret/types`'a bağımlı oldu (sözleşme ve paylaşılan liste).
- **Testler:**
  - **Backend birim:** alıcı denetimleri sözleşme vektörüyle (sahte imza, değiştirilmiş belge, bilinmeyen `kid`, başka mağaza, bilinmeyen alan/sürüm, eksik limit), env, çekme ritmi, bayrak sözleşmesi.
  - **Backend HTTP** `control-plane-plan.spec.ts`: büyük/aynı/eski serial, bayrağın kayıt defterine ulaşması, sahte imza, bilinmeyen anahtar, başka mağaza, bilinmeyen alan, 17 KB gövde 413. Üst panel kapalıyken son belgeyle durum korunuyor, 24 saat uyarısı veriliyor. İmzalı çekme, sahte üst panelin imza doğrulamasıyla yapılıyor ve aynı denetimler uygulanıyor. Yönetimsiz kipte 404 ve varsayılan bayrak.
  - **Üst panel birim:** içerik, hash, istisna süresi, şema; itme hedefi politikası, geri çekilme; tenant API tablosu ile dosyaları birbirini tutuyor ve personel tablosundan ayrı.
  - **Üst panel HTTP:** `tenant-api.spec.ts`
    - Bozuk imza, ±5 dk dışı (geçmiş ve gelecek), tekrar `nonce`, sorgu eklenmiş hedef, başka mağazanın kimliği, olmayan mağaza, emekli anahtar, `next` anahtarla geçiş.
    - Listede olmayan yol, gövdeli GET, personel kimliği.
    - **Tek süreçte uçtan uca:** üst panelin yayınladığı ve `/tenant-api`'den çekilen belge, mağazanın kendi `checkPlanDocument`'ıyla (`apps/backend`'den çalışma anında yüklenir) yayımlanan anahtarlarla kabul ediliyor, başka mağaza kimliğiyle reddediliyor.
  - **Üst panel HTTP:** `plan-documents.spec.ts`: yayın ve imza, aynı içerikte yeni serial yok, istisna ve paket limitiyle yeni serial, eskinin itmesi `superseded`, bayrak istisnasının rolleri ve doğrulaması, bilinmeyen paket bayrağı, belge durumunun rol görünürlüğü, itme (hedef yok, politika dışı hedef çağrılmıyor, 503 yeniden, 200 teslim, 409 kalıcı).
  - Panel Vitest ve Playwright (masaüstü + telefon, axe açık/koyu; paket sekmesi ayrıca denetlendi).
- **Kalan riskler:**
  1. İç ağ hedeflerinde DNS sabitleme yok (izin listesi ada göre).
  2. Mağaza tarafında `signature.unknown_key` ile `signature.invalid` ayrı yanıtlanır (açık anahtarlar gizli değil).
  3. Bir belge mağazanın bilmediği bayrağı taşırsa o bayrak varsayılanda kalır, belge yine uygulanır.
  4. Yayın ve itme personel isteğinin içinde beklenir (yayın) ya da beklenmeden başlar (itme). Süreç itme sırasında düşerse iş dakikada bir dener, çekme 15 dakikada telafi eder.
  5. `confirmed_at` aynı serial'in tekrar itilmesiyle ilerler: imza geçerli olmalı, saldırgan eski bir geçerli belgeyi tekrar iterek "taze" görünümünü uzatabilir. Durum yine değişmez; bu yalnız 24 saat uyarısını geciktirir.
  6. Çekmede `TENANT_SIGNING_KEY` süreç belleğinde ayrıştırılmış durur.

### Ek: C9 güvenlik incelemesi düzeltmeleri (2026-11-11)

İnceleme kritik ya da yüksek bulgu vermedi; iki orta ve yedi düşük bulgu kapatıldı, her biri testli. Yukarıdaki Ek'in ilgili maddelerini bunlar günceller.

- **M1, bayrakların yarışı:**
  - `syncPlatformFlagsStep` artık workflow'a verilen bayrakları değil, **o an saklı belgenin** bayraklarını ve serial'ını yazar (adım belgeyi `storedPlan` ile okur).
  - `platform_flag` satırları serial taşır (`Migration20261111041955`). Yazım tek danışma kilidi (`platform_flag:sync`) altındadır ve saklı olandan küçük serial hiçbir şey yazmaz: iki uygulama yarışınca yenisinin bayrakları kalır. Kilit, ilk yazımın tekil indeks yarışını da kapatır.
  - **Karar:** satırlar, mağazanın kayıt defterindeki her platform bayrağı için yazılır (belgede yoksa varsayılan). Belge bir bayrağı düşürünce serial kaybolmaz.
  - `same` sonucunda da yeniden yazılır, eski bir kopukluk kendiliğinden düzelir. `stale` yazmaz.
  - **Telafiler karşılaştır-ve-değiştirir:** `restorePlanDocument` aynı `control_plane_plan:<mağaza>` kilidini alır ve yalnız satır hâlâ geri alınan serial'daysa yazar. Bayrak telafisi (`undoPlatformFlagSync`) yalnız satırlar hâlâ o serial'daysa eski hâle döner.
  - **Test:** dört turda 5 ile 6 aynı anda itilir, sonuç hep 6'nın bayrakları. Eski serial'lı geç yazım `written: false` döner. Aynı serial yeniden itilince sapmış depo düzelir.
- **M2, `NODE_ENV` yok:** `assertControlPlaneConfigured` yalnız yerel ortamı (`isLocalEnv`: development, test) muaf tutar. Değişkensiz `NODE_ENV` canlı sayılır, şemanın geri kalanıyla aynı. Şemadaki `CONTROL_PLANE_URL` `http` kuralı da artık "yerel değilse" uygulanır.
- **L1:** `@qticaret/types/control-plane/testing` ortak ESLint tabanının yalnız-test yasağında (içe alma ve `require` deseni).
- **L2, `nonce` süresi:** sözleşme ve server-kit 11 dakika (`SIGNED_REQUEST_NONCE_TTL_SECONDS` = `DEFAULT_NONCE_TTL_SECONDS` = 660). Doğrulayıcı `nonceTtl <= 2 × skew + 1` ise hata fırlatır (en az 602 sn). Kabul penceresi iki yanda toplam 10 dakika; saniye yuvarlaması dahil, unutulan `nonce` artık hâlâ kabul edilen bir zamanla tekrar edilemez. İki paketin değerlerinin eşitliği testli.
- **L3, tazelik ve çekme cevabının bağlanması:**
  - `confirmed_at` (boş olabilir, `Migration20261111041954`) yalnız başarılı bir çekmeyle ilerler. İtme, `applied` da olsa `same` da olsa onu değiştirmez; tekrar itilen geçerli belge mağazayı "haberli" gösteremez.
  - **Sapma, çekme cevabının biçimi:** `{ plan: { document, kid, signature }, binding: { kid, signature } }` (`planPullResponseSchema`).
    - `binding`, üst panelin etkin anahtarıyla `plan_pull` amacına ve `{ nonce, tenant_id, serial, document_signature }` üzerine imzadır. `nonce` mağazanın bu istekte kendi ürettiğidir.
    - Mağaza önce bağlamayı kendi `nonce`'uyla doğrular, sonra belgeyi itme kurallarıyla denetler. Bağlamasız, başka bir isteğe bağlı ya da bozuk cevap `bad_answer` (log `control_plane.pull_refused`).
    - Etkin imza anahtarı yoksa üst panel 503 `plan.unavailable` verir.
  - 24 saat uyarısı böylece "son bağlı çekme"yi ölçer. Yalnız itme alan mağaza da uyarır, doğrusu bu: haberleşmenin kanıtı çekmedir.
- **L4, itme hedefi:**
  - `CP_TENANT_API_HOSTS` girdileri `ad[:port]`. Ad tek etiketli (Docker servisi) ya da `.internal`/`.local` altında olmalı; `.sonek` girdisi yalnız bu ad alanlarında. Diğerleri (genel ad, IP) açılışta reddedilir.
  - Portsuz girdi yalnız 9000, 80 ve 443'e izin verir. Yerelde bu makine yalnız 9000 ve yerel provisioner'ın 9200–9299'u (§6.3).
  - Denetim C10 için dışa açık: `tenantApiUrlProblem(url, env)`. `cp:fleet set-api-url` de onu kullanır.
- **L5:** canlıda `CONTROL_PLANE_URL`'e `http` yalnız tek etiketli DNS adıyla (`/^[a-z0-9-]+$/`; `localhost`, Docker servisi) gider. IP (köşeli IPv6 dahil) ve noktalı ad `https` ister (testli).
- **L6:** server-kit `verifySignedRequest` ve `verifyDocument`, anahtar bulunamayınca da sabit bir sahte açık anahtarla (süreç başına üretilir, gizli yarısı atılır) doğrulama yapar. Bilinmeyen anahtar ile yanlış imza aynı işi görür; zaman, mağaza+`kid` çiftinin varlığını söylemez. Anahtar araması veritabanı sorgusudur, o kısmın süresi bilerek eşitlenmedi.
- **L7, sınırlı iş:**
  - Yayın ve itme en çok 4'erli çalışır (`eachBounded`). İtmeler tek arka plan çalışmasıdır, mağaza başına ayrı `void` yoktur.
  - **Karar:** paket değişikliğinde 20 mağazaya kadar yayın istekte beklenir, daha fazlası aynı sınırlı arka plan çalışmasına bırakılır (`cp.plan_reissue_background`). Süreç düşerse uzlaştırma işi (10 dk) tamamlar.
  - `cp-plan-pushes` ve `cp-plan-reconcile` işleri Medusa'nın kilit modülüyle tek çalışmadır: kilit tutuluyorsa o dakika atlanır.
  - `nonce` deposunun Redis hataları ilk isteğin kapanışıyla değil, sürecin kaydedicisiyle yazılır.
- **Migration'lar:** mağaza `control-plane` `Migration20261111041954` (`confirmed_at` boş olabilir), `platform-settings` `Migration20261111041955` (`platform_flag.serial`). Adlar tekil, yeniden `db:generate` "Skipped".

## Ek: C10 uygulaması (2026-11-11)

- **`provisioning` modülü:** `provisioning_run` (mağaza, tür, durum `running`/`succeeded`/`failed`, sağlayıcı `local`/`docker`/`fake`, isteyen, port, hata kodu, başlangıç/bitiş, `heartbeat_at`) ve `provisioning_step` (ad, `position` (`order` SQL'de ayrılmış), durum `pending`/`running`/`succeeded`/`skipped`/`failed`/`compensated`, deneme sayısı, `created`, hata kodu, gizli olmayan çıktı). Kimlik önekleri `prun`, `pstep`. Mağaza başına aynı anda tek `running` çalışma (kısmi tekil dizin + danışma kilidi; ikinci istek 409 `cp.provisioning_busy`). 30 dakika sesi çıkmayan çalışma (süreci ölmüş) bir sonraki açılışta `failed` `provisioning.interrupted` olur. Migration `Migration20261111062743` (iki uygulamada tekil; yeniden `db:generate` "Skipped").
- **Türler (sapma):** §2'nin listesine `invite` eklendi ("Yeniden gönder"). Bugün çalışanlar `create`, `start`, `stop`, `invite`; diğerleri görevleriyle gelir.
- **`TenantProvisioner`:** §6.1'in sekiz yöntemi aynen (`lib/provisioning/provisioner.ts`). Somutlaştırmalar: `ProvisionTarget` (`tenant_id`, `slug`, `port`, yayımlanan açık anahtarlar; sır ve kişisel veri yok); `TenantCommand` kapalı birleşim (`migrate`, `bootstrap`, `invite-owner`, `apply-pack`, `plan-import`); `CommandResult` komutun çıktısını **taşımaz** (çıkış kodu, süre, zaman aşımı ve tek sonuç satırı). **`HealthResult` mağazada ne olduğunu da söyler** (`secrets`, `running`, `healthy`): adımlar arayüze yöntem eklemeden "var olanı atla"yı buradan okur.
- **Adımlar (`cp-provisioning-create`, `store: false`, yalnız kimlik taşır):** `allocate` → `secrets` → `database` → `migrate` → `bootstrap` → `sector_pack` (C12'ye kadar `skipped`) → `plan_document` → `start` → `health` → `api_url` → `owner_invite` → `activate`.
  - **Sapma, sırların üretimi ile yazımı tek adım ve veritabanından önce:** düz sır yalnız tek bir adım işlevinin belleğinde yaşar, adım sınırını (workflow verisi) hiç geçmez. Veritabanı rolünün şifresi o sırlardan biridir; `ensureDatabase` onu sağlayıcının kendi deposundan okur (yerelde env dosyası). Bu yüzden depo önce yazılır.
  - **İdempotent:** her adım önce bakar. Etkin `tenant_key` ve depo varsa `secrets` atlanır; anahtar var, depo yoksa `provisioning.secrets_lost` (sırlar geri getirilemez; `rotate_keys` işi, sonra). Veritabanı varsa rolün şifresi depodakine yeniden eşitlenir (`created: false`). `migrate` ve `bootstrap` kendi kurallarıyla tekrarlanabilir. Plan belgesi yalnız içerik değiştiyse yayınlanır; içe alma aynı serial'da `same` der. Çalışan süreç, aynı adres, `active` durum atlanır. Sahip daveti önceki bir çalışmada gittiyse atlanır ("yeniden gönder" ayrı bir `invite` çalışmasıdır). İkinci çalıştırmada **hiçbir adım bir şey yaratmaz** (testli ve gerçek çalıştırmada görüldü).
  - **Telafi yalnız `created`:** depo + `tenant_key` + emanet (yazım adımın içinde başarısızsa adım kendini de geri alır), veritabanı + rol, başlatılan süreç (durdurulur), `api_base_url` (önceki değere). Plan belgesi satırı geri alınmaz: mağazaya ne söylendiğinin geçmişi, onu içe alan veritabanı zaten düşer. Port çalışmaya yazılır ve mağazanındır: yeniden denemede aynı port.
  - **"Yeniden dene" = yeni bir `create` çalışması** (geçmiş kalır): baştan çalışır, var olanı atlar.
  - **Paket şart (karar):** paketsiz mağazaya belge yok (Ek C9); yönetilen mağaza belgesiz kalırdı. `allocate` hiçbir şey yaratmadan `provisioning.no_package` ile durur; imza anahtarı yoksa `provisioning.no_signing_key`; durum `provisioning` ya da `active` değilse `provisioning.tenant_status`.
  - **Davet kurulumu düşürmez (karar, "engel değil uyarı"):** ayağa kalkmış mağaza e-posta gidemedi diye silinmez. Adım `succeeded` kalır, `error_code` uyarıyı taşır (`provisioning.mail_off`, `mail_failed`, `no_owner_contact`, `owner_address_taken`, `invite_failed`, `invite_link_invalid`), çıktı `{ mailed: false }`; "Yeniden gönder" tekrarlar.
  - **`activate`:** `provisioning` → `active` (neden `provisioned`, aktör isteyen ya da `system`); sonra belge yeni durumla yeniden yayınlanır ve artık bilinen adrese itilir. Abonelik başlangıcı C16'nın.
  - **Hata kodu:** adım yalnız kod yazar (`ProvisioningError`, kod biçimli Medusa iletisi, yoksa `provisioning.step_failed`); ileti, komut çıktısı, SQL asla. Sürücü hatası ifadeyi (içindeki şifreyle) alıntılayabileceği için veritabanı katmanı her hatayı `provisioning.database_failed`'a çevirir.
  - **Hata enjeksiyonu (yalnız `development`/`test`):** `fail_at=<adım>` o adımı hiçbir şey yapmadan düşürür, öncekilerin telafisi görülür. HTTP uçları gövde almaz (`NoBody`); enjeksiyon yalnız CLI'da ve testte.
- **`LocalProvisioner` (yapıcı `NODE_ENV=development` dışını ve bu makinede olmayan Postgres'i reddeder):**
  - **Veritabanı:** `CP_LOCAL_PG_ADMIN_URL` ile `qt_tenant_<slug>` (tire alt çizgi) ve aynı adlı rol: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 40`, veritabanının sahibi; veritabanında `REVOKE ALL ... FROM PUBLIC`, role `CONNECT, TEMPORARY`. DDL bağlama almadığı için ad ve şifre katı desenle denetlenir (ad slug'dan, şifre 64 hex). Bırakma `DROP DATABASE ... WITH (FORCE)` + `DROP ROLE`.
  - **Depo:** `infra/tenants/local/<slug>/.env` (klasör 0700, dosya 0600, geçici dosya + `rename`; okurken sahibi biz değilsek, başkası okuyup yazabiliyorsa ya da bağlantıysa `provisioning.secrets_exposed`). İçinde: `DATABASE_URL` (rol şifresi yalnız burada), sekiz çalışma sırrı, `TENANT_ID`, `TENANT_SIGNING_KEY`, `CONTROL_PLANE_URL=http://localhost:9100`, `CONTROL_PLANE_PUBLIC_KEYS` (`publishedKeys`), `REDIS_URL` (paylaşılan; ad alanı `tenantNamespace` ile veritabanından), Mailpit (`EMAIL_TRANSPORT`, `MAILPIT_URL`, `EMAIL_FROM`), kendi portuyla `ADMIN_CORS`/`AUTH_CORS` (panel vekili bu kökeni yollar), `PASSWORD_BREACH_CHECK=off`, `PORT`. Değerler düz satırdır; dotenv'in büktüğü karakteri taşıyan değer reddedilir.
  - **Çalışma klasörü (karar):** `…/<slug>/server/`: derlenmiş backend'e (`apps/backend/.medusa/server/*`) ve backend'in `node_modules`'una bağlantılar, artı kendi `static/`'i. Medusa'nın yerel dosya sağlayıcısı (`<cwd>/static`, `/static`'ten sunulur) böylece mağazanın klasörüne yazar, ana geliştirme mağazasının `.env`'i de hiç okunmaz (dotenv `cwd`'den okur).
  - **Komutlar:** `process.execPath` + Medusa `cli.js` + sabit argümanlar, kabuk yok. Ortam yalnız mağazanın env dosyası + `PATH`, `HOME`, `NODE_OPTIONS=--conditions=qt-compiled`: üst panelin sırları çocuk sürece geçmez. Süre sınırı migrate 10, bootstrap 20, davet ve içe alma 2 dakika (SIGTERM, 5 sn sonra SIGKILL). Stdout'un son 64 KB'ı yalnız sonuç satırı için okunur. Çıktı mağazanın kendi `logs/commands.log`'una (0600) gider, **`invite-owner`'ınki hiçbir yere**.
  - **Süreç:** `medusa start -p <port>` ayrık (`detached`, kendi süreç grubu), `logs/backend.log`, `backend.pid` (0600). `stop` önce pid'in komut satırını `ps -ww -o command=` ile (kabuksuz) okur: tam olarak bu backend'in `cli.js start -p <bu port>`'u değilse hiçbir sinyal gönderilmez; sonra gruba SIGTERM, 15 sn sonra SIGKILL. `probe` `/health`'i yalnız bizim sürecimiz çalışıyorsa sorar (portta başka süreç varsa yanıtı sayılmaz). Port başlarken boş değilse `provisioning.port_in_use`.
  - **Port:** 9200–9299; üst panelin kilidi altında, başka mağazanın çalışmalarında olmayan ve bağlantı kabul etmeyen en küçüğü; mağazanın sonraki çalışmaları aynısını alır.
  - Backend derlenmemişse `provisioning.backend_not_built` (`pnpm turbo run build --filter=@qticaret/backend`).
- **Derlenmiş backend (karar; C1 Ek'indeki F16 notunu kapatır):**
  - **İnceleme:** `.medusa/server`'dan `medusa start` bugün de çalışıyor, çünkü Medusa CLI geliştirme bağımlılığı `ts-node`'u kaydedip paketlerin TS kaynağını derliyor. Düz Node ile (üretim imajı, `ts-node` yok) `@qticaret/server-kit` `ERR_MODULE_NOT_FOUND`, `@qticaret/types/control-plane` "Unexpected token 'export'" veriyor (denendi).
  - **Çözüm:** iki paket `dist`'e CommonJS derlenir (`tsconfig.build.json`; testler ve yalnız-test alt yolları hariç; `types`'ta yalnız `control-plane`, kendi `package.json`'ıyla CommonJS). `exports` koşullu: `{ "qt-compiled": "./dist/…", "default": "./src/…" }`. `qt-compiled` özel bir koşuldur, Node onu yalnız `--conditions=qt-compiled` ile seçer. Geliştirme, Jest, `tsc`, `ts-node`, Vite onu tanımaz, `src`'yi okumaya devam eder: hiçbir şey değişmedi. Derlenmiş backend bu bayrakla `dist`'i yükler (düz Node ile `medusa-config.js` yüklendi, `ts-node` kayıtlı değilken). Turbo `build` `^build`'e bağlı: paketler backend'den önce derlenir.
  - **F16:** imaj `NODE_OPTIONS=--conditions=qt-compiled` ile koşar.
- **Backend betikleri (kapalı listeye eklendi):**
  - **`tenant:invite-owner email=`:** mağazada personel varsa `owner_exists`, adresin kullanıcısı varsa `address_taken`. Yoksa açık kurulum davetlerini ve o adresin davetini geri çeker, Medusa davetini `{ role: "owner", bootstrap: true }` ile açar ve tek satır basar: `QT_TENANT_RESULT {"status":"invited","link":…}` (sözleşme `@qticaret/types/control-plane` `tenant-commands`). Logda yalnız durum. Kabulde (`/admin/staff/invites/accept`) kurulum daveti yalnız mağazada hiç personel yokken geçer: bilgi ucu ve okuma adımı tabloya bakar, rol ilk sahip kuralının kilidi altında verilir (`claimBootstrapOwner`); biri önce girdiyse 400 `staff.invite_invalid` ve Medusa'nın kabulü geri alınır. Panelden yeniden gönderme (`INVITABLE_ROLES`) sahip davetine dokunmaz. Panelin davet sayfası `owner` rolünü zaten çeviriyordu; yalnız türü genişletildi.
  - **`tenant:plan-import`:** stdin'den en çok 16 KB, itme ucuyla aynı denetimler (`receivePlanDocument`). **Sapma:** kaynak `push` olarak saklanır; ayrı `import` kaynağı yeni bir enum ve migration isterdi, belge yine üst panelden gelir ve tazelik zaten yalnız çekmeyle ilerler (Ek C9 L3). Sonuç `applied`/`same`/`refused`/`unmanaged`; ilk ikisi dışında çıkış kodu 1.
  - **`apply-pack`:** C12'nin; argümanı yok (`provisioning.command_unavailable`), adım `skipped`.
- **Davet e-postası:** bağlantı sahip yetkilisinin (`tenant_contact`, rol `owner`, ilki) adresine üst panelin göndericisiyle gider (`ownerInviteEmail`, `owner_invite.*` metinleri). Önce denetlenir (`ownerInviteLinkProblem`): mağaza panelinin `/invite` sayfası, yalnız `#token=`, kimlik bilgisi ve sorgu yok; yerelde yalnız bu makine, canlıda yalnız `https`. Mağazanın çıktısı e-postamızın neye bağlandığını seçemez.
- **Uçlar (rota tablosu `lib/staff/route-table-provisioning.ts`, birim testli; kaynak `tenant` + `:id`, mağazanın etkinliğinde görünür):**

  | Uç | Kim | Yeniden doğrulama |
  | --- | --- | --- |
  | `GET /admin/cp/tenants/:id/provisioning` (çalışmalar, en yenisi adımlarıyla, sağlayıcı) | `owner`, `operator` | — |
  | `GET /admin/cp/tenants/:id/provisioning/runs/:run_id` | `owner`, `operator` | — |
  | `POST /admin/cp/tenants/:id/provisioning` (kur, yeniden dene) | `owner`, `operator` | evet |
  | `POST …/provisioning/stop` | `owner`, `operator` | evet |
  | `POST …/provisioning/start` | `owner`, `operator` | evet |
  | `POST …/provisioning/invite` (yeniden gönder) | `owner`, `operator` | evet |

  - **Karar:** okuma da finans ve okuma rolüne kapalı (kurulum operatörün işi, §3.5). Her başlatma yeniden doğrulama ister: üst panelin dışında etki yaratır (veritabanı, süreç), durdurmak mağazayı kapatır, davet mağazanın sahip hesabını açar. Yanıt 202 ve çalışma, adımlar GET'le izlenir (panel C11). Sağlayıcı yoksa 503 `cp.provisioner_unavailable`. Gövde ve sorgu boş olmalı; yanıt `Cache-Control: no-store`.
- **CLI:** `NODE_ENV=development pnpm --filter control-plane cp:tenant-create slug= name= owner-email= [package=<kod>] [owner-name=] [fail-at=<adım>]` kayıt yoksa açar, sahip yetkilisi yoksa ekler, sonra aynı workflow'u çalıştırıp adımları canlı yazar. `cp:tenant status|stop|start|invite|retry <slug>`. İkisi de sistem denetim satırı yazar; çıktıda sır, bağlantı, adres yok.
- **Env:** üst panelde `CP_PROVISIONER` (`local` yalnız yerelde, `fake` yalnız testte, `docker` F16'ya kadar reddedilir; yoksa kurulum yok) ve `CP_LOCAL_PG_ADMIN_URL` (yalnız yerelde ve bu makinede). `pnpm env:init` ikisini `.env`'e yazar, `.env.test`'e yazmaz (testler `fake`). Test koşusu geliştiricinin `.env`'ini de okuduğundan `local` şemada yalnız canlıda reddedilir; geliştirme dışını sağlayıcının yapıcısı reddeder. Mağaza tarafında yeni env yok.
- **Gerçek yerel çalıştırma (2026-11-11):** `fail-at=health` ile: başlatılan süreç durduruldu, veritabanı ve rol düştü, klasör, `tenant_key` ve emanet silindi, mağaza `provisioning` kaldı. `retry` ile: bütün adımlar (migrate ≈10 sn, bootstrap ≈7 sn), sağlık 200, Mailpit'te sahibin daveti, mağaza belgeyi içe aldı (serial 1), `active` sonrası serial 2 itmeyle teslim edildi, mağazanın açılış çekmesi `/tenant-api/v1/plan` 200. Aynı komut ikinci kez: hiçbir adım bir şey yaratmadı. `stop`, `status`, `start`, `invite` çalıştı. Loglarda ve üst panel tablolarında davet bağlantısı yok.
- **Kalan riskler:**
  1. Yerelde üst panelin HTTP süreci Postgres yönetici URL'sini env'den okur (§3.4'ün "HTTP süreci yönetici rolünü tutmaz" kuralı F16'nın ayrı provisioner süreciyle karşılanır; geliştirici makinesi tek güven alanı).
  2. Mağazanın rolü dev Postgres'teki diğer veritabanlarına bağlanabilir (onlar `PUBLIC`'e `CONNECT` veriyor; tablolarına yetkisi yok). Yalnız geliştirme; F16'da her mağazanın veritabanı sunucusu ayrı politika.
  3. Üretilen sırlar JavaScript dizesi olarak çöp toplayıcıya kadar bellekte kalır (C8 riski 3).
  4. Pid denetimi komut satırına bakar: aynı kullanıcının aynı argümanlarla bilerek başlattığı başka bir süreç ayırt edilemez.
  5. Paylaşılan Redis ve aynı `localhost` çerez alanı: yerel mağazalar oturum çerezi adını ana mağazayla paylaşır (yalnız geliştirme).
  6. `dist` kaynağın gerisinde kalırsa derlenmiş backend eski paket koduyla koşar; önce `turbo build` (aşağıdaki düzeltmelerle yerel sağlayıcı eski derlemeyi reddeder).
  7. Sahip daveti kabul edilmeden yetkilinin e-postası değiştirilip "yeniden gönder" denirse yeni adrese gider: uç yeniden doğrulamalıdır ve denetim kaydında görünür.

### Ek: C10 güvenlik incelemesi düzeltmeleri (2026-11-11)

İnceleme kritik ya da yüksek bulgu vermedi; bir orta, sekiz düşük ve üç bilgi bulgusu kapatıldı ya da kaydedildi. Yukarıdaki Ek'in ilgili maddelerini bunlar günceller.

- **M1, davet bağlantısının adresi:** `tenant:invite-owner` artık yalnız davetin belirtecini basar (`{"status":"invited","token":…}`; sözleşmede `INVITE_TOKEN` deseni, 16–2048 karakter). Bağlantıyı üst panel mağaza panelinin bildiği kökeninden kurar (`shopPanelOrigin`, `ownerInviteLink`): yerelde `http://localhost:<port + 1000>`, canlıda mağazanın doğrulanmış birincil alan adı, yoksa doğrulanmış platform alt alan adı (`https`), hiçbiri yoksa uyarı `provisioning.no_panel_host`. Mağazanın verdiği bağlantı hiç kullanılmaz; `ownerInviteLinkProblem` kaldırıldı. Belirteç biçimi denetlenir (`provisioning.invite_token_invalid`).
- **I1, davet doğru paneli açar (karar):** yerel mağazanın paneli kendi portunun 1000 fazlasında açılır. Panelin Vite yapılandırması `PANEL_PORT`'u okur (yoksa 5173, `pnpm dev` değişmedi; `dev` betiğindeki sabit `--port 5173` yapılandırmaya taşındı): `PANEL_PORT=10200 PANEL_BACKEND_URL=http://localhost:9200 pnpm --filter panel dev`. Vekil kökeni mağazanın portuna yolladığı için mağazanın `ADMIN_CORS`/`AUTH_CORS`'u değişmez. Gerçek çalıştırmada Mailpit'teki bağlantının sayfası ve davet bilgisi o panelden, doğru mağazadan (`role: owner`) açıldı.
- **L1, başkasının veritabanı ve klasörü:** veritabanı ve rol oluşturulurken yorumlarına mağaza kimliği yazılır (`COMMENT ON DATABASE|ROLE … IS '<ten_…>'`). Var olan veritabanı ya da rol başka mağazanın işaretini taşıyorsa ya da işaretsizse `provisioning.foreign_shop`: ne kullanılır ne bırakılır. Env dosyası `TENANT_ID`'si bu mağaza değilse okunmaz, kullanılmaz, silinmez (`ownEnvFile`). Depo yalnız klasör hiç yokken yazılır; anahtarı olmayan bir depo `provisioning.secrets_orphaned` ile durur (üstüne yazılmaz). Böylece telafi yalnız bu çalışmanın yarattığı klasörü ve veritabanını kaldırabilir.
- **L2, rol şifresi Postgres'e düz gitmez:** SCRAM-SHA-256 doğrulayıcısı istemcide hesaplanır (`scramVerifier`: PBKDF2-SHA256, 4096 tur, 16 bayt tuz) ve `PASSWORD 'SCRAM-SHA-256$…'` olarak gider. RFC 7677 test vektörüyle birim testli (sunucu imzası ve istemci kanıtı yalnız saklanan anahtarlarla doğrulanır); gerçek çalıştırmada mağaza düz şifreyle bağlandı (migration).
- **L3, Redis:** yerel mağazalar üst panelin Redis sunucusunda başka bir mantıksal veritabanını kullanır (`shopRedisUrl`: 1, üst panelinki 1 ise 2); her mağazanın anahtarları yine kendi ad alanındadır. **F16:** her mağazaya ayrı Redis ya da ACL kullanıcısı (anahtar deseni sınırlı); paylaşılan mantıksal veritabanı yalnız geliştirme içindir.
- **L4, yönetici URL'si:** `CP_LOCAL_PG_ADMIN_URL` sorgu dizesi ve parça taşıyamaz (pg sürücüsü `host=` gibi ayarları sorgudan da okur; denetlenen ad dışına gitmesin). Env şeması ve sağlayıcının yapıcısı aynı denetimi kullanır (`localAdminUrlProblem`).
- **L5, dosyalar:** env, pid ve log dosyaları `private-files.ts`'ten geçer: okuma `open(O_RDONLY|O_NOFOLLOW)` ve aynı tutamaçta `fstat` (düz dosya, bizim, 0600), klasör de bizim ve 0700 olmalı; yazma `O_EXCL|O_NOFOLLOW` geçici dosya + `rename`. Pid dosyası da böyle yazılır ve okunur.
- **L6, süreç temizliği:** durdurmada SIGTERM'den sonra grup yoklanır (`kill(-pid, 0)`); üye kaldıysa gruba SIGKILL. Başlatmadan sonra pid dosyası yazılamazsa çocuk grubu öldürülür.
- **L7, durum:** `start` ve `invite` çalışmaları yalnız `provisioning` ya da `active` mağazada açılır, değilse 409 `provisioning.tenant_status`; `stop` her durumda açılır. `create` zaten `allocate`'te denetler.
- **L8, loglar ve takılan komutlar:** `commands.log` ve `backend.log` 5 MB'ı geçince `.1`'e döner (bir eski kopya). Komutlar `detached` (kendi süreç grubu) başlar; süre dolunca gruba SIGTERM, 5 sn sonra SIGKILL; bitiş `exit` olayıdır (çıktıyı tutan torun süreç adımı bekletemez) ve her durumda katı bir son süre vardır (süre + 15 sn). Testli.
- **I3, paylaşılan derleme ağacı (risk, kayıt):** mağazanın çalışma klasörü `.medusa/server`'a bağlantıdır; aynı kullanıcıyla çalışan bir mağaza süreci paylaşılan derlemeye yazabilir. Geliştirici makinesinde her süreç aynı kullanıcıdır, depoya da yazabilir: yerelde yalıtım hedeflenmez. **F16:** imaj salt okunur dosya sistemiyle koşar, mağazanın yazabildiği yalnız kendi birimidir.
- **Derleme güvenliği:**
  - Canlıda backend açılışı `@qticaret/server-kit` ve `@qticaret/types/control-plane`'in `dist`'e çözüldüğünü `require.resolve` ile denetler (`assertCompiledPackages`); kaynağa çözülürse açılmaz ve `--conditions=qt-compiled`'ı söyler. Yerelde ve testte kaynak beklenir.
  - Yerel sağlayıcı (`prepareServer`) backend'in, server-kit'in ve sözleşmenin derlemesini kaynaklarıyla karşılaştırır: test dışı herhangi bir kaynak dosya derlemeden yeniyse `provisioning.build_stale`, derleme yoksa `provisioning.backend_not_built`.
- **Gerçek yerel çalıştırma (düzeltmelerden sonra):** yeni mağaza baştan sona kuruldu (migrate ≈12 sn, bootstrap ≈9 sn, sağlık 200, belge serial 1 içe alındı, `active` sonrası serial 2 itildi). Veritabanı ve rolün yorumu mağaza kimliği, rolün şifresi `SCRAM-SHA-256$4096:…` olarak saklı. İkinci çalıştırma hiçbir şey yaratmadı. Mailpit'teki bağlantı `http://localhost:10200/invite#token=…`; `PANEL_PORT=10200 PANEL_BACKEND_URL=http://localhost:9200` ile açılan panelde sayfa 200 ve davet bilgisi `{ role: "owner" }`, doğru adresle. Loglarda bağlantı yok. Mağaza durduruldu; veritabanı, rol ve üst panel kayıtları silindi.
- **Kalan riskler (güncel):** yukarıdaki 1, 3, 4, 7 ve I3; risk 2 aynı (dev Postgres'in diğer veritabanları `PUBLIC`'e `CONNECT` verir), risk 5'in Redis kısmı mantıksal veritabanıyla daraldı, çerez adı paylaşımı sürüyor; risk 6 yerelde kapandı (eski derleme reddedilir), canlıda açılış denetimi var.

## Ek: C11 uygulaması (2026-11-11)

- **Tek giriş:** Mağazalar listesindeki "Yeni mağaza" artık sihirbazı açar (`/tenants/new`, yalnız `owner` + `operator`; diğer roller listeye döner). C7'nin basit kayıt penceresi kaldırıldı.
- **Sihirbaz (docs/18 §7 Wizard):** Firma → Yetkililer → Paket → Adres → Sektör paketi → Özet ve kur; sağ sütunda yapışkan "Yeni mağaza" özeti (ad, adres, paket, sahip davetinin gideceği adres).
  - **Firma:** mağaza adı (zorunlu tek alan), firma türü, unvan, vergi dairesi, VKN ya da TCKN, açık adres, ilçe, il, posta kodu. Boş fatura alanı engel değil: özette ve mağaza sayfasında uyarı. TCKN yalnız firma kaydıyla bir kez gider; özette maskeli (`*******0146`), geri okunmaz.
  - **C7 doğrulaması paylaşıldı (sapma: denetim haneleri panelde de):** `features/tenants/company-rules.ts` VKN ve TCKN'nin resmî denetim hanesi algoritmalarını (server-kit `tr/tax-id` ile aynı, kopya; panel Node paketini yükleyemez) ve üst panelin telefon okumasını uygular. Firma penceresi de bunu kullanır: önceden yalnız biçime bakıyordu, yanlış hane kayıtta 400 alıyordu. Sihirbazda kayıt açıldıktan sonra firma kaydının denetim hanesiyle düşmesi böylece önlenir.
  - **Yetkililer:** sahip zorunlu; adımın metni davetin bu e-postaya kurulumun sonunda gideceğini söyler. Faturalama ve teknik kişi kutuyla eklenir. Ayrı faturalama kişisi varsa birincil faturalama onundur, yoksa sahibin (C7 kuralı).
  - **Paket:** zorunlu (C10 paketsiz mağazayı `provisioning.no_package` ile reddeder). Satıştaki paketler eşit yükseklikte kartlar: fiyat ve dönem, deneme ve ek süre, altı limit. Paket yoksa sahip/finans için Paketler bağlantısı.
  - **Adres:** slug addan önerilir (elle yazılınca öneri durur), yazıldıkça denetlenir; altında `<slug>.<PLATFORM_DOMAIN>`. İsteğe bağlı kendi alan adı aynı denetimden geçer, `pending` eklenir.
  - **Sektör paketi:** "Genel" seçili; "Sektöre özel paketler" kapalı, "Yakında" etiketiyle. Seçim kayıtta `tenant.sector_pack` alanına yazılır (`general`); C12 paketleri getirince kurulum adımı onu uygular. Kod ve değer İngilizce (`general`), C12 paket kodlarını bu adla açmalı ya da eşlemeli.
  - **Davranış:** taslak yalnız sayfanın belleğinde (tarayıcı deposuna hiçbir şey, TCKN dahil, yazılmaz); geri/ileri her şeyi korur; "İleri" adımı denetler, sorun alanın altında satır içi (uyarı kutusu değil); bir şey yazılmışken sayfadan çıkmak sorar (`LeaveGuard`), kayıttan sonraki yönlendirme `ignoreBlocker` ile. Masaüstü ve telefon düzeni (telefonda sağ sütun alta iner).
- **Yeni uç `GET /admin/cp/tenant-availability?slug=&hostname=`:**
  - **Rol:** `owner` + `operator` (mağaza açabilenler); yeniden doğrulama yok, denetim satırı yok (kişisel veri okumaz; mağaza listesi zaten her personele açık). Genel `cp_admin_default` hız sınırı (dakikada 600) yeterli: panel 300 ms duraklamayla sorar.
  - **Yol (karar):** `/tenants/availability` değil, kendi yolu: `/admin/cp/tenants/:id` hem Medusa'nın dosya yönlendirmesinde hem rota tablosunda bu sözcüğü mağaza kimliği diye okurdu (birim testi bunu sabitler).
  - **Yanıt:** `{ platform_domain, slug?: { value, hostname, problem }, hostname?: { value, problem } }`; sorunlar mevcut anahtarlar: `cp.slug_invalid`, `cp.slug_reserved`, `cp.slug_taken`, `cp.domain_taken` (alt alan adı başka kayıtta), `cp.domain_invalid`, `cp.domain_platform`. Sorgu katı (bilinmeyen alan 400), slug en çok 64, alan adı 253 karakter. `Cache-Control: no-store`. Sormak hiçbir şeyi ayırmaz; kayıt ucu aynı denetimleri yeniden yapar (yarış hâlinde 422 `cp.slug_taken` → sihirbaz Adres adımına döner).
  - `POST /admin/cp/tenants` isteğe bağlı `sector_pack` alır (`general`; başkası 400).
- **"Kur" sırası (`wizard/setup-sequence.ts`):** kayıt (`cp-tenant-create`, paket ve sektör paketiyle; yeniden doğrulama) → firma → sahip → faturalama → teknik → alan adı → kurulum (`POST …/provisioning`). Yeniden doğrulama kanıtı beş dakika bellekte tutulduğu için tek kod kaydı ve kurulumu birlikte karşılar (C6 akışı; testli). Bitince mağaza sayfası `?part=setup` ile açılır.
  - **Yarım kalan kayıt politikası (karar):** kayıt açıldıktan sonra bir kayıt (firma, yetkili, alan adı) düşerse kayıt silinmez (geçerli bir `provisioning` mağazasıdır), kalan kayıtlar yine denenir, **kurulum başlatılmaz**: kimse karar vermeden eksik bilgiyle mağaza ayağa kalkmaz. Sihirbaz hangi parçanın neden düştüğünü söyler; "Kalanları yeniden dene" yalnız eksikleri (ve sonra kurulumu) yapar, "Mağaza sayfasına git" Kurulum sekmesini açar (sayfanın eksik uyarısı ve "Kur" düğmesi oradan devam ettirir). Kayıt açıldıktan sonra önceki adımlar kilitlenir (slug değişmez). Kaydın kendisi reddedilirse hiçbir şey yapılmamıştır, sihirbaz olduğu gibi kalır.
- **Kurulum sekmesi (mağaza sayfası, yalnız `owner` + `operator`; C10'un okuma kuralı):** sabit yerde (Paket ve limitler'den sonra; durum `active` olunca sekmeler yer değiştirmesin diye).
  - Sol: son çalışma (tür, durum, başlangıç, süre) ve adımları: Türkçe ad, durum simgesi ve sözcüğü, deneme (birden fazlaysa), süre, gizli olmayan çıktı (port, belge no, yanıt süresi, e-posta gitti/gitmedi), hata ya da uyarı Türkçe ve yanında kod. Başarısız çalışmada üstte neden ve "Yeniden dene" açıklaması; uyarılı adım (gidemeyen davet) ayrı uyarı kutusu.
  - Sağ: İşlemler (eşit boy dört düğme: "Kur"/"Yeniden dene", Başlat, Durdur, Daveti yeniden gönder; her biri yeniden doğrulamalı, Durdur önce sorar), son bilinen durum (çalışmalardan; ölmüş süreç C13'e kadar görünmez) ve kapalı düğmelerin nedeni. Yerel sağlayıcıda "Mağaza paneli (bu bilgisayar)": `http://localhost:<port+1000>` ve paneli açan komut (C10 yeni alan açmadı: `provisioner` ve çalışmanın `port`'u yeterli).
  - Alt: çalışma geçmişi; satır tek standart pencereyi açar (‹ n / m ›, adımlar `GET …/runs/:run_id`).
  - **Düğme kuralları (`provisioning/rules.ts`, C10'la aynı):** çalışma sürerken hepsi kapalı (`cp.provisioning_busy`), sağlayıcı yoksa hepsi kapalı; Başlat/Durdur/Davet bir kurulum başarıyla bitmeden kapalı; Başlat, Davet ve Kur yalnız `provisioning`/`active` mağazada; Durdur her durumda; kurulmuş ve `active` mağazada Kur kapalı ("Kurulum tamamlandı").
  - **Canlı izleme:** son çalışma `running` iken iki saniyede bir okunur; bitince durur ve mağaza sayfası yeniden okunur (durum `active` olur). Tarayıcı sekmesi gizliyken (TanStack Query `refetchIntervalInBackground: false`) ya da başka sekme açıkken (kart bağlı değil) istek yok.
  - **Hata eşleme:** `errors.provisioning.*` (C10'un bütün `provisioning.*` kodları ve komutların `<komut>_failed|_timeout` biçimi; test-yalnız `fake_*` kodları bilerek yok), `provisioning.compensation_failed:<kod>` iç içe, `cp.provisioning_busy`, `cp.provisioner_unavailable`, `cp.run_unknown`. Bilinmeyen kod genel cümle + kod.
- **e2e (karar: gerçek kurulum varsayılan e2e'de):** `wizard.e2e.ts` iki test. Birincisi hiçbir şey yazmaz (satır içi hatalar, geri dönüşte korunma, ayrılmış ad, kullanılabilir adres, sektör adımı, ayrılma sorusu). İkincisi (`@real`) arayüzden gerçek mağaza kurar: sihirbaz → "Kur" → TOTP ile yeniden doğrulama → Kurulum sekmesi → durum `active` (yerel sağlayıcı, ≈30–40 sn: migrate ≈11, bootstrap ≈7, sağlık ≈4), sonra aynı kanıtla "Durdur" ve kayıtlı çalışmalarla axe (açık/koyu, masaüstü ve telefon genişliği). Hızlı ve kararlı olduğu için ayrı etiketli test yapılmadı; sağlayıcısı olmayan üst panelde kendini atlar. Kurulum için `pnpm turbo run build --filter=@qticaret/backend` ve `CP_PROVISIONER=local` gerekir.
  - **Temizlik:** yeni `apps/control-plane/src/scripts/e2e-shop.ts` (`medusa exec … remove <slug>` / `remove-all`; yalnız yerelde, bu makinedeki veritabanında ve yalnız `e2e-<13 hane>-<6 hex>` slug'ında; birim testli). Süreci durdurur, veritabanını, rolü ve env klasörünü sağlayıcıyla bırakır (sağlayıcı başka mağazanınkine dokunmaz, Ek C10 L1), çalışmaları, anahtarları, emaneti, plan belgelerini, paket atamasını ve kaydı (firma, yetkili, alan adı ile) siler; denetim satırları kalır. Test kendi mağazasını `finally` ile, teardown kalan her e2e mağazasını siler.
  - **Yeniden doğrulama e2e'de:** kurulum (setup) projesi TOTP anahtarını da çalıştırmanın klasörüne (git dışı, teardown siler) yazar; `support/step-up.ts` henüz harcanmamış 30 saniyelik adımın kodunu kullanır (kodlar tek kullanımlık). Kurtarma kodları `step-up.e2e.ts`'te yenilendiği için kullanılmaz.
- **Testler:** üst panel birim 292 (17 yeni: adres uygunluğu, rota tablosu kararı, e2e mağaza betiğinin koruması), HTTP 138 (9 yeni `tenant-availability.spec.ts`: roller, boş/biçim/ayrılmış/alınmış slug, alan adı biçim/platform/alınmış, ikisi birden, bilinmeyen ve uzun sorgu, sektör paketi kaydı). Panel Vitest 115 (34 yeni: adım doğrulaması, denetim haneleri ve telefon, adımlar arası korunma, adres denetimi, kur sırası ve tek kanıt, yarım kalma ve yeniden deneme, Kurulum sekmesi çizimi, iki saniyelik izleme ve durması, gizli sekmede istek yok, düğme kuralları, kod sözlüğü). Playwright 51 (`--workers=1`, masaüstü + telefon; sihirbaz duman ve axe açık/koyu her adımda, Kurulum sekmesi axe, gerçek kurulum `active`'e kadar). Koşulardan sonra `qt_tenant_*` veritabanı ve rolü, mağaza süreci ve kaydı kalmadı (denetlendi).
- **Kalan riskler:** (1) "Son bilinen durum" çalışmalardan türer; çöken süreç C13'ün sağlık yoklamasına kadar "çalışıyor" görünür (Başlat yine açıktır, idempotent). (2) Uygunluk ucu bir slug'ın ya da alan adının bir mağazada olup olmadığını sahip ve operatöre söyler; mağaza listesi bunu zaten gösterir. (3) TCKN sihirbaz açıkken sayfa belleğinde düz durur (yalnız o sekmede; kayıttan sonra sayfadan çıkılınca gider). (4) Davet uyarısı yalnız son çalışmada görünür; sonraki bir başlatma/durdurma çalışması onu geçmişe iter (geçmiş penceresinde görünür).
