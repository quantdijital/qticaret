# ADR-0082: Tarihli üründe kapora (ön ödeme) ve bakiye tahsilatı

- **Durum:** Kabul (sahip, 2026-11-25). S1 (yüzde ve kişi başı sabit tutar ikisi de, görünürde yüzde) ve S2'yi (önce basit yol, sonra ödeme bağlantısı; karttan otomatik çekim yok) sahip kendisi seçti; S3–S6 için "soruları kendin cevapla, devam et" dedi ve aşağıdaki öneriler karar oldu: S3 kalkıştan 30 gün önce, S4 hatırlat ve mağazaya bırak (kendiliğinden iptal ayarı kapalı gelir), S5 mevcut kademeler ödenenle sınırlı, S6 fatura tamamı ödenince (mali müşavir teyidiyle değişebilen ayar). Hukukçu ya da mali müşavir doğrulaması isteyen maddeler doğrulanana kadar yazılı varsayılanla yürür; her dilim kendi PR'ında `security-reviewer` incelemesinden geçer.
- **Tarih:** 2026-11-25
- **İlgili:** adr/0076 (tarihli ürün; K10 "ilk sürüm tam ödemedir, kapora ayrı ADR"), adr/0026 (barındırılan ödeme formu, sahipsiz ödeme), adr/0029 (havale), adr/0033 (sipariş düzenleme: fark tahsilatı), adr/0051 (ödeme bağlantısı), adr/0034 (e-fatura tetikleri), adr/0010 (kuruş ve yuvarlama), adr/0044 (dolandırıcılık koruması), adr/0083 (oda dağılımı), adr/0084 (tarih aralığı kipi)
- **Dayanak:** adr/0076 "Sonraya" satırı ve açık sorusu (kapora ve bakiye tahsilatı; sağlayıcıların ön provizyon desteği doğrulanacak). İlk kullanım: kendi turlarını satan acenta. Tur tutarı büyüktür, aylar öncesinden satılır; müşteri tamamını o gün ödemek istemez.

## Kararlar (sahip, 2026-11-25; "Önerim" sütunu karardır)

Kısa liste; her birinin seçenekleri ve gerekçesi hemen altında. İkili tercihler soru değil, **ayar** olarak gelir (varsayılanı yazılı).

| # | Karar | Önerim |
|---|---|---|
| S1 | Kapora nasıl hesaplanır | Ürün ayarında yüzde (varsayılan %25); ikinci planda "kişi başı sabit tutar" |
| S2 | Kalan tutar nasıl tahsil edilir | Önce basit yol ("kalan için sizinle iletişime geçeceğiz", personel "Bakiyeyi aldım" der); ardından ödeme bağlantısı. Kayıtlı karttan otomatik çekim yapılmaz |
| S3 | Kalan tutarın son günü (vade) | Kalkıştan 30 gün önce (ürün ayarı); vadeye az kala yapılan satışta kapora sunulmaz, tamamı istenir |
| S4 | Vadesinde ödenmezse | Müşteriye hatırlatma, mağazaya zil; iptal elle. "Kendiliğinden iptal et" ayarı var, varsayılan kapalı |
| S5 | İptalde kaporanın akıbeti | Mevcut iptal kademeleri toplam tutar üzerinden; kesinti ödenen tutarı aşamaz, aşan kısım müşteriden istenmez |
| S6 | Kaporalı siparişin faturası | Tamamı ödenince kesilir (varsayılan); mali müşavirin cevabına göre ayar |

### S1. Kapora nasıl hesaplanır

- **A. Yüzde** (ör. %25). Müşteri "10.000 TL'nin 2.500 TL'sini şimdi öde" görür; fiyat değişse de oran aynı kalır. Mağaza tek sayı girer.
- **B. Kişi başı sabit tutar** (ör. kişi başı 2.000 TL). Tur satıcılarında yaygın; kampanyalı fiyatta kapora toplamın çoğunu bulabilir (o durumda kapora sunulmaz).
- **C. İkisi de, ürün başına seçilir.** Ayar bir alan fazla.
- **Önerim: C, görünürde A.** Ürünün rezervasyon ayarında "Kapora al" anahtarı (varsayılan kapalı) ve oran alanı; "kişi başı sabit tutar" ikinci planda.
- **Ayar (soru değil):** "Müşteri tamamını da ödeyebilsin" varsayılan açık. Ödeme adımında iki seçenek görünür: "Şimdi kapora" ve "Tamamını şimdi öde".

### S2. Kalan tutar nasıl tahsil edilir

- **A. Basit yol: "Kalan için sizinle iletişime geçeceğiz".** Müşteri kaporayı vitrinde öder; kalanı mağaza havale, POS ya da nakitle alır ve panelde "Bakiyeyi aldım" der. Risk: takip mağazada; sistem vadeyi hatırlatır.
- **B. Ödeme bağlantısı.** Vade yaklaşınca müşteriye e-posta ve SMS ile "Kalanı öde" bağlantısı gider; vitrinde kartla öder, sipariş kendiliğinden "tamamı ödendi" olur. Risk: yeni bir ödeme yolu yazılır (aşağıda "Para güvenliği").
- **C. Kayıtlı karttan otomatik çekim.** Müşteri hiçbir şey yapmaz. Risk: kart saklamak gerekir; bugün bilerek kapsam dışı (adr/0026). PayTR bunu ayrı yetki ve onaya bağlar; itiraz (ters ibraz) riski en yüksek yoldur. Shopify da bakiyeyi kendisi çekmez, satıcıya ya da uygulamaya bırakır.
- **Önerim: önce A, sonra B; C yapılmaz.** A ilk dilimde tek başına yayınlanır. B gelince mağaza ayarı "Kalan tutar çevrim içi ödenebilsin" (varsayılan açık) ile seçilir; kapalıyken e-postalarda bağlantı yerine mağazanın notu çıkar (voucher ve çevrim içi iptaldeki basit yol deseni, adr/0076 Ek "basit yol ayarları").

### S3. Vade

- **A. Kalkıştan N gün önce** (ürün ayarı, varsayılan 30). Türkiye'deki tur satıcılarının ortak düzeni (Jolly Tur ve Prontotour 30 gün, Setur 45 gün).
- **B. Satıştan N gün sonra.** Erken satışta parayı erken toplar; müşteriye anlatması zor.
- **C. Kalkış günü, kapıda.** En esnek; gelmeyen müşteride mağaza yalnız kaporayla kalır.
- **Önerim: A, 30 gün.** Paket turda 30 günden önce iptalde kesinti yapılamadığından (adr/0076 K9), kesintisiz iptal dönemi bitmeden bakiye toplanmış olur. Vadeye kalan süre ayardan kısaysa kapora sunulmaz.

### S4. Vadesinde ödenmezse

- **A. Hatırlat ve mağazaya bırak.** Vadeden 7 ve 1 gün önce müşteriye hatırlatma; vade geçince müşteriye "vadesi geçti" iletisi, mağazaya zil. İptali personel yapar.
- **B. Ek süre sonunda kendiliğinden iptal.** Vade + N gün (varsayılan 3) sonunda rezervasyon iptal edilir, yer satışa döner, kapora iptal kademesine göre iade edilir ya da kesilir. Risk: bir müşterinin turu insan bakmadan iptal olur.
- **Önerim: A varsayılan; B aç/kapa ayarı, varsayılan kapalı.** Yanlış iptalin bedeli (müşteri kaybı, şikâyet) geciken tahsilatın bedelinden büyüktür.

### S5. İptalde kapora

- **A. Bugünkü kademeler, ödenenle sınırlı.** Kesinti toplam tutar üzerinden hesaplanır; ödenen tutardan düşülür; kesinti ödeneni aşarsa aşan kısım istenmez (panelde "tahsil edilmeyen kesinti" olarak görünür).
- **B. "Kapora iade edilmez" anahtarı.** Basit ve yaygın söylem; paket turda 30 gün kuralıyla çelişebilir (doğrulanmalı, hukukçu).
- **C. Aşan kesintiyi de iste.** Müşteriye borç çıkarmak; tahsili pratikte yok.
- **Önerim: A.** B ancak hukukçu "paket tur dışı tarihli hizmette serbest" derse ayrı ayar olarak eklenir.

### S6. Fatura

- **A. Tamamı ödenince** (varsayılan öneri). Tek fatura, tam tutar; iptalde düzeltme belgesi gerekmez.
- **B. Kapora alınınca tam tutarlı fatura.** Sipariş anındaki bugünkü davranış; iptalde iade belgesi gerekir.
- **C. Her tahsilatta ayrı belge.** Avans faturası + kalan faturası; muhasebesi en ağır.
- **Önerim: A, ama karar mali müşavirin.** Okunan bir GİB özelgesi avans için fatura gerekmediğini, kesilirse KDV'nin o tutarla doğduğunu söylüyor (aşağıda; doğrulanmalı). Tetik bir ayar olarak yazılır; cevap gelince varsayılan değişebilir.

## Bağlam

### Kodda bugün olan (2026-11-25 `dev`, okundu)

- **Tarihli ürün tam ödemeyle satılır** (adr/0076 K10). Rezervasyonun tutması, onayı, iptal kademeleri, voucher ve bildirimleri yazıldı (D1–D8).
- **Ödeme yığını sepete bağlıdır** (adr/0026): tek kapı `POST /store/carts/:id/payment-session`; tutar ödeme koleksiyonundan gelir; PayTR ve iyzico parayı **anında çeker** (ön provizyon kullanılmıyor); sipariş sağlayıcının bildirimiyle sepetten açılır.
- **Tutar eşitliği değişmezdir:** `paymentMismatch` (`lib/payments/consistency.ts`) sepet toplamı, koleksiyon ve canlı her oturumun kuruşu kuruşuna aynı olmasını ister. Kapora bu kuralın bilinçli ve dar bir genişletmesini gerektirir.
- **Siparişe sonradan tahsilat eklemenin emsali var:** sipariş düzenlemede fark ve değişimde fark, Medusa'nın sipariş tahsilatı açılıp `markPaymentCollectionAsPaid` ile "aldım" işaretlenerek kapanır (`workflows/orders/edit-order.ts`, `workflows/returns/approve-exchange.ts`). Çevrim içi fark tahsilatı yok.
- **Ödeme bağlantısı** (adr/0051) taze, kilitli bir **sepet** açar ve yeni bir sipariş üretir; mevcut bir siparişin kalanını tahsil edemez.
- **Kart saklama yok:** bilerek kapsam dışı (adr/0026, docs/entegrasyonlar/iyzico.md).
- **İade tek ödemeye göre kurulu:** kalkış iadesi kendiliğinden yalnız tek, barındırılan kart formuyla alınmış ödemeye gider; elle alınan para, kredi ve birden çok ödeme personele kalır (`workflows/booking/refund-way.ts`; adr/0076 Ek D7a O1–O2). Müşterinin kendi iptali birden çok ödemeli siparişte kapalıdır (adr/0033 §4).
- **E-fatura** siparişin anına göre kuyruğa girer (`placed`, `paid`, `shipped`, `delivered`; `subscribers/einvoice-queue.ts`) ve bekletme kuralı vardır (`workflows/einvoice/order-hold.ts`).

### Başkaları nasıl yapıyor (kaynaklı araştırma, 2026-11-25)

İşaretler: **(okundu)** sayfa açılıp okundu; **(arama özeti)** yalnız arama sonucundaki özetten; ikincisi karar dayanağı sayılmaz. Hukuk ve vergi maddeleri resmî siteden değil ikincil kaynaktan (lexpera) okundu: hepsi **doğrulanmalı**, hüküm değildir.

- **Türkiye'de tur satıcıları.** Jolly Tur'un "%25 ön ödemeli yurt dışı tur" koşulu: misafir bakiyenin tamamını tur başlangıcından 30 gün öncesine kadar öder ([kampanya koşulları](https://www.jollytur.com/secili-yurt-disi-turlarda-yaz-erken-rezervasyon-firsatlari-kampanya-kosullari), okundu). Prontotour: en az %25 peşin, kalan tura 30 gün kalana kadar ([DHA haberi, 2023](https://www.dha.com.tr/ekonomi/prontotour-yuzde-50-indirimli-erken-rezervasyon-kampanyasi-baslatti-2326857), okundu). Setur: en az %25, kalan harekete 45 gün kalana kadar; ETS Tur: "%25'ini şimdi, kalanını tatilden önce" (ikisi de arama özeti).
- **Shopify.** Kapora ve kısmi ödeme yerel olarak yalnız **Plus** planında ve B2B/taslak siparişte vardır; vade dolunca kayıtlı kart kendiliğinden çekilmez, satıcı panelden elle çeker; vadesi geçen sipariş müşteri hesabında "Overdue" görünür ve yine ödenebilir ([payment terms](https://help.shopify.com/manual/b2b/payment-terms), [partial payments](https://help.shopify.com/en/manual/payments/partial-payments), okundu). Ön siparişte "bir kısmı şimdi, kalanı sonra" satın alma seçeneğiyle gelir; Shopify kartı saklar ama bakiyeyi **uygulama** çeker, zamanlama ve hata yönetimi uygulamanın sorumluluğudur; siparişte tek vade olur, taslak siparişte ve yerel ödeme yöntemlerinde kullanılamaz ([deferred purchase options](https://shopify.dev/docs/apps/build/purchase-options/deferred), okundu).
- **Tur pazar yerleri ve yazılımları.** TourRadar son ödemeyi vade günü karttan kendiliğinden çeker, iki hafta önce hatırlatır; vadeden sonra yapılan rezervasyonda tamamı hemen alınır; kart reddedilirse rezervasyon "iptal riski altındadır" ([final payment](https://support.tourradar.com/faq/how-is-the-final-payment-charged-for-my-clients-booking), okundu). WeTravel'da otomatik çekim isteğe bağlıdır; havale gibi yöntemlerle ödenen kaporada sonraki ödemeler elle toplanır; vade kaçınca iki gün sonra gecikme bildirimi gider, **otomatik iptal yoktur** ([auto-billing](https://help.wetravel.com/en/articles/1271076-does-wetravel-automatically-deduct-funds-from-my-participant-s-account-with-a-payment-plan), [missed deadline](https://help.wetravel.com/articles/1428051-what-if-a-participant-misses-a-payment-deadline), okundu). Rezdy ("tur tarihinden N gün önce ödeme isteği e-postası"; kalkışa N günden az kala tam ödeme), Bókun (kapora seçeneği kalkıştan N gün öncesine kadar), FareHarbor (kalan için süreli ödeme bağlantısı): yalnız arama özeti. Peek ve Checkfront: doğrulanamadı.
- **Konaklama.** Airbnb "bir kısmını şimdi, kalanını sonra": kalan tutar ödeme sırasında gösterilen tarihte kendiliğinden çekilir, üç gün önce e-posta gider; yalnız girişe en az 14 gün varken sunulur; çekim başarısızsa ödeme istenir, yoksa iptal riski ([yardım](https://www.airbnb.com/help/article/2143), okundu). Booking.com'da ön ödeme politikası tesisindir (yüzde ya da gece); ayrıntı arama özeti.
- **iyzico.** Ön provizyon ve sonradan kapama vardır; provizyonun kaç gün açık kaldığı belgede yok ([postauth](https://docs.iyzico.com/en/payment-methods/preauth-and-capture/non-3ds/non-3ds-implementation/create-postauth-payment), okundu). Kart saklama (`cardUserKey`, `cardToken`) ve saklı kartla çekim vardır; müşteri yokken çekimin koşulu belgede geçmiyor ([card storage](https://docs.iyzico.com/en/advanced/card-storage), okundu). Kısmi ve ardışık iade 365 gün içinde ([refund](https://docs.iyzico.com/en/advanced/refund-and-cancel), okundu).
- **PayTR.** Ön provizyon ürünü vardır; kapama 7–25 gün içindedir ([ön provizyon](https://www.paytr.com/en/on-provizyon), okundu): aylar sonraki bakiye için işe yaramaz. Saklı karttan müşteri yokken çekim (`recurring_payment`) vardır ama Non3D yetkisi ve ayrıca PayTR onayı ister ([tekrarlayan ödeme](https://dev.paytr.com/en/direkt-api/kart-saklama-api/kayitli-kart-tekrarlayan-odeme), okundu). Kısmi iade vardır ([iade API](https://dev.paytr.com/en/iade-api), okundu).
- **Paket Tur Sözleşmeleri Yönetmeliği** (RG 14.01.2015/29236; [lexpera](https://www.lexpera.com.tr/mevzuat/yonetmelikler/paket-tur-sozlesmeleri-yonetmeligi), ikincil kaynaktan okundu, doğrulanmalı): kaporaya özel madde yok; md. 5/2 broşürde "ön ödeme tutarı ve kalan bedelin ödeneceği tarih" ister; md. 6 sözleşmede ödeme planı ister; md. 16/2 turdan en az 30 gün önce fesihte zorunlu vergi ve harçlar dışında kesinti yapılamayacağını, md. 16/3 30 günden az kala sözleşmede yazılı kesintinin yapılabileceğini, md. 16/5 iadenin 14 gün içinde yapılacağını söyler.
- **Mesafeli Sözleşmeler Yönetmeliği** ([lexpera](https://www.lexpera.com.tr/mevzuat/yonetmelikler/mesafeli-sozlesmeler-yonetmeligi), ikincil kaynaktan okundu, doğrulanmalı): md. 2/2-f paket turları kapsam dışı tutar; md. 15/1-g belirli tarihte yapılacak konaklama, araba kiralama, eğlence ve dinlenme hizmetlerinde cayma hakkını (aksi kararlaştırılmadıkça) kaldırır; ön ödemeye özel hüküm yoktur.
- **Fatura.** Bir GİB özelgesi (Adana VDB, 18.04.2012): fatura hizmetin yapılmasına bağlıdır, "avans mahiyetindeki tahsilat için fatura düzenlenmesine de gerek bulunmamaktadır"; avans için fatura kesilirse KDV o tutarla sınırlı doğar; VUK md. 231/5 hizmetten sonra en geç yedi gün ([özelge](https://www.lexpera.com.tr/mevzuat/ozelgeler/b-07-1-gib-4-01-17-02-vuk-231-59-sayili-ozelge-1), ikincil kaynaktan okundu; mali müşavire doğrulatılmalı).
- **Doğrulanamayanlar:** FareHarbor, Peek, Checkfront ve Bókun'da otomatik bakiye çekimi; iyzico ön provizyon süresi ve müşteri yokken çekim koşulu; 6502 md. 51'in resmî metni; TÜRSAB'ın kapora düzenlemesi (bulunamadı).

**Çıkarılan dersler:** (1) Türkiye'de ortak düzen "%25 ön ödeme, kalan kalkıştan 30 gün önce"dir ve yönetmeliğin 30 gün eşiğiyle örtüşür: varsayılanlar buradan; (2) ön provizyon günlerle sınırlıdır, bakiye için çözüm değildir; (3) otomatik çekim her yerde kart saklama ve sağlayıcı onayı ister, Shopify bile bunu uygulamaya bırakır ya da elle yaptırır: önce bağlantı ve hatırlatma; (4) vadeden sonra yapılan satışta herkes tamamını ister; (5) vadesi geçeni kendiliğinden iptal eden örnek görülmedi, "risk altında" denip insana bırakılıyor; (6) yönetmelik ön ödeme tutarının ve kalan bedelin tarihinin satıştan önce yazılmasını istiyor: vitrin ikisini de gösterir.

## Karar (önerilen tasarım)

### 1. İlke

- Kapora bir **ödeme planıdır**, ürün türü değildir: sipariş tam tutarla açılır, yer tam olarak satılmış sayılır; yalnız tahsilat ikiye bölünür.
- Sektöre özel kod yok: "kapora", "bakiye", "vade" tarihli ürünün genel kavramlarıdır (tur, etkinlik, kurs; adr/0084 ile konaklama ve kiralama).
- Bayrak **`catalog.booking_deposit`** (mağazanın, varsayılan kapalı; `catalog.booking`'i gerektirir). Kapalıyken hiçbir davranış değişmez; yeni tablo boş, yeni rotalar 404.
- Vitrin metninde varsayılan etiket **"Ön ödeme"**; "kapora" sözcüğünün hukuki anlamı (Türk Borçlar Kanunu md. 177 bağlanma parası, md. 178 cayma parası: doğrulanmalı) hukukçuya sorulur. Etiket i18n anahtarıdır.

### 2. Ayarlar

**Ürün (`bookable.deposit`, yeni JSON sütunu; migration gerekir):**

| Alan | Anlam | Varsayılan |
|---|---|---|
| `mode` | `none`, `percent`, `per_unit` | `none` |
| `percent_bps` | Oran, baz puan (%25 = 2500); 500–9000 | 2500 |
| `amount_per_unit` | Kişi (yer) başı tutar, kuruş, yalnız TRY | boş |
| `balance_due_days` | Vade: kalkıştan kaç gün önce; 0–365 | 30 |
| `allow_full` | Müşteri tamamını da ödeyebilir | açık |

**Mağaza (`booking` ayar bölümü; mevcut "Rezervasyon akışı" kartı):**

| Alan | Anlam | Varsayılan |
|---|---|---|
| `balance_online_enabled` | Kalan tutar çevrim içi ödenebilir (K4 ile gelir) | açık |
| `balance_off_note` | Kapalıyken e-postada ve sipariş sayfasında çıkan not (500 karakter, tek satır) | "Kalan tutar için sizinle iletişime geçeceğiz." |
| `balance_auto_cancel` | Vadesi geçen rezervasyon ek süre sonunda kendiliğinden iptal | kapalı |
| `balance_grace_days` | Ek süre (1–14), yalnız üstteki açıkken görünür | 3 |

Panelde görünür olan yalnız "Kapora al" anahtarı ve oran; gerisi ikinci planda (hafıza: panel ayar dili). Hatırlatma günleri (vadeden 7 ve 1 gün önce) sabittir, ayar değildir.

### 3. Kapora ne zaman sunulur (sunucu kararı)

Sepet şu koşulların **hepsini** sağlarsa "ön ödeme" planı sunulur; aksi halde yalnız tam ödeme vardır:

1. Bayrak açık; sepetteki bütün satırlar **tek bir tarihli ürünün tek kalkışına** aittir (fiziksel ya da başka kalkış satırı yok).
2. Ürünün `deposit.mode ≠ none`.
3. Kalkışa kalan gün `balance_due_days`'ten büyük (ürünün saat diliminde takvim günü, `daysBefore`).
4. Sepette hediye kartı ya da mağaza kredisi kullanılmamış (kredili siparişte iade elle; adr/0076 Ek D7a O1).
5. Ödeme yolu kart (PayTR, iyzico). Havaleyle kapora ayrı dilim (K5).
6. Hesaplanan kapora toplamdan en az 1,00 TL küçük (değilse plan anlamsız).

Karışık sepet ve çok kalkışlı sepet ilk sürümde bilerek dışarıda: bakiyenin kalkışlara ve kalemlere bölüştürülmesi ayrı bir para riski doğurur ("Kapsam dışı").

### 4. Tutarın hesabı (yalnız sunucu)

- `total` = sepetin Medusa toplamı (KDV dahil, kupon ve otomatik promosyon düşülmüş), kuruş (`lib/money`).
- `percent`: `deposit = yarımYukarı(total × percent_bps / 10000)`. `per_unit`: `deposit = amount_per_unit × Σ(adet × pax)`.
- `balance = total − deposit`. Toplamı her zaman `total`'e eşittir; kuruş farkı oluşmaz.
- Taksitte vade farkı tutara dahil değildir: sağlayıcının `payment_amount`'u `deposit` ile karşılaştırılır (bugünkü kural).
- Bakiye sipariş anındaki tutardır; sonradan ürün fiyatı, kur ya da kampanya değişse de değişmez. Para birimi siparişinkidir, çevrim yapılmaz.

### 5. Sepet ve ödeme

- **Plan seçimi:** `POST /store/carts/:id/payment-plan` `{ plan: "deposit" | "full" }` (`.strict()`; tutar alanı 400). Sunucu §3'ü denetler, `cart.metadata.qt_pay_plan` yazar (`qt_` vitrinden yazılamaz). Yanıt sunucunun hesapladığı `{ deposit, balance, due_at }`.
- **Okuma:** ödeme sayfasının sepet okuması `payment_plan: { offered, chosen, deposit, balance, due_at }` döner; vitrin tutarı kendisi hesaplamaz.
- **Ödeme başlangıcı** (`start-cart-payment`, sepet kilidi altında): plan `deposit` ise §3 yeniden denetlenir (sağlanmıyorsa 409 `booking.deposit_unavailable`, vitrin tam ödemeye döner); **tahsil edilecek tutar** `amountDue(cart)` = `deposit`, koleksiyon ve oturum bu tutarla kurulur. Plan yoksa `amountDue = total` (bugünkü davranış).
- **Değişmez, genişletilmiş hali:** `paymentMismatch` koleksiyonu ve oturumu `total` ile değil `amountDue(cart)` ile karşılaştırır. `amountDue` tek saf fonksiyondur; `qt_pay_plan`'ı yalnız §3 koşulları sağlanıyorsa dikkate alır.
- **Tamamlama** (`complete-cart-validate`): §3 ve §4 yeniden hesaplanır; koleksiyon, oturum ve sağlayıcının çektiği tutar `deposit`'e eşit değilse reddedilir (`booking.price_changed` ailesi, 409).
- **Sipariş:** tam tutarla açılır; Medusa'da ödenmemiş fark siparişin açık tutarı olarak kalır. `order.placed` aboneliği, rezervasyon onayından sonra ve aynı kilit altında (`booking:order:<id>`) **bakiye kaydını** açar (yinelenebilir; `order_id` tekil).

> **Kodlamadan önce doğrulanacak (K0 kapısı):** Medusa 2.21.2'de (1) koleksiyon tutarı sepet toplamından küçükken sepet tamamlanıyor mu ve siparişin açık tutarı (`summary.pending_difference`) ile `payment_status` ne oluyor; (2) sepet her güncellendiğinde koleksiyon tutarı toplamdan yeniden yazılıyor, bizim yazdığımız tutar ödeme başlangıcı ile tamamlama arasında korunuyor mu; (3) `createOrderPaymentCollectionWorkflow` açık tutarın üstünü reddediyor mu. adr/0026 "Medusa ödenen tutarı sepet toplamıyla karşılaştırmıyor" diyor; bu kapı onu entegrasyon testiyle sabitler. Kapı geçmezse tasarım yeniden yazılır (bkz. Alternatifler).

### 6. Veri modeli: `booking_balance` (yeni tablo, `booking` modülü)

| Alan | Ne tutar |
|---|---|
| `order_id` (tekil), `booking_id` | Hangi sipariş ve rezervasyon |
| `currency_code`, `total`, `deposit`, `balance` | Kuruş; `CHECK (deposit > 0 AND balance > 0 AND deposit + balance = total)` |
| `due_at` | Vade (kalkış − `balance_due_days`, ürünün saat diliminde gün sonu) |
| `terms` | Satış anındaki koşulların kopyası (`{ mode, percent_bps, amount_per_unit, balance_due_days }`); sonradan ayar değişse de bu geçerli |
| `status` | `due`, `overdue`, `paid`, `cancelled` |
| `paid_at`, `paid_way` | `online`, `by_hand`; elle ise yol (`bank_transfer`, `pos`, `cash`, `other`) |
| `payment_collection_id` | Bakiyenin sipariş tahsilatı (ilk gerektiğinde açılır) |
| `token_hash`, `reminded` | Bağlantı token'ının SHA-256 özeti (K4); gönderilen hatırlatmalar |

Kişi verisi taşımaz. Üretilmiş yazıcılar serviste kapalıdır; durum yalnız adlandırılmış geçişlerle değişir (rezervasyon tablolarındaki desen).

### 7. Durum makinesi

```
(sipariş, kapora ödendi) → due ──vade geçti──→ overdue
        due | overdue ──bakiye alındı──→ paid
        due | overdue ──rezervasyon iptal──→ cancelled
        overdue ──ek süre doldu ve ayar açık──→ (rezervasyon iptali) → cancelled
```

- `paid` ve `cancelled` son durumdur; geri dönüş yoktur.
- Her geçiş `booking:balance:<order_id>` kilidi altında ve koşullu `UPDATE` ile (`WHERE status IN (...)`): sıfır satır = başkası değiştirmiş.
- Sipariş yaşam döngüsü (`lifecycleOf`): kaporalı sipariş bakiye kapanana kadar **"ön ödeme alındı, kalan bekleniyor"**; kapanınca bugünkü "planlandı".

### 8. Bakiyenin tahsili

**Basit yol (K1; her zaman var):** panelde sipariş sayfasında "Bakiye" kartı: kalan tutar, vade, durum, "Bakiyeyi aldım".

- `POST /admin/orders/:id/booking-balance/settle` `{ way, note? }`. Tutar gövdede yoktur. Yetki sahip ve yöneticinin (`money`), `requireUserActor`, denetim kaydı.
- İş akışı: kilit → kayıt `due | overdue` mi → sipariş tahsilatı (yoksa) `balance` tutarıyla açılır → `markPaymentCollectionAsPaid` (sipariş düzenlemedeki desen) → kayıt `paid` → olay `booking.balance_paid`. Dış servis çağrısı yok; telafi Medusa adımlarının kendi telafisi ve kaydın eski duruma dönmesi.

**Ödeme bağlantısı (K4; `balance_online_enabled` açıkken):**

- Bağlantı `<vitrin>/bakiye/<token>` (32 bayt rastgele, yalnız özeti saklanır; adr/0038 M10 ve adr/0051 deseni). Sayfa `noindex`, `Referrer-Policy: no-referrer`; mağaza, ürün, kalkış, toplam, ödenen, kalan ve vadeyi gösterir, kişi verisi göstermez. Giriş yapmış müşteri aynı sayfaya sipariş sayfasındaki "Kalanı öde" ile de ulaşır (sahiplik denetimi).
- Token sayfa açılınca kullanılmaz (e-posta tarayıcıları). "Öde" düğmesi `POST /store/booking-balances/pay` çağırır: hız sınırı (`balance` profili) → kara liste (adr/0044) → kilit → kayıt `due | overdue` ve rezervasyon canlı mı → sipariş tahsilatı (yoksa açılır; tutar kayıttan, siparişin açık tutarıyla kuruşu kuruşuna aynı olmalı) → sağlayıcı oturumu (barındırılan form; tutar oturuma sunucuda yazılır).
- **Onay yalnız sağlayıcı bildirimiyle** (adr/0026 §4–§5): `/hooks/paytr` ve iyzico geri çağrısı oturumun **siparişe** bağlı olduğunu görünce bakiye dalına girer: imza → `webhook-events` kaydı (tekil) → kilit → sağlayıcı yeniden sorgulanır, tutar ve para birimi oturumdaki beklenenle karşılaştırılır → ödeme alınır → kayıt `paid`.
- **Sahipsiz bakiye ödemesi:** bildirim geldiğinde kayıt `paid` ya da `cancelled` ise (iki sekmede iki ödeme, iptalle yarış) para sipariş açılamayan ödemedeki gibi kendiliğinden iade edilir ve panel uyarısına düşer (`payment-recovery`, yeni neden `balance_settled`).
- Bildirimi kaybolan ödeme için uzlaştırma işi (mevcut `paytr-reconcile`, `recover-iyzico`) bakiye oturumlarını da tarar.
- Sözleşme onayı yeniden istenmez (sözleşme siparişte kuruldu); taksit mağazanın mevcut taksit ayarına uyar.

### 9. Vade, hatırlatma, kendiliğinden iptal

- İş `booking-balance-due` (saatte bir; okuma `due_at` ve `status` dizininden).
- Vadeden 7 ve 1 gün önce `booking.balance_reminder` (bir kez; `reminded`). Vade geçince kayıt `overdue`, müşteriye `booking.balance_overdue`, mağazaya zil `booking.balance_overdue` (sipariş no, tutar).
- `balance_auto_cancel` açıksa `due_at + balance_grace_days` geçince rezervasyon mevcut iptal iş akışıyla (kademe kipi, aktör sistem) iptal edilir: iade §10'a göre, yer satışa döner, müşteriye `booking.cancelled` (neden: bakiye ödenmedi). Ayar istek anında okunur; kapatılınca bekleyen iptaller yapılmaz.
- İş gecikse de para kuralı bozulmaz: bağlantı `overdue` kayıtta da çalışır; iptal ile ödeme aynı kilidi alır.

### 10. İptal ve iade

- İptal planı (`workflows/booking/cancel-plan.ts`) kesintiyi bugünkü gibi **kalkışın satır toplamı** üzerinden hesaplar. Yeni olan: `iade = max(0, ödenen − kesinti)`; `tahsil edilmeyen kesinti = max(0, kesinti − ödenen)` yalnız panelde görünür, müşteriden istenmez (S5).
- Paket tur tabanı (adr/0076 K9) aynen: 30 gün ve öncesi iptalde kesinti %0, kapora tümüyle iade.
- Rezervasyon iptalinde bakiye kaydı aynı işlemde `cancelled` olur; açık tahsilat ve bekleyen oturum kapatılır.
- Mağazanın kalkışı iptal etmesi: ödenenin tamamı iade, bakiye `cancelled`.
- **İki ödemeli sipariş (kapora + bakiye):** iade önce en son alınan ödemeye, artan kısım öncekine gider; her ödemenin iadesi kendi referansıyla (`booking<use>p<n>`) bir kez. K4'e kadar bakiye elle alındığından iadenin bakiye payı da elledir (mevcut `manual: "offline"` ve zil); kapora payı karta döner.
- Müşterinin çevrim içi iptali kaporalı siparişte K1'de açık (tek ödeme); bakiyesi çevrim içi ödenmiş siparişte K4'teki bölüşüm yazılana dek "mağazayla iletişime geçin".

### 11. Bildirimler

| İleti | Ne zaman | İçerik |
|---|---|---|
| `booking.confirmed` (mevcut) | Sipariş | Yeni blok: ödenen, kalan, vade; bağlantı ya da mağazanın notu |
| `booking.balance_reminder` | Vadeden 7 ve 1 gün önce | Kalan, vade, "Kalanı öde" ya da not |
| `booking.balance_overdue` | Vade geçince | Aynı; ek süre varsa son gün |
| `booking.balance_paid` | Bakiye alınınca | Tamamı ödendi; voucher bağlantısı |

E-posta ve SMS işlemsel iletidir (müşterinin kendi siparişi), ticari değildir; İYS izni aranmaz (adr/0036 ayrımı). Personel zilleri: `booking.balance_overdue`, `booking.balance_paid` (çevrim içi), `booking.balance_refunded_orphan`.

Voucher kaporada verilir, üzerinde "kalan ödeme" satırı taşır; kod doğrulaması (`/admin/booking-vouchers/check`) bakiyesi açık rezervasyonda uyarı döner.

### 12. Panel, vitrin, tema sözleşmesi

- **Panel:** ürünün rezervasyon ayarında "Kapora" bloğu (§2); Ayarlar > İade sekmesindeki "Rezervasyon akışı" kartına iki anahtar; sipariş sayfasında "Bakiye" kartı ("Bakiyeyi aldım", "Bağlantıyı gönder", "Kopyala"); siparişler listesinde "Bakiyesi açık" süzgeci ve vade sütunu; kalkışın rezervasyon listesinde "kalan" sütunu. Vazgeç düğmeleri kırmızı.
- **Vitrin, ödeme adımı:** plan seçimi (iki seçenek, tutarlar sunucudan). Tema sözleşmesinde isteğe bağlı `CheckoutView.paymentPlan` ve `CheckoutActions.setPaymentPlan`; yetenek yoksa tema çizmez ve sepet tam ödenir. Mevcut biçim yeniden çizilmez (adr/0066).
- **Ürün sayfası:** fiyatın altında ikincil satır "2.500 TL ön ödemeyle yerinizi ayırın" (`BookingView.deposit?`). Asıl fiyat her zaman toplam fiyattır.
- **Sipariş sayfası:** `OrderPageView.balance?` (kalan, vade, durum, `payPath`).
- **Yeni sayfa:** `/bakiye/<token>` (K4).

### 13. Fatura, muhasebe, KVKK, SEO

- **Fatura:** kaporalı siparişte satış faturası, bakiye kaydı `paid` olana dek bekletilir (`order-hold` kuralına yeni neden `balance_open`); hizmet tarihi gelmiş ve bakiye hâlâ açıksa personele uyarı. Ayar `invoicing.deposit_invoice_at`: `paid_in_full` (varsayılan) ya da `placed`. Hangisinin doğru olduğu **doğrulanmalı** (mali müşavir; S6).
- **Muhasebe ve rapor:** satış raporu siparişi tam tutarla sayar; yeni sütunlar "tahsil edilen" ve "açık bakiye". Banka mutabakatı (`statement-checks`) siparişte iki ödeme görebilir. Muhasebe dışa aktarımında kapora "alınan avans" mı satış mı: mali müşavir.
- **KVKK:** yeni kişi verisi yok (kayıt sipariş kimliği ve tutar taşır; token özeti kişi verisi değildir). Kart saklanmaz. `docs/kvkk-envanter.md`'ye not düşülür.
- **SEO ve JSON-LD:** `Offer.price` toplam fiyat olarak kalır; kapora yapılandırılmış veriye girmez (arama sonucunda yanıltıcı düşük fiyat olmasın). Liste kartı ve "…'den itibaren" fiyatı değişmez. Bakiye sayfası dizine girmez. Fiyat gösteriminde toplam tutarın öne çıkması gereği (Fiyat Etiketi Yönetmeliği, Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği): doğrulanmalı.

## Para güvenliği ve kabul ölçütleri

Her madde bir test senaryosudur; ödeme dokunan dilim testsiz ve `security-reviewer` incelemesiz birleşmez (altın kural 8).

| # | Risk | Kural | Kabul testi |
|---|---|---|---|
| G1 | Tutarın istemciden gelmesi | Hiçbir uç tutar almaz; plan yalnız `deposit` ya da `full` | Gövdede tutar alanı 400; `qt_pay_plan` vitrinden yazılamaz |
| G2 | Kaporayla tam siparişi "ödenmiş" saymak | `amountDue` tek fonksiyon; başlangıçta ve tamamlamada yeniden hesap | Sepet plan seçildikten sonra değişirse (adet, kupon, fiziksel kalem) ödeme 409; eski oturumla gelen ödeme sahipsiz sayılıp iade edilir |
| G3 | Koşulsuz kapora | §3 her adımda sunucuda | Vadeye 30 günden az kalan kalkışta, karışık sepette, kredili sepette plan reddedilir |
| G4 | Bakiyenin iki kez ödenmesi | Kilit + koşullu `UPDATE` + `order_id` tekil + sahipsiz iade | İki sekmede eşzamanlı iki ödeme: biri `paid`, diğeri kendiliğinden iade; "Bakiyeyi aldım" ile çevrim içi ödeme yarışı: biri kazanır, diğeri iade ya da 409 |
| G5 | Yinelenen bildirim | `webhook-events` tekil kaydı | Aynı bildirim üç kez: tek ödeme, tek geçiş |
| G6 | Sahte ya da başkasının bildirimi | Sabit zamanlı imza; sağlayıcı yeniden sorgulanır; tutar ve para birimi karşılaştırılır | İmzası bozuk, tutarı farklı, başka oturuma ait bildirim: ödeme oluşmaz |
| G7 | İptal ile ödeme yarışı | Aynı kilit; iptal sonrası gelen para sahipsiz | Kendiliğinden iptal anında gelen ödeme iade edilir, yer geri verilir |
| G8 | Fazla iade | İade tavanı ödemenin kalanı; ödeme başına referans | Kapora + bakiye ödenmiş siparişte tam iade iki ödemeye doğru bölünür; yeniden deneme ikinci kez göndermez |
| G9 | Kuruş kaybı | `lib/money`, yarım yukarı; `deposit + balance = total` | 9.999,99 TL'nin %33'ü: iki parça toplamı tam; tablo `CHECK`'i |
| G10 | Kur | Bakiye siparişin para biriminde, sipariş anındaki tutar | Fiyat değişse de bakiye değişmez; sabit tutarlı kapora TRY dışı sepette sunulmaz |
| G11 | Bağlantının tahmini ya da sızması | 32 bayt token, özet saklanır, tek tip 404, hız sınırı | Bilinmeyen, ödenmiş ve iptal bağlantı aynı yanıtı alır; sayfa kişi verisi göstermez |
| G12 | Bayrak kapalıyken yan etki | Kapalıyken bütün yol kapalı | Bayrak kapalı mağazada mevcut ödeme testleri değişmeden geçer; `amountDue = total` |
| G13 | Taksit vade farkı | Karşılaştırma `payment_amount` ile | Taksitli kapora: sipariş açılır, vade farkı bakiyeyi değiştirmez |

## Dilimler

| # | Dilim | Büyüklük | Bağımlılık | Not |
|---|---|---|---|---|
| K0 | Doğrulama kapısı: Medusa'da "tam tutarlı sipariş, kısmi tahsilat" (§5 kutusu) | S | yok | Yalnız entegrasyon testi; sonucu bu ADR'ye ek olarak yazılır |
| K1 | **Basit yol:** bayrak, `bookable.deposit`, `booking_balance`, plan seçimi, `amountDue`, tamamlama denetimi, panelde "Bakiyeyi aldım", iptal hesabı (§10), onay e-postasında kalan ve not | L | K0 | Ödeme ve migration: güvenlik incelemesi. Tek başına satılabilir: "kapora + kalan için sizinle iletişime geçeceğiz" |
| K2 | Panel ayar blokları, vitrin plan seçimi ve sipariş sayfası, ürün sayfası satırı | M | K1 | Görünüm kilidi testi hakem |
| K3 | Vade işi, hatırlatmalar, `overdue`, zil, "Bakiyesi açık" süzgeci | M | K1 | |
| K4 | **Ödeme bağlantısı:** token, `/bakiye` sayfası, siparişe bağlı oturum, bildirim dalı, sahipsiz iade, uzlaştırma, iki ödemeli iade | L | K1, K3 | En riskli dilim; güvenlik incelemesi, sahte sağlayıcı senaryoları |
| K5 | Kendiliğinden iptal ayarı | S | K3 | |
| K6 | Havaleyle kapora | S | K1 | Havale onayı `deposit` tutarıyla |
| K7 | Fatura tetiği ve bekletme, rapor sütunları | M | K1; mali müşavir cevabı | |

Not: K2'yi K1'le tek PR yapmak CI turundan tasarruf ettirir; ayrım yalnız inceleme kolaylığı içindir.

**Üç ADR arasındaki sıra önerisi:** 0082 K0–K3 → 0083 (O0–O3) → 0082 K4–K7 → 0084. Gerekçe: kapora ilk müşterinin satışını doğrudan etkiler ve basit yolu küçüktür; oda dağılımı kaporadan bağımsızdır (yalnız satır fiyatını değiştirir, kapora toplamdan hesaplanır); tarih aralığı kipinin bugün müşterisi yok; en büyük iş odur ve kaporanın siparişe bağlı ödeme yolundan (K4) yararlanabilir.

## Kapsam dışı

- Kayıtlı karttan müşteri yokken çekim ve ön provizyon (S2 C).
- Karışık sepette ve çok kalkışlı sepette kapora; hediye kartı ya da mağaza kredisiyle kapora.
- Bakiyenin birden çok vadeye bölünmesi (ödeme planı), bakiyenin parça parça ödenmesi.
- Fiziksel üründe kapora (ön sipariş kaporası): aynı altyapı sonra genişletilebilir, bu ADR tarihli ürünü kapsar.
- Kiralamada hasar teminatı (adr/0084): farklı bir para akışıdır (geri verilmek üzere alınır).
- Kaporaya özel sözleşme metni ve PDF (adr/0076 "Sonraya": ön bilgilendirme ve sözleşme PDF'i).

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Tam tutarlı sipariş + kısmi tahsilat + siparişe bağlı bakiye (seçilen)** | Tek sipariş, tek fatura; Medusa'nın sipariş tahsilatı modeli; sipariş düzenlemedeki emsal | `paymentMismatch` genişler; çevrim içi bakiye için ikinci bir ödeme girişi yazılır |
| Bakiye için ikinci sipariş (ödeme bağlantısı sepetiyle) | Mevcut ödeme yığını hiç değişmez | İki sipariş, iki fatura; rapor, kontenjan, iade ve voucher "gerçek olmayan sipariş" istisnalarıyla dolar |
| Bakiyeyi sepette kredi ya da eksi satır olarak göstermek | Sepet toplamı kaporaya iner, değişmez korunur | Sipariş toplamı yanlış olur; fatura, KDV ve iade matematiği bozulur |
| Kapora siparişte ön provizyon, bakiye sonradan çekim | Tek kart işlemi | Provizyon günlerle sınırlıdır (PayTR: kapama 7–25 gün), tur aylar sonradır; kart saklama gerekir |
| Sağlayıcının kendi bağlantısı (PayTR Link, iyzico Link) | Kod yok | Ödeme siparişe, bakiyeye ve iadeye bağlanmaz; elle mutabakat (adr/0051'de de reddedildi) |

## Sonuçlar

- Mağaza büyük tutarlı tarihli ürünü ön ödemeyle satabilir; küçük mağaza hiçbir yeni ekran öğrenmeden basit yolu kullanır.
- Ödeme kodunda iki hassas değişiklik gelir: tahsil edilecek tutar kavramı (K1) ve siparişe bağlı ödeme oturumu (K4). İkisi de ayrı güvenlik incelemesinden geçer.
- "Ödenmiş sipariş" artık iki anlam taşır (kapora alınmış, tamamı alınmış); yaşam döngüsü, fatura bekletmesi, raporlar ve iade bunu ayırmak zorundadır.
- Yeni bir zamanlanmış iş ve dört ileti gelir.

## Açık kalanlar

**Hukukçuya:**

- Vitrin etiketi "kapora" mı "ön ödeme" mi; TBK md. 177–178 kapsamında hangi sonucu doğurur.
- Paket turda (6502 sayılı Kanun md. 51; Paket Tur Sözleşmeleri Yönetmeliği md. 5/2, md. 6, md. 16) ön ödeme oranına ya da zamanına sınır var mı; 30 günden önce fesihte kaporanın tamamı iade edilmek zorunda mı (md. 16/2: zorunlu vergi ve harçlar dışında); bakiyenin vadesi 30 günden uzak seçilirse (ör. 45 gün) kesintisiz fesih döneminde alınmış bakiyenin iadesi.
- Paket tur dışındaki tarihli hizmette (etkinlik, kurs, konaklama) "iade edilmez ön ödeme" koşulu haksız şart sayılır mı (6502 md. 5; Mesafeli Sözleşmeler Yönetmeliği md. 15'teki cayma istisnası yalnız caymayı kapsar).
- Bakiyesi ödenmediği için rezervasyonun kendiliğinden iptali için sözleşmede hangi ihtar ve süre yazmalı.
- Hatırlatma SMS'i işlemsel ileti sayılır mı (İYS).

**Mali müşavire:**

- Kapora alındığında fatura zorunlu mu, KDV ne zaman doğar (KDV Kanunu md. 10; VUK md. 231/5'teki yedi gün hizmetin ifasından mı sayılır).
- İade edilmeyen kaporanın (kesinti) belgesi: fatura mı, tazminat mı; KDV'si.
- Muhasebe dışa aktarımında kaporanın hesabı (alınan avanslar).

**Sağlayıcılara (PayTR, iyzico):**

- Aynı sipariş için iki ayrı tahsilat (iki `merchant_oid` / `conversationId`) mutabakat ve iade açısından sorun yaratır mı.
- Tur gibi ileri tarihli hizmette ters ibraz süresi ve hesaptaki bloke (ödemenin mağazaya geçiş günü) kuralları.
- Kart saklama ve müşteri yokken çekim için aranan sözleşme koşulları (yalnız bilgi; kapsam dışı).

**Sahibe (S1–S6 dışında):**

- Voucher kaporada mı verilsin (öneri: evet, "kalan ödeme" satırıyla), yoksa tamamı ödenince mi.
- Kaporalı satışta taksit açık kalsın mı (öneri: mağazanın genel taksit ayarı geçerli).
