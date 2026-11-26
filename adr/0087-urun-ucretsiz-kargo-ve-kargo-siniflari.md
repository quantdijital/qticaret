# ADR-0087: Üründe ücretsiz kargo ve kargo sınıfları

- **Durum:** Kabul edildi (sahip, 2026-11-26: bütün sorularda önerilen cevap)
- **Tarih:** 2026-11-26
- **İlgili:** adr/0024 (kargo bedava eşiği, kampanyalar), adr/0031 (kargo altyapısı, desi), adr/0035 (Aras ve Yurtiçi, ücret tablosu), adr/0054 (varsayılan paket), adr/0072 (BirFatura), adr/0076 (kargosuz ürün), adr/0066 (yayımlanmış biçim sözleşmesi), docs/13 (JSON-LD `shippingDetails`), docs/06 (ürün sayfası "Kargo" sekmesi, Ayarlar > Kargo).
- **Dayanak:** WooCommerce farkı S4 (2026-11-26 boşluk raporu): WooCommerce'te ürünün "Kargo sınıfı" vardır; ücretsiz ya da büyük/ağır ürün sınıfla ayrılır. Bizde ürün başına ücretsiz kargo yok.

## Bağlam (kod, 2026-11-26 `dev`)

**Kargo seçenekleri** (Ayarlar > Kargo > Kargo seçenekleri, panelin `shipping-option-dialog`'u). Taşıyan ve ücret türü:
- **Sabit ücret:** Medusa'nın `flat` fiyatı. "Kendi gönderimim" Medusa'nın `manual` sağlayıcısıyla; Aras ve Yurtiçi'de `aras-flat` / `yurtici-flat`.
- **Ücret tablosu (desi):** `aras-table` / `yurtici-table`, `calculated`. Sağlayıcının `calculatePrice`'ı sepetin kolisini (`parcelFor`, varsayılan paket adr/0054) mağazanın desi tablosuyla fiyatlar (`lib/shipping/rates.ts`, `tablePriceOf`).
- **Geliver en uygun / en hızlı:** `calculated`, Geliver'in teklifi.
- **Mağazadan teslim:** ücretsiz.

**Mağaza geneli eşik** ("X TL üzeri kargo bedava", adr/0024): Ayarlar > Kampanyalar `promotions.free_shipping_threshold`. `syncFreeShippingWorkflow` (`workflows/promotions/free-shipping.ts`) her **sabit ücretli** seçeneğe `item_total gte eşik` kurallı 0 TL fiyat yazar; seçenek değişince abone (`subscribers/free-shipping.ts`) aynısını yapar. **Hesaplanan seçeneklere (desi tablosu, Geliver) eşik uygulanmaz** (dosyanın açıklaması: "left to their provider"; sağlayıcılarda eşik okuması yok). Oysa vitrin eşiği her yerde söyler:
- ürün kartı rozeti "Ücretsiz kargo" (`apps/storefront/src/lib/views/card-framed.ts`, `shipsFree`: yalnız fiyat ≥ eşik);
- sepetteki ilerleme çubuğu (`views/cart.ts` `freeShippingOf`, Atölye `FreeShippingMeter`);
- ürün sayfasının "Kargo ve Teslimat" kartı, meta açıklamanın `kargo_cümlesi`'i, `{ücretsiz_kargo_eşiği}` belirteci;
- ürün akışları (`lib/feeds/items.ts` `shippingCost`): desi tablosu ürünü fiyatlıyorsa eşiğe bakmadan tablo ücreti; yoksa en ucuz sabit ücret, eşiği geçen üründe 0.

Yani bugün desi tablosu kullanan mağazada eşiği geçen sepet **ödeme adımında ücret öder**, kart ve sepet "ücretsiz" der. Bu ADR bu açığı da kapatır.

**Kampanyayla ücretsiz kargo:** Kampanyalar ekranındaki "Ücretsiz kargo" Medusa promosyonudur (hedef `shipping_methods`, %100). Kod ya da otomatik; ürün kuralı "sepette şu ürün **varsa**" demektir, "sepetteki **her** ürün şu ise" diyemez.

**Ürün verisi:** ürünün Medusa'da olmayan alanları `catalog-extension` modülündeki `product_extension`'dadır (tür, durum, rozet, yaş sınırı…). Ürün sayfasının "Kargo" sekmesi (`detail/parcel-panel.tsx`) bugün yalnız paket ölçülerini tutar.

**Fatura (BirFatura, adr/0072):** kargo satırı siparişin kargo yöntemlerinden toplanır (`lib/invoicing/birfatura/map.ts`, `ShippingChargeTotal…`). 0 TL kargo bugün de doğru gider.

**JSON-LD:** `shippingDetails` yalnız desi tablosu sunuluyorsa yazılır; ücret ürünün tek adetlik kolisinin tablo fiyatıdır (`workflows/seo/shipping-facts.ts` `shippingRateOf`). Eşik burada da yok sayılır.

### Medusa 2.22.6 (kaynak `v2.22.6` etiketinden okundu; Context7 kotası dolu)

- **Kargo profili:** `validateShippingStep` (`core-flows/src/cart/steps/validate-shipping.ts`) sepetteki kargo gerektiren **her kalemin profili için ayrı bir kargo yöntemi** ister. `listShippingOptionsForCartWithPricingWorkflow` hesaplanan seçeneğe yalnız o seçeneğin profilindeki kalemleri verir (`filterCartItemsByShippingProfile`). Farklı profilli iki ürün = ödeme adımında iki yöntem, iki ücret, iki koli.
- **Sabit fiyat:** fiyat bağlamı sepetin kendisidir (`calculated_price: { context: cart }`); kural yalnız sepetin alanlarına (ör. `item_total`) bakabilir. "Sepetteki her ürün ücretsiz" gibi bir kural yazılamaz.
- **Hesaplanan fiyat:** `calculatePrice(optionData, data, context)`; `context.items` kalemleri varyantın ölçüleri ve `variant.product.id` ile gelir. `setCalculatedShippingPricingContext` kancası sunucuda üretilen ek bağlamı `calculatePrice`'a geçirir (çerçevenin alanları çakışmada önce gelir). `addShippingMethodToCartWorkflow` ve `refreshCartShippingMethodsWorkflow` aynı iş akışını `runAsStep` ile çalıştırır: kanca sepete ekleme ve yenilemede de uygulanır.

## Karar

### 1. Veri: ürünün kargo sınıfı

- `product_extension.shipping_class` (metin, boş olabilir). Boş = **Standart** (bugünkü davranış).
- Yerleşik sınıf `free` = **Ücretsiz kargo**; silinemez, adı değişmez.
- Mağazanın kendi sınıfları Ayarlar > Kargo'da: `shipping.shipping_classes: [{ key, name, surcharge }]` (platform ayarları, migration yok). `surcharge` KDV dahil kuruş, 0–100.000 TL; en çok 20 sınıf. Örnek: "Büyük / ağır ürün +150 TL".
- Sınıf varyantta değil üründedir (WooCommerce'te varyant sınıfı ayrıca seçilebilir; ihtiyaç doğarsa `variant_extension`'a aynı alan eklenir, anlamı değişmez).
- Dijital ürün ve hizmette alan yoktur (kargo zaten yok, adr/0076).

### 2. Ücret: tek hesap, sunucuda

Bütün mağaza seçeneklerinin ücreti tek saf işlevden gelir: `lib/shipping/quote.ts` → `shippingQuote({ lines, option, settings })`. Fiyat istemciden alınmaz; sınıf sunucuda üründen okunur.

1. **Kargo gerektiren kalemler** ikiye ayrılır: ücretsiz sınıftakiler ve ücretliler.
2. **Hepsi ücretsiz → 0 TL**, seçeneğin türü ne olursa olsun (sabit, tablo, Geliver). Geliver'e teklif sorulmaz.
3. **Karışık sepet:**
   - Desi tablosu ve Geliver: ücret **yalnız ücretli kalemlerin kolisinden** hesaplanır. Ücretsiz ürünün desisi ücrete eklenmez (WooCommerce'te ücretsiz sınıf maliyet eklemez).
   - Sabit ücret: ücret sipariş başınadır, **tam alınır**.
   - Gerçek koli (etiket, taşıyıcıya giden desi/kg) **bütün** kalemlerle çıkar (`packedParcelOf` değişmez). Fark mağazanın kendi üstlendiği kargodur.
4. **Sınıf ek ücreti:** ücretli kalemlerde kendi sınıfı olan varsa, **en yüksek ek ücret siparişe bir kez** eklenir (WooCommerce'in "en pahalı sınıf" hesabı). Ücretsiz kalemin sınıfı ek ücret getirmez.
5. **Eşik:** sepet tutarı (`item_total`, KDV dahil, indirim sonrası; adr/0024'le aynı) eşiği geçtiyse **her seçenek** 0 TL olur: desi tablosu ve Geliver dahil (bugünkü açık kapanır). Ek ücret de düşer. Eşik ücretsiz ürünleri de sayar: "1.500 TL üzeri" sepetin bütün tutarıdır.
6. **Kampanyalar:** ücretsiz kargo kampanyası bugünkü gibi kargo yöntemine %100 indirim uygular; hesaplanan ücrete dokunmaz, üstüne biner. Kupon `item_total`'ı düşürüp sepeti eşiğin altına indirirse adr/0024'teki "kod sonrası kargoyu yeniden seç" kuralı geçerlidir.

**Nasıl uygulanır:**
- **Hesaplanan seçenekler** (Aras/Yurtiçi tablosu, Geliver): `listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext` kancası sepetin ürünlerinin sınıflarını ve mağazanın eşiğini sorgular, bağlama `qt_shipping: { classes: { [product_id]: key }, threshold }` olarak ekler. Sağlayıcı `calculatePrice`'ta `shippingQuote`'u çağırır. Sağlayıcı başka modülü çözmez; bağlam istemciden değil kancadan gelir. Kanca, `listShippingOptionsForCartWorkflow`'un `setShippingOptionsContext`'iyle tutarlı tutulur (Medusa notu).
- **Sabit ücretli seçenekler:** Medusa'nın sabit fiyatı "hepsi ücretsiz"i bilemez (yukarıda). Bu yüzden panelin "Sabit ücret"i **bizim sağlayıcımızda hesaplanan fiyata** çevrilir: tutar seçeneğin `data.amount`'ında durur (KDV dahil kuruş), `calculatePrice` `shippingQuote`'u çağırır.
  - Aras ve Yurtiçi'nin `-flat` seçenekleri zaten bizim sağlayıcılarımızda; yalnız `canCalculate` genişler.
  - "Kendi gönderimim" Medusa'nın `manual` sağlayıcısından yeni, küçük bir `fulfillment-shop` sağlayıcısına (`shop_shop`) geçer: yalnız fiyat hesaplar, gönderi açmaz (bugünkü `manual` gibi).
  - Eşik böylece fiyat kuralı değil hesaptır; `syncFreeShippingWorkflow` ve aboneliği, geçiş bittiğinde kaldırılır.
- Panel ekranda yine "Sabit ücret" der; mağaza sahibi farkı görmez.

### 3. Müşterinin gördüğü (vitrin, Atölye)

- **Ürün kartı:** ücretsiz sınıftaki üründe mevcut "Ücretsiz kargo" rozeti (`card_free_shipping`) eşikten bağımsız çizilir. Yeni biçim yok; mevcut rozet koşulu genişler (adr/0066: davranış düzeltmesi, görünüm aynı). Tükenen kartta yine çizilmez.
- **Ürün sayfası:** "Kargo ve Teslimat" kartının ilk satırı "Bu ürünün kargosu ücretsiz." olur (eşik satırının yerine). Ek ücretli sınıfta satır: "Bu ürün için kargoya {tutar} eklenir." (sahip istemezse gizlenir, bkz. sorular).
- **Sepet:** kargo gerektiren her kalem ücretsizse eşik çubuğu yerine "Sepetinizdeki ürünlerin kargosu ücretsiz." Karışık sepette çubuk bugünkü gibi; ücretsiz kalemin altında küçük "Ücretsiz kargo" notu.
- **Ödeme:** seçenekler sunucunun hesapladığı ücretle gelir; 0 olanlar "Ücretsiz" yazar (bugünkü gibi). Vitrin ücret hesaplamaz.
- Store API ürün yanıtına `shipping_class: { key, free, surcharge } | null` eklenir; sepet görünümü kalemin ürününden okur.

### 4. Panel

- **Ürün > Ürün verileri > Kargo sekmesi:** ölçülerin üstünde "Kargo sınıfı" seçimi: Standart / Ücretsiz kargo / mağazanın sınıfları. Altında tek satır açıklama ("Ücretsiz kargolu ürün kargo ücretine eklenmez." ya da "Siparişe {tutar} eklenir."). Formun parçasıdır, başlıktaki "Kaydet"le kaydedilir.
- **Ürün listesi:** toplu işlemde "Kargo sınıfı ata"; hızlı düzenlemede sütun (S-P1 işi gelince). Liste süzgecine "Kargo sınıfı".
- **Ayarlar > Kargo > "Kargo sınıfları" kartı:** yerinde düzenlenen satırlar (ad, ek ücret TL, kullanan ürün sayısı), pencere yok. "Ücretsiz kargo" ilk satır, kilitli. Kullanılan sınıfı silmek yerinde sorar: "12 ürün Standart'a döner." (uyarı, engel değil).
- **Kargo seçenekleri kartı:** değişmez; bir sınıf ya da ücretsiz ürün varsa altta tek satır bilgi: "Ücretsiz kargolu ürünler ve sınıf ek ücretleri bütün seçeneklere uygulanır."
- **İçe/dışa aktarma ve WooCommerce taşıma:** CSV sütunu "Kargo sınıfı" (ad ya da `free`). Woo'nun sınıfları adıyla bizim sınıfımıza eşlenir, ek ücret 0 gelir ve Notlar'a "ücretini Ayarlar > Kargo'da girin" düşer; Woo'da 0 maliyetli sınıf adında "ücretsiz/free" geçiyorsa `free`'ye eşlenir.
- Yetki: sınıf tanımı ayar yazabilen roller; ürünün sınıfı katalog rolleri. Denetim kaydı önce/sonra.

### 5. Akışlar ve JSON-LD

- `shippingRateOf` ve `shippingCost` aynı `shippingQuote`'u tek adetlik sepetle çağırır: ücretsiz ürün **0**, sınıflı ürün tablo + ek ücret, eşiği geçen ürün 0 (desi tablosunda da).
- Google/Meta `g:shipping` fiyatı 0, Akakçe "kargo ücretsiz"; JSON-LD `shippingDetails.shippingRate.value` "0.00". Böylece kart, ürün sayfası, akış ve sepet aynı şeyi söyler (Merchant Center ürün/ödeme uyuşmazlığı uyarısı çıkmaz).
- Meta açıklamanın `kargo_cümlesi`'i ücretsiz üründe "ücretsiz kargo" der.
- SEO advisor kuralı eklenmez.

### 6. Sipariş, iade, fatura

- Siparişte kargo tutarı Medusa'nın kargo yöntemindeki tutardır; ayrıca bir şey saklanmaz. BirFatura'ya 0 ya da hesaplanan tutar bugünkü gibi gider: **değişiklik yok**.
- Sipariş düzenleme (F7.12) kargoyu aynı hesapla yeniden fiyatlar. Kısmi iadede kargo iadesi kuralı değişmez (ayrı ADR'ye kalır).

### 7. Migration

- **DB:** `catalog-extension` modülüne `shipping_class` sütunu (`medusa db:generate catalog-extension`; adın benzersizliği birleştirmede kontrol edilir).
- **Ayar:** `shipping.shipping_classes` (platform ayarları, şema varsayılanı `[]`; migration yok).
- **Veri:** sabit ücretli seçenekleri hesaplanana çeviren tek seferlik, tekrarlanabilir iş (`scripts/` + workflow, telafili): her `flat` seçeneğin taban fiyatı `data.amount`'a yazılır, `price_type: calculated`, `manual` sağlayıcısındakiler `shop_shop`'a geçer; eşik kurallı 0 TL fiyatlar silinir. Bir kez daha çalıştırılırsa değişiklik bulmaz. Canlıya çıkıştan önce yapıldığı için yalnız geliştirme ve deneme mağazaları etkilenir.

### 8. Testler (kargo ve para: zorunlu)

- **Birim:** `shippingQuote` tablosu — hepsi ücretsiz (her tür), karışık (tablo/Geliver yalnız ücretli desi; sabit tam ücret), en yüksek ek ücret bir kez, eşik her türde 0 ve ek ücreti düşürür, eşik ücretsiz kalemleri sayar, kargosuz kalem sayılmaz, bilinmeyen/silinmiş sınıf Standart sayılır.
- **Sağlayıcılar:** Aras, Yurtiçi, Geliver ve `shop` `calculatePrice`'ı bağlamdaki sınıfla; Geliver'e hepsi ücretsizken çağrı gitmez.
- **HTTP entegrasyon:** sepet → seçenek listesi → yöntem ekle → tamamla: hepsi ücretsiz 0 TL; karışık sepet; eşik desi tablosunda; ücretsiz kargo kuponu + ek ücret; istemcinin gönderdiği `data` ile ücret değişmez (güvenlik); sınıf değişince sepet yenilemesi yeni ücreti alır; veri geçişi iki kez çalışınca aynı sonuç.
- **Panel:** Kargo sekmesinde sınıf seçip kaydetme, Ayarlar > Kargo sınıfları kartı (e2e; veriyi geri alır), toplu atama birimi.
- **Vitrin:** kart rozeti, ürün sayfası satırı, sepet notu ve çubuk (`views` birim testleri); görünüm kilidi değişmez.
- **Akış/JSON-LD:** `shippingCost`, `shippingRateOf` birim testleri.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Ürün alanı + bütün seçenekler bizim hesabımızla (seçilen)** | Tek koli, tek ücret; karışık sepet doğru; eşik desi tablosuna da uygulanır; vitrin, akış ve sepet aynı hesaptan | Sabit ücretli seçenekler hesaplanana çevrilir (tek seferlik veri işi); yeni küçük `shop` sağlayıcısı |
| Medusa kargo profilleri (sınıf = profil) | Medusa'nın kendi kavramı | Karışık sepette ödeme adımında **iki yöntem, iki ücret**; her seçenek her profil için kopyalanır; tek koli kuralına (kapıda ödeme tek koli, adr/0031) ters; "ücretsiz kargo" profiline yine 0 TL seçenek gerekir |
| Ürün alanı, yalnız hesaplanan seçeneklerde | Veri geçişi yok | Sabit ücretli mağazada ücretsiz ürün ücret öder; kart "ücretsiz" der, ödeme ücret alır |
| Kampanya (promosyon) ile | Ekran hazır | Medusa kuralı "sepette varsa" der, "hepsi" diyemez: ücretli ürünle birlikte alınan ücretsiz ürün bütün kargoyu bedava yapar; ek ücret ifade edilemez |
| Ücretsiz ürünü "kargo gerektirmez" yapmak | Kod az | Kolisi, etiketi, takibi olmaz; fiziksel ürün gönderilemez |
| `product.metadata` (migration yok) | Migration yok | Tipsiz, süzülemez, içe aktarmada ve akışlarda dağınık okunur; diğer ürün alanları `product_extension`'da |

## Sonuçlar

- Ücretsiz ve sınıflı ürün her seçenekte tutarlı fiyatlanır; desi tablosu ve Geliver kullanan mağazada eşik ilk kez gerçekten uygulanır (bugünkü açık).
- Mağaza, karışık sepette ücretsiz ürünün kargo payını üstlenir (gerçek koli büyüktür). Panel bunu Kargo sekmesindeki açıklamayla söyler.
- `syncFreeShippingWorkflow` ve aboneliği veri geçişinden sonra kalkar; adr/0024'ün eşik kısmı bu ADR'ye göre güncellenir.
- Medusa Admin'de seçenekler "hesaplanan" görünür (Medusa Admin'e ekran yazılmıyor, etkisi yok).
- PR sırası: (1) `shippingQuote` + kanca + hesaplanan sağlayıcılar + eşik açığı; (2) `shop` sağlayıcısı + sabit ücret geçişi; (3) ürün alanı, Ayarlar > Kargo sınıfları, Kargo sekmesi; (4) vitrin, akış, JSON-LD. Ödeme/kargo dokunduğu için her PR'da `security-reviewer` ve entegrasyon testleri.

## Sahibe sorular (önerilen cevapla)

1. **Karışık sepette ücretsiz ürünün desisi kargo ücretine sayılsın mı?** Öneri: **Hayır**, yalnız ücretli ürünler ücret belirler (WooCommerce gibi).
2. **Sabit ücretli kargoda bir ürün ücretsiz, biri ücretliyse?** Öneri: **Tam sabit ücret** alınır; ücret sipariş başınadır.
3. **Birden çok ek ücretli sınıf aynı sepette:** Öneri: **en yüksek ek ücret bir kez**; adet ya da sınıf başına toplanmaz.
4. **Kendi kargo sınıfları şimdi mi, yoksa yalnız "Ücretsiz kargo" mu?** Öneri: ikisi birlikte; sınıf yalnız **ek ücret** taşır (ayrı desi kuralı yok, desi tablosu zaten var).
5. **"X TL üzeri kargo bedava" desi tablosu ve Geliver seçeneklerine de uygulansın mı?** (Bugün uygulanmıyor, vitrin yine de "ücretsiz" diyor.) Öneri: **Evet**, her seçeneğe.
6. **Eşik hesabında ücretsiz ürünlerin tutarı sayılsın mı?** Öneri: **Evet**, sepetin bütün tutarı.
7. **Ürün sayfası ek ücreti açıkça yazsın mı ("kargoya 150 TL eklenir")?** Öneri: **Evet**, sürpriz ücret şikâyeti ve mesafeli satış bilgilendirmesi için.

## Sahibin cevapları (2026-11-26)

Sahip bütün sorularda önerilen cevabı kabul etti:

1. Karışık sepette ücretsiz ürünün desisi kargo ücretine **sayılmaz**; ücreti yalnız ücretli ürünler belirler.
2. Sabit ücretli kargoda karışık sepet **tam sabit ücret** öder (ücret sipariş başınadır).
3. Birden çok ek ücretli sınıf: **en yüksek ek ücret siparişe bir kez** eklenir.
4. Mağazanın kendi sınıfları **şimdi** gelir; sınıf yalnız **ek ücret** taşır.
5. "X TL üzeri kargo bedava" **her seçeneğe** uygulanır: desi tablosu ve Geliver dahil.
6. Eşik hesabı ücretsiz ürünlerin tutarını da **sayar** (sepetin bütün tutarı).
7. Ürün sayfası ek ücreti **açıkça yazar** ("Bu ürün için kargoya {tutar} eklenir.").

**Uygulama sırası:** bugünkü açık (eşiğin desi tablosu ve Geliver'de uygulanmaması; akış ve JSON-LD'nin eşiği yok sayması) ilk ve küçük PR olarak kapatılır: `lib/shipping/quote.ts` (`shippingQuote`), `setCalculatedShippingPricingContext` kancası (`listShippingOptionsForCartWithPricingWorkflow` ve tek seçenek fiyatı için `calculateShippingOptionsPricesWorkflow`; ikincisinin sepet alanlarında `item_total` yoktur, kanca onu kendisi okur), Aras/Yurtiçi/Geliver sağlayıcıları, ödeme sonundaki "kargo bayatladı" denetiminin ücretsiz hesaplanan yöntemleri de yeniden fiyatlaması, `shippingRateOf` ve `shippingCost`. Ardından §Sonuçlar'daki sıra.

## Ek (2026-11-26): panelde sadeleşme, "Kargo ücreti" tek soru

Sahip (#450 sonrası): "Kargo sınıflarına gerek var mı? O kilitli satır ne işe yarıyor anlamadım. Basit bir ekranda tümü ücretsiz / X üstü ücretsiz / sabit ücret olur." Hesap (§2, `shippingQuote`) ve veri (§1) **değişmez**; yalnız panelin sorusu değişir (docs/06):

- **Ayarlar > Kargo > Seçenekler ve ücretler** tek soruyla başlar: "Tüm siparişlerde kargo ücretsiz" / "Belli tutarın üstünde ücretsiz" / "Sabit ücret" / "Kargo firmasının ücreti". Cevap saklanana yazılır: mağazanın **ana seçeneğinin** ücreti (sabit tutar `data.amount`, ya da tablo/teklif) ve `promotions.free_shipping_threshold`. Ana seçenek `shipping.primary_option_id`'dir (platform ayarı, migration yok; yoksa en ucuz sabit ücretli seçenek). "Ücretsiz" eşiği 0 yapmaz, ana seçeneğin tutarını 0 yapar ve eşiği kaldırır: eşik bütün seçeneklere uygulanır (§2.5) ve vitrin "X TL üzeri" der. Tek cevaba sığmayan veri "Özel" görünür ve liste düzenler. Ödemede fiyat yine sunucudadır; istemci tutar göndermez, yalnız mağaza sahibinin ayarını kaydeder.
- Diğer seçenekler "Ek kargo seçenekleri" altında katlanır; ayrı eşik kartı kalkar.
- **Kargo sınıfları** kartı Gelişmiş'e iner; hazır "Ücretsiz kargo" sınıfı orada kilitli satır olarak çizilmez. Ürünün Kargo sekmesinde §4'teki sınıf seçimi yerine **"Bu ürünün kargosu ücretsiz"** anahtarı gelir (açık = `free`); küçük sınıf seçimi yalnız mağaza kendi sınıfını tanımladıysa ve anahtar kapalıyken görünür.
