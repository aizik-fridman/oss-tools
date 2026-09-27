import React, { useRef } from 'react';
import { Clipboard, Upload } from 'lucide-react';

interface CodeInputOverlayProps {
  language: 'json' | 'yaml';
  onPaste: (text: string) => void;
  onUpload: (text: string) => void;
}

export default function CodeInputOverlay({ language, onPaste, onUpload }: CodeInputOverlayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dummyJson = `{
  "dashboard": {
    "id": null,
    "title": "Production Overview",
    "tags": ["templated"],
    "timezone": "browser",
    "panels": [
      {
        "type": "timeseries",
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "node_cpu_seconds_total",
            "refId": "A"
          }
        ]
      }
    ],
    "schemaVersion": 36,
    "version": 1
  }
}`;

  const dummyYaml = `groups:
- name: Production Alerts
  rules:
  - alert: HighCPUUsage
    expr: node_cpu_seconds_total > 0.8
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High CPU usage on {{ $labels.instance }}"
      description: "CPU usage is above 80% for 5 minutes."`;

  const dummyCode = language === 'json' ? dummyJson : dummyYaml;
  const accept = language === 'json' ? '.json' : '.yaml,.yml';

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onPaste(text);
    } catch (err) {
      console.error('Failed to read clipboard', err);
      alert('Failed to read clipboard. Please ensure you have granted clipboard permissions.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onUpload(event.target.result as string);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute inset-0 z-10 bg-[#1e1e1e] flex items-center justify-center overflow-hidden">
      {/* Blurred background code */}
      <div className="absolute inset-0 p-4 opacity-40 blur-[3px] select-none pointer-events-none text-left">
        <pre className="text-slate-400 font-mono text-sm leading-relaxed whitespace-pre-wrap">{dummyCode}</pre>
      </div>

      {/* Action buttons */}
      <div className="relative z-20 flex flex-col gap-4 bg-slate-900/80 p-8 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-2xl">
        <h3 className="text-white font-bold text-lg text-center mb-2">
          {language === 'json' ? 'Input Grafana Dashboard' : 'Input Prometheus Alerts'}
        </h3>
        <button 
          onClick={handlePasteClick} 
          className="flex items-center justify-center gap-3 w-64 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-sky-500/25"
        >
          <Clipboard size={18} /> Paste {language.toUpperCase()}
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="flex items-center justify-center gap-3 w-64 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all shadow-lg"
        >
          <Upload size={18} /> Upload File
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept={accept} 
          onChange={handleFileChange} 
        />
      </div>
    </div>
  );
}
