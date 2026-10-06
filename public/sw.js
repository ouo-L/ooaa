/* 两个人的小宇宙 · Service Worker：缓存应用外壳，弱网/离线也能秒开 */
const CACHE = 'yidi-universe-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // WebSocket 和非 GET 请求不拦截
  if (e.request.method !== 'GET' || url.pathname === '/ws') return
  // API 请求不缓存
  if (url.pathname.startsWith('/api/')) return
  // 网络优先，失败回缓存（保证双方看到的数据永远是新的）
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  )
})

/* ---------- 消息推送：App 没打开也能收到 ---------- */
self.addEventListener('push', (e) => {
  let data = { title: '💞 两个人的小宇宙', body: 'TA 找你了', url: './' }
  try {
    if (e.data) data = { ...data, ...e.data.json() }
  } catch {
    /* 保留默认文案 */
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'yidi-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200, 100, 400],
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow(e.notification.data?.url || './')
    }),
  )
})
