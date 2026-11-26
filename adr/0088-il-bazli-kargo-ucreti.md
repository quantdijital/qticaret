# ADR-0088: İllere göre kargo ücreti ve gönderim yapılmayan iller

- **Durum:** Önerildi (sahibin cevapları bekleniyor, §Sorular)
- **Tarih:** 2026-11-26
- **İlgili:** adr/0087 (tek kargo hesabı `shippingQuote`, `shop_shop`, eşik bütün seçeneklerde, "Kargo ücreti" tek soru), adr/0024 (eşik, kampanyalar), adr/0031 ve adr/0035 (taşıyıcılar, desi tablosu), adr/0054 (paket, alıcı doldurma), F1.4 (TR adresi, `tr-address` modülü), docs/13 (JSON-LD `shippingDetails`), docs/06 (Ayarlar > Kargo).
- **Dayanak:** sahip, WooCommerce'in "kargo bölgeleri"yle karşılaştırma (2026-11-26): bazı illere farklı ücret (ör. İstanbul daha ucuz, uzak iller daha pahalı) ve "şu illere gönderim yok".

## Bağlam (kod, 2026-11-26 `dev`, #451 sonrası)

**Adres.** Türkiye adresi Medusa alanlarına şöyle yazılır (F1.4, `modules/tr-address/validation.ts`): `province` = il **adı** ("İstanbul"), `city` = ilçe, `address_2` = mahalle, `postal_code` = mahallenin PTT kodu. Vitrin formu ili plaka koduyla seçer, sepete adı yazar (`apps/storefront/src/lib/checkout/address-form.ts`). Sepet ve müşteri adresi kaydedilirken `tr-address` kancaları (`workflows/hooks/validate-cart-tr-address.ts`) adı, ilçeyi ve posta kodunun il önekini denetler. İl kaydı `tr_province`: `code` = iki haneli plaka (posta kodunun ilk iki hanesi de budur, `lib/tr/postal-code.ts` `postalCodePlate`), `match_key` = adın karşılaştırma anahtarı. Yani sepetteki adresten plaka kodu sunucuda güvenle çıkar.

**Ücret.** Bütün mağaza seçenekleri (sabit ücret `shop_shop` ve `-flat`, Aras/Yurtiçi desi tablosu, Geliver teklifi) tek saf işlevden fiyatlanır: `lib/shipping/quote.ts` → `shippingQuote({ lines, context, basis, price })`. Bağlamı `workflows/hooks/shipping-quote-context.ts` kurar (`setCalculatedShippingPricingContext`, hem seçenek listesi hem tek seçenek fiyatı): eşik, `item_total`, ürün sınıfları, sınıf ek ücretleri. Bağlam bugün **adresi okumaz**. Mağazadan teslim ayrı kargo kümesidir (`pickup`), ücretsizdir.

**Bölge.** Mağazanın tek servis bölgesi var: "Türkiye", `geo_zones: [{ type: "country", country_code: "tr" }]` (`workflows/shipping/shipping-options.ts` `ensureShippingZoneStep`). Panelde bölge kavramı yok.

**Ödeme sonu.** `completeCartWorkflow.hooks.validate` "kargo bayatladı" denetimi (`workflows/checkout/stale-shipping.ts`) mağazanın kendi fiyatladığı yöntemleri aynı listeleme iş akışıyla (kanca dahil) yeniden fiyatlar; tutar değiştiyse siparişi durdurur. Adres değişince Medusa `refreshCartShippingMethodsWorkflow` yöntemleri yeniden fiyatlar, artık geçersiz olanı siler.

**Vitrin tahmini.** Başka bir dalda (`deniz/sepette-kargo-tahmini`) sepette **adres yokken** kargo tahmini gösteren bir Store rotası yazılıyor. Tahmin adres bilmez.

**Akış ve JSON-LD.** Google akışı `<g:shipping><g:country>TR</g:country><g:price>…` (`lib/feeds/google.ts`), JSON-LD `shippingDestination: { DefinedRegion, addressCountry: "TR" }` (`lib/seo/jsonld-shipping.ts`); ikisi de tek ülke geneli ücret.

### Medusa 2.22.6 (kurulu kaynaktan okundu; Context7 kotası dolu)

- **Coğrafi bölge türleri:** `geo_zone.type` ∈ `country | province | city | zip`; `province_code` metin (`@medusajs/fulfillment` `models/geo-zone.js`).
- **Eşleşme:** `listShippingOptionsForCartWithPricingWorkflow` süzgece `address: { country_code, province_code: cart.shipping_address.province, city, postal_expression: postal_code }` verir (`core-flows/.../list-shipping-options-for-cart-with-pricing.js`). `buildGeoZoneConstraintsFromAddress` adresin dolu alanlarından **VEYA** bağlı kısıtlar kurar (ülke, il, ilçe, posta). Yani ülke bölgesindeki seçenek her TR adresinde görünür; il bölgesindeki seçenek **ek olarak** görünür. "Ülke eksi şu iller" yazılamaz; dışlamak için ülke bölgesini kaldırıp 81 ilin 70'ini tek tek il bölgesi olarak yazmak gerekir. `province_code` bizim adresimizde il **adıdır**; bölgeye de ad birebir yazılmalıdır (büyük/küçük harf, "İ").
- **Seçenek kuralları:** `listShippingOptionsForContext` her seçeneğin kurallarını (`attribute`, `operator`, `value`) bağlamla `isContextValid` ile sınar (`fulfillment/dist/utils/utils.js`); bağlamda olmayan alan `"undefined"` dizesi olarak karşılaştırılır. Bağlama sunucu tarafında alan eklemenin yolu `listShippingOptionsForCartWithPricingWorkflow.hooks.setShippingOptionsContext` kancasıdır (bizde bugün kullanılmıyor; iş akışı başına tek işleyici). Sepete yöntem ekleme ve yenileme aynı iş akışını `runAsStep` ile çalıştırdığından kanca orada da uygulanır.

## Karar

**Seçilen: Medusa bölgeleri değil, kargo ayarlarında "il kuralları"; ücret `shippingQuote`'ta, gönderim yasağı seçenek kuralıyla ve ödeme sonu denetimiyle.** Gerekçe: tek hesap (adr/0087) bozulmaz, 4 ücret türünün hepsine (sabit, tablo, Geliver, ücretsiz) aynı kural uygulanır, seçenek kopyalanmaz, panel tek kart olur.

### 1. Veri (platform ayarı, migration yok)

`shipping.province_rules: ProvinceRule[]` (şema varsayılanı `[]`):

```ts
interface ProvinceRule {
  /** Plate codes "01".."81"; a province is in one rule at most. */
  provinces: string[]
  /** "adjust": add (or take off) an amount; "no_shipping": not delivered there. */
  kind: "adjust" | "no_shipping"
  /** Kuruş, KDV in; -100.000 TL .. +100.000 TL; 0 and absent for "no_shipping". */
  amount?: number
}
```

- Şema denetimi (Zod, `sections/shipping.ts`): plaka 01–81, bir il en çok bir satırda, en çok 20 satır, boş il listesi yok. Panelden başka yazan yok; değer istemciden ödeme sırasında **asla** alınmaz.
- İl kodla tutulur, adla değil: il adı yazımı (İ/ı, "Afyonkarahisar"/"Afyon") kuralı bozamaz.
- İlçe düzeyi (Bozcaada, Gökçeada, Adalar) şimdi yok; gerekirse aynı satıra `districts` alanı eklenir, anlamı değişmeyen yeni alan olarak (Soru 5).

### 2. Adresin ili, sunucuda

Kanca (`shipping-quote-context.ts`) sepeti okurken `shipping_address.province` ve `postal_code`'u da okur ve plakayı çıkarır: önce `tr-address` modülünden adın `match_key`'iyle `tr_province.code`, olmazsa posta kodunun ilk iki hanesi. Ülke `tr` değilse ya da il yoksa plaka `null`. Bağlama `province: "34" | null` eklenir (`ShippingQuoteContext`). Okuma iş akışı kancasındadır; sağlayıcı başka modül çözmez (apps/backend/CLAUDE.md).

### 3. Ücret: `shippingQuote` sırası

1. Eşik geçildiyse **0** (bugünkü gibi; Soru 2).
2. Kargo gerektiren her kalem ücretsiz sınıftaysa **0** (bugünkü gibi; Soru 3).
3. Taban (sabit tutar sipariş başı; tablo/Geliver ücretli kalemlerin kolisi) + en yüksek sınıf ek ücreti (bugünkü gibi).
4. **Yeni:** ilin `adjust` satırı varsa tutarı eklenir; sonuç **0'ın altına inmez**. Taban 0 ise (panelde "Tüm siparişlerde ücretsiz") fark eklenmez: "ücretsiz" sözü hiçbir ilde bozulmaz (Soru 3).
5. İl bilinmiyorsa (adres yok) fark yok: taban fiyat.

Kampanyayla ücretsiz kargo (Medusa promosyonu, kargo yöntemine %100) fiyatın üstüne biner ve il farkını da sıfırlar; değişiklik yok. Kapıda ödeme ücreti, BirFatura kargo satırı ve sipariş düzenleme aynı tutarı okur; değişiklik yok.

### 4. Gönderim yapılmayan iller

- **Listede görünmez:** mağazanın `shipping` kümesindeki her seçeneğe tek, sabit bir Medusa kuralı yazılır: `qt_province_blocked ne "true"` (seçenek oluşturma/güncelleme iş akışında; mevcutlar için tekrarlanabilir veri işi). `setShippingOptionsContext` işleyicisi sepetin ilini kurallarla karşılaştırıp `qt_province_blocked: "true" | "false"` döner. Kural ayar değişince değişmez; yalnız ayar değişir. Bağlamı kurmayan yollar (yönetici listeleri, iade) alanı görmez, `"undefined" ne "true"` geçer: yönetici işleri bozulmaz.
- **Mağazadan teslim** (`pickup` kümesi) kuralsızdır, o ilde de görünür.
- **Sepete eklenemez:** yöntem ekleme aynı listelemeyi kancayla çalıştırdığından seçenek "sepete uygun değil" diye reddedilir.
- **Ödeme sonunda ikinci savunma:** `completeCartWorkflow.hooks.validate` sepetin ili yasaklıysa ve kargolu yöntem seçiliyse `shipping.province_not_served` ile durdurur (kural adres girildikten sonra eklendiyse).
- **Adres reddedilmez:** müşteri adresi kaydeder; ödeme adımı seçenekler yerine "Bu ile şu an gönderim yapamıyoruz." der (mağazadan teslim varsa o kalır). Sert engel yalnız para/teslim imkânsızlığı içindir (engel değil uyarı ilkesi; Soru 4).

### 5. Vitrin

- **Ödeme adımı:** seçenekler sunucunun ile göre hesapladığı ücretle gelir; il değişince Medusa yöntemi yeniden fiyatlar. Vitrin ücret hesaplamaz.
- **Sepet tahmini (adres yok):** tahmin taban ücreti gösterir (il yok = fark yok). Mağazada `adjust` ya da `no_shipping` satırı varsa yanıt `varies_by_province: true` taşır; vitrin altına tek satır yazar: "Teslimat iline göre değişebilir." Sepetin adresi varsa tahmin o ille hesaplanır ve satır çıkmaz. Tahmin rotası bu ADR'nin işinde bu alanı ekler; tahmin dalı birleşmeden önce gelirse alan opsiyonel okunur.
- **Ürün sayfası "Kargo ve Teslimat":** taban ücret cümlesi aynı kalır; kural varsa aynı tek satır. İl listesi ürün sayfasında sayılmaz.
- Görünüm kilidi değişmez (yeni satır metin; biçim yok, adr/0066).

### 6. Panel (Ayarlar > Kargo > Seçenekler ve ücretler)

"Kargo ücreti" kartının altında, kapalı başlayan isteğe bağlı bölüm: **"İllere göre farklı ücret"**.

- Satırlar yerinde düzenlenir (pencere yok): **İller** (çoklu seçim, aramalı, 81 il) → **Ne olsun:** "Ek ücret" / "İndirim" / "Gönderim yok" → **Tutar** (TL; "Gönderim yok"ta gizli). "+ Satır ekle", satırda sil.
- Başka satırda seçili il listede soluk ve "zaten başka satırda" der (seçilemez; şema da reddeder).
- Kart cevabı "Tüm siparişlerde ücretsiz" iken "Ek ücret/İndirim" seçilemez, açıklama: "Ücretsiz kargo her ilde ücretsizdir; burada yalnız gönderim yapılmayan illeri seçebilirsiniz."
- Özet satırı (kart kapalıyken): "3 ile +40 TL, 2 ile gönderim yok".
- Kaydet sayfanın başlığındaki ortak düğmeyle; denetim kaydı önce/sonra; yetki: ayar yazabilen roller.

### 7. Akış ve JSON-LD

- Google akışı ve JSON-LD **taban ücreti** ülke geneli yazar (bugünkü gibi). Google'ın `OfferShippingDetails` bölge alanı (`addressRegion`) ve Merchant Center bölge tanımları bugün yalnız birkaç ülkede il düzeyinde kabul ediliyor; TR'nin bunlar arasında olmadığı **uygulamadan önce Google belgesinden doğrulanır** (Context7 kotası dolu, bu ADR'de doğrulanamadı). Destekleniyorsa yasaklı iller için `doesNotShip: true` bölgeleri ve fark satırları ek `shippingDetails` olarak yazılır; desteklenmiyorsa yazılmaz.
- Taban ücret çoğu ili temsil ettiğinden Merchant Center ürün/ödeme uyuşmazlığı riski düşüktür; İstanbul indirimi tabanı düşürmez (taban hep pahalı olan değil, kuralsız illerin ücretidir).
- SEO advisor kuralı eklenmez.

### 8. Taşıyıcıların kendi bölge fiyatları

Aras ve Yurtiçi kurumsal sözleşmeleri çoğunlukla ülke geneli desi fiyatıyla gelir; bazılarında şehir içi indirimi ya da "mobil bölge / mücavir alan dışı" (ada, köy) ek ücreti bulunur. Bizim desi tablomuz (`shipping.rate_table`) tek, ülke genelidir ve taşıyıcının faturasını değil müşteriye yansıtılan ücreti tutar. İl kuralı bu farkı müşteriye yansıtmanın yoludur; taşıyıcı API'sinden bölge fiyatı okunmaz (Geliver teklifi de koliyi fiyatlar, adresi değil: `fulfillment-geliver/service.ts`). Mobil bölge ilçe/mahalle düzeyindedir; il kuralı onu karşılamaz (Soru 5).

### 9. Testler

- **Birim:** plaka çıkarma (ad, `match_key` farkları, posta kodu yedeği, yabancı ülke `null`); ayar şeması (aynı il iki satırda, plaka 00/82, 21 satır, `no_shipping`'de tutar); `shippingQuote` il tablosu: ek ücret, indirim 0'ın altına inmez, eşik 0, hepsi ücretsiz 0, taban 0'da fark yok, il yoksa taban, sınıf ek ücreti + il farkı birlikte; `setShippingOptionsContext` işleyicisinin kararı.
- **HTTP entegrasyon:** sepet + İstanbul adresi → sabit/tablo seçeneği farklı; il değişince yöntem yeniden fiyatlanır; yasaklı il → kargo seçenekleri yok, mağazadan teslim var; yasaklı ilde yöntem eklemek reddedilir; adres girildikten sonra kural eklenince tamamlama `shipping.province_not_served` ile durur; eşik geçince yasaklı olmayan ilde 0; ücretsiz kargo kuponu farkı sıfırlar; istemcinin gönderdiği `data`/bağlam ücreti değiştirmez; tahmin rotası `varies_by_province`.
- **Veri işi:** mevcut seçeneklere kural iki kez çalışınca tek kural.
- **Panel e2e:** satır ekle (iller + ek ücret), kaydet, sayfayı yenile, satırı sil (veriyi geri alır); "Tüm siparişlerde ücretsiz"te ek ücretin kapalı olduğu.
- **Vitrin:** "Teslimat iline göre değişebilir." satırı (`views` birim testi); görünüm kilidi değişmez.

### 10. Migration

- DB şeması yok. Ayar: `shipping.province_rules` (JSON ayar bölümü, varsayılan `[]`).
- Veri: mevcut `shipping` kümesi seçeneklerine `qt_province_blocked ne "true"` kuralı ekleyen tekrarlanabilir iş (`scripts/` + workflow, telafili); yeni seçenekler kuralı oluşturulurken alır.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Ayarlarda il kuralları, `shippingQuote` + seçenek kuralı (seçilen)** | Tek hesap korunur; her ücret türüne aynı kural; seçenek kopyası yok; panelde tek kart; eşik, sınıf, kupon sırası tek yerde | Bağlama il okuma eklenir; seçeneklere tek seferlik kural yazılır |
| Medusa servis bölgeleri (il grubu = bölge, her bölgeye seçenek) | Medusa'nın kendi kavramı | Bölgeler VEYA'lanır: ülke bölgesi her ilde görünür, "şu iller hariç" için 70 il bölgesi; her taşıyıcı ve ücret türü bölge başına kopyalanır (Aras tablo ×3 bölge…); `primary_option_id` ve "Kargo ücreti" tek sorusu bölgeye bölünür; `province_code` il **adıyla** eşleşir (yazım kırılgan); adres yokken tahmin hangi bölgenin seçeneğini göstereceğini bilemez |
| Yalnız ücret, yasak yok | Daha küçük iş | Sahibin ikinci ihtiyacı ("gönderim yok") karşılanmaz |
| Adres adımında yasaklı ili reddetmek | En basit engel | Mağazadan teslim isteyen müşteriyi de durdurur; adres defterini bozar; "engel değil uyarı" ilkesine ters |

## Sonuçlar

- Sıra: (1) ayar şeması + kanca il okuması + `shippingQuote` farkı + birim/HTTP testleri; (2) seçenek kuralı + `setShippingOptionsContext` + tamamlama denetimi + veri işi; (3) panel bölümü + e2e; (4) vitrin satırı + tahmin alanı; (5) akış/JSON-LD (Google doğrulamasından sonra).
- Ödeme ve kargo parası dokunduğundan her PR'da `security-reviewer` ve HTTP testleri zorunlu.
- docs/06 Ayarlar > Kargo bölümü güncellenir.

## Sorular (sahibe)

1. **Satırdaki tutar "fark" mı olsun (+40 TL / −20 TL), yoksa "o ilin ücreti" mi (İstanbul 49 TL)?** Öneri: **fark.** Kargo firmasının desi tablosu ve Geliver'de de çalışır; "o ilin ücreti" yalnız sabit ücrette anlamlı.
2. **"X TL üzeri ücretsiz" eşiğini geçen sepet, pahalı illerde de ücretsiz olsun mu?** Öneri: **evet.** Vitrin her yerde "X TL üzeri ücretsiz" diyor; il farkı yalnız ücret alınan siparişe eklenir. (Yasaklı ilde eşik de gönderim açmaz.)
3. **Ücretsiz kargolu ürün ya da "Tüm siparişlerde ücretsiz" seçiliyken uzak ile ek ücret alınsın mı?** Öneri: **hayır**, "ücretsiz" sözü hiçbir ilde bozulmaz; o durumda bu bölümde yalnız "Gönderim yok" seçilebilir.
4. **Gönderim yapılmayan ilden adres girilince ne olsun?** Öneri: adres kaydedilir, ödeme adımında kargo seçenekleri yerine "Bu ile şu an gönderim yapamıyoruz." yazar; mağazadan teslim açıksa o seçilebilir; sipariş kargoyla tamamlanamaz.
5. **İl yeterli mi, yoksa ilçe de gerekir mi (Bozcaada, Gökçeada, Adalar; kargo firmalarının "mobil bölge" ek ücreti)?** Öneri: **şimdilik il.** İhtiyaç olursa aynı satıra "ilçeler" eklenir, kurulan kurallar bozulmaz.
6. **Sepette ve ürün sayfasında il seçilmeden ne yazsın?** Öneri: taban ücret ve altında "Teslimat iline göre değişebilir."; il seçilince kesin ücret ödeme adımında. Google'a taban ücret gider.
