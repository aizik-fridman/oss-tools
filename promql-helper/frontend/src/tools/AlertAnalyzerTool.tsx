import { useState } from 'react';
import { parse } from 'yaml';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function AlertAnalyzerTool() {
  const [yamlInput, setYamlInput] = useState('');
  const [analysis, setAnalysis] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeYaml = () => {
    try {
      setError(null);
      const parsed = parse(yamlInput);
      
      let rules: any[] = [];
      
      // Handle standard prometheus format: groups -> rules
      if (parsed?.groups && Array.isArray(parsed.groups)) {
        parsed.groups.forEach((g: any) => {
          if (g.rules && Array.isArray(g.rules)) {
            rules = [...rules, ...g.rules.filter((r: any) => r.alert || r.title)];
          }
        });
      } else if (Array.isArray(parsed)) {
        // Flat array of rules
        rules = parsed.filter(r => r.alert || r.title);
      } else {
        throw new Error('Invalid rules format. Expected "groups" array containing "rules".');
      }

      if (rules.length === 0) {
        throw new Error('No alerts found in the provided YAML.');
      }

      const analyzed = rules.map(rule => {
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

        return {
          name,
          expr: expr || 'Unknown expression',
          for: rule.for || '0s (fires immediately)',
          severity: rule.labels?.severity || 'none',
          summary: rule.annotations?.summary || 'No summary provided',
          issues
        };
      });

      setAnalysis(analyzed);
    } catch (err: any) {
      setError(err.message || 'Failed to parse YAML');
      setAnalysis(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-amber-400">Alert Analyzer</h2>
          <p className="text-slate-400 mt-2">Paste Prometheus alert rules YAML. We'll explain them and check for best practices.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <textarea
              value={yamlInput}
              onChange={e => setYamlInput(e.target.value)}
              placeholder="groups:\n  - name: ExampleGroup\n    rules:\n      - alert: HighCpu\n        expr: node_cpu_seconds_total > 80"
              className="w-full h-[500px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 font-mono text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={analyzeYaml}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              Analyze Alerts
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
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
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
                          <AlertTriangle size={16} /> Best Practice Warnings ({a.issues.length})
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
