Yapıldı: ad, kart/etiket, market beyaz zemin, ışık sönme, Dokun ve başla animasyonu, Su Sırala öğretici.
Yapılmadı (sonraki oturum): hareket yumuşatma, toplama yarıçapı/mıknatıs, bomba, dikenli dal hasarı (yarım bar), tozsuz bölümler, sarmaşık tuzağı, böcek modeli ve genel görsel iyileştirme (%25 büyütme dahil), denetim.

## 2026-11-19 oturumu (docs/gorev-karanliktaSuzul.md)
Yapıldı:
- AŞAMA 0: market önizleme koyulaştırıldı + headless Chrome piksel testi (c0db16a).
- AŞAMA A: hareket rampası, mıknatıs + R_TOPLA 4,2, R_GORSEL 3,0, bomba, dal hasarı 0,5, tozsuz bölümler, sarmaşık + uyarı/silüet, çakışma kuralı, testler (2aecb4b). Kararlar tasarım §11.
- AŞAMA B4: böcek modeli, engeller, bölge katmanları, toz, bomba, sarmaşık görselleri; sw.js SURUM 16 (f18977a).
- AŞAMA D: iki tur bağımsız denetim; tur 1 (silüet konturu, dal sprite önbelleği, yutulan toz sönmesi, market böceği) ve tur 2 (bomba patlaması dikey hızı, hareketi azaltta kanat/hale, yaprak/filiz konturu, dal desen varyantı) düzeltildi. Tüm testler yeşil.
- Kapsam dışı bırakılan: tritanopi testi (tasarım protanopi + deuteranopi şart koşuyor).
- Ekonomi: kullanıcı onayıyla sabitlere dokunulmadı (mıknatıs puanı artırıyor).
Cihazda bakılacak: süzülme hissi; bomba okunaklılığı; sarmaşık silüeti; market önizlemesi (Sedef, Buz); düşük cihazda fps.
