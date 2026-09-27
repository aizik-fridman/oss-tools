import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function AlertGeneratorTool() {
  const [name, setName] = useState('HighErrorRate');
  const [expr, setExpr] = useState('rate(http_requests_total{status="500"}[5m]) > 10');
  const [forDuration, setForDuration] = useState('5m');
  const [severity, setSeverity] = useState('critical');
  const [summary, setSummary] = useState('High error rate on {{ $labels.instance }}');
  const [description, setDescription] = useState('The HTTP 500 error rate is {{ $value | humanize }} per second.');
  const [copied, setCopied] = useState(false);

  const generatedYaml = `- alert: ${name}
  expr: ${expr}
  for: ${forDuration}
  labels:
    severity: ${severity}
  annotations:
    summary: "${summary}"
    description: "${description}"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#0f172a]">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h2 className="text-2xl font-bold text-amber-400">Alerting Rule Generator</h2>
          <p className="text-slate-400 mt-2">Quickly scaffold Prometheus alert YAML definitions.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Alert Name</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">PromQL Expression (Trigger)</label>
              <textarea 
                value={expr} onChange={e => setExpr(e.target.value)} rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-400 mb-1">For (Duration)</label>
                <input 
                  type="text" value={forDuration} onChange={e => setForDuration(e.target.value)} placeholder="e.g. 5m"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-400 mb-1">Severity</label>
                <select 
                  value={severity} onChange={e => setSeverity(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                >
                  <option value="critical">critical</option>
                  <option value="warning">warning</option>
                  <option value="info">info</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Summary Annotation</label>
              <input 
                type="text" value={summary} onChange={e => setSummary(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description Annotation</label>
              <textarea 
                value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
              />
            </div>
          </div>

          <div className="bg-[#1e1e1e] border border-slate-800 rounded-xl flex flex-col shadow-2xl relative overflow-hidden">
            <div className="h-10 bg-[#2d2d2d] border-b border-[#3d3d3d] flex items-center justify-between px-4">
              <span className="text-xs font-mono text-slate-400">rules.yml</span>
              <button onClick={copyToClipboard} className="text-slate-400 hover:text-white transition-colors">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-[#d4d4d4] font-mono text-sm leading-relaxed">
<span className="text-[#569cd6]">- alert:</span> <span className="text-[#ce9178]">{name}</span>
  <span className="text-[#569cd6]">expr:</span> <span className="text-[#ce9178]">{expr}</span>
  <span className="text-[#569cd6]">for:</span> <span className="text-[#b5cea8]">{forDuration}</span>
  <span className="text-[#569cd6]">labels:</span>
    <span className="text-[#569cd6]">severity:</span> <span className="text-[#ce9178]">{severity}</span>
  <span className="text-[#569cd6]">annotations:</span>
    <span className="text-[#569cd6]">summary:</span> <span className="text-[#ce9178]">"{summary}"</span>
    <span className="text-[#569cd6]">description:</span> <span className="text-[#ce9178]">"{description}"</span>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
