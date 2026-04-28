import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mountainImage from './assets/mountain-bg.svg';
import { BOOSTS, ROUND_SECONDS, createRoundPlan } from './game/mockRound';
import { getWinnerId, makePlayers, resolveEvent, tickPlayers } from './game/simulate';
import { confirmedParticipants, getBetButtonState, roomPool } from './game/betting';

const API_BASE = window.location.origin;
const USER = { id: 'you', name: 'Вы', color: '#111111', isUser: true };
const BOT_NAMES = ['NorthFox', 'SnowMint', 'AeroPeak', 'IcySlot', 'RidgeOne', 'BoltYak', 'LimeWin'];
const BOT_AVATARS = ['🥷', '🧗', '🏂', '🧢', '🤖', '🦊', '🐺'];
const TRACK_HEIGHT = 300;
const TOP_HEADROOM = 0.14;
const WAITING_SECONDS = 60;
const FINISH_SECONDS = 8;
const AVALANCHE_START_Y = -80;
const AVALANCHE_END_Y = 460;
const AVALANCHE_TRAVEL = AVALANCHE_END_Y - AVALANCHE_START_Y;

function phaseRu(phase) {
  const map = {
    waiting: 'Ожидание',
    locked: 'Заблокировано',
    running: 'В процессе',
    finished: 'Завершено',
  };
  return map[phase] || phase;
}

function describeBoost(boost) {
  if (!boost) return '';
  if (boost.id === 'helmet') return 'Шлем защищает от налётов птиц: легче уклониться и сохранить темп на треке.';
  if (boost.id === 'boots') return 'Ботинки усиливают сцепление: подъём становится быстрее, а лавина меньше сбивает ритм.';
  if (boost.id === 'shield') return 'Щит лавины гасит основной удар снежной волны и снижает потери высоты.';
  if (boost.id === 'lucky') return 'Талисман повышает удачу: шанс удачно пережить опасные события становится выше.';
  return 'Улучшает шансы в раунде за счёт серверных модификаторов.';
}

function roomTemplate(id, name, entryFee, maxPlayers, options = {}) {
  return {
    id,
    name,
    entryFee,
    maxPlayers,
    minBet: options.minBet ?? Math.max(50, Math.floor(entryFee * 0.5)),
    maxBet: options.maxBet ?? Math.max(200, Math.floor(entryFee * 2.5)),
    boostEnabled: true,
    boostCost: 120,
    boostMultiplier: 0.2,
    isPrivate: Boolean(options.isPrivate),
    status: 'waiting',
    participants: [],
    createdAt: Date.now(),
  };
}

function metricChance(participant, participants, maxPlayers) {
  const totalWeight =
    participants.reduce((acc, p) => acc + (1 + (p.boostMultiplier || 0)), 0) +
    Math.max(0, maxPlayers - participants.length);
  return (((1 + (participant.boostMultiplier || 0)) / Math.max(1, totalWeight)) * 100).toFixed(1);
}

function mapProgressToViewport(progress) {
  return Math.min(1, progress * (1 - TOP_HEADROOM));
}

function getClimberY(progress, phase = 'running') {
  const rawProgress = Math.max(0, progress || 0);
  const climbPx = rawProgress * TRACK_HEIGHT * 1.9;
  return Math.max(10, TRACK_HEIGHT - climbPx) + (phase === 'waiting' ? 18 : 0);
}

function estimateProgressAtTime(player, impactAt, lane) {
  if (!player) return 0;
  const mock = {
    ...player,
    rhythmOffset: player.rhythmOffset ?? lane * 0.65,
    birdSlowUntil: impactAt + (player.birdSlowUntil ? 0.45 : 0),
    nearMiss: player.nearMiss ?? 0,
  };
  const dt = 0.02;
  for (let t = 0; t < impactAt; t += dt) {
    tickPlayers({ players: [mock], elapsed: t, dt });
  }
  return mock.progress;
}

function feedPush(setter, text, type = '') {
  setter((prev) => [{ text, type }, ...prev].slice(0, 12));
}

function randomBetInRange(room) {
  const min = room.minBet ?? 50;
  const max = room.maxBet ?? 300;
  const step = 10;
  const picks = Math.max(1, Math.floor((max - min) / step));
  return min + Math.floor(Math.random() * (picks + 1)) * step;
}

function getStoredJwt() {
  return window.localStorage.getItem('casino_jwt');
}

function setStoredJwt(token) {
  if (token) window.localStorage.setItem('casino_jwt', token);
}

function roleFromStoredJwt() {
  try {
    const t = getStoredJwt();
    if (!t) return null;
    const parts = t.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const payload = JSON.parse(atob(b64 + pad));
    return payload.role || null;
  } catch {
    return null;
  }
}

function openServerAdminPlatform() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'OPEN_SERVER_ADMIN' }, window.location.origin);
    } else {
      window.location.assign('/admin');
    }
  } catch {
    window.location.assign('/admin');
  }
}

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getStoredJwt();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = payload?.error || payload?.message || (typeof payload === 'string' ? payload : 'Request failed');
    throw new Error(message);
  }
  return payload;
}

async function ensureAuth() {
  const token = getStoredJwt();
  if (token) return token;
  const login = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'aleksey_m',
      password: 'password',
    }),
  });
  setStoredJwt(login.token);
  return login.token;
}

const MOUNTAIN_INSTRUCTION = {
  title: 'Как играть в Mountain-hiking-minigame',
  steps: [
    'Выберите комнату по входу, местам и диапазону ставок.',
    'Внутри комнаты укажите свою ставку вручную (сумма произвольная в пределах лимита комнаты).',
    'Подтвердите участие до старта таймера и при необходимости выберите буст.',
    'После старта следите за событиями на треке: птицы, лавина и финиш раунда.',
  ],
  note:
    'В отличие от Opencase/Bank, здесь ставка не фиксирована: вы сами выбираете размер ставки в доступном диапазоне.',
  slides: [
    { src: '/instruct_photos/mountain-1-lobby-filters.png', caption: '1) Подбор комнаты по фильтрам' },
    { src: '/instruct_photos/mountain-2-room-bet-input.png', caption: '2) Укажите сумму ставки вручную' },
    { src: '/instruct_photos/mountain-3-confirm-bet.png', caption: '3) Подтвердите участие в раунде' },
    { src: '/instruct_photos/mountain-4-round-events.png', caption: '4) Следите за событиями на треке' },
  ],
};

function instructionOneStep(from, to, len) {
  if (len <= 1) return true;
  const forward = (to - from + len) % len;
  const backward = (from - to + len) % len;
  return forward === 1 || backward === 1;
}

function InstructionModal({ open, onClose, config }) {
  const { title, steps, note, slides } = config;
  const [index, setIndex] = useState(0);
  const [slideInstant, setSlideInstant] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (open) {
      setSlideInstant(true);
      setIndex(0);
      indexRef.current = 0;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideInstant(false));
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const goToSlide = useCallback((next) => {
    const from = indexRef.current;
    const len = slides.length;
    const one = instructionOneStep(from, next, len);
    if (!one) setSlideInstant(true);
    setIndex(next);
    indexRef.current = next;
    if (!one) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideInstant(false));
      });
    }
  }, [slides.length]);

  useEffect(() => {
    if (!open) return undefined;
    const len = slides.length;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToSlide((indexRef.current - 1 + len) % len);
      if (e.key === 'ArrowRight') goToSlide((indexRef.current + 1) % len);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, slides.length, goToSlide]);

  if (!open) return null;

  const n = slides.length;
  const trackPct = n > 0 ? (index / n) * 100 : 0;

  return (
    <div className="instruction-modal-root" role="presentation">
      <button
        type="button"
        className="instruction-modal-backdrop"
        aria-label="Закрыть инструкцию"
        onClick={onClose}
      />
      <div
        className="instruction-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mountain-instr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="instruction-modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="mountain-instr-title" className="instruction-modal-title">
          {title}
        </h2>
        <div className="instruction-modal-intro">
          <ol>
            {steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p className="instruction-modal-note">{note}</p>
        </div>
        <div className="instruction-modal-slider">
          <button
            type="button"
            className="instruction-modal-nav prev"
            onClick={() => goToSlide((index - 1 + slides.length) % slides.length)}
            aria-label="Предыдущий слайд"
          >
            ‹
          </button>
          <div
            className="instruction-modal-slide-viewport"
            style={{ '--instruction-slide-count': String(n) }}
          >
            <div
              className={`instruction-modal-slide-track${slideInstant ? ' is-instant' : ''}`}
              style={{ transform: `translate3d(-${trackPct}%, 0, 0)` }}
            >
              {slides.map((s) => (
                <div key={s.src} className="instruction-modal-slide-page">
                  <img src={s.src} alt="" className="instruction-modal-img" loading="lazy" />
                  <p className="instruction-modal-caption">{s.caption}</p>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="instruction-modal-nav next"
            onClick={() => goToSlide((index + 1) % slides.length)}
            aria-label="Следующий слайд"
          >
            ›
          </button>
        </div>
        <div className="instruction-modal-dots" role="tablist" aria-label="Шаги инструкции">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? 'active' : ''}
              onClick={() => goToSlide(i)}
              aria-label={`Шаг ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LobbyView({
  rooms,
  filters,
  setFilters,
  onOpenCreateRoom,
  onQuickMatch,
  onEnterRoom,
  onOpenInstruction,
}) {
  const filtered = rooms.filter((room) => {
    if (room.isPrivate) return false;
    const min = Number(filters.entryMin || 0);
    const max = Number(filters.entryMax || Number.MAX_SAFE_INTEGER);
    const seatsMin = Number(filters.seatsMin || 0);
    const seatsMax = Number(filters.seatsMax || Number.MAX_SAFE_INTEGER);
    return (
      room.entryFee >= min &&
      room.entryFee <= max &&
      room.maxPlayers >= seatsMin &&
      room.maxPlayers <= seatsMax &&
      (!filters.status || room.status === filters.status)
    );
  });

  return (
    <section className="lobby-page">
      <div className="hero panel">
        <div>
          <p className="eyebrow">Лобби</p>
          <h2>Комнаты и серверная логика раунда</h2>
          <p>Выберите комнату, подтвердите ставку и начните раунд.</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="action secondary" onClick={onOpenInstruction}>
            Инструкция
          </button>
          <button className="action secondary" onClick={onQuickMatch}>Подобрать комнату</button>
          <button className="action" onClick={onOpenCreateRoom}>Создать комнату</button>
        </div>
      </div>

      <div className="filters panel">
        <input placeholder="Вход от" value={filters.entryMin} onChange={(e) => setFilters((s) => ({ ...s, entryMin: e.target.value }))} />
        <input placeholder="Вход до" value={filters.entryMax} onChange={(e) => setFilters((s) => ({ ...s, entryMax: e.target.value }))} />
        <input placeholder="Мест от" value={filters.seatsMin} onChange={(e) => setFilters((s) => ({ ...s, seatsMin: e.target.value }))} />
        <input placeholder="Мест до" value={filters.seatsMax} onChange={(e) => setFilters((s) => ({ ...s, seatsMax: e.target.value }))} />
        <select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
          <option value="">Все статусы</option>
          <option value="waiting">Ожидание</option>
          <option value="locked">Заблокировано</option>
          <option value="running">В процессе</option>
          <option value="finished">Завершено</option>
        </select>
      </div>

      <div className="rooms-grid">
        {filtered.map((room) => {
          const inactive = room.status !== 'waiting';
          return (
            <article key={room.id} className={`room-card panel ${inactive ? 'inactive' : ''}`}>
              <div className="room-head">
                <span className="status-badge">{phaseRu(room.status)}</span>
                <span className="small">#{room.id}</span>
              </div>
              <h3>{room.name}</h3>
              <div className="row"><span>Вход:</span><strong>{room.entryFee}</strong></div>
              <div className="row"><span>Мест:</span><strong>{room.participants.length} / {room.maxPlayers}</strong></div>
              <div className="row"><span>Пул:</span><strong>{roomPool(room.participants)}</strong></div>
              <div className="row"><span>Ставка:</span><strong>{room.minBet} - {room.maxBet}</strong></div>
              <div className="row"><span>Тип:</span><strong>Общая</strong></div>
              <button className="action" disabled={inactive} onClick={() => onEnterRoom(room.id)}>
                {inactive ? 'Недоступна' : 'Войти'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CreateRoomModal({ open, config, setConfig, onClose, onSubmit }) {
  if (!open) return null;
  return (
    <div className="boost-modal-backdrop" onClick={onClose}>
      <div className="boost-modal room-create-modal" onClick={(e) => e.stopPropagation()}>
        <h4>Конфигуратор комнаты</h4>
        <div className="room-create-grid">
          <label className="room-create-field">
            <span>Название комнаты</span>
            <input
              value={config.name}
              onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Например: Комната 777"
            />
          </label>
          <label className="room-create-field">
            <span>Вход в комнату</span>
            <input
              type="number"
              min="50"
              value={config.entryFee}
              onChange={(e) => setConfig((prev) => ({ ...prev, entryFee: e.target.value }))}
              placeholder="Вход"
            />
          </label>
          <label className="room-create-field">
            <span>Количество мест</span>
            <input
              type="number"
              min="2"
              max="8"
              value={config.maxPlayers}
              onChange={(e) => setConfig((prev) => ({ ...prev, maxPlayers: e.target.value }))}
              placeholder="Мест"
            />
          </label>
          <label className="room-create-field">
            <span>Ставка от</span>
            <input
              type="number"
              min="10"
              value={config.minBet}
              onChange={(e) => setConfig((prev) => ({ ...prev, minBet: e.target.value }))}
              placeholder="Минимум"
            />
          </label>
          <label className="room-create-field">
            <span>Ставка до</span>
            <input
              type="number"
              min="10"
              value={config.maxBet}
              onChange={(e) => setConfig((prev) => ({ ...prev, maxBet: e.target.value }))}
              placeholder="Максимум"
            />
          </label>
          <label className="room-create-checkbox">
            <input
              type="checkbox"
              checked={config.isPrivate}
              onChange={(e) => setConfig((prev) => ({ ...prev, isPrivate: e.target.checked }))}
            />
            <span>Частная комната</span>
          </label>
        </div>
        <div className="boost-popup-actions">
          <button className="action secondary" onClick={onClose}>Закрыть</button>
          <button className="action" onClick={onSubmit}>Создать</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [balance, setBalance] = useState(0);
  const [walletReady, setWalletReady] = useState(false);
  const [isServerAdmin, setIsServerAdmin] = useState(false);
  const [rooms, setRooms] = useState([
    roomTemplate(101, 'Горная комната Gold', 300, 4),
    roomTemplate(102, 'Горная комната Silver', 150, 5),
  ]);
  const [filters, setFilters] = useState({
    entryMin: '',
    entryMax: '',
    seatsMin: '',
    seatsMax: '',
    status: '',
  });
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [timer, setTimer] = useState(WAITING_SECONDS);
  const [roundNo, setRoundNo] = useState(1);
  const [phase, setPhase] = useState('waiting');
  const [betInput, setBetInput] = useState('');
  const [selectedBoostId, setSelectedBoostId] = useState(null);
  const [pendingBoostId, setPendingBoostId] = useState(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createConfig, setCreateConfig] = useState({
    name: '',
    entryFee: 250,
    maxPlayers: 4,
    minBet: 100,
    maxBet: 400,
    isPrivate: false,
  });
  const [feed, setFeed] = useState([{ text: 'Лобби готово к игре.', type: '' }]);

  const [players, setPlayers] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [winnerId, setWinnerId] = useState(null);
  const [birdAnimations, setBirdAnimations] = useState([]);
  const [avalancheAnimations, setAvalancheAnimations] = useState([]);
  const [impactAnimations, setImpactAnimations] = useState([]);
  const [warningActiveUntil, setWarningActiveUntil] = useState(0);
  const [resultFx, setResultFx] = useState(null);

  const rafRef = useRef(0);
  const warningRef = useRef(0);
  const pendingEffectsRef = useRef([]);
  const runtimeRef = useRef({
    startTs: 0,
    lastElapsed: 0,
    players: [],
    events: [],
    eventCursor: 0,
  });

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  const winner = players.find((p) => p.id === winnerId);
  const prizePool = activeRoom ? roomPool(activeRoom.participants) : 0;
  const confirmedCount = activeRoom ? confirmedParticipants(activeRoom.participants || []).length : 0;
  const waitingForStart = Math.max(0, 2 - confirmedCount);
  const winnerLane = winnerId ? players.findIndex((p) => p.id === winnerId) : -1;
  const winnerY = winner && phase === 'finished'
    ? getClimberY(winner.progress || 0, 'finished')
    : 0;
  const displaySeconds = phase === 'running'
    ? Math.max(0, Math.ceil(ROUND_SECONDS - elapsed))
    : Math.max(0, timer);
  const roundTimerLabel = `${Math.floor(displaySeconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(displaySeconds % 60)
    .toString()
    .padStart(2, '0')}`;
  const metersMap = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[p.id] = Math.floor((p.progress || 0) * 1000);
    });
    return map;
  }, [players]);
  const meInRoom = activeRoom?.participants?.find((p) => p.id === USER.id) ?? null;
  const betButton = getBetButtonState({ phase, me: meInRoom, betInput });

  async function refreshWallet() {
    await ensureAuth();
    const wallet = await apiRequest('/api/wallet/me');
    setBalance(Number(wallet.balance || 0));
    setIsServerAdmin(roleFromStoredJwt() === 'ADMIN');
    setWalletReady(true);
  }

  async function spendBalance(amount) {
    const response = await apiRequest('/api/wallet/spend', {
      method: 'POST',
      body: JSON.stringify({ amount: Math.round(amount) }),
    });
    setBalance(Number(response.balance || 0));
  }

  async function creditBalance(amount) {
    const response = await apiRequest('/api/wallet/credit', {
      method: 'POST',
      body: JSON.stringify({ amount: Math.round(amount) }),
    });
    setBalance(Number(response.balance || 0));
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  useEffect(() => {
    refreshWallet().catch((e) => {
      feedPush(setFeed, `Ошибка инициализации кошелька: ${e.message}`, 'danger');
    });
  }, []);

  function updateRoom(roomId, updater) {
    setRooms((prev) => prev.map((room) => (room.id === roomId ? updater(room) : room)));
  }

  function createRoomFromConfig() {
    const id = Math.floor(100 + Math.random() * 899);
    const entryFee = Math.max(50, Number(createConfig.entryFee) || 250);
    const maxPlayers = Math.max(2, Math.min(8, Number(createConfig.maxPlayers) || 4));
    const minBet = Math.max(10, Number(createConfig.minBet) || Math.floor(entryFee * 0.5));
    const maxBet = Math.max(minBet, Number(createConfig.maxBet) || Math.floor(entryFee * 2.5));
    const roomName = createConfig.name?.trim() || `Комната ${id}`;
    const room = roomTemplate(id, roomName, entryFee, maxPlayers, {
      minBet,
      maxBet,
      isPrivate: createConfig.isPrivate,
    });
    setRooms((prev) => [...prev, room]);
    setCreateModalOpen(false);
    feedPush(setFeed, `Создана ${room.isPrivate ? 'частная' : 'общая'} комната #${id}`, 'good');
    if (room.isPrivate) enterRoom(id);
  }

  function quickMatch() {
    const target = rooms.find((room) => !room.isPrivate && room.status === 'waiting' && room.participants.length < room.maxPlayers);
    if (!target) {
      feedPush(setFeed, 'Подходящих общих комнат пока нет.', 'danger');
      return;
    }
    enterRoom(target.id);
  }

  function enterRoom(roomId) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    if (!room.participants.some((p) => p.id === USER.id)) {
      updateRoom(roomId, (r) => ({
        ...r,
        participants: [...r.participants, { ...USER, boostMultiplier: 0, roundBet: 0, confirmed: false, selectedBoostId: null }],
      }));
    }
    setActiveRoomId(roomId);
    setTimer(WAITING_SECONDS);
    setPhase('waiting');
    setWinnerId(null);
    setElapsed(0);
    setBirdAnimations([]);
    setAvalancheAnimations([]);
    setImpactAnimations([]);
    setBetInput('');
    setSelectedBoostId(null);
    setFeed([{ text: `Вход в комнату #${roomId}`, type: '' }]);
  }

  async function leaveRoom() {
    try {
      if (phase === 'running') return;
      if (activeRoom) {
        const me = activeRoom.participants.find((p) => p.id === USER.id);
        if (me?.confirmed && me.roundBet > 0) {
          await creditBalance(me.roundBet);
        }
        updateRoom(activeRoom.id, (room) => ({
          ...room,
          participants: room.participants.filter((p) => p.id !== USER.id),
        }));
      }
      setActiveRoomId(null);
      setPlayers([]);
      setFeed([{ text: 'Покинули комнату. Чат событий очищен.', type: '' }]);
      setResultFx(null);
      setBetInput('');
    } catch (error) {
      feedPush(setFeed, (error instanceof Error ? error.message : 'Ошибка выхода из комнаты'), 'danger');
    }
  }

  function addBotIfNeeded() {
    if (!activeRoom || activeRoom.status !== 'waiting') return;
    if (activeRoom.participants.length >= activeRoom.maxPlayers) return;
    const idx = activeRoom.participants.length;
    const bot = {
      id: `bot-${Date.now()}-${idx}`,
      name: BOT_NAMES[idx % BOT_NAMES.length],
      color: ['#ff5b2e', '#ffd400', '#1f8fff', '#38d39f', '#9135ff'][idx % 5],
      avatar: BOT_AVATARS[idx % BOT_AVATARS.length],
      isBot: true,
      boostMultiplier: 0,
      roundBet: 0,
      confirmed: false,
      selectedBoostId: null,
    };
    updateRoom(activeRoom.id, (room) => ({ ...room, participants: [...room.participants, bot] }));
  }

  function confirmRandomBotBet() {
    if (!activeRoom || activeRoom.status !== 'waiting') return;
    const bot = activeRoom.participants.find((p) => p.isBot && !p.confirmed);
    if (!bot) return;
    const amount = randomBetInRange(activeRoom);
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      participants: room.participants.map((p) => (
        p.id === bot.id ? { ...p, roundBet: amount, confirmed: true } : p
      )),
    }));
  }

  useEffect(() => {
    if (!activeRoom || phase !== 'waiting') return undefined;
    const botTimer = window.setInterval(() => addBotIfNeeded(), 2800);
    const botConfirmTimer = window.setInterval(() => confirmRandomBotBet(), 1800);
    return () => {
      window.clearInterval(botTimer);
      window.clearInterval(botConfirmTimer);
    };
  }, [activeRoom, phase]);

  function startServerRound() {
    if (!activeRoom) return;
    const participants = confirmedParticipants(activeRoom.participants);
    if (participants.length < 2) {
      feedPush(setFeed, 'Для старта нужны минимум 2 подтверждённых участника.', 'danger');
      return false;
    }
    const boostId = selectedBoostId;

    const sourcePlayers = participants.map((p, idx) => ({
      id: p.id,
      name: p.name,
      color: p.color || ['#111111', '#f04e23', '#1e90ff', '#22aa66'][idx % 4],
      isUser: p.id === USER.id,
      boostId: p.selectedBoostId || null,
    }));

    const freshPlayers = makePlayers(sourcePlayers, boostId);

    const plan = createRoundPlan(freshPlayers, roundNo);
    runtimeRef.current = {
      startTs: 0,
      lastElapsed: 0,
      players: freshPlayers,
      events: [...plan.events].sort((a, b) => a.atSec - b.atSec),
      eventCursor: 0,
    };
    warningRef.current = 0;
    setPlayers([...freshPlayers]);
    setPhase('running');
    setElapsed(0);
    setWinnerId(null);
    setBirdAnimations([]);
    setAvalancheAnimations([]);
    setImpactAnimations([]);
    setResultFx(null);
    pendingEffectsRef.current = [];
    updateRoom(activeRoom.id, (room) => ({ ...room, status: 'running' }));
    rafRef.current = requestAnimationFrame(step);
    return true;
  }

  function finishRound() {
    cancelAnimationFrame(rafRef.current);
    const winner = getWinnerId(runtimeRef.current.players);
    setWinnerId(winner);
    setPhase('finished');
    setTimer(FINISH_SECONDS);
    setRoundNo((v) => v + 1);
    if (winner === USER.id) {
      creditBalance(prizePool).catch(() => undefined);
      feedPush(setFeed, `Вы победили. +${prizePool}`, 'good');
      setResultFx('win');
    } else {
      feedPush(setFeed, `${players.find((p) => p.id === winner)?.name || 'Игрок'} победил`, '');
      setResultFx('lose');
    }
    if (activeRoom) {
      updateRoom(activeRoom.id, (room) => ({ ...room, status: 'finished' }));
    }
    pendingEffectsRef.current = [];
  }

  function step(ts) {
    const rt = runtimeRef.current;
    if (!rt.startTs) rt.startTs = ts;
    const elapsedSec = (ts - rt.startTs) / 1000;
    const dt = Math.min(0.05, Math.max(0, elapsedSec - rt.lastElapsed));
    rt.lastElapsed = elapsedSec;

    while (rt.eventCursor < rt.events.length && rt.events[rt.eventCursor].atSec <= elapsedSec) {
      const event = rt.events[rt.eventCursor];
      const targetBefore = event.type === 'bird' ? rt.players.find((p) => p.id === event.targetId) : null;

      const resolved = resolveEvent({
        event,
        elapsed: elapsedSec,
        players: rt.players,
        warningRef,
        feedPush: (text, type) => feedPush(setFeed, text, type),
      });

      if (resolved?.kind === 'bird') {
        const lane = Math.max(0, rt.players.findIndex((p) => p.id === resolved.targetId));
        const impactAt = resolved.duration;
        const targetProgress = estimateProgressAtTime(targetBefore, impactAt, lane);
        const targetY = getClimberY(targetProgress, 'running') + 2;
        const startY = Math.max(12, targetY - (32 + Math.random() * 30));
        setBirdAnimations((prev) => [...prev, {
          id: event.id,
          startedAt: elapsedSec,
          duration: resolved.duration,
          lane,
          targetId: resolved.targetId,
          startY,
          birdDy: targetY - startY,
        }]);
        if (resolved.success) {
          setImpactAnimations((prev) => [...prev, {
            id: `${event.id}-hit`,
            lane,
            y: targetY,
            type: 'hit',
            duration: 0.58,
            startedAt: elapsedSec + impactAt + 0.06,
            targetId: resolved.targetId,
          }]);
        }
        pendingEffectsRef.current.push({
          applyAt: elapsedSec + impactAt,
          targetId: resolved.targetId,
          effect: resolved.effect,
        });
      }

      if (resolved?.kind === 'avalanche') {
        const avalancheDuration = resolved.duration * 3;
        setAvalancheAnimations((prev) => [...prev, {
          id: event.id,
          startedAt: elapsedSec,
          duration: avalancheDuration,
          center: resolved.center,
        }]);
        if (resolved.outcomes?.length) {
          const impacts = resolved.outcomes
            .map((outcome, idx) => {
              const id = outcome.id;
              const lane = rt.players.findIndex((p) => p.id === id);
              const target = rt.players.find((p) => p.id === id);
              if (lane < 0 || !target) return null;
              const currentTargetY = getClimberY(target.progress, 'running') + 2;
              const initialHitRatio = Math.max(0, Math.min(1, (currentTargetY - AVALANCHE_START_Y) / AVALANCHE_TRAVEL));
              const initialImpactOffset = avalancheDuration * initialHitRatio;
              const predictedProgress = estimateProgressAtTime(target, initialImpactOffset, lane);
              const predictedTargetY = getClimberY(predictedProgress, 'running') + 2;
              const hitRatio = Math.max(0, Math.min(1, (predictedTargetY - AVALANCHE_START_Y) / AVALANCHE_TRAVEL));
              const impactAt = elapsedSec + (avalancheDuration * hitRatio);
              pendingEffectsRef.current.push({
                applyAt: impactAt,
                targetId: id,
                effect: outcome,
              });
              return {
                id: `${event.id}-snow-${id}-${idx}`,
                lane,
                y: predictedTargetY,
                type: 'snow',
                duration: 0.72,
                startedAt: impactAt,
                targetId: id,
              };
            })
            .filter(Boolean);
          if (impacts.length) setImpactAnimations((prev) => [...prev, ...impacts]);
        }
      }

      rt.eventCursor += 1;
    }

    if (pendingEffectsRef.current.length) {
      const due = [];
      const next = [];
      pendingEffectsRef.current.forEach((entry) => {
        if (elapsedSec >= entry.applyAt) due.push(entry);
        else next.push(entry);
      });
      pendingEffectsRef.current = next;
      due.forEach((entry) => {
        const target = rt.players.find((p) => p.id === entry.targetId);
        if (!target) return;
        const effect = entry.effect;
        target.progress = Math.max(0, Math.min(1, target.progress - (effect.progressLoss || 0)));
        target.speedPenaltyUntil = Math.max(target.speedPenaltyUntil, elapsedSec + (effect.speedPenaltySec || 0));
        target.hits += effect.hits || 0;
        target.nearMiss = Math.max(target.nearMiss, effect.nearMiss || 0);
        feedPush(setFeed, effect.message, effect.type);
      });
    }

    for (let i = rt.eventCursor; i < rt.events.length; i += 1) {
      const event = rt.events[i];
      if (event.type === 'avalanche' && !event._warned && elapsedSec >= event.atSec - event.warningLeadSec) {
        event._warned = true;
        warningRef.current = Math.max(warningRef.current, elapsedSec + event.warningLeadSec);
      }
    }

    tickPlayers({ players: rt.players, elapsed: elapsedSec, dt });
    setPlayers([...rt.players]);
    setElapsed(elapsedSec);
    setWarningActiveUntil(warningRef.current);
    setBirdAnimations((prev) => prev.filter((row) => elapsedSec - row.startedAt < row.duration + 0.18));
    setAvalancheAnimations((prev) => prev.filter((row) => elapsedSec - row.startedAt < row.duration + 0.5));
    setImpactAnimations((prev) => prev.filter((row) => elapsedSec - row.startedAt < row.duration + 0.2));

    if (elapsedSec >= ROUND_SECONDS) {
      finishRound();
      return;
    }
    rafRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!activeRoom) return undefined;
    const id = window.setInterval(() => {
      const confirmedCount = confirmedParticipants(activeRoom?.participants || []).length;
      if (phase === 'waiting') {
        setTimer((t) => {
          if (confirmedCount < 2) return WAITING_SECONDS;
          if (t <= 1) {
            if (activeRoom) updateRoom(activeRoom.id, (room) => ({ ...room, status: 'locked' }));
            setPhase('locked');
            setTimeout(() => {
              const started = startServerRound();
              if (!started) {
                if (activeRoom) updateRoom(activeRoom.id, (room) => ({ ...room, status: 'waiting' }));
                setPhase('waiting');
                setTimer(WAITING_SECONDS);
              }
            }, 500);
            return 0;
          }
          return t - 1;
        });
      } else if (phase === 'finished') {
        setTimer((t) => {
          if (t <= 1) {
            setPhase('waiting');
            setWinnerId(null);
            setSelectedBoostId(null);
            setResultFx(null);
            setBetInput('');
            if (activeRoom) {
              updateRoom(activeRoom.id, (room) => ({
                ...room,
                status: 'waiting',
                participants: room.participants.map((p) => (
                  { ...p, roundBet: 0, confirmed: false, boostMultiplier: 0, selectedBoostId: null }
                )),
              }));
            }
            return WAITING_SECONDS;
          }
          return t - 1;
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeRoom, phase]);

  useEffect(() => {
    if (!activeRoom || phase === 'running') return;
    const synced = (activeRoom.participants || [])
      .filter((p) => p.confirmed && p.roundBet > 0)
      .map((p, idx) => ({
      id: p.id,
      name: p.name,
      color: p.color || ['#111111', '#f04e23', '#1e90ff', '#22aa66', '#9c27b0'][idx % 5],
      isUser: p.id === USER.id,
      progress: 0,
      nearMiss: 0,
      }));
    setPlayers(synced);
  }, [activeRoom, phase]);

  async function confirmBet() {
    try {
      if (!activeRoom || phase !== 'waiting') return;
      const amount = Number(betInput);
      if (!Number.isFinite(amount)) {
        feedPush(setFeed, 'Введите корректную сумму ставки.', 'danger');
        return;
      }
      if (amount < activeRoom.minBet || amount > activeRoom.maxBet) {
        feedPush(setFeed, `Ставка должна быть в диапазоне ${activeRoom.minBet}-${activeRoom.maxBet}.`, 'danger');
        return;
      }
      const me = activeRoom.participants.find((p) => p.id === USER.id);
      if (!me) return;
      if (me.confirmed && amount === me.roundBet) {
        feedPush(setFeed, 'Ставка уже подтверждена.', '');
        return;
      }
      const prevBet = me.confirmed ? me.roundBet : 0;
      const delta = amount - prevBet;
      if (delta > 0 && balance < delta) {
        feedPush(setFeed, 'Недостаточно баланса для ставки.', 'danger');
        return;
      }
      if (delta > 0) {
        await spendBalance(delta);
      } else if (delta < 0) {
        await creditBalance(Math.abs(delta));
      }
      updateRoom(activeRoom.id, (room) => ({
        ...room,
        participants: room.participants.map((p) => (
          p.id === USER.id ? { ...p, roundBet: amount, confirmed: true } : p
        )),
      }));
      feedPush(setFeed, me.confirmed ? `Ставка изменена: ${prevBet} → ${amount}.` : `Ставка ${amount} подтверждена.`, 'good');
    } catch (error) {
      feedPush(setFeed, (error instanceof Error ? error.message : 'Ошибка подтверждения ставки'), 'danger');
    }
  }

  function requestBoost(boostId) {
    if (!activeRoom || phase !== 'waiting') return;
    setPendingBoostId(boostId);
  }

  async function applyBoost() {
    try {
      if (!activeRoom || phase !== 'waiting' || !pendingBoostId) return;
      const boostId = pendingBoostId;
      const boost = BOOSTS[boostId];
      if (!boost) return;
      const currentBoost = selectedBoostId ? BOOSTS[selectedBoostId] : null;
      const refund = currentBoost && currentBoost.id !== boostId ? currentBoost.cost : 0;
      const required = boost.cost - refund;
      if (required > 0 && balance < required) {
        feedPush(setFeed, 'Недостаточно баланса на буст', 'danger');
        setPendingBoostId(null);
        return;
      }
      if (required > 0) {
        await spendBalance(required);
      } else if (required < 0) {
        await creditBalance(Math.abs(required));
      }
      setSelectedBoostId(boostId);
      updateRoom(activeRoom.id, (room) => ({
        ...room,
        participants: room.participants.map((p) => (
          p.id === USER.id
            ? { ...p, boostMultiplier: activeRoom.boostMultiplier, selectedBoostId: boostId }
            : p
        )),
      }));
      feedPush(setFeed, `Буст "${boost.label}" применён.`, 'good');
      setPendingBoostId(null);
    } catch (error) {
      feedPush(setFeed, (error instanceof Error ? error.message : 'Ошибка активации буста'), 'danger');
    }
  }

  async function cancelSelectedBoost() {
    try {
      if (!activeRoom || phase !== 'waiting' || !selectedBoostId) {
        setPendingBoostId(null);
        return;
      }
      const boost = BOOSTS[selectedBoostId];
      if (boost) await creditBalance(boost.cost);
      setSelectedBoostId(null);
      updateRoom(activeRoom.id, (room) => ({
        ...room,
        participants: room.participants.map((p) => (
          p.id === USER.id ? { ...p, boostMultiplier: 0, selectedBoostId: null } : p
        )),
      }));
      feedPush(setFeed, 'Буст отменён.', '');
      setPendingBoostId(null);
    } catch (error) {
      feedPush(setFeed, (error instanceof Error ? error.message : 'Ошибка отмены буста'), 'danger');
    }
  }

  return (
    <>
      <div className="app">
        {!activeRoom ? (
          <>
            <header className="topbar">
              <div className="brand">
                <h1>SUMMIT SURVIVOR</h1>
                <p>Комнаты и раунды</p>
              </div>
              <div className="topbar-right">
                <div className="metrics">
                  <Metric label="Баланс" value={balance} />
                  <Metric label="Комнат" value={rooms.length} />
                  <Metric label="Wallet" value={walletReady ? 'online' : 'sync...'} />
                </div>
                <button type="button" className="action secondary" onClick={() => setInstructionOpen(true)}>
                  Инструкция
                </button>
                {isServerAdmin && (
                  <button type="button" className="action secondary" onClick={openServerAdminPlatform}>
                    Админ платформы
                  </button>
                )}
              </div>
            </header>
            <LobbyView
              rooms={rooms}
              filters={filters}
              setFilters={setFilters}
              onOpenCreateRoom={() => setCreateModalOpen(true)}
              onQuickMatch={quickMatch}
              onEnterRoom={enterRoom}
              onOpenInstruction={() => setInstructionOpen(true)}
            />
            <CreateRoomModal
              open={createModalOpen}
              config={createConfig}
              setConfig={setCreateConfig}
              onClose={() => setCreateModalOpen(false)}
              onSubmit={createRoomFromConfig}
            />
          </>
        ) : (
          <>
            <header className="topbar">
              <div className="brand">
                <h1>{activeRoom.name}</h1>
                <p>Статус: {phaseRu(phase)}</p>
              </div>
              <div className="topbar-right">
                <div className="metrics">
                  <Metric label="Баланс" value={balance} />
                </div>
                <button type="button" className="action secondary" onClick={() => setInstructionOpen(true)}>
                  Инструкция
                </button>
                {isServerAdmin && (
                  <button type="button" className="action secondary" onClick={openServerAdminPlatform}>
                    Админ платформы
                  </button>
                )}
              </div>
            </header>

            <main className="layout">
        <section className="arena panel">
          <div className="round-timer">
            <span className="round-timer__label">Раунд</span>
            <span className="round-timer__round">#{roundNo}</span>
            <strong className={`round-timer__value ${displaySeconds <= 5 && phase !== 'waiting' ? 'critical' : ''}`}>
              {roundTimerLabel}
            </strong>
            <span className="round-timer__phase">{phaseRu(phase)}</span>
          </div>
          {phase === 'running' && elapsed < warningActiveUntil && <div className="warning-banner">Внимание: лавина</div>}
          <div className={`tracks phase-${phase}`}>
            <img className="mountain-image" src={mountainImage} alt="" />
            {players.map((player, idx) => {
              const y = getClimberY(player.progress || 0, phase);
              return (
                <div
                  key={player.id}
                  className="track-lane"
                  style={{
                    left: `${(idx / Math.max(1, players.length)) * 100}%`,
                    width: `${100 / Math.max(1, players.length)}%`,
                  }}
                >
                  <div className="track-line" />
                  <div className={`climber ${player.isUser ? 'you' : ''}`} style={{ transform: `translate(-50%, ${y}px)`, '--climber': player.color }}>
                    <div className="runner">
                      <span className="head" />
                      <span className="torso" />
                      <span className="arm arm-left" />
                      <span className="arm arm-right" />
                      <span className="leg leg-left" />
                      <span className="leg leg-right" />
                    </div>
                    <span className="runner-tag">{player.isUser ? 'ВЫ' : player.name}</span>
                  </div>
                </div>
              );
            })}

            {birdAnimations.map((bird) => {
              const progress = Math.max(0, Math.min(1, (elapsed - bird.startedAt) / Math.max(0.0001, bird.duration)));
              const trackedLane = players.findIndex((p) => p.id === bird.targetId);
              const lane = trackedLane >= 0 ? trackedLane : bird.lane;
              const target = trackedLane >= 0 ? players[trackedLane] : null;
              const targetYNow = target
                ? getClimberY(target.progress || 0, phase) + 2
                : bird.startY + bird.birdDy;
              const y = bird.startY + (targetYNow - bird.startY) * progress;
              const targetX = ((lane + 0.5) / Math.max(1, players.length)) * 100;
              const left = -14 + (targetX + 14) * progress;
              return (
                <div key={bird.id} className="bird-flight-tracked" style={{ left: `${left}%`, top: `${y}px` }}>
                  <span className="bird-emoji">🐦</span>
                </div>
              );
            })}

            {avalancheAnimations.map((snow) => (
              <div
                key={snow.id}
                className="avalanche-curtain"
                style={{
                  top: `${AVALANCHE_START_Y}px`,
                  animationDuration: `${snow.duration}s`,
                }}
              >
                <span className="avalanche-curtain__layer layer-back" />
                <span className="avalanche-curtain__layer layer-mid" />
                <span className="avalanche-curtain__layer layer-front" />
                {Array.from({ length: 18 }).map((_, idx) => (
                  <span
                    key={`${snow.id}-clump-${idx}`}
                    className="avalanche-curtain__clump"
                    style={{
                      '--x': `${3 + idx * 5.6}%`,
                      '--size': `${28 + (idx % 6) * 7}px`,
                      '--y': `${idx % 3 === 0 ? -12 : idx % 3 === 1 ? 6 : 18}px`,
                    }}
                  />
                ))}
              </div>
            ))}

            {impactAnimations.filter((fx) => elapsed >= fx.startedAt).map((fx) => {
              const trackedLane = fx.targetId ? players.findIndex((p) => p.id === fx.targetId) : -1;
              const lane = trackedLane >= 0 ? trackedLane : fx.lane;
              const target = trackedLane >= 0 ? players[trackedLane] : null;
              const liveY = target
                ? getClimberY(target.progress || 0, phase) + 2
                : fx.y;
              return (
                <div
                  key={fx.id}
                  className={`impact impact-${fx.type}`}
                  style={{
                    left: `${((lane + 0.5) / Math.max(1, players.length)) * 100}%`,
                    top: `${liveY}px`,
                    animationDuration: `${fx.duration}s`,
                  }}
                />
              );
            })}
            {phase === 'finished' && winner && winnerLane >= 0 && (
              <div
                className={`winner-burst ${resultFx === 'win' ? 'winner-burst-you' : ''}`}
                style={{
                  left: `${((winnerLane + 0.5) / Math.max(1, players.length)) * 100}%`,
                  top: `${winnerY}px`,
                }}
              >
                <span className="winner-burst__icon">{resultFx === 'win' ? '🏆' : '⭐'}</span>
                <span className="winner-burst__text">{resultFx === 'win' ? 'ВЫ ПОБЕДИЛИ' : 'ПОБЕДИТЕЛЬ'}</span>
              </div>
            )}
          </div>
          {phase === 'finished' && winner && (
            <div className={`result-fx ${resultFx === 'win' ? 'result-win' : 'result-lose'}`}>
              {resultFx === 'win' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}
            </div>
          )}

        </section>

        <aside className="sidebar">
          <div className="panel compact guide-compact">
            <h3>Памятка по участию</h3>
            <ul>
              <li>Ставка задается вручную в поле ввода.</li>
              <li>Учитывается только подтвержденная ставка.</li>
              <li>Без подтверждения вы не участвуете в раунде.</li>
            </ul>
          </div>
          <div className="panel compact">
            <h3>Участие в раунде</h3>
            <p className="room-action-sub">Введите сумму и подтвердите участие до старта.</p>
            {phase === 'waiting' && waitingForStart > 0 && (
              <p className="room-waiting-note">
                Ожидание: ещё {waitingForStart} участник{waitingForStart === 1 ? '' : waitingForStart < 5 ? 'а' : 'ов'} для старта
              </p>
            )}
            <div className="bet-controls">
              <input
                className="bet-input"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value)}
                placeholder={`Ставка ${activeRoom.minBet}-${activeRoom.maxBet}`}
                disabled={phase !== 'waiting'}
              />
              <button className="action" disabled={betButton.disabled} onClick={confirmBet}>{betButton.label}</button>
            </div>
            <button className="action secondary sidebar-exit" disabled={phase === 'running'} onClick={() => { void leaveRoom(); }}>Выйти в лобби</button>
          </div>
          <div className="panel compact">
            <h3>Бусты</h3>
            <p className="room-action-sub">Выберите один буст до начала раунда.</p>
            <div className="boosts">
              {Object.values(BOOSTS).map((boost) => (
                <button key={boost.id} className={`boost ${selectedBoostId === boost.id ? 'selected' : ''}`} disabled={phase !== 'waiting'} onClick={() => requestBoost(boost.id)}>
                  <span>{boost.icon}</span>
                  <strong>{boost.label}</strong>
                  <small>{boost.cost} pts</small>
                </button>
              ))}
            </div>
          </div>
          <div className="panel compact">
            <h3>Участники</h3>
            {(activeRoom.participants || []).map((p) => (
              <div key={p.id} className={`climber-row ${p.id === USER.id ? 'you' : ''}`}>
                <div className="name">{p.avatar || '🧗'} {p.name}</div>
                <div className="meters">
                  {(p.confirmed && p.roundBet > 0)
                    ? (phase === 'running' || phase === 'finished' ? `${metersMap[p.id] || 0} м` : '0 м')
                    : 'не участвует'}
                </div>
              </div>
            ))}
          </div>
          <div className="panel compact">
            <h3>События</h3>
            <div className="feed">
              {feed.map((item, idx) => <div key={idx} className={`feed-item ${item.type}`}>{item.text}</div>)}
            </div>
          </div>
          {phase === 'finished' && winner && (
            <div className="panel compact winner-panel">
              <h3>Победитель</h3>
              <div className="leader">{winner.name}</div>
            </div>
          )}
        </aside>
      </main>
            {pendingBoostId && BOOSTS[pendingBoostId] && (
              <div className="boost-modal-backdrop" onClick={() => setPendingBoostId(null)}>
                <div className="boost-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="boost-modal__icon">{BOOSTS[pendingBoostId].icon}</div>
                  <h4>{BOOSTS[pendingBoostId].label}</h4>
                  <p>{describeBoost(BOOSTS[pendingBoostId])}</p>
                  <div className="boost-popup-actions">
                    <button className="action secondary" onClick={() => setPendingBoostId(null)}>Закрыть</button>
                    <button className="action" onClick={() => { void (selectedBoostId === pendingBoostId ? cancelSelectedBoost() : applyBoost()); }}>
                      {selectedBoostId === pendingBoostId ? 'Отменить' : 'Применить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <InstructionModal
        open={instructionOpen}
        onClose={() => setInstructionOpen(false)}
        config={MOUNTAIN_INSTRUCTION}
      />
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
