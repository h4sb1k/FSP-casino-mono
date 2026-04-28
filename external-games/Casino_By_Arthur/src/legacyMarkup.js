export const legacyMarkup = `
<main class="app">
  <header class="panel">
    <div class="header-top">
      <div>
        <h1>Casino FSP MVP</h1>
      </div>
      <div class="header-top-actions" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;justify-content:flex-end;">
        <button type="button" id="openBankAdminBtn" class="secondary">Админ комнаты</button>
        <button type="button" id="openServerAdminBtn" class="secondary" style="display:none;">Платформа</button>
        <button id="openProfileBtn" class="profile-btn">
          <div class="profile-avatar-small"></div>
          <span id="headerUserName">VIP_Player_1</span>
        </button>
      </div>
    </div>
  </header>

  <section id="page-bankHack" class="page active">
    <div id="view-selection">
      <div class="grid two">
        <section class="panel">
          <h2>Профиль и баланс</h2>
          <div class="kpi-row">
            <div><span>Пользователь:</span><strong id="userName"></strong></div>
            <div><span>VIP:</span><strong id="vipStatus"></strong></div>
            <div><span>Доступно:</span><strong id="balance"></strong></div>
            <div><span>Резерв:</span><strong id="reserved"></strong></div>
          </div>
        </section>

        <section class="panel">
          <h2>Параметры подбора комнаты</h2>
          <div class="form-grid">
            <label>Цена входа <input id="filterEntryFee" type="number" min="1" value="100" /></label>
            <label>Места <input id="filterSeats" type="number" min="2" max="10" value="6" /></label>
            <label>Мин. фонд <input id="filterPrizeFund" type="number" min="1" value="500" /></label>
            <label>Нужен буст
              <select id="filterBoostRequired">
                <option value="any" selected>Не важно</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </label>
          </div>
          <div class="actions">
            <button id="autoMatchBtn">Автоподбор комнаты</button>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="rooms-section-head">
          <h2>Список комнат</h2>
          <button type="button" id="openInstructionBtn" class="secondary instruction-open-btn">Инструкция</button>
        </div>
        <div id="roomsList" class="room-list"></div>
      </section>
    </div>

    <div id="view-profile" style="display: none;">
      <div style="margin-bottom: 1rem;">
        <button id="backFromProfileBtn" class="secondary">← На начальную страницу</button>
      </div>
      <div class="profile-dashboard">
        <div class="profile-left">
          <div class="profile-card panel">
            <div class="profile-avatar-large"></div>
            <h2 id="profilePageName" class="profile-name">VIP_Player_1</h2>
            <p id="profilePageRole" class="profile-role">Gold VIP</p>
            <div class="profile-details">
              <div class="detail-item"><span>Email:</span> <strong id="profilePageEmail">player@casino.fsp</strong></div>
              <div class="detail-item"><span>Телефон:</span> <strong id="profilePagePhone">+7 (999) 000-00-00</strong></div>
              <div class="detail-item"><span>Статус аккаунта:</span> <strong style="color: var(--success-color);">Активен</strong></div>
            </div>
            <button id="openEditProfileBtn" class="primary full-width">Редактировать профиль</button>
          </div>
        </div>
        <div class="profile-right">
          <div class="profile-accounts panel">
            <h2>Игровые счета</h2>
            <div class="account-card primary-acc">
              <div class="acc-info">
                <span>Доступный баланс</span>
                <strong id="profileBalanceCount">0 б.</strong>
              </div>
              <div class="acc-actions">
                <button class="primary">Пополнить</button>
                <button class="secondary">Вывести</button>
              </div>
            </div>
            <div class="account-card secondary-acc">
              <div class="acc-info">
                <span>Зарезервировано</span>
                <strong id="profileReservedCount">0 б.</strong>
              </div>
              <div class="acc-actions">
                <button class="secondary" disabled>В игре</button>
              </div>
            </div>
          </div>
          <div class="profile-stats panel">
            <h2>Моя статистика</h2>
            <div class="stat-list">
              <div class="stat-item">
                <span class="stat-icon">🎮</span>
                <div class="stat-text">Сыграно игр</div>
                <strong id="profileGamesPlayed">0</strong>
              </div>
              <div class="stat-item">
                <span class="stat-icon">🏆</span>
                <div class="stat-text">Побед</div>
                <strong id="profileGamesWon">0</strong>
              </div>
              <div class="stat-item">
                <span class="stat-icon">💰</span>
                <div class="stat-text">Общий выигрыш</div>
                <strong id="profileTotalWon">0 б.</strong>
              </div>
              <div class="stat-item">
                <span class="stat-icon">⚡</span>
                <div class="stat-text">Куплено бустов</div>
                <strong id="profileBoostsBought">0</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="editProfileModal" class="modal-overlay" style="display: none;">
      <div class="modal-content panel">
        <h2>Редактировать профиль</h2>
        <div class="form-grid">
          <label>Имя пользователя <input id="editProfileName" type="text" /></label>
          <label>Email <input id="editProfileEmail" type="email" /></label>
          <label>Телефон <input id="editProfilePhone" type="text" /></label>
        </div>
        <div class="actions" style="justify-content: flex-end; margin-top: 1.5rem;">
          <button id="cancelEditProfileBtn" class="secondary">Отмена</button>
          <button id="saveProfileBtn" class="primary">Сохранить</button>
        </div>
      </div>
    </div>

    <div id="view-room" style="display: none;">
      <div class="room-view-toolbar">
        <button id="backToListBtn" class="secondary">← Назад к списку комнат</button>
        <button type="button" id="openInstructionBtnRoom" class="secondary instruction-open-btn">Инструкция</button>
      </div>
      <section class="panel">
        <h2>Текущая комната</h2>
        <div id="roomSummary" class="room-summary">Комната не выбрана</div>
        <div class="actions">
          <button id="joinRoomBtn" disabled>Участвовать в розыгрыше</button>
          <button id="buyBoostBtn" class="boost-btn" disabled>🔥 Купить Буст</button>
          <button id="startWaitingBtn" disabled>Запустить таймер ожидания</button>
          <button id="quickReplayBtn" class="secondary" style="display: none;" disabled>Повторить игру</button>
        </div>
        <p id="roomStatus" class="status">Выберите комнату вручную или через автоподбор.</p>
        <div id="participants" class="participants"></div>
      </section>

      <section class="panel">
        <h2>Раунд «Взлом банка»</h2>
        <div class="arena-wrap">
          <div id="arena" class="arena">
            <div class="arena-door" id="arenaDoor">
              <div class="door-frame-bg">
                <div class="door-hinge top"></div>
                <div class="door-hinge bottom"></div>
                <div class="door-circle">
                  <div class="door-wheel">
                    <div class="spoke" style="transform: rotate(0deg)"></div>
                    <div class="spoke" style="transform: rotate(60deg)"></div>
                    <div class="spoke" style="transform: rotate(120deg)"></div>
                    <div class="wheel-center"></div>
                    <div class="wheel-handle"></div>
                  </div>
                </div>
              </div>
              <div class="door-status">СЕЙФ ЗАКРЫТ<br>ОЖИДАНИЕ ИГРОКОВ</div>
            </div>
            <div class="safe">
              <svg id="tunnelLayer" class="tunnel-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>
              <div class="safe-gold">
                <div class="gold-stack">
                  <span></span><span></span><span></span>
                </div>
                <div class="gold-stack">
                  <span></span><span></span><span></span>
                </div>
              </div>
              <div id="safeStatus" class="safe-status">Сейф закрыт</div>
            </div>
          </div>
        </div>
        <ul id="scoreList" class="score-list"></ul>
        <p id="roundStatus" class="status">Ожидание старта раунда.</p>
      </section>

      <section class="panel">
        <h2>История раундов</h2>
        <div id="historyList" class="history-list"></div>
      </section>
    </div>
  </section>

  <section id="page-admin" class="page" style="display: none;">
    <div class="panel">
      <div style="margin-bottom: 1rem;">
        <button id="backFromAdminBtn" class="secondary">← На начальную страницу</button>
      </div>
      <h2>Конфигуратор комнаты (админ)</h2>
      <div class="form-grid">
        <label>Места <input id="cfgSeats" type="number" min="2" max="10" value="6" /></label>
        <label>Цена входа <input id="cfgEntryFee" type="number" min="1" value="100" /></label>
        <label>Процент фонда (%) <input id="cfgPrizePercent" type="number" min="1" max="100" value="85" /></label>
        <label>Буст доступен
          <select id="cfgBoostEnabled">
            <option value="yes" selected>Да</option>
            <option value="no">Нет</option>
          </select>
        </label>
        <label>Цена буста <input id="cfgBoostPrice" type="number" min="1" value="60" /></label>
      </div>
      
      <div class="admin-analysis" style="margin-top: 1.5rem; padding: 1.25rem; background: #f8f9fb; border-radius: 12px; border: 1px solid var(--border);">
        <h3 style="margin-top: 0;">Анализ конфигурации</h3>
        <div id="adminAnalysisReport" style="font-size: 0.95rem; color: #444; line-height: 1.6;">
          Измените параметры, чтобы увидеть анализ конфигурации.
        </div>
      </div>
      
      <p id="cfgWarning" class="status"></p>
      <div class="actions">
        <button id="saveConfigBtn">Сохранить конфигурацию</button>
      </div>
    </div>
  </section>

  <div id="instructionModal" class="instruction-modal-root" aria-hidden="true">
    <button type="button" class="instruction-modal-backdrop" id="instructionModalBackdrop" aria-label="Закрыть инструкцию"></button>
    <div class="instruction-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="instructionModalTitle">
      <button type="button" class="instruction-modal-close" id="instructionModalClose" aria-label="Закрыть">×</button>
      <h2 id="instructionModalTitle" class="instruction-modal-heading"></h2>
      <div class="instruction-modal-scroll">
        <ol id="instructionModalSteps" class="instruction-modal-steps"></ol>
        <p id="instructionModalNote" class="instruction-modal-note-bank"></p>
      </div>
      <div class="instruction-modal-slider-bank">
        <button type="button" class="instruction-modal-nav" id="instructionModalPrev" aria-label="Предыдущий слайд">‹</button>
        <div class="instruction-modal-slide-viewport">
          <div id="instructionModalTrack" class="instruction-modal-slide-track"></div>
        </div>
        <button type="button" class="instruction-modal-nav" id="instructionModalNext" aria-label="Следующий слайд">›</button>
      </div>
      <div class="instruction-modal-dots" id="instructionModalDots"></div>
    </div>
  </div>

  <div id="fsTransitionDoor" class="fullscreen-transition-door">
    <div class="door-frame-bg">
      <div class="door-hinge top"></div>
      <div class="door-hinge bottom"></div>
      <div class="door-circle">
        <div class="door-wheel">
          <div class="spoke" style="transform: rotate(0deg)"></div>
          <div class="spoke" style="transform: rotate(60deg)"></div>
          <div class="spoke" style="transform: rotate(120deg)"></div>
          <div class="wheel-center"></div>
          <div class="wheel-handle"></div>
        </div>
      </div>
    </div>
  </div>
</main>
`;
