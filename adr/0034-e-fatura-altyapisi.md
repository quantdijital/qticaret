# ADR-0034: E-Fatura / e-Arşiv altyapısı

- **Durum:** Kabul edildi (2026-10-30, yeniden yazıldı). İlk sürüm 2026-10-28'de önerildi: kendi UBL'imiz ve ince entegratör adaptörü. Kullanıcı 2026-10-30'da bunun yerine önerilen yolu seçti ("önerine uyuyorum başlayabiliriz"). Önceki karar aşağıda "Önceki karar"da özetlenir.
- **Tarih:** 2026-10-28, yeniden 2026-10-30
- **İlgili:** F8.1–F8.8; ADR-0010 (kalem bazlı para), ADR-0027 (sağlayıcı hesapları panelden), ADR-0032 (iade ve değişim), ADR-0033 (sipariş düzenleme), ADR-0039 (muhasebe aktarımı, dış API, web kancaları), ADR-0041 (KVKK); docs/entegrasyonlar/e-fatura.md; docs/mali-musavir-sorulari.md

## Bağlam

F8 her satış için e-Fatura (alıcı e-fatura mükellefiyse) ya da e-Arşiv faturası, iadeler için de iade belgesi istiyor.

İlk planda UBL-TR üretimi, mükellef listesi ve PDF bizdeydi; entegratör yalnızca imzalayıp iletecekti. Platformların bu işi nasıl çözdüğüne bakıldı (2026-10-30): ikas ve Ticimax ağırlıkla muhasebe ve fatura programlarına bağlanıyor ya da BirFatura gibi aracılara açık uç veriyor. Bu yolun bize getirdikleri:
- **Ağır iş programda kalır.** UBL yazıcısı, GİB şema ve iş kuralları, kod listesi güncellemeleri, mükellef listesi ve fatura PDF'i bizim işimiz olmaz.
- **Muhasebe zaten oradadır.** KOBİ'lerin çoğu Paraşüt kullanıyor. Fatura orada kesilince satış kaydı da orada oluşur; çift kayıt olmaz.
- **İlk müşteri faturasını Luca'da elle kesiyor.** Kullanıcı kararıyla Luca entegre edilmiyor. Bu müşteriye fatura numarasını ve PDF'i elle işlemek yeter.

Paraşüt API v4, resmî tanımından (`https://apidocs.parasut.com/swagger.json`, Swagger 2.0, son değişiklik kaydı 2021-10-11) doğrulandı:
- **Kimlik:**
  - OAuth2. Token adresi `https://api.parasut.com/oauth/token`; `password`, `authorization_code` ve `refresh_token` akışları var.
  - Erişim jetonu 2 saat geçerli. Her yenilemede yeni bir yenileme jetonu döner ve sonraki yenilemede o kullanılır.
  - İstemci kimliği ve sırrı `destek@parasut.com`'dan istenir.
- **Adres ve sınır:** `https://api.parasut.com/v4/{company_id}/...`. En çok 10 saniyede 10 istek. Sayfa en çok 25 kayıt.
- **Biçim:** JSON:API. Fatura satırları `relationships.details.data[]` içinde, kendi `attributes`'larıyla gönderilir.
- **Akış:**
  1. `contacts` (kişi ya da şirket, VKN veya TCKN);
  2. `sales_invoices`: `item_type: invoice | refund …`, para birimi `TRL`; satırda miktar, KDV hariç birim fiyat, KDV oranı, tutar olarak indirim; `order_no` ve `order_date` birlikte;
  3. `GET /e_invoice_inboxes?filter[vkn]=`: posta kutusu varsa e-Fatura, yoksa e-Arşiv;
  4. `POST /e_invoices` (ilişki adı `invoice`) ya da `POST /e_archives` (ilişki adı `sales_invoice`). e-Arşiv'de internet satışında `internet_sale` (adres, ödeme tipi `KREDIKARTI/BANKAKARTI | EFT/HAVALE | KAPIDAODEME | ODEMEARACISI`, ödeme aracısı, ödeme tarihi) ve kargolu satışta `shipment` (taşıyıcı unvanı, VKN, tarih) zorunlu;
  5. iki çağrı da bir `trackable_jobs` kaydı döner: `pending | running | done | error`, hatalar metin dizisi. Kayıt numarası 15 dakika kullanılabilir. Sonra fatura `?include=active_e_document` ile okunur;
  6. PDF: `GET /e_archives/{id}/pdf` ya da `/e_invoices/{id}/pdf`. Hazır olana kadar 204 döner. Hazır olunca 1 saat geçerli bir adres döner; bu adres müşteriye verilmez, dosya indirilip saklanır.
- **İptal:** yalnızca `DELETE /sales_invoices/{id}/cancel`. e-Arşiv `cancellable_until`'e kadar iptal edilebilir; süreyi Paraşüt'ün belgede verdiği değer belirler (yardım merkezi 7 gün diyor; mağazanın mali müşaviri alıcıya iletimden itibaren 8 gün dedi, 2026-10-31). Gönderen e-Faturayı iptal edemez.
- **Doğrulanamayanlar:**
  - deneme ortamı;
  - 429 yanıtı ve web kancaları (tanımda yok; durum sorgulanarak izlenir);
  - satırın ürün kaydı olmadan kabul edilip edilmediği;
  - iade faturasının asıl faturaya bağlanma biçimi;
  - iptal çağrısının e-Arşivi GİB'de de iptal edip etmediği.

  Bunlar gerçek hesapla ilk denemede doğrulanır. O zamana kadar sahte sunucu tanıma göre davranır.

## Karar

1. **Fatura sağlayıcısı mağaza ayarıdır.** Ayarlar > E-Fatura'da şu seçenekler var:
   - `parasut`: faturayı sistem Paraşüt'te keser.
   - `external`: mağazanın kendi programı keser ve sonucu sisteme geri yazar. Elle işlemek de bu seçenektir (Luca).
   - `none`: kapalı.
   - `fake`: yalnızca geliştirme ve testte seçilebilir.

   Kendi UBL'imiz ve doğrudan entegratör sonraki aşamadır (F17'de bir entegratörle bayilik gündeme gelirse); aynı arayüze yeni bir sağlayıcı olarak eklenir.
2. **`einvoice` modülü ve fatura kaydı.**
   - Alanlar:
     - sipariş, tür (`sale | return`) ve kaynak (satışta sipariş; iadede iade talebi ya da iade defteri kaydı);
     - sağlayıcı ve belge tipi (`e_invoice | e_archive`, öğrenilene kadar boş);
     - durum (`pending`: bekliyor; `issuing`: programda sürüyor; `issued`; `failed`; `cancelled`);
     - Paraşüt'teki fatura ve e-belge kimlikleri, iş kaydı ve başladığı an;
     - fatura numarası, ETTN, kesim zamanı, iptal edilebileceği son an;
     - deneme sayısı, sonraki deneme zamanı, son hata kodu;
     - PDF'in özel depodaki dosyası;
     - toplamlar (KDV hariç, KDV, genel toplam; mutabakat için).
   - Tekillik (sipariş, tür, kaynak) üzerindedir. Aynı sipariş için ikinci satış faturası oluşamaz (KK3).
   - Kayıtta kişisel veri yoktur. Alıcı bilgisi gönderim anında siparişten ve fatura profilinden okunur. VKN ve TCKN yalnızca o an açılır (F11'deki gibi).
3. **Faturanın içeriği bizde hesaplanır.** `lib/invoicing` sağlayıcıdan bağımsız bir fatura taslağı üretir:
   - satırlar: ürün adı ve varyant, miktar, KDV hariç birim fiyat, KDV oranı, tutar olarak indirim;
   - kargo bedeli ve kapıda ödeme bedeli ayrı satır;
   - alıcı (kişi ya da şirket, kimlik, vergi dairesi, adres, e-posta);
   - internet satışı bilgileri (vitrin adresi, ödeme tipi, ödeme aracısı, ödeme tarihi);
   - gönderim (taşıyıcının unvanı ve VKN'si, gönderim tarihi);
   - sipariş numarası ve tarihi.

   Tutarlar F4.7 kalem paylarından ve sunucuda hesaplanır; istemciden tutar alınmaz. Paraşüt'ün toplamıyla kuruş farkı kayda geçer ve panelde gösterilir; hangi toplamın esas olduğu mali müşavire soruldu. Varsayılanlar (TCKN'siz alıcıda `11111111111`, kargo ve kapıda ödeme bedeli %20 KDV'li satır, indirim kalemde) mali müşavir cevaplarına göre değişir.
4. **Sağlayıcı arayüzü (`InvoiceProvider`):**
   - `start(taslak)`: Paraşüt'te müşteriyi bulur ya da açar, satış faturasını açar, posta kutusuna bakar ve e-belgeyi başlatır. İş kaydını döner.
   - `check(ref)`: bekliyor, kesildi (numara, ETTN, iptal sınırı) ya da başarısız (kod).
   - `pdf(ref)`: dosya ya da "henüz hazır değil".
   - `cancel(ref)` ve `healthCheck()`.

   Her uzak adımın sonucu hemen kayda yazılır. Yeniden deneme kaldığı yerden sürer: satış faturası açılmışsa yeniden açılmaz, e-belge başlamışsa yeniden başlatılmaz.
5. **Paraşüt bağlantısı (ADR-0027):**
   - İstemci kimliği ve sırrı platformundur ve ortamdan okunur (`PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`), Google bağlantısındaki gibi.
   - Mağaza firma numarasını panelden girer ve Paraşüt'e bağlanır. Önerilen yol yetki kodu akışıdır: Paraşüt'ün sayfası açılır, verdiği kod panele yapıştırılır. Böylece mağazanın Paraşüt parolası bizde tutulmaz.
   - Paraşüt bu akışı platform istemcisine açmazsa parola akışına geçilir: ayrı bir API kullanıcısı açılır, parolası `integration-credentials`'ta şifreli tutulur.
   - Jetonlar `einvoice` modülünde (`parasut_connection`) `PII_ENCRYPTION_KEY` ile şifreli saklanır, sağlayıcı hesaplarında (`integration-credentials`) değil: yenileme jetonu her kullanımda değiştiği için iki saatte bir yazılır. Yenileme satır kilidi altında yapılır; iki süreç aynı yenileme jetonunu harcamaz.
   - Paraşüt bir erişim jetonunu süresinden önce reddederse (401) bir kez zorla yenilenir; başka süreç zaten yenilediyse yeniden yenilenmez.
   - Yenileme reddedilirse bağlantı "koptu" olur ve panel yeniden bağlanmayı ister.
   - Bağlanma ve kaldırma yalnızca sahibin ve yeniden kimlik doğrulamalıdır; bağlantıyı denemek yöneticiye de açıktır. Yapıştırılan kod iş akışı girdisine girer ama tek kullanımlıktır ve ilk çağrıda harcanır; jetonlar iş akışı kaydına hiç girmez.
6. **İstemci (`lib/clients` tabanı):**
   - zaman aşımı, yeniden deneme ve günlüklerde redaksiyon (alıcı verisi ve jeton yazılmaz);
   - mağaza başına 10 saniyede 10 istek sınırı (Redis), 429 ve 5xx'te artan aralıkla bekleme;
   - yalnızca `api.parasut.com`'a gider.
   - PDF adresi yalnızca HTTPS ve izinli bir alan adındaysa indirilir. Alan adı ilk gerçek denemede görülüp izin listesine yazılır; o zamana kadar yalnızca Paraşüt'ün kendi alan adı.
7. **Akış:**
   - **`invoice-issue` iş akışı:** taslağı kur, tekilliği denetle, sağlayıcıyla başlat, kaydet. Girdisi yalnızca kimliklerdir; kişisel veri iş akışı kaydına girmez (F13'ten ders).
   - **`invoice-check` işi** dakikada bir çalışır. Bekleyen işleri sorar. 15 dakikayı geçen işte faturanın etkin e-belgesine bakar. Kesilen faturanın PDF'ini özel depoya indirir. Müşteriye e-postayla bildirir; PDF sipariş sayfasından da indirilir.
   - **Hata siparişi bozmaz.**
     - Fatura `failed` olur ve artan aralıkla yeniden denenir.
     - N denemeden sonra panelde uyarı çıkar (KK2).
     - Sonucu bilinmeyen bir başlatma ikinci kez gönderilmez; önce Paraşüt'teki kayıt sorulur.
   - **Telafi:**
     - Resmîleşmemiş satış faturası, e-belge başlatılamadan kalıcı olarak düşerse Paraşüt'ten silinir.
     - Resmîleşmiş bir fatura iş akışı hatasında kendiliğinden iptal edilmez. Vergi belgesidir; iptali yalnızca kural (iptal edilen sipariş) ya da personel başlatır.

     "Dış servis çağıran her adımın telafisi olur" kuralına bu bilinçli bir istisnadır.
8. **Tetikleme:** Mağaza ayarı sipariş onayı (`order.placed`) ya da kargoya verme (`shipment.created`); varsayılan kargoya verme. Havalede ödeme onayı beklenir.
9. **Geri yazma (`external`):**
   - **Bekleyen faturalar:** `GET /admin/invoices?status=pending`. Taslağı da döner. Kapsamı `invoices:read` olan API anahtarlarına açıktır (F11'in kapsamlı anahtarları). Alıcı bilgisi kişisel veri olduğu için bu kapsam ayrıca verilir.
   - **Kesildi bildirimi:** `POST /admin/invoices/:id/issued`, gövdesinde numara, ETTN, belge tipi ve kesim zamanı. Aynı numarayla tekrar gelirse 200, farklı numarayla 409 döner.
   - **PDF:** `POST /admin/invoices/:id/pdf`, yalnızca `application/pdf`, en çok 5 MB, `%PDF-` ile başlamalı. Kapsam `invoices:write`.
   - **Web kancası:** `invoice.requested` olayı F11 web kancalarıyla gider; bağlayıcılar yoklamak zorunda kalmaz.
   - **Panelde "Faturayı elle işle":** numara ve PDF girilir. İlk müşteri (Luca) bunu kullanır.
10. **İptal ve iade:**
    - Faturası kesilmiş sipariş iptal edilince e-Arşiv iptal sınırı içindeyse iptal edilir.
    - Sınır geçtiyse ya da belge e-Faturaysa iade belgesi gerekir. Biçimi mali müşavir cevabına bağlıdır (soru 5.1–5.4): Paraşüt'te `item_type: refund` ya da gider pusulası.
    - Değişimde iade ve yeni satış belgesi düzenlenir.
    - Faturası kesilmiş sipariş düzenlenemez (ADR-0033 §8).
11. **Muhasebe (ADR-0039):** Mağaza hem fatura hem muhasebe için Paraşüt kullanıyorsa satış faturası satış kaydının kendisidir. İleride yazılacak Paraşüt muhasebe adaptörü satışı ikinci kez göndermez; fatura kaydının kimliğini kullanır, yalnızca tahsilatı yazar.
12. **Sahte Paraşüt** (`packages/testing`, `pnpm dev:parasut`):
    - üç token akışı ve dönen yenileme jetonu;
    - müşteri, satış faturası, posta kutusu sorgusu (sabit bir VKN listesi e-Fatura mükellefi sayılır);
    - e-Fatura ve e-Arşiv; birkaç sorguda `pending → running → done` ilerleyen iş kaydı;
    - önce 204 sonra adres dönen PDF; iptal;
    - 10 sn/10 istek aşımında 429;
    - özel değerlerle hata senaryoları (doğrulama hatası, iş hatası, zaman aşımı).

## Bu kararla kapsam ve kabul kriterleri

- **F8.2 (UBL bizde), F8.7 (mükellef listesi bizde) ve F8.8 (PDF bizde)** sonraki aşamaya kaldı.
  - Paraşüt yolunda belge tipini posta kutusu sorgusu, PDF'i Paraşüt verir. PDF bizde saklanır ve bizden sunulur.
  - **KK4** (UBL şema doğrulaması) kendi UBL'imizle birlikte sonraki aşamaya kalır.
  - **KK5** şöyle yorumlanır: Paraşüt kapalıyken fatura beklemede kalır ve yeniden denenir; sipariş akışı etkilenmez. Yerel mükellef tablosu yoktur.
- **KK1** sahte Paraşüt'le testte, gerçek hesapla sunucuya çıkışta işaretlenir. Deneme ortamı doğrulanamadı.

## Önceki karar (2026-10-28, yerini bu karar aldı)

UBL-TR yazıcısı, GİB XSD doğrulaması, entegratörün toplu listesinden beslenen yerel mükellef tablosu, kendi fatura numarası sırası ve UBL'den PDF bizde olacaktı; entegratör yalnızca imza ve iletim yapacaktı. Avantajı entegratör değiştirmenin kolaylığıydı. Bakım yükü (şema, kod listeleri, iade belgesi) ve ilk müşteride karşılığı olmaması nedeniyle ertelendi.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Paraşüt + geri yazma ucu (seçilen)** | UBL, mükellef listesi, PDF ve mevzuat güncellemesi programda; muhasebe kaydı tek yerde; uç her programa açık | Mağaza Paraşüt'e ya da aracıya ayrıca öder; istek sınırı düşük; web kancası yok, yoklama gerekir |
| Kendi UBL'imiz + ince entegratör adaptörü (önceki karar) | Entegratör değişimi kolay; ileride bayilik geliri | En büyük ve en çok bakım isteyen iş; ilk müşteride karşılığı yok |
| Yalnızca geri yazma ucu | En az iş | Paraşüt kullanan mağaza da bir aracı bulmak zorunda kalır |

## Sonuçlar

- F7 KK3 (iade faturası) mali müşavir cevabından sonra kapanır.
- Paraşüt'ten platform istemcisi istenecek (docs/12 satırı). Yetki kodu akışının platform istemcisine açılıp açılmadığı da sorulacak.
- Fatura kayıtları F11 muhasebe aktarımına ve raporlara kaynak olur.

## Uygulama notları (F8, 2026-10-30)

- Fatura kaydı, kuyruğu ve servis üç katmanda: kuyruk (`queue.ts`), kayıt işlemleri (`records.ts`: geri yazma, PDF, yeniden deneme, iptal isteği), Paraşüt bağlantısı (`service.ts`).
- Fatura, açıldığı Paraşüt firmasının numarasını taşır (`company_id`); bağlı firma değişirse o fatura başka firmada izlenmez ve iptal edilmez, personel bakar.
- Paraşüt sayacı sabit 10 saniyelik pencerede 5 istektir: iki pencere arka arkaya gelse de kayan 10 saniyede 10'u geçmez (Paraşüt'ün sayma biçimi belgelenmemiş). Dakikada yaklaşık 3 fatura.
- Sipariş iptali faturaya "iptal istendi" işareti koyar; Paraşüt'le fatura başına konuşan tek yer olan iş onu geri alır (§10). İş ayrıca siparişin iptal edildiğini her adımda kendisi de görür; saat başı tarama kaçan iptalleri de yakalar.
- Müşteriye `order.invoiced` e-postası gider; PDF eklenmez, sipariş sayfasından indirilir (`GET /store/orders/:id/invoice/pdf`).

## Kapanış güvenlik incelemesi (2026-10-30)

Üç bağımsız inceleme (bağlantı ve istemci; kesme akışı; geri yazma ve panel): 1 yüksek, 8 orta, 15 düşük.

- **Yüksek:** Paraşüt'ün yaptığı ama yanıtı okunamayan bir yazma (geçersiz ya da çok büyük yanıt) yeniden gönderiliyordu. Artık yalnızca kesin ret yeniden denenir; sonucu belirsiz her yazma personel için durur. Yazmaların yanıtından yalnızca yeni kimlik okunur.
- **Orta (hepsi düzeltildi):** müşteri ve posta kutusu yalnızca birebir eşleşmeyle alınır; fatura firmasına bağlandı; kira her yazmadan önce yenilenir ve kira kaybolsa da Paraşüt'teki fatura sahiplenilir; test modunda ödenmiş siparişe fatura kesilmez; iptal edilmiş sipariş faturadan önce görülür ve tarama kaçanı yakalar; içerik (alıcı, vergi no) yalnızca bekleyen fatura için verilir ve personel yeniden doğrulanır; reddedilen PDF depoda kalmaz.
- **Düşük (düzeltildi):** PDF yalnızca Paraşüt alan adlarından; platform istemcisi reddi mağaza bağlantılarını koparmaz; yanıtı kaybolan jeton yenilemesi adlandırılır; hata kodları HTTP durumundan; panel PDF yüklemesi CSRF'ten geçer (yalnızca o yol, yalnızca PDF); dosya adı süzülür; PDF operasyon ve salt okunur rollere kapalı; kesim tarihi sınırlı ve numaradaki yılla aynı; PDF yüklemesi kilitli; iptali istenen siparişe e-belge başlatılmaz ve "faturanız hazır" gitmez; geç kalınan iptalde numara saklanır; geri alınamayan kesilmiş fatura iade belgesine bırakılır; bir faturanın beklenmeyen hatası işi durdurmaz; dış programa geri çekilen fatura bildirilir (`invoice.withdrawn`).
- **Sonraya:** numara tekilliği bütün sağlayıcılar için ortak (bir mağaza programını değiştirirse çakışabilir); vergi numarası açılışının müşteri bazındaki denetim kaydı "sistem" diye yazılır (uç düzeyindeki kayıt kişiyi adlandırır); `PARASUT_BASE_URL` yalnızca staging ve production'da reddedilir (diğer sahte sunucu adresleri gibi; dağıtımda `NODE_ENV` zorunlu, F16).

## Ek: mali müşavir cevapları (kullanıcı, 2026-10-31; `docs/mali-musavir-sorulari.md`)

Varsayımların çoğu doğrulandı. Değişenler (kod; her biri testle):
1. **Kapıda ödeme hizmet bedeli** ayrı satır değil, kargo satırına eklenir (2.3).
2. **Varsayılan kesim anı** "sipariş onaylanınca" (4.1). "Kargoya verilince" seçenek olarak kalır.
3. **Kapıda ödemeli sipariş** teslimden sonra faturalanır (4.1); kesim ayarından bağımsız.
4. **e-Arşiv iptali** alıcıya iletimden itibaren 8 gün içinde (5.1). Süre geçtiyse sistem iptal etmez; fatura personelin önüne düşer (muhasebe kaydı uygun belgeyle düzeltilir).
5. **Bireysel müşteri iadesi** gider pusulasıyla (5.2): ilk faturayla ilişkili, yalnızca iade edilen ürün ve miktar, bedel ve KDV ayrı; mağaza kredisine aktarma ayrıca kaydedilir. F8 E6 ve F7 KK3 bununla kapanır.
6. **Ayrı seri** (6.2): sistemin kestiği faturalar mağazanın elle kestiklerinden ayrı bir ön ekle.

**Kullanıcı kararı (2026-10-31): e-Arşiv'in taşıyıcı alanı boş gitmez.** Fatura sipariş onayında kesildiğinde paket henüz çıkmamıştır. Taşıyıcı, müşterinin ödemede seçtiği kargo seçeneğinin firmasından alınır; unvan ve VKN mağazanın bir kez girdiği değerdir (Ayarlar > E-Fatura). Gönderim tarihi faturanın kesildiği gündür. Paket çıktıktan sonra kesilen fatura, paketin firmasını ve çıkış gününü yazar. Firma bilgisi girilmemişse fatura `einvoice.carrier_identity_missing` ile bekler (`workflows/einvoice/draft-source.ts` `shipmentOf`).

**Ayrı seri (mali müşavir 6.2, 2026-10-31):** mağaza Ayarlar > E-Fatura'da web satışlarının serisini (GİB numarasının ilk 3 karakteri) girer. Elle işlenen ya da dış programın geri yazdığı numara bu seriyle başlamazsa `einvoice.series_mismatch` (400) ile reddedilir; taslak ekranı hangi seriyle kesileceğini söyler. Paraşüt'te seri Paraşüt'ün kendi e-belge ayarından seçilir, API'den gönderilmez (Paraşüt'e sorulacaklar listesinde).
