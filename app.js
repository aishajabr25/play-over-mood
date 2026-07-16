/* ════════════════════════════════════════════════════════════
   نلعب على مزاجنا — Live version (Firebase Firestore)
   البيانات مشتركة بين الجميع. المشرفة تسجّل دخولها بحساب Google.
   ════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut, linkWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where,
  onSnapshot, addDoc, updateDoc, deleteDoc, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAcz2piDF7lvKygGy5eVf8RESiLFqgvt38",
  authDomain: "play-over-mood.firebaseapp.com",
  projectId: "play-over-mood",
  storageBucket: "play-over-mood.firebasestorage.app",
  messagingSenderId: "992991212281",
  appId: "1:992991212281:web:e977b1e7bf362b9f9ce828"
};

const ADMIN_EMAIL = 'aisha.jabr.3aosh@gmail.com';
const ADMIN_NAME  = 'عَئْوش؛';

const fb   = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db   = getFirestore(fb);

/* ── العناصر والمهمات ────────────────────────────────────── */
const WORLDS = {
  physical:  { ar: 'العنصر الجسدي',  en: 'Physical',      color: '#7BBBD4' },
  spiritual: { ar: 'العنصر الروحي',  en: 'Spiritual',     color: '#5EAF7A' },
  mental:    { ar: 'العنصر الذهني',  en: 'Mental',        color: '#8B7CC0' },
  emotional: { ar: 'العنصر العاطفي', en: 'Emotional',     color: '#D4819C' },
  env:       { ar: 'العنصر البيئي',  en: 'Environmental', color: '#4EA89E' },
};
const LEGENDARY_COLOR = '#CFA94A';

const HABITS = [
  {
    id: 'sleep', ar: 'النوم المبكر', en: 'Early Sleep', emoji: '🌙', world: 'physical', legendary: true,
    quote: '«كان رسول الله ﷺ يكره النوم قبل العشاء والحديث بعدها»',
    source: 'متفق عليه',
    science: 'النوم هو المهمة التي تفتح بقية المهمات: يضبط هرمونات الجوع والشبع (اللبتين والجريلين) والكورتيزول والمزاج، ويحدد قدرتك على الاستيقاظ للفجر وطاقتك للحركة وتركيزك للتعلم. لذلك هي مهمة أسطورية بنقطتين.'
  },
  {
    id: 'fajr', ar: 'الاستيقاظ بعد الفجر', en: 'Awake after Fajr', emoji: '🌅', world: 'spiritual',
    quote: '«اللهم بارك لأمتي في بكورها»',
    source: 'رواه أبو داود والترمذي — دعاء النبي ﷺ بالبركة في أول النهار',
    science: 'التعرض لضوء الصباح الباكر يضبط الساعة البيولوجية ويحسّن النوم والمزاج. دراسة على أكثر من ٨٠٠ ألف شخص (JAMA Psychiatry 2021) وجدت أن تقديم منتصف النوم ساعة واحدة يرتبط بانخفاض خطر الاكتئاب بنحو ٢٣٪.'
  },
  {
    id: 'athkar', ar: 'أذكار الصباح والمساء', en: 'Morning & Evening Adhkar', emoji: '📿', world: 'spiritual',
    quote: '﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾',
    source: 'سورة الرعد — ٢٨',
    science: 'ممارسات الذكر والامتنان اليومية المنتظمة ترتبط في الدراسات بانخفاض التوتر وتحسّن الرضا عن الحياة، ومنها تجارب Emmons & McCullough (2003) على أثر الامتنان اليومي في المزاج وجودة النوم.'
  },
  {
    id: 'quran', ar: 'قراءة وِرد من القرآن', en: 'Daily Quran Portion', emoji: '📖', world: 'spiritual',
    quote: '«اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعًا لأصحابه»',
    source: 'رواه مسلم',
    science: 'دراسات على تلاوة القرآن والاستماع إليه سجّلت انخفاضًا في مؤشرات القلق وضغط الدم ومعدل ضربات القلب. كما أن القراءة اليومية المنتظمة عمومًا ترتبط ببناء احتياطي معرفي يحمي الذاكرة مع التقدم في العمر.'
  },
  {
    id: 'walk', ar: 'المشي / حركة يومية', en: 'Daily Walk / Movement', emoji: '🚶🏻‍♀️', world: 'physical',
    quote: '«المؤمن القوي خير وأحب إلى الله من المؤمن الضعيف»',
    source: 'رواه مسلم',
    science: 'تحليل شامل في The Lancet Public Health (2022) على أكثر من ٤٧ ألف شخص وجد أن ٧ آلاف خطوة يوميًا تقريبًا ترتبط بانخفاض خطر الوفاة المبكرة بنسبة تصل إلى ٥٠٪ مقارنة بقلة الحركة.'
  },
  {
    id: 'water', ar: 'شرب الماء الكافي', en: 'Enough Water', emoji: '💧', world: 'physical',
    quote: '﴿وَجَعَلْنَا مِنَ الْمَاءِ كُلَّ شَيْءٍ حَيٍّ﴾',
    source: 'سورة الأنبياء — ٣٠',
    science: 'حتى الجفاف الخفيف (١–٢٪ من وزن الجسم) يؤثر في الدراسات المضبوطة على التركيز والمزاج ويزيد الصداع والتعب، وشرب الماء الكافي يحسّن اليقظة والأداء الذهني خلال اليوم.'
  },
  {
    id: 'learn', ar: 'تعلّم شيء جديد', en: 'Learn Something New', emoji: '🎧', world: 'mental',
    quote: '«من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة»',
    source: 'رواه مسلم',
    science: 'تعلّم مهارات ومعارف جديدة يبني «الاحتياطي المعرفي» — مرونة عصبية تحمي الذاكرة والدماغ مع التقدم في العمر، وترتبط في الدراسات بتأخر ظهور أعراض التدهور المعرفي.'
  },
  {
    id: 'recharge', ar: 'جلسة في الطبيعة أو مع صديقة', en: 'Nature or a Friend', emoji: '🌳', world: 'emotional',
    quote: '﴿وَيَتَفَكَّرُونَ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ﴾',
    source: 'سورة آل عمران — ١٩١',
    science: 'مشي ٩٠ دقيقة في الطبيعة قلّل الاجترار الذهني ونشاط مناطق القلق في الدماغ (دراسة ستانفورد Bratman 2015)، ودراسة هارفارد الممتدة ٨٥ عامًا وجدت أن دفء العلاقات هو أقوى مؤشر للسعادة والصحة على المدى الطويل.'
  },
  {
    id: 'tidy', ar: 'ترتيب مساحتك', en: 'Tidy Your Space', emoji: '🧺', world: 'env',
    quote: '«الطُّهور شطر الإيمان»',
    source: 'رواه مسلم',
    science: 'دراسة UCLA (Saxbe & Repetti 2010) وجدت أن من يصفن بيوتهن بالفوضى ترتفع لديهن مستويات الكورتيزول (هرمون التوتر) خلال اليوم، وأبحاث برينستون (2011) أظهرت أن الفوضى البصرية تنافس انتباهك وتقلل تركيزك.'
  },
  {
    id: 'goodtrace', ar: 'أثر طيب في محيطك', en: 'Leave a Good Trace', emoji: '🕊️', world: 'env',
    quote: '«وإماطة الأذى عن الطريق صدقة»',
    source: 'متفق عليه',
    science: 'أفعال الخير الصغيرة تفيد فاعلها قبل محيطها: تجارب عشوائية (منها Dunn وزملاؤها 2008 في مجلة Science) وجدت أن إنفاق الوقت أو المال لأجل الآخرين يرفع سعادة الفاعل قياسًا أكثر من صرفه على النفس.'
  },
];

function habitColor(h)  { return h.legendary ? LEGENDARY_COLOR : WORLDS[h.world].color; }
function habitPoints(h) { return h.legendary ? 2 : 1; }

/* ── Helpers ─────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function weekStart(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay()); /* بداية الأسبوع = الأحد */
  x.setHours(0, 0, 0, 0);
  return x;
}
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}

/* ── State ───────────────────────────────────────────────── */
let me        = null;   // Firebase user (anonymous أو Google للمشرفة)
let isAdmin   = false;
let nickname  = localStorage.getItem('pom_nick') || null;
let myToday   = {};     // مهمات اليوم (نسخة محلية فورية)
let rangeDocs = [];     // سجلات آخر ١٤ يومًا للجميع
let postsCache = [];
let listenersStarted = false;

/* ── Auth ────────────────────────────────────────────────── */
onAuthStateChanged(auth, async user => {
  if (!user) {
    signInAnonymously(auth).catch(() =>
      showToast('تعذر الاتصال — تأكدي من تفعيل Anonymous في Firebase'));
    return;
  }
  const switched = me && me.uid !== user.uid;
  me = user;
  isAdmin = !!user.email && user.email.toLowerCase() === ADMIN_EMAIL;

  if (isAdmin && !nickname) {
    nickname = ADMIN_NAME;
    localStorage.setItem('pom_nick', nickname);
  }
  /* حساب Google مربوط سابقًا؟ استرجعي الاسم المحفوظ */
  if (!nickname && !user.isAnonymous) {
    const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
    if (snap && snap.exists() && snap.data().nick) {
      nickname = snap.data().nick;
      localStorage.setItem('pom_nick', nickname);
      showToast(`أهلًا بعودتك ${nickname} 💕`);
    }
  }
  /* عند تبديل الحساب: أعيدي حساب مهمات اليوم من بيانات الحساب الجديد */
  if (switched) {
    const mine = rangeDocs.find(r => r.uid === me.uid && r.date === dateKey(new Date()));
    myToday = mine ? { ...mine.habits } : {};
  }

  updateAdminUi();
  updateSyncUi();
  startListeners();
  initGate();
});

/* ── ربط التقدم بحساب Google (اختياري للمشاركات) ─────────── */
async function linkGoogle() {
  if (!me) return;
  try {
    await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
    me = auth.currentUser;
    isAdmin = !!me.email && me.email.toLowerCase() === ADMIN_EMAIL;
    if (nickname) setDoc(doc(db, 'users', me.uid), { nick: nickname, updated: Date.now() }, { merge: true }).catch(() => {});
    showToast('تم ربط حسابك ☀️ تقدمك الآن يتبعك على أي جهاز');
    updateAdminUi();
    updateSyncUi();
  } catch (e) {
    if (e && e.code === 'auth/credential-already-in-use') {
      /* الحساب مربوط بهوية سابقة — ادخلي بها بدل إنشاء جديدة */
      localStorage.removeItem('pom_nick');
      nickname = null;
      try { await signInWithPopup(auth, new GoogleAuthProvider()); }
      catch { showToast('لم يكتمل تسجيل الدخول'); }
    } else {
      showToast('لم يكتمل الربط — حاولي مرة أخرى');
    }
  }
}

function updateSyncUi() {
  /* زر "احفظي تقدمك" في سطر الترحيب */
  const row = document.querySelector('.hello-row');
  if (row) {
    let btn = document.getElementById('sync-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'sync-btn';
      btn.className = 'change-nick';
      btn.addEventListener('click', linkGoogle);
      row.insertBefore(btn, document.getElementById('change-nick'));
    }
    if (!me || isAdmin) {
      btn.hidden = true;
    } else if (me.isAnonymous) {
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = '☁️ احفظي تقدمك (ربط بحساب Google)';
    } else {
      btn.hidden = false;
      btn.disabled = true;
      btn.style.textDecoration = 'none';
      btn.style.cursor = 'default';
      btn.textContent = '✓ تقدمك محفوظ ويتبعك على أجهزتك 🤍';
    }
  }
  /* زر الدخول على شاشة الاسم لمن ربطت حسابها سابقًا */
  const gate = document.getElementById('nick-gate');
  if (gate && !document.getElementById('gate-google')) {
    const g = document.createElement('button');
    g.id = 'gate-google';
    g.type = 'button';
    g.className = 'change-nick';
    g.style.marginTop = '14px';
    g.textContent = 'سبق وربطتِ تقدمك بحساب Google؟ ادخلي من هنا';
    g.addEventListener('click', async () => {
      try { await signInWithPopup(auth, new GoogleAuthProvider()); }
      catch { showToast('لم يكتمل تسجيل الدخول'); }
    });
    gate.appendChild(g);
  }
}

/* ── Live listeners ──────────────────────────────────────── */
function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;

  const from = dateKey(daysAgo(13));
  onSnapshot(
    query(collection(db, 'logs'), where('date', '>=', from)),
    snap => {
      rangeDocs = snap.docs.map(d => d.data());
      const mine = rangeDocs.find(r => r.uid === me.uid && r.date === dateKey(new Date()));
      if (mine) myToday = { ...mine.habits };
      renderHabits();
      renderLeaderboard();
      renderCharts();
    },
    () => showToast('تعذر تحميل البيانات — تأكدي من إنشاء Firestore وقواعد الحماية')
  );

  onSnapshot(
    query(collection(db, 'posts'), orderBy('time', 'desc'), limit(100)),
    snap => {
      postsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPosts();
    },
    () => {}
  );
}

/* ── Nickname gate ───────────────────────────────────────── */
function initGate() {
  const gate = document.getElementById('nick-gate');
  const app  = document.getElementById('app');
  if (nickname) {
    gate.hidden = true; app.hidden = false;
    document.getElementById('hello-nick').textContent = nickname;
    renderHabits();
    renderLeaderboard();
    renderCharts();
    renderPosts();
  } else {
    gate.hidden = false; app.hidden = true;
  }
}

document.getElementById('nick-form').addEventListener('submit', async e => {
  e.preventDefault();
  const val = document.getElementById('nick-input').value.trim();
  if (!val || !me) return;
  nickname = val;
  localStorage.setItem('pom_nick', nickname);
  setDoc(doc(db, 'users', me.uid), { nick: nickname, updated: Date.now() }, { merge: true }).catch(() => {});
  showToast(`أهلًا ${nickname} — بدأ تحديك ☀️`);
  initGate();
});

document.getElementById('change-nick').addEventListener('click', () => {
  nickname = null;
  localStorage.removeItem('pom_nick');
  initGate();
});

/* ── Today's quests ──────────────────────────────────────── */
async function toggleHabit(h) {
  if (!me || !nickname) return;
  myToday[h.id] = !myToday[h.id];
  renderHabits();          // تحديث فوري
  renderLeaderboard();
  if (myToday[h.id]) {
    showToast(h.legendary
      ? `مهمة أسطورية! "${h.ar}" = نقطتان ⭐🤙`
      : `أحسنتِ! "${h.ar}" 🤙`);
  }
  const date   = dateKey(new Date());
  const week   = dateKey(weekStart(new Date()));
  const points = HABITS.reduce((s, x) => s + (myToday[x.id] ? habitPoints(x) : 0), 0);
  try {
    await setDoc(doc(db, 'logs', `${me.uid}_${date}`),
      { uid: me.uid, nick: nickname, date, week, habits: myToday, points },
      { merge: true });
  } catch {
    showToast('تعذر الحفظ — تحققي من الاتصال بالإنترنت');
  }
}

function renderHabits() {
  const grid = document.getElementById('habits-grid');
  if (!grid) return;
  grid.innerHTML = '';

  HABITS.forEach(h => {
    const el = document.createElement('div');
    el.className = 'habit-check' + (myToday[h.id] ? ' done' : '') + (h.legendary ? ' legendary' : '');
    el.style.borderInlineStartColor = habitColor(h);
    el.innerHTML = `
      ${h.legendary ? '<span class="legendary-badge">⭐ أسطورية ×٢</span>' : ''}
      <div class="habit-box">✓</div>
      <div class="habit-check-info">
        <div class="habit-check-ar">${h.ar}</div>
        <div class="habit-check-en">${h.en}</div>
      </div>
      <div class="habit-emoji">${h.emoji}</div>`;
    el.addEventListener('click', () => toggleHabit(h));
    grid.appendChild(el);
  });

  const done = HABITS.filter(h => myToday[h.id]).length;
  document.getElementById('today-bar-fill').style.width = `${(done / HABITS.length) * 100}%`;
  document.getElementById('today-count').textContent =
    done === HABITS.length ? `${done}/${HABITS.length} — يوم كامل! 💖` : `${done}/${HABITS.length}`;

  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── Worlds legend + why cards (ثابتة) ───────────────────── */
function renderWorldsLegend() {
  const el = document.getElementById('worlds-legend');
  el.innerHTML = '';
  Object.values(WORLDS).forEach(w => {
    const item = document.createElement('span');
    item.className = 'world-item';
    item.innerHTML = `<span class="world-dot" style="background:${w.color}"></span>${w.ar}`;
    el.appendChild(item);
  });
  const leg = document.createElement('span');
  leg.className = 'world-item';
  leg.innerHTML = `<span class="world-dot" style="background:${LEGENDARY_COLOR}"></span>مهمة أسطورية ⭐`;
  el.appendChild(leg);
}

function renderWhy() {
  const grid = document.getElementById('why-grid');
  grid.innerHTML = '';
  HABITS.forEach(h => {
    const el = document.createElement('div');
    el.className = 'why-card';
    el.style.borderTopColor = habitColor(h);
    const worldTag = h.legendary
      ? `<span class="why-world" style="background:${LEGENDARY_COLOR}">مهمة أسطورية ⭐ ×٢</span>`
      : `<span class="why-world" style="background:${WORLDS[h.world].color}">${WORLDS[h.world].ar}</span>`;
    el.innerHTML = `
      <h3>${h.emoji} ${h.ar}</h3>
      ${worldTag}
      <div class="why-quote">${h.quote}</div>
      <div class="why-source">${h.source}</div>
      <div class="why-science"><strong>🔬 ماذا يقول العلم؟</strong>${h.science}</div>`;
    grid.appendChild(el);
  });
}

/* ── Leaderboard (جولة الأسبوع) ──────────────────────────── */
function renderLeaderboard() {
  const list = document.getElementById('lb-list');
  if (!list) return;

  const wk = dateKey(weekStart(new Date()));
  const byUid = {};
  rangeDocs.filter(r => r.week === wk).forEach(r => {
    if (!byUid[r.uid]) byUid[r.uid] = { nick: r.nick, pts: 0, latest: '' };
    byUid[r.uid].pts += r.points || 0;
    if (r.date > byUid[r.uid].latest) { byUid[r.uid].latest = r.date; byUid[r.uid].nick = r.nick; }
  });
  if (me && nickname && !byUid[me.uid]) byUid[me.uid] = { nick: nickname, pts: 0 };

  const rows = Object.entries(byUid)
    .map(([uid, r]) => ({ uid, name: r.nick, pts: r.pts, me: me && uid === me.uid }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 30);

  const max = Math.max(1, rows[0]?.pts || 0);
  list.innerHTML = '';
  rows.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'lb-row' + (r.me ? ' me' : '');
    el.innerHTML = `
      <div class="lb-rank">${i + 1}</div>
      <div class="lb-name">${esc(r.name)} ${r.me ? '<small>(أنتِ)</small>' : ''}</div>
      <div class="lb-bar-wrap"><div class="lb-bar" style="width:${(r.pts / max) * 100}%"></div></div>
      <div class="lb-pts">${r.pts} نقطة</div>`;
    list.appendChild(el);
  });

  const end = weekStart(new Date());
  end.setDate(end.getDate() + 7);
  const daysLeft = Math.max(0, Math.ceil((end - new Date()) / 86400000));
  document.getElementById('round-chip').textContent =
    `⏳ تتجدد الجولة بعد ${daysLeft === 1 ? 'يوم واحد' : daysLeft === 2 ? 'يومين' : daysLeft + ' أيام'}`;
}

/* ── Charts ──────────────────────────────────────────────── */
const DAY_LETTERS = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

function countHabits(habits) { return Object.values(habits || {}).filter(Boolean).length; }

function renderBars(elId, counts, maxOverride, mine) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  const max = maxOverride ?? Math.max(1, ...counts.map(c => c.v));
  counts.forEach(c => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `
      <div class="bar-v${mine ? ' mine' : ''}" style="height:${(c.v / max) * 100}%" title="${c.v}"></div>
      <div class="bar-day">${c.label}</div>`;
    el.appendChild(col);
  });
}

function renderCharts() {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(daysAgo(i));

  renderBars('community-chart', days.map(d => {
    const k = dateKey(d);
    const v = rangeDocs.filter(r => r.date === k).reduce((s, r) => s + countHabits(r.habits), 0);
    return { v, label: DAY_LETTERS[d.getDay()] };
  }), null, false);

  renderBars('personal-chart', days.map(d => {
    const k = dateKey(d);
    const r = rangeDocs.find(x => x.uid === me?.uid && x.date === k);
    const today = k === dateKey(new Date());
    return { v: today ? countHabits(myToday) : countHabits(r?.habits), label: DAY_LETTERS[d.getDay()] };
  }), HABITS.length, true);

  /* نسبة كل مهمة هذا الأسبوع */
  const wk = dateKey(weekStart(new Date()));
  const weekDocs = rangeDocs.filter(r => r.week === wk);
  const participants = Math.max(1, new Set(weekDocs.map(r => r.uid).concat(me ? [me.uid] : [])).size);
  const dayCount = Math.floor((new Date() - weekStart(new Date())) / 86400000) + 1;
  const possible = Math.max(1, dayCount * participants);

  const list = document.getElementById('habit-chart');
  list.innerHTML = '';
  HABITS.forEach(h => {
    const done = weekDocs.filter(r => r.habits?.[h.id]).length;
    const pct = Math.min(100, Math.round((done / possible) * 100));
    const el = document.createElement('div');
    el.className = 'hbar-item';
    el.innerHTML = `
      <div class="hbar-top">
        <span class="hbar-name">${h.emoji} ${h.ar}</span>
        <span class="hbar-pct">${pct}%</span>
      </div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%; background:${habitColor(h)}"></div></div>`;
    list.appendChild(el);
  });
}

/* ── Q&A wall ────────────────────────────────────────────── */
function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)  return 'الآن';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `قبل ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'قبل يوم' : days === 2 ? 'قبل يومين' : `قبل ${days} أيام`;
}

function renderPosts() {
  const list = document.getElementById('posts-list');
  if (!list) return;
  list.innerHTML = '';
  const sorted = [...postsCache].sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.time - a.time);

  sorted.forEach(p => {
    const el = document.createElement('div');
    el.className = 'post-item' + (p.pinned ? ' pinned' : '');
    const canDelete = isAdmin || (me && p.uid === me.uid);
    el.innerHTML = `
      <div class="post-head">
        <span class="post-author">${esc(p.author)}</span>
        ${p.admin ? '<span class="post-badge">المشرفة</span>' : ''}
        ${p.pinned ? '<span class="post-badge" style="background:var(--accent);color:var(--text)">📌 مثبّت</span>' : ''}
        <span class="post-time">${timeAgo(p.time)}</span>
        ${isAdmin ? `<button class="post-delete" data-act="reply" data-id="${p.id}">↩ رد</button>
                     <button class="post-delete" data-act="pin" data-id="${p.id}">${p.pinned ? 'إلغاء التثبيت' : '📌 تثبيت'}</button>` : ''}
        ${canDelete ? `<button class="post-delete" data-act="del" data-id="${p.id}">حذف</button>` : ''}
      </div>
      <div class="post-body">${esc(p.text)}</div>
      ${p.reply ? `
        <div class="post-reply">
          <div class="post-head">
            <span class="post-author">${esc(p.reply.author)}</span>
            <span class="post-badge">المشرفة</span>
          </div>
          ${esc(p.reply.text)}
        </div>` : ''}`;
    list.appendChild(el);
  });

  list.querySelectorAll('.post-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = btn.dataset.id;
      const act = btn.dataset.act;
      try {
        if (act === 'del') {
          await deleteDoc(doc(db, 'posts', id));
          showToast('تم حذف المنشور');
        } else if (act === 'pin') {
          const p = postsCache.find(x => x.id === id);
          await updateDoc(doc(db, 'posts', id), { pinned: !p.pinned });
        } else if (act === 'reply') {
          const text = prompt('ردك على المنشور:');
          if (text && text.trim()) {
            await updateDoc(doc(db, 'posts', id), { reply: { author: ADMIN_NAME, text: text.trim() } });
            showToast('نُشر ردك 🤍');
          }
        }
      } catch {
        showToast('لم تنجح العملية — تحققي من الصلاحيات');
      }
    });
  });
}

document.getElementById('post-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('post-input');
  const text = input.value.trim();
  if (!text || !me || !nickname) return;
  try {
    await addDoc(collection(db, 'posts'), {
      uid: me.uid,
      author: isAdmin ? ADMIN_NAME : nickname,
      admin: isAdmin, pinned: false,
      text, time: Date.now(), reply: null,
    });
    input.value = '';
    showToast('نُشر سؤالك 🤍');
  } catch {
    showToast('تعذر النشر — تحققي من الاتصال');
  }
});

/* ── Admin sign-in (زر صغير في الفوتر) ───────────────────── */
function updateAdminUi() {
  let btn = document.getElementById('admin-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'admin-btn';
    btn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,.35);font-size:.7rem;cursor:pointer;font-family:inherit;';
    document.querySelector('.site-footer').appendChild(btn);
    btn.addEventListener('click', async () => {
      if (isAdmin) {
        await signOut(auth); // يعود تلقائيًا لحساب مجهول جديد
        localStorage.removeItem('pom_nick');
        nickname = null;
        isAdmin = false;
        location.reload();
      } else {
        try {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch {
          showToast('لم يكتمل تسجيل الدخول');
        }
      }
    });
  }
  btn.textContent = isAdmin ? `خروج المشرفة (${ADMIN_NAME})` : '⚙';
  if (isAdmin) renderPosts();
}

/* ── Tabs ────────────────────────────────────────────────── */
const TAB_IDS = ['quests', 'growth', 'why', 'wall'];
function showTab(name) {
  TAB_IDS.forEach(t => {
    const pane = document.getElementById(`tab-${t}`);
    if (pane) pane.hidden = t !== name;
  });
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.tab-btn').forEach(b =>
  b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ── Init ────────────────────────────────────────────────── */
renderWorldsLegend();
renderWhy();
initGate();
