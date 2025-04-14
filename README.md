node版本: 18.14

## 如何使用
npm config set registry https://registry.npmmirror.com/
npm install pnpm -g
pnpm config set registry https://registry.npmmirror.com/
pnpm install
npm run build

## 如何修改Obs配置
请修改 src/components/Home/ObsData.ts 然后重新执行npm run build

## 如何修改语料
请修改 src/components/Home/languageData.ts 然后重新执行npm run build
如果想从xlsx得到对应json 请尝试执行node parseExcel.js 会生成对应的json 替换src/components/Home/languageData.ts中的json即可
## 本项目需要示例nginx文件供参考
user luotianyou staff;
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # 以你的用户运行
    server {
        listen       8300;
        server_name  localhost;

        # HTTP 重定向到 HTTPS
        return 301 https://$host:8443$request_uri;
    }

    server {
        listen       8443 ssl;
        server_name  localhost;

        # SSL 证书配置
        ssl_certificate      /Users/luotianyou/code/voicePhone/cert.pem;
        ssl_certificate_key  /Users/luotianyou/code/voicePhone/key.pem;

        # SSL 优化参数
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # 静态文件服务配置
        location / {
            root   /Users/luotianyou/code/voicePhone/dist;
            index  index.html;
            try_files $uri $uri/ /index.html;
            add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        }

        # 禁止访问隐藏文件
        location ~ /\. {
            deny all;
        }
    }
}
