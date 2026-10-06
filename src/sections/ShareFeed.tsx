import { useMemo, useRef, useState } from 'react'
import type { Role } from '@/types'
import { dayKey } from '@/types'
import { setState, uid, useUniverse } from '@/lib/store'
import { blip } from '@/lib/audio'
import { fileToDataUrl } from '@/lib/image'
import { notifyPartner } from '@/lib/push'

interface Props {
  me: Role
}

function fmtTime(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 功能二（上）：分享窗口 —— 双方随时分享照片和小事，凌晨汇成日记 */
export default function ShareFeed({ me }: Props) {
  const state = useUniverse()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const today = dayKey()
  const items = useMemo(
    () => state.shares.filter((s) => s.day === today).sort((a, b) => b.at - a.at),
    [state.shares, today],
  )

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return
    try {
      setPhoto(await fileToDataUrl(f))
    } catch {
      /* 读取失败则忽略 */
    }
  }

  const post = () => {
    const t = text.trim()
    if (!t && !photo) return
    setState((s) => ({
      ...s,
      shares: [
        ...s.shares.slice(-200),
        { id: uid(), author: me, text: t, photo: photo ?? undefined, at: Date.now(), day: today },
      ],
    }))
    blip('message')
    notifyPartner('share')
    setText('')
    setPhoto(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section>
      <h2 className="mb-1 text-base font-bold text-rose-950">📮 分享窗口</h2>
      <p className="mb-4 text-xs text-rose-900/50">
        随手记下今天的碎片，凌晨 12 点会自动整理成我们的日记
      </p>

      <div className="rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="此刻想告诉 TA 的事……"
          className="w-full resize-none rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
        />
        {photo && (
          <div className="relative mt-2 w-28">
            <img src={photo} alt="待分享" className="h-28 w-28 rounded-xl object-cover" />
            <button
              onClick={() => setPhoto(null)}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs text-white"
            >
              ×
            </button>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-xl bg-rose-50 py-2 text-sm text-rose-600 transition hover:bg-rose-100"
          >
            📷 加照片
          </button>
          <button
            onClick={post}
            className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.98]"
          >
            分享 ✨
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 && (
          <p className="py-10 text-center text-xs text-rose-900/35">
            今天还没有分享，第一个瞬间等你来记录 🌷
          </p>
        )}
        {items.map((it) => {
          const mine = it.author === me
          const p = state.profiles[it.author]
          return (
            <div key={it.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                {p.avatar}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
                  mine ? 'rounded-tr-sm bg-rose-500 text-white' : 'rounded-tl-sm bg-white/80'
                }`}
              >
                {it.photo && (
                  <img
                    src={it.photo}
                    alt="分享的照片"
                    className="mb-2 max-h-56 w-full rounded-xl object-cover"
                  />
                )}
                {it.text && <p className="whitespace-pre-wrap text-sm">{it.text}</p>}
                <p
                  className={`mt-1 text-right text-[10px] ${mine ? 'text-white/60' : 'text-rose-900/35'}`}
                >
                  {p.name} · {fmtTime(it.at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
