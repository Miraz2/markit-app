# Zero-Cost Deployment Guide — Oracle Cloud Always Free + K3s

This is the **no-credit-card** path to host your attendance system live on real Kubernetes.
It uses **Oracle Cloud's "Always Free"** tier (free forever ARM VMs, no card required) running a
lightweight Kubernetes distribution called **K3s**.

**Why K3s instead of EKS/GKE?** EKS/GKE need a paid managed control plane and—for your setup—a
load balancer (not free). K3s runs a full, real Kubernetes cluster (kubectl compatible) on a single
free Oracle VM. Same `kubectl`, same manifests, zero cost.

---

## Architecture after this guide

```
Teacher/browser ──► http://<VM_PUBLIC_IP>:30080
                            │  (NodePort → no paid load balancer)
                        ┌───▼────┐
                        │  K3s   │  (Kubernetes on 1 Oracle ARM VM)
                        │  node  │
                        └───┬────┘
    ┌──────────┬────────────┼──────────────┬───────────────┐
    │ frontend │  backend   │  minio       │  rabbitmq     │
    │ (React)  │ (Express)  │  (S3-like)   │  (queue)      │
    └──────────┴────────────┴──────────────┴───────────────┘
         Prometheus + Grafana (monitoring) · MongoDB Atlas (cloud DB, free)
```

Components reused **unchanged** from `k8s/`:
- `k8s/base/00-namespace.yaml` … `06-rabbitmq.yaml` (app + MinIO + RabbitMQ)
- `k8s/monitoring/*` (Prometheus + Grafana)

---

## Phase 0 — What you need

- A **GitHub account** (free) → needed for images + CI/CD
- An **Oracle Cloud account** (free, no card) → the virtual machine
- A **MongoDB Atlas** free cluster (or a local MongoDB if you skipped Atlas)
- Your laptop with **git** and **docker** (for building/pushing images)

---

## Phase 1 — Create the Oracle Cloud account + VM (free, no credit card)

1. Go to **https://www.oracle.com/cloud/free/** → **Start for free**
   - Choose **"Oracle Cloud Free Tier"** (do NOT pick paid).
   - You may be asked for a phone/email verification. Historically **no credit card** is required for
     the Always Free ARM VM when you sign up via the free promo, but if prompted you can skip/decline
     paid signup. If a card is requested, register and **never** upgrade.
2. After signing in, open the **Console** (region top-right — pick one, e.g. `ap-south-1` Mumbai or
   `ap-mumbai-1`, closest to Bangladesh).
3. Create an **SSH key pair** on your laptop (once):
   ```bash
   ssh-keygen -t ed25519 -C "attendance" -f ~/.ssh/oracle_key
   # prints public key path ~/.ssh/oracle_key.pub
   ```
4. Create a **compute instance**:
   - Console → **Compute** → **Instances** → **Create instance**
   - Name: `attendance`
   - Image: **Canonical Ubuntu 22.04 (Minimal)** (ARM)
   - Shape: **VM.Standard.A1.Flex** (Always Free) → set **OCPUs: 2, Memory: 12 GB** (free limits:
     4 OCPU + 24 GB across always-free ARM)
   - **SSH keys**: paste the **public** key from `~/.ssh/oracle_key.pub`
   - **Boot volume**: 50 GB (within free tier)
   - Click **Create**.
5. Wait until it shows **Running**. Note the **public IP address** (e.g. `129.146.xx.xx`).
6. **Open firewall ports** in Oracle (Network → Virtual cloud networks → security list → add **Ingress** rules):
   - `30080` (app) — source `0.0.0.0/0`
   - `30030` (Grafana) — source `0.0.0.0/0`
   - Optionally `22` (SSH, already open by default)
   - Also open these in the instance's OS firewall (we do this in Phase 2).

You now have a free always-on Linux VM with your IP.

---

## Phase 2 — Connect & install K3s

From your laptop:
```bash
ssh -i ~/.ssh/oracle_key ubuntu@<VM_PUBLIC_IP>
```
(If the Ubuntu user differs, use `opc` for Oracle Linux — for Ubuntu Minimal the user is `ubuntu`.)

Install K3s (a single-node Kubernetes cluster):
```bash
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644
```

Verify:
```bash
sudo k3s kubectl get nodes        # expect one node, STATUS=Ready
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
```

Now, from **your laptop**, connect `kubectl` to the cluster:
```bash
# install kubectl locally (if not present) — see AWS guide Phase 0
# copy the kubeconfig:
scp -i ~/.ssh/oracle_key ubuntu@<VM_PUBLIC_IP>:/etc/rancher/k3s/k3s.yaml ~/.kube/oracle.yaml
# edit ~/.kube/oracle.yaml and change the server line:
#   server: https://127.0.0.1:6443  →  server: https://<VM_PUBLIC_IP>:6443
export KUBECONFIG=~/.kube/oracle.yaml
kubectl get nodes                # should work from your laptop now
```

> To manage the cluster from the VM directly (simplest), you can also just run
> `kubectl` on the VM with `sudo k3s kubectl`. For a cleaner setup, install `kubectl`
> on the VM: `curl -LO https://dl.k8s.io/release/$(curl -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl && chmod +x kubectl && sudo mv kubectl /usr/local/bin/` and use `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml`.

---

## Phase 3 — Deploy your app (mirror of the AWS guide)

From your laptop (with `KUBECONFIG` set to Oracle), or on the VM:

```bash
# 1. Secrets (gitignored; fill real values first!)
cp k8s/base/02-secrets.example.yaml k8s/base/02-secrets.yaml
#  EDIT k8s/base/02-secrets.yaml: MONGO_URI, JWT secrets, MINIO/RABBITMQ passwords
#  (MONGO_URI = your Atlas string, or mongodb://<positional> if self-hosting Mongo)

kubectl apply -f k8s/base/02-secrets.yaml

# 2. Set your public IP in the configmap
#  EDIT k8s/base/01-configmap.yaml → replace <PUBLIC_IP> with your VM public IP
kubectl apply -f k8s/base/01-configmap.yaml

# 3. Apply app + infra
kubectl apply -f k8s/base/kustomization.yaml

# 4. Monitoring
kubectl apply -f k8s/monitoring/kustomization.yaml
```

Verify:
```bash
kubectl get pods -n attendance
kubectl get pods -n minio
kubectl get pods -n rabbitmq
kubectl get pods -n monitoring
kubectl rollout status deployment/backend -n attendance
kubectl rollout status deployment/frontend -n attendance
```

> **Image pull note:** the manifests reference `ghcr.io/<YOUR_GITHUB_USERNAME>/...:latest`.
> Those images may not exist yet until you run CI/CD (Phase 4). Either run Phase 4 first and
> re-apply, or build/push once (Phase 4A below) so the pods can pull them.

---

## Phase 4 — Build & push images + CI/CD (GitHub)

### 4A. One-time: get your images into GitHub Container Registry (GHCR)

```bash
# from project root — build + push manually (or just let CI do it)
cd backend  && docker build -t ghcr.io/<YOU>/attendance-backend:latest . && cd ..
cd frontend && docker build -t ghcr.io/<YOU>/attendance-frontend:latest . && cd ..

# log into GHCR
echo "$GH_TOKEN" | docker login ghcr.io -u <YOU> --password-stdin
# (GH_TOKEN = a GitHub Personal Access Token with `write:packages` scope)

docker push ghcr.io/<YOU>/attendance-backend:latest
docker push ghcr.io/<YOU>/attendance-frontend:latest
```

### 4B. Update manifest image names + public IP

- `k8s/base/03-backend.yaml` → `ghcr.io/<YOU>/attendance-backend:latest`
- `k8s/base/04-frontend.yaml` → `ghcr.io/<YOU>/attendance-frontend:latest`
- `k8s/base/01-configmap.yaml` → `CLIENT_ORIGIN: http://<VM_PUBLIC_IP>:30080`

Commit and push to GitHub.

### 4C. CI/CD via GitHub Actions

The `.github/workflows/ci-cd.yml` deploys to **EKS** (AWS). For Oracle/K3s we adjust it to
`kubectl` against your VM. Simplest robust approach — add these GitHub Actions **repository secrets**
and switch the workflow (I can generate this for you):

| Secret | Value |
|---|---|
| `K3S_KUBECONFIG` | the full contents of your VM's `k3s.yaml` |
| `GHCR_TOKEN` (or use the default `GITHUB_TOKEN`) | for pushing GHCR images |

Then on push → workflow builds images → pushes to GHCR → `kubectl set image` to update the cluster
over SSH/`kubectl`.

> **Fastest demo alternative:** skip CI complexity and just set the K8s deployments
> `imagePullPolicy: Always`, push images manually, and `kubectl rollout restart` on the VM after each
> change. Perfect for a demo; CI adds polish but isn't required to show the teacher.

---

## Phase 5 — Show your teacher

From any browser (teacher's phone included):

| Service | URL | Login |
|---|---|---|
| **Attendance app** | `http://<VM_PUBLIC_IP>:30080` | create/sign in a teacher |
| **Grafana** | `http://<VM_PUBLIC_IP>:30030` | `admin` / `admin` |
| **RabbitMQ UI** | `kubectl port-forward -n rabbitmq svc/rabbitmq 15672:15672` → localhost | from your laptop |
| **MinIO console** | `kubectl port-forward -n minio svc/minio 9001:9001` → localhost | `minioadmin` / your password |

**Live demo script for the teacher (cloud-computing focus):**
1. Open the app URL → `kubectl get nodes`, `kubectl get pods -n attendance`
2. Show the app working (roster → attendance → PDF)
3. `kubectl scale deployment/backend -n attendance --replicas=3` → show rolling update / scaling
4. Open Grafana → show cluster/API health dashboards
5. Show RabbitMQ queue + MinIO (object storage) working
6. Optionally `kubectl rollout restart` after a `git push` to demo CI/CD

---

## Phase 6 — Auto-scaling (the "wow" for grading)

K3s supports the standard **HorizontalPodAutoscaler (HPA)**:
```bash
kubectl autoscale deployment/backend -n attendance --cpu-percent=60 --min=1 --max=4
kubectl get hpa -n attendance
```
Show the HPA scaling replicas under load — great cloud-computing evidence.

---

## Cost Summary (0 card, 0 recurring)

| Resource | Provider | Cost |
|---|---|---|
| ARM VM (2 OCPU / 12 GB) | Oracle Always Free | **$0 forever** |
| Kubernetes | K3s on that VM | $0 |
| MinIO / RabbitMQ / Prometheus / Grafana | self-hosted pods | $0 |
| MongoDB Atlas M0 | MongoDB Atlas | $0 |
| GHCR + GitHub Actions | GitHub free | $0 |
| Load balancer | **None (NodePort)** | $0 — avoid it |

**Total: $0.**

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Connection refused` on :30080 | Port not opened in Oracle security list **and** OS firewall. On VM: `sudo ufw allow 30080/tcp` (or `sudo iptables -I INPUT -p tcp --dport 30080 -j ACCEPT`) and re-check Oracle Ingress rules. |
| `ErrImagePull` / `ImagePullBackOff` | Images not in GHCR yet — run Phase 4A, then `kubectl rollout restart deployment/backend -n attendance`. |
| Backend `CrashLoopBackOff` | Missing/unvalid `02-secrets.yaml` (MONGO_URI required). `kubectl logs deployment/backend -n attendance`. |
| `kubectl` can't reach cluster | `kubectl config use-context default` and confirm `KUBECONFIG` points at Oracle file; server is `https://<VM_IP>:6443`. |
| App loads but API 502 | Nginx proxies `/api` → `backend:5000`. Confirm backend Service is named `backend` in `attendance` ns and `CLIENT_ORIGIN` is set. |
| VM runs out of memory | 2–3 small pods only; keep replicas low. Redis/Prometheus on same node is fine at 12 GB. |
