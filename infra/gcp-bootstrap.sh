#!/usr/bin/env bash
# Dựng hạ tầng GCP cho 3 môi trường dev/test/prod — CHẠY 1 LẦN (Git Bash hoặc Cloud Shell).
#
# Để học cho rẻ: 1 GCP project + 1 Cloud SQL instance chứa 3 database.
# Công ty thật thường tách: 1 project / môi trường, prod có Cloud SQL riêng (HA, backup...).
#
# Dùng:  PROJECT_ID=my-proj GITHUB_REPO=owner/repo bash infra/gcp-bootstrap.sh
set -euo pipefail

: "${PROJECT_ID:?Cần PROJECT_ID}"
: "${GITHUB_REPO:?Cần GITHUB_REPO dạng owner/repo}"
REGION="${REGION:-asia-southeast1}"
AR_REPO="${AR_REPO:-cicd-images}"
SQL_INSTANCE="${SQL_INSTANCE:-cicd-postgres}"
ENVS=(dev test prod)

gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "==> 1. Bật các API cần thiết"
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com cloudresourcemanager.googleapis.com

echo "==> 2. Artifact Registry (nơi chứa Docker image)"
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker --location="$REGION" || echo "   (đã tồn tại)"

echo "==> 3. Cloud SQL Postgres (mất ~10 phút)"
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro \
  --region="$REGION" --storage-size=10 || echo "   (đã tồn tại)"
CONNECTION_NAME="$PROJECT_ID:$REGION:$SQL_INSTANCE"

echo "==> 4. Database + user + secret DATABASE_URL cho từng môi trường"
for ENV in "${ENVS[@]}"; do
  DB="app_$ENV"
  PASS=$(openssl rand -hex 16)
  gcloud sql databases create "$DB" --instance="$SQL_INSTANCE" || true
  gcloud sql users create "$DB" --instance="$SQL_INSTANCE" --password="$PASS" \
    || gcloud sql users set-password "$DB" --instance="$SQL_INSTANCE" --password="$PASS"
  # Cloud Run kết nối Cloud SQL qua unix socket /cloudsql/<connection-name>
  URL="postgresql://$DB:$PASS@localhost/$DB?host=/cloudsql/$CONNECTION_NAME"
  if gcloud secrets describe "database-url-$ENV" >/dev/null 2>&1; then
    printf '%s' "$URL" | gcloud secrets versions add "database-url-$ENV" --data-file=-
  else
    printf '%s' "$URL" | gcloud secrets create "database-url-$ENV" --data-file=-
  fi
done

echo "==> 5. Service account RUNTIME (danh tính của container khi chạy)"
RUNTIME_SA="cicd-runtime@$PROJECT_ID.iam.gserviceaccount.com"
gcloud iam service-accounts create cicd-runtime --display-name="Cloud Run runtime" || true
for ROLE in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_SA" --role="$ROLE" --condition=None >/dev/null
done

echo "==> 6. Service account DEPLOYER (danh tính của GitHub Actions)"
DEPLOY_SA="github-deployer@$PROJECT_ID.iam.gserviceaccount.com"
gcloud iam service-accounts create github-deployer --display-name="GitHub Actions deployer" || true
for ROLE in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOY_SA" --role="$ROLE" --condition=None >/dev/null
done
# Deployer được phép "gắn" runtime SA vào Cloud Run service
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser >/dev/null

echo "==> 7. Workload Identity Federation (GitHub OIDC → GCP, không cần JSON key)"
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions" || true
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='$GITHUB_REPO'" || true
# Chỉ đúng repo của bạn mới được "mượn" deployer SA
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO" >/dev/null

cat <<EOF

=====================================================================
✅ Xong. Vào GitHub repo → Settings → Secrets and variables → Actions → Variables
   Tạo các REPOSITORY variables sau:

   GCP_PROJECT_ID     = $PROJECT_ID
   GCP_REGION         = $REGION
   AR_REPO            = $AR_REPO
   WIF_PROVIDER       = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github
   DEPLOY_SA          = $DEPLOY_SA
   RUNTIME_SA         = $RUNTIME_SA
   CLOUDSQL_INSTANCE  = $CONNECTION_NAME

   Sau đó Settings → Environments → tạo dev, test, prod; mỗi env thêm variables:
   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
   FRONTEND_URL (=https://frontend-<env>-$PROJECT_NUMBER.$REGION.run.app),
   MIN_INSTANCES (prod nên = 1)
   → env "prod": bật "Required reviewers" + giới hạn "Deployment tags: v*"
=====================================================================
EOF
