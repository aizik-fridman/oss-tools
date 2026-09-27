import { useEffect, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { motion } from 'framer-motion'

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

  const renderExplanationTree = (node: NodeInfo, index = 0) => {
    return (
      <div key={index} className="ml-4 border-l-2 border-slate-700 pl-4 py-2 mt-2">
        <div className="font-semibold text-sky-400">{node.type}</div>
        <div className="text-slate-300 text-sm mt-1">{node.explanation}</div>
        {node.expr !== 'unknown' && <div className="text-slate-500 font-mono text-xs mt-1 bg-slate-800 p-1 rounded inline-block">{node.expr}</div>}
        {node.children && node.children.map((child, i) => renderExplanationTree(child, i))}
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
          PromQL Helper
        </h1>
        {!wasmReady && <div className="animate-pulse text-amber-400">Loading WASM...</div>}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Query Input</h2>
          <div className="h-[300px] rounded-xl overflow-hidden border border-slate-700 shadow-xl">
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
                padding: { top: 16 }
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto h-[600px] pr-2">
          {result?.error ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl">
              <h3 className="font-bold mb-2">Syntax Error</h3>
              <pre className="whitespace-pre-wrap font-mono text-sm">{result.error}</pre>
            </motion.div>
          ) : result ? (
            <>
              {result.warnings?.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-amber-900/40 border border-amber-600 text-amber-200 p-4 rounded-xl">
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <span>⚠️</span> Linter Warnings
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </motion.div>
              )}
              
              {result.formatted && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
                  <h3 className="font-bold mb-2 text-sky-400">Formatted Query</h3>
                  <pre className="font-mono text-sm whitespace-pre-wrap">{result.formatted}</pre>
                </motion.div>
              )}

              {result.explanation && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
                  <h3 className="font-bold mb-2 text-emerald-400">Explanation</h3>
                  <div className="text-sm">
                    {renderExplanationTree(result.explanation)}
                  </div>
                </motion.div>
              )}
            </>
          ) : (
             <div className="text-slate-500 italic h-full flex items-center justify-center border border-dashed border-slate-700 rounded-xl">
               Start typing a query to see the magic...
             </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
