// tempoIkinciSansTest.js — Tempo Kup reklamli ikinci sans: TempoCekirdek.ikinciSansSec
// (saf, DOM'suz) ve Oyun.ikinciSansUygula / kayit alani "is".
// Calistirma:  node tools/tempoIkinciSansTest.js
// Denenen:
//   - kayip tahtalarinda (bot oyunlari) ve rastgele dolu tahtalarda: 3 parca, her biri su anki
//     tahtada bir yere sigar, plan sirayla (1., 2., 3.) gecerli, bildirilen hat/dolum dogru
//   - en cok cizgi: tam arama (butun sira ve konumlar) ile karsilastirma + elle kurulmus tahtalar
//   - hic sigmayan aday havuzunda yedek: en kucuk parcalar
//   - tempo carpani (seri, sabir), skor, tahta korunur; kosu basina 1
//   - kayit: "is" yalnizca kullanilinca yazilir, eski kayit (alan yok) = kullanilmadi
//   - normal parca uretimi degismedi (git HEAD'deki tempoCekirdek.js ile ayni tohumda ayni tepsiler)
//   - sure (ms) olculur ve yazilir
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), assert = require('assert');
const KOK = path.join(__dirname, '..');
const C = require(path.join(KOK, 'js', 'tempoCekirdek.js'));
const N = C.N, S = C.SEKILLER;

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + (e && e.stack || e)); process.exitCode = 1; }
}
const kopya = o => JSON.parse(JSON.stringify(o));   // diskten okunmus gibi

// Botla oyunu sonuna kadar oynat (rastgele = kolay kaybeden bot), kayip aninda Oyun'u dondur
function kayipOyun(tohum, rastgele) {
  const o = new C.Oyun(C.rngOlustur(tohum)).basla(), rng = C.rngOlustur(tohum * 31 + 7);
  while (!o.bitti && o.hamle < 4000) {
    let en = null, enV = -Infinity;
    o.kalanlar().forEach(i => {
      const s = S[o.tepsi[i].s];
      for (let r = 0; r + s.h <= N; r++) for (let c = 0; c + s.w <= N; c++) {
        if (!C.sigar(o.b, s, r, c)) continue;
        const v = rastgele ? rng() : C.tahtaPuani(C.uygula(o.b, s, r, c).b) + rng() * 200;
        if (v > enV) { enV = v; en = { i, r, c }; }
      }
    });
    o.oyna(en.i, en.r, en.c);
  }
  return o;
}

// Rastgele dolu tahta (dolu satir/sutun birakmaz: oyunda olusamaz)
function rastgeleTahta(tohum, oran) {
  const rng = C.rngOlustur(tohum), b = C.bosTahta();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (rng() < oran) b[r] |= (1 << c);
  return temizle(b);
}
function temizle(b) {
  const nb = b.slice();
  let sut = 255; for (let i = 0; i < N; i++) sut &= nb[i];
  for (let i = 0; i < N; i++) { if (nb[i] === 255) nb[i] = 0; nb[i] &= ~sut & 255; }
  return nb;
}

// Plan dogrulama: her parca su anki tahtada sigar, sirayla yerlesir, hat/dolum dogru
function planDogrula(b, sonuc) {
  assert.strictEqual(sonuc.set.length, 3, 'set 3 degil');
  sonuc.set.forEach(id => assert.ok(C.herhangiSigar(b, S[id]), 'parca ' + id + ' su anki tahtada sigmiyor'));
  assert.ok(sonuc.plan && sonuc.plan.length === 3, 'plan yok');
  let tb = b, hat = 0, dolum = 0;
  sonuc.plan.forEach((h, k) => {
    assert.strictEqual(h.s, sonuc.set[k], 'plan/set sirasi');
    assert.ok(C.sigar(tb, S[h.s], h.r, h.c), (k + 1) + '. parca sirayla yerlesmiyor');
    const u = C.uygula(tb, S[h.s], h.r, h.c);
    tb = u.b; hat += u.hat; dolum += S[h.s].n;
  });
  assert.strictEqual(sonuc.hat, hat, 'bildirilen hat');
  assert.strictEqual(sonuc.dolum, dolum, 'bildirilen dolum');
}

// Tam arama: butun 3'lu siralar ve konumlar; en iyi (hat*100 + dolum). Ayni tahtaya varan yollar birlesir.
function tamArama(b) {
  const ad = S.filter(s => C.herhangiSigar(b, s));
  let seviye = [{ b, v: 0 }];
  for (let k = 0; k < 2; k++) {
    const m = new Map();
    for (const d of seviye) for (const s of ad) for (let r = 0; r + s.h <= N; r++) for (let c = 0; c + s.w <= N; c++) {
      if (!C.sigar(d.b, s, r, c)) continue;
      const u = C.uygula(d.b, s, r, c), v = d.v + u.hat * 100 + s.n, key = u.b.join(',');
      const e = m.get(key); if (!e || e.v < v) m.set(key, { b: u.b, v });
    }
    seviye = Array.from(m.values());
  }
  let en = -1;
  for (const d of seviye) for (const s of ad) for (let r = 0; r + s.h <= N; r++) for (let c = 0; c + s.w <= N; c++) {
    if (!C.sigar(d.b, s, r, c)) continue;
    const v = d.v + C.hatSay(d.b, s, r, c) * 100 + s.n; if (v > en) en = v;
  }
  return { hat: Math.floor(en / 100), dolum: en % 100 };
}

console.log('Tempo Kup ikinci sans (TempoCekirdek.ikinciSansSec)');

const kayiplar = [];
for (let t = 1; t <= 120; t++) { const o = kayipOyun(t, t % 2 === 0); if (o.bitti) kayiplar.push(o); }
const rastgeleler = [];
for (let t = 1; t <= 60; t++) rastgeleler.push(rastgeleTahta(1000 + t, 0.35 + (t % 6) * 0.08));

const sureler = [];
function olc(b, secenek) {
  const t0 = process.hrtime.bigint();
  const s = C.ikinciSansSec(b, secenek);
  sureler.push(Number(process.hrtime.bigint() - t0) / 1e6);
  return s;
}

dene('kayip tahtalari (' + kayiplar.length + '): oyun gercekten bitti (kalan parcalarin hicbiri sigmiyor)', () => {
  assert.ok(kayiplar.length >= 100, 'kayip tahta sayisi ' + kayiplar.length);
  kayiplar.forEach(o => o.kalanlar().forEach(i => assert.ok(!C.herhangiSigar(o.b, S[o.tepsi[i].s]))));
});

dene('kayip tahtalari: 3 parca, her biri su an sigar, sirayla yerlesir, yedek degil', () => {
  kayiplar.forEach(o => { const s = olc(o.b); assert.ok(!s.yedek, 'yedek'); planDogrula(o.b, s); });
});

dene('rastgele dolu tahtalar (' + rastgeleler.length + ', %35-%75): ayni garantiler', () => {
  rastgeleler.forEach(b => { const s = olc(b); assert.ok(!s.yedek); planDogrula(b, s); });
});

dene('bos tahta: 3 parca sirayla yerlesir', () => { const b = C.bosTahta(); planDogrula(b, olc(b)); });

dene('ikinciSansSec saf: tahtaya dokunmaz, ayni tahtada ayni sonuc', () => {
  const b = kayiplar[3].b.slice(), once = b.slice();
  const a = C.ikinciSansSec(b), c = C.ikinciSansSec(b);
  assert.deepStrictEqual(b, once);
  assert.deepStrictEqual(a, c);
});

dene('en cok cizgi: elle kurulmus tahtalar', () => {
  // 1) satir 0-4 dolu, yalnizca sutun 7 bos (+ alt satirlar karisik): dikey 5'li cubuk 5 hat kapatir
  let b = [127, 127, 127, 127, 127, 0b01010101, 0b00110011, 0b00001111];
  let s = C.ikinciSansSec(b); planDogrula(b, s);
  assert.ok(s.hat >= 5, 'beklenen >= 5 hat, bulunan ' + s.hat);
  // 2) satir 0 ve 1 birer bosluk (sutun 3 ve 5), satir 2 iki bosluk: tek parcalar/cubuklarla 3 hat
  b = [255 & ~(1 << 3), 255 & ~(1 << 5), 255 & ~((1 << 0) | (1 << 1)), 0b10101010, 0b01010101, 0b10101010, 0b01010101, 0b10101010];
  s = C.ikinciSansSec(b); planDogrula(b, s);
  assert.ok(s.hat >= 3, 'beklenen >= 3 hat, bulunan ' + s.hat);
  // 3) dama tahtasi (hicbir hat 1 parcayla kapanmaz): en cok cizgi tam arama ile ayni
  b = [0b10101010, 0b01010101, 0b10101010, 0b01010101, 0b10101010, 0b01010101, 0b10101010, 0b01010101];
  s = C.ikinciSansSec(b); planDogrula(b, s);
  const t = tamArama(b);
  assert.strictEqual(s.hat, t.hat, 'dama: tam arama ' + t.hat + ' hat, bulunan ' + s.hat);
});

dene('en cok cizgi: 30 kayip tahtasinda tam arama ile karsilastirma (hat esit >= %90, hicbirinde 1 hattan fazla eksik yok)', () => {
  let hatEsit = 0, ikisiEsit = 0, eksikHat = [];
  const ornek = kayiplar.slice(0, 30);
  ornek.forEach(o => {
    const s = C.ikinciSansSec(o.b), t = tamArama(o.b);
    assert.ok(s.hat <= t.hat, 'tam aramadan fazla hat olamaz');
    if (s.hat === t.hat) { hatEsit++; if (s.dolum === t.dolum) ikisiEsit++; }
    else eksikHat.push(t.hat - s.hat);
  });
  console.log('       tam arama ile hat esit ' + hatEsit + '/' + ornek.length + ', hat+dolum esit ' + ikisiEsit + '/' + ornek.length +
    (eksikHat.length ? ', eksik hat: ' + eksikHat.join(' ') : ''));
  assert.ok(hatEsit >= Math.ceil(ornek.length * 0.9), 'hat esit ' + hatEsit);
  assert.ok(eksikHat.every(x => x <= 1), 'eksik ' + eksikHat.join(','));
});

dene('hic sigmayan aday havuzu: yedek = tahtaya sigan en kucuk parcalar', () => {
  // ust uste bindirilmis dama: 3x3 kare ve 5'li cubuk hicbir yere sigmaz
  const b = [0b10101010, 0b01010101, 0b10101010, 0b01010101, 0b10101010, 0b01010101, 0b10101010, 0b01010101];
  const buyuk = S.filter(s => s.aile === 'kare3' || s.aile === 'cubuk5').map(s => s.id);
  buyuk.forEach(id => assert.ok(!C.herhangiSigar(b, S[id])));
  const s = C.ikinciSansSec(b, { adaylar: buyuk });
  assert.strictEqual(s.yedek, true);
  assert.strictEqual(s.plan, null);
  assert.strictEqual(s.set.length, 3);
  const enKucuk = Math.min.apply(null, S.filter(x => C.herhangiSigar(b, x)).map(x => x.n));
  s.set.forEach(id => { assert.ok(C.herhangiSigar(b, S[id]), 'yedek parca sigmiyor'); assert.strictEqual(S[id].n, enKucuk, 'yedek en kucuk degil: ' + S[id].n); });
  // kayip tahtasinda ayni durum
  const o = kayiplar.find(x => buyuk.every(id => !C.herhangiSigar(x.b, S[id])));
  if (o) {
    const y = C.ikinciSansSec(o.b, { adaylar: buyuk });
    assert.ok(y.yedek && y.set.every(id => S[id].n === 1 && C.herhangiSigar(o.b, S[id])));
  }
});

dene('Oyun.ikinciSansUygula: tempo carpani (seri, sabir), skor, tahta korunur; tepsi yenilenir; kosu basina 1', () => {
  let sinanan = 0;
  kayiplar.slice(0, 40).forEach((o, k) => {
    // carpani yuksek bir kayip benzet (seri 2..5, sabir hakki icinde)
    o.seri = 2 + (k % 4); o.sabir = C.sabirHakki(o.carpan());
    const once = { b: o.b.slice(), skor: o.skor, seri: o.seri, sabir: o.sabir, carpan: o.carpan(), hamle: o.hamle, u: JSON.stringify(o.uretec.durum()) };
    const sec = o.ikinciSansUygula();
    assert.ok(sec && sec.set.length === 3);
    assert.deepStrictEqual(o.b, once.b);
    assert.strictEqual(o.skor, once.skor); assert.strictEqual(o.seri, once.seri); assert.strictEqual(o.sabir, once.sabir);
    assert.strictEqual(o.carpan(), once.carpan); assert.strictEqual(o.hamle, once.hamle);
    assert.strictEqual(JSON.stringify(o.uretec.durum()), once.u, 'normal uretec durumu degismemeli');
    assert.strictEqual(o.bitti, false); assert.strictEqual(o.ikinciSans, true);
    assert.deepStrictEqual(o.tepsi.map(p => p.s), sec.set);
    assert.ok(o.tepsi.every(p => !p.kullanildi && C.herhangiSigar(o.b, S[p.s])));
    assert.strictEqual(o.ikinciSansUygula(), null, 'ikinci kez verilmemeli');
    // planla oynat: ilk hamle korunan seriden devam eder (hat: seri+1, hat yok: seri ayni, sabir-1)
    sec.plan.forEach((h, i) => {
      const e = o.oyna(i, h.r, h.c);
      assert.ok(e, (i + 1) + '. parca konamadi');
      if (i === 0) {
        if (e.hat) { assert.strictEqual(e.seri, once.seri + 1, 'seri korunmadi'); assert.ok(e.carpan >= once.carpan); sinanan++; }
        else { assert.strictEqual(e.seri, once.seri, 'seri sifirlandi'); assert.strictEqual(e.sabir, once.sabir - 1); }
      }
    });
  });
  console.log('       ilk hamlesi korunan carpanla hat patlatan kosu: ' + sinanan + '/40');
  assert.ok(sinanan > 0);
});

dene('kayit: "is" yalnizca kullanilinca; JSON gidis-donus; eski kayit (alan yok) = kullanilmadi', () => {
  const o = kayipOyun(5, true);
  const eski = kopya(o.kayit());
  assert.ok(!('is' in eski), 'kullanilmadan is yazilmamali');
  assert.deepStrictEqual(Object.keys(eski), ['b', 't', 'skor', 'seri', 'sabir', 'hamle', 'tam', 'hat', 'u'], 'kayit alanlari degismemeli');
  // kaybedilmis kayit: yukle false doner (eskisi gibi) ama durum yuklenir ve bitti isaretlenir
  const y0 = new C.Oyun();
  assert.strictEqual(y0.yukle(eski), false);
  assert.strictEqual(y0.bitti, true); assert.strictEqual(y0.ikinciSans, false); assert.deepStrictEqual(y0.b, o.b);
  o.ikinciSansUygula();
  const yeni = kopya(o.kayit());
  assert.strictEqual(yeni.is, 1);
  const y1 = new C.Oyun();
  assert.strictEqual(y1.yukle(yeni), true);
  assert.strictEqual(y1.bitti, false); assert.strictEqual(y1.ikinciSans, true);
  assert.strictEqual(y1.ikinciSansUygula(), null, 'yenilemeyle tekrar kullanilamamali');
  // devam eden (bitmemis) eski kayit: eskisi gibi yuklenir
  const d = new C.Oyun(C.rngOlustur(9)).basla(); d.oyna(0, 0, 0) || d.oyna(1, 0, 0) || d.oyna(2, 0, 0);
  const dk = kopya(d.kayit()), y2 = new C.Oyun();
  assert.strictEqual(y2.yukle(dk), true); assert.strictEqual(y2.bitti, false); assert.strictEqual(y2.ikinciSans, false);
  assert.deepStrictEqual(kopya(y2.kayit()), dk);
  // bozuk kayit: false, bitti false (eskisi gibi)
  const y3 = new C.Oyun(); assert.strictEqual(y3.yukle({ b: [1, 2] }), false); assert.strictEqual(y3.bitti, false);
});

dene('normal parca uretimi degismedi (git HEAD tempoCekirdek.js ile ayni tohumlarda ayni tepsiler ve skorlar)', () => {
  let eskiKod;
  try { eskiKod = cp.execFileSync('git', ['show', 'HEAD:js/tempoCekirdek.js'], { cwd: KOK, encoding: 'utf8' }); }
  catch (e) { console.log('       ATLANDI (git yok)'); return; }
  const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tempo-eski-')), 'tempoCekirdek.js');
  fs.writeFileSync(dosya, eskiKod);
  const E = require(dosya);
  function iz(K, tohum) {
    const o = new K.Oyun(K.rngOlustur(tohum)).basla(), out = [o.tepsi.map(p => p.s).join(',')];
    while (!o.bitti && o.hamle < 1500) {
      const plan = o.oneri(2);
      if (!plan.length) break;
      const e = o.oyna(plan[0].i, plan[0].r, plan[0].c);
      if (e.yeniTepsi) out.push(o.tepsi.map(p => p.s).join(','));
    }
    out.push('skor ' + o.skor + ' hamle ' + o.hamle);
    return out;
  }
  for (let t = 1; t <= 6; t++) assert.deepStrictEqual(iz(C, t), iz(E, t), 'tohum ' + t);
  fs.rmSync(path.dirname(dosya), { recursive: true, force: true });
});

dene('sure: ikinciSansSec (ms) — telefon icin bu makinenin ~4-6 kati beklenir', () => {
  const s = sureler.slice().sort((a, b) => a - b), ort = s.reduce((a, b) => a + b, 0) / s.length;
  const p = q => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  console.log('       ' + s.length + ' cagri: ort ' + ort.toFixed(1) + ' ms, p50 ' + p(0.5).toFixed(1) + ', p95 ' + p(0.95).toFixed(1) + ', en cok ' + s[s.length - 1].toFixed(1));
  assert.ok(p(0.95) < 250, 'p95 ' + p(0.95));
});

console.log(gecti + ' test gecti' + (process.exitCode ? ', HATA VAR' : ''));
