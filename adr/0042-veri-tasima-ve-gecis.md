# ADR-0042: Veri taşıma ve geçiş

- **Durum:** Kabul edildi (2026-10-31, kullanıcı kararları tek tek gözden geçirip onayladı)
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
3. **Eşleme.** Aynı `item_group_id` kalemleri tek ürünün varyantlarıdır; ürün adı grubun ortak başlığıdır (kelime sınırında kesilir). Grup içinde değişen renk, beden, malzeme, desen seçenek olur. `sale_price` varsa satış fiyatıdır (üstü çizili fiyat taşınmaz). `out_of_stock` stok 0; diğerleri stoğu sayılmadan satılır (Ek 2026-11-20: takipsiz, her zaman satılabilir). `product_type` "A > B" kategori yolu; tanıtıcı eski adresin son parçası (uzantısız). TRY dışında fiyatlı ya da fiyatsız kalem taşınmaz, raporun notlarında yazar.
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

## Ek (2026-11-03): WordPress (WXR) kaynağı

**Bağlam.** Kullanıcı (2026-11-03): WordPress + WooCommerce sitesi "tek tıkla aktar"ılsın. İlk müşterinin sahibi sitenin dışa aktarmasını verdi (Araçlar > Dışa aktar > Tüm içerik; WXR 1.2, 13,8 MB). WXR WordPress'in kendi biçimidir; her WordPress sitesi eklentisiz verir. Ayrıntılı eşleme: `docs/entegrasyonlar/wordpress.md`.

1. **Kaynak ve yükleme.**
   - `lib/migration/sources/wordpress/`, kimliği `wordpress:<sitenin alan adı>` (www'süz): aynı siteden ikinci dosya ilk çalıştırmanın kayıtlarını bulur.
   - Paketle aynı kapı: `POST /admin/migrations?source=wordpress&mode=` (gövde dosyanın kendisi; XML ya da onu tutan zip, 50 MB). Sınır XML'in kendisi içindir: zip'in içindeki `.xml` de 50 MB'ı aşamaz, zip yalnızca yüklemeyi küçültür. Daha büyük site şimdilik bu yoldan gelmez: tür tür dışa aktarma (yalnızca Ürünler) varyasyonu, ortam kütüphanesini ve terim tanımlarını dosyadan çıkarır, okuyucu bunları aynı dosyada bağlar. Aynı siteden ikinci dosya tekrarsızlığı bozmaz ama kopan bağları geri getirmez. Açık iş: akışlı okuma ya da REST "Bağlan" yolu (madde 12). CSRF istisnası yalnızca bu yolda `application/xml`, `text/xml`, `application/zip`, `application/octet-stream` için (form gönderemez). Dosya iş nasıl biterse bitsin silinir: yazarların ve yorumcuların e-postası içindedir.
   - İsteğe bağlı `category_base` (ör. `/urun-kategori/`): ürün kategorilerinin eski adres tabanı (madde 6).
2. **Okuma.**
   - Güvenli XML okuyucu (DTD ve varlık reddi, boyut ve derinlik sınırı) bu kaynak için 50 MB'la. CDATA bölümleri okuyucudan önce tahmin edilemez bir işaretle ayrılır, sonra geri konur: içlerindeki HTML XML değildir (kapanmayan `<img>`, `<br>` derinlik sayılırdı; ilk müşterinin dosyası 367 seviye görünürdü). CDATA içindeki `<!DOCTYPE` de bu yüzden ret sebebi değildir; dosyanın kendi DTD'si yine reddedilir.
   - Akışlı değil: dosya bir kez, bütün okunur (13,8 MB yarım saniye). Kayıtlar tür tür verilir.
   - Yazarların ve yorumcuların e-postası ve IP adresi hiç okunmaz; yazar görünen adıyla, yorumcu adıyla gelir.
   - Serileştirilmiş PHP (`_product_attributes`, `cat_meta`, robots) yalnızca veri olarak okunur: dize, sayı, mantık, dizi. Nesne ve referans asla kurulmaz; bayt sayısı bozulmuş dize kapanış tırnağına kadar okunur. Hiçbir şey çalıştırılmaz.
3. **Ürün etiketleri taşınmaz.** Vitrinde ürün etiketi sayfası yok, eski etiket sayfaları noindex'ti. İlk müşteride 640 etiket, ürün başına ortalama 4,7; çöpte olmayan ürünlerin kullandığı 610 etiketin 465'i tek üründe (gürültü). Raporda tek satır, dağılımıyla. Blog etiketleri taşınır (madde 5).
4. **Ürün özellikleri.**
   - Varyasyon için kullanılan özellikler seçenek olur (en çok 3, mağazanın sırasıyla). "Herhangi" değerli varyasyon her değer için bir varyant olur.
   - Diğer (açıklayıcı) özellikler, mağazada eşleşen alanı olan bir özellik şablonu varsa ürüne yazılır; yeni akış yok: ürünün içe aktarma satırına katalog içe aktarmasının kendi sütunları (`Özellik şablonu`, `Özellik: <anahtar>`) eklenir, denetim ve yazım (`upsertProductAttributesWorkflow`, telafisiyle) onundur (`workflows/migration/attributes.ts`).
   - **Eşleme kuralı:** özelliğin slug'ı (`pa_` atılır, yüzde kodlaması çözülür, platformun slug kuralı: `pa_sap-rengi` → `sap-rengi`) şablonun ürün kapsamlı alanının anahtarına (`sap_rengi` → `sap-rengi`) ya da etiketinin slug'ına ("Sap Rengi") eşitse eşleşir, önce anahtar. Değer içe aktarmadaki hücre gibi okunur: çoklu seçim `|` ile, metin virgülle; tek seçim, sayı, evet/hayır tek değer. Seçim değeri alanın seçeneklerinden biri olmalı; seçenek açılmaz. Aynı alanı karşılayan iki özelliğin (genel ve ürünün kendisi) değerleri birlikte verilir.
   - Ürün tek şablon alır: değerlerinden en çoğunu alan ve zorunlu alanlarının hepsini dolduran (eşitlikte tanıtıcı sırası). Alanın almadığı değer ürünü engellemez; zorunlu alanı boş kalacak şablon verilmez. Önceki çalıştırmanın taşıdığı ürüne dokunulmaz.
   - Eşleşmeyen özellik raporda değer listesiyle yazar: en çok 50 değer, en çok ürünü olan önce, her biri ürün sayısıyla; sahibi şablonu bundan kurar, taşımayı yeniden çalıştırır. Alanın almadığı değerler, yalnızca başka şablonda olan alan ve zorunlu alanı boş kalan ürün de Notlar'da. Özet'te "Ürün özellikleri" satırı ürün başına özellik sayar.
   - WXR genel özelliğin etiketini taşımaz (`wp_woocommerce_attribute_taxonomies` dışa aktarılmaz): seçenek adı kısa adından üretilir ("Sap rengi", "Celik"). Ürünün kendi özelliği gerçek adıyla gelir.
   - Açıklamadaki özellikler (2026-11-05, adr/0013 Ek): ürünün açıklama belgesindeki tablo ve listeler, ürüne verilen şablonun boş alanlarını yalnızca kesin eşleşmede doldurur (Shopify gövdesi de aynı). Kalan satırlar raporda sayılır ve panelin "Açıklamadaki özellikleri aktar" penceresine kalır. Açıklamadan şablon seçilmez.
5. **Blog.**
   - Yazı içerik iş akışıyla (`saveContentWorkflow`) yazılır. Kategorisi SEO eklentisinin birincil kategorisi (Rank Math, Yoast), yoksa ilki; diğerleri raporda (adr/0019 Ek'in eşleme notu). Etiketler (en çok 50) ve kategoriler önce terim iş akışıyla (`saveTermWorkflow`) açılır; aynı kısa adlı terim varsa o kullanılır.
   - Gövde içerik belgesine çevrilir: başlıklar, paragraflar, listeler, alıntılar, tablolar, kalın, eğik ve güvenli bağlantılar. Eski sitenin kendi bağlantıları yola çevrilir (301 onları karşılar). Soru-cevap kısa kodları (`[sss_item soru=…]`, `[accordion-item title=…]`) başlık olur; düzen kısa kodları içeriklerini bırakıp kalkar; ürün vitrini, galeri, blok ve gömülü video kalkar. Gövdedeki görseller taşınmaz (görsel mağazanın kendi yüklemesi olmalı); yazı başına raporda yazar.
   - Kapak görseli ürün görselleri gibi indirilir (G4). İlk yayın tarihi korunur (iş akışı ilk yayını bugünle tarihler; ardından kaynağın tarihi yazılır). SEO başlığı, açıklaması ve odak kelimesi SEO iş akışıyla.
   - SEO eklentisinin değişkenleri (`%title%`, `%sep%`, `%sitename%`, Yoast'ın `%%…%%`'ı) bilinenler doldurularak; yalnızca değişkenden oluşan ya da bilinmeyen değişken içeren başlık boş bırakılır (mağazanın şablonu yazar).
6. **Sayfalar ve yasal metinler.**
   - Kendi metni olan sayfa içerik sayfası olur. Aşağıdakiler olmaz; eski adresleri sahibin kararı için envantere girer:
     - yasal metin gibi okunan (panelin kelime listesi: sözleşme, KVKK, aydınlatma, çerez, gizlilik, iade, ön bilgilendirme…; adr/0048: yasal metinler Ayarlar > Yasal'dan yayınlanır, eski adresleri `/yasal/...`'a 301),
     - mağaza sistem sayfası (sepet, ödeme, hesap, istek listesi kısa kodu),
     - ön sayfa, yalnızca tema bileşeninden oluşan sayfa, vitrinin ayrılmış yolundaki sayfa (`/blog`, `/magaza`, `/yorumlar`).
   - Eski sitede noindex olan sayfa ve yazı taslak gelir, robots ayarı taşınır.
   - Aynı tanıtıcılı sayfa ya da yazı sitede varsa (ör. profil betiğinin açtığı Hakkımızda) bulunmuş sayılır, üzerine yazılmaz; eski adresi ona bağlanır.
7. **Eski adresler.**
   - Ürün, yazı ve sayfanın eski adresi öğenin `<link>`'idir (`/urun/{slug}/`, `/{slug}/`). Sorgu dizeli bağlantı (taslak: `?p=12`) adres sayılmaz.
   - Arşivlerin tabanı WXR'de yok. Sitenin kendi içeriğindeki iç bağlantılardan okunur; iki türün paylaştığı kısa adlar ve yazı/sayfa bağlantıları sayılmaz. Bağlantı yoksa WordPress varsayılanı: `/product-category/`, `/brand/`, `/category/`, `/tag/`. İlk müşteride okunan: ürün kategorisi kökte (`/{ust}/{alt}/`, Rank Math tabanı kaldırmış), marka `/marka/`, blog `/category/` ve `/tag/` (envanterle aynı). Ürün kategorisi tabanı `category_base` ile verilebilir.
   - Kaydına bağlanan eski adres envantere kayıt türüyle girer: yazı, sayfa, blog kategorisi ve etiketi de (G5a'nın ayrılmış yolu).
8. **Görseller.** Ek dosyaların adresleri G4 hattıyla indirilir (safeFetch: iç ağ reddi, 10 MB, tür ve piksel denetimi). Ayrıca alan adı kısıtı yok: ortam kütüphanesini CDN'e taşımış sitelerde de gelsin; `fetch.ts`/`old-site.ts`'teki gibi bir "izinli alan adı" kaydı görsel hattında hiç olmadı. Alt metin WordPress'in alt metni, yoksa ürün adından (G4 §3). Ana görsel, galeri ve varyasyonların görselleri sırayla; ortam kütüphanesinde olmayan görsel raporda.
9. **Fiyat, stok, ölçü.** Satış fiyatı (tarihleri geçerliyse) fiyattır; normal fiyat üstü çizili taşınmaz (G1 §4). Stok yalnızca "stok yönetimi" açıksa sayı, "stokta yok" 0, diğerlerinde takipsiz (Ek 2026-11-20). Ağırlık kg → g, ölçüler cm (WooCommerce varsayılanı; WXR mağazanın birim ayarını taşımaz). Gizli (katalogdan ve aramadan çıkarılmış), taslak, özel ve parolalı ürün taslak; çöp kutusu, gruplanmış ve dış bağlantılı ürün taşınmaz.
10. **Yorumlar.** Ürünün puanlı yorumları (1–5): onaylı yayında, bekleyen beklemede; spam ve çöp taşınmaz. Fotoğraflar taşınmaz (raporda). Blog yorumları taşınmaz (vitrinde yok; raporda sayısı).
11. **Yalnızca raporda: menüler ve kuponlar.**
    - Menüler profil betiğiyle kuruldu. Bir menü içe aktarmasının ihtiyacı: `nav_menu` terimi (menü adı), her öğenin `_menu_item_type` (taxonomy, post_type, custom), `_menu_item_object` ve `_menu_item_object_id` (hedef kayıt; taşıma kaydıyla buradaki kayda çevrilir), özel bağlantıda `_menu_item_url`, `_menu_item_menu_item_parent` (iç içe) ve `menu_order`. Tema konumu WXR'de yok (`theme_mods` dışa aktarılmaz): menü başına konum sahibe sorulur, sonra `saveStorefrontMenuWorkflow`.
    - Kuponlar (ilk müşteride 1 yayında): kod, tür ve tutar postmeta'da; kullanım geçmişi ve kullananlar yok. Elle Kampanyalar'dan açılır.
12. **WXR'de olmayanlar:** müşteriler, siparişler, kupon kullanımları, mağaza ayarları (birim, para birimi, vergi), özellik etiketleri, menü konumları. Bunlar için ileride WooCommerce REST API "Bağlan" yolu (salt okunur anahtar; `docs/gecis/mylarte/esleme.md` §4).
13. **Kategorilerin SEO alanları.** Ürün kategorisinin Rank Math terim alanları (başlık, açıklama, odak kelime; değişkenler madde 5'teki gibi) yeni açılan kategoriye SEO iş akışıyla yazılır. Alanı olmayan kategoriye hiçbir şey yazılmaz: panelde SEO alanı boş açılan kategori gibi mağazanın şablonlarını alır (başlık kategori başlık şablonundan, açıklama kendi metninden ya da liste cümlesinden; `lib/seo/resolve.ts`). WordPress için ayrı varsayılan yok. Mağazada zaten olan kategoriye dokunulmaz. Blog kategorisi ve etiketi aynı kuralla (madde 5). Yoast terim alanlarını dışa aktarılmayan bir seçenekte tutar: Yoast'lı sitede kategoriler şablonu alır. Terimin robots ayarı taşınmaz. Raporun Özet sayfasında yeni kategorilerin ve blog kategorilerinin kaçının kendi alanıyla, kaçının şablonla geldiği yazar (`seo_own`, `seo_default`).
14. **Panel özeti.** WordPress çalıştırmasının iş özetinde (`result_summary.wordpress`) `attributes` (açıklayıcı özellikler slug'a göre birleşik: `key`, `name`, `products`, `values`) ve `not_moved` (`coupons`, `menu_items`, `product_tags`, `blog_comments`; yoksa 0) bulunur. Diğer kaynakların özeti değişmedi.

**İlk müşterinin kuru çalıştırması (2026-11-03, geliştirme veritabanı, uygulanmadı).** Dosya yarım saniyede okundu. Kategori 49 (48'i profil paketinden var, 1 boş kategori eklenecek), marka 13 (hepsi var), ürün 201 (32 değişken, 260 varyant; katalog içe aktarması 201'ini de "Eklenecek" gördü), görsel 947, yorum 28 (10'unun fotoğrafı taşınmaz), blog yazısı 54 (53'ü kapaklı), blog kategorisi 12, blog etiketi 217, sayfa 22 (4'ü profilden var, 2 noindex demo sayfası taslak, 16'sı yalnızca eski adres: 8 yasal metin, 4 sistem sayfası, `/magaza` `/blog` `/yorumlar`, 1 boş). Okunan tabanlar envanterle aynı. Hiçbir ürünün ağırlığı ve ölçüsü yok: varsayılan paket verilmezse 201 ürün taslak gelir. Taşınmayan açıklayıcı özellikler: `pa_urun-turu` (201 ürün, 24 değer), `pa_celik` (183 ürün, 22 değer), 7 küçük özellik (1–2 ürün). Çöpte 2 ürün ve 8 yazı.

**İkinci kuru çalıştırma (2026-11-03, geliştirme veritabanı, uygulanmadı).** Sayılar ilkiyle aynı (kategori 49'un 48'i var, 1 yeni; marka 13; ürün 201, katalog içe aktarması 201'ini de "Eklenecek" gördü). Dosyadaki 49 ürün kategorisinin hepsinde Rank Math başlık ya da açıklaması var; yeni açılacak 1 kategori kendi alanıyla gelir, var olan 48'e dokunulmaz. Blog kategorisi 12'nin 10'u kendi alanıyla, 2'si şablonla; 217 blog etiketinin hepsi şablonla. Açıklayıcı özellik: ürün başına 396 değer (9 anahtar, slug'a göre 8 özellik). Geliştirme mağazasında özellik şablonu yok: 396'sı da raporda değer listesiyle. Eşlemenin denemesi için en çok kullanılan iki özelliğin slug'ıyla iki metin alanlı geçici şablon açıldı, kuru çalıştırıldı, silindi: 386 değer yazılacak, 10'u (küçük özellikler) raporda; 201 ürün yine "Eklenecek". Taşınmayanlar: 1 kupon, 91 menü öğesi, 610 ürün etiketi, 0 blog yorumu.

**Ortak kayıtlara eklenenler (`types.ts`).** `SourcePost`, `SourcePostTerm`, `SourceContent` (sayfa ve yazının gövdesi, özeti, yazarı, tarihi, kapağı, SEO alanları, robots); `SourcePage.content` (varsa sayfa içerik sayfası olur); `SourceProduct.focus_keyword` ve `image_alts`; `MigrationSource.posts()` (isteğe bağlı); tür listesine `post`, `post_category`, `post_tag`. Paket ve diğer kaynaklar değişmedi. Madde 4 ve 13'ün alanları (kategorinin `seo_title`, `seo_description`, `focus_keyword`'ü; ürünün `attributes`'ı) şimdilik ortak kayıtta değil: WordPress kayıtlarında (`WordpressCategory`, `WordpressProduct`), çalıştırmanın adımları onları isteğe bağlı alan olarak okur (`CategorySeo`, `AttributedProduct`). Başka bir kaynak da verince `types.ts`'e taşınır.

## Ek (2026-11-05): taşınan metinlerdeki eski iç bağlantılar (otonom, gözden geçir)

**Bağlam.** Taşınan blog yazıları (ör. "Elmax Çelik Nedir?") eski sitenin adreslerine bağlantı veriyor (`/el-yapimi-caki`, `https://mylarte.com/...`). WordPress okuyucusu eski sitenin mutlak bağlantılarını yola çeviriyordu (madde 5), ama yol eski sitenindi; 301'i ancak sahip Ayarlar > Taşıma'da "Kararları uygula" deyince kayda bağlanıyordu (G5a). O ana kadar, ve kategori yolu değiştiyse ondan sonra da her tıklama bir yönlendirme ya da 404'tü.

1. **Kayda bağlı eski yollar hemen (`reserveRecordPaths`, `workflows/migration/urls-apply.ts`).** Uygulanan her taşımanın sonunda envanterde bir kayda bağlı ve bugün yanıt vermeyen her eski yol, uygulamanın `reserve` adımıyla o kaydın ayrılmış yolu olur (başka kaydın yolu alınmaz, ayrılmış kelime reddedilir; satıra sonucu yazılır). Bu bir karar değil, taşımanın bildiği bir olgudur; sahibin 301/410 kararları ve sorgu dizeli adresler eskisi gibi "Kararları uygula"yı bekler.
2. **Bağlantı çevirisi (`rewriteContentLinksWorkflow`, `workflows/content/link-*.ts`).** Belgeler: içerik sayfaları ve yazılar (`content_entry.body`) ve ürün açıklamaları (`product_extension.description_doc`); adr/0019 belgesindeki `link` işaretleri. Mağazanın kendi bağlantısı: `/` ile başlayan yol ya da mağazanın alan adındaki (`seo.canonical_host`) veya taşımaların geldiği sitedeki (`migration_item.source`: `wordpress:mylarte.com`, `shopify:…`) mutlak adres; `www.` farkı yok sayılır. Her farklı bağlantı bir kez vitrinin çözdüğü gibi çözülür (`followPath`: canlı kayıt, kurallar, adres kaydındaki eski yollar; zincir sonuna kadar, yalnız yanıt veren sayfa yeni adres olur); vitrinin kendi sayfaları (`/sepet`, `/arama`, `/yasal/…`, `/blog`) canlı sayılır. Sonuç: canlı sayfa mağazanın tuttuğu biçimde (alan adsız, sondaki eğik çizgisiz, sorgu ve `#` korunur), taşınmış sayfa yeni adresi (`#` korunur); 410 ve karşılıksız adres **olduğu gibi kalır** ve raporlanır. Başka siteye, `mailto:`/`tel:`'e, sayfa içi `#`'ye ve göreli adrese hiç dokunulmaz. Yazım iş akışında: plan (yalnız okur) → içeriğin kilidi ve her ürünün `catalog:<id>` kilidi → belgeler o anki hâlleriyle yeniden okunup yazılır (geri alınınca önceki gövde) → vitrine `content` yenileme sinyali. Metin, özeti, kelime sayısı, tarihleri ve ürünün düz metin açıklaması değişmez (bağlantı adresleri düz metinde yok).
3. **Taşımada.** `migration.run` uygulamasının (ve WordPress "yalnız açıklamaları yenile" koşusunun) sonunda: önce madde 1, sonra bu kaynağın taşıdığı belgelerin (taşıma kaydındaki `post`, `page`, `product`) bağlantıları. Hata taşımayı düşürmez (log `migration.links_failed`). Sayılar iş özetinde (`result_summary.links`: `reserved`, `documents`, `rewritten`, `changed`, `unresolved`) ve "bitti" denetim kaydında; raporun Özet sayfasında üç satır, ayrıca "Bağlantılar" sayfası (tür, başlık, eski bağlantı, yeni bağlantı ya da neden).
4. **Önceden taşınmış metinler için iş (`content.link_rewrite`).** `POST /admin/async-jobs { type: "content.link_rewrite", input: { dry_run?, hosts? } }`; sahip ve yönetici (operasyon ve salt okunur 403, rol kuralının varsayılanı); `catalog.write` grubunda (taşıma, içe aktarma, toplu düzenlemeyle yan yana çalışmaz), tekil. `hosts` en çok 5 ek eski alan adı. Bütün belgeleri tarar; denetim kaydı `content.links_checked` / `content.links_rewritten` (sayılar), rapor xlsx (Özet, Düzeltilenler, Çözülemeyenler), 7 gün. Panel: Ayarlar > Taşıma'da "Metinlerdeki eski bağlantılar" kartı ("Kontrol et", onaylı "Bağlantıları düzelt", son çalışmanın cümlesi ve "Raporu indir"); başka ekran yok, mağaza raporu indirip karşılıksızları elle düzeltir ya da eski adreslerde karar verir. Yerel betik: `pnpm --filter @qticaret/backend links:rewrite [check|apply] [reserve]` (aynı iş akışı; `reserve` önce madde 1).
5. **Hâlâ 301'i olmayan eski adres sınıfları (taşıma bilmiyor ya da sahibin kararı gerekiyor):**
   - Sayfalama: `…/page/N/` (kategori, `/magaza`, `/blog`, blog arşivleri). Kayıt değil; envantere yalnız site haritası ya da Search Console verirse girer. Öneri: kalıp kuralı (`/{yol}/page/{n}` → `/{yol}?sayfa={n}` ya da kök sayfa), ayrı iş.
   - WordPress'in kendi kısa yolları: kökte çağrılan alt kategori (`/n690-cakilar/` → `/el-yapimi-caki/n690-cakilar/`), eğik çizgisiz biçimler (normalleştirme karşılıyor), `?p=12`, `?product_cat=` gibi sorgu dizeli adresler (kural olamaz, G5a §4).
   - Taşınmayan türler: ürün etiketi arşivleri (`/urun-etiketi/x/`, madde 3), yazar ve tarih arşivleri (`/author/x/`, `/2024/03/`), ek sayfaları ve `/wp-content/uploads/…` dosyaları, `/feed/` adresleri.
   - **2026-11-06: yukarıdaki üç sınıf adr/0059 ile kapandı** (sayfalama, kısa yollar ve sorgulu adresler, taşınmayan türler; ek sayfası `/x/ek-adi/` hariç, 404 kalır). `/hesabim` gibi WooCommerce sayfaları sahip karar vermezse kalıp kuralıyla vitrinin sayfasına gider; sahibin kararı her zaman önce gelir.
   - Envanterde olup sahibin kararını bekleyenler: kayda dönüşmeyen sayfalar (yasal metinler → `/yasal/…`, toptan metinleri → `/toptan`, `/hesabim` → `/hesap`, boş sayfa); "Kararları uygula" yapılmadan 301 yok. Öneri: yasal metin sayfalarına kelime listesinden `/yasal/{tür}` önerisi.
   - Taslak kaydın eski yolu, kayıt yayına girene kadar 404 (G5a §2, bilerek).
6. **Akışta sayılmayan stok.** Google Merchant akışı stok adedi vermez: `out_of_stock` dışındaki her kalem (`in_stock`, `preorder`, `backorder`, boş) bilerek takipsiz, her zaman satılabilir taşınır (sahip kuralı: sayılmayan satılabilir; ön sipariş ve sonradan tedarik de satışa açık demektir). Böyle varyantı olan her ürün raporun Notlar sayfasında `migration.feed_stock_untracked` ile bir satır alır (ürün başına bir).
7. **Tabloyla takibi kapatma.** `Takipsiz`, açık siparişlerde ayrılmış stoğu (`reserved_quantity > 0`) olan takipli varyantta satırı reddeder (`catalog_import.stock_untracked_reserved`). Uygulanan içe aktarmanın "finished" denetim kaydına takibi kapatılan varyantlar `stock_untracked: { updated, created, variant_ids (en çok 500) }` olarak yazılır (yalnız kimlik ve sayı).
8. **Testler:** birim `lib/content/__tests__/links.unit.spec.ts`, `lib/seo/__tests__/internal-links.unit.spec.ts`, `async-job/__tests__/job-types.unit.spec.ts`; HTTP `content-links.spec.ts` (kontrol yazmaz; uygulama eski yol, alan adlı adres ve ürün açıklamasını çevirir, dışarıyı ve karşılıksızları bırakır; ikinci koşu boş; roller; denetim kaydı ve rapor), `migration-wordpress-apply.spec.ts` (kategorinin eski yolu hemen 301, yazının bağlantısı `/kategori/…`).

## Ek (2026-11-06): kategorilerin kendi görselleri (otonom, gözden geçir)

**Bağlam.** Vitrinin kategori kutuları ve açılır menüsü her kategorinin kendi görselini (`category_image`, panelde "Kategori görseli" kartı, adr/0046 Ek 2026-11-04) gösterir; görseli olmayan kategori en yeni ürünün fotoğrafına düşer. Geliştirme mağazasındaki 49 kategorinin hiçbirinde görsel yoktu. WooCommerce kategori görselini terim alanı `thumbnail_id`'de (ortam kütüphanesindeki ek dosyanın kimliği) tutar; ilk müşterinin dışa aktarmasında 42 kategoride var. WordPress kaynağı bunu okumuyordu.

1. **Okuma (`lib/migration/sources/wordpress/covers.ts`).** `product_cat` teriminin `thumbnail_id`'si (sayı, `0` değil) ek dosyaya, ondan `wp:attachment_url`'e çözülür. Alt metin: ek dosyanın `_wp_attachment_image_alt`'ı, yoksa başlığı (WordPress'in dosya adından verdiği başlık değilse; boyut ekleri `-scaled`, `-300x200` yok sayılır), yoksa kategori adı. Ortam kütüphanesinde olmayan ya da adresi web adresi olmayan görsel Notlar'da (`migration.wordpress_category_image_missing`, `product_cat:<slug> #<kimlik>`). Her WooCommerce sitesi aynı biçimi verir; mağazaya özel bir şey yok. Kayıtta `WordpressCategory.image` / `image_missing` (madde 13'teki gibi WordPress kaydında; çalıştırma isteğe bağlı alan olarak okur).
2. **Yazma (`workflows/migration/category-covers.ts`).** Ürün görsellerinden sonra çalışır (G4 sırası; aynı dosya bir kez saklanır). Görsel kategori görseli iş akışıyla (`setCategoryImageWorkflow`, panelle aynı yol: medya kütüphanesindeki bir yükleme olmalı) yazılır. Dosya önce taşımanın sakladıkları arasında aranır: bu kaynağın aynı adresli görsel kaydı, sonra eski dosya kaydı (`migration_file`, adr/0059) aynı yolla, sonra aynı kökle (aynı yüklemenin başka boyutu); kütüphanede hâlâ duran yükleme kullanılır. Yoksa G4 hattıyla (`storeImage`: `safeFetch`, iç ağ reddi, 10 MB, tür ve piksel denetimi, EXIF temizliği) **yalnız HTTPS** ile indirilir (`http://` adres aynı dosyanın `https://`'i olarak istenir; yalnız geliştirme ve testteki sahte eski site kendi adresinden).
3. **Üzerine yazmama.** Görseli olan kategoriye dokunulmaz (mağazanın kendi görseli). Konulan görsel taşıma kaydına (`image`, `product_cat:<slug> <adres>`) yazılır: yeniden çalıştırma onu "var" sayar, mağaza sonradan kaldırdıysa geri koymaz. Eski sitenin kendi alan adındaki dosyası `migration_file`'a yazılır, `/wp-content/uploads/…` adresi yeni görsele 301 verir.
4. **Engel değil uyarı.** Eksik, reddedilen ya da ulaşılamayan görsel ve kategorisi burada olmayan görsel sayılır ve Notlar'da yazar; kategori ve taşıma durmaz.
5. **Sayılar.** Çalıştırmanın `category` sayımında (yalnız görsel veren kaynakta): `covers` (eklenen; kuru çalıştırmada eklenecek, yeni açılacak kategoriler dahil), `covers_kept`, `covers_reused` (kuru çalıştırmada aynı koşunun ürün görselleri de), `covers_uploaded`, `covers_failed`; raporun Özet sayfasında beş satır. Panelin sonuç kartı değişmedi.
6. **Önceden taşınmış mağaza (`category-covers:backfill`).** `pnpm --filter @qticaret/backend category-covers:backfill <dosya.xml> [apply]`: dışa aktarmayı okur, kategorileri çalıştırmanın bulduğu gibi bulur (taşıma kaydı, yoksa aynı üst altındaki adı; hiçbir şey açmaz), aynı adımı çalıştırır. `apply` olmadan hiçbir şey yazılmaz ve indirilmez. JSON sayılar: `found`, `set`, `already_set`, `reused_asset`, `uploaded`, `failed`; her başarısızlık bir `FAILED <anahtar>: <neden>` satırı. Uygulamada denetim kaydı `migration.category_covers_set`. Yeniden çalıştırmak güvenli: ikincisi 0 ekler.
7. **Testler:** birim `sources/wordpress/__tests__/covers.unit.spec.ts` (terim alanı, ek dosya çözümü, alt metin, eksik görsel notu), `workflows/migration/__tests__/category-covers.unit.spec.ts` (HTTPS adresi, alt metin sınırı, rapor satırları); HTTP `migration-wordpress-covers.spec.ts` (kuru çalıştırma; uygulama: bir ürünün dosyası yeniden kullanılır, diğeri bir kez indirilir, eksik olan notta, eski dosya adresi 301; ikinci uygulama 0; betik: kuru → uygula → yeniden 0, mağazanın görseli korunur).

## Ek (2026-11-20): gerçek bir WXR taşımasından düzeltmeler (otonom, gözden geçir)

221 ürün, 1002 görsel, 49 kategorilik gerçek bir WordPress taşımasında üç sorun çıktı; karar platform geneli, sektörden bağımsız.

1. **Sayılmayan stok her zaman satılabilir (sahip kararı).** Kaynağın saymadığı ama sattığı kalem (WooCommerce `_manage_stock` kapalı + `instock`/`onbackorder`; Shopify `inventoryItem.tracked=false`; Merchant akışında `out_of_stock` dışı her kalem; paket dosyasında `"untracked"`) `SourceVariant.stock = "untracked"` olarak taşınır, katalog tablosuna `Takipsiz` yazılır, varyant `manage_inventory: false` açılır (ADR-0018 Ek 2026-11-20). Sayılmayan ama "stokta yok" kalem stok takipli ve 0 kalır. `null` yalnız gerçekten bilinmeyen içindir (takipli, seviyesiz). Ortak stoklu varyasyonlar: ürün stok sayıyor, varyasyon kendi stoğunu saymıyorsa (`_manage_stock` `parent`/`no`/yok) ürünün `_stock`'u her varyanta yazılır ve Notlar'da `migration.wordpress_stock_shared` yazar (burada ortak havuz yok). Değeri birden çok varyanta yayılan "herhangi" varyasyon da aynı.
2. **Görsellerde yeniden deneme ve neden.** Eski sunucu paralel indirmeleri kısıyordu (1002'den 22'si `image_unreachable`; yeniden çalıştırmada hepsi 200). `lib/migration/image-fetch.ts`: 429, 5xx, 408, zaman aşımı ve bağlantı hatası en çok 4 deneme, katlanan bekleme + rastgele pay (üst sınır 30 sn), sunucunun `Retry-After`'ı uyulur; 404/410, 401/403 ve diğer yanıtlar denenmez. `lib/migration/fetch-pace.ts`: koşu başına tek hız; her retle eşzamanlı indirme yarıya iner (4 → 2 → 1), 10 başarılı yanıtta bir artar, `Retry-After` süresince yeni indirme başlamaz. Zaman aşımı 30 sn ve en çok bir kez yeniden denenir. Aynı sunucudan art arda 10 ret ya da zaman aşımı gelince o sunucu koşu boyunca bırakılır: kalan görselleri denenmeden son retin nedeniyle (`migration.image_unreachable_<neden>`) yazılır. Görsel adımının toplam süresi 60 dakikadır; aşılınca kalanlar `migration.image_unreachable_deferred` ile yazılır. İkisinde de görsel kaydı `skipped` kalır, sonraki çalıştırma yeniden dener. Başarısız görselin kaydına ve raporun Notlar'ına neden yazılır: `migration.image_unreachable_{not_found,forbidden,throttled,server,timeout,network,status}` (tr/en sunucu metinleri).
3. **Kapak görseli ve varyant bağları yeniden çalıştırmada.** Öne çıkan görsel alınamayınca ilk görsel kapak olur ve yedek taşıma kaydına yazılır (`migration_item`, tür `thumbnail`, anahtar `<ürün anahtarı> thumbnail`, `target_id` yedeğin adresi). Ürünün `metadata` alanına yazılmaz: Medusa vitrin API'si `fields=+metadata` ile onu döndürebilir. Sonraki çalıştırma öne çıkan görseli alınca, kapak hâlâ o yedekse yerine koyar ve kaydı `skipped` yapar; mağaza kapağı değiştirdiyse kayıt yalnızca kapanır. Mağazanın sonradan seçtiği kapağa dokunulmaz. Görsel eklenirken ürünün mevcut görselleri kimlikleriyle gönderilir ve kaydetmeden önceki varyant bağları adrese göre karşılaştırılıp eksik kalan `batchImageVariantsWorkflow` ile geri bağlanır (`keepImageTies`); önceden 4 üründe 10 bağ düşüyordu.
4. **Kategori tanıtıcısı kaynağın slug'ı.** `SourceCategory.handle` (WordPress terim slug'ı, Shopify koleksiyon tanıtıcısı, paket dosyasında isteğe bağlı) yeni kategorinin tanıtıcısıdır; yoksa addan. Alınmışsa numaralanır. Eski adres ayırma ve 301 davranışı değişmedi.
5. **Kapalı ve demo kategoriyle eşleşmeme.** Adla eşleşme yalnız etkin ve mağazanın kendi kategorisiyle olur (`is_active` ve `metadata.demo !== true`); taşıma kaydıyla eşleşme aynen. İstenen tanıtıcı **kapalı, demo işaretli, ürünü ve alt kategorisi olmayan** bir kategorideyse taşıma onu siler (önce URL kayıt defterindeki yolları serbest bırakılır, `migration-clear-demo-category` iş akışı, telafili) ve tanıtıcıyı alır. Etkin ya da dolu demo kategoriye dokunulmaz; yeni kategori numaralı tanıtıcı alır. Gerekçe: kapalı demo kategori vitrinde hiç görünmedi, yolunun 301'i yok; silinmesi kimseyi etkilemez, numaralı tanıtıcı ise eski adresle aynı slug'ı kaybettirir.
6. **Akışta sayılmayan stok.** Google Merchant akışı stok adedi vermez: `out_of_stock` dışındaki her kalem (`in_stock`, `preorder`, `backorder`, boş) bilerek takipsiz, her zaman satılabilir taşınır (sahip kuralı: sayılmayan satılabilir; ön sipariş ve sonradan tedarik de satışa açık demektir). Böyle varyantı olan her ürün raporun Notlar sayfasında `migration.feed_stock_untracked` ile bir satır alır (ürün başına bir).
7. **Tabloyla takibi kapatma.** `Takipsiz`, açık siparişlerde ayrılmış stoğu (`reserved_quantity > 0`) olan takipli varyantta satırı reddeder (`catalog_import.stock_untracked_reserved`). Uygulanan içe aktarmanın "finished" denetim kaydına takibi kapatılan varyantlar `stock_untracked: { updated, created, variant_ids (en çok 500) }` olarak yazılır (yalnız kimlik ve sayı).
8. **Testler:** birim `lib/migration/__tests__/image-fetch.unit.spec.ts` (neden kodları, Retry-After, geri çekilme, hız), `sources/wordpress/__tests__/stock.unit.spec.ts`, `workflows/migration/__tests__/{thumbnail,categories,variant-ties}.unit.spec.ts`, `catalog/import/__tests__/plan.unit.spec.ts` (rezervli ret, denetim kimlikleri), `merchant-feed.unit.spec.ts` (not), `records.unit.spec.ts` (yüzde kodlu Türkçe slug `%c3%a7akilar` → `cakilar`; bozuk kod olduğu gibi), `catalog-sheet` hücre testi; HTTP `migration-wordpress-fixes.spec.ts`.

## Ek (2026-11-27): blog yazılarının metnindeki görseller (otonom, gözden geçir)

Sahip: "WordPress'ten ürün görselleri geldi ama blog yazılarının içindeki görseller çekilmedi." Neden: gövde okuyucu (`sources/wordpress/html.ts`) `<img>`'i bilerek düşürüyor ve yalnız sayıyordu (içerik belgesi yalnız mağazanın kendi yüklemesini kabul eder); yazının kapağı (`_thumbnail_id`) zaten taşınıyordu.

1. **Okuma.** Yazı ve sayfa gövdesinde (`content.ts`) `<img>` artık eski dosyanın adresiyle bir görsel bloğu olur (`sources/wordpress/body-images.ts`): önce ortam kütüphanesinin kendi yüklemesi (`wp-image-<id>` sınıfı, galerinin `data-id`'si), WordPress'in kestiği boyut yerine özgün dosyası (`-300x200`, `-scaled`, `-e<zaman>`: adr/0059'un `uploadStem` kökü). Kütüphanede yoksa etiketin adlarından en büyüğü (`srcset`, `data-srcset`, tembel yükleyicinin `data-src`'si, `data-orig-file`) ve **yalnız eski sitenin kendi alan adında** (Jetpack'in `i0.wp.com/<alan adı>/…` kopyası sitenin dosyası sayılır); başka alan adındaki görsel eskisi gibi düşer ve Notlar'da yazar. `<picture>` içindeki `<img>` okunur. `[gallery ids]`, Flatsome `[ux_image id]` / `[ux_gallery ids]` yüklemelerin görselleri olur. Liste, alıntı ya da tablo içindeki görsel blok olamaz, düşer ve sayılır. Alt metin etiketin, yoksa kütüphanenin. Ürün açıklamaları değişmedi (görselsiz belge).
2. **Yazma.** Kayıttan önce her görsel ürün görselleriyle aynı yoldan indirilir (`workflows/migration/content-images.ts`: `storeImage`, SSRF kuralları, 10 MB, bayt denetimi, temizleme, AVIF/WebP sürümleri, çalıştırmanın tek hızı ve eşzamanlılığı); aynı dosya bir çalıştırmada bir kez. Gövde kopyanın adresine çevrilir; indirilemeyen görsel gövdeden çıkar, Notlar'da nedeniyle (`image` türü), yazı yine taşınır. Herhangi bir boyutuna verilen metin bağlantısı da kopyaya döner. Görsel `"<yazı anahtarı> <eski adres>"` anahtarıyla hatırlanır: yeniden çalıştırma indirmez, eski `/wp-content/uploads/…` adresi adr/0059 ile kopyaya 301 olur. Sayılar ürün görselleriyle birlikte `counts.image`'da.
3. **Önceden taşınmış yazılar: `refresh=post_images`.** Panelde Ayarlar > Taşıma > WordPress, **Yalnız blog görsellerini taşı** kutusu (kuru çalıştırma açık). Daha önce taşınmış her yazıda henüz hatırlanmayan görseller indirilir ve yazının **bugünkü** metnine, dışa aktarmada izledikleri metin bloğunun arkasına (sözcükleriyle eşleşir; değiştirilmiş blok atlanır) eklenir (`workflows/migration/post-images.ts`, `lib/migration/body-images.ts` `insertImages`). Sahibin düzenlemeleri ve bağlantı düzeltmeleri kalır, `revised_at` değişmez. Yeniden çalıştırma hiçbir şeyi iki kez eklemez; eklendikten sonra sahibin çıkardığı görsel geri gelmez. Sayfalar (metni tema düzenleyicideki bölümlerde) yenilenmez; yeni taşımada sayfa gövdesinin görselleri de gelir. Sayılar: `post` (`updated`, `found` eklenecek görseli kalmamış, `skipped` taşınmamış ya da görselsiz, `failed` artık yok `migration.post_gone` / kaydı reddedildi `migration.post_images_failed`), `image` (`read`, `created`, `found`, `skipped`).
4. **Testler:** birim `sources/wordpress/__tests__/body-images.unit.spec.ts` (kapak, metin içi görsel, blok düzenleyici görseli, boyutlu dosya → özgün, srcset/tembel/CDN, başka alan adı düşer, galeri, picture, ürün açıklaması değişmedi), `lib/migration/__tests__/body-images.unit.spec.ts` (değiştirme, ekleme); HTTP `migration-wordpress-post-images.spec.ts` (yenileme: kuru, uygula, yeniden, sahibin çıkardığı); mevcut WordPress HTTP testlerinde görsel sayıları +1 ve yazının görsel bloğu.
