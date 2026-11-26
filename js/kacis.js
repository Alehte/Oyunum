// kacis.js — Kacis? yilan bulmacasi: normal bolumler (js/bolumler.js) +
// ozel sekil bolumleri (js/ozel_bolumler.js), ipucu, kalpler
// ============ KAÇIŞ? — GAME LOGIC ============
  // Zorluk hedefi (minimum gereken yılan hareketi): Bölüm1=5, sonra her bölümde +2
  // Bölüm1=5, Bölüm2=7, Bölüm3=9, Bölüm4=11, Bölüm5=13
  (function(){
    let KC_COLS = 9, KC_ROWS = 11;
    const kcLevelsData = window.BOLUMLER || [];
    const KC_GAP = 3;
    const KC_MAX_HEARTS = 3;
    let kcHearts = KC_MAX_HEARTS;
    const DIR_VECTORS = { up:{dr:-1,dc:0}, down:{dr:1,dc:0}, left:{dr:0,dc:-1}, right:{dr:0,dc:1} };
    // Tahtaya her kenardan bu kadar bos hücre eklenir: ayni ekranda daha çok kare
    // (kareler küçülür), bölüm verisi degismeden desen ortalanmis kalir.
    const KC_BOARD_PAD = 1;
                                       
    const KC_TOTAL_LEVELS = kcLevelsData.length;
    const kcBoardEl = document.getElementById('kcBoard');
    const kcSnakeLayerEl = document.getElementById('kcSnakeLayer');
    // ---- pinch-zoom ----
    // Tahta bir "zoom kutusu"na sarilir. Kutunun boyutu buyur (kaydirma alani
    // bundan dogar), tahta ise transform:scale ile buyutulur.
    let kcZoom = 1;
    let kcZoomMin = 1;
    const KC_ZOOM_MAX = 3.2;
    let kcZoomBox = null, kcFrameEl = null;
    // Cerceve SABIT kalir; yakinlastirma yalnizca icerideki tahtaya uygulanir.
    function kcEnsureZoomBox(){
      if(kcZoomBox) return kcZoomBox;
      const wrap = kcBoardEl.parentElement;
      kcFrameEl = document.createElement('div');
      kcFrameEl.className = 'kc-frame';
      kcZoomBox = document.createElement('div');
      kcZoomBox.className = 'kc-zoom-box';
      wrap.insertBefore(kcFrameEl, kcBoardEl);
      kcFrameEl.appendChild(kcZoomBox);
      kcZoomBox.appendChild(kcBoardEl);
      kcBoardEl.style.transformOrigin = '0 0';
      return kcZoomBox;
    }
    function kcApplyZoom(){
      kcEnsureZoomBox();
      const w = kcBoardEl.offsetWidth, h = kcBoardEl.offsetHeight;
      kcBoardEl.style.transform = kcZoom === 1 ? '' : 'scale(' + kcZoom + ')';
      kcZoomBox.style.width  = Math.round(w * kcZoom) + 'px';
      kcZoomBox.style.height = Math.round(h * kcZoom) + 'px';
    }
    function kcResetZoom(){ kcZoom = 1; kcApplyZoom(); }

    const kcLevelTitleEl = document.getElementById('kcLevelTitle');
    const kcIntroSplash = document.getElementById('kcIntroSplash');
    const kcIntroTitle = document.getElementById('kcIntroTitle');
    const kcOverlayEl = document.getElementById('kcOverlay');
    let kcSnakes = [];
    let kcCurrentLevel = 1;let kcMode = 'normal';                 // 'normal' | 'ozel'
    function kcLevelSet(){ return kcMode === 'ozel' ? (window.OZEL_BOLUMLER || []) : kcLevelsData; }
    let kcUnlockedLevel = (window.AppProgress && window.AppProgress.unlocked) || 1;let kcMapScroll = {normal:null, ozel:null};   // her modun son kaydirma konumu
    const kcDomEls = new Map(); // id -> array of segment elements (dokunma alani + gozler)

    // ---- GOVDE: her yilan TEK PARCA bir SVG cizgisidir ----
    // Hucre div'leri artik gorunmez; yalnizca dokunma alani ve goz tasiyicisidir.
    // Govde, hucre merkezlerinden gecen yuvarlak uclu/koseli bir cizgi olarak
    // cizilir: hucreler arasi ek yeri ve "boncuk" gorunumu olmaz. Tiklama ve
    // carpisma eskisi gibi hucre bazlidir.
    const kcBodyEls = new Map(); // id -> { svg, tum:[polyline], kal, kor }
    const KC_NS = 'http://www.w3.org/2000/svg';
    function kcPoly(svg, renk, kal, sinif){
      const p = document.createElementNS(KC_NS, 'polyline');
      p.setAttribute('stroke', renk);
      p.setAttribute('stroke-width', kal);
      if(sinif) p.setAttribute('class', sinif);
      svg.appendChild(p);
      return p;
    }
    function kcAcik(hex, oran){          // rengi beyaza dogru ac
      if(typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7) return '#FFFFFF';
      const k = i => { const v = parseInt(hex.substr(i, 2), 16); return Math.round(v + (255 - v) * oran); };
      return 'rgb(' + k(1) + ',' + k(3) + ',' + k(5) + ')';
    }
    // Govdenin katmanlari. Markette bir deri seciliyse o cizer (ozel bolumlerde
    // UYGULANMAZ); degilse duz govde + kahramanda acik tonlu sirt seridi.
    function kcCizgiKur(svg, snake, kal){
      if(kcMode !== 'ozel' && window.AppMarket && window.AppMarket.deriCizgileri){
        const tema = window.AppMarket.deriCizgileri(svg, !!snake.isHero, kal, snake._sira || 0);
        if(tema) return tema;
      }
      const liste = [kcPoly(svg, snake.color, kal)];
      if(snake.isHero) liste.push(kcPoly(svg, kcAcik(snake.color, .58), kal * 0.3));
      return liste;
    }
    function kcNoktalar(hucreler, stepX, stepY){
      const cx = c => c * stepX + (stepX - KC_GAP) / 2, cy = r => r * stepY + (stepY - KC_GAP) / 2;
      const pts = hucreler.map(([r,c]) => cx(c).toFixed(1) + ',' + cy(r).toFixed(1));
      if(pts.length === 1) pts.push((cx(hucreler[0][1]) + 0.01).toFixed(2) + ',' + cy(hucreler[0][0]).toFixed(1));
      return pts.join(' ');
    }
    function kcGovdeCiz(s, stepX, stepY){
      const kal = Math.min(stepX, stepY) - KC_GAP;
      let g = kcBodyEls.get(s.id);
      if(!g || Math.abs(g.kal - kal) > 0.05){
        if(g){ g.svg.remove(); if(g.kor) g.kor.remove(); }
        const svg = document.createElementNS(KC_NS, 'svg');
        svg.setAttribute('class', 'kc-govde');
        const isaret = kcPoly(svg, '#FFE896', kal + 7, 'kc-govde-isaret');     // ipucu halesi (gizli)
        const cizgiler = kcCizgiKur(svg, s, kal);
        const flas = kcPoly(svg, 'rgba(226,60,60,.62)', kal, 'kc-govde-flas'); // engel flasi (gizli)
        kcSnakeLayerEl.insertBefore(svg, kcSnakeLayerEl.firstChild);
        // efsanevi tema: govdenin ustunde nefes alan isik. Ayri bir katman ki
        // yalnizca opakligi canlansin (govde her karede yeniden boyanmasin).
        let kor = null;
        const anim = (kcMode !== 'ozel' && window.AppMarket && window.AppMarket.aktif) ? window.AppMarket.aktif('kacis', 'deri').animasyon : null;
        if(anim && (s._sira || 0) < 48){
          kor = document.createElementNS(KC_NS, 'svg');
          kor.setAttribute('class', 'kc-govde kc-govde-kor');
          kor.style.animationDelay = (((s._sira || 0) % 6) * 0.4) + 's';
          kcPoly(kor, 'rgba(255,214,150,.75)', kal * 0.5);
          kcSnakeLayerEl.insertBefore(kor, svg.nextSibling);
        }
        g = { svg, tum: [isaret].concat(cizgiler, [flas]), kal, kor };
        kcBodyEls.set(s.id, g);
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.cells.forEach(([r,c]) => {
        const x = c * stepX + (stepX - KC_GAP) / 2, y = r * stepY + (stepY - KC_GAP) / 2;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      });
      const pay = kal / 2 + 6, noktalar = kcNoktalar(s.cells, stepX, stepY);
      [g.svg, g.kor].forEach(svg => {
        if(!svg) return;
        svg.style.left = (minX - pay) + 'px'; svg.style.top = (minY - pay) + 'px';
        svg.style.width = (maxX - minX + pay * 2) + 'px'; svg.style.height = (maxY - minY + pay * 2) + 'px';
        svg.setAttribute('viewBox', (minX - pay) + ' ' + (minY - pay) + ' ' + (maxX - minX + pay * 2) + ' ' + (maxY - minY + pay * 2));
      });
      g.tum.forEach(p => p.setAttribute('points', noktalar));
      if(g.kor) g.kor.firstChild.setAttribute('points', noktalar);
    }
    function kcGovdeSil(id){
      const g = kcBodyEls.get(id);
      if(!g) return;
      g.svg.remove(); if(g.kor) g.kor.remove();
      kcBodyEls.delete(id);
    }
    // bir yilanin gorunen butun parcalari (hucre div'leri + govde cizgisi)
    function kcParcalar(id){
      const els = (kcDomEls.get(id) || []).slice(), g = kcBodyEls.get(id);
      if(g){ els.push(g.svg); if(g.kor) els.push(g.kor); }
      return els;
    }

    // Yılanın hareket yönü, gövdesinin SON kırılışından türetilir:
    // kafanın (son hücre) bir önceki hücreye göre yönü = hareket yönü.
    function deriveDir(cells, fallback){
      if(!cells || cells.length < 2) return fallback;
      const [pr,pc] = cells[cells.length-2];
      const [hr,hc] = cells[cells.length-1];
      if(hr === pr - 1) return 'up';
      if(hr === pr + 1) return 'down';
      if(hc === pc - 1) return 'left';
      if(hc === pc + 1) return 'right';
      return fallback;
    }
    function twoTone(text, colorA, colorB){
      return text.split('').map((ch,i) => ch === ' ' ? ' ' : '<span style="color:'+(i%2===0?colorA:colorB)+'">'+ch+'</span>').join('');
    }

    // ---- level-select nodes ----
    // --- Bolum haritasi: kaydirmali, 7 bolum gorunur, 11. bolum "Yakinda" ---
    const KC_VISIBLE_NODES = 7;
    // Harita iki modda da kullaniliyor: dugum sayisi/kilit aktif bolum setine gore.
    function kcLevelCount(){ return kcLevelSet().length; }
    function kcShownNodes(){ return kcLevelCount() + 1; }        // + 1 "Yakinda"
    function kcBestFor(n){ return kcMode === 'ozel' ? ozelBest(n) : bestHeartsFor(n); }
    function kcUnlockedCount(){
      if(kcMode !== 'ozel') return kcUnlockedLevel;
      let u = 1;                                                  // ozelde: onceki bitince acilir
      while(u < kcLevelCount() && ozelBest(u) > 0) u++;
      return u;
    }
    const KC_NODE_COLORS = [                   // agac/orman tonlari
      {bg:'#C98A3E', ring:'#F0C892', fg:'#33220C'},
      {bg:'#A9713F', ring:'#DFAC7C', fg:'#2E1B0B'},
      {bg:'#7E9B4A', ring:'#BFD790', fg:'#22300E'},
      {bg:'#B5843A', ring:'#E8C186', fg:'#30210A'},
      {bg:'#8C6239', ring:'#CB9E70', fg:'#2A1A0A'},
      {bg:'#6F8F4F', ring:'#ACCB8F', fg:'#1E2C10'},
      {bg:'#C2A24E', ring:'#EEDA9E', fg:'#332A0C'},
      {bg:'#9A6B45', ring:'#D2A67E', fg:'#2C1C0D'}
    ];
    function branchSvg(flip){
      const s = flip ? ' transform="scale(-1,1) translate(-84,0)"' : '';
      return '<svg width="84" height="52" viewBox="0 0 84 52" fill="none">' +
        '<g' + s + '>' +
        '<path d="M4 40 C24 38 40 30 58 14" stroke="#5B3E22" stroke-width="4.5" stroke-linecap="round"/>' +
        '<path d="M30 33 C34 24 42 20 50 20" stroke="#5B3E22" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M58 14 C64 6 74 4 80 6 C78 14 70 20 60 18Z" fill="#4E8A46"/>' +
        '<path d="M50 20 C56 14 64 14 68 17 C64 24 56 26 50 23Z" fill="#5E9E52"/>' +
        '<path d="M26 34 C24 26 28 19 34 16 C38 23 36 31 30 36Z" fill="#6BAE5C"/>' +
        '<path d="M12 40 C10 33 13 27 18 24 C22 30 20 38 15 42Z" fill="#4E8A46"/>' +
        '</g></svg>';
    }
    function renderLevelNodes(){
      const wrap = document.getElementById('kcPathWrap');
      const inner = document.getElementById('kcPathInner');
      const KC_SHOWN_NODES = kcShownNodes();
      const KC_TOTAL = kcLevelCount();
      const KC_UNLOCKED = kcUnlockedCount();
      const mapTitleEl = document.getElementById('kcMapTitle');
      if(mapTitleEl) mapTitleEl.textContent = kcMode === 'ozel' ? 'Özel Bölümler' : 'Kaçış?';
      const W = wrap.clientWidth || 320;
      const visH = wrap.clientHeight || 620;
      const spacing = visH / KC_VISIBLE_NODES;
      const contentH = Math.round(spacing * KC_SHOWN_NODES);
      inner.style.height = contentH + 'px';

      const amp = W * 0.23, cx = W / 2;
      const pts = [];
      for(let i = 0; i < KC_SHOWN_NODES; i++){
        const off = [0, 1, 0, -1][i % 4];
        pts.push({ x: cx + off * amp, y: contentH - spacing * (i + 0.5) });
      }
      let d = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1);
      for(let i = 1; i < pts.length; i++){
        const a = pts[i-1], b = pts[i], my = (a.y + b.y) / 2;
        d += ' C' + a.x.toFixed(1) + ',' + my.toFixed(1) + ' ' + b.x.toFixed(1) + ',' + my.toFixed(1) + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1);
      }
      let html = '<svg class="kc-path-svg" width="' + W + '" height="' + contentH + '" viewBox="0 0 ' + W + ' ' + contentH + '">' +
                 '<path class="kc-path-base" d="' + d + '"/><path class="kc-path-glow" d="' + d + '"/></svg>';

      for(let n = 1; n <= KC_SHOWN_NODES; n++){
        const pt = pts[n-1];
        const soon = n > KC_TOTAL;
        const unlocked = !soon && n <= KC_UNLOCKED;
        const lockSvg = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        // her 2-3 bolumde bir dal + yaprak detayi
        if(n % 3 === 2 || n === KC_SHOWN_NODES){
          const flip = pt.x > cx;
          const bx = pt.x + (flip ? 48 : -48);
          html += '<div class="kc-branch" style="left:' + bx + 'px; top:' + (pt.y - 6) + 'px;">' + branchSvg(flip) + '</div>';
        }
        if(unlocked){
          const col = KC_NODE_COLORS[(n * 5 + 2) % KC_NODE_COLORS.length];
          html += '<div class="kc-node kc-node-active" data-level="' + n + '" role="button" tabindex="0" ' +
                  'style="left:' + pt.x + 'px; top:' + pt.y + 'px; background:' + col.bg + '; color:' + col.fg + '; border:3px solid ' + col.ring + ';"><span>' + n + '</span></div>';
          // toplanan altin gostergesi: 3 sikke, kac kalple gecildiyse o kadari dolu
          const got = kcBestFor(n);
          let coins = '';
          for(let k = 1; k <= 3; k++) coins += window.CoinSVG(k <= got);
          html += '<div class="kc-node-coins" style="left:' + pt.x + 'px; top:' + (pt.y + 30) + 'px;">' + coins + '</div>';
        } else {
          html += '<div class="kc-node kc-node-locked" style="left:' + pt.x + 'px; top:' + pt.y + 'px;">' + lockSvg + '</div>';
          if(soon){
            html += '<div class="kc-node-soon" style="left:' + pt.x + 'px; top:' + (pt.y + 32) + 'px;">Yakında</div>';
          }
        }
      }
      inner.innerHTML = html;

      // hediye kutulari (yalniz normal mod): dugumun dal susu OLMAYAN yaninda.
      // Dal, sagdaki dugumde saga, digerlerinde sola cizilir; kutu tersine durur.
      if(kcMode !== 'ozel' && window.AppHediye){
        Object.keys(window.AppHediye.takvim).map(Number).filter(n => n <= KC_TOTAL).forEach(n => {
          const k = window.AppHediye.kutu('kacis', n);
          if(!k) return;
          const pt = pts[n-1];
          k.style.left = (pt.x + (pt.x > cx ? -54 : 54)) + 'px';
          k.style.top = pt.y + 'px';
          inner.appendChild(k);
        });
      }

      if(!wrap.dataset.scrollBound){
        wrap.dataset.scrollBound = '1';
        wrap.addEventListener('scroll', () => { kcMapScroll[kcMode] = wrap.scrollTop; }, {passive:true});
      }
      inner.querySelectorAll('.kc-node-active').forEach(node => {
        const lvl = Number(node.dataset.level);
        const go = () => { loadLevel(lvl); slideForward('kacisLevels','kacisLevel1'); };
        node.addEventListener('click', go);
        node.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') go(); });
      });
      // ilk acilista en altta (1. bolum) basla, sonrasinda kullanicinin biraktiğı yeri koru
      const sc = kcMapScroll[kcMode];
      if(sc === null || sc === undefined){ wrap.scrollTop = wrap.scrollHeight; }
      else { wrap.scrollTop = Math.max(0, Math.min(sc, wrap.scrollHeight - wrap.clientHeight)); }
    }

    // --- orman dokusu + ince yagmur (bir kez kurulur) ---
    function buildJungleDecor(jungleId, rainId){
      const j = document.getElementById(jungleId || 'kcJungle');
      if(!j || j.dataset.built) return;
      j.dataset.built = '1';
      const frond = (fill, op) => '<svg width="150" height="150" viewBox="0 0 150 150"><path d="M75 6 C22 34 18 104 75 144 C104 106 106 40 75 6Z" fill="' + fill + '" opacity="' + op + '"/><path d="M75 6 L75 144" stroke="#1E3D26" stroke-width="3" opacity=".35"/></svg>';
      let html = '';
      html += '<div class="frond" style="top:-46px; left:-52px; transform:rotate(24deg);">' + frond('#2C5C36', .75) + '</div>';
      html += '<div class="frond" style="top:-38px; right:-58px; transform:rotate(-38deg) scaleX(-1);">' + frond('#25522F', .8) + '</div>';
      html += '<div class="frond" style="bottom:-64px; left:-60px; transform:rotate(-16deg);">' + frond('#2F6339', .6) + '</div>';
      html += '<div class="frond" style="bottom:-56px; right:-50px; transform:rotate(28deg) scaleX(-1);">' + frond('#28583234', .55).replace('#28583234','#2A5A33') + '</div>';
      [[14,120],[32,74],[68,150],[86,96]].forEach(([left, len]) => {
        html += '<div class="vine" style="left:' + left + '%; height:' + len + 'px;"></div>';
      });
      html += '<div class="mist" style="top:24%;"></div><div class="mist" style="top:62%;"></div>';
      j.innerHTML = html;

      const r = document.getElementById(rainId || 'kcRain');
      if(r && !r.dataset.built){
        r.dataset.built = '1';
        let rain = '';
        for(let i = 0; i < 17; i++){
          const left = (i * 6.1 + (i % 3) * 3.4) % 100;
          const len = 11 + (i % 4) * 4;
          const dur = (1.15 + (i % 5) * 0.22).toFixed(2);
          const delay = ((i % 7) * 0.31).toFixed(2);
          const op = (0.28 + (i % 4) * 0.13).toFixed(2);
          rain += '<div class="kc-drop" style="left:' + left.toFixed(1) + '%; height:' + len + 'px; opacity:' + op + '; animation-duration:' + dur + 's; animation-delay:' + delay + 's;"></div>';
        }
        r.innerHTML = rain;
      }
    }

    // ---- board ----
    // Görüntü penceresi: ekranda ayni anda görünen hücre sayisi. 10. bölüme
    // kadar büyür (hücreler küçülür), sonra DONAR.
    const KC_VIEW_START = { cols: 9,  rows: 11 };
    const KC_VIEW_END   = { cols: 12, rows: 15 };
    const KC_VIEW_FREEZE = 10;
    // Izgara pencereyi en fazla bu kadar asabilir (kaydirma mesafesi siniri).
    const KC_SCROLL_EXTRA = 6;
    let kcViewCols = 9, kcViewRows = 11;
    const KC_CHROME = 18;         // tahtanin padding(6*2) + border(3*2) toplami

    function kcFitCell(cols, rows, availW, availH){
      const w = (availW - KC_CHROME - (cols-1)*KC_GAP) / cols;
      const h = (availH - KC_CHROME - (rows-1)*KC_GAP) / rows;
      return Math.min(w, h);
    }
    function buildKcCells(){
      kcBoardEl.querySelectorAll('.kc-cell-bg').forEach(el => el.remove());
      const wrap = document.querySelector('.kc-board-wrap');
      const cs = getComputedStyle(wrap);
      const availW = wrap.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const availH = wrap.clientHeight - parseFloat(cs.paddingTop)  - parseFloat(cs.paddingBottom);

      // Taban: Bölüm 1 tahtasının bu ekrandaki hücre boyutunun %40'ı.
      // Hücre boyutu PENCEREden hesaplanir: pencere ekrani tam doldurur.
      // Izgara pencereden büyükse tahta tasar ve kaydirilir.
      // Tüm ızgara her zaman ekrana sığar: hücre boyutu PENCEREden degil
      // IZGARAdan hesaplanir. Kücük gelirse oyuncu pinch ile büyütür.
      kcEnsureZoomBox();
      // Hücre boyutu PENCEREden hesaplanir: pencere ekrani doldurur ve sabit kalir.
      // Izgara pencereden buyukse tahta tasar, oyuncu kaydirarak gezer.
      const cell = Math.max(10, kcFitCell(kcViewCols, kcViewRows, availW, availH));
      const gw = KC_COLS*cell + (KC_COLS-1)*KC_GAP + 12;   // tahtanin tam boyu
      const gh = KC_ROWS*cell + (KC_ROWS-1)*KC_GAP + 12;
      let vw = Math.min(gw, kcViewCols*cell + (kcViewCols-1)*KC_GAP + 12);  // gorunen pencere
      let vh = Math.min(gh, kcViewRows*cell + (kcViewRows-1)*KC_GAP + 12);
      // Ozel bolumlerde sekil pencereden cok buyuk: cerceve eldeki tum alani kullansin
      if(kcMode === 'ozel'){
        vw = Math.min(gw, availW - 6);
        vh = Math.min(gh, availH - 6);
      }
      // Uzaklastirma siniri: tahtanin TAMAMI cercevenin icine sigacak kadar.
      // (Eskiden alana gore hesaplaniyordu; cerceve alandan kucukse en dusuk
      // olcekte bile tahta cerceveye sigmiyordu.)
      kcZoomMin = Math.min(1, Math.max(0.2, Math.min(vw / gw, vh / gh)));
      if(kcZoom < kcZoomMin) kcZoom = kcZoomMin;

      kcFrameEl.style.width  = (vw + 6) + 'px';            // + 3px kenarlik x2
      kcFrameEl.style.height = (vh + 6) + 'px';
      kcBoardEl.style.aspectRatio = 'auto';
      kcBoardEl.style.width  = gw + 'px';
      kcBoardEl.style.height = gh + 'px';
      kcBoardEl.style.gridTemplateColumns = 'repeat(' + KC_COLS + ', ' + cell.toFixed(2) + 'px)';
      kcBoardEl.style.gridTemplateRows    = 'repeat(' + KC_ROWS + ', ' + cell.toFixed(2) + 'px)';
      const frag = document.createDocumentFragment();
      for(let i=0;i<KC_COLS*KC_ROWS;i++){ const d=document.createElement('div'); d.className='kc-cell-bg'; frag.appendChild(d); }
      kcBoardEl.insertBefore(frag, kcSnakeLayerEl);
      kcApplyZoom();          // ekran döndürme/yeniden boyutlanmada kutu da güncellensin
    }
    // Tahta ekrandan tasiyorsa yesil yilani görüs alanina getir
    // Yakinlastirilmisken yesil yilani cerceve icinde görüs alanina getir
    function kcCenterOnHero(){
      const box = kcFrameEl;
      if(!box) return;
      const hero = kcSnakes.find(s => s.isHero);
      if(!hero || !hero.cells.length){          // ozel mod: kahraman yok, tahtayi ortala
        box.scrollLeft = Math.max(0, (box.scrollWidth  - box.clientWidth)  / 2);
        box.scrollTop  = Math.max(0, (box.scrollHeight - box.clientHeight) / 2);
        return;
      }
      const {stepX, stepY} = kcMeasure();
      let sr = 0, sc = 0;
      hero.cells.forEach(([r,c]) => { sr += r; sc += c; });
      const cx = (sc / hero.cells.length) * stepX * kcZoom;
      const cy = (sr / hero.cells.length) * stepY * kcZoom;
      box.scrollLeft = Math.max(0, cx - box.clientWidth  / 2);
      box.scrollTop  = Math.max(0, cy - box.clientHeight / 2);
    }
    // --- canlar ---
    const HEART_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21Z"/></svg>';
    function renderHearts(breakIndex){
      const wrap = document.getElementById('kcHearts');
      wrap.innerHTML = '';
      for(let i=0;i<KC_MAX_HEARTS;i++){
        const d = document.createElement('div');
        d.className = 'kc-heart' + (i >= kcHearts ? ' lost' : '');
        d.style.color = i < kcHearts ? '#FF4D5E' : '#8AA694';
        if(breakIndex === i) d.classList.add('breaking');
        d.innerHTML = HEART_SVG;
        wrap.appendChild(d);
      }
    }
    function loseHeart(){
      if(kcHearts <= 0) return;
      kcHearts--;
      renderHearts(kcHearts);
      renderHintBtn();
      if(kcHearts === 0){
        // "dın dın dııın" — kaybetme
        if(window.AppFX) window.AppFX.seq([[440,.15,.14,0],[370,.15,.14,170],[247,.52,.16,350]], 'sine');
        const oturum = kcOturum;
        setTimeout(() => { if(oturum === kcOturum && kcHearts <= 0 && !kcKazanildi) kcKayip(); }, 520);
      }
    }

    // ---- REKLAM ortak: bolum oturumu + "hala bu bolum ekraninda mi" ----
    // Reklam sonucu gec gelebilir (geri tusu, sahte katman suresi). Sonuc geldiginde
    // oturum degistiyse (yeni bolum / Tekrar Dene / Bastan) ya da ekran terk edildiyse
    // odul UYGULANMAZ.
    let kcOturum = 0;                    // her loadLevel'de artar
    function kcEkranda(){
      const el = document.getElementById('screen-kacis-level1');
      return !!el && !el.classList.contains('offstage') && (el.style.transform || '').indexOf('100%') < 0;
    }
    function kcReklamVar(){ return !!(window.Reklam && window.Reklam.destekleniyor()); }

    // ---- ikinci sans: 3 kalp bitince "Reklam izle, 3 kalple devam et" ----
    // Deneme (loadLevel) basina EN COK 1 kez sorulur. Kabul edilip reklam sonuna kadar
    // izlenirse kalpler 3'e dolar, tahta oldugu gibi kalir. Ikinci sansla gecilen
    // bolum altin/rekor icin 1 kalple gecilmis sayilir (bkz. kcKalpSayisi).
    let kcIkinciSansSoruldu = false, kcIkinciSansAlindi = false;
    // Kazanma basladi (kahraman / son yilan cikti): ikinci sans artik sorulmaz, acik
    // pencere kapatilir, gec gelen sonuc uygulanmaz. loadLevel sifirlar.
    let kcKazanildi = false;
    function kcKalpSayisi(){ return kcIkinciSansAlindi ? Math.min(1, kcHearts) : kcHearts; }
    function kcKayip(){
      if(kcIkinciSansSoruldu || !kcReklamVar() || !kcEkranda()){ showFailScreen(); return; }
      kcIkinciSansSoruldu = true;
      const oturum = kcOturum;
      window.Reklam.ikinciSans({
        baslik: 'Kalplerin bitti',
        metin: 'Reklam izlersen 3 kalple kaldığın yerden devam edersin. Bu bölümü geçersen 1 kalple geçmiş sayılırsın.',
        evet: 'Reklam izle, 3 kalple devam et',
        hayir: 'Hayır, bitir'
      }).then(ok => {
        if(oturum !== kcOturum || kcHearts > 0 || kcKazanildi) return;   // bolum degisti / kazanildi
        if(ok && kcEkranda()){
          kcIkinciSansAlindi = true;
          kcHearts = KC_MAX_HEARTS;
          renderHearts(-1);
          renderHintBtn();
          if(kcIpucuDizi > 0) kcIpucuIsaretle();
          if(window.AppFX) window.AppFX.tone(660, 990, 0.2, 'triangle', 0.1);
          return;
        }
        showFailScreen();                                    // "Hayır, bitir" / odulsuz kapatma
      }, () => { if(oturum === kcOturum && kcHearts <= 0 && !kcKazanildi && kcEkranda()) showFailScreen(); });
    }

    // ---- ipucu: fiyat bolum icinde artar (20/30/50), her bolumde sifirlanir ----
    const KC_HINT_PRICES = [20, 30, 50];
    let hintsUsedThisLevel = 0;
    function hintPrice(){
      return KC_HINT_PRICES[Math.min(hintsUsedThisLevel, KC_HINT_PRICES.length - 1)];
    }
    function renderHintBtn(){
      const btn = document.getElementById('kcHintBtn');
      if(!btn) return;
      const price = hintPrice();
      const affordable = window.AppGold && window.AppGold.get() >= price;
      const bulb = '<svg class="bulb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2Z"/></svg>';
      if(kcIpucuDizi > 0){
        // reklamla alinmis sirali ipucu suruyor: dokununca isaret yeniden gosterilir (ucretsiz)
        btn.innerHTML = bulb + 'İpucu <span class="price kc-ipucu-kalan">' + kcIpucuDizi + ' hamle</span>';
        btn.disabled = kcHearts <= 0;
        return;
      }
      btn.innerHTML = bulb + 'İpucu <span class="price">' + window.CoinSVG(true) + price + '</span>';
      // reklam destegi varken altin yetmese de dugme acik: pencerede reklam secenegi var
      btn.disabled = (!affordable && !kcReklamVar()) || kcHearts <= 0;
    }
    // Kahramani serbest birakmak icin gereken kume icinden SU AN hareket edebilen birini bul
      function findHintSnake(){
      const occ = buildOccupancy();
      if(kcMode === 'ozel'){
        return kcSnakes.find(s => !s.exiting && !findBlocker(s, occ)) || null;
      }
      const byId = {}; kcSnakes.forEach(s => byId[s.id] = s);
      const hero = byId['green'];
      if(!hero) return null;
      const need = kcGerekliKume(occ, byId);
      if(need.size === 0) return hero;                     // kahraman zaten serbest
      for(const id of need){
        const s = byId[id];
        if(s && !findBlocker(s, occ)) return s;             // simdi oynanabilir olan ilk engel
      }
      return null;
    }
    // Kahramandan once MUTLAKA cikmasi gereken yilanlar: kahramanin yolunu kesenler,
    // onlarin yolunu kesenler... (kapanis). findHintSnake ve kcCozumeKalan ortak kullanir.
    function kcGerekliKume(occ, byId){
      const need = new Set(); const stack = ['green'];
      while(stack.length){
        const cur = byId[stack.pop()];
        if(!cur) continue;
        // yolu kesen TÜM yılanlar (birden fazla olabilir)
        simulateExit(cur, occ, true).forEach(id => {
          if(!need.has(id)){ need.add(id); stack.push(id); }
        });
      }
      return need;
    }
    // Cozume kalan hamle (yilan cikisi) sayisi. Normal: gerekli kume + kahramanin kendisi
    // (kume bir yilanin cikisiyla en fazla 1 kuculur: cikabilen yilanin yolunda kimse yoktur).
    // Ozel: tahtada kalan (cikmakta olmayan) yilan sayisi.
    function kcCozumeKalan(){
      if(kcMode === 'ozel') return kcSnakes.filter(s => !s.exiting).length;
      const byId = {}; kcSnakes.forEach(s => byId[s.id] = s);
      const hero = byId['green'];
      if(!hero || hero.exiting) return 0;
      return kcGerekliKume(buildOccupancy(), byId).size + 1;
    }

    // ---- reklam ipucu (birim 'ipucu_joker'): 10 hamleye kadar SIRALI ipucu ----
    // Cozume kalan hamle 10'dan azsa kalanin tamami. Her adimda findHintSnake'in
    // sectigi yilan surekli isaretlenir; oyuncu hamle yaptikca bir sonrakine gecer.
    // Hak, COZUME ILERLEYEN her cikista 1 azalir (onerilen yilan ya da gerekli kumeden
    // baska bir yilan). Gereksiz (tuzak) yilan cikarilirsa hak yanmaz, isaret yeniden
    // hesaplanir. Her adimdan sonra hak, cozume kalan hamleyle sinirlanir.
    // Bolum yuklenince (yeni bolum / Tekrar Dene / Bastan) sifirlanir.
    const KC_REKLAM_IPUCU = 10;
    let kcIpucuDizi = 0, kcIpucuHedef = null;
    function kcIpucuIsaretKaldir(){
      if(kcIpucuHedef){
        const hg = kcBodyEls.get(kcIpucuHedef);
        if(hg) hg.svg.classList.remove('hint-mark', 'hint-surekli');
      }
      kcIpucuHedef = null;
    }
    function kcIpucuIsaretle(){
      kcIpucuIsaretKaldir();
      if(kcIpucuDizi <= 0) return;
      const t = findHintSnake();
      if(!t){ kcIpucuDizi = 0; renderHintBtn(); return; }
      kcIpucuHedef = t.id;
      const hg = kcBodyEls.get(t.id);
      if(hg){
        hg.svg.classList.remove('hint-mark'); void hg.svg.getBoundingClientRect();
        hg.svg.classList.add('hint-mark', 'hint-surekli');
      }
    }
    // handleSnakeTap: bir yilan cikmaya basladiktan hemen sonra (once = cikistan onceki kalan)
    function kcIpucuIlerle(once){
      const sonra = kcCozumeKalan();
      if(sonra < once) kcIpucuDizi -= (once - sonra);
      kcIpucuDizi = Math.max(0, Math.min(kcIpucuDizi, sonra));
      if(kcIpucuDizi > 0) kcIpucuIsaretle(); else kcIpucuIsaretKaldir();
      renderHintBtn();
    }
    // Ipucu dugmesi. Reklam destegi yoksa (tarayici) eskisi gibi dogrudan altinli ipucu.
    function kcIpucuTikla(){
      if(kcHearts <= 0) return;
      if(kcIpucuDizi > 0){
        kcIpucuIsaretle();
        if(window.AppFX) window.AppFX.tone(880, 1320, 0.18, 'triangle', 0.1);
        return;
      }
      if(!kcReklamVar()){ useHint(); return; }
      if(window.Reklam.acikMi()) return;
      if(!findHintSnake()) return;
      const kalan = Math.min(KC_REKLAM_IPUCU, kcCozumeKalan());
      if(kalan <= 0) return;
      const price = hintPrice();
      const oturum = kcOturum;
      window.Reklam.secim({
        baslik: 'İpucu',
        secenekler: [
          { deger: 'altin', etiket: price + ' altın', alt: 'Tek hamle',
            pasif: !(window.AppGold && window.AppGold.get() >= price) },
          { deger: 'reklam', etiket: 'Reklam izle', alt: kalan + ' hamle sırayla', birim: 'ipucu_joker' }
        ],
        iptal: 'Vazgeç'
      }).then(d => {
        if(oturum !== kcOturum || !kcEkranda() || kcHearts <= 0) return;
        if(d === 'altin'){ useHint(); return; }
        if(d !== 'reklam') return;
        kcIpucuDizi = Math.min(KC_REKLAM_IPUCU, kcCozumeKalan());
        kcIpucuIsaretle();
        renderHintBtn();
        if(kcIpucuDizi > 0 && window.AppFX) window.AppFX.tone(880, 1320, 0.18, 'triangle', 0.1);
      });
    }
    function useHint(){
      if(kcHearts <= 0) return;
      const price = hintPrice();
      if(!window.AppGold || window.AppGold.get() < price) return;
      const target = findHintSnake();
      if(!target) return;
      if(!window.AppGold.harca(price)) return;
      hintsUsedThisLevel++;
      renderHintBtn();
      const hg = kcBodyEls.get(target.id);
      if(hg){
        hg.svg.classList.remove('hint-mark'); void hg.svg.getBoundingClientRect(); hg.svg.classList.add('hint-mark');
        // reklam ipucu dizisi ayni yilani surekli isaretliyorsa ona dokunma
        setTimeout(() => { if(!hg.svg.classList.contains('hint-surekli')) hg.svg.classList.remove('hint-mark'); }, 3300);
      }
      if(window.AppFX) window.AppFX.tone(880, 1320, 0.18, 'triangle', 0.1);
    }

    // ---- altin: kalp basina 10, ama SADECE eski rekorun ustu odenir ----
    // ornek: 1 kalple gecip 10 aldiysan, sonra 3 kalple gecince 30-10 = 20 alirsin.
    // 3 kalple gecilmis bir bolum tekrar oynandiginda kazanc 0'dir.
    const KC_GOLD_PER_HEART = 10;
    function bestHeartsFor(level){
      const rec = (window.AppProgress && window.AppProgress.kacisHearts) || {};
      return rec[level] || 0;
    }
    function awardGold(level, heartsLeft){
      const prev = bestHeartsFor(level);
      if(heartsLeft <= prev) return 0;
      const payout = (heartsLeft - prev) * KC_GOLD_PER_HEART;
      window.AppProgress.kacisHearts[level] = heartsLeft;
      if(window.AppSaveProgress) window.AppSaveProgress({kacisHearts: window.AppProgress.kacisHearts});
      if(window.AppGold) window.AppGold.add(payout);
      return payout;
    }
    // ozel bolumler ayri anahtarla saklanir ('o1','o2'...) — normal bolumlerle karismaz
    function ozelBest(level){
      const rec = (window.AppProgress && window.AppProgress.kacisHearts) || {};
      return rec['o' + level] || 0;
    }
    function awardOzelGold(level, heartsLeft){
      const prev = ozelBest(level);
      if(heartsLeft <= prev) return 0;
      const payout = (heartsLeft - prev) * KC_GOLD_PER_HEART;
      window.AppProgress.kacisHearts['o' + level] = heartsLeft;
      if(window.AppSaveProgress) window.AppSaveProgress({kacisHearts: window.AppProgress.kacisHearts});
      if(window.AppGold) window.AppGold.add(payout);
      return payout;
    }

    // ---- sonuc metinleri ----
    const KC_WIN_TEXTS  = ['Tebrikler!!', 'Bravo', 'Böyle Devam', 'Harika!', 'Yok artık 😲'];
    const KC_FAIL_TEXTS = ['Başarısız..', 'Tekrar Dene...'];
    // Tema ici dar gradyan: kazanirken altin -> taze yesil, kaybederken mercan -> kehribar
    const KC_WIN_GRAD  = ['#FFDD73', '#6FE0A0'];
    const KC_FAIL_GRAD = ['#FF9A8A', '#FFCE7A'];
    function lerpHex(a, b, t){
      const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
      const r = Math.round(((A>>16)&255) + ((((B>>16)&255)) - ((A>>16)&255)) * t);
      const g = Math.round(((A>>8)&255)  + ((((B>>8)&255))  - ((A>>8)&255))  * t);
      const bl= Math.round((A&255)       + ((B&255)         - (A&255))       * t);
      return '#' + ((1<<24) | (r<<16) | (g<<8) | bl).toString(16).slice(1);
    }
    function paintBigText(el, text, grad){
      const chars = Array.from(text);          // emoji'yi bolmemek icin kod noktasi bazli
      const n = Math.max(chars.length - 1, 1);
      el.innerHTML = chars.map((ch, i) =>
        ch === ' ' ? ' ' : '<span style="color:' + lerpHex(grad[0], grad[1], i / n) + '">' + ch + '</span>'
      ).join('');
    }
    function burstConfetti(){
      const box = document.getElementById('kcConfetti');
      const cols = ['#FF4D5E','#FFD24D','#4DF08F','#4EA8FF','#B76FF0','#FF8A3D','#FFFFFF'];
      // Düsme mesafesi piksel olarak verilir: transform içindeki % elemanin
      // kendi boyutuna göre hesaplandigi icin ise yaramiyor.
      const fall = Math.round((box.getBoundingClientRect().height || 600) * 1.25);
      let html = '';
      for(let i = 0; i < 46; i++){
        const w = 5 + Math.random() * 7;
        html += '<i style="left:' + (Math.random()*100).toFixed(1) + '%;' +
                'background:' + cols[i % cols.length] + ';' +
                'width:' + w.toFixed(1) + 'px;height:' + (w*0.62).toFixed(1) + 'px;' +
                'animation-delay:' + (Math.random()*0.02).toFixed(2) + 's;' +
                'animation-duration:' + (0.75 + Math.random()*0.45).toFixed(2) + 's;' +
                '--fall:' + fall + 'px;' +
                '--drift:' + ((Math.random()*2-1)*70).toFixed(0) + 'px;' +
                '--spin:' + (360 + Math.random()*720).toFixed(0) + 'deg;"></i>';
      }
      box.innerHTML = html;
      setTimeout(() => { box.innerHTML = ''; }, 1400);
    }
    function showWinCelebration(earned){
      kcKazanildi = true;
      // kahraman cikarken son kalp gittiyse acik ikinci sans / ipucu penceresi kapanir
      // (sonucu kcKazanildi yuzunden uygulanmaz); oynayan reklama dokunulmaz.
      if(window.Reklam && window.Reklam.pencereKapat) window.Reklam.pencereKapat();
      kcHideSwipeHint(false);
      kcHideTip();
      kcIpucuDizi = 0; kcIpucuIsaretKaldir();
      // reklam: bolum tamamlandi (sayac). Ozel bolumlerde de numara verilir (1-2 gecissiz).
      const bolumNo = kcCurrentLevel;
      if(window.Reklam) window.Reklam.bolumTamamlandi({ oyun: 'kacis', bolum: bolumNo });
      const txt = KC_WIN_TEXTS[Math.floor(Math.random() * KC_WIN_TEXTS.length)];
      paintBigText(document.getElementById('kcWinText'), txt, KC_WIN_GRAD);
      const gEl = document.getElementById('kcWinGold');
      if(earned > 0){
        gEl.innerHTML = window.CoinSVG(true) + '<span>+' + earned + '</span>';
        gEl.style.display = 'flex';
      } else {
        gEl.style.display = 'none';
      }
      kcOverlayEl.classList.add('show');
      burstConfetti();
      if(window.AppFX) window.AppFX.seq([[523.25,.16,.13,0],[659.25,.16,.13,90],[783.99,.16,.13,180],[1046.5,.3,.15,270]], 'triangle');
      setTimeout(() => {
        const devam = () => {
          kcOverlayEl.classList.remove('show');
          kcRenderMap();
          slideBack('kacisLevel1', kcMapKey());
        };
        // tamamlandi ekranindan cikarken gecis reklami (kurallar Reklam icinde);
        // gosterilmezse hemen, gosterilirse kapaninca haritaya donulur
        if(window.Reklam && kcEkranda()){
          window.Reklam.gecisGoster({ oyun: 'kacis', bolum: bolumNo }).then(devam, devam);
        } else devam();
      }, earned > 0 ? 1400 : 1300);
    }
    function showFailScreen(){
      kcHideSwipeHint(false);
      const txt = KC_FAIL_TEXTS[Math.floor(Math.random() * KC_FAIL_TEXTS.length)];
      paintBigText(document.getElementById('kcFailText'), txt, KC_FAIL_GRAD);
      document.getElementById('kcFailOverlay').classList.add('show');
    }
    function kcMeasure(){
      const cells = kcBoardEl.querySelectorAll('.kc-cell-bg');
      const r0 = cells[0].getBoundingClientRect();
      const r1 = cells[1].getBoundingClientRect();
      const rBelow = cells[KC_COLS].getBoundingClientRect();
      const z = kcZoom || 1;
      return { stepX: (r1.left - r0.left) / z, stepY: (rBelow.top - r0.top) / z };
    }
    function positionEyes(el, dir, w, h){
      const eyes = el.querySelectorAll('.kc-eye');
      if(eyes.length < 2) return;
      const size = Math.max(5, Math.min(w,h) * 0.16);
      eyes.forEach(e => { e.style.width = size+'px'; e.style.height = size+'px'; });
      const pad = Math.min(w,h) * 0.14;
      if(dir === 'left'){ eyes[0].style.left=pad+'px'; eyes[0].style.top=(h*0.3-size/2)+'px'; eyes[1].style.left=pad+'px'; eyes[1].style.top=(h*0.62-size/2)+'px'; }
      else if(dir === 'right'){ eyes[0].style.left=(w-pad-size)+'px'; eyes[0].style.top=(h*0.3-size/2)+'px'; eyes[1].style.left=(w-pad-size)+'px'; eyes[1].style.top=(h*0.62-size/2)+'px'; }
      else if(dir === 'up'){ eyes[0].style.top=pad+'px'; eyes[0].style.left=(w*0.3-size/2)+'px'; eyes[1].style.top=pad+'px'; eyes[1].style.left=(w*0.62-size/2)+'px'; }
      else if(dir === 'down'){ eyes[0].style.top=(h-pad-size)+'px'; eyes[0].style.left=(w*0.3-size/2)+'px'; eyes[1].style.top=(h-pad-size)+'px'; eyes[1].style.left=(w*0.62-size/2)+'px'; }
    }
    // Her yılan artık BİRDEN FAZLA hücreden oluşabilir (kırık şekiller).
    // Her hücre kendi bölümünü (segment) render eder; aynı yılana ait komşu
    // hücreler aralarındaki boşluğu (gap) kaplayacak şekilde genişler, böylece
    // kesintisiz tek bir gövde gibi görünürler.
    function kcRenderAll(){
      const {stepX, stepY} = kcMeasure();
      kcSnakes.forEach((s, si) => {
        if(s.exiting) return;
        if(s._sira === undefined) s._sira = si;      // tema renk sirasi: bolum boyunca sabit
        kcGovdeCiz(s, stepX, stepY);
        let els = kcDomEls.get(s.id);
        if(!els){ els = []; kcDomEls.set(s.id, els); }
        s.cells.forEach((cell, i) => {
          const [r,c] = cell;
          let left = c*stepX, top = r*stepY, width = stepX-KC_GAP, height = stepY-KC_GAP;
          const prev = s.cells[i-1], next = s.cells[i+1];
          [prev, next].forEach(n => {
            if(!n) return;
            const [nr,nc] = n;
            if(nr===r && nc===c-1){ left -= KC_GAP; width += KC_GAP; }
            else if(nr===r && nc===c+1){ width += KC_GAP; }
            else if(nc===c && nr===r-1){ top -= KC_GAP; height += KC_GAP; }
            else if(nc===c && nr===r+1){ height += KC_GAP; }
          });
          let el = els[i];
          if(!el){
            el = document.createElement('div');
            el.className = 'kc-snake';
            el.dataset.id = s.id; el.dataset.dir = s.dir;
            kcSnakeLayerEl.appendChild(el);          // gorunmez: govdeyi kcGovdeCiz cizer
            els[i] = el;
          }
          el.style.width = width+'px'; el.style.height = height+'px';
          el.style.left = left+'px'; el.style.top = top+'px';
          if(i === s.cells.length-1){
            if(!el.querySelector('.kc-eye')){ el.innerHTML = '<span class="kc-eye"></span><span class="kc-eye"></span>'; }
            positionEyes(el, s.dir, width, height);
          }
        });
        // Kahramanin her parcasi AYNI mutlak nokta (govde merkezi) etrafinda olceklenmeli,
        // aksi halde buyurken parcalar birbirinden ayrilir.
        if(s.isHero){
          let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
          els.forEach(el => {
            const l = parseFloat(el.style.left), t = parseFloat(el.style.top);
            const w = parseFloat(el.style.width), hh = parseFloat(el.style.height);
            minL = Math.min(minL, l); minT = Math.min(minT, t);
            maxR = Math.max(maxR, l + w); maxB = Math.max(maxB, t + hh);
          });
          const cxp = (minL + maxR) / 2, cyp = (minT + maxB) / 2;
          els.forEach(el => {
            el.style.transformOrigin = (cxp - parseFloat(el.style.left)).toFixed(1) + 'px ' +
                                       (cyp - parseFloat(el.style.top)).toFixed(1) + 'px';
          });
        }
      });
    }
    function buildOccupancy(){
      const map = new Map();
      kcSnakes.forEach(s => { if(!s.exiting) s.cells.forEach(([r,c]) => map.set(r+'_'+c, s.id)); });
      return map;
    }
    function bumpSnake(snake){
      const els = kcParcalar(snake.id); if(!els.length) return;
      const cls = 'bump-' + snake.dir;
      els.forEach(el => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); });
      setTimeout(() => els.forEach(el => el.classList.remove(cls)), 320);
    }
    function flashBlocker(blockerId){
      const g = kcBodyEls.get(blockerId); if(!g) return;
      const el = g.svg;
      el.classList.remove('blocked-flash'); void el.getBoundingClientRect(); el.classList.add('blocked-flash');
      setTimeout(() => el.classList.remove('blocked-flash'), 540);
    }
    // Çıkış yolu: yılanın kendi gövde çizgisi (kuyruk -> kafa) + kafadan
    // tahta dışına uzanan düz ışın. Her segment BU AYNI yolu takip eder,
    // aralarında sabit 1 hücre mesafeyle. Gerçekçi süzülme buradan çıkıyor.
    const KC_GLIDE_SPEED = 16;   // saniyede kaç hücre ilerlesin
    let kcGliding = 0;           // su an animasyonda olan yilan sayisi
    const kcTapQueue = [];       // animasyon sirasinda gelen tiklamalar
    function buildExitPath(snake){
      const {dr,dc} = DIR_VECTORS[snake.dir];
      const path = snake.cells.map(c => [...c]);
      let [r,c] = path[path.length-1];
      const extra = KC_ROWS + KC_COLS + snake.cells.length + 2;
      for(let i=0;i<extra;i++){ r+=dr; c+=dc; path.push([r,c]); }
      return path;
    }
    function exitSnake(snake){
      snake.exiting = true;
      kcGliding++;
      const els = kcDomEls.get(snake.id);
      if(snake.isHero && els){
        clearTimeout(heroAttentionTimer);
        kcParcalar(snake.id).forEach(el => el.classList.remove('hero-intro','hero-pulse'));
      }
      let finished = false;
      const finish = () => {
        if(finished) return;                 // ayni cikis iki kez bitirilmesin
        finished = true;
        if(els) els.forEach(el => el.remove());
        kcGovdeSil(snake.id);
        kcDomEls.delete(snake.id);
        kcSnakes = kcSnakes.filter(sn => sn.id !== snake.id);
        kcGliding = Math.max(0, kcGliding - 1);
        if(kcGliding === 0 && kcTapQueue.length){
          const nextId = kcTapQueue.shift();
          setTimeout(() => handleSnakeTap(nextId), 60);
        }
        if(kcMode === 'ozel'){
          if(kcSnakes.length === 0){
            const earned = awardOzelGold(kcCurrentLevel, kcKalpSayisi());   // ikinci sansla: 1 kalp
            if(window.AppFX) window.AppFX.vibrate([18, 45, 18]);
            showWinCelebration(earned);
          }
          return;
        }
        if(snake.isHero){
          kcUnlockedLevel = Math.max(kcUnlockedLevel, Math.min(kcCurrentLevel + 1, KC_TOTAL_LEVELS));
          const earned = awardGold(kcCurrentLevel, kcKalpSayisi());       // ikinci sansla: 1 kalp
          if(window.AppSaveProgress) window.AppSaveProgress({unlocked: kcUnlockedLevel});
          if(window.AppFX) window.AppFX.vibrate([18, 45, 18]);
          showWinCelebration(earned);
        }
      };
      if(!els || !els.length){ finish(); return; }

      // hareket azaltma tercihi: animasyon yerine kisa bir solma
      const reduce = document.querySelector('.phone.reduced-motion') ||
                     window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reduce){
        kcParcalar(snake.id).forEach(el => { el.style.transition = 'opacity .2s ease'; el.style.opacity = '0'; });
        setTimeout(finish, 240);
        return;
      }

      const {stepX, stepY} = kcMeasure();
      const path = buildExitPath(snake);
      const L = els.length;
      // kuyruk tahtayi terk ettiginde gövdenin tamami disaridadir
      let maxProgress = path.length - L;
      for(let p=0; p<=path.length-L; p++){
        const [pr,pc] = path[p];
        if(pr<0 || pr>=KC_ROWS || pc<0 || pc>=KC_COLS){ maxProgress = p + 1; break; }
      }

      // Görsel: gövde tek parça SVG çizgisi (yuvarlak uçlu/köşeli) olarak çizilir,
      // böylece hiç segment eki görünmez. Konum hesabı yine hücre bazlıdır.
      try{
        const TH = Math.min(stepX, stepY) - KC_GAP;          // gövde kalınlığı
        const cx = v => v * stepX + (stepX - KC_GAP) / 2;    // hücre merkezleri
        const cy = v => v * stepY + (stepY - KC_GAP) / 2;

        // sabit govde kalkar; ayni katmanlar suzulen cizgi olarak yeniden kurulur
        kcGovdeSil(snake.id);
        const svg = document.createElementNS(KC_NS, 'svg');
        svg.setAttribute('class', 'kc-govde kc-govde-suzulen');
        svg.style.cssText = 'left:0; top:0; width:100%; height:100%; z-index:8;';
        const cizgiler = kcCizgiKur(svg, snake, TH);
        kcSnakeLayerEl.appendChild(svg);

        // Kafa dışındaki div'ler gizlenir; kafa gözler için görünür kalır.
        const head = els[L-1];
        els.forEach((el, i) => { el.classList.add('kc-glide'); if(i !== L-1) el.style.display = 'none'; });
        head.classList.remove('bump-up', 'bump-down', 'bump-left', 'bump-right');   // transform animasyonu suzulmeyi ezmesin
        head.style.width  = (stepX - KC_GAP) + 'px';
        head.style.height = (stepY - KC_GAP) + 'px';
        head.style.zIndex = '9';
        // kafa her karede transform ile tasinir (left/top yazmak her karede yerlesim tetikliyordu)
        head.style.left = '0px'; head.style.top = '0px';
        positionEyes(head, snake.dir, stepX - KC_GAP, stepY - KC_GAP);

        let dur = Math.max(360, (maxProgress / KC_GLIDE_SPEED) * 1000);
        if(!isFinite(dur) || dur <= 0) dur = 600;
        const t0 = performance.now();
        const last = path.length - 1;
        let done = false;
        const endOnce = () => { if(done) return; done = true; svg.remove(); finish(); };
        const watchdog = setTimeout(endOnce, dur + 900);     // takılırsa bölüm kilitlenmesin
        const at = f => {
          const g  = isFinite(f) ? Math.max(0, Math.min(last, f)) : 0;   // aralik disi/NaN korumasi
          const i0 = Math.max(0, Math.min(last, Math.floor(g)));
          const i1 = Math.min(last, i0 + 1);
          const k  = g - i0;
          return [ path[i0][0] + (path[i1][0]-path[i0][0])*k,
                   path[i0][1] + (path[i1][1]-path[i0][1])*k ];
        };
        function frame(now){
          if(done) return;
          try{
            const t = Math.min(1, (now - t0) / dur);
            const p = t * (0.35 + 0.65 * t) * maxProgress;
            const tailF = p, headF = p + (L - 1);
            const tp = at(tailF), hp = at(headF);
            const pts = [tp];
            const iA = Math.max(0, Math.ceil(tailF)), iB = Math.min(last, Math.floor(headF));
            for(let i = iA; i <= iB; i++) pts.push(path[i]);
            pts.push(hp);
            const noktalar = pts.map(([r,c]) => cx(c).toFixed(1)+','+cy(r).toFixed(1)).join(' ');
            for(let q=0;q<cizgiler.length;q++) cizgiler[q].setAttribute('points', noktalar);
            head.style.transform = 'translate(' + (hp[1] * stepX) + 'px,' + (hp[0] * stepY) + 'px)';
            if(t < 1){ requestAnimationFrame(frame); return; }
          }catch(err){ console.error('kc glide hatasi:', err); }
          clearTimeout(watchdog); endOnce();
        }
        requestAnimationFrame(frame);
      }catch(err){
        console.error('kc glide kurulum hatasi:', err);
        finish();
      }
    }
    // Yılan kafasının izini takip ederek ilerler: kafa DÜZ gider, gövde aynı
    // yoldan onu izler. Bu yüzden engel kontrolü çıkışın tık tık simülasyonudur.
    // collectAll=false -> yolu kesen ilk yılanın id'si (yoksa null)
    // collectAll=true  -> yolu kesen tüm yılanların id dizisi (ipucu için)
    function simulateExit(snake, occ, collectAll){
      const {dr,dc} = DIR_VECTORS[snake.dir];
      const inBoard = (r,c) => r>=0 && r<KC_ROWS && c>=0 && c<KC_COLS;
      const cells = snake.cells.map(c => [...c]);
      const hits = [];
      const maxTicks = KC_ROWS + KC_COLS + cells.length + 2;
      for(let t=0; t<maxTicks; t++){
        if(!cells.some(([r,c]) => inBoard(r,c))) break;
        const [hr,hc] = cells[cells.length-1];
        const nr = hr+dr, nc = hc+dc;
        if(inBoard(nr,nc)){
          const occId = occ.get(nr+'_'+nc);
          if(occId && occId !== snake.id){
            if(!collectAll) return occId;
            if(hits.indexOf(occId) === -1) hits.push(occId);
          }
          for(let i=1;i<cells.length;i++){
            if(cells[i][0]===nr && cells[i][1]===nc) return collectAll ? hits : snake.id;
          }
        }
        cells.push([nr,nc]); cells.shift();
      }
      return collectAll ? hits : null;
    }
    function findBlocker(snake, occ){ return simulateExit(snake, occ, false); 
 }
    function handleSnakeTap(snakeId){
      if(kcHearts <= 0) return;
      if(kcPinch || Date.now() - kcPinchEndAt < 320) return;   // pinch sirasinda tiklama sayilmasin
      if(Date.now() - kcLongPressAt < 400) return;             // basili tutma tiklama sayilmasin
      // Birden fazla yilan ayni anda suzulebilir; cikan yilan mantiksal olarak
      // zaten tahtadan silinmis sayilir (buildOccupancy onu saymaz).
      const snake = kcSnakes.find(s => s.id === snakeId);
      if(!snake || snake.exiting) return;
      const occ = buildOccupancy();
      const blockerId = findBlocker(snake, occ);
      if(blockerId){
        bumpSnake(snake); flashBlocker(blockerId);
        if(window.AppFX){ window.AppFX.tone(210, 120, 0.15, 'sine', 0.13); window.AppFX.vibrate(32); }
        loseHeart();
      }
      else {
        const once = kcIpucuDizi > 0 ? kcCozumeKalan() : 0;
        exitSnake(snake);
        if(kcIpucuDizi > 0) kcIpucuIlerle(once);             // reklam ipucu dizisi ilerler
      }
    }
    kcSnakeLayerEl.addEventListener('click', (e) => {
      const target = e.target.closest('.kc-snake');
      if(target) handleSnakeTap(target.dataset.id);
    });
    // ---- BASILI TUT: cikis yolunu gosteren ok ----
    // Yesil = yol acik (tahta kenarina kadar), yanip sonen kirmizi = onunde engel var.
    let kcArrowEl = null, kcPressTimer = null, kcPressAt = null;
    let kcLongPressAt = 0, kcLongActive = false;
    function kcShowArrow(snakeId){
      const snake = kcSnakes.find(s => s.id === snakeId);
      if(!snake || snake.exiting) return;
      const occ = buildOccupancy();
      const {dr,dc} = DIR_VECTORS[snake.dir];
      const [hr,hc] = snake.cells[snake.cells.length-1];
      let r = hr+dr, c = hc+dc, bos = 0, engel = false;
      while(r>=0 && r<KC_ROWS && c>=0 && c<KC_COLS){
        const id = occ.get(r+'_'+c);
        const kendi = snake.cells.some(([sr,sc]) => sr===r && sc===c);
        if((id && id !== snake.id) || kendi){ engel = true; break; }
        bos++; r += dr; c += dc;
      }
      if(!kcArrowEl || !kcArrowEl.isConnected){
        kcArrowEl = document.createElement('div');
        kcArrowEl.className = 'kc-arrow';
        kcSnakeLayerEl.appendChild(kcArrowEl);
      }
      const {stepX, stepY} = kcMeasure();
      const step = dr !== 0 ? stepY : stepX;
      const kalinlik = Math.max(4, Math.round(step * 0.17));   // hücreye oranli incelik
      const ofset = step * 0.5 + KC_GAP;                       // kafadan degil, bir sonraki kareden basla
      const uc = kalinlik * 1.7;                               // ok ucunun payi
      const boy = Math.max(step * 0.3, bos * step - KC_GAP * 2 - uc);
      kcArrowEl.style.setProperty('--h', kalinlik + 'px');
      kcArrowEl.style.left  = (hc*stepX + stepX/2 + dc*ofset) + 'px';
      kcArrowEl.style.top   = (hr*stepY + stepY/2 + dr*ofset) + 'px';
      kcArrowEl.style.width = boy + 'px';
      kcArrowEl.style.transform = 'rotate(' + {right:0, down:90, left:180, up:270}[snake.dir] + 'deg)';
      kcArrowEl.classList.toggle('blocked', engel);
      kcArrowEl.classList.add('show');
      if(window.AppFX) window.AppFX.vibrate(12);
    }
    function kcHideArrow(){
      if(kcArrowEl) kcArrowEl.classList.remove('show', 'blocked');
    }
    kcSnakeLayerEl.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.kc-snake');
      if(!t) return;
      kcPressAt = { x:e.clientX, y:e.clientY };
      clearTimeout(kcPressTimer);
      kcPressTimer = setTimeout(() => {
        kcLongActive = true;
        kcShowArrow(t.dataset.id);
      }, 260);
    });
    function kcEndPress(){
      clearTimeout(kcPressTimer);
      kcPressAt = null;
      if(kcLongActive){ kcLongPressAt = Date.now(); kcLongActive = false; }  // birakma ani
      kcHideArrow();
    }
    kcSnakeLayerEl.addEventListener('pointerup', kcEndPress);
    kcSnakeLayerEl.addEventListener('pointercancel', kcEndPress);
    kcSnakeLayerEl.addEventListener('pointerleave', kcEndPress);
    kcSnakeLayerEl.addEventListener('pointermove', (e) => {
      if(!kcPressAt) return;
      if(Math.hypot(e.clientX - kcPressAt.x, e.clientY - kcPressAt.y) > 12) kcEndPress();
    });
    kcSnakeLayerEl.addEventListener('contextmenu', e => e.preventDefault());
    // Iki parmak: yakinlastir/uzaklastir. Odak noktasi parmaklarin ortasi.
    let kcPinch = null, kcPinchEndAt = 0;
    (function(){
      const outer = document.querySelector('.kc-board-wrap');
      const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      const mid  = t => ({ x:(t[0].clientX + t[1].clientX)/2, y:(t[0].clientY + t[1].clientY)/2 });

      // Odak, parmaklarin ortasinin ALTINDAKI tahta noktasidir. Nokta kutunun
      // (zoom-box) kendi konumundan olculur; boylece kutu cerceveden kucukken
      // ortalanmis olmasi da, cercevenin kenarligi da hesaba girer.
      outer.addEventListener('touchstart', e => {
        if(e.touches.length !== 2) return;
        kcEnsureZoomBox();
        const m = mid(e.touches), zb = kcZoomBox.getBoundingClientRect();
        kcPinch = {
          d0: dist(e.touches), z0: kcZoom,
          px: (m.x - zb.left) / kcZoom,
          py: (m.y - zb.top)  / kcZoom
        };
      }, {passive:false});

      outer.addEventListener('touchmove', e => {
        if(!kcPinch || e.touches.length !== 2) return;
        e.preventDefault();
        const box = kcFrameEl;
        const k = dist(e.touches) / kcPinch.d0;
        kcZoom = Math.max(kcZoomMin, Math.min(KC_ZOOM_MAX, kcPinch.z0 * k));
        kcApplyZoom();
        const m = mid(e.touches), r = box.getBoundingClientRect();
        // kutu cerceveden kucukse CSS onu ortalar; o payi da ekle
        const ox = Math.max(0, (box.clientWidth  - kcZoomBox.offsetWidth)  / 2);
        const oy = Math.max(0, (box.clientHeight - kcZoomBox.offsetHeight) / 2);
        box.scrollLeft = ox + kcPinch.px * kcZoom - (m.x - r.left - box.clientLeft);
        box.scrollTop  = oy + kcPinch.py * kcZoom - (m.y - r.top  - box.clientTop);
      }, {passive:false});

      const endPinch = () => { if(kcPinch){ kcPinch = null; kcPinchEndAt = Date.now(); } };
      outer.addEventListener('touchend', endPinch);
      outer.addEventListener('touchcancel', endPinch);
    })();
    // Yeniden boyutlanma mobilde (adres cubugu, klavye, donme) art arda cok kez
    // tetiklenir. Tahtayi ve bolum haritasini her olayda bastan kurmak yerine
    // olaylar durulunca BIR kez ciz; Kacis ekranlari sahnede degilse hic cizme
    // (harita ve bolum, ekrana girilirken zaten yeniden kurulur).
    let kcResizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(kcResizeTimer);
      kcResizeTimer = setTimeout(() => {
        const sahnede = ['screen-kacis-levels', 'screen-kacis-level1', 'screen-kacis-ozel', 'screen-kacis-mode']
          .some(id => !document.getElementById(id).classList.contains('offstage'));
        if(!sahnede) return;
        if(kcSnakes.length){ buildKcCells(); kcRenderAll(); if(kcIpucuDizi > 0) kcIpucuIsaretle(); }
        renderLevelNodes();
      }, 150);
    });
    function kcViewForLevel(n){
      const t = Math.min(1, (n - 1) / (KC_VIEW_FREEZE - 1));
      return { cols: Math.round(KC_VIEW_START.cols + t*(KC_VIEW_END.cols - KC_VIEW_START.cols)),
               rows: Math.round(KC_VIEW_START.rows + t*(KC_VIEW_END.rows - KC_VIEW_START.rows)) };
    }
    // GIRIS-BASI
    // Bolum girisinde hangi yazi gosterilir? yeniden=true (Tekrar Dene / Bastan basla) -> normal modda hicbiri.
    function girisGosterilsinMi(mod, bolum, yeniden){
      if(yeniden) return { intro: false, ipucu: null };
      if(mod === 'ozel') return { intro: false, ipucu: 'Tüm yılanları çıkar' };
      return { intro: bolum === 1, ipucu: bolum === 10 ? 'Basılı tut ve yolunu gör' : null };
    }
    // GIRIS-SONU
    let kcIntroTimer = null;
    function loadLevel(n, yeniden){
      kcCurrentLevel = n;
      kcOturum++;                // gec gelen reklam sonucu eski denemeye uygulanmasin
      kcIpucuDizi = 0; kcIpucuHedef = null;
      kcIkinciSansSoruldu = false; kcIkinciSansAlindi = false; kcKazanildi = false;
      kcSnakeLayerEl.innerHTML = '';
      kcArrowEl = null;          // katman temizlendi, ok elemani da gitti
      kcDomEls.clear();
      kcBodyEls.clear();
      const data = kcLevelSet()[n-1];
      if(!data) return;
      const view = (kcMode === 'ozel') ? (data.view || KC_VIEW_END) : kcViewForLevel(n);
      kcViewCols = view.cols; kcViewRows = view.rows;
      // Izgara: en az pencere kadar, en fazla pencere + KC_SCROLL_EXTRA.
      KC_COLS = Math.max(view.cols, data.cols);
      KC_ROWS = Math.max(view.rows, data.rows);
      const offC = Math.floor((KC_COLS - data.cols) / 2);   // deseni ortala
      const offR = Math.floor((KC_ROWS - data.rows) / 2);
      buildKcCells();
      kcHearts = KC_MAX_HEARTS;
      hintsUsedThisLevel = 0;
      renderHearts(-1);
      renderHintBtn();
      document.getElementById('kcFailOverlay').classList.remove('show');
      kcSnakes = data.snakes.map(s => {
        const cells = s.cells.map(([r,c]) => [r + offR, c + offC]);
        return {...s, cells, dir: deriveDir(cells, s.dir)};
      });
      kcOverlayEl.classList.remove('show');
      const kcGoalEl = document.getElementById('kcGoalSub');
      if(kcGoalEl) kcGoalEl.textContent = kcMode === 'ozel' ? 'Tüm Yılanları Çıkar' : 'Yeşil Yılanı Kurtar';
      if(kcLevelTitleEl) kcLevelTitleEl.textContent = (kcMode === 'ozel' ? 'Özel ' : 'Bölüm ') + n;
      kcResetZoom();
      kcRenderAll();
      kcCenterOnHero();
      kcMaybeShowSwipeHint();
      kcHideTip();
      // onceki girisin intro'su ve bekleyen 2 sn'lik gizleme zamanlayicisi yeni duruma karismasin
      clearTimeout(kcIntroTimer);
      kcIntroSplash.classList.remove('show');
      const giris = girisGosterilsinMi(kcMode, n, !!yeniden);
      if(kcMode === 'ozel'){
        if(giris.ipucu) kcShowTip(giris.ipucu, 1600);
        return;
      }
      if(giris.ipucu) kcShowTip(giris.ipucu, 1500);
      startHeroAttention(yeniden ? 0 : n);   // yeniden baslatmada intro beklenmez
      if(giris.intro){
        // ozel mod yukarida dondugu icin burasi yalnizca normal 1. bolum
        kcIntroTitle.innerHTML = twoTone('Bölüm 1', '#7FDB98', '#3FA65C');
        const introGoal = document.querySelector('.kc-intro-goal');
        if(introGoal) introGoal.textContent = '!Yeşil Yılanı Kurtar!';
        kcIntroSplash.classList.add('show');
        kcIntroTimer = setTimeout(() => kcIntroSplash.classList.remove('show'), 2000);
      }
    }

    // Bolum acilisinda kahramani bir sn buyut, sonra surekli nabza gec
    let heroAttentionTimer = null;
    function startHeroAttention(levelNo){
      clearTimeout(heroAttentionTimer);
      const els = kcParcalar('green');
      if(!els.length) return;
      els.forEach(el => el.classList.remove('hero-intro','hero-pulse'));
      const delay = levelNo === 1 ? 2050 : 160;   // 1. bolumde amac yazisi bitsin diye bekle
      heroAttentionTimer = setTimeout(() => {
        const cur = kcParcalar('green');
        if(!cur.length) return;
        cur.forEach(el => el.classList.add('hero-intro'));
        heroAttentionTimer = setTimeout(() => {
          const c2 = kcParcalar('green');
          if(!c2.length) return;
          c2.forEach(el => { el.classList.remove('hero-intro'); el.classList.add('hero-pulse'); });
        }, 1080);
      }, delay);
    }

    // ---- ek stiller: kaydirma cubuklarini gizle + kaydirma ipucu gorseli ----
    function kcInjectStyles(){
      if(document.getElementById('kcExtraStyles')) return;
      const st = document.createElement('style');
      st.id = 'kcExtraStyles';
      st.textContent = `
      /* tahta kaydirilirken sag/alt kenarda cikan kaydirma cubuklari gorunmesin */
      .kc-frame, .kc-board-wrap, .kc-zoom-box, #kcPathWrap{
        scrollbar-width: none;          /* Firefox */
        -ms-overflow-style: none;       /* eski Edge/IE */
      }
      .kc-frame::-webkit-scrollbar,
      .kc-board-wrap::-webkit-scrollbar,
      .kc-zoom-box::-webkit-scrollbar,
      #kcPathWrap::-webkit-scrollbar{ width:0; height:0; display:none; }
      .kc-frame{ overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }

      /* ilk kaydirmali bolumde cikan ogretici katman */
      .kc-swipe-hint{
        position:absolute; inset:0; z-index:30;
        display:flex; align-items:center; justify-content:center;
        background:rgba(6,18,10,.55);
        opacity:0; transition:opacity .3s ease;
        pointer-events:none;            /* oyuncu altta tahtayi kaydirabilsin */
      }
      .kc-swipe-hint.show{ opacity:1; }
      .kc-swipe-inner{ text-align:center; color:#EAF6EC; padding:0 20px; }
      .kc-swipe-inner p{ margin:12px 0 0; font-size:13.5px; line-height:1.45;
        text-shadow:0 2px 8px rgba(0,0,0,.65); }
      .kc-swipe-track{ position:relative; height:60px;
        display:flex; align-items:center; justify-content:center; gap:16px; }
      .kc-swipe-arrow{ width:24px; height:24px; color:#7FDB98; opacity:.25;
        animation:kcArrowPulse 1.9s ease-in-out infinite; }
      .kc-swipe-arrow.right{ animation-delay:.95s; }
      .kc-swipe-hand{ width:42px; height:42px; color:#FFFFFF;
        filter:drop-shadow(0 3px 6px rgba(0,0,0,.55));
        animation:kcHandSwipe 1.9s ease-in-out infinite; }
      @keyframes kcHandSwipe{
        0%,100%{ transform:translateX(0) scale(1); }
        14%{ transform:translateX(0) scale(.88); }
        40%{ transform:translateX(-46px) scale(.88); }
        64%{ transform:translateX(46px) scale(.88); }
        86%{ transform:translateX(0) scale(1); }
      }
      @keyframes kcArrowPulse{ 0%,100%{ opacity:.22; } 50%{ opacity:1; } }
      .phone.reduced-motion .kc-swipe-hand,
      .phone.reduced-motion .kc-swipe-arrow{ animation:none; opacity:.9; }
      @media (prefers-reduced-motion: reduce){
        .kc-swipe-hand, .kc-swipe-arrow{ animation:none; opacity:.9; }
      }

`;
      document.head.appendChild(st);
    }

    // ---- ilk kaydirmali bolumde "ekrani kaydir" ipucu ----
    // Oyuncu gercekten kaydirana kadar ekranda kalir; kaydirinca bir daha cikmaz.
    let kcSwipeHintEl = null, kcSwipeHintOn = false, kcSwipeHintStart = null;
    let kcSwipeHintDone = (function(){
      try { return localStorage.getItem('kcSwipeHint') === '1'; } catch(e){ return false; }
    })();
    const KC_HAND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 11.5V5.6a1.5 1.5 0 0 1 3 0v5.4"/>' +
      '<path d="M12 11V4.6a1.5 1.5 0 0 1 3 0V11"/>' +
      '<path d="M15 11.2V6.8a1.5 1.5 0 0 1 3 0V13"/>' +
      '<path d="M9 11.5v-2a1.5 1.5 0 0 0-3 0V15a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-2"/></svg>';
    const KC_CHEV_SVG = '<svg class="kc-swipe-arrow %s" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">%s</svg>';

    // ---- kisa bilgilendirme yazisi: ekran hafif kararir, yazi tema yesilinde ----
    let kcTipEl = null, kcTipTimer = null;
    function kcHideTip(){
      clearTimeout(kcTipTimer);
      if(!kcTipEl) return;
      const el = kcTipEl; kcTipEl = null;
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }
    function kcShowTip(text, ms){
      kcHideTip();
      const wrap = document.querySelector('.kc-board-wrap');
      if(!wrap) return;
      if(getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      const el = document.createElement('div');
      el.className = 'kc-tip';
      const t = document.createElement('div');
      t.className = 'kc-tip-text';
      paintBigText(t, text, ['#9BE8B0', '#3FA65C']);   // tema yesili gradyani
      el.appendChild(t);
      wrap.appendChild(el);
      kcTipEl = el;
      requestAnimationFrame(() => el.classList.add('show'));
      kcTipTimer = setTimeout(kcHideTip, (ms || 1500) + 280);
    }

    function kcHideSwipeHint(kalici){
      if(!kcSwipeHintEl) return;
      kcSwipeHintOn = false;
      const el = kcSwipeHintEl; kcSwipeHintEl = null;
      el.classList.remove('show');
      setTimeout(() => el.remove(), 320);
      if(kalici){
        kcSwipeHintDone = true;
        try { localStorage.setItem('kcSwipeHint', '1'); } catch(e){}
      }
    }
    function kcMaybeShowSwipeHint(){
      kcHideSwipeHint(false);
      if(kcSwipeHintDone) return;
      // tahta pencereye sigiyorsa kaydirmaya gerek yok
      if(KC_COLS <= kcViewCols && KC_ROWS <= kcViewRows) return;
      const wrap = document.querySelector('.kc-board-wrap');
      if(!wrap || !kcFrameEl) return;
      if(getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      const el = document.createElement('div');
      el.className = 'kc-swipe-hint';
      el.innerHTML = '<div class="kc-swipe-inner"><div class="kc-swipe-track">' +
        KC_CHEV_SVG.replace('%s', 'left').replace('%s', '<path d="M15 5 8 12l7 7"/>') +
        '<div class="kc-swipe-hand">' + KC_HAND_SVG + '</div>' +
        KC_CHEV_SVG.replace('%s', 'right').replace('%s', '<path d="M9 5l7 7-7 7"/>') +
        '</div><p>Tahta artık ekrana sığmıyor.<br>Parmağınla kaydırarak etrafına bakabilirsin.</p></div>';
      wrap.appendChild(el);
      kcSwipeHintEl = el;
      kcSwipeHintOn = true;
      kcSwipeHintStart = { x: kcFrameEl.scrollLeft, y: kcFrameEl.scrollTop };
      requestAnimationFrame(() => el.classList.add('show'));
      if(!kcFrameEl.dataset.hintBound){
        kcFrameEl.dataset.hintBound = '1';
        kcFrameEl.addEventListener('scroll', () => {
          if(!kcSwipeHintOn || !kcSwipeHintStart) return;
          if(Math.abs(kcFrameEl.scrollLeft - kcSwipeHintStart.x) > 6 ||
             Math.abs(kcFrameEl.scrollTop  - kcSwipeHintStart.y) > 6) kcHideSwipeHint(true);
        }, {passive:true});
      }
    }

    document.getElementById('kcHintBtn').addEventListener('click', kcIpucuTikla);
    document.getElementById('kcBackToMapBtn').addEventListener('click', () => {
      document.getElementById('kcFailOverlay').classList.remove('show');
      kcRenderMap();
      slideBack('kacisLevel1', kcMapKey());
    });
    document.getElementById('kcRetryBtn').addEventListener('click', () => {
      document.getElementById('kcFailOverlay').classList.remove('show');
      loadLevel(kcCurrentLevel, true);           // canlar, ipucu fiyati ve tahta sifirlanir
    });
    // Bastan basla: Tekrar Dene ile ayni sifirlama; bolum no ve coin degismez.
    // Animasyon / kutlama / yenilgi sirasinda yok sayilir (yaris olmasin).
    document.getElementById('kcBastanBtn').addEventListener('click', () => {
      if(kcGliding > 0 || kcHearts <= 0) return;
      if(kcOverlayEl.classList.contains('show')) return;
      if(document.getElementById('kcFailOverlay').classList.contains('show')) return;
      loadLevel(kcCurrentLevel, true);
    });

    // ---- OZEL BOLUMLER (sekil bolumleri) ----
    // Kilit: normal 20. bolum BITIRILMIS olmali (kacisHearts[20] > 0)
    const KC_OZEL_UNLOCK = 20;
    window.OzelBolum = {
      acikMi: function(){ return bestHeartsFor(KC_OZEL_UNLOCK) > 0; },
      sayi:   function(){ return (window.OZEL_BOLUMLER || []).length; },
      kalp:   function(n){ return ozelBest(n); },
      oyna:   function(n){
        if(!this.acikMi()) return;
        kcMode = 'ozel';
        loadLevel(n || 1);
        slideForward('kacisOzel','kacisLevel1');
      }
    };

    // ---- OZEL BOLUM SECIM IZGARASI ----
    // Kucuk onizleme: bolum verisinden dogrudan SVG. Ayni renkteki yatay hucreler
    // tek bir <rect>'te birlestirilir, boylece 20 kart da hafif kalir.
    function kcSekilSvg(b){
      const map = new Map();
      b.snakes.forEach(s => s.cells.forEach(([r, c]) => map.set(r + '_' + c, s.color)));
      let d = '';
      for(let r = 0; r < b.rows; r++){
        let c = 0;
        while(c < b.cols){
          const col = map.get(r + '_' + c);
          if(!col){ c++; continue; }
          let n = 1;
          while(map.get(r + '_' + (c + n)) === col) n++;
          d += '<rect x="' + c + '" y="' + r + '" width="' + n + '" height="1" fill="' + col + '"/>';
          c += n;
        }
      }
      return '<svg viewBox="0 0 ' + b.cols + ' ' + b.rows + '" preserveAspectRatio="xMidYMid meet" ' +
             'shape-rendering="crispEdges">' + d + '</svg>';
    }
    const KC_TICK_SVG = '<svg class="kc-ozel-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    function renderOzelGrid(){
      const grid = document.getElementById('kcOzelGrid');
      if(!grid) return;
      const list = window.OZEL_BOLUMLER || [];
      let html = '';
      list.forEach((b, i) => {
        const n = i + 1, got = ozelBest(n);
        let coins = '';
        for(let k = 1; k <= 3; k++) coins += window.CoinSVG(k <= got);
        html += '<div class="kc-ozel-card" data-level="' + n + '" role="button" tabindex="0">' +
                '<span class="kc-ozel-no">' + n + '</span>' + (got ? KC_TICK_SVG : '') +
                '<div class="kc-ozel-thumb">' + kcSekilSvg(b) + '</div>' +
                '<div class="kc-ozel-name">' + b.ad + '</div>' +
                '<div class="kc-ozel-coins">' + coins + '</div></div>';
      });
      grid.innerHTML = html;
      grid.querySelectorAll('.kc-ozel-card').forEach(el => {
        const lvl = Number(el.dataset.level);
        const go = () => { loadLevel(lvl); slideForward('kacisOzel', 'kacisLevel1'); };
        el.addEventListener('click', go);
        el.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') go(); });
      });
    }
    // Iki modun harita ekrani farkli: normalde patika, ozelde sekil izgarasi.
    function kcMapKey(){ return kcMode === 'ozel' ? 'kacisOzel' : 'kacisLevels'; }
    function kcRenderMap(){ if(kcMode === 'ozel') renderOzelGrid(); else renderLevelNodes(); }
    window.Kacis = { haritaAnahtari: kcMapKey, haritaYenile: kcRenderMap };

    // ---- MOD SECIM EKRANI (Bolumler / Ozel Bolumler) ----
    function kcOzelAcik(){ return bestHeartsFor(KC_OZEL_UNLOCK) > 0; }
    function kcSayac(ozel){
      const rec = (window.AppProgress && window.AppProgress.kacisHearts) || {};
      const total = (ozel ? (window.OZEL_BOLUMLER || []) : kcLevelsData).length;
      let done = 0;
      for(let i = 1; i <= total; i++) if(rec[(ozel ? 'o' : '') + i] > 0) done++;
      return done + ' / ' + total + ' bölüm';
    }
    function renderModeScreen(){
      const nMeta = document.getElementById('kcModeNormalMeta');
      const oCard = document.getElementById('kcModeOzel');
      const oMeta = document.getElementById('kcModeOzelMeta');
      if(nMeta) nMeta.textContent = kcSayac(false);
      const acik = kcOzelAcik();
      if(oCard) oCard.classList.toggle('locked', !acik);
      if(oMeta) oMeta.textContent = acik ? kcSayac(true) : (KC_OZEL_UNLOCK + '. bölümü geç');
    }
    function kcOpenMap(mod){
      kcMode = mod;
      kcRenderMap();
      slideForward('kacisMode', kcMapKey());
    }
    document.getElementById('kcModeNormal').addEventListener('click', () => kcOpenMap('normal'));
    document.getElementById('kcModeOzel').addEventListener('click', function(){
      if(!kcOzelAcik()){
        this.classList.remove('shake'); void this.offsetWidth; this.classList.add('shake');
        if(window.AppFX){ window.AppFX.tone(200, 130, 0.14, 'sine', 0.12); window.AppFX.vibrate(30); }
        return;
      }
      kcOpenMap('ozel');
    });
    // core.js'in ekrani acmadan once cagirabilmesi icin disari aciyoruz
    window.KacisMod = { yenile: renderModeScreen };

    if(window.AppReset){
      window.AppReset.push(function(){
        kcMode = 'normal'; kcUnlockedLevel = 1;
        kcMapScroll = {normal:null, ozel:null};
        renderModeScreen(); renderLevelNodes(); loadLevel(1);
      });
    }
    kcInjectStyles();
    buildJungleDecor('kcJungle','kcRain');
    buildJungleDecor('kcModeJungle','kcModeRain');
    buildJungleDecor('kcOzelJungle','kcOzelRain');
    renderModeScreen();
    // Ozel bolum izgarasi (20 kart, ~3400 oge) acilista KURULMAZ: ozel harita her acilista (kcOpenMap) ve oraya her
    // donuste (core.js EKRAN_YENILE -> Kacis.haritaYenile) zaten yeniden kurulur.
    renderLevelNodes();
    loadLevel(1);
  })();