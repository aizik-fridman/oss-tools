/// <reference lib="webworker" />

declare var Go: any;

let wasmReady = false;
const messageQueue: any[] = [];

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
      
      // Flush queue
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        handleParse(msg);
      }
    } catch (err) {
      self.postMessage({ type: 'ERROR', payload: String(err) });
    }
  }
}

initWasm();

function handleParse(data: any) {
  try {
    // @ts-ignore
    const resStr = self.parsePromQL(data.payload);
    self.postMessage({ type: 'PARSE_RESULT', payload: resStr, id: data.id });
  } catch (err) {
    self.postMessage({ type: 'ERROR', payload: String(err), id: data.id });
  }
}

self.onmessage = (e) => {
  if (e.data.type === 'PARSE') {
    if (!wasmReady) {
      messageQueue.push(e.data);
      return;
    }
    handleParse(e.data);
  }
};