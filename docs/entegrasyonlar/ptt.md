# PTT Kargo Fulfillment Provider — araştırma

> Durum: **kodlandı, gerçek hesapla doğrulanmadı** (2026-11-26; aşağıda "Uygulama"). Araştırma 2026-11-26. Sıra MNG → Sürat → PTT (ADR-0035 Ek 2026-11-26). Gerçek hesapla doğrulanmamış her bilgi "doğrulanmadı" diye işaretli.
>
> Kaynaklar (hepsi 2026-11-26'da okundu):
> - PTT'nin **canlı servis tanımları** (WSDL, herkese açık): `https://pttws.ptt.gov.tr/PttVeriYukleme/services/Sorgu?wsdl` ve `https://pttws.ptt.gov.tr/GonderiTakipV2/services/Sorgu?wsdl`.
> - PTT Genel Müdürlüğü belgeleri, `ahmeti/ptt-kargo-api` (PHP, MIT, son push 2021-06-11) deposunda: "PTT & E-ticaret Firmaları Web Servis Entegrasyonu" (2017) ve "Ptt Veri Yükleme Web Servisi Kullanım Dokümanı" (2016); aynı depoda topluluğun derlediği **gönderi durum kodları** listesi (`03_PTT_Durum_Kodlari.md`, ~290 kod).
> - `hasokeyk/ptt-cargo-php` (PHP, lisans belirtilmemiş, son push 2026-08-06): PTT belgelerinin birleştirilmiş özeti (`docs/ptt_cargo_webservice.md`; kaynağı `PttVeriYukleme_EkDokuman.docx`, `GonderiTakipV2.doc`).
> - Sahibin verdiği WooCommerce eklentisi `kargo-entegrasyon` v0.1.0 (`class-ke-ptt.php`; yazarı ve lisansı belirsiz, yalnız veri olarak okundu, kod alınmadı).
> - Belgeler "3. Taraf gizlilik taahhütnamesi" imzalanmasını şart koşuyor; bu dosya yalnız herkese açık kaynaklardan derlendi, PTT belgesi repoya konmadı.

## Amaç ve kapsam

Mağaza kendi PTT sözleşmesiyle gönderi verisini PTT'ye önceden yükler, koliye barkod basar, takip eder, kabulden önce siler; kapıda ödemede ("ödeme şartlı") tutarı PTT tahsil eder. Aras/Yurtiçi ile aynı arayüz: `ptt_ptt` sağlayıcısı, taşıyıcı kaydında `ptt`, panelde hesap sayfası, sahte servis. Fiyat mağazanın sabit tutarı ya da desi tablosu (ADR-0035 §7).

Kapsam dışı: kuryenin adresten alması (`siparisIstekEkle2`), parçalı barkod (`kabulEkleParcaliBarkod`; PTT'de "henüz uygulanmıyor"), alternatif 2./3. adres, alt müşteri (`kabulEkle_altmusteri`), PTT'nin "2. Yöntem"i.

## Sağlayıcı özeti

- **Sözleşme Başmüdürlükle** yapılır; Başmüdürlük **müşteri numarası** (`musteriId`, 9–10 hane) ve **şifre** verir. Web servis belgelerinden önce "3. Taraf gizlilik taahhütnamesi" imzalanır (Başmüdürlükten).
- **PTT'nin iki yöntemi** (Entegrasyon Giriş belgesi, 2017):
  - **1. Yöntem (PTT'nin tercihi):** firma veriyi önceden yükler (`kabulEkle2`). PTT **barkod aralığı tahsis ettiyse** barkodlar yüklemeyle birlikte gönderilir. **Tahsis etmediyse**, PTT kabulde kendi barkodunu üretir ve "PTT barkodu ↔ firmanın kodu (sales code)" eşleşmesini firmaya iletmek için **firmanın bir web servis hazırlaması** gerekir (metotları ayrı bir belgede; elimizde yok).
  - 2. Yöntem: kabul anında PTT, firmanın servisini (`getValidation`, `GetConfirmation`) çağırır. PTT ağ sorunları yüzünden 1. yöntemi öneriyor.
  - **Karar önerisi: yalnız barkod aralığıyla çalışırız.** Aralık yoksa PTT'ye dışarıdan açık bir servis açmamız gerekir (yeni saldırı yüzeyi, her instance'a ayrı adres, PTT teknik personeliyle kurulum). Bunun yerine `musteriReferansNo` ile takip (`gonderiSorgu_referansNo`) çalışıyorsa aralıksız mod ikinci seçenek olur (doğrulanacak).
- **IP izni:** kaynaklarda geçmiyor (doğrulanmadı).

## API

Java/Axis2 SOAP servisleri. Ad alanları: yükleme `http://kabul.ptt.gov.tr` (tipler `http://kabul.ptt.gov.tr/xsd`), takip `http://takip.ptt.gov.tr` (tipler `.../xsd`). Alt öğeler **tipler ad alanıyla nitelikli** (`xsd:dongu`), Yurtiçi'nden farklı.

| Servis | Canlı | Test |
|---|---|---|
| Veri yükleme | `https://pttws.ptt.gov.tr/PttVeriYukleme/services/Sorgu` | `https://pttws.ptt.gov.tr/PttVeriYuklemeTest/services/Sorgu` |
| Gönderi takip | `https://pttws.ptt.gov.tr/GonderiTakipV2/services/Sorgu` | `https://pttws.ptt.gov.tr/GonderiTakipV2Test/services/Sorgu` |
| Bilgi (il/ilçe/ek hizmet kodları) | `https://pttws.ptt.gov.tr/PttBilgi/services/Sorgu` | — |

- **Uç adresi tuzağı:** yükleme WSDL'inin `soap:address`'leri **http** (`http://pttws.ptt.gov.tr/PttVeriYukleme/services/Sorgu.SorguHttpSoap11Endpoint/`); PTT belgesi de "endpoint adreslerini https olarak elle güncellemek gerekebilir" diyor. Biz adresi WSDL'den okumayız, https sabitleriz (şifre düz metin gitmez; Yurtiçi'deki `:9090` kararıyla aynı).
- SOAP 1.1 ve 1.2 uçları var; takip WSDL'inde yalnız SOAP 1.2 portu tanımlı (`SorguHttpSoap12Endpoint`). Topluluk örneği yüklemede SOAP 1.2 zarfı (`http://www.w3.org/2003/05/soap-envelope`), silmede 1.1 kullanıyor. Mevcut `soapEnvelope` yardımcısına 1.2 seçeneği gerekebilir (doğrulanacak).
- Test ortamında yüklenen barkod takipte görünmeyebilir (eklentinin notu; doğrulanmadı).
- PttBilgi servisi için PTT belgesinde herkese açık ortak bir kullanıcı/şifre yazılı; değeri buraya ve koda yazılmaz, gerekirse ortam değişkeni.
- Hız sınırı: belgelenmemiş. Yüklemede dosya (çağrı) başına en çok 1000 gönderi.

### `kabulEkle2` (gönderi yükleme)

Üst alanlar (`Input2`): `musteriId` (int, zorunlu), `dosyaAdi` (1–50, **müşteri no ile tekil, her çağrıda farklı**), `gonderiTip`, `gonderiTur`, `kullanici` (sabit `PttWs`), `sifre`, `dongu[]`.

- **`gonderiTip`/`gonderiTur` tutarsızlığı:** belgenin `kabulEkle2` tablosu `gonderiTur=KARGO`, `gonderiTip=NORMAL` diyor; `siparisIstekEkle2` tablosu tersini; örnek XML ve eklenti `gonderiTip=NORMAL`, `gonderiTur=KARGO`. Örnek XML'e uyulur.
- `dosyaAdi` silmede de istenir: gönderinin `data`'sında saklanır. Öneri: `<shipmentCode>-<UTC zaman damgası>`.

`dongu` (`InputDongu2`), bizim dolduracaklarımız:

| Alan | Kural (PTT belgesi) | Bizde |
|---|---|---|
| `aliciAdi` | 5–100, zorunlu | ad + soyad (5 karakter altı gönderimden önce hata) |
| `aAdres` | 5–255, zorunlu; il/ilçe kodu yoksa il ve ilçe adresin içinde ya da `aliciIlAdi`/`aliciIlceAdi`'de | mahalle + `address_1` |
| `aliciIlAdi`, `aliciIlceAdi` | 3–100 | `province`, `city` |
| `aIlKodu`, `aIlceKodu` | PttBilgi `ilceSorgula` kodları | gönderilmez (adlar yeter) |
| `aliciSms` | 10 rakam, başta 0 yok; SMS anlaşması varsa zorunlu | cep telefonu |
| `aliciTel` | 10 rakam | gönderilmez (eklenti cep numarasını buraya da yazıyor) |
| `aliciEmail` | e-posta bildirimi anlaşmada varsa zorunlu | gönderilmez (KVKK), sözleşme gerektirirse eklenir |
| `barkodNo` | **13 hane** (12 haneli aralık + kontrol hanesi), tekil | aralıktan sıradaki (aşağıda) |
| `musteriReferansNo` | 1–100, tekil | `shipmentCode()` |
| `agirlik` | **gram**, tam sayı | kg × 1000 |
| `desi` | double, en×boy×yükseklik/3000 | desi |
| `en`, `boy`, `yukseklik` | cm, desi anlaşmasında | koli ölçüsü biliniyorsa |
| `odemesekli` | `MH` mahsup (sözleşmeli fatura), `N` nakit, `UA` ücreti alıcıdan | `MH` (doğrulanacak) |
| `ekhizmet` | 2–40; kodlar birleştirilerek (`DKUA`) | kapıda ödemede `OS` |
| `odeme_sart_ucreti` | 12,2; teslimde alıcıdan alınacak ürün bedeli; `ekhizmet` `OS` içermeli | kapıda ödeme tutarı (TL) |
| `deger_ucreti` | sigorta (değer konulmuş); `ekhizmet` `DK` içermeli | 0 |
| `ucret` | taşıma ücreti, PTT kabulde yeniden hesaplar | 0 |
| `gondericibilgi` | sistemdeki müşteri dışında bir gönderici varsa | gönderilmez (eklenti mağaza adres alanları açıyor; gerekmez) |
| `iade*` | alıcıya ulaşmazsa özel iade adresi | gönderilmez (PTT göndericiye iade eder) |
| `rezerve1` | posta çeki no (8 hane) | boş |
| `rezerve2..5`, `teslim_tip`, `parcali_barkod_referans_no` | "boş gönderilmeli" | gönderilmez |

Yanıt (`Output2`): `hataKodu` (int, **1 başarılı**, diğerleri başarısız), `aciklama`, `dongu[]` (`OutputDongu2`: `barkod`, `donguHataKodu` (1 başarılı), `donguAciklama`, `donguSonuc` (bool)). Belge ayrıca `barkod_quid` (barkodun takip bağlantısı) diyor; **WSDL'de bu alan yok** (doğrulanacak). Eklenti "hataKodu 1 = başarılı" kuralını "doğrulanmalı" diye işaretlemişti; PTT belgesi (2016) bunu doğruluyor. Başarı = `hataKodu` 1 **ve** satırın `donguHataKodu` 1 ve `donguSonuc` true.

### Barkod aralığı ve kontrol hanesi

- PTT aralığı **12 hane** olarak verir; 13. hane kontrol hanesidir. Hesap (PTT belgesi, örnek `275036569845` → `6`): soldan başlayarak rakamlar sırayla **1 ve 3** ile çarpılır, toplam bir üstteki 10'un katına tamamlanır; toplam zaten 10'un katıysa kontrol hanesi 0. (EAN-13 ağırlıklarıyla aynı; eklentinin `check_digit`'i de böyle.)
- **Aralık yönetimi bizde** (en büyük iş ve risk):
  - Aralığın başı/sonu panelden girilir (ayar, gizli değil); sıradaki numara **veritabanında atomik** ayrılır (tek satırlık sayaç, `UPDATE ... RETURNING` ya da Postgres sequence; eklenti WordPress seçeneğinde tutuyor, yarışa açık). Aynı barkod iki koliye verilmemeli; başarısız yüklemeden sonra numara **yeniden kullanılmaz** (PTT'de yarım kayıt kalmış olabilir).
  - Aralık bitmeden uyarı: kalan < %10 ya da < 50 olunca panelde uyarı (engel değil); bitince "Kargoya ver" açık hatayla durur (`ptt.barcode_range_exhausted`).
  - Yeni aralık eklenince eskisinin kalanı kaybolmamalı (doğrulanacak: PTT aralıkları ardışık mı).
  - Mağaza aynı aralığı başka bir programda (PTT'nin kendi ekranı, pazaryeri) da kullanıyorsa çakışma olur: mağazaya sorulur, ayrı aralık istenir.

### `barkodVeriSil` / `referansVeriSil` (iptal)

- `barkodVeriSil` (`inpDelete`): `barcode`, `dosyaAdi`, `musteriId`, `sifre` → `OutputDelete` `hataKodu` (1 başarılı), `aciklama`. Yalnız "hatalı yüklenmiş ve **kabulü henüz yapılmamış**" veri silinir.
- `referansVeriSil` (`inpRefDelete`): `dosyaAdi`, `musteriId`, `referansNo`, `sifre`: referansa ait tüm veri grubu silinir.
- Kabul edilmiş gönderi bu yolla silinemez; PTT şubesinde iade/iptal gerekir. Red yanıtının kodu bilinmiyor (doğrulanacak).

### `etiketGetir` (WSDL'de var, belgelerde yok)

`EtiketGetirInput`: `barkodNo`, `musteriId`, `sifre` → `EtiketGetirOutput`: `epl_format` (string), `hataKodu`, `aciklama`, `rezerve1..3`. **EPL** (Eltron/Zebra yazıcı dili), PDF değil. Hiçbir kaynakta kullanımı anlatılmıyor (doğrulanmadı).

### `gonderiSorgu` (takip)

`Input`: `barkod`, `kullanici`, `sifre`. `kullanici` eklentide ve topluluk özetinde **müşteri numarası** ("kurumsal müşteri no"), şifre yüklemeyle aynı (doğrulanacak).

`OutputTum`: `sonucKodu` (int), `sonucAciklama`, `BARNO`, `ITARIH` (kabul tarihi), `IMERK` (kabul merkezi), `VMERK` (varış), `TESALAN` (teslim alan), `GONDEREN`, `ALICI`, `GR` (gram), `GONUCR`, `EKHIZ`, `ODSARUCR` (ödeme şartlı ücret), `DEGKONUCR`, `dongu[]` (`siraNo`, `ITARIH`, `ISAAT`, `IMERK`, `ISLEM` (metin), `IKODU` (kod)).

- **`gonderiSorgu2`** aynı girişle olay başına **`gonderiDurumId`** verir: durum eşlemesi bununla yapılır (metin yerine). Takipte `gonderiSorgu2` kullanılması önerilir.
- `gonderiSorgu_referansNo` / `gonderiSorgu_referansNo2`: `referansNo` ile (aralıksız mod için aday).
- `TESALAN`, `ALICI`, `GONDEREN` kişisel veri: okunmaz, saklanmaz.
- `sonucKodu` değerleri belgelenmemiş (doğrulanacak).

## Medusa metot eşlemesi

| Medusa | PTT | Not |
|---|---|---|
| getFulfillmentOptions | — | `ptt-flat`, `ptt-table` |
| calculatePrice | — | `flatQuoteOf` / `tableQuoteOf` |
| createFulfillment | barkod ayır → `kabulEkle2` | `qt_ship` zorunlu. `data`: `shipment_id` (= 13 haneli barkod; takip no da bu), `reference` (`shipmentCode`), `file_name` (`dosyaAdi`), `label_base64` (bizim PDF), `test`, `cash_on_delivery`. Belirsiz sonuçta `barkodVeriSil` ile geri çekme |
| cancelFulfillment | `barkodVeriSil` | `hataKodu` 1 başarı; kabul edilmişse red → gönderim kalır, takip sürer |
| takip işi | `gonderiSorgu2` | `gonderiDurumId` → durum (aşağıda) |
| hesap kontrolü | `gonderiSorgu` (aralık dışı uydurma barkod) | Giriş işlemi yok. `sonucKodu`/`sonucAciklama` şifre reddini nasıl söylüyor doğrulanacak; o zamana kadar yalnız "ulaşıldı" denetimi |
| taşıyıcı kaydı | — | `PTT_FULFILLMENT_PROVIDER_ID = "ptt_ptt"`, "PTT Kargo" |
| hesap | — | `integration-credentials` `ptt`: gizli `customer_id`, `password`; ayar `test_mode`, `barcode_range_start`, `barcode_range_end` (12 hane, doğrulanır) |

## Durum eşlemesi

`gonderiDurumId` → topluluk listesindeki üst durum (`ust_durum_id`) → bizim durum. Liste PTT'nin resmî listesi değil (bir kullanıcının derlemesi, 2021); **doğrulanacak**.

| Üst durum (id) | Örnek kodlar | Bizim durum |
|---|---|---|
| KABUL (1000) | 1 Kabul Edildi, 701 Kayıt Edildi | `picked_up` |
| GÜNCELLEME (1106), ÖDEME (3500), TALİMAT/DİĞER (9999, çoğu) | 159, 399 Ücret Yatırıldı | değişmez |
| SEVK (2000), GERİ ZİMMET (7500), DEPO (8500) | 77 Sevk Edildi, 3 Torbaya Eklendi, 174 2. Adrese Sevk, 650 PTT İşyerinde Bekliyor | `in_transit` |
| DAĞITIM (3000) | 7 Dağıtıcıya Verildi | `out_for_delivery` |
| EL TERMİNALİ (8000) | 532 Yerinde Yok, 600 Tanınmıyor | `out_for_delivery` (teslim denemesi; son durum değil) |
| TESLİM EDİLEMEDİ (6000) | 118 Diğer, 127 Askerde | **`in_transit`**: çoğu geçici; yalnız 109 İmha, 147 El Koyma gibi kalıcılar `failed` (liste gerçek hesapla ayrılır) |
| TESLİM (5000, 5501–5503) | 100 Teslim Edildi, 807 Muhataba Bizzat Teslim | `delivered` |
| İADE (4000) | 99 İade Edilecek, 151 İade-Tanınmıyor | `returned` |
| GÖNDERİCİSİNE TESLİM (5500) | 120 Göndericisine Teslim Edildi | `returned` |
| İADE İPTAL (4500), TESLİM İPTAL (5600), İMHA İPTAL (5700) | 165, 15, 501 | değişmez (bizde `returned`/`delivered` son durum; geri alınamaz — açık soru) |
| KABUL İPTAL (7000) | 2 İptal Edildi | `canceled` |
| SİSTEMDEN ÇIKARTILDI (9000), TASFİYE (999) | 21, 831 | `failed` |
| DİĞER (9999) kayıp/hasar | 180 Kayıp, 181 Hasar | `failed` |

Kabulden önce `gonderiSorgu` kayıt bulamaz → `created`. Takip bağlantısı: yanıttaki `barkod_quid` (varsa, yalnız https ve `ptt.gov.tr`), yoksa eklentinin kullandığı `https://gonderitakip.ptt.gov.tr/Track/Verify?q=<barkod>` (doğrulanmadı).

## Kapıda ödeme

- PTT'de adı **ödeme şartlı gönderi**: `ekhizmet` içine `OS` + `odeme_sart_ucreti` = tutar (TL, 2 ondalık). Ödeme şekli (`odemesekli`) kargo ücretinin kimden alınacağıdır, kapıda ödeme değil.
- Takipte `ODSARUCR` tahsil edilecek tutarı, 3500 "Teslim Edilen Gönderi Ücreti Yatırıldı" olayı paranın yatırıldığını gösteriyor (ileride mutabakat).
- Ek hizmet kodlarının mağazanın sözleşmesinde açık olması gerekir (PttBilgi `ekHizmetSorgula`); `OS` açık değilse yükleme reddedilir (doğrulanacak).

## Etiket

PTT etiket PDF'i vermez; `etiketGetir` EPL döndürür (belgesiz). Öneri:

1. **Kendi PDF etiketimiz** (Yurtiçi kalıbı, ortak etiket yardımcısı): 13 haneli barkod büyük barkod + metin, alıcı, il/ilçe, sipariş no, desi/kg, "Ödeme şartlı: X TL". Simgeleme: PTT koli barkodlarında yaygın olan **Code 128** (bizde hazır); PTT'nin istediği simgeleme ve zorunlu etiket alanları (gönderici, "Ödeme Şartlı" ibaresi, PTT logosu?) **doğrulanacak**. 13 rakam EAN-13'e de uyar ama ona geçmeden önce PTT'ye sorulur.
2. `etiketGetir` çalışıyorsa EPL'i saklayıp termal yazıcısı olan mağazaya indirme olarak sunmak (sonra).

## İade kodu

- İade başına kod üreten işlem yok. `iade*` alanları teslim edilemeyen gönderinin nereye döneceğini belirler, müşteri iadesi değildir.
- Öneri: mağazanın PTT ile anlaşmalı **sabit iade kodu / "ücreti alıcıdan" iade anlaşması** iade sayfasında gösterilir (ADR-0035 §8). PTT'de bunun nasıl yürüdüğü sözleşmeyle öğrenilir.

## Test planı

- **Sahte PTT** `packages/testing/src/ptt` (iki SOAP servisi tek sahte sunucuda, iki yol), `pnpm dev:ptt`, `PTT_BASE_URL` (yayında reddedilir):
  - `kabulEkle2`: kontrol hanesi yanlış barkod → satır hatası; aynı barkod ya da aynı `dosyaAdi` → hata; `aliciAdi` < 5 → hata; `OS`'suz `odeme_sart_ucreti` → hata; başarı `hataKodu` 1.
  - `barkodVeriSil`: kabulden önce 1, sonra red.
  - `gonderiSorgu`/`gonderiSorgu2`: bilinmeyen barkod → sonuçsuz; zamanla 1 → 77 → 7 → 100 olayları; teslim edilemedi → yeniden dağıtım senaryosu.
  - Yanlış şifre → `sonucKodu`/`hataKodu` ≠ 1 ve açıklama.
- **Birim testleri:** kontrol hanesi (PTT örneği `275036569845` → `6`, toplam 10'un katı → `0`), aralıktan atomik ayırma ve bitme uyarısı (eşzamanlı iki ayırma testi), gram/desi/telefon eşleme, `OS` + tutar, durum eşlemesi (üst durum tablosu, geçici "teslim edilemedi"), https sabitleme.
- **HTTP entegrasyon testi:** "Kargoya ver" iki koliyle art arda (farklı barkod), iptal, sahte PTT ile.
- Ortak sözleşme test paketi.

## Uygulama (2026-11-26)

- **Kod:** `lib/shipping/ptt` (istemci, eşleme, durum, kontrol hanesi), `modules/fulfillment-ptt` (`ptt_ptt`), `modules/ptt-barcode` (aralık tablosu `ptt_barcode_range`, migration `Migration20261126231504`), `workflows/shipping/ptt-barcodes.ts` + `steps/ptt-barcode.ts`, `GET/POST /admin/shipping-setup/ptt-barcodes`, `DELETE /admin/shipping-setup/ptt-barcodes/:id`; panel `Ayarlar > Kargo > PTT Kargo`; sahte PTT `packages/testing/src/ptt` (`pnpm dev:ptt`, 9112).
- **SOAP:** yükleme SOAP 1.1 (`SOAPAction: "urn:kabulEkle2"`), takip SOAP 1.2 (`application/soap+xml; action="urn:gonderiSorgu2"`). Sarmalayıcı (`input`, `inpDelete`) servis ad alanında, alanlar `…/xsd` ad alanında nitelikli (WSDL: iki şema da `elementFormDefault="qualified"`). Alanlar WSDL'deki sırayla. Adresler https sabit; test modunda `…Test/services/Sorgu`.
- **Hesap:** müşteri numarası (`customer_id`, ayar, 9–10 hane) + web servis şifresi (gizli, en az 3 karakter) + test modu. `kullanici` sabit `PttWs` (PTT belgesi); takipte `kullanici` = müşteri numarası. Hesap kontrolü: aralık dışı uydurma barkodla `gonderiSorgu2`; yanıt cümlesi şifre/kullanıcı/müşteri/yetki derse `secret_invalid`, değilse geçerli sayılır (yanlış şifrenin gerçek dönüşü doğrulanacak).
- **Barkod aralığı (sahip kararı: zorunlu):** aralık panelden girilir (12 hane iki uç, en çok 1.000.000 numara, çakışan aralık reddedilir). Numara ship workflow'unda, PTT hesabı bağlıyken, gönderi açılmadan alınır; servis tüm aralık satırlarını `FOR UPDATE` ile kilitler, en eski aralıktan sıradakini verir; ekleme/silme tabloyu `EXCLUSIVE` kilitler. Verilen numara hiçbir durumda (PTT reddi, belirsiz yanıt, iptal) yeniden verilmez. Hiç kullanılmamış aralık silinebilir; kullanılan kalır. Kalan < %10 ya da < 50 iken panelde uyarı; aralık yoksa `ptt.barcode_range_missing`, bitmişse `ptt.barcode_range_exhausted`. Test modunda da aralıktan numara harcanır.
- **Gönderi:** `kabulEkle2`, `dosyaAdi` = `<bizim kod>-<UTC zaman>` (silmede yeniden istenir, `data.file_name`'de saklanır), `musteriReferansNo` = bizim kod, `odemesekli` `MH`, kapıda ödemede `ekhizmet` `OS` + `odeme_sart_ucreti` (TL, nokta ayraçlı 2 ondalık). Ölçülü kolide gram/desi/cm; ölçüsüzde gönderilmez. Alıcı adı 5 karakterden kısaysa gönderimden önce `ptt.receiver_name_short`. E-posta ve ikinci telefon gönderilmez. Başarı: `hataKodu` 1 ve satırın `donguHataKodu` 1, `donguSonuc` true. PTT'nin kendi reddi (kodlu yanıt) hiçbir şey yüklemedi sayılır; belirsiz sonuçta (yanıt yok, sunucu hatası) hemen `barkodVeriSil`; silinemezse `ptt.withdraw_failed`.
- **İptal:** `barkodVeriSil`; reddedilir ve takip gönderiyi biliyorsa `ptt.already_accepted` (gönderi siparişte kalır, şubeden iptal).
- **Etiket:** ortak PDF etiketimiz, barkod 13 haneli PTT barkodu (Code 128), gönderici basılmaz (PTT sözleşmeden bilir); test modunda "TEST" kutusu.
- **Takip:** `gonderiSorgu2` olayları `siraNo` sırasıyla; `gonderiDurumId` tablodaki kodlarla, bilinmeyen kod Türkçe sözcüklerle eşlenir. `ALICI`, `GONDEREN`, `TESALAN` okunmaz. Takip numarası barkodun kendisi; bağlantı `https://gonderitakip.ptt.gov.tr/Track/Verify?q=<barkod>` (doğrulanacak).
- **Vitrin:** alt bilgide "PTT Kargo" işareti ve PTT'nin genel takip sayfası (`https://gonderitakip.ptt.gov.tr/`; doğrulanacak).

## Doğrulanacaklar (gerçek hesapla)

- Mağazaya barkod aralığı verilip verilmediği; verilmiyorsa `musteriReferansNo` ile takibin (`gonderiSorgu_referansNo`) eşleşme servisi olmadan çalışıp çalışmadığı.
- Aralıkların biçimi (ardışık mı, birden çok aralık), tükenince yeni aralığın nasıl istendiği.
- SOAP 1.1 mi 1.2 mi; nitelikli alt öğeler; test uçlarının gerçekten çalıştığı.
- `gonderiTip`/`gonderiTur` değerleri.
- Takipte `kullanici` = müşteri no mu; şifre aynı mı.
- `sonucKodu` ve `hataKodu` değerlerinin listesi; yanlış şifrenin dönüşü (hesap kontrolü için).
- `barkod_quid` gerçekten dönüyor mu.
- `gonderiDurumId` listesinin güncel resmî hali; "teslim edilemedi" kodlarından hangileri kalıcı.
- Etiket: barkod simgelemesi, zorunlu alanlar, kendi etiketimizin kabul şubesinde kabulü; `etiketGetir`'in ne verdiği.
- `odemesekli` (`MH` mi), `OS` ek hizmetinin sözleşmede açık olduğu, `odeme_sart_ucreti` ayracı.
- SMS/e-posta bildirimi sözleşmede varsa `aliciSms`/`aliciEmail` zorunluluğu (KVKK: aydınlatma metni).
- IP izni.

## Mağazadan istenecekler

- [ ] PTT Başmüdürlüğü ile imzalı kargo sözleşmesi ve imzalanmış **3. taraf gizlilik taahhütnamesi** (Başmüdürlükten alınır).
- [ ] PTT'nin verdiği **müşteri numarası** (9–10 hane) ve **web servis şifresi**.
- [ ] **Barkod aralığı**: PTT'den e-ticaret gönderileri için barkod aralığı tahsis edilmesini isteyin; başlangıç ve bitiş numaralarını (12 hane) bize iletin. Bu aralığı başka bir program ya da pazaryeriyle paylaşmayın.
- [ ] Sözleşmenizde **ödeme şartlı gönderi (kapıda ödeme)** ek hizmeti var mı; tahsil edilen paranın hangi hesaba yattığı.
- [ ] Kargo ücretinin nasıl ödendiği: sözleşmeli/aylık fatura (mahsup) mı, peşin mi.
- [ ] Alıcıya PTT'nin SMS/e-posta göndermesi sözleşmede var mı.
- [ ] Test için **test hesabı** verilip verilmediği; web servis için **IP izni** gerekip gerekmediği.
- [ ] Koli etiketinde PTT'nin istediği barkod türü ve zorunlu bilgiler (kabul şubesine sorun) ya da örnek bir PTT etiketi fotoğrafı.
- [ ] Desi/kg fiyat tablonuz ve desi böleniniz (genelde 3000).
- [ ] İade için anlaşmalı **iade kodunuz / ücreti alıcıdan iade** düzeniniz varsa ayrıntısı.
