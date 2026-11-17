# Tezgâh: tasarım dili

> Hazır görünüm `packages/sector-packs/packs/cutlery/presets/tezgah/` (ve renk kardeşleri `tezgah-lacivert`, `tezgah-turuncu`). Tema Atölye, yön Grafit (`design.md`); bu not Grafit'in belirteçlerini kullanır, yeni belirteç tanımlamaz. Dayanak: sahibin klasik teknik katalog referansı (2026-11-15) ve sözü: "bir stratejiye, bir dünya görüşüne sadık kal; tasarım dili bir bütün olsun."

## Dünya görüşü

**Usta tezgâhı: her şey elinin altında, sıralı, etiketli; süs yok, ölçü var.**

Ziyaretçi bir alet arıyor. Önce nerede olduğunu (kategori listesi), sonra ne olduğunu (çelik, boy, fiyat) görür. Sayfa vitrin değil, düzenli bir raf: sık, hizalı, sakin. Cesaret tek yerde harcanır: grafit sahnedeki yakın plan.

**Yeni standart (sahip kararı 2026-11-17): dolu ve doyurucu.** Tezgâh, mağaza sahibinin "neler yapılabilir" sorusuna da cevaptır: hiçbir bölüm boş ya da deneme metniyle durmaz, her bölüm gerçek sözcük, gerçek bağlantı ve lisanslı demo görseliyle dolu gelir; aynı biçim ana sayfada iki kez kullanılmaz (sekmeli rafın üç kategori rafı hariç). Demo mağazada çizilmeyecek bölüm (yazısı olmayan "Yazılar", iletişim bilgisi girilmemiş mağazada "Yardım" kutusu) görünüme konmaz: görünmeyen veri bırakılmaz. Bu karar aşağıdaki iki eski kuralı değiştirdi: açılış artık dört slaytlı ve kendi kendine döner, kayan kategori şeridi var (bkz. Hareket).

## Kurallar

**Yoğunluk.** Sık. İlk ekranda kategori listesi, açılış (iki kategori döşemesi, dört hızlı bağlantı) ve güvence şeridi birlikte görünür. Açılış masaüstünde derli toplu kalır (1280–1920 px’te ~570–610 px): slayt metni kısa, tek düğme, küçük ürün yok; slaytın yazı yarısı satırın üçte birinden dar ve oklarla paylaşılır, küçük ürünler ve ikinci düğme açılışı ~900 px’e uzatıp kategori listesinin satırlarını açıyordu (2026-11-17). Sekmeli raf iki sıra yerine dört kartlık tek kayan sıra; yeni gelenler sahne ve liste; indirimdekiler sıralı liste (bir büyük + dört); çok satanlar sekiz çapraz şerit; kısa listeler üç sütun.

**Üst bilgi.** Sade katalog üst bilgisi: arama simge (`search_style: icon`), araçlar menü satırında (`tools_place: row`), ince açık şeritte not + üst menü bağlantıları. Şerit notu mağaza bilgisini yer tutucuyla yazar: "{ücretsiz_kargo_eşiği} üzeri siparişlerde kargo bedava"; vitrin okurken doldurur, mağaza eşik girmemişse not hiç görünmez (yarım cümle yok). Menüler görünümle gelir (`menus.json`): ana menü yedi üst kategori ve çocukları, "Kategoriler" ve menü çubuğu resimli (`menu_images: all`, resim kategorinin kendisinden); üst menü Sipariş takibi, Markalar, Yorumlar; alt bilgide üç sütun. Görünümü uygulayıp yayınlayan mağazanın menüleri bu menülerle değişir (adr/0063 §3).

**Köşe.** Keskin (`radius: sharp`, Grafit ölçeğinin 0,2'si: 4 / 3 / 2 px). Düğme kare (`buttons: square`). Çip, rozet ve sayaç tema gereği hap kalır; onlar etiket, yüzey değil.

**Çizgi.** Yüzeyleri gölge değil 1 px `rule` çizgi ayırır. Kart çerçeveli (`product_card.variant: framed`), gölgesiz; güvence şeridi çizgilerle bölünmüş kutular (`trust_badges: lined`). Gölge yalnız açılır katmanda (temanın `--shadow-float`). Alt sayfalar da aynı dili konuşur: tema ayarı "Kutu stili" `surface_style: lined` (sektörsüz; varsayılan `filled`) ürün sayfasının bilgi kutularını ve puan özetini, kategori sayfasının filtre gruplarını, "Filtrele"/"Sırala" düğmelerini ve alt kategori döşemelerini (gradyansız satır: küçük kare görsel + ad), sepet ve sepet çekmecesindeki kutuları sayfa zemininde 1 px çizgiyle çizer (üçüncü denetim Z-04, Z-05); 2026-11-15'ten beri hesap, sipariş, ödeme, ödeme bağlantısı ve içerik sayfalarının kutularını ve ana sayfa bölümlerinin kutularını da (SSS, yazılar, bülten, hikâye, Google puanı); kutu içindeki kutu çizgisiz tona iner (adr/0067 Ek 2026-11-15).

**Alt sayfaların sonu.** Ürün sayfası çıkmaz sokak değildir: ana bölümün altında çizgili güvence şeridi, "Benzer ürünler" (aynı kategori, `related_products: carousel`, sekmeli rafın kaydırma takımı: kare oklar başlığın yanında, otomatik geçiş yok) ve dört soruluk "Bu ürünle ilgili sık sorulanlar". Kategori sayfasının altında çizgili güvence şeridi (`trust_badges: lined`, `placement: bottom`). (Üçüncü denetim Z-01.)

**Boşluk ritmi.** Bölüm aralığı Sık: tema ayarı `section_spacing: compact` (temanın aralığının 0,55 katı; 1440'ta ~53 px, telefonda ~26 px; her bölümde aynı, adr/0049 Ek 2026-11-15 bölüm aralığı). Bölümlerin kendi dış boşluğu temanınki (`look.space_outer: null`). İki istisna: açılışın hemen altındaki güvence şeridi `none` (açılışa yapışık, ilk ekranda); kuyu zeminli bantlarda iç boşluk `medium` (bölüm aralığına eşit). Başka boşluk ayarı yok. (2026-11-15 tarayıcı denetimi K-02/K-11: "Sık" ile "temanın aralığı" çelişkisi bu ayarla kalktı.)

**Yazı.** Inter, başlık ve gövde (`typography: inter / inter`): nötr, sık, rakamları düz. Ölçek Grafit'inki; başlık tek boy (bölüm `h2`), üst etiket yalnız açılışta ("Atölyeden tezgâha", sahibin taslaktaki seçimi 2026-11-17), başlıkta renkli kelime yok. Metin bilgi verir: "Her modelin çeliği, namlu boyu ve sertliği ürün sayfasında yazılı." Düğme ne olacağını söyler; "→" yok. "Tümünü gör" tek biçim: bölüm başlığının sağında düz metin bağlantı, "Tüm <ne>" sözcük düzeni ("Tüm av bıçakları", "Tüm indirimler"); ortada duran çerçeveli düğme yok.

**Renk: vurgu nerede.** Takım iki renk taşır: *eylem rengi* (`colors.primary`) ve *taban rengi* (`colors.accent`).
- Eylem rengi yalnız eylemde: birincil düğme, bağlantı, odak halkası; kartın düğmesi durağanken çerçeveli ve nötr, kartın üzerine gelinince ya da düğme odaktayken eylem renginde (bir sıra kart bir sıra dolu düğme olmaz). Başlıkta, zeminde, süste, fiyat bandının büyük rakamında yok (rakam mürekkep rengi).
- Taban rengi seçimde: seçili raf sekmesi, seçili seçenek, sayaç.
- İndirim temanın kendi kırmızısı (`deal`, `#be2323`). Eylem rengi indirim kırmızısına yakın okunan takımda indirim renge yaslanmaz: rozet grafit zeminde açık yazı, indirimli fiyat mürekkep rengi; üstü çizili eski fiyat ve rozet indirimi söyler (tema bunu kendisi yapar, `readsNearSale`). "Yakın": sıcak ton (kırmızıdan 15° önce başlayıp turuncu ve kehribar dahil 45°'ye kadar) ve doygun (HSL doygunluğu ≥ 0,45); böyle bir rengin indirim kırmızısıyla kontrastı 1:1'e yakındır, iki renk aynı aileden okunur. Kırmızı ve turuncu takımda indirim grafit rozettir; lacivert takımda indirim kırmızı kalır.
- Menü çubuğu her takımda grafit (`menu_ground: stage`): tezgâhın kendisi, renk takımıyla değişmez. Çubuğun vurgulu bağlantısı sahnenin açık mürekkebiyle yazılır, renkli değil.

**Renk takımları ve kontrast** (WCAG oranı; sayfa `#f8fafc`, alan `#fcfdfe`, grafit çubuk `#11151a`, indirim `#be2323`; 2026-11-15 ikinci denetimden sonra lacivert ve turuncu yeniden ayarlandı):

| Takım | Eylem (`primary`) | Beyaz yazı | Sayfada | Çubukta (sepet sayacı) | İndirimle | Taban (`accent`) | Beyaz yazı | Çubukla | İndirim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tezgâh (kırmızı) | `#b3261e` | 6,54 | 6,25 | 2,80 | 1,08 | `#2e3338` | 12,75 | 1,44 | grafit rozet |
| Lacivert | `#33709c` (eski `#2f6690`) | 5,33 | 5,10 | 3,44 (eski 2,99) | 1,14 | `#1f4f8f` (eski `#1c2b4a`) | 8,16 | 2,25 (eski 1,30) | kırmızı |
| Turuncu | `#b03b0b` (eski `#c2410c`) | 6,04 | 5,77 (eski 4,95) | 3,03 | 1,01 | `#2e3338` | 12,75 | 1,44 | grafit rozet |

Lacivert takımın tabanı artık grafitten ayrışan bir mavi (seçili sekme lacivert okunur); eylem mavisi sayacı çubukta 3:1'in üstüne çıkacak kadar açıldı, sayfada 4,5:1'in üstünde kaldı. Turuncu, sayfada metin bağlantısı olarak rahat okunacak kadar koyulaştı. Grafit çubukta sepet sayacı artık takımın renginde değil: sahnenin açık mürekkebi üstünde grafit rakam (her takımda yaklaşık 16:1; üçüncü denetim C). Tablodaki "Çubukta" sütunu sayfadaki sayaçlar ve telefon alt çubuğu içindir.

**Zemin sırası.** Sayfa zemini çelik beyazı (`steel`). Ritim: açık bölümler arasına iki kuyu bandı (`look.ground: well`) ve grafit sahneler (sahne ve listenin sahnesi, yakın plan, kayan şerit). Kuyu bandının iç boşluğu `medium`. Kuyu bandı iki kez üst üste gelmez, alt bilginin kuyusuna da yapışmaz. Sıra 2026-11-17'den beri (sahibin taslaktaki seçimleri + dolu standart):

| Sıra | Bölüm | Zemin |
| --- | --- | --- |
| 1 | Açılış: kategori listesi + dört slaytlı giriş, iki kategori döşemesi, hızlı bağlantılar | sayfa (liste kendi kuyusunda) |
| 2 | Güvence şeridi | sayfa |
| 3 | Yeni gelenler: sahne ve liste (`stage_list`) | sayfa, sahnesi grafit |
| 4 | Kullanıma göre: kategori kolajı | kuyu |
| 5 | Yakın plan, şeritli galeri yanda (`gallery: strips`, `strips_layout: side`) | grafit sahne |
| 6 | Sekmeli raf: av, kamp, şef bıçakları | sayfa |
| 7 | Fiyata göre: dört etiketli bant, görselsiz | sayfa |
| 8 | İndirimdekiler: sıralı liste, bir büyük + dört (`ranked`, `lead`) | sayfa |
| 9 | Tezgâhtan seçmeler: şerit galerisi, beş fotoğraf | sayfa |
| 10 | Üç kısa liste (kılıçlar, bıçak setleri, kasap bıçakları) | sayfa |
| 11 | Kampanya bandı: mutfak bıçak setleri | fotoğraf |
| 12 | Çok satanlar: sekiz çapraz şerit (`strips`) | sayfa |
| 13 | Markalar | kuyu |
| 14 | Kayan kategori şeridi: yıldız ayraç, büyük harf | grafit sahne |
| 15 | Müşteri yorumları | sayfa |
| 16 | Sık sorulanlar: altı soru | sayfa |
| - | Alt bilgi (marka ve sütunlar; e-bülten bandı en üstte) | Hafif ton (`well`) |

**Raflar arasında ayraç.** Tema yan yana duran ürün raflarını tek sekmeli rafa birleştirir; boş kalan bölüm vitrinde düşer. Sekmeli raf bilerek yalnız üç kategori rafıdır (av, kamp, şef). Başka iki ürün bölümü yan yana gelmez: aralarında her mağazada çizilen bir bölüm durur (fiyat bantları, şerit galerisi, kampanya bandı). Yakın plan mağazanın bir ürününe bağlıdır, ayraç sayılmaz. Bilinen sınır: paketin kategorileri yeni mağazada gizli açılır; mağaza onları açana kadar kategoriye bağlı bölümler (kolaj, sekmeli raf, kısa listeler) çizilmez.

**Yeni mağazada.** Görünüm demo kataloğun ürünlerini ve alt kategorilerini anar; olmayan yalnız kendisi düşer (adr/0063 §5): açılışın döşemeleri tek tek çıkar, açılış kalır; yakın plan ürünü olmayınca bölüm düşer; demo'nun alt kategorilerine (santoku, multitool, bileme) giden bağlantılar temizlenir, öğe bağlantısız kalır; menüde o alt kategoriler çıkar.

**Kart.** Her yerde çerçeveli kart: kare fotoğraf, marka, iki satır ad, puan (yalnız yorumu olanda; boş yıldız yok), fiyat, tek durum satırı (ücretsiz kargo), ayakta tam genişlik düğme ("Sepete ekle" ya da "Seçenekler", ikisi aynı biçim). Çok satanların büyük kartında fotoğraf alanı fotoğrafın kendi oranını alır (geniş fotoğrafın üstünde ve altında gri bant kalmaz; uzun fotoğraf 34rem'de durur), fotoğraf kırpılmaz ve büyütülmez; yanındaki iki sıranın kalanını büyük adlı bilgi bloğu doldurur, düğme ayakta (ikinci denetim Y-01, üçüncü denetim D-4). İkinci fotoğrafa geçiş kapalı (`hover_image: false`): kart kıpırdamaz. Kısa listeler kompakt kart.

**Kategori kartları.** 2026-11-15'ten beri fotoğraflı kolaj (`categories.variant: collage`, adr/0049 Ek 2026-11-15): ilk kategori öne çıkar (`lead: on`, iki kat geniş), sırada en çok dört kart (`columns: 4`), fotoğraf orta yükseklikte, adın altında en çok beş alt kategori (`links: 5`), sayılar açık. Yalnız üst kategoriler: Outdoor ve Kamp, Mutfak ve Şef Bıçakları, Çakılar (2026-11-17'den beri; demo katalogda Kasap Bıçakları'nın alt kategorisi yok, Çakılar'ınki var). Aynı sıradaki kartlar eşit yükseklikte; içerik üstte hizalı, alt kategorisi olmayan kartın altında kart zemini kalır. Kartın tamamı kategoriye gider, kart başına "Tümünü gör" yok (bölüm başlığındaki "Tüm kategoriler" var).

Önceki hâl (biçim olarak duruyor, başka görünümler seçebilir): alt kategori bağlantılı kart (`categories.variant: linked`), üç sütun, görsel yanda, 1 px çizgili çerçeve (`frame: lined`), adın altında en çok beş alt kategori. Vitrinde gösterilecek alt kategorisi kalmayan kart tek bağlantıdır: görsel, ad ve ürün sayısı kadar yüksek, satırın üstüne hizalı; komşularının listesine gerilmez, boş alan kalmaz (ikinci denetim K-08). "Tümünü gör" kartın ayağında, oksuz.

**Alt bilgi.** "Marka ve sütunlar" biçimi (`variant: brand_columns`; adr/0049 Ek 2026-11-17): en üstte e-bülten kutusu "Yan yana bant" biçiminde (`newsletter.variant: split`, görünüm sürümü 9: solda başlık ve açıklama `description`, sağda form ve altında kısa güvence satırı `note`; `text` boş bırakılır, çünkü o alan onay kutusunun yanındaki İYS onay cümlesidir ve vitrinin yasal cümlesi çizilir), altında iletişim yolları şeridi (`top_strip: true`), mağaza adının altında kısa tanıtım (`about`; mağaza diliyle, fiyat ve iddia yok), üç menü sütunu, sosyal hesaplar simgeyle (`social: icons`). Zemin Hafif ton (`ground: well`); koyu alt bilgi sahibin beğenisine uymadı (2026-11-05), Tezgâh'ta kullanılmaz. Ödeme yolları (Visa, Mastercard, Troy, havale/EFT, kapıda ödeme) kart ağları için markanın resmî logosuyla, değiştirilmeden, yalnız kabul işareti olarak, her biri küçük beyaz kartta (`badge_style: card`); diğerleri yazıyla. Hazır görünüm mağaza adına kabul iddiası taşımasın diye listeye `amex` konmaz; mağaza kendisi ekler. Kaynak ve kullanım kuralları `public/marks/README.md`. Önceki biçim `ledger`'dı (görünüm sürümü 7'de `brand_columns`'a geçti). Yukarı çık düğmesi sağda, kare (`back_to_top_shape: square`), telefonda da açık; ziyaretçi kaydırınca belirir, kendi kendine oynamaz. Düğme 40 px; 1024 px üstünde sayfanın 48 px kenar boşluğunun içinde (içerik örtülmez). Hiçbir genişlikte içerik sütununun üstüne binmez (dördüncü denetim, örtüşme 0 px): 641–1024 px arasında 24 px kenar boşluğunun içinde ekran kenarına yapışık 20 × 44 px bir sekme (alt gezinmenin ve WhatsApp düğmesinin üstünde); 640 px ve altında kenar boşluğu 16 px ve raflar ekran kenarına kadar uzadığı için yüzen düğme yoktur: 40 px düğme alt bilginin üst çizgisinin üstüne oturur (sayfayla kayar; alt bilgi ile sayfa arasındaki boş bantta) ve WhatsApp düğmesi onun için kenara çekilir; düğme açıkken alt bilgi satırındaki metin "Yukarı çık" çizilmez.

**Hareket.** 2026-11-17'den beri (sahip kararı) iki şey kendi kendine oynar: açılışın dört slaytı (otomatik geçiş, döngü, noktalar, yuvarlak oklar; fareyle üstüne gelince durur) ve kayan kategori şeridi (yavaş, sola, üstüne gelince durur, durdur düğmesi). Hareketi azalt tercihi olan ziyaretçide ikisi de durur (temanın kuralı). Ürün raflarında otomatik geçiş kapalı. Raflarda kaydırma takımı yalnız sekmeli rafta ve benzer ürünlerde: masaüstünde dört kart, telefonda bir sonrakinin ucu görünür, oklar her zaman başlığın yanında ve kare (`arrows: always`, `arrow_style: square`, `arrow_position: head`; sekmeli rafta geniş ekranda sekme satırının sağ ucunda, rafın "Tüm …" bağlantısıyla birlikte, kartlar hemen altında; 1024 px altında haplar tek satırda yana kayar, ekran kenarına uzanır ve kesik ucu solar; bağlantı ve oklar kartların altında, bağlantı tam genişlikte sessiz düğme: adr/0049 Ek 2026-11-16), nokta yok, döngü yok, fareyle sürükleme yok. Hareket yalnız ziyaretçinin yaptığına cevap.

## Referanstan bilinçli ayrılınan yerler

| Referansta | Tezgâh'ta | Neden |
| --- | --- | --- |
| Sarı menü çubuğu ve sarı düğmeler | Grafit çubuk, eylem rengi yalnız düğmede | Sahip sarı, krem, bakır istemiyor; renk bir şey söylediği yerde kalır |
| Kartlarda gölge, kutu içinde kutu | 1 px çizgili tek kutu | Gölge yalnız üstte duran katmana |
| NEW / HOT / SALE rozet yığını | Yalnız indirim rozeti (temanın) | Bağıran rozet bilgi taşımaz |
| Fotoğraflı görsel bant | Lisanslı demo fotoğraflarıyla açılış slaytları, şerit galerisi ve kampanya bandı (2026-11-17'den beri); fiyat bantları görselsiz | Her görselin kaynağı ve lisansı `preset.json` `credits`'te (CC BY, CC BY-SA, kamu malı); mağaza kendi fotoğrafıyla değiştirir |
| Rafta "All" sekmesi + kategori sekmeleri | Yan yana raflar sekme olur: "Yeni gelenler" + üç kategori | Temanın sekme kuralı; "Tümü" yerine en yeniler |
| Haber kartları oklu | Yazılar bölümü yok (2026-11-17) | Demo mağazada yazı yok; çizilmeyecek bölüm görünüme konmaz. Mağaza yazı yazınca bölümü kendisi ekler |

## Bir ayar bu notla çelişiyorsa

Kusurdur. Yeni bir bölüm eklenirken önce zemin sırasına ve vurgu kuralına bakılır.
