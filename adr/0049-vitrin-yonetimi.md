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

  Vitrin bu bölümden `FAQPage` yapılandırılmış verisi üretir.
- **Denetim ve okuma.** Üç grup (`home`, `product`, `category`) aynı yoldan geçer.
  - `checkLayout`: kayıtlar (ilgili ürünlerin koleksiyonu ve seçilen ürünleri dahil), görseller, zengin metnin kartları ve değişkenleri. SSS cevaplarının belirteçlerini şema denetler.
  - `storeLayout`: o anda gösterilenler süzülür ve yalnız yayındaki kayıtlar kalır:
    - elle seçimde yalnız yayındaki ürünler kalır, hiçbiri kalmazsa bölüm çıkar;
    - koleksiyonu gitmiş bölüm çıkar;
    - `same_category` olduğu gibi geçer.

    Belirteçler doldurulur. Zengin metin HTML olarak, görseller boyutlarıyla gelir. Kategori bölümleri yerlerini korur.
- **Uçların biçimi.** `GET /store/storefront-layout` ve önizleme `product` ile `category` dizilerini de verir. Yayındaki düzenin süreç önbelleği eskisi gibi sürüm numarasıyla anahtarlanır. Varsayılan belgede iki grup boş.
