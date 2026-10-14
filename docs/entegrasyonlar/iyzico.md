# iyzico Payment Provider

> Güncel API'yi resmi dokümandan ve SDK'dan (npm: `iyzipay`) doğrula. Aşağıdaki akış tasarım rehberidir.

## Akış (Checkout Form)
```
Store: sepet hazır → POST /store/payment-collections/:id/payment-sessions (provider: iyzico)
  → initiatePayment: CF initialize (basket sunucudan) → { token, paymentPageUrl } session.data'ya
Storefront: kullanıcıyı ödeme sayfasına yönlendirir / iframe'de açar
iyzico → callbackUrl (POST /hooks/iyzico/callback, body: token)
  → token ile CF retrieve → paymentStatus kontrolü → session eşlemesi (conversationId)
  → cart complete workflow → yönlendirme (başarı/başarısız sayfası)
```

## Medusa metot eşlemesi
| Medusa | iyzico | Not |
|---|---|---|
| initiatePayment | Checkout Form Initialize | conversationId = session id; tutarlar string, 2 ondalık |
| authorizePayment | Checkout Form Retrieve | SUCCESS → authorized; itemTransactions saklanır |
| capturePayment | — | iyzico anında çeker; durum güncellenir |
| refundPayment | Refund | Kalem bazlı paymentTransactionId; tutar dağıtımı mapper'da |
| cancelPayment | Cancel | Gün sonu öncesi; değilse refund yoluna yönlendir |
| getPaymentStatus | Retrieve | |
| getWebhookActionAndData | Webhook | İmza doğrulama zorunlu |

## Kritik noktalar
- `price` = kalemlerin toplamı, `paidPrice` = indirim/kargo dahil son tutar. Yuvarlama farkları mapper'da tek yerde çözülür.
- Kargo ücreti ayrı bir basket item olarak gönderilir (iade hesabı için).
- Buyer alanları: identityNumber zorunlu (TCKN yoksa kurumsal VKN akışı veya sağlayıcı dokümanındaki kurala göre).
- itemTransactions (kalem ↔ paymentTransactionId) siparişle birlikte saklanır; kısmi iadenin temeli.
- Taksit: `installment info` (BIN + tutar) → kart ailesi, banka, taksit seçenekleri; Redis cache (BIN+tutar aralığı, kısa TTL).
- Sandbox/prod base URL env ile; prod anahtarı sandbox URL ile asla eşleşmemeli (açılış kontrolü).

## Env
`IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL`, `IYZICO_CALLBACK_URL`

## Testler
Mock sunucu senaryoları: başarı, 3DS fail, iptal, mükerrer callback, kısmi iade, 5xx/timeout.
