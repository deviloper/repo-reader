# Documento Di Test Rendering Markdown

Questo file serve per verificare il rendering HTML e la stampa PDF del parser Markdown interno di repo-reader.

## Testo Inline

Questo paragrafo include **grassetto**, *corsivo*, `codice inline` e un link esterno a [GitHub](https://github.com).

Questo secondo paragrafo include un link relativo a [README](../README.md) e testo normale abbastanza lungo da far vedere wrapping e spaziatura nel preview pane.

---

## Liste Puntate

- Primo elemento principale
  - Sottoelemento livello 2
  - Secondo sottoelemento con `inline code`
    - Sottoelemento livello 3
- Secondo elemento principale

## Liste Numerate

1. Primo passo
2. Secondo passo
   1. Sottopasso A
   2. Sottopasso B
3. Terzo passo

## Liste Miste

1. Voce numerata
   - Punto annidato uno
   - Punto annidato due
2. Altra voce numerata
   1. Sottopasso numerato
   2. Sottopasso numerato con **enfasi**

## Citazioni

> Questa e' una citazione singola, utile per verificare bordo, sfondo e spaziatura in anteprima e in PDF.

## Codice

```js
function greet(name) {
    const safeName = name || "world";
    return `Hello, ${safeName}!`;
}

console.log(greet("repo-reader"));
```

## Tabelle Base

| Colonna | Stato | Note |
| :------ | :---: | ---: |
| Preview | OK | allineamento a destra |
| Print | WIP | da controllare su A4 |

## Tabelle Con Pipe Escape

| Campo | Valore | Dettaglio |
| :---- | :----- | -------: |
| Pattern | `a \| b` | contiene una pipe escape |
| Percorso | `docs\|samples` | testo con separatore visualizzato |

## Tabelle Larghe

| Sezione | Descrizione | Output Atteso | Note Operative |
| :------ | :---------- | :------------ | -------------: |
| Heading | H1-H4 visibili | titoli con gerarchia coerente | usata anche per indice |
| Liste | annidamento corretto | rientro e marker distinti | verificare su piu' pagine |
| Tabelle | header e righe zebra | celle leggibili anche strette | attenzione a wrapping |

## Titoli Per Indice

### Sottosezione Uno

Testo di supporto per alimentare la tabella dei contenuti.

### Sottosezione Due

Altro testo di supporto per il test indice.

#### Dettaglio H4

Livello H4 utile per verificare numerazione e TOC.

## Chiusura

Documento di test completato.
