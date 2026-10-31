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

## Tenant işletimi (F16)
- **Hosting ve bölge:** adr/0003 (KVKK veri yerleşimi dahil)
- **Alan adı:** varsayılan `<slug>.<platform-domain>`; tenant domain'i DNS TXT sahiplik doğrulamasıyla bağlanır, otomatik SSL; bağlanınca platform alt alan adı 301 (SEO + güvenlik)
- **Kapatma sonrası:** DNS/sertifika kayıtları temizlenir, alt alan adı devralma (subdomain takeover) kontrolü
- **SEO dosyaları:** sitemap/robots worker'da üretilir, S3'ten storefront proxy'ler; CDN cache kısa TTL
- **E-posta:** her tenant'a ayrı Resend hesabı (takımı), anahtarı ve web kancası sırrı; anahtar tenant'lar arasında paylaşılmaz (adr/0036 ek). Varsayılan gönderici `<slug>.bildirim.<platform-domain>`, kurulumda o hesapta doğrulanır; tenant kendi alan adını panelden SPF/DKIM/DMARC ile doğrular (F9.6). Kapatmada hesabın anahtarı iptal edilir.
- **Destek erişimi:** süreli, gerekçeli, audit log'lu; tenant'a bildirim
- **Kapatma:** veri dışa aktarma paketi → saklama süresi → silme, secret iptali, DNS temizliği
- **Maliyet:** tenant başına kaynak/maliyet raporu; boşta tenant optimizasyonu ayrı ADR

## Sürüm yayma
- Migration'lar geri uyumlu (expand → migrate → contract).
- Önce canary tenant (kendi demo mağazamız), sonra dalgalar halinde diğerleri.
- Geri alma: önceki imaj + migration'lar geri uyumlu olduğu için güvenli.

## Gözlemlenebilirlik
- Log: pino JSON, tenant slug + korelasyon ID her satırda, redaksiyon aktif
- Trace: OpenTelemetry → (Grafana Tempo / Honeycomb vb.)
- Hata: Sentry (tenant etiketiyle)
- Uyarılar: ödeme başarısızlık oranı artışı, webhook hata oranı, kuyruk birikmesi, fatura dead-letter

## Yedekleme
- Postgres: günlük tam + WAL/PITR, şifreli, farklı bölge
- Obje depolama: versiyonlama
- Aylık geri yükleme provası
- Betikler ve anahtar yönetimi: `infra/backup/` (`age` ile şifreli döküm, manifestle doğrulanan geri yükleme), `docs/runbooks/yedek-ve-geri-yukleme.md`. İlk prova 2026-10-31 (`docs/runbooks/tatbikatlar/2026-10-31-yedek-geri-yukleme.md`).
