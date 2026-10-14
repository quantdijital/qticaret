# PayTR Payment Provider (yedek)

> Resmi PayTR dokümanından doğrula.

## Akış (iFrame API)
```
initiatePayment → token isteği (merchant_id, user_ip, merchant_oid=session id, tutar (kuruş), sepet base64,
                   paytr_token = HMAC-SHA256(merchant_key, birleştirilmiş alanlar + merchant_salt))
               → iframe token session.data'ya
PayTR → Bildirim URL (POST /hooks/paytr/notify): hash doğrula → status → yanıt düz metin "OK"
```

## Kritik noktalar
- Bildirim URL'i "OK" dönmezse PayTR tekrar dener → idempotency şart.
- Hash doğrulaması sabit zamanlı karşılaştırma (`timingSafeEqual`).
- Tutarlar kuruş cinsinden tam sayı.
- İade API'si ayrı; kısmi iade desteğini dokümandan doğrula.

## Env
`PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, `PAYTR_TEST_MODE`
