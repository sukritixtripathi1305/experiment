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

function nudgeText(t) {
  if (!t) return '';
  if (t.skips >= 3) return `"${t.title}" has been dodged ${t.skips} times. Two minutes. That's the whole ask.`;
  if (t.skips >= 1) return `Still there: "${t.title}". Just open it.`;
  return `Time to start: "${t.title}". Two minutes, then you may stop.`;
}

function render() {
  const list = pending(), top = list[0];
  $('streak').textContent = state.streak ? `🔥 ${state.streak}-day streak` : '';
  $('doneCount').textContent = `${state.done} done`;
  $('empty').hidden = list.length > 0;
  $('list').innerHTML = list.map(t => `
    <li>
      <div class="t">${esc(t.title)}<small>${Math.floor((Date.now() - t.created) / DAY)}d old · skipped ${t.skips}×${t.due ? ' · due ' + t.due : ''}</small></div>
      ${t.dread >= 4 ? '<span class="pill hot">dreaded</span>' : ''}
      <button data-focus="${t.id}">Do this</button>
      <button data-del="${t.id}" class="ghost" title="Delete">✕</button>
    </li>`).join('');
  const f = $('focus');
  if (!top) { f.hidden = true; return; }
  if (!timerId && (!cur() || cur().doneAt)) showFocus(top);
}

let focusId = null, timerId = null, endsAt = 0;
function showFocus(t) {
  focusId = t.id;
  $('focus').hidden = false;
  $('focusTitle').textContent = t.title;
  $('focusMeta').textContent = `Dread ${t.dread}/5 · ${t.skips} skips`;
  $('focusStep').value = t.step || '';
}
const cur = () => state.tasks.find(t => t.id === focusId);

function startTimer(mins, msg) {
  const t = cur(); if (!t) return;
  t.step = $('focusStep').value.trim(); save();
  endsAt = Date.now() + mins * 60000;
  $('timer').hidden = false; $('focusActions').hidden = true; $('timerActions').hidden = true;
  $('timerMsg').textContent = msg;
  tick();
  timerId = setInterval(tick, 500);
}
function tick() {
  const left = Math.max(0, endsAt - Date.now());
  const m = String(Math.floor(left / 60000)).padStart(2, '0'), s = String(Math.floor(left / 1000) % 60).padStart(2, '0');
  $('clock').textContent = `${m}:${s}`;
  if (left === 0) {
    stopTimer();
    $('timer').hidden = false;
    $('timerMsg').textContent = "Time's up. You started. Momentum is the hard part — keep going?";
    $('timerActions').hidden = false;
    notify('Sprint finished', 'You started. Keep going or mark it done.');
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
  banner('Done. That one is off your back. 🎉');
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
  notify('Just Start', nudgeText(top));
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
  banner(t.skips >= 3 ? "That's skip #" + t.skips + ". It's not going away — try the 2-minute sprint." : 'Okay. It will be back.');
  render();
};
$('interval').value = String(state.interval);
$('interval').onchange = e => { state.interval = +e.target.value; save(); };
$('notifBtn').onclick = async () => {
  if (!('Notification' in window)) return banner('Notifications not supported in this browser.');
  const p = await Notification.requestPermission();
  $('notifBtn').textContent = p === 'granted' ? 'Notifications on ✓' : 'Notifications blocked';
};
if ('Notification' in window && Notification.permission === 'granted') $('notifBtn').textContent = 'Notifications on ✓';

render();
setInterval(maybeNudge, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeNudge(); });
