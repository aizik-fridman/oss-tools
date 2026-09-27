import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { parse } from 'yaml';
import { AlertTriangle, CheckCircle, Info, Loader2, Flame, LayoutDashboard } from 'lucide-react';
import { PrometheusAlertsSchema } from './core/schemas';


import CodeInputOverlay from '../../components/ui/CodeInputOverlay';

export default function AlertAnalyzerTool() {
  const [yamlInput, setYamlInput] = useState('');
  const [analysis, setAnalysis] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<'prometheus' | 'grafana' | null>(null);
  const [skippedRules, setSkippedRules] = useState<number>(0);  
        
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<{ [key: string]: (val: any) => void }>({});

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../promql.worker.ts', import.meta.url));
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
      if (!yamlInput || yamlInput.trim() === '') {
        throw new Error('Editor is empty. Please paste some Prometheus or Grafana Alerting YAML to analyze.');
      }
      setIsAnalyzing(true);
      const parsedRaw = parse(yamlInput);
      if (!parsedRaw) {
        throw new Error('Failed to parse YAML. The content might be empty or invalid.');
      }
      
      const validation = PrometheusAlertsSchema.safeParse(parsedRaw);
      if (!validation.success) {
        const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new Error(`Schema Validation Failed: ${issues}`);
      }
      
      const parsed = validation.data;
      let allRules: any[] = [];
      let rules: any[] = [];
      
      if ('groups' in parsed && Array.isArray(parsed.groups)) {
        parsed.groups.forEach((g: any) => {
          if (g.rules && Array.isArray(g.rules)) {
            allRules = [...allRules, ...g.rules];
          }
        });
      } else if (Array.isArray(parsed)) {
        allRules = parsed;
      }
      
      rules = allRules.filter((r: any) => r.alert || r.title);
      const skipped = allRules.length - rules.length;
      setSkippedRules(skipped);

      if (rules.length === 0) {
        if (skipped > 0) {
          throw new Error(`Found ${skipped} recording rules, but no alerting rules. This tool only analyzes alerting rules.`);
        }
        throw new Error('No alerts found in the provided YAML.');
      }

      const analyzedPromises = rules.map(async (rule) => {
        const issues = [];
        const isPrometheus = !!rule.alert;
        const name = rule.alert || rule.title;
        
        let expr = rule.expr;
        if (!isPrometheus && rule.data && Array.isArray(rule.data)) {
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
      const hasPrometheus = rules.some((r: any) => !!r.alert);
      setDetectedFormat(hasPrometheus ? 'prometheus' : 'grafana');
      if (hasPrometheus) {
         
      } else {
         
               }

    } catch (err: any) {
      setError(err.message || 'Failed to parse YAML');
      setAnalysis(null);
      
            setDetectedFormat(null);
      setSkippedRules(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-amber-400">Alert Analyzer</h2>
          <p className="text-slate-400 mt-2">Paste Prometheus or Grafana Unified Alerting YAML rules. We'll explain them and run PromQL structural linters via WebAssembly.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 flex flex-col">
            <div className="w-full h-[400px] border border-slate-700 rounded-xl overflow-hidden shadow-inner bg-[#1e1e1e] relative">
              {!yamlInput && (
                <CodeInputOverlay 
                  language="yaml" 
                  onPaste={(text) => setYamlInput(text)}
                  onUpload={(text) => setYamlInput(text)}
                />
              )}
              <Editor
                height="100%"
                language="yaml"
                theme="vs-dark"
                value={yamlInput}
                onChange={(val) => setYamlInput(val || '')}
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
                
                                {skippedRules > 0 && (
                  <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex items-center gap-3 text-slate-300 mb-6">
                    <Info size={20} className="text-sky-400 shrink-0" />
                    <p className="text-sm">Skipped <b>{skippedRules}</b> recording rules. This tool only analyzes alerting rules.</p>
                  </div>
                )}
                {detectedFormat && (
                  <div className={`p-4 rounded-xl border mb-6 flex items-center gap-3 ${
                    detectedFormat === 'prometheus' ? 'bg-orange-950/30 border-orange-500/30 text-orange-400' : 'bg-amber-950/30 border-amber-500/30 text-amber-400'
                  }`}>
                     {detectedFormat === 'prometheus' ? <Flame size={24} /> : <LayoutDashboard size={24} />}
                     <div>
                       <h3 className="font-bold text-lg">{detectedFormat === 'prometheus' ? 'Prometheus Rules Detected' : 'Grafana Unified Alerting Detected'}</h3>
                       <p className="text-sm opacity-80">
                         {detectedFormat === 'prometheus' ? 'Analyzed native Prometheus alerting rules syntax.' : 'Analyzed Grafana alerting provisioning syntax.'}
                       </p>
                     </div>
                  </div>
                )}
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
                        <CheckCircle size={16} /> No structural issues detected.
                      </div>
                    )}
                  </div>
                ))}
                
                
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
