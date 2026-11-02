# ADR-0050: Panelden toplu e-posta ve SMS gönderimi

- **Durum:** Öneri (kullanıcı kararı bekliyor; 2026-11-03 gece taslağı)
- **Tarih:** 2026-11-03
- **İlgili:** docs/20 (gerekli liste); adr/0036 (bildirim altyapısı, `deliver()`), adr/0038 (İYS, tek tıkla çıkış, bülten onayı), adr/0037 §6 (segmentler), adr/0019 (içerik belgesi), adr/0048 (belirteçler), adr/0040 (roller, yeniden doğrulama), adr/0014 (iş altyapısı), F11.2 (`traffic-sources`), docs/kvkk-envanter

## Bağlam

Rakiplerin hepsinde var, bizde yok: mağaza bir segmente kampanya e-postası ya da SMS'i gönderemiyor (docs/20, "TR esnafının haftalık rutini"). Altyapının çoğu hazır:

- **Tek gönderim yolu (`workflows/messaging/deliver.ts`).** Sırayla: kanal açık mı, adres geçerli mi, bastırma listesi, ticari iletide kanal izni (`granted`), kota, Medusa `createNotifications` (`idempotency_key` = `şablon:kanal:kaynak:anahtar`). Ticari e-postaya `List-Unsubscribe` + tek tık çıkış eklenir, ticari SMS Netgsm'e `filter=11` ile gider.
- **Kota (`lib/messaging/email/quota.ts`).** Ticari ve işlemsel e-posta ayrı sayılır, ikisi de günlük sınıra tabi (varsayılan e-posta 5.000, SMS 500; `notifications` ayarı). Gün anahtarı `toISOString()` ile UTC gününe göre, yani Türkiye saatiyle 03:00'te döner. %80'de zil uyarısı.
- **Hazır şablon.** `marketing.announcement` (ticari; e-posta ve SMS; başlık, gövde, bağlantı) var ama onu gönderen bir akış yok. SMS metninin sonu "Ret için mağazayla iletişime geçin."
- **Segmentler (`customer-segments`).** Kurallar üyeleri her gece Medusa müşteri grubuna yazar.
- **Bülten aboneleri.** Abonenin çoğu zaman müşteri kaydı yok. Adresi izin kaydında yalnız şifreli duruyor (`recipient_encrypted`) ve amacı yazılı: "yalnız İYS'ye iletmek" (adr/0038 M11).
- **Medusa 2.21.2.** `createNotifications` dizi alır ama sağlayıcının `send`'ini tek tek ve eşzamanlı çağırır (adr/0036; Context7 örnekleri 2026-11-03 de böyle). Toplu gönderim yolu ya da hız denetimi yok; bunları biz yazarız.
- **Mevzuat ve posta kutuları.**
  - 6563 sayılı Kanun ve Ticari İletişim Yönetmeliği: izin, her iletide ret yolu ve gönderenin kimliği.
  - Gmail ve Yahoo toplu gönderici kuralları: SPF/DKIM/DMARC, tek tık çıkış, şikâyet oranı %0,3'ün altında.
- **Ad çakışması.** Panelde "Kampanyalar" adı promosyonlar için kullanılıyor (`nav.promotions`).

## Karar

1. **Kapsam: tek seferlik toplu ileti.** Her gönderim tek kanaldır (e-posta ya da SMS). Otomasyon akışı yoktur (§11).

2. **`campaigns` modülü.**
   - **`campaign`:** iç ad, kanal, kitle tanımı, içerik, `utm_campaign` kodu, zaman (`scheduled_at`, `started_at`, `finished_at`), oluşturan ve gönderen personel, sayılar (`counts`) ve rapor.
   - **Durum:** `draft → scheduled → sending ⇄ paused → sent`; ayrıca `cancelled` ve `failed`. `paused` nedenini taşır: `staff`, `quota`, `quiet_hours`, `complaints`.
   - Gönderim başlayınca içerik kilitlenir. Değiştirmek için "Kopyala" yeni taslak açar.
   - **`campaign_recipient`:** kampanya, alıcı özeti (`recipient_hash`, izin kayıtlarının anahtarlı özeti), müşteri ya da izin kimliği, durum (`pending`, `sent`, `skipped`, `failed`), neden ve zaman. **Adres tutulmaz.** Tekillik `(campaign_id, recipient_hash)` üzerindedir.

3. **Kitle.**
   - **Kaynaklar** (birleşim olarak):
     - segment ya da müşteri grubu;
     - "bütün izinli müşteriler";
     - "bülten aboneleri": müşteri kaydı olmayan `granted` izinler. Şifreli adres yalnız gönderim anında, bellekte çözülür. adr/0038 M11'deki amaç "İYS'ye iletmek ve izin verilen iletiyi göndermek" olarak genişler; KVKK envanteri güncellenir.
   - Alıcılar özetle tekilleşir: aynı kişi müşteri kaydından da abonelikten de gelse tek ileti alır.
   - **Dışarıda kalanlar:**
     - bastırma listesindekiler;
     - kanalda izni `granted` olmayanlar;
     - İYS'ye iletilmemiş izinler (`iys_status` `pending` ya da `failed`; öneri, danışman onayı bekler);
     - son 24 saatte başka bir toplu ileti almış alıcı (sıklık sınırı; ayar, varsayılan açık).
   - Panel kitle sayısını canlı tahmin eder. "Gönder" anında liste `campaign_recipient`'e dondurulur. İzin ve bastırma yine de her alıcıda gönderim anında `deliver()` içinde yeniden okunur.

4. **İçerik.**
   - **E-posta:**
     - konu (en çok 120 karakter) ve önizleme satırı;
     - gövde içerik belgesidir (adr/0019), panelin Sayfalar editörüyle yazılır;
     - e-postaya özgü bir işleyici (`EmailBlock`'a eklenir) başlık, paragraf, liste, bağlantı, düğme, medya kütüphanesinden görsel ve en çok 4 ürün kartını tablo HTML'ine çevirir;
     - ürün kartının fiyatı **gönderim anında** sayfanın JSON-LD'sini üreten `productFacts`'ten okunur; üstü çizili fiyat 30 gün kuralına uyar;
     - HTML ya da CSS yazılmaz.
   - **Belirteçler:**
     - mağaza belirteçleri (adr/0048);
     - `{ad}`: yalnız müşteri kaydından gelir ve adr/0036 Ek'teki bağlantı süzgecinden geçmelidir; yoksa "Değerli müşterimiz" yazılır.

     Bilinmeyen belirteç kayıtta reddedilir.
   - **Alt bilgi:**
     - unvan, MERSİS (`legal` ayarı) ve iletişim bilgisi;
     - tek tık çıkış (bugünkü düzen).

     Metin danışman onayına işaretli kalır.
   - **Bağlantılar:** yalnız mağaza alan adındakilere `utm_source=magaza&utm_medium=email|sms&utm_campaign=<kod>` eklenir.
   - **SMS:**
     - düz metin, en çok 3 parça;
     - panel karakter ve parça sayar (Netgsm'in Türkçe kodlama kuralı görevin başında resmî belgeden doğrulanır);
     - sonuna mağaza adı ve ret metni kendiliğinden eklenir. Ret metni Ayarlar > SMS'te girilir; girilmemişse SMS gönderimi açılmaz.
   - **Şablon:** yeni `marketing.campaign` (ticari; e-posta ve SMS; `retry: true`). Yükleyicisi kampanyayı ve alıcıyı kimliklerden okur. Kullanılmayan `marketing.announcement` kalkar.

5. **Deneme gönderimi.**
   - Yalnız giriş yapmış personelin kendi e-postasına ya da telefonuna gider. Başka adrese deneme yoktur; olsaydı mağazanın alan adından oltalama kapısı açardı.
   - Konu `[Deneme]` ile başlar. İzin denetlenmez, kota sayılır.
   - Hız sınırı: personel başına saatte 10.

6. **Gönderim: kampanya kaydı durum taşır, async-job kullanılmaz.**
   - `campaign-dispatch` işi dakikada bir çalışır ve `sending` durumundaki kampanyayı alır. Aynı anda tek kampanya gönderilir (kilit).
   - Tur başına en çok 120 alıcı, saniyede en çok 2 gönderim yapılır. Bu Resend'in varsayılan API sınırıdır; canlı hesapta doğrulanır. Sonuç saatte yaklaşık 7.000 ileti.
   - Her alıcı `deliver()`'dan geçer. Anahtar `marketing.campaign:<kanal>:<kaynak>:<campaign_id>` biçimindedir; yarıda kalan tur yeniden başlarsa kimse ikinci ileti almaz.
   - **Kota dolunca** (`over_quota`) satır `pending` kalır, kampanya `paused/quota` olur. Kota günü döndüğünde (TR 03:00) kendiliğinden sürer. Panel gönderimden önce "bugün N, kalanı ertesi gün" tahmini gösterir.
   - **SMS saatleri:** SMS yalnız 09:00–20:00 (TR) arasında gider (ayar). Dışında `paused/quiet_hours`.
   - **Kendiliğinden durdurma:** en az 200 gönderimden sonra kampanyanın şikâyet oranı %0,3'ü ya da kalıcı geri dönüş oranı %5'i geçerse kampanya `paused/complaints` olur ve zil çalar. Oranlar Resend kancasından gelir. Personel inceleyip sürdürebilir.
   - Neden async-job değil: günlerce sürebilen bir gönderim 10 dakikalık heartbeat süpürücüsüne takılırdı (adr/0014). Bu desen terk edilmiş sepet işinde de kullanılıyor.

7. **Yetki ve güvenlik.**
   - Yazma `owner` ve `admin`'dedir (adr/0040 tablosunda `operations` zaten reddedilir). Okuma herkese açıktır; kampanyada kişisel veri yoktur.
   - "Gönder" ve "Zamanla" **yeniden doğrulama** ister: çalınmış bir oturum mağazanın adıyla binlerce kişiye ileti gönderebilirdi.
   - Gönderen alan adı doğrulanmamışsa e-posta kampanyası başlamaz (`campaigns.sender_unverified`). SMS hesabı ya da ret metni yoksa SMS kampanyası başlamaz.
   - Bütün yazmalar denetim kaydına düşer. Ürün kartları ve görseller yalnız mağazanın kayıtlarından seçilir.

8. **KVKK.**
   - Kampanya kaydında yalnız sayılar tutulur. `campaign_recipient` adres tutmaz ve kampanya bittikten 90 gün sonra silinir; sayılar kalır.
   - Medusa'nın `notification` satırları (alıcı adresiyle) bugünkü 3 yıllık `sent_messages` kuralına girer.
   - KVKK silmesi (L9) kişinin alıcı satırlarını da siler.
   - **Kişi bazlı izleme yok:** açılma pikseli ve tıklama yönlendirmesi kapalı (Resend izleme kapalı). Ölçüm utm ile toplu yapılır.

9. **Rapor.** Kampanya sayfasında şunlar gösterilir:
   - hedef, gönderilen, nedenleriyle atlananlar, başarısızlar;
   - geri dönüş ve şikâyet;
   - gönderimden sonraki 7 günde gelen çıkışlar: izin olaylarıyla özet eşleşmesinden, yalnız sayı;
   - vitrin ziyareti, sipariş ve ciro: `traffic-sources` kaydında aynı `utm_campaign`, 7 gün.

10. **Panel: Büyüme > "Toplu ileti".** "Kampanyalar" adı promosyonlarda olduğu için bu ad seçildi.
    - **Liste:** ad, kanal, kitle, durum, gönderilen/hedef, tarih.
    - **Düzenleyici** iki sütundur:
      - solda adımlar: Kitle (canlı sayı), İçerik, Deneme, Zamanlama (şimdi ya da tarih, kota tahmini);
      - sağda canlı önizleme: masaüstü, telefon ve SMS balonu.
    - Müşterinin iletişim geçmişinde (F12.8) kampanya iletileri görünür.

11. **Yapılmayacaklar:**
    - otomasyon akışları (hoş geldin serisi, geri kazanma), A/B testi;
    - sürükle-bırak HTML tasarımcı, açılma izleme;
    - WhatsApp toplu gönderim (Business API, Meta şablon onayı, mesaj başı ücret);
    - kişiye göre gönderim saati, Resend Broadcasts ve toplu (batch) uç.

    Shopify Email karşılığı:
    - Segment, şablon, ürün bloğu, zamanlama ve rapor bizde de var.
    - Shopify'ın açılma/tıklama izlemesi ve Flow otomasyonları bizde bilinçli olarak yok.
    - ikas ve Ticimax'taki toplu SMS bizde İYS süzgeciyle birlikte gelir.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Kendi modülümüz + `deliver()` tek yol (seçilen)** | İzin, bastırma, kota, geçmiş ve çıkış tek yerde; İYS ve KVKK kuralları korunur | Hız ve kota yönetimi bizde; saatte ~7.000 e-posta |
| Resend Broadcasts / Audiences | Hazır kampanya ürünü, hızlı | Kişi listesi üçüncü tarafta (yurt dışı); izin ve İYS bizim dışımızda; SMS yok |
| Resend toplu ucu (100'lü istek) | Çok daha hızlı | Medusa bildirim kaydı, tekrarsızlık ve alıcı başı denetimler atlanır |
| Netgsm tek istekte çok numara | Ucuz, hızlı | Alıcı başı izin, kota ve geçmiş kaybolur |
| Tek async-job | Var olan altyapı, ilerleme ekranı | Gün aşan gönderim heartbeat süpürücüsüyle çakışır |
| Mailchimp / Klaviyo | Otomasyon ve tasarım hazır | Kişi verisi yurt dışında; İYS ayrı; mağazaya ek ücret |

## Sonuçlar

- **Backend:**
  - `modules/campaigns` (iki model);
  - `workflows/campaigns/{save,audience,test-send,schedule,dispatch,report}.ts`;
  - `lib/messaging/templates/campaign.ts` ve içerik belgesinin e-posta işleyicisi;
  - `jobs/campaign-dispatch.ts`, `jobs/campaign-recipients-retention.ts`;
  - `/admin/campaigns*` uçları (gövde şemaları katı, yeniden doğrulama listesinde).
- **Panel:** "Toplu ileti" listesi, düzenleyici, rapor; Ayarlar > SMS'te ret metni alanı.
- **Vitrin:** değişiklik yok (çıkış sayfası ve utm kaydı hazır).
- **Testler (HTTP `campaigns.spec`):**
  - izinsiz ya da bastırılmış alıcıya gitmez; İYS'ye iletilmemiş izne gitmez;
  - yarıda kalan gönderim yeniden başlayınca çift ileti yok;
  - kota dolunca bekler, gün dönünce sürer (sahte saat);
  - deneme yalnız kendi adrese gider; "Gönder" yeniden doğrulama ister;
  - kampanya ve alıcı tablosunda adres yok; bülten abonesine çözülmüş adresle gider;
  - SMS saat penceresi ve şikâyet eşiği durdurur.

  Birim testleri: e-posta işleyicisinde kaçış, SMS parça sayacı, utm yalnız mağaza alan adına.
- **Belgeler:** KVKK envanteri (`campaign_recipient`, abone adresinin amacı); adr/0038 M11'e not; mali/hukuki: alt bilgi ve ret metni danışman onayı bekler.

## Boyut ve bağımlılıklar

- **Boyut: M–L, yaklaşık 5 gün:**
  - backend 2,5 gün (modül, gönderim, e-posta işleyici);
  - panel 1,5 gün;
  - test 1 gün.
- **Bağımlılıklar:**
  - adr/0036 `deliver()` ve kota;
  - adr/0038 izin, İYS iletimi ve tek tık çıkış;
  - adr/0037 §6 segmentler, adr/0019 içerik editörü, adr/0048 belirteçler;
  - adr/0040 yeniden doğrulama, F11.2 `traffic-sources`;
  - gönderen alan adı doğrulaması (adr/0036 §6).
- **Dış ve kod dışı:**
  - mağaza başına Resend hesabı (F16);
  - Netgsm hesabı ve İYS marka kodu;
  - alt bilgi ve ret metni için danışman.

## Kullanıcıya sorular

1. **Bülten aboneleri:** müşteri kaydı olmayan bülten abonelerine de gönderelim mi? Bunun için şifreli adresin amacı "İYS'ye iletmek"ten "gönderim"e genişler. Öneri: evet.
2. **İYS'ye iletilmemiş izin:** İYS'ye henüz iletilmemiş (`pending`) izinlere gönderim yapılmasın mı? Öneri: yapılmasın. Bunun sonucu: İYS marka kodu girilmemiş mağaza toplu ileti gönderemez.
3. **Varsayılanlar:** aynı kişiye 24 saatte en çok bir toplu ileti, SMS yalnız 09:00–20:00 arası. Uygun mu?
4. **İlk dilim:** e-posta ve SMS birlikte mi gelsin, yoksa önce yalnız e-posta mı (SMS ikinci dilimde, yaklaşık 1 gün)?
