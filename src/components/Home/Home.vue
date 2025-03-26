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
            <div class="sentence-display" @click="showDrawer = true; console.log(111)">
                <p>{{ currentSentence }}</p>
            </div>
            <canvas id="canvas" v-show="!isPaused"></canvas>
            <div class="volume-indicator" v-if="isRecording && !isPaused">
                <a-progress :percent="vol" :stroke-color="vol < 20 ? '#ff4d4f' : '#1890ff'" status="active"
                    :show-info="false" stroke-linecap="square" />
                <div class="volume-text">Current Volume: {{ vol }}%</div>
            </div>
            <div class="sentence-counter">
                {{ currentIndex + 1 }} / {{ sentences.length }}
            </div>
        </div>
        <div v-if="isRecording" class="recording-controls">
            <a-button shape="circle" @click="togglePause" size="large"
                :class="{ 'paused': isPaused }">
                <el-icon :size="20" v-show="!isPaused">
                    <PauseOutlined />
                </el-icon>
                <el-icon :size="20" v-show="isPaused">
                    <CaretRightOutlined />
                </el-icon>
            </a-button>
        </div>
        <!-- 控制按钮 -->
        <div v-if="!showForm" class="control-buttons" style="flex-wrap: nowrap;">
            <a-button @click="prevSentence" :disabled="currentIndex === 0" aria-label="Previous" flex="1">
                <el-icon :size="20">
                    <StepBackwardOutlined />
                </el-icon>
            </a-button>
            <a-button type="primary" @click="toggleRecording" flex="1">
                {{ isRecording ? 'Stop' : 'Start' }} Recording
            </a-button>
            <a-button @click="nextSentence" :disabled="currentIndex === sentences.length - 1" aria-label="Next"
                flex="1">
                <el-icon :size="20">
                    <StepForwardOutlined />
                </el-icon>
            </a-button>
            <a-button type="primary" @click="uploadRecording" :disabled="!hasRecording" flex="1">Upload</a-button>
        </div>

        <!-- 抽屉组件 -->
        <el-drawer title="Select a Sentence" v-model="showDrawer" direction="rtl" size="60%"
            @close="showDrawer = false">
            <div class="drawer-content">
                <ul>
                    <li v-for="(sentence, index) in sentences" :key="index" @click="selectSentence(index)">
                        {{ (index + 1) + '.' + sentence }}
                    </li>
                </ul>
            </div>
        </el-drawer>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElLoading } from 'element-plus';
import Recorder from 'js-audio-recorder';
import * as transform from 'js-audio-recorder/src/transform/transform';
import * as Player from 'js-audio-recorder/src/player/player';
import { StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons-vue';
import { http } from '../../http/index.ts';
import languageData from './languageData.ts';
import { PauseOutlined, CaretRightOutlined, StopOutlined } from '@ant-design/icons-vue';
import { h } from 'vue';
// 添加状态变量
const isPaused = ref(false);

const { encodeWAV } = transform;
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
let oCanvas = null;
let ctx = null;
let drawRecordId = null;
let pCanvas = null;
let pCtx = null;
let drawPlayId = null;

// 语言和句子相关
const selectedLanguage = ref(localStorage.getItem('selectedLanguage') || 'en');
const currentLanguage = ref('English');
const sentences = ref<string[]>([]);
const currentIndex = ref(0);
const currentSentence = ref('');
const isRecording = ref(false);
const hasRecording = ref(false);

// 抽屉显示状态
const showDrawer = ref(false);

// 检查是否第一次登录
const checkFirstLogin = () => {
    const isFirstLogin = localStorage.getItem('isFirstLogin');
    if (!isFirstLogin) {
        showForm.value = true;
    }
};

// 提交表单
const submitForm = async () => {
    if (!userInfo.value.age || !userInfo.value.gender || !userInfo.value.region) {
        ElMessage.error('Please fill out all fields');
        return;
    }

    try {
        // 调用后端接口提交表单数据
        const response = await http.post('/submit-survey/', {
            age: parseInt(userInfo.value.age), // 确保 age 是数字类型
            gender: userInfo.value.gender,
            region: userInfo.value.region
        });

        // 获取返回的 UID
        const uid = response.uid;

        // 保存 UID 到 localStorage
        localStorage.setItem('uid', uid);

        // 保存用户信息到 localStorage
        localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
        localStorage.setItem('isFirstLogin', 'false');

        // 隐藏表单
        showForm.value = false;
    } catch (error) {
        console.error('Failed to save user information:', error);
        ElMessage.error('Failed to save user information');
    }
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
    oCanvas = document.getElementById('canvas');
    ctx = oCanvas.getContext('2d');

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
    config.compiling && (playTimer = setInterval(() => {
        if (!recorder) {
            return;
        }
        let newData = recorder.getNextData();
        if (!newData.length) {
            return;
        }
        let byteLength = newData[0].byteLength;
        let buffer = new ArrayBuffer(newData.length * byteLength);
        let dataView = new DataView(buffer);
        for (let i = 0, iLen = newData.length; i < iLen; ++i) {
            for (let j = 0, jLen = newData[i].byteLength; j < jLen; ++j) {
                dataView.setInt8(i * byteLength + j, newData[i].getInt8(j));
            }
        }
        let a = encodeWAV(dataView, config.sampleRate, config.sampleRate, config.numChannels, config.sampleBits);
        let blob = new Blob([a], { type: 'audio/wav' });
        blob.arrayBuffer().then((arraybuffer) => {
            Player.play(arraybuffer);
        });
    }, 3000));
    drawRecord();
};

const drawRecord = () => {
    drawRecordId = requestAnimationFrame(drawRecord);
    let dataArray = recorder.getRecordAnalyseData();
    let bufferLength = dataArray.length;

    // 清除画布
    ctx.clearRect(0, 0, oCanvas.width, oCanvas.height);

    // 设置渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, oCanvas.height);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, oCanvas.width, oCanvas.height);

    // 设置波形样式
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 创建波形渐变
    const waveGradient = ctx.createLinearGradient(0, 0, oCanvas.width, 0);
    waveGradient.addColorStop(0, '#00b4db');
    waveGradient.addColorStop(0.5, '#0083b0');
    waveGradient.addColorStop(1, '#00b4db');
    ctx.strokeStyle = waveGradient;

    // 绘制波形
    ctx.beginPath();
    let sliceWidth = oCanvas.width * 1.0 / bufferLength;
    let x = 0;
    let centerY = oCanvas.height / 2;

    for (let i = 0; i < bufferLength; i++) {
        let v = dataArray[i] / 128.0;
        let y = v * oCanvas.height / 2;

        // 使用正弦函数使波形更平滑
        let smoothY = centerY + (y - centerY) * Math.sin(Math.PI * i / bufferLength);

        if (i === 0) {
            ctx.moveTo(x, smoothY);
        } else {
            ctx.lineTo(x, smoothY);
        }
        x += sliceWidth;
    }

    ctx.stroke();

    // 添加中心线
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.moveTo(0, centerY);
    ctx.lineTo(oCanvas.width, centerY);
    ctx.stroke();
};
const pauseRecord = () => {
    if (recorder) {
        recorder.pause();
        console.log('暂停录音');
        drawRecordId && cancelAnimationFrame(drawRecordId);
        drawRecordId = null;
    }
};

const resumeRecord = () => {
    recorder && recorder.resume();
    console.log('恢复录音');
    drawRecord();
};
const togglePause = () => {

  if (isPaused.value) {
    resumeRecord();
  } else {
    pauseRecord();
  }
  isPaused.value = !isPaused.value;
}
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
        isPaused.value = false;
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
    const info = {
        uid: localStorage.getItem('uid')
    }
    formData.append('info', JSON.stringify(info));

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

// 选择句子
const selectSentence = (index: number) => {
    currentIndex.value = index;
    updateCurrentSentence();
    showDrawer.value = false;
};

// 组件挂载时检查是否第一次登录
onMounted(() => {
    checkFirstLogin();
    selectedLanguage.value = localStorage.getItem('selectedLanguage') || 'en';
    currentIndex.value = parseInt(localStorage.getItem('currentIndex')) || 0;
    isRecording.value = localStorage.getItem('isRecording') === 'true';
    changeLanguage();
});

// 组件销毁前保存状态
onBeforeUnmount(() => {
    localStorage.setItem('selectedLanguage', selectedLanguage.value);
    localStorage.setItem('currentIndex', currentIndex.value.toString());
    localStorage.setItem('isRecording', isRecording.value.toString());
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
    margin-top: 2rem;
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
    cursor: pointer;
    /* 添加鼠标指针样式 */
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

.drawer-content {
    ul {
        list-style-type: none;
        padding: 0;
        margin: 0;

        li {
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #ddd;

            &:hover {
                background-color: #f0f0f0;
            }
        }
    }
}

.recording-controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease-in-out;

  .pause-button, .stop-button {
    width: 60px;
    height: 60px;
    transition: all 0.3s ease;
    
    &:hover {
      transform: scale(1.1);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }

  .pause-button {
    &.paused {
      background-color: #52c41a; // 播放状态变为绿色
    }
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.recording-controls .pause-button:not(.paused) {
  animation: pulse 2s infinite;
}
</style>