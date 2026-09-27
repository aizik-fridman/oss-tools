import { useState } from 'react';
import { LayoutDashboard, CheckCircle, AlertTriangle, Copy, Check, ChevronDown, ChevronRight, Activity, Users, ShieldAlert } from 'lucide-react';
import { z } from 'zod';

const DashboardSchema = z.object({
  panels: z.array(z.any()),
  templating: z.object({
    list: z.array(z.any()).optional()
  }).passthrough().optional(),
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
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    perf: true, ux: true, sre: true
  });

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

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
      
      const perfIssues: string[] = [];
      const uxIssues: string[] = [];
      const sreIssues: string[] = [];
      
      const perfSuccess: string[] = [];
      const uxSuccess: string[] = [];
      const sreSuccess: string[] = [];
      
      let score = 100;
      let queryPanels = 0;

      // Flatten panels including rows
      const flatPanels: any[] = [];
      const walkPanels = (panels: any[]) => {
        panels.forEach(p => {
          if (p.type === 'row' && p.panels) {
            walkPanels(p.panels);
          } else if (p.type !== 'row') {
            flatPanels.push(p);
          }
        });
      };
      if (dash.panels) walkPanels(dash.panels);

      // 1. Performance & Load Time
      const templating = dash.templating?.list || [];
      let badVariables = 0;
      templating.forEach((v: any) => {
        if (v.type === 'query' && v.refresh === 2) { 
           if (v.datasource && typeof v.datasource === 'string' && (v.datasource.toLowerCase().includes('prometheus') || v.datasource.toLowerCase().includes('loki'))) {
               perfIssues.push(`Variable '${v.name}' triggers on Time Range Change. This causes lag on zoom. Recommend 'On Dashboard Load'.`);
               score -= 5;
               badVariables++;
           }
        }
      });
      if (badVariables === 0 && templating.length > 0) {
        perfSuccess.push("All template variables refresh efficiently.");
      }

      let badDataPoints = 0;
      let badPromQL = 0;
      flatPanels.forEach(p => {
        if (p.targets && p.targets.length > 0) queryPanels++;
        
        // Resolution Limits
        if (['timeseries', 'graph'].includes(p.type)) {
           if (!p.maxDataPoints || p.maxDataPoints > 1500) {
              perfIssues.push(`Panel '${p.title || 'Untitled'}' has missing or high maxDataPoints. Cap it to avoid browser lag.`);
              score -= 2;
              badDataPoints++;
           }
        }
        
        // PromQL Efficiency
        if (p.targets && Array.isArray(p.targets)) {
           p.targets.forEach((t: any) => {
             if (t.expr && typeof t.expr === 'string') {
               const expr = t.expr;
               if ((expr.includes('rate(') || expr.includes('irate(')) && !expr.includes('$__rate_interval') && !expr.includes('$__interval')) {
                 perfIssues.push(`Panel '${p.title || 'Untitled'}': Uses rate() without $__rate_interval. This can cause graphing artifacts.`);
                 score -= 5;
                 badPromQL++;
               }
               if ((expr.includes('sort(') || expr.includes('sort_desc(')) && !expr.includes('topk') && !expr.includes('bottomk')) {
                 perfIssues.push(`Panel '${p.title || 'Untitled'}': Uses sort() without a bounding function like topk(). This is expensive for the TSDB.`);
                 score -= 5;
                 badPromQL++;
               }
             }
           });
        }
      });

      if (badDataPoints === 0 && flatPanels.length > 0) perfSuccess.push("Max data points appropriately constrained.");
      if (badPromQL === 0 && queryPanels > 0) perfSuccess.push("PromQL queries utilize efficient intervals and bounds.");

      if (queryPanels > 30) {
        perfIssues.push(`High concurrent connection risk: Found ${queryPanels} query-backed panels. Recommended < 30.`);
        score -= 10;
      } else if (queryPanels > 0) {
        perfSuccess.push(`Healthy connection footprint (${queryPanels} query-backed panels).`);
      }

      // 2. UX & On-Call Readiness
      let missingContext = 0;
      let missingUnits = 0;
      let missingThresholds = 0;

      flatPanels.forEach(p => {
        if (['timeseries', 'graph', 'stat', 'gauge'].includes(p.type)) {
           if (!p.description || p.description.trim() === '') {
              uxIssues.push(`Panel '${p.title || 'Untitled'}' lacks a description. SREs need context during incidents.`);
              score -= 2;
              missingContext++;
           }
        }

        // Units
        const unit = p.fieldConfig?.defaults?.unit || (p.yaxes && p.yaxes[0]?.format);
        if (!unit || unit === 'none' || unit === 'short') {
           uxIssues.push(`Panel '${p.title || 'Untitled'}' uses default/no units. Always define explicit units (e.g., bytes, seconds).`);
           score -= 2;
           missingUnits++;
        }

        // Color thresholds
        if (['stat', 'gauge'].includes(p.type)) {
           const steps = p.fieldConfig?.defaults?.thresholds?.steps || p.options?.fieldOptions?.thresholds?.steps;
           if (!steps || steps.length < 2) {
              uxIssues.push(`Panel '${p.title || 'Untitled'}' lacks color thresholds. Red/Yellow/Green indicators are essential for NOC teams.`);
              score -= 3;
              missingThresholds++;
           }
        }
      });
      
      if (missingContext === 0 && flatPanels.length > 0) uxSuccess.push("All complex panels have descriptive context.");
      if (missingUnits === 0 && flatPanels.length > 0) uxSuccess.push("Explicit units defined for all metrics.");
      if (missingThresholds === 0 && flatPanels.length > 0) uxSuccess.push("Color thresholds correctly configured.");

      // 3. SRE Best Practices
      let orphanedVars = 0;
      let nakedRegex = 0;
      let legacyAlerts = 0;

      const dashString = JSON.stringify(dash);
      templating.forEach((v: any) => {
        // Orphaned variables
        const regex = new RegExp(`\\$${v.name}\\b|\\$\\{${v.name}\\}`, 'g');
        const matches = dashString.match(regex);
        if (!matches || matches.length <= 1) {
           sreIssues.push(`Orphaned Variable: '${v.name}' is defined but never used in any panel or query.`);
           score -= 3;
           orphanedVars++;
        }

        // Naked regex
        let queryString = '';
        if (typeof v.query === 'string') {
          queryString = v.query;
        } else if (v.query && typeof v.query.query === 'string') {
          queryString = v.query.query;
        }
        
        if (queryString && (queryString.includes('=~".*"') || queryString.includes('=~ ".*"'))) {
           sreIssues.push(`Variable '${v.name}' uses a naked regex (=~ ".*"). This causes heavy TSDB load. Prefer explicit label matchers.`);
           score -= 5;
           nakedRegex++;
        }
      });

      flatPanels.forEach(p => {
        if (p.alert) {
           sreIssues.push(`Panel '${p.title || 'Untitled'}' contains an embedded Legacy Alert. Migrate to Grafana Unified Alerting.`);
           score -= 5;
           legacyAlerts++;
        }
      });

      if (orphanedVars === 0 && templating.length > 0) sreSuccess.push("No orphaned template variables.");
      if (nakedRegex === 0 && templating.length > 0) sreSuccess.push("No naked regexes in queries.");
      if (legacyAlerts === 0 && flatPanels.length > 0) sreSuccess.push("No legacy alerting rules embedded in panels.");

      setAnalysis({
        perfIssues,
        perfSuccess,
        uxIssues,
        uxSuccess,
        sreIssues,
        sreSuccess,
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
    const cleaned = removeNullAndDriftKeys(analysis.originalDash);
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

  const CategorySection = ({ title, icon: Icon, issues, successes, catKey, color }: any) => {
    const isExpanded = expandedCats[catKey];
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden`}>
        <button 
          onClick={() => toggleCat(catKey)}
          className={`w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/60 transition-colors border-b border-slate-800`}
        >
          <div className="flex items-center gap-3">
            <Icon className={color} size={20} />
            <span className="font-bold text-slate-200">{title}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${issues.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {issues.length > 0 ? `${issues.length} Issues` : 'All Good'}
            </span>
          </div>
          {isExpanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
        </button>
        {isExpanded && (
          <div className="p-4 space-y-4">
            {issues.length > 0 && (
              <ul className="space-y-3">
                {issues.map((iss: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>{iss}</span>
                  </li>
                ))}
              </ul>
            )}
            {successes && successes.length > 0 && (
              <div className={issues.length > 0 ? 'pt-4 border-t border-slate-800' : ''}>
                <h4 className="text-xs font-bold text-emerald-500 mb-2 uppercase tracking-wider">Passed Checks</h4>
                <ul className="space-y-2">
                  {successes.map((suc: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-400">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{suc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {issues.length === 0 && (!successes || successes.length === 0) && (
               <div className="flex items-center gap-2 text-emerald-400 text-sm">
                 <CheckCircle size={16} /> All good! No issues found in this category.
               </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-pink-400">Dashboard Analyzer & Cleaner</h2>
          <p className="text-slate-400 mt-2">Evaluate theoretical load times, UX, and SRE best practices of your Grafana Dashboard JSON.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 flex flex-col h-full">
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder='{ "title": "My Dashboard", "panels": [...] }'
              className="w-full h-[600px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 font-mono text-sm focus:border-pink-500 focus:outline-none"
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
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl min-h-[500px]">
                <LayoutDashboard size={48} className="mb-4 opacity-50" />
                <p>Paste JSON and click Analyze</p>
              </div>
            )}

            {analysis && !cleanJson && (
              <div className="space-y-6 animate-in fade-in max-h-[700px] overflow-y-auto pr-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 font-bold mb-1 uppercase tracking-wide">Health Score</div>
                    <div className="text-sm text-slate-500">Based on SRE Best Practices</div>
                  </div>
                  <div className={`text-5xl font-black ${analysis.score >= 90 ? 'text-emerald-400' : analysis.score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                    {analysis.score}<span className="text-2xl text-slate-500">/100</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <CategorySection title="Performance & Load Time" icon={Activity} issues={analysis.perfIssues} successes={analysis.perfSuccess} catKey="perf" color="text-sky-400" />
                  <CategorySection title="UX & On-Call Readiness" icon={Users} issues={analysis.uxIssues} successes={analysis.uxSuccess} catKey="ux" color="text-fuchsia-400" />
                  <CategorySection title="SRE Best Practices & Hygiene" icon={ShieldAlert} issues={analysis.sreIssues} successes={analysis.sreSuccess} catKey="sre" color="text-emerald-400" />
                </div>
              </div>
            )}

            {cleanJson && (
              <div className="h-[700px] flex flex-col bg-[#1e1e1e] border border-emerald-500/50 rounded-xl shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
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
