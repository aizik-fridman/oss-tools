import React, { useRef, useState } from 'react';
import { Clipboard, Upload, Globe, ArrowLeft, Download, Loader2 } from 'lucide-react';

interface CodeInputOverlayProps {
  language: 'json' | 'yaml';
  onPaste: (text: string) => void;
  onUpload: (text: string) => void;
}

export default function CodeInputOverlay({ language, onPaste, onUpload }: CodeInputOverlayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGithubInput, setShowGithubInput] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [githubError, setGithubError] = useState('');

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

  const fetchFromGithub = async () => {
    if (!githubUrl.trim()) return;
    setIsFetching(true);
    setGithubError('');
    try {
      let url = githubUrl.trim();
      if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
        url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}. Only public files are supported.`);
      }
      const text = await res.text();
      onPaste(text);
    } catch (err: any) {
      setGithubError(err.message || 'Failed to fetch file. Make sure it is a raw public file URL.');
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 bg-[#1e1e1e] flex items-center justify-center overflow-hidden">
      {/* Blurred background code */}
      <div className="absolute inset-0 p-4 opacity-40 blur-[3px] select-none pointer-events-none text-left">
        <pre className="text-slate-400 font-mono text-sm leading-relaxed whitespace-pre-wrap">{dummyCode}</pre>
      </div>

      {/* Action buttons */}
      <div className="relative z-20 flex flex-col gap-4 bg-slate-900/80 p-8 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-2xl w-[90%] max-w-sm">
        <h3 className="text-white font-bold text-lg text-center mb-2">
          {language === 'json' ? 'Input Grafana Dashboard' : 'Input Prometheus Alerts'}
        </h3>
        
        {!showGithubInput ? (
          <>
            <button 
              onClick={handlePasteClick} 
              className="flex items-center justify-center gap-3 w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-sky-500/25"
            >
              <Clipboard size={18} /> Paste {language.toUpperCase()}
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex items-center justify-center gap-3 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              <Upload size={18} /> Upload File
            </button>
            <button 
              onClick={() => setShowGithubInput(true)} 
              className="flex items-center justify-center gap-3 w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold rounded-xl transition-all shadow-lg"
            >
              <Globe size={18} /> Import from URL (GitHub)
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
            <button 
              onClick={() => { setShowGithubInput(false); setGithubError(''); }} 
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-1 w-fit transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <input 
              type="text"
              placeholder={`https://github.com/.../file.${language}`}
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {githubError && <div className="text-xs text-red-400 mt-1">{githubError}</div>}
            <button 
              onClick={fetchFromGithub}
              disabled={isFetching || !githubUrl.trim()}
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg mt-2"
            >
              {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isFetching ? 'Fetching...' : 'Fetch File'}
            </button>
          </div>
        )}
        
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
