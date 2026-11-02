# Yurtiçi Kargo Fulfillment Provider

> Kaynak: Yurtiçi Kargo "Web Servis Giden Kargo Teknik Döküman V3" (2020 sürümü; mağaza sahibi verdi, 2026-11-02). Belge "Hizmete Özel" işaretli, repoya konmadı. Karar: ADR-0035 (ek 2026-11-02). Kod: `apps/backend/src/lib/shipping/yurtici` (istemci, yanıt okuma, eşleme, durum, etiket), sağlayıcı `apps/backend/src/modules/fulfillment-yurtici`, sahte servis `packages/testing/src/yurtici`.

## Erişim ve hesaplar

- Servis tanımı (SOAP, JAX-WS), ad alanı `http://yurticikargo.com.tr/ShippingOrderDispatcherServices`:
  - Test: `https://testws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices?wsdl`
  - Canlı: `https://ws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices?wsdl`
- **IP izni zorunlu.** Servise erişecek **sabit** çıkış IP'leri "Erişim Yetkilendirme Formu" (Tablo 1: müşteri adı, çıkış IP, erişilen kaynak, sorumlu, telefon, e-posta) ile bağlı olunan Bölge Müdürlüğündeki satış temsilcisine ya da Yurtiçi Bilgi Sistemleri'ne bildirilir. IP değişirse form yenilenir.
- Test hesabı belgede herkese açık: kullanıcı `YKTEST`, dil `TR`, ödeme tipi Gönderici Ödemeli. Canlı kullanıcıyı Bölge Müdürlüğü satış temsilcisi verir.
- **Ödeme tipi bir alan değil, kullanıcıdır.** Gönderici Ödemeli, Alıcı Ödemeli, Gönderici Ödemeli Tahsilatlı Teslimat ve Alıcı Ödemeli Tahsilatlı Teslimat için ayrı kullanıcılar tanımlanır; istemci doğru kullanıcıyla göndermelidir. Bizde:
  - ana hesap (`username`/`password`) = Gönderici Ödemeli;
  - kapıda ödeme hesabı (`cod_username`/`cod_password`, isteğe bağlı) = Gönderici Ödemeli Tahsilatlı Teslimat.
  - Alıcı ödemeli gönderi desteklenmiyor.
- Kimlik alanları: `createShipment` ve `cancelShipment` `wsUserName`, `wsPassword`, `userLanguage`; `queryShipment` ise `wsLanguage` alır (belgede de böyle).

## Süreç

1. Erişim formu ve IP izni.
2. Test ortamında `createShipment` ile gönderi açılır, `cargoKey` Yurtiçi Bilgi Sistemleri'ne iletilir.
3. Yurtiçi test ortamında gönderiyi "düzenler" (taşıma belgesi keser).
4. Düzenlenen gönderi `queryShipment` ile sorgulanır.
5. `cancelShipment` ile iptal denenir, sonucu kontrol edilir.

Canlı akış: kargo anahtarı koli ya da sevk irsaliyesi üzerinde metin/barkod olarak bulunur; şube okutur, alıcıyı ekranda görür, varış şubesini belirler, adet ve desiyi girer, Yurtiçi taşıma irsaliyesini ve **kendi barkod etiketini** basar. Gönderi düzenlendikten sonra iptal edilemez.

## createShipment (`ShippingOrderVO`)

Belgedeki sınırlar ve bizim gönderdiğimiz (`mappers.ts`). E: zorunlu, H: isteğe bağlı.

| Alan | Tip | Z. | Kural | Bizde |
|---|---|---|---|---|
| `cargoKey` | String(20) | E | Şube koliden okur | `QT` + 14 karakter (`shipmentCode`) |
| `invoiceKey` | String(20) | E | Gönderi başına tekil | `cargoKey` ile aynı (fatura bazlı çalışma, belgedeki örnek de aynı) |
| `receiverCustName` | String(200) | E | En az 5 karakter, en az 4 harf | Ad + soyad; kural gönderimden önce denetlenir |
| `receiverAddress` | String(500) | E | İl/ilçe ayrı alanlarda gönderiliyorsa adreste olmaz; en az 10 harf/rakam | Mahalle + `address_1`, il ve ilçesiz; ≥10 harf/rakam denetlenir, 500'de kesilir |
| `cityName` / `townName` | String(40) | H | | İl `province`, ilçe `city` (ADR-0008) |
| `receiverPhone1` | String(20) | E | Alan koduyla **10 rakam** | Baştaki 0 atılarak 10 rakam |
| `receiverPhone2/3` | String(20) | H | 10 rakam | Gönderilmiyor |
| `desi` / `kg` | Double(9,3) | H | Yalnızca kullanıcının yetkisi varsa kaydedilir; yoksa şube ölçer | Desi = hacim / 3000 (bir ondalık yukarı), kg ayrı; nokta ile, 3 ondalık |
| `cargoCount` | Integer(4) | H | | 1 |
| `waybillNo` | String(20) | H | **Ticari gönderilerde zorunlu** | Gönderilmiyor (açık soru) |
| `specialField1` | String(200) | H | `alan$değer#` biçimi, alan adı Yurtiçi'de tanımlı olmalı | Gönderilmiyor |
| `specialField2/3` | String(100) | H | | Gönderilmiyor |
| `ttCollectionType` | String(1) | H | 0 nakit, 1 kredi kartı | Kapıda ödemede 0 |
| `ttInvoiceAmount` | Double(18,2) | H | Ayraç nokta | Kuruştan, nokta ile (`249.90`) |
| `ttDocumentId` | Long(12) | H | Tahsilatlı teslimat fatura no | Sipariş numarası; kapıda ödeme değilse boş öğe |
| `ttDocumentSaveType` | String(1) | H | 0 aynı fatura, 1 ayrı fatura | Kapıda ödemede 0 |
| `dcSelectedCredit` / `dcCreditRule` | long(2) | H | Yalnızca kartla tahsilatta zorunlu; kural 0 müşteri seçimi, 1 tek çekim | Boş öğe |
| `taxOfficeId` | Long(8) | H | | Boş öğe |
| `taxNumber`, `taxOfficeName` | String(11/60) | H | Vergi no doğrulama algoritmasından geçer | Gönderilmiyor |
| `orgReceiverCustId`, `orgGeoCode`, `privilegeOrder`, `custProdId` | String | H | | Gönderilmiyor |
| `emailAddress` | String(200) | H | Geçersizse 82515 | Gönderilmiyor (KVKK: veri azaltma) |
| `description` | String(255) | H | | `Sipariş <no>` |

- **Boş öğeler:** belgenin örnek istekleri `taxOfficeId`, `ttDocumentId`, `dcSelectedCredit`, `dcCreditRule` öğelerini boş gönderiyor (servis tanımı bu öğeleri istiyor). Biz de kullanılmadıklarında boş gönderiyoruz; önceden `0` gidiyordu ve `dcCreditRule=0` "müşteri seçimi zorunlu" anlamına geliyordu.
- **Kapıda ödeme:** `ttCollectionType=0` ise `ttInvoiceAmount`, `ttDocumentId`, `ttDocumentSaveType` boş olamaz; `=1` ise ayrıca `dcSelectedCredit` ve `dcCreditRule`. Bizim kapıda ödememiz yalnızca nakit (ADR-0029'da tahsil şekli seçimi yok).
- **Kargo bazlı çalışma** (bir gönderide birden çok koli: her koliye ayrı `cargoKey`, gönderiye ortak `invoiceKey`, koli başına desi/kg; operasyon onayı gerekir) kullanılmıyor; her gönderi tek koli.
- **Yanıt** (`ShippingOrderResultVO`): `outFlag` 0 en az bir kayıt başarılı, 1 tümü hatalı, 2 beklenmeyen hata; `jobId` Yurtiçi talep no; satır başına `cargoKey`, `invoiceKey`, `errCode` (başarılıda 0), `errMessage`. Tek kayıt gönderdiğimiz için başarı = `outFlag` 0 ve satırın `errCode`'u 0.

### Hata kodları (createShipment)

| Kod | Anlam |
|---|---|
| 0 | Başarılı |
| 936 | Beklenmeyen hata (Yurtiçi BİM ile görüşülür) |
| 80859 / 82500 | Kargo anahtarı yok / çok uzun |
| 60020 | Kargo anahtarı sistemde mevcut |
| 80057 | Talep kodu (jobId) bulunamadı |
| 60017 / 82501 | Fatura anahtarı yok / çok uzun |
| 60018 / 82503 | Alıcı adı yok / çok uzun |
| 60019 / 82502 | Alıcı adresi yok / uzunluğu 10–500 dışında |
| 82505 / 82506 | TT tutarı yok / çok uzun |
| 82507 / 82508 | TT fatura no yok / çok uzun |
| 82509 / 82510 | Taksit seçimi yok / çok uzun |
| 82511 / 82518 | Taksit kriteri yok / hatalı |
| 82512 | Sözleşmedeki ödeme tipiyle gönderilen ödeme tipi uyuşmuyor |
| 82513 | Hatalı `ttCollectionType` |
| 82514 | Hatalı `ttDocumentSaveType` |
| 82515 | Hatalı e-posta |
| 82516 | Hatalı telefon |
| 82517 | Hatalı biçim (ör. `specialField1`, özel alan 100 karakteri aşarsa) |

## cancelShipment

- Giriş: kimlik + `cargoKeys` (dizi).
- Gönderi düzenlenmeden (şubede fatura kesilmeden) önce iptal başarılıdır, kargo çıkışı engellenir.
- **Gönderi düzenlenmiş ve `IND` ise iptal, iade isteğine dönüşür**; iade isteği geri alınmaz, kargo çıkış birimine döner.
- Yanıt (`ShippingOrderResultVO`): `outFlag`, `senderCustId`, `count`, satır başına `shippingCancelDetailVO` (`cargoKey`, `invoiceKey`, `jobId`, `docId`, `operationCode`, `operationMessage`, `operationStatus`, `errCode`, `errMessage`).
- Hata kodları: 82519 bu kullanıcıda böyle kargo anahtarı yok; 82520 anahtar daha önce iptal edilmiş (belgenin hatalı örneği: `outFlag` 1 ve bu kod).
- **Bizde:** yalnızca `CNL` (çıkış engellendi), `ISC` (önceden iptal) ve 82520 geri çekme sayılır. `IND` → `return_requested` hatası, `DLV` → `status_dlv` hatası, durumsuz yanıt → `rejected`. Böylece Medusa'da gönderim iptal görünmez, takip iadeyi izler.

## queryShipment

- Giriş: kimlik (`wsLanguage`), `keys` (dizi), `keyType` (0 kargo anahtarı, 1 fatura anahtarı), `addHistoricalData` (hareket geçmişi, varsayılan false), `onlyTracking` (yalnızca takip bağlantısı, varsayılan false). Bizde `keyType=0`, ikisi de false.
- **1 dakika içinde tekrarlanan sorgu exception fırlatır** (SOAP fault). Takip işi gönderi başına dakikada en çok bir kez okur; hesap kontrolü her seferinde yeni bir anahtar sorar.
- Yanıt (`ShippingDeliveryVO`): `outFlag`, `senderCustId`, `count`, anahtar başına `shippingDeliveryDetailVO` (`cargoKey`, `invoiceKey`, `jobId`, `docId`, `operationCode/Message/Status`, `errCode`, `errMessage`) ve içinde `shippingDeliveryItemDetailVO` (çıkış/varış birimleri, `cargoEventId/Explanation`, `cargoReasonId/Explanation`, `docId`, `documentEventId`, teslim bilgisi, `rejectStatus*`, `returnStatus*`, toplam desi/kg/ücret, `trackingUrl`, `invDocFieldVOArray`, `invDocCargoVOArray`).
- **Bilinmeyen anahtar:** `outFlag` 0, satırda `cargoKey` **yok**, `errCode` 82519. Hesap kontrolü ve kapıda ödeme hesabına düşme buna göre okunur.
- Diğer kodlar: 82526 `keys` hatalı/eksik, 82527 `keyType` hatalı/eksik.
- `trackingUrl` belgeye göre `onlyTracking`'e bağlı ve örnekte `http://selfservis.yurticikargo.com/...`. Yalnızca https ve `yurticikargo.com` bağlantısı alınır; yoksa gönderi numarasından Yurtiçi'nin herkese açık sorgu sayfası kurulur.
- Alıcı ve gönderici adları yanıtta maskeli gelir (`HA** YA**`).

### operationStatus / operationCode

| Durum | Kod | Mesaj | Bizim durum |
|---|---|---|---|
| NOP | 0 | Kargo işlem görmemiş | `created` |
| IND | 1 | Kargo teslimattadır | `in_transit` (son olay "dağıtım" ise `out_for_delivery`) |
| IND | 1 | İade isteği alınmıştır (düzenlenmiş gönderiye iptal) | `returned` |
| ISR | 2 | İşlem görmüş, faturası henüz düzenlenmemiş | `picked_up` |
| CNL | 3 | Kargo çıkışı engellendi | `canceled` |
| ISC | 4 | Önceden iptal edilmiş | `canceled` |
| DLV | 5 | Teslim edilmiş | `delivered` |
| BI | 6 | Fatura şube tarafından iptal edilmiş | `canceled` |

Durum harflerden okunur; kod yalnızca harf yoksa kullanılır (aşağıdaki tutarsızlık).

### rejectStatus (iade) ve returnStatus (geri dönüş)

- `rejectStatus` 0 iade isteği, 1 çıkış şubesi onayladı, 2 bölge onayladı, 3 müşteri onayladı, 9 iade yapıldı, 10 iade sonlandırıldı → **iade sürecinde** → `returned`. 4 bekletiliyor, 7 teslim iptal, 8 borçlandırma iptal, 11 onaylanmadı → iade iptal, normal süreç.
- `returnStatus` (0–3) geri dönüşlü hizmetin (ör. imzalı belge dönüşü) durumu, iade değildir; durum okumada kullanılmaz.
- `reasonDesc` iade nedenleri listesi (adres yanlış/yetersiz, alıcıya ulaşılamıyor, kabul edilmedi, ücret nedeniyle kabul edilmedi, tahsil edilemedi, taşınmış, müşteri isteği vb.); yanıt tablosunda bu adla bir alan yok.

## Etiket

Yurtiçi etiket ucu vermez: taşıma belgesini ve barkod etiketini şube, bizim gönderdiğimiz veriden basar. Belgenin istediği tek şey kargo anahtarının koli ya da sevk irsaliyesi üzerinde metin/barkod olarak bulunmasıdır. Bizim PDF etiketimiz `cargoKey`'i Code 128 barkod ve metin olarak basar; alıcı, sipariş no, desi/kg ve kapıda tahsil tutarı da üzerindedir (ADR-0035 §4).

## Medusa metot eşlemesi

| Medusa | Yurtiçi | Not |
|---|---|---|
| getFulfillmentOptions | — | `yurtici-flat`, `yurtici-table` |
| calculatePrice | — | Mağazanın desi tablosu (desi = max(kg, hacim/3000)) |
| createFulfillment | `createShipment` | Alıcı kuralı önce denetlenir (`shipping.address_incomplete`); yanıt gelmezse aynı anahtarla `cancelShipment` |
| cancelFulfillment | `cancelShipment` | Yalnızca CNL/ISC/82520 başarı |
| takip işi | `queryShipment` | Ana hesap, bulunmazsa (82519) kapıda ödeme hesabı |
| hesap kontrolü | `queryShipment` (rastgele anahtar) | Fault ya da satırsız yanıt → `secret_invalid` |

## Belgedeki tutarsızlıklar ve seçimimiz

- **Kod/durum:** tablolarda CNL=3, örnek iptal yanıtında CNL=2 ve DLV=1. Durum harfleri esas alındı.
- **Adres uzunluğu:** açıklama "en çok 200", alan tipi String(500), servis mesajı "min 10 max 500". 500 kullanıldı.
- **Telefon:** tablo örneği `02123652426` (11 hane), metin ve tüm SOAP örnekleri 10 hane. 10 hane gönderiliyor.
- **Tutar ayracı:** alan "ayraç nokta olmalı" diyor, SOAP örnekleri `45,35`. Nokta gönderiliyor.
- **İşlem adı:** örneklerin bir kısmı `ship:dispatch` / `dispatchResponse` kullanıyor; servis tanımı ve .NET örneği `createShipment`. `createShipment` kullanılıyor, yanıt öğesi adından bağımsız okunuyor. İptal bölümündeki "Servis Input" örneği de yanlışlıkla bir gönderi açma isteği.

## Açık sorular

- Hatalı kullanıcı adı/şifrenin dönüş biçimi belgede yok (şimdi: SOAP fault ya da 82519'suz satırsız yanıt → reddedildi).
- 1 dakikalık sorgu sınırı anahtar başına mı, kullanıcı başına mı? Kullanıcı başınaysa aynı dakikada hesap kontrolü ile sağlık kontrolü çakışabilir ve fault "reddedildi" sayılır.
- `desi`/`kg` alanları mağazanın kullanıcısında yetkili mi; desi böleni (3000) sözleşmede aynı mı?
- `waybillNo` "ticari gönderilerde zorunlu": mağazanın e-ticaret gönderileri bu kapsamda mı? E-irsaliye/e-fatura (F8) gelince doldurulabilir.
- `ttDocumentId` için sipariş numarası kabul ediliyor mu, yoksa fatura numarası mı şart (F8)?
- `ttDocumentSaveType` (hizmet bedeli aynı/ayrı fatura) mağazanın sözleşmesinde hangisi? Kapıda ödeme sözleşmesi nakit mi, kart mı (82512)?
- `NOP`/`ISR` bir iptal yanıtında dönerse anlamı (şimdi geri çekme sayılmıyor).
- Takip bağlantısı `onlyTracking=false` iken de geliyor mu; https `selfservis.yurticikargo.com` çalışıyor mu? Şimdiki yedek sayfa (`yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=`) belgede yok.
- İade süreci 0–3'ten sonra 11'e (onaylanmadı) dönerse: `returned` son durum olduğu için takip geri almaz.
- "Teslim edilemedi" gibi teslim denemesi olayları ve "dağıtımda" olayının metni belgede yok; `failed` son durum olduğu için yanlış eşleşme kalıcı olur.
- Barkod simgeleme (Code 128) belgede belirtilmiyor; şubede okutulması gerçek hesapla denenecek.
- Alıcıya e-posta (`emailAddress`) ile Yurtiçi bildirimi istenirse aydınlatma metni kapsamı.
