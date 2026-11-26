# ADR-0035: Doğrudan taşıyıcılar: Aras ve Yurtiçi

- **Durum:** Kabul edildi (2026-10-28 öğlen). Kullanıcı: "Elimde Aras var, Yurtiçi ileride olacak. Entegrasyonlarını yapalım, kullanıcı bilgileri sonradan girilebilir olsun. Sadece Geliver'e bağlı kalmayalım."
- **Tarih:** 2026-10-28
- **İlgili:** F7.14, ADR-0031 §5 (doğrudan taşıyıcılar aynı arayüzden), ADR-0027 (hesaplar panelden), ADR-0029 (kapıda ödeme), ADR-0032 (iade)

## Bağlam

Mağaza kendi kurumsal kargo sözleşmesiyle (müşteri kodu, kendi fiyatları, kapıda ödeme tahsilatının kendi hesabına geçmesi) doğrudan taşıyıcıya bağlanmak istiyor. İlk müşteride Aras var, Yurtiçi sonra gelecek. İki firma da resmî entegrasyon belgesini yalnızca sözleşmeli müşteriye veriyor. Kaynaklar:

- **Aras Kargo:**
  - SOAP 1.1 ASMX servisi. Test sunucusunun servis tanımı (WSDL) herkese açık: `customerservicestest.araskargo.com.tr/arascargoservice/arascargoservice.asmx`.
  - Kullanılacak işlemler:
    - `SetOrder`: sipariş; `Order` 40 alan, kendi `IntegrationCode`'umuzla.
    - `GetArasBarcode`: etiket; PDF/ZPL, base64.
    - `CancelDispatch`: iptal.
    - `GetCargoInfo` ve `GetOrderWithIntegrationCode`: takip.
  - Yanıt `ResultCode` (0 başarı) ve `ResultMessage`.
  - Canlı adres kesin değil (`customerws.araskargo.com.tr` olduğu söyleniyor); hesapla birlikte girilecek.
- **Yurtiçi Kargo:**
  - SOAP servisi `ShippingOrderDispatcherServices`. Canlı: `ws.yurticikargo.com/KOPSWebServices/...`. Test: `testwebservices.yurticikargo.com:9090/...`, hesap `YKTEST`/`YK`.
  - Erişim için çıkış IP'sinin Yurtiçi'ye bildirilmesi gerekiyor.
  - İşlemler: `createShipment` (`cargoKey` bizden ve koliye barkod olarak basılır), `queryShipment` (durum kodları 0–6, hareket geçmişi), `cancelShipment` (fatura kesilmeden önce).
  - Yanıt `outFlag`/`errCode`.
  - Etiket ucu yok: koliye `cargoKey` barkodu basılır.
  - Kaynak: açık kaynak istemciler (omniship-yurtici ve diğerleri). Resmî belge sözleşmeyle gelecek.
- Projenin HTTP istemcisi JSON konuşuyor. SOAP için XML gerekiyor.

## Karar

1. **Her taşıyıcı bir Medusa fulfillment sağlayıcısı:** `aras_aras` ve `yurtici_yurtici`, Geliver gibi.
   - Aynı "Kargoya ver" akışı, `qt_ship` işareti ve iç durum tablosu kullanılır (`tracked_shipment.provider`).
   - Kapıda ödemede tutar ve tahsil şekli siparişin ödemesinden gelir.
   - Ortak sözleşme test paketi üç sağlayıcıda da koşar (F7 KK7).
2. **Taşıyıcı kaydı:** Geliver'e bağlı yerler tek bir arayüze taşınır:
   - kargoya verme planı;
   - takip başlatma;
   - durum okuma (yeniden okuma ve sorgu işi);
   - etiket saklama;
   - sağlık kontrolü.

   Her taşıyıcı şunları verir: hesap okuma, gönderi açma ve geri çekme, durum okuma (iç durumlarımıza eşlenmiş), etiket.

3. **SOAP istemcisi bizde, yeni bağımlılık yok** (`lib/clients/soap`):
   - Zarf kaçışlı yazılır.
   - Yanıt yalnızca beklenen öğeler için okunur. DOCTYPE ve dış varlık içeren yanıt reddedilir (XXE yok).
   - Zaman aşımı, oluşturmanın tekrarlanmaması (`outcome_unknown`) ve okumaların tekrarı JSON istemcisindeki kurallarla aynıdır.
   - Kullanıcı adı ve şifre loglarda maskelenir.
4. **Etiket:**
   - Aras'ta `GetArasBarcode` PDF'i özel depoya yazılır (Geliver gibi).
   - Yurtiçi'nde etiket bizde üretilir: alıcı, gönderici, desi ve `cargoKey` Code128 barkodu. HTML + SVG, kendi kodlayıcımızla, bağımlılıksız; personel tarayıcıdan basar. PDF kütüphanesi onaylanırsa PDF'e dönüşür (ADR-0034 açık sorusu).
5. **Takip:**
   - İki firmanın da bildirimi (webhook) yok. Mevcut sorgu işi taşıyıcıya göre okur.
   - Yurtiçi dakikada bir sorguyu engelliyor; bu kural mevcut "gönderi başına dakikada en çok bir" kuralıyla uyumlu.
   - Durum kodu eşlemeleri ve Aras'ın takip yanıtının sütunları gerçek hesapla doğrulanacak (Geliver'deki gibi "sunucuda denenecek").
6. **Hesaplar panelden** (`integration-credentials`, ADR-0027). Sonradan girilir:
   - Aras: kullanıcı adı, şifre, müşteri kodu; servis adresi isteğe bağlı.
   - Yurtiçi: kullanıcı adı, şifre; kapıda ödeme için ayrı hesap isteğe bağlı.

   Test modu her iki firmada var. Hesap girilmeden seçenek çalışmaz ve açık bir hata verir.

7. **Fiyat:** Doğrudan taşıyıcılarda anlık fiyat sorgusu yok. Seçenek sabit fiyatla ya da mağazanın desi tablosuyla fiyatlanır (`geliver-table` mantığının taşıyıcıdan bağımsız hali).
8. **Kapsam dışı (şimdilik):**
   - Doğrudan taşıyıcıyla iade gönderisi: mağaza kendi kodunu verir ya da Geliver'le iade açılır.
   - Toplu manifesto.
   - Şube teslimi.

   Gerçek hesapla ve ihtiyaçla eklenir.

9. **Uygulama sırası:**
   - **K11a:** taşıyıcı kaydı ve SOAP istemcisi; Geliver yeni arayüze taşınır, davranış değişmez.
   - **K11b:** Aras sağlayıcısı, sahte Aras, hesap ve panel sayfası.
   - **K11c:** Yurtiçi sağlayıcısı, sahte Yurtiçi, hesap, panel sayfası ve kendi etiketimiz.
   - **K11d:** sözleşme test paketi ve inceleme.

## Alternatifler

| Seçenek                                                          | Artı                                                         | Eksi                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Her taşıyıcı ayrı sağlayıcı + ortak taşıyıcı kaydı (seçilen)** | Mağaza kendi sözleşmesini kullanır; Geliver'e bağımlılık yok | Belgesiz alanlar gerçek hesapla doğrulanmalı                                  |
| Yalnızca Geliver                                                 | Tek entegrasyon                                              | Aracı fiyatı ve tahsilat Geliver'den; mağazanın kendi sözleşmesi kullanılamaz |
| SOAP kütüphanesi (`soap`, `fast-xml-parser`)                     | Hazır WSDL istemcisi                                         | Yeni bağımlılık; büyük yüzey (XXE ayarları); birkaç işlem için gereksiz       |

## Sonuçlar

- Gerçek Aras hesabıyla denenecekler:
  - canlı servis adresi;
  - `GetCargoInfo` sütunları;
  - etiket biçimi;
  - kapıda ödeme alanları (`CodCollectionType`, `CodBillingType`).
- Gerçek Yurtiçi hesabıyla denenecekler:
  - IP izni;
  - durum kodları;
  - kapıda ödeme hesabının ayrı olup olmadığı.
- E-fatura (F8) geldiğinde Yurtiçi'nin `ttDocumentId` ve Aras'ın `InvoiceNumber` alanları fatura numarasıyla doldurulur.

## Uygulama notu (K11c, 2026-10-28)

- **Servis tanımı doğrulandı:** Yurtiçi'nin canlı servis tanımı (WSDL) 2026-10-28'de okundu: ad alanı `http://yurticikargo.com.tr/ShippingOrderDispatcherServices`, `createShipment` / `queryShipment` / `cancelShipment`, `ShippingOrderVO` alanları, boş SOAPAction. Alt öğeler niteliksiz (JAX-WS).
- **Adresler:**
  - Test: `https://testws.yurticikargo.com`.
  - Canlı: `https://ws.yurticikargo.com`.
  - Topluluk belgelerindeki `http://…:9090` test adresi kullanılmıyor, çünkü şifre düz metin giderdi.
- **Kapıda ödeme hesabı:** Yurtiçi tahsilatlı teslimat için ayrı kullanıcı adı ve şifre veriyor. Bunun için `integration-credentials`'a **isteğe bağlı gizli alan** eklendi (`optional`, ADR-0027'nin genişlemesi):
  - Alanlar birlikte girilir ya da hiç girilmez.
  - Panel hangisinin kayıtlı olduğunu görür.
  - Hesap doğrulaması iki girişi de dener; `merchant_invalid` kapıda ödeme hesabıdır.
  - Kapıda ödemeli sipariş bu hesapla açılır. Hesap yoksa açık bir hata döner (`yurtici.cod_account_missing`).
  - Takip önce ana hesapla sorar; ana hesap kodu tanımazsa kapıda ödeme hesabıyla sorar.
- **Etiket:** Bizim çizdiğimiz sayfa (100×150 mm). 2026-10-28 akşamdan beri PDF (`pdf-lib`, kullanıcı onayı; Türkçe için Noto Sans alt kümesi), toplu yazdırmada diğer taşıyıcıların PDF'leriyle tek dosyada birleşir. İçinde şunlar var:
  - `cargoKey`'in Code128 barkodu (`lib/shipping/code128.ts`, bağımlılıksız);
  - alıcı;
  - sipariş numarası;
  - desi ve kg;
  - kapıda tahsil tutarı.

  Yazı tipinde olmayan karakter "?" basılır, kontrol karakterleri atılır. Gönderici basılmaz: Yurtiçi göndericiyi hesaptan bilir, sağlayıcı da mağazanın yalnızca birim ve fiyat tablosu ayarlarını okur (`apps/backend/CLAUDE.md` istisnası). Etiketin şubede kabulü gerçek hesapla doğrulanacak.
- **Belirsiz sonuçta geri çekme:** `createShipment` yanıtı gelmezse (`outcome_unknown`) gönderi aynı kodla `cancelShipment` ile geri çekilir. Açık red durumunda geri çekme yapılmaz. Aras'ta da `SetOrder` artık aynı korumanın içinde.
- **Güvenlik incelemesi (K11d, 2026-10-28):** bağımsız inceleme 6 bulgu verdi; 4'ü düzeltildi.
  - **Aras durum okuma:** durum yalnızca adı DURUM/STATU içeren sütunlardan okunur. Önceden alıcı adı ya da adres ("Teslim Edildi") gönderiyi teslim edilmiş gösterebiliyordu.
  - **Aras servis adresi:** artık hesabın kimliğinde (`identity`: müşteri kodu, servis adresi, test modu). Değişince kullanıcı adı ve şifre yeniden istenir, doğrulanır ve yöneticiler uyarılır. Adres yalnızca 443 numaralı porttan kabul edilir ve her okumada yeniden denetlenir. Mağazanın girdiği adres korumalı taşıma (`safeTransport`) ile çağrılır.
  - **XML okuyucu:** etiket uzunluğu 4 KB ile sınırlı. Geçersiz karakter referansı `XmlRefused` verir. Aras hesap kontrolünde ayrıştırma hatası sağlayıcı hatası sayılır.
  - **Yurtiçi takip bağlantısı:** yalnızca `yurticikargo.com` alanlarından ve https ile kabul edilir, en çok 2048 karakter. Uymayan bağlantı yerine gönderi numarasından Yurtiçi sayfası kurulur.
  - **Ertelenen 1:** Zaman aşımından sonraki geri çekme, taşıyıcı ilk isteği bitirmeden ulaşırsa "bulunamadı" alıp kaybolabilir. Etkisi küçük: kod hiçbir etikete basılmadığı için koli alınmaz. Gecikmeli yeniden deneme K12'de değerlendirilecek.
  - **Ertelenen 2:** Yurtiçi kapıda ödeme hesabı tek başına silinemiyor; silmek için tüm hesabı kaldırıp yeniden bağlamak gerekiyor. Gerekirse "kapıda ödeme hesabını kaldır" eklenir.
- **Gerçek Yurtiçi hesabıyla denenecekler:**
  - hatalı girişin dönüş biçimi (şimdi SOAP fault ya da kod satırı olmayan yanıt "kabul edilmedi" sayılıyor);
  - `operationCode` dışındaki olay metinleri (dağıtımda, teslim edilemedi, iade);
  - `ttDocumentId` için sipariş numarasının kabulü;
  - etiketin şubede okutulması;
  - desi/kg alanlarının sözleşmede açık olması.


## Ek (2026-11-02): Yurtiçi resmî belgesiyle karşılaştırma

Mağaza sahibi Yurtiçi'nin "Web Servis Giden Kargo Teknik Döküman V3" belgesini verdi. Entegrasyon satır satır karşılaştırıldı; doğrulanan bilgiler `docs/entegrasyonlar/yurtici.md`'de. Belge "Hizmete Özel", repoya konmadı.

- **Doğrulananlar (değişiklik yok):** test ve canlı adresler (`testws` / `ws.yurticikargo.com`, Bağlam'daki `testwebservices…:9090` adresi geçersiz), ad alanı, kimlik alanları (`queryShipment`'ta `wsLanguage`), ödeme tipinin ayrı kullanıcıyla seçilmesi (ana hesap = gönderici ödemeli, kapıda ödeme hesabı = gönderici ödemeli tahsilatlı teslimat), `cargoKey`/`invoiceKey` 20 karakter, il/ilçenin adreste değil `cityName`/`townName`'de gitmesi, nokta ayraçlı tutar, `keyType=0`, Yurtiçi'nin etiket vermemesi (anahtarın koli üzerinde metin/barkod olması yeterli).
- **Düzeltilenler:**
  - **Hesap kontrolü:** bilinmeyen anahtar için Yurtiçi `outFlag` 0 ve `cargoKey`'siz bir 82519 satırı döndürüyor. Kontrol satırı anahtarla aradığı için geçerli bir canlı hesap "reddedildi" görünecekti. Artık 82519 satırı geçerli giriş sayılıyor. Takip de bu satırı "bulunamadı" okuyor; başka bir hata kodu artık sessizce "bulunamadı" sayılmıyor, hata olarak dönüyor.
  - **İptal:** belgeye göre düzenlenmiş (`IND`) gönderiye iptal bir iade isteğidir; teslim edilmiş gönderi (`DLV`) de `outFlag` 0 ile döner. Eskiden ikisi de başarılı geri çekme sayılıyordu: Medusa gönderimi iptal ederken koli yoldaydı ya da teslim edilmişti. Artık yalnızca `CNL`, `ISC` ve 82520 (önceden iptal; belgenin hatalı örneği `outFlag` 1 ile döner ve eskiden hata sayılıyordu) geri çekmedir. `IND` → `return_requested`, `DLV` → `status_dlv` hatası; gönderim kalır, takip iadeyi izler.
  - **Durum eşleme:** belgenin örnek yanıtları kodları tablodan farklı numaralıyor (CNL=2, DLV=1). Durum artık `operationStatus` harflerinden okunuyor, kod yalnızca yedek. İade, `rejectStatus` koduyla okunuyor (0–3, 9, 10 iade; 4, 7, 8, 11 iade iptal). Eskiden "İade Bekletiliyor"/"İade Onaylanmadı" metni yanlışlıkla iade sayılıyordu. `returnStatus` geri dönüşlü hizmetin durumu olduğu için iade sayılmıyor ("Gönderici müşteriye iade edildi" teslim edilmiş gönderiyi iade gösterebiliyordu). `docId` satırdan da okunuyor.
  - **Telefon:** belge alan koduyla 10 rakam istiyor; baştaki 0 atılıyor.
  - **Boş öğeler:** `taxOfficeId`, `ttDocumentId`, `dcSelectedCredit`, `dcCreditRule` kullanılmadığında belgenin örneklerindeki gibi boş gidiyor. Eskiden `0` gidiyordu ve `dcCreditRule=0` "müşteri seçimi zorunlu" demekti.
  - **Desi:** belge desi ve kg'ı ayrı alanlarda tutuyor, yanıtta `totalDesi`, `totalKg`, `totalDesiKg` ayrı. Eskiden `desi` alanına max(kg, hacim/3000) gidiyordu; artık hacim/3000, kg ayrı. Mağazanın fiyat tablosu yine max(kg, hacim/3000) ile fiyatlar.
  - **Alıcı kuralları:** ad en az 5 karakter ve 4 harf, adres en az 10 harf/rakam. Gönderimden önce denetleniyor, Yurtiçi'ye gitmeden `shipping.address_incomplete` (alan adıyla) dönüyor.
  - **Sahte Yurtiçi** belgenin hata kodlarına ve yanıt biçimlerine göre yeniden yazıldı (`packages/testing/src/yurtici/rules.ts`): bilinmeyen anahtar 82519, tekrar iptal 82520, düzenlenmiş gönderiye iptal iade isteği, alan kuralları belgedeki kodlarla. Eski sahte, belgede başka anlama gelen kodlar kullanıyordu (60017, 82500, 82512, 82513).
- **Belgedeki tutarsızlıklar:** adres en çok 200 mü 500 mü (500 seçildi: alan tipi ve servis mesajı), telefon örneği 11 hane mi 10 hane mi (10), tutar ayracı nokta mı virgül mü (alan tanımındaki nokta), örneklerde `dispatch` işlem adı (`createShipment` kullanılıyor).
- **Açık sorular** (`docs/entegrasyonlar/yurtici.md`): hatalı girişin dönüş biçimi; dakikalık sorgu sınırının kapsamı; desi/kg yetkisi ve desi böleni; ticari gönderide `waybillNo`; `ttDocumentId` ve `ttDocumentSaveType`; kapıda ödeme sözleşmesinin nakit/kart oluşu (82512); takip bağlantısı; son durum olan `returned`/`failed`'ın geri alınamaması; barkod simgelemesi.
- **Kapsam dışı kalan, başka dosya isteyen:** `return_requested` için ayrı bir Türkçe hata mesajı (`lib/errors/messages`), panelde ana hesabın "gönderici ödemeli" kullanıcısı olması gerektiğini söyleyen yardım metni.

- **Güvenlik incelemesi 2026-11-03 (L1):** HTTP 5xx altında gelen SOAP fault artık `outcome_unknown` değil, servisin kesin reddi: HTTP istemcisi XML yanıttaki fault kodunu (`errorCode`, yoksa `faultcode`) `error_<kod>` olarak verir (`lib/clients/soap-fault.ts`); fault yoksa ya da ağ geçidi (502/504) yanıtıysa sonuç bilinmez kalır. Yurtiçi bu retten sonra gönderiyi geri çekmez; hesap kontrolünde yalnızca giriş fault'u (`error_936`, sahtenin verdiği kod; belge söylemiyor) `secret_invalid`, düz 500 "ulaşılamadı", başka fault "doğrulanamadı" olur.

## Ek 2026-11-26: Geliver kaldırıldı

Geliver projeden tamamen çıkarıldı (ADR-0031 ek). Taşıyıcı kaydında artık yalnız Aras ve Yurtiçi var; yukarıdaki "Geliver gibi" karşılaştırmaları ve §8'deki "Geliver'le iade açılır" seçeneği tarihseldir. Başka taşıyıcılar istendikçe aynı kayda eklenir.

## Ek 2026-11-26: MNG, Sürat, PTT sıraya alındı

Sahip, mevcut işten sonra MNG (DHL eCommerce Türkiye), Sürat ve PTT Kargo'nun da aynı kayda doğrudan taşıyıcı olarak eklenmesini onayladı; sıra MNG → Sürat → PTT. Araştırma: `docs/entegrasyonlar/mng.md`, `surat.md`, `ptt.md` (Aras özeti `aras.md`). Kodlamadan önce sahibe sorulacak kararlar o dosyalarda: MNG uygulama anahtarlarının yeri, PTT'de yalnız barkod aralığıyla çalışma, etiketi basmayan taşıyıcılarda kendi etiketimiz.
