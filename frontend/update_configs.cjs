const fs = require('fs');

let text = fs.readFileSync('src/features/configs/LgtmConfigs.tsx', 'utf8');

// Replace imports to add react-router-dom
text = text.replace(
  "import { useState, useRef } from 'react';",
  "import { useState, useRef, useEffect } from 'react';\nimport { useParams, useNavigate } from 'react-router-dom';"
);

// Replace toolsData
const newToolsData = `const toolsData = [
  {
    id: 'alloy',
    name: 'Grafana Alloy',
    envs: {
      standalone: { filename: 'config.alloy', language: 'hcl', content: 'logging { level = "info" }\nprometheus.exporter.unix "default" { }\nprometheus.scrape "default" {\n  targets = prometheus.exporter.unix.default.targets\n  forward_to = [prometheus.remote_write.mimir.receiver]\n}\nprometheus.remote_write "mimir" {\n  endpoint { url = "http://mimir:9009/api/v1/push" }\n}' },
      docker: { filename: 'docker-compose.yaml', language: 'yaml', content: 'version: "3.8"\nservices:\n  alloy:\n    image: grafana/alloy:latest\n    command:\n      - run\n      - --server.http.listen-addr=0.0.0.0:12345\n      - /etc/alloy/config.alloy\n    volumes:\n      - ./config.alloy:/etc/alloy/config.alloy\n    ports:\n      - "12345:12345"' },
      kubernetes: { filename: 'alloy-values.yaml', language: 'yaml', content: '# helm install alloy grafana/alloy -f values.yaml\nalloy:\n  configMap:\n    create: true\n    content: |-\n      logging { level = "info" }' }
    }
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    envs: {
      standalone: { filename: 'prometheus.yml', language: 'yaml', content: 'global:\n  scrape_interval: 15s\nscrape_configs:\n  - job_name: "prometheus"\n    static_configs:\n      - targets: ["localhost:9090"]\nremote_write:\n  - url: http://mimir:9009/api/v1/push' },
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
];`;

text = text.replace(/const toolsData = \[[\s\S]*?\];\n\nexport default function/, newToolsData + '\n\nexport default function');

// Add routing logic
const stateLogic = `
  const { toolId } = useParams();
  const navigate = useNavigate();
  const initialToolId = toolId && toolsData.some(t => t.id === toolId) ? toolId : toolsData[0].id;
  const [activeToolId, setActiveToolId] = useState(initialToolId);
  const [activeEnv, setActiveEnv] = useState<'standalone' | 'docker' | 'kubernetes'>('standalone');
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    if (toolId && toolsData.some(t => t.id === toolId) && toolId !== activeToolId) {
      setActiveToolId(toolId);
    }
  }, [toolId]);

  const handleToolClick = (id: string) => {
    setActiveToolId(id);
    navigate(\`/lgtm-configs/\${id}\`);
  };
`;

text = text.replace(/const \[activeToolId, setActiveToolId\] = useState\(toolsData\[0\]\.id\);[\s\S]*?const \[copied, setCopied\] = useState\(false\);/, stateLogic);
text = text.replace(/onClick=\{\(\) => setActiveToolId\(tool\.id\)\}/g, "onClick={() => handleToolClick(tool.id)}");

// Change the title color
text = text.replace(/text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400(.*Basic LGTM Configs)/, "text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-pink-500$1");

fs.writeFileSync('src/features/configs/LgtmConfigs.tsx', text);