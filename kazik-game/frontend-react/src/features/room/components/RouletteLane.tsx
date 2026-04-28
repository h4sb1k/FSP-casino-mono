import type { RoomParticipant } from '../../../shared/api/client'
import type { CSSProperties } from 'react'

type LaneParticipant = {
  participantId: number | null
  displayName: string
  talisman: string
}

type Props = {
  participants: RoomParticipant[]
  laneParticipants?: LaneParticipant[]
}

const RARITY_COLORS = ['#b0c3d9', '#5e98d9', '#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#ffd700']

function getRarityColor(name: string, index: number) {
  const seed = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0) + index
  return RARITY_COLORS[seed % RARITY_COLORS.length]
}

export function RouletteLane({ participants, laneParticipants }: Props) {
  const source = (laneParticipants?.length
    ? laneParticipants
    : participants.map((p) => ({
        participantId: p.id,
        displayName: p.display_name || p.username,
        talisman: p.talisman || (p.is_bot ? '🤖' : '🦊'),
      })))
  const safeSource = source.length
    ? source
    : [{ participantId: null, displayName: 'Участник', talisman: '🎲' }]

  return (
    <>
      {Array.from({ length: 90 }, (_, index) => {
        const item = safeSource[index % safeSource.length]
        const rarityColor = getRarityColor(item.displayName, index)
        const style = { '--rarity-color': rarityColor } as CSSProperties
        return (
          <div
            className="opencase-item opencase-item--case"
            style={style}
            key={`${item.participantId ?? 'x'}-${index}`}
          >
            <div className="item-icon">{item.talisman}</div>
            <div className="item-name">{item.displayName}</div>
          </div>
        )
      })}
    </>
  )
}
