import { useEffect, useMemo, useState } from 'react'
import { ApiClient, type UserProfile } from '../../shared/api/client'
import './ProfilePage.css'

type Props = {
  userId: number
  onBack: () => void
  toast: (message: string, type?: string) => void
}

export function ProfilePage({ userId, onBack, toast }: Props) {
  const api = useMemo(() => new ApiClient(), [])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [alertsEnabled, setAlertsEnabled] = useState(true)

  useEffect(() => {
    api.getUserProfile(userId)
      .then(setProfile)
      .catch((e: Error) => toast(e.message, 'error'))
  }, [api, toast, userId])

  if (!profile) {
    return (
      <section className="pr-container">
        <div className="pr-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Загрузка профиля...</h2>
        </div>
      </section>
    )
  }

  return (
    <section className="pr-container">
      <div className="pr-bg-blobs">
        <div className="pr-blob-1"></div>
        <div className="pr-blob-2"></div>
      </div>

      <div className="pr-grid" style={{ position: 'relative' }}>
        <button className="pr-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          В лобби
        </button>

        {/* Left Column: Profile Card */}
        <div className="pr-card pr-left">
          <div className="pr-avatar-wrap">
            {profile.avatar}
          </div>
          
          <div className="pr-title-row">
            <h2>Профиль игрока</h2>
            <div className="pr-sub">
              ID аккаунта<br/>
              #{profile.user_id}
            </div>
          </div>

          <div className="pr-field">
            <span className="pr-field-label">Имя пользователя</span>
            <span className="pr-field-val">{profile.username}</span>
          </div>
          <div className="pr-field">
            <span className="pr-field-label">Статус</span>
            <span className="pr-field-val" style={{ color: '#00d26a' }}>Активный игрок</span>
          </div>

          <div className="pr-toggle-row">
            <span className="pr-toggle-label">Уведомления об играх</span>
            <div 
              className={`pr-toggle ${!alertsEnabled ? 'off' : ''}`}
              onClick={() => setAlertsEnabled(!alertsEnabled)}
            ></div>
          </div>

          <button className="pr-btn-save" onClick={() => toast('Настройки сохранены!', 'success')}>
            Сохранить
          </button>
        </div>

        {/* Right Column: Accounts & Bills */}
        <div className="pr-right">
          
          {/* Top Block: Accounts */}
          <div className="pr-card">
            <div className="pr-card-header">
              <h3>Мои балансы</h3>
              <button className="pr-card-header-action" onClick={() => toast('Функция в разработке', 'info')}>Настройки</button>
            </div>

            <div className="pr-acc-row">
              <div className="pr-acc-info">
                <div className="pr-acc-title">Бонусный счет</div>
                <div className="pr-acc-val active">{profile.bonus_balance} ₽</div>
              </div>
              <button className="pr-btn-pill orange-pink" onClick={() => toast('Функция пополнения скоро появится!', 'info')}>
                Пополнить
              </button>
            </div>

            <div className="pr-acc-row" style={{ marginTop: '20px' }}>
              <div className="pr-acc-info">
                <div className="pr-acc-title">Игровая статистика</div>
                <div className="pr-acc-val" style={{ fontSize: '16px' }}>
                  Сыграно: <span style={{ color: '#222' }}>{profile.rounds_played}</span> / 
                  Побед: <span style={{ color: '#00d26a' }}>{profile.wins_count}</span>
                </div>
              </div>
              <button className="pr-btn-pill green" onClick={() => toast('Функция вывода скоро появится!', 'info')}>
                Вывести
              </button>
            </div>
          </div>

          {/* Bottom Block: Bills / History */}
          <div className="pr-card">
            <div className="pr-card-header">
              <h3>История игр</h3>
              <button className="pr-card-header-action">Сортировка</button>
            </div>

            {profile.history.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '30px 0' }}>
                Пока нет сыгранных раундов.
              </div>
            ) : (
              <div className="pr-history-list">
                {profile.history.map((entry) => (
                  <div className="pr-bill-row" key={entry.round_id}>
                    <div className="pr-bill-left">
                      <div className={`pr-bill-dot ${entry.status === 'win' ? 'green' : 'red'}`}></div>
                      <div>
                        <div className="pr-bill-title">{entry.room_name}</div>
                        <div className="pr-bill-sub">{new Date(entry.finished_at).toLocaleString('ru-RU')} • {entry.item_name}</div>
                      </div>
                    </div>
                    <div className={`pr-bill-badge ${entry.status === 'win' ? 'paid' : 'unpaid'}`}>
                      {entry.status === 'win' ? 'Победа' : 'Поражение'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
