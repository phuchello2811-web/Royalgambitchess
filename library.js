// Thư viện khai cuộc & gambit: danh sách, minh họa FEN, thử trên bàn / với máy.

const OPENINGS = [
  {
    id: 'kings-gambit',
    name: "King's Gambit",
    nameVi: 'Gambit Vua',
    cat: 'gambit',
    moves: '1.e4 e5 2.f4',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2',
    desc: 'Trắng hy sinh tốt f để mở đường Tượng và Xe, tấn công mạnh về phía vua Đen. Rất táo bạo, phổ biến ở thế kỷ 19.',
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    nameVi: 'Gambit Hậu',
    cat: 'gambit',
    moves: '1.d4 d5 2.c4',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2',
    desc: 'Trắng thí tốt c để chiếm trung tâm. Đen có thể nhận (Accepted) hoặc từ chối (Declined). Khai cuộc nền tảng của cờ hiện đại.',
  },
  {
    id: 'evans-gambit',
    name: 'Evans Gambit',
    nameVi: 'Gambit Evans',
    cat: 'gambit',
    moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 4',
    desc: 'Từ Italian Game, Trắng thí tốt b để mở đường và phát triển nhanh. Tấn công sắc bén, hay gặp ở cờ nhanh.',
  },
  {
    id: 'danish-gambit',
    name: 'Danish Gambit',
    nameVi: 'Gambit Đan Mạch',
    cat: 'gambit',
    moves: '1.e4 e5 2.d4 exd4 3.c3',
    fen: 'rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq - 0 3',
    desc: 'Trắng thí 1–2 tốt để có lợi thế phát triển và đường mở cho Tượng. Đòi hỏi Đen phòng thủ chính xác.',
  },
  {
    id: 'italian',
    name: 'Italian Game',
    nameVi: 'Khai cuộc Ý',
    cat: 'open',
    moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    desc: 'Một trong những khai cuộc cổ nhất. Trắng nhắm f7, phát triển êm. Có thể thành Giuoco Piano hoặc gambit sắc hơn.',
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    nameVi: 'Tây Ban Nha (Ruy Lopez)',
    cat: 'open',
    moves: '1.e4 e5 2.Nf3 Nc6 3.Bb5',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    desc: 'Khai cuộc “vua” của 1.e4. Trắng gây áp lực lên ngựa c6 và trung tâm. Rất phong phú về lý thuyết.',
  },
  {
    id: 'scotch',
    name: 'Scotch Game',
    nameVi: 'Khai cuộc Scotland',
    cat: 'open',
    moves: '1.e4 e5 2.Nf3 Nc6 3.d4',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3',
    desc: 'Trắng mở trung tâm sớm bằng d4. Thế cờ cởi mở, dễ hiểu, phù hợp người mới lẫn cao cấp.',
  },
  {
    id: 'sicilian',
    name: 'Sicilian Defense',
    nameVi: 'Phòng thủ Sicily',
    cat: 'semi',
    moves: '1.e4 c5',
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
    desc: 'Đáp ứng phổ biến nhất với 1.e4. Đen đánh tranh trung tâm không đối xứng, thường dẫn tới ván căng và quyết liệt.',
  },
  {
    id: 'french',
    name: 'French Defense',
    nameVi: 'Phòng thủ Pháp',
    cat: 'semi',
    moves: '1.e4 e6',
    fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    desc: 'Đen chuẩn bị d5 vững chắc. Thế cờ nửa đóng, nhiều chiến thuật quanh chuỗi tốt trung tâm.',
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann',
    nameVi: 'Caro-Kann',
    cat: 'semi',
    moves: '1.e4 c6',
    fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    desc: 'Đen chuẩn bị d5 với cấu trúc tốt chắc. Ít rủi ro hơn Pháp, hay được chọn ở cấp cao.',
  },
  {
    id: 'london',
    name: 'London System',
    nameVi: 'Hệ London',
    cat: 'semi',
    moves: '1.d4 d5 2.Nf3 Nf6 3.Bf4',
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 3 3',
    desc: 'Hệ thống vững, dễ học cho Trắng. Ít lý thuyết dài, tập trung kế hoạch trung kỳ rõ ràng.',
  },
  {
    id: 'kings-indian',
    name: "King's Indian Defense",
    nameVi: 'Phòng thủ Ấn Độ Vua',
    cat: 'semi',
    moves: '1.d4 Nf6 2.c4 g6',
    fen: 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
    desc: 'Đen cho Trắng chiếm trung tâm rồi phản công. Phong cách năng động, nhiều hy sinh và tấn công vua.',
  },
];

const ENDGAMES = [
  {
    id: 'kq-k',
    name: 'King + Queen vs King',
    nameVi: 'Vua + Hậu vs Vua',
    cat: 'endgame',
    moves: 'Chiếu hết cơ bản',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    desc: 'Tàn cuộc cơ bản nhất. Đưa vua đối phương về mép bàn, Hậu cắt đường rồi vua hỗ trợ chiếu hết. Tránh pat.',
  },
  {
    id: 'kr-k',
    name: 'King + Rook vs King',
    nameVi: 'Vua + Xe vs Vua',
    cat: 'endgame',
    moves: 'Chiếu hết bằng Xe',
    fen: '8/8/8/4k3/8/8/8/3RK3 w - - 0 1',
    desc: 'Dùng Xe đẩy vua đối phương về hàng cuối, vua mình hỗ trợ. Kỹ thuật “hộp” và đối mặt vua rất quan trọng.',
  },
  {
    id: 'krr-k',
    name: 'Two Rooks Mate',
    nameVi: 'Hai Xe chiếu hết',
    cat: 'endgame',
    moves: 'Xe bậc thang',
    fen: '8/8/8/4k3/8/8/8/R3K2R w KQ - 0 1',
    desc: 'Hai Xe chiếu hết kiểu “bậc thang” (ladder mate) mà không cần vua. Đơn giản và rất hay gặp.',
  },
  {
    id: 'opp-bishops',
    name: 'Opposite Bishops',
    nameVi: 'Tượng khác màu',
    cat: 'endgame',
    moves: 'Hòa lý thuyết',
    fen: '8/3k4/8/3b4/8/3B4/3K4/8 w - - 0 1',
    desc: 'Tượng đi ô khác màu thường dẫn tới hòa nếu không còn tốt. Khó thắng dù hơn tốt khi tượng đối phương kiểm soát ô khác.',
  },
  {
    id: 'same-bishops',
    name: 'Same-Color Bishops',
    nameVi: 'Tượng cùng màu',
    cat: 'endgame',
    moves: 'Tàn cuộc tượng',
    fen: '8/3k4/3b4/8/3B4/8/3K4/8 w - - 0 1',
    desc: 'Tượng cùng màu: bên hơn tốt có cơ hội thắng nếu đưa vua vào và tạo tốt thông.',
  },
  {
    id: 'knight-bishop-mate',
    name: 'Bishop + Knight Mate',
    nameVi: 'Tượng + Mã vs Vua',
    cat: 'endgame',
    moves: 'Chiếu hết khó',
    fen: '8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1',
    desc: 'Chiếu hết bằng Tượng + Mã là kỹ thuật khó nhất trong tàn cuộc cơ bản. Đưa vua về góc cùng màu với Tượng.',
  },
  {
    id: 'pawn-race',
    name: 'Pawn Race',
    nameVi: 'Đua tốt',
    cat: 'endgame',
    moves: 'Tốt thông',
    fen: '8/5k2/8/8/8/8/4P1K1/8 w - - 0 1',
    desc: 'Tàn cuộc vua + tốt. Học quy tắc ô chìa khóa, đối mặt vua, và khi nào tốt đi hậu được.',
  },
  {
    id: 'lucena',
    name: 'Lucena Position',
    nameVi: 'Thế Lucena',
    cat: 'endgame',
    moves: 'Xe + tốt vs Xe',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    desc: 'Thế Lucena kinh điển: bên có tốt gần phong cấp xây “cầu” bằng Xe để vua thoát và đẩy tốt thành Hậu.',
  },
  {
    id: 'philidor',
    name: 'Philidor Position',
    nameVi: 'Thế Philidor',
    cat: 'endgame',
    moves: 'Phòng thủ Xe',
    fen: '3k4/8/3K4/3P4/8/8/8/2r5 b - - 0 1',
    desc: 'Thế Philidor: bên yếu dùng Xe giữ hàng 3 (hoặc 6) để cầm hòa trước vua + Xe + tốt của đối phương.',
  },
  {
    id: 'kpk-opposition',
    name: 'Opposition',
    nameVi: 'Đối mặt vua (Opposition)',
    cat: 'endgame',
    moves: 'Vua + tốt',
    fen: '8/3k4/8/3P4/8/8/3K4/8 w - - 0 1',
    desc: 'Ai chiếm được đối mặt vua thường kiểm soát ô chìa khóa. Nền tảng của mọi tàn cuộc tốt.',
  },
  {
    id: 'rook-pawn',
    name: 'Rook Pawn',
    nameVi: 'Tốt biên',
    cat: 'endgame',
    moves: 'Tốt cột a/h',
    fen: '8/8/8/8/8/k7/P7/K7 w - - 0 1',
    desc: 'Tốt biên khó thắng hơn tốt giữa. Vua yếu chỉ cần chiếm góc phong cấp là thường hòa.',
  },
  {
    id: 'queen-vs-pawn',
    name: 'Queen vs Pawn',
    nameVi: 'Hậu vs Tốt',
    cat: 'endgame',
    moves: 'Cản tốt phong cấp',
    fen: '8/3P4/8/8/8/8/8/3K1k1Q w - - 0 1',
    desc: 'Hậu thắng tốt sắp phong cấp hầu hết trường hợp, trừ tốt biên hoặc tốt mã ở hàng 7 với vua hỗ trợ — cần kỹ thuật chính xác.',
  },
];


const Library = (() => {
  let filter = 'all';
  let current = null;

  function fenBoard(fen) {
    const rows = (fen || '').split(/\s+/)[0].split('/');
    if (rows.length !== 8) return '';
    let html = '';
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (/\d/.test(ch)) {
          for (let k = 0; k < Number(ch); k++) {
            const dark = (r + c) % 2;
            html += `<span class="lb-sq ${dark ? 'd' : 'l'}"></span>`;
            c++;
          }
        } else {
          const dark = (r + c) % 2;
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          const type = ch.toUpperCase();
          html += `<span class="lb-sq ${dark ? 'd' : 'l'}"><img src="pieces/${color}${type}.svg" alt=""></span>`;
          c++;
        }
      }
    }
    return html;
  }

  function card(o) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'lib-card';
    el.dataset.id = o.id;
    el.innerHTML = `
      <div class="lib-card-board">${fenBoard(o.fen)}</div>
      <div class="lib-card-meta">
        <b>${o.nameVi}</b>
        <small>${o.name}</small>
        <span class="lib-tag ${o.cat}">${o.cat === 'gambit' ? 'Gambit' : o.cat === 'open' ? 'Mở' : o.cat === 'endgame' ? 'Tàn cuộc' : 'Nửa mở'}</span>
      </div>`;
    el.addEventListener('click', () => showDetail(o));
    return el;
  }

  function renderGrid() {
    const grid = $('libGrid');
    const detail = $('libDetail');
    if (!grid) return;
    grid.hidden = false;
    if (detail) detail.hidden = true;
    grid.innerHTML = '';
    const list = OPENINGS.concat(ENDGAMES);
    list.filter(o => filter === 'all' || o.cat === filter).forEach(o => grid.appendChild(card(o)));
  }

  function showDetail(o) {
    current = o;
    const grid = $('libGrid');
    const detail = $('libDetail');
    if (grid) grid.hidden = true;
    if (detail) detail.hidden = false;
    $('libBoard').innerHTML = fenBoard(o.fen);
    $('libName').textContent = `${o.nameVi} · ${o.name}`;
    $('libMoves').textContent = o.moves;
    $('libDesc').textContent = o.desc;
  }

  function enterPlayWithFen(o, vsBot) {
    $('libModal').hidden = true;
    // Xác định bên tới lượt từ FEN
    const turn = (o.fen.split(/\s+/)[1] || 'w') === 'b' ? 'b' : 'w';
    if (vsBot) {
      // Người cầm bên đang tới lượt, máy cầm bên còn lại
      const bot = turn === 'w' ? 'b' : 'w';
      if ($('mode')) $('mode').value = bot;
    } else {
      if ($('mode')) $('mode').value = 'none';
    }
    if (mode !== 'play') setMode('play');
    else {
      if (!abandonBotGame()) return;
      newGame();
    }
    try { game.load(o.fen); } catch { game.reset(); }
    viewPly = null;
    clearSelection();
    hint = null;
    marks.clear();
    playResult = null;
    if (vsBot) {
      aiColor = turn === 'w' ? 'b' : 'w';
      flipped = turn === 'b';
      gameLevel = Number(($('level') && $('level').value) || 2);
      startRatedGame();
    } else {
      aiColor = 'none';
      flipped = false;
      ratedDone = true;
    }
    renderRatedNote();
    render();
    if (vsBot) maybeAiMove();
    if (typeof toast === 'function') toast(vsBot ? `Thử ${o.nameVi} với máy` : `Đã đặt: ${o.nameVi}`);
  }

  function setupOnBoard(o) { enterPlayWithFen(o, false); }
  function tryVsBot(o) { enterPlayWithFen(o, true); }

  function open() {
    filter = 'all';
    document.querySelectorAll('.lib-filter').forEach(b => b.classList.toggle('on', b.dataset.cat === 'all'));
    renderGrid();
    openModal('libModal');
  }

  function bind() {
    document.querySelectorAll('.lib-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.cat;
        document.querySelectorAll('.lib-filter').forEach(b => b.classList.toggle('on', b === btn));
        renderGrid();
      });
    });
    const back = $('libBack');
    if (back) back.addEventListener('click', () => { current = null; renderGrid(); });
    const tryBtn = $('libTry');
    if (tryBtn) tryBtn.addEventListener('click', () => current && tryVsBot(current));
    const setupBtn = $('libSetup');
    if (setupBtn) setupBtn.addEventListener('click', () => current && setupOnBoard(current));
  }

  return { open, bind, OPENINGS, ENDGAMES };
})();
