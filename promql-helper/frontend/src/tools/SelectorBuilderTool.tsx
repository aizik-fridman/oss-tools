import { useState, useMemo } from 'react';
import { Plus, X, Copy, Check } from 'lucide-react';

export default function SelectorBuilderTool() {
  const [metric, setMetric] = useState('http_requests_total');
  const [labels, setLabels] = useState([{ key: 'status', op: '=', value: '200' }]);
  const [copied, setCopied] = useState(false);

  const addLabel = () => setLabels([...labels, { key: '', op: '=', value: '' }]);
  
  const removeLabel = (i: number) => {
    setLabels(labels.filter((_, idx) => idx !== i));
  };

  const updateLabel = (i: number, field: string, val: string) => {
    const newLabels = [...labels];
    newLabels[i] = { ...newLabels[i], [field]: val };
    setLabels(newLabels);
  };

  const generatedQuery = useMemo(() => {
    const validLabels = labels.filter(l => l.key.trim() !== '');
    if (validLabels.length === 0) return metric.trim();
    
    const labelString = validLabels.map(l => {
      const val = l.value.replace(/"/g, '\\"');
      return `${l.key}${l.op}"${val}"`;
    }).join(', ');

    return `${metric.trim()}{${labelString}}`;
  }, [metric, labels]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-sky-400">Metric Selector Builder</h2>
          <p className="text-slate-400 mt-2">Visually build complex PromQL label matchers.</p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">Metric Name</label>
            <input 
              type="text" 
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="e.g. up, node_cpu_seconds_total"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-400">Label Matchers</label>
              <button 
                onClick={addLabel}
                className="flex items-center gap-1 text-sm bg-sky-900/30 text-sky-400 px-3 py-1.5 rounded-lg border border-sky-800/50 hover:bg-sky-800/50 transition-colors"
              >
                <Plus size={16} /> Add Label
              </button>
            </div>
            
            {labels.map((l, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <input 
                  type="text" 
                  value={l.key}
                  onChange={(e) => updateLabel(i, 'key', e.target.value)}
                  placeholder="label_name"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <select 
                  value={l.op}
                  onChange={(e) => updateLabel(i, 'op', e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500 w-20 text-center font-mono"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value="=~">=~</option>
                  <option value="!~">!~</option>
                </select>
                <input 
                  type="text" 
                  value={l.value}
                  onChange={(e) => updateLabel(i, 'value', e.target.value)}
                  placeholder="value (regex allowed)"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <button 
                  onClick={() => removeLabel(i)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ))}
            
            {labels.length === 0 && (
              <div className="text-center py-6 border border-dashed border-slate-700 rounded-lg text-slate-500">
                No labels added. Query will match all time series for the metric.
              </div>
            )}
          </div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 overflow-x-auto">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-3">Generated PromQL</h3>
              <pre className="text-slate-200 font-mono text-lg whitespace-pre-wrap leading-relaxed">{generatedQuery}</pre>
            </div>
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-lg"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
