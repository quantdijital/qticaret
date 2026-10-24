# ADR-0011: Denetim kaydı (audit log) modeli

- **Durum:** Kabul edildi (2026-10-24, kullanıcı onayı; uygulama F2 S8–S13)
- **Tarih:** 2026-10-24

## Bağlam
docs/04 iki tür kayıt ister: admin mutasyonları (kim, ne, ne zaman, önce/sonra özeti) ve hassas veri **okuma** kayıtları (TCKN/adres görüntüleme, dışa aktarma).
F2 KK'ları: "Ürün fiyatı değişikliği audit log'da görünüyor" ve "Müşteri TCKN görüntüleme okuma kaydı düşüyor". adr/0009, tam vergi kimliğini göstermeyi bu kayda bağlar.

Medusa 2.21.2'de doğrulananlar (F2 planlaması):
- **Yerleşik kayıt yok:** Core'da genel bir audit veya activity log yok. Yalnızca siparişe özgü `order_change` var.
- **Event'ler yetersiz:** Payload yalnızca `{ id }` taşır, actor bilgisi yoktur. Workflow context'inde de actor yok.
- **Fiyat değişimi:** Güvenilir bir event yok.
  - `updateProductVariantsWorkflow` `product-variant.updated` yayar.
  - `POST /admin/products/:id` içindeki `upsertVariantPricesWorkflow` 2.21.2 kaynağında event yaymaz.
  - Pricing modülünün kendi event'leri "internal" ve sürümler arasında değişebilir.
- **Actor HTTP katmanında:** Admin auth, `middlewares.ts`'teki her şeyden önce çalışır. `req.auth_context` session/JWT için `actor_type: "user"`, secret API key için `"api-key"` taşır.

## Karar
- **Ayrı modül:** `audit-log` modülü, `audit_entry` tablosu.
  - Alanlar: `kind` (`mutation` | `sensitive_read` | `system`), `actor_type`, `actor_id`, `action` (HTTP method + route deseni), `resource_type`, `resource_id`, `outcome` (status kodu), `changes` (jsonb), `request_id`, `ip`, `user_agent`, `created_at`.
  - İndeksler: `(resource_type, resource_id)`, `actor_id`, `created_at`.
  - Servis yalnızca ekleme ve listeleme sunar. Güncelleme ve silme route'u yoktur; DB seviyesinde UPDATE/DELETE yetkisi kaldırma F16'da (ayrı DB kullanıcıları).
- **Mutasyonlar HTTP sınırında yakalanır:**
  - `/admin/*` üzerinde POST/PUT/PATCH/DELETE için global middleware. Yanıt bittiğinde (`finish`) kayıt yazar: actor, route deseni, parametrelerdeki kimlikler, sonuç.
  - **Önce/sonra özeti** bir "denetlenen kaynak" kayıt defteriyle üretilir. Her giriş route desenini, `query.graph` alan listesini ve hassas alanları tanımlar. Middleware işlemden önce ve sonra aynı alanları okur, alan bazında farkı `changes`'e yazar.
  - İlk girişler: varyant fiyatları (`/admin/products/:id`, `/admin/products/:id/variants/:variant_id`, varyant batch, price list fiyatları), platform ayarları, attribute değerleri.
  - Kayıt defterinde olmayan route'lar için yalnızca gövdedeki **alan adları** yazılır, değerler yazılmaz.
  - Hassas alanların değeri yazılmaz; "değişti" bilgisi ve maskeli son hali (`last4`) yazılır.
- **Hassas okuma:**
  - `auditSensitiveRead(resource)` middleware'i şu route'larda kullanılır:
    - `GET /admin/customers/:id/billing-profile`
    - `GET /admin/customers/:id` (adresler)
    - `GET /admin/customers/:id/addresses*`
    - `GET /admin/orders/:id` (teslimat/fatura adresi)
    - dışa aktarma işleri (F2.8)
  - Okuma kaydı yanıt gönderilmeden **önce** yazılır. Yazılamazsa istek 503 ile reddedilir (fail closed).
  - Mutasyon kaydı yanıttan sonra yazılır. Hata olursa loglanır ve metrik artar; yanıt zaten gitmiş olur.
  - Tam TCKN gösterme endpoint'i yetkiyle birlikte F12'de gelir ve aynı yardımcıyı kullanır.
- **HTTP dışı işler:** Script, job ve subscriber'lar actor taşımaz. Anlamlı otomatik işler (otomatik 301, iş çalıştırma, saklama süresi silmesi) workflow içinde `recordAuditEntryStep` ile `kind: system` olarak yazılır.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **HTTP middleware + kaynak kayıt defteri** | Actor kesin; core route'ları kapsar; fiyat event'ine bağımlı değil | Önce/sonra için iki ek okuma; HTTP dışı değişiklikler ayrıca yazılmalı |
| Event subscriber | Basit, Medusa'nın önerdiği | Actor yok; fiyat değişimi için güvenilir event yok; önce hali yok |
| Workflow hook'ları | İş mantığına yakın | Her core workflow'da hook yok; actor workflow'a taşınmıyor |
| Postgres trigger + tablo geçmişi | Her yazımı yakalar | Actor yok; Medusa şemasına bağımlı; migration'larla kırılgan |

## Sonuçlar
- IP ve user agent kişisel veridir. Saklama süresi (öneri: 2 yıl) KVKK danışmanıyla belirlenir (docs/12). Silme/anonimleştirme job'u F13'te yazılır.
- Görüntüleyici ekran F12.5'te. F2'de yalnızca admin list API'si (`GET /admin/audit-log`, filtreli, sayfalı) var.
- Yeni bir hassas route ekleyen her faz, kaynağını kayıt defterine ekler. code-reviewer kontrol listesine eklenir.
