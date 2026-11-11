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
  - **Yeniden doğrulama:** paket fiyatı ve dönemi ayrı uçtadır (`POST /plans/:id/price`, kanıt ister); ad, gün ve limitler istemez. TCKN görme kanıt ister.
  - **TCKN:** `POST /tenants/:id/reveal-tckn` (GET değil: önbelleğe girmez, CSRF Origin denetiminden geçer; yanıt `Cache-Control: no-store`). Rota tablosuna `auditBefore` eklendi: uç `sensitive_read` satırını yanıttan **önce** ve beklenerek yazar, yazamazsa 503 `cp.audit_unavailable` ve TCKN gösterilmez; ara katman bu rotada yalnız reddedilenleri (428, 403, 404…) yazar. TCKN zarf şifrelemeyle mühürlenir (`CP_MASTER_KEY`, yerel KEK; bağlam `{ tenant_company, tckn, tenant_id }`, başka mağazanın satırına kopyalanan blok açılmaz), iş akışına mühürlü girer; son 4 hane maske için düz. Firma türü "şirket" yapılınca TCKN silinir; şirkete TCKN gönderilirse 400 `cp.tckn_company`.
  - **Mağaza ayrıntısını okumak kayıtlıdır** (`GET /tenants/:id`, `auditRead`): yetkililer kişisel veridir. Liste kişisel veri döndürmez, kaydedilmez.
  - **Etkinlik ayrı tablo değil:** `tenant_status_change` + mağazaya yazılmış denetim satırları (başarılı değişiklikler ve TCKN görme; okumalar ve kaydın açılışı hariç), yapanın adıyla. Bu yüzden her `/tenants/:id/*` kuralı kaynağı `tenant` + `:id` yazar (birim testli); kaydı açan uç kimliği `noteAuditResource` ile ekler. Denetim satırı yanıttan sonra yazıldığı için etkinlik bir anlık gecikebilir. Ödeme ve kurulum olayları C16 ve C10 ile katılır.
  - **Alan adları:** alt alan adı `<slug>.<PLATFORM_DOMAIN>` kayıtla açılır, doğrulanmış ve birincil; silinemez (`cp.domain_platform_kept`). Özel alan adı `pending` kaydedilir (doğrulama F16.7), bütün mağazalarda tekil (`cp.domain_taken`), platformun alanı altında olamaz. **Birincil yalnız doğrulanmış alan adı olur** (`cp.domain_unverified`: doğrulanmamış adres vitrinin bağlantılarını bozar, "bozuk müşteri çıktısı" sert engeli). Birincil özel alan adı silinince alt alan adı kendiliğinden birincil olur.
  - **Yetkililer:** telefon E.164'e çevrilir (Türkiye numaraları yazıldığı gibi; yabancı `+` ile). Birincil faturalama kişisi tektir (kısmi tekil dizin); yeni yetkili istenince alır, mağazanın ilk yetkilisi kendiliğinden alır, silinen birincilin yerine en eski faturalama yetkilisi geçer. Yetkili **kalıcı silinir** (yumuşak silme yok). Kişisel veri tutan iş akışları `store: false`; yürütme kaydı yok (testli).
  - **Paket arşivi uyarıdır, engel değil:** kullanımdaki paket arşivlenebilir; mağazaları onu ve limitlerini korur, yeni mağazaya verilmez (`cp.package_archived`), panel arşivlemeden önce kaç mağazada olduğunu söyler. Paket kodu değişmez (belge onu taşır). Fiyat kuruş, tam sayı; bir sonraki dönemden geçerli (§7).
  - **İstisna:** anahtar başına bir tane, gerekçe zorunlu (3–500), isteğe bağlı bitiş geçmiş olamaz (`cp.override_expired`). Uygulanan değer: süresi dolmamış istisna, yoksa paket; paketsiz mağazada limit yok (mağazanın yönetimsiz kipiyle aynı).
  - **Yeni env:** `CP_MASTER_KEY` (C8'den önce geldi, C8 aynı anahtarı kullanır; virgülle liste, yeni başta; diğer anahtarlardan farklı olmalı) ve `PLATFORM_DOMAIN` (geliştirmede `localhost`; tarayıcı `*.localhost`'u kendisi çözer; canlıda `localhost` reddedilir). `pnpm env:init` ikisini mevcut dosyalara ekler.
- **Uygulama notları:** MikroORM birim-iş akışı ekleri güncellemelerden önce yazar; aynı işlemde bir satırın birincil işaretini kaldırıp diğerine vermek için ara `flush` gerekir (`service.ts`). Medusa test koşucusu her testten önce veritabanını ilk `beforeEach` anının kopyasına döndürür: iç `describe`'ın `beforeAll`'da açtığı kayıt sonraki testte yoktur, `beforeEach` kullanılır.
- **Geliştirme tohumu:** `pnpm --filter control-plane cp:seed-dev` (yalnız yerel, tekrar çalıştırmak etkisiz): Başlangıç (490 TL/ay) ve Profesyonel (1.490 TL/ay) paketleri; My L'arte (`mylarte`, Profesyonel, `active`, `mylarte.com` doğrulama bekliyor, firma ve yetkililer boş, sabit not), Ege Zeytin Atölyesi (`active`) ve Kahve Durağı (şahıs firması, `provisioning`).
