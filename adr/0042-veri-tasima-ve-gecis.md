# ADR-0042: Veri taşıma ve geçiş

- **Durum:** Kabul edildi (2026-10-31, kullanıcı kararları tek tek gözden geçirdi; iki madde açık: Judge.me gibi uygulamaların yorumlarının geçiş paketiyle taşınması (G3) ve "kesime hazır" için Search Console tıklama verisi şartı (G5a))
- **Tarih:** 2026-10-30
- **İlgili:** F14.1–F14.7; docs/13 §12 (geçişte SEO koruması); ADR-0018 (katalog tablosundan içe aktarma, F3.9); ADR-0013 (yönlendirmeler ve 404 kaydı); ADR-0036 (iletiler); ADR-0041 (KVKK)

## Bağlam

Başka platformdan gelen bir mağaza; ürünlerini, kategorilerini, markalarını, müşterilerini, geçmiş siparişlerini, yorumlarını ve en önemlisi arama motorundaki yerini kaybetmeden taşınmalı.

Elimizde olanlar:

- **Katalog tablosu motoru (F3.9):** Bir tabloyu ürünlere çeviriyor. Kuru çalıştırma (kontrol) ve uygulama var. Tanıtıcıya (handle) göre ekliyor ya da güncelliyor; değişmeyen satıra dokunmuyor.
- **Yönlendirme ve 404 kaydı:** `seo-redirects` modülünde.
- **SSRF korumalı indirme:** `safe-fetch`.
- **Güvenli XML okuyucu:** `lib/security/xml`.
- **Arka plan işleri:** ilerleme ve rapor dosyasıyla.
- **İletiler:** şifre sıfırlama dahil.

## Karar

1. **Kaynak arayüzü (`MigrationSource`).**
   - Her kaynak (Shopify, Türk platformları, genel CSV/XML), kendi biçimini ortak kayıtlara çevirir: ürün (varyantlar, görsel adresleri, kategori yolu, marka, SEO, eski adres), kategori, marka, müşteri, geçmiş sipariş, yorum, eski adres.
   - Kaynak yalnızca okur ve sayfa sayfa verir.
   - Her kaydın kaynaktaki kimliği (`source_key`) vardır.
2. **Ürünler katalog motorundan geçer.**
   - Ortak ürün kayıtları katalog tablosuna çevrilir ve F3.9 motoruna verilir. Kuru çalıştırmada kontrol modu, gerçek çalıştırmada uygulama modu kullanılır.
   - Fiyat, stok, kategori, marka, seçenek ve SEO alanlarının doğrulaması ve tanıtıcıya göre tekrarsızlık böylece tek yerde kalır.
3. **Tekrarsızlık kaydı.**
   - `migration` modülünde iki kayıt tutulur:
     - `migration_run`: kaynak, mod, durum, sayımlar.
     - `migration_item`: kaynak, tür, `source_key`, hedef kimlik, durum, hata kodu. (kaynak, tür, `source_key`) tekildir.
   - Yarıda kalan geçiş yeniden çalıştırılınca bulunan eşleşme kullanılır; mükerrer kayıt oluşmaz (KK2).
4. **Geçmiş siparişler Medusa siparişi olmaz.**
   - `legacy_order` kaydına yazılırlar: numara, tarih, tutar, durum, kalemlerin özeti, müşteri bağı.
   - Medusa siparişi açmak stok, fatura, muhasebe, ileti ve web kancası yan etkileri doğururdu. Eski siparişin faturası zaten eski platformda kesildi.
   - Müşteri sayfasında "Önceki platformdan" başlığıyla salt okunur gösterilirler.
5. **Müşteriler.**
   - Ad, e-posta, telefon ve adresler taşınır. Şifreler taşınamaz (F14.5).
   - Ticari ileti izni, ancak kaynak tarih ve kanalıyla verirse "eski platformdan" kaynaklı olarak işaretlenir; vermezse izin yok sayılır. İYS kanıtı olmadan izin uydurulmaz.
6. **Şifre belirleme daveti (F14.5).**
   - Geçiş bitince müşterilere toplu "şifrenizi belirleyin" iletisi gider.
   - İleti işlemsel sayılır, partiler halinde ve günlük kotaya uyarak gönderilir.
   - Bağlantı mevcut şifre sıfırlama akışını kullanır.
7. **Görseller (F14.4).**
   - Kaynak adresler `safe-fetch` ile indirilir: iç ağ adresleri ve iç adrese yönlendiren adresler reddedilir (KK4).
   - Boyut ve tür sınırı vardır. Görsel, medya hattından geçip depoya konur ve ürüne bağlanır.
   - Eski görsel adresleri yeni adrese yönlendirilir.
8. **Yönlendirmeler ve SEO geçiş protokolü (F14.7, docs/13 §12).**
   - Eski adres envanteri üç kaynaktan toplanır: kaynaktan gelen adresler, eski sitenin site haritası (güvenli indirme) ve Search Console'dan dışa aktarılan en çok trafik alan sayfalar (CSV).
   - Eşleşen her adres yeni adrese 301 ile yönlenir.
   - Eşleşmeyenler raporlanır ve panelde karara bağlanır: başka bir hedefe 301 ya da 410.
   - En çok trafik alan ilk 100 adresin hepsi eşlenmeden kesim listesi "hazır" demez (KK3).
   - Kesim sonrası 30 gün 404 kaydı izlenir; eski adreslerden gelen 404'ler uyarı olur.
9. **Çalıştırma.**
   - Geçiş bir arka plan işidir (`migration.run`): kuru çalıştırma ve uygulama, ilerleme, rapor dosyası.
   - Aynı anda katalog içe aktarmayla çalışmaz (aynı `catalog.write` grubu).
   - Yalnızca mağaza sahibi başlatır. Kaynak hesap bilgileri işin girdisine değil, sağlayıcı hesaplarına (`integration-credentials`) konur.
10. **Kaynaklar sırası.**
    - Önce Shopify (Admin API; bir mağazanın kendi açacağı uygulama erişim anahtarıyla). Sahte Shopify sunucusuyla geliştirilir.
    - Türk platformları için ilk adım genel CSV/XML eşleme. Her platformun dışa aktarma biçimi doğrulandıkça hazır eşleme eklenir (Ticimax, ikas, IdeaSoft, T-Soft).
    - XML her zaman güvenli okuyucuyla açılır.

## Alternatifler

| Seçenek                                          | Artı                                                       | Eksi                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Ortak kayıt + katalog motoru (seçilen)**       | Doğrulama ve tekrarsızlık tek yerde; kuru çalıştırma hazır | Görsel ve yorum ayrı adımlar                                            |
| Her kaynak doğrudan Medusa iş akışlarını çağırır | Esnek                                                      | Doğrulama kaynak başına tekrar yazılır                                  |
| Geçmiş siparişler Medusa siparişi olarak         | Tek sipariş listesi                                        | Stok, fatura, muhasebe, ileti yan etkileri; tutarlar yeniden hesaplanır |

## Sonuçlar

- Geçiş runbook'u `docs/runbooks/gecis.md` (F14.6): DNS, dondurma penceresi, doğrulama sayımları, geri dönüş.
- Shopify ve Türk platformlarının erişim yöntemleri her görevin başında resmî belgeden doğrulanır.
- KVKK: taşınan müşteri verisi aynı veri sorumlusunun (mağazanın) verisidir; aydınlatma metninde platform değişikliği anılır (avukat).

## Uygulama notları (G1–G2, 2026-10-30)

1. **İlk kaynak: geçiş paketi (`bundle`).**
   - Ortak kayıtların JSON hâlidir (`format: "quant-migration"`, `version: 1`). Sıkı Zod şemasıyla okunur; bozuk dosya ilk sorunlu alanın yoluyla reddedilir (`products.3.variants.0.price`).
   - Eski adres yalnızca eski sitenin yoludur (`/urun/x`). Başka siteye işaret eden adres (`//`, `https://`) reddedilir. Görsel adresi yalnızca http(s) olabilir.
   - Hazır kaynağı olmayan bir platform için ekibin hazırladığı taşımanın yoludur. HTTP testinin sahte kaynağı da budur. Shopify (G3) ve CSV/XML (G7) aynı arayüze eklenir.
2. **Çalıştırma.**
   - Sıra: kategoriler, markalar, ürünler (katalog motoruyla, 1.000 satırlık parçalar), müşteriler, geçmiş siparişler, yorumlar, diğer sayfalar.
   - Her tür bitince sayımı çalıştırma kaydına eklenir. Her parti ilerleme bildirir; ilerleme işin canlılık sinyalidir (10 dakika sessiz kalan iş ölü sayılır).
   - Kategori ve marka önce taşımanın kendi kaydıyla bulunur (mağaza adını değiştirmiş olsa da), sonra aynı üst kategori altındaki adıyla.
3. **Paket ölçüleri.**
   - Yayına giren yeni ürün ağırlık ve ölçü ister (F3.1). Kaynakların çoğunda ölçü yoktur.
   - Sahip, taşımayı başlatırken bir varsayılan paket (gram ve cm, dördü birlikte) verebilir. Yalnızca kaynakta eksik olan yere uygulanır.
   - Varsayılan verilmezse ölçüsü eksik yayındaki ürün reddedilmez, taslak gelir. Her ikisi de raporun "Notlar" sayfasında ürün ürün yazar; kuru çalıştırma sayıyı önceden gösterir.
4. **Üstü çizili fiyat taşınmaz.** İndirim öncesi fiyat son 30 günün en düşük fiyatı olmalıdır (Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği). Buradaki fiyat geçmişi taşımayla başlar; doğrulanamayan bir eski fiyat gösterilmez.
5. **Yorumlar.**
   - `product_review`'a `origin` (`storefront` / `migration`) eklendi. Taşınan yorumun siparişi yoktur; müşterisi yalnızca kaynak yazarın e-postasını verdiyse ve o müşteri de taşındıysa vardır.
   - Kaynakta yayında olan onaylı gelir, bekleyen beklemede kalır. Yazılış tarihi korunur. Puan filtresi yoktur: olumsuzlar da taşınır.
   - Vitrin API'si taşınan yorum için `verified_purchase: false` döner. Burada doğrulanmış bir alıma bağlı değildir ve tüketiciye bu söylenir.
   - Aynı müşterinin aynı ürüne ikinci yorumu atlanır (`migration.review_duplicate`). Müşteri sonradan vitrinden yazarsa yorum vitrin yorumu olur.
6. **İleti izni.**
   - Yalnızca kaynak tarihli izin verirse, o tarihle ve `import` kaynağıyla yazılır (kanıt: `{origin: "migration", source}`).
   - Adres için burada bir kayıt (yeni bir onay ya da geri çekme) varsa dokunulmaz. İYS'ye her izin gibi bildirilir. Tarihi gelecekte olan ya da adresi geçersiz olan izin yazılmaz.
7. **KVKK.**
   - Geçmiş siparişler veri dökümüne "önceki platform siparişleri" olarak girer.
   - Silme talebinde müşteri bağıyla ya da e-postasıyla bulunur; e-posta silinmiş adresle değişir, tutar ve kalemler kalır.
   - Taşıma dosyası iş nasıl biterse bitsin silinir. Yarıda kalan işin dosyasını bekletme işi 3 gün içinde siler. İş ve raporu yalnızca sahibindir (`privateToAsker`).
8. **Erişim.**
   - `/admin/migrations*` yalnızca sahibe açıktır. Uygulama (`mode=apply`) yeniden doğrulama ister; kanıt başlıkta gelir, gövde ham dosyadır.
   - API anahtarlarına açık değildir. İş `catalog.write` grubundadır: katalog içe aktarma ve toplu düzenlemeyle yan yana çalışmaz.

## Uygulama notları (G3 Shopify, 2026-10-31)

1. **Erişim.** Yalnızca Dev Dashboard uygulaması ve client credentials grant (günlük anahtar). 1 Ocak 2026'dan beri yeni eski tip özel uygulama açılamıyor; eski statik anahtarlar desteklenmez. Hesap `integration-credentials`'ta (`shopify`: mağaza adresi, Client ID; gizli: Client secret); iş girdisinde mağaza bilgisi yoktur.
2. **Okuma.** GraphQL Admin API `2026-10`, her liste için toplu sorgu (bulk operation). Sorgu maliyeti ve 25.000 nesnelik sayfalama sınırı aşılır; JSONL dosyası yalnızca `storage.googleapis.com`'dan indirilir.
3. **Para birimi.** TRY dışında satan mağaza okunmadan reddedilir; fiyat çevrilmez.
4. **Eşleme ayrıntısı** `docs/entegrasyonlar/shopify.md`. Kısaca: koleksiyon kategori, satıcı marka, yalnızca Türkiye adresleri, yalnızca tarihli izin, tanıtıcı platformun slug kuralına çevrilir (eski adres 301 için kalır), Shopify'ın kendi yorumu yoktur.

## Uygulama notları (G4 görseller, 2026-10-31)

1. **İndirme.** Her görsel `safeFetch` ile indirilir: yalnızca genel adresler, her yönlendirme yeniden denetlenir (en çok 3), 20 saniye, 10 MB (KK4). İç ağ ya da bulut meta veri adresi (`169.254.169.254`) istek atılmadan reddedilir. Yalnızca geliştirme ve testteki sahte Shopify'ın kendi adresine doğrudan, yönlendirmesiz gidilir.
2. **Medya hattı.** Görsel panel yüklemesiyle aynı denetimden geçer: türü baytlarından (JPEG, PNG, WebP, AVIF), boyut ve piksel sınırı, EXIF/GPS temizliği ve yeniden kodlama. Genel dosya olarak saklanır, `registerMediaWorkflow` ile kaydedilir, ürün güncelleme iş akışıyla ürüne eklenir; sürümler (WebP/AVIF, paylaşım görseli) mevcut aboneyle üretilir.
3. **Sıra ve alt metin.** Ürünün kendi görsellerinden sonra, kaynağın sırasıyla eklenir; ürünün küçük görseli yoksa ilki olur. Alt metin ürün adından üretilir (toplu düzenlemenin kuralıyla).
4. **Tekrarsızlık.** Her görsel (ürün + adres) ayrı hatırlanır; ikinci çalıştırma saklananı indirmez, reddedileni yeniden dener.
5. **Hata.** Reddedilen ya da ulaşılamayan görsel ürünü durdurmaz; raporun "Notlar" sayfasında nedeniyle yazar.
6. **Eski görsel adresi.** Eski görseller çoğunlukla başka bir alan adında (ör. Shopify CDN) durur; oraya gelen istek bu siteye hiç ulaşmaz, 301 verilemez. Eski sitenin kendi alan adındaki görsel adresleri G5'teki adres envanteriyle (eski sitenin alan adı bilinince) yönlendirilir; görsel kayıtları kaynak adresi tutar.

## Uygulama notları (G5a adres envanteri, 2026-10-31)

1. **Envanter.** `migration_url`: eski adres (kuralların sakladığı biçimde normalleştirilmiş yol, varsa sıralı sorgu dizesi), kaynakları (taşıma kaydı, site haritası, Search Console), tıklama, taşınan kayıt, sahibin kararı ve son uygulamanın sonucu. Taşıma uygulanınca kayıtların eski adresleri envantere girer.
2. **Kayda bağlı eski yol, kural değil.** Ürün, kategori ve markanın eski yolu adres kaydına o kaydın ayrılmış yolu olarak eklenir (adr/0017). Çözümleme onu kaydın güncel yoluna 301'ler; kaydın adresi sonradan değişse de zincir oluşmaz. Taslak kaydın eski yolu, kayıt yayına girene kadar 404 verir. Sitede başka bir kayda ait yol alınmaz (raporda).
3. **Sahibin kararı.** Kayda bağlanmayan adres için 301 (hedef sitede yayında bir sayfa olmalı; başka bir yönlendirme değil) ya da 410. Kararlar uygulamada kural içe aktarmasından (`origin: "migration"`) geçer: önce kuru denetim, sorunlu satırlar ayrılır, kalanı yazılır; yazma da sorun bulursa hiçbiri yazılmaz ve raporda yazar.
4. **Sorgu dizeli adres** (`/urun.php?id=12`) kural olamaz: sorgu atılırsa farklı ürünler tek yola iner. Raporda "sunucu kuralı gerekir"; sahip karar verdiyse (gördüm) hazırlık ölçütünü kilitlemez.
5. **Hazır (KK3).** Search Console'un en çok tıklanan ilk 100 adresinin hepsi bir şeye yanıt vermeli (sayfa, 301 ya da 410). Tıklama verisi yoksa "hazır" denmez.
6. **Erişim.** Envanter, karar ve uygulama yalnızca sahibin; uygulama yeniden doğrulama ister ve `migration.urls` işi olarak taşıma ve katalog içe aktarmayla yan yana çalışmaz. Uygulama sonunda vitrinin çözümleme önbelleği boşaltılır, site haritası yenilenir.

## Uygulama notları (G5b site haritası ve Search Console, 2026-10-31)

1. **Site haritası.** Sahip eski sitenin site haritası adresini verir; `migration.sitemap` işi onu `safeFetch` ile indirir (iç ağ reddi, her yönlendirme denetlenir, 50 MB, gzip açılmış boyutla sınırlı), güvenli XML okuyucuyla okur (DTD ve varlık reddi). Dizin (`sitemapindex`) ve alt haritalar en çok 50 dosya, 100.000 adres. Yalnızca eski sitenin kendi alan adındaki (www farkı yok sayılır) haritalar ve adresler alınır.
2. **Search Console.** Performans > Dışa aktar > CSV'den gelen zip (içindeki `Pages.csv` / `Sayfalar.csv`) ya da sayfalar CSV'si yüklenir; Türkçe ve İngilizce başlıklar okunur. Aynı adresin farklı yazılışları (sondaki eğik çizgi) tek adres olur, tıklamaları toplanır. CSRF istisnası yalnızca bu yol ve `text/csv`, `application/zip`, `application/octet-stream` türleri için.
3. Envantere eklenen adres eski kaydı ve sahibin kararını değiştirmez; yalnızca kaynağı ve (büyük olan) tıklaması güncellenir.

## Uygulama notları (G5c kesim sonrası izleme, 2026-10-31)

1. Sahip alan adını yeni siteye yönelttiğinde "kesim yapıldı" der (`POST /admin/migrations/cutover`); tarih ve kim kaydedilir.
2. Kesimden sonra 30 gün, her sabah (`migration-not-found-watch`, 06:20) vitrinin son bakıştan bu yana gördüğü 404'ler (en çok istenen 1.000) adres envanterine `not_found` kaynağıyla eklenir; sahip onlara da aynı tabloda 301 ya da 410 kararı verir.
3. Yeni 404 varsa yöneticilerin zili çalar: kaç adres ve kaçının eski sitenin bilinen adresi olduğu. Yeni 404 yoksa çalmaz; 30 gün geçince izleme durur.

## Uygulama notları (G6 hesap daveti, 2026-10-31)

1. **Sıfırlama bağlantısı değil, kayıt daveti (§6'dan sapma).** Medusa'nın şifre sıfırlama anahtarı 15 dakika geçerli ve yalnızca e-posta/şifre girişi olan kimlikte çalışır; taşınan müşterinin girişi yoktur, toplu bir davet de saatler sonra açılır. Davet bu yüzden vitrinin kayıt sayfasına gider (`/hesap/kayit?email=`, F18 yapar); hesap açılırken e-posta doğrulanır, sahiplik böyle kanıtlanır.
2. **İleti.** `account.migration_invite`, işlemsel (hesap ve önceki siparişler hakkında; teklif yok). Hesabı olan müşteriye (taşımadan önce ya da arada açılmış) gitmez; vitrin adresi yoksa hiçbiri gitmez.
3. **Kota.** Davetler günlük e-posta sınırının en çok yarısını kullanır, siparişler kalanını. Sahip başlatınca bütün taşınan müşteriler sıraya girer; günün payı hemen, kalanı her sabah 09:00'da gider. Gönderilemeyen ertesi gün yeniden denenir; kimseye iki kez gitmez.
4. **Sahiplenme.** Hesap sahibi girişte (misafir siparişlerinin hesaba katıldığı an, adr/0037 §1) aynı e-postalı taşınmış kaydın geçmiş siparişlerini, yorumlarını (hesabın kendi yorumu olan ürününki hariç), ileti izinlerini ve hesabın hiç adresi yoksa adreslerini alır; taşınmış kayıt başına bir kez.
5. Davetin başlatılması yeniden doğrulama ister ve denetim kaydına yazılır.

## Uygulama notları (G7a Merchant akışı, 2026-10-31)

1. **Türk platformlarının ortak kapısı.** Ticimax, ikas, IdeaSoft ve T-Soft'un hepsi Google Merchant ürün akışı (RSS 2.0, `g:` öznitelikleri; Merchant Center ürün verisi belirtimi) yayımlar. Platforma özel dışa aktarma biçimleri herkese açık belgelenmediği için hazır eşlemeler yerine bu belgelenmiş standart okunur; katalog (ürün, varyant, kategori yolu, marka, görsel, eski adres) her platformdan aynı yolla gelir.
2. **Okuma.** Sahip akışın adresini verir (`POST /admin/migrations/feed`); `safeFetch` ile, 100 MB sınırla indirilir; güvenli XML okuyucu varlıkları çözmediği için başlık, marka ve kategori yolundaki `&amp;`, `&gt;` metin olarak çözülür.
3. **Eşleme.** Aynı `item_group_id` kalemleri tek ürünün varyantlarıdır; ürün adı grubun ortak başlığıdır (kelime sınırında kesilir). Grup içinde değişen renk, beden, malzeme, desen seçenek olur. `sale_price` varsa satış fiyatıdır (üstü çizili fiyat taşınmaz). `out_of_stock` stok 0; diğerlerinde stok bilinmez. `product_type` "A > B" kategori yolu; tanıtıcı eski adresin son parçası (uzantısız). TRY dışında fiyatlı ya da fiyatsız kalem taşınmaz, raporun notlarında yazar.
4. Kaynak kimliği `feed:<akışın alan adı>`; aynı akış yeniden okununca tekrarsızdır.

## Uygulama notları (G7b müşteri listesi, 2026-10-31)

1. Sahip eski platformun müşteri dışa aktarmasını (xlsx ya da CSV) olduğu gibi yükler (`POST /admin/migrations/customers`). Başlıklar esnek okunur: "E-Posta", "E-posta Adresi", "Email"; "Adı", "Soyadı" ya da "Adı Soyadı"; "Cep Telefonu", "GSM"; "İl", "İlçe", "Açık Adres", "Posta Kodu"; izin ve üyelik tarihleri. E-posta sütunu yoksa liste reddedilir.
2. Müşteri küçük harfli e-postasıyla anahtarlanır: liste yeniden yüklenince kimse iki kez taşınmaz. Aynı e-posta birden çok satırdaysa sonuncusu geçer.
3. İzin sütunu yalnızca tarih içeriyorsa izindir ("Evet" tek başına değildir; gelecek tarih de değildir). Türkçe tarih (31.12.2024 10:30) Türkiye saatiyle okunur.
4. Dosya taşıma işi nasıl biterse bitsin silinir (paket gibi); CSRF istisnası yalnızca bu yol ve tablo türleri için.

## Kapanış güvenlik incelemesi (G9, 2026-10-31)

Üç bağımsız inceleme (dış istekler ve dosya ayrıştırma; yetki, KVKK ve hesap güvenliği; motorun bütünlüğü): 2 yüksek, 8 orta, 17 düşük bulgu.

**Yüksek (ikisi de düzeltildi)**

1. **Taşınan verinin başkası tarafından sahiplenilmesi.** Kurbanın e-postasıyla kayıt olup ona giden doğrulama kodunu onaylatan biri, girişte taşınan adresleri, telefonu ve geçmiş siparişleri alabiliyordu (davet e-postası kurbanı bu tıklamaya hazırlıyordu). Artık sahiplenme girişte kendiliğinden olmaz: davet, taşınan kaydı açan imzalı, 60 gün geçerli, tek kullanımlık bir anahtar taşır (`/hesap/kayit?davet=`). Oturum açmış hesap anahtarı `POST /store/customers/me/migration-claim` ile sunar. Kaydın e-postası hesabın giriş kimliğindeki e-postayla aynı olmalıdır. Bağlantıda e-posta yoktur. Vitrin (F18) giriş sonrası bu çağrıyı yapar.
2. **Ürünün üzerine yazılması.** Ürünler tanıtıcıyla eşleniyordu: aynı tanıtıcılı elle eklenmiş ürünün üzerine yazılabiliyor, yeniden çalıştırma burada değiştirilmiş fiyat, stok ve durumu eski değere döndürüyordu. Artık taşınmış ürün yeniden çalıştırmada gönderilmez; tanıtıcısı başka bir ürüne ait ürün taşınmaz ve raporda yazar.

**Orta (hepsi düzeltildi)**

- XML derinlik denetimi ve HTML temizleyicide kapanmamış girdide karesel yavaşlık (tek geçişli tarama; zaman sınırlı test). Varyant gruplamada kalem başına dizi kopyası.
- KVKK silmesinden sonra yeniden çalıştırma müşteriyi geri getiriyordu ve müşteri listesinde düz e-posta kaynak anahtarı kalıyordu: silmede anahtar `erased:<HMAC>` olur, yeniden çalıştırma o müşteriyi atlar.
- Paket tanıtıcıları küçük harfe çevrilmiyordu (eşleme kayboluyordu).
- Tek `INSERT … ON CONFLICT` içinde yinelenen anahtar tüm çalıştırmayı düşürüyordu (ayıklanıyor).
- Yorum ekleme ile kaydetme arasında çökme yorumları yineliyordu (yoruma tekil `source_ref`).
- Ayrılmış yol, ana sayfa ya da ayrılmış yollara bağlanabiliyordu (kural kaynağı denetimi).

**Düşük (düzeltilenler)** sahte adres kısayolu yalnızca açık geliştirme/test ortamında; toplu indirmede yönlendirme yasak ve boyut sınırı; bozuk görsel adı; akış URL'si iş girdisinde ve denetim kaydında yalnızca sitesiyle; veri dökümünde yalnızca e-postayla bağlı geçmiş siparişler; Shopify tutarlarının katı okunması; sıfır fiyatın reddi; akışta indirim tarihleri; yeniden adlandırılmış marka; paketlerin `source_id`'si; 404'te biten yönlendirme zinciri "yanıt vermiyor"; envanterde yeni kayıt bağı öncelikli; taşınan müşteri kayıtlarının saklama süresi (kesimden 90 gün sonra, davet anahtarı dolunca).

**Sonraya kalanlar (gözden geçir)**

- ~~Medusa'nın e-posta doğrulama onayı kodu isteyen oturuma bağlamıyor.~~ F15.1'de kapandı: onay kodu isteyen kimliğin oturumunda yapılır (adr/0037 ek).
- 512 MB'lık Shopify toplu dosyası ve 100 MB'lık akış bellekte açılıyor; satır satır okuma büyük mağazayla ilk geçişte.
- Görsel eklendikten sonra kayıt yazılmadan çökme görseli yineleyebilir (düşük olasılık; elle silinir).
- ~~Taşınan izin kanıtı yalnızca kaynağı içeriyor.~~ F15.1'de kapandı: kanıt, kaynağın yanında çalıştırmanın kimliğini (`run`) ve kaynaktaki kaydın anahtarını (`record`) taşır.
- ~~Rolü düşürülen sahip 7 gün boyunca kendi raporunu indirebilir.~~ F15.1'de kapandı: taşıma işleri (`ownerOnly`) yalnızca o anki sahibe görünür, isteyen de ancak sahipken.
- İş ile dosya yüklemesi arasında süreç ölürse yükleme 3 günden sonra temizlenmiyor (genel arka plan işi davranışı).
- Taşınan ve yayında görünen yorumlar onay kuyruğundan geçmez (eski sitede yayındaydılar). Bağlantı içeren yorum F15.1'den beri onay bekler, yeni yazılan bir yorum gibi.
