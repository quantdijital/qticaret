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
