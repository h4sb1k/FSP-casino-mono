import { useEffect, useMemo, useState } from 'react'
import { LobbyPage } from '../features/lobby/LobbyPage'
import { RoomPage } from '../features/room/RoomPage'
import { InstructionModal } from '../features/instruction/InstructionModal'
import { OPENCASE_INSTRUCTION } from '../features/instruction/opencaseInstruction'
import { AdminPage } from '../features/admin/AdminPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { WelcomePage } from '../features/welcome/WelcomePage'
import { ApiClient, type UserProfile } from '../shared/api/client'
import { StolotoLogo } from '../shared/ui/StolotoLogo'

type View = 'lobby' | 'room' | 'admin' | 'profile'
type GameMode = 'opencase' | 'mountain' | 'bank'

function resolveViewFromPath(pathname: string): View {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'lobby'
}

let hasSeenWelcomeThisLoad = false

export function App() {
  const api = useMemo(() => new ApiClient(), [])
  const [view, setView] = useState<View>(() => resolveViewFromPath(window.location.pathname))
  const [gameMode, setGameMode] = useState<GameMode>('opencase')
  const [roomId, setRoomId] = useState<number | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null)
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    const p = window.location.pathname
    if (p.startsWith('/admin') || p.startsWith('/profile')) return false
    return !hasSeenWelcomeThisLoad
  })
  const [userId, setUserId] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [instructionOpen, setInstructionOpen] = useState(false)
  const isRoomActive = view === 'room' && roomId !== null

  const mountainUrl = import.meta.env.VITE_MOUNTAIN_APP_URL || '/mountain/'
  const bankUrl = import.meta.env.VITE_BANK_APP_URL || '/bank/'

  const handleSelectGame = (mode: GameMode) => {
    hasSeenWelcomeThisLoad = true
    setShowWelcome(false)
    setGameMode(mode)
    if (mode === 'opencase' && view !== 'room') {
      setView('lobby')
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/')
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      let lastError: unknown = null
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (cancelled) return
        try {
          const username = import.meta.env.VITE_AUTH_USERNAME || 'aleksey_m'
          const password = import.meta.env.VITE_AUTH_PASSWORD || 'password'
          const session = await api.login(username, password)
          if (cancelled) return
          setUserId(session.userId)
          setUserRole(session.role ?? null)
          const [active, userProfile] = await Promise.all([
            api.getActiveRoom(session.userId),
            api.getUserProfile(session.userId),
          ])
          if (cancelled) return
          if (active.room_id) {
            setRoomId(active.room_id)
            setView('room')
          }
          setProfile(userProfile)
          return
        } catch (error) {
          lastError = error
          await new Promise((resolve) => window.setTimeout(resolve, 800))
        }
      }
      try {
        throw lastError
      } catch {
        if (!cancelled) {
          setToast({ message: 'Не удалось выполнить вход в backend', type: 'error' })
        }
      }
    }
    bootstrap().catch(() => undefined)
    return () => { cancelled = true }
  }, [api])

  useEffect(() => {
    const onPopstate = () => {
      if (roomId) {
        setView('room')
        return
      }
      const nextView = resolveViewFromPath(window.location.pathname)
      setView(nextView)
      if (nextView !== 'room') setRoomId(null)
    }
    window.addEventListener('popstate', onPopstate)
    return () => window.removeEventListener('popstate', onPopstate)
  }, [roomId])

  const navigateTo = (path: string, nextView: View, force = false) => {
    if (!force && roomId && nextView !== 'room') {
      return
    }
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setView(nextView)
  }

  const handleOpenProfileFromWelcome = () => {
    hasSeenWelcomeThisLoad = true
    setShowWelcome(false)
    setGameMode('opencase')
    navigateTo('/profile', 'profile', true)
  }

  const handleOpenAdminFromWelcome = () => {
    hasSeenWelcomeThisLoad = true
    setShowWelcome(false)
    setGameMode('opencase')
    navigateTo('/admin', 'admin', true)
  }

  const openPlatformAdmin = () => {
    setGameMode('opencase')
    navigateTo('/admin', 'admin', true)
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== 'OPEN_SERVER_ADMIN') return
      setGameMode('opencase')
      if (window.location.pathname !== '/admin') {
        window.history.pushState({}, '', '/admin')
      }
      setView('admin')
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Removed synchronous setState effect that was triggering cascading renders

  const showToast = (message: string, type = 'info') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }

  if (showWelcome) {
    return (
      <WelcomePage
        onSelectGame={handleSelectGame}
        onOpenProfile={handleOpenProfileFromWelcome}
        onOpenAdmin={handleOpenAdminFromWelcome}
        showAdminEntry={userRole === 'ADMIN'}
        bonusBalance={profile?.bonus_balance ?? 0}
        userId={userId}
      />
    )
  }

  return (
    <div id="app">
      {!isRoomActive && (
        <header className="header shell-card">
          <div className="brand-block">
            <StolotoLogo className="brand-logo" />
            <h1>Opencase Lobby</h1>
            <p className="brand-subtitle">Единая платформа мини-игр с общим бонусным балансом.</p>
          </div>
          <div className="header-actions">
            <div className="user-info shell-card shell-card--compact">
              <span>Бонусы: {profile?.bonus_balance ?? 0}</span>
              <span className="user-id">User ID: {userId ?? '-'}</span>
            </div>
            {gameMode === 'opencase' && (
              <button type="button" className="btn btn-secondary" onClick={() => setInstructionOpen(true)}>
                Инструкция
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowWelcome(true)}>Игры</button>
            {userRole === 'ADMIN' && (
              <button type="button" className="btn btn-secondary" onClick={() => openPlatformAdmin()}>
                Админ-панель
              </button>
            )}
          </div>
        </header>
      )}

      <main className="main">
        {toast && <section className="toast" data-type={toast.type}>{toast.message}</section>}

        {gameMode === 'opencase' && view === 'lobby' && userId !== null && (
          <LobbyPage
            userId={userId}
            onJoinRoom={(nextRoomId) => {
              setRoomId(nextRoomId)
              setView('room')
            }}
            toast={showToast}
          />
        )}

        {gameMode === 'opencase' && view === 'room' && roomId && userId !== null && (
          <section id="room-view" className="view active">
            <RoomPage
              roomId={roomId}
              userId={userId}
              onExit={() => {
                setRoomId(null)
                navigateTo('/', 'lobby', true)
                api.getUserProfile(userId).then(setProfile).catch(() => undefined)
              }}
              toast={showToast}
              onOpenInstruction={() => setInstructionOpen(true)}
            />
          </section>
        )}

        {gameMode === 'opencase' && view === 'profile' && userId !== null && (
          <ProfilePage
            userId={userId}
            onBack={() => navigateTo('/', 'lobby')}
            toast={showToast}
          />
        )}
        {gameMode === 'opencase' && view === 'admin' && <AdminPage onBack={() => navigateTo('/', 'lobby')} toast={showToast} />}

        {gameMode === 'mountain' && (
          <section className="external-game-shell shell-card">
            <div className="external-game-shell__header">
              <div>
                <h2>Mountain-hiking-minigame</h2>
                <p>Модуль подключен в единую Stoloto-платформу.</p>
              </div>
              {userRole === 'ADMIN' && (
                <button type="button" className="btn btn-secondary" onClick={() => openPlatformAdmin()}>
                  Админ-панель платформы
                </button>
              )}
            </div>
            <iframe title="Mountain-hiking-minigame" src={mountainUrl} className="external-game-frame" />
          </section>
        )}

        {gameMode === 'bank' && (
          <section className="external-game-shell shell-card">
            <div className="external-game-shell__header">
              <div>
                <h2>Bank-minigame</h2>
                <p>Модуль подключен в единую Stoloto-платформу.</p>
              </div>
              {userRole === 'ADMIN' && (
                <button type="button" className="btn btn-secondary" onClick={() => openPlatformAdmin()}>
                  Админ-панель платформы
                </button>
              )}
            </div>
            <iframe title="Bank-minigame" src={bankUrl} className="external-game-frame" />
          </section>
        )}
      </main>

      {gameMode === 'opencase' && (
        <InstructionModal open={instructionOpen} onClose={() => setInstructionOpen(false)} config={OPENCASE_INSTRUCTION} />
      )}
    </div>
  )
}
