# Configurazione Demo Mode per Render

Questo documento spiega come configurare la versione demo del progetto su Render.

## Variabili d'Ambiente per Demo Mode

Per attivare la modalità demo, aggiungi le seguenti variabili d'ambiente in Render:

```
VITE_DEMO_MODE=true    # Per il frontend (build-time)
DEMO_MODE=true         # Per il backend (runtime)
```

**IMPORTANTE**: Entrambe le variabili sono necessarie per una protezione completa:
- `VITE_DEMO_MODE` controlla l'interfaccia utente (nasconde bottoni e form)
- `DEMO_MODE` protegge le API server-side (blocca le richieste)

## Cosa fa la Demo Mode

Quando le variabili demo mode sono impostate su `true`, il sistema:

**Frontend (VITE_DEMO_MODE):**
1. **Nasconde registrazione** - Il tab di registrazione non è visibile
2. **Nasconde bottoni gestione utenti** - Bottoni per aggiungere/modificare/eliminare utenti non vengono mostrati
3. **Mostra copyright** - Un footer con informazioni di copyright appare in fondo ad ogni pagina
4. **Mostra avvisi** - Banner informativi appaiono per indicare che si tratta di una versione demo

**Backend (DEMO_MODE):**
1. **Blocca registrazione (API)** - Endpoint `/api/register` ritorna 403 Forbidden
2. **Blocca CRUD utenti (API)** - Tutti gli endpoint di gestione utenti ritornano 403 Forbidden
3. **Blocca gestione gruppi (API)** - Endpoint per modificare gruppi ritorna 403 Forbidden
4. **Protezione completa** - Anche tentando di bypassare il frontend, le API sono protette

## Configurazione su Render

1. Vai al tuo servizio su Render
2. Clicca su "Environment"
3. Aggiungi le variabili d'ambiente:
   - Key: `VITE_DEMO_MODE`, Value: `true`
   - Key: `DEMO_MODE`, Value: `true`
4. Salva e riavvia il servizio (o fai un nuovo deploy)

## Note Importanti

- `VITE_DEMO_MODE` è una variabile di **build-time** e deve essere impostata prima del build
- `DEMO_MODE` è una variabile di **runtime** e viene letta dal server al momento dell'esecuzione
- Se cambi queste variabili, dovrai fare un re-deploy completo
- Per la versione di produzione normale, NON impostare queste variabili o impostale su `false`
- Entrambe le variabili sono necessarie per una protezione completa contro tentativi di bypass

## Credenziali di Test per Demo

Le credenziali di test sono le stesse della versione normale:

- **Gestione Utenti**: gestione@amministratore.it / Gestione2025!
- **Gestione Prodotti e Ordini**: prova@amministratore.it / Prova2025!
- **Utente Coordinatore**: massimiliano@gmail.com / massimiliano
