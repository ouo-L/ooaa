/**
 * 哦哦啊啊 · 多人版同步服务器
 * - 静态托管前端（../dist）
 * - 账号注册/登录、加好友绑定私密空间
 * - 私密空间（呼叫/分享/日记/打卡）按空间隔离，WebSocket 实时同步
 * - 公开论坛：发帖/点赞/评论，全网可见
 * - Web Push 通知
 * 用法：npm run build && npm run server
 */
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { WebSocketServer } from 'ws'
import webpush from 'web-push'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const DATA_FILE = path.join(__dirname, 'data.json')
const VAPID_FILE = path.join(__dirname, 'vapid.json')
const PORT = process.env.PORT ? Number(process.env.PORT) : 7101

/* ================= 数据层 ================= */

const defaultData = {
  users: [], // {id, name, avatar, passHash, salt, spaceId, createdAt}
  tokens: {}, // token -> userId
  friendReqs: [], // {id, fromId, toId, at}
  spaces: {}, // spaceId -> {id, members:[uid,uid], state}
  posts: [], // {id, authorId, authorName, authorAvatar, text, photo?, at, likes:[uid], comments:[]}
  pushSubs: {}, // userId -> [subscription]
}

function loadData() {
  try {
    return { ...defaultData, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  } catch {
    return { ...defaultData }
  }
}

let data = loadData()
let saveTimer = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data))
    } catch (e) {
      console.error('保存数据失败:', e.message)
    }
  }, 200)
}

function hashPass(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + password).digest('hex')
}

function findUser(id) {
  return data.users.find((u) => u.id === id) || null
}

function authUser(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const uid = t ? data.tokens[t] : null
  return uid ? findUser(uid) : null
}

function publicUser(u) {
  return u ? { id: u.id, name: u.name, avatar: u.avatar } : null
}

function newSpaceState(userA, userB) {
  return {
    profiles: {
      a: { name: userA.name, avatar: userA.avatar },
      b: { name: userB.name, avatar: userB.avatar },
    },
    pings: [],
    shares: [],
    diaries: [],
    statuses: { a: null, b: null },
    checkins: [],
    diaryGeneratedDays: [],
  }
}

/* ================= Web Push ================= */

function loadVapid() {
  try {
    return JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'))
  } catch {
    const keys = webpush.generateVAPIDKeys()
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2))
    return keys
  }
}
const vapid = loadVapid()
webpush.setVapidDetails('mailto:love@ooaa.local', vapid.publicKey, vapid.privateKey)

const PUSH_TEXT = {
  call: (name) => ({ title: `💗 ${name} 在呼叫你`, body: '快打开哦哦啊啊回应 TA！' }),
  answer: (name) => ({ title: `💞 ${name} 回应了你的呼叫`, body: 'TA 也在想你' }),
  share: (name) => ({ title: `📮 ${name} 分享了新动态`, body: '去看看 TA 的今天' }),
  checkin: (name) => ({ title: `💌 ${name} 发来一句情话`, body: '今天的打卡就差你了' }),
  status: (name) => ({ title: `💭 ${name} 更新了状态`, body: '去看看 TA 此刻的心情' }),
}

function pushTo(userId, title, body) {
  const payload = JSON.stringify({ title, body, url: './' })
  const subs = data.pushSubs[userId] || []
  for (const sub of [...subs]) {
    try {
      webpush.sendNotification(sub, payload).catch((err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          data.pushSubs[userId] = (data.pushSubs[userId] || []).filter(
            (s) => s.endpoint !== sub.endpoint,
          )
          scheduleSave()
        }
      })
    } catch {
      data.pushSubs[userId] = (data.pushSubs[userId] || []).filter(
        (s) => s.endpoint !== sub.endpoint,
      )
      scheduleSave()
    }
  }
}

/** 给我所在空间的另一半推送 */
function notifyPartner(fromUser, kind) {
  if (!fromUser.spaceId) return
  const space = data.spaces[fromUser.spaceId]
  if (!space) return
  const otherId = space.members.find((m) => m !== fromUser.id)
  if (!otherId) return
  const t = (PUSH_TEXT[kind] || PUSH_TEXT.share)(fromUser.name)
  pushTo(otherId, t.title, t.body)
}

/* ================= HTTP ================= */

function readBody(req) {
  return new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => {
      d += c
      if (d.length > 3e6) req.destroy() // 照片 base64 较大，上限 3MB
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(d))
      } catch {
        resolve(null)
      }
    })
  })
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

function mePayload(u) {
  const incoming = data.friendReqs
    .filter((r) => r.toId === u.id)
    .map((r) => {
      const f = findUser(r.fromId)
      return { reqId: r.id, fromId: r.fromId, name: f?.name || '?', avatar: f?.avatar || '💫' }
    })
  const outgoing = data.friendReqs
    .filter((r) => r.fromId === u.id)
    .map((r) => {
      const t = findUser(r.toId)
      return { reqId: r.id, toId: r.toId, name: t?.name || '?' }
    })
  let partner = null
  if (u.spaceId && data.spaces[u.spaceId]) {
    const otherId = data.spaces[u.spaceId].members.find((m) => m !== u.id)
    partner = publicUser(findUser(otherId))
  }
  return { user: publicUser(u), spaceId: u.spaceId || null, partner, incoming, outgoing }
}

async function handleApi(req, res, pathname) {
  const body = req.method === 'POST' ? await readBody(req) : null

  /* --- 推送 --- */
  if (pathname === '/api/push/key' && req.method === 'GET') {
    return json(res, 200, { publicKey: vapid.publicKey })
  }
  if (pathname === '/api/push/subscribe' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    const sub = body?.subscription
    if (!sub?.endpoint) return json(res, 400, { error: '无效订阅' })
    data.pushSubs[u.id] = data.pushSubs[u.id] || []
    if (!data.pushSubs[u.id].some((s) => s.endpoint === sub.endpoint)) {
      data.pushSubs[u.id].push(sub)
      scheduleSave()
    }
    return json(res, 200, { ok: true })
  }
  if (pathname === '/api/push/notify' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    notifyPartner(u, typeof body?.kind === 'string' ? body.kind : 'share')
    return json(res, 200, { ok: true })
  }

  /* --- 账号 --- */
  if (pathname === '/api/register' && req.method === 'POST') {
    const name = String(body?.name || '').trim()
    const password = String(body?.password || '')
    const avatar = String(body?.avatar || '💫')
    if (!name || name.length > 12) return json(res, 400, { error: '昵称必填且不超过 12 字' })
    if (password.length < 4) return json(res, 400, { error: '密码至少 4 位' })
    if (data.users.some((x) => x.name === name)) return json(res, 409, { error: '昵称已被占用' })
    const salt = crypto.randomBytes(8).toString('hex')
    const user = {
      id: crypto.randomUUID(),
      name,
      avatar,
      salt,
      passHash: hashPass(password, salt),
      spaceId: null,
      createdAt: Date.now(),
    }
    data.users.push(user)
    const token = crypto.randomUUID()
    data.tokens[token] = user.id
    scheduleSave()
    return json(res, 200, { token, ...mePayload(user) })
  }
  if (pathname === '/api/login' && req.method === 'POST') {
    const name = String(body?.name || '').trim()
    const password = String(body?.password || '')
    const u = data.users.find((x) => x.name === name)
    if (!u || u.passHash !== hashPass(password, u.salt))
      return json(res, 401, { error: '昵称或密码不对' })
    const token = crypto.randomUUID()
    data.tokens[token] = u.id
    scheduleSave()
    return json(res, 200, { token, ...mePayload(u) })
  }
  if (pathname === '/api/me' && req.method === 'GET') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    return json(res, 200, mePayload(u))
  }

  /* --- 好友绑定 --- */
  if (pathname === '/api/friends/add' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    if (u.spaceId) return json(res, 400, { error: '你已经有绑定的空间啦' })
    const name = String(body?.name || '').trim()
    const target = data.users.find((x) => x.name === name)
    if (!target) return json(res, 404, { error: '没有找到这个人，让 TA 先注册' })
    if (target.id === u.id) return json(res, 400, { error: '不能加自己哦' })
    if (target.spaceId) return json(res, 400, { error: 'TA 已经有绑定的空间了' })
    if (data.friendReqs.some((r) => r.fromId === u.id && r.toId === target.id))
      return json(res, 400, { error: '已经发过申请了，等 TA 通过' })
    // 对方已向我发过申请 → 直接结为空间
    const reverse = data.friendReqs.find((r) => r.fromId === target.id && r.toId === u.id)
    if (reverse) return acceptReq(u, reverse, res)
    data.friendReqs.push({ id: crypto.randomUUID(), fromId: u.id, toId: target.id, at: Date.now() })
    scheduleSave()
    pushTo(target.id, '💌 好友申请', `${u.name} 想和你绑定私密空间`)
    return json(res, 200, { ok: true, ...mePayload(u) })
  }
  if (pathname === '/api/friends/accept' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    const req0 = data.friendReqs.find((r) => r.id === String(body?.reqId) && r.toId === u.id)
    if (!req0) return json(res, 404, { error: '申请不存在' })
    return acceptReq(u, req0, res)
  }
  if (pathname === '/api/friends/decline' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    data.friendReqs = data.friendReqs.filter(
      (r) => !(r.id === String(body?.reqId) && r.toId === u.id),
    )
    scheduleSave()
    return json(res, 200, { ok: true, ...mePayload(u) })
  }

  /* --- 论坛（全网公开） --- */
  if (pathname === '/api/posts' && req.method === 'GET') {
    const list = [...data.posts].sort((a, b) => b.at - a.at).slice(0, 100)
    return json(res, 200, { posts: list })
  }
  if (pathname === '/api/posts' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    const text = String(body?.text || '').trim().slice(0, 500)
    const photo = typeof body?.photo === 'string' && body.photo.length < 2.5e6 ? body.photo : undefined
    if (!text && !photo) return json(res, 400, { error: '说点什么吧' })
    const post = {
      id: crypto.randomUUID(),
      authorId: u.id,
      authorName: u.name,
      authorAvatar: u.avatar,
      text,
      photo,
      at: Date.now(),
      likes: [],
      comments: [],
    }
    data.posts.push(post)
    if (data.posts.length > 2000) data.posts = data.posts.slice(-2000)
    scheduleSave()
    return json(res, 200, { ok: true, post })
  }
  if (pathname === '/api/posts/like' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    const post = data.posts.find((p) => p.id === String(body?.id))
    if (!post) return json(res, 404, { error: '帖子不存在' })
    const i = post.likes.indexOf(u.id)
    if (i >= 0) post.likes.splice(i, 1)
    else {
      post.likes.push(u.id)
      if (post.authorId !== u.id) pushTo(post.authorId, '❤️ 有人赞了你', `${u.name} 赞了你的帖子`)
    }
    scheduleSave()
    return json(res, 200, { ok: true, likes: post.likes.length, liked: i < 0 })
  }
  if (pathname === '/api/posts/comment' && req.method === 'POST') {
    const u = authUser(req)
    if (!u) return json(res, 401, { error: '未登录' })
    const post = data.posts.find((p) => p.id === String(body?.id))
    if (!post) return json(res, 404, { error: '帖子不存在' })
    const text = String(body?.text || '').trim().slice(0, 200)
    if (!text) return json(res, 400, { error: '评论不能为空' })
    post.comments.push({
      id: crypto.randomUUID(),
      authorId: u.id,
      authorName: u.name,
      authorAvatar: u.avatar,
      text,
      at: Date.now(),
    })
    scheduleSave()
    if (post.authorId !== u.id) pushTo(post.authorId, '💬 有人评论了你', `${u.name}：${text}`)
    return json(res, 200, { ok: true, comments: post.comments })
  }

  return json(res, 404, { error: '接口不存在' })
}

function acceptReq(u, req0, res) {
  const from = findUser(req0.fromId)
  if (!from) return json(res, 404, { error: '对方账号不存在' })
  if (u.spaceId || from.spaceId) {
    data.friendReqs = data.friendReqs.filter((r) => r.id !== req0.id)
    scheduleSave()
    return json(res, 400, { error: '有一方已经有空间了' })
  }
  const spaceId = crypto.randomUUID()
  data.spaces[spaceId] = {
    id: spaceId,
    members: [from.id, u.id], // a=发起方，b=接受方
    state: newSpaceState(from, u),
  }
  from.spaceId = spaceId
  u.spaceId = spaceId
  data.friendReqs = data.friendReqs.filter((r) => r.id !== req0.id)
  scheduleSave()
  pushTo(from.id, '💞 绑定成功', `${u.name} 接受了你的申请，你们的私密空间开通了！`)
  return json(res, 200, { ok: true, ...mePayload(u) })
}

/* ================= 静态文件 ================= */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

const server = http.createServer(async (req, res) => {
  let pathname = decodeURIComponent((req.url || '/').split('?')[0])
  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname)
  } catch (e) {
    console.error('API 错误:', e.message)
    return json(res, 500, { error: '服务器开小差了' })
  }

  if (pathname === '/') pathname = '/index.html'
  let file = path.join(DIST, pathname)
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html') // SPA 回退
  }
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(file).pipe(res)
})

/* ================= WebSocket（按空间隔离） ================= */

const wss = new WebSocketServer({ server, path: '/ws' })
const rooms = new Map() // spaceId -> Set<ws>

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams
  const token = q.get('token') || ''
  const spaceId = q.get('space') || ''
  const uid0 = data.tokens[token]
  const user = uid0 ? findUser(uid0) : null
  const space = spaceId ? data.spaces[spaceId] : null
  if (!user || !space || !space.members.includes(user.id)) {
    ws.close(4001, 'unauthorized')
    return
  }
  if (!rooms.has(spaceId)) rooms.set(spaceId, new Set())
  rooms.get(spaceId).add(ws)
  ws.send(JSON.stringify({ type: 'state', state: space.state }))

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg?.type === 'set' && msg.state && typeof msg.state === 'object') {
      space.state = { ...newSpaceState(...space.members.map(findUser)), ...msg.state }
      scheduleSave()
      const out = JSON.stringify({ type: 'state', state: space.state })
      for (const client of rooms.get(spaceId) || []) {
        if (client.readyState === 1) client.send(out)
      }
    }
  })
  ws.on('close', () => {
    const room = rooms.get(spaceId)
    if (room) {
      room.delete(ws)
      if (room.size === 0) rooms.delete(spaceId)
    }
  })
})

/* ================= 启动 ================= */

server.listen(PORT, '0.0.0.0', () => {
  console.log(`💞 哦哦啊啊 · 服务器已启动（多人版）`)
  console.log(`   本机访问:  http://localhost:${PORT}`)
  const ip = lanIp()
  if (ip) {
    const lanUrl = `http://${ip}:${PORT}`
    console.log(`   手机访问:  ${lanUrl}  (同一 Wi-Fi 直接打开)`)
    copyToClipboard(lanUrl)
  }
})

function lanIp() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

function copyToClipboard(text) {
  try {
    const clip = spawn('clip')
    clip.stdin.end(text)
    console.log(`   📋 手机地址已复制到剪贴板`)
  } catch {
    /* ignore */
  }
}
