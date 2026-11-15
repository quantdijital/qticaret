# Tezgâh: tasarım dili

> Hazır görünüm `packages/sector-packs/packs/cutlery/presets/tezgah/` (ve renk kardeşleri `tezgah-lacivert`, `tezgah-turuncu`). Tema Atölye, yön Grafit (`design.md`); bu not Grafit'in belirteçlerini kullanır, yeni belirteç tanımlamaz. Dayanak: sahibin klasik teknik katalog referansı (2026-11-15) ve sözü: "bir stratejiye, bir dünya görüşüne sadık kal; tasarım dili bir bütün olsun."

## Dünya görüşü

**Usta tezgâhı: her şey elinin altında, sıralı, etiketli; süs yok, ölçü var.**

Ziyaretçi bir alet arıyor. Önce nerede olduğunu (kategori listesi), sonra ne olduğunu (çelik, boy, fiyat) görür. Sayfa vitrin değil, düzenli bir raf: sık, hizalı, sakin. Cesaret tek yerde harcanır: grafit sahnedeki yakın plan.

## Kurallar

**Yoğunluk.** Sık. İlk ekranda kategori listesi, açılış ve güvence şeridi birlikte görünür. Sekmeli raf iki sıra yerine dört kartlık tek kayan sıra; çok satanlar bir büyük + altı küçük; kısa listeler kompakt kartla.

**Köşe.** Keskin (`radius: sharp`, Grafit ölçeğinin 0,2'si: 4 / 3 / 2 px). Düğme kare (`buttons: square`). Çip, rozet ve sayaç tema gereği hap kalır; onlar etiket, yüzey değil.

**Çizgi.** Yüzeyleri gölge değil 1 px `rule` çizgi ayırır. Kart çerçeveli (`product_card.variant: framed`), gölgesiz; güvence şeridi çizgilerle bölünmüş kutular (`trust_badges: lined`). Gölge yalnız açılır katmanda (temanın `--shadow-float`).

**Boşluk ritmi.** Bölüm aralığı Sık: tema ayarı `section_spacing: compact` (temanın aralığının 0,55 katı; 1440'ta 66 px, fiyat bantlarında 53 px). Bölümlerin kendi dış boşluğu temanınki (`look.space_outer: null`). İki istisna: açılışın hemen altındaki güvence şeridi `none` (açılışa yapışık, ilk ekranda); kuyu zeminli bantlarda iç boşluk `medium`. Başka boşluk ayarı yok. (2026-11-15 tarayıcı denetimi K-02/K-11: "Sık" ile "temanın aralığı" çelişkisi bu ayarla kalktı.)

**Yazı.** Inter, başlık ve gövde (`typography: inter / inter`): nötr, sık, rakamları düz. Ölçek Grafit'inki; başlık tek boy (bölüm `h2`), büyük harfli üst etiket yok, başlıkta renkli kelime yok. Metin bilgi verir: "Her modelin çeliği, namlu boyu ve sertliği ürün sayfasında yazılı." Düğme ne olacağını söyler; "→" yok. "Tümünü gör" tek biçim: bölüm başlığının sağında düz metin bağlantı, "Tüm <ne>" sözcük düzeni ("Tüm av bıçakları", "Tüm indirimler"); ortada duran çerçeveli düğme yok.

**Renk: vurgu nerede.** Takım iki renk taşır: *eylem rengi* (`colors.primary`) ve *taban rengi* (`colors.accent`).
- Eylem rengi yalnız eylemde: birincil düğme, bağlantı, odak halkası; kartın düğmesi durağanken çerçeveli ve nötr, kartın üzerine gelinince ya da düğme odaktayken eylem renginde (bir sıra kart bir sıra dolu düğme olmaz). Başlıkta, zeminde, süste, fiyat bandının büyük rakamında yok (rakam mürekkep rengi).
- Taban rengi seçimde: seçili raf sekmesi, seçili seçenek, sayaç.
- İndirim temanın kendi kırmızısı (`deal`). Eylem rengi kırmızı okunan takımda (varsayılan `#b3261e`) indirim renge yaslanmaz: rozet grafit zeminde açık yazı, indirimli fiyat mürekkep rengi; üstü çizili eski fiyat ve rozet indirimi söyler (tema bunu kendisi yapar, `readsAsRed`). Lacivert ve turuncu takımlarda indirim kırmızı kalır.
- Menü çubuğu her takımda grafit (`menu_ground: stage`): tezgâhın kendisi, renk takımıyla değişmez. Çubuğun vurgulu bağlantısı sahnenin açık mürekkebiyle yazılır, renkli değil.

**Zemin sırası.** Sayfa zemini çelik beyazı (`steel`). Ritim: açık bölümler arasına iki kuyu bandı (`look.ground: well`) ve tek grafit sahne. Kuyu bandının iç boşluğu `medium`. Kuyu bandı iki kez üst üste gelmez, alt bilginin kuyusuna da yapışmaz.

| Sıra | Bölüm | Zemin |
| --- | --- | --- |
| 1 | Açılış: kategori listesi + giriş | sayfa (liste kendi kuyusunda) |
| 2 | Güvence şeridi | sayfa |
| 3 | Sekmeli raf (yeni gelenler + üç kategori) | sayfa |
| 4 | Yakın plan | grafit sahne (bölümün kendisi) |
| 5 | Fiyata göre: dört etiketli bant, görselsiz | sayfa |
| 6 | Çok satanlar: 1 büyük + 6 küçük | sayfa |
| 7 | Kullanıma göre kategori kartları | kuyu |
| 8 | İndirimdekiler, kompakt | sayfa |
| 9 | Yazılar | sayfa |
| 10 | Markalar | kuyu |
| 11 | Üç kısa liste | sayfa |
| 12 | Müşteri yorumları | sayfa |
| - | Alt bilgi (e-bülten + defter) | temanın kuyusu |

**Raflar arasında ayraç.** Tema yan yana duran ürün raflarını tek sekmeli rafa birleştirir; boş kalan bölüm vitrinde düşer. Bu yüzden iki ayrı raf arasına her mağazada çizilen bir bölüm konur: sekmeli raf ile çok satanlar arasında fiyat bantları (sabit metin, görselsiz), çok satanlar ile indirimdekiler arasında kategori kartları. Yakın plan mağazanın bir ürününe bağlıdır, ayraç sayılmaz. Bilinen sınır: paketin kategorileri yeni mağazada gizli açılır; mağaza onları açana kadar kategori kartları çizilmez ve çok satanlar ile indirimdekiler tek sekmeli rafta birleşir.

**Kart.** Her yerde çerçeveli kart: kare fotoğraf, marka, iki satır ad, puan (yalnız yorumu olanda; boş yıldız yok), fiyat, tek durum satırı (ücretsiz kargo), ayakta tam genişlik düğme ("Sepete ekle" ya da "Seçenekler", ikisi aynı biçim). Çok satanların büyük kartında fotoğraf yanındaki iki sırayı doldurur, yazı ayağa yaslanır. İkinci fotoğrafa geçiş kapalı (`hover_image: false`): kart kıpırdamaz. Kısa listeler kompakt kart.

**Kategori kartları.** Raf etiketi gibi: alt kategori bağlantılı kart (`categories.variant: linked`), üç sütun, görsel yanda, 1 px çizgili çerçeve (`frame: lined`), adın altında en çok beş alt kategori, sayılar açık. Yalnız alt kategorisi olan üst kategoriler (paketin iskeletinde: Outdoor ve Kamp, Mutfak ve Şef Bıçakları, Kasap Bıçakları). Vitrinde gösterilecek alt kategorisi kalmayan kart tek bağlantıdır: görsel, ad ve ürün sayısı satır yüksekliğinde ortalanır, boş liste alanı ayrılmaz. "Tümünü gör" kartın ayağında, oksuz.

**Alt bilgi.** Sosyal hesaplar simgeyle (`social: icons`), ödeme yolları yazılı rozetle (Visa, Mastercard, Troy, havale/EFT, kapıda ödeme; şirket logosu yok). Yukarı çık düğmesi sağda, kare (`back_to_top_shape: square`), telefonda da açık; ziyaretçi kaydırınca belirir, kendi kendine oynamaz. Geniş ekranda 40 px, sayfanın kenar boşluğunun içinde (içerik örtülmez); düğme açıkken alt bilgi satırındaki metin "Yukarı çık" çizilmez.

**Hareket.** Kendi kendine oynayan hiçbir şey yok: kayan yazı şeridi yok, otomatik geçiş her rafta kapalı. Kaydırma takımı yalnız sekmeli rafta: masaüstünde dört kart, telefonda bir sonrakinin ucu görünür, oklar her zaman başlığın yanında ve kare (`arrows: always`, `arrow_style: square`, `arrow_position: head`; sekmeli rafta geniş ekranda sekme satırının sağ ucunda, rafın "Tüm …" bağlantısıyla birlikte, kartlar hemen altında), nokta yok, döngü yok, fareyle sürükleme yok. Hareket yalnız ziyaretçinin yaptığına cevap.

## Referanstan bilinçli ayrılınan yerler

| Referansta | Tezgâh'ta | Neden |
| --- | --- | --- |
| Sarı menü çubuğu ve sarı düğmeler | Grafit çubuk, eylem rengi yalnız düğmede | Sahip sarı, krem, bakır istemiyor; renk bir şey söylediği yerde kalır |
| Kartlarda gölge, kutu içinde kutu | 1 px çizgili tek kutu | Gölge yalnız üstte duran katmana |
| NEW / HOT / SALE rozet yığını | Yalnız indirim rozeti (temanın) | Bağıran rozet bilgi taşımaz |
| Fotoğraflı görsel bant | Mağazanın kendi ürünüyle grafit yakın plan, ardından görselsiz fiyat bantları | Depoya lisanssız görsel girmez; mağazanın kendi fotoğrafı kullanılır, bant görevi (kataloğa giriş) fiyat etiketleriyle görülür |
| Açılışta slayt noktaları | Durağan açılış, fotoğraf mağazanın en yeni ürünü | Kendi kendine dönen giriş yok |
| Rafta "All" sekmesi + kategori sekmeleri | Yan yana raflar sekme olur: "Yeni gelenler" + üç kategori | Temanın sekme kuralı; "Tümü" yerine en yeniler |
| Haber kartları oklu | Yazılar temanın ızgarasında | Kaydırma takımı bugün yalnız ürün rafında |

## Bir ayar bu notla çelişiyorsa

Kusurdur. Yeni bir bölüm eklenirken önce zemin sırasına ve vurgu kuralına bakılır.
