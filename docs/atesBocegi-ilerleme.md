Yapıldı: ad, kart/etiket, market beyaz zemin, ışık sönme, Dokun ve başla animasyonu, Su Sırala öğretici.
Yapılmadı (sonraki oturum): hareket yumuşatma, toplama yarıçapı/mıknatıs, bomba, dikenli dal hasarı (yarım bar), tozsuz bölümler, sarmaşık tuzağı, böcek modeli ve genel görsel iyileştirme (%25 büyütme dahil), denetim.

## 2026-11-19 oturumu (docs/gorev-karanliktaSuzul.md) — kota nedeniyle durdu
Yapıldı:
- AŞAMA 0: market önizleme koyulaştırıldı + headless Chrome piksel testi (commit c0db16a).
- AŞAMA A (çekirdek + arayüz): hareket rampası, mıknatıs + R_TOPLA 4,2, R_GORSEL 3,0, bomba, dal hasarı 0,5, tozsuz bölümler, sarmaşık + uyarı/silüet, çakışma kuralı, testler. Kararlar tasarım §11'de. 12 test paketinin hepsi yeşil (adalet 17/17).
- Ekonomi: kullanıcı onayı — sabitlere dokunulmadı (mıknatıs puanı artırıyor, kabul).
Yapılmadı (sonraki oturum):
- AŞAMA A ikinci bütün denetimi (çekirdek+UI) yarıda kesildi; yeniden çalıştırılmalı.
- sw.js SURUM 15 → 16 ve tools/swTest.js'teki sabit '15' güncellemesi.
- AŞAMA B4 görsel iyileştirme (böcek modeli, engeller, arka planlar, toz, bomba daha okunaklı — şu an ~9 px, sarmaşık).
- AŞAMA D: iki tur bağımsız denetim, tüm testler, commit, rapor.
