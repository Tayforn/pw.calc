#!/bin/bash
set -e

# ─── CONFIG (змінити під себе) ───
PROJECT_ID="cyber-thunder-bank"
REGION="europe-west1"
SERVICE_NAME="pw-calc"

# ─── 1. Увімкнути потрібні API ───
echo ">>> Вмикаю API..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

# ─── 2. Створити Artifact Registry репо (якщо немає) ───
echo ">>> Створюю Artifact Registry репо..."
gcloud artifacts repositories create "${SERVICE_NAME}" \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  2>/dev/null || echo "Репо вже існує"

# ─── 3. Збілдити і запушити образ ───
echo ">>> Білдю Docker образ в Cloud Build..."
gcloud builds submit \
  --tag "${IMAGE}" \
  --project="${PROJECT_ID}"

# ─── 4. Задеплоїти на Cloud Run ───
echo ">>> Деплою на Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --allow-unauthenticated \
  --memory=128Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=2

echo ""
echo ">>> Готово! URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)"
