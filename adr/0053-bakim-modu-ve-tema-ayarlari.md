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
- **Açık kalanlar:**
  - `/onizleme/*`
  - `/odeme/sonuc*`: sağlayıcı dönüşü. Öneri: `/odeme/durum` da açık kalsın, `/odeme/sonuc`'un yönlendirdiği yer orası; yoksa ödemesi geçen alıcı bakım sayfası görür.
  - `/{indexnow_key}.txt`, `/robots.txt`, `/sitemap*`
  - `/bakim/gir`
  - statik dosyalar (`/_next/static/*`, `favicon.ico`)
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
