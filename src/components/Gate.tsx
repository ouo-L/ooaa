import { useState } from 'react'

/** 答案不明文出现在代码里，只存 SHA-256 哈希 */
const ANSWER_HASH = '7b14a21bfa3f97598c7d18a38ccf195037a99865edbc2083d7004a9206873a95'
const UNLOCK_KEY = 'yidi-universe-unlocked'

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === ANSWER_HASH
  } catch {
    return false
  }
}

interface Props {
  onUnlock: () => void
}

/** 情侣暗号门禁：答对才能进入小宇宙 */
export default function Gate({ onUnlock }: Props) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [checking, setChecking] = useState(false)

  const submit = async () => {
    const v = value.trim()
    if (!v || checking) return
    setChecking(true)
    const ok = (await sha256(v)) === ANSWER_HASH
    if (ok) {
      try {
        localStorage.setItem(UNLOCK_KEY, ANSWER_HASH)
      } catch {
        /* ignore */
      }
      onUnlock()
    } else {
      setWrong(true)
      setValue('')
      window.setTimeout(() => setWrong(false), 600)
    }
    setChecking(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-rose-100 via-pink-50 to-amber-50 px-6">
      <div className="text-5xl">💞</div>
      <h1 className="mt-4 text-xl font-black text-rose-950">哦哦啊啊</h1>
      <p className="mt-1 text-xs text-rose-900/45">此星球仅限持证居民，请对暗号</p>

      <div
        className={`mt-8 w-full max-w-xs rounded-3xl bg-white/70 p-6 text-center shadow-sm backdrop-blur ${
          wrong ? 'gate-shake' : ''
        }`}
      >
        <p className="text-[11px] tracking-widest text-rose-900/40">谜面 · 打一个地方</p>
        <p className="mt-2 text-4xl font-black tracking-[0.3em] text-rose-950">河南</p>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          maxLength={10}
          placeholder="输入谜底…"
          autoFocus
          className="mt-6 w-full rounded-xl border border-rose-100 bg-white px-3 py-2.5 text-center text-lg tracking-widest outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-rose-900/30 focus:border-rose-300"
        />
        <button
          onClick={() => void submit()}
          disabled={checking}
          className="mt-3 w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60"
        >
          {checking ? '核对中…' : '进入我们的宇宙 💫'}
        </button>
        {wrong && <p className="mt-2 text-xs text-rose-500">不对哦，再想想 💭</p>}
      </div>

      <p className="mt-6 text-[10px] text-rose-900/30">答对过的设备会自动记住，不用每次输入</p>
    </div>
  )
}
