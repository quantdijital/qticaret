# Çok dil, çok para birimi ve SEO: araştırma (F19)

> Tarih: 2026-11-28. Hazırlayan: Oğuzhan (araştırma ajanları + bağımsız doğrulama). Plan: `docs/24-coklu-dil-ve-para-birimi-plani.md`.
> Bu belge kararların dayanağıdır; karar vermez. Hukuki görüş değildir: avukat ve mali müşavir soruları `docs/mali-musavir-sorulari.md` §8–§9.
> **Güven düzeyleri:** **kesin** = birincil kaynak okundu, alıntı var · **büyük olasılıkla** = birincil kaynak var ama yorum gerekiyor ya da metin eski · **ikincil** = birincil bulunamadı, aktaran kaynak · **resmî değil** = arama motoru çalışanının kişisel açıklaması · **gözlem** = 2026-11-28 canlı istek (Türkiye çıkışlı, kişisel veri gönderilmeden) · **doğrulanmadı** = kaynak bulunamadı.
> Bağımsız doğrulamayla çelişen yerde doğrulama kazanır (§10).

## 1. Kısa sonuç

- Türkçe öneksiz kalır, İngilizce `/en` alt klasörüne gelir; dil ve para birimi URL'ye bağlanır; hiçbir istek dil ya da konuma göre yönlendirilmez. Google, Merchant Center, Shopify ve deneyimiz aynı yönü gösteriyor.
- Geçmiş vakanın ("İngilizce aramalarda çıkıyor, Türkçede çıkmıyor") en olası nedeni çok dilliliğin kendisi değil, **uygulama hatası**: Accept-Language'e dayanan dil seçimi, Googlebot'u (başlıksız, ABD) hep varsayılan dile düşürür. Deneyle ölçüldü (§6).
- Medusa 2.22.6'da çeviri modülü kurulu, bayrakla açılıyor; 2.22.7'de varsayılan açık.
- Türkiye'deki tüketiciye fiyat TL ve tüm vergiler dahil; yurt içi tur Türkiye'de yerleşik T.C. vatandaşına dövizle satılamaz; Stripe Türkiye'de yok.

## 2. Uluslararası SEO (Google)

| Bulgu | Kaynak | Güven |
|---|---|---|
| Dil sürümleri ayrı URL'de; dile/IP'ye göre otomatik yönlendirme yapılmaz ("Avoid automatically redirecting users…", "Don't use IP analysis to adapt your content") | https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites | kesin |
| Google dili görünür içerikten belirler, `lang` gibi kod düzeyi bilgiyi kullanmaz; URL parametresi önerilmez, alt klasör kolay | aynı sayfa | kesin |
| Googlebot'un varsayılan IP'leri ABD'de görünür ve Accept-Language göndermeden tarar; ayrı URL + hreflang önerilir | https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages | kesin |
| Googlebot IP konumu genelde Mountain View ama "the actual egress points vary" (Illyes, 2026) | https://bsky.app/profile/methode.bsky.social/post/3mszo3bacnk2h | ikincil (SER) |
| hreflang üç yolla: HTML, HTTP başlığı, site haritası; karşılıklı ve kendine referanslı olmalı, yoksa yok sayılır; yalnız dil kodu verilebilir, yalnız ülke kodu verilemez; `x-default` | https://developers.google.com/search/docs/specialty/international/localized-versions | kesin |
| Çevrilmemiş ana içerik kopya sayılır ("only considered duplicates if the main content… remains untranslated"); bazı sayfalarda bazı diller atlanabilir | aynı sayfa | kesin |
| hreflang `link` etiketleri tek etikette birleştirilmez (2024-06-12) | https://developers.google.com/search/updates | kesin |
| Canonical aynı dilde olmalı; hreflang kanonikleştirmede kullanılmaz; kendine referanslı canonical önerilir | https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls | kesin |
| x-default: dil seçici sayfa, eşleşmeyenlerin yönlendirildiği sayfa ya da "varsayılan" sürüm olabilir | https://developers.google.com/search/blog/2023/05/x-default | kesin |
| Ürün birden çok para biriminde satılıyorsa her para birimine ayrı URL | https://developers.google.com/search/docs/appearance/structured-data/merchant-listing | kesin |
| Sayfalı listede ilk sayfa canonical yapılmaz; her sayfa kendi canonical'ı | https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading | kesin |
| Site haritası: dosya başına 50.000 URL / 50 MB; hreflang alt öğeleri URL sınırına değil boyuta girer | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; localized-versions | kesin |
| Search Console "Uluslararası Hedefleme" raporu 2022'de kaldırıldı | https://support.google.com/webmasters/answer/12474899 | kesin |
| "Çevrilmiş sonuçlar" Türkçeyi kapsıyor (2024-07-10); kapatma `notranslate` | https://developers.google.com/search/docs/appearance/translated-results | kesin |
| hreflang indekslemeyi garanti etmez; aynı dildeki sürümlerden biri canonical seçilebilir (Mueller 2025) | https://bsky.app/profile/johnmu.com/post/3loq2xdlfmc2z | resmî değil |
| hreflang alternatifleri "not in fact indexed in the proper sense" (Illyes 2026); Search Console'da "indekslenmedi" görünmesi beklenebilir | https://seroundtable.com/google-hreflang-urls-not-indexed-41838.html | ikincil |
| Yanlış sayfalar arası hreflang "hiç olmamasından kötü" olabilir (Mueller 2018) | https://www.reddit.com/r/SEO/comments/8f10yv/whats_worse_bad_hreflang_implementation_or_none/dy01o2j/ | resmî değil |
| hreflang sıralamayı değiştirmez, hangi URL'nin gösterileceğini seçer (Mueller 2022) | https://iloveseo.com/seo/google-says-again-hreflang-wont-change-ranking/ | ikincil |

**Makine çevirisi:** Eski kılavuz insan incelemesiz otomatik çeviriyi otomatik içerik örneği sayıyordu (ikincil, SEJ). 2024-03'te "scaled content abuse" politikası geldi; güncel metinde "translating" yalnız **kazınmış** içerik örneğinde geçiyor (https://developers.google.com/search/docs/essentials/spam-policies). **2025-06-11**'de "otomatik çevrilmiş sayfaları robots.txt ile engelleyin" bölümü kaldırıldı (kesin, https://developers.google.com/search/updates). Üretken yapay zekâ rehberi başlık, meta ve yapısal veride de inceleme istiyor (https://developers.google.com/search/docs/fundamentals/using-gen-ai-content). Sonuç: kendi içeriğini yapay zekâyla çevirmek tek başına spam değil; ölçüt kalite ve insan incelemesi.

**Tek dilliye sonradan `/en` eklemek:** Türkçe URL'ler değişmiyorsa site taşıması değildir (çıkarım). Önce/sonra ölçülmüş birincil vaka çalışması bulunamadı (doğrulanmadı). Gerçek riskler: köke yönlendirme eklemek, yarı çevrili `/en`, canonical'ın yanlış dile gitmesi, yanlış hreflang, Türkçe sayfanın `lang` ya da başlığının değişmesi, aynı URL'de çerezle para birimi. Önlem: Türkçe HTML'in önce/sonra karşılaştırması (docs/24 K23).

## 3. Diğer arama motorları

| Motor | Türkiye payı (StatCounter, Ekim 2026) | Bulgu | Kaynak | Güven |
|---|---|---|---|---|
| Google | %76,85 | §2 | https://gs.statcounter.com/search-engine-market-share/all/turkey | kesin |
| Yandex | **%21,63** | hreflang'i `<head>` `<link>` ile okur; **"Yandex no longer supports using the Sitemap file for language versions."**; dil IP/Accept-Language ile seçiliyorsa x-default ister; Webmaster'da tek "site bölgesi" | https://yandex.com/support/webmaster/en/yandex-indexing/locale-pages ; https://yandex.com/support/webmaster/en/site-geography/site-region | kesin (bölge sayfası arama özetinden) |
| Bing | %0,81 | Güncel Webmaster Guidelines'ta hreflang, `content-language`, `lang` geçmiyor. Tek dayanak Fabrice Canel'in Eylül 2020 tweet'i: "hreflang is indeed a far weaker signal than content-language at Bing". Bing'in resmî tutumu değildir | https://www.bing.com/webmasters/help/webmasters-guidelines-30fba23a ; https://www.seroundtable.com/bing-hreflang-weak-signal-30099.html | kısmen; resmî değil |
| DuckDuckGo | %0,27 | sonuçlar "largely" Bing'den | https://duckduckgo.com/duckduckgo-help-pages/results/sources | kesin |
| Apple | — | Applebot belgesinde dil/hreflang yok; yaklaşık konum bir etken | https://support.apple.com/en-us/119829 | kesin |
| Yapay zekâ araması | — | Google AI özellikleri ve OpenAI botu belgelerinde dil yok; ChatGPT ve Perplexity sık sık ABD İngilizce URL'sini gösterdi (Glenn Gabe deneyi, Aralık 2025) | https://developers.google.com/search/docs/appearance/ai-features ; https://www.gsqi.com/marketing-blog/ai-search-hreflang-multilingual-queries/ | kesin / resmî değil |

Sonuç: hreflang `<head>`'de (Google + Yandex), site haritası Google için ek; `content-language` ucuz bir Bing sinyali; her dil sayfası kendi başına tam olmalı (yapay zekâ motorları hreflang'e güvenilir biçimde uymuyor).

## 4. Google Merchant Center

| Bulgu | Kaynak | Güven |
|---|---|---|
| Konuma göre dil ya da para birimini dinamik değiştirmek "against Google Shopping requirements" (politika değil, Shopping gereksinimi) | https://support.google.com/merchants/answer/15404838 | kesin |
| Açılış sayfası: ürün verisinin dili ve para birimi; içerik cihaz, kullanıcı aracısı (botlar dahil), konum ve çerezden bağımsız; hedef ülkede aynı fiyat | https://support.google.com/merchants/answer/4752265 | kesin |
| HTML'deki fiyat ve JSON-LD `price`/`priceCurrency` yüklenen fiyatla aynı; "Googlebot crawls the data present in the HTML…" | https://support.google.com/merchants/answer/12159029 | kesin |
| Bir veri kaynağı birden çok ülkeyi hedefleyebilir; farklı dil için çevrilmiş ayrı veri kaynağı; para birimi dönüştürme otomatik (Google Finance kuruyla tahmini) | https://support.google.com/merchants/answer/14991840 ; https://support.google.com/merchants/answer/7055540 | kesin |
| `link_template` yalnız yerel vitrin içindir, tek parametresi `{store_code}`; `{country}`/`{language}` yok | https://support.google.com/merchants/answer/13871172 | kesin |
| ABD ve Kanada dışında fiyat KDV dahil (Türkiye dahil); Türkiye hedef ülke, para TRY | https://support.google.com/merchants/answer/7052209 ; https://support.google.com/merchants/answer/160637 | kesin |
| **Content API for Shopping 18 Ağustos 2026'da kapandı**; 1 Eylül 2026'dan beri kademeli bozulma; Merchant API'ye geçilmeli | https://developers.google.com/shopping-content/guides/sunset | kesin |
| Bizim kod zaten Merchant API kullanıyor (`merchantapi.googleapis.com`); veri kaynağı `tr/TR/["TR"]` sabit | `apps/backend/src/lib/google/client.ts:147` | kesin (kod) |

Not: tur 1'deki 6324371 ve 7055540 sayfaları "dinamik değiştirme" cümlesini taşımıyor; doğru kaynak 15404838.

## 5. Next.js ve next-intl

| Bulgu | Kaynak | Güven |
|---|---|---|
| Next.js resmî i18n rehberinin örnek proxy'si Accept-Language ile yönlendiriyor; `getLocale` gövdesi boş bırakılmış | https://nextjs.org/docs/app/guides/internationalization | kesin |
| next-intl `localePrefix` varsayılanı `always`; `localeDetection` varsayılan açık (çerez, sonra Accept-Language); `alternateLinks` açık, hreflang'i HTTP `Link` başlığıyla verir; `never` kipinde kapalı | https://next-intl.dev/docs/routing/configuration | kesin |
| next-intl 4.16.2 kaynağı: başlıksız istekte `defaultLocale`'e düşer; `Link` host'u `x-forwarded-host`'tan alır; hiçbir yerde `Vary` yazmaz | deney (§6), `dist/esm/development/middleware/` | kesin (ölçüm) |
| Bizim vitrin: dil/ülke algılama yok, `Accept-Language`, coğrafi IP ya da dil çerezi okunmuyor; next-intl kullanılmıyor | `apps/storefront/src/proxy.ts` | kesin (kod) |

## 6. Geçmiş vaka: çok dilli Next.js sitesinde Türkçe sayfaların çıkmaması

### 6.1 Deney

Gerçek `next build && next start` sunucuları, curl, kullanıcı aracısı Googlebot, aksi yazılmadıkça Accept-Language yok, çerez taşınmaz. Sürümler: next 16.4.6, next-intl 4.16.2, React 19.3.1. Her sayfa `generateMetadata` ile doğru canonical/hreflang yazıyor ("düzgün yazılmış site" varsayımı). Ham çıktılar ajan çalışma klasöründeydi, repoya alınmadı.

| Senaryo | Ayar |
|---|---|
| S1 | next-intl varsayılanları: `defaultLocale: 'en'`, önek `always`, algılama açık |
| S2 | `defaultLocale: 'en'`, `as-needed`, algılama açık |
| S3 | `defaultLocale: 'tr'`, `as-needed`, **algılama kapalı** (önerimizin eşi) |
| S4 | `defaultLocale: 'en'`, `localePrefix: 'never'` (dil çerezle/başlıkla) |
| S5 | Next.js rehberinin proxy'si, Accept-Language Negotiator'a tek başına |
| S5b | Aynı proxy, tüm başlıklar Negotiator'a (yaygın doldurma biçimi) |

| İstek | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| `/` bot, AL yok | 307 → `/en` | 200 en | **200 tr** | 200 en | 307 → `/en` |
| `/` AL=tr | 307 → `/tr` | 307 → `/tr` | 200 tr | 200 **tr** (aynı URL) | 307 → `/tr` |
| `/tr` | 200 tr | 200 tr | 307 → `/` (tr) | 307 → `/`, son **en** | 200 tr |
| `/en` | 200 en | 307 → `/` (en) | 200 en | 307 → `/`, son en | 200 en |
| `/urunler` | 307 → `/en/urunler` | 200 en | 200 tr | 200 en | 307 → `/en/urunler` |
| `/` + çerez en | 307 → `/en` | 200 en | 200 **tr** (çerez yok sayılır) | 200 en | 307 → `/en` |
| S5b `/` bot | | | | | **500** (`RangeError` `Intl.getCanonicalLocales`) |

Bot açısından sonuç:

| Senaryo | Bot kökte ne görür | Türkçe dizinlenebilir mi |
|---|---|---|
| S1, S2, S5 | İngilizce | Yalnız `/tr/...` bağlantı, hreflang ya da site haritasıyla keşfedilirse |
| S3 | Türkçe; İngilizce `/en/...` ayrı | Evet, iki dil kararlı URL'de |
| **S4** | İngilizce | **Hayır**: `/tr` köke yönlendiriyor, çerez taşınmadığı için yine İngilizce; bütün hreflang'ler aynı URL'yi gösteriyor |
| S5b | 500 | Hiçbir öneksiz sayfa |

Ek ölçümler:
- **`x-forwarded-host`:** `x-forwarded-host: evil.example` gönderilince next-intl `Link` başlığı hreflang'i yabancı alana yazdı. Vekil başlığı iletmezse başlıktaki hreflang iç adresi, HTML'deki canlı alanı gösterir: iki çelişkili küme. Önbellek bu başlığı anahtara katmıyorsa önbellek zehirlenmesi.
- **Önbellek:** S2 ve S4'te `/` aynı URL'de Accept-Language'e göre farklı yanıt verirken `Cache-Control: s-maxage=31536000` ve `Vary`'de Accept-Language/Cookie yok. URL'yle anahtarlayan CDN ilk gelen dili bir yıl herkese sunar; ABD düğümünden bota hep İngilizce.
- **Negotiator:** başlık yokken `languages()` `["*"]` döner, `match` hata fırlatır (S5b'nin nedeni); next-intl bu hatayı yutup `defaultLocale`'e düşer.

### 6.2 En olası nedenler (güçlüden zayıfa)

1. **Dil aynı URL'de çerez/başlıkla seçiliyordu (S4 deseni).** Türkçenin dizinlenebilir URL'si yok. Vakayı tek başına açıklar. (deney: kesin; eski site için doğrulanmadı)
2. **Varsayılan dil İngilizce + Accept-Language algılaması (S1, S2, S5) ve Türkçeye giden yolun zayıflığı:** dil seçici JS/çerezle çalışıyor (`<a href="/tr/...">` yok), site haritasında yalnız İngilizce, `/tr` canonical'ı İngilizceyi ya da kökü gösteriyor, ya da hreflang tek yönlü.
3. **Önbellek:** öneksiz URL'ler dile göre değişiyor ve CDN yalnız URL'yle önbelleğe alıyordu; 1 ve 2'yi güçlendirir.
4. **Açıklamayan:** S5b'deki 500 "hiç çıkmamak" doğurur, "yalnız İngilizce" değil.

Hüküm: çok dilliliğin doğal sonucu değil; dilin URL dışında seçilmesinden doğan uygulama hatası. Eski site bu başlıklarla ölçülmeden kesin hüküm verilemez.

### 6.3 Sahip eski siteyi nasıl kontrol eder

`ESKI` yerine alan adı yazılır:

```
UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
curl -sI -A "$UA" https://ESKI/
curl -sI -A "$UA" -H "Accept-Language: tr-TR,tr;q=0.9" https://ESKI/
curl -sI -A "$UA" https://ESKI/tr
curl -sI -A "$UA" https://ESKI/tr/bir-urun
curl -sI -A "$UA" -b "NEXT_LOCALE=en" https://ESKI/tr
curl -s  -A "$UA" https://ESKI/tr | grep -oE '<html lang="[^"]*"|<link rel="canonical"[^>]*>|hreflang="[^"]*" href="[^"]*"'
```

Okuma: ilk iki komut farklıysa (biri 307, öteki 200 ya da farklı `location`) dil algılaması var. `/tr` 307 ile köke gidip İngilizce bitiyorsa S4. `Vary`'de Accept-Language yokken `s-maxage` varsa önbellek riski. `/tr`'nin canonical'ı kendisi mi, `hreflang="tr"` var mı?

**Search Console:**
1. URL Denetimi'ne `https://ESKI/tr/...` yazılır → "Taranan sayfayı göster" → **HTML** sekmesinde `<html lang>` ve görünen metnin dili; **Diğer bilgiler**'de HTTP başlıkları.
2. "Sayfa dizine ekleme"de "Kullanıcı tarafından belirtilen standart" ile "**Google'ın seçtiği standart**" karşılaştırılır; Google `/tr` için `/en` ya da kökü seçtiyse Türkçe sayfa kopya sayılmıştır.
3. "Canlı URL'yi test et" ile bugünkü davranış.
4. "Sayfalar" raporunda "Kopya, Google kullanıcıdan farklı bir standart seçti" ve "Yönlendirmeli sayfa" listelerinde `/tr` URL'leri aranır.

**Ayrıca:** `site:ESKI/tr` araması (google.com.tr, `hl=tr`); hreflang denetim araçları (Merkle hreflang test aracı, Screaming Frog "Hreflang" sekmesi: kullanıcı aracısı Googlebot, Accept-Language boş).

## 7. Platform karşılaştırması

| Platform | URL yapısı | Para birimi URL'ye bağlı mı | Otomatik yönlendirme | hreflang | Eksik çeviri |
|---|---|---|---|---|---|
| Shopify Markets | pazar başına alt klasör/alt alan/alan adı; birincil `/en`, ikincil `/en-gb` | **evet** (seçici `POST /localization` → pazar URL'si, gözlem) | isteğe bağlı; **botlar hariç** | otomatik, `<head>`; x-default = yedek pazar; belge site haritası diyor, canlıda `xhtml:link` 0 (gözlem) | varsayılan dile düşer (örnek alınmaz); yayımlanmamış dil 404 |
| BigCommerce Catalyst | alt klasör, varsayılan öneksiz | hayır (IP + seçici) | dil klasörüne yönlendirir; bot istisnası belgesiz | `<head>`, tüm diller koşulsuz | dil dosyası yoksa 404 |
| Shopware 6 | satış kanalı alanı = URL + dil + para | başlangıç parası; değişim oturumda | çekirdekte yok | yalnız SEO URL'si olan dil; ≥2 şartı; "yalnız dil kodu" seçeneği | üst dile düşer |
| WooCommerce + WPML | dizin/alan/`?lang=` | hayır (çerez); resmî önbellek uyarısı | isteğe bağlı JS, bot istisnası yok | `<head>`; x-default = varsayılan dil | varsayılan: gizle |
| Magento | store view; store code URL'de | hayır (oturum) | çekirdekte yok | çekirdekte yok (kod araması) | üst kapsam değeri |
| ikas | rota `/en/`, `/eur/` | **evet** (gözlem) | sunucu tarafı yok (gözlem) | ülke başına 170 satır; `tr-KK` gibi geçersiz kodlar (gözlem) | Türkçe kalıyor (gözlem) |
| Ticimax | `/en`, `/ru`; çevrilmiş slug | hayır (IP + çerez; `/en` TL gösteriyor) | IP (belge) | `tr-TR`/`en-US` + x-default = TR | slug Türkçe kalabiliyor |
| IdeaSoft | `/en/` + çevrilmiş yol | hayır | 3 mod (belge) | yalnız dil kodu; x-default ve `/en` canonical yok (gözlem) | bakım modu / gizle |
| T-Soft | öneksiz, dile özgü slug | hayır | IP (belge) | `tr`/`en`/`ar` + x-default = TR | doğrulanmadı |

Kaynaklar: https://help.shopify.com/en/manual/markets/seo · https://help.shopify.com/en/manual/international/managing-international-domains · https://help.shopify.com/en/manual/international/automatic-redirection.md · https://help.shopify.com/en/manual/international/pricing/volatile-currencies.md · https://github.com/shopware/shopware/blob/trunk/src/Core/Content/Seo/HreflangLoader.php · https://wpml.org/errata/caching-plugins-may-cause-issues-with-wcml-multi-currency-settings · https://docs.bigcommerce.com/developer/docs/storefront/catalyst/features/localization/multi-language/setup · https://support.ikas.com/how-to-set-up-the-localization-settings?hsLang=en · https://www.ideasoft.com.tr/yardim/ideaexport-uygulama-ayarlari/

Shopify ayrıntıları: "Search engines index only one version of a URL that several markets share" (yalnız bir sürüm, yedek bölgeyi içeren pazarınki; kesin). Otomatik yönlendirme "applies to customers, but search engine crawlers are excluded" (kesin). TRY "oynak para birimi", otomatik açılmaz (kesin). Shopify Payments Türkiye'de yok; yerel parada satış Shopify Payments ya da Adyen ister (kesin).

**Ortak desen:** çoğu platform dili URL'ye, para birimini çerez/oturuma koyuyor. SEO açısından doğru olan aykırılar (Shopify, ikas, Shopware): pazar = URL. Türk platformlarının çoğu (Ticimax, IdeaSoft, T-Soft) para birimini URL'ye bağlamıyor; örnek alınmaz.

## 8. Medusa v2

| Bulgu | Kaynak | Güven |
|---|---|---|
| Translation modülü v2.12.3'te deneysel geldi | https://newreleases.io/project/npm/@medusajs/medusa/release/2.12.3 | kesin |
| v2.22.7'den beri varsayılan açık; öncesinde bayrak | https://docs.medusajs.com/resources/commerce-modules/translation | kesin |
| Kurulu: `@medusajs/translation@2.22.6`; `defineConfig` ekler ama bayrak (`MEDUSA_FF_TRANSLATION`) kapalıyken devre dışı | `pnpm-lock.yaml:3052`; `@medusajs/utils/dist/common/define-config.js:208-211` | kesin (kod) |
| Store API `?locale=` ve `x-medusa-locale`; önce sorgu | Context7 `/medusajs/medusa` store.mdx | kesin |
| Çeviri yoksa özgün metin döner | Context7 translation/storefront | kesin |
| `.translatable()` yalnız `text` alanlarda (v2.13.0+) | `@medusajs/utils/dist/dml/properties/text.d.ts` | kesin (kod) |
| Bir ülke tek bölgede; sepet parası bölgeninki (v2.21.0+); sağlayıcı bölgeye bağlı (`region_payment_provider`) | Context7: region AGENTS.md, cart concepts, payment links | kesin |
| Stripe sağlayıcısı PaymentIntent kullanır; bölge başına bağlanır | Context7 payment-stripe | büyük olasılıkla |
| `locale` kod biçimi (`en` / `en-US`) | — | doğrulanmadı |

## 9. Hukuk ve ödeme özeti

Hukuki görüş değildir. Ayrıntılı tasarım etkisi docs/24 §8.

| Konu | Kural | Kaynak | Güven |
|---|---|---|---|
| Kambiyo, yasağın kapsamı | Yalnız Türkiye'de yerleşikler arası sözleşmeler; yurt dışında yerleşik alıcı kapsam dışı | 32 sayılı Karar'a ilişkin Tebliğ (2008-32/34) https://www.alomaliye.com/2008/02/28/turk-parasi-2008-32-34/ | kesin |
| Mal satışı | Taşıt dışı menkul satışında döviz serbest (m.8/9, Tebliğ 2025-32/72, RG 06.03.2025/32833, yayım günü yürürlükte); hizmet ve gayrimenkulde yasak sürüyor | https://www.resmigazete.gov.tr/eskiler/2025/03/20250306-6.htm | kesin |
| Hizmet | m.8/7: döviz yasak; istisnalar (a) vatandaşlık bağı olmayan taraf, (c) yurt dışında faaliyet, (ç) Türkiye'de başlayıp yurt dışında biten ya da tersi, (d) belgeli tesiste **konaklama**. (d) yurt içi turu kapsamaz. m.8/10 menkul **kiralama**dır, hizmet değil | aynı Tebliğ; HMB SSS https://ms.hmb.gov.tr/uploads/2025/11/Sikca-Sorulan-Sorular-ba3feb0209aa5f1a.pdf | kesin |
| Fiyat etiketi | TL zorunlu m.9/4 (yurt dışı paket tur, eğitim, yurt dışına ulaşım/konaklama hariç); **tüm vergiler dahil m.5/2-c**; indirimde son 10 gün en düşük fiyat m.11 | https://www.lexpera.com.tr/mevzuat/yonetmelikler/fiyat-etiketi-yonetmeligi | kesin |
| Ticari reklam | TL m.13/4 (aynı istisnalar); **tüm vergiler dahil m.13/2**; anlam karışıklığı m.13/1; kişiselleştirilmiş fiyat m.13/10 | https://www.lexpera.com.tr/mevzuat/yonetmelikler/ticari-reklam-ve-haksiz-ticari-uygulamalar-yonetmeligi | kesin |
| TL yanında bilgi amaçlı döviz | açık yasak yok, Bakanlık eski açıklamaları riskli buluyor | ikincil | doğrulanmadı |
| Mesafeli satış | ön bilgilendirme "anlaşılabilir bir dilde" (m.6); paket turlar ayrı yönetmelik | https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.20237.pdf | kesin |
| 805 sayılı Kanun | Türkçe zorunluluğu; yabancıya İngilizce yanında Türkçe metin güvenli | https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=805&MevzuatTur=1&MevzuatTertip=3 | doğrulanmadı |
| AB tüketicisi | farklı dil ve para "yöneltme" göstergesi (Pammer/Alpenhof); Roma I m.6 | https://curia.europa.eu/juris/liste.jsf?num=C-585/08 | büyük olasılıkla |
| Döviz fatura | yurt dışındaki müşteriye TL karşılığı şart değil (VUK m.215/2-a); KDV matrahı vergiyi doğuran olay günü TCMB döviz alış kuru (KDV m.26) | https://www.mevzuat.gov.tr/MevzuatMetin/1.4.213.pdf ; https://www.mevzuat.gov.tr/MevzuatMetin/1.5.3065.pdf | kesin |
| e-Arşiv internet satışı | web adresi, ödeme şekli/tarihi, taşıyıcı ve VKN, gönderim tarihi zorunlu (VUK 509 IV.2.4.5) | https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=MEVZUAT_TEBLIGLER%2FUNIVERSAL%2F2026%2FMEVZUAT_TEBLIGLER_2026_VukTeb509_Guncel.pdf | kesin |
| ETGB/BGB | 30.000 € / 600 kg (RG 03.01.2026/33126, limit maddesi yayım günü yürürlükte; 90 gün sonra yürürlüğe giren gümrük müşaviri şartı); önceki 15.000 € / 300 kg. "2024'te 1.500 €" **yanlış**: 1.500 € ithalat tarafı eşiği | https://www.resmigazete.gov.tr/eskiler/2026/01/20260103-4.htm | kesin |
| ETGB ile KDV istisnası | KDV m.11/1-a, m.12/1; tevsik ETGB ile, tevsik yoksa KDV hesaplanır | KDV Kanunu; KDVGUT | kesin / büyük olasılıkla |
| ETGB'de fatura türü | yaygın uygulama e-Arşiv, KDV %0, ETGB no | https://birfatura.com/ihracatta-e-fatura-mi-e-arsiv-mi/ | doğrulanmadı |
| BirFatura | JSON `SendBasicInvoiceFromModel` yalnız standart satış; istisna/ihracat `SendDocument` + UBL-TR XML | https://developers.birfatura.com/ ; `docs/entegrasyonlar/birfatura.md` | büyük olasılıkla |
| Turizm KDV | yabancı turiste Türkiye'de tur KDV'li (hizmetten Türkiye'de faydalanılıyor, m.12/2-b) | KDV Kanunu | kesin |
| İhracat bedeli | bir kısmının bankaya satılması; oran %35 ve süre (ikincil) | https://www.tcmb.gov.tr/wps/wcm/connect/509c233f-94d1-430d-9015-c0abbd479fd5/%C4%B0hracat+UT-18.05.2026.pdf?MOD=AJPERES | kesin (talimat) / doğrulanmadı (oran) |

**Ödeme sağlayıcıları:**

| Sağlayıcı | Türk şirketiyle | Döviz | Kaynak | Güven |
|---|---|---|---|---|
| Stripe | hayır, Türkiye listede yok | 135+; çok para birimli ödeme yalnız belirli ülkelerde | https://stripe.com/global ; https://docs.stripe.com/payouts/multicurrency-settlement | kesin |
| Stripe Adaptive Pricing | Checkout ve Checkout Sessions'lı Elements'te çalışır, **Payment Intents API'de çalışmaz**; müşteri %2–4 öder | https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing | kesin |
| Stripe Türk kartları | Visa/MC "Global"; Türk bankasına özel güvence yok, banka reddi olabilir, Troy yok | https://docs.stripe.com/payments/cards | kısmen |
| Stripe kısıtlı işler | "Other weapons…" ve "Travel reservation services" onay ister | https://stripe.com/legal/restricted-businesses | kesin (metin) |
| Stripe Atlas | Delaware şirketi, 500 $ | https://stripe.com/atlas | kesin |
| PayTR | TL, EUR, USD, GBP, RUB (belge + kodla uyumlu); canlı hesapta döviz yetkisi PayTR'ye sorulmalı; dev.paytr.com 503 verdi | https://www.paytr.com/en/virtual-pos ; `lib/payments/paytr/fields.ts` | büyük olasılıkla |
| iyzico | `currency`: TRY, USD, EUR, GBP, NOK, CHF; TL'ye çevrilip aktarılır, taksit yok (yardım merkezi açılamadı) | https://docs.iyzico.com/en/payment-methods/direct-charge/checkoutform/cf-implementation/cf-initialize | kesin / doğrulanmadı |
| Banka dövizli sanal POS | Akbank: TL, USD, GBP, EUR, JPY; gelir döviz hesaba | https://www.akbank.com/kurumsal/uye-isyeri-pos/diger-pos-cozumleri/dovizli-pos | kesin |
| PayPal | 2016'dan beri Türkiye'de yok | https://techcrunch.com/2016/05/31/paypal-to-halt-operations-in-turkey-after-losing-license-impacts-hundreds-of-thousands | ikincil; 2026 doğrulanmadı |
| Paddle, Lemon Squeezy | fiziksel ürün ve insan hizmeti yasak | https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle ; https://docs.lemonsqueezy.com/help/getting-started/prohibited-products | kesin |

**En gerçekçi yol:** Türk şirketinin kendi hesabıyla dövizli tahsilat (PayTR/iyzico döviz ya da banka dövizli sanal POS) + ETGB ile mikro ihracat, hepsi tek şirkette. Stripe yalnız yurt dışı şirket kurulursa; iş merkezi riski, transfer fiyatlandırması ve iki ülkede uyum maliyeti var (YMM'ye sorulur).

**Mali müşavir ve avukat soruları:** `docs/mali-musavir-sorulari.md` §8 (mali müşavir) ve §9 (avukat).

## 10. Bağımsız doğrulama özeti

Kritik iddialar birincil kaynağa karşı yeniden açıldı. Sonuç ve düzeltmeler:

| İddia | Sonuç | Düzeltme |
|---|---|---|
| Google otomatik yönlendirmeyi önermiyor; Googlebot ABD, Accept-Language yok | doğru | — |
| Para birimi başına ayrı URL (merchant listing) | doğru | — |
| Merchant Center'da konuma göre dil/para değiştirmek | doğru | "politika ihlali" değil, "Shopping gereksinimlerine aykırı"; kaynak answer/15404838 |
| Content API 18.08.2026'da kapandı | doğru | — |
| Robots.txt ile otomatik çeviri engelleme önerisi kaldırıldı | doğru | tarih 11.06.2025 |
| Yandex site haritası hreflang'ini okumaz | doğru | Yandex için "yalnız HTML" |
| Bing: `content-language` güçlü sinyal | kısmen | tek dayanak 2020 tweet'i; resmî tutum değil |
| Translation modülü 2.12.3'te geldi, 2.22.7'de varsayılan açık; `?locale=`; özgün metne düşer | doğru | — |
| Ülke tek bölgede; sepet parası bölgeninki; sağlayıcı bölgeye bağlı | doğru | — |
| Stripe Türkiye'de yok | doğru | — |
| Adaptive Pricing yalnız Checkout'ta | kısmen | Checkout Sessions'lı Elements'te de çalışır; Payment Intents'te çalışmaz, sonuç değişmez |
| Stripe Türk kartlarını kabul eder | kısmen | Visa/MC ağ düzeyinde; banka reddi olabilir; Troy yok |
| 2025'te yerleşikler arası menkul satışında döviz serbest | doğru | yalnız satış; hizmet ve gayrimenkul yasağı sürüyor |
| Hizmet istisnası m.8/10 | yanlış numara | doğrusu **m.8/7**; konaklama istisnası (d) yurt içi turu kapsamaz |
| Fiyat TL ve KDV dahil, m.9/4 ve m.13/4 | bölünmeli | TL: m.9/4, m.13/4; vergiler dahil: m.5/2-c, m.13/2 |
| ETGB 30.000 € / 600 kg | doğru | yayım günü yürürlükte; "1.500 €'ya düşürüldü" yanlış |
| Shopify: aynı URL'de para değişince indekslenmez | kısmen | doğrusu: paylaşılan URL'nin yalnız bir sürümü indekslenir |
| PayTR USD/EUR/GBP/RUB | kısmen | belge sayfası açılamadı; kodla uyumlu; canlı hesap yetkisi sorulmalı |
| next-intl varsayılanları (`always`, algılama açık, `Link` açık) | doğru | — |

## 11. Doğrulanamayanlar ve açık kalanlar

- Shopify'ın Googlebot'a hangi para birimini gösterdiği (yalnız gözlem: URL'nin pazarınınki); manuel kur kapsamı; Translate & Adapt'ta Türkiye kotası.
- ikas, Ticimax, T-Soft için hreflang ve yönlendirme belgesi.
- Bing'in 2023 sonrası tutumu; yapay zekâ motorlarının dil seçimi.
- Tek dilliye `/en` eklemenin ölçülmüş vaka çalışması.
- SOTR 78 transkriptinin birebir metni.
- Medusa `locale` kod biçimi.
- iyzico döviz koşulları, PayTR döviz yetkisi ve ödeme para birimi, Param ve Sipay döviz ayrıntıları.
- 805 sayılı Kanun'un yabancı tüketiciye uygulanması; İngilizce vitrinde döviz fiyatın Türk tüketici mevzuatı karşısındaki durumu.
- `en-EU` gibi bir hreflang bölge kodunun Google'da geçerliliği (EU, ISO 3166-1'de istisnai ayrılmış kod; ülke başına satır güvenli yol).
- İhracat bedeli bankaya satış oranı ve kartla tahsil edilen ETGB bedelinin bu yükümlülüğe tabiliği.
