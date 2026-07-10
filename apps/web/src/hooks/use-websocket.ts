'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Log } from '@/types'

interface UseWebSocketOptions {
  projectId?: string
  enabled?: boolean
  /** Stop auto-reconnect after this many failures (default 5). */
  maxReconnectAttempts?: number
}

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unavailable'

interface UseWebSocketReturn {
  logs: Log[]
  isConnected: boolean
  /** True after max reconnect attempts without success. */
  isUnavailable: boolean
  streamStatus: StreamStatus
  error: Error | null
  /** Manual retry after unavailable. */
  retry: () => void
}

/**
 * Build a WebSocket base URL ending in `/v1` (no trailing `/stream`).
 */
export function resolveWebSocketBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080/v1'

  let url = raw.trim().replace(/\/+$/, '')

  url = url.replace(/\/api\/v1(?=\/|$)/, '/v1')
  url = url.replace(/\/stream$/i, '')

  if (url.startsWith('https://')) {
    url = 'wss://' + url.slice('https://'.length)
  } else if (url.startsWith('http://')) {
    url = 'ws://' + url.slice('http://'.length)
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    const scheme =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? 'wss'
        : 'ws'
    url = `${scheme}://${url.replace(/^\/\//, '')}`
  }

  try {
    const parsed = new URL(url)
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/v1'
      url = parsed.toString().replace(/\/+$/, '')
    }
  } catch {
    // leave as-is
  }

  return url.replace(/\/+$/, '')
}

export function useWebSocket({
  projectId,
  enabled = true,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<Log[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isUnavailable, setIsUnavailable] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const intentionalCloseRef = useRef(false)
  const attemptsRef = useRef(0)
  const connectRef = useRef<() => void>(() => {})

  const clearReconnectTimer = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
  }

  const connect = useCallback(() => {
    if (!projectId || !session?.accessToken || !enabled) return

    intentionalCloseRef.current = true
    clearReconnectTimer()
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'reconnect')
      } catch {
        /* ignore */
      }
      wsRef.current = null
    }
    intentionalCloseRef.current = false

    setStreamStatus(attemptsRef.current > 0 ? 'reconnecting' : 'connecting')
    setIsUnavailable(false)

    const base = resolveWebSocketBaseUrl()
    const params = new URLSearchParams({
      projectId,
      token: session.accessToken,
    })
    const wsUrl = `${base}/stream?${params.toString()}`

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error('Failed to open WebSocket'),
      )
      setIsConnected(false)
      attemptsRef.current += 1
      if (attemptsRef.current >= maxReconnectAttempts) {
        setIsUnavailable(true)
        setStreamStatus('unavailable')
      } else {
        setStreamStatus('reconnecting')
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current()
        }, Math.min(1000 * 2 ** (attemptsRef.current - 1), 8000))
      }
      return
    }

    ws.onopen = () => {
      attemptsRef.current = 0
      setIsConnected(true)
      setIsUnavailable(false)
      setStreamStatus('connected')
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const raw: string =
          typeof event.data === 'string' ? event.data : String(event.data)
        const newLogs: Log[] = []
        for (const line of raw.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>
            if (parsed.type && !parsed.id) continue
            if (typeof parsed.id !== 'number' && typeof parsed.id !== 'string') {
              continue
            }
            newLogs.push(parsed as unknown as Log)
          } catch {
            // skip bad line
          }
        }
        if (newLogs.length > 0) {
          setIsConnected(true)
          setIsUnavailable(false)
          setStreamStatus('connected')
          setLogs((prev) =>
            [...[...newLogs].reverse(), ...prev].slice(0, 100),
          )
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = () => {
      setError(new Error('WebSocket connection error'))
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      if (intentionalCloseRef.current) return

      if (event.code !== 1000) {
        setError(
          new Error(
            `WebSocket closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`,
          ),
        )
      }

      attemptsRef.current += 1
      if (attemptsRef.current >= maxReconnectAttempts) {
        setIsUnavailable(true)
        setStreamStatus('unavailable')
        return
      }

      setStreamStatus('reconnecting')
      const delay = Math.min(1000 * 2 ** (attemptsRef.current - 1), 8000)
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current()
      }, delay)
    }

    wsRef.current = ws
  }, [projectId, session?.accessToken, enabled, maxReconnectAttempts])

  connectRef.current = connect

  const retry = useCallback(() => {
    attemptsRef.current = 0
    setIsUnavailable(false)
    setError(null)
    connect()
  }, [connect])

  useEffect(() => {
    attemptsRef.current = 0
    connect()

    return () => {
      intentionalCloseRef.current = true
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'unmount')
        } catch {
          /* ignore */
        }
        wsRef.current = null
      }
      clearReconnectTimer()
    }
  }, [connect])

  useEffect(() => {
    setLogs([])
    attemptsRef.current = 0
    setIsUnavailable(false)
  }, [projectId])

  return {
    logs,
    isConnected,
    isUnavailable,
    streamStatus,
    error,
    retry,
  }
}
