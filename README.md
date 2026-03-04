## Strip Listen (backend tarafında çalışmalı) - Localde test yaparken
stripe listen --forward-to localhost:3001/api/subscription/webhook



Backend: kod değiştir → image build/push (<tag> her zaman unique) → 

kubectl -n chatbu set image deploy/backend backend=152100380489.dkr.ecr.eu-central-1.amazonaws.com/chatbu-backend:<tag> → 
kubectl -n chatbu rollout status deploy/backend.


Frontend: kod değiştir → image build/push → kubectl -n chatbu set image deploy/frontend frontend=152100380489.dkr.ecr.eu-central-1.amazonaws.com/chatbu-repo:<tag> → kubectl -n chatbu rollout status deploy/frontend.
Kontrol: kubectl -n chatbu get pods, kubectl -n chatbu logs deploy/backend --tail=200, kubectl -n chatbu logs deploy/frontend --tail=200.
Hızlı geri alma: kubectl -n chatbu rollout undo deploy/backend ve/veya kubectl -n chatbu rollout undo deploy/frontend.
K8s env’leri local projelere çekme (yapılandırıldı)

Backend env çek: cd /Users/hazalcanelersu/Documents/Github/chatbu-backend && ./scripts/sync-k8s-env.sh
Backend local override (DB/ES/MinIO localhost): prepare-local-env.sh → .env.local üretir.
Frontend env çek: cd /Users/hazalcanelersu/Documents/Github/chatbu-frontend && ./scripts/sync-k8s-env.sh
Güvenlik: üretilen .env.k8s.local ve .env.local dosyaları .gitignore kapsamına alındı, commit edilmez.

Namespace içinde backend podları gör: kubectl get pods -n chatbu -l app=backend
Deployment loglarını direkt izle: kubectl logs -n chatbu deploy/backend -f
Son 200 satır (takip etmeden): kubectl logs -n chatbu deploy/backend --tail=200
Önceki crash logu (restart olduysa): kubectl logs -n chatbu deploy/backend --previous --tail=200
Belirli poddan log al: kubectl logs -n chatbu <POD_ADI> --tail=200 -f
Hata satırlarını filtrele: kubectl logs -n chatbu deploy/backend --tail=500 | egrep -i "error|exception|failed|timeout"