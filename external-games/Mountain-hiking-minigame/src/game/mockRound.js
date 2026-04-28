export const ROUND_SECONDS = 20;
export const BET = 100;

export const PLAYERS = [
  { id: 'you', name: 'Вы', color: '#ff5f6d', isUser: true },
  { id: 'alex', name: 'Алексей', color: '#4f8bff', isUser: false },
  { id: 'maria', name: 'Мария', color: '#44d884', isUser: false },
  { id: 'denis', name: 'Денис', color: '#f6b142', isUser: false },
  { id: 'olga', name: 'Ольга', color: '#b879ff', isUser: false },
  { id: 'ivan', name: 'Иван', color: '#40d4d0', isUser: false },
];

export const BOOSTS = {
  helmet: {
    id: 'helmet',
    label: 'Шлем',
    icon: '🪖',
    cost: 40,
    birdAvoid: 0.45,
    avalancheResist: 0,
    speedBonus: 0,
    luck: 0,
  },
  boots: {
    id: 'boots',
    label: 'Ботинки',
    icon: '👢',
    cost: 35,
    birdAvoid: 0,
    avalancheResist: 0.1,
    speedBonus: 0.0025,
    luck: 0,
  },
  shield: {
    id: 'shield',
    label: 'Щит лавины',
    icon: '🛡',
    cost: 45,
    birdAvoid: 0,
    avalancheResist: 0.55,
    speedBonus: 0,
    luck: 0,
  },
  lucky: {
    id: 'lucky',
    label: 'Талисман удачи',
    icon: '🍀',
    cost: 30,
    birdAvoid: 0.12,
    avalancheResist: 0.12,
    speedBonus: 0,
    luck: 0.12,
  },
};

export function createRoundPlan(players, roundNo) {
  const playerIds = players.map((p) => p.id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomRange = (a, b) => a + Math.random() * (b - a);

  return {
    roundNo,
    durationSec: ROUND_SECONDS,
    events: [
      {
        id: `bird-${roundNo}-1`,
        type: 'bird',
        atSec: 4.8,
        targetId: pick(playerIds),
        flightSec: 4.2,
      },
      {
        id: `avalanche-${roundNo}-1`,
        type: 'avalanche',
        atSec: 7.1,
        warningLeadSec: 1.3,
        centerProgress: randomRange(0.34, 0.68),
      },
      {
        id: `bird-${roundNo}-2`,
        type: 'bird',
        atSec: 10.4,
        targetId: pick(playerIds),
        flightSec: 4.1,
      },
      {
        id: `bird-${roundNo}-3`,
        type: 'bird',
        atSec: 14.6,
        targetId: pick(playerIds),
        flightSec: 4.2,
      },
      {
        id: `avalanche-${roundNo}-2`,
        type: 'avalanche',
        atSec: 16.6,
        warningLeadSec: 1.2,
        centerProgress: randomRange(0.42, 0.78),
      },
    ],
  };
}
