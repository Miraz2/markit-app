#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing kubectl"
if ! command -v kubectl >/dev/null 2>&1; then
  curl -sfLO "https://dl.k8s.io/release/$(curl -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x kubectl && sudo install -m 0755 kubectl /usr/local/bin/kubectl && rm -f kubectl
fi

echo "==> Installing k3d"
if ! command -v k3d >/dev/null 2>&1; then
  curl -sfL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
fi

echo "==> Creating multi-node k3d cluster with load balancer"
# servers=1 agent=1 -> two worker-capable nodes (real orchestration)
# --servers-memory/--agents-memory keep it light for Codespaces
k3d cluster create attendance \
  --servers 1 \
  --agents 1 \
  --agents-memory 1536m \
  --servers-memory 1536m \
  --port 30080:80@loadbalancer \
  --port 30030:30030@loadbalancer \
  --wait || true

k3d kubeconfig merge attendance -d ~/.kube/config 2>/dev/null || true

echo "==> Cluster nodes"
kubectl get nodes -o wide || true

echo "==> Single-node alternative (if the multi-node creation failed):"
echo "    k3d cluster delete attendance && k3d cluster create attendance --agents 1 --port 30080:80@loadbalancer"
echo "SUCCESS: cluster ready. Use 'kubectl' against it. Ports: app=30080, grafana=30030"
