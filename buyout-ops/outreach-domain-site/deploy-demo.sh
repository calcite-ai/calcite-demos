#!/usr/bin/env bash
# Upload demo/ redirects to calcite-mail.jp (short URLs + click log).
#
# Setup:
#   cp deploy-demo.env.example deploy-demo.env
#   # ConoHa WING → サーバー管理 → 契約情報 → メール/FTP/ネームサーバー情報
#   # FTP_HOST / FTP_USER / FTP_PASSWORD を deploy-demo.env に記入
#
# Usage:
#   ./deploy-demo.sh
#   ./deploy-demo.sh --dry-run
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${DEPLOY_ENV:-$ROOT/deploy-demo.env}"
LOCAL="$ROOT/demo"
DRY="${1:-}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy deploy-demo.env.example and fill FTP values."
  exit 1
fi
# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

: "${FTP_HOST:?FTP_HOST required}"
: "${FTP_USER:?FTP_USER required}"
: "${FTP_PASSWORD:?FTP_PASSWORD required}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-/public_html/calcite-mail.jp}"

if [[ ! -d "$LOCAL" ]]; then
  echo "Run: node buyout-ops/generate-demo-redirects.mjs"
  exit 1
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp が必要です: brew install lftp"
  exit 1
fi

REMOTE="${FTP_REMOTE_DIR%/}/demo"
echo "Uploading $LOCAL -> $FTP_HOST:$REMOTE"

if [[ "$DRY" == "--dry-run" ]]; then
  echo "(dry-run: would mirror demo/ to $REMOTE)"
  exit 0
fi

lftp -u "$FTP_USER","$FTP_PASSWORD" "ftp://$FTP_HOST" <<EOF
set ftp:ssl-allow no
set ssl:verify-certificate no
mirror -R --verbose --parallel=4 --exclude-glob .DS_Store "$LOCAL" "$REMOTE"
bye
EOF

echo "Done. Test: curl -sI https://www.calcite-mail.jp/demo/suto-kensetsu/b-atelier/ | head -3"
