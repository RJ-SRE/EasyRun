import "./style.css";

interface RecognitionResultEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
const speechWindow = window as typeof window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const SpeechRecognition =
  speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main>
    <p class="eyebrow">WORDRUNNER / DEVELOPMENT LAB</p>
    <h1>词境跑者 · 环境检查</h1>
    <p class="muted">用于确认渲染、输入和语音设备。这里还不是游戏，也不代表 XBuilder 语音接入已经完成。</p>
    <div class="grid">
      <section class="wide">
        <h2>画面与键盘</h2>
        <canvas id="render-check" width="900" height="170" aria-label="Canvas 动画检查"></canvas>
        <output id="render-status" aria-live="polite">准备渲染…</output>
        <p class="muted">点击空白处后按 Space、↓、1、2、3 或 S，检查输入是否被接收。</p>
        <output id="key-status" aria-live="polite">等待键盘输入</output>
      </section>
      <section>
        <h2>麦克风与音量</h2>
        <p class="muted">点击后才申请权限；最多检查 8 秒，只显示音量，不保存录音。</p>
        <button id="mic-start">开始麦克风检查</button>
        <button id="mic-stop" class="secondary" disabled>停止</button>
        <meter id="mic-level" min="0" max="1" value="0" aria-label="麦克风音量"></meter>
        <output id="mic-status" aria-live="polite">尚未请求麦克风权限</output>
      </section>
      <section>
        <h2>浏览器英语识别</h2>
        <p id="speech-capability" class="muted"></p>
        <p class="muted">点击后可说 “Jump” 或 “Run faster”。浏览器可能把语音发送给其识别服务；本页不保存录音或识别文本。</p>
        <button id="speech-start">测试英语识别</button>
        <button id="speech-stop" class="secondary" disabled>停止识别</button>
        <output id="speech-status" aria-live="polite">尚未开始识别；未进行发音评分</output>
      </section>
      <section class="wide">
        <h2>下一步验证</h2>
        <ol class="muted">
          <li>在本机 Chrome 中测试真实麦克风和英语识别，记录成功率与延迟。</li>
          <li>在 XBuilder 中完成“说 Jump → 角色跳跃”的闭环。</li>
          <li>识别超时、无权限或不支持时，游戏必须保留键盘操作。</li>
        </ol>
        <a href="https://x.qiniu.com" target="_blank" rel="noreferrer">打开官方 XBuilder</a>
      </section>
    </div>
  </main>`;

const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = get<HTMLCanvasElement>("render-check");
const ctx = canvas.getContext("2d");
let frames = 0;
function draw(time: number) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#24364c";
  ctx.fillRect(0, 130, canvas.width, 3);
  ctx.fillStyle = "#7de2cc";
  ctx.fillRect(40 + ((time / 8) % 810), 90 - Math.sin(time / 180) * 5, 28, 36);
  frames++;
  if (frames === 2) get("render-status").textContent = "Canvas 2D 动画已运行";
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
if (!ctx) get("render-status").textContent = "当前浏览器无法创建 Canvas 2D";

const keys: Record<string, string> = {
  Space: "Jump / 跳跃",
  ArrowDown: "Slide / 滑行",
  Digit1: "Jog / 慢跑",
  Digit2: "Run / 跑步",
  Digit3: "Sprint / 冲刺",
  KeyS: "Stop / 停下",
};
window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLElement &&
    event.target.closest(
      "button, input, textarea, select, a, [contenteditable]",
    )
  )
    return;
  if (!keys[event.code]) return;
  event.preventDefault();
  get("key-status").textContent = `收到输入：${keys[event.code]}（仅检查按键）`;
});

const micStart = get<HTMLButtonElement>("mic-start");
const micStop = get<HTMLButtonElement>("mic-stop");
const meter = get<HTMLMeterElement>("mic-level");
let stream: MediaStream | undefined;
let audio: AudioContext | undefined;
let micTimer: ReturnType<typeof setTimeout> | undefined;
let micGeneration = 0;
function stopMic(message = "麦克风检查已停止") {
  micGeneration++;
  clearTimeout(micTimer);
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  if (audio) void audio.close();
  audio = undefined;
  meter.value = 0;
  micStart.disabled = false;
  micStop.disabled = true;
  get("mic-status").textContent = message;
}
micStart.addEventListener("click", async () => {
  stopSpeech();
  const generation = ++micGeneration;
  micStart.disabled = true;
  micStop.disabled = false;
  get("mic-status").textContent = "等待麦克风权限…";
  try {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("当前浏览器不支持音频采集或不是安全上下文");
    const incoming = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (generation !== micGeneration) {
      incoming.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = incoming;
    audio = new AudioContext();
    await audio.resume();
    if (generation !== micGeneration || !audio || !stream) return;
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    audio.createMediaStreamSource(stream).connect(analyser);
    const values = new Uint8Array(analyser.fftSize);
    get("mic-status").textContent = "正在采集音量（8 秒后自动停止）";
    const update = () => {
      if (generation !== micGeneration || !stream) return;
      analyser.getByteTimeDomainData(values);
      meter.value = Math.min(
        1,
        Math.sqrt(
          values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
            values.length,
        ) * 4,
      );
      requestAnimationFrame(update);
    };
    update();
    micTimer = setTimeout(() => stopMic(), 8000);
  } catch (error) {
    if (generation === micGeneration)
      stopMic(
        `麦克风不可用：${error instanceof Error ? error.message : String(error)}。可继续使用键盘。`,
      );
  }
});
micStop.addEventListener("click", () => stopMic());

const speechStart = get<HTMLButtonElement>("speech-start");
const speechStop = get<HTMLButtonElement>("speech-stop");
let recognition: Recognition | undefined;
let speechTimer: ReturnType<typeof setTimeout> | undefined;
get("speech-capability").textContent = SpeechRecognition
  ? "检测到识别 API，联网识别是否可用需要实际开口测试。"
  : "此浏览器没有识别 API；请用本机 Chrome 进行真人验证。";
speechStart.disabled = !SpeechRecognition;
function stopSpeech() {
  clearTimeout(speechTimer);
  const active = recognition;
  recognition = undefined;
  if (active) {
    active.onresult = null;
    active.onerror = null;
    active.onend = null;
    active.abort();
  }
  speechStart.disabled = !SpeechRecognition;
  speechStop.disabled = true;
}
speechStart.addEventListener("click", () => {
  if (!SpeechRecognition) return;
  stopMic();
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    get("speech-status").textContent =
      `识别文本：${event.results[0][0].transcript}（未执行游戏动作）`;
  };
  recognition.onerror = (event) => {
    get("speech-status").textContent =
      `识别失败：${event.error}。可继续使用键盘；请记录浏览器和网络情况。`;
  };
  recognition.onend = () => {
    clearTimeout(speechTimer);
    recognition = undefined;
    speechStart.disabled = false;
    speechStop.disabled = true;
  };
  try {
    recognition.start();
    speechStart.disabled = true;
    speechStop.disabled = false;
    get("speech-status").textContent = "请说一句英语（最多等待 10 秒）…";
    speechTimer = setTimeout(() => {
      stopSpeech();
      get("speech-status").textContent = "识别等待结束；尚未证明英语识别可用。";
    }, 10000);
  } catch (error) {
    stopSpeech();
    get("speech-status").textContent = `无法开始识别：${String(error)}`;
  }
});
speechStop.addEventListener("click", () => {
  stopSpeech();
  get("speech-status").textContent = "识别已停止";
});
window.addEventListener("pagehide", () => {
  stopMic();
  stopSpeech();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopMic();
    stopSpeech();
  }
});
