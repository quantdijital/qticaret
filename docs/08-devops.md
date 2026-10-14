# 08 — DevOps

## Ortamlar
| Ortam | Amaç | Sağlayıcılar |
|---|---|---|
| local | Geliştirme | Mock + sandbox |
| staging | Entegrasyon/demo | Sandbox |
| prod | Tenant'lar | Canlı (tenant'ın kendi hesapları) |

## Local (docker compose)
Postgres, Redis, Mailpit, MinIO. `pnpm dev` backend'i host'ta çalıştırır (hızlı reload).

## Üretim imajı
- Multi-stage Dockerfile, `node:<LTS>-alpine` veya distroless, non-root kullanıcı
- Aynı imaj iki rolde: `MEDUSA_WORKER_MODE=server` ve `=worker`
- Admin build imaja dahil (veya ayrı statik barındırma — ADR ile karar)
- Health check endpoint'i; graceful shutdown (SIGTERM'de iş bitirme)

## Tenant provisioning (F11)
`infra/tenant/create-tenant <slug>`:
1. DB + kullanıcı oluştur (en az yetki)
2. Secret'ları secret store'a yaz (şablondan; sağlayıcı anahtarları boş/sandbox)
3. Migration çalıştır
4. Admin kullanıcı oluştur, seed (region, vergi, tr-address)
5. Server + worker servislerini başlat, domain/SSL bağla
6. Health check → başarılıysa tenant kaydını "aktif" yap
Script **idempotent** olmalı (yarıda kalırsa tekrar çalıştırılabilir).

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
