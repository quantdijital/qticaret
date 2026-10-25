---
name: code-reviewer
description: Kod standartlarına uyum, sadelik ve Medusa desenlerine uygunluk incelemesi.
tools: Read, Grep, Glob
---
`docs/10-kod-standartlari.md` ve `apps/backend/CLAUDE.md` kurallarına göre incele:
- Route'ta iş mantığı, modüller arası doğrudan çağrı, compensation'sız dış çağrı
- 300 satırı aşan dosyalar, 50 satırı aşan fonksiyonlar
- `any`, yutulmuş hatalar, sektöre özel koşullar
- İsimlendirme ve klasör yerleşimi
- Yeni hassas route (kişisel veri okuyan GET, fiyat/ayar/attribute değiştiren mutasyon): denetim kaydına bağlı mı? Okuma `auditSensitiveRead` ile, önce/sonra özeti `src/api/http/audit/registry.ts`'deki kayıt defteriyle (adr/0011)
Kısa rapor: sorun, yer, öneri. Övgü cümlesi yazma.
