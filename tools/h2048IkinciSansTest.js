// h2048IkinciSansTest.js — Hedef 2048 ikinci sans karo secimini (js/hedef2048.js
// "H2048 IKINCI SANS SAF" bolumu) DOM'suz dener. Calistirma:  node tools/h2048IkinciSansTest.js
// hedef2048.js tarayici kodu oldugu icin yalnizca iki isaret arasi kesilip ayri baglamda calisir.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const kaynak = fs.readFileSync(path.join(__dirname, '..', 'js', 'hedef2048.js'), 'utf8');
const BAS = '// ==== H2048 IKINCI SANS SAF BASLANGIC ====', SON = '// ==== H2048 IKINCI SANS SAF SON ====';
const b = kaynak.indexOf(BAS), s = kaynak.indexOf(SON);
if (b < 0 || s < 0) { console.error('hedef2048.js icinde saf bolum bulunamadi'); process.exit(1); }
const ctx = { window: {} };
vm.runInNewContext(kaynak.slice(b, s), ctx);
const { sec, hamleVarMi } = ctx.window.H2048IkinciSans;

let gecti = 0;
function dene(ad, fn) {
  try { fn(); gecti++; console.log('  ok  ' + ad); }
  catch (e) { console.log('  HATA ' + ad + '\n       ' + e.message); process.exitCode = 1; }
}

// tekrarlanabilir rastgele (mulberry32)
function tohum(n) {
  return function () {
    n |= 0; n = (n + 0x6D2B79F5) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Oyundaki placeWalls ile ayni kural: N*N/20 duvar, kose yok, yan yana yok.
function duvarlar(N, rnd) {
  const n = Math.floor(N * N / 20), used = new Set();
  const banned = new Set(['0_0', '0_' + (N - 1), (N - 1) + '_0', (N - 1) + '_' + (N - 1)]);
  let tries = 0;
  while (used.size < n && tries++ < 300) {
    const r = Math.floor(rnd() * N), c = Math.floor(rnd() * N), k = r + '_' + c;
    if (banned.has(k) || used.has(k)) continue;
    if (used.has((r - 1) + '_' + c) || used.has((r + 1) + '_' + c) || used.has(r + '_' + (c - 1)) || used.has(r + '_' + (c + 1))) continue;
    used.add(k);
  }
  return used;
}

// Tam dolu, hamlesi olmayan tahta: komsu esit deger yok. kucukAgirlik: 2/4/8 bolluğu.
function tikaliTahta(N, rnd) {
  const dv = duvarlar(N, rnd), iz = {}, karolar = [];
  let id = 1;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = r + '_' + c;
    if (dv.has(k)) { const t = { id: id++, r, c, value: 0, lock: 0, wild: false, wall: true }; iz[k] = t; karolar.push(t); continue; }
    let v, deneme = 0;
    do {
      const us = rnd() < 0.6 ? 1 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 11);   // cogu 2/4/8
      v = 2 ** us;
    } while (deneme++ < 50 && ((iz[(r - 1) + '_' + c] && iz[(r - 1) + '_' + c].value === v) || (iz[r + '_' + (c - 1)] && iz[r + '_' + (c - 1)].value === v)));
    const t = { id: id++, r, c, value: v, lock: 0, wild: false };
    iz[k] = t; karolar.push(t);
  }
  return karolar;
}

const aday = t => !t.wall && !t.wild && t.value > 0;
const minCift = l => { let m = Infinity; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) m = Math.min(m, Math.abs(l[i].r - l[j].r) + Math.abs(l[i].c - l[j].c)); return m; };

console.log('2048 ikinci sans karo secimi');

dene('rastgele tam dolu tikali tahtalar (5x5..10x10, 3000 adet): kurallar', () => {
  let n = 0;
  for (let tur = 0; tur < 3000; tur++) {
    const rnd = tohum(tur + 1), N = 5 + (tur % 6);
    const k = tikaliTahta(N, rnd);
    if (hamleVarMi(k, N)) continue;            // nadiren tikali olmayan uretim: atla
    n++;
    assert.strictEqual(k.length, N * N, 'tahta tam dolu olmali');
    const { sil, hamleVar } = sec(k, N, { rastgele: rnd });
    assert.ok(sil.length >= 1 && sil.length <= 6, 'en fazla 6: ' + sil.length);
    assert.strictEqual(new Set(sil).size, sil.length, 'tekrar yok');
    assert.ok(sil.every(aday), 'duvar/joker silinmez');
    assert.ok(k.filter(t => t.wall).every(t => sil.indexOf(t) < 0), 'duvarlar yerinde');
    const enBuyukSilinen = Math.max(...sil.map(t => t.value));
    k.filter(t => aday(t) && sil.indexOf(t) < 0).forEach(t =>
      assert.ok(t.value >= enBuyukSilinen, 'kucukten buyuge: ' + t.value + ' kaldi, ' + enBuyukSilinen + ' silindi'));
    assert.strictEqual(hamleVar, true, 'sonrasi hamle var');
    assert.ok(hamleVarMi(k.filter(t => sil.indexOf(t) < 0), N), 'bagimsiz denetim: hamle var');
  }
  assert.ok(n > 2500, 'yeterli tikali tahta denendi: ' + n);
});

dene('once 2ler, sonra 4ler, gerekirse 8ler', () => {
  // 5x5: 3 tane 2, 2 tane 4, 4 tane 8, gerisi buyuk (komsu esit yok)
  const N = 5, deg = [
    [2, 16, 8, 32, 2],
    [16, 4, 32, 8, 16],
    [8, 32, 64, 32, 8],
    [32, 16, 4, 16, 32],
    [2, 64, 16, 64, 128]];
  let id = 1; const k = [];
  deg.forEach((sat, r) => sat.forEach((v, c) => k.push({ id: id++, r, c, value: v, lock: 0, wild: false })));
  assert.strictEqual(hamleVarMi(k, N), false);
  const { sil } = sec(k, N, { rastgele: tohum(7) });
  const say = v => sil.filter(t => t.value === v).length;
  assert.deepStrictEqual([sil.length, say(2), say(4), say(8)], [6, 3, 2, 1]);
});

dene('6dan az aday: hepsi silinir, duvar ve joker korunur', () => {
  // 3x3: duvarlar (0,1),(1,0); joker (2,2); 5 normal karo, (2,1) bos
  const k = [
    { id: 1, r: 0, c: 0, value: 2, lock: 0 }, { id: 2, r: 0, c: 1, value: 0, wall: true, lock: 0 }, { id: 3, r: 0, c: 2, value: 4, lock: 0 },
    { id: 4, r: 1, c: 0, value: 0, wall: true, lock: 0 }, { id: 5, r: 1, c: 1, value: 8, lock: 0 }, { id: 6, r: 1, c: 2, value: 16, lock: 0 },
    { id: 7, r: 2, c: 0, value: 32, lock: 0 }, { id: 9, r: 2, c: 2, value: 0, wild: true, lock: 0 }];
  const { sil, hamleVar } = sec(k, 3, { rastgele: tohum(3) });
  assert.strictEqual(sil.map(t => t.id).sort((a, b) => a - b).join(','), '1,3,5,6,7');
  assert.strictEqual(hamleVar, true);
});

dene('hicbir silme hamle acamiyorsa hamleVar:false doner (oyun eski kayip akisina gider)', () => {
  // joker (0,0) iki duvarla cevrili; butun normal karolar silinse de joker kayamaz
  const k = [
    { id: 1, r: 0, c: 0, value: 0, wild: true, lock: 0 }, { id: 2, r: 0, c: 1, value: 0, wall: true, lock: 0 }, { id: 3, r: 0, c: 2, value: 2, lock: 0 },
    { id: 4, r: 1, c: 0, value: 0, wall: true, lock: 0 }, { id: 5, r: 1, c: 1, value: 4, lock: 0 }, { id: 6, r: 1, c: 2, value: 8, lock: 0 },
    { id: 7, r: 2, c: 0, value: 16, lock: 0 }, { id: 8, r: 2, c: 1, value: 32, lock: 0 }, { id: 9, r: 2, c: 2, value: 64, lock: 0 }];
  const { sil, hamleVar } = sec(k, 3, { rastgele: tohum(3) });
  assert.strictEqual(sil.length, 6);
  assert.ok(!sil.some(t => t.wall || t.wild));
  assert.strictEqual(hamleVar, false);
});

dene('esit degerlerde dagik secim (secilen 2lerin en yakin cifti uzak)', () => {
  // 8x8 dama tahtasi: 32 tane 2 ve 32 tane 4 (komsu esit yok). 6 tane 2 secilir.
  const N = 8; let id = 1; const k = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) k.push({ id: id++, r, c, value: (r + c) % 2 ? 4 : 2, lock: 0, wild: false });
  let enKotu = Infinity, toplamS = 0, toplamR = 0;
  for (let t = 0; t < 300; t++) {
    const rnd = tohum(100 + t);
    const { sil } = sec(k, N, { rastgele: rnd });
    assert.ok(sil.every(x => x.value === 2));
    const m = minCift(sil); enKotu = Math.min(enKotu, m); toplamS += m;
    // karsilastirma: ayni 2lerden duz rastgele 6 tane
    const ikiler = k.filter(x => x.value === 2).slice();
    for (let i = ikiler.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ikiler[i], ikiler[j]] = [ikiler[j], ikiler[i]]; }
    toplamR += minCift(ikiler.slice(0, 6));
  }
  assert.ok(enKotu >= 4, 'en yakin cift en az 4 olmali, bulunan ' + enKotu);
  assert.ok(toplamS / 300 > toplamR / 300 + 1, 'dagik secim duz rastgeleden belirgin uzak: ' + (toplamS / 300).toFixed(2) + ' / ' + (toplamR / 300).toFixed(2));
});

dene('esitlikte rastgele: farkli tohumlar farkli secim verebilir', () => {
  const N = 8; let id = 1; const k = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) k.push({ id: id++, r, c, value: (r + c) % 2 ? 4 : 2, lock: 0, wild: false });
  const imzalar = new Set();
  for (let t = 0; t < 40; t++) imzalar.add(sec(k, N, { rastgele: tohum(t + 1) }).sil.map(x => x.id).sort((a, b) => a - b).join(','));
  assert.ok(imzalar.size > 5, 'cesit: ' + imzalar.size);
});

dene('silme sonrasi hamle yoksa bir karo daha silinir', () => {
  // 4x4, tek 2 kosede (0,0) ve iki komsusu duvar: tek basina silinirse hicbir karo kayamaz.
  // adet=1 ile sinanir: secim 2 karoya cikmali ve hamle acilmali.
  const N = 4, deg = [
    [2, 'X', 8, 16],
    ['X', 16, 32, 64],
    [8, 32, 64, 128],
    [16, 64, 128, 256]];
  let id = 1; const k = [];
  deg.forEach((sat, r) => sat.forEach((v, c) => k.push(v === 'X'
    ? { id: id++, r, c, value: 0, lock: 0, wild: false, wall: true }
    : { id: id++, r, c, value: v, lock: 0, wild: false })));
  assert.strictEqual(hamleVarMi(k, N), false);
  assert.strictEqual(hamleVarMi(k.filter(t => t.id !== 1), N), false, 'kurgu: yalniz 2 silinince hamle yok');
  const { sil, hamleVar } = sec(k, N, { adet: 1, rastgele: tohum(5) });
  assert.strictEqual(sil.length, 2);
  assert.strictEqual(sil[0].value, 2);
  assert.strictEqual(sil[1].value, 8, 'ek karo hamle acan en kucuk aday');
  assert.strictEqual(hamleVar, true);
});

dene('hamleVarMi: kilitli karo hareket etmez, joker her degerle birlesir', () => {
  const tek = (v, o) => Object.assign({ id: 1, r: 0, c: 0, value: v, lock: 0, wild: false }, o || {});
  // 1x2: kilitli + bos -> hamle yok; normal + bos -> var
  assert.strictEqual(hamleVarMi([tek(2, { lock: 2 })], 2), false);
  assert.strictEqual(hamleVarMi([tek(2)], 2), true);
  // 1x2 dolu: 2 ve joker -> var; joker ve joker -> yok
  const sag = (v, o) => Object.assign({ id: 2, r: 0, c: 1, value: v, lock: 0, wild: false }, o || {});
  const iki = (a, c) => hamleVarMi([a, c], 2) || hamleVarMi([a, c, { id: 3, r: 1, c: 0, value: 0, wall: true }, { id: 4, r: 1, c: 1, value: 0, wall: true }], 2);
  assert.strictEqual(iki(tek(2), sag(0, { wild: true })), true);
  assert.strictEqual(hamleVarMi([tek(0, { wild: true }), sag(0, { wild: true }), { id: 3, r: 1, c: 0, value: 0, wall: true }, { id: 4, r: 1, c: 1, value: 0, wall: true }], 2), false);
});

dene('girdi degismez (karo nesneleri yerinde kalir)', () => {
  const rnd = tohum(42), k = tikaliTahta(6, rnd), once = JSON.stringify(k);
  sec(k, 6, { rastgele: rnd });
  assert.strictEqual(JSON.stringify(k), once);
});

console.log(gecti + ' deneme gecti' + (process.exitCode ? ', HATA VAR' : ''));
