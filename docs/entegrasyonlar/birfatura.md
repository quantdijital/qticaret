# BirFatura (e-Fatura / e-Arşiv)

> Kaynaklar (2026-11-16'da okundu): `https://birfatura.com/birfatura-api-entegrasyonu/`; geliştirici portalı `https://developers.birfatura.com/` ve belgeleri: "Özel Entegrasyon API" (`/dokuman/ozel-entegrasyon-api`, v1.0, 2026-07-30, 5 uç) ve "OutEBelgeV2 API" (`/dokuman/outebelgev2-api`, v1.0, 2026-07-30, 28 uç). Portal sayfaları JavaScript ile çiziliyor; içerik portalın kendi herkese açık veri ucundan okundu (`developers-api.birfatura.com/api/portal/dokumanlar/<belge>`). "OutEBelgeV2 Bayi API" şifreli, okunmadı. Resmî SDK yok (npm/GitHub'da da bulunamadı). Durum: **araştırma, kod yok.** İlgili kararlar: ADR-0034 (e-fatura altyapısı), ADR-0027 (hesaplar), ADR-0039 (dış API ve kapsamlı anahtarlar), ADR-0041 (KVKK). Uygulama planı: `docs/entegrasyonlar/plan-basitkargo-birfatura.md`.
>
> "Doğrulanmadı" diye işaretli her şey belgede yazmıyor ya da çelişkili; BirFatura'nın entegrasyon ekibinden (`entegrasyon@birfatura.com`) ya da test hesabıyla kapanır.

## Amaç ve kapsam

Sahibin isteği (2026-11-16): "fatura tarafında https://birfatura.com/ entegrasyonlarını da yapmalıyız."

- **Amaç:** Mağaza faturalarını BirFatura'da kessin. BirFatura, Paraşüt'ün ve "dış program" (`external`) seçeneğinin yanına üçüncü fatura yolu olur (Ayarlar > E-Fatura).
- **Kapsam:** satış faturası (e-Fatura ya da e-Arşiv), numara ve PDF'in bize dönmesi, sipariş iptalinde durumun izlenmesi, panelde bağlantı, sahte sunucu, testler.
- **Kapsam dışı:** iade belgeleri. ADR-0034 Ek (mali müşavir 5.2, 5.3): bireysel iade gider pusulasıyla, şirket iadesi şirketin bize kestiği iade faturasıyla; ikisini de personel düzenler, hiçbir program kesmez. e-İrsaliye, e-SMM, BirFatura'nın pazaryeri ve kargo modülleri de kapsam dışı.

## Sağlayıcı özeti

- **Ne:** BirFatura kendini "GİB onaylı özel entegratör" olarak tanıtıyor. e-Fatura, e-Arşiv, e-İrsaliye, e-SMM, e-MM, e-Adisyon belgeleri; ayrıca pazaryeri (Trendyol, Hepsiburada …) ve e-ticaret altyapısı (Shopify, WooCommerce, ikas, Ticimax …) entegrasyonları ve kargo anlaşmaları. GİB'in özel entegratör listesinde adı **doğrulanmadı** (resmî listeden bakılmalı). OutEBelgeV2 servisi `uygulama.edonustur.com` alan adında çalışıyor (eDönüştür altyapısı; ilişkisi **doğrulanmadı**).
- **Fiyat:** kontör (belge başına). Fiyat sayfası `https://birfatura.com/e-fatura-kontor-fiyatlari-e-fatura-fiyatlari/`; tutarlar okunmadı (**doğrulanmadı**). Arama özetine göre ayda 20 kontör yenileniyor, üstü abonelik; kontörün süresi dolmuyor (BirFatura'nın kendi metni, doğrulanmadı). API belgesi ve test ortamı ücretsiz.
- **Hız sınırı:** "Standart adil kullanım sınırları"; sayı yok (**doğrulanmadı**).

## Kritik bulgu: iki ayrı entegrasyon yolu var

BirFatura'nın iki API'si **ters yönlerde** çalışıyor ve plan buna göre ikiye ayrılıyor.

### A. Özel Entegrasyon API (çekme: BirFatura bizden sipariş çeker)

ikas, Ticimax, Shopify gibi altyapıların BirFatura'ya bağlandığı yol budur (ADR-0034 Bağlam'da "BirFatura gibi aracılara açık uç veriyor" diye geçen model).

- **Servisleri biz yazarız**, BirFatura bizim sunucumuzu çağırır. BirFatura mağaza ayarında tanımlı web sitesi adresine istek atar; belgede taban adres `https://siteadresiniz.com`.
- Hepsi `POST`, JSON, başlıkta `token` (bizim ürettiğimiz GUID; BirFatura'da mağaza ayarı "API Şifresi" alanına girilir). Token URL'de ya da yanıtta paylaşılmaz.
- **Zorunlu:** `/api/orderStatus`, `/api/paymentMethods`, `/api/orders`. **İsteğe bağlı:** `/api/orderCargoUpdate`, `/api/invoiceLinkUpdate`.
- **Akış:** (1) kurulumda BirFatura sipariş durumlarımızı ve (2) ödeme yöntemlerimizi alır; (3) tarih aralığı ve durumla faturalanacak siparişleri çeker; faturayı **BirFatura keser** (UBL, mükellef sorgusu, GİB'e iletim, PDF onda); (4) kargo anlaşması BirFatura'daysa takip bilgisini bize yazar; (5) fatura kesilince PDF bağlantısını, fatura numarasını ve tarihini bize yazar.
- Çekmenin zamanlaması (otomatik mi, BirFatura panelinde "Onaylanmış Siparişler" ekranından elle mi) **doğrulanmadı**. Tanıtım sayfası "onaylanınca faturalar otomatik akar" diyor, belgenin test adımı ekrandan çekmeyi anlatıyor.
- Tarih biçimi her yerde `dd.MM.yyyy HH:mm:ss` (`InvoiceDate` şemasında `HH:mm:SS` yazıyor: belge hatası, **doğrulanmadı**). Ondalıklı tutarlar yuvarlanmadan gönderilir. Aynı sipariş tekrar dönerse aynı `OrderId` ve `OrderCode` ile döner; ikisi platformda tekil olmalı.

### B. OutEBelgeV2 API (itme: biz BirFatura'ya belge göndeririz)

Paraşüt'teki gibi faturayı biz başlatırız.

- Adres `https://uygulama.edonustur.com/api/OutEBelgeV2/...`. Ayrı bir test adresi belgede yok (**doğrulanmadı**; dosya indirme bağlantılarında `test1.birfatura.com` geçiyor).
- Her istekte üç başlık: `X-Api-Key`, `X-Secret-Key`, `X-Integration-Key`. Anahtarlar BirFatura'da `https://uygulama.birfatura.com/outapibilgileri` sayfasında "Kendim Kullanacağım" seçilerek ve "EFaturaV2 Belge İşlemleri" kapsamıyla üretilir. **Başka firmalar adına** işlem için entegrasyon anahtarı `entegrasyon@birfatura.com`'dan istenir: platform olarak bayilik/iş ortaklığı modeli (bir platform anahtarı + mağazanın kendi iki anahtarı) olabilir, **doğrulanmadı**.
- Yanıt zarfı `{ Success, Message, Code, Result }`; 400 ve 500'de de aynı zarf (`Result` hata metni).
- Kullanılacak uçlar:

| Uç | İş |
|---|---|
| `POST SendBasicInvoiceFromModel` | XML'siz, JSON modelle satış e-Fatura ya da e-Arşiv. Yalnızca standart satış; "tevkifat, istisna, ihracat gibi" senaryolar `SendDocument` (UBL-TR XML, zip + Base64) ister. Yanıt `Result { invoiceNo, zipped, htmlString, pdfLink }` |
| `POST GetUserPK` | `kn` (VKN/TCKN) → alıcının posta kutusu (PK) etiketleri. Boş sonucun "e-Fatura mükellefi değil" demek olduğu yazmıyor (**doğrulanmadı**, büyük olasılıkla öyle) |
| `POST GetOutBoxDocumentStatusesWithUUIDs` | `{ uuids: [] }` → `UUID`, `Status` (ör. `"1300"`), `Answer`. Durum kodları dış bir sayfaya bağlı, belgede tablo yok |
| `POST GetPDFLinkByUUID` | `uuids`, `systemType` → PDF bağlantısı. Bağlantı "resmîleştirme yoğunluğuna göre hemen aktif olmayabilir"; geçerlilik süresi yazmıyor |
| `POST SendDocumentAnswer` | `documentUUID`, `acceptOrRejectCode` (`KABUL`, `RED`, `IPTAL`), `systemTypeCodes`. "e-Arşiv fatura için iptal işlemi bu endpoint ile iletilebilir"; metin gelen belgeleri anlatıyor, **kendi kestiğimiz e-Arşiv'in iptali için mi doğrulanmadı** |
| `POST GetNumberOfCredits` | Kalan kontör (sağlık kontrolü ve panelde gösterim) |
| `POST GetDocumentLogs`, `GetOutBoxDocumentByUUID` | Hata ayıklama, mutabakat |

- `SendBasicInvoiceFromModel` modeli (`invoice`): zorunlular `invoiceDate`, `ettn` (fatura GUID'i, **bizim ürettiğimiz**), `billingName`, `billingAddress`, `billingCity`, `taxNo`, `totalPaidTaxExcluding`, `totalPaidTaxIncluding`, `productsTotalTaxExcluding`, `productsTotalTaxIncluding`, `orderDetails[]` (her satırda `productCode`, `productName`, `productQuantity`, `vatRate`, `productUnitPriceTaxExcluding`, `productUnitPriceTaxIncluding`; isteğe bağlı `discountUnitTaxExcluding/Including`, `discountIsPercentUnit`, `discountRateUnit`). Diğerleri: `orderCode`, `orderDate`, `invoiceExplanation`, `eInvoiceId` (numara; `isDocumentNoAuto=false` ise zorunlu), `isDocumentNoAuto`, `receiverTag` (yalnızca e-Fatura), `billingTown`, telefonlar, `taxOffice`, `email`, teslimat alanları, `shipCompany`, `cargoCampaignCode`, `deliveryFeeType` (2–5), `paymentType`, `currency`, `currencyRate`, kargo/taksit/havale indirimi/kapıda ödeme/indirim toplamları.
- **Modelde olmayanlar (kritik, doğrulanmadı):** e-Arşiv'in internet satışı bilgileri (web adresi, ödeme tarihi, ödeme aracısı) ve gönderim bilgileri (taşıyıcı VKN'si, gönderim tarihi) ayrı alan olarak yok; e-Fatura/e-Arşiv seçimini söyleyen alan (`systemTypeCodes`) bu modelde yok (`receiverTag`'den mi çıkarılıyor?); seri seçimi yok. Örnekte şemada olmayan bir `storeName` alanı var: bu bilgiler BirFatura'daki mağaza tanımından geliyor olabilir. Bu alanlar GİB'in e-Arşiv internet satışı için zorunlu tuttuğu bilgilerdir; model taşımıyorsa itme yolu `SendDocument` ile **kendi UBL'imizi** ister (ADR-0034'ün "sonraki aşama"sı, büyük iş).
- Test hesabı `entegrasyon@birfatura.com`'a, kayıtlı olmayan bir e-postadan istenir. e-Fatura testinde gönderici ve alıcı için belgede verilen test VKN'si `1234567801` kullanılır (herkese açık test değeri).

### Hangisi?

| | A. Çekme (Özel Entegrasyon) | B. İtme (OutEBelgeV2) |
|---|---|---|
| UBL, mükellef sorgusu, e-Arşiv internet satışı bilgileri | BirFatura'da (ikas/Ticimax'la aynı yol; sorumluluk onda) | Model eksikse bizde (UBL) |
| Bizdeki iş | 5 gelen uç + eşleme; mevcut `external` kuyruğunun üstüne oturur | Paraşüt benzeri sağlayıcı (`InvoiceProvider`) |
| Ne zaman kesilir | BirFatura çektiğinde (zamanlaması doğrulanmadı); bizim bekletme kuralımız (`saleInvoiceHold`) yalnız listede görünmeyi belirler | Bizim kuyruğumuz ve kuralımız |
| İptal | BirFatura'ya iptal bildiremeyiz; kesilmiş e-Arşiv'i personel BirFatura'da iptal eder (`external`'daki gibi) | `SendDocumentAnswer IPTAL` (doğrulanmadı) |
| Tekrar önleme | BirFatura `OrderId`'ye göre (belge: aynı sipariş aynı kimlikle) | Bizim ürettiğimiz `ettn`: sonucu bilinmeyen gönderim `GetOutBoxDocumentStatusesWithUUIDs` ile sorulur, ikinci kez gönderilmez |
| Güvenlik | **Bizden kişisel veri çeken gelen uç** (alıcı adı, adres, TCKN/VKN, telefon); token tek savunma | Giden çağrı; mağazanın iki anahtarı şifreli |
| Dönen bilgi | Numara, tarih, PDF bağlantısı; ETTN ve belge tipi **yok** | Numara, PDF, ETTN bizde |
| Mağazanın BirFatura'yı pazaryeri için de kullanması | Doğal: bütün kanallar tek panelde | Ayrı |

**Öneri: A ile başla, B'yi BirFatura'nın cevaplarına bağla.**

- A, BirFatura'nın e-ticaret altyapılarıyla zaten çalıştırdığı yol. e-Arşiv'in internet satışı ve UBL uyumu onların sorumluluğunda kalır, biz yalnız siparişi doğru veririz.
- A, mevcut `external` modunun (ADR-0034 §9: bekleyen faturalar, taslak, geri yazma, seri denetimi, `invoice.requested`) üstüne ince bir "çevirici" olarak oturur; kuyruk, bekletme kuralı ve iptal işaretleri değişmez.
- B ancak BirFatura modelin e-Arşiv internet satışı bilgilerini (mağaza tanımından ya da alanlardan) doldurduğunu ve kendi e-Arşiv'imizi `IPTAL` ile iptal edebildiğimizi doğrularsa değer kazanır (otomatik iptal ve ETTN bizde). Doğrulanmazsa B, kendi UBL'imiz demektir: yapılmaz.

## Kimlik bilgileri ve panel bağlantı akışı

Her mağaza **kendi BirFatura hesabıyla** çalışır (kontör, firma, seri mağazanındır).

### A. Çekme

- Ayarlar > E-Fatura'da yeni sağlayıcı değeri `birfatura` (`modules/platform-settings/sections/invoicing.ts` `INVOICING_PROVIDERS`). Davranışta `external` gibidir, ek olarak gelen uçları açar.
- **Token'ı biz üretiriz:** sahip "BirFatura bağlantı anahtarı oluştur" der (yeniden doğrulamayla, adr/0040). Sunucu 128 bit rastgele GUID üretir, **bir kez** gösterir (kopyala düğmesi), BirFatura'da mağaza ayarı "API Şifresi" alanına yapıştırılır.
- Saklama: `integration-credentials` içinde `birfatura` sağlayıcısı, gizli alan `token` (AES-256-GCM, ADR-0027). Panel yalnızca "kayıtlı" görür; yeniden okunamaz. "Yenile" eski token'ı hemen geçersiz kılar, bütün yöneticilere bildirim (ADR-0027 §6).
  - Bu kayıt mevcut kalıptan bir yönüyle ayrılır: değeri mağaza değil sunucu üretiyor ve bir kez gösteriliyor (Google'ın jetonunun da elle yazılmaması gibi). Karşılaştırma çözülmüş değerle sabit zamanlı (`lib/security` timing-safe compare); daha iyisi kayıtta yalnız HMAC özetini tutmak (ADR'de karar).
- BirFatura'ya girilecek "web sitesi adresi": backend'in herkese açık adresi + yol öneki (ör. `https://<mağaza-api>/hooks/birfatura`); BirFatura bunun sonuna `/api/orders` ekler. Yol önekli adresi kabul ettiği **doğrulanmadı**. Kabul etmezse F16'da mağazaya ayrı bir alt alan adı ve nginx yönlendirmesi gerekir (`birfatura.<mağaza-api>/api/*` → `/hooks/birfatura/api/*`).
- **Bağlantı testi:** bizim tarafımızda yapılacak çağrı yok (BirFatura bizi çağırır). Panel "son çekme" zamanını ve sonucunu gösterir; BirFatura'nın test adımı ("Sipariş durumlarını getir") bağlantıyı doğrular. Hiç çekme yoksa uyarı (engel değil).
- Sağlık kontrolü: B'nin anahtarları da girilmişse `GetNumberOfCredits`; yoksa yalnız "son başarılı çekme" yaşı.

### B. İtme

- `integration-credentials` `birfatura` sağlayıcısına ek gizli alanlar `api_key`, `secret_key` (ve platform anahtarı değilse `integration_key`). `identity`: yok (test/canlı ayrımı netleşirse `test_mode` kimlik alanı olur).
- Bağlantı testi: `GetNumberOfCredits` (`Success: true` → doğrulandı; kimlik reddi → `secret_invalid`, kod **doğrulanmadı**).
- Adres kodda (`https://uygulama.edonustur.com`); `BIRFATURA_BASE_URL` yalnızca geliştirme ve testte sahte sunucu için, staging ve canlıda reddedilir (`PARASUT_BASE_URL` kalıbı).

## API eşlemesi

### A. Çekme: BirFatura'nın uçları → bizim kayıtlarımız

Uçlar `apps/backend/src/api/hooks/birfatura/api/<uç>/route.ts` (Medusa dosya rotası; `/hooks` Medusa'nın oturum ara katmanından geçmez). Sağlayıcı `birfatura` değilse hepsi 404.

| BirFatura uç | Bizde | Not |
|---|---|---|
| `/api/orderStatus` | Sabit liste: `1` "Faturaya hazır", `2` "Faturalandı", `3` "İptal edildi" | Yalnızca `1` sipariş döndürür; diğerleri BirFatura'nın kurulum ekranı ve `orderCargoUpdate` için. Metinler i18n'den (Türkçe) |
| `/api/paymentMethods` | `INVOICE_PAYMENTS` (`lib/invoicing/types.ts`): `1` Kredi/Banka Kartı, `2` EFT/Havale, `3` Kapıda Ödeme, `4` Hediye Kartı, `5` Diğer | Kimlikler sabit, değişmez (BirFatura eşlemeyi saklar) |
| `/api/orders` | `einvoice` kayıtları: `provider = birfatura`, `kind = sale`, `status = pending`, bekletme kuralından geçmiş (`lib/invoicing/hold.ts`). Her biri için taslak (`lib/invoicing/draft.ts`) → BirFatura `Orders[]` | Tarih aralığı kaydın **faturaya hazır olduğu ana** uygulanır (sipariş tarihine değil): "kargoya verilince" kesimde iki gün önceki sipariş bugün hazır olur. En çok 31 gün aralık, en çok 100 sipariş (fazlası sonraki çekmeye) |
| `/api/invoiceLinkUpdate` | `workflows/einvoice/write-back.ts` (geri yazma): numara (`faturaNo`), tarih (`faturaTarihi`); PDF `faturaUrl`'den indirilir ve özel depoya yazılır | Aynı numara: başarı (tekrar); farklı numara: `Success: false` (409'un karşılığı); seri denetimi (`einvoice.series_mismatch`). ETTN ve belge tipi gelmez: kayıtta boş kalır (ADR-0034 §2 "öğrenilene kadar boş"); bugünkü geri yazma şeması `document_type` istiyor, BirFatura yolu için boş geçebilecek şekilde genişler |
| `/api/orderCargoUpdate` | Yalnızca BirFatura'nın kargo anlaşması kullanılıyorsa anlamlı. İlk sürümde **kabul edilip yok sayılır** (`Success: true`, log yalnız kimliklerle) | Kargo bizim taşıyıcılarımızla gidiyor; ikinci bir takip kaynağı kargo durumunu bozmasın |
| Sipariş iptali | — | BirFatura'ya iptal bildirilemez. Kesilmemiş fatura listeden düşer (kayıt `cancelled`). Kesilmiş fatura: `external`'daki gibi "iptal istendi" işareti, personel BirFatura'da e-Arşiv'i 8 gün içinde iptal eder ya da iade belgesi düzenler; panel bunu söyler |

### B. İtme: `InvoiceProvider` (`lib/invoicing/provider.ts`) → OutEBelgeV2

| `advance` adımı | Uç | Kayda yazılan (`keep`) |
|---|---|---|
| ETTN üret | — | `uuid` (her şeyden önce: tekrar önleme anahtarı) |
| Belge tipi | `GetUserPK` (`kn` = alıcının VKN'si; şahısta e-Arşiv) | `document_type`, `receiverTag` |
| Kes | `SendBasicInvoiceFromModel` (`ettn`, `isDocumentNoAuto: true`) | `number` (`invoiceNo`), `external_id` = ETTN |
| Sonucu bilinmiyorsa | `GetOutBoxDocumentStatusesWithUUIDs([ettn])` | Belge varsa sahiplenilir, yoksa yeniden gönderilir |
| PDF | `GetPDFLinkByUUID`; hazır değilse `waiting` | PDF özel depoda |
| `cancel` | e-Arşiv ve 8 gün içinde: `SendDocumentAnswer IPTAL` (doğrulanmadı); e-Fatura ya da süre geçmiş: `too_late` | |

## Veri eşlemesi (taslak → BirFatura `Orders[]`)

Taslak sağlayıcıdan bağımsızdır (`InvoiceDraft`, `lib/invoicing/types.ts`); tutarlar sunucuda kalem paylarından hesaplanır, istemciden gelmez.

| BirFatura | Taslaktan | Not |
|---|---|---|
| `OrderId` (long, zorunlu, tekil) | `display_id` | Medusa'nın sayısal sipariş no'su. **Değişim faturası** aynı siparişin ikinci satışıdır (ADR-0034 E6b): ayrı `OrderId` gerekir; öneri `display_id * 100 + sıra` ve `OrderCode` `1234-D1`. BirFatura'nın kabulü **doğrulanmadı**; olmazsa değişim faturaları elle |
| `OrderCode`, `OrderDate` | `order.number`, `order.date` | `dd.MM.yyyy HH:mm:ss`, İstanbul saati |
| `BillingName`, `BillingAddress`, `BillingTown`, `BillingCity` | `buyer.name`, `address`, `district`, `city` | Zorunlu |
| `BillingMobilePhone` (zorunlu) | `buyer.phone`, yoksa teslimat telefonu | İkisi de yoksa sipariş listede kalır ve kayıtta uyarı (`einvoice.phone_missing`); uydurma numara yazılmaz |
| `TaxNo` + `TaxOffice` | şirket alıcıda VKN ve vergi dairesi | Yalnız gönderim anında açılır (F11 kuralı), müşteri bazında denetim kaydı |
| `SSNTCNo` | şahısta TCKN; yoksa `11111111111` (`ANONYMOUS_TCKN`) | |
| `Email` | `buyer.email` | BirFatura e-Arşiv'i e-postayla iletebilir; bizim `order.invoiced` e-postamızla çift ileti olmaması için mağaza ayarı (**açık soru**) |
| `Shipping*` | teslimat adresi | |
| `ShipCompany` | `shipment.carrier.title` | Taşıyıcı VKN'si ve gönderim tarihi şemada yok (**doğrulanmadı**: BirFatura nereden dolduruyor) |
| `SalesChannelWebSite` | `internet_sale.url` | |
| `PaymentTypeId`, `PaymentType` | `internet_sale.payment` → yukarıdaki kimlik | Ödeme aracısı (`platform`) ve ödeme tarihi (`paid_on`) şemada yok (**doğrulanmadı**) |
| `Currency` | `TRY` | Döviz bugün faturalanmıyor (`einvoice.currency_unsupported`); `CurrencyRate` boş |
| `OrderDetails[]` | taslak satırları (kargo satırı hariç) | `ProductId` (long, zorunlu): Medusa kimliği metin; satır sırası değil, varyant kimliğinden kararlı 53 bitlik sayı (BirFatura'nın bunu ürün eşlemesi için kullanıp kullanmadığı **doğrulanmadı**). `ProductCode` = SKU, yoksa varyant kimliği. `ProductName` = ürün + varyant. `ProductQuantityType` = "Adet". `VatRate` = satırın oranı |
| Birim fiyat ve indirim | `unit_net`, `discount_net / quantity` | `ProductUnitPriceTaxExcluding` 4 ondalık (taslaktaki gibi); dahil fiyat `unit_net × (1 + oran)`. Satır indirimi birim başına `DiscountUnitTax*`; kuruşa bölünmeyen indirimde fark **doğrulanmalı** (BirFatura toplamı ile bizimki farklıysa kayıtta `program_difference`) |
| `ShippingChargeTotalTaxExcluding/Including` | taslağın kargo satırı | Mali müşavir: kapıda ödeme bedeli kargo satırına eklenir (ADR-0034 Ek 1); `PayingAtTheDoorCharge*` boş |
| `DiscountTotal*` | sipariş geneli indirim | Taslakta indirim kalemlere dağıtılmış; genel indirim 0 |
| `TotalPaid*`, `ProductsTotal*` | `totals` | Yuvarlanmadan |
| `ExtraFees`, `ExtraFeesUnit` | — | Kullanılmıyor (ek seçenek bedeli kalemin içinde) |
| İstisna ve tevkifat | — | Çekme modelinde alan yok (`NameCode`'lu `ExtraFees` yalnız ÖİV gibi özel vergi için). İstisnalı satış (ör. ihracat) bugün faturalanmıyor; gerekirse ayrı karar |

İl/ilçe adları kod değil metin gider (BirFatura kod istemiyor).

## Hata ve yeniden deneme

- **A:** Hata BirFatura'nın isteğinde döner; biz yeniden denemeyiz. Gelen ucun cevabı her zaman geçerli JSON: beklenmeyen hatada 500 ve `{ "Success": false, "Message": "..." }` (iç ayrıntı yok). `/api/orders` bir siparişin taslağı kurulamazsa (eksik alan) o siparişi atlar, kayda `last_error` yazar, paneldeki fatura kartında görünür; diğerleri döner.
- PDF indirme (`invoiceLinkUpdate`): yalnızca HTTPS ve izinli alan adı (`uygulama.birfatura.com`, ilk gerçek denemede doğrulanır; Paraşüt'teki kural), `lib/security` safe-fetch ile, en çok 5 MB, `%PDF-` ile başlamalı. İndirilemezse numara yine yazılır, PDF işi yeniden dener; müşteriye "faturanız hazır" PDF hazır olunca gider.
- **B:** Paraşüt kuralları (ADR-0034 §7 ve kapanış incelemesi): kesin ret yeniden denenir; sonucu belirsiz yazma ETTN ile sorulmadan yeniden gönderilmez; N denemede panel uyarısı.

## Compensation

- **A, `invoiceLinkUpdate`:** Fatura BirFatura'da kesildi ama bizde yazılamadı (veritabanı hatası): BirFatura'ya `Success: false` döner; BirFatura'nın tekrar gönderip göndermediği **doğrulanmadı**. Gönderilmezse sipariş `1` durumunda listede kalır ve sonraki çekmede **ikinci kez faturalanma riski** doğar. Önlem: BirFatura'nın aynı `OrderId`'yi ikinci kez faturalamadığı belgede ima ediliyor ("aynı sipariş tekrar dönecekse aynı OrderId"), **doğrulanmalı**. Bizim tarafta: geri yazma tek işlemde (numara + durum), PDF ayrı ve yeniden denenebilir adım; yazma düşerse kayıt `pending` kalır ama "BirFatura bildirdi" işareti ayrı ve önce yazılır (sonraki çekmede bu sipariş listelenmez, personel önüne düşer).
- **A, `/api/orders`:** Yan etkisiz okuma; telafi gerekmez. Okuma (kişisel veri açılışı) denetim kaydına yazılır; yazılamazsa 503 (F2 kuralı: kişisel veri okuma kaydı yazılamazsa sunulmaz).
- **B:** Fatura kesildi ama kayıt düşmedi → sonraki denemede ETTN ile `GetOutBoxDocumentStatusesWithUUIDs`, belge sahiplenilir (`adopt`). Resmîleşmiş belge kendiliğinden iptal edilmez (ADR-0034 §7'nin bilinçli istisnası).

## Gelen uç güvenliği (A)

Bu uçlar BirFatura'nın değil **bizim** web kancamızdır ve kişisel veri döndürür; ödeme web kancalarından daha sıkı tutulur.

- `token` başlığı zorunlu; kayıtlı değerle sabit zamanlı karşılaştırma. Eksik ya da yanlış: 401, gövde boş, aynı süre. Token sorgu dizgisinde kabul edilmez.
- Hız sınırı: yeni profil (`einvoice_pull`, IP başına dakikada 60, mağaza başına dakikada 120); başarısız token denemesi IP başına ayrı ve sıkı (dakikada 10) sayılır.
- Gövde en çok 16 KB, katı Zod şeması (`validateAndTransformBody`), bilinmeyen alan 400.
- Tarih aralığı en çok 31 gün; yanıt en çok 100 sipariş.
- Yalnızca satış faturası bekleyen siparişler; iade belgeleri ve faturası istenmeyen siparişler hiçbir zaman dönmez (`api/admin/invoices/reach.ts` kuralı).
- BirFatura'nın çıkış IP'leri yayımlanıyorsa isteğe bağlı IP listesi (**doğrulanmadı**).
- Her çekme denetim kaydına: kaç sipariş, hangi kimlikler (kişisel veri değil). Loglarda gövde ve token yok.
- Yalnızca HTTPS (F16 proxy).
- Sağlayıcı `birfatura` değilken ya da token yokken uçlar 404 (var olduğunu söylemez).

## Sahte sunucu

"Sahteler canlı gibi görünmeli": hiçbir yerde "sahte/demo/test" yazısı yok.

- **A (`packages/testing/src/birfatura`, `pnpm dev:birfatura`):** sahte BirFatura bir **istemci**dir: aralıklarla bizim `/hooks/birfatura/api/orderStatus`, `paymentMethods`, `orders` uçlarımızı token ile çağırır, her sipariş için GİB biçiminde numara üretir (mağazanın serisiyle, ör. `ABC2026000000001`), gerçekçi bir fatura PDF'i (`packages/testing/src/invoice-pdf.ts`) kendi `/dosyagetir?tur=1&guid=<…>.pdf` adresinden sunar ve `invoiceLinkUpdate` ile bize yazar. Token'ı yerel durum dosyasından okur (`packages/testing/src/dev/state-file.ts`). Hata senaryoları: geç çekme, aynı siparişe ikinci bildirim, farklı numara, erişilemeyen PDF.
- **B:** OutEBelgeV2 uçlarının sahtesi (`SendBasicInvoiceFromModel`, `GetUserPK` belgedeki test VKN'sini e-Fatura mükellefi sayar, `GetOutBoxDocumentStatusesWithUUIDs`, `GetPDFLinkByUUID` önce boş sonra bağlantı, `SendDocumentAnswer`, `GetNumberOfCredits`), üç başlık denetimi, zarf `{ Success, Message, Code, Result }`.

## Test planı

- **Birim:** taslak → `Orders[]` eşlemesi (şahıs/şirket, anonim TCKN, telefon yedeği, kargo satırının `ShippingCharge`'a gitmesi, kapıda ödeme bedeli, indirim ve 4 ondalık, `ProductId`'nin kararlılığı, tarih biçimi ve saat dilimi); token karşılaştırma; tarih aralığı ve sayfa sınırı; `invoiceLinkUpdate` doğrulaması (seri, numara biçimi, tarih).
- **HTTP** (`integration-tests/http/einvoice-birfatura.spec.ts`): token yok/yanlış → 401; sağlayıcı kapalı → 404; bekleyen sipariş listede, kesilmiş/iptal/iade listede değil; bekletme kuralı (kapıda ödeme teslimden önce görünmez); `invoiceLinkUpdate` → kayıt `issued`, PDF depoda, müşteri e-postası; aynı numara tekrar → başarı; farklı numara → ret; seri uymazsa ret; PDF alan adı izinli değilse indirilmez; değişim faturası ayrı `OrderId`; denetim kaydı yazılamazsa 503.
- **Sözleşme:** BirFatura belgesindeki JSON örnekleri test sabiti olarak; yanıtlarımızın alan adları büyük/küçük harf dahil şemayla birebir (belge kuralı).
- **B için:** Paraşüt testlerinin karşılığı (`einvoice-issue` kalıbı): e-Fatura ve e-Arşiv, sonucu bilinmeyen gönderimde tek belge, PDF gecikmesi, iptal sınırı.
- Panel: Ayarlar > E-Fatura'da BirFatura seçimi, token oluşturma/yenileme (bir kez gösterim), son çekme bilgisi.

## KVKK

BirFatura'ya giden (A'da BirFatura'nın çektiği) kişisel veri: alıcının adı/unvanı, fatura ve teslimat adresi, cep telefonu, e-postası, TCKN (şahıs) ya da VKN ve vergi dairesi (şirket); sipariş kalemleri ve tutarları. Fatura PDF'i bizde özel depoda (mevcut satır).

`docs/kvkk-envanter.md`'ye eklenecek satır (aktarımlar bölümüne):

| Alıcı | Aktarılan veri | Amaç | Hukuki sebep | Yer | Not |
|---|---|---|---|---|---|
| BirFatura (özel entegratör; e-Fatura/e-Arşiv) | Alıcı adı/unvanı, fatura ve teslimat adresi, telefon, e-posta, TCKN ya da VKN ve vergi dairesi, sipariş kalemleri ve tutarları | Vergi belgesi düzenleme ve GİB'e iletim | Kanuni yükümlülük (VUK, KVKK md. 5/2-ç) | Yurt içi (doğrulanmadı) | Mağaza BirFatura'yı seçtiyse. Çekme modelinde veri BirFatura'nın isteğiyle verilir; her çekme denetim kaydında. Saklama BirFatura'da VUK süresi (10 yıl); bizdeki silme akışı fatura PDF'ini korur (vergi belgesi) |

`integration-credentials` satırı değişmez (token mağazanın hesap erişimidir, kişisel veri değil).

## Kod dışı gereksinimler (sahibin yapacakları)

- Mağazanın BirFatura'da e-Fatura/e-Arşiv mükellefi olarak hesabı (başvuru, mali mühür ya da e-imza, GİB süreci). Mağaza başka bir entegratörden geliyorsa entegratör değişikliği GİB sürecidir; süre ve maliyet BirFatura'ya sorulur.
- BirFatura'da "Özel Entegrasyon" mağazası açmak; web sitesi adresini ve bizim ürettiğimiz token'ı (panelimizden kopyalanır) girmek; web satışları için ayrı seriyi tanımlamak (mali müşavir 6.2).
- Test hesabı: `entegrasyon@birfatura.com`'a (kayıtlı olmayan bir e-postadan). İtme yolu için API anahtarları `outapibilgileri` sayfasından; anahtarlar **yalnızca panelimizden** girilir, belgeye/koda/sohbete yazılmaz.
- Kontör paketi.
- Mali müşavire: BirFatura e-Arşiv'inde internet satışı bilgilerinin (ödeme tarihi, aracı, taşıyıcı VKN'si) nasıl doldurulduğu ilk test faturasında kontrol edilsin.

## Açık sorular (BirFatura'ya)

1. Çekme otomatik mi (hangi sıklıkla), yoksa BirFatura panelinden elle mi?
2. "Web sitesi adresi" yol önekli olabilir mi (`https://alan/hooks/birfatura`)? Çağrılar sabit IP'lerden mi geliyor?
3. Aynı `OrderId` ikinci kez çekilirse yeniden faturalanır mı? `invoiceLinkUpdate` başarısız dönerse yeniden gönderilir mi?
4. `invoiceLinkUpdate`'te ETTN ve belge tipi (e-Fatura/e-Arşiv) gönderilebilir mi? PDF bağlantısının alan adı ve geçerlilik süresi?
5. e-Arşiv internet satışı bilgileri (ödeme tarihi, ödeme aracısı, taşıyıcı VKN'si, gönderim tarihi) çekme ve `SendBasicInvoiceFromModel` modellerinde nereden doluyor?
6. Bir siparişe ikinci satış faturası (değişim) için önerilen yol?
7. `ProductId` ne için kullanılıyor (stok/ürün eşleme)?
8. BirFatura alıcıya e-Arşiv e-postası gönderiyor mu, kapatılabilir mi?
9. İtme yolunda: kendi kestiğimiz e-Arşiv `SendDocumentAnswer IPTAL` ile iptal edilebilir mi? Test ortamının adresi? `X-Integration-Key` platforma mı mağazaya mı verilir (bayilik/iş ortaklığı)? Hız sınırı ve kontör tüketimi (iptal kontör yer mi)?
10. Durum kodları tablosu (`1300` vb.).
