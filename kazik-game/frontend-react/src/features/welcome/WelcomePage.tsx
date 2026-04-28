import { StolotoLogo } from '../../shared/ui/StolotoLogo'

type GameId = 'opencase' | 'mountain' | 'bank'

type WelcomePageProps = {
  onSelectGame: (game: GameId) => void
  onOpenProfile: () => void
  onOpenAdmin?: () => void
  showAdminEntry?: boolean
  bonusBalance: number
  userId: number | null
}

export function WelcomePage({
  onSelectGame,
  onOpenProfile,
  onOpenAdmin,
  showAdminEntry,
  bonusBalance,
  userId,
}: WelcomePageProps) {
  return (
    <div className="welcome-layout">
      <div className="welcome-top-actions">
        <div className="user-info shell-card shell-card--compact">
          <span>Бонусы: {bonusBalance}</span>
          <span className="user-id">User ID: {userId ?? '-'}</span>
        </div>
        <button className="btn btn-secondary" onClick={onOpenProfile}>
          Профиль
        </button>
        {showAdminEntry && onOpenAdmin && (
          <button type="button" className="btn btn-secondary" onClick={onOpenAdmin}>
            Админ-панель
          </button>
        )}
      </div>
      <div className="welcome-content shell-card">
        <StolotoLogo className="welcome-logo mx-auto mb-4" />
        <h1 className="welcome-title">СТОЛОТО Мини-игры</h1>
        <p className="welcome-subtitle">
          Выберите игру и используйте единый бонусный баланс во всех мини-играх.
        </p>

        <div className="game-picks">
          <div className="welcome-feature shell-card shell-card--inner">
            <div className="welcome-feature-num">I</div>
            <h3>Opencase</h3>
            <p>Классические комнаты, таймер и серверный выбор победителя.</p>
            <button className="btn btn-primary btn-large game-pick-btn" onClick={() => onSelectGame('opencase')}>
              Играть в Opencase
            </button>
          </div>
          <div className="welcome-feature shell-card shell-card--inner">
            <div className="welcome-feature-num">II</div>
            <h3>Mountain Hiking</h3>
            <p>Горная гонка с раундами, ставками и событийной механикой.</p>
            <button className="btn btn-primary btn-large game-pick-btn" onClick={() => onSelectGame('mountain')}>
              Играть в Mountain
            </button>
          </div>
          <div className="welcome-feature shell-card shell-card--inner">
            <div className="welcome-feature-num">III</div>
            <h3>Bank</h3>
            <p>Режим взлома банка с быстрыми розыгрышами и бустами.</p>
            <button className="btn btn-primary btn-large game-pick-btn" onClick={() => onSelectGame('bank')}>
              Играть в Bank
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
