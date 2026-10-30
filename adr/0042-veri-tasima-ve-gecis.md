# ADR-0042: Veri taşıma ve geçiş

- **Durum:** Önerildi (2026-10-30; kullanıcının "önerileni uygula" kuralıyla otonom kabul, PROGRESS "Gözden geçir"de)
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
