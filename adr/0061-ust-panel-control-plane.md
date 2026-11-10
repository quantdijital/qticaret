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
  - Belirteç AES-256-GCM ile mühürlüdür; anahtar `CP_HASH_KEY`'den HKDF ile türetilir (`qt.step_up.v1`). Bağ (kullanıcı, giriş kaydı, çerez oturumuysa oturum kimliği; bearer'da sabit `bearer`) ek veri olarak bağlanır: başka kişi ya da başka oturum için açılmaz (testli). Durumsuzdur: süresi içinde geri alınamaz; oturum kapanınca o oturuma bağlı belirteç işe yaramaz, pasifleştirilen kişi koruma katmanında zaten durur.
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
- **Kalan riskler:** (1) Henüz 2FA kurmamış hesabın şifresini bilen kişi kendi uygulamasını kaydedebilir (ilk kullanımda güven); davet edilen kişi hemen kurduğu için pencere kısa. (2) Yeniden doğrulama kanıtı 5 dakika boyunca geri alınamaz. (3) IP özeti anahtarı bilen için IPv4'te kaba kuvvetle çözülebilir: takma addır, anonim değil. (4) Bearer belirteci (yalnız testler ve betikler; panel çerez kullanır) pasifleştirmede iptal edilmez, koruma katmanı durdurur. (5) Belirteç yenilemesi (`/auth/token/refresh`) MFA işaretini taşımayabilir (adr/0040 §2): kişi yeniden girer, güvenlik açığı değil.
