/* WebAudio 合成的铃声与提示音，无需外部音频文件 */

let ctx: AudioContext | null = null
function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

let ringTimer: number | null = null
let ringStop: number | null = null
const ringTimeouts: number[] = []

/** 心跳的一声"扑通"：低频快速下滑的闷响 */
function thump(t: number, freq: number, vol: number) {
  const c = ac()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.42, t + 0.16)
  g.gain.setValueAtTime(0.001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.3)
}

/** 心动后的轻柔闪光音 */
function sparkle(t: number) {
  playNote(1567.98, t, 0.5, 0.07) // G6
  playNote(2093.0, t + 0.18, 0.6, 0.05) // C7
}

/** 一轮心动：扑通、扑通 ✨ */
function ringCycle() {
  const t = ac().currentTime + 0.03
  thump(t, 135, 0.55)
  thump(t + 0.26, 110, 0.42)
  thump(t + 0.85, 135, 0.55)
  thump(t + 1.11, 110, 0.42)
  sparkle(t + 1.45)
  if (navigator.vibrate) navigator.vibrate([120, 140, 120, 500, 120, 140, 120])
}

/** 开始循环"心动"铃声，最长 30 秒自动停止 */
export function startRinging() {
  stopRinging()
  try {
    ringCycle()
    ringTimer = window.setInterval(ringCycle, 3000)
    ringStop = window.setTimeout(stopRinging, 30000)
  } catch {
    /* audio blocked until user gesture */
  }
}

export function stopRinging() {
  if (ringTimer) window.clearInterval(ringTimer)
  if (ringStop) window.clearTimeout(ringStop)
  ringTimeouts.forEach((t) => window.clearTimeout(t))
  ringTimeouts.length = 0
  ringTimer = null
  ringStop = null
}

/** 单音，供提示音使用 */
function playNote(freq: number, start: number, dur: number, vol = 0.22) {
  const c = ac()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

/** 短提示音（收到消息/回应/打卡） */
export function blip(kind: 'message' | 'success' = 'message') {
  try {
    const c = ac()
    const t = c.currentTime + 0.02
    if (kind === 'message') {
      playNote(880, t, 0.15, 0.15)
      playNote(1174.66, t + 0.12, 0.25, 0.15)
    } else {
      playNote(659.25, t, 0.12, 0.18)
      playNote(783.99, t + 0.1, 0.12, 0.18)
      playNote(1046.5, t + 0.2, 0.35, 0.18)
    }
  } catch {
    /* ignore */
  }
}
