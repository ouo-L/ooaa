import { useMemo, useState } from 'react'
import type { Role } from '@/types'
import { dayKey } from '@/types'
import { setState, useUniverse } from '@/lib/store'
import { blip } from '@/lib/audio'
import { notifyPartner } from '@/lib/push'

interface Props {
  me: Role
}

const SWEET_WORDS = [
  '我爱你，今天比昨天更多一点。',
  '我想你，想到输入法都记住了你的名字。',
  '人间本不该令我这么欣喜的，但是你来了。',
  '今天的云很好看，想拍给你看，却想到我们很久不联系，再看看云，突然觉得，云也没那么好看了——所以还是直接想你了。',
  '你忙归忙，什么时候有空嫁给我/娶了我？',
  '我对你的爱，就像拖拉机上山，轰轰烈烈。',
  '报告：今天也很喜欢你，完毕。',
  '距离之于爱情，就像风之于火，它吹熄微弱的，助长强烈的。我们是后者。',
]

/** 功能四：打卡 —— 每天互发一句情话，双方都发了才算打卡成功 */
export default function Checkin({ me }: Props) {
  const state = useUniverse()
  const other: Role = me === 'a' ? 'b' : 'a'
  const [text, setText] = useState('')

  const today = dayKey()
  const todayCheckin = state.checkins.find((c) => c.day === today)
  const myMsg = todayCheckin?.messages[me]
  const theirMsg = todayCheckin?.messages[other]
  const bothDone = Boolean(myMsg && theirMsg)

  /** 连续打卡天数：从今天（若已完成）或昨天开始往前数 */
  const streak = useMemo(() => {
    const done = new Set(
      state.checkins
        .filter((c) => c.messages.a && c.messages.b)
        .map((c) => c.day),
    )
    let n = 0
    const cursor = new Date()
    if (!(bothDone && done.has(dayKey(cursor)))) cursor.setDate(cursor.getDate() - 1)
    while (done.has(dayKey(cursor))) {
      n += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return n + (bothDone ? 1 : 0)
  }, [state.checkins, bothDone])

  const send = (msg: string) => {
    const t = msg.trim()
    if (!t || myMsg) return
    setState((s) => {
      const idx = s.checkins.findIndex((c) => c.day === today)
      const checkins = [...s.checkins]
      if (idx >= 0) {
        checkins[idx] = { ...checkins[idx], messages: { ...checkins[idx].messages, [me]: t } }
      } else {
        checkins.push({ day: today, messages: { [me]: t } })
      }
      return { ...s, checkins }
    })
    const complete = Boolean(theirMsg)
    blip(complete ? 'success' : 'message')
    notifyPartner('checkin')
    setText('')
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-base font-bold text-rose-950">💌 每日情话打卡</h2>
          <p className="mt-1 text-xs text-rose-900/50">每天互发一句情话，少了谁都不行</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-rose-500">{streak}</div>
          <div className="text-[10px] text-rose-900/40">连续打卡天数</div>
        </div>
      </div>

      <div
        className={`rounded-3xl p-5 text-center shadow-sm ${
          bothDone
            ? 'bg-gradient-to-br from-rose-400 to-pink-500 text-white'
            : 'bg-white/70 backdrop-blur'
        }`}
      >
        {bothDone ? (
          <>
            <div className="text-4xl">🎉</div>
            <div className="mt-2 text-sm font-bold">今日打卡成功！</div>
            <div className="mt-1 text-xs text-white/80">两个人都说了想念，今天圆满了</div>
          </>
        ) : (
          <>
            <div className="text-4xl">{myMsg ? '⏳' : '💘'}</div>
            <div className="mt-2 text-sm font-bold text-rose-950">
              {myMsg ? `已打卡，等 ${state.profiles[other].name} 回应…` : '今天还没对 TA 说情话'}
            </div>
            {!myMsg && (
              <div className="mt-3 flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send(text)}
                  maxLength={60}
                  placeholder="写一句情话 / 骚话……"
                  className="flex-1 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
                />
                <button
                  onClick={() => send(text)}
                  className="rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-95"
                >
                  发送
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {!myMsg && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-rose-900/40">不知道说什么？点一句直接发：</p>
          <div className="flex flex-wrap gap-2">
            {SWEET_WORDS.slice(0, 4).map((w) => (
              <button
                key={w}
                onClick={() => send(w)}
                className="rounded-full bg-white/70 px-3 py-1.5 text-xs text-rose-700 shadow-sm transition hover:bg-rose-100 active:scale-95"
              >
                {w.length > 14 ? w.slice(0, 14) + '…' : w}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {theirMsg && (
          <Bubble
            who={`${state.profiles[other].avatar} ${state.profiles[other].name}`}
            msg={theirMsg}
          />
        )}
        {myMsg && (
          <Bubble who={`${state.profiles[me].avatar} ${state.profiles[me].name}（我）`} msg={myMsg} mine />
        )}
      </div>
    </section>
  )
}

function Bubble({ who, msg, mine }: { who: string; msg: string; mine?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3 text-sm shadow-sm ${
        mine ? 'bg-rose-500 text-white' : 'bg-white/80 text-rose-950'
      }`}
    >
      <div className={`mb-1 text-[10px] ${mine ? 'text-white/70' : 'text-rose-900/40'}`}>{who}</div>
      {msg}
    </div>
  )
}
