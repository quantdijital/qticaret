# ADR-0053: Bakım modu ve tema ayarları

- **Durum:** Otonom kabul, gözden geçir (2026-11-03)
- **Tarih:** 2026-11-03
- **İlgili:** docs/20 ("Bakım / yakında modu", "Tema ayarları altyapısı"), F18 D11, adr/0011 (denetim kaydı), adr/0012 (ayar bölümleri), adr/0040 (roller), adr/0046 (vitrin ve tema sözleşmesi), adr/0048 (belirteçler), adr/0049 (vitrin yönetimi, `previewSigner`)

## Bağlam

- **Bakım modu (docs/20):** mağaza açılıştan önce ya da büyük bir değişiklik sırasında vitrini kapatabilmeli. Bu sırada:
  - Mağaza sahibi ve bağlantı gönderdiği kişiler (fotoğrafçı, deneyen) vitrini görmeye devam etmeli.
  - Ödeme sağlayıcılarının dönüşleri boşa düşmemeli.
  - Arama motorları sayfaları dizinden düşürmemeli.
- **Tema ayarları (F18 D11; adr/0046 §7, adr/0049 §6.4):** mağaza görünümünü (renk, yazı tipi, köşe, kart biçimi, üst bilgi, düğme) panelden seçer. Tasarım kısmı kullanıcıyla yapılacak; altyapı bizden.
- Bugün vitrinin tek rengi `storefront.primary_color`'da. Vitrin ve panel ajanları yeni bölüme sonra geçecek.

## Karar

### A. Bakım modu

1. **Ayar bölümü `maintenance`** (`sections/maintenance.ts`). Varsayılanı kapalı; kaydedilmemişken varsayılanlar geçerli.

   | Alan          | Tür                         | Kural                                                                                                                                                                  |
   | ------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `enabled`     | boolean                     | varsayılan `false`                                                                                                                                                     |
   | `title`       | metin ≤80 \| null           | null: vitrinin kendi başlığı                                                                                                                                           |
   | `message`     | metin ≤600 \| null          | `{belirteç}` alabilir (adr/0048); bilinmeyen belirteç `platform_settings.token_unknown`                                                                                |
   | `expected_at` | ISO 8601 (saat dilimli) \| null | `platform_settings.date_invalid`                                                                                                                                    |
   | `allow_paths` | mağaza yolu[] ≤20           | Tam yol (`/iletisim`) ya da altıyla birlikte (`/sozlesmeler/*`). Küçük harfe çevrilir, sondaki `/` atılır, tekrar silinir. `/*`, `//`, `\`, `?`, `#`, `..` reddedilir (`platform_settings.url_invalid`). |

2. **Yetki.**
   - Bölümü yazmak yalnız `owner`'ın (adr/0040 `OWNER_ONLY`, `security` gibi): mağazanın karardığı yer. Okumak her rolün.
   - Panel yeteneği: `can.maintenance` (`/admin/staff/me`).
   - Atlama bağlantısı `owner` ve `admin`'in (taslak önizleme bağlantısı gibi). `operations` ve `readonly` için kapalı.

3. **Vitrine sözleşme: `GET /store/seo/site`** yanıtına `maintenance` eklenir:

   ```json
   { "enabled": true, "title": "…", "message": "belirteçler doldurulmuş", "expected_at": "2026-11-10T09:00:00+03:00", "allow_paths": ["/iletisim", "/sozlesmeler/*"] }
   ```

   - Kapalıyken her zaman `{ enabled: false, title: null, message: null, expected_at: null, allow_paths: [] }` döner. Hazırlanan metin açılmadan görünmez.
   - Yalnızca belirteçlerden oluşan ve doldurulunca boş kalan satır `null` olur.

4. **Atlama bağlantısı.**
   - `POST /admin/maintenance/bypass` (gövde boş, katı şema; yalnız kişiler) → `{ url, path, expires_at }`.
     - `path` = `/bakim/gir?t=<jeton>`. `url` kanonik alan adı varsa tam adres, yoksa `path`.
     - Bakım kapalıyken `400 maintenance.not_enabled` döner: açmak bağlantıyı zaten bitirirdi.
   - Jeton: `previewSigner("maintenance-bypass:v1", "mnb_…", 7 × 24 saat)`, yani `mnb_<12 rastgele bayt>.<bitiş>.<HMAC>`.
     - Anahtar `PII_HASH_KEY` (`orderAccessKey`, önizlemelerle aynı); bağlam ayrı olduğu için önizleme jetonuyla karışmaz (testli).
     - Jeton bölümün **`version`**'ına bağlıdır. Bölümün her kaydı eski bağlantıları bitirir: kapatıp açmak iki kayıttır, metni düzenlemek de bir kayıttır.
     - Hiçbir şey saklanmaz.
   - `GET /store/maintenance/bypass/:token` → bağlantı geçerliyse (bakım açık, sürüm aynı, hafta dolmamış) `204`, değilse `404 maintenance.bypass_unknown`.
     - `Cache-Control: private, no-store`.
     - Biçimi tutmayan jeton veritabanına sorulmaz.
     - Hız sınırı: `maintenance_bypass`, ziyaretçi adresi başına dakikada 60.
   - `previewSigner` bunun için iki ek aldı: isteğe bağlı süre (`hours`) ve kayıt işaretinin zaman yerine sayı olabilmesi (sürüm). Mevcut önizlemelerin davranışı değişmedi.

5. **Denetim kaydı.**
   - Açıp kapatma bir ayar yazmasıdır; `platform_settings` kaynağıyla önce/sonra alan farkı kaydedilir.
   - Bağlantı oluşturma `auditMutations`'ın varsayılanıyla kaydedilir: eylem `POST /admin/maintenance/bypass`, tür `maintenance` (testli). Jeton kayda girmez.

6. **Önbellek.**
   - Ayar kaydı zaten `forgetResolutionsStep`'i çalıştırıyor.
   - Site yanıtının backend'de önbelleği yok, yalnızca `Cache-Control: public, max-age=300` var.
   - Vitrinin paylaşılan önbelleği 60 sn (adr/0046 Ek). Bakımı açmak ya da kapatmak vitrine en geç 60 sn'de yansır; bu kabul edildi.
   - F16: vitrin ile backend arasında bu yanıtı tutan bir HTTP önbelleği olmamalı. Olursa gecikme `max-age` kadar (5 dk) uzar.

7. **SEO.**
   - Google'ın geçici kapanış için önerdiği sinyal **503 + `Retry-After`**'dır. Google bunu "geçici" okur, taramayı yavaşlatır ve dizindeki sayfaları kısa süre korur.
   - Kaçınılanlar:
     - 200 dönen "yakında" sayfası: içerik o sayfayla değişir, ince ya da yumuşak 404 sayılır.
     - `noindex`: sayfaları dizinden çıkarır.
   - 503'ün **birkaç günden uzun** sürmesi sayfaların dizinden düşmesine yol açabilir. Panel uzun bakımda uyarmalı.
   - `robots.txt` her zaman 200 kalır: 5xx dönen robots.txt Google'da bütün sitenin taranmasını durdurur. Site haritaları da açık kalır.
   - Kaynaklar: [HTTP durum kodları ve Google](https://developers.google.com/search/docs/crawling-indexing/http-network-errors), [Planlı kesinti](https://developers.google.com/search/blog/2011/01/how-to-deal-with-planned-site-downtime), [İşi geçici durdurma](https://developers.google.com/search/docs/crawling-indexing/pause-online-business), [robots.txt 5xx](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt).

### B. Tema ayarları

1. **Ayar bölümü `theme`** (`sections/theme.ts`). Kaydedilmemişken varsayılanlar geçerli ve bugünkü görünüme eşit; hiçbir şey tohumlanmaz.

   > **Not (2026-11-14):** aşağıdaki varsayılan sütunu ve §B.2'nin zemin tablosu **adr/0062** ile değişti (Ek 2026-11-14). Tablo ilk kararın kaydı olarak duruyor.

   | Alan                       | Değerler                                                     | Varsayılan |
   | -------------------------- | ------------------------------------------------------------ | ---------- |
   | `theme`                    | `base` (kurulu temalar; yeni tema = yeni sürüm)              | `base`     |
   | `colors.primary`           | `#rrggbb` \| null                                            | null       |
   | `colors.accent`            | `#rrggbb` \| null                                            | null       |
   | `colors.background`        | `warm` \| `neutral` \| `cool`                                | `warm`     |
   | `typography.heading`       | `fraunces`, `inter`, `playfair`, `dm-serif`, `manrope`       | `fraunces` |
   | `typography.body`          | `inter`, `manrope`, `source-sans`, `nunito`                  | `inter`    |
   | `radius`                   | `sharp` \| `soft` \| `round`                                 | `soft`     |
   | `product_card.ratio`       | `4:5` \| `1:1` \| `3:4`                                      | `4:5`      |
   | `product_card.show_brand`  | boolean                                                      | `true`     |
   | `product_card.show_rating` | boolean                                                      | `false`    |
   | `header.layout`            | `centered` \| `left`                                         | `centered` |
   | `header.sticky`            | boolean                                                      | `true`     |
   | `buttons`                  | `pill` \| `rounded` \| `square`                              | `pill`     |

   - Renkler küçük harfe çevrilir.
   - Panel iç içe grupları kısmi gönderebilir; gönderilmeyen alanlar korunur.
   - Serbest CSS, yazı tipi adresi ve bilinmeyen alan reddedilir.

2. **Zemin renkleri** (`THEME_BACKGROUNDS`): `warm` `#f6f4ef` (bugünkü), `neutral` `#f5f5f5`, `cool` `#f3f5f8`.
   - Karşıtlık denetimi bu değerleri okur. Vitrin `--background`'ı **aynı** değerlerle basmalı; değişirse bu tablo da değişir.

3. **Karşıtlık denetimi** (`lib/color/contrast.ts`; WCAG 2.2 göreli parlaklık ve karşıtlık oranı, birim testli).
   - `colors.primary`, beyazla **ve** seçilen zeminle en az 3:1 tutmalı (AA büyük metin ve arayüz parçaları, §1.4.3 ve §1.4.11). Düğmede beyaz yazı, sayfada bağlantı ve çerçeve için.
   - Tutmazsa `400 platform_settings.color_contrast` döner, alan `colors.primary`.
   - Denetim zemine göre yapılır: aynı renk bir zeminde geçip diğerinde kalabilir (testli).
   - `accent` denetlenmez (süs). Vitrin, accent üstündeki yazının rengini parlaklığa göre siyah ya da beyaz seçmeli.

4. **Yazı tipleri yalnız addır.**
   - Vitrin her adı kendi barındırdığı yükleyiciye eşler (`next/font/local` ya da pakete gömülü dosya).
   - Hiçbir yazı tipi üçüncü taraf sunucudan yüklenmez: ziyaretçinin adresi oraya gitmesin (KVKK) ve CWV korunsun.

5. **Vitrine sözleşme: `GET /store/storefront`** yanıtına `theme: { … }` eklenir (bölümün bütün alanları, belirteç yok).
   - `colors.primary` = `theme.colors.primary ?? storefront.primary_color`. Eski alan dolu mağaza böylece göç betiği olmadan aynı rengi görür.
   - `storefront.primary_color` yanıtta ve bölümde şimdilik kalır.

6. **Yetki ve denetim.** Yazma `owner` ve `admin`'in (varsayılan), `operations` ve `readonly` için kapalı. Her kayıt `platform_settings` denetim kaynağıyla önce/sonra kaydedilir.

7. **Taslak yok.** Tema ayarı kaydedilince yayına girer (menüler gibi, adr/0049 §3) ve vitrine en geç 60 sn'de yansır.

### Vitrinin yapacakları (sonraki görev)

- **Bakım açıkken** her sayfa isteği şunu alır: `503`, `Retry-After`, `Cache-Control: no-store` ve sade bir sayfa (başlık, metin, beklenen zaman; tema çerçevesi ve menü yok).
  - `Retry-After`: `expected_at` ilerideyse kalan saniye, 300 ile 86400 arasına kırpılır. Yoksa ya da geçmişse 3600.
- **Açık kalanlar** (Ek 2026-11-15: yol bazlı açıklık yalnız `GET` ve `HEAD` içindir; başka yöntem yalnız `POST /odeme/sonuc` ve `POST /odeme/sonuc/hata`'da geçer, geri kalanı atlama çerezi ister):
  - `/onizleme/*`
  - `/odeme/sonuc`, `/odeme/sonuc/hata` (sağlayıcı dönüşü) ve `/odeme/durum` (`/odeme/sonuc`'un yönlendirdiği yer; yoksa ödemesi geçen alıcı bakım sayfası görür). Ek 2026-11-15: yalnız bu tam yollar; altları açık değil.
  - `/{indexnow_key}.txt`, `/robots.txt`, `/sitemap*`
  - `/bakim/gir`
  - statik dosyalar (`/_next/static/*`, `/_next/image`, vitrinin gerçekten var olan dosyaları: `app/icon.svg`, `public/fonts`, `public/marks`). Geliştirme sunucusunun soketi (`/_next/hmr`) upgrade ile gelir, kapıya hiç uğramaz.
  - `allow_paths`: tam eşleşme; `/x/*` ise `/x` ve altı. Karşılaştırma vitrinin normalize ettiği (küçük harf, sondaki `/` yok) yolla yapılır.
  - atlama çerezi taşıyan ziyaretçi.
- **`/bakim/gir?t=…`:**
  - Jeton biçimini denetler, sonra `GET /store/maintenance/bypass/:token`'a sorar.
  - `204` gelirse httpOnly çerezi yazar (`__Host-qt_bypass`, Secure, SameSite=Lax, yol `/`, 7 gün) ve 303 ile `/`'a gönderir; adres çubuğunda jeton kalmaz.
  - `404` gelirse bakım sayfası gösterilir.
  - Sayfada `Referrer-Policy: no-referrer` olur.
- **Çerezli istek:** bakım açıkken jeton aynı uçla doğrulanır; sonuç süreçte jeton başına 60 sn tutulur. `404` gelirse çerez silinir, bakım sayfası gösterilir.
  - Atlamayla görülen sayfalara `X-Robots-Tag: noindex` ve `Cache-Control: private, no-store` eklenir.
- **Tema:** `theme`'i `@qticaret/ui` görünüm modeline taşır ve CSS değişkenlerine çevirir (`--primary`, `--background`, `--radius`, yazı tipi değişkenleri, kart oranı, üst bilgi yerleşimi, düğme biçimi). `storefront.primary_color` okuması kalkar.

### Panelin yapacakları (sonraki görev)

- **Bakım modu ekranı** (Vitrin grubu ya da Ayarlar):
  - Aç/kapat yalnız `can.maintenance` ile.
  - Başlık, belirteç yardımlı metin, beklenen zaman, açık yollar listesi.
  - "Bağlantı oluştur" düğmesi (owner ve admin), adresi kopyalar. Yanında not: "Kaydetmek eski bağlantıları kapatır."
  - Bakım birkaç günü geçince SEO uyarısı gösterilir.
  - Bakım açıkken panelin üst çubuğunda kalıcı bir işaret durur.
- **Tema düzenleyicinin "Tema ayarları" sekmesi:** alanlar sabit listelerden seçilir; karşıtlık hatası alanın altında gösterilir.
  - Ana renk "Vitrin tercihleri"nden buraya taşınır ve `theme.colors.primary`'ye yazılır.
  - Bütün mağazalar taşınınca `storefront.primary_color` bölümden kaldırılır. `parseStored` bilinmeyen alanı sessizce atar.

## Alternatifler

| Seçenek                                                    | Artı                                         | Eksi                                                                    |
| ---------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| **503 + Retry-After, vitrin vekilinde (seçilen)**          | Google'ın önerdiği; dizin korunur            | Açık yol listesini vitrin tutar                                         |
| 200 dönen "yakında" sayfası                                | Basit                                        | Sayfa içeriği dizinde değişir; yumuşak 404                               |
| `noindex`                                                  | —                                            | Sayfalar dizinden düşer                                                 |
| Parolalı vitrin (Shopify'daki gibi)                        | Bildik                                       | Parola paylaşımı, ayrı oturum; ödeme dönüşleri yine istisna ister       |
| Saklanan atlama jetonları tablosu                          | Bağlantıları tek tek iptal                   | Tablo ve süpürme; sürüme bağlamak zaten hepsini birden bitiriyor        |
| Jetonu "açıldığı ana" bağlamak (sürüm yerine)              | Metin düzenlemek bağlantıyı bitirmez         | Bölümde gizli bir alan ya da ayrı durum gerekir; istek sürümdü          |
| **Tema: ayar bölümü (seçilen)**                            | Şema, denetim kaydı, önbellek hazır          | Taslak ve sürüm yok                                                     |
| Tema: düzen belgesine (`storefront-layout`) eklemek        | Taslak, yayın, geri alma                     | Belge büyür; yayın tema ayarıyla düzeni birbirine bağlar                |
| Serbest CSS değişkenleri ya da renk kodu her yerde         | Esnek                                        | CSS enjeksiyonu; karşıtlık denetlenemez                                 |
| Yazı tipi adresi (Google Fonts)                            | Çok seçenek                                  | Ziyaretçi adresi üçüncü tarafa (KVKK); CWV                              |

## Sonuçlar

- **Backend:**
  - `modules/platform-settings/sections/{maintenance,theme}.ts`
  - `lib/color/contrast.ts`
  - `lib/storefront/maintenance.ts` (jeton)
  - `workflows/storefront/maintenance.ts` (site yanıtı, sürüm okuma)
  - `api/admin/maintenance/bypass`, `api/store/maintenance/bypass/[token]`, `api/http/maintenance-routes.ts`
  - `lib/staff/permissions.ts` (`OWNER_ONLY`, `can.maintenance`)
  - hız profili `maintenance_bypass`
  - hata anahtarları `maintenance.not_enabled`, `maintenance.bypass_unknown`, `platform_settings.color_contrast`, `platform_settings.date_invalid`
- **Testler:**
  - Birim: karşıtlık, iki bölüm, atlama jetonu, roller.
  - HTTP: `maintenance.spec.ts`, `theme-settings.spec.ts`.
- **Bilinen sınırlar:**
  - Bakım bölümünün her kaydı atlama bağlantılarını bitirir; panel bunu söyler.
  - Açıp kapatma vitrine 60 sn'de yansır.
  - Yedek `storefront.primary_color` karşıtlık denetiminden geçmemiş olabilir; panel taşırken denetimden geçirir.
  - `accent` denetlenmez.
  - Kaydedilmemiş tema ayarını önizlemede göstermek gerekirse önizleme bağlantısına `theme` taslağı eklenir (sonraki adım).

## Ek (2026-11-14): tema ayarlarının varsayılanları ve zemin tablosu adr/0062 ile değişti

- **§B.1 varsayılanlar:** `colors.background` `steel`, `typography` `manrope` / `manrope`, `product_card.ratio` `1:1`, `header.layout` `left`; diğerleri aynı (`radius` `soft`, `buttons` `pill`, `show_brand` açık, `show_rating` kapalı, renkler `null`). Bunlar Atölye'nin bugünkü Grafit görünümüdür; `theme` alanı `atolye` (adr/0057 Ek 2026-11-09). Bölümde panelin göstermediği `settings_version` alanı var; onu taşımayan (adr/0062'den önce saklanan) satır okurken Grafit'e eşlenir, göç yok.
- **§B.2 zemin renkleri:** listeye `steel` `#f8fafc` eklendi (Atölye'nin `--color-paper`'ının sRGB karşılığı; testle token'a bağlı). `warm`, `neutral`, `cool` aynı değerlerle duruyor.
- **§B.3 karşıtlık:** kural aynı (beyazla ve seçilen zeminle 3:1); `steel` seçiliyken gerçek Grafit zeminine göre ölçülür. Kuyu yüzeyi (`paper-2`) koşulu adr/0062 karar 6 ile, ton kümeleri tanımlanınca eklenir.
- **§B.7 taslak:** tema ayarı adr/0063 karar 3 uygulanınca "Yayınla" ile yayına girecek (sahip, 2026-11-14); o işe kadar kayıt hemen yayındadır.

## Ek (2026-11-15): bakımda ve askıda yazma yalnız atlama çereziyle

- **Bağlam:** kapı yalnız vitrinin kenarında (`proxy.ts`) çalışır; backend store API bakımı bilmez. Kök düzen her sayfaya sepet ve çerez Server Action'larını taşır ve Next, `Next-Action` başlıklı bir POST'u eşleşen herhangi bir sayfa adresinde sayfa çizilmeden çalıştırır. Güvenlik incelemesi (PR #39) şu açıkları buldu:
  1. Eşleştiricinin dışarıda bıraktığı ama dosyası olmayan adlar (`/favicon.ico`, `/apple-icon.png`, `/manifest.webmanifest`, desene uyan olmayan yazı tipi ve işaret adları) kapıya uğramadan `[...path]` sayfasına düşüyor; oraya gönderilen action bakımda ve askıda çalışıyor, GET'te CSP'siz HTML dönüyordu.
  2. Yol bazlı açıklık (`/odeme/durum*`, `/odeme/sonuc/<alt yol>`, `allow_paths`) yöntem ayırmıyordu.
  3. Önizleme istisnası harfe duyarlıydı ve sondaki `/`'ı istiyordu (`POST /onizleme`, `POST /ONIZLEME/x` kaçıyordu).
  4. `/_next/webpack-hmr` üretimde de açık sayılıyordu.
- **Karar:**
  - Bakımda ve askıda yol bazlı açıklık yalnız `GET` ve `HEAD`'e tanınır. Başka yöntem yalnız tam yolu listelenen route handler'larda geçer: bugün `POST /odeme/sonuc` ve `POST /odeme/sonuc/hata` (ödeme sağlayıcısının dönüşü; route handler Server Action çalıştırmaz). Diğer her yazma (`/odeme/durum*`, `allow_paths`, alt yollar, önizleme, tanınmayan yöntem) atlama çerezi ister; askıda hiç geçmez. Önizlemeye özel istisna bu genel kurala katıldı.
  - `/bakim/gir` listede yok: route yalnız `GET` ve `HEAD` alıyor; açmanın bir faydası yok, kapalı kalması güvenli varsayılan.
  - Eşleştirici yalnız Next'in kendi çıktılarını (`/_next/static/`, `/_next/image`) dışarıda bırakır. Dosya adı biçimindeki her istek (`isFileName`) proxy'de backend'e sorulmadan cevaplanır: gerçekten var olan dosyaya (`isStaticFile`; spec `public/` ve `app/` ile birebir eşleştiğini sınar) `GET`/`HEAD` geçer, olmayan ada düz `404`, başka yönteme `405`. (Buradaki "kapının çalışmadığı hiçbir adres bir sayfaya düşmez" iddiası yanlıştı; aşağıdaki ikinci inceleme.)
  - ~~`/_next/webpack-hmr` yalnız geliştirmede açık sayılır.~~ İkinci incelemede kaldırıldı: Next 16'da bu yol yok; geliştirme soketi `/_next/hmr`, Next'in yönlendiricisi onu upgrade olarak proxy'den önce alır.
- **Ödünleşim:** `allow_paths` içindeki bir sayfanın formu (ör. iletişim) bakımda gönderilemez; ziyaretçi sayfayı görür, gönderince bakım sayfasını alır. Güvenli varsayılan budur. İhtiyaç çıkarsa ileride `allow_paths` için açık bir ayarla (varsayılan kapalı, yalnız seçilen yolda `POST`) gevşetilebilir.
- **Bedel:** yazı tipi ve işaret istekleri artık proxy'den geçer; proxy bunlarda backend'e gitmeden hemen döner.
- **İkinci güvenlik incelemesi (PR #43, Next 16.4.2 kaynağı okunarak):**
  - **Açık (YÜKSEK):** eşleştiricinin dışarıda bıraktığı `/_next/static/` altında dosyası olmayan bir ada gelen istek de sayfaya düşer: Next dosyayı bulamayınca dinamik rotaları dener (`resolve-routes.js`), `[...path]` eşleşir ve POST'taki Server Action çalışır (`Next-Action` başlığı ya da form içerik tipi, `server-action-request-meta.js`). Kapı yine atlanıyordu.
  - **Kapanış (üç kat):**
    1. Eşleştiriciye başlık koşullu iki giriş: `/_next/:path*` (yapı dosyaları ve `/_next/image` dahil) `next-action` ya da `content-type` başlığı varken proxy'ye uğrar. `has` değeri harfe duyarlı bir regex (`prepare-destination.js` `matchHas`), içerik tipinin harfi ise gönderenin; bu yüzden yalnız anahtar aranır. Tarayıcının parça (chunk) ve resim GET'i içerik tipi göndermez, ek maliyet yok. Spec eşleştiriciyi Next'in kendi mantığıyla (`unstable_doesMiddlewareMatch`) ve derlemenin `config`'i kaynaktan okuyabildiğini (`extractExportedConstValue`) sınar.
    2. Proxy'nin en başında, yol normalizasyonundan ve 301'den önce: `/_next/` altında `GET`/`HEAD` dışındaki her istek `405` (`Allow: GET, HEAD`); `/_next/static/` ve `/_next/image` altındaki GET/HEAD backend'e sorulmadan Next'e geçer.
    3. `[...path]` sayfası ve `generateMetadata`: ilk parça `_next` ise backend'e sormadan `notFound()` (yol rotanın kendi parçalarından okunur, proxy'nin `x-qt-url`'inden değil). Önceden `GET /_next/static/<olmayan>` her seferinde backend'e resolve gönderiyordu.
  - **DÜŞÜK, kapandı:** bakımda ve askıda açık GET'ler `/odeme/sonuc` ve `/odeme/durum` altını da açıyordu; artık yalnız `/odeme/sonuc`, `/odeme/sonuc/hata`, `/odeme/durum` (uygulamada `app/odeme/` altında başka rota yok; `/odeme/kart` ve `/odeme` kapalı).
  - **DÜŞÜK, kapandı:** `/marks/:file` ve `/icon.svg` kendi CSP'sini alır (`default-src 'none'; style-src 'unsafe-inline'; sandbox`): doğrudan açılan bir SVG betik çalıştıramaz, bir şey yükleyemez; `<img>` ile gösterim etkilenmez.
  - **Bilinen sınırlar (açık):**
    - (a) **ORTA, mimari; askıda kapandı, bakımda açık:**
      - **Askı (PR #56, adr/0061 §5.5):** backend de reddediyor. Store API'ye doğrudan gelen sepet ve ödeme yazmaları `503 plan.suspended` ve `Retry-After` alır (`api/http/plan-guard.ts`):
        - `/store/carts*` altındaki her yazma: yeni sepet, satır, adres, kargo, kod. `POST /store/carts/:id/payment-session` ve `/complete` de buna dahil.
        - ödeme bağlantısının sepeti (`POST /store/payment-links/:token/cart`)
        - sepet hatırlatıcısının kullanımı (`POST /store/cart-reminders/redeem`)
        - Açık kalanlar: okumalar, POST ile yapılan sipariş erişim okuması, satış dışı yazmalar (hesap, onaylar, soru, yorum, verilmiş sipariş) ve sağlayıcı dönüşleri. Her Store API yazmasının kararı `lib/plan-guard/__tests__/store-writes.unit.spec.ts`'te yazılı.
      - **Bakım (Ek 2026-11-17 ile kapandı):** backend bakımı hâlâ bilmiyor. Store API'de bakım modu için bir koruma yok; bakımla ilgili backend kodu yalnız atlatma bağlantısının iki route'u. Store API'yi doğrudan çağıran biri (yayınlanabilir anahtar vitrinde açık) bakımda da sepet kurup ödeme başlatabilir. Bakım tasarım gereği geçici ve mağazanın kendi kararı; sipariş açığı kapatılmak istenirse askıdaki korumanın bakım için bir benzeri ayrı iş olarak eklenir.
    - (b) Bakımda panel önizlemesindeki Server Action'lar (sepet, çerez tercihi) atlama çerezi olmadan `503` alır; önizleme GET'i açıktır. Bilinçli.
    - (c) `fonts` ve `marks` kökleri backend'in ayrılmış kök listesinde değil: aynı adla bir slug ya da yönlendirme kurulabilir; vitrin bu yolları dosya olarak cevapladığı için o kayıt görünmez. Backend listesine eklenmesi ayrı iş.
    - (d) Bakımda ACME HTTP-01 doğrulaması (`/.well-known/acme-challenge/*`) vitrine gelirse `503` alır; sertifika kenarda (ters vekil) alınmalı ya da DNS-01 kullanılmalı.
    - (e) `/_next/image/<alt yol>` dosya denetiminde `nextImage` sayılmaz (yalnız tam `/_next/image`), dinamik rotaya düşer; orada Next'in resim işleyicisi `startsWith('/_next/image')` ile yakalayıp (`images.unoptimized` iken) 404 çizer. Bu davranışa güvenilmedi: action taşıyabilecek istek zaten 1. ve 2. maddeyle proxy'de 405 alır.
  - **Çalışan sunucuda doğrulandı (2026-11-15):** üretim derlemesinde (`next build`, `next start -p 8100`, Next 16.4.2) ve geliştirme sunucusunda (8000) bakım açıkken atlatma çerezi olmadan denendi; sonuçlar ikisinde de aynı çıktı:
    - `/_next/static/<olmayan>` ve `/_next/image/x`: `Next-Action` ya da `multipart` içerik tipiyle gelen POST `405` alıyor.
    - `/favicon.ico`: POST `405`, GET düz `404`.
    - `POST /odeme/durum` ve `/odeme/sonuc/x`, `GET /odeme/durum/x`, önizleme yazmaları (`/onizleme/x`, `/onizleme`, `/ONIZLEME/x`), `POST /` ve küçük harfli `post /`: hepsi `503`.
    - `POST /odeme/sonuc`: route handler `303` dönüyor, action çalışmıyor.
    - `/marks/*` ve `/icon.svg`: `200`, kendi CSP'leriyle.
    - Kanıt: bu istekler sırasında backend'de yeni sepet oluşmadı. Atlatma çereziyle aynı action sepet kurdu.
    - Denemenin geçerliliği: bakım kapalıyken aynı çerezsiz `POST /` action'ı sepet kurdu (karşı deneme).

## Ek (2026-11-16): bakım modu Ayarlar'da

Sahip: "bu vitrin tercihleri tema düzenleyici de tema ayarları içinde olabilir sidebarda gereksiz gördüm." Vitrin tercihleri kenar çubuğundan kalkıp tema düzenleyicinin paneli olunca bakım modu oraya alınmadı: düzenleyicide her şey "Yayınla"ya kadar taslaktır, bakım anahtarı ise kaydedildiği an vitrini kapatır; taslak sanılması yanıltır. Bakım modu Ayarlar > Mağaza grubunda kendi sayfasıdır (`/settings/maintenance`): anahtar ve bakım sayfası metinleri yalnız sahibin (`OWNER_ONLY`), atlatma bağlantısı sahip ve yöneticinin; sayfayı her rol görür (anahtar salt okunur), Vitrin tercihlerindeki sekmede olduğu gibi. Paneldeki bakım şeridinin bağlantısı ve eski `?part=maintenance` adresleri buraya gelir. Veri, uç ve kaydetme anlamı değişmedi.

## Ek (2026-11-17): bakımda Store API yazmaları backend'de de kapalı

- **Bağlam:** Ek 2026-11-15'in bilinen sınırı (a): kapı yalnız vitrinin kenarındaydı; yayınlanabilir anahtar açık olduğu için Store API'yi doğrudan çağıran biri bakımda da sepet kurup ödeme başlatabiliyor, sipariş verebiliyordu.
- **Karar:** `refuseWritesInMaintenance` (`api/http/maintenance-guard.ts`, karar tablosu `lib/storefront/maintenance-guard.ts`).
  - `/store/*` zincirinde (hız sınırının hemen ardından) ve `/auth/*` jokerinde çalışır. Bakım açıkken **her Store API yazması** (`GET`/`HEAD`/`OPTIONS` dışı) `503`, `{ type: "unavailable", message: "maintenance.shop_closed" }`, `Retry-After` (vitrinle aynı kural: `expected_at` ilerideyse kalan saniye 300–86400 arası, yoksa 3600) ve `Cache-Control: no-store` alır. `POST /auth/customer/:provider/register` (yeni müşteri hesabı) de kapalıdır.
  - Varsayılan kapalı: yeni bir yazma route'u adıyla açılana kadar kapalıdır; kendi route'larımızın her birinin kararı `lib/storefront/__tests__/maintenance-guard.unit.spec.ts`'te yazılı, yeni route o test kararı yazılana kadar düşer.
  - **Açık kalan yazmalar** (tam yol): POST ile okumalar (`/store/carts/:id/order-access`: bakımdan hemen önce kartla ödeyen alıcının sonuç sayfası; `/store/order-lookup`, `/store/gift-cards/balance`, `/store/shipping-options/:id/calculate`), verilmiş sipariş (`/store/orders/:id/cancel`, `/store/orders/:id/returns` yalnız iade olarak: cayma hakkı bakım beklemez; `kind: "exchange"` yeni bir varyant seçip fiyatladığı için kapalıdır), rıza ve KVKK (`/store/customers/me/consents`, `/store/customers/me/privacy-requests`, `/store/consents/{cookies,unsubscribe,confirm}`, `/store/stock-alerts/confirm`), vitrinin 404 kaydı (`/store/seo/not-found`).
  - **Hiç dokunulmayanlar:** okumalar (katalog, `/store/seo/site`: bakım sayfasının kendisi ve tarayıcılar), sağlayıcı dönüşleri (`/hooks/*`: PayTR bildirimi, iyzico dönüşü; bakımdan önce başlamış ödeme siparişe döner ya da iade edilir), panel (`/admin/*`), personel girişi (`/auth/user/*`), müşteri girişi, parola sıfırlama, e-posta bağlantıları (`/unsubscribe`, `/consents/confirm`, `/stock-alerts/confirm`), `/health`, besleme.
  - **Atlama bağlantısı:** vitrin, atlama çerezi taşıyan ziyaretçinin Store API çağrılarına jetonu `x-maintenance-bypass` başlığında ekler (`lib/store-api/server.ts`, yalnız jeton biçimindeyse). Backend onu `GET /store/maintenance/bypass/:token` gibi doğrular: imza (`PII_HASH_KEY`, kendi bağlamı), hafta, bölümün kayıtlı sürümü. Sürüm, önbellekteki bölüm nesnesi başına bir kez veritabanından okunur: ayar önbelleği her kayıtta (ve en geç 30 sn'de) yeni nesne verir, böylece kayıt eski bağlantıları önbellekle aynı anda bitirir ve biçimi tutan uydurma jetonlarla gelen istekler veritabanını yormaz. İmzasız ya da eski bağlantı hiçbir şey açmaz; istemcinin uydurabileceği bir "atla" başlığı yoktur. Jeton günlüğe girmez: `mnb_` jetonu yolda maskelenir, başlık adı gizli anahtar sayılır (`@qticaret/server-kit` redaksiyonu). Böylece Ek 2026-11-15'te doğrulanan "atlatma çereziyle sepet kurulur" davranışı korunur. Panel önizlemesindeki yazmalar Ek (b)'deki gibi kapalı kalır.
  - **Ayar okuma:** platform ayarlarının sürümlü önbelleğinden (`getSection("maintenance")`; her kayıtta geçersiz olur, diğer süreçler en geç ~1 sn'de görür). Okumalar ve açık yazmalar ayara hiç bakmaz.
  - **Ayar okunamazsa** süreçte en son okunan değer geçerlidir (yük altında kısa bir havuz zaman aşımı kapıyı açmasın). Hiç okunmamışsa **engellemez (fail-open)**. İki durumda da dakikada en çok bir kez `maintenance.guard_unreadable` uyarısı yazılır. Hiç okunmamışken engellememek askı korumasının tersi (`plan-guard.ts` okunamayan durumda hatayla kapanır): askı platformun yaptırımıdır, bakım ise mağazanın kendi geçici kararı ve ilk kapısı vitrinin kenarı; ayar okunamıyorsa yazmanın kendisi de aynı veritabanına muhtaç.
- **Sonuç:** Ek 2026-11-15'in bilinen sınırı (a) bakım için de kapandı. Bakımı açıp kapatmak backend'e hemen, vitrine en geç 60 sn'de yansır; bu arada vitrinden gelen yazma `503 maintenance.shop_closed` alabilir.
