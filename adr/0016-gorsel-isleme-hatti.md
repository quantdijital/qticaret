# ADR-0016: Görsel işleme hattı (EXIF temizleme, yeniden kodlama, türevler)

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama F3.3)
- **Tarih:** 2026-10-25

## Bağlam

docs/04 ve docs/13 §8 yüklenen görselin şu işlemlerden geçmesini ister:

- EXIF ve konum verisinin silinmesi
- yeniden kodlama
- WebP/AVIF türevleri ve `srcset` boyut seti
- slug'dan dosya adı
- zorunlu alt metin
- OG için 1200×630 kırpma

Bugünkü durum (F2 S5):

- **Doğrulama:** Görsel baytlardan doğrulanıyor (tür, boyut, piksel sınırı) ve gerçek türünün adıyla saklanıyor.
- **Eksik:** Piksel işleme yok. EXIF olduğu gibi kalıyor.

Kısıtlar:

- Node'da piksel işleme bir yerel kütüphane gerektirir.
- İşlem büyük görselde yüzlerce ms sürer; request yolunda yapılmamalı (docs/05).
- F2.8 asenkron iş altyapısı hazır.

## Karar (öneri)

- **Kütüphane:** `sharp` (libvips, Apache-2.0, 0.35.x).
  - Exact sürüm, ≥14 gün kuralı.
  - `limitInputPixels: 40_000_000`: S5'in piksel sınırıyla aynı; dekompresyon bombasına ikinci kat koruma.
- **Akış:**
  1. `POST /admin/uploads` S5 kontrollerinden geçer ve orijinal private bir "işlenmemiş" anahtarla saklanır.
  2. `image.process` iş tipi (F2.8) worker'da çalışır:
     - `rotate()` (EXIF yönü uygulanır), metadata atılır;
     - türevler: 1600/800/400 px WebP ve AVIF, 1200×630 OG;
     - dosya adı `{urun-slug}-{sira}-{genislik}.{webp|avif}`.
  3. Türevler public yazılır; orijinal silinir ya da yalnızca private tutulur.
- **Alt metin:** Ürün görseli kaydında zorunludur. Boşsa öneri şablonu docs/13 §8'den gelir; advisor eksikliği işaretler (F3.13).
- **Kalite ve boyut:** üst sınır platform ayarlarının `media` bölümünde (tenant).

## Alternatifler

| Seçenek                                             | Artı                                           | Eksi                                                                      |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| **sharp + worker işi**                              | Olgun, hızlı, AVIF dahil; F2.8 desenine oturur | Yerel ikili (imajda platform eşleşmesi); yeni bağımlılık                  |
| Harici görsel servisi (imgproxy, Cloudflare Images) | Sunucuda yük yok, CDN entegre                  | Ek altyapı/maliyet; tenant başına yapılandırma; veri yerleşimi (adr/0003) |
| WASM (squoosh vb.)                                  | Yerel ikili yok                                | Yavaş; bakımı zayıf                                                       |
| İşlememek                                           | Kod yok                                        | docs/04 ihlali (konum sızıntısı), performans kaybı                        |

## Sonuçlar

- Docker imajında `sharp`'ın platform ikilisi (linux-x64/arm64 musl) F16'da doğrulanır.
- Mevcut yüklenmiş görseller için bir kez çalışan bir taşıma işi gerekir.
- Medusa 2.21.2'de doğrulanan (F3 araştırması):
  - `ProductImage` alanları `url`, `rank`, `metadata` ve varyant ilişkisidir; alt metin alanı yok.
  - `uploadFilesWorkflow` için belgelenmiş hook ve dosya olayı yok. Tek uzantı noktası core multer'dan sonra çalışan route middleware'imiz (`uploadValidator` orada).
  - Varyant görselleri çekirdekte var (`batchImageVariantsWorkflow`).
- T6 planında karar verilecekler:
  - Alt metin `ProductImage.metadata`'da mı, yoksa kendi tablomuzda mı tutulacak (adr/0015 gerekçesi: core route `metadata`'yı doğrulamadan yazar).
  - Türev URL'leri `metadata`'ya mı, ayrı bir tabloya mı yazılacak (ürün `images` alanı tek URL taşır).

## Uygulama notu (F3 T6, 2026-10-26)

- **Kütüphane:** `sharp` 0.35.5 (exact; 2026-09-27'de yayımlandı, ≥14 gün kuralına uyuyor).
- **Temizleme yüklemede, eşzamanlı (ADR'den sapma):** `POST /admin/uploads`'tan geçen her görsel saklanmadan önce işleniyor:
  - EXIF yönüne göre döndürülüyor, tüm metadata atılıyor (EXIF/GPS, XMP, IPTC), uzun kenarı en fazla 2560 px'e indiriliyor, kendi biçiminde yeniden kodlanıyor.
  - Gerekçe: Metadata'lı bir kopya hiçbir yerde tutulmuyor (private "işlenmemiş" orijinal de yok). Sihirbaz görseli ürün oluşmadan hemen kullanabiliyor.
  - Bedeli: yükleme isteğinde görsel başına birkaç yüz ms. Yalnızca admin yolu; vitrin etkilenmiyor.
- **Türevler asenkron:** Ayrı bir iş tipi değil, ürün kaydı aboneliği. Ürün başına kilitli `deriveProductMediaWorkflow`:
  - 400/800/1600 px WebP + AVIF (görselden geniş olanı yok) ve 1200×630 OG kırpması (`attention`).
  - Ad: `{slug}-{sıra}-{genişlik}`. S3 sağlayıcısı sonuna benzersiz ek koyuyor.
  - Slug ya da sıra değişince yeniden üretiliyor, eskileri siliniyor.
  - Gece süpürmesi kaçanları üretiyor; bir gündür hiçbir üründe kullanılmayan yüklemeleri siliyor.
- **Alt metin ve türevler kendi tablomuzda** (`media` modülü, `MediaAsset`, ürüne link). `ProductImage.metadata` kullanılmadı; çekirdek route metadata'yı doğrulamadan yazıyor (adr/0015 gerekçesi).
- **Store API:** `/store/products?fields=+media_assets.url,+media_assets.alt,+media_assets.derivatives,...`. Toplu `*media_assets` reddediliyor; depolama anahtarları dışarı çıkmıyor.
- **S3 adresi düzeltmesi:** Medusa'nın `retrieveFile` URL'si S3'te imzalı ve süreli. Logo, paylaşım görseli ve ürün görseli için kalıcı public adres `S3_FILE_URL` + anahtar olarak kuruluyor.
- **Mevcut görseller:** Canlıda mağaza olmadığından taşıma işi yazılmadı. Hattan önce eklenmiş görselin türevi ve alt metin kaydı yok; yeniden yüklenince hatta giriyor. Eski platformdan geçişte (F14) taşıma aracı bunu yapacak.
- **Kalite ayarları** (`media` ayar bölümü) şimdilik sabit: master JPEG 86, WebP 80, AVIF 50, OG JPEG 85. Mağaza bazlı ayar ihtiyacı doğarsa eklenecek.
