# ADR-0023: Fiyat geçmişi ve indirimli fiyat gösterimi (son 30 gün kuralı)

- **Durum:** Kabul edildi (2026-10-26, kullanıcı önerilen seçenekle onayladı; kural hukukçu teyidine bağlı, docs/12)
- **Tarih:** 2026-10-26

## Bağlam

F4.2 her varyant fiyat değişikliğinin kaydını, F4.3 indirimli üründe "son 30 günün en düşük fiyatı"nı ister. Fiyat Etiketi Yönetmeliği'nin indirimli satış hükmü (indirimden önceki fiyat = indirimden önceki 30 günde uygulanan en düşük fiyat) tasarım rehberidir; kesin kural avukatla teyit edilir. JSON-LD'deki üstü çizili fiyat (`StrikethroughPrice`, docs/13) **aynı kaynaktan** beslenir.

Medusa 2.21.2'de doğrulananlar (F4 planlaması, kaynak kodu):

- Fiyatlar Pricing modülünde `price` satırları; fiyat listesi fiyatları da `price` satırı.
- Modül olayları `pricing.price.created|updated|deleted` (ve `pricing.price_list.*`) yalnızca `{ id }` taşıyor; eski tutar yok. Çalışma anında yayıldıkları entegrasyon testiyle kanıtlanacak.
- Fiyat listesi workflow olayları (`price-list.prices_added` vb.) 2.21.2'de **yok**; 2.22.1'de geliyor.
- Fiyat listesinin `starts_at`/`ends_at` sınırı geçildiğinde hiçbir olay yok: satıştaki fiyat zamanla, yazma olmadan değişiyor.
- `calculated_price`: `sale` listesi varsayılan fiyattan düşükse kazanıyor, `original_amount` varsayılan fiyat kalıyor; `override` listesinde ikisi de liste fiyatı. Müşteri grubu fiyatları yalnızca o grubun bağlamında.

## Karar

- **Kaydedilen şey satıştaki fiyattır**, satırların kendisi değil: varyant ve para birimi başına, herkese açık bağlamdaki (müşteri grubu yok) `calculated_amount` ve `original_amount`. 30 gün kuralı müşterinin gördüğü fiyatla ilgilidir; ham satırlar zamanlı listeleri ve kural önceliğini anlatmaz.
- **Modül `price-history`, append-only** (stock-ledger gibi `refuseWrite`): `variant_id`, `currency_code`, `amount`, `original_amount`, `price_list_id` (satıştaki fiyatı veren liste, yoksa null), `reason` (`price_change` | `price_list` | `schedule` | `opening` | `reconcile`), `actor_id`, `recorded_at`. İndeks `(variant_id, currency_code, recorded_at)`.
- **Yakalama üç yoldan, hepsi aynı adıma:** "varyantın satıştaki fiyatını hesapla, son kayıttan farklıysa yaz" (aynıysa yazmaz; tekrar gelen olay zararsız):
  1. `pricing.price.*` ve `pricing.price_list.*` olaylarına subscriber; fiyat satırından varyant(lar) bulunur.
  2. Zamanlama işi (saatlik): son çalışmadan beri `starts_at`/`ends_at` sınırı geçen listelerin varyantları ve gece tam eşitleme.
  3. Açılış bakiyesi: migration script'iyle mağaza başına bir kez.
- **30 gün değeri:** "İndirimden önceki fiyat" = indirimin başladığı andan önceki 30 günde kaydedilen en düşük `amount`. İndirim başlangıcı, `amount < original_amount` durumunun kesintisiz başladığı kayıttır. Hesap `lib/pricing` içinde saf fonksiyon (fixture'lı test).
- **Store API:** ürün yanıtına `price_display` (varyant başına: güncel, liste fiyatı, indirimden önceki fiyat, indirimde mi). JSON-LD `StrikethroughPrice` aynı fonksiyondan.
- **Gösterim kuralı tek yerde:** hukukçu kuralı farklı teyit ederse (ör. pencere ya da başlangıç tanımı) yalnızca `lib/pricing` değişir.

## Alternatifler

| Seçenek                                 | Artı                                              | Eksi                                                                   |
| --------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **Satıştaki fiyatın geçmişi (seçilen)** | Kural doğrudan hesaplanır; zamanlı listeler dahil | Hesaplama maliyeti, saatlik iş                                         |
| Ham `price` satırlarının geçmişi        | Olaylarla birebir                                 | Zamanlı liste ve öncelik yeniden kurulmalı; olay eski tutarı taşımıyor |
| Medusa 2.22'yi bekle (liste olayları)   | Daha zengin olaylar                               | Zamanlama sınırı yine olaysız; yükseltme ayrı PR                       |
| Yalnızca gece anlık görüntüsü           | Basit                                             | Gün içi indirim kaçar; 30 gün hesabı günlük çözünürlükte kalır         |

## Sonuçlar

- Hukukçu teyidi gelene kadar kural varsayılan tanımla çalışır, Store API'de `price_display.rule_version` ile işaretlenir.
- Müşteri grubu fiyatları geçmişe girmez (herkese açık değil); B2B (F19) gerekirse ayrı karar.
- Medusa 2.22 yükseltmesinde (en erken 2026-11-06) liste olayları subscriber'a eklenir; zamanlama işi kalır.
- Panel ürün sayfasında "fiyat geçmişi" grafiği ve indirim uyarısı ("bu indirim, 30 günün en düşük fiyatına göre gösterilecek") F4 panel işinde.

## Uygulama notu (F4 U1, 2026-10-26)

- **Modül:** `src/modules/price-history` (`price_record`: `seq`, varyant, para birimi, `amount`, `original_amount`, `price_list_id`, neden, `recorded_at`). Append-only; servis "her varyantın son fiyatı" (`DISTINCT ON`) ve "bir andan beri geçerli olanlar" (o an yürürlükteki dahil) okur.
- **Nedenler sadeleşti:** `price_change` (fiyat, liste ya da liste kuralı olayı), `reconcile` (saatlik kontrol: başlayan/biten liste, kaçan olay), `opening` (ilk kurulum), `import` (F14'te eski platformun geçmişi). Kararın `price_list`/`schedule` ayrımı satırdaki `price_list_id`'den okunur.
- **Yakalama:** `src/subscribers/price-history.ts` (`PricingEvents` fiyat, liste ve liste kuralı olayları; silinen satır da okunur), `src/jobs/price-history-reconcile.ts` (saat başı 7. dakika, süreçler arası tek), `src/migration-scripts/price-history-opening.ts`. Hepsi `recordSellingPricesWorkflow`'a gider: satıştaki fiyat `QueryContext({ currency_code })` ile mağazanın her para biriminde okunur, son kayıttan farklıysa yazılır. İki çalışma aynı değişikliği iki kez yazabilir; eşit satırlar hesabı değiştirmez.
- **Kanıt:** HTTP testleri olayların çalıştığını (fiyat, değişiklik, indirimli liste), müşteri grubu fiyatının girmediğini, olaysız başlayan listenin saatlik kontrolde yakalandığını ve ikinci kontrolün hiçbir şey yazmadığını gösteriyor.
- **30 gün hesabı:** `src/lib/pricing/discount.ts` (`discountView`, kural sürümü `tr-30d-1`). Kademeli derinleşen indirim tek indirim sayılıyor; "indirimden önceki fiyat" ilk adımdan önceki 30 güne bakıyor (AB Omnibus yorumu). Bu yorum hukukçu teyidinde ayrıca sorulmalı (docs/12). Geçmişi indirimin içinde başlayan mağazada liste fiyatı kullanılıyor (`basis: "regular"`).

## Uygulama notu (F4 U3, 2026-10-26)

- **Tek kaynak:** `src/lib/pricing/display.ts` (`priceDisplay`). Kaydedilmiş geçmiş ve satıştaki canlı fiyattan varyantın gösterimini çıkarır: güncel fiyat, liste fiyatı (`regular`), üstü çizili fiyat (`before`), `on_sale`, indirimin başlangıcı, `basis`, kural sürümü. Okuyan: `src/workflows/pricing/price-display.ts` (`priceDisplays`).
- **İndirim yalnızca gösterilebilecekse gösterilir:** `on_sale`, indirimden önceki fiyat güncel fiyattan yüksekse doğrudur. Fiyat 30 gün içinde zaten o kadar düştüyse (önce artırılıp sonra "indirilen" fiyat), Medusa'nın liste fiyatı ne derse desin üstü çizili fiyat çıkmaz.
- **Geçmişin gecikmesi:** Geçmiş olaylarla ve saatlik kontrolle yazılır. Yeni başlamış bir liste henüz yazılmamışsa canlı fiyat "şimdi" noktası olarak hesaba katılır.
- **Store API:** Karar "ürün yanıtına `price_display`" diyordu. Medusa'nın çekirdek ürün yanıtı değiştirilmediği için (Altın kural 2) ayrı uç açıldı: `GET /store/price-display?variant_id=…&currency_code=try`.
  - En çok 100 varyant alır; bilinmeyen ya da o para biriminde fiyatı olmayan varyant yanıtta yer almaz.
  - Paylaşılan önbellek 60 saniye tutar.
  - Tutarlar "80.00" biçimindedir; `rule_version` ve `basis` döner.
- **JSON-LD aynı kaynaktan:** Ürün sayfasının `seo.jsonLd` alanı aynı `priceDisplays` ile kurulur.
  - Teklifin `price` alanı satıştaki fiyattır; Google işaretlemedeki fiyatın sayfadakiyle aynı olmasını ister (docs/13). Önceden indirim sırasında bile taban fiyat yazılıyordu.
  - Üstü çizili fiyat `priceSpecification` içinde `UnitPriceSpecification` ve `priceType: StrikethroughPrice` olarak yazılır.
  - Satıştaki fiyatı olmayan varyantın teklifi çıkmaz. Çözümleme önbelleği en çok 30 saniye tutar.
- **Kanıt:** `lib/pricing/__tests__/display.unit.spec.ts`, `integration-tests/http/price-display.spec.ts`. Entegrasyon testi şunları gösteriyor:
  - indirim üstü çizili gösteriliyor;
  - 30 gün içinde görülmüş fiyata dönüş indirim sayılmıyor;
  - JSON-LD'nin fiyatı ve üstü çizili fiyatı Store ucuyla aynı (KK2).

## Uygulama notu (F4 kapanış incelemesi, 2026-10-27)

- **Yükselen indirimli fiyat:** Kesintisiz indirim serisi yalnızca fiyat indikçe tek indirim sayılır. 70'lik bir listeden 90'lık bir listeye geçiş yeni bir indirim başlatır ve önceki fiyatı son 30 günün en düşüğü (70) olur. Bu yüzden 90 TL, 120'nin üstü çizilerek gösterilmez (`lib/pricing/discount.ts`, testli).
- **Liste sınırları:** Dakikalık iş (`jobs/price-list-boundaries.ts`) son beş dakikada başlayan ya da biten fiyat listelerinin varyantlarını, kayıt zamanı sınır anı olacak şekilde yazar. Saatlik tam tarama kaçanlar için kalır. İki çalışma arasında (bir dakikadan kısa) başlayıp biten bir liste kaçabilir.
- **Okuma sırası:** Son fiyat, geçmişin her okuması gibi önce kayıt zamanına, sonra yazılış sırasına göre bulunur (geriye tarihli içe aktarım satırları için).
- **Store ucu:** `/store/price-display` yalnızca yayındaki ve publishable key'in satış kanalındaki ürünlerin varyantlarına cevap verir.


## Ek (2026-11-05): 10 gün ve otomatik kampanyalar (otonom, gözden geçir)

**Neden:** Atölye teması dev'de bir ürünü hızlı ekledi: kart 1.749,00 TL, sepet çekmecesi 1.224,30 TL gösterdi. Sebep dev mağazasındaki **%30 otomatik kampanya** (kodsuz, koşulsuz, `is_automatic`; PROGRESS'te D6 denemesinde de görülmüştü: 899,00 → 629,30 TL). Kampanyayı Medusa yalnız sepette uyguluyordu; kart ve ürün sayfası Medusa'nın `calculated_price`'ını (fiyat listesi dahil, kampanya hariç) gösteriyordu. Fiyat listesi, müşteri grubu ya da eski sepet satırı değildi: sepet fiyatı tam 1.749 × 0,70.

**Hukuk (2026-11-05'te metinden okundu):**

- Fiyat Etiketi Yönetmeliği md. 11/1 (RG 11.10.2025, sayı 33044, değişiklik md. 5; yayımında yürürlükte): "İndirimli satışa konu edilen mal veya hizmetin indirimden önceki satış fiyatının tespitinde, mal satışlarında indirimin uygulandığı tarihten önceki **on gün** içinde uygulanan en düşük fiyatı esas alınır." Çabuk bozulan mallar ve hizmetlerde indirimli fiyattan bir önceki fiyat.
- Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 14/3 (RG 1.7.2026, sayı 33297, değişiklik md. 4; yürürlük 1.8.2026): mal satışı reklamında indirimin başlangıç tarihinden önceki **on gün** içinde uygulanan en düşük fiyat. Md. 14/5: farklı satış kanallarında yalnız indirimin yapıldığı kanalın fiyatı esas alınır. Md. 14/7: indirimi belirli miktar, tutar ya da işleme bağlayan **koşullu satış** reklamlarına da bu madde uygulanır.
- Karardaki 30 gün (2022 metinleri) eskidi. **Kural sürümü `tr-10d-1`, pencere 10 gün** (`lib/pricing/discount.ts`, karardaki "tek yer"). Avukat teyidi docs/12'de sürüyor.

**Karar:**

- **Herkese uygulanan otomatik kampanya fiyattır.** Kodsuz (`is_automatic`), etkin, standart (X al Y öde değil), sipariş ya da kalem hedefli; kuralı yok ya da yalnız mağazanın para birimi; kampanya bütçesi kişi başı değil; birim başına aynı (yüzde, birim sınırı yok; ya da KDV dahil "her birimden N TL"). Böyle bir kampanya kartta, ürün sayfasında, JSON-LD'de, ürün akışında ve e-posta kampanyalarında fiyatın kendisidir; üstü çizili fiyat indirim öncesi kuralından gelir.
- **Hangi ürüne uygulandığına Medusa karar verir:** `promotion` modülünün `computeActions`'ı, her varyanttan bir birim tutan müşterisiz bir sepet bağlamıyla çağrılır (`workflows/pricing/automatic-offers.ts`). Durum, tarih, kullanım sınırı, bütçe ve hedef ürün/kategori/koleksiyon kuralları sepetteki gibi işler. Tutar Medusa'nın düzeltme tutarıdır (kuruşa bir kez yuvarlanır).
- **Geçmiş:** kampanyanın en erken başlayabileceği an (`created_at` ile kampanyanın `starts_at`'ının geç olanı) "indirimin başlangıcı" sayılır; o andan sonraki satış fiyatları kampanyalı hâliyle hesaba girer, başlangıçta yürürlükteki fiyat bir nokta olur (`lib/pricing/offers.ts` `pricesWithOffers`). Erken başlangıç üstü çizili fiyatı hiçbir zaman yükseltmez (pencere yalnız daha düşük fiyatlar görebilir).
- **Koşullu kampanya sepettedir.** En az sepet tutarı (`item_total gte`) tek koşulsa ürün sayfasında fiyatın yanında söylenir: "2.000,00 TL ve üzeri sepette %10 indirim" (`cart_offer`); sepet bütününden tutar indirimi (`across`) de böyle. Müşteri grubu, bölge, adres, "sepette şu ürün varsa", kişi başı sınır ve kodlu kampanya gösterilmez.
- **Store API:** `GET /store/price-display` aynı uç; `current` artık kampanya dahil, yeni alan `cart_offer: { type: "percentage" | "fixed", value, minimum } | null` (eklemeli).

**Kanıt:** `lib/pricing/__tests__/offers.unit.spec.ts` (sınıflama, birleşik indirim, 10 günlük pencere kampanyayla), `integration-tests/http/price-promotion.spec.ts` (%30 otomatik kampanya: görünen fiyat = sepetin kalem toplamı = JSON-LD fiyatı; en az sepetli kampanya yalnız `cart_offer`; kodlu, müşteri gruplu ve başka ürüne hedefli kampanya fiyatı değiştirmez; başlamamış kampanya beklenir).

**Açık kalanlar:** `/kampanyalar` sayfası yalnız fiyat listesindeki indirimleri tarar (kampanyalı ürünler henüz listelenmez); GA4 `view_item` fiyatı Medusa'nın fiyatıdır; hizmet ve çabuk bozulan mal için "bir önceki fiyat" kuralı ayrı tutulmuyor (platformda hepsi mal kuralıyla).

## Ek (2026-11-05, devam): `/kampanyalar` ve GA4 kampanyalı fiyatla

- **`/kampanyalar`:** herkese uygulanan otomatik kampanyanın indirdiği ürünler de listelenir; ölçüt kartla aynı (`priceDisplays` `on_sale`, 10 gün kuralı). Kampanya başladıktan sonra zamlanıp indirimi gösterilemeyen ürün listelenmez. Hesap ürün indekslenirken yapılır (adr/0056 Ek 2026-11-05); dizin listelerinde fiyat süzgeci ve sıralama da kampanyalı fiyatla.
- **GA4 / Meta:** `view_item`, `view_item_list` ve `add_to_cart` sayfanın gösterdiği fiyatı (`price-display` `current`, kampanya dahil) gönderir; liste kartındaki hızlı ekle de `add_to_cart` gönderir. `begin_checkout` ve `add_payment_info` kalemleri sepet satırının sunucu toplamı / adet (kampanya düşülmüş). `purchase` değişmedi (birim fiyat, backend sunucu olayıyla aynı).
- Açık kalanlar: hizmet ve çabuk bozulan mal için "bir önceki fiyat" kuralı; kanal başına referans fiyat (md. 14/5); harcama bütçesi kısmen dolmuş kampanya dizine geç yansır (adr/0056 Ek).
