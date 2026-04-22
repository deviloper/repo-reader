# Stress Test Rendering Markdown

Questo file serve a stressare il renderer HTML e la pipeline di stampa/PDF con contenuti abbastanza lunghi da forzare:

- tabella dei contenuti su piu' pagine
- tabelle larghe con wrapping delle celle
- liste annidate ripetute
- blocchi di codice lunghi
- combinazioni miste di heading `H2`, `H3` e `H4`

## Scenario 01

Panoramica iniziale con **grassetto**, *corsivo*, `inline code` e un link relativo a [fixture base](./markdown-rendering-test.md).

### Scenario 01.A

1. Verificare il layout generale.
2. Controllare il comportamento dell'anteprima.
   - Riga annidata uno.
   - Riga annidata due.
3. Validare il PDF su A4.

#### Scenario 01.A.1

> Citazione breve per verificare spaziatura e stili ripetuti all'interno di una fixture lunga.

## Scenario 02

Paragrafo aggiuntivo per aumentare il volume della documentazione e fornire materiale sufficiente all'indice automatico.

### Scenario 02.A

| Campo | Stato | Note |
| :---- | :---: | ---: |
| Preview | OK | nessun clipping |
| Print | OK | da verificare con piu' pagine |
| PDF | WIP | osservare allineamento celle |

#### Scenario 02.A.1

```js
function buildSectionSummary(id, state) {
    const safeState = state || "unknown";
    return `[${id}] => ${safeState}`;
}

const summary = [
    buildSectionSummary("preview", "ok"),
    buildSectionSummary("print", "ok"),
    buildSectionSummary("pdf", "wip"),
];

console.log(summary.join("\n"));
```

## Scenario 03

Testo descrittivo con abbastanza parole da occupare piu' righe e rendere piu' visibile il comportamento del wrapping in stampa e in preview.

### Scenario 03.A

- Punto principale 1
  - Sottopunto 1.1
  - Sottopunto 1.2 con `codice`
    - Sottopunto 1.2.1
- Punto principale 2
  - Sottopunto 2.1

#### Scenario 03.A.1

| Nome | Valore | Dettaglio |
| :--- | :----- | -------: |
| Pattern | `alpha \| beta` | pipe escape |
| Path | `docs\|stress` | testo con pipe |

## Scenario 04

### Scenario 04.A

1. Primo step operativo.
2. Secondo step operativo.
   1. Sottostep A.
   2. Sottostep B.
3. Terzo step operativo.

#### Scenario 04.A.1

Paragrafo con link esterno a [Electron](https://www.electronjs.org/) per verificare che i link continuino a essere renderizzati correttamente nel documento lungo.

## Scenario 05

### Scenario 05.A

| Colonna 1 | Colonna 2 | Colonna 3 | Colonna 4 |
| :-------- | :-------- | :-------- | --------: |
| valore lungo per testare wrapping | altro testo lungo su piu' parole | stato intermedio | 128 |
| contenuto compatto | nota breve | completato | 256 |
| stringa con parecchi dettagli per l'impaginazione | descrizione ancora piu' lunga e verbosa | da confermare | 512 |

#### Scenario 05.A.1

> Seconda citazione, utile per capire se gli stili rimangono coerenti anche verso meta' documento.

## Scenario 06

### Scenario 06.A

```ts
type SectionResult = {
    id: string;
    pages: number;
    status: "ok" | "wip" | "blocked";
};

const results: SectionResult[] = [
    { id: "toc", pages: 2, status: "ok" },
    { id: "tables", pages: 1, status: "ok" },
    { id: "code", pages: 3, status: "wip" },
];

for (const result of results) {
    console.log(`${result.id}: ${result.pages} => ${result.status}`);
}
```

#### Scenario 06.A.1

Paragrafo di controllo per transizione tra blocco di codice e testo.

## Scenario 07

### Scenario 07.A

- Elenco rapido uno
- Elenco rapido due
- Elenco rapido tre
  - Sottoelemento tre.a
  - Sottoelemento tre.b

#### Scenario 07.A.1

| Area | Esito | Commento |
| :--- | :---: | -------: |
| TOC | OK | continua sulle pagine successive |
| Liste | OK | marker distinti |
| Tabelle | OK | celle allineate |

## Scenario 08

### Scenario 08.A

Paragrafo di lunghezza media per aumentare il numero di linee e far crescere il contenuto totale del documento.

#### Scenario 08.A.1

1. Verifica uno.
2. Verifica due.
3. Verifica tre.

## Scenario 09

### Scenario 09.A

| Sezione | Descrizione | Output Atteso | Note |
| :------ | :---------- | :------------ | ---: |
| Heading | numerazione coerente | TOC accurata | importante |
| Table | bordi e zebra | leggibilita' | alta |
| Code | frammentazione controllata | niente troncamenti | alta |

#### Scenario 09.A.1

```json
{
  "document": "stress-test",
  "preview": true,
  "print": true,
  "pdf": true,
  "tocPages": 2
}
```

## Scenario 10

### Scenario 10.A

Paragrafo finale della prima meta' del documento. Da qui in poi la fixture continua con uno schema simile per forzare l'indice multi-pagina.

#### Scenario 10.A.1

> Nota finale della prima meta' del documento.

## Scenario 11

### Scenario 11.A

Testo descrittivo extra per aumentare le righe nel documento e verificare la stabilita' del layout quando il contenuto cresce oltre alcune pagine.

#### Scenario 11.A.1

| Nodo | Tipo | Valore |
| :--- | :--- | -----: |
| root | section | 1 |
| child | subsection | 2 |
| leaf | detail | 3 |

## Scenario 12

### Scenario 12.A

- Punto di verifica A
- Punto di verifica B
  - Sottoverifica B1
  - Sottoverifica B2
- Punto di verifica C

#### Scenario 12.A.1

Paragrafo di supporto con [link relativo](../README.md) per verificare ancora i collegamenti interni.

## Scenario 13

### Scenario 13.A

```bash
repo-reader --root ./example-repo
repo-reader --root ./example-repo --print
repo-reader --root ./example-repo --export-pdf
```

#### Scenario 13.A.1

Tabella sintetica:

| Comando | Effetto | Priorita' |
| :------ | :------ | --------: |
| start | avvio app | 1 |
| print | stampa | 2 |
| export | pdf | 3 |

## Scenario 14

### Scenario 14.A

Paragrafo normale per testare testo scorrevole in mezzo a blocchi strutturati.

#### Scenario 14.A.1

1. Step iniziale.
2. Step intermedio.
3. Step finale.

## Scenario 15

### Scenario 15.A

| Colonna A | Colonna B | Colonna C |
| :-------- | :-------- | --------: |
| valore 01 | testo esteso con wrapping potenziale | 1000 |
| valore 02 | testo ancora piu' lungo per forzare righe multiple all'interno della stessa cella | 2000 |
| valore 03 | chiusura tabella | 3000 |

#### Scenario 15.A.1

> Citazione conclusiva della seconda meta' documento.

## Scenario 16

### Scenario 16.A

Paragrafo supplementare per far crescere ancora l'indice e verificare che la numerazione delle pagine resti coerente quando il documento diventa piu' corposo.

#### Scenario 16.A.1

```js
const checkpoints = ["preview", "toc", "tables", "lists", "code", "print"];
for (const checkpoint of checkpoints) {
    console.log(`checkpoint: ${checkpoint}`);
}
```

## Scenario 17

### Scenario 17.A

- Voce A
- Voce B
  - Voce B1
    - Voce B1.a
- Voce C

#### Scenario 17.A.1

Paragrafo di chiusura sezione.

## Scenario 18

### Scenario 18.A

| Area | Stato | Rischio | Commento |
| :--- | :---: | :------ | -------: |
| renderer | OK | basso | struttura stabile |
| printer | OK | medio | testare ancora con file reali |
| toc | OK | basso | multi-pagina attiva |
| fixture | OK | basso | pronta per regressione |

#### Scenario 18.A.1

Documento stress test completato.
