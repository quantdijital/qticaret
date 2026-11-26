# Aras Kargo Fulfillment Provider

> Kaynak: Aras'ın test servis tanımı (WSDL, herkese açık) ve topluluk istemcileri; resmî belge sözleşmeyle gelir, elimizde yok. Karar: ADR-0035. Kod: `apps/backend/src/lib/shipping/aras` (istemci, eşleme, durum, hesap), sağlayıcı `apps/backend/src/modules/fulfillment-aras`, sahte servis `packages/testing/src/aras`. Bu dosya 2026-11-26'da koddan çıkarılan özettir; ayrıntı ve geçmiş ADR-0035'te.

## Erişim ve hesaplar

- SOAP 1.1 ASMX, ad alanı `http://tempuri.org/`, yol `/arascargoservice/arascargoservice.asmx`:
  - Test: `https://customerservicestest.araskargo.com.tr`
  - Canlı: `https://customerws.araskargo.com.tr` (**doğrulanmadı**; panel Aras'ın verdiği adresi alır, yalnız `araskargo.com.tr` alanı ve 443).
- Panelden: kullanıcı adı, şifre (gizli), müşteri kodu, test modu, isteğe bağlı servis adresi (ADR-0027).

## Medusa metot eşlemesi

| Medusa | Aras | Not |
|---|---|---|
| getFulfillmentOptions | — | `aras-flat`, `aras-table` |
| calculatePrice | — | Sabit tutar ya da mağazanın desi tablosu |
| createFulfillment | `SetOrder` + `GetArasBarcode` | Kendi `IntegrationCode`'umuz (`shipmentCode`); etiket alınamazsa ya da yanıt gelmezse `CancelDispatch` ile geri çekilir |
| cancelFulfillment | `CancelDispatch` | `ResultCode` 0 başarı |
| takip işi | `GetCargoInfo` | DataSet satırları; durum yalnız adı DURUM/STATU içeren sütunlardan okunur (`status.ts`) |
| hesap kontrolü | `GetOrderWithIntegrationCode` (`QTCHECK`) | SOAP fault → `secret_invalid` |
| etiket | `GetArasBarcode` | PDF base64 (`ZebraPdf`), özel depoya |

- Kapıda ödeme: `IsCod`, `CodAmount` (noktalı), `CodCollectionType`/`CodBillingType` `0` (sözleşmeyle **doğrulanacak**).
- Ödeyen: `PayorTypeCode` 1 (gönderici). Tek koli, `PieceDetails` içinde `BarcodeNumber` = `IntegrationCode`.

## Başka bir entegrasyonla karşılaştırma (2026-11-26)

Sahibin verdiği bir WooCommerce eklentisi (`kargo-entegrasyon` v0.1.0, yazarı ve lisansı belirsiz; yalnız veri olarak okundu, kod alınmadı) Aras'ı bizden farklı kullanıyor:

- **Takip:** eklenti `GetQueryJSON`'u ayrı bir serviste çağırıyor: `https://customerservices.araskargo.com.tr/ArasCargoCustomerIntegrationService/ArasCargoIntegrationService.svc` (WCF; işlemler `GetQueryDS`, `GetQueryXML`, `GetQueryJSON`, `SetDataXML`, `CallCourier`, servis tanımı 2026-11-26'da okundu). Giriş `loginInfo` (XML metni: `UserName`, `Password`, `CustomerCode`) ve `queryInfo` (`QueryType` 1 + `IntegrationCode`; eklenti bunu "doğrulanmalı" diye işaretliyor). Bu servis için Aras'ın **ayrı bir takip kullanıcısı** verdiğini, testi olmadığını ve takibin her zaman canlıya gittiğini yazıyor. Biz takibi `GetCargoInfo` ile gönderi servisinde yapıyoruz; gerçek hesapla `GetCargoInfo` çalışmazsa yedek yol budur.
- **Durum kodu:** eklenti `DURUM_KODU` 6 = teslim edildi diyor ("doğrulanmalı"). Biz metinden okuyoruz.
- **Canlı adres:** eklenti canlı gönderi servisini `https://customerws.araskargo.com.tr/arascargoservice.asmx` (ara klasörsüz) olarak yazıyor; bizim varsayılanımız `/arascargoservice/arascargoservice.asmx`. Gerçek hesapla doğrulanacak; panelde adres alanı bu yüzden var.
- **Kapıda ödeme:** eklenti `CodCollectionType` için 0 nakit, 1 kredi kartı seçeneği sunuyor; `CodBillingType` 0.
- **Çok koli:** eklenti koli başına `IntegrationCode` + iki haneli sıra (`01`, `02`) barkodu veriyor; biz tek koli gönderiyoruz.
