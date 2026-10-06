import { useState } from 'react'
import type { MeResponse } from '@/types'
import { api, setToken } from '@/lib/api'

const AVATARS = ['🌟', '🌙', '🐰', '🐷', '🐱', '🐶', '🦊', '🐻', '🌸', '🍑', '⚡', '🍀']

interface Props {
  onAuth: (me: MeResponse) => void
}

/** 登录 / 注册 */
export default function Auth({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await api<{ token: string } & MeResponse>(`/api/${mode}`, {
        method: 'POST',
        body: { name, password, ...(mode === 'register' ? { avatar } : {}) },
      })
      setToken(res.token)
      onAuth(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-rose-100 via-pink-50 to-amber-50 px-6">
      <div className="text-5xl">💞</div>
      <h1 className="mt-4 text-2xl font-black text-rose-950">哦哦啊啊</h1>
      <p className="mt-1 text-xs text-rose-900/45">和 TA 的私密空间，也有一群人的热闹</p>

      <div className="mt-8 w-full max-w-xs rounded-3xl bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="mb-5 flex rounded-full bg-rose-50 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError('')
              }}
              className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition ${
                mode === m ? 'bg-rose-500 text-white shadow' : 'text-rose-900/50'
              }`}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          placeholder="昵称"
          className="w-full rounded-xl border border-rose-100 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          type="password"
          maxLength={32}
          placeholder={mode === 'register' ? '密码（至少 4 位）' : '密码'}
          className="mt-3 w-full rounded-xl border border-rose-100 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
        />

        {mode === 'register' && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-rose-900/45">选个头像：</p>
            <div className="grid grid-cols-6 gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`rounded-xl py-1.5 text-xl transition ${
                    avatar === a ? 'bg-rose-100 ring-2 ring-rose-400' : 'bg-white hover:bg-rose-50'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-center text-xs text-rose-500">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy || !name.trim() || !password}
          className="mt-5 w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? '请稍候…' : mode === 'login' ? '进入 💫' : '创建账号 💫'}
        </button>

        <p className="mt-3 text-center text-[10px] text-rose-900/35">
          注册即表示同意
          <a href="./privacy.html" target="_blank" className="underline">
            《隐私政策》
          </a>
        </p>
      </div>
    </div>
  )
}
