# ADR-0069: Ürün videoları: yükleme, dönüştürme, depolama ve vitrinde gösterim

- **Durum:** Kabul (sahip, 2026-11-16). Yön sahibin kararıdır (aşağıda "Sahibin kararları"); bu belge onu ayrıntılandırır. Öneri sürümündeki açık soruların önerilen varsayılanları sahip tarafından onaylandı ("ürün videolarında önerdiğin şekilde iyi"); aşağıda "Kararlar (sahip, 2026-11-16)". Yalnız YouTube çerez metni (karar 7) avukat görene kadar yasal taslak olarak işaretli kalır.
- **Tarih:** 2026-11-16
- **İlgili:** adr/0003 (barındırma), adr/0006 (SeaweedFS), adr/0011 (denetim kaydı), adr/0012 (özellik bayrakları), adr/0014 (asenkron iş altyapısı), adr/0016 (görsel işleme hattı), adr/0020 (kilit sağlayıcısı), adr/0040 (roller), adr/0041 §5 (çerez onayı, yasal metinler), adr/0046 (vitrin ve tema sözleşmesi), adr/0061 §5 ve Ek C9, C14 (paket limitleri, platform bayrakları, depolama kotası), adr/0066 (tema katmanları), docs/04 (dosya yükleme, SSRF), docs/05 §8, docs/13 (JSON-LD, site haritası), docs/14 (danışman), docs/18 §7 (görsel için tek giriş), docs/21 (vitrin ölçümü), `docs/kvkk-envanter.md`, `docs/tema/bilesen-standardi.md` §7

## Bağlam

### Sahibin kararları (2026-11-16)

1. **Kısa ürün klipleri kendi depomuzda,** görsellerle aynı dosya deposunda. Yüklenen dosya olduğu gibi yayınlanmaz: arka plan işi web'e uygun hale getirir (720p, sessiz, MP4 + WebM) ve ilk karesinden kapak görseli çıkarır. Yükleme en çok **50 MB** ve **30 saniye**; ürün başına **1–2 video**. GIF yüklenirse aynı işten geçip videoya çevrilir. Paketin depolama kotasına sayılır.
2. **Vitrin:** video ekrana gelene kadar indirilmez, önce kapak görseli; otomatik oynayan, sessiz, döngülü; hareketi azaltma tercihinde ve veri tasarrufu modunda otomatik oynatma yok; erişilebilir oynat/durdur. Ürün sayfasının LCP/CLS değerleri bozulmaz.
3. **Uzun videolar YouTube bağlantısıyla;** vitrinde önce kapak, oynatıcı tıklanınca yüklenir (tıklamadan önce üçüncü taraf isteği ve çerezi yok; `youtube-nocookie`).
4. **Ücretli video servisleri (Bunny Stream, Cloudflare Stream, Mux) şimdilik yok;** depolama katmanı ileride eklenebilecek biçimde soyut kalır.
5. **Dönüştürme VPS'te sırayla, tek tek;** mağaza yavaşlamaz; panelde "işleniyor" durumu. Barındırma aaPanel VPS (adr/0061: 4 çekirdek, 15 GB RAM, Ubuntu 22.04; Docker F16'da), kendi depolama; ileride önüne CDN.

### Elimizde olan (kod, 2026-11-16 `dev`)

- **Yükleme kapısı:** `POST /admin/uploads` Medusa'nın çekirdek ucudur; multer dosyayı belleğe okur, sonra bizim `api/http/upload-validator.ts` her dosyayı baytlarından doğrular (`lib/security/upload/validate-upload.ts`, `image-header.ts`), `sanitizeImage` ile temizler (EXIF/GPS silinir, adr/0016 uygulama notu), adı ve MIME türünü içeriğe göre yeniden yazar. Sınırlar: dosya başına 10 MB, 40 MP, 10.000 px (`DEFAULT_UPLOAD_LIMITS`); istekte en çok 20 dosya. Genel `uploadSizeGate` (`api/http/request-limits.ts`) her `multipart/` isteği multer'dan önce `Content-Length`'e göre **25 MB**'ta keser (`MAX_UPLOAD_REQUEST_BYTES`); uzunluksuz (chunked) isteği reddeder.
- **GIF bugün neden reddediliyor:** tür beyaz listesi yalnız JPEG, PNG, WebP ve AVIF'tir (`image-header.ts`: "Only JPEG, PNG, WebP and AVIF are recognised; anything else … reads as null"). GIF imzası tanınmaz, `upload.unsupported_type` döner; panelde `IMAGE_ACCEPT` (`features/media/api/media.ts`) GIF'i hiç önermez, `media-page.spec.tsx` GIF'in "Bu dosya türü yüklenemez" ile reddini kilitler. Kodda GIF'e özel bir gerekçe yazılı değil; ret beyaz listenin sonucudur. (Çıkarım, doğrulanmadı: GIF beyaz listeye girseydi `sharp` varsayılan olarak yalnız ilk kareyi okuyacağından canlandırma sessizce düşerdi.)
- **Medya kaydı:** `modules/media` `MediaAsset` (`models/media-asset.ts`): dosya kimliği, kalıcı URL, boyut, ölçüler, alt metin, `derivatives` (WebP/AVIF `srcset` ve OG kırpması), `attached_at`, `in_library`. Ürüne bağ `links/product-media.ts` (`isList`). Akışlar `workflows/media/workflows.ts`: `registerMediaWorkflow`, `deriveProductMediaWorkflow` (ürün başına kilitli; `product.created/updated` aboneliği `subscribers/media-derive.ts`), `deriveLibraryMediaWorkflow` (`media.registered`, `subscribers/media-versions.ts`); türevler `lib/media/derive.ts` `deriveImages()`, saklama `workflows/media/files.ts` `storePublicFile()` (Medusa File Module `getUploadStream`, `access: "public"`). Gece/5 dakikalık süpürme `jobs/media-sweep.ts`. Store API alanları `api/http/media-routes.ts` `STORE_MEDIA_LEAVES` ile sınırlı (`*media_assets` reddedilir).
- **Kota:** `lib/plan-limits/check.ts` `assertStorageFits` (yüklemeden önce) ve `assertStorageWithinLimit`; ölçü `modules/media/service.ts` `storedBytes()`: yalnız `media_asset` satırlarının `size` toplamı (türevler sayılmaz). Yükleme kapısı `api/http/plan-limit-guards.ts` `guardUploadStorage`. Paket koruması `lib/plan-guard/rules.ts`: `/admin/products*`, `/admin/media*`, `/admin/uploads*` kısıtlı mağazada kapalı.
- **Dosya deposu:** `medusa-config.ts` S3 ayarı varsa `@medusajs/medusa/file-s3` (`forcePathStyle`, `download_file_duration: 300`), yoksa Medusa'nın yerel diski (yalnız geliştirme ve test). Kalıcı genel adres `S3_FILE_URL` + anahtar (`workflows/files/public-upload.ts`). Medusa 2.21.2 S3 sağlayıcısı her yüklemede `ContentType`'ı verilen MIME'dan ve `CacheControl`'ü `cache_control` seçeneğinden yazar (varsayılan `public, max-age=31536000`); anahtarın sonuna ULID ekler (node_modules'taki `file-s3` derlemesinde okundu). Ad değişmeyen dosya sonsuza dek önbelleklenebilir.
- **Range desteği:** dosyalar vitrine doğrudan depodan (`S3_FILE_URL`) gelir; S3 `GetObject` `Range` başlığını destekler ([AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/range-get-olap.html)); SeaweedFS S3 ağ geçidi de "range requests" destekler ([SeaweedFS wiki](https://github.com/chrislusf/seaweedfs/wiki/Amazon-S3-API)). Bizim kurulumumuzda 206 yanıtı **ölçülmedi** (dilim 2'nin kabul ölçütü). Safari videoyu yalnız `Range` destekli sunucudan oynatır.
- **Asenkron işler:** `modules/async-job` + `workflows/async-job/**` + `subscribers/async-job-queued.ts` (adr/0014): iş türleri `workflows/async-job/types/index.ts`, ilerleme kalp atışı, süpürücü `jobs/async-job-sweeper.ts`. `singleton` tür ikinci isteği **sıraya almaz, reddeder** (`async_job.already_running`); işler panelin iş listesinde görünür. Olay yolu bugün **yerel** (medusa-config'te Redis olay yolu yok, adr/0014: süreç içi, yeniden deneme yok); Redis olay yolu, iş motoru ve sunucu/işçi ayrımı F16'da. Kilitler bugün Redis'te (`lib/redis/locking.ts`, adr/0020; `acquireLockStep`).
- **Panel:** ürün sayfasında `features/products/detail/media-card.tsx` + `components/image-gallery.tsx` (en çok 20 görsel; tek giriş, docs/06 "Görseller", docs/18 §7); karede sürümlerin durumu zaten gösteriliyor (`versions: "pending" | "ready"`): "işleniyor" için emsal.
- **Vitrin:** `lib/views/image.ts` `productImages()` → `ProductPageView.images: ImageView[]` (`packages/ui/src/product-views.ts`); varyant görselleri `images` içindeki **sıra numaralarıyla** taşınır (`own`, `galleryVariantId`). Tema: `packages/themes/atolye/src/product/Gallery.tsx` (ilk görsel hevesli yüklenir: LCP; kaydırmalı kare ray; `prefers-reduced-motion` okunur), `Thumbs.tsx`, `Zoom.tsx`, `ProductPage.tsx`; hızlı bakış `frame/QuickViewGallery.tsx`.
- **CSP** (`apps/storefront/src/lib/security/csp.ts`): `img-src 'self' data: blob: https:`; **`media-src` yok**, yani `default-src 'self'`'e düşer: bugünkü haliyle depodan gelen `<video>` engellenir. `frame-src` yalnız ödeme formu kökenleri (yoksa `'none'`).
- **SEO:** ürün JSON-LD'si `lib/seo/jsonld-product.ts` (backend `workflows/seo/payload.ts`); görsel site haritası `lib/seo/sitemap.ts` (`image:image`). docs/13 §"site haritası" bugün "video varsa video sitemap" der; bu ADR bunu düzeltir (§9).
- **Bayraklar:** `modules/platform-settings/features.ts`; platform bayraklarının ortak listesi `packages/types/src/control-plane/platform-flags.ts` (adr/0061 Ek C9: bugün iş bayrağı yok, yalnız `test.platform_sample`).
- **Çerez onayı:** `modules/legal` `CookieConsent` (`analytics`, `marketing`).
- **ffmpeg:** depoda hiç yok (kod, belge, Docker).

### Medusa 2.21.2 (Context7 `/medusajs/medusa`, 2026-11-16)

- Ürün görseli `ProductImage`: `url`, `rank`, `metadata`, varyant ilişkisi (adr/0016 araştırması). Çekirdekte video türü yok; `images` ürün küçük resmi, sipariş satırı küçük resmi, akışlar ve Medusa'nın kendi uçlarınca **görsel** varsayılarak okunur.
- File Module: `createFiles`, `deleteFiles`, `getAsBuffer`, `getDownloadStream`, `getUploadStream({ filename, mimeType, access })` → `{ writeStream, promise, url, fileKey }`, `getUploadFileUrls` (sağlayıcı `getPresignedUploadUrl` uyguluyorsa ön imzalı yükleme). Dosya modülünün kendi veri modeli ve olayı yok.
- Modül bağı `defineLink(ProductModule.linkable.product, { linkable: …, isList: true })`; emsal `links/product-media.ts`.

### ffmpeg: kaynaklar

- **fluent-ffmpeg** 2025-05-22'de arşivlendi; README: "no longer maintained and no longer works properly with recent ffmpeg versions" ([GitHub](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)). Kullanılmaz.
- **ffmpeg-static** (npm): GPL-3.0; Linux ikilileri John Van Sickle derlemeleri; sabit sürüm 6.1.1 ([GitHub](https://github.com/eugeneware/ffmpeg-static)). Eski sürüm ve güncelleme temposu bizim elimizde değil; kullanılmaz.
- **Lisans** ([ffmpeg.org/legal](https://ffmpeg.org/legal.html)): FFmpeg varsayılan LGPL 2.1+; `--enable-gpl` ile GPL parçalar (ör. libx264) girerse "the GPL applies to all of FFmpeg". LGPL'de kalmanın şartı GPL kütüphane (libx264) kullanmamaktır.
- **Dağıtım paketi:** Alpine `community/ffmpeg` (edge, 9.0.2-r3) lisansı "GPL-2.0-or-later AND LGPL-2.1-or-later"; `ffmpeg-libavcodec` x264, x265, libvpx, aom, SVT-AV1 ve dav1d'ye bağlı ([pkgs.alpinelinux.org](https://pkgs.alpinelinux.org/package/edge/community/x86_64/ffmpeg-libavcodec)). Kararlı Alpine dalındaki sürüm farklı olabilir (doğrulanmadı).
- **Güvenilmeyen girdi:** HLS çalma listesi + `concat`/`subfile` ile yerel dosya okuma ve SSRF (CVE-2016-1897, CVE-2016-1898; [Black Hat 2016](https://www.blackhat.com/docs/us-16/materials/us-16-Ermishkin-Viral-Video-Exploiting-Ssrf-In-Video-Converters.pdf)); `.mp4` adlı dosya içerikten HLS diye okunabilir. Güncel örnek: yalnız `http(s)`'i süzen uygulamada `concat:`/`subfile:`/`file:` ile yerel dosya okuma ([elttam](https://elttam.com/blog/your-house-has-an-ffmpeg-problem)). Savunma: kesin `-protocol_whitelist`, girdinin biçimini ve yolunu kullanıcıya hiç seçtirmemek.

### SEO: kaynaklar

- Google `VideoObject`: zorunlu `name`, `thumbnailUrl`, `uploadDate`; önerilen `contentUrl` (ya da `embedUrl`), `description`, `duration` ([Google](https://developers.google.com/search/docs/appearance/structured-data/video)).
- 2023-12-04'ten beri Google video sonuçlarına yalnız videonun **ana içerik** olduğu sayfaları alır; örnek olarak "a product details page with a supporting video" sayılır, Search Console'da "Video is not the main content of the page" görünür ([Google Search Central blog](https://developers.google.com/search/blog/2023/12/video-is-the-main-content)).

## Karar

### 1. Veri modeli

- **Yeni model `MediaVideo`** (`media_video`, önek `mvid`) **mevcut `media` modülünde**; migration yalnız bu modülde. Ürüne bağ yeni `links/product-media-video.ts` (`isList`: ürün başına çok video, video başına bir ürün).
  - `kind`: `upload | youtube`
  - `status`: `uploaded | processing | ready | failed` (sahibin "yüklendi → işleniyor → hazır / başarısız" sırası). YouTube kaydı doğrudan `ready` açılır.
  - kaynak: `source_file_id` (**private**), `source_bytes`, `source_format` (`mp4 | mov | webm | gif`)
  - YouTube: `youtube_id` (yalnız 11 karakterlik kimlik; bağlantının kendisi saklanmaz)
  - `title` (boş olabilir; vitrinde erişilebilir ad ve JSON-LD `name`, boşsa ürün adı)
  - `position` (galerideki yeri; §2), `width`, `height`, `duration_ms`
  - çıktılar: `outputs` (`{ mp4: { url, bytes }, webm: { url, bytes } }`), `output_file_ids`
  - kapak: `poster` (`{ url, width, height, derivatives }`, `derivatives` görsellerin `MediaDerivatives` biçiminde), `poster_file_ids`
  - `stored_bytes` (o an depoda tuttuğu bütün dosyalar: kaynak + çıktılar + kapak), `error_code` (i18n anahtarı), `attempts`, `heartbeat_at`, `processed_at`, `uploaded_by`
- **Neden `MediaAsset`'e tür sütunu değil:** `MediaAsset`'in benzersiz `url` dizini, ürün görsellerini Medusa'nın `images`'ıyla eşleyen plan (`plan-product-media.ts`), kütüphane listesi ve süpürme kuralları (bir kez ürüne bağlanan görselin ana dosyası siparişler için kalır) hepsi görsel varsayar. Videonun durum makinesi, kuyruğu ve iki çıktısı ayrı tabloda daha az koşullu kodla yaşar.
- **Neden Medusa `images` değil:** `images` her yerde görsel diye okunur (küçük resim, sipariş satırı, Google Merchant, akışlar, e-postalar). Video oraya girmez; kapak görseli de girmez (§7).
- **Kaynak dosya:** iş başarıyla bitince **silinir** (KVKK: konum ve cihaz bilgisi taşır; kota). `failed` kaydın kaynağı "Yeniden dene" için 7 gün tutulur, sonra süpürmeyle silinir. Bedeli: kalite ayarı ileride değişirse eski videolar yeniden yüklenmeden yeniden kodlanamaz (Kararlar 4).
- **Varyanta özel video ilk sürümde yok.** Varyant görselleri `images` içindeki sıra numarasıyla taşınır; videoyu oraya karıştırmak bu sözleşmeyi bozar. Gerekirse ileride `MediaVideo`'ya isteğe bağlı varyant kimlikleri eklenir.
- **Ürün başına en çok 2 video** (yüklenen + YouTube toplamı; Kararlar 2). Sunucu sayar, panel düğmeyi kapatır.
- Ürün kopyalama (`use-duplicate.ts`), xlsx içe/dışa aktarma ve eski siteden geçiş videoyu ilk sürümde taşımaz.

### 2. Galeride yer

- **Sabit konum:** videolar galeride **ilk görselin hemen ardından** gelir (2. ve 3. kare). İlk kare her zaman görseldir: ürünün LCP öğesi bugünkü gibi hevesli yüklenen ilk görsel kalır ve otomatik oynayan video sayfa açılışında hiç görünmez (rayda ikinci karedir).
- `position` sütunu bugün `1` ("1. görselden sonra") yazılır; ileride serbest sıralama gelirse migration gerekmez. Panel videoyu ilk sıraya sürüklemeye izin vermez.
- Ürünün hiç görseli yoksa video yine ilk kare olmaz; vitrin videoyu kapağıyla tek kare olarak gösterir ama otomatik oynatmaz (kapak LCP olur, video baytı açılışta inmez).

### 3. Yükleme ve doğrulama

- **Kendi ucumuz:** `POST /admin/products/:id/videos` (multipart, tek dosya). `/admin/uploads` kullanılmaz: multer dosyayı belleğe okur, genel kapı 25 MB'ta keser, doğrulayıcı yalnız görsel kabul eder ve kayıt kotaya görsel olarak girer. Uç `/admin/products*` altında olduğu için paket koruması (kısıtlı mağazada kapalı) ve ürün yazma rol kuralı kendiliğinden uygulanır.
- **Akış:** `uploadSizeGate` bu yol için ayrı sınır uygular (`Content-Length` ≤ 52 MB, uzunluksuz istek ret); gövde akışla (busboy, multer'ın kendi ayrıştırıcısı; doğrudan bağımlılık olur, `pnpm-lock.yaml` değişikliği haber verilir) `0600` izinli geçici dosyaya yazılır, 50 MB'ı geçen bayt gelince akış kesilir ve dosya silinir. Belleğe tamamı alınmaz.
- **Tür içerikten:** ilk baytlar okunur; bildirilen MIME ve dosya adı yok sayılır. Kabul edilen kaplar: MP4/MOV (`ftyp` kutusu; markalar `isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V `, `qt  `), WebM (EBML `1A 45 DF A3`, DocType `webm`), GIF (`GIF87a`/`GIF89a`; dilim 7'ye kadar ret). Matroska (`.mkv`), AVI, FLV, MPEG-TS, HLS/DASH listeleri ve diğer her şey `video.unsupported_type`.
- **ffprobe denetimi (istek içinde, ~yüz ms):** biçim **zorla** verilir (`-f mov | matroska | gif`; ffmpeg içerikten tahmin etmez, HLS/concat ayrıştırıcıları hiç açılmaz), `-protocol_whitelist file`, girdi `file:` önekli bizim yazdığımız yol. Sınırlar:
  - en az bir video akışı; kodek beyaz listesi `h264`, `hevc`, `vp8`, `vp9`, `av1`, `mpeg4`, `gif` (iPhone HEVC/MOV kaydı kabul)
  - süre ≤ 30,5 sn (kap süresi ile akış süresinin büyüğü)
  - genişlik ve yükseklik ≤ 4096, piksel ≤ 4096 × 2304 (4K'nın biraz üstü; çok yüksek çözünürlükte bellek bombası)
  - kare hızı ≤ 120; bildirilen kare sayısı ≤ 30,5 × 120
  - ffprobe 15 sn'de bitmezse ya da hata verirse `video.unreadable`
- **Ret kodları** (`ValidationError`, `{ field: "file" }`): `video.too_large`, `video.too_long`, `video.unsupported_type`, `video.dimensions_too_large`, `video.unreadable`, `video.limit_per_product`, `plan.limit_reached` (mevcut).
- **Kota:** saklamadan önce `assertStorageFits(container, bytes)`; `storedBytes()` `media_video.stored_bytes` toplamını da ekler (kaynak dosya işlenene dek sayılır; sonra çıktılar + kapak). Görsellerde yalnız ana dosya sayılır, videoda saklanan her şey: videonun türevleri ana dosyadan büyüktür ve asıl yükü onlar taşır. Kullanım raporu (`lib/control-plane/usage.ts` `storedBytes`) aynı ölçüyü okur; üst panelde değişiklik yok.
- **Saklama:** doğrulanan dosya `getUploadStream({ access: "private" })` ile depoya akar (ad `video-kaynak.<uzantı>`, sağlayıcı ULID ekler), kayıt `uploaded` açılır, `media.video_uploaded` olayı yayınlanır, uç 202 ile kaydı döner. Geçici dosya her yolda silinir.
- **Hız sınırı:** yeni profil `media_video` (personel/IP başına 10 dakikada 10 yükleme; `lib/security/rate-limit/profiles.ts`).
- **Rol:** ürün görseliyle aynı (ürün yazabilen rol). **Denetim:** `api/http/audit/resources/media.ts`'e `media_video` kaynağı: ekleme, başlık değişikliği, silme (önce/sonra: tür, başlık, YouTube kimliği; dosya anahtarı yazılmaz).
- **Doğrudan depoya ön imzalı yükleme** (`getUploadFileUrls`) seçilmedi: docs/04 bu yolu doğrulamadan geçmediği için kapalı tutar; ön imzalı PUT'ta boyut sınırı sağlayıcıya göre değişir, SeaweedFS'te ölçülmedi. 50 MB backend'den akışla geçer.

### 4. Dönüştürme

- **İş kuyruğu: async-job değil, video kaydının kendisi.** async-job'un `singleton` türü ikinci işi bekletmez, reddeder; işler mağazanın iş listesine düşer; video başına bir iş kaydı listeyi doldurur. Durum zaten videonun üstündedir. Desen aynıdır (kalp atışı, süpürücü, deneme sayısı), yeri farklıdır:
  - `media.video_uploaded` aboneliği ve **her dakika** çalışan `jobs/media-video-queue.ts`, `transcodeNextVideoWorkflow`'u tetikler.
  - Workflow mağaza genelinde tek kilidi (`acquireLockStep`, anahtar `media:video`, Redis kilidi) alır; alamazsa çıkar (sıradaki tur alır). Kilidi alan en eski `uploaded` kaydı `processing` yapar, işler, bitince bir sonrakine geçer. **Eşzamanlılık 1.**
  - Kalp atışı 30 sn'de bir; 10 dakika sessiz kalan `processing` kaydı süpürücü `uploaded`'a geri koyar (`attempts + 1`).
  - Girdi hatası (bozuk akış, sınır dışı) **hemen** `failed`; altyapı hatası (zaman aşımı, ffmpeg çöktü, depo yazamadı) en çok 3 deneme, sonra `failed` (`video.processing_failed`).
- **Aynı makinedeki mağazalar:** instance-per-tenant'ta her mağazanın kendi kilidi var; aynı VPS'te N mağaza aynı anda N ffmpeg çalıştırabilir. F16'da makine başına tek dönüştürme yuvası gerekir (Kararlar 9).
- **İşlem adımları** (`lib/media/video/` altında ince bir `spawn` sarmalayıcısı; kabuk yok, argüman dizisi):
  1. Kaynağı `getDownloadStream` ile `mkdtemp` dizinine (`0700`) indir. Boş disk < 500 MB ise başlama (`fs.statfs`).
  2. ffprobe'u yeniden çalıştır (istekteki denetimin aynısı; dosya depoda değişmiş olabilir).
  3. **MP4:** H.264 (libx264), `-preset medium -crf 24 -maxrate 2M -bufsize 4M -profile:v high -pix_fmt yuv420p -movflags +faststart`.
  4. **WebM:** VP9 (libvpx-vp9), `-crf 33 -b:v 2M -row-mt 1 -deadline good -cpu-used 4`. AV1 seçilmedi: SVT-AV1 hızlı olsa da Safari'de AV1 yalnız donanım çözücülü cihazlarda var; VP9 Chrome/Firefox/Edge'de her yerde, MP4 her tarayıcıda yedek.
  5. Ortak: kısa kenar en çok **720 px** (büyütme yok, en-boy korunur, çift piksel), `-fpsmax 30`, `-t 30`, yalnız ilk video akışı (`-map 0:v:0`), **ses, altyazı, veri akışları ve bölümler atılır** (`-an -sn -dn -map_chapters -1`), **meta veri silinir** (`-map_metadata -1`, `-fflags +bitexact`). iPhone MOV'un konum (`com.apple.quicktime.location.ISO6709`), cihaz ve tarih etiketleri ve ayrı meta veri izi böylece çıktıya girmez.
  6. **Kapak:** ilk kare PNG olarak çıkarılır, `sharp` ile `lib/media` hattından geçer (`sanitizeImage` + `deriveImages`: WebP/AVIF `srcset`), ad `{ürün-slug}-video-{n}-{genişlik}`. Tamamen koyu ilk kare için küçük kural Kararlar 10'da.
  7. Çıktılar ffprobe ile doğrulanır (süre ≤ 30 sn, ses yok, etiket yok); sonra `storePublicFile` benzeri akışla genel yazılır (`video/mp4`, `video/webm`; ad `{ürün-slug}-video-{n}.{mp4|webm}`).
  8. Kayıt `ready`; kaynak silinir; `stored_bytes` güncellenir; `media.video_ready` yayınlanır (ürünün SEO yükü ve arama dizini bunu dinler). Hata yolunda yazılan çıktılar silinir.
- **Kaynak sınırları:** her ffmpeg geçişi 4 dakikada, iş bütünü 10 dakikada `SIGKILL`; `-threads 2` (4 çekirdekli VPS'in yarısı), süreç önceliği `os.setPriority(pid, 19)`; F16'da işçi kapsayıcısının CPU ve bellek sınırı (Docker `cpus`, `mem_limit`) asıl tavandır. Ağ: girdi yalnız yerel dosya, `-protocol_whitelist file`; F16'da işçi kapsayıcısının dışarı çıkışı kapatılabiliyorsa kapatılır (doğrulanmadı: depo ve veritabanı erişimiyle birlikte nasıl kurulacağı F16'da). 30 sn'lik 720p klibin süresi 2 çekirdekte ölçülmedi; dilim 2'de ölçülür ve buraya yazılır.
- **ffmpeg'in kendisi:** dağıtımın paketi (`apk add ffmpeg` ya da `apt install ffmpeg`), Node paketi değil. Yol `FFMPEG_PATH` / `FFPROBE_PATH` (isteğe bağlı; yoksa `PATH`), `.env.example`'a yazılır. Sürüm ≥ 7 ve imajla birlikte güncellenir; açılışta sürüm loglanır.
- **ffmpeg yoksa:** açılışta bir kez `ffmpeg -version`, `ffprobe -version` ve kodlayıcı listesi (`libx264`, `libvpx-vp9`) denetlenir, sonuç bellekte tutulur. Eksikse `media.video_unavailable` hata logu düşer; yükleme ucu `video.upload_unavailable` döner ve panelin okuduğu yetenek (`GET /admin/products/:id/videos` yanıtında `upload: false`) video yükleme seçeneğini gizler. YouTube bağlantısı çalışmaya devam eder. Panel altyapı durumu göstermez (sahibin "panel mağaza içindir" kuralı); işleyici ve ölçüm logdadır. Kuyruktaki `uploaded` kayıtlar ffmpeg gelince işlenir.
- **Uygulama notu (dilim 1, güvenlik incelemesi O1):** ffprobe, karar vermeden önce kendi içinde sınırlanır (`lib/media/video/probe-args.ts` `inputBounds`): `-format_whitelist <demuxer>`, `-codec_whitelist` (izinli video kodekleri + kapak resmi `mjpeg`/`png` + yaygın ses), `-max_streams 16`, `-max_pixels 9437184`, `-threads 1`, `-max_alloc 268435456`, `-probesize`/`-analyzeduration` (ffmpeg'in varsayılanları açıkça). Açılışta ffmpeg bir saniyelik klip üretir, ffprobe onu bu seçeneklerle okur; geçmezse yükleme kapalı kalır. **Dilim 2:** aynı `inputBounds` ffmpeg çağrısının girdi seçeneklerine de girer ve video akışı `-map 0:V:0` ile seçilir (büyük `V`: kapak resmi gibi `attached_pic` akışları hariç).
- **Lisans seçimi:** ffmpeg ayrı bir süreç olarak çalıştırılır, koda bağlanmaz ve ikili kimseye dağıtılmaz; GPL'in kaynak verme yükümlülüğü dağıtımla doğar (GPL, AGPL değil). Bu yüzden x264'lü GPL derleme kullanılır. Mağaza imajı bir gün müşteriye verilirse (kendi sunucusunda çalıştırma) ffmpeg'in kaynağı da verilmelidir. Bu değerlendirme bir avukatın görüşü değildir (şirket ve danışman yok); yasal taslak olarak işaretli kalır. Tam LGPL yolu (H.264 için Cisco OpenH264, WebM için libvpx; ikisi de BSD) yedek seçenektir; kalite/boyut farkı ölçülmedi.

### 5. Sunum

- Çıktılar ve kapaklar genel dosyadır, vitrine doğrudan depodan (`S3_FILE_URL`; ileride CDN) gelir. Backend video baytı taşımaz.
- **`Range`:** S3 ve SeaweedFS destekler (Bağlam). Dilim 2 kabul ölçütü: `curl -r 0-1023` 206 ve doğru `Content-Range` döner; Safari'de oynar.
- **Önbellek:** S3 sağlayıcısının varsayılanı `public, max-age=31536000`; ad ULID'li olduğundan dosya değişmez, yeniden kodlama yeni ad yazar. **`Content-Type`** yüklemede verilen `video/mp4` / `video/webm`.
- **Bant genişliği:** 720p, 2 Mb/sn tavan, 30 sn → biçim başına en çok ~7,5 MB; tarayıcı yalnız birini indirir. Video ilk karede olmadığı ve `preload="none"` olduğu için yalnız ikinci kareye geçen ziyaretçi indirir. **Sıcak bağlantı** (başka sitenin videoyu gömmesi) ilk sürümde engellenmez; CDN gelince `Referer` kuralı orada kurulur. Depo VPS'teyken trafik VPS'in bant genişliğinden yer.
- **CSP:** vitrin `media-src 'self' https:` (geliştirmede `http:` da) alır; `img-src` ile aynı genişlikte. `frame-src`'a `https://www.youtube-nocookie.com` eklenir (§8). Değişiklik `csp.ts` ve birim testindedir; güvenlik incelemesi gerekir.
- **Soyutlama (karar 4):** vitrin videoyu yalnız `outputs.mp4.url`, `outputs.webm.url`, `poster` alanlarından okur. İleride bir video servisi gelirse ya File Module sağlayıcısı (depo değişir, alanlar aynı) ya da `kind: "stream"` ile yeni bir tür eklenir (oynatma adresi alanı); tema sözleşmesi değişmez.

### 6. Store API ve vitrin verisi

- `GET /store/products` alanlarına `+media_videos.*` yaprakları **tek tek** açılır (`STORE_MEDIA_LEAVES` deseni, `restrictStoreRelation`): `id`, `kind`, `status`, `title`, `position`, `width`, `height`, `duration_ms`, `outputs`, `poster`, `youtube_id`. Kaynak dosya anahtarı, çıktı dosya kimlikleri, hata kodu, yükleyen personel dışarı çıkmaz; `*media_videos` reddedilir. Ürün önizleme ucu (`api/store/product-preview/[token]/read.ts`) aynı alanları okur.
- Vitrin `lib/views/` altında yeni `product-videos.ts`: yalnız `status === "ready"` kayıtlar, en çok 2, `position` sırasıyla.
- **Tema sözleşmesi** (`packages/ui/src/product-views.ts`): `ProductPageView`'a **isteğe bağlı** yeni alan:

  ```ts
  /** The product's videos (adr/0069), in gallery order; none: no videos. */
  videos?: ProductVideoView[]

  interface ProductVideoView {
    id: string
    /** Where it sits: after this many pictures (today always 1). */
    after: number
    /** The shop's title, else the product's name: the player's accessible name. */
    title: string
    poster: ImageView
    width: number | null
    height: number | null
    durationSeconds: number | null
    /** Our clip: sources the theme lists in this order. */
    sources?: { webm: string | null; mp4: string }
    /** A YouTube video: shown as its poster until pressed. */
    youtube?: { embedUrl: string }
  }
  ```

  `images` dizisi **değişmez** (kapak oraya eklenmez): varyant görsellerinin sıra numaraları, küçük resimler ve hızlı bakış bugünkü gibi kalır.

### 7. Vitrin ve tema

- **Yayımlanmış biçim sözleşmesi (adr/0066, `bilesen-standardi.md` §7):** galeri bir bölüm biçimi değildir ama ürün sayfası görünüm kilidindedir (adr/0067 §3 adım 0). Video **yalnız mağaza video eklediğinde** görünür; videosuz ürünün çizimi bayt bayt aynı kalır, kilit testi (videosuz örnek ürün) yeşil kalır. Mağazanın seçtiği görünüm habersiz değişmez; video ekleyen sahibin kendisidir. Yeni bir ayar açılmaz (otomatik oynatma sahibin kararıdır, seçenek değil).
- **Videoyu tanımayan tema** `videos` alanını okumaz ve **hiçbir şey göstermez** (kapak dahil). Kapağı `images`'a koyup "en azından kapak görünsün" demek reddedildi: varyant görsel sıraları kayar, kapak sepet ve sipariş küçük resmine, akışlara sızabilir. Tek tema Atölye'dir ve biz güncelleriz.
- **Atölye (Oğuzhan'ın alanı;** başlamadan PR'da not): `product/Gallery.tsx` rayına `after` konumunda video karesi, `Thumbs.tsx`'te oynat işaretli küçük resim, `Zoom.tsx` video karesini atlar (ya da büyük oynatır; Oğuzhan seçer), yeni `product/GalleryVideo.tsx`:
  - kare görsellerle aynı kare kuyu ve en-boy kutusu: **CLS 0**
  - önce kapak (`ResponsiveImage`, tembel yükleme); `<video muted playsinline loop preload="none" disablepictureinpicture>` ve `<source>`'lar WebM, sonra MP4
  - `IntersectionObserver` kare görünür alanın ≥ %50'sine girince kaynakları bağlar ve `play()`; çıkınca `pause()`
  - `prefers-reduced-motion: reduce` ya da `navigator.connection.saveData` ise otomatik oynatma yok: kapak + "Videoyu oynat" düğmesi
  - her zaman görünür oynat/durdur düğmesi (WCAG 2.2.2: 5 sn'den uzun kendiliğinden hareket eden içerik durdurulabilmeli), klavyeyle erişilir; erişilebilir ad `title`
  - `play()` reddedilirse (tarayıcı otomatik oynatmayı kapatmışsa) sessizce kapak + düğme
- **YouTube karesi:** kapak (bizim depomuzdaki kopya; §8) + "Videoyu oynat" düğmesi + tek satır bilgi ("Oynattığınızda video YouTube'dan yüklenir."). Tıklanınca `<iframe src="https://www.youtube-nocookie.com/embed/{id}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="…">` eklenir. Tıklamadan önce Google'a hiçbir istek gitmez (kapak dahil).
- **Kapsam:** ilk sürümde yalnız ürün sayfası. Liste kartı, hızlı bakış (`QuickViewGallery.tsx`), ana sayfa rafları değişmez (Kararlar 6).
- **Performans kabulü:** docs/21 yöntemiyle videolu ürün sayfasında mobil LCP ≤ 2,5 sn ve bugünkü ölçümden kötü değil, CLS ≤ 0,1; açılışta video baytı inmez (ağ kaydında `.mp4/.webm` yok).

### 8. YouTube bağlantısı

- `POST /admin/products/:id/videos/youtube` `{ url, title? }`. Sunucu bağlantıdan yalnız kimliği çıkarır (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`, `youtube-nocookie.com/embed/`; kimlik `^[A-Za-z0-9_-]{11}$`); başka alan adı ya da biçim `video.youtube_invalid`. Gömme adresini biz kurarız; kullanıcının yazdığı adres hiçbir yerde kullanılmaz.
- Video gerçekten gömülebilir mi ve adı: YouTube oEmbed (`https://www.youtube.com/oembed?url=…&format=json`) `lib/security/safe-fetch` ile; gömme kapalı ya da gizli videoda `video.youtube_unavailable`. oEmbed'in davranışı (401/404) bu ADR için belgeden doğrulanmadı; dilim 5'te denenir. oEmbed'den gelen ad yalnız boş `title`'ı doldurur.
- **Kapak:** sunucu `https://i.ytimg.com/vi/{id}/maxresdefault.jpg`'yi (yoksa `hqdefault.jpg`) `workflows/media/import-fetch.ts`'in SSRF kurallarıyla bir kez indirir, görsel hattından geçirir (`sanitizeImage` + türevler) ve depomuza yazar. Vitrin kapağı bizden yükler: ziyaretçinin IP'si tıklamadan önce Google'a gitmez. Kapak indirilemezse kayıt yine açılır, vitrin ürünün ilk görselini kapak olarak kullanır.
- Kotaya yalnız kapak sayılır. YouTube kaydının `duration_ms`'i boştur (oEmbed süre vermez).
- **Çerez ve KVKK:** `youtube-nocookie` oynatmadan önce çerez yazmaz diye bilinir; oynatınca YouTube çerez, yerel depolama ve IP işler (ikincil kaynaklar; Google'ın kendi sayfası doğrulanmadı). Karar: tıklamadan önce iframe yok; tıklama kullanıcının açık eylemidir; kapakta tek satır bilgi; çerez politikası şablonuna (adr/0041 §5) "Üçüncü taraf: YouTube (Google), yalnız videoyu oynattığınızda" satırı ve aydınlatma metnine yurt dışına aktarım notu eklenir. Pazarlama çerez onayının ayrıca istenip istenmeyeceği yasal sorudur: tıklama yeterli sayıldı (Kararlar 7); avukat görene kadar yasal taslak.

### 9. SEO

- **JSON-LD:** hazır her video için ürün düğümünün yanında bir `VideoObject` düğümü (`lib/seo/jsonld-product.ts`, `@graph` içinde; ürün `subjectOf` ile `@id`'sine bağlanır): `name` (başlık ya da ürün adı), `description` (ürünün meta açıklaması), `thumbnailUrl` (kapağın en geniş WebP'si ve paylaşım kırpması), `uploadDate` (`processed_at`, saat dilimli ISO 8601), `duration` (`PT12S` biçimi), yüklenen klipte `contentUrl` (MP4), YouTube'da `embedUrl` (`https://www.youtube.com/embed/{id}`). Birim test zorunlu alanları denetler.
- **Video site haritası yok.** Google ürün sayfasındaki destekleyici videoyu video sonuçlarına almaz (2023-12-04); kazancı yok, bakım yükü var. docs/13'teki "video varsa video sitemap" cümlesi bu gerekçeyle değiştirilir. Görsel site haritasına kapak eklenmez (ürün görseli değil).
- **Danışman (docs/14):** ilk sürümde yeni kural yok; video puanı etkilemez. Alt metin kuralı videoya uygulanmaz (videonun erişilebilir adı başlıktır).

### 10. Panel

- **Tek giriş (docs/18 §7):** ürün sayfasındaki görsel kartı "Görseller ve videolar" olur. Aynı bırakma alanı ve aynı ortam penceresi: "Bilgisayardan yükle" video ve GIF dosyasını da kabul eder (yalnız bu kartta; içerik türüne göre görsel ucuna ya da video ucuna gider), "Adres" alanı YouTube bağlantısını tanır ve video olarak ekler. Kütüphane sekmesi yalnız görsel listeler (videolar ilk sürümde kütüphanede yok; Kararlar 8). Ayrı "Video ekle" düğmesi yok.
- **Izgara:** video kareleri 2. sıradan başlar (§2), kapakla ve köşede oynat işaretiyle; görsel kareleriyle aynı boy (eşit yükseklik, boş alan yok). Durum karenin üstünde kısa yazı: **"İşleniyor"** ya da **"İşlenemedi"**; hazırda yazı yok. İşleyen video varken liste 5 sn'de bir yenilenir.
- **Kareye tıklama → standart pencere** ("Video"): önizleme (hazırsa oynatılır), başlık alanı, süre ve boyut, YouTube'da bağlantı (salt okunur, "YouTube'da aç"), `failed`'da hata cümlesi ve yalnız altyapı hatasında "Yeniden dene", "Videoyu kaldır". Ürün sihirbazında video yok (ürün kaydedildikten sonra eklenir).
- Hata metinleri i18n (`tr` örnekleri): `video.too_large` "Video en çok 50 MB olabilir.", `video.too_long` "Video en çok 30 saniye olabilir.", `video.unsupported_type` "Bu dosya türü yüklenemez. MP4, MOV, WebM ya da GIF yükleyin.", `video.dimensions_too_large` "Videonun çözünürlüğü çok yüksek (en çok 4K).", `video.unreadable` "Video okunamadı; dosya bozuk olabilir.", `video.limit_per_product` "Bir ürüne en çok 2 video eklenebilir.", `video.processing_failed` "Video hazırlanamadı. Yeniden deneyin; olmazsa başka bir dosya yükleyin.", `video.youtube_invalid` "Geçerli bir YouTube bağlantısı girin.", `video.youtube_unavailable` "Bu video gömülemiyor ya da herkese açık değil.", `video.upload_unavailable` "Video şu an yüklenemiyor." Hiçbir yerde "demo/test" yazısı yok.

### 11. Silme ve KVKK

- Panelden kaldırma: kayıt yumuşak silinir, bağ kaldırılır, sonra dosyalar (çıktılar, kapak türevleri, varsa kaynak) silinir; dosya silme başarısızsa kimlikler kayıtta kalır ve süpürme yeniden dener. Video siparişte ve e-postada görünmediği için görsellerdeki "bir kez bağlanan ana dosya kalır" kuralı videoya uygulanmaz.
- Ürün silinince bağ kalkar; `jobs/media-sweep.ts` bir gündür ürünsüz kalan videoları ve 7 günlük `failed` kaynakları siler.
- `docs/kvkk-envanter.md`'ye `media_video` satırı: `uploaded_by` (personel kimliği, `media_asset` ile aynı kural); kaynak dosyadaki konum/cihaz bilgisi işlendikten sonra silinir, çıktıda yoktur; ses hiç yayınlanmaz; videoda kişi görünüyorsa silme panelden yapılır. YouTube: üçüncü taraf, yalnız oynatınca (§8).

### 12. Çok müşterili etki

- **Bayrak:** `catalog.product_videos`, `owner: platform` (paket özelliği; adr/0061 Ek C9'un ilk iş bayrağı), varsayılan **açık** (Kararlar 3). Kapalıyken uçlar 404, panel kartı yalnız görsel kabul eder, vitrin videoyu göstermez (kayıtlar ve dosyalar durur, açılınca döner). Bayrak `packages/types/src/control-plane/platform-flags.ts` listesine de girer; `platform-flags-contract.unit.spec.ts` iki tarafı eşler. Dağıtım sırası docs/08'deki "ekleme" kuralıdır: önce mağazalar yeni sürümle, sonra üst panel bayrağı sunar.
- **Kota:** paketin `storage_mb` limiti videoyu da sayar (§3); ayrı video limiti yok.
- **Kısıtlı/askıdaki mağaza:** `/admin/products*` kapalı olduğundan yükleme ve kaldırma kapalıdır (görsellerle aynı). Kuyruktaki işler sürer.

## Alternatifler

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| Kendi depomuz + işçide ffmpeg, MP4 (H.264) + WebM (VP9) (bu ADR) | Ek maliyet yok, veri bizde, CDN sonra eklenir | ffmpeg güvenilmeyen girdiyle çalışır; CPU bizim | **Seçildi** |
| GIF'i olduğu gibi kabul etmek | Kod az | 30 sn GIF onlarca MB, aynı klibin MP4'ü kat kat küçük; LCP ve veri tasarrufu bozulur; `sharp` canlandırmayı korumaz | Reddedildi (GIF videoya çevrilir) |
| Ücretli servis (Bunny Stream, Cloudflare Stream, Mux) | Dönüştürme ve CDN hazır, uyarlamalı akış | Aylık ücret, mağaza başına hesap/anahtar, veri yurt dışında (adr/0003), 30 sn klip için gereksiz | Şimdilik reddedildi; §5'teki soyutlama kapıyı açık tutar |
| Yalnız YouTube | Depolama ve CPU sıfır | Otomatik oynayan sessiz döngü YouTube oynatıcısıyla temiz olmaz (marka, ilgili videolar), tıklamadan önce gösterilemez, üçüncü taraf çerezi | Reddedildi; YouTube uzun videolar için yan yol |
| Tarayıcıda dönüştürme (ffmpeg.wasm) | Sunucuda CPU yok | ~30 MB çekirdek indirme, telefonda yavaş ve bellek yetmez; çıktı yine güvenilmez, sunucuda yeniden doğrulanmalı | Reddedildi |
| `fluent-ffmpeg` / `ffmpeg-static` | Hazır API / hazır ikili | Biri arşivlendi ve yeni ffmpeg ile bozuk; öteki eski sabit sürüm, GPL-3 derleme | Reddedildi; `child_process.spawn` + dağıtım paketi |
| Videoyu `MediaAsset`'e tür olarak eklemek | Tek tablo | Görsel varsayımlı dizin, eşleme ve süpürme kurallarına koşul; durum makinesi sığmaz | Reddedildi (ayrı `MediaVideo`) |
| async-job ile kuyruk | Mevcut altyapı | `singleton` ikinci işi reddeder, iş listesini video başına doldurur | Reddedildi; aynı desen video kaydında |
| WebM'de AV1 | Daha küçük dosya | Safari'de yalnız donanım çözücülü cihazlar; kodlama yükü | Şimdilik reddedildi; VP9 |

## Sonuçlar

- Mağaza ürün sayfasına 30 saniyelik sessiz klip ve YouTube videosu ekleyebilir; videosuz ürünlerin vitrini, görünüm kilidi ve LCP'si değişmez.
- Sunucuda ffmpeg gerekir (geliştirmede `brew install ffmpeg`; imajda dağıtım paketi). ffmpeg'in güvenlik güncellemeleri imaj güncellemesine bağlanır.
- Depolama kotası videoyla hızlı dolar (video başına ~5–15 MB); Ayarlar > Abonelik'teki kullanım bunu gösterir.
- CSP genişler: `media-src https:` ve `frame-src` YouTube kökeni.
- Çerez politikası ve aydınlatma metnine YouTube satırı girer (yasal taslak).
- docs/13 (video site haritası cümlesi), docs/06 (Görseller ve videolar), docs/04 (video yükleme kuralları), docs/08 (ffmpeg, işçi sınırları), `docs/kvkk-envanter.md` güncellenir.

## Uygulama sırası

Her dilim ayrı PR, `dev`'den `deniz/<konu>` dalı; kodlayıcı ajan sırayla. Süreler ajanlı çalışma için kabadır.

| # | Dilim | Kabul ölçütü | Test | Güvenlik incelemesi | Süre |
| --- | --- | --- | --- | --- | --- |
| 1 | **Model + yükleme + doğrulama + kota:** `MediaVideo` ve migration, `links/product-media-video.ts`, `POST/GET/DELETE /admin/products/:id/videos`, akışla yükleme ve ayrı boyut kapısı, imza okuyucu, ffprobe denetimi, ffmpeg yetenek denetimi, `storedBytes` genişlemesi, hız sınırı profili, denetim kaynağı, bayrak (`features.ts` + `platform-flags.ts`) | 52 MB üstü istek ve 50 MB'ı geçen akış kesilir; ad/MIME sahte dosya, HLS listesi `.mp4` adıyla, `concat:` ve AVI reddedilir; 31 sn ve 8K reddedilir; kota dolu 403; ürün başına 3. video reddedilir; kısıtlı mağazada kapalı | birim (imza, sınırlar), HTTP entegrasyon (küçük örnekler testte ffmpeg ile üretilir; ffmpeg yoksa test açıkça atlanır ve loglar) | **Evet** (yükleme) | 3 gün |
| 2 | **Dönüştürme işi + durum:** kuyruk workflow'u ve kilit, dakikalık iş, süpürme, MP4/WebM/kapak, meta veri ve ses temizliği, deneme ve hata sınıfları, silme akışı ve süpürme | 30 sn MOV (konum etiketli, sesli) → iki çıktı + kapak; çıktıda ses ve etiket yok (ffprobe); iki yükleme sırayla işlenir (aynı anda tek ffmpeg); süreç öldürülünce kayıt geri sıraya döner; depodan `Range` 206; işleme süresi ölçülüp ADR'ye yazılır | birim + modül entegrasyon + elle ölçüm | **Evet** (güvenilmeyen girdi) | 3 gün |
| 3 | **Panel:** "Görseller ve videolar" kartı, ortam penceresinde video/GIF ve YouTube adresi, kare durumu, "Video" penceresi, i18n | Yükleme → "İşleniyor" → kapak; hata cümleleri; eşit kare boyları; bayrak kapalıyken eski kart | panel birim (Vitest) + tarayıcıda göz | Hayır | 2 gün |
| 4 | **Vitrin verisi + tema:** Store alan yaprakları, `product-videos.ts`, `ProductPageView.videos`, Atölye `GalleryVideo`, CSP `media-src` | videosuz ürün kilidi aynı; videolu sayfada açılışta video baytı yok, LCP/CLS bütçede; hareketi azaltma ve veri tasarrufunda otomatik oynatma yok; klavyeyle durdurulur | birim + görünüm kilidi + `style:capture` + Lighthouse (docs/21) | **Evet** (CSP) | 2 gün · **Oğuzhan'ın alanı:** `packages/ui/src/product-views.ts`, `packages/themes/atolye/src/product/Gallery.tsx`, `Thumbs.tsx`, `Zoom.tsx`, yeni `GalleryVideo.tsx`; önceden PR'da not |
| 5 | **YouTube:** uç, kimlik ayrıştırma, oEmbed, kapak kopyası, vitrin karesi, `frame-src`, çerez politikası satırı | Tıklamadan önce Google'a hiç istek yok (ağ kaydı); yabancı alan adı ve `javascript:` reddi; gizli video reddi | birim + HTTP entegrasyon (sahte oEmbed) + tarayıcı | **Evet** (SSRF, CSP) | 1,5 gün |
| 6 | **SEO:** `VideoObject`, docs/13 değişikliği | Zorunlu alanlar; Rich Results Test'te hata yok | birim | Hayır | 0,5 gün |
| 7 | **GIF:** imza beyaz listesi, `-f gif`, kare sınırı, tek kareli GIF görsele çevrilir | 20 sn GIF → MP4/WebM; tek kareli GIF ürün görseli olur; panel GIF'i video ucuna gönderir, görsel ucu (`/admin/uploads`) GIF'i yine `upload.unsupported_type` ile reddeder | birim + entegrasyon | **Evet** (yeni girdi türü) | 1 gün |
| 8 | Belgeler ve uçtan uca: docs/04, 06, 08, kvkk-envanter, e2e (yükle → işlen → vitrinde oyna → kaldır) | e2e yeşil | e2e | Hayır | 0,5 gün |

Toplam kabaca 13–14 iş günü. Dilim 1 ve 2 birbirine bağlıdır; 3, 4 ve 5 dilim 2'den sonra bağımsızdır; 6 dilim 4'ten, 7 dilim 2'den sonra gelir.

## Kararlar (sahip, 2026-11-16)

Öneri sürümündeki 10 açık soru, sahibin onayıyla ("ürün videolarında önerdiğin şekilde iyi") önerilen varsayılanlarla karara bağlandı. Bu varsayılanlar ADR'nin gövdesinde zaten uygulanmış haldeydi; gövde değişmedi.

1. **Galerideki yer:** video hep ilk görselin ardından mı (2. kare), yoksa sahip sürükleyerek istediği yere koyabilsin mi? **Karar:** ilk sürümde sabit 2. kare (ilk kare hep görsel: hız puanı korunur); serbest sıra sonra, migration gerektirmez.
2. **"Ürün başına 1–2 video"** yüklenen + YouTube toplamı mı? **Karar:** toplam en çok 2.
3. **Paket özelliği:** video bütün paketlerde açık mı başlasın? **Karar:** `catalog.product_videos` varsayılan açık; depolama kotası zaten sınırlar, ucuz pakette üst panelden kapatılabilir.
4. **Kaynak dosya:** video hazır olunca orijinal silinsin mi? **Karar:** silinir (konum bilgisi taşır, kotadan yer). Bedeli: ileride kalite ayarı değişirse eski videolar yeniden yüklenmeden iyileştirilemez.
5. **Kalite:** 720p, 2 Mb/sn tavan yeterli mi (ürün detayı, bıçak ağzı gibi ince işçilik)? **Karar:** evet; dilim 2'de örnek klip sahibe gösterilir, gerekirse tavan 3 Mb/sn yapılır.
6. **Ürün kartı ve hızlı bakış:** listede üzerine gelince video, hızlı bakışta video olsun mu? **Karar:** ilk sürümde yalnız ürün sayfası; ürün kartında ve hızlı bakışta video yok.
7. **YouTube çerezi (yasal, danışman yok):** tıklama + kapaktaki tek satır bilgi yeterli mi, yoksa ziyaretçi pazarlama çerezlerine onay vermeden YouTube hiç oynatılmasın mı? **Karar:** oynatıcı tıklanınca yüklenir ve kapaktaki tek satır bilgi yeterli sayılır; çerez politikasına YouTube satırı eklenir. Yasal metin avukat görene kadar **yasal taslak** olarak işaretli kalır.
8. **Medya kütüphanesi:** videolar kütüphane sayfasında da listelensin mi (başka ürüne yeniden kullanmak için)? **Karar:** ilk sürümde hayır; video ürüne aittir.
9. **F16, aynı VPS'te birden çok mağaza:** dönüştürme makine başına tek mi olsun (bütün mağazalar sıraya girer), mağaza başına tek mi? **Karar:** makine başına 1 dönüştürme yuvası (Redis mağazalar arasında paylaşılıyorsa ad alanı dışında tek anahtar, değilse paylaşılan bir dizinde `flock`); mekanizma F16 kurulumunda kesinleşir.
10. **Kapak karesi:** ilk kare kararmayla başlıyorsa (tamamen siyah) ne yapılsın? **Karar:** ilk kare; ortalama parlaklığı çok düşükse 1. saniyedeki kare. Panelden kapak seçmek sonraki sürüm.
