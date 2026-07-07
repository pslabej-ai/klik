#!/usr/bin/env node
// Zostaví jeden samostatný index.html zo zdrojov (index.template.html + app.js + lib/*).
// Spusti: node build.mjs
// Výstup: index.html (prepíše existujúci) — jediný súbor, funguje aj offline, bez lib/.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const p = (...parts) => join(__dirname, ...parts);

const readText = f => readFileSync(p(f), 'utf8');
const readB64 = f => readFileSync(p(f)).toString('base64');

const template   = readText('index.template.html');
const appJs      = readText('app.js');
const exceljsJs  = readText('lib/exceljs.min.js');
const tesseractJs= readText('lib/tesseract.min.js');
const pdfJs      = readText('lib/pdf.min.js');
const pdfWorkerJs= readText('lib/pdf.worker.min.js');
const workerMinJs= readText('lib/worker.min.js');
const coreLstmJs = readText('lib/tesseract-core/tesseract-core-lstm.wasm.js');
const coreSimdJs = readText('lib/tesseract-core/tesseract-core-simd-lstm.wasm.js');
const engB64     = readB64('lib/lang-data/eng.traineddata.gz');
const slkB64     = readB64('lib/lang-data/slk.traineddata.gz');

// Tesseract worker beží vo Worker vlákne a interne robí importScripts() pre jadro (core.wasm.js)
// a fetch() pre jazykové dáta (*.traineddata.gz). Nemá prístup k premenným hlavného vlákna,
// takže shim (aj embedovaný base64 payload jazykových dát) musí byť súčasťou samotného
// worker skriptu — vkladá sa pred pôvodný worker.min.js a prepíše importScripts/fetch tak,
// aby namiesto sieťového/súborového načítania vrátil vstavaný obsah.
const tesseractWorkerShim = `
(function(){
  var CORE = {
    'tesseract-core-lstm.wasm.js': ${JSON.stringify(coreLstmJs)},
    'tesseract-core-simd-lstm.wasm.js': ${JSON.stringify(coreSimdJs)}
  };
  var LANG_B64 = {
    'eng.traineddata.gz': ${JSON.stringify(engB64)},
    'slk.traineddata.gz': ${JSON.stringify(slkB64)}
  };
  function b64ToBytes(b64){
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for(var i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  var _origImportScripts = self.importScripts.bind(self);
  self.importScripts = function(url){
    for(var name in CORE){
      if(String(url).indexOf(name) !== -1){ (0, eval)(CORE[name]); return; }
    }
    return _origImportScripts(url);
  };
  var _origFetch = self.fetch ? self.fetch.bind(self) : null;
  self.fetch = function(url, opts){
    for(var name in LANG_B64){
      if(String(url).indexOf(name) !== -1){
        return Promise.resolve(new Response(b64ToBytes(LANG_B64[name]), {
          status: 200, headers: {'Content-Type':'application/gzip'}
        }));
      }
    }
    return _origFetch(url, opts);
  };
})();
`;
const tesseractWorkerFull = tesseractWorkerShim + '\n;\n' + workerMinJs;

const embeddedAssetsScript = `
const EMBEDDED_ASSETS = (() => {
  const PDF_WORKER_JS = ${JSON.stringify(pdfWorkerJs)};
  const TESSERACT_WORKER_JS = ${JSON.stringify(tesseractWorkerFull)};
  let pdfUrl = null, tessUrl = null;
  return {
    pdfWorkerBlobUrl(){
      if(!pdfUrl) pdfUrl = URL.createObjectURL(new Blob([PDF_WORKER_JS], {type:'application/javascript'}));
      return pdfUrl;
    },
    tesseractWorkerBlobUrl(){
      if(!tessUrl) tessUrl = URL.createObjectURL(new Blob([TESSERACT_WORKER_JS], {type:'application/javascript'}));
      return tessUrl;
    }
  };
})();
`;

const out = template.replace(
  '<!--BUILD:SCRIPTS-->',
  [
    `<script>\n${exceljsJs}\n</script>`,
    `<script>\n${tesseractJs}\n</script>`,
    `<script>\n${pdfJs}\n</script>`,
    `<script>\n${embeddedAssetsScript}\n</script>`,
    `<script>\n${appJs}\n</script>`,
  ].join('\n')
);

writeFileSync(p('index.html'), out);
console.log(`index.html zostavený: ${(out.length / 1024 / 1024).toFixed(2)} MB`);
