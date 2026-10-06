export type Role = 'a' | 'b'

export interface Profile {
  name: string
  avatar: string // emoji
}

export interface Ping {
  id: string
  from: Role
  kind: 'call' | 'answer'
  at: number
}

export interface ShareItem {
  id: string
  author: Role
  text: string
  photo?: string // dataURL
  at: number
  day: string // YYYY-MM-DD
}

export interface DiaryEntry {
  id: string
  day: string
  title: string
  content: string
  photos: string[]
  generatedAt: number
}

export type MoodKey =
  | 'happy'
  | 'missing'
  | 'angry'
  | 'sad'
  | 'bored'
  | 'busy'
  | 'sleepy'
  | 'calm'

export interface UserInfo {
  id: string
  name: string
  avatar: string
}

export interface FriendReqView {
  reqId: string
  fromId?: string
  toId?: string
  name: string
  avatar?: string
}

export interface MeResponse {
  user: UserInfo
  spaceId: string | null
  partner: UserInfo | null
  incoming: FriendReqView[]
  outgoing: FriendReqView[]
}

export interface PostComment {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string
  text: string
  at: number
}

export interface Post {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string
  text: string
  photo?: string
  at: number
  likes: string[]
  comments: PostComment[]
}

export interface StatusEntry {
  role: Role
  mood: MoodKey
  note: string
  at: number
}

export interface Checkin {
  day: string // YYYY-MM-DD
  messages: Partial<Record<Role, string>>
}

export interface UniverseState {
  profiles: Record<Role, Profile>
  pings: Ping[]
  shares: ShareItem[]
  diaries: DiaryEntry[]
  statuses: Record<Role, StatusEntry | null>
  checkins: Checkin[]
  diaryGeneratedDays: string[]
}

export const MOODS: Record<MoodKey, { label: string; emoji: string; color: string }> = {
  happy: { label: '开心', emoji: '😊', color: '#fbbf24' },
  missing: { label: '想你', emoji: '🥺', color: '#f472b6' },
  angry: { label: '生气', emoji: '😤', color: '#ef4444' },
  sad: { label: '伤心', emoji: '😢', color: '#60a5fa' },
  bored: { label: '无聊', emoji: '🥱', color: '#a78bfa' },
  busy: { label: '忙碌', emoji: '💼', color: '#34d399' },
  sleepy: { label: '困困', emoji: '😴', color: '#818cf8' },
  calm: { label: '平静', emoji: '😌', color: '#2dd4bf' },
}

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
