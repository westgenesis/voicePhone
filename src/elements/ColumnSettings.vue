<template>
    <div>
        <!-- 设置图标 -->
        <a-button type="link" @click="showModal">
            <setting-outlined />
        </a-button>

        <!-- 弹窗 -->
        <a-modal v-model:visible="visible" title="列配置" @ok="handleOk" @cancel="handleCancel">
            <a-checkbox-group v-model:value="selectedColumns">
                <a-row>
                    <a-col :span="8" v-for="column in allColumns" :key="column.key">
                        <a-checkbox :value="column.key">{{ column.title }}</a-checkbox>
                    </a-col>
                </a-row>
            </a-checkbox-group>
        </a-modal>
    </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { SettingOutlined } from '@ant-design/icons-vue';

const props = defineProps({
    allColumns: Array, // 所有可用的列
    selectedColumns: Array // 当前选中的列
});

const emit = defineEmits(['update:selectedColumns']);

const visible = ref(false);
const selectedColumns = ref([...props.selectedColumns]);

const showModal = () => {
    visible.value = true;
};

const handleOk = () => {
    emit('update:selectedColumns', selectedColumns.value);
    visible.value = false;
};

const handleCancel = () => {
    visible.value = false;
};
</script>