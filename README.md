# Pi sample

Repozytorium z dwiema niezależnymi aplikacjami: webową React + TypeScript + Vite oraz API Node.js + TypeScript + Express. Każda aplikacja ma własne `package.json`, `package-lock.json` i `node_modules`, aby można je było wdrażać osobno.

## Wymagania

- Node.js 20+
- npm

## Instalacja zależności

API:

```bash
cd apps/api
npm install
```

Frontend:

```bash
cd apps/web
npm install
```

## Uruchomienie API

```bash
cd apps/api
npm run dev
```

Domyślnie API działa pod adresem `http://localhost:3000`.

Sprawdzenie endpointu:

```bash
curl http://localhost:3000/health
```

Oczekiwana odpowiedź:

```json
{"status":"ok"}
```

## Uruchomienie frontendu

W drugim terminalu uruchom:

```bash
cd apps/web
npm run dev
```

Domyślnie frontend działa pod adresem `http://localhost:5173` i pobiera `GET http://localhost:3000/health`.

Jeśli API działa na innym adresie, uruchom frontend z własną zmienną:

```bash
cd apps/web
VITE_API_URL=http://localhost:3000 npm run dev
```

## Build aplikacji

API:

```bash
cd apps/api
npm run build
```

Frontend:

```bash
cd apps/web
npm run build
```

## Kontrakt API

Specyfikacja OpenAPI znajduje się w `contracts/openapi.yaml`.
