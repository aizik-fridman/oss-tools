import { useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import Editor from '@monaco-editor/react';
import { Download, Copy, Check, FileText, Settings, Container, Box } from 'lucide-react';
import type * as Monaco from 'monaco-editor';

// Hover descriptions dictionary
const hoverExplanations: Record<string, string> = {
  'scrape_configs': '**`scrape_configs`**\n\nDefines the targets Prometheus/Alloy will scrape metrics or logs from. Recommended to use service discovery (e.g. `kubernetes_sd_configs`) in production rather than `static_configs`.',
  'remote_write': '**`remote_write`**\n\nSends scraped metrics to a remote storage endpoint (like Mimir or Thanos). Recommended when running Prometheus as a stateless agent.',
  'storage': '**`storage`**\n\nConfigures where data is stored. For local testing, `filesystem` or `local` is fine. For production, always use an object store like S3/GCS.',
  'schema_config': '**`schema_config`**\n\nDefines the index schema and chunk storage periods for Loki. TSDB is the recommended modern schema.',
  'compactor': '**`compactor`**\n\nReduces long-term storage size by deduplicating and merging blocks. Crucial for Mimir/Tempo/Loki in production to keep storage costs low.',
  'ring': '**`ring`**\n\nManages the hash ring for distributed components. `inmemory` is only for single-node testing. In production, use `memberlist` or `etcd` / `consul`.',
  'forward_to': '**`forward_to`**\n\n(Alloy / Agent)\nSpecifies the receiver components where collected telemetry should be sent (e.g. to a remote_write block).',
  'positions': '**`positions`**\n\n(Promtail)\nSaves the last read offsets of log files so Promtail doesn\'t re-read logs if restarted.',
};

// Definitions for configs
const toolsData = [
  {
    id: 'alloy',
    name: 'Grafana Alloy',
    envs: {
      standalone: {
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
      docker: {
        filename: 'docker-compose.yaml',
        language: 'yaml',
        content: `version: '3.8'
services:
  alloy:
    image: grafana/alloy:latest
    command:
      - run
      - --server.http.listen-addr=0.0.0.0:12345
      - /etc/alloy/config.alloy
    volumes:
      - ./config.alloy:/etc/alloy/config.alloy
    ports:
      - "12345:12345"`
      },
      kubernetes: {
        filename: 'alloy-helm-values.yaml',
        language: 'yaml',
        content: `# Recommended: Install via Helm
# helm repo add grafana https://grafana.github.io/helm-charts
# helm install alloy grafana/alloy -f values.yaml

alloy:
  configMap:
    create: true
    content: |-
      logging { level = "info" }
      prometheus.exporter.unix "default" { }
      prometheus.scrape "default" {
        targets = prometheus.exporter.unix.default.targets
        forward_to = [prometheus.remote_write.mimir.receiver]
      }
      prometheus.remote_write "mimir" {
        endpoint { url = "http://mimir:9009/api/v1/push" }
      }`
      }
    }
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    envs: {
      standalone: {
        filename: 'prometheus.yml',
        language: 'yaml',
        content: `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

remote_write:
  - url: http://mimir:9009/api/v1/push`
      },
      docker: {
        filename: 'docker-compose.yaml',
        language: 'yaml',
        content: `version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"`
      },
      kubernetes: {
        filename: 'prometheus-deployment.yaml',
        language: 'yaml',
        content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config-volume
          mountPath: /etc/prometheus
      volumes:
      - name: config-volume
        configMap:
          name: prometheus-config`
      }
    }
  },
  {
    id: 'loki',
    name: 'Loki',
    envs: {
      standalone: {
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
      docker: {
        filename: 'docker-compose.yaml',
        language: 'yaml',
        content: `version: '3.8'
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml`
      },
      kubernetes: {
        filename: 'loki-helm-values.yaml',
        language: 'yaml',
        content: `# Recommended: Install via Helm
# helm install loki grafana/loki --values loki-values.yaml
loki:
  auth_enabled: false
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem`
      }
    }
  }
];

export default function LgtmConfigs() {
  const [activeToolId, setActiveToolId] = useState(toolsData[0].id);
  const [activeEnv, setActiveEnv] = useState<'standalone' | 'docker' | 'kubernetes'>('standalone');
  const [copied, setCopied] = useState(false);
  
  const providerRegistered = useRef(false);

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

  // Register Hover Provider in Monaco
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
        <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
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
                onClick={() => setActiveToolId(tool.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeToolId === tool.id 
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Settings size={16} />
                {tool.name}
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
              onClick={() => setActiveEnv('standalone')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeEnv === 'standalone' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <FileText size={16}/> Config File
            </button>
            <button 
              onClick={() => setActiveEnv('docker')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeEnv === 'docker' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Box size={16}/> Docker Compose
            </button>
            <button 
              onClick={() => setActiveEnv('kubernetes')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeEnv === 'kubernetes' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Container size={16}/> Kubernetes
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
                wordWrap: 'on',
                
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}