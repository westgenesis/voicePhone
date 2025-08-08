#!/bin/bash
set -e

REMOTE="origin"
BRANCH="main"

echo "🔀 切换到 ${BRANCH} 分支..."
git checkout $BRANCH

echo "🔄 从 ${REMOTE}/${BRANCH} 拉取最新代码..."
git pull $REMOTE $BRANCH

echo "⬇️ 拉取最新镜像..."
docker-compose pull

echo "🐳 构建并启动容器..."
docker-compose up -d --build

echo "✅ 部署完成。"