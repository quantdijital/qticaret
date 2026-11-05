# 12 — Kod Dışı Gereksinimler

> Yazılımın canlıya çıkıp satılabilmesi için gereken hukuki, ticari ve operasyonel işler.
> Kod yazılmaz ama ilgili fazların kabulünü bloklayabilir. Son sütun hangi fazı etkilediğini gösterir.
> Bu dokümandaki yasal başlıklar tasarım rehberidir; kesin yükümlülük ilgili uzmanla doğrulanır.

## Hukuk ve uyum
| Kalem | Sorumlu / danışılacak | Etkilediği faz |
|---|---|---|
| SaaS hizmet sözleşmesi + SLA (platform ↔ tenant) | Avukat | F17 |
| KVKK veri işleyen sözleşmesi (platform = veri işleyen, tenant = veri sorumlusu) | KVKK danışmanı | F16, F17 |
| Platformun kendi KVKK aydınlatma metni, VERBİS değerlendirmesi | KVKK danışmanı | F17 |
| Yurt dışı veri aktarımı değerlendirmesi (hosting, e-posta, Sentry, CDN) | KVKK danışmanı | ADR-0003 |
| Tenant'lar için yasal metin şablonları (mesafeli satış, ön bilgilendirme, KVKK, çerez, iade) | Avukat | F13.7 |
| Yasal metin taslaklarının avukat kontrolü (2026-11-03'te yürürlükteki mevzuata göre ayrıntılı taslak; yedi metin): dayanılan maddeler, her yıl güncellenen hakem heyeti sınırı, avukata sorulacaklar ve metinle çelişen platform davranışları `docs/yasal-metinler.md`'de. Not kutusu silinmeden metin yayımlanmaz | Avukat + KVKK danışmanı | F13.7 |
| MSY 2026 uyumu (RG 24.5.2025/32909, 1.1.2026'dan beri; adr/0032 Ek ve adr/0052 Ek, 2026-11-03). **Yapılanlar:** cayma iadesi gidiş kargo ücretini ilk iadeyle bir kez geri verir, kısmi iadede de (md. 12/1); "İade kargosunu müşteri öder" seçeneği kaldırıldı, kayıtlı değer mağazaya taşındı (md. 12/5, 13/3 mülga); iade kargosunun teslim tarihi takipten kaydediliyor, 10. günde para iade edilmemişse personel uyarılıyor (md. 12/1); fiziksel üründeki "cayma dışı" işareti hijyen uyarısı oldu, ambalajı açılmış ürün teslim almada reddediliyor (md. 15/1-ç); kişiye özel ürün atfı 15/1-b. **Açık (avukata):** kısmi iadede kargo ücretinin iadesi (varsayılan: iade edilir; avukat aksini derse mağaza ayarı olur); kapıda ödeme ücretinin "tahsil edilen tüm ödemeler"e girmesi; reddedilen ürünün geri gönderim ücreti; değer kaybı kesintisi (md. 13/2); iade taşıyıcısının adının ön bilgilendirmede yazılması (md. 5/1-g). `docs/yasal-metinler.md` "Metinlerle çelişen platform davranışları" listesinde backend tarafı kapananlar: 1, 2, 3 (işaret talebi engellemiyor; ürün sayfasında gösterim vitrin işi), 4, 5 ve 8 (yasal metin uçlarında 1 MB gövde) | Avukat | F13, adr/0032 |
| İndirimli fiyat gösterimi kuralı teyidi: mal satışında indirimden önceki 10 günün en düşük fiyatı (Fiyat Etiketi Yön. md. 11/1, RG 11.10.2025/33044; Ticari Reklam Yön. md. 14/3, RG 1.7.2026/33297); kademeli derinleşen indirimde "indirimden önceki fiyat"ın ilk adımdan önceye mi son adımdan önceye mi bakacağı; herkese uygulanan otomatik kampanyanın fiyat olarak gösterilmesi ve koşullu kampanyada (md. 14/7) "Sepette %N indirim" ifadesi (ADR-0023, Ek 2026-11-05) | Avukat | F4.3 |
| Sektöre özel satış kısıtları (ilk müşteri: bıçak — 6136 sayılı kanun kapsamı, yaş sınırı) | Avukat | F13.3, F13.4 |
| Ticari ileti / İYS süreçleri | Avukat | F9.5, F10.7 |
| Ödeme modeli teyidi: platform tenant adına para toplamaz (lisans gerektirmez) | Avukat | F5, F6, F17.3 |
| Veri ihlali bildirimi: 72 saat Kurul bildirimi, ilgili kişi bildirimi, platform/tenant sorumluluk paylaşımı (veri işleyen sözleşmesinde) | KVKK danışmanı | F13.10 |
| LLM/AI sağlayıcısıyla veri işleme sözleşmesi ve yerleşim (yalnızca ürün verisi gönderilse de) | KVKK danışmanı | F10.13, ADR-0005 |
| Ters ibraz (chargeback) süreçleri ve belge gereksinimleri | Ödeme sağlayıcı + avukat | F6.7 |
| Adres referans verisi (il/ilçe/mahalle/posta kodu) kaynağı ve kullanım lisansı: PTT/TÜİK verisinin ticari kullanımı ve tenant'lara dağıtımı. 2026-11-04'ten beri kaynak TürkiyeAPI (MIT; şartlar adres formlarında kullanımı sayıyor, docs/entegrasyonlar/turkiye-api.md); TÜİK/PTT kaynaklı verinin ticari kullanımı yine avukata | Avukat | F1.3, F16 (ADR-0008) |
| Denetim kaydı ve erişim bilgisi (IP, user agent, okuma kayıtları) saklama süresi; öneri 2 yıl | KVKK danışmanı | F2.5, F13 (ADR-0011) |
| Tüm kişisel veri saklama sürelerinin onayı (sipariş 10 yıl, sözleşme kopyası 3 yıl, İYS kanıtı 3 yıl, terk edilmiş sepet 30 gün, çerez yanıtı 2 yıl...); liste `docs/kvkk-envanter.md` | KVKK danışmanı + mali müşavir | F13.5 |

## Mali ve vergi
| Kalem | Sorumlu / danışılacak | Etkilediği faz |
|---|---|---|
| E-fatura/e-arşiv kuralları: bireysel alıcıda TCKN yoksa uygulama, iade faturası | Mali müşavir | F8 |
| Paraşüt platform API istemcisi (`destek@parasut.com`; e-posta taslağı 2026-10-31'de kullanıcıya verildi): istemci kimliği ve sırrı; yetki kodu akışının (kodu panele yapıştırma, `urn:ietf:wg:oauth:2.0:oob`) platform istemcisine açılması; GİB'e belge göndermeden deneme yapılabilecek test (staging) ortamı ve test firması; istek sınırları; tekrar önleyici anahtar; e-belge serisinin API'den seçilip seçilemeyeceği (web satışları ayrı seriyle) | Quant Dijital | F8 (ADR-0034) |
| Mali müşavir soru listesinin cevapları (`docs/mali-musavir-sorulari.md`) | Mali müşavir | F8 |
| KDV oran grupları (%20/%10/%1) ve kargo bedelinin KDV oranı; tenant ürün gruplarının hangi orana düştüğü | Mali müşavir | F1.2 (ADR-0007) |
| Kuruş yuvarlama kuralı (yarım yukarı) ve sepet indiriminin kalemlere dağıtımının faturadaki karşılığı | Mali müşavir | F2.7, F4.7, F8 (ADR-0010) |
| İndirim ve kargo bedelinin faturada gösterimi | Mali müşavir | F4.7, F8 |
| Hediye kartı ve mağaza kredisinin vergisi: satışta mı kullanımda mı KDV, e-fatura/e-arşiv karşılığı, kullanılmayan bakiyenin muhasebesi | Mali müşavir | F4.8, F8 (ADR-0025) |
| Kapıda ödeme tahsilat mutabakatı ve muhasebeleştirme | Mali müşavir | F6.6, F11.3 |
| Platformun kendi abonelik faturası ve e-fatura mükellefiyeti | Mali müşavir | F17.3 |
| Muhasebe programı aktarım formatları (Paraşüt/Logo/Mikro) | Mali müşavir + tenant | F11.5 |

## Sağlayıcı anlaşmaları
| Kalem | Muhatap | Etkilediği faz |
|---|---|---|
| iyzico / PayTR: tenant hesap açılış süreci, platform referans/iş ortaklığı modeli | Sağlayıcı satış ekibi | F5, F6 |
| PayTR test hesabı: bildirim adresi hesap başına tek ve test modu canlı anahtarlarla çalışıyor; canlı satış yapan hesapla test edilemez. Ayrı test mağazası ya da canlıya geçmemiş hesap; dev için herkese açık bildirim adresi (tünel) | Kullanıcı + PayTR | F5 (adr/0026) |
| PayTR: yalnızca iFrame kullanan hesabın taksit oranları API'sine erişimi | PayTR | F5.8 |
| iyzico webhook V3 imzasının açtırılması (entegrasyon@iyzico.com); sandbox hesabı | Kullanıcı + iyzico | F5.11 |
| Geliver: tenant hesabı, kapıda ödeme desteği, iade kodu süreçleri | Geliver | F6.6, F7 |
| E-fatura entegratörü seçimi ve fiyatlandırma | Entegratörler | F8 |
| SMS sağlayıcısı (başlık onayı, İYS entegrasyonu) | SMS sağlayıcısı | F9 |
| E-posta gönderim servisi: tenant başına ayrı Resend hesabı/takımı (adr/0036 ek), alan adı doğrulama, hacim | Resend | F9.6, F16 |
| Hosting, CDN/WAF sağlayıcıları | Sağlayıcılar | ADR-0003, F15.7, F16 |
| Doğrudan kargo firması API erişimi (ilk müşterinin anlaşmalı firması) | Kargo firması | F7.14 |
| Google Search Console, Merchant Center, CrUX API erişimi (tenant mülkü, OAuth uygulaması; platform için Google Cloud projesi) | Google | F10.11, F10.8 |
| Google Business Profile API erişimi: platform projesi için "Basic API Access" başvurusu (proje numarası; doğrulanmış, 60+ gündür etkin, web siteli bir profilin sahibi/yöneticisi e-postasıyla), onay = kota 300 QPM (0 QPM onaysız); üç API'nin açılması; onay ekranında `business.manage` hassas kapsamının doğrulanması. Adımlar `docs/entegrasyonlar/google-business-profile.md` | Platform + Google | adr/0058 |
| Sosyal giriş: mağaza başına Google OAuth istemcisi (onay ekranında mağaza adı) ve Apple Developer hesabı + Services ID (adr/0037) | Google, Apple | F10.2, F16 |
| İYS marka kodu ve Netgsm İYS API erişimi (izinlerin iletimi, adr/0038) | İYS, Netgsm | F10 |
| Akakçe ve Cimri satıcı hesapları; feed adresinin satıcı paneline girilmesi (biçimler önceki siteden alındı, adr/0038 M12 eki) | Karşılaştırma siteleri | F10.8 |
| Meta (piksel + Conversions API anahtarı) ve GA4 (ölçüm kimliği + API sırrı) hesapları | Meta, Google | F10.9 |
| IndexNow anahtarı (tenant başına) | — | F3.15 |
| LLM sağlayıcı seçimi ve fiyatlandırma (opsiyonel özellik) | Sağlayıcı | F10.13 |

## Operasyon ve destek
| Kalem | Not | Etkilediği faz |
|---|---|---|
| Tenant yardım merkezi ve kurulum rehberi | Ekran görüntülü, sektörsüz | F17 |
| Destek kanalı ve SLA'lı yanıt süreleri | E-posta/WhatsApp/ticket | F16.10 |
| Olay yönetimi: nöbet listesi, olay sonrası rapor şablonu | | F16.9 |
| Geçiş (migration) hizmeti fiyatlandırması ve süreci | | F14 |
| Paketler ve fiyatlandırma (plan/limit tasarımı) | | F17.2 |
| ETBİS kaydı rehberi (tenant yükümlülüğü) | Tenant'a hatırlatma | F13.9 |
| Olay müdahale (güvenlik ihlali) masa başı tatbikatı, yılda 1 | | F13.10, F15 |
| Rakip analizi güncellemesi (6 ayda bir) | | docs/15 |
| Tenant SEO başlangıç rehberi: GSC/Merchant bağlama, künye, politikalar, ilk 10 ürün için advisor turu | Ekran görüntülü | F12.10, F17 |

## Takip
Tamamlanan kalemler bu tabloda işaretlenmez; `PROGRESS.md` → "Açık sorular / bloklayıcılar" altında izlenir.
