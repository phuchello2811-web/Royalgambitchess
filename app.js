// Giao diện: vẽ bàn cờ, kéo thả quân, hiệu ứng, đăng nhập, rank, Elo và bảng xếp hạng.

// Kiểm tra các file đã được cập nhật đủ chưa (tránh lỗi âm thầm khi trộn file cũ và mới)
if (typeof Profile === 'undefined' || !Profile.BOT_ELO || typeof Online === 'undefined' || !Online.oppElo || !document.getElementById('placeModal') ||
    !Profile.isAdmin || !document.getElementById('adminModal') || !document.getElementById('adminNote') ||
    !Online.findMatch || typeof Contest === 'undefined' || !Profile.dbCall || !document.getElementById('contestModal') ||
    !Contest.medals || !Online.startedAt || typeof Learn === 'undefined' || !Learn.enter || !document.getElementById('contestBanner') ||
    !document.getElementById('learnHome')) {
  throw new Error('Thiếu file mới: hãy thay đủ index.html, app.js, profile.js, online.js, contest.js, lessons.js, learn.js, sound.js, style.css rồi bấm Ctrl+F5');
}

const MIN_RANKED_PLIES = 4; // ván ngắn hơn 4 nước (tính cả hai bên) không tính rank/Elo
const BOT_ELO = Profile.BOT_ELO; // Elo của máy theo độ khó
const COLOR_NAME = { w: 'Trắng', b: 'Đen' };
const LEVEL_NAME = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó' };
const REASONS = {
  checkmate: 'Chiếu hết',
  stalemate: 'Hết nước đi (pat)',
  fifty: 'Luật 50 nước',
  repetition: 'Lặp lại thế cờ 3 lần',
  insufficient: 'Không đủ quân để chiếu hết',
};
const THEMES = [
  ['green', 'Xanh lá', '#ebecd0', '#739552'],
  ['brown', 'Gỗ', '#f0d9b5', '#b58863'],
  ['blue', 'Xanh dương', '#dee3e6', '#8ca2ad'],
  ['purple', 'Tím', '#efe6f7', '#9479b8'],
  ['night', 'Đêm', '#9fa8b5', '#4f5b6c'],
  ['marble', 'Cẩm thạch', '#e8e6e1', '#7a7a7a'],
  ['red', 'Đỏ', '#f5d6d0', '#b3544a'],
  ['emerald', 'Ngọc lục', '#d4f0e0', '#2e7d5b'],
  ['wood', 'Gỗ tối', '#e8c9a0', '#8b5a2b'],
  ['gradient', 'Gradient', 'linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#f093fb,#f5576c)'],
  ['sunset', 'Hoàng hôn', 'linear-gradient(160deg,#ff9a3c,#e85d04)', 'linear-gradient(160deg,#7209b7,#240046)'],
  ['ocean', 'Đại dương', 'linear-gradient(145deg,#00f5d4,#00bbf9)', 'linear-gradient(145deg,#0096c7,#023e8a)'],
];

const PIECE_SKINS = [
  ['default', 'Mặc định'],
  ['gold', 'Vàng'],
  ['neon', 'Neon'],
  ['mono', 'Đen trắng'],
  ['ice', 'Băng'],
  ['fire', 'Lửa'],
  ['soft', 'Mềm'],
];

const game = new Chess();
const $ = id => document.getElementById(id);
const boardEl = $('board');

let selected = -1;      // ô đang chọn
let selectedMoves = []; // các nước hợp lệ của quân đang chọn
let flipped = false;
let aiColor = $('mode').value; // 'w' | 'b' | 'none'
let gameLevel = Number($('level').value);
let thinking = false;
let gameId = 0;         // để bỏ qua kết quả AI của ván cũ
let mode = 'play';      // 'play' (máy / 2 người) | 'online' | 'learn'
let hint = null;        // {from, to}: nước gợi ý đang tô sáng
let marks = new Set();  // ô được đánh dấu bằng chuột phải
let playResult = null;  // xin thua ở chế độ Chơi: { winner, reason, score }
let ratedDone = false;  // ván hiện tại đã xử lý kết quả chưa
let quietResult = false;
let assisted = false;   // ván với máy có dùng Gợi ý / Đi lại thì không tính Elo
let seenMove = null, seenLen = 0; // để nhận ra nước mới cần hiệu ứng
let skipAnim = false;   // nước vừa đi bằng kéo thả thì không cần trượt
let viewPly = null;     // null = đang ở thế cờ live; số = đang xem lại sau N nước
let drag = null;
const contestById = new Map(); // tra contest theo id (kể cả khi đang chơi ván contest)
// Tự ghép cặp contest (xem phần "Contest: tự ghép cặp" ở cuối file)
const AUTO_NEXT = 8000; // ván contest xong bao lâu thì tự tìm ván tiếp
const Auto = {
  mine: [],          // contest sắp / đang diễn ra mà mình đã đăng ký
  paused: new Set(), // contest người chơi đã tạm dừng tự ghép
  running: null,     // contest đang tự ghép / đang đấu
  doneAt: 0,         // lúc ván contest vừa xong
  retryAt: 0,        // tìm lỗi (mạng...) thì chờ tới lúc này mới thử lại
};

const pieceSrc = p => `pieces/${p}.svg`;
const disp = i => flipped ? 63 - i : i; // vị trí hiển thị của ô i
const rowCol = i => [disp(i) >> 3, disp(i) & 7];

// ---------------- Vẽ bàn cờ ----------------

function boardAt(ply) {
  const g = new Chess();
  const n = Math.max(0, Math.min(ply, game.history.length));
  for (let i = 0; i < n; i++) {
    const m = game.history[i].move;
    if (!m) break;
    if (!g.move({ from: m.from, to: m.to, promotion: m.promotion || undefined })) break;
  }
  return g;
}

function isLiveView() {
  return viewPly == null || viewPly >= game.history.length;
}

function setViewPly(ply) {
  if (ply == null || ply >= game.history.length) viewPly = null;
  else viewPly = Math.max(0, ply);
  render();
}

function render() {
  const h = game.history;
  // Nước mới (mình hoặc đối thủ) → về live
  const latest = h.length ? h[h.length - 1].move : null;
  const isNew = latest && latest !== seenMove && h.length === seenLen + 1;
  if (isNew) {
    viewPly = null;
    seenMove = latest;
    seenLen = h.length;
  } else if (isLiveView()) {
    seenMove = latest;
    seenLen = h.length;
  }

  const live = isLiveView();
  const vg = live ? game : boardAt(viewPly);
  const last = live
    ? latest
    : (viewPly > 0 && h[viewPly - 1] ? h[viewPly - 1].move : null);

  const checkSq = vg.inCheck() ? vg.kingSquare(vg.turn) : -1;
  const targets = live ? new Map(selectedMoves.map(m => [m.to, m])) : new Map();
  const deco = mode === 'learn' ? Learn.deco() : null; // { stars, ok, bad, focus }: tô ô cho bài học
  const stars = deco ? deco.stars : new Set();

  boardEl.innerHTML = '';
  for (let k = 0; k < 64; k++) {
    const i = flipped ? 63 - k : k;
    const r = i >> 3, c = i & 7;
    const sq = document.createElement('div');
    sq.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
    if (live && i === selected) sq.classList.add('selected');
    if (last && (i === last.from || i === last.to)) sq.classList.add('last');
    if (i === checkSq) sq.classList.add('check');
    if (live && marks.has(i)) sq.classList.add('marked');
    if (targets.has(i)) sq.classList.add(targets.get(i).captured ? 'capture' : 'target');
    if (live && hint && (i === hint.from || i === hint.to)) sq.classList.add('hint');
    if (deco) {
      if (deco.focus.has(i)) sq.classList.add('focus');
      if (deco.ok.has(i)) sq.classList.add('tap-ok');
      if (deco.bad.has(i)) sq.classList.add('tap-bad');
    }

    const p = vg.board[i];
    if (p) {
      const img = document.createElement('img');
      img.className = 'piece';
      img.src = pieceSrc(p);
      img.alt = '';
      img.draggable = false;
      if (drag && drag.moved && drag.from === i) img.classList.add('dragging');
      sq.appendChild(img);
    }
    if (stars.has(i)) sq.insertAdjacentHTML('beforeend', '<span class="star">★</span>');
    if ((k & 7) === 0) sq.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - r}</span>`);
    if (k >= 56) sq.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[c]}</span>`);
    boardEl.appendChild(sq);
  }

  if (isNew) {
    if (!skipAnim) animate(last);
    const over = game.isGameOver();
    Sound.play(over ? 'end' : game.inCheck() ? 'check' : last.captured ? 'capture' : 'move');
  }
  skipAnim = false;

  renderStatus();
  renderMoves();
  renderPlayers();
  checkResult();
}

// Trượt quân từ ô cũ sang ô mới (và Xe khi nhập thành)
function animate(m) {
  const slide = (from, to) => {
    const img = boardEl.children[disp(to)].querySelector('.piece');
    if (!img) return;
    const [fr, fc] = rowCol(from), [tr, tc] = rowCol(to);
    img.classList.add('moving');
    img.style.transition = 'none';
    img.style.transform = `translate(${(fc - tc) * 100}%, ${(fr - tr) * 100}%)`;
    img.getBoundingClientRect(); // ép trình duyệt áp vị trí đầu
    img.style.transition = '';
    img.style.transform = '';
    img.addEventListener('transitionend', () => img.classList.remove('moving'), { once: true });
  };
  slide(m.from, m.to);
  if (m.flag === 'castleK') slide(m.to + 1, m.to - 1);
  if (m.flag === 'castleQ') slide(m.to - 2, m.to + 1);
}

function renderStatus() {
  const el = $('status');
  el.className = 'status';
  const custom = mode === 'learn' ? Learn.status() : mode === 'online' ? Online.status() : null;
  if (custom) {
    el.textContent = custom.text;
    if (custom.cls) el.classList.add(custom.cls);
    return;
  }
  const s = game.status();
  if (playResult) {
    el.textContent = `${playResult.reason} – ${COLOR_NAME[playResult.winner]} thắng`;
    el.classList.add('over');
  } else if (s === 'checkmate') {
    el.textContent = `Chiếu hết! ${COLOR_NAME[opposite(game.turn)]} thắng`;
    el.classList.add('over');
  } else if (s !== 'playing') {
    el.textContent = 'Hòa – ' + REASONS[s].toLowerCase();
    el.classList.add('over');
  } else if (thinking) {
    el.textContent = 'Máy đang suy nghĩ…';
    el.classList.add('thinking');
  } else {
    el.textContent = `Lượt ${COLOR_NAME[game.turn]} đi` + (game.inCheck() ? ' – đang bị chiếu!' : '');
    if (game.inCheck()) el.classList.add('in-check');
  }
}

function renderMoves() {
  const box = $('moves');
  box.innerHTML = '';
  const h = game.history;
  const live = isLiveView();
  const focus = live ? h.length : viewPly;
  if (!h.length) box.innerHTML = '<p class="empty">Chưa có nước đi nào</p>';
  for (let i = 0; i < h.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    row.innerHTML = `<span class="num">${i / 2 + 1}.</span><span class="mv"></span><span class="mv"></span>`;
    const addMv = (el, ply) => {
      if (ply >= h.length) return;
      el.textContent = h[ply].san;
      el.dataset.ply = String(ply + 1); // xem sau nước ply+1
      if (focus === ply + 1) el.classList.add('viewing');
      if (live && ply >= h.length - 2) el.classList.add('current');
      el.addEventListener('click', () => setViewPly(ply + 1));
    };
    addMv(row.children[1], i);
    if (h[i + 1]) addMv(row.children[2], i + 1);
    box.appendChild(row);
  }
  if (live) box.scrollTop = box.scrollHeight;
  const vh = $('viewHint');
  if (vh) vh.hidden = live || !h.length;
  // nút điều hướng
  const atStart = !h.length || (viewPly != null && viewPly <= 0);
  const atEnd = live;
  const setDis = (id, on) => { const b = $(id); if (b) b.disabled = on; };
  setDis('navStart', !h.length || (viewPly != null && viewPly <= 0));
  setDis('navPrev', !h.length || (viewPly != null && viewPly <= 0));
  setDis('navNext', atEnd);
  setDis('navEnd', atEnd);
  setDis('navLive', atEnd);
}

// Thông tin người chơi ở mỗi bên bàn cờ
function playerInfo(c) {
  if (mode === 'online') return Online.player(c);
  if (mode === 'play' && aiColor !== 'none') {
    if (c === aiColor) return { name: 'Máy · ' + LEVEL_NAME[gameLevel], rank: null, elo: BOT_ELO[gameLevel], bot: true };
    const me = Profile.me();
    return { name: me.name, rank: Profile.rankOf(me.exp), elo: me.elo, photo: me.photo, me: true };
  }
  return { name: 'Người chơi ' + COLOR_NAME[c], rank: null, pieceAv: true };
}

function avatarColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 42%)`;
}

function setAvatar(el, info, c) {
  el.innerHTML = '';
  el.className = el.className.replace(/ ?(bot|piece-av|photo)/g, '');
  el.style.background = '';
  if (info.photo) {
    // Có ảnh đại diện đã tải lên
    el.classList.add('photo');
    const img = document.createElement('img');
    img.src = info.photo;
    img.alt = '';
    el.appendChild(img);
  } else if (info.bot) {
    // Máy: hiện quân Mã
    el.classList.add('bot');
    const img = document.createElement('img');
    img.src = pieceSrc((c || 'w') + 'N');
    img.alt = '';
    el.appendChild(img);
  } else if (info.pieceAv || (info.rank == null && !info.me && !info.elo && /^Người chơi/.test(info.name || ''))) {
    // 2 người cùng máy / chờ online: quân Vua trắng / đen theo màu bên
    el.classList.add('piece-av');
    const img = document.createElement('img');
    img.src = pieceSrc((c || 'w') + 'K');
    img.alt = '';
    el.appendChild(img);
  } else {
    // Tài khoản thật không có avatar → chữ cái đầu tên
    const name = (info.name || '').trim();
    el.textContent = (name[0] || '?').toUpperCase();
    el.style.background = avatarColor(name || '?');
  }
}

function renderPlayers() {
  const capturedBy = { w: [], b: [] };
  for (const { move } of game.history) {
    if (move.captured) capturedBy[move.piece[0]].push(move.captured);
  }
  const order = 'QRBNP';
  const value = { Q: 9, R: 5, B: 3, N: 3, P: 1 };
  const material = { w: 0, b: 0 };
  for (const c of ['w', 'b']) {
    capturedBy[c].sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]));
    material[c] = capturedBy[c].reduce((s, p) => s + value[p[1]], 0);
  }
  const fill = (pos, c) => {
    const info = playerInfo(c);
    $(pos + 'Name').textContent = info.name;
    const parts = [];
    const ratingEl = $(pos + 'Rating');
    if (info.rank) {
      ratingEl.innerHTML = `<span class="player-rank">${rankMedalOnly(info.rank)}<span style="color:${info.rank.color}">${info.rank.text}</span></span>`
        + (info.elo != null ? ` · ${info.elo} Elo` : '');
    } else {
      ratingEl.textContent = info.elo != null ? `(${info.elo} Elo)` : '';
      ratingEl.style.color = '';
    }
    setAvatar($(pos + 'Avatar'), info, c);
    const diff = material[c] - material[opposite(c)];
    const box = $(pos + 'Captured');
    box.innerHTML = '';
    let prev = '';
    for (const p of capturedBy[c]) {
      const img = document.createElement('img');
      img.src = pieceSrc(p);
      img.alt = '';
      if (p[1] !== prev) img.className = 'group';
      prev = p[1];
      box.appendChild(img);
    }
    if (diff > 0) box.insertAdjacentHTML('beforeend', `<b>+${diff}</b>`);
    $(pos + 'Player').classList.toggle('active', game.turn === c && !game.isGameOver() && !playResult && mode !== 'learn');
  };
  const bottom = flipped ? 'b' : 'w';
  fill('bottom', bottom);
  fill('top', opposite(bottom));
}

function renderHeader() {
  const me = Profile.me();
  $('meName').textContent = me.name;
  const rank = Profile.rankOf(me.exp);
  const medal = rankMedalOnly(rank);
  const iconEl = $('meRankIcon');
  if (iconEl) iconEl.innerHTML = medal;
  const badgeEl = $('meRankBadge');
  if (badgeEl) badgeEl.innerHTML = medal;
  const ratingEl = $('meRating');
  if (ratingEl) ratingEl.innerHTML = `<span class="me-rank-line"><span style="color:${rank.color}">${rank.text}</span></span> · ${me.elo} Elo`;
  const rankBtn = $('rankBtn');
  if (rankBtn) rankBtn.title = `${rank.name} · ${me.elo} Elo`;
  setAvatar($('meAvatar'), { name: me.name, photo: me.photo, me: true }, 'w');
  document.body.dataset.board = Profile.prefs().board;
  document.body.dataset.pieces = Profile.prefs().pieces || 'default';
  // Chỉ tài khoản ADMIN thấy tab Admin; admin được dùng Gợi ý trong ván Online
  const staff = Profile.isAdmin();
  $('adminTab').hidden = !Profile.isOwner();
  $('onlineHint').hidden = !staff;
  $('onlineTools').classList.toggle('three', !staff);
}

// ---------------- Thao tác trên bàn cờ ----------------

function canHumanMove() {
  if (!isLiveView()) return false; // đang xem lại biên bản thì không đi nước
  if (mode === 'learn') return Learn.canMove();
  if (mode === 'online') return Online.canMove();
  return !thinking && !playResult && game.turn !== aiColor && !game.isGameOver();
}

function select(i) {
  selected = i;
  selectedMoves = game.legalMoves().filter(m => m.from === i);
}

function onSquare(i, dragged = false) {
  if (!canHumanMove()) return;
  const matches = selectedMoves.filter(m => m.to === i);
  if (matches.length) {
    if (matches.length > 1) askPromotion(matches, dragged);
    else play(matches[0], dragged);
    return;
  }
  const p = game.board[i];
  if (p && p[0] === game.turn && i !== selected) select(i);
  else clearSelection();
  render();
}

function clearSelection() {
  selected = -1;
  selectedMoves = [];
}

function squareAt(e) {
  const r = boardEl.getBoundingClientRect();
  const col = Math.floor((e.clientX - r.left) / r.width * 8);
  const row = Math.floor((e.clientY - r.top) / r.height * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
  const k = row * 8 + col;
  return flipped ? 63 - k : k;
}

function setDragOver(i) {
  if (drag.over === i) return;
  if (drag.over >= 0) boardEl.children[disp(drag.over)].classList.remove('drag-over');
  if (i >= 0) boardEl.children[disp(i)].classList.add('drag-over');
  drag.over = i;
}

function endDrag() {
  if (drag && drag.ghost) drag.ghost.remove();
  drag = null;
}

boardEl.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  Sound.unlock();
  const i = squareAt(e);
  if (i < 0) return;
  if (mode === 'learn' && Learn.tapMode()) return Learn.tap(i); // bài "bấm vào ô"
  if (marks.size) { marks.clear(); render(); }
  if (!canHumanMove()) return;
  const p = game.board[i];
  if (!p || p[0] !== game.turn) return onSquare(i);
  const wasSelected = selected === i;
  if (!wasSelected) { select(i); render(); }
  drag = { from: i, x: e.clientX, y: e.clientY, moved: false, wasSelected, over: -1, ghost: null };
  boardEl.setPointerCapture(e.pointerId);
  e.preventDefault();
});

boardEl.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    drag.moved = true;
    const size = boardEl.getBoundingClientRect().width / 8;
    const ghost = document.createElement('img');
    ghost.className = 'drag-ghost';
    ghost.src = pieceSrc(game.board[drag.from]);
    ghost.style.width = ghost.style.height = size + 'px';
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    const img = boardEl.children[disp(drag.from)].querySelector('.piece');
    if (img) img.classList.add('dragging');
  }
  drag.ghost.style.left = e.clientX + 'px';
  drag.ghost.style.top = e.clientY + 'px';
  setDragOver(squareAt(e));
});

boardEl.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  endDrag();
  const i = squareAt(e);
  if (d.moved) {
    if (selectedMoves.some(m => m.to === i)) onSquare(i, true);
    else render(); // thả ra ngoài: quân về chỗ cũ, vẫn giữ chọn
  } else if (d.wasSelected) {
    clearSelection();
    render();
  }
});

boardEl.addEventListener('pointercancel', () => { endDrag(); render(); });

// Chuột phải: đánh dấu ô (như khi phân tích)
boardEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const i = squareAt(e);
  if (i < 0) return;
  if (marks.has(i)) marks.delete(i); else marks.add(i);
  render();
});

function askPromotion(moves, dragged) {
  const modal = $('promo');
  const box = $('promoChoices');
  box.innerHTML = '';
  for (const m of moves) {
    const btn = document.createElement('button');
    btn.innerHTML = `<img src="${pieceSrc(m.piece[0] + m.promotion)}" alt="${m.promotion}">`;
    btn.addEventListener('click', () => { modal.hidden = true; play(m, dragged); });
    box.appendChild(btn);
  }
  modal.hidden = false;
}

function play(m, dragged = false) {
  clearSelection();
  hint = null;
  marks.clear();
  skipAnim = dragged;
  viewPly = null; // về live khi đi nước mới
  if (mode === 'learn') return Learn.onMove(m);
  game.move(m);
  if (mode === 'online') Online.sendMove(m);
  render();
  maybeAiMove();
}

// Gợi ý nước đi tốt (dùng AI mức Trung bình). Chế độ Chơi: ai cũng dùng được;
// ván Online: chỉ admin. Admin dùng Gợi ý vẫn được tính Elo và rank (không đặt `assisted`).
function showHint() {
  const staff = Profile.isAdmin();
  if (!(mode === 'play' || (mode === 'online' && staff)) || !canHumanMove()) return;
  if (!staff && isRatedBotGame() && !assisted) {
    if (!confirm('Dùng Gợi ý thì ván này sẽ không tính Elo. Tiếp tục?')) return;
    assisted = true;
    renderRatedNote();
  }
  const m = findBestMove(game, 2);
  if (m) hint = { from: m.from, to: m.to };
  render();
}

function maybeAiMove() {
  if (mode !== 'play' || game.turn !== aiColor || game.isGameOver() || playResult) return;
  thinking = true;
  render();
  const id = gameId;
  // setTimeout để trình duyệt kịp vẽ lại trước khi AI tính toán
  setTimeout(() => {
    if (id !== gameId) return;
    const m = findBestMove(game, gameLevel);
    thinking = false;
    if (m) game.move(m);
    render();
  }, 350);
}

// ---------------- Ván đấu & rank ----------------

function startRatedGame() {
  ratedDone = false;
  assisted = false;
  playResult = null;
  $('resultModal').hidden = true;
}

// Đang đấu với máy (ván có thể tính Elo)
function isRatedBotGame() {
  return mode === 'play' && aiColor !== 'none' && !ratedDone && !playResult && !game.isGameOver();
}

// Bỏ ván giữa chừng khi đấu với máy bị tính thua (như chess.com). Trả về false nếu người chơi hủy.
function abandonBotGame() {
  if (!isRatedBotGame() || assisted || game.history.length < MIN_RANKED_PLIES) return true;
  if (!confirm('Bỏ ván giữa chừng sẽ bị tính thua và mất Elo. Tiếp tục?')) return false;
  ratedDone = true;
  Profile.recordBot(0, BOT_ELO[gameLevel]);
  return true;
}

function renderRatedNote() {
  const el = $('ratedNote');
  const rated = aiColor !== 'none';
  el.classList.toggle('off', !rated || assisted);
  el.textContent = !rated ? '2 người cùng máy không tính Elo'
    : assisted ? (Profile.isAdmin() ? 'Ván này không tính Elo vì đã dùng Đi lại' : 'Ván này không tính Elo vì đã dùng Gợi ý / Đi lại')
    : `Đấu với máy ${LEVEL_NAME[gameLevel]} (${BOT_ELO[gameLevel]} Elo) có tính Elo, không tính rank · ${Profile.isAdmin() ? 'Admin: Gợi ý vẫn tính, Đi lại thì không' : 'dùng Gợi ý hoặc Đi lại thì không tính'}`;
}

function newGame() {
  if (!abandonBotGame()) return false;
  gameId++;
  thinking = false;
  game.reset();
  clearSelection();
  hint = null;
  marks.clear();
  viewPly = null;
  aiColor = $('mode').value;
  gameLevel = Number($('level').value);
  flipped = aiColor === 'w';
  startRatedGame();
  renderRatedNote();
  render();
  maybeAiMove();
  return true;
}

// Đổi chế độ / độ khó giữa ván: nếu người chơi hủy thì trả ô chọn về như cũ
function changeSetup() {
  if (!newGame()) {
    $('mode').value = aiColor;
    $('level').value = String(gameLevel);
  }
}

function undo() {
  if (thinking || playResult || !game.history.length) return;
  if (isRatedBotGame() && !assisted) {
    if (!confirm('Đi lại thì ván này sẽ không tính Elo. Tiếp tục?')) return;
    assisted = true;
    renderRatedNote();
  }
  hint = null;
  game.undo();
  // Khi đấu với máy, lùi thêm một nước để quay về lượt của người chơi
  if (game.turn === aiColor && game.history.length) game.undo();
  clearSelection();
  render();
  maybeAiMove();
}

function resignPlay() {
  if (playResult || game.isGameOver() || !game.history.length) return;
  const loser = aiColor === 'none' ? game.turn : opposite(aiColor);
  if (!confirm(aiColor === 'none' ? `${COLOR_NAME[loser]} xin thua?` : 'Bạn chắc chắn muốn xin thua?')) return;
  gameId++;
  thinking = false;
  playResult = { winner: opposite(loser), reason: `${COLOR_NAME[loser]} xin thua`, score: aiColor === 'none' ? null : 0 };
  render();
}

function gameOutcome() {
  if (mode === 'online') {
    const o = Online.outcome();
    return o && { ...o, reason: o.reason || REASONS[game.status()] };
  }
  if (mode !== 'play') return null;
  const human = aiColor === 'none' ? null : opposite(aiColor);
  if (playResult) return { ...playResult };
  const s = game.status();
  if (s === 'playing') return null;
  const winner = s === 'checkmate' ? opposite(game.turn) : null;
  return { winner, reason: REASONS[s], score: human ? (winner ? (winner === human ? 1 : 0) : 0.5) : null };
}

function checkResult() {
  if (ratedDone) return;
  const o = gameOutcome();
  if (!o) return;
  ratedDone = true;
  // Ván Online: tính rank (exp) và Elo. Ván đấu với máy: chỉ tính Elo. 2 người cùng máy: không tính.
  let change = null, note = null;
  if (o.score != null) {
    if (mode === 'play' && assisted) note = Profile.isAdmin() ? 'Ván có dùng Đi lại nên không tính Elo' : 'Ván có dùng Gợi ý / Đi lại nên không tính Elo';
    else if (game.history.length < MIN_RANKED_PLIES) note = mode === 'online' ? 'Ván quá ngắn nên không tính rank và Elo' : 'Ván quá ngắn nên không tính Elo';
    else change = mode === 'online' ? Profile.record(o.score, Online.oppElo()) : Profile.recordBot(o.score, BOT_ELO[gameLevel]);
    // Ván ghép trong contest: cộng điểm contest (thắng +2, hòa +1, thua 0)
    if (change && mode === 'online' && Online.contest()) {
      const c = contestById.get(Online.contest());
      if (c) change.contest = Contest.record(c, o.score, Online.startedAt());
    }
  }
  if (mode === 'online' && Online.contest()) Auto.doneAt = Date.now(); // đếm giờ tự ghép ván contest tiếp theo
  if (!quietResult) setTimeout(() => showResult(o, change, note), 600);
}

// ---------------- Nhận xét tự động sau ván ----------------
const PIECE_VN = { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã', P: 'Tốt' };
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

function humanColorForReview() {
  if (mode === 'online') {
    try {
      // Online.player('w').me / 'b'
      if (Online.player('w') && Online.player('w').me) return 'w';
      if (Online.player('b') && Online.player('b').me) return 'b';
    } catch {}
    return null;
  }
  if (mode === 'play' && aiColor !== 'none') return opposite(aiColor);
  return null; // 2 người cùng máy: nhận xét trung lập
}

function materialOf(board, color) {
  let s = 0;
  for (const p of board) if (p && p[0] === color) s += VAL[p[1]] || 0;
  return s;
}

function buildGameReview(o) {
  const hist = game.history;
  if (!hist.length) return null;

  const g = new Chess();
  const human = humanColorForReview();
  const tags = [];
  const lines = [];
  let checks = 0, captures = 0, promotions = 0;
  let queenLostBy = { w: 0, b: 0 }; // nước đầu tiên mất hậu (0 = chưa)
  let bigSwing = null; // { ply, san, drop, side }
  let prevEval = 0;
  let maxMaterialLead = 0;
  let earlyQueenOut = null; // { side, ply, san }
  let castled = { w: false, b: false };
  let checksOnHuman = 0;

  for (let i = 0; i < hist.length; i++) {
    const entry = hist[i];
    if (!entry || !entry.move) continue;
    const m = entry.move;
    const san = entry.san || '';
    if (!m.piece) continue;
    const side = m.piece[0];
    // early queen development
    if (m.piece[1] === 'Q' && i < 8 && !earlyQueenOut) earlyQueenOut = { side, ply: i + 1, san };

    const applied = g.move({ from: m.from, to: m.to, promotion: m.promotion || undefined });
    if (!applied) continue; // lịch sử lệch thì bỏ qua nước này, không làm hỏng cả nhận xét

    if (m.captured) {
      captures++;
      if (m.captured[1] === 'Q' && !queenLostBy[m.captured[0]]) queenLostBy[m.captured[0]] = i + 1;
    }
    if (m.promotion) promotions++;
    if (san.includes('+') || san.includes('#')) {
      checks++;
      if (human && side !== human) checksOnHuman++;
    }
    if (m.flag === 'castleK' || m.flag === 'castleQ' || (m.piece[1] === 'K' && Math.abs((m.from & 7) - (m.to & 7)) === 2)) castled[side] = true;

    const matW = materialOf(g.board, 'w');
    const matB = materialOf(g.board, 'b');
    maxMaterialLead = Math.max(maxMaterialLead, Math.abs(matW - matB));

    const moverVal = VAL[m.piece[1]] || 0;
    const capVal = m.captured ? (VAL[m.captured[1]] || 0) : 0;
    // Blunder heuristic: đổi quân bất lợi
    if (m.captured && moverVal > capVal + 1 && !san.includes('+')) {
      const drop = moverVal - capVal;
      if (drop >= 4 && (!bigSwing || drop > bigSwing.drop)) {
        bigSwing = { ply: i + 1, san, drop, side, kind: 'trade' };
      }
    }
    // Hậu đổi quân nhỏ
    if (m.piece[1] === 'Q' && m.captured && capVal <= 3) {
      bigSwing = { ply: i + 1, san, drop: 9 - capVal, side, kind: 'queen' };
    }
  }

  const plies = hist.length;
  const moves = Math.ceil(plies / 2);
  const status = game.status();
  const matW = materialOf(game.board, 'w');
  const matB = materialOf(game.board, 'b');

  // --- Headline summary ---
  let summary;
  if (status === 'checkmate') {
    const winner = opposite(game.turn);
    const winName = COLOR_NAME[winner];
    if (human) {
      summary = human === winner
        ? `Bạn thắng bằng chiếu hết sau ${moves} nước. Kết thúc gọn!`
        : `Bạn bị chiếu hết sau ${moves} nước. Hãy chú ý an toàn vua ở tàn cuộc.`;
      tags.push(human === winner ? { t: 'Chiến thắng', c: 'good' } : { t: 'Thất bại', c: 'bad' });
    } else {
      summary = `${winName} thắng bằng chiếu hết sau ${moves} nước.`;
      tags.push({ t: 'Chiếu hết', c: 'mid' });
    }
  } else if (o && o.score === 0 && o.reason && /xin thua|rời/i.test(o.reason)) {
    summary = `Ván kết thúc sớm (${moves} nước): ${o.reason}.`;
    tags.push({ t: 'Kết thúc sớm', c: 'mid' });
  } else if (status === 'stalemate') {
    summary = `Hòa vì hết nước đi (pat) sau ${moves} nước — vua không bị chiếu nhưng không còn nước hợp lệ.`;
    tags.push({ t: 'Pat', c: 'mid' });
  } else if (status !== 'playing') {
    summary = `Hòa sau ${moves} nước (${o && o.reason ? o.reason : REASONS[status] || status}).`;
    tags.push({ t: 'Hòa', c: 'mid' });
  } else {
    summary = `Ván dừng sau ${moves} nước.`;
  }
  lines.push(summary);

  // --- Opening ---
  if (moves <= 12) {
    lines.push('Ván khá ngắn: khai cuộc chưa kịp triển khai hết quân. Cố gắng nhập thành sớm và phát triển Mã/Tượng trước khi tấn công.');
    tags.push({ t: 'Ván ngắn', c: 'mid' });
  } else if (moves <= 25) {
    lines.push('Đấu ở mức trung bình về độ dài — hai bên đã qua giai đoạn khai cuộc.');
  } else {
    lines.push(`Ván dài ${moves} nước: có sự giằng co ở trung cuộc/tàn cuộc.`);
    tags.push({ t: 'Ván dài', c: 'good' });
  }

  // --- Castling ---
  if (human) {
    if (!castled[human] && moves >= 12) {
      lines.push(`Bạn chưa nhập thành trong ván này. Nhập thành giúp vua an toàn và đưa Xe vào trận sớm hơn.`);
      tags.push({ t: 'Chưa nhập thành', c: 'bad' });
    } else if (castled[human]) {
      tags.push({ t: 'Đã nhập thành', c: 'good' });
    }
  } else {
    if (!castled.w || !castled.b) {
      const who = [!castled.w && 'Trắng', !castled.b && 'Đen'].filter(Boolean).join(' và ');
      lines.push(`${who} chưa nhập thành — vua dễ bị tấn công giữa bàn.`);
    }
  }

  // --- Queen early ---
  if (earlyQueenOut && earlyQueenOut.ply <= 6) {
    const who = human && earlyQueenOut.side === human ? 'Bạn' : COLOR_NAME[earlyQueenOut.side];
    lines.push(`${who} đưa Hậu ra rất sớm (nước ${Math.ceil(earlyQueenOut.ply / 2)}: <span class="rv-move">${earlyQueenOut.san}</span>). Hậu dễ bị quấy rồi mất nhịp triển khai.`);
    if (human && earlyQueenOut.side === human) tags.push({ t: 'Hậu ra sớm', c: 'mid' });
  }

  // --- Lost queen ---
  if (human && queenLostBy[human]) {
    lines.push(`Bạn mất Hậu ở nước thứ ${Math.ceil(queenLostBy[human] / 2)}. Đây thường là bước ngoặt — hãy kiểm tra ô bị tấn công trước khi để Hậu đứng trên đường nguy hiểm.`);
    tags.push({ t: 'Mất Hậu', c: 'bad' });
  } else if (human && queenLostBy[opposite(human)]) {
    lines.push(`Đối thủ mất Hậu ở nước ${Math.ceil(queenLostBy[opposite(human)] / 2)} — bạn đã tận dụng tốt cơ hội.`);
    tags.push({ t: 'Ăn Hậu', c: 'good' });
  }

  // --- Checks ---
  if (checks >= 5) {
    lines.push(`Có tới ${checks} lần chiếu trong ván — nhịp tấn công khá cao.`);
  } else if (human && checksOnHuman >= 3 && o && o.score === 0) {
    lines.push('Bạn bị chiếu khá nhiều. Khi bị chiếu, ưu tiên nước an toàn, tránh bỏ quân khi chạy vua.');
  }

  // --- Material ---
  const lead = matW - matB;
  if (Math.abs(lead) >= 5 && status === 'checkmate') {
    const ahead = lead > 0 ? 'Trắng' : 'Đen';
    lines.push(`Lợi thế chất liệu nghiêng về ${ahead} (${matW}–${matB} điểm tạm tính).`);
  }

  // --- Bad trade ---
  if (bigSwing && bigSwing.drop >= 4) {
    const who = human && bigSwing.side === human ? 'Bạn' : COLOR_NAME[bigSwing.side];
    if (bigSwing.kind === 'queen') {
      lines.push(`Điểm đáng chú ý: ${who} dùng Hậu đổi quân nhỏ tại <span class="rv-move">${bigSwing.san}</span> (nước ${Math.ceil(bigSwing.ply / 2)}) — thường là thiệt lớn trừ khi có chiếu hết hoặc bắt lại ngay.`);
    } else {
      lines.push(`Nước <span class="rv-move">${bigSwing.san}</span> (nước ${Math.ceil(bigSwing.ply / 2)}) của ${who} có vẻ đổi quân bất lợi.`);
    }
    if (human && bigSwing.side === human) tags.push({ t: 'Nước đáng tiếc', c: 'bad' });
  }

  // --- Tip ---
  const tips = [];
  if (human && !castled[human]) tips.push('Ưu tiên nhập thành trong 8–12 nước đầu.');
  if (human && earlyQueenOut && earlyQueenOut.side === human && earlyQueenOut.ply <= 6) tips.push('Triển khai Mã và Tượng trước, Hậu ra sau.');
  if (captures < 2 && moves > 15) tips.push('Chủ động tìm cách mở đường và trao đổi quân khi bị động.');
  if (status === 'checkmate' && o && o.score === 0) tips.push('Khi bị tấn công, kiểm tra tất cả nước chiếu và ô thoát của vua.');
  if (status === 'checkmate' && o && o.score === 1) tips.push('Phát huy thế thắng: khi hơn quân, hãy đơn giản hóa (đổi quân) để vào tàn cuộc.');
  if (!tips.length) tips.push('Mỗi ván hãy xem lại 1–2 nước then chốt — tiến bộ sẽ rất nhanh.');
  lines.push('Gợi ý: ' + tips[0]);

  if (plies < 4) {
    return {
      tags: [{ t: 'Ván rất ngắn', c: 'mid' }],
      lines: ['Ván quá ngắn để nhận xét sâu. Chơi thêm vài nước nữa để có phân tích hữu ích hơn.'],
    };
  }

  return { tags, lines };
}

function renderGameReview(o) {
  const box = $('resultReview');
  const body = $('resultReviewBody');
  if (!box || !body) return;
  const rev = buildGameReview(o);
  if (!rev) { box.hidden = true; body.innerHTML = ''; return; }
  box.hidden = false;
  const tagsHtml = rev.tags.map(x => `<span class="rv-tag ${x.c}">${x.t}</span>`).join('');
  const linesHtml = rev.lines.map(t => `<p>${t}</p>`).join('');
  body.innerHTML = (tagsHtml ? `<div>${tagsHtml}</div>` : '') + linesHtml;
}

function showResult(o, change, note) {
  const title = o.score == null
    ? (o.winner ? `${COLOR_NAME[o.winner]} thắng!` : 'Hòa!')
    : o.score === 1 ? 'Bạn thắng!' : o.score === 0 ? 'Bạn thua' : 'Hòa!';
  const kind = o.score == null ? (o.winner ? 'win' : 'draw') : o.score === 1 ? 'win' : o.score === 0 ? 'loss' : 'draw';
  $('resultIcon').className = 'result-icon ' + kind;
  $('resultIcon').innerHTML = `<svg class="ic"><use href="#i-${kind === 'win' ? 'trophy' : kind === 'loss' ? 'flag' : 'handshake'}"/></svg>`;
  $('resultTitle').textContent = title;
  $('resultReason').textContent = o.reason || '';
  const box = $('resultRating');
  box.innerHTML = '';
  if (change) {
    if (change.before) { // ván Online: có đổi rank
      const { before, after } = change;
      const sign = change.delta > 0 ? '+' : '';
      box.innerHTML = `<span class="muted">Rank</span>
        <span class="player-rank">${rankMedalOnly(before)}<b style="color:${before.color}">${before.text}</b></span>
        →
        <span class="player-rank">${rankMedalOnly(after)}<b style="color:${after.color}">${after.text}</b></span>
        <span class="delta ${change.delta > 0 ? 'up' : change.delta < 0 ? 'down' : ''}">${sign}${change.delta} exp</span>`;
      if (after.tier > before.tier) box.insertAdjacentHTML('beforeend', `<div class="rank-up">Lên rank ${after.name}!</div>`);
      else if (after.tier < before.tier) box.insertAdjacentHTML('beforeend', `<div class="rank-down">Xuống rank ${after.name}</div>`);
    }
    const e = change.elo;
    const es = e.delta > 0 ? '+' : '';
    box.insertAdjacentHTML('beforeend', `<div class="elo-line"><span class="muted">Elo</span> <b>${e.before}</b> → <b>${e.after}</b>
      <span class="delta ${e.delta > 0 ? 'up' : e.delta < 0 ? 'down' : ''}">${es}${e.delta}</span></div>`);
    if (change.contest) {
      const line = document.createElement('div');
      line.className = 'elo-line';
      line.innerHTML = '<span class="muted">Contest</span> <b></b> <span class="delta"></span>';
      line.querySelector('b').textContent = change.contest.name;
      const d = line.querySelector('.delta');
      d.textContent = `+${change.contest.pts} điểm`;
      if (change.contest.pts > 0) d.classList.add('up');
      box.appendChild(line);
    }
  } else if (note) {
    box.innerHTML = `<span class="muted">${note}</span>`;
  }
  const inContest = mode === 'online' && !!Online.contest();
  if (inContest) box.insertAdjacentHTML('beforeend', `<div class="elo-line muted">Web sẽ tự ghép ván contest tiếp theo sau ${AUTO_NEXT / 1000} giây</div>`);
  $('resultAgain').textContent = inContest ? 'Ván contest tiếp theo' : mode === 'online' ? 'Mời chơi ván mới' : 'Ván mới';
  $('resultAgain').hidden = mode === 'online' && !inContest && !Online.connected();
  try { renderGameReview(o); } catch (e) { const b = $('resultReview'); if (b) b.hidden = true; }
  $('resultModal').hidden = false;
}

// ---------------- Chuyển chế độ ----------------

function setMode(m) {
  if (m === mode) return;
  if (mode === 'online' && Online.inGame() && game.history.length >= 2 &&
      !confirm('Rời phòng giữa ván sẽ bị tính thua. Tiếp tục?')) return;
  if (mode === 'play' && m !== 'play' && !abandonBotGame()) return;
  if (mode === 'online' && Auto.running) Auto.paused.add(Auto.running); // tự rời Online: tạm dừng tự ghép contest
  quietResult = true;
  if (mode === 'online') Online.leave();
  if (mode === 'learn') Learn.leave();
  quietResult = false;
  mode = m;
  gameId++;
  thinking = false;
  aiColor = 'none';
  hint = null;
  marks.clear();
  ratedDone = true;
  playResult = null;
  // Xóa hết trạng thái kéo/chọn/hiệu ứng của ván cũ (đặc biệt khi rời Học cờ)
  if (drag && drag.ghost) drag.ghost.remove();
  drag = null;
  selected = -1;
  selectedMoves = [];
  seenMove = null;
  seenLen = 0;
  skipAnim = true;
  viewPly = null;
  flipped = false;
  assisted = false;
  $('resultModal').hidden = true;
  document.body.dataset.mode = m;
  // Luôn xóa data-learn để CSS không còn ẩn/hiện bàn theo bài học
  if (m !== 'learn') document.body.dataset.learn = '';
  if (m === 'online') Profile.refreshAdmin(); // người vừa được cấp quyền admin thấy nút Gợi ý ngay
  for (const tab of document.querySelectorAll('.tab[data-mode]')) tab.setAttribute('aria-selected', tab.dataset.mode === m);
  $('playPanel').hidden = m !== 'play';
  $('onlinePanel').hidden = m !== 'online';
  $('learnPanel').hidden = m !== 'learn';
  if (m === 'play') newGame();
  else if (m === 'learn') Learn.enter();
  else {
    // Rời Học cờ / Chơi → Online: luôn về bàn cờ chuẩn, không giữ thế bài học
    game.reset();
    clearSelection();
    hint = null;
    marks.clear();
    flipped = false;
    ratedDone = true;
    playResult = null;
    render();
    renderPlayers();
    renderStatus();
  }
  // Ẩn modal bài học nếu còn sót
  const ld = $('learnDone');
  if (ld) ld.hidden = true;
}

// ---------------- PGN / FEN / xem lại / phím tắt ----------------
function gameToPGN() {
  const h = game.history;
  const me = Profile.me();
  const date = new Date();
  const ymd = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
  let white = 'White', black = 'Black';
  if (mode === 'play') {
    if (aiColor === 'b') { white = me.name; black = 'Máy'; }
    else if (aiColor === 'w') { white = 'Máy'; black = me.name; }
    else { white = 'Người chơi Trắng'; black = 'Người chơi Đen'; }
  } else if (mode === 'online') {
    try {
      const w = Online.player('w'), b = Online.player('b');
      white = (w && w.name) || white;
      black = (b && b.name) || black;
    } catch {}
  }
  let result = '*';
  const s = game.status();
  if (s === 'checkmate') result = game.turn === 'b' ? '1-0' : '0-1';
  else if (s !== 'playing') result = '1/2-1/2';
  else if (playResult && playResult.winner) result = playResult.winner === 'w' ? '1-0' : '0-1';

  const tags = [
    `[Event "Royal Gambit"]`,
    `[Site "Royal Gambit"]`,
    `[Date "${ymd}"]`,
    `[White "${white.replace(/"/g, '')}"]`,
    `[Black "${black.replace(/"/g, '')}"]`,
    `[Result "${result}"]`,
  ];
  const moves = [];
  for (let i = 0; i < h.length; i++) {
    if (i % 2 === 0) moves.push(`${i / 2 + 1}.`);
    moves.push(h[i].san);
  }
  moves.push(result);
  return tags.join('\n') + '\n\n' + moves.join(' ') + '\n';
}

function gameToFEN() {
  // FEN của thế đang xem (hoặc live)
  const g = isLiveView() ? game : boardAt(viewPly);
  // chess.js không export fen() — dựng thủ công từ board
  if (typeof g.fen === 'function') return g.fen();
  let rows = [];
  for (let r = 0; r < 8; r++) {
    let empty = 0, row = '';
    for (let c = 0; c < 8; c++) {
      const p = g.board[r * 8 + c];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const ch = p[1];
      row += p[0] === 'w' ? ch : ch.toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const castle = g.castling || {};
  let cast = (castle.wK ? 'K' : '') + (castle.wQ ? 'Q' : '') + (castle.bK ? 'k' : '') + (castle.bQ ? 'q' : '');
  if (!cast) cast = '-';
  const ep = g.ep >= 0 && typeof sqName === 'function' ? sqName(g.ep) : '-';
  return `${rows.join('/')} ${g.turn} ${cast} ${ep} ${g.halfmove || 0} ${g.fullmove || 1}`;
}

function toast(msg) {
  const old = document.querySelector('.toast-copy');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast-copy';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

async function copyText(text, okMsg) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(okMsg || 'Đã sao chép');
  } catch {
    toast('Không sao chép được — hãy thử lại');
  }
}

function bindRecordTools() {
  const pgn = $('copyPgn');
  const fen = $('copyFen');
  if (pgn) pgn.addEventListener('click', () => {
    if (!game.history.length) return toast('Chưa có nước đi');
    copyText(gameToPGN(), 'Đã sao chép PGN');
  });
  if (fen) fen.addEventListener('click', () => copyText(gameToFEN(), 'Đã sao chép FEN'));
  const go = (fn) => () => {
    if (!game.history.length) return;
    fn();
  };
  if ($('navStart')) $('navStart').addEventListener('click', go(() => setViewPly(0)));
  if ($('navPrev')) $('navPrev').addEventListener('click', go(() => {
    const cur = isLiveView() ? game.history.length : viewPly;
    setViewPly(Math.max(0, cur - 1));
  }));
  if ($('navNext')) $('navNext').addEventListener('click', go(() => {
    if (isLiveView()) return;
    setViewPly(viewPly + 1);
  }));
  if ($('navEnd') || $('navLive')) {
    const toLive = go(() => setViewPly(null));
    if ($('navEnd')) $('navEnd').addEventListener('click', toLive);
    if ($('navLive')) $('navLive').addEventListener('click', toLive);
  }
}

bindRecordTools();

// Phím tắt: Z đi lại · H gợi ý · F xoay · N ván mới · ← → xem lại · Esc về live
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'z' || k === 'Z') { e.preventDefault(); if (mode === 'play') undo(); }
  else if (k === 'h' || k === 'H') { e.preventDefault(); if ($('hint') && !$('hint').hidden) showHint(); }
  else if (k === 'f' || k === 'F') { e.preventDefault(); flipped = !flipped; render(); }
  else if (k === 'n' || k === 'N') { e.preventDefault(); if (mode === 'play') newGame(); }
  else if (k === 'ArrowLeft') { e.preventDefault(); if (game.history.length) { const cur = isLiveView() ? game.history.length : viewPly; setViewPly(Math.max(0, cur - 1)); } }
  else if (k === 'ArrowRight') { e.preventDefault(); if (!isLiveView()) setViewPly(viewPly + 1); }
  else if (k === 'Escape') { if (!isLiveView()) { e.preventDefault(); setViewPly(null); } }
});

// ---------------- Hộp thoại ----------------

function openModal(id) { $(id).hidden = false; }

for (const modal of document.querySelectorAll('.modal:not(.auth-gate)')) {
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-close]')) modal.hidden = true;
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') for (const m of document.querySelectorAll('.modal:not(.auth-gate)')) m.hidden = true;
});

$('resultAgain').addEventListener('click', () => {
  $('resultModal').hidden = true;
  if (mode === 'online' && Online.contest()) autoNow();
  else if (mode === 'online') Online.rematch();
  else newGame();
});

// ---------------- Huy hiệu rank (SVG classic) ----------------
// Mỗi rank một biểu tượng kim loại phù hợp giao diện tối cổ điển của web.
let _medalUid = 0;
function rankMedalSVG(icon, color, glow) {
  const c = color || '#f5b83d';
  const g = glow || c;
  const id = 'rm' + (++_medalUid);
  // viewBox 64x64 — huy chương tròn + chi tiết nội bộ theo tier
  const rim = `
    <circle cx="32" cy="32" r="30" fill="url(#${id}g)" stroke="${g}" stroke-width="2"/>
    <circle cx="32" cy="32" r="24" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.55"/>
    <circle cx="32" cy="32" r="20" fill="#1a1916" opacity="0.35"/>`;
  const defs = `
    <defs>
      <radialGradient id="${id}g" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${c}"/>
        <stop offset="55%" stop-color="${g}"/>
        <stop offset="100%" stop-color="#1a1916"/>
      </radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.35"/>
        <stop offset="40%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>`;

  const icons = {
    bronze: `${rim}
      <path d="M32 16l4.5 9.2 10.2 1.5-7.4 7.2 1.8 10.2L32 39.5l-9.1 4.6 1.8-10.2-7.4-7.2 10.2-1.5z"
        fill="${c}" stroke="${g}" stroke-width="1" stroke-linejoin="round"/>`,
    silver: `${rim}
      <path d="M22 40 V24 l10-6 10 6 v16 l-10 6z" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="32" cy="30" r="4" fill="${c}"/>`,
    gold: `${rim}
      <path d="M20 38h24v4H20zm2-4 3-14h14l3 14zM26 20l2-6h8l2 6" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M28 16h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
    platinum: `${rim}
      <path d="M32 14l12 10v12l-12 10-12-10V24z" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M32 22v16M24 28h16" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>`,
    diamond: `${rim}
      <path d="M32 14l14 12-14 20L18 26z" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M18 26h28M25 20l7 6 7-6" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.8"/>`,
    master: `${rim}
      <path d="M18 36h28v3H18zm2-3 2-12 6 6 4-10 4 10 6-6 2 12z" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="32" cy="22" r="2.2" fill="${c}"/>`,
    challenger: `${rim}
      <path d="M32 13l3 9h9l-7 6 3 9-8-5-8 5 3-9-7-6h9z" fill="${c}" stroke="${g}" stroke-width="1" stroke-linejoin="round" opacity="0.95"/>
      <path d="M32 42v6M28 48h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  };
  const body = icons[icon] || icons.bronze;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${defs}${body}<circle cx="32" cy="32" r="30" fill="url(#${id}s)"/></svg>`;
}

function rankBadgeHTML(rankOrTier, size) {
  // rankOrTier: object from rankOf() or RANKS[i] or {name,color,icon,glow}
  let r = rankOrTier;
  if (typeof rankOrTier === 'number') r = Profile.RANKS[rankOrTier] || Profile.RANKS[0];
  if (!r) return '';
  const icon = r.icon || (Profile.RANKS[r.tier] && Profile.RANKS[r.tier].icon) || 'bronze';
  const color = r.color || '#f5b83d';
  const glow = r.glow || color;
  const name = r.name || '';
  const sz = size || '';
  const cls = 'rank-badge' + (sz ? ' ' + sz : '');
  return `<span class="${cls}" style="--rk:${color};--rk2:${glow}" title="${name}">
    <span class="rb-medal">${rankMedalSVG(icon, color, glow)}</span>
    ${name ? `<span class="rb-name">${name}</span>` : ''}
  </span>`;
}

function rankMedalOnly(rankOrTier) {
  let r = rankOrTier;
  if (typeof rankOrTier === 'number') r = Profile.RANKS[rankOrTier] || Profile.RANKS[0];
  if (!r) return '';
  const icon = r.icon || (Profile.RANKS[r.tier] && Profile.RANKS[r.tier].icon) || 'bronze';
  const color = r.color || '#f5b83d';
  const glow = r.glow || color;
  return `<span class="rb-medal" style="--rk:${color}" title="${r.name || ''}">${rankMedalSVG(icon, color, glow)}</span>`;
}

// Hộp thoại rank: rank hiện tại, luật cộng/trừ exp và danh sách các rank
function openRank() {
  const R = Profile.rules;
  const me = Profile.me();
  const r = Profile.rankOf(me.exp);
  const stars = r.top
    ? `<span class="on">★</span> × ${r.stars}`
    : Array.from({ length: R.starsPerRank }, (_, i) => `<span class="${i < r.stars ? 'on' : ''}">★</span>`).join('');
  const note = r.top
    ? `Rank cao nhất · Tổng ${r.exp} exp`
    : `${r.inStar}/${R.perStar} exp tới sao tiếp theo · Tổng ${r.exp} exp`;
  const cur = $('rankCurrent');
  cur.style.setProperty('--rk', r.color);
  cur.innerHTML = `${rankBadgeHTML(r)}
    <div class="rk-stars">${stars}</div>
    <div class="progress"><div class="progress-bar" style="width:${100 * r.inStar / R.perStar}%;background:${r.color}"></div></div>
    <p class="muted">${note}</p>`;

  const fmt = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  $('rankRules').innerHTML = `<span class="up">Thắng<b>${fmt(R.win)}</b></span>
    <span>Hòa<b>${fmt(R.draw)}</b></span>
    <span class="down">Thua<b>${fmt(R.loss)}</b></span>`;
  $('rankHint').textContent = `Rank chỉ tính ván Online · ${R.perStar} exp = 1 sao · đủ ${R.starsPerRank} sao thì lên rank tiếp theo.`;

  const list = $('rankTiers');
  list.innerHTML = '';
  Profile.RANKS.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = i === r.tier ? 'cur' : i < r.tier ? 'done' : 'locked';
    li.style.setProperty('--rk', t.color);
    li.innerHTML = `${rankMedalOnly(t)}<b></b><small></small>`;
    li.querySelector('b').textContent = t.name;
    li.querySelector('small').textContent = i === 0 ? 'Khởi đầu' : `từ ${i * R.perRank} exp`;
    list.appendChild(li);
  });
  openModal('rankModal');
}

// Hồ sơ & cài đặt
function renderProfileAvatar() {
  const me = Profile.me();
  setAvatar($('profileAvatar'), { name: me.name, photo: me.photo, me: true }, 'w');
  $('avatarRemove').hidden = !me.photo;
}

function openProfile() {
  const me = Profile.me();
  const rank = Profile.rankOf(me.exp);
  $('profileUser').textContent = me.name;
  $('profileRank').innerHTML = `<span class="profile-rank-line">${rankMedalOnly(rank)}<span style="color:${rank.color}">${rank.text}</span></span> · ${me.elo} Elo`;
  const role = Profile.isOwner() ? 'Chủ web' : Profile.isAdmin() ? 'Admin' : '';
  $('profileRole').textContent = role;
  $('profileRole').hidden = !role;
  renderProfileAvatar();
  $('statGames').textContent = me.games;
  $('statWins').textContent = me.wins;
  $('statDraws').textContent = me.draws;
  $('statLosses').textContent = me.losses;
  $('soundToggle').checked = Profile.prefs().sound;
  $('profileMsg').textContent = '';
  renderThemes();
  renderMedals();
  openModal('profileModal');
}

// ----- Huy chương contest (hạng 1 / 2 / 3 khi contest kết thúc) -----

const MEDAL_NAME = { 1: 'Vàng', 2: 'Bạc', 3: 'Đồng' };
const MEDAL_CLS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function medalEl(place, n) {
  const m = document.createElement('span');
  m.className = 'medal ' + MEDAL_CLS[place];
  m.title = `Huy chương ${MEDAL_NAME[place]}` + (n > 1 ? ` × ${n}` : '');
  m.textContent = place;
  if (n > 1) m.dataset.n = '×' + n;
  return m;
}

async function renderMedals() {
  const box = $('profileMedals');
  box.hidden = true;
  let list = [];
  try { list = (await Contest.medals())[Profile.uid()] || []; } catch { return; }
  if (!list.length) return; // không có huy chương thì không hiện gì
  const [g, s, b] = Contest.count(list);
  $('medalCounts').innerHTML = '';
  [[1, g], [2, s], [3, b]].forEach(([p, n]) => {
    const card = document.createElement('div');
    card.className = 'medal-card ' + MEDAL_CLS[p] + (n ? '' : ' none');
    card.appendChild(medalEl(p));
    card.insertAdjacentHTML('beforeend', `<b>${n}</b><span>${MEDAL_NAME[p]}</span>`);
    $('medalCounts').appendChild(card);
  });
  const ul = $('medalList');
  ul.innerHTML = '';
  for (const m of list.slice(0, 12)) {
    const li = document.createElement('li');
    li.appendChild(medalEl(m.place));
    li.insertAdjacentHTML('beforeend', '<span class="ml-name"></span><small></small>');
    li.querySelector('.ml-name').textContent = `Hạng ${m.place} · ${m.name}`;
    li.querySelector('small').textContent = fmtDate(m.end);
    ul.appendChild(li);
  }
  box.hidden = false;
}

function renderThemes() {
  const box = $('themeChoices');
  box.innerHTML = '';
  const prefs = Profile.prefs();

  const boardTitle = document.createElement('div');
  boardTitle.className = 'skin-section';
  boardTitle.innerHTML = '<h4>Bàn cờ</h4>';
  box.appendChild(boardTitle);
  const boardGrid = document.createElement('div');
  boardGrid.className = 'themes';
  for (const [key, name, light, dark] of THEMES) {
    const b = document.createElement('button');
    b.className = 'theme' + (prefs.board === key ? ' on' : '');
    b.title = name;
    const bg = light.startsWith('linear')
      ? `background-image:${light},${dark};background-size:50% 100%,50% 100%;background-position:0 0,100% 0;background-repeat:no-repeat`
      : `background:linear-gradient(135deg, ${light} 50%, ${dark} 50%)`;
    b.innerHTML = `<span style="${bg}"></span><small>${name}</small>`;
    b.addEventListener('click', () => {
      Profile.setPref('board', key);
      document.body.dataset.board = key;
      renderThemes();
    });
    boardGrid.appendChild(b);
  }
  box.appendChild(boardGrid);

  const pieceTitle = document.createElement('div');
  pieceTitle.className = 'skin-section';
  pieceTitle.innerHTML = '<h4>Quân cờ</h4>';
  box.appendChild(pieceTitle);
  const pieceGrid = document.createElement('div');
  pieceGrid.className = 'themes';
  for (const [key, name] of PIECE_SKINS) {
    const b = document.createElement('button');
    b.className = 'theme' + ((prefs.pieces || 'default') === key ? ' on' : '');
    b.title = name;
    b.innerHTML = `<div class="piece-preview" data-pieces="${key}"><img src="pieces/wN.svg" alt=""></div><small>${name}</small>`;
    b.addEventListener('click', () => {
      Profile.setPref('pieces', key);
      document.body.dataset.pieces = key;
      renderThemes();
    });
    pieceGrid.appendChild(b);
  }
  box.appendChild(pieceGrid);
}

$('logoutBtn').addEventListener('click', async () => {
  const midGame = mode === 'online' && Online.inGame() && game.history.length >= 2;
  if (midGame && !confirm('Đăng xuất giữa ván online sẽ bị tính thua. Tiếp tục?')) return;
  quietResult = true;
  if (mode === 'online') Online.leave(); // rời ván giữa chừng được ghi thua trước khi đăng xuất
  quietResult = false;
  $('logoutBtn').disabled = true;
  await Profile.logout();
  location.reload();
});
$('avatarUpload').addEventListener('click', () => $('avatarFile').click());
$('profileAvatar').addEventListener('click', () => $('avatarFile').click());
$('avatarFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = ''; // cho phép chọn lại cùng một file
  if (!file) return;
  try {
    await Profile.setPhoto(file);
    $('profileMsg').textContent = '';
  } catch (err) {
    $('profileMsg').textContent = err.message === 'size' ? 'Ảnh quá lớn (tối đa 10 MB).'
      : err.message === 'type' ? 'Chỉ nhận ảnh PNG, JPG, WebP hoặc GIF.'
      : 'Không đọc được ảnh này.';
  }
  renderProfileAvatar();
});
$('avatarRemove').addEventListener('click', () => { Profile.removePhoto(); renderProfileAvatar(); });
$('soundToggle').addEventListener('change', e => Profile.setPref('sound', e.target.checked));

Profile.onChange(() => {
  renderHeader();
  renderPlayers();
  renderRatedNote();
  if (entered && needsPlacement()) openPlacement(); // server báo chưa chọn trình độ
  if (adminRows.length && !$('adminModal').hidden) {
    const photo = Profile.me().photo;
    for (const p of adminRows) if (p.me) p.photo = photo;
    renderAdminList();
  }
});

// ---------------- Nút bấm ----------------

for (const tab of document.querySelectorAll('.tab[data-mode]')) tab.addEventListener('click', () => setMode(tab.dataset.mode));
$('lbTab').addEventListener('click', openLeaderboard);
$('libTab').addEventListener('click', () => Library.open());
Library.bind();
$('contestTab').addEventListener('click', openContests);
$('lbRefresh').addEventListener('click', openLeaderboard);
$('newGame').addEventListener('click', newGame);
$('hint').addEventListener('click', showHint);
$('onlineHint').addEventListener('click', showHint);
$('adminTab').addEventListener('click', openAdmin);
$('adminRefresh').addEventListener('click', openAdmin);
$('adminSearch').addEventListener('input', renderAdminList);
$('undo').addEventListener('click', undo);
$('playResign').addEventListener('click', resignPlay);
$('flip').addEventListener('click', () => { flipped = !flipped; render(); });
$('mode').addEventListener('change', changeSetup);
$('level').addEventListener('change', changeSetup);
$('rankBtn').addEventListener('click', openRank);
$('profileBtn').addEventListener('click', openProfile);
$('promo').addEventListener('click', e => {
  if (e.target === $('promo')) $('promo').hidden = true;
});

// Mở bằng link mời (?room=MÃ) thì vào thẳng phòng online
const room = new URLSearchParams(location.search).get('room');
renderHeader();
newGame();

// ---------------- Đăng nhập / đăng ký ----------------

const AUTH_ERRORS = {
  NAME: 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu _',
  WEAK: 'Mật khẩu cần ít nhất 6 ký tự',
  MISMATCH: 'Hai mật khẩu không khớp',
  EXISTS: 'Tên đăng nhập này đã có người dùng',
  RESERVED: 'Tên bắt đầu bằng "admin" chỉ dành cho chủ web, hãy chọn tên khác',
  BAD_LOGIN: 'Sai tên đăng nhập hoặc mật khẩu',
  TOO_MANY: 'Thử quá nhiều lần, hãy đợi một lúc rồi thử lại',
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra mạng Internet.',
  NOT_ALLOWED: 'Máy chủ chưa bật đăng nhập Email/Password (xem README).',
  DENIED: 'Máy chủ từ chối truy cập, kiểm tra lại luật Firebase (xem README).',
};
let authMode = 'login';
let entered = false;

function setAuthMode(m) {
  authMode = m;
  $('authTabLogin').classList.toggle('on', m === 'login');
  $('authTabRegister').classList.toggle('on', m === 'register');
  $('authPass2Wrap').hidden = m !== 'register';
  $('authPass2').required = m === 'register';
  $('authPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('authSubmit').textContent = m === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  $('authMsg').textContent = '';
}

function enterApp() {
  if (entered) return;
  entered = true;
  $('authModal').hidden = true;
  renderHeader();
  renderPlayers();
  // Mở bằng link mời (?room=MÃ) thì vào thẳng phòng online (sau khi chọn trình độ)
  const go = () => {
    if (room) {
      setMode('online');
      Online.join(room);
    }
  };
  if (needsPlacement()) { afterPlace = go; openPlacement(); }
  else go();
  refreshAuto(); // contest đã đăng ký: hiện thông báo và tự ghép cặp khi tới giờ
}

// ---------------- Chọn trình độ lần đầu ----------------

let afterPlace = null;

function needsPlacement() { return Profile.signedIn() && !Profile.me().placed; }

function openPlacement() {
  const box = $('placeChoices');
  if (!box.children.length) {
    for (const lv of Profile.LEVELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'place-opt';
      btn.innerHTML = '<span class="po-main"><b></b><small></small></span><span class="po-elo"></span>';
      btn.querySelector('b').textContent = lv.name;
      btn.querySelector('small').textContent = lv.desc;
      btn.querySelector('.po-elo').textContent = lv.elo + ' Elo';
      btn.addEventListener('click', () => {
        Profile.place(lv.elo);
        $('placeModal').hidden = true;
        renderHeader();
        renderPlayers();
        const f = afterPlace;
        afterPlace = null;
        if (f) f();
      });
      box.appendChild(btn);
    }
  }
  $('placeModal').hidden = false;
}

$('authNote').textContent = Profile.remote
  ? ''
  : 'Chế độ cục bộ: tài khoản và bảng xếp hạng chỉ có trên trình duyệt này (bật bản toàn thế giới: xem README).';
$('authTabLogin').addEventListener('click', () => setAuthMode('login'));
$('authTabRegister').addEventListener('click', () => setAuthMode('register'));
$('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const user = $('authUser').value, pass = $('authPass').value;
  const msg = $('authMsg');
  msg.textContent = '';
  if (authMode === 'register' && pass !== $('authPass2').value) { msg.textContent = AUTH_ERRORS.MISMATCH; return; }
  $('authSubmit').disabled = true;
  try {
    if (authMode === 'login') await Profile.login(user, pass);
    else await Profile.register(user, pass);
    $('authPass').value = $('authPass2').value = '';
    enterApp();
  } catch (err) {
    msg.textContent = AUTH_ERRORS[err.message] || 'Có lỗi xảy ra, thử lại sau.';
  }
  $('authSubmit').disabled = false;
});

Profile.restore().then(ok => {
  if (ok) enterApp();
  else $('authUser').focus();
});

// ---------------- Bảng xếp hạng ----------------

async function openLeaderboard() {
  openModal('lbModal');
  $('lbNote').textContent = Profile.remote
    ? 'Toàn thế giới · xếp theo exp rank (chỉ ván Online) · cột Elo tính cả ván đấu máy'
    : 'Chỉ gồm tài khoản trên máy này · bảng toàn thế giới: xem README';
  const list = $('lbList');
  list.innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    const [rows, medals] = await Promise.all([Profile.leaderboard(), Contest.medals().catch(() => ({}))]);
    list.innerHTML = '';
    rows.forEach((p, i) => {
      const r = Profile.rankOf(p.exp);
      const row = document.createElement('div');
      row.className = 'rank-row' + (p.me ? ' me' : '');
      row.innerHTML = `<span class="rank-no">${i < 3 ? `<span class="podium p${i + 1}">${i + 1}</span>` : i + 1}</span>
        <span class="rank-name"><span class="avatar sm"></span><span class="nm"></span></span>
        <span class="rank-tier"></span>
        <span class="rank-elo">${p.exp}</span>
        <span class="rank-elo2">${p.elo}</span>
        <span class="wdl"><i class="w">${p.wins}</i> / ${p.draws} / <i class="l">${p.losses}</i></span>`;
      row.querySelector('.nm').textContent = p.name + (p.me ? ' (bạn)' : '');
      const won = Contest.count(medals[p.uid]);
      if (won.some(Boolean)) {
        const ms = document.createElement('span');
        ms.className = 'medals';
        won.forEach((n, k) => { if (n) ms.appendChild(medalEl(k + 1, n)); });
        row.querySelector('.rank-name').appendChild(ms);
      }
      const tier = row.querySelector('.rank-tier');
      tier.innerHTML = `${rankMedalOnly(r)}<span style="color:${r.color}">${r.text}</span>`;
      setAvatar(row.querySelector('.avatar'), { name: p.name, photo: p.photo, me: !!p.me }, 'w');
      list.appendChild(row);
    });
    if (!rows.length) list.innerHTML = '<p class="empty">Chưa có ai trên bảng. Chơi một ván Online để có tên ở đây!</p>';
  } catch (err) {
    list.innerHTML = '<p class="empty">Không tải được bảng xếp hạng. Kiểm tra mạng và cấu hình Firebase.</p>';
  }
}

// ---------------- Bảng quản trị (chỉ tài khoản ADMIN) ----------------

let adminRows = [];

async function openAdmin() {
  if (!Profile.isOwner()) return;
  openModal('adminModal');
  $('adminSearch').value = '';
  $('adminMsg').className = 'admin-msg';
  $('adminMsg').textContent = '';
  $('adminCount').textContent = '';
  $('adminNote').textContent = Profile.remote
    ? ''
    : 'Chế độ cục bộ: chỉ thấy tài khoản tạo trên trình duyệt này, người chơi ở máy khác sẽ không hiện ở đây (bật Firebase: xem README).';
  $('adminList').innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    const { rows, adminsDenied } = await Profile.listPlayers();
    adminRows = rows;
    renderAdminList();
    if (adminsDenied) {
      $('adminMsg').className = 'admin-msg err';
      $('adminMsg').textContent = 'Chưa đọc được danh sách admin: hãy dán luật Firebase mới (có mục "admins") rồi bấm Publish. Tới lúc đó nút cấp / thu hồi chưa hoạt động.';
    }
  } catch (err) {
    const why = err.message === 'NETWORK' ? 'Kiểm tra mạng Internet.'
      : err.message === 'DENIED' ? 'Máy chủ từ chối đọc, kiểm tra luật Firebase.'
      : err.message === 'SERVER' ? 'Kiểm tra lại databaseURL trong config.js.'
      : 'Kiểm tra mạng và cấu hình Firebase (xem README).';
    $('adminList').innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'empty';
    msg.textContent = `Không tải được danh sách (mã lỗi: ${err.message}). ${why}`;
    $('adminList').appendChild(msg);
  }
}

function renderAdminList() {
  const q = $('adminSearch').value.trim().toLowerCase();
  const rows = adminRows
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .sort((x, y) => (y.owner - x.owner) || (y.muted - x.muted) || (y.admin - x.admin) || x.name.localeCompare(y.name));
  const mutedN = adminRows.filter(p => p.muted).length;
  $('adminCount').textContent = `${adminRows.length} người chơi · ${adminRows.filter(p => p.owner || p.admin).length} admin · ${mutedN} bị mute chat`;
  const list = $('adminList');
  list.innerHTML = '';
  for (const p of rows) {
    const row = document.createElement('div');
    row.className = 'admin-row' + (p.me ? ' me' : '') + (p.muted ? ' muted-user' : '');
    row.innerHTML = '<span class="avatar sm"></span><span class="admin-name"><b></b><small></small></span><span class="role-badge" hidden></span><span class="mute-badge" hidden>Mute chat</span>';
    row.querySelector('b').textContent = p.name + (p.me ? ' (bạn)' : '');
    let sub = `${Profile.rankOf(p.exp).text} · ${p.elo} Elo`;
    if (p.muted && p.muteInfo) {
      const by = p.muteInfo.by ? ` · bởi ${p.muteInfo.by}` : '';
      sub += by;
    }
    row.querySelector('small').textContent = sub;
    setAvatar(row.querySelector('.avatar'), { name: p.name, photo: p.photo, me: !!p.me }, 'w');
    const badge = row.querySelector('.role-badge');
    badge.textContent = p.owner ? 'Chủ web' : 'Admin';
    badge.hidden = !(p.owner || p.admin);
    row.querySelector('.mute-badge').hidden = !p.muted;
    // Mute / bỏ mute (không mute chính mình và không mute chủ web)
    if (!p.me && !p.owner) {
      const muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = p.muted ? 'primary' : 'danger-outline';
      muteBtn.textContent = p.muted ? 'Bỏ mute' : 'Mute chat';
      muteBtn.title = p.muted ? 'Cho phép chat lại' : 'Tắt chat vì nói tục / spam';
      muteBtn.addEventListener('click', () => toggleMute(p, muteBtn));
      row.appendChild(muteBtn);
    }
    if (!p.owner) { // tài khoản ADMIN luôn là admin, không cần (và không thể) thu hồi
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = p.admin ? '' : 'primary';
      btn.textContent = p.admin ? 'Thu hồi' : 'Cấp admin';
      btn.addEventListener('click', () => toggleAdmin(p, btn));
      row.appendChild(btn);
    }
    list.appendChild(row);
  }
  if (!rows.length) list.innerHTML = '<p class="empty">Không có người chơi nào khớp.</p>';
  else if (adminRows.length <= 1 && !q) list.insertAdjacentHTML('beforeend', '<p class="empty">Mới chỉ có tài khoản ADMIN. Người khác cần đăng ký và vào web ít nhất một lần thì mới hiện ở đây.</p>');
}

async function toggleMute(p, btn) {
  const on = !p.muted;
  let reason = '';
  if (on) {
    const ans = prompt(`Mute chat của ${p.name}?\n(Tuỳ chọn) Lý do:`, 'Nói tục / spam trong chat');
    if (ans === null) return; // bấm Hủy
    reason = ans;
  } else {
    if (!confirm(`Bỏ mute chat cho ${p.name}?`)) return;
  }
  const msg = $('adminMsg');
  btn.disabled = true;
  msg.className = 'admin-msg';
  msg.textContent = '';
  try {
    await Profile.setMute(p.uid, on, reason || undefined);
    p.muted = on;
    p.muteInfo = on ? { by: Profile.me().name, at: Date.now(), reason: reason || '' } : null;
    msg.textContent = on ? `Đã mute chat của ${p.name}. Họ không gửi được tin nhắn trong ván online.` : `Đã bỏ mute chat cho ${p.name}.`;
  } catch (err) {
    msg.className = 'admin-msg err';
    msg.textContent = err.message === 'DENIED' ? 'Chỉ admin / chủ web mới mute được. Hãy dán luật Firebase mới (có mục "mutes") rồi Publish.'
      : err.message === 'NETWORK' ? AUTH_ERRORS.NETWORK
      : 'Có lỗi xảy ra, thử lại sau.';
  }
  renderAdminList();
}

async function toggleAdmin(p, btn) {
  const on = !p.admin;
  if (!confirm(on ? `Cấp quyền admin cho ${p.name}?` : `Thu hồi quyền admin của ${p.name}?`)) return;
  const msg = $('adminMsg');
  btn.disabled = true;
  msg.className = 'admin-msg';
  msg.textContent = '';
  try {
    await Profile.setAdmin(p.uid, on);
    p.admin = on;
    msg.textContent = on ? `Đã cấp quyền admin cho ${p.name}.` : `Đã thu hồi quyền admin của ${p.name}.`;
  } catch (err) {
    msg.className = 'admin-msg err';
    msg.textContent = err.message === 'DENIED' ? 'Máy chủ từ chối: hãy dán luật Firebase mới (có mục "admins") và bấm Publish.'
      : err.message === 'NETWORK' ? AUTH_ERRORS.NETWORK
      : 'Có lỗi xảy ra, thử lại sau.';
  }
  renderAdminList();
}

// ---------------- Contest ----------------
// Chỉ admin tạo / xóa được contest (giao diện ẩn với người khác, luật Firebase chặn ở máy chủ).
// Người chơi đăng ký trước giờ bắt đầu; đến giờ web tự ghép cặp (xem "Contest: tự ghép cặp" bên dưới).

let contestView = null;        // contest đang xem chi tiết
let contestScores = null;      // bảng điểm của contest đang xem (null = chưa tải được)
let contestPhase = '';         // pha đang hiển thị, để biết khi nào cần vẽ lại
let contestTimer = null;

const CONTEST_ERRORS = {
  NAME: 'Tên contest cần 3–60 ký tự.',
  TIME: 'Thời gian không hợp lệ (contest dài tối đa 7 ngày).',
  PAST: 'Giờ bắt đầu phải ở tương lai để mọi người kịp đăng ký.',
  DENIED: 'Máy chủ từ chối: chỉ admin mới tạo / xóa được contest. Nếu bạn là admin, hãy dán lại firebase-rules.json mới rồi bấm Publish (xem README).',
  ENDED: 'Contest đã kết thúc.',
  CLOSED: 'Contest đã bắt đầu nên đã đóng đăng ký.',
  NETWORK: AUTH_ERRORS.NETWORK,
};
const contestError = err => CONTEST_ERRORS[err.message] || 'Có lỗi xảy ra, thử lại sau.';
const PHASE_TEXT = { live: 'Đang diễn ra', upcoming: 'Mở đăng ký', ended: 'Đã kết thúc' };

const p2 = n => String(n).padStart(2, '0');
function fmtDate(t) {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
}
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m % 1440 === 0) return `${m / 1440} ngày`;
  if (m >= 120 && m % 60 === 0) return `${m / 60} giờ`;
  return `${m} phút`;
}
function fmtSpan(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d} ngày ${h} giờ`;
  return h ? `${h}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
}
function localInputValue(t) { // giá trị cho <input type="datetime-local"> theo giờ máy
  const d = new Date(t);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function setContestMsg(el, text, err) {
  el.className = 'admin-msg' + (err ? ' err' : '');
  el.textContent = text || '';
}

async function openContests() {
  openModal('contestModal');
  showContestList();
  $('contestNote').textContent = Profile.remote
    ? 'Đăng ký trước · đến giờ web tự ghép cặp · Thắng +2 · Hòa +1 · Thua 0 · Top 3 nhận huy chương'
    : 'Chế độ cục bộ: contest chỉ có trên trình duyệt này (bật bản toàn thế giới: xem README)';
  $('contestAdminBox').hidden = !Profile.isAdmin();
  $('contestPlain').textContent = Profile.isAdmin() ? '' : 'Chỉ admin mới tạo được contest.';
  Profile.refreshAdmin().then(() => {
    $('contestAdminBox').hidden = !Profile.isAdmin();
    $('contestPlain').textContent = Profile.isAdmin() ? '' : 'Chỉ admin mới tạo được contest.';
  });
  startContestClock();
  await loadContests();
}

function showContestList() {
  contestView = null;
  $('contestListView').hidden = false;
  $('contestDetailView').hidden = true;
}

async function loadContests() {
  const box = $('contestList');
  box.innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    const rows = await Contest.list();
    for (const c of rows) contestById.set(c.id, c);
    const regs = await Promise.all(rows.map(c => Contest.phase(c) === 'ended' ? false : Contest.registered(c).catch(() => false)));
    renderContestList(rows, new Set(rows.filter((c, i) => regs[i]).map(c => c.id)));
  } catch (err) {
    box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = `Không tải được danh sách contest (mã lỗi: ${err.message}). Kiểm tra mạng và luật Firebase (xem README).`;
    box.appendChild(p);
  }
}

function renderContestList(rows, mine) {
  const box = $('contestList');
  box.innerHTML = '';
  const groups = [
    ['live', rows.filter(c => Contest.phase(c) === 'live').sort((a, b) => a.end - b.end)],
    ['upcoming', rows.filter(c => Contest.phase(c) === 'upcoming').sort((a, b) => a.start - b.start)],
    ['ended', rows.filter(c => Contest.phase(c) === 'ended').sort((a, b) => b.end - a.end).slice(0, 15)],
  ];
  for (const [ph, items] of groups) {
    if (!items.length) continue;
    const h = document.createElement('div');
    h.className = 'contest-group';
    h.textContent = ph === 'upcoming' ? 'Sắp diễn ra' : PHASE_TEXT[ph];
    box.appendChild(h);
    for (const c of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'contest-item ' + ph;
      btn.innerHTML = '<span class="ci-main"><b></b><small></small></span><span class="ci-badge"></span>';
      btn.querySelector('b').textContent = c.name;
      btn.querySelector('small').textContent = `${fmtDate(c.start)} · ${fmtDuration(c.end - c.start)}` + (c.byName ? ` · tạo bởi ${c.byName}` : '');
      btn.querySelector('.ci-badge').textContent = mine.has(c.id) ? 'Đã đăng ký ✓' : PHASE_TEXT[ph];
      if (mine.has(c.id)) btn.classList.add('joined');
      btn.addEventListener('click', () => openContestDetail(c.id));
      box.appendChild(btn);
    }
  }
  if (!rows.length) box.innerHTML = '<p class="empty">Chưa có contest nào.' + (Profile.isAdmin() ? ' Hãy bấm "Tạo contest" ở trên.' : '') + '</p>';
}

// ----- Chi tiết một contest -----

async function openContestDetail(id) {
  const c = contestById.get(id);
  if (!c) return;
  contestView = c;
  contestScores = null;
  $('contestListView').hidden = true;
  $('contestDetailView').hidden = false;
  setContestMsg($('contestMsg'), '');
  $('cdName').textContent = c.name;
  $('cdDesc').textContent = c.desc;
  $('cdTime').textContent = `${fmtDate(c.start)} → ${fmtDate(c.end)} · ${fmtDuration(c.end - c.start)}`;
  contestPhase = '';
  updateContestClock();
  $('contestBoard').innerHTML = '<p class="empty">Đang tải…</p>';
  await loadContestScores();
}

async function loadContestScores() {
  const c = contestView;
  if (!c) return;
  let rows = null;
  try {
    const [list, photos] = await Promise.all([Contest.scores(c.id), Profile.photos().catch(() => ({}))]);
    rows = list.map(p => ({ ...p, photo: p.me && Profile.me().photo ? Profile.me().photo : (photos[p.uid] || '') }));
  } catch {}
  if (contestView !== c) return; // người dùng đã chuyển sang màn khác
  contestScores = rows;
  renderContestBoard();
  renderContestActions();
}

function renderContestBoard() {
  const box = $('contestBoard');
  box.innerHTML = '';
  if (contestScores === null) { box.innerHTML = '<p class="empty">Không tải được bảng điểm. Kiểm tra mạng và luật Firebase.</p>'; return; }
  if (!contestScores.length) {
    box.innerHTML = `<p class="empty">${Contest.phase(contestView) === 'upcoming' ? 'Chưa có ai đăng ký. Hãy là người đầu tiên!' : 'Không có ai đăng ký contest này.'}</p>`;
    return;
  }
  const final = Contest.isFinal(contestView);
  for (const p of contestScores) {
    const row = document.createElement('div');
    row.className = 'contest-row' + (p.me ? ' me' : '');
    row.innerHTML = `<span class="rank-no"></span>
      <span class="rank-name"><span class="avatar sm"></span><span class="nm"></span></span>
      <span class="pts">${p.pts}</span>
      <span>${p.games}</span>
      <span class="wdl"><i class="w">${p.wins}</i> / ${p.draws} / <i class="l">${p.losses}</i></span>`;
    const no = row.querySelector('.rank-no');
    if (p.medal) no.appendChild(medalEl(p.medal)); else no.textContent = p.place;
    row.querySelector('.nm').textContent = p.name + (p.me ? ' (bạn)' : '');
    setAvatar(row.querySelector('.avatar'), { name: p.name, photo: p.photo, me: !!p.me }, 'w');
    box.appendChild(row);
  }
  if (final) {
    const me = contestScores.find(r => r.me);
    if (me) {
      const note = document.createElement('p');
      note.className = 'empty';
      note.textContent = me.medal ? `Chúc mừng! Bạn giành huy chương ${MEDAL_NAME[me.medal]} (hạng ${me.place}) – xem trong Hồ sơ.`
        : `Bạn xếp hạng ${me.place}/${contestScores.length}.`;
      box.prepend(note);
    }
  }
}

function renderContestActions() {
  const c = contestView;
  const box = $('contestActions');
  box.innerHTML = '';
  if (!c) return;
  const ph = Contest.phase(c);
  const joined = !!(contestScores && contestScores.some(r => r.me));
  const add = (text, cls, fn, disabled) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.disabled = !!disabled;
    b.addEventListener('click', () => fn(b));
    box.appendChild(b);
    return b;
  };
  const note = text => box.insertAdjacentHTML('beforeend', `<p class="muted center">${text}</p>`);
  if (ph === 'upcoming') {
    if (joined) {
      add('Đã đăng ký ✓', 'big', () => {}, true);
      add('Hủy đăng ký', 'ghost', contestUnregister);
      note('Đến giờ bắt đầu, web sẽ tự ghép cặp bạn với những người đã đăng ký. Chỉ cần mở web lúc đó.');
    } else {
      add('Đăng ký tham gia', 'primary big', contestRegister);
      note('Đăng ký đóng khi contest bắt đầu.');
    }
  } else if (ph === 'live') {
    if (joined) {
      const busy = Auto.running === c.id && !Auto.paused.has(c.id) && mode === 'online' && !Online.idle();
      if (busy) add(Online.searching() ? 'Đang tự ghép cặp…' : 'Đang thi đấu', 'big', () => {}, true);
      else add(Auto.paused.has(c.id) ? 'Tiếp tục thi đấu' : 'Vào thi đấu ngay', 'primary big', contestPlay);
      note('Web tự ghép cặp bạn với người đã đăng ký đang mở web; xong ván sẽ tự tìm ván tiếp.');
    } else {
      add('Đăng ký đã đóng', 'big', () => {}, true);
      note('Contest đã bắt đầu, chỉ người đăng ký trước mới được thi đấu.');
    }
  }
  if (Profile.isAdmin()) add('Xóa contest', 'ghost', contestDelete);
}

// Đồng hồ: đếm ngược tới giờ bắt đầu / kết thúc, tự làm mới bảng điểm, tự đổi nút khi đổi pha
function updateContestClock() {
  const c = contestView;
  if (!c) return;
  const ph = Contest.phase(c), now = Date.now();
  $('cdClock').textContent = ph === 'live' ? `Còn ${fmtSpan(c.end - now)}`
    : ph === 'upcoming' ? `Bắt đầu sau ${fmtSpan(c.start - now)}`
    : Contest.isFinal(c) ? 'Đã kết thúc · kết quả chung cuộc' : 'Đã kết thúc · đang chờ các ván cuối';
  const key = ph + Contest.isFinal(c);
  if (key !== contestPhase) {
    contestPhase = key;
    renderContestActions();
    if (contestScores) renderContestBoard();
  }
}

function startContestClock() {
  clearInterval(contestTimer);
  let n = 0;
  contestTimer = setInterval(() => {
    if ($('contestModal').hidden) { clearInterval(contestTimer); return; }
    if (!contestView) return;
    updateContestClock();
    if (++n % 15 === 0 && Contest.phase(contestView) !== 'upcoming') loadContestScores();
  }, 1000);
}

async function contestRegister(btn) {
  const c = contestView;
  btn.disabled = true;
  setContestMsg($('contestMsg'), '');
  try {
    await Contest.join(c);
    setContestMsg($('contestMsg'), `Đã đăng ký! Contest bắt đầu lúc ${fmtDate(c.start)}, web sẽ tự ghép cặp cho bạn.`);
    if (!Auto.mine.some(x => x.id === c.id)) Auto.mine.push(c);
    await loadContestScores();
  } catch (err) {
    setContestMsg($('contestMsg'), contestError(err), true);
    btn.disabled = false;
  }
}

async function contestUnregister(btn) {
  const c = contestView;
  if (!confirm(`Hủy đăng ký contest "${c.name}"?`)) return;
  btn.disabled = true;
  try {
    await Contest.unjoin(c);
    Auto.mine = Auto.mine.filter(x => x.id !== c.id);
    setContestMsg($('contestMsg'), 'Đã hủy đăng ký.');
    await loadContestScores();
  } catch (err) {
    setContestMsg($('contestMsg'), contestError(err), true);
    btn.disabled = false;
  }
}

// Vào thi đấu ngay (hoặc tiếp tục sau khi đã tạm dừng tự ghép)
function contestPlay() {
  const c = contestView;
  if (mode === 'online' && !Online.idle() && Online.contest() !== c.id) {
    setContestMsg($('contestMsg'), 'Bạn đang trong phòng hoặc ván Online khác. Hãy rời phòng trước.', true);
    return;
  }
  if (!Auto.mine.some(x => x.id === c.id)) Auto.mine.push(c);
  Auto.paused.delete(c.id);
  Auto.retryAt = 0;
  $('contestModal').hidden = true;
  autoStart(c, true);
}

async function contestDelete(btn) {
  const c = contestView;
  if (!confirm(`Xóa contest "${c.name}" cùng toàn bộ bảng điểm?`)) return;
  btn.disabled = true;
  try {
    await Contest.remove(c.id);
    contestById.delete(c.id);
    Auto.mine = Auto.mine.filter(x => x.id !== c.id);
    showContestList();
    setContestMsg($('contestAdminMsg'), `Đã xóa contest "${c.name}".`);
    await loadContests();
  } catch (err) {
    setContestMsg($('contestMsg'), contestError(err), true);
    btn.disabled = false;
  }
}

// ----- Tạo contest (chỉ admin) -----

$('contestNewBtn').addEventListener('click', () => {
  if (!Profile.isAdmin()) return;
  const t = new Date(Date.now() + 3600000);
  t.setMinutes(0, 0, 0); // mặc định: đầu giờ kế tiếp, cho mọi người thời gian đăng ký
  $('cStart').value = localInputValue(t.getTime() + 3600000);
  setContestMsg($('contestAdminMsg'), '');
  $('contestForm').hidden = false;
  $('cName').focus();
});
$('cCancel').addEventListener('click', () => { $('contestForm').hidden = true; });
$('contestForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('contestAdminMsg');
  if (!Profile.isAdmin()) { setContestMsg(msg, CONTEST_ERRORS.DENIED, true); return; }
  const start = new Date($('cStart').value).getTime();
  const end = start + Number($('cDur').value) * 60000;
  $('cSubmit').disabled = true;
  try {
    await Contest.create({ name: $('cName').value, desc: $('cDesc').value, start, end });
    $('contestForm').hidden = true;
    $('contestForm').reset();
    setContestMsg(msg, 'Đã tạo contest! Người chơi có thể đăng ký tới giờ bắt đầu.');
    await loadContests();
  } catch (err) {
    setContestMsg(msg, contestError(err), true);
  }
  $('cSubmit').disabled = false;
});

$('contestBack').addEventListener('click', () => { showContestList(); loadContests(); });
$('contestRefresh').addEventListener('click', () => { if (contestView) loadContestScores(); else loadContests(); });

// ---------------- Contest: tự ghép cặp ----------------
// Không có máy chủ riêng nên việc ghép chạy trên trình duyệt của từng người đã đăng ký:
// đến giờ contest, web tự chuyển sang Online và vào phòng chờ riêng của contest đó (xem online.js),
// ván xong thì sau AUTO_NEXT tự tìm ván tiếp. Không cắt ngang ván đang chơi với máy / bài học đang dở:
// đợi xong mới ghép. Hủy tìm trận, rời phòng hoặc rời tab Online thì tạm dừng tự ghép (bấm Tiếp tục để chơi lại).

const MEDAL_SEEN_KEY = 'rg-medal-seen';

async function refreshAuto() {
  if (!Profile.signedIn()) return;
  try {
    const rows = await Contest.list();
    for (const c of rows) contestById.set(c.id, c);
    const open = rows.filter(c => Contest.phase(c) !== 'ended');
    const regs = await Promise.all(open.map(c => Contest.registered(c, true).catch(() => Auto.mine.some(x => x.id === c.id))));
    Auto.mine = open.filter((c, i) => regs[i]);
    if (rows.some(c => Contest.isFinal(c) && Date.now() - c.end < 3 * 86400000)) checkNewMedals();
  } catch {}
  autoTick();
}

// Báo khi vừa giành huy chương (mỗi huy chương báo một lần)
async function checkNewMedals() {
  let list;
  try { list = (await Contest.medals())[Profile.uid()] || []; } catch { return; }
  const key = MEDAL_SEEN_KEY + ':' + Profile.uid();
  let seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(key)) || []); } catch { seen = new Set(); }
  const fresh = list.filter(m => !seen.has(m.id) && Date.now() - m.end < 3 * 86400000);
  for (const m of list) seen.add(m.id);
  try { localStorage.setItem(key, JSON.stringify([...seen])); } catch {}
  if (fresh.length) {
    const m = fresh[0];
    toast(`Chúc mừng! Bạn giành huy chương ${MEDAL_NAME[m.place]} ở contest "${m.name}"`, m.place);
  }
}

function toast(text, medal) {
  const el = $('toast');
  el.innerHTML = '';
  if (medal) el.appendChild(medalEl(medal));
  el.appendChild(document.createTextNode(text));
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 7000);
}

// Đang làm dở việc khác (ván với máy, ván 2 người, bài học) thì chưa tự chuyển sang contest
function autoCanStart() {
  if (!$('promo').hidden || !$('placeModal').hidden || !$('authModal').hidden) return false;
  if (mode === 'online') return Online.idle();
  if (mode === 'learn') return !Learn.inLesson();
  return !game.history.length || game.isGameOver() || !!playResult;
}

function autoStart(c, manual = false) {
  Auto.running = c.id;
  Auto.doneAt = 0;
  if (mode === 'online' && !Online.idle()) {
    quietResult = true;
    Online.leave(); // chỉ gọi khi ván trước đã xong nên không bị tính thua
    quietResult = false;
  }
  if (mode !== 'online') {
    setMode('online');
    if (mode !== 'online') { if (!manual) Auto.paused.add(c.id); return; } // người chơi không muốn bỏ ván đang dở
    Auto.paused.delete(c.id);
  }
  $('resultModal').hidden = true;
  Online.findMatch({ id: c.id, end: c.end });
  autoBanner();
}

// Bấm "Ván contest tiếp theo" trong hộp kết quả
function autoNow() {
  const c = contestById.get(Online.contest());
  if (c && Contest.phase(c) === 'live') { Auto.paused.delete(c.id); autoStart(c, true); }
}

function liveAuto(now = Date.now()) {
  const live = Auto.mine.filter(c => Contest.phase(c, now) === 'live').sort((a, b) => a.end - b.end);
  return live.find(c => !Auto.paused.has(c.id)) || live[0] || null;
}

function autoTick() {
  autoBanner();
  if (!entered) return;
  const now = Date.now();
  const c = liveAuto(now);
  if (!c || Auto.paused.has(c.id)) return;
  if (mode === 'online' && Online.contest() === c.id) {
    // Ván contest đã xong (hoặc đối thủ bỏ đi): đợi một chút rồi tự tìm ván tiếp
    if (!Online.outcome() && Online.connected()) return;
    if (!Auto.doneAt) Auto.doneAt = now;
    if (now - Auto.doneAt >= AUTO_NEXT) autoStart(c);
    return;
  }
  if (mode === 'online' && Online.searchContest() === c.id) return;
  if (now < Auto.retryAt || !autoCanStart()) return;
  autoStart(c);
}

Online.onFail((code, ct) => {
  if (!ct) return;
  if (code === 'self') Auto.paused.add(ct);
  else if (code !== 'ended') Auto.retryAt = Date.now() + 15000; // lỗi mạng: thử lại sau 15 giây
});
// Người chơi tự hủy tìm / rời phòng: tạm dừng tự ghép contest đó
for (const id of ['cancelSearch', 'leaveRoom']) {
  $(id).addEventListener('click', () => { if (Auto.running && Online.idle()) Auto.paused.add(Auto.running); autoBanner(); });
}

// Thanh thông báo contest dưới thanh trên cùng
function autoBanner() {
  const el = $('contestBanner');
  const now = Date.now();
  const c = liveAuto(now);
  const soon = Auto.mine.filter(x => Contest.phase(x, now) === 'upcoming' && x.start - now < 86400000).sort((a, b) => a.start - b.start)[0];
  if (!entered || (!c && !soon)) { el.hidden = true; return; }
  el.hidden = false;
  let text, action = null, cls = 'live';
  if (c) {
    const left = `còn ${fmtSpan(c.end - now)}`;
    if (Auto.paused.has(c.id)) {
      text = `${c.name} đang diễn ra (${left}) · bạn đã tạm dừng tự ghép cặp`;
      action = ['Tiếp tục thi đấu', 'resume'];
      cls = 'paused';
    } else if (mode === 'online' && Online.contest() === c.id && (Online.outcome() || !Online.connected())) {
      text = `${c.name} · ván tiếp theo sau ${Math.max(0, Math.ceil((AUTO_NEXT - (now - (Auto.doneAt || now))) / 1000))} giây`;
      action = ['Tạm dừng', 'pause'];
    } else if (mode === 'online' && Online.contest() === c.id) {
      text = `${c.name} · đang thi đấu (${left})`;
    } else if (mode === 'online' && Online.searchContest() === c.id) {
      text = `${c.name} · đang tự ghép cặp với người đã đăng ký… (${left})`;
      action = ['Tạm dừng', 'pause'];
    } else {
      text = `${c.name} đang diễn ra (${left}) · web sẽ tự ghép cặp khi bạn xong việc đang làm`;
      action = ['Vào thi đấu ngay', 'resume'];
    }
  } else {
    text = `${soon.name} bắt đầu sau ${fmtSpan(soon.start - now)} · bạn đã đăng ký, đến giờ web sẽ tự ghép cặp`;
    cls = 'soon';
  }
  el.className = 'contest-banner ' + cls;
  $('cbText').textContent = text;
  const btn = $('cbAction');
  btn.hidden = !action;
  if (action) { btn.textContent = action[0]; btn.dataset.act = action[1]; }
  el.dataset.id = (c || soon).id;
}

$('cbAction').addEventListener('click', () => {
  const c = contestById.get($('contestBanner').dataset.id);
  if (!c) return;
  if ($('cbAction').dataset.act === 'pause') {
    Auto.paused.add(c.id);
    if (mode === 'online' && Online.searchContest() === c.id) Online.leave();
  } else {
    Auto.paused.delete(c.id);
    Auto.retryAt = 0;
    if (mode === 'online' && !Online.idle() && Online.contest() !== c.id) {
      toast('Bạn đang trong phòng Online khác, hãy rời phòng trước.');
    } else autoStart(c, true);
  }
  autoBanner();
});
$('cbOpen').addEventListener('click', async () => {
  const id = $('contestBanner').dataset.id;
  await openContests();
  if (contestById.has(id)) openContestDetail(id);
});

setInterval(autoTick, 1000);
setInterval(refreshAuto, 60000);
