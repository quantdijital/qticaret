# Sürat Kargo Fulfillment Provider — araştırma

> Durum: **araştırma, kod yok** (2026-11-26). Sıra MNG → Sürat → PTT (ADR-0035 Ek 2026-11-26). Gerçek hesapla doğrulanmamış her bilgi "doğrulanmadı" diye işaretli.
>
> Kaynaklar (hepsi 2026-11-26'da okundu):
> - Sürat'ın **canlı servis tanımı** (WSDL, herkese açık): `https://webservices.suratkargo.com.tr/services.asmx?WSDL`. İşlem adları, parametreler, `GonderiModel` alanları ve sayım tipleri (enum) buradan.
> - `emirhangungormez/suratkargoapi` (PHP, 3 commit, tarih/sürüm yok, lisans belirtilmemiş): README ve `src/SuratKargoClient.php`. README: "resmî bir PHP SDK'sı veya düzgün bir entegrasyon kılavuzu internette bulunmamaktadır".
> - Sahibin verdiği WooCommerce eklentisi `kargo-entegrasyon` v0.1.0 (`class-ke-surat.php`; yazarı ve lisansı belirsiz, yalnız veri olarak okundu, kod alınmadı).
> - Sürat'ın resmî entegrasyon belgesi elimizde **yok**; sözleşmeyle istenir.

## Amaç ve kapsam

Mağaza kendi Sürat sözleşmesiyle gönderi açar, etiket basar, takip eder, iptal eder; kapıda ödemede tutarı Sürat tahsil eder. Aras/Yurtiçi ile aynı arayüz: `surat_surat` sağlayıcısı, taşıyıcı kaydında `surat`, panelde hesap sayfası, sahte servis. Fiyat mağazanın sabit tutarı ya da desi tablosu (ADR-0035 §7).

Kapsam dışı: palet (`PaletOlustur`), pazaryeri ortak barkodu için pazaryeri alanları, alıcı ödemeli, şubeden teslim, kapıda ödeme mutabakatı (`KOdemeIslemleri`; ileride panelde rapor olabilir).

## Sağlayıcı özeti

- .NET ASMX SOAP servisi (SOAP 1.1 ve 1.2, aynı adres), ad alanı `http://tempuri.org/`, SOAPAction `http://tempuri.org/<İşlem>`. Aras'la aynı kalıp: mevcut SOAP istemcimiz (`lib/clients/xml`, `soapEnvelope`) yeter.
- **Tek adres, test ortamı yok** (WSDL'de tek `soap:address`; SDK test adresi vermiyor, eklentide test seçeneği yok). Sürat'tan test cari kodu istenir; verilmezse ilk denemeler canlıda, düşük tutarlı gerçek gönderiyle ve hemen `GonderiSil` ile yapılır (doğrulanmadı).
- **İki kimlik çifti olabilir** (SDK'ya göre; eklenti tek çift kullanıyor):
  - Gönderi açma/geri çekme: `KullaniciAdi` + `Sifre`.
  - Takip, barkod/etiket, silme: `CariKodu` (gönderen cari kodu) + web şifresi (`WebPassword` ya da `Sifre` adıyla).
  - Eklenti ikisine de "cari kodu (kullanıcı adı)" + "web servis şifresi" veriyor. Doğrulanacak; panelde iki çift alan açılır, ikinci çift boşsa birincisi kullanılır.
- **IP izni:** hiçbir kaynakta geçmiyor (doğrulanmadı).
- **Barkod yetkisi:** SDK README'ye göre Sürat barkod oluşturma yetkisini "neredeyse hiçbir zaman doğrudan tanımlamaz"; açtırmak için ayrıca istenmeli. Etiket stratejisi buna bağlı (aşağıda).

## API (servis tanımından)

Adres: `https://webservices.suratkargo.com.tr/services.asmx` (54 işlem). Bizim kullanacaklarımız:

| İş | İşlem | Parametreler | Dönüş |
|---|---|---|---|
| Gönderi (barkodsuz) | `GonderiyiKargoyaGonderYeni` | `KullaniciAdi`, `Sifre`, `Gonderi` (`GonderiModel`) | `string` |
| Gönderi + barkod | `GonderiyiKargoyaGonderYeniSiparisBarkodOlustur` | aynı | `MesajTipi`: `isError` (bool), `Message`, `Barcode` (tipsiz) |
| Ortak barkod | `OrtakBarkodOlustur` | aynı | `ResultMesaj`: `isError`, `Message`, `KargoTakipNo`, `Barcode` (dizi) |
| Etiket | `KargoBarkodu` | `cariKodu`, `WebPassword`, `ozelKargoTakipNo` | SDK'ya göre `OzelKargoTakipNo`, `KargoTakipNo`, `Aciklama`, `BarkodNo[]`, `PpdBarkod[]` (yazıcı kodu), `PdfBarkod` (base64 PDF) — şema alanları doğrulanmadı |
| İptal (silme) | `GonderiSil` | `cariKodu`, `WebPassword`, `ozelKargoTakipNo` | `string` |
| Geri çekme | `GonderiGeriCek` | SDK: `KullaniciAdi`, `Sifre`, `OzelKargoTakipNo`, `IptalNeden` | `string` |
| Takip (hareket) | `KargoTakipHareketDetayi` | `CariKodu`, `Sifre`, `WebSiparisKodu` | `string` (eklentiye göre JSON metni) |
| Takip (ayrıntılı) | `KargoTakipHareketDetayliV2` | `CariKodu`, `Sifre`, `WebSiparisKodu` | `string` (SDK'ya göre içinde kaçışlı XML) |
| Takip (genel) | `WebSiparisKodu` | `GonderenCariKodu`, `Sifre`, `WebSiparisKodu` | DataSet (`NewDataSet` satırları) |
| Toplu takip | `WebSiparisKoduToplu` | `GonderenCariKodlari[]`, `WebSiparisKodlari[]`, `Sifre` | DataSet (SDK: istekte en çok 100) |

Ayrıca var, şimdilik kullanılmaz: `KargoTakipHareketDetayiV2` (`KargoTakipNo` ile), `IadeKargolar` (tarih aralığında iade gelenler), `KapidanTakip`, `KOdemeIslemleri` (kapıda ödeme ödemeleri), `ATDurumListesi`, `ATDisiMahalleListesi` (adres dışı mahalle listesi), `KargomNeredeDetay`, `GonderiyiKargoyaGonder` (eski model).

### `GonderiModel` (servis tanımı; Z = minOccurs 1)

| Alan | Tip | Z | Anlam / eklenti ve SDK değeri | Bizde |
|---|---|---|---|---|
| `KisiKurum` | string | | Alıcı adı | ad + soyad |
| `SahisBirim` | string | | | boş |
| `AliciAdresi` | string | | | mahalle + `address_1` |
| `Il`, `Ilce` | string | | | `province`, `city` (ADR-0008) |
| `TelefonCep` | string | | 10 rakam (eklenti ve SDK normalize ediyor) | `receiver.ts` |
| `TelefonEv`, `TelefonIs`, `AliciKodu`, `SevkAdresi`, `TeslimSubeKodu`, `EntegrasyonFirmasi`, `AlimSaati`, `IrsaliyeSeriNo` | string | | | boş |
| `Email` | string | | | gönderilmez (KVKK: veri azaltma), zorunlu çıkarsa sipariş e-postası |
| `KargoTuru` | int | Z | eklenti: 1 dosya, 2 paket, 3 koli (doğrulanmadı) | 3 |
| `OdemeTipi` | int | Z | 1 gönderici, 2 alıcı (eklenti; doğrulanmadı) | 1 |
| `IrsaliyeSiraNo` | string | | irsaliye no | sipariş no |
| `ReferansNo` | string | | | sipariş no |
| `OzelKargoTakipNo` | string | | **bizim kodumuz**; iptal ve etiket bununla | `shipmentCode()` |
| `Adet` | int | Z | koli sayısı | 1 |
| `BirimDesi`, `BirimKg` | string | | **koli başına** desi/kg | desi (hacim/3000), kg; ayraç doğrulanmadı (nokta öneriliyor) |
| `KargoIcerigi` | string | | | `Sipariş <no>` |
| `KapidanOdemeTahsilatTipi` | int | Z | 0 yok; 1 nakit, 2 kredi kartı (eklenti + SDK) | 0 ya da 1 |
| `KapidanOdemeTutari` | string | | | TL, noktalı; kapıda ödeme yoksa `0` |
| `EkHizmetler` | string | | | boş |
| `TasimaSekli`, `TeslimSekli` | int | Z | eklenti ikisine de 1 | 1 (anlamı doğrulanmadı; `TeslimSekli` 1 = adrese teslim sanılıyor) |
| `GonderiSekli` | int | Z (nillable) | eklenti 0 | 0 |
| `Pazaryerimi` | int | Z | 0 | 0 |
| `Iademi` | bool | Z | iade gönderisi mi | false |

- **Hangi alan `WebSiparisKodu`?** Takip işlemleri `WebSiparisKodu` ister; eklenti buna `OzelKargoTakipNo`'ya verdiği anahtarı gönderiyor. SDK `referenceNo`'yu kullanıyor. İkisini de aynı koda (`shipmentCode`) bağlamak riski kapatır: `OzelKargoTakipNo` = `ReferansNo` = bizim kod mu, yoksa `ReferansNo` sipariş no mu kalmalı — doğrulanacak. Öneri: ikisi de bizim kod; sipariş no `IrsaliyeSiraNo`'da.

### Başarı nasıl anlaşılır (kırılgan)

- `GonderiyiKargoyaGonderYeni` ve `GonderiSil` **serbest metin** döndürüyor; başarı kodu yok.
  - Eklenti: "tamam" ya da "başarı" geçerse başarı ("Sürat dokümanından doğrulanmalı" diye işaretli); silmede "silindi" de.
  - SDK: gönderide metin boş değil ve "hata"/"başarısız" geçmiyorsa başarı; silmede "başarı" geçmeli.
  - Bizim kuralımız: bilinen başarı metinlerinin **izin listesi** (gerçek hesapla toplanır), geri kalan her şey red. "İçinde hata yoksa başarı" kuralı kullanılmaz: bilinmeyen bir mesaj gönderiyi açılmış gösterir.
- Barkodlu işlemler `isError` döndürüyor; çok daha güvenli. Mesaj `050` SDK'da "barkod yetkisi yok, ortak barkoda düş" anlamında kullanılıyor (doğrulanmadı).
- Takip `string` içinde JSON ya da XML döndürüyor: JSON `zod` şemasıyla, XML **kendi XML okuyucumuzla** (DOCTYPE/varlık reddi, ADR-0035 §3) okunur; SDK da DTD/ENTITY'yi reddediyor. Eklentiye göre JSON biçimi `{"IsError": bool, "errorMessage": "...", "Gonderiler": [...]}`; boş metin = kayıt yok (kargo şubeye verilmemiş olabilir).

## Medusa metot eşlemesi

| Medusa | Sürat | Not |
|---|---|---|
| getFulfillmentOptions | — | `surat-flat`, `surat-table` |
| calculatePrice | — | `flatQuoteOf` / `tableQuoteOf` |
| createFulfillment | barkod yetkisi varsa `GonderiyiKargoyaGonderYeniSiparisBarkodOlustur`, yoksa `GonderiyiKargoyaGonderYeni`; ardından `KargoBarkodu` | `qt_ship` zorunlu; belirsiz sonuç ya da etiket alınamazsa `GonderiSil` ile geri çekme. `data`: `shipment_id` (= `OzelKargoTakipNo`), `tracking_number` (`KargoTakipNo`, gelirse), `label_base64` |
| cancelFulfillment | `GonderiSil` | Yalnız izin listesindeki başarı metni. Şubede işlem görmüş gönderide ne döndüğü ve `GonderiGeriCek`'in ne zaman gerektiği doğrulanacak |
| takip işi | `KargoTakipHareketDetayi` (ya da `KargoTakipHareketDetayliV2`) | Metinden durum (aşağıda) |
| hesap kontrolü | rastgele kodla `KargoTakipHareketDetayi` | Giriş için ayrı işlem yok. Yanıt `IsError` + "şifre/kullanıcı" metni → `secret_invalid`; boş ya da "kayıt yok" → geçerli. Gönderi çiftini doğrulayan güvenli bir okuma yok (doğrulanacak; belki `MusteriBilgisi`) |
| taşıyıcı kaydı | — | `SURAT_FULFILLMENT_PROVIDER_ID = "surat_surat"`, "Sürat Kargo" |
| hesap | — | `integration-credentials` `surat`: gizli `username`, `password`, isteğe bağlı gizli `cari_code` + `web_password` (birlikte girilir; Yurtiçi kapıda ödeme hesabı kalıbı) |

## Durum eşlemesi

Takip yanıtı metin; servis tanımındaki sayım tipleri olay ve teslim durumlarının adlarını veriyor. Eşleme önce bu adlarla (yanıtta geçiyorsa), sonra Türkçe metinle yapılır. **Gerçek yanıtla doğrulanacak.**

`KargoHareketTip` (39 değer) → bizim durum:

| Sürat olayı | Bizim durum |
|---|---|
| `KargoAdrestenTeslimAlindi`, `KargoSubedeTeslimAlindi` | `picked_up` |
| `AracYolaCikti`, `AracVarisYapti`, `KargoAracaYuklendi`, `KargoAractanIndirildi`, `KargoAraciyaVerildi`, `KargoDevir`, `KargoParcalandi`, `KargoBirlestirildi`, `KargoParcaGiris`, `KargoButunGiris`, `YanlisSubede`, `KargoYonlendirme*`, `TeslimatNoktasinaIletildi` | `in_transit` |
| `KargoDagitimaCikti`, `KargoKuryeyeZimmetlendi` | `out_for_delivery` |
| `KargoAdresteTeslimEdildi`, `KargoSubedeTeslimEdildi`, `TeslimatNoktasinadanAlindi` | `delivered` |
| `TeslimatNoktasinaBirakildi` | `out_for_delivery` (alıcının alması bekleniyor; doğrulanacak) |
| `KargoAdresteIade`, `KargoSubedeIade`, `KargoIadeOnay` | `returned` |
| `KargoIadeTalep` | değişmez (iade henüz onaylanmadı) |
| `KargoIadeRet`, `KargoIadeTalepIptal` | değişmez |
| `KargoTeslimatiIptalEdildi` | değişmez, `provider_status`'a (anlamı doğrulanacak) |
| `Ihbar*`, `KargoBulundu`, `KargoYeniBarkodUretildi`, `KargoKuryedenZimmetAlindi` | değişmez |

`KTeslimatDurum`: `TeslimatHazirlik`, `TeslimEdildi` → `delivered`, `IadeEdilecek` → `returned`, `Yonlendirilecek`, `Devir`, `TeslimatNoktasiDevir`. `KIptalDurumu`: `Kullanimda`, `IptalIcinOnayda`, `IptalOnaylandi`, `IptalEdildi` → `canceled`, `Takipte`.

Türkçe metin yedeği (SDK'nın `resolveStatus` sırası, ilk eşleşen kazanır): "teslim edildi"/"teslimat yapıldı" → `delivered`; "dağıtıma"/"kuryede" → `out_for_delivery`; "şubede"/"transfer"/"aktarma"/"yolda" → `in_transit`; "teslim edilemedi"/"teslim edilmedi" → **`in_transit`** (bizde `failed` son durum, Sürat yeniden dener); "iade" → `returned`; "iptal"/"pasif" → `canceled`; "kabul"/"sevk"/"fatura" → `picked_up`; hiçbiri → `created`. Aras'taki ders geçerli: durum yalnız durum sütunundan okunur, alıcı adı/adresinden değil.

Takip bağlantısı (eklenti; doğrulanmadı): `https://suratkargo.com.tr/KargoTakip/?kargotakipno=<KargoTakipNo>`. `KargoTakipNo` Sürat'ın numarasıdır (bizim kod değil); kabulden önce yok, bağlantı o zaman kurulmaz.

## Kapıda ödeme

- `KapidanOdemeTahsilatTipi` 1 nakit (2 kredi kartı), `KapidanOdemeTutari` TL metin. Bizde yalnız nakit (ADR-0029). Ondalık ayracı (nokta/virgül) doğrulanacak.
- Kapıda ödemenin ayrı cari kod gerektirip gerektirmediği bilinmiyor (Yurtiçi'nde ayrı kullanıcı) — doğrulanacak.
- `KOdemeIslemleri` (cari kodu, web şifresi, tarih aralığı) tahsil edilen paraların ödemelerini veriyor: ileride panelde mutabakat.

## Etiket

1. **Barkod yetkisi varsa:** `KargoBarkodu` → `PdfBarkod` (base64 PDF) özel depoya, Aras gibi. `PpdBarkod` yazıcı kodu (ZPL olup olmadığı belli değil) saklanmaz.
2. **Yetki yoksa (Sürat'ta olağan durum):** kendi PDF etiketimiz (Yurtiçi kalıbı, `lib/shipping/yurtici/label.ts` genelleştirilir): `OzelKargoTakipNo` Code 128 barkod + metin, alıcı, sipariş no, desi/kg, kapıda tahsil tutarı. Şubenin bu kodu okutup gönderiyi bulduğu **doğrulanmalı** (Yurtiçi'nde belge bunu açıkça söylüyor, Sürat için kaynak yok). SDK README'si de kendi referans numarasından ZPL barkod üretmeyi anlatıyor.

Kod tarafında etiket ortak bir yardımcıya çekilir (Yurtiçi + Sürat + PTT + gerekirse MNG); dosya başına ~300 satır kuralı.

## İade kodu

- İade başına kod üreten işlem yok. `GonderiModel.Iademi` alanı ve `IadeKargolar*` (tarih aralığında iade gelen kargoları listeleme) var.
- Öneri: mağazanın sözleşmesindeki **sabit iade kodu** iade sayfasında gösterilir (ADR-0035 §8). `Iademi=true` ile iade gönderisi açmak ileride denenebilir (doğrulanmadı).

## Test planı

- **Sahte Sürat** `packages/testing/src/surat` (SOAP; Aras sahtesi kalıbı), `pnpm dev:surat`, `SURAT_BASE_URL` (yayında reddedilir):
  - `GonderiyiKargoyaGonderYeni`: başarı metni (gerçek hesaptan gelen metin girene kadar varsayılan "Tamam"), tekrar `OzelKargoTakipNo` → hata metni, eksik alıcı alanları.
  - `GonderiyiKargoyaGonderYeniSiparisBarkodOlustur`: yetkisiz hesapta `isError=true` + `050`; yetkili hesapta `Barcode`.
  - `KargoBarkodu`: `PdfBarkod` (küçük geçerli PDF) ya da yetki hatası.
  - `GonderiSil`: kabulden önce başarı metni, sonra red metni.
  - `KargoTakipHareketDetayi`: boş metin → JSON `IsError` → hareketli JSON; `KargoTakipHareketDetayliV2` içinde kaçışlı XML (ve DOCTYPE'lı kötü örnek → reddedilmeli).
  - Yanlış şifre → `IsError` + şifre metni.
- **Birim testleri:** `GonderiModel` eşleme (koli başına desi/kg, kapıda ödeme), başarı metni izin listesi, JSON/XML takip okuma (XXE reddi dahil), durum eşlemesi (olay adı + metin yedeği), takip bağlantısı süzgeci.
- **HTTP entegrasyon testi:** "Kargoya ver" + iptal, sahte Sürat ile.
- Ortak sözleşme test paketi.

## Doğrulanacaklar (gerçek hesapla)

- Test ortamı / test cari kodu var mı.
- Bir çift mi iki çift mi kimlik (gönderi vs. takip/etiket); IP izni gerekiyor mu.
- `GonderiyiKargoyaGonderYeni` ve `GonderiSil`'in gerçek başarı ve hata metinleri (izin listesi için).
- `WebSiparisKodu`'nun `OzelKargoTakipNo` mu `ReferansNo` mu olduğu.
- Barkod yetkisi (`...SiparisBarkodOlustur`, `KargoBarkodu`) hesapta açılabiliyor mu; `PdfBarkod` boyutu ve içeriği.
- Yetki yoksa kendi Code 128 etiketimizin şubede okutulması.
- `KargoTuru`, `OdemeTipi`, `TasimaSekli`, `TeslimSekli`, `GonderiSekli` sayılarının anlamı.
- `BirimDesi`/`BirimKg`/`KapidanOdemeTutari` ondalık ayracı.
- Takip yanıtının gerçek biçimi (JSON mu XML mi), alan adları ve olay adlarının (`KargoHareketTip`) yanıtta geçip geçmediği.
- `GonderiSil` ile `GonderiGeriCek` farkı; şubede işlem görmüş gönderide iptal ne olur.
- Hesap kontrolü için güvenli bir okuma işlemi.
- Herkese açık takip sayfası adresi.

## Mağazadan istenecekler

- [ ] Sürat Kargo ile imzalı kurumsal kargo sözleşmesi.
- [ ] Sürat'ın web servis için verdiği **kullanıcı adı ve şifre** (gönderi oluşturma için).
- [ ] **Cari kodunuz** ve **web şifreniz** (takip ve etiket için; yukarıdakinden farklıysa).
- [ ] Bölge/şube temsilcinizden **barkod oluşturma (etiket) yetkisi** istenmesi. Açılmazsa etiketi biz basarız; şubenin bu etiketi okuttuğunu temsilcinize teyit ettirin.
- [ ] Test için bir **test hesabı** verip veremeyecekleri.
- [ ] Web servise erişim için **IP izni** gerekiyor mu; gerekiyorsa sunucu IP'mizi biz iletiriz.
- [ ] Sözleşmenizde **kapıda ödeme** var mı; nakit mi kartlı mı; ayrı bir cari kod mu kullanılıyor.
- [ ] Desi/kg fiyat tablonuz ve desi böleniniz (genelde 3000).
- [ ] İade için anlaşmalı **iade kodunuz** varsa o kod.
