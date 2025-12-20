#!/bin/bash
set -e  # Stop script if any command fails

# --- CONFIGURATION ---
REGION="us-west-2"
REPO_NAME="mix-ai-email"
LAMBDA_NAME="mix-ai-email"
IMAGE_TAG="latest"

# 1. Get Account ID dynamically
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
FULL_IMAGE="${ECR_URI}/${REPO_NAME}:${IMAGE_TAG}"

echo "🐘 Deploying to AWS Account: ${ACCOUNT_ID}..."

# 2. Login to ECR
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# 3. Create Repo if it doesn't exist (The "Smart" Step)
echo "Checking ECR Repository..."
aws ecr describe-repositories --repository-names ${REPO_NAME} --region ${REGION} > /dev/null 2>&1 || \
    aws ecr create-repository --repository-name ${REPO_NAME} --region ${REGION}

# 4. Build (Force AMD64 for Lambda compatibility and disable provenance for Lambda)
echo "🔨 Building Image..."
docker build --provenance=false --platform linux/amd64 -t ${REPO_NAME} .

# 5. Tag & Push
echo "🚀 Pushing to ECR..."
docker tag ${REPO_NAME}:${IMAGE_TAG} ${FULL_IMAGE}
docker push ${FULL_IMAGE}

# 6. Update Lambda Code
echo "Updating Lambda Function..."
# This command fails if the function doesn't exist yet, which is fine for the first run
aws lambda update-function-code \
    --function-name ${LAMBDA_NAME} \
    --image-uri ${FULL_IMAGE} \
    --region ${REGION} > /dev/null && echo "Lambda Updated!" || echo "Lambda '${LAMBDA_NAME}' not found. Please create it in the Console and select this image."