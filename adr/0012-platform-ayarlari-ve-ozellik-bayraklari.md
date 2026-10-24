# ADR-0012: Platform ayarları ve özellik bayrakları (`platform-settings`)

- **Durum:** Önerildi (F2 S9'da karara bağlanacak)
- **Tarih:** 2026-10-24

## Bağlam
Sektörden bağımsızlık bayrak ve şablonlarla sağlanır (docs/01): kod sektör adı kontrol etmez, yalnızca bayrak okur.
F2.3 mağaza ayarlarını, özellik bayraklarını ve SEO ayarlarını (canonical host, URL desenleri, başlık şablonları, robots) tek modülde ister. **Secret yoktur** (adr/0002).
KK: "Feature flag kapalıyken ilgili endpoint/akış devreye girmiyor (testli)".
F17'de paketler bazı özellikleri platform tarafında açıp kapatacak.

Medusa 2.21.2'de doğrulananlar (F2 planlaması):
- **Medusa'nın kendi bayrakları:** `featureFlags` / `MEDUSA_FF_*` yalnızca Medusa'nın kendi yetenekleri içindir (ör. `caching`, translation). Tenant bayraklarıyla karıştırılmaz.
- **Caching modülü:** `Modules.CACHING`, `get/set/clear`, tag desteği var.
  - Medusa bayrağı (`caching`) ve en az bir provider olmadan açılmaz.
  - Dev ve CI'da Redis yok.
- **Redis event bus:** BullMQ kuyruğudur; her event'i **tek** bir süreç işler. Event ile cache temizlemek tüm süreçlere ulaşmaz.

## Karar
- **Bayrak kayıt defteri kodda:** `as const` bir nesnede tutulur. Her bayrağın şu alanları vardır:
  - `key`
  - varsayılan değer
  - i18n etiket/açıklama anahtarı
  - `owner`: `tenant` (admin'den değişir) veya `platform` (provisioning/env'den gelir, admin'de salt-okunur; F17 paketleri bunu kullanır)
  - DB yalnızca tenant'ın **farklılaştırdığı** değerleri tutar. Kayıt defterinde olmayan anahtar yazılamaz.
- **Ayarlar bölümlere ayrılır:** `store` ve `seo` ile başlanır, F13'te `legal_info` (künye) eklenir.
  - Her bölüm kodda bir **strict Zod şemasıyla** tanımlanır. DB'de bölüm başına bir satır (jsonb, `version`, `updated_by`) bulunur.
  - Serbest anahtar/değer yoktur, bu yüzden secret alanı tanımlanamaz.
  - SEO şablonları kaydedilirken `lib/seo` şablon motoruyla doğrulanır; bilinmeyen token reddedilir.
- **Okuma ve cache:**
  - Süreç içi cache kullanılır.
  - Yazma işlemi Redis'te bir sürüm sayacını artırır (`INCR`). Her süreç sayacı en çok saniyede bir okur ve değiştiyse yeniden yükler.
  - Redis yoksa (yalnız dev/test, tek süreç) yazan süreç cache'i doğrudan temizler.
  - Caching modülü F16'da Redis modülleriyle birlikte yeniden değerlendirilir.
- **Uygulama noktaları:**
  - **Route'lar:** `requireFeature(key)` middleware'i. Bayrak kapalıysa yanıt **404**'tür; uç yokmuş gibi davranır, varlığını sızdırmaz.
  - **Workflow:** `assertFeatureEnabledStep(key)` ilk adımdır.
  - **Subscriber ve job:** Bayrak kapalıysa hiçbir şey yapmadan çıkar.
  - **Admin:** Widget ve sayfalar bayrak kapalıysa gizlenir. Bu yalnız kullanılabilirlik içindir; asıl koruma API'dedir.
- **API:**
  - `GET/POST /admin/platform-settings/:section`
  - `GET /admin/features`, `POST /admin/features/:key`
  - Mutasyonlar workflow'dan geçer ve denetim kaydına (adr/0011) önce/sonra özetiyle düşer.
  - Store tarafına ayar açan uç F2'de **yok**. Storefront'un ihtiyacı F18'de açık bir alan listesiyle eklenir.

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| **Kodda kayıt defteri + DB'de farklar + bölüm şemaları** | Tip güvenli; secret yazılamaz; yeni bayrak kod incelemesinden geçer | Yeni bayrak deploy gerektirir |
| Serbest anahtar/değer tablosu | Esnek | Yazım hatası sessizce kapalı bayrak demek; secret girilebilir |
| Medusa store `metadata`'sı | Tablo gerekmez | Tip ve doğrulama yok; denetim kaydı zor |
| Medusa caching modülüyle cache | Hazır invalidation | Medusa bayrağı + Redis provider gerekir; dev/CI'da Redis yok |

## Sonuçlar
- İlk sürümde kayıt defterinde iş bayrağı yok. Her faz kendi bayraklarını ekler (ör. `cash_on_delivery` F6, `seo_publish_gate` F3.13, fiziksel olmayan ürün F3.2). KK testi bir test bayrağıyla yapılır.
- F12.4 ayar ekranlarını genişletir. F17'de `owner: platform` bayraklarının değeri control plane'den gelir.
