# ADR-0072: BirFatura çekme entegrasyonu: siparişleri BirFatura çeker, güvenli giriş noktası

- **Durum:** Kabul (sahip, 2026-11-16: "A yolu"; 2026-11-18: BirFatura'ya soru gönderilmez, açık sorular belgelerden cevaplanır, kalanlar test hesabıyla denenir).
- **Tarih:** 2026-11-18
- **İlgili:** ADR-0034 (e-fatura altyapısı; bu karar §1 ve §9'u değiştirir), ADR-0027 (sağlayıcı hesapları), ADR-0039 (dış API, kapsamlı anahtarlar), ADR-0040 (roller, yeniden doğrulama), ADR-0011 (denetim kaydı), ADR-0041 (KVKK); `docs/entegrasyonlar/birfatura.md` (araştırma, belgeden alıntılı cevaplar, test adımları), `docs/entegrasyonlar/plan-basitkargo-birfatura.md` (dilimler F0–F3), `docs/04-guvenlik.md`.

## Bağlam

Sahip mağaza faturalarının BirFatura'da da kesilebilmesini istedi (2026-11-16). BirFatura'nın iki herkese açık API'si ters yönde çalışır (`birfatura.md` "Kritik bulgu"):

- **Özel Entegrasyon API (çekme):** servisleri biz yazarız, BirFatura mağaza ayarındaki "web sitesi adresine" `POST` atar, başlıkta `token` taşır. Beş uç: `orderStatus`, `paymentMethods`, `orders` (zorunlu), `orderCargoUpdate`, `invoiceLinkUpdate` (isteğe bağlı). Faturayı BirFatura keser; UBL, mükellef sorgusu ve GİB'e iletim ondadır. ikas, Ticimax ve Shopify'ın bağlandığı yoldur.
- **OutEBelgeV2 (itme):** biz BirFatura'ya belge göndeririz (Paraşüt gibi). Modeli e-Arşiv'in internet satışı bilgilerini (ödeme tarihi, aracı, taşıyıcı VKN'si) taşımıyor; eksikse kendi UBL'imizi ister.

Portalın açtığı dört belge 2026-11-18'de tam okundu; on açık sorunun belgelerin cevapladığı kısmı `birfatura.md`'de alıntı ve adresle yazılı. BirFatura test hesabı verdi; girişi sahipte, kod hiçbir kimlik bilgisini görmez.

## Karar

### 1. Yön: çekme (A); itme (B) koşullu kalır

- **Neden çekme:** e-Arşiv'in internet satışı bilgileri ve UBL uyumu BirFatura'nın sorumluluğunda kalır; bizim işimiz siparişi doğru vermektir. Mevcut `external` modunun (ADR-0034 §9: kuyruk, bekletme kuralı, taslak, geri yazma, seri denetimi, iptal işaretleri) üstüne ince bir çevirici olarak oturur; yeni kuyruk, yeni iş, yeni yeniden deneme yoktur. Mağaza BirFatura'yı pazaryerleri için de kullanıyorsa bütün kanallar tek panelde kalır.
- **Bedeli:** iptali BirFatura'ya bildiremeyiz (kesilmiş e-Arşiv'i personel BirFatura'da iptal eder, `external`'daki gibi); ETTN ve belge tipi bize dönmez; kişisel veri bizden **gelen bir istekle** çıkar (aşağıda §3 bunun için).
- **İtme (F3)** yalnız iki şart doğrulanırsa yapılır: model internet satışı bilgilerini taşıyor ve kendi e-Arşiv'imizi `SendDocumentAnswer IPTAL` ile iptal edebiliyoruz. Belge ikincisini "Size gelen e-belgeler" bağlamında anlatıyor; test hesabıyla denenecek.

### 2. Sağlayıcı ve kayıt

- Ayarlar > E-Fatura'ya yeni değer: `birfatura` (`INVOICING_PROVIDERS`). Davranışı `external`'dır; ek olarak gelen uçları açar ve `invoice.requested` web kancası gitmez (BirFatura yoklar).
- Fatura kaydının sağlayıcısı da `birfatura` olur (migration, `invoice.provider`). Böylece mağaza programını değiştirirse eski programın bekleyen kayıtları BirFatura'nın listesine düşmez (çift fatura riski). "Dışarıda kesilen" sağlayıcılar (`external`, `birfatura`) tek listede tutulur: iş onları almaz, geri yazma, PDF, taslak ve iptal kuralları ikisine de uygulanır; panelde personel BirFatura faturasını da elle işleyebilir (yedek yol).
- Kayda yeni sütun `reported_at`: BirFatura'nın bir sipariş için fatura bildirdiği ilk an. Bildirim gelir gelmez, geri yazma denetimlerinden **önce** ve ayrı yazılır; dolu kayıt bir daha listelenmez (§6).
- Kayda yeni sütun `listed_at`: `orders` cevabının kaydı BirFatura'ya ilk verdiği an. O andan sonra fatura BirFatura'da kesilmiş olabilir; sipariş iptalinde kayıt sessizce iptal edilmez (§6). **Önce damga, sonra cevap:** `orders` vereceği kayıtları cevaptan önce tek cümlede damgalar (`listed_at = COALESCE(listed_at, now)`, yalnız `pending`, bildirilmemiş ve iptali istenmemiş olanlar, `RETURNING id`) ve yalnız damganın tuttuklarını verir; sonra denetim kaydı, sonra cevap. Liste ile damga arasına düşen iptal kazanır (kayıt verilmez); damgadan sonra gelen iptal kaydı personele işaretler. Denetim kaydı yazılamazsa 503 döner, damgalar kalır: yalnız sonraki iptali temkinli yapar (güvenlik incelemesi S-1). Bekleme listesi için dizin `IDX_invoice_birfatura_due` (sağlayıcı, tür, durum, `reported_at`, `created_at`).
- **Paket askısı:** beş uç plan korumasında **açıktır** (`lib/plan-guard`, `outside-admin` kararı `open`): yapılmış satışın faturası VUK yükümlülüğüdür, askıdan bağımsız sürer.

### 3. Gelen ucun güvenlik modeli

Bu uçlar BirFatura'nın değil bizim web kancamızdır ve **alıcının adını, adresini, telefonunu, e-postasını, TCKN ya da VKN'sini** döndürür. Ödeme web kancalarından sıkı tutulur.

1. **Token'ı sunucu üretir.** Sahip panelde "bağlantı anahtarı oluştur" der; sunucu 128 bit rastgele değer üretir (`crypto.randomBytes(16)`, GUID biçiminde yazılır; BirFatura "GUID token" ister). Değer **bir kez** gösterilir, BirFatura'da mağaza ayarının "API Şifresi" alanına yapıştırılır. Yeniden okunamaz; kaybolursa yenilenir.
2. **Saklama:** `integration-credentials` içinde `birfatura` sağlayıcısı, gizli alan `token`, ADR-0027'nin zarf şifrelemesiyle (AES-256-GCM, KEK halkası). Genel sağlayıcı hesabı ucu bu sağlayıcıyı kabul etmez (404, Google gibi): elle yazılmış bir token sunucunun ürettiği değer olmaz.
   - **HMAC özeti yerine şifreli tutulma nedeni:** hesap altyapısı (anahtar döndürme, yeniden şifreleme, geri alma, bildirim) olduğu gibi kullanılır; token her istekte zaten açılıp karşılaştırılır. Özet daha az şey sızdırırdı ama ikinci bir saklama yolu açardı; sızan bir veritabanı yedeği KEK olmadan token vermez.
3. **Yalnız sahip ve yeniden doğrulamayla** (ADR-0040, `OWNER_ONLY` ve `requireReauth`). Oluşturmak ile yenilemek aynı çağrıdır: yenisi kaydedilince eskisi hemen geçersizdir. Yalnız fatura programı BirFatura seçiliyken üretilir; başka program seçiliyken uç **409** döner (`einvoice.birfatura_not_selected`): kullanılmadan bekleyen token olmaz. Her değişiklik **bütün yöneticilere** bildirilir (ADR-0027 §6; zil, "BirFatura hesabı değişti").
   - **Program değişince token silinir:** fatura programı BirFatura'dan başka birine (ya da "yok"a) alınınca kayıtlı token aynı iş akışında silinir (`updatePlatformSettingsWorkflow`, `leftBirfatura`; yöneticiler bilgilendirilir). BirFatura yeniden seçilirse sahip yeni token üretir; eski token hiçbir zaman kendiliğinden geri gelmez. Genel sağlayıcı hesapları listesinde de görünmez, yalnız `/admin/einvoice/birfatura`'da.
4. **Karşılaştırma sabit zamanlıdır** (`lib/security` `safeEqual`: iki tarafın SHA-256 özeti `timingSafeEqual` ile). Başlık eksikse de karşılaştırma yapılır; eksik ve yanlış aynı cevabı (401, gövde boş) aynı sürede alır.
5. **Token yalnız `token` başlığında** kabul edilir; sorgu dizgisinde ya da gövdede aranmaz. Hiçbir yanıtta, logda ya da denetim kaydında yer almaz (yalnız oluşturma cevabında bir kez). Loglarda gövde de yoktur.
6. **Sağlayıcı `birfatura` değilse ya da token hiç oluşturulmadıysa** beş uç da **404** döner: uç var olduğunu söylemez.
7. **Hız sınırı:** token'a bakılmadan önce IP başına dakikada 60 (`einvoice_pull`); koruyucudan **sonra**, yalnız token'ı doğru istekler sayılarak mağaza başına (bütün IP'ler) dakikada 120 (`einvoice_pull_shop`): token'sız bir sel BirFatura'nın payını tüketemez (güvenlik incelemesi S1). Ayrıca **başarısız token** IP başına ayrı sayılır: dakikada 10 yanlıştan sonra o IP, doğru token'la bile, pencere bitene kadar 429 alır (`einvoice_pull_auth`).
8. **Gövde en çok 16 KB**, Zod şeması (`validateAndTransformBody`): belgelenen alanlar zorunluluk ve tipiyle denetlenir; belgede olmayan alan yok sayılır (okunmaz, 400 değil: dış çağıranın eklediği bir alan faturalamayı durdurmasın). Tarih aralığı en çok 31 gün, yanıt en çok 100 sipariş (fazlası sonraki çekmede).
9. **Her çekme denetim kaydına yazılır** (`sensitive_read`, aktör `system`/`birfatura`, IP, istek kimliği; kaç sipariş, hangi fatura ve sipariş kimlikleri; kişisel veri yok). Kayıt yazılamazsa çekme **503** ile reddedilir (F2 kuralı: kişisel veri izsiz verilmez). `invoiceLinkUpdate` de `mutation` olarak kaydedilir.
10. **Yalnız satış faturası bekleyen siparişler** döner: tür `sale`, sağlayıcı `birfatura`, durum `pending`, iptal istenmemiş, bildirilmemiş. İade belgeleri ve faturası istenmeyen siparişler (bekletme kuralı: test ödemesi, TL dışı, ödeme/kargo/teslim bekleyen, yalnız hediye kartı) hiç kuyruğa girmediği için hiç dönmez.
11. **PDF yalnız izinli alan adından** indirilir: HTTPS, `birfatura.com` ve alt alanları (belgenin `invoiceLinkUpdate` örneği `https://uygulama.birfatura.com/dosyagetir?tur=1&guid=ornek.pdf`, diğer belgeler `test1.birfatura.com/dosyagetir`; ilk test faturasının gösterdiği ada daraltılır), `lib/security` `safeFetch` ile (DNS sonrası adres denetimi, bağlantıya sabitleme, yönlendirme yalnız aynı köken), en çok 5 MB, `%PDF-` ile başlamalı. Yerel sahte BirFatura (`BIRFATURA_BASE_URL`, yalnız development ve test; canlıda ortam denetimi reddeder) doğrudan okunur.
12. **Yalnız HTTPS** (F16 vekili). IP izin listesi ilk sürümde yok: API belgesinde IP yok, altyapı rehberleri farklı listeler veriyor (`birfatura.md` soru 2). Test hesabıyla gelen adresler kararlı çıkarsa F16'da nginx'te isteğe bağlı liste olur; o zaman da token tek savunma olmaktan çıkmaz.

### 4. Adres ve yönlendirme

- Uçlar Medusa dosya rotası: `apps/backend/src/api/hooks/birfatura/api/<uç>/route.ts`, yani `https://<mağaza-api>/hooks/birfatura/api/<uç>`. `/hooks` Medusa'nın oturum ara katmanından geçmez.
- BirFatura'ya girilecek "web sitesi adresi": `https://<mağaza-api>/hooks/birfatura` (sonda eğik çizgi yok). Belgede tam adres taban adresle yolun birleşimi (`baseUrl` + `/api/orderStatus`); önekli tabanı açıkça ne kabul ne ret ediyor.
- **Önekli adres kabul edilmezse** (test hesabıyla görülür) kod değişmez: F16'da mağazaya alt alan adı açılır ve nginx yalnız beş yolu yeniden yazar: `https://birfatura.<mağaza-api>/api/(orderStatus|paymentMethods|orders|orderCargoUpdate|invoiceLinkUpdate)` → `/hooks/birfatura/api/$1`; o alt alanda başka her yol 404. Panel BirFatura kartında hangi adresin yazılacağını gösterir (F2).
- Yerel deneme: yalnız `/hooks/birfatura/api/*` yollarını açan geçici tünel (`birfatura.md` "Test hesabıyla deneme adımları").

### 5. Eşleme (taslak → `Orders[]`)

- Taslak sağlayıcıdan bağımsızdır (`lib/invoicing/draft.ts`); tutarlar sunucuda kalem paylarından gelir, istemciden hiçbir tutar alınmaz. Eşleme saf fonksiyondur (`lib/invoicing/birfatura/map.ts`), alan adları belgedeki şemayla büyük/küçük harf dahil birebirdir; sözleşme testi belgenin örneklerini sabit olarak kullanır.
- `OrderId`: ilk satış faturasında siparişin `display_id`'si. **Değişim faturası** aynı siparişin ikinci satışıdır (ADR-0034 E6b), ayrı kimlik alır: `10^12 + display_id × 100 + n` (n, siparişin değişim faturaları arasındaki sırası, 1–99), `OrderCode` `<no>-D<n>`. İki aralık çakışmaz; kimlik kararlıdır ("Aynı sipariş tekrar dönecekse aynı OrderId ve OrderCode kullanılmalıdır").
- Tarihler `dd.MM.yyyy HH:mm:ss`, İstanbul saati (UTC+3). Tutarlar sayıdır, yuvarlanmaz: birim fiyat taslaktaki 4 ondalıkla; KDV dahil birim `birim × (1 + oran)`, satır indirimi birim başına (`DiscountUnitTax*`). Kargo ve kapıda ödeme bedeli (kargo satırının içinde, ADR-0034 Ek 1) `ShippingChargeTotalTax*`'a; `ProductsTotal*` kalemlerin indirim sonrası toplamı; genel indirim 0 (taslak indirimi kalemlere dağıtıyor). BirFatura'nın toplamı farklı çıkarsa fark ilk test faturasında görülür.
- Ödeme kimlikleri sabittir, değişmez (BirFatura eşlemeyi saklar): 1 kart, 2 havale/EFT, 3 kapıda ödeme, 4 hediye kartı, 5 diğer. Durumlar: 1 "Faturaya hazır" (yalnız bu durum sipariş döndürür), 2 "Faturalandı", 3 "İptal edildi". Metinler sunucunun Türkçe metin tablosundan.
- `ProductId` varyant kimliğinden kararlı 53 bitlik sayı (SHA-256'nın ilk 52 biti + 1), `ProductCode` SKU ya da varyant kimliği. Telefon yoksa (fatura ve teslimat adresinde) sipariş atlanır ve kayda `einvoice.phone_missing` yazılır; uydurma numara yazılmaz. Taslağı kurulamayan sipariş de atlanır, sorun kodu kayda yazılır, diğerleri döner.

### 6. Geri yazma (`invoiceLinkUpdate`); ADR-0034 §9 değişikliği

- Belge: `orderId` ve `faturaUrl` zorunlu, `faturaNo` ve `faturaTarihi` isteğe bağlı ("PDF bağlantısı ve varsa fatura numarası/tarihi"). ETTN ve belge tipi hiç gelmez.
- **ADR-0034 §9 değişir:** geri yazma (`recordWriteBack`, `POST /admin/invoices/:id/issued`) **boş belge tipini** kabul eder; belge tipi ve ETTN "öğrenilene kadar boş" kalır (§2'deki kural). Var olan değer boş gelenle silinmez.
- Akış (`workflows/einvoice/birfatura-link.ts`): sipariş `orderId`'den bulunur → `reported_at` yazılır (önce, ayrı) → numara geldiyse mevcut geri yazma iş akışı çalışır (seri denetimi `einvoice.series_mismatch`, numara biçimi ve yılı, aynı numara: değişiklik yok, farklı numara: ret) → PDF izinli adresten indirilir, özel depoya yazılır, mevcut PDF iş akışıyla kayda bağlanır ve müşteriye "faturanız hazır" gider. Kaydın PDF'i zaten varsa yeniden gelen bildirim (tekrar ya da başka bağlantıyla) PDF'i indirmez ve değiştirmez (güvenlik incelemesi S2); yalnız indirmesi başarısız olmuş PDF sonraki bildirimde yeniden denenir. Aynı anda gelen iki bildirimde de tek PDF kalır: BirFatura yolu PDF'i "yalnız boşsa" bağlar (`attachPdf` `onlyIfEmpty`, satır kilidi altında denetlenir); geç kalan bildirimin indirdiği dosya silinir ve cevabı yine `Success: true` olur. Personelin panelden yüklediği PDF bu kurala tabi değildir. Siparişi iptal edilmiş kaydın personel işareti (`einvoice.return_document_needed`) sonraki geri yazmada silinmez (güvenlik incelemesi S-2).
- Cevaplar: işlenen bildirim `{ Success: true }`; iş kuralı reddi (bilinmeyen sipariş, farklı numara, seri uyuşmazlığı, geçersiz numara) HTTP 200 ve `{ Success: false, Message }` (belgede yalnız 200 örneği var; `Success` onların bayrağı), sorun kodu kayda yazılır, panelde görünür.
- PDF indirilemezse numara yine yazılır, cevap `Success: false` olur: BirFatura aynı bildirimi yeniden gönderirse aynı numara değişiklik saymaz ve PDF yeniden denenir. Yeniden göndermezse (belgede yazmıyor) personel PDF'i panelden yükler (kayıtta `einvoice.pdf_download_failed`).
- Numara gelmezse kayıt kesilmiş sayılmaz: `reported_at` yazılır, kayda `einvoice.number_missing`, cevap `Success: true`; personel numarayı ve PDF'i panelden girer.
- **Çift fatura önlemi:** `reported_at` dolu kayıt bir daha listelenmez; geri yazma sonradan reddedilse de (seri, numara çakışması, veritabanı) sipariş BirFatura'nın önüne ikinci kez düşmez, personelin önüne düşer.
- `orderCargoUpdate` kabul edilip yok sayılır (`Success: true`): kargo bizim taşıyıcılarımızla gider, ikinci bir takip kaynağı durumları bozmasın. Kimlikler dışında hiçbir şey loglanmaz. **Ek 2026-11-26 ile değişti:** mağaza kargoyu BirFatura'dan yönetiyorsa takip numarası siparişi kargoya verir (aşağıda).
- **Sipariş iptali:** BirFatura'ya hiç verilmemiş (`listed_at` boş) ve bildirilmemiş bekleyen kayıt `cancelled` olur ve listeden düşer. Kesilmiş, bildirilmiş ya da **listelenmiş ama bildirilmemiş** kayıt sessizce iptal edilmez: "iade belgesi gerekiyor" işaretini alır (bekleyen kayıtta ayrıca `cancel_requested_at`, böylece bir daha listelenmez), personele bildirilir ve BirFatura'da faturanın kesilip kesilmediğine bakar (güvenlik incelemesi S3); personel BirFatura'da e-Arşiv'i 8 gün içinde iptal eder ya da iade belgesi düzenler (ADR-0034 Ek 4, `external` gibi).

### 7. Telafi

- `orders` okumadır; yalnız verdiği kayıtlara `listed_at` damgalar (ilk sefer, geri alınmaz: veri BirFatura'ya gitmiştir); telafi gerekmez. Okumanın izi yazılamazsa okuma olmaz (§3.9).
- Token oluşturma: kayıt adımı önceki hesabı saklar, bildirim yazılamazsa eski token geri konur (mevcut `integration-credentials` adımları).
- PDF: indirme ve depoya yazma tek adımdır; sonraki adım düşerse dosya silinir. `reported_at` ve yazılmış numara geri alınmaz: BirFatura'da kesilmiş bir vergi belgesinin izidir (ADR-0034 §7'nin bilinçli istisnasıyla aynı gerekçe).

### 8. KVKK

`docs/kvkk-envanter.md`'ye satır: BirFatura'ya (çekme isteğiyle) alıcının adı/unvanı, fatura ve teslimat adresi, cep telefonu, e-postası, TCKN ya da VKN ve vergi dairesi, sipariş kalemleri ve tutarları gider; amaç vergi belgesi düzenleme ve GİB'e iletim; hukuki sebep kanuni yükümlülük (VUK, KVKK md. 5/2-ç); yer yurt içi (doğrulanmadı); her çekme denetim kaydında. Token mağazanın hesap erişimidir, kişisel veri değildir (`integration-credentials` satırı değişmez).

## Açık sorular (test hesabıyla denenecek)

Belgelerin söylemedikleri; cevapları ve alıntıları `birfatura.md` "Açık soruların cevapları"nda.

1. Kendiliğinden çekmenin aralığı (belge "belirli aralıklarla" diyor).
2. Yol önekli "web sitesi adresi" kabul ediliyor mu (kabul edilmezse §4'teki alt alan adı); çağrıların geldiği IP'ler.
3. Aynı `OrderId` ikinci kez çekilirse BirFatura yeniden fatura keser mi; `Success: false` dönen `invoiceLinkUpdate` yeniden gönderilir mi.
4. PDF bağlantısının gerçek alan adı ve geçerlilik süresi (izin listesi daraltılır).
5. e-Arşiv'in internet satışı bilgileri (ödeme tarihi, aracı, taşıyıcı VKN'si, gönderim tarihi) BirFatura'da nereden dolduruluyor (ilk test faturası, mali müşavir).
6. Değişim faturasının ayrı `OrderId`'yle kabulü; `ProductId`'nin ürün eşlemesinde kullanılıp kullanılmadığı.
7. BirFatura'nın alıcıya e-Arşiv e-postası atıp atmadığı ve kapatılabilirliği (bizim `order.invoiced` ile çift ileti).
8. `ProductsTotal*` ve `DiscountUnit*`'in BirFatura toplamında beklediğimiz gibi işlenmesi.
9. İtme yolu (F3): kendi e-Arşiv'imizin `IPTAL`'i; hız sınırı ve kontör.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Çekme, sunucunun ürettiği şifreli token (seçilen)** | BirFatura'nın altyapılarla çalıştırdığı yol; mevzuat yükü onda; mevcut `external` akışının üstüne ince | Kişisel veri gelen istekle çıkar (token tek savunma); iptal bildirilemez; ETTN gelmez |
| Çekme, token yalnız HMAC özetiyle | Veritabanı sızıntısında token hiç çıkmaz | İkinci saklama yolu; anahtar döndürme ve bildirim altyapısı yeniden yazılır |
| Yalnız itme (OutEBelgeV2) | Akış bizde; ETTN ve iptal bizde | Model e-Arşiv internet satışı bilgilerini taşımıyorsa kendi UBL'imiz (büyük iş); mağazanın iki anahtarı ve platform anahtarı |
| `external` + mağazanın kendi aracısı | Hiç kod yok | Mağaza BirFatura'ya bağlanacak bir program bulmak zorunda |

## Sonuçlar

- F1: uçlar, eşleme, token, hız profili, denetim kaydı, PDF indirme, migration (`invoice.provider`, `reported_at`, `listed_at`, `IDX_invoice_birfatura_due`), birim, HTTP ve sözleşme testleri. F2: sahte BirFatura (bizi çeken istemci + PDF sunucusu), panel kartı (seçim, adres, token bir kez gösterim, son çekme). F3 koşullu.
- Güvenlik incelemesi zorunlu (kişisel veri veren gelen uç, kimlik doğrulama); bulgular PR'a yazılır.
- `BIRFATURA_BASE_URL` yeni ortam değişkeni (yalnız development ve test).
- **Ek (2026-11-18):** sahibin kararıyla yerel sahte BirFatura (F2'deki istemci + PDF sunucusu, `pnpm dev:birfatura`) yazılmadı. Yerel deneme gerçek test hesabıyla, yalnız beş ucu açan geçici tünel üzerinden yapılır (`birfatura.md` "Test hesabıyla deneme adımları"). CI kapsamı HTTP testlerinde kalır (`integration-tests/http/einvoice-birfatura*.spec.ts`; BirFatura'nın çağrılarını ve PDF dosya sunucusunu taklit eder). F2 yalnız panel kartı ve sipariş fatura kartıdır.

## Ek 2026-11-26: kargoyu BirFatura'dan yönetmek

**Bağlam.** Geliver kaldırıldı (PR #460, ADR-0031 eki); taşıyıcılar mağazanın kendi anlaşmasıyla doğrudan Aras ve Yurtiçi (ADR-0035). Sahip: BirFatura'ya abone olan mağaza BirFatura'nın kargo modülünü (bütün firmalar) de alıyor; bu mağaza etiketini BirFatura'da basmak isteyebilir. Özel Entegrasyon API bunun için `orderCargoUpdate`'i zaten veriyor (adım 4: "kargo anlaşması BirFatura'daysa takip bilgisini bize yazar").

**Karar.**

1. **Tek soru, Ayarlar > Kargo:** "Kargoyu nereden yönetiyorsun?" `shipping.manager`: `own` ("Kendi anlaşmam (Aras / Yurtiçi)", varsayılan, hiçbir şey değişmez) ya da `birfatura`. Etkin kip `manager = birfatura` **ve** `invoicing.provider = birfatura` (`lib/shipping/manager.ts birfaturaShipsWith`); saklanan seçim programdan uzun yaşamaz.
   - **Seçilebilirlik:** yalnız BirFatura bağlıyken (program BirFatura ve token oluşturulmuş; kapının sorduğu iki şey). Değilse ayar iş akışı `shipping.birfatura_not_connected` (400) ile reddeder (`assertShippingManagerStep`), panel seçeneği soluk gösterir ve nedenini, nereye gidileceğini söyler (engel değil uyarı; sunucu reddi bozuk çıktıyı önlemek için: bağlı olmayan BirFatura sipariş çekemez, kargolayamaz). Saklanan değeri aynen yollayan kayıt geçer.
   - **Yalnız sahip:** fatura anını ve etiket yolunu değiştirdiği için `manager` yalnız sahibin (403 `shipping.manager_owner_only`; bölümün geri kalanı yöneticinin de), fatura programı gibi. Panelde sahip değilse seçenekler kapalı ve nedeni yazılı.
   - **Program değişince:** fatura programı BirFatura'dan başka birine alınınca aynı iş akışında `manager` `own`'a döner (`resetShippingManagerStep`, telafisi bölümü geri koyar), token silinmesiyle birlikte (§3.3). BirFatura yeniden seçilirse kargo kipi kendiliğinden geri gelmez.
2. **Döngüsel bağımlılık (fatura anı):** BirFatura'nın kargo modülü yalnız bizden çektiği siparişi kargolar; "kargoya verilince" kesimde sipariş kargoya verilmeden BirFatura'ya hiç gitmezdi, kapıda ödemede de teslimden önce (ADR-0034 Ek: kapıda ödeme teslimde faturalanır). **Kural:** BirFatura kargoyu yönetirken bekletme kuralı (`lib/invoicing/hold.ts invoiceDue`) parseli beklemez: sipariş ödemesi alınınca, kapıda ödemede verildiği anda "Faturaya hazır" olur ve `orders` cevabına girer; `trigger` ayarı saklanır ama okunmaz, panelde salt okunur ve nedeniyle gösterilir. Gerekçe: bu kipte "Faturaya hazır" bizim için "BirFatura'ya verilebilir" demektir; faturanın **ne zaman kesileceğine** BirFatura'daki kuralları karar verir (sipariş çekilmesi faturanın kesilmesi değildir; kesim BirFatura'da kural ya da elle). Öteki bekletmeler (iptal, test ödemesi, TL dışı, havale onayı) aynen durur: o siparişler BirFatura'ya gitmez, personel paneldeki "Kargoya ver" ile takip numarası yazarak gönderir. Açık soru (doğrulanmadı): BirFatura çektiği siparişi kendiliğinden faturalıyorsa kapıda ödemenin teslimde faturalanma kuralı BirFatura'daki ayara kalır; mali müşavirle ve test hesabıyla bakılacak. Kip açılmadan önce "kargoya verilince" kuralıyla bekleyen ödenmiş siparişler bir sonraki an olayında ya da saatlik taramada kuyruğa girer; taramanın penceresi dışında kalan eski sipariş personelce elle gönderilir.
3. **`orderCargoUpdate`** (`api/hooks/birfatura/api/orderCargoUpdate/route.ts`, ince; iş `workflows/shipping/birfatura-cargo.ts`):
   - Kip kapalıyken bugünkü gibi kabul edilip yok sayılır (`Success: true`, "Kargo bilgisi alındı.").
   - Kapı, hız sınırları, 16 KB, Zod aynen (§3). Alanlar belgedeki gibi: `orderId` (zorunlu), `orderStatusId` (zorunlu; bu uçtaki anlamı belgede yok, **doğrulanmadı**; denetlenir, kullanılmaz), `cargoTrackingCode` (zorunlu), `cargoTrackingCodeUrl`, `cargoCompany`, `updateDateTime` (isteğe bağlı). Numara panelin elle girişindeki biçime uymalı (harf, rakam, tire, 4–40; boşluklar atılır), uymazsa `Success: false`. Bağlantı düz bir https sayfası değilse (noktalı alan adı, kullanıcı adı/şifre yok, `URL` ile ayrıştırılır, en çok 500) ya da firma adı harf, rakam, boşluk ve `.&'()-` dışında bir şey taşıyor ya da 60 karakteri geçiyorsa bırakılır, kargo yine verilir (güvenlik incelemesi L1, I3).
   - **Eşleme sıkıdır:** `orderId` → `saleRefOf` → siparişin `display_id`'si **ve** o siparişin BirFatura satış faturası kaydı BirFatura'ya verilmiş olmalı (`listed_at` dolu). Numarasıyla bulunan ama BirFatura'ya hiç verilmemiş sipariş "Sipariş bulunamadı." alır. Değişim faturasının kimliği (`10^12 + …`) reddedilir ("Değişim gönderisinin kargosu mağaza panelinden girilir."): değişimin yeni gönderisi iade dönüşüne bağlıdır (ADR-0032 §6), personelin işidir.
   - **İş akışı:** sipariş başına kilit (`shipping:birfatura-cargo:<orderId>`) → karar adımı (salt okuma) → `shipOrderWorkflow` alt iş akışı olarak, `notify: true` ve takip (`carrier` = `cargoCompany`, `number`, `url`): kalan her şey tek koliye (fulfillment), takip numarası, firma adı (`qt_carrier_name`) ve bağlantıyla hand-over (shipment), Medusa'nın `shipment.created` olayıyla müşteriye normal "Kargoya verildi" e-postası. Telafi `shipOrderWorkflow`'un kendisinde (hand-over düşerse koli ve rezervasyon geri alınır).
   - **Tekrar güvenliği:** siparişin iptal edilmemiş bir kolisinde aynı takip numarası (büyük/küçük harf ve boşluk farkı sayılmaz) varsa hiçbir şey yapılmaz, cevap yine `Success: true`: ikinci koli, ikinci e-posta olmaz. Eşzamanlı iki aynı bildirim kilitte sıraya girer, ikincisi ilkinin kolisini görür.
   - BirFatura faturası iptal edilmiş ya da iptali istenmiş (`cancel_requested_at`) siparişin numarası da reddedilir (güvenlik incelemesi I4).
   - **Kapıda ödeme tek koli:** bu kipte de kapıda ödemeli siparişin bir parçası tek başına kargoya verilmez (`shipping.cod_single_parcel`; kurye tutarın tamamını bir kez toplar; güvenlik incelemesi L2).
   - **Kısmi gönderi, birden çok takip numarası (basit kural):** bir takip numarası siparişin **kalan bütün** kalemlerini tek koliyle gönderir. Personel önceden bir koli paketlemiş ama vermemişse numara o koliyi verir, yanında kalan kalemler personelde kalır (`planShipmentStep`'in kuralı; numara hangi koliye ait bilinmiyor). Gönderilecek bir şey kalmamışken gelen **farklı** numara reddedilir (`Success: false`, "Siparişin gönderilecek ürünü kalmamış…"); ikinci numara (ör. BirFatura'da yeniden etiket) personelce düzeltilir. BirFatura'nın kalem bazında bilgi vermediği için parçalı eşleme yapılmaz.
   - **Cevaplar** (`{ Success, Message }`, HTTP 200): işlendi "Kargo bilgisi güncellendi."; ret: bilinmeyen/verilmemiş sipariş, değişim, iptal edilmiş sipariş, geçersiz numara, gönderilecek şey yok, başka bir engel (dolandırıcılık incelemesi, ödeme bekliyor, test ödemesi: `shipOrderWorkflow`'un kendi kuralları) "Kargo bilgisi kaydedilemedi; mağaza panelinde inceleniyor."
   - **Log ve iz:** log yalnız BirFatura sipariş kimliği ve sorun kodu; takip numarası, bağlantı ve alıcı bilgisi hiçbir zaman. Her bildirim denetim kaydına `mutation`, `birfatura.cargo_updated`, kaynak `order` (sonuç ve sorun kodu, kimlikler). Kayıt yazılamazsa bildirim yine işlenir (kişisel veri vermeyen bir yazma; `invoiceLinkUpdate` gibi).
4. **Panel:** bu kipte kargo firması etiketi hiç alınmaz: `planCarrierStep` taşıyıcıyı yok sayar (sipariş bir Aras/Yurtiçi seçeneğiyle verilmiş olsa da), "Kargoya ver" mağazanın kendi kolisi gibi takip numarasıyla çalışır; sipariş durumu `birfatura_ships` döner, "Kargoya ver" penceresi bunu söyler. Ayarlar > Kargo'da firma listesi gizlenir. Medusa Admin'e ekran yok.
5. **Bilinen sınır:** koliyi Medusa siparişin kargo seçeneğinin sağlayıcısıyla açar. Sipariş bir Aras/Yurtiçi sağlayıcılı seçenekle verilmişse (ör. "Kargo firmasının ücreti" seçili, ADR-0087) sağlayıcı yolumuzun işareti olmadan koli açmaz (`shipping.use_ship_route`): BirFatura'nın bildirimi `Success: false` alır, kayıtta sorun kodu kalır. Bu kipte ödeme seçenekleri kendi gönderim olmalıdır (`shop_shop` ya da `manual`: sabit, eşik, ücretsiz); BirFatura seçeneğiyle firma seçeneğini kendi gönderime çevirmek (Medusa `createOrderFulfillmentWorkflow`'un `shipping_option_id` girdisiyle) sonraki iştir.
6. **Ödemede kargo ücreti** değişmez: mağazanın kendi ücret ayarından (`shop_shop` sağlayıcısı, sabit/eşik/desi tablosu; adr/0087 §2); bağlı taşıyıcı gerekmez. "Kargo firmasının ücreti" (desi tablosu) seçilmişse uyarısı bugünkü gibi durur.

**Sonuçlar.** Yeni alan `shipping.manager` (migration yok: ayar bölümü JSON, varsayılan `own`). Testler: birim (`lib/shipping/__tests__/birfatura-cargo.unit.spec.ts`, `hold.unit.spec.ts`, `invoice-due.unit.spec.ts`), HTTP (`integration-tests/http/einvoice-birfatura-cargo.spec.ts`: seçilebilirlik ve programla düşme, kip kapalıyken yok sayma, kip açıkken tek koli + tek e-posta, tekrar, bilinmeyen/verilmemiş sipariş, geçersiz numara, yanlış token), panel bileşen testleri. Test hesabıyla doğrulanacak: BirFatura'nın bu uca gerçekten hangi `orderStatusId` ile geldiği, `Success: false`'u yeniden deneyip denemediği, çekilen siparişi kendiliğinden faturalayıp faturalamadığı.
