import { useEffect, useState } from 'react'
import type { MeResponse } from '@/types'
import { api } from '@/lib/api'

interface Props {
  me: MeResponse
  onChange: (me: MeResponse) => void
}

/** 绑定私密空间：按昵称加好友，对方接受后开通二人空间 */
export default function BindSpace({ me, onChange }: Props) {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  /* 轮询：对方接受后自动进入空间 */
  useEffect(() => {
    const t = window.setInterval(async () => {
      try {
        const fresh = await api<MeResponse>('/api/me')
        if (fresh.spaceId) onChange(fresh)
      } catch {
        /* ignore */
      }
    }, 4000)
    return () => window.clearInterval(t)
  }, [onChange])

  const act = async (path: string, body: unknown, okMsg: string) => {
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      const res = await api<MeResponse>(path, { method: 'POST', body })
      setMsg(okMsg)
      onChange(res)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '网络错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-rose-100 via-pink-50 to-amber-50 px-6">
      <div className="text-5xl">🏠</div>
      <h1 className="mt-4 text-xl font-black text-rose-950">绑定你们的私密空间</h1>
      <p className="mt-1 text-center text-xs text-rose-900/45">
        呼叫、分享、日记、打卡——这些只属于你们两个人
      </p>

      <div className="mt-8 w-full max-w-xs space-y-4">
        {/* 收到的申请 */}
        {me.incoming.length > 0 && (
          <div className="rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur">
            <p className="mb-3 text-xs font-bold text-rose-950">📩 收到的绑定申请</p>
            {me.incoming.map((r) => (
              <div key={r.reqId} className="mb-2 flex items-center gap-3 last:mb-0">
                <span className="text-2xl">{r.avatar}</span>
                <span className="flex-1 text-sm font-semibold text-rose-950">{r.name}</span>
                <button
                  onClick={() => void act('/api/friends/accept', { reqId: r.reqId }, '')}
                  className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-600"
                >
                  接受
                </button>
                <button
                  onClick={() => void act('/api/friends/decline', { reqId: r.reqId }, '已拒绝')}
                  className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-200"
                >
                  拒绝
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 发出申请 */}
        <div className="rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur">
          <p className="mb-2 text-xs font-bold text-rose-950">💌 申请和 TA 绑定</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              placeholder="输入 TA 的昵称"
              className="flex-1 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
            />
            <button
              onClick={() => void act('/api/friends/add', { name }, '申请已发送，等 TA 接受 💌')}
              disabled={busy || !name.trim()}
              className="rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
            >
              发送
            </button>
          </div>
          {me.outgoing.length > 0 && (
            <p className="mt-2 text-xs text-rose-900/45">
              已发送给：{me.outgoing.map((r) => r.name).join('、')}（等待接受中）
            </p>
          )}
          {msg && <p className="mt-2 text-xs text-rose-500">{msg}</p>}
        </div>

        <p className="text-center text-[10px] text-rose-900/35">
          TA 接受后会自动开通空间，此页面将自动进入 · 也可以先去「论坛」逛逛（下方导航）
        </p>
      </div>
    </div>
  )
}
