/// <reference lib="webworker" />

declare var Go: any;

let wasmReady = false;

// Load the wasm_exec.js script from public
importScripts('/wasm_exec.js');

async function initWasm() {
  if (typeof Go !== 'undefined') {
    const go = new Go();
    try {
      const result = await WebAssembly.instantiateStreaming(fetch('/promql.wasm'), go.importObject);
      go.run(result.instance);
      wasmReady = true;
      self.postMessage({ type: 'WASM_READY' });
    } catch (err) {
      self.postMessage({ type: 'ERROR', payload: String(err) });
    }
  }
}

initWasm();

self.onmessage = (e) => {
  if (e.data.type === 'PARSE') {
    if (!wasmReady) {
      self.postMessage({ type: 'ERROR', payload: 'WASM not ready', id: e.data.id });
      return;
    }
    try {
      // @ts-ignore
      const resStr = self.parsePromQL(e.data.payload);
      self.postMessage({ type: 'PARSE_RESULT', payload: resStr, id: e.data.id });
    } catch (err) {
      self.postMessage({ type: 'ERROR', payload: String(err), id: e.data.id });
    }
  }
};
