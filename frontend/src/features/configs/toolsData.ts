export type Environment = 'local' | 'docker' | 'kubernetes' | 'production';

export interface ConfigEnv {
  filename: string;
  language: string;
  content: string;
}

export interface ToolData {
  id: string;
  name: string;
  envs: Record<Environment, ConfigEnv>;
}

export const toolsData: ToolData[] = [
  {
    id: 'alloy',
    name: 'Grafana Alloy',
    envs: {
      local: { 
        filename: 'config.alloy', 
        language: 'hcl', 
        content: `logging { level = "info" }\n\nprometheus.exporter.unix "default" { }\n\nprometheus.scrape "default" {\n  targets = prometheus.exporter.unix.default.targets\n  forward_to = [prometheus.remote_write.mimir.receiver]\n}\n\nprometheus.remote_write "mimir" {\n  endpoint { url = "http://mimir:9009/api/v1/push" }\n}` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  alloy:\n    image: grafana/alloy:v1.0.0\n    command:\n      - run\n      - --server.http.listen-addr=0.0.0.0:12345\n      - /etc/alloy/config.alloy\n    volumes:\n      - ./config.alloy:/etc/alloy/config.alloy:ro\n    ports:\n      - "12345:12345"` 
      },
      kubernetes: { 
        filename: 'alloy-values.yaml', 
        language: 'yaml', 
        content: `# helm install alloy grafana/alloy -f values.yaml\nalloy:\n  configMap:\n    create: true\n    content: |-\n      logging { level = "info" }\n      prometheus.exporter.unix "default" { }\n      prometheus.scrape "default" {\n        targets = prometheus.exporter.unix.default.targets\n        forward_to = [prometheus.remote_write.mimir.receiver]\n      }\n      prometheus.remote_write "mimir" {\n        endpoint { url = "http://mimir:9009/api/v1/push" }\n      }` 
      },
      production: {
        filename: 'config-production.alloy',
        language: 'hcl',
        content: `logging {\n  level = "info"\n  format = "logfmt"\n}\n\nprometheus.exporter.unix "node" {}\n\nprometheus.scrape "node" {\n  targets = prometheus.exporter.unix.node.targets\n  forward_to = [prometheus.remote_write.mimir.receiver]\n}\n\nprometheus.remote_write "mimir" {\n  endpoint {\n    url = "https://mimir.example.com/api/v1/push"\n    basic_auth {\n      username = "metrics"\n      password_file = "/etc/alloy/secrets/password"\n    }\n    tls_config {\n      ca_file = "/etc/alloy/tls/ca.crt"\n    }\n    queue_config {\n      capacity = 10000\n      max_shards = 20\n      max_samples_per_send = 2000\n      batch_send_deadline = "5s"\n    }\n  }\n}`
      }
    }
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    envs: {
      local: { 
        filename: 'prometheus.yml', 
        language: 'yaml', 
        content: `global:\n  scrape_interval: 15s\n\nscrape_configs:\n  - job_name: "prometheus"\n    static_configs:\n      - targets: ["localhost:9090"]\n\nremote_write:\n  - url: http://mimir:9009/api/v1/push` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  prometheus:\n    image: prom/prometheus:v3.0.0\n    volumes:\n      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro\n      - prometheus-data:/prometheus\n    command:\n      - '--config.file=/etc/prometheus/prometheus.yml'\n      - '--storage.tsdb.path=/prometheus'\n    ports:\n      - "9090:9090"\n\nvolumes:\n  prometheus-data:` 
      },
      kubernetes: { 
        filename: 'prometheus-deploy.yaml', 
        language: 'yaml', 
        content: `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: prometheus\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: prometheus\n  template:\n    metadata:\n      labels:\n        app: prometheus\n    spec:\n      containers:\n      - name: prometheus\n        image: prom/prometheus:v3.0.0\n        args:\n        - --config.file=/etc/prometheus/prometheus.yml\n        - --storage.tsdb.path=/prometheus\n        ports:\n        - containerPort: 9090\n        volumeMounts:\n        - name: config\n          mountPath: /etc/prometheus\n          readOnly: true\n        - name: data\n          mountPath: /prometheus\n      volumes:\n      - name: config\n        configMap:\n          name: prometheus-config\n      - name: data\n        persistentVolumeClaim:\n          claimName: prometheus-data` 
      },
      production: {
        filename: 'prometheus-prod.yml',
        language: 'yaml',
        content: `global:\n  scrape_interval: 15s\n  evaluation_interval: 15s\n\nstorage:\n  tsdb:\n    retention:\n      time: 15d\n      size: 50GB\n\nscrape_configs:\n  - job_name: "kubernetes-pods"\n    kubernetes_sd_configs:\n      - role: pod\n\nremote_write:\n  - url: https://mimir.example.com/api/v1/push\n    tls_config:\n      ca_file: /etc/prometheus/secrets/ca.crt\n    basic_auth:\n      username: metrics\n      password_file: /etc/prometheus/secrets/password\n    queue_config:\n      capacity: 10000\n      max_shards: 50`
      }
    }
  },
  {
    id: 'loki',
    name: 'Loki',
    envs: {
      local: { 
        filename: 'loki.yaml', 
        language: 'yaml', 
        content: `auth_enabled: false\nserver:\n  http_listen_port: 3100\ncommon:\n  path_prefix: /loki\n  storage:\n    filesystem:\n      chunks_directory: /loki/chunks\n      rules_directory: /loki/rules\n  replication_factor: 1\n  ring:\n    kvstore:\n      store: inmemory\nschema_config:\n  configs:\n    - from: 2024-04-01\n      store: tsdb\n      object_store: filesystem\n      schema: v13\n      index:\n        prefix: index_\n        period: 24h` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  loki:\n    image: grafana/loki:3.0.0\n    ports:\n      - "3100:3100"\n    volumes:\n      - ./loki.yaml:/etc/loki/local-config.yaml:ro\n      - loki-data:/loki\n    command: -config.file=/etc/loki/local-config.yaml\n\nvolumes:\n  loki-data:` 
      },
      kubernetes: { 
        filename: 'loki-values.yaml', 
        language: 'yaml', 
        content: `# helm install loki grafana/loki --values loki-values.yaml\nloki:\n  auth_enabled: false\n  commonConfig:\n    replication_factor: 1\n  storage:\n    type: filesystem` 
      },
      production: {
        filename: 'loki-prod-values.yaml',
        language: 'yaml',
        content: `# Highly Available Production Configuration\nloki:\n  auth_enabled: true\n  commonConfig:\n    replication_factor: 3\n  schemaConfig:\n    configs:\n      - from: "2024-04-01"\n        store: tsdb\n        object_store: s3\n        schema: v13\n        index:\n          prefix: loki_index_\n          period: 24h\n  storage:\n    bucketNames:\n      chunks: loki-data\n      ruler: loki-ruler\n      admin: loki-admin\n    type: s3\n    s3:\n      s3: s3://eu-west-1\n      endpoint: s3.eu-west-1.amazonaws.com\n      region: eu-west-1\n# Requires authentication proxy (e.g. Nginx/Envoy) for multi-tenancy`
      }
    }
  },
  {
    id: 'promtail',
    name: 'Promtail (Legacy/EOL)',
    envs: {
      local: { 
        filename: 'promtail.yaml', 
        language: 'yaml', 
        content: `server:\n  http_listen_port: 9080\npositions:\n  filename: /tmp/positions.yaml\nclients:\n  - url: http://loki:3100/loki/api/v1/push\nscrape_configs:\n  - job_name: system\n    static_configs:\n    - targets:\n        - localhost\n      labels:\n        job: varlogs\n        __path__: /var/log/*log` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  promtail:\n    image: grafana/promtail:3.0.0\n    volumes:\n      - /var/log:/var/log:ro\n      - ./promtail.yaml:/etc/promtail/config.yml:ro\n    command: -config.file=/etc/promtail/config.yml` 
      },
      kubernetes: { 
        filename: 'promtail-values.yaml', 
        language: 'yaml', 
        content: `promtail:\n  config:\n    clients:\n      - url: http://loki:3100/loki/api/v1/push` 
      },
      production: {
        filename: 'MIGRATION_NOTICE.md',
        language: 'markdown',
        content: `# 🚨 Promtail is EOL\n\nPromtail reached End of Life (EOL) on March 2, 2026.\n\nGrafana recommends migrating to **Grafana Alloy** for log collection in production.\nAlloy includes all Promtail components natively via \`loki.source.file\` and \`loki.write\`.\n\nDo not deploy new Promtail instances in production.`
      }
    }
  },
  {
    id: 'tempo',
    name: 'Tempo',
    envs: {
      local: { 
        filename: 'tempo.yaml', 
        language: 'yaml', 
        content: `server:\n  http_listen_port: 3200\ndistributor:\n  receivers:\n    otlp:\n      protocols:\n        http:\n        grpc:\nstorage:\n  trace:\n    backend: local\n    local:\n      path: /tmp/tempo/blocks` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  tempo:\n    image: grafana/tempo:2.4.0\n    volumes:\n      - ./tempo.yaml:/etc/tempo.yaml:ro\n      - tempo-data:/tmp/tempo/blocks\n    command: -config.file=/etc/tempo.yaml\n    ports:\n      - "3200:3200"\n\nvolumes:\n  tempo-data:` 
      },
      kubernetes: { 
        filename: 'tempo-values.yaml', 
        language: 'yaml', 
        content: `tempo:\n  storage:\n    trace:\n      backend: local` 
      },
      production: {
        filename: 'tempo-prod-values.yaml',
        language: 'yaml',
        content: `# Production Tempo Architecture (Microservices)\ntempo:\n  storage:\n    trace:\n      backend: s3\n      s3:\n        bucket: tempo-traces\n        endpoint: s3.eu-west-1.amazonaws.com\n        region: eu-west-1\n  # In production, use workload identity or mounted secrets instead of static keys\n\n# Configure durable queues (Kafka) if ingest rate is very high\nmetricsGenerator:\n  enabled: true`
      }
    }
  },
  {
    id: 'mimir',
    name: 'Mimir',
    envs: {
      local: { 
        filename: 'mimir.yaml', 
        language: 'yaml', 
        content: `multitenancy_enabled: false\nblocks_storage:\n  backend: filesystem\n  bucket_store:\n    sync_dir: /tmp/mimir/tsdb-sync\n  filesystem:\n    dir: /tmp/mimir/data\n  tsdb:\n    dir: /tmp/mimir/tsdb` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  mimir:\n    image: grafana/mimir:2.12.0\n    volumes:\n      - ./mimir.yaml:/etc/mimir.yaml:ro\n      - mimir-data:/tmp/mimir\n    command: -config.file=/etc/mimir.yaml\n    ports:\n      - "9009:9009"\n\nvolumes:\n  mimir-data:` 
      },
      kubernetes: { 
        filename: 'mimir-values.yaml', 
        language: 'yaml', 
        content: `mimir:\n  structuredConfig:\n    multitenancy_enabled: false` 
      },
      production: {
        filename: 'mimir-prod-values.yaml',
        language: 'yaml',
        content: `# Distributed Mimir Production Architecture\nmimir:\n  structuredConfig:\n    multitenancy_enabled: true  # Multi-tenant by default in prod\n    blocks_storage:\n      backend: s3\n      s3:\n        bucket_name: mimir-metrics\n        endpoint: s3.eu-west-1.amazonaws.com\n        region: eu-west-1\n    alertmanager_storage:\n      backend: s3\n      s3:\n        bucket_name: mimir-alerts\n    ruler_storage:\n      backend: s3\n      s3:\n        bucket_name: mimir-rules\n\n# Proxy/Auth layer is strictly required to inject X-Scope-OrgID headers`
      }
    }
  },
  {
    id: 'otel',
    name: 'OpenTelemetry',
    envs: {
      local: { 
        filename: 'otel-config.yaml', 
        language: 'yaml', 
        content: `receivers:\n  otlp:\n    protocols:\n      grpc:\n      http:\nexporters:\n  prometheusremotewrite:\n    endpoint: "http://mimir:9009/api/v1/push"\nservice:\n  pipelines:\n    metrics:\n      receivers: [otlp]\n      exporters: [prometheusremotewrite]` 
      },
      docker: { 
        filename: 'docker-compose.yaml', 
        language: 'yaml', 
        content: `version: "3.8"\nservices:\n  otel-collector:\n    image: otel/opentelemetry-collector:0.100.0\n    command: ["--config=/etc/otel-config.yaml"]\n    volumes:\n      - ./otel-config.yaml:/etc/otel-config.yaml:ro` 
      },
      kubernetes: { 
        filename: 'otel-values.yaml', 
        language: 'yaml', 
        content: `mode: deployment\nconfig:\n  receivers:\n    otlp:\n      protocols:\n        grpc:\n        http:` 
      },
      production: {
        filename: 'otel-prod.yaml',
        language: 'yaml',
        content: `receivers:\n  otlp:\n    protocols:\n      grpc:\n      http:\n\nprocessors:\n  memory_limiter:\n    limit_mib: 1024\n    spike_limit_mib: 256\n    check_interval: 5s\n  batch:\n    send_batch_size: 8192\n    timeout: 5s\n\nexporters:\n  prometheusremotewrite:\n    endpoint: "https://mimir.example.com/api/v1/push"\n    tls:\n      ca_file: /etc/otel/certs/ca.crt\n    auth:\n      authenticator: basicauth\n    retry_on_failure:\n      enabled: true\n\nextensions:\n  basicauth:\n    client_auth:\n      username: "\${env:MIMIR_USERNAME}"\n      password: "\${env:MIMIR_PASSWORD}"\n\nservice:\n  extensions: [basicauth]\n  pipelines:\n    metrics:\n      receivers: [otlp]\n      processors: [memory_limiter, batch]\n      exporters: [prometheusremotewrite]`
      }
    }
  }
];