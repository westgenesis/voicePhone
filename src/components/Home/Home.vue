<template>
    <div class="home-container">
        <!-- 语言选择器 -->
        <div class="language-selector" v-show="!showForm">
            <el-select v-model="selectedLanguage" placeholder="Select Language" @change="changeLanguage">
                <el-option v-for="lang in languages" :key="lang.value" :label="lang.label" :value="lang.value" />
            </el-select>
        </div>

        <!-- 表单部分 -->
        <div v-if="showForm" class="user-form">
            <h2>Welcome! Please fill out your information</h2>
            <el-form :model="userInfo" label-width="120px">
                <el-form-item label="Age">
                    <el-input v-model="userInfo.age" type="number" placeholder="Enter your age" />
                </el-form-item>
                <el-form-item label="Gender">
                    <el-select v-model="userInfo.gender" placeholder="Select your gender">
                        <el-option label="Male" value="male" />
                        <el-option label="Female" value="female" />
                        <el-option label="Other" value="other" />
                    </el-select>
                </el-form-item>
                <el-form-item label="Region">
                    <el-input v-model="userInfo.region" placeholder="Enter your region" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="submitForm">Submit</el-button>
                </el-form-item>
            </el-form>
        </div>

        <!-- 正常流程部分 -->
        <div v-else class="content-area">
            <h2>{{ currentLanguage }}</h2>
            <div class="sentence-display">
                <p>{{ currentSentence }}</p>
            </div>
            <div class="volume-indicator" v-if="isRecording">
                <a-progress 
                    :percent="vol"
                    :stroke-color="vol < 20 ? '#ff4d4f' : '#1890ff'"
                    status="active"
                    :show-info="false"
                    stroke-linecap="square"
                />
                <div class="volume-text">Current Volume: {{ vol }}%</div>
            </div>
            <div class="sentence-counter">
                {{ currentIndex + 1 }} / {{ sentences.length }}
            </div>
        </div>

        <!-- 控制按钮 -->
        <div v-if="!showForm" class="control-buttons" style="flex-wrap: nowrap;">
            <a-button @click="prevSentence" :disabled="currentIndex === 0" aria-label="Previous" flex="1">
                <el-icon :size="20">
                    <LeftOutlined />
                </el-icon>
            </a-button>
            <a-button type="primary" @click="toggleRecording" flex="1">
                {{ isRecording ? 'Stop' : 'Start' }} Recording
            </a-button>
            <a-button @click="nextSentence" :disabled="currentIndex === sentences.length - 1" aria-label="Next" flex="1">
                <el-icon :size="20">
                    <RightOutlined />
                </el-icon>
            </a-button>
            <a-button type="primary" @click="uploadRecording" :disabled="!hasRecording" flex="1">Upload</a-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElLoading } from 'element-plus';
import Recorder from 'js-audio-recorder';
import * as transform from 'js-audio-recorder/src/transform/transform';
import * as Player from 'js-audio-recorder/src/player/player';
import { RightOutlined, LeftOutlined } from '@ant-design/icons-vue';
import { http } from '../../http/index.ts';
import languageData from './languageData.ts';

// 录音相关
const sampleRate = ref(16000);
const sampleBit = ref(16);
const numChannel = ref(1);
const compiling = ref(false);
const duration = ref(0);
const fileSize = ref(0);
const vol = ref(0);

// 语言选择
const languages = ref(
    Object.entries(languageData).map(([value, lang]) => ({
        value,
        label: lang.label
    }))
);

// 用户信息表单
const userInfo = ref({
    age: '',
    gender: '',
    region: ''
});

// 是否显示表单
const showForm = ref(false);

// 录音相关
let recorder = null;
let playTimer = null;

// 语言和句子相关
const selectedLanguage = ref(localStorage.getItem('selectedLanguage') || 'en');
const currentLanguage = ref('English');
const sentences = ref<string[]>([]);
const currentIndex = ref(0);
const currentSentence = ref('');
const isRecording = ref(false);
const hasRecording = ref(false);

// 检查是否第一次登录
const checkFirstLogin = () => {
    const isFirstLogin = localStorage.getItem('isFirstLogin');
    if (!isFirstLogin) {
        showForm.value = true;
    }
};

// 提交表单
const submitForm = () => {
    if (!userInfo.value.age || !userInfo.value.gender || !userInfo.value.region) {
        ElMessage.error('Please fill out all fields');
        return;
    }

    // 保存用户信息到 localStorage
    localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
    localStorage.setItem('isFirstLogin', 'false');

    // 隐藏表单
    showForm.value = false;

    // 发送用户信息到服务器（可选）
    // http.post('/user-info', userInfo.value)
    //     .then(() => {
    //         ElMessage.success('User information saved successfully');
    //     })
    //     .catch((error) => {
    //         console.error('Failed to save user information:', error);
    //     });
};

// 更改语言
const changeLanguage = () => {
    const langData = languageData[selectedLanguage.value];
    sentences.value = langData.sentences;
    currentIndex.value = parseInt(localStorage.getItem('currentIndex')) || 0;
    updateCurrentSentence();
    currentLanguage.value = langData.label;
    localStorage.setItem('selectedLanguage', selectedLanguage.value);
};

// 更新当前句子
const updateCurrentSentence = () => {
    currentSentence.value = sentences.value[currentIndex.value] || '';
    localStorage.setItem('currentIndex', currentIndex.value.toString());
};

// 上一句
const prevSentence = () => {
    if (currentIndex.value > 0) {
        currentIndex.value--;
        updateCurrentSentence();
    }
};

// 下一句
const nextSentence = () => {
    if (currentIndex.value < sentences.value.length - 1) {
        currentIndex.value++;
        updateCurrentSentence();
    } else {
        currentIndex.value = 0;
        localStorage.removeItem('currentIndex');
        updateCurrentSentence();
        ElMessage.success('All recordings completed. Rolling back to the first sentence.');
    }
};

// 开始录音
const startRecord = () => {
    const config = {
        sampleBits: sampleBit.value,
        sampleRate: sampleRate.value,
        numChannels: numChannel.value,
        compiling: compiling.value,
    };

    if (!recorder) {
        recorder = new Recorder(config);
        recorder.onprogress = (params) => {
            duration.value = params.duration.toFixed(5);
            fileSize.value = params.fileSize;
            vol.value = params.vol.toFixed(2);
        };
    } else {
        recorder.stop();
    }

    recorder.start().then(() => {
        console.log('开始录音');
    }, (error) => {
        console.log(`异常了,${error.name}:${error.message}`);
    });
};

// 停止录音
const endRecord = () => {
    recorder && recorder.stop();
};

// 切换录音状态
const toggleRecording = () => {
    isRecording.value = !isRecording.value;
    if (!isRecording.value) {
        hasRecording.value = true;
        endRecord();
    } else {
        startRecord();
    }
};

// 上传录音
const uploadWAV = async () => {
    if (!recorder) {
        ElMessage.error('请先录制音频');
        return;
    }

    const formData = new FormData();
    const file = new File([recorder.getWAVBlob()], currentSentence.value + '.wav', { type: 'audio/wav' });
    formData.append('file', file);

    let loadingInstance;
    try {
        loadingInstance = ElLoading.service({ target: '.home-container', text: 'uploading...' });
        const response = await http.post('/upload', formData);
        console.log(response);

        ElMessage.success('Recording uploaded successfully');
        hasRecording.value = false;
    } catch (error) {
        console.error("Upload failed: ", error);
    } finally {
        loadingInstance.close();
    }
};

// 上传录音
const uploadRecording = () => {
    uploadWAV();
};

// 组件挂载时检查是否第一次登录
onMounted(() => {
    checkFirstLogin();
    selectedLanguage.value = localStorage.getItem('selectedLanguage') || 'en';
    currentIndex.value = parseInt(localStorage.getItem('currentIndex')) || 0;
    isRecording.value = localStorage.getItem('isRecording') === 'true';
    hasRecording.value = localStorage.getItem('hasRecording') === 'true';
    changeLanguage();
});

// 组件销毁前保存状态
onBeforeUnmount(() => {
    localStorage.setItem('selectedLanguage', selectedLanguage.value);
    localStorage.setItem('currentIndex', currentIndex.value.toString());
    localStorage.setItem('isRecording', isRecording.value.toString());
    localStorage.setItem('hasRecording', hasRecording.value.toString());
});
</script>

<style scoped lang="less">
.home-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 20px;
    box-sizing: border-box;
}

.language-selector {
    margin-bottom: 20px;
}

.content-area {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
}

.sentence-display {
    font-size: 24px;
    margin-bottom: 20px;
}

.sentence-counter {
    font-size: 18px;
    color: #666;
}

.control-buttons {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
    margin-bottom: 20px;
}

.user-form {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: #f9f9f9;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    h2 {
        margin-bottom: 20px;
        font-size: 24px;
        color: #333;
    }

    .el-form-item {
        margin-bottom: 20px;
    }

    .el-button {
        width: 100%;
    }
}

@media (max-width: 768px) {
    .control-buttons {
        flex-wrap: wrap;
        gap: 10px;
    }

    .control-buttons .el-button {
        flex: 1 0 40%;
    }
}
</style>