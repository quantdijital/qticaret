# Yerel PayTR

`pnpm dev:paytr` PayTR'ın iFrame API'sini, durum sorgusunu, iadeyi, taksit oranlarını ve işlem dökümünü `http://127.0.0.1:9102` adresinde yanıtlar (adr/0028). Backend `PAYTR_BASE_URL=http://127.0.0.1:9102` ile açılır; bu adres tanımlıyken panelin test modu ne olursa olsun ödeme buraya gelir. **Test modu kapalı kalsın**: o zaman form, siparişteki kart bilgisi ve ekstre canlıdaki gibi görünür. Test modu açıkken form, PayTR'ınki gibi test kartıyla dolu gelir.

## Ödeme akışı

1. Kart formu (PayTR çerçevesi): ad soyad, kart numarası, son kullanma tarihi (AA/YY), CVV. Numaranın ilk altı hanesi yazılınca kartın programı (Axess, Bonus, ...) ve o programın taksitleri listelenir; mağazanın taksit sınırı geçerlidir. "Ödeme yap".
2. Bankanın 3D Secure sayfası: işyeri, tutar, tarih, maskeli kart; SMS şifresi olarak **herhangi 6 hane**. "Onayla" alışverişçiyi mağazaya döndürür, "İptal" kart formuna.
3. Sonucu kartın numarası belirler; bildirim mağazanın bildirim adresine imzalı gider.

Son kullanma tarihi ileri bir tarih olmalı (ör. `12/30`), CVV herhangi 3 hane (American Express 4).

Kart formu ve PayTR'ın kendi sayfaları, PayTR'ınkiler gibi iframe-resizer'ın içerik tarafını çalıştırır: vitrinin çerçevesi `[iFrameSizer]…` init mesajını gönderince sayfanın yüksekliğini bildirir, çerçeve sayfanın boyunu alır (`docs/entegrasyonlar/paytr.md`, "Çerçevenin yüksekliği"). Bankanın 3D Secure sayfası bildirmez; çerçeve orada 640 px kalır.

## Kartlar

| Numara              | Sonuç                                    | Program                           |
| ------------------- | ---------------------------------------- | --------------------------------- |
| 4355 0843 5508 4358 | ödenir                                   | Axess, Visa (PayTR'ın test kartı) |
| 5406 6754 0667 5403 | ödenir                                   | Axess, Mastercard                 |
| 5400 3600 0000 0003 | ödenir                                   | Bonus                             |
| 4022 7740 2277 4026 | ödenir                                   | CardFinans                        |
| 9792 0303 9444 0796 | ödenir                                   | CardFinans, Troy                  |
| 4543 5900 0000 0006 | ödenir                                   | Maximum                           |
| 5528 7900 0000 0008 | ödenir                                   | Paraf                             |
| 4157 9200 0000 0002 | ödenir                                   | World                             |
| 5504 7200 0000 0003 | ödenir                                   | Advantage                         |
| 5407 0900 0000 0009 | ödenir                                   | Bankkart Combo                    |
| 4129 1111 1111 1111 | banka onaylamaz (`failed_reason_code` 0) | programsız Visa                   |
| 4111 1111 1111 1129 | limit yetersiz (`failed_reason_code` 0)  | programsız Visa                   |

Luhn denetiminden geçen başka her numara ödenir; programı bilinmeyen kart yalnız tek çekim öder. Program tablosu ve kartlar: `cards.ts`. Taksit oranları (8 program, 2-12 taksit, 2026-11 görüntüsü): `rates.ts`. Durum sorgusu (`kart_marka`, `masked_pan`) ve ekstre (`kart_marka`, `kart_no`) formda yazılan kartı gösterir.

## Testler için

- Testler `startFakePaytr` ile boş durumdan başlar, dar oran tablosuyla (`TEST_RATES`) fiyatlar; `fake.pay()` World •••• 6747 kartıyla öder.
- Formun adresine `outcome=success|failed|silent` alanıyla POST, ödemeyi kart sormadan bitirir (backend HTTP testleri).
- Formun adresine `?notification=lost` eklenirse ödeme alınır ama bildirim mağazaya gitmez; mağaza ödemeyi durum sorgusuyla bulmalıdır. Bu bayrak sayfada görünmez.
- `pnpm dev:paytr` ödemeleri ve iadeleri işletim sisteminin geçici klasöründe (`qticaret-local-providers/paytr-<port>.json`) saklar; yeniden başlatma iadeyi bozmaz. Temiz başlamak için dosyayı silin.
