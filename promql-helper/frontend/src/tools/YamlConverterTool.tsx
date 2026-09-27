import { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { parse, stringify } from 'yaml';

export default function YamlConverterTool() {
  const [inputYaml, setInputYaml] = useState('');
  const [outputYaml, setOutputYaml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const convertAlerts = () => {
    try {
      setError(null);
      const parsed = parse(inputYaml);
      
      if (!parsed) throw new Error('Empty or invalid YAML');

      // Detect if it's Legacy Dashboard Alert JSON or older YAML
      // We'll provide a generic converter that attempts to structure 
      // old rules into Grafana 9 Unified Alerting format.
      
      let newRules: any[] = [];
      let groupName = 'Converted_Alerts';

      if (parsed.groups) {
        groupName = parsed.groups[0]?.name || groupName;
        const rawRules = parsed.groups.flatMap((g: any) => g.rules || []);
        newRules = processRules(rawRules);
      } else if (Array.isArray(parsed)) {
        newRules = processRules(parsed);
      } else {
         throw new Error('Unsupported format. Expected Prometheus groups array or flat rules array.');
      }

      const unifiedAlertingFormat = {
        apiVersion: 1,
        groups: [
          {
            orgId: 1,
            name: groupName,
            folder: 'Converted Alerts Folder',
            interval: '1m',
            rules: newRules
          }
        ]
      };

      setOutputYaml(stringify(unifiedAlertingFormat, { indent: 2 }));
    } catch (err: any) {
      setError(err.message || 'Conversion failed');
      setOutputYaml('');
    }
  };

  function processRules(rules: any[]) {
    return rules.map((r: any) => {
      // Create Grafana Unified Alerting Rule structure
      return {
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
      };
    });
  }

  const copyOutput = () => {
    navigator.clipboard.writeText(outputYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-orange-400">Grafana Alerting YAML Converter</h2>
          <p className="text-slate-400 mt-2">Convert Legacy Prometheus/Grafana Rules to Grafana 9+ Unified Alerting format.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-4 h-[600px]">
          <div className="flex-1 flex flex-col relative">
            <label className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Legacy Format</label>
            <textarea
              value={inputYaml}
              onChange={e => setInputYaml(e.target.value)}
              placeholder="groups:\n- name: Example\n  rules:\n  - alert: HighCPU\n    expr: cpu > 90"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 font-mono text-sm focus:border-orange-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-center py-4 lg:py-0 lg:px-2">
            <button
              onClick={convertAlerts}
              className="p-4 bg-orange-600 hover:bg-orange-500 text-white rounded-full transition-transform hover:scale-110 shadow-lg shadow-orange-900/50 flex items-center justify-center"
              title="Convert"
            >
              <RefreshCw size={24} />
            </button>
          </div>

          <div className="flex-1 flex flex-col relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-orange-400 uppercase tracking-wider">Unified Alerting (Grafana 9+)</label>
              {outputYaml && (
                <button onClick={copyOutput} className="text-slate-400 hover:text-white flex items-center gap-1 text-xs">
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            
            <div className="flex-1 bg-[#1e1e1e] border border-slate-700 rounded-xl p-4 overflow-auto">
              {error ? (
                <div className="text-red-400 font-medium p-2">{error}</div>
              ) : outputYaml ? (
                <pre className="text-slate-300 font-mono text-sm leading-relaxed">{outputYaml}</pre>
              ) : (
                <div className="text-slate-600 h-full flex items-center justify-center text-sm font-mono italic">
                  Converted YAML will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
