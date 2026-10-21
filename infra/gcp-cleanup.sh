#!/usr/bin/env bash
# Xoá tài nguyên tốn tiền sau khi học xong (Cloud SQL là thứ tốn nhất, tính tiền theo giờ kể cả khi không dùng).
# Dùng:  PROJECT_ID=my-proj bash infra/gcp-cleanup.sh
set -uo pipefail

: "${PROJECT_ID:?Cần PROJECT_ID}"
REGION="${REGION:-asia-southeast1}"
gcloud config set project "$PROJECT_ID"

for ENV in dev test prod; do
  gcloud run services delete "backend-$ENV"  --region "$REGION" --quiet
  gcloud run services delete "frontend-$ENV" --region "$REGION" --quiet
  gcloud run jobs delete "backend-migrate-$ENV" --region "$REGION" --quiet
done

gcloud sql instances delete "${SQL_INSTANCE:-cicd-postgres}" --quiet
gcloud artifacts repositories delete "${AR_REPO:-cicd-images}" --location "$REGION" --quiet

echo "Đã xoá Cloud Run, Cloud SQL, Artifact Registry. (Secret/Service account/WIF gần như miễn phí — giữ lại hoặc xoá tay.)"
echo "Cách chắc chắn nhất để hết tốn tiền: gcloud projects delete $PROJECT_ID"
