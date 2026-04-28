export function roomPool(participants) {
  return (participants || [])
    .filter((p) => p.confirmed && p.roundBet > 0)
    .reduce((acc, p) => acc + p.roundBet, 0);
}

export function confirmedParticipants(participants) {
  return (participants || []).filter((p) => p.confirmed && p.roundBet > 0);
}

export function getBetButtonState({ phase, me, betInput }) {
  if (phase !== 'waiting') {
    return { disabled: true, label: 'Раунд идёт' };
  }
  if (!me) {
    return { disabled: true, label: 'Войдите в комнату' };
  }
  const parsed = Number(betInput);
  if (!Number.isFinite(parsed)) {
    return { disabled: false, label: me.confirmed ? 'Изменить ставку' : 'Подтвердить ставку' };
  }
  if (me.confirmed && parsed === me.roundBet) {
    return { disabled: true, label: 'Ставка подтверждена' };
  }
  return { disabled: false, label: me.confirmed ? 'Изменить ставку' : 'Подтвердить ставку' };
}

