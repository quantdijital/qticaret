# ADR-0073: İçerik sayfalarında bölümler: tema düzenleyiciden sayfa düzeni

- **Durum:** Önerildi (otonom; sahip görüp revize eder)
- **Tarih:** 2026-11-19
- **İlgili:** adr/0019 (içerik belgesi, zengin metin), adr/0046 (tema sözleşmesi; Ek 2026-11-05 içerik sayfaları), adr/0047 (iletişim formu), adr/0048 (mağaza bilgileri, `{belirteç}`), adr/0049 (tema düzenleyici; Ek 2026-11-03 ürün ve kategori grupları, Ek 2026-11-14 biçimler ve ana bölümler), adr/0063 (hazır görünümler), adr/0064 (görünüm kitaplığı), adr/0065 (canlı önizleme köprüsü), adr/0066 (yayımlanmış biçim sözleşmedir), adr/0070 (alt bilgi grubu), docs/13 (SEO), docs/14 (advisor), `docs/tema/bilesen-standardi.md` §7
- **Dayanak:** sahip (2026-11-19): "tema düzenleyici üzerinden, iletişim ve hakkımızda sayfalarını düzenleyebilmeliyim yani şöyle kullanıcı yeni sayfa oluşturdu diyelim ki, bu sayfayı tema düzenleyiciden de düzenleyerek bileşenler ekleyebilelim katolog temasına uygun hakkımızda sayfasınıda tasarla iletişim sekmesi güzel."

## Bağlam

İstek üç parçalı:

1. İçerik'te açılan her sayfa (Hakkımızda, İletişim, mağazanın yeni açtığı sayfa) tema düzenleyicide açılabilsin; ana sayfadaki gibi bölüm eklenebilsin.
2. Katalog görünümüne uyan bir Hakkımızda sayfası tasarlansın.
3. İletişim sayfasının bugünkü görünümü beğenildi; korunur.

### Kodda bugün olan (2026-11-19 `dev`, okundu)

- **Düzen belgesi.** `storefront-layout` modülünde mağaza başına tek kayıt: `draft`, `published`, `revision` (`modules/storefront-layout/models`). Yayın sürüm olarak `storefront_layout_revision`'a yazılır, son 20'si tutulur. Belge şeması `apps/backend/src/lib/storefront/layout.ts` (`layoutDocument`): `header`, `home`, `footer`, `product`, `category` ve `settings`. Gruplar sayfa türüne göredir: `product` ve `category` bütün ürün ve kategori sayfalarında ortaktır; **tek bir sayfaya özel bölüm yoktur** (adr/0049 Ek 2026-11-03).
- **Bölüm şemaları** `lib/storefront/layout-sections.ts` (`pageSection`, `productSection`, `categorySection`, `headerSection`, `footerSection`), türler `lib/storefront/sections/*.ts`, ortak parçalar `layout-fields.ts`. Sınırlar `LAYOUT_LIMITS`: `home` 30, `product` ve `category` 12 (+ ana bölüm). Bölüm kimliği `[a-z0-9]{6,24}`, bütün gruplarda tekil. Sözleşme kopyası `packages/types/src/store/layout.ts` (`StoreLayout`, `StorePageSection`, `StoreCategorySection`).
- **Kategori deseni.** Kategori bölümleri `placement: "top" | "bottom"` taşır; ana bölüm (`category_main`) ikisinin arasında çizilir. Panel bunu iki listeyle gösterir (`apps/panel/src/features/storefront/editor/page-sections.tsx`).
- **Okuma.** `storedDocument` saklanan belgeyi bugünkü şemadan okur; tanınmayan bölüm atlanır ve loglanır. Eksik grup boş okunur; migration yok (JSON sütunu).
- **Denetim ve çözüm.** `workflows/storefront/layout-check.ts` (`checkLayout`: kayıtlar, görseller, zengin metin kartları, belirteçler), `layout-read.ts` (`storeLayout`: o an görünenler, yalnız yayındaki kayıtlar, HTML, görsel türevleri; süreç önbelleği sürüm + satış kanalı anahtarlı).
- **Uçlar.** `POST /admin/storefront-layout` taslağı bütün olarak yazar. Bu rotada `bodyParser.sizeLimit` yok (`api/http/storefront-menu-routes.ts:42`), yani Express'in 100 kB varsayılanı geçerli (`api/middlewares.ts:311`'deki not bu varsayılanı söyler; Medusa kaynağında ayrıca doğrulanmadı). Vitrin `GET /store/storefront-layout`, `…/preview/:token` (`sfl_`) ve `…/session/:token` (`sfs_`) ile okur.
- **İçerik sayfası.** `content_entry` (`kind: page | post`, `handle`, `body` içerik belgesi, kapak görseli, `status`) `modules/content`. Yol `/{handle}`; yayında olmuş sayfanın eski yolu adres değişince 301, silinince 410 verir (`workflows/content/paths.ts`, `workflows.ts`). JSON-LD sayfada `WebPage`, yazıda `BlogPosting` (`lib/seo/jsonld.ts`).
- **Vitrinde içerik sayfası.** `app/[...path]/page.tsx` → `EntityScreen` → `screens/content.tsx` (`ContentScreen`). Tema `packages/themes/atolye/src/content/ContentPage.tsx` sayfayı tek gövdeyle çizer: `PageHead` (iz, tek h1, kapak varsa grafit sahne), ardından sayfanın rolüne göre **bir** gövde:
  - İletişim (`ContactBody`): metin ve "Bize ulaşın" sahnesi solda, form sağda, künye altta. Sayfa, ayarlardaki `contact_form_path` yoluyla seçilir (`modules/platform-settings/sections/storefront.ts`, varsayılan `/iletisim`; form eylemi `app/actions/contact.ts`).
  - SSS metni (`FaqBody`, `faqOf`).
  - Diğerleri (`InfoBody`): okuma ölçüsünde metin; ödeme ve kargo sayfasında canlı bilgiler (`payment_info_path`, `shipping_info_path`), uzun metinde içindekiler.
- **Önizleme.** `previewPage` (`apps/storefront/src/lib/views/preview.ts`) içerik sayfasının yolunu `resolve` türüyle zaten açar; köprü bağlantı tıklamasını panele sorar (adr/0065). Taslak (yayında olmayan) sayfa çözülmez, 404 olur.
- **Panel düzenleyici.** Üst çubukta sayfa seçimi yalnız `home`, `product`, `category` (`editor-top-bar.tsx:31` `EDITOR_PAGES`); grup türleri `layout/sections.ts` `GROUP_TYPES`.
- **Hazır görünüm.** `packages/sector-packs/packs/cutlery/presets/katalog/` `layout.json`, `theme.json`, `preset.json` taşır; görsel klasörü yok. `layout.json`'da `{ "$handle": "page:<handle>" }` başvurusu zaten tanınıyor (`packages/sector-packs/src/preset-schema.ts` `HANDLE_KINDS`). Kilit testi çerçeve, ana sayfa, ürün ve liste sayfasını tutar; **içerik sayfaları kilitli değil** (`bilesen-standardi.md` §7).
- **Hakkımızda için kullanılabilecek bölümler.** `rich_text` (Atölye `Story`: başlık solda, metin sağda, gölgeli zeminde; içerik belgesi, `h3` ve listeler), `trust_badges` (mağazanın vaatleri; `lined` biçimi), `products`, `reviews`, `google_rating`, `banner` (1–6 görsel, metin en çok 160 karakter), `strip_gallery`, `faq`, `help`, `newsletter`, `marquee`. **Görselle yan yana uzun metin çizen bölüm yok:** `banner`'ın metni kısa, `rich_text`'in görseli yok.
- **mylarte.com/hakkimizda** (2026-11-19 okundu): atölye fotoğraflı giriş; "Köklerimizden Geleceğe", "Ateşten Doğan Karakter" başlıkları; misyon (güven ve dayanıklılık); vizyon (Yatağan dövme geleneği ve Şam çeliğinden güç alan, dünyada tanınan bir marka); koleksiyon tanıtımı; hizmet vaatleri (ücretsiz kargo eşiği, 16:00'ya kadar aynı gün kargo, 2 yıl garanti, güvenli ödeme). Ekip ya da sayı bölümü yok.
- **Çakışma kontrolü (2026-11-19).** `origin`'de `dev` ve `main` dışında dal yok; `progress/oguzhan.md` sıradaki işlerinde içerik sayfası ya da düzen grubu yok.

### Başkaları nasıl yapıyor (bilinenle; bu ADR yazılırken web'den doğrulanmadı)

- **Shopify (OS 2.0):** sayfa bir **şablon** seçer (`page.json`, `page.contact.json`, `page.about.json`). Bölümler şablondadır; aynı şablonu seçen bütün sayfalar aynı bölümleri gösterir, sayfaya özel içerik metafield ister. Dawn'ın iletişim şablonu `main-page` (başlık + metin) ile `contact-form` bölümünden oluşur.
- **WordPress (blok düzenleyici), Elementor, Divi:** düzen **sayfanın kendisindedir**; her sayfa kendi bloklarını taşır, yayınla birlikte gider.
- **Ders:** mağaza sahibinin istediği Shopify'ın şablonu değil, WordPress'in "bu sayfayı düzenle"sidir. Ama düzenin nerede saklandığı ayrı sorudur: bizde taslak, yayın, sürüm, önizleme ve düzenleyici düzen belgesinde zaten var.

## Karar

### 1. Saklama: düzen belgesinde `pages` grubu

Belgeye yeni grup: `pages`. Her öge bir içerik sayfasının kendi düzenidir.

```jsonc
"pages": [
  {
    "page_id": "cnt_01K…",      // content_entry kimliği; yalnız kind = page
    "sections": [ /* bölümler, her biri placement: "top" | "bottom" */ ]
  }
]
```

- **Anahtar sayfanın kimliğidir, yolu değil.** Adres değişince düzen sayfayla gider. Eski yolun 301'i bugünkü gibi url-registry'dedir (docs/13 §2.1, §4); düzen bir şey yapmaz.
- **Nesne değil dizi.** Hazır görünüm kimliği bilmez; `{ "page_id": { "$handle": "page:hakkimizda" } }` yazabilmesi için kimlik bir değer yerinde durmalı (adr/0063 §2 başvuruları anahtar yerinde çözülmez).
- **Bölüm yerleşimi kategori deseniyle.** Her bölüm `placement` taşır: `top` sayfa başı ile sayfanın metni arasında, `bottom` (varsayılan) metnin altında. Sayfa başı (iz, h1, kapak) ve sayfanın metni (rol gövdesi dahil, §2) **bölüm değildir, saklanmaz**; vitrin onları her zaman bugünkü gibi ikisinin arasında çizer. Bu yüzden sayfa düzeninde ana bölüm kaydı ve sabit kimlik gerekmez (çok sayfada tek sabit kimlik olamazdı).
- **Taslak, yayın, sürüm, önizleme, geri al/yinele, görünüm kitaplığı** belgeyle birlikte gelir; ayrı yayın düğmesi yok. "Yayınla" temayla birlikte sayfa düzenlerini de yayına alır.
- **Eski belgeler.** `pages` olmayan belge boş dizi okunur; "değişiklik var" yanmaz; migration yok.

#### Sınırlar

| Sınır | Değer | Neden |
| --- | --- | --- |
| Kendi düzeni olan sayfa | 20 (`LAYOUT_LIMITS.pages`) | Mağazaların kurumsal sayfası birkaç tanedir; belge ve sürüm boyu sınırlı kalır |
| Sayfa başına bölüm | 12 (`LAYOUT_LIMITS.page`), üst + alt toplam | Ürün ve kategori grubuyla aynı |
| Kayan yazı | Üst bilgi + alt bilgi grubu + sayfa toplamı `MARQUEE_PER_PAGE` | `tooManyMarquees` her sayfa düzenine de uygulanır |
| Taslak isteği | 1 MB (`sizeLimit`) ve belge en çok 1 MB (`DESIGN_LIMITS.bytes`); aşan kayıt `storefront_layout.too_large` | Bugünkü 100 kB varsayılanı sayfa metinleriyle aşılabilir; kitaplığın sınırıyla aynı |

- **Sürüm boyu.** En kötü durumda 20 sürüm × 1 MB; gerçekte birkaç on kB (sayfa bölümlerinin çoğu kayıt kimliği ve kısa metin). Zengin metin bölümünün kendi belge sınırı (`DOC_LIMITS`) değişmez; toplam bayt sınırı onu bağlar.
- **Boş düzen yoktur.** Son bölümü silinen sayfanın ögesi belgeden çıkar: sayfa bugünkü gibi çizilir ve 20'lik sınırdan düşer.

#### Sayfa silinir, adı ya da adresi değişir

| Olay | Ne olur |
| --- | --- |
| Adres (handle) değişir | Düzen kimlikle bağlı, yerinde kalır. Eski yol 301 (bugünkü kural). |
| Başlık değişir | Düzen etkilenmez; panel listesinde yeni ad görünür. |
| Sayfa taslağa çekilir | Düzen kalır; vitrin 404 verir (bugün), düzen okunmaz. Yeniden yayında düzen geri gelir. |
| Sayfa silinir | Yol 410 (bugün). Düzen ögesi yayındaki belgede yetim kalır, okunmaz. **Kayıtta** (taslak kaydı, yayın, sürüm geri yükleme, görünüm uygulama) var olmayan sayfanın ögesi düşürülür, yanıtta `dropped_pages` sayısı döner, panel "Silinmiş 1 sayfanın düzeni kaldırıldı" der. Kayıt reddedilmez: başka sekmede silinen sayfa düzenleyiciyi kilitlemesin ("engel değil uyarı"). |
| Biçimsiz ya da yazıya (`kind: post`) ait kimlik | Şema reddeder (`storefront_layout.page_invalid`): bozuk ya da uydurma istemci. |

### 2. Geriye uyum: düzeni olmayan sayfa bugünkü gibi

- **Düzen ögesi olmayan sayfa birebir bugünkü HTML'i verir.** Bu S3'ün kabul ölçütüdür ve bir kilit örneğiyle tutulur (§7).
- **Sayfanın metni yerinde kalır.** İçerik'te yazılan gövde, sayfa başının altında, `top` ile `bottom` arasında, bugünkü rol gövdesiyle çizilir:
  - İletişim sayfası: `ContactBody` (metin + "Bize ulaşın" sahnesi + form + künye) **değişmeden**.
  - SSS metni: `FaqBody`. Ödeme ve kargo sayfası: canlı bilgiler. Uzun metin: içindekiler.
  - Gövdesi boş sayfa (yalnız bölümlerle kurulan sayfa): metin alanı hiç çizilmez; sayfa başı ve bölümler kalır.
- **İletişim formu ayrı bölüm olmaz.** Dawn'daki gibi `contact_form` bölümü formu metinden ayırırdı; bugünkü görünüm (metin ve sahne solda, form sağda aynı ızgarada) bozulur. adr/0066 K2 ve "yayımlanmış biçim sözleşmedir" gereği iletişim gövdesi olduğu gibi kalır; mağaza sahibi üstüne ve altına bölüm ekler. Formu başka sayfaya koymak istenirse ayrı karardır (Açık kararlar 2).
- **Tema sözleşmesi.** `ContentPageView`'e isteğe bağlı `sections?: { top: HomeSectionView[]; bottom: HomeSectionView[] }`. Yoksa ya da ikisi boşsa tema bugünkü yolu çizer. Bölümler kendi `Container`'larını taşıdığı için Atölye `ContentPage`'i sayfa başını, üst bölümleri, gövdeyi ve alt bölümleri kardeş olarak dizer; düzensiz sayfada çıktı aynı kalır (iç düzenleme, K3 (d)). Base tema alanı yok sayar.

### 3. Sayfanın aldığı bölüm türleri

Ana sayfanın türlerinden **ana sayfanın açılışı olanlar ile üst ve alt bilgiye ait olanlar çıkarılır**:

| Tür | Sayfada | Neden |
| --- | --- | --- |
| `rich_text`, `banner`, `strip_gallery`, `faq`, `trust_badges`, `help`, `newsletter` (sayfa biçimleri), `marquee` | Var | Ürün ve kategori sayfasındakilerin aynısı ve görsel anlatım |
| `products`, `featured_product`, `categories`, `brands`, `posts`, `reviews`, `google_rating` | Var | Kurumsal sayfada satışa ve güvene köprü (seçki, yorumlar, puan) |
| `hero`, `hero_slider` | Yok | Ana sayfanın açılışı: ilk sırada h1'i ve LCP görselini sahiplenir (`Hero.tsx` `first`). İçerik sayfasında h1 sayfa başınındır; açılış görseli kapaktır. |
| `price_bands` | Yok | Ana sayfaya özgü alışveriş aracı, sayfada bir kez sınırı var |
| `announcement_bar`, `header_bar`, `footer_bar`, `newsletter` `in_footer` biçimi, alt bilgi satırları | Yok | Üst ve alt bilgi grubunundur, her sayfada zaten çizilir |
| `product_main`, `category_main`, `related_products` | Yok | Ürün ve kategori şablonunun parçası |

- Şema: `contentPageSection`, `categorySection` deseniyle her türün `placement` eklenmiş dalı (`layout-sections.ts` 300 satıra yakınsa `layout-page-sections.ts`'e bölünür). Sözleşmede `StoreContentPageSection`.
- Bölümlerin şemaları, sınırları, biçimleri ve ayarları ana sayfadakiyle **aynıdır**; ikinci kopya yazılmaz.

#### Tek yeni çizim: `rich_text` biçimi `with_image` ("Görselli metin")

Hakkımızda sayfasının özü "atölye fotoğrafının yanında hikâye"dir. Bugün kurulamıyor: `banner`'ın metni 160 karakter düz metin, `rich_text`'in görseli yok. adr/0066 K4: eksik olan biçimdir; tür eklenmez.

- `SECTION_VARIANTS.rich_text = ["pane", "with_image"]`. `pane` bugünkü `Story` çizimidir ve varsayılandır; saklanan `rich_text` biçimsiz okunur, çizimi ve kilidi değişmez (adr/0049 Ek 2026-11-14 §2).
- `with_image` dalı: `image` (zorunlu, medya kütüphanesi, `checkLayout` denetler), `image_side: "start" | "end"` (varsayılan `start`). Başlık ve içerik belgesi ortak alanlardır, biçim değişince taşınır.
- Çizim (Atölye): aynı gölgeli zemin; geniş ekranda görsel bir yanda (5/12), başlık ve metin öbür yanda (7/12); telefonda görsel üstte. Görselin `alt`'ı medya kaydından; tembel yüklenir.
- Ana sayfada, ürün ve kategori sayfasında ve içerik sayfasında seçilebilir. **Alt bilgi grubunda yalnız `pane`** (alt bilgi grubu görselli bölüm almaz, adr/0070 §4).
- Ana sayfaya da yarar (marka hikâyesi); tek mağazaya özel değildir (K5).

Başka yeni tür ya da biçim yok. Hakkımızda'nın geri kalanı var olan bölümlerin ayarlarıyla kurulur (§4).

### 4. Hazır görünüm: sayfa düzeni veri olarak

- `layout.json` `pages` dizisini taşıyabilir; `page_id` yerine `{ "$handle": "page:<handle>" }`. Bölüm kimlikleri dosyada sabittir (yeniden uygulama aynı taslağı verir).
- **Uygulama (`applyPresetWorkflow`):**
  - Tutamaç mağazanın sayfasına (her durumda; taslak da) çözülür.
  - Sayfa yoksa öge düşer, `skipped`'te `{ where: "pages", ref: "page:hakkimizda" }` döner; panel "Hakkımızda sayfası olmadığı için sayfa düzeni eklenmedi. Adresi `hakkimizda` olan bir sayfa açıp görünümü yeniden uygulayın." der. Görünüm sayfa **oluşturmaz**: sayfanın metni ve kapağı mağazanın içeriğidir (İçerik). `demo.json` sayfaları yalnız kataloğu boş mağazada kurulur (adr/0063 §5); bu kural değişmez.
  - Görünümün adlandırdığı sayfaların düzeni değiştirilir; **adlandırmadığı sayfaların düzeni korunur** ve `kept`'te döner (adr/0063 §4'teki üst/alt bilgi kuralının aynısı). Bir görünümü uygulamak mağazanın elle kurduğu İletişim düzenini silmez.
- **Görünüm kitaplığı (adr/0064).** Kayıtlı görünüm belgenin tamamıdır, sayfa düzenleri dahil. Geri yüklemede silinmiş sayfaların ögeleri §1'deki gibi düşer.
- **Metin.** Görünümdeki bölüm metinleri sektöre uygun ve mağazadan bağımsızdır, mağaza adı `{mağaza_adı}` belirteciyle (adr/0048). Hiçbir yerde "demo", "örnek", "deneme" sözü geçmez. Mağazaya özgü hikâye (şehir, atölyenin geçmişi) sayfanın kendi metnindedir.
- **Görsel.** Görselli metin için Katalog'a bir görsel gerekir; yeni fotoğraf çekilmez. Bıçak paketindeki uygun görsel (`tezgah/images/acilis-bileme.webp`, bileme sahnesi) `katalog/images/`'a kopyalanır; sahip değiştirebilir.

#### Katalog "Hakkımızda" düzeni

Sayfa başı: başlık "Hakkımızda" ve kapak varsa grafit sahnede kapak (bugünkü `PageHead`). Üst bölüm yok.

| Sıra | Yer | Bölüm | Biçim ve ayarlar | Metin |
| --- | --- | --- | --- | --- |
| — | — | Sayfanın metni | Bugünkü okuma ölçüsü | Mağazanın kendi girişi (İçerik; aşağıda) |
| 1 | `bottom` | `rich_text` | `with_image`, `image_side: "end"`, görsel `images/acilis-bileme.webp` | Başlık "Ateşten doğan karakter". Metin: "Bir bıçağın karakteri çeliğinde, ısıl işleminde ve elinize oturan sapında saklıdır. {mağaza_adı} olarak sunduğumuz her ürünü bu üç ölçüyle seçiyor, ağzını ve dengesini kendimiz deniyoruz. Mutfakta her gün kullanacağınız bir şef bıçağı da doğada yanınızdan ayırmadığınız bir çakı da aynı özeni hak eder." |
| 2 | `bottom` | `rich_text` | `pane` | Başlık "Neye inanıyoruz". Metin: `h3` "Misyonumuz: güven ve dayanıklılık" + "Doğada, mutfakta ve atölyede gönül rahatlığıyla kullanacağınız; uzun ömürlü, işlevli ve güvenilir bıçaklar sunmak." `h3` "Vizyonumuz: dünyada tanınan bir marka" + "Dövme çelik geleneğinden aldığımız güçle, Türkiye'den çıkan ve dünyada tanınan bir bıçak ve outdoor markası olmak." |
| 3 | `bottom` | `trust_badges` | `lined` | Mağazanın kendi vaatleri (`settings.trust_badges`; görünüm değiştirmez) |
| 4 | `bottom` | `products` | `best_sellers` (90 gün), `columns: 4`, adet 8 | Başlık "Atölyeden seçtiklerimiz" |
| 5 | `bottom` | `reviews` | adet 6 | Başlık "Müşterilerimiz ne diyor" |
| 6 | `bottom` | `help` | — | Başlık "Hangi bıçak size uygun?" Metin: "Çelik, sap ya da bakım konusunda sorunuz varsa yazın; size uygun bıçağı birlikte seçelim." |

Katalog'un sık ve sade havasına uyar: grafit sahneli sayfa başı, gölgeli zeminli iki metin bloğu, çizgili vaat şeridi, dört sütunlu raf. Yeni CSS yok; hepsi bölüm ve biçim ayarıdır (K7).

**Sayfanın kendi metni** (İçerik › Hakkımızda; geliştirme mağazası için S5'te panelden girilir, görünüme girmez; mylarte.com'un anlatımıyla):

> **Köklerimizden geleceğe.** My L'arte, Denizli'de el işçiliğini sanatla buluşturan bir atölye mağazasıdır. Çakıdan av bıçağına, şef bıçağından kılıca kadar her parçayı kullanılmak için seçer; hediye kutusundan sergileme çerçevesine kadar özenle hazırlarız.
>
> Yatağan'ın dövme geleneğinden ve Şam çeliğinin desenlerinden aldığımız ilhamı, bugünün paslanmaz çelikleri ve ergonomik saplarıyla birleştiriyoruz.

Kapak: atölye fotoğrafı (mağazanın kendi görseli). Vaat şeridi geliştirme mağazasında mylarte.com'daki dört vaatle doldurulur (ücretsiz kargo eşiği, 16:00'ya kadar aynı gün kargo, 2 yıl garanti, kartla ya da havale/EFT ile güvenli ödeme).

### 5. Panel: düzenleyicide sayfa seçimi

- **Üst çubuk.** Sayfa seçimine "İçerik sayfası" eklenir. Seçilince yanında aranabilir sayfa seçici açılır (`sample-picker.tsx` deseni): İçerik'teki sayfalar, başlık ve adresle; taslaklar "Taslak" etiketiyle; kendi düzeni olanlar işaretli. Seçim adres çubuğunda durur (`?icerik=cnt_…`), yenilemede kalır.
- **Ağaç** (`page-sections.tsx`, kategori görünümü):
  - "Üstte" listesi ve "Üste bölüm ekle";
  - sabit satır "Sayfanın metni": taşınmaz, silinmez; açılınca kısa açıklama ve "İçerik'te düzenle" bağlantısı (başlık, kapak, metin ve SEO orada);
  - "Altta" listesi ve "Alta bölüm ekle".
  - İletişim sayfasında sabit satırın adı "İletişim bilgileri ve form"dur (rol `contact_page_id`'den okunur; Ek 2026-11-19).
- **Bölüm ekle** sayfanın türlerini sunar (`GROUP_TYPES.pages`). İlk bölüm eklenince öge belgeye girer; son bölüm silinince çıkar. Sayfa sınırı (20) dolunca seçicide "Kendi düzeni olan en çok 20 sayfa" uyarısı, ekleme düğmesi kapalı.
- **İçerik ekranı.** Sayfa düzenleme ekranında "Tema düzenleyicide tasarla" düğmesi düzenleyiciyi o sayfa seçili açar. Sayfa listesinde kendi düzeni olanlarda küçük işaret.
- **Önizleme.** Yayındaki sayfa için köprü `navigate { page: "/<handle>" }` gönderir (bugünkü `resolve`). Önizlemede bir içerik sayfasına tıklanınca panel yolu kendi sayfa listesinden tanır ve o sayfayı seçer; köprü mesajı değişmez.
- **Taslak sayfa önizlemesi** (yalnız canlı oturum, `sfs_`): `?sayfa=` yanında `?icerik=cnt_…`; vitrin sayfayı `GET /store/storefront-layout/session/:token/pages/:id` ile durumuna bakmadan okur. Paylaşılan `sfl_` bağlantısı ve yayındaki uçlar **yalnız yayındaki** sayfayı gösterir (taslak sayfa sızmaz). Gerekçe: oturum yalnız düzen yazabilen personele açılır, Redis'te kayıtlıdır, en çok 12 saat yaşar (adr/0065 §1). Sahip "yeni sayfa açıp tasarlamak" istedi; yayınlamadan görmek bunun parçası.

### 6. Vitrin

- `GET /store/storefront-layout` sayfa düzenlerini **vermez**; her istekte bütün sayfaların raflarını ve görsellerini çözmek gereksiz. Yeni uçlar:
  - `GET /store/storefront-layout/pages/:id`: yayındaki belgeden o sayfanın `{ sections: StoreContentPageSection[] } | null`'ı; sayfa yayında değilse `null`. Süreç önbelleği sürüm + satış kanalı + sayfa kimliği anahtarlı (`layout-live.ts` deseni). Okuma hız sınırı `/store/storefront-layout` ile aynı profil.
  - `…/preview/:token/pages/:id` (`sfl_`, yalnız yayındaki sayfa) ve `…/session/:token/pages/:id` (`sfs_`, taslak sayfa dahil; yanıtta sayfanın kendisi de döner), `Cache-Control: private, no-store`.
- `ContentScreen` sayfanın girdisiyle düzenini aynı anda ister; düzen gelmezse ya da uç hata verirse sayfa bugünkü gibi çizilir (bölümsüz). Bölümler `sectionViews` ile çözülür, `byPlacement` ile ikiye ayrılır. Yazılar (`kind: post`) düzen istemez.
- Yayın `storefront.layout_published` ile bugünkü `layout` yenileme sinyalini kullanır; içerik sayfaları da aynı kapsamla tazelenir.

### 7. SEO (CLAUDE.md kural 11)

- **`seo` yükü değişmez.** Başlık, açıklama, canonical, robots, OG sayfanın kendi SEO alanlarından gelir (docs/13 §3). Düzen bunları etkilemez.
- **Tek h1.** h1 her zaman sayfa başınındır. Sayfanın aldığı türlerin hiçbiri h1 basmaz (`hero`, `hero_slider` dışarıda; diğerleri h2, alt başlıklar h3). Bölümlerin başlıkları h2'dir; sıra h1 → h2 → h3 kalır. Bir birim testi her sayfa türü için çizimde tek `<h1>` olduğunu denetler.
- **İlk HTML'de.** Bölümler sunucuda çizilir; tarayıcı ve ajanlar metni ilk yanıtta görür (docs/13 §9).
- **JSON-LD.** Bugünkü `WebPage` kalır. Bölümler yapılandırılmış veri üretmez (SSS `FAQPage` basmaz, adr/0049 Ek 2026-11-06; raf `ItemList` basmaz). `AboutPage` / `ContactPage` alt türü Google'da zengin sonuç vermiyor; getirisi yok (docs/13 §5 ilkesi), bu ADR'ye girmez (Açık kararlar 4).
- **Advisor ve site haritası.** Kelime sayısı ve ince içerik kuralları sayfanın kendi metnini ölçer (`body_summary`, `word_count`); bölüm metinleri sayılmaz. Gövdesi boş, bölümlerle kurulu sayfa "ince içerik" bulgusu alabilir; bu doğru bir uyarıdır (sayfanın kendi sözü yok). Site haritasındaki `lastmod` sayfanın `revised_at`'idir; düzen yayını onu değiştirmez (docs/13 §6: `lastmod` yalnız anlamlı değişimde güncellenir; bölüm düzeni sayfanın içeriği değildir).
- **Adres.** Düzen kimliğe bağlı olduğu için adres değişikliğinde 301 ve düzen birlikte kalır; silinen sayfa 410'dur, düzen 410'u etkilemez.

### 8. Güvenlik

- **Aynı denetim.** Sayfa bölümleri ana sayfa bölümleriyle aynı şemadan (`.strict()`, kapalı listeler, `shopText`, `storefrontLink`, medya kütüphanesi görselleri) ve aynı `checkLayout`'tan (kayıtlar, görseller, zengin metin kartları, belirteçler) geçer. HTML, CSS, betik yazılmaz (adr/0049 §2).
- **Zengin metin** içerik belgesidir; HTML'i sunucu izinli düğüm listesinden çizer (adr/0019). Değişiklik yok.
- **Sayfa kimliği.** Biçim `^cnt_[0-9A-Za-z]{1,40}$`; kayıtta sayfanın var olduğu ve `kind: page` olduğu denetlenir. Kimlik başka kaydın verisine erişim açmaz: herkese açık uç yalnız yayındaki sayfanın düzenini verir.
- **Boyut.** Rota `sizeLimit: "1mb"`, belge bayt sınırı 1 MB; sayfa ve bölüm sayısı şemada sınırlı (§1).
- **Yetki ve kayıt.** Yazma `owner` ve `admin` (adr/0040), denetim kaydı bugünkü `storefront_layout` kaynağıyla (`auditMutations`).
- **Taslak sayfa** yalnız canlı oturum ucunda okunur (§5); `sfl_` ve yayındaki uçlar taslak sayfa vermez. Uçların test kapsamında bir jeton türünün öbürünün kapsamını açmadığı denetlenir (adr/0049 Ek 2026-11-02 L4 deseni).
- Ödeme, kargo, fatura, auth ve migration'a dokunmaz; yine de S1 ve S3 birleşmeden önce `security-reviewer` çalıştırılır (yeni herkese açık uç, önizleme kapsamı).

### 9. Teslim: dilimler

Sıra bağımlılığa göre. Her dilim kendi PR'ıdır; `pnpm verify:changed` ve ilgili testler yeşil olunca birleşir.

| Dilim | Kapsam | Testler | Kabul ölçütü |
| --- | --- | --- | --- |
| **S1: sözleşme + backend** | `@qticaret/types`: `StoreContentPageSection`, `StorePageLayout`. Backend: `pages` grubu (`layoutDocument`, `storedDocument`, `LAYOUT_LIMITS.pages/page`, kayan yazı sınırı), `contentPageSection`, kayıtta sayfa denetimi ve silinmiş sayfanın düşürülmesi (`dropped_pages`), yayın/geri yükleme/görünüm uygulamada aynı kural, `sizeLimit` + `too_large`, üç okuma ucu (§6) ve önbellek. | `layout.unit.spec.ts` (şema, sınırlar, eski belge, kimlik tekilliği, yazı kimliği reddi), `layout-check` birim, `integration-tests/http/storefront-layout-pages.spec.ts` (kayıt, yayın, düşürme, uçların kapsamı: `sfl_` taslak sayfa vermez, `sfs_` verir; yayında olmayan sayfaya `null`) | Eski belge değişmeden okunur; sayfa düzeni kaydedilir, yayınlanır, sürümden geri gelir; silinen sayfa kaydı engellemez. |
| **S2: panel** | Üst çubukta "İçerik sayfası" + sayfa seçici, ağaçta üst/alt listeler ve sabit metin satırı, bölüm ekleme türleri, son bölümle ögenin kalkması, sınır uyarıları, İçerik ekranında "Tema düzenleyicide tasarla", önizlemede yol → sayfa eşlemesi, `?icerik=` ile taslak sayfa. Türkçe metinler i18n anahtarlarıyla. | `theme-editor-pages.spec.tsx` (seçim, ekleme, silme, sınır), `section-forms.spec.tsx` türleri, `panel-groups.spec.tsx` yeni grup, İçerik ekranı düğmesi | Sahip bir sayfayı seçip bölüm ekler, sıralar, gizler; değişiklik önizlemede anında görünür; geri al/yinele çalışır. |
| **S3: vitrin + tema** | `ContentScreen` sayfa düzenini ister; `ContentPageView.sections`; Atölye `ContentPage` başı, üst bölümleri, gövdeyi, alt bölümleri kardeş dizer; `previewPage` `?icerik=`. Görünüm kilidine içerik sayfaları eklenir: düzensiz düz sayfa ve iletişim sayfası (`fixture-content-pages`), düzenli bir sayfa. | `preset-lock-pages` içerik örnekleri; `atolye-content-theme.spec.ts` (düzensiz sayfa HTML'i S3'ten önceki örnekle aynı; tek h1; bölümler doğru yerde); `preview.spec.ts` (`?icerik=` yalnız `sfs_`) | Düzeni olmayan her içerik sayfası, iletişim dahil, birebir bugünkü HTML'i verir; düzenli sayfada bölümler metnin üstünde ve altında çizilir. |
| **S4: `rich_text` `with_image`** | Sözleşme listesi, backend dalı (`image`, `image_side`; alt bilgide yalnız `pane`), panel biçim seçimi ve görsel alanı (çizimli seçim, alan işaretleri `image`, `title`, `body`), Atölye çizimi. | Ayna eşitlik testi, `layout.unit.spec.ts`, panel `section-forms.spec.tsx` ve `panel-groups.spec.tsx`, tema çizim testi; görünüm kilidi **değişmez** (hiçbir görünüm `rich_text` kullanmıyor; kullansa da `pane` aynı) | Var olan `rich_text`'ler aynı çizilir; yeni biçim ana sayfada ve içerik sayfasında seçilebilir. |
| **S5: Katalog Hakkımızda** | `sector-packs` preset şemasında `pages` ve `page_id` başvurusu; `applyPresetWorkflow`'da sayfa çözümü, `skipped`/`kept` kuralı; Katalog `layout.json` `pages` ögesi ve `images/acilis-bileme.webp`; `preset.json` sürümü ve açıklaması ("Hakkımızda sayfası düzeni" eklenir), paket sürümü; kilit örneği `pnpm lock:presets` (`cutlery-katalog/about.html`). Geliştirme mağazasında Hakkımızda metni, kapağı ve vaatler panelden girilir, görünüm yeniden uygulanır, tarayıcıda 390 ve 1440 px'te bakılır. | preset şema testi (bütün görünümler `production` ve `test` defterleriyle), `preset-apply` birim (sayfa yok → `skipped`; adlandırılmayan sayfa → `kept`), kilit testi | Katalog uygulanınca `hakkimizda` sayfası §4'teki düzenle görünür; İletişim'in elle kurulmuş düzeni korunur; sayfa yoksa panel nedenini söyler. |

## Alternatifler

### Sayfa bölümlerinin yeri

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| **Düzen belgesinde `pages` grubu (seçilen)** | Taslak, yayın, sürüm, önizleme oturumu, geri al/yinele, kitaplık ve hazır görünüm hazır; tek "Yayınla"; bölüm şemaları ve denetim tek yerde | Belge sayfa sayısıyla büyür (sınır 20, 1 MB); silinen sayfanın ögesi temizlenmeli | **Seçildi** |
| İçerik kaydında alan (`content_entry.layout`) | Sayfa silinince düzen de gider; belge büyümez | Yayındaki sayfanın taslak düzeni için yeni sütun ve yayın akışı; sürüm geçmişi yok; düzenleyici iki yere yazar; önizleme oturumu içerik taslağını bilmez; hazır görünüm ve kitaplık taşıyamaz; denetim ikiye bölünür | Reddedildi |
| `storefront-layout` modülünde sayfa başına ayrı kayıt | Belge küçük kalır | Ayrı taslak/yayın/sürüm; tema ile sayfa düzeni ayrı yayınlanır, karışık görünüm riski; migration | Reddedildi |
| Shopify gibi paylaşılan sayfa şablonları (`page.about`) | Aynı düzen birçok sayfada | Sayfaya özel içerik için ek alan sistemi gerekir; sahibin istediği "bu sayfayı düzenle" değil | Reddedildi; ileride "düzeni başka sayfaya kopyala" yeter |

### Anahtar ve yerleşim

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| **Sayfa kimliği, dizi ögesi (seçilen)** | Adres değişince kopmaz; hazır görünüm `$handle` yazabilir | Panel listesi için sayfa adları ayrıca okunur | **Seçildi** |
| Sayfa yolu (`contact_form_path` gibi) | Okunması kolay | Adres değişince düzen kopar (bugün iletişim rolünde olan sorun) | Reddedildi |
| Kimlik anahtarlı nesne (`{ "cnt_…": … }`) | Doğrudan erişim | Hazır görünüm anahtar yerinde başvuru çözemez | Reddedildi |
| **`placement` üst/alt, metin sabit (seçilen)** | Kategori deseni, panel ve şema hazır; metin ve rol gövdesi saklanmaz, iletişim görünümü korunur | Metin iki bölüm arasına taşınamaz (yalnız üst ya da alt) | **Seçildi** |
| Metin de bölüm (`page_body`), serbest sıra | Tam serbestlik | Her sayfaya saklanan ana bölüm ve sayfa başına benzersiz kimlik; düzensiz sayfayla düzenli sayfa farklı veri yolları; kazanç küçük | Reddedildi |
| Formu ayrı `contact_form` bölümü yapmak (Dawn) | Form başka sayfaya da konur | Bugünkü iletişim ızgarası bozulur (adr/0066 K2); form eyleminin yeri ayrı karar | Sonraya (Açık kararlar 2) |

### Hakkımızda'nın görselli metni

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| **`rich_text` biçimi `with_image` (seçilen)** | Uzun, biçimli metin (içerik belgesi); var olan tür; varsayılan bugünkü çizim | Bir biçim daha | **Seçildi** |
| `banner` tek görsel | Yeni kod yok | Metin 160 karakter düz; hikâye sığmaz | Reddedildi |
| Yeni tür `image_text` | Bağımsız | Aynı alanlarla ikinci tür; K4'e ters | Reddedildi |
| `banner` `split` biçimi (adr/0049 Ek 2026-11-14 §3.2 KB2) | Planlı iş | Metin yine kısa; kart odaklı | Kendi işinde kalır |

### Hazır görünümde eksik sayfa

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| **Ögeyi düşür, nedenini söyle (seçilen)** | adr/0063 §4 kuralıyla aynı; mağazanın içeriğine dokunmaz | Sahip sayfayı açıp yeniden uygulamalı | **Seçildi** |
| Görünüm sayfayı oluştursun | Tek adım | Görünüm içerik yazar; canlı mağazada görünür sayfa; adr/0063 §5'e ters | Reddedildi |
| Ögeyi bekleyen şablon olarak tut, sayfa açılınca uygula | Kendiliğinden | Belgede görünmeyen yetim veri; anlaşılmaz | Reddedildi |

## Sonuçlar

- **Olumlu.** Her içerik sayfası, yenileri dahil, düzenleyicide bölümlerle kurulur; taslak, yayın, sürüm ve canlı önizleme aynen çalışır. İletişim sayfası değişmeden kalır, üstüne ve altına bölüm alır. Katalog bir Hakkımızda düzeni getirir; `with_image` ana sayfada da kullanılabilir.
- **Olumsuz.** Düzen belgesi büyür; taslak isteğinin sınırı 1 MB'a çıkar. Sayfa silinince düzeni sonraki kayda kadar yetim kalır (zararsız; okunmaz). Panelde bir sayfa seçicisi daha.
- **Migration yok.** Belge JSON sütununda; eski belgeler boş `pages` okur.
- **Kilit.** S3 içerik sayfalarını kilide alır; S5 Katalog'un Hakkımızda örneğini ekler. Var olan görünümlerin ana sayfa, ürün ve liste örnekleri değişmez.
- **Sonraya kalanlar.** Yazılar (`kind: post`) için düzen; formun ayrı bölüm olması; sayfa rolünün (iletişim, ödeme, kargo) yol yerine kimlikle seçilmesi; bölüm metinlerinin advisor'a sayılması.

## Açık kararlar (sahip)

Önerilenle ilerlenir; sahip değiştirirse ilgili dilimden önce düzeltilir.

1. **Taslak sayfayı düzenleyicide görmek** (§5). Öneri: evet, yalnız canlı oturumda. Alternatif: yalnız yayındaki sayfalar.
2. **İletişim formunu başka sayfaya koymak.** Öneri: şimdilik hayır; form iletişim sayfasının gövdesinde kalır.
3. **İletişim rolünün yolla seçilmesi** (önceden var olan durum). `contact_form_path` bir yoldur: iletişim sayfasının adresi değişirse form, ayarlar güncellenene kadar görünmez (`screens/content.tsx` `contactOfPage`). Öneri: ayrı küçük işte rolleri (iletişim, ödeme, kargo) sayfa kimliğiyle tutmak. Bu ADR'yi beklemez. **Yapıldı (Ek 2026-11-19).**
4. **`AboutPage` / `ContactPage` JSON-LD.** Öneri: hayır (zengin sonuç yok); istenirse içerik sayfasına "sayfa türü" seçimi olarak ayrı iş.
5. **Hakkımızda metni.** §4'teki metinler mylarte.com'un anlatımından yeniden yazıldı (birebir alıntı değil). Sahip görüp düzeltir; vaat şeridi ve kapak mağazanın verisidir.

## Ek 2026-11-19: sayfa rolleri kimlikle (Açık kararlar 3)

- **Ayar.** `storefront` bölümüne `contact_page_id`, `payment_page_id`, `shipping_page_id` (`cnt_…` ya da `null`) geldi. Eski `contact_form_path`, `payment_info_path`, `shipping_info_path` alanları yalnız rolün kimliği boşken okunur: o adresteki içerik sayfası (`kind: page`) rolü taşır. Bölüm JSON sütunundadır; migration yok.
- **Kayıt.** `updatePlatformSettingsWorkflow`'un ilk adımı (`steps/page-roles.ts`, kural `lib/storefront/page-roles.ts`): gönderilen yeni kimlik mağazanın içerik sayfası değilse (yazı ya da yok) `platform_settings.page_unknown` ile reddedilir; kayıtlı kimlik aynen gönderilirse (sayfası silinmiş olsa da) kayıt sürer. Rol kimlikle yazılınca eski yolu `null` yazılır. Kimliği olmayan rolün eski yolu bir sayfa bulursa, bölümün sonraki her kaydında kimliği yazılır; bulamazsa yol kalır (sayfa sonra açılabilir). Yalnız yol gönderen eski istemci rolü yeniden adresle seçer, ardından aynı dönüşüm uygulanır.
- **Vitrin.** `GET /store/storefront` her rolün sayfa kimliğini ve yayındaki adresini verir (taslak ya da silinmiş sayfa: adres `null`). `ContentScreen` rolü kimlikle tanır (`lib/views/page-roles.ts`; kimlik alanı olmayan eski arka uçta adresle). Ürün sayfasının "kargo hakkında" bağlantısı canlı adresi kullanır; içerik kaydı (`content` kapsamı) çerçeveyi de tazeler.
- **Panel.** Vitrin tercihlerinde yol kutuları yerine aranabilir sayfa seçici (`shared/page-role-picker.tsx`; düzenleyicinin sayfa seçicisiyle aynı arama); silinmiş sayfa uyarı verir, kaydı engellemez. Düzenleyicide iletişim sayfasının sabit satırı da kimlikle tanınır.
- **SEO.** Adres değişince 301 bugünkü gibi `workflows/content/paths.ts`'te; rol artık adrese bağlı olmadığından 301'in yanında form ve canlı bilgiler de yeni adreste kalır.

## Ek 2026-11-19 (2): Sayfalar tema düzenleyicinin

- **Dayanak:** sahip (2026-11-19): "sayfalardaki o altta üstte içerik mantığı olmasın direkt mevcut içerikler gelsin hakkımızdaya bu sayfaları direkt içinden oluşturmasın direkt tema düzenleyicide oluştursun. blog içeriği değil bu"
- **Anlamı:** üst/alt yerleşimi yok; sayfanın bugünkü metni sayfanın tek bölüm listesinde bölüm olarak görünür; sayfa tema düzenleyicide açılır ve düzenlenir, İçerik'te değil; İçerik yalnız blog yazılarınındır.
- **Geçersiz kılınanlar:** §1 `placement` ve "sayfa başı ve sayfanın metni bölüm değildir, saklanmaz"; §1 sınır tablosunda sayfa sayısı (20); §2'nin tamamı (sabit metin, rol gövdeleri, `sections: { top, bottom }`); §3'te "başka yeni tür ya da biçim yok"; §4'te "görünüm sayfa oluşturmaz", Katalog düzeninin `bottom` yerleşimi ve "sayfanın kendi metni İçerik'te"; §5'te üst/alt listeler, sabit "Sayfanın metni" satırı, "İçerik'te düzenle" ve İçerik'teki "Tema düzenleyicide tasarla"; §6'da `byPlacement` ve "düzen gelmezse bölümsüz çizilir"; §7'de "bölüm metinleri sayılmaz" ve "düzen yayını `lastmod`'u değiştirmez"; Alternatifler'de "`placement` üst/alt, metin sabit" seçimi ve formun "Sonraya" bırakılması; Açık kararlar 2. Ek 2026-11-19'daki roller kalır, anlamı daralır (K10).
- **Çakışma kontrolü (2026-11-19, `git fetch --prune`):** `origin`'de `dev` ve `main` dışında dal yok, açık PR yok; `progress/oguzhan.md` sıradaki işleri yapay zekâ genişletme 2 ve panel küçük işleri. Örtüşme: Atölye `content/*` Oğuzhan'ın tema alanı (S8 PR'ında not); yapay zekâ SEO önerisi kartı sayfa ayarları paneline taşınır (S7; `lib/ai/facts/page.ts` değişmez); "SSS taslağı" adayı sayfaya yazacaksa K2'deki türleri kullanır.

### K1. Sayfa başına tek sıralı liste

- `pages[].sections` tek listedir; sıra çizim sırasıdır. `placement` şemadan çıkar (`lib/storefront/layout-pages.ts:82-124`, `sections/rich-text.ts:46-51` `placedRichText`, `packages/types` `StoreContentPageSection`).
- **Okuma kuralı (migration yok, JSON sütunu):** `storedPages` (`layout-pages-stored.ts:28`) `placement` taşıyan ögeyi eski biçim sayar: önce `top`'lar, sonra sayfanın metin bölümleri, sonra `bottom`'lar (her grupta saklanan sıra); `placement` atılır. Eski biçimde metin bölümü yoktur; okuyucu metnin yerini (`text_at`: üstlerin sayısı) döner, metni K3'teki dönüşüm ya da K6'daki geri yükleme yerleştirir.
- **Sınırlar:** `LAYOUT_LIMITS.pages` 20 → **50** (artık metni olan her sayfanın bir ögesi var; 20 "kendi tasarımı olan sayfa" içindi). `page` 12 kalır, metin bölümleri dahil. Belge 1 MB ve rota `sizeLimit: "1mb"` kalır (`api/http/storefront-menu-routes.ts:46`, `designs/limits.ts:10`). Aynalar: `PAGE_LAYOUT_LIMITS` (types; panel `layout/page-layouts.ts:32`).
- **Ögesi olmayan sayfa** (sınır dolu, içe aktarma, eski sürüm geri yüklemesi): metni K2'deki `body` aynasından **sentezlenir**. `GET /store/storefront-layout/pages/:id` (ve `preview`, `session` uçları) ögesi olmayan sayfaya `[article(body)]` ve rol sayfasıysa rol bölümünü (K3 tablosu) `synthesized: true` ile döner. Düzenleyici aynı sentezi gösterir; ilk değişiklik ögeyi oluşturur (yer varsa).

### K2. Sayfanın metni bölümdür, düzen belgesinde saklanır

- Taslak, yayın, sürüm, önizleme, geri al/yinele ve tek "Yayınla" belgeyle gelir.
- **İçerik kaydında kalanlar:** başlık, adres (301/410, `workflows/content/paths.ts`), SEO alanları, durum, kapak. Sayfa başı (iz, tek h1 = başlık, kapak) bölüm değildir, sabit üsttedir (tek h1, docs/13). Başlık ve kapak sayfa ayarları panelinde düzenlenir (K5).
- **Yeni metin bölümleri:**

| Bölüm | Şema | Çizim (Atölye) | Neden |
| --- | --- | --- | --- |
| `rich_text` biçimi **`article`** ("Sayfa metni") | Ortak alanlar (`title` isteğe bağlı, `body: contentDoc`); ayarlar `outline: auto \| off` (içindekiler), `questions: auto \| off` (soru-cevap okuma); varsayılan `auto` = bugünkü davranış | Bugünkü `InfoBody` / `FaqBody` (`ContentPage.tsx:23-80`): okuma ölçüsü, uzun metinde içindekiler (`OUTLINE_MIN`), soru-cevap metninde gruplu açılırlar ve yanında iletişim yolları | `pane` (`Story`: başlık solda, gölgeli zemin) bugünkü sayfa görünümü değil; adr/0066 K4: eksik olan biçimdir. `pane` ve `with_image` çizimi değişmez. Yalnız `pages` grubunda (içindekiler ve soru-cevap sayfa kavramı; ileride açmak eklemedir) |
| **`contact`** ("İletişim") | `body: contentDoc` (bölümün kendi metni), `form: on \| off`, `imprint: on \| off` (varsayılan açık); sayfa başına en çok 1, yalnız `pages` | Bugünkü `ContactBody` birebir: metin ve "Bize ulaşın" sahnesi solda, form sağda, künye altta | Sahip beğendi; sabit `id`'ler (`bize-ulasin`, `kunye`) sayfada tek olmayı ister |
| **`payment_facts`** ("Ödeme seçenekleri"), **`shipping_facts`** ("Kargo bilgileri") | Alan yok (canlı veri); sayfa başına her biri en çok 1, yalnız `pages` | Bir `article`'ın hemen ardından: bugünkü gibi metnin yanında (7/5 ızgara, taksit tablosu altta; `Blocks.tsx:50`'deki SSS + yardım birleşmesi deseni). Tek başına: tam genişlikte | Bugün rol sayfasında metnin yanında çiziliyor; bölüm olunca istenen sayfaya da konur, yan yana kuralı bugünkü görünümü korur |

- **İçerik belgesi `rich_text`'e sığar:** ikisi de `contentDoc` (`lib/content/doc.ts:245`, `sections/rich-text.ts:29`): başlık h2–h4, listeler, bağlantılar, tablolar, görseller, ürün/kategori kartları, `{belirteç}`ler; sınırlar (`DOC_LIMITS`) aynı. Şema genişletmesi gerekmez.
- ~~**SSS `faq` bölümüne taşınmaz:**~~ (Ek 2026-11-24 (2) ile değişti: SSS `faq` `page` bölümünün kendi satırlarıdır.) `faq` en çok 12 soru, 600 karakter düz metin yanıt, grup yok (`sections/faq.ts:37-48`); SSS sayfası gruplu ve biçimli yanıtlı. `article` + `questions: auto` bugünkü çizimi verir; `faq` kısa SSS için kalır.
- **Hidrasyon:** `article` ve `contact` içerik okumasının yaptığını yapar (`api/store/content/read.ts:188-211`): belirteçler, kartlar, görsel sürümleri (`images`, vitrin `withPictures`), tablolar. `layout-hydrate.ts:198-215`'in `rich_text` dalı genişler.
- **`body` sütunu yayındaki metnin türetilmiş kopyasıdır (ayna).** Brief "sonra sayfa için kimse okumasın" diyordu; kodda okuyan çok (K7) ve geri dönüş için güncel kalması gerek (Açık kararlar 1):
  - Sayfanın (`kind: page`) `body`'sini yalnız sistem yazar: düzen yayını, K3 dönüşümü, K4 yazıcıları. `POST /admin/content(/:id)` sayfaya `body` gönderirse `content.page_text_in_editor` (400); yazılar değişmez.
  - Ayna = sayfanın yayındaki metin bölümlerinin (`rich_text` bütün biçimleri, `contact`) belgeleri sırayla birleşik; başlığı olan bölümün başlığı önce h2 olarak. Tek, başlıksız bölümde ayna = o bölümün `body`'si (dönüşümde `revised_at` oynamaz).
  - Yayın adımı yalnız aynası değişen sayfaları yazar (`canonical`, `workflows/content/rules.ts:105`): `body`, `body_summary`, `word_count`, yayındaki sayfada `revised_at`; `content.saved` olayı (advisor yeniden değerlendirir) ve `content` yenileme kapsamı. Kart ve görsel denetimi yapmaz (bölüm kaydında yapıldı; silinmiş ürünün kartı çizimde düşer). Telafi: önceki aynalar geri yazılır.
- **`checkLayout` kart kuralı:** bugün her taslak kaydı bütün `rich_text` kartlarını denetliyor (`layout-check.ts:206-210`); silinmiş ürünü anan eski sayfa metni düzenleyiciyi kilitlerdi. Kural içerik kaydınınkine döner (`rules.ts:16-24`): yalnız bu kayıtta yeni eklenen kart reddedilir ("engel değil uyarı"). Belirteç ve görsel denetimi aynen, `contact` gövdesi dahil.

### K3. Var olan sayfalar bir kez dönüştürülür

- **Yer:** repo deseni `apps/backend/src/migration-scripts/` (docs/02:73, `db:migrate`'te mağaza başına bir kez; örn. `storefront-menus-from-settings.ts`, `store-whatsapp-phone.ts`). Dosya `content-pages-into-layout.ts`; iş dışa aktarılan `movePageTexts(container)`'da, HTTP testi onu doğrudan çağırır (`storefront-menus.spec.ts` deseni). Context7 kotası bu yazımda doluydu; S6'da Context7 ile yeniden doğrulanır.
- **Her sayfa için metin bölümleri** (`kind: page`, silinmemiş):

| Sayfa | Bölümler (sırayla) |
| --- | --- |
| Rolü yok, metni var (SSS dahil) | `article(body)` |
| İletişim rolü (`contact_page_id`, yoksa `contact_form_path`) | `contact(body)` |
| Ödeme / kargo rolü | `article(body)`, `payment_facts` / `shipping_facts` |
| Metni boş, rolü yok | Öge yok (bugün de yalnız sayfa başı) |

- Var olan ögenin `top`'ları önce, metin bölümleri, `bottom`'lar sonra. Bölüm kimlikleri sayfa kimliğinden türetilir (yeniden koşuda aynı), belgede tekil.
- **Taslak ve yayın ayrı ayrı:** taslak belgeye; yayında belge varsa ona da (yayındaki sayfa görünümünü hemen korur), yeni sürüm satırıyla (`reason: "conversion"`, aktör sistem, denetim kaydı). İçerikte taslak/yayın metin ayrımı yoktu; iki belgeye aynı metin gider.
- **Eşgüçlü:** metin bölümü (`article`, `contact`) olan ya da `placement` taşımayan öge atlanır; iki koşu aynı belgeyi verir.
- **Sınır (uyarı, engel değil):** sıra yayındaki sayfalar (`published_at`), sonra taslaklar (`created_at`). Öge sayısı 50'ye ya da belge 1 MB'a varınca kalan sayfalar ögesiz kalır, K1 sentezi metinlerini çizer; log `storefront.pages_converted` (`converted`, `left`, `bytes`; metin ve başlık yok). Düzenleyici o sayfalarda "Sayfa sınırı dolu: bu sayfanın metni yalnız gösteriliyor" der. 12 bölüm sınırı aşılırsa fazla `bottom` bölümleri düşer ve aynı logda sayılır.
- **Sonra `body`'yi okuyan:** yalnız aynanın okuyucuları (K7) ve K1 sentezi. Sütun silinmez.
- **Sıra:** `movePageTexts` ve testleri S6'da; `db:migrate`'in koşturduğu dosya **S8'de** eklenir (vitrin ve panel yeni biçimi okurken), ara `dev`'de metin iki kez çizilmesin.

### K4. Sayfa metnini yazan diğer yollar

- **`replacePageTextWorkflow(page_id, doc)`:** ögesi varsa ilk `article`'ın (yoksa `contact`'ın; ikisi de yoksa başa yeni `article`) gövdesini taslakta ve yayında değiştirir (yeni sürüm satırı), aynayı yazar; ögesi yoksa aynayı yazar (sentez çizer) ve yer varsa K3 kuralıyla öge açar.
- Kullananlar: eski siteden içe aktarma (`workflows/migration/content.ts:222-235`), mağaza profili (`scripts/shop-profile/apply.ts:37-58`). Başlık, adres, durum için `saveContentWorkflow` aynen, `body`'siz.

### K5. Sayfa tema düzenleyicide açılır ve yönetilir

- **Sayfa seçici** (`content-page-picker.tsx`): en üstte "Yeni sayfa": başlık → adres başlıktan (düzenlenebilir; boşsa `freeHandleFrom`). `POST /admin/content { kind: "page" }` taslak sayfa açar; düzenleyici onu seçer, taslağa boş bir `article` ekler.
- **Ağaç** (`content-page-sections.tsx:65-104`): ana sayfadaki gibi tek liste; sabit satır ve üst/alt listeler kalkar. "Bölüm ekle" `GROUP_TYPES.pages`'e eklenen `article`, `contact`, `payment_facts`, `shipping_facts`'ı sunar; tekil tür sayfada varsa kapalı.
- **Sayfa ayarları paneli** (yeni; `page-text-panel.tsx` kalkar): başlık, adres ("eski adres 301 ile yeni adrese gider"), SEO başlığı ve açıklaması (bugünkü SEO kartı, yapay zekâ önerisi dahil), kapak (medya kütüphanesi), Taslak/Yayında, sil (onaylı; yayında olmuş sayfada "adres 410 verir" notu).
- **Hemen kaydedilir (öneri), yayınla gitmez.** Gerekçe: 301/410 ve yol kaydı içerik iş akışının kilitli, telafili adımları (`workflows/content/workflows.ts:39-82`); site haritası `revised_at`/`published_at`'ten okur; yayın bir belge kopyasıdır ve sürüm geri yükleme ad değişikliğini ya da silmeyi geri alamaz; taslak sayfa `sfs_` oturumunda zaten görünür. Panel "Sayfa ayarları hemen kaydedilir" der.
- **Tek adım hissi:** "Yayınla" penceresi taslakta değişikliği olan **taslak durumdaki** sayfaları "Sayfayı da yayına al" kutusuyla listeler (düzenlenen sayfa işaretli). Yayın isteği `pages_live: cnt_…[]` alır; yayın iş akışı belgeyi yayınlar, sonra bu sayfaları içerik iş akışıyla `published` yapar (telafi: eski durum).
- **İçerik:** gezinmede Sayfalar sekmesi kalkar, varsayılan sekme yazılar (`content-list-page.tsx:38`). `/content?kind=page` → `/storefront/editor?sayfa=icerik`; `/content/$id` sayfaysa → `/storefront/editor?icerik=<id>&ayar=sayfa` (`routes/_auth/content/$id.tsx`). Sayfaya giden diğer bağlantılar da düzenleyiciye: SEO denetimi (`seo/audit/audit-item.tsx:126`), medya kullanımı (`media/components/media-usage.tsx:30`). "Tema düzenleyicide tasarla" (`content-design-link`) kalkar.

### K6. Geri yükleme, kitaplık, hazır görünüm

- **Sürüm geri yükleme ve kayıtlı görünüm (adr/0064):** belge neyse o gelir, metinler de o günkü hâline döner (taslağa; pencere "Sayfa metinleri de bu sürümdeki hâline döner" der). Eski biçimli ögede (K1 `text_at`) o sayfanın taslaktaki bugünkü metin bölümleri (yoksa aynadan sentez) `text_at`'e yerleşir: dönüşüm öncesi bir sürüm metni silmez. Belgede ögesi olmayan sayfa sentezle görünür.
- **Hazır görünüm (adr/0063) mağazanın metnini korur (öneri):** görünüm bir sayfanın düzenini değiştirirken mağazanın o sayfada metin bölümü (`article`, `contact`) varsa görünümün metin bölümleri düşer, mağazanınkiler görünümün ilk metin bölümünün yerine (kendi sıralarıyla) konur; `kept`'te `{ where: "pages", ref, reason: "text" }`. Metni yoksa görünümün metni gelir. Gerekçe: görünüm metni geneldir, mağazanın hikâyesi kendinindir (§4'ün amacı). Ana sayfadaki `rich_text`'ler bugünkü gibi değişir.
- **Görünüm eksik sayfayı taslak açar (öneri; §4'ün "oluşturmaz" kuralını değiştirir):** sayfalar artık düzenleyicinin nesnesidir. Tutamaç (`page:hakkimizda`) mağazada yoksa `name` başlığıyla ve tutamacın adresiyle **taslak** sayfa açılır; yanıtta `made_pages`, panel "Hakkımızda sayfası taslak olarak açıldı; yayına almak için sayfa ayarlarından Yayında'yı seçin" der. Taslak sayfa herkese kapalıdır (404); adr/0063 §5'in "canlıda görünen demo içerik" kaygısı doğmaz. Adres alınamazsa öge eskisi gibi `skipped`. Adım telafilidir (sayfa silinir). Taslak atılırsa sayfa boş taslak kalır (zararsız, silinebilir).

### K7. `body` okuyucuları ve sonrası

| Okuyucu | Yer | Sonra |
| --- | --- | --- |
| Vitrin sayfa çizimi | `api/store/content/read.ts:188-211` (`html`); `screens/content.tsx:119-168` | Metin bölümlerden (`/store/storefront-layout/pages/:id`). `html` (ayna) yalnız uç hata verirse tek `article` olarak çizilir |
| Meta açıklama yedeği | `workflows/seo/payload-content.ts:90` (`excerpt ?? body_summary`) | Aynanın `body_summary`'si; kod değişmez |
| JSON-LD `WebPage` `dateModified` | `payload-content.ts:96-99` | Ayna yazımındaki `revised_at`; metin bölümü yayında değişince ilerler |
| Site haritası `lastmod` | `workflows/seo/sitemap-build.ts:87-93, 144` | Aynı (`revised_at`); metin dışı bölümler ilerletmez (docs/13 §6) |
| SEO advisor (kelime, başlık, iç bağlantı, alt metin; docs/14) | `seo/advisor/facts-content.ts:41, 84-120`; `jobs/seo-advisor-nightly.ts`; `seo/audit/records.ts` | Ayna; artık sayfanın bütün metin bölümleri sayılır (§7'deki "sayılmaz" kalkar); `content.saved` yeniden değerlendirir |
| Yapay zekâ olguları | `lib/ai/facts/page.ts:23-37` (`body_summary`) | Ayna; kod değişmez |
| Bağlantı raporu ve yeniden yazma (adr/0042 Ek 2026-11-05) | `workflows/content/link-plan.ts:16, 131`; `steps/rewrite-links.ts:28`; `scripts/content-links.ts` | Sayfalarda kaynak düzen belgesi: rapor taslaktaki metin bölümlerini okur; yeniden yazma taslak ve yayındaki metin bölümlerini değiştirir (yeni sürüm satırı, sistem), sonra aynayı yazar. Yazılar ve ürünler değişmez |
| Medya kullanımı | `workflows/media/usage.ts:207-222` (`content_entry.body` ve `storefront_layout`) | İkisi de görseli tutar; değişmez |
| İçerik denetim kaydı | `api/http/audit/resources/content.ts:25-37` | Panel sayfa `body`'si yazmaz; ayna yazımı ayrı denetlenmez (yayının denetimi var) |
| İçe aktarma, mağaza profili | `workflows/migration/content.ts:230`, `scripts/shop-profile/apply.ts:53` | K4 |
| Belirteçler | `rules.ts:85-97` (`unknownDocTokens`) | `checkLayout`'ta metin bölümlerine aynısı (`contact` dahil) |
| url-registry, 301/410 | `workflows/content/paths.ts`, `workflows/seo/redirects/*` | Adrese bağlı; değişmez |
| Site araması | `modules/search-index` | İçerik sayfası dizinlenmiyor; değişmez |

### K8. Tema sözleşmesi ve vitrin

- `ContentPageView.sections?: HomeSectionView[]` tek liste (`packages/ui/src/content-views.ts:293`); `HomeSectionView`'e `article`, `contact`, `payment_facts`, `shipping_facts` görünümleri. `html` kalır (yazı ve yedek çizim). `contact` görünümü formu, iletişim yollarını ve künyeyi taşır; müşterinin adı ve e-postası vitrinde istek anında doldurulur, arka ucun sayfa önbelleğine (`layout-page-read.ts:75` `pageCache`) girmez.
- `screens/content.tsx`: `contactOfPage` (38-68) ve `pageExtras` (75-96) rolden değil bölümden çalışır; `lib/views/page-roles.ts` `isContactPage` ve `infoPageOf` çizimde kullanılmaz (bağlantılar için `namesPage` kalır). `lib/views/page-sections.ts` `byPlacement` kalkar.
- Atölye `ContentPage`: sayfa başı ve baştaki metin bölümleri bugünkü tek `Container`'da (`ContentPage.tsx:126-131` aralıkları), kalanlar `Blocks`; dönüşmüş, başka bölümü olmayan sayfa bugünkü gibi çizilir. Tek h1 sayfa başınındır; yeni türler h2 basar.
- **Kilitler (adr/0066):** `fixture-content-pages/page.html`, `contact.html`, `page-sections.html` bir kez yeniden yazılır. Kanıt: yeni HTML'den metin bölümlerinin bölüm işareti sarmalayıcıları (`data-qs`, adr/0065 §4) çıkarılınca eski dosyayla birebir eşit (test) ve `pnpm style:diff` 390 ile 1440 px'te fark sıfır. Çizim değişmediği için izinli (iç düzenleme); `preset-lock-content.spec.tsx`'teki "never written again" notu bu Ek'i anar. `cutlery-katalog/about.html` görünüm verisi değiştiği için `pnpm lock:presets` ile yazılır, PR'da etkilenen görünüm yazılır.

### K9. Katalog Hakkımızda

- `layout.json` `pages[0].sections` tek liste, `placement` yok; ilk bölüm görünümün kendi metni, ardından var olan altı bölüm aynı sırada. `preset.json` sürümü artar.
- Metin bölümü: `rich_text` `article`, başlıksız, `outline: auto`, `questions: auto`:

> **Köklerimizden geleceğe.** {mağaza_adı}, el işçiliğini günlük kullanımla buluşturan bir bıçak mağazasıdır. Çakıdan av bıçağına, şef bıçağından koleksiyon parçalarına kadar her ürünü kullanılmak için seçer; kutusundan sunumuna kadar özenle hazırlarız.
>
> Dövme çelik geleneğinden ve desenli çeliğin ustalığından aldığımız ilhamı, bugünün paslanmaz çelikleri ve elinize oturan saplarla birleştiriyoruz.

- Mağazanın Hakkımızda metni varsa K6 gereği o kalır (geliştirme mağazasındaki metin korunur).

### K10. Güvenlik

- Metin bölümleri aynı şemadan (`.strict()`, `contentDoc` izin listesi, HTML sunucuda) ve aynı `checkLayout`'tan geçer; HTML, CSS, betik yazılmaz (adr/0019, adr/0049 §2).
- **İletişim formu bölümün olduğu her sayfada çalışır.** `/store/contact-messages` sayfadan bağımsızdır: e-posta başına hız sınırı (`contact_message`), saatte birden sonra doğrulama, e-posta alan adı denetimi (`api/http/contact-routes.ts:30-35`). "Yalnız yayındaki, bölümü taşıyan sayfadan kabul" denetimi koruma sağlamaz (uç doğrudan çağrılabilir), yazılmaz. Yüzey dar tutulur: bölüm yalnız `pages` grubunda, sayfa başına bir. `contact_page_id` "mağazanın iletişim sayfası" olarak bağlantılar ve dönüşüm için kalır; rol sayfasında `contact` bölümü yoksa vitrin tercihleri uyarır, engellemez. Ödeme ve kargo rolü de çizimi değil yalnız bağlantıyı belirler (ürün sayfasının kargo bağlantısı, `screens/product.tsx:141`).
- Taslak sayfa metni yalnız `sfs_` oturumunda okunur; `sfl_` ve yayındaki uçlar yayında olmayan sayfaya `null` döner (§8); sentez de aynı kuralla.
- `POST /admin/content(/:id)` sayfa `body`'sini reddeder; ayna yalnız sistem adımlarıyla yazılır. Görünümün açtığı sayfa taslaktır, adımı telafilidir.
- Dönüşüm gizli bilgi okumaz; logu yalnız sayı ve kimlik taşır.
- Veri dönüşümü ve herkese açık uç değiştiği için S6 ve S8 birleşmeden önce `security-reviewer`; bulgular ve kapanışları PR'a.

### K11. Dilimler

| Dilim | Kapsam | Testler | Kabul ölçütü |
| --- | --- | --- | --- |
| **S6: sözleşme + backend** | types: tek liste, yeni türler ve biçim, `PAGE_LAYOUT_LIMITS.pages = 50`. Backend: `placement`'sız şema ve okuma kuralı (`text_at`); `article`/`contact`/`*_facts` şemaları, hidrasyonu, tekillik; sentez (üç uç); yayında ayna ve `pages_live`; `checkLayout` kart kuralı; admin'de sayfa `body`'si reddi; `replacePageTextWorkflow`, içe aktarma ve profil; geri yüklemede `text_at`; bağlantı yeniden yazmanın düzen kaynağı; `movePageTexts` (migration dosyası S8'de) | `layout.unit.spec.ts` (eski biçim sırası, türler, tekillik, 50), `page-mirror.unit.spec.ts` (tek başlıksız bölüm → ayna = `body`, `revised_at` oynamaz), `storefront-layout-pages.spec.ts` (sentez, rol bölümü, `sfl_` taslak vermez, yayın aynayı ve `content.saved`'i yazar, `pages_live`), yeni `content-pages-conversion.spec.ts` (düz, SSS, iletişim, ödeme, kargo, boş, üst/alt ögeli, taslak sayfa; iki koşu aynı; taslak + yayın + sürüm satırı; 50 ve 1 MB'ta kalanlar sentezle; silinmiş kart koşuyu durdurmaz), `content.spec.ts` (sayfa `body`'si 400, yazı aynen), `content-links.spec.ts`, `migration-old-site.spec.ts`, `storefront-layout-unknown-section.spec.ts` | Eski belge değişmeden okunur; dönüşüm eşgüçlü; ayna yalnız değişende yazılır; sınır aşımı kaydı ve yayını engellemez |
| **S7: panel** | Sayfa seçicide "Yeni sayfa"; tek liste ağaç; yeni türlerin formları; sayfa ayarları paneli (hemen kayıt, SEO kartı, kapak, durum, onaylı silme); "Yayınla"da "Sayfayı da yayına al"; İçerik'ten Sayfalar sekmesi ve yönlendirmeler; sınır ve sentez uyarıları; i18n anahtarları | `theme-editor-pages.spec.tsx` (yeni sayfa, ayarlar, silme, durum), `theme-editor-page-layouts.spec.tsx` (tek liste, tekil türler, sentezden ilk değişiklik), `section-forms.spec.tsx`, `panel-groups.spec.tsx`, `content-list-page.spec.tsx` (sekme yok, yönlendirme), yayın penceresi testi | Sahip sayfayı düzenleyicide açar, metnini bölüm olarak taşır ve düzenler; İçerik'te sayfa kalmaz |
| **S8: vitrin + tema + kilit + dönüşüm** | `ContentPageView.sections` tek liste; Atölye yeni türler, `article` + facts yan yana kuralı, baştaki metin bölümleri sayfa başıyla tek kapta; `ContentScreen` bölümden; yedek çizim; `migration-scripts/content-pages-into-layout.ts` | `atolye-content-theme.spec.ts` (tek h1, facts yan yana ve tek başına, `contact` = `ContactBody`, `questions`/`outline`), `page-sections.spec.ts`, `preview.spec.ts`, `preset-lock-content.spec.tsx` (sarmalayıcısız eşitlik, sonra kilit yazımı), `pnpm style:capture`/`style:diff` 390 ve 1440 | Dönüşmüş her sayfa, iletişim dahil, bugünkü gibi çizilir (stil farkı sıfır) |
| **S9: Katalog** | `preset-schema.ts:172-176` `placement`'sız; `presets/resolve.ts:132` ve `preset-steps.ts:175`'te metin koruma ve taslak sayfa açma (`made_pages`, telafi); Katalog `layout.json` (K9), `preset.json` sürümü; `pnpm lock:presets` | preset şema testi (bütün görünümler), `storefront-presets-pages.spec.ts` (eksik sayfa taslak açılır; mağazanın metni kalır; metinsiz sayfaya görünümün metni gelir), kilit testi | Katalog uygulanınca Hakkımızda tek listeyle görünür; mağazanın metni silinmez |

- `main`'e sürüm S9'dan sonra. S6–S7 boyunca dönüşüm dosyası olmadığından `dev` vitrini bugünkü gibi çalışır.

### Açık kararlar (sahip; önerilenle ilerlenir)

1. **`body` ayna olarak yaşar** (brief: "sonra sayfa için kimse okumasın"). Okuyucular çok ve geri dönüş güncel metin ister; öneri ayna (K2).
2. **Sınırlar:** 50 sayfa, belge 1 MB. Otomatik kayıt 1,5 sn'de bir bütün belgeyi gönderir (`apps/panel/src/features/storefront/layout/use-autosave.ts:10`); sayfa metinleriyle belge yüzlerce kB olabilir. Dönüşüm logundaki `bytes` ile ölçülür; gerekirse ayrı işte grup bazında kayıt.
3. **Görünüm eksik sayfayı taslak açar** (K6; §4'ü değiştirir). Alternatif: eskisi gibi düşür ve söyle.
4. **Görünüm mağazanın metnini korur** (K6). Alternatif: ana sayfadaki gibi görünümün metni geçer.
5. **Sayfa ayarları hemen kaydedilir**, yayın penceresinde "sayfayı da yayına al" (K5). Alternatif: durum, ad ve adres yayınla gider (301 kaydı ve geri yükleme yüzünden önerilmez).
6. **Eski sürüm ya da kayıtlı görünüm metni de geri getirir** (K6). Alternatif: geri yüklemede metin bölümlerini korumak.
7. **Roller:** iletişim ve ödeme rolünün çizimde işi kalmaz, bağlantı ve dönüşüm için durur. Rol seçimi sayfa ayarlarına ("Bu sayfa: İletişim / Ödeme / Kargo sayfası") taşınabilir; ayrı küçük iş.

### Ek not 2026-11-20

Sahip isteğiyle Vitrin altında "Sayfalar" listesi eklendi (`/storefront/pages`); düzenleme tema düzenleyicide kalır, liste yalnız bulma ve açma içindir. `/content?kind=page` bu listeye gider; tek sayfa bağlantıları düzenleyiciye.

## Ek 2026-11-24 (2): SSS akordeon olarak, soru soru girilir (K2'nin SSS kararını değiştirir)

- **Dayanak:** sahip (2026-11-24): "SSS sayfasında SSS'ler metin olarak eklenmiş ve otomatik ayarlanıyor; bu yanlış, akordeon gibi eklenmeli. Mağaza sahibi buraya düz metin yazar, sonra neden SSS olmadı diye sorar. Olması gerektiği gibi yap."
- **Geçersiz kılınan:** K2'deki "SSS `faq` bölümüne taşınmaz … `article` + `questions: auto` bugünkü çizimi verir" maddesi; K9'daki `questions: auto` (yeni metinler için). Metinden soru çıkarma (`questions: auto`) yeni içerikte kalkar; kayıtlı eski veri güvenle okunmaya devam eder.

### Karar

1. **SSS bölümün kendi satırlarıdır.** `faq` bölümünün her satırı ya bir soru ve cevabıdır ya da bir grup başlığıdır (altındaki sorular bir sonraki başlığa kadar o gruptadır). Soru tek satır, en çok 200 karakter (160'tan genişledi); grup başlığı en çok 120. Cevap kısa zengin metindir (`body`): alt bilgi yazı bloğunun düğümleri (paragraf, satır sonu, madde ve numaralı liste; kalın, eğik, bağlantı), en çok 1500 karakter, boş olamaz, `{belirteç}`ler mağaza bilgisidir; aynı izin listesi ve aynı temizleyici (`contentDoc` + `fitsBare`, adr/0019). Bir bölüm en çok 40 satır tutar (12'den genişledi). Sözleşme `@qticaret/types` `FAQ_LIMITS`, arka uç aynası `sections/faq.ts` (birim testi eşitliği denetler).
2. **Eski cevaplar bozulmaz.** Zengin cevaptan önce kaydedilmiş düz cevap (`answer`, 600 karakter) olduğu gibi okunur ve olduğu gibi çizilir (`<p>`); panel onu tek paragraf olarak gösterir, sahip düzenleyince `body` olarak yazar. Alanın anlamı değişmedi: `answer` hâlâ düz cevaptır, zengin cevap yeni alandır (`body`).
3. **Yeni biçim, eski biçim yerinde (adr/0066).** `faq` biçimli türdür: `standard` (bugünkü çizim: başlık solda, sorular sağda; biçimsiz kayıt böyle okunur, çizimi değişmedi) ve yeni **`page`** ("Sayfa SSS'si"): içerik sayfasının soru sayfası, `questions: auto` ile okunan metnin çizildiği gibi (`FaqBody`: grup başlıkları konu düğmeleri, yanında "Yardım" kutusu ve iletişim yolları, her grubun soruları başlığının altında). Yalnız `pages` grubunda (makaledeki `article` gibi). `standard`'a eklenen tek şey yeni veriye aittir: zengin cevap `gf-prose--small` içinde, grup başlığı soruların arasında küçük `h3`; eski kayıtların HTML'i aynı (kilit testleri değişmedi).
4. **Ayarlar.** "İlk soru açık" ve "aynı anda tek soru açık" iki biçimde de çalışır (`page` için `FaqBody`'ye eklendi; kapalıyken çıktı aynı).
5. **Yeni SSS sayfası soruyla başlar.** Tema düzenleyicide "Yeni sayfa"nın başlığı soru sayfasını adlandırıyorsa ("Sık sorulan sorular", "Sıkça sorulan sorular", "SSS", "FAQ") sayfa boş bir `article` yerine tek sorulu `faq` `page` ile açılır. Yeni eklenen ya da `article`'a çevrilen "Sayfa metni" `questions: off` ile başlar; paneldeki "Soru-cevap okuma" anahtarı yalnız hâlâ açık olan eski metinde görünür (kapatmak için). Düzenleyicinin ve arka ucun eski sayfa için sentezi (K1) `auto` kalır: bugünkü çizim değişmesin.
6. **Sayfanın metni ve ayna (K2).** `faq` `page` sayfanın metnidir: `hasPageText` onu sayar (dönüşüm, sentez ve ayna yazımı için), ayna onu yazıya döker (grup başlığı `h2`, soru kalın satır, ardından cevap; `faqDoc`). Böylece meta açıklama yedeği, kelime sayısı, advisor ve yapay zekâ olguları SSS'yi görmeye devam eder (docs/14). `standard` SSS aynaya girmez (bugünkü gibi).
7. **SEO.** Cevaplar her zaman HTML'dedir (yerel `details`/`summary`, betik yok, açılış düzen kaydırmaz); grup başlıkları `h2`, sayfanın tek `h1`'i sayfa başınındır. **`FAQPage` JSON-LD basılmaz:** docs/13 §5 ve adr/0049 Ek 2026-11-06 geçerlidir (Google SSS zengin sonucunu 7 Mayıs 2026'da bütün siteler için kaldırdı; `seo-policy.spec.ts` kaynakta `"FAQPage"` olmadığını denetler). Brief'teki "FAQPage JSON-LD" maddesi bu yüzden uygulanmadı; geri getirmek ayrı karardır ve docs/13 ile o testi birlikte değiştirir.
8. **Var olan sayfalar bir kez dönüşür.** `migration-scripts/faq-pages-into-sections.ts` (`db:migrate`'te mağaza başına bir kez; iş `workflows/storefront/faq-convert.ts` `convertFaqTexts`, saf kısım `lib/storefront/faq-convert.ts`): görünür, `questions: auto` olan ve soru olarak okunan (en az üç soru) her `article`, vitrinin kullandığı kuralla (`faqRowsOf`, vitrindeki `faqOf`'un aynısı, aynı HTML üzerinde) satırlara bölünür; `faq` `page` bölümü metnin yerine, metnin başlığı, görünüşü, ekranları ve zamanlamasıyla girer; **özgün metin hemen ardında gizli (`visible: false`) olarak kalır**, hiçbir şey silinmez. K3 gibi **taslak ve yayın** birlikte yazılır (yayında yeni sistem sürümü, denetim kaydı `storefront.faq_pages_converted`, log yalnız sayı). Görünür sonuç aynıdır: dönüşmüş satırlardan kurulan görünüm metinden okunanla birebir (vitrin testi; geliştirme mağazasının SSS'si üzerinde de denendi: 3 grup, 7 soru). Eşgüçlüdür: ikinci koşuda görünür soru metni kalmadığı için yazmaz. Aynı çıkmayacak metin (ilk sorudan önce ya da başlık altında soru öncesi yazı, cevapsız soru, cevapta görsel/tablo/alıntı/kart, sınırı aşan soru) ve 12 bölümü dolu sayfa olduğu gibi bırakılır ve `left` olarak sayılır; sahip onu panelden elle taşır.
9. **Panel.** SSS formu: satırlar (soru ya da grup başlığı) tutamaçtan sürüklenir, yukarı/aşağı taşınır, kopyalanır, silinir (en az bir satır kalır); "Soru ekle", "Başlık ekle". Cevap, alt bilgi yazı bloğundaki gibi pencerede içerik düzenleyiciyle yazılır (`bare`, `short`, mağaza bilgisi, karakter sayacı). Biçim seçimi içerik sayfasında "Başlık yanında" / "Sayfa SSS'si"; başka sayfalarda seçim yok.

### Dosyalar

types `section-faq.ts` (`FAQ_LIMITS`, `FAQ_PAGE_VARIANTS`, `StoreFaqItem`), `section-variants.ts`; backend `sections/faq.ts`, `faq-text.ts`, `faq-convert.ts`, `page-text.ts` (`isPageFaq`, ayna), `layout-hydrate-text.ts` (`hydrateFaq`), `content/footer-doc.ts` (`fitsBare`); vitrin `views/faq.ts` (`faqOfRows`), `views/page-text.ts`; ui `PageFaqView`; Atölye `sections/Faq.tsx`, `content/FaqBody.tsx`, `content/PageText.tsx`; panel `forms/faq-form.tsx`, `faq-row.tsx`, `faq-answer-field.tsx`, `faq-sketches.tsx`, `layout/faq-rows.ts`, `faq-problems.ts`.

### Açık

- Sayfa bağlantılarının yeniden yazılması (adr/0042 Ek 2026-11-05) SSS cevaplarındaki bağlantıları henüz kapsamaz (`link-layout.ts` yalnız `article`/`contact` gövdelerini okur); ürün adresi değişince cevaptaki bağlantı 301 ile yine çalışır. Ayrı küçük iş.
