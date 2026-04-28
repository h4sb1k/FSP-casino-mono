import { instructPhotoUrl } from '../../shared/instructPhotoUrl'
import type { InstructionConfig } from './InstructionModal'

export const OPENCASE_INSTRUCTION: InstructionConfig = {
  title: 'Как играть в Opencase',
  steps: [
    'В лобби отфильтруйте комнаты по входу, количеству мест и классу стола.',
    'Нажмите «Войти» в свободную комнату или создайте новую кнопкой «Создать комнату».',
    'В комнате дождитесь набора участников и таймера; при желании активируйте буст до старта раунда.',
    'После старта следите за лентой кейсов: указатель покажет исход розыгрыша.',
  ],
  note: 'Бонусный баланс общий с другими мини-играми платформы (Mountain, Bank).',
  slides: [
    { src: instructPhotoUrl('opencase-1-lobby.png'), caption: '1) Лобби: фильтры и список комнат' },
    { src: instructPhotoUrl('opencase-2-room-wait.png'), caption: '2) Комната: таймер, участники и буст' },
    { src: instructPhotoUrl('opencase-3-spin.png'), caption: '3) Розыгрыш: лента кейсов и указатель' },
    { src: instructPhotoUrl('opencase-4-result.png'), caption: '4) Итог раунда и баланс' },
  ],
}
