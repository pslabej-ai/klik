# KLIK PANEL — Delenie materiálu

Webová kalkulačka na prepočet zvitkov a rozdelenie strešnej krytiny (KLIK PANEL),
vrátane čítania výrobných listov (OCR z obrázka/PDF) a exportu do Excelu.

## Kde nájdem hotový súbor

**`index.html`** — to je celá aplikácia. Je to **jeden samostatný súbor** (cca 17 MB),
ktorý obsahuje úplne všetko: vzhľad, logiku kalkulačky, aj knižnice na OCR čítanie,
prácu s PDF a export do Excelu. Nič iné k nemu netreba.

- Stiahni si `index.html` a otvor ho dvojklikom v ľubovoľnom prehliadači
  (Chrome, Edge, Firefox, Safari).
- Funguje aj úplne offline — netreba internet, netreba žiadne ďalšie súbory vedľa neho.
- Dá sa poslať mailom, nahrať na USB kľúč, uložiť do telefónu — je to len jeden `.html` súbor.

## Ako sa používa

1. **Nastavenie výroby** — režim výroby, delenie (VDL / VARIOBEND), šírka vstupného
   zvitku, počet pásov, užitočná šírka, ohyb odkvapovej hrany.
2. **Nahrať výrobný list** — voliteľné: nahraj foto alebo PDF výrobného listu a program
   sa pokúsi automaticky rozpoznať rozmery a počty kusov (OCR). Výsledok si vieš pred
   vložením skontrolovať a opraviť.
3. **Súpis rozmerov panelov** — ručné zadanie alebo doplnenie rozmerov, každý riadok
   môže mať vlastné číslo výrobného listu (VL) — farebne sa odlíšia v rozdelení.
4. **Prepočet** — automaticky sa dopočítajú bežné metre, plocha, potrebná dĺžka
   vstupného zvitku a odpad materiálu.
5. **Rozdelenie na pásy** — vizuálne zobrazenie, ako sa jednotlivé kusy rozložia
   na pásy zvitku (vyvážené rozdelenie s minimálnym odpadom).
6. **Tlač / export** — tlač alebo uloženie do PDF (`🖨`), export do Excelu (`📊`).

Dáta sa priebežne ukladajú do pamäte prehliadača (localStorage), takže po zavretí
a znovuotvorení súboru zostanú zachované (pokiaľ ho otváraš z toho istého miesta
v tom istom prehliadači).

## Štruktúra repozitára

Repozitár obsahuje jediný súbor aplikácie: **`index.html`**. Je to zároveň zdrojový
aj hotový súbor — všetky ďalšie úpravy sa robia priamo v ňom, žiadny build krok
už nie je potrebný.

(Staršia verzia repozitára mala kód rozdelený do `app.js` + `index.template.html` +
`lib/` s build skriptom, ktorý ich skladal do `index.html`. Tie súbory boli odstránené —
`index.html` je teraz jediný zdroj pravdy.)

### Prečo je výsledný súbor taký veľký

OCR (Tesseract.js) potrebuje WASM jadro a jazykové dáta (slovenčina + angličtina)
pre rozpoznávanie textu z fotiek/PDF výrobných listov — tie tvoria väčšinu veľkosti
súboru. Bez nich by manuálne zadávanie a prepočet fungovali aj v oveľa menšom súbore,
ale OCR čítanie výrobných listov by nefungovalo offline.
