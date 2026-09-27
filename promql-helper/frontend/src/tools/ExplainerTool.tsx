import { useEffect, useState, useRef } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { setupPromQLLanguage } from '../monaco/promql'
import type * as Monaco from 'monaco-editor'

type NodeInfo = {
  type: string
  expr: string
  explanation: string
  children?: NodeInfo[]
}

type SyntaxError = {
  message: string
  start: number
  end: number
}

type ParseResult = {
  formatted: string
  explanation: NodeInfo
  warnings: string[]
  error: string
  syntaxErrs?: SyntaxError[]
}

const ExplanationNode = ({ node, isRoot = false }: { node: NodeInfo, isRoot?: boolean }) => {
  const [expanded, setExpanded] = useState(isRoot);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`mt-3 ${!isRoot ? 'ml-2' : ''}`}>
      <motion.div 
        layout
        className={`bg-slate-800/80 border ${expanded ? 'border-sky-500/50' : 'border-slate-700'} p-4 rounded-xl transition-colors ${hasChildren ? 'cursor-pointer hover:border-sky-500/30 shadow-sm' : 'shadow-sm'}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-sky-400 flex items-center gap-2">
            {hasChildren && (
              <span className="text-slate-500 text-[10px] bg-slate-900 w-5 h-5 flex items-center justify-center rounded-full">
                {expanded ? '▼' : '▶'}
              </span>
            )}
            {node.type}
          </div>
        </div>
        <div className="text-slate-300 text-sm mt-2">{node.explanation}</div>
        {node.expr && node.expr !== 'unknown' && (
          <div className="text-slate-400 font-mono text-xs mt-3 bg-slate-900/50 p-2 rounded-lg break-all border border-slate-800">
            {node.expr}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {hasChildren && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden relative pl-6"
          >
            <div className="absolute left-[22px] top-0 bottom-6 w-px bg-slate-700" />
            <div className="flex flex-col relative z-10">
              {node.children!.map((child, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-6 top-8 w-6 h-px bg-slate-700" />
                  <ExplanationNode node={child} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const monaco = useMonaco()
  const workerRef = useRef<Worker | null>(null)
  const [wasmReady, setWasmReady] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [history, setHistory] = useState<string[]>([])
  
  // Setup Monaco
  useEffect(() => {
    if (monaco) {
      setupPromQLLanguage(monaco)
    }
  }, [monaco])

  // Setup Web Worker
  useEffect(() => {
    // Remove { type: 'module' } so importScripts() works
    const worker = new Worker(new URL('../promql.worker.ts', import.meta.url))
    workerRef.current = worker

    worker.onmessage = (e) => {
      const { type, payload } = e.data
      if (type === 'WASM_READY') {
        setWasmReady(true)
      } else if (type === 'PARSE_RESULT') {
        setResult(JSON.parse(payload))
      } else if (type === 'ERROR') {
        setResult({ error: payload } as ParseResult)
      }
    }

    return () => {
      worker.terminate()
    }
  }, [])

  // LocalStorage History
  useEffect(() => {
    const saved = localStorage.getItem('promql-history')
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch (e) {}
    }
    
    // Check URL
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) {
      try {
        setQuery(decodeURIComponent(atob(q)))
      } catch (e) {
        console.error('Invalid base64/uri query in URL', e)
      }
    }
  }, [])

  // Sync Query to URL & Parse
  useEffect(() => {
    if (query) {
      const url = new URL(window.location.href)
      try {
        url.searchParams.set('q', btoa(encodeURIComponent(query)))
        window.history.replaceState({}, '', url.toString())
      } catch (e) {
        console.error('Failed to encode URL parameters')
      }

      if (wasmReady && workerRef.current) {
        workerRef.current.postMessage({ type: 'PARSE', payload: query, id: Date.now() })
      }
    } else {
      const url = new URL(window.location.href)
      url.searchParams.delete('q')
      window.history.replaceState({}, '', url.toString())
      setResult(null)
    }
  }, [query, wasmReady])

  // Sync Monaco Markers
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  useEffect(() => {
    if (monaco && editorRef.current) {
      const model = editorRef.current.getModel()
      if (model && result?.syntaxErrs) {
        const markers = result.syntaxErrs.map(err => {
          const startPos = model.getPositionAt(err.start)
          const endPos = model.getPositionAt(err.end || err.start + 1)
          return {
            severity: monaco.MarkerSeverity.Error,
            message: err.message,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          }
        })
        monaco.editor.setModelMarkers(model, 'promql', markers)
      } else if (model) {
        monaco.editor.setModelMarkers(model, 'promql', [])
      }
    }
  }, [monaco, result])

  const handleFormat = () => {
    if (result?.formatted && !result.error) {
      setQuery(result.formatted)
    }
  }

  const saveToHistory = () => {
    if (!query || result?.error) return
    setHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 15)
      localStorage.setItem('promql-history', JSON.stringify(updated))
      return updated
    })
  }

  return (
    <div className="h-full bg-[#0f172a] flex flex-col overflow-hidden">
      <header className="h-16 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800 shrink-0">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
          PromQL Helper
        </h1>
        <div className="flex items-center gap-4">
          {!wasmReady && <span className="text-amber-400 text-sm animate-pulse">WASM Loading...</span>}
          <button onClick={handleFormat} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-sm font-medium rounded-lg transition-colors border border-slate-700">
            Format
          </button>
          <button onClick={saveToHistory} className="px-4 py-1.5 bg-sky-900/50 hover:bg-sky-800/50 text-sky-300 text-sm font-medium rounded-lg transition-colors border border-sky-800/50">
            Save Query
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          
          {/* Editor Panel */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="h-10 bg-slate-900/50 border-b border-slate-800 flex items-center px-4 text-xs text-slate-400 font-medium tracking-wider uppercase">
                Editor
              </div>
              <div className="flex-1">
                <Editor
                  height="100%"
                  language="promql"
                  theme="promql-dark"
                  value={query}
                  onChange={q => setQuery(q || '')}
                  onMount={(editor) => { editorRef.current = editor }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    padding: { top: 16 },
                    lineHeight: 24,
                  }}
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 bg-slate-900 hover:bg-sky-500/50 transition-colors cursor-col-resize flex flex-col items-center justify-center">
            <div className="h-8 w-1 bg-slate-700 rounded-full" />
          </PanelResizeHandle>

          {/* Analysis Panel */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col bg-slate-900/30">
              <div className="h-10 bg-slate-900/50 border-b border-slate-800 flex items-center px-4 text-xs text-slate-400 font-medium tracking-wider uppercase">
                Analysis & AST
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {result?.error && !result?.syntaxErrs ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-950/40 border border-red-500/50 text-red-200 p-5 rounded-xl shadow-lg">
                    <h3 className="font-bold mb-3">Syntax Error</h3>
                    <pre className="whitespace-pre-wrap font-mono text-sm">{result.error}</pre>
                  </motion.div>
                ) : result ? (
                  <div className="flex flex-col gap-6">
                    {result.syntaxErrs && result.syntaxErrs.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-950/40 border border-red-500/50 text-red-200 p-5 rounded-xl shadow-lg">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-red-400">
                          Syntax Error(s)
                        </h3>
                        <ul className="list-disc pl-5 space-y-2 text-sm">
                          {result.syntaxErrs.map((e, i) => <li key={i}>{e.message}</li>)}
                        </ul>
                      </motion.div>
                    )}

                    {result.warnings?.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-950/40 border border-amber-500/50 text-amber-200 p-5 rounded-xl shadow-lg">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-amber-400">
                          Linter Warnings
                        </h3>
                        <ul className="list-disc pl-5 space-y-2 text-sm">
                          {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </motion.div>
                    )}

                    {result.explanation && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <ExplanationNode node={result.explanation} isRoot={true} />
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <div className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <p>Enter a query to view its AST and analysis</p>
                  </div>
                )}
              </div>
            </div>
          </Panel>

        </PanelGroup>
      </div>

      {/* History Bar */}
      {history.length > 0 && (
        <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-4 overflow-x-auto gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-medium uppercase mr-2">History:</span>
          {history.map((h, i) => (
            <button key={i} onClick={() => setQuery(h)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded whitespace-nowrap truncate max-w-[200px]">
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
