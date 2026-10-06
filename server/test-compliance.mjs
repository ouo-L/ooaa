/* 合规功能测试：举报 / 自动下架 / 拉黑 / 删帖 */
const BASE = 'http://localhost:7101'
let pass = 0, fail = 0
const ok = (c, l) => { c ? (pass++, console.log(`✅ ${l}`)) : (fail++, console.log(`❌ ${l}`)) }
const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json() }
}

const rnd = Math.random().toString(36).slice(2, 6)
const users = []
for (const n of ['甲', '乙', '丙', '丁']) {
  const r = await call('/api/register', { method: 'POST', body: { name: `${n}${rnd}`, password: '1234' } })
  users.push({ token: r.data.token, id: r.data.user.id, name: `${n}${rnd}` })
}
const [A, B, C, D] = users

// 甲发帖
const p = await call('/api/posts', { method: 'POST', token: A.token, body: { text: '测试帖' } })
const pid = p.data.post.id

// 举报：乙丙举报后仍在，丁举报后自动下架
await call('/api/posts/report', { method: 'POST', token: B.token, body: { id: pid, reason: '测试' } })
await call('/api/posts/report', { method: 'POST', token: C.token, body: { id: pid, reason: '测试' } })
let list = (await call('/api/posts')).data.posts
ok(list.some((x) => x.id === pid), '2 人举报后帖子仍在')
const dup = await call('/api/posts/report', { method: 'POST', token: B.token, body: { id: pid } })
ok(dup.status === 400, '重复举报被拒绝')
await call('/api/posts/report', { method: 'POST', token: D.token, body: { id: pid, reason: '测试' } })
list = (await call('/api/posts')).data.posts
ok(!list.some((x) => x.id === pid), '3 人举报后自动下架')

// 拉黑：甲拉黑乙 → 双方互相看不到对方帖子
const p2 = await call('/api/posts', { method: 'POST', token: A.token, body: { text: '甲的帖子' } })
const p3 = await call('/api/posts', { method: 'POST', token: B.token, body: { text: '乙的帖子' } })
await call('/api/user/block', { method: 'POST', token: A.token, body: { userId: B.id } })
const listA = (await call('/api/posts', { token: A.token })).data.posts
const listB = (await call('/api/posts', { token: B.token })).data.posts
ok(!listA.some((x) => x.id === p3.data.post.id), '甲看不到乙的帖子（我拉黑的）')
ok(!listB.some((x) => x.id === p2.data.post.id), '乙看不到甲的帖子（拉黑我的）')
const listC = (await call('/api/posts', { token: C.token })).data.posts
ok(listC.some((x) => x.id === p2.data.post.id), '丙不受影响，仍能看到')

// 删帖：乙删甲的被拒，甲删自己的成功
const delWrong = await call('/api/posts/delete', { method: 'POST', token: B.token, body: { id: p2.data.post.id } })
ok(delWrong.status === 403, '删别人帖子被拒绝')
const delOk = await call('/api/posts/delete', { method: 'POST', token: A.token, body: { id: p2.data.post.id } })
ok(delOk.status === 200, '甲删自己的帖子成功')

// 隐私政策页
const priv = await fetch(BASE + '/privacy.html')
ok(priv.status === 200 && (await priv.text()).includes('隐私政策'), '隐私政策页可访问')

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
