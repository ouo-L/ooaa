/* 商店截图生成：注册演示账号 → 播种内容 → CDP 驱动 Edge 截屏 */
import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const BASE = 'http://localhost:7101'
const CDP_HTTP = 'http://127.0.0.1:9223'
const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '上架材料', 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json() }
}

/* ---------- 1. 准备演示数据 ---------- */
const reg = async (name, avatar) =>
  (await call('/api/register', { method: 'POST', body: { name, password: '1234', avatar } })).data
const A = await reg('啵啵', '🌟')
const B = await reg('噜噜', '🌙')
const C = await reg('桃桃', '🍑')

const addRes = await call('/api/friends/add', { method: 'POST', token: A.token, body: { name: '噜噜' } })
const meB = await call('/api/me', { token: B.token })
await call('/api/friends/accept', { method: 'POST', token: B.token, body: { reqId: meB.data.incoming[0].reqId } })
const spaceId = addRes.data.spaceId || (await call('/api/me', { token: A.token })).data.spaceId

/* 空间播种：状态/分享/打卡/日记 */
const ws = new WebSocket(`ws://localhost:7101/ws?space=${spaceId}&token=${A.token}`)
const initState = await new Promise((r) => ws.on('message', (d) => r(JSON.parse(d).state)))
const today = new Date()
const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const now = Date.now()
ws.send(
  JSON.stringify({
    type: 'set',
    state: {
      ...initState,
      statuses: {
        a: { role: 'a', mood: 'missing', note: '刚下班，突然好想你', at: now - 600000 },
        b: { role: 'b', mood: 'happy', note: '吃到好吃的啦', at: now - 300000 },
      },
      shares: [
        { id: 's1', author: 'a', text: '今天路过我们第一次约会的奶茶店，出了新品，下次带你去！', at: now - 7200000, day: dayKey },
        { id: 's2', author: 'b', text: '看！宿舍楼下的猫又来蹭我了，胖了一圈', at: now - 5400000, day: dayKey },
        { id: 's3', author: 'a', text: '加班到九点，好累，但是想到周末能见你就有力气了', at: now - 3600000, day: dayKey },
        { id: 's4', author: 'b', text: '那我周末给你带好吃的！想吃什么随便点', at: now - 1800000, day: dayKey },
      ],
      checkins: [
        { day: dayKey, messages: { a: '我对你的爱，就像拖拉机上山，轰轰烈烈。', b: '今天也很喜欢你，完毕。' } },
      ],
      diaries: [
        {
          id: 'd1',
          day: dayKey,
          title: `${today.getMonth() + 1}月${today.getDate()}日 · 我们的今天`,
          content:
            '又是隔着屏幕相爱的一天。\n\n啵啵路过了第一次约会的奶茶店，噜噜被楼下的猫选中啦。两个人碎碎念了一整天，把日子过给了对方看。\n\n晚安，明天也要继续喜欢彼此。',
          photos: [],
          generatedAt: now - 3600000,
        },
      ],
    },
  }),
)
await sleep(400)

/* 广场播种 */
const mk = async (token, text, likes = [], comments = []) => {
  const r = await call('/api/posts', { method: 'POST', token, body: { text } })
  const id = r.data.post.id
  for (const u of likes) await call('/api/posts/like', { method: 'POST', token: u.token, body: { id } })
  for (const c of comments) await call('/api/posts/comment', { method: 'POST', token: c.token, body: { id, text: c.text } })
  return id
}
await mk(A.token, '异地第三年，每天凌晨 App 会把我们白天分享的照片和碎碎念自动生成一篇日记。今天回头看了一年前的日记，看哭了。', [B, C], [
  { token: B.token, text: '那天你写了三页，我都留着' },
  { token: C.token, text: '这也太浪漫了吧，求同款对象' },
])
await mk(C.token, '在广场蹲一个每天互发情话打卡的搭子，哦不对，我已经有对象了', [A], [
  { token: A.token, text: '哈哈哈哈你去别处蹲' },
])
await mk(B.token, '啵啵刚才用呼叫功能震我，手机心跳声一响我就知道是他，秒回！💓', [A, C], [])

ws.close()

/* ---------- 2. CDP 截图 ---------- */
async function newTab() {
  const res = await fetch(`${CDP_HTTP}/json/new?about:blank`, { method: 'PUT' })
  return res.json()
}

let msgId = 0
function makeClient(wsUrl) {
  const sock = new WebSocket(wsUrl)
  const pending = new Map()
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId
      pending.set(id, resolve)
      sock.send(JSON.stringify({ id, method, params }))
    })
  return new Promise((r) => sock.on('open', () => r({ send, sock })))
}

const UNLOCK_HASH = '7b14a21bfa3f97598c7d18a38ccf195037a99865edbc2083d7004a9206873a95'

async function shot(name, actions = []) {
  const tab = await newTab()
  const { send, sock } = await makeClient(tab.webSocketDebuggerUrl)
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: `${BASE}/` })
  await sleep(2500)
  for (const act of actions) {
    await send('Runtime.evaluate', { expression: act, awaitPromise: true })
    await sleep(1400)
  }
  const cap = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(`${OUT}${name}.png`, Buffer.from(cap.result.data, 'base64'))
  console.log(`📸 ${name}.png`)
  await fetch(`${CDP_HTTP}/json/close/${tab.id}`).catch(() => {})
  sock.close()
}

const unlockAndLogin = `localStorage.setItem('yidi-universe-unlocked','${UNLOCK_HASH}');localStorage.setItem('ooaa-token','${A.token}');location.reload();''`
const clickTab = (label) =>
  `(()=>{const b=[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('${label}'));if(b)b.click();return !!b})()`
const clickBtn = (sel) =>
  `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('${sel}'));if(b)b.click();return !!b})()`

await shot('01-门禁')
await shot('02-首页', [unlockAndLogin])
await shot('03-分享', [clickTab('分享')])
await shot('04-打卡', [clickTab('打卡')])
await shot('05-日记', [clickTab('日记'), clickBtn('▼')])
await shot('06-广场', [clickTab('广场')])

console.log('done ->', OUT)
process.exit(0)
