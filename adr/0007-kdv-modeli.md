# ADR-0007: KDV modeli (ürün tipi = KDV grubu)

- **Durum:** Kabul edildi (2026-10-24, F1 S1)
- **Tarih:** 2026-10-24

## Bağlam
F1.2, tenant'ın ürün gruplarına göre farklı KDV oranları (ör. %20 / %10 / %1) ister. Fiyatlar tüketiciye KDV dahil gösterilir.

Medusa 2.21.2'de doğrulananlar (core-flows, tax-module-service @v2.21.2):
- **Vergi yapısı:** Vergi bölgesi (`country_code: tr`, provider `tp_system`) → oranlar → oran kuralları.
- **Kural hedefleri:** Kurallar yalnızca `product`, `product_type` ve `shipping_option`'a bağlanabilir. **Kategori hedeflenemez.**
- **Ürün tipi:** Bir ürünün tek bir tipi (product type) olur.
- **KDV dahil fiyat:** price preference ile yapılır (`is_tax_inclusive`, region veya currency bazında); region tercihi önceliklidir.
- **Provider izolasyonu (adr/0002):** Özel bir tax provider kategori veya attribute okumak için başka modülleri sorgulayamaz.

## Karar
- **Varsayılan oran:** Vergi bölgesi `tr`, varsayılan oran %20 (`KDV20`).
- **İndirimli oranlar:** Her biri için bir **ürün tipi** tanımlanır (`KDV %10`, `KDV %1`). Oranın kuralı `reference: product_type` ile o tipe bağlanır.
  - Tipsiz ürünler ve varsayılan oranda olanlar %20 alır.
- **İstisna ürünler:** `reference: product` kuralıyla tek tek atanır.
- **Kargo:** Kargo seçeneklerinin KDV'si `shipping_option` kuralıyla ayrıca tanımlanır (oran mali müşavirle doğrulanır).
- **Fiyat girişi:** TRY için `is_tax_inclusive: true`; hem store para birimi hem TR region tercihi. Fiyatlar admin'e KDV dahil girilir.
- **Ürün tipi rezerve:** Ürün tipi başka bir amaçla (filtre, şablon) **kullanılmaz**. Ürün sınıflandırması kategori ve attribute şablonlarıyla (F2) yapılır.
- **Kurulum:** Oranlar tenant bootstrap script'iyle kurulur (idempotent). Tenant'a özel oranlar admin'deki vergi ayarlarından düzenlenir.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **Ürün tipi = KDV grubu** | Medusa'nın yerleşik yolu; kod yok; admin'de görünür | Ürün tipi başka amaçla kullanılamaz |
| Ürün başına `product` kuralı | Esnek | Binlerce kural; yeni üründe unutulma riski |
| Özel tax provider (kategori/attribute'tan oran) | Kategoriye göre çalışır | Provider izolasyonu nedeniyle veriyi taşımak gerekir; bakım yükü; core davranıştan sapma |

## Sonuçlar
- **Admin UX:** Ürün formunda "KDV grubu" olarak ürün tipi alanı açıklanır (F12 i18n metni).
- **Raporlama:** KDV raporu (F11) oran koduna (`KDV20`/`KDV10`/`KDV1`) göre gruplar. E-fatura (F8) satır KDV'sini tax line'dan alır.
- **İleride:** Oranların mevzuatla değişmesi tek bir yerden (bootstrap + admin) güncellenir. Geçmiş siparişler kendi tax line'larını korur.

## Uygulama (F1 S1)
- `src/scripts/bootstrap-tenant.ts` → `src/scripts/bootstrap/` (region, store, tax). Yalnızca eksik kayıtları oluşturur; tenant'ın admin'de düzenlediği oranlara dokunmaz.
- Kargo KDV'si için ayrı `shipping_option` kuralı gerekmedi: kargo bölgenin varsayılan %20'sini alır, faturalar oranı kargo satırının kendi vergi satırından okur (2026-10-31 denetimi). Kapıda ödeme bedeli de mali müşavirin cevabıyla kargo satırına eklenir (ADR-0034 ek).
- Kanıt: `integration-tests/http/bootstrap-tenant.spec.ts` (iki çalıştırma, KDV dahil tax line).

## Ek (2026-11-04): Oranlar panelden yönetilir
Mağaza sahibinin kararı ("bence ekleyelim onu"): KDV oranları Ayarlar > Fatura ve muhasebe > **KDV oranları** sekmesinden eklenir, yeniden adlandırılır, kaldırılır, geri alınır; varsayılan oran değiştirilir. Model aynı kalır (oran = TR vergi bölgesinde `product_type` kuralıyla ürün tipine bağlı vergi oranı); ekran yalnızca bu yapıyı Medusa'nın kendi iş akışlarıyla yazar.

- **Uçlar:** `GET /admin/vat-rates` (her rol okur; bölge yoksa bootstrap gibi varsayılan KDV %20 ile kurulur), `POST /admin/vat-rates` (`{ rate, name?, code? }`; ad verilmezse "KDV %8,5", kod "KDV8_5", alınmışsa `_2`), `POST /admin/vat-rates/:id` (`{ name?, active? }`), `POST /admin/vat-rates/default` (`{ rate_id }`). Yazmak yalnızca sahibin (`vatRates` yetkisi, `/admin/platform-settings/accounting` gibi); ikinci doğrulama istenmez (para ya da veri mağazadan çıkmıyor). Her yazma denetim kaydında önce/sonra (`vat_rate`).
- **Ekleme:** Oranla aynı adda yeni ürün tipi + o tipe bağlı oran (`createProductTypesWorkflow`, `createTaxRatesWorkflow`). Kullanımdaki bir oranla aynı yüzde 409 `vat.rate_exists`; aynı ad 409 `vat.name_taken`; en çok 20 oran.
- **Yeniden adlandırma:** Oranın adı ve ürün tipinin adı birlikte (`updateTaxRatesWorkflow`, `updateProductTypesWorkflow`). Kod ve yüzde değişmez: yüzde değişecekse yeni oran eklenir, ürünler taşınır, eskisi kaldırılır (geçmiş siparişler kendi vergi satırını korur).
- **Kaldırma:** Vergi modülünde "pasif" alanı yok; kaldırma = oranın yumuşak silinmesi (`deleteTaxRatesWorkflow`; kuralları onunla silinir) ve ürün tipinin yumuşak silinmesi (`deleteProductTypesWorkflow`). Varsayılan oran (409 `vat.rate_is_default`) ve tipinde ürün olan oran (409 `vat.rate_in_use`, gövdede `count`) kaldırılmaz. Kaldırılan oran listede pasif görünür; `active: true` onu ve tipini aynı kimlikle geri getirir (`restoreTaxRates`, `restoreProductTypes`), aynı yüzdeyle kullanımda başka oran varken geri gelmez.
- **Varsayılan:** Bölgede tek varsayılan olabilir (benzersiz indeks), bu yüzden önce eski varsayılanın `is_default`'u kalkar, sonra yenisininki konur. Eski varsayılan tipsizse (bootstrap'ın KDV %20'si) adıyla bir ürün tipi açılır ve kuralı ona bağlanır; böylece seçilebilir bir oran olarak kalır. Yeni varsayılan kendi tipinin kuralını korur: tipi seçilmiş ürünler kuraldan, tipsizler varsayılandan aynı oranı alır.
- **Bootstrap:** Yeni mağazada üç oranı kurmaya devam eder; ama oranı **koduyla** tanır ve kaldırılmış (yumuşak silinmiş) kodları da sayar: mağazanın kaldırdığı, yeniden adlandırdığı ya da varsayılan yaptığı oranı ve tipini bir daha kurmaz; aynı yüzdeyi kendi oranıyla kullanan mağazaya da indirimli oranı eklemez. Ayrı bir "kaldırıldı" kaydı gerekmedi: vergi modülünün silinmiş satırı bu işi görür.
- **Kapatılan yollar:** Medusa'nın `/admin/tax-rates*`, `/admin/tax-regions*`, `/admin/product-types*` yazma uçları herkese kapalı (`REPLACED`): varsayılanı ya da ürünleri olan bir oranı korumasız silerlerdi. Ürün tipi okumak açık.
- **Panel:** Ürün formundaki KDV seçimi oranları bu uçtan okur ("Varsayılan (KDV %20)" bugünkü varsayılanla). Katalog tablosunda (içe/dışa aktarma) KDV sütunu yok; bugün oran ürün formundan seçilir (sütun ileride eklenecekse oran adı ya da yüzdesiyle eşlenir).
- **Kanıt:** `integration-tests/http/vat-rates.spec.ts`, `vat-rates-checkout.spec.ts` (yeni oranın sepette, siparişte ve fatura taslağında satır bazında uygulanması; varsayılan değişince tipsiz ürünün yeni orandan vergilenmesi), `src/lib/tax/__tests__/`.
