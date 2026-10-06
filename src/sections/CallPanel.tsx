import { useMemo } from 'react'
import type { Role } from '@/types'
import { setState, uid, useUniverse } from '@/lib/store'
import { blip } from '@/lib/audio'
import { notifyPartner } from '@/lib/push'

interface Props {
  me: Role
}

/** 功能一：呼叫 —— 一键呼叫对方，对方手机响铃 + 屏幕闪烁 */
export default function CallPanel({ me }: Props) {
  const state = useUniverse()
  const partner = state.profiles[me === 'a' ? 'b' : 'a']

  const { calling, answered } = useMemo(() => {
    const myCalls = state.pings.filter((p) => p.from === me && p.kind === 'call')
    const lastCall = myCalls[myCalls.length - 1]
    if (!lastCall) return { calling: false, answered: false }
    const fresh = Date.now() - lastCall.at < 30000
    const answer = state.pings.find(
      (p) => p.from !== me && p.kind === 'answer' && p.at > lastCall.at,
    )
    return { calling: fresh && !answer, answered: Boolean(answer && Date.now() - answer.at < 60000) }
  }, [state.pings, me])

  const call = () => {
    setState((s) => ({
      ...s,
      pings: [...s.pings.slice(-50), { id: uid(), from: me, kind: 'call', at: Date.now() }],
    }))
    blip('message')
    notifyPartner('call')
  }

  return (
    <section className="rounded-3xl bg-white/70 p-6 shadow-sm backdrop-blur">
      <h2 className="mb-1 text-base font-bold text-rose-950">📞 呼叫 TA</h2>
      <p className="mb-5 text-xs text-rose-900/50">
        按下按钮，{partner.name}的手机会响铃并闪烁屏幕
      </p>
      <div className="flex flex-col items-center py-2">
        <button
          onClick={call}
          disabled={calling}
          className={`relative flex h-28 w-28 items-center justify-center rounded-full text-5xl text-white shadow-xl transition active:scale-95 ${
            calling
              ? 'cursor-not-allowed bg-rose-300'
              : 'bg-gradient-to-br from-rose-400 to-pink-600 shadow-rose-400/50 hover:scale-105'
          }`}
        >
          {!calling && (
            <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />
          )}
          {calling ? '💞' : '💓'}
        </button>
        <div className="mt-4 h-6 text-sm font-medium">
          {calling && <span className="text-rose-500">呼叫中……{partner.name}的手机正在响</span>}
          {answered && <span className="text-emerald-600">TA 回应你啦 ❤</span>}
          {!calling && !answered && (
            <span className="text-rose-900/40">想 TA 的时候，就按一下</span>
          )}
        </div>
      </div>
    </section>
  )
}
