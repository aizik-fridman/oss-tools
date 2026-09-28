import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Editor from '@monaco-editor/react';
import { Download, Copy, Check, FileText, Settings } from 'lucide-react';

// Definitions for configs
const configs = [
  {
    id: 'alloy',
    name: 'Grafana Alloy',
    filename: 'config.alloy',
    language: 'hcl',
    content: `logging {
  level = "info"
}

prometheus.exporter.unix "default" { }

prometheus.scrape "default" {
  targets = prometheus.exporter.unix.default.targets
  forward_to = [prometheus.remote_write.mimir.receiver]
}

prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir:9009/api/v1/push"
  }
}`
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    filename: 'prometheus.yml',
    language: 'yaml',
    content: `global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

remote_write:
  - url: http://mimir:9009/api/v1/push`
  },
  {
    id: 'promtail',
    name: 'Promtail',
    filename: 'promtail.yaml',
    language: 'yaml',
    content: `server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
    - targets:
        - localhost
      labels:
        job: varlogs
        __path__: /var/log/*log`
  },
  {
    id: 'loki',
    name: 'Loki',
    filename: 'loki.yaml',
    language: 'yaml',
    content: `auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h`
  },
  {
    id: 'tempo',
    name: 'Tempo',
    filename: 'tempo.yaml',
    language: 'yaml',
    content: `server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
        grpc:

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks`
  },
  {
    id: 'mimir',
    name: 'Mimir',
    filename: 'mimir.yaml',
    language: 'yaml',
    content: `multitenancy_enabled: false

blocks_storage:
  backend: filesystem
  bucket_store:
    sync_dir: /tmp/mimir/tsdb-sync
  filesystem:
    dir: /tmp/mimir/data
  tsdb:
    dir: /tmp/mimir/tsdb

compactor:
  data_dir: /tmp/mimir/compactor
  sharding_ring:
    kvstore:
      store: inmemory

distributor:
  ring:
    kvstore:
      store: inmemory

ingester:
  ring:
    kvstore:
      store: inmemory

store_gateway:
  sharding_ring:
    kvstore:
      store: inmemory`
  }
];

export default function LgtmConfigs() {
  const [activeConfigId, setActiveConfigId] = useState(configs[0].id);
  const [copied, setCopied] = useState(false);

  const activeConfig = configs.find(c => c.id === activeConfigId) || configs[0];

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

  return (
    <div className="h-full flex flex-col bg-[#0f172a] text-slate-200">
      <Helmet>
        <title>Basic LGTM Configs | Observability Helpers</title>
        <meta name="description" content="Download and copy basic configuration files for the Grafana LGTM stack, including Alloy, Prometheus, Loki, Tempo, and Mimir." />
      </Helmet>

      <header className="h-auto md:h-16 flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 md:py-0 bg-slate-900 border-b border-slate-800 shrink-0 gap-4 md:gap-0">
        <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
          Basic LGTM Configs
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
        {/* Sidebar for config selection */}
        <div className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 overflow-y-auto shrink-0 hidden md:block">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Configurations</div>
          <div className="space-y-1">
            {configs.map(conf => (
              <button
                key={conf.id}
                onClick={() => setActiveConfigId(conf.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeConfigId === conf.id 
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
              >
                {conf.language === 'yaml' ? <Settings size={16} /> : <FileText size={16} />}
                {conf.name}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 relative flex flex-col min-w-0">
          {/* Mobile Selector */}
          <div className="md:hidden p-4 border-b border-slate-800 bg-slate-900 shrink-0">
            <select 
              value={activeConfigId}
              onChange={(e) => setActiveConfigId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
            >
              {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          <div className="flex-1 relative">
            <Editor
              height="100%"
              language={activeConfig.language}
              theme="vs-dark"
              value={activeConfig.content}
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