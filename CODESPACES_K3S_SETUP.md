# Codespaces + k3d — Run the full Kubernetes stack (no credit card)

This runs a **real multi-node Kubernetes cluster** (k3d = K3s in Docker) inside a **GitHub
Codespace**, with a **load balancer**, MinIO, RabbitMQ, Prometheus, Grafana, and your app — all with
zero cost and no credit card. You share the running ports to your teacher via Codespaces' port
forwarding.

**Why this satisfies "load balancing & orchestration":**
- Multi-node cluster (server + agent = real orchestration topology)
- `Service type: LoadBalancer` → k3d's built-in load balancer distributes traffic to pods
- HorizontalPodAutoscaler (HPA) scales replicas under load
- Rolling updates, services, config maps, secrets — all standard `kubectl` objects

> **Note on 24/7:** a Codespace is online only while it's running. For a live demo session with your
> teacher it's perfect. If you need it always-on later, see the "Keep it always-on" section.

---

## Step 1 — Open the project in a Codespace (one click)

1. Push this repo to GitHub (already done: `Miraz2/markit-app`).
2. On GitHub → the repo → green **Code** button → **Codespaces** tab → **Create codespace on main**.
3. The devcontainer auto-installs Docker-in-Docker, Node, kubectl, and k3d, then provisions the
   cluster (`.devcontainer/devcontainer.json` + `.devcontainer/setup-k3d.sh`).

> First boot takes ~1–3 minutes (pulls images). If the cluster didn't auto-create, run:
> ```bash
> bash .devcontainer/setup-k3d.sh
> ```

---

## Step 2 — Verify the cluster

Inside the Codespace terminal:
```bash
kubectl get nodes          # expect 2 nodes: k3d-attendance-server-0, k3d-attendance-agent-0
kubectl get all -A | head
```

---

## Step 3 — Deploy the stack

```bash
# 1. Secrets (fill real values first)
cp k8s/base/02-secrets.example.yaml k8s/base/02-secrets.yaml
# EDIT k8s/base/02-secrets.yaml -> MONGO_URI (Atlas free) + JWT secrets + MINIO/RABBITMQ passwords

kubectl apply -f k8s/base/02-secrets.yaml

# 2. Configmap — CLIENT_ORIGIN should be "http://localhost:30080" (Codespaces forwards 30080)
kubectl apply -f k8s/base/01-configmap.yaml

# 3. App + infra
kubectl apply -f k8s/base/kustomization.yaml

# 4. Monitoring
kubectl apply -f k8s/monitoring/kustomization.yaml
```

Check everything is running:
```bash
kubectl get pods -n attendance
kubectl get pods -n minio
kubectl get pods -n rabbitmq
kubectl get pods -n monitoring
kubectl get svc -n attendance
kubectl get svc -n monitoring
```

---

## Step 4 — Load balancing & scaling demo

```bash
# see the LoadBalancer service (k3d's traefik/LB distributes to both copies)
kubectl get svc frontend -n attendance

# enable autoscaling on the backend (1-4 replicas, CPU-based)
kubectl autoscale deployment/backend -n attendance --cpu-percent=60 --min=1 --max=4
kubectl get hpa -n attendance

# show rolling update / scaling
kubectl scale deployment/backend -n attendance --replicas=3
kubectl rollout status deployment/backend -n attendance
kubectl get pods -n attendance -o wide
```

---

## Step 5 — Share with your teacher (port forwarding)

In the Codespace, the **Ports** panel auto-detects the LoadBalancer ports. Ensure these are
**public**:
- **30080** → the app
- **30030** → Grafana

Right-click each port → **Port Visibility** → **Public**. Copy the public URL and send it to your
teacher. They open it directly in their browser.

Alternatively use Codespaces URL forwarding:
`https://<CODESPACE>-30080.app.github.dev` and `...-30030.app.github.dev`

---

## What your teacher sees

| Service | Port | How to reach |
|---|---|---|
| Attendance app | 30080 | forwarded public port / `-30080.app.github.dev` |
| Grafana | 30030 | `admin` / `admin` |
| RabbitMQ UI | 15672 | `kubectl port-forward -n rabbitmq svc/rabbitmq 15672:15672` (local only) |
| MinIO console | 9001 | `kubectl port-forward -n minio svc/minio 9001:9001` (local only) |

---

## Keep it always-on (optional, card-free-ish)

A Codespace stops when you close it. For a 24/7 cluster you'd need a host. Free/cheap options:
- **GitHub Codespaces** — keep the codespace running during the demo window only (easiest, $0)
- **A spare PC/laptop you own** — install K3s directly (not k3d) on it, expose via your router or a
  free tunnel (Cloudflare/ngrok). This gives real 24/7 K8s at $0.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No cluster / `kubectl get nodes` fails | Run `bash .devcontainer/setup-k3d.sh` manually; wait for Docker-in-Docker to start. |
| `ErrImagePull` | Images `ghcr.io/miraz2/...` must exist. Build first: `cd backend && docker build -t ghcr.io/miraz2/attendance-backend:latest . && cd ..` (repeat frontend), push, then `kubectl rollout restart`. |
| Backend `CrashLoopBackOff` | Missing `02-secrets.yaml` MONGO_URI. `kubectl logs deployment/backend -n attendance`. |
| App loads but API 502 | Nginx proxies `/api` → `backend:5000`. Ensure backend Service is named `backend` in `attendance` ns; set `CLIENT_ORIGIN`. |
| Host `:30080` returns `404 page not found` but node IP/port-forward works | The k3d cluster was created with `--port ...@loadbalancer`, which breaks NodePort routing. Recreate using `@server:0` mappings (see `setup-k3d.sh`) and re-deploy. |
| Ports not public | In Codespace **Ports** panel, set port visibility to **Public**. |
| Codespace runs out of RAM | Reduce replicas; `kubectl scale deployment/backend -n attendance --replicas=1`. |
