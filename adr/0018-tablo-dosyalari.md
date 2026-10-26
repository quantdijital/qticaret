# ADR-0018: Tablo dosyaları (xlsx) içe ve dışa aktarma

- **Durum:** Kabul edildi (2026-10-25, kullanıcı onayı; uygulama F3.9)
- **Tarih:** 2026-10-25

## Bağlam

F3.9 şunları ister:

- 1000 satırlık Excel içe aktarma (TR şablonu, SEO sütunları, satır bazlı hata raporu).
- Excel dışa aktarma; formül başlangıçlı hücreler kaçışlanmış olmalı.

xlsx bir zip içindeki XML'lerdir. Zip bombası, XXE ve formül enjeksiyonu riskleri taşır (docs/04).

Elimizde olanlar (F2 S5):

- **`readZipSafely`:** girdi sayısı, gerçek boyut ve oran sınırı; traversal, symlink ve mükerrer ad reddi.
- **`parseXmlSafely`:** DTD yok, derinlik sınırı, değerler metin.
- **CSV kaçışlama:** `;` + BOM.

Kütüphane durumu (2026-10-25, npm):

- **`xlsx` (SheetJS):** npm'deki 0.18.5 eski; proje npm dışına taşındı, bilinen açıklar eski sürümde kaldı.
- **`exceljs` 4.4.0:** 2023'ten beri yayın almadı.

Medusa 2.21.2'nin yerleşik ürün içe aktarması (F3 araştırması):

- Yalnızca CSV, `importProductsAsChunksWorkflow` (yaklaşık 1000 satırlık parçalar, onay adımı).
- Bilinmeyen sütun reddediliyor (`Invalid column name(s)`); SEO ve marka sütunları eklenemez.
- Kategori, koleksiyon, etiket ve tip handle ile değil ID ile verilir; görsel sütunu yalnızca URL alır.
- Workflow hook'u belgelenmemiş.

## Karar (öneri)

- **Okuma: kendi küçük okuyucumuz.**
  - Zip `readZipSafely` ile açılır.
  - `xl/workbook.xml`, `xl/sharedStrings.xml` ve ilk sayfanın XML'i `parseXmlSafely` ile okunur.
  - Yalnızca hücre değerleri alınır (metin, sayı, boolean, inline string). Formül hücresinin yalnızca önbelleklenmiş değeri okunur; formül çalıştırılmaz.
  - Tarih hücreleri şablonda metin olarak istenir.
- **Yazma:**
  - Varsayılan: `;` + BOM'lu CSV (bugün var).
  - Excel istenirse `yazl` (MIT; yauzl'un yazarı) ile en küçük SpreadsheetML: inline string, sayı hücresi, stil yok.
  - Her metin hücresi formül kaçışından geçer.
- **İçe aktarma akışı:** async-job tipi `catalog.import`.
  - Dosya F3.9'da yeniden açılacak kontrollü bir yükleme yolundan gelir; S13'te kapatılan `presigned-urls` yerine geçer.
  - Satırlar Zod ile doğrulanır; workflow'larla yazılır.
  - Hatalı satırlar ikinci bir CSV olarak sonuçta yer alır.

## Alternatifler

| Seçenek                   | Artı                                                                     | Eksi                                                              |
| ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Kendi okuyucu + yazl**  | Saldırı yüzeyi bizim; zip/XML korumaları zaten var; tek küçük bağımlılık | Biçimlendirme, çoklu sayfa, tarih biçimleri sınırlı               |
| exceljs                   | Tam özellik, akış                                                        | Bakımı durgun; büyük bağımlılık ağacı                             |
| SheetJS (kendi CDN'inden) | En kapsamlı                                                              | npm dışı kaynak (supply chain kuralı); lisans ve sürüm takibi zor |
| Yalnızca CSV              | Kod yok                                                                  | Kullanıcılar Excel bekliyor (Türkçe karakter, ayırıcı karmaşası)  |

## Sonuçlar

- Şablon dosyası (TR sütun adları) admin'den indirilir; sütun eşleme Medusa'nın ürün CSV'sinden bağımsızdır.
- Okuyucu için gerçek Excel, LibreOffice ve Google Sheets çıktılarıyla örnek dosya testleri eklenir.

## Uygulama notu (F3 T15, 2026-10-26)

- **Okuyucu (`lib/sheets/xlsx-read.ts`):** zip `readZipSafely`, XML `parseXmlSafely` ile (DTD yok; varlıklar elle çözülüyor: beş önceden tanımlı ve karakter referansları). İlk sayfa `workbook.xml` + ilişkiler üzerinden bulunuyor. Paylaşılan ve satır içi metin, sayı (Excel'in kayan nokta artığı 15 basamakla temizleniyor), boolean, formülün önbellek değeri okunuyor; formül çalışmıyor. Bozuk ya da düşmanca dosya kullanıcıya `upload.sheet_invalid` / `upload.sheet_too_large` olarak dönüyor.
- **Yazıcı (`lib/sheets/xlsx-write.ts`):** `yazl` 3.3.1 ile en küçük SpreadsheetML; satırlar akarak zip'e giriyor (50.000 satır bellekte tutulmuyor). Kalın ve dondurulmuş başlık, sütun genişlikleri, ikinci sayfa ("Nasıl doldurulur"). Her metin hücresi CSV ile aynı kuralla formül kaçışından geçiyor; içe aktarma kaçış kesmesini geri alıyor.
- **CSV:** UTF-8 değilse Windows-1254 olarak okunuyor (Türkçe Excel'in "CSV"si).
- **Yükleme yolu:** `POST /admin/catalog/imports?mode=check|apply`, gövde dosyanın kendisi (en çok 10 MB, gövde ayrıştırıcı kapalı). Tür baytlardan anlaşılıyor; dosya özel erişimle `catalog-import-*` adıyla saklanıyor ve `/admin/uploads/:id`'den verilmiyor. CSRF: bu yolda yalnızca xlsx/CSV gövde türleri (CORS-basit değiller) kabul ediliyor, köken kontrolü sürüyor. `catalog.import` işi iç tür: genel `POST /admin/async-jobs` kuyruğa alamıyor. İş kaynağı her sonuçta siliyor.
- **İçe aktarma:** her ürün tek bir birleşik workflow (`catalog-import-product`): Medusa'nın ürün/varyant/stok workflow'ları ve bizim marka, birincil kategori, SEO, özellik workflow'ları `runAsStep` ile iç içe; biri düşerse ürünün önceki adımları geri alınıyor. Önce "kontrol" (hiçbir şey yazmaz; yeni ürünlerin SEO ön değerlendirmesi dahil), sonra "uygula". Sonuç raporu xlsx (satır, tanıtıcı, sonuç, sütun, açıklama, SEO).
- **Dışa aktarma:** `catalog.export` işi (xlsx ya da `;`+BOM CSV), içe aktarmayla aynı sütunlar; dışa aktarılan dosya olduğu gibi geri yüklenebiliyor (testli).
- KK: 1000 satırlık Excel worker'da tamamlanıyor, hatalı satırlar raporda (HTTP testi); dışa aktarılan Excel'de formülle başlayan hücre kaçışlı (HTTP testi).

