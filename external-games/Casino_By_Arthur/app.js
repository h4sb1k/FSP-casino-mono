const COLORS = ["#ffcf42", "#5dd6ff", "#ff7a7a", "#c69bff", "#8dff8d", "#ffab4f", "#d0ff55", "#ff6ad1", "#77f0ff", "#ffc85e"];
const SAFE_CENTER = { x: 50, y: 50 };
const SAFE_RECT = { left: 28, right: 72, top: 8, bottom: 92 };
const GOLD_BAR_RECT = { left: 42, right: 58, top: 43, bottom: 57 };
const WAIT_DURATION_SEC = 60;
const APPROACH_DURATION_MS = 5000;
const API_BASE = window.location.origin;

const el = {
  userName: document.getElementById("userName"),
  vipStatus: document.getElementById("vipStatus"),
  balance: document.getElementById("balance"),
  reserved: document.getElementById("reserved"),
  filterEntryFee: document.getElementById("filterEntryFee"),
  filterSeats: document.getElementById("filterSeats"),
  filterPrizeFund: document.getElementById("filterPrizeFund"),
  filterBoostRequired: document.getElementById("filterBoostRequired"),
  autoMatchBtn: document.getElementById("autoMatchBtn"),
  roomsList: document.getElementById("roomsList"),
  roomSummary: document.getElementById("roomSummary"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  buyBoostBtn: document.getElementById("buyBoostBtn"),
  startWaitingBtn: document.getElementById("startWaitingBtn"),
  quickReplayBtn: document.getElementById("quickReplayBtn"),
  backToListBtn: document.getElementById("backToListBtn"),
  viewSelection: document.getElementById("view-selection"),
  viewRoom: document.getElementById("view-room"),
  viewAdmin: document.getElementById("page-admin"),
  backFromAdminBtn: document.getElementById("backFromAdminBtn"),
  adminAnalysisReport: document.getElementById("adminAnalysisReport"),
  fsTransitionDoor: document.getElementById("fsTransitionDoor"),
  roomStatus: document.getElementById("roomStatus"),
  participants: document.getElementById("participants"),
  arena: document.getElementById("arena"),
  tunnelLayer: document.getElementById("tunnelLayer"),
  safeStatus: document.getElementById("safeStatus"),
  scoreList: document.getElementById("scoreList"),
  roundStatus: document.getElementById("roundStatus"),
  backendLog: document.getElementById("backendLog"),
  historyList: document.getElementById("historyList"),
  cfgSeats: document.getElementById("cfgSeats"),
  cfgEntryFee: document.getElementById("cfgEntryFee"),
  cfgPrizePercent: document.getElementById("cfgPrizePercent"),
  cfgBoostEnabled: document.getElementById("cfgBoostEnabled"),
  cfgBoostPrice: document.getElementById("cfgBoostPrice"),
  cfgWarning: document.getElementById("cfgWarning"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
  
  openBankAdminBtn: document.getElementById("openBankAdminBtn"),
  openServerAdminBtn: document.getElementById("openServerAdminBtn"),
  openProfileBtn: document.getElementById("openProfileBtn"),
  backFromProfileBtn: document.getElementById("backFromProfileBtn"),
  viewProfile: document.getElementById("view-profile"),
  headerUserName: document.getElementById("headerUserName"),
  profilePageName: document.getElementById("profilePageName"),
  profilePageRole: document.getElementById("profilePageRole"),
  profileBalanceCount: document.getElementById("profileBalanceCount"),
  profileReservedCount: document.getElementById("profileReservedCount"),
  profileGamesPlayed: document.getElementById("profileGamesPlayed"),
  profileGamesWon: document.getElementById("profileGamesWon"),
  profileTotalWon: document.getElementById("profileTotalWon"),
  profileBoostsBought: document.getElementById("profileBoostsBought"),
  
  profilePageEmail: document.getElementById("profilePageEmail"),
  profilePagePhone: document.getElementById("profilePagePhone"),
  openEditProfileBtn: document.getElementById("openEditProfileBtn"),
  editProfileModal: document.getElementById("editProfileModal"),
  editProfileName: document.getElementById("editProfileName"),
  editProfileEmail: document.getElementById("editProfileEmail"),
  editProfilePhone: document.getElementById("editProfilePhone"),
  cancelEditProfileBtn: document.getElementById("cancelEditProfileBtn"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),

  openInstructionBtn: document.getElementById("openInstructionBtn"),
  openInstructionBtnRoom: document.getElementById("openInstructionBtnRoom"),
  instructionModal: document.getElementById("instructionModal"),
  instructionModalBackdrop: document.getElementById("instructionModalBackdrop"),
  instructionModalClose: document.getElementById("instructionModalClose"),
  instructionModalTitle: document.getElementById("instructionModalTitle"),
  instructionModalSteps: document.getElementById("instructionModalSteps"),
  instructionModalNote: document.getElementById("instructionModalNote"),
  instructionModalTrack: document.getElementById("instructionModalTrack"),
  instructionModalPrev: document.getElementById("instructionModalPrev"),
  instructionModalNext: document.getElementById("instructionModalNext"),
  instructionModalDots: document.getElementById("instructionModalDots"),
};

const BANK_INSTRUCTION = {
  title: "Как играть в Bank-minigame",
  steps: [
    "Выберите подходящую комнату в списке.",
    "Перейдите в комнату и нажмите «Участвовать в розыгрыше» для резерва входа.",
    "При желании купите буст, чтобы повысить шансы.",
    "Дождитесь таймера и начала раунда взлома.",
  ],
  note: "Подсказка: без нажатия кнопки участия игрок не попадает в текущий розыгрыш комнаты.",
  slides: [
    { src: "/instruct_photos/bank-1-room-list.png", caption: "1) Выбор комнаты" },
    { src: "/instruct_photos/bank-2-selected-room.png", caption: "2) Переход в комнату" },
    { src: "/instruct_photos/bank-3-participate-button.png", caption: "3) Нажмите «Участвовать в розыгрыше»" },
    { src: "/instruct_photos/bank-4-boost.png", caption: "4) Буст повышает шансы" },
  ],
};

let instructionSlideIndex = 0;
let instructionSlidePrevIndex = 0;

function isInstructionOneStep(from, to, len) {
  if (len <= 1) return true;
  const forward = (to - from + len) % len;
  const backward = (from - to + len) % len;
  return forward === 1 || backward === 1;
}

function escapeInstructionHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const state = {
  user: { 
    id: "u1", 
    name: "VIP_Player_1", 
    vip: "Gold", 
    balance: 2400, 
    reserved: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    totalWon: 0,
    boostsBought: 0,
    email: "player@casino.fsp",
    phone: "+7 (999) 000-00-00"
  },
  config: { seats: 6, entryFee: 100, prizePercent: 85, boostEnabled: true, boostPrice: 60 },
  rooms: [],
  selectedRoomId: null,
  inRoom: false,
  boostBought: false,
  waitingIntervalId: null,
  waitingSecLeft: WAIT_DURATION_SEC,
  roundIntervalId: null,
  roundRunning: false,
  playedCurrentRoom: false,
  robbers: [],
  winnerId: null,
  history: [],
};

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function formatPoints(value) {
  return `${value} б.`;
}

function getStoredJwt() {
  return window.localStorage.getItem("casino_jwt");
}

function setStoredJwt(token) {
  if (token) window.localStorage.setItem("casino_jwt", token);
}

function roleFromStoredJwt() {
  try {
    const t = getStoredJwt();
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const payload = JSON.parse(atob(b64 + pad));
    return payload.role || null;
  } catch {
    return null;
  }
}

function showBankAdminView() {
  if (!el.viewSelection || !el.viewRoom) return;
  el.viewSelection.style.display = "none";
  el.viewRoom.style.display = "none";
  if (el.viewProfile) el.viewProfile.style.display = "none";
  if (el.viewAdmin) {
    el.viewAdmin.style.display = "block";
    updateAdminAnalysis();
  }
  try {
    const adminPath = new URL("admin", window.location.href).pathname;
    window.history.pushState({}, "", adminPath);
  } catch {
    window.history.pushState({}, "", "/bank/admin");
  }
}

function openServerAdminFromIframe() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "OPEN_SERVER_ADMIN" }, window.location.origin);
    } else {
      window.location.assign("/admin");
    }
  } catch {
    window.location.assign("/admin");
  }
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getStoredJwt();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const message = payload?.error || payload?.message || (typeof payload === "string" ? payload : "Request failed");
    throw new Error(message);
  }
  return payload;
}

async function ensureAuth() {
  const token = getStoredJwt();
  if (token) return token;
  const login = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: "aleksey_m",
      password: "password",
    }),
  });
  setStoredJwt(login.token);
  return login.token;
}

async function refreshWallet() {
  await ensureAuth();
  const wallet = await apiRequest("/api/wallet/me");
  state.user.balance = Number(wallet.balance || 0);
  state.user.reserved = Number(wallet.reservedBalance || 0);
  renderUser();
  if (el.openServerAdminBtn) {
    el.openServerAdminBtn.style.display = roleFromStoredJwt() === "ADMIN" ? "inline-block" : "none";
  }
}

async function spendBalance(amount) {
  const response = await apiRequest("/api/wallet/spend", {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(amount) }),
  });
  state.user.balance = Number(response.balance || 0);
  renderUser();
}

async function creditBalance(amount) {
  const response = await apiRequest("/api/wallet/credit", {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(amount) }),
  });
  state.user.balance = Number(response.balance || 0);
  renderUser();
}

function makeRoom(id, entryFee, seats, prizePercent, boostEnabled, boostPrice, occupied) {
  const prizeFund = Math.floor(entryFee * seats * (prizePercent / 100));
  return { id, entryFee, seats, prizePercent, boostEnabled, boostPrice, occupied, prizeFund, status: "open" };
}

function generateRooms() {
  const base = state.config;
  state.rooms = [
    makeRoom("R-101", base.entryFee, base.seats, base.prizePercent, base.boostEnabled, base.boostPrice, randomInt(0, 2)),
    makeRoom("R-102", base.entryFee + 40, Math.min(10, base.seats + 1), Math.min(95, base.prizePercent + 3), true, base.boostPrice + 10, randomInt(1, 4)),
    makeRoom("R-103", Math.max(40, base.entryFee - 20), Math.max(2, base.seats - 1), Math.max(70, base.prizePercent - 5), false, 0, randomInt(0, 1)),
    makeRoom("R-104", base.entryFee + 120, Math.min(10, base.seats + 2), Math.min(95, base.prizePercent + 6), true, base.boostPrice + 35, randomInt(2, 5)),
  ];
}

function getSelectedRoom() {
  return state.rooms.find((room) => room.id === state.selectedRoomId) ?? null;
}

function renderUser() {
  el.userName.textContent = state.user.name;
  el.vipStatus.textContent = state.user.vip;
  el.balance.textContent = formatPoints(state.user.balance);
  el.reserved.textContent = formatPoints(state.user.reserved);
  
  // Update Header
  if (el.headerUserName) el.headerUserName.textContent = state.user.name;

  // Update Profile Page
  if (el.profilePageName) el.profilePageName.textContent = state.user.name;
  if (el.profilePageRole) el.profilePageRole.textContent = `${state.user.vip} VIP`;
  if (el.profileBalanceCount) el.profileBalanceCount.textContent = formatPoints(state.user.balance);
  if (el.profileReservedCount) el.profileReservedCount.textContent = formatPoints(state.user.reserved);
  if (el.profileGamesPlayed) el.profileGamesPlayed.textContent = state.user.gamesPlayed;
  if (el.profileGamesWon) el.profileGamesWon.textContent = state.user.gamesWon;
  if (el.profileTotalWon) el.profileTotalWon.textContent = formatPoints(state.user.totalWon);
  if (el.profileBoostsBought) el.profileBoostsBought.textContent = state.user.boostsBought;
  if (el.profilePageEmail) el.profilePageEmail.textContent = state.user.email;
  if (el.profilePagePhone) el.profilePagePhone.textContent = state.user.phone;
}

function openEditProfile() {
  if (el.editProfileName) el.editProfileName.value = state.user.name;
  if (el.editProfileEmail) el.editProfileEmail.value = state.user.email;
  if (el.editProfilePhone) el.editProfilePhone.value = state.user.phone;
  if (el.editProfileModal) el.editProfileModal.style.display = "flex";
}

function closeEditProfile() {
  if (el.editProfileModal) el.editProfileModal.style.display = "none";
}

function saveEditProfile() {
  if (el.editProfileName) state.user.name = el.editProfileName.value.trim() || state.user.name;
  if (el.editProfileEmail) state.user.email = el.editProfileEmail.value.trim() || state.user.email;
  if (el.editProfilePhone) state.user.phone = el.editProfilePhone.value.trim() || state.user.phone;
  closeEditProfile();
  renderUser();
}

function roomMatchesFilter(room) {
  const fee = Number.parseInt(el.filterEntryFee.value, 10) || 0;
  const seats = Number.parseInt(el.filterSeats.value, 10) || 0;
  const minFund = Number.parseInt(el.filterPrizeFund.value, 10) || 0;
  const boostRequired = el.filterBoostRequired.value;
  const boostMatch = boostRequired === "any" || (boostRequired === "yes" ? room.boostEnabled : !room.boostEnabled);
  return room.entryFee <= fee && room.seats === seats && room.prizeFund >= minFund && boostMatch && room.status === "open";
}

function renderRooms() {
  el.roomsList.innerHTML = "";
  state.rooms.forEach((room) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `room-item ${room.id === state.selectedRoomId ? "selected" : ""}`;
    item.innerHTML = `<strong>${room.id}</strong> | вход: ${room.entryFee} | места: ${room.seats} | фонд: ${room.prizeFund} | буст: ${room.boostEnabled ? `да (${room.boostPrice})` : "нет"} | занято: ${room.occupied}/${room.seats}`;
    item.addEventListener("click", () => selectRoom(room.id));
    el.roomsList.appendChild(item);
  });
}

function renderRoomSummary() {
  const room = getSelectedRoom();
  if (!room) {
    el.roomSummary.textContent = "Комната не выбрана";
    el.joinRoomBtn.style.display = "inline-block";
    el.joinRoomBtn.disabled = true;
    el.startWaitingBtn.style.display = "none";
    el.buyBoostBtn.disabled = true;
    el.quickReplayBtn.disabled = state.history.length === 0;
    renderParticipants([]);
    return;
  }

  el.roomSummary.textContent = `Комната ${room.id}: вход ${room.entryFee}, мест ${room.seats}, фонд ${room.prizeFund}, буст ${room.boostEnabled ? `доступен за ${room.boostPrice}` : "выключен"}`;
  
  if (state.inRoom || room.status !== "open") {
    el.joinRoomBtn.style.display = "none";
    el.quickReplayBtn.style.display = "none";
  } else {
    if (state.playedCurrentRoom) {
      el.joinRoomBtn.style.display = "none";
      el.quickReplayBtn.style.display = "inline-block";
      el.quickReplayBtn.disabled = false;
    } else {
      el.joinRoomBtn.style.display = "inline-block";
      el.joinRoomBtn.disabled = false;
      el.quickReplayBtn.style.display = "none";
    }
  }
  
  el.startWaitingBtn.style.display = "none";
  // allow boost purchase before game starts
  el.buyBoostBtn.disabled = !state.inRoom || !room.boostEnabled || state.boostBought || state.roundRunning;
  el.quickReplayBtn.disabled = state.history.length === 0;

  // Render initial participants if not in room
  if (!state.inRoom && !state.roundRunning && state.selectedRoomId) {
    const previewParticipants = [];
    for (let i = 0; i < room.occupied; i += 1) {
      previewParticipants.push({ id: `h${i + 1}`, name: `Игрок_${i + 1}`, isBot: false, boost: false, weight: 1 });
    }
    renderParticipants(previewParticipants);
  }
}

function renderParticipants(list) {
  el.participants.innerHTML = "";
  const totalWeight = list.reduce((sum, p) => sum + p.weight, 0) || 1;
  list.forEach((p) => {
    const chance = ((p.weight / totalWeight) * 100).toFixed(1);
    const row = document.createElement("div");
    row.className = `participant ${p.isBot ? "bot" : ""}`;
    row.innerHTML = `<span>${p.name}${p.isBot ? " (бот)" : ""}${p.boost ? " + буст" : ""}</span><strong>шанс: ${chance}%</strong>`;
    el.participants.appendChild(row);
  });
}

function updateStatus(text, cls = "status") {
  el.roomStatus.className = cls;
  el.roomStatus.textContent = text;
}

function selectRoom(roomId) {
  if (state.roundRunning) return;
  
  if (state.restartIntervalId) {
    window.clearInterval(state.restartIntervalId);
    state.restartIntervalId = null;
  }
  if (state.waitingIntervalId) {
    window.clearInterval(state.waitingIntervalId);
    state.waitingIntervalId = null;
  }

  state.selectedRoomId = roomId;
  const room = getSelectedRoom();
  if (room && room.status === "finished") {
    room.status = "open";
    room.occupied = 0;
  }
  state.inRoom = false;
  state.boostBought = false;
  state.playedCurrentRoom = false;
  el.backToListBtn.disabled = false;
  const door = document.getElementById("arenaDoor");
  if (door) door.classList.remove("opening");
  clearArena();
  
  // Transition animation
  if (el.fsTransitionDoor) {
    el.fsTransitionDoor.classList.remove("opening");
    el.fsTransitionDoor.classList.add("closing");
    
    setTimeout(() => {
      el.viewSelection.style.display = "none";
      el.viewRoom.style.display = "block";
      
      renderRooms();
      renderRoomSummary();
      updateStatus("Комната выбрана. Нажмите «Участвовать в розыгрыше»");
      
      setTimeout(() => {
        el.fsTransitionDoor.classList.remove("closing");
        el.fsTransitionDoor.classList.add("opening");
        
        setTimeout(() => {
          el.fsTransitionDoor.style.transition = "none";
          el.fsTransitionDoor.classList.remove("opening");
          void el.fsTransitionDoor.offsetWidth; // Force reflow
          el.fsTransitionDoor.style.transition = "";
        }, 1200);
      }, 300);
    }, 1200);
  } else {
    el.viewSelection.style.display = "none";
    el.viewRoom.style.display = "block";
    renderRooms();
    renderRoomSummary();
    updateStatus("Комната выбрана. Нажмите «Участвовать в розыгрыше»");
  }
}

async function backToList() {
  if (state.roundRunning) return;
  
  if (state.waitingIntervalId) {
    window.clearInterval(state.waitingIntervalId);
    state.waitingIntervalId = null;
    const room = getSelectedRoom();
    if (room && state.inRoom) {
      creditBalance(room.entryFee).catch(() => undefined);
      state.user.reserved -= room.entryFee;
      room.occupied = Math.max(0, room.occupied - 1);
    }
  }

  if (state.restartIntervalId) {
    window.clearInterval(state.restartIntervalId);
    state.restartIntervalId = null;
  }

  state.inRoom = false;
  state.boostBought = false;
  
  if (el.fsTransitionDoor) {
    el.fsTransitionDoor.classList.remove("opening");
    el.fsTransitionDoor.classList.add("closing");
    
    setTimeout(() => {
      el.viewRoom.style.display = "none";
      el.viewSelection.style.display = "block";
      state.selectedRoomId = null;
      renderRooms();
      
      setTimeout(() => {
        el.fsTransitionDoor.classList.remove("closing");
        el.fsTransitionDoor.classList.add("opening");
        
        setTimeout(() => {
          el.fsTransitionDoor.style.transition = "none";
          el.fsTransitionDoor.classList.remove("opening");
          void el.fsTransitionDoor.offsetWidth; // Force reflow
          el.fsTransitionDoor.style.transition = "";
        }, 1200);
      }, 300);
    }, 1200);
  } else {
    el.viewRoom.style.display = "none";
    el.viewSelection.style.display = "block";
    state.selectedRoomId = null;
    renderRooms();
  }
}

function autoMatch() {
  const matched = state.rooms.find((room) => roomMatchesFilter(room));
  if (!matched) {
    updateStatus("Подходящая комната не найдена. Измените фильтры.", "status danger");
    return;
  }
  selectRoom(matched.id);
  updateStatus(`Автоподбор выбрал ${matched.id}.`);
}

async function joinRoom() {
  const room = getSelectedRoom();
  if (!room) return;
  if (state.user.balance < room.entryFee) {
    updateStatus("Недостаточно бонусных баллов для входа в комнату.", "status danger");
    return;
  }
  try {
    await spendBalance(room.entryFee);
  } catch (error) {
    updateStatus(error instanceof Error ? error.message : "Ошибка списания баланса", "status danger");
    return;
  }
  state.user.reserved += room.entryFee;
  state.inRoom = true;
  el.backToListBtn.disabled = true; // Lock the user in the room once they reserve points
  if (el.openProfileBtn) el.openProfileBtn.disabled = true;
  room.occupied = Math.min(room.seats, room.occupied + 1);
  renderUser();
  renderRooms();
  renderRoomSummary();

  // Start 10s waiting dynamically
  state.waitingSecLeft = WAIT_DURATION_SEC;
  updateStatus(`Ожидание игроков: ${state.waitingSecLeft} сек.`, "status");
  el.startWaitingBtn.disabled = true;

  // Initialize participants with current occupied count (humans)
  const initialParticipants = [];
  initialParticipants.push({ id: "user", name: state.user.name, isBot: false, boost: state.boostBought, weight: state.boostBought ? 1.75 : 1 });
  const humansLeft = Math.max(0, room.occupied - 1);
  for (let i = 0; i < humansLeft; i += 1) {
    initialParticipants.push({ id: `h${i + 1}`, name: `Игрок_${i + 2}`, isBot: false, boost: false, weight: 1 });
  }
  let currentParticipants = initialParticipants;
  renderParticipants(currentParticipants);

  window.clearInterval(state.waitingIntervalId);
  state.waitingIntervalId = window.setInterval(() => {
    state.waitingSecLeft -= 1;

    // Dynamically add a bot sometimes to simulate filling
    if (state.waitingSecLeft > 0 && currentParticipants.length < room.seats && Math.random() > 0.4) {
      const idx = currentParticipants.length + 1;
      currentParticipants.push({ id: `b${idx}`, name: `Bot_${idx}`, isBot: true, boost: false, weight: randomRange(0.85, 1.15) });
      renderParticipants(currentParticipants);
    }

    if (state.waitingSecLeft <= 0) {
      window.clearInterval(state.waitingIntervalId);
      state.waitingIntervalId = null;

      // Fill remaining spots with bots
      while (currentParticipants.length < room.seats) {
        const idx = currentParticipants.length + 1;
        currentParticipants.push({ id: `b${idx}`, name: `Bot_${idx}`, isBot: true, boost: false, weight: randomRange(0.85, 1.15) });
      }
      // Update one last time in case user bought boost during wait
      currentParticipants[0].boost = state.boostBought;
      currentParticipants[0].weight = state.boostBought ? 1.75 : 1;

      renderParticipants(currentParticipants);
      updateStatus("Таймер завершен. Свободные места заполнены ботами. Запуск раунда...");
      
      const backendResult = backendPickWinner(currentParticipants, room);
      renderBackendLog(backendResult);
      prepareRound(currentParticipants, backendResult);
      runRound(backendResult);
      return;
    }
    updateStatus(`Ожидание игроков: ${state.waitingSecLeft} сек.`);
  }, 1000);
}

function getEstimatedChance(room, boost) {
  let totalW = boost ? 1.75 : 1;
  const humansLeft = Math.max(0, room.occupied - 1);
  totalW += humansLeft;
  const botCount = room.seats - 1 - humansLeft;
  totalW += botCount;
  return ((boost ? 1.75 : 1) / totalW * 100).toFixed(1);
}

async function buyBoost() {
  const room = getSelectedRoom();
  if (!room || !room.boostEnabled || state.boostBought) return;
  if (state.user.balance < room.boostPrice) {
    updateStatus("Недостаточно баллов для покупки буста.", "status danger");
    return;
  }

  const oldChance = getEstimatedChance(room, false);
  const newChance = getEstimatedChance(room, true);

  try {
    await spendBalance(room.boostPrice);
  } catch (error) {
    updateStatus(error instanceof Error ? error.message : "Ошибка покупки буста", "status danger");
    return;
  }
  state.user.boostsBought++;
  state.boostBought = true;
  renderRoomSummary();
  updateStatus("Буст куплен. Ваш вес в розыгрыше будет выше.", "status success");

  const overlay = document.createElement("div");
  overlay.className = "fullscreen-boost";
  overlay.innerHTML = `
    <div class="boost-title">Поздравляем, ваш шанс на победу вырос!</div>
    <div class="boost-chance-old">${oldChance}%</div>
    <div class="boost-chance-new">${newChance}%</div>
  `;
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 600);
  }, 3500);
}

function createSpawnPoint(index, total) {
  const side = index % 4;
  const spread = (index + 1) / (total + 1);
  if (side === 0) return { x: 4, y: spread * 100, side: "left", spread };
  if (side === 1) return { x: 96, y: spread * 100, side: "right", spread };
  if (side === 2) return { x: spread * 100, y: 6, side: "top", spread };
  return { x: spread * 100, y: 94, side: "bottom", spread };
}

function getSafeBoundaryPoint(spawn) {
  if (spawn.side === "left") return { x: SAFE_RECT.left, y: spawn.y };
  if (spawn.side === "right") return { x: SAFE_RECT.right, y: spawn.y };
  if (spawn.side === "top") return { x: spawn.x, y: SAFE_RECT.top };
  return { x: spawn.x, y: SAFE_RECT.bottom };
}

function getGoldBoundaryTarget(entryPoint) {
  const dx = entryPoint.x - SAFE_CENTER.x;
  const dy = entryPoint.y - SAFE_CENTER.y;
  const penetration = randomRange(1.2, 2.2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx < 0) return { x: GOLD_BAR_RECT.left + penetration, y: randomRange(GOLD_BAR_RECT.top + 1, GOLD_BAR_RECT.bottom - 1) };
    return { x: GOLD_BAR_RECT.right - penetration, y: randomRange(GOLD_BAR_RECT.top + 1, GOLD_BAR_RECT.bottom - 1) };
  }
  if (dy < 0) return { x: randomRange(GOLD_BAR_RECT.left + 1, GOLD_BAR_RECT.right - 1), y: GOLD_BAR_RECT.top + penetration };
  return { x: randomRange(GOLD_BAR_RECT.left + 1, GOLD_BAR_RECT.right - 1), y: GOLD_BAR_RECT.bottom - penetration };
}

function buildOrthogonalPoints(entry, target) {
  const points = [{ x: entry.x, y: entry.y }];
  let current = { x: entry.x, y: entry.y };
  const turns = randomInt(4, 6);

  for (let i = 0; i < turns; i += 1) {
    const isHorizontal = i % 2 === 0;
    if (isHorizontal) {
      const stepX = current.x + (target.x - current.x) * randomRange(0.18, 0.42);
      current = { x: Math.max(SAFE_RECT.left + 1, Math.min(SAFE_RECT.right - 1, stepX)), y: current.y };
    } else {
      const stepY = current.y + (target.y - current.y) * randomRange(0.18, 0.42);
      current = { x: current.x, y: Math.max(SAFE_RECT.top + 1, Math.min(SAFE_RECT.bottom - 1, stepY)) };
    }
    points.push({ x: Number(current.x.toFixed(2)), y: Number(current.y.toFixed(2)) });
  }

  points.push({ x: target.x, y: current.y });
  points.push({ x: target.x, y: target.y });
  return points;
}

function createTunnelPath(entryPoint, targetPoint, color) {
  const orthPoints = buildOrthogonalPoints(entryPoint, targetPoint);
  const points = orthPoints.map((p) => {
    const localX = ((p.x - SAFE_RECT.left) / (SAFE_RECT.right - SAFE_RECT.left)) * 1000;
    const localY = ((p.y - SAFE_RECT.top) / (SAFE_RECT.bottom - SAFE_RECT.top)) * 1000;
    return `${localX.toFixed(1)} ${localY.toFixed(1)}`;
  });
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points.join(","));
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", color);
  polyline.setAttribute("stroke-width", "9");
  polyline.setAttribute("stroke-linecap", "square");
  polyline.setAttribute("stroke-linejoin", "miter");
  polyline.setAttribute("opacity", "0.95");
  const length = polyline.getTotalLength();
  polyline.style.strokeDasharray = `${length}`;
  polyline.style.strokeDashoffset = `${length}`;
  polyline.dataset.totalLength = String(length);
  return { polyline, orthPoints };
}

function getPointAtProgress(points, progress) {
  if (points.length < 2) return points[0];
  const ratio = Math.max(0, Math.min(1, progress / 100));
  const segments = [];
  let totalLength = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    segments.push({ a, b, length });
    totalLength += length;
  }

  let target = totalLength * ratio;
  for (const segment of segments) {
    if (target <= segment.length) {
      const t = segment.length === 0 ? 0 : target / segment.length;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      };
    }
    target -= segment.length;
  }

  return points[points.length - 1];
}

function computePathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return length;
}

function buildParticipants(room) {
  const players = [];
  players.push({ id: "user", name: state.user.name, isBot: false, boost: state.boostBought, weight: state.boostBought ? 1.75 : 1 });
  const humansLeft = Math.max(0, room.occupied - 1);
  for (let i = 0; i < humansLeft; i += 1) {
    players.push({ id: `h${i + 1}`, name: `Игрок_${i + 2}`, isBot: false, boost: false, weight: 1 });
  }
  while (players.length < room.seats) {
    const idx = players.length + 1;
    players.push({ id: `b${idx}`, name: `Bot_${idx}`, isBot: true, boost: false, weight: randomRange(0.85, 1.15) });
  }
  return players;
}

function backendPickWinner(participants, room) {
  const weighted = participants.map((p) => ({ ...p, finalWeight: p.weight * randomRange(0.92, 1.08) }));
  const total = weighted.reduce((sum, p) => sum + p.finalWeight, 0);
  let cursor = randomRange(0, total);
  let winner = weighted[weighted.length - 1];
  for (const p of weighted) {
    cursor -= p.finalWeight;
    if (cursor <= 0) {
      winner = p;
      break;
    }
  }
  return { winnerId: winner.id, weighted, totalWeight: total, roomId: room.id };
}

function clearArena() {
  el.arena.querySelectorAll(".robber").forEach((node) => node.remove());
  el.tunnelLayer.innerHTML = "";
}

function placeRobber(robber) {
  robber.element.style.left = `calc(${robber.x}% - 20px)`;
  robber.element.style.top = `calc(${robber.y}% - 20px)`;
}

function renderScore() {
  el.scoreList.innerHTML = "";
  state.robbers.forEach((r) => {
    const item = document.createElement("li");
    item.className = "score-item";
    item.innerHTML = `<strong>${r.name}${r.isBot ? " (бот)" : ""}</strong><div class="progress-track"><div class="progress-fill" style="background:${r.color};"></div></div><span>0%</span>`;
    r.progressElement = item.querySelector(".progress-fill");
    r.progressLabel = item.querySelector("span");
    el.scoreList.appendChild(item);
  });
}

function prepareRound(participants, backendResult) {
  clearArena();
  state.winnerId = backendResult.winnerId;
  const total = participants.length;
  const winnerDurationSec = randomRange(8.5, 10.3);
  const chaserOrder = participants
    .filter((p) => p.id !== backendResult.winnerId)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => p.id);
  state.robbers = participants.map((p, i) => {
    const spawn = createSpawnPoint(i, total);
    const entryPoint = getSafeBoundaryPoint(spawn);
    const goldTarget = getGoldBoundaryTarget(entryPoint);
    const robberEl = document.createElement("div");
    robberEl.className = "robber";
    robberEl.style.color = COLORS[i % COLORS.length];
    robberEl.setAttribute("data-index", String(i + 1));
    const spark = document.createElement("div");
    spark.className = "spark";
    robberEl.appendChild(spark);
    el.arena.appendChild(robberEl);
    const { polyline, orthPoints } = createTunnelPath(entryPoint, goldTarget, COLORS[i % COLORS.length]);
    el.tunnelLayer.appendChild(polyline);

    const isWinner = p.id === backendResult.winnerId;
    const tunnelLength = computePathLength(orthPoints);
    const targetDurationSec = isWinner
      ? winnerDurationSec
      : winnerDurationSec + randomRange(1.1, 2.9);
    const digBaseSpeed = tunnelLength / (targetDurationSec * 12.5);
    const chaseRank = chaserOrder.indexOf(p.id);
    let maxDistanceFactor = randomRange(0.9, 0.94);
    if (isWinner) {
      maxDistanceFactor = 1;
    } else if (chaseRank === 0) {
      // 2nd place: finish ~2-3% behind winner
      maxDistanceFactor = randomRange(0.97, 0.98);
    } else if (chaseRank === 1) {
      // 3rd place: finish ~2-3% behind 2nd and ~4-6% behind winner
      maxDistanceFactor = randomRange(0.945, 0.955);
    }
    const maxDistance = tunnelLength * maxDistanceFactor;
    return {
      ...p,
      index: i + 1,
      isWinner,
      chaseRank,
      color: COLORS[i % COLORS.length],
      x: spawn.x,
      y: spawn.y,
      spawnX: spawn.x,
      spawnY: spawn.y,
      targetX: entryPoint.x,
      targetY: entryPoint.y,
      goldTargetX: goldTarget.x,
      goldTargetY: goldTarget.y,
      progress: 0,
      arrived: false,
      tunnelLength,
      dugDistance: 0,
      maxDistance,
      digBaseSpeed,
      speedOscillation: randomRange(0.55, 1.35),
      element: robberEl,
      progressElement: null,
      progressLabel: null,
      tunnelElement: polyline,
      tunnelPoints: orthPoints,
    };
  });

  state.robbers.forEach((r) => placeRobber(r));
  renderScore();
}

function finalizeRound(winner) {
  const room = getSelectedRoom();
  if (!room) return;
  const prize = room.prizeFund;
  state.user.reserved = Math.max(0, state.user.reserved - room.entryFee);
  
  if (winner.id === "user") {
    // Show victory animation overlay before actually giving balance
    const overlay = document.createElement("div");
    overlay.className = "fullscreen-win";
    overlay.innerHTML = `
      <div class="win-title">Поздравляем с победой!</div>
      <div class="win-prize">Ваш выигрыш составил ${prize} б.</div>
      <div class="win-balance-container">
        Баланс: <span class="win-balance-amount">${state.user.balance}</span> б.
      </div>
    `;
    document.body.appendChild(overlay);

    // After pop-up animation, count up the balance
    setTimeout(() => {
      const elBalance = overlay.querySelector(".win-balance-amount");
      let currentVal = state.user.balance;
      const targetVal = state.user.balance + prize;
      const duration = 1500; // 1.5s count up
      const startTime = Date.now();

      const countUp = setInterval(() => {
        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / duration);
        const easeOutQuad = 1 - (1 - progress) * (1 - progress);
        currentVal = state.user.balance + Math.floor(prize * easeOutQuad);
        elBalance.textContent = currentVal;

        if (progress >= 1) {
          clearInterval(countUp);
          elBalance.textContent = targetVal;
          creditBalance(prize).catch(() => undefined);
          
          setTimeout(() => {
            overlay.classList.add("fade-out");
            setTimeout(() => {
              overlay.remove();
              // Execute the rest of finalize logic
              finishFinalizeRound(room, winner);
            }, 600);
          }, 2000);
        }
      }, 30);
    }, 1200);
  } else {
    // If bot won, finalize immediately
    finishFinalizeRound(room, winner);
  }
}

function finishFinalizeRound(room, winner) {
  room.status = "finished";
  const record = {
    ts: new Date().toLocaleString("ru-RU"),
    roomId: room.id,
    winner: winner.name,
    isBot: winner.isBot,
    boostUsed: state.boostBought,
    entryFee: room.entryFee,
    prizeFund: room.prizeFund,
  };
  state.user.gamesPlayed++;
  if (winner.id === "user") {
    state.user.gamesWon++;
    state.user.totalWon += room.prizeFund;
  }
  
  state.history.unshift(record);
  state.history = state.history.slice(0, 12);
  renderHistory();
  renderUser();
  renderRooms();
  state.inRoom = false;
  state.boostBought = false;
  state.playedCurrentRoom = true;
  el.backToListBtn.disabled = false;
  if (el.openProfileBtn) el.openProfileBtn.disabled = false;
  renderRoomSummary();

  // Start 30s restart timer
  state.restartSecLeft = 30;
  updateStatus(`Следующий раунд начнется через ${state.restartSecLeft} сек.`, "status");
  
  state.restartIntervalId = window.setInterval(() => {
    state.restartSecLeft -= 1;
    if (state.restartSecLeft <= 0) {
      window.clearInterval(state.restartIntervalId);
      state.restartIntervalId = null;
      
      // Auto-restart game logic
      room.status = "open";
      room.occupied = 0;
      
      const door = document.getElementById("arenaDoor");
      if (door) door.classList.remove("opening");
      clearArena();
      
      joinRoom(); // re-join automatically
    } else {
      updateStatus(`Следующий раунд начнется через ${state.restartSecLeft} сек.`);
    }
  }, 1000);
}

function renderHistory() {
  if (state.history.length === 0) {
    el.historyList.textContent = "Раундов пока нет";
    return;
  }
  el.historyList.innerHTML = "";
  state.history.forEach((r) => {
    const row = document.createElement("div");
    row.className = "history-item";
    
    const isUser = !r.isBot && r.winner === state.user.name;
    const winnerClass = isUser ? "history-winner is-user" : "history-winner";
    
    row.innerHTML = `
      <div class="history-item-left">
        <div class="history-time">${r.ts} • ${r.roomId}</div>
        <div class="history-details">
          <div class="${winnerClass}">
            ${r.winner}
            ${r.isBot ? '<span class="history-badge badge-bot">БОТ</span>' : ''}
          </div>
          ${r.boostUsed ? '<span class="history-badge badge-boost">С БУСТОМ</span>' : ''}
        </div>
      </div>
      <div class="history-prize">
        <div class="history-prize-amount">+${r.prizeFund} б.</div>
        <div class="history-prize-label">Приз</div>
      </div>
    `;
    el.historyList.appendChild(row);
  });
}

function runRound(backendResult) {
  const startMs = Date.now();
  const approachEndMs = startMs + APPROACH_DURATION_MS;
  state.roundRunning = true;
  el.backToListBtn.disabled = true;
  
  const door = document.getElementById("arenaDoor");
  if (door) {
    door.classList.add("opening");
  }
  
  el.safeStatus.textContent = "Сейф закрыт";
  el.safeStatus.className = "safe-status";
  document.querySelector(".safe").classList.remove("open", "hacking");
  el.roundStatus.textContent = "Грабители одновременно подходят к границе сейфа (5 сек).";

  state.roundIntervalId = window.setInterval(() => {
    const now = Date.now();
    const phaseApproach = now < approachEndMs;
    let winnerReached = null;

    if (phaseApproach) {
      el.roundStatus.textContent = "Грабители одновременно подходят к границе сейфа (5 сек).";
    } else {
      document.querySelector(".safe").classList.add("hacking");
      state.robbers.forEach(r => r.element.classList.add("hacking"));
      if (el.roundStatus.textContent !== "Взлом в процессе...") {
        el.roundStatus.textContent = "Взлом в процессе...";
      }
    }

    for (const robber of state.robbers) {
      if (phaseApproach) {
        const t = Math.min(1, (now - startMs) / APPROACH_DURATION_MS);
        robber.x = robber.spawnX + (robber.targetX - robber.spawnX) * t;
        robber.y = robber.spawnY + (robber.targetY - robber.spawnY) * t;
        placeRobber(robber);
        continue;
      }

      if (!robber.arrived) {
        robber.arrived = true;
        robber.x = robber.targetX;
        robber.y = robber.targetY;
        placeRobber(robber);
      }

      const timeSec = (now - approachEndMs) / 1000;
      const baseDynamic = 1 + Math.sin((timeSec + robber.index) * robber.speedOscillation) * 0.34 + randomRange(-0.1, 0.12);
      const progressRatio = robber.tunnelLength > 0 ? robber.dugDistance / robber.tunnelLength : 0;
      let raceBias = 1;

      if (robber.isWinner) {
        // Winner stays around 2-4 place early, then accelerates after midpoint.
        if (progressRatio < 0.45) {
          raceBias = 0.82 + randomRange(0, 0.06);
        } else if (progressRatio < 0.6) {
          raceBias = 0.98 + randomRange(-0.04, 0.04);
        } else {
          raceBias = 1.24 + randomRange(0, 0.08);
        }
      } else if (progressRatio > 0.55) {
        raceBias = 0.94 + randomRange(-0.03, 0.02);
      }

      const dynamic = baseDynamic * raceBias;
      robber.dugDistance += robber.digBaseSpeed * dynamic;
      robber.dugDistance = Math.max(0, Math.min(robber.maxDistance, robber.dugDistance));
      robber.progress = Math.min(100, (robber.dugDistance / robber.tunnelLength) * 100);
      robber.progressElement.style.width = `${robber.progress}%`;
      robber.progressLabel.textContent = `${Math.floor(robber.progress)}%`;
      if (robber.tunnelPoints) {
        const tunnelPosition = getPointAtProgress(robber.tunnelPoints, robber.progress);
        robber.x = tunnelPosition.x;
        robber.y = tunnelPosition.y;
        placeRobber(robber);
      }
      if (robber.tunnelElement) {
        const fullLength = Number(robber.tunnelElement.dataset.totalLength || "0");
        robber.tunnelElement.style.strokeDashoffset = `${Math.max(0, fullLength * (1 - robber.progress / 100))}`;
      }

      if (robber.id === state.winnerId && robber.dugDistance >= robber.tunnelLength) {
        robber.progress = 100;
        robber.progressElement.style.width = "100%";
        robber.progressLabel.textContent = "100%";
        winnerReached = robber;
        break;
      }
    }

    if (winnerReached) {
      winnerReached.element.classList.add("winner");
      el.safeStatus.textContent = "Сейф открыт";
      el.safeStatus.className = "safe-status success";
      document.querySelector(".safe").classList.remove("hacking");
      state.robbers.forEach(r => r.element.classList.remove("hacking"));
      document.querySelector(".safe").classList.add("open");
      el.roundStatus.innerHTML = `Победитель: <strong>${winnerReached.name}</strong>${winnerReached.isBot ? " (бот)" : ""}.`;
      window.clearInterval(state.roundIntervalId);
      state.roundRunning = false;
      finalizeRound(winnerReached);
    }
  }, 80);
}

function renderBackendLog(payload) {
  const lines = [];
  lines.push(`roomId: ${payload.roomId}`);
  lines.push(`totalWeight: ${payload.totalWeight.toFixed(3)}`);
  lines.push("weights:");
  payload.weighted.forEach((p) => {
    lines.push(`- ${p.name}: base=${p.weight.toFixed(2)}, final=${p.finalWeight.toFixed(3)}${p.boost ? " (boost)" : ""}`);
  });
  lines.push(`winnerId: ${payload.winnerId}`);
  if (el.backendLog) {
    el.backendLog.textContent = lines.join("\n");
  } else {
    console.log("Backend Log:\n" + lines.join("\n"));
  }
}

function startWaiting() {
  const room = getSelectedRoom();
  if (!room || !state.inRoom) return;
  state.waitingSecLeft = WAIT_DURATION_SEC;
  updateStatus(`Ожидание игроков: ${state.waitingSecLeft} сек.`, "status");
  el.startWaitingBtn.disabled = true;

  window.clearInterval(state.waitingIntervalId);
  state.waitingIntervalId = window.setInterval(() => {
    state.waitingSecLeft -= 1;
    if (state.waitingSecLeft <= 0) {
      window.clearInterval(state.waitingIntervalId);
      state.waitingIntervalId = null;
      const participants = buildParticipants(room);
      renderParticipants(participants);
      updateStatus("Таймер завершен. Свободные места заполнены ботами. Запуск раунда...");
      const backendResult = backendPickWinner(participants, room);
      renderBackendLog(backendResult);
      prepareRound(participants, backendResult);
      runRound(backendResult);
      return;
    }
    updateStatus(`Ожидание игроков: ${state.waitingSecLeft} сек.`);
  }, 1000);
}

function quickReplay() {
  if (state.restartIntervalId) {
    window.clearInterval(state.restartIntervalId);
    state.restartIntervalId = null;
  }
  const room = getSelectedRoom();
  if (room && room.status === "open" && !state.inRoom && state.playedCurrentRoom) {
    joinRoom();
    return;
  }
  const latest = state.history[0];
  if (!latest) return;
  const r = state.rooms.find((r) => r.id === latest.roomId && r.status === "open");
  if (r) {
    selectRoom(r.id);
    updateStatus(`Подобрана похожая комната: ${r.id}`);
    return;
  }
  generateRooms();
  renderRooms();
  autoMatch();
}

function validateConfig(candidate) {
  const warnings = [];
  if (candidate.seats < 2 || candidate.seats > 10) warnings.push("Количество мест должно быть от 2 до 10.");
  if (candidate.entryFee < 20) warnings.push("Слишком низкая цена входа. Экономика может быть неустойчивой.");
  if (candidate.prizePercent > 95) warnings.push("Процент фонда слишком высокий для организатора.");
  if (candidate.prizePercent < 60) warnings.push("Процент фонда слишком низкий, комната непривлекательна.");
  if (candidate.boostEnabled && candidate.boostPrice > candidate.entryFee * 2) warnings.push("Буст слишком дорогой.");
  if (candidate.boostEnabled && candidate.boostPrice < 10) warnings.push("Буст слишком дешевый, влияние на экономику невалидно.");
  return warnings;
}

function saveConfig() {
  const candidate = {
    seats: Number.parseInt(el.cfgSeats.value, 10) || 6,
    entryFee: Number.parseInt(el.cfgEntryFee.value, 10) || 100,
    prizePercent: Number.parseInt(el.cfgPrizePercent.value, 10) || 85,
    boostEnabled: el.cfgBoostEnabled.value === "yes",
    boostPrice: Number.parseInt(el.cfgBoostPrice.value, 10) || 60,
  };
  const warnings = validateConfig(candidate);
  if (warnings.length > 0) {
    el.cfgWarning.className = "status danger";
    el.cfgWarning.textContent = `Конфигурация не сохранена: ${warnings.join(" ")}`;
    return;
  }

  state.config = candidate;
  generateRooms();
  state.selectedRoomId = null;
  state.inRoom = false;
  state.boostBought = false;
  const door = document.getElementById("arenaDoor");
  if (door) {
    door.classList.remove("opening");
  }
  renderRooms();
  renderRoomSummary();
  el.cfgWarning.className = "status success";
  el.cfgWarning.textContent = "Конфигурация сохранена. Список комнат обновлен.";
  updateAdminAnalysis();
}

function updateAdminAnalysis() {
  const seats = Number.parseInt(el.cfgSeats.value, 10) || 6;
  const entryFee = Number.parseInt(el.cfgEntryFee.value, 10) || 100;
  const prizePercent = Number.parseInt(el.cfgPrizePercent.value, 10) || 85;
  const boostEnabled = el.cfgBoostEnabled.value === "yes";
  const boostPrice = Number.parseInt(el.cfgBoostPrice.value, 10) || 60;
  
  if (!el.adminAnalysisReport) return;
  
  const totalPool = entryFee * seats;
  const prizeFund = Math.floor(totalPool * (prizePercent / 100));
  const organizerProfit = totalPool - prizeFund;
  
  let html = `<p><strong>Общий пул (доход):</strong> ${totalPool} б.</p>`;
  html += `<p><strong>Призовой фонд (выплата):</strong> ${prizeFund} б.</p>`;
  html += `<p><strong>Базовая прибыль:</strong> ${organizerProfit} б.</p>`;
  
  const warnings = [];
  const pros = [];
  
  if (prizePercent < 60) {
    warnings.push("⚠️ Призовой фонд слишком мал. Игроки сочтут комнату непривлекательной.");
  } else if (prizePercent > 95) {
    warnings.push("⚠️ Призовой фонд слишком велик. Вы почти ничего не заработаете с базовых игр.");
  } else {
    pros.push("✅ Призовой фонд сбалансирован.");
  }
  
  if (boostEnabled) {
    const boostImpact = boostPrice / entryFee;
    if (boostImpact > 2.0) {
      warnings.push("⚠️ Буст стоит слишком дорого по сравнению со входом, его редко будут покупать.");
    } else if (boostImpact < 0.4) {
      warnings.push("⚠️ Буст слишком дешёвый. Массовая покупка нарушит баланс и отпугнет обычных игроков.");
    } else {
      pros.push("✅ Цена буста находится в разумных пределах.");
    }
  }
  
  if (warnings.length > 0) {
    html += `<div style="color: var(--danger); margin-top: 0.8rem;">${warnings.join("<br>")}</div>`;
  }
  if (pros.length > 0) {
    html += `<div style="color: var(--success); margin-top: 0.8rem;">${pros.join("<br>")}</div>`;
  }
  
  el.adminAnalysisReport.innerHTML = html;
}

function setupPageNavigation() {
  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.getAttribute("data-page");
      document.querySelectorAll("[data-page]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      document.getElementById(`page-${page}`)?.classList.add("active");
    });
  });
}

function openProfile() {
  if (state.inRoom || state.roundRunning) return;
  el.viewSelection.style.display = "none";
  el.viewRoom.style.display = "none";
  if (el.viewProfile) el.viewProfile.style.display = "block";
}

function backFromProfile() {
  if (el.viewProfile) el.viewProfile.style.display = "none";
  if (state.selectedRoomId && !state.inRoom) {
    // Return to lobby list if they were just browsing rooms
    el.viewSelection.style.display = "block";
    state.selectedRoomId = null;
    renderRooms();
  } else {
    el.viewSelection.style.display = "block";
  }
}

function updateInstructionSlide(fromIdx) {
  const n = BANK_INSTRUCTION.slides.length;
  const to = instructionSlideIndex;
  const from = fromIdx !== undefined ? fromIdx : instructionSlidePrevIndex;
  if (el.instructionModalDots) {
    el.instructionModalDots.querySelectorAll("button").forEach((b, i) => {
      b.classList.toggle("active", i === to);
    });
  }
  if (!el.instructionModalTrack || from === to) {
    instructionSlidePrevIndex = to;
    return;
  }
  const one = isInstructionOneStep(from, to, n);
  if (!one) el.instructionModalTrack.classList.add("is-instant");
  else el.instructionModalTrack.classList.remove("is-instant");
  el.instructionModalTrack.style.transform = `translate3d(-${(to / n) * 100}%, 0, 0)`;
  if (!one) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.instructionModalTrack.classList.remove("is-instant");
      });
    });
  }
  instructionSlidePrevIndex = to;
}

function openInstructionModal() {
  if (!el.instructionModal || !el.instructionModalTitle) return;
  instructionSlideIndex = 0;
  instructionSlidePrevIndex = 0;
  el.instructionModalTitle.textContent = BANK_INSTRUCTION.title;
  if (el.instructionModalSteps) {
    el.instructionModalSteps.innerHTML = BANK_INSTRUCTION.steps.map((t) => `<li>${t}</li>`).join("");
  }
  if (el.instructionModalNote) el.instructionModalNote.textContent = BANK_INSTRUCTION.note;
  if (el.instructionModalDots) {
    el.instructionModalDots.innerHTML = BANK_INSTRUCTION.slides
      .map(
        (_, i) =>
          `<button type="button" class="instruction-modal-dot${i === 0 ? " active" : ""}" data-slide="${i}" aria-label="Шаг ${i + 1}"></button>`
      )
      .join("");
  }
  const n = BANK_INSTRUCTION.slides.length;
  if (el.instructionModalTrack) {
    el.instructionModalTrack.innerHTML = BANK_INSTRUCTION.slides
      .map(
        (s) =>
          `<div class="instruction-modal-slide-page"><img src="${s.src}" alt="" loading="lazy"/><p class="instruction-modal-caption">${escapeInstructionHtml(s.caption)}</p></div>`
      )
      .join("");
    el.instructionModalTrack.style.setProperty("--instruction-slide-count", String(n));
    el.instructionModalTrack.classList.add("is-instant");
    el.instructionModalTrack.style.transform = "translate3d(0,0,0)";
    void el.instructionModalTrack.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.instructionModalTrack.classList.remove("is-instant");
      });
    });
  }
  el.instructionModal.classList.add("is-open");
  el.instructionModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeInstructionModal() {
  if (!el.instructionModal) return;
  el.instructionModal.classList.remove("is-open");
  el.instructionModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindInstructionModal() {
  const openers = [el.openInstructionBtn, el.openInstructionBtnRoom].filter(Boolean);
  openers.forEach((btn) => btn.addEventListener("click", openInstructionModal));
  el.instructionModalClose?.addEventListener("click", closeInstructionModal);
  el.instructionModalBackdrop?.addEventListener("click", closeInstructionModal);
  el.instructionModalPrev?.addEventListener("click", () => {
    const len = BANK_INSTRUCTION.slides.length;
    const from = instructionSlideIndex;
    instructionSlideIndex = (from - 1 + len) % len;
    updateInstructionSlide(from);
  });
  el.instructionModalNext?.addEventListener("click", () => {
    const len = BANK_INSTRUCTION.slides.length;
    const from = instructionSlideIndex;
    instructionSlideIndex = (from + 1) % len;
    updateInstructionSlide(from);
  });
  el.instructionModalDots?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-slide]");
    if (!btn) return;
    const from = instructionSlideIndex;
    instructionSlideIndex = Number(btn.dataset.slide);
    updateInstructionSlide(from);
  });
  window.addEventListener("keydown", (e) => {
    if (!el.instructionModal?.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      closeInstructionModal();
      return;
    }
    const len = BANK_INSTRUCTION.slides.length;
    if (e.key === "ArrowLeft") {
      const from = instructionSlideIndex;
      instructionSlideIndex = (from - 1 + len) % len;
      updateInstructionSlide(from);
    }
    if (e.key === "ArrowRight") {
      const from = instructionSlideIndex;
      instructionSlideIndex = (from + 1) % len;
      updateInstructionSlide(from);
    }
  });
}

function bindEvents() {
  el.autoMatchBtn.addEventListener("click", autoMatch);
  el.joinRoomBtn.addEventListener("click", joinRoom);
  el.buyBoostBtn.addEventListener("click", buyBoost);
  el.startWaitingBtn.addEventListener("click", startWaiting);
  el.quickReplayBtn.addEventListener("click", quickReplay);
  el.saveConfigBtn.addEventListener("click", saveConfig);
  el.backToListBtn.addEventListener("click", backToList);
  
  if (el.openProfileBtn) el.openProfileBtn.addEventListener("click", openProfile);
  if (el.backFromProfileBtn) el.backFromProfileBtn.addEventListener("click", backFromProfile);
  if (el.openEditProfileBtn) el.openEditProfileBtn.addEventListener("click", openEditProfile);
  if (el.cancelEditProfileBtn) el.cancelEditProfileBtn.addEventListener("click", closeEditProfile);
  if (el.saveProfileBtn) el.saveProfileBtn.addEventListener("click", saveEditProfile);

  if (el.backFromAdminBtn) {
    el.backFromAdminBtn.addEventListener("click", () => {
      try {
        const homePath = new URL(".", window.location.href).pathname;
        window.history.pushState({}, "", homePath);
      } catch {
        window.history.pushState({}, "", "/bank/");
      }
      if (el.viewAdmin) el.viewAdmin.style.display = "none";
      el.viewSelection.style.display = "block";
    });
  }

  if (el.openBankAdminBtn) {
    el.openBankAdminBtn.addEventListener("click", () => {
      if (state.inRoom || state.roundRunning) return;
      showBankAdminView();
    });
  }
  if (el.openServerAdminBtn) {
    el.openServerAdminBtn.addEventListener("click", () => openServerAdminFromIframe());
  }

  const cfgInputs = [el.cfgSeats, el.cfgEntryFee, el.cfgPrizePercent, el.cfgBoostEnabled, el.cfgBoostPrice];
  cfgInputs.forEach(input => {
    if (input) {
      input.addEventListener("input", updateAdminAnalysis);
      input.addEventListener("change", updateAdminAnalysis);
    }
  });

  el.buyBoostBtn.addEventListener("mouseenter", () => {
    const room = getSelectedRoom();
    if (!room || !room.boostEnabled || state.boostBought || el.buyBoostBtn.disabled) return;
    const oldC = getEstimatedChance(room, false);
    const newC = getEstimatedChance(room, true);
    updateStatus(`Улучшить шанс: ${oldC}% → ${newC}% (Стоимость: ${room.boostPrice} б.)`);
  });

  el.buyBoostBtn.addEventListener("mouseleave", () => {
    if (state.inRoom && !state.roundRunning && !state.boostBought) {
      updateStatus("Баллы зарезервированы. Можно купить буст и запустить таймер.");
    }
  });

  bindInstructionModal();
}

function init() {
  setupPageNavigation();
  bindEvents();
  generateRooms();
  renderUser();
  renderRooms();
  renderRoomSummary();
  renderHistory();
  refreshWallet().catch(() => undefined);
  
  if (window.location.pathname.includes('/admin')) {
    el.viewSelection.style.display = "none";
    el.viewRoom.style.display = "none";
    if (el.viewProfile) el.viewProfile.style.display = "none";
    if (el.viewAdmin) {
      el.viewAdmin.style.display = "block";
      updateAdminAnalysis();
    }
  }
}

init();
