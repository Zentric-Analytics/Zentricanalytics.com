#!/usr/bin/env bash
set -euo pipefail
umask 077

REGION="${AWS_REGION:-us-east-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CONNECTION_NAME="zentric-production-hr-document-scan"
DESTINATION_NAME="zentric-production-hr-document-scan"
RULE_NAME="zentric-production-hr-document-scan-results"
BUCKET="zentric-production-hr-documents-${ACCOUNT_ID}-${REGION}"
DLQ_ARN="arn:aws:sqs:${REGION}:${ACCOUNT_ID}:zentric-production-hr-document-scan-dlq"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/zentric-production-eventbridge-document-scan"
SECRET_FILE="${HOME}/.zentric-production-document-scanner-secret"

if [[ ! -s "${SECRET_FILE}" ]]; then
  openssl rand -hex 32 > "${SECRET_FILE}"
  chmod 600 "${SECRET_FILE}"
fi
SCANNER_SECRET="$(<"${SECRET_FILE}")"

CONNECTION_ARN="$(aws events describe-connection --name "${CONNECTION_NAME}" --region "${REGION}" --query ConnectionArn --output text 2>/dev/null || true)"
if [[ -z "${CONNECTION_ARN}" || "${CONNECTION_ARN}" == "None" ]]; then
  CONNECTION_ARN="$(aws events create-connection \
    --name "${CONNECTION_NAME}" \
    --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer ${SCANNER_SECRET}}" \
    --region "${REGION}" --query ConnectionArn --output text)"
fi

for _ in {1..30}; do
  [[ "$(aws events describe-connection --name "${CONNECTION_NAME}" --region "${REGION}" --query ConnectionState --output text)" == "AUTHORIZED" ]] && break
  sleep 2
done
[[ "$(aws events describe-connection --name "${CONNECTION_NAME}" --region "${REGION}" --query ConnectionState --output text)" == "AUTHORIZED" ]]

DESTINATION_ARN="$(aws events describe-api-destination --name "${DESTINATION_NAME}" --region "${REGION}" --query ApiDestinationArn --output text 2>/dev/null || true)"
if [[ -z "${DESTINATION_ARN}" || "${DESTINATION_ARN}" == "None" ]]; then
  DESTINATION_ARN="$(aws events create-api-destination \
    --name "${DESTINATION_NAME}" \
    --connection-arn "${CONNECTION_ARN}" \
    --invocation-endpoint "https://www.zentricanalytics.com/api/internal/hr/document-scan" \
    --http-method POST --invocation-rate-limit-per-second 5 \
    --region "${REGION}" --query ApiDestinationArn --output text)"
fi

cat > /tmp/zentric-document-scan-event-pattern.json <<JSON
{"source":["aws.guardduty"],"detail-type":["GuardDuty Malware Protection Object Scan Result"],"detail":{"resourceType":["S3_OBJECT"],"s3ObjectDetails":{"bucketName":["${BUCKET}"],"objectKey":[{"prefix":"quarantine/"}]}}}
JSON
aws events put-rule --name "${RULE_NAME}" --event-pattern file:///tmp/zentric-document-scan-event-pattern.json --state ENABLED --region "${REGION}" >/dev/null

cat > /tmp/zentric-document-scan-targets.json <<JSON
[{"Id":"production-document-scan-callback","Arn":"${DESTINATION_ARN}","RoleArn":"${ROLE_ARN}","RetryPolicy":{"MaximumEventAgeInSeconds":3600,"MaximumRetryAttempts":10},"DeadLetterConfig":{"Arn":"${DLQ_ARN}"}}]
JSON
aws events put-targets --rule "${RULE_NAME}" --targets file:///tmp/zentric-document-scan-targets.json --region "${REGION}" >/dev/null

rm -f /tmp/zentric-document-scan-event-pattern.json /tmp/zentric-document-scan-targets.json
unset SCANNER_SECRET
echo "PASS EventBridge document-scan delivery configured; secret retained in a mode-600 CloudShell file for secure Render transfer."
