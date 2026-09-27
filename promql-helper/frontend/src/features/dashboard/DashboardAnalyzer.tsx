import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { LayoutDashboard, CheckCircle, AlertCircle, Copy, Check, Activity, Users, ShieldAlert,  } from 'lucide-react';
import CodeInputOverlay from '../../components/ui/CodeInputOverlay';
import { CategorySection } from './components/CategorySection';
import { performAnalysis, DashboardSchema } from './core/analyzer';
import { cleanForGitOps } from './core/gitops';
import type { AnalysisResult } from './core/types';

export default function DashboardAnalyzerTool() {
  const [jsonInput, setJsonInput] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanJson, setCleanJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Default closed!
  
  
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({performance: false, ux: false, sre: false});
  const toggleCat = (cat: string) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  const analyzeDashboard = () => {
    try {
      setError(null);
      setCleanJson(null);
      const rawParsed = JSON.parse(jsonInput);
      
      const parsed = DashboardSchema.safeParse(rawParsed);
      if (!parsed.success) {
        throw new Error('Schema Validation Failed: Invalid Grafana Dashboard JSON.');
      }
      
      const res = performAnalysis(parsed.data);
      const totalPossibleChecks = 12; // Static number of check categories implemented
      res.stats.checksRun = totalPossibleChecks;
      // passed count is exactly the number of success findings emitted
      
      setAnalysis(res);
      // Optional: expand all if needed, but user explicitly said default closed. We will leave them closed.
      setExpandedCats({ performance: false, ux: false, sre: false });
    } catch (err: any) {
      setError(err.message || 'Failed to parse JSON. Make sure it is valid Grafana JSON.');
      setAnalysis(null);
    }
  };

  const autoClean = () => {
    if (!analysis?.originalDash) return;
    const cleaned = cleanForGitOps(analysis.originalDash);
    setCleanJson(JSON.stringify(cleaned, null, 2));
  };

  const copyToClipboard = () => {
    if (!cleanJson) return;
    navigator.clipboard.writeText(cleanJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-pink-400">Dashboard Static Analyzer</h2>
          <p className="text-slate-400 mt-2">Static analysis for Grafana Dashboards based on SRE methodologies.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 flex flex-col h-full">
            <div className="w-full h-[400px] border border-slate-700 rounded-xl overflow-hidden shadow-inner bg-[#1e1e1e] relative">
              {!jsonInput && (
                <CodeInputOverlay 
                  language="json" 
                  onPaste={(text) => setJsonInput(text)}
                  onUpload={(text) => setJsonInput(text)}
                />
              )}
              <Editor
                height="100%"
                language="json"
                theme="vs-dark"
                value={jsonInput}
                onChange={(val) => setJsonInput(val || '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 16, bottom: 16 },
                  fontSize: 14,
                  formatOnPaste: true,
                }}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={analyzeDashboard}
                className="flex-1 py-3 bg-pink-900/30 border border-pink-500/50 hover:bg-pink-800/50 text-pink-400 font-bold rounded-xl transition-colors shadow-lg"
              >
                Analyze
              </button>
              <button
                onClick={autoClean}
                disabled={!analysis}
                className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-colors shadow-lg"
              >
                Normalize for Git
              </button>
            </div>
            {error && (
              <div className="p-4 bg-red-950/50 border border-red-500/50 text-red-400 rounded-xl">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {!analysis && !cleanJson && !error && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl min-h-[500px]">
                <LayoutDashboard size={48} className="mb-4 opacity-50" />
                <p>Paste JSON and click Analyze</p>
              </div>
            )}

            {analysis && !cleanJson && (
              <div className="space-y-6 animate-in fade-in max-h-[700px] overflow-y-auto pr-2 pb-8">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-200 font-bold mb-1 uppercase tracking-wide">Dashboard Analysis</div>
                    <div className="flex flex-col gap-1 text-sm font-medium mt-3">
                      <span className="text-slate-400">{analysis.stats.checksRun} Checks</span>
                      <span className="text-emerald-400">✓ {analysis.stats.passed} Passed</span>
                      <span className="text-amber-400">⚠ {analysis.stats.warnings} Warnings</span>
                      <span className="text-red-400">🔴 {analysis.stats.critical} Critical</span>
                      <span className="text-sky-400">ℹ {analysis.stats.info} Recommendations</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {analysis.stats.critical === 0 && (
                      <div className="inline-flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-emerald-900/50 bg-emerald-950/30 text-emerald-400 text-center p-4">
                        <CheckCircle size={32} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-tight">No Critical<br/>Issues</span>
                      </div>
                    )}
                    {analysis.stats.critical > 0 && (
                      <div className="inline-flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-red-900/50 bg-red-950/30 text-red-400 text-center p-4">
                        <AlertCircle size={32} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-tight">Action<br/>Required</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl text-center">
                    <div className="text-xl font-bold text-slate-200">{analysis.stats.totalPanels}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Panels</div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl text-center">
                    <div className="text-xl font-bold text-sky-400">{analysis.stats.queryPanels}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Query Panels</div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl text-center">
                    <div className="text-xl font-bold text-emerald-400">{analysis.stats.totalTargets}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Total Targets</div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl text-center">
                    <div className="text-xl font-bold text-fuchsia-400">{analysis.stats.variables}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">Variables</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <CategorySection title="Performance & Load Time" icon={Activity} catKey="performance" color="text-sky-400" analysis={analysis} expandedCats={expandedCats} toggleCat={toggleCat} />
                  <CategorySection title="UX & On-Call Readiness" icon={Users} catKey="ux" color="text-fuchsia-400" analysis={analysis} expandedCats={expandedCats} toggleCat={toggleCat} />
                  <CategorySection title="SRE Best Practices & Hygiene" icon={ShieldAlert} catKey="sre" color="text-emerald-400" analysis={analysis} expandedCats={expandedCats} toggleCat={toggleCat} />
                </div>
              </div>
            )}

            {cleanJson && (
              <div className="h-[700px] flex flex-col bg-[#1e1e1e] border border-emerald-500/50 rounded-xl shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                <div className="h-12 bg-emerald-950/30 border-b border-emerald-900/50 flex items-center justify-between px-4 shrink-0">
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle size={16} /> Normalized for Git
                  </span>
                  <button onClick={copyToClipboard} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <pre className="text-slate-300 font-mono text-sm leading-relaxed">{cleanJson}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
