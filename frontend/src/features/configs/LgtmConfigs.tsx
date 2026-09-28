import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Editor from '@monaco-editor/react';
import { Download, Copy, Check, FileText, Settings, Container, Box } from 'lucide-react';
import type * as Monaco from 'monaco-editor';

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

const toolsData = [
  {
    id: 'alloy',
    name: 'Grafana Alloy',
    envs: {
      standalone: { filename: 'config.alloy', language: 'hcl', content: 'logging { level = "info" }\n\nprometheus.exporter.unix "default" { }\n\nprometheus.scrape "default" {\n  targets = prometheus.exporter.unix.default.targets\n  forward_to = [prometheus.remote_write.mimir.receiver]\n}\n\nprometheus.remote_write "mimir" {\n  endpoint { url = "http://mimir:9009/api/v1/push" }\n}' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  alloy:\n    image: grafana/alloy:latest\n    command:\n      - run\n      - --server.http.listen-addr=0.0.0.0:12345\n      - /etc/alloy/config.alloy\n    volumes:\n      - ./config.alloy:/etc/alloy/config.alloy\n    ports:\n      - "12345:12345"' },
      kubernetes: { filename: 'alloy-values.yaml', language: 'yaml', content: '# helm install alloy grafana/alloy -f values.yaml\nalloy:\n  configMap:\n    create: true\n    content: |-\n      logging { level = "info" }\n      prometheus.exporter.unix "default" { }\n      prometheus.scrape "default" {\n        targets = prometheus.exporter.unix.default.targets\n        forward_to = [prometheus.remote_write.mimir.receiver]\n      }\n      prometheus.remote_write "mimir" {\n        endpoint { url = "http://mimir:9009/api/v1/push" }\n      }' }
    }
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    envs: {
      standalone: { filename: 'prometheus.yml', language: 'yaml', content: 'global:\n  scrape_interval: 15s\n\nscrape_configs:\n  - job_name: "prometheus"\n    static_configs:\n      - targets: ["localhost:9090"]\n\nremote_write:\n  - url: http://mimir:9009/api/v1/push' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  prometheus:\n    image: prom/prometheus:latest\n    volumes:\n      - ./prometheus.yml:/etc/prometheus/prometheus.yml\n    ports:\n      - "9090:9090"' },
      kubernetes: { filename: 'prometheus-deploy.yaml', language: 'yaml', content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: prometheus\nspec:\n  replicas: 1\n  template:\n    spec:\n      containers:\n      - name: prometheus\n        image: prom/prometheus:latest' }
    }
  },
  {
    id: 'loki',
    name: 'Loki',
    envs: {
      standalone: { filename: 'loki.yaml', language: 'yaml', content: 'auth_enabled: false\nserver:\n  http_listen_port: 3100\ncommon:\n  path_prefix: /loki\n  storage:\n    filesystem:\n      chunks_directory: /loki/chunks\n      rules_directory: /loki/rules\n  replication_factor: 1\n  ring:\n    kvstore:\n      store: inmemory\nschema_config:\n  configs:\n    - from: 2020-10-24\n      store: tsdb\n      object_store: filesystem\n      schema: v13\n      index:\n        prefix: index_\n        period: 24h' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  loki:\n    image: grafana/loki:latest\n    ports:\n      - "3100:3100"\n    command: -config.file=/etc/loki/local-config.yaml' },
      kubernetes: { filename: 'loki-values.yaml', language: 'yaml', content: 'loki:\n  auth_enabled: false\n  commonConfig:\n    replication_factor: 1\n  storage:\n    type: filesystem' }
    }
  },
  {
    id: 'promtail',
    name: 'Promtail',
    envs: {
      standalone: { filename: 'promtail.yaml', language: 'yaml', content: 'server:\n  http_listen_port: 9080\npositions:\n  filename: /tmp/positions.yaml\nclients:\n  - url: http://loki:3100/loki/api/v1/push\nscrape_configs:\n  - job_name: system\n    static_configs:\n    - targets:\n        - localhost\n      labels:\n        job: varlogs\n        __path__: /var/log/*log' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  promtail:\n    image: grafana/promtail:latest\n    volumes:\n      - /var/log:/var/log\n    command: -config.file=/etc/promtail/config.yml' },
      kubernetes: { filename: 'promtail-values.yaml', language: 'yaml', content: 'promtail:\n  config:\n    clients:\n      - url: http://loki:3100/loki/api/v1/push' }
    }
  },
  {
    id: 'tempo',
    name: 'Tempo',
    envs: {
      standalone: { filename: 'tempo.yaml', language: 'yaml', content: 'server:\n  http_listen_port: 3200\ndistributor:\n  receivers:\n    otlp:\n      protocols:\n        http:\n        grpc:\nstorage:\n  trace:\n    backend: local\n    local:\n      path: /tmp/tempo/blocks' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  tempo:\n    image: grafana/tempo:latest\n    command: -config.file=/etc/tempo.yaml\n    ports:\n      - "3200:3200"' },
      kubernetes: { filename: 'tempo-values.yaml', language: 'yaml', content: 'tempo:\n  storage:\n    trace:\n      backend: local' }
    }
  },
  {
    id: 'mimir',
    name: 'Mimir',
    envs: {
      standalone: { filename: 'mimir.yaml', language: 'yaml', content: 'multitenancy_enabled: false\nblocks_storage:\n  backend: filesystem\n  bucket_store:\n    sync_dir: /tmp/mimir/tsdb-sync\n  filesystem:\n    dir: /tmp/mimir/data\n  tsdb:\n    dir: /tmp/mimir/tsdb' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  mimir:\n    image: grafana/mimir:latest\n    command: -config.file=/etc/mimir.yaml\n    ports:\n      - "9009:9009"' },
      kubernetes: { filename: 'mimir-values.yaml', language: 'yaml', content: 'mimir:\n  structuredConfig:\n    multitenancy_enabled: false' }
    }
  },
  {
    id: 'otel',
    name: 'OpenTelemetry',
    envs: {
      standalone: { filename: 'otel-config.yaml', language: 'yaml', content: 'receivers:\n  otlp:\n    protocols:\n      grpc:\n      http:\nexporters:\n  prometheusremotewrite:\n    endpoint: "http://mimir:9009/api/v1/push"\nservice:\n  pipelines:\n    metrics:\n      receivers: [otlp]\n      exporters: [prometheusremotewrite]' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  otel-collector:\n    image: otel/opentelemetry-collector:latest\n    command: ["--config=/etc/otel-config.yaml"]\n    volumes:\n      - ./otel-config.yaml:/etc/otel-config.yaml' },
      kubernetes: { filename: 'otel-values.yaml', language: 'yaml', content: 'mode: deployment\nconfig:\n  receivers:\n    otlp:\n      protocols:\n        grpc:\n        http:' }
    }
  }
];

export default function LgtmConfigs() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const initialToolId = (toolId && toolsData.some(t => t.id === toolId)) ? toolId : toolsData[0].id;
  const [activeToolId, setActiveToolId] = useState(initialToolId);
  const [activeEnv, setActiveEnv] = useState<'standalone' | 'docker' | 'kubernetes'>('standalone');
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
                wordWrap: 'on'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}