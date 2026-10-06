import { useState } from 'react'
import { dayKey } from '@/types'
import { composeDiary } from '@/lib/diary'
import { setState, useUniverse } from '@/lib/store'
import { blip } from '@/lib/audio'

/** 功能二（下）：日记本 —— 每天凌晨自动把当天的分享整理成日记发布 */
export default function DiaryBook() {
  const state = useUniverse()
  const [openId, setOpenId] = useState<string | null>(null)

  const today = dayKey()
  const todayCount = state.shares.filter((s) => s.day === today).length
  const todayGenerated = state.diaries.some((d) => d.day === today)

  /** 演示用：立即把今天的分享生成日记（正常情况是凌晨自动生成） */
  const generateNow = () => {
    setState((s) => {
      const entry = composeDiary(s, today)
      if (!entry) return s
      return {
        ...s,
        diaries: [entry, ...s.diaries],
        diaryGeneratedDays: [...s.diaryGeneratedDays, today],
      }
    })
    blip('success')
  }

  return (
    <section>
      <h2 className="mb-1 text-base font-bold text-rose-950">📖 我们的日记本</h2>
      <p className="mb-4 text-xs text-rose-900/50">
        每天凌晨 12 点，把两个人分享的照片和事情整理成一篇日记
      </p>

      {!todayGenerated && todayCount > 0 && (
        <button
          onClick={generateNow}
          className="mb-4 w-full rounded-2xl border border-dashed border-rose-300 bg-rose-50/60 py-3 text-sm text-rose-500 transition hover:bg-rose-50"
        >
          ✨ 今天已有 {todayCount} 条分享 · 立即生成今日日记（演示）
        </button>
      )}

      {state.diaries.length === 0 && (
        <p className="py-10 text-center text-xs text-rose-900/35">
          还没有日记。去「分享」里留下今天的第一条瞬间吧 🌙
        </p>
      )}

      <div className="space-y-3">
        {state.diaries.map((d) => {
          const open = openId === d.id
          return (
            <article
              key={d.id}
              className="overflow-hidden rounded-3xl bg-white/70 shadow-sm backdrop-blur"
            >
              <button
                onClick={() => setOpenId(open ? null : d.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div>
                  <div className="text-sm font-bold text-rose-950">{d.title}</div>
                  <div className="mt-0.5 text-[10px] text-rose-900/40">
                    {d.day} · {d.photos.length} 张照片
                  </div>
                </div>
                <span className="text-rose-300">{open ? '▲' : '▼'}</span>
              </button>
              {open && (
                <div className="border-t border-rose-100/80 p-4">
                  {d.photos.length > 0 && (
                    <div className="mb-3 grid grid-cols-3 gap-1.5">
                      {d.photos.map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt={`日记照片 ${i + 1}`}
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-rose-950/80">
                    {d.content}
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
