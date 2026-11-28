# ADR-0066: Tema katmanları ve görünüm izolasyonu

- **Durum:** Kabul (sahip, 2026-11-15). Stil takımının basamak listesi ayrı ADR'de kararlaştırılır (bkz. Açık kararlar).
- **Tarih:** 2026-11-15
- **İlgili:** adr/0046 (vitrin ve tema sözleşmesi), adr/0049 (vitrin yönetimi, bölüm biçimleri ve ayarları), adr/0057 (tema derleme anında), adr/0062 (tema ayarları), adr/0063 (hazır görünümler), adr/0064 (görünüm kitaplığı), `docs/tema/bilesen-standardi.md` (§0 ilkeler, §7), `CLAUDE.md` "Ortak çalışma"
- **Dayanak:** sahip (2026-11-15): "bunları hep birer seçenek olarak eklemiyor muyuz?"; "ortak bileşene müdahale hiç olmasa onun sadece özellikleri olsa default olarak, bileşene sadece kod olarak müdahale edilebilse o da çok gerekli zamanlarda sadece. onun dışında görünümlerde herkes kendisi değiştirse"; "bu yazılımı geniş kitlelere yaymayı düşünüyoruz ve uzun soluklu bir iş olacak, o yüzden anlık çözümler değil doğru stratejiye ihtiyaç var".

## Bağlam

Tema tektir (Atölye). İçinde birden çok hazır görünüm yaşar: Grafit (genel; hazır görünüm olarak kaldırıldı, sahip 2026-11-17, adr/0063 Ek 2026-11-17), Katalog ve Tezgâh ×3 (bıçak paketi). Görünümler ayrı `layout.json` dosyalarıdır ama bileşenler ortaktır. İki geliştirici aynı bileşene farklı tasarım yönleriyle girdiğinde birinin çizimi ötekinin görünümünü habersiz değiştirir. Somut olay (2026-11-15): `deniz/katalog-ust-sade` dalı `catalog` üst bilgi biçimini yerinde yeniden çizdi; bu biçimi yalnız Tezgâh kullanıyordu. Aynı gün "Kategoriler" paneline küçük resimler iki dalda ayrı ayrı eklendi.

Sorunun kökü: bazı tasarım kararları (gölge, kenarlık, menü öğesi stili, arama genişliği) bileşenin içine sabit yazılı. Farklı bir görünüş isteyen, kararı değiştirmek için bileşeni yeniden çizmek zorunda kalıyor.

Emsal: Shopify'ın kendi temaları tek kod tabanından ön ayarlarla çıkar (Dawn ailesi, Horizon ailesi); mağazaya kurulan tema kopyadır ve güncelleme isteğe bağlıdır. Elementor ve Divi'de hazır tasarım, ortak modüllerin kayıtlı ayar değerleridir. Üçünde de hazır tasarım veridir, kod değildir.

## Karar

### 1. Üç katman

| Katman | Ne taşır | Nerede durur |
| --- | --- | --- |
| **Bileşen havuzu** | İskelet, davranış, erişilebilirlik; özellikler ve varsayılanları | `packages/themes/atolye` (tek, ortak) |
| **Stil takımı** | Kimlik: renk, yazı, köşe, gölge, kenarlık, yoğunluk, menü stili gibi adlandırılmış basamaklar | Tema ayarları (adr/0062); görünümün verisinde seçilir |
| **Hazır görünüm** | Hangi stil takımı değerleri, hangi bölümler hangi sırada, her bölümün biçimi ve ayarları | `packages/sector-packs/packs/*/presets/*` (yalnız veri) |

Bileşen kimlik kararını sabit yazmaz, stil takımından okur. Yerleşim (ızgara, hiza, oran) bileşende kalır; o iskelettir. Mağaza sahibine "tema" diye gösterilen şey hazır görünümdür; kodda "tema" yalnız Atölye'dir.

### 2. Bir fark nereye yazılır

| Fark | Çözüm | Örnek |
| --- | --- | --- |
| Görünüş | Stil takımında basamak | Gölge var/yok, kenarlık, köşe, kutulu/çizgili menü öğesi |
| Tek bir davranış ya da küçük yerleşim | Bölüm ayarı | Alt menü aşağı/yana açılır, üstüne gelince/tıklayınca açılır, kart sayısı, otomatik geçiş |
| İskeletin bütünü | Yeni biçim | Açılır menü yerine mega menü; üst çubuk yerine kenar menüsü |
| Yalnız bir görünüme özgü içerik ya da sıra | Görünümün `layout.json`'ı | Bölüm sırası, başlık metni, hangi raf |

Üç seçim türü de görünümün verisinde durur; bu yüzden üçünde de bir görünümün seçimi ötekini etkilemez.

### 3. Kurallar

- **K1.** Herkes görünümü kendi tarafında değiştirir: kendi hazır görünümünün verisinde.
- **K2.** `dev`'e girmiş bir biçimin çizimi yerinde yeniden tasarlanmaz.
- **K3.** Bileşenin koduna şu sebeplerle girilir: (a) hata, erişilebilirlik, performans, güvenlik düzeltmesi, görünüm değişmeden; (b) yeni özellik ya da basamak eklemek, varsayılan eski görünümü korur; (c) yeni biçim eklemek; (d) görünümü değiştirmeyen iç düzenleme. Mevcut çizimi beğenmemek sebep değildir.
- **K4.** Bir görünüm mevcut özelliklerle kurulamıyorsa eksik olan özelliktir: özellik eklenir, bileşen yeniden çizilmez. Özelliği ilk isteyen ekler.
- **K5.** Yeni özellik yalnız birden çok mağazanın işine yarayacak genel bir kararsa eklenir. Çok özel istek yeni biçim olur. Bölüm ve tema başına bir avuç anlamlı basamak; serbest sayı, serbest renk, serbest CSS yok (`bilesen-standardi.md` §0 ilke 3 ve 4).
- **K6.** Alanların anlamı değişmez. Yeni anlam yeni alan olur; kayıtlı düzenler yazıldıkları anlamla okunur. Migration gerektirmeyen okuma varsayılanı eski davranıştır.
- **K7.** Hazır görünüm yalnız veridir; kod ya da gizli CSS taşımaz.
- **K8.** Eskiyen biçim silinmez; seçim listesinden gizlenir, onu kullanan kayıtlı düzenler çizilmeye devam eder. Silmek ayrı karardır.
- **K9.** Herkese gelmesi gereken iyileştirme (ortak tarife geçiş, hata düzeltmesi) ortak bileşende yapılır ve bütün görünümlere gider; bu izolasyonun bilinçli istisnasıdır.

### 4. Hakem: görünüm kilidi testi

Onay süreci yoktur ("PR'ı açan birleştirir"). Onun yerine her hazır görünümün çerçevesi ve ana sayfası testte çizilir, kayıtlı örnekle karşılaştırılır; tema stil dosyalarının özeti de kilitlenir. Test `pnpm verify:changed` içinde koşar.

- Test kırılmıyorsa değişiklik kimseyi etkilememiştir.
- Kırılıyorsa: değişiklik bilerek yapılıyorsa örnek güncellenir, PR gövdesine hangi görünümün neden değiştiği yazılır, o görünümün sahibine haber verilir. K3'e uymayan değişiklik geri çekilir.

### 5. Çalışma düzeni

- Bir özelliğe başlamadan önce diğerinin dallarına, açık PR'larına ve sıradaki işlerine bakılır; dal ilk commit'le hemen push edilir (`CLAUDE.md` "Aynı işi iki kez yapma").
- Bir biçime ya da ortak parçaya dokunan PR, etkilenen hazır görünümleri gövdesinde yazar.
- Dallar ortak bir geliştirme veritabanını paylaşıyorsa, taslağa yeni alan yazan dal o alanı tanımayan dalın önizlemesini bozabilir; yeni alan `dev`'e girene kadar ortak taslağa yazılmaz ya da iş bitince geri alınır.

## Yol haritası

1. Görünüm kilidi testi.
2. Bileşenlerdeki gömülü tasarım kararlarının dökümü ve stil takımının basamak listesi: ayrı ADR, iki geliştirici birlikte.
3. Kararların bileşenlerden stil takımına taşınması, bileşen bileşen; her adımda kilit testi aynı kalır (görünümler değişmez).
4. Tema sürümleme, ilk gerçek müşteriler canlıya çıkmadan önce: mağaza kendi sürümünde kalır, güncelleme isteğe bağlıdır. Ayrı ADR.
5. Ayrı kodlu ikinci tema yalnız iskeleti kökten farklı bir vitrin gerekirse; o da ortak sepet, ödeme ve ürün mantığını kullanır.

## Değerlendirilen seçenekler

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| Tek havuz + stil takımı + veri görünüm (bu ADR) | Tek bakım; yeni görünüm kod istemez; görünüş ve düzen seçimleri izole | Gömülü kararları çıkarmak emek ister; ortak kod hâlâ ortak | **Seçildi** |
| Her tasarım yönü ayrı tema paketi | Tam izolasyon | Her bileşen ve her yeni özellik iki kez; temalar birbirinden uzaklaşır | Reddedildi |
| Her şey ayar (Elementor/Divi düzeyi) | Sınırsız tasarım | Ayar yığını, ağır sayfa, tutarsızlık; "ayarlar boğmasın" ilkesine ters | Reddedildi |
| Sahiplik ve onay (her biçimin sahibi onaylar) | Kod değişmez | "Kimse kimsenin onayını beklemez" kararına ters | Reddedildi |
| Yalnız tema sürümleme | Geliştirici özgürce yeniden çizer | Eski sürümlerin bakımı; bugün canlı mağaza yokken erken | Sonraya (yol haritası 4) |

## Sonuçlar

- İstemli tasarım değişiklikleri başka görünümü etkilemez: yapılacak yer ortak kod değil, görünümün verisidir.
- İstemsiz etkiler (hata, dikkatsizlik) hâlâ mümkündür; kilit testi birleşmeden önce gösterir. Tam yalıtım sürümlemeyle gelir.
- Biçim ve basamak sayısı zamanla artar; K5 ve K8 bunu sınırlar.
- Stil takımı tamamlanana kadar K4 gereği eklenen ayarların bir kısmı bölüm düzeyinde kalır; taşıma sırasında tema düzeyine alınabilir (K6: alan adı ve anlamı korunarak).

## Ek 2026-11-27: Üst şerit üst bilgiden ayrıldı (sahip kararı)

Sahip: "Üst şerit ayrı bir şey… üst şeridin tasarımları olur, ayrı ayrı tıklar açar… üst bilgi seçiyorum, üst şerit otomatik geliyor." Klasik katalog biçimi kendi ince şeridini çiziyordu; o kapatılınca bağlantılar koyu duyuru şeridine düşüp onu ortaya çıkarıyordu; Solda/Ortada logo biçimlerinde duyuru gizlense de şerit bağlantı ve telefonla kalıyordu.

Karar: üst şerit üst bilgi grubunun kendi bölümüdür (`announcement_bar`, biçimleri `graphite` ve `light`), kayan yazı da öyle; üst bilgi biçimleri üstlerinde şerit çizmez. Yeni anlam yeni alanlarla gelir (biçim, `links`, `phone`, `account`; üst bilgide `top_strip: "separate"` işareti); eski alanların anlamı değişmez, eski kayıt bir kez okunurken eski çizimi koruyacak şekilde çevrilir. Hazır görünümler veri olarak yeni şekle yazıldı; görünüm kilidi değişmedi. Ayrıntı: docs/tema/bilesen-standardi.md §7.

## Ek 2026-11-27: Ürün sayfasında tek güvence kutusu çizilmez (sahip kararı)

Sahip: alım formunun altında ("WhatsApp'tan sorun" düğmesinin altı) "Kargo ve teslimat" kartı olan üründe mağazanın diğer güvenceleri (kargo, saat, iade simgeli olmayanlar) küçük kutular olarak çiziliyordu; tek kutu kalınca yalnız ve kötü duruyordu.

Karar: bu kutu grubu en az iki kutu varken çizilir; tek kutu kalınca orada hiçbir şey çizilmez (güvence ana sayfa şeridinde, alt bilgide ve sepette görünmeye devam eder). Telefonda (`sm` altı, 640 px) kutular tek sütunda alçak satırlardır (solda simge, başlık ve açıklama birer satır, sığmazsa üç nokta; sahip iki sütunlu dikey kutuyu önizlemede denedi, beğenmedi); `sm`'den itibaren satırda ikişer dizilir; tek sayıda kutuda (3, 5…) son kutu satırın tamamını kaplar, böylece boş hücre kalmaz ve hiçbir güvence gizlenmez. başlık ve açıklama en çok iki satır; tek kutu satırını uzatamaz (sahip, dört rozetle telefonda 2×2 kutular şişiyordu). Kartı olmayan ürünün "Teslimat ve iade" kutusu değişmedi. Bu, yayımlanmış bir çizimin sahip kararıyla yerinde değişmesidir (ayar değil): görünüm kilidinde yedi hazır görünümün ürün sayfası değişti (fikstürde tek güvence kutusu kalıyordu), `pnpm lock:presets` ile yeniden yazıldı. Ayrıntı: docs/tema/bilesen-standardi.md §7.

Aynı gün, tutarlılık düzeltmesi (sahip isteği): ürün sayfasındaki "Kargo ve teslimat" kartında her bilgi kalın başlık ve altında kısa satırdır; aynı gün kargo saati tek düz cümleydi ("Saat 15.00'e kadar verilen siparişler aynı gün kargoda"). Artık başlık "Aynı gün kargo", altında "Saat 15.00'e kadar verilen siparişlerde" (saat mağazanın ayarından). Bölüm biçimi ve tema çizimi değişmedi, yalnız vitrinin hazırladığı metin; görünüm kilidi değişmedi.

## Açık kararlar

1. Stil takımının basamak listesi ve adları (yol haritası 2).
2. Kilit testi yalnız HTML ve stil özeti mi, yoksa tarayıcıda ekran görüntüsü karşılaştırması da mı (birincisi yetmezse).
3. Sürümlemenin biçimi: tema sürümü mü, biçim sürümü mü (yol haritası 4).
