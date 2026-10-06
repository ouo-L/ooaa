import { useSyncExternalStore } from 'react'
import type { UniverseState } from '@/types'

/**
 * 哦哦啊啊 · 空间数据层
 * 连接服务器上「我的私密空间」，WebSocket 实时同步。
 * 未连接时渲染默认空状态。
 */

const defaultState: UniverseState = {
  profiles: {
    a: { name: '啵啵', avatar: '🌟' },
    b: { name: '噜噜', avatar: '🌙' },
  },
  pings: [],
  shares: [],
  diaries: [],
  statuses: { a: null, b: null },
  checkins: [],
  diaryGeneratedDays: [],
}

let state: UniverseState = defaultState
let connected = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

let ws: WebSocket | null = null
let wsReady = false
let currentSpace: string | null = null

/** 连接我的私密空间（登录并绑定空间后调用） */
export function connectSpace(spaceId: string, token: string) {
  if (currentSpace === spaceId && ws) return
  disconnectSpace()
  currentSpace = spaceId

  const open = () => {
    if (currentSpace !== spaceId) return
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(
        `${proto}://${location.host}/ws?space=${encodeURIComponent(spaceId)}&token=${encodeURIComponent(token)}`,
      )
    } catch {
      window.setTimeout(open, 3000)
      return
    }
    ws.onopen = () => {
      wsReady = true
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg?.type === 'state' && msg.state) {
          state = { ...defaultState, ...msg.state }
          connected = true
          emit()
        }
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      wsReady = false
      if (currentSpace === spaceId) window.setTimeout(open, 3000) // 断线重连
    }
    ws.onerror = () => ws?.close()
  }
  open()
}

export function disconnectSpace() {
  currentSpace = null
  wsReady = false
  if (ws) {
    const w = ws
    ws = null
    w.onclose = null
    try {
      w.close()
    } catch {
      /* ignore */
    }
  }
  state = defaultState
  connected = false
  emit()
}

export function isConnected(): boolean {
  return connected
}

export function getState(): UniverseState {
  return state
}

export function setState(updater: (s: UniverseState) => UniverseState) {
  state = updater(state)
  emit()
  if (wsReady && ws) {
    try {
      ws.send(JSON.stringify({ type: 'set', state }))
    } catch {
      /* ignore */
    }
  }
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useUniverse(): UniverseState {
  return useSyncExternalStore(subscribe, getState)
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
