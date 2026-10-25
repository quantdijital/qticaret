# ADR-0015: SEO alanlarının saklanması ve Store API `seo` payload'u

- **Durum:** Önerildi (F3.4; kullanıcı kararı bekliyor)
- **Tarih:** 2026-10-25

## Bağlam

docs/13 §1 ve §3 şunları ister:

- Ürün, kategori, marka, koleksiyon, içerik sayfası, blog yazısı ve facet landing için aynı alanlar: `seo_title`, `seo_description`, `canonical_override`, `robots_override`, `og_image_override`, `focus_keyword`.
- Boş alanlar tenant şablonundan üretilir; mağaza genelinde başlık ve açıklama benzersizliği denetlenir.
- Store API her sayfa türü için hazır bir `seo` nesnesi döner (mutlak canonical, robots, OG, breadcrumb, JSON-LD); tema kendi SEO mantığını yazmaz.

Medusa 2.21.2'de doğrulananlar:

- **Çekirdek modele kolon eklenemez.** Modüller izole; yol özel modül + `defineLink`'tir.
- **Admin ürün formu `additional_data` göndermiyor.** Özel form alanı API'si admin-sdk 2.21.2'de dışa açık değil. Ürün kategorisi route'ları `additional_data` hiç kabul etmiyor.
- **Core route yanıtını middleware ile dönüştürmek belgelenmemiş.** Doküman yanıt biçimi için route'u kopyalamayı öneriyor.
- **İçe aktarma bilinmeyen sütunu reddediyor.** SEO sütunları Medusa'nın ürün CSV'sine eklenemez (F3.9 kendi şablonunu kullanır, adr/0018).
- **Hazır:** `metadata` JSON alanı her çekirdek varlıkta var. Ancak Medusa'nın kendi route'ları onu doğrulamadan yazar; Store yanıtına da çıkabilir (varsayılan alan listesi T2 planında doğrulanır).

Elimizde olanlar (F2):

- `lib/seo`: şablon, piksel genişliği, slug.
- `url-registry`: yol sahipliği.
- `platform-settings` `seo` bölümü: canonical host, URL stili, başlık ve açıklama şablonları.
- Denetim kaydı (adr/0011) ve link deseni (adr/0013).

## Karar (öneri)

- **Modül `seo-meta`, tek tablo `seo_meta`:**
  - Alanlar:
    - `entity_type`: `product` | `category` | `collection` | `brand` | `page` | `post` | `landing`
    - `seo_title`, `seo_description`, `focus_keyword`
    - `canonical_override`: yalnızca site içi yol
    - `robots_override`: üç değerli enum
    - `og_image_override`: yalnızca kendi medya kütüphanemizden dosya; alt metniyle
    - `title_hash`, `description_hash`: normalize edilmiş, indeksli
  - Çekirdek varlıklara link: ürün, kategori, koleksiyon (`isList: false`, `deleteCascade`). Marka ve içerik modülleri de aynı tabloya link'lenir.
  - `entity_type` kolonu advisor ve denetim işinin tek tabloyu taramasını sağlar.
- **Ham override'lar Store'a çıkmaz.**
  - `focus_keyword` iç pazarlama verisidir; rakibe açılmamalı.
  - `seo_meta` için Store `allowFields` listesine ekleme yapılmaz; storefront yalnızca çözülmüş payload'u kullanır.
- **Yazma yolu:**
  - `PUT /admin/seo/:entity_type/:entity_id` → `upsertSeoMetaWorkflow` (doğrula → upsert → link).
  - Ürün, kategori ve marka sayfalarında admin widget'ı; F2.4'teki `/admin/products/:id/attributes` deseni.
  - Metin alanları `isCleanText` ve uzunluk tavanından geçer: başlık 150, açıklama 320, anahtar kelime 100.
  - Uzunluk hedefleri (30–60, 70–155) reddetmez; advisor uyarır.
  - Mutasyonlar denetim kaydına önce/sonra farkıyla girer.
- **Benzersizlik:**
  - Kayıtta override hash'i aynı türde başka kayıtla çakışıyorsa yanıt bir uyarı taşır, kayıt reddedilmez.
  - Şablondan üretilen değerlerin mağaza geneli karşılaştırması F3.14 denetim işinde yapılır.
- **Çözülmüş payload:** `lib/seo/resolve` saf fonksiyonu; girdi varlık, override, ayarlar ve birincil kategori zinciri.
  - Başlık ve açıklama: override ya da şablon.
  - Canonical: `https://{canonical_host}` + (override ya da registry'deki aktif yol).
  - Robots: override ya da türetilmiş değer (taslak, halef, kısıtlı kategori).
  - OG: override ya da ana görselin 1200×630 türevi (adr/0016).
  - Breadcrumb: birincil kategoriden.
  - JSON-LD: F3.12 üretici. `hreflang` F19'a kadar boş.
- **Store ucu:** `GET /store/seo/resolve?path=` (adr/0017) varlık bulduğunda `{ kind: "entity", entity: { type, id, handle }, seo }` döner.
  - Storefront tek çağrıyla hem yönlendirmeyi hem SEO'yu alır.
  - Yanıt versioned cache'te tutulur (F2 S9 deseni). Varlık olayları, SEO ayar sürümü ve fiyat değişimi işareti değiştirir.

## Alternatifler

| Seçenek                                          | Artı                                                                     | Eksi                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **`seo-meta` modülü + link'ler**                 | Belgelenmiş desen (adr/0013 gibi); doğrulama ve denetim bizde; tek tablo | Varlık türü başına bir link tablosu; çekirdek formda alan yok, widget gerekir          |
| Çekirdek `metadata` JSON'u                       | Kod az; Medusa içe aktarmasıyla taşınır                                  | Core route'lar doğrulamasız yazar; Store yanıtına çıkabilir (`focus_keyword`); indeks yok |
| (entity_type, entity_id) tablosu, link'siz       | url-registry ile aynı; tür bağımsız                                      | Query graph'tan çekilemez; silme temizliği subscriber ister                            |
| Core Store route'larını kopyalayıp `seo` eklemek | Tek istekte ürün + seo                                                   | Medusa yükseltmelerinde kopya bakımı; sorgu ve fiyat bağlamı çoğalır                   |

## Sonuçlar

- **İlk HTML garantisi:** Storefront (F18) sayfa başına bir `resolve` ve bir içerik çağrısı yapar.
- **Fiyat cümlesi ve `Offer` bölge/para birimine bağlıdır:** Cache anahtarı bölgeyi içerir; TR tek bölgeyle başlar.
- **Açık soru, canonical host boşken mutlak URL:** `canonical_host` null olabilir. Platform alt alan adı (`<slug>.<platform-domain>`) instance yapılandırmasından gelmeli (F16/F17). O zamana kadar resolve `canonical_host` ister; boşsa SEO ayarlarında uyarı gösterilir.
- **Varyantı ayrı sayfa yap (docs/13 §2.3):** Bu bayrak gelirse `entity_type: variant_group` eklenir.
- **Doğrulanacak, T2 planında:** link'li bir tabloya `deleteCascade` ile kategori ve koleksiyon silmede kayıt temizliği ve `entity_type` kolonunun link'le tutarlılığı (Zod + workflow).
