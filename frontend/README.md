# Observability Helpers - Frontend

This is the frontend component of the Observability Helpers suite. It is built using:
* React 18
* Vite
* TailwindCSS
* Lucide React (Icons)
* Monaco Editor (for PromQL, JSON, and YAML editing)
* Zod (for schema validation)

## PromQL Parsing via WebAssembly
To ensure 100% accurate parsing of PromQL queries without needing a backend server, this application uses a WebWorker (`src/promql.worker.ts`) to communicate with a Go WebAssembly binary (`public/promql.wasm`). 

The WASM binary is loaded when the user enters the application and exposes a parsing function that utilizes the official Prometheus parser codebase.

## Development

```bash
npm ci
npm run dev
```

To run tests:
```bash
npm run test
```

## Production Build

```bash
npm run build
```
