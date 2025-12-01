# Building a realistic Datadog test environment for AI SRE agents

**For developing an AI-powered SRE agent, the optimal test environment combines minikube or kind for local Kubernetes, Datadog's Storedog demo application for realistic telemetry, Chaos Mesh for incident simulation, and VCRpy for offline API testing.** This setup enables full observability testing with metrics, logs, APM traces, and realistic alert scenarios—all runnable on a developer laptop with a free Datadog trial.

The key to effective SRE agent development is generating diverse, realistic incidents that trigger Datadog monitors and webhooks, then capturing those API interactions for reproducible testing. This guide provides the complete configuration files, commands, and code examples to build this environment in under an hour.

---

## Local Kubernetes setup optimized for Datadog

For Datadog testing, **minikube** provides the best balance of compatibility and production-like behavior, while **kind** excels for faster iteration and CI/CD pipelines. Both support the full Datadog agent feature set including logs, APM, and process monitoring.

| Feature               | minikube            | kind           | k3d                  | Docker Desktop  |
| --------------------- | ------------------- | -------------- | -------------------- | --------------- |
| Startup time          | 60-90s              | 30-40s         | 15-20s               | 30-60s          |
| Memory usage          | ~2GB (VM)           | ~500MB         | ~400MB               | ~2GB            |
| Multi-node support    | Yes                 | Native         | Native               | No              |
| Datadog compatibility | Excellent           | Excellent      | Excellent            | Good            |
| Best for              | Full K8s experience | CI/CD, testing | Resource-constrained | macOS beginners |

 **Resource requirements** : Allocate at least **4 CPU cores and 8GB RAM** to run the Datadog agent alongside demo applications comfortably.

### Quick start with minikube

```bash
# Start cluster with adequate resources
minikube start --cpus=4 --memory=8192 --driver=docker --kubernetes-version=v1.28.0

# Add Datadog Helm repository
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Create namespace and secrets
kubectl create namespace datadog
kubectl create secret generic datadog-secret \
  --namespace datadog \
  --from-literal api-key=<YOUR_DD_API_KEY> \
  --from-literal app-key=<YOUR_DD_APP_KEY>
```

### Complete Helm values for full observability

This configuration enables metrics, logs, APM, process monitoring, and the cluster agent with admission controller for auto-instrumentation:

```yaml
# datadog-values.yaml
targetSystem: "linux"

datadog:
  apiKeyExistingSecret: datadog-secret
  appKeyExistingSecret: datadog-secret
  site: datadoghq.com  # Use datadoghq.eu for EU, us3.datadoghq.com for US3
  clusterName: local-dev-cluster

  # Critical for minikube - disable TLS verification
  kubelet:
    tlsVerify: false

  # Log collection
  logs:
    enabled: true
    containerCollectAll: true
    autoMultiLineDetection: true

  # APM tracing
  apm:
    socketEnabled: true
    portEnabled: true
    port: 8126

  # Process monitoring
  processAgent:
    enabled: true
    processCollection: true
    processDiscovery: true
    containerCollection: true

  # Kubernetes events
  collectEvents: true
  leaderElection: true

  # DogStatsD for custom metrics
  dogstatsd:
    port: 8125
    useSocketVolume: true
    nonLocalTraffic: true
    originDetection: true

clusterAgent:
  enabled: true
  replicas: 1
  admissionController:
    enabled: true
    mutateUnlabelled: true  # Auto-instrument all pods
  resources:
    requests:
      cpu: 100m
      memory: 256Mi

agents:
  tolerations:
    - key: node-role.kubernetes.io/control-plane
      operator: Exists
      effect: NoSchedule
```

Install with:

```bash
helm install datadog-agent datadog/datadog \
  --namespace datadog \
  -f datadog-values.yaml
```

Verify the installation:

```bash
# Check all pods are running
kubectl get pods -n datadog

# Verify agent connectivity to Datadog
kubectl exec -it -n datadog \
  $(kubectl get pods -n datadog -l app.kubernetes.io/component=agent -o jsonpath='{.items[0].metadata.name}') \
  -c agent -- agent status | grep "API key"
```

---

## Demo applications that generate realistic telemetry

Three applications stand out for SRE agent testing, each offering different tradeoffs between Datadog integration depth and telemetry diversity.

### Datadog Storedog (recommended first choice)

Storedog is Datadog's official demo e-commerce application, **pre-instrumented with APM, RUM, and intentional performance issues** for troubleshooting demos. It generates the most Datadog-native telemetry.

```bash
git clone https://github.com/DataDog/storedog.git
cd storedog

# Create environment file
cat > .env << EOF
DD_API_KEY=<your_api_key>
DD_APP_KEY=<your_app_key>
DD_SITE=datadoghq.com
EOF

# Run with Docker Compose
docker compose -f docker-compose.dev.yml up -d
```

### OpenTelemetry Astronomy Shop (most comprehensive)

The OpenTelemetry demo provides **15+ services in 10 different languages** with Kafka, PostgreSQL, and Redis—ideal for testing multi-language distributed tracing scenarios.

```yaml
# otel-datadog-values.yaml
opentelemetry-collector:
  config:
    exporters:
      datadog:
        api:
          key: ${DD_API_KEY}
          site: datadoghq.com
    service:
      pipelines:
        traces:
          exporters: [datadog]
        metrics:
          exporters: [datadog]
```

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
kubectl create namespace otel-demo
helm install otel-demo open-telemetry/opentelemetry-demo \
  -n otel-demo -f otel-datadog-values.yaml

kubectl port-forward -n otel-demo svc/frontend-proxy 8080:8080
```

### Google Online Boutique (polyglot gRPC)

A cloud-native e-commerce app with **11 microservices** demonstrating gRPC communication patterns. Includes a built-in Locust load generator.

```bash
git clone --depth 1 https://github.com/GoogleCloudPlatform/microservices-demo.git
cd microservices-demo
kubectl apply -f ./release/kubernetes-manifests.yaml
kubectl port-forward deployment/frontend 8080:8080
```

### Enabling APM auto-instrumentation via annotations

For applications not pre-instrumented, use Kubernetes annotations to inject Datadog tracing libraries automatically:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    tags.datadoghq.com/env: "test"
    tags.datadoghq.com/service: "my-app"
    tags.datadoghq.com/version: "1.0.0"
spec:
  template:
    metadata:
      labels:
        admission.datadoghq.com/enabled: "true"
        tags.datadoghq.com/env: "test"
        tags.datadoghq.com/service: "my-app"
      annotations:
        # Choose your language
        admission.datadoghq.com/python-lib.version: "latest"
        # admission.datadoghq.com/java-lib.version: "latest"
        # admission.datadoghq.com/js-lib.version: "latest"
```

---

## Generating load and simulating incidents

The combination of **k6 for load generation** and **Chaos Mesh for fault injection** creates realistic incident scenarios that trigger Datadog alerts.

### k6 load testing scripts

k6 provides the best balance of realistic traffic patterns and Kubernetes-native deployment:

```javascript
// load-test.js - Ramping traffic pattern
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Warm up
    { duration: '5m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // Spike
    { duration: '5m', target: 50 },   // Return to normal
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://frontend.default.svc.cluster.local:8080/');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  });
  sleep(Math.random() * 2 + 1);
}
```

Run locally or deploy to Kubernetes:

```bash
# Local execution
k6 run load-test.js

# Kubernetes deployment
kubectl apply -f https://raw.githubusercontent.com/grafana/k6-operator/main/bundle.yaml
```

### Chaos Mesh for Kubernetes-native fault injection

Chaos Mesh provides declarative chaos experiments that integrate well with Datadog monitoring:

```bash
# Install Chaos Mesh
helm repo add chaos-mesh https://charts.chaos-mesh.org
kubectl create ns chaos-mesh
helm install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-mesh \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock
```

**Network latency injection** (triggers APM latency alerts):

```yaml
# network-delay.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: inject-latency
spec:
  action: delay
  mode: all
  selector:
    namespaces: [default]
    labelSelectors:
      app: frontend
  delay:
    latency: '500ms'
    jitter: '100ms'
  duration: '5m'
```

**CPU stress** (triggers resource alerts):

```yaml
# cpu-stress.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: cpu-stress
spec:
  mode: one
  selector:
    namespaces: [default]
    labelSelectors:
      app: api-service
  stressors:
    cpu:
      workers: 2
      load: 80
  duration: '5m'
```

**Pod failure** (triggers availability alerts):

```yaml
# pod-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-kill
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces: [default]
    labelSelectors:
      app: checkout-service
  duration: '30s'
```

Apply experiments and observe in Datadog:

```bash
kubectl apply -f network-delay.yaml
# Wait 5 minutes, then clean up
kubectl delete -f network-delay.yaml
```

### Memory leak and OOMKill simulation

```yaml
# oomkill-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-leak-sim
spec:
  containers:
    - name: stress
      image: polinux/stress-ng
      command: ["stress-ng", "--vm", "1", "--vm-bytes", "2G"]
      resources:
        limits:
          memory: "512Mi"
```

---

## Datadog monitors that fire during simulated incidents

Create monitors programmatically using Python or Terraform to ensure consistent test configurations:

### Python monitor creation

```python
from datadog_api_client import ApiClient, Configuration
from datadog_api_client.v1.api.monitors_api import MonitorsApi
from datadog_api_client.v1.model.monitor import Monitor

configuration = Configuration()

with ApiClient(configuration) as api_client:
    api = MonitorsApi(api_client)

    # High latency monitor
    latency_monitor = Monitor(
        name="[TEST] High Latency - P95 > 500ms",
        type="metric alert",
        query="avg(last_5m):avg:trace.http.request.duration{env:test} by {service} > 500000000",
        message="High latency detected on {{service.name}}! @webhook-sre-agent",
        tags=["env:test", "team:sre", "type:latency"],
        options={
            "thresholds": {"critical": 500000000, "warning": 300000000},
            "notify_no_data": False,
            "require_full_window": False
        }
    )
    api.create_monitor(body=latency_monitor)

    # Error rate monitor
    error_monitor = Monitor(
        name="[TEST] High Error Rate > 5%",
        type="query alert",
        query="sum(last_5m):sum:trace.http.request.errors{env:test}.as_count() / sum:trace.http.request.hits{env:test}.as_count() * 100 > 5",
        message="Error rate exceeds 5%! @webhook-sre-agent",
        tags=["env:test", "type:error-rate"]
    )
    api.create_monitor(body=error_monitor)

    # Pod restart monitor
    restart_monitor = Monitor(
        name="[TEST] Pod Restarts Detected",
        type="query alert",
        query="change(sum(last_5m),last_5m):sum:kubernetes.containers.restarts{env:test} by {kube_deployment} > 3",
        message="Pod restarts in {{kube_deployment.name}}! @webhook-sre-agent",
        tags=["env:test", "type:availability"]
    )
    api.create_monitor(body=restart_monitor)
```

### Webhook configuration for receiving alerts

Set up a local webhook receiver to capture alert payloads for your SRE agent:

```python
# webhook_receiver.py
from flask import Flask, request, jsonify
import json

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def receive_alert():
    data = request.json
    print(f"Alert received: {json.dumps(data, indent=2)}")

    # Process for SRE agent
    alert_info = {
        "id": data.get("alert_id"),
        "title": data.get("alert_title"),
        "status": data.get("alert_transition"),
        "query": data.get("alert_query"),
        "tags": data.get("tags", "").split(","),
        "link": data.get("link")
    }

    # Your SRE agent logic here
    return jsonify({"status": "received"}), 200

if __name__ == '__main__':
    app.run(port=8080)
```

Expose locally using ngrok:

```bash
ngrok http 8080
# Use the generated URL in Datadog webhook integration
```

Configure the webhook in Datadog with this custom payload:

```json
{
  "incident": {
    "id": "$ALERT_ID",
    "title": "$ALERT_TITLE",
    "status": "$ALERT_TRANSITION",
    "severity": "$PRIORITY"
  },
  "context": {
    "hostname": "$HOSTNAME",
    "tags": "$TAGS",
    "query": "$ALERT_QUERY",
    "scope": "$ALERT_SCOPE"
  },
  "links": {
    "datadog_url": "$LINK",
    "snapshot": "$SNAPSHOT"
  },
  "logs_sample": $LOGS_SAMPLE
}
```

### Triggering alerts programmatically for testing

Submit custom metrics that exceed thresholds to trigger monitors on demand:

```python
from datadog_api_client.v2.api.metrics_api import MetricsApi
from datadog_api_client.v2.model.metric_payload import MetricPayload
from datadog_api_client.v2.model.metric_series import MetricSeries
from datadog_api_client.v2.model.metric_point import MetricPoint
import time

def trigger_test_alert(metric_name="custom.test.cpu", value=95.0):
    with ApiClient(Configuration()) as api_client:
        api = MetricsApi(api_client)

        body = MetricPayload(series=[
            MetricSeries(
                metric=metric_name,
                type=3,  # GAUGE
                points=[MetricPoint(timestamp=int(time.time()), value=value)],
                tags=["env:test", "test:alert-simulation"]
            )
        ])
        api.submit_metrics(body=body)
        print(f"Submitted {metric_name}={value}")

# Trigger alert (assuming threshold is 80)
trigger_test_alert(value=95.0)
```

---

## Recording and mocking Datadog API responses

For offline development and deterministic testing, use VCRpy to record and replay API interactions:

### VCRpy configuration for Datadog

```python
# conftest.py
import pytest
import vcr
import os

datadog_vcr = vcr.VCR(
    cassette_library_dir='tests/fixtures/cassettes',
    record_mode=os.environ.get('VCR_RECORD_MODE', 'none'),
    match_on=['method', 'host', 'path', 'query'],
    filter_headers=['DD-API-KEY', 'DD-APPLICATION-KEY'],
    filter_query_parameters=['api_key', 'application_key'],
    decode_compressed_response=True
)

@pytest.fixture
def vcr_cassette():
    return datadog_vcr
```

```python
# test_sre_agent.py
import pytest

@datadog_vcr.use_cassette('metrics_query.yaml')
def test_analyze_cpu_metrics():
    from sre_agent import DatadogClient

    client = DatadogClient()
    metrics = client.query_metrics("avg:system.cpu.user{env:test}")

    assert metrics is not None
    assert len(metrics.series) > 0
```

Record cassettes during development:

```bash
VCR_RECORD_MODE=once pytest tests/ -v
```

### Custom mock server for offline development

```python
# mock_datadog.py
from flask import Flask, jsonify, request
import time

app = Flask(__name__)

@app.route('/api/v1/query', methods=['GET'])
def query_metrics():
    return jsonify({
        "status": "ok",
        "series": [{
            "metric": "system.cpu.user",
            "points": [[time.time(), 45.5], [time.time() + 60, 48.2]],
            "tags": ["host:web-01", "env:test"]
        }]
    })

@app.route('/api/v1/events', methods=['GET', 'POST'])
def events():
    if request.method == 'POST':
        return jsonify({"status": "ok", "event": {"id": 12345}})
    return jsonify({
        "events": [{
            "id": 12345,
            "title": "[Triggered] High CPU",
            "text": "CPU exceeded threshold",
            "priority": "normal",
            "alert_type": "warning"
        }]
    })

@app.route('/api/v2/logs/events/search', methods=['POST'])
def logs_search():
    return jsonify({
        "data": [{
            "id": "log-123",
            "attributes": {
                "timestamp": "2024-01-01T00:00:00Z",
                "status": "error",
                "service": "api-server",
                "message": "Connection timeout"
            }
        }]
    })

if __name__ == '__main__':
    app.run(port=4010)
```

### Docker Compose for isolated development

```yaml
# docker-compose.dev.yml
version: "3.8"

services:
  datadog-mock:
    build: ./mock-server
    ports:
      - "4010:4010"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4010/health"]
      interval: 10s

  sre-agent:
    build: .
    environment:
      - MOCK_MODE=true
      - DATADOG_API_HOST=http://datadog-mock:4010
      - DD_API_KEY=mock-key
    depends_on:
      datadog-mock:
        condition: service_healthy
    volumes:
      - .:/app

  test:
    build: .
    environment:
      - VCR_RECORD_MODE=none
      - MOCK_MODE=true
    command: pytest tests/ -v --cov=src
```

### Handling rate limits during development

Datadog enforces rate limits of approximately **100 requests/hour** for metric queries and **300 requests/hour** for the Query API. Implement exponential backoff and caching:

```python
import time
from functools import lru_cache

class DatadogClientWithRateLimiting:
    def __init__(self):
        self.max_retries = 3
        self._cache = {}

    def query_with_retry(self, query, cache_ttl=60):
        cache_key = f"query:{query}"

        # Check cache first
        if cache_key in self._cache:
            cached_time, cached_value = self._cache[cache_key]
            if time.time() - cached_time < cache_ttl:
                return cached_value

        for attempt in range(self.max_retries):
            response = self._make_request(query)

            if response.status_code == 429:
                reset_time = int(response.headers.get('X-RateLimit-Reset', 60))
                delay = min(reset_time, 2 ** attempt)
                print(f"Rate limited, waiting {delay}s...")
                time.sleep(delay)
                continue

            # Cache successful response
            self._cache[cache_key] = (time.time(), response.json())
            return response.json()

        raise Exception("Max retries exceeded")
```

---

## Complete setup workflow

Follow this sequence to have a fully functional test environment in approximately 45 minutes:

**Phase 1: Infrastructure (10 minutes)**

```bash
# Start Kubernetes
minikube start --cpus=4 --memory=8192

# Install Datadog agent
helm repo add datadog https://helm.datadoghq.com
kubectl create ns datadog
kubectl create secret generic datadog-secret -n datadog \
  --from-literal api-key=$DD_API_KEY --from-literal app-key=$DD_APP_KEY
helm install datadog-agent datadog/datadog -n datadog -f datadog-values.yaml
```

**Phase 2: Demo application (10 minutes)**

```bash
# Deploy Storedog or Online Boutique
git clone https://github.com/DataDog/storedog.git && cd storedog
docker compose -f docker-compose.dev.yml up -d
```

**Phase 3: Chaos engineering (5 minutes)**

```bash
# Install Chaos Mesh
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh -n chaos-mesh --create-namespace
```

**Phase 4: Monitors and webhooks (10 minutes)**

```bash
# Run monitor creation script
python create_monitors.py

# Start webhook receiver
ngrok http 8080 &
python webhook_receiver.py
```

**Phase 5: Test the pipeline (10 minutes)**

```bash
# Generate load
k6 run load-test.js &

# Inject chaos
kubectl apply -f network-delay.yaml

# Verify alerts fire and webhook receives payload
```

---

## Conclusion

A realistic Datadog test environment for AI SRE agent development requires four components working together: **local Kubernetes with the Datadog agent** for infrastructure, **demo applications** generating realistic telemetry, **chaos engineering tools** for incident simulation, and **API mocking** for offline development.

The most effective approach starts with Storedog for its native Datadog integration, adds Chaos Mesh for declarative fault injection, and uses VCRpy to capture API interactions for deterministic testing. This combination enables rapid iteration on SRE agent logic while ensuring the agent handles real-world incident patterns.

For teams beyond initial prototyping, consider adding the OpenTelemetry demo for multi-language tracing scenarios and implementing the full Docker Compose offline development stack to eliminate dependency on live Datadog API calls during development sprints.
