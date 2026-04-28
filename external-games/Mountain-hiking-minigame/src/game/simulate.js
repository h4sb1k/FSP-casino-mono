import { BOOSTS } from './mockRound';

export function makePlayers(basePlayers, selectedBoostId) {
  return basePlayers.map((p, idx) => ({
    ...p,
    boostId: p.boostId ?? (p.isUser ? selectedBoostId : null),
    progress: 0,
    baseSpeed: randomRange(0.014375, 0.017825) + idx * 0.0001265,
    speedPenaltyUntil: 0,
    nearMiss: 0,
    hits: 0,
  }));
}

export function resolveEvent({ event, elapsed, players, feedPush, warningRef }) {
  if (event.type === 'bird') {
    const target = players.find((p) => p.id === event.targetId) || players[0];
    const stats = getStats(target.boostId);
    const avoidChance = 0.2 + stats.birdAvoid + stats.luck;

    if (Math.random() < avoidChance) {
      return {
        kind: 'bird',
        targetId: target.id,
        success: false,
        duration: event.flightSec,
        effect: {
          nearMiss: 1,
          progressLoss: 0,
          speedPenaltySec: 0,
          hits: 0,
          message: `${target.name} уклонился от птицы.`,
          type: 'good',
        },
      };
    }

    return {
      kind: 'bird',
      targetId: target.id,
      success: true,
      duration: event.flightSec,
      effect: {
        nearMiss: 0,
        progressLoss: randomRange(0.07, 0.11),
        speedPenaltySec: 0.9,
        hits: 1,
        message: `${target.name} получил удар от птицы и потерял высоту.`,
        type: 'danger',
      },
    };
  }

  if (event.type === 'avalanche') {
    const zoneMin = event.centerProgress - 0.15;
    const zoneMax = event.centerProgress + 0.12;
    const outcomes = [];
    const inZone = players.filter((player) => player.progress >= zoneMin && player.progress <= zoneMax);
    const candidates = inZone.length
      ? inZone
      : [players.reduce((best, current) => {
          const bestDist = Math.abs(best.progress - event.centerProgress);
          const currentDist = Math.abs(current.progress - event.centerProgress);
          return currentDist < bestDist ? current : best;
        }, players[0])];

    candidates.forEach((player) => {
      const stats = getStats(player.boostId);
      const resistChance = 0.18 + stats.avalancheResist + stats.luck;
      if (Math.random() < resistChance) {
        outcomes.push({
          id: player.id,
          nearMiss: 1.2,
          progressLoss: 0,
          speedPenaltySec: 0.7,
          hits: 0,
          message: `${player.name} выдержал лавину.`,
          type: 'good',
        });
        return;
      }

      outcomes.push({
        id: player.id,
        nearMiss: 0,
        progressLoss: randomRange(0.1, 0.17),
        speedPenaltySec: 1.2,
        hits: 1,
        message: `${player.name} потерял высоту из-за лавины.`,
        type: 'danger',
      });
    });

    warningRef.current = Math.max(warningRef.current, elapsed + 0.65);
    return { kind: 'avalanche', center: event.centerProgress, duration: 2.1, outcomes };
  }

  return null;
}

export function tickPlayers({ players, elapsed, dt }) {
  players.forEach((player, idx) => {
    const stats = getStats(player.boostId);
    const fatigue = 1 - player.progress * 0.28;
    const rhythm = 1 + Math.sin(elapsed * 6 + idx * 0.7) * 0.04;
    const penalty = elapsed < player.speedPenaltyUntil ? 0.58 : 1;
    const summitDrag = player.progress > 0.78 ? Math.max(0.28, 1 - (player.progress - 0.78) * 2.95) : 1;
    const speed = (player.baseSpeed + stats.speedBonus) * fatigue * rhythm * penalty * summitDrag;

    player.progress = clamp(player.progress + speed * dt, 0, 1);
    player.nearMiss = Math.max(0, player.nearMiss - dt);
  });
}

export function getWinnerId(players) {
  return [...players].sort((a, b) => b.progress - a.progress)[0]?.id ?? players[0]?.id;
}

function getStats(boostId) {
  return boostId ? BOOSTS[boostId] : EMPTY_STATS;
}

function randomRange(a, b) {
  return a + Math.random() * (b - a);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const EMPTY_STATS = {
  birdAvoid: 0,
  avalancheResist: 0,
  speedBonus: 0,
  luck: 0,
};
