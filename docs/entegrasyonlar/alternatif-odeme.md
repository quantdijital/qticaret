# Alternatif Ödemeler: Havale/EFT ve Kapıda Ödeme

> Her ikisi de Medusa payment provider'ı olarak yazılır (`AbstractPaymentProvider`); dış servis çağırmazlar
> ama ödeme yönlendirici ve contract test paketine (F6.4) dahil olurlar.

## Havale/EFT (`payment-bank-transfer`)
```
initiatePayment → session "pending"; IBAN + açıklama kodu (sipariş no) session.data'ya
cart complete   → sipariş "ödeme bekleniyor" durumunda oluşur, stok rezerve edilir
admin onayı     → authorize + capture → normal sipariş akışı (kargo, fatura)
süre dolarsa    → job: sipariş iptal, rezervasyon serbest, müşteriye bildirim
```
- IBAN, banka adı, hesap sahibi, ödeme süresi (saat) `platform-settings`'te; secret değildir.
- Açıklama kodu benzersiz ve kısa; admin listesinde ödeme eşleştirmesini kolaylaştırır.
- Banka hesap hareketi otomatik eşleştirme (banka API'si) sonraki iyileştirme; ilk sürüm manuel onay.

## Kapıda ödeme (`payment-cod`)
- Feature flag: `cash_on_delivery`. Kapalıyken provider region'da listelenmez.
- Ayarlar: ek ücret (sabit/oran), sipariş tutarı üst sınırı, nakit/kart seçenekleri.
- Ek ücret sunucuda hesaplanır ve sepette ayrı kalem olarak görünür; faturada ayrı satır (mali müşavirle doğrula).
- Yalnızca kapıda ödemeyi destekleyen kargo seçenekleriyle birlikte sunulur (Geliver desteği doğrulanır).
- Teslimde tahsilat → kargo firmasından mutabakat bilgisi → `captured`; iade/teslim edilemezse sipariş iptal akışı.

## Testler
- Contract test paketini geçer (F6.4).
- Havale: süre dolumu job'u, mükerrer onay, onay sonrası iptal.
- Kapıda ödeme: flag kapalı, tutar sınırı, desteklemeyen kargo seçeneği, ek ücretin istemciden gelmesi (etkisiz olmalı).
