## Strip Listen (backend tarafında çalışmalı) - Localde test yaparken
stripe listen --forward-to localhost:3001/api/subscription/webhook

## Yeni KEY Eklemek
Bundan sonra .env'e yeni bir değişken eklediğinizde, bunu kubectl patch secret backend-secrets -n chatbu --type=merge -p '{"stringData":{"KEY":"VALUE"}}' ile secret'a eklemeniz yeterli; deployment.yaml'a dokunmanıza gerek yok.

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

## Postgres Port Forwarding
# prod
kubectl port-forward -n postgresql svc/chatbu-postgres-rw 5432:5432
# dev
kubectl port-forward -n chatbu-dev svc/chatbu-postgres-rw 5432:5432      



Backenddeki envler çekme:
# prod
bash scripts/sync-k8s-env.sh chatbu backend-secrets
# dev
bash scripts/sync-k8s-env.sh chatbu-dev backend-secrets

Backend env eklemek
# prod

# dev
kubectl patch secret backend-secrets -n chatbu-dev --type=merge -p '{"stringData":{"KEY":"VALUE"}}'



kubectl patch secret backend-secrets -n chatbu-dev --type=merge -p '{"stringData":{"META_APP_ID":"875538805559401"}}'
kubectl patch secret backend-secrets -n chatbu-dev --type=merge -p '{"stringData":{"META_APP_SECRET":"27900f120ebe431cfd4aaaf0a83498ca"}}'



kubectl patch secret frontend -n chatbu-dev --type=merge -p '{"stringData":{"VITE_META_APP_ID":"875538805559401"}}'
kubectl patch secret frontend-secrets -n chatbu-dev --type=merge -p '{"stringData":{"VITE_META_CONFIGURATION_ID":"1918351102207106"}}'


https://developers.facebook.com/es/oauth/callback/?use_case_enum=WHATSAPP_BUSINESS_MESSAGING&selected_tab=overview&product_route=whatsapp-business&business_id=849401607555217&nonce=...