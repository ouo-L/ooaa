import { api } from '@/lib/api'

/**
 * Web Push 客户端：订阅推送 + 通知对方（服务器按账号找到 TA）
 * 需要在用户手势后调用 setupPush（浏览器限制）
 */

function b64ToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** 请求通知权限并订阅推送，静默失败不打扰用户 */
export async function setupPush(): Promise<void> {
  if (!pushSupported()) return
  try {
    if (Notification.permission === 'denied') return
    const perm =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
    if (perm !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    const { publicKey } = await api<{ publicKey: string }>('/api/push/key')
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(publicKey) as BufferSource,
      })
    }
    await api('/api/push/subscribe', {
      method: 'POST',
      body: { subscription: sub.toJSON() },
    })
  } catch {
    /* 订阅失败不影响主功能 */
  }
}

/** 告诉服务器：给 TA 推一条通知 */
export function notifyPartner(kind: 'call' | 'answer' | 'share' | 'checkin' | 'status') {
  api('/api/push/notify', { method: 'POST', body: { kind } }).catch(() => {})
}
