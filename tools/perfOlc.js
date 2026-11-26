// perfOlc.js — sahne bazli performans olcumu (docs/gorev-performans-efekt-suzul.md FAZ 1.1). Yalniz olcer; test degildir
// (esik yok, cikis kodu yalniz calisma hatasinda 1). GERCEK index.html + style.css + js/ headless Chrome'da, kendi yerel
// http sunucusu uzerinden (127.0.0.1: yerel adres kancalari acik). Telefon gorunumu 390x844 (mobil, dokunma), CPU kisma
// (Emulation.setCPUThrottlingRate) her sahne icin ayri ayri. Harici npm paketi yok (Node 22+ yerlesik WebSocket / fetch).
//
// Kullanim:
//   node tools/perfOlc.js                                  (tum sahneler, kisma 4x ve 6x)
//   node tools/perfOlc.js --kisma 4 --sahne market-liste,tempo-temizle
//   node tools/perfOlc.js --json olcum.json                (sonuclari JSON'a da yaz)
//   node tools/perfOlc.js --liste                          (sahne adlarini yaz, cik)
//   Diger: --tohum 12345 (Math.random ve Suzul tohumu), --dpr 3 (deviceScaleFactor), --port 9481 (CDP), --gorunur (headless degil),
//          --gpu (--disable-gpu verilmez; Chrome'un kendi GPU/SwiftShader yolu),
//          --kalite yuksek|orta|dusuk (adrese ?kalite=... eklenir: js/kalite.js seviyesi zorlanir, yalniz yerel adreste gecerli;
//          verilmezse otomatik/varsayilan seviye),
//          --tekrar 3 (her sahne N kez; tabloda her sayinin ORTANCASI. Sure olculeri kosudan kosuya %30-45 oynar:
//          once/sonra karsilastirmasi icin >= 3 onerilir; adimlar ve sayimlar (hamle, hat, DOM) tohumla birebir aynidir)
//
// Her sahne: temiz depolama + sayfanin yeniden yuklenmesi -> hazirlik (kismasiz) -> kisma acilir -> ayni adim dizisi
// (sabit tohum, sabit bekleme sureleri) -> olcum. Olculenler:
//   kare medyan / p95 (ms): sayfaya enjekte edilen rAF zaman damgasi toplayicisi (ardisik kare farki)
//   >50 kare: 50 ms'den uzun kare sayisi; uzun gorev: PerformanceObserver('longtask') (>50 ms) sayisi ve toplam ms
//   recalc / layout: Performance.getMetrics farki (RecalcStyleCount/Duration, LayoutCount/Duration); betik: ScriptDuration farki
//   DOM: belgedeki eleman sayisi (olcum boyunca ornekleyerek en buyugu)
//   yigin: JSHeapUsedSize farki (olcum basinda HeapProfiler.collectGarbage, sonda GC yok: GC baskisinin gostergesi)
// Notlar: servis calisani bu sunucuda 404 (kurulum/onbellek isi olcume karismasin). Tarih (Date) sabitlenmez: market
// "gunun seckisi" gune gore degisebilir. --disable-gpu: cizim yazilimla (rasterlama ana is parcacigi disinda) yapilir;
// sayilar gercek telefonla birebir degil, once/sonra karsilastirmasi icindir.
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const KOK = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------
// PARAMETRELER
// ---------------------------------------------------------------
function argOku() {
  const a = process.argv.slice(2), o = { kisma: [4, 6], sahne: null, json: null, tohum: 12345, dpr: 3, port: 9481, liste: false, gorunur: false, gpu: false, tekrar: 1, kalite: null };
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = a[i + 1];
    if (k === '--kisma') { o.kisma = v.split(',').map(Number).filter(n => n >= 1); i++; }
    else if (k === '--sahne') { o.sahne = v.split(',').map(s => s.trim()).filter(Boolean); i++; }
    else if (k === '--json') { o.json = v; i++; }
    else if (k === '--tohum') { o.tohum = Number(v) >>> 0; i++; }
    else if (k === '--dpr') { o.dpr = Number(v); i++; }
    else if (k === '--port') { o.port = Number(v); i++; }
    else if (k === '--liste') o.liste = true;
    else if (k === '--gorunur') o.gorunur = true;
    else if (k === '--gpu') o.gpu = true;
    else if (k === '--tekrar') { o.tekrar = Math.max(1, Number(v) | 0); i++; }
    else if (k === '--kalite') { if (!/^(yuksek|orta|dusuk)$/.test(v || '')) throw new Error('--kalite yuksek|orta|dusuk'); o.kalite = v; i++; }
    else throw new Error('bilinmeyen parametre: ' + k);
  }
  return o;
}

function chromeBul() {
  const adaylar = [process.env.CHROME_YOL, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return adaylar.find(a => fs.existsSync(a)) || null;
}

const TUR = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
              '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function sunucu() {
  return http.createServer((istek, yanit) => {
    let yol = decodeURIComponent(istek.url.split('?')[0]); if (yol === '/') yol = '/index.html';
    const dosya = path.join(KOK, path.normalize(yol).replace(/^([\\/])+/, ''));
    // servis calisani yok: kurulumdaki toplu indirme / onbellek olcume karismasin
    if (yol === '/sw.js' || !dosya.startsWith(KOK) || !fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) { yanit.writeHead(404); yanit.end(); return; }
    yanit.writeHead(200, { 'Content-Type': TUR[path.extname(dosya)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    yanit.end(fs.readFileSync(dosya));
  });
}

// ---------------------------------------------------------------
// SAYFAYA ENJEKTE EDILEN BETIK (her belgede, sayfa betiklerinden ONCE)
//   - Math.random: sabit tohumlu (mulberry32) -> ayni adim dizisi ayni oyunu verir
//   - __perf: rAF kare toplayici + longtask sayaci + DOM ornekleyici
//   - Suzul kancasi (yalniz olcum): AtesBocegi.oyunOlustur sarilir; __bas {mesafe, puan} ve sabit __tohum ile baslar,
//     durum window.__durum'da (tools/atesBocegiBolgeTest.js ile ayni yontem)
// ---------------------------------------------------------------
function enjekte(tohum) {
  return `(function(){
  var s = ${tohum} >>> 0;
  Math.random = function(){ s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  var P = window.__perf = { acik: false, kareler: [], son: 0, uzun: 0, uzunMs: 0, domMax: 0, sayac: 0,
    basla: function(){
      P.kareler = []; P.son = 0; P.uzun = 0; P.uzunMs = 0; P.sayac = 0; P.acik = true;
      P.domMax = document.getElementsByTagName('*').length;
      requestAnimationFrame(function f(t){
        if (!P.acik) return;
        if (P.son) P.kareler.push(t - P.son);
        P.son = t;
        if (++P.sayac % 20 === 0) { var n = document.getElementsByTagName('*').length; if (n > P.domMax) P.domMax = n; }
        requestAnimationFrame(f);
      });
      return 1;
    },
    bitir: function(){
      P.acik = false;
      var n = document.getElementsByTagName('*').length; if (n > P.domMax) P.domMax = n;
      var k = P.kareler.slice().sort(function(a, b){ return a - b; }), L = k.length;
      var yuzde = function(p){ return L ? k[Math.min(L - 1, Math.floor(p * L))] : 0; };
      var top = 0, uzunKare = 0; for (var i = 0; i < L; i++) { top += k[i]; if (k[i] > 50) uzunKare++; }
      return { kare: L, medyan: yuzde(0.5), p95: yuzde(0.95), enKotu: L ? k[L - 1] : 0, ort: L ? top / L : 0, uzunKare: uzunKare,
               uzunGorev: P.uzun, uzunGorevMs: P.uzunMs, domMax: P.domMax, domSon: n };
    } };
  try {
    new PerformanceObserver(function(l){ if (!P.acik) return; l.getEntries().forEach(function(e){ P.uzun++; P.uzunMs += e.duration; }); })
      .observe({ type: 'longtask', buffered: false });
  } catch (e) { /* longtask desteklenmiyor */ }
  window.__tohum = ${tohum} >>> 0;
  var ab;
  Object.defineProperty(window, 'AtesBocegi', { configurable: true, get: function(){ return ab; }, set: function(v){
    ab = v; var o = v.oyunOlustur;
    v.oyunOlustur = function(t){ window.__durum = o(window.__tohum, window.__bas); return window.__durum; };
  } });
})();`;
}

// ---------------------------------------------------------------
// SAHNELER — hazirla (kismasiz) / eylem (kismali, olculur). Bekleme sureleri sabit.
// ---------------------------------------------------------------
const OYUN_HAZIR = { tempo: 'window.TempoKup', h2048: 'window.Game2048', kacis: 'window.KacisMod', susirala: 'window.SuSiralaOyun', ates: 'window.AtesBocegiOyun' };

// Tempo Kup: tahtayi ve tepsiyi DOM'dan okur, en cok hat temizleyen konumu secer (yalniz olcum botu; oyun kodu degismez).
// Parmak noktasi tempoKup.js hayaletKonumu'nun tersidir (AYAR.surukle: kazanc 1.08, kaldirDokunma 38).
const TEMPO_BOT = `window.__tempoBot = function(){
  var hc = document.querySelectorAll('#tpBoard .tp-cell'), N = Math.round(Math.sqrt(hc.length)), dolu = [], i;
  for (i = 0; i < hc.length; i++) dolu.push(hc[i].classList.contains('filled'));
  var a = hc[0].getBoundingClientRect(), b = hc[1].getBoundingClientRect(), m = { sol: a.left, ust: a.top, adim: b.left - a.left, boy: a.width };
  var yuvalar = document.querySelectorAll('#tpTray .tp-slot'), en = null;
  for (var y = 0; y < yuvalar.length; y++) {
    var pe = yuvalar[y].querySelector('.tp-piece:not(.used)'); if (!pe) continue;
    var hs = [].map.call(pe.querySelectorAll('i.tp-blok'), function(e){ return [Number(e.style.gridRow) - 1, Number(e.style.gridColumn) - 1]; });
    var sw = 0, sh = 0; hs.forEach(function(h){ sh = Math.max(sh, h[0] + 1); sw = Math.max(sw, h[1] + 1); });
    for (var r = 0; r + sh <= N; r++) for (var c = 0; c + sw <= N; c++) {
      var ok = hs.every(function(h){ return !dolu[(r + h[0]) * N + c + h[1]]; }); if (!ok) continue;
      var d = dolu.slice(); hs.forEach(function(h){ d[(r + h[0]) * N + c + h[1]] = true; });
      var hat = 0, rr, cc, tam;
      for (rr = 0; rr < N; rr++) { tam = true; for (cc = 0; cc < N; cc++) if (!d[rr * N + cc]) tam = false; if (tam) hat++; }
      for (cc = 0; cc < N; cc++) { tam = true; for (rr = 0; rr < N; rr++) if (!d[rr * N + cc]) tam = false; if (tam) hat++; }
      var temas = 0; hs.forEach(function(h){ var R = r + h[0], C = c + h[1];
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(v){ var R2 = R + v[0], C2 = C + v[1];
          if (R2 < 0 || R2 >= N || C2 < 0 || C2 >= N || dolu[R2 * N + C2]) temas++; }); });
      var puan = hat * 1000 + temas;
      if (!en || puan > en.puan) en = { puan: puan, hat: hat, yuva: y, r: r, c: c, sw: sw, sh: sh, pe: pe };
    }
  }
  if (!en) return null;
  var pr = en.pe.getBoundingClientRect(), x0 = pr.left + pr.width / 2, y0 = pr.top + pr.height / 2;
  var w = en.sw * m.adim - (m.adim - m.boy), h = en.sh * m.adim - (m.adim - m.boy);
  var gx = m.sol + en.c * m.adim, gy = m.ust + en.r * m.adim;
  return { hat: en.hat, x0: x0, y0: y0, x: x0 + (gx + w / 2 - x0) / 1.08, y: y0 + (gy + h + 38 - y0) / 1.08 };
};
window.__tempoParca = function(i){ var y = document.querySelectorAll('#tpTray .tp-slot')[i], pe = y && y.querySelector('.tp-piece:not(.used)');
  if (!pe) return null; var r = pe.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
window.__tempoTahta = function(){ var r = document.getElementById('tpBoard').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
1`;

// Kacis: cikabilecek yilan (bas hucresinin onunde, kendi yonunde baska / kendi parcasi yok). Yalniz olcum botu.
const KACIS_BOT = `window.__kacisSec = function(atla){
  var els = [].slice.call(document.querySelectorAll('.kc-snake')), gr = {};
  els.forEach(function(e){ (gr[e.dataset.id] = gr[e.dataset.id] || []).push(e); });
  var kut = function(e){ var l = parseFloat(e.style.left), t = parseFloat(e.style.top); return { l: l, t: t, r: l + parseFloat(e.style.width), b: t + parseFloat(e.style.height) }; };
  var idler = Object.keys(gr).sort(), hero = null;
  for (var k = 0; k < idler.length; k++) {
    var id = idler[k]; if (atla[id]) continue;
    var g = gr[id], bas = g[g.length - 1], dir = bas.dataset.dir, B = kut(bas), engel = false;
    if (id === 'green') hero = id;
    for (var j = 0; j < els.length && !engel; j++) {
      var e = els[j]; if (e === bas || atla[e.dataset.id]) continue;
      var K = kut(e), cy = (K.t + K.b) / 2, cx = (K.l + K.r) / 2;
      if (dir === 'right') engel = cy > B.t && cy < B.b && K.l >= B.r - 1;
      else if (dir === 'left') engel = cy > B.t && cy < B.b && K.r <= B.l + 1;
      else if (dir === 'down') engel = cx > B.l && cx < B.r && K.t >= B.b - 1;
      else engel = cx > B.l && cx < B.r && K.b <= B.t + 1;
    }
    if (!engel) return id;
  }
  return null;
};
window.__kacisDokun = function(id){ var g = document.querySelectorAll('.kc-snake[data-id="' + id + '"]'); if (!g.length) return 0; g[g.length - 1].click(); return 1; };
1`;

// Suzul olcum denetleyicisi (rAF): isik/zemin korumasi; mod 'kontrol' = bas/birak ile y 45-55 araliginda,
// 'sabit' = bocek y 47'de (atesBocegiBolgeTest gorsel asamasi gibi). bomba: her 1,2 sn onune bomba, yaklasinca dokunulmazlik kalkar
// (patlama gercekten olur, isik her karede 1'e doner). orumcek: her 1 sn isik cemberine giren iki salinan engel.
const SUZUL_DENETCI = `window.__suzul = function(mod, ek){
  var t = document.getElementById('abTuval'), basili = false, son = 0, sayi = 0;
  var bas = function(b){ if (b === basili) return; basili = b;
    t.dispatchEvent(new PointerEvent(b ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'touch' })); };
  window.__suzulAcik = true; window.__suzulSayi = 0;
  requestAnimationFrame(function f(zaman){
    if (!window.__suzulAcik) { bas(false); return; }
    var d = window.__durum;
    if (d && !d.bitti) {
      d.isik = 1; d.zeminKoruma = 1;
      if (mod === 'sabit') { d.y = 47; d.vy = 0; d.ay = 0; } else { if (d.y > 55) bas(true); else if (d.y < 45) bas(false); }
      var s = d.dilimler[d.dilimler.length - 1], yakin = false;
      if (ek === 'bomba') {
        if (zaman - son > 1200) { son = zaman; s.bomba = { x: d.mesafe + ${8} + 14, y: 47, alindi: 0 }; window.__suzulSayi++; }
        d.dilimler.forEach(function(q){ var b = q.bomba; if (b && !b.alindi && b.x - d.mesafe - 8 < 4 && b.x - d.mesafe - 8 > -3) yakin = true; });
        d.dokunulmaz = yakin ? 0 : 1;
      } else {
        d.dokunulmaz = 1;
        if (ek === 'orumcek' && zaman - son > 1000) { son = zaman;
          s.engeller.push({ tur: 'salinan', yon: 'ust', x: d.mesafe + 40, y: 26, w: 5, h: 6, yc: 26, gen: 3, om: 3, faz: 0 },
                          { tur: 'salinan', yon: 'alt', x: d.mesafe + 46, y: 64, w: 5, h: 6, yc: 64, gen: 3, om: 3, faz: 1 }); window.__suzulSayi += 2; }
      }
    }
    requestAnimationFrame(f);
  });
  return 1;
};
1`;

function sahneler(s) {
  const kartAc = async (kart, oyun) => {
    await s.deger('document.getElementById(' + JSON.stringify(kart) + ').click(), 1');
    await s.bekle(OYUN_HAZIR[oyun], 15000);
    await sleep(900);
  };
  const suzulHazir = (mesafe, puan) => async () => {
    await s.deger('window.__bas = { mesafe: ' + mesafe + ', puan: ' + puan + ' }, 1');
    await kartAc('cardAtes', 'ates');
    await s.bekle('!!window.__durum', 10000);
    await s.deger(SUZUL_DENETCI);
    await s.deger('AtesBocegiOyun.start(), 1');
    await sleep(300);
  };
  const suzulEylem = (mod, ek) => async () => {
    await s.deger('document.getElementById("abTuval").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"})),' +
                  'document.getElementById("abTuval").dispatchEvent(new PointerEvent("pointerup",{bubbles:true,pointerId:1,isPrimary:true,pointerType:"touch"})), 1');
    await s.deger('window.__suzul(' + JSON.stringify(mod) + ',' + JSON.stringify(ek || '') + ')');
    await sleep(7000);
    const d = await s.deger('(function(){var d=window.__durum;window.__suzulAcik=false;return {mesafe:Math.round(d.mesafe),kademe:d.kademe,bitti:d.bitti,eklenen:window.__suzulSayi};})()');
    return d;
  };
  const h2048Hazir = (boyut) => async () => {
    if (boyut !== 5) await s.deger('AppProgress.boards = [5,6,7,8,9,10]; AppProgress.h2048OnMesaj = 1; 1');
    await kartAc('cardHedef2048', 'h2048');
    await s.deger('Game2048.start(' + boyut + '); slideForward("boards2048","game2048"); 1');
    await sleep(800);
  };
  const h2048Eylem = async () => {
    const b = await s.deger('(function(){var r=document.getElementById("board").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
    const YON = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }, SIRA = ['left', 'down', 'right', 'down', 'left', 'down', 'right', 'up'];
    for (let i = 0; i < 48; i++) {
      const [dx, dy] = YON[SIRA[i % SIRA.length]];
      await s.surukle([[b.x - dx * 50, b.y - dy * 50], [b.x - dx * 10, b.y - dy * 10], [b.x + dx * 30, b.y + dy * 30], [b.x + dx * 70, b.y + dy * 70]], 8);
      await sleep(70);
    }
    await sleep(600);
    return await s.deger('Game2048._test ? Game2048._test.durum().score : null').then(skor => ({ skor }));
  };
  return [
    { ad: 'ana', aciklama: 'ana ekran: bekleme + oyun kartlari yatay kaydirma',
      hazirla: async () => {},
      eylem: async () => {
        await sleep(2500);
        const r = await s.deger('(function(){var e=document.getElementById("gamesScroll").getBoundingClientRect();return {x:e.left+e.width/2,y:e.top+e.height/2};})()');
        await s.gonder('Input.synthesizeScrollGesture', { x: r.x, y: r.y, xDistance: -300, yDistance: 0, gestureSourceType: 'touch', speed: 900 });
        await s.gonder('Input.synthesizeScrollGesture', { x: r.x, y: r.y, xDistance: 300, yDistance: 0, gestureSourceType: 'touch', speed: 900 });
        await sleep(1500);
      } },
    { ad: 'market-liste', aciklama: 'Market acilisi (magaza vitrini) + Envanter listesi asagi/yukari kaydirma',
      hazirla: async () => {},
      eylem: async () => {
        await s.deger('document.getElementById("marketRow").click(), 1');
        await sleep(900);
        await s.deger('document.querySelector("#mkUstSekme [data-mod=envanter]").click(), 1');
        await sleep(700);
        const r = await s.deger('(function(){var e=document.getElementById("mkGovde").getBoundingClientRect();return {x:e.left+e.width/2,y:e.top+e.height*0.6};})()');
        for (let i = 0; i < 3; i++) await s.gonder('Input.synthesizeScrollGesture', { x: r.x, y: r.y, yDistance: -700, gestureSourceType: 'touch', speed: 1400 });
        for (let i = 0; i < 3; i++) await s.gonder('Input.synthesizeScrollGesture', { x: r.x, y: r.y, yDistance: 700, gestureSourceType: 'touch', speed: 1400 });
        await sleep(500);
        return { kaydirma: await s.deger('document.getElementById("mkGovde").scrollHeight') };
      } },
    { ad: 'market-onizleme', aciklama: 'Envanter: tum temalar sahipli, 4 kez "Kullan" (tema secimi + liste/onizleme yeniden kurulumu)',
      hazirla: async () => {
        await s.deger('AppMarket.temalar().forEach(function(t){ if(!t.varsayilan && AppProgress.market.s.indexOf(t.id) < 0) AppProgress.market.s.push(t.id); }); 1');
        await s.deger('MarketEkran.ac(), 1'); await sleep(700);
        await s.deger('document.querySelector("#mkUstSekme [data-mod=envanter]").click(), 1'); await sleep(600);
      },
      eylem: async () => {
        let n = 0;
        for (let i = 0; i < 4; i++) {
          n += await s.deger('(function(){var b=document.querySelectorAll("#mkIzgara [data-eylem=sec]")[' + (i * 3) + '] || document.querySelector("#mkIzgara [data-eylem=sec]");if(!b)return 0;b.click();return 1;})()');
          await sleep(1300);
        }
        return { secim: n, kart: await s.deger('document.querySelectorAll("#mkIzgara .mk-kart").length') };
      } },
    { ad: 'market-kacisli', aciklama: 'market-onizleme, once Kacis (normal harita + ozel izgara) ziyaret edilmis oturumda (belge ~7000 oge)',
      hazirla: async () => {
        await s.deger('AppProgress.kacisHearts = {}; for (var i = 1; i <= 40; i++) AppProgress.kacisHearts[i] = 3; AppProgress.unlocked = 40; 1');
        await kartAc('cardKacis', 'kacis');
        await s.deger('document.getElementById("kcModeNormal").click(), 1'); await sleep(900);
        await s.deger('history.back(), 1'); await sleep(700);
        await s.deger('KacisMod.yenile(); document.getElementById("kcModeOzel").click(), 1'); await sleep(900);
        await s.deger('history.back(), 1'); await sleep(700);
        await s.deger('history.back(), 1'); await sleep(900);
        await s.bekle('!document.getElementById("screen-home").classList.contains("offstage")', 5000);
        await s.deger('AppMarket.temalar().forEach(function(t){ if(!t.varsayilan && AppProgress.market.s.indexOf(t.id) < 0) AppProgress.market.s.push(t.id); }); 1');
        await s.deger('MarketEkran.ac(), 1'); await sleep(700);
        await s.deger('document.querySelector("#mkUstSekme [data-mod=envanter]").click(), 1'); await sleep(600);
      },
      eylem: async () => {
        let n = 0;
        for (let i = 0; i < 4; i++) {
          n += await s.deger('(function(){var b=document.querySelectorAll("#mkIzgara [data-eylem=sec]")[' + (i * 3) + '] || document.querySelector("#mkIzgara [data-eylem=sec]");if(!b)return 0;b.click();return 1;})()');
          await sleep(1300);
        }
        return { secim: n, kart: await s.deger('document.querySelectorAll("#mkIzgara .mk-kart").length'), belge: await s.deger('document.getElementsByTagName("*").length') };
      } },
    { ad: 'market-sandik', aciklama: 'Market: 3 kez kutu acma (sonuc karti + konfeti), kapatma',
      hazirla: async () => {
        await s.deger('AppGold.add(99999); MarketEkran.ac(), 1'); await sleep(900);
      },
      eylem: async () => {
        let n = 0;
        for (let i = 0; i < 3; i++) {
          n += await s.deger('(function(){var b=document.querySelector("#mkSandiklar [data-eylem=sandik]");if(!b)return 0;b.click();return 1;})()');
          await sleep(2200);
          await s.deger('(function(){var b=document.querySelector("#mkSonuc [data-eylem=sonucKapat]");if(b)b.click();return 1;})()');
          await sleep(500);
        }
        return { acilan: n };
      } },
    { ad: 'tempo-surukle', aciklama: 'Tempo Kup: 3 parcayi tahta uzerinde gezdirme (hayalet + onizleme), birakmadan geri',
      hazirla: async () => { await kartAc('cardTempo', 'tempo'); await s.deger(TEMPO_BOT); await sleep(500); },
      eylem: async () => {
        const t = await s.deger('__tempoTahta()');
        for (let i = 0; i < 3; i++) {
          const p = await s.deger('__tempoParca(' + i + ')'); if (!p) continue;
          const yol = [[p.x, p.y]];
          for (let k = 1; k <= 40; k++) { const a = k / 40; yol.push([t.l + t.w * (0.15 + 0.7 * Math.abs(Math.sin(a * Math.PI * 1.5))), t.t + t.h * (0.95 - 0.8 * a) + 60]); }
          yol.push([p.x, p.y]);
          await s.surukle(yol, 16);
          await sleep(300);
        }
        await sleep(300);
      } },
    { ad: 'tempo-temizle', aciklama: 'Tempo Kup: bot 12 hamle (en cok hat temizleyen konum), satir/sutun temizleme animasyonlari',
      hazirla: async () => { await kartAc('cardTempo', 'tempo'); await s.deger(TEMPO_BOT); await sleep(500); },
      eylem: async () => {
        let hat = 0, hamle = 0;
        for (let i = 0; i < 12; i++) {
          const b = await s.deger('__tempoBot()'); if (!b) break;
          const yol = []; for (let k = 0; k <= 10; k++) yol.push([b.x0 + (b.x - b.x0) * k / 10, b.y0 + (b.y - b.y0) * k / 10]);
          await s.surukle(yol, 16);
          hat += b.hat; hamle++;
          await sleep(650);
        }
        await sleep(500);
        return { hamle, hat };
      } },
    { ad: 'sirala', aciklama: 'Sirala Dur bolum 40: 10 dokum (kaynak + hedef sise dokunusu, dokum animasyonu)',
      hazirla: async () => {
        await kartAc('cardSuSirala', 'susirala');
        await s.deger('document.getElementById("ssModeNormal").click(), 1'); await sleep(700);
        await s.deger('SuSiralaOyun.bolumBaslat(40); window.__ss = SuSirala.OyunOlustur(40); 1'); await sleep(900);
      },
      eylem: async () => {
        let n = 0;
        for (let i = 0; i < 10; i++) {
          const h = await s.deger('(function(){var L=SuSirala.gecerliHamleler(__ss.durum),s=window.__ssSon;' +
            'for(var i=0;i<L.length;i++){if(!(s&&L[i][0]===s[1]&&L[i][1]===s[0]))return L[i];}return L[0]||null;})()');
          if (!h) break;
          await s.deger('document.querySelector("#ssTahta .ss-tup[data-i=\\"' + h[0] + '\\"]").click(), 1');
          await sleep(150);
          await s.deger('document.querySelector("#ssTahta .ss-tup[data-i=\\"' + h[1] + '\\"]").click(); __ss.dok(' + h[0] + ',' + h[1] + '); window.__ssSon=[' + h[0] + ',' + h[1] + ']; 1');
          n++;
          await sleep(900);
        }
        return { dokum: n };
      } },
    { ad: 'kacis', aciklama: 'Kacis bolum 40: bekleme (orman/yagmur) + 8 cikis dokunusu',
      hazirla: async () => {
        await s.deger('AppProgress.unlocked = 40; 1');
        await kartAc('cardKacis', 'kacis');
        await s.deger('document.getElementById("kcModeNormal").click(), 1'); await sleep(800);
        await s.deger('(document.querySelector(".kc-node-active[data-level=\\"40\\"]") || document.querySelector(".kc-node-active")).click(), 1'); await sleep(1500);
        await s.deger(KACIS_BOT);
      },
      eylem: async () => {
        await sleep(1500);
        const atla = {}; let n = 0;
        for (let i = 0; i < 8; i++) {
          const id = await s.deger('__kacisSec(' + JSON.stringify(atla) + ')'); if (!id) break;
          atla[id] = 1; n += await s.deger('__kacisDokun(' + JSON.stringify(id) + ')');
          await sleep(800);
          if (id === 'green') break;
        }
        await sleep(800);
        return { dokunus: n };
      } },
    { ad: 'h2048-5', aciklama: 'Hedef 2048 5x5: 48 hizli kaydirma (70 ms arayla)', hazirla: h2048Hazir(5), eylem: h2048Eylem },
    { ad: 'h2048-10', aciklama: 'Hedef 2048 10x10: 48 hizli kaydirma (70 ms arayla)', hazirla: h2048Hazir(10), eylem: h2048Eylem },
    { ad: 'suzul-b5', aciklama: 'Karanlikta Suzul Bolge 5 (mesafe 4100), bas/birak denetimi, 7 sn',
      hazirla: suzulHazir(4100, 3000), eylem: suzulEylem('kontrol', '') },
    { ad: 'suzul-bomba', aciklama: 'Suzul Bolge 5: her 1,2 sn bomba ve patlama (bocek y 47), 7 sn',
      hazirla: suzulHazir(4100, 3000), eylem: suzulEylem('sabit', 'bomba') },
    { ad: 'suzul-orumcek', aciklama: 'Suzul mesafe 9000: dogal + her 1 sn iki salinan orumcek (bocek y 47), 7 sn',
      hazirla: suzulHazir(9000, 3000), eylem: suzulEylem('sabit', 'orumcek') }
  ];
}

// ---------------------------------------------------------------
// CDP
// ---------------------------------------------------------------
// Iz (Tracing) olaylari: boyama (ana is parcacigi), rasterlama (raster is parcaciklari; CPU kismasi bunlara UYGULANMAZ,
// --disable-gpu ile yazilim rasterlama: blur/golge/gradyan maliyeti burada gorunur), on boyama + katman (ana is parcacigi).
const IZ_AD = { Paint: 'boya', RasterTask: 'raster', PrePaint: 'katman', Layerize: 'katman', UpdateLayerTree: 'katman', CompositeLayers: 'katman' };
async function baglan(port) {
  let sekmeler;
  for (let i = 0; i < 80; i++) {
    try { sekmeler = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (sekmeler.some(t => t.type === 'page')) break; } catch (e) { /* Chrome henuz acilmadi */ }
    await sleep(250);
  }
  const ws = new WebSocket(sekmeler.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, h) => { ws.onopen = r; ws.onerror = h; });
  let n = 0; const bek = {}, hatalar = [], iz = { toplam: {}, bitti: null };
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (bek[d.id]) { bek[d.id](d); delete bek[d.id]; }
    if (d.method === 'Tracing.dataCollected') {
      for (const e of d.params.value) if (e.ph === 'X' && IZ_AD[e.name]) iz.toplam[IZ_AD[e.name]] = (iz.toplam[IZ_AD[e.name]] || 0) + (e.dur || 0) / 1000;
    }
    if (d.method === 'Tracing.tracingComplete' && iz.bitti) { iz.bitti(); iz.bitti = null; }
    if (d.method === 'Runtime.exceptionThrown') hatalar.push('istisna: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') hatalar.push('console.error: ' + JSON.stringify(d.params.args).slice(0, 300));
  };
  const gonder = (method, params) => new Promise((r, h) => {
    bek[++n] = d => d.error ? h(new Error(method + ': ' + JSON.stringify(d.error))) : r(d.result);
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });
  const deger = async ifade => {
    const r = await gonder('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(ifade.slice(0, 80) + ' -> ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  return { ws, gonder, deger, hatalar, iz };
}

async function metrikler(gonder) {
  const r = await gonder('Performance.getMetrics');
  const o = {}; r.metrics.forEach(m => { o[m.name] = m.value; }); return o;
}

// ---------------------------------------------------------------
// TABLO
// ---------------------------------------------------------------
const SUTUN = [['sahne', 15], ['kisma', 5], ['kare', 5], ['medyan', 7], ['p95', 7], ['>50', 4], ['uzunG', 5], ['uzunMs', 7],
               ['recalc', 6], ['recalcMs', 8], ['layout', 6], ['layoutMs', 8], ['betikMs', 8], ['boyaMs', 7], ['katmanMs', 8], ['rasterMs', 8],
               ['DOM', 6], ['yiginKB', 8]];
function satir(r) {
  const v = [r.sahne, r.kisma + 'x', r.kare, r.medyan.toFixed(1), r.p95.toFixed(1), r.uzunKare, r.uzunGorev, Math.round(r.uzunGorevMs),
             r.recalc, r.recalcMs.toFixed(0), r.layout, r.layoutMs.toFixed(0), r.betikMs.toFixed(0), r.boyaMs.toFixed(0), r.katmanMs.toFixed(0),
             r.rasterMs.toFixed(0), r.domMax, Math.round(r.yiginKB)];
  return v.map((x, i) => String(x).padStart(SUTUN[i][1])).join(' ');
}
function tabloYaz(sonuclar) {
  console.log(SUTUN.map(s => s[0].padStart(s[1])).join(' '));
  sonuclar.forEach(r => console.log(satir(r) + (r.ek ? '  ' + JSON.stringify(r.ek) : '') + (r.hata ? '  HATA ' + r.hata.length : '')));
}

// ---------------------------------------------------------------
// ANA
// ---------------------------------------------------------------
(async () => {
  const o = argOku();
  const adlar = sahneler({}).map(x => x.ad);
  if (o.liste) { sahneler({}).forEach(x => console.log(x.ad.padEnd(16) + x.aciklama)); return; }
  if (o.sahne) { const yok = o.sahne.filter(a => adlar.indexOf(a) < 0); if (yok.length) throw new Error('bilinmeyen sahne: ' + yok.join(', ') + ' (--liste)'); }
  const chrome = chromeBul();
  if (!chrome) { console.log('ATLANDI (Chrome yok): CHROME_YOL ile chrome.exe yolunu verin'); return; }
  const srv = sunucu(); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const koken = 'http://127.0.0.1:' + srv.address().port, adres = koken + '/index.html' + (o.kalite ? '?kalite=' + o.kalite : '');
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-olc-'));
  const c = cp.spawn(chrome, [o.gorunur ? '' : '--headless=new', o.gpu ? '' : '--disable-gpu', '--remote-debugging-port=' + o.port, '--user-data-dir=' + path.join(dizin, 'profil'),
    '--force-color-profile=srgb', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=390,844', 'about:blank'].filter(Boolean), { stdio: 'ignore' });
  const sonuclar = [];
  console.log('perfOlc: 390x844 dpr ' + o.dpr + (o.gpu ? ', gpu' : ', --disable-gpu') + ', kisma ' + o.kisma.map(k => k + 'x').join('/') + ', tohum ' + o.tohum + (o.kalite ? ', kalite ' + o.kalite : '') + ', Chrome ' + path.basename(chrome));
  try {
    const cdp = await baglan(o.port), { gonder, deger } = cdp;
    const s = {
      gonder, deger,
      bekle: async (ifade, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await deger('!!(' + ifade + ')')) return true; await sleep(100); } throw new Error('beklenen olmadi: ' + ifade); },
      // dokunarak surukleme: ilk nokta touchStart, aradakiler touchMove, son noktada touchEnd (her adim arasi `ara` ms)
      surukle: async (noktalar, ara) => {
        const tp = p => [{ x: Math.round(p[0]), y: Math.round(p[1]), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
        await gonder('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(noktalar[0]) });
        for (let i = 1; i < noktalar.length; i++) { await sleep(ara); await gonder('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(noktalar[i]) }); }
        await gonder('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    };
    await gonder('Runtime.enable');
    await gonder('Page.enable');
    await gonder('Performance.enable', { timeDomain: 'threadTicks' }).catch(() => gonder('Performance.enable'));
    await gonder('Page.addScriptToEvaluateOnNewDocument', { source: enjekte(o.tohum) });
    await gonder('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: o.dpr, mobile: true });
    await gonder('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await gonder('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }).catch(() => {});
    const liste = sahneler(s).filter(x => !o.sahne || o.sahne.indexOf(x.ad) >= 0);
    // kalibrasyon: sabit JS dongusu (makineler/kisma arasi karsilastirma icin)
    await gonder('Page.navigate', { url: 'about:blank' }); await sleep(300);
    const kalib = {}, DONGU = '(function(){var t=performance.now(),x=0;for(var i=0;i<3e7;i++)x+=Math.sqrt(i);window.__x=x;return performance.now()-t;})()';
    for (let i = 0; i < 5; i++) await deger(DONGU);                 // JIT isinmasi (yoksa sonraki olcumler yapay hizli cikar)
    for (const k of [1].concat(o.kisma)) {
      await gonder('Emulation.setCPUThrottlingRate', { rate: k });
      const t = []; for (let i = 0; i < 3; i++) t.push(await deger(DONGU));
      kalib[k] = Math.round(t.sort((a, b) => a - b)[1]);           // ucun ortancasi
    }
    await gonder('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log('kalibrasyon (3e7 sqrt dongusu, ms): ' + Object.keys(kalib).map(k => k + 'x ' + kalib[k]).join(', '));
    o.kalibrasyon = kalib;
    for (const kisma of o.kisma) {
      for (const sahne of liste) for (let tk = 0; tk < o.tekrar; tk++) {
        const t0 = Date.now();
        cdp.hatalar.length = 0;
        await gonder('Emulation.setCPUThrottlingRate', { rate: 1 });
        await gonder('Storage.clearDataForOrigin', { origin: koken, storageTypes: 'all' });
        await gonder('Page.navigate', { url: adres });
        await s.bekle('document.readyState === "complete" && !!document.getElementById("cardAtes") && !!window.__perf', 20000);
        await sleep(700);
        let ek = null, hata = null, izAcik = false;
        try {
          await sahne.hazirla();
          await gonder('Emulation.setCPUThrottlingRate', { rate: kisma });
          await sleep(400);
          await gonder('HeapProfiler.collectGarbage').catch(() => {});
          const m0 = await metrikler(gonder);
          cdp.iz.toplam = {}; izAcik = true;
          await gonder('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
          await deger('__perf.basla()');
          ek = await sahne.eylem();
          await sleep(250);
          const f = await deger('__perf.bitir()');
          const m1 = await metrikler(gonder);
          await new Promise(r => { cdp.iz.bitti = r; gonder('Tracing.end'); }); izAcik = false;
          const iz = cdp.iz.toplam;
          const fark = k => (m1[k] || 0) - (m0[k] || 0);
          sonuclar.push(Object.assign({ sahne: sahne.ad, kisma }, f, {
            recalc: fark('RecalcStyleCount'), recalcMs: fark('RecalcStyleDuration') * 1000,
            layout: fark('LayoutCount'), layoutMs: fark('LayoutDuration') * 1000,
            betikMs: fark('ScriptDuration') * 1000, gorevMs: fark('TaskDuration') * 1000,
            yiginKB: fark('JSHeapUsedSize') / 1024, dugum: m1.Nodes,
            boyaMs: iz.boya || 0, rasterMs: iz.raster || 0, katmanMs: iz.katman || 0, ek: ek || undefined,
            hata: cdp.hatalar.length ? cdp.hatalar.slice() : undefined, sureSn: Math.round((Date.now() - t0) / 1000) }));
        } catch (e) {
          hata = e.message;
          if (izAcik) await new Promise(r => { cdp.iz.bitti = r; gonder('Tracing.end').catch(r); setTimeout(r, 5000); });
          sonuclar.push({ sahne: sahne.ad, kisma, kare: 0, medyan: 0, p95: 0, uzunKare: 0, uzunGorev: 0, uzunGorevMs: 0, recalc: 0, recalcMs: 0,
                          layout: 0, layoutMs: 0, betikMs: 0, domMax: 0, yiginKB: 0, boyaMs: 0, rasterMs: 0, katmanMs: 0, hata: [hata].concat(cdp.hatalar) });
          process.exitCode = 1;
        }
        await gonder('Emulation.setCPUThrottlingRate', { rate: 1 });
        console.log(satir(sonuclar[sonuclar.length - 1]) + (sonuclar[sonuclar.length - 1].ek ? '  ' + JSON.stringify(sonuclar[sonuclar.length - 1].ek) : '') +
                    (sonuclar[sonuclar.length - 1].hata ? '  HATA ' + JSON.stringify(sonuclar[sonuclar.length - 1].hata).slice(0, 300) : ''));
      }
    }
    cdp.ws.close();
  } finally {
    try { c.kill(); } catch (e) { /* kapanmis */ }
    srv.close();
    await sleep(300);
    try { fs.rmSync(dizin, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* gecici dizin */ }
  }
  const ham = sonuclar.slice();
  if (o.tekrar > 1) {
    // ayni (sahne, kisma) kosularinin her sayisal alaninin ortancasi; ek ilk kosudan (adimlar ayni tohumla birebir)
    const grup = new Map();
    ham.forEach(r => { const k = r.sahne + '|' + r.kisma; if (!grup.has(k)) grup.set(k, []); grup.get(k).push(r); });
    sonuclar.length = 0;
    grup.forEach(L => {
      const o2 = Object.assign({}, L[0], { tekrar: L.length, hata: L.some(r => r.hata) ? [].concat(...L.map(r => r.hata || [])) : undefined });
      Object.keys(L[0]).forEach(k => {
        if (typeof L[0][k] !== 'number' || k === 'kisma') return;
        const v = L.map(r => r[k]).sort((a, b) => a - b); o2[k] = v[Math.floor(v.length / 2)];
      });
      sonuclar.push(o2);
    });
  }
  console.log('\nOZET' + (o.tekrar > 1 ? ' (' + o.tekrar + ' kosunun ortancasi)' : '') + ' (ms; kare = rAF farki, uzunG = longtask > 50 ms, ' +
              'recalc/layout/betik = Performance.getMetrics farki, boya/katman/raster = iz olaylari toplami, DOM = en cok eleman, yiginKB = GC\'siz JSHeapUsedSize farki)');
  tabloYaz(sonuclar);
  if (o.json) {
    fs.mkdirSync(path.dirname(path.resolve(o.json)), { recursive: true });
    fs.writeFileSync(o.json, JSON.stringify({ tarih: new Date().toISOString(), ayar: { kisma: o.kisma, tohum: o.tohum, dpr: o.dpr, ekran: '390x844', kalibrasyonMs: o.kalibrasyon, tekrar: o.tekrar, gpu: o.gpu, kalite: o.kalite },
      sonuclar, ham: o.tekrar > 1 ? ham : undefined }, null, 2));
    console.log('JSON: ' + path.resolve(o.json));
  }
})().catch(e => { console.log('HATA ' + e.stack); process.exitCode = 1; });
