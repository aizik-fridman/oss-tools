import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { LayoutDashboard, CheckCircle, AlertTriangle, AlertCircle, Copy, Check, ChevronDown, ChevronRight, Activity, Users, ShieldAlert, Info as InfoIcon } from 'lucide-react';
import { z } from 'zod';

export type Severity = 'critical' | 'warning' | 'info';
export type Confidence = 'high' | 'medium' | 'low';
export type Category = 'performance' | 'ux' | 'sre';

export interface Finding {
  id: string;
  severity: Severity;
  confidence: Confidence;
  category: Category;
  title: string;
  description: string;
  recommendation?: string;
  panel?: string;
  variable?: string;
}

export interface AnalysisResult {
  stats: {
    totalPanels: number;
    queryPanels: number;
    totalTargets: number;
    variables: number;
    checksRun: number;
    passed: number;
    warnings: number;
    critical: number;
    info: number;
  };
  findings: Finding[];
  originalDash: any;
}

const DashboardSchema = z.object({
  panels: z.array(z.any()).optional(),
  templating: z.object({
    list: z.array(z.any()).optional()
  }).passthrough().optional(),
}).passthrough();

const gitOpsTransientKeys = ['id', 'version', 'iteration'];

function cleanForGitOps(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanForGitOps);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!gitOpsTransientKeys.includes(key)) {
        newObj[key] = cleanForGitOps(value);
      }
    }
    return newObj;
  }
  return obj;
}

export function performAnalysis(dash: any): AnalysisResult {
  const findings: Finding[] = [];
  const checksRun = new Set<string>();
  
  let totalPanels = 0;
  let queryPanels = 0;
  let totalTargets = 0;
  let variables = 0;

  const addFinding = (f: Omit<Finding, 'id'>) => {
    findings.push({ ...f, id: Math.random().toString(36).substr(2, 9) });
  };

  const markCheck = (checkName: string) => checksRun.add(checkName);

  // Flatten panels
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

  totalPanels = flatPanels.length;
  
  // Dashboard Level Checks
  markCheck('time_range');
  if (dash.time && dash.time.from) {
    const from = dash.time.from;
    if (from.match(/now-[7-9]d|now-[1-9][0-9]d|now-[1-9]w|now-[1-9]M|now-[1-9]y/)) {
      addFinding({
        severity: 'info',
        confidence: 'medium',
        category: 'performance',
        title: 'Long default time range',
        description: `Long default time range detected (${from}).`,
        recommendation: 'Large time ranges can increase query cost depending on metric cardinality and query structure.'
      });
    }
  }

  markCheck('refresh_interval');
  if (dash.refresh && ['5s', '10s'].includes(dash.refresh)) {
    addFinding({
      severity: 'warning',
      confidence: 'medium',
      category: 'performance',
      title: 'Fast dashboard refresh',
      description: `Fast dashboard refresh detected: ${dash.refresh}.`,
      recommendation: 'Frequent refreshes may increase datasource load.'
    });
  }

  // Variables Checks
  const templating = dash.templating?.list || [];
  variables = templating.length;
  const dashString = JSON.stringify(dash);

  templating.forEach((v: any) => {
    markCheck('variable_refresh');
    if (v.type === 'query' && v.refresh === 2) {
      addFinding({
        severity: 'warning',
        confidence: 'medium',
        category: 'performance',
        title: 'Variable refresh on time range change',
        description: `Variable '${v.name}' is set to refresh on Time Range Change.`,
        recommendation: 'Consider setting this to "On Dashboard Load" to avoid extra queries on every zoom action.',
        variable: v.name
      });
    }

    markCheck('variable_orphaned');
    const varRegex = new RegExp(`\\$${v.name}(?![a-zA-Z0-9_])|\\$\\{${v.name}(:[a-zA-Z0-9_]+)?\\}`, 'g');
    const matches = dashString.match(varRegex);
    // If it only matches 0 or 1 time, it means it's likely only the declaration in the templating list itself.
    // However, the declaration name is inside "name":"instance", so it doesn't have the $ prefix!
    // Therefore, if there are ANY matches of $instance or ${instance}, it means it IS used.
    if (!matches || matches.length === 0) {
      addFinding({
        severity: 'warning',
        confidence: 'high',
        category: 'sre',
        title: 'Orphaned template variable',
        description: `Variable '${v.name}' is defined but does not appear to be used in any panel or query.`,
        recommendation: 'Remove unused variables to keep the dashboard clean and avoid unnecessary queries.',
        variable: v.name
      });
    }

    markCheck('variable_regex');
    let queryString = '';
    if (typeof v.query === 'string') {
      queryString = v.query;
    } else if (v.query && typeof v.query.query === 'string') {
      queryString = v.query.query;
    }
    
    if (queryString && queryString.match(/=~\s*['"].*\*['"]/)) {
      addFinding({
        severity: 'warning',
        confidence: 'medium',
        category: 'sre',
        title: 'Broad regex matcher',
        description: `Broad regex matcher detected (=~ ".*") in variable '${v.name}'.`,
        recommendation: 'Consider narrowing the matcher when possible, especially on high-cardinality labels.',
        variable: v.name
      });
    }
  });

  // Panel Checks
  flatPanels.forEach(p => {
    const title = p.title || 'Untitled';
    if (p.targets && p.targets.length > 0) {
      queryPanels++;
      totalTargets += p.targets.length;
    }

    markCheck('panel_description');
    if (!p.description || p.description.trim() === '') {
      let conf: Confidence = 'low';
      if (['timeseries', 'graph', 'stat', 'gauge'].includes(p.type)) conf = 'medium';
      
      addFinding({
        severity: 'info',
        confidence: conf,
        category: 'ux',
        title: 'No panel description',
        description: 'No panel description detected.',
        recommendation: 'Consider adding context for on-call users to explain what this panel indicates.',
        panel: title
      });
    }

    markCheck('panel_maxDataPoints');
    if (['timeseries', 'graph'].includes(p.type)) {
      if (!p.maxDataPoints) {
        addFinding({
          severity: 'info',
          confidence: 'low',
          category: 'performance',
          title: 'Missing maxDataPoints',
          description: 'Panel does not explicitly define maxDataPoints. Grafana may still handle resolution automatically.',
          recommendation: 'Consider configuring it only when the dashboard has known high-cardinality or high-resolution workloads.',
          panel: title
        });
      }
    }

    markCheck('panel_units');
    const unit = p.fieldConfig?.defaults?.unit || p.fieldConfig?.overrides?.find((o: any) => o.properties?.find((prop: any) => prop.id === 'unit')) || (p.yaxes && p.yaxes[0]?.format);
    if (!unit || unit === 'none' || unit === 'short') {
      const skipUnits = ['text', 'table', 'logs', 'traces', 'alertlist', 'dashlist'];
      if (!skipUnits.includes(p.type)) {
        addFinding({
          severity: 'info',
          confidence: 'medium',
          category: 'ux',
          title: 'No explicit unit',
          description: 'No explicit unit detected.',
          recommendation: 'Consider defining a unit when the metric represents a measurable quantity (e.g. avoid unit on booleans or status codes).',
          panel: title
        });
      }
    }

    markCheck('panel_thresholds');
    if (['stat', 'gauge'].includes(p.type)) {
      const steps = p.fieldConfig?.defaults?.thresholds?.steps || p.options?.fieldOptions?.thresholds?.steps;
      if (!steps || steps.length < 2) {
        let conf: Confidence = 'low';
        const tLower = title.toLowerCase();
        if (tLower.includes('cpu') || tLower.includes('memory') || tLower.includes('disk') || tLower.includes('latency') || tLower.includes('error') || tLower.includes('availability')) {
          conf = 'medium';
        }
        addFinding({
          severity: 'info',
          confidence: conf,
          category: 'ux',
          title: 'No thresholds configured',
          description: 'No color thresholds configured for this panel.',
          recommendation: 'Consider thresholds when this panel represents health, saturation, capacity, or severity.',
          panel: title
        });
      }
    }

    markCheck('legacy_alert');
    if (p.alert) {
      addFinding({
        severity: 'warning',
        confidence: 'high',
        category: 'sre',
        title: 'Legacy alerting',
        description: 'Legacy panel alert configuration detected.',
        recommendation: 'Consider migrating this alert to Grafana Unified Alerting.',
        panel: title
      });
    }

    markCheck('promql_heuristics');
    if (p.targets && Array.isArray(p.targets)) {
      p.targets.forEach((t: any) => {
        if (t.expr && typeof t.expr === 'string') {
          const expr = t.expr;
          
          if ((expr.includes('rate(') || expr.includes('irate(')) && !expr.includes('$__rate_interval')) {
            addFinding({
              severity: 'warning',
              confidence: 'medium',
              category: 'performance',
              title: 'Fixed rate interval',
              description: 'Fixed rate interval detected.',
              recommendation: 'Consider using $__rate_interval when the query should adapt to the dashboard resolution.',
              panel: title
            });
          }

          const heavyConstructs = ['sort(', 'sort_desc(', 'count_values(', 'histogram_quantile(', 'label_replace(', 'label_join('];
          for (const construct of heavyConstructs) {
            if (expr.includes(construct)) {
              addFinding({
                severity: 'info',
                confidence: 'medium',
                category: 'performance',
                title: 'Heavy PromQL construct',
                description: `Potentially expensive PromQL construct detected: ${construct.replace('(', '()')}.`,
                recommendation: 'This may increase query cost depending on cardinality and query structure. Ensure it is bounded appropriately.',
                panel: title
              });
            }
          }

          if (expr.match(/{[a-zA-Z_]+}=~\s*['"].*\*['"]/)) {
            addFinding({
              severity: 'warning',
              confidence: 'medium',
              category: 'sre',
              title: 'Broad PromQL selector',
              description: 'Broad regex selector detected (e.g. =~ ".*").',
              recommendation: 'Consider narrowing the matcher when possible, especially on high-cardinality labels.',
              panel: title
            });
          }
        }
      });
    }
  });

  const warnings = findings.filter(f => f.severity === 'warning').length;
  const critical = findings.filter(f => f.severity === 'critical').length;
  const info = findings.filter(f => f.severity === 'info').length;

  return {
    stats: {
      totalPanels,
      queryPanels,
      totalTargets,
      variables,
      checksRun: checksRun.size,
      passed: checksRun.size > 0 ? Math.max(0, checksRun.size - findings.length) : 0, 
      // passed represents the number of checks that yielded no findings (rough approximation, as a single check can yield multiple findings)
      // Actually, standardizing `passed` as `total checks passed across the board` is tricky. The user says "14 Checks, 9 Passed".
      warnings,
      critical,
      info
    },
    findings,
    originalDash: dash
  };
}

export default function DashboardAnalyzerTool() {
  const [jsonInput, setJsonInput] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanJson, setCleanJson] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    performance: true, ux: true, sre: true
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
        throw new Error('Schema Validation Failed: Invalid Grafana Dashboard JSON.');
      }
      
      const res = performAnalysis(parsed.data);
      
      // Calculate realistic "Passed" metric (12 categories of checks - categories that yielded findings)
      const uniqueTriggeredChecks = new Set(res.findings.map(f => f.title)).size;
      const totalPossibleChecks = 12; // Static number of check categories implemented
      res.stats.checksRun = totalPossibleChecks;
      res.stats.passed = Math.max(0, totalPossibleChecks - uniqueTriggeredChecks);

      setAnalysis(res);
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

  const FindingCard = ({ finding }: { finding: Finding }) => {
    const isCritical = finding.severity === 'critical';
    const isWarning = finding.severity === 'warning';
    
    return (
      <div className={`p-4 rounded-xl border ${isCritical ? 'bg-red-950/30 border-red-900/50' : isWarning ? 'bg-amber-950/30 border-amber-900/50' : 'bg-sky-950/30 border-sky-900/50'} mb-3 last:mb-0`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {isCritical ? <AlertCircle size={16} className="text-red-400" /> : isWarning ? <AlertTriangle size={16} className="text-amber-400" /> : <InfoIcon size={16} className="text-sky-400" />}
            <h4 className={`font-bold text-sm ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-sky-400'}`}>
              [{finding.severity.toUpperCase()}] {finding.title}
            </h4>
          </div>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
            finding.confidence === 'high' ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' : 
            finding.confidence === 'medium' ? 'bg-blue-900/30 border-blue-500/30 text-blue-300' : 
            'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            {finding.confidence} Confidence
          </span>
        </div>
        
        {(finding.panel || finding.variable) && (
          <div className="text-xs text-slate-400 mb-2 font-mono bg-slate-900/50 px-2 py-1 rounded inline-block">
            {finding.panel ? `Panel: ${finding.panel}` : `Variable: ${finding.variable}`}
          </div>
        )}
        
        <p className="text-sm text-slate-300 mb-1">{finding.description}</p>
        {finding.recommendation && (
          <p className="text-sm text-emerald-400/90 italic">{finding.recommendation}</p>
        )}
      </div>
    );
  };

  const CategorySection = ({ title, icon: Icon, catKey, color }: any) => {
    const isExpanded = expandedCats[catKey];
    const catFindings = analysis?.findings.filter(f => f.category === catKey) || [];
    
    return (
      <div className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden`}>
        <button 
          onClick={() => toggleCat(catKey)}
          className={`w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/60 transition-colors border-b border-slate-800`}
        >
          <div className="flex items-center gap-3">
            <Icon className={color} size={20} />
            <span className="font-bold text-slate-200">{title}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${catFindings.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {catFindings.length > 0 ? `${catFindings.length} Findings` : 'All Good'}
            </span>
          </div>
          {isExpanded ? <ChevronDown size={20} className="text-slate-500" /> : <ChevronRight size={20} className="text-slate-500" />}
        </button>
        {isExpanded && (
          <div className="p-4 bg-slate-900/30">
            {catFindings.length > 0 ? (
              <div>
                {catFindings.map(f => <FindingCard key={f.id} finding={f} />)}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle size={16} /> No findings in this category.
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
          <h2 className="text-2xl font-bold text-pink-400">Dashboard Static Analyzer</h2>
          <p className="text-slate-400 mt-2">Professional, static analysis for Grafana Dashboards based on SRE methodologies.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 flex flex-col h-full">
            <div className="w-full h-[600px] border border-slate-700 rounded-xl overflow-hidden shadow-inner bg-[#1e1e1e]">
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

                <div className="grid grid-cols-4 gap-4">
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
                  <CategorySection title="Performance & Load Time" icon={Activity} catKey="performance" color="text-sky-400" />
                  <CategorySection title="UX & On-Call Readiness" icon={Users} catKey="ux" color="text-fuchsia-400" />
                  <CategorySection title="SRE Best Practices & Hygiene" icon={ShieldAlert} catKey="sre" color="text-emerald-400" />
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
