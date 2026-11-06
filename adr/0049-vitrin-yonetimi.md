# ADR-0049: Vitrin yönetimi: tema düzenleyici ve menüler

- **Durum:** Kabul (2026-11-02). Kullanıcı planı ve dört kararı onayladı: "önerilerine uyuyorum".
- **Tarih:** 2026-11-02
- **İlgili:** adr/0046 (vitrin ve tema sözleşmesi), adr/0048 (mağaza bilgileri tek kaynak), adr/0019 (içerik belgesi), adr/0016 (medya), adr/0040 (personel rolleri)

## Bağlam

Kullanıcı: "storefront'un bütün içeriği paneldeki verilerden gelmeli statik hardcoded bir kodlama yapısı olmamalı … Vitrin sekmesine gel ux/ui açısından yönetilebilir bir yapı kuracağız. böyle aşağı doğru dolan bir yapı kurulmaz … profesyonel bir yapı olmalı müşteriye kolay olmalı."

Bugün vitrinin çerçevesi Ayarlar > Vitrin'de alt alta on kartla yönetiliyor. Menü, üst bağlantılar ve alt bilgi sütunları elle yazılmış adreslerden oluşuyor; kategori adresi değişince bağlantı eskiyor. Ana sayfanın düzeni ise kodda sabit.

## Karar

1. **Kenar menüsünde "Vitrin" grubu.**
   - Tema düzenleyici.
   - Menüler.
   - Sayfalar ve blog: bugünkü İçerik ekranı buraya taşınır.
   - Vitrin tercihleri: renk örnekleri, iletişim formu sayfası gibi görsel olmayan ayarlar.

   Ayarlar > Vitrin, içeriği bu ekranlara dağıldıkça kalkar.

2. **Tema düzenleyici (kullanıcı kararları 1–3).**
   - Panelin içinde **tam ekran** açılır.
   - Solda sayfanın bölüm ağacı var: üst bilgi, sayfa bölümleri, alt bilgi. Ayrıca tema ayarları ve metinler.
   - Ortada vitrinin kendisi **canlı önizlemede** açılır: imzalı taslak bağlantısı, çerçeve içinde. Vitrin yalnız önizleme sayfasında panelin kökenine `frame-ancestors` izni verir.
   - Değişiklikler **taslağa kendiliğinden kaydedilir**. Ziyaretçi yalnız "Yayınla"dan sonra görür. Her yayın sürüm olarak tutulur ve eski sürüm taslağa geri alınır.
   - Bölüm modeli `storefront-layout` modülündedir: yuva başına taslak, yayın ve sürümler. Başlangıç çalışması `git stash` içinde ("wip: storefront layout module").
   - Bölüm türleri sektörden bağımsızdır. Görseller yalnız medya kütüphanesinden gelir. Panelden HTML, CSS ya da JavaScript yazılmaz.
3. **Menüler: `storefront-menus` modülü.**
   - **Menü:** başlık, yer (`main` başlık menüsü, `top` üst bağlantılar, `footer` alt bilgi sütunu) ve sıra. `main` ve `top` birer tanedir.
   - **Bağlantı:** sıra, isteğe bağlı ad ve hedef. Hedef türleri:
     - **Kayıt:** kategori, ürün, koleksiyon, marka, sayfa, yazı, filtre sayfası. Bunların adı ve adresi kaydın kendisinden ve adres kaydından (url registry) gelir; adres değişse de menü kırılmaz.
     - **Yasal metin:** yayımlanmışsa görünür.
     - **Sistem sayfası:** ana sayfa, tüm ürünler, blog, yorumlar, sepet, hesabım, siparişimi bul. Adresleri vitrinindir.
     - **Dış adres:** https ya da mağaza yolu.
   - Başlık menüsünde bir alt düzey vardır; diğer menüler düzdür.
   - **Çözümleme backend'de:** `GET /store/storefront-menus` yayında olmayan ya da silinmiş hedefi göstermez. Panelin uçları aynı çözümlemeyle bağlantıyı "kırık" diye işaretler.
   - **Taşıma:** Ayarlar > Vitrin'deki `menu`, `top_links` ve `footer_groups`, `storefront-menus-from-settings` göç betiğiyle bir kez menülere taşınır. Mağaza yolu adres kaydında bulunursa kayıt bağlantısı olur, bulunamazsa dış adres kalır. Ayar alanları kalkar.
   - Menü kaydı hemen yayına gider (Shopify'daki gibi); vitrin paylaşılan önbelleğiyle en geç 60 sn'de yansır.
   - Boş başlık menüsünde vitrin kategori ağacını gösterir; boş alt bilgide kategoriler ve yardım sütunu çıkar (bugünkü davranış).
4. **Sürükle-bırak yeni bağımlılık eklemeden.** Tarayıcının kendi sürükle-bırakı kullanılır; her satırda klavyeyle taşıma düğmeleri (yukarı, aşağı, içe, dışa) bulunur. WCAG 2.2 "Dragging Movements" (2.5.7) tek işaretçi alternatifi ister.
5. **Yetki.** Yazma `owner` ve `admin`'de (sabit roller, adr/0040); her yazma denetim kaydında (`auditMutations`).
6. **Sıra.**
   1. Menüler.
   2. Düzenleyici iskeleti: ana sayfa bölümleri, üst ve alt bilgi grupları, taslak, yayın, önizleme.
   3. Diğer sayfa şablonlarının bölümleri.
   4. Tema ayarları (D11) ve metin geçersiz kılma.

## Alternatifler

| Seçenek                                              | Artı                                                             | Eksi                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| **Tam ekran düzenleyici + canlı önizleme (seçilen)** | Mağaza sahibinin bildiği desen; ne değiştiğini görerek düzenleme | Önizleme için çerçeve izni ve taslak bağlantısı         |
| Ayar formları + "önizle" bağlantısı                  | Az kod                                                           | Kullanıcının reddettiği alt alta kart yığını            |
| Menüde elle adres (bugünkü)                          | Basit                                                            | Adres değişince kırılır; yazım hatası                   |
| dnd-kit gibi kütüphane                               | Hazır erişilebilir sürükleme                                     | Yeni bağımlılık; tek ekran için yerli sürükleme yetiyor |

## Sonuçlar

- **Backend:** `modules/storefront-menus`, `workflows/storefront/menus*.ts`, `api/admin/storefront-menus`, `api/store/storefront-menus` ve göç betiği. `storefront` ayar bölümünden `menu`, `top_links` ve `footer_groups` çıkar.
- **Vitrin:** çerçeve menüleri yeni uçtan okur.
- **Panel:** "Vitrin" grubu, Menüler ekranı; İçerik grubun altına taşınır.
- **Mağaza profili biçimi:** `menus` alanı eklenir (bağlantılar `href` ile yazılır, yükleyici kayda çevirir).

## Ek (2026-11-02): tema düzenleyicinin belgesi ve uçları

- **Tek belge.** `storefront-layout` modülünde mağaza başına bir kayıt var:
  - `draft`: düzenleyicinin taslağı;
  - `published`: ziyaretçinin gördüğü;
  - `revision` ve `published_at`.

  Belge üç grup içerir: `header`, `home` ve `footer`. Yayın üçünü birlikte alır (Shopify'daki gibi tema bir bütün olarak yayınlanır). Her yayın `storefront_layout_revision`'a yazılır, son 20'si tutulur.
- **Bölüm türleri** (`lib/storefront/layout.ts`). Her bölümde kimlik, görünürlük, başlangıç ve bitiş vardır.
  - Üst bilgi: `announcement_bar`.
  - Ana sayfa:
    - `hero`: isteğe bağlı görsel, en çok iki düğme.
    - `banner`: 1–6 görsel, her biri başlık, satır ve bağlantıyla.
    - `categories`: seçilenler, yoksa üst kategoriler.
    - `products`: kaynak en yeni, kategori, koleksiyon ya da elle seçim; adet ve "tümü" bağlantısı.
    - `brands`.
    - `posts` ve `reviews`: adetleriyle.
    - `rich_text`: içerik belgesi, adr/0019.
    - `trust_badges`, `newsletter`, `help`.
  - Alt bilgi: `newsletter`. Yoksa alt bilgide bülten kutusu çıkmaz.
  - Başlığı boş bir bölümde vitrinin varsayılan sözü kullanılır. Metinler `{belirteç}` alabilir (adr/0048). Düğme ve görsel bağlantıları menülerin kayda bağlı bağlantı yapısını kullanır (`storefrontLink`).
- **Kayıtta denetim (`checkLayout`).**
  - Seçilen kategori, ürün, koleksiyon ve marka kayıtları var mı (taslakta olan kabul edilir, yayına girince görünür).
  - Görseller mağazanın yüklemeleri mi; gece süpürmesinden korunmaları için "bağlı" işaretlenir.
  - Zengin metindeki kartlar var mı, değişkenler tanınıyor mu.
  - Bölüm kimlikleri tekil mi, duyuru şeridi ve bülten birer tane mi, bitiş başlangıçtan sonra mı.
- **Varsayılan belge** (`defaultLayout`): hiç kayıt yokken bugünkü vitrin; duyurular ve giriş metni `storefront` ayarlarından. Vitrin bunu gösterir, düzenleyici ilk taslak olarak açar.
- **Uçlar.**
  - Panel:
    - `GET /admin/storefront-layout`;
    - `POST /admin/storefront-layout` (taslak, `{ document }`);
    - `POST …/publish`, `…/discard`, `…/revisions/:n/restore`, `…/preview`.

    Gövdesizler boş, katı şemayla doğrulanır.
  - Vitrin: `GET /store/storefront-layout` yayındaki belgeyi o anki zamana göre süzer, bağlantıları çözer, görsellere boyut ve türev ekler, zengin metni HTML'e çevirir, değişkenleri doldurur.
  - `GET /store/storefront-layout/preview/:token` taslağı aynı biçimde verir.
- **Önizleme.**
  - İçerik önizlemesinin imzası genelleşti (`previewSigner`); düzenin bağlamı ayrı (`layout-preview:v1`, `sfl_`). Bağlantı taslağın kaydedilme anına bağlıdır: düzenleyici her kayıttan sonra yenisini alır.
  - Vitrin `/onizleme/<sfl_…>` adresinde taslağın ana sayfasını, üst bilgisini ve alt bilgisini basar. Vekil, belirteci kendi koyduğu bir istek başlığıyla iletir; ziyaretçinin gönderdiği aynı adlı başlık silinir.
  - Bu sayfalarda CSP `frame-ancestors` panelin kökenini (`PANEL_ORIGIN`; geliştirmede `http://localhost:5173`) adlandırır ve `X-Frame-Options` gönderilmez. Diğer bütün sayfalar `DENY` ve `frame-ancestors 'none'` ile kalır (e2e testli).
- **Yansıma.** Yayın `storefront.layout_published` olayını yayar. Vitrin yayındaki belgeyi hemen gösterir: backend yayından sonra imzalı "yenile" sinyali gönderir (`layout` kapsamı), sinyal ulaşmazsa paylaşılan önbellekle en geç 60 sn'de. Ayrıntı adr/0048 Ek (2026-11-03).
- **Bilinen sınır.** İki kişi aynı anda düzenlerse son kayıt kazanır; düzenleyici "başka biri kaydetti" uyarısını sonra alabilir.

## Ek (2026-11-02): bağımsız güvenlik incelemesi

Menüler, tema düzenleyicinin backend'i ve önizleme çerçevesi incelendi. Yüksek ya da orta bulgu çıkmadı. 8 düşük bulgunun hepsi düzeltildi:

- **L1:** alt bilgi sütunu en çok 10 (`storefront_menus.too_many_footers`). Menü bağlantıları tek geçişte gruplanıyor; bağlantısı kalmamış menü herkese açık yanıtta yok.
- **L2:** yayındaki düzen süreçte bir dakika tutuluyor (anahtarı sürüm numarası; yeni yayın hemen görünür). Herkese açık ucun maliyetini ziyaretçi seçemez.
- **L3:** menü kaydı ve yayın adımı yarıda hata verirse önceki durumu adımın içinde geri koyuyor. İş akışı yalnız biten adımı geri alır.
- **L4:** yayın, taslağı bugünkü şemadan ve kayıt/görsel denetiminden yeniden geçirir. Geri yüklenen sürüm ve yayındaki belge de şemadan geçer.
- **L5:** vekilin eşleştiricisi kesin: `_next/static/`, `_next/image`, `favicon.ico$`. Vitrin önizleme belirtecini biçimi tutmadan backend'e sormaz.
- **L6:** önizleme sayfalarında `Referrer-Policy: no-referrer`.
- **L7:** göç betiği uymayan bağlantıyı atlayıp yalnız sayısını kaydeder. Kayıt bağlantısı reddedilirse menüyü adresleriyle kurar. Yer yer çalışır; yarıda kalan çalıştırma kalanını sonra tamamlar.
- **L8:** herkese açık düzende yalnız yayındaki kayıtların kimlikleri var. Seçimi tümüyle boşalan bölüm çıkar.

Notlardan uygulananlar:

- Görsel adresi mağaza yolu ya da https olmalı.
- `withChildren` şeması katı.
- `PANEL_ORIGIN` canlıda https olmak zorunda.
- Önizleme ucu `no-store`'u en başta yazar.
- Eklenen testler: bir türün belirteci öbür türün ucunu açmaz; yayından sonra eski bağlantı kapanır.

Bilinçli kalanlar:

- Ürünün satış kanalı menüde denetlenmiyor; vitrin ürün sayfası zaten 404 verir.
- İçerik önizlemeleri de artık panel tarafından çerçevelenebilir (panel güvenilir köken).
- Belirteç anahtarları için HKDF ile ayrı anahtar türetme sonraya kaldı (bağlamlar ayrı, karışma yok).

## Ek (2026-11-03): ürün ve kategori sayfası bölümleri

Kararın 6.3 adımı ("diğer sayfa şablonlarının bölümleri"), backend tarafı.

- **İki yeni grup.** Belgeye `product` ve `category` eklendi; ikisi de en çok 12 bölüm, varsayılanı boş. Bunlar bütün ürün ve kategori sayfalarında ortaktır; sayfaya özel bölüm yoktur.
  - Eski taslak ve yayınlar bugünkü şemadan geçerken iki grup boş gelir. Panelin okuması, önizleme ve "değişiklik var" karşılaştırması da bu okumayla yapılır.
  - Bölüm kimlikleri beş grubun hepsinde tekildir.
  - Grubun almadığı tür `storefront_layout.section_invalid` ile reddedilir. Ana sayfada da aynısı geçerli.
- **Ürün sayfası.** Bölümler ürünün kendi bloğunun altında çıkar. Türler:
  - `related_products` (yeni): başlık, kaynak ve adet (1–12, varsayılan 8). Kaynak üç türlü olabilir:
    - `same_category`: ürünün kendi kategorisi; kayıt adlandırmaz, vitrin çözer;
    - `collection`: bir koleksiyon;
    - `manual`: 1–12 ürün.
  - `rich_text`, `banner`, `faq`, `trust_badges`, `help`, `newsletter`.
- **Kategori sayfası.** `rich_text`, `banner`, `faq`, `trust_badges`, `help` ve `newsletter` alır. Her bölümde bir de yer var (`placement`):
  - `top`: ürün ızgarasının üstü;
  - `bottom`: altı (varsayılan).
- **SSS (`faq`).** Ana sayfa, ürün ve kategori sayfasında kullanılabilir. Başlık en çok 60 karakter, boş olabilir. 1–12 soru-cevap içerir:
  - soru düz metin, en çok 160 karakter;
  - cevap düz metin, en çok 600 karakter, `{belirteç}` alabilir.

  ~~Vitrin bu bölümden `FAQPage` yapılandırılmış verisi üretir.~~ Kaldırıldı: SSS yalnız sayfada görünür, `FAQPage` basılmaz (Ek 2026-11-06, aşağıda).
- **Denetim ve okuma.** Üç grup (`home`, `product`, `category`) aynı yoldan geçer.
  - `checkLayout`: kayıtlar (ilgili ürünlerin koleksiyonu ve seçilen ürünleri dahil), görseller, zengin metnin kartları ve değişkenleri. SSS cevaplarının belirteçlerini şema denetler.
  - `storeLayout`: o anda gösterilenler süzülür ve yalnız yayındaki kayıtlar kalır:
    - elle seçimde yalnız yayındaki ürünler kalır, hiçbiri kalmazsa bölüm çıkar;
    - koleksiyonu gitmiş bölüm çıkar;
    - `same_category` olduğu gibi geçer.

    Belirteçler doldurulur. Zengin metin HTML olarak, görseller boyutlarıyla gelir. Kategori bölümleri yerlerini korur.
- **Uçların biçimi.** `GET /store/storefront-layout` ve önizleme `product` ile `category` dizilerini de verir. Yayındaki düzenin süreç önbelleği eskisi gibi sürüm numarasıyla anahtarlanır. Varsayılan belgede iki grup boş.

## Ek (2026-11-05): öne çıkan ürün bölümü (otonom, gözden geçir)

- Ana sayfaya bir bölüm türü daha: `featured_product` (`title`, `text` — mağaza bilgisi belirteçleri olabilir, en çok 240 —, `product_id`). Yalnız ana sayfada; ürün ve kategori sayfası almaz.
- Kayıtta ürün var mı denetlenir (`storefront_layout.target_unknown`); yayında olmayan ürünün bölümü vitrine gitmez (L8: taslak ürünün kimliği backend'den çıkmaz). Görseller, öne çıkan özellikler, fiyat ve özellik tablosu ürünün kendisinden, vitrinde okunur (adr/0046 Ek 2026-11-05).
- Panel: Bölüm ekle > "Öne çıkan ürün"; ürün seçilene kadar kayıt bekler ("Bir ürün seçin.").
- Kanıt: `lib/storefront/__tests__/layout.unit.spec.ts`, `integration-tests/http/storefront-layout.spec.ts`, panelde `section-forms.spec.tsx`, `problems.spec.ts`.

## Ek (2026-11-05): çok satanlar ve indirimde rafları (otonom, gözden geçir)

İstek: ana sayfanın sekmeli ürün alanında "Çok Satanlar / Yeni Gelenler / İndirimde". Sekmeleri tema çizer (yan yana `products` bölümleri); backend iki kaynak ekler.

- **İki kaynak daha.** Ana sayfanın `products` bölümünde (`lib/storefront/layout-sections.ts`). Ürün sayfasının ilgili ürünleri bunları almaz.
  - `on_sale`: `/kampanyalar`'ın listelediği ürünlerin tamamı, yani arama dizininde `on_sale` olanlar (fiyat listesi ya da herkese uygulanan otomatik kampanya; adr/0023 Ek 2026-11-05, adr/0056).
    - Sıra: en büyük indirim önce. İndirim, ürünün herhangi bir varyantında üstü çizili fiyata göre oran; kartın gösterdiği `price-display`'den. Eşitlerde en yeni ürün önce.
    - Tartılan, kampanyadaki en yeni 96 ürün (`SALE_POOL`). Daha büyük kampanyada raf yine kampanyalı ürünlerden oluşur; yalnız en eskiler tartılmaz.
  - `best_sellers` (`days`: 7–365, varsayılan 90): son `days` günde satılan adet. Tek SQL toplamı, Medusa'nın sipariş tablolarında (`workflows/storefront/best-sellers.ts`):
    - sipariş taslak, arşiv ya da iptal değil, silinmemiş;
    - ödemesi alınmış ya da tutulmuş (panelin "ödendi"si: `authorized`, `partially_authorized`, `partially_captured`, `completed`) ve tamamı iade edilmemiş; ya da sipariş `completed`;
    - satırın adedi siparişin güncel sürümünden (`order_item.version = order.version`); teslim alınan iadeler düşülür;
    - yalnız yayında, silinmemiş ve anahtarın satış kanalındaki ürünler;
    - en çok adet önce; eşitlerde en son satılan.

    Sıralama pencere ve satış kanalı başına 5 dakika süreç önbelleğinde. Sipariş olayıyla boşaltılmaz, süresi dolar.
  - **Tamamlama.** Satış rafı dolduramıyorsa kalanı en yeni ürünler (arama dizini, aynı kanal) tamamlar; bölüm `filled_with_newest: true` söyler. Satış sayısı hiçbir yerde gösterilmez, uydurulmaz.
- **Okuma.** `storeLayout` iki kaynağın ürünlerini anahtarın satış kanalları için seçer. Bölüme `product_ids` (sıralı) ve `filled_with_newest` eklenir; öteki kaynaklarda bu alanlar yok.
  - Yayındaki düzenin süreç önbelleği artık sürüm + satış kanalları anahtarlı (en çok 8 kayıt). Önizleme de seçer.
  - Seçilemeyen raf günlüğe yazılır (`storefront.best_sellers_failed`, `storefront.rail_failed`). Çok satanlar en yenilerle gelir, indirimde boş.
- **Vitrin.** Ürünleri kimlikle, backend'in sırasıyla yükler (`railProducts`); artık yayında olmayan atlanır. İndirimde ürün yokken bölüm çizilmez.
  - Başlık boşsa vitrin `home.products` ("Yeni ürünler") yazar. **Açık iş:** `tr.json`'a `home.best_sellers` ve `home.on_sale` gelince varsayılan başlık kaynağa göre olmalı (tema işi).
- **Panel.** Kaynak seçiminde "Çok satanlar" ve "İndirimde".
  - Çok satanlarda "Kaç günün satışı" alanı (7–365). 7'nin altı yazılırken kayıt bekler ("En az 7, en çok 365 gün yazın."); alan bırakılınca 7 olur.
  - Başlık boşsa ya da önceki kaynağın adıysa, yeni kaynağın adını alır.
- Migration yok.
- Kanıt: `lib/storefront/__tests__/rails.unit.spec.ts` ve `layout.unit.spec.ts`, `workflows/storefront/__tests__/best-sellers.unit.spec.ts`, `integration-tests/http/storefront-rails.spec.ts`; panelde `section-forms.spec.tsx`, `problems.spec.ts`; vitrinde `picked-rails.spec.ts`.

## Ek (2026-11-05): ürün raflarında satırda ürün sayısı (otonom, gözden geçir)

İstek (sahip): "ürün bileşenlerinde, çok satanlar örneğin, … grid olarak ürün sayısını seçebilmeliyiz. şu anda 3'lü gösterim var default; müşteri isterse bunu 5'li, isterse 4'lü yapabilsin ve responsive'e göre ayarlansın."

- **Ayar.** Ana sayfanın `products` bölümü (bütün kaynaklar: `newest`, `best_sellers`, `on_sale`, `category`, `collection`, `manual`) ve ürün sayfasının `related_products` bölümü `columns: 3 | 4 | 5` alır; varsayılan 3 (ayardan önceki görünüm). Şema `lib/storefront/layout-fields.ts` (`layout-sections.ts` 300 satıra yaklaştığı için ortak parçalar oraya bölündü). Başka bir değer `storefront_layout.section_invalid` (panel yalnız üçünü sunar; başka değer bozuk ya da eski bir istemcidir).
  - Eski taslak ve yayınlar okunurken 3 gelir; "değişiklik var" karşılaştırması etkilenmez.
  - `GET /store/storefront-layout` ve önizleme iki bölümde de `columns` verir (`@qticaret/types` `ShelfColumns`); vitrin bunu bölümün görünümüne (`HomeSectionView` `products.columns`) taşır.
- **Tema (Atölye).** Seçilen sayı 1280 px'ten sütun sayısıdır; dar ekranda kendiliğinden azalır (`parts/shelf-grid.ts`):
  - 5 → 1024–1279 px'te 4, 768–1023 px'te 3, telefonda 2;
  - 4 → 768–1279 px'te 3, telefonda 2;
  - 3 → 768 px'ten 3, telefonda 2.

  Sekmeli rafta her sekme kendi bölümünün ayarını izler. Kart küçülmez; ad ve fiyat 1024 px'ten büyük boylarını yalnız kart 256 px ve daha genişse alır (kartın kendisi kap, container query): beşli rafta 1440 px'te kart ~250 px, ad 14 px, fiyat 16 px, üstü çizili fiyat aynı satırda. Bu kural kartı her yerde izler: filtre panelinin yanındaki liste 1024–1250 px arasında (kart ~200–215 px) da küçük boyu alır.
- **Kaç ürün.** Her genişlik iki tam sıra gösterir (telefonda ayardan önceki gibi ikişerli üç sıra): 3 → 6, 4 → 8, 5 → 10. Ürünler iki sırayı doldurmuyorsa **her genişlikte yalnız dolu sıralar** görünür (bir sıradan azsa hepsi); hiçbir genişlikte görünmeyecek kart HTML'e yazılmaz. Fazlası "Tümünü gör"de. Panel sınırı değiştirmez, öneri verir (aşağıda).
- **Panel.** Ürün listesi ve benzer ürünler formunda "Satırda ürün" bölümlü denetimi (3 · 4 · 5; her seçenekte sırasının küçük çizimi), altında dar ekranlarda ne olduğu; "Gösterilecek sayı" iki sırayı doldurmuyorsa "iki tam sıra için gösterilecek sayıyı en az N yapın" uyarısı (engel değil).
- **Base tema** ayarı yok sayar (kendi 4 sütunu).
- Migration yok.
- Kanıt: `lib/storefront/__tests__/layout.unit.spec.ts`, `integration-tests/http/storefront-layout.spec.ts`, `storefront-rails.spec.ts`; panelde `section-forms.spec.tsx`; vitrinde `atolye-home-theme.spec.ts`, `picked-rails.spec.ts`, `sections.spec.ts`.

## Ek (2026-11-06): giriş slaytı (`hero_slider`; otonom, gözden geçir)

İstek (sahip): "hero alanına yeni bileşen olarak slider tasarım ekle. mevcut tasarımı silme, ekstra bileşen olsun sadece." Sahibin ilk brief'i "otomatik slider yok" diyordu; bu yüzden kendiliğinden geçiş **varsayılan kapalı** ve isteğe bağlı.

- **Yeni bölüm türü, yalnız ana sayfada.** Durağan `hero` değişmedi; ikisi aynı sayfada birlikte durabilir. Şema `lib/storefront/layout-slider.ts` (`layout-sections.ts` 300 satıra yakın). Ürün ve kategori sayfası almaz (`storefront_layout.section_invalid`).
  - `slides`: 2–6 slayt. Her slayt:
    - `image`: geniş görsel, zorunlu;
    - `mobile_image`: telefon görseli, isteğe bağlı (640 px altında geniş görselin yerine);
    - `heading` (90), `text` (160): isteğe bağlı, `{belirteç}` alır;
    - `link`: tek düğme, isteğe bağlı (`storefrontLink`: kayıt, sayfa, yasal metin, mağaza yolu ya da adres);
    - `position`: `left` | `center` | `right` (varsayılan `left`);
    - `tone`: `light` (koyu görselde açık yazı, varsayılan) | `dark` (açık görselde koyu yazı).

    Üst satır (`eyebrow`) yok: Hallmark tabanı yasaklıyor.
  - Bölüm seçenekleri:
    - `height`: `compact` | `regular` (varsayılan);
    - `autoplay`: varsayılan `false`;
    - `interval`: 5–10 sn, varsayılan 6;
    - `dots`, `arrows`: varsayılan `true`.
- **Denetim ve okuma.** `checkLayout` iki görseli de medya kütüphanesinde arar ve "bağlı" işaretler; düğmenin kaydı var mı bakılır. `storeLayout` görsellere boyut ve türev ekler, belirteçleri doldurur, kırık bağlantıyı `null` yapar; slayt kalır. Okuma ve yayın eskisi gibi; sürüm geçmişi değişmedi.
- **Tema sözleşmesi** (`@qticaret/ui` `HeroSliderSectionView`). Vitrin `lib/views/hero-slider.ts` ile çevirir.
  - Base tema slider çizmez: ilk slaytı başlığı varsa durağan giriş olarak gösterir.
  - Atölye kendi sliderını çizer (`sections/HeroSlider.tsx`, `sections/SliderStage.tsx`, `slider.css`; kurallar `design.md` § Bileşen kuralları).
- **Panel.** Bölüm ekle > "Giriş slaytı".
  - Slaytlar satır satır (küçük görsel + başlık), yukarı/aşağı taşı ve kaldır düğmeleriyle. "Slayt ekle" medya kütüphanesini açar.
  - Satıra tıklamak standart `FormDialog`'u açar (`lg`): görseller, yazılar, görünüm. Başlıkta önceki/sonraki slayt okları ("2 / 3") var; kaydedilmemiş değişiklikle geçmek ya da kapatmak önce sorar. "Kaydet" slaydı taslağa koyar.
  - Seçenekler: yükseklik (Kısa/Standart), "Kendiliğinden geçsin" anahtarı (açıkken "Her slayt kaç saniye", 5–10), noktalar, oklar.
  - İkiden az slaytla kayıt bekler ("En az iki slayt ekleyin.").
- **Dev verisi.** Dev mağazanın ana sayfa **taslağının** başına üç slaytlı bir `girisslayti` eklendi. Yayın değişmedi.
  - Slaytlar mağazanın kendi fotoğraflarıyla: Damascus çakı, mutfak, kamp.
  - Bağlantılar El Yapımı Çakı, Mutfak & Şef Serisi ve Outdoor & Kamp kategorilerine.
  - Telefon görseli olarak girişin ürün fotoğrafı.
  - Kendiliğinden geçiş kapalı.
- Migration yok.
- Kanıt: `lib/storefront/__tests__/layout-slider.unit.spec.ts`, `integration-tests/http/storefront-slider.spec.ts`; panelde `forms/hero-slider-form.spec.tsx`, `problems.spec.ts`; vitrinde `atolye-slider-theme.spec.ts`.

## Ek (2026-11-06): Google puanı bölümü (`google_rating`; otonom, gözden geçir)

- Ana sayfaya isteğe bağlı yeni bölüm türü: Google'daki ortalama ve sayı, `/yorumlar`'a ve (isteğe bağlı) Google Haritalar'a bağlantı, 0–3 son 4–5 yıldızlı alıntı. Şema `lib/storefront/layout-google.ts` (`title`, `excerpts` 0–3, `profile_link`); ürün ve kategori sayfası almaz.
- Belge yalnız ayarları tutar; rakamları vitrin her istekte okur (`/store/google-reviews`), gösterecek bir şey yoksa bölüm çizilmez. Ayrıntı, yapılandırılmış veri kararı ve kanıtlar: adr/0058 Ek 2026-11-06.
- Panel: Bölüm ekle > "Google puanı" (başlık, "Son yorumlardan alıntı göster" + sayı 1–3, "Google'daki sayfanıza bağlantı"). Migration yok.

## Ek (2026-11-06): görünüşe ait tercihler tema düzenleyiciye (otonom, gözden geçir)

İstek (sahip): "şu vitrin tercihleri ekranında da tema düzenleyici içinde olması gerekenleri oraya al, mesela rozetlerin orda ne işi var, bileşende / tema tercihlerinde yönetebilirim onu".

- **Ayrım.** Vitrin tercihlerinin her alanı tek kuralla ayrıldı: vitrinin çizdiği ya da görünüşü → tema düzenleyici; mağazanın davranışı ya da durumu → Vitrin tercihlerinde kalır.

  | Alan (`storefront` ayar bölümü) | Yeni yeri | Neden |
  | --- | --- | --- |
  | `trust_badges` (simge, başlık, açıklama) | Tema düzenleyici > **Güven rozetleri bölümünün** kendi formu | Çizilen şey, bir bileşenin içeriği; birden çok yer aynı listeyi gösterir (ana sayfa, ürün ve kategori sayfası `trust_badges` bölümleri, ürün sayfasının güvenceleri ve "Kargo ve Teslimat" kartı, sepet, kargo sayfası). Liste tektir, her şerit bölümü aynı listeyi gösterir ve düzenler. |
  | `color_swatches` | Tema > **Stok ve renk örnekleri** > Renk örnekleri | Kartta, filtrede ve ürün sayfasında renkli yuvarlak olarak çizilir. |
  | `low_stock_threshold` | Tema > **Stok ve renk örnekleri** > Az kaldı rozeti (aç/kapat + eşik 1–1000) | Ürün kartının çizdiği uyarı. |
  | `contact_form_path` | Kalır | Hangi sayfanın formu taşıdığı; düzen belgesinde içerik sayfası grubu yok (ana sayfa, ürün, kategori). İçerik sayfalarına bölüm gelirse "İletişim formu" bölümü olur. |
  | `payment_info_path`, `shipping_info_path` | Kalır | Canlı ödeme ve kargo bilgisinin hangi sayfanın yanında durduğu; içerik eşlemesi. |
  | Bakım modu (`maintenance` bölümü) | Kalır | Mağazanın durumu. |
- **Belge.** Düzen belgesine `settings` eklendi (`lib/storefront/layout-settings.ts`): `trust_badges` (en çok 4; başlık 40, açıklama 80, `{belirteç}` alır), `color_swatches` (en çok 100; ad 40, `#rrggbb`, Türkçe büyük/küçük harfe göre tekil), `low_stock` (`enabled`, `threshold` 1–1000, varsayılan 3). Hepsi **taslağa** yazılır, "Yayınla" ile yayına çıkar, sürüm geçmişine girer. Hata anahtarları `storefront_layout.color_invalid`, `storefront_layout.color_duplicate`.
- **Taşıma: okuma anında, göç yok.** Her parça yazılana kadar `null`'dır; `null` olan parçanın yerine `storefront` bölümündeki eski alan okunur (`withLegacy`, `shownSettings`):
  - panelin okuması (`GET /admin/storefront-layout`) taslağı ve yayındakini aynı biçimde doldurur: düzenleyici bugünkü değerlerle açılır, "değişiklik var" yanmaz; ilk kayıt değerleri taslağa taşır;
  - varsayılan belge (`defaultLayout`) de eski alanlardan doldurulur;
  - eski alanların `0` eşiği "kapalı" okunur (eşik 3'te bekler).

  Göç betiği ya da migration yok: veri olduğu yerde kalır, yayınlanan ilk düzen yenisini yazar. Eski alanlar şemada ve `GET /admin/platform-settings/storefront`'ta okunabilir kalır; panel artık yazmaz.
- **Okuyanlar.**
  - `GET /store/storefront-layout` ve önizlemesi `settings: { trust_badges, color_swatches }` verir (rozet metinleri belirteçleri doldurulmuş). Vitrin bunları `currentShared()` ile okur (`lib/views/shared-settings.ts`); `settings` vermeyen eski backend'de çerçevenin alanlarına düşer. Önizleme taslağın rozetlerini ve renklerini gösterir.
  - `GET /store/storefront` `storefront.trust_badges` ve `color_swatches`'ı artık **yayındaki** düzenden verir (eski vitrin derlemesi için); eşik yine yanıtta yok.
  - Kartların "Az kaldı"sı (`/store/card-facts`) yayındaki düzenin eşiğini okur. **Bilinen sınır:** önizleme yeni eşiği göstermez (kartlar herkese açık uçtan gelir); panel bunu alanın altında söyler.
- **Panel.**
  - Vitrin tercihleri üç sekmeye indi: İletişim formu, Ödeme ve kargo sayfaları, Bakım modu. Açıklaması "mağazanın nasıl çalıştığı; görünüş tema düzenleyicide" der. Eski `?part=badges|swatches|stock` bağlantıları ilk sekmeyi açar.
  - Düzenleyicinin ağacında "Tema" altında iki satır: Tema ayarları (hemen yayına giren ayar bölümü, adr/0053 §B, değişmedi), Stok ve renk örnekleri. İkincisi taslağın parçasıdır: değişiklikler kendiliğinden kaydedilir, geri al/yinele çalışır, hatalı alan kaydı bekletir ve satırda işaret çıkar.
  - **Güven rozetleri bileşenin içinde düzenlenir** (sahip, aynı gün: "bu bir bileşen değil mi, bileşeni neden bileşen düzenleyicisinden yapmıyoruz?"). Ağaçtaki "Tema > Güven rozetleri" satırı kalktı; şerit bölümünün formunda listenin kendisi var (simge, mağaza bilgisi belirteçli başlık, isteğe bağlı açıklama, sırala, kaldır, ekle) ve üstünde "Bu rozetler sitenin her yerinde aynı görünür: ürün sayfası, sepet, kargo sayfası." notu. Veri değişmedi: liste yine tek, `settings.trust_badges`, taslak → yayın; ana sayfa, ürün ve kategori sayfasındaki her şerit örneği aynı listeyi gösterir ve düzenler. Geri al/yinele alan başına bir adım, kendiliğinden kayıt, hatalı rozette kaydın beklemesi aynı; hatalı rozet her şerit bölümünün satırında işaret çıkarır (`documentProblems` rozet hatalarını her `trust_badges` bölümüne de yazar).
  - Şeridi olmayan sayfa: şerit bölümü eklenir. Ürün sayfası rozetleri satın alma kutusunun altında bölümsüz de çizer; bu yüzden ürün sayfası ağacında "Ürünün kendi bilgileri" satırının altında "Satın alma kutusunun altındaki rozetler, Güven rozetleri bileşeninden düzenlenir." notu ve "Rozetleri düzenle" düğmesi var; düğme aynı listeyi standart bir pencerede açar (değişiklikler yine taslağa, geri alınabilir; rozet hatalıysa düğmede işaret).
  - Renk örnekleri düz liste kaldı (sahibin kendi eklediği sırayla; renk ailesine göre gruplamak yazarken satırı yerinden oynatırdı).
- Kanıt: backend `lib/storefront/__tests__/layout-settings.unit.spec.ts`, `layout.unit.spec.ts`, HTTP `storefront-layout-settings.spec.ts` (eski alandan açılış, taslak, yayın, `/store/storefront`, kart eşiği, ayarı olmayan eski belge); panel `editor/shared/shared-settings.spec.tsx` (şerit formunda düzenleme, geri al, her şeridin satırındaki işaret, ürün sayfasının penceresi), `layout/problems.spec.ts`, `pages/preferences-page.spec.tsx`; vitrin `lib/views/__tests__/shared-settings.spec.ts`.

## Ek (2026-11-06): SSS bölümü `FAQPage` basmaz

- **Çelişki.** Ek 2026-11-03 SSS bölümünden `FAQPage` üretilmesini söylüyordu; docs/13 §5 "`FAQPage` kullanılmaz" der. Vitrin denetimi (docs/21 2026-11-06, 6) ana sayfada bloğu buldu.
- **Karar (ana oturum): docs/13 geçerli.** Google SSS zengin sonucunu Ağustos 2023'ten beri yalnız tanınmış kamu ve sağlık sitelerine gösteriyor, sonra tümden kaldırdı (docs/13 §5). Mağaza için şemanın getirisi yok; blok yalnız bakım ve tutarlılık yükü.
- **Ne değişti.**
  - Vitrin `FAQPage` basmaz: ana sayfa, ürün sayfası, liste sayfaları ve tema düzenleyicinin önizlemesi. `lib/seo/faq.ts` silindi.
  - SSS bölümü sayfada olduğu gibi kalır: soru ve cevaplar `<details>` içinde, ilk HTML'de (okuyucu, tarayıcı ve ajanlar için; docs/19 §6.5).
  - Backend, panel ve şema değişmedi: bölüm türü, sınırlar (12 soru, 160/600 karakter) ve belirteçler aynı.
  - Advisor'da `FAQPage`'e dayanan kural yoktu; eklenmedi.
- **Koruma.** Vitrin birim testi (`lib/seo/__tests__/seo-policy.spec.ts`) vitrin, tema ve ui kaynaklarında JSON-LD türü olarak `"FAQPage"` geçmediğini denetler; e2e duman testi ürün sayfasında `FAQPage` bloğu olmadığını.
