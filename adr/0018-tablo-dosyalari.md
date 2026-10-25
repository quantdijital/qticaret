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
