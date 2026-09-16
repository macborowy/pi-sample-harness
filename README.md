# Pi sample monorepo

Przykładowe monorepo z aplikacją webową React + TypeScript + Vite oraz API Node.js + TypeScript + Express.

## Wymagania

- Node.js 20+
- npm

## Instalacja zależności

```bash
npm install
```

## Uruchomienie API

```bash
npm run dev:api
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
npm run dev:web
```

Domyślnie frontend działa pod adresem `http://localhost:5173` i pobiera `GET http://localhost:3000/health`.

Jeśli API działa na innym adresie, uruchom frontend z własną zmienną:

```bash
VITE_API_URL=http://localhost:3000 npm run dev:web
```

## Build obu aplikacji

```bash
npm run build
```

## Build pojedynczych aplikacji

API:

```bash
npm -w apps/api run build
```

Frontend:

```bash
npm -w apps/web run build
```

## Kontrakt API

Specyfikacja OpenAPI znajduje się w `contracts/openapi.yaml`.
