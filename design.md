# Design: Grafit (`packages/themes/atolye`, `STOREFRONT_THEME=atolye`)

> **Kilitli sistem.** Sahip onayı 2026-11-05: "anasayfa tasarımını beğendim, diğer e-ticaret sayfalarımızın tasarımlarını da yapmaya başla." Hallmark her koşuda önce bunu okur; her yeni sayfa bu token'lara ve bileşen kurallarına uyar, sayfa sayfa genişletilir. Kaynak: `docs/tema/yon-2026-11-05.md` (aynı içerik, gerekçeleriyle). Reddedilen eski sistem (Loom): `docs/tema/design-loom-2026-11-04.md`.
> Sahip kararları: vurgu = mağazanın tema ayarındaki birincil renk (`--primary`); logo yerine tipografik yazı markası; kategoriler her yerde fotoğraflı karo, çip yok; koyu mod sistem ayarını izler; müşteri fotoğrafları yorum görsellerinden; ödeme/kargo için firmaların resmi logoları; dev mağazada eksik metinleri mylarte.com'a uygun olarak biz yazarız (uydurma olgu/rakam yok).

> Sahibin 2026-11-05 isteği: "bir anasayfayı tasarla bakalım hemen görelim", sıfırdan, eski Atölye/Loom görünümüyle ortak noktası olmadan.
> Sahip ana sayfayı onayladı (2026-11-05: "anasayfa tasarımını beğendim, diğer e-ticaret sayfalarımızın tasarımlarını da yapmaya başla"). Kilitli kopya depo kökünde `design.md`; eski Loom sistemi `docs/tema/design-loom-2026-11-04.md`.
> Kod: `packages/themes/atolye` (paket adı ve bağlantısı aynı: `STOREFRONT_THEME=atolye`), şimdilik çerçeve + ana sayfa.

## Fikir

Mağazanın kendi koyu zeminli bıçak fotoğrafları **grafit sahnelerde** durur, fotoğrafın koyu kenarı sahneye karışır; sahnelerin çevresi **soğuk, çelik beyazı bir tezgâh**tır. Tek, ağır bir grotesk (Manrope) bütün sesi taşır. Kategoriler her ekranın omurgasıdır: başlıkta reyon satırı, ilk ekranın hemen altında fotoğraflı reyon kartları.

Loom'dan farkı (sahibin reddettiği görünüm): ekru kâğıt yerine soğuk beyaz + grafit; Caslon serif yerine ağır grotesk; kare köşe ve her yerde ince çizgi yerine yuvarlak kartlar, dolgu yüzeyler ve hap (pill) kontroller; kum bantlar yerine iki grafit sahne.

Hallmark: deste (Dose / Manifesto / Loom) reddedildi, yön özel (custom). Loom reddedilen görünüm; Manifesto'nun çift tonlu karanlık sayfası ve Dose'un eczane plastiği bir mağazanın renkli ürün fotoğraflarını taşımaz. Manifesto'nun "koyu sahne + ağır başlık" fikri alındı.

## Token'lar (`src/tokens.css`)

| Rol | Açık | Koyu |
| --- | --- | --- |
| Tezgâh `--color-paper` | `oklch(98.4% 0.003 250)` soğuk beyaz | `oklch(17% 0.011 255)` grafit |
| Kuyu `paper-2` / `paper-3` | `95.6%` / `91.6%`, kroma 0.005–0.007 | `21.5%` / `26%` |
| Mürekkep `text` / `text-2` / `text-3` | `20%` / `35%` / `46%` (hepsi zeminde ≥ 4.5:1) | `95.5%` / `84%` / `73%` |
| Sahne `stage` (her iki modda koyu) | `oklch(19.5% 0.012 255)`, yazısı `96.5%` / `80%` | `12.5%` (tezgâhtan bir adım derin) |
| Sinyal `signal` | mağazanın rengi (`--primary`, adr/0053), yazısı `--primary-foreground` | aynı ton, L 72'ye kaldırılmış, yazısı grafit |
| İndirim `deal`, stokta `ok`, yıldız `star`, hata `error` | kırmızı 27°, yeşil 150°, amber 75° | kaldırılmış tonlar |

- **Duruş:** ölçülü. Sinyal yalnız eylemde (birincil düğme, sepet sayacı, odak halkası). Grafit sahne bir yüzey rengidir, vurgu sayılmaz; sayfada en çok iki sahne (açılış, yakın plan) + alt bilgi.
- **Yazı:** Manrope (değişken, kendi sunucumuzdan; `latin` + Türkçe harf dosyası ≈ 27 KB, önyüklenir). Ağırlıklar 400 / 600 / 800. Başlıklar 800, harf aralığı −0.035em, satır 1.02–1.06; gövde 16 px / 1.6; etiketler 14 px 600, cümle düzeni, büyük harf ya da harf aralığı yok.
- **Ölçek:** `--text-display` 32→68 px, `--text-section` 28→44 px, `--text-title` 18→21 px, `--text-figure` 48→72 px (puan), `--text-mast` 44→104 px (alt bilgi adı).
- **Köşeler:** sahne ve kart `--radius-tile` 20 px, fotoğraf `--radius-media` 14 px, iç parça 10 px, kontroller `--radius-pill`.
- **Gölge:** yalnız açılır katmanlarda (mega panel, çekmece, çerez kartı, hızlı ekle) tek `--shadow-float`.
- **Izgara:** kap 1440 px, kenar boşluğu 16 / 24 / 48 px, kolon arası 12 / 24 px; bölüm arası 48→120 px (telefon → masaüstü), söz öbeği ekranı başına ~80 kelime.

## Bileşen kuralları

- **Düğme:** tek birincil: mağaza renginde hap, 48 px. Grafit sahnede aynı düğme sahnenin açık mürekkebine döner (koyu üstünde okunur). İkincil: çizgili hap. Sekiz durum: dinlenme, üzerine gelme (bir ton koyu), odak (anında 2 px halka), basma (1 px), devre dışı (opaklık + imleç + öznitelik), meşgul (`aria-busy`).
- **Arama:** her ekranda görünür, 48 px hap, kenarı 3:1, betiksiz GET `/arama`. Betikle canlı panel (2026-11-05, sahip: "arama kutusunda aratıyorum hemen ajax şekilde göstermiyor"): alanın altında alanın genişliğinde yüzen yuvarlak yüzey (`--shadow-float`, çizgi kenar), masaüstünde solda ürün satırları (48 px görsel, ad, fiyat; satır ≥ 44 px), sağda kategori ve marka hapları, altta "Tüm sonuçları gör (n)"; telefonda tek sütun, ekran klavyesinin üstünde biter, içinde kayar. Yüklenirken satır boyunda iskelet ya da önceki yanıt soluk; sonuç yoksa mağazanın kategorileri. Temizle düğmesi lucide X, 44 px, yalnız alan doluyken.
- **Kart (ürün):** fotoğraf yuvarlak kuyuda (mağazanın oranı), üstte hap rozetler (indirim kırmızı, "Az kaldı", "Tükendi"), köşede yuvarlak "+" hızlı ekle; marka küçük, ad iki satır, fiyat 800 ağırlıkta, indirimde üstü çizili eski fiyat. Bütün kart tek bağlantı.
- **Reyon kartı (kategori):** her kategori aynı boyda 4:5 kart, hap yok (sahip 2026-11-05: "hepsi görselli olsun"); fotoğraf mağazanın kategori resmi, yoksa kategorinin en yeni ürün fotoğrafı (vitrin sunucusu seçer, istekler altışar altışar, bir dakika herkes için saklanır); ad kartın grafit ayağında 800. Telefonda ve tablette yana kayan tek sıra (2,2 / 3,3 kart görünür); 1024 px'ten ızgara, sütun sayısı kategori sayısından: önce dolu satırlar, sonra en az boş yer, son satırda hiçbir zaman tek kart kalmaz (1024: 3–6, 1280: 4–7; 13 kategori 5 ve 7+6).
- **Sekmeler:** betiksiz radyo hapları (ok tuşlarıyla gezilir), her panel HTML'de; `:has()` yoksa paneller alt alta.
- **Sahne:** grafit, 20 px köşe; fotoğraf iç kenarda grafite karışır (degrade yalnız fotoğrafın üstünde katman).
- **Çekmece, mega panel, çerez kartı:** yüzen yuvarlak yüzey, tek gölge, odak içeride, Escape kapatır.
- **Mega panel:** reyon satırındaki düğme 150 ms üzerinde durunca ya da basınca/Enter ile açar (açıkken grafit hap); panel kabın genişliğinde sayfanın üstünde yüzer (altındaki hiçbir şey kaymaz): solda kategorinin adı ve "Tümünü gör: {ad}", altında çocukları kısa sütunlarda (1024'te 3, 1280'de 4), sağda kategorinin resim kartı (yoksa en yeni ürün fotoğrafı; aynı sayfaya gider, klavyede ikinci durak değildir). Escape, dışarı basmak ya da ayrılmak kapatır. Kapalı paneller içeriden basışı yok sayar (2026-11-05 hata: basış paneli bağlantı izlenmeden kapatıyordu).
- **Çekmece (telefon):** her üst kategori 56 px satır, solunda 40 px yuvarlak kare resmi; çocukluysa yerel açılır: önce "Tümünü gör", sonra çocukları.

## Ana sayfa (brief sırası)

1. Duyuru şeridi (grafit, tek mesaj) → 2. Yapışkan iki satırlı başlık → 3. Açılış sahnesi (Banner duruşu: masaüstünde ekranın %58'i, telefonda yarım ekrandan az) → 4. Güvenceler şeridi → 5. Reyon kartları → 6. Sekmeli raf (yan yana ürün bölümleri; 3 sütun, 6 kart) → 7. Kampanya afişi ya da yakın plan ürün → 8. Yorumlar ve mağaza puanı → 9. Müşteri fotoğrafları → 10. Hikâye ("Neden biz?", `rich_text`) → 11. Rehberler (3 yazı) → 12. SSS (yanında yardım) → 13. E-bülten (alt bilginin içinde küçük kutu, İYS onay kutusu) → 14. Alt bilgi (çelik kuyu, sade defter).

Bölümler mağazanın düzenindeki sırayla çizilir (adr/0049); tema sırayı değiştirmez, yalnız yan yana ürün bölümlerini sekmelere, SSS'nin hemen arkasındaki yardım bölümünü SSS'nin yanına alır.

## Alt bilgi (sahip 2026-11-05: "bu kadar footer'ı beğenmedim")

Koyu duvar ve dev ad yok: tam genişlik çelik kuyu (`paper-2`), 1024 px'ten iki sütunlu defter. Önce ince bir e-bülten satırı: başlık solda, alan ve düğme sağda; onay kutusu ve metni ziyaretçi alana girince ya da yazınca görünür (kutu yine zorunlu, `:has()` yoksa hep görünür). Sonra solda mağazanın adı (yazı markası boyunda), adres, telefon, e-posta, sosyal haplar; sağda mağazanın alt bilgi menüleri kısa sütunlarda. Çizginin altında işaretler: "Ödeme" ve "Kargo" satırları, her işaret sağlayıcının kendi logosu (vitrinin `public/marks/`, kaynakları README'de) iki modda da açık bir çipte, tek boy (20 px); havale ve kapıda ödeme simge + ad; ETBİS karekodu sağda kendi açık plakasında. Küçük yazıda yasal metinler ve çerez tercihleri tek akan satır, kimlik satırları, en altta ayrı satırda © yıl unvan. Telefonda menü grupları kapalı satırlar (52 px, 44 px bağlantılar).

## Yasal metin

`/yasal/{tür}` tek okuma şablonu: iz, başlık (`--text-section`), "Son güncelleme: {tarih}" (`<time>`), metin 68 karakter ölçüde (16→17 px, satır 1,75; h2 `--text-title` 800, üstünde altının iki katından fazla boşluk; listeler işaretli). İçindekiler metnin h2'lerinden (vitrin sunucusu kimlik verir): telefonda metnin üstünde kapalı kuyu ("İçindekiler · N bölüm"), 1024 px'ten metnin solunda yapışkan liste. Sonda mağazanın diğer yayımlanmış metinleri.

## Liste sayfası (kategori, marka, `/magaza`, kampanyalar)

Sahip 2026-11-05: "diğer e-ticaret sayfalarımızın tasarımlarını da yapmaya başla". `ListingPage.tsx`, `listing/*`.

- **Baş:** iz, `h1` (`--text-display`, 800), 1024 px'ten 7 sütun; mağazanın kısa tanıtımı yanında 5 sütunda (`--text-lead`, `text-2`), yalnız ilk ve daraltılmamış sayfada. Altında alt kategoriler **fotoğraflı reyon kartı** (ana sayfanın kartı, küçük ad): tek sıra, telefonda 2,5, 640 px'ten 4,5, 1024 px'ten 8 kart görünür, fazlası yana kayar. `/magaza`'da mağazanın üst kategorileri. Fotoğraf yoksa kategorinin en yeni ürün fotoğrafı (vitrin seçer).
- **Süzgeçler:** çizgi yok, dolgu kuyular (`paper-2`, `--radius-media`): "Yalnızca stokta olanlar" anahtarı, her grup açık `<details>` (44 px satır, 20 px kare onay, sayı `text-3`; sonuç bulmayacak değer bağlantı değil, soluk), 6'dan fazlası "+N daha göster", fiyat aralığı iki alan + ikincil "Uygula". 1024 px'ten 280 px yan panel (başlığın altında yapışkan, içinde kayar); telefonda aynı panel alttan açılan sayfada (`<dialog>`, odak içeride, Escape ve perde kapatır): altta "Temizle" (ikincil) ve "N ürünü göster" (birincil). Sayfadaki her seçim `#filtreler` çapasıyla gider, yeni sayfada sayfa yeniden açılır ve düğmede yeni sayı yazar. Betiksiz: çapa paneli yerinde gösterir (`:target`).
- **Izgaranın başı:** "N ürün" (`h2`), sıralama 44 px hap içinde küçük menü (`<details>`; Escape, dışarı basmak kapatır; bağlantılar `nofollow`); telefonda "Filtrele (n)" ve "Sırala" iki eşit hap. Açık süzgeçler koyu haplar (×, "Filtreyi kaldır: …"), yanında "Tümünü temizle".
- **Izgara:** ana sayfanın kartları; yan panelle 3, panelsiz 4 sütun (1024 px'ten), telefonda 2. İlk sayfanın ilk iki fotoğrafı hemen yüklenir (LCP).
- **Sayfalar:** "Sayfa 2 / 3", ikincil "Önceki"/"Sonraki" hapları, aralarında 44 px yuvarlak numaralar (bulunulan koyu); telefonda yalnız önceki/sonraki. Sözleşme sayfalama verir, "daha fazla yükle" yok.
- **Boş:** dolgu kuyuda nedeni (süzgeçle boşsa "Bu seçimle eşleşen ürün yok." + birincil "Filtreleri temizle"; boş liste kendi sözü + "Tüm ürünlere göz atın").
- Mağazanın kategori sayfası bölümleri (adr/0049) ana sayfanın bölümleriyle (`sections/Blocks.tsx`), ızgaranın üstünde ve altında.

## Arama sonuçları (`/arama`)

Liste sayfasının kendisi: başlık "“q” için sonuçlar"; altında "Bunu mu demek istediniz:" (her öneri kendi araması, 800 ağırlıkta bağlantı), "İlgili kategoriler" fotoğraflı reyon kartı sırası, "Markaya göre daralt" hapları (süzgeç, `nofollow`), sonra aynı süzgeçler ve ızgara. Sonuç yoksa: dolgu kuyuda backend'in sözü, öneriler, birincil "Tüm ürünlere göz atın", altında "Kategorilere göz atın" başlığıyla mağazanın üst kategorileri reyon ızgarasında (ana sayfanın sütun kuralı). Hiç aranmamışsa aynı ızgara, istem sözüyle. Arama kutusu başlıkta her ekranda zaten var; sayfa ikincisini çizmez.

## Ürün sayfası

`ProductPage.tsx`, `product/*`. İmza: ürün fotoğrafları grafit sahnede, koyu zeminleri sahneye karışır.

- **Üst blok:** telefonda iz yalnız bir üst adım ("‹ Elmax Çakılar", 44 px); 640 px'ten tam iz. 1024 px'ten 7 sütun galeri + 5 sütun satın alma sütunu (sütun yapışkan, fotoğraflar kayarken görünür kalır).
- **Galeri:** grafit sahne (`--radius-tile`), kare fotoğraflar yakalamalı tek şeritte (telefonda kaydırılır, klavyeyle kayar); "2 / 9" durum hapı; 640 px'ten altta 72 px küçük resimler (betiksiz çapa), 1024 px'ten iki yuvarlak ok; köşede yuvarlak "Görseli büyüt" (betikle). Fotoğrafa basmak da açar: tam ekran grafit, fotoğraf ekran boyunda, basınca bastığı yerden 2,5 kat büyür ve imleci izler (telefonda iki parmak da), oklar ve ok tuşları gezer, Escape kapatır. Yalnız ilk fotoğraf hemen yüklenir. Fotoğrafsız ürün: sahnede adın ilk harfi.
- **Satın alma sütunu:** marka küçük (sayfasına), ad tek `h1` ("ad | ayrıntı" yazılmış adın ayrıntısı aynı başlığın ikinci, küçük satırı), yıldızlar + "N değerlendirme" yorumlara gider, mağazanın öne çıkan özellikleri (en çok 4) dolgu haplarda. Fiyat `--text-section` 800 (önceki fiyat varken indirim kırmızısı), üstü çizili önceki fiyat yalnız kural izin verince, "%30 indirim" kırmızı hap, "… tasarruf"; sepette uygulanan kampanyanın koşulu sinyal tonlu satırda (`cartOffer`, fiyatın yanında, yerine değil). Stok sözle ("Stokta" yeşil / "Tükendi"). Seçenekler gerçek radyolar: dolgu haplar, renk adı verilmişse 44 px daire; tek değerli seçenek çizilmez. Ek seçenekler (adr/0052) ve hediye kartının alıcısı dolgu kuyuda, satın alma formunun alanları. Sonra tek satır: adet (44 px yuvarlak −/+, arada 3:1 kenarlı alan), birincil "Sepete ekle", 48 px yuvarlak favori kalbi (misafire giriş bağlantısı); 416 px altında düğme tam genişlikte alta iner. Altında taksitler (dolgu satır, açılınca sorulur: "Kartınıza göre N taksite kadar" + aile başına tablo), tükenmiş varyantta stok bildirimi kuyusu. Cayma notu (varsa) satın almadan önce kuyuda, simgeyle. "Teslimat ve iade" kuyusu: ücretsiz kargo satırı, mağazanın güvenceleri, "WhatsApp'tan sor".
- **Açıklama ve özellikler:** 1024 px'ten açıklama 7 sütun (backend'in izinli HTML'i, 68 karakter ölçü), özellik tablosu 5 sütun: tek gerçek tablo, şablonun her grubu bir `<tbody>`, grup adı 800 ağırlıkta, altında 2 px koyu çizgi; satırlar arasında ince çizgi (çizgili gruplar), grupsuzda tek düz tablo.
- **Yorumlar ve sorular:** yorumlar ana sayfadaki gibi: solda ortalama büyük (`--text-figure`), yıldızlar, sayı, 5→1 çubuklar; altında açılan "Değerlendirme yaz" (beş gerçek radyo yıldız, başlık, metin, en çok 3 fotoğraf) ya da giriş bağlantısı; sağda yorum kartları (yıldız, başlık, tam metin, fotoğraflar, ad, doğrulanmış işareti, tarih). Sorular: soru, yanıt dolgu kuyuda ("Mağaza yanıtı"), yanında soru formu.
- **Benzer ürünler:** ana sayfanın kartları 4 sütun; sonra mağazanın ürün sayfası bölümleri (adr/0049).
- **Telefonun satın alma çubuğu:** sayfanın "Sepete ekle" satırı yukarı kaydıktan sonra alt gezinmenin yerine kayar (fotoğraf, ad, fiyat, aynı formu gönderen birincil düğme; seçenek seçilmemişse forma, tükenmişse stok bildirimine götürür); gizliyken `inert`. WhatsApp düğmesi alt gezinmenin üstündeki yerinde kalır, çubuğu örtmez.
- **Sözleşmede olmayanlar (çizilmez):** ölçek görseli (`ImageView` rolü yok), ayrı bakım notu ve yasal uyarı alanı (mağaza bugün bunları açıklama belgesine yazıyor), soru-cevap dışında ürün başına SSS.

## Satın alma sayfaları (sepet çekmecesi, sepet, ödeme, sipariş, sipariş takibi)

Sahip 2026-11-05: "diğer e-ticaret sayfalarımızın tasarımlarını da yapmaya başla"; brief §4.2 kabulü: "Ödeme akışı mobilde tek elle tamamlanabilmeli; misafir ödeme açık kalmalı". `frame/CartSheet*`, `cart/*`, `checkout/*`, `order/*`, `account/*`, `buy.css`. Tutarlar hep backend'in, sözle; tarayıcıda hiçbir tutar hesaplanmaz.

- **Satır (çekmece ve sepet):** dolgu kuyu (`paper-2`), fotoğraf yuvarlak (çekmecede 80 px, sepette 96→128 px), ad, varyant, ek seçimleri (hediye paketi, gravür; kişiye özelse kırmızı not), altta 44 px'lik adet hapı (`field`; eksi/artı satır formunun kendi gönderme düğmeleri, birde eksi satırı siler), çöp kutusu (44 px), sağda fiyat 800 (indirimde kırmızı, üstünde çizili önceki tutar). Ödeme bağlantısının sepetinde (adr/0051) kontrol yok, "Adet: N".
- **Çekmece:** sağdan yüzen sayfa; başta ücretsiz kargo kuyusu ("Ücretsiz kargo için X daha ekleyin", mağazanın eşiğinden), satırlar kendi içinde kayar, altta ara toplam, not, birincil "Ödemeye geç" ve ikincil "Sepete git". Adet ve silme yerinde (`changeCartLine`, satır meşgulken soluk). Boşken mağazanın ilk altı kategorisi 4:3 fotoğraflı karo (grafit ayak), "Alışverişe devam et".
- **Sepet (`/sepet`):** `h1` (`--text-section`) + "N ürün"; 1024 px'ten satırlar + 416 px yapışkan özet kuyusu. Satırların üstünde kamyon simgeli ücretsiz kargo kuyusu, mağazanın sepet kampanyaları sinyal tonlu haplarda. Özet: indirim kodu (etiketli 48 px hap alan + ikincil "Uygula", uygulanan kodlar yeşil etiketli haplar), hediye kartı kodu (bayrak açıkken), ürünler, indirim, kargo (backend'in adres öncesi en ucuz seçeneği: "Ücretsiz", "85,00 TL" ya da "85,00 TL'den başlayan"; yoksa "Ödeme adımında"), ara toplam açık kutuda büyük, birincil "Ödemeye geç", "Güvenli ödeme"; altında mağazanın güvenceleri simgeli iki sütun. En altta "Çok satanlar" (yoksa yeni ürünler; sepetteki ürün hiç önerilmez) ana sayfanın kartlarıyla, telefonda yana kayan sıra. Telefonda ara toplam + "Ödemeye geç" alt gezinmenin üstünde yüzen çubukta (`data-sticky-buy`), özetin kendi düğmesi gizli. Boş sepet: dolgu kuyuda söz + birincil, altında çok satanlar.
- **Ödeme (`/odeme`):** misafir doğrudan başlar. Telefonda sepet en üstte grafit, kapalı bir çubuk (toplam görünür); 1024 px'ten sağda yapışkan **grafit sahne**: satır fotoğrafları sahneye karışır, adet rozeti, ekler, toplamlar, toplam büyük. Üç adım dolgu kuyular: numara rozeti (açık: mürekkep, bitti: yeşil tik, sırada: soluk), başlık, bitince özet ve "Değiştir". Telefonda açılan adım ekrana kendiliğinden gelir. Adres adımı iki grup: "İletişim bilgileri" (e-posta, cep telefonu, ipuçlarıyla), "Teslimat adresi" (ad, soyad, il → ilçe → mahalle yerel seçimleri, sonraki seçim kendi yerinde "Yükleniyor…" der, sokak/kapı); alan adları ve kimlikleri aynı. Ret alanın altında kırmızı, simgeli, alana odakla (önce tarayıcı bakar, sonra sunucu; düzeltince silinir). Kargo ve ödeme yöntemleri 64 px dolgu satırlar, kendi çizdiğimiz radyo (seçilen satır mürekkep çerçeve, nokta mağazanın rengi). Ödeme adımı: fatura satırı (misafire bireysel fatura ve kurumsal için giriş), yöntemler (kart, havale, backend sunarsa kapıda ödeme), sözleşmeler kapalı satırlar ("Oku" ile açılır, metin kayan kutuda), tek onay kutusu, sepet isterse yaş beyanı sinyal tonlu kuyuda (doğum tarihi + kutu), isteğe bağlı ileti izni. Telefonda düğme ("Kart bilgilerine geç" / "Siparişi tamamla") ekranın altında yapışkan, başparmak erişiminde.
- **Kart (`/odeme/kart`):** aynı düzen; PayTR çerçevesi açık zeminli kuyuda, yüksekliğini sayfasından alır (sayfa kayar, çerçeve kaymaz); üstte "Ödeme adımına dön". **Sonuç (`/odeme/durum`):** tek dolgu kuyu, simge dairesi, başlık, metin, tek yol.
- **Sipariş / teşekkür (`/siparis/{id}`):** açılış **grafit sahne**: "Sipariş onaylandı", `h1` "Teşekkürler, siparişiniz alındı" (sonradan açılınca "Sipariş #N"), sipariş no, tarih, ödeme şekli, onay e-postasının adresi, "Alışverişe devam et"; yanında ilk ürünün fotoğrafı sahneye karışır (telefonda üstte, kısa). Altında solda: havale bekleniyorsa sinyal tonlu kuyuda IBAN büyük ve seçilebilir; "Sipariş durumu" adım çizgisi (alındı, ödendi, hazırlanıyor, kargoda, teslim; kapıda ödemede ödeme adımı yok; bitenler yeşil tik ve tarih, şimdiki mağaza renginde halka) ve tek cümleyle "sırada ne var"; kargo kolileri (taşıyıcı, durum, takip no, taşıyıcının kendi sayfasına ikincil düğme); ürünler; iade talepleri, iptal. Sağda: ödeme özeti ve teslimat adresi, "Siparişinizi takip edin" (misafire "Siparişimi bul", üyeye "Siparişlerim"), misafire sinyal tonlu kuyuda hesap teklifi (ikincil düğme), belgeler.
- **Sipariş takibi (`/siparis`):** solda dolgu kuyu: `h1`, sipariş no + e-posta formu (bağlantı e-postayla gider, eşleşip eşleşmediği söylenmez), giriş bağlantısı; sağda grafit sahne "Takip numaranız mı var?" ve mağazanın bağlı kargo firmalarının kendi takip sayfaları (ikincil haplar, yeni sekme).
- **Sözleşmede olmayanlar (çizilmez):** misafirin kurumsal faturası (vergi no ile; backend yalnız üyenin fatura profilini okuyor), takip numarasıyla mağaza içinde sorgu (taşıyıcının sayfasına yönlendirilir), çekmecede ek seçenekleri düzenleme (sepet sayfasında).

## Açık işler (sahibin verisi)

- Sekmeler dev düzende "Çok satanlar / Yeni gelenler / İndirimde" (b667b4de kaynakları); kategori rafları düzende gizli duruyor.
- Kampanya afişi, hikâye, duyuru ve yakın plan satırı dev düzende mylarte.com'un kendi sözlerinden yazıldı (2026-11-05); sahip panelden düzeltir.
- Müşteri fotoğrafı: onaylı yorumlarda fotoğraf yok; gelince bölüm kendiliğinden çıkar.
- Logo dosyası gelene kadar ad, 800 ağırlıkta yazı markası.
