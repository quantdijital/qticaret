# Mali müşavire sorular: e-fatura ve e-arşiv

> **Cevaplar (kullanıcı, 2026-10-31):** her sorunun altında "_Cevap:_" satırında. 4.2, 6.3 ve 7.1'i
> kullanıcı "GİB ve Paraşüt kurallarından araştırarak onayla" dedi; dayanakları satırında.
> Kod değişikliği gerektirenler: 2.3, 4.1 (iki madde), 5.1, 5.2, 6.2.
>
> Bu liste mağazanın mali müşavirine gönderilmek için hazırlandı (2026-10-30). Her sorunun altında
> sistemin bugün ne varsaydığı yazıyor. Varsayım doğruysa "uygun" yazmanız yeterli; değilse doğrusunu
> ve dayanağını (tebliğ, madde) not edin. Cevaplar geldikçe ilgili satır güncellenir ve kod buna göre
> değiştirilir.

**Kısaca nasıl çalışacak:** Faturayı mağazanın Paraşüt hesabı keser. Sistem siparişin kalemlerini,
indirimlerini, kargo bedelini ve alıcı bilgilerini Paraşüt'e gönderir. Paraşüt, alıcı e-fatura
mükellefiyse e-fatura, değilse e-arşiv fatura düzenleyip GİB'e iletir. Paraşüt kullanmayan mağazalar
faturayı kendi programlarında keser ve fatura numarasıyla PDF'i sisteme geri yazar.

## 1. Alıcı bilgileri

**1.1 T.C. kimlik numarası vermeyen bireysel alıcı.** Müşterilerin çoğu ödemede T.C. kimlik
numarası girmiyor.
- _Varsayım:_ e-arşiv faturada alıcı kimlik numarası yerine `11111111111` yazılır.
- _Cevap:_ Her tutarda `11111111111`; ödemede kimlik numarası istenmez.

**1.2 Vergi numarası olan ama e-fatura mükellefi olmayan şirket.**
- _Varsayım:_ Bu alıcıya e-arşiv fatura kesilir; şirketin unvanı, vergi dairesi ve numarası faturada yer alır.
- _Cevap:_ Uygun.

**1.3 Şahıs şirketi alıcı.** Alıcı faturayı şahıs şirketi adına (T.C. kimlik numarasıyla) istiyor.
- _Varsayım:_ Kimlik numarası vergi numarası yerine geçer. e-Fatura mükellefi olup olmadığına bu numarayla bakılır.
- _Cevap:_ Uygun.

## 2. Faturanın içeriği

**2.1 İndirimler.** Sepet indirimi (kupon, kampanya) kalemlerin fiyatına oranla dağıtılıyor.
- _Varsayım:_ Her kalemde indirim, o kalemin iskontosu olarak gösterilir. Ayrı bir "indirim" satırı açılmaz.
- _Cevap:_ Uygun.

**2.2 Kargo bedeli.**
- _Varsayım:_ Müşteriden alınan kargo bedeli ayrı bir satır olarak yazılır ve %20 KDV'lidir. Ücretsiz kargoda bu satır yazılmaz.
- _Cevap:_ Uygun: ayrı satır, %20.

**2.3 Kapıda ödeme hizmet bedeli.** Kapıda ödemede müşteriden ek bir bedel alınabiliyor.
- _Varsayım:_ Bu bedel ayrı bir hizmet satırıdır ve %20 KDV'lidir.
- _Cevap:_ **Değişti:** bedel kargo satırına eklenir (ayrı satır açılmaz).

**2.4 Kuruş yuvarlama.** KDV kalem bazında hesaplanıp kuruşa yuvarlanıyor; yarım kuruş yukarı yuvarlanıyor.
- _Soru:_ Paraşüt'ün toplamıyla bir kuruş fark çıkarsa hangisi esas alınır?
- _Cevap:_ Paraşüt'ün toplamı; fark faturada saklanır ve panelde görünür (bugünkü davranış).

**2.5 KDV oranları.** Ürünlerde %20, %10 ve %1 oranları seçilebiliyor. Oranı mağaza ürün bazında giriyor.
- _Soru:_ Mağazanın sattığı ürün grupları için doğru oranları sizden almamız gerekiyor. Listeyi paylaşabilir misiniz?
- _Cevap:_ Ürün gruplarına göre farklı; mağaza oranı ürün bazında girer.
- _Not (2026-11-04):_ Oranlar panelden yönetilir (Ayarlar > Fatura ve muhasebe > KDV oranları; adr/0007 Ek): mağaza sahibi yeni oran ekler, kullanılmayanı kaldırır, varsayılan oranı değiştirir. Fiyat KDV dahil kalır; fatura her satırın oranını o satırın vergi satırından okur, geçmiş faturalar kendi oranını korur.

## 3. Ödeme yolu ve internet satışı bilgileri

**3.1 e-Arşiv'deki internet satışı bilgileri.** Faturaya satışın yapıldığı web adresi, ödeme şekli,
ödeme aracısı, ödeme tarihi, taşıyıcı firma ve gönderim tarihi yazılacak.
- _Varsayım:_ Ödeme şekli kart için "kredi kartı/banka kartı", havalede "EFT/havale", kapıda ödemede
  "kapıda ödeme" olarak yazılır. Ödeme aracısı olarak PayTR ya da iyzico gösterilir.
- _Cevap:_ Uygun; eksik alan yok.
- _Soru:_ Gönderim Geliver gibi bir kargo aracısıyla yapıldığında taşıyıcı olarak aracının mı, paketi taşıyan kargo firmasının mı unvanı ve VKN'si yazılır? [2026-11-26: Geliver kaldırıldı; bugün yalnız doğrudan taşıyıcılar var.]
- _Cevap:_ Paketi taşıyan kargo firması.
- _Not:_ Taşıyıcı firmaların unvanı ve VKN'si mağaza ayarlarından bir kez girilecek. Bunlar kargo firmasının mağazaya kestiği faturada yazar.

**3.2 Hediye kartı.**
- _Varsayım:_ Hediye kartı satışı bir mal satışı değildir. Kart satılırken fatura kesilmez; kartla
  alışveriş yapıldığında ürünün faturası tam tutardan kesilir ve ödeme şekli olarak "hediye kartı" yazılır.
- _Soru:_ KDV kart satılırken mi, kartla alışveriş yapılırken mi doğar? Kullanılmadan süresi dolan
  bakiye nasıl kayda alınmalı?
- _Cevap:_ Kart ödeme aracıdır: satışında fatura kesilmez (alınan para avans), KDV kartla alışverişte doğar,
  fatura tam tutardan, ödeme tipi `ODEMEARACISI`. Kartlar **süresiz**; dolan bakiye durumu oluşmaz.
  Kartın müşteriye satışı F18 vitrinle açılır (ADR-0025).

**3.3 Mağaza kredisi.** İade edilen tutar müşteriye para yerine mağaza kredisi olarak verilebiliyor.
- _Varsayım:_ Krediyle yapılan alışverişin faturası tam tutardan kesilir.
- _Cevap:_ Uygun. İadeden doğan kredi indirim değil ödeme/mahsup aracıdır: 2.000 TL'lik üründe 750 TL
  krediyle ödenirse fatura 2.000 TL'dir, 750 TL ödeme/mahsup kısmında izlenir. Promosyon amaçlı bir
  kupon olsaydı iskonto olarak satış bedelinden düşülürdü. Önceki ürünün iadesi ayrıca belgelenir.

## 4. Faturanın kesileceği an

**4.1 Kesim anı.**
- _Varsayım:_ Varsayılan olarak fatura, sipariş kargoya verildiğinde kesilir. Mağaza ayardan
  "sipariş onaylandığında" seçeneğini de seçebilir. Havalede ödeme onaylanmadan, kapıda ödemede ise
  teslimden önce fatura kesilmez.
- _Soru:_ Uygun mu? Kapıda ödemede faturanın kargoya verilirken kesilip pakete konması mı gerekir?
- _Cevap:_ **Değişti:** varsayılan kesim anı "sipariş onaylanınca". Kapıda ödemede fatura teslimden sonra kesilir.

**4.2 Faturanın müşteriye ulaşması.**
- _Varsayım:_ e-Arşiv faturanın PDF'i müşteriye e-postayla gider ve sipariş sayfasından da indirilebilir.
  Pakete kâğıt fatura konmaz.
- _Cevap:_ Uygun (araştırmayla). İnternet satışında nihai tüketiciye e-Arşiv'in elektronik iletimi zorunlu;
  509'daki değişiklikle kâğıt çıktının malın yanında bulunması isteğe bağlı ("bulundurabilir"). Eski
  özelgeler zorunlu sayıyordu; mağaza isterse etiketle birlikte çıktı seçeneği eklenebilir.

## 5. İptal, iade ve değişim

**5.1 Fatura kesildikten sonra, kargoya verilmeden iptal edilen sipariş.**
- _Varsayım:_ e-Arşiv fatura iptal edilir. e-Fatura alıcısı için ise karşı taraf faturayı reddeder ya da iade faturası keser.
- _Soru:_ e-Arşiv'i iptal etmek için bir süre sınırı var mı? Süre geçince ne yapılır?
- _Cevap:_ Var: alıcıya iletildiği tarihten itibaren **8 gün** (kargoya verilmemiş olması süreyi uzatmaz).
  Gerekçe örneği: "Müşteri talebiyle sipariş iptal edildi, ürün sevk edilmedi". Sipariş iptali faturayı
  kendiliğinden iptal etmeyebilir; iptal ve para iadesi kayıtları saklanır. 8 gün geçtiyse sistem iptali
  yerine muhasebe kayıtları uygun belgelerle düzeltilir (işlem düzeltilemez hâle gelmez).

**5.2 Bireysel müşterinin iadesi (e-arşiv).** Bireysel müşteri iade faturası kesemiyor.
- _Soru:_ Bu durumda mağaza ne düzenlemeli? Gider pusulası mı, iade bilgisi notlu bir belge mi, yoksa e-arşiv faturanın kısmi ya da tam iptali mi?
  Kısmi iadede (siparişin bir kalemi iade edildiğinde) bu nasıl yapılır?
- _Cevap:_ **Gider pusulası**, tam ve kısmi iadede. İlk satış faturasıyla ilişkilendirilir; yalnızca iade
  edilen ürün ve miktarlar için düzenlenir; ürün bedeli ve KDV ayrı gösterilir. İade bedelinin mağaza
  kredisine aktarılması ayrıca kaydedilir. İstisnalar: faturanın usulüne uygun iade bölümü müşteri
  tarafından doldurulup imzalanarak ürünle gönderilmişse ayrıca gider pusulası gerekmeyebilir (sıradan
  bir iade formu bu kapsama girmez); para banka ya da yetkili ödeme kuruluşu üzerinden iade ediliyorsa
  gerekli bilgileri taşıyan kurum belgesi gider pusulası yerine geçebilir (mağaza kredisine aktarma bu
  istisnaya girmez). Gönderilmeden iptal edilen sipariş (5.1) ile teslim edilmiş ürünün iadesi ayrı işlemlerdir.

**5.3 Şirket müşterinin iadesi (e-fatura).**
- _Varsayım:_ Alıcı şirket mağazaya iade faturası keser. Mağaza bu faturayı kayda alır; sistem yalnızca iadenin para tarafını tutar.
- _Cevap:_ Uygun.

**5.4 Değişim.** Müşteri ürünü başka bir beden ya da renkle değiştiriyor; fiyat farkı olabilir.
- _Varsayım:_ Eski ürün için iade, yeni ürün için yeni satış faturası düzenlenir. Fiyat farkı ayrıca tahsil edilir ya da iade edilir.
- _Soru:_ Fark faturası yeterli mi, yoksa iki belge mi gerekir?
- _Cevap:_ İki belge: iade + yeni satış.

## 6. Paraşüt hesabı

**6.1** Mağazanın Paraşüt hesabında e-fatura ve e-arşiv açık mı? Hangi entegratör üzerinden?
- _Cevap:_ İlk müşterinin Paraşüt'e geçişi henüz belli değil; bugün Luca'da elle kesiyor (geri yazma yolu hazır).

**6.2** Faturalarda kullanılacak seri (ön ek) nedir? Mağazanın kendi programıyla elle kestiği faturalar
aynı seriyi mi kullanacak?
- _Cevap:_ Sistemin faturaları **ayrı seriyle** (ön ek mağaza ayarından).

**6.3** Satışlar Paraşüt'te ürün (stok kartı) olarak mı izlenmeli, yoksa yalnızca açıklamalı satır yeterli mi?
- _Varsayım:_ Yalnızca açıklamalı satır gönderilir; stok mağaza sisteminde tutulur.
- _Cevap:_ Uygun (araştırmayla). Paraşüt'ün API tanımında satırın ürün bağlantısı isteğe bağlı (F8'de
  doğrulandı); stok kartı yalnızca stoğu Paraşüt'te izlemek için gerekir.

**6.4** Faturalar ve müşteriler Paraşüt'te hangi kategoriye ya da hesaba düşmeli?

## 7. Saklama

**7.1**
- _Varsayım:_ Faturanın aslını Paraşüt (ve entegratörü) saklar. Sistem fatura numarasını, durumunu
  ve PDF'in bir kopyasını sipariş kaydı süresince (öneri 10 yıl) tutar.
- _Cevap:_ Uygun (araştırmayla). VUK 253'e göre 5 yıl (izleyen yıldan), TTK 82'ye göre 10 yıl; uzun
  olan esas. Asıl kayıt Türkiye'de durmalı (Paraşüt ve entegratörü); bizim kopyamız da Türkiye'de
  (ADR-0003). Yurt dışında ikinci bir kopya engellenmiyor (433 Sıra No.lu Tebliğ).

## 8. Yurt dışı satış ve döviz (F19, 2026-11-28)

> İngilizce vitrin ve döviz satışı planı için hazırlandı (`docs/24-coklu-dil-ve-para-birimi-plani.md` §8,
> araştırma `docs/26-cok-dil-seo-arastirmasi.md` §9). Cevaplar gelmeden yurt dışı satış canlıda açılmaz.
> Sistemin varsayımı her sorunun altında; uygunsa "uygun" yazmanız yeterli.

**8.1 Mikro ihracatta fatura türü.** Yurt dışındaki bireysel alıcıya kargoyla (ETGB/BGB) mal gönderiliyor.
- _Varsayım:_ e-Arşiv fatura, KDV %0 (istisna, kod 301), faturada ETGB numarası; ihracat senaryolu e-Fatura kullanılmaz.
- _Soru:_ GİB "e-Fatura Uygulaması Gümrük İşlemleri Kılavuzu"na göre doğrusu bu mu?

**8.2 Döviz faturada kur.**
- _Varsayım:_ Fatura döviz cinsinden kesilir (yurt dışındaki müşteriye TL karşılığı şart değil, VUK m.215/2-a). KDV beyanı için TL karşılığı fatura tarihindeki Resmî Gazete'de yayımlanan TCMB döviz alış kuruyla; ihracat beyanında ETGB kapanış tarihi kuruyla. Kur, kaynağı ve tarihi siparişte saklanır.
- _Soru:_ Hangi kur hangi kayıt için kullanılır? Tahsilat günündeki kur farkı nasıl kaydedilir?

**8.3 ETGB numarası gelmeden fatura.**
- _Varsayım:_ ETGB numarası bağlanmadan KDV'siz fatura kesilmez; sipariş "ETGB bekliyor" durumunda bekler.
- _Soru:_ Fatura gönderiden önce kesilmek zorundaysa (kargo faturayı istiyor) sıra nasıl kurulur? ETGB hiç gelmezse fatura nasıl düzeltilir?

**8.4 Fiyattaki vergi.** Yurt dışı fiyatı KDV'siz gösteriliyor; gümrük ve varış ülkesi vergileri alıcıya ait (DAP).
- _Soru:_ Uygun mu? ETGB tevsik edilemezse KDV fiyatın içinden mi hesaplanır?

**8.5 Döviz tahsilatın TL'ye çevrilmesi.** iyzico (ve muhtemelen PayTR) döviz tahsilatı TL'ye çevirip aktarıyor.
- _Soru:_ Satış kuru ile aktarım kuru farkı nasıl kayda alınır? Döviz hesaba ödeme yapan banka POS'u muhasebede farklı mı?

**8.6 İhracat bedelinin yurda getirilmesi ve bankaya satılması.**
- _Soru:_ Kartla tahsil edilen ETGB ihracat bedelleri İBKB/DAB ve bankaya satış (basına göre %35) yükümlülüğüne tabi mi? Süre bugün kaç gün?

**8.7 Yabancı turiste Türkiye'de tur.**
- _Varsayım:_ Hizmetten Türkiye'de faydalanıldığı için KDV'li (KDV m.12/2-b); fatura döviz kesilebilir.
- _Soru:_ Tur bileşenlerine göre KDV oranı nedir? Yurt dışı acenteye B2B satışta istisna olan aracılık kısmı faturada nasıl ayrılır?

**8.8 Kur, marj ve yuvarlama.**
- _Varsayım:_ Döviz fiyatı günde bir TCMB döviz satış kuru × marj ile hesaplanır ve ,99'a yuvarlanır.
- _Soru:_ Fiyat hesabında döviz satış mı alış kuru mu kullanılmalı? Bunun faturadaki kurla farklı olması sorun mu?

**8.9 Yurt dışı şirket ve Stripe.** Stripe Türkiye'de yok; kullanmak için yurt dışı şirket gerekiyor.
- _Soru:_ UK Ltd, Atlas (Delaware) ya da Estonya OÜ kurulursa KVK m.3 iş merkezi riski, m.7 ve m.5/1-b şartları, transfer fiyatlandırması ne olur? Türk şirketi o şirkete mal ihraç edip tüketiciye o şirket mi satmalı?

## 9. Avukata sorular: yurt dışı satış ve döviz (F19, 2026-11-28)

> Aynı plan için. Cevaplar gelmeden ilgili ayar canlıda açılmaz.

**9.1 Türkiye'deki tüketiciye döviz.**
- _Varsayım:_ Türkiye teslimat adresli her sipariş TL ile ödenir; Türkçe vitrinde fiyat TL ve tüm vergiler dahil (Fiyat Etiketi m.9/4 ve m.5/2-c; Reklam m.13/4 ve m.13/2). Menkul satışında 2025'ten beri döviz serbest olsa da bu kural uygulanır.
- _Soru:_ Uygun mu?

**9.2 Türkçe vitrinde bilgi amaçlı döviz.**
- _Varsayım:_ Gösterilmez.
- _Soru:_ TL'nin yanında "≈ $X" göstermek m.13/1 "anlam karışıklığı" sayılır mı?

**9.3 İngilizce vitrinde yalnız döviz fiyat.**
- _Varsayım:_ `/en` yalnız yurt dışına teslimatla satar, fiyatı dövizdir; Türkiye adresi seçilince sepet TL'ye geçer.
- _Soru:_ Türk tüketici mevzuatına aykırı mı? Ülkeye göre farklı fiyat Reklam m.13/10 "kişiselleştirilmiş fiyat" sayılır mı?

**9.4 Yurt içi turun dövizle satışı.**
- _Varsayım:_ Türkiye'de yerleşik T.C. vatandaşına yurt içi tur dövizle satılmaz (Tebliğ m.8/7; konaklama istisnası tura uygulanmaz). Yabancı uyruklu müşteriye ödemede uyruk beyanıyla (kutucuk + ülke) dövizle satılır.
- _Soru:_ Beyan yeterli mi, pasaport bilgisi saklanmalı mı (KVKK)? Yurt dışı paket turda (m.8/7-ç) herkese döviz fiyat uygun mu?

**9.5 Sözleşme dili.**
- _Varsayım:_ Yabancı müşteriye ön bilgilendirme ve mesafeli satış sözleşmesi İngilizce; Türkçe metin bağlantıyla ayrıca verilir.
- _Soru:_ 805 sayılı Kanun karşısında yeterli mi? Paket Tur Sözleşmeleri Yönetmeliği'ndeki broşür ve sözleşme İngilizce verilebilir mi?

**9.6 AB tüketicisi.**
- _Soru:_ İngilizce vitrin ve EUR fiyat "yöneltme" sayılırsa hangi AB kurallarına (cayma, ayıplı mal, fiyat gösterimi, dil) uyulmalı? Satış koşullarında hukuk seçimi yazılmalı mı?

**9.7 Bıçak ihracatı.**
- _Soru:_ Varış ülkesi kısıtları (UK yaş doğrulaması, AB, ABD) için platformun ve mağazanın sorumluluğu nedir?

**9.8 Yurt dışı şirketin yönetimi.**
- _Soru:_ Stripe için kurulan yurt dışı şirket Türkiye'den yönetilirse hukuki riskler nelerdir?
