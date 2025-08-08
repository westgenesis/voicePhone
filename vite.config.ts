import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import nodePolyfills from "vite-plugin-node-stdlib-browser";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import vueJsx from "@vitejs/plugin-vue-jsx";
import cdnImport from "vite-plugin-cdn-import";
import fs from "fs";

export default defineConfig({
  plugins: [vue(), vueJsx(), nodePolyfills()],
  resolve: {
    alias: {
      "@stores": path.resolve(__dirname, "src/stores"),
      "@components": path.resolve(__dirname, "src/components"),
      "@http": path.resolve(__dirname, "http"),
    },
  },
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "cert/key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "cert/cert.pem")),
    },
    port: 9200,
    proxy: {},
  },
  optimizeDeps: {
    include: ["vue", "vue-router"], // 明确指定要预构建的依赖，减少内存占用
  },
});
