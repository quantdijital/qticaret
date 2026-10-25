# 17 — Yönetici Paneli Kullanılabilirliği

> Amaç: Paneli hiç admin paneli kullanmamış bir mağaza sahibinin de anlayacağı hâle getirmek.
> Açık bir başlangıç sayfası, sade Türkçe ve her ekranda "sıradaki adım".
> İlkeler [docs/06](06-admin-ux.md)'dadır; bu doküman 2026-10-25 denetimini, doğrulanan Medusa sınırlarını ve öncelikli işleri içerir.
> İlgili karar: [adr/0021](../adr/0021-yonetici-paneli-varsayilan-duzen-ve-cekirdek-metinler.md) (kabul edildi, 2026-10-25).

---

## 1. Özet

- **Sorun:** Girişten sonra panel boş bir Siparişler listesiyle açılıyor. Genel bakış ve "nereden başlarım?" cevabı yok. Çekirdek ekranlarda teknik terimler var ("Tamamlama", "Hizmet Bölgesi", "Geri siparişlere izin ver").
- **Bu dilimde yapılan:** "Başlangıç" sayfası (bölüm 6). Kurulum kontrol listesi, hızlı işlemler ve ürün sayıları.
- **Medusa'nın izin vermediği:** Girişten sonraki açılış sayfası değiştirilemiyor. Bizim menü öğelerimiz çekirdek öğelerin altında listeleniyor.
- **Medusa'nın izin verdiği ama henüz kullanmadığımız:** Menü sırası ve gizleme (sunucuda saklanan düzen tercihi) ve çekirdek Türkçe metinlerin ezilmesi. İkisi de karar ister (ADR-0021).

---

## 2. Doğrulanan genişletme noktaları (Medusa 2.21.2)

Kaynak: Context7 `/medusajs/medusa` ve v2.21.2 etiketindeki kaynak kod (`gh api`, `node_modules` okunmadı).
Kısaltma: `D/` = `packages/admin/dashboard/src/`.

| Soru | Cevap | Kaynak |
|---|---|---|
| Girişten sonra özel bir sayfa açılabilir mi? | **Hayır.** `/` rotası `navigate("/orders")` ile sabit yönlenir. Giriş formu `location.state?.from?.pathname \|\| "/orders"` kullanır. Ayar ya da genişletme noktası yok. Çekirdek `/` rotası uzantı rotalarından önce tanımlıdır. | `D/routes/home/home.tsx`, `D/routes/login/components/email-pass-login.tsx` (satır 30), `D/dashboard-app/routes/get-route.map.tsx` |
| Menüde özel öğe, `rank`, `nested` | `defineRouteConfig({ label, icon, nested, rank, translationNs })`. `rank` 2.11.4'ten beri var; yalnızca uzantı öğelerini kendi aralarında sıralar. `nested` yalnızca `/orders`, `/products`, `/inventory`, `/customers`, `/promotions`, `/price-lists` altına alt öğe ekler. | `admin-sdk/src/config/types.ts`, `admin-shared/src/extensions/routes/constants.ts`, Context7 ui-routes |
| Uzantı öğesi menüde nerede? | Çekirdek öğelerden (Siparişler … Fiyat Listeleri) **sonra**. `rank: 0` bile çekirdek öğelerin önüne geçmez. İkon verilmezse genel "eklenti" ikonu çıkar. | `D/components/layout/main-layout/main-layout.tsx` (`SidebarRoutes`), `D/dashboard-app/dashboard-app.tsx` (`populateMenus`) |
| Çekirdek menü öğeleri gizlenir/sıralanır mı? | **Kodla (SDK ile) hayır; düzen tercihiyle evet.** Menü bir `LayoutComposer`'dır. Kullanıcı "Kenar çubuğunu özelleştir" ile sürükleyip sıralar, gizler; "Herkes için kaydet" sistem varsayılanı yazar. | `main-layout.tsx`, `D/components/layout-composer/*`, `D/hooks/use-layout-preference.ts` |
| Düzen tercihi nerede saklanır? | `GET/POST/DELETE /admin/layouts/:zone/configuration` (2.17.2+), çekirdek settings modülü. Gövde: `{ is_default, configuration: { widgets: { [id]: { order?, hidden?, section? } } } }`. Ana menü bölgesi `sidebar` (kimlikler `core:Searchbar`, `core:nav:/orders`, `core:nav:/home` …). Ayarlar menüsü `settings.sidebar` (bölümler `general`, `developer`, `myAccount`, `extensions`). Sırası verilmeyen öğe `order: 0` alır. | `packages/medusa/src/api/admin/layouts/[zone]/configuration/{route,validators,middlewares}.ts`, `D/components/layout-composer/entries.ts` |
| `is_default` için yetki | Ayrı yetki kontrolü yok: oturum açmış her admin herkesin varsayılan menüsünü değiştirebilir. Yalnızca arayüz etkisi var; rol modeli gelince (F12.6) ele alınmalı. | aynı route ve middleware |
| `defineLayoutConfig` ne yapar? | `src/admin/layouts/` altında `LayoutComposer` için **sayfa düzeni** (bölümler) kaydeder. Menüyü ya da açılış sayfasını değiştirmez. `LayoutComposer` (2.16.0+) `@medusajs/dashboard/components`'tan gelir; özel bir sayfaya widget bölgesi ve kullanıcı sıralaması kazandırır. | Context7 admin-sdk AGENTS.md, `www/apps/resources/app/admin-components/layouts/layout-composer/page.mdx` |
| Liste sayfası widget bölgeleri | Yeni adlar: `order.list`, `product.list`, `customer.list`, `customer_group.list`, `inventory_item.list`, `price_list.list`, `promotion.list`, `campaign.list`, `region.list`, `location.list` (+ `location.list.side`), `product_category.list`, `product_collection.list`, `user.list`. Eski `.before`/`.after` adları hâlâ geçerli; düzende son ek yok sayılır. Diğer: `login.before/after`, `topbar`, `search.list`. **`home`/`dashboard` bölgesi yok.** | `admin-shared/src/extensions/widgets/constants.ts`, `dashboard-app.tsx` (`getWidgetsForSections`) |
| Çekirdek ekranlar Türkçe mi? | **Evet.** `tr` dil listesinde; 2446 anahtarın tamamı çevrili (eksik 0). Terimler sözlüğümüzle çelişiyor (bölüm 3.6). | `D/i18n/languages.ts`, `D/i18n/translations/tr.json` |
| Çekirdek metni ezebilir miyiz? | **Evet.** `populateI18n` çekirdek çevirilerin üstüne uzantı kaynaklarını `deepMerge` eder; aynı anahtarda bizimki kazanır. Medusa dokümanı da bunu örnekler (`actions.save`). Bizim kuralımız ise her anahtarı `qticaret.` altında tutar (`i18n/index.ts`, birim testi). Bu yüzden ezme kararı ADR-0021'e bırakıldı. | `dashboard-app.tsx`, `admin-shared/src/utils/deep-merge.ts`, Context7 translations |
| Önbellek | Dashboard sorguları 90 sn taze sayar. Bir ayarı tamamlayıp dönen kullanıcı eski durumu görmesin diye Başlangıç sorgularında `staleTime: 0` kullanılır. | `D/lib/query-client.ts` |
| Varsayılan mağaza adı | Mağaza modeli `"Medusa Store"` ile başlar; bootstrap adı değiştirmez. | `packages/modules/store/src/models/store.ts` |

**Yan bulgular (F12.6 için):** 2.21.2 dashboard'unda Roller/Politikalar ekranları var (RBAC, `MEDUSA_FF_RBAC`, varsayılan kapalı). Giriş akışında MFA adımı da var. F12.6 planı önce bunları değerlendirmeli.

---

## 3. Denetim: mağaza sahibinin yolculukları

Not: Tarayıcı kullanılmadı. Denetim çekirdek kaynak, Türkçe çeviri dosyası ve bizim kodumuz üzerinden yapıldı.
**B** = bizim değiştirebileceğimiz, **Ç** = çekirdek (yalnızca metin ezme, düzen tercihi ya da widget ile dolaylı).

### 3.1 İlk giriş
- Giriş ekranı ilk ziyarette Türkçeye geçer (bizim `default-language` widget'ı). Sorun yok.
- Açılış boş Siparişler listesi: "Siparişleriniz burada görünecektir." Ne yapılacağı söylenmiyor. **Ç** (yönlendirme sabit).
- Menüde 6 çekirdek alan var. Bizim sayfalarımız en altta, genel ikonla duruyor. **B** (ikon, Başlangıç), **Ç** (sıra: düzen tercihi).

### 3.2 Mağazayı kurmak
- Mağaza adı bootstrap'ten sonra "Medusa Store" kalıyor; kimse uyarmıyor. **B** (kontrol listesi, bootstrap/F17).
- Kargo kurulumu 4–5 kat derin: Ayarlar → Konumlar ve teslimat → konum oluştur → Teslimat → Hizmet Bölgesi → Kargo Seçeneği (+ Kargo Profili). "Hizmet Bölgesi", "Tamamlama sağlayıcısı" gibi terimler açıklamasız. **Ç** (ekran), **B** (yönlendirme metni, widget).
- Bölge ve vergi bootstrap'te hazır. "Bölgeler" ve "Vergi Bölgeleri" ayrı ekranlar; acemi ikisini karıştırır. **Ç**.
- Ödeme: yalnızca sistemin elle onay sağlayıcısı var; gerçek sağlayıcı F6'da. Kontrol listesinde adım olarak gösterilmez, yoksa yanlış "tamam" verir.

### 3.3 Ürün eklemek
- Ürün oluşturma 4 sekmeli: Detaylar / Organize Et / Varyantlar / Envanter Kitleri. **Ç**.
- Jargon: "Tanıtıcı", "İndirim Uygulanabilir", "Satış kanalları", "Kargo profili", "Envanteri yönet", "Geri siparişlere izin ver" (backorder), "Envanter seti var". **Ç** (metin ezilebilir).
- KDV oranı ürün tipiyle seçiliyor ("KDV %10" tipi, adr/0007). Formda bunu söyleyen hiçbir şey yok. **B** (widget ya da ipucu), sonrası için ayrı karar.
- Stok miktarı ürün formunda değil; Envanter ekranında konum bazında giriliyor. **Ç**.
- Özellik şablonu ve SEO, ürün kaydedildikten sonra detay sayfasındaki widget'larda. Acemi bunları görmeden çıkabilir. **B**.

### 3.4 Siparişleri görmek
- Liste anlaşılır. Detayda "Tamamlama durumu", "Ürünleri tahsis et", "Ödemeyi al" geçiyor; sözlüğümüz "Gönderi" diyor. **Ç** (metin ezme).
- Bizim API hatalarımız çekirdek ekranlarda ham anahtar görünebiliyor (`errors.too_many_requests`, PROGRESS'te kayıtlı). **Ç** (metin ezme ile düzelir).
- Sipariş listesi her açıldığında kişisel veri okuma kaydı düşer (adr/0011). Doğru davranıştır. Ancak Başlangıç'a sipariş sayısı koymak her ziyarette kayıt üretirdi (bölüm 4, P1-b).

### 3.5 Ayarlar
- Ayarlar menüsü dört bölümlü: Genel / Geliştirici / Hesabım / **Eklentiler**. SEO, Özellikler, Ürün özellikleri ve İşler "Eklentiler" altında; mağaza sahibi orada aramaz. **Ç** (düzen tercihi ile taşınabilir).
- Geliştirici öğeleri herkese açık: Yayınlanabilir/Gizli API Anahtarları, İş akışları, Arama. **Ç** (düzen tercihi ile gizlenebilir; adresle erişim sürer).
- Mağaza künyesi (unvan, VKN, MERSİS) ekranı yok (F13).

### 3.6 Çekirdek Türkçe ile sözlük çelişkileri
| İngilizce | Medusa Türkçesi | Sözlüğümüz / öneri |
|---|---|---|
| Fulfillment | Tamamlama (15 yer), Karşılama (2) | Gönderi |
| Allow backorders | Geri siparişlere izin ver | Stok bitince de satışa izin ver |
| Allocate items | Ürünleri tahsis et | Ürünleri stoktan ayır |
| Handle | Tanıtıcı / "Handle" (çevrilmemiş) | Adres (URL) kısaltması |
| Pickup | Alma | Mağazadan teslim |
| Inventory | Envanter | Stok |

---

## 4. Öncelikli değişiklikler

### P1 — hemen
- [x] **Başlangıç sayfası** (bu dilim, bölüm 6).
- [x] **P1-a Menüde en üste alma** (dilim 2: bootstrap varsayılan düzeni yazar). Kod ile yapılamıyordu; iki yol vardı:
  - Bugün, elle: Başlangıç'ı "Kenar çubuğunu özelleştir" ile sürükleyip en üste alın, "Herkes için kaydet" deyin.
  - Kalıcı: `tenant:bootstrap` `sidebar` bölgesine sistem varsayılanı yazar (`core:Searchbar` → `core:nav:/home` → çekirdek öğeler). Yalnızca varsayılan yoksa yazar, mağazanın seçimini ezmez. Backend işi; ADR-0021.
- [x] **P1-b Sipariş sayıları için özet ucu** (dilim 2): `GET /admin/home/summary`. Kargoya hazırlanmayı bekleyen, bugünkü sipariş sayısı, bugünkü satış. Düşük stok F3 T8'de eklenir.
  - Sunucuda hesaplanır (altın kural 5); kişisel veri döndürmez, bu yüzden okuma kaydı gerekmez.
  - Bir istekte gelir; F12.1 widget'ları da aynı ucu kullanır.
  - Alternatif: `/admin/orders`'a `["id"]` güvenli alan eklemek. Ama durum bazında birkaç istek ister ve ciroyu çözmez.
- [x] **P1-c Mağaza adı kurulumda** (dilim 2): `tenant:bootstrap --store-name="..."`; varsayılan adla kurulum yapılmaz. Provizyon (F17) adı sorup geçirir.

### P2 — sonraki dilimler
- [x] **Çekirdek metin düzeltmeleri** (dilim 2, ADR-0021): 119 metin sözlüğe göre ezildi. Bizim hata anahtarlarımız ise sunucuda cümleye çevrilir; çekirdek `error.message`'ı çevirmeden bastığı için metin ezme yetmez.
- [x] **Ayarlar menüsünü sadeleştirme** (dilim 2): bizim sayfalarımız "Genel"de. Geliştirici öğeleri mağaza sahibinden gizli; platform ekibi adresle erişir, gerçek yetki F12.6'da.
- **Ekran başı yardım şeritleri:** `product.list`, `order.list`, `location.list` bölgelerinde tek cümlelik "bu ekran ne işe yarar" ve Başlangıç'a dönüş bağlantısı. Kapatılabilir; tercih tarayıcıda tutulur.
- **KDV ipucu:** Ürün detayında, KDV oranının ürün tipinden geldiğini söyleyen widget. Ayrı bir KDV alanı ileride ayrıca kararlaştırılır.
- **Başlangıç'ta widget bölgesi:** `LayoutComposer` (`@medusajs/dashboard/components`) ile `qticaret.home` bölgesi. F12.1 kartları buraya eklenir, mağaza sahibi sıralayabilir. docs/06'daki "yalnızca @medusajs/ui" kuralına istisna olduğu için ADR'de anılır.
- **Playwright duman testi ve axe** (docs/06 kontrol listesi): Playwright altyapısı gelince Başlangıç için.

### P3 — sonraki fazlar
- Kurulum sihirbazı (F17 onboarding): ad, künye, ilk ürün, kargo; tek akışta.
- Tek ekranda kargo kurulumu (konum + hizmet bölgesi + seçenek): kargo sağlayıcı entegrasyonundan sonra.
- Sade ürün ekleme formu (kendi formumuz): büyük ve riskli; kullanıcı testinden sonra değerlendirilir.

---

## 5. Ne mümkün, ne değil

| İstek | Yol | Durum |
|---|---|---|
| Girişten sonra Başlangıç açılsın | Belgelenmiş yol yok. Giriş ekranına `state.from` yazmak çalışabilir ama belgelenmemiş bir iç ayrıntıya dayanır. | Yapılmadı; önerilmez |
| Başlangıç menüde ilk sırada | `rank` uzantılar arasında; tam başa almak düzen tercihiyle | Uzantılarda ilk (bu dilim); tam başa alma P1-a |
| Çekirdek öğeyi gizle/sırala | Düzen tercihi (`sidebar`, `settings.sidebar`) | P1-a / P2, ADR-0021 |
| Çekirdek Türkçe terimleri düzelt | Aynı anahtarı `translation` ad alanında vermek | P2, ADR-0021 |
| Liste sayfalarına yardım | Widget bölgeleri (`*.list`) | P2 |
| Sipariş/ciro sayıları | Yeni admin ucu (backend) | P1-b |
| Medusa çekirdeğini değiştirmek | — | Yasak (altın kural 2) |

---

## 6. Bu dilimde yapılan: Başlangıç sayfası

- **Yer:** `apps/backend/src/admin/routes/home/` (`/app/home`), menüde "Başlangıç", ev ikonu, `rank: 0`.
- **Bölümler** (her biri yükleniyor, boş ve hata durumlu; `components/page-states.tsx`):
  - Selamlama: "Merhaba {ad}". Ad yüklenemezse yalnızca "Merhaba".
  - **Mağazanızı satışa hazırlayın:** 6 adım, ilerleme çubuğu. İlk açık adım "Sıradaki adım" olarak işaretlenir ve ana düğmeyi alır. Hepsi bitince tek satır tebrik.
  - **Hızlı işlemler:** Ürün ekle, Siparişler, Ayarlar.
  - **Ürünleriniz:** Yayınlandı ve Taslak sayıları; ürün yoksa "ilk ürününüzü ekleyin".
- **Kontrol listesi kuralları** (`setup-steps.ts`, birim testli):

| Adım | Tamam sayılır | Okunan uç | Düğme |
|---|---|---|---|
| Mağaza adı | Ad boş değil ve "Medusa Store" değil | `GET /admin/stores` | Ayarlar → Mağaza |
| Para birimi | Varsayılan para birimi var | `GET /admin/stores` | Ayarlar → Mağaza |
| Satış ülkesi | En az bir bölge | `GET /admin/regions?limit=1&fields=id` | Ayarlar → Bölgeler |
| Gönderim adresi | En az bir stok konumu | `GET /admin/stock-locations?limit=1&fields=id` | Ayarlar → Konumlar |
| Kargo seçeneği | En az bir kargo seçeneği | `GET /admin/shipping-options?limit=1&fields=id` | Ayarlar → Konumlar |
| İlk ürün | En az bir yayınlanmış ürün | `GET /admin/products?status[]=published&limit=1&fields=id` | Ürün oluştur |

- **Bilerek dışarıda bırakılanlar:**
  - Sipariş ve müşteri sayıları: liste uçları her okumada denetim kaydı yazar (adr/0011). Bkz. P1-b.
  - Satış kanalı / yayınlanabilir anahtar: storefront bağlantısı platformun işidir (F17). Mağaza sahibine "API anahtarı" göstermek jargon olur.
  - Ödeme sağlayıcı: F6'ya kadar yalnızca elle onay sağlayıcısı var.
- **Bilinen sınır:** Yalnızca iade için tanımlanmış bir kargo seçeneği de "tamam" sayılır. Admin listesindeki `is_return` süzgecinin davranışı doğrulanmadığı için ayrım yapılmadı (nadir durum).
- **Bütçe:** Sayfa açılışında 8 hafif istek (sayım için 1 satır, yalnızca `id`); kişisel veri okunmaz.

---

## 7. Kararlar (proje sahibi, 2026-10-25)

1. Başlangıç her yeni mağazada menünün en üstünde: **evet** (bootstrap yazar).
2. Çekirdek Türkçe terimler sözlüğe göre: **değiştirilsin** (bölüm 3.6 ve `core-overrides/tr.json`).
3. Geliştirici ayarları: **mağaza sahibi görmesin** (menüde gizli).
4. Başlangıç sayıları: **önerilen**: kargoya hazırlanmayı bekleyen, bugünkü sipariş, bugünkü satış; düşük stok F3 T8 ile.
5. Mağaza adı: **kurulumda sorulsun**.
