'use strict';
const $ = s => document.querySelector(s);
const rowsEl = $('#rows');
const fmt = (n,d=2)=> (isFinite(n)?n:0).toLocaleString('sk-SK',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmt0 = n => (isFinite(n)?Math.round(n):0).toLocaleString('sk-SK');

// paleta farieb pre segmenty rezov (podľa dĺžky)
const COLORS = ['#ff8a3d','#3ddc97','#4db8ff','#ffd166','#c792ff','#ff6b9d','#7ee787','#f78c6b'];
// paleta farieb pre výrobné listy (VL) — výraznejšie, oddelené od COLORS
const VL_COLORS = ['#ff8a3d','#3ddc97','#4db8ff','#ffd166','#c792ff','#ff6b9d','#7ee787','#f78c6b','#ff5252','#00bcd4','#b388ff','#cddc39'];

const STORE = 'klik-panel-calc-v2';

// mapovanie VL číslo -> farba (stabilné podľa poradia prvého výskytu)
let vlColorMap = {};
function vlColor(vl){
  vl = (vl||'').trim();
  if(!vl) return '#8aa4b8'; // sivá pre "bez VL"
  if(!(vl in vlColorMap)){
    const idx = Object.keys(vlColorMap).length % VL_COLORS.length;
    vlColorMap[vl] = VL_COLORS[idx];
  }
  return vlColorMap[vl];
}
function rebuildVlColors(){
  // prebuduje mapu podľa aktuálneho poradia riadkov (zachová konzistentné farby)
  const seen = [];
  [...rowsEl.children].forEach(tr=>{
    const vl = tr.querySelector('.i-vl').value.trim();
    if(vl && !seen.includes(vl)) seen.push(vl);
  });
  const newMap = {};
  seen.forEach((vl,i)=> newMap[vl] = VL_COLORS[i % VL_COLORS.length]);
  vlColorMap = newMap;
}

function newRow(vl='', name='', len='', qty=''){
  const tr = document.createElement('tr');
  tr.innerHTML =
    `<td class="vlcell"><input class="i-vl" placeholder="napr. 1335803" value="${vl}"></td>
     <td><input class="i-name" placeholder="napr. A1" value="${name}"></td>
     <td><input class="i-len num" type="number" inputmode="numeric" placeholder="0" value="${len}"></td>
     <td><input class="i-qty num" type="number" inputmode="numeric" placeholder="0" value="${qty}"></td>
     <td><button class="rowbtn no-print" title="Odstrániť">✕</button></td>`;
  tr.querySelector('.rowbtn').onclick = ()=>{ tr.remove(); if(!rowsEl.children.length) newRow(); refresh(); };
  tr.querySelectorAll('input').forEach(i=> i.addEventListener('input', refresh));
  rowsEl.appendChild(tr);
  return tr;
}

function readItems(){
  return [...rowsEl.children].map(tr=>({
    vl:   tr.querySelector('.i-vl').value.trim(),
    name: tr.querySelector('.i-name').value.trim(),
    len:  parseFloat(tr.querySelector('.i-len').value)||0,
    qty:  parseInt(tr.querySelector('.i-qty').value)||0
  })).filter(r=> r.len>0 && r.qty>0);
}

// Vyvážené rozdelenie kusov na `n` pásov (greedy LPT).
// VL sa MÔŽU miešať na páse (cieľ = minimálny odpad), ale každý kus si nesie svoje VL.
function balanceStrips(pieces, n){
  const flat = [];
  pieces.forEach(p=>{ for(let i=0;i<p.qty;i++) flat.push({name:p.name, len:p.pieceLen, base:p.len, vl:p.vl}); });
  flat.sort((a,b)=> b.len - a.len);
  const strips = Array.from({length:n}, ()=>({items:[], total:0}));
  for(const pc of flat){
    let t = strips[0];
    for(const s of strips){ if(s.total < t.total) t = s; }
    t.items.push(pc); t.total += pc.len;
  }
  return strips;
}

let lastCalc = null; // pre export

function calc(){
  const mode = parseFloat($('#mode').value);
  const delenie = $('#delenie').value;
  const masterWmm = parseFloat($('#masterW').value)||1250;
  const splits = Math.max(1, parseInt($('#splits').value)||2);
  const stripWmm = masterWmm/splits;
  $('#stripW').value = Math.round(stripWmm);
  const masterW = masterWmm/1000;
  const usefulW = (parseFloat($('#usefulW').value)||500)/1000;
  const bend = parseFloat($('#bend').value)||0;
  const reserve = (parseFloat($('#reserve').value)||0)/100;
  const delAdj = (delenie==='VARIOBEND') ? 0.1 : 0;

  const items = readItems();

  let bm=0, bmBend=0, totalPcs=0;
  const pieces = items.map(r=>{
    const runm = r.len/1000 * r.qty;
    const runmBend = runm + r.qty*bend;
    bm += runm; bmBend += runmBend; totalPcs += r.qty;
    const pieceLen = r.len/1000 + bend;
    return {...r, pieceLen};
  });

  const area = bm * usefulW;

  const strips = pieces.length ? balanceStrips(pieces, splits) : [];
  const totals = strips.map(s=>s.total);
  const maxStrip = totals.length ? Math.max(...totals) : 0;
  const minStrip = totals.length ? Math.min(...totals) : 0;
  const diff = maxStrip - minStrip;

  const masterLen = maxStrip * (1+reserve);
  const matArea = masterW * masterLen;
  const usedRoll = bmBend;
  const boughtRoll = maxStrip * splits;
  const wastePct = boughtRoll>0 ? (1 - usedRoll/boughtRoll)*100 : 0;

  // zoznam VL (unikátne, v poradí výskytu)
  const vlList = [];
  items.forEach(r=>{ const v=r.vl||'(bez VL)'; if(!vlList.includes(v)) vlList.push(v); });

  $('#rBm').innerHTML = fmt(bm)+' <small>bm</small>';
  $('#rBmB').innerHTML = fmt(bmBend)+' <small>bm</small>';
  $('#rArea').innerHTML = fmt(area)+' <small>m²</small>';
  $('#rMat').innerHTML = fmt(matArea)+' <small>m² s rez.</small>';
  $('#rCoilLen').innerHTML = fmt(masterLen)+' <small>bm</small>';
  $('#rWaste').innerHTML = fmt(wastePct,1)+' <small>%</small>';

  $('#rSummary').innerHTML =
    `Panelov: <b>${totalPcs} ks</b> · Riadkov: ${items.length} · Paliet (VL): <b>${vlList.length}</b> · `+
    `Režim: <b>${mode===1.6?'PC tabuľka':'Ručný'}</b> · Delenie: <b>${delenie}</b>`+
    (delAdj?` (−0,1 m)`:``)+
    ` · Vstup ${Math.round(masterWmm)} mm → ${splits}× ${Math.round(stripWmm)} mm`+
    ` · Rezerva ${Math.round(reserve*100)} %`;

  renderStrips(strips, maxStrip, stripWmm, diff);

  lastCalc = {
    items, pieces, strips, maxStrip, stripWmm, splits, masterWmm,
    bm, bmBend, area, matArea, masterLen, wastePct, diff, bend,
    mode, delenie, reserve, usefulW, vlList
  };
}

function renderStrips(strips, maxLen, stripWmm, diff){
  const box = $('#cutlist');
  if(!strips.length || maxLen<=0){
    box.innerHTML = '<div style="color:var(--muted);font-size:.85rem">Zatiaľ žiadne dáta.</div>'; return;
  }

  let html = `<div class="foot" style="margin:0 0 10px">`+
    `<span>Rozdiel medzi pásmi: <b style="color:${diff<=0.001?'var(--accent2)':'var(--accent)'}">${fmt(diff)} bm</b> <small>(cieľ: čo najmenej)</small></span>`+
    `</div>`;

  strips.forEach((s,idx)=>{
    const waste = Math.max(0, maxLen - s.total);
    let segs='';
    s.items.forEach(it=>{
      const w = (it.len/maxLen*100);
      const col = vlColor(it.vl);
      const vlLbl = it.vl ? `VL ${it.vl}` : 'bez VL';
      segs += `<div class="seg" style="width:${w}%;background:${col}" title="${vlLbl} · ${it.name||'panel'} · ${it.base} mm">${it.base}</div>`;
    });
    if(waste>0.001){
      segs += `<div class="seg waste" style="width:${waste/maxLen*100}%">odpad ${fmt(waste)} m</div>`;
    }
    html += `<div class="coil">
       <div class="head">
         <span><b style="color:var(--ink)">Pás ${idx+1}</b> · ${Math.round(stripWmm)} mm · ${s.items.length} ks</span>
         <span>${fmt(s.total)} bm</span>
       </div>
       <div class="bar">${segs}</div>
     </div>`;
  });

  box.innerHTML = html;
}

function renderVlLegend(){
  const box = $('#vlLegend');
  const items = readItems();
  const vls = [];
  items.forEach(r=>{ const v=r.vl.trim(); if(v && !vls.includes(v)) vls.push(v); });
  if(!vls.length){ box.innerHTML=''; return; }
  box.innerHTML = '<div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Výrobné listy (palety):</div>'+
    vls.map(v=>`<span class="vlpill"><span class="swatch" style="background:${vlColor(v)}"></span>VL ${v}</span>`).join('');
}

function refresh(){
  rebuildVlColors();
  // farebná bodka v poli VL
  [...rowsEl.children].forEach(tr=>{
    const inp = tr.querySelector('.i-vl');
    const v = inp.value.trim();
    inp.style.borderLeft = v ? `6px solid ${vlColor(v)}` : '';
  });
  calc();
  renderVlLegend();
  save();
}

function save(){
  const data = {
    items: [...rowsEl.children].map(tr=>({
      vl:tr.querySelector('.i-vl').value,
      name:tr.querySelector('.i-name').value,
      len:tr.querySelector('.i-len').value,
      qty:tr.querySelector('.i-qty').value
    })),
    mode:$('#mode').value, delenie:$('#delenie').value,
    masterW:$('#masterW').value, splits:$('#splits').value,
    usefulW:$('#usefulW').value, bend:$('#bend').value, reserve:$('#reserve').value
  };
  try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch(e){}
}

function load(){
  let d=null; try{ d=JSON.parse(localStorage.getItem(STORE)); }catch(e){}
  if(d){
    $('#mode').value=d.mode||'1.6'; $('#delenie').value=d.delenie||'VDL';
    if(d.masterW) $('#masterW').value=d.masterW;
    if(d.splits) $('#splits').value=d.splits;
    // migrácia: staré uložené krytie 500 mm bolo nesprávne, správne je 536 mm (KLIK panel)
    let uw = d.usefulW || 536;
    if(String(uw)==='500') uw = 536;
    $('#usefulW').value=uw; $('#bend').value=d.bend||0.046; $('#reserve').value=d.reserve||5;
    (d.items||[]).forEach(r=> newRow(r.vl||'', r.name,r.len,r.qty));
  }
  if(!rowsEl.children.length){ newRow(); }
}

function demo(){
  rowsEl.innerHTML='';
  vlColorMap = {};
  newRow('1335803','5860 · odkvap', 5860, 18);
  newRow('1335803','4600 · odkvap', 4600, 10);
  newRow('1335803','4500 · odkvap', 4500, 18);
  newRow('1400001','A – plocha',    4200, 8);
  newRow('1400001','B – vikier',    2650, 6);
  refresh();
}

// ---------- wiring základ ----------
$('#addRow').onclick = ()=>{ newRow(); refresh(); };
$('#demo').onclick = demo;
$('#clear').onclick = ()=>{ rowsEl.innerHTML=''; vlColorMap={}; newRow(); refresh(); };
$('#print').onclick = ()=> window.print();
['mode','delenie','masterW','splits','usefulW','bend','reserve'].forEach(id=>
  $('#'+id).addEventListener('input', refresh));

load();
refresh();

// ================= OCR =================
// kontrola knižníc
function checkLibs(){
  const hasT = (typeof Tesseract !== 'undefined');
  const hasX = (typeof ExcelJS !== 'undefined');
  const hasP = (typeof pdfjsLib !== 'undefined');
  // banner ukážeme ak chýba OCR alebo PDF knižnica
  $('#libWarn').classList.toggle('hidden', hasT && hasP);
  return {hasT, hasX, hasP};
}
checkLibs();

// Parser textu z výrobného listu(ov).
// Zvláda VIAC výrobných listov v jednom súbore (napr. PDF s viacerými stranami).
// Rozdelí text podľa značiek *1/XXXXXXX/0* na bloky = jednotlivé VL,
// z každého bloku vytiahne rozmery (len po sekciu MATERIÁLY, aby ignoroval materiálové čísla).
// Vracia { lists: [ {vl, rows:[{len,qty}]} ], vl (prvé), rows (prvé - pre spätnú kompatibilitu) }
function parseVyrobnyList(text){
  const lists = parseMultiVL(text);
  const first = lists[0] || {vl:'', rows:[]};
  return { lists, vl:first.vl, rows:first.rows };
}

function parseMultiVL(text){
  const marker = /\*\s*\d+\s*\/\s*(\d{5,8})\s*\/\s*\d+\s*\*/g;
  const marks = [];
  let m;
  while((m = marker.exec(text)) !== null){
    marks.push({vl:m[1], idx:m.index});
  }
  const blocks = [];
  if(marks.length === 0){
    // žiadna značka — skúsime nájsť VL inak a berieme celý text ako jeden blok
    let vl = '';
    let mm = text.match(/V[ýy]robn[ýy]\s*list[^0-9]{0,20}(\d{5,8})/i);
    if(mm) vl = mm[1];
    if(!vl){ mm = text.match(/\b(\d{6,8})\b/); if(mm) vl = mm[1]; }
    blocks.push({vl, text});
  } else {
    for(let i=0;i<marks.length;i++){
      const start = marks[i].idx;
      const end = (i+1<marks.length) ? marks[i+1].idx : text.length;
      blocks.push({vl:marks[i].vl, text:text.slice(start,end)});
    }
  }
  const result = [];
  for(const b of blocks){
    let t = b.text;
    // odrežeme sekciu MATERIÁLY a ďalej (tam sú materiálové čísla, nie rozmery)
    const matIdx = t.search(/MATERI[ÁA]LY/i);
    if(matIdx > 0) t = t.slice(0, matIdx);
    const lineRe = /(\d{3,5})\s+(\d{1,4})\s*ks/gi;
    let lm; const seen = new Set(); const rows = [];
    while((lm = lineRe.exec(t)) !== null){
      const len = parseInt(lm[1],10);
      const qty = parseInt(lm[2],10);
      if(len>=300 && len<=12000 && qty>0 && qty<=999){
        const key = len+'_'+qty;
        if(!seen.has(key)){ seen.add(key); rows.push({len, qty}); }
      }
    }
    if(rows.length) result.push({vl:b.vl, rows});
  }
  return result;
}

// nastavenie workera pre pdf.js (ak je knižnica prítomná)
// pdf.js môže byť vystavený ako window.pdfjsLib (legacy) — s tým pracujeme
if(typeof pdfjsLib !== 'undefined'){
  try{ pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; }catch(e){}
  // ak worker súbor chýba, pdf.js vie bežať aj bez neho (pomalšie) — vypneme worker
  try{
    if(pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.disableWorker = true;
    }
  }catch(e){}
}

// spustí OCR na danom zdroji (File alebo canvas/dataURL) a vráti text
async function ocrRecognize(src, status){
  const { data } = await Tesseract.recognize(src, 'slk+eng', {
    logger: m => {
      if(m.status==='recognizing text'){
        status.innerHTML = `<span class="spin"></span> Rozpoznávam text… ${Math.round(m.progress*100)} %`;
      }
    }
  });
  return data.text || '';
}

// spracovanie PDF: skúsi textovú vrstvu, inak prevedie stránky na obrázok a OCR
async function handlePdf(file, status, prev){
  if(typeof pdfjsLib === 'undefined'){
    status.innerHTML = '⚠ Knižnica na PDF (pdf.js) nie je načítaná. Skontroluj priečinok lib/ podľa návodu.';
    return null;
  }
  status.innerHTML = '<span class="spin"></span> Otváram PDF…';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;

  // 1) skúsime textovú vrstvu zo všetkých stránok
  let allText = '';
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    allText += ' ' + tc.items.map(it=>it.str).join(' ');
  }
  const hasText = allText.replace(/\s/g,'').length > 30; // dosť textu = textové PDF

  // náhľad: vyrenderujeme prvú stránku ako obrázok (nech používateľ vidí, čo číta)
  let firstCanvas = null;
  try{
    const page1 = await pdf.getPage(1);
    const vp = page1.getViewport({scale:2});
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page1.render({canvasContext:canvas.getContext('2d'), viewport:vp}).promise;
    prev.src = canvas.toDataURL('image/png');
    firstCanvas = canvas;
  }catch(e){}

  if(hasText){
    status.innerHTML = '✓ PDF má textovú vrstvu — čítam priamo (bez OCR).';
    return allText;
  }

  // 2) skenované PDF -> OCR cez vyrenderovaný obrázok
  const {hasT} = checkLibs();
  if(!hasT){
    status.innerHTML = '⚠ PDF je skenované (bez textu) a OCR knižnica nie je načítaná. Prepíš dáta ručne.';
    return null;
  }
  status.innerHTML = '<span class="spin"></span> PDF je skenované — spúšťam OCR…';
  let ocrText = '';
  const maxPages = Math.min(pdf.numPages, 3); // rozumný limit
  for(let p=1; p<=maxPages; p++){
    const page = await pdf.getPage(p);
    const vp = page.getViewport({scale:2});
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({canvasContext:canvas.getContext('2d'), viewport:vp}).promise;
    ocrText += ' ' + await ocrRecognize(canvas, status);
  }
  return ocrText;
}

$('#ocrFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const box = $('#ocrBox'), prev = $('#ocrPrev'), status = $('#ocrStatus'), result = $('#ocrResult');
  box.classList.remove('hidden');
  result.innerHTML = '';
  prev.src = '';

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  try{
    let text = null;
    if(isPdf){
      text = await handlePdf(file, status, prev);
    }else{
      // obrázok
      prev.src = URL.createObjectURL(file);
      const {hasT} = checkLibs();
      if(!hasT){
        status.innerHTML = '⚠ OCR knižnica nie je načítaná — obrázok vidíš ako pomôcku, dáta prepíš ručne do tabuľky nižšie.';
        showOcrResult({vl:'', rows:[]});
        return;
      }
      status.innerHTML = '<span class="spin"></span> Čítam obrázok (OCR)…';
      text = await ocrRecognize(file, status);
    }

    if(text === null){ // knižnica chýbala, hláška už je nastavená
      showOcrResult({vl:'', rows:[]});
      return;
    }

    const parsed = parseVyrobnyList(text);
    showOcrResult(parsed);
    const src = isPdf ? 'PDF' : 'obrázok';
    const nLists = (parsed.lists && parsed.lists.length) ? parsed.lists.length : 0;
    const nRows = (parsed.lists||[]).reduce((a,l)=>a+l.rows.length,0);
    status.innerHTML = nRows
      ? `✓ Hotovo (${src}). Nájdené: <b>${nLists}</b> ${nLists===1?'výrobný list':'výrobné listy'}, spolu ${nRows} rozmerov. Skontroluj a potvrď.`
      : `⚠ Z ${src} sa nepodarilo spoľahlivo prečítať rozmery. Skontroluj náhľad a zadaj ručne.`;
  }catch(err){
    status.innerHTML = '⚠ Chyba pri čítaní: '+err.message;
    showOcrResult({vl:'', rows:[]});
  }
});

function showOcrResult(parsed){
  const result = $('#ocrResult');
  // normalizácia: vždy pracujeme so zoznamom listov
  let lists = (parsed.lists && parsed.lists.length) ? parsed.lists : null;
  if(!lists){
    lists = [{ vl: parsed.vl||'', rows: parsed.rows||[] }];
  }
  // ak úplne nič, aspoň jeden prázdny list na ručné zadanie
  if(!lists.length) lists = [{vl:'', rows:[]}];

  const listHtml = lists.map((lst, li)=>{
    let rowsHtml = (lst.rows||[]).map(r=>
      `<tr>
         <td><input class="ocr-len" type="number" value="${r.len}" style="width:100%"></td>
         <td><input class="ocr-qty" type="number" value="${r.qty}" style="width:100%"></td>
       </tr>`).join('');
    if(!rowsHtml){
      rowsHtml = `<tr>
         <td><input class="ocr-len" type="number" placeholder="dĺžka mm" style="width:100%"></td>
         <td><input class="ocr-qty" type="number" placeholder="ks" style="width:100%"></td>
       </tr>`;
    }
    const ksSum = (lst.rows||[]).reduce((a,r)=>a+r.qty,0);
    return `
      <div class="ocr-list" data-li="${li}" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="flex:1">
            <label>Číslo výrobného listu (VL) ${lists.length>1?`— list ${li+1}/${lists.length}`:''}</label>
            <input class="ocr-vl" value="${lst.vl||''}" placeholder="napr. 1335803">
          </div>
          <div style="font-size:.72rem;color:var(--muted);white-space:nowrap;padding-top:16px">
            ${(lst.rows||[]).length} rozm. · ${ksSum} ks
          </div>
        </div>
        <table class="ocrtable">
          <thead><tr><th class="num">Dĺžka (mm)</th><th class="num">Počet ks</th></tr></thead>
          <tbody class="ocr-rows">${rowsHtml}</tbody>
        </table>
        <div class="btnrow">
          <button class="btn ghost ocr-addrow" type="button">+ Riadok</button>
        </div>
      </div>`;
  }).join('');

  const multiNote = lists.length>1
    ? `<div style="font-size:.8rem;color:var(--accent2);margin-top:6px">✓ Nájdených ${lists.length} výrobných listov — každý dostane vlastnú farbu (paletu).</div>`
    : '';

  result.innerHTML = `
    ${multiNote}
    <div id="ocrLists">${listHtml}</div>
    <div class="btnrow">
      <button class="btn" id="ocrConfirm" type="button">✓ Vložiť všetko do súpisu</button>
    </div>`;

  // pridávanie riadku v rámci konkrétneho listu
  result.querySelectorAll('.ocr-addrow').forEach(btn=>{
    btn.onclick = ()=>{
      const tb = btn.closest('.ocr-list').querySelector('.ocr-rows');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input class="ocr-len" type="number" style="width:100%"></td>
                      <td><input class="ocr-qty" type="number" style="width:100%"></td>`;
      tb.appendChild(tr);
    };
  });

  $('#ocrConfirm').onclick = ()=>{
    const existing = readItems();
    if(existing.length===0){ rowsEl.innerHTML=''; }
    let added = 0, vlCount = 0;
    result.querySelectorAll('.ocr-list').forEach(listEl=>{
      const vlv = listEl.querySelector('.ocr-vl').value.trim();
      const lens = [...listEl.querySelectorAll('.ocr-len')];
      const qtys = [...listEl.querySelectorAll('.ocr-qty')];
      let listAdded = 0;
      lens.forEach((li,idx)=>{
        const len = parseFloat(li.value)||0;
        const qty = parseInt(qtys[idx].value)||0;
        if(len>0 && qty>0){ newRow(vlv, '', len, qty); listAdded++; }
      });
      if(listAdded>0) vlCount++;
      added += listAdded;
    });
    if(!rowsEl.children.length) newRow();
    refresh();
    $('#ocrStatus').innerHTML = `✓ Vložené ${added} rozmerov z ${vlCount} výrobných listov do súpisu.`;
  };
}

// ================= EXPORT XLSX =================
$('#exportXlsx').onclick = ()=>{
  const {hasX} = checkLibs();
  $('#xlsxWarn').classList.toggle('hidden', hasX);
  if(!hasX) return;
  if(!lastCalc || !lastCalc.items.length){ alert('Najprv zadaj rozmery.'); return; }
  buildXlsx(lastCalc);
};

function argbFromHex(hex){ // '#ff8a3d' -> 'FFff8a3d'
  return 'FF' + hex.replace('#','').toUpperCase();
}
function buildXlsx(c){
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KLIK PANEL';
  wb.created = new Date();

  const HEADER_FILL = 'FF1D465F';
  const HEADER_FONT = { bold:true, color:{argb:'FFEAF3FA'} };

  function styleHeaderRow(row){
    row.eachCell(cell=>{
      cell.font = HEADER_FONT;
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:HEADER_FILL} };
      cell.alignment = { horizontal:'center', vertical:'middle' };
      cell.border = { bottom:{style:'thin', color:{argb:'FF2A5877'}} };
    });
  }
  function fillRow(row, argb){
    row.eachCell(cell=>{
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb} };
      cell.font = { color:{argb:'FF08202F'} };
    });
  }

  // ================= List 1: SÚPIS ROZMEROV =================
  // Zoskupenie rovnakých rozmerov LEN v rámci toho istého VL.
  const ws1 = wb.addWorksheet('Súpis rozmerov');
  ws1.columns = [
    {header:'Výrobný list', key:'vl', width:16},
    {header:'Rozmer (mm)', key:'len', width:14},
    {header:'Počet ks', key:'qty', width:12},
    {header:'bm', key:'bm', width:12},
  ];
  styleHeaderRow(ws1.getRow(1));

  const grpMap = new Map();
  c.items.forEach(r=>{
    const vl = r.vl || '(bez VL)';
    const key = vl + '|' + r.len;
    if(grpMap.has(key)) grpMap.get(key).qty += r.qty;
    else grpMap.set(key, {vl, len:r.len, qty:r.qty});
  });
  const vlOrder = [];
  c.items.forEach(r=>{ const v=r.vl||'(bez VL)'; if(!vlOrder.includes(v)) vlOrder.push(v); });
  const supItems = [];
  vlOrder.forEach(vl=>{
    [...grpMap.values()].filter(g=>g.vl===vl).sort((a,b)=>b.len-a.len).forEach(g=>supItems.push(g));
  });

  supItems.forEach(g=>{
    const bm = g.len/1000 * g.qty;
    const row = ws1.addRow({vl:g.vl, len:g.len, qty:g.qty, bm:+bm.toFixed(2)});
    fillRow(row, argbFromHex(vlColor(g.vl==='(bez VL)'?'':g.vl)));
  });
  const totQty = supItems.reduce((s,r)=>s+r.qty,0);
  const totBm = supItems.reduce((s,r)=>s+r.len/1000*r.qty,0);
  const totRow1 = ws1.addRow({vl:'SPOLU', len:'', qty:totQty, bm:+totBm.toFixed(2)});
  totRow1.eachCell(cell=>{ cell.font = {bold:true}; cell.border={top:{style:'thin',color:{argb:'FF2A5877'}}}; });

  // ================= List 2: ROZDELENIE NA PÁSY =================
  const ws2 = wb.addWorksheet('Rozdelenie na pásy');
  ws2.columns = [
    {header:'Pás', key:'pas', width:14},
    {header:'Výrobný list', key:'vl', width:16},
    {header:'Rozmer (mm)', key:'len', width:14},
    {header:'Počet ks', key:'qty', width:12},
    {header:'bm spolu', key:'bm', width:12},
  ];
  styleHeaderRow(ws2.getRow(1));

  c.strips.forEach((s,idx)=>{
    const gm = new Map();
    s.items.forEach(it=>{
      const vl = it.vl || '(bez VL)';
      const key = vl + '|' + it.base;
      if(gm.has(key)){ const g=gm.get(key); g.qty+=1; g.bm+=it.len; }
      else gm.set(key, {vl, base:it.base, qty:1, bm:it.len});
    });
    const vlSeen = [];
    s.items.forEach(it=>{ const v=it.vl||'(bez VL)'; if(!vlSeen.includes(v)) vlSeen.push(v); });
    vlSeen.forEach(vl=>{
      [...gm.values()].filter(g=>g.vl===vl).sort((a,b)=>b.base-a.base).forEach(g=>{
        const row = ws2.addRow({pas:idx+1, vl:g.vl, len:g.base, qty:g.qty, bm:+g.bm.toFixed(2)});
        if(g.vl!=='(bez VL)') fillRow(row, argbFromHex(vlColor(g.vl)));
      });
    });
    const totRow = ws2.addRow({pas:`Pás ${idx+1} spolu`, vl:'', len:'', qty:'', bm:+s.total.toFixed(2)});
    totRow.eachCell(cell=>{ cell.font={bold:true}; });
    ws2.addRow({}); // medzera
  });

  // ================= List 3: SÚHRN =================
  const ws3 = wb.addWorksheet('Súhrn');
  ws3.columns = [{width:34},{width:16}];
  const titleRow = ws3.addRow(['Súhrn prepočtu','']);
  titleRow.getCell(1).font = {bold:true, size:13};
  const sumRows = [
    ['Bežné metre (bm)', +c.bm.toFixed(2)],
    ['bm s ohybom', +c.bmBend.toFixed(2)],
    ['Krytá plocha (m²)', +c.area.toFixed(2)],
    ['Plocha materiálu s rezervou (m²)', +c.matArea.toFixed(2)],
    ['Dĺžka vstupného zvitku (bm)', +c.masterLen.toFixed(2)],
    ['Odpad materiálu (%)', +c.wastePct.toFixed(1)],
    ['Rozdiel medzi pásmi (bm)', +c.diff.toFixed(2)],
    ['Počet pásov', c.splits],
    ['Šírka pásu (mm)', Math.round(c.stripWmm)],
    ['Šírka vstupného zvitku (mm)', Math.round(c.masterWmm)],
    ['Počet paliet (VL)', c.vlList.length],
    ['Režim', c.mode===1.6?'PC tabuľka':'Ručný'],
    ['Delenie', c.delenie],
    ['Rezerva (%)', Math.round(c.reserve*100)],
    ['Ohyb (m/ks)', c.bend],
  ];
  sumRows.forEach(r=>{ const row=ws3.addRow(r); row.getCell(1).font={bold:false}; });

  // farebná legenda VL na spodok súhrnu
  ws3.addRow([]);
  const legRow = ws3.addRow(['Legenda paliet (VL):','']);
  legRow.getCell(1).font = {bold:true};
  c.vlList.forEach(vl=>{
    if(vl==='(bez VL)') return;
    const row = ws3.addRow(['VL '+vl, '']);
    row.getCell(1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:argbFromHex(vlColor(vl))} };
    row.getCell(1).font = { color:{argb:'FF08202F'}, bold:true };
  });

  // ================= stiahnutie =================
  const d = new Date();
  const stamp = d.toISOString().slice(0,10);
  const vlPart = c.vlList.length===1 ? ('_VL'+c.vlList[0]) : '';
  const fname = `klik-panel_delenie${vlPart}_${stamp}.xlsx`;
  wb.xlsx.writeBuffer().then(buf=>{
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  }).catch(err=>{
    alert('Chyba pri vytváraní Excelu: '+err.message);
  });
}
