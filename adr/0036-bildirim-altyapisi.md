# ADR-0036: Bildirim altyapısı: e-posta, SMS ve ileti izni

- **Durum:** Kabul edildi (önerildi 2026-10-28, otonom uygulandı; kullanıcı 2026-10-30 bütün otonom kararları kabul etti)
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

## Ek: F9 N10 güvenlik incelemesi (2026-10-28)
Bağımsız inceleme kritik bulgu çıkarmadı. Şablon kaçışı, web kancası imzası, log maskeleme ve yönetici uçlarının yetkisi temiz. Yüksek ve orta bulgular, Resend hesabının mağazalar arasında paylaşılmasından geliyordu.

- **Karar: her mağazaya ayrı Resend hesabı (takımı) ve anahtarı.** §2'deki "platformun hesabı" yerine geçer.
  - Gerekçe: alan adı eklemek ve doğrulamak tam yetkili anahtar ister. Alan adına bağlı gönderim anahtarı bu uçları çağıramaz. Paylaşılan hesapta tek bir mağaza örneğinin ele geçmesi, öteki mağazaların alan adlarını silmeye, onların adına imzalı e-posta göndermeye ve gönderilmiş iletileri (şifre sıfırlama bağlantıları dahil) okumaya yeter. Bu, örnek başına mağaza modelinin (ADR-0001, docs/04) yalıtım sözünü bozar.
  - Kurulumda (F16/F17) her mağazaya bir Resend hesabı açılır; anahtarı ve web kancası sırrı yalnızca o mağazanın ortamına girer.
  - Mağaza kendi alan adını doğrulayana kadar varsayılan gönderici, platform alan adının mağazaya ait alt alan adıdır (ör. `<mağaza>.bildirim.<platform-alanı>`) ve kurulumda o mağazanın hesabında doğrulanır. Böylece bir mağazanın geri dönüş ve şikâyet oranı ya da yanıltıcı görünen adı ötekilerin itibarını etkilemez.
  - Kod değişmez: örnek zaten tek anahtar, tek web kancası sırrı ve tek gönderici okur. Değişen kurulum adımıdır (docs/08, docs/12).
- **Uygulandı (ikinci savunma hattı, hesap paylaşılsa da geçerli):**
  - Her gönderim `tenant` etiketi taşır (mağaza örneğinin `BACKEND_URL` host'u). Web kancası etiketi bu mağazanın olmayan raporu kaydetmeden yok sayar. Başkasının geri dönüşü bu mağazanın listesine girmez, müşterileri bu mağazanın panelinde görünmez.
  - Resend'e giden `Idempotency-Key` aynı etiketle başlar. Aynı personel adresine giden iki mağazanın özeti çakışmaz.
  - Canlıda ve staging'de `EMAIL_TRANSPORT=resend` ise `RESEND_WEBHOOK_SECRET` zorunlu. Sırsız kurulumda bastırma listesi sessizce kapalı kalırdı.
  - Müşterinin yazdığı ad ve adres iletide yalnızca bağlantı gibi okunmuyorsa yer alır: adda `://`, `www.`, `@`, alan adı biçimi, rakam ya da 40 karakterden uzunluk; adres satırında `://`, `www.` ya da `@` varsa satır atlanır, karşılama "Değerli müşterimiz"e döner. Sipariş veren herkes başkasının adresine mağaza adıyla oltalama metni gönderemesin diye.
  - E-posta doğrulama kodunun ve sıfırlama bağlantısının bildirim kaydındaki izi artık anahtarlı özet (`PII_HASH_KEY`). (İnceleme kodu altı haneli sanmıştı; F10'da kaynaktan doğrulandı: Medusa'nın kodu 256 bitlik rastgele değer, düz özetten bulunamaz. Anahtarlı özet yine de kalır, kayıttaki iz hiçbir şeye bağlanamasın diye.) Sıfırlama bağlantısının iş akışı kaydında (`workflow_execution`) da durmadığı test edildi.
  - SMS yalnızca cep telefonuna (`+905…`) gider. Sabit hat ve 0850 numaraları kotayı boşuna harcamaz.
  - Başlıklar: görünen ad ve konu, bütün denetim karakterlerinden ve U+2028/U+2029'dan temizlenir.
  - Gönderici alan adı: ikinci alan adı Resend'e gitmeden reddedilir; Resend'de artık olmayan alan adı (404) yerelde de kaldırılır; geri çekme başarısız olursa log Resend kimliğini yazar; alan adı ekleme de personel başına hız sınırında.
  - Netgsm başlık sorgusunun JSON yanıtında yalnızca değerler gönderici adı sayılır; anahtarlar ve durum alanları (`code`, `description` …) sayılmaz.
- **Ertelenenler (gözden geçir):**
  - Misafir adreslerine mağaza başına günlük e-posta sınırı ve MX denetimi: F10'da vitrin sipariş akışının kötüye kullanım önlemleriyle (captcha F15). O zamana kadar checkout'un IP başına hız sınırı ve bastırma listesi geçerli.
  - Ziyaretçinin tetiklediği SMS'lerde IP sayacı (§8): sipariş SMS'i şimdilik numara ve mağaza sınırıyla korunuyor. IP kovası sipariş anında saklanıp F10'daki ilk vitrin SMS ucuyla bağlanacak; captcha F15'te.
  - Redis düştüğünde SMS sayaçları bellekte sıfırdan başlıyor (kapanmadan açık kalma değil, sınır gevşer). Canlıda Redis yüksek erişilebilir kurulur (F16). Maliyet sorun olursa SMS sayacı Redis yokken kapalı başarısızlığa çevrilir.
  - Panelden izin verme: kanıt alanı, yalnızca sahip rolü ve izin olaylarının değiştirilemezliği F10 (İYS iletimi) ve F12 (roller) ile.
  - Ticari e-postada `List-Unsubscribe` / `List-Unsubscribe-Post` başlıkları ve tek tıkla ret bağlantısı F10 kampanyalarıyla.

## Ek: İletişim geçmişi ve gönderilmeyen iletiler (F12.8, 2026-10-30)
- Panelde sipariş ve müşteri sayfasında iletişim geçmişi var. Gönderilenler Medusa'nın `notification` kayıtlarından okunur: sipariş için siparişin, kolilerinin ve iade taleplerinin kayıtları, müşteri için `receiver_id`. Ekibe giden `staff.*` iletileri müşterinin geçmişine girmez. Adres yalnızca maskeli döner, ileti metni zaten saklanmaz.
- Gönderilmeyenler `messaging` modülündeki `message_skip` tablosuna yazılır: şablon, kanal, neden (`channel_off`, `invalid_recipient`, `suppressed`, `no_consent`, `over_quota`), kaynak, alıcı, maskeli adres.
  - Gönderim anahtarı (Medusa'nın `idempotency_key`'i) başına bir satır tutulur; aynı gönderim yeniden denenirse son nedeni kalır. Gönderim sonradan giderse satır silinir.
  - Yalnızca geçmişin okuduğu iletiler yazılır: alıcısı bilinen müşteri ya da sipariş, koli veya iade talebi. Ekip uyarıları ve anonim istekler (şifre sıfırlama) yazılmaz; ikincisini herkes tekrarlayabilir, hiçbir geçmiş okumaz.
  - Daha önce gitmiş bir gönderim yeniden denenirse (olay yeniden teslimi) sonuç `duplicate` olur ve "gönderilmedi" yazılmaz. Yineleme denetimi bu yüzden öteki denetimlerden önce yapılır.
  - SMS hesabı olmayan mağazanın SMS'leri (`channel_off`, SMS) yazılmaz. SMS göndermemek mağazanın tercihi, her siparişte "gönderilmedi" demek gürültü olurdu. E-postanın kapalı olması bir arızadır, o yazılır.
  - Kayıt yazılamazsa ileti yine gider; yalnızca uyarı loglanır.
  - Satırlar 180 gün tutulur (`message-skips-retention`, her gece).
- Sağlayıcı hatası (`failure`) Medusa'nın kaydında kalır; panel "Gönderim servisi iletiyi kabul etmedi" der.
- Okumalar kayıtlı okumadır (`SENSITIVE_READS`): müşterinin hangi iletiyi aldığı kişisel veridir.


## Ek: Müşteri mesajlarının metinleri ve anahtarı (2026-11-10)
Mağaza, müşterisine giden iletilerin metnini değiştiremiyor, isteğe bağlı olanları kapatamıyordu; panel yalnızca önizliyordu.

- **Ne değişir.** Her müşteri iletisinde sabit, güvenli yerleşimin içindeki metinler: e-postada konu, ön izleme satırı, başlık ve giriş paragrafı; SMS'te metnin tamamı. HTML yok: mağazanın yazdığı düz metindir, satır sonları korunur (`<br>`), değerler ve metin yerleşimde kaçışlanır. Ürün tablosu, tutarlar, havale bilgisi, düğmeler, alt bilgi, ticari iletinin ret bağlantısı ve yasal notlar platformundur, değişmez.
- **Değişkenler.** Her şablonun sabit `{belirteç}` listesi vardır (mağaza bilgilerinin `{ad}` biçimi, adr/0048): `{mağaza_adı}`, `{müşteri_adı}`, `{sipariş_no}`, `{toplam}`, `{kargo_firması}`, `{takip_no}`, `{takip_bağlantısı}`, `{fatura_no}`, `{talep_türü}` (iade/değişim) … Kayıtta listede olmayan belirteç 400 ile adıyla reddedilir (`messaging.template_token_unknown`). Değerler tek geçişte yerleşir: müşterinin adındaki `{…}` belirteç olarak okunmaz; görünmez karakterler atılır. İade iletilerinde tek metin iki türe de gider, tür `{talep_türü}` ile söylenir.
- **Kayıt.** `messaging` modülünde `message_template_text` (şablon başına bir satır: `enabled`, beş alan, `updated_by`). Boş ya da platform metniyle aynı gönderilen alan `null` saklanır: platformun metni güncellenince o alana da yansır. Gönderimde her alan ayrı ayrı mağazanınkine, yoksa platformunkine düşer. Okuma başarısız olursa ileti platform metniyle gider.
- **Denetim.** Tek satır alanlarda satır sonu ve denetim karakteri, her alanda biçim karakterleri (yön çevirme, sıfır genişlikli boşluk; emoji birleştiricisi hariç) reddedilir; uzunluk sınırı konu/ön izleme/başlık 150, giriş 2000, SMS 600. SMS, önizlemenin örnek değerleriyle Netgsm'in `encoding=TR` sayımıyla 3 parçayı geçerse 400 (`messaging.sms_too_long`); panel parça sayısını yazarken gösterir, 1'i geçince uyarır.
- **Zorunlu iletiler (anahtar yok, "Zorunlu").**
  - `order.placed`: sipariş onayı ve mesafeli satış bilgileri kalıcı veri saklayıcıyla iletilir (6502 md. 48/4, Mesafeli Sözleşmeler Yönetmeliği). SMS kanalı mağazanın SMS hesabına bağlıdır, iletinin kendisi kapatılamaz.
  - `order.invoiced`: internet satışında e-Arşiv fatura alıcıya elektronik ortamda iletilir (VUK 509 sıra no.lu GT).
  - `order.access_link`, `payment_link.sent`, `account.password_reset`, `account.verify_email`, `stock.alert_confirm`: müşteri kendisi istedi; bağlantı ya da kod başka yoldan ulaşmaz.
  - `gift_card.issued`: kartın kodu satın alınan üründür; ileti onu teslim eder.
  - `return.approved` (geri gönderim kargo kodu, cayma) ve `return.refused` (kabul edilmeyen ürünler ve müşterinin seçenekleri bildirilmeli).
  - `consent.confirm`: çift onay İYS kaydının kanıtıdır; listede görünür ama metni de değişmez.
- **İsteğe bağlı (anahtarlı):** `order.shipped`, `order.delivered`, `return.requested`, `return.refunded`, `return.canceled`, `payment.failed`, `account.migration_invite`, `stock.back_in_stock`. Kapalı iletinin sonucu `template_off`'tur ve loglanır; iletişim geçmişine "gönderilmedi" yazılmaz (mağazanın tercihi, SMS hesabı olmaması gibi).
- **`cart.reminder`** ticaridir ve zorunlu değildir; ama açıp kapatmak zaten Pazarlama > Terk edilmiş sepet'tedir (`marketing.abandoned_cart_enabled`). İki anahtar olmasın diye burada anahtar yok, panel oraya bağlantı verir; metni burada değişir.
- **Listede olmayanlar:** ekibe giden `staff.*` uyarıları (Personel uyarıları sekmesinde önizlenir) ve gövdesi her gönderimde yazılan `marketing.campaign`, `marketing.announcement`.
- **Uçlar.** `GET /admin/messaging/customer-messages` (gruplu liste: alanların platform metni ve mağazanınki, belirteçler ve örnek değerleri, anahtar türü), `POST /admin/messaging/customer-messages/:name` (iş akışı `messaging-save-template-texts`, geri alınırsa önceki metin yazılır), `POST /admin/messaging/templates/:name/preview` (kaydedilmemiş taslağın önizlemesi, kayıt gibi denetlenir, hiçbir şey saklanmaz). `GET …/preview` artık kayıtlı metinle çizer. Önizlemeler `no-store`. Yazma sahip ve yöneticinin (rol varsayılanı); operasyon ve salt okunur yalnızca okur. Değişiklik denetim kaydına `message_template` olarak alan adları ve önce/sonra ile yazılır.
- **Panel.** Ayarlar > Bildirimler > Müşteri mesajları: Sipariş, Kargo, İade, Hesap, Stok bildirimi, Pazarlama grupları; satıra tıklayınca standart pencere, E-posta / SMS sekmeleri, alanın sağında belirteç menüsü (yalnızca o iletinin belirteçleri, örnek değerleriyle), yazarken sunucunun çizdiği önizleme, SMS sayacı, "Varsayılana dön".
- **Güvenlik incelemesi sonrası (2026-11-10):**
  - *Taşıması zorunlu belirteç.* Zorunlu bir iletinin bağlantısını ya da kodunu yalnızca mağazanın metni taşıyorsa o alan belirteci içermek zorundadır (`EditSpec.mustContain`). Bugün tek örnek `payment_link.sent` SMS'i: `{ödeme_bağlantısı}`. Eksikse kayıt ve taslak önizleme 400 verir (`messaging.template_token_missing`, belirteç adıyla). Panel alanın altında söyler ve kaydetmeyi kapatır. Öteki zorunlu iletiler denetlendi: e-postalarda bağlantı ve kod sabit düğme ya da kutudadır (sipariş ve ödeme bağlantısı, doğrulama kodu, hediye kartı kodu, iade kargo kodu); `order.placed` SMS'i bağlantı taşımaz; `consent.confirm` metni zaten değişmez.
  - *Gönderimde güvenlik ağı.* Kayıtlı metin zorunlu belirteci içermiyorsa (kuraldan önce kaydedilmiş), tek satır alan boş çıkıyorsa ya da dolan SMS 3 parçayı geçiyorsa o alan platform metniyle gider ve uyarı loglanır (`messaging.own_text_unfit`, alan ve neden; içerik yok).
  - *SMS en kötü durumla sayılır.* Kayıtta belirteçler en uzun değerleriyle doldurulur (`lib/messaging/editable/tokens.ts`; toplu SMS'in `LONGEST_NAME` yöntemi): ad 40 çift septetlik harf, bağlantı 120 karakter, takip no 24, tutar `₺9.999.999,99`. Müşterinin yazdığı bir bilgi (ad) Türk tablosu dışında harf taşırsa SMS UCS-2'ye düşer; bu öngörülemez, panel uyarır. Panel sayacı aynı en uzun değerlerle sayar.
  - *Boş değer.* Doldurmadan sonra boşluklar teke iner, satır başı ve sonu kırpılır; boş kalabilen belirteç (`{gönderen_adı}`, `{takip_no}`, `{takip_bağlantısı}`) kullanılınca panel uyarır. Değerlerden U+2028/U+2029 da atılır.

## Ek 2026-11-10: SMTP
Mağaza sahibi kendi VPS'inde (aaPanel, Postfix 587/465) barındıracak ve Resend'e ödeme yapmak istemiyor; mylarte.com'un WordPress e-postaları yıllardır bu sunucudan SMTP ile gidiyor. Bu mağaza için beklenen kurulum SMTP'dir. Resend ve Mailpit olduğu gibi kalır; "Alternatifler"deki SMTP satırı bu ekle seçilmiş olur.

- **Üçüncü gönderici: `smtp`.** `EmailTransport.name` `resend | mailpit | smtp` olur. Mağaza kendi sunucusunu panelden kaydederse (`integration-credentials` `smtp`) bütün e-postalar oradan gider; ortamın `EMAIL_TRANSPORT` ayarının önüne geçer. Kayıt yoksa davranış bugünkü gibidir. Sağlayıcı (`notification-email`) hesabı çağrı anında paylaşılan container'dan okur (adr/0027, SMS gibi); gönderici adresi `senderAddress` hesabın `from_email`'idir, görünen ad hesabın `from_name`'i yoksa mağaza adı.
- **Ortam değişkeni yok.** `EMAIL_TRANSPORT=smtp` + `SMTP_*` eklenmedi: hesap mağazanındır (Netgsm gibi), şifre panelden girilir ve `CREDENTIALS_ENCRYPTION_KEY` ile mühürlenir; ikinci bir düz metin sır yeri açılmaz. Platform varsayılanı Resend (canlı) ya da Mailpit (geliştirme) kalır.
- **Bağımlılık: nodemailer 10.2.1** (MIT-0, bağımlılıksız, kendi TypeScript tipleri; 2026-10-22'de yayımlandı, 14 günden eski). En yaygın Node SMTP istemcisi; SMTP'yi (STARTTLS, AUTH, nokta kaçışı, MIME, başlık kodlama) elle yazmak güvenlik açığı riskidir. Test için geliştirme bağımlılığı **smtp-server 3.21.1** (MIT-0, aynı yazar, nodemailer 10.2.1'e bağlı); testler süreç içi sunucuya `127.0.0.1`'de bağlanır, dışarı çıkmaz.
- **Hesap alanları.** Açıkta: `host`, `port`, `security` (`tls` = 465 örtük TLS, `starttls` = zorunlu STARTTLS, `none`), `username` (isteğe bağlı), `from_email`, `from_name` (isteğe bağlı), `rate_per_minute` (1–300, varsayılan 30). Gizli: `password` (yalnızca yazılır; kullanıcı adı varsa zorunlu, girişsiz yerel aktarıcıda boş). Kimlik alanları `host`, `port`, `security` ve `username`: biri değişince kayıtlı şifre yeni hedefe gitmez, yeniden istenir (güvenlik incelemesi L3). Kaydetme ve silme yalnız sahibin (adr/0040), denetim kaydına sağlayıcı hesabı gibi yazılır (ayarlar ve şifre sürümü; şifre hiç).
- **TLS ve hedef kuralları.**
  - TLS zorunlu; sertifika doğrulanır (`rejectUnauthorized`, en az TLS 1.2). Şifrelemesiz (`none`) yalnızca loopback'e (`localhost`, 127.0.0.0/8, ::1): aynı makinedeki Postfix. Kural hem kayıtta hem göndericide (ikinci savunma) uygulanır.
  - Docker: konteynerin loopback'i ana makine değildir. Önerilen yol sunucunun genel adıdır (`mail.<alan-adı>`, sertifikadaki ad; genel IP'ye çıkar) ile 587/STARTTLS ve giriş; ikinci yol `network_mode: host` ile `localhost`/`127.0.0.1`. `host.docker.internal` ve köprü adresleri (172.17.0.1) iç adrestir, aşağıdaki SSRF kuralıyla reddedilir (docs/08).
  - **SSRF kuralı (güvenlik incelemesi M1, `lib/messaging/email/smtp-target.ts`).** Sunucu, mağazanın yazdığı adrese mağazanın şifresiyle bağlanır; bu yüzden platformun SSRF politikası (`isBlockedAddress`, docs/04) burada da geçerlidir:
    - Ad her kayıtta, her "bağlantıyı dene"de ve her gönderimde bizce çözülür (`safeFetch`'in c-ares çözümleyicisi: iptal edilebilir, 5 sn; `/etc/hosts` okunmaz, iş parçacığı havuzunu kilitlemez; `dns.lookup` bu yüzden seçilmedi). Dönen adreslerden **biri bile** genel değilse (özel, loopback, link-local/metadata, CGNAT, belgeleme, IPv4 gömülü IPv6) ad reddedilir: `target_refused`, kayıtta `smtp.host_refused` (alan: sunucu).
    - nodemailer'a izin verilen adres ve o adrese bizim açtığımız soket verilir (`getSocket`, `smtp-socket.ts`); nodemailer kendisi çözümlemez. Böylece ikinci bir DNS yanıtı (rebinding) bağlantının gideceği yeri değiştiremez. Sertifika yine yazılan ada göre denetlenir (`servername`, `tls.servername`).
    - Tek istisna bu makinedir ve yalnızca öyle yazılınca: `localhost`, 127.0.0.0/8, ::1. Hiç çözülmez (`localhost` = 127.0.0.1); DNS'ten 127.x dönen bir ad reddedilir. Şifrelemesiz (`none`) yalnızca bu hedefe.
    - Ad biçimi sıkılaştırıldı: en az bir nokta (`localhost` dışında), son etiket harfle başlar; `2130706433`, `127.1`, `0x0a000001` gibi sayısal biçimler ad sayılmaz. Yazılan IP yalnızca kanonik biçimde ve politikadan geçiyorsa (ya da loopback ise) kabul edilir.
    - Portlar: yalnızca 25, 465, 587, 2525; hem kayıtta hem her gönderimde (`port_refused`, L1). Geliştirme ve testte loopback'te her port açıktır (Mailpit `51025`).
    - Deneme e-postası ve kayıttaki bağlantı denemesi `connection_refused`, `dns_failed`, `timeout`, `network_error` ayrımını göstermez: hepsi `unreachable` ("sunucuya ulaşılamadı"). Düğme bir ağın açık/kapalı portlarını haritalamak için kullanılamaz. Ayrıntılı kod yalnızca operatörün logundadır.
  - EHLO adı örneğin genel host'udur (`BACKEND_URL`), değilse gönderen alan adı; makinenin kendi adı ya da `[127.0.0.1]` asla.
  - Vazgeçilen bir gönderimin (deneme e-postasının 20 sn sınırı) soketleri yok edilir ve taşıyıcı kapatılır: ret döndükten sonra ileti gidemez.
  - Zaman aşımları: bağlantı 10 sn (DNS, karşılama, STARTTLS dahil), karşılama 10 sn, soket 30 sn, DNS 5 sn. Her ileti için ayrı bağlantı (havuz yok): kampanya turu ile sipariş e-postası birbirini beklemez. nodemailer'ın logu kapalı; dosya ve URL okuma kapalı.
- **Başlıklar ve Message-ID.** Konu, görünen ad, `Reply-To`, `List-Unsubscribe` ve `List-Unsubscribe-Post` değerleri `headerText`'ten geçer (denetim karakterleri ve U+2028/U+2029 boşluğa döner, satır kırılımıyla başlık eklenemez); adresler tek adres biçiminde değilse gönderim reddedilir. `Message-ID` `<sha256(tenant:idempotencyKey) ilk 40 hex>@<gönderen alan adı>`: aynı gönderimin yeniden denemesi aynı kimliği taşır, iki mağazanınki çakışmaz, anahtar geri okunamaz. Gönderimin kimliği (`external_id`) bu Message-ID'dir.
- **Hata eşlemesi** (`lib/messaging/email/smtp-errors.ts`; yalnızca yanıtın sayıları tutulur, `550 5.1.1`; yanıtın metni alıcı adresini içerebileceği için loglanmaz, hata `cause` taşımaz):
  - `recipient_rejected` (güvenlik incelemesi M2 ile daraltıldı): **yalnızca RCPT TO'da** 5xx ve geliştirilmiş kod 5.1.1, 5.1.2, 5.1.3, 5.1.6, 5.1.10 ya da 5.2.1 (posta kutusu ya da alan adı yok, kutu kapalı). Geliştirilmiş kod yanıtın başında olmalı (`^[2-5]\d\d[ -]X.Y.Z`) ve sınıf rakamı yanıtın ilk rakamıyla aynı olmalı; metnin içindeki bir "5.1.1" sayılmaz. Kodsuz yanıtta yalnızca 550/551 ve yalnızca sunucu EHLO'da ENHANCEDSTATUSCODES bildirmediyse; bunu görmediysek (465'te örtük TLS EHLO'yu gizler) bildirmiş sayılır ve bastırılmaz. EHLO yanıtı yalnızca düz metin aşamasında, nodemailer'ın yanında okunur, saklanmaz. DATA sonrası ret, 5.1.0/5.1.7/5.1.8 (gönderenin adresi), 5.2.2 (kutu dolu) ve 5.7.x (politika, aktarım reddi) alıcının suçu sayılmaz. **Bastırma listesine yazılır** (`reason: bounce`, `source: smtp`, `detail` yanıt kodu), Resend `email.bounced` gibi; kampanyanın geri dönüş oranına sayılır.
  - **Bastırma freni (M2, `smtp-breaker.ts`).** 10 dakikalık pencerede en az 5 SMTP gönderimi `recipient_rejected` olur ve bunlar penceredeki SMTP gönderimlerinin en az yarısıysa fren açılır: 1 saat boyunca hiçbir ret bastırılmaz, pencerenin yazdığı bastırmalar geri alınır (`removed_by: system:smtp_breaker`), sabit bir olay loglanır (`messaging.smtp_rejections_tripped`, error) ve aynı adlı olay yayılır. Abone (`subscribers/smtp-rejections-alarm.ts`) zile bir uyarı yazar (saatte bir) ve personel e-postasını gönderir (`staff.smtp_rejections`, yeni sipariş uyarısı anahtarıyla; aynı sunucudan gittiği için ulaşmayabilir, zil her zaman ulaşır). Gerekçe: tek müşterinin "böyle kutu yok"u o müşterinindir; yarısını reddeden sunucu ise kendi ayarını söylüyordur (aktarım kuralı, dolu disk) ve gerçek müşteriler listeye girmemelidir. Sayaç süreç başınadır (sunucu ve worker ayrı sayar); eşikler her birinde geçerlidir.
  - `rejected`: öteki 5xx (gönderen reddi, politika, içerik). Yeniden denenmez, bastırmaz.
  - `deferred` (4xx), `connection_refused`, `dns_failed`, `timeout`, `network_error`: yeniden denenebilir. Gönderici HTTP istemcisinin politikasıyla (3 deneme, üstel bekleme) yeniden dener; sonra hata yeniden denenebilir olarak döner, bildirim FAILURE kalır ve mevcut yol (aynı anahtarın yeniden tetiklenmesi, personelin "yeniden gönder"i) onu yeniden gönderir. Kampanyada `failed` kalır (adr/0050).
  - `outcome_unknown`: bağlantı ileti teslim edilirken (DATA) koptu; ileti gitmiş olabilir. Yeniden denenmez; sonraki deneme aynı Message-ID'yi taşır.
  - `auth_failed`, `tls_failed`: hesabın bilgileri; yeniden denenmez.
  - Gelen geri dönüş kutusu (asenkron DSN) okunmaz. Yerel aktarıcı (Postfix) iletiyi kuyruğa alıp sonradan geri çevirirse bu bastırma listesine düşmez; bu bilinçli bir sınır.
- **Modül sınırı istisnası.** E-posta sağlayıcısı, kalıcı reddi bastırma listesine yazmak için `messaging` modülünü paylaşılan container'dan çağırır (`lib/messaging/email/smtp-bounce.ts`). Medusa sağlayıcının hatasını sarmalayıp yeniden fırlattığı için (2.21.2 `createNotifications_`: `MedusaError UNEXPECTED_STATE`) `deliver()` hata türünü göremez. Liste yazılamazsa uyarı loglanır, gönderim yine başarısız döner. Fren açılınca sağlayıcı yalnızca olay yayar (`Modules.EVENT_BUS`); zil ve personel e-postası aboneden ve iş akışı dosyasından gider (sağlayıcı iş akışı çağırmaz). apps/backend/CLAUDE.md istisnalarına eklendi.
- **"Bağlantıyı dene" ve kayıt.** Kaydetmeden önce sunucuya bağlanılıp giriş yapılır (`verify`, ileti gönderilmez): giriş reddi `smtp.secret_invalid` (şifre alanı), TLS hatası `smtp.merchant_invalid` (güvenlik alanı), ulaşılamayan sunucu ilk kayıtta "doğrulanmadı" olarak kaydedilir (öteki sağlayıcılar gibi).
- **Deneme e-postası.** `POST /admin/messaging/smtp/test` (`{}`), iş akışı `messaging-smtp-test-send`. Kayıtlı sunucudan, oturumdaki personelin kendi giriş adresine bir e-posta; elle adres yazılamaz. Tek deneme, 20 sn sınırı. Yanıt `{ ok: true, to }` (maskeli) ya da `{ ok: false, reason, reply }`; panel nedeni Türkçe cümleyle ve yanıt koduyla gösterir. Sahip ve yönetici kullanabilir, operasyon ve salt okunur kullanamaz (`PRIVATE` `/admin/messaging/smtp*`); personel başına hız sınırı (`provider_check`). Gönderilen e-posta geri alınamaz, hiçbir şey saklanmaz: compensation yok. Kotaya sayılmaz, bastırma listesine yazmaz.
- **Gönderici alan adı: uyarı, engel değil.** Resend'in alan adı doğrulama akışı SMTP'de yoktur (`available: false`). `GET /admin/messaging/sender-domain` `transport: "smtp"` ile `dns` döner: gönderen adresin alan adında SPF (`v=spf1`), DKIM (yaygın seçiciler: `default` (aaPanel), `mail`, `dkim`, `smtp`, `selector1`, `s1`, `k1`, `x`) ve DMARC (`_dmarc`, `v=DMARC1`) kaydı var mı (`found | missing | unknown`). Yalnızca varlık okunur; SPF'in bu sunucuyu kapsayıp kapsamadığına bakılmaz. 3 sn DNS sınırı, 10 dakikalık önbellek. Panel eksikleri uyarı olarak gösterir; gönderim ve kampanya beklemez (sahibin kuralı: uyar, engelleme). Kampanya kanalı SMTP'de doğrulanmış alan adı istemez (`channelBlocker`).
- **Hız.** Kampanya turu SMTP'de hesabın hızıyla gider: tur başına en çok `rate_per_minute` alıcı, aralarında `60 sn / hız` (varsayılan 30/dk, 2 sn). İşlemsel e-postalar kampanyayı beklemez (ayrı bağlantı, ayrı yol).
- **Göç.** `messaging` `message_suppression.source` enum'una `smtp` eklendi (`Migration20261110061741`).
- **Panel.** Ayarlar > E-posta ve SMS > E-posta: "E-posta gönderimi" kartı (durum rozeti, sunucu, gönderen, kampanya hızı; "Deneme e-postası gönder"; sahip için "Sunucuyu bağla/Düzenle") ve tek standart pencere (sunucu adı, port, güvenlik seçimi portu birlikte değiştirir, kullanıcı adı, yalnızca yazılan şifre, gönderen adresi ve adı, dakikada kampanya e-postası; "Bağlantıyı kaldır"). Gönderen adres kartı SMTP'de SPF/DKIM/DMARC satırlarını ve eksikse uyarıyı gösterir.
- **Başlıklarda biçim karakterleri.** `headerText` artık görünmez biçim karakterlerini (`\p{Cf}`: yön çevirme, sıfır genişlikli boşluk, BOM) atar; emoji birleştiricisi (U+200D) kalır. SMTP ayarlarının tek satır alanları da bunları reddeder. Resend ve Mailpit aynı işlevi kullandığı için onlara da geçerlidir.
- **DNS uyarısının önbelleği.** Gönderen alan adının kayıtları alan adı başına 10 dakika (DNS yanıt vermediyse 1 dakika) tutulur; aynı anda gelen okumalar tek sorguyu paylaşır. Sekmeyi her rol okur; her okuma 10 TXT sorgusu yapmasın diye.
- **Testler.** Birim: başlık kaçışı, biçim karakterleri, Message-ID, TLS kuralları, 4xx/5xx eşlemesi (M2 kodları, kodsuz yanıt ve EHLO), yeniden deneme, sertifika reddi, SSRF hedef kuralı (iç adres, karışık yanıt, metadata, sayısal adlar, portlar, her gönderimde yeniden çözüm), vazgeçilen gönderim, EHLO adı, fren (süreç içi smtp-server ve elle yazılmış ham sunucu). HTTP: kayıt yetkisi ve maskeleme, denetim, iç adres reddi, deneme gönderimi (yetki, `unreachable`), DNS uyarısı, bastırma, fren (geri alma ve zil). Panel: kart, pencere, yeniden şifre isteme, `unreachable`.
- **Açık riskler.** Postfix kuyruğa alıp sonra geri çevirdiği adresler (asenkron geri dönüş) listeye girmez. Şikâyet (spam bildirimi) SMTP'de gelmez; kampanyanın şikâyet oranı SMTP'de sıfır görünür. Sunucunun IP itibarı ve PTR/rDNS kaydı mağaza sahibinin sorumluluğundadır. Fren süreç başına sayar; çok süreçli kurulumda eşik her süreçte ayrı aşılır. Fren açılmadan önceki en çok 4 ret bastırılır ama fren açılınca geri alınır.
