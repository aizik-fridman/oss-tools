import { useEffect, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { motion, AnimatePresence } from 'framer-motion'

// Add types for the global Wasm function
declare global {
  interface Window {
    Go: any
    parsePromQL?: (query: string) => string
  }
}

type NodeInfo = {
  type: string
  expr: string
  explanation: string
  children?: NodeInfo[]
}

type ParseResult = {
  formatted: string
  explanation: NodeInfo
  warnings: string[]
  error: string
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
            {/* Connection line for nested elements */}
            <div className="absolute left-[22px] top-0 bottom-6 w-px bg-slate-700" />
            
            <div className="flex flex-col relative z-10">
              {node.children!.map((child, i) => (
                <div key={i} className="relative">
                  {/* Horizontal connection branch */}
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

function App() {
  const [wasmReady, setWasmReady] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)

  // Load state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) {
      try {
        setQuery(atob(q))
      } catch (e) {
        console.error('Invalid base64 query')
      }
    }
  }, [])

  // Update URL when query changes
  useEffect(() => {
    if (query) {
      const url = new URL(window.location.href)
      url.searchParams.set('q', btoa(query))
      window.history.replaceState({}, '', url.toString())
    } else {
      const url = new URL(window.location.href)
      url.searchParams.delete('q')
      window.history.replaceState({}, '', url.toString())
    }
  }, [query])

  // Initialize WebAssembly
  useEffect(() => {
    async function loadWasm() {
      if (window.Go) {
        const go = new window.Go()
        try {
          const result = await WebAssembly.instantiateStreaming(fetch('/promql.wasm'), go.importObject)
          go.run(result.instance)
          setWasmReady(true)
        } catch (err) {
          console.error('Failed to load WASM:', err)
        }
      }
    }
    loadWasm()
  }, [])

  // Parse Query
  useEffect(() => {
    if (wasmReady && window.parsePromQL) {
      if (!query.trim()) {
        setResult(null)
        return
      }
      try {
        const resStr = window.parsePromQL(query)
        const res: ParseResult = JSON.parse(resStr)
        setResult(res)
      } catch (err) {
        console.error('Parse error:', err)
      }
    }
  }, [query, wasmReady])

  const handleEditorChange = useCallback((value: string | undefined) => {
    setQuery(value || '')
  }, [])

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
          PromQL Helper
        </h1>
        {!wasmReady && (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full text-sm font-medium border border-amber-400/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            Loading WASM Engine...
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col gap-4 sticky top-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-200">Query Input</h2>
          </div>
          <div className="h-[400px] rounded-xl overflow-hidden border border-slate-700 shadow-2xl shadow-black/50">
            <Editor
              height="100%"
              defaultLanguage="promql"
              theme="vs-dark"
              value={query}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                padding: { top: 16, bottom: 16 },
                lineHeight: 24,
                roundedSelection: false,
                scrollBeyondLastLine: false,
              }}
            />
          </div>

          {result?.formatted && !result?.error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl shadow-lg mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-emerald-400">Formatted Query</h3>
                <button 
                  onClick={() => navigator.clipboard.writeText(result.formatted)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="font-mono text-sm whitespace-pre-wrap text-slate-300 leading-relaxed overflow-x-auto">{result.formatted}</pre>
            </motion.div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-slate-200">Analysis</h2>
          
          {result?.error ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-950/40 border border-red-500/50 text-red-200 p-5 rounded-xl shadow-lg">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Syntax Error
              </h3>
              <pre className="whitespace-pre-wrap font-mono text-sm bg-red-950/50 p-3 rounded-lg border border-red-900/50">{result.error}</pre>
            </motion.div>
          ) : result ? (
            <div className="flex flex-col gap-6">
              {result.warnings?.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-950/40 border border-amber-500/50 text-amber-200 p-5 rounded-xl shadow-lg">
                  <h3 className="font-bold mb-3 flex items-center gap-2 text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Linter Warnings
                  </h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </motion.div>
              )}

              {result.explanation && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/40 border border-slate-700/50 p-5 rounded-xl shadow-lg">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-sky-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    AST Explanation Tree
                  </h3>
                  <div className="text-sm">
                    <ExplanationNode node={result.explanation} isRoot={true} />
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
             <div className="text-slate-500 italic h-[200px] flex items-center justify-center border border-dashed border-slate-700 rounded-xl bg-slate-900/20">
               Start typing a query to see the magic...
             </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
