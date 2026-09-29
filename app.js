const KEY = 'juststart.v1';
const DAY = 86400000;
const $ = id => document.getElementById(id);

const state = load();
function load() {
  try { return Object.assign({ tasks: [], done: 0, streak: 0, lastDoneDay: null, interval: 30, lastNudge: 0 },
    JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return { tasks: [], done: 0, streak: 0, lastDoneDay: null, interval: 30, lastNudge: 0 }; }
}
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const today = () => new Date().toISOString().slice(0, 10);

// Avoidance score: older, more dreaded, more-skipped, and overdue tasks rise to the top.
function score(t) {
  const ageDays = (Date.now() - t.created) / DAY;
  let s = ageDays + t.dread * 1.5 + t.skips * 2;
  if (t.due) {
    const daysLeft = (new Date(t.due) - Date.now()) / DAY;
    if (daysLeft < 0) s += 10 + -daysLeft; else if (daysLeft < 2) s += 5;
  }
  return s;
}
const pending = () => state.tasks.filter(t => !t.doneAt).sort((a, b) => score(b) - score(a));
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


// ---- Pip, the mascot ----
const FACES = {
  hello: '<circle class="eye" cx="72" cy="92" r="8"/><circle class="eye" cx="128" cy="92" r="8"/><path class="line" d="M88 110 Q100 122 112 110"/>',
  cheer: '<path class="line" d="M62 96 Q72 84 82 96"/><path class="line" d="M118 96 Q128 84 138 96"/><path class="line" d="M84 108 Q100 130 116 108 Z" fill="#ff8fab"/>',
  party: '<path class="line" d="M62 96 Q72 84 82 96"/><path class="line" d="M118 96 Q128 84 138 96"/><path d="M84 106 Q100 136 116 106 Z" fill="#ff6b8b" stroke="#4a3b47" stroke-width="4" stroke-linejoin="round"/>',
  sad:   '<circle class="eye" cx="72" cy="96" r="8"/><circle class="eye" cx="128" cy="96" r="8"/><ellipse class="tear" cx="72" cy="112" rx="4" ry="6"/><path class="line" d="M88 122 Q100 110 112 122"/>',
  sleepy:'<path class="line" d="M62 94 Q72 102 82 94"/><path class="line" d="M118 94 Q128 102 138 94"/><path class="line" d="M92 114 Q100 120 108 114"/><text x="150" y="60" font-size="22" fill="#a08c9b">z</text>',
  focus: '<circle class="eye" cx="72" cy="92" r="8"/><circle class="eye" cx="128" cy="92" r="8"/><path class="line" d="M64 78 L82 82"/><path class="line" d="M136 78 L118 82"/><path class="line" d="M90 114 L110 114"/>'
};
function pip(mood, say) {
  $('face').innerHTML = FACES[mood];
  $('pip').setAttribute('class', 'pip ' + ({ cheer: 'cheer', party: 'party', sad: 'sad' }[mood] || ''));
  if (say) $('bubble').textContent = say;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function idleMood(top) {
  if (!top) return pip('sleepy', pick(['No dodged things! Pip is napping… 💤', 'All clear. Want to add something?']));
  if (top.skips >= 3) return pip('sad', `We've dodged "${top.title}" ${top.skips} times… just 2 minutes? 🥺`);
  if (top.skips >= 1) return pip('hello', pick([`"${top.title}" misses us! Tiny start?`, 'Pip believes in you! ✨']));
  pip('hello', pick([`Hi! Wanna start "${top.title}" together? 🌸`, `Just 2 minutes on "${top.title}" — then you can stop!`, 'Small steps count. Pip is right here. 🐾']));
}
function confetti() {
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.textContent = pick(['🌸', '✨', '💖', '⭐', '🎀', '🍓']);
    c.style.left = Math.random() * 100 + 'vw';
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}
$('pip').onclick = $('bubble').onclick = () => { if (!timerId) idleMood(pending()[0]); };

function nudgeText(t) {
  if (!t) return '';
  if (t.skips >= 3) return `Pip is sad 🥺 "${t.title}" has been dodged ${t.skips} times. Just 2 minutes?`;
  if (t.skips >= 1) return `Psst… "${t.title}" is still waiting. Tiny start? 🌱`;
  return `Hi! Wanna start "${t.title}" together? Only 2 minutes 🌸`;
}

function render() {
  const list = pending(), top = list[0];
  $('streak').textContent = state.streak ? `🔥 ${state.streak}-day streak` : '';
  $('doneCount').textContent = `${state.done} done`;
  $('empty').hidden = list.length > 0;
  $('list').innerHTML = list.map(t => `
    <li>
      <div class="t">${esc(t.title)}<small>${Math.floor((Date.now() - t.created) / DAY)}d old · dodged ${t.skips}×${t.due ? ' · due ' + t.due : ''}</small></div>
      ${t.dread >= 4 ? '<span class="pill hot">scary 😱</span>' : ''}
      <button data-focus="${t.id}">Start 🌸</button>
      <button data-del="${t.id}" class="ghost" title="Delete">✕</button>
    </li>`).join('');
  const f = $('focus');
  if (!timerId) idleMood(top);
  if (!top) { f.hidden = true; return; }
  if (!timerId && (!cur() || cur().doneAt)) showFocus(top);
  const c = cur();
  if (c) $('focusMeta').textContent = `Scariness ${'💢'.repeat(c.dread)} · dodged ${c.skips}×`;
}

let focusId = null, timerId = null, endsAt = 0, totalMs = 1;
function showFocus(t) {
  focusId = t.id;
  $('focus').hidden = false;
  $('focusTitle').textContent = t.title;
  $('focusMeta').textContent = `Scariness ${'💢'.repeat(t.dread)} · dodged ${t.skips}×`;
  $('focusStep').value = t.step || '';
}
const cur = () => state.tasks.find(t => t.id === focusId);

function startTimer(mins, msg) {
  const t = cur(); if (!t) return;
  t.step = $('focusStep').value.trim(); save();
  totalMs = mins * 60000; endsAt = Date.now() + totalMs;
  pip('focus', pick(['You got this! Pip is right here 🐾', 'Just this one thing. Pip will watch.', 'Nothing else matters for now 🌸']));
  $('timer').hidden = false; $('focusActions').hidden = true; $('timerActions').hidden = true;
  $('timerMsg').textContent = msg;
  tick();
  timerId = setInterval(tick, 500);
}
function tick() {
  const left = Math.max(0, endsAt - Date.now());
  const m = String(Math.floor(left / 60000)).padStart(2, '0'), s = String(Math.floor(left / 1000) % 60).padStart(2, '0');
  $('clock').textContent = `${m}:${s}`;
  $('arc').style.strokeDashoffset = 326.7 * (1 - left / totalMs);
  if (left > 0) pip(left / totalMs < 0.5 ? 'cheer' : 'focus');
  if (left === 0) {
    stopTimer();
    $('timer').hidden = false;
    $('timerMsg').textContent = "You started! That was the hard part 💖";
    pip('party', 'YOU DID IT!! You started! Keep going? ✨');
    confetti();
    $('timerActions').hidden = false;
    notify('Pip is so proud 💖', 'You started! Keep going or mark it done.');
  }
}
function stopTimer() { clearInterval(timerId); timerId = null; }
function resetFocusUI() {
  stopTimer(); $('timer').hidden = true; $('timerActions').hidden = true; $('focusActions').hidden = false; render();
}
function complete() {
  const t = cur(); if (!t) return;
  t.doneAt = Date.now(); state.done++;
  const d = today();
  if (state.lastDoneDay !== d) {
    const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    state.streak = state.lastDoneDay === y ? state.streak + 1 : 1;
    state.lastDoneDay = d;
  }
  save(); resetFocusUI();
  pip('party', 'One less thing!! Pip is SO proud of you 🎉');
  confetti();
}

let bannerTimer;
function banner(text, sticky) {
  const b = $('banner'); b.textContent = text; b.hidden = false;
  clearTimeout(bannerTimer);
  if (!sticky) bannerTimer = setTimeout(() => b.hidden = true, 6000);
}
$('banner').onclick = () => { $('banner').hidden = true; $('focus').scrollIntoView({ behavior: 'smooth' }); };

function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); return; } catch {}
  }
  banner(`${title}: ${body}`, true);
}

function maybeNudge() {
  const top = pending()[0];
  if (!top || !state.interval || timerId) return;
  if (Date.now() - state.lastNudge < state.interval * 60000) return;
  state.lastNudge = Date.now(); save();
  notify('Pip 🐾', nudgeText(top));
}

$('addForm').onsubmit = e => {
  e.preventDefault();
  state.tasks.push({ id: Date.now().toString(36), title: $('title').value.trim(), dread: +$('dread').value,
    due: $('due').value || null, created: Date.now(), skips: 0, step: '', doneAt: null });
  save(); e.target.reset(); $('dread').value = '3'; render();
};
$('list').onclick = e => {
  const f = e.target.dataset.focus, d = e.target.dataset.del;
  if (f && !timerId) { showFocus(state.tasks.find(t => t.id === f)); $('focus').scrollIntoView({ behavior: 'smooth' }); }
  if (d) { state.tasks = state.tasks.filter(t => t.id !== d); save(); render(); }
};
$('sprintBtn').onclick = () => startTimer(2, 'Just this. Nothing else matters for 2 minutes.');
$('keepBtn').onclick = () => startTimer(25, 'Deep focus. Phone away.');
$('doneBtn').onclick = complete;
$('finishBtn').onclick = complete;
$('stopBtn').onclick = () => { const t = cur(); if (t) { t.skips++; save(); } resetFocusUI(); };
$('skipBtn').onclick = () => {
  const t = cur(); if (!t) return;
  t.skips++; save();
  
  render();
  if (t.skips >= 3) pip('sad', `That's ${t.skips} dodges… Pip will wait, but just 2 minutes? 🥺`);
  else pip('hello', 'Okay! Pip will remind you gently 🌷');
};
$('interval').value = String(state.interval);
$('interval').onchange = e => { state.interval = +e.target.value; save(); };
$('notifBtn').onclick = async () => {
  if (!('Notification' in window)) return banner('Notifications not supported in this browser.');
  const p = await Notification.requestPermission();
  $('notifBtn').textContent = p === 'granted' ? 'Pokes on ✓' : 'Pokes blocked 😢';
};
if ('Notification' in window && Notification.permission === 'granted') $('notifBtn').textContent = 'Pokes on ✓';

render();
setInterval(maybeNudge, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeNudge(); });
