#!/usr/bin/env bash
# ============================================================
# h5sgame 自动热部署脚本
# 触发方式：
#   1) curl -X POST "http://IP:3000/api/deploy?key=MYKEY"
#   2) 在服务器本地执行 bash deploy/deploy.sh
# 作用：
#   1. 从 Git 拉取最新代码
#   2. 安装依赖（若 package.json/package-lock.json 有变化）
#   3. 构建前端 (tsc -b && vite build)
#   4. 通过 systemctl restart h5sgame 零宕机重启 Node（正在进行的连接会被 systemd 平滑接手）
# 日志：../deploy.log
# ============================================================
set -euo pipefail

# 切换到仓库根
cd "$(dirname "$0")/.."

DEPLOY_LOG="$(pwd)/deploy.log"
echo "===== deploy start $(date -Iseconds) =====" > "$DEPLOY_LOG"

# 1. pull
echo "[1/3] git pull origin main" | tee -a "$DEPLOY_LOG"
git fetch --depth=1 origin main 2>&1 | tee -a "$DEPLOY_LOG" || true
OLD_COMMIT=$(git rev-parse HEAD)
git reset --hard origin/main 2>&1 | tee -a "$DEPLOY_LOG" || true
NEW_COMMIT=$(git rev-parse HEAD)
echo "  $OLD_COMMIT -> $NEW_COMMIT" | tee -a "$DEPLOY_LOG"
if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  echo "nothing changed, skip install+build" | tee -a "$DEPLOY_LOG"
else
  # 2. 依赖
  echo "[2/3] npm ci" | tee -a "$DEPLOY_LOG"
  npm ci --no-audit --no-fund 2>&1 | tail -n 50 | tee -a "$DEPLOY_LOG"

  # 3. 构建
  echo "[3/3] npm run build" | tee -a "$DEPLOY_LOG"
  npm run build 2>&1 | tail -n 80 | tee -a "$DEPLOY_LOG"
fi

# 4. 重启 systemd 服务（平滑重启）
echo "[4] systemctl restart h5sgame" | tee -a "$DEPLOY_LOG"
systemctl restart h5sgame 2>&1 | tee -a "$DEPLOY_LOG"

echo "===== deploy done $(date -Iseconds) =====" | tee -a "$DEPLOY_LOG"
