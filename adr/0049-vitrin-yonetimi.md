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

## Ek 2026-11-14: bölüm biçimleri, yeni bölüm türleri ve gelişmiş CSS (Kabul edildi, 2026-11-14)

- **Durum:** Kabul edildi (2026-11-14). §10'daki on iki karar verildi: dördünü (4, 5, 6, 11) sahip seçti; kalan sekizi sahibin "önerilerle ilerle" yetkisiyle önerilen seçenekle kapandı. Ekin gövdesi kararlara göre güncellendi; kodlama §9'un sırasıyla başlar.
- **Dayanak:** `docs/tema/atolye-tamamlama-plani.md` ("Ek istek: bileşen başına hazır tasarımlar", E1–E8, "Karar: bölüm başına gelişmiş CSS", "İlke: bölüm ayarları kullanıcıyı boğmaz", "Maket seçimi"); adr/0063 §6 ve iş 2.5 (kapsamı bu eke taşındı); adr/0062; adr/0053 §B; adr/0040; adr/0011. Maketler depo dışındadır (`qticaret-demo-katalog/maket/`); biçim tanımları `_kaynak/*.mjs` dosyalarındaki `code`, `title`, `note`, `fields` alanlarından okundu.
- **Değişen kural:** Karar 2'deki "Panelden HTML, CSS ya da JavaScript yazılmaz" cümlesinin CSS kısmı §8'deki dar kapsamla değişir (sahip, 2026-11-14: "Shopify mantığıyla gidelim"). HTML ve JavaScript yasağı aynen kalır; serbest sürükle-bırak konumlandırma ve tema kodu düzenleme yine yoktur.

### 1. Bugün kodda olan (doğrulandı)

- Bölüm şemaları `lib/storefront/layout-sections.ts` (249 satır); ortak parçalar `layout-fields.ts` (`base`: `id`, `visible`, `starts_at`, `ends_at`; `columns` 3 | 4 | 5); belge `layout.ts`: `header` yalnız `announcement_bar` alır (en çok 3, her tür bir kez), `home` 30, `product` ve `category` 12, `footer` yalnız `newsletter`, ayrıca `settings`. `hero_slider` `layout-slider.ts`'te, `google_rating` `layout-google.ts`'te. **Hiçbir türde `variant` yok.**
- `defaultLayout` (`workflows/storefront/layout-default.ts`): duyuru, `hero`, `categories`, `products` (en yeniler), `help`, `posts`; alt bilgide bülten; ürün ve kategori grupları boş. `settings.theme` adr/0063 iş 2.1 ile bu ek yazılırken ayrı bir işte ekleniyor.
- Kategori grubundaki bölümler `placement` (`top` | `bottom`) taşır; ürün ve kategori grupları bütün ürün ve kategori sayfalarında ortaktır (Ek 2026-11-03).
- Tema ayarı (`modules/platform-settings/sections/theme.ts`) `header: { layout: "centered" | "left", sticky }` taşır. Atölye `frame/Header.tsx` yalnız `sticky`'yi okur; ortalanmış düzen adr/0062 karar 6'ya göre ayrı dalda.
- Atölye'de sekmeli raf ayrı bir tür değildir: art arda duran `products` bölümleri tek sekmeli rafa birleşir (`sections/plan.ts` `blocksOf`, `sections/ShelfTabs.tsx`, betiksiz).
- `banner` 1–6 slayt taşır, her slaytta tek bağlantı; Atölye ilk üçünü yan yana çizer (`sections/Campaign.tsx`). Biçim ayarı yok.
- Ürün kartının görünüm modeli tek görsel taşır (`@qticaret/ui` `ProductCardView.image`); ikinci görsel, teslimat notu ve varyant sayısı yok. Tek varyantlı üründe karttan sepete ekleme var (`QuickAddView`).
- Üst bilgi sepetin adedini ve ara toplamını zaten alır (`ShopView.cartQuantity`, `MiniCartView.subtotal`); sepet çekmecesi ücretsiz kargo çubuğunu çizer (`parts/FreeShippingMeter.tsx`, `FreeShippingView`); eşik `promotions.free_shipping_threshold`.
- Kategori başına ürün sayısı yalnız `/kategoriler` sayfasında var: vitrin her kategori için ayrı `/store/products` sayımı ister (`apps/storefront/src/lib/views/category-index.ts`, `nav-pictures.ts` `categoryGlance`). Ana sayfa bölümlerinde ve menüde sayı yok.
- Fiyat listelerinin `starts_at` / `ends_at`'i backend'de okunuyor (`workflows/pricing/price-history.ts`); bitiş tarihini store tarafına veren uç yok. Store `fields` promosyonun kampanyasına ulaşamıyor (adr/0024).
- Marka kaydı: ad, tanıtıcı, açıklama, logo (`modules/brands`); kapak görseli ve ürün sayısı yok. Blog etiketleri var (`modules/content` `content-term`, tür `tag`). Çalışma saatleri `store` ayar bölümünde (`opening_hours`), sosyal hesaplar `legal` bölümünde (`sameAs`).
- Atölye stilleri katmanlı: `base.css` `layer(base)`; `ui.css`, `frame.css`, `pages.css`, `content.css` `@layer components`; `tokens.css` katmansız. Vitrin canlıda `style-src 'self' 'nonce-…'` gönderir ve tema değişkenlerini nonce'lu bir `<style>` ile basar (`apps/storefront/src/app/layout.tsx`, `lib/security/csp.ts`); `img-src` her https adresine açık.
- Tema ölçeği adlandırılmış: `--section-gap-s` / `--section-gap` / `--section-gap-l`, `--space-3xs` … `--space-4xl`, `--container` 1440 px, `--gutter` (`tokens.css`; dar ekranda kendiliğinden küçülür).
- Panel düzenleyicide ayar araması yok (`editor/`'deki tek arama önizleme ürünü seçicisi). Bölüm formları `editor/forms/` altında, tür başına bir dosya.

### 2. `variant` alanının kuralları

1. **Alan.** Biçim taşıyan her bölüm türünde `variant`: tür başına kapalı liste, varsayılanı bugünkü çizim. Saklanan belgede alan yoksa varsayılan okunur (`placement` ve `columns` deseni); göç yok, "değişiklik var" yanmaz. adr/0063 §6 ile aynı kural.
2. **Adlar** İngilizce, sektörden bağımsız ve çizimi anlatır (`bento`, `category_list`); maket kodu ya da sektör adı değildir. Paneldeki Türkçe adı i18n anahtarından gelir (`storefront.editor.variants.<tür>.<biçim>`).
3. **Yazmada katı, okumada bağışlayıcı.**
   - Kayıt listede olmayan biçimi `storefront_layout.section_invalid` ile reddeder (`columns`'taki gibi: başka değer bozuk ya da eski bir istemcidir).
   - Tema tanımadığı biçimde varsayılan çizimi basar ve biçime özgü alanları yok sayar (base tema, eski tema derlemesi). Biçim listeleri `@qticaret/ui`'de durur; yeni biçim önce sözleşmeye, sonra temaya girer.
   - Bir biçim listeden kaldırılırsa şema onu okuma anında varsayılana eşler (`REMOVED_THEMES` deseni); saklanan belge hiçbir zaman okunamaz olmaz.
4. **Biçime özgü alanlar: üç seçenek.**

   | | (A) Düz, hepsi isteğe bağlı | (B) Tür içinde `variant`'a göre ayrık birleşim | (C) Ortak alanlar + biçim başına alt nesne (`by_variant`) |
   | --- | --- | --- | --- |
   | Doğrulama | Zayıf: biçimin zorunlu alanı şemada söylenemez, `superRefine` yığını | Katı: her biçim kendi zorunlusunu söyler | Katı, ama yalnız seçili biçim anlamlı |
   | Biçim değişince | Veri durur, kullanılmayan alanlar belgede birikir | Ortak alanlar taşınır, biçime özgüler düşer (geri al getirir) | Hepsi durur, geri dönünce yerinde |
   | Denetim ve görseller | Ölü alanlar `checkLayout`'ta denetlenir, gizli görseller "bağlı" kalır, süpürülemez | Yalnız görünen veri | A gibi |
   | Görünüm modeli ve tema | Her biçimde `null` denetimi | TypeScript daraltması: `section.variant === "bento"` | B gibi, bir kat daha derin |
   | Hazır görünüm dosyaları (adr/0063) | Gereksiz alanlar | Yalnız seçili biçim | Ölü alt nesneler |

   **Seçilen: (B)** (§10 karar 1). Tek istisna `category_main`'dir (§7: birden çok biçim aynı anda yayında). Ortak içerik (başlık, metin, düğmeler, görsel) türün tabanındadır ve her biçimde aynı adla durur; biçime özgü alanlar `variant` dalındadır. Panel biçim değişiminde ortak alanları taşır, biçime özgüleri yeni biçimin varsayılanlarıyla doldurur; geri al tek adımda eski biçimi verisiyle getirir. Uygulama notu: alan yokken varsayılanın birleşimden önce yazılması gerekir (`z.preprocess`); dış birleşim `type`, iç birleşim `variant` üzerinedir. Zod 4'te iç içe ayrık birleşimin `preprocess` ile hata anahtarını koruyarak çalıştığı kodlamadan önce Context7 ile doğrulanır (doğrulanmadı).
5. **Dosya düzeni.** `layout-sections.ts` 300 satır sınırına yakın. İlk iş türleri `lib/storefront/sections/<tür>.ts` dosyalarına böler (`layout-slider.ts`, `layout-google.ts` emsal). Paralel çalışmanın önkoşulu budur.
6. **Panel.** Bölüm formunun en üstünde "Biçim": küçük çizimli seçim (Ek 2026-11-05'teki sütun çizimleri gibi), anında önizleme. Ayrıntı §6.

### 3. İki takım için biçimler

Boyut: S (bir gün), M (birkaç gün), L (bir hafta ve üstü; çoğu yeni backend verisi ister). "Var" diye yazılanlar kodda doğrulandı; doğrulanamayanlar "doğrulanmadı" diye işaretli.

#### 3.1 Kombinasyon takımı

| Maket | Bölüm türü | `variant` | Yeni alanlar | Backend'de gereken veri | Boyut |
| --- | --- | --- | --- | --- | --- |
| DY3 | `announcement_bar` | `free_shipping` (bugünkü: `lines`) | Boş sepet metni (`{esik}`), kalan metni (`{kalan}`), eşik aşıldı metni, isteğe bağlı öneri bağlantısı (koleksiyon) | Eşik var; sepet ara toplamı üst bilgide var. İki belirteç adr/0048'in mağaza belirteçlerinden ayrıdır, yalnız bu alanlarda geçer. Eşik yoksa bölüm `lines` gibi çizilir | M |
| N12 | `header_bar` (ana bölüm, §5) | `shrinking` | Üst satır sloganı + 0–4 bağlantı, küçülme aç/kapa, eşik Erken / Orta / Geç | Yok. Atölye kaydırınca kategori şeridini zaten katlıyor (`ScrollCue`, `frame.css`) | M |
| M7 | `usage_menu` (yeni, üst bilgi grubunda, §5) | yok (tek çizim) | 1–5 sekme (ad, simge, alt yazı), tanıtım başlığı ve cümlesi, 0–5 bağlantılı etiket, 3 ürün (koleksiyon ya da elle), menüdeki konumu | Ürünler var olan raf seçimiyle (`storeLayout`). Kategoriye süzülen çok satanlar yeni: `best_sellers` bugün mağaza geneli | L |
| MT1 | `header_bar` | alan `phone_menu: layered` | Katman 2 / 3, küçük resim aç/kapa, ek satırlar (Markalar, Kampanyalar), alt bağlantılar | Kategori ağacı ve resimleri var (`frame/MenuSheet.tsx`). Menünün tek alt düzeyi 3. katmana yetmez; katmanlar kategori ağacından okunur | M |
| H11 | `hero` | `bento` | Büyük kutu (görsel, rozet, başlık, metin, düğme), ürün kutusu (ürün + rozet), sayaç kutusu, rehber kutusu (yazı), kategori kutusu (2–4), büyük kutu sol / sağ | Sayacın bitişi §4.2 ile ortak, yeni okuma. Yazı seçimi `checkLayout`'a yeni kayıt türü (`post`) olarak girer | L |
| KK2 | `categories` | `uses` (bugünkü: `tiles`) | 3–6 karo: görsel, ad, açıklama, hedef (`storefrontLink`: kategori, filtre sayfası, koleksiyon), 0–3 alt bağlantı | Yok; bağlantı yapısı var | M |
| SR1 | `tabbed_products` (yeni, §4.3) | `side` | Sekme açıklaması, ürün sayısı aç/kapa, adet 3 / 6, kart biçimi (`card_variant`, §3.3) | Kaynak başına ürün sayısı yeni (doğrulanmadı; çok satanlar ve indirimdekiler için anlamı sahiple netleşir) | M |
| UK2 | tema ayarı `product_card.variant`, rafta `card_variant` (§3.3) | `technical` | Özellik 1–3 (özellik şablonundan), cetvel aç/kapa, varyant sayısı, stok/tedarik satırı, Karşılaştır | Kartta anahtar özellik, varyant sayısı ve tedarik süresi Faz 4 işidir, kart verisine (`/store/card-facts`) eklenir; Karşılaştır Faz 4 | L |
| FS1 | `timed_offer` (yeni, §4.2) | `single` | §4.2 | Fiyat listesinin bitişi ya da elle bitiş; stok kovası var (`StockLevel`); fiyat sunucuda | L |
| OU2 | `featured_product` | `story` (bugünkü: `specs`) | Üst metin, hikâye (600 karakter), üç bilgi (etiket + değer), imza (ad, yer), zemin Sahne / Açık | Yok; ürün verisi var | M |
| GS1 | `shop_the_look` (yeni, §4.4) | yok | §4.4 | Çok satırlı sepete ekleme yeni (doğrulanmadı) | L |
| GB2 | `banner` | `service_cards` | Slayta isteğe bağlı `caption` (fiyat / süre satırı, 60 karakter); 2–4 kart | Yok. WhatsApp hedefi `storefrontLink`'te yok (doğrulanmadı); yoksa mağaza yolu ya da https adresi | M |
| RH3 | `posts` | `topic_rail` (bugünkü: `cards`) | 2–5 konu çipi (blog etiketinden), 4–10 kart, ilgili ürün satırı aç/kapa | Etiketler var. "Yazıda geçen ürün" yazının içerik belgesindeki ilk ürün kartından türetilir (doğrulanmadı) | M-L |
| YR1 | `reviews` | `rail` (bugünkü: `summary`) | Kaynak En yeni / En yüksek puan / Elle, 4–12 kart, en düşük puan 4 / 5, ürün bağlantısı aç/kapa | Bugünkü bölüm yalnız `limit` taşır; elle seçim ve puana göre sıra yeni (doğrulanmadı) | M |
| MR2 | `brands` | `cards` (bugünkü: `pills`) | Marka başına kapak görseli (bölümde tutulur), ürün sayısı aç/kapa, sütun 3 / 4 | Kapak marka kaydında yok, bölümde durur; tanım `description`'dan; marka başına ürün sayısı yeni (doğrulanmadı) | M |
| BL2 | `newsletter` | `benefits` (bugünkü: `plain`) | Görsel, 2–4 avantaj, karşılık (kod kampanyası, isteğe bağlı), görsel sol / sağ | Onay bugünkü bülten akışından (adr/0041). Kayıttan sonra karşılık kodunun gösterimi yeni (doğrulanmadı) | M |
| AB3 | `footer_bar` (ana bölüm, §5) | `dark_rich` | Bülten aç/kapa, 2–3 sütun (menü seçimi), sosyal hesaplar, ETBİS karekodu (görsel), taksit metni | Saatler `store`, sosyal hesaplar `legal`'dan; ödeme işaretleri var. Karekod medya görseli | M |
| SC1, SP1, OD1, SO1 | bölüm değil | | Sepet çekmecesi, sepet, ödeme, onay | Bu eke girmez (§10 karar 10); çekmecede kargo çubuğu bugün var | |

#### 3.2 Klasik katalog takımı

| Maket | Bölüm türü | `variant` | Yeni alanlar | Backend'de gereken veri | Boyut |
| --- | --- | --- | --- | --- | --- |
| KY3 | `marquee` (yeni, §4.1) | boy Küçük | 1–8 öge (metin, bağlantı) | Yok | §4.1 |
| N14 | `header_bar` | `catalog` | Arama yer tutucusu, yazılı arama düğmesi, yazılı hesap bağlantısı aç/kapa, sepette tutar aç/kapa, ikinci satırda vurgulu son bağlantı (metin, hedef) | Var: sepet adedi ve ara toplamı üst bilgide | M |
| H17 | `hero` | `category_list` | Kategori listesi (kaynak: menü ya da üst kategoriler; ürün sayısı aç/kapa), 0–4 hızlı bağlantı çipi, ikinci düğme, 3 görsel karo (görsel, kategori, bağlantı) | Kategori başına sayı bugün yalnız `/kategoriler`'de ve kategori başına bir istekle. İlk ekran için backend'de tek sorguda sayım ve önbellek gerekir (§10 karar 7) | M-L |
| GB4 | `trust_badges` | `lined` (bugünkü: `strip`) | Yok: rozetler `settings.trust_badges` (en çok 4; başlık + açıklama) | Yok | S |
| UR5 | `products` | yok | Yok: `columns: 5` var | Yok. "Telefonda ilk 4" bugünkü dolu sıralar kuralıyla aynı (Ek 2026-11-05) | S |
| UK5 + E5 | tema ayarı `product_card.variant`, rafta `card_variant` | `framed` | İndirim rozeti, yorumsuzda boş yıldız, teslimat notu, tam genişlik "Sepete ekle / Seçenekler", üzerine gelince ikinci fotoğraf | İkinci görsel kart modelinde yok: kart verisine eklenir (adres + türevler; yalnız gerekince yüklenir). "Ücretsiz kargo" notu fiyat ve eşikten hesaplanır; "aynı gün" verisi yok (doğrulanmadı). Tek varyantta düğme `QuickAddView` ile var | M-L |
| KY1 | `marquee` | boy Orta, simgeli | 1–8 öge (simge, başlık, alt satır, bağlantı) | Yok | §4.1 |
| KB2 | `banner` | `split` | Kart başına üst metin, zemin Sahne / Açık / Vurgu, görsel sol / sağ; E2 alanları | Yok | M |
| KK4 | `categories` | `mosaic` | Büyük karo (kategori + açıklama), 4 küçük kategori, büyük karo sol / sağ, yazı fotoğrafın üstünde / altında | Yok | M |
| MR1 | `brands` | `logos` | Ton Gri / Renkli, 3–8 marka sıralı | Logo var (`logo_url`) | S |
| YR1 | `reviews` | `rail` | 3.1'deki gibi | 3.1'deki gibi | 3.1 |
| AB1 | `footer_bar` | `columns` | Tanıtım metni (200), 2–4 sütun (menü), yaş uyarısı aç/kapa | Menüler, yasal metinler, ödeme işaretleri var | M |

#### 3.3 Ortak işler

- **E2 görsel bant ayarları** (`banner`'ın bütün biçimlerinde): slayta ikinci düğme; düğme stili Dolu / Çerçeveli / Yazı; genişlik Tam / Kutulu; yükseklik Alçak / Orta / Yüksek; metin konumu Sol / Orta / Sağ × Üst / Orta / Alt (küçük ızgara çizimiyle); perde gücü Yok / Hafif / Orta / Güçlü; metin rengi Açık / Koyu (slayttaki `tone` deseni); telefon görseli (`hero_slider`'daki `mobile_image`). M.
- **Kart biçimi: tema genelinde bir varsayılan, rafta geçersiz kılma** (§10 karar 4).
  - `product_card.variant: "standard" | "technical" | "framed"` ve E5 alanları (`hover_image`, `delivery_note`, `full_button`, `empty_stars`) tema ayarına girer; adr/0063 §3'e göre `settings.theme` ile taslağa ve yayına gider.
  - Ürün raflarında (`products`, `tabbed_products`) `card_variant: null | "standard" | "technical" | "framed"`; `null` tema ayarını okur, saklanan belgeler değişmez, göç yok. Raf yalnız biçimi seçer; E5 alanları her yerde tema ayarından okunur. Liste, arama ve kategori sayfası her zaman tema ayarındaki biçimi çizer. SR1'deki "Kart biçimi" alanı ilk turda vardır.
  - Kart verisi rafın etkin biçimine göre istenir: genel biçim `standard` olsa da `technical` biçimli raf kart verisini (`/store/card-facts`) yalnız kendi ürünleri için ister; ikinci görsel yalnız `framed` çizilen kartlarda yüklenir. §2 kural 3 burada da geçer: tema tanımadığı biçimde `standard` çizer.
  - Boyut: rafta geçersiz kılma ve raf başına kart verisi M (§9 C).
- **E6:** rafta 4 / 5 sütun var. Sayfa genişliği tema ayarına `layout.width: "standard" | "wide" | "full"` olarak girer (1440 px / 1680 px / tam; `--container`). S.

### 4. Yeni bölüm türleri

Hepsi `base` alanlarını (kimlik, görünürlük, başlangıç, bitiş) ve §6'daki görünüm ayarlarını taşır. Metinler `shopText`, bağlantılar `storefrontLink`, görseller medya kütüphanesinden.

#### 4.1 Kayan yazı şeridi: `marquee` (E1; KY1, KY3, ileride KY2)

- **Gruplar:** ana sayfa; ürün ve kategori sayfası (kategoride `placement` ile); üst bilgi grubunda en çok bir tane, üst bilginin üstünde (§10 karar 9).
- **Alanlar:** `items` 1–8: `icon` (güven rozetlerinin simge listesi, isteğe bağlı), `text` (60), `subtext` (80, isteğe bağlı), `link` (isteğe bağlı); `speed` Yavaş / Orta / Hızlı; `direction` Sola / Sağa; `ground` Sahne / Ana renk / Açık; `size` Küçük / Orta / Büyük; `separator` Yok / Nokta / Yıldız / Çizgi.
- **Sınırlar:**
  - Üzerine gelince ve klavye odağında durur; görünür bir "durdur" düğmesi taşır (WCAG 2.2.2: beş saniyeden uzun kendiliğinden hareket durdurulabilmeli).
  - `prefers-reduced-motion`'da kaymaz; ögeler yan yana sarılır.
  - Ögeler HTML'de bir kez yazılır; döngü için kopya `aria-hidden` ve odaklanamaz.
  - Sayfada en çok iki şerit.
- **Boyut:** M.
- **Ek 2026-11-15 (sahip kararı):** sahibin eleştirisi ("kayma hızı ayarı yok, durdur tuşunun gizlenme özelliği yok"; hız vardı ama kapalı grupta bulunamadı) üzerine sekiz alan eklendi; hepsi isteğe bağlı, varsayılanı bugünkü çizim, kayıtlı düzenler aynen okunur (migration yok): `speed` beş basamak (Çok yavaş … Çok hızlı); `pause_button` Her zaman / Üzerine gelince (fare şeridin üstünde, odak içeride ya da duraklatılmışken görünür; dokunmatikte hep görünür, Tab sırasında kalır); `hover_pause` aç/kapa (kapalıyken klavye odağında yine durur); `device` Her yerde / Yalnız telefonda / Yalnız masaüstünde (temanın 64rem çerçeve kırılımı; gizli şerit `display:none`, yer kaplamaz; "en çok iki şerit" sınırı cihazdan bağımsız sayılır); `weight` Kalın / Normal ve `uppercase` aç/kapa; `gap` Sıkı / Normal / Geniş; `outline` (yalnız Büyük boyda: ögeler sırayla dolu ve çerçeveli); `closable` (ziyaretçi kapatınca o tarayıcıda, içerik değişene dek görünmez; `localStorage`'a yalnız bayrak yazılır). **Durdur düğmesi tamamen kaldırılamaz** (WCAG 2.2.2): `pause_button`'da "yok" basamağı yoktur. Panelde Hareket ve Görünüm grupları açık ve ögelerin hemen altında; cihaz ve kapatma "Diğer ayarlar"da.

#### 4.2 Süreli fırsat: `timed_offer` (E7; FS1, H11'in sayaç kutusu, ileride H7)

- **Gruplar:** ana sayfa.
- **Alanlar:** `product_id`; `offer`: sayacın kaynağı (§10 karar 5), `{ kind: "price_list", price_list_id }` (varsayılan: gerçek indirimin bitişi) | `{ kind: "manual", ends_at }` (mağaza sahibinin girdiği bitiş; indirimsiz duyuru da olur); `show_stock` aç/kapa (stok kovası); `image_side` Sol / Sağ; `next_product_id` (yarının fırsatı, isteğe bağlı); `after_end` Gizle / Sayaçsız ürün bölümü olarak kal.
- **Kurallar:**
  - Bitiş sunucuda kaynaktan okunur, istemciden alınmaz: `price_list`'te fiyat listesinin `ends_at`'i (her okumada listeden, belgeye kopyalanmaz; liste uzatılırsa sayaç yeni bitişi gösterir), `manual`'da belgedeki `offer.ends_at`. Sayaç yalnız onu gösterir. İki kaynakta da bitiş geçmişse `storeLayout` bölümü çıkarır ya da `after_end`'e göre sayaçsız verir. Bölümün kendi `ends_at`'i kaynağın bitişinden sonra olamaz (kayıtta denetlenir).
  - Fiyat ve indirim ürünün fiyatından, sunucuda (`price-display`); bölüm tutar taşımaz (altın kural 5).
  - `price_list`: liste yoksa ya da ürün listede değilse kayıt `storefront_layout.target_unknown` verir; bitişi olmayan liste seçilemez (`storefront_layout.section_invalid`).
  - `manual`: tarih kayıtta gelecekte ve bölümün `starts_at`'inden sonra olmalıdır. Ürün indirimsiz olabilir; fiyat yine ürünün sunucudaki fiyatıdır. Elle girilen bir tarihtir, tutar değildir; altın kural 5'e dokunmaz.
  - Yayındaki düzenin süreç önbelleği (sürüm + satış kanalı anahtarlı, Ek 2026-11-05) bitiş anını aşmamalı; sayaç sıfırlanınca vitrin sayfayı yenilemeden bölümü kapatır.
  - Stok göstergesi stok kovasıdır (§10 karar 6): ürünün `StockLevel`'ı `low` iken "Az kaldı" (kartın bugünkü ifadesi, adr/0046 Ek 2026-11-04), `out` iken "Tükendi"; `in_stock` iken gösterge yok. Sayı ve yüzde gösterilmez; maketteki doluluk oranı anlatan çubuk çizilmez. Kova bugün kart ve ürün görünüm modelinde var (`@qticaret/ui` `StockLevel`); yeni backend verisi gerekmez.
  - Kişi başı sınır fiyat listesinde yok, promosyon bütçesinde var (adr/0024); ilk turda alan yok.
- **Boyut:** L (fiyat listesi bitişinin yeni okuması, önbellek, sayaç, testler). Elle bitiş ve stok kovası boyutu değiştirmez (ikisi birlikte S).

#### 4.3 Sekmeli raf: `tabbed_products` (SR1 ve bugünkü birleşen raflar)

- **Gruplar:** ana sayfa.
- **Alanlar:** `title`; `variant` `pills` (bugünkü çizim) | `side` (SR1); `tabs` 2–4: `label` (30), `description` (60; yalnız `side`'da görünür), `source` (`products` bölümünün kaynakları), `more` bağlantısı; `limit` (`side`'da 3 / 6); `columns`; `show_count`.
- **Geriye uyum:** art arda duran `products` bölümleri bugünkü gibi birleşmeye devam eder (`blocksOf`); yeni tür bunun açık ve adlandırılmış karşılığıdır, sekmeler tek kimlik ve tek görünürlükle taşınır.
- **Sınırlar:** çok satanlar ve indirimdeki sekmeler var olan seçimden geçer; boş sekme çizilmez, tek sekme kalırsa sekmesiz raf olur. Betiksiz çalışır (`tabs.css` deseni).
- **Boyut:** M.

#### 4.4 Görünümü satın al: `shop_the_look` (GS1)

- **Gruplar:** ana sayfa, kategori sayfası.
- **Alanlar:** `image` (alt metni zorunlu); `points` 1–8: `product_id`, `x` ve `y` görselin yüzdesi (0–100, tam sayı; panelde görsele tıklanarak konur, klavyeyle de taşınır, sürükleme zorunlu değil); `title`, `text`; `bulk_add` aç/kapa; `image_side` Sol / Sağ.
- **Kurallar:**
  - Noktalar ve liste aynı numaraları taşır; nokta odaklanabilen bir düğmedir ve ürün satırına götürür.
  - Toplam yalnız gösterimdir; sepete ekleme var olan sepet akışıyla, satır başına sunucu fiyatıyla. Toplu ekleme yalnız tek varyantlı ve stokta ürünleri ekler (`QuickAddView`); çok varyantlı ürün "Seçenekler" ile ürün sayfasına gider.
  - Yayında olmayan ürünün noktası düşer; nokta kalmazsa bölüm çıkar (L8).
- **Backend:** çok satırlı sepete ekleme vitrin eyleminde yeni (doğrulanmadı).
- **Boyut:** L.

### 5. Üst bilgi, menü ve alt bilgi biçimleri

Bugün üst bilgiyi belgede yalnız `announcement_bar`, tema ayarında `header.layout` ve `header.sticky` yönetir; alt bilgi temanın sabit çizimidir, belgede yalnız bülten var. N12, N14, M7, MT1, AB1, AB3 için üç model tartıldı:

| | (a) Tema ayarı genişler (`header.layout`'a yeni değerler, `header.*` alanları) | (b) Ana bölüm: üst bilgi grubunda tek `header_bar`, `variant` ve alanlarıyla | (c) Her biçim ayrı bölüm türü |
| --- | --- | --- | --- |
| Taslak, önizleme, yayın | adr/0063 §3 ile tema ayarı da taslağa giriyor; ikisi de olur | Var olan yol | Var olan yol |
| Biçime özgü alanlar | `themeSection` her biçimin alanını taşır, büyür | §2'nin kuralıyla, bölüm formunda | Tür sayısı büyür; biçim değişimi tür değişimi olur |
| Düzenleyici | "Tema ayarları"nda, ağaçta üst bilginin yanında değil | Ağaçta "Üst bilgi" altında, kullanıcının aradığı yerde | Aynı |
| Gelişmiş CSS (§8) | Bölüm kutusu yok | Bölüm kutusu var | Var |
| Tutarlılık | Ayrı model | Kategori ve ürün sayfasının ana bölümüyle aynı desen | Ayrı |

**Seçilen: (b), dört ana bölümle tek desen** (§10 karar 2). "Ana bölüm" grupta en çok bir kez duran, silinemeyen ve gizlenemeyen, belgede yoksa varsayılanıyla okunan bölümdür (Shopify'daki "main" bölümünün karşılığı).

- **`header_bar`** (üst bilgi grubu): `variant` `standard` (bugünkü) | `centered` | `catalog` (N14) | `shrinking` (N12). Ortak alanlar: arama yer tutucusu, hesap ve favori görünürlüğü, `sticky`, `phone_menu` `sheet` (bugünkü) | `layered` (MT1).
  - **Okuma:** belgede `header_bar` yoksa `header.layout` ve `header.sticky` tema ayarından okunur (`withLegacy` deseni; `centered` → `centered`). İlk kayıt değerleri bölüme yazar; panel o günden tema ayarındaki iki alanı göstermez. Ortalanmış çizim adr/0062 karar 6'daki dalda kalır; bu bölüm yalnız onun adını taşır.
  - **Ek 2026-11-15 (sahip isteği: katalog üst bilgisi):** `catalog` (N14) çiziliyor ve seçilebilir. Sahibin referansı (klasik teknik katalog mağazası) üzerine N14'ün alanlarına dört isteğe bağlı ek geldi; alanlar yalnız `catalog` dalında, hepsi varsayılanlı, kayıtlı düzenler aynen okunur (migration yok). N14'ten: `search_placeholder` (60, boş: vitrinin kendi yazısı), `search_label` yazılı "Ara" düğmesi (kapalı), `account_text` yardımcı şeritte yazılı "Hesabım" (açık; simge menü çubuğunda hep durur), `cart_total` sepet doluyken simgenin yanında ara toplam (kapalı), `highlight_link` menü çubuğunda ana menünün sonunda vurgulu tek bağlantı (menü bağlantısı şeması; kayıtta hedefi denetlenir, okumada kırık olan çizilmez). Ekler: `utility_bar` ince açık şerit (mağazanın `top` menüsü + Hesabım; açık; telefonda gizli, masaüstünde sayfa aşağı kayarken katlanır), `phone` mağaza bilgilerindeki telefon "Müşteri hizmetleri" etiketiyle aramanın sağında (açık; telefon yoksa çizilmez), `categories_button` menü çubuğunun başında "Kategoriler" düğmesi (açık; üst kategoriler dikey listede, alt kategorisi olan yana panel açar; ek istek yok, çerçevenin okuduğu kategori listesinden), `menu_ground` menü çubuğu zemini Koyu / Ana renk / Açık (`stage` / `primary` / `light`, kayan yazının adları; Koyu varsayılan; yazı rengi zeminin ölçülü ön rengi). Para birimi/dil seçimi kapsam dışı. Telefonda üst bilgi standart çizimin satırlarıyla aynı kalır. Şerit ve telefon açıkken duyuru çubuğu üst bağlantıları ve telefonu ikinci kez basmaz. Panel: temel altı alan "İçerik"te açık, yazılı arama düğmesi / Hesabım yazısı / sepet tutarı kapalı "Diğer ayarlar"da; hepsi ayar aramasında.
- **`usage_menu`** (üst bilgi grubu, en çok bir): M7'nin paneli. Yapı menüde, sunuş belgede kalır: menüler modülü değişmez, migration yok, panel içeriği taslağa ve sürüme girer. Paneli açan öge `header_bar`'da yazılır (`usage_menu_label`, konum İlk / Son); menü bağlantılarının kimliğine bağlanmaz, çünkü hazır görünüm menüleri değiştirince (adr/0063 §3) kimlikler değişir.
- **`footer_bar`** (alt bilgi grubu): `variant` `ledger` (bugünkü Grafit) | `columns` (AB1) | `dark_rich` (AB3). Alt bilgideki `newsletter` bölümü yerinde kalır; `dark_rich` bülteni kendi içinde çizer ve iki bülten basılmaz.
- **`category_main`, `product_main`:** §7.
- Üst bilgi grubunun sınırı 3'ten 5'e çıkar (`announcement_bar`, `marquee`, `header_bar`, `usage_menu`; her tür bir kez). Ana bölümler hazır görünümlerin `layout.json`'unda diğer bölümler gibi yazılır.

### 6. Ortak görünüm ayarları ve etiket ilkesi

- **Alan kümesi `look`** (bütün gövde bölümlerinde ve ana bölümlerde; `null` = temanın kendi çizimi, saklanan belgeler değişmez):

  | Alan | Etiket | Seçenekler | Temadaki karşılığı |
  | --- | --- | --- | --- |
  | `space_outer` | Dış boşluk <small>margin</small> | Yok / Dar / Orta / Geniş | 0, `--section-gap-s`, `--section-gap`, `--section-gap-l` |
  | `space_inner` | İç boşluk <small>padding</small> | Yok / Dar / Orta / Geniş | `--space-*` ölçeğinden, tema seçer |
  | `ground` | Zemin <small>background</small> | Sayfa / Kuyu / Sahne / Ana renk | `paper`, kuyu, `stage`, `--primary`; çiftler temada ölçülmüş, serbest renk yok |
  | `align` | Hizalama <small>text-align</small> | Sola / Ortaya | Başlık ve metin bloğu |
  | `width` | Genişlik <small>width</small> | Dar / Kutulu / Tam | Okuma genişliği, `Container`, kenardan kenara |

  - Bir alan biçimde anlamsızsa (ör. `marquee`'de hizalama) panel onu göstermez; şema yine kabul eder, tema yok sayar.
  - "Ana renk" zemininde karşıtlık yalnız büyük yazı ve denetimler için güvencededir (adr/0062 §6, 3:1); uzun metin taşıyan bölümde (`rich_text`, `faq`) panel bu seçeneği sunmaz.
- **Etiket ilkesi** (planın "İlke" bölümü):
  - Her alanın iki i18n anahtarı var: `label` (Türkçe, gündelik) ve isteğe bağlı `term` (küçük teknik terim). Arama ikisinde de, Türkçe büyük/küçük harfe ve aksana duyarsız çalışır (`toLocaleLowerCase("tr")`; "ı" ile "i" eşleşir); sonuç alanı açar ve vurgular.
  - Ayar araması düzenleyicinin sol panelinin üstündedir; bölüm adlarını, biçim adlarını ve alanları arar. Alan listesi formlardan türetilen tek bir kayıttır (`editor/forms/field-registry.ts`), elle ikinci liste yazılmaz.
  - Bölüm açılınca içerik alanları ve "Biçim" görünür; "Görünüm ayarları" kapalı gelir; "Gelişmiş CSS" en altta, ayrı ve kapalıdır, yalnız yetkili role görünür.
  - Her alanda "varsayılana dön"; seçenekler küçük çizimlerle (hizalama, biçim, düğme stili).

### 7. Kategori ve ürün sayfası düzenleri

- **Kategori: `category_main`** (kategori grubunda bir tane; diğer bölümler `placement`'larını korur, ana bölüm sıraya girmez):
  - `variant` `standard` (bugünkü liste, varsayılan) | `showcase` (KT1) | `technical` (KT2) | `hub` (KT3) | `quick` (KT4). Belgedeki `variant` mağaza genelindeki varsayılan düzendir.
  - `showcase`: alt kategori sekmeleri aç/kapa, çubukta en çok 6 filtre (özellik şablonundan, sıralı), 0–2 editoryal kutu (yazı ya da kampanya bağlantısı + kaçıncı satır). Kart oranı tema ayarından.
  - `technical`: 0–5 sütun (özellik alanı), sütuna göre sıralama aç/kapa, satırda adet aç/kapa, kurumsal alım notu (metin + bağlantı), karşılaştırma aç/kapa (Faz 4).
  - `hub`: öne çıkan alt kategori, en çok 6 kısayol (simge, başlık, alt metin, filtre sayfası), çok satan rafı (kategorinin çok satanları ya da elle 4), seçim rehberi (görsel, en çok 3 adım, bağlantı). Öne çıkan alt kategori ve kısayollar her kategoride farklıdır, ortak ayarda tutulamaz: ilk turda kategorinin kendi alt kategorilerinden türetilir (sıra ve görsel kategori kaydından); ortak ayarda yalnız gösterim tercihleri durur (kısayol sayısı, rafın kaynağı, rehber). Kategori başına elle içerik gerekirse ayrı bir ekle kategori kaydına girer.
  - `quick`: kartta seçenek türü, hızlı bakış aç/kapa, sayfa sonu Daha fazla göster / Sayfa numaraları, en çok 6 hızlı filtre çipi.
  - **Kapsam: kategori başına seçim** (§10 karar 11). Her kategori için ayrı düzen seçilebilir; seçilmemiş kategori `category_main.variant`'ı, yani mağaza genelindeki varsayılanı çizer. Alt kategori üst kategorinin seçimini devralmaz. Taslaktaki `leaf_variant` alanı düşer. Gruptaki diğer bölümler bütün kategorilerde ortak kalır (Ek 2026-11-03).
  - **Biçim ayarları biçim başına saklanır.** Aynı anda birden çok düzen yayında olabildiği için `category_main` §2 kural 4'teki (B)'nin tek istisnasıdır: ortak alanlar tabanda, biçime özgü ayarlar `by_variant: { showcase?, technical?, hub?, quick? }` altında, biçim başına bir nesne (§2 tablosundaki (C)). Ayarı olmayan biçim kendi varsayılanlarıyla çizilir. `checkLayout` bütün alt nesneleri denetler (editoryal kutudaki yazı ve kampanya başvuruları dahil); kullanılmayan biçimin ayarı belgede durur, bu bilinen bedeldir.
  - **Veri: kategori kaydında düzen alanı.** Medusa'nın kategori tablosuna dokunulmaz (altın kural 2); seçim `catalog-extension` modülüne yeni bir modelle girer: `category_layout` (`category_id` tekil, `variant`), `category_image` ve `category_restriction` deseniyle. Seçimi olmayan kategorinin satırı yoktur; var olan mağazalarda veri göçü ve doldurma yoktur, yalnız tablo ekleyen bir migration gerekir (`pnpm --filter backend medusa db:generate catalog-extension`). `variant` yazmada `category_main`'in kapalı listesiyle doğrulanır; listeden kaldırılan biçim okumada varsayılana eşlenir (§2 kural 3).
  - **Uç ve panel.** Yazma ucu `category_image` gibi kategori kimliğiyle (`api/admin/category-images/[category_id]` deseni) ve denetim kaydıyla (adr/0011, `api/http/audit/resources/catalog.ts`). Seçim panelde kategori düzenleme ekranında "Sayfa düzeni" olarak yapılır ("Mağaza varsayılanı" + beş biçim); düzenleyici bir kategoriyi önizlerken o kategorinin seçimini gösterir ve kategori ekranına bağlantı verir. Vitrin kategori sayfası seçimi kategoriyle birlikte okur (hangi uçla olacağı kodlarken seçilir); seçim değişince vitrin yenilemesi `subscribers/storefront-refresh.ts`'e eklenir.
  - **Sonuç: seçim taslağa girmez.** Kategori kaydı kaydedilince yayındadır (kategori görseli gibi); düzen taslağına, önizlemeye ve sürüm geçmişine girmez, "Yayınla" ile gitmez. Bu, adr/0063 §3'ün tema ayarını ve menüleri belgeye alma gerekçesiyle gerilimdir ve kabul edilen bedeldir. Biçimin ayarları (`by_variant`) belgede olduğundan taslaktadır; panel, ayarı yalnız taslakta olan bir biçimi kategoriye atarken vitrinin yayındaki ayarı (yoksa varsayılanları) çizeceğini söyler.
  - **Hazır görünümler** (adr/0063 Ek 2026-11-14) varsayılan düzeni belgedeki `category_main.variant`'a, demo kategorilere örnek atamaları tutamaçla (`{ "$handle": "category:…" }`) kategori kayıtlarına yazar. Bu, belge dışında bir yazmadır: görünüm uygulamasının ayrı bir adımıdır ve compensation'ı önceki atamaları geri yazar (altın kural 4 deseni).
  - **Backend:** listede satır başına özellik değerleri (KT2, doğrulanmadı); kategoriye süzülen çok satanlar (bugün mağaza geneli); kartta seçenekler ve hızlı bakış (KT4; bugün `QuickAddView` yalnız tek varyant); "daha fazla göster" için sayfalı uç (doğrulanmadı). KT2 ve KT4 Faz 4 ile örtüşür.
- **Ürün: `product_main`** (ürün grubunda, diğer bölümlerin üstünde):
  - `variant` `standard` (bugünkü galeri ve satın alma sütunu) | `gallery_wall` (UP3; sahibin seçtiği varsayılan).
  - `gallery_wall`: duvar düzeni İkili ızgara / Tek sütun / İlk görsel geniş; ölçü çizimi Göster / Gizle (verisi doğrulanmadı); akordeon sırası ve ilk açık olan; en çok 3 güven satırı (`settings.trust_badges`'tan seçim); telefonda yatay şerit ve sayaç.
  - VS1 ve SK2 ayrı biçim değil, `product_main`'in ortak alanlarıdır: `option_style` Liste / Yuvarlak ve çip; `buy_box` Sade / Güven yoğun. SK2'nin ile göre teslim çizelgesi ve havale indirimi Faz 5 ile örtüşür (doğrulanmadı).
  - Ürünün kendi içeriği (görseller, fiyat, varyantlar) her zaman üründen, vitrinde okunur.

### 8. Bölüm başına gelişmiş CSS (E8)

Çerçeveyi sahip kararı verdi (planın "Karar" bölümü); burası uygulamanın kuralıdır.

- **Saklama.** Ana bölümler dahil her bölümde `custom_css: string | null`. Ayrı kayıt yok; bölümle birlikte taslağa, önizlemeye, yayına ve sürüm geçmişine girer. Belgede ayrıca `settings.custom_css_enabled` (varsayılan açık): tek anahtarla bütün özel CSS kapanır (destek ve "güvenli mod").
- **Kayıtta süzme, okumada kapsamlama.**
  - Metin backend'de bir CSS ayrıştırıcısıyla ağaca çevrilir, aşağıdaki listelere göre denetlenir ve **ağaçtan yeniden yazılır**: belgeye ham metin değil normalleştirilmiş hâli girer (yorumlar atılır, kaçış dizileri çözülür).
  - Tek bir yasak yapı bütün kaydı `storefront_layout.css_invalid` ile reddeder, satır ve nedenle; sessizce budanmaz.
  - Kapsamlanmış hâl okumada (`storeLayout`) üretilir, yayın sürümüyle önbelleğe girer. Yayın ve geri yükleme metni aynı süzgeçten yeniden geçirir (L4).
- **Kapsamlama yöntemi.**
  - Tema her bölümün dış kutusuna `data-qs="<bölüm kimliği>"` yazar (kimlik `^[a-z0-9]{6,24}$`, seçicide güvenli).
  - Her seçici ağaçta önüne `[data-qs="<kimlik>"]` alarak yeniden yazılır; `:scope` kutunun kendisidir. `@keyframes` adları `qs-<kimlik>-<ad>` olur; `animation-name` yalnız bu adları kullanabilir.
  - Yerel `@scope` tek başına kullanılmaz: tarayıcı desteği doğrulanmadı ve `@import`, `url()`, `position: fixed` gibi yapıları durdurmaz. İleride yeniden yazılmış seçicinin üstüne ikinci kat olarak eklenebilir.
- **Kaskad katmanı.** Atölye'nin giriş stil dosyasının başına katman sırası yazılır: `@layer theme, base, components, utilities, section-css;`. Özel CSS `@layer section-css { … }` içinde basılır ve `!important` olmadan temanın bütün katmanlarını yener. Katmansız kurallar (bugün `tokens.css` değişkenleri) katmanların üstündedir; ama değişken bölüm kutusunda yeniden tanımlanınca kutunun içinde kazanır. Atölye'de özel CSS'in yenmesi gereken katmansız bir kural kalmadığı ve Tailwind v4'ün katman adları kodlarken denetlenir (doğrulanmadı).
- **İzinli yapılar.**
  - Kurallar: stil kuralı; `@media` (genişlik, `hover`, `pointer`, `prefers-reduced-motion`, `prefers-contrast`); `@container`; `@supports`; `@keyframes`. İç içe yazım aynı kurallarla.
  - Seçiciler: tür, sınıf, kimlik, öznitelik (`data-qs` hariç); birleştiriciler (boşluk, `>`, `+`, `~`); sözde sınıflar `:hover`, `:focus`, `:focus-visible`, `:focus-within`, `:active`, `:first-child`, `:last-child`, `:nth-child()`, `:nth-of-type()`, `:not()`, `:is()`, `:where()`, `:has()`, `:empty`, `:checked`, `:disabled`; sözde ögeler `::before`, `::after`, `::marker`, `::placeholder`, `::first-line`, `::first-letter`, `::selection`.
  - Değerler: sayı, uzunluk, yüzde; renkler (`#`, `rgb()`, `hsl()`, `oklch()`, `color-mix()`); `var()`, `calc()`, `min()`, `max()`, `clamp()`, `env()`; gradyanlar; dizgiler (`content` için).
  - Tema kancaları: Atölye bölümlerinde belgelenmiş `data-part` öznitelikleri (`title`, `text`, `media`, `button`, `item`) desteklenen yüzeydir; sınıf adları sözleşme değildir.
- **Yasak yapılar.**
  - Kurallar: `@import`, `@font-face`, `@namespace`, `@layer`, `@property`, `@page`, `@charset`, `@scope`, `@counter-style`, `@font-feature-values`, `@font-palette-values`, `@view-transition`, `@position-try`, `@starting-style` ve izinli listede olmayan her `@` kuralı.
  - Seçiciler: `:root`, `html`, `body`, `:host`, `:host-context()`, `::backdrop`, `::view-transition` ailesi, `:modal`, `:fullscreen`, `:popover-open`, `::part()`, `::slotted()`, `data-qs` özniteliği; izinli listede olmayan her sözde sınıf ve öge.
  - İşlev ve değerler: `url()`, `image()`, `image-set()`, `cross-fade()`, `element()`, `src()`, `attr()`, `expression()`, `-moz-binding`, `behavior`; `!important`; `<` karakteri (birleştirici `>` dışında açılı ayraç yok); denetim karakterleri. Kaçış dizileri çözüldükten sonra liste yeniden uygulanır.
  - Özellikler: `position: fixed` ve `position: sticky` (kutudan çıkıp sayfayı örter; ödeme benzeri sahte katman riski); 100'den büyük `z-index`; 200 karakterden uzun `content` dizgisi; kutunun kendisinde `pointer-events: none`.
  - Listeler testli sabitlerde durur, yalnız ADR ekiyle değişir. Neden `url()` tümden yasak: vitrinin `img-src`'i her https adresine açık (`csp.ts`); dış görsel ziyaretçiyi izlemenin ve bilgi sızdırmanın yoludur. Görsel gerekiyorsa bölümün görsel alanı kullanılır.
- **Uzunluk.** Bölüm başına 4.096 karakter ve 200 kural, belgede toplam 32.768 karakter (§10 karar 8). Toplam vitrin performans bütçesine (docs/21) eklenir.
- **Nerede kapalı.**
  - Gövde bölümleri zaten yalnız kendi sayfalarında basılır.
  - `header_bar`, `marquee`, `usage_menu` ve `footer_bar`'ın CSS'i sepet, ödeme, ödeme bağlantısı, sipariş onayı ve sipariş sorgulama sayfalarında, `CheckoutFrame` altında ve bakım sayfasında **basılmaz**.
  - `custom_css_enabled: false` ve önizlemede panelin "özel CSS'siz göster" düğmesi hepsini kapatır.
- **Yetki.** Yalnız `owner` (adr/0040) yazar, değiştirir, siler. `admin` düzeni bugünkü gibi yazar; ama kayıtta bir bölümün `custom_css`'i taslaktakinden farklıysa ve yazan `owner` değilse kayıt `storefront_layout.css_forbidden` ile reddedilir. Sürüm geri yüklemede de aynı kural geçer. `admin` alanı salt okunur görür. Hazır görünümler CSS taşımaz (adr/0063 §1); görünüm uygulanınca var olan özel CSS silinir, panel uygulamadan önce CSS'i gidecek bölümleri sayar (§10 karar 12).
- **Denetim kaydı** (adr/0011): `storefront_layout`, eylem `custom_css_changed`; bölüm kimliği, önceki ve sonraki uzunluk, normalleştirilmiş metnin özeti (hash). Metnin kendisi sürüm geçmişindedir.
- **CSP etkisi: yok.** Özel CSS temanın değişkenleriyle aynı nonce'lu `<style>` öğesinde ya da hemen ardından ikinci nonce'lu öğede basılır; `unsafe-inline` eklenmez, `style-src-attr` değişmez. `font-src 'self'` dış yazı tipini zaten durdurur. `</style>` kaçışı: `<` yasak ve çıktı ağaçtan yazılıyor; vitrin basmadan önce `<` olmadığını ayrıca denetler (iki kat).
- **Panel.** Bölüm formunun en altında kapalı "Gelişmiş CSS": yeni bağımlılık eklemeden kod alanı (satır numarası, hatalı satırın vurgusu), kullanılabilecek kancaların listesi, "kapsam: yalnız bu bölüm" örneği ve sabit uyarı: "Tema güncellemesinde bozulabilir; destek kapsamı dışındadır." Geri al/yinele alan başına.
- **Test yaklaşımı.**
  - Birim: her yasak maddeye en az bir örnek (kaçışla gizlenmiş `u\72l(`, yorumla bölünmüş `ur/**/l(`, büyük harfli `URL(` ve `@IMPORT`, `</style>`, `<!--`, Unicode boşluklar, `@media` içinde `@import`); idempotentlik (süzülmüş çıktı yeniden süzülünce aynı); her seçicinin önünde kutu; `@keyframes` adlarının yeniden yazılması; uzunluk sınırları.
  - HTTP: `owner` yazar, `admin` reddedilir (kayıt ve geri yükleme); denetim kaydı; önizleme taslağın CSS'ini, yayın yayındakini verir; `custom_css_enabled: false`.
  - Vitrin ve e2e (Playwright): bir bölümün CSS'i komşu bölümün hesaplanmış stiline dokunmaz; sepet ve ödeme sayfalarında `section-css` katmanı yok; CSP ihlali yok; `prefers-reduced-motion` korunur.
  - `security-reviewer` incelemesi zorunlu (süzgeç, yetki, basım yeri).
- **Riskler.**
  - Süzgeç atlatma (ayrıştırıcının tarayıcıdan farklı okuduğu girdi). Azaltma: yasak listesi değil izin listesi, ağaçtan yeniden yazma, idempotentlik testi, `<` yasağı.
  - Tema güncellemesinde kırılma: sınıf adları sözleşme değil; `data-part` kancaları belgelenir, değişirse sürüm notuna girer.
  - Kendi bölümünde yanıltıcı görünüm (`content` metni) önlenemez; yazan mağaza sahibidir, denetim kaydı ve sürüm geçmişi vardır.
  - Karşıtlık ve erişilebilirlik denetlenemez; panel uyarır.
  - Yeni bağımlılık: backend'e doğrudan bir CSS ayrıştırıcısı (`postcss` + seçici ayrıştırıcısı ya da `css-tree`) girer; depoda hangisinin bulunduğu doğrulanmadı, seçim Context7 ve lisans denetimiyle yapılır.
- **Reddedilen alternatifler.**

  | Seçenek | Neden reddedildi |
  | --- | --- |
  | Mağaza geneli serbest CSS, tema kodu düzenleme | Sahip reddetti; kapsamlanamaz, sepet ve ödemeye sızar |
  | Yalnız iç içe yazımla sarmak (`[data-qs] { … }`) | `@import`, `url()`, `position: fixed`'i durdurmaz; ham metin basılır |
  | Yalnız yerel `@scope` | Tarayıcı desteği doğrulanmadı; tehlikeli yapıları durdurmaz |
  | Bölüm başına Shadow DOM | Sunucu çiziminde bildirimsel Shadow DOM gerekir; temanın stilleri içeri girmez |
  | Bölüm başına `iframe` | Performans, erişilebilirlik ve SEO maliyeti |
  | Satır içi `style` öznitelikleri | `style-src-attr`'ı gevşetir; sözde sınıf ve medya sorgusu yok |
  | İstemcide süzme | Atlatılır |
  | `!important`'a izin | Katman sırası onu gereksiz kılar; katmanlarda önemli kurallar ters sıralanır, temayı beklenmedik yerden ezer |

### 9. Uygulama sırası

| # | İş | Boyut | Bağımlılık | Paralel |
| --- | --- | --- | --- | --- |
| V1 | Altyapı: `layout-sections.ts`'in tür başına dosyalara bölünmesi; `variant` kuralı (preprocess, iç birleşim, okuma eşlemesi); `@qticaret/types` ve `@qticaret/ui` biçim listeleri; vitrin görünüm modeli; temada varsayılana düşme; panelde "Biçim" seçici; testler | M | Yok | adr/0063 iş 2.1, 2.2 ile |
| V2 | Ortak `look` alanları ve tema eşlemesi; alan kaydı ve ayar araması | M | V1 | V3 ile |
| V3 | Ana bölümler: `header_bar` (`header.layout` okuma eşlemesiyle), `footer_bar`, `category_main` (`by_variant` istisnasıyla, §7), `product_main`; üst bilgi grubunun sınırı | M | V1 | V2 ile |
| A | Üst ve alt bilgi: N14 (M), N12 (M), MT1 (M), AB1 (M), AB3 (M), DY3 (M), M7 `usage_menu` (L) | L | V3 | B–F ile |
| B | Giriş ve bantlar: E2 + KB2 + GB2 (M), GB4 (S), H17 + kategori sayımı (M-L), H11 (L) | L | V1; H11 E'deki sayaç verisinden sonra | A, C–F ile |
| C | Raf ve kart: UR5 (S, yalnız doğrulama), E6 (S), `tabbed_products` (M), rafta kart biçimi geçersiz kılma + raf başına kart verisi (M; karar 4), `framed` kart + E5 + ikinci görsel (M-L), `technical` kart (L) | L (karar 4 ile bir M büyüdü) | V1; kart biçimi adr/0063 iş 2.1'den sonra; `technical` Faz 4 kart verisiyle | A, B, D–F ile |
| D | İçerik bölümleri: KK2 (M), KK4 (M), OU2 (M), MR1 (S), MR2 (M), YR1 (M), RH3 (M-L), BL2 (M) | L | V1 | A–C, E, F ile; tür dosyaları ayrı, ajanlar çakışmaz |
| E | Yeni türler: `marquee` (M), `timed_offer` + fiyat listesi bitişi okuması + elle bitiş + stok kovası (L), `shop_the_look` + çok satırlı sepete ekleme (L) | L | V1, V2 | A–D, F ile; sepet ve fiyata dokunduğu için `security-reviewer` |
| F | Kategori ve ürün düzenleri: KT1 (M), KT3 (M-L), KT2 (L), KT4 (L), UP3 + VS1 + SK2 alanları (M) | L | V3; KT2 ve KT4 Faz 4'ten sonra | A–E ile |
| F1 | Kategori başına düzen seçimi: `catalog-extension`'a `category_layout` modeli + migration, admin ucu ve denetim kaydı, panel kategori ekranında "Sayfa düzeni", vitrinde kategori başına biçim okuması, yenileme; hazır görünümün örnek atama adımı (compensation'lı) | M (karar 11 ile yeni) | V3 | A–E ile; F'nin çizimleriyle aynı anda yürür, migration yalnız bu işte |
| G | Gelişmiş CSS: süzgeç, kapsamlama, katman sırası, yetki, denetim kaydı, basım yerleri, panel alanı, testler | L | V1–V3 ve iki takımın biçimleri (sahip kararı: en son) | Yok; tek ajan + güvenlik incelemesi |

- V1 ortak dosyaları tek ajanda değiştirir; sonra A–F tür başına dosyalarda çalışır. `@qticaret/ui` görünüm türleri ve panelin `section-meta.ts`'i ortak noktadır: her ajan yalnız kendi türünün girdisini ekler, çakışma birleştirmede çözülür.
- Her biçim: şema, `checkLayout`, `storeLayout`, görünüm modeli, Atölye çizimi, panel formu, `design.md` kuralı; HTTP, birim, panel ve vitrin testleri. Çizimler sahip vitrinde görüp onaylayınca `dev`'e girer.
- Kararların sıraya ve boyuta etkisi: karar 4 C'ye bir M, karar 11 yeni F1'i (M) ve V3'e `by_variant` istisnasını ekler; ekin tek migration'ı F1'dedir (`catalog-extension`). Karar 5 ve 6 E'nin boyutunu değiştirmez; karar 1, 2, 3, 7–10, 12 taslaktaki tahminleri değiştirmez. Toplamda iki M büyür; sıra değişmez, G yine en sondadır.
- Faz 2'deki yeri: V1–V3 adr/0063 iş 2.5'in yerini alır; A–F ve F1 iki yeni hazır görünümün (adr/0063 Ek 2026-11-14) önkoşuludur (F1 demo kategorilerdeki örnek atamalar için).

### 10. Sahip kararları (2026-11-14)

Sahip 4, 5, 6 ve 11'i kendisi seçti; teknik ve küçük kararlarda "önerilerle ilerle" dedi (2026-11-14), kalanlar önerilen seçenekle kapandı.

1. **Biçime özgü alanların şeması.** (A) düz, hepsi isteğe bağlı; (B) `variant`'a göre ayrık birleşim, ortak içerik tabanda; (C) bütün biçimlerin ayarını saklayan alt nesne. **Karar: B** (öneriyle, sahip yetkisiyle). İstisna: `category_main` biçim ayarlarını biçim başına saklar (§7), çünkü karar 11 ile birden çok biçim aynı anda yayındadır.
2. **Üst bilgi modeli.** (a) tema ayarı genişler; (b) `header_bar` ana bölümü; (c) biçim başına ayrı tür. **Karar: b** (öneriyle, sahip yetkisiyle).
3. **M7 menü içeriği nerede.** (a) menüler modülü genişler (sekme, simge, ürün; migration; hemen yayında); (b) düzen belgesinde `usage_menu` (taslak, önizleme, sürüm). **Karar: b** (öneriyle, sahip yetkisiyle).
4. **Kart biçiminin kapsamı.** (a) tema genelinde tek; (b) raf başına; (c) genel + raf başına geçersiz kılma. Öneri a idi. **Karar: c** (sahip). Tema ayarındaki `product_card.variant` her yerin biçimidir; `products` ve `tabbed_products` raflarında `card_variant` onu geçersiz kılar (§3.3). İş C'ye bir M ekler.
5. **Sayacın kaynağı (FS1, H11, E7).** (a) bölümün kendi bitişi (elle); (b) fiyat listesinin bitişi (gerçek kampanya, yeni okuma); (c) promosyon kampanyasının bitişi. Öneri b idi. **Karar: a ve b birlikte** (sahip). Varsayılan gerçek indirimin, yani fiyat listesinin bitişi; mağaza sahibi isterse bölüme elle bitiş tarihi girer (ör. indirimsiz duyuru). Elle tarihte de süre bitince bölüm `after_end`'e göre kapanır ya da sayaçsız, normal hâline döner (§4.2). c bu ekte yok.
6. **FS1 stok çubuğu.** "Stok sayısı gösterilmez" kuralıyla çakışıyor. (a) çubuk yok; (b) sahibin girdiği kampanya adedine göre yüzde; (c) stok kovası ("Az kaldı"). **Karar: c** (sahip). Sayı ve yüzde gösterilmez (§4.2).
7. **Kategori başına ürün sayısı (H17, MR2, SR1).** (a) vitrin bugünkü gibi kategori başına istek atar; (b) backend tek sorguda sayar ve önbelleğe alır; (c) sayı gösterilmez. **Karar: b** (öneriyle, sahip yetkisiyle).
8. **Gelişmiş CSS uzunluğu.** Bölüm başına 2 / 4 / 8 KB; belgede 16 / 32 / 64 KB. **Karar: 4 KB ve 32 KB** (öneriyle, sahip yetkisiyle).
9. **Kayan yazının üst bilgideki yeri.** (a) duyuru şeridinin yerine; (b) duyuru şeridiyle birlikte, ikisi de en çok bir; (c) yalnız gövdede. **Karar: b** (öneriyle, sahip yetkisiyle).
10. **Sepet, ödeme ve onay maketleri (SC1, SP1, OD1, SO1).** (a) bu eke girmez, ayrı ADR (ödemeye dokunur, test zorunlu); (b) tema ayarı olarak bu ekte. **Karar: a** (öneriyle, sahip yetkisiyle).
11. **Kategori düzeni bütün kategorilerde mi?** (a) tek düzen; (b) kategori kaydında kategori başına seçim; (c) tek düzen + "alt kategorisi olmayanda şu biçim" alanı. Öneri c idi. **Karar: b** (sahip). Her kategori için ayrı düzen seçilebilir; seçilmemişse mağaza genelindeki varsayılan düzen geçerlidir. Seçim `catalog-extension`'da yeni `category_layout` modelinde durur (tablo ekleyen bir migration, veri göçü yok) ve taslağa girmez (§7). İş yeni F1'i (M) ekler.
12. **Hazır görünüm uygulanınca var olan özel CSS.** (a) silinir, panel önceden söyler; (b) aynı kimlikli bölümde korunur. **Karar: a** (öneriyle, sahip yetkisiyle; görünüm başka bölüm kimlikleri yazar, eşleşme yanıltıcı olur).

### Doğrulanmayanlar (bu ek yazılırken)

- Zod 4'te iç içe ayrık birleşimin `preprocess` ile hata anahtarını koruyarak çalışması.
- Tarayıcılarda `@scope` desteği; Tailwind v4 katman adlarının Atölye derlemesindeki sırası; Atölye'de katmansız kural kalıp kalmadığı.
- Depoda bir CSS ayrıştırıcısının (`postcss`, `css-tree`) doğrudan bağımlılık olarak bulunup bulunmadığı.
- `storefrontLink`'te WhatsApp hedefi; çok satırlı sepete ekleme; listede satır başına özellik değerleri; sayfalı "daha fazla göster" ucu; marka ve kaynak başına ürün sayısı; yazıdan ilgili ürün türetme; bülten karşılık kodunun gösterimi; ürün ölçü çizimi verisi; "aynı gün" teslimat verisi; yorumlarda elle seçim ve puana göre sıra.
- Fiyat listesi bitişinin store tarafına hangi uçla verileceği (backend `listPriceLists` ile okuyor; uç yok).

### Ek 2026-11-14 (Deniz): Katalog ana sayfası

- **Dayanak:** sahibin seçtiği ana sayfa maketi "B, Katalog" (renk düzeltmesiyle: sarı, krem ve bakır tonu yok; Grafit'in kendi zeminleri ve sinyal rengi). Oğuzhan'ın V1–V3 altyapısı üstüne kuruldu; H17 bu işe alındı.
- **H17 `hero` `category_list`** (§3.2 tablosundan farkları): §2 kural 4 (B) ile ortak alanlar (üst satır, başlık, metin, en çok 2 düğme, görsel) her iki biçimde aynı; `category_list`'in kendi alanları:
  - `list`: `{ kind: "top" }` (varsayılan) | `{ kind: "menu" }` (üst menünün kategori bağlantıları) | `{ kind: "manual", category_ids }` (1–12); `list_limit` 4–12 (9); `show_count` (açık).
  - `tiles`: en çok **2** kategori karosu (`category_id`, isteğe bağlı `image`; boşsa kategorinin görseli, o da yoksa en yeni ürün fotoğrafı). Tablodaki "3 görsel karo"nun üçüncüsü girişin kendi görselidir.
  - `chips`: en çok 4 hızlı bağlantı (`storefrontLink`); kategori bağlantısı küçük görseliyle çizilir.
  - Tabloda olmayan iki alan (maketteki "başlangıç fiyatı" ve renk seçenekleri): `picks` en çok 4 ürün (`product_id`, isteğe bağlı kısa ad 24) ve `show_price`. "Başlangıç fiyatı" seçilen ürünlerin vitrin sunucusunda canlı fiyatından en düşüğüdür; belgede tutar yok (altın kural 5).
  - Hazır görünümde bir karonun ya da seçilen ürünün tutamacı çözülmezse adr/0063 §4 kuralıyla bütün giriş düşer (tek kayıt alanı `*_id`); yayında canlı olmayan karo, ürün ya da seçili kategori yalnız kendisi düşer, seçili liste boşalırsa ana kategoriler gösterilir.
  - Okumada `standard` giriş bugünkü gibi `variant`'sız basılır; vitrin yoksa `standard` okur.
- **Yeni tür `price_bands` (fiyat bantları):** ana sayfada. Alanlar: `title`; `bands` 2–4, her bant `label` (30, `{belirteç}` alır), `text` (80, isteğe bağlı), `max` (tam TL, 1–10.000.000; `null` = "ve üzeri", yalnız son bant); üst sınırlar artar (`storefront_layout.price_bands_order`); `thumbs` 0–4 (3). Bandın aralığı önceki bandın sınırından kendi sınırına kadardır. Ürünler `storeLayout`'ta, ziyaretçinin satış kanallarında, arama dizininin TL fiyatıyla (kartların gösterdiği fiyat) seçilir; stokta olan ve en yeni önce, bir bantta gösterilen sonrakinde tekrar edilmez; yayındaki düzenin dakikalık önbelleğine girer. Vitrin her bandı `/magaza?fiyat=min-max` süzülmüş listesine bağlar (liste bu süzgeci zaten okuyor; süzülmüş sayfa `noindex,follow`). Kategoriye daraltma ilk turda yok.
- **`categories`'e iki ortak alan:** `show_count` (kapalı) ve `more` (başlığın yanındaki bağlantı; boşsa "Tüm kategoriler"). Bugünkü karo çizimi (KK4 değil) sayıyı adın altına yazar. KK2/KK4 biçimleri bu alanları ortak alan olarak taşıyabilir.
- **Kategori başına ürün sayısı (§10 karar 7b):** `GET /store/category-counts` → `{ counts: { [category_id]: number } }`. Her gösterilen kategori için alt ağacındaki (yalnız gösterilen alt kategoriler, liste kapsamıyla aynı `subtreeIn`) yayında ürünler, anahtarın satış kanallarında; arama dizininden tek SQL ifadesiyle (`categoryCountsStatement`), süreçte kanal kümesi başına bir dakika önbellekli, `Cache-Control: public, max-age=60`. Kategori sayfasının sayısıyla aynı kural. `/kategoriler` sayfası şimdilik kendi kategori başına isteğini sürdürür (fotoğraf da aynı istekten geliyor); bu uca geçişi ayrı iştir. Üst bilginin reyon açılır listesi ve telefon çekmecesi de satır başına bu sayıları gösterir (2026-11-15, "M1"; 0 ya da sayılmamışsa hap yok); vitrinde `menus` yenile kapsamı bu ucun önbelleğini de düşürür.
- **Hazır görünüm `katalog`** (`cutlery` paketi, paket sürümü 2): Grafit teması; H17 (ana kategoriler, kamp baltaları ve şef bıçakları karoları, dört hızlı bağlantı), çok satanlar / yeni gelenler / kılıç modelleri sekmeli beşli raf, fiyat bantları (kuyu zemini), mutfak rafı, çeliğe ve sapa göre kategori karoları (sayılı, kuyu zemini), yorumlar. Kategori tutamaçları paketin iskeletinden ve mağazanın geçiş verisinden; bulunamayan bölüm ya da bağlantı adr/0063 §4'e göre düşer. `general` paketine konmadı: tutamaçlar sektöre özeldir.
- **2026-11-15, bant kategorisi:** her bant isteğe bağlı `category_id` alır (`null` = bugünkü fiyat bandı; eski belgeler değişmeden okunur). Kategorili bantta `max` bandın kendi sınırıdır (`null` = fiyatsız, kategorinin tamamı), artma kuralı yalnız kategorisiz bantlar arasında; küçük görseller kategorinin gösterilen alt ağacından, bağlantı kategori sayfası (sınır varsa `?fiyat=-max`). Kayıtta kategori `target_unknown` ile denetlenir; yayında canlı olmayan kategorinin bandı düşer. Hazır görünümde çözülmeyen bant kategorisi bölümü düşürmez, boşalır. `katalog` 2. sürüm: "Koleksiyonluk" → `category:ozel-koleksiyon` (`cutlery` paket sürümü 5).

### Ek 2026-11-15 (sahip isteği): raf biçimleri, kompakt kart, kaydırma takımı

- **Dayanak:** sahibin referans tasarımı (klasik teknik katalog ana sayfası). Raf ve kart ayrı kavramdır: raf dizilişi (`variant`), kart görünümü (`card_variant`, tema ayarı `product_card.variant`) belirler; ikisi bağımsız seçilir. Migration yok: biçimsiz kayıtlı raf `grid` okunur, `columns`'u aynen.
- **`products.variant`** (§2 kalıbı, her biçim kendi dalı; ortak alanlar `title`, `source`, `limit`, `more`, `card_variant`, görünüş her dalda aynı adla):
  - `grid` (varsayılan, bugünkü çizim): `columns` 3/4/5.
  - `carousel`: tek sıra, CSS scroll-snap; `scroller` (aşağıda).
  - `featured`: solda ilk ürün büyük kart, sağda 2 × 3 küçük kart (toplam `SHELF_LIMITS.featured` = 7); küçük kartlar rafın/temanın kart biçimini kullanır; telefonda büyük kart üstte, altında iki sütun.
  - `compact`: kompakt kartlarla üç sütunlu ızgara, `rows` 2/3 (varsayılan 2; ürün sayısı `rows × 3`); telefonda tek sütun.
  - `columns`: yan yana 2–3 liste. Rafın kendi `title` + `source`'u ilk listedir (biçim değişince korunur), `lists` 1–2 ek liste (`title`, `source`; kaynak türleri rafınkilerle aynı), `per_list` 3/4 (varsayılan 4). Kayıtlarını yitiren ek liste okumada düşer; rafın kendi kaynağı yitince raf düşer (bugünkü kural). İndirim ve çok satan kaynakları liste başına sunucuda seçilir (`listKey`: `<id>:<n>`).
  - Ürün sayısı `grid`/`carousel`'de `limit`, diğerlerinde sözleşme sabiti (`@qticaret/types/section-shelf`, backend aynası eşitlik testiyle).
- **Kart `compact`** (`CARD_VARIANTS`, `PRODUCT_CARD_VARIANTS`): yatay küçük kart (görsel solda 80/96 px, ad en çok 2 satır, puan, fiyat ve indirim, küçük rozet), sepete ekle yok, kartın tamamı bağlantı. `compact` ve `columns` rafları kartı her zaman kompakt çizer (panel kart alanını göstermez); tema ayarı seçerse listeler de kompakt çizer.
- **Kaydırma takımı** (`@qticaret/types/section-scroller`; backend `sections/scroller.ts`; panel `forms/scroller-fields.tsx`; tema `parts/Scroller.tsx` + `scroller.css`). Tek nesne alanı `scroller`, adlandırılmış adımlar; eksik adım varsayılanı okunur, kayıtlı adım ezilmez (`prefault`). Alanlar (varsayılan kalın): `desktop` three/**four**/five/six; `mobile` one/**peek** (1,5)/two; `arrows` **always**/hover/hidden; `arrow_style` **round**/square/plain; `arrow_position` **head**/sides; `dots` **off**/on; `autoplay` **off**/on; `speed` slow/**medium**/fast; `loop` **off**/on; `drag` **off**/on. Otomatik geçiş üzerine gelince ve odakta durur, görünür durdur düğmesi (WCAG 2.2.2), `prefers-reduced-motion`'da çalışmaz. Oklar `button` + `aria-label`, döngü kapalıyken uçta `disabled`; bölge `role="region"` + etiket; oklar gizliyken de dokunma ve klavye ile kayar. Sayı ve stiller data-özniteliği + sınıf (satır içi stil yok). Bu işte yalnız ürün rafına bağlandı; görsel bant, blog, markalar sonra aynı takımı alır.
- **Sekmeler:** art arda duran raflar sekmeli tek rafa birleşmeye devam eder, her panel kendi biçiminde çizilir; `columns` rafı birleşmez (kendisi yan yana listedir) ve iki yanındaki rafları da ayırır.
- **Panel düzeni:** İçerik (başlık, kaynak, adet yalnız grid/carousel, ek listeler) → açık **Diziliş** (biçim seçici çizimleriyle, biçime göre sütun/sıra/liste başına ürün, kart biçimi) → yalnız `carousel`'de açık **Kaydırma** (görünen sayı, oklar) → kapalı **Diğer ayarlar** (noktalar, otomatik geçiş + süre, döngü, sürükleme, görünüş). Biçimde anlamsız alan gösterilmez; her alan ayar aramasında.
- **Açık kalan:** "puana göre" kaynağı backend'de yok (ayrı iş); "çok satan" kaynağı (`best_sellers`) zaten vardı ve listelerde de kullanılabilir.

### Ek 2026-11-15 (Oğuzhan): kategori kartları, alt bilgi ekleri, yukarı çık

- **Dayanak:** sahibin referans tasarımı (klasik teknik katalog ana sayfası). Migration yok: biçimsiz kayıtlı kategori bölümü `tiles`, ayarsız kayıtlı alt bilgi bugünkü gibi okunur; her yeni alanın varsayılanı bugünkü çizimdir.
- **`categories.variant`** (§2 kalıbı; `@qticaret/types/section-categories`, backend `sections/categories.ts` aynası eşitlik testiyle): `tiles` (varsayılan, bugünkü görselli karolar; okumada `variant` basılmaz) ve `linked` (alt kategorili kart). Ortak alanlar (`title`, `category_ids`, `show_count`, `more`, görünüş) iki biçimde aynı. `linked`'in kendi alanları (varsayılan kalın): `columns` 2/**3**/4 (geniş ekranda; dar ekranda tema azaltır), `image_position` **side**/top/none (görseli olmayan kategoride baş harf), `frame` **lined**/plain, `links` 0–8 (**5**; adın altındaki alt kategori bağlantısı). Biçim değişince `linked` alanları varsayılanlarla başlar, `tiles`'a dönünce düşer.
  - Sayılar `linked` kartlarda her sayfada gösterilir (karolar yalnız ana sayfada). Sayı ucu varsa ürünü olmayan alt kategori düşer; yoksa hepsi gösterilir. "Tümünü gör" yalnız en az bir alt kategori gösterilirken çıkar.
- **Alt bilgi (`footer_bar`) ayarları** (her alt bilgi biçiminde ortak; `@qticaret/types/section-footer`, backend `sections/footer-bar.ts`): `social` **text**/icons/hidden; `payment_badges` (`visa`, `mastercard`, `troy`, `amex`, `bank_transfer`, `cash_on_delivery`, `installments`; sıra kaydın sırası, tekrarsız; vars. **boş**); `back_to_top` (vars. **kapalı**), `back_to_top_side` **right**/left, `back_to_top_shape` **round**/square, `back_to_top_mobile` (vars. **açık**). Store çıktısı yalnız varsayılandan farklı alanları basar (ayarsız alt bilgi bugünkü `{ id, type, variant }`); admin taslağı hepsini taşır.
- **Kararlar:**
  - Sosyal adresler için yeni liste açılmadı: kaynak var olan Mağaza ayarı `same_as` (en çok 10, yalnız https). Ağ adresin alan adından tanınır. Simgeler: Instagram, YouTube, TikTok kendi çizimimiz; WhatsApp var olan `WhatsAppGlyph`; Facebook, X, LinkedIn, Pinterest harf rozeti (marka logosu çizilmez); bilinmeyen adres baş harfi. Bağlantılar `rel="noopener noreferrer me"`.
  - Ödeme rozetleri yazılı rozettir (kutu içinde ad), şirket logosu çizilmez (marka kullanım koşulları). Seçim doluysa sağlayıcı işaretlerinin yerine geçer; boşsa bugünkü sağlayıcı işaretleri. Köşe teması `rounded-inner`.
  - Yukarı çık düğmesi bir ekran boyu kaydırınca görünür; sağdaki WhatsApp düğmesinin üstüne yığılır, alt gezinmenin üstünde durur; içeriğin üstüne binmez: 1024 px üstünde kenar boşluğunda 40 px yüz, 641–1024 px'de ekran kenarına yapışık sekme, 640 px ve altında alt bilginin üst çizgisinde (2026-11-15 rötuş); çekmece, arama paneli ya da telefondaki satın alma çubuğu açıkken gizlenir; çerez sorusu beklerken basılmaz; klavyeyle basılınca odak "içeriğe geç" bağlantısına (`.gf-skip`) gider; `prefers-reduced-motion`'da kaydırma anlıktır.
  - Panel: alt bilginin İçerik grubunda sosyal hesap biçimi, ödeme rozetleri (işaretle → sona eklenir; yukarı/aşağı düğmeleriyle sıra) ve yukarı çık anahtarı; düğmenin yeri, biçimi ve telefonda gösterimi yalnız anahtar açıkken görünür. Kategori kartlarında sütun, görselin yeri ve alt kategori sayısı açık İçerik'te, çerçeve kapalı "Görünüm ayarları"nda (sayaçta sayılır). İki biçim "Biçim" seçicide küçük çizimiyle; her alan ayar aramasında (rozet adlarıyla da bulunur, yukarı çık ayrıntıları yalnız anahtar açıkken).
- **Açık kalan:** tarayıcı doğrulaması (390/768/1024/1440; WhatsApp, alt gezinme ve çerez bandı ile çakışma) Tezgâh hazır görünümüyle yapılacak; backend http testleri `.env`'li ortamda koşulacak.

### Ek 2026-11-15 (Oğuzhan): bileşen denetiminin orta işleri

- **Dayanak:** `docs/tema/bilesen-denetimi.md` (b) listesi, `docs/tema/bilesen-standardi.md`. Migration yok: her yeni alanın varsayılanı bugünkü çizimdir, alanı olmayan kayıt göçsüz okunur; okumada bağışlayıcı (bilinmeyen basamak → varsayılan), yazmada katı (`z.custom` + `storefront_layout.section_invalid`).
- **Ortak cihaz ayarı (O1, (b) 1):** `device` **all**/mobile/desktop her gövde bölümünde (`bodyFields`) ve üst bilgideki kayan yazıda. Sözleşme `@qticaret/types/section-device` (`SECTION_DEVICES`, `deviceOf`), backend aynası `layout-fields.ts` (eşitlik testiyle). Kayan yazının kendi `device`'ı aynı anahtarla okunur (göç yok) ve `MARQUEE_SETTINGS`'ten çıktı. Store çıktısı yalnız `all` dışını basar. Vitrin bölümü temanın 64rem kırılımında CSS ile gizler (`Look.tsx`, `data-show-on`; görünüş yoksa `display: contents` kutu): sayfa her ziyaretçide aynıdır (önbellek, CLS yok) ve gizli bölümdeki tembel (`lazy`) görsel görünüm alanına girmediği için indirilmez. **LCP notu:** sayfanın ilk bölümünün öncelikli (`eager`, `fetchPriority="high"`) görseli gizlendiği cihazda da indirilir; ilk bölümü yalnız bir cihaza ayırmak öbür cihazda boşa indirmedir. Sekmeli rafa birleşen raflarda ilk rafın cihazı geçerlidir; SSS'nin yanına çizilen yardım kutusu SSS ile birlikte gizlenir. Panel: açık "Görünürlük" grubunda "Cihaz <small>device</small>" (Her yerde / Yalnız telefonda / Yalnız masaüstünde, çizimli), ayar aramasında. Duyuru şeridi, alt bilgi kutusu ve ana bölümlerde yok (tema onları gizleyemiyor; ana bölüm hep görünür).
- **Duyuru şeridinde birden çok duyuru (O14, (b) 6'nın dönme kısmı):** sözleşme `@qticaret/types/section-announcement`, backend `sections/announcement-bar.ts` (eşitlik testiyle). `mode` **first**/rotate/inline ("Birden çok duyuru": Yalnız ilki / Sırayla dönsün / Yan yana), `interval` slow/**medium**/fast (8/6/4 sn), `pause_button` **always**/hover (kaldırılamaz), `hover_pause` **on**/off. Store çıktısı dört ayarı da basar; vitrin okumada bağışlayıcı (`announcementSettingsOf`). Dönüşte bütün satırlar aynı ızgara hücresinde durur (yükseklik en uzun satır, CLS yok), sunucu ilk satırı çizer; dönme betik çalışınca başlar, üzerine gelince (ayar), odakta ve durdur düğmesiyle durur, `prefers-reduced-motion`'da hiç dönmez (ilk satır kalır, düğme gizli). `aria-live`: kendiliğinden dönerken `off`, durunca `polite` (WAI-ARIA carousel deseni; her birkaç saniyede bir okunan canlı bölge sayfanın üstüne konuşur). Yan yana: geniş ekranda hepsi tek satırda, telefonda yalnız ilki. Panel: biçim seçimi İçerik'te satırların altında (yalnız iki ve daha çok satırda), dönme ayarları açık "Hareket" grubunda (yalnız "Sırayla"da); hepsi ayar aramasında. Bilerek konmayanlar: oklar, satır başına bağlantı, kapatma, zemin (denetim 1.1'in geri kalanı).
- **SSS ayarları (1.14, (b) 8):** sözleşme `@qticaret/types/section-faq`, backend `sections/faq.ts` (eşitlik testiyle). `open_first` **off**/on ("İlk soru açık gelsin <small>open first</small>") ve `single_open` **off**/on ("Aynı anda tek soru açık <small>accordion</small>"); ileride üçüncü basamak alabilecekleri için `boolean` değil adlandırılmış adım (bilesen-standardi §3). Store çıktısı yalnız `on` olanı basar (eski çıktı aynen); vitrin `faqSettingsOf` ile okur. Atölye betiksiz çizer: ilk sorunun `<details>`'ine `open`, tek açık için bölümün bütün `<details>`'lerine ortak `name` (yerel özel akordeon; desteklemeyen eski tarayıcıda her soru kendi başına açılır, cevaplar her durumda HTML'de). Panel: İçerik grubunda soruların altında iki anahtar düğmesi, ayar aramasında. Bilerek konmayan: simge seçimi (artı/ok), yan görsel.
- **Telefon sütunu (O8, (b) 3):** `columns_mobile` 1/2, sözlükteki ad. Ürün rafının `grid` biçimi ve benzer ürünler: varsayılan **2** (sözleşme `@qticaret/types/section-shelf` `SHELF_PHONE_COLUMNS`, backend aynası `layout-fields.ts` `columnsMobile`); kategori kartlarının `linked` biçimi: varsayılan **1** (`CATEGORY_CARD_SETTINGS.columns_mobile`). İkisi de bugünkü çizim, kayıtlı düzen göçsüz okunur; store çıktısı yalnız varsayılan dışını basar. Atölye: tek sütunlu rafta telefonda üç kart (üç sıra kuralı aynı), kartların `sizes`'ı 92vw; iki sütunlu kategori kartında görsel 45vw. Panel: raf ve benzer ürünlerde açık "Diziliş" grubunda "Satırda ürün"ün altında, kategori kartlarında İçerik'te "Bir sıradaki kart"ın altında "Telefonda sütun <small>columns mobile</small>" (1 kart / 2 kart, çizimli); hepsi ayar aramasında. Bilerek konmayanlar: kategorilerin görsel kutu (`tiles`) biçimi (telefonda zaten yana kayan şerit; ızgara/kaydırma seçimi (c) 2'nin işi) ve markalar (Atölye'de çip olarak akar, ızgara değil); raf `carousel`'inin telefon kartı kaydırma takımının `mobile` adımıdır.
- **Benzer ürünlerde biçim ve kart (1.15, (b) 7):** `related_products` artık biçimli tür: `SECTION_VARIANTS.related_products` = **grid**/carousel (sözleşme `section-variants.ts`, backend aynası eşitlik testiyle), backend `sections/related-products.ts` biçim başına dal (ızgara: `columns` + `columns_mobile`; kayan sıra: ortak `scroller` takımı), okumada bilinmeyen biçim ızgara (`storedSection`, `RELATED_BRANCHES`). `card_variant` rafın deseniyle (null: tema ayarı; listede olmayan kayıtlı değer okumada null, `storedCardVariant` artık iki türü de kapsar). Store çıktısı yalnız varsayılan dışını basar (eski çıktı aynen). Vitrin `views/related.ts` (sections.ts'ten ayrıldı) ürün rafı görünümü döner: kayan sırada `variant` + `scrollerSettingsOf`, ızgarada `columns`/`phoneColumns`; kartlar rafın kart biçimiyle. Atölye çizimi değişmedi: ürün rafının `CarouselShelf`'i ve `Scroller.tsx` olduğu gibi kullanılır. Panel: "Biçim" grubunda Izgara / Kayan sıra (çizimsiz), açık "Diziliş"te ızgaranın sütunları ve "Kart biçimi", kayan sırada açık "Kaydırma" grubu (görünen kart, oklar) ve kapalı görünüş grubunda takımın geri kalanı; hepsi ayar aramasında (`scrollerFields` ortaklaştı). Bilerek konmayanlar: ürün rafının `featured`/`compact`/`columns` biçimleri (ürün sayfasının altında anlamsız), biçim çizimi (sketch).
- **Raf sekmesi ayarı (O11, (b) 2):** ürün rafına `tabs` **auto**/off ("Yanındaki rafla sekmeli birleşsin <small>tabs</small>"); sözleşme `@qticaret/types/section-shelf` (`SHELF_TABS`, `shelfTabsOf`, `shelfJoins`), backend aynası `sections/products.ts` (bütün biçimlerin ortak alanı, biçim değişince korunur; eşitlik testiyle). `auto` bugünkü çizimdir: art arda duran raflar sekmeli tek rafa birleşir; `off` rafı ayrı, kendi başlığıyla çizer ve yanındakiler onun üstünden birleşmez. `columns` rafı yine hiç birleşmez. Store çıktısı yalnız `off`u basar (eski çıktı aynen). Atölye `plan.ts` `blocksOf` kararını `shelfJoins`'ten alır. Panel: açık "Diziliş" grubunda anahtar düğmesi (yalnız birleşebilen biçimlerde; `columns`ta yok), ipucu sayfada birleştiği rafların adını söyler (`layout/shelf-tabs.ts` `tabMates`, gizli bölüm atlanır; vitrinin boş ya da tarihi dışındaki rafı atlamasını panel bilemez); ayar aramasında.
- **Giriş slaytı kaydırma takımında (1.3, O6, O7, (b) 4):** `hero_slider`'ın kendi `autoplay`/`dots`/`arrows` (boolean) ve `interval` (5–10 sn) alanları yerine ortak takımdan slayda anlamlı altı ayar: `scroller.autoplay` **off**/on, `speed` slow/**medium**/fast (slaydın kendi süreleri 8/6/5 sn, rafınkinden uzun), `loop` off/**on**, `arrows` **always**/hover/hidden, `arrow_style` **round**/square/plain, `dots` off/**on**. Varsayılanlar slaydın bugünkü çizimidir (rafın varsayılanlarından farklı: döngü ve noktalar açık). Bilerek konmayanlar: görünen kart (hep bir slayt), okların yeri (hep iki yanda), sürükleme (dokunmatikte zaten kayar). Sözleşme `@qticaret/types/section-scroller` (`SLIDER_SCROLLER`, `SLIDER_DEFAULTS`, `SLIDER_SECONDS`, `sliderSettingsOf`, `sliderSecondsOf`), backend aynası `sections/scroller.ts` `sliderScroller` (eşitlik testiyle). **Eski kayıt:** `sections/hero-slider.ts` eski alanları isteğe bağlı kabul eder ve şema dönüşümünde (`fromLegacy`) herhangi bir varsayılan dolmadan takıma çevirir (açık/kapalı → on/off, oklar kapalı → hidden, saniye en yakın basamağa: 5 fast, 6–7 medium, 8–10 slow); böylece eski biçimli bir kayıt da kayıtlı değeri ezmeden okunur ve yazılır. Basamağın süresiyle tutmayan saniye (7, 9, 10) `interval` olarak saklanır ve basamak değişmedikçe çalmaya devam eder (çizim değişmez); sahip başka basamak seçince düşer. Store çıktısı `scroller` + (yalnız saklanmışsa) `interval`; vitrin daha eski backend'in alanlarını da okur. Atölye çizimi korunur: `SliderStage` yalnız döngü kapalıyken uçlarda durur (oklar devre dışı, otomatik geçiş son slaytta biter), oklar üzerine gelince (`data-arrows`, dokunmatikte hep görünür) ve kare/yalın biçim alır; `Scroller.tsx` değişmedi. Panel: İçerik'te yalnız slaytlar ve yükseklik; açık "Kaydırma" grubunda otomatik geçiş (+ açıkken süre), oklar (+ görünürken biçimi), noktalar; kapalı "Diğer ayarlar"da döngü (takımın ortak alanları ve Türkçe adları); hepsi ayar aramasında. Slaydın eski `slider.autoplay/dots/arrows/interval` çeviri anahtarları kalktı.
- **Zemin sözlüğü tek ad (O5, (b) 5; Ek 2026-11-15):** hafif ton her yerde `well` (bilesen-standardi §3): kayan yazının `ground`'u ve katalog üst bilgisinin `menu_ground`'u artık `stage`/`primary`/`well` (varsayılanlar değişmedi: kayan yazı ve menü çubuğu `stage`). Eski `light` aynı rengin eski adıydı (Atölye'de üçü de `--color-paper-2`), anlamı ayrı değil; bu yüzden göç yok: backend şeması `light`'ı kabul edip `well` olarak okur ve yazar (`z.custom` + `.transform`, `sections/marquee.ts`, `sections/main.ts`), vitrin daha eski backend'in `light`'ını da `well` okur (`marqueeStepOf`, `headerMenuGroundOf`). Atölye CSS `[data-ground="well"]`. Panelde tek etiket "Hafif ton" (eski "Açık" anahtarı kalktı). Aynı adı taşıyan ama başka anlamdaki `light`'lara dokunulmadı: slaytın/bannerın yazı tonu (`tone: light/dark`), perde gücü (`overlay.light` "Hafif"), panel teması.

### Ek 2026-11-15 (Oğuzhan): ürün kartı ayarları ve tema ayarları aramada

- **Dayanak:** sahibin çerçeveli kart için dört kararı, "ikili karar yerine ayar" ilkesiyle. Hepsi tema ayarı (`product_card`, adr/0062), raf başına ezme yok (raf yalnız `card_variant` seçer). Migration yok: alanı olmayan kayıt varsayılanla, yani bugünkü kartla okunur.
- **Alanlar** (varsayılan kalın; `@qticaret/types` `CARD_SOLD_OUT_ROWS`, `CARD_NO_REVIEWS`, `CARD_BUTTON_STYLES`, backend `sections/theme-card.ts` aynası eşitlik testiyle):
  - `sale_badge`, `low_stock_badge`, `sold_out_badge` (hepsi **açık**): fotoğraftaki indirim, "Az kaldı", "Tükendi" etiketleri. Kompakt kart "Az kaldı" çizmez; panel bu anahtarı yalnız kompakt dışı bir kart kullanılırken gösterir. "Yeni" etiketi vitrinde yok, eklenmedi. Ücretsiz kargo etiketi zaten var olan `delivery_note` (çerçeveli kart).
  - `sold_out_row` **price**/text/notify: tükenmiş kartın fiyat satırı. `price` bugünkü çizim (fiyat kalır, karttan sepete eklenmez); `text` fiyatın yerine "Tükendi"; `notify` ürün sayfasındaki stok bildirimi formuna (`#stok-bildirimi`) "Gelince haber ver" bağlantısı.
  - `no_reviews` **hide**/empty_stars/write_first: yorumsuz üründe puan satırı, yalnız "Puanı göster" açıkken (panel de yalnız o zaman gösterir). `write_first` ürün sayfasının değerlendirmelerine (`#degerlendirmeler`) bağlantı. Çerçeveli kartın `empty_stars` anahtarının yerini aldı: okumada `true` → `empty_stars` yalnız kayıtlı kart biçimi `framed` ise (anahtar yalnız orada çiziyordu; standart ve kompakt kartta `hide`, kayıtlı mağazanın görünümü değişmez), `false` → `hide`, kayıtlı `no_reviews` her biçimde geçerli (`upgradeCard`; tema bölümü satırı, tasarımın teması ve hazır görünüm aynı yoldan). Vitrin yorumlarını bilmediği kartta her zaman `hide` çizer.
  - `button_style` solid/**outline**/text (sözlükteki `button_style` adları): çerçeveli kartın tam genişlik düğmesi; `outline` bugünkü sessiz düğme. Yalnız `full_button` açıkken anlamlı, panel yalnız o zaman gösterir. Yuvarlak "+" düğmesinin stili yok.
- **Kurallar:** üç kart biçiminin her biri etiketleri, tükenmiş satırını ve yorumsuz satırı çizer; düğme stili yalnız çerçeveli. Doğrulama `z.custom` (hata anahtarı `platform_settings.invalid` korunur), şemada `.default()` yok: kısmi kayıt kayıtlı değeri ezmez. Kart görünümü `shown`'ı yalnız sahip bir şeyi değiştirdiyse taşır.
- **Ayar araması:** tema ayarları da aranır (renkler, yazı tipleri, köşe, düğme, bölüm aralığı, kart). Kayıt `forms/theme-registry.ts`, tema seçimlerinin tipinden (`ThemeChoices`) kurulur: panele konmayan yeni tema alanı derlenmez. Sonuç tema panelini açar, alanı kaydırır, odaklar ve işaretler; o an anlamsız (gizli) alan aramada da çıkmaz.
- **Açık kalan:** tarayıcı doğrulaması (390/1440; üç biçim, iki bağlantının ürün sayfasında indiği yer); backend http testleri `.env`'li ortamda.

### Ek 2026-11-15 (Oğuzhan): ürün kartından hızlı bakış

- **Dayanak:** sahibin istediği dört büyük parçadan biri (kartta "Hızlı bak", ürün pencerede). "İkili karar yerine ayar" ilkesiyle tema ayarı (`product_card`, adr/0062), raf başına ezme yok. Migration yok: alanı olmayan kayıt varsayılanla, yani bugünkü kartla (hızlı bakış yok) okunur. Örnek: Shopify Dawn'ın "quick add" penceresi (ayrı düğme, ürün bağlantısı yerinde; bu ek yazılırken kaynağı yeniden açılmadı).
- **Alanlar** (varsayılan kalın; `@qticaret/types` `CARD_QUICK_VIEW_TRIGGERS`, backend `sections/theme-card.ts` aynası eşitlik testiyle):
  - `quick_view` (**kapalı**): kartta "Hızlı bak" düğmesi. Kesin evet/hayır içerik anahtarı olduğundan `boolean` (§3 saklama kuralı).
  - `quick_view_trigger` **hover**/icon: `hover` fare kartın üstüne gelince ya da kartta odak varken beliren "Hızlı bak" hapı (dokunmatikte, üstüne gelme olmadığından, hep 44 px simge); `icon` hep 44 px simge. Kompakt kart her durumda satırın sonunda yalnız simge çizer.
  - `quick_view_rating`, `quick_view_summary`, `quick_view_quantity` (hepsi **açık**): pencerede puan özeti, kısa açıklama (yoksa açıklamanın ilk paragrafı), adet seçici (kapalıyken bir adet eklenir). Marka kartlardaki `show_brand`'i izler.
- **Kurallar:** doğrulama `z.custom` (hata anahtarı `platform_settings.invalid`), şemada `.default()` yok: kısmi kayıt kayıtlı değeri ezmez. Panelde "Ürün kartı" grubunda "Hızlı bakış" ara başlığı; anahtar kapalıyken görünüş ve içerik alanları hem panelde hem ayar aramasında gizli.
- **Veri yolu:** kart görünümü yalnız düğmenin görünüşünü taşır (`ProductCardView.quickView`, açık değilken yok); ürün verisi ilk HTML'e girmez. Pencere açılınca vitrinin kendi adresi istenir: `GET /api/quick-view?id=<ürün kimliği>` (canlı arama gibi route handler; `private, no-store`, `X-Robots-Tag: noindex`). Ürün, ürün sayfasının okumasıyla (`productById`, `priceDisplays`, `productTexts`, `productPage`) okunur ve pencereye kırpılır; fiyat sunucuda, 30 gün kuralıyla, sözle gelir. Ürün kimliği olmayan istek 400, satılmayan ürün 404 (pencere ürün sayfasını önerir), hata 502 (backend'in 429'u aynen).
- **Tema:** pencere sayfada bir kez, düzende (`Layout`'un `quickView` ayarı yalnız mağaza açtıysa verilir: adres + `addToCart`); sözleri de orada bir kez çevrilir, kart başına yalnız düğmenin iki sözü. Pencere kodu ilk bakışta yüklenir (`React.lazy`; fare düğmeye gelince ya da odaklanınca önceden). Kart düğmesi `qt:quick-view` olayıyla pencereyi ister; dinleyen yoksa ürün sayfasına gider. Pencere ürün sayfasının parçalarını kullanır (`Price`, `Options`, `Quantity`, `Summary`, `matching`/`soldOutOf`, `CardRating`); Radix Dialog: `dialog` rolü, odak tuzağı, Escape, perde, kaydırma kilidi, `aria-labelledby`. Kapanınca odak kartın düğmesine döner; sepete eklenince pencere kapanır, sepet çekmecesi açılıp söyler. 768 px'ten ortada en çok 960 px pencere, altında alttan açılan tam genişlik sayfa (ekranın en çok %92'si); hareket yalnız `motion-safe`. Yüklenirken kartın verdiği adla başlık ve yerinde gri satırlar; seçenek adresi değiştirmez.
- **Bilerek konmayanlar:** pencerede taksit satırı, ek seçenekler (adr/0052), hediye kartı alıcısı, favori, stok bildirimi, özellikler ve yorum listesi (ürün sayfasında; ek seçenekli/hediye kartı üründe sepete ekleme sunucunun reddiyle "Ürün sayfasına git"e düşer); galeride yakınlaştırma ve kaydırma; raf başına hızlı bakış ayarı.
- **Açık kalan:** tarayıcı doğrulaması (390/1440; üç kart biçimi, iki görünüş, azaltılmış hareket, Safari'de odak dönüşü); backend http testi (`theme-settings.spec.ts` yeni alanlarla) `.env`'li ortamda.

### Ek 2026-11-15 (Deniz): duyuru şeridine hizalama ve boyut

- **2026-11-15 (Deniz): duyuru şeridine hizalama ve boyut** (sahip isteği: katalog üst bilgisinde şerit solda hoş durmuyordu): `align` **auto**/left/center/right ("Hizalama": Otomatik / Sol / Orta / Sağ; `auto` bugünkü çizim: telefonda ortada, 1024 px'ten solda; diğerleri her genişlikte) ve `size` small/**medium**/large ("Boyut": 32 px `--text-xs` / 36 px `--text-sm`, bugünkü / 44 px `--text-md`; bağlantılar ve durdur düğmesi şeridin boyunda, dokunmatikte 44 px). Bağlantılar ve telefon (1024 px'ten) hep sağ uçta: `right`'ta satırlar hemen önlerinde, `center`'da boş bir başlangıçla bağlantılar eşit büyüyen iki yan olur, satırlar şeridin tam ortasında; bağlantılar yarılarına sığmazsa başlangıç küçülür ve satırlar bağlantıların hemen solunda durur (üst üste binmez); bağlantı yokken (katalog üst bilgisinin şeridi açıkken) tam orta. Üç gösterim biçimi (ilki, sırayla, yan yana) ve durdur düğmesi her hizada çalışır. Sözleşme `@qticaret/types/section-announcement`, backend aynası `sections/announcement-bar.ts` (eşitlik testiyle), göç yok (alansız kayıt varsayılanla okunur, listede olmayan basamak `storefront_layout.section_invalid`); Store yanıtı ikisini de taşır; tema `frame/announcement-steps.ts`; panelde açık "Stil" grubunda, satır sayısından bağımsız.

### Ek 2026-11-15 (Oğuzhan): menülerde kategori resimleri isteğe bağlı

- **Dayanak:** sahip isteği ("Kategoriler yazısında da küçük resimler olsun … isteğe bağlı olsun"); adr/0066 K3b ve K6: yeni ayarın varsayılanı bugünkü çizimdir. İlk hâl (açık/kapalı anahtarı, varsayılan açık) "Kategoriler" panelini çizen her görünümü habersiz değiştiriyordu; bu yüzden üç adlandırılmış basamağa çevrildi (bilesen-standardi §0 ilke 4). Migration yok.
- **Alan:** `header_bar.menu_images` **all**/submenus/off → "Her yerde" / "Alt menülerde" / "Yok" (vars. **submenus**). `sticky` gibi üst bilginin **her biçimde** ortak alanı; biçim değişince korunur. Adlar §3 sözlüğüyle uyumlu: `all` `device`'ın "Her yerde"si, `off` aç/kapat'ın "Kapalı"sı; `submenus` "üstüne gelince açılan alt menü + telefon menüsü". Sözleşme `@qticaret/types` `HEADER_MENU_IMAGES` + `headerMenuImagesOf`, backend aynası `sections/main.ts` (eşitlik testiyle).
  - `submenus`: bugünkü çizim birebir: açılır menü ve telefon menüsü resimli, katalog başlığının "Kategoriler" paneli yazı, 288 px.
  - `all`: "Kategoriler" paneli de açılır menünün dilinde: üst satırda 40 px, alt kategori panelinde 36 px yuvarlak kare, 48 px satır, panel 320 px (dar alt panel 288 px); resmi olmayan kategoride boş kare. Standart ve ortalı başlıkta "Kategoriler" paneli olmadığından `submenus` ile aynı çizilir.
  - `off`: üç yer de yalnız yazı: açılır menü satırı ad + sayı, 44 px; telefon menüsünde satır yükseklikleri aynı, alt kategoriler bir adım içeride.
- **Okuma ve kayıt:** kayıt listeye bağlıdır: listede olmayan değer (geliştirme taslaklarında kalmış `true`/`false` dahil) `storefront_layout.section_invalid`. Kayıtlı belgeyi okurken (`storedSection` → `storedMenuImages`) listede olmayan değer düşer ve varsayılan okunur; üst bilginin diğer ayarları durur (görünüş basamağındaki `storedLook` deseni). Alanı taşımayan kayıt `submenus` okunur; store çıktısı alanı her zaman basar (`mainSectionsOf`), vitrin eksik ya da tanımadığı değeri `submenus` okur (`headerBarOf`).
- **Hazır görünümler:** Tezgâh ×3 `all` seçer (sahip Tezgâh'ta "Kategoriler" panelinde resim istedi; görünümler sürüm 4, bıçak paketi 6). Katalog ve Grafit alanı taşımaz, değişmez. Görünüm kilidi: yalnız Tezgâh ×3 `frame.html` ve tema stil özeti değişti.
- **Veri:** "Kategoriler" listesi (kategori ağacı) mağazanın kendi kategori resmini, yoksa menünün aynı sayfa için gösterdiği resmi (en yeni ürün fotoğrafı) alır; ek istek yok (`withPicturesOf`). Mağazanın kendi menüsünde olmayan kategori yalnız kendi resmini taşır.
- **Panel:** üst bilginin açık İçerik grubunda üç basamaklı seçim "Menüde kategori resimleri <small>thumbnails</small>" ("Varsayılana dön" ile); katalog biçiminde "Kategoriler" düğmesinin hemen altında; ayar aramasında (basamak adlarıyla da).
- **Açık kalan:** `deniz/katalog-ust-sade` aynı panele resimli satır ekliyor; o dal girince `all` basamağı onun çizimine bağlanır.
