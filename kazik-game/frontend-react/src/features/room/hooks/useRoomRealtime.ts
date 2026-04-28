import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

type WsPayload = Record<string, unknown>
type WsHandlers = Partial<Record<'TIMER_TICK' | 'ROOM_LOCKED' | 'BOTS_ADDED' | 'ROUND_RESULT' | 'ROUND_FINISHED' | 'PARTICIPANTS_SYNC', (data: WsPayload) => void>>

export function useRoomRealtime(roomId: number, userId: number, handlers: WsHandlers) {
  const clientRef = useRef<Client | null>(null)
  const roundFinishTimerRef = useRef<number | null>(null)
  const handlersRef = useRef(handlers)
  const participantsRef = useRef<Array<Record<string, unknown>>>([])

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const wsBase = import.meta.env.VITE_WS_BASE_URL || window.location.origin
    const wsHttpUrl = wsBase.replace(/^ws/i, 'http')
    const client = new Client({
      reconnectDelay: 2000,
      webSocketFactory: () => new SockJS(`${wsHttpUrl}/ws`),
      onConnect: () => {
        client.subscribe(`/topic/room/${roomId}`, (message) => {
          if (!message.body) return
          let payload: Record<string, unknown>
          try {
            payload = JSON.parse(message.body) as Record<string, unknown>
          } catch {
            return
          }
          const type = String(payload.type || '')
          const data = payload
          if (type === 'TIMER_TICK') {
            handlersRef.current.TIMER_TICK?.({ secondsLeft: Number(payload.secondsRemaining) || 0 })
            return
          }
          if (type === 'PARTICIPANT_UPDATE') {
            const participants = Array.isArray(payload.participants)
              ? payload.participants.map((participant) => {
                const p = participant as Record<string, unknown>
                const isBot = Boolean(p.isBot)
                return {
                  id: Number(p.id),
                  user_id: Number(p.userId ?? -Number(p.id)),
                  username: String(p.username ?? p.botName ?? `User_${p.userId ?? p.id}`),
                  display_name: isBot
                    ? String(p.botName ?? `Бот_${p.id}`)
                    : String(p.username ?? `User_${p.userId ?? p.id}`),
                  is_bot: isBot,
                  avatar: isBot ? '🤖' : '🎲',
                  talisman: isBot ? '🤖' : '🎲',
                  reserved_amount: 0,
                  boost_multiplier: p.boosted ? Number(import.meta.env.VITE_DEFAULT_BOOST_MULTIPLIER ?? 2) : 0,
                }
              })
              : []
            participantsRef.current = participants
            handlersRef.current.PARTICIPANTS_SYNC?.({ participants })
            return
          }
          if (type === 'ROUND_RESULT') {
            const winnerParticipantId = Number(payload.winnerParticipantId)
            const stripSize = Number(import.meta.env.VITE_ROULETTE_STRIP_SIZE ?? 80)
            const winIndex = Number(import.meta.env.VITE_ROULETTE_WIN_INDEX ?? 30)
            const snapshot = participantsRef.current
            const winner = snapshot.find((participant) => Number(participant.id) === winnerParticipantId)
            const source = snapshot.length > 0
              ? snapshot
              : [{
                id: winnerParticipantId,
                user_id: -winnerParticipantId,
                username: String(payload.winnerDisplayName ?? 'Победитель'),
                display_name: String(payload.winnerDisplayName ?? 'Победитель'),
                is_bot: Boolean(payload.winnerIsBot),
                avatar: Boolean(payload.winnerIsBot) ? '🤖' : '🎲',
              }]

            const laneStrip = Array.from({ length: stripSize }, (_, index) => {
              if (index === winIndex && winner) {
                return {
                  participantId: Number(winner.id),
                  displayName: String(winner.display_name ?? winner.username ?? 'Победитель'),
                  avatar: String(winner.avatar ?? (winner.is_bot ? '🤖' : '🎲')),
                }
              }
              const random = source[index % source.length]
              return {
                participantId: Number(random.id),
                displayName: String(random.display_name ?? random.username ?? `Участник_${random.id}`),
                avatar: String(random.avatar ?? (random.is_bot ? '🤖' : '🎲')),
              }
            })

            handlersRef.current.ROUND_RESULT?.({
              winnerParticipantId,
              winIndex,
              laneStrip,
            })
            if (roundFinishTimerRef.current) {
              window.clearTimeout(roundFinishTimerRef.current)
            }
            roundFinishTimerRef.current = window.setTimeout(() => {
              handlersRef.current.ROUND_FINISHED?.({
                winnerParticipantId,
                awardedAmount: Number(payload.payout) || 0,
                lingerSeconds: Number(import.meta.env.VITE_ROOM_LINGER_SECONDS ?? 20),
              })
            }, 100)
            return
          }
          const handler = handlersRef.current[type as keyof WsHandlers]
          handler?.(data)
        })

        client.publish({
          destination: `/app/room/${roomId}/ping`,
          body: JSON.stringify({ userId }),
        })
      },
      onStompError: () => {
        // reconnect is handled by reconnectDelay
      },
      onWebSocketError: () => {
        // reconnect is handled by reconnectDelay
      },
    })

    clientRef.current = client
    client.activate()

    return () => {
      if (roundFinishTimerRef.current) {
        window.clearTimeout(roundFinishTimerRef.current)
        roundFinishTimerRef.current = null
      }
      client.deactivate()
      clientRef.current = null
    }
  }, [roomId, userId])
}
