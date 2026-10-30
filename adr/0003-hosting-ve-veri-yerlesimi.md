# ADR-0003: Hosting, bölge ve veri yerleşimi

- **Durum:** Kısmen kabul edildi (2026-10-30): soru 1 kararlaştı; 2–5 F16 başında kararlaştırılır.
- **Tarih:** 2026-10-21

## Bağlam
Instance-per-tenant modelinde (adr/0001) her tenant ayrı server + worker + PostgreSQL demektir.
Bu yüzden hosting seçimi doğrudan şunları belirler:
- **Maliyet:** tenant başına sabit kaynak; boşta duran küçük mağazalar maliyeti büyütür.
- **KVKK:** müşteri verisi (ad, adres, telefon, TCKN) yurt dışındaki sunucuda tutulursa bu bir yurt dışı aktarımdır.
  KVKK m.9 (2024 değişikliği) kapsamında yeterlilik kararı, standart sözleşme gibi güvenceler gerekir.
  Kesin yükümlülükler KVKK danışmanıyla doğrulanır (`docs/12-kod-disi-gereksinimler.md`).
- **Operasyon yükü:** onlarca instance'ın dağıtımı, yedeği, izlemesi ve sürüm yayması.
- **Gecikme:** müşterilerin büyük kısmı Türkiye'de.

Ayrıca dış servislerin (e-posta, Sentry, CDN) veri işleme yeri de aynı değerlendirmeye girer.

## Karar
**Kullanıcı kararı (2026-10-30):** kişisel veri barındıran bileşenler (Postgres, dosya deposu, yedekler) **Türkiye'de** tutulur. Böylece KVKK m.9 kapsamındaki yurt dışı aktarım yükü veritabanı ve dosyalar için doğmaz. Dış servislerin (e-posta, hata izleme, CDN) yurt dışında işlediği veri ayrı değerlendirilir ve aydınlatma metninde yazılır.

Kalan sorular F16 başında yanıtlanır:
1. Kişisel veri barındıran bileşenler (Postgres, S3, yedekler) Türkiye'de mi tutulacak?
2. Orkestrasyon: yönetilen Kubernetes mi, daha basit bir PaaS/self-hosted araç mı?
3. Postgres: tenant başına ayrı sunucu mu, paylaşımlı küme üzerinde ayrı veritabanları mı?
4. CDN/WAF sağlayıcısı ve verinin kenar sunucularda işlenme biçimi
5. Yedeklerin ikinci lokasyonu

## Alternatifler
| Seçenek | Artı | Eksi |
|---|---|---|
| Türkiye'deki bulut/veri merkezi (yerel sağlayıcı) | KVKK yurt dışı aktarım yükü yok, düşük gecikme | Yönetilen servis çeşitliliği az, otomasyon araçları sınırlı olabilir |
| Global bulut, Türkiye bölgesi (varsa) | Olgun yönetilen servisler + yerel veri | Bölgedeki servis kapsamı ve fiyat doğrulanmalı |
| Global bulut, AB bölgesi | En olgun ekosistem, düşük maliyet seçenekleri | Yurt dışı aktarım: sözleşmesel güvence + aydınlatma gerekir |
| Hibrit: veri Türkiye'de, durumsuz servisler/CDN global | Uyum + performans dengesi | Mimari karmaşıklık artar |

| Orkestrasyon | Artı | Eksi |
|---|---|---|
| Yönetilen Kubernetes | Ölçek, standart araçlar, rolling deploy | Öğrenme ve işletme yükü yüksek |
| Basit PaaS / self-hosted (Coolify, Dokku vb.) | Hızlı başlangıç, düşük karmaşıklık | Yüzlerce tenant'ta yönetim zorlaşır |

## Sonuçlar
- F16 (dağıtım), F15.7 (WAF/DDoS), F16.8 (yedek) bu karara göre tasarlanır.
- Aydınlatma metinleri ve veri işleyen sözleşmesi (F13, kod dışı) seçilen lokasyonu yansıtmalıdır.
- Tenant sayısı arttığında paylaşımlı kaynak optimizasyonu ayrı ADR ile değerlendirilir (adr/0001).
