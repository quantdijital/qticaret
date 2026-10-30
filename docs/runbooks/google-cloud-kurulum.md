# Google Cloud kurulumu

> Kullanıcı kararı (2026-10-30): Google Cloud projesini Quant Dijital açacak. Bu sayfa adımları sırayla
> verir. Anahtarlar ve istemci sırları sohbete, e-postaya ya da depoya yazılmaz. Yalnızca sunucunun
> ortam değişkenlerine girilir (F16'da gizli bilgi deposu).

İki ayrı kurulum var:

| Kurulum             | Kaç tane        | Ne için                                                                                                        | Ortam değişkenleri                                                               |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A. Platform projesi | Bir kez         | Mağazaların Google hesabını panelden bağlaması (Merchant Center'a ürün gönderimi, Search Console), CrUX ölçümü | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CRUX_API_KEY`           |
| B. Mağaza projesi   | Her mağaza için | Müşterilerin vitrinde "Google ile giriş" yapması; onay ekranında mağazanın adı görünür                         | `GOOGLE_AUTH_CLIENT_ID`, `GOOGLE_AUTH_CLIENT_SECRET`, `GOOGLE_AUTH_CALLBACK_URL` |

Apple ile giriş kapalı kalıyor (kullanıcı kararı, 2026-10-30); Apple için kurulum gerekmiyor.

## A. Platform projesi (bir kez)

### A1. Ön hazırlık

- Şirketin Google Workspace hesabıyla, yani kişisel değil kurumsal hesapla, `console.cloud.google.com`'a girin.
- Platformun tanıtım sitesi (ör. `quantdijital.com`) Search Console'da doğrulanmış olmalı. Google, uygulamanın alan adının size ait olduğunu buradan görür.
- Sitede gizlilik politikası ve kullanım koşulları sayfaları yayında olmalı.

### A2. Proje

1. Üstteki proje seçicide **Yeni proje**: ad `quant-ticaret-platform`. Kuruluş olarak şirketinizi seçin.
2. **API'ler ve Hizmetler > Kitaplık** altında şu üç API'yi etkinleştirin:
   - **Merchant API**
   - **Google Search Console API**
   - **Chrome UX Report API**

### A3. Onay ekranı (Google Auth Platform)

1. **Google Auth Platform > Markalama:**
   - Uygulama adı: `Quant Ticaret`;
   - destek e-postası;
   - logo (isteğe bağlı; eklenirse marka doğrulaması gerekir);
   - ana sayfa, gizlilik politikası ve kullanım koşulları bağlantıları;
   - yetkili alan adları: tanıtım sitesinin alan adı ve mağaza panellerinin bulunduğu alan adları;
   - geliştirici iletişim e-postası.
2. **Hedef kitle:**
   - Kullanıcı türü **Harici**.
   - Başlangıçta **Test** durumunda kalır. Bu durumda yalnızca eklediğiniz test kullanıcıları (en çok 100) bağlanabilir ve bağlantı 7 günde bir kopar.
   - Deneme için kendi hesabınızı test kullanıcısı olarak ekleyin.
3. **Veri erişimi > Kapsam ekle:** şu dört kapsamı ekleyin.
   - `https://www.googleapis.com/auth/content`
   - `https://www.googleapis.com/auth/webmasters`
   - `openid`
   - `email`

### A4. OAuth istemcisi

1. **Google Auth Platform > İstemciler > İstemci oluştur:** tür **Web uygulaması**, ad `Panel - Google bağlantısı`.
2. **Yetkili yönlendirme URI'leri:** her mağaza panelinin adresi ve sonuna `/google/callback`. Örnekler:
   - `https://panel.ornekmagaza.com/google/callback`
   - Geliştirme için: `http://localhost:9000/google/callback`

   Yeni mağaza açıldıkça adresi buraya eklenir (F16 kurulum listesinde bir madde).

3. Oluşan **istemci kimliği** ve **istemci sırrı**, sunucunun `GOOGLE_OAUTH_CLIENT_ID` ve `GOOGLE_OAUTH_CLIENT_SECRET` değişkenlerine girilir. Sırrı başka bir yere kopyalamayın. Kaybolursa yenisini üretip eskisini silin.

### A5. CrUX API anahtarı

1. **API'ler ve Hizmetler > Kimlik bilgileri > Kimlik bilgisi oluştur > API anahtarı.**
2. Anahtarı **API kısıtlamaları** ile yalnızca **Chrome UX Report API**'ye sınırlayın.
3. Anahtar `CRUX_API_KEY` değişkenine girilir.

### A6. Merchant API geliştirici kaydı

Google, Merchant API'yi kullanan her Cloud projesinin bir kez bir Merchant Center hesabına kaydolmasını
istiyor. Kayıt yapılmazsa her çağrı reddedilir. Bir proje yalnızca **tek bir** Merchant Center hesabına
kaydolabilir. Bu yüzden mağazaların hesapları değil, platformun kendi hesabı kullanılır:

1. Şirket adına bir Merchant Center hesabı açın, tanıtım sitesini doğrulayın. Test hesabıyla kayıt yapılamıyor.
2. Hesabın "gelişmiş hesaba" çevrilmesini isteyin. Google bunu birden çok mağazayı yöneten üçüncü taraflara öneriyor.
3. Kayıt çağrısını (`registerGcp`) biz yaparız: hesap hazır olunca hesap numarasını ve teknik iletişim e-postasını iletin. Kayıttan sonraki 5 dakika içinde çağrılar çalışmaya başlar.

Mağazalar kendi Merchant Center hesaplarını panelden bağlar. Kendi Cloud projesi açmaları gerekmez.

### A7. Google doğrulaması (canlıya çıkmadan önce)

`content` ve `webmasters` hassas kapsamlar. Uygulama doğrulanmadan bağlanan kullanıcılar "Google bu
uygulamayı doğrulamadı" uyarısı görür ve en çok 100 kullanıcı bağlanabilir.

1. **Hedef kitle > Uygulamayı yayınla** ile durumu **Üretimde** yapın.
2. **Doğrulama merkezi**'nden başvurun:
   - her kapsamın neden gerektiğini anlatan kısa bir açıklama yazın (ör. "Mağaza ürünlerini Merchant Center'a gönderir; site haritasını Search Console'a bildirir ve arama performansını panelde gösterir");
   - panelden Google bağlantısının yapılışını ve bu verilerin kullanıldığı ekranları gösteren liste dışı bir YouTube videosu ekleyin.
3. Doğrulama birkaç gün ile birkaç hafta sürebilir. Bu süreyi F16 takvimine koyun.

## B. Her mağaza için: Google ile giriş

Onay ekranında müşteri platformun değil mağazanın adını görmeli (ADR-0037). Onay ekranı proje
başına olduğu için her mağazaya ayrı bir proje açılır.

1. **Yeni proje:** ad `<mağaza>-giris`.
2. **Google Auth Platform > Markalama:**
   - uygulama adı: mağazanın adı;
   - logo (isteğe bağlı);
   - ana sayfa: vitrin adresi;
   - gizlilik politikası: mağazanın aydınlatma metni sayfası;
   - yetkili alan adı: vitrinin alan adı.
3. **Hedef kitle:** **Harici**, ardından **Üretimde**. Yalnızca temel kapsamlar (`openid`, `email`, `profile`) kullanıldığı için hassas kapsam doğrulaması gerekmez. Logo eklendiyse marka doğrulaması gerekir.
4. **İstemci oluştur > Web uygulaması:**
   - yetkili yönlendirme URI'si `https://<vitrin alan adı>/hesap/giris/google`;
   - aynı adres `GOOGLE_AUTH_CALLBACK_URL`'e girilir.
5. İstemci kimliği ve sırrı `GOOGLE_AUTH_CLIENT_ID` ve `GOOGLE_AUTH_CLIENT_SECRET` değişkenlerine girilir.

Bir Google hesabının açabileceği proje sayısı sınırlıdır. Mağaza sayısı artınca Cloud konsolundan
kota artışı istenir.

## Kaynaklar

- Merchant API geliştirici kaydı: https://developers.google.com/merchant/api/guides/quickstart/registration
- OAuth onay ekranı ve doğrulama: https://support.google.com/cloud/answer/13463073
