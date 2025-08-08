# ========== 构建阶段 ==========
FROM node:18-alpine AS build

# 设置工作目录
WORKDIR /app

# 安装 pnpm（推荐全局安装）
RUN npm install -g pnpm

# 拷贝依赖文件并安装依赖
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 拷贝源码并构建
COPY . .
RUN pnpm run build

# ========== 运行阶段 ==========
FROM nginx:alpine

# 删除默认 nginx 静态资源
RUN rm -rf /usr/share/nginx/html/*

# 拷贝构建产物到 nginx 目录
COPY --from=build /app/dist /usr/share/nginx/html

# 暴露端口（默认80）
EXPOSE 80 443

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]