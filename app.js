/* ════════════════════════════════════════════════════════════
   نلعب على مزاجنا — Live version (Firebase Firestore)
   نسخة "قابلة للتوسع": كل زائرة تقرأ ملخصات صغيرة بدل سجلات الجميع.
   - days/{uid_date}: يوم اللاعبة (تقرؤه صاحبته فقط)
   - weeks/{week}/players/{uid}: مجموع نقاط الأسبوع (للمتصدرات)
   - stats/{week}/shards/{n}: عدّادات المجتمع (للرسوم)
   - users/{uid}: الاسم فقط · mails/{uid}: البريد (تقرؤه المشرفة فقط)
   ════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut, linkWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, query,
  onSnapshot, addDoc, updateDoc, deleteDoc, orderBy, limit,
  getCountFromServer, increment,
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

/* انطلاقة اللعبة — الثلاثاء ٢١ يوليو ٢٠٢٦. قبلها: تسجيل فقط (قائمة انتظار) */
const START_DATE     = new Date('2026-07-21T00:00:00');
const START_LABEL_AR = 'الثلاثاء ٢١ يوليو';
function preLaunch() { return new Date() < START_DATE; }

const STATS_SHARDS = 10;   /* توزيع كتابة العدّادات لتجنب التزاحم */

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
    id: 'sleep', ar: 'النوم المبكر', en: 'Early Sleep', emoji: '🌙', worlds: ['physical'], legendary: true, pts: 2,
    quote: '«كان رسول الله ﷺ يكره النوم قبل العشاء والحديث بعدها»',
    source: 'متفق عليه',
    science: 'النوم هو المهمة التي تفتح بقية المهمات: يضبط هرمونات الجوع والشبع (اللبتين والجريلين) والكورتيزول والمزاج، ويحدد قدرتك على الاستيقاظ للفجر وطاقتك للحركة وتركيزك للتعلم. لذلك هي مهمة أسطورية بنقطتين.'
  },
  {
    id: 'tahajjud', ar: 'صلاة التهجد', en: 'Tahajjud (Night Prayer)', emoji: '🌌', worlds: ['spiritual'], legendary: true, pts: 5,
    quote: '﴿وَمِنَ اللَّيْلِ فَتَهَجَّدْ بِهِ نَافِلَةً لَكَ عَسَىٰ أَن يَبْعَثَكَ رَبُّكَ مَقَامًا مَّحْمُودًا﴾',
    source: 'سورة الإسراء — ٧٩ · وقال ﷺ: «أفضل الصلاة بعد الفريضة صلاةُ الليل» (رواه مسلم)',
    science: 'مراجعات منهجية واسعة (منها أعمال فريق Koenig في جامعة Duke على مئات الدراسات) تجد ارتباطًا ثابتًا بين الممارسة الدينية المنتظمة وانخفاض الاكتئاب والقلق وتحسّن الرضا عن الحياة. وخلوة الليل الهادئة بلا مشتتات هي أعمق أشكال هذا الحضور — لذلك هي أعلى مهمة في اللعبة: ٥ نقاط.'
  },
  {
    id: 'fajrprayer', ar: 'صلاة الفجر على وقتها', en: 'Fajr On Time', emoji: '🕌', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«من صلى البَرْدَين دخل الجنة»',
    source: 'متفق عليه — والبَرْدان: الفجر والعصر',
    science: 'الاستيقاظ في وقت ثابت يوميًا هو «مرساة» الساعة البيولوجية. تحليل بيانات UK Biobank على أكثر من ٦٠ ألف شخص (Windred وزملاؤه، مجلة Sleep 2024) وجد أن انتظام مواعيد النوم والاستيقاظ يتنبأ بطول العمر أقوى من عدد ساعات النوم نفسها.'
  },
  {
    id: 'dhuhr', ar: 'صلاة الظهر على وقتها', en: 'Dhuhr On Time', emoji: '🕰️', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«أرأيتم لو أن نهرًا بباب أحدكم يغتسل فيه كل يوم خمس مرات، هل يبقى من دَرَنه شيء؟»',
    source: 'متفق عليه — الصلوات الخمس تمحو الخطايا كما يمحو الماء الدَّرَن',
    science: 'فاصل منتصف اليوم: تحليل شامل لـ٢٢ تجربة (Albulescu وزملاؤه، PLOS ONE 2022) وجد أن الاستراحات القصيرة المنتظمة ترفع النشاط وتخفض الإرهاق قياسًا — ووقفة الظهر تقطع أطول فترة تركيز في يومك قبل أن يتراكم التعب.'
  },
  {
    id: 'asr', ar: 'صلاة العصر على وقتها', en: 'Asr On Time', emoji: '🌇', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«من فاتته صلاةُ العصر فكأنما وُتِرَ أهلَه ومالَه»',
    source: 'متفق عليه',
    science: 'وقت العصر يصادف «هبوط ما بعد الظهيرة» الموثق في أبحاث الساعة البيولوجية — انخفاض طبيعي في اليقظة والتركيز. وقفة العصر استراحة استعادة تأتي في اللحظة التي يحتاجها دماغك فعلًا.'
  },
  {
    id: 'maghrib', ar: 'صلاة المغرب على وقتها', en: 'Maghrib On Time', emoji: '🌆', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«لا تزال أمتي بخير — أو قال: على الفطرة — ما لم يؤخِّروا المغربَ حتى تشتبك النجوم»',
    source: 'رواه أبو داود',
    science: 'طقوس الانتقال الثابتة بين النهار والمساء تساعد الذهن على «الانفصال» عن مشاغل اليوم — ومراجعات أبحاث الاستشفاء النفسي (Sonnentag وزملاؤها) تجد هذا الانفصال من أقوى المنبئات بمساء أهدأ ونوم أفضل.'
  },
  {
    id: 'isha', ar: 'صلاة العشاء على وقتها', en: 'Isha On Time', emoji: '🌃', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«ومن صلى العشاء في جماعة فكأنما قام نصفَ الليل»',
    source: 'رواه مسلم',
    science: 'إغلاق اليوم بموعد ثابت يمهد للنوم المبكر — أبحاث النوم تجد أن الروتين المسائي المنتظم من أقوى العوامل المرتبطة بنوم أسرع وأعمق.'
  },
  {
    id: 'duha', ar: 'صلاة الضحى', en: 'Duha Prayer', emoji: '☀️', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«ويُجزئ من ذلك ركعتان يركعهما من الضحى»',
    source: 'رواه مسلم — عن صدقة تلزم كل مفصل من الإنسان كل يوم',
    science: 'وقفة قصيرة في ضحى النهار تجمع فائدتين مدروستين: التعرض لضوء النهار الذي يثبّت الساعة البيولوجية والمزاج، وأثر الفواصل القصيرة المنتظمة في استعادة التركيز والنشاط (التحليل الشامل PLOS ONE 2022).'
  },
  {
    id: 'athkar', ar: 'أذكار الصباح (مش لازم كلها)', en: 'Morning Adhkar', emoji: '📿', worlds: ['spiritual'],
    quote: '﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾',
    source: 'سورة الرعد — ٢٨',
    science: 'تحليلات شاملة لتدخلات الامتنان والذكر التأملي (منها Cregg & Cheavens 2021 على ٢٥ تجربة) تجد أثرًا ثابتًا — وإن كان هادئًا — في خفض أعراض القلق والاكتئاب وتحسين المزاج. البركة في الاستمرار لا في الكمية، ولهذا: مش لازم كلها.'
  },
  {
    id: 'athkareve', ar: 'أذكار المساء (مش لازم كلها)', en: 'Evening Adhkar', emoji: '🌆', worlds: ['spiritual'],
    quote: '﴿وَسَبِّحْ بِحَمْدِ رَبِّكَ قَبْلَ طُلُوعِ الشَّمْسِ وَقَبْلَ الْغُرُوبِ﴾',
    source: 'سورة ق — ٣٩',
    science: 'إنهاء اليوم بطقس هادئ ثابت هو أحد أكثر ما توصي به أبحاث النوم: الروتين المسائي المنتظم يرتبط قياسًا بنوم أسرع وأعمق، والذكر التأملي قبل النوم يخفض التوتر (التحليلات الشاملة نفسها لتدخلات الامتنان والذكر). ومش لازم كلها — المهم اللحظة الهادئة.'
  },
  {
    id: 'fajr', ar: 'الاستيقاظ بعد الفجر (التعرض للشمس)', en: 'Awake after Fajr + Sunlight', emoji: '🌅', worlds: ['physical', 'emotional', 'mental'],
    quote: '«اللهم بارك لأمتي في بكورها»',
    source: 'رواه أبو داود والترمذي — دعاء النبي ﷺ بالبركة في أول النهار',
    science: 'التعرض لضوء الصباح الباكر يضبط الساعة البيولوجية ويحسّن النوم والمزاج. دراسة على أكثر من ٨٠٠ ألف شخص (JAMA Psychiatry 2021) وجدت أن تقديم منتصف النوم ساعة واحدة يرتبط بانخفاض خطر الاكتئاب بنحو ٢٣٪.'
  },
  {
    id: 'quran', ar: 'قراءة وِرد من القرآن', en: 'Daily Quran Portion', emoji: '📖', worlds: ['spiritual'],
    quote: '«اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعًا لأصحابه»',
    source: 'رواه مسلم',
    science: 'دراسات على تلاوة القرآن والاستماع إليه سجّلت انخفاضًا في مؤشرات القلق وضغط الدم ومعدل ضربات القلب. كما أن القراءة اليومية المنتظمة عمومًا ترتبط ببناء احتياطي معرفي يحمي الذاكرة مع التقدم في العمر.'
  },
  {
    id: 'walk', ar: 'المشي / حركة يومية', en: 'Daily Walk / Movement', emoji: '🚶🏻‍♀️', worlds: ['physical'],
    quote: '«المؤمن القوي خير وأحب إلى الله من المؤمن الضعيف»',
    source: 'رواه مسلم',
    science: 'تحليل شامل في The Lancet Public Health (2022) على أكثر من ٤٧ ألف شخص وجد أن ٧ آلاف خطوة يوميًا تقريبًا ترتبط بانخفاض خطر الوفاة المبكرة بنسبة تصل إلى ٥٠٪ مقارنة بقلة الحركة.'
  },
  {
    id: 'water', ar: 'شرب الماء الكافي', en: 'Enough Water', emoji: '💧', worlds: ['physical'],
    quote: '﴿وَجَعَلْنَا مِنَ الْمَاءِ كُلَّ شَيْءٍ حَيٍّ﴾',
    source: 'سورة الأنبياء — ٣٠',
    science: 'حتى الجفاف الخفيف (١–٢٪ من وزن الجسم) يؤثر في التجارب المضبوطة المتكررة على التركيز والمزاج ويزيد الصداع والتعب، وشرب الماء الكافي يحسّن اليقظة والأداء الذهني خلال اليوم.'
  },
  {
    id: 'learn', ar: 'أتعلم شي جديد', en: 'Learn Something New', emoji: '🎧', worlds: ['mental'],
    quote: '«من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة»',
    source: 'رواه مسلم',
    science: 'تعلّم مهارات ومعارف جديدة يبني «الاحتياطي المعرفي» — مرونة عصبية تحمي الذاكرة والدماغ مع التقدم في العمر، وترتبط في مراجعات منهجية واسعة بتأخر ظهور أعراض التدهور المعرفي.'
  },
  {
    id: 'meet', ar: 'تعرّف على شخص جديد', en: 'Meet Someone New', emoji: '🤝', worlds: ['env'],
    quote: '﴿وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا﴾',
    source: 'سورة الحجرات — ١٣',
    science: 'أشهر تحليل شامل في الموضوع (Holt-Lunstad وزملاؤها 2010، على ١٤٨ دراسة وأكثر من ٣٠٠ ألف شخص) وجد أن العلاقات الاجتماعية القوية ترتبط بزيادة فرص البقاء على قيد الحياة بنحو ٥٠٪ — أثر يوازي ترك التدخين ويفوق أثر السمنة.'
  },
  {
    id: 'recharge', ar: 'جلسة في الطبيعة / مع صديقة', en: 'Nature or a Friend', emoji: '🌳', worlds: ['emotional'],
    quote: '﴿وَيَتَفَكَّرُونَ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ﴾',
    source: 'سورة آل عمران — ١٩١',
    science: 'تحليل شامل لـ١٤٣ دراسة (Twohig-Bennett & Jones 2018) وجد أن التعرض للمساحات الخضراء يرتبط بانخفاض الكورتيزول وضغط الدم ومعدل ضربات القلب. ودراسة هارفارد الممتدة ٨٥ عامًا وجدت أن دفء العلاقات هو أقوى مؤشر للسعادة والصحة على المدى الطويل.'
  },
  {
    id: 'explore', ar: 'زيارة مكان جديد', en: 'Visit a New Place', emoji: '🧭', worlds: ['env'],
    quote: '﴿قُلْ سِيرُوا فِي الْأَرْضِ﴾',
    source: 'سورة العنكبوت — ٢٠',
    science: 'دراسة تتبّع يومي بالموقع الجغرافي (Heller وزملاؤها، Nature Neuroscience 2020) وجدت أن تنوّع الأماكن التي نزورها يوميًا يرتبط بمزاج أكثر إيجابية، ويرتبط ذلك بنشاط دوائر الدماغ المسؤولة عن الجِدّة والمكافأة — التجارب الجديدة غذاء للدماغ.'
  },
  {
    id: 'tidy', ar: 'ترتيب مساحتك', en: 'Tidy Your Space', emoji: '🧺', worlds: ['env'],
    quote: '«إِنَّ اللَّهَ جَمِيلٌ يُحِبُّ الْجَمَالَ»',
    source: 'رواه مسلم',
    science: 'دراسة UCLA (Saxbe & Repetti 2010) وجدت أن من يصفن بيوتهن بالفوضى ترتفع لديهن مستويات الكورتيزول (هرمون التوتر) خلال اليوم، وأبحاث برينستون (2011) أظهرت أن الفوضى البصرية تنافس انتباهك وتقلل تركيزك.'
  },
  {
    id: 'enjoy', ar: 'أسوي شي أنا أحبه', en: 'Do Something I Love', emoji: '🎨', worlds: ['emotional'],
    quote: '«دَعْهُ يا عمر، فوالذي نفسي بيده، لَكلامُه أشدُّ عليهم من وقع النَّبْل»',
    source: 'قاله ﷺ لعمر عن شعر عبد الله بن رواحة — رواه الترمذي والنسائي',
    science: 'دراسة واسعة على أكثر من ٩٣ ألف شخص في ١٦ دولة (Fancourt وزملاؤها، Nature Medicine 2023) وجدت أن ممارسة هواية ترتبط بانخفاض أعراض الاكتئاب وارتفاع الرضا عن الحياة والشعور بالمعنى — في كل الدول والثقافات المدروسة.'
  },
  {
    id: 'goodtrace', ar: 'أثر طيب في محيطك', en: 'Leave a Good Trace', emoji: '🕊️', worlds: ['env'],
    quote: '«وإماطة الأذى عن الطريق صدقة»',
    source: 'متفق عليه',
    science: 'تحليل شامل لـ٢٧ تجربة (Curry وزملاؤه 2018) وجد أن أفعال اللطف الصغيرة ترفع سعادة فاعلها قياسًا — الخير يعود على صاحبه أولًا، والمحيط يكسب معه.'
  },
  {
    id: 'sharehobby', ar: 'أشارك الآخرين هواياتي', en: 'Share My Hobbies', emoji: '🪁', worlds: ['emotional'],
    quote: '«والله في عَون العبد ما كان العبد في عَون أخيه»',
    source: 'رواه مسلم',
    science: 'مشاركة ما تحبين تجمع أثرين مدروسين معًا: أثر العطاء في سعادة المعطي (تحليل Curry الشامل 2018)، وأثر الروابط الاجتماعية في الصحة وطول العمر (تحليل Holt-Lunstad على ١٤٨ دراسة) — هوايتك تصبح جسرًا.'
  },
  {
    id: 'solitude', ar: 'راحة / خلوة مع نفسي', en: 'Rest / Time with Myself', emoji: '🕯️', worlds: ['spiritual', 'emotional'],
    quote: '«إنّ لبدنك عليك حقًا»',
    source: 'متفق عليه',
    science: 'مراجعات منهجية لأبحاث «الاستشفاء النفسي» (Sonnentag وزملاؤها) تجد أن الانفصال الحقيقي عن المشاغل — ولو لفترة قصيرة يوميًا — يتنبأ قياسًا بانخفاض الإرهاق وتحسّن المزاج والنوم. الراحة ليست مكافأة بعد الإنجاز، هي جزء من الإنجاز.'
  },
];

function habitColor(h)  { return h.legendary ? LEGENDARY_COLOR : WORLDS[h.worlds[0]].color; }
function habitPoints(h) { return h.pts || 1; }
const AR_NUMS = { 2: '٢', 3: '٣', 5: '٥' };

/* تجميع المهمات في «روتينات» حتى لا تبدو القائمة طويلة */
const GROUPS = [
  { id: 'morning', ar: 'روتين الصباح',   en: 'Morning Routine',      emoji: '🌅' },
  { id: 'day',     ar: 'خلال اليوم',     en: 'Through the Day',      emoji: '☀️' },
  { id: 'mood',    ar: 'على مزاجك',      en: 'Your Mood, Your Call', emoji: '🤙🏻' },
  { id: 'night',   ar: 'روتين الليل',    en: 'Night Routine',        emoji: '🌙' },
];
const GROUP_ITEMS = {
  morning: ['fajrprayer', 'fajr', 'athkar', 'duha'],
  day:     ['dhuhr', 'asr', 'quran', 'walk', 'water', 'learn'],
  mood:    ['meet', 'recharge', 'explore', 'tidy', 'enjoy', 'goodtrace', 'sharehobby', 'solitude'],
  night:   ['maghrib', 'isha', 'athkareve', 'sleep', 'tahajjud'],
};

/* ── اللغة الإنجليزية (وضع كامل لغير الناطقات بالعربية) ──── */
let lang = localStorage.getItem('pom_lang') || 'ar';
const isEN = () => lang === 'en';

const EN_WHY = {
  sleep:      { quote: '“The Messenger of Allah ﷺ disliked sleeping before Isha and talking after it.”', source: 'Agreed upon (Bukhari & Muslim)', science: 'Sleep is the quest that unlocks the rest: it regulates hunger hormones (leptin & ghrelin), cortisol and mood, and decides your energy for Fajr, movement and focus. That is why it is legendary — 2 points.' },
  tahajjud:   { quote: '“And in part of the night, pray tahajjud as an extra offering; it may be that your Lord will raise you to a praised station.”', source: 'Quran 17:79 · And ﷺ said: “The best prayer after the obligatory one is the night prayer” (Muslim)', science: 'Large systematic reviews (including Koenig’s work at Duke across hundreds of studies) consistently link regular religious practice with lower depression and anxiety and higher life satisfaction. The quiet solitude of night is the deepest form of that presence — the game’s highest quest: 5 points.' },
  fajrprayer: { quote: '“Whoever prays the two cool-hour prayers (Fajr and Asr) enters Paradise.”', source: 'Agreed upon', science: 'A fixed daily wake time is the anchor of your body clock. UK Biobank analysis of 60,000+ people (Windred et al., Sleep 2024) found sleep–wake regularity predicts longevity even more strongly than sleep duration.' },
  dhuhr:      { quote: '“If there were a river at your door in which you bathed five times a day, would any dirt remain?”', source: 'Agreed upon — the five prayers wash away sins', science: 'A midday reset: a meta-analysis of 22 trials (Albulescu et al., PLOS ONE 2022) found short regular breaks measurably raise vigor and lower fatigue — Dhuhr cuts your longest stretch of effort before tiredness piles up.' },
  asr:        { quote: '“Whoever misses the Asr prayer, it is as if he lost his family and his wealth.”', source: 'Agreed upon', science: 'Asr lands on the well-documented afternoon dip in alertness from circadian research — a restorative pause exactly when your brain needs it.' },
  maghrib:    { quote: '“My nation remains upon goodness as long as they do not delay Maghrib until the stars crowd together.”', source: 'Abu Dawud', science: 'Fixed transition rituals between day and evening help the mind detach from the day’s demands — recovery research (Sonnentag et al.) finds such detachment among the strongest predictors of calmer evenings and better sleep.' },
  isha:       { quote: '“And whoever prays Isha in congregation, it is as if he stood half the night in prayer.”', source: 'Muslim', science: 'Closing the day at a fixed time paves the way for early sleep — sleep research finds a consistent evening routine among the strongest factors for falling asleep faster and deeper.' },
  duha:       { quote: '“…and two rak‘ahs of Duha suffice for all of it.”', source: 'Muslim — on the daily charity due from every joint of the body', science: 'A brief mid-morning pause combines two studied benefits: daylight exposure that stabilizes the body clock and mood, and the measurable recharge of short regular breaks (PLOS ONE 2022 meta-analysis).' },
  athkar:     { quote: '“Verily, in the remembrance of Allah do hearts find rest.”', source: 'Quran 13:28', science: 'Meta-analyses of gratitude and contemplative practice (incl. Cregg & Cheavens 2021, 25 trials) find a consistent — if quiet — effect on anxiety, low mood and wellbeing. Consistency beats quantity, hence: you don’t need all of them.' },
  athkareve:  { quote: '“And glorify the praise of your Lord before sunrise and before sunset.”', source: 'Quran 50:39', science: 'Ending the day with a calm fixed ritual is a top recommendation of sleep research: regular evening wind-downs are linked with faster, deeper sleep, and contemplative practice lowers stress. You don’t need all of them — the calm moment is the point.' },
  fajr:       { quote: '“O Allah, bless my nation in its early mornings.”', source: 'Abu Dawud & Tirmidhi — the Prophet’s ﷺ prayer for the early hours', science: 'Early morning light anchors the circadian clock and lifts mood. A study of 800,000+ people (JAMA Psychiatry 2021) found shifting sleep midpoint one hour earlier is associated with ~23% lower depression risk.' },
  quran:      { quote: '“Read the Quran, for it will come on the Day of Resurrection as an intercessor for its companions.”', source: 'Muslim', science: 'Studies of Quran recitation and listening recorded lower anxiety markers, blood pressure and heart rate; regular daily reading in general builds cognitive reserve that protects memory with age.' },
  walk:       { quote: '“The strong believer is better and more beloved to Allah than the weak believer.”', source: 'Muslim', science: 'A meta-analysis in The Lancet Public Health (2022, 47,000+ people) found ~7,000 daily steps associated with up to 50% lower risk of early death compared to being sedentary.' },
  water:      { quote: '“And We made from water every living thing.”', source: 'Quran 21:30', science: 'Even mild dehydration (1–2% of body weight) measurably impairs concentration and mood and increases headaches and fatigue in repeated controlled trials; adequate water improves alertness through the day.' },
  learn:      { quote: '“Whoever travels a path seeking knowledge, Allah eases for him a path to Paradise.”', source: 'Muslim', science: 'Learning new skills builds “cognitive reserve” — neural flexibility that protects memory and brain health with age, linked in broad systematic reviews to delayed cognitive decline.' },
  meet:       { quote: '“And We made you peoples and tribes that you may know one another.”', source: 'Quran 49:13', science: 'The landmark meta-analysis (Holt-Lunstad et al. 2010; 148 studies, 300,000+ people) found strong social ties associated with ~50% higher survival odds — an effect comparable to quitting smoking.' },
  recharge:   { quote: '“…and they reflect upon the creation of the heavens and the earth.”', source: 'Quran 3:191', science: 'A meta-analysis of 143 studies (Twohig-Bennett & Jones 2018) linked greenspace exposure to lower cortisol, blood pressure and heart rate; and Harvard’s 85-year study found warm relationships the strongest predictor of long-term happiness and health.' },
  explore:    { quote: '“Say: travel through the land.”', source: 'Quran 29:20', science: 'GPS-tracking research (Heller et al., Nature Neuroscience 2020) found that variety in the places we visit daily correlates with more positive mood, tied to the brain’s novelty-and-reward circuits — new experiences feed the brain.' },
  tidy:       { quote: '“Indeed, Allah is beautiful and loves beauty.”', source: 'Muslim', science: 'A UCLA study (Saxbe & Repetti 2010) found people who describe their homes as cluttered show elevated cortisol through the day; Princeton research (2011) showed visual clutter competes for your attention and lowers focus.' },
  enjoy:      { quote: '“Leave him, O Umar — by Him in Whose Hand is my soul, his words strike them harder than arrows.”', source: 'Said ﷺ about Ibn Rawaha’s poetry — Tirmidhi & Nasa’i', science: 'A study of 93,000+ people across 16 countries (Fancourt et al., Nature Medicine 2023) found having a hobby associated with fewer depressive symptoms and higher life satisfaction and sense of meaning — in every country studied.' },
  goodtrace:  { quote: '“And removing something harmful from the path is charity.”', source: 'Agreed upon', science: 'A meta-analysis of 27 experiments (Curry et al. 2018) found small acts of kindness measurably raise the giver’s happiness — goodness returns to its doer first, and the surroundings win too.' },
  sharehobby: { quote: '“Allah is in the aid of His servant as long as the servant is in the aid of his brother.”', source: 'Muslim', science: 'Sharing what you love combines two studied effects: giving boosts the giver’s wellbeing (Curry’s 2018 meta-analysis), and social bonds predict health and longevity (Holt-Lunstad’s 148-study meta-analysis) — your hobby becomes a bridge.' },
  solitude:   { quote: '“Indeed, your body has a right over you.”', source: 'Agreed upon', science: 'Systematic reviews of psychological recovery research (Sonnentag et al.) find that genuine daily detachment — even briefly — measurably predicts less exhaustion and better mood and sleep. Rest is not a reward after the work; it is part of the work.' },
};

function whyOf(h) {
  if (isEN() && EN_WHY[h.id]) return EN_WHY[h.id];
  return { quote: h.quote, source: h.source, science: h.science };
}

function applyEnglish() {
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = isEN() ? '🌐 عربي' : '🌐 English';
    btn.addEventListener('click', () => {
      localStorage.setItem('pom_lang', isEN() ? 'ar' : 'en');
      location.reload();
    });
  }
  if (!isEN()) return;

  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
  const setAll = (sel, arr) => document.querySelectorAll(sel).forEach((el, i) => { if (arr[i]) el.innerHTML = arr[i]; });

  set('.page-header .eyebrow-tag', 'A challenge we play together · نلعب على مزاجنا');
  set('.page-header h1', 'Play Over Mood');
  set('.page-header p', 'Small daily quests from five elements — complete them, collect points, and watch your growth and the whole community’s, week after week.');

  set('#nick-gate h2', 'Welcome to the challenge ☀️');
  set('#nick-gate > p', 'Pick a name or nickname for the leaderboard. No accounts, no passwords — just your name and you’re in.');
  set('.launch-box', '🗓️ <strong>We start together on Tuesday, July 21.</strong><br>We picked this day randomly — on purpose. The date itself doesn’t matter; this day will matter because we chose to start something new in it 🤍<br>Register your name now to save your spot, and follow me on Instagram — every day until Tuesday I explain a part of the game.');
  set('.game-rules', `
      <div class="rules-title">How We Play · قواعد اللعبة</div>
      <div class="rule-row"><span class="rule-emoji">🤍</span><span>No “musts” here — do what you can today, even a single quest.</span></div>
      <div class="rule-row"><span class="rule-emoji">☀️</span><span>We chase no perfection, we chase nothing at all — we stack small things, because real change happens through small things.</span></div>
      <div class="rule-row"><span class="rule-emoji">⭐</span><span>Every quest = points. The golden legendary quests are worth more because they unlock the rest (in real life 🎉).</span></div>
      <div class="rule-row"><span class="rule-emoji">🔁</span><span>Every Tuesday a new round begins — and a missed day erases nothing; continue from where you are.</span></div>
      <div class="rule-row"><span class="rule-emoji">🤙🏻</span><span>We play together, not against each other — the board is for encouragement, the wall is for your questions and thoughts.</span></div>
      <div class="rule-row"><span class="rule-emoji">🌼</span><span>The Arabic version is written in the feminine, the language of this space — men are fully welcome; same rules, same game.</span></div>
      <div class="rule-row"><span class="rule-emoji">🤎</span><span>We are a Muslim community and the content is built on that — if you follow another faith, you are most welcome: this is a safe, supportive space for everyone.</span></div>
      <div class="rule-row"><span class="rule-emoji">#️⃣</span><span>Share the game on Instagram or anywhere (every share counts — it doesn’t have to be perfect). Use our hashtags so we find each other: <bdi dir="ltr">#playovermood</bdi> &amp; <bdi dir="rtl">#نلعب_على_مزاجنا</bdi> 🤙🏻</span></div>`);
  set('.why-letter summary', 'Why “Play Over Mood”? A letter from me (Aisha) 🤍');
  set('.letter-body', `
        <p>I used to be a very serious person (not in a normal way 😅). I didn’t know fun or play, and my life was exhausting me.</p>
        <p>Until I started playing with my nephews and nieces — not letting them play, not watching them play… <strong>actually playing with them</strong> (on the trampoline, racing them: one of my goals this year was to outrun my 5-year-old nephew 🤣). Since then, I see life as a game.</p>
        <p>Imagine wearing a VR headset: inside the game we immerse and we play. Easy? We play. Hard? We play. In the game we have tools, powers and rewards… and losses and struggles too. But we know we’re playing, so we keep going.</p>
        <p class="letter-aside">(Okay, that got deep 🙂)</p>
        <p>Everything in this life is preparing us for the next one (the Hereafter). If we took it with complete seriousness, it would be impossible to live (it doesn’t weigh a mosquito’s wing with Allah). Doing things and having more fun lets us live it the way it was designed to be lived. We’re not against seriousness… this is just how I see life.</p>
        <p>And in the game there are players at levels above mine — I learn from them and ask their help. And players at levels I’ve already passed — so I reach out my hand ❤️‍🩹🫂</p>
        <p>The name itself is a play on words 🙂🤙🏻 “نلعب على مزاجنا” carries two meanings: <strong>first</strong> — we play over the mood (Play Over Mood): I don’t let my mood run me, I lead. <strong>Second</strong> — we play as we please: I play if I want, and I choose what suits me. Pick the meaning that feels like you… or take both 🤙🏻</p>
        <p><strong>That’s why we chose “Play Over Mood” · نلعب على مزاجنا:</strong> to say we can have fun and change our lives at the same time ☀️💖</p>`);
  const nickInput = document.getElementById('nick-input');
  if (nickInput) nickInput.placeholder = 'Your name or nickname…';
  const emailInput = document.getElementById('email-input');
  if (emailInput) emailInput.placeholder = 'Your email (optional)';
  set('#nick-form div', 'Totally optional — only for news of future rounds 🤍 Never shown to anyone, and it does not save your progress: progress is saved automatically on this device, and to carry it across devices link your Google account inside the game.');
  set('#nick-form button[type=submit]', 'Start Playing');

  setAll('.tab-btn', ['🎮 Quests', '📊 Progress', '📖 The Why', '💬 The Wall', '📜 Rules', '📈 My Board']);

  set('#tab-quests .card-label', '① Today’s Quests · مهمات اليوم');
  set('#tab-quests .card-title', 'Which quests did you complete today?');
  set('#tab-quests .card-desc', 'Tap every quest you completed — regular = 1 point, legendary ⭐ = more');

  setAll('#tab-growth .card-label', ['③ Leaderboard · لوحة المتصدرات', '④ Growth · النمو']);
  setAll('#tab-growth .card-title', ['This week’s round', 'Your growth and the community’s']);
  setAll('#tab-growth .card-desc', ['The board resets every Tuesday — a fresh chance every week for every newcomer', 'Last 14 days']);
  setAll('#tab-growth .chart-title', ['Community growth 🌍', 'Your growth 💕', 'Each quest 📊']);
  setAll('#tab-growth .chart-sub', ['Total quests completed daily by everyone', 'Your daily total', 'Per-quest completion this week']);

  set('#tab-why .card-label', '② The Why · لماذا هذه المهمات؟');
  set('#tab-why .card-title', 'Intention and science, together');
  set('#tab-why .card-desc', 'Every quest has a root in revelation and support from modern studies');

  set('#tab-wall .card-label', '⑤ The Wall · حائط الأسئلة');
  set('#tab-wall .card-title', 'Ask or share');
  set('#tab-wall .card-desc', 'Write a question or thought for everyone — and I answer here');
  const postInput = document.getElementById('post-input');
  if (postInput) postInput.placeholder = 'Write your question or thought…';
  set('#post-form button', 'Post');

  set('#tab-rules .card-label', 'How We Play · قواعد اللعبة');
  set('#tab-rules .card-title', 'How do we play here?');
  set('#tab-rules .card-desc', 'The same rules you read at the door — always here when you need them');

  set('#about-box', 'I’m 3aosh 🤍 A software engineer and certified teacher. I read psychology (though these days I prefer fiqh al-nafs — the Islamic understanding of the self), apply what I learn, and explore its connection to Islam. I love learning, helping people, and games — not the electronic kind… competition 🤙🏻 I started this game for myself, then thought: why not share it with the world?');
  set('.hello-name', 'Hi, <span id="hello-nick"></span> 🌼 <span id="today-date"></span>');
  set('#change-nick', 'change name');
}

/* ── Helpers ─────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function weekStart(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() - 2 + 7) % 7)); /* بداية الأسبوع = الثلاثاء (يوم الانطلاقة) */
  x.setHours(0, 0, 0, 0);
  return x;
}
function thisWeekKey() { return dateKey(weekStart(new Date())); }
function prevWeekKey() { const d = weekStart(new Date()); d.setDate(d.getDate() - 7); return dateKey(d); }
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
let me        = null;   // Firebase user (anonymous أو Google)
let isAdmin   = false;
let nickname  = localStorage.getItem('pom_nick') || null;
let myDays    = {};     // مرآة محلية لأيامي: date -> {habits, points}
let lbRows    = [];     // أفضل ٣٠ لاعبة هذا الأسبوع
let statsWeeks = {};    // week -> {dayCounts, habitCounts}
let statsFetchedAt = 0;
let participantsCount = null;
let participantsFetchedAt = 0;
let postsCache = [];
let listenersStarted = false;

function myDayKey() { return dateKey(new Date()); }
function myToday() { return (myDays[myDayKey()] || {}).habits || {}; }
function dayPoints(habits) {
  return HABITS.reduce((s, h) => s + (habits[h.id] ? habitPoints(h) : 0), 0);
}
function myWeekPoints() {
  const wk = thisWeekKey();
  return Object.entries(myDays)
    .filter(([date]) => dateKey(weekStart(new Date(date + 'T12:00:00'))) === wk)
    .reduce((s, [, d]) => s + (d.points || 0), 0);
}

/* المرآة المحلية — تقلل القراءات: نقرأ أيامنا من الجهاز لا من الخادم */
function daysLsKey() { return `pom_days_${me?.uid || 'anon'}`; }
function loadMyDaysLocal() {
  try { myDays = JSON.parse(localStorage.getItem(daysLsKey())) || {}; }
  catch { myDays = {}; }
}
function saveMyDaysLocal() {
  /* لا نحتفظ بأكثر من ٣٠ يومًا محليًا */
  const cutoff = dateKey(daysAgo(30));
  Object.keys(myDays).forEach(k => { if (k < cutoff) delete myDays[k]; });
  localStorage.setItem(daysLsKey(), JSON.stringify(myDays));
}
async function fetchMyDaysFromServer() {
  /* عند جهاز جديد/تخزين ممسوح: ١٤ قراءة مباشرة لمرة واحدة */
  const gets = [];
  for (let i = 0; i < 14; i++) {
    const k = dateKey(daysAgo(i));
    gets.push(getDoc(doc(db, 'days', `${me.uid}_${k}`)).then(s => {
      if (s.exists()) myDays[k] = { habits: s.data().habits || {}, points: s.data().points || 0 };
    }).catch(() => {}));
  }
  await Promise.all(gets);
  saveMyDaysLocal();
}

/* ── Auth ────────────────────────────────────────────────── */
onAuthStateChanged(auth, async user => {
  if (!user) {
    signInAnonymously(auth).catch(() =>
      showToast('تعذر الاتصال — تأكدي من تفعيل Anonymous في Firebase'));
    return;
  }
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

  loadMyDaysLocal();
  if (nickname && Object.keys(myDays).length === 0) {
    await fetchMyDaysFromServer();
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
      btn.textContent = isEN() ? '☁️ Save your progress (link Google)' : '☁️ احفظي تقدمك (ربط بحساب Google)';
    } else {
      btn.hidden = false;
      btn.disabled = true;
      btn.style.textDecoration = 'none';
      btn.style.cursor = 'default';
      btn.textContent = isEN() ? '✓ Progress saved — follows you on any device 🤍' : '✓ تقدمك محفوظ ويتبعك على أجهزتك 🤍';
    }
  }
  const gate = document.getElementById('nick-gate');
  if (gate && !document.getElementById('gate-google')) {
    const g = document.createElement('button');
    g.id = 'gate-google';
    g.type = 'button';
    g.className = 'change-nick';
    g.style.marginTop = '14px';
    g.textContent = isEN() ? 'Already linked your progress to Google? Sign in here' : 'سبق وربطتِ تقدمك بحساب Google؟ ادخلي من هنا';
    g.addEventListener('click', async () => {
      try { await signInWithPopup(auth, new GoogleAuthProvider()); }
      catch { showToast('لم يكتمل تسجيل الدخول'); }
    });
    gate.appendChild(g);
  }
}

/* ── Live listeners (خفيفة: أفضل ٣٠ + آخر ٣٠ منشورًا فقط) ─── */
function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;

  onSnapshot(
    query(collection(db, `weeks/${thisWeekKey()}/players`), orderBy('points', 'desc'), limit(30)),
    snap => {
      lbRows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      renderLeaderboard();
    },
    () => showToast('تعذر تحميل اللوحة — تأكدي من قواعد الحماية المحدثة')
  );

  onSnapshot(
    query(collection(db, 'posts'), orderBy('time', 'desc'), limit(30)),
    snap => {
      postsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPosts();
    },
    () => {}
  );

  fetchStats();
}

/* ── عدّادات المجتمع (ملخصات صغيرة بدل سجلات الجميع) ─────── */
async function fetchStats(force) {
  if (!force && Date.now() - statsFetchedAt < 60000) return;
  statsFetchedAt = Date.now();
  const weeks = [thisWeekKey(), prevWeekKey()];
  await Promise.all(weeks.map(async wk => {
    try {
      const snap = await getDocs(collection(db, `stats/${wk}/shards`));
      const agg = { dayCounts: {}, habitCounts: {} };
      snap.forEach(s => {
        const d = s.data();
        Object.entries(d.dayCounts || {}).forEach(([k, v]) => { agg.dayCounts[k] = (agg.dayCounts[k] || 0) + v; });
        Object.entries(d.habitCounts || {}).forEach(([k, v]) => { agg.habitCounts[k] = (agg.habitCounts[k] || 0) + v; });
      });
      statsWeeks[wk] = agg;
    } catch { /* قد لا توجد بعد */ }
  }));
  renderCharts();
}

async function fetchParticipants() {
  if (Date.now() - participantsFetchedAt < 60000) return participantsCount;
  participantsFetchedAt = Date.now();
  try {
    const snap = await getCountFromServer(collection(db, `weeks/${thisWeekKey()}/players`));
    participantsCount = snap.data().count;
  } catch { /* غير حرج */ }
  return participantsCount;
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
  /* المشرفة لا تُحسب في قائمة الانتظار */
  if (!isAdmin) {
    setDoc(doc(db, 'users', me.uid), { nick: nickname, updated: Date.now() }, { merge: true }).catch(() => {});
    /* البريد اختياري — يُحفظ في مجموعة تقرؤها المشرفة فقط */
    const emailInput = document.getElementById('email-input');
    const email = emailInput ? emailInput.value.trim() : '';
    if (email) {
      setDoc(doc(db, 'mails', me.uid), { email, nick: nickname, newsletter: true, updated: Date.now() }, { merge: true }).catch(() => {});
    }
  }
  showToast(isEN() ? `Welcome ${nickname} — your challenge begins ☀️` : `أهلًا ${nickname} — بدأ تحديك ☀️`);
  loadMyDaysLocal();
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
  if (preLaunch() && !isAdmin) {
    showToast(isEN() ? 'We start together on Tuesday, July 21 🤍' : `نبدأ معًا يوم ${START_LABEL_AR} 🤍`);
    return;
  }

  const date = myDayKey();
  const week = thisWeekKey();
  const day = (myDays[date] = myDays[date] || { habits: {}, points: 0 });
  day.habits[h.id] = !day.habits[h.id];
  const delta = day.habits[h.id] ? 1 : -1;
  day.points = dayPoints(day.habits);
  saveMyDaysLocal();

  renderHabits();
  renderLeaderboard();
  renderCharts();
  if (day.habits[h.id]) {
    const name = isEN() ? h.en : h.ar;
    const n = habitPoints(h);
    showToast(h.legendary
      ? (isEN() ? `Legendary quest! "${name}" = ${n} points ⭐🤙` : `مهمة أسطورية! "${name}" = ${AR_NUMS[n] || n} نقاط ⭐🤙`)
      : (isEN() ? `Nice! "${name}" 🤙` : `أحسنتِ! "${name}" 🤙`));
  }

  try {
    /* ١) يومي (خاص بي) */
    await setDoc(doc(db, 'days', `${me.uid}_${date}`),
      { uid: me.uid, nick: nickname, date, week, habits: day.habits, points: day.points },
      { merge: true });

    if (!isAdmin) {
      /* ٢) ملخص أسبوعي للوحة المتصدرات */
      setDoc(doc(db, `weeks/${week}/players`, me.uid),
        { nick: nickname, points: myWeekPoints(), updated: Date.now() },
        { merge: true }).catch(() => {});
      /* ٣) عدّادات المجتمع (موزعة على شظايا لتجنب التزاحم) */
      const shard = Math.floor(Math.random() * STATS_SHARDS);
      setDoc(doc(db, `stats/${week}/shards`, String(shard)),
        { dayCounts: { [date]: increment(delta) }, habitCounts: { [h.id]: increment(delta) } },
        { merge: true }).catch(() => {});
      /* حدّثي النسخة المحلية للعدادات فورًا */
      const agg = (statsWeeks[week] = statsWeeks[week] || { dayCounts: {}, habitCounts: {} });
      agg.dayCounts[date]   = (agg.dayCounts[date]   || 0) + delta;
      agg.habitCounts[h.id] = (agg.habitCounts[h.id] || 0) + delta;
    }
  } catch {
    showToast('تعذر الحفظ — تحققي من الاتصال بالإنترنت');
  }
}

function renderHabits() {
  const grid = document.getElementById('habits-grid');
  if (!grid) return;
  grid.innerHTML = '';

  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString(isEN() ? 'en' : 'ar', { weekday: 'long', day: 'numeric', month: 'long' });

  if (preLaunch() && !isAdmin) {
    const days = Math.ceil((START_DATE - new Date()) / 86400000);
    const daysTxt = isEN()
      ? (days === 1 ? '1 day until we play' : `${days} days until we play`)
      : (days === 1 ? 'يوم واحد ويبدأ اللعب' : days === 2 ? 'يومان ويبدأ اللعب' : `${days} أيام ويبدأ اللعب`);
    const noteTxt = isEN()
      ? `Your spot is saved ☀️ We start together on Tuesday, July 21 — and every day until then I explain a part of the game on Instagram. Got a question before we start? The Wall 💬 is already open.`
      : `مكانك محجوز ☀️ ننطلق معًا يوم ${START_LABEL_AR} — وكل يوم حتى الانطلاقة أشرح شيئًا عن اللعبة على إنستغرام. وإذا خطر لك سؤال قبل البداية، الحائط 💬 مفتوح من الآن.`;
    grid.innerHTML = `
      <div class="countdown-card">
        <div class="countdown-num">${days}</div>
        <div style="font-weight:800;color:var(--deep)">${daysTxt} 🤙</div>
        <p>${noteTxt}</p>
      </div>`;
    document.getElementById('today-bar-fill').style.width = '0%';
    document.getElementById('today-count').textContent = isEN() ? 'Soon ☀️' : 'قريبًا ☀️';
    return;
  }

  const t = myToday();
  GROUPS.forEach(g => {
    const groupHabits = (GROUP_ITEMS[g.id] || []).map(id => HABITS.find(h => h.id === id)).filter(Boolean);
    if (groupHabits.length === 0) return;
    const header = document.createElement('div');
    header.className = 'quest-group';
    header.innerHTML = `<span class="quest-group-title">${g.emoji} ${isEN() ? g.en : g.ar}</span><span class="quest-group-line"></span>`;
    grid.appendChild(header);
    groupHabits.forEach(h => grid.appendChild(buildHabitCard(h, t)));
  });

  const done = HABITS.filter(h => t[h.id]).length;
  document.getElementById('today-bar-fill').style.width = `${(done / HABITS.length) * 100}%`;
  document.getElementById('today-count').textContent =
    done === HABITS.length
      ? `${done}/${HABITS.length} — ${isEN() ? 'Full day! 💖' : 'يوم كامل! 💖'}`
      : `${done}/${HABITS.length}`;
}

function buildHabitCard(h, t) {
    const el = document.createElement('div');
    el.className = 'habit-check' + (t[h.id] ? ' done' : '') + (h.legendary ? ' legendary' : '');
    el.style.borderInlineStartColor = habitColor(h);
    const badge = h.legendary
      ? (isEN() ? `⭐ Legendary ×${habitPoints(h)}` : `⭐ أسطورية ×${AR_NUMS[habitPoints(h)] || habitPoints(h)}`)
      : '';
    el.innerHTML = `
      ${badge ? `<span class="legendary-badge">${badge}</span>` : ''}
      <div class="habit-box">✓</div>
      <div class="habit-check-info">
        <div class="habit-check-ar">${isEN() ? h.en : h.ar}</div>
        <div class="habit-check-en">${isEN() ? h.ar : h.en}</div>
      </div>
      <div class="habit-emoji">${h.emoji}</div>`;
    el.addEventListener('click', () => toggleHabit(h));
    return el;
}

/* ── Worlds legend + why cards (ثابتة) ───────────────────── */
function renderWorldsLegend() {
  const el = document.getElementById('worlds-legend');
  el.innerHTML = '';
  Object.values(WORLDS).forEach(w => {
    const item = document.createElement('span');
    item.className = 'world-item';
    item.innerHTML = `<span class="world-dot" style="background:${w.color}"></span>${isEN() ? w.en : w.ar}`;
    el.appendChild(item);
  });
  const leg = document.createElement('span');
  leg.className = 'world-item';
  leg.innerHTML = `<span class="world-dot" style="background:${LEGENDARY_COLOR}"></span>${isEN() ? 'Legendary quest ⭐' : 'مهمة أسطورية ⭐'}`;
  el.appendChild(leg);
}

function renderWhy() {
  const grid = document.getElementById('why-grid');
  grid.innerHTML = '';
  HABITS.forEach(h => {
    const el = document.createElement('div');
    el.className = 'why-card';
    el.style.borderTopColor = habitColor(h);
    const legendaryTag = h.legendary
      ? `<span class="why-world" style="background:${LEGENDARY_COLOR}">${isEN() ? `Legendary ⭐ ×${habitPoints(h)}` : `مهمة أسطورية ⭐ ×${AR_NUMS[habitPoints(h)] || habitPoints(h)}`}</span> `
      : '';
    const worldTag = legendaryTag + h.worlds.map(w =>
      `<span class="why-world" style="background:${WORLDS[w].color}">${isEN() ? WORLDS[w].en : WORLDS[w].ar}</span>`).join(' ');
    const why = whyOf(h);
    el.innerHTML = `
      <h3>${h.emoji} ${isEN() ? h.en : h.ar}</h3>
      ${worldTag}
      <div class="why-quote">${why.quote}</div>
      <div class="why-source">${why.source}</div>
      <div class="why-science"><strong>${isEN() ? '🔬 What does science say?' : '🔬 ماذا يقول العلم؟'}</strong>${why.science}</div>`;
    grid.appendChild(el);
  });
}

/* ── Leaderboard (جولة الأسبوع) ──────────────────────────── */
let waitlistCount = null;
async function loadWaitlistCount() {
  try {
    const snap = await getCountFromServer(collection(db, 'users'));
    waitlistCount = snap.data().count;
    const el = document.getElementById('wl-count');
    if (el) el.textContent = waitlistCount;
  } catch { /* غير حرج */ }
}

function renderLeaderboard() {
  const list = document.getElementById('lb-list');
  if (!list) return;

  if (preLaunch() && !isAdmin) {
    list.innerHTML = isEN()
      ? `<div class="prelaunch-note">
          <strong id="wl-count">${waitlistCount ?? '…'}</strong> players have joined so far 🤍
          The first round starts Tuesday, July 21 — the board is empty because everyone starts from the same line.
        </div>`
      : `<div class="prelaunch-note">
          انضمّت حتى الآن <strong id="wl-count">${waitlistCount ?? '…'}</strong> لاعبة 🤍
          الجولة الأولى تبدأ ${START_LABEL_AR} — واللوحة فارغة لأن الجميع يبدأ من نفس الخط.
        </div>`;
    document.getElementById('round-chip').textContent = isEN()
      ? '⏳ First round starts Tuesday, July 21'
      : `⏳ الجولة الأولى تبدأ ${START_LABEL_AR}`;
    if (waitlistCount === null) loadWaitlistCount();
    return;
  }

  const rows = lbRows
    .filter(r => r.nick !== ADMIN_NAME)
    .map(r => ({ uid: r.uid, name: r.nick, pts: r.points || 0, me: me && r.uid === me.uid }));
  /* أضيفي نفسي إن لم أكن ضمن أفضل ٣٠ (تقدير محلي) */
  if (me && nickname && !isAdmin && !rows.find(r => r.uid === me.uid)) {
    rows.push({ uid: me.uid, name: nickname, pts: myWeekPoints(), me: true });
  }
  rows.sort((a, b) => b.pts - a.pts);

  const max = Math.max(1, rows[0]?.pts || 0);
  list.innerHTML = '';
  rows.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'lb-row' + (r.me ? ' me' : '');
    el.innerHTML = `
      <div class="lb-rank">${i + 1}</div>
      <div class="lb-name">${esc(r.name)} ${r.me ? `<small>${isEN() ? '(you)' : '(أنتِ)'}</small>` : ''}</div>
      <div class="lb-bar-wrap"><div class="lb-bar" style="width:${(r.pts / max) * 100}%"></div></div>
      <div class="lb-pts">${r.pts} ${isEN() ? 'pts' : 'نقطة'}</div>`;
    list.appendChild(el);
  });
  if (rows.length === 0) {
    list.innerHTML = isEN()
      ? '<div class="prelaunch-note">The board is still empty — be the first to score today ☀️</div>'
      : '<div class="prelaunch-note">اللوحة فارغة بعد — كوني أول من يسجل نقطة اليوم ☀️</div>';
  }

  const end = weekStart(new Date());
  end.setDate(end.getDate() + 7);
  const daysLeft = Math.max(0, Math.ceil((end - new Date()) / 86400000));
  document.getElementById('round-chip').textContent = isEN()
    ? `⏳ New round in ${daysLeft === 1 ? '1 day' : daysLeft + ' days'}`
    : `⏳ تتجدد الجولة بعد ${daysLeft === 1 ? 'يوم واحد' : daysLeft === 2 ? 'يومين' : daysLeft + ' أيام'}`;
}

/* ── Charts ──────────────────────────────────────────────── */
const DAY_LETTERS_AR = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
const DAY_LETTERS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_LETTERS = new Proxy({}, { get: (_, i) => (isEN() ? DAY_LETTERS_EN : DAY_LETTERS_AR)[i] });

function communityCountOn(dateK) {
  let total = 0;
  Object.values(statsWeeks).forEach(agg => { total += agg.dayCounts?.[dateK] || 0; });
  return Math.max(0, total);
}

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

async function renderCharts() {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(daysAgo(i));

  renderBars('community-chart', days.map(d => ({
    v: communityCountOn(dateKey(d)),
    label: DAY_LETTERS[d.getDay()],
  })), null, false);

  renderBars('personal-chart', days.map(d => {
    const day = myDays[dateKey(d)];
    const v = day ? Object.values(day.habits || {}).filter(Boolean).length : 0;
    return { v, label: DAY_LETTERS[d.getDay()] };
  }), HABITS.length, true);

  /* نسبة كل مهمة هذا الأسبوع */
  const wk = thisWeekKey();
  const agg = statsWeeks[wk] || { habitCounts: {} };
  const participants = Math.max(1, (await fetchParticipants()) || 1);
  const dayCount = Math.floor((new Date() - weekStart(new Date())) / 86400000) + 1;
  const possible = Math.max(1, dayCount * participants);

  const list = document.getElementById('habit-chart');
  list.innerHTML = '';
  HABITS.forEach(h => {
    const done = Math.max(0, agg.habitCounts?.[h.id] || 0);
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
  if (isEN()) {
    if (mins < 1)  return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
  }
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
        ${p.admin ? `<span class="post-badge">${isEN() ? 'Host' : 'المشرفة'}</span>` : ''}
        ${p.pinned ? `<span class="post-badge" style="background:var(--accent);color:var(--text)">${isEN() ? '📌 Pinned' : '📌 مثبّت'}</span>` : ''}
        <span class="post-time">${timeAgo(p.time)}</span>
        ${isAdmin ? `<button class="post-delete" data-act="reply" data-id="${p.id}">↩ رد</button>
                     <button class="post-delete" data-act="pin" data-id="${p.id}">${p.pinned ? 'إلغاء التثبيت' : '📌 تثبيت'}</button>` : ''}
        ${canDelete ? `<button class="post-delete" data-act="del" data-id="${p.id}">${isEN() ? 'delete' : 'حذف'}</button>` : ''}
      </div>
      <div class="post-body">${esc(p.text)}</div>
      ${p.reply ? `
        <div class="post-reply">
          <div class="post-head">
            <span class="post-author">${esc(p.reply.author)}</span>
            <span class="post-badge">${isEN() ? 'Host' : 'المشرفة'}</span>
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
    showToast(isEN() ? 'Posted 🤍' : 'نُشر سؤالك 🤍');
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
  const dashBtn = document.getElementById('tab-btn-admin');
  if (dashBtn) dashBtn.hidden = !isAdmin;
  if (isAdmin) renderPosts();
}

/* ── لوحة المشرفة (تظهر لها فقط) ─────────────────────────── */
async function renderAdminDash() {
  if (!isAdmin) return;
  const el = document.getElementById('admin-stats');
  if (!el) return;
  el.innerHTML = '<div class="card-desc">جارٍ تحميل الأرقام…</div>';

  const wk = thisWeekKey();
  const countOf = path => getCountFromServer(collection(db, path))
    .then(s => s.data().count).catch(() => '؟');

  const [usersC, mailsC, postsC, playersC] = await Promise.all([
    countOf('users'), countOf('mails'), countOf('posts'), countOf(`weeks/${wk}/players`),
  ]);
  await fetchStats(true);
  const agg = statsWeeks[wk] || { habitCounts: {}, dayCounts: {} };
  const weekTotal = Object.values(agg.dayCounts || {}).reduce((s, v) => s + Math.max(0, v), 0);
  const todayTotal = Math.max(0, agg.dayCounts?.[myDayKey()] || 0);

  let html = `
    <div style="margin-bottom:14px"><button class="btn btn-deep btn-small" id="export-json">⬇️ تنزيل نسخة احتياطية (JSON)</button></div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${usersC}</div><div class="stat-lbl">إجمالي المسجلات</div></div>
      <div class="stat-box"><div class="stat-num">${playersC}</div><div class="stat-lbl">لعبن هذا الأسبوع</div></div>
      <div class="stat-box"><div class="stat-num">${todayTotal}</div><div class="stat-lbl">مهمات أُنجزت اليوم</div></div>
      <div class="stat-box"><div class="stat-num">${weekTotal}</div><div class="stat-lbl">مهمات هذا الأسبوع</div></div>
      <div class="stat-box"><div class="stat-num">${postsC}</div><div class="stat-lbl">منشورات الحائط</div></div>
      <div class="stat-box"><div class="stat-num">${mailsC}</div><div class="stat-lbl">تركن بريدهن</div></div>
    </div>
    <div class="card-title" style="font-size:1rem">كل مهمة هذا الأسبوع</div>
    <div class="hbar-list" style="margin-bottom:18px">`;
  const maxHabit = Math.max(1, ...HABITS.map(h => Math.max(0, agg.habitCounts?.[h.id] || 0)));
  HABITS.forEach(h => {
    const n = Math.max(0, agg.habitCounts?.[h.id] || 0);
    html += `
      <div class="hbar-item">
        <div class="hbar-top"><span class="hbar-name">${h.emoji} ${h.ar}</span><span class="hbar-pct">${n}</span></div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${(n / maxHabit) * 100}%; background:${habitColor(h)}"></div></div>
      </div>`;
  });
  html += `</div>
    <div class="card-title" style="font-size:1rem">البريد الإلكتروني <button class="post-delete" id="copy-mails" style="margin-inline-start:8px">نسخ الكل</button></div>
    <div id="mails-list" class="card-desc">جارٍ التحميل…</div>`;
  el.innerHTML = html;
  document.getElementById('export-json').addEventListener('click', exportBackup);

  try {
    const snap = await getDocs(collection(db, 'mails'));
    const rows = snap.docs.map(d => d.data());
    const listEl = document.getElementById('mails-list');
    if (rows.length === 0) {
      listEl.textContent = 'لا يوجد بريد بعد — الحقل اختياري عند التسجيل';
    } else {
      listEl.innerHTML = rows.map(r =>
        `<div class="mail-row"><span>${esc(r.email)}</span><span style="color:rgba(74,57,45,.5)">${esc(r.nick || '')}</span></div>`).join('');
      document.getElementById('copy-mails').addEventListener('click', async () => {
        await navigator.clipboard.writeText(rows.map(r => r.email).join('\n')).catch(() => {});
        showToast(`نُسخ ${rows.length} بريدًا 🤍`);
      });
    }
  } catch {
    const listEl = document.getElementById('mails-list');
    if (listEl) listEl.textContent = 'تعذر تحميل البريد';
  }
}

/* ── نسخة احتياطية كاملة (JSON) — للمشرفة فقط ────────────── */
async function exportBackup() {
  if (!isAdmin) return;
  showToast('جارٍ تجهيز النسخة الاحتياطية…');
  const grab = async path => {
    const s = await getDocs(collection(db, path));
    const o = {};
    s.forEach(d => { o[d.id] = d.data(); });
    return o;
  };
  try {
    const out = { exportedAt: new Date().toISOString(), users: {}, mails: {}, posts: {}, days: {}, weeks: {}, stats: {} };
    out.users = await grab('users');
    out.mails = await grab('mails');
    out.posts = await grab('posts');
    out.days  = await grab('days');
    /* كل الأسابيع منذ الانطلاقة + الأسبوع الحالي والسابق */
    const wks = new Set([thisWeekKey(), prevWeekKey()]);
    for (let d = new Date(START_DATE); d <= new Date(); d.setDate(d.getDate() + 7)) {
      wks.add(dateKey(weekStart(d)));
    }
    for (const wk of wks) {
      out.weeks[wk] = await grab(`weeks/${wk}/players`);
      out.stats[wk] = await grab(`stats/${wk}/shards`);
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `play-over-mood-backup-${dateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('نُزّلت النسخة الاحتياطية 🤍');
  } catch {
    showToast('تعذر التصدير — تأكدي من تحديث قاعدة days');
  }
}

/* ── Tabs ────────────────────────────────────────────────── */
const TAB_IDS = ['quests', 'growth', 'why', 'wall', 'rules', 'admin'];

/* طبّقي اللغة أولًا حتى ينسخ تبويب القواعد النسخة الصحيحة */
applyEnglish();

/* تبويب القواعد يعرض نفس صندوق قواعد صفحة الدخول (مصدر واحد) */
const rulesClone = document.getElementById('rules-clone');
const gateRules  = document.querySelector('#nick-gate .game-rules');
if (rulesClone && gateRules) rulesClone.appendChild(gateRules.cloneNode(true));

function showTab(name) {
  TAB_IDS.forEach(t => {
    const pane = document.getElementById(`tab-${t}`);
    if (pane) pane.hidden = t !== name;
  });
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo({ top: 0 });
  if (name === 'growth') fetchStats();   /* حدّثي الرسوم عند فتح التحليل */
  if (name === 'admin') renderAdminDash();
}
document.querySelectorAll('.tab-btn').forEach(b =>
  b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ── Init ────────────────────────────────────────────────── */
renderWorldsLegend();
renderWhy();
initGate();
