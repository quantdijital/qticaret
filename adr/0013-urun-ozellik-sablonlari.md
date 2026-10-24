# ADR-0013: Ürün özellik şablonları (`product-attributes`) veri modeli

- **Durum:** Kabul edildi (2026-10-24, kullanıcı onayı; uygulama F2 S8–S13)
- **Tarih:** 2026-10-24

## Bağlam
Sektörel ürün bilgisi (ör. malzeme, ölçü, beden) koda değil, tenant'ın tanımladığı **şablonlara** dayanır (docs/01).
F2.4 şunları ister:
- **Alan tanımları:** tip, birim, zorunluluk, filtrelenebilirlik, "SEO'da öne çıkar" ve `variesBy` eşlemesi
- **Bağlantı:** ürün ↔ değer link'i
- **Arayüz:** ürün detayında admin widget'ı, Store API'de ürünle birlikte dönen değerler

Sonraki kullanıcılar:
- F3.4 başlık şablonundaki `{öne_çıkan_attribute}` token'ı
- F3.12 JSON-LD `variesBy` (yalnızca color, size, suggestedAge, suggestedGender, material, pattern)
- F3.17/F18 facet filtreleri
- F3.9 içe aktarma

adr/0007 gereği ürün tipi KDV grubuna ayrılmıştır; sınıflandırma için kullanılamaz.

Medusa 2.21.2'de doğrulananlar (F2 planlaması):
- **Link:** `defineLink(Product.linkable.product, { linkable, isList: true, deleteCascade: true })`. Link tablosuna ek kolon eklenebilir.
- **Store API:** `allowed` listesi zorunlu. Bağlı veri `allowFields(...)` middleware'iyle açılır; her iç yol ayrı yazılır. Middleware `methods` olmadan tanımlanmalıdır.
- **Admin API:** `/admin/products` için `allowed` kısıtı yok.
- **Ürün route'ları:** Core route'lar `additional_data` taşır (`additionalDataValidator` + `productsCreated` / `productsUpdated` hook'ları). Ancak admin'in ürün formu bu alanı göndermez.

## Karar
- **Modül:** `product-attributes`.
  - **`attribute_template`:** `name`, `handle` (unique), `description`.
  - **`attribute_definition`:** Şablona `belongsTo` ile bağlıdır. Alanlar:
    - `key` (şablon içinde unique), `label`
    - `type`: `text` | `number` | `boolean` | `select` | `multi_select`
    - `unit`, `options` (jsonb `{ value, label }[]`), `rank`
    - `is_required`, `is_filterable`, `is_seo_highlight`
    - `scope`: `product` | `variant`
    - `varies_by`: Google'ın altı değerinden biri veya boş
  - **`attribute_value`:** Tanıma `belongsTo` ile bağlıdır. Değer tipli kolonlarda tutulur: `value_text`, `value_number` (numeric), `value_boolean`, `value_options` (jsonb).
- **Link'ler:**
  - ürün ↔ şablon: tek şablon, `isList: false`
  - ürün ↔ değer: `isList: true`, `deleteCascade: true`
  - (ürün, tanım) tekilliği, ürün başına kilitli upsert workflow'uyla sağlanır.
- **Varyant düzeyi özellikler:** Değerleri Medusa'nın ürün seçeneklerinde (product option) kalır. `scope: variant` tanımı hangi seçeneğe karşılık geldiğini (`option_title`) ve `varies_by` değerini taşır. Bu tabloda varyant değeri tutulmaz.
- **Doğrulama:** Değer seti, şablon tanımlarından üretilen bir Zod şemasıyla workflow içinde doğrulanır. Kontroller: zorunluluk, tip, `select` için seçenek listesi.
  - Değeri olan bir tanımın tipi değiştirilemez.
  - Tanım silinirse değerleri onayla birlikte soft-delete edilir.
- **API:**
  - Şablon CRUD: `/admin/attribute-templates`
  - Ürün değerleri: `GET/POST /admin/products/:id/attributes`
  - **Store:** `/store/products` ve `/store/products/:id` için `allowFields` ile `attribute_values` ve tanım alanları (`label`, `unit`, `key`, `is_seo_highlight`) açılır.
  - `additional_data` hook'u F3.9 içe aktarmada eklenir.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **Tipli EAV satırları + link** | Facet sorguları indekslenebilir (tanım + değer); tip güvenli; Medusa link deseni | Ürün başına çok satır; tekillik workflow'da |
| Ürün başına tek jsonb belge | Okuma basit | Sayısal aralık filtresi için anahtar başına ifade indeksi gerekir; şema kayması |
| Ürün `metadata`'sı | Kod yok | Tip, doğrulama, filtre ve denetim yok |
| Ürün tipi veya etiketleri | Core alan | Ürün tipi KDV'ye ayrılmış (adr/0007); etiketler tipsiz |

## Sonuçlar
- Şablon yönetim ekranının ilk sürümü F2'de gelir. F12.4 bunu ayar ekranları arasında düzenler.
- Facet sorguları (F3.17) için gereken indeksler: `(definition_id, value_number)`, `(definition_id, value_text)` ve `value_options` üzerinde GIN. Bunlar S11 migration'ında oluşturulur.
- Store API sözleşmesi F18 öncesi `packages/types`'a taşınır.
