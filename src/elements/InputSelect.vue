<template>
    <a-input-group compact>
      <a-input v-model:value="inputValue" style="width: calc(100% - 200px)" />
      <a-tooltip title="More options">
        <a-button @click="handleButtonClick">
          <template #icon><EllipsisOutlined /></template>
        </a-button>
      </a-tooltip>
    </a-input-group>
  </template>
  
  <script setup>
  import { ref, watch } from 'vue';
  import { EllipsisOutlined } from '@ant-design/icons-vue';
  
  // 定义 props
  const props = defineProps({
    value: {
      type: String,
      required: true,
    },
    onButtonClick: {
      type: Function,
      default: () => {}, // 默认值为空函数
    },
  });
  
  // 定义 emits
  const emit = defineEmits(['update:value']);
  
  // 使用 ref 绑定输入框的值
  const inputValue = ref(props.value);
  
  // 监听 props.value 的变化，更新 inputValue
  watch(() => props.value, (newValue) => {
    inputValue.value = newValue;
  });
  
  // 监听 inputValue 的变化，触发 update:value 事件
  watch(inputValue, (newValue) => {
    emit('update:value', newValue);
  });
  
  // 按钮点击事件
  const handleButtonClick = () => {
    console.log('Button clicked');
    props.onButtonClick(); // 调用父组件传入的函数
  };
  </script>