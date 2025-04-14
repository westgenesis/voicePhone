<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter();
const account = ref('');
const password = ref('');
const rememberMe = ref(true);

// Hardcoded credentials
const validCredentials = {
  username: 'admin',
  password: '123456'
};

const onSubmitFormData = async () => {
  // Check against hardcoded credentials
  if (account.value === validCredentials.username && password.value === validCredentials.password) {
    // Login success
    window.localStorage.setItem('account', account.value);
    if (rememberMe.value) {
      window.localStorage.setItem('password', password.value);
    } else {
      window.localStorage.removeItem('password');
    }
    
    // Redirect to home
    router.replace('/home');
    ElMessage.success('Login successful');
  } else {
    // Login failed
    ElMessage.error('Login failed, incorrect username or password');
  }
};

// Load saved credentials if they exist
const storedAccount = window.localStorage.getItem('account');
const storedPassword = window.localStorage.getItem('password');
if (storedAccount) {
  account.value = storedAccount;
}
if (storedAccount && storedPassword) {
  password.value = storedPassword;
}
</script>

<template>
  <div class="login-container">
    <div class="login-form">
      <div class="form mt-[32px] min-w-[480px]">
        <div class="title">
          <div class="title-0 m-[16px] flex justify-center">
            <span class="title-welcome one-line-text max-w-[300px]">
              Recording System
            </span>
          </div>
        </div>
        <form class="a-form">
          <div class="login-form-item">
            <el-input
              class="login-input"
              max-length="64"
              v-model="account"
              size="large"
              placeholder="Enter your account"
            />
          </div>
          <div class="login-form-item">
            <el-input
              v-model="password"
              type="password"
              class="login-password-input"
              placeholder="Enter your password"
              size="large"
              @keydown.enter="onSubmitFormData"
            />
          </div>
          <div class="flex">
            <el-checkbox v-model="rememberMe" label="remember password"></el-checkbox>
          </div>
          <div class="mb-[20px] mt-[12px] flex-center">
            <el-button type="button" class="a-button primary large" long @click="onSubmitFormData">
              login
            </el-button>
          </div>
        </form>
        <div class="mt-4 flex items-center justify-center">
          <div class="loginType">
            <svg-icon name="scan_code" width="18px" height="18px" class="text-[rgb(var(--primary-6))]"></svg-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
  .login-container {
    @apply flex h-screen;
  }

  .login-form {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .title-welcome {
    color: rgb(var(--primary-5));
  }

  .form {
    @apply relative bg-white;
    padding: 40px;

    .login-form-item {
      margin-bottom: 28px;
    }
    .mask {
      @apply absolute left-0 top-0 h-full w-full;
    }
    .loginType {
      margin: 0 8px;
      width: 32px;
      height: 32px;
      border: 1px solid var(--color-text-n8);
      border-radius: 50%;
      @apply flex cursor-pointer items-center justify-center;
      .type-text {
        color: rgb(var(--primary-5));
        @apply font-medium;
      }
    }
  }

  .login-input {
    padding-right: 0;
    padding-left: 0;
    width: 100%;
    height: 36px;
  }

  .login-input :deep(.arco-input) {
    padding-right: 10px;
    padding-left: 10px;
  }

  .login-password-input {
    position: relative;
    padding-right: 0;
    padding-left: 0;
    width: 100%;
    height: 36px;
  }

  .login-password-input :deep(.arco-input) {
    padding-right: 50px;
    padding-left: 10px;
  }

  .login-password-input :deep(.arco-input-clear-btn) {
    position: absolute;
    top: 10px;
    float: right;
    margin-left: 350px;
  }

  .login-password-input :deep(.arco-input-suffix) {
    position: absolute;
    top: 10px;
    float: right;
    margin-left: 360px;
  }

  .flex-center {
    display: flex;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .form {
      min-width: 100%;
      padding: 20px;
      .login-form-item {
        margin-bottom: 20px;
      }
      .title-welcome {
        font-size: 18px;
      }
      .login-input, .login-password-input {
        height: 40px;
      }
      .a-button {
        width: 100%;
      }
    }
  }
</style>