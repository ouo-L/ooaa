import { useEffect } from 'react'
import type { Ping, Profile } from '@/types'
import { startRinging, stopRinging } from '@/lib/audio'

interface Props {
  call: Ping
  caller: Profile
  onAnswer: () => void
  onDismiss: () => void
}

/** 来电全屏覆盖层：屏幕闪烁 + 响铃 + 震动 */
export default function FlashOverlay({ call, caller, onAnswer, onDismiss }: Props) {
  useEffect(() => {
    startRinging()
    return () => stopRinging()
  }, [call.id])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center flash-bg">
      <div className="flash-ring absolute inset-0 pointer-events-none" />
      <div className="text-7xl mb-6 animate-bounce">{caller.avatar}</div>
      <div className="text-white text-3xl font-bold drop-shadow-lg mb-2">
        {caller.name} 在呼叫你
      </div>
      <div className="text-white/85 text-sm mb-14 tracking-widest">
        隔着人海，也想立刻找到你
      </div>
      <div className="flex gap-14">
        <button
          onClick={onDismiss}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white/20 text-white text-xs backdrop-blur hover:bg-white/30 transition"
        >
          <span className="text-2xl">🔕</span>
          挂断
        </button>
        <button
          onClick={onAnswer}
          className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-rose-500 text-white shadow-2xl shadow-rose-500/50 animate-pulse hover:bg-rose-400 transition"
        >
          <span className="text-3xl">💗</span>
          <span className="text-xs mt-0.5">回应</span>
        </button>
      </div>
    </div>
  )
}
