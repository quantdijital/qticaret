# 00 — Vizyon ve Kapsam

## Ürün
Türkiye pazarına odaklı, sektörden bağımsız, çok müşterili e-ticaret altyapısı.
Müşterilerimiz (tenant'lar) kendi mağazalarını bu altyapı üzerinde işletir.

## İlkeler
- **Sektörden bağımsız çekirdek.** İlk müşteri bıçak sektörü; ama "bıçak" kelimesi kodda geçmez.
  Sektörel ihtiyaç = feature flag + ürün attribute şablonu + opsiyonel modül.
- **Türkiye-yerel varsayılanlar.** TRY, KDV, il/ilçe/mahalle, taksit, 3DS, e-arşiv, KVKK, İYS, mesafeli satış.
- **Tenant kendi hesaplarının sahibi.** Ödeme, kargo, e-fatura hesapları ve API anahtarları tenant'a aittir.
  Platform asla tenant adına para toplamaz (lisanssız ödeme hizmeti riski).
- **Değiştirilebilir sağlayıcılar.** Her dış servis bir provider arayüzünün arkasında; yedek sağlayıcı her zaman mümkün.
- **Veri sahipliği.** Transaction ID, takip no, fatura UUID gibi tüm referanslar bizim DB'mizde saklanır.

## Bu aşamanın kapsamı (Backend + Admin)
Dahil: Medusa çekirdek, TR lokalizasyon, ödeme (iyzico, PayTR), kargo (Geliver), e-fatura, bildirimler,
admin genişletmeleri, uyum özellikleri, test, güvenlik, dağıtım, tenant provisioning.

Hariç (sonraki aşama): storefront, çoklu tema sistemi, pazaryeri entegrasyonları (Trendyol vb.), B2B.
Ancak backend kararları **çoklu temayı** destekleyecek şekilde alınır (Store API temiz, tema bağımsız; bkz. F13).

## Başarı ölçütleri (bu aşama sonu)
- Admin'den ürün girip, Store API üzerinden (Postman/HTTP test) sipariş oluşturup iyzico sandbox ile ödeme alınabiliyor.
- Sipariş → Geliver test gönderisi → takip güncellemesi → müşteri bildirimi → e-arşiv test faturası uçtan uca çalışıyor.
- Yeni tenant bir komutla (script) ayağa kaldırılabiliyor.
- Ödeme/kargo/fatura modüllerinde entegrasyon test kapsamı ≥ %80.
