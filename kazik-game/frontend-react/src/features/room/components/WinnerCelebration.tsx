type Props = {
  avatar: string
  displayName: string
  visible: boolean
}

export function WinnerCelebration({ avatar, displayName, visible }: Props) {
  if (!visible) return null
  return (
    <div className="winner-celebration">
      <div className="winner-celebration__content">
        <div className="winner-celebration__badge">ВЫИГРЫШ</div>
        <div className="winner-celebration__icon">{avatar || '🏆'}</div>
        <div className="winner-celebration__name">{displayName || 'Победитель'}</div>
      </div>
    </div>
  )
}
