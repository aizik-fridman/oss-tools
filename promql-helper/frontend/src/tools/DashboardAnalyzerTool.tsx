import { useState } from 'react';
import { LayoutDashboard, CheckCircle, AlertTriangle, AlertCircle, Copy, Check } from 'lucide-react';
import { z } from 'zod';

const DashboardSchema = z.object({
  panels: z.array(z.any()),
}).passthrough();

function removeNullAndDriftKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeNullAndDriftKeys).filter((v) => v !== null);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        newObj[key] = removeNullAndDriftKeys(value);
      }
    }
    return newObj;
  }
  return obj;
}

export default function DashboardAnalyzerTool() {
  const [jsonInput, setJsonInput] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanJson, setCleanJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const analyzeDashboard = () => {
    try {
      setError(null);
      setCleanJson(null);
      const rawParsed = JSON.parse(jsonInput);
      
      const parsed = DashboardSchema.safeParse(rawParsed);
      if (!parsed.success) {
        throw new Error('Schema Validation Failed: Missing "panels" array or invalid Grafana Dashboard format.');
      }
      
      const dash = parsed.data;
      const panels = dash.panels;
      let totalPanels = 0;
      let hardcodedDataSources = 0;
      let maxY = 0;
      let gridPosIssues = 0;

      panels.forEach((p: any) => {
        if (p.type === 'row' && p.panels) {
          totalPanels += p.panels.length;
          p.panels.forEach((np: any) => analyzePanel(np));
        } else {
          totalPanels++;
          analyzePanel(p);
        }
      });

      function analyzePanel(p: any) {
        if (p.datasource && typeof p.datasource === 'string' && !p.datasource.startsWith('$')) {
          hardcodedDataSources++;
        } else if (p.datasource && p.datasource.uid && !p.datasource.uid.startsWith('$')) {
          if (p.datasource.type !== 'grafana' && p.datasource.uid !== '-- Mixed --') {
             hardcodedDataSources++;
          }
        }

        if (p.gridPos) {
          if (p.gridPos.y > maxY) maxY = p.gridPos.y;
          if (p.gridPos.w < 24 && p.gridPos.w % 2 !== 0 && p.gridPos.w % 3 !== 0) {
             gridPosIssues++; 
          }
        }
      }

      const bottomPanels = panels.filter((p:any) => p.gridPos && p.gridPos.y === maxY);
      const bottomWidth = bottomPanels.reduce((sum: number, p: any) => sum + (p.gridPos?.w || 0), 0);
      
      let bottomGapWarning = false;
      if (bottomWidth > 0 && bottomWidth < 24 && bottomPanels.length === 1) {
        bottomGapWarning = true;
      }

      let score = 100;
      if (totalPanels > 40) score -= 20;
      else if (totalPanels > 25) score -= 10;
      
      if (hardcodedDataSources > 0) score -= 15;
      if (gridPosIssues > 0) score -= 5;
      if (bottomGapWarning) score -= 10;

      setAnalysis({
        totalPanels,
        hardcodedDataSources,
        bottomGapWarning,
        gridPosIssues,
        score: Math.max(0, score),
        originalDash: dash
      });

    } catch (err: any) {
      setError(err.message || 'Failed to parse JSON. Make sure it is valid Grafana JSON.');
      setAnalysis(null);
    }
  };

  const autoClean = () => {
    if (!analysis?.originalDash) return;
    
    // Clean nulls and traverse
    const cleaned = removeNullAndDriftKeys(analysis.originalDash);
    
    // Remove specific root metadata
    delete cleaned.id;
    delete cleaned.version;
    delete cleaned.iteration;

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
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-pink-400">Dashboard Analyzer & Cleaner</h2>
          <p className="text-slate-400 mt-2">Validate, score, and auto-clean Grafana Dashboard JSONs for GitOps.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 flex flex-col">
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder='{ "title": "My Dashboard", "panels": [...] }'
              className="w-full h-[500px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 font-mono text-sm focus:border-pink-500 focus:outline-none"
            />
            <div className="flex gap-4">
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
                Auto-Clean for GitOps
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
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl min-h-[400px]">
                <LayoutDashboard size={48} className="mb-4 opacity-50" />
                <p>Paste JSON and click Analyze</p>
              </div>
            )}

            {analysis && !cleanJson && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-center">
                  <div className="text-slate-400 font-bold mb-2 uppercase tracking-wide">Quality Score</div>
                  <div className={`text-6xl font-black ${analysis.score >= 90 ? 'text-emerald-400' : analysis.score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                    {analysis.score}<span className="text-3xl text-slate-500">/100</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-start gap-4">
                    <div className="mt-1">
                      {analysis.totalPanels > 40 ? <AlertCircle className="text-red-400" /> : analysis.totalPanels > 25 ? <AlertTriangle className="text-amber-400" /> : <CheckCircle className="text-emerald-400" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">Panel Count: {analysis.totalPanels}</div>
                      <div className="text-sm text-slate-400 mt-1">
                        {analysis.totalPanels > 25 ? 'Too many panels can cause dashboard rendering lag and slow load times. Consider splitting this dashboard.' : 'Healthy amount of panels for good performance.'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-start gap-4">
                    <div className="mt-1">
                      {analysis.hardcodedDataSources > 0 ? <AlertTriangle className="text-amber-400" /> : <CheckCircle className="text-emerald-400" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">Data Sources</div>
                      <div className="text-sm text-slate-400 mt-1">
                        {analysis.hardcodedDataSources > 0 
                          ? `Found ${analysis.hardcodedDataSources} hardcoded data sources. Use variables (e.g., \${datasource}) so the dashboard is portable across environments.` 
                          : 'Excellent! All panels use variables or default data sources.'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-start gap-4">
                    <div className="mt-1">
                      {analysis.bottomGapWarning ? <AlertCircle className="text-amber-400" /> : <CheckCircle className="text-emerald-400" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200">Grid Layout & Gaps</div>
                      <div className="text-sm text-slate-400 mt-1">
                        {analysis.bottomGapWarning 
                          ? 'The last row has a single panel that does not span the full width (24 units). This leaves ugly empty space on the sides. Make it wider or add empty text panels.' 
                          : 'Layout looks consistent and utilizes the grid well.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {cleanJson && (
              <div className="h-[500px] flex flex-col bg-[#1e1e1e] border border-emerald-500/50 rounded-xl shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                <div className="h-12 bg-emerald-950/30 border-b border-emerald-900/50 flex items-center justify-between px-4 shrink-0">
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle size={16} /> GitOps Cleaned Dashboard
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
