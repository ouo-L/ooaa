/* 双客户端互通测试：A 发呼叫，B 应实时收到 */
import WebSocket from 'ws'

const URL = 'ws://localhost:7101/ws'
const results = []

function client(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    const got = { initial: false, update: null }
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.type !== 'state') return
      if (!got.initial) {
        got.initial = true
        results.push(`${name}: 收到初始状态 (profiles=${Object.keys(msg.state.profiles).length})`)
      } else {
        got.update = msg.state
        const pings = msg.state.pings || []
        results.push(`${name}: 收到实时更新 (pings=${pings.length}, 来自=${pings.at(-1)?.from})`)
      }
    })
  })
}

const a = await client('阿星(手机A)')
const b = await client('阿月(手机B)')
await new Promise((r) => setTimeout(r, 300))

// 阿星发出呼叫
a.send(
  JSON.stringify({
    type: 'set',
    state: {
      profiles: { a: { name: '阿星', avatar: '🌟' }, b: { name: '阿月', avatar: '🌙' } },
      pings: [{ id: 'test-ping', from: 'a', kind: 'call', at: Date.now() }],
      shares: [],
      diaries: [],
      statuses: { a: null, b: null },
      checkins: [],
      diaryGeneratedDays: [],
    },
  }),
)
await new Promise((r) => setTimeout(r, 500))

console.log(results.join('\n'))
const ok = results.some((l) => l.includes('阿月(手机B): 收到实时更新') && l.includes('来自=a'))
console.log(ok ? '✅ 双客户端实时互通测试通过' : '❌ 测试失败：B 未收到更新')
a.close()
b.close()
process.exit(ok ? 0 : 1)
