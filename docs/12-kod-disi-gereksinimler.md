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
| İndirimli fiyat gösterimi kuralı (son 30 gün en düşük fiyat) teyidi | Avukat | F4.3 |
| Sektöre özel satış kısıtları (ilk müşteri: bıçak — 6136 sayılı kanun kapsamı, yaş sınırı) | Avukat | F13.3, F13.4 |
| Ticari ileti / İYS süreçleri | Avukat | F9.5, F10.7 |
| Ödeme modeli teyidi: platform tenant adına para toplamaz (lisans gerektirmez) | Avukat | F5, F6, F17.3 |
| Veri ihlali bildirimi: 72 saat Kurul bildirimi, ilgili kişi bildirimi, platform/tenant sorumluluk paylaşımı (veri işleyen sözleşmesinde) | KVKK danışmanı | F13.10 |
| LLM/AI sağlayıcısıyla veri işleme sözleşmesi ve yerleşim (yalnızca ürün verisi gönderilse de) | KVKK danışmanı | F10.13, ADR-0005 |
| Ters ibraz (chargeback) süreçleri ve belge gereksinimleri | Ödeme sağlayıcı + avukat | F6.7 |
| Adres referans verisi (il/ilçe/mahalle/posta kodu) kaynağı ve kullanım lisansı: PTT/TÜİK verisinin ticari kullanımı ve tenant'lara dağıtımı | Avukat | F1.3, F16 (ADR-0008) |
| Denetim kaydı ve erişim bilgisi (IP, user agent, okuma kayıtları) saklama süresi; öneri 2 yıl | KVKK danışmanı | F2.5, F13 (ADR-0011) |

## Mali ve vergi
| Kalem | Sorumlu / danışılacak | Etkilediği faz |
|---|---|---|
| E-fatura/e-arşiv kuralları: bireysel alıcıda TCKN yoksa uygulama, iade faturası | Mali müşavir | F8 |
| KDV oran grupları (%20/%10/%1) ve kargo bedelinin KDV oranı; tenant ürün gruplarının hangi orana düştüğü | Mali müşavir | F1.2 (ADR-0007) |
| Kuruş yuvarlama kuralı (yarım yukarı) ve sepet indiriminin kalemlere dağıtımının faturadaki karşılığı | Mali müşavir | F2.7, F4.7, F8 (ADR-0010) |
| İndirim ve kargo bedelinin faturada gösterimi | Mali müşavir | F4.7, F8 |
| Kapıda ödeme tahsilat mutabakatı ve muhasebeleştirme | Mali müşavir | F6.6, F11.3 |
| Platformun kendi abonelik faturası ve e-fatura mükellefiyeti | Mali müşavir | F17.3 |
| Muhasebe programı aktarım formatları (Paraşüt/Logo/Mikro) | Mali müşavir + tenant | F11.5 |

## Sağlayıcı anlaşmaları
| Kalem | Muhatap | Etkilediği faz |
|---|---|---|
| iyzico / PayTR: tenant hesap açılış süreci, platform referans/iş ortaklığı modeli | Sağlayıcı satış ekibi | F5, F6 |
| Geliver: tenant hesabı, kapıda ödeme desteği, iade kodu süreçleri | Geliver | F6.6, F7 |
| E-fatura entegratörü seçimi ve fiyatlandırma | Entegratörler | F8 |
| SMS sağlayıcısı (başlık onayı, İYS entegrasyonu) | SMS sağlayıcısı | F9 |
| E-posta gönderim servisi (alan adı doğrulama, hacim) | Resend/SES vb. | F9.6 |
| Hosting, CDN/WAF sağlayıcıları | Sağlayıcılar | ADR-0003, F15.7, F16 |
| Doğrudan kargo firması API erişimi (ilk müşterinin anlaşmalı firması) | Kargo firması | F7.14 |
| Google Search Console, Merchant Center, CrUX API erişimi (tenant mülkü, OAuth uygulaması; platform için Google Cloud projesi) | Google | F10.11, F10.8 |
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
