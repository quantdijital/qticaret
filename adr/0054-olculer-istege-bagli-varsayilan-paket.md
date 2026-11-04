# ADR-0054: Ölçüler isteğe bağlı, kargo varsayılan paketle

- **Durum:** Kabul (2026-11-03)
- **Tarih:** 2026-11-03
- **İlgili:** ADR-0031 (kargo altyapısı, desi), ADR-0035 (Aras ve Yurtiçi), ADR-0042 (taşıma), docs/03 F3.1 ve F7.2, docs/14 P-DATA-05, docs/entegrasyonlar/yurtici.md

## Bağlam

F3.1 fiziksel ürünün her varyantı için ağırlık ve üç ölçüyü yayın şartı yapmıştı (`catalog.dimensions_required`). F7.2 de ölçüsü eksik ürünün kargo ücretini hesaplamıyordu (`shipping.dimensions_missing`). Sonuçları:

- Ölçüsüz ürün yayınlanamıyordu; katalog içe aktarmada reddediliyor, taşımada taslak geliyordu.
- WooCommerce mağazalarının çoğu ölçü girmediği için taşınan ürünlerin çoğu taslak kalıyordu.

Sahibin kararı (2026-11-03):

> "Fiziksel bir ürünü yayınlamak için her varyantın ağırlığı ve ölçüleri girilmeli. şu tarz zorunlulukları isteğe bağlı bırakabilirsin aynı şekilde kargo içinde her şeyi böyle zorunlu tutarsan çalışmamız zor olur. kargocu zaten desiyi kendisi özellikle hesaplar. müşteri hesaplamadan yollasa bile."

## Karar

1. **Ölçüler her yerde isteğe bağlı.**
   - Yayın ölçü beklemez. Yayın kuralı (`publish-rules.ts`, ürün kancaları, katalog adımı) kaldırıldı.
   - `catalog.dimensions_required` ve `shipping.dimensions_missing` anahtarları silindi.
   - Panelin yayına hazırlık listesinde ölçüler "önerilir"dir, zorunlu değildir.
2. **Varsayılan paket.**
   - Ayarlar > Kargo'da `shipping.default_parcel` (`weight`, `length`, `width`, `height`), mağazanın biriminde (g/kg, cm/mm).
   - Her değer sıfırdan büyük ve en çok 1.000.000 olmalı.
   - Kaydedilmemişken `null`. O zaman platformun paketi geçerlidir: **1 kg, 30 × 20 × 10 cm**, mağazanın birimine çevrilir.
   - Bu paket **2 desi** eder: hacim 6000 cm³ / 3000 = 2, ağırlık 1 kg. Türk taşıyıcılarının fiyat listelerinde küçük kolinin bandıdır.
   - Varsayılan `null` tutulur, sabit bir sayı tutulmaz. Böylece kg ya da mm kullanan mağazada "1000 kg" gibi bir yanlışlık olmaz.
3. **Kargo hesabı (`lib/shipping/parcel.ts`).**
   - Kalemde eksik olan her değer (boş ya da 0) varsayılan paketten alınır. Bu alan alan ve **birim başına** yapılır: 3 adet ölçüsüz ürün 3 varsayılan paket sayılır.
   - Yalnız ölçü olamayacak değer (sıfırdan küçük, sayı değil) `shipping.measures_invalid` ile durur.
   - Desi artık küçük kenarlı küpten değil, hacmin kendisinden hesaplanır. Önceden 30 × 20 × 10 cm'lik paket küpe çevrilince 2,1 desi ediyordu.
   - Tek adetlik koli kendi kutu şeklini korur. Birden çok adet, hacimleri toplanıp küp olarak gönderilir.
   - Kolideki her kalem kendi ölçüsünü taşıyorsa koli "ölçülü"dür (`Parcel.measured`).
4. **Taşıyıcılara ne gider.**
   - **Geliver:** fiyat listesi ve gönderi ölçü ister. Ürünün ölçüsü, yoksa varsayılan paket gider.
   - **Aras:** `VolumetricWeight` ve `Weight` alanlarına kolinin desisi ve ağırlığı gider. Ölçüsüz kalem için varsayılan paket kullanılır.
   - **Yurtiçi:** V3 belgesinde `desi` ve `kg` isteğe bağlıdır (H): yetki yoksa şube ölçer. Kolideki bir kalemin kendi ölçüsü yoksa ikisi de **gönderilmez**; uydurma değer gitmez. Bizim etiketimiz de yalnız gönderileni basar.
   - **Mağazanın ücret tablosu** (sepetteki fiyat) varsayılan paketle hesaplanır. Ürün sayfasının `shippingDetails` alanı da aynı ücreti gösterir. Dijital ve hizmet ürünlerinde kargo yoktur.
   - Akakçe beslemesindeki hacim ise yalnız ürünün kendi ölçüsünden gelir.
   - Taşıyıcı gerçek koliyi kendisi ölçer. Fark taşıyıcıyla mağaza arasındadır.
5. **İçe aktarma ve taşıma.**
   - Ölçüsüz satır artık reddedilmez ve taslağa çevrilmez; durumu tablonun ya da kaynağın durumudur.
   - İçe aktarma raporunda ürün satırına "Ölçü yok; kargo varsayılan paketle hesaplanır." notu düşer.
   - Taşımanın Notlar sayfasında da her ürün için `migration.product_no_parcel` notu düşer.
   - Taşımadaki "varsayılan paket" seçeneği isteğe bağlı bir kolaylık olarak kalır: verilen paket ölçüsüz ürünlerin kendi alanlarına yazılır.
6. **SEO advisor yalnız önerir.**
   - P-DATA-05 "yüksek"ten "düşük"e indi. Metni: "ölçü girilmezse kargo ücreti varsayılan pakete göre hesaplanır".
   - Yayın kapısı yalnız kritik bulgularda engeller. Bu kural hiçbir zaman engel değildir.
   - Kural sürümü 5 oldu: gece denetimi ürünleri yeniden puanlar.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Varsayılan paket, ölçü isteğe bağlı (seçilen)** | Yayın ve taşıma takılmaz; sepet her zaman ücret gösterir | Ölçüsüz üründe ücret tahmindir; fark taşıyıcı ölçünce çıkar |
| Ölçü zorunlu (önceki) | Ücret kesin | Sahip istemiyor; taşınan katalog taslak kalıyor |
| Ölçüsüz üründe sabit ücret | Basit | Ağır ya da büyük üründe çok yanlış; desi tablosuyla tutarsız |
| Yurtiçi'ye de varsayılan paketi göndermek | Tek kural | Belgeye göre alan isteğe bağlı ve şube ölçüyor: uydurma değer göndermek gereksiz |

## Sonuçlar

- Kargo ücretinin doğruluğu artık mağazanın varsayılan paketine bağlıdır. Panel bu paketin kaç desi ettiğini gösterir.
- Gösterge panelindeki "ağırlığı ya da ölçüsü eksik" sayacı bilgi olarak kalır.
- Önceden "ölçüsüz, taslak" gelmiş ürünler kendiliğinden yayına alınmaz. Sahip isterse yayınlar.

## Ek (2026-11-05): Önce gönder, eksikleri kendin doldur

Sahibin sözü (2026-11-04): "her şeye engel engel kargo çıkamıyoruz … düzelt şunları biraz özgür bırak bizi."

### Kural

"Kargoya ver" yolunda sert engel yalnız üç durumda kalır:

1. Taşıyıcının gerçek API'si o bilgi olmadan gönderiyi reddeder.
2. Müşteri bozuk bir çıktı görür (yanlış adrese giden koli, boş etiket).
3. Para ya da güvenlik söz konusudur.

Geri kalan her şey ya bildiğimiz yerden otomatik doldurulur ya da geçirilir. Siparişin kendi adresi değişmez: doldurulan adres koliye (`fulfillment.delivery_address`) ve taşıyıcıya gider. Onay penceresi yalnız geri alınamayan iş, para hareketi ve müşteriye giden mesaj içindir.

### Kendiliğinden doldurulanlar

- **Alıcı** (`workflows/shipping/steps/fill-receiver.ts`, `lib/shipping/fill.ts`):
  - Ad: teslimat adresinde yoksa fatura adresinden, o da yoksa müşteri hesabından. Şirket adı da alıcı adı sayılır.
  - Telefon: kuryenin arayabileceği biçime (0 ve 10 hane) çevrilir. `+90`, `0090`, `+90 0532…`, boşluk, parantez, tire ve tek alana yazılmış iki numara okunur. Teslimat adresindeki aranamıyorsa fatura adresinden, o da yoksa hesaptan alınır.
  - Ülke: boşsa Türkiye.
  - Posta kodu: yoksa adres verisinden (TürkiyeAPI; il + ilçe + mahalle/köy). Hiçbir taşıyıcıda alıcı için zorunlu değil.
  - Plaka kodu (Geliver `cityCode`): posta kodundan, yoksa adres verisindeki ilden. O da yoksa yalnız il adı gider.
- **Gönderici** (Geliver, `geliver-sender.ts`):
  - Depo: seçeneğin deposu, yoksa mağazanın varsayılanı, yoksa tek depo.
  - Telefon: deponun yoksa Ayarlar > Mağaza'daki iletişim telefonu.
  - Posta kodu: yoksa adres verisinden.
  - Depo yine eksikse Geliver hesabındaki varsayılan gönderici kullanılır: gönderiye `senderAddressID` konmaz (Geliver SDK README'si böyle diyor). Hesapta hiç gönderici adresi yoksa reddedilir; hata eksik parçayı ve ayar sayfasını adıyla söyler.
- **Depo ve profil**:
  - Kargo seçeneği eklerken varsayılan depo yoksa tek depo, varsayılan kargo profili yoksa tek profil kullanılır.
  - Kargoya verirken seçenek bir depo göstermiyorsa tek depo kullanılır. Birden çok depo varsa tahmin edilmez: stok yanlış depodan düşmesin.
- **Ölçü**: sıfırdan küçük ya da sayı olmayan değer artık "girilmemiş" sayılır. Varsayılan paket kullanılır, sepet ve koli durmaz. `shipping.measures_invalid` silindi.
- **Paketlenmiş koli**: paketlenmiş (Medusa'nın kendi yolu, içe aktarma) ama teslim edilmemiş koli ile koliye girmemiş ürünler birlikte ya da herhangi sırayla gider. Paketlenmiş kolinin kalemlerini adlandıran istek o koliyi teslim eder. Başka kalemler ayrı koliyle gider. `orders.ship_packed_first` silindi. Panelde ikisi aynı pencerede seçilir.
- **Panel takip bilgisi**: takip numarasındaki boşluklar atılır. Şemasız ya da `http://` bağlantı `https://` olur.

### Kalan engeller ve nedenleri

| Anahtar | Nerede | Neden kalıyor | Kaynak |
|---|---|---|---|
| `orders.test_payment_not_shippable` | `lib/payments/shippable.ts` | Para: test ödemesiyle gerçek koli çıkmaz. Test modundaki taşıyıcıyla gider | ADR-0027 |
| `orders.payment_awaited` | aynı | Para: havalesi gelmemiş sipariş | ADR-0029 |
| `orders.ship_canceled_refund` | `plan-shipment.ts` | Para: iptalde parası iade edilmiş sipariş | güvenlik incelemesi 2026-10-28 |
| `returns.exchange_awaiting_return` | `plan-shipment.ts` | Para: eski ürün dönmeden yenisi gitmez | ADR-0032 §6 |
| `fraud.review_*` | `fraud/steps/not-held.ts` | Güvenlik: incelemedeki sipariş | ADR-0044 |
| `orders.nothing_to_ship`, `orders.ship_items_invalid` | `plan-shipment.ts` | Gönderilecek ürün yok ya da kalandan fazlası istendi | — |
| `shipping.cod_single_parcel` | `plan-carrier.ts` | Para: kurye tutarın tamamını bir kolide tahsil eder. İkinci koli yeniden tahsil eder, parça eksik tahsil eder | ADR-0029 |
| `yurtici.cod_account_missing` | Yurtiçi sağlayıcısı | Taşıyıcı reddeder: ödeme tipi kullanıcıdır, ana hesapla tahsilatlı gönderi 82512 alır | Yurtiçi V3, docs/entegrasyonlar/yurtici.md |
| `shipping.carrier_not_connected` | `lib/shipping/shop.ts`, `geliver-sender.ts` | Taşıyıcı çağrılamaz | ADR-0035 §6 |
| `shipping.use_ship_route`, `shipping.additional_data_reserved` | sağlayıcılar, ara katman | Güvenlik: Medusa'nın kendi yolu gönderi açamaz | ADR-0031 |
| `shipping.no_offer` | Geliver sağlayıcısı | Taşıyıcı reddeder: teklif yoksa etiket alınamaz | Geliver |
| `shipping.receiver_abroad` | `lib/shipping/receiver.ts` | Yurt içi taşıyıcı yurt dışına gönderi açmaz (Aras `IsWorldWide=0`) | — |
| `shipping.receiver_name_missing` | aynı | Taşıyıcı reddeder: Yurtiçi `receiverCustName` (E, 60018), Geliver `name`, Aras `ReceiverName` | Yurtiçi V3, Geliver SDK `requests.ts` |
| `shipping.receiver_address_missing` | aynı | Taşıyıcı reddeder: Yurtiçi `receiverAddress` (E, 60019), Geliver `address1` | aynı |
| `shipping.receiver_phone_missing` | aynı | Taşıyıcı reddeder: Yurtiçi `receiverPhone1` (E, 10 hane, 82516), Geliver telefon zorunlu | Yurtiçi V3, Geliver README |
| `shipping.receiver_place_missing` | aynı (Geliver, Aras) | Geliver `cityName`/`districtName` istiyor. Aras'ın belgesi açık değil, kurye il/ilçeyle yönlendiriyor. **Yurtiçi'de yok:** `cityName`/`townName` isteğe bağlı (H), gönderilmez | Geliver SDK, Yurtiçi V3 |
| `shipping.receiver_name_short`, `shipping.receiver_address_short` | Yurtiçi sağlayıcısı | Taşıyıcı reddeder: ad en az 5 karakter ve 4 harf, adres en az 10 harf/rakam (82502) | Yurtiçi V3 |
| `shipping.sender_*_missing`, `shipping.sender_contact_missing` | `geliver-sender.ts` | Yalnız Geliver hesabında hiç gönderici adresi yokken: Geliver göndericinin telefonu, posta kodu ve e-postası olmadan adres açmıyor | Geliver SDK README, `requests.ts` |
| `shipping.setup_incomplete` | `shipping-options.ts` | Yalnız birden çok depo varken ve hiçbiri varsayılan değilken | — |
| Medusa: stok kaydı (rezervasyon) yok, profil uyuşmazlığı, depo yok | `createOrderFulfillmentWorkflow` | Medusa çekirdeği; çekirdek değişmez (CLAUDE.md kural 2). Depo yokken tek depo verilir | Medusa 2.21.2 kaynağı |

Aras'ın `SetOrder` belgesi herkese açık değil (servis tanımında her alan `minOccurs=0`). Bu yüzden Aras için kurye açısından gerekli olan (ad, adres, il/ilçe, telefon) korunur. Sahte Aras yalnız alıcı adı yokken reddeder. Gerçek hesapla denenecek.

### Sahte taşıyıcılar

- **Sahte Geliver**:
  - `senderAddressID`'siz gönderiyi hesabın ilk gönderici adresinden açar, adres yoksa reddeder.
  - Gönderici adresinde il için `cityCode` ya da `cityName`'den biri yeter. Eskiden yalnız `cityCode` kabul ediliyordu; bu gerçeğinden katıydı.
  - Alıcıda yalnız telefon zorunlu.
- **Sahte Yurtiçi**: belgeyle aynı kalır. Boş il/ilçe gönderilmediği için sorun yok.
- **Sahte Aras**: belgeyle aynı kalır.

### Hata mesajları

`shipping.address_incomplete` ve `shipping.sender_address_incomplete` genel yedek olarak kalır. Taşıyıcı kuralları artık eksik parçayı kendi anahtarıyla söyler (`shipping.receiver_*`, `shipping.sender_*`). Her mesaj nereden düzeltileceğini yazar: sipariş sayfası, Ayarlar > Depolar, Ayarlar > Mağaza ya da Geliver paneli. `shipping.location_unknown` silindi.
