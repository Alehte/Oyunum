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

## 2026-11-20 oturumu (docs/gorev-karanliktaSuzul2.md)
Yapıldı (sw.js SURUM 16 → 17, görünen sürüm 1.2.0):
- AŞAMA 1 (29b7f0b, 7573e1e): market önizlemesindeki beyaz karenin gerçek sebebi Android Chrome otomatik karanlık modu. Mod SVG zemin dolgusunu ters çeviriyordu. Zemin artık CSS'te (#05080D, 6px köşe). Böcek gövdesi ve dal canvas'ta çiziliyor. Test: tools/marketKartYakala.js gerçek market envanterini normal ve otomatik karanlık modda çiziyor; 10 kartın köşe, kenar ve iç pikselleri denetleniyor.
- AŞAMA 2 (2ef6ea1): Kaçış yılanında Lav ve Mürekkep'in en koyu gövde renkleri açıldı. Lav #FF8A3C 3:1 göz oranını geçmediği için #C47A10 yapıldı (sapma). Test: tools/yilanGozTest.js (beyaz göz/gövde ≥ 3, gövde/kontur ≥ 1,6, Lav gövde renkleri arası ΔE ≥ 10). Diğer temalarda 3:1 altı (yalnız raporlandı): toprak, buz, kumsal, sedef, çini (hedef), vitray; kiraz gövde/kontur 1,29.
- AŞAMA 3 (b486540): tavan sersemlemesi ve ölümcül zemin. SERSEM_SURE 0,9 sn; uyanma Y 73, yani oyun alanının %25'i kadar zeminin yukarısı; ZEMIN_KORUMA 0,5 sn. Tasarım §12.1.
- AŞAMA 4 (35b90a3): 800 puandan sonra risk tozu, dikenli dalın ucundan 4 birim içeride; mıknatıs çekmez, ekstra puan yok. 2400 puandan sonra tam toplayıcı bot 7 dilimde ort. 2,34 hasar alıyor, seçici bot 0. Tasarım §12.2.
- AŞAMA 5 (2ecc1ad, 56c260c, ffcfa0f, 462c73b): 9 temada ışık halkası, halo, böcek gövdesi, bölge paletleri, engel ve tehlike tonları temadan geliyor. Silüetler değişmedi. ΔE (CIEDE2000, gerçek canvas çizimi, 4 bölge) taban: en düşük çift 1,42; son: en düşük çift 7,61 (buz/çini); sınır 6. En düşük kontrast 3,74. Tasarım §12.3.
- AŞAMA 6 (dedaf71): gümüş ve altın sandık sahip olunan temayı vermez; boş grup oranı kalan gruplara dağıtılır; tema kalmayınca sandık pasif olur ve jeton harcanmaz. Gümüş .59375/.35625/.05/0, altın .10/.35/.30/.25; fiyatlar aynı. Test: tools/sandikTest.js.
- Denetim: 1 tur (opus); kritik bulgu yok. Otomatik karanlıkta önizleme içi, iade artıkları ve test adları düzeltildi (7573e1e).
Cihazda bakılacak:
- Sersem inişi: 0,9 sn'de 69 birim iniliyor (ort. 77, tepe 115 b/sn; normal düşüş 30). "Yavaşça süzülme" hissi tutmayabilir. Ayar AYAR.hareket'te.
- Tavan sersemlemesi başına ~0,7 engel çarpması ölçüldü (uyanmada sıradaki boşluk kaçabiliyor).
- Zemin ölümü animasyonu; bitiş başlığı yine "Işık Söndü".
- Risk tozunun dal içinde okunurluğu.
- Tema hissi: buz/çini ayrımı; Lav/Toprak'ta bomba halesi; Sedef/Kiraz pastel bölge tonları; halo halkası yoğunluğu.
- Market önizlemesi otomatik karanlıkta (Android "web içeriğini karart").
- Sandık pasif düğme metni (320 px'te iki satır).

## 2026-11-22 oturumu (docs/gorev-karanliktaSuzul3.md) — YARIM, kullanıcı isteğiyle durduruldu
Commit edilen kod yok. Aşama 1 değişiklikleri çalışma ağacında, commit edilmedi (testler yeşil değil). Aşama 2 başlamadı.

Bitti:
- Sorun 1 nedeni: `.mo-sahne.mo-ates` opak `background:#05080D`. Diğer miniler yarı saydam (Tempo `.mo-bloklar` `rgba(8,12,22,.55)`), kart zemini `#0C1322` + tema ton katmanı görünüyor.
- Mini sağ kenarındaki ince dikey çizgi: `atesGovdeCiz` içindeki dikenli dal (x 52-56, y 10-48), kenara yapışık neredeyse tam boy. Silinmedi (tema engel rengini gösteriyor), yeniden çizildi.
- Sorun 2 nedeni: `atesBocegiOyun.js` `boyutla()` içinde `olcek = Math.min(cssW / W, cssH / H)` ve `ox` ile letterbox. Canvas zaten tam genişlik; dünya 50x100 birim, çizim `rect(0,0,W,H)` ile kırpılıyor.

Çalışma ağacında yarım (Aşama 1, commit edilmedi):
- style.css: `.mo-sahne.mo-ates` -> `flex:0 1 68px`, `background:rgba(8,12,22,.55)`, `border-radius:10px` (Tempo ile aynı).
- js/marketEkran.js: dal üstten sarkan kısa parça (x 48-52, y -2..25,5, sivri uç, 2 diken), kenardan 6 birim içeride.
- sw.js SURUM 17 -> 18; tools/swTest.js 18'e göre güncel.
- tools/marketKartYakala.js: genişlik, HEAD karşılaştırması, `.mo-ates` gizleme argümanları; kart/diğer mini konumları ve hesaplanmış stiller.
- tools/atesBocegiTemaTest.js: regex testleri güncel; yeni testler: mini/kart dE76 aralığı, ışık/toz/dal WCAG ≥ 3, diğer miniler HEAD ile aynı, 360 px taşma yok.

Test durumu (2026-11-22, çalışma ağacıyla):
- Yeşil: atesBocegiAdaletTest (26), atesBocegiOyunTest (67), atesBocegiTest (142), dokumAnimTest, hediyeTest, kacisCozTest, kacisGirisTest, kayitGocTest, odulTest, sandikTest, suSiralaCozTest, swTest (22/22), yilanGozTest.
- Kırmızı: atesBocegiTemaTest, 48 geçti / 5 kaldı:
  1. "onizleme sahnesi gercek tarayicida koyu (ort <= 0.05, kose <= 0.02)": eski opak zemin için yazılmış eşik; yarı saydam zeminde köşe 0,034-0,054. Testin amacı (beyaz değil) yeni zemine göre yeniden tanımlanmalı.
  2-3. "mini zemini kart zemininden dE76 ... Tempo miniden en fazla 1.5 sapar" (normal + otomatik karanlık): Kumsal, Mürekkep, Kiraz, Lav'da ateş ile Tempo farkı 2,3-3,9. Kontrastlar geçiyor (ışık ≥ 9, toz ≥ 13, dal ≥ 10). Tempo sapma ölçütü ya da ölçüm noktası düzeltilmeli.
  4-5. "diger oyun minileri HEAD ile ayni" (normal + otomatik karanlık): `.mo-ates` gizliyken bile 2048 minisinde ort. fark 3,4-5,2, diğerlerinde 0,1-0,5. Ölçüm yöntemi sorunlu olabilir (HEAD dosyası yükleme yolu veya düzen); kod değişikliği 2048'e dokunmuyor. İncelenmeli.

Sıradaki adım:
1. atesBocegiTemaTest'teki 5 kırmızı testi düzelt (önce 4-5'in nedenini bul), market ekran görüntülerine Read ile gözle bak (Buz, Varsayılan, Lav, Sedef), tüm paketleri çalıştır, Aşama 1'i commit et.
2. Aşama 2 önerisi (kullanıcı onayı bekleniyor): çekirdek ve adalet kodu değişmez; yalnız atesBocegiOyun.js çizimi. Dünya yüksekliği 100 sabit, görünen genişlik ekran oranına göre 50'den en çok 100 birime çıkar, böcek solda kalır (ileri görüş artar). Sınır 20:9 değil 100, çünkü üretim ufku böceğin 100 birim ilerisi (`ONDE*W`, toplam ekran x 108). Daha geniş ekranda fazlalık yalnız arka plan + karanlık olarak çizilir. Etkilenen yerler: boyutla, bolgeKur, kc boyutu, arkaPlanCiz döşeme, clip rect'ler, `W` ile yapılan ekran dışı kontrolleri, sarmaşık uyarısının sağ kenara kıstırılması (`W - 3.2`).
3. Bitiş: denetci (opus) 1 tur, rapor.
