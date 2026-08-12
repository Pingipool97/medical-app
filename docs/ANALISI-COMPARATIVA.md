# Analisi comparativa — progetti open source e MioDottore

## Progetti open source esaminati

| Progetto | Cosa fa bene | Cosa ci portiamo a casa | Cosa scartiamo e perché |
|---|---|---|---|
| **OpenEMR** | Copertura funzionale enorme: scheduling, fatturazione, prescrizioni, portale paziente, API FHIR R4, ACL granulari, audit consolidato da anni di uso reale | Il modello ACL per ruolo+delega; l'idea che ogni accesso al dato clinico sia auditato di default; la lista tipi-documento e tassonomie gestite a DB; l'export FHIR come strato separato dal modello interno | Lo stack (PHP monolitico, UI datata) e il modello "clinica-centrica": da noi il **paziente è il proprietario del proprio spazio** e il medico vede solo ciò che gli è condiviso — in OpenEMR è l'opposto |
| **LibreHealth EHR** | Modello dati clinico derivato da OpenEMR ripulito; separazione più netta tra anagrafica e dato clinico | La struttura di `lists` cliniche (problemi, allergie, farmaci come liste indipendenti e datate) che abbiamo replicato nel Diario Sanitario | Progetto poco attivo; nessun vantaggio ad adottarne il codice |
| **Ottehr (masslight)** | Architettura moderna (TypeScript, FHIR-nativo su Zapehr), **portale paziente separato dall'app staff**, intake/questionari pre-visita, televisita integrata | La separazione radicale delle due esperienze (che abbiamo adottato: `/paziente` e `/medico` sono app diverse nella stessa base); il questionario pre-visita come oggetto strutturato legato all'appuntamento | La dipendenza totale da una piattaforma FHIR-as-a-service commerciale: vincolo di lock-in incompatibile con i requisiti di localizzazione dati |
| **GNU Health** | Visione olistica (sanità territoriale, determinanti sociali), gestione domini sanitari pubblici | L'idea della **familiarità e stile di vita come dati di prima classe** del profilo, non note libere | Basato su Tryton/ERP, pensato per istituzioni; troppo distante da un prodotto consumer-friendly |
| **HospitalRun** | **Offline-first vero** (CouchDB/PouchDB con sync bidirezionale) | Il principio "l'ultima versione consultata resta disponibile"; lo abbiamo implementato in forma più leggera (service worker network-first con fallback cache) perché il nostro caso d'uso offline è consultazione, non data-entry | La sync bidirezionale offline di dati clinici: complessità enorme e rischio di conflitti su dati sanitari; scelta consapevole di limitare l'offline alla lettura |
| **Estrazione da referti / OCR medico** (Tesseract, ocrmypdf, progetti di lab-report parsing) | Pipeline collaudate: deskew → binarizzazione → OCR → post-processing con dizionari di analiti | L'architettura a passi con log visibile per passo e retry (implementata in `src/lib/processing.ts`); il matching degli analiti tramite **anagrafica con alias** invece che NER puro — deterministico e verificabile | OCR in-process nel web server: va su worker/provider dedicato (adapter `OCR` configurabile), il parsing di PDF nativi resta in-process |

## Decisione FHIR / HL7

**Decisione: modello dati interno proprio, mappato su FHIR R4 per l'export (e in prospettiva per l'import da FSE).**

Motivazione:
- Un modello interno FHIR-nativo (risorse generiche, reference, extension) avrebbe reso ogni query e ogni form più complessi, rallentando tutto lo sviluppo per un beneficio che si concretizza solo alle frontiere del sistema.
- Le frontiere sono però l'unico punto che conta per l'interoperabilità: l'export del paziente e il futuro dialogo con FSE/sistemi ospedalieri parlano FHIR. Le nostre entità sono state disegnate per mapparsi 1:1: `Document→DocumentReference`, `LabResult→Observation (laboratory)`, `VitalMeasurement→Observation (vital-signs)`, `Condition→Condition`, `Allergy→AllergyIntolerance`, `Medication→MedicationStatement`, `Appointment→Appointment`, `IssuedDocument→DocumentReference/ServiceRequest`, `Vaccination→Immunization`.
- Questa scelta determina che la piattaforma **possa** dialogare con il FSE quando esisterà il canale di accreditamento, senza rifare il modello dati.

## Confronto UX con MioDottore

| Funzione MioDottore | Cosa adottiamo | Cosa miglioriamo / dove ci differenziamo |
|---|---|---|
| Prenotazione online con slot | Adottata: disponibilità per prestazione/durata, slot calcolati, conferme e promemoria | Gli slot nascono dalle disponibilità gestite dal medico con eccezioni/ferie; lista d'attesa con notifica quando si libera un posto |
| Agenda del medico | Adottata, con condivisione alla segreteria | La segreteria vede l'agenda **senza contenuti clinici** salvo delega esplicita e tracciata: su MioDottore la distinzione non è così netta |
| Messaggistica medico-paziente | Adottata | Le **richieste** (ricette, certificati, impegnative) non sono messaggi che si perdono in chat ma **oggetti con stato** (nuova → presa in carico → … → evasa/rifiutata con motivo) e SLA dichiarati |
| Invio immagini/esami/ricette in chat | Adottato l'invio di documenti | I documenti entrano nella **cartella strutturata** (tipo, data, valori estratti), non restano allegati sciolti in una conversazione |
| Videoconsulto | Predisposto (provider configurabile, sala d'attesa e note visita nel modello) | Il referto post-visita si genera dalle note del medico; senza provider video la funzione è dichiaratamente spenta, non finta |
| Questionario pre-visita ("check-online") | Adottato: motivo della visita raccolto alla prenotazione | Alimenta il **briefing IA pre-visita** per il medico e la lista di domande utili per il paziente |
| Promemoria appuntamenti | Adottati (canali configurabili da admin) | Le email non contengono mai contenuto clinico: solo avviso + link autenticato |
| Recensioni pubbliche | **Non adottate nell'MVP** | In un contesto di cartella clinica e rapporto continuativo creano conflitti (dipendenza dal medico, risposte pubbliche a rischio riservatezza). Al loro posto: feedback privato strutturato. Flag `recensioni_pubbliche` pronto per un eventuale modulo discovery futuro |
| Profilo pubblico dello specialista | Parziale: profilo del medico visibile ai pazienti nella ricerca interna | Il differenziante non è la vetrina: è la **cartella clinica intelligente**. MioDottore prenota, noi *capiamo* i documenti |
