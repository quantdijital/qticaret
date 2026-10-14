---
description: Değişen kodu güvenlik kontrol listesine göre incele
---
1. `git diff --name-only main...HEAD` ile değişen dosyaları al.
2. `security-reviewer` ajanına bu dosyaları ve `docs/04-guvenlik.md`'yi ver.
3. Bulguları önem derecesiyle (kritik/yüksek/orta/düşük) dosya:satır referansıyla raporla.
4. Kritik ve yüksek bulgular için düzeltme öner; onaysız kod değiştirme.
