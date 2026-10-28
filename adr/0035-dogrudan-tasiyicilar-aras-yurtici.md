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

