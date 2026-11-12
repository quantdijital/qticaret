# 08 — DevOps

## Ortamlar
| Ortam | Amaç | Sağlayıcılar |
|---|---|---|
| local | Geliştirme | Mock + sandbox |
| staging | Entegrasyon/demo | Sandbox |
| prod | Tenant'lar | Canlı (tenant'ın kendi hesapları) |

## Local (docker compose)
Postgres, Redis, Mailpit (e-posta yakalama), SeaweedFS (S3; MinIO arşivlendi, adr/0006). `pnpm dev` backend'i host'ta çalıştırır (hızlı reload).

## Üretim imajı
- Multi-stage Dockerfile, `node:<LTS>-alpine` veya distroless, non-root kullanıcı
- Aynı imaj iki rolde: `MEDUSA_WORKER_MODE=server` ve `=worker`
- Admin build imaja dahil (veya ayrı statik barındırma — ADR ile karar)
- Health check endpoint'i; graceful shutdown (SIGTERM'de iş bitirme)
- DB ve Redis bağlantıları TLS + auth; yalnızca iç ağdan erişim (docs/04)
- Staging/önizleme: `X-Robots-Tag: noindex` + basic auth; F16.13 otomatik kontrol

## Tenant provisioning (F16)
`infra/tenant/create-tenant <slug>`:
1. DB + kullanıcı oluştur (en az yetki)
2. Secret'ları secret store'a yaz (şablondan; sağlayıcı anahtarları boş/sandbox)
3. Migration çalıştır
4. Admin kullanıcı oluştur, seed (region, vergi, tr-address)
5. Server + worker servislerini başlat, domain/SSL bağla
6. Health check → başarılıysa tenant kaydını "aktif" yap
Script **idempotent** olmalı (yarıda kalırsa tekrar çalıştırılabilir).

**Güncel (adr/0061 §6, Ek C10):** ayrı betik yazılmaz; adımlar üst panelin `provisioning` workflow'undadır, ortama özgü iş `TenantProvisioner`'dadır. Yerelde (`CP_PROVISIONER=local`, yalnız `development`):

1. `pnpm turbo run build --filter=@qticaret/backend` (önce `@qticaret/server-kit` ve `@qticaret/types` derlenir; mağaza `.medusa/server`'dan `--conditions=qt-compiled` ile koşar).
2. `pnpm dev:cp-api` (üst panel 9100; mağazanın 15 dakikalık çekmesi buraya gelir).
3. `NODE_ENV=development pnpm --filter control-plane cp:tenant-create slug=<slug> name=<ad> owner-email=<adres> package=<kod>`: kayıt, sahip yetkilisi, sonra adımlar (port 9200–9299, sırlar + emanet, `qt_tenant_<slug>` veritabanı ve rolü, migration, `tenant:bootstrap`, ilk plan belgesi, başlatma, sağlık, itme adresi, sahip daveti Mailpit'e, `active`). İkinci çalıştırma hiçbir şeyi değiştirmez; hata olursa çalışmanın yarattığı her şey geri alınır.
4. `pnpm --filter control-plane cp:tenant status|stop|start|invite|retry <slug>`. Mağazanın dosyaları `infra/tenants/local/<slug>/` (git dışı; klasör 0700, `.env` 0600, `logs/` 5 MB'ta döner, `server/static`).
5. **Mağazanın paneli ve sahip daveti:** her yerel mağazanın paneli kendi portunun 1000 fazlasındadır (mağaza 9200 → panel 10200). Davet e-postasındaki bağlantı oraya gider; açmak için `PANEL_PORT=10200 PANEL_BACKEND_URL=http://localhost:9200 pnpm --filter panel dev`. 5173'teki geliştirme paneli ana mağazaya bağlıdır, daveti kabul edemez.
6. Elle temizlik (yalnız denemede): `cp:tenant stop <slug>`, sonra Postgres'te `DROP DATABASE qt_tenant_<slug> WITH (FORCE); DROP ROLE qt_tenant_<slug>;` ve klasörün silinmesi. Üst paneldeki kayıt kalır (geçmiş). Mağazanın veritabanı ve rolü yorumunda mağaza kimliğini taşır (`COMMENT ON DATABASE`); provisioner başka mağazanınkine ya da işaretsizine dokunmaz.

F16'da aynı workflow `DockerProvisioner` ile çalışır; imaj `NODE_OPTIONS=--conditions=qt-compiled` taşır, `ts-node` gerekmez.

## Tenant işletimi (F16)
- **Hosting ve bölge:** adr/0003 (KVKK veri yerleşimi dahil)
- **Alan adı:** varsayılan `<slug>.<platform-domain>`; tenant domain'i DNS TXT sahiplik doğrulamasıyla bağlanır, otomatik SSL; bağlanınca platform alt alan adı 301 (SEO + güvenlik)
- **Kapatma sonrası:** DNS/sertifika kayıtları temizlenir, alt alan adı devralma (subdomain takeover) kontrolü
- **SEO dosyaları:** sitemap/robots worker'da üretilir, S3'ten storefront proxy'ler; CDN cache kısa TTL
- **E-posta:** her tenant'a ayrı Resend hesabı (takımı), anahtarı ve web kancası sırrı; anahtar tenant'lar arasında paylaşılmaz (adr/0036 ek). Varsayılan gönderici `<slug>.bildirim.<platform-domain>`, kurulumda o hesapta doğrulanır; tenant kendi alan adını panelden SPF/DKIM/DMARC ile doğrular (F9.6). Kapatmada hesabın anahtarı iptal edilir.
  - **Kendi SMTP sunucusu (adr/0036 Ek 2026-11-10):** tenant panelden (Ayarlar > E-posta ve SMS > E-posta > E-posta gönderimi) kendi sunucusunu kaydederse bütün e-postalar oradan gider ve Resend hesabı gerekmez; kayıt yoksa davranış yukarıdaki gibidir. Ortam değişkeni yok, sağlayıcı hesabı anahtarı (`CREDENTIALS_ENCRYPTION_KEYS` ya da `CREDENTIALS_ENCRYPTION_KEY`) yeter. Sunucuya giden bağlantı: 465 (SSL/TLS) ya da 587 (STARTTLS) açık olmalı; şifrelemesiz yalnızca loopback'e (aynı makinedeki Postfix). Backend Docker'daysa konteynerin `127.0.0.1`'i ana makine değildir: sunucunun genel adı (`mail.<alan-adı>`, sertifikadaki ad) 587/STARTTLS ve girişle kullanılır; `network_mode: host` ile `localhost` ikinci yoldur. SSRF kuralı (docs/04): ad genel DNS'ten çözülür ve her adresi genel olmalıdır; `host.docker.internal`, köprü adresi (172.17.0.1), özel ağ adresleri ve DNS'ten 127.x dönen adlar reddedilir (`/etc/hosts` okunmaz). Ad genel IP'ye çıkıyorsa aynı VPS'teki Postfix'e konteynerden bu yolla ulaşılır (genel IP makinenin kendi arayüzündedir). Portlar yalnızca 25, 465, 587, 2525. Geliştirmede Mailpit'in SMTP'si `127.0.0.1:51025` (şifrelemesiz) panelden bağlanabilir. Alan adının SPF/DKIM/DMARC kayıtları sunucu panelinden (aaPanel Mail Server) DNS'e eklenir; panel eksikleri yalnızca uyarı olarak gösterir.
- **Sağlayıcı hesabı anahtarının döndürülmesi (adr/0061 §4.4, Ek C17 ve güvenlik incelemesi):** mağazanın PayTR, iyzico, kargo, e-fatura, SMS hesapları kayıt başına veri anahtarıyla şifreli; veri anahtarları KEK ile sarılı. KEK env'de: `CREDENTIALS_ENCRYPTION_KEYS` (64 hex anahtarlar, virgülle, **en yeni başta**, en çok 5) ya da tek anahtarlı `CREDENTIALS_ENCRYPTION_KEY` (C17'den önceki her mağaza ve geliştirme `.env`'i; tek başına bir anahtarlık listedir, bir şey değiştirmek gerekmez). İkisi birlikte tanımlıysa tek anahtar listede olmalı, yoksa açılış durur. Anahtar kimliği anahtarın parmak izidir (`kekFingerprint`, 16 hex); yanına ad yazılmaz. Durum ve yeniden sarma: `pnpm --filter @qticaret/backend credentials:keys status|rewrap` (yalnız parmak izi ve sayı basar; `status` taşınacak ya da açılamayan kayıt varken 1 ile çıkar).
  - **Saatlik iş** (`integration-credentials-rewrap`, :23) yalnız C17 öncesi biçimdeki kayıtları zarfa çevirir; **KEK'ler arasında hiçbir kaydı taşımaz** (eski ayarla kalmış bir süreç kayıtları çıkarılmak üzere olan anahtara geri sarardı). Her saat söyler: anahtarı yapılandırılmamış kayıtlar `integration_credentials.kek_missing` (hata), sürecin başa koymadığı yapılandırılmış KEK'teki kayıtlar `integration_credentials.kek_order_conflict` (uyarı; döndürme yeniden sarma bekliyor ya da o sürecin ayarı geride). İkisi de yalnız parmak izi ve sayı taşır.
  - **Dağıtım kapısı (zorunlu):** anahtar listesini **küçülten** her dağıtımdan önce (anahtar çıkarma, tek anahtara dönme) mağazada `credentials:keys status` çalışır ve **0 ile çıkmalıdır**; 1 ise dağıtım durur. F16'nın dağıtım hattı bunu otomatik kapı olarak uygular.
  - **Emanet neyi kapsar:** `secret_escrow`, mağazanın kurulumda üretilen çalışma sırlarının (veritabanı şifresi, `JWT_SECRET`, `COOKIE_SECRET`, PII anahtarları, `CREDENTIALS_ENCRYPTION_KEYS`, `AUTH_MFA_ENCRYPTION_KEY`, `STOREFRONT_IP_SECRET`, `TENANT_SIGNING_KEY`) çevrimdışı `age` alıcılarına mühürlü kopyasıdır. Kurulumdan sonra döndürülen bir sır emanete kendiliğinden girmez; aşağıdaki 5. adım bunu yapar.
  - **Kesintisiz döndürme:**
  1. Yeni anahtar: `openssl rand -hex 32`, doğrudan sır deposuna (loga, sohbete, bilete yazılmaz).
  2. **Önce tanıt:** `CREDENTIALS_ENCRYPTION_KEYS=<eski>,<yeni>` (yeni **sonda**) → dağıt. Sunucu ve worker yeni anahtarı açabilir hâle gelir, yeni kayıtlar hâlâ eskiyle sarılır. (Tek süreçli mağazada bu adım atlanabilir.) `status` yeni anahtarı "holds nothing" gösterir; bu adımda beklenen budur.
  3. **Geç:** `CREDENTIALS_ENCRYPTION_KEYS=<yeni>,<eski>` → dağıt, **bütün süreçler** (sunucu ve worker) yeni ayarla çalışana dek bekle. Yeni kayıtlar yeniyle sarılır; mevcut kayıtlar yeniden sarmayı bekler (saatlik iş bu arada `kek_order_conflict` yazar, bu beklenir). Kayan yeniden başlatmada henüz eski ayarlı süreç de yeniyle sarılmışı açar (2. adım sayesinde). Eski tek anahtarlı `CREDENTIALS_ENCRYPTION_KEY` silinir ya da listede kalır.
  4. **Yeniden sar:** güncel ayarla çalışan bir süreçten `credentials:keys rewrap` (saatlik iş bunu yapmaz). Yalnız veri anahtarları yeniden sarılır, veri yeniden şifrelenmez; C17 öncesi biçimdeki kayıtlar zarfa geçer. Satır başına karşılaştır-ve-değiştir: aynı anda yapılan kayıt ezilmez, iki çalışma zararsızdır, yarım kalan çalışma geçerli bir durumdur.
  5. **Emanet:** yeni anahtar listesini emanete al: mağazanın güncel çalışma sırlarını (yeni `CREDENTIALS_ENCRYPTION_KEYS` dahil) `qt-runtime-secrets-v1` biçiminde, `infra/backup`'ın `recipients.txt`'indeki alıcılara `age -R recipients.txt -a` ile mühürle ve mağazanın yedekleriyle birlikte sakla. Bugün elle yapılır: üst panel mağazanın sırlarını tutmadığı için sırları yeniden emanete alan bir komutu yok. **F16:** `DockerProvisioner` mağazanın sır deposunu okuyup yeni bir `secret_escrow` sürümü yazan bir kurulum komutu (`cp:tenant re-escrow <slug>`) ekler; o gelince bu adım onu çalıştırır. Eski anahtar emanet yenilenmeden çıkarılmaz.
  6. **Denetle ve bekle:** `credentials:keys status` 0 ile çıkmalı ve eski anahtarı "holds nothing: it may be removed" diye göstermeli. `status` yalnız kayıtlı satırları görür; yarıda kalmış bir kayıt ya da geri alma (telafi) eski kopyayı geri yazabilir. Bu yüzden birkaç dakika bekle ve `status`'u yeniden çalıştır; ikinci çalıştırma da 0 olmalı. (Telafi eski kopyayı güncel KEK'le sararak geri yazar, ama çalışmakta olan bir işlem eski ayarlı süreçteyse bekleme bunu da kapsar.)
  7. **Çıkar:** dağıtım kapısından geç (`status` 0), sonra `CREDENTIALS_ENCRYPTION_KEYS=<yeni>` → dağıt. Eski anahtar sır deposunda bir süre saklanır (yedekten geri dönüş için: eski yedekteki kayıtlar onunla sarılıdır), sonra imha edilir.
  - **Erken çıkarıldıysa:** kayıtlar açılmaz (panelde "yeniden girilmeli", ödeme sağlayıcısı "yapılandırılmamış"), `status` 1 ile çıkar ve anahtarı `missing` gösterir, iş her saat hata loglar. Açılış durdurulmaz (anahtarı geri getirmez). Düzeltme: anahtarı güncelin arkasına geri koy, dağıt, `rewrap`.
  - **Yedekten geri yükleme:** veritabanı yedeği hangi KEK'lerle sarıldıysa onlar env'de olmalı; `status` geri yüklemeden sonra çalıştırılır.
  - **C17'ye ilk yükseltme (F16):** C17 öncesi sürüm zarf biçimini okuyamaz; yeni sürüm okuduğu eski kaydı zarfa çevirir. Bu yüzden C17'yi içeren ilk yayında mağazanın sunucu ve worker'ı kayan değil, birlikte yeniden başlatılır.
  - Yeni mağazalar (üst panelin provisioner'ı) tek anahtarlı liste alır: `CREDENTIALS_ENCRYPTION_KEYS=<anahtar>`; emanet kopyası (`secret_escrow`) bu adı taşır.
- **Destek erişimi:** süreli, gerekçeli, audit log'lu; tenant'a bildirim
- **Kapatma:** veri dışa aktarma paketi → saklama süresi → silme, secret iptali, DNS temizliği
- **Maliyet:** tenant başına kaynak/maliyet raporu; boşta tenant optimizasyonu ayrı ADR

## Sürüm yayma
- Migration'lar geri uyumlu (expand → migrate → contract).
- Önce canary tenant (kendi demo mağazamız), sonra dalgalar halinde diğerleri.
- Geri alma: önceki imaj + migration'lar geri uyumlu olduğu için güvenli.

## Gözlemlenebilirlik
- Log: pino JSON, tenant slug + korelasyon ID her satırda, redaksiyon aktif
- Trace: OpenTelemetry (`apps/backend/instrumentation.ts`, toplu gönderim) → Türkiye'de OTLP toplayıcı ve Grafana Tempo/Jaeger (ADR-0045). `OTEL_EXPORTER_OTLP_ENDPOINT` verilmezse kapalı; canlıda örnekleme `OTEL_TRACES_SAMPLER=parentbased_traceidratio`, `OTEL_TRACES_SAMPLER_ARG=0.1`
- Hata: GlitchTip, Türkiye'de kendi sunucumuzda (ADR-0045). Logger'ın error satırları redakte edilmiş hâliyle gider (`ERROR_TRACKING_DSN`); olayda mağazanın alan adı ve `RELEASE`
- Yavaş sorgu: Postgres `pg_stat_statements` (sorgunun biçimi, değerler `$n` olarak). ORM değerleri SQL metnine gömdüğü için sorgu metni loglanmaz (`log_min_duration_statement` kullanılmaz, `log_min_error_statement=panic`). İzler dışa aktarılırken SQL değişmezlerinden ve kişisel veriden arındırılır (`lib/observability/scrub.ts`)
- Uyarılar: ödeme başarısızlık oranı artışı, webhook hata oranı, kuyruk birikmesi, fatura dead-letter

## Yedekleme
- Postgres: günlük tam + WAL/PITR, şifreli, farklı bölge
- Obje depolama: versiyonlama
- Aylık geri yükleme provası
- Betikler ve anahtar yönetimi: `infra/backup/` (`age` ile şifreli döküm, manifestle doğrulanan geri yükleme), `docs/runbooks/yedek-ve-geri-yukleme.md`. İlk prova 2026-10-31 (`docs/runbooks/tatbikatlar/2026-10-31-yedek-geri-yukleme.md`).
