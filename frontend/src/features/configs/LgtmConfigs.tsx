import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Editor from '@monaco-editor/react';
import { Download, Copy, Check, FileText, Settings, Container, Box, ShieldAlert } from 'lucide-react';
import type * as Monaco from 'monaco-editor';

import { toolsData, type Environment } from './toolsData';

const hoverExplanations: Record<string, string> = {
  'scrape_configs': '**`scrape_configs`**\n\nDefines the targets Prometheus/Alloy will scrape metrics or logs from. Recommended to use service discovery (e.g. `kubernetes_sd_configs`) in production rather than `static_configs`.',
  'remote_write': '**`remote_write`**\n\nSends scraped metrics to a remote storage endpoint (like Mimir or Thanos). Recommended when running Prometheus as a stateless agent.',
  'storage': '**`storage`**\n\nConfigures where data is stored. For local testing, `filesystem` or `local` is fine. For production, always use an object store like S3/GCS.',
  'schema_config': '**`schema_config`**\n\nDefines the index schema and chunk storage periods for Loki. TSDB is the recommended modern schema.',
  'compactor': '**`compactor`**\n\nReduces long-term storage size by deduplicating and merging blocks. Crucial for Mimir/Tempo/Loki in production to keep storage costs low.',
  'ring': '**`ring`**\n\nManages the hash ring for distributed components. `inmemory` is only for single-node testing. In production, use `memberlist` or `etcd` / `consul`.',
  'forward_to': '**`forward_to`**\n\n(Alloy / Agent)\nSpecifies the receiver components where collected telemetry should be sent (e.g. to a remote_write block).',
  'positions': '**`positions`**\n\n(Promtail)\nSaves the last read offsets of log files so Promtail doesn\'t re-read logs if restarted.',
  'memory_limiter': '**`memory_limiter`**\n\n(OTel)\nPrevents out of memory situations on the collector by checking memory usage and dropping/rejecting data when thresholds are exceeded. Must be the first processor.',
  'batch': '**`batch`**\n\n(OTel)\nBatches telemetry data to compress and reduce the number of outgoing network requests. Highly recommended in production.',
};

export default function LgtmConfigs() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const initialToolId = (toolId && toolsData.some(t => t.id === toolId)) ? toolId : toolsData[0].id;
  
  const [activeToolId, setActiveToolId] = useState(initialToolId);
  const [activeEnv, setActiveEnv] = useState<Environment>('local');
  const [copied, setCopied] = useState(false);
  const providerRegistered = useRef(false);

  useEffect(() => {
    if (toolId && toolsData.some(t => t.id === toolId) && toolId !== activeToolId) {
      setActiveToolId(toolId);
    }
  }, [toolId]);

  const handleToolClick = (id: string) => {
    setActiveToolId(id);
    navigate(`/lgtm-configs/${id}`);
  };

  const activeTool = toolsData.find(t => t.id === activeToolId) || toolsData[0];
  const activeConfig = activeTool.envs[activeEnv];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeConfig.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeConfig.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeConfig.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditorDidMount = (_editor: any, monaco: typeof Monaco) => {
    if (providerRegistered.current) return;
    providerRegistered.current = true;

    monaco.languages.registerHoverProvider(['yaml', 'hcl'], {
      provideHover: function (model, position) {
        const word = model.getWordAtPosition(position);
        if (word && hoverExplanations[word.word]) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: hoverExplanations[word.word] }
            ]
          };
        }
        return null;
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#0f172a] text-slate-200">
      <Helmet>
        <title>Basic LGTM Configs | Observability Helpers</title>
        <meta name="description" content="Download and copy basic configuration files for the Grafana LGTM stack. Includes Docker, Kubernetes, and Bare Metal templates with explanations." />
      </Helmet>

      <header className="h-auto md:h-16 flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 md:py-0 bg-slate-900 border-b border-slate-800 shrink-0 gap-4 md:gap-0">
        <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-pink-500">
          LGTM Configs & Deployment
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-700 cursor-pointer"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-1.5 bg-sky-900/50 hover:bg-sky-800/50 text-sky-300 text-sm font-medium rounded-lg transition-colors border border-sky-800/50 cursor-pointer"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 overflow-y-auto shrink-0 hidden md:block">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Tools</div>
          <div className="space-y-1">
            {toolsData.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeToolId === tool.id 
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Settings size={16} />
                <span className={tool.id === 'promtail' ? 'line-through opacity-70' : ''}>{tool.name}</span>
              </button>
            ))}
          </div>
          
          <div className="mt-8 text-xs text-slate-500 p-3 bg-sky-900/10 rounded-lg border border-sky-500/10">
            <strong>Tip:</strong> Hover over keywords in the code editor (like <code>scrape_configs</code> or <code>remote_write</code>) for explanations.
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 relative flex flex-col min-w-0">
          
          {/* Top Env Toggle */}
          <div className="flex items-center bg-slate-900 border-b border-slate-800 shrink-0 px-4 py-2 gap-2 overflow-x-auto">
            <button 
              onClick={() => setActiveEnv('local')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeEnv === 'local' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <FileText size={16}/> Local (Basic)
            </button>
            <button 
              onClick={() => setActiveEnv('docker')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeEnv === 'docker' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Box size={16}/> Docker Compose
            </button>
            <button 
              onClick={() => setActiveEnv('kubernetes')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeEnv === 'kubernetes' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Container size={16}/> Kubernetes
            </button>
            <div className="w-px h-6 bg-slate-800 mx-2"></div>
            <button 
              onClick={() => setActiveEnv('production')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeEnv === 'production' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
            >
              <ShieldAlert size={16}/> Production (HA)
            </button>
          </div>

          <div className="flex-1 relative">
            <Editor
              height="100%"
              language={activeConfig.language}
              theme="vs-dark"
              value={activeConfig.content}
              onMount={handleEditorDidMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                padding: { top: 16, bottom: 16 },
                wordWrap: 'on'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}