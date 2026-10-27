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
- **Uygulama (F6 W1, ADR-0029):**
  - `pp_bank-transfer_bank-transfer`, Medusa'nın `pending_authorization` durumuyla. Sipariş `awaiting` oluşur, `Payment` yoktur.
  - Onay W2'de: oturumun verisine `confirmed_at` yazılır, yeniden yetkilendirmede `captured` döner.
  - Ayar bölümü `bank_transfer`: `enabled`, `account_holder`, `bank_name`, `iban` (boşluksuz, TR mod-97), `deadline_hours` (1–336, varsayılan 48).
  - Açıklama kodu sipariş numarasıdır (`display_id`).
  - Başlatma `POST /store/carts/:id/payment-session` `{ provider_id }` ile; dönüş adresi gerekmez.
  - `GET /store/payment/methods` hesabı (IBAN dörtlü gruplarla) ve süreyi verir.

## Kapıda ödeme (`payment-cod`)
- Feature flag: `cash_on_delivery`. Kapalıyken provider region'da listelenmez.
- Ayarlar: ek ücret (sabit/oran), sipariş tutarı üst sınırı, nakit/kart seçenekleri.
- Ek ücret sunucuda hesaplanır ve sepette ayrı kalem olarak görünür; faturada ayrı satır (mali müşavirle doğrula).
- Yalnızca kapıda ödemeyi destekleyen kargo seçenekleriyle birlikte sunulur (Geliver desteği doğrulanır).
- Teslimde tahsilat → kargo firmasından mutabakat bilgisi → `captured`; iade/teslim edilemezse sipariş iptal akışı.

- **Uygulama (F6 W3, ADR-0029):**
  - Sağlayıcı `pp_cod_cod`; yetkilendirme `authorized`. Sipariş kargoya verilebilir; para gelince panelden "Tahsil et" (capture).
  - Kargo firmasının tahsilat mutabakatı F7'de.
  - Ayar bölümü `cash_on_delivery`:
    - `fee_type` (none/fixed/percent);
    - `fee_value` (sabitte kuruş, oranda baz puan);
    - `max_amount` (kuruş, 0 sınırsız; ek ücret hariç sipariş tutarına göre);
    - `shipping_option_ids` (kapıda tahsilat yapan kargo seçenekleri).
  - Açıp kapamak `cash_on_delivery` özellik bayrağıyla.
  - Ek ücret kalemi:
    - Başlatmada eklenir. Varyantsız, `is_custom_price`, KDV dahil, kargo gerektirmez, `metadata.qt_fee = "cash_on_delivery"`.
    - Başka yönteme geçilince silinir.
    - Medusa'nın sepet kilidi yüzünden başlatma kilidimizden önce eklenir.
    - Store ucundan değiştirilemez ve silinemez.
    - Tamamlamada ücret ve uygunluk yeniden hesaplanır; tutmazsa `cash_on_delivery.fee_mismatch`.
  - `GET /store/payment/methods?cart_id=` sepete göre uygunluğu ve ücreti verir.

## Testler
- Contract test paketini geçer (F6.4).
- Havale: süre dolumu job'u, mükerrer onay, onay sonrası iptal.
- Kapıda ödeme: flag kapalı, tutar sınırı, desteklemeyen kargo seçeneği, ek ücretin istemciden gelmesi (etkisiz olmalı).
