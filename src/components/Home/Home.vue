<template>
    <div class="home-container">
        <div class="language-selector">
            <el-select v-model="selectedLanguage" placeholder="Select Language" @change="changeLanguage">
                <el-option v-for="lang in languages" :key="lang.value" :label="lang.label" :value="lang.value" />
            </el-select>
        </div>

        <div class="content-area">
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

        <div class="control-buttons" style="flex-wrap: nowrap;">
            <a-button @click="prevSentence" :disabled="currentIndex === 0" aria-label="Previous" flex="1">
                <el-icon :size="20">
                    <LeftOutlined />
                </el-icon>
            </a-button>


            <a-button type="primary" @click="toggleRecording" flex="1">
                {{ isRecording ? 'Stop' : 'Start' }} Recording
            </a-button>
            <!-- Next 按钮 -->
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import Recorder from 'js-audio-recorder';
import * as transform from 'js-audio-recorder/src/transform/transform';
import * as Player from 'js-audio-recorder/src/player/player';
import { RightOutlined, LeftOutlined } from '@ant-design/icons-vue';
import { http } from '../../http/index.ts';
import languageData from './languageData.ts';

const sampleRate = ref(16000);
const sampleBit = ref(16);
const numChannel = ref(1);
const compiling = ref(false);
const duration = ref(0);
const fileSize = ref(0);
const vol = ref(0);

const languages = ref(
    Object.entries(languageData).map(([value, lang]) => ({
        value,
        label: lang.label
    }))
);

const { encodeWAV } = transform;
let recorder = null;
let playTimer = null;
const selectedLanguage = ref(localStorage.getItem('selectedLanguage') || 'en') // 从 localStorage 中恢复语种
const currentLanguage = ref('English')
const sentences = ref<string[]>([])
const currentIndex = ref(0)
const currentSentence = ref('')
const isRecording = ref(false)
const hasRecording = ref(false)

const collectData = () => {
    return {
        sampleBits: sampleBit.value,
        sampleRate: sampleRate.value,
        numChannels: numChannel.value,
        compiling: compiling.value,
    };
};

const changeLanguage = () => {
    const langData = languageData[selectedLanguage.value]
    sentences.value = langData.sentences
    currentIndex.value = parseInt(localStorage.getItem('currentIndex')) || 0
    updateCurrentSentence()
    currentLanguage.value = langData.label
    localStorage.setItem('selectedLanguage', selectedLanguage.value) // 保存语种到 localStorage
}

const updateCurrentSentence = () => {
    currentSentence.value = sentences.value[currentIndex.value] || ''
    localStorage.setItem('currentIndex', currentIndex.value.toString())
}

const prevSentence = () => {
    if (currentIndex.value > 0) {
        currentIndex.value--
        updateCurrentSentence()
    }
}

const nextSentence = () => {
    if (currentIndex.value < sentences.value.length - 1) {
        currentIndex.value++
        updateCurrentSentence()
    } else {
        // 全部录制完成后自动回滚到第一条语料
        currentIndex.value = 0
        localStorage.removeItem('currentIndex')
        updateCurrentSentence()
        ElMessage.success('All recordings completed. Rolling back to the first sentence.')
    }
}

const startRecord = () => {
    const config = collectData();
    if (!recorder) {
        recorder = new Recorder(config);
        recorder.onprocess = function (duration) {
            // this.setState({
            //     duration: duration.toFixed(5),
            // });
            // 推荐使用 onprogress
        };
        recorder.onprogress = (params) => {
            duration.value = params.duration.toFixed(5);
            fileSize.value = params.fileSize;
            vol.value = params.vol.toFixed(2);
            console.log(vol);
            if (config.compiling) {
                console.log('音频总数据：', params.data);
            }
        };
        recorder.onplay = () => {
            console.log('%c回调监听，开始播放音频', 'color: #2196f3');
        };
        recorder.onpauseplay = () => {
            console.log('%c回调监听，暂停播放音频', 'color: #2196f3');
        };
        recorder.onresumeplay = () => {
            console.log('%c回调监听，恢复播放音频', 'color: #2196f3');
        };
        recorder.onstopplay = () => {
            console.log('%c回调监听，停止播放音频', 'color: #2196f3');
        };
        recorder.onplayend = () => {
            console.log('%c回调监听，音频已经完成播放', 'color: #2196f3');
            stopDrawPlay();
        };
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
    } else {
        recorder.stop();
    }
    recorder.start().then(() => {
        console.log('开始录音');
    }, (error) => {
        console.log(`异常了,${error.name}:${error.message}`);
    });
};

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
        const response = (await http.post(`/upload`, formData));
        console.log(response);

        ElMessage.success('Recording uploaded successfully')
        hasRecording.value = false
    } catch (error) {
        console.error("Upload failed: ", error);
    } finally {
        loadingInstance.close();
    }
};

const endRecord = () => {
    recorder && recorder.stop();
};

const toggleRecording = () => {
    isRecording.value = !isRecording.value
    if (!isRecording.value) {
        hasRecording.value = true;
        endRecord();
    } else {
        startRecord();
    }
}

const uploadRecording = () => {
    uploadWAV();
}

onMounted(() => {
    // 从 localStorage 中恢复状态
    selectedLanguage.value = localStorage.getItem('selectedLanguage') || 'en' // 恢复语种
    currentIndex.value = parseInt(localStorage.getItem('currentIndex')) || 0
    isRecording.value = localStorage.getItem('isRecording') === 'true'
    hasRecording.value = localStorage.getItem('hasRecording') === 'true'
    changeLanguage()
})

// 在组件销毁前保存状态
onBeforeUnmount(() => {
    localStorage.setItem('selectedLanguage', selectedLanguage.value) // 保存语种
    localStorage.setItem('currentIndex', currentIndex.value.toString())
    localStorage.setItem('isRecording', isRecording.value.toString())
    localStorage.setItem('hasRecording', hasRecording.value.toString())
})
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