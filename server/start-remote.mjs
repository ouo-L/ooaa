/**
 * 一键异地模式：本地服务器 + Cloudflare 公网隧道
 * 运行后把打印出的 https://xxx.trycloudflare.com 发给 TA，两台手机都能访问。
 * Ctrl+C 停止一切。
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html')
const CLOUDFLARED = path.join(ROOT, 'tools', 'cloudflared.exe')
const PORT = 7101

const children = []
function cleanup() {
  for (const c of children) {
    try {
      c.kill()
    } catch {
      /* already dead */
    }
  }
  process.exit(0)
}
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

/* 1. 确保前端已构建 */
if (!fs.existsSync(DIST_INDEX)) {
  console.log('📦 首次运行，正在构建前端……')
  const r = spawnSync('npm.cmd', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error('❌ 构建失败，请先手动运行 npm run build')
    process.exit(1)
  }
}
if (!fs.existsSync(CLOUDFLARED)) {
  console.error('❌ 缺少 tools/cloudflared.exe')
  process.exit(1)
}

/* 2. 启动应用服务器 */
const server = spawn(process.execPath, [path.join(__dirname, 'server.mjs')], { stdio: 'pipe' })
children.push(server)
server.stdout.on('data', (d) => process.stdout.write(d))
server.stderr.on('data', (d) => process.stderr.write(d))

function waitPort(port, tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (n <= 0) return reject(new Error('服务器启动超时'))
        setTimeout(() => attempt(n - 1), 500)
      })
    }
    attempt(tries)
  })
}

await waitPort(PORT)
console.log('✅ 本地服务器已就绪')

/* 3. 启动 Cloudflare 快速隧道并解析公网地址 */
const tunnel = spawn(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
children.push(tunnel)

let announced = false
function handleLine(line) {
  const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
  if (m && !announced) {
    announced = true
    const publicUrl = m[0]
    console.log('')
    console.log('══════════════════════════════════════════════════')
    console.log('💞 异地模式已开启！把这个地址发给 TA：')
    console.log('')
    console.log(`   ${publicUrl}`)
    console.log('')
    const ip = lanIp()
    if (ip) {
      console.log(`   (同一 Wi-Fi 下用手机访问更快: http://${ip}:${PORT})`)
      console.log('')
    }
    console.log('   两台手机都打开它，各选「我是阿星 / 我是阿月」')
    console.log('   关掉本窗口即断开连接。')
    console.log('══════════════════════════════════════════════════')
    try {
      const clip = spawn('clip')
      clip.stdin.end(publicUrl)
      console.log('📋 公网地址已复制到剪贴板，直接粘贴发给 TA 即可')
    } catch {
      /* clip 不可用则忽略 */
    }
    try {
      fs.writeFileSync(
        path.join(ROOT, '公网地址.txt'),
        `把这个地址发给 TA，两台手机都打开它：\n\n${publicUrl}\n\n同一 Wi-Fi 下更快：${ip ? `http://${ip}:${PORT}` : '(未检测到)'}\n`,
        'utf8',
      )
    } catch {
      /* 写文件失败则忽略 */
    }
  }
}

/** 取本机局域网 IPv4 地址 */
function lanIp() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}
let buf = ''
tunnel.stderr.on('data', (d) => {
  buf += d.toString()
  const lines = buf.split(/\r?\n/)
  buf = lines.pop() || ''
  lines.forEach(handleLine)
})
tunnel.on('exit', (code) => {
  if (!announced) {
    console.error(`❌ 隧道启动失败（cloudflared 退出码 ${code}），请检查网络后重试`)
    cleanup()
  }
})
