import { useState, useEffect, useRef } from 'react';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import { AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react';

const AlertRuleSchema = z.object({
  alert: z.string().optional(),
  title: z.string().optional(),
  expr: z.string().optional(),
  data: z.array(z.any()).optional(),
  for: z.string().optional(),
  labels: z.any().optional(),
  annotations: z.any().optional()
}).passthrough();

const AlertGroupSchema = z.object({
  name: z.string(),
  rules: z.array(AlertRuleSchema)
}).passthrough();

const PrometheusAlertsSchema = z.union([
  z.object({
    groups: z.array(AlertGroupSchema)
  }).passthrough(),
  z.array(AlertRuleSchema)
]);

export default function AlertAnalyzerTool() {
  const [yamlInput, setYamlInput] = useState('');
  const [analysis, setAnalysis] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [legacyRules, setLegacyRules] = useState<any>(null);
  const [convertedYaml, setConvertedYaml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<{ [key: string]: (val: any) => void }>({});

  useEffect(() => {
    workerRef.current = new Worker(new URL('../promql.worker.ts', import.meta.url));
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'PARSE_RESULT' || e.data.type === 'ERROR') {
        const resolve = resolversRef.current[e.data.id];
        if (resolve) {
          if (e.data.type === 'ERROR') {
             resolve({ error: e.data.payload });
          } else {
             try {
               resolve(JSON.parse(e.data.payload));
             } catch(err) {
               resolve({ error: 'Failed to parse worker response' });
             }
          }
          delete resolversRef.current[e.data.id];
        }
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const parsePromQL = (expr: string): Promise<any> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(2, 9);
      resolversRef.current[id] = resolve;
      workerRef.current?.postMessage({ type: 'PARSE', payload: expr, id });
      
      setTimeout(() => {
        if (resolversRef.current[id]) {
          resolve({ error: 'Timeout waiting for WASM worker' });
          delete resolversRef.current[id];
        }
      }, 5000);
    });
  };

  const analyzeYaml = async () => {
    try {
      setError(null);
      setIsAnalyzing(true);
      const parsedRaw = parse(yamlInput);
      
      const validation = PrometheusAlertsSchema.safeParse(parsedRaw);
      if (!validation.success) {
        throw new Error('Schema Validation Failed: Invalid Prometheus rules format.');
      }
      
      const parsed = validation.data;
      let rules: any[] = [];
      
      if ('groups' in parsed && Array.isArray(parsed.groups)) {
        parsed.groups.forEach((g: any) => {
          if (g.rules && Array.isArray(g.rules)) {
            rules = [...rules, ...g.rules.filter((r: any) => r.alert || r.title)];
          }
        });
      } else if (Array.isArray(parsed)) {
        rules = parsed.filter((r: any) => r.alert || r.title);
      }

      if (rules.length === 0) {
        throw new Error('No alerts found in the provided YAML.');
      }

      const analyzedPromises = rules.map(async (rule) => {
        const issues = [];
        const isLegacy = !!rule.alert;
        const name = rule.alert || rule.title;
        
        let expr = rule.expr;
        if (!isLegacy && rule.data && Array.isArray(rule.data)) {
           const queryNode = rule.data.find((d: any) => d.model && d.model.expr);
           if (queryNode) expr = queryNode.model.expr;
        }
        
        if (!rule.annotations?.summary) {
          issues.push('Missing "summary" annotation. It is highly recommended to provide a short summary of the alert.');
        }
        if (!rule.annotations?.runbook_url && !rule.annotations?.runbook) {
          issues.push('Missing "runbook_url". SREs need a runbook to know how to fix this issue.');
        }
        if (!rule.labels?.severity) {
          issues.push('Missing "severity" label (e.g., critical, warning, info).');
        }
        if (isLegacy) {
          issues.push('💡 Tip: This rule uses Legacy format. Use the YAML Converter tool to upgrade it to Grafana Unified Alerting.');
        }

        if (expr) {
          const linterRes = await parsePromQL(expr);
          if (linterRes.error) {
             issues.push(`PromQL Syntax Error: ${linterRes.error}`);
          }
          if (linterRes.warnings && Array.isArray(linterRes.warnings)) {
             linterRes.warnings.forEach((w: string) => issues.push(`PromQL Warning: ${w}`));
          }
        }

        return {
          name,
          expr: expr || 'Unknown expression',
          for: rule.for || '0s (fires immediately)',
          severity: rule.labels?.severity || 'none',
          summary: rule.annotations?.summary || 'No summary provided',
          issues
        };
      });

      const analyzed = await Promise.all(analyzedPromises);
      setAnalysis(analyzed);
      
      // Determine if we need to offer conversion
      const hasLegacy = rules.some((r: any) => !!r.alert);
      if (hasLegacy) {
         setLegacyRules({ original: parsedRaw, rules });
      } else {
         setLegacyRules(null);
         setConvertedYaml(null);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to parse YAML');
      setAnalysis(null);
      setLegacyRules(null);
      setConvertedYaml(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const convertToUnified = () => {
    if (!legacyRules) return;
    try {
      const { original, rules } = legacyRules;
      
      let groupName = 'Converted_Alerts';
      let folder = 'Imported Alerts';
      
      if (original.groups && original.groups[0]) {
        groupName = original.groups[0].name || groupName;
      }
      
      const newRules = rules.map((r: any) => ({
        title: r.alert || 'Unnamed Alert',
        condition: 'A',
        data: [
          {
            refId: 'A',
            relativeTimeRange: { from: 600, to: 0 },
            datasourceUid: 'prometheus-default',
            model: {
              expr: r.expr,
              refId: 'A',
            }
          }
        ],
        noDataState: 'NoData',
        execErrState: 'Error',
        for: r.for || '5m',
        annotations: r.annotations || {},
        labels: r.labels || {},
        isPaused: false
      }));

      const unifiedAlertingFormat = {
        apiVersion: 1,
        groups: [
          {
            orgId: 1,
            name: groupName,
            folder: folder,
            interval: '1m',
            rules: newRules
          }
        ]
      };
      
      setConvertedYaml(stringify(unifiedAlertingFormat, { indent: 2 }));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-amber-400">Alert Analyzer</h2>
          <p className="text-slate-400 mt-2">Paste Prometheus alert rules YAML. We'll explain them and run PromQL structural linters via WebAssembly.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 flex flex-col">
            <textarea
              value={yamlInput}
              onChange={e => setYamlInput(e.target.value)}
              placeholder="groups:\n  - name: ExampleGroup\n    rules:\n      - alert: HighCpu\n        expr: node_cpu_seconds_total > 80"
              className="w-full h-[500px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 font-mono text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={analyzeYaml}
              disabled={isAnalyzing}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              {isAnalyzing ? <><Loader2 className="animate-spin" /> Analyzing via WASM...</> : 'Analyze Alerts'}
            </button>
            {error && (
              <div className="p-4 bg-red-950/50 border border-red-500/50 text-red-400 rounded-xl">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {analysis === null && !error && !isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl min-h-[400px]">
                <Info size={48} className="mb-4 opacity-50" />
                <p>Paste YAML and click Analyze</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                <div className="text-slate-300 font-medium mb-2">
                  Found {analysis.length} alert{analysis.length !== 1 ? 's' : ''}:
                </div>
                
                {analysis.map((a, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg animate-in slide-in-from-right-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sky-400 text-lg">{a.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${a.severity === 'critical' ? 'bg-red-900/50 text-red-400' : a.severity === 'warning' ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                        {a.severity}
                      </span>
                    </div>
                    
                    <div className="mb-4 text-slate-300 text-sm">
                      <span className="font-bold text-slate-400 block mb-1">Explanation:</span>
                      Fires when <code className="bg-slate-800 text-emerald-400 px-1 py-0.5 rounded text-xs break-all">{a.expr}</code> is true for <strong className="text-white">{a.for}</strong>.
                      <br/>
                      <span className="text-slate-400 italic mt-2 block">"{a.summary}"</span>
                    </div>

                    {a.issues.length > 0 ? (
                      <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-amber-500 text-sm font-bold mb-2">
                          <AlertTriangle size={16} /> Analysis Findings ({a.issues.length})
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-xs text-amber-200/80">
                          {a.issues.map((issue: string, idx: number) => <li key={idx}>{issue}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-500 text-sm font-bold bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-3">
                        <CheckCircle size={16} /> Perfect Configuration!
                      </div>
                    )}
                  </div>
                ))}
                
                {legacyRules && !convertedYaml && (
                  <div className="bg-orange-950/30 border border-orange-500/50 rounded-xl p-6 text-center animate-in fade-in mt-8 shadow-xl">
                    <h3 className="text-orange-400 font-bold mb-2 text-lg">Legacy Format Detected</h3>
                    <p className="text-orange-200/80 text-sm mb-4">We found legacy Prometheus rules. Would you like to automatically convert them to Grafana 9+ Unified Alerting format?</p>
                    <button 
                      onClick={convertToUnified}
                      className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors"
                    >
                      Convert to Unified Alerting
                    </button>
                  </div>
                )}
                
                {convertedYaml && (
                  <div className="bg-[#1e1e1e] border border-orange-500/50 rounded-xl mt-8 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="h-12 bg-orange-950/30 border-b border-orange-900/50 flex items-center justify-between px-4 shrink-0">
                      <span className="text-sm font-bold text-orange-400">Grafana 9+ Unified Alerting</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(convertedYaml);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }} 
                        className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                      >
                        {copied ? 'Copied' : 'Copy YAML'}
                      </button>
                    </div>
                    <div className="p-4 max-h-[400px] overflow-auto">
                      <pre className="text-slate-300 font-mono text-sm leading-relaxed">{convertedYaml}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
