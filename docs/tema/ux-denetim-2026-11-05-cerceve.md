# UX denetimi: çerçeve, ana sayfa, liste ve arama (2026-11-05)

> Sahip (2026-11-05): "web sitemizin arayüzünde mobil ve laptoplarda responsive alanlar, UX akışını bozacak veya UX açısından daha iyi, verimli olabilecek alanları incele ve önerilerini uygula." Sahip yokken karar verildi ve uygulandı; Grafit görünümü (`design.md`, kilitli) değişmedi, yalnız akış ve ölçüler inceltildi. Yeni kurallar `design.md`'de.
> Kapsam: çerçeve (duyuru şeridi, başlık, arama, mega panel, telefon çekmecesi, alt gezinme, WhatsApp düğmesi, çerez kartı, alt bilgi), ana sayfa, kategori/marka/`/magaza`/kampanya listeleri ve arama sonuçları. Ürün, sepet, ödeme, hesap ve içerik sayfaları ayrı denetimde.

## Yöntem

Gerçek tarayıcı (Chrome, puppeteer-core), `localhost:8000` (`STOREFRONT_THEME=atolye`, dev mağaza verisi). Görünümler: telefon 360×740, 390×844, 430×932 (dokunmatik); tablet 768×1024 (dokunmatik); 1024×768; dizüstü 1280×800, 1366×768, 1440×800, 1470×820 (MacBook Air), 1512×860 (MacBook Pro 14); 1920×1080. Sayfalar: `/`, `/kategori/el-yapimi-caki` (8 alt kategori), `/magaza?stok=var&namlu_celigi=n690` (iki süzgeç açık), `/kampanyalar`, `/arama?q=çakı`, sonuçsuz arama (`/arama?q=xqzvw`); durumlar: mega panel açık (Çakılar, Outdoor & Kamp; sayfa başında ve kaydırılmışken), telefon çekmecesi (kapalı ve bir kategori açık), canlı arama paneli ("çakı"), ilk ziyarette çerez kartı, odak sırası (Tab ×22), telefon süzgeç sayfası ve "N ürünü göster" inişi.

Her sayfa × görünüm için ölçülen: ilk ekranda ne var (h1, ana eylem, ilk ürün kartının üstü), yatay taşma (kaydırma kutusuna ait olmayan, ekrandan taşan her öğe), yapışkan başlığın kaydırılmış yüksekliği, WhatsApp düğmesinin altında kalan denetimler (sayfa yarım ekran adımlarla inilerek; sonra her adımda 60 px geri dönülerek), 44 px altı dokunma hedefleri (cümle içi bağlantı ve kartın tamamını kaplayan bağlantı hariç), birden çok satıra kırılan fiyat, tek kelimesi alt satıra düşen başlık, kart fotoğrafının görünen/indirilen genişliği, CLS (`PerformanceObserver` `layout-shift`, yükleme + bütün sayfa kaydırması).

Ekran görüntüleri ve ölçümler (depoya girmez): `…/scratchpad/agent-ux-frame/before/` ve `…/after/` (`metrics.json`, `states.json`, sayfa-görünüm başına ilk ekran, 390 ve 1366'da kaydırılmış, 390 ve 1440'ta tam sayfa).

## Bulgular ve uygulanan düzeltmeler

| # | Nerede | Görünüm | Sorun | Etki | Düzeltme |
| --- | --- | --- | --- | --- | --- |
| 1 | Başlık (yapışkan) | 1024–1512, kısa dizüstü | Kaydırırken başlık 133 px kalıyor: 768 px yüksek ekranın %17'si, 800'ün %17'si. Liste sayfasında bir kart satırının üçte biri başlığın altında. | Her kaydırmada içerik alanı küçük; 1366×768'de bir ekranda 1,5 kart satırı. | Aşağı kayınca reyon satırı üst satırın (yazı markası, arama, hesap, favoriler, sepet) arkasına katlanır: 81 px (%10). Yukarı 24 px dönünce açılır; sayfa başında, başlıkta odak varken, kategori paneli açıkken hep açık. Yalnız `transform`. |
| 2 | Başlık (yapışkan) | 360–768 | 117 px başlık + 65 px alt gezinme: 360×740'ta ekranın %25'i hep çerçeve. | Telefonda bir ekranda bir buçuk kart satırı. | Aşağı kayınca üst satır (menü, yazı markası, favoriler, sepet) yukarı kayar, arama kalır: 61 px. Menü, sepet ve hesap alt gezinmede. Yukarı dönünce geri gelir. |
| 3 | Liste, Filtrele/Sırala | 360–768 | Haplar yalnız listenin başında; 24 ürünlük sayfanın ortasında süzmek ya da sıralamak için en başa dönmek gerekiyor. | Uzun kategoride (58 ürün) süzgeç geç kullanılıyor. | İki hap başlığın altında yapışkan dolgu şerit (takılınca altında ince çizgi); ızgara altından geçer, başlık katlanınca şerit onunla yukarı çıkar. Aralıklar aynı (sayı → hap 12 px, haplar → çipler 16, → ızgara 24). |
| 4 | WhatsApp düğmesi | tümü (en çok 360–1470) | Kaydırırken sağ sütundaki kartların "+" hızlı ekle düğmesini, 390'da kategori ilk ekranında "Sırala" hapının ucunu, SSS satırlarını, alt bilgi menüsünü, 768'de e-bülten alanını ve "Abone ol"u örtüyor (390 kategori: 16 denetim). | Yanlış basış; sepete ekleme ve e-bülten engelleniyor. | Sayfa aşağı kayarken düğme çekilir (opaklık + küçülme, basılmaz), yukarı dönünce ve sayfa başında yerinde; telefonda ızgara sabit hap şeridinin altından geçerken, 1024 px'ten liste sayfasının başı dışında (1280–1470'te düğme kabın sağ kenarına biner, sağ sütunun "+"sı altında kalır) ve bir alana yazılırken gizli. Klavyeyle odaklanınca görünür. |
| 5 | Çerez kartı | 360×740 | 244 px kart açılışın birincil düğmesini ("Çakıları incele") 27 px örtüyor; metin, yalnız yeniden açılınca çıkan kapat düğmesi için sağda 40 px boş bırakıyor (bir satır fazla). | İlk ziyarette ana eylem kartın altında. | Kapat düğmesinin yeri yalnız düğme varken; telefonda iç boşluk 12/8 px, satır arası 4 px: 212 px, düğmenin 5 px altında başlıyor. |
| 6 | Arama alanı | 360 | Örnek yazı "…marka ar" diye kesik: boş alanda da temizle düğmesine 96 px ayrılıyor. | Alanın ne aradığı yarım okunuyor. | Boş alan sağda yalnız ara düğmesine yer bırakır (56 px); dolunca temizle düğmesi gelir. |
| 7 | Arama sonuçları, başlıktaki alan | tümü | `/arama?q=çakı` açılınca başlıktaki alan boş. | Aramayı düzeltmek için yeniden yazmak gerekiyor. | Sonuç sayfasında iki alan da aranan sözle açılır (betikten sonra; betiksiz form aynı). |
| 8 | Arama sonuçları, ilk ekran | 1366×768, 1440×800, 1470×820, 390 | İlk ürün satırı ekranın altında (788 / 802 / 803 px; 390'da 787 > 779). "İlgili kategoriler" 5 karo ve sağında 3 boş karo yeri, altında ayrı satırda marka hapları; telefonda markalar iki satır. | Arayan kişi ilk ekranda hiç sonuç görmüyor; masaüstünde boş cep. | 1024 px'ten karolar altı ya da daha azsa "Markaya göre daralt" karoların bıraktığı sütunlarda; telefonda marka hapları tek sıra, yana kayar. |
| 9 | Alt gezinme "Ara" | 360–768 | `/arama` sayfasını yüklüyor; aramak için sonra alana dokunmak gerekiyor. | İki dokunuş ve bir sayfa yüklemesi. | Betikle başlıktaki arama alanına odaklanır: klavye hemen açılır, canlı panel yazdıkça yanıtlar. Betiksiz `/arama` bağlantısı. |
| 10 | Telefon çekmecesi | 360–430 | Çekmece ekranın tamamı; perde görünmüyor, kapatmak için sağ üstteki X'e uzanmak gerekiyor. | Tek elle kapatmak zor (430 px telefonda başparmak). | Menü çekmecesi telefonda 56 px dar, iç kenarı yuvarlak: sağdaki perde şeridine dokunmak kapatır. Sepet çekmecesi tam genişlik kaldı (satırları dar). |
| 11 | Duyuru şeridi, alt bilgi, mega panel | 1024–1920 dokunmatik (iPad yatay) | Duyuru bağlantıları 36 px, alt bilgi bağlantıları 32–36 px, mega panelin alt kategorileri 40 px. | Dokunmatik geniş ekranda 44 px kuralının altında. | `pointer: coarse` iken 44 px; fareyle (`pointer: fine`) sıkı satırlar aynı (hepsi ≥ 24 px, WCAG 2.5.8). |
| 12 | Ana sayfa, hikâye bölümü | tümü | Mağaza metnindeki tek başına "Atölyemizi tanıyın" bağlantısı 22 px yüksek. | 24 px altı hedef (WCAG 2.5.8). | Metindeki bağlantılara 12 px dikey dokunma payı (satır içi dolgu, satırlar kıpırdamaz): 46 px. |
| 13 | Ana sayfa açılış sahnesi | 1024×768, 1366×768 | Sahne en az 30rem (480 px): 768 px yüksek ekranın %62'si; güvenceler şeridi ilk ekranda kesik. | Açılışın ayağı sayılan güvenceler yarım görünüyor. | En az 28rem: 768 px'te %58 kuralına iner (448 px), güvenceler ilk ekranda tam. 800 px ve üstünde değişiklik yok. |
| 14 | Kart fotoğrafları | 1024–1920 | Tarayıcıya her kart "30vw" deniyor: 1440'ta süzgeç panelli listede kart 325 px ama 432 px'lik görsel, 1920 ana sayfada 432 px kart için 576 px (~1,8 kat piksel). | Gereksiz indirme, yavaş ilk ekran. | `sizes` ızgaradan: raf 3 sütun (1440'ta 432 px), panelsiz 4 sütun (318 px / 22vw), panel yanında 3 sütun (325 px / `calc((100vw - 23rem) / 3)`). |
| 15 | Kart marka satırı | 360–430 | Uzun marka adı iki satıra kırılabiliyor, kartlar arasında ad ve fiyat hizası bozuluyor. | Izgarada eşit olmayan kartlar. | Marka tek satır (`truncate`). |

## Bakıldı, değişiklik gerekmedi

- **Yatay taşma:** 66 sayfa-görünümün hiçbirinde yok (ray ve kutular kendi içinde kayıyor).
- **CLS:** yükleme ve tam sayfa kaydırmasında her yerde 0; katlanan başlık, şerit ve WhatsApp yalnız `transform`/`opacity` ile hareket ediyor.
- **Mega panel:** 1024–1920 her genişlikte ekrana sığıyor (en alt kenar 478 px, 768 px yükseklikte), kabın içinde, altındaki hiçbir şey kaymıyor; 1024'te reyon tek satır (7 kategori). Kaydırılmış sayfada da başlığın altında açılıyor; panel açıkken başlık katlanmıyor.
- **Telefon çekmecesi:** satırlar 56 px, çocuklar 44 px, kendi içinde kayıyor; odak geri dönüyor.
- **Canlı arama paneli:** masaüstünde 576 px, 768 px yükseklikte sığıyor; telefonda ekran klavyesine göre kısalıyor (görünür alan).
- **Fiyatlar:** hiçbir kartta kırılmıyor (ölçümdeki iki satır ekran okuyucunun "Önceki fiyat:" önekiydi).
- **Başlık kırılımları:** tek kelimesi alta düşen başlık yok; iki kelimelik kategori adları karoda dengeli iki satır.
- **Odak sırası:** telefonda atlama bağlantısı → menü → yazı markası → favoriler → sepet → arama → açılış düğmesi → reyonlar; masaüstünde duyuru bağlantıları → yazı markası → arama → hesap → favoriler → sepet → reyonlar → açılış. Görünür sırayla aynı.
- **Telefon süzgeç sayfası:** "N ürünü göster" sonuç sayısını başlığın altına indiriyor (sayı 304 px'te, başlık 117).
- **Ana sayfadan ürüne (390):** reyon karoları ilk kaydırmada (840 px), bir dokunuşla kategori, bir dokunuşla ürün; ana sayfa rafı 1,5 ekran aşağıda (1252 px). Alt gezinmenin "Kategoriler"i çekmeceyi açıyor.
- **Duyuru şeridi:** 36 px, yapışkan değil, telefonda tek satır; ilk ekranın %5'i.
- **Alt gezinme:** beş ad 12 px, simgeler 24 px, öğe 56 px; bulunulan sayfa dolgu hapta.

## Düzeltilmeyenler ve nedeni

- **Süzgeç panelinin yanında 1280 px'ten 4 sütun:** `design.md` kuralı (panelle 3, panelsiz 4 sütun) kilitli; 1280'de 4 sütun kartı 198 px'e indirir, ad iki satırda sıkışır. Değişmedi.
- **1024–1279 px'te alt kategori rayında 8 karo (≈101 px), adlar iki satır:** `design.md` "1024 px'ten 8 kart görünür" kuralı. Değişmedi.
- **Telefonda kategori tanıtımı dört satır, ilk kart ilk ekranın altında ~40 px görünüyor:** mağazanın kendi (SEO) metni; kısaltmak içerik kararı, sahibe bırakıldı.
- **Ana sayfada yukarı dönüşte WhatsApp:** ziyaretçi yukarı döndüğü anda düğme yerine geliyor; ana sayfada o an altında rafın sağ sütunundaki bir kartın köşesi, bir SSS satırının ucu ya da alt bilginin bir menü satırı kalabiliyor (390'da 14 dönüş noktasının 3'ünde bir denetim, 1366'da 7'nin 1'inde). Sahibin istediği yüzen düğme; aşağı okurken hiçbir şeyi örtmüyor, dönüşte görünür kalması bilinçli.
- **Çerez kartı telefonda alt gezinmeyi örtüyor:** ilk ziyarette yasal soru önce yanıtlanmalı; menü, arama ve sepet başlıkta açık, tek dokunuşla kalkıyor.
- **Uzun listede "yukarı çık" düğmesi:** sayfa 24 ürün (telefonda ~12 satır), yukarı dönüşte başlık ve hap şeridi zaten geliyor; ek düğme gerekçesiz.
- **Sonuçsuz aramada kategori ızgarası:** telefonda ilk ekranın altında başlıyor, üstünde backend'in sözü ve "Tüm ürünlere göz atın" var; akış doğru.

## Doğrulama

Aynı matris "sonra" için yeniden koşuldu (`after/`; puppeteer'da arka sekmede `requestAnimationFrame` durduğu için ana sayfa, süzgeçli liste ve arama tek sekmede yeniden ölçüldü: `after-seq1/`, `after-seq2/`, `after-seq3/`).

| Ölçüm | Önce | Sonra |
| --- | --- | --- |
| Kaydırılmış başlığın görünen yüksekliği | 117 px telefon, 133 px dizüstü | 61 px, 81 px |
| WhatsApp'ın altında kalan denetim (aşağı inerken, 66 sayfa-görünüm) | 518 (109'u düğme/alan/satır) | kaydırınca 0; yalnız sayfa açılırken ilk ekranda bir kartın köşesi ya da "Sırala" hapının / ilk satırdaki "+"nın kenarı (5–9 px) |
| Arama sonuçlarında ilk ürün kartının üstü | 1366×768: 788, 1440×800: 802, 390: 787 (ekran dışı) | 678, 692, 735 (ilk ekranda) |
| Çerez kartı, 360×740 | 244 px, açılış düğmesini 27 px örtüyor | 212 px, düğmenin 5 px altında |
| Telefonda 44 px altı hedef / 24 px altı hedef | 1 / 1 ("Atölyemizi tanıyın") | 0 / 0 |
| Liste kartı fotoğrafı, 1440 (görünen/indirilen) | 325/432 | 325/324 |
| Yatay taşma 320–1920 (14 genişlik × 6 sayfa × iki kaydırma) | yok | yok |
| CLS (yükleme + tam sayfa kaydırma, 66 sayfa-görünüm) | 0 | 0 |

- sloplint `--render`: `/`, `/kategori/el-yapimi-caki`, `/arama?q=çakı` 0 FAIL, 0 WARN (yalnız tema damgasındaki bilinen feragatler).
- Vitrin e2e (`smoke frame menu-links pages a11y`, `:8000`): 66 geçti; axe ciddi bulgu yok.
- Vitrin vitest: 111 dosya, 690 test geçti (yeni: başlığın katlanan parçaları, alt gezinmenin arama bağlantısı ve boş alanın örneği, telefonda sabit haplar, markaların karoların yanında durması, kart fotoğraflarının `sizes`'ı).
- turbo typecheck + lint (storefront, theme-atolye): temiz; prettier temiz.
