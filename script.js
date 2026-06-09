/* ─────────────────────────────────────────────────────────────
   SLAGALICA — game logic
   ───────────────────────────────────────────────────────────── */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const targetEl  = $('target');
  const targetNum = $('target-num');
  const kicker    = $('kicker-text');
  const vtime     = $('vtime');
  const vfillBar  = $('vfill-bar');
  const materials = $('materials');
  const expr      = $('expr');
  const exprLive  = $('expr-live');
  const exprUsed  = $('expr-used');
  const equation  = $('equation');
  const overlay   = $('overlay');
  const oExpr     = $('o-expr');
  const oSolution = $('o-solution');
  const oEval     = $('o-eval');
  const oTarget   = $('o-target');
  const oDelta    = $('o-delta');
  const oScore    = $('o-score');
  const help      = $('help');
  const metaScore = $('meta-score');
  const diffBtn   = $('difficulty-btn');
  const diffVal   = $('difficulty-value');
  const practBtn  = $('practice-btn');
  const practVal  = $('practice-value');
  const seedDisplay = $('seed-display');
  const seedRow    = $('seed-row');
  const seedClearTop = $('seed-clear-top');
  const roundRow   = $('round-row');
  const roundClearTop = $('round-clear-top');
  const seedCard    = $('seed-card');
  const seedCardInput  = $('seed-card-input');
  const seedCardRandom = $('seed-card-random');
  const seedCardClear  = $('seed-card-clear');
  const seedCardApply  = $('seed-card-apply');
  const seedCardShare  = $('seed-card-share');
  const stats      = $('stats');
  const statsResetBtn = $('stats-reset-btn');
  const metaRound  = $('meta-round');
  const wordmarkDot = document.querySelector('.wordmark__dot');
  const targetHint  = $('target-hint');
  const overlayDismiss = $('overlay-dismiss');
  const overlayReplay  = $('overlay-replay');

  // ─── timing & limits ───────────────────────────────────────
  // Roll/tick/lock cadences. Grouped here so the rhythm of the round
  // (roll speed, lock beat, target reveal) is tuneable in one place.
  const TIMING = {
    rollTickMs:     55,    // interval for material/target roll animation
    timerTickMs:  1000,    // countdown interval (1s per tick)
    lockBeatMs:    350,    // pause after a lock for the stamp animation
    materialGapMs: 200,    // pause after the last material before the target roll
    seedSettleMs:  500,    // seeded-path settle before the clock starts
    restartMs:     120,    // brief beat between reset and the next beginGame
    flashMs:       900,    // how long the bad-Enter kicker nudge stays
    flashDrainMs:  300,    // destructive-action flash before dots clear
    seedCardFocusMs: 50,   // delay before focusing the seed card input
  };
  // Storage caps and gameplay thresholds that aren't mode-specific.
  const LIMITS = {
    historyStorageCap: 50,  // max rounds retained in localStorage
    historyDisplayLen: 20,  // rows shown in the stats overlay (subset of cap)
    dpKCappedValues:  50,   // per-mask cap on the reachable-values DP
    seedInputMaxLen:  48,   // maxlength on the seed card input
    commitIdEntropy:  8,    // random hex chars in a stats commit id
    warnPctHard:     0.1,   // fraction of mode.timer at which the timer turns red
    warnPctSoft:     0.2,   // fraction at which the warning pulse begins
    warnGapSeconds:    5,   // minimum gap between warn1 and warn2 thresholds
  };

  // ─── mode config ───────────────────────────────────────────
  // Each mode declares its target digit count, material count, timer,
  // scoring tier length, the per-slot pools used to roll materials,
  // and the per-slot range tags shown under each material.
  // The first digit of the target is always 1–9 (no leading zero); the
  // remaining digits are 0–9. Materials are pre-rolled at game start in
  // order, then revealed to the player one at a time.
  const MODES = {
    '3': {
      label: '3-digit',
      timer: 50,
      materials: 6,
      targetDigits: 3,
      tierLength: 10,
      scoreMultiplier: 1,
      // Minimum number of materials the simplest solution must use.
      // 1-2-material solves (the value itself, a*b, a+b) make for
      // trivially-spotted targets; 3+ forces a real expression. Set
      // per-mode to scale with difficulty.
      minSize: 4,
      pools: [
        [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [10, 15, 20],
        [25, 50, 75, 100],
      ],
    },
    '4': {
      label: '4-digit',
      timer: 70,
      materials: 7,
      targetDigits: 4,
      tierLength: 14,
      scoreMultiplier: 2,
      minSize: 5,
      pools: [
        [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [10, 15, 20],
        [50, 100, 150, 200],
        [500, 1000, 1500, 2000],
      ],
    },
    '5': {
      label: '5-digit',
      timer: 90,
      materials: 8,
      targetDigits: 5,
      tierLength: 18,
      scoreMultiplier: 3,
      minSize: 6,
      pools: [
        [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9],
        [10, 15, 20],
        [100, 200, 300, 400, 500],
        [1000, 2000, 3000, 4000, 5000],
      ],
    },
  };
  // Per-slot range label rendered under each material \u2014 derived from
  // `pools` so the on-screen tooltip can never drift from the actual
  // roll range for the current difficulty.
  for (const d of Object.keys(MODES)) {
    MODES[d].tags = MODES[d].pools.map(p => `${p[0]}\u2013${p[p.length - 1]}`);
  }
  const DIFFICULTY_ORDER = ['3', '4', '5'];

  // ─── state ──────────────────────────────────────────────────
  const state = {
    phase: 'idle',          // idle | rolling | playing | ended
    rollKind: null,         // 'target' | 'mat'
    rollIndex: 0,           // for mat rolling
    targetAutoLock: false,  // suppress space during the final target roll
    target: [0, 0, 0, 0, 0],   // up to 5 digits
    materials: [0, 0, 0, 0, 0, 0, 0, 0],
    timer: 50,
    timerId: null,
    rollId: null,
    rollTimeoutId: null,    // for the brief pause between locks
    spamLock: false,        // queued space-press: lock the next material as
                            // soon as it appears (handles the gap between
                            // locks for fast clickers)
    beginPending: false,
    restartTimerId: null,
    // Handle for the bad-Enter kicker-restoration setTimeout, so a
    // subsequent bad-Enter press can cancel and re-schedule it (and
    // phase changes can clear it).
    flashTimerId: null,
    sessionScore: 0,
    roundScore: 0,
    difficulty: '3',        // '3' | '4' | '5'
    practice: false,        // true = sum shown, games not recorded
    seed: null,             // active seed string, or null for true-random
    rng: mulberry32(Date.now()),  // PRNG used by rnd/choice helpers
    round: 0,               // round counter, advances on beginGame
    solution: null,         // worked-example expression string for end screen
    commitId: null,         // id of a pending stats entry created at first-material
                            // lock; finalized on endRound, left as a 0-score
                            // 'abandoned' row if the player scums out (anti-scum)
  };

  // ─── helpers ────────────────────────────────────────────────
  // Seeded PRNG plumbing. When a seed is active, the random helpers
  // (rnd/choice) read from state.rng; when no seed is set, state.rng is
  // re-seeded per round from Date.now() so behaviour matches today's
  // "every reload = new random game" feel.
  function xfnv1a(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SEED_WORDS_A = ['amber','cobalt','forest','silver','crimson','azure','ivory','jade','coral','dune','frost'];
  const SEED_WORDS_B = ['fjord','river','meadow','harbor','canyon','summit','valley','grove','delta','plateau','steppe','tide'];
  const NUMS = ['zero','one','two','three','four','five','six','seven','eight','nine'];
  function generateSeed() {
    const a = SEED_WORDS_A[Math.floor(Math.random() * SEED_WORDS_A.length)];
    const b = SEED_WORDS_B[Math.floor(Math.random() * SEED_WORDS_B.length)];
    const num = Math.floor(Math.random() * 9000) + 1000;
    return `${a}-${b}-${num}`;
  }

  // The helpers below read from state.rng instead of Math.random() so
  // that activating a seed deterministically drives all game content.
  const rnd = (min, max) => Math.floor(state.rng() * (max - min + 1)) + min;
  const choice = (arr) => arr[Math.floor(state.rng() * arr.length)];

  function rollTarget() {
    const digits = MODES[state.difficulty].targetDigits;
    const out = [];
    for (let i = 0; i < digits; i++) {
      out.push(i === 0 ? rnd(1, 9) : rnd(0, 9));
    }
    return out;
  }
  function rollMatValue(i) {
    const pools = MODES[state.difficulty].pools;
    return choice(pools[i]);
  }

  // ─── expression parser (shunting-yard + RPN eval) ───────────
  function tokenize(s) {
    const tokens = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === ' ' || c === '\t') continue;
      if (c >= '0' && c <= '9') {
        let j = i;
        while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
        tokens.push({ type: 'num', value: parseInt(s.slice(i, j), 10) });
        i = j - 1;
      } else if (c === '+' || c === '-' || c === '*' || c === '/') {
        const prev = tokens[tokens.length - 1];
        const unary = c === '-' && (!prev || prev.type === 'op' || prev.type === 'lparen');
        tokens.push({ type: 'op', value: c, unary });
      } else if (c === '(') {
        tokens.push({ type: 'lparen' });
      } else if (c === ')') {
        tokens.push({ type: 'rparen' });
      } else {
        throw new Error('bad char');
      }
    }
    return tokens;
  }

  function toRPN(tokens) {
    const out = [], ops = [];
    const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
    for (const t of tokens) {
      if (t.type === 'num') out.push(t);
      else if (t.type === 'op') {
        if (t.unary) {
          // unary minus: highest precedence, just push
          ops.push(t);
        } else {
          // binary op: pop anything with higher-or-equal precedence,
          // including any unary ops on the stack
          while (ops.length && ops[ops.length-1].type === 'op' &&
                 (ops[ops.length-1].unary || prec[ops[ops.length-1].value] >= prec[t.value])) {
            out.push(ops.pop());
          }
          ops.push(t);
        }
      } else if (t.type === 'lparen') {
        ops.push(t);
      } else if (t.type === 'rparen') {
        while (ops.length && ops[ops.length-1].type !== 'lparen') {
          out.push(ops.pop());
          if (!ops.length) throw new Error('mismatched parens');
        }
        ops.pop();
      }
    }
    while (ops.length) {
      const t = ops.pop();
      if (t.type === 'lparen') throw new Error('mismatched parens');
      out.push(t);
    }
    return out;
  }

  function evalRPN(rpn) {
    const st = [];
    for (const t of rpn) {
      if (t.type === 'num') st.push(t.value);
      else if (t.unary) {
        const a = st.pop();
        if (a === undefined) throw new Error('bad expr');
        st.push(t.value === '-' ? -a : a);
      } else {
        const b = st.pop(); const a = st.pop();
        if (a === undefined || b === undefined) throw new Error('bad expr');
        if (t.value === '/' && b === 0) throw new Error('div/0');
        st.push(compute(a, t.value, b));
      }
    }
    if (st.length !== 1) throw new Error('bad expr');
    return st[0];
  }

  function compute(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        // integer intermediates only — no fractions allowed at any step.
        // e.g. (10 / 4) * 8 must be rewritten as (10 * 8) / 4.
        if (a % b !== 0) throw new Error('non-integer');
        return a / b;
    }
  }

  // ─── reachable-target solver (bitmask DP) ───────────────────
  // For each non-empty subset of the six materials, compute the set of
  // integer values reachable with + − × ÷ and parentheses (each material
  // used at most once, matching the player rules). Then target selection
  // is uniform random with O(1) lookup. Precomputation is ~10–50ms for
  // six materials; every target check after that is a single Map.has().
  //
  // We also keep one *example expression* per reachable value, so the
  // end screen can show a valid solution when the player didn't find one.
  //
  // DP[mask] = Map<value, expressionTree> : the smallest expression
  //            (by subset size, then by split order) that evaluates to
  //            each value using only materials in `mask`.
  // DP[1<<i]   = Map { materials[i] → { kind: 'num', value } }
  // DP[mask]   = ⋃ over splits (sub, other = mask^sub, sub<other) of
  //              { a OP b → expression tree : a ∈ DP[sub], b ∈ DP[other] }
  //
  // Integer-only intermediates: division is only kept if it divides
  // evenly. This is what humans actually type, and it keeps the DP
  // small enough to stay fast.

  function precomputeReachable(materials) {
    const n = materials.length;
    const DP = new Array(1 << n);

    for (let i = 0; i < n; i++) {
      DP[1 << i] = new Map([[materials[i], { kind: 'num', value: materials[i] }]]);
    }

    // Band-limited DP: each DP[mask] holds at most K values, kept closest
    // to the current mode's target range. The inner loop is bounded by
    // K × K, so 5-digit (256 masks, 128 submask pairs) runs in ~200ms
    // regardless of how many values the materials could theoretically
    // reach — a 5-50× speedup over the unbounded DP.
    const mode = MODES[state.difficulty];
    const lo = Math.pow(10, mode.targetDigits - 1);
    const hi = Math.pow(10, mode.targetDigits) - 1;
    const K = LIMITS.dpKCappedValues;
    const dist = (v) => v < lo ? lo - v : (v > hi ? v - hi : 0);

    for (let mask = 1; mask < (1 << n); mask++) {
      if ((mask & (mask - 1)) === 0) continue; // single-bit, already done
      const reachable = new Map();
      // For each (sub, other) split, combine values from the two halves.
      // Track the worst (farthest from target range) entry so eviction
      // is O(K) and the cap is always full of target-relevant values.
      let worstKey = null, worstDist = -1;
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        const other = mask ^ sub;
        if (other >= sub) continue; // process each split once
        const L = DP[sub], R = DP[other];
        if (!L || !R) continue;
        for (const [a, aExpr] of L) {
          for (const [b, bExpr] of R) {
            const candidates = [
              { v: a + b, op: '+' },
              { v: a - b, op: '-' },
              { v: b - a, op: '-' },
              { v: a * b, op: '*' },
            ];
            if (b !== 0 && a % b === 0) candidates.push({ v: a / b, op: '/' });
            if (a !== 0 && b % a === 0) candidates.push({ v: b / a, op: '/' });
            for (const { v, op } of candidates) {
              if (reachable.has(v)) continue;
              const expr = { kind: 'op', op, left: aExpr, right: bExpr };
              if (reachable.size < K) {
                reachable.set(v, expr);
                const d = dist(v);
                if (d > worstDist) { worstDist = d; worstKey = v; }
              } else {
                // Try to evict the worst entry if this value is closer.
                const newDist = dist(v);
                if (newDist < worstDist && worstKey != null) {
                  reachable.delete(worstKey);
                  reachable.set(v, expr);
                  // Rescan to refresh worstKey/worstDist. O(K), cheap.
                  worstKey = null; worstDist = -1;
                  for (const k of reachable.keys()) {
                    const d2 = dist(k);
                    if (d2 > worstDist) { worstDist = d2; worstKey = k; }
                  }
                }
              }
            }
          }
        }
      }
      DP[mask] = reachable;
    }

    return DP;
  }

  // Render an expression tree as a string. Adds parentheses only when
  // operator precedence would otherwise change the meaning. No spaces
  // between operators and operands — keeps the displayed solution
  // compact and matches the typographic feel of the input.
  function exprToString(t, parentPrec = 0) {
    if (t.kind === 'num') return String(t.value);
    const prec = (t.op === '+' || t.op === '-') ? 1 : 2;
    const l = exprToString(t.left, prec);
    const r = exprToString(t.right, prec);
    const s = `${l}${t.op}${r}`;
    return prec < parentPrec ? `(${s})` : s;
  }

  // Pick a reachable target inside the current mode's range, biased
  // toward targets that need a real expression to solve.
  //
  // The DP is precomputed once, then a post-pass walks every mask and
  // records, per in-range value, the *smallest* subset of materials
  // that can express it (minimum popcount across all masks containing
  // the value). The picker then:
  //
  //   1. Filters out values whose minimum size is below `MODES.minSize`
  //      (3-digit: < 4, 4-digit: < 5, 5-digit: < 6). Below that floor
  //      the simplest solution is a one-op glance (the value itself,
  //      a·b, a+b) — those rounds feel like the player just typed
  //      the answer rather than solving.
  //   2. Weighted-picks from the survivors with weight ∝ (size −
  //      minSize + 1), so the size just above the floor is twice as
  //      likely as the floor, the size above that thrice, etc. This
  //      lands the average complexity between the floor and the next
  //      size up — a "mostly size floor, some larger" feel rather
  //      than a hard cliff.
  //   3. Falls back to any in-range value if the filter empties the
  //      pool (rare pathological material sets), so the game stays
  //      playable.
  //
  // The example expression saved is the one from the *minimum* mask,
  // so the end-screen solution reflects the same expression class the
  // player is expected to find.
  function findReachableTarget(materials) {
    const DP = precomputeReachable(materials);
    const n = materials.length;
    const mode = MODES[state.difficulty];
    const lo = Math.pow(10, mode.targetDigits - 1);
    const hi = Math.pow(10, mode.targetDigits) - 1;
    const minSize = mode.minSize;

    // Post-pass: min mask size + the example expression for that mask.
    const minInfo = new Map();
    for (let mask = 1; mask < (1 << n); mask++) {
      const m = DP[mask]; if (!m) continue;
      let mc = mask, size = 0;
      while (mc) { size += mc & 1; mc >>>= 1; }
      for (const [v, expr] of m) {
        if (v < lo || v > hi) continue;
        const cur = minInfo.get(v);
        if (!cur || cur.size > size) minInfo.set(v, { size, expr });
      }
    }
    if (minInfo.size === 0) return { target: 0, ok: false, solution: null };

    // Build the "interesting" pool: entries that pass the floor.
    const pool = [];
    for (const [v, info] of minInfo) {
      if (info.size >= minSize) pool.push({ v, info });
    }
    if (pool.length === 0) {
      for (const [v, info] of minInfo) pool.push({ v, info });
    }

    // Weighted pick over (size − minSize + 1).
    let totalW = 0;
    const weights = new Array(pool.length);
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i].info.size - minSize + 1;
      weights[i] = w;
      totalW += w;
    }
    let r = state.rng() * totalW;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        const { v, info } = pool[i];
        return { target: v, ok: true, solution: exprToString(info.expr) };
      }
    }
    // Float edge case: pick the last entry rather than crash.
    const last = pool[pool.length - 1];
    return { target: last.v, ok: true, solution: exprToString(last.info.expr) };
  }

  // Parse expression → { value, used, ok, error, leftover }
  // Rules:
  //  - Use any subset of the six materials, each at most once.
  //  - A single literal number (no material) is also fine.
  //  - Each numeric literal in the expression must be covered by the materials
  //    pool — no smuggling in a "5" when no rolled 5 exists.
  function parseAndCheck(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return { value: null, used: [], leftover: state.materials.slice(), ok: false, error: null, single: false };
    let tokens;
    try { tokens = tokenize(trimmed); }
    catch (e) { return { value: null, used: [], leftover: state.materials.slice(), ok: false, error: e.message, single: false }; }

    const nums = tokens.filter(t => t.type === 'num').map(t => t.value);

    // multiset of materials
    const pool = new Map();
    for (const v of state.materials) pool.set(v, (pool.get(v) || 0) + 1);

    // try to cover every literal from the pool
    const leftover = new Map(pool);
    let usageOk = true;
    for (const v of nums) {
      const c = leftover.get(v) || 0;
      if (c <= 0) { usageOk = false; break; }
      leftover.set(v, c - 1);
    }
    const realLeftover = [];
    for (const [v, c] of leftover) for (let i = 0; i < c; i++) realLeftover.push(v);

    let value = null, evalErr = null;
    try {
      const rpn = toRPN(tokens);
      value = evalRPN(rpn);
    } catch (e) { evalErr = e.message; }

    return {
      value,
      used: nums,
      leftover: realLeftover.sort((a, b) => a - b),
      ok: usageOk && evalErr === null,
      error: evalErr,
      single: nums.length === 1,
    };
  }

  // ─── rendering ──────────────────────────────────────────────
  function setTargetDigits(values, opts = {}) {
    const spans = targetNum.querySelectorAll('.digit');
    spans.forEach((s, i) => {
      s.textContent = values[i] != null ? String(values[i]) : '·';
    });
    if (opts.state) targetEl.dataset.state = opts.state;
    // hide the digits during the round in hard mode; reveal on end
    if (opts.hidden != null) targetEl.dataset.hidden = opts.hidden ? '1' : '0';
  }

  function applyDifficulty() {
    const mode = MODES[state.difficulty];
    diffVal.textContent = mode.label;
    document.body.dataset.difficulty = state.difficulty;
    document.body.dataset.practice = state.practice ? '1' : '0';
    practVal.textContent = state.practice ? 'on' : 'off';
    practBtn.setAttribute('aria-pressed', state.practice ? 'true' : 'false');
    setWordmarkDot();
    // Material and digit slots are pre-rendered in the DOM (8 / 5) so the
    // layout doesn't reflow between modes; we just toggle data-hidden and
    // re-paint the per-slot range tag from the mode config.
    const matCount = mode.materials;
    materials.querySelectorAll('.material').forEach((li, i) => {
      li.dataset.hidden = i < matCount ? '0' : '1';
      li.querySelector('.tag').textContent = mode.tags[i] || '';
    });
    const digitCount = mode.targetDigits;
    targetNum.querySelectorAll('.digit').forEach((s, i) => {
      s.dataset.hidden = i < digitCount ? '0' : '1';
    });
    // the live placeholder must reflect the mode in every phase, not just
    // while playing — toggle ? / d immediately.
    if (state.phase === 'playing') {
      setLiveEval(expr.value);
    } else {
      exprLive.textContent = state.practice ? 'd' : '?';
      exprLive.dataset.state = 'idle';
    }
    if (targetHint) targetHint.textContent = `a ${mode.label} figure, randomly drawn`;
  }

  function toggleDifficulty() {
    // Locked once a round is in progress — changing the mode mid-roll
    // would orphan the in-flight materials and target. The first material
    // hasn't been revealed to the player yet, so changing is safe.
    if (state.phase === 'playing' || (state.phase === 'rolling' && state.rollIndex > 0)) return;
    const i = DIFFICULTY_ORDER.indexOf(state.difficulty);
    state.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
    applyDifficulty();
  }

  function togglePractice() {
    // Same lock as difficulty — changing whether the round counts toward
    // stats mid-round would be confusing. The first material hasn't been
    // revealed yet, so changing is safe.
    if (state.phase === 'playing' || (state.phase === 'rolling' && state.rollIndex > 0)) return;
    state.practice = !state.practice;
    applyDifficulty();
  }

  // ─── seed management ───────────────────────────────────────
  // When a seed is set, all game content (materials, target, target
  // selection) is deterministic from (state.seed, state.round). Two
  // players sharing a seed play identical game sequences round-for-round.
  // Activating a seed doesn't change the current round — it affects the
  // next one (so the existing round finishes with its existing content).
  function setSeed(value) {
    const trimmed = (value || '').trim();
    state.seed = trimmed || null;
    document.body.dataset.seeded = state.seed ? '1' : '0';
    // Top-right display button shows the active seed.
    if (seedDisplay) seedDisplay.textContent = state.seed || '—';
    // The card input mirrors state when the card is open.
    if (seedCardInput && seedCard && seedCard.dataset.open === '1') {
      seedCardInput.value = state.seed || '';
    }
    // Show the × clear buttons only when there's something to clear.
    if (seedClearTop) seedClearTop.hidden = !state.seed;
    setWordmarkDot();
    // A new seed is a fresh start — round counter resets to 0, so the
    // display shows "—" and the next beginGame is round 1. The session
    // score resets too: the previous seed's points were earned against
    // a deterministic sequence that no longer applies.
    state.round = 0;
    setMetaRound();
    setSessionScore(0);
  }
  function getSeedFromURL() {
    const params = new URLSearchParams(location.search);
    return params.get('seed');
  }
  function copyShareLink() {
    if (!state.seed) return;
    const url = `${location.origin}${location.pathname}?seed=${encodeURIComponent(state.seed)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // The empty resolve/reject handlers leave a stable seam for future
      // share-button feedback (e.g. a flash class) without an extra named fn.
      navigator.clipboard.writeText(url).then(() => {}, () => {});
    } else {
      // fallback: select-and-copy via a hidden textarea
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }
  }

  // ─── stats (persisted, per-difficulty) ──────────────────────
  // The recordable unit is one round that ended in non-practice,
  // non-seeded mode. Practice and seeded rounds still score on the
  // overlay (and update the in-memory session score) but they do not
  // touch the localStorage record.
  const STATS_KEY = 'slagalica.stats.v1';

  // Per-mode distribution buckets. The exact tier is 6×m to 10×m (m
  // = mode.scoreMultiplier), with 3×m as the one-off tier and 0 as
  // the further tier. Derived from MODES[d].scoreMultiplier so a future
  // mode with a different multiplier auto-adjusts. The values are
  // stored as strings because they're also used as display labels in
  // the histogram (e.g. "21" reads as the 21-point bucket).
  const BASE_TIERS = [10, 9, 8, 7, 6, 3, 0];
  function getTiersForMode(d) {
    const m = (MODES[d] && MODES[d].scoreMultiplier) || 1;
    return BASE_TIERS.map(t => String(t * m));
  }

  function getEmptyBlock(difficulty) {
    return {
      played: 0,
      total: 0,
      exactCount: 0,
      scoreByTier: Object.fromEntries(getTiersForMode(difficulty).map(t => [t, 0])),
      sumSolveTime: 0,
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  function getEmptyStats() {
    return {
      version: 1,
      firstSeen: new Date().toISOString(),
      lastSeen:  new Date().toISOString(),
      byDifficulty: {
        '3': getEmptyBlock('3'),
        '4': getEmptyBlock('4'),
        '5': getEmptyBlock('5'),
      },
      history: [],
    };
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) return getEmptyStats();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return getEmptyStats();
      // backfill any missing difficulty blocks (e.g. older saves)
      for (const d of ['3', '4', '5']) {
        if (!parsed.byDifficulty[d]) parsed.byDifficulty[d] = getEmptyBlock(d);
      }
      // Recompute exactCount from history. The old finalize used a
      // score-derived proxy that missed slow exacts; the score tiers
      // ([6,10*m], [3, 3+m), 0) are disjoint, so a score-only check
      // is reliable and corrects the count for older saves on first
      // load with the new code.
      if (Array.isArray(parsed.history)) {
        for (const d of ['3', '4', '5']) {
          const block = parsed.byDifficulty[d];
          const mult = MODES[d] && MODES[d].scoreMultiplier || 1;
          let count = 0;
          for (const row of parsed.history) {
            if (row.pending) continue;
            if (String(row.difficulty) !== d) continue;
            // exact: 6*mult ≤ score ≤ 10*mult and score > 0
            if (row.score >= 6 * mult && row.score <= 10 * mult) count += 1;
          }
          block.exactCount = count;
        }
      }
      return parsed;
    } catch (_) {
      return getEmptyStats();
    }
  }

  function saveStats(record) {
    try {
      record.lastSeen = new Date().toISOString();
      localStorage.setItem(STATS_KEY, JSON.stringify(record));
    } catch (_) {
      // localStorage might be disabled (private mode, quota) — silently
      // skip; the in-memory record is still useful for this session.
    }
  }
  // Wipe all persisted progress. Used by the "Reset progress" button
  // in the stats overlay. Safe to call on a fresh / empty record — the
  // next renderStats() will just show empty sections.
  function wipeStats() {
    try {
      localStorage.removeItem(STATS_KEY);
    } catch (_) {
      // disabled storage — nothing to clear, but render the empty state anyway
    }
  }

  // Anti-scum: a round is recorded the moment the first material locks;
  // if the player then walks away, the row stays as a 0-score "abandon"
  // loss and can only be promoted to a real score by endRound →
  // finalizeRound. The `prevStreak` snapshot in the pending row lets
  // finalizeRound restore the pre-commit streak and reapply the new
  // result, so exact / non-exact / abandoned all yield the right
  // currentStreak.
  function commitRound(difficulty) {
    const record = loadStats();
    const block = record.byDifficulty[difficulty];
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, LIMITS.commitIdEntropy)}`;
    block.played += 1;
    block.total += 0;
    block.sumSolveTime += 0;
    const tierKey = '0';
    block.scoreByTier[tierKey] = (block.scoreByTier[tierKey] || 0) + 1;
    const prevStreak = block.currentStreak;
    block.currentStreak = 0; // worst case until finalized
    record.history.push({
      id,
      pending: true,
      prevStreak,            // snapshot for finalize to restore+reapply
      score: 0,
      timeSpent: 0,
      target: null,
      difficulty,
      ts: new Date().toISOString(),
    });
    if (record.history.length > LIMITS.historyStorageCap) record.history = record.history.slice(-LIMITS.historyStorageCap);
    saveStats(record);
    return id;
  }

  function finalizeRound(commitId, difficulty, score, timeSpent, target, isExact) {
    if (!commitId) return; // practice/seeded — nothing was committed
    const record = loadStats();
    const block = record.byDifficulty[difficulty];
    if (!block) return;
    // The exact-match signal is a boolean, not a score-derived proxy:
    // raw scores (6–10) overlap with non-exact (3) on the slow end of
    // the time bonus, so a score-only check would misclassify slow
    // exacts. The boolean is computed at endRound time.
    const row = record.history.find(h => h.id === commitId);
    if (!row) return; // commit was lost (storage cleared) — nothing to restore
    const prevStreak = typeof row.prevStreak === 'number' ? row.prevStreak : 0;
    // Replace the 0-score placeholder with the real result.
    block.total += score;       // commit added 0, so this is delta
    if (isExact) block.exactCount = (block.exactCount || 0) + 1;
    block.sumSolveTime += timeSpent;
    // Update the histogram: remove the '0' bucket, add the real tier.
    block.scoreByTier['0'] = Math.max(0, (block.scoreByTier['0'] || 0) - 1);
    const tierKey = String(score);
    if (block.scoreByTier[tierKey] != null) block.scoreByTier[tierKey] += 1;
    else block.scoreByTier[tierKey] = 1;
    // Streak: restore pre-commit, then apply the new result.
    block.currentStreak = prevStreak;
    if (isExact) {
      block.currentStreak += 1;
      if (block.currentStreak > block.longestStreak) block.longestStreak = block.currentStreak;
    } else {
      block.currentStreak = 0;
    }
    // Patch the history row in place.
    row.pending = false;
    row.score = score;
    row.timeSpent = timeSpent;
    row.target = target;
    saveStats(record);
  }

  function formatAge(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  }

  function renderStats() {
    if (!stats) return;
    const record = loadStats();
    for (const d of ['3', '4', '5']) {
      const block = record.byDifficulty[d];
      const section = stats.querySelector(`.stats__section[data-difficulty="${d}"]`);
      if (!section) continue;
      section.classList.toggle('stats__section--empty', block.played === 0);
      const mean = block.played > 0 ? (block.total / block.played) : 0;
      // exact rate = lifetime share of rounds that landed exactly. Guard
      // exactCount for older saves that pre-date the field (the schema
      // backfill in loadStats doesn't reach into the per-difficulty
      // block, so it can be undefined).
      const exactCount = block.exactCount || 0;
      const exactRate = block.played > 0
        ? `${Math.round((exactCount / block.played) * 100)}%`
        : '—';
      const valueByKey = {
        played: block.played,
        total: block.total,
        exactRate,
        mean: block.played > 0 ? mean.toFixed(1) : '—',
        currentStreak: block.currentStreak,
        longestStreak: block.longestStreak,
      };
      section.querySelectorAll('.stats__value').forEach(el => {
        const k = el.dataset.key;
        el.textContent = valueByKey[k] != null ? valueByKey[k] : '—';
      });
      // histogram bars
      const barsHost = section.querySelector('.stats__hist-bars');
      if (barsHost) {
        while (barsHost.firstChild) barsHost.removeChild(barsHost.firstChild);
        const tiers = getTiersForMode(d);
        const max = Math.max(1, ...tiers.map(t => block.scoreByTier[t] || 0));
        for (const tier of tiers) {
          const count = block.scoreByTier[tier] || 0;
          const pct = max > 0 ? (count / max) * 100 : 0;
          const isZero = tier === '0';
          const bar = document.createElement('div');
          bar.className = 'stats__bar';
          bar.dataset.zero = isZero ? '1' : '0';
          const track = document.createElement('div');
          track.className = 'stats__bar-track';
          const fill = document.createElement('div');
          fill.className = 'stats__bar-fill';
          fill.style.height = `${pct}%`;
          const label = document.createElement('span');
          label.className = 'stats__bar-label';
          label.textContent = tier;
          bar.append(track, fill, label);
          barsHost.appendChild(bar);
        }
      }
    }
    // history table
    const tbody = stats.querySelector('#stats-history-body');
    if (tbody) {
      const recent = record.history.slice(-LIMITS.historyDisplayLen).reverse();
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      if (recent.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'stats__empty';
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'no rounds yet';
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        for (const h of recent) {
          const tr = document.createElement('tr');
          if (h.pending) tr.className = 'stats__row--pending';
          const targetCell = h.target == null ? '—' : String(h.target);
          const timeCell = h.pending ? '—' : `${h.timeSpent}s`;
          const cells = [targetCell, String(h.score), timeCell, `${h.difficulty}-digit`, formatAge(h.ts)];
          for (const text of cells) {
            const td = document.createElement('td');
            td.textContent = text;
            tr.appendChild(td);
          }
          // pending (abandoned) rows are ambiguous with a real zero-score
          // finished round; mark them with an inline tag.
          if (h.pending) {
            const scoreCell = tr.children[1];
            const tag = document.createElement('span');
            tag.className = 'stats__pending';
            tag.textContent = 'abandoned';
            scoreCell.appendChild(document.createTextNode(' '));
            scoreCell.appendChild(tag);
          }
          tbody.appendChild(tr);
        }
      }
    }
  }

  // Open/close the menu overlays (help / stats / seed card) with a single
  // helper. Mutual exclusion (one menu at a time) is enforced in the
  // per-overlay open wrappers, not here — `openHelp` originally did not
  // close the others, and the asymmetry is preserved. The `hooks` arg
  // covers per-overlay side effects (render, focus, blur).
  function setOverlay(el, open, hooks) {
    if (!el) return;
    el.dataset.open = open ? '1' : '0';
    // body.overlayOpen reflects any of the four overlays being open
    // (the result overlay writes its own value at the close sites
    // because they are not routed through this helper).
    const anyMenuOpen = (help     && help.dataset.open     === '1') ||
                        (stats    && stats.dataset.open    === '1') ||
                        (seedCard && seedCard.dataset.open === '1');
    const resultOpen = overlay && overlay.dataset.open === '1';
    document.body.dataset.overlayOpen = (anyMenuOpen || resultOpen) ? '1' : '0';
    if (hooks) {
      if (open  && hooks.onOpen)  hooks.onOpen();
      if (!open && hooks.onClose) hooks.onClose();
    }
  }
  function openHelp()   { setOverlay(help, true); }
  function closeHelp()  { setOverlay(help, false); }
  function openStats() {
    // One menu at a time: drop the help overlay if it's open.
    if (help && help.dataset.open === '1') closeHelp();
    setOverlay(stats, true, { onOpen: renderStats });
  }
  function closeStats() { setOverlay(stats, false); }
  function openSeedCard() {
    // One menu at a time: drop help/stats if they're open.
    if (help && help.dataset.open === '1') closeHelp();
    if (stats && stats.dataset.open === '1') closeStats();
    setOverlay(seedCard, true, {
      onOpen: () => {
        if (seedCardInput) seedCardInput.value = state.seed || '';
        // focus the input after the overlay opens so the player can type
        setTimeout(() => { if (seedCardInput) seedCardInput.focus(); }, TIMING.seedCardFocusMs);
      },
    });
  }
  function closeSeedCard() {
    setOverlay(seedCard, false, {
      // The input kept focus after the card visually closed, so keystrokes
      // (including Enter) still routed to the hidden input and called
      // setSeed. Blur returns focus to the page so the global key handlers
      // (Space, D, P, S, ?, R) take over again.
      onClose: () => { if (seedCardInput) seedCardInput.blur(); },
    });
  }
  function setTimer(sec) {
    state.timer = sec;
    // Display is clamped to 0:00 — state.timer is allowed to go negative
    // briefly (the timer's own setInterval can fire one extra time after
    // endRound is queued, and a previous N×-interval bug could underflow
    // it). The CSS pulse animation in [data-warn="2"] is the only visible
    // signal that the round is about to end, and "0:00" reads as "time's
    // up" without surprising the player with a negative clock.
    const m = Math.max(0, Math.floor(sec / 60));
    const s = Math.max(0, sec % 60);
    vtime.textContent = `${m}:${String(s).padStart(2, '0')}`;
    const mode = MODES[state.difficulty];
    const pct = Math.max(0, sec) / mode.timer;
    vfillBar.style.transform = `scaleY(${pct})`;
    // warn thresholds scale with the timer so a 90s and 50s round both
    // get a clear "you're running out" beat near the end
    const warn2 = Math.max(2, Math.floor(mode.timer * LIMITS.warnPctHard));
    const warn1 = Math.max(warn2 + LIMITS.warnGapSeconds, Math.floor(mode.timer * LIMITS.warnPctSoft));
    const warn = sec <= warn2 ? 2 : sec <= warn1 ? 1 : 0;
    vtime.dataset.warn = String(warn);
    vfillBar.dataset.warn = String(warn);
  }
  function setMaterial(i, value, opts = {}) {
    const li = materials.querySelector(`.material[data-i="${i}"]`);
    if (!li) return;
    li.querySelector('.num').textContent = value != null ? String(value) : '·';
    if (opts.state) li.dataset.state = opts.state;
  }
  function setKicker(html) { kicker.innerHTML = html; }
  function setSessionScore(s) {
    state.sessionScore = s;
    metaScore.textContent = String(s);
  }

  // The round counter lives in the masthead so the player can see at a
  // glance which round they're on (matters most for seeded multiplayer,
  // where round N corresponds to sub-seed (masterSeed, N)). The × next
  // to round appears once at least one round has been played; clicking
  // it resets the counter to 0 (the next beginGame is then round 1).
  function setMetaRound() {
    if (!metaRound) return;
    metaRound.textContent = state.round > 0 ? String(state.round) : '—';
    if (roundClearTop) roundClearTop.hidden = state.round <= 0;
  }

  // The wordmark's trailing dot doubles as a "won't be scored" tell.
  // Default (recordable): a small red period. Seeded: a small flower —
  // a planted seed, predetermined. Practice is conveyed by the title's
  // soft italic style, so the dot stays the same.
  function setWordmarkDot() {
    if (!wordmarkDot) return;
    let ch = '.', mode = 'default';
    if (state.seed) { ch = '✿'; mode = 'seeded'; }
    if (wordmarkDot.textContent !== ch) wordmarkDot.textContent = ch;
    wordmarkDot.dataset.mode = mode;
  }

  function setLiveEval(raw) {
    const r = parseAndCheck(raw);
    const practice = state.practice;
    if (!raw.trim()) {
      exprLive.textContent = practice ? 'd' : '?';
      exprLive.dataset.state = 'idle';
      exprUsed.innerHTML = 'using: <em>none yet</em>';
      return;
    }
    if (r.value == null || !isFinite(r.value)) {
      const errText = r.error === 'div/0' ? '÷ 0'
                    : r.error === 'non-integer' ? 'frac'
                    : '·';
      exprLive.textContent = errText;
      exprLive.dataset.state = 'err';
    } else {
      const pretty = Number.isInteger(r.value) ? String(r.value) : r.value.toFixed(3).replace(/\.?0+$/, '');
      // in non-practice mode (default) we hide the running sum; in
      // practice mode we show it
      exprLive.textContent = practice ? pretty : '· · ·';
      // compare to target — still useful internally for the state colour,
      // but the player only sees it in practice mode
      const tgt = parseInt(state.target.join(''), 10);
      if (Math.abs(r.value - tgt) < 1e-9) exprLive.dataset.state = 'ok';
      else if (r.ok) exprLive.dataset.state = 'warn'; // valid expr, not on target
      else exprLive.dataset.state = 'err';
    }
    // render "using: …" chips. The materials array is always 8 slots
    // (with stale zeros past the active count), so slice to the mode's
    // real count before sorting — otherwise the unused slots would
    // render as "using: 0" chips.
    const matCount = MODES[state.difficulty].materials;
    const wantSorted = state.materials.slice(0, matCount).sort((a, b) => a - b);
    const usedCounts = new Map();
    for (const v of r.used) usedCounts.set(v, (usedCounts.get(v) || 0) + 1);
    const chips = [];
    for (const v of wantSorted) {
      const c = usedCounts.get(v) || 0;
      if (c > 0) {
        chips.push(`<span class="used-chip">${v}</span>`);
        usedCounts.set(v, c - 1);
      } else {
        chips.push(`<span class="used-chip used-chip--missing">${v}</span>`);
      }
    }
    const tag = r.single ? ' · single literal' : '';
    exprUsed.innerHTML = 'using: ' + chips.join(' ') + tag;
  }

  // Single owner of the phase state machine: updates state.phase and
  // body[data-phase] in one place so callers
  // can't drift. No-op if the new phase equals the current one (some
  // phase-change functions are called from sub-transitions where the
  // visible phase is already correct, e.g. startTargetRoll in the
  // middle of a 'rolling' phase).
  function transitionTo(newPhase) {
    if (state.phase === newPhase) return;
    state.phase = newPhase;
    document.body.dataset.phase = newPhase;
  }

  // ─── session wipe: clear the seed, zero the round counter, zero
  // the session score, and close any open overlay. Called by the R×3
  // tap gesture (3 R presses within 1.5s gaps). resetAll() handles
  // the in-flight round / timer cleanup; setSeed('') cascades the
  // round + score zeros via its own logic. The two close calls
  // ensure the player isn't stranded inside help / stats / the
  // seed card after their seed was just cleared.
  function wipeSession() {
    resetAll();
    // Always reset the round counter — the previous version of this
    // function only ran setSeed('') (which zeros the round) when a
    // seed was active, leaving the counter at N after a wipe from a
    // no-seed round. The destructive intent is "wipe everything to
    // a fresh start", so the counter must always go to 0, and the
    // next beginGame (whether triggered by the in-flight restart
    // timer or by the player's next Space) starts at round 1.
    state.round = 0;
    setMetaRound();
    setSessionScore(0);
    // setSeed('') is a no-op on state when there's no seed, but it
    // also clears the visible seed-card input value if the card is
    // open (the player might have been typing one when they wiped).
    setSeed('');
    if (help && help.dataset.open === '1') closeHelp();
    if (stats && stats.dataset.open === '1') closeStats();
    if (seedCard && seedCard.dataset.open === '1') closeSeedCard();
  }
  function startRolling(kind, index = 0) {
    // spam-safety: clear any existing roll before starting a new one
    if (state.rollId) { clearInterval(state.rollId); state.rollId = null; }
    transitionTo('rolling');
    state.rollKind = kind;
    state.rollIndex = index;
    if (kind === 'target') {
      setKicker('Rolling the target · <kbd>space</kbd> to lock');
      targetEl.dataset.state = 'rolling';
      const tick = () => {
        state.target = rollTarget();
        setTargetDigits(state.target);
      };
      tick();
      state.rollId = setInterval(tick, TIMING.rollTickMs);
    } else {
      setKicker(`Rolling material ${toRoman(index + 1)} · <kbd>space</kbd> to lock`);
      const tick = () => {
        const v = rollMatValue(index);
        state.materials[index] = v;
        setMaterial(index, v, { state: 'rolling' });
      };
      tick();
      state.rollId = setInterval(tick, TIMING.rollTickMs);
      // honor a queued lock from a space press that arrived while no
      // material was rolling (between locks) — fast clickers press space
      // before the next material's interval exists.
      if (state.spamLock) {
        state.spamLock = false;
        setTimeout(() => {
          if (state.phase === 'rolling' && state.rollKind === 'mat' && state.rollIndex === index) {
            lockCurrent();
          }
        }, TIMING.rollTickMs + 5);
      }
    }
  }

  function lockCurrent() {
    // kill any pending chained setTimeout from a prior lock — spam-safety
    if (state.rollTimeoutId) { clearTimeout(state.rollTimeoutId); state.rollTimeoutId = null; }
    clearInterval(state.rollId);
    state.rollId = null;
    if (state.rollKind === 'target') {
      targetEl.dataset.state = 'locked';
      // player is no longer in hard-mode-blur state once the target lands
      // beginPlay applies hidden based on difficulty
      state.rollTimeoutId = setTimeout(() => {
        state.rollTimeoutId = null;
        beginPlay();
      }, TIMING.lockBeatMs);
    } else {
      setMaterial(state.rollIndex, state.materials[state.rollIndex], { state: 'locked' });
      // The moment the first material locks, the round is "in play" —
      // commit a pending stats row. If the player walks away, refreshes,
      // or otherwise abandons, the row stays as a 0-score loss (anti-scum).
      // Only recordable rounds (non-practice, non-seeded) commit; the
      // resulting id is stashed in state and consumed by endRound.
      if (state.rollIndex === 0 && !state.commitId && !state.practice && !state.seed) {
        state.commitId = commitRound(state.difficulty);
      }
      const next = state.rollIndex + 1;
      if (next < MODES[state.difficulty].materials) {
        // No rest beat between materials — start the next roll right away
        // so fast clickers can lock all six in quick succession. A queued
        // space press during this synchronous call will still take effect
        // because startRolling honors state.spamLock.
        startRolling('mat', next);
      } else {
        // last material locked — short beat for emphasis, then target roll
        state.rollTimeoutId = setTimeout(() => {
          state.rollTimeoutId = null;
          startTargetRoll();
        }, TIMING.materialGapMs);
      }
    }
  }

  // Roll the target last. No decoy cycling, no jitter — the moment the
  // solver returns a reachable value, place it. The brief `locked` beat
  // (350ms) just lets the stamp animation play before the clock starts.
  function startTargetRoll() {
    // discard any queued mat lock — the target has its own auto-lock timing
    state.spamLock = false;
    if (state.rollId) { clearInterval(state.rollId); state.rollId = null; }
    transitionTo('rolling');
    state.rollKind = 'target';
    state.rollIndex = MODES[state.difficulty].materials; // sentinel — lockCurrent routes to beginPlay
    state.targetAutoLock = true; // suppress space-to-lock
    setKicker('Finding a target you can solve…');
    targetEl.dataset.state = 'rolling';
    targetEl.dataset.hidden = '0';
    // pre-compute the reachable target (bounded ~50ms worst case). The
    // digits stay as · · · during the search; the instant a value is
    // available, lock it in. Also caches a worked example expression
    // for the end screen. Slice to the active material count so the
    // DP doesn't consider stale zeros from unused slots.
    const activeMats = state.materials.slice(0, MODES[state.difficulty].materials);
    const { target, ok, solution } = findReachableTarget(activeMats);
    state.solution = solution;
    state.target = String(target).padStart(MODES[state.difficulty].targetDigits, '0').split('').map(Number);
    setTargetDigits(state.target);
    targetEl.dataset.state = 'locked';
    setKicker(ok ? 'Target locked · <em>solvable</em>' : 'Target locked · <em>best-effort</em>');
    // brief beat for the stamp animation, then beginPlay
    state.rollTimeoutId = setTimeout(() => {
      state.rollTimeoutId = null;
      state.targetAutoLock = false;
      beginPlay();
    }, TIMING.lockBeatMs);
  }

  function toRoman(n) {
    return ['I','II','III','IV','V','VI','VII','VIII','IX','X'][n-1] || String(n);
  }

  // ─── phase: playing ─────────────────────────────────────────
  // Build the kicker string for a freshly-entered playing phase. Extracted
  // from beginPlay so the parse-error restore path (after a bad Enter) can
  // rebuild the same string after the 900ms error-nudge window expires —
  // the previous code restored only if the live eval had gone back to
  // 'idle' (which it never does while the expression is still bad), so
  // the player got stuck on "Fix the expression · enter to submit" for
  // the rest of the round.
  function buildPlayingKicker() {
    const mode = MODES[state.difficulty];
    const secondsLabel = `${mode.timer} seconds`;
    const practiceTail = state.practice
      ? 'the running sum is shown · '
      : '';
    return state.seed
      ? `Seed "${state.seed}" · ${secondsLabel} · ${practiceTail}<kbd>enter</kbd> to submit · <kbd>esc</kbd> to clear`
      : `${secondsLabel} · ${practiceTail}<kbd>enter</kbd> to submit · <kbd>esc</kbd> to clear`;
  }

  function beginPlay() {
    transitionTo('playing');
    const mode = MODES[state.difficulty];
    state.timer = mode.timer;
    setKicker(buildPlayingKicker());
    expr.disabled = false;
    equation.dataset.disabled = '0';
    expr.value = '';
    expr.focus();
    setTimer(mode.timer);
    setLiveEval('');
    // ensure target is fully visible during play (no longer hidden)
    setTargetDigits(state.target, { state: 'locked', hidden: '0' });
    state.timerId = setInterval(() => {
      const next = state.timer - 1;
      setTimer(next);
      if (next <= 0) {
        clearInterval(state.timerId);
        state.timerId = null;
        endRound(true); // timed out
      }
    }, TIMING.timerTickMs);
  }

  // ─── phase: ended ───────────────────────────────────────────
  function endRound(timedOut) {
    transitionTo('ended');
    clearInterval(state.timerId);
    state.timerId = null;
    clearInterval(state.rollId);
    state.rollId = null;
    expr.disabled = true;
    equation.dataset.disabled = '1';
    // Stop the timer pulse. data-warn is the trigger for the
    // [data-warn="1"]/[data-warn="2"] rule that applies the animation;
    // dropping it to '0' removes the rule and the loop ends cleanly.
    vtime.dataset.warn = '0';
    vfillBar.dataset.warn = '0';

    const raw = expr.value.trim();
    const r = parseAndCheck(raw);
    const tgt = parseInt(state.target.join(''), 10);

    let deltaStr = '—', score = 0, evalStr = '—', isExact = false;
    // Only award points for a *valid* expression. On submit, endRound is
    // only reached when r.ok is true; on timeout, the player could have
    // typed anything — including the target itself, which would otherwise
    // score 10 even though the submit handler would have rejected it.
    if (!raw) {
      evalStr = '(no expression entered)';
    } else if (!r.ok) {
      evalStr = '(invalid expression)';
    } else if (r.value != null && isFinite(r.value)) {
      const pretty = Number.isInteger(r.value) ? String(r.value) : r.value.toFixed(3).replace(/\.?0+$/, '');
      evalStr = pretty;
      const d = Math.abs(r.value - tgt);
      deltaStr = (r.value - tgt >= 0 ? '+' : '−') + (Number.isInteger(d) ? d : d.toFixed(3));
      const tier = MODES[state.difficulty].tierLength;
      if (d < 1e-9) {
        // EXACT — base 6 + time bonus. The mode's tierLength sets the
        // step (10s for 3-digit, 14s for 4-digit, 18s for 5-digit) so
        // the fastest exact always scores 10 and the slowest exact
        // always scores 6, regardless of the round length.
        score = 6 + Math.min(4, Math.floor(state.timer / tier));
        isExact = true;
      } else if (d <= 1) {
        // ONE OFF — flat 3, no time bonus. The cliff between exact and
        // one-off is deliberate: "almost" should feel almost as bad as
        // "way off" — speed does not rescue a near miss.
        score = 3;
      } else {
        // FURTHER — no points. Only an exact match rewards effort.
        score = 0;
      }
    }

    // Apply the per-mode multiplier so a 4-digit exact is worth 2x
    // (and a 5-digit exact 3x) compared to a 3-digit exact. The
    // multiplier scales the raw score for both the session total and
    // the persisted stats so a hard mode is "worth more" competitively.
    score = score * MODES[state.difficulty].scoreMultiplier;

    state.roundScore = score;
    setSessionScore(state.sessionScore + score);

    // Persist to long-term stats — only when the round was a real
    // (non-practice, non-seeded) attempt. The pending row was already
    // created at first-material lock; finalize updates it with the
    // real result and recomputes the streak from the saved snapshot.
    // If the player scums out (Escape/R at mat 0), finalize is never
    // called and the row stays as a 0-score loss — the whole point of
    // the two-phase commit.
    if (!state.practice && !state.seed) {
      const mode = MODES[state.difficulty];
      const timeSpent = mode.timer - state.timer;
      finalizeRound(state.commitId, state.difficulty, score, timeSpent, tgt, isExact);
    }
    state.commitId = null;
    oExpr.textContent     = raw || '—';
    oSolution.textContent = state.solution || '—';
    oEval.textContent     = evalStr;
    oTarget.textContent   = String(tgt);
    oDelta.textContent    = deltaStr;
    oScore.textContent    = score > 0 ? `+${score}` : '0';
    // reveal the target on the board and the overlay
    setTargetDigits(state.target, { state: 'locked', hidden: '0' });
    setKicker('Round over · <kbd>R</kbd> to play again');
    overlay.dataset.open = '1';
    document.body.dataset.overlayOpen = '1';
  }
  function resetAll() {
    clearInterval(state.timerId);
    clearInterval(state.rollId);
    if (state.rollTimeoutId) clearTimeout(state.rollTimeoutId);
    if (state.restartTimerId) clearTimeout(state.restartTimerId);
    if (state.flashTimerId) clearTimeout(state.flashTimerId);
    state.timerId = null;
    state.rollId = null;
    state.rollTimeoutId = null;
    state.restartTimerId = null;
    state.flashTimerId = null;
    state.spamLock = false;
    state.beginPending = false;     // wipe the re-entrancy guard too
    state.target = [0,0,0,0,0];
    state.materials = [0,0,0,0,0,0,0,0];
    state.solution = null;
    // Drop any in-flight commit id. The abandoned row is already
    // persisted in localStorage from the previous commitRound, so the
    // stats record is the source of truth for "this round was abandoned";
    // this just stops the stale id from being carried into the next
    // round (where it would silently suppress the new round's commit
    // and get retroactively finalized with the wrong data).
    state.commitId = null;
    const mode = MODES[state.difficulty];
    state.timer = mode.timer;
    setTargetDigits(new Array(mode.targetDigits).fill(null), { hidden: '0' });
    targetEl.dataset.state = 'idle';
    materials.dataset.state = '';
    for (let i = 0; i < 8; i++) {
      setMaterial(i, null);
      const li = materials.querySelector(`.material[data-i="${i}"]`);
      if (li) li.dataset.state = '';
    }
    expr.value = '';
    expr.disabled = true;
    equation.dataset.disabled = '1';
    setTimer(mode.timer);
    setLiveEval('');
    setKicker('Press <kbd>space</kbd> to begin');
    setMetaRound();
    overlay.dataset.open = '0';
    document.body.dataset.overlayOpen = '0';
    transitionTo('idle');
  }

  // ─── game start (after space) ───────────────────────────────
  // Re-entrancy guard: a burst of Space/Enter presses in idle used to
  // call beginGame N times, stacking N setTimeout(beginPlay) callbacks
  // and orphaning N−1 timer intervals. The flag stays up
  // across the seeded settle so a re-entrant press during the window
  // drops silently; cleared on the synchronous exit of beginGame.
  function beginGame() {
    if (state.beginPending) return;
    state.beginPending = true;
    overlay.dataset.open = '0';
    document.body.dataset.overlayOpen = '0';
    state.spamLock = false;
    const mode = MODES[state.difficulty];
    // Reseed the PRNG. With a seed active, derive a sub-seed from
    // (seed, round) so each round is reproducible from the master seed.
    // Without a seed, mix Date.now() with the round counter so two
    // rounds in the same millisecond don't collide.
    state.round += 1;
    setMetaRound();
    if (state.seed) {
      state.rng = mulberry32(xfnv1a(state.seed + ':' + state.round));
    } else {
      state.rng = mulberry32(((Date.now() & 0xFFFFFFFF) ^ (state.round * 2654435761)) >>> 0);
    }
    // pre-roll all materials immediately so the lock can happen "too fast";
    // the target is computed only after the last material locks.
    for (let i = 0; i < mode.materials; i++) state.materials[i] = rollMatValue(i);
    if (state.seed) {
      // SEEDED: one space reveals everything. No rolling animation —
      // set every material to its locked value, compute the target,
      // and stamp it in. A short beat lets the dropIn/stamp animations
      // play before the clock starts.
      setTargetDigits(new Array(mode.targetDigits).fill(null), { state: 'idle', hidden: '0' });
      for (let i = 0; i < mode.materials; i++) {
        setMaterial(i, state.materials[i], { state: 'locked' });
      }
      // Slice to the active material count so the DP only considers
      // the materials the player actually has.
      const activeMats = state.materials.slice(0, mode.materials);
      const { target, ok, solution } = findReachableTarget(activeMats);
      state.solution = solution;
      state.target = String(target).padStart(mode.targetDigits, '0').split('').map(Number);
      setTargetDigits(state.target, { state: 'locked', hidden: '0' });
      setKicker(ok
        ? `Seed "${state.seed}" · round ${state.round} · target found`
        : `Seed "${state.seed}" · round ${state.round} · best-effort target`);
      state.rollTimeoutId = setTimeout(() => {
        state.rollTimeoutId = null;
        beginPlay();
        // beginPlay is what actually starts the timer interval; clearing
        // beginPending here (after the call) keeps the guard up across
        // the full 500ms seeded settle. A re-entrant Space/Enter
        // during the settle drops silently. A press *after* the settle
        // — when the equation input is focused and a literal " " gets
        // typed — runs the normal playing-phase path, unaffected.
        state.beginPending = false;
      }, TIMING.seedSettleMs);
      // No body phase update here: the seeded path has no rolling
      // animation, so the player is in a brief settled state between
      // idle and playing. beginPlay() sets phase='playing' after the
      // 500ms beat; the global keypress handler is a no-op in this
      // window (no begin/replay intent available mid-settle).
      return;
    }
    // STANDARD: rolling-and-lock path. Clear the target slot — it stays
    // as · · · until the final roll. startRolling transitions to 'rolling'.
    setTargetDigits(new Array(mode.targetDigits).fill(null), { state: 'idle', hidden: '0' });
    startRolling('mat', 0);
    // Clear the guard immediately: there's no settle window in the
    // standard path — startRolling synchronously sets phase='rolling',
    // and any further Space presses hit the rolling branch (lockCurrent),
    // not beginGame.
    state.beginPending = false;
  }

  // ─── key handling ───────────────────────────────────────────
  // Phase-keyed dispatch table. Each handler runs only when the round
  // is in the matching phase and the matching key is pressed. Global
  // concerns (R-tap chain, seed-card focus, overlay Esc, ?, S, E, D, P,
  // R) run above the dispatch in the original ordering.
  const PHASE_HANDLERS = {
    idle: {
      ' ':     (e) => { e.preventDefault(); beginGame(); },
      'Enter': (e) => { e.preventDefault(); beginGame(); },
    },
    rolling: {
      ' ': (e) => {
        e.preventDefault();
        // target auto-locks — don't let the player interrupt
        if (state.rollKind === 'target' && state.targetAutoLock) return;
        if (state.rollId) {
          lockCurrent();
        } else {
          // between materials — no active interval yet. Queue a lock
          // so the next material that starts rolling gets locked
          // immediately.
          state.spamLock = true;
        }
      },
    },
    playing: {
      'Enter': (e) => handleEnter(e),
    },
    ended: {
      ' ': (e) => handleEndedSpace(e),
    },
  };

  // Bad-Enter handling during 'playing': empty submit ends the round
  // with 0; a non-empty bad expression flashes the equation and shows
  // a transient kicker nudge. The nudge is restored to the normal
  // playing kicker after TIMING.flashMs regardless of whether the live
  // eval went back to 'idle' — an older `state === 'idle'` guard meant
  // the kicker stuck on the error for the rest of the round.
  function handleEnter(e) {
    e.preventDefault();
    // Empty submit: end the round with 0 score. Recorded in stats
    // (empty submit counts as a played round, breaking the streak
    // and appending a history row).
    if (!expr.value.trim()) { endRound(false); return; }
    const r = parseAndCheck(expr.value);
    if (!r.ok) {
      equation.dataset.flash = '1';
      const msg = r.error === 'non-integer' ? 'Integer results only · <kbd>enter</kbd> to submit'
                : r.error === 'div/0'        ? 'Can\'t divide by zero · <kbd>enter</kbd> to submit'
                :                                'Fix the expression · <kbd>enter</kbd> to submit';
      setKicker(msg);
      // Cancel any pending restore from a previous bad-Enter press
      // and re-schedule from a single timer, so the animation cadence
      // and the restore window come from the most recent press rather
      // than stacking per-press.
      if (state.flashTimerId) clearTimeout(state.flashTimerId);
      state.flashTimerId = setTimeout(() => {
        state.flashTimerId = null;
        equation.dataset.flash = '0';
        // Restore the normal playing kicker — but only if we're
        // still in the playing phase. (endRound / resetAll may
        // have moved us on; if so, the phase-specific kicker is
        // already set by the phase-transition function.)
        if (state.phase === 'playing') setKicker(buildPlayingKicker());
      }, TIMING.flashMs);
      return;
    }
    endRound(false);
  }

  // Two-step space on the end screen. The result overlay invites a
  // decision: dismiss, or play again? Space on the open overlay just
  // dismisses it (like Esc) so an accidental press doesn't blow away
  // a hard-fought result. A second space (overlay already closed)
  // then commits to playing again. R restarts directly.
  function handleEndedSpace(e) {
    e.preventDefault();
    if (overlay.dataset.open === '1') {
      overlay.dataset.open = '0';
      document.body.dataset.overlayOpen = '0';
      setKicker('Press <kbd>space</kbd> to begin');
    } else {
      resetAll();
      // Track the timer so a wipe that fires in the restartMs window
      // doesn't leave a stale beginGame to re-increment the round.
      if (state.restartTimerId) clearTimeout(state.restartTimerId);
      state.restartTimerId = setTimeout(() => {
        state.restartTimerId = null;
        beginGame();
      }, TIMING.restartMs);
    }
  }

  // R press: stats-overlay reset, R×3 wipe, then phase-specific restart.
  function handleR(e) {
    if (e.repeat) return;  // OS auto-repeat is never a fresh press
    if (stats && stats.dataset.open === '1') {
      e.preventDefault();
      registerResetTap();
      return;
    }
    if (wipeTapTimer) clearTimeout(wipeTapTimer);
    wipeTapCount += 1;
    if (wipeTapCount >= WIPE_TAP_COUNT) {
      renderTapDots('legend-tapdots', WIPE_TAP_COUNT, { fired: true });
      if (wipeFireTimer) clearTimeout(wipeFireTimer);
      wipeFireTimer = setTimeout(() => {
        wipeTapReset();
        wipeFireTimer = null;
      }, TIMING.flashDrainMs);
      wipeSession();
    } else {
      renderTapDots('legend-tapdots', wipeTapCount, { total: WIPE_TAP_COUNT });
      wipeTapTimer = setTimeout(wipeTapReset, WIPE_TAP_GAP_MS);
    }
    if (state.phase === 'idle' || state.phase === 'ended') {
      // R is a no-op in idle/ended (it's a session-wipe key only here,
      // not a begin/play-again key). preventDefault so the browser
      // doesn't do anything weird with it.
      e.preventDefault();
      return;
    }
    if (state.phase === 'playing') {
      e.preventDefault();
      resetAll();
      if (state.restartTimerId) clearTimeout(state.restartTimerId);
      state.restartTimerId = setTimeout(() => {
        state.restartTimerId = null;
        beginGame();
      }, TIMING.restartMs);
      return;
    }
    if (state.phase === 'rolling' && state.rollIndex === 0) {
      // First material hasn't been locked yet — cancel and go back to
      // idle. Undo the round increment beginGame just did: from the
      // player's perspective, the round never really started, so the
      // counter should stay where it was.
      e.preventDefault();
      resetAll();
      state.round -= 1;
      setMetaRound();
    }
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key;

    // R×3 wipe: any non-R keypress breaks the tap chain. Runs at the
    // top so even keys consumed by the seed card input (R, S, D, P, E)
    // reset the counter — the player typing in the seed is not "tapping
    // R for the wipe."
    if (k !== 'r' && k !== 'R' && wipeTapCount > 0) wipeTapReset();

    // seed card input owns Enter (commit) and Escape (close). The ? key
    // is also short-circuited here (so the global handler doesn't open
    // help while the player is in the input) but without preventDefault
    // so the character still types into the seed. Every other key is
    // allowed to fall through to the input's default action — the early
    // `return` keeps the R / S / D / P / E branches below from firing,
    // and the wipe counter is reset on every non-R keypress at the top
    // of this handler, so typing in the seed can't drive the R×3 wipe
    // or any of the global letter shortcuts.
    if (e.target === seedCardInput) {
      if (k === 'Escape') { e.preventDefault(); closeSeedCard(); return; }
      if (k === 'Enter')  { e.preventDefault(); setSeed(seedCardInput.value); closeSeedCard(); return; }
      if (k === '?' || (e.shiftKey && k === '/')) return;
      return;
    }

    // Esc closes any open menu overlay.
    if (k === 'Escape') {
      if (seedCard && seedCard.dataset.open === '1') { e.preventDefault(); closeSeedCard(); return; }
      if (stats && stats.dataset.open === '1')      { e.preventDefault(); closeStats();    return; }
      if (help && help.dataset.open === '1')        {                              closeHelp(); return; }
    }

    // ? opens help (or closes it if already open), after closing stats.
    if (k === '?' || (e.shiftKey && k === '/')) {
      e.preventDefault();
      if (help && help.dataset.open === '1') { closeHelp(); return; }
      if (stats && stats.dataset.open === '1') closeStats();
      openHelp();
      return;
    }

    // S toggles stats (or closes if open), after closing help.
    if (k === 's' || k === 'S') {
      if (e.target === seedCardInput) return;  // see seed card input branch above
      e.preventDefault();
      if (stats && stats.dataset.open === '1') { closeStats(); return; }
      if (help && help.dataset.open === '1') closeHelp();
      openStats();
      return;
    }

    // Phase-specific Esc: clear input (playing), cancel first mat
    // (rolling+rollIndex=0), dismiss overlay (ended).
    if (k === 'Escape') {
      if (state.phase === 'playing') {
        e.preventDefault();
        expr.value = '';
        setLiveEval('');
        return;
      }
      if (state.phase === 'rolling' && state.rollIndex === 0) {
        e.preventDefault();
        resetAll();
        return;
      }
      if (state.phase === 'ended') {
        e.preventDefault();
        overlay.dataset.open = '0';
        document.body.dataset.overlayOpen = '0';
        setKicker('Press <kbd>space</kbd> to begin');
        return;
      }
    }

    // R: stats reset tap, R×3 wipe, or phase-specific restart.
    if (k === 'r' || k === 'R') { handleR(e); return; }

    // E opens/toggles the seed card. The seed card input branch above
    // already short-circuits typing-E-in-seed.
    if (k === 'e' || k === 'E') {
      e.preventDefault();
      if (seedCard && seedCard.dataset.open === '1') closeSeedCard();
      else openSeedCard();
      return;
    }
    // D and P work in every phase. They are not suppressed for the
    // equation input — the player may legitimately want to type "d"
    // or "p" and have the global command still fire.
    if (k === 'd' || k === 'D') { e.preventDefault(); toggleDifficulty(); return; }
    if (k === 'p' || k === 'P') { e.preventDefault(); togglePractice();   return; }

    // Phase-keyed dispatch (space/enter, mostly).
    const phase = PHASE_HANDLERS[state.phase];
    if (phase) {
      const fn = phase[k] || phase['Spacebar'];  // Firefox reports " " vs "Spacebar"
      if (fn) { fn(e); return; }
    }

    // Playing-phase focus: route printable input to the equation field.
    if (state.phase === 'playing' && document.activeElement !== expr) expr.focus();
  });

  // difficulty button (mouse / touch / a11y)
  diffBtn.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on input
  diffBtn.addEventListener('click', () => toggleDifficulty());
  // practice button (mouse / touch / a11y)
  practBtn.addEventListener('mousedown', (e) => e.preventDefault());
  practBtn.addEventListener('click', () => togglePractice());
  // Result overlay buttons: dismiss and replay. The overlay is a modal
  // and intercepts all clicks within its bounds, so nothing behind it
  // is reachable while the overlay is open. These two buttons give
  // mouse users the same two-step affordance Space provides:
  //   dismiss → close overlay, fall back to the idle kicker
  //   replay  → close overlay, reset, begin a new game (matches R)
  if (overlayDismiss) {
    overlayDismiss.addEventListener('mousedown', (e) => e.preventDefault());
    overlayDismiss.addEventListener('click', () => {
      overlay.dataset.open = '0';
      document.body.dataset.overlayOpen = '0';
      setKicker('Press <kbd>space</kbd> to begin');
    });
  }
  if (overlayReplay) {
    overlayReplay.addEventListener('mousedown', (e) => e.preventDefault());
    overlayReplay.addEventListener('click', () => {
      resetAll();
      // Track the timer for the same reason as the R-from-playing path.
      if (state.restartTimerId) clearTimeout(state.restartTimerId);
      state.restartTimerId = setTimeout(() => {
        state.restartTimerId = null;
        beginGame();
      }, TIMING.restartMs);
    });
  }
  // Top-right seed row: click anywhere on the row (label, value, or
  // surrounding whitespace) opens the seed editor card. The × clear
  // button stops propagation so clearing the seed doesn't re-open
  // the card the player just dismissed.
  if (seedRow) {
    seedRow.addEventListener('click', (e) => {
      if (e.target === seedClearTop) return;  // X has its own handler
      openSeedCard();
    });
  }
  // × next to the seed value: clear the seed.
  if (seedClearTop) {
    seedClearTop.addEventListener('mousedown', (e) => e.preventDefault());
    seedClearTop.addEventListener('click', (e) => {
      e.stopPropagation();
      setSeed('');
    });
  }
  // × next to the round value: reset the round counter to 0.
  if (roundClearTop) {
    roundClearTop.addEventListener('mousedown', (e) => e.preventDefault());
    roundClearTop.addEventListener('click', (e) => {
      e.stopPropagation();
      state.round = 0;
      setMetaRound();
      // The × on the round value is a "new session" gesture: wipe both
      // the round counter and the running score, so the next beginGame
      // is round 1 of a fresh session.
      setSessionScore(0);
    });
  }
  // Seed card actions
  if (seedCardRandom) {
    seedCardRandom.addEventListener('mousedown', (e) => e.preventDefault());
    seedCardRandom.addEventListener('click', () => {
      const s = generateSeed();
      setSeed(s);
    });
  }
  if (seedCardClear) {
    seedCardClear.addEventListener('mousedown', (e) => e.preventDefault());
    seedCardClear.addEventListener('click', () => {
      setSeed('');
      if (seedCardInput) seedCardInput.focus();
    });
  }
  if (seedCardShare) {
    seedCardShare.addEventListener('mousedown', (e) => e.preventDefault());
    seedCardShare.addEventListener('click', () => copyShareLink());
  }
  // Apply button: mirror the Enter keydown path in the seed card
  // input (setSeed + closeSeedCard). Missing from the original
  // button row — added so the card is mouse-complete.
  if (seedCardApply) {
    seedCardApply.addEventListener('mousedown', (e) => e.preventDefault());
    seedCardApply.addEventListener('click', () => {
      setSeed(seedCardInput ? seedCardInput.value : '');
      closeSeedCard();
    });
  }
  // Seed card click-outside-to-close
  if (seedCard) {
    seedCard.addEventListener('click', (e) => {
      if (e.target === seedCard) closeSeedCard();
    });
  }

  // boot: pick up ?seed=… from the URL before the first applyDifficulty
  setSeed(getSeedFromURL());
  applyDifficulty();

  // live eval on input
  expr.addEventListener('input', () => setLiveEval(expr.value));

  // dismiss overlay on click-outside-paper (matches help/stats behavior)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && state.phase === 'ended') {
      overlay.dataset.open = '0';
      document.body.dataset.overlayOpen = '0';
      setKicker('Press <kbd>space</kbd> to begin');
    }
  });
  help.addEventListener('click', (e) => {
    if (e.target === help) closeHelp();
  });
  if (stats) {
    stats.addEventListener('click', (e) => {
      if (e.target === stats) closeStats();
    });
  }

  // "Reset progress" — destructive. Two equal-weight entry points:
  //   • tap R five times (within 1.5s gaps) while the stats overlay is open
  //   • hold the button down for 1 full second
  // Either fires the reset. No progress bar, no segment strip — the
  // action itself is the confirmation.
  const RESET_TAPS = 5;
  const RESET_TAP_GAP_MS = 1500;
  const RESET_HOLD_MS = 1000;
  let resetTapCount = 0;
  let resetTapTimer = null;
  // Drained after the destructive reset fires, so the all-red flash
  // gets its full ~300ms before the dots clear. Cleared on stats
  // close (via resetTapState) so a fast open/close doesn't strand
  // the timer.
  let resetFireTimer = null;

  // R×3 session-wipe: 3 R presses within WIPE_TAP_GAP_MS gaps clears
  // the seed, round counter, and session score. The first two presses
  // do their normal phase-appropriate R work; the third press fires
  // wipeSession() in addition. Suppressed when the stats overlay is
  // open (the R×5 stats-wipe owns R there). Any non-R keydown also
  // resets the counter so accidental intervening input breaks the
  // chain.
  const WIPE_TAP_COUNT = 3;
  const WIPE_TAP_GAP_MS = 1500;
  let wipeTapCount = 0;
  let wipeTapTimer = null;
  // Drained after the destructive wipe fires, so the all-red flash
  // gets its full ~300ms before the dots clear.
  let wipeFireTimer = null;

  function wipeTapReset() {
    if (wipeTapTimer) { clearTimeout(wipeTapTimer); wipeTapTimer = null; }
    if (wipeFireTimer) { clearTimeout(wipeFireTimer); wipeFireTimer = null; }
    wipeTapCount = 0;
    renderTapDots('legend-tapdots', 0);
  }
  function resetTapState() {
    if (resetTapTimer) { clearTimeout(resetTapTimer); resetTapTimer = null; }
    if (resetFireTimer) { clearTimeout(resetFireTimer); resetFireTimer = null; }
    resetTapCount = 0;
    renderTapDots('stats-tapdots', 0);
  }
  // the .tapdots container; its children are .tapdots__dot spans.
  // Three dot states are possible at any time:
  //   filled   (data-on="1")    — settled ink
  //   just     (data-just="1")  — accent red, scaled 1.4×, on the dot
  //                              that was most recently filled
  //   armed    (data-armed="1") — accent red, pulsing, on the next dot
  //                              to be filled. The "next press will
  //                              fire the destructive action" warning.
  // The host gets the .tapdots--fired class to flash all dots red as
  // a completion confirmation when the gesture fires. fired=true and
  // count>=total both clear any individual per-dot state; the host
  // class drives the visual.
  function renderTapDots(hostId, count, opts) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const total = (opts && opts.total) || host.querySelectorAll('.tapdots__dot').length;
    const fired = !!(opts && opts.fired);
    const dots = host.querySelectorAll('.tapdots__dot');
    dots.forEach((dot, i) => {
      const on = !fired && i < count;
      const just = !fired && on && i === count - 1;
      const armed = !fired && !just && i === count && count > 0 && count < total;
      dot.dataset.on = on ? '1' : '0';
      dot.dataset.just = just ? '1' : '0';
      dot.dataset.armed = armed ? '1' : '0';
    });
    host.classList.toggle('tapdots--fired', fired);
  }
  // Called from the global R-key handler when stats is open. Counts
  // each R press; 5 within the gap window fires the reset. On fire,
  // all 5 dots flash red for ~300ms before clearing — gives the
  // player a visual confirmation that the destructive action ran.
  function registerResetTap() {
    if (resetTapTimer) clearTimeout(resetTapTimer);
    resetTapCount += 1;
    if (resetTapCount >= RESET_TAPS) {
      // Flash the row red, wipe, then drain after the flash.
      renderTapDots('stats-tapdots', RESET_TAPS, { fired: true });
      if (resetFireTimer) clearTimeout(resetFireTimer);
      resetFireTimer = setTimeout(() => {
        resetTapState();
        resetFireTimer = null;
      }, TIMING.flashDrainMs);
      triggerReset();
      return;
    }
    renderTapDots('stats-tapdots', resetTapCount, { total: RESET_TAPS });
    resetTapTimer = setTimeout(resetTapState, RESET_TAP_GAP_MS);
  }

  // The single destructive action. Wipes the stats record from
  // localStorage and re-renders the now-empty overlay.
  function triggerReset() {
    wipeStats();
    renderStats();
  }
  // or touch-cancel before 1s aborts. No visual progress on the button.
  if (statsResetBtn) {
    let holdTimer = null;
    function cancelHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }
    statsResetBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      cancelHold();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        triggerReset();
      }, RESET_HOLD_MS);
    });
    statsResetBtn.addEventListener('mouseup', cancelHold);
    statsResetBtn.addEventListener('mouseleave', cancelHold);
    statsResetBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      cancelHold();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        triggerReset();
      }, RESET_HOLD_MS);
    }, { passive: false });
    statsResetBtn.addEventListener('touchend', cancelHold);
    statsResetBtn.addEventListener('touchcancel', cancelHold);
  }

  // When the stats overlay closes, forget any in-flight tap sequence
  // (e.g., 3/5 taps then the user pressed esc). Resets the counter.
  if (stats) {
    stats.addEventListener('transitionend', (e) => {
      if (e.target === stats && stats.dataset.open === '0') resetTapState();
    });
  }

  // ─── boot ───────────────────────────────────────────────────
  // Clone the 3-digit stats section for 4 and 5. The 3-digit section
  // is the template in HTML; doing it here (vs. inside renderStats)
  // means the DOM structure is stable before any overlay is opened.
  function buildStatsSections() {
    if (!stats) return;
    const host = stats.querySelector('.stats__sections');
    if (!host) return;
    const tmpl = host.querySelector('.stats__section');
    if (!tmpl) return;
    for (const d of ['4', '5']) {
      const clone = tmpl.cloneNode(true);
      clone.dataset.difficulty = d;
      const heading = clone.querySelector('.stats__heading');
      if (heading) heading.textContent = `${d}–digit`;
      host.appendChild(clone);
    }
  }
  buildStatsSections();
  resetAll();
})();
