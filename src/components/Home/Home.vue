<template>
    <div class="home-container">
        <!-- Language Selector -->


        <!-- User Form -->
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

        <!-- Main Content -->
        <div v-else class="content-area">
            <div class="language-selector" v-show="!showForm">
                <el-select v-model="selectedLanguage" placeholder="Select Language" @change="changeLanguage"
                    style="width: 200px">
                    <el-option v-for="lang in languages" :key="lang.value" :label="lang.label" :value="lang.value" />
                </el-select>
            </div>
            <h2 class="language-title">{{ currentLanguage }}</h2>

            <!-- Sentence Display -->
            <div class="sentence-display" @click="showDrawer = true">
                <p>
                    <el-icon v-if="isSentenceUploaded(currentSentence)" color="#67C23A" :size="24">
                        <CheckOutlined />
                    </el-icon>
                    {{ currentSentence.name }}
                </p>
                <p class="chinese-text">{{ currentSentence.chinese }}</p>
            </div>

            <!-- Visualizer -->
            <div class="visualizer-container">
                <canvas id="canvas" v-show="!isPaused"></canvas>
                <div class="volume-indicator" v-if="isRecording && !isPaused">
                    <a-progress :percent="vol" :stroke-color="vol < 20 ? '#ff4d4f' : '#1890ff'" status="active"
                        :show-info="false" stroke-linecap="square" />
                    <div class="volume-text">Current Volume: {{ vol }}%</div>
                </div>
            </div>

            <!-- Sentence Counter -->
            <div class="sentence-counter">
                {{ currentIndex + 1 }} / {{ sentences.length }}
            </div>

            <!-- Recording Controls -->
            <div v-if="isRecording" class="recording-controls">
                <a-button shape="circle" @click="togglePause" size="large" :class="{ 'paused': isPaused }">
                    <el-icon :size="20" v-show="!isPaused">
                        <PauseOutlined />
                    </el-icon>
                    <el-icon :size="20" v-show="isPaused">
                        <CaretRightOutlined />
                    </el-icon>
                </a-button>
            </div>
            <div class="nav-buttons">
                <a-button @click="prevSentence" :disabled="currentIndex === 0" aria-label="Previous">
                    <el-icon :size="20">
                        <StepBackwardOutlined />
                    </el-icon>
                </a-button>
                <a-button type="primary" @click="toggleRecording">
                    {{ isRecording ? 'Stop' : 'Start' }} Recording
                </a-button>
                <a-button @click="nextSentence" :disabled="currentIndex === sentences.length - 1" aria-label="Next">
                    <el-icon :size="20">
                        <StepForwardOutlined />
                    </el-icon>
                </a-button>
            </div>

            <!-- Navigation Controls -->
            <div class="control-grid">


                <div class="action-buttons">
                    <a-button type="primary" @click="playRecord" :disabled="!hasRecording">Play</a-button>
                    <a-button type="primary" @click="uploadRecording" :disabled="!hasRecording">Upload</a-button>
                </div>
            </div>
        </div>

        <!-- Sentence Drawer -->
        <el-drawer title="Select a Sentence" v-model="showDrawer" direction="rtl" size="60%"
            @close="showDrawer = false">
            <div class="drawer-content" ref="drawerContentRef">
                <ul>
                    <li v-for="(sentence, index) in sentences" :key="index" @click="selectSentence(index)">
                        <el-icon v-if="isSentenceUploaded(sentence)" color="#67C23A" :size="18"
                            style="margin-right: 1rem">
                            <CheckOutlined />
                        </el-icon>
                        {{ (index + 1) + '.' + sentence.name }}
                        <span class="drawer-chinese">{{ sentence.chinese }}</span>
                    </li>
                </ul>
            </div>
        </el-drawer>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { ElMessage, ElLoading } from 'element-plus';
import Recorder from 'js-audio-recorder';
import * as transform from 'js-audio-recorder/src/transform/transform';
import * as Player from 'js-audio-recorder/src/player/player';
import { StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons-vue';
import { http } from '../../http/index.ts';
import languageData from './languageData.ts';
import { PauseOutlined, CaretRightOutlined, CheckOutlined } from '@ant-design/icons-vue';
import { nextTick } from 'vue';
import ObsClient from 'esdk-obs-browserjs';

// Initialize OBS client
const obsClient = new ObsClient({
    access_key_id: 'HPUAEPSJ6KCFXW4HQF4J',
    secret_access_key: '0kqNogkeU5KmiOl5mWxI8FPGNDlENUERESUaq3jK',
    server: 'https://obs.cn-north-4.myhuaweicloud.com'
});

// State variables
const isPaused = ref(false);
const { encodeWAV } = transform;

// Audio recording settings
const sampleRate = ref(16000);
const sampleBit = ref(16);
const numChannel = ref(1);
const compiling = ref(false);
const duration = ref(0);
const fileSize = ref(0);
const vol = ref(0);

// Language selection
const languages = ref(
    Object.entries(languageData).map(([value, lang]) => ({
        value,
        label: lang.label
    }))
);

// User information form
const userInfo = ref({
    age: '',
    gender: '',
    region: ''
});
const showForm = ref(false);

// Recording related
let recorder: any = null;
let playTimer: any = null;
let oCanvas: any = null;
let ctx: any = null;
let drawRecordId: any = null;

// Language and sentences
const selectedLanguage = ref(localStorage.getItem('selectedLanguage') || 'en');
const currentLanguage = ref('English');
const sentences = ref<{ name: string, chinese: string }[]>([]);
const currentIndex = ref(0);
const currentSentence = ref<{ name: string, chinese: string }>({ name: '', chinese: '' });
const isRecording = ref(false);
const hasRecording = ref(false);
const showDrawer = ref(false);
const uploadedSentences = ref<{ name: string, chinese: string }[]>([]);

// Check first login
const checkFirstLogin = () => {
    const isFirstLogin = localStorage.getItem('isFirstLogin');
    if (!isFirstLogin) {
        showForm.value = true;
    }
};

// Submit user form
const submitForm = async () => {
    if (!userInfo.value.age || !userInfo.value.gender || !userInfo.value.region) {
        ElMessage.error('Please fill out all fields');
        return;
    }

    try {
        const response = await http.post('/submit-survey/', {
            age: parseInt(userInfo.value.age),
            gender: userInfo.value.gender,
            region: userInfo.value.region
        });

        const uid = response.uid;
        localStorage.setItem('uid', uid);
        localStorage.setItem('userInfo', JSON.stringify(userInfo.value));
        localStorage.setItem('isFirstLogin', 'false');
        showForm.value = false;
    } catch (error) {
        console.error('Failed to save user information:', error);
        ElMessage.error('Failed to save user information');
    }
};

// Change language
const changeLanguage = () => {
    const langData = languageData[selectedLanguage.value];
    if (!langData) {
        console.error('Selected language not found in languageData');
        return;
    }
    sentences.value = langData.sentences;
    currentIndex.value = parseInt(localStorage.getItem('currentIndex') || '0');
    updateCurrentSentence();
    currentLanguage.value = langData.label;
    localStorage.setItem('selectedLanguage', selectedLanguage.value);
};

// Update current sentence
const updateCurrentSentence = () => {
    currentSentence.value = sentences.value[currentIndex.value] || { name: '', chinese: '' };
    localStorage.setItem('currentIndex', currentIndex.value.toString());
};

// Navigation between sentences
const prevSentence = () => {
    if (currentIndex.value > 0) {
        currentIndex.value--;
        updateCurrentSentence();
    }
};

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

// Check if sentence is uploaded
const isSentenceUploaded = (sentence: { name: string, chinese: string }) => {
    return uploadedSentences.value.some(s => s.name === sentence.name && s.chinese === sentence.chinese);
};

// Generate OBS file path
const generateObsFilePath = (sentence: { name: string, chinese: string }) => {
    const now = new Date();
    const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].join('');

    const languageName = languageData[selectedLanguage.value]?.label || 'unknown';

    const escapeSpecialChars = (str: string) => {
        return str.replace(/[<>:"/\\|?*]/g, (char) => {
            switch (char) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case ':': return '&colon;';
                case '"': return '&quot;';
                case '/': return '&sol;';
                case '\\': return '&bsol;';
                case '|': return '&vert;';
                case '?': return '&quest;';
                case '*': return '&ast;';
                default: return char;
            }
        });
    };

    const cleanName = escapeSpecialChars(sentence.name);
    const cleanChinese = escapeSpecialChars(sentence.chinese);

    return `voiceEchoPC/${languageName}/${cleanChinese}/${timestamp}-${cleanChinese}-${cleanName}.wav`;
};

// Upload recording to OBS
const uploadRecording = async () => {
    if (!recorder) {
        ElMessage.error('请先录制音频');
        return;
    }

    const loadingInstance = ElLoading.service({
        target: '.home-container',
        text: '正在上传到OBS...'
    });

    try {
        const blob = recorder.getWAVBlob();
        const fileName = generateObsFilePath(currentSentence.value);
        const arrayBuffer = await blob.arrayBuffer();

        const result = await obsClient.putObject({
            Bucket: 'echo-wav',
            Key: fileName,
            Body: arrayBuffer,
            ContentType: 'audio/wav'
        });

        if (result.CommonMsg.Status < 300) {
            ElMessage.success(`音频已成功上传`);
            hasRecording.value = false;
            uploadedSentences.value.push(currentSentence.value);
        } else {
            throw new Error(result.CommonMsg.Message || '上传失败');
        }
    } catch (error) {
        console.error("OBS上传失败: ", error);
        ElMessage.error(`上传失败: ${error.message}`);
    } finally {
        loadingInstance.close();
    }
};

// Recording controls
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
        recorder.onprogress = (params: any) => {
            duration.value = params.duration.toFixed(5);
            fileSize.value = params.fileSize;
            vol.value = params.vol.toFixed(2);
        };
    } else {
        recorder.stop();
    }

    recorder.start().then(() => {
        console.log('开始录音');
    }, (error: any) => {
        console.log(`异常了,${error.name}:${error.message}`);
    });

    if (config.compiling) {
        playTimer = setInterval(() => {
            if (!recorder) return;
            let newData = recorder.getNextData();
            if (!newData.length) return;

            let byteLength = newData[0].byteLength;
            let buffer = new ArrayBuffer(newData.length * byteLength);
            let dataView = new DataView(buffer);

            for (let i = 0, iLen = newData.length; i < iLen; ++i) {
                for (let j = 0, jLen = newData[i].byteLength; j < jLen; ++j) {
                    dataView.setInt8(i * byteLength + j, newData[i].getInt8(j));
                }
            }

            let a = encodeWAV(dataView, config.sampleRate, config.sampleRate,
                config.numChannels, config.sampleBits);
            let blob = new Blob([a], { type: 'audio/wav' });
            blob.arrayBuffer().then((arraybuffer) => {
                Player.play(arraybuffer);
            });
        }, 3000);
    }

    drawRecord();
};

const drawRecord = () => {
    drawRecordId = requestAnimationFrame(drawRecord);
    let dataArray = recorder.getRecordAnalyseData();
    let bufferLength = dataArray.length;

    ctx.clearRect(0, 0, oCanvas.width, oCanvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, oCanvas.height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, oCanvas.width, oCanvas.height);

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const waveGradient = ctx.createLinearGradient(0, 0, oCanvas.width, 0);
    waveGradient.addColorStop(0, '#00b4db');
    waveGradient.addColorStop(0.5, '#0083b0');
    waveGradient.addColorStop(1, '#00b4db');
    ctx.strokeStyle = waveGradient;

    ctx.beginPath();
    let sliceWidth = oCanvas.width * 1.0 / bufferLength;
    let x = 0;
    let centerY = oCanvas.height / 2;

    for (let i = 0; i < bufferLength; i++) {
        let v = dataArray[i] / 128.0;
        let y = v * oCanvas.height / 2;
        let smoothY = centerY + (y - centerY) * Math.sin(Math.PI * i / bufferLength);

        if (i === 0) {
            ctx.moveTo(x, smoothY);
        } else {
            ctx.lineTo(x, smoothY);
        }
        x += sliceWidth;
    }

    ctx.stroke();

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
};

const endRecord = () => {
    recorder && recorder.stop();
};

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

const playRecord = () => {
    recorder && recorder.play();
};

// Sentence selection
const selectSentence = (index: number) => {
    currentIndex.value = index;
    updateCurrentSentence();
    showDrawer.value = false;
};

// Lifecycle hooks
onMounted(() => {
    selectedLanguage.value = localStorage.getItem('selectedLanguage') || 'en';
    currentIndex.value = parseInt(localStorage.getItem('currentIndex')) || 0;
    changeLanguage();
});

onBeforeUnmount(() => {
    localStorage.setItem('selectedLanguage', selectedLanguage.value);
    localStorage.setItem('currentIndex', currentIndex.value.toString());
    localStorage.setItem('isRecording', isRecording.value.toString());

    if (playTimer) clearInterval(playTimer);
    if (drawRecordId) cancelAnimationFrame(drawRecordId);
});

// Drawer scroll to current sentence
const drawerContentRef = ref<HTMLElement | null>(null);

const scrollToCurrentSentence = async () => {
    await nextTick();
    if (drawerContentRef.value) {
        const items = drawerContentRef.value.querySelectorAll('li');
        if (items.length > currentIndex.value) {
            items[currentIndex.value].scrollIntoView({
                block: 'center'
            });
        }
    }
};

watch(showDrawer, (newVal) => {
    if (newVal) {
        scrollToCurrentSentence();
    }
});
</script>

<style scoped lang="less">
.home-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 0.5rem;
    box-sizing: border-box;
    max-width: 100%;
    margin: 0 auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;

    @media (min-width: 768px) {
        padding: 2rem;
        max-width: 1200px;
    }
}

.language-selector {
    align-self: flex-end;
    margin-bottom: 0.5rem;
    
    @media (max-width: 767px) {
        margin-bottom: 0.25rem;
        
        .el-select {
            width: 150px !important;
        }
    }
}

.content-area {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 0 0.5rem;
    gap: 1rem;

    @media (min-width: 768px) {
        gap: 2rem;
        max-width: 800px;
        padding: 0 1rem;
    }
}

.language-title {
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
    color: var(--el-color-primary);
    word-break: break-word;

    @media (min-width: 768px) {
        font-size: 2rem;
        margin-bottom: 1.5rem;
    }
}

.sentence-display {
    font-size: 1rem;
    margin-bottom: 0.75rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    max-width: 100%;
    word-break: break-word;
    padding: 0 0.5rem;

    p {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        line-height: 1.4;
    }

    .chinese-text {
        font-size: 0.875rem;
        color: var(--el-text-color-secondary);
        margin-top: 0.25rem;
    }

    @media (min-width: 768px) {
        font-size: 1.5rem;
        max-width: 600px;

        .chinese-text {
            font-size: 1.1rem;
        }
    }
}

.visualizer-container {
    width: 100%;
    max-width: 100%;
    margin-bottom: 0.75rem;
    padding: 0 0.5rem;

    #canvas {
        width: 100%;
        height: 100px;
        border-radius: 8px;
        background: linear-gradient(to bottom, #f5f7fa, #e4e7eb);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .volume-indicator {
        margin-top: 0.5rem;
        width: 100%;

        .volume-text {
            font-size: 0.75rem;
            color: var(--el-text-color-secondary);
            margin-top: 0.25rem;
        }
    }

    @media (min-width: 768px) {
        max-width: 600px;
        #canvas {
            height: 150px;
        }
    }
}

.sentence-counter {
    font-size: 0.875rem;
    color: var(--el-text-color-secondary);
    margin-bottom: 0.75rem;

    @media (min-width: 768px) {
        font-size: 1.1rem;
    }
}

.nav-buttons {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    max-width: 100%;
    padding: 0 0.5rem;

    button {
        min-width: 40px;
        height: 40px;
        font-size: 0.875rem;
    }

    @media (min-width: 768px) {
        gap: 1rem;
        max-width: 600px;

        button {
            height: 48px;
            font-size: 1rem;
        }
    }
}

.action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
    max-width: 100%;
    padding: 0 0.5rem;

    button {
        height: 40px;
        font-size: 0.875rem;
    }

    @media (min-width: 768px) {
        gap: 1rem;
        max-width: 600px;

        button {
            height: 48px;
            font-size: 1rem;
        }
    }
}

.recording-controls {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;

    button {
        width: 50px;
        height: 50px;
        transition: all 0.3s ease;

        &:hover {
            transform: scale(1.05);
        }

        &:active {
            transform: scale(0.95);
        }

        &.paused {
            background-color: var(--el-color-success);
        }
    }

    @media (min-width: 768px) {
        margin-top: 1rem;
        button {
            width: 70px;
            height: 70px;
        }
    }
}

.user-form {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 1rem;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background-color: var(--el-bg-color);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    h2 {
        margin-bottom: 1rem;
        font-size: 1.25rem;
        color: var(--el-text-color-primary);
        text-align: center;
    }

    .el-form-item {
        margin-bottom: 1rem;
    }

    .el-button {
        width: 100%;
        margin-top: 0.5rem;
    }

    @media (min-width: 768px) {
        max-width: 500px;
        padding: 2rem;

        h2 {
            font-size: 1.75rem;
            margin-bottom: 2rem;
        }
    }
}

.drawer-content {
    padding: 0.5rem;
    max-height: 80vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;

    ul {
        list-style-type: none;
        padding: 0;
        margin: 0;

        li {
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            border-bottom: 1px solid var(--el-border-color);
            display: flex;
            align-items: center;
            transition: background-color 0.2s;
            font-size: 0.875rem;

            &:hover {
                background-color: var(--el-fill-color-light);
            }

            .drawer-chinese {
                font-size: 0.75rem;
                color: var(--el-text-color-secondary);
                margin-left: 0.5rem;
            }
        }
    }

    @media (min-width: 768px) {
        padding: 1rem;
        
        ul li {
            padding: 0.75rem 1rem;
            font-size: 1rem;
            
            .drawer-chinese {
                font-size: 0.875rem;
            }
        }
    }
}

/* 移动端特定调整 */
@media (max-width: 767px) {
    .el-drawer {
        width: 85% !important;
    }
    
    .el-form-item__label {
        width: 80px !important;
    }
    
    .el-form-item__content {
        margin-left: 80px !important;
    }
    
    .el-select, .el-input {
        width: 100% !important;
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }

    100% {
        transform: scale(1);
    }
}

.recording-controls button:not(.paused) {
    animation: pulse 2s infinite;
}
</style>