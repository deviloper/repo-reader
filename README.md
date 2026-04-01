# repo-reader

repo-reader è un applicativo pensato per esplorare un repository locale, leggere la documentazione presente nelle cartelle `docs` e offrire un punto di ingresso unico per navigazione, anteprima Markdown e, in una fase successiva, editing guidato dei contenuti.

L’idea di partenza nasce dal mini applicativo già esistente nel repository sorgente che mi hai mostrato: un server Node.js avvia una finestra del browser, permette di navigare le cartelle, aprire file Markdown e gestire alcune azioni base sul repository. Questo progetto vuole evolvere quella base in un prodotto impacchettabile via npm, più completo e più semplice da integrare in altri progetti.

## Obiettivo

L’obiettivo è distribuire repo-reader come strumento installabile nelle `devDependencies` di un progetto e avviabile con un comando breve da terminale. In prospettiva, il tool dovrà fornire:

1. una finestra desktop dedicata, senza dipendere da un server Node avviato manualmente;
2. una navigazione del repository e della documentazione in stile file explorer;
3. un visualizzatore Markdown integrato;
4. funzionalità di editing assistito per file testuali e documentazione;
5. una base estendibile per comandi futuri legati alla gestione del repository.

## Stato attuale del materiale di partenza

Dal mini-app mostrato emergono già alcuni comportamenti utili da preservare o rifattorizzare:

1. avvio automatico dell’interfaccia;
2. lista dei file e delle cartelle del repository;
3. apertura dei file Markdown in una vista dedicata;
4. placeholder per le cartelle;
5. apertura del repository in VS Code o di cartelle specifiche nell’Explorer di Windows;
6. gestione di heartbeat e chiusura del processo quando la finestra si chiude.

Questi punti sono un buon riferimento per il primo rilascio, ma l’architettura va spostata verso un’app desktop distribuita come pacchetto npm, non come semplice server HTTP locale.

## Direzione tecnica proposta

La soluzione più adatta, in base a quanto si vede ora, è una desktop app costruita con Electron e affiancata da un layer di rendering moderno per l’interfaccia. In parallelo, per l’editing guidato, Monaco Editor è una scelta naturale perché offre una UX molto vicina a un IDE senza dover incorporare un editor completo.

### Componenti consigliati

1. Electron per creare finestra, lifecycle e integrazione con il sistema operativo.
2. Un processo main per accesso al filesystem, dialog, shell e gestione repository.
3. Un renderer UI per navigazione, preview, ricerca e azioni contestuali.
4. Monaco Editor per editing assistito, validazione e anteprima del contenuto.
5. Un parser Markdown e una pipeline di rendering separata dalla UI.
6. Un piccolo layer CLI o un bin npm per l’avvio rapido del tool.

### Distribuzione npm

Se l’obiettivo è farlo installare come `devDependency`, conviene prevedere:

1. un pacchetto con `bin` per esporre un comando tipo `repo-reader`;
2. uno script di avvio che individui il repository corrente;
3. un fallback che permetta di passare il percorso del repository come argomento;
4. una configurazione chiara di build e packaging per Windows, macOS e Linux.

## Roadmap implementativa

### Fase 1: baseline applicativa

1. Creare la struttura del progetto Electron.
2. Separare la logica di filesystem, navigazione e rendering Markdown dal bootstrap iniziale.
3. Definire un comando di avvio unico da terminale.
4. Rendere configurabile la root del repository da esplorare.

### Fase 2: navigazione e preview

1. Implementare un file explorer interno.
2. Filtrare e classificare correttamente documentazione, cartelle e file supportati.
3. Aprire file Markdown in preview integrata.
4. Gestire placeholder e stati vuoti in modo coerente.

### Fase 3: editing guidato

1. Integrare Monaco Editor nella vista principale o in un pannello dedicato.
2. Aggiungere apertura file, modifica e salvataggio controllato.
3. Introdurre sintassi, evidenziazione e auto-complete per Markdown e file testuali.
4. Escludere o proteggere i file binari e i percorsi sensibili.

### Fase 4: integrazione con il repository

1. Aggiungere comandi contestuali per aprire cartelle e file in editor esterni.
2. Integrare operazioni utili come ricerca nel repository e refresh della vista.
3. Prevedere hook per future funzioni di gestione Git o documentazione.

### Fase 5: packaging e distribuzione

1. Preparare build per desktop app.
2. Pubblicare il pacchetto npm con metadata, bin e documentazione d’uso.
3. Verificare il comportamento quando il progetto viene installato come devDependency.
4. Aggiungere una guida rapida per l’uso nel README del progetto ospitante.

## Prossimi passi consigliati

1. Definire il nome definitivo del pacchetto e il comando CLI esposto.
2. Creare la nuova struttura Electron partendo dalla logica già presente nel mini-app.
3. Scegliere l’architettura del renderer: HTML semplice, framework leggero oppure UI moderna con componenti.
4. Stabilire il perimetro della prima release: sola lettura, oppure lettura più editing base.

## Nota sul materiale esistente

I file che hai mostrato sono già sufficienti per definire il comportamento di partenza, ma non ancora per il prodotto finale. La priorità dovrebbe essere trasformare il server monolitico attuale in moduli separati: boot, filesystem, rendering, UI e comandi. Questo rende più semplice introdurre Electron e Monaco senza riscrivere tutto in un solo passaggio.
