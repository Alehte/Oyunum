// perfTest.js — performans kurallari ve kalite katmani denetimi (docs/PERFORMANS.md).
// Calistirma:  node tools/perfTest.js            (statik kurallar + js/kalite.js birim denemeleri; Chrome gerekmez)
//              node tools/perfTest.js --butce    (ek: headless Chrome'da tools/perfOlc.js ile butce olcumu, ~3-4 dk;
//                                                 Chrome yoksa ATLANDI, basarisiz sayilmaz)
// Statik kurallar kaynak metninde denetlenir: kodda shadowBlur yok; @keyframes icinde yerlesim ozelligi (top/left/width/
// height/margin/padding/inset/font-size) yok; yerlesim ozelligi gecisi yalniz bilinen istisnalarda; sonsuz animasyonlar
// yalniz transform/opacity (bilinen istisnalar dusuk kalitede durur); kalici ogelerde will-change yok (2048 .tile olculmus istisna); offstage ekranlar
// content-visibility:hidden; js/kalite.js sw CEKIRDEK'te ve head'de; efekt dosyalari Kalite'ye bagli.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), cp = require('child_process'), os = require('os');
const KOK = path.join(__dirname, '..');
const oku = f => fs.readFileSync(path.join(KOK, f), 'utf8');

let gecti = 0, atlandi = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

const CSS = oku('style.css');
const JS = fs.readdirSync(path.join(KOK, 'js')).filter(f => f.endsWith('.js')).map(f => ({ ad: 'js/' + f, metin: oku('js/' + f) }));
const yorumsuz = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

// @keyframes bloklari: [ad, govde, dosya]
function kareBloklari(metin, dosya) {
  const out = [], re = /@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g; let m;
  while ((m = re.exec(metin))) {
    let d = 1, i = re.lastIndex;
    while (i < metin.length && d) { if (metin[i] === '{') d++; else if (metin[i] === '}') d--; i++; }
    out.push([m[1], metin.slice(re.lastIndex, i - 1), dosya]);
  }
  return out;
}
const KARELER = kareBloklari(yorumsuz(CSS), 'style.css');
JS.forEach(f => kareBloklari(f.metin, f.ad).forEach(b => KARELER.push(b)));   // JS'in enjekte ettigi stiller (kacis.js kcInjectStyles)
const YERLESIM = /(^|[;{\s])(top|left|right|bottom|width|height|min-width|min-height|max-width|max-height|margin(-[a-z]+)?|padding(-[a-z]+)?|inset|font-size|border-width|line-height)\s*:/;

console.log('performans kurallari (statik)');

dene('kodda shadowBlur yok (canvas golge bulaniklastirmasi cok pahali)', () => {
  const ihlal = JS.filter(f => /shadowBlur/.test(f.metin)).map(f => f.ad);
  assert.deepStrictEqual(ihlal, [], 'shadowBlur: ' + ihlal.join(', '));
});

dene('@keyframes icinde yerlesim ozelligi canlandirilmiyor (yalniz transform/opacity ve boya)', () => {
  const ihlal = KARELER.filter(b => YERLESIM.test(b[1])).map(b => b[2] + ' ' + b[0]);
  assert.ok(KARELER.length > 40, 'keyframes bulunamadi: ' + KARELER.length);
  assert.deepStrictEqual(ihlal, [], 'yerlesim ozelligi canlanan keyframes: ' + ihlal.join(', '));
});

// Bilinen istisnalar (yeni kod EKLEMEZ): ayarlar paneli bottom ile kayar (nadiren, tek oge); Sirala Dur dokum seridi
// yuksekligi (tasarim geregi kisa, tek oge). Listeyi buyutmek yerine transform kullan.
const GECIS_ISTISNA = ['.sheet', '.ss-akis'];
dene('yerlesim ozelligi gecisi (transition) yalniz bilinen istisnalarda: ' + GECIS_ISTISNA.join(', '), () => {
  const css = yorumsuz(CSS), re = /([^{}]+)\{([^{}]*)\}/g, ihlal = []; let m;
  while ((m = re.exec(css))) {
    const t = /(?:^|;)\s*transition\s*:\s*([^;]+)/.exec(m[2]);
    if (!t || !/(^|,)\s*(top|left|right|bottom|width|height|margin|padding|all)\b/.test(t[1])) continue;
    const secici = m[1].trim().replace(/\s+/g, ' ');
    if (GECIS_ISTISNA.indexOf(secici) < 0) ihlal.push(secici + ' { transition:' + t[1].trim() + ' }');
  }
  assert.deepStrictEqual(ihlal, []);
});

// Sonsuz animasyonlar transform/opacity disinda bir sey canlandirmasin (her karede yeniden boyama). Istisnalar eski dekor
// animasyonlaridir ve dusuk kalitede durur (style.css KALITE KATMANI).
const SONSUZ_ISTISNA = { kcCrawl: 'stroke-dashoffset', ssYolAk: 'stroke-dashoffset', wildPulse: 'filter', ssAkisKay: 'background-position (dokum suresince)',
  ssoBagetKar: 'karistirma suresince', ssoCalkala: 'karistirma suresince', yukleDon: 'yukleme gostergesi',
  ssoHazir: 'box-shadow (karistir dugmesi hazir nabzi; dusukte durur)' };
dene('sonsuz animasyonlar yalniz transform/opacity (istisnalar: ' + Object.keys(SONSUZ_ISTISNA).join(', ') + ')', () => {
  const css = yorumsuz(CSS), adlar = new Set(), re = /animation\s*:\s*([^;}]+)/g; let m;
  while ((m = re.exec(css))) m[1].split(',').forEach(p => { if (/\binfinite\b/.test(p)) { const a = p.trim().split(/\s+/)[0]; adlar.add(a); } });
  const ihlal = [];
  adlar.forEach(a => {
    if (SONSUZ_ISTISNA[a]) return;
    KARELER.filter(b => b[0] === a).forEach(b => {
      const ozellik = (b[1].match(/([a-z-]+)\s*:/g) || []).map(x => x.replace(/\s*:$/, ''));
      const kotu = ozellik.filter(o => !/^(transform|opacity|animation-timing-function|offset-distance)$/.test(o));
      if (kotu.length) ihlal.push(a + ' (' + Array.from(new Set(kotu)).join(', ') + ')');
    });
  });
  assert.ok(adlar.size > 10, 'sonsuz animasyon bulunamadi');
  assert.deepStrictEqual(ihlal, []);
});

dene('dusuk kalitede sonsuz boya animasyonu istisnalari durur (kcCrawl, ssYolAk, wildPulse, ssoHazir)', () => {
  assert.ok(/html\[data-kalite="dusuk"\] \.sso-karistir\.hazir\{animation:none;\}/.test(CSS), 'sso-karistir nabzi dusukte durmuyor');
  assert.ok(/html\[data-kalite="dusuk"\] :is\([^)]*\.kc-path-glow[^)]*\.ss-yol-serit[^)]*\)\{animation:none;\}/.test(CSS), 'kc-path-glow / ss-yol-serit dusukte durmuyor');
  assert.ok(/html\[data-kalite="dusuk"\] \.tile\[data-v="wild"\]\{[^}]*animation:none/.test(CSS), 'wild karo nabzi dusukte durmuyor');
});

// Istisna (olculmus): 2048 .tile will-change:translate KALIR. Kaldirildiginda her hamlede 100'e kadar karo icin katman acilip
// kapaniyor, raster suresi 3 katina cikiyordu (perfOlc h2048-10 4x yazilim: raster ~258 -> ~849 ms; docs/PERFORMANS.md kural 3).
dene('kalici ve cok sayidaki ogelerde will-change yok (.tp-cell, .kc-snake, .mk-kart, .app-screen, .bd-tile; .tile olculmus istisna)', () => {
  const css = yorumsuz(CSS), re = /([^{}]+)\{([^{}]*)\}/g, ihlal = []; let m;
  while ((m = re.exec(css))) {
    if (!/will-change\s*:\s*(?!auto)/.test(m[2])) continue;
    m[1].split(',').map(s => s.trim()).forEach(s => {
      if (/^(\.tp-cell|\.kc-snake|\.mk-kart|\.app-screen|\.bd-tile|\.board|\.tp-blok)$/.test(s)) ihlal.push(s);
    });
  }
  assert.deepStrictEqual(ihlal, []);
});

dene('sahne disi ekranlar stil/yerlesim agacindan cikar (.app-screen.offstage content-visibility:hidden)', () => {
  assert.ok(/\.app-screen\.offstage\{[^}]*content-visibility:hidden/.test(CSS));
});

dene('tema tonu kalitimsiz (@property --tema-ton inherits:false) ve .phone\'a yazilmiyor', () => {
  assert.ok(/@property --tema-ton\{syntax:'\*'; inherits:false;\}/.test(CSS));
  assert.ok(!/tonYaz\(document\.querySelector\('\.phone'\)/.test(oku('js/market.js')));
});

dene('yuksek kalite icin CSS kurali yok (mevcut gorunum birebir)', () => {
  assert.ok(!/data-kalite="yuksek"/.test(CSS));
  assert.ok(/html\[data-kalite="dusuk"\]/.test(CSS) && /data-kalite="orta"/.test(CSS));
});

dene('js/kalite.js: sw CEKIRDEK listesinde, index.html head icinde ve style.css\'ten sonra yukleniyor', () => {
  const sw = oku('sw.js'), html = oku('index.html');
  const cek = /var CEKIRDEK = \[([\s\S]*?)\];/.exec(sw);
  assert.ok(cek && /'js\/kalite\.js'/.test(cek[1]), 'CEKIRDEK icinde degil');
  const bas = html.indexOf('<script src="js/kalite.js"></script>'), head = html.indexOf('</head>'), stil = html.indexOf('href="style.css"');
  assert.ok(bas > stil && bas < head, 'kalite.js head icinde style.css\'ten sonra degil');
  assert.ok(/id="kaliteSec"/.test(html) && (html.match(/data-kalite-sec="(oto|yuksek|orta|dusuk)"/g) || []).length === 4, 'ayarlar ekraninda 4 secenek yok');
});

dene('efekt dosyalari (js/*efekt*.js) Kalite API\'sine bagli, canvas golgesi / filtre kullanmiyor', () => {
  JS.filter(f => /efekt/i.test(f.ad)).forEach(f => {
    assert.ok(/Kalite\.(parcacikSayisi|parcacikTut|efektAcikMi)\(/.test(f.metin), f.ad + ': Kalite kullanilmiyor');
    assert.ok(!/shadowBlur|\.filter\s*=|backdrop-filter/.test(f.metin), f.ad + ': golge/filtre');
  });
});

// govde metni: function ad(...) { ... } (duz parantez sayimi)
function govde(metin, ad) {
  const i = metin.indexOf('function ' + ad + '(');
  assert.ok(i >= 0, ad + ' bulunamadi');
  let j = metin.indexOf('{', i), d = 1, k = j + 1;
  while (d && k < metin.length) { if (metin[k] === '{') d++; else if (metin[k] === '}') d--; k++; }
  return metin.slice(j, k);
}
dene('Tempo efektleri dongude offset* okumuyor (patlat, hatIsigi, parcacikSac); oturma animasyonu zorunlu yerlesimsiz', () => {
  const t = oku('js/tempoKup.js');
  ['patlat', 'hatIsigi', 'parcacikSac', 'kutlama'].forEach(f => assert.ok(!/\.offset(Left|Top|Width|Height)/.test(govde(t, f)), f + ' offset okuyor'));
  assert.ok(/h\.animate\(OTUR_KARE, OTUR_AYAR\)/.test(t), 'tp-otur Web Animations ile degil');
  assert.ok(!/void sarmal\.offsetWidth/.test(govde(t, 'sars')), 'sars zorunlu yerlesim yapiyor');
});

dene('Market envanteri / vitrini yerinde guncellenir (innerHTML ile tum liste kurulmaz)', () => {
  const m = oku('js/marketEkran.js');
  assert.ok(!/el\.izgara\.innerHTML\s*=/.test(m) && !/el\.vitrin\.innerHTML\s*=/.test(m));
  assert.ok(/kartlariYerlestir\(el\.izgara, liste\)/.test(m) && /kartlariYerlestir\(el\.vitrin, liste\)/.test(m));
  assert.ok(/\.mk-izgara \.mk-kart\{content-visibility:auto; contain-intrinsic-size:/.test(CSS));
});

dene('canvas DPR kalite tavanina bagli (Suzul boyutla: Kalite.dprTavan, en cok 2)', () => {
  const a = oku('js/atesBocegiOyun.js');
  assert.ok(/Math\.min\(window\.devicePixelRatio \|\| 1, window\.Kalite \? window\.Kalite\.dprTavan\(\) : 2\)/.test(a));
});

dene('2048: tahta secim karesi transform ile konumlaniyor, nefes box-shadow canlandirmiyor, render degismeyen olcuyu yazmiyor', () => {
  const h = oku('js/hedef2048.js');
  assert.ok(/if\(el\._cw !== cw\)/.test(h), 'render her karoda width/height yaziyor');
  assert.ok(/el\.style\.transform = 'translate\(' \+ slot\.x/.test(h) && !/el\.style\.left = slot\.x/.test(h));
  const b = KARELER.find(k => k[0] === 'bdBreathe');
  assert.ok(b && !/box-shadow/.test(b[1]), 'bdBreathe box-shadow canlandiriyor');
});

dene('Kacis suzulmesinde kafa transform ile tasiniyor (kare basina left/top yazilmiyor)', () => {
  const k = oku('js/kacis.js');
  assert.ok(/head\.style\.transform = 'translate\('/.test(k) && !/head\.style\.left = \(hp/.test(k));
});

// ---------------------------------------------------------------
// js/kalite.js birim denemeleri (sahte pencere; yerel/yayin adresi, kayit, karar, parcacik sayisi)
// ---------------------------------------------------------------
console.log('kalite katmani (js/kalite.js)');
const KALITE = oku('js/kalite.js');
function kaliteKur(o) {
  o = o || {};
  const depo = Object.assign({}, o.depo || {}), attr = {}, olaylar = [], zaman = [], dinle = {};
  const depoNesne = {
    getItem: k => (k in depo ? depo[k] : null),
    setItem: (k, v) => { if (o.depoHata) throw new Error('kota'); depo[k] = String(v); },
    removeItem: k => { delete depo[k]; }
  };
  const w = {
    location: { protocol: o.protokol || 'http:', hostname: o.host || '127.0.0.1', search: o.arama || '' },
    navigator: Object.assign({ hardwareConcurrency: 8, deviceMemory: 8, userAgent: 'Mozilla/5.0 Chrome/1' }, o.nav || {}),
    devicePixelRatio: o.dpr || 3,
    matchMedia: () => ({ matches: !!o.azHareket }),
    addEventListener: () => {}, dispatchEvent: e => { olaylar.push(e); return true; },
    CustomEvent: function (ad, i) { this.type = ad; this.detail = i && i.detail; },
    setTimeout: f => { zaman.push(f); return zaman.length; }, requestAnimationFrame: null,
    console: { error: () => {} }, JSON, Math, Number, String
  };
  Object.defineProperty(w, 'localStorage', { get: () => { if (o.depoYok) throw new Error('SecurityError'); return depoNesne; } });
  w.window = w;
  w.document = { readyState: 'complete', documentElement: { setAttribute: (k, v) => { attr[k] = v; } }, getElementById: () => null, hidden: false,
    addEventListener: (t, f) => { dinle[t] = f; }, removeEventListener: (t, f) => { if (dinle[t] === f) delete dinle[t]; } };
  vm.runInNewContext(KALITE, w, { filename: 'kalite.js' });
  return { K: w.Kalite, depo, attr, olaylar, w, zaman, dinle };
}

dene('varsayilan: kayit yok -> otomatik, ipucu yuksek; html[data-kalite] yazilir; DPR tavani 2', () => {
  const o = kaliteKur();
  assert.strictEqual(o.K.secim(), 'oto'); assert.strictEqual(o.K.seviye(), 'yuksek');
  assert.strictEqual(o.attr['data-kalite'], 'yuksek');
  assert.strictEqual(o.K.dprTavan(), 2); assert.strictEqual(o.K.dpr(), 2);
  assert.strictEqual(o.K.parcacikSayisi(28), 28);
  for (let i = 0; i < 28; i++) assert.strictEqual(o.K.parcacikTut(i, 28), true);
  ['titreme', 'konfeti', 'blur'].forEach(e => assert.strictEqual(o.K.efektAcikMi(e), true, e));
});

dene('bozuk / eksik / yabanci kayit yok sayilir; depo hic yoksa da calisir', () => {
  ['{bozuk', 'null', '42', '[]', '{"secim":"ultra","oto":"x"}', '{"secim":5}'].forEach(v => {
    const o = kaliteKur({ depo: { ait_kalite: v } });
    assert.strictEqual(o.K.secim(), 'oto', v); assert.strictEqual(o.K.seviye(), 'yuksek', v);
  });
  const y = kaliteKur({ depoYok: true });
  assert.strictEqual(y.K.seviye(), 'yuksek');
  assert.strictEqual(y.K.sec('dusuk'), true); assert.strictEqual(y.K.seviye(), 'dusuk');
});

dene('elle secim kalici, AYRI anahtarda (ait_kalite); ilerleme/market kaydina dokunmaz; abonelere ve olaya bildirilir', () => {
  const o = kaliteKur({ depo: { ait_progress: '{"gold":5}', ait_market: '{"s":[]}' } });
  const bildirim = []; o.K.abone((s, onceki) => bildirim.push(onceki + '>' + s));
  assert.strictEqual(o.K.sec('orta'), true);
  assert.deepStrictEqual(JSON.parse(o.depo.ait_kalite), { v: 1, secim: 'orta', oto: null });
  assert.strictEqual(o.depo.ait_progress, '{"gold":5}'); assert.strictEqual(o.depo.ait_market, '{"s":[]}');
  assert.deepStrictEqual(bildirim, ['yuksek>orta']);
  assert.strictEqual(o.olaylar.length, 1); assert.strictEqual(o.olaylar[0].type, 'kalitedegisti');
  assert.strictEqual(o.attr['data-kalite'], 'orta');
  assert.strictEqual(o.K.sec('gecersiz'), false); assert.strictEqual(o.K.seviye(), 'orta');
  const o2 = kaliteKur({ depo: { ait_kalite: o.depo.ait_kalite } });
  assert.strictEqual(o2.K.seviye(), 'orta');
});

dene('seviye etkileri: orta DPR 1,5 / parcacik %60 / blur kapali; dusuk DPR 1 / %30 / titreme kapali (konfeti acik)', () => {
  const orta = kaliteKur({ depo: { ait_kalite: '{"secim":"orta"}' } }).K, dusuk = kaliteKur({ depo: { ait_kalite: '{"secim":"dusuk"}' } }).K;
  assert.strictEqual(orta.dprTavan(), 1.5); assert.strictEqual(orta.dpr(), 1.5);
  assert.strictEqual(orta.parcacikSayisi(28), 17); assert.strictEqual(orta.efektAcikMi('blur'), false); assert.strictEqual(orta.efektAcikMi('titreme'), true);
  assert.strictEqual(dusuk.dprTavan(), 1); assert.strictEqual(dusuk.parcacikSayisi(28), 8); assert.strictEqual(dusuk.parcacikSayisi(1), 1);
  assert.strictEqual(dusuk.parcacikSayisi(0), 0);
  assert.strictEqual(dusuk.efektAcikMi('titreme'), false); assert.strictEqual(dusuk.efektAcikMi('konfeti'), true);
  [7, 28, 60, 90].forEach(n => {
    let t = 0; for (let i = 0; i < n; i++) if (dusuk.parcacikTut(i, n)) t++;
    assert.strictEqual(t, dusuk.parcacikSayisi(n), 'parcacikTut adedi ' + n);
  });
});

dene('?kalite= zorlamasi yalniz yerel adreste; kaydedilmez; yayin adresinde etkisiz', () => {
  ['127.0.0.1', 'localhost', '192.168.1.20', '10.0.0.5', '172.20.1.1'].forEach(h => {
    const o = kaliteKur({ host: h, arama: '?kalite=dusuk' });
    assert.strictEqual(o.K.seviye(), 'dusuk', h); assert.strictEqual(o.depo.ait_kalite, undefined, h + ' kaydetti');
  });
  const f = kaliteKur({ protokol: 'file:', host: '', arama: '?fps=1&kalite=orta' });
  assert.strictEqual(f.K.seviye(), 'orta');
  ['ornek.github.io', '172.32.0.1', '8.8.8.8', 'kalite.example.com'].forEach(h => {
    const o = kaliteKur({ host: h, arama: '?kalite=dusuk' });
    assert.strictEqual(o.K.seviye(), 'yuksek', h + ' zorlama etkili');
  });
  const s = kaliteKur({ arama: '?kalite=dusuk', depo: { ait_kalite: '{"secim":"orta"}' } });
  assert.strictEqual(s.K.seviye(), 'dusuk');
  s.K.sec('yuksek'); assert.strictEqual(s.K.seviye(), 'yuksek', 'elle secim zorlamayi kaldirmali');
});

dene('ipuclari: deviceMemory <= 1 dusuk, <= 2 orta; hardwareConcurrency <= 2 orta; hareketi azalt orta; 4 cekirdek yuksek', () => {
  assert.strictEqual(kaliteKur({ nav: { deviceMemory: 1 } }).K.seviye(), 'dusuk');
  assert.strictEqual(kaliteKur({ nav: { deviceMemory: 2 } }).K.seviye(), 'orta');
  assert.strictEqual(kaliteKur({ nav: { hardwareConcurrency: 2 } }).K.seviye(), 'orta');
  assert.strictEqual(kaliteKur({ azHareket: true }).K.seviye(), 'orta');
  assert.strictEqual(kaliteKur({ nav: { hardwareConcurrency: 4, deviceMemory: undefined } }).K.seviye(), 'yuksek');
  assert.strictEqual(kaliteKur({ nav: { deviceMemory: 1 }, depo: { ait_kalite: '{"secim":"yuksek"}' } }).K.seviye(), 'yuksek', 'elle secim ipucunu ezer');
  assert.strictEqual(kaliteKur({ depo: { ait_kalite: '{"secim":"oto","oto":"orta"}' } }).K.seviye(), 'orta', 'kayitli otomatik karar');
});

dene('olcum karari: > 30 ms dusuk, > 22 ms bir alt; yukselme yalniz < 18 ms ve bir adim; oyun ici olcum yalniz dusurur', () => {
  const k = kaliteKur().K._karar;
  assert.strictEqual(k(35, 'yuksek', 'yuksek'), 'dusuk');
  assert.strictEqual(k(25, 'yuksek', 'yuksek'), 'orta');
  assert.strictEqual(k(25, 'orta', 'orta'), 'dusuk');
  assert.strictEqual(k(16.7, 'yuksek', 'yuksek'), 'yuksek');
  assert.strictEqual(k(16.7, 'yuksek', 'dusuk'), 'orta', 'bir adim yukselir');
  assert.strictEqual(k(20, 'yuksek', 'orta'), 'orta', '18-22 ms arasi yukselmez');
  assert.strictEqual(k(16.7, 'yuksek', 'orta', true), 'orta', 'oyun ici olcum yukseltmez');
  assert.strictEqual(k(25, 'yuksek', 'yuksek', true), 'orta');
  assert.strictEqual(k(40, 'orta', 'orta', true), 'dusuk');
});

dene('otomasyon altinda (webdriver / HeadlessChrome) otomatik olcum baslamaz; ?kaliteOlc=1 yerelde acar', () => {
  const sayac = o => { let n = 0; o.w.requestAnimationFrame = () => { n++; return n; }; return () => n; };
  const a = kaliteKur({ nav: { userAgent: 'Mozilla/5.0 HeadlessChrome/158' } }); const na = sayac(a);
  assert.strictEqual(a.K.olc(), false); assert.strictEqual(na(), 0);
  const b = kaliteKur({ nav: { webdriver: true } }); sayac(b); assert.strictEqual(b.K.olc(), false);
  const c = kaliteKur({ nav: { userAgent: 'HeadlessChrome' }, arama: '?kaliteOlc=1' }); const nc = sayac(c);
  assert.strictEqual(c.K.olc(), true); assert.strictEqual(nc(), 1);
  const d = kaliteKur({ host: 'ornek.github.io', nav: { userAgent: 'HeadlessChrome' }, arama: '?kaliteOlc=1' }); sayac(d);
  assert.strictEqual(d.K.olc(), false, 'yayinda ?kaliteOlc etkisiz');
  const e = kaliteKur({ depo: { ait_kalite: '{"secim":"orta"}' } }); sayac(e);
  assert.strictEqual(e.K.olc(), false, 'elle secimde olcum yok');
});

// sahte rAF: kare(ms araligi, adet) zaman damgasi ilerletip bekleyen geri cagrimi calistirir; istek(): bekleyen var mi
function rafSur(o) {
  let f = null, t = 1000;
  o.w.requestAnimationFrame = g => { f = g; return 1; };
  return {
    kare(d, n) { for (let i = 0; i < n && f; i++) { const g = f; f = null; t += d; g(t); } },
    istek: () => !!f, t: () => t
  };
}

dene('olcum ozeti: ortanca; sabit 30 Hz tavani (1000/30 +-%10, karelerin en az %75) "tavanli"; tavanli olcum dusurmez', () => {
  const K = kaliteKur().K, oz = (a) => K._ozet(a, a.length);
  assert.strictEqual(oz([10, 20, 30]).ortanca, 20); assert.strictEqual(oz([10, 20, 30, 40]).ortanca, 25);
  assert.strictEqual(oz([16.7, 16.7, 16.7, 500]).ortanca, 16.7, 'tek uzun kare ortancayi kaydirmaz');
  const otuz = []; for (let i = 0; i < 90; i++) otuz.push(i % 9 ? 33.3 : (i % 2 ? 34.9 : 31.8));
  assert.strictEqual(oz(otuz).tavanli, true);
  const yavas = []; for (let i = 0; i < 90; i++) yavas.push(i % 3 ? 33.3 : 50);   // %33 uzun kare: gercek yavaslik
  assert.strictEqual(oz(yavas).tavanli, false);
  const kirk = []; for (let i = 0; i < 90; i++) kirk.push(40);
  assert.strictEqual(oz(kirk).tavanli, false);
  const k = K._karar;
  assert.strictEqual(k(33.3, 'yuksek', 'yuksek', false, true), 'yuksek', 'tavanli: dusurmez');
  assert.strictEqual(k(33.3, 'yuksek', 'yuksek', true, true), 'yuksek');
  assert.strictEqual(k(33.3, 'yuksek', 'dusuk', false, true), 'dusuk', 'tavanli: yukseltmez de');
  assert.strictEqual(k(33.3, 'yuksek', 'yuksek', false, false), 'dusuk', 'tavansiz 33 ms: dusuk (eskisi gibi)');
});

dene('olcum akisi: 30 Hz tavaninda seviye kalir (kayit yuksek); 40 ms karelerde dusuk; ilk 500 ms atilir (olcum 3,5 sn surer)', () => {
  const a = kaliteKur(), ra = rafSur(a);
  assert.strictEqual(a.K.olc(), true);
  ra.kare(1000 / 30, 200);
  assert.strictEqual(ra.istek(), false); assert.strictEqual(a.K.seviye(), 'yuksek'); assert.strictEqual(JSON.parse(a.depo.ait_kalite).oto, 'yuksek');
  const b = kaliteKur(), rb = rafSur(b);
  b.K.olc(); rb.kare(40, 200);
  assert.strictEqual(b.K.seviye(), 'dusuk'); assert.strictEqual(JSON.parse(b.depo.ait_kalite).oto, 'dusuk');
  // ilk 500 ms (gecis / kurulum takilmasi) sayilmaz: 400 ms'lik takilma + akici kareler -> seviye kalir; olcum 3,5 sn surer
  const c = kaliteKur(), rc = rafSur(c), bas = rc.t() + 400;
  c.K.olc(); rc.kare(400, 1);
  let son = 0; while (rc.istek()) { son = rc.t(); rc.kare(16.7, 1); }
  assert.ok(rc.t() - bas >= 3500 && son - bas < 3500, 'olcum suresi ' + (rc.t() - bas));
  assert.strictEqual(c.K.seviye(), 'yuksek');
});

dene('acilis olcumu sayfa gizlenince iptal: sayfa gorununce bir kez yeniden denenir (ikinci iptalde tekrar yok)', () => {
  const o = kaliteKur(), r = rafSur(o);
  assert.strictEqual(o.zaman.length, 1, 'acilis zamanlayicisi');
  o.zaman[0]();                                   // acilis olcumu basladi
  assert.strictEqual(r.istek(), true);
  o.w.document.hidden = true; r.kare(16.7, 1);    // gizlendi: iptal
  assert.strictEqual(r.istek(), false); assert.strictEqual(typeof o.dinle.visibilitychange, 'function');
  o.dinle.visibilitychange();                      // hala gizli: bir sey olmaz
  assert.strictEqual(o.zaman.length, 1);
  o.w.document.hidden = false; o.dinle.visibilitychange();
  assert.strictEqual(o.dinle.visibilitychange, undefined, 'dinleyici birakilmadi'); assert.strictEqual(o.zaman.length, 2);
  o.zaman[1](); assert.strictEqual(r.istek(), true, 'yeniden olcum baslamadi');
  r.kare(40, 200); assert.strictEqual(o.K.seviye(), 'dusuk', 'yeniden olcum karar vermedi');
  // ikinci acilis iptali yok: tekrar en cok bir kez
  const p = kaliteKur(), rp = rafSur(p);
  p.zaman[0](); p.w.document.hidden = true; rp.kare(16.7, 1);
  p.w.document.hidden = false; p.dinle.visibilitychange(); p.zaman[1]();
  p.w.document.hidden = true; rp.kare(16.7, 1);
  assert.strictEqual(p.dinle.visibilitychange, undefined, 'ikinci kez dinleyici kuruldu');
  // oyun ici olcum (Kalite.olc) iptali yeniden denenmez
  const q = kaliteKur(), rq = rafSur(q);
  q.K.olc(); q.w.document.hidden = true; rq.kare(16.7, 1);
  assert.strictEqual(q.dinle.visibilitychange, undefined);
});

// ---------------------------------------------------------------
// Istege bagli: headless butce olcumu (tools/perfOlc.js; GPU yolu, 4x CPU kisma, yuksek kalite)
// ---------------------------------------------------------------
const BUTCE = { medyan: 20, p95: 34 };   // ms; p95 60 Hz'de 2 kare (33,3) + rAF zaman damgasi oynamasi (docs/PERFORMANS.md)
const BUTCE_SAHNE = ['market-liste', 'market-onizleme', 'market-sandik', 'tempo-surukle', 'tempo-temizle', 'suzul-b5', 'h2048-10'];
function chromeVar() {
  return [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    .filter(Boolean).some(a => fs.existsSync(a));
}
console.log('butce (headless, istege bagli)');
if (process.argv.indexOf('--butce') < 0) {
  console.log('  ATLANDI butce olcumu (istege bagli: node tools/perfTest.js --butce); basarisiz sayilmadi'); atlandi++;
} else if (!chromeVar()) {
  console.log('  ATLANDI butce olcumu (Chrome yok: CHROME_YOL ile chrome.exe yolunu verin); basarisiz sayilmadi'); atlandi++;
} else {
  dene('4x CPU kisma, GPU yolu, yuksek kalite: ' + BUTCE_SAHNE.join(', ') + ' medyan <= ' + BUTCE.medyan + ' ms, p95 <= ' + BUTCE.p95 + ' ms', () => {
    const json = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'perf-test-')), 'olcum.json');
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'perfOlc.js'), '--gpu', '--kisma', '4', '--kalite', 'yuksek', '--sahne', BUTCE_SAHNE.join(','), '--json', json],
      { encoding: 'utf8', timeout: 15 * 60 * 1000 });
    assert.ok(fs.existsSync(json), 'perfOlc calismadi: ' + (r.stdout || '').slice(-400) + (r.stderr || '').slice(-400));
    const s = JSON.parse(fs.readFileSync(json, 'utf8')).sonuclar, asim = [];
    s.forEach(x => {
      console.log('       ' + x.sahne.padEnd(16) + ' medyan ' + x.medyan.toFixed(1) + '  p95 ' + x.p95.toFixed(1) + '  >50 ' + x.uzunKare + '  DOM ' + x.domMax);
      if (x.hata) asim.push(x.sahne + ': calisma hatasi');
      if (x.medyan > BUTCE.medyan) asim.push(x.sahne + ' medyan ' + x.medyan.toFixed(1));
      if (x.p95 > BUTCE.p95) asim.push(x.sahne + ' p95 ' + x.p95.toFixed(1));
    });
    assert.strictEqual(s.length, BUTCE_SAHNE.length, 'eksik sahne');
    assert.deepStrictEqual(asim, []);
  });
}

console.log(gecti + ' test gecti' + (atlandi ? ', ' + atlandi + ' atlandi' : '') + (process.exitCode ? ' (HATA var)' : ''));
