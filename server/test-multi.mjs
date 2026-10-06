/* 哦哦啊啊多人版 · 全链路测试 */
import WebSocket from 'ws'

const BASE = 'http://localhost:7101'
let pass = 0
let fail = 0
const ok = (cond, label) => {
  if (cond) {
    pass++
    console.log(`✅ ${label}`)
  } else {
    fail++
    console.log(`❌ ${label}`)
  }
}

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json() }
}

const rnd = Math.random().toString(36).slice(2, 6)
const nameA = `啵啵${rnd}`
const nameB = `噜噜${rnd}`

// 1. 注册
const regA = await call('/api/register', { method: 'POST', body: { name: nameA, password: '1234', avatar: '🌟' } })
ok(regA.status === 200 && regA.data.token, `注册 ${nameA}`)
const regB = await call('/api/register', { method: 'POST', body: { name: nameB, password: '1234', avatar: '🌙' } })
ok(regB.status === 200 && regB.data.token, `注册 ${nameB}`)
const dup = await call('/api/register', { method: 'POST', body: { name: nameA, password: '9999' } })
ok(dup.status === 409, '重复昵称被拒绝')

// 2. 好友绑定（A 申请 → B 接受）
const add = await call('/api/friends/add', { method: 'POST', token: regA.data.token, body: { name: nameB } })
ok(add.status === 200, 'A 发送绑定申请')
const meB = await call('/api/me', { token: regB.data.token })
ok(meB.data.incoming.length === 1 && meB.data.incoming[0].name === nameA, 'B 收到申请')
const acc = await call('/api/friends/accept', { method: 'POST', token: regB.data.token, body: { reqId: meB.data.incoming[0].reqId } })
ok(acc.status === 200 && acc.data.spaceId, 'B 接受申请，空间开通')
const spaceId = acc.data.spaceId
const meA = await call('/api/me', { token: regA.data.token })
ok(meA.data.spaceId === spaceId && meA.data.partner?.name === nameB, 'A 看到伴侣信息')

// 3. 空间 WS 实时同步（A 发呼叫 → B 收到）
const wsB = new WebSocket(`ws://localhost:7101/ws?space=${spaceId}&token=${regB.data.token}`)
const gotB = new Promise((resolve) => {
  let first = true
  wsB.on('message', (d) => {
    const msg = JSON.parse(d)
    if (!first && msg.state?.pings?.length > 0) resolve(msg.state)
    first = false
  })
})
await new Promise((r) => wsB.on('open', r))
const wsA = new WebSocket(`ws://localhost:7101/ws?space=${spaceId}&token=${regA.data.token}`)
await new Promise((r) => wsA.on('open', r))
const initA = await new Promise((resolve) => wsA.once('message', (d) => resolve(JSON.parse(d).state)))
ok(initA.profiles.a.name === nameA && initA.profiles.b.name === nameB, '空间初始状态含双方资料')
wsA.send(JSON.stringify({ type: 'set', state: { ...initA, pings: [{ id: 'p1', from: 'a', kind: 'call', at: Date.now() }] } }))
const updated = await gotB
ok(updated.pings.at(-1).from === 'a', 'A 呼叫，B 实时收到')

// 未授权 WS 应被拒绝
const wsBad = new WebSocket(`ws://localhost:7101/ws?space=${spaceId}&token=bad`)
const badClosed = await new Promise((r) => wsBad.on('close', (code) => r(code)))
ok(badClosed === 4001, '非法 token 连接被拒绝')

// 4. 论坛
const post = await call('/api/posts', { method: 'POST', token: regA.data.token, body: { text: '今天和噜噜官宣啦💞' } })
ok(post.status === 200 && post.data.post.id, 'A 发帖')
const postId = post.data.post.id
const like = await call('/api/posts/like', { method: 'POST', token: regB.data.token, body: { id: postId } })
ok(like.data.liked === true && like.data.likes === 1, 'B 点赞')
const cmt = await call('/api/posts/comment', { method: 'POST', token: regB.data.token, body: { id: postId, text: 'mua~' } })
ok(cmt.data.comments.length === 1, 'B 评论')
const list = await call('/api/posts')
const found = list.data.posts.find((p) => p.id === postId)
ok(found && found.likes.length === 1 && found.comments[0].text === 'mua~', '帖子列表含点赞和评论')

// 5. 未登录保护
const noAuth = await call('/api/posts', { method: 'POST', body: { text: 'x' } })
ok(noAuth.status === 401, '未登录发帖被拒绝')

wsA.close()
wsB.close()
console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
