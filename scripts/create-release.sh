#!/bin/bash
# CNB Release 创建与制品上传脚本
# 使用 CNB API 创建 Release 并上传桌面端构建产物
#
# 所需环境变量（由 CNB 流水线自动注入）：
#   CNB_TOKEN        - API 认证令牌
#   CNB_API_ENDPOINT - API 地址，默认 https://api.cnb.cool
#   CNB_REPO_SLUG    - 仓库标识，如 rich/public/mcp-tools-debugger
#   CNB_TAG          - 当前 tag 名称

set -euo pipefail

API_ENDPOINT="${CNB_API_ENDPOINT:-https://api.cnb.cool}"
REPO="${CNB_REPO_SLUG}"
TAG="${CNB_TAG}"

if [ -z "${TAG:-}" ]; then
  echo "ERROR: CNB_TAG is not set. This script should only run on tag push events."
  exit 1
fi

# 从 tag 提取版本号（去掉 v 前缀）
VERSION="${TAG#v}"
RELEASE_NAME="v${VERSION}"

ARTIFACT_DIR="desktop-artifacts"
if [ ! -d "$ARTIFACT_DIR" ]; then
  echo "ERROR: Artifact directory '$ARTIFACT_DIR' not found."
  exit 1
fi

echo "=== Creating Release: $RELEASE_NAME ==="

# 1. 创建 Release（如果已存在则跳过）
RELEASE_RESPONSE=$(curl -s -w '\n%{http_code}' -X POST \
  "${API_ENDPOINT}/${REPO}/-/releases" \
  -H "Accept: application/vnd.cnb.api+json" \
  -H "Authorization: Bearer ${CNB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "tag_name": "${TAG}",
  "name": "${RELEASE_NAME}",
  "body": "Desktop builds for ${RELEASE_NAME}",
  "draft": false,
  "prerelease": false,
  "make_latest": "true"
}
EOF
)")

HTTP_CODE=$(echo "$RELEASE_RESPONSE" | tail -1)
RELEASE_BODY=$(echo "$RELEASE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "409" ]; then
  echo "Release already exists for tag ${TAG}, fetching existing release..."
  RELEASE_RESPONSE=$(curl -s -w '\n%{http_code}' -X GET \
    "${API_ENDPOINT}/${REPO}/-/releases/tags/${TAG}" \
    -H "Accept: application/vnd.cnb.api+json" \
    -H "Authorization: Bearer ${CNB_TOKEN}")
  HTTP_CODE=$(echo "$RELEASE_RESPONSE" | tail -1)
  RELEASE_BODY=$(echo "$RELEASE_RESPONSE" | sed '$d')
fi

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "ERROR: Failed to create/fetch release. HTTP $HTTP_CODE"
  echo "$RELEASE_BODY"
  exit 1
fi

RELEASE_ID=$(echo "$RELEASE_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "${RELEASE_ID:-}" ]; then
  echo "ERROR: Could not extract release ID from response."
  echo "$RELEASE_BODY"
  exit 1
fi

echo "Release ID: $RELEASE_ID"

# 2. 上传每个制品文件
upload_asset() {
  local file_path="$1"
  local file_name
  file_name="$(basename "$file_path")"
  local file_size
  file_size="$(stat -c%s "$file_path" 2>/dev/null || stat -f%z "$file_path" 2>/dev/null)"

  echo "--- Uploading: $file_name ($file_size bytes) ---"

  # 2a. 获取上传 URL
  local upload_response
  upload_response=$(curl -s -w '\n%{http_code}' -X POST \
    "${API_ENDPOINT}/${REPO}/-/releases/${RELEASE_ID}/asset-upload-url" \
    -H "Accept: application/vnd.cnb.api+json" \
    -H "Authorization: Bearer ${CNB_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(cat <<EOF
{
  "asset_name": "${file_name}",
  "overwrite": true,
  "size": ${file_size}
}
EOF
)")

  local upload_http_code
  upload_http_code=$(echo "$upload_response" | tail -1)
  local upload_body
  upload_body=$(echo "$upload_response" | sed '$d')

  if [ "$upload_http_code" != "200" ] && [ "$upload_http_code" != "201" ]; then
    echo "ERROR: Failed to get upload URL for $file_name. HTTP $upload_http_code"
    echo "$upload_body"
    return 1
  fi

  local upload_url
  upload_url=$(echo "$upload_body" | grep -o '"upload_url":"[^"]*"' | cut -d'"' -f4)
  local verify_url
  verify_url=$(echo "$upload_body" | grep -o '"verify_url":"[^"]*"' | cut -d'"' -f4)

  if [ -z "${upload_url:-}" ]; then
    echo "ERROR: Could not extract upload_url from response."
    echo "$upload_body"
    return 1
  fi

  # 2b. PUT 上传文件
  local put_http_code
  put_http_code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT \
    "$upload_url" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$file_path")

  if [ "$put_http_code" != "200" ] && [ "$put_http_code" != "201" ]; then
    echo "ERROR: File upload failed for $file_name. HTTP $put_http_code"
    return 1
  fi

  echo "File uploaded successfully: $file_name"

  # 2c. 确认上传（如果 verify_url 存在）
  if [ -n "${verify_url:-}" ]; then
    local confirm_http_code
    confirm_http_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
      "$verify_url" \
      -H "Accept: application/vnd.cnb.api+json" \
      -H "Authorization: Bearer ${CNB_TOKEN}")

    if [ "$confirm_http_code" != "200" ] && [ "$confirm_http_code" != "201" ] && [ "$confirm_http_code" != "204" ]; then
      echo "WARNING: Upload confirmation returned HTTP $confirm_http_code for $file_name"
    else
      echo "Upload confirmed: $file_name"
    fi
  fi
}

# 遍历上传所有制品
FAILED=0
for file in "$ARTIFACT_DIR"/*; do
  if [ -f "$file" ]; then
    if ! upload_asset "$file"; then
      FAILED=1
    fi
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "WARNING: Some assets failed to upload."
  exit 1
fi

echo "=== All assets uploaded to release $RELEASE_NAME ==="
