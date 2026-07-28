# Props Inventory — Pubblicazione su Netlify

Questa cartella contiene tutto il necessario per pubblicare l'app con **salvataggio condiviso e permanente**: tutto quello che inserisci, modifichi o elimini resta salvato e visibile a chiunque apra il sito, ogni volta che lo riapre.

## Come funziona

- `index.html` → l'app (frontend)
- `netlify/functions/inventory.js` → una piccola funzione che legge/scrive i dati
- I dati vengono salvati con **Netlify Blobs**, uno storage incluso gratuitamente in Netlify

## Come pubblicarla (consigliato: da GitHub)

1. Crea un account gratuito su [github.com](https://github.com) (se non ne hai già uno)
2. Crea un nuovo repository (es. "props-inventory") e carica dentro tutti i file di questa cartella
3. Vai su [app.netlify.com](https://app.netlify.com) e crea un account gratuito (puoi anche accedere con GitHub)
4. Clicca su **"Add a new site" → "Import an existing project"**
5. Collega il tuo account GitHub e seleziona il repository che hai creato
6. Netlify riconosce automaticamente la configurazione (grazie al file `netlify.toml`) — clicca **Deploy**
7. Dopo 1-2 minuti il sito è online con un link tipo `https://nome-a-caso.netlify.app`

Da questo momento, ogni volta che aggiorni i file su GitHub, Netlify ripubblica automaticamente il sito.

## Alternativa più rapida (da computer, senza GitHub)

Se hai Node.js installato sul computer:

1. Apri il terminale dentro questa cartella
2. Esegui: `npm install -g netlify-cli` (una sola volta)
3. Esegui: `netlify deploy --prod`
4. Segui le istruzioni a schermo (login e scelta/nome del sito)

**Nota:** la semplice funzione "drag & drop" sul sito di Netlify (quella senza login/CLI) **non funziona per questa app**, perché non attiva le funzioni serverless necessarie per salvare i dati. Usa uno dei due metodi sopra.

## Cambiare il PIN di modifica

Il PIN per sbloccare le modifiche è impostato su **2026**. Per cambiarlo, apri `index.html`, cerca la riga:

```js
const EDIT_PIN = '2026';
```

e sostituisci il numero con quello che preferisci, poi ripubblica il sito.

## Dominio personalizzato

Una volta pubblicato, da Netlify puoi collegare un dominio vostro (es. `inventario.vostrosito.it`) dalla sezione "Domain settings" del sito.
