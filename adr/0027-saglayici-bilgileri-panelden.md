# ADR-0027: Sağlayıcı hesap bilgileri panelden girilir, veritabanında şifreli durur

- **Durum:** Kabul edildi (2026-10-27, kullanıcı talebi: "mağaza bilgilerini panelden ayarlardan girilebilecek şekilde yapalım, müşteri odaklı çalışalım"). ADR-0002'nin yerini alır.
- **Tarih:** 2026-10-27

## Bağlam

ADR-0002, sağlayıcı anahtarlarını ortam değişkeninde tutuyordu. Anahtar değişince secret güncellenip instance yeniden başlatılıyordu. Kullanıcı 2026-10-27'de F5 V1'in başında bunun yerine müşteri odaklı bir yol istedi: mağaza sahibi PayTR'nin mağaza bilgilerini kendi panelinden girer. Platform ekibine ve yeniden başlatmaya gerek kalmaz.

PayTR'de üç bilgi var (dev.paytr.com, "iFrame API Entegrasyon Süreçleri"; PayTR Mağaza Paneli > Destek & Kurulum > Entegrasyon Bilgileri > API Entegrasyon Bilgileri):

- Mağaza no (`merchant_id`): gizli değil.
- Mağaza parola (`merchant_key`): gizli.
- Mağaza gizli anahtar (`merchant_salt`): gizli.

Test modu ayrı bir hesap değildir. Aynı bilgilerle istek başına `test_mode=1` gönderilir.

ADR-0002'nin itirazları ve bu karardaki cevapları:

- **Sağlayıcı izolasyonu:** Ödeme sağlayıcısı kendi modülünün container'ına kapalı. Medusa, uygulamanın paylaşılan container'ını `@medusajs/framework`'ten `container` olarak dışa açıyor (framework kaynağı, `container.ts`). Sağlayıcı bilgileri çağrı anında bu yoldan okur. Bilgiler sağlayıcının `data`'sına ya da `context`'ine girmez.
- **Veritabanı sızıntısı:** Gizli değerler AES-256-GCM ile şifrelenir. Anahtar veritabanında değil, ortam değişkenindedir. Yalnızca veritabanını ele geçiren biri değerleri okuyamaz.

## Karar

1. **`integration-credentials` modülü.** Sağlayıcı başına tek kayıt (`provider` tekil):
   - Gizli olmayan ayarlar `settings` JSON'unda; PayTR'de `merchant_id` ve `test_mode`.
   - Gizli alanlar tek bir şifreli blokta (`secret_ciphertext`). Ek doğrulanmış veri (AAD) sağlayıcı ve ayarlardır (`integration_credentials:<provider>:<sıralı ayar JSON'u>`): başka satıra kopyalanan blok da, veritabanında arkadan değiştirilen test modu ya da mağaza no da kaydı "okunamaz" yapar.
   - Kayıtta şifreleme anahtarının parmak izi (`key_id`, anahtarla HMAC) ve sürüm (`secrets_version`) var; ayrıca son doğrulama sonucu (`verified`, `unverified`, `rejected`) ve zamanı, son değiştiren kişi.
   - Sağlayıcıların alan şemaları kodda tanımlıdır. Serbest anahtar-değer yok.
2. **Şifreleme anahtarı env'de:** `CREDENTIALS_ENCRYPTION_KEY` (32 bayt, 64 hex).
   - Canlıda ve staging'de zorunlu. PII anahtarlarından farklı olmalı.
   - Yerelde yoksa uygulama açılır, ama bilgiler kaydedilemez. Panel bunu söyler.
   - Anahtar değişirse eski kayıt çözülemez. Panel "bilgileri yeniden girin" der, sağlayıcı "yapılandırılmamış" gibi davranır. F17'de anahtar KMS'e taşınır (docs/04).
3. **Gizli değerler yalnızca yazılır.**
   - Hiçbir yanıtta, logda ya da denetim kaydında gizli değer, son haneleri veya karması yer almaz.
   - Gönderilen değer kayıtlıyla karşılaştırılmaz: gönderilen her gizli alan yeni sayılır, PayTR'ye sorulur ve sürümü artırır. Böylece yanıt bir tahminin doğru olup olmadığını söylemez.
   - Okuma ucu yalnızca şunları döner: gizli alanın kayıtlı olup olmadığı, ayarlar, durum ve son değişiklik.
   - Panelde gizli alanlar boş gelir. Boş bırakılan alan kayıtlı değeri korur.
4. **Kaydetmeden önce doğrulanır.**
   - PayTR'de, uydurma bir `merchant_oid` ile durum sorgusu yapılır:
     - `004` (işlem bulunamadı): bilgiler doğru.
     - `001`: mağaza no hatalı ya da mağaza pasif.
     - `003`: parola ya da gizli anahtar hatalı.
   - Bilgiler hatalıysa kayıt reddedilir; hata alan bazında döner.
   - PayTR'ye ulaşılamazsa (ağ, zaman aşımı, 5xx, açık devre kesici) ilk bağlantı kaydedilir ve "doğrulanamadı" olarak işaretlenir. Çalışan, doğrulanmış bir hesabın yerine ise doğrulanmamış bilgi yazılmaz: kayıt reddedilir, eski hesap korunur.
   - PayTR belgelenmemiş bir yanıt verirse kayıt yapılmaz.
   - Panelden yapılan kontrol 8 saniyede kesilir.
   - Yalnızca test modu değiştiyse doğrulama yapılmaz.
   - "Bağlantıyı test et" kayıtlı satırı veritabanından okur ve sonucu yalnızca satır o arada değişmediyse yazar. Ulaşılamazsa durum değişmez; PayTR reddederse durum "reddedildi" olur.
5. **Mağaza no değişirse iki gizli alan da yeniden istenir.** Bir hesabın parolası başka hesabın numarasıyla eşleşmesin diye.
6. **İş akışı ve denetim.**
   - Kayıt `saveIntegrationCredentialsWorkflow` ile yapılır: önce doğrulama adımı, sonra telafili kayıt adımı.
   - Denetim kaydında ayarlar önce/sonra görünür. Gizli alanlar için yalnızca sürüm numarası değişir.
   - Kayıt silinebilir. Silinen kayıtla sağlayıcı "yapılandırılmamış" gibi davranır.
   - Uçlar personele açık (`requireUserActor`); secret API anahtarı ne kaydedebilir ne test ettirebilir (sağlık ucu dahil). Hız sınırı adres başına ve personel başına.
   - Her bağlama, hesap/gizli bilgi değişikliği, test modu değişikliği ve kaldırma, bütün yöneticilere panelin zilinde bildirilir: kim, ne yaptı. Bildirim yazılamazsa değişiklik geri alınır.
   - **Canlıya çıkış engeli:** Rol kısıtı (yalnızca mağaza sahibi) ve gizli alan değişikliğinde ikinci doğrulama F12.6'da gelir. O zamana kadar personeli olan bir mağaza ödeme alacak şekilde canlıya alınmaz (F16 kontrol listesi). **Kalktı (2026-10-29, F12 Y4):** hesaplar yalnızca sahibe açık, gizli alan yazma ve silme yeniden doğrulama istiyor (adr/0040 §1, §3).
7. **Önbellek.**
   - Çözülmüş bilgiler süreç belleğinde tutulur. Platform ayarlarındaki sürümlü önbellek kalıbı kullanılır: Redis'teki sürüm işareti diğer süreçlere değişikliği bildirir.
   - Değişiklik yeniden başlatma gerektirmez.
8. **Sağlayıcı adresi kodda.**
   - PayTR'nin adresi `https://www.paytr.com`. `PAYTR_BASE_URL` ve `IYZICO_BASE_URL` yalnızca geliştirici makinesinde ve testte sahte sunucu içindir; canlıda ve staging'de tanımlıysa açılış reddedilir. (2026-10-27: önce "yalnızca development/test"ti; `NODE_ENV` tanımsız çalışan `medusa` CLI'ı yerelde düşürdüğü için kural "staging ve canlıda yasak" oldu.)
   - iyzico'da sandbox ve canlı adresler sabit iki değerdir; hangisinin kullanılacağı paneldeki moda (`test_mode`) göre seçilir. Serbest URL yok. Sandbox'ın kendi anahtarları var: `test_mode` iyzico'nun kimlik alanıdır, değişince iki anahtar da yeniden istenir ve yeni adreste doğrulanır.
9. **Kapsam.** Kural, mağazanın kendi sağlayıcı hesaplarına uygulanır: PayTR, iyzico, sonra Geliver, e-fatura ve SMS. [2026-11-26: Geliver kaldırıldı; kargo hesapları Aras ve Yurtiçi, ADR-0031 ek.] Platformun kendi sırları (veritabanı, JWT, PII anahtarları, S3) env'de kalır.

## Alternatifler

| Seçenek | Artı | Eksi |
|---|---|---|
| **Panelden, DB'de şifreli (seçilen)** | Mağaza sahibi bilgisini kendisi girer, doğrulanmış olarak; yeniden başlatma yok | Yeni modül; şifreleme anahtarının yönetimi; sağlayıcı paylaşılan container'dan okur |
| Env + restart (ADR-0002) | Basit, saldırı yüzeyi küçük | Her değişiklik platform ekibine ve yeniden başlatmaya bağlı; müşteri kendi hesabını bağlayamaz |
| Ayar bölümüne (`platform-settings`) gizli alan | Mevcut kalıp | Ayar okuma ucu her alanı döner; sırların ayrı bir modülde, yalnızca yazılır biçimde durması daha az hataya açık (docs/04: ayar bölümünde sır tutulmaz) |
| Control plane'de (F17) secret store | En güçlü ayrım (KMS) | F17'ye kadar yok; bu karar F17'de anahtar saklama yerini değiştirir, arayüzü değiştirmez |

## Sonuçlar

- **Env değişiklikleri:** `PAYTR_MERCHANT_*` ve `PAYTR_TEST_MODE` env'e girmez. iyzico'nun yerel `.env`'deki sandbox anahtarları V8'de panele taşınır; iyzico istemcisi V8'de bu modülden okur.
- **Kurulum:** Yerel `.env`'e `CREDENTIALS_ENCRYPTION_KEY` eklenir (`openssl rand -hex 32`). CI ve testler kendi anahtarlarını üretir.
- **Panel:** Ayarlar > Ödeme ekranı V1'de gelir: PayTR bağlantısı, test modu, PayTR panelinde yapılacaklar (bildirim adresi, bilgilerin yeri). Taksit ayarları V6'da, işlem kartı V7'de.
- **Sağlık kontrolü:** PayTR kontrolü kayıtlı bilgilerle durum sorgusu yapar (`004` = sağlıklı).
- **Medusa yükseltmesinde:** paylaşılan `container`'ın sağlayıcı çağrısında modülü çözdüğü testle yeniden doğrulanır (V2 sözleşme testi).
- **F12 (canlıya çıkış engeli):** Bu uçlar rol modeliyle mağaza sahibine kısıtlanır; gizli alan, mağaza no ve test modu değişikliğine ikinci doğrulama (yakın zamanda giriş ya da TOTP) gelir.
- **Test modundaki ödemeler (V3, V7):** test modu canlı anahtarla çalıştığı için, test modunda ödenen sipariş kalıcı işaret taşır; panelde rozetle görünür ve kargoya verilmesi engellenir. Test modu değişikliği bildirimle izlenir. (V3, 2026-10-27: işaret ayrı bir alan değil, ödemenin kendi verisindeki `test_mode`; sipariş hangi yoldan açılırsa açılsın aynı kaynak okunur. Kargolama bizim akışımızda ve Medusa'nın çekirdek ucunda reddediliyor.)
- **Workflow kalıcılığı:** Kaydetme ve kaldırma workflow'larında `store` ya da saklama süresi açılmaz; açılırsa şifreli blok `workflow_execution`'da kalır.

## Ek (2026-10-27, F5 V10 kod ve güvenlik incelemesi): sağlayıcının okuyup yazabildikleri

Paylaşılan container'dan erişim ilk kararda yalnızca sağlayıcı hesabını (`integration-credentials`) okumak içindi. İki dar istisna eklendi:

- **İade defteri (`order-refunds`), yalnızca iyzico:** iyzico iadeyi tekilleştirmiyor, yapılan iadeleri listeleyen bir uç da sunmuyor. Bu yüzden sağlayıcı, sipariş iademizin `pending_refund` ile adını verdiği defter satırına kalem işlemi parçalarını (`provider_parts`) yazar ve aynı ödemenin bütün parçalarını okur. Her parça gönderilmeden önce `sending`, iyzico'nun imzalı ve isteğe uyan yanıtından sonra `done` olur. Defter başka hiçbir şey için yazılmaz. Sağlayıcı ancak iademiz zaten açıkken (sipariş iadesinin kilidi altında) çağrılır.
- **Kurtarma kaydı (`payment-recovery`), salt okunur:** iyzico sağlayıcısının yetkilendirmesi, iadeye yazılmış bir ödemeyi `error` sayar. Böylece bu ödeme sepet tamamlamayla siparişe dönüşmez.

Bu iş parçaları bir workflow'a taşınamaz: parçalar, bir Medusa çağrısının (`refundPaymentWorkflow` → sağlayıcının `refundPayment`'i) içinde ve sırayla gönderiliyor. Her gönderimden önce kalıcı kayıt gerekiyor. PayTR iadeyi kendi referansıyla tekilleştirdiği için PayTR sağlayıcısı bu istisnaları kullanmaz.

## Ek 2026-11-26: DHL eCommerce'te uygulama anahtarları platformun

DHL eCommerce Türkiye (eski MNG Kargo) iki kimlik ister (`docs/entegrasyonlar/dhlecommerce.md`): API portalında açılan **uygulamanın** anahtarları (`X-IBM-Client-Id`, `X-IBM-Client-Secret`) entegre eden yazılımı tanır; mağazanın **müşteri numarası ve şifresi** sözleşmeyi. Sahip kararı (2026-11-26): uygulama anahtarları **platformundur**.

- **Karar:** Quant, DHL'in portalında tek bir uygulama açar; anahtarlar sunucu ortamından okunur (`DHL_ECOMMERCE_CLIENT_ID`, `DHL_ECOMMERCE_CLIENT_SECRET`; `apps/backend/env.example`), loga, hata metnine ve panele girmez (HTTP istemcisinin `secrets`'i). Mağaza panelden yalnız müşteri numarası ve şifresini girer; bunlar diğer hesaplar gibi mühürlü saklanır.
- **Bu kuralın istisnası, ilk değil:** Kural (§9) mağazanın kendi hesaplarınadır; uygulama anahtarı mağazanın değil platformun kimliğidir. Paraşüt'ün OAuth istemcisi (`PARASUT_CLIENT_*`, ADR-0034) ve Google'ınki aynı kalıptadır.
- **Anahtarlar yoksa:** bu sunucuda DHL eCommerce bağlanamaz; panel kargo sayfası bunu söyler ve kaydetmeyi kapatır, sunucu hesabı kaydetmez (`dhlecommerce.unavailable`). Uygulama çökmez, başka taşıyıcılar etkilenmez.
- **Geliştirme ve testler:** sahte DHL eCommerce adresi (`DHL_ECOMMERCE_BASE_URL`, yayında reddedilir) tanımlıyken ve anahtar verilmemişken sahtenin geliştirme uygulaması kullanılır.
- **Canlıya geçiş:** DHL canlı aboneliği API başına elle onaylar ve çıkış IP'sini izin listesine alır. Her yeni mağazada `entegrasyon@mngkargo.com.tr`'ye uygulama adı, mağazanın müşteri numarası ve instance'ın çıkış IP'si yazılır (F16 işi; gerçek hesapla doğrulanacak).
- **Sonuç:** Anahtar sızarsa tüm mağazaların DHL çağrıları aynı uygulamadan gider; anahtar döndürmek tek ortam değişkeni ve yeniden başlatmadır. JWT her mağazanın kendi hesabıyla alınır; bir mağazanın şifresi başkasının çağrısına karışmaz (önbellek anahtarı adres + müşteri no + şifre özeti).

## Ek 2026-11-26 (2): mağazanın kendi uygulama anahtarları ve DHL'in askıya alınması

Sahip kararları (2026-11-26):

- **"DHL için o şekilde olsun": platformun anahtarları varsayılan, mağazanınki isteğe bağlı.** DHL eCommerce hesap formunda kapalı bir "Kendi uygulama anahtarlarım var" bölümü vardır: mağaza DHL'in portalında kendi uygulamasını açtıysa `X-IBM-Client-Id` ve `X-IBM-Client-Secret`'ını (ikisi birlikte ya da hiçbiri; `integration-credentials` sağlayıcısında `client_id`, `client_secret`, `optional`) yazar. Şifre gibi hesapla birlikte mühürlenir, bir kez yazılır, geri okunmaz, panelde maskeli (`SecretField`), loga ve hata metnine girmez (HTTP istemcisinin `secrets`'i her iki uygulamayı da kapsar). Varsa her çağrıda platformunkinin yerine kullanılır (`DhlEcomCredentials.app`; JWT önbellek anahtarına uygulamanın kimliği de girer). Platformun anahtarları yoksa taşıyıcı yine bağlanabilir: kayıt ve "Bağlantıyı test et", gönderilen ya da aynı hesap (aynı mod) için saklanan kendi anahtarları arar (`assertProviderAvailable`); ikisi de yoksa `dhlecommerce.unavailable`. Hesap kontrolü hangi anahtar geçerliyse onunla yapılır. Kaydedilmiş kendi anahtarlarını silip platformunkine dönmek için hesabı kaldırıp yeniden bağlamak gerekir (istenirse küçük iş; şimdilik yok).
- **"Şuanlık askıya alalım, DHL gizli kalsın, platformda altyapıda durabilir": DHL eCommerce askıda.** Kod ve testler yerinde kalır; tek bir sunucu anahtarı açar: `CARRIER_DHLECOMMERCE_ENABLED=true` (yoksa ya da başka değerse kapalı; `lib/integrations/suspended.ts`). Kapalıyken: Ayarlar > Kargo listesinde yok, `/settings/shipping/dhlecommerce` bilinmeyen firma gibi listeye döner, Entegrasyonlar sayfasında ve sağlık raporunda yok, kargo seçeneği düzenleyicisinde, "Kargo ücreti"nin tablo kaynaklarında ve sipariş panosunun taşıyıcı süzgecinde seçenek değil (panel bunları `GET /admin/shipping-setup/carriers`'dan okur), vitrin altbilgisinde işaret yok, anlaşmalı iade kodu seçiminde atlanır; hesap uçları (`/admin/integrations/credentials/dhlecommerce`, `…/check`) 404 döner; yeni DHL seçeneği reddedilir; daha önce açılmış DHL seçenekleri ödeme adımında listelenmez (`GET /store/shipping-options` yanıtından çıkarılır) ve sağlayıcı sepete eklemeyi, fiyatlamayı ve yeni gönderi açmayı reddeder. Kayıtlı hesap ve seçenekler silinmez; anahtar açılınca her şey olduğu gibi döner. Testler anahtarı açık koşar (`integration-tests/setup.js`); `dhlecommerce-suspended.spec.ts` kapalıyken gizlendiğini doğrular.
- **Neden ortam değişkeni, özellik bayrağı (adr/0012) değil:** askı her mağaza için platformun kararıdır, bir paketin değil; `owner: platform` bayrağı mağazanın Özellikler sayfasında listelenir ve taşıyıcının adını gösterirdi; yargılayan yerlerin çoğu eşzamanlıdır (sağlayıcı, uç doğrulayıcısı). DHL ileride pakete bağlanırsa bayrağa taşınabilir.

