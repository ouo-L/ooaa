import { useState } from 'react'
import type { MoodKey, Role } from '@/types'
import { MOODS } from '@/types'
import { setState, useUniverse } from '@/lib/store'
import { blip } from '@/lib/audio'
import { notifyPartner } from '@/lib/push'

interface Props {
  me: Role
}

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

/** 功能三：状态展示 —— 双方实时可见的心情状态 */
export default function StatusBoard({ me }: Props) {
  const state = useUniverse()
  const other: Role = me === 'a' ? 'b' : 'a'
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)

  const setMood = (mood: MoodKey) => {
    setState((s) => ({
      ...s,
      statuses: { ...s.statuses, [me]: { role: me, mood, note: note.trim(), at: Date.now() } },
    }))
    blip('message')
    notifyPartner('status')
    setNote('')
    setOpen(false)
  }

  const card = (role: Role) => {
    const st = state.statuses[role]
    const p = state.profiles[role]
    const mood = st ? MOODS[st.mood] : null
    return (
      <div
        className="flex-1 rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur"
        style={mood ? { boxShadow: `0 0 0 2px ${mood.color}55, 0 8px 24px ${mood.color}33` } : {}}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xl">{p.avatar}</span>
          <span className="text-sm font-bold text-rose-950">{p.name}</span>
          {role === me && (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-500">
              我
            </span>
          )}
        </div>
        {st && mood ? (
          <>
            <div className="text-4xl">{mood.emoji}</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: mood.color }}>
              {mood.label}
            </div>
            {st.note && <div className="mt-1 text-xs text-rose-900/60">「{st.note}」</div>}
            <div className="mt-2 text-[10px] text-rose-900/35">{timeAgo(st.at)}更新</div>
          </>
        ) : (
          <div className="py-3 text-xs text-rose-900/35">还没设置状态</div>
        )}
      </div>
    )
  }

  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-rose-950">💭 此刻的我们</h2>
      <div className="flex gap-3">
        {card(me)}
        {card(other)}
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="mt-3 w-full rounded-2xl bg-rose-500/90 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 active:scale-[0.98]"
      >
        {open ? '收起' : '更新我的状态'}
      </button>

      {open && (
        <div className="mt-3 rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(MOODS) as MoodKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setMood(k)}
                className="flex flex-col items-center rounded-2xl bg-rose-50 py-2.5 transition hover:bg-rose-100 active:scale-95"
              >
                <span className="text-2xl">{MOODS[k].emoji}</span>
                <span className="mt-1 text-xs text-rose-900/70">{MOODS[k].label}</span>
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={30}
            placeholder="再补一句心情（可选）…"
            className="mt-3 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
          />
          <p className="mt-2 text-center text-[10px] text-rose-900/35">点选心情即发布</p>
        </div>
      )}
    </section>
  )
}
