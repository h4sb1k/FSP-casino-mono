export type RoomParticipant = {
  id: number
  user_id: number
  username: string
  display_name: string
  is_bot: boolean
  avatar: string
  talisman: string
  reserved_amount: number
  boost_multiplier: number
}

type BackendParticipant = {
  id: number
  userId: number | null
  username: string | null
  isBot: boolean
  botName?: string | null
  boosted?: boolean
}

type BackendRoom = {
  id: number
  status: string
  tier: string | null
  maxSlots: number
  seatsFilled: number
  entryFee: number
  prizePoolPct: number
  boostEnabled: boolean
  boostCost: number
  boostMultiplier: number
  participants: BackendParticipant[]
  timerStartedAt?: string | null
  createdAt?: string | null
}

type BackendAdminConfig = {
  defaultMaxSlots: number
  defaultEntryFee: number
  defaultPrizePoolPct: number
  defaultBoostEnabled: boolean
  defaultBoostCost: number
  defaultBoostMultiplier: number
  waitingTimerSeconds?: number
}

type BackendConfigValidation = {
  valid: boolean
  warnings: string[]
  errors: string[]
}

type BackendHistoryEntry = {
  roomId: number | null
  winnerDisplayName?: string
  winnerIsBot?: boolean
  payout?: number
  finishedAt: string
}

type BackendUserProfile = {
  userId: number
  username: string
  balance: number | null
  reservedBalance: number | null
  history: BackendHistoryEntry[]
}

export type RoomDetail = {
  id: number
  name: string
  tier: string
  status: 'waiting' | 'locked' | 'running' | 'finished' | 'archived'
  max_players: number
  entry_fee: number
  boost_enabled: boolean
  boost_cost: number
  boost_multiplier: number
  total_pool: number
  prize_pool: number
  time_remaining: number | null
  participants: RoomParticipant[]
  active_spin?: unknown
}

export type RoomListItem = {
  id: number
  name: string
  tier: string
  status: 'waiting' | 'locked' | 'running' | 'finished' | 'archived'
  max_players: number
  entry_fee: number
  boost_enabled: boolean
  total_pool: number
  prize_pool_pct: number
  created_at: string
}

export type AdminConfig = {
  max_players: number
  entry_fee: number
  prize_pool_pct: number
  boost_enabled: boolean
  boost_cost: number
  boost_multiplier: number
  bot_win_policy: 'return_pool' | 'burn'
}

export type ConfigValidation = {
  can_save: boolean
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  explanation?: string
  warnings: string[]
  errors: string[]
}

export type AdminRoomItem = {
  id: number
  name: string
  status: 'waiting' | 'locked' | 'running' | 'finished' | 'archived'
  tier: string
  entry_fee: number
  max_players: number
  prize_pool_pct: number
  boost_enabled: boolean
  boost_cost: number
  boost_multiplier: number
  participants_count: number
  created_at: string | null
}

export type UserProfileEntry = {
  round_id: number
  room_id: number | null
  room_name: string
  status: 'win' | 'lose'
  item_name: string
  item_rarity: string
  awarded_amount: number
  finished_at: string
}

export type UserProfile = {
  user_id: number
  username: string
  avatar: string
  bonus_balance: number
  rounds_played: number
  wins_count: number
  history: UserProfileEntry[]
}

type ApiOptions = Omit<RequestInit, 'body'> & { payload?: unknown }

const DEFAULT_WAITING_SECONDS = Number(import.meta.env.VITE_DEFAULT_WAITING_SECONDS ?? 60)
const DEFAULT_AVATAR = '🎲'
const BOT_AVATAR = '🤖'

function mapStatus(status: string | undefined): RoomDetail['status'] {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'WAITING') return 'waiting'
  if (normalized === 'RUNNING') return 'running'
  if (normalized === 'FINISHED') return 'finished'
  if (normalized === 'CANCELLED') return 'archived'
  return 'locked'
}

function roomName(roomId: number, tier?: string | null) {
  return `${tier || 'ROOM'} #${roomId}`
}

function mapParticipant(participant: BackendParticipant, boostMultiplier: number): RoomParticipant {
  const displayName = participant.isBot
    ? (participant.botName || `Бот_${participant.id}`)
    : (participant.username || `User_${participant.userId ?? participant.id}`)

  return {
    id: participant.id,
    user_id: participant.userId ?? -participant.id,
    username: participant.username || displayName,
    display_name: displayName,
    is_bot: Boolean(participant.isBot),
    avatar: participant.isBot ? BOT_AVATAR : DEFAULT_AVATAR,
    talisman: participant.isBot ? BOT_AVATAR : DEFAULT_AVATAR,
    reserved_amount: 0,
    boost_multiplier: participant.boosted ? boostMultiplier : 0,
  }
}

function calcTimeRemaining(room: BackendRoom) {
  if (!room.timerStartedAt || mapStatus(room.status) !== 'waiting') return null
  const startedAt = new Date(room.timerStartedAt).getTime()
  if (Number.isNaN(startedAt)) return null
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  return Math.max(0, DEFAULT_WAITING_SECONDS - elapsed)
}

function mapRoom(room: BackendRoom): RoomDetail {
  const participants = (room.participants || []).map((participant) =>
    mapParticipant(participant, room.boostMultiplier || 0),
  )
  const totalPool = (room.entryFee || 0) * (room.seatsFilled || participants.length || 0)
  return {
    id: room.id,
    name: roomName(room.id, room.tier),
    tier: String(room.tier || 'STANDARD'),
    status: mapStatus(room.status),
    max_players: room.maxSlots,
    entry_fee: room.entryFee,
    boost_enabled: Boolean(room.boostEnabled),
    boost_cost: room.boostCost || 0,
    boost_multiplier: room.boostMultiplier || 0,
    total_pool: totalPool,
    prize_pool: Math.round(totalPool * ((room.prizePoolPct || 0) / 100)),
    time_remaining: calcTimeRemaining(room),
    participants,
  }
}

function mapRoomListItem(room: BackendRoom): RoomListItem {
  const mapped = mapRoom(room)
  return {
    id: mapped.id,
    name: mapped.name,
    tier: mapped.tier,
    status: mapped.status,
    max_players: mapped.max_players,
    entry_fee: mapped.entry_fee,
    boost_enabled: mapped.boost_enabled,
    total_pool: mapped.total_pool,
    prize_pool_pct: (room.prizePoolPct || 0) / 100,
    created_at: room.createdAt || new Date().toISOString(),
  }
}

export class ApiClient {
  private apiBase: string
  private static authToken: string | null = null

  constructor(apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin) {
    this.apiBase = apiBase
    if (!ApiClient.authToken) {
      ApiClient.authToken = window.localStorage.getItem('casino_jwt')
    }
  }

  static getAuthToken() {
    return ApiClient.authToken
  }

  static setAuthToken(token: string | null) {
    ApiClient.authToken = token
    if (token) {
      window.localStorage.setItem('casino_jwt', token)
    } else {
      window.localStorage.removeItem('casino_jwt')
    }
  }

  async request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    }
    if (ApiClient.authToken && !path.startsWith('/api/auth/')) {
      headers.Authorization = `Bearer ${ApiClient.authToken}`
    }

    const init: RequestInit = {
      ...options,
      headers,
    }
    if (options.payload !== undefined) {
      init.body = JSON.stringify(options.payload)
    }

    const response = await fetch(`${this.apiBase}${path}`, init)
    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const normalizedPayload = payload as { detail?: string; message?: string; error?: string; code?: string }
      const message = normalizedPayload?.detail
        ?? normalizedPayload?.message
        ?? normalizedPayload?.error
        ?? (typeof payload === 'string' && payload.trim() ? payload : null)
        ?? `Request failed (${response.status})`
      throw new Error(message)
    }
    return payload as T
  }

  async login(username: string, password: string) {
    const response = await this.request<{
      token: string
      userId: number
      username?: string
      role?: string
      vipTier?: string
      balance?: number
      reservedBalance?: number
    }>('/api/auth/login', {
      method: 'POST',
      payload: { username, password },
    })
    ApiClient.setAuthToken(response.token)
    return response
  }

  async getRoom(roomId: number) {
    const room = await this.request<BackendRoom>(`/api/rooms/${roomId}`)
    return mapRoom(room)
  }

  async getRooms(filters: Record<string, string | number | null | undefined> = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        const mappedKey = key
          .replace('entry_fee_min', 'entryFeeMin')
          .replace('entry_fee_max', 'entryFeeMax')
          .replace('seats_min', 'seatsMin')
          .replace('seats_max', 'seatsMax')
        params.set(mappedKey, String(value))
      }
    })
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const rooms = await this.request<BackendRoom[]>(`/api/rooms${suffix}`)
    return rooms.map(mapRoomListItem)
  }

  async getActiveRoom(userId: number) {
    const room = await this.request<BackendRoom | ''>(`/api/users/${userId}/active-room`)
    if (typeof room === 'string' || !room) return { room_id: null }
    return { room_id: room.id }
  }

  async getUserProfile(userId: number, limit = 20) {
    const profile = await this.request<BackendUserProfile>(`/api/users/${userId}/profile?limit=${limit}`)
    const entries = profile.history || []
    const winsCount = entries.filter((entry) => (entry.payout || 0) > 0 && !entry.winnerIsBot).length
    return {
      user_id: profile.userId,
      username: profile.username,
      avatar: '🦊',
      bonus_balance: profile.balance ?? 0,
      rounds_played: entries.length,
      wins_count: winsCount,
      history: entries.map((entry, index) => ({
        round_id: index + 1,
        room_id: entry.roomId,
        room_name: entry.roomId ? roomName(entry.roomId, null) : 'Unknown room',
        status: (entry.payout || 0) > 0 ? 'win' : 'lose',
        item_name: 'Round result',
        item_rarity: 'N/A',
        awarded_amount: entry.payout || 0,
        finished_at: entry.finishedAt,
      })),
    } as UserProfile
  }

  async createRoom(payload: {
    name: string
    max_players: number
    entry_fee: number
    prize_pool_pct: number
    boost_enabled: boolean
    boost_cost: number
    boost_multiplier: number
  }) {
    const room = await this.request<BackendRoom>(`/api/rooms`, {
      method: 'POST',
      payload: {
        tier: 'STANDARD',
        maxSlots: payload.max_players,
        entryFee: payload.entry_fee,
        prizePoolPct: Math.round(payload.prize_pool_pct * 100),
        boostEnabled: payload.boost_enabled,
        boostCost: payload.boost_cost,
        boostMultiplier: payload.boost_multiplier,
      },
    })
    return mapRoomListItem(room)
  }

  joinRoom(roomId: number) {
    return this.request(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      payload: {},
    })
  }

  leaveRoom(roomId: number) {
    return this.request<{ message: string; refunded_amount: number }>(`/api/rooms/${roomId}/leave`, {
      method: 'POST',
      payload: {},
    })
  }

  activateBoost(roomId: number) {
    return this.request(`/api/rooms/${roomId}/boost`, {
      method: 'POST',
      payload: {},
    })
  }

  async getConfig() {
    const config = await this.request<BackendAdminConfig>('/api/admin/config')
    return {
      max_players: config.defaultMaxSlots,
      entry_fee: config.defaultEntryFee,
      prize_pool_pct: (config.defaultPrizePoolPct || 0) / 100,
      boost_enabled: Boolean(config.defaultBoostEnabled),
      boost_cost: config.defaultBoostCost,
      boost_multiplier: Number(config.defaultBoostMultiplier || 0),
      bot_win_policy: 'return_pool',
    } as AdminConfig
  }

  async validateConfig(payload: AdminConfig) {
    const validation = await this.request<BackendConfigValidation>('/api/admin/config/validate', {
      method: 'POST',
      payload: {
        defaultMaxSlots: payload.max_players,
        defaultEntryFee: payload.entry_fee,
        defaultPrizePoolPct: Math.round(payload.prize_pool_pct * 100),
        defaultBoostEnabled: payload.boost_enabled,
        defaultBoostCost: payload.boost_cost,
        defaultBoostMultiplier: payload.boost_multiplier,
      },
    })
    return {
      can_save: Boolean(validation.valid),
      risk_level: validation.errors.length > 0 ? 'HIGH' : validation.warnings.length > 0 ? 'MEDIUM' : 'LOW',
      warnings: validation.warnings || [],
      errors: validation.errors || [],
      explanation: validation.errors[0] || validation.warnings[0] || 'Configuration looks valid',
    } as ConfigValidation
  }

  saveConfig(payload: AdminConfig) {
    return this.request('/api/admin/config', {
      method: 'POST',
      payload: {
        defaultMaxSlots: payload.max_players,
        defaultEntryFee: payload.entry_fee,
        defaultPrizePoolPct: Math.round(payload.prize_pool_pct * 100),
        defaultBoostEnabled: payload.boost_enabled,
        defaultBoostCost: payload.boost_cost,
        defaultBoostMultiplier: payload.boost_multiplier,
      },
    })
  }

  async getAdminRooms() {
    const rooms = await this.request<BackendRoom[]>('/api/admin/rooms')
    return rooms.map((room) => ({
      id: room.id,
      name: roomName(room.id, room.tier),
      status: mapStatus(room.status),
      tier: String(room.tier || 'STANDARD'),
      entry_fee: room.entryFee,
      max_players: room.maxSlots,
      prize_pool_pct: (room.prizePoolPct || 0) / 100,
      boost_enabled: Boolean(room.boostEnabled),
      boost_cost: room.boostCost || 0,
      boost_multiplier: room.boostMultiplier || 0,
      participants_count: room.seatsFilled || room.participants?.length || 0,
      created_at: room.createdAt || null,
    }))
  }

  updateRoomConfig(roomId: number, payload: Partial<Pick<AdminConfig, 'max_players' | 'entry_fee' | 'prize_pool_pct' | 'boost_enabled' | 'boost_cost' | 'boost_multiplier'>>) {
    return this.request<RoomListItem>(`/api/admin/rooms/${roomId}/config`, {
      method: 'PUT',
      payload: {
        ...(payload.max_players !== undefined ? { maxSlots: payload.max_players } : {}),
        ...(payload.entry_fee !== undefined ? { entryFee: payload.entry_fee } : {}),
        ...(payload.boost_multiplier !== undefined ? { boostMultiplier: payload.boost_multiplier } : {}),
      },
    })
  }
}
