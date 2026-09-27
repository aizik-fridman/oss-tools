# Observability Helpers

A comprehensive suite of 100% client-side tools designed for Site Reliability Engineers (SRE) and Observability professionals. These tools help you analyze, explain, and lint your Grafana dashboards, Prometheus alerting rules, and PromQL queries directly in your browser.

## Architecture

This repository uses a feature-sliced modular architecture.

* **`frontend/`**: A React + Vite SPA built with TailwindCSS. It houses all the UI components, Monaco editor integrations, and analysis logic.
* **`wasm/`**: Contains Go code that is compiled to WebAssembly (`promql.wasm`). This WebAssembly module runs the native Prometheus PromQL parser directly in your browser, enabling 100% accurate structural linting without any backend server.

## Features

1. **Dashboard Static Analyzer**: Paste Grafana Dashboard JSON. Get a full breakdown of issues based on SRE best practices, including orphaned variables, missing thresholds, empty descriptions, and performance warnings.
2. **Alert Analyzer**: Paste your Prometheus or Grafana Unified Alerting YAML files. Validates rule structures, parses PromQL queries for syntax issues via WASM, and checks for missing runbook URLs or summaries.
3. **PromQL Explainer**: Paste complex PromQL queries and get a syntax tree breakdown and plain-English explanation of what the query computes.

## Getting Started

### Prerequisites
* Node.js (v20+)
* Go (1.21+) - *Only if you need to recompile the WASM binary.*

### Running Locally

```bash
cd frontend
npm ci
npm run dev
```

### Building the WASM Module

If you modify the Go code in `wasm/main.go`, you can recompile it:

```bash
cd wasm
GOOS=js GOARCH=wasm go build -o ../frontend/public/promql.wasm main.go
```

## Disclaimer
This project was created with the assistance of AI for personal purposes. If you found it helpful or encountered a bug, please report it in the Issues section.
