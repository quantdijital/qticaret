# ADR-0036: Bildirim altyapısı: e-posta, SMS ve ileti izni

- **Durum:** Önerildi (2026-10-28; kullanıcının "önerileni uygula" kuralıyla otonom kabul edilir, PROGRESS "Gözden geçir"de)
- **Tarih:** 2026-10-28
- **İlgili:** F9, docs/entegrasyonlar/sms.md, ADR-0027 (hesaplar panelden), ADR-0020 (panel zili), ADR-0026 §5 (gelen bildirim kaydı), docs/04 (hız sınırı)

## Bağlam

F9 müşteriye ve mağazaya giden iletileri kuruyor: işlemsel e-posta ve SMS, mağaza içi uyarılar, ticari iletinin izne bağlanması, geri dönen e-postaların bastırılması ve SMS kötüye kullanımına karşı kota. Kısıtlar:

- **Medusa'nın Notification modülü** kanal başına bir sağlayıcı kullanır. Panelin zili bugün `feed` kanalında Medusa'nın yerel sağlayıcısıyla çalışıyor (ADR-0020); bu kanal yerinde kalmalı.
- **E-posta:**
  - Geliştirmede Mailpit var (compose, 2026-10-25).
  - Canlıda gönderim Resend üzerinden. Resend'in REST API'si: `POST https://api.resend.com/emails` (Bearer anahtar, `Idempotency-Key` 24 saat). Durum bildirimleri web kancasıyla gelir: `email.bounced`, `email.complained`, `email.delivered` vb. Kancalar Svix ile imzalanır: `${id}.${timestamp}.${body}` üzerinde HMAC-SHA256, `whsec_` sonrası base64 anahtar.
  - Mailpit'in de HTTP gönderim ucu var (`POST /api/v1/send`, v1.31.4 kaynağından doğrulandı). Bu yüzden SMTP kütüphanesine gerek yok.
- **SMS:**
  - Türkiye'de gönderici başlığı (msgheader) firmaya kayıtlıdır. Bu yüzden SMS hesabı mağazanın kendisidir.
  - Netgsm'in resmî SDK kaynağından doğrulananlar:
    - Gönderim ucu `POST https://api.netgsm.com.tr/sms/send/xml`. Gövde: `usercode`, `password`, `msgheader`, `encoding=TR`.
    - `filter` alanı İYS filtresidir: 0 bilgilendirme, 11 bireysel ticari, 12 tacir ticari.
    - Yanıt `00 <görev no>` ya da hata kodu (20, 30, 40, 50, 51, 70, 80, 85).
    - Başlık sorgusu `POST /sms/header` (JSON) giriş bilgilerini ve başlığı doğrular.
- **Ticari ileti:** 6563 sayılı Kanun ve İYS gereği alıcının izni olmadan gönderilemez. İşlemsel ileti (sipariş, kargo, şifre) izin gerektirmez. `legal-consent` modülü F13'te sözleşme onaylarıyla gelecek; ama F9'un kabul kriteri ("izni olmayana ticari SMS gitmez") bir izin kaydını şimdiden istiyor.
- **Bağımlılık:** Yeni npm bağımlılığı kullanıcı onayı ister. React Email ve MJML yeni bağımlılık.
- **Medusa 2.21.2'den doğrulananlar** (v2.21.2 etiketindeki kaynak):
  - Sağlayıcı `AbstractNotificationProviderService` sınıfından türer ve yalnızca `send` metodunu yazar. `send` bildirim kaydının tamamını alır: `to`, `channel`, `template`, `data`, `content {subject, text, html}`, `from`, `provider_data`. Dönüşü `{ id }` olur.
  - Modül yapılandırılınca Medusa'nın varsayılanı (yalnızca `feed` kanalında yerel sağlayıcı) tamamen gider. Yerel sağlayıcı yeniden eklenmelidir. Bir kanala ikinci sağlayıcı eklenirse modül açılmaz.
  - `createNotifications` iletiyi eşzamanlı gönderir.
    - `idempotency_key` tekildir. Bekleyen ya da başarılı bir anahtar sessizce atlanır; başarısız bir anahtar yeniden denenir.
    - Sağlayıcı hata verirse kayıt FAILURE olur ve hata yukarı fırlatılır.
    - Medusa kendisi yeniden denemez.
    - `content` veritabanına yazılmaz, yalnızca sağlayıcıya gider.
  - Olaylar:
    - `order.placed`, `order.canceled`, `shipment.created`, `delivery.created`;
    - `order.return_requested`, `order.exchange_created`;
    - `auth.password_reset` (`entity_id`, `actor_type`, `token`, 15 dakika);
    - `auth.verification_requested` (2.15.5'ten beri; `http.authVerificationsPerActor` ile açılır; F10.1 kullanır).
  - Ödeme başarısızlığı için Medusa olayı yok; kendi olayımız gerekir.

## Karar

1. **Kanallar ve sağlayıcılar.** Medusa'nın Notification modülünde üç kanal:
   - `feed`: Medusa'nın yerel sağlayıcısı (panel zili). Modül yapılandırmasına açıkça yeniden yazılır. Yerel sağlayıcı `data`'yı loglar; bu yüzden yalnızca zil metni taşır, e-posta asla bu kanaldan gitmez.
   - `email`: kendi sağlayıcımız `notification-email` (`email_email`). İçinde iki gönderici var:
     - Resend (canlı): REST, kendi HTTP istemcimizle.
     - Mailpit (geliştirme ve test): HTTP gönderim ucu.

     Hangisi kullanılacağı ortam değişkeninden okunur (`EMAIL_TRANSPORT=resend|mailpit`). Staging ve production'da Mailpit reddedilir.
   - `sms`: kendi sağlayıcımız `notification-sms` (`sms_netgsm`), Netgsm XML ucu. Kodu, sağlayıcı arayüzü başka bir SMS firmasına açık tutar.
2. **Hesaplar.**
   - **E-posta gönderim hesabı platformun.** Resend anahtarı ortam değişkeninden okunur ve her mağaza örneğine kurulumda verilir. Mağaza kendi alan adını doğrular.
     - Alan adı doğrulanana kadar iletiler platformun gönderim alan adından çıkar. Görünen ad mağazanın adıdır, yanıt adresi (`Reply-To`) mağazanın iletişim e-postasıdır.
     - Canlıda anahtarın yalnızca o mağazanın alan adına gönderim yetkisi olmalı (Resend alan adına bağlı anahtar). Bunu F16/F17 kurulumu verir.
   - **SMS hesabı mağazanın.** Panelden girilir (`integration-credentials` `netgsm`, ADR-0027):
     - kullanıcı kodu ve şifre gizli tutulur;
     - gönderici başlığı açık tutulur;
     - kaydederken başlık sorgusuyla doğrulanır.
3. **Şablonlar bizde, bağımlılıksız.**
   - E-posta şablonları TypeScript fonksiyonlarıdır. Tablo tabanlı, satır içi stilli HTML üretirler ve her değer kaçışlıdır. Her şablonun düz metin eşi vardır.
   - Ortak bir yerleşim kullanılır: mağaza logosu ve marka rengi `platform-settings` `appearance`'tan, mağaza adı ve iletişim bilgisi `store`'dan gelir.
   - Metinler bir katalogdan gelir (`lib/notifications`). Şimdilik tek dil TR; EN F19'da.
   - SMS metinleri kısa tutulur: hedef 160 karakter, Türkçe karakter kodlamasının maliyeti hesaba katılır.
   - Panel her şablonu örnek veriyle önizler.
   - React Email/MJML bu karar gözden geçirilirse eklenebilir.
4. **Gönderim tek yoldan geçer** (`sendMessage` iş akışı adımı). Sıra şöyle:
   1. Şablon seçilir; şablon türünü (işlemsel ya da ticari) kendisi söyler.
   2. Alıcı ve kanal belirlenir.
   3. Bastırma listesi kontrol edilir.
   4. İleti ticariyse izin kontrol edilir.
   5. SMS'te kota kontrol edilir.
   6. Şablon işlenir.
   7. Medusa `createNotifications` ile gönderilir: `idempotency_key` = `şablon:kaynak:kanal`. Aynı olay iki kez gelirse ileti bir kez gider.

   Gönderilmeyen her ileti nedeniyle loglanır (izin yok, bastırılmış, kota). Hiçbir log ileti içeriği ya da tam adres taşımaz; adresler maskelenir.

   İşlenmiş içerik `content` ile sağlayıcıya gider ve veritabanına yazılmaz. `data` yalnızca kimlik taşır (sipariş numarası gibi).

   Sağlayıcı hata verirse kayıt FAILURE kalır ve bir iş, aynı anahtarla sınırlı sayıda yeniden dener. Medusa'nın başarısız kaydı yeniden denemesi testle doğrulanır.
5. **İleti izni bizde** (yeni `messaging` modülü, İYS'nin karşılığı).
   - Kayıt alıcı (müşteri, e-posta ya da telefon) ve kanal (e-posta, SMS, arama) başınadır. Kayıtta durum (onay ya da ret), kaynak, zaman ve İYS'ye iletilme durumu tutulur.
   - Ticari ileti yalnızca onay kaydı varsa gider. Ticari SMS ayrıca Netgsm'e `filter=11` ile gider; Netgsm İYS'yi ikinci kez kontrol eder.
   - İzni İYS'ye iletmek (Netgsm İYS API'si, marka kodu) ve müşterinin izni vitrinde vermesi F10'a kalır. F9 izin kaydını, panelden görme ve düzeltmeyi ve gönderim kontrolünü kurar.
   - docs/01'deki `legal-consent` satırının "İYS izinleri" kısmı `messaging`'e geçer. `legal-consent` F13'te sözleşme onaylarıyla gelir.
6. **Geri dönen ve şikâyet edilen adresler.**
   - Resend kancası `/hooks/resend` adresine gelir. Svix imzası doğrulanır ve 5 dakikalık zaman toleransı uygulanır. Olay `webhook-events` ile bir kez işlenir.
   - Kalıcı geri dönüş (`email.bounced`) ve spam şikâyeti (`email.complained`) adresi bastırma listesine yazar. Listedeki adrese bir daha gönderim yapılmaz.
   - Panelden liste görülür ve bir adres listeden çıkarılabilir; çıkarma denetim kaydına yazılır.
   - Mağazanın alan adı Resend'in alan adı API'siyle eklenir. SPF, DKIM ve DMARC kayıtları panelde gösterilir ve "Doğrula" düğmesiyle kontrol edilir.
7. **Mağaza içi uyarılar.**
   - Uyarılar: yeni sipariş, onay bekleyen havale, düşük stok, haftalık SEO özeti ve başarısız fatura (fatura F8'le gelir).
   - Her uyarı zile (`feed`) ve isteğe bağlı olarak yöneticilerin e-postasına gider. Alıcılar ve açık olan uyarılar yeni bir `notifications` ayar bölümündedir.
8. **SMS kotası** (pompalama koruması, docs/04):
   - Her SMS gönderiminde numara başına (saatlik ve günlük) ve mağaza başına (günlük) sınır uygulanır. Kullanıcının tetiklediği SMS uçlarında IP başına sınır da uygulanır. Mevcut hız sınırı deposu (Redis) kullanılır.
   - Günlük sınırın %80'inde yöneticiye maliyet uyarısı gider. Sınır aşılınca ileti gitmez.
   - Eşik aşımında doğrulama (captcha) isteneceği bir işaret döner. Captcha sağlayıcısı F15'te seçilir; F9'da işaret ve test var.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kendi sağlayıcılarımız + kendi şablonlarımız (seçilen)** | Bağımlılık yok; Resend ve Mailpit aynı HTTP istemcisiyle; kaçış ve log kuralları bizde | Şablon yazımı elle (tablo HTML) |
| React Email | Bileşenli şablon, önizleme aracı | Yeni bağımlılık (react, react-email); arka uçta React işleme |
| SMTP (nodemailer) | Her sağlayıcıyla çalışır | Yeni bağımlılık; Resend'in olay ve gönderim kimliği SMTP'de daha zayıf |
| SMS hesabı platformun | Mağaza başvuru yapmaz | Gönderici başlığı firmaya kayıtlı olmalı; mağaza adına başlık açılamaz |
| İzin kaydını F13'e bırakmak | Tek modül | F9'un kabul kriteri karşılanmaz; ticari ileti kontrolsüz kalır |

## Sonuçlar

- Mağaza, SMS için Netgsm hesabını (kullanıcı kodu, şifre, onaylı başlık) kendisi açar ve panelden girer. API erişimi ve IP izni Netgsm panelinden verilir.
- Canlıda Resend hesabı ve platform gönderim alan adı gerekir (kod dışı gereksinim, docs/12).
- Gerçek Netgsm ve Resend hesaplarıyla deneme sunucuya çıkışta yapılır. Testler sahte Netgsm ve Mailpit ile çalışır.
- İYS'ye izin iletimi ve vitrinde izin alma F10'da; captcha sağlayıcısı F15'te.
