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
  - İletişim sayfasında sabit satırın adı "İletişim bilgileri ve form"dur (rol `contact_form_path`'ten okunur).
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
3. **İletişim rolünün yolla seçilmesi** (önceden var olan durum). `contact_form_path` bir yoldur: iletişim sayfasının adresi değişirse form, ayarlar güncellenene kadar görünmez (`screens/content.tsx` `contactOfPage`). Öneri: ayrı küçük işte rolleri (iletişim, ödeme, kargo) sayfa kimliğiyle tutmak. Bu ADR'yi beklemez.
4. **`AboutPage` / `ContactPage` JSON-LD.** Öneri: hayır (zengin sonuç yok); istenirse içerik sayfasına "sayfa türü" seçimi olarak ayrı iş.
5. **Hakkımızda metni.** §4'teki metinler mylarte.com'un anlatımından yeniden yazıldı (birebir alıntı değil). Sahip görüp düzeltir; vaat şeridi ve kapak mağazanın verisidir.
