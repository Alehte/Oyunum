# Performans kuralları ve bütçeler

Oyun yüksek grafikli değil; düşük seviye telefonda akıcılığı bozan şey neredeyse her zaman gereksiz çizim, stil ve
yerleşim (layout) maliyetidir. Bu dosya yeni kodun uyması gereken kalıcı kuralları, ölçülmüş bütçeleri ve ölçüm
araçlarını anlatır. Kurallar `tools/perfTest.js` ile denetlenir; her sürümde diğer testlerle birlikte çalıştırılır.

Kural dışı kalan eski kod `tools/perfTest.js` içinde adıyla ve gerekçesiyle "bilinen istisna" olarak listelidir.
Liste büyütülmez; yeni kod istisna eklemez.

## 1. Kurallar

1. **Animasyon yalnız `transform` ve `opacity` ile.** `@keyframes` içinde `top/left/right/bottom/width/height/margin/
   padding/inset/font-size` yok. Yerleşim özelliğine `transition` yok (bilinen istisnalar: ayarlar paneli `.sheet`,
   Sırala Dur dökme şeridi `.ss-akis`). Sonsuz (`infinite`) animasyon yalnız transform/opacity; parlama artışı gibi
   `box-shadow`/`filter` değişimi gerekiyorsa sabit gölgeli bir sözde öğenin `opacity`'si canlandırılır
   (örnek: `.bd-tile.center::before`, `bdBreatheHale`).
2. **Okuma ve yazma karışmaz (layout thrash yok).** Döngüde `offsetLeft/Width`, `getBoundingClientRect`,
   `clientWidth` okuyup hemen DOM'a yazma yok: geometri işin başında tek geçişte okunur (örnek: `tempoKup.js hucreGeo`).
   Animasyonu baştan başlatmak için `void el.offsetWidth` yerine Web Animations (`el.animate(...)`) ya da sınıfı iki kare
   sonra yeniden ekleme (`tempoKup.js sars`).
3. **`will-change` yalnız gerçekten canlanan, kısa ömürlü öğede.** Kalıcı ve çok sayıdaki öğede (`.tp-cell`,
   `.kc-snake`, `.mk-kart`, `.app-screen`, `.bd-tile`) yok. Tarayıcı transform geçişi süresince katmanı kendisi açar.
   Ölçülmüş tek istisna 2048 `.tile` (`will-change:translate`): her hamlede tahtadaki karoların çoğu kayar; kalıcı
   katman kaldırılınca her hamlede katman açılıp kapanıyor, raster süresi ~3 katına çıkıyordu (h2048-10, 4x yazılım:
   ~258 → ~849 ms). Kural "önce ölç": bir öğeyi katmandan çıkarmak da ölçümle doğrulanır.
4. **DOM bütçesi ve yerinde güncelleme.** Görünen ekranın alt ağacı en çok **2000 öğe**, belgenin tamamı en çok
   **8000 öğe** (ölçüm: bölüm 3; bilinen istisna: Kaçış özel bölüm ızgarası). Liste/ızgara her eylemde `innerHTML` ile baştan kurulmaz; yalnız değişen düğüm
   güncellenir ya da taşınır (örnek: `marketEkran.js kartlariYerlestir`, `hedef2048.js render`); ekranda
   görünmeyen pahalı parçalar görünmeye yaklaşınca kurulur (market önizlemeleri: `IntersectionObserver`). Uzun listelerde
   `content-visibility:auto` + `contain-intrinsic-size` (`.mk-izgara .mk-kart`). Sahne dışındaki ekranlar
   `content-visibility:hidden` ile stil/yerleşim ağacından çıkar (`.app-screen.offstage`); büyük ve nadir açılan
   yapılar ancak gerektiğinde kurulur (Kaçış özel bölüm ızgarası).
5. **Kalıtılan değişkeni geniş kapsayıcıya yazma.** Tema değişkeni gibi sık değişen bir CSS özel özelliği `.phone` ya da
   `body`'ye yazılırsa bütün alt ağaç yeniden hesaplanır. Yalnız kullanan öğeye yaz; gerekiyorsa `@property ...
   {inherits:false}` ile kalıtımsız kaydet ve kullanan sözde öğede `--x:inherit` al (`--tema-ton`).
6. **Canvas:** `shadowBlur` yasak. `ctx.filter` ve CSS `filter`/`backdrop-filter` yalnız yüksek kalitede ve küçük
   alanda. `devicePixelRatio` her zaman `Kalite.dprTavan()` ile sınırlanır (yüksek 2, orta 1,5, düşük 1). Statik
   katmanlar (arka plan, sprite) bir kez çizilip önbellekte tutulur; kare başına tam ekran dolgu/blit sayısı en az
   tutulur ve yeni tam ekran geçiş eklenmez. Büyük önbellek tuvali kare başına ölçeksiz (1:1) ve tam cihaz pikseline
   hizalı kopyalanır: ölçekli ya da alt piksel konumlu tam ekran `drawImage` yazılım canvas'ta en pahalı işlemdir
   (Süzül paralaks katmanları: karenin yarısı). Tam ekran radyal gradyan dolgusu da pahalıdır (~%20); tekrarlama.
7. **Kare başına bellek ayırma yok.** Kare döngüsünde nesne/dizi/closure/`createRadialGradient` üretilmez; parçacıklar
   önceden ayrılmış havuzdan (`Float32Array`) gelir; `Array.filter/map` yerine yerinde döngü.
8. **Her efekt Kalite API'sine uyar.** Parçacık/konfeti sayısı `Kalite.parcacikSayisi(taban)` / `Kalite.parcacikTut(i,
   taban)`, sarsma/konfeti/bulanıklık `Kalite.efektAcikMi('titreme'|'konfeti'|'blur')`. Rastgele sayılar her seviyede
   aynı sayıda ve sırada çekilir, yalnız düğüm üretimi atlanır: `Math.random` oyun üreteçleriyle (Tempo parçaları,
   2048 karoları, market kutusu) ortaktır; seviye oyun sırasını değiştirmemeli. Yeni efekt dosyaları (`js/*efekt*.js`)
   `tools/perfTest.js` tarafından buna göre denetlenir.
9. **Tek rAF döngüsü (oyun başına), ekran dışında ve arka planda durur.** Oyun ekranı `offstage` olunca ve
   `visibilitychange` (gizli) olunca döngü durur; `setInterval` yalnız ekran açıkken (market sayacı).
   İstisna: `Kalite.olc()` ölçüm süresince (en çok ~3,5 sn, uzun karelerde 10 sn) ikinci, kısa bir rAF döngüsü çalıştırır;
   kare başına yalnız zaman damgası kaydeder (bellek ayırmaz, DOM'a dokunmaz), sayfa gizlenince kendiliğinden biter.
   İstisna: `js/efekt.js` yalnız efekt sürerken (konfeti/patlama 1-2 sn, sayaç) kendi rAF döngüsünü çalıştırır; son parçacık
   bitince döngü durur ve tuval gizlenir, sayfa gizlenince her şey hemen biter. Oyunun hesap döngüsüne bağlı değildir.
10. **Düşük kalitede oyun aynıdır.** Kurallar, skor, üretim, adalet, ödül ve kayıt seviyeye bağlı değildir; yalnız
    çizim değişir. Kalite seçimi `localStorage` içinde ayrı anahtardadır (`ait_kalite`), ilerleme/market kaydına girmez.

## 2. Kalite katmanı (`js/kalite.js`)

| seviye | ne değişir |
|---|---|
| yüksek | mevcut görünüm, birebir (CSS'te `data-kalite="yuksek"` kuralı yok). Canvas DPR tavanı 2. |
| orta | `backdrop-filter` kapalı; çok sayıdaki/sürüklenen öğede `drop-shadow` kapalı (Kaçış gövdeleri, Tempo hayaleti, kutu SVG); market kart parlamaları küçük; kilitli önizlemede filtre yerine saydamlık; Tempo blok gölgesi sade; parçacık %60; canvas DPR 1,5. |
| düşük | ortadakiler + büyük gölgeler kalkar (2048 karo parlaması, kartlar), Tempo blok gradyanı yok, sonsuz dekor animasyonları durur (başlık, yol ışığı, yağmur, yıldızlar, efsanevi parıltı, tema ışığı, nefes), ekran geçişi 0,18 sn, parçacık %30, Tempo sarsma yerine tek kare parlama, Süzül'de dekor sızıntısı yok (karanlık tek gradyan dolgusu, ara tuval yok) ve DPR 1. |

- **Seçim:** Ayarlar > Grafik kalitesi: Otomatik / Yüksek / Orta / Düşük. `html[data-kalite]` her zaman yazılıdır
  (betik `<head>` içinde, ilk boyamadan önce).
- **Otomatik:** taban seviye ipuçlarından (`deviceMemory` <= 1 düşük, <= 2 orta; `hardwareConcurrency` <= 2 orta;
  `prefers-reduced-motion` orta). Açılıştan ~1 sn sonra 3 sn kare süresi ölçülür (ilk 500 ms atılır: geçiş / kurulum
  takılması): ortanca > 30 ms düşük, > 22 ms tabanın bir altı. Düşüş hemen; yükselme yalnız ortanca < 18 ms iken ve bir
  adım. Sabit 30 Hz rAF tavanı (ortanca 1000/30 ±%10 ve karelerin en az %75'i bu bantta: iOS Düşük Güç, pil tasarrufu)
  yavaşlık sayılmaz, seviyeyi düşürmez. Açılış ölçümü sayfa gizlendiği için yarıda kalırsa sayfa görünür olunca bir kez
  yeniden denenir. Süzül ilk dokunuşta, market açılışta ve Tempo başlangıcında da 3 sn ölçülür (`Kalite.olc()`, yalnız düşürür);
  Süzül'de koşu sürerken gelen düşüş yalnız ucuz sade çizim yolunu hemen açar, yeniden boyutlama duraklama / koşu sonu /
  yeni koşuda yapılır. Otomasyon altında (WebDriver / HeadlessChrome) ölçüm yapılmaz.
- **API:** `Kalite.seviye()`, `secim()`, `sec(s)`, `parcacikSayisi(taban)`, `parcacikTut(i, taban)`,
  `efektAcikMi(ad)`, `dprTavan()`, `dpr()`, `abone(fn)` (dönüş: aboneliği bırak), `olc()`; ayrıca
  `window` üzerinde `kalitedegisti` olayı (`detail: { seviye, onceki }`).

### Ortak efektler (`js/efekt.js`, Faz 2)

- Tek tam ekran tuval (`.efekt-tuval`, `.phone` içinde, `pointer-events:none`), yalnız efekt varken görünür. Parçacık havuzu
  `Float32Array` (120 parçacık, bir kez ayrılır); aynı anda canlı parçacık üst sınırı yüksek 120, orta 60, düşük 20
  (istenen adet önce `Kalite.parcacikSayisi`). DPR `Kalite.dprTavan()`. Yalnız önceki karede boyanan alan silinir.
- Kendi rastgele üreteci (xorshift32): `Math.random` hiç çağrılmaz, oyun sırası (Tempo parçaları, 2048 karoları) değişmez.
- Titreme Web Animations ile yalnız `transform` (translate); oyunun dokunma ölçüsü aldığı öğeye verilmez (Tempo: skor
  çubuğu, Süzül: tuval, 2048: tahta kapsayıcısı). Düşük kalite ve azaltılmış harekette titreme yerine tek parlama; azaltılmış
  harekette konfeti az ve kısa, sayaç anında. Denetim: `tools/efektTest.js`.

## 3. Bütçeler (ölçülmüş)

Ölçüm: `tools/perfOlc.js`, 390x844, DPR 3 (canvas 2'ye sınırlı), sabit tohum, her sahne 3 koşunun ortancası.

- **Kare süresi (4x CPU kısma, GPU yolu, yüksek kalite): medyan <= 20 ms, p95 <= 34 ms** Market (liste, önizleme,
  kutu), Tempo Küp (sürükleme, temizleme), Karanlıkta Süzül, Hedef 2048 10x10 için. p95 sınırı 33 ms yerine 34 ms:
  60 Hz'de iki kare 33,3 ms'dir, rAF zaman damgası 33,4 verebilir; "en çok iki kare" demektir.
- **Uzun görev:** tek dokunuşun işi 4x kısmada 50 ms'yi geçmemeli (hedef); ölçümde sahne başına uzun görev sayısı
  ve toplamı izlenir (`uzunG`, `uzunMs`).
- **Yazılım canvas yolu (`--disable-gpu`):** Süzül bu yolda bütçeyi karşılamaz: tam ekran ~780x1430 piksel her kare
  ana iş parçacığında rasterlanır. 4x kısmada kare medyanı yüksek kalitede 167-183 → 83 ms (Faz 1), orta 100 ms,
  düşük 50 ms. Gerçek telefonlar canvas'ı çoğunlukla GPU ile çizer (GPU yolunda 16,7 ms); bütçe GPU yolunda denetlenir,
  yazılım yolu önce/sonra karşılaştırması ve kalite seviyelerinin etkisi için ölçülür. Yazılım çizen yavaş cihazda
  otomatik kalite Süzül'ün ilk 3 saniyesinde seviyeyi düşürür (`Kalite.olc()`).
- **GPU yolu, 4x, yüksek kalite (Faz 1 sonrası):** bütçe sahnelerinin tamamında medyan 16,7 ms, p95 16,8 ms
  (Market kutu açma önce 33,3 ms). Kalan uzun görevler tek seferlik kurulumlardır: market açılışı / envanter sekmesi
  (~300 ms toplam, 3 görev), kutu açma (~70 ms / kutu).
- **DOM (görünen ekranın alt ağacı / belge):** ölçüm (Faz 1 sonrası): ana ekran 159, Tempo 115, 2048 5x5 65, Kaçış bölüm
  236, market envanteri (10 tema) 1372, Kaçış haritası 1857; Kaçış özel ızgarası 3357 (20 küçük resim, her biri yüzlerce
  `<rect>`; artık yalnız açılınca kurulur). Belge taze açılışta ~620, Kaçış haritası + bölüm + özel ızgara açılmış oturumda
  ~6000. Bütçe: **görünen ekran <= 2000, belge <= 8000**; özel ızgara bilinen istisnadır (küçük resimleri tek `<path>`'e
  birleştirmek ya da `<canvas>`'a çizmek sonraki iş). Sahne dışı ekranlar `content-visibility:hidden` olduğu için belge
  toplamı stil hesabına değil yalnız belleğe yük olur.

## 4. Ölçüm araçları

- `node tools/perfOlc.js` — sahne bazlı ölçüm (headless Chrome + CDP, CPU kısma 4x/6x). Sık kullanılanlar:
  `--liste` (sahneler), `--sahne market-liste,tempo-temizle`, `--kisma 4`, `--tekrar 3` (süreler koşudan koşuya
  %30-45 oynar; karşılaştırmada en az 3), `--gpu` (GPU yolu), `--kalite dusuk` (adrese `?kalite=dusuk`),
  `--json cikti.json`. Sütunlar dosyanın başında açıklanmıştır.
- Efekt sahneleri (`efekt-2048`, `efekt-tempo`, `efekt-suzul`): ölçüm yalnız efekt süresince (~2,2 sn). Faz 2 sonucu (GPU yolu, 4x,
  3 koşunun ortancası): üç kalite seviyesinde üç sahne de medyan 16,7 ms, p95 16,8-17,2 ms. 2048 kutlamasındaki tek uzun görev
  (~55-75 ms) mevcut hamle işidir (efekt çağrıları boşaltılınca da var; efekt çağrıları 4x'te toplam ~2-10 ms).
  Yazılım yolunda (bilgi) 2048 ve Tempo yine 16,7 ms; `efekt-suzul` (koşu sürerken tam ekran konfeti, gerçekte olmayan en
  kötü durum) yüksekte medyan 83 → 100 ms, düşükte 16,7 → 33 ms. Süzül'ün gerçek koşu içi rekor anı konfetisizdir (patlama +
  titreme / parlama); sonuç kartı konfetisi oyun döngüsü durduktan sonradır.
- `node tools/perfTest.js` — statik kurallar ve kalite katmanı birim denemeleri; `--butce` ile ek olarak bütçe
  sahnelerini headless ölçer (Chrome yoksa ATLANDI).
- `?fps=1` — uygulama içi canlı FPS / kare süresi göstergesi (sol üst; `js/fpsGosterge.js`). Yalnız yerel adreste
  (file://, localhost, 127.0.0.1, 10.x, 192.168.x, 172.16-31.x): telefondan yerel ağla `http://192.168.x.y:port/?fps=1`.
- `?kalite=dusuk|orta|yuksek` — seviyeyi bu oturum için zorlar (kaydedilmez). `?kaliteOlc=1` otomasyon altında da
  otomatik ölçümü çalıştırır. İkisi de yalnız yerel adreste; yayındaki adreste etkisiz. `?fps=1&kalite=dusuk`
  birlikte kullanılabilir.
