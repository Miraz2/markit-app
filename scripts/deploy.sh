#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/6 Deploying secrets"
[ -f k8s/base/02-secrets.yaml ] || cp k8s/base/02-secrets.example.yaml k8s/base/02-secrets.yaml
kubectl apply -f k8s/base/02-secrets.yaml

echo "==> 2/6 Deploying configmap"
kubectl apply -f k8s/base/01-configmap.yaml

echo "==> 3/6 Deploying app + MinIO + RabbitMQ"
kubectl apply -f k8s/base/kustomization.yaml

echo "==> 4/6 Deploying monitoring"
kubectl apply -f k8s/monitoring/kustomization.yaml

echo "==> 5/6 Waiting for rollout"
kubectl rollout status deployment/backend -n attendance --timeout=180s || true
kubectl rollout status deployment/frontend -n attendance --timeout=180s || true

echo "==> 6/6 Summary"
kubectl get nodes
kubectl get pods -n attendance
kubectl get svc -n attendance
kubectl get svc -n monitoring
echo "DONE. App: localhost:30080  |  Grafana: localhost:30030 (admin/admin)"
echo "Set CLIENT_ORIGIN in k8s/base/01-configmap.yaml to your forwarded URL if cookies/CORS fail."
