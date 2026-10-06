import type { DiaryEntry, UniverseState } from '@/types'
import { dayKey } from '@/types'
import { uid } from '@/lib/store'

const OPENERS = [
  '又是隔着屏幕相爱的一天。',
  '距离没有把我们变小，反而把思念放大了。',
  '今天也好好地，把日子过给了对方看。',
  '两座城，一颗心，今天的碎片都在这里了。',
]

const CLOSERS = [
  '晚安，明天也要继续喜欢彼此。',
  '愿梦里没有距离。晚安。',
  '把今天收好，明天见。',
  '爱你，是今天也有做到的事。',
]

function fmtTime(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 把某一天的分享整理成一篇日记 */
export function composeDiary(state: UniverseState, day: string): DiaryEntry | null {
  const items = state.shares
    .filter((s) => s.day === day)
    .sort((x, y) => x.at - y.at)
  if (items.length === 0) return null

  const d = new Date(day + 'T12:00:00')
  const title = `${d.getMonth() + 1}月${d.getDate()}日 · 我们的今天`
  const opener = OPENERS[d.getDate() % OPENERS.length]
  const closer = CLOSERS[(d.getDate() + 1) % CLOSERS.length]

  const lines: string[] = [opener, '']
  for (const it of items) {
    const who = state.profiles[it.author]?.name ?? 'TA'
    const text = it.text.trim()
    if (it.photo && text) lines.push(`${fmtTime(it.at)}，${who}拍下了一张照片，说：「${text}」`)
    else if (it.photo) lines.push(`${fmtTime(it.at)}，${who}分享了一张照片。`)
    else lines.push(`${fmtTime(it.at)}，${who}说：「${text}」`)
  }
  const aCount = items.filter((i) => i.author === 'a').length
  const bCount = items.length - aCount
  lines.push('')
  lines.push(
    `今天，${state.profiles.a.name}分享了 ${aCount} 个瞬间，${state.profiles.b.name}分享了 ${bCount} 个瞬间。`,
  )
  lines.push(closer)

  return {
    id: uid(),
    day,
    title,
    content: lines.join('\n'),
    photos: items.filter((i) => i.photo).map((i) => i.photo!),
    generatedAt: Date.now(),
  }
}

/** 生成所有「已过去但还没出日记」的日子的日记，返回新增了几篇 */
export function generateDueDiaries(state: UniverseState): { next: UniverseState; added: number } {
  const today = dayKey()
  const days = [...new Set(state.shares.map((s) => s.day))]
    .filter((d) => d < today && !state.diaryGeneratedDays.includes(d))
    .sort()
  if (days.length === 0) return { next: state, added: 0 }

  const diaries = [...state.diaries]
  const generated = [...state.diaryGeneratedDays]
  for (const day of days) {
    const entry = composeDiary(state, day)
    generated.push(day)
    if (entry) diaries.unshift(entry)
  }
  return { next: { ...state, diaries, diaryGeneratedDays: generated }, added: days.length }
}
