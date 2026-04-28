import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiClient, type RoomDetail, type RoomParticipant } from '../../shared/api/client'
import { useRoomRealtime } from './hooks/useRoomRealtime'
import { CaseRoulette, type CaseRouletteItem } from './components/CaseRoulette'
import { WinnerCelebration } from './components/WinnerCelebration'
import { StolotoLogo } from '../../shared/ui/StolotoLogo'

type Props = {
  roomId: number
  userId: number
  onExit: () => void
  toast: (message: string, type?: string) => void
  onOpenInstruction?: () => void
}

type Winner = { avatar: string; displayName: string }
type RoundLaneParticipant = { participantId: number; displayName: string; avatar: string }
type RoundLaneItem = CaseRouletteItem & { participantId: number }
type CoinParticle = { id: number; left: number; delay: number; duration: number; size: number; drift: number }
type RoundFinishedPayload = {
  lingerSeconds?: number
  winnerUsername?: string
  winnerId?: number | null
  winnerParticipantId?: number | null
  awardedAmount?: number
}
const DEFAULT_WIN_INDEX = 30
const DEFAULT_STRIP_SIZE = 80
const RARITY_PALETTE = ['#b0c3d9', '#5e98d9', '#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#ffd700']
const RARITY_LABELS = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5', 'Tier 6', 'Tier 7']
const INITIAL_WAIT_SECONDS = Number(import.meta.env.VITE_DEFAULT_WAITING_SECONDS ?? 60)

function rarityFromSeed(seedText: string, index: number) {
  const seed = [...seedText].reduce((acc, char) => acc + char.charCodeAt(0), 0) + index
  const paletteIndex = seed % RARITY_PALETTE.length
  return { rarityColor: RARITY_PALETTE[paletteIndex], rarity: RARITY_LABELS[paletteIndex] }
}

function participantToRouletteItem(participant: { displayName: string; avatar: string }, index: number): CaseRouletteItem {
  const rarity = rarityFromSeed(participant.displayName, index)
  return {
    name: participant.displayName,
    icon: participant.avatar || '🎲',
    rarity: rarity.rarity,
    rarityColor: rarity.rarityColor,
  }
}

function laneParticipantToRouletteItem(participant: RoundLaneParticipant, index: number): RoundLaneItem {
  const rarity = rarityFromSeed(participant.displayName, index)
  return {
    participantId: participant.participantId,
    name: participant.displayName,
    icon: participant.avatar || '🎲',
    rarity: rarity.rarity,
    rarityColor: rarity.rarityColor,
  }
}

function buildFallbackStrip(participants: RoomParticipant[], total: number): CaseRouletteItem[] {
  const base = participants.map((participant, index) => participantToRouletteItem({
    displayName: participant.display_name || participant.username,
    avatar: participant.avatar || participant.talisman || (participant.is_bot ? '🤖' : '🦊'),
  }, index))
  const source = base.length ? base : [{ name: 'Участник', icon: '🎲', rarity: 'Consumer', rarityColor: '#b0c3d9' }]
  return Array.from({ length: total }, (_, index) => source[index % source.length])
}

export function RoomPage({ roomId, userId, onExit, toast, onOpenInstruction }: Props) {
  const api = useMemo(() => new ApiClient(), [])
  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [participants, setParticipants] = useState<RoomParticipant[]>([])
  const [timer, setTimer] = useState<number>(INITIAL_WAIT_SECONDS)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [winnerVisible, setWinnerVisible] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [rouletteItems, setRouletteItems] = useState<CaseRouletteItem[]>([])
  const [winIndex, setWinIndex] = useState<number | null>(DEFAULT_WIN_INDEX)
  const [roundStripLocked, setRoundStripLocked] = useState(false)
  const [spinCompleted, setSpinCompleted] = useState(false)
  const [roundFinishedReceived, setRoundFinishedReceived] = useState(false)
  const [animatedBalance, setAnimatedBalance] = useState(0)
  const [balanceGainFx, setBalanceGainFx] = useState<number | null>(null)
  const [coinRain, setCoinRain] = useState<CoinParticle[]>([])
  const [boostConfirmVisible, setBoostConfirmVisible] = useState(false)
  const [boostSuccessFx, setBoostSuccessFx] = useState<{ oldChance: number; newChance: number } | null>(null)
  const [awaitingRematchDecision, setAwaitingRematchDecision] = useState(false)
  const [rematchProcessing, setRematchProcessing] = useState(false)
  const [isEntering, setIsEntering] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const roomCloseTimeoutRef = useRef<number | null>(null)
  const winnerHideTimeoutRef = useRef<number | null>(null)
  const balanceFxTimeoutRef = useRef<number | null>(null)
  const coinRainTimeoutRef = useRef<number | null>(null)
  const pendingRoundFinishRef = useRef<RoundFinishedPayload | null>(null)
  const exitingRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 700) // matches door opening duration
    return () => clearTimeout(timer)
  }, [])

  const handleExit = useCallback(() => {
    if (exitingRef.current) return
    exitingRef.current = true
    setIsExiting(true)
    setTimeout(() => {
      onExit()
    }, 500) // matches door closing duration
  }, [onExit])

  const refreshRoom = useCallback(async () => {
    try {
      const data = await api.getRoom(roomId)
      setRoom(data)
      setParticipants(data.participants || [])
      if (typeof data.time_remaining === 'number') setTimer(data.time_remaining)
      
      if (data.status === 'running' && data.active_spin) {
        const spinData = data.active_spin as { lane_participant_ids?: number[]; win_index?: number }
        const participantIds: number[] = spinData.lane_participant_ids || []
        const laneStrip: RoundLaneParticipant[] = participantIds.map((pid) => {
          const p = data.participants?.find((part) => part.id === pid)
          return {
            participantId: pid,
            displayName: p?.display_name || "Участник",
            avatar: p?.avatar || "🎲",
            isBot: p?.is_bot || false
          }
        })
        const nextWinIndex = typeof spinData.win_index === 'number' ? spinData.win_index : DEFAULT_WIN_INDEX

        setRoundStripLocked(true)
        setSpinCompleted(false)
        setRoundFinishedReceived(false)
        pendingRoundFinishRef.current = null
        setWinIndex(nextWinIndex)

        if (laneStrip.length > nextWinIndex) {
          const preparedStrip = laneStrip.map((participant, index) => laneParticipantToRouletteItem(participant, index))
          setRouletteItems(preparedStrip)
          const resolvedWinner = laneStrip[nextWinIndex]
          if (resolvedWinner) {
            setWinner({ avatar: resolvedWinner.avatar, displayName: resolvedWinner.displayName })
          } else {
            setWinner(null)
          }
        } else {
          setRouletteItems(buildFallbackStrip(data.participants || [], Math.max(DEFAULT_STRIP_SIZE, nextWinIndex + 5)))
          setWinner(null)
        }
        setWinnerVisible(false)
        setIsSpinning(true)
      }
      
      const amParticipant = (data.participants || []).some((p) => p.user_id === userId && !p.is_bot)
      if (!amParticipant && !awaitingRematchDecision) handleExit()
    } catch (e) {
      if (e instanceof Error) toast(e.message, 'error')
      handleExit()
    }
  }, [api, roomId, userId, handleExit, toast, awaitingRematchDecision])

  const refreshBalance = useCallback(async () => {
    try {
      const profile = await api.getUserProfile(userId, 1)
      setAnimatedBalance(profile.bonus_balance)
    } catch {
      // ignore
    }
  }, [api, userId])

  useEffect(() => {
    let ignore = false
    window.setTimeout(() => {
      if (!ignore) {
        refreshRoom()
        refreshBalance()
      }
    }, 0)
    return () => { ignore = true }
  }, [refreshRoom, refreshBalance])

  useEffect(() => {
    return () => {
      if (roomCloseTimeoutRef.current) {
        window.clearTimeout(roomCloseTimeoutRef.current)
      }
      if (winnerHideTimeoutRef.current) {
        window.clearTimeout(winnerHideTimeoutRef.current)
      }
      if (balanceFxTimeoutRef.current) {
        window.clearTimeout(balanceFxTimeoutRef.current)
      }
      if (coinRainTimeoutRef.current) {
        window.clearTimeout(coinRainTimeoutRef.current)
      }
      pendingRoundFinishRef.current = null
    }
  }, [])

  const applyRoundFinished = useCallback((data: RoundFinishedPayload) => {
    setIsSpinning(false)
    setRoundStripLocked(false)
    setRoundFinishedReceived(true)
    setRoom((prev) => (prev ? { ...prev, status: 'finished' } : prev))
    setTimer(0)
    setWinnerVisible(true)
    setAwaitingRematchDecision(true)
    const awardedAmount = Number(data.awardedAmount) || 0
    const winnerParticipant = participants.find((participant) => participant.id === data.winnerParticipantId)
    const winnerUserId = data.winnerId ?? winnerParticipant?.user_id ?? null
    if (winnerUserId === userId && awardedAmount > 0) {
      const from = animatedBalance
      const to = from + awardedAmount
      const startAt = performance.now()
      const duration = 1700
      const tick = (ts: number) => {
        const progress = Math.min(1, (ts - startAt) / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        setAnimatedBalance(Math.round(from + (to - from) * eased))
        if (progress < 1) {
          requestAnimationFrame(tick)
        } else {
          setAnimatedBalance(to)
        }
      }
      requestAnimationFrame(tick)
      setBalanceGainFx(awardedAmount)
      setCoinRain(Array.from({ length: 30 }, (_, idx) => ({
        id: idx,
        left: Math.random() * 100,
        delay: Math.random() * 0.55,
        duration: 1.8 + Math.random() * 1.5,
        size: 16 + Math.floor(Math.random() * 14),
        drift: -24 + Math.random() * 48,
      })))
      if (balanceFxTimeoutRef.current) window.clearTimeout(balanceFxTimeoutRef.current)
      balanceFxTimeoutRef.current = window.setTimeout(() => setBalanceGainFx(null), 2600)
      if (coinRainTimeoutRef.current) window.clearTimeout(coinRainTimeoutRef.current)
      coinRainTimeoutRef.current = window.setTimeout(() => setCoinRain([]), 3200)
    } else {
      refreshBalance().catch(() => undefined)
    }
    if (winnerHideTimeoutRef.current) window.clearTimeout(winnerHideTimeoutRef.current)
    winnerHideTimeoutRef.current = window.setTimeout(() => setWinnerVisible(false), 3000)
    window.setTimeout(() => {
      refreshRoom().catch(() => undefined)
    }, 1200)
  }, [animatedBalance, participants, refreshBalance, refreshRoom, userId])

  useEffect(() => {
    if (roundStripLocked || isSpinning) {
      return
    }
    // Delay state update to avoid synchronous cascading renders
    const timerId = window.setTimeout(() => {
      setRouletteItems(buildFallbackStrip(participants, DEFAULT_STRIP_SIZE))
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [participants, isSpinning, roundStripLocked])

  const wsHandlers = useMemo(() => ({
    TIMER_TICK: (data: { secondsLeft?: number }) => setTimer(Number(data.secondsLeft) || 0),
    BOTS_ADDED: () => {
      // Delay to avoid cascading renders
      window.setTimeout(() => refreshRoom().catch(() => undefined), 0)
    },
    PARTICIPANTS_SYNC: (data: { participants?: RoomParticipant[] }) => {
      setParticipants(data.participants || [])
    },
    ROOM_LOCKED: () => setRoom((prev) => (prev ? { ...prev, status: 'locked' } : prev)),
    ROUND_RESULT: (data: { laneStrip?: RoundLaneParticipant[]; winIndex?: number; winnerParticipantId?: number }) => {
      setAwaitingRematchDecision(false)
      setRoundStripLocked(true)
      setSpinCompleted(false)
      setRoundFinishedReceived(false)
      pendingRoundFinishRef.current = null
      const laneStrip = data.laneStrip || []
      const nextWinIndex = typeof data.winIndex === 'number' ? data.winIndex : DEFAULT_WIN_INDEX
      console.debug('[RoomPage] ROUND_RESULT received', {
        roomId,
        winnerParticipantId: data.winnerParticipantId,
        winIndex: nextWinIndex,
        laneStripCount: laneStrip.length,
      })
      setWinIndex(nextWinIndex)
      if (laneStrip.length > nextWinIndex) {
        const preparedStrip = laneStrip.map((participant, index) => laneParticipantToRouletteItem(participant, index))
        setRouletteItems(preparedStrip)

        const winnerByIndex = laneStrip[nextWinIndex] || null
        const winnerById = typeof data.winnerParticipantId === 'number'
          ? laneStrip.find((participant) => participant.participantId === data.winnerParticipantId) || null
          : null

        if (winnerByIndex && winnerById && winnerByIndex.participantId !== winnerById.participantId) {
          console.error('[RoomPage] Backend ROUND_RESULT mismatch: winnerParticipantId != laneStrip[winIndex]', {
            winnerParticipantId: winnerById.participantId,
            laneWinnerParticipantId: winnerByIndex.participantId,
            winIndex: nextWinIndex,
          })
        }

        let resolvedWinner = winnerByIndex || winnerById
        if (!resolvedWinner && typeof data.winnerParticipantId === 'number') {
          const participant = participants.find((item) => item.id === data.winnerParticipantId)
          if (participant) {
            resolvedWinner = {
              participantId: participant.id,
              displayName: participant.display_name || participant.username,
              avatar: participant.avatar || participant.talisman || (participant.is_bot ? '🤖' : '🎲'),
            }
          }
        }
        if (resolvedWinner) {
          console.debug('[RoomPage] Winner resolved from server laneStrip', {
            participantId: resolvedWinner.participantId,
            displayName: resolvedWinner.displayName,
          })
          setWinner({ avatar: resolvedWinner.avatar, displayName: resolvedWinner.displayName })
        } else {
          console.warn('[RoomPage] Winner is unresolved for ROUND_RESULT', { winIndex: nextWinIndex })
          setWinner(null)
        }
      } else {
        console.warn('[RoomPage] ROUND_RESULT has invalid laneStrip, using fallback strip', {
          participantSnapshotCount: participants.length,
          winIndex: nextWinIndex,
          laneStripCount: laneStrip.length,
        })
        setRouletteItems(buildFallbackStrip(participants, Math.max(DEFAULT_STRIP_SIZE, nextWinIndex + 5)))
        setWinner(null)
      }
      setWinnerVisible(false)
      setIsSpinning(true)
    },
    ROUND_FINISHED: (data: RoundFinishedPayload) => {
      if (spinCompleted || !isSpinning) {
        applyRoundFinished(data)
      } else {
        pendingRoundFinishRef.current = data
      }
    },
  }), [participants, refreshRoom, spinCompleted, isSpinning, applyRoundFinished, roomId])

  useRoomRealtime(roomId, userId, wsHandlers)

  useEffect(() => {
    if (timer <= 0) return
    const id = window.setInterval(() => setTimer((v) => Math.max(0, v - 1)), 1000)
    return () => window.clearInterval(id)
  }, [timer])

  const leaveRoom = async () => {
    try {
      if (roomCloseTimeoutRef.current) {
        window.clearTimeout(roomCloseTimeoutRef.current)
        roomCloseTimeoutRef.current = null
      }
      if (winnerHideTimeoutRef.current) {
        window.clearTimeout(winnerHideTimeoutRef.current)
        winnerHideTimeoutRef.current = null
      }
      if (balanceFxTimeoutRef.current) {
        window.clearTimeout(balanceFxTimeoutRef.current)
        balanceFxTimeoutRef.current = null
      }
      if (coinRainTimeoutRef.current) {
        window.clearTimeout(coinRainTimeoutRef.current)
        coinRainTimeoutRef.current = null
      }
      exitingRef.current = true
      setIsExiting(true)
      await api.leaveRoom(roomId)
      setTimeout(() => onExit(), 500)
    } catch (error) {
      exitingRef.current = false
      setIsExiting(false)
      toast((error as Error).message, 'error')
    }
  }

  const startNewRoundInSameRoom = async () => {
    try {
      setRematchProcessing(true)
      await api.joinRoom(roomId)
      setAwaitingRematchDecision(false)
      await refreshRoom()
      toast('Вы снова в комнате. Ждём новый розыгрыш!', 'success')
    } catch (error) {
      const message = (error as Error).message || 'Не удалось повторно войти в комнату'
      if (message.toLowerCase().includes('already in this room')) {
        setAwaitingRematchDecision(false)
        await refreshRoom()
        toast('Вы уже подключены к этой комнате. Обновили состояние.', 'success')
      } else {
        toast(message, 'error')
      }
    } finally {
      setRematchProcessing(false)
    }
  }

  const leaveAfterRound = async () => {
    setAwaitingRematchDecision(false)
    await leaveRoom()
  }

  const handleActivateBoostClick = () => {
    setBoostConfirmVisible(true)
  }

  const confirmBoost = async () => {
    setBoostConfirmVisible(false)
    
    // Вычисляем шанс с учетом того, что комната заполнится до конца (max_players)
    // Предполагаем, что пустые слоты займут игроки с весом 1 (без буста)
    const myCurrentWeight = 1; // До активации буста вес пользователя равен 1
    const currentTotalWeight = participants.reduce((acc, p) => acc + (1 + (p.boost_multiplier || 0)), 0)
    const emptySlots = Math.max(0, (room?.max_players || 0) - participants.length)
    const simulatedTotalWeightBefore = currentTotalWeight + emptySlots
    
    const oldChance = (myCurrentWeight / simulatedTotalWeightBefore) * 100
    
    const boostMult = room?.boost_multiplier || 0
    const myNewWeight = myCurrentWeight + boostMult
    const simulatedTotalWeightAfter = simulatedTotalWeightBefore + boostMult
    const newChance = (myNewWeight / simulatedTotalWeightAfter) * 100

    try {
      await api.activateBoost(roomId)
      await refreshRoom()
      toast('Буст активирован', 'success')
      setBoostSuccessFx({ oldChance, newChance })
      setTimeout(() => setBoostSuccessFx(null), 5000)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  if (!room) return null
  const me = participants.find((p) => p.user_id === userId && !p.is_bot)
  const canBoost = Boolean(me) && room.status === 'waiting' && room.boost_enabled
  const boostActivated = Boolean(me?.boost_multiplier && me.boost_multiplier > 0)
  const cannotLeave = isSpinning || room.status === 'locked' || room.status === 'running' || isExiting

  const currentTotalWeight = participants.reduce((acc, p) => acc + (1 + (p.boost_multiplier || 0)), 0)
  const emptySlots = Math.max(0, (room.max_players || 0) - participants.length)
  const simulatedTotalWeight = currentTotalWeight + emptySlots

  return (
    <div className="room-layout">
      {(isEntering || isExiting) && (
        <div className={`door-overlay ${isEntering ? 'door-opening' : ''} ${isExiting ? 'door-closing' : ''}`}>
          <div className="door-half door-left"></div>
          <div className="door-half door-right"></div>
        </div>
      )}
      {boostConfirmVisible && room && (
        <div className="boost-modal-overlay">
          <div className="boost-modal shell-card">
            <h3>Активация буста</h3>
            <p>
              Активация буста увеличит <strong>«вес» вашего билета на +{Math.round(room.boost_multiplier * 100)}%</strong>.<br/>
              Ваш итоговый шанс на победу будет пересчитан.<br/>
              Стоимость буста: <strong className="gold-text">{room.boost_cost}</strong> бонусов.
            </p>
            <p className="boost-modal-question">Вы готовы?</p>
            <div className="boost-modal-actions">
              <button className="btn btn-secondary boost-modal-no" onClick={() => setBoostConfirmVisible(false)}>
                Нет, я передумал
              </button>
              <button className="btn boost-modal-yes" onClick={confirmBoost}>
                Да, активировать!
              </button>
            </div>
          </div>
        </div>
      )}
      {awaitingRematchDecision && !isSpinning && !winnerVisible && (
        <div className="boost-modal-overlay">
          <div className="boost-modal shell-card">
            <h3>Раунд завершён</h3>
            <p>
              Хотите начать новую игру в этой же комнате с теми же условиями,
              или выйти в лобби?
            </p>
            <div className="boost-modal-actions">
              <button
                className="btn btn-secondary boost-modal-no"
                onClick={leaveAfterRound}
                disabled={rematchProcessing}
              >
                Выйти из комнаты
              </button>
              <button
                className="btn boost-modal-yes"
                onClick={startNewRoundInSameRoom}
                disabled={rematchProcessing}
              >
                {rematchProcessing ? 'Подключение...' : 'Играть ещё раз'}
              </button>
            </div>
          </div>
        </div>
      )}
      {boostSuccessFx && (
        <div className="boost-success-overlay">
          <div className="boost-success-content">
            <div className="boost-success-arrow">↑</div>
            <h1 className="boost-success-title">Ваша удача возросла!!!</h1>
            <div className="boost-success-stats">
              <div className="boost-stat-old">Было: <span>{boostSuccessFx.oldChance.toFixed(1)}%</span></div>
              <div className="boost-stat-new">Стало: <span>{boostSuccessFx.newChance.toFixed(1)}%</span></div>
            </div>
          </div>
        </div>
      )}
      {coinRain.length > 0 && (
        <div className="coin-rain" aria-hidden="true">
          {coinRain.map((coin) => (
            <span
              key={coin.id}
              className="coin-rain__coin"
              style={{
                left: `${coin.left}%`,
                animationDelay: `${coin.delay}s`,
                animationDuration: `${coin.duration}s`,
                fontSize: `${coin.size}px`,
                ['--coin-drift' as string]: `${coin.drift}px`,
              }}
            >
              🪙
            </span>
          ))}
        </div>
      )}
      <aside className="room-sidebar shell-card">
        <div className="room-sidebar__top">
          <div className="room-sidebar__actions">
            <button type="button" className="btn btn-secondary" onClick={leaveRoom} disabled={cannotLeave}>
              ← Выйти из комнаты
            </button>
            {onOpenInstruction && (
              <button type="button" className="btn btn-secondary" onClick={onOpenInstruction}>
                Инструкция
              </button>
            )}
          </div>
          <div className="room-sidebar__brand">
            <StolotoLogo className="sidebar-logo" />
            <h2 className="mt-2">{room.name}</h2>
          </div>
        </div>
        <div className="room-stat-grid">
          <div className={`stat-tile ${balanceGainFx ? 'stat-tile--jackpot' : ''}`}>
            <span className="stat-label">Баланс</span>
            <strong>{animatedBalance}</strong>
            {balanceGainFx && <span className="balance-gain-fx">+{balanceGainFx}</span>}
          </div>
          <div className="stat-tile"><span className="stat-label">Фонд</span><strong>{room.total_pool}</strong></div>
          <div className="stat-tile"><span className="stat-label">Статус</span><strong>{room.status}</strong></div>
          <div className="stat-tile"><span className="stat-label">Вход</span><strong>{room.entry_fee}</strong></div>
          <div className="stat-tile"><span className="stat-label">Мест</span><strong>{participants.length} / {room.max_players}</strong></div>
        </div>
        <div className={`boost-controls shell-card shell-card--inner ${boostActivated ? 'boost-controls--active' : ''}`}>
          <p className="eyebrow">Участники</p>
          {canBoost && (
            <button className={`btn btn-boost ${boostActivated ? 'btn-boost--active' : ''}`} disabled={boostActivated} onClick={handleActivateBoostClick}>
              {boostActivated ? 'Буст активирован' : `Активировать буст +${Math.round(room.boost_multiplier * 100)}%`}
            </button>
          )}
          {canBoost && <span className="boost-cost">Стоимость: {room.boost_cost} бонусов</span>}
          <div className="participants-list">
            {participants.map((participant) => {
              const weight = 1 + (participant.boost_multiplier || 0)
              const chance = ((weight / simulatedTotalWeight) * 100).toFixed(1)
              return (
                <div className={`participant-item ${participant.user_id === userId && !participant.is_bot ? 'you' : ''} ${participant.is_bot ? 'bot' : ''} ${participant.boost_multiplier > 0 ? 'participant-item--boosted' : ''}`} key={participant.id}>
                  <div className="participant-main">
                    <strong>{participant.avatar || participant.talisman || '🎲'} {participant.display_name || participant.username}</strong>
                    <span className="participant-sub">{participant.is_bot ? 'Бот' : 'Игрок'} • Шанс: {chance}%</span>
                  </div>
                  {participant.boost_multiplier > 0 && <span className="boost-badge">⚡ Вес +{Math.round(participant.boost_multiplier * 100)}%</span>}
                </div>
              )
            })}
          </div>
        </div>
      </aside>
      <div className={`room-stage shell-card ${isSpinning ? 'room-stage--active' : ''}`}>
        <div className="room-stage__header">
          <div>
            <p className="eyebrow">Розыгрыш</p>
            <h3>{room.name}</h3>
          </div>
          <div className="timer-display shell-card shell-card--compact">
            <span className="timer-label">Таймер</span>
            <span>{timer}с</span>
          </div>
        </div>
        <div className="room-state-message">{room.status === 'finished' ? 'Раунд завершён.' : 'Розыгрыш идёт...'}</div>
        <div className="opencase-container-wrap">
          <CaseRoulette
            items={rouletteItems}
            winnerIndex={winIndex}
            isSpinning={isSpinning}
            onSpinEnd={() => {
              setSpinCompleted(true)
              if (pendingRoundFinishRef.current) {
                applyRoundFinished(pendingRoundFinishRef.current)
                pendingRoundFinishRef.current = null
              } else if (!roundFinishedReceived) {
                setIsSpinning(false)
              }
              if (winnerHideTimeoutRef.current) window.clearTimeout(winnerHideTimeoutRef.current)
              winnerHideTimeoutRef.current = window.setTimeout(() => setWinnerVisible(false), 3000)
            }}
          />
        </div>
      </div>
      
      {/* Absolute fullscreen elements at the very root of the layout */}
      <WinnerCelebration
        visible={winnerVisible}
        avatar={winner?.avatar || '🏆'}
        displayName={winner?.displayName || 'Победитель'}
      />
      
      {/* Magic Rules Blocks */}
      <div className="magic-rules-container">
        <div className="magic-rule-card shell-card">
          <div className="magic-rule-card-inner">
            <div className="magic-rule-icon">🛡️</div>
            <h4>Provably Fair</h4>
          </div>
          <div className="magic-rule-tooltip">
            <strong>Честная и прозрачная игра</strong>
            Каждый исход генерируется до начала вращения и может быть математически доказан. Никаких подкруток, только чистая удача и честный алгоритм классической рулетки.
          </div>
        </div>
        <div className="magic-rule-card shell-card">
          <div className="magic-rule-card-inner">
            <div className="magic-rule-icon">⚡</div>
            <h4>Победитель</h4>
          </div>
          <div className="magic-rule-tooltip">
            <strong>Все решается на сервере</strong>
            Результат вычисляется на сервере ровно в момент старта. Визуализация на экране (прокрутка ленты) лишь красиво отображает уже предопределенный сервером итог. Сервер всегда авторитетен.
          </div>
        </div>
        <div className="magic-rule-card shell-card">
          <div className="magic-rule-card-inner">
            <div className="magic-rule-icon">🔥</div>
            <h4>Система бустов</h4>
          </div>
          <div className="magic-rule-tooltip">
            <strong>{room.boost_enabled ? `Увеличение шанса на +${Math.round(room.boost_multiplier * 100)}%` : 'В данной комнате бусты отключены'}</strong>
            {room.boost_enabled ? `Стоимость активации: ${room.boost_cost} бонусов. ` : ''}Буст не гарантирует 100% победу, но делает ваш "билет" толще, увеличивая вашу долю вероятности в общем пуле участников.
          </div>
        </div>
        <div className="magic-rule-card shell-card">
          <div className="magic-rule-card-inner">
            <div className="magic-rule-icon">💎</div>
            <h4>Комиссия 0%</h4>
          </div>
          <div className="magic-rule-tooltip">
            <strong>Мы не берем процент с выигрыша!</strong>
            Победитель забирает весь сформированный фонд комнаты подчистую. Вы получаете на свой баланс всё до последней копейки без скрытых налогов на победу.
          </div>
        </div>
      </div>
    </div>
  )
}
