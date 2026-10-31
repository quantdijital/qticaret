# ADR-0045: Gözlemlenebilirlik: OpenTelemetry izleri, GlitchTip ve yavaş sorgu logu

- **Durum:** Kabul edildi (2026-10-31; kullanıcı "OTel + GlitchTip, Türkiye'de" seçeneğini onayladı)
- **Tarih:** 2026-10-31
- **İlgili:** F15.4; ADR-0003 (barındırma, veri Türkiye'de); docs/04 (redaksiyon); docs/08 "Gözlemlenebilirlik"; docs/kvkk-envanter

## Bağlam

Loglar pino ile JSON satırlarına yazılıyor ve redakte ediliyor (F2). Eksik olanlar şunlardı:
- bir isteğin hangi adımda zaman harcadığını gösteren izler;
- hataları gruplayıp uyaran bir hata izleme aracı;
- yavaş sorguların kaydı.

Kişisel veri Türkiye'de kalacak (ADR-0003). Bu yüzden Sentry'nin bulut hizmeti yerine kendi barındırdığımız araçlar seçildi.

## Karar

1. **İzler: Medusa'nın OpenTelemetry kancası** (`apps/backend/instrumentation.ts`, `registerOtel`).
   - Yalnızca `OTEL_EXPORTER_OTLP_ENDPOINT` verilince açılır; geliştirme ve testte iz yoktur.
   - İzler OTLP/HTTP ile Türkiye'deki toplayıcıya gider. Toplayıcı ve arayüz (Grafana Tempo ya da Jaeger) F16'da sunucuyla kurulur.
   - İzlenenler: HTTP, iş akışları, Query, veritabanı ve önbellek.
   - Örnekleme OpenTelemetry'nin kendi değişkenleriyle yapılır: canlıda `OTEL_TRACES_SAMPLER=parentbased_traceidratio`, `OTEL_TRACES_SAMPLER_ARG=0.1`.
   - **Span'ler toplu gönderilir** (`BatchSpanProcessor`). Yalnızca dışa aktarıcı verildiğinde her span ayrı istekle gidiyordu: bir mağaza isteği yaklaşık 50 dışa aktarım demekti (yerelde ölçüldü). Toplu gönderimle 3 isteğin 208 span'i tek pakette gitti.
   - Yeni bağımlılıklar `@opentelemetry/exporter-trace-otlp-http@0.220.0` ve `@opentelemetry/sdk-trace-base@2.9.0`. İkisi de Medusa'nın `sdk-node` 0.220.0'ının kullandığı sürüm; kilit dosyasında zaten vardı.
2. **Hatalar: GlitchTip** (Sentry protokolüyle uyumlu, kendi sunucumuzda, Türkiye'de).
   - **SDK yok.** Logger'ın ikinci hedefi error seviyesindeki satırları GlitchTip'e gönderir (`lib/error-tracking`, `ERROR_TRACKING_DSN`).
   - Gerekçe 1: GlitchTip'e giden veri log satırıyla aynı redaksiyondan geçmiş olur.
   - Gerekçe 2: `@sentry/node` kendi OpenTelemetry kurulumunu yapıyor ve Medusa'nınkiyle çakışıyor. Ayrıca onlarca paket getiriyor.
   - Gönderim Sentry'nin envelope biçimiyle `/api/<proje>/envelope/` adresine yapılır.
   - Olaya yalnızca şunlar girer: olay adı, hatanın türü, mesajı ve kareleri, istek kimliği, metot, yol ve durum. Satırın diğer alanları logda kalır.
   - Aynı yerdeki aynı hata dakikada bir kez gönderilir. En çok 20 gönderim bekler, gönderim en çok 3 saniye sürer ve yeniden denenmez.
   - GlitchTip'e ulaşılamazsa dakikada bir uyarı loglanır. Uyarı error seviyesinin altında olduğu için GlitchTip'e gitmeye çalışmaz.
   - Olaylarda `server_name` mağazanın backend alan adı, `release` ise `RELEASE` değişkenidir. Tek bir GlitchTip projesi bütün mağazaları tutabilir.
3. **Yavaş sorgular: Postgres'in kendisi.**
   - **Düzeltme (F15 güvenlik incelemesi, 2026-10-31):** ilk sürüm `log_min_duration_statement` ile sorgu metnini logluyordu ve "bağ parametreleri yazılmaz" diyordu. ORM (MikroORM) değerleri SQL metnine gömüyor: bağ parametresi yok. Bir müşteri girişinde aranan e-posta izde değişmez olarak görüldü.
   - Bu yüzden yavaş sorgular `pg_stat_statements` ile izlenir: sorgunun biçimi, değerleri `$n` olarak. Sorgu metni loglanmaz; hata anında da (`log_min_error_statement=panic`).
   - Geliştirmede `compose.dev.yml`'de. Canlıda yönetilen Postgres'in parametreleri olarak F16'da.
   - İzler `ScrubbingExporter`'dan geçer (`lib/observability/scrub.ts`): SQL'deki değişmezler `?` olur; span adları, rotalar, adresler ve hata mesajları log redaksiyonundan geçer; feed adresindeki token çıkar. Aynı deneme sonrasında izde e-posta yok.
   - Canlıda OTLP adresi https olmalı, toplayıcı aynı makinede değilse (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` dahil).

## Doğrulama (yerelde, 2026-10-31)

- **Sahte OTLP toplayıcı:** izler `/v1/traces`'e JSON olarak geldi. Toplu gönderimden sonra 3 isteğin 208 span'i tek pakette; izlerde e-posta yok.
- **Sahte GlitchTip:** `medusa exec` ile loglanan bir hata envelope olarak, kimlik doğrulama başlığı ve 3 kareyle ulaştı.
  - Mesajdaki e-postanın yerel kısmı maskelenmişti (`[REDACTED]@example.com`, logdakiyle aynı).
  - Satırdaki `email` alanı olaya hiç girmedi.
- **Birim testleri:** `lib/error-tracking/__tests__` (12) ve `env.unit.spec.ts`. Bunlar DSN okumayı, kareleri, seviye süzgecini, dakikalık tekrar sınırını, kuyruk sınırını ve kendi olaylarını göndermemeyi kapsıyor.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kendi gönderimimiz + GlitchTip (seçilen)** | Redaksiyon logla aynı, Medusa'nın OTel'iyle çakışma yok, bağımlılık yok | Kaynak bağlamı ve "breadcrumb" yok |
| `@sentry/node` + GlitchTip | Hazır SDK, zengin bağlam | Kendi OTel kurulumu Medusa'nınkiyle çakışır; çok paket; isteğin gövdesini ve başlıklarını yakalamaması ayrıca ayarlanmalı |
| Sentry bulut | Kurulum yok | Veri AB'de (ADR-0003 ile çelişir) |

## Sonuçlar

- **F16'da kurulacaklar:**
  - Türkiye'de GlitchTip (Postgres + Redis + web + worker);
  - OTLP toplayıcı ve Tempo/Jaeger;
  - yönetilen Postgres'in yavaş sorgu parametreleri;
  - uyarılar: ödeme hata oranı, webhook hataları, kuyruk birikmesi, fatura dead-letter.
- **Saklama önerisi:** GlitchTip olayları 30 gün, izler 7 gün (docs/kvkk-envanter).
- **Kapsam dışı (sonraki aşama):** panelin (tarayıcı) hataları GlitchTip'e gitmiyor.
