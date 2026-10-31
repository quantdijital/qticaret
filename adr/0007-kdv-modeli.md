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
