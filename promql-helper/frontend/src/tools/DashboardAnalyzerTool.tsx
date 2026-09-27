import { useState } from 'react';
import { LayoutDashboard, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export default function DashboardAnalyzerTool() {
  const [jsonInput, setJsonInput] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeDashboard = () => {
    try {
      setError(null);
      const dash = JSON.parse(jsonInput);
      
      if (!dash.panels || !Array.isArray(dash.panels)) {
        throw new Error('Invalid Grafana Dashboard JSON. Missing "panels" array.');
      }

      const panels = dash.panels;
      let totalPanels = 0;
      let hardcodedDataSources = 0;
      let maxY = 0;
      let gridPosIssues = 0;

      panels.forEach((p: any) => {
        // Grafana groups rows as panels. If it's a row, it might contain nested panels.
        if (p.type === 'row' && p.panels) {
          totalPanels += p.panels.length;
          p.panels.forEach((np: any) => analyzePanel(np));
        } else {
          totalPanels++;
          analyzePanel(p);
        }
      });

      function analyzePanel(p: any) {
        // Check Data source
        if (p.datasource && typeof p.datasource === 'string' && !p.datasource.startsWith('$')) {
          hardcodedDataSources++;
        } else if (p.datasource && p.datasource.uid && !p.datasource.uid.startsWith('$')) {
          // Grafana 8+ datasource object
          if (p.datasource.type !== 'grafana' && p.datasource.uid !== '-- Mixed --') {
             hardcodedDataSources++;
          }
        }

        // Check grid layout
        if (p.gridPos) {
          if (p.gridPos.y > maxY) maxY = p.gridPos.y;
          // Check for weird widths
          if (p.gridPos.w < 24 && p.gridPos.w % 2 !== 0 && p.gridPos.w % 3 !== 0) {
             gridPosIssues++; // Hard to align perfectly
          }
        }
      }

      // Check bottom row gaps
      const bottomPanels = panels.filter((p:any) => p.gridPos && p.gridPos.y === maxY);
      const bottomWidth = bottomPanels.reduce((sum: number, p: any) => sum + (p.gridPos?.w || 0), 0);
      
      let bottomGapWarning = false;
      if (bottomWidth > 0 && bottomWidth < 24 && bottomPanels.length === 1) {
        bottomGapWarning = true;
      }

      // Calculate Score
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
      });

    } catch (err: any) {
      setError(err.message || 'Failed to parse JSON. Make sure it is valid Grafana JSON.');
      setAnalysis(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-pink-400">Dashboard Analyzer</h2>
          <p className="text-slate-400 mt-2">Paste your Grafana Dashboard JSON. Get a code-review and quality score.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder='{ "title": "My Dashboard", "panels": [...] }'
              className="w-full h-[500px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 font-mono text-sm focus:border-pink-500 focus:outline-none"
            />
            <button
              onClick={analyzeDashboard}
              className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              Analyze Dashboard
            </button>
            {error && (
              <div className="p-4 bg-red-950/50 border border-red-500/50 text-red-400 rounded-xl">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {analysis === null && !error && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl min-h-[400px]">
                <LayoutDashboard size={48} className="mb-4 opacity-50" />
                <p>Paste JSON and click Analyze</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-center">
                  <div className="text-slate-400 font-bold mb-2 uppercase tracking-wide">Quality Score</div>
                  <div className={`text-6xl font-black ${analysis.score >= 90 ? 'text-emerald-400' : analysis.score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                    {analysis.score}<span className="text-3xl text-slate-500">/100</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Panel Count */}
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

                  {/* Data Sources */}
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

                  {/* Grid / Layout */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
