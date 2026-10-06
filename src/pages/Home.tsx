import { useEffect, useMemo, useState } from 'react'
import type { MeResponse, Role } from '@/types'
import { connectSpace, disconnectSpace, setState, uid, useUniverse } from '@/lib/store'
import { fetchMe, getToken, setToken } from '@/lib/api'
import { generateDueDiaries } from '@/lib/diary'
import { blip } from '@/lib/audio'
import { notifyPartner, pushSupported, setupPush } from '@/lib/push'
import FlashOverlay from '@/components/FlashOverlay'
import Gate, { isUnlocked } from '@/components/Gate'
import Auth from '@/components/Auth'
import BindSpace from '@/sections/BindSpace'
import CallPanel from '@/sections/CallPanel'
import StatusBoard from '@/sections/StatusBoard'
import ShareFeed from '@/sections/ShareFeed'
import DiaryBook from '@/sections/DiaryBook'
import Checkin from '@/sections/Checkin'
import Forum from '@/sections/Forum'

type Tab = 'home' | 'share' | 'diary' | 'checkin' | 'forum'

const ALL_TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '我们', icon: '🏠' },
  { key: 'share', label: '分享', icon: '📮' },
  { key: 'diary', label: '日记', icon: '📖' },
  { key: 'checkin', label: '打卡', icon: '💌' },
  { key: 'forum', label: '广场', icon: '🌍' },
]

export default function Home() {
  const state = useUniverse()
  const [unlocked, setUnlocked] = useState(() => isUnlocked())
  const [me, setMeInfo] = useState<MeResponse | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [dismissedCallId, setDismissedCallId] = useState<string | null>(null)
  const [notifyReady, setNotifyReady] = useState(false)

  const hasSpace = Boolean(me?.spaceId && me.partner)
  const visibleTabs = hasSpace
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.key === 'home' || t.key === 'forum')

  /* 登录态恢复 */
  useEffect(() => {
    if (!unlocked) return
    fetchMe()
      .then((m) => setMeInfo(m))
      .catch(() => setToken(null))
      .finally(() => setAuthChecked(true))
  }, [unlocked])

  /* 连接私密空间（WebSocket 实时同步） */
  useEffect(() => {
    if (!me?.spaceId) return
    const token = getToken()
    if (token) connectSpace(me.spaceId, token)
    return () => disconnectSpace()
  }, [me?.spaceId])

  /* 我在空间里的角色：空间 profiles 由双方昵称对位（昵称全局唯一） */
  const myRole: Role = useMemo(() => {
    if (!me) return 'a'
    return state.profiles.b.name === me.user.name && state.profiles.a.name !== me.user.name
      ? 'b'
      : 'a'
  }, [me, state.profiles])
  const other: Role = myRole === 'a' ? 'b' : 'a'

  /* 凌晨 12 点自动生成日记 */
  useEffect(() => {
    if (!hasSpace) return
    const tick = () =>
      setState((s) => {
        const { next, added } = generateDueDiaries(s)
        return added > 0 ? next : s
      })
    tick()
    const t = window.setInterval(tick, 20000)
    return () => window.clearInterval(t)
  }, [hasSpace])

  /* 来电监听：对方 30 秒内的最新呼叫 → 弹全屏闪烁来电页 */
  const incomingCall = useMemo(() => {
    if (!hasSpace) return null
    const calls = state.pings.filter((p) => p.from === other && p.kind === 'call')
    const last = calls[calls.length - 1]
    if (!last) return null
    if (Date.now() - last.at > 30000) return null
    if (last.id === dismissedCallId) return null
    const answered = state.pings.some(
      (p) => p.from === myRole && p.kind === 'answer' && p.at > last.at,
    )
    return answered ? null : last
  }, [state.pings, myRole, other, dismissedCallId, hasSpace])

  const answerCall = () => {
    if (!incomingCall) return
    setState((s) => ({
      ...s,
      pings: [...s.pings.slice(-50), { id: uid(), from: myRole, kind: 'answer', at: Date.now() }],
    }))
    blip('success')
    notifyPartner('answer')
  }

  /* 消息推送：已授权设备自动订阅 */
  useEffect(() => {
    if (!me || !pushSupported()) return
    if (Notification.permission === 'granted') {
      void setupPush().then(() => setNotifyReady(true))
    }
  }, [me])

  const enableNotify = async () => {
    await setupPush()
    setNotifyReady(Notification.permission === 'granted')
  }
  const showNotifyButton =
    pushSupported() && !notifyReady && Notification.permission === 'default'

  const logout = () => {
    setToken(null)
    disconnectSpace()
    setMeInfo(null)
    setTab('home')
  }

  /* 暗号门禁：答对「河南 → 福建」才放行 */
  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />

  /* 登录 / 注册 */
  if (!me) {
    if (!authChecked)
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-100 to-amber-50 text-rose-300">
          加载中…
        </div>
      )
    return <Auth onAuth={setMeInfo} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-100 via-pink-50 to-amber-50 text-rose-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-6">
        <header className="mb-5">
          <h1 className="text-center text-lg font-black tracking-wide">💫 哦哦啊啊</h1>
          <p className="mt-0.5 text-center text-[11px] text-rose-900/45">
            {hasSpace
              ? `${state.profiles[myRole].avatar} ${me.user.name} 💞 ${me.partner!.avatar} ${me.partner!.name}`
              : `${me.user.avatar} ${me.user.name} · 还没有绑定空间`}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            {showNotifyButton && (
              <button
                onClick={() => void enableNotify()}
                className="rounded-full bg-rose-500/10 px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 active:scale-95"
              >
                🔔 开启消息通知
              </button>
            )}
            <button
              onClick={logout}
              className="rounded-full bg-white/50 px-3 py-1.5 text-[10px] text-rose-900/40 transition hover:bg-white/80"
            >
              退出登录
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-6">
          {tab === 'forum' ? (
            <Forum me={me.user} />
          ) : !hasSpace ? (
            <BindSpace me={me} onChange={setMeInfo} />
          ) : (
            <>
              {tab === 'home' && (
                <>
                  <CallPanel me={myRole} />
                  <StatusBoard me={myRole} />
                </>
              )}
              {tab === 'share' && <ShareFeed me={myRole} />}
              {tab === 'diary' && <DiaryBook />}
              {tab === 'checkin' && <Checkin me={myRole} />}
            </>
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rose-100 bg-white/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-md">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-1 flex-col items-center py-2.5 text-xs transition ${
                  tab === t.key ? 'font-bold text-rose-500' : 'text-rose-900/40'
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {incomingCall && (
        <FlashOverlay
          call={incomingCall}
          caller={state.profiles[other]}
          onAnswer={answerCall}
          onDismiss={() => setDismissedCallId(incomingCall.id)}
        />
      )}
    </div>
  )
}
