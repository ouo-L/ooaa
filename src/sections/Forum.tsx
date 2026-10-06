import { useCallback, useEffect, useRef, useState } from 'react'
import type { Post, UserInfo } from '@/types'
import { api } from '@/lib/api'
import { blip } from '@/lib/audio'
import { fileToDataUrl } from '@/lib/image'

interface Props {
  me: UserInfo
}

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

/** 功能五：论坛 —— 全网公开，发帖/点赞/评论 */
export default function Forum({ me }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [openComments, setOpenComments] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await api<{ posts: Post[] }>('/api/posts')
      setPosts(res.posts)
    } catch {
      /* 网络波动时保持现状 */
    }
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 15000)
    return () => window.clearInterval(t)
  }, [load])

  const publish = async () => {
    const t = text.trim()
    if ((!t && !photo) || busy) return
    setBusy(true)
    try {
      await api('/api/posts', { method: 'POST', body: { text: t, photo } })
      setText('')
      setPhoto(null)
      if (fileRef.current) fileRef.current.value = ''
      blip('message')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : '发布失败')
    } finally {
      setBusy(false)
    }
  }

  const like = async (id: string) => {
    try {
      await api('/api/posts/like', { method: 'POST', body: { id } })
      await load()
    } catch {
      /* ignore */
    }
  }

  const comment = async (id: string) => {
    const t = commentText.trim()
    if (!t) return
    try {
      await api('/api/posts/comment', { method: 'POST', body: { id, text: t } })
      setCommentText('')
      await load()
    } catch {
      /* ignore */
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-base font-bold text-rose-950">🌍 广场</h2>
      <p className="mb-4 text-xs text-rose-900/50">这里全网可见，分享你们的故事，给别人的爱情点个赞</p>

      {/* 发帖 */}
      <div className="rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="说点什么，大家都在听……"
          className="w-full resize-none rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none placeholder:text-rose-900/30 focus:border-rose-300"
        />
        {photo && (
          <div className="relative mt-2 w-28">
            <img src={photo} alt="待发布" className="h-28 w-28 rounded-xl object-cover" />
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
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setPhoto(await fileToDataUrl(f).catch(() => null))
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-xl bg-rose-50 py-2 text-sm text-rose-600 transition hover:bg-rose-100"
          >
            📷 加图
          </button>
          <button
            onClick={() => void publish()}
            disabled={busy || (!text.trim() && !photo)}
            className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-[0.98] disabled:opacity-50"
          >
            发布 🚀
          </button>
        </div>
      </div>

      {/* 帖子流 */}
      <div className="mt-5 space-y-3">
        {posts.length === 0 && (
          <p className="py-10 text-center text-xs text-rose-900/35">还没有帖子，来发第一条吧 🌷</p>
        )}
        {posts.map((p) => {
          const liked = p.likes.includes(me.id)
          const commenting = openComments === p.id
          return (
            <article key={p.id} className="rounded-3xl bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-lg">
                  {p.authorAvatar}
                </span>
                <span className="text-sm font-bold text-rose-950">{p.authorName}</span>
                <span className="ml-auto text-[10px] text-rose-900/35">{timeAgo(p.at)}</span>
              </div>
              {p.text && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-rose-950/85">
                  {p.text}
                </p>
              )}
              {p.photo && (
                <img src={p.photo} alt="帖子图片" className="mt-2 max-h-72 w-full rounded-xl object-cover" />
              )}
              <div className="mt-3 flex gap-4 border-t border-rose-100/70 pt-2.5">
                <button
                  onClick={() => void like(p.id)}
                  className={`flex items-center gap-1 text-xs font-semibold transition active:scale-110 ${
                    liked ? 'text-rose-500' : 'text-rose-900/40 hover:text-rose-400'
                  }`}
                >
                  {liked ? '❤️' : '🤍'} {p.likes.length > 0 ? p.likes.length : '点赞'}
                </button>
                <button
                  onClick={() => setOpenComments(commenting ? null : p.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-900/40 transition hover:text-rose-400"
                >
                  💬 {p.comments.length > 0 ? p.comments.length : '评论'}
                </button>
              </div>
              {commenting && (
                <div className="mt-3 border-t border-rose-100/70 pt-3">
                  {p.comments.map((c) => (
                    <div key={c.id} className="mb-2 flex gap-2 text-xs last:mb-0">
                      <span>{c.authorAvatar}</span>
                      <p className="flex-1">
                        <span className="font-semibold text-rose-950">{c.authorName}：</span>
                        <span className="text-rose-950/75">{c.text}</span>
                      </p>
                    </div>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void comment(p.id)}
                      maxLength={200}
                      placeholder="友善评论……"
                      className="flex-1 rounded-xl border border-rose-100 bg-white px-3 py-1.5 text-xs outline-none placeholder:text-rose-900/30 focus:border-rose-300"
                    />
                    <button
                      onClick={() => void comment(p.id)}
                      className="rounded-xl bg-rose-500 px-3 text-xs font-semibold text-white transition hover:bg-rose-600"
                    >
                      发送
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
