# KVKK veri envanteri ve saklama süreleri

> F13.5, ADR-0041 §6. Hangi tablo hangi kişisel veriyi, hangi amaçla, ne kadar süre tutar; süre dolunca ya da kişi silinmeyi isteyince ne olur.
> **Süreler öneridir.** Mağazanın KVKK danışmanı ve mali müşaviri onaylayana kadar böyle kalır (docs/12). Kodda tek yer: `apps/backend/src/lib/compliance/retention.ts`; gecelik iş: `compliance-retention` (04:15).
> Bir faz kişisel veri tutan yeni bir tablo ya da alan eklerse bu dosyayı da günceller.

**Saklama biçimi kısaltmaları**

| Kısaltma | Anlamı                                                                        |
| -------- | ----------------------------------------------------------------------------- |
| D        | düz metin                                                                     |
| M        | maskeli (`a***@ornek.com`)                                                    |
| Ö        | anahtarlı özet (`hashPii`, HMAC-SHA256; geri çevrilemez, eşitlik aramak için) |
| Ş        | şifreli (`encryptPii`, AES-256-GCM, alan bağlamı ek veri olarak bağlı)        |

**"Silmede" sütunu:** Kişinin silme ya da anonimleştirme talebinde ne olacağını yazar. Bu akış L9'da gelir. "Korunur" yazan veri yasal saklama yükümlülüğü nedeniyle tutulur.

---

## 1. Sipariş, ödeme ve sözleşmeler

| Tablo (modül)                       | Kişisel veri                                                                 | Amaç                                                   | Süre                                                                                                          | Silmede                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `order`, sipariş adresleri (Medusa) | e-posta, ad, soyad, telefon, adres (D)                                       | sipariş, teslimat, fatura                              | 10 yıl (TTK md. 82; VUK md. 253'te 5 yıl), öneri                                                              | Kişisel alanlar yer tutucuya çevrilir; kargo kaydının teslimat adresi ve etiket dosyası da temizlenir. Tutar, kalem ve vergi korunur. |
| `cart`, sepet adresleri (Medusa)    | e-posta, adres (D)                                                           | ödeme öncesi                                           | Siparişe dönüşmeyen sepet son değişiklikten 90 gün sonra e-posta ve adresleriyle silinir (`abandoned_cart_contacts`); parası alınmış ya da ödeme formu açık sepet kalır (öneri) | Siparişe dönüşmeyen sepetin adresi temizlenir (L9).                   |
| `legal_consent` (legal)             | IP (Ş), sepet ve sipariş kimliği                                             | sözleşme onayının kanıtı                               | Siparişe dönüşmeyen sepette 30 gün (iş). Siparişinkinde sözleşme süresi boyunca.                              | Sipariş kopyasıyla aynı.                                              |
| `legal_order_copy` (legal)          | alıcının adı, adresi, iletişim bilgisi, kalemler (Ş, SHA-256 özetli)         | mesafeli satış sözleşmesi ve ön bilgilendirme kopyası  | En az 3 yıl (Mesafeli Sözleşmeler Yönetmeliği), avukat doğrulayacak                                           | Süre dolmadıysa kilitli kalır; dolduysa silinir.                      |
| `age_declaration` (legal)           | sepet kimliği, sınır ve zaman (doğum tarihi tutulmaz)                        | yaş sınırlı satışın kanıtı                             | Siparişe dönüşmeyen sepette 30 gün (iş). Siparişte siparişle birlikte.                                        | Siparişle birlikte.                                                   |
| `checkout_consent` (messaging)      | IP (Ö), sepet kimliği                                                        | ödemede işaretlenen ileti onayı, sipariş oluşana kadar | Sipariş oluşunca silinir. Terk edilen sepette 30 gün (iş).                                                    | Silinir.                                                              |
| `tracking_consent` (conversions)    | GA istemci kimliği (D); `_fbp`, `_fbc`, sayfa adresi (D); IP ve tarayıcı (Ş) | ölçüm onayı ve dönüşüm olayı                           | IP, tarayıcı, `_fbp`, `_fbc`, adres: olay gidince ya da en geç 3 gün. GA istemci kimliği: mağazanın iade süresi + 45 gün (`ga_clients`, öneri). Terk edilen sepetin satırı 30 gün (iş). | Silinir.                                                              |
| `billing_profile` (billing-profile) | ad ya da unvan, vergi dairesi (D); VKN veya TCKN (Ş + Ö, son 4 hane D)       | fatura kimliği                                         | Müşteri hesabı süresince                                                                                      | Bireysel profil kalıcı silinir. Kurumsal profil şirketin olduğu için defterler için kalır. |
| `order_refund` (order-refunds)      | personel notu (D, serbest metin)                                             | iade kaydı                                             | Siparişle birlikte                                                                                            | Not temizlenir, tutar korunur.                                        |
| `chargeback` (chargebacks)          | personel notu (D)                                                            | ters ibraz kaydı                                       | Siparişle birlikte                                                                                            | Not korunur (banka itirazının kanıtı).                                |
| `invoice` (einvoice) ve fatura PDF'i (özel depo) | Kayıtta kişisel veri yok (numara, ETTN, durum, tutar). PDF'te alıcının adı ya da unvanı, adresi, T.C. kimlik ya da VKN'si (D, özel depoda). Gönderimde fatura profilindeki vergi numarası açılır, müşteri bazında denetim kaydına yazılır. | e-Fatura / e-Arşiv (F8) | 10 yıl (VUK md. 253 ve TTK md. 82), öneri | Korunur (vergi belgesi). Sipariş iptalinde fatura programında iptal edilir ya da iade belgesi düzenlenir. |
| `parasut_connection` (einvoice) | Mağazanın Paraşüt erişim ve yenileme jetonu (Ş). Kişisel veri değil, mağazanın hesap erişimi. | Paraşüt bağlantısı | Bağlantı süresince; kaldırılınca kalıcı silinir | — |
| `legacy_order` (migration) | Eski platformdaki siparişin numarası, tarihi, tutarı, durumu, kalemlerin özeti; müşterinin e-postası (D) ve müşteri bağı. | Önceki platformdan taşınan geçmiş siparişler (F14, adr/0042 §4) | Siparişle aynı (10 yıl, öneri): faturası eski platformda kesildi, kayıt müşteriye gösterilmek için tutulur | E-posta silinmiş adresle değişir; tutar ve kalemler kalır (silme talebinde müşteri bağıyla ya da e-postasıyla bulunur). Veri dökümünde "önceki platform siparişleri" olarak yer alır. |
| `migration_item`, `migration_run` (migration) | Kaynak kayıt anahtarı ve hedef kimlik; bazı kaynaklar müşteriyi e-postayla anahtarlar (D). Çalıştırmada sayımlar. | Taşımanın tekrarsızlığı (F14, adr/0042 §3) | Müşteri kayıtları kesimden 90 gün sonra ve davet anahtarı (60 gün) dolunca silinir (`migration-retention`); silme talebinde anahtar özetlenir | — |
| Taşıma dosyası (özel depo, `migration-bundle-*`) ve taşıma raporu | Dosyada müşterilerin adı, e-postası, telefonu, adresleri, izin tarihleri, siparişleri (D). Raporda kaynak anahtarları. | Taşıma işi (F14) | Dosya iş bitince silinir (yarıda kalan, bekletme işiyle 3 gün içinde); rapor 7 gün, yalnızca sahibe | — |
| `return_request` (return-requests)  | müşteri notu, karar notu (D)                                                 | iade ve değişim talebi                                 | Siparişle birlikte                                                                                            | Notlar ve iade kargo etiketi dosyası temizlenir.                      |
| `order_note` (order-notes)          | personel notu (D)                                                            | siparişe iç not                                        | Siparişle birlikte                                                                                            | Notlar temizlenir.                                                    |

## 2. İletişim ve izinler

| Tablo (modül)                       | Kişisel veri                             | Amaç                               | Süre                                                                                                        | Silmede                                                    |
| ----------------------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `message_consent` (messaging)       | alıcı (Ş + Ö + M), müşteri kimliği       | ticari ileti izni, İYS'ye bildirim | İzin geçerliyken; bittikten sonra 3 yıl (Ticari İletişim Yönetmeliği), öneri                                | İzin geri çekilir. İYS kanıtı süresince tutulur.           |
| `message_consent_event` (messaging) | personel notu ya da metin sürümü; IP (Ö) | iznin değişmez kanıt zinciri       | `message_consent` ile aynı                                                                                  | Kanıt süresince tutulur.                                   |
| `consent_request` (messaging)       | alıcı (Ş + Ö)                            | çift onay bağlantısı               | Bağlantı 7 gün açık; süresi dolunca 30 gün sonra silinir (iş)                                               | Silinir.                                                   |
| `message_suppression` (messaging)   | alıcı (Ö + M)                            | gönderilmeyecekler listesi         | Kalıcı. Kişinin isteği olduğu için tutulur.                                                                 | Özet ve maske tutulur (yeniden gönderimi engellemek için). |
| `message_skip` (messaging)          | alıcı (M), müşteri kimliği               | gönderilmeyen iletinin nedeni      | 180 gün (`message-skips-retention`)                                                                         | Silinir.                                                   |
| `notification` (Medusa)             | alıcı adresi (D)                         | gönderim kaydı                     | İletinin metni saklanmaz (2026-10-31 doğrulandı: tabloda metin sütunu yok, `data`'da yalnızca kimlikler). E-posta ve SMS kaydı 3 yıl sonra silinir (`sent_messages`, öneri) | Alıcı temizlenir (L9).                                     |
| `stock_alert` (back-in-stock)       | e-posta (Ş + Ö + M), müşteri kimliği     | stok bildirimi                     | Gönderildikten ya da iptalden 180 gün sonra; doğrulanmamış misafir talebi süresi dolunca 180 gün sonra (iş) | Silinir.                                                   |
| `contact_message` (contact-messages) | ad, e-posta, telefon, mesaj (Ş), e-posta (Ö), müşteri kimliği | vitrinin iletişim formu; mağazanın yanıtı | Geldiğinden 365 gün sonra silinir, yanıtlanmış olsun olmasın (`contact_messages`, öneri; adr/0047). Personel silerse hemen kalıcı silinir | Silinir (hesapla ve e-posta özetiyle bulunanlar). |
| `cart_reminder` (cart-reminders)    | sepet kimliği, bağlantı özeti            | terk edilen sepet hatırlatması     | Bağlantı 7 gün; satır silinmiyor (**açık**, kişisel veri yok)                                               | Sepetle birlikte.                                          |

## 3. Vitrin, ziyaretçi ve hesap

| Tablo (modül)                                     | Kişisel veri                                               | Amaç                    | Süre                               | Silmede                                                       |
| ------------------------------------------------- | ---------------------------------------------------------- | ----------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `customer`, `customer_address` (Medusa)           | ad, e-posta, telefon, adres (D)                            | müşteri hesabı          | Hesap süresince                    | Kişisel alanlar yer tutucuya çevrilir, adresler silinir (L9). |
| `auth_identity`, `provider_identity` (Medusa)     | e-posta ya da Apple kimliği; Apple'dan gelen ad ve e-posta | giriş                   | Hesap süresince                    | Giriş kaydı kaldırılır (L9).                                  |
| `cookie_consent` (legal)                          | ziyaretçi çerezi (Ö)                                       | çerez tercihi ve kanıtı | 2 yıl (iş). Çerezin kendisi 13 ay. | Silinir.                                                      |
| `wishlist_item` (wishlist)                        | müşteri kimliği                                            | favoriler               | Hesap süresince                    | Silinir.                                                      |
| `product_review` (product-reviews)                | yazar adı (ad + baş harf), başlık, metin (D)               | ürün yorumu             | Yayında kaldıkça                   | Yazar adı "Anonim" olur, metin kalır (L9). Taşınan yorum, kaynak yazarın e-postasını verdiyse taşınan müşteriye bağlanır; bağlanamayanın yalnızca ad ve baş harfi tutulur. |
| `product_question`, `product_answer` (product-qa) | yazar adı, metin (D)                                       | soru ve cevap           | Yayında kaldıkça                   | Yazar adı anonimleşir (L9).                                   |
| `search_term_day` (search-terms)                  | aranan metin (kişiye bağlı değil)                          | arama istatistiği       | 180 gün (`search-terms-retention`) | —                                                             |
| `fraud_block` (fraud-guard) | e-posta ve telefon yalnızca anahtarlı özetle (Ş), maskeli görünüm; alan adı; IP adresi (Ö); neden (D) | kara liste (F15.6, adr/0044 §4) | Bitiş tarihine kadar; IP en çok 1 yıl. Süresi geçen kayıt kalıcı silinir (`fraud-retention`) | Kalır: dolandırıcılığa karşı hukuki yarar (KVKK m.5/2-f). Ham değer zaten tutulmaz. |
| `fraud_review` (fraud-guard) | sipariş kimliği, kural adları ve puanlar; personel notu (D) | şüpheli sipariş incelemesi (adr/0044 §3) | Siparişle birlikte | Not temizlenir. |
| Ödeme hız sayaçları (Redis) | IP kovası, e-posta ve telefonun anahtarlı özeti | hız kuralları (adr/0044 §2) | En çok 7 gün (sayaç penceresi) | Kendiliğinden düşer. |
| `traffic_source` (traffic-sources)                | sepet kimliği, UTM, yönlendiren alan adı                   | trafik kaynağı          | Sepet ve siparişle birlikte        | —                                                             |

## 4. Personel, denetim ve sistem

| Tablo (modül)                                   | Kişisel veri                                                                                                          | Amaç                             | Süre                                                                           | Silmede                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `audit_entry` (audit-log)                       | personel kimliği; IP ve tarayıcı (D); değişikliklerde hassas alanlar maskeli                                          | denetim kaydı (ADR-0011)         | IP ve tarayıcı 2 yıl sonra boşaltılır (iş). Kaydın kendisi için süre **açık**. | Kayıt korunur, kimin yaptığı kalır.    |
| `async_job` ve sonuç dosyaları (async-job)      | isteyen personel. Dışa aktarma dosyaları kişisel veri içerebilir (denetim kaydı dosyasında IP ve tarayıcı).           | dışa aktarma, içe aktarma, rapor | Dosyalar 7 ya da 30 gün (türüne göre); kayıt 90 gün (`async-job-retention`)    | Kişinin veri dökümü dosyaları silinir. |
| `staff_role`, `user` (staff, Medusa)            | personel adı, e-posta                                                                                                 | yetki                            | Personel çalıştıkça                                                            | Personel çıkarılınca giriş kaldırılır. |
| `platform_settings_section` (platform-settings) | Şahıs işletmesinde unvan (kişi adı), TCKN, adres, KEP; banka hesap sahibi ve IBAN; iletişim e-postası ve telefonu (D) | mağaza künyesi ve ödeme          | Mağaza süresince                                                               | Mağazanın kendi verisi.                |
| `content_entry` (content)                       | yazar adı (D)                                                                                                         | blog ve sayfa                    | Yayında kaldıkça                                                               | —                                      |

**Gözlemlenebilirlik (ADR-0045, F16'da kurulur):**
- **GlitchTip hata olayları:** olay adı, hata türü ve mesajı (log redaksiyonundan geçmiş; e-postanın yerel kısmı maskeli), kod kareleri, istek kimliği, metot, yol, durum. Saklama önerisi 30 gün.
- **İzler:** rota, iş akışı adımı, SQL'in biçimi. ORM değerleri SQL metnine gömüyor; izler dışa aktarılırken değişmezler `?` olur, diğer metinler log redaksiyonundan geçer (F15 güvenlik incelemesi, sahte toplayıcıyla doğrulandı). Saklama önerisi 7 gün.
- **Postgres yavaş sorgular:** `pg_stat_statements` (değerler olmadan biçim ve süre). Sorgu metni loglanmaz.

**Kişisel veri tutmayan, kontrol edilmiş tablolar:** katalog, fiyat, SEO, stok, medya, feed, kargo olayları, webhook ve muhasebe tabloları (tam liste L8 taramasında).

**Bellekte tutulanlar:** Sayaçlarda kullanılan ziyaretçi IP özetleri (Ö) veritabanında değil, hız sınırı deposunda durur ve pencere bitince düşer. Bu sayaçlar arama, hız sınırı ve yeniden doğrulama içindir.

---

## Gecelik saklama işi (`compliance-retention`)

| Parça              | Ne yapar                                                                                                                                                            | Süre (`RETENTION_DAYS`) |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `abandoned_carts`  | Siparişe dönüşmeyen sepetin `legal_consent`, `age_declaration`, `checkout_consent` ve `tracking_consent` satırlarını siler. Siparişe dönüşenler kanıt olarak kalır. | `abandonedCart` 30 gün  |
| `cookie_consents`  | Eski çerez yanıtlarını siler.                                                                                                                                       | `cookieConsent` 730 gün |
| `audit_clients`    | Denetim kaydında IP ve tarayıcıyı boşaltır. Kaydın tek değişikliği budur. F16'daki tablo izni bu iki sütunun güncellenmesine izin vermeli.                          | `auditClient` 730 gün   |
| `stock_alerts`     | Gönderilmiş ya da iptal edilmiş bildirimleri ve doğrulanmamış misafir taleplerini siler.                                                                            | `stockAlert` 180 gün    |
| `consent_requests` | Süresi dolmuş çift onay taleplerini siler.                                                                                                                          | `consentRequest` 30 gün |
| `contact_messages` | İletişim formu mesajlarını geldikten bir yıl sonra siler (adr/0047). | `contactMessage` 365 gün |
| `abandoned_cart_contacts` | Siparişe dönüşmeyen sepeti e-posta ve adresleriyle, hatırlatma ve trafik kaynağı kaydıyla birlikte siler. Parası alınmış (`payment_recovery`) ya da ödeme formu açık sepet kalır. | `abandonedCartContact` 90 gün |
| `ga_clients` | Ölçüm onayındaki GA istemci kimliğini boşaltır: iade olayı artık gidemez. | iade süresi + `gaClientMargin` 45 gün |
| `sent_messages` | Gönderilen e-posta ve SMS kayıtlarını (alıcı adresiyle) siler. Panelin zil bildirimleri kişiye ileti değildir, kalır. | `sentMessage` 1095 gün |

Her parça ayrı çalışır; biri hata verse de diğerleri yapılır. Bir gecede 500'den fazla satır birikmişse kalanı sonraki gecelere kalır.

**Diğer saklama işleri:** `conversions-retry` (3 gün), `message-skips-retention` (180 gün), `search-terms-retention` (180 gün), `async-job-retention` (90 gün), `tenant-webhooks` (teslimat kayıtları 30 gün), `fraud-retention` (süresi geçen kara liste kayıtları).

## Açık konular

- **Danışman onayı:** Bu dosyadaki sürelerin tamamı. Sipariş ve fatura için 10 yıl, sözleşme kopyası için 3 yıl, İYS kanıtı için 3 yıl, denetim kaydının kendisi için süre (docs/12).
- **Silme ve anonimleştirme (L9, yapıldı; L11'de genişletildi):** müşteri sayfasındaki KVKK talebiyle (`POST /admin/privacy-requests/:id/erase`, yeniden doğrulamalı, talep başına kilitli). Aynı e-postayla verilmiş misafir siparişlerinin müşteri kayıtları da kapsanır. Müşteri kaydı yer tutucuyla kalır (`anonim-<id>@kvkk.invalid`), adresleri ve bireysel fatura profili kalıcı silinir (kurumsal profil kalır), giriş kaldırılır. Siparişlerin e-postası ve adresleri (il, ilçe, ülke kalır), kargo kaydının teslimat adresi, kargo ve iade etiketi dosyaları, değişiklik geçmişindeki eski değerler, iç notlar, iade talebi notları ve iade kayıtlarının notu temizlenir. Sepetler, gönderilen iletilerin alıcısı (e-posta ve telefon), stok bildirimleri, favoriler, çift onay talepleri ve kişinin veri dökümü dosyaları silinir. Yorum ve sorular "Anonim" adıyla, metinleri kalarak durur. İleti izni kayıtları (İYS kanıtı), engelleme listesi ve ters ibraz notları korunur. Sözleşme kopyası ve onayın IP'si 3 yıl dolana kadar kalır.
- **Silmenin beklediği durumlar:** açık bir sipariş (iptal edilmemiş, teslim edilmemiş ve 90 günden yeni), açık bir iade talebi (istendi, onaylandı, teslim alındı) ya da muhasebeye gönderilmeyi bekleyen bir satış veya iptal varken silme yapılmaz (409, nedeniyle). Bunlar kapanınca talep yeniden işlenir. Silme talebi silme yapılmadan "tamamlandı" diye kapatılamaz; dışa aktarma talebi döküm dosyası olmadan kapatılamaz.
- **GA istemci kimliği (yapıldı, 2026-10-31):** iadede GA4'e olay gittiği için iade süresi boyunca gerekli. Kaydın tarihinden mağazanın iade süresi + 45 gün (kargo yolu ve iadenin ödenmesi için pay) sonra boşaltılır.
- **Medusa `notification` (yapıldı, 2026-10-31):** metin saklanmıyor (şema ve kayıtlar incelendi). Alıcı adresi gönderim kaydında 3 yıl kalır, sonra kayıt silinir.
- **Terk edilmiş sepet (yapıldı, 2026-10-31):** son değişiklikten 90 gün sonra sepet silinir (KVKK silme akışındaki gibi). Parası alınmış ya da ödeme formu açık sepet kalır: paranın izi.
- **Medusa `workflow_execution`:** Medusa bazı iş akışlarının girdisini (müşteri oluşturma gibi) bu tabloda saklayabiliyor. Saklama süresi (`retentionTime`) ayarı F16'da konmalı; silme akışı bu tabloya dokunmuyor.
