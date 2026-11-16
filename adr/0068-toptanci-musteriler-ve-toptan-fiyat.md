# ADR-0068: Toptancı müşteriler ve toptan fiyat

- **Durum:** Kabul (sahip, 2026-11-15). Açık soruların önerilen varsayılanları sahip tarafından onaylandı ("önerilerin uygundur"); yalnız yasal ve mali konu (Açık sorular 10) danışman görene kadar açık ve işaretli. Ek 2026-11-15: öncelik kapısının sonucu (özel satırlarda grup fiyat kuralı; karar 11 değişti, seviye listesi `override`).
- **Tarih:** 2026-11-15
- **İlgili:** adr/0007 (KDV modeli, KDV dahil fiyat), adr/0009 (vergi kimliği), adr/0010 (para ve yuvarlama), adr/0011 (denetim kaydı), adr/0012 (özellik bayrakları), adr/0023 (fiyat geçmişi, 30 gün kuralı), adr/0024 (kupon ve kampanya kuralları), adr/0037 §6 (segmentler), adr/0040 (roller), adr/0041 (yasal metinler), adr/0042 G6 (hesap daveti), adr/0046 (vitrin, Store API çağrıları), adr/0050 (toplu kampanya), adr/0051 (ödeme bağlantısı), adr/0056 (arama dizini), adr/0061 §5.5 (paket koruması), adr/0066 (tema katmanları), docs/13 (JSON-LD, akışlar), `docs/kvkk-envanter.md`, docs/20 (B2B → F19), PROGRESS D14 (teklif isteme)
- **Dayanak:** sahip (2026-11-15): "müşteri tarafında sahip veya yöneticiler yeni müşteri oluşturabilecek; bu oluşturduğu müşteri Toptancı olabilir; toptancı müşterisi oluştururken mağazadaki tüm ürünlerin / tekil ürünlerin fiyatlarını güncelleyebilecek ve bunları yalnızca o mail ile giren toptancı görecek; perakende fiyatlardan ziyade toptancıya o toptan fiyatlarla alışveriş yapabilmesini sağlayacak."

## Bağlam

### Sahibin kararları (2026-11-15)

1. **Fiyat modeli:** toptan **seviyeleri** (her biri bir müşteri grubu ve bir fiyat listesi, ör. "Toptan A/B": bütün ürünlerde yüzde indirim ve/veya ürün başına fiyat) ile **toptancıya özel** fiyatlar (tek bir toptancının listesi; teknik olarak tek üyeli gizli bir grup) birlikte. Öncelik: toptancıya özel > seviye > perakende. (Sahip "seviye" ne demek diye sordu; açıklandı, ikisi birlikte varsayılan seçildi; sahip değiştirebilir.)
2. Toptancı **yalnız panelden** açılır (sahip ve yönetici rolü). İlk sürümde vitrinde başvuru formu yok.
3. Toptancı fiyatları **KDV hariç** görür; KDV ödeme adımında ayrı satır olarak eklenir; tahsil edilen tutar değişmez. (Mali müşavire sorulacak: Açık sorular 10.)
4. En az sipariş **adet** olarak (tutar değil). Ödeme yöntemi kısıtı yok.
5. Acele yok; F16 canlıya çıkıştan bağımsız.
6. Toptancı için fatura profili **zorunlu değil**.

### Sahibin onayladığı varsayılanlar (2026-11-15, "önerilerin uygundur")

Öneri sürümündeki açık sorular 1–9, 11 ve 12 önerilen varsayılanlarla karara bağlandı:

7. **Seviye ve toptancıya özel fiyat birlikte** (karar 1 aynen; dilim 1a ikisini de kurar).
8. **En az adet** ilk sürümde **sipariş başına toplam adet** (toptancı ya da seviye düzeyinde); ürün başına en az adet sonraki sürümde (§8, §11).
9. Toptan fiyat **KDV hariç girilir**; KDV dahil karşılığı yanında bilgi olarak gösterilir (§4).
10. **Otomatik kampanyalar toptancıya uygulanmaz**; kargo bedava eşiği kampanya değildir, uygulanır (§6).
11. ~~Herkese açık bir indirim seviye fiyatından düşükse toptancı düşük olanı alır.~~ **Değişti (Ek 2026-11-15):** toptancı **her zaman toptan fiyatı** öder (özel > seviye); herkese açık indirimler toptancıya yansımaz. Seviye listesi `override` olur (§2).
12. Toptancıya listede **fiyat süzgeci gösterilmez**; sıralama perakende sırasıyladır (§7).
13. Kabul edilmeyen davet **90 gün** sonra silinir; yeniden gönderilebilir (§10).
14. Özellik **mağaza bayrağıdır**: `customers.wholesale` (`owner: tenant`), kapalı başlar; F17'de pakete bağlanabilir (§9).
15. Toptancı **seviye adını görmez**; vitrinde yalnız "Toptan fiyat · KDV hariç" (§7).
16. **Toplu kampanya e-postası ve sepet hatırlatması toptancılara gitmez** (kampanya kitlesinde varsayılan hariç); işlemsel iletiler (sipariş, kargo) değişmez.
17. Toptancıları **yalnız sahip ve yönetici** görür; operations siparişleri görür, toptancı listesini ve fiyatlarını görmez (§3, §9).

### Elimizde olan (kod, 2026-11-15 `dev`)

- **Fiyat listeleri (F4.1):** panel `apps/panel/src/features/price-lists/` (müşteri grubu kuralı `customer.groups.id`, `form.ts` `GROUPS_RULE`; yüzde indirim penceresi `components/discount-dialog.tsx`; satırlar `components/price-lines-card.tsx`). Backend `POST /admin/price-lists/:id/discount` (`apps/backend/src/api/admin/price-lists/[id]/discount/`, en çok 500 ürün, yüzde 0,01–99) → `workflows/pricing/discount-price-list.ts` (`batchPriceListPricesWorkflow`, kuruşa yarım-yukarı yuvarlama, `lib/money` `multiplyByRateBps`); `GET /admin/price-lists/:id/lines` (`workflows/pricing/price-list-lines.ts`). Katalog yazıcıları liste fiyatlarına dokunmaz (`workflows/catalog/prices.ts`).
- **Müşteri grupları ve segmentler:** panel `features/customers/pages/customer-groups-page.tsx`; segment modülü `modules/customer-segments` kendi Medusa grubunu `customer_group_id` metin sütunuyla tutar ve günlük doldurur (adr/0037 §6). Bu, "modül bir Medusa grubunun sahibidir" emsalidir.
- **Panelden müşteri:** `features/customers/customer-form.ts` (ad, e-posta, telefon, `company_name`, not) elle misafir kaydı açar (`POST /admin/customers`, `lib/staff/permission-rules.ts` `OPERATIONS_WRITES`). Şifre panelde yazılmaz.
- **Hesap daveti emsali (adr/0042 G6):** davet vitrinin kayıt sayfasına gider (`/hesap/kayit?email=`), e-posta kayıtta doğrulanır; şablon `lib/messaging/templates/account.ts` (`account.migration_invite`). Girişte sahiplenme `api/http/account-routes.ts` içinde `GET /store/customers/me` ara katmanında (`attachGuestOrders`, `workflows/orders/attach-guest-orders.ts`): yalnız doğrulanmış giriş e-postası, aynı adresli `has_account=false` kayıtlar. Aynı e-postayla misafir ve hesap kaydı birlikte durabilir.
- **Fatura profili:** `modules/billing-profile` (bireysel/kurumsal, vergi dairesi, VKN/TCKN şifreli, adr/0009); vitrinde `POST /store/customers/me/billing-profile`.
- **Fiyatın sunucuda hesabı ve gösterimi:** `workflows/pricing/selling-prices.ts` **müşteri grubu olmadan** satış fiyatı okur; `workflows/pricing/price-display.ts` buna fiyat geçmişini ve otomatik kampanyaları ekler (adr/0023). `GET /store/price-display` (`api/store/price-display/route.ts`) `Cache-Control: public, max-age=60` ile döner. `GET /store/card-facts` `no-store`.
- **Vitrin:** her sayfa isteğe göre çizilir (`app/layout.tsx` `dynamic = "force-dynamic"`), Store API çağrıları Next'te önbelleğe girmez (`lib/store-api/core.ts`). Oturum açık müşterinin anahtarı `storeGet` ile her çağrıya eklenir (`lib/store-api/server.ts` `visit()`, `lib/account/session.ts`). **Paylaşılan önbellek** `storePublicGet` / `shared.ts` yalnız anahtarsız çağrılar içindir; yenileme sözleşmesi `lib/refresh/contract.ts` bu yolları düşürür. Fiyat gösterimi tek bir boğazdan geçer: `lib/store-api/requests.ts` `priceDisplays()`; çağıranlar ürün, liste, raflar (`lib/views/section-data.ts`), hızlı bakış (`app/api/quick-view`), canlı arama (`app/api/search/suggest`), sepet ekleri, analitik. `lib/views/price.ts` `shownAmount()` önce bu gösterimi, yoksa Medusa'nın `calculated_price`'ını kullanır: bugün oturum açık bir grup üyesi bile **perakende** görür.
- **Herkese açık fiyat okuyanlar (hepsi grupsuz bağlam):** arama dizini `workflows/search/prices.ts` (belge başına `prices`, `modules/search-index/types.ts`; sıralama ve fiyat süzgeci `sql/listing.ts`), akışlar `workflows/marketing/feed-catalog.ts`, JSON-LD `workflows/seo/payload.ts`, ana sayfa rafları `workflows/storefront/rails.ts`, toplu kampanya e-postası `workflows/campaigns/prepare.ts`.
- **Sepet:** sipariş tamamlama kancası `workflows/hooks/complete-cart-validate.ts` (tek kod kuralı, ödeme tutarı tutarlılığı, yasal onay); ödeme öncesi koruma `api/http/checkout-guard.ts`.
- **Kampanyalar:** otomatik kampanyalar fiyatın parçası gösterilir (`workflows/pricing/automatic-offers.ts`, adr/0023 Ek 2026-11-05); kupon kuralları adr/0024 (sepette en çok bir kod).
- **Roller:** `lib/staff/permission-rules.ts`: `OWNER_ONLY`, `PRIVATE` (operations ve readonly okuyamaz), `OPERATIONS_WRITES`; yazılmayan yazma operations/readonly için kapalıdır.
- **Denetim:** `api/http/audit/registry.ts`, fiyat kaynakları `api/http/audit/resources/prices.ts` (liste kuralı `rule:customer.groups.id` dahil).
- **Paket koruması:** `api/http/plan-guard.ts` (kısıtlı/askıdaki mağazada izin listesi dışındaki panel yazmaları 403), Store yazma envanteri `lib/plan-guard/__tests__/store-writes.unit.spec.ts`.
- **Özellik bayrakları:** `modules/platform-settings/features.ts` (`owner: tenant | platform`).
- **Hız sınırı profilleri:** `lib/security/rate-limit/profiles.ts` (`store_default`, `listing`, `coupon`…).

### Medusa 2.21.2 (Context7 `/medusajs/medusa`, 2026-11-15)

- `GET /store/products` ara katmanları `authenticate("customer", ["session","bearer"], { allowUnauthenticated: true })` → `setPricingContext()` → `setTaxContext()`: oturum açık müşterinin grupları fiyat bağlamına kendiliğinden girer; `region_id` + `country_code` verilirse `calculated_amount_with_tax` / `calculated_amount_without_tax` gelir.
- Sepet satırı fiyatı sepetin bağlamından hesaplanır: `customer_id`, `customer` (gruplarıyla, `cartFieldsForPricingContext`), bölge, para birimi, adet (`update-line-item-in-cart` workflow'u). Yani sepet müşteriye bağlıysa satırlar grup fiyatıyla gelir; birim fiyatı biz yazmayız.
- Fiyat listesi kuralı `customer.groups.id`; Medusa'nın kendi B2B deseni "grup başına bir liste" (pricing modülü entegrasyon testi).
- `calculatePrices`: tek SQL; satırlar "önce fiyat listesi fiyatları, sonra kuralı çok olan (fiyatın kuralları + listenin kuralları), sonra en düşük tutar" sırasıyla gelir. Fiyat seti başına **yalnız ilk liste satırı** değerlendirilir: `override` ise kazanır; `sale` ise yalnız varsayılan fiyattan düşükse kullanılır (Ek 2026-11-15, ölçüldü). `original_amount` override varsa o, yoksa varsayılan fiyattır. KDV dahil olma `PricePreference`'tan (bölge ya da para birimi) gelir.
- Promosyon kuralları `customer.groups.id` üzerinde `in` / `eq` ile kurulur. Bir grubu **dışlayan** kuralın 2.21.2'de nasıl davrandığı belgelerde açık değil (Uygulama sırası, dilim 4).
- Context7 belgeleri `develop` dalını anlatır; aşağıdaki öncelik kuralı 2.21.2'de entegrasyon testiyle kanıtlanmadan dilim 1 kapanmaz.

### Asıl risk

Bugünkü vitrin "fiyat herkes için aynıdır" varsayımıyla hızlıdır: `/store/price-display` herkese açık önbelleklenir, dizin tek fiyat tutar, akış ve JSON-LD aynı kaynaktan beslenir. Toptan fiyat bu yollardan birine sızarsa perakende müşteriye, Google'a ya da başka bir toptancıya görünür. Karar bu yüzden toptan fiyatı **ayrı ve kişisel bir yoldan** taşır; herkese açık yollar hiç değişmez.

## Karar

### 1. Kavramlar ve veri modeli

- **Toptan seviyesi** (`wholesale_tier`): ad (ör. "Toptan A"), bir Medusa müşteri grubu, bir Medusa fiyat listesi (`override` türü, kuralı `customer.groups.id = [seviyenin grubu]`; Ek 2026-11-15), isteğe bağlı genel indirim oranı (`rate_bps`; boş: yalnız tekil fiyatlar), isteğe bağlı en az adet.
- **Toptancı hesabı** (`wholesale_account`): bir müşteriye bağlı toptan kaydı; seviye (isteğe bağlı), isteğe bağlı **özel liste** (tek üyeli gizli grup + `override` türü liste, kuralı `customer.groups.id = [gizli grup]`; listenin her satırı ayrıca aynı grubu fiyat kuralı olarak taşır, Ek 2026-11-15), isteğe bağlı özel indirim oranı, isteğe bağlı en az adet (seviyeninkini ezer), durum `pending | active | inactive`, davet/etkinleşme/kapanma zamanları ve işlemi yapan personel.
- **Elle fiyat işareti** (`wholesale_manual_price`): bir listede elle girilmiş satırı (liste, varyant, girilen **KDV hariç** tutar) oran satırlarından ayırır. Oranla üretilen satırlar taban fiyat değişince yeniden hesaplanır; elle girilenler değişmez.
- **Yeni modül `wholesale`** (`apps/backend/src/modules/wholesale`, migration yalnız bu modülde). `customer` metadata'sı **kullanılmaz**: durum, seviye ve liste ilişkisi sorgulanabilir, indekslenebilir ve denetlenebilir olmalı. Segmentlerdeki gibi Medusa grup ve liste kimlikleri metin sütunlarında tutulur; toptancı ↔ müşteri için modül bağlantısı (`src/links/wholesale-account-customer.ts`) panel listelerinin sorgusu içindir.
- **Medusa çekirdeğinde kalan:** müşteri, müşteri grubu, fiyat listesi ve fiyatları, fiyat hesabı, sepet, KDV. **Bizim olan:** seviye/hesap kayıtları, oranla toplu üretim ve eşitleme, davet ve sahiplenme, korumalar, kişisel fiyat ucu, en az adet ve kupon kuralı.
- Pending hesap yalnız e-posta (küçük harf), firma adı ve karşılama için yetkili adı tutar. Etkinleşince bunlar müşteri kaydına (`first_name`, `last_name`, `company_name`, boşsa) taşınır ve hesaptaki e-posta silinir; tek kaynak müşteri kaydıdır.
- Vergi dairesi ve numarası **bu modülde tutulmaz**. Formda isteğe bağlıdır; müşteri hesabı varsa mevcut fatura profiline (kurumsal, VKN şifreli, adr/0009) yazılır, yoksa toptancı davetten sonra vitrinde kendisi girer ya da yetkili sonradan ekler. Fatura profili zorunlu değildir (karar 6).

### 2. Fiyat önceliği Medusa'da nasıl kurulur

| Katman | Liste türü | Kural | Sonuç |
| --- | --- | --- | --- |
| Toptancıya özel | `override` | liste: gizli tek üyeli grup; **her satır: aynı grup fiyat kuralı** (2 kural) | Varsa her zaman kazanır (perakende ve seviyeden yüksek olsa bile) |
| Seviye | `override` | liste: seviyenin grubu (1 kural) | Her zaman uygulanır; herkese açık indirim ve listeler toptancıya yansımaz |
| Perakende | (liste yok) | — | Varsayılan fiyat |

- Bu kurgu Medusa'nın sıralamasına dayanır (Ek 2026-11-15): liste satırları önce, sonra kural sayısı çok olan (fiyat + liste), sonra düşük tutar; **ilk satır karar verir**. Özel satır 2 kuralla seviyenin (1) ve herkese açık listelerin (0) önüne geçer; seviye satırı herkese açık listelerin önüne geçer. İki ayrı listenin "eşitliğini" Medusa'ya bırakmayız.
- Toptancı aynı anda **en çok bir seviyede** ve en çok bir özel listededir. Seviye değişince gizli grup aynı kalır, yalnız seviye grubu üyeliği değişir.
- Yan etkiler (bilerek kabul, Ek 2026-11-15): (a) herkese açık bir indirim (sale ya da override) perakendeyi toptan fiyatın altına indirse de toptancı toptan fiyatı öder; panel bu satırları **uyarı** olarak gösterir, engellemez; (b) toptan fiyat perakendeden yüksek girilse de uygulanır, panel aynı uyarıyı gösterir; (c) toptancının da bulunduğu bir segmente (tek kurallı grup listesi) verilen liste seviyeyle eşit kurallıdır, ucuz olan önce gelir: panel uyarır, segmentler toptancıları dışarıda bırakmalıdır (dilim 1b).
- **Kabul ölçütü:** HTTP entegrasyon testi (`integration-tests/http/wholesale-precedence.spec.ts`) 2.21.2'de: yalnız seviye; seviye + özel (özel kazanır, pahalı da ucuz da olsa); herkese açık sale ve override + seviye (seviye kazanır, misafir perakende/indirimli öder). Ölçüm sonuçları Ek 2026-11-15'te.

### 3. Toptancı açma akışı

- **Panel:** Müşteriler > "Yeni müşteri" penceresinde tür seçimi **Bireysel / Toptancı**. Bireysel bugünkü akıştır. Toptancı alanları: e-posta (zorunlu), firma adı (zorunlu), yetkili adı soyadı, telefon, vergi dairesi ve numarası (isteğe bağlı), seviye ve/veya "bu toptancıya özel fiyat" (açılınca oran ve tekil fiyatlar toptancının sayfasında girilir), en az adet (isteğe bağlı). Şifre alanı yoktur.
- **Workflow** `createWholesaleAccountWorkflow` (adımlar telafili):
  1. E-postayı küçük harfe çevir; bu e-postada etkin/pending toptancı varsa 409 `wholesale.exists`.
  2. Hesap kaydını yaz (telafi: sil).
  3. E-postada `has_account=true` müşteri **varsa**: hesaba bağla, seviye grubuna ekle (telafi: çıkar), durum `active`.
  4. Özel fiyat istendiyse gizli grubu ve `override` listeyi aç, müşteri varsa gruba ekle (telafi: liste ve grubu sil).
  5. Son adım ileti: müşteri varsa `account.wholesale_enabled` ("Toptan hesabınız açıldı", giriş bağlantısı); yoksa `account.wholesale_invite` (vitrinin kayıt sayfası `/hesap/kayit?email=`, adr/0042 G6 gibi). İleti kuyruğa yazılır; gönderilemezse iş geri alınmaz, panelde "Daveti yeniden gönder" vardır.
- **Sahiplenme:** toptancı kayıt olup e-postasını doğruladığında ya da sosyal girişle geldiğinde, `GET /store/customers/me` ara katmanı (`attachGuestOrders`'ın yanında, aynı kanıtla: doğrulanmış giriş e-postası) pending hesabı bulur, müşteriye bağlar, gruplara ekler, `active` yapar. Tekrar çalışması zararsızdır. Yeni Store yazma ucu açılmaz.
- E-posta yalnız misafir kaydında (`has_account=false`) varsa hesap pending kalır; misafir kaydı gruba eklenmez (fiyat yalnız giriş yapmış hesaba).
- **Kapatma** (`deactivateWholesaleAccountWorkflow`): durum `inactive`, seviye ve gizli grup üyeliği hemen kaldırılır (liste ve elle fiyatlar yeniden açılış için kalır), müşterinin açık sepetleri yeniden fiyatlanır. Müşteri bir sonraki istekte perakende görür. İleti gönderilmez. Yeniden açma üyelikleri geri ekler.
- **Silme:** pending hesap silinebilir. Etkin ya da kapalı hesap silinmez, kapatılır; kayıt müşterinin KVKK silme akışıyla gider (§10).
- **Roller:** yalnız sahip ve yönetici (`/admin/wholesale*` `PRIVATE`'a eklenir: operations ve readonly okumaz da). Operations siparişleri yine görür.
- **Denetim:** hesap aç/değiştir/kapat/yeniden aç, davet yeniden gönderme, seviye aç/değiştir, oran değişikliği, elle fiyat yazma ve silme yeni denetim kaynağıyla (`api/http/audit/resources/wholesale.ts`) önce/sonra yazılır. Vergi numarası denetime girmez.

### 4. Toptan fiyatın düzenlenmesi

- **Bütün ürünlere yüzde:** seviyede ya da özel listede `rate_bps`. Medusa fiyat listesi oran tutmaz, varyant başına fiyat ister; oran bu yüzden **üretilir**: listeye her TRY taban fiyatlı varyant için `taban × (1 − oran)` satırı, kuruşa yarım-yukarı (`lib/money`, `discount-price-list.ts` ile aynı hesap). Oran KDV'den bağımsızdır (dahil fiyatın yüzdesi = hariç fiyatın yüzdesi).
- **Toplu üretim** bir arka plan işi (`async-job`, `wholesale.sync`) ile 500'lük parçalarla `batchPriceListPricesWorkflow`'a gider; panel ilerlemeyi gösterir.
- **Eşitleme:** taban fiyat değişince (adr/0023'ün kullandığı `pricing.price.*` olayları) ve yeni varyant açılınca (`workflows/hooks/product-variants-created.ts`) oranlı listelerin yalnız oran satırları yeniden hesaplanır; gece tam eşitleme işi kaçanı düzeltir. Elle satırlar hiç değişmez.
- **Tekil ürün:** toptancının/seviyenin sayfasında ürün arayıcı (`SearchPicker` deseni) ile varyant başına fiyat. Giriş **KDV hariç**; sunucu varyantın KDV oranıyla (ürün tipi = KDV grubu, adr/0007) dahil fiyatı hesaplar, kuruşa yuvarlar ve listeye yazar; girilen hariç tutar işarette saklanır. Tek birimde hariç → dahil → hariç dönüşü her zaman aynı kuruşa döner (dahil fiyatın yuvarlama hatası ≤ 0,005, bölünürken küçülür). Ürünün KDV oranı değişirse elle satırların dahil fiyatı işaretteki hariç tutardan yeniden hesaplanır.
- Panelde iki sütun: "KDV hariç" (girilen) ve "KDV dahil" (bilgi). Varsayılan fiyat listesi ekranı (`features/price-lists`) toptan listelerini **listelemez**; onlar yalnız toptan ekranlarından düzenlenir.
- Fiyat istemciden kabul edilmez: panelin gönderdiği tutar personelin girdisidir, sepet ve vitrin hiçbir tutar göndermez.

### 5. KDV hariç gösterim

- Mağaza KDV dahil çalışmaya devam eder (adr/0007; `PricePreference`). Toptancıya gösterilen birim fiyat Medusa'nın `calculated_amount_without_tax` değeridir; "KDV hariç" notuyla.
- Sepet ve ödeme özetinde toptancıya: ara toplam (KDV hariç, Medusa `subtotal`), KDV (Medusa `tax_total`), toplam. Tutarlar Medusa'nındır; yeni hesap yazılmaz. Satırların hariç birim fiyatlarının toplamı sepetin hariç toplamından kuruş kadar ayrılabilir; geçerli olan sepettir.
- Tahsil edilen tutar, fatura ve sipariş kayıtları değişmez. Perakende müşteri bugünkü gibi KDV dahil görür.

### 6. Kampanyalar, kuponlar, indirimli fiyat gösterimi

- **Kupon:** toptancı sepetinde kod kabul edilmez (varsayılan). Store'daki kod yolu (`api/http/promotion-routes.ts`, `/store/carts` altında `oneCodePerCart`'ın yanında) `promotions.wholesale_no_code` ile reddeder; tamamlama kancası da kodlu toptancı sepetini reddeder.
- **Otomatik kampanyalar:** toptancıya uygulanmaz (varsayılan). Mekanizma dilim 4'te seçildi: promosyon bağlamı kancası (Ek 2026-11-16).
- **Kargo bedava eşiği** (adr/0024, kargo seçeneği fiyat kuralı) promosyon değildir; toptancıya da uygulanır.
- **İndirimden önceki fiyat (Fiyat Etiketi Yön., adr/0023):** toptancı tacirdir; ona üstü çizili fiyat, "%X indirim" rozeti ve 30 gün bilgisi gösterilmez. Tek fiyat ve "KDV hariç" notu. Perakende fiyat "karşılaştırma" olarak da gösterilmez.
- Hediye kartı ve mağaza kredisi toptancıya da açıktır (değişiklik yok).

### 7. Vitrin ve önbellek

**Kural: toptan fiyat hiçbir paylaşılan ya da herkese açık yola girmez.**

- **Herkese açık yollar değişmez:** `/store/price-display` (grupsuz, `public, max-age=60`), arama dizini fiyatı, akışlar, site haritası, JSON-LD, raflar, kampanya e-postası. Hepsi bugün olduğu gibi müşteri bağlamı olmadan okur. Birim test: bu okuyucular (`selling-prices.ts`, `search/prices.ts`) bağlama müşteri koymaz. Entegrasyon testi: toptan listesi varken herkese açık uçlar perakende döner.
- **Yeni kişisel uçlar** (oturum zorunlu, `Cache-Control: private, no-store`, müşteri yalnız `auth_context`'ten, sorgudan kimlik alınmaz):
  - `GET /store/customers/me/wholesale`: `{ active, min_quantity, vat_exclusive }`. Seviye adı ve grup kimliği dönmez.
  - `GET /store/customers/me/wholesale-prices?variant_id=` (en çok 100): her görünür varyant için `{ net, gross, vat_rate }`. Etkin toptancı değilse boş. Fiyat sunucuda, müşterinin gruplarıyla Medusa'dan hesaplanır; görünürlük `shopperVariantIds` ile aynı. Hız sınırı `store_default` + yeni müşteri başı profil `wholesale_prices`.
- **Vitrin tek boğaz:** `lib/store-api/requests.ts` `priceDisplays()` oturumdaki müşteri toptancıysa (istek ömürlü React `cache` ile bir kez `/me/wholesale`) kişisel uçtan okur ve gösterimi `current = net`, `before = null`, `cart_offer = null`, "KDV hariç" işaretiyle kurar. Ürün, liste, raflar, hızlı bakış, canlı arama ve sepet ekleri böylece ek iş istemeden toptan fiyatı gösterir. Bu çağrılar `storeGet` iledir; `storePublicGet` / `shared.ts`'e hiç girmez (birim test: kişisel uçlar paylaşılan önbelleğin yol listesinde yok). Sayfalar zaten isteğe göre çizilir; yeni önbellek eklenmez.
- **Ürün sayfasının JSON-LD'si** toptancıya da perakende kalır (backend `seo/payload.ts`); botlar giriş yapmaz, kaynak tek kalır.
- **Liste sıralama ve fiyat süzgeci:** dizin yalnız perakende fiyat tutar. Toptancı için sıralama perakende sırasıyla yapılır (tek oranlı seviyede sıra aynıdır; elle fiyatlarda kayabilir). Fiyat aralığı süzgeci toptancıya **gösterilmez** (sınırlar yanıltıcı olurdu). Toptan fiyatı dizine koymak reddedildi (Alternatifler).
- **Sepet ve ödeme:** Medusa sepetin müşterisinin gruplarıyla fiyatlar. Giriş yapınca misafir sepetinin müşteriye aktarılmasında satırların yeniden fiyatlandığı dilim 3'te doğrulanır; değilse aktarımdan sonra sepet yenilenir. Kapanan toptancının açık sepeti yenilenir; tamamlama kancası ayrıca, müşterinin artık ait olmadığı bir toptan listesinden fiyatlanmış satırı olan sepeti `wholesale.prices_changed` ile reddeder (savunma katmanı).
- **Analitik:** olaylar gösterilen ve ödenen tutarı taşır; ek iş yok.
- **Ödeme bağlantısı (adr/0051):** ilk sürümde toptan fiyat okumaz; personel tutarı bugünkü gibi belirler.

### 8. En az adet kuralı

- **İlk sürüm:** sipariş başına en az **toplam adet** (sepetteki ürün satırlarının adetleri toplamı; ek seçenek ve hediye paketi satırları sayılmaz). Geçerli değer: toptancının kendi değeri, yoksa seviyeninki, yoksa kural yok.
- **Ürün başına en az adet** sonraya bırakılır (karar 8); veri modeli işaret tablosuna ya da seviyeye yeni alanla eklenebilir.
- **Gösterim:** sepet sayfası `/me/wholesale`'deki değerle "Toptan siparişte en az {n} adet gerekir; sepetinizde {m} adet var." der, ödemeye geç düğmesini kapatır.
- **Sunucu:** ödeme başlamadan (`POST /store/carts/:id/payment-session`, `checkout-guard.ts`) ve tamamlamada (`complete-cart-validate.ts`) `wholesale.min_quantity` (`ValidationError`, `{ field: "items" }`) ile reddeder. Ödeme başladıktan sonra sepet değişirse mevcut `payments.cart_changed` kuralı geçerlidir; para alınıp siparişin reddedildiği bir yol kalmaz.

### 9. Güvenlik

- Yazma ve okuma yalnız sahip ve yönetici (`PRIVATE`). Yeni yeniden doğrulama yok (fiyat listeleriyle aynı düzey).
- **Medusa'nın yan yolları kapanır:** toptan modülüne ait grup ve listelere `/admin/customer-groups/:id*`, `/admin/price-lists/:id*` ve Medusa'nın müşteriyi gruba bağlayan öbür uçları (dilim 1a'da Context7 ile listelenir) üzerinden yazma `wholesale.managed` (409) ile reddedilir; yoksa biri müşteriyi davetsiz ve denetimsiz toptan grubuna ekleyebilirdi. Bu uçların okumaları da toptan kayıtlarını listelemez.
- **IDOR:** toptan uçları yalnız hesap/seviye kimliği alır; liste ve grup kimlikleri modülden çözülür, istemciden alınmaz. Store uçları müşteriyi yalnız oturumdan alır. `/store/customers/me` yanıtında `groups` alanının dönmediği testle kilitlenir.
- Bir toptancı başkasının fiyatını göremez: gizli grup tek üyelidir, kişisel uç yalnız oturumun müşterisini fiyatlar.
- **Paket koruması:** yeni panel yazmaları izin listesine girmez (kısıtlı/askıdaki mağazada satış ayarı değiştirilmez); **kapatma** izin listesine girer (erişim almak, adr/0061 §5.5). Store tarafında yeni yazma ucu yok, `store-writes.unit.spec.ts` değişmez; ileride eklenirse sahiplenme `open` sınıfındadır.
- **Özellik bayrağı:** `customers.wholesale` (`owner: tenant`, varsayılan kapalı). Kapalıyken panel ekranı görünmez, uçlar 404; var olan toptancılar perakendeye düşer (gruplar korunur, açılınca döner).
- Güvenlik incelemesi: dilim 1, 3 ve 4 (`/guvenlik-review` + diğer geliştirici; CLAUDE.md "Ortak çalışma").

### 10. KVKK

- **Yeni veri:** `wholesale_account`: pending iken e-posta, firma adı, yetkili adı (K); toptancı olma bilgisi, seviye, durum, zamanlar, işlemi yapan personel kimliği (D). Vergi kimliği yeni yerde tutulmaz (fatura profili). Amaç: toptan fiyatla satış (sözleşmenin kurulması ve ifası).
- **Saklama:** pending davet 90 gün kabul edilmezse silinir (yeniden gönderilebilir). Etkin/kapalı kayıt müşteri hesabı süresince. Müşteri silme akışı (`workflows/legal/erasure/customer.ts`) toptan kaydını, gizli grubu ve özel listeyi siler; siparişler bugünkü kurala tabidir.
- `docs/kvkk-envanter.md`'ye `wholesale_account` ve `wholesale_manual_price` (kişisel veri yok) satırları dilim 5'te eklenir.

### 11. Kapsam dışı (F19 "tam B2B") ve açık kapı

- Vadeli ödeme ve cari hesap, teklif isteme (RFQ, D14), çok kullanıcılı firma hesapları ve onaylı satın alma, kademeli adet fiyatı, ürün başına en az adet, vitrinde başvuru formu, yalnız toptancıya görünen ürünler, ödeme yöntemi kısıtı, çoklu para birimi.
- Kapılar: firma kavramı ileride hesabın üstüne `wholesale_company` olarak eklenir (hesap → firma bağı); kademeli fiyat Medusa fiyatının `min_quantity`/`max_quantity` alanlarıyla aynı listeye girer (bugün yalnız düz satır yazarız, `isPlainPrice`); başvuru formu pending hesap durumunu yeniden kullanır.

## Alternatifler

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| Seviye `override` + özel `override` listeler, özel satırlarda grup fiyat kuralı (bu ADR, Ek 2026-11-15) | Medusa'nın kendi seçim kuralı; sepet ve KDV çekirdekte | Herkese açık indirim toptancıya yansımaz (sahip istedi); oranlı liste üretilip eşitlenmeli | **Seçildi** (2.21.2 testiyle ölçüldü) |
| Tek grup, birleşik liste (seviye satırları + özel satırlar toptancının tek listesine kopyalanır) | Önceliği tamamen biz belirleriz | Seviye her değişince bütün üyelerin listeleri yeniden yazılır; satır sayısı katlanır | Yedek yol |
| Fiyatı çalışma anında hesaplamak (liste yerine oran kuralı, sepette `unit_price` ezmek) | Toplu üretim yok | Medusa'nın sepet fiyatını ezmek; her fiyat okuyan yerde kendi hesabımız; altın kural 2'ye ters | Reddedildi |
| Müşteri `metadata`'sında "toptancı" bayrağı | Migration yok | Sorgulanamaz, denetlenemez, kurallar dağınık | Reddedildi |
| Toptan fiyatı arama dizinine koymak (grup başına fiyat anahtarı) | Toptancıya doğru sıralama ve süzgeç | Gizli fiyat herkese açık belgeye girer; dizin boyu toptancı sayısıyla büyür | Reddedildi |
| Toptan fiyatı `/store/price-display`'e eklemek (oturum varsa) | Tek uç | Herkese açık önbellekli uçta kişisel yanıt; sızıntı riski | Reddedildi |
| Panelde şifre belirleyip toptancıya iletmek | Hızlı | Şifre personelin elinden geçer; adr/0043'e ters | Reddedildi |

## Sonuçlar

- Toptancı yalnız kendi oturumunda toptan fiyat görür; perakende müşteri, botlar, akışlar ve başka toptancılar perakende görür. Herkese açık önbellek ve dizin aynı kalır.
- Toptancı için liste sıralaması perakende sırasıdır ve fiyat süzgeci yoktur (bilerek kabul edilen sınır).
- Oranlı her liste katalog büyüklüğünde satır taşır (ör. 5.000 varyant × 20 liste = 100.000 satır). Özel oranlı liste toptancı başınadır; çok toptancılı mağazada seviye + az sayıda elle satır önerilir, panel bunu söyler. Fiyat geçmişi aboneliği (adr/0023) toptan listesi olaylarını atlar (herkese açık fiyat değişmez).
- Toptancıya toplu kampanya e-postası ve sepet hatırlatması perakende fiyat gösterebilir; kampanya kitlesinde toptancılar varsayılan hariçtir (karar 16).
- Vitrin ve tema dokunuşu ekleyicidir: `PriceView`'a isteğe bağlı "KDV hariç" işareti, sepet özetine isteğe bağlı KDV satırı ve en az adet iletisi. Varsayılan çizim değişmez (adr/0066 K3(b)); görünüm kilidi testi yeşil kalır.
- Sonradan: F19 B2B ADR'leri; e-fatura tarafında kurumsal profili olmayan toptancının faturası bireysel kesilir (mali müşavir).

## Uygulama sırası

Her dilim ayrı PR, `dev`'den `deniz/<konu>` dalı; Opus kodlayıcı ajan, sırayla (tek seferde tek ajan).

| # | Dilim | Boyut | Güvenlik incelemesi | Partnerin alanı |
| --- | --- | --- | --- | --- |
| 1a | Backend çekirdek: `wholesale` modülü (modeller, migration), link, seviye workflow'ları, oran üretimi ve eşitleme işi, elle fiyat (KDV hariç → dahil), `/admin/wholesale/tiers*`, `wholesale.managed` korumaları, `PRIVATE` kuralı, denetim kaynağı, özellik bayrağı, **öncelik entegrasyon testi** | L | Evet | Hayır |
| 1b | Backend hesaplar: hesap aç/değiştir/kapat/yeniden aç workflow'ları (telafili), `/admin/wholesale/accounts*`, ileti şablonları `account.wholesale_invite` / `account.wholesale_enabled`, `/store/customers/me` sahiplenmesi, paket koruması izin listesi (kapatma), KVKK silme adımı | M | Evet | Hayır |
| 2 | Panel: Müşteriler > Toptancılar (liste, ayrıntı), "Yeni müşteri" penceresinde Bireysel/Toptancı, Toptan seviyeleri ekranı (oran, tekil fiyatlar: `price-lines-card` / `discount-dialog` desenleri, iki sütun), fiyat listeleri ekranından toptan listelerinin çıkarılması, i18n | L | Hayır | Hayır (panel Deniz'in) |
| 3 | Vitrin kişisel fiyat: `/store/customers/me/wholesale` ve `/wholesale-prices`, hız sınırı profili, vitrinde `priceDisplays()` boğazı, `PriceView` isteğe bağlı "KDV hariç", sepet/ödeme özetine KDV satırı, toptancıya fiyat süzgecinin gizlenmesi, önbellek ve herkese açık okuyucu testleri, sepet aktarımında yeniden fiyatlama doğrulaması | M–L | Evet | **Evet:** `packages/ui/src/views.ts`, `packages/themes/atolye/src/parts/Price.tsx`, `parts/LinePrice.tsx`, `cart/CartSummary.tsx`, `checkout/Summary.tsx`, liste süzgeci. Yalnız yeni veri ve isteğe bağlı alan, yeniden çizim yok (adr/0066); Oğuzhan'a önceden haber |
| 4 | Sepet kuralları: en az adet (sepet iletisi, ödeme öncesi koruma, tamamlama kancası), kupon reddi, otomatik kampanyanın toptancıya uygulanmaması (önce Context7 + test: promosyon kuralında grup dışlama 2.21.2'de çalışıyor mu; çalışmıyorsa toptancı sepetinde otomatik promosyonları kaldıran sepet kancası), kapanan toptancının sepetinin yenilenmesi ve `wholesale.prices_changed` | M | Evet (ödeme/sepet) | Sepet iletisi teması: `cart/CartPage.tsx` (yalnız ileti alanı) |
| 5 | Belgeler ve uçtan uca: `docs/kvkk-envanter.md`, docs/06 ekran planı, docs/13 notu (herkese açık fiyat tek kaynak), e2e (toptancı daveti → kayıt → toptan fiyatla sipariş, kapatma → perakende), PROGRESS | S | Hayır | Hayır |

## Açık sorular

Öneri sürümündeki 1–9, 11 ve 12. sorular sahibin onayıyla karara bağlandı (Bağlam, "Sahibin onayladığı varsayılanlar", karar 7–17). Açık kalan:

10. **Yasal ve mali (danışman yok; taslak işaretli kalır):** toptancıya KDV hariç gösterim, toptancıya 30 gün kuralının uygulanmaması, ödeme adımında tüketici sözleşmelerinin (ön bilgilendirme, mesafeli satış, adr/0041) toptancıya da gösterilmesi, kurumsal profili olmayan toptancının faturası. Uygulanan varsayılan: KDV hariç gösterim ve indirim gösterimi yok; sözleşmeler aynen gösterilir (güvenli taraf). Mali müşavir ve avukat görünce kesinleşir; o zamana kadar bu konular **taslak** olarak işaretli kalır.

## Ek 2026-11-15: öncelik kapısının sonucu

### Ölçüm (Medusa 2.21.2, Store API, giriş yapmış müşteri)

`integration-tests/http/wholesale-precedence.spec.ts`, ana çalışma kopyasında çalıştırıldı. Ürün perakende 100 TL; listeler Medusa'nın kendi admin uçlarıyla kuruldu.

| # | Kurgu | ADR'nin beklediği | Ölçülen |
| --- | --- | --- | --- |
| 1 | Seviye `sale` 80 | 80 (misafir 100) | 80 (misafir 100) ✓ |
| 2 | Seviye `sale` 80 + özel `override` 90 | 90 | **80** ✗ |
| 3 | Seviye `sale` 80 + özel `override` 70 | 70 | 70 ✓ |
| 4 | Seviye `sale` 80 + herkese açık `sale` 60 | 60 | **80** ✗ |
| 5 | Seviye `sale` 80 + özel `override` 90, özel satırda grup fiyat kuralı | 90 | 90 ✓ |

### Medusa'nın sıralaması (düzeltilmiş açıklama)

`PricingRepository.calculatePrices` (2.21.2) satırları şöyle sıralar: önce fiyat listesi satırları, sonra `price.rules_count + pl.rules_count` çok olan, sonra düşük tutar. Servis fiyat seti başına **yalnız ilk liste satırını** değerlendirir: `override` ise kazanır, `sale` ise yalnız varsayılan fiyattan düşükse uygulanır. Bu yüzden:

- Seviye ve özel liste ikisi de tek kurallıdır (`customer.groups.id`); eşitlikte ucuz satır önce gelir. Özel liste yalnız ucuzsa kazanıyordu (durum 2 ve 3). §2'deki "özel listenin kuralı daha çoktur" iddiası yanlıştı, kaldırıldı.
- Seviye satırı (1 kural) herkese açık listelerin (0 kural) her zaman önündedir; herkese açık indirim toptancıya hiç ulaşmaz (durum 4). Eski yan etki (c) ("herkese açık override seviyeyi ezer") de yanlıştı, kaldırıldı.

### Kararlar

1. **Özel liste önceliği (düzeltme b):** toptancıya özel listenin her satırı, listenin kuralına ek olarak gizli grubu **fiyat kuralı** (`rules: { "customer.groups.id": <gizli grup> }`) olarak taşır. Satır 2 kurallı olur ve seviyenin (1) önüne geçer: özel fiyat pahalı da ucuz da olsa kazanır (durum 5). Kuralı modül yazar; personel girmez.
2. **Karar 11 değişti (sahip, 2026-11-15):** "toptan fiyatlar perakendedeki fiyatlarla hiçbir zaman zaten eşitlenemez, öyle bir durum söz konusu değil; toptancıya 1000 TL'den verdiğim ürün perakendede 800 TL olursa toptancı bunu 800 TL'den de almaz zaten." Toptancı **her zaman toptan fiyatı** öder (özel > seviye); herkese açık indirimler ona yansımaz. Bunun için seviye listesi de `override` olur (eski Açık soru 5'in "seviye fiyatı her zaman geçerli" seçeneği): toptan fiyat perakendeden yüksek girilse de uygulanır ve toptancıya üstü çizili fiyat çıkmaz (§6 ile uyumlu). Herkese açık listeleri izleyen bir `min()` eşitlemesi **yoktur**.
3. **Uyarı sinyali (engel değil):** seviye ve özel liste satırlarını dönen yönetici uçları, bugünkü perakende fiyatı (yürürlükteki herkese açık indirim dahil) toptan fiyatın altında olan satırları işaretler (satır başına bayrak ve toplam sayı). Panel (dilim 2) bunu uyarı olarak gösterir; hiçbir yazma engellenmez.
4. Segment listeleri (tek kurallı grup listesi) seviyeyle eşit kurallıdır; toptancı bir segmentteyse ucuz satır önce gelir. Segment kitlesinden toptancılar dilim 1b'de çıkarılır; o zamana kadar uyarı sinyali bu satırları da gösterir. (1b güvenlik incelemesi L4:) yalnız segment grupları dışlanır; elle açılmış bir müşteri grubuna verilen fiyat listesi de seviyeyle eşit kurallıdır, toptancı o gruptaysa ucuz satır kazanır. Bugünkü uyarı sinyali bunu göstermez (perakende fiyat grupsuz okunur); engellenmez, panel (dilim 2) toptancının toptan dışı gruplarını uyarı olarak gösterir.

### Kabul testi (yeni hali)

Durum 2 özel satırı fiyat kuralıyla (modülün yazdığı biçimde) 90 bekler; durum 4'te üye 80, misafir 60 öder; yeni durum: kuralsız herkese açık `override` 60 varken üye yine 80 öder. Seviye listeleri `override` türündedir.

## Ek 2026-11-15 (2): davetsiz hesap

### Karar (sahip, 2026-11-15)

Sahip: "toptancıya davet maili atmak gereksiz toptancı hesabını direkt ben oluşturucam şifresi vs dahil. direkt toptancıya ileteceğim. o giriş yapacak. toptan seviyeleri toptancılar sekmesi içinde ek tab olarak açılsın. Siparişlerde toptancıdan gelen siparişler direkt bu toptancılar sekmesi içinde Siparişler diye görünsün klasik müşteri siparişleri ile karıştırılmasın."

- **§3 değişir:** toptancıyı personel (sahip, yönetici) şifresiyle birlikte açar; hesap **hemen etkindir**. Davet e-postası, bekleyen (`pending`) durum ve "Daveti yeniden gönder" yeni hesaplar için yoktur. Şifre vitrin kaydıyla aynı kuraldadır (adr/0043: en az 10 karakter, sık kullanılan değil, adresi içermeyen, sızıntı listesinde olmayan); panel güçlü bir şifre üretip kopyalatabilir, şifre yalnız o formda görünür.
- **Güven çapası:** e-posta kutusu kanıtının yerini personelin kararı alır. Toptan bayrağı, personelin açtığı hesaba bağlıdır; personelin açtığı adres onaylanmış sayılır (adresin `AuthVerification` kaydı personel adına doğrulanır), böylece `provenCustomer` ve onu kullanan korumalar aynı kalır.
- **Şifrenin yolu:** panelden HTTPS ile gelir, route'ta kuralla denetlenir ve hemen istek için mühürlenir (`sealForRequest`); iş akışları `store: false` çalışır; şifre yalnız kimlik sağlayıcının özetine (`emailpass`) yazılır. Logda, denetim kaydında (yalnız "şifre değişti" ve alan adları), hata iletisinde ve test verisinde yer almaz.

### Üç durum

1. **Adreste hesap yok:** müşteri kaydı ve e-posta girişi personelin şifresiyle açılır, adres onaylanır, toptancı hesabı bağlanır, etkin. (`password: "set"`)
2. **Adresi kanıtlanmış müşteri var:** bugünkü gibi bağlanır ve etkinleşir; yazılan şifre **uygulanmaz**, müşteri kendi şifresiyle girer; panel bunu söyler. Personel gerçek bir müşterinin şifresini sessizce değiştiremez. (`password: "kept"`)
3. **Kayıtlı ama adresi kanıtlanmamış hesap var** (adres başkası tarafından tutulmuş olabilir): istek `wholesale.unproven_signup` (409) ile reddedilir; panel durumu söyler ve açık bir **"Hesabı devral"** seçeneği sunar. Devralma (`take_over: true`, yeniden doğrulamayla): adresteki bütün girişlerin şifresi personelinkiyle değişir, değişiklik zamanı kimliklere yazılır ve **bütün eski oturum ve jetonları** reddedilir, kaydın müşteri kaydı emekliye ayrılır ve toptancıya yeni bir müşteri kaydı açılır (aşağıda "Güvenlik incelemesinden sonra"), adres onaylanır, toptancı bağlanır. Denetim kaydına şifresiz yazılır. (`password: "replaced"`)
4. Adres bir personel girişiyse (`app_metadata.user_id`) ya da giriş başka bir müşteriye bağlıysa: `wholesale.login_in_use` (409); dokunulmaz.

### Oturumların sonlanması

`api/http/sign-in-epoch.ts` her `/store/*` isteğinde jetonun (`iat`) ya da oturumun (`POST /auth/session`'da yazılan açılış zamanı) kimliğin `password_changed_at`'inden eski olup olmadığına bakar; eskiyse 401 (oturum ayrıca yok edilir). Kimlik okuması 5 sn tutulur; aynı süreçteki değişiklik bu tutmayı hemen siler. Açılış zamanı yazılmamış eski bir oturum, değişiklik oturum ömründen (10 sa) gençse reddedilir. Bu kural sıfırlama bağlantısıyla şifre değiştiren her müşteriye de uygulanır (bugüne kadar yalnız yenileme ve oturum açmada uygulanıyordu).

### Yeni panel işlemi: "Yeni şifre belirle"

Toptancının sayfasında, aynı kuralla; eski oturumlar biter; denetlenir (`POST /admin/wholesale/accounts/:id/password`). Toptancı vitrinin normal "şifremi unuttum" yolunu da kullanabilir. Yalnız e-posta ve şifreyle giren müşteride; Google ile giren müşteride `wholesale.no_password_login`.

### Silinen ve uyuyan

- **Silinen:** davetin yeniden gönderimi (uç, iş akışı, adımı, `resendRefusal`), `account.wholesale_invite` ve `account.wholesale_enabled` şablonları, metinleri ve yükleyicileri, `wholesale_invite` hız sınırı profili (açma ve şifre işlemleri öbür toptan yazmaları gibi personel başına `bulk_ship` bütçesindedir), ilgili hata metinleri.
- **Uyuyan (Ek'ten önce açılmış bekleyen kayıtlar için):** girişte sahiplenme (`api/http/wholesale-claim.ts`, `workflows/wholesale/accounts/claim.ts`), 90/180 gün silme işi (`jobs/wholesale-invites-expiry.ts`), bekleyen kaydın silinmesi (`DELETE`, panelde düğmesi yok). Yeni hesaplar bunlara hiç girmez. `provenCustomer` ve koruması kalır.
- **Migration yok:** `invite_count`, `invited_at`, `email` sütunları kalır.

### Toptan siparişler

- Etkin bir toptancının verdiği sipariş **toptan siparişidir**: sipariş verilince (`order.placed` aboneliği, `subscribers/wholesale-order-stamp.ts`) sunucu, siparişin müşterisinin **siparişin zamanında** etkin olan toptancı hesabını (etkinleşme ve kapanma zamanlarından) bulur ve sipariş ↔ toptancı **modül bağı** (`links/wholesale-account-order.ts`) yazar. `completeCartWorkflow`'un `orderCreated` kancası kullanılmaz: Medusa bir kancaya tek işleyici verir ve onu sadakat eklentisi (`@medusajs/loyalty-plugin`) tutar; bunu `workflows/hooks/__tests__/single-handlers.unit.spec.ts` korur. Geri alınan bir ödemede `order.placed` gelmez; tekrar gelen olay ikinci bağ yazmaz. İstemciden hiçbir bilgi alınmaz; hesap sonradan kapansa da sipariş toptan kalır. Bağ yazılamazsa sipariş etkilenmez, olay loglanır (`wholesale.order_stamp_failed`) ve sipariş perakende listesinde kalır.
- Panel sipariş listesi (`/admin/order-board`) `segment=retail` (varsayılan) toptan siparişleri sayım ve sayfalamadan **önce** sunucuda dışarıda bırakır; `segment=wholesale` (isteğe göre `wholesaler=`) yalnız onları, toptancı adıyla gösterir; `segment=all` müşterinin sayfası içindir. Perakende listede sipariş numarasıyla arama toptan bir siparişi bulursa `wholesale_matches` sayısı döner, panel "Toptancılar > Siparişler'de" der. Kargo, fatura, iade ve sipariş sayfası aynı kod yolundadır. Dışa aktarma listenin filtresini izler.
- **Karışık kalan sayılar (sahip karar verecek):** ana sayfa özeti ve günlük satış kartları (`/admin/home/summary`, `/admin/dashboard/*`), Raporlar (ürün, kategori, günlük, finans, marka, pazarlama), paket sınırı "aylık sipariş" sayacı ve ödeme/fatura kuyrukları perakende ve toptan siparişleri birlikte sayar.

### Panel

Müşteriler altında tek "Toptancılar" girişi (bayrak açıkken, sahip ve yönetici); içinde üç sekme, her biri kendi adresiyle: Toptancılar (`/customers/wholesale`), Toptan seviyeleri (`/customers/wholesale/tiers`; ayrı menü girişi kaldırıldı, adres aynı), Siparişler (`/customers/wholesale/orders`).

### Güvenlik incelemesinden sonra (2026-11-16)

- **Devralma (M2, M5):** adresteki **bütün** e-posta girişleri (büyük/küçük harf farkıyla açılmış ikinci giriş dahil) personelin şifresini alır ve eski oturumları biter; hepsinin müşteri bağı kaldırılır. Kaydın kendi girişi (yoksa ilki) toptancıya kalır. Kaydın müşteri kaydı **emekliye ayrılır** (`has_account=false`, misafir kaydı olur; adreste zaten misafir kaydı varsa Medusa'nın adres başına tek misafir kuralı yüzünden yumuşak silinir) ve toptancıya **yeni bir müşteri kaydı** açılır: kaydın bıraktığı adres, ad, telefon, izinler, fatura profili ve siparişler yeni hesaba geçmez. Sonraki bir adım başarısız olursa hepsi geri alınır. Açık sepetleri kenara alma adımı kalktı (eski kayıt toptan gruba hiç girmez).
- **Personel girişi (M3):** `user_id` taşıyan bir kimlik (müşteriyle aynı kimlik olsa da), adres kanıtlanmış olsa bile hiç kullanılmaz (`wholesale.login_in_use`); yeni şifre işlemi de böyle bir kimliğe dokunmaz.
- **"Yeni şifre" (M4, sahip kararı):** yalnız girişini personelin açtığı ya da devraldığı (durum 1 ve 3) ve **açık** hesapta. Hesapta sunucunun yazdığı `staff_login` (migration `Migration20261116090000`); durum 2'de `false`: uç `wholesale.password_own_login` ile reddeder, panel düğmeyi göstermez ve müşterinin vitrindeki "Şifremi unuttum"u kullandığını söyler. Yeni şifre ve devralma panelin mevcut yeniden doğrulamasını (`requireReauth`, adr/0040 §3) ister.
- **Oturumlar (H1, L6, L9, INFO):** istek hem oturum hem jeton taşıyorsa ikisi de ayrı ayrı tartılır (Medusa önce oturumu okur; eski çerez yanında sahte bir jeton artık geçmez); eskimiş oturum yok edilir. Personelin yaptığı değişiklik bir saniye ileri yazılır: aynı saniyede açılmış oturum da biter. Açılış zamanı olmayan eski oturum için 10 saat kuralı kalır (ilk görüşte damgalamak, değişiklikten önce açılmış bir oturumu temize çıkarırdı); kayan ömürlü bir oturum bu sınırı aşabilir, yalnız bu kuraldan önce açılmışlar için. Personelin kendi şifre değişikliğinden sonra yenilenen oturum damgalanır. Okunamayan kimlik "hiç değişmedi" diye tutulmaz. Geri alma için eski şifre özeti, süre dolan bir anahtarla mühürlenmeden adımın bellekteki geri alma verisinde tutulur (iş akışları `store: false`); geri alma başarısız olursa `wholesale.password_undo_failed` hata logu düşer, giriş yeni şifreyle kalır ve sahibi vitrinden sıfırlayabilir.
- **Sipariş listesi (L7, sahip kararı):** operations toptan siparişleri görür ve gönderir (`segment=wholesale|all`), ama `wholesaler=` süzgeci yalnız sahip ve yöneticiye açıktır (`orders.wholesaler_filter_denied`); öbür rollere satırda yalnız firma adı gider, hesap kimliği gitmez.
- **Panel (L8):** şifre taşıyan iki işlem bitince hiçbir şey tutmaz (`gcTime: 0`, form sıfırlanır).
- **Toptancıyı silmek (sahip: "bu toptancıları silemiyorum"):** her durumdaki toptancı silinebilir (sahip ve yönetici, `deleteAccountWorkflow`, eski bekleyen kaydı silme ve süre dolumu da bu yoldan): kapatma gibi gruplardan çıkar ve açık sepetleri perakendeye yeniden fiyatlanır, özel listesi, gizli grubu ve elle fiyatları silinir, müşteri bağı kaldırılır; müşteri kaydı ve girişi perakende müşteri olarak kalır. Satır yumuşak silinir, yalnız firma adı kalır: geçmiş toptan siparişleri Toptancılar > Siparişler'de adıyla kalır, perakende listeye geçmez; aynı e-posta yeniden açılabilir. Seviye silme reddi metni "taşıyın ya da silin" der. Silme incelemesinden sonra: bir açık sepet perakendeye çevrilemezse silme reddedilir ve toptancı olduğu gibi kalır (`wholesale.carts_not_repriced`; kapatma eskisi gibi sayar); silme kapanma zamanını yazar ve sipariş damgası silinmiş satırları da tarihleriyle okur (silmeden hemen önceki sipariş toptan, sonraki perakende kalır); silinmiş toptancı listede yalnız satırda kalan firma adıyla anılır, müşteri kaydının adlarıyla değil; hiç bağlanmamış bekleyen kayıtta firma adı da kalmaz; müşteri silinince (KVKK) satırdaki firma adı ve müşteri kimliği temizlenir. Silme, eşitleme işinin listeye yazarken tuttuğu kilidi de tutar.
- **Adres yazım hatası:** personelin yanlış yazdığı bir adres, hesabı o adresin sahibine verir (sosyal giriş ya da vitrindeki sıfırlama ile girer); bu yüzden açma penceresi e-posta alanının altında adresi bir kez daha kontrol etmeyi söyler.

### Kalan risk

Personel ilk şifreyi bilir; toptancıya ilk girişte şifresini değiştirmesi önerilir (panel bunu söyler). Devralma, gerçek sahibi adresini doğrulamamış bir müşterinin şifresini değiştirir; bu yüzden açık bir seçimdir ve denetlenir. Oturum kontrolü her Store isteğine bir kimlik okuması ekler (5 sn tutulur).

## Ek 2026-11-16: dilim 4 (ödeme anı denetimi, kampanyalar, kupon, en az adet)

### Ödeme anı fiyat denetimi (1b incelemesi M1'i kapatır)

- **Hangi sepet:** müşterisi toptancı olan ya da bir zaman olmuş (kapalı, silinmiş satır dahil: `withDeleted`) sepet. Misafir sepeti, hiç toptancı olmamış müşterinin sepeti ve ödeme bağlantısı sepeti (`qt_payment_link`) denetlenmez. Ödeme bağlantısı dışarıda kalır: satırlarını, kodunu ve fiyatını personel belirler, bağlantının kendi kilidi (`linkCartProblem`) bunları zaten tutar (§7 "ödeme bağlantısı toptan fiyat okumaz"); toptan kuralları ona uygulanırsa bağlantının kodu düşer ve bağlantı `cart.payment_link_changed` ile kırılırdı.
- **Karşılaştırma:** her satırın birim fiyatı, Medusa'nın satırı bugün fiyatladığı bağlamla (sepetin para birimi ve bölgesi, müşteri ve o anki grupları, satırın adedi; `addons/cart.ts` ile aynı) yeniden okunur; kuruşta farklıysa satır bayattır. Kendi kuralıyla fiyatlanan satırlar (`is_custom_price`: ek seçenek satırları, kapıda ödeme bedeli) ve bugün fiyatı olmayan satırlar bu denetimin değildir. Etkin toptancının sepetinde herhangi bir promosyon (otomatik dahil) olması da "yeniden fiyatlanmalı" sayılır. Fiyat istemciden hiç alınmaz.
- **Ödeme başlangıcı:** `startCartPaymentWorkflow` ve `startCreditCheckoutWorkflow`'a ek seçenek adımından hemen sonra `checkWholesaleCartStep` girer (sepet kilidini almadan önce; Medusa'nın yenilemesi kilidi kendisi alır). Bayat sepet Medusa'nın kendi yenilemesiyle (`repriceCartWorkflow` → `refreshCartItemsWorkflow`, `force_refresh`) yeniden fiyatlanır ve tamamlamanın ölçütüyle bir kez daha incelenir: doğruysa ve ödenecek tutar değiştiyse başlangıç 409 `wholesale.prices_changed` ile durur (yeni fiyat kalır), yalnız bir promosyon bağı kalktıysa sürer; hâlâ doğru değilse kapalı başarısız olur (aşağıda, inceleme Y2).
- **Tamamlama:** kanca olarak `completeCartWorkflow.hooks.validate` seçildi: zaten bizim tek dinleyicimiz var (`hooks/complete-cart-validate.ts`), denetim oraya eklendi. `orderCreated`, `beforePaymentAuthorization` (ikisi de `completeCartWorkflow`) ve `refreshCartItemsWorkflow.beforeRefreshingPaymentCollection` `@medusajs/loyalty-plugin` 2.21.2'nindir (kaynakta `src/workflows/hooks/*`); `single-handlers.unit.spec.ts` artık dördünü de listeler. `validate` ödeme yetkilendirmeden önce çalışır; Medusa belgesi kancada sepeti değiştirmeyi yasaklar ve tamamlama sepet kilidini tutar: denetim yalnız okur, bayat sepeti 409 `wholesale.prices_changed`, kodlu toptancı sepetini 400 `promotions.wholesale_no_code`, eksik adedi 400 `wholesale.min_quantity` ile reddeder. Yeniden fiyatlama bir sonraki ödeme başlangıcındadır. Zaten siparişe dönmüş sepet (tamamlamanın tekrar çağrılması) denetlenmez.
- **Başlangıç ve tamamlama aynı kararı verir:** başlangıcın geçirdiği bir sepeti, arada sepet ya da fiyat değişmediyse tamamlama reddetmez (birim testi `checkout.unit.spec.ts`).

### Otomatik kampanyalar toptancıya uygulanmaz: mekanizma

Medusa 2.21.2 kaynağıyla incelendi (`packages/modules/promotion/src/utils/validations/promotion-rule.ts`, `compute-actions/build-promotion-rule-query-filter-from-context.ts`, `services/promotion-module.ts` `computeActions`; `core-flows` `update-cart-promotions.ts`):

- **Grup dışlayan kural (`customer.groups.id` `ne` toptan grupları) reddedildi.** Bellekteki değerlendirme `ne`'yi doğru yapar (bağlamdaki hiçbir grup listede değilse geçer), ama otomatik promosyonlar önce veritabanında süzülür ve bu süzgeç **kuralının özniteliği bağlamda olmayan her promosyonu dışarıda bırakır**: grubu olmayan müşteri ve misafir sepetinde `customer.groups.id` yoktur, yani kampanya perakende müşteriden de kalkardı. Ayrıca her otomatik promosyona kural eklemeyi (panelden açılanlar dahil) gerektirirdi.
- **Seçilen: `updateCartPromotionsWorkflow.hooks.setPromotionContext`** (`hooks/cart-promotion-context.ts`, başka dinleyicisi yok). Medusa her promosyon hesabını bu iş akışından geçirir (her sepet değişikliğinden sonraki yenileme, kod ekleme ve çıkarma) ve kancanın döndürdüğünü sepet bağlamının üstüne koyar. Etkin toptancının sepeti (bayrak açık; ödeme bağlantısı sepeti hariç) için satırlar ve kargo yöntemleri **kabuk** olarak verilir (`lib/wholesale/cart.ts` `promotionShells`): her satır ve yöntem kimliğini ve mevcut indirimlerini taşır (Medusa gösterilen her indirimi kaldırma eylemi üretir), ama indirime açık değildir, tutarı ve adedi 0'dır, ürün/varyant gibi bir kuralın eşleşeceği alan taşımaz. Sonuç: hiçbir promosyon (otomatik ya da kodlu, standart ya da al-öde, sipariş, satır ya da kargo hedefli) uygulanmaz, eski indirimler kalkar, sepetin promosyon bağları boşalır. Kapanan toptancı ya da bayrağın kapanması: kanca hiçbir şey döndürmez, sepet perakendedir ve kampanyalar uygulanır.
- Kanıt: HTTP `wholesale-promotions.spec.ts` (misafir kampanyayı alır, toptancı almaz; toptancının devraldığı misafir sepetinden kampanya kalkar).

### Kupon

Kod gönderen Store istekleri (`POST /store/carts` kodla, `POST /store/carts/:id` kodla, `POST /store/carts/:id/promotions`) sepetin müşterisine (yeni sepette oturumun müşterisine) bakan `refuseWholesaleCodes` ile 400 `promotions.wholesale_no_code` alır; ara katman kod denemesi sayıldıktan sonra (`couponTries`) ve tek kod kuralından önce çalışır, kod çıkarmak hiç reddedilmez. Arka korumalar: kabuk bağlam kodun hiç uygulanmamasını sağlar, tamamlama kodlu toptancı sepetini reddeder.

### En az adet

§8'deki gibi; tek fark yer: denetim `checkout-guard.ts` ara katmanında değil ödeme başlangıcı iş akışının adımındadır (iş mantığı workflow'da). Sayım ürün satırlarının adetleridir (varyantsız kapıda ödeme bedeli sayılmaz). Hata `values: { min, units }` taşır. Vitrin sepet sayfası mevcut ileti alanında (`CartPageView.error`) "Toptan siparişte en az {min} adet gerekir; sepetinizde {units} adet var." der; ödemede `wholesale.min_quantity` gelirse sepete döner. "Ödemeye geç" düğmesini kapatmak tema alanı ister, bu dilimde yapılmadı.

### #93 düşük bulguları

D1: "gece senkronu" sözü kaldırıldı, kalan sepetleri bu dilimin ödeme anı denetimi düzeltir. D2: başarısız ya da yarıda kalan (`interrupted`) sepet işi aynı `attempt` sınırıyla yeniden kuyruğa girer (iptal edilen girmez). D3: bayrak kancasında iş zaten kuyruktaysa loglanır. D4: bir listenin son yazılma zamanı okunamazsa durum "bilinmiyor" döner ve tur oturmuş sayılmaz; gerçek veritabanıyla HTTP doğrulaması `wholesale-payment.spec.ts`'te.

### Yeni hata kodları

`wholesale.prices_changed` (409), `wholesale.min_quantity` (400, `values.min`, `values.units`), `promotions.wholesale_no_code` (400). Vitrin `wholesale.prices_changed`'i temanın bildiği `cart.prices_changed` sözüyle gösterir.

### Dilim 4 güvenlik incelemesinden sonra (2026-11-16)

- **Y1, kartla ödenmiş sepetin iadesi:** barındırılan formda (PayTR, iyzico) para çekildikten sonra tamamlama reddedilirse `completionFailureOf` (`lib/payments/completion.ts`) yalnız sepetin kendi kuralı sayılan öneklerde iade yolunu açar; `wholesale.` yoktu, toptan retleri "yeniden dene" sayılıyor ve iade kaydı açılmıyordu. `wholesale.` öneki eklendi (`promotions.wholesale_no_code` zaten `promotions.` ile giriyordu): toptan retleri tekrar denemekle geçmez, para iade edilir. Aynı sınıftaki ek seçenek retleri de eklendi: `addons.` önekinin tamamı (koddaki 21 `addons.*` anahtarının hiçbiri geçici değildir) ve `catalog.` alanından yalnız `catalog.addons_disabled` tam adıyla (`catalog.*` panelin katalog denetimlerini de tutar). Tamamlama kancasının atabildiği bütün kalıcı ret önekleri artık iade yolundadır. Uçtan uca HTTP: `wholesale-paid-refund.spec.ts` (sahte PayTR: kartla ödenen ve sonra fiyatı bayatlayan toptan sepet ile ek seçenekleri kapatılan sepet; sipariş açılmaz, `completion_failed` kaydı bir kez iade edilir, tekrar gelen bildirim ikinci kayıt açmaz).
- **Y2, kapalı başarısızlık:** Medusa'nın yenilemesinden sonra sepet hâlâ tamamlamanın ölçütüne (`needsPricing`: bayat satır, ya da etkin toptancı sepetinde promosyon) takılıyorsa başlangıç 409 `wholesale.payment_unavailable` ile durur ve `wholesale.price_check_diverged` hata logu sepet kimliğiyle düşer; kart çekilmez. Yanlış pozitif kaynakları tek tek incelendi (2.21.2 kaynağı): bölgesiz sepet (Medusa da `region_id` vermez, biz de); adet kademesi (iki taraf da satırın adedini verir); kabuktan sonra kalan promosyon bağı (kabukta hiçbir eylem "ekle" üretmez, `prepareAdjustmentsFromPromotionActionsStep`'in hesapladığı kodlar boş kalır ve `updateCartPromotionsStep` `REPLACE` ile bütün bağları kaldırır); sıfır tutarlı kargo indirimi (kabuk yöntemin tutarı 0: `each`/`once` atlar, `across` toplam 0'da çıkar, bağ oluşmaz). Medusa'nın bağlamında bizimkinden fazla olan alanlar (satış kanalı, teslimat adresi, sepet toplamı, e-posta) yalnız o alanlarda fiyat kuralı varsa ayrılır; mağazanın yazdığı kurallar müşteri grubu (listeler ve özel satırlar) ve bölgedir. Böyle bir kural gelirse sonuç kapalı başarısızlık ve hata logudur, para alınmaz.
- **O1, misafirken eklenen kod:** misafir sepetine kod eklenip toptancı sepeti devralınca Medusa'nın devralma yenilemesi (ve bizim yeniden fiyatlamamız) kabuk bağlamla hesaplar; kod ne indirim ne bağ olarak kalır (yukarıdaki `REPLACE`). Sunucunun ayrıca kodu silmesi gerekmedi; devralmada yenileme başarısız olursa ödeme başlangıcı aynı yenilemeyi yapar. HTTP: `wholesale-payment.spec.ts` (misafir + kod → devralma → başlangıç → sipariş).
- **O2, kabuğun kanıtı:** Medusa'nın yenilemesi sepeti `customer.*` ile okur, `customer_id`'yi adıyla istemez; kanca müşteriyi ikisinden de bulur. `metadata` alan listesindedir (ödeme bağlantısı sepeti kabuklanmaz). HTTP `wholesale-campaigns.spec.ts`: otomatik kargo indirimi (misafirde kargo düzeltmesi var; toptancının kendi sepetinde ve misafirden devraldığı sepette düzeltme de bağ da yok; 2.21.2 `each`/`once` dağıtımlı promosyona `max_quantity` ister), otomatik "3 al 2 öde", toptancının indirimli ödeme bağlantısı sepeti (kodu kalır, ödeme başlar); sipariş düzeyi otomatik kampanya `wholesale-promotions.spec.ts`'te.
- **E-posta değişimi:** 2.21.2 `updateCartWorkflow` hesabı olan müşterinin sepetinde müşteriyi değiştirmez, yalnız e-postayı yazar; sepet toptancının ve toptan fiyatta kalır (HTTP testi).
- **Fiyat sorgusu sayısı (D2):** ödeme başlangıcında satırların farklı adet sayısı kadar fiyat sorgusu yapılır; adet kademesi yüzünden tek sorguya inmez (Medusa'nın kendi yenilemesi de bağlamı aynı satırları bir arada fiyatlar). Sorgu sayısı sepetin satır sayısını geçemez (Medusa'nın yenilemesiyle aynı mertebe), vitrinden gelen sepette farklı adet en çok 99'dur; tipik sepet bir iki sorgudur. Yalnız toptancı geçmişi olan müşterilerin sepetinde çalışır.
- **Kabul edilen (D1):** bir sepetin kimliğini bilen kişi o sepete kod gönderip `promotions.wholesale_no_code` yanıtından sahibinin toptancı olduğunu öğrenebilir. Sepet kimlikleri tahmin edilemez ve Medusa sepeti zaten kimlikle okutur; kabul.
- **Bilinçli karar:** hediye kartı ve mağaza kredisi (kredi satırları) toptancı sepetinde serbesttir: ödeme aracıdır, indirim değildir (§6); kabuk yalnız promosyonları etkiler.
- **Yeni hata kodu:** `wholesale.payment_unavailable` (409). Vitrin anahtarı tanır ve metni `tr.json`'dadır ("Sepetinizin ödemesi şu an başlatılamıyor…"); ödeme formu hata sözlerini temanın listesinden (`CHECKOUT_ERRORS`) kurduğu için tema bu anahtarı listeleyene kadar ekranda genel "Sipariş tamamlanamadı" sözü görünür.

### İkinci tur incelemeden sonra (2026-11-16)

- **N2, kilit altında ikinci denetim:** ödeme başlangıcı (kart ve kredi yolu) sepet kilidini aldıktan sonra, oturum açılmadan hemen önce tamamlamanın denetimini (`assertWholesaleCartCompletes`) yalnız okuyarak bir kez daha çalıştırır (`assertWholesaleCartStep`, adım adı `wholesale-assert-checkout-cart`).
- **N3, mağazaya bildirim:** "ayrıldı" durumu hata logunun yanında personele bildirilir: mevcut ödeme sorunu yardımcısı `alertPaymentIssue`, yeni tür `wholesale_price_check` (zil `trigger_type` `payments.wholesale_price_check`, `idempotency_key` `payments.wholesale_price_check:<sepet>`: sepet başına bir kez; personel e-postası `staff.payment_issue`). Para alınmamıştır.
- **N4, yenilemenin kendi hatası:** Medusa'nın yenilemesi başlangıçta fırlatırsa (ör. satıştan kalkmış ürün satırı) ayrıntısı `wholesale.checkout_reprice_failed` logunda kalır (`cart_id`, `errorSummary`), müşteriye 409 `wholesale.payment_unavailable` döner.
- **Kalan kenar durum (düşük, doğrulanmadı):** bir fiyat listesi yeniden yazılırken ek seçenekli bir satırın fiyatı o an okunamazsa (`variantPrice` null) tamamlama `addons.unavailable` ile reddeder ve kartla ödenmiş para iade edilir; sipariş açılmaz, müşteri yeniden ödemeye başlar.

### Tema eksikleri kapandı (2026-11-16)

- **Kupon sözü:** Atölye'nin kod sözleri listesi (`cart/code-words.ts`) `promotions.wholesale_no_code`'u tanır; sepet ve ödeme özetindeki kod alanı "Toptan siparişte indirim kodu kullanılamaz." der (metin tek yerde, vitrinin `tr.json`'ı).
- **Ödeme başlatılamıyor sözü:** `CHECKOUT_ERRORS` `wholesale.payment_unavailable`'ı listeler; yukarıdaki "genel söz görünür" notu artık geçerli değildir. `wholesale.prices_changed` vitrinde `cart.prices_changed`'e çevrilir (listede); `wholesale.min_quantity` forma hiç düşmez, vitrin sepete döner.
- **"Ödemeye geç" kapalı (§8):** sepet görünümüne yeni, isteğe bağlı alan `CartPageView.checkoutBlocked?: { reason: string } | null` (`CheckoutBlockedView`, `packages/ui`). Genel bir "ödemeye geçilemez" nedenidir; bugün yalnız toptancının en az adedi doldurur (`wholesaleCheckoutBlocked`, `lib/views/cart-wholesale.ts`). Alan varken tema iki düğmeyi de (masaüstü özet, telefon çubuğu) `aria-disabled` düğme olarak çizer, neden altında okunur ve `aria-describedby` ile bağlıdır (düğme sekme sırasında kalır). En az adet sözü artık `CartPageView.error`'da değil bu alandadır; `error` yalnız `?hata=` retlerini taşır. Alan yokken çizim birebir aynıdır (`atolye-cart-blocked.spec.tsx` anlık görüntüsü değişiklikten önce yazıldı); sepet sayfası görünüm kilidinin dışındadır, kilit etkilenmedi. Sunucu denetimi aynen kalır; düğme güvenlik değildir.
- **Sepet çekmecesi:** çekmece görünümüne de aynı isteğe bağlı alan (`MiniCartView.checkoutBlocked`); vitrin onu çerçevenin verisinde (`shopView`, `miniCartOf`) aynı yardımcıyla doldurur. Çekmece ayrı bir uçtan beslenmez: her sepet değişikliğinden sonra yerleşimle yeniden çizilir, alan o yolda da gelir. Tema `CheckoutLink`'i yeniden kullanır; neden kimliği `useId` ile her çekmecenin kendisinindir (katalog başlığı bir ekran genişliğine bir sepet tutabilir). Alan yokken çekmece birebir aynıdır (`atolye-cart-sheet-blocked.spec.tsx`); çekmece portalda açıldığından `frame.html` kilidinde yoktur, kilit değişmedi.
