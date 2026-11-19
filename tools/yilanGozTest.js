// yilanGozTest.js — Kacis yilan gozu / govde ayrismasi (Lav, Murekkep zorunlu; digerleri bilgi).
// Calistirma:  node tools/yilanGozTest.js
// Olcutler (WCAG goreli parlaklik orani):
//  1) goz (style.css .kc-eye arka plani) / her govde rengi  >= 3:1   (govde + hedef/kahraman)
//  2) govde rengi / kendi konturu                            >= 1.6:1 (yilan siluetinde kaybolmasin)
//  3) KOYU govde rengi (L < 0.1) / Kacis tahta zemini (yesil gradyan + .kc-frame beyaz katmani; en koyu uc) >= 1.6:1
// Gozbebegi (.kc-eye::after) beyaz diskin icinde oldugundan govdeyle temas etmez, olcume girmez.
'use strict';
const fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(KOK, 'style.css'), 'utf8');
const kat = fs.readFileSync(path.join(KOK, 'js', 'marketKatalog.js'), 'utf8');
const kutu = {};
new Function('window', kat)(kutu);
const TEMALAR = kutu.AppMarketKatalog.TEMALAR;

const ZORUNLU = ['lav', 'murekkep'];
const ESIK_GOZ = 3, ESIK_AYRIM = 1.6, KOYU_L = 0.1;

const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const oran = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---- kaynaktan okunanlar ----
const gozM = /\.kc-eye\{[^}]*background:\s*(#[0-9A-Fa-f]{3,6})/.exec(css);
if (!gozM) { console.log('HATA style.css .kc-eye arka plani bulunamadi'); process.exit(1); }
const GOZ = rgb(gozM[1]);
const ekranM = /#screen-kacis-level1\{[^}]*linear-gradient\(180deg,\s*(#[0-9A-Fa-f]{6})\s*0%,\s*(#[0-9A-Fa-f]{6})\s*100%\)/.exec(css);
const frameM = /\.kc-frame\{[^}]*background:\s*rgba\(255,255,255,\s*([0-9.]+)\)/.exec(css);
if (!ekranM || !frameM) { console.log('HATA Kacis tahta zemini style.css icinde bulunamadi'); process.exit(1); }
const a = +frameM[1];
const zemin = [ekranM[1], ekranM[2]].map(h => rgb(h).map(v => v * (1 - a) + 255 * a));   // [ust (koyu), alt (acik)]
const zeminKoyu = zemin.reduce((p, c) => lum(c) < lum(p) ? c : p);

let hata = 0, bilgi = 0;
function kontrol(tema, parca, renkler, kontur) {
  const zorunlu = ZORUNLU.indexOf(tema.id) >= 0;
  renkler.forEach(h => {
    const c = rgb(h), g = oran(c, GOZ), k = oran(c, rgb(kontur)), z = oran(c, zeminKoyu), koyu = lum(c) < KOYU_L;
    const sorunlar = [];
    if (g < ESIK_GOZ) sorunlar.push('goz/govde ' + g.toFixed(2));
    if (k < ESIK_AYRIM) sorunlar.push('govde/kontur ' + k.toFixed(2));
    if (koyu && z < ESIK_AYRIM) sorunlar.push('govde/zemin ' + z.toFixed(2));
    const satir = (tema.id + '/' + parca + ' ' + h).padEnd(24) + ' goz ' + g.toFixed(2) + '  kontur ' + k.toFixed(2) + '  zemin ' + z.toFixed(2) + (koyu ? ' (koyu)' : '');
    if (!sorunlar.length) { if (zorunlu) console.log('  ok   ' + satir); return; }
    if (zorunlu) { hata++; console.log('  HATA ' + satir + '  <- ' + sorunlar.join(', ')); }
    else { bilgi++; console.log('  BILGI ' + satir + '  <- ' + sorunlar.join(', ')); }
  });
}
console.log('goz ' + gozM[1] + ' | zemin (frame+gradyan) ust ' + zemin[0].map(Math.round) + ' alt ' + zemin[1].map(Math.round));
TEMALAR.forEach(t => {
  const d = t.deri;
  if (!d || d.yerlesik || !d.govde) return;
  kontrol(t, 'govde', d.govde.renkler, d.govde.kontur || '#000000');
  if (d.hedef) kontrol(t, 'hedef', d.hedef.renkler, d.hedef.kontur || '#000000');
});
ZORUNLU.forEach(id => { if (!TEMALAR.some(t => t.id === id)) { hata++; console.log('  HATA tema yok: ' + id); } });

// Lav/Murekkep: benekli/seritli varyasyon korunmali (en az 3 farkli govde rengi)
ZORUNLU.forEach(id => {
  const t = TEMALAR.find(x => x.id === id);
  if (t && new Set(t.deri.govde.renkler.map(s => s.toUpperCase())).size < 3) { hata++; console.log('  HATA ' + id + ': govde renk cesitliligi < 3'); }
});

// Lav govde renkleri birbirinden gorsel olarak ayrisik: CIEDE2000 ΔE >= 10 (seritli desen okunsun)
function lab(h) {
  const c = rgb(h).map(lin);
  const X = (0.4124564 * c[0] + 0.3575761 * c[1] + 0.1804375 * c[2]) / 0.95047, Y = 0.2126729 * c[0] + 0.7151522 * c[1] + 0.072175 * c[2], Z = (0.0193339 * c[0] + 0.119192 * c[1] + 0.9503041 * c[2]) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function de2000(p, q) {
  const [L1, a1, b1] = lab(p), [L2, a2, b2] = lab(q), r = Math.PI / 180, p7 = Math.pow(25, 7);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + p7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (y, x) => { const h = Math.atan2(y, x) / r; return h < 0 ? h + 360 : h; };
  const h1 = hp(b1, ap1), h2 = hp(b2, ap2), nz = Cp1 * Cp2 !== 0;
  let dh = h2 - h1; if (!nz) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dL = L2 - L1, dC = Cp2 - Cp1, dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * r / 2), Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
  let hb = h1 + h2; if (nz) { if (Math.abs(h1 - h2) <= 180) hb /= 2; else hb = (hb + (hb < 360 ? 360 : -360)) / 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * r) + 0.24 * Math.cos(2 * hb * r) + 0.32 * Math.cos((3 * hb + 6) * r) - 0.2 * Math.cos((4 * hb - 63) * r);
  const Sl = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), Sc = 1 + 0.045 * Cpb, Sh = 1 + 0.015 * Cpb * T;
  const Rt = -2 * Math.sqrt(Math.pow(Cpb, 7) / (Math.pow(Cpb, 7) + p7)) * Math.sin(60 * Math.exp(-Math.pow((hb - 275) / 25, 2)) * r);
  return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
}
(function () {
  const t = TEMALAR.find(x => x.id === 'lav'); if (!t) return;
  const rn = t.deri.govde.renkler;
  for (let i = 0; i < rn.length; i++) for (let j = i + 1; j < rn.length; j++) {
    const d = de2000(rn[i], rn[j]);
    if (d < 10) { hata++; console.log('  HATA lav govde ' + rn[i] + ' / ' + rn[j] + ' ΔE2000 ' + d.toFixed(1) + ' < 10'); }
  }
})();

console.log('\nZorunlu hata: ' + hata + ' | diger temalarda bilgi satiri: ' + bilgi);
process.exit(hata ? 1 : 0);
