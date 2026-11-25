# Yapay zekâ kredi satışı: kararlar, sağlayıcı şartları, sözleşme taslağı

> adr/0085'in kod dışı yarısı. Bayrak `ai.platform_credits` bu belgedeki "Satıştan önce" listesi bitmeden hiçbir pakette açılmaz.
> Sağlayıcı şartları 2026-11-25'te sağlayıcıların kendi sayfalarından okundu; okuma özetidir, hukuki görüş değildir.

## 1. Sahibin kararları (2026-11-25)

| Konu | Karar |
|---|---|
| Fatura | Kredi satılınca tam tutar faturalanır ("ürün olarak kredi almış olacak"). Süresi dolan kredi için ayrı belge yok. Mali müşavire yalnız teyit için sorulur. |
| Fiyat ölçüsü | Metin işlerinde maliyetin yaklaşık 4 katı (1 kredi ≈ 0,01 $); görselde düşük pay: sahne 20 kredi, arka plan temizleme 5 kredi. TL tutar günün kuruyla hesaplanıp yuvarlanır; paketler üst panel ayarıdır. Başlangıç değeridir: daha ucuz servis bulununca yönlendirme ve fiyat üst panelden değişir. |
| Aylık hak | Paket yıllık 15–20 bin TL bandında satılacak; zarar ettirmeyen makul bir hak: paket varsayılanı ayda **500 kredi**, üst paket **1.500** (üst panelde paket limiti). Kullanılmayan hak devretmez. |
| Elle yükleme | Elden ödeme alınınca personel üst panelden kredi ekler ("sana 500 kredi yükledim"); mağazaya özel aylık hak da verilebilir. İkisi de bugün var (gerekçeli, denetim kayıtlı). |
| Servisler | "Ucuz ve kaliteli, dengede." Metinde Qwen (Alibaba, Singapur), görselde Bria bağlanır ve önce denenir; yönlendirme deneme sonuçlarına göre seçilir. Photoroom, yazılı izin gelene kadar kredi yolunda kullanılmaz. |
| Sözleşme | Madde taslağı bu belgede (§4); sahip yanlış gördüğünü düzeltir, son metin hukukçunun. |

Maliyet karşılığı: 500 kredi yaklaşık 250 ürün açıklaması ya da 25 sahne görseli; bize ayda en çok 1,25–2,50 $.

## 2. Sağlayıcıların yeniden satış şartları

Bizim kullanım: API'yi kendi ürünümüze gömüp müşterilerimize ücretli sunmak; müşteri sağlayıcının adını görmez, anahtara ve ham API'ye erişmez.

| Sağlayıcı | Hüküm | Dayanak | Veri |
|---|---|---|---|
| DeepSeek (doğrudan) | Açık izin | [Open Platform ToS](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html) §1.1 "internal and external end users"; yeniden satış yasağı yok; §2.2 anahtar paylaşılmaz | Çin'de işlenir, Çin hukuku; eğitimde kullanılabilir (çıkma e-postayla); DPA yok. Kişisel veri gönderilmez. |
| MiniMax (uluslararası) | Açık izin | [ToS](https://platform.minimax.io/protocol/terms-of-service): yalnız "outside of any integrated applications" yeniden satış yasak; adını anmak yazılı izne bağlı | ABD veri merkezi; iyileştirmede kullanım var, çıkma yolu yazmıyor; DPA bulunamadı |
| Google Gemini | Açık izin, **yalnız ücretli katman** | [Ek şartlar](https://aistudio.google.com/docs/terms); API Terms §4.a.1 ham API eşdeğerini satmak yasak | Ücretli katmanda eğitim yok, 55 gün kötüye kullanım kaydı, DPA var. Ücretsiz AI Studio anahtarı mağaza verisiyle kullanılmaz. |
| Photoroom | **Belirsiz; self-serve hesapla fiilen izin yok** | [Terms](https://www.photoroom.com/terms) §2.1.b "own internal business purposes", §2.5 "resell" yasağı; kendi müşterisine sunmak [Enterprise](https://www.photoroom.com/legal/enterprise-services-agreement) §1.1(b) beyaz etiket lisansı ister; Partner planında logo zorunlu | ABD; eğitim konusunda üç metin çelişiyor |
| Alibaba Model Studio (Qwen) | Belirsiz (ne izin ne yasak yazıyor) | Ücretli kullanım şartlarında yeniden satış maddesi yok | Singapur "International" kapsamı: veri Singapur'da, Çin anakarası hariç; eğitim yok; saklama ≤30 gün; DPA var |
| Bria | Belirsiz, açığa yakın | [T&C v1.4](https://bria.ai/legal-lobby): "Derivative" = ürünü gömen hizmet; §2.4 içerik kuralları müşteri şartlarına eklenir; §1.6.7'nin başı okunamadı | §2.2 yazılı onay olmadan eğitim yok; DPA var; işlendiği ülke ve saklama yazmıyor |

Son kullanıcıya iletilmesi gerekenler: DeepSeek §8.1 çıktının yapay zekâ ürünü olduğunun bildirilmesini zorunlu kılar; Gemini ve Photoroom yaş sınırı koyar (18 / 13); MiniMax ve DeepSeek markalarının izinsiz kullanılmasını yasaklar (adı göstermeme düzenimizle uyumlu).

## 3. Ucuz ve kaliteli denge: servis araştırması

### Metin ve görsel okuma

| Aday | 1M belirteç (girdi / çıktı) | Not |
|---|---|---|
| **Qwen3.8-Flash, Alibaba Singapur** (bağlandı, #389) | 0,15 / 0,47 $ (açıklama ≈ 0,0005 $) | OpenAI uyumlu; görsel de okur; `enable_thinking: false` şart; `json_schema` Singapur'da yok. Türkçe için bağımsız ölçüm yok: kendi deneme setimizde karşılaştırılacak. |
| DeepSeek'in Alibaba Singapur kopyası | 0,30 / 1,20 $ (yoğun saat dışında yarısı) | Aynı model, veri Çin yerine Singapur'da; yedek adayı |
| DeepSeek doğrudan (bugün) | 0,30 / 1,20 $ | Veri Çin'de |
| MiniMax M3.1-Flash (bugün) | 0,15 / 0,60 $ | JSON kipi belgesiz |
| ByteDance Seed 2.0 (BytePlus) | mini 0,10 / 0,40 $ | Veri Malezya/Endonezya/AB; şartı okunamadı; Türkçe kalite kaynağı yok |
| Zhipu GLM (Z.ai) | 0,15 / 0,50 $ | **Elendi**: kullanılan modelin adını açıklamayı şart koşuyor |
| Moonshot Kimi | 2–3 / 10–15 $ | **Elendi**: pahalı, eğitim varsayılan açık |

### Görsel

| İş | Aday | Görsel başına | Not |
|---|---|---|---|
| Arka plan | **Bria RMBG 2.0** (bağlandı, #390) | 0,018 $ | Lisanslı veriyle eğitilmiş; şart teyidi bekliyor |
| Arka plan | Pixelcut | 0,05 $ | Şartı en açık olan; senkron; Photoroom bağlayıcısının türeviyle bağlanır. Yedek. |
| Arka plan | BiRefNet (açık model, MIT) | barındırma | Veri bizde kalır; kendi GPU'muz gerekir |
| Sahne | **Bria Replace Background (fibo2)** | 0,032 $ | Ürünün pikselleri geri yapıştırılır (yeniden çizilmez) |
| Sahne | Gemini görsel (bağlı) | 0,034 $ | Ürünü baştan çizer; şeffaf arka plan yok |
| Sahne | Qwen-Image 2.x | 0,016–0,035 $ | Ürünü baştan çizer |
| — | remove.bg | — | **Elendi**: API 2026-12-01'de kapanıyor |
| — | Claid, Photoroom Partner | — | **Elendi**: yeniden satış yasak ya da logo zorunlu |
| — | Stability | 0,05–0,08 $ | Varsayılan eğitim açık; sahne ucu iş kuyruğunda |

## 4. Mağaza sözleşmesine eklenecek maddeler (taslak)

> Hukukçu gözden geçirene kadar taslaktır. Köşeli parantezler doldurulacak değerlerdir.

**Madde X. Yapay zekâ özellikleri ve platform kredisi**

X.1. **Tanım.** Platform kredisi, Mağaza'nın paneldeki yapay zekâ özelliklerini (metin üretimi, görsel okuma, görsel düzenleme) Platform'un sağladığı servisler üzerinden kullanmasını sağlayan ön ödemeli kullanım birimidir. Her işlemin kaç kredi düşeceği panelde işlemden önce gösterilir.

X.2. **Aylık hak.** Paket, her takvim ayı için [500] kredi içerir. Aylık hak ay başında yenilenir; kullanılmayan kısmı sonraki aya devretmez ve paraya çevrilemez.

X.3. **Satın alınan kredi.** Mağaza ek kredi paketi satın alabilir. Satın alınan kredi, son yüklemeden itibaren 12 ay geçerlidir; her yeni yükleme mevcut satın alınmış bakiyenin süresini yeniden 12 aya uzatır. Süresi dolan kredi silinir. Önce aylık hak, sonra satın alınan kredi kullanılır.

X.4. **Fatura ve iade.** Kredi paketinin bedeli satış anında tam tutarıyla faturalanır. Kullanılmış ya da süresi dolmuş kredi iade edilmez. Kullanılmamış satın alınmış kredi, hizmet Platform'un kusuruyla sunulamadığı hâller dışında iade edilmez; tüketici mevzuatından doğan haklar saklıdır.

X.5. **Ücretlenmeyen işlemler.** Servis sağlayıcının işlemi hiç yapmadığı durumlarda (bağlantı hatası, sağlayıcı arızası, Platform'un hesabından kaynaklanan ret) kredi düşülmez ya da geri verilir. Mağaza'nın isteği sağlayıcının içerik kurallarına takıldığı için reddedilirse kredi düşülebilir.

X.6. **Kullanım sınırları.** Platform, kötüye kullanımı ve hesabın ele geçirilmesinden doğacak zararı önlemek için günlük kredi tavanı, eşzamanlı işlem ve hız sınırı uygular; bu sınırları makul ölçüde değiştirebilir.

X.7. **Fiyat değişikliği.** Platform, kredi paketlerinin fiyatını ve işlem başına kredi değerlerini [30] gün önceden bildirerek değiştirebilir. Değişiklik, daha önce satın alınmış kredinin adedini azaltmaz.

X.8. **Yapay zekâ çıktısı.** Üretilen metin ve görseller yapay zekâ ürünüdür; hata, eksik ya da gerçeğe aykırı bilgi içerebilir. Mağaza, yayımlamadan önce çıktıyı denetlemekle ve yürürlükteki mevzuata (tüketicinin korunması, reklam, fikrî haklar) uygunluğundan sorumludur. Yapay zekâyla düzenlenmiş ya da üretilmiş görseller dosya içinde bu yönde işaretlenir; Mağaza bu işareti kaldırmamayı kabul eder.

X.9. **Kabul edilebilir kullanım.** Mağaza, yapay zekâ özelliklerini hukuka aykırı, yanıltıcı, üçüncü kişilerin haklarını ihlal eden ya da servis sağlayıcıların kullanım kurallarının yasakladığı içerik üretmek için kullanamaz; özelliklere 18 yaşından küçük kişilerin erişmesine izin veremez. Aykırılıkta Platform ilgili özelliği askıya alabilir.

X.10. **Alt işleyenler ve yurt dışına aktarım.** Yapay zekâ işlemleri için Mağaza'nın gönderdiği içerik (ürün adı, açıklaması, nitelikleri, ürün görselleri ve Mağaza'nın yazdığı talimat) Platform'un seçtiği servis sağlayıcılara iletilir. Güncel sağlayıcı listesi ve verinin işlendiği ülkeler [adres]'te yayımlanır; liste değiştiğinde Mağaza bilgilendirilir. Bu sağlayıcılar yurt dışındadır. Platform, alıcı müşterilere ait kişisel verileri bu servislere göndermeyecek teknik önlemleri alır; Mağaza da talimat ve içerik alanlarına kişisel veri yazmamayı kabul eder.

X.11. **Kendi anahtarını kullanma.** Paket izin veriyorsa Mağaza kendi servis hesabının anahtarını bağlayabilir. Bu durumda işlem Mağaza'nın o sağlayıcıyla yaptığı sözleşmeye tabidir, ücreti sağlayıcı Mağaza'dan alır ve platform kredisi düşülmez.

X.12. **Hizmetin değişmesi.** Platform, arkadaki servis sağlayıcıyı ve modeli, benzer nitelikte sonuç vermek kaydıyla, önceden bildirmeksizin değiştirebilir.

## 5. Satıştan önce

1. **Photoroom'a yazılı soru** (yanıt gelene kadar kredi yolunda kapalı): "Under a self-serve paid API plan, may we embed background removal in our multi-tenant SaaS and let our merchant customers use it (paid via our platform credits, without Photoroom branding), or do we need an Enterprise Order Form with the White Label license under §1.1(b)?"
2. **Bria'ya yazılı soru** (legal@bria.ai; teyit gelene kadar kredi yolunda yönlendirilmez): "We embed your background removal and background replacement APIs in our multi-tenant e-commerce SaaS; our merchant customers use them through our product, paid with our platform credits, without Bria branding. Is this permitted under the self-serve pay-as-you-go plan (Online General T&C §1.6.7)? Where is customer content processed and how long is it retained?" Ayrıca sonuç görselinin sunucu adı ilk gerçek çağrıda doğrulanır.
3. **Alibaba'ya soru:** ücretli Model Studio kullanımında modeli kendi SaaS ürünümüze gömüp müşterilerimize ücretli sunmak serbest mi (şartlarda madde yok).
4. **DeepSeek ve MiniMax** kredi yolunda kalacaksa: API verisinin eğitimde kullanılmaması ve DPA için yazılı talep. Öneri: kredi yolunda metin Qwen'e (Singapur) alınır, DeepSeek doğrudan ucu yalnız mağazanın kendi anahtarında kalır.
5. **Gemini:** yalnız faturalandırması açık Cloud projesinin anahtarı (ücretli katman).
6. **Deneme:** Qwen ile bugünkü metin servisleri aynı Türkçe istemlerde, Bria ile Photoroom aynı ürün fotoğraflarında yan yana karşılaştırılır; Qwen'de çıktı tavanının sağlayıcıda uygulandığı tek çağrıyla doğrulanır.
7. **Mali müşavir teyidi:** satışta tam tutarlı fatura; süresi dolan kredi; 12 ay ömür.
8. **Hukukçu:** §4 maddeleri; KVKK yurt dışı aktarım dayanağı (standart sözleşme, aydınlatma metni); alt işleyen listesinin yayımlanacağı sayfa.
9. **Üst panel ayarları:** paket limiti `ai_free_credits_per_month` (500 / 1.500), kredi paketleri (ad, kredi, TL), yönlendirme.
10. Bayrak `ai.platform_credits` önce tek bir deneme mağazasında açılır.
