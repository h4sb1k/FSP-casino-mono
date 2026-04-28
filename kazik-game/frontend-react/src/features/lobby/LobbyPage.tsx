import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient, type RoomListItem } from '../../shared/api/client'

type Props = {
  userId: number
  onJoinRoom: (roomId: number) => void
  toast: (message: string, type?: string) => void
}

export function LobbyPage({ userId, onJoinRoom, toast }: Props) {
  const api = useMemo(() => new ApiClient(), [])
  const [rooms, setRooms] = useState<RoomListItem[]>([])
  const [filters, setFilters] = useState({
    entry_fee_min: '',
    entry_fee_max: '',
    seats_min: '',
    seats_max: '',
    tier: '',
  })

  const loadRooms = useCallback(async () => {
    try {
      const data = await api.getRooms(filters)
      setRooms(data)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [api, filters, toast])

  useEffect(() => {
    let ignore = false
    window.setTimeout(() => {
      if (!ignore) {
        loadRooms().catch(() => undefined)
      }
    }, 0)
    return () => { ignore = true }
  }, [loadRooms])

  return (
    <section id="lobby-view" className="view active">
      <div className="hero shell-card">
        <div>
          <p className="eyebrow">Лобби</p>
          <h2>Быстрый вход в игровые комнаты</h2>
          <p>Создавайте комнату, фильтруйте ставки и следите за активными столами в реальном времени.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-large"
            onClick={async () => {
              try {
                const room = await api.createRoom({
                  name: 'VIP Gold Room',
                  max_players: 4,
                  entry_fee: 1000,
                  prize_pool_pct: 0.8,
                  boost_enabled: true,
                  boost_cost: 200,
                  boost_multiplier: 0.2,
                })
                onJoinRoom(room.id)
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            Создать комнату
          </button>
        </div>
      </div>

      <div className="filters shell-card">
        <div className="filter-group">
          <label>Вход от</label>
          <input placeholder="Мин. 100" value={filters.entry_fee_min} onChange={(e) => setFilters((f) => ({ ...f, entry_fee_min: e.target.value }))} />
        </div>
        <div className="filter-group">
          <label>Вход до</label>
          <input placeholder="Макс. 5000" value={filters.entry_fee_max} onChange={(e) => setFilters((f) => ({ ...f, entry_fee_max: e.target.value }))} />
        </div>
        <div className="filter-group">
          <label>Мест от</label>
          <input placeholder="Мин. 2" value={filters.seats_min} onChange={(e) => setFilters((f) => ({ ...f, seats_min: e.target.value }))} />
        </div>
        <div className="filter-group">
          <label>Мест до</label>
          <input placeholder="Макс. 10" value={filters.seats_max} onChange={(e) => setFilters((f) => ({ ...f, seats_max: e.target.value }))} />
        </div>
        <div className="filter-group">
          <label>Класс</label>
          <select value={filters.tier} onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}>
            <option value="">Все</option>
            <option value="bronze">Бронза</option>
            <option value="silver">Серебро</option>
            <option value="gold">Золото</option>
            <option value="platinum">Платина</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-primary" onClick={() => loadRooms()}>Применить</button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setFilters({ entry_fee_min: '', entry_fee_max: '', seats_min: '', seats_max: '', tier: '' })
              setTimeout(() => loadRooms(), 0)
            }}
          >
            Сбросить
          </button>
        </div>
      </div>

      <div className="section-title-row">
        <h3>Доступные комнаты</h3>
        <span className="section-note">Найдено комнат: {rooms.length}</span>
      </div>
      <div className="rooms-grid">
        {rooms.map((room) => {
          const isInactive = room.status !== 'waiting' && room.status !== 'running'
          const isRunning = room.status === 'running'
          return (
            <article className={`room-card ${isInactive ? 'room-card--inactive' : ''}`} key={room.id}>
              <div className="room-card__top">
                <div>
                  <div className="status-badge">{room.status}</div>
                  <h3 className="room-card__title">{room.name}</h3>
                </div>
                <div className="section-note">ID #{room.id}</div>
              </div>
              <div className="room-card__meta"><span>Вход: {room.entry_fee}</span><span>Мест: {room.max_players}</span></div>
              <div className="room-card__meta"><span>Фонд: {room.total_pool}</span><span>Приз: {Math.round(room.prize_pool_pct * 100)}%</span></div>
              <div className="room-card__footer">
                <span className="section-note">{new Date(room.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                <button
                  className="btn btn-primary"
                  disabled={isInactive}
                  onClick={async () => {
                    try {
                      if (isRunning) {
                        const active = await api.getActiveRoom(userId)
                        if (active.room_id === room.id) {
                          onJoinRoom(room.id)
                        } else {
                          toast('Розыгрыш уже идёт. Войти можно только участнику комнаты.', 'error')
                        }
                        return
                      }

                      await api.joinRoom(room.id)
                      onJoinRoom(room.id)
                    } catch (e) {
                      const message = (e as Error).message
                      if (message.toLowerCase().includes('already in this room')) {
                        onJoinRoom(room.id)
                      } else if (message.toLowerCase().includes('already in another active room')) {
                        const active = await api.getActiveRoom(userId)
                        if (active.room_id) {
                          onJoinRoom(active.room_id)
                        } else {
                          toast(message, 'error')
                        }
                      } else {
                        toast(message, 'error')
                      }
                    }
                  }}
                >
                  {isInactive ? 'Недоступна' : isRunning ? 'Вернуться' : 'Войти'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
