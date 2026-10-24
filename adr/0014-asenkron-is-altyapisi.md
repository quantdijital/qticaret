# ADR-0014: Asenkron iş altyapısı (iş kaydı, ilerleme, sonuç dosyası)

- **Durum:** Önerildi (F2 S13'te karara bağlanacak)
- **Tarih:** 2026-10-24

## Bağlam
Uzun süren işler (içe aktarma F3.9, rapor F11.1, feed F10, SEO denetimi F3.14, sitemap F3.6) request yolunda çalışamaz. docs/05 bunların worker'da çalışmasını ister.
Admin tarafında her iş için şunlar görünmeli: durum, ilerleme, satır bazlı hata raporu ve indirilebilir sonuç dosyası.

Medusa 2.21.2'de doğrulananlar (F2 planlaması):
- **Genel iş soyutlaması yok.** Ürün dışa aktarma şu deseni kullanır: `async: true` + `backgroundExecution: true` step, `fileModule.getUploadStream` ile private CSV, bitince `feed` kanalına bildirim. İlerleme yüzdesi yoktur.
- **Background step:** Gövdesi `run()`'ı çağıran süreçte çalışır; Redis workflow engine'de de böyledir. Route'tan doğrudan başlatılan bir iş **server** sürecinde koşar.
- **Worker modu:** Subscriber'lar her modda yüklenir. Redis event bus'ta BullMQ worker'ı yalnızca server olmayan süreçte çalışır. Local event bus süreç içidir ve retry yapmaz.
- **In-memory workflow engine:** Retry ve timeout zamanlayıcıları restart'ta kaybolur. Biten execution kayıtları `retentionTime` verilmezse silinir.
- **File modülü:**
  - Tek provider çalışır.
  - `createFiles` içeriği string (base64) olarak alır. Büyük dosya için `getUploadStream` kullanılır.
  - `access` verilmezse dosya private olur. Kısa ömürlü URL `retrieveFile().url` ile alınır (s3'te presigned, `download_file_duration`).
  - `file-local` imzasız ve herkese açıktır; yalnızca geliştirme içindir.
- **Scheduled job'lar:** In-memory engine'de her instance'ta ayrı çalışır. Redis engine'de BullMQ `repeat` ile çalışır.

## Karar
- **Modül:** `async-job` modülü, `async_job` tablosu.
  - Kimlik ve durum: `type`, `status` (`queued` | `running` | `succeeded` | `failed` | `cancelled`), `attempt`
  - İlerleme: `progress` (0–100), `progress_key` (i18n), `heartbeat_at`
  - Girdi: `input` (jsonb; kişisel veri ve secret yok, yalnızca filtre ve kimlik)
  - Sonuç: `result_file_id`, `result_summary` (sayımlar), `error_code`
  - Zaman: `requested_by`, `started_at`, `finished_at`, `expires_at`
- **İş tipi kayıt defteri kodda:** Her tip şunları tanımlar:
  - çalıştıracağı workflow
  - girdi için Zod şeması
  - gerekli özellik bayrağı (adr/0012)
  - aynı anda tek çalışma (locking modülü)
  - sonuç saklama süresi
  - sonuç kişisel veri içeriyor mu (indirmede okuma kaydı, adr/0011)
- **Akış:**
  1. Admin route → `async-job-enqueue` workflow'u: doğrular, `queued` kaydını açar, `async-job.queued` event'ini yayar.
  2. Subscriber (prod'da worker süreci) tipin workflow'unu başlatır.
  3. Step'ler ilerlemeyi ve heartbeat'i en çok saniyede bir yazar.
  4. Sonuç `getUploadStream` ile **private** dosyaya yazılır.
  5. Bitişte durum güncellenir ve Medusa'nın `feed` bildirimi gönderilir.
- **Kurtarma:** Zamanlanmış bir süpürücü, heartbeat'i 10 dakikadan eski `running` işleri `failed` (`interrupted`) yapar. İşler idempotent yazılır; yeniden deneme yeni `attempt` olarak aynı kaydı kullanır.
- **İndirme:** `GET /admin/async-jobs/:id/result`
  - Önce yetki kontrol edilir; F12 rolleri gelene kadar admin oturumu yeterlidir.
  - Kişisel veri içeren tiplerde okuma kaydı yazılır.
  - Kısa ömürlü URL döner (5 dk). URL loglanmaz.
- **Saklama:** Sonuç dosyaları 7 gün sonra, iş kayıtları 90 gün sonra zamanlanmış job ile silinir.
- **Dosya provider'ı:** file-s3 bağlantısı F3.3'ten bu oturuma çekilir.
  - Dev'de SeaweedFS (adr/0006) kullanılır. Test ve CI'da yalnızca `NODE_ENV` development/test iken `file-local` kullanılır.
  - Env şeması staging/production'da `S3_*` değişkenlerini zorunlu tutar.
- **Admin ekranı:** "İşler" listesi (tip, durum, ilerleme, süre), çalışan işlerde kısa aralıklı yenileme, sonuç indirme ve hata durumu.
- **İlk iş tipi:** Denetim kaydı CSV dışa aktarma (adr/0011). Kişisel veri içeren bir dışa aktarma olduğu için okuma kaydını, CSV kaçışlamayı (F2.9) ve private dosyayı birlikte sınar.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **İş kaydı modülü + event → subscriber → workflow** | Tenant'a anlamlı durum/ilerleme; worker'da çalışır; Medusa desenleriyle | Ek tablo; kurtarma kendi işimiz |
| Yalnız Medusa `workflow_execution` | Ek tablo yok | İç şema; ilerleme yok; retention ile silinir; tenant'a gösterilemez |
| Route'tan background step | Medusa'nın dışa aktarma deseni | Server sürecinde koşar (docs/05'e aykırı) |
| Doğrudan BullMQ | Olgun kuyruk | Medusa dışı ikinci altyapı; workflow/compensation dışında kalır |

## Sonuçlar
- **Prod gereksinimi:** Gerçek server/worker ayrımı, restart sonrası devam ve tek instance'ta çalışan zamanlanmış işler için Redis event bus, Redis workflow engine ve Redis locking modülleri gerekir. Bunlar F16'da bağlanır; F2'de dev/test in-memory çalışır. PROGRESS'te takip edilir.
- **Yeniden kullanım:** F3.9 içe aktarma, F3.14 SEO denetimi, F3.6 sitemap ve F11.1 raporlar bu deseni kullanır. Satır bazlı hatalar ikinci bir CSV dosyası olarak sonuçta yer alır.
- **Medusa'nın yerleşik ürün içe/dışa aktarması:** Ayrı kalır. F3.9'da bu desene sarılıp sarılmayacağı değerlendirilir.
