# ADR-0044: Dolandırıcılık koruması (fraud-guard)

- **Durum:** Önerildi (2026-10-31, F15.6; kullanıcının "önerileni uygula" kuralıyla otonom kabul, PROGRESS "Gözden geçir"de)
- **Tarih:** 2026-10-31
- **İlgili:** docs/04 (dolandırıcılık, SMS pumping); ADR-0036 §8 (SMS kotası, `challenge` işareti); ADR-0037 M9 (ödemede IP sayacı); ADR-0026 (barındırılan ödeme formu); ADR-0040 (roller)

## Bağlam

F15.6 dört şey ister:

- giriş, kayıt ve ödemede bot doğrulaması (captcha);
- kart, IP ve e-posta için hız (velocity) kuralları;
- şüpheli sipariş işareti ve panelde inceleme kuyruğu;
- kara liste.

KK: "Velocity kuralını aşan checkout engelleniyor veya incelemeye düşüyor (testli)."

Kısıtlar:

- **Dış servis yok.** reCAPTCHA, hCaptcha ve Turnstile ziyaretçi verisini yurt dışına taşır; KVKK açık rıza ve yurt dışı aktarım sorunu doğurur. F15 planı dış servisi kullanıcı onayına bağlar.
- **Kart verisi bizde yok.** Ödeme formu sağlayıcıda (SAQ-A). Kartın parmak izi en erken ödemeden sonra sağlayıcı yanıtında gelir.
- **Ziyaretçinin IP'si saklanmaz.** Yalnızca `PII_HASH_KEY` ile anahtarlanmış kova kullanılır (`clientBucket`, ADR-0037 M9).
- Mevcut parçalar:
  - `smsAllowance` aşırı istekte `challenge: true` döndürüyor ama soracak bir doğrulama yok;
  - `/store/carts/:id/complete` üzerinde IP sayan bir ara katman var (`checkout-sms.ts`);
  - `completeCartWorkflow.hooks.validate` ödeme kurallarının yeri.

## Karar

`fraud-guard` adında bir modül ve onun yanında ince ara katmanlar kurulur. Dört parçası var.

### 1. İş kanıtı doğrulaması (kendi barındırdığımız captcha)

Görsel bulmaca yok. Tarayıcı küçük bir hesap yapar; insan fark etmez, toplu istek yapan bot için pahalıdır (ALTCHA ve Friendly Captcha'nın yöntemi). Kod: `lib/security/challenge`, `api/http/challenge.ts`.

- **Uyarlanır:** Doğrulama her istekte istenmez. Kapsamın sayacı eşiği aşınca uç 428 `fraud.challenge_required` döner. Gövdede bir meydan okuma vardır: `{ token, salt, bits, expires_at }`. Ayrı bir "meydan okuma al" ucu yok.
  - `token`, sunucunun anahtarlı özetiyle (`PII_HASH_KEY`) imzalı durumsuz bir kayıttır: kapsam, tuz, zorluk, bitiş. Veritabanına yazılmaz. Ömrü 5 dakika.
- **Çözüm:** İstemci `SHA-256(salt + nonce)` değerinin ilk `bits` biti sıfır olan `nonce`'u bulur. Aynı istek `X-Challenge: <token>.<nonce>` başlığıyla tekrarlanır.
- **Doğrulama:** İmza, kapsam, süre ve özet kontrol edilir. Çözüm tek kullanımlıktır: tuzu, paylaşılan sayaç deposunda süresi bitene kadar tutulur.
- **Kapsamlar ve eşikler:**

| Kapsam | Uç | Eşik |
|---|---|---|
| `register` | `POST /auth/customer/emailpass/register` | IP başına saatte 3 kayıt |
| `login` | `POST /auth/customer/emailpass` | Aynı e-postaya (her yerden) 15 dakikada 5'ten fazla deneme; her deneme çalışmadan önce sayılır (aynı anda gönderilenler eşiği atlayamaz); yalnızca doğrulama ister, kilitlemez |
| `order_lookup` | `POST /store/order-lookup` | IP başına saatte 5 |
| `stock_alert` | `POST /store/stock-alerts` | IP başına saatte 5 |
| `checkout` | `POST /store/carts/:id/payment-session` | §2'deki hız kuralları |

- Zorluk 18 bit: ortalama ~260 bin özet, telefonda 1 saniyenin altında. Sayaç eşiğin iki katını aşınca 20 bit.
- Sert sınırlar hız sınırlayıcınındır (`RATE_LIMIT_PROFILES`). Doğrulama ondan önce gelir.
- IP başına eşikler entegrasyon testlerinde hız sınırları gibi büyür (`perIpScale`). `fraud-guard.spec` gerçek değerlerle sınar.
- Yorum ve soru doğrulanmış hesap ister, hız sınırına tabidir; doğrulama istenmez. Personel girişi 2FA ve kilitle korunur; panelde çözücü olmadığı için doğrulama istenmez. ADR-0036 §8'deki SMS `challenge` işareti, vitrinin ilk SMS ucu (F18) yazılınca bu düzene bağlanır.
- Erişilebilirlik: kullanıcıdan hiçbir şey istenmez, ekran okuyucuyla sorun yok.

### 2. Hız kuralları (ödeme)

Sayım ödemenin başladığı yerde yapılır: `POST /store/carts/:id/payment-session` (`api/http/checkout-guard.ts`). Her ödeme yolu buradan geçer. Kartla ödemede sipariş sağlayıcının bildirimiyle açılır, `/complete` hiç çağrılmaz (güvenlik incelemesi 2026-10-31, yüksek bulgu). Sayaçlar paylaşılan hız sınırı deposundadır; IP kovası, e-postanın ve telefonun anahtarlı özetiyle tutulur.

| Anahtar | Doğrulama ister | Engeller |
|---|---|---|
| IP kovası başına ödeme başlatma / saat | 5'ten sonra | 30'dan sonra |
| E-posta başına ödeme başlatma / saat | 3'ten sonra | Engellemez |
| IP kovası başına farklı e-posta / gün | 3'ten sonra | 30'dan sonra |

- **Bir IP binlerce kişinin olabilir.** Mobil operatörler çok sayıda müşteriyi tek adresin arkasına koyar (CGNAT). Bu yüzden IP sınırlarında engel uzak tutulur, doğrulama yakın.
- **E-posta herkesin yazabileceği bir değerdir.** Misafir sepetine başkasının adresini yazan, o kişiyi ödemeden kilitleyemesin diye e-posta sınırı yalnızca doğrulama ister.
- Engelleme 429 `fraud.velocity`, doğrulama 428 döner. Metinler geneldir.
- Sayılanlar (adresin ve telefonun kullandığı farklı e-posta sayısı, yalnızca sayı) sepete `qt_fraud_signals` olarak yazılır. `qt_` önekli üst veri alışverişçiye kapalıdır. Siparişin puanı bunları okur.
- `/complete` yeniden saymaz, yalnızca kara listeye bakar.
- Değerler kodda sabittir. Mağazaya açılması gerekirse ayarlara taşınır. Entegrasyon testlerinde hız sınırları gibi büyür (`perIpScale`).
- Sayım ya da not başarısız olursa ödeme geçer ve loglanır: sağlayıcının kendi denetimleri sürer, sipariş kara listeye bir kez daha bakılarak açılır.

### 3. Şüpheli sipariş işareti ve inceleme kuyruğu

`order.placed` sonrasında `fraud-review-order` workflow'u siparişi puanlar (`lib/fraud/score.ts`):

| Kural | Puan |
|---|---|
| Müşterinin ilk siparişi ve tutar mağaza eşiğinin üstünde (varsayılan 5.000 TL) | 30 |
| Teslimat ve fatura ili farklı, ikisi de dolu | 10 |
| Aynı IP kovasından bugün ≥ 5 farklı e-postayla ödeme denemesi | 20 |
| Aynı telefon bu hafta ≥ 3 farklı e-postayla | 25 |
| Tek kullanımlık e-posta alan adı (yerel liste) | 20 |
| Ödemede ≥ 3 başarısız deneme | 20 |

- Puan eşiğe ulaşırsa (varsayılan 50) `fraud_review` kaydı açılır (`pending`; nedenler kural adı ve puan olarak, kişisel veri yok). Zil çalar (`fraud_review`).
- Eşik ve tutar Ayarlar > Güvenlik'tedir (`security` bölümü: `fraud_review_score`, `fraud_high_amount`; yalnızca sahip değiştirir).
- **İnceleme bekleyen ya da reddedilen sipariş kargoya verilemez.** Bu kural "Kargoya ver" workflow'unda (tekli ve toplu) ve Medusa'nın kendi gönderim ucunda (`/admin/orders/:id/fulfillments`) uygulanır: `fraud.review_pending` / `fraud.review_rejected`.
- Panel: Siparişler > İnceleme. Sahip ve yönetici (`fraud` yetkisi) onaylar ya da reddeder. Operasyon ve salt okunur kuyruğu görür.
  - Onaylamak kargoyu açar.
  - Reddetmek siparişi kalıcı olarak kargoya kapatır. İptal ve iade sipariş sayfasındaki olağan iptalle yapılır; para akışı tek yerde kalır (iptal, iadeyi Medusa'nın iptalinden önce kendi akışımızla yapar: `refundBeforeCancel`).
  - Aynı anda iki karar verilirse biri kazanır (koşullu güncelleme), diğeri 409 `fraud.review_decided` alır.
- Karar, admin yazma uçlarının olağan denetim kaydına girer.

### 4. Kara liste

`fraud_block`: tür (`email`, `email_domain`, `phone`, `ip`), eşleşme değeri, görünen değer, neden, ekleyen, isteğe bağlı bitiş tarihi.

- Değer ve istek aynı yazıma getirilir (`lib/fraud/block.ts`):
  - e-posta `+etiket`siz, anahtarlı özetle;
  - alan adı küçük harfle, alt alan adlarını da kapsar;
  - telefon E.164 (Türkiye biçimleri ve yurt dışı `+` ile), anahtarlı özetle; teslimat ve fatura telefonunun ikisi de bakılır;
  - IP, hız sınırlarının saydığı gibi: IPv4'e eşlenmiş IPv6 IPv4 olarak, IPv6 /64 olarak (bir bağlantı bütün /64'ü tutar).
- E-posta ve telefonun ham değeri saklanmaz, panelde maskeli gösterilir.
- IP kişisel veridir: kayıt en çok 1 yıl geçerlidir. Süresi geçen her kayıt gece kalıcı silinir (`fraud-retention`).
- Nerede durdurur:
  - Kayıt, hesap oluşturma (`POST /store/customers`) ve ödeme başlatma: 403, nedeni söylemeyen metin.
  - Giriş: yanlış şifreyle aynı yanıt. Liste kimin üzerinde olduğunu söylemez.
  - Sipariş: `completeCartWorkflow` doğrulama kancası e-posta ve telefonlara bir kez daha bakar. Kartla ödenmiş sepet de böylece siparişe dönmez, parası iade akışıyla geri gider (`fraud.*` "tekrar denense de başarısız" sayılır).
- Panel: Ayarlar > Güvenlik > Kara liste, türüne göre gruplu. Liste yalnızca sahip ve yöneticiye açıktır (`/admin/fraud/blocks*` özel). İnceleme kuyruğunun okunması hassas okuma olarak denetim kaydına girer.

### Güvenlik incelemesi (2026-10-31)

Bağımsız inceleme 2 yüksek, 2 orta ve birkaç düşük bulgu çıkardı. Kapananlar:

- **Yüksek: kartla ödeme korumayı atlıyordu.** Sayım ödeme başlatmaya taşındı, siparişte kancayla yeniden bakılıyor.
- **Yüksek: `Bearer <token> x` biçimindeki başlık şifre değişikliği denetimini atlıyordu** (ADR-0037 ek 2). Başlık Medusa gibi okunuyor; okunamayan bearer token reddediliyor.
- **Orta: aynı anda gönderilen girişler doğrulama eşiğini atlıyordu.** Her deneme çalışmadan önce sayılıyor.
- **Orta: başkasının e-postasıyla ödeme kilitlenebiliyordu.** E-posta sınırı artık engellemiyor.
- **Düşükler:**
  - IP, `+etiket`, alt alan adı ve telefon eşleşmesi;
  - girişte listede olmanın sızması;
  - hesap oluşturmada denetim;
  - Medusa'nın `/admin/fulfillments` ucunda inceleme bekleyen sipariş;
  - `qt_` öneki;
  - kuyruğun hassas okuma kaydı;
  - bilinmeyen iş türünün yalnızca sahibe görünmesi.

Kalanlar (gözden geçir):

- Şifre değişmeden önce açılmış bir oturum çerezi `POST /store/customers`'a ulaşabilir (oturumda `iat` yok).
- Sipariş, puanlanmadan önceki birkaç saniyede kargoya verilebilir.
- Google ile girişte kara listeye bakılmaz (hesap oluşturmada bakılır).
- Bir başkası birinin telefonunu üç e-postayla kullanarak o kişinin bir sonraki siparişine 25 puan ekleyebilir. Bu siparişi tek başına incelemeye düşürmez.
- İş kanıtı bir hız kesicidir; yerel kodla çözen bot için ucuzdur.

## Alternatifler

| Seçenek                          | Artı                                     | Eksi                                                                                           |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| reCAPTCHA / hCaptcha / Turnstile | Olgun, bot puanı                         | Yurt dışına veri; KVKK açık rıza; dış servis onayı; erişilebilirlik sorunları (görsel bulmaca) |
| Görsel captcha (kendi)           | Dış servis yok                           | Erişilebilirlik; OCR botları kolayca geçer                                                     |
| Her istekte iş kanıtı            | Basit                                    | Gereksiz bekleme; düşük güçlü cihazda pil                                                      |
| Kart parmak izi hızı             | Kart dolandırıcılığına en doğrudan önlem | Kart verisi bizde değil; sağlayıcının kendi 3D Secure ve risk kuralları bu katmanda            |
| Makine öğrenmesiyle puan         | Daha isabetli                            | Veri yok; açıklanamaz karar; mağaza başına küçük hacim                                         |

## Sonuçlar

- Vitrin (F18): `X-Challenge` akışı ve küçük bir çözücü (Web Worker'da SHA-256) yazılır. Sözleşme `packages/types`'ta.
- Panel: Ayarlar > Güvenlik (inceleme eşikleri, kara liste), Siparişler > İnceleme. Sipariş sayfasında inceleme işareti ve "kara listeye ekle" kısayolu sonraya.
- KVKK envanteri: `fraud_review` nedenleri kişisel veri içermez (kural adları ve sayılar); silme talebinde personel notu temizlenir. `fraud_block` silme talebinde hukuki yarar gereği kalır (ham değer zaten yok); süresi dolunca silinir.
- Sonraya: sağlayıcının ödeme sonrası kart parmak izi ve BIN ülkesiyle kural; 3D Secure sonucu (`liability shift`) puana katılır.
