import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建 Axios 实例
const http = axios.create({
  baseURL: 'https://183.66.251.10:60080', // 设置基本的请求 URL
  timeout: 60000 // 设置请求超时时间
})

// 请求拦截器
http.interceptors.request.use(
  (config) => {
    // 在发送请求之前做一些处理，例如添加请求头、身份验证等
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token
    }

    // 删除请求参数中的下划线开头的参数
    ;[config.params, config.data].forEach((params) => {
      for (const p in params) {
        if (p.startsWith('_')) {
          delete params[p]
        }
      }
    })
    return config
  },
  (error) => {
    // 处理请求错误
    return Promise.reject(error)
  }
)

// 响应拦截器
http.interceptors.response.use(
  (response) => {
    // 对响应数据进行处理，例如解析数据、错误处理等

    if (response.data?.err_msg || response.data?.error || response.data?.error_msg) {
      ElMessage.error(response.data?.err_msg || response.data?.error || response.data?.error_msg)
    }
    if (response.data?.status === 'error' && response.data.message) {
      ElMessage.error(response.data.message);
    } else if (response.data?.status === 'success' && response.data.message) {
      ElMessage.success(response.data.message);
    } else if (response.data?.status === 'ok' && response.data.message) {
      ElMessage.success(response.data.message);
    }
    if (response.status === 500) {
      ElMessage.error(response.data.message)
      return Promise.reject(response)
    }
    return response.data
  },
  (error) => {
    const response = error.response;
    if (response.data?.err_msg || response.data?.error || response.data?.error_msg) {
      ElMessage.error(response.data?.err_msg || response.data?.error || response.data?.error_msg)
    }
    if (error?.response?.data?.detail) {
      ElMessage.error(error?.response?.data?.detail)
    }
    if (error.response.status === 401) {
      ElMessage.error('未授权，请重新登录')
      window.location.href = '#/login'
    }
    // 处理响应错误
    return Promise.reject(error)
  }
)

export { http }
