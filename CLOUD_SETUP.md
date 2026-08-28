# Cloud-Native Deployment Guide (AWS EKS)

This guide walks through turning the app into a full **cloud-native** deployment on **Amazon EKS**
(Elastic Kubernetes Service) using the always-free/small-cost tiers. Everything runs as Kubernetes
pods: the app, MinIO (S3-compatible storage), RabbitMQ (messaging), Prometheus + Grafana (monitoring),
and CI/CD via GitHub Actions + GitHub Container Registry.

**Cost goal:** ~$0/month within free-tier limits (see cost table at the bottom).

---

## What's in this repo (cloud files)

| Path | Purpose |
|---|---|
| `backend/Dockerfile` | Containerizes the Express API |
| `frontend/Dockerfile` + `frontend/nginx.conf` | Builds the React app and serves it via Nginx (proxies `/api` to backend) |
| `k8s/base/00-namespace.yaml` | Namespaces: attendance, minio, rabbitmq, monitoring |
| `k8s/base/01-configmap.yaml` | Non-secret backend env |
| `k8s/base/02-secrets.example.yaml` | **Template** — copy to `02-secrets.yaml` and fill in secrets |
| `k8s/base/03-backend.yaml` | Backend Deployment (2 replicas) + ClusterIP Service |
| `k8s/base/04-frontend.yaml` | Frontend Deployment (2 replicas) + **NodePort 30080** Service |
| `k8s/base/05-minio.yaml` | MinIO S3-compatible storage (PVC + Service) |
| `k8s/base/06-rabbitmq.yaml` | RabbitMQ with management UI (Service) |
| `k8s/base/kustomization.yaml` | Applies the base set together |
| `k8s/monitoring/*` | Prometheus + Grafana (NodePort 30030) |
| `.github/workflows/ci-cd.yml` | Build → push GHCR → deploy to EKS |

---

## Phase 0 — One-time prerequisites

### 1. AWS account + CLI tools
1. Create an AWS account at https://aws.amazon.com/free (12-month free tier for eligible services).
2. Create an IAM user with `AdministratorAccess` in AWS Console → IAM → Users → create user → attach policy.
3. Create an **Access Key** for that user. You'll use the key/secret in Phase 3.

Install the tools:
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# eksctl
curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz"
tar -xzf eksctl_Linux_amd64.tar.gz && sudo mv eksctl /usr/local/bin/

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# helm (optional, if you later switch to Helm charts)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

Configure AWS:
```bash
aws configure
# access key, secret key, region = us-east-1, output = json
```

### 2. MongoDB Atlas (free)
Your app already uses MongoDB. Create a free **MongoDB Atlas** cluster (M0), add a database user,
allow IP `0.0.0.0/0` (or your EC2 IP), and copy the connection string. You'll put it in the Secret.

---

## Phase 1 — Create the EKS cluster

```bash
eksctl create cluster \
  --name attendance \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.micro \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed
```

This takes ~10–15 minutes. After it finishes, `kubectl` will point at the new cluster:
```bash
kubectl get nodes
```

> **t3.micro** is in the EC2 free tier (12 months). Use `t4g.small` (ARM, also free) if you prefer:
> add `--instance-types t4g.small` and `--node-ami-family AmazonLinux2023`.

---

## Phase 2 — Deploy secrets, app, and infrastructure

### 1. Set up secrets
```bash
cd k8s/base
cp 02-secrets.example.yaml 02-secrets.yaml
# EDIT 02-secrets.yaml:
#   - MONGO_URI          -> your Atlas connection string
#   - JWT_* secrets      -> openssl rand -hex 48
#   - MINIO / RABBITMQ   -> pick strong passwords
cd ../..

kubectl apply -f k8s/base/02-secrets.yaml
```

### 2. Set your public IP in the ConfigMap
Edit `k8s/base/01-configmap.yaml` and replace `<PUBLIC_IP>` with your EC2 node's public IP
(Phase 1 notes show it, or run `kubectl get nodes -o wide`).

### 3. Apply everything
```bash
kubectl apply -f k8s/base/kustomization.yaml
kubectl apply -f k8s/base/02-secrets.yaml
kubectl apply -f k8s/monitoring/kustomization.yaml
```

### 4. Verify status
```bash
kubectl get pods -n attendance
kubectl get pods -n minio
kubectl get pods -n rabbitmq
kubectl get pods -n monitoring
kubectl rollout status deployment/backend -n attendance
kubectl rollout status deployment/frontend -n attendance
```

---

## Phase 3 — Expose to your teacher (zero-cost NodePort)

| Service | URL |
|---|---|
| **App** | `http://<PUBLIC_IP>:30080` |
| **Grafana** | `http://<PUBLIC_IP>:30030` (admin / admin) |
| **RabbitMQ UI** | reachable via `kubectl port-forward` (see below) |
| **MinIO console** | `kubectl port-forward` (see below) |

> Using **NodePort** avoids a paid Load Balancer (ALB/NLB are **not** in the free tier).

For admin consoles (keep them private — port-forward instead of NodePort):
```bash
# MinIO web console (admin/minioadmin123)
kubectl port-forward -n minio svc/minio 9001:9001

# RabbitMQ management UI
kubectl port-forward -n rabbitmq svc/rabbitmq 15672:15672
```

---

## Phase 4 — CI/CD with GitHub Actions

### 1. Push the repo to GitHub
```bash
git remote add origin https://github.com/<YOU>/<REPO>.git
git push -u origin main
```

### 2. Add GitHub repository Secrets
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 3. Update image references
In `k8s/base/03-backend.yaml` and `04-frontend.yaml`, replace
`ghcr.io/<YOUR_GITHUB_USERNAME>/...` with your actual GitHub username.

### 4. Update the EKS cluster name if you changed it
In `.github/workflows/ci-cd.yml`, `EKS_CLUSTER: attendance` and `AWS_REGION: us-east-1`.

### 5. Deploy trigger
Every push to `main` builds both Docker images, pushes them to GitHub Container Registry (free),
then `kubectl apply` + rolling restart on EKS.

---

## Phase 5 — Local testing (optional, before the cloud)

```bash
cd backend && docker build -t attendance-backend . && cd ..
cd frontend && docker build -t attendance-frontend . && cd ..

# Run backend pointing at your local/open MongoDB
docker run --rm -p 5000:5000 \
  -e MONGO_URI="mongodb://127.0.0.1:27017/attendance" \
  -e JWT_ACCESS_SECRET=... -e JWT_REFRESH_SECRET=... \
  attendance-backend

# Run frontend (proxies /api to backend service in k8s; for local use set VITE_API_URL)
docker run --rm -p 30080:80 attendance-frontend
```

---

## Cost Table

| Component | AWS/cloud resource | Cost |
|---|---|---|
| Kubernetes control plane | EKS (≤2 h/day free) | $0 (demo) |
| Worker nodes | EC2 `t3.micro` ×2 | $0 (12-month free tier) |
| Block storage | EBS (30 GB free) | $0 |
| MinIO | Self-hosted pod on EBS | $0 |
| RabbitMQ | Self-hosted pod | $0 |
| Prometheus + Grafana | Self-hosted pods | $0 |
| Database | MongoDB Atlas M0 | $0 (free cluster) |
| Container registry | GitHub Container Registry | $0 |
| CI/CD | GitHub Actions | $0 (2000 min/mo) |
| Load balancer | None (NodePort) | **avoided** — keep it that way |

> ⚠️ If you later `kubectl expose ... LoadBalancer`, AWS **charges** for the ALB/NLB. Stick with NodePort for the demo.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Images 404 / pull error | You haven't pushed to GHCR, or image name/username mismatch. Run CI once, then check `ghcr.io/<you>/attendance-backend:latest` exists. |
| Backend CrashLoopBackOff | Missing `02-secrets.yaml` (MONGO_URI required) — `kubectl logs deployment/backend -n attendance`. |
| Frontend can't reach API | Nginx proxies to `attendance-backend:5000`. Ensure the backend Service is named `backend` in the `attendance` namespace. Check `CLIENT_ORIGIN` uses your public IP. |
| Cluster too expensive after 12 months | Delete the cluster: `eksctl delete cluster --name attendance --region us-east-1`. |
