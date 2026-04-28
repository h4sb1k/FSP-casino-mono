import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient, type AdminConfig, type AdminRoomItem, type ConfigValidation } from '../../shared/api/client'

type Props = {
  onBack: () => void
  toast: (message: string, type?: string) => void
}

const initialConfig: AdminConfig = {
  max_players: 4,
  entry_fee: 1000,
  prize_pool_pct: 0.8,
  boost_enabled: true,
  boost_cost: 200,
  boost_multiplier: 0.2,
  bot_win_policy: 'return_pool',
}

export function AdminPage({ onBack, toast }: Props) {
  const api = useMemo(() => new ApiClient(), [])
  const [config, setConfig] = useState<AdminConfig>(initialConfig)
  const [validation, setValidation] = useState<ConfigValidation | null>(null)
  const [rooms, setRooms] = useState<AdminRoomItem[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [roomConfig, setRoomConfig] = useState<Omit<AdminConfig, 'bot_win_policy'>>({
    max_players: 4,
    entry_fee: 1000,
    prize_pool_pct: 0.8,
    boost_enabled: true,
    boost_cost: 200,
    boost_multiplier: 0.2,
  })

  const loadRooms = useCallback(async () => {
    try {
      const data = await api.getAdminRooms()
      setRooms(data)
      if (!selectedRoomId && data.length) {
        const waiting = data.find((room) => room.status === 'waiting')
        if (waiting) {
          setSelectedRoomId(waiting.id)
          setRoomConfig({
            max_players: waiting.max_players,
            entry_fee: waiting.entry_fee,
            prize_pool_pct: waiting.prize_pool_pct,
            boost_enabled: waiting.boost_enabled,
            boost_cost: waiting.boost_cost,
            boost_multiplier: waiting.boost_multiplier,
          })
        }
      }
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [api, selectedRoomId, toast])

  const validate = useCallback(async (next = config) => {
    try {
      const v = await api.validateConfig(next)
      setValidation(v)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [api, config, toast])

  useEffect(() => {
    let ignore = false
    
    api.getConfig()
      .then((cfg) => {
        if (!ignore) {
          setConfig(cfg)
          validate(cfg).catch(() => undefined)
        }
      })
      .catch((e: Error) => {
        if (!ignore) toast(e.message, 'error')
      })
      
    // Load rooms in a way that doesn't trigger synchronous cascaded renders
    window.setTimeout(() => {
      if (!ignore) {
        loadRooms().catch(() => undefined)
      }
    }, 0)
    
    return () => {
      ignore = true
    }
  }, [api, loadRooms, toast, validate])

  const update = <K extends keyof AdminConfig>(key: K, value: AdminConfig[K]) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    validate(next).catch(() => undefined)
  }

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null
  const canEditSelectedRoom = selectedRoom?.status === 'waiting'

  return (
    <section id="admin-view" className="view active">
      <div className="admin-header shell-card">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Конфигуратор комнат</h2>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>← Назад</button>
      </div>

      <div className="shell-card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="section-title-row compact">
          <h3>Редактирование конкретных комнат</h3>
          <span className="section-note">Изменять можно только WAITING</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflow: 'auto' }}>
            {rooms.map((room) => {
              const editable = room.status === 'waiting'
              return (
                <button
                  key={room.id}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: selectedRoomId === room.id ? '1px solid rgba(228,195,124,.6)' : '1px solid rgba(228,195,124,.18)',
                    background: 'rgba(20, 39, 30, 0.6)',
                    color: '#f6efe2',
                    opacity: editable ? 1 : 0.45,
                  }}
                  onClick={() => {
                    setSelectedRoomId(room.id)
                    setRoomConfig({
                      max_players: room.max_players,
                      entry_fee: room.entry_fee,
                      prize_pool_pct: room.prize_pool_pct,
                      boost_enabled: room.boost_enabled,
                      boost_cost: room.boost_cost,
                      boost_multiplier: room.boost_multiplier,
                    })
                  }}
                >
                  <strong>{room.name}</strong>
                  <span className="section-note">#{room.id} • {room.status}</span>
                  <span className="section-note">Игроков: {room.participants_count}/{room.max_players}</span>
                </button>
              )
            })}
          </div>
          <div>
            {!selectedRoom ? (
              <div className="empty-state">Выберите комнату для редактирования.</div>
            ) : (
              <>
                <p className="section-note">Комната: {selectedRoom.name} (#{selectedRoom.id})</p>
                <div className="form-group">
                  <label>Макс. игроков</label>
                  <input type="range" min={2} max={10} value={roomConfig.max_players} disabled={!canEditSelectedRoom} onChange={(e) => setRoomConfig((prev) => ({ ...prev, max_players: Number(e.target.value) }))} />
                  <span>{roomConfig.max_players}</span>
                </div>
                <div className="form-group">
                  <label>Вход</label>
                  <input type="range" min={100} max={5000} step={100} value={roomConfig.entry_fee} disabled={!canEditSelectedRoom} onChange={(e) => setRoomConfig((prev) => ({ ...prev, entry_fee: Number(e.target.value) }))} />
                  <span>{roomConfig.entry_fee}</span>
                </div>
                <div className="form-group">
                  <label>Призовой фонд (%)</label>
                  <input type="range" min={50} max={95} value={Math.round(roomConfig.prize_pool_pct * 100)} disabled={!canEditSelectedRoom} onChange={(e) => setRoomConfig((prev) => ({ ...prev, prize_pool_pct: Number(e.target.value) / 100 }))} />
                  <span>{Math.round(roomConfig.prize_pool_pct * 100)}%</span>
                </div>
                <div className="form-group">
                  <label>Буст включен</label>
                  <input type="checkbox" checked={roomConfig.boost_enabled} disabled={!canEditSelectedRoom} onChange={(e) => setRoomConfig((prev) => ({ ...prev, boost_enabled: e.target.checked }))} />
                </div>
                <div className="form-group">
                  <label>Стоимость буста</label>
                  <input type="range" min={50} max={1000} step={50} value={roomConfig.boost_cost} disabled={!canEditSelectedRoom} onChange={(e) => setRoomConfig((prev) => ({ ...prev, boost_cost: Number(e.target.value) }))} />
                  <span>{roomConfig.boost_cost}</span>
                </div>
                <div className="form-group">
                  <label>Множитель буста</label>
                  <input type="range" min={10} max={50} value={Math.round(roomConfig.boost_multiplier * 100)} disabled={!canEditSelectedRoom} onChange={(e) => setRoomConfig((prev) => ({ ...prev, boost_multiplier: Number(e.target.value) / 100 }))} />
                  <span>{Math.round(roomConfig.boost_multiplier * 100)}%</span>
                </div>
                <button
                  className="btn btn-secondary"
                  disabled={!selectedRoomId || !canEditSelectedRoom}
                  onClick={async () => {
                    if (!selectedRoomId) return
                    try {
                      await api.updateRoomConfig(selectedRoomId, roomConfig)
                      toast('Настройки комнаты сохранены', 'success')
                      loadRooms().catch(() => undefined)
                    } catch (e) {
                      toast((e as Error).message, 'error')
                    }
                  }}
                >
                  Сохранить для этой комнаты
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="config-form shell-card">
        <div className="section-title-row compact">
          <h3>Шаблон для новых комнат</h3>
          <span className="section-note">Применяется к будущим комнатам</span>
        </div>
        <div className="form-group">
          <label>Макс. игроков</label>
          <input type="range" min={2} max={10} value={config.max_players} onChange={(e) => update('max_players', Number(e.target.value))} />
          <span>{config.max_players}</span>
        </div>
        <div className="form-group">
          <label>Вход</label>
          <input type="range" min={100} max={5000} step={100} value={config.entry_fee} onChange={(e) => update('entry_fee', Number(e.target.value))} />
          <span>{config.entry_fee}</span>
        </div>
        <div className="form-group">
          <label>Призовой фонд (%)</label>
          <input type="range" min={50} max={95} value={Math.round(config.prize_pool_pct * 100)} onChange={(e) => update('prize_pool_pct', Number(e.target.value) / 100)} />
          <span>{Math.round(config.prize_pool_pct * 100)}%</span>
        </div>
        <div className="form-group">
          <label>Буст включен</label>
          <input type="checkbox" checked={config.boost_enabled} onChange={(e) => update('boost_enabled', e.target.checked)} />
        </div>
        <div className="form-group">
          <label>Стоимость буста</label>
          <input type="range" min={50} max={1000} step={50} value={config.boost_cost} onChange={(e) => update('boost_cost', Number(e.target.value))} />
          <span>{config.boost_cost}</span>
        </div>
        <div className="form-group">
          <label>Множитель буста</label>
          <input type="range" min={10} max={50} value={Math.round(config.boost_multiplier * 100)} onChange={(e) => update('boost_multiplier', Number(e.target.value) / 100)} />
          <span>{Math.round(config.boost_multiplier * 100)}%</span>
        </div>
        <div className="form-group">
          <label>Политика победы бота</label>
          <select value={config.bot_win_policy} onChange={(e) => update('bot_win_policy', e.target.value as AdminConfig['bot_win_policy'])}>
            <option value="return_pool">Возврат в пул</option>
            <option value="burn">Сжигание</option>
          </select>
        </div>

        <div className="risk-indicator">
          <span className={`risk-level ${validation?.risk_level || 'LOW'}`}>{validation?.risk_level || 'LOW'}</span>
          <p>{validation?.explanation || ''}</p>
          <ul className="risk-warnings">
            {[...(validation?.warnings || []), ...(validation?.errors || [])].map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>

        <button
          className="btn btn-primary"
          disabled={!validation?.can_save}
          onClick={async () => {
            try {
              await api.saveConfig(config)
              toast('Конфигурация сохранена', 'success')
            } catch (e) {
              toast((e as Error).message, 'error')
            }
          }}
        >
          Сохранить конфигурацию
        </button>
      </div>
    </section>
  )
}
