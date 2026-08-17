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
  onSnapshot, addDoc, updateDoc, deleteDoc, orderBy, limit, startAfter,
  increment, where,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

/* استخراج معرّف فيديو يوتيوب من أي رابط شائع */
function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

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
const storage = getStorage(fb);

/* ── العناصر والمهمات ────────────────────────────────────── */
const WORLDS = {
  physical:  { ar: 'العنصر الجسدي',  en: 'Physical',      color: '#7BBBD4' },
  spiritual: { ar: 'العنصر الروحي',  en: 'Spiritual',     color: '#5EAF7A' },
  mental:    { ar: 'العنصر الذهني',  en: 'Mental',        color: '#8B7CC0' },
  emotional: { ar: 'العنصر الشعوري', en: 'Emotional',     color: '#D4819C' },
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
    quote: '«أرَأيتُم لو أنَّ نَهرًا ببابِ أحَدِكُم يَغتَسِلُ منه كُلَّ يَومٍ خَمسَ مَرَّاتٍ، هل يَبقى مِن دَرَنِه شيءٌ؟ قالوا: لا يَبقى مِن دَرَنِه شيءٌ، قال: فذلك مَثَلُ الصَّلَواتِ الخَمسِ، يَمحو اللهُ بهِنَّ الخَطايا»',
    source: 'رواه البخاري (٥٢٨) ومسلم (٦٦٧) — واللفظ لمسلم، عن أبي هريرة رضي الله عنه',
    science: 'فاصل منتصف اليوم: تحليل شامل لـ٢٢ تجربة (Albulescu وزملاؤه، PLOS ONE 2022) وجد أن الاستراحات القصيرة المنتظمة ترفع النشاط وتخفض الإرهاق قياسًا — ووقفة الظهر تقطع أطول فترة تركيز في يومك قبل أن يتراكم التعب.'
  },
  {
    id: 'asr', ar: 'صلاة العصر على وقتها', en: 'Asr On Time', emoji: '🌇', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«الذي تفوته صلاةُ العصر كأنما وُتِرَ أهلَه ومالَه»',
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
    science: 'وقفة قصيرة في ضحى النهار تجمع فائدتين مدروستين: التعرض لضوء النهار الذي يثبّت الساعة البيولوجية والمزاج، وأثر الفواصل القصيرة المنتظمة في استعادة التركيز والنشاط (التحليل الشامل PLOS ONE 2022).',
    momTip: 'مع طفلك: صلّيها وطفلك يلعب أو ينام بقربك — النية أهم من العزلة.',
    momTipEn: 'With your child: pray it while she plays or naps beside you — intention matters more than isolation.'
  },
  {
    id: 'athkar', ar: 'أذكار الصباح (مش لازم كلها)', en: 'Morning Adhkar', emoji: '📿', worlds: ['spiritual'],
    quote: '«مَنْ قَالَ حِينَ يُصْبِحُ: رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا، كَانَ حَقًّا عَلَى اللَّهِ أَنْ يُرْضِيَهُ»',
    source: 'رواه أحمد والترمذي وأبو داود، وحسّنه الألباني (يُنصح بمراجعة اللفظ والتخريج)',
    science: 'تحليلات شاملة لتدخلات الامتنان والذكر التأملي (منها Cregg & Cheavens 2021 على ٢٥ تجربة) تجد أثرًا ثابتًا — وإن كان هادئًا — في خفض أعراض القلق والاكتئاب وتحسين المزاج. البركة في الاستمرار لا في الكمية، ولهذا: مش لازم كلها.'
  },
  {
    id: 'athkareve', ar: 'أذكار المساء (مش لازم كلها)', en: 'Evening Adhkar', emoji: '🌆', worlds: ['spiritual'],
    quote: '﴿وَسَبِّحْ بِحَمْدِ رَبِّكَ قَبْلَ طُلُوعِ الشَّمْسِ وَقَبْلَ الْغُرُوبِ﴾',
    source: 'سورة ق — ٣٩',
    science: 'إنهاء اليوم بطقس هادئ ثابت هو أحد أكثر ما توصي به أبحاث النوم: الروتين المسائي المنتظم يرتبط قياسًا بنوم أسرع وأعمق، والذكر التأملي قبل النوم يخفض التوتر (التحليلات الشاملة نفسها لتدخلات الامتنان والذكر). ومش لازم كلها — المهم اللحظة الهادئة.'
  },
  {
    id: 'athkarsleep', ar: 'أذكار النوم', en: 'Sleep-Time Adhkar', emoji: '🌘', worlds: ['spiritual'],
    quote: '«اللَّهُمَّ إِنِّي أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ»',
    source: 'متفق عليه — عن البراء بن عازب رضي الله عنه',
    science: 'روتين ختامي ثابت قبل النوم — كلمات معروفة تُقال كل ليلة — يرتبط في أبحاث النوم بانخفاض القلق واسترخاء أسرع، وهو نفس مبدأ «طقوس النوم الثابتة» (sleep hygiene rituals) الموصى به لتحسين جودة النوم.'
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
    science: 'تحليل شامل في The Lancet Public Health (2022) على أكثر من ٤٧ ألف شخص وجد أن ٧ آلاف خطوة يوميًا تقريبًا ترتبط بانخفاض خطر الوفاة المبكرة بنسبة تصل إلى ٥٠٪ مقارنة بقلة الحركة.',
    momTip: 'مع طفلك: امشي وهو في العربة — نفس الأثر، ورفقة أجمل.',
    momTipEn: 'With your child: walk with the stroller — same benefit, sweeter company.'
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
    science: 'تعلّم مهارات ومعارف جديدة يبني «الاحتياطي المعرفي» — مرونة عصبية تحمي الذاكرة والدماغ مع التقدم في العمر، وترتبط في مراجعات منهجية واسعة بتأخر ظهور أعراض التدهور المعرفي.',
    momTip: 'مع طفلك: استمعي لبودكاست قصير أثناء الرضاعة أو وقت النوم — التعلم لا يحتاج مكتبًا هادئًا.',
    momTipEn: 'With your child: listen to a short podcast while nursing or during nap time — learning doesn’t need a quiet office.'
  },
  {
    id: 'meet', ar: 'تعرّف على شخص جديد', en: 'Meet Someone New', emoji: '🤝', worlds: ['env'],
    quote: '﴿وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا﴾',
    source: 'سورة الحجرات — ١٣',
    science: 'أشهر تحليل شامل في الموضوع (Holt-Lunstad وزملاؤها 2010، على ١٤٨ دراسة وأكثر من ٣٠٠ ألف شخص) وجد أن العلاقات الاجتماعية القوية ترتبط بزيادة فرص البقاء على قيد الحياة بنحو ٥٠٪ — أثر يوازي ترك التدخين ويفوق أثر السمنة.'
  },
  {
    id: 'recharge', ar: 'جلسة في الطبيعة', en: 'Time in Nature', emoji: '🌳', worlds: ['emotional'],
    quote: '﴿وَيَتَفَكَّرُونَ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ﴾',
    source: 'سورة آل عمران — ١٩١',
    science: 'تحليل شامل لـ١٤٣ دراسة (Twohig-Bennett & Jones 2018) وجد أن التعرض للمساحات الخضراء يرتبط بانخفاض الكورتيزول وضغط الدم ومعدل ضربات القلب، ودراسة ستانفورد (Bratman 2015) وجدت أن مشي ٩٠ دقيقة في الطبيعة يقلل الاجترار الذهني ونشاط مناطق القلق في الدماغ.'
  },
  {
    id: 'friend', ar: 'تواصل وجهًا لوجه مع شخص', en: 'Face-to-Face Connection with Someone', emoji: '🫂', worlds: ['emotional'],
    quote: '«مَثَلُ الجليسِ الصالحِ والجليسِ السَّوْءِ كحاملِ المِسْكِ ونافخِ الكِيرِ»',
    source: 'متفق عليه',
    science: 'دراسة هارفارد الممتدة ٨٥ عامًا — أطول دراسة عن السعادة في التاريخ — وجدت أن دفء العلاقات هو أقوى مؤشر للسعادة والصحة على المدى الطويل، أقوى من المال والشهرة والذكاء.'
  },
  {
    id: 'explore', ar: 'زيارة مكان جديد', en: 'Visit a New Place', emoji: '🧭', worlds: ['env'],
    quote: '﴿قُلْ سِيرُوا فِي الْأَرْضِ﴾',
    source: 'سورة العنكبوت — ٢٠',
    science: 'دراسة تتبّع يومي بالموقع الجغرافي (Heller وزملاؤها، Nature Neuroscience 2020) وجدت أن تنوّع الأماكن التي نزورها يوميًا يرتبط بمزاج أكثر إيجابية، ويرتبط ذلك بنشاط دوائر الدماغ المسؤولة عن الجِدّة والمكافأة — التجارب الجديدة غذاء للدماغ.'
  },
  {
    id: 'newthing', ar: 'أسوي شي جديد', en: 'Do Something New', emoji: '✨', worlds: ['mental'],
    quote: '«اثنتان لا تنقضيان: الحرص على العلم، والحرص على العمر»',
    source: 'من أثر معروف عن الصحابة في الحرص على استغلال العمر بالجديد والنافع',
    science: 'دراسة تتبّع بالموقع الجغرافي (Heller وزملاؤها، Nature Neuroscience 2020) وجدت أن التجارب الجديدة — لا الأماكن فقط — تنشّط دوائر الدماغ المسؤولة عن المكافأة، ومراجعات علم الأعصاب المعرفي تربط الجِدّة بتحسّن المزاج وتقوية الذاكرة طويلة المدى.'
  },
  {
    id: 'tidy', ar: 'ترتيب مساحتك', en: 'Tidy Your Space', emoji: '🧺', worlds: ['env'],
    quote: '«إِنَّ اللَّهَ جَمِيلٌ يُحِبُّ الْجَمَالَ»',
    source: 'رواه مسلم',
    science: 'دراسة UCLA (Saxbe & Repetti 2010) وجدت أن من يصفن بيوتهن بالفوضى ترتفع لديهن مستويات الكورتيزول (هرمون التوتر) خلال اليوم، وأبحاث برينستون (2011) أظهرت أن الفوضى البصرية تنافس انتباهك وتقلل تركيزك.'
  },
  {
    id: 'enjoy', ar: 'الترويح عن النفس', en: 'Do Something I Love', emoji: '🎨', worlds: ['emotional'],
    quote: '«خلِّ عنه يا عمر، فَلَهِيَ أسرعُ فيهم من نَضْح النَّبْل»',
    source: 'قاله ﷺ لعمر عن شعر عبد الله بن رواحة — رواه الترمذي والنسائي وصححه الألباني',
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
    quote: '«فإنّ لجسدك عليك حقًا»',
    source: 'رواه البخاري',
    science: 'مراجعات منهجية لأبحاث «الاستشفاء النفسي» (Sonnentag وزملاؤها) تجد أن الانفصال الحقيقي عن المشاغل — ولو لفترة قصيرة يوميًا — يتنبأ قياسًا بانخفاض الإرهاق وتحسّن المزاج والنوم. الراحة ليست مكافأة بعد الإنجاز، هي جزء من الإنجاز.',
    momTip: 'مع طفلك: خمس دقائق هدوء وهو يلعب بأمان بقربك تكفي — الراحة لا تحتاج غرفة مغلقة.',
    momTipEn: 'With your child: five quiet minutes while she plays safely nearby is enough — rest doesn’t need a closed door.'
  },
  {
    id: 'caregiving', ar: 'اعتنيتِ بطفلك اليوم', en: 'You Cared for Your Child Today', emoji: '🤱', worlds: ['emotional'], adminOnly: true,
    quote: '«كلكم راعٍ وكلكم مسؤول عن رعيته... والمرأة راعية في بيت زوجها ومسؤولة عن رعيتها»',
    source: 'متفق عليه',
    science: 'رعاية طفل صغير عمل ذهني وجسدي مستمر تقريبًا على مدار الساعة — أبحاث «الحِمل الذهني» للأمهات، إلى جانب أبحاث الرحمة الذاتية (Kristin Neff)، تجد أن الاعتراف الواعي بهذا الجهد اليومي يخفف من إرهاقه النفسي، حتى قبل أي راحة فعلية.'
  },
  {
    id: 'whitedays', ar: 'صيام الأيام البيض', en: 'Fasting the White Days', emoji: '🌕', worlds: ['spiritual'],
    quote: '«أمرنا رسول الله ﷺ أن نصوم من الشهر ثلاثة أيام: ثلاث عشرة، وأربع عشرة، وخمس عشرة»',
    source: 'عن أبي ذر رضي الله عنه — رواه النسائي وصححه الألباني (يُنصح بمراجعة اللفظ والتخريج)',
    science: 'مراجعة شاملة في The New England Journal of Medicine (de Cabo & Mattson 2019) لعشرات الدراسات على الصيام المتقطع وجدت تحسّنًا في حساسية الإنسولين وضغط الدم ومؤشرات الالتهاب — والأيام البيض نمط صيام متقطع منتظم كل شهر.'
  },
  {
    id: 'suhoor', ar: 'السحور', en: 'Suhoor', emoji: '🌙', worlds: ['spiritual'],
    quote: '«تسحّروا فإن في السحور بركة»',
    source: 'متفق عليه (يُنصح بمراجعة اللفظ والتخريج)',
    science: 'وجبة قبل الفجر تُبقي سكر الدم أكثر استقرارًا خلال ساعات الصيام الطويلة مقارنة بالصيام دون سحور، وهو ما تدعمه الأبحاث العامة في توقيت الوجبات وتنظيم الطاقة أثناء الصيام المتقطع (de Cabo & Mattson 2019).'
  },
  {
    id: 'kahf', ar: 'قراءة سورة الكهف', en: 'Reading Surat Al-Kahf', emoji: '🕋', worlds: ['spiritual'],
    quote: '«من قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين»',
    source: 'رواه الحاكم والبيهقي وصححه الألباني في صحيح الجامع (يُنصح بمراجعة اللفظ والتخريج)',
    science: 'مراجعات منهجية واسعة (منها أعمال فريق Koenig في جامعة Duke) تجد أن الطقوس الدينية المنتظمة والمتكررة أسبوعيًا ترتبط بانخفاض القلق وارتفاع الشعور بالمعنى والاستقرار النفسي.'
  },
  {
    id: 'salawat', ar: 'الصلاة على النبي ﷺ', en: 'Sending blessings upon the Prophet ﷺ', emoji: '🕊️', worlds: ['spiritual'], legendary: true, pts: 3,
    quote: '«أكثروا عليَّ من الصلاة يوم الجمعة وليلة الجمعة، فإن صلاتكم معروضة عليَّ»',
    source: '(يُنصح بمراجعة اللفظ والتخريج)',
    science: 'مراجعات منهجية واسعة (منها أعمال فريق Koenig في جامعة Duke) تجد أن الطقوس الدينية المنتظمة والمتكررة أسبوعيًا ترتبط بانخفاض القلق وارتفاع الشعور بالمعنى والاستقرار النفسي.'
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
  mood:    ['meet', 'recharge', 'explore', 'newthing', 'enjoy', 'goodtrace', 'sharehobby', 'solitude', 'friend', 'caregiving'],
  night:   ['maghrib', 'isha', 'athkareve', 'tidy', 'athkarsleep', 'sleep', 'tahajjud'],
};

/* تصنيفات حائط الأسئلة — قائمة أولية، عدّليها متى ما حبيتِ */
const WALL_TAGS = ['عادات', 'صلاة', 'دعم نفسي', 'اقتراح', 'سؤال عام'];
const WALL_TAGS_EN = ['Habits', 'Prayer', 'Support', 'Suggestion', 'General'];

/* ── اللغة الإنجليزية (وضع كامل لغير الناطقات بالعربية) ──── */
let lang = localStorage.getItem('pom_lang') || 'ar';
const isEN = () => lang === 'en';

/* ── الوضع الليلي — اختيار صريح يُحفظ، وإلا نتبع تفضيل النظام ── */
const savedTheme = localStorage.getItem('pom_theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
function isDarkNow() {
  return document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyThemeToggleUi() {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDarkNow() ? '☀️' : '🌙';
}
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = isDarkNow() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('pom_theme', next);
  applyThemeToggleUi();
});
applyThemeToggleUi();

const EN_WHY = {
  sleep:      { quote: '“The Messenger of Allah ﷺ disliked sleeping before Isha and talking after it.”', source: 'Agreed upon (Bukhari & Muslim)', science: 'Sleep is the quest that unlocks the rest: it regulates hunger hormones (leptin & ghrelin), cortisol and mood, and decides your energy for Fajr, movement and focus. That is why it is legendary — 2 points.' },
  tahajjud:   { quote: '“And in part of the night, pray tahajjud as an extra offering; it may be that your Lord will raise you to a praised station.”', source: 'Quran 17:79 · And ﷺ said: “The best prayer after the obligatory one is the night prayer” (Muslim)', science: 'Large systematic reviews (including Koenig’s work at Duke across hundreds of studies) consistently link regular religious practice with lower depression and anxiety and higher life satisfaction. The quiet solitude of night is the deepest form of that presence — the game’s highest quest: 5 points.' },
  fajrprayer: { quote: '“Whoever prays the two cool-hour prayers (Fajr and Asr) enters Paradise.”', source: 'Agreed upon', science: 'A fixed daily wake time is the anchor of your body clock. UK Biobank analysis of 60,000+ people (Windred et al., Sleep 2024) found sleep–wake regularity predicts longevity even more strongly than sleep duration.' },
  dhuhr:      { quote: '“If there were a river at your door and you bathed in it five times a day, would any dirt remain on you? They said: none would remain. He said: that is the likeness of the five prayers — Allah wipes away sins with them.”', source: 'Bukhari (528) & Muslim (667), narrated by Abu Hurayrah', science: 'A midday reset: a meta-analysis of 22 trials (Albulescu et al., PLOS ONE 2022) found short regular breaks measurably raise vigor and lower fatigue — Dhuhr cuts your longest stretch of effort before tiredness piles up.' },
  asr:        { quote: '“The one who misses the Asr prayer, it is as if he were bereft of his family and his wealth.”', source: 'Agreed upon', science: 'Asr lands on the well-documented afternoon dip in alertness from circadian research — a restorative pause exactly when your brain needs it.' },
  maghrib:    { quote: '“My nation remains upon goodness as long as they do not delay Maghrib until the stars crowd together.”', source: 'Abu Dawud', science: 'Fixed transition rituals between day and evening help the mind detach from the day’s demands — recovery research (Sonnentag et al.) finds such detachment among the strongest predictors of calmer evenings and better sleep.' },
  isha:       { quote: '“And whoever prays Isha in congregation, it is as if he stood half the night in prayer.”', source: 'Muslim', science: 'Closing the day at a fixed time paves the way for early sleep — sleep research finds a consistent evening routine among the strongest factors for falling asleep faster and deeper.' },
  duha:       { quote: '“…and two rak‘ahs of Duha suffice for all of it.”', source: 'Muslim — on the daily charity due from every joint of the body', science: 'A brief mid-morning pause combines two studied benefits: daylight exposure that stabilizes the body clock and mood, and the measurable recharge of short regular breaks (PLOS ONE 2022 meta-analysis).' },
  athkar:     { quote: '“Whoever says upon waking: I am pleased with Allah as my Lord, with Islam as my religion, and with Muhammad ﷺ as my prophet — it becomes a right upon Allah to please him.”', source: 'Ahmad, Tirmidhi & Abu Dawud, graded hasan by al-Albani (wording/chain worth double-checking)', science: 'Meta-analyses of gratitude and contemplative practice (incl. Cregg & Cheavens 2021, 25 trials) find a consistent — if quiet — effect on anxiety, low mood and wellbeing. Consistency beats quantity, hence: you don’t need all of them.' },
  athkareve:  { quote: '“And glorify the praise of your Lord before sunrise and before sunset.”', source: 'Quran 50:39', science: 'Ending the day with a calm fixed ritual is a top recommendation of sleep research: regular evening wind-downs are linked with faster, deeper sleep, and contemplative practice lowers stress. You don’t need all of them — the calm moment is the point.' },
  athkarsleep: { quote: '“O Allah, I submit myself to You, entrust my affair to You, and turn my back to You, out of desire and fear of You. There is no refuge or escape except to You. I believe in Your Book which You revealed, and Your Prophet whom You sent.”', source: 'Agreed upon — narrated by al-Bara’ ibn ‘Azib', science: 'A fixed closing ritual before sleep — the same familiar words said every night — is linked in sleep research to lower anxiety and faster relaxation, the same principle behind recommended sleep-hygiene rituals.' },
  fajr:       { quote: '“O Allah, bless my nation in its early mornings.”', source: 'Abu Dawud & Tirmidhi — the Prophet’s ﷺ prayer for the early hours', science: 'Early morning light anchors the circadian clock and lifts mood. A study of 800,000+ people (JAMA Psychiatry 2021) found shifting sleep midpoint one hour earlier is associated with ~23% lower depression risk.' },
  quran:      { quote: '“Read the Quran, for it will come on the Day of Resurrection as an intercessor for its companions.”', source: 'Muslim', science: 'Studies of Quran recitation and listening recorded lower anxiety markers, blood pressure and heart rate; regular daily reading in general builds cognitive reserve that protects memory with age.' },
  walk:       { quote: '“The strong believer is better and more beloved to Allah than the weak believer.”', source: 'Muslim', science: 'A meta-analysis in The Lancet Public Health (2022, 47,000+ people) found ~7,000 daily steps associated with up to 50% lower risk of early death compared to being sedentary.' },
  water:      { quote: '“And We made from water every living thing.”', source: 'Quran 21:30', science: 'Even mild dehydration (1–2% of body weight) measurably impairs concentration and mood and increases headaches and fatigue in repeated controlled trials; adequate water improves alertness through the day.' },
  learn:      { quote: '“Whoever travels a path seeking knowledge, Allah eases for him a path to Paradise.”', source: 'Muslim', science: 'Learning new skills builds “cognitive reserve” — neural flexibility that protects memory and brain health with age, linked in broad systematic reviews to delayed cognitive decline.' },
  meet:       { quote: '“And We made you peoples and tribes that you may know one another.”', source: 'Quran 49:13', science: 'The landmark meta-analysis (Holt-Lunstad et al. 2010; 148 studies, 300,000+ people) found strong social ties associated with ~50% higher survival odds — an effect comparable to quitting smoking.' },
  recharge:   { quote: '“…and they reflect upon the creation of the heavens and the earth.”', source: 'Quran 3:191', science: 'A meta-analysis of 143 studies (Twohig-Bennett & Jones 2018) linked greenspace exposure to lower cortisol, blood pressure and heart rate; and a Stanford study (Bratman 2015) found a 90-minute nature walk reduces rumination and anxiety-related brain activity.' },
  friend:     { quote: '“The likeness of a righteous companion and a bad companion is that of a musk-seller and a blacksmith’s bellows.”', source: 'Agreed upon', science: 'Harvard’s 85-year study — the longest study of happiness ever run — found warm relationships the strongest predictor of long-term happiness and health, stronger than money, fame or IQ.' },
  explore:    { quote: '“Say: travel through the land.”', source: 'Quran 29:20', science: 'GPS-tracking research (Heller et al., Nature Neuroscience 2020) found that variety in the places we visit daily correlates with more positive mood, tied to the brain’s novelty-and-reward circuits — new experiences feed the brain.' },
  tidy:       { quote: '“Indeed, Allah is beautiful and loves beauty.”', source: 'Muslim', science: 'A UCLA study (Saxbe & Repetti 2010) found people who describe their homes as cluttered show elevated cortisol through the day; Princeton research (2011) showed visual clutter competes for your attention and lowers focus.' },
  enjoy:      { quote: '“Let him be, O Umar — for it moves through them faster than a shower of arrows.”', source: 'Said ﷺ about Ibn Rawaha’s poetry — Tirmidhi & Nasa’i, authenticated by al-Albani', science: 'A study of 93,000+ people across 16 countries (Fancourt et al., Nature Medicine 2023) found having a hobby associated with fewer depressive symptoms and higher life satisfaction and sense of meaning — in every country studied.' },
  goodtrace:  { quote: '“And removing something harmful from the path is charity.”', source: 'Agreed upon', science: 'A meta-analysis of 27 experiments (Curry et al. 2018) found small acts of kindness measurably raise the giver’s happiness — goodness returns to its doer first, and the surroundings win too.' },
  sharehobby: { quote: '“Allah is in the aid of His servant as long as the servant is in the aid of his brother.”', source: 'Muslim', science: 'Sharing what you love combines two studied effects: giving boosts the giver’s wellbeing (Curry’s 2018 meta-analysis), and social bonds predict health and longevity (Holt-Lunstad’s 148-study meta-analysis) — your hobby becomes a bridge.' },
  solitude:   { quote: '“Indeed, your body has a right over you.”', source: 'Bukhari', science: 'Systematic reviews of psychological recovery research (Sonnentag et al.) find that genuine daily detachment — even briefly — measurably predicts less exhaustion and better mood and sleep. Rest is not a reward after the work; it is part of the work.' },
  caregiving: { quote: '“Each of you is a guardian and responsible for those in his care… and the woman is a guardian in her husband’s home and responsible for those in her care.”', source: 'Agreed upon', science: 'Caring for a young child is near-constant mental and physical labor — research on maternal “mental load,” alongside self-compassion research (Kristin Neff), finds that consciously acknowledging this daily effort eases its psychological toll, even before any actual rest arrives.' },
  whitedays:  { quote: '“The Messenger of Allah ﷺ commanded us to fast three days of the month: the 13th, 14th, and 15th.”', source: 'Narrated by Abu Dharr — Nasa’i, authenticated by al-Albani (wording/chain worth double-checking)', science: 'A major review in The New England Journal of Medicine (de Cabo & Mattson 2019) covering dozens of studies on intermittent fasting found improvements in insulin sensitivity, blood pressure, and inflammation markers — the White Days are a naturally recurring monthly pattern of exactly this kind of fasting.' },
  suhoor:     { quote: '“Eat suhoor, for in suhoor there is blessing.”', source: 'Agreed upon (wording/chain worth double-checking)', science: 'A pre-dawn meal keeps blood sugar more stable through the long fasting hours compared to fasting without it — consistent with broader research on meal timing and energy regulation during intermittent fasting (de Cabo & Mattson 2019).' },
  kahf:       { quote: '“Whoever reads Surat Al-Kahf on Friday will be illuminated with light between the two Fridays.”', source: 'Al-Hakim & al-Bayhaqi, authenticated by al-Albani in Sahih al-Jami (wording/chain worth double-checking)', science: 'Broad systematic reviews (including Koenig’s work at Duke) find that regular, recurring weekly religious rituals are associated with lower anxiety and greater sense of meaning and psychological stability.' },
  salawat:    { quote: '“Send abundant blessings upon me on Friday and the night of Friday, for your blessings are presented to me.”', source: '(wording/chain worth double-checking)', science: 'Broad systematic reviews (including Koenig’s work at Duke) find that regular, recurring weekly religious rituals are associated with lower anxiety and greater sense of meaning and psychological stability.' },
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
      <div class="rule-row"><span class="rule-emoji">⭐</span><span>Every quest = 1 point. The golden legendary quests are worth more (2 to 5 points, depending on their impact) because they unlock the rest (in real life 🎉).</span></div>
      <div class="rule-row"><span class="rule-emoji">🔁</span><span>Every Tuesday a new round begins — and a missed day erases nothing; continue from where you are.</span></div>
      <div class="rule-row"><span class="rule-emoji">🤙🏻</span><span>We play together, not against each other — the board is for encouragement, the wall is for your questions and thoughts.</span></div>
      <div class="rule-row"><span class="rule-emoji">🌼</span><span>The Arabic version is written in the feminine, the language of this space — men are fully welcome; same rules, same game.</span></div>
      <div class="rule-row"><span class="rule-emoji">🤎</span><span>We are a Muslim community and the content is built on that — if you follow another faith, you are most welcome: this is a safe, supportive space for everyone.</span></div>
      <div class="rule-row"><span class="rule-emoji">#️⃣</span><span>Share the game on Instagram or anywhere (every share counts — it doesn’t have to be perfect). Use our hashtags so we find each other: <bdi dir="ltr">#playovermood</bdi> &amp; <bdi dir="rtl">#نلعب_على_مزاجنا</bdi> 🤙🏻</span></div>`);
  document.querySelectorAll('.game-rules').forEach(el => { el.style.textAlign = 'left'; });
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

  setAll('.tab-btn', ['🎮 Quests', '📊 Progress', '💬 The Wall', '📷 Photo Wall', '💡 Ideas', '🐢 Procrastination', '📝 Reflections', '📈 My Board', '📖 The Why', '📜 Rules']);

  set('#tab-quests .card-label', '① Today’s Quests · مهمات اليوم');
  set('#tab-quests .card-title', 'Which quests did you complete today?');
  set('#tab-quests .card-desc', 'Tap every quest you completed — regular = 1 point, legendary ⭐ = more');

  setAll('#tab-growth .card-label', ['③ Leaderboard · لوحة المتصدرات', '④ Growth · النمو']);
  setAll('#tab-growth .card-title', ['This week’s round', 'Your growth and the community’s']);
  setAll('#tab-growth .card-desc', ['The board resets every Tuesday — a fresh chance every week for every newcomer', 'Last 14 days']);
  setAll('#tab-growth .chart-title', ['Community growth 🌍', 'Your growth 💕', 'Each quest 📊']);
  setAll('#tab-growth .chart-sub', ['Total quests completed daily by everyone', 'Your daily total', 'Per-quest completion this week']);
  setAll('#progress-subtabs .subtab-btn', ['Weekly grid', 'Every quest', 'One quest at a time']);
  set('#progress-subtab-single .card-title', 'One quest at a time');
  set('#progress-subtab-single .card-desc', 'Pick a quest to see its record across several weeks');

  set('#tab-why .card-label', '② The Why · لماذا هذه المهمات؟');
  set('#tab-why .card-title', 'Intention and science, together');
  set('#tab-why .card-desc', 'Every quest has a root in revelation and support from modern studies');

  set('#tab-wall .card-label', '⑤ The Wall · حائط الأسئلة');
  set('#tab-wall .card-title', 'Ask or share');
  set('#tab-wall .card-desc', 'Write a question or thought for everyone — and I answer here');
  const postInput = document.getElementById('post-input');
  if (postInput) postInput.placeholder = 'Write your question or thought…';
  set('#post-form button', 'Post');
  const wallSearchInput = document.getElementById('wall-search-input');
  if (wallSearchInput) wallSearchInput.placeholder = 'Search the wall…';
  setAll('#wall-tag-select option', ['All categories', ...WALL_TAGS_EN]);

  set('#tab-photos .card-label', '📷 Photo Wall · حائط الصور');
  set('#tab-photos .card-title', 'Share a photo from your quest');
  set('#tab-photos .card-desc', 'Everyone can see these — upload a general photo here, or use the 📷 button on any quest in the board to link it directly');
  const photoCaptionInput = document.getElementById('photo-caption-input');
  if (photoCaptionInput) photoCaptionInput.placeholder = 'Caption (optional)…';
  set('#photo-form button[type=submit]', 'Post photo');

  set('#tab-rules .card-label', 'How We Play · قواعد اللعبة');
  set('#tab-rules .card-title', 'How do we play here?');
  set('#tab-rules .card-desc', 'The same rules you read at the door — always here when you need them');

  set('#tab-features .card-label', '💡 Feature Requests · اقتراحك');
  set('#tab-features .card-title', 'Your voice reaches us 🤍');
  set('#tab-features .card-desc', 'Write any idea or feature you’d love to see — every suggestion reaches me and is genuinely considered, and you can track its status right here');
  const featureInput = document.getElementById('feature-input');
  if (featureInput) featureInput.placeholder = 'Write your suggestion here…';
  set('#feature-form button[type=submit]', 'Send suggestion');
  setAll('#features-status-filter option', ['All statuses', ...Object.values(STATUS).map(v => v.en)]);

  set('#tab-procrastination .card-label', '🐢 Procrastination · المماطلة');
  set('#tab-procrastination .card-title', 'What are you putting off?');
  set('#tab-procrastination .card-desc', 'Your private list — nobody else can see it. Track its stages, and earn a personal point when you finally finish it 🤍');
  set('.procrastination-callout', 'Imagine this task were a game — what could you do to make it more fun? Do it at a different time? A different place? Add color? Sound? Do it with different people?<br><br>Remember: the only thing you truly have is this moment — not the past, not the future, this moment 🎮');
  const procrastinationInput = document.getElementById('procrastination-input');
  if (procrastinationInput) procrastinationInput.placeholder = 'e.g. Organize my closet…';
  set('#procrastination-form button[type=submit]', 'Add');
  setAll('#procrastination-status-filter option', ['All statuses', 'Planning', 'Preparing', 'Executing', 'Done']);

  set('#tab-reflect .card-label', '📝 Reflections · التدبرات والتأملات');
  set('#reflect-edit-btn', '✏️ edit question');
  set('#tab-reflect .card-desc', 'Everyone can see your answers — share your reflections with the community, and update yours anytime this week');
  const reflectInput = document.getElementById('reflect-input');
  if (reflectInput) reflectInput.placeholder = 'Write your answer here…';
  set('#reflect-form button[type=submit]', 'Save my answer');

  set('#about-box', 'I’m 3aosh 🤍 A software engineer and certified teacher. I read psychology (though these days I prefer fiqh al-nafs — the Islamic understanding of the self), apply what I learn, and explore its connection to Islam. I love learning, helping people, and games — both kinds, electronic and real-life competition 🤙🏻 I started this game for myself, then thought: why not share it with the world?');
  set('#footer-socials-label', 'My Socials');
  set('#footer-copyright', 'Copyright © 2026 Aisha Jabr. All Rights Reserved.');
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

/* ── يبدأ اليوم من الفجر لا من منتصف الليل ───────────────────
   قبل فجر اليوم الحقيقي: نعتبر أن «اليوم» لا يزال أمس (نافذة سماح).
   dayShiftDays: 0 عادي، -1 لا زلنا في يوم الأمس بانتظار الفجر.
   بدون تحديد الموقع: نبقى على منتصف الليل تلقائيًا (fallback آمن). */
let dayShiftDays = 0;
function effectiveNow() {
  const d = new Date();
  if (dayShiftDays) d.setDate(d.getDate() + dayShiftDays);
  return d;
}
function thisWeekKey() { return dateKey(weekStart(effectiveNow())); }
function prevWeekKey() { const d = weekStart(effectiveNow()); d.setDate(d.getDate() - 7); return dateKey(d); }
function weekNumberOf(wk) {
  const start = weekStart(START_DATE);
  const wkDate = new Date(wk + 'T12:00:00');
  return Math.round((wkDate - start) / (7 * 86400000)) + 1;
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
let me        = null;   // Firebase user (anonymous أو Google)
let isAdmin   = false;
let nickname  = localStorage.getItem('pom_nick') || null;
let myDays    = {};     // مرآة محلية لأيامي: date -> {habits, points, custom}
let myCustomHabits = []; // عاداتي الخاصة: [{id, ar, world}, ...] — شخصية، لا تدخل اللوحة العامة

/* المهمات التي اخترت إخفاءها عن تحليلي الشخصي (★ في لوحة المهمات) — تفضيل جهاز، لا يغيّر اللوحة نفسها */
let focusExcluded = null;
let focusLsKeyCached = null;
function focusLsKey() { return `pom_focus_excluded_${me?.uid || 'anon'}`; }
function loadFocusIfNeeded() {
  const k = focusLsKey();
  if (focusExcluded && focusLsKeyCached === k) return;
  focusLsKeyCached = k;
  try { focusExcluded = new Set(JSON.parse(localStorage.getItem(k)) || []); }
  catch { focusExcluded = new Set(); }
}
function isFocused(id) { loadFocusIfNeeded(); return !focusExcluded.has(id); }
function toggleFocus(id) {
  loadFocusIfNeeded();
  if (focusExcluded.has(id)) focusExcluded.delete(id); else focusExcluded.add(id);
  localStorage.setItem(focusLsKey(), JSON.stringify([...focusExcluded]));
  renderHabits();
  renderMyProgress();
}
let lbRows    = [];     // أفضل ٣٠ لاعبة هذا الأسبوع
let statsWeeks = {};    // week -> {dayCounts, habitCounts}
let statsFetchedAt = 0;
let participantsCount = null;
let participantsFetchedAt = 0;
const WALL_PAGE = 15;
let featuresCache = []; /* طلبات الميزات */
let featureLikeDocs = []; /* إعجابات الاقتراحات — تحديث حي، غير مرتبطة بأسبوع */
let featuresStatusFilter = ''; /* فلترة المشرفة فقط بحسب حالة الاقتراح */
let wallPageIndex = 0;      /* الصفحة المعروضة حاليًا في الحائط، تبدأ من ٠ */
let wallPages = [];         /* wallPages[i] = منشورات تلك الصفحة */
let wallHasMore = true;     /* هل يُحتمل وجود صفحة بعد آخر صفحة حُمّلت؟ */
let wallLoading = false;
let wallSearchCache = null; /* كل المنشورات — تُحمَّل مرة واحدة عند أول بحث/تصفية */
let wallSearchQuery = '';
let wallSearchTag = '';
let photosCache = []; /* صور المهمات — أحدث ٣٠، تحديث حي */
let listenersStarted = false;
let mission = null; /* { text, link, image, updated } */
let announcement = null; /* { text, updated } — إعلان أعلى مهمة الأسبوع */
let announcementReactionDocs = []; /* ردود فعل الإعلان الحالي (تحديث حي) */
let announcementReactionsUnsub = null;
const DEFAULT_REFLECT_Q = 'ماذا تعلمتِ هذا الأسبوع؟';
const DEFAULT_REFLECT_Q_EN = 'What did you learn this week?';
let reflectQuestion = DEFAULT_REFLECT_Q;
let reflectQuestionEn = DEFAULT_REFLECT_Q_EN;
let myReflectAnswer = '';
let myReflectLoaded = false;
let reflectAnswersCache = [];

function myDayKey() { return dateKey(effectiveNow()); }
function myToday() { return (myDays[myDayKey()] || {}).habits || {}; }

/* نافذة سماح ليوم أمس فقط — لمن نسيت تسجّل قبل بداية يوم جديد (فجرًا) ── */
let questsViewOffset = 0; /* ٠ = اليوم، -١ = أمس فقط */
function activeViewDate() {
  const d = effectiveNow();
  d.setDate(d.getDate() + questsViewOffset);
  return d;
}
function activeDayKey() { return dateKey(activeViewDate()); }
function activeWeekKey() { return dateKey(weekStart(activeViewDate())); }
function dayPoints(habits) {
  return HABITS.reduce((s, h) => s + (habits[h.id] ? habitPoints(h) : 0), 0);
}
function myWeekPoints(wk) {
  wk = wk || thisWeekKey();
  return Object.entries(myDays)
    .filter(([date]) => dateKey(weekStart(new Date(date + 'T12:00:00'))) === wk)
    .reduce((s, [, d]) => s + (d.points || 0), 0);
}

/* نقاطك ظاهرة دائمًا أعلى الصفحة — تحدّث فورًا عند كل تأشير */
function updateMyPointsChip() {
  const row = document.getElementById('my-points-row');
  const chip = document.getElementById('my-points-chip');
  if (!row || !chip || !nickname || isAdmin || preLaunch()) { if (row) row.hidden = true; return; }
  row.hidden = false;
  const pts = myWeekPoints();
  chip.textContent = isEN() ? `⭐ Your points this week: ${pts}` : `⭐ نقاطك هذا الأسبوع: ${pts}`;
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
  /* عند جهاز جديد/تخزين ممسوح: قراءة مباشرة لآخر شهر لمرة واحدة (يكفي لتقدم الأسبوع والشهر) */
  const gets = [];
  for (let i = 0; i < 31; i++) {
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
    signInAnonymously(auth).catch(err => {
      console.error('signInAnonymously failed:', err.code, err.message);
      showToast(`تعذر الاتصال (${err.code || 'خطأ'}) — تحققي من الشبكة أو أغلقي أي حاجب إعلانات وحاولي مجددًا`);
    });
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

  /* لا نطلب الموقع إلا للاعبة معروفة مسبقًا — الزائرة الجديدة تشوف شاشة الاسم فورًا بدون تأخير */
  if (nickname) await refreshDayBoundary();
  loadMyDaysLocal();
  if (nickname && Object.keys(myDays).length === 0) {
    await fetchMyDaysFromServer();
  }
  loadMissionProgressLocal();
  if (nickname) { await loadMyCustomHabits(); await loadMyReflectAnswer(); await loadMyProcrastination(); }

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
    query(collection(db, 'posts'), orderBy('time', 'desc'), limit(WALL_PAGE)),
    snap => {
      wallPages[0] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (wallPageIndex === 0) renderPosts();
    },
    () => {}
  );

  onSnapshot(
    query(collection(db, 'photos'), orderBy('time', 'desc'), limit(30)),
    snap => {
      photosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPhotos();
    },
    () => {}
  );

  onSnapshot(doc(db, 'meta', 'mission'), snap => {
    mission = snap.exists() ? snap.data() : null;
    renderMission();
  }, () => {});

  onSnapshot(doc(db, 'meta', 'announcement'), snap => {
    announcement = snap.exists() ? snap.data() : null;
    subscribeAnnouncementReactions();
    renderAnnouncement();
  }, () => {});

  onSnapshot(doc(db, 'meta', 'reflectQuestion'), snap => {
    reflectQuestion = snap.exists() && snap.data().text ? snap.data().text : DEFAULT_REFLECT_Q;
    reflectQuestionEn = snap.exists() && snap.data().textEn ? snap.data().textEn : DEFAULT_REFLECT_Q_EN;
    renderReflectTab();
  }, () => {});

  onSnapshot(
    collection(db, 'reflections'),
    snap => {
      reflectAnswersCache = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.text);
      renderReflectAnswers();
    },
    () => {}
  );

  onSnapshot(
    query(collection(db, 'features'), orderBy('time', 'desc'), limit(50)),
    snap => {
      featuresCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFeatures();
    },
    () => {}
  );

  onSnapshot(
    collection(db, 'featureLikes'),
    snap => {
      featureLikeDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFeatures();
    },
    () => {}
  );

  fetchStats();
}

async function toggleFeatureLike(featureId) {
  if (!me) return;
  const docId = `${featureId}_${me.uid}`;
  const exists = featureLikeDocs.some(d => d.id === docId);
  try {
    if (exists) await deleteDoc(doc(db, 'featureLikes', docId));
    else await setDoc(doc(db, 'featureLikes', docId), { featureId, uid: me.uid, time: Date.now() });
  } catch (err) {
    console.error('toggleFeatureLike failed:', err);
    /* الكتابة غالبًا تصل فعلًا رغم الخطأ هنا (رأت المستخدمة إعجابها محفوظًا بعد التحديث) —
       على الأغلب انقطاع مؤقت بالاتصال قبل وصول تأكيد الخادم، لا مشكلة حقيقية بالحفظ.
       لا نعرض تنبيهًا مزعجًا لعملية بسيطة كالإعجاب؛ فقط نسجّل الخطأ للمراجعة. */
  }
}

/* ── اقتراحاتكن — طلبات ميزات عامة تراها الجميع ──────────── */
const STATUS = {
  new:      { ar: 'قيد المراجعة', en: 'Under Review', cls: 'status-new' },
  progress: { ar: 'قيد التنفيذ', en: 'In Progress',  cls: 'status-progress' },
  planned:  { ar: 'لاحقًا',      en: 'Planned',      cls: 'status-planned' },
  done:     { ar: 'تم التنفيذ',  en: 'Done',         cls: 'status-done' },
  declined: { ar: 'ملغاة',       en: 'Declined',     cls: 'status-declined' },
};

function renderFeatures() {
  const list = document.getElementById('features-list');
  if (!list) return;
  list.innerHTML = '';

  const filterRow = document.getElementById('features-status-filter-row');
  if (filterRow) filterRow.hidden = !isAdmin;
  if (!isAdmin) featuresStatusFilter = '';

  if (featuresCache.length === 0) {
    list.innerHTML = `<div class="mission-empty">${isEN() ? 'No suggestions yet — be the first 🤍' : 'ما في اقتراحات بعد — كوني أول من يقترح 🤍'}</div>`;
    return;
  }

  const shown = ((isAdmin && featuresStatusFilter)
    ? featuresCache.filter(f => (f.status || 'new') === featuresStatusFilter)
    : featuresCache
  ).slice().sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.time - a.time);

  if (shown.length === 0) {
    list.innerHTML = `<div class="mission-empty">${isEN() ? 'Nothing with this status' : 'ما في شي بهالحالة'}</div>`;
    return;
  }

  shown.forEach(f => {
    const st = STATUS[f.status] || STATUS.new;
    const canDelete = isAdmin || (me && f.uid === me.uid);
    const likeCount = featureLikeDocs.filter(d => d.featureId === f.id).length;
    const myLike = me && featureLikeDocs.some(d => d.id === `${f.id}_${me.uid}`);
    const el = document.createElement('div');
    el.className = 'post-item' + (f.pinned ? ' pinned' : '');
    el.innerHTML = `
      <div class="post-head">
        <span class="post-author">${esc(f.author)}</span>
        <span class="status-badge ${st.cls}">${isEN() ? st.en : st.ar}</span>
        ${f.pinned ? `<span class="post-badge" style="background:var(--accent);color:var(--text)">${isEN() ? '📌 Pinned' : '📌 مثبّت'}</span>` : ''}
        <span class="post-time">${timeAgo(f.time)}</span>
        ${isAdmin ? `<button class="post-delete" data-act="fpin" data-id="${f.id}">${f.pinned ? (isEN() ? 'unpin' : 'إلغاء التثبيت') : (isEN() ? '📌 pin' : '📌 تثبيت')}</button>` : ''}
        ${isAdmin ? `<button class="post-delete" data-act="freply" data-id="${f.id}">${f.reply ? (isEN() ? '✏️ edit reply' : '✏️ تعديل الرد') : (isEN() ? '↩ reply' : '↩ رد')}</button>` : ''}
        ${canDelete ? `<button class="post-delete" data-act="fdel" data-id="${f.id}">${isEN() ? 'delete' : 'حذف'}</button>` : ''}
      </div>
      <div class="post-body">${esc(f.text)}</div>
      <div class="announcement-reactions" style="margin-top:8px;">
        <button class="reaction-btn${myLike ? ' active' : ''}" data-act="flike" data-id="${f.id}">❤️ <span>${likeCount}</span></button>
      </div>
      ${isAdmin ? `
        <select class="status-select" data-id="${f.id}" style="margin-top:8px; display:block;">
          ${Object.entries(STATUS).map(([k, v]) =>
            `<option value="${k}" ${f.status === k || (!f.status && k === 'new') ? 'selected' : ''}>${isEN() ? v.en : v.ar}</option>`).join('')}
        </select>` : ''}
      ${f.reply ? `
        <div class="post-reply">
          <div class="post-head">
            <span class="post-author">${esc(f.reply.author)}</span>
            <span class="post-badge">${isEN() ? 'Host' : 'المشرفة'}</span>
          </div>
          ${esc(f.reply.text)}
        </div>` : ''}`;
    list.appendChild(el);
  });

  list.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const status = sel.value;
      const i = featuresCache.findIndex(x => x.id === id);
      if (i !== -1) featuresCache[i] = { ...featuresCache[i], status };
      renderFeatures();
      try { await updateDoc(doc(db, 'features', id), { status }); }
      catch { showToast('تعذر تحديث الحالة'); }
    });
  });

  list.querySelectorAll('[data-act="fdel"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      featuresCache = featuresCache.filter(x => x.id !== id);
      renderFeatures();
      try { await deleteDoc(doc(db, 'features', id)); }
      catch { showToast('تعذر الحذف'); }
    });
  });

  list.querySelectorAll('[data-act="flike"]').forEach(btn => {
    btn.addEventListener('click', () => toggleFeatureLike(btn.dataset.id));
  });

  list.querySelectorAll('[data-act="fpin"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const f = featuresCache.find(x => x.id === id);
      const newPinned = !f?.pinned;
      const i = featuresCache.findIndex(x => x.id === id);
      if (i !== -1) featuresCache[i] = { ...featuresCache[i], pinned: newPinned };
      renderFeatures();
      try { await updateDoc(doc(db, 'features', id), { pinned: newPinned }); }
      catch { showToast('تعذر التثبيت'); }
    });
  });

  list.querySelectorAll('[data-act="freply"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const f = featuresCache.find(x => x.id === id);
      const text = await featureReplyModal(f?.reply?.text || '');
      if (text === null) return;
      const reply = text ? { author: ADMIN_NAME, text } : null;
      const i = featuresCache.findIndex(x => x.id === id);
      if (i !== -1) featuresCache[i] = { ...featuresCache[i], reply };
      renderFeatures();
      try {
        await updateDoc(doc(db, 'features', id), { reply });
        showToast(reply ? (isEN() ? 'Reply saved 🤍' : 'حُفظ الرد 🤍') : (isEN() ? 'Reply removed' : 'أُزيل الرد'));
      } catch { showToast('تعذر الحفظ'); }
    });
  });
}

function featureReplyModal(existingText) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">↩ ${isEN() ? 'Reply to this suggestion' : 'ردّي على هذا الاقتراح'}</div>
        <textarea id="feature-reply-input" maxlength="400" style="min-height:90px;" placeholder="${isEN() ? 'Explain your decision or add a note…' : 'اشرحي قرارك أو أضيفي ملاحظة…'}"></textarea>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Save' : 'حفظ'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const ta = overlay.querySelector('#feature-reply-input');
    ta.value = existingText;
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => close(ta.value.trim()));
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) close(ta.value.trim());
      if (e.key === 'Escape') close(null);
    });
    document.body.appendChild(overlay);
    ta.focus();
  });
}

document.getElementById('feature-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('feature-input');
  const text = input.value.trim();
  if (!text || !me || !nickname) return;
  try {
    await addDoc(collection(db, 'features'), {
      uid: me.uid, author: isAdmin ? ADMIN_NAME : nickname,
      text, time: Date.now(), status: 'new', reply: null,
    });
    input.value = '';
    showToast(isEN() ? 'Suggestion sent 🤍' : 'أُرسل اقتراحك 🤍');
  } catch {
    showToast(isEN() ? 'Could not send' : 'تعذر الإرسال');
  }
});

document.getElementById('add-custom-btn').addEventListener('click', async () => {
  const result = await customHabitModal();
  if (result) await addCustomHabit(result.ar, result.world);
});

document.getElementById('reflect-edit-btn').addEventListener('click', editReflectQuestion);

document.getElementById('reflect-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!me || !nickname) return;
  const text = document.getElementById('reflect-input').value.trim();
  myReflectAnswer = text;
  try {
    await setDoc(doc(db, 'reflections', reflectWeekKey()),
      { uid: me.uid, nick: nickname, week: thisWeekKey(), text, time: Date.now() });
    document.getElementById('reflect-input').value = '';
    showToast(isEN() ? 'Saved 🤍' : 'تم الحفظ 🤍');
  } catch {
    showToast(isEN() ? 'Could not save' : 'تعذر الحفظ');
  }
});

/* ── مهمة الأسبوع — يحررها المشرفة، يراها الجميع ─────────── */
/* ── تبويب التقدم: سؤال أسبوعي — إجابة كل لاعبة خاصة بها ─── */
function reflectWeekKey() { return `${thisWeekKey()}_${me.uid}`; }

async function loadMyReflectAnswer() {
  if (!me) return;
  try {
    const snap = await getDoc(doc(db, 'reflections', reflectWeekKey()));
    myReflectAnswer = (snap.exists() && snap.data().text) || '';
  } catch { myReflectAnswer = ''; }
  myReflectLoaded = true;
  renderReflectTab();
}

function renderReflectTab() {
  const dashBtn = document.getElementById('tab-btn-reflect');
  if (dashBtn) dashBtn.hidden = !(REFLECT_PUBLIC || isAdmin);

  const qEl = document.getElementById('reflect-question');
  if (qEl) qEl.textContent = isEN() ? reflectQuestionEn : reflectQuestion;
  const editBtn = document.getElementById('reflect-edit-btn');
  if (editBtn) editBtn.hidden = !isAdmin;
  const input = document.getElementById('reflect-input');
  if (input && myReflectLoaded && document.activeElement !== input) input.value = myReflectAnswer;
}

function renderReflectAnswers() {
  const list = document.getElementById('reflect-answers-list');
  if (!list) return;

  const weeks = [...new Set(reflectAnswersCache.map(r => r.week))].sort((a, b) => b.localeCompare(a));

  list.innerHTML = weeks.map(wk => {
    const n = weekNumberOf(wk);
    const weekLabel = isEN() ? `Week ${n}` : `الأسبوع ${AR_NUMS[n] || n}`;
    const rows = reflectAnswersCache
      .filter(r => r.week === wk)
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .map(r => {
        const canDelete = isAdmin || (me && r.uid === me.uid);
        return `
          <div class="post-item">
            <div class="post-head">
              <span class="post-author">${esc(r.nick)}</span>
              ${canDelete ? `<button class="post-delete" data-act="delref" data-id="${r.id}">${isEN() ? 'delete' : 'حذف'}</button>` : ''}
            </div>
            <div class="post-body">${esc(r.text)}</div>
          </div>`;
      }).join('');
    return `<div class="progress-group-title">📝 ${weekLabel}</div>${rows}`;
  }).join('') || `<div class="mission-empty">${isEN() ? 'No answers yet — be the first 🤍' : 'ما في إجابات بعد — كوني أول من يشارك 🤍'}</div>`;

  list.querySelectorAll('[data-act="delref"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      reflectAnswersCache = reflectAnswersCache.filter(r => r.id !== id);
      renderReflectAnswers();
      try { await deleteDoc(doc(db, 'reflections', id)); }
      catch { showToast('تعذر الحذف'); }
    });
  });
}

function reflectQuestionModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">📝 ${isEN() ? 'This week’s question' : 'سؤال هذا الأسبوع'}</div>
        <label class="modal-field-label">العربية</label>
        <textarea id="reflect-q-input" maxlength="200" style="min-height:60px;" placeholder="اكتبي السؤال هنا…"></textarea>
        <label class="modal-field-label">English</label>
        <textarea id="reflect-q-input-en" maxlength="200" style="min-height:60px;" placeholder="Write the question in English…"></textarea>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Save' : 'حفظ'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const ta = overlay.querySelector('#reflect-q-input');
    const taEn = overlay.querySelector('#reflect-q-input-en');
    ta.value = reflectQuestion;
    taEn.value = reflectQuestionEn;
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () =>
      close({ text: ta.value.trim(), textEn: taEn.value.trim() }));
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    document.body.appendChild(overlay);
    ta.focus();
  });
}

async function editReflectQuestion() {
  const result = await reflectQuestionModal();
  if (!result || !result.text) return;
  try {
    await setDoc(doc(db, 'meta', 'reflectQuestion'),
      { text: result.text, textEn: result.textEn || '', updated: Date.now() });
    showToast(isEN() ? 'Question updated 🤍' : 'تحدّث السؤال 🤍');
  } catch {
    showToast(isEN() ? 'Could not save' : 'تعذر الحفظ');
  }
}

/* ── إعلان أعلى مهمة الأسبوع — تكتبه المشرفة، يظهر للجميع ── */
function announcementId() { return announcement?.updated ? String(announcement.updated) : null; }

function subscribeAnnouncementReactions() {
  if (announcementReactionsUnsub) { announcementReactionsUnsub(); announcementReactionsUnsub = null; }
  announcementReactionDocs = [];
  const annId = announcementId();
  if (!annId) { renderAnnouncement(); return; }
  announcementReactionsUnsub = onSnapshot(
    query(collection(db, 'announcementReactions'), where('annId', '==', annId)),
    snap => {
      announcementReactionDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAnnouncement();
    },
    () => {}
  );
}

async function toggleAnnouncementReaction(field, value) {
  const annId = announcementId();
  if (!me || !annId) return;
  const docId = `${annId}_${me.uid}`;
  const mine = announcementReactionDocs.find(d => d.id === docId) || {};
  const next = field === 'heart' ? !mine.heart : (mine.vote === value ? null : value);
  const patch = field === 'heart' ? { heart: next } : { vote: next };
  try {
    await setDoc(doc(db, 'announcementReactions', docId),
      { uid: me.uid, annId, ...patch, updated: Date.now() }, { merge: true });
  } catch {
    showToast(isEN() ? 'Could not save' : 'تعذر الحفظ');
  }
}

function renderAnnouncement() {
  const box = document.getElementById('announcement-box');
  if (!box) return;
  const hasContent = !!(announcement && announcement.text);
  box.hidden = !hasContent && !isAdmin;
  if (box.hidden) return;

  const editBtn = isAdmin
    ? `<button class="mission-edit-btn" id="announcement-edit-btn">${hasContent ? '✏️' : (isEN() ? '+ Add' : '+ إضافة')}</button>`
    : '';

  let reactionsHtml = '';
  if (hasContent) {
    const docId = me ? `${announcementId()}_${me.uid}` : null;
    const mine = docId ? announcementReactionDocs.find(d => d.id === docId) : null;
    const heartCount = announcementReactionDocs.filter(d => d.heart).length;
    const upCount = announcementReactionDocs.filter(d => d.vote === 'up').length;
    const downCount = announcementReactionDocs.filter(d => d.vote === 'down').length;
    reactionsHtml = `
      <div class="announcement-reactions">
        <button class="reaction-btn${mine?.heart ? ' active' : ''}" data-reaction="heart">❤️ <span>${heartCount}</span></button>
        <button class="reaction-btn${mine?.vote === 'up' ? ' active' : ''}" data-reaction="up">👍 <span>${upCount}</span></button>
        <button class="reaction-btn${mine?.vote === 'down' ? ' active' : ''}" data-reaction="down">👎 <span>${downCount}</span></button>
      </div>`;
  }

  box.innerHTML = `
    <div class="mission-head">
      <span class="announcement-tag">${isEN() ? '📣 Announcement' : '📣 إعلان'}</span>
      ${editBtn}
    </div>
    ${hasContent
      ? `<div class="announcement-text">${esc(announcement.text)}</div>${reactionsHtml}`
      : (isAdmin ? `<div class="mission-empty">${isEN() ? 'Nothing yet — tap + Add to write one.' : 'ما في شي بعد — اضغطي + إضافة لكتابة إعلان.'}</div>` : '')}`;

  document.getElementById('announcement-edit-btn')?.addEventListener('click', openAnnouncementEditor);
  box.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.reaction;
      toggleAnnouncementReaction(r === 'heart' ? 'heart' : 'vote', r === 'heart' ? true : r);
    });
  });
}

function announcementModal(initial) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">📣 ${isEN() ? 'Announcement' : 'إعلان'}</div>
        <textarea maxlength="500" style="min-height:90px;" placeholder="${isEN() ? 'Write your announcement…' : 'اكتبي الإعلان هنا…'}"></textarea>
        <div style="font-size:.68rem; color:rgba(74,57,45,.5); margin-top:8px;">${isEN() ? 'Tip: clear the text and save to remove the announcement.' : 'ملاحظة: امسحي النص واحفظي لإزالة الإعلان نهائيًا.'}</div>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Publish' : 'نشر'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const ta = overlay.querySelector('textarea');
    ta.value = initial?.text || '';
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => close(ta.value.trim()));
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.body.appendChild(overlay);
    ta.focus();
  });
}

async function openAnnouncementEditor() {
  if (!isAdmin) return;
  const text = await announcementModal(announcement);
  if (text === null) return;
  try {
    await setDoc(doc(db, 'meta', 'announcement'), { text, updated: Date.now() });
    showToast(text ? (isEN() ? 'Published 🤍' : 'نُشر الإعلان 🤍') : (isEN() ? 'Removed' : 'أُزيل الإعلان'));
  } catch {
    showToast(isEN() ? 'Could not save' : 'تعذر الحفظ');
  }
}

function renderMission() {
  const box = document.getElementById('mission-box');
  if (!box) return;

  const hasContent = mission && (mission.text || mission.link || mission.image);
  box.hidden = !hasContent && !isAdmin; /* اللاعبات لا يرين صندوقًا فارغًا */
  if (box.hidden) return;
  const editBtn = isAdmin
    ? `<button class="mission-edit-btn" id="mission-edit-btn">${hasContent ? '✏️' : (isEN() ? '+ Add' : '+ إضافة')}</button>`
    : '';

  if (!hasContent) {
    box.innerHTML = `
      <div class="mission-box">
        <div class="mission-head">
          <span class="mission-tag">${isEN() ? '🎯 Mission of the Week' : '🎯 مهمة الأسبوع'}</span>
          ${editBtn}
        </div>
        ${isAdmin
          ? `<div class="mission-empty">${isEN() ? 'Nothing yet — tap + Add to write this week’s focus.' : 'ما في شي بعد — اضغطي + إضافة لكتابة تركيز هذا الأسبوع.'}</div>`
          : ''}
      </div>`;
  } else {
    const yid = youtubeId(mission.link);
    let mediaHtml = '';
    if (yid) {
      mediaHtml = `<div class="mission-media"><iframe src="https://www.youtube.com/embed/${yid}" allowfullscreen title="mission media"></iframe></div>`;
    } else if (mission.image) {
      mediaHtml = `<div class="mission-media"><img src="${esc(mission.image)}" alt="" loading="lazy"></div>`;
    }
    const linkHtml = (mission.link && !yid)
      ? `<a class="mission-link" href="${esc(mission.link)}" target="_blank" rel="noopener">🔗 ${isEN() ? 'Open link' : 'افتحي الرابط'}</a>`
      : '';

    let stepsHtml = '';
    const steps = mission.steps || [];
    if (steps.length > 0 && !isAdmin) {
      const pct = Math.round((myMissionDone.filter(Boolean).length / steps.length) * 100);
      stepsHtml = `
        <div class="mission-steps">
          <div class="mission-pct">${pct}% ${isEN() ? 'complete' : 'مكتمل'}</div>
          <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
          ${steps.map((s, i) => `
            <div class="mission-step-row${myMissionDone[i] ? ' done' : ''}" data-step="${i}">
              <div class="mission-step-box">✓</div>
              <div class="mission-step-text">${esc(s)}</div>
            </div>`).join('')}
        </div>`;
    } else if (steps.length > 0 && isAdmin) {
      stepsHtml = `
        <div class="mission-steps">
          ${steps.map(s => `<div class="mission-step-row"><div class="mission-step-box" style="visibility:hidden">✓</div><div class="mission-step-text">${esc(s)}</div></div>`).join('')}
        </div>`;
    }

    box.innerHTML = `
      <div class="mission-box">
        <div class="mission-head">
          <span class="mission-tag">${isEN() ? '🎯 Mission of the Week' : '🎯 مهمة الأسبوع'}</span>
          ${editBtn}
        </div>
        ${mission.text ? `<div class="mission-text">${esc(mission.text)}</div>` : ''}
        ${mediaHtml}
        ${linkHtml}
        ${stepsHtml}
      </div>`;

    box.querySelectorAll('.mission-step-row').forEach(row => {
      if (row.dataset.step === undefined) return;
      row.addEventListener('click', () => toggleMissionStep(Number(row.dataset.step)));
    });
  }

  const btn = document.getElementById('mission-edit-btn');
  if (btn) btn.addEventListener('click', openMissionEditor);
}

function missionModal(initial) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">🎯 ${isEN() ? 'Mission of the Week' : 'مهمة الأسبوع'}</div>
        <label class="modal-field-label">${isEN() ? 'Text' : 'النص'}</label>
        <textarea maxlength="500" placeholder="${isEN() ? 'This week’s focus…' : 'تركيز هذا الأسبوع…'}"></textarea>
        <label class="modal-field-label">${isEN() ? 'Link (YouTube auto-embeds)' : 'رابط (يوتيوب يظهر كفيديو تلقائيًا)'}</label>
        <input type="url" id="mission-link-input" placeholder="https://youtube.com/…" />
        <label class="modal-field-label">${isEN() ? 'Image URL (optional)' : 'رابط صورة (اختياري)'}</label>
        <input type="url" id="mission-image-input" placeholder="https://…" />
        <label class="modal-field-label">${isEN() ? 'Checklist steps — one per line, up to 5 (optional)' : 'خطوات قابلة للتأشير — سطر لكل خطوة، حتى ٥ (اختياري)'}</label>
        <textarea id="mission-steps-input" maxlength="300" placeholder="${isEN() ? 'e.g.\nRead page 1-10\nWatch the video\n…' : 'مثال:\nاقرئي الصفحة ١-١٠\nشاهدي الفيديو\n…'}"></textarea>
        <div style="font-size:.68rem; color:rgba(74,57,45,.5); margin-top:8px;">${isEN() ? 'Tip: clear everything and save to remove the mission box.' : 'ملاحظة: امسحي كل الحقول واحفظي لإزالة الصندوق نهائيًا.'}</div>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Publish' : 'نشر'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const ta = overlay.querySelector('textarea:not(#mission-steps-input)');
    const linkI  = overlay.querySelector('#mission-link-input');
    const imgI   = overlay.querySelector('#mission-image-input');
    const stepsI = overlay.querySelector('#mission-steps-input');
    ta.value = initial?.text || '';
    linkI.value = initial?.link || '';
    imgI.value = initial?.image || '';
    stepsI.value = (initial?.steps || []).join('\n');
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => close({
      text: ta.value.trim(), link: linkI.value.trim(), image: imgI.value.trim(),
      steps: stepsI.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5),
    }));
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.body.appendChild(overlay);
    ta.focus();
  });
}

/* أرشفة المهمة الحالية قبل استبدالها — سجل خاص بالمشرفة فقط */
async function archiveCurrentMission() {
  if (!mission) return;
  const hadContent = mission.text || mission.link || mission.image || (mission.steps || []).length > 0;
  if (!hadContent) return;
  try {
    await addDoc(collection(db, 'missionHistory'), {
      text: mission.text || '', link: mission.link || '', image: mission.image || '',
      steps: mission.steps || [],
      fromDate: mission.updated || null,
      toDate: Date.now(),
    });
  } catch { /* لا نمنع النشر الجديد إن فشلت الأرشفة */ }
}

async function openMissionEditor() {
  if (!isAdmin) return;
  const result = await missionModal(mission);
  if (!result) return;
  try {
    await archiveCurrentMission();
    if (!result.text && !result.link && !result.image && result.steps.length === 0) {
      await setDoc(doc(db, 'meta', 'mission'), { text: '', link: '', image: '', steps: [], updated: Date.now() });
      showToast('أُزيلت مهمة الأسبوع');
    } else {
      await setDoc(doc(db, 'meta', 'mission'), { ...result, updated: Date.now(), by: ADMIN_NAME });
      showToast('نُشرت مهمة الأسبوع 🤍');
    }
  } catch {
    showToast('تعذر الحفظ — تحققي من قواعد الحماية');
  }
}

/* ── تقدّم اللاعبة الشخصي في خطوات مهمة الأسبوع ──────────── */
function missionProgressKey() { return `${thisWeekKey()}_${me.uid}`; }
function missionProgressLsKey() { return `pom_mission_${missionProgressKey()}`; }
let myMissionDone = [];

function loadMissionProgressLocal() {
  try { myMissionDone = JSON.parse(localStorage.getItem(missionProgressLsKey())) || []; }
  catch { myMissionDone = []; }
}
async function toggleMissionStep(i) {
  if (!me || isAdmin) return;
  myMissionDone[i] = !myMissionDone[i];
  localStorage.setItem(missionProgressLsKey(), JSON.stringify(myMissionDone));
  renderMission();
  try {
    await setDoc(doc(db, 'missionProgress', missionProgressKey()),
      { uid: me.uid, week: thisWeekKey(), done: myMissionDone, updated: Date.now() }, { merge: true });
  } catch { /* غير حرج — النسخة المحلية كافية للعرض */ }
}

/* ── عدّادات المجتمع (ملخصات صغيرة بدل سجلات الجميع) ─────── */
async function fetchStats(force) {
  if (!force && Date.now() - statsFetchedAt < 60000) return;
  statsFetchedAt = Date.now();
  const weeks = [thisWeekKey(), prevWeekKey()];
  await Promise.all(weeks.map(async wk => {
    try {
      const snap = await getDocs(collection(db, `stats/${wk}/shards`));
      const agg = { dayCounts: {}, habitCounts: {}, cellCounts: {} };
      snap.forEach(s => {
        const d = s.data();
        Object.entries(d.dayCounts || {}).forEach(([k, v]) => { agg.dayCounts[k] = (agg.dayCounts[k] || 0) + v; });
        Object.entries(d.habitCounts || {}).forEach(([k, v]) => { agg.habitCounts[k] = (agg.habitCounts[k] || 0) + v; });
        Object.entries(d.cellCounts || {}).forEach(([k, v]) => { agg.cellCounts[k] = (agg.cellCounts[k] || 0) + v; });
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
    /* getDocs بدل getCountFromServer — بعض المتصفحات/إضافات الخصوصية تحجب استعلامات العدّ */
    const snap = await getDocs(collection(db, `weeks/${thisWeekKey()}/players`));
    participantsCount = snap.size;
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
    renderMission();
    renderAnnouncement();
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
  await refreshDayBoundary();
  loadMyDaysLocal();
  await loadMyCustomHabits();
  await loadMyReflectAnswer();
  await loadMyProcrastination();
  initGate();
});

document.getElementById('change-nick').addEventListener('click', () => {
  nickname = null;
  localStorage.removeItem('pom_nick');
  initGate();
});

/* ── Today's quests ──────────────────────────────────────── */
/* ── عاداتي الخاصة — شخصية بالكامل، لا تدخل اللوحة أو إحصاءات المجتمع ── */
async function loadMyCustomHabits() {
  try {
    const snap = await getDoc(doc(db, 'customHabits', me.uid));
    myCustomHabits = (snap.exists() && snap.data().items) || [];
  } catch { myCustomHabits = []; }
}
async function saveMyCustomHabitsRemote() {
  try { await setDoc(doc(db, 'customHabits', me.uid), { items: myCustomHabits, updated: Date.now() }); }
  catch { showToast(isEN() ? 'Could not save' : 'تعذر الحفظ'); }
}
async function addCustomHabit(ar, world) {
  const id = `c${Date.now()}`;
  myCustomHabits.push({ id, ar, world });
  renderCustomHabits();
  renderMyProgress();
  await saveMyCustomHabitsRemote();
}
async function deleteCustomHabit(id) {
  myCustomHabits = myCustomHabits.filter(c => c.id !== id);
  renderCustomHabits();
  renderMyProgress();
  await saveMyCustomHabitsRemote();
}
async function toggleCustomHabit(id) {
  if (!me || !nickname) return;
  const date = (YESTERDAY_GRACE_PUBLIC || isAdmin) ? activeDayKey() : myDayKey();
  const day = (myDays[date] = myDays[date] || { habits: {}, points: 0, custom: {} });
  day.custom = day.custom || {};
  day.custom[id] = !day.custom[id];
  saveMyDaysLocal();
  renderCustomHabits();
  renderMyProgress();
  try {
    await setDoc(doc(db, 'days', `${me.uid}_${date}`),
      { uid: me.uid, date, custom: day.custom }, { merge: true });
  } catch {
    showToast(isEN() ? 'Could not save' : 'تعذر الحفظ');
  }
}

/* ── المماطلة — قائمة شخصية بالكامل، لا يراها أحد غيرك ────── */
const PROCRASTINATION_STATUS = {
  planning:  { ar: 'بخطّط لها',  en: 'Planning',  cls: 'status-new' },
  preparing: { ar: 'بجهّز لها',  en: 'Preparing', cls: 'status-progress' },
  executing: { ar: 'بنفّذها',    en: 'Executing', cls: 'status-planned' },
  done:      { ar: 'خلصتها',     en: 'Done',      cls: 'status-done' },
};
let procrastinationItems = [];
let procrastinationStatusFilter = '';

async function loadMyProcrastination() {
  try {
    const snap = await getDoc(doc(db, 'procrastinations', me.uid));
    procrastinationItems = (snap.exists() && snap.data().items) || [];
  } catch { procrastinationItems = []; }
  renderProcrastination();
}
async function saveProcrastinationRemote() {
  try { await setDoc(doc(db, 'procrastinations', me.uid), { items: procrastinationItems, updated: Date.now() }); }
  catch { showToast(isEN() ? 'Could not save' : 'تعذر الحفظ'); }
}
async function addProcrastinationItem(text) {
  procrastinationItems.push({ id: `p${Date.now()}`, text, status: 'planning', awarded: false });
  renderProcrastination();
  await saveProcrastinationRemote();
}
async function deleteProcrastinationItem(id) {
  procrastinationItems = procrastinationItems.filter(p => p.id !== id);
  renderProcrastination();
  await saveProcrastinationRemote();
}
async function setProcrastinationStatus(id, status) {
  const item = procrastinationItems.find(p => p.id === id);
  if (!item) return;
  item.status = status;
  if (status === 'done' && !item.awarded) item.awarded = true;
  renderProcrastination();
  await saveProcrastinationRemote();
}

function renderProcrastination() {
  const list = document.getElementById('procrastination-list');
  const ptsEl = document.getElementById('procrastination-points');
  if (!list) return;

  if (ptsEl) {
    const pts = procrastinationItems.filter(p => p.awarded).length;
    ptsEl.textContent = isEN() ? `Your personal points from finishing these: ${pts} 🤍` : `نقاطك الشخصية من إنجازها: ${pts} 🤍`;
  }

  const filterEl = document.getElementById('procrastination-status-filter');
  if (filterEl && filterEl.value !== procrastinationStatusFilter) filterEl.value = procrastinationStatusFilter;

  const shown = procrastinationStatusFilter
    ? procrastinationItems.filter(p => p.status === procrastinationStatusFilter)
    : procrastinationItems;

  if (procrastinationItems.length === 0) {
    list.innerHTML = `<div class="mission-empty">${isEN() ? 'Nothing on your list yet 🤍' : 'ما في شي بقائمتك بعد 🤍'}</div>`;
    return;
  }
  if (shown.length === 0) {
    list.innerHTML = `<div class="mission-empty">${isEN() ? 'Nothing with this status' : 'ما في شي بهالحالة'}</div>`;
    return;
  }

  list.innerHTML = shown.map(p => {
    const st = PROCRASTINATION_STATUS[p.status] || PROCRASTINATION_STATUS.planning;
    return `
      <div class="post-item">
        <div class="post-head">
          <span class="status-badge ${st.cls}">${isEN() ? st.en : st.ar}</span>
          <button class="post-delete" data-act="pdel" data-id="${p.id}">${isEN() ? 'delete' : 'حذف'}</button>
        </div>
        <div class="post-body">${esc(p.text)}</div>
        <select class="status-select ${st.cls}" data-id="${p.id}" style="margin-top:8px; display:block; font-weight:800;">
          ${Object.entries(PROCRASTINATION_STATUS).map(([k, v]) =>
            `<option value="${k}" ${p.status === k ? 'selected' : ''}>${isEN() ? v.en : v.ar}</option>`).join('')}
        </select>
      </div>`;
  }).join('');

  list.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', () => setProcrastinationStatus(sel.dataset.id, sel.value));
  });
  list.querySelectorAll('[data-act="pdel"]').forEach(btn => {
    btn.addEventListener('click', () => deleteProcrastinationItem(btn.dataset.id));
  });
}

document.getElementById('procrastination-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('procrastination-input');
  const text = input.value.trim();
  if (!text || !me || !nickname) return;
  addProcrastinationItem(text);
  input.value = '';
});

document.getElementById('procrastination-status-filter')?.addEventListener('change', e => {
  procrastinationStatusFilter = e.target.value;
  renderProcrastination();
});

document.getElementById('features-status-filter')?.addEventListener('change', e => {
  featuresStatusFilter = e.target.value;
  renderFeatures();
});

function customHabitModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">🧩 ${isEN() ? 'Add your own habit' : 'أضيفي عادة خاصة بك'}</div>
        <label class="modal-field-label">${isEN() ? 'Name' : 'الاسم'}</label>
        <input type="text" id="custom-name-input" maxlength="40" placeholder="${isEN() ? 'e.g. Journaling' : 'مثال: كتابة يومياتي'}" />
        <label class="modal-field-label">${isEN() ? 'Element' : 'العنصر'}</label>
        <select id="custom-world-input" class="status-select" style="width:100%; margin-top:8px; margin-inline-start:0;">
          ${Object.entries(WORLDS).map(([k, w]) => `<option value="${k}">${isEN() ? w.en : w.ar}</option>`).join('')}
        </select>
        <div style="font-size:.68rem; color:rgba(74,57,45,.5); margin-top:8px;">${isEN()
          ? 'Personal only — won’t appear on the shared leaderboard.'
          : 'شخصية بالكامل — لا تظهر في لوحة المتصدرات المشتركة.'}</div>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Add' : 'إضافة'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => {
      const ar = overlay.querySelector('#custom-name-input').value.trim();
      const world = overlay.querySelector('#custom-world-input').value;
      close(ar ? { ar, world } : null);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.body.appendChild(overlay);
  });
}

function renderCustomHabits() {
  const section = document.getElementById('custom-habits-section');
  if (!section) return;
  const show = CUSTOM_HABITS_PUBLIC || isAdmin;
  section.hidden = !show;
  if (!show) return;

  const list = document.getElementById('custom-habits-list');
  const todayCustom = (myDays[(YESTERDAY_GRACE_PUBLIC || isAdmin) ? activeDayKey() : myDayKey()] || {}).custom || {};
  list.innerHTML = myCustomHabits.map(c => {
    const focused = isFocused(c.id);
    return `
    <div class="habit-check${todayCustom[c.id] ? ' done' : ''}" data-cid="${c.id}" style="border-inline-start-color:${WORLDS[c.world]?.color || '#755F4D'}">
      <div class="habit-box">✓</div>
      <div class="habit-check-info">
        <div class="habit-check-ar">${esc(c.ar)}</div>
        <div class="habit-check-en">${isEN() ? WORLDS[c.world]?.en : WORLDS[c.world]?.ar}</div>
      </div>
      ${(PROGRESS_VIEW_PUBLIC || isAdmin) ? `<button class="habit-focus-btn${focused ? ' on' : ''}" data-act="focuscustom" data-cid="${c.id}" title="${focused ? (isEN() ? 'Shown in your analysis' : 'ضمن تحليلك') : (isEN() ? 'Hidden from your analysis' : 'مخفية من تحليلك')}">${focused ? '★' : '☆'}</button>` : ''}
      <button class="post-delete" data-act="delcustom" data-cid="${c.id}" style="margin-inline-start:6px;">${isEN() ? 'remove' : 'حذف'}</button>
      <div class="habit-emoji">🧩</div>
    </div>`;
  }).join('');

  list.querySelectorAll('.habit-check').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-act="delcustom"]') || e.target.closest('[data-act="focuscustom"]')) return;
      toggleCustomHabit(el.dataset.cid);
    });
  });
  list.querySelectorAll('[data-act="delcustom"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteCustomHabit(btn.dataset.cid);
    });
  });
  list.querySelectorAll('[data-act="focuscustom"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFocus(btn.dataset.cid);
    });
  });
}

async function toggleHabit(h) {
  if (!me || !nickname) return;
  if (preLaunch() && !isAdmin) {
    showToast(isEN() ? 'We start together on Tuesday, July 21 🤍' : `نبدأ معًا يوم ${START_LABEL_AR} 🤍`);
    return;
  }

  const date = (YESTERDAY_GRACE_PUBLIC || isAdmin) ? activeDayKey() : myDayKey();
  const week = (YESTERDAY_GRACE_PUBLIC || isAdmin) ? activeWeekKey() : thisWeekKey();
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
        { nick: nickname, points: myWeekPoints(week), updated: Date.now() },
        { merge: true }).catch(() => {});
      /* ٣) عدّادات المجتمع (موزعة على شظايا لتجنب التزاحم) */
      const shard = Math.floor(Math.random() * STATS_SHARDS);
      const cellKey = `${date}_${h.id}`;
      setDoc(doc(db, `stats/${week}/shards`, String(shard)),
        { dayCounts: { [date]: increment(delta) }, habitCounts: { [h.id]: increment(delta) },
          cellCounts: { [cellKey]: increment(delta) } },
        { merge: true }).catch(() => {});
      /* حدّثي النسخة المحلية للعدادات فورًا */
      const agg = (statsWeeks[week] = statsWeeks[week] || {});
      agg.dayCounts   = agg.dayCounts   || {};
      agg.habitCounts = agg.habitCounts || {};
      agg.cellCounts  = agg.cellCounts  || {};
      agg.dayCounts[date]   = (agg.dayCounts[date]   || 0) + delta;
      agg.habitCounts[h.id] = (agg.habitCounts[h.id] || 0) + delta;
      agg.cellCounts[cellKey] = (agg.cellCounts[cellKey] || 0) + delta;
    }
  } catch (err) {
    console.error('toggleHabit save failed:', err);
    const detail = err.code || err.name || 'unknown';
    const msg = (err.message || '').slice(0, 80);
    showToast(`تعذر الحفظ على الخادم (${detail}${msg ? ': ' + msg : ''}) — لكن تحديدك محفوظ على جهازك`);
  }
}

/* ── مهمة مؤقتة (سورة الكهف): من مغرب الخميس إلى مغرب الجمعة ─────
   نحسب المغرب الحقيقي حسب موقع الزائرة (خط العرض/الطول) عبر Aladhan API.
   إن تعذّر تحديد الموقع، نستخدم نافذة تقويمية تقريبية (يوم الجمعة كاملاً). */
let geoCoords = null, geoDenied = false;
const maghribCache = {};

function getGeo() {
  if (geoCoords) return Promise.resolve(geoCoords);
  if (geoDenied) return Promise.resolve(null); /* رفض صريح فقط يوقف المحاولات — التأخير أو الانتهاء لا يوقفها */
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { geoCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }; resolve(geoCoords); },
      err => {
        if (err && err.code === 1) geoDenied = true; /* PERMISSION_DENIED فقط */
        resolve(null);
      },
      { timeout: 15000, maximumAge: 600000 }
    );
  });
}

function apiDate(d) { return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; }

async function fetchMaghrib(dateObj, coords) {
  const key = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}_${apiDate(dateObj)}`;
  if (maghribCache[key]) return maghribCache[key];
  try {
    const res = await fetch(`https://api.aladhan.com/v1/timings/${apiDate(dateObj)}?latitude=${coords.lat}&longitude=${coords.lon}`);
    const json = await res.json();
    const [hh, mm] = json.data.timings.Maghrib.split(':').map(Number);
    const m = new Date(dateObj);
    m.setHours(hh, mm, 0, 0);
    maghribCache[key] = m;
    return m;
  } catch { return null; }
}

/* نفس فكرة المغرب، لكن لوقت الفجر — لتحديد بداية «يوم اللعبة» */
const fajrCache = {};
const hijriDayCache = {};
async function fetchFajr(dateObj, coords) {
  const key = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}_${apiDate(dateObj)}`;
  if (fajrCache[key]) return fajrCache[key];
  try {
    const res = await fetch(`https://api.aladhan.com/v1/timings/${apiDate(dateObj)}?latitude=${coords.lat}&longitude=${coords.lon}`);
    const json = await res.json();
    const [hh, mm] = json.data.timings.Fajr.split(':').map(Number);
    const f = new Date(dateObj);
    f.setHours(hh, mm, 0, 0);
    fajrCache[key] = f;
    /* نفس الاستدعاء يرجّع التاريخ الهجري — نخزّنه لاستخدام الأيام البيض بدون طلب إضافي */
    const hd = parseInt(json?.data?.date?.hijri?.day, 10);
    if (!Number.isNaN(hd)) hijriDayCache[key] = hd;
    return f;
  } catch { return null; }
}

async function getHijriDay(dateObj, coords) {
  const key = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}_${apiDate(dateObj)}`;
  if (hijriDayCache[key] !== undefined) return hijriDayCache[key];
  await fetchFajr(dateObj, coords); /* يملأ الكاش كأثر جانبي */
  return hijriDayCache[key];
}

/* موعد الفجر القادم — لعرض العدّ التنازلي فقط */
let nextFajrForCountdown = null;
let fajrBoundaryLoaded = false;

async function refreshDayBoundary() {
  const wasShift = dayShiftDays;
  const coords = await getGeo();

  if (coords) {
    const now = new Date();
    const todayFajr = await fetchFajr(now, coords);
    if (todayFajr) {
      if (now < todayFajr) {
        dayShiftDays = -1;
        nextFajrForCountdown = todayFajr;
      } else {
        dayShiftDays = 0;
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
        nextFajrForCountdown = await fetchFajr(tomorrow, coords);
      }
    }
  } else {
    dayShiftDays = 0;
    nextFajrForCountdown = null; /* بدون موقع: نعرض احتياطًا تقريبيًا (منتصف الليل) */
  }

  const firstRun = !fajrBoundaryLoaded;
  fajrBoundaryLoaded = true;
  renderDayCountdown();

  /* إن تغيّر «يوم اللعبة» فعليًا بعد أول تحميل، أعيدي رسم كل ما يعتمد عليه */
  if (!firstRun && wasShift !== dayShiftDays && nickname) {
    loadMyDaysLocal();
    renderHabits();
    renderLeaderboard();
    renderCharts();
    updateMyPointsChip();
  }
}
setInterval(refreshDayBoundary, 60000);

function renderDayCountdown() {
  const el = document.getElementById('day-countdown');
  if (!el) return;
  if (!nickname || isAdmin) { el.hidden = true; return; }

  let msLeft, approx = false;
  if (nextFajrForCountdown) {
    msLeft = nextFajrForCountdown - new Date();
  } else {
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    msLeft = midnight - new Date();
    approx = true;
  }
  if (msLeft < 0) msLeft = 0;
  const hLeft = Math.floor(msLeft / 3600000);
  const mLeft = Math.floor((msLeft % 3600000) / 60000);

  el.hidden = false;
  el.textContent = approx
    ? (isEN() ? `⏳ ~${hLeft}h ${mLeft}m until a new day (location unavailable)` : `⏳ تقريبًا ${hLeft} س ${mLeft} د حتى يوم جديد (بدون تحديد موقعك)`)
    : (isEN() ? `⏳ ${hLeft}h ${mLeft}m until Fajr — new day begins` : `⏳ باقي ${hLeft} س ${mLeft} د على الفجر — يبدأ يوم جديد`);
}

async function renderTimelyBox() {
  const box = document.getElementById('timely-box');
  if (!box) return;
  const kahf = HABITS.find(h => h.id === 'kahf');
  const salawat = HABITS.find(h => h.id === 'salawat');
  if (!kahf || !salawat || (preLaunch() && !isAdmin)) { box.hidden = true; return; }

  const now = new Date();
  const dow = now.getDay(); /* ٠=أحد … ٤=خميس، ٥=جمعة */
  const relevantDay = dow === 4 || dow === 5;
  if (!relevantDay && !isAdmin) { box.hidden = true; return; }

  let windowStart = null, windowEnd = null, approx = false;
  const coords = relevantDay ? await getGeo() : null;

  if (coords && relevantDay) {
    if (dow === 4) {
      const saturday = new Date(now); saturday.setDate(saturday.getDate() + 2);
      windowStart = await fetchMaghrib(now, coords);
      windowEnd   = await fetchFajr(saturday, coords);
    } else {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const saturday  = new Date(now); saturday.setDate(saturday.getDate() + 1);
      windowStart = await fetchMaghrib(yesterday, coords);
      windowEnd   = await fetchFajr(saturday, coords);
    }
  }
  if (!windowStart || !windowEnd) {
    approx = true;
    windowStart = new Date(now); windowStart.setHours(0, 0, 0, 0);
    windowEnd   = new Date(now); windowEnd.setHours(0, 0, 0, 0); windowEnd.setDate(windowEnd.getDate() + (dow === 4 ? 2 : 1));
    if (dow !== 5 && !isAdmin) { box.hidden = true; return; }
  }

  const inWindow = now >= windowStart && now < windowEnd;
  const show = isAdmin || inWindow;
  if (!show) {
    box.hidden = true;
    collapsedExtraIds.delete(kahf.id); collapsedExtraIds.delete(salawat.id);
    syncCollapsedSection();
    return;
  }

  const kahfFocused = isFocused(kahf.id);
  const salawatFocused = isFocused(salawat.id);
  if (kahfFocused) collapsedExtraIds.delete(kahf.id); else collapsedExtraIds.add(kahf.id);
  if (salawatFocused) collapsedExtraIds.delete(salawat.id); else collapsedExtraIds.add(salawat.id);
  syncCollapsedSection();

  if (!kahfFocused && !salawatFocused) { box.hidden = true; return; }
  box.hidden = false;

  const msLeft = Math.max(0, windowEnd - now);
  const hLeft = Math.floor(msLeft / 3600000);
  const mLeft = Math.floor((msLeft % 3600000) / 60000);
  let countdownTxt;
  if (!inWindow) {
    countdownTxt = isEN() ? 'Preview (admin) — outside the window' : 'معاينة (مشرفة) — خارج النافذة';
  } else if (approx) {
    countdownTxt = isEN()
      ? `⏳ ~${hLeft}h ${mLeft}m left (approx., location unavailable)`
      : `⏳ تقريبًا ${hLeft} س ${mLeft} د (بدون تحديد موقعك)`;
  } else {
    countdownTxt = isEN()
      ? `⏳ ${hLeft}h ${mLeft}m until Saturday Fajr`
      : `⏳ باقي ${hLeft} س ${mLeft} د على فجر السبت`;
  }

  const doneKahf = !!myToday()[kahf.id];
  const doneSalawat = !!myToday()[salawat.id];
  box.innerHTML = `
    <div class="timely-head">
      <span class="timely-tag">${isEN() ? '🕋 Timely Mission' : '🕋 مهمة مؤقتة'}</span>
      <span class="timely-countdown">${countdownTxt}</span>
    </div>
    ${kahfFocused ? `
      <div class="timely-quote">${isEN() ? whyOf(kahf).quote : kahf.quote}</div>
      ${whiteDaysCheckRow(kahf, doneKahf)}` : ''}
    ${salawatFocused ? `
      <div class="timely-quote"${kahfFocused ? ' style="margin-top:14px;"' : ''}>${isEN() ? whyOf(salawat).quote : salawat.quote}</div>
      ${whiteDaysCheckRow(salawat, doneSalawat)}` : ''}`;

  if (kahfFocused) {
    document.getElementById(`check-${kahf.id}`).addEventListener('click', () => toggleHabit(kahf));
    document.querySelector(`#check-${kahf.id} .habit-share-btn`).addEventListener('click', e => {
      e.stopPropagation();
      shareQuestSticker(kahf, doneKahf);
    });
    document.querySelector(`#check-${kahf.id} .habit-focus-btn`)?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFocus(kahf.id);
      renderTimelyBox();
    });
  }
  if (salawatFocused) {
    document.getElementById(`check-${salawat.id}`).addEventListener('click', () => toggleHabit(salawat));
    document.querySelector(`#check-${salawat.id} .habit-share-btn`).addEventListener('click', e => {
      e.stopPropagation();
      shareQuestSticker(salawat, doneSalawat);
    });
    document.querySelector(`#check-${salawat.id} .habit-focus-btn`)?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFocus(salawat.id);
      renderTimelyBox();
    });
  }
}
setInterval(renderTimelyBox, 60000);

/* ── الأيام البيض: ١٣–١٥ هجري، كل يوم يظهر بيومه وله نقطته ───
   نعتمد على التاريخ الهجري الذي ترجعه Aladhan لموقع الزائرة نفسه؛
   بدون تحديد الموقع لا يمكننا معرفة التاريخ الهجري بثقة، فنخفيها بدل التخمين. */
function fmtHM(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return { h, m };
}

function whiteDaysCheckRow(h, done) {
  const badge = h.legendary
    ? (isEN() ? `⭐ Legendary ×${habitPoints(h)}` : `⭐ أسطورية ×${AR_NUMS[habitPoints(h)] || habitPoints(h)}`)
    : '';
  return `
    <div class="habit-check${done ? ' done' : ''}${h.legendary ? ' legendary' : ''}" id="check-${h.id}" style="border-inline-start-color:${habitColor(h)}">
      ${badge ? `<span class="legendary-badge">${badge}</span>` : ''}
      <div class="habit-box">✓</div>
      <div class="habit-check-info">
        <div class="habit-check-ar">${isEN() ? h.en : h.ar}</div>
        <div class="habit-check-en">${isEN() ? h.ar : h.en}</div>
      </div>
      ${(PROGRESS_VIEW_PUBLIC || isAdmin) ? `<button class="habit-focus-btn on" data-focus-id="${h.id}" title="${isEN() ? 'On your board — click to move to Other quests' : 'ضمن لوحتك — اضغطي لنقلها إلى مهمات أخرى'}">★</button>` : ''}
      <button class="habit-share-btn" title="${isEN() ? 'Share as image' : 'مشاركة كصورة'}">📤</button>
      <div class="habit-emoji">${h.emoji}</div>
    </div>`;
}

async function renderWhiteDaysBox() {
  const box = document.getElementById('whitedays-box');
  if (!box) return;
  const wd = HABITS.find(h => h.id === 'whitedays');
  const sh = HABITS.find(h => h.id === 'suhoor');
  const clearExtras = () => { collapsedExtraIds.delete('whitedays'); collapsedExtraIds.delete('suhoor'); syncCollapsedSection(); };
  if (!wd || !sh || (preLaunch() && !isAdmin)) { box.hidden = true; clearExtras(); return; }

  const coords = await getGeo();
  if (!coords) { box.hidden = !isAdmin; if (!isAdmin) { clearExtras(); return; } }

  const now = new Date();
  const hijriDay = coords ? await getHijriDay(now, coords) : null;
  const isWhiteDay = [13, 14, 15].includes(hijriDay);
  const isEve = hijriDay === 12; /* اليوم السابق — تذكير فقط، بدون تفعيل */
  const show = isAdmin || isWhiteDay || isEve;
  box.hidden = !show;
  if (!show) { clearExtras(); return; }

  const dLabel = hijriDay ?? '؟';
  const tag = `<span class="timely-tag">${isEN() ? '🌕 White Days' : '🌕 الأيام البيض'}</span>`;

  if (isEve && !isWhiteDay) {
    /* تذكير اليوم ١٢: بدون تفعيل، فقط عدّاد حتى الفجر القادم */
    clearExtras();
    let countdownTxt = isEN() ? 'Preview (admin) — location unavailable' : 'معاينة (مشرفة) — بدون تحديد موقع';
    if (coords) {
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
      const nextFajr = await fetchFajr(tomorrow, coords);
      if (nextFajr) {
        const { h, m } = fmtHM(Math.max(0, nextFajr - now));
        countdownTxt = isEN() ? `⏳ ${h}h ${m}m until Fajr` : `⏳ باقي ${h} س ${m} د على الفجر`;
      }
    }
    box.innerHTML = `
      <div class="timely-head">${tag}<span class="timely-countdown">${countdownTxt}</span></div>
      <div class="timely-quote">${isEN()
        ? '☀️ The White Days start tomorrow (after the next Fajr) — get ready and plan your Suhoor!'
        : '☀️ الأيام البيض تبدأ غدًا (بعد الفجر القادم) — جهّزي نفسك وخططي لسحورك!'}</div>`;
    return;
  }

  /* الأيام الفعلية ١٣-١٥: مهمتان منفصلتان — الصيام (حتى المغرب) والسحور (حتى الفجر) */
  const titleAr = `${wd.ar} - اليوم ${dLabel}`, titleEn = `${wd.en} - Day ${dLabel}`;
  const suhoorTitleAr = `${sh.ar} - اليوم ${dLabel}`, suhoorTitleEn = `${sh.en} - Day ${dLabel}`;
  const noteTxt = isWhiteDay ? '' : (isEN()
    ? `Today is Hijri day ${dLabel} — not a White Day yet (admin preview)`
    : `اليوم ${dLabel} هجريًا — ليس من الأيام البيض بعد (معاينة مشرفة)`);

  let fastTxt = isEN() ? 'Preview (admin) — location unavailable' : 'معاينة (مشرفة) — بدون تحديد موقع';
  let suhoorTxt = fastTxt;
  if (coords) {
    const todayMaghrib = await fetchMaghrib(now, coords);
    if (todayMaghrib) {
      if (now < todayMaghrib) {
        const { h, m } = fmtHM(todayMaghrib - now);
        fastTxt = isEN() ? `⏳ ${h}h ${m}m until Maghrib` : `⏳ باقي ${h} س ${m} د على المغرب`;
      } else {
        fastTxt = isEN() ? 'Maghrib has passed for today' : 'انتهى وقت المغرب لهذا اليوم';
      }
    }
    const todayFajr = await fetchFajr(now, coords);
    if (todayFajr) {
      if (now < todayFajr) {
        const { h, m } = fmtHM(todayFajr - now);
        suhoorTxt = isEN() ? `⏳ ${h}h ${m}m until Fajr` : `⏳ باقي ${h} س ${m} د على الفجر`;
      } else {
        suhoorTxt = isEN() ? 'Fajr has passed for today' : 'انتهى وقت السحور لهذا اليوم';
      }
    }
  }

  const doneWd = !!myToday()[wd.id];
  const doneSh = !!myToday()[sh.id];
  const wdFocused = isFocused(wd.id);
  const shFocused = isFocused(sh.id);
  if (wdFocused) collapsedExtraIds.delete(wd.id); else collapsedExtraIds.add(wd.id);
  if (shFocused) collapsedExtraIds.delete(sh.id); else collapsedExtraIds.add(sh.id);
  syncCollapsedSection();

  box.innerHTML = `
    <div class="timely-head">${tag}</div>
    ${noteTxt ? `<div style="font-size:.72rem; color:rgba(74,57,45,.55); margin-bottom:8px;">${noteTxt}</div>` : ''}
    <div class="timely-quote">${isEN() ? whyOf(wd).quote : wd.quote}</div>
    ${wdFocused ? `
      <div class="timely-head" style="margin:0 0 4px;"><span class="timely-countdown">${fastTxt}</span></div>
      ${whiteDaysCheckRow({ ...wd, ar: titleAr, en: titleEn }, doneWd)}` : ''}
    ${shFocused ? `
      <div class="timely-head" style="margin:14px 0 4px;"><span class="timely-countdown">${suhoorTxt}</span></div>
      ${whiteDaysCheckRow({ ...sh, ar: suhoorTitleAr, en: suhoorTitleEn }, doneSh)}` : ''}
  `;
  if (wdFocused) {
    document.getElementById(`check-${wd.id}`).addEventListener('click', () => toggleHabit(wd));
    document.querySelector(`#check-${wd.id} .habit-share-btn`).addEventListener('click', e => {
      e.stopPropagation();
      shareQuestSticker({ ...wd, ar: titleAr, en: titleEn }, doneWd);
    });
    document.querySelector(`#check-${wd.id} .habit-focus-btn`)?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFocus(wd.id);
      renderWhiteDaysBox();
    });
  }
  if (shFocused) {
    document.getElementById(`check-${sh.id}`).addEventListener('click', () => toggleHabit(sh));
    document.querySelector(`#check-${sh.id} .habit-share-btn`).addEventListener('click', e => {
      e.stopPropagation();
      shareQuestSticker({ ...sh, ar: suhoorTitleAr, en: suhoorTitleEn }, doneSh);
    });
    document.querySelector(`#check-${sh.id} .habit-focus-btn`)?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFocus(sh.id);
      renderWhiteDaysBox();
    });
  }
}
setInterval(renderWhiteDaysBox, 60000);

/* قسم "مهمات أخرى" — مصدره اثنان: مهمات المجموعات الرئيسية (تُحسب في كل renderHabits)
   ومهمات مؤقتة (الكهف/الأيام البيض/السحور) تُسجَّل من صناديقها الخاصة عند ظهورها فعليًا */
let habitsCollapsedOpen = false;
let collapsedGroupHabits = [];
let collapsedExtraIds = new Set();

function syncCollapsedSection() {
  const wrap = document.getElementById('habits-collapsed-wrap');
  const grid = document.getElementById('habits-collapsed-grid');
  const label = document.getElementById('habits-collapsed-label');
  if (!wrap || !grid || !label) return;
  const extraHabits = [...collapsedExtraIds].map(id => HABITS.find(h => h.id === id)).filter(Boolean);
  const items = [...collapsedGroupHabits, ...extraHabits];
  wrap.hidden = items.length === 0;
  if (items.length === 0) return;
  const t = myToday();
  grid.innerHTML = '';
  items.forEach(h => grid.appendChild(buildHabitCard(h, t)));
  grid.hidden = !habitsCollapsedOpen;
  label.textContent = habitsCollapsedOpen
    ? (isEN() ? `▴ Hide (${items.length})` : `▴ إخفاء (${items.length})`)
    : (isEN() ? `▾ Other quests (${items.length})` : `▾ مهمات أخرى (${items.length})`);
}

document.getElementById('habits-collapsed-toggle')?.addEventListener('click', () => {
  habitsCollapsedOpen = !habitsCollapsedOpen;
  syncCollapsedSection();
});

document.getElementById('quests-day-prev')?.addEventListener('click', () => {
  if (questsViewOffset <= -1) return;
  questsViewOffset = -1;
  renderHabits();
});
document.getElementById('quests-day-next')?.addEventListener('click', () => {
  if (questsViewOffset >= 0) return;
  questsViewOffset = 0;
  renderHabits();
});

function renderHabits() {
  const grid = document.getElementById('habits-grid');
  if (!grid) return;
  grid.innerHTML = '';
  renderTimelyBox();
  renderWhiteDaysBox();
  renderDayCountdown();
  renderCustomHabits();

  document.getElementById('today-date').textContent =
    effectiveNow().toLocaleDateString(isEN() ? 'en' : 'ar', { weekday: 'long', day: 'numeric', month: 'long' });
  updateMyPointsChip();

  const graceOn = YESTERDAY_GRACE_PUBLIC || isAdmin;
  if (!graceOn) questsViewOffset = 0;
  const dayNav = document.getElementById('quests-day-nav');
  if (dayNav) {
    dayNav.style.display = graceOn ? 'flex' : 'none';
    if (graceOn) {
      const prevBtn = document.getElementById('quests-day-prev');
      const nextBtn = document.getElementById('quests-day-next');
      const label = document.getElementById('quests-day-label');
      const canGoBack = questsViewOffset === 0 && dateKey(daysAgo(1)) >= dateKey(START_DATE);
      if (prevBtn) prevBtn.disabled = questsViewOffset <= -1 || !canGoBack;
      if (nextBtn) nextBtn.disabled = questsViewOffset >= 0;
      if (label) {
        label.textContent = questsViewOffset === 0
          ? (isEN() ? 'Today' : 'اليوم')
          : (isEN() ? `Yesterday · ${activeViewDate().toLocaleDateString('en', { day: 'numeric', month: 'short' })}`
                    : `أمس · ${activeViewDate().toLocaleDateString('ar', { day: 'numeric', month: 'short' })}`);
      }
    }
  }

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

  const titleEl = document.getElementById('quests-card-title');
  if (titleEl) {
    titleEl.textContent = (graceOn && questsViewOffset === -1)
      ? (isEN() ? 'Which quests did you complete yesterday?' : 'أي مهمات أنجزتِ أمس؟')
      : (isEN() ? 'Which quests did you complete today?' : 'أي مهمات أنجزتِ اليوم؟');
  }

  const t = graceOn ? ((myDays[activeDayKey()] || {}).habits || {}) : myToday();
  const collapsedHabits = [];
  GROUPS.forEach(g => {
    const groupHabits = (GROUP_ITEMS[g.id] || []).map(id => HABITS.find(h => h.id === id))
      .filter(Boolean).filter(h => !h.adminOnly || MOM_FEATURES_PUBLIC || isAdmin);
    const shownHabits = groupHabits.filter(h => isFocused(h.id));
    groupHabits.filter(h => !isFocused(h.id)).forEach(h => collapsedHabits.push(h));
    if (shownHabits.length === 0) return;
    const header = document.createElement('div');
    header.className = 'quest-group';
    header.innerHTML = `<span class="quest-group-title">${g.emoji} ${isEN() ? g.en : g.ar}</span><span class="quest-group-line"></span>`;
    grid.appendChild(header);
    shownHabits.forEach(h => grid.appendChild(buildHabitCard(h, t)));
  });

  collapsedGroupHabits = collapsedHabits;
  syncCollapsedSection();

  const done = HABITS.filter(h => t[h.id]).length;
  document.getElementById('today-bar-fill').style.width = `${(done / HABITS.length) * 100}%`;
  document.getElementById('today-count').textContent =
    done === HABITS.length
      ? `${done}/${HABITS.length} — ${isEN() ? 'Full day! 💖' : 'يوم كامل! 💖'}`
      : `${done}/${HABITS.length}`;
}

/* ── بطاقة مشاركة على إنستغرام — تُرسم لحظيًا بدون صور جاهزة ─── */
/* لقطة حقيقية من نفس بطاقة الموقع (نفس الخط ونفس الألوان تمامًا)
   بدل إعادة رسمها يدويًا — نستنسخ العنصر فعليًا ونصوّره بـ html2canvas. */
async function buildStickerCanvas(h, done) {
  const node = document.createElement('div');
  node.className = 'habit-check' + (done ? ' done' : '');
  node.style.cssText = 'position:fixed; left:-9999px; top:0; width:560px; margin:0;';
  node.style.borderInlineStartColor = habitColor(h);
  node.innerHTML = `
    <div class="habit-box">✓</div>
    <div class="habit-check-info">
      <div class="habit-check-ar">${isEN() ? h.en : h.ar}</div>
      <div class="habit-check-en">${isEN() ? h.ar : h.en}</div>
    </div>
    <div class="habit-emoji">${h.emoji}</div>`;
  document.body.appendChild(node);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  let canvas;
  try {
    canvas = await html2canvas(node, { backgroundColor: null, scale: 3 });
  } finally {
    node.remove();
  }
  return canvas;
}

/* معاينة صريحة بدل التنزيل الصامت — أوضح وأوثق على كل الأجهزة،
   وتتيح لمن على آيفون حفظ الصورة بالضغط المطوّل إن لم يعمل زر التنزيل. */
async function shareQuestSticker(h, done) {
  const fileName = `${h.id}-${done ? 'done' : 'todo'}.png`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" style="text-align:center;">
      <div class="modal-title">${isEN() ? '📤 Share your quest' : '📤 شاركي مهمتك'}</div>
      <img id="sticker-preview" style="max-width:100%; border-radius:16px; margin:10px 0; display:block;" />
      <div style="font-size:.72rem; color:rgba(74,57,45,.55); margin-bottom:10px;">
        ${isEN() ? 'On iPhone: press and hold the image to save it if the button below doesn’t work.' : 'على الآيفون: اضغطي مطوّلًا على الصورة لحفظها إذا لم يعمل الزر بالأسفل.'}
      </div>
      <div class="modal-actions" style="justify-content:center;">
        <button class="btn btn-deep btn-small" data-act="download">⬇️ ${isEN() ? 'Save image' : 'حفظ الصورة'}</button>
        <button class="btn btn-small" id="native-share-btn" style="background:var(--bg); border:1.5px solid var(--line); display:none;">📤 ${isEN() ? 'Share' : 'مشاركة'}</button>
        <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="close">${isEN() ? 'Close' : 'إغلاق'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-act="close"]').addEventListener('click', close);

  const canvas = await buildStickerCanvas(h, done);
  canvas.toBlob(blob => {
    if (!blob) { showToast('تعذر إنشاء الصورة'); close(); return; }
    const url = URL.createObjectURL(blob);
    overlay.querySelector('#sticker-preview').src = url;

    overlay.querySelector('[data-act="download"]').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(isEN() ? 'Saved (check your downloads) 🤍' : 'تم الحفظ (تحققي من التنزيلات) 🤍');
    });

    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const shareBtn = overlay.querySelector('#native-share-btn');
      shareBtn.style.display = '';
      shareBtn.addEventListener('click', async () => {
        try { await navigator.share({ files: [file], title: isEN() ? h.en : h.ar }); }
        catch { /* ألغت المستخدمة — لا حاجة لخطأ */ }
      });
    }
  }, 'image/png');
}

function buildHabitCard(h, t) {
    const el = document.createElement('div');
    const done = !!t[h.id];
    el.className = 'habit-check' + (done ? ' done' : '') + (h.legendary ? ' legendary' : '');
    el.style.borderInlineStartColor = habitColor(h);
    const badge = h.legendary
      ? (isEN() ? `⭐ Legendary ×${habitPoints(h)}` : `⭐ أسطورية ×${AR_NUMS[habitPoints(h)] || habitPoints(h)}`)
      : '';
    const focused = isFocused(h.id);
    el.innerHTML = `
      ${badge ? `<span class="legendary-badge">${badge}</span>` : ''}
      <div class="habit-box">✓</div>
      <div class="habit-check-info">
        <div class="habit-check-ar">${isEN() ? h.en : h.ar}</div>
        <div class="habit-check-en">${isEN() ? h.ar : h.en}</div>
      </div>
      ${(PROGRESS_VIEW_PUBLIC || isAdmin) ? `<button class="habit-focus-btn${focused ? ' on' : ''}" title="${focused ? (isEN() ? 'On your board — click to move to Other quests' : 'ضمن لوحتك — اضغطي لنقلها إلى مهمات أخرى') : (isEN() ? 'In Other quests — click to bring back' : 'ضمن مهمات أخرى — اضغطي لإرجاعها')}">${focused ? '★' : '☆'}</button>` : ''}
      ${(PHOTOS_PUBLIC || isAdmin) ? `<button class="habit-photo-btn" title="${isEN() ? 'Upload a photo for this quest' : 'رفع صورة لهذه المهمة'}">📷</button>` : ''}
      <button class="habit-share-btn" title="${isEN() ? 'Share as image' : 'مشاركة كصورة'}">📤</button>
      <div class="habit-emoji">${h.emoji}</div>`;
    el.addEventListener('click', () => toggleHabit(h));
    el.querySelector('.habit-share-btn').addEventListener('click', e => {
      e.stopPropagation();
      shareQuestSticker(h, done);
    });
    el.querySelector('.habit-photo-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openPhotoUploadForQuest(h);
    });
    el.querySelector('.habit-focus-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFocus(h.id);
    });
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
  HABITS.filter(h => !h.adminOnly || MOM_FEATURES_PUBLIC || isAdmin).forEach(h => {
    const el = document.createElement('div');
    el.className = 'why-card';
    el.style.borderTopColor = habitColor(h);
    const legendaryTag = h.legendary
      ? `<span class="why-world" style="background:${LEGENDARY_COLOR}">${isEN() ? `Legendary ⭐ ×${habitPoints(h)}` : `مهمة أسطورية ⭐ ×${AR_NUMS[habitPoints(h)] || habitPoints(h)}`}</span> `
      : '';
    const worldTag = legendaryTag + h.worlds.map(w =>
      `<span class="why-world" style="background:${WORLDS[w].color}">${isEN() ? WORLDS[w].en : WORLDS[w].ar}</span>`).join(' ');
    const why = whyOf(h);
    const showMomTip = h.momTip && (MOM_FEATURES_PUBLIC || isAdmin);
    el.innerHTML = `
      <h3>${h.emoji} ${isEN() ? h.en : h.ar}</h3>
      ${worldTag}
      <div class="why-quote">${why.quote}</div>
      <div class="why-source">${why.source}</div>
      <div class="why-science"><strong>${isEN() ? '🔬 What the studies found' : '🔬 ماذا وجدت الدراسات؟'}</strong>${why.science}</div>
      ${showMomTip ? `<div class="mom-tip">🤱 ${isEN() ? h.momTipEn : h.momTip}</div>` : ''}`;
    grid.appendChild(el);
  });
}

/* ── Leaderboard (جولة الأسبوع) ──────────────────────────── */
let waitlistCount = null;
async function loadWaitlistCount() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    waitlistCount = snap.size;
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

  const end = weekStart(effectiveNow());
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

/* ── لوحتك الأسبوعية الشخصية — تصفّح أي أسبوع سابق (✓/فارغ لا أرقام) ── */
let progressWeekOffset = 0; /* ٠ = هذا الأسبوع، سالب = أسابيع سابقة */

function progressWeekStartDate() {
  const d = weekStart(effectiveNow());
  d.setDate(d.getDate() + progressWeekOffset * 7);
  return d;
}

async function ensureDaysLoaded(weekStartDate) {
  const gets = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate); d.setDate(d.getDate() + i);
    const k = dateKey(d);
    if (!myDays[k] && d <= effectiveNow()) {
      gets.push(getDoc(doc(db, 'days', `${me.uid}_${k}`)).then(s => {
        if (s.exists()) myDays[k] = { habits: s.data().habits || {}, points: s.data().points || 0, custom: s.data().custom || {} };
      }).catch(() => {}));
    }
  }
  if (gets.length) await Promise.all(gets);
}

async function renderPersonalWeekGrid() {
  const gridEl = document.getElementById('progress-week-grid');
  const labelEl = document.getElementById('progress-week-label');
  if (!gridEl || !labelEl) return;

  const wkStart = progressWeekStartDate();
  const weekDays = [];
  for (let i = 0; i < 7; i++) { const d = new Date(wkStart); d.setDate(d.getDate() + i); weekDays.push(d); }
  const endD = weekDays[6];
  labelEl.textContent = `${wkStart.toLocaleDateString(isEN() ? 'en' : 'ar', { day: 'numeric', month: 'short' })} – ${endD.toLocaleDateString(isEN() ? 'en' : 'ar', { day: 'numeric', month: 'short' })}`;
  const nextBtn = document.getElementById('progress-week-next');
  if (nextBtn) nextBtn.disabled = progressWeekOffset >= 0;

  gridEl.innerHTML = `<div class="card-desc">جارٍ التحميل…</div>`;
  await ensureDaysLoaded(wkStart);

  const rows = [
    ...HABITS.filter(h => (!h.adminOnly || MOM_FEATURES_PUBLIC || isAdmin) && isFocused(h.id)).map(h => ({ id: h.id, ar: h.ar, en: h.en, emoji: h.emoji, color: habitColor(h), custom: false })),
    ...myCustomHabits.filter(c => isFocused(c.id)).map(c => ({ id: c.id, ar: c.ar, en: c.ar, emoji: '🧩', color: WORLDS[c.world]?.color || '#755F4D', custom: true })),
  ];

  let html = `<table class="week-table"><thead><tr><th></th>
    ${weekDays.map(d => `<th>${DAY_LETTERS[d.getDay()]}<small>${pad(d.getDate())}/${pad(d.getMonth() + 1)}</small></th>`).join('')}
  </tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr><td class="week-question">${r.emoji} ${isEN() ? r.en : r.ar}</td>`;
    weekDays.forEach(d => {
      if (d > effectiveNow()) { html += `<td></td>`; return; }
      const dayDoc = myDays[dateKey(d)];
      const bag = r.custom ? dayDoc?.custom : dayDoc?.habits;
      const done = !!(bag && bag[r.id]);
      html += `<td>${done ? `<span class="week-check-mark" style="background:${r.color}">✓</span>` : ''}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  gridEl.innerHTML = `<div class="week-table-wrap">${html}</div>`;
}

document.getElementById('progress-week-prev')?.addEventListener('click', () => {
  progressWeekOffset--;
  renderPersonalWeekGrid();
});
document.getElementById('progress-week-next')?.addEventListener('click', () => {
  if (progressWeekOffset >= 0) return;
  progressWeekOffset++;
  renderPersonalWeekGrid();
});

/* ── كل مهمة لوحدها — تقويم أسابيع متعددة لمهمة واحدة تختارينها ── */
const SINGLE_WEEKS = 6; /* عدد الأسابيع المعروضة دفعة واحدة */
let singleQuestId = null;
let singlePageOffset = 0; /* ٠ = آخر ٦ أسابيع، سالب = صفحات أقدم */

function singleQuestOptions() {
  return [
    ...HABITS.filter(h => (!h.adminOnly || MOM_FEATURES_PUBLIC || isAdmin) && isFocused(h.id))
      .map(h => ({ id: h.id, ar: h.ar, en: h.en, emoji: h.emoji, color: habitColor(h), custom: false })),
    ...myCustomHabits.filter(c => isFocused(c.id))
      .map(c => ({ id: c.id, ar: c.ar, en: c.ar, emoji: '🧩', color: WORLDS[c.world]?.color || '#755F4D', custom: true })),
  ];
}

async function renderSingleQuestCalendar() {
  const select = document.getElementById('progress-single-select');
  const gridEl = document.getElementById('progress-single-grid');
  const labelEl = document.getElementById('progress-single-label');
  if (!select || !gridEl || !labelEl) return;

  const options = singleQuestOptions();
  if (options.length === 0) {
    select.innerHTML = '';
    gridEl.innerHTML = `<div class="card-desc">${isEN() ? 'No quests to show — star a quest first ⭐' : 'لا يوجد مهمات لعرضها — ثبّتي ⭐ على مهمة أولًا'}</div>`;
    return;
  }
  if (!singleQuestId || !options.find(o => o.id === singleQuestId)) singleQuestId = options[0].id;
  select.innerHTML = options.map(o =>
    `<option value="${o.id}" ${o.id === singleQuestId ? 'selected' : ''}>${o.emoji} ${esc(isEN() ? o.en : o.ar)}</option>`).join('');
  const chosen = options.find(o => o.id === singleQuestId);

  const latestWeekStart = weekStart(effectiveNow());
  const pageEndOffset = singlePageOffset * SINGLE_WEEKS;
  const weekStarts = [];
  for (let i = SINGLE_WEEKS - 1; i >= 0; i--) {
    const d = new Date(latestWeekStart);
    d.setDate(d.getDate() + (pageEndOffset - i) * 7);
    weekStarts.push(d);
  }
  const oldest = weekStarts[0], newest = weekStarts[weekStarts.length - 1];
  labelEl.textContent = `${oldest.toLocaleDateString(isEN() ? 'en' : 'ar', { day: 'numeric', month: 'short' })} – ${newest.toLocaleDateString(isEN() ? 'en' : 'ar', { day: 'numeric', month: 'short' })}`;
  const nextBtn = document.getElementById('progress-single-next');
  const prevBtn = document.getElementById('progress-single-prev');
  if (nextBtn) nextBtn.disabled = singlePageOffset >= 0;
  if (prevBtn) prevBtn.disabled = oldest <= weekStart(START_DATE);

  gridEl.innerHTML = `<div class="card-desc">${isEN() ? 'Loading…' : 'جارٍ التحميل…'}</div>`;
  await Promise.all(weekStarts.map(ws => ensureDaysLoaded(ws)));

  let html = `<table class="week-table"><thead><tr><th></th>
    ${Array.from({ length: 7 }, (_, i) => DAY_LETTERS[(2 + i) % 7]).map(l => `<th>${l}</th>`).join('')}
  </tr></thead><tbody>`;
  weekStarts.forEach(ws => {
    const end = new Date(ws); end.setDate(end.getDate() + 6);
    const rangeLabel = `${pad(ws.getDate())}/${pad(ws.getMonth() + 1)} – ${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;
    html += `<tr><td class="week-question">${rangeLabel}</td>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws); d.setDate(d.getDate() + i);
      if (d < START_DATE || d > effectiveNow()) { html += `<td></td>`; continue; }
      const dayDoc = myDays[dateKey(d)];
      const bag = chosen.custom ? dayDoc?.custom : dayDoc?.habits;
      const done = !!(bag && bag[chosen.id]);
      html += `<td>${done ? `<span class="week-check-mark" style="background:${chosen.color}">✓</span>` : ''}</td>`;
    }
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  gridEl.innerHTML = `<div class="week-table-wrap">${html}</div>`;
}

document.getElementById('progress-single-select')?.addEventListener('change', e => {
  singleQuestId = e.target.value;
  renderSingleQuestCalendar();
});
document.getElementById('progress-single-prev')?.addEventListener('click', () => {
  singlePageOffset--;
  renderSingleQuestCalendar();
});
document.getElementById('progress-single-next')?.addEventListener('click', () => {
  if (singlePageOffset >= 0) return;
  singlePageOffset++;
  renderSingleQuestCalendar();
});

document.getElementById('progress-subtabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.subtab-btn');
  if (!btn) return;
  document.querySelectorAll('#progress-subtabs .subtab-btn').forEach(b => b.classList.toggle('active', b === btn));
  document.getElementById('progress-subtab-week').hidden = btn.dataset.subtab !== 'week';
  document.getElementById('progress-subtab-list').hidden = btn.dataset.subtab !== 'list';
  document.getElementById('progress-subtab-single').hidden = btn.dataset.subtab !== 'single';
  if (btn.dataset.subtab === 'single') renderSingleQuestCalendar();
});

/* ── تقدمي الشخصي: كم مرة أنجزت كل مهمة هذا الأسبوع/الشهر ── */
function renderMyProgress() {
  const section = document.getElementById('my-progress-section');
  if (!section) return;
  const show = PROGRESS_VIEW_PUBLIC || isAdmin;
  section.hidden = !show;
  if (!show) return;

  renderPersonalWeekGrid();
  if (!document.getElementById('progress-subtab-single')?.hidden) renderSingleQuestCalendar();

  const list = document.getElementById('my-progress-list');
  if (!list) return;
  const wk = thisWeekKey();
  const now = effectiveNow();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function countsFor(id, isCustom) {
    let weekN = 0, monthN = 0;
    Object.entries(myDays).forEach(([date, d]) => {
      const bag = isCustom ? d.custom : d.habits;
      if (!bag || !bag[id]) return;
      const dt = new Date(date + 'T12:00:00');
      if (dateKey(weekStart(dt)) === wk) weekN++;
      if (dt >= monthStart) monthN++;
    });
    return { weekN, monthN };
  }

  function dayStrip(id, isCustom) {
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(daysAgo(i));
    const dots = days.map(d => {
      const key = dateKey(d);
      const dayDoc = myDays[key];
      const bag = isCustom ? dayDoc?.custom : dayDoc?.habits;
      const done = !!(bag && bag[id]);
      const label = d.toLocaleDateString(isEN() ? 'en' : 'ar', { day: 'numeric', month: 'short' });
      return `<span class="day-dot${done ? ' done' : ''}" title="${label}"></span>`;
    }).join('');
    return `<div class="day-strip">${dots}</div>`;
  }

  function row(emoji, name, id, isCustom) {
    const { weekN, monthN } = countsFor(id, isCustom);
    return `
      <div class="progress-row" style="flex-direction:column; align-items:stretch; gap:6px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="progress-name">${emoji} ${name}</div>
          <div class="progress-nums">
            <span class="progress-pill">${isEN() ? `Week: ${weekN}` : `الأسبوع: ${weekN}`}</span>
            <span class="progress-pill">${isEN() ? `Month: ${monthN}` : `الشهر: ${monthN}`}</span>
          </div>
        </div>
        ${dayStrip(id, isCustom)}
      </div>`;
  }

  let html = '';
  GROUPS.forEach(g => {
    const items = (GROUP_ITEMS[g.id] || [])
      .map(id => HABITS.find(h => h.id === id))
      .filter(Boolean)
      .filter(h => (!h.adminOnly || MOM_FEATURES_PUBLIC || isAdmin) && isFocused(h.id));
    if (items.length === 0) return;
    html += `<div class="progress-group-title">${g.emoji} ${isEN() ? g.en : g.ar}</div>`;
    items.forEach(h => { html += row(h.emoji, isEN() ? h.en : h.ar, h.id, false); });
  });

  if (CUSTOM_HABITS_PUBLIC || isAdmin) {
    const customs = (myCustomHabits || []).filter(c => isFocused(c.id));
    if (customs.length > 0) {
      html += `<div class="progress-group-title">🧩 ${isEN() ? 'My Own Habits' : 'عاداتي الخاصة'}</div>`;
      customs.forEach(c => { html += row('🧩', c.ar, c.id, true); });
    }
  }

  list.innerHTML = html || `<div class="mission-empty">${isEN() ? 'No data yet' : 'لا يوجد بيانات بعد'}</div>`;
}

async function renderCharts() {
  renderMyProgress();
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

/* حوار رد بهوية اللعبة بدل نافذة النظام — يدعم كتابة الرد وتعديله */
/* initial: { text, audio } | null  →  يعيد null (إلغاء) أو { text, audioBlob, removeAudio } */
function replyModal(postText, initial) {
  const editing = !!initial;
  const existingAudio = initial?.audio || null;
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">${editing
          ? (isEN() ? '✏️ Edit your reply' : '✏️ تعديل ردك')
          : (isEN() ? '↩ Your reply' : '↩ ردك على المنشور')}</div>
        <div class="modal-quote">${esc(postText)}</div>
        <textarea maxlength="500" placeholder="${isEN() ? 'Write your reply…' : 'اكتبي ردك هنا…'}"></textarea>
        <div class="voice-box">
          <div class="voice-row" id="voice-row"></div>
        </div>
        ${editing ? `<div style="font-size:.68rem; color:rgba(74,57,45,.5); margin-top:6px;">${isEN() ? 'Tip: empty the text and voice note, then save to remove the reply.' : 'ملاحظة: امسحي النص والتسجيل الصوتي واحفظي لإزالة الرد نهائيًا.'}</div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${editing
            ? (isEN() ? 'Save changes' : 'حفظ التعديل')
            : (isEN() ? 'Post reply' : 'نشر الرد')}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const ta = overlay.querySelector('textarea');
    ta.value = initial?.text || '';

    /* ── مسجّل الصوت ─────────────────────────────────────── */
    const voiceRow = overlay.querySelector('#voice-row');
    let mediaRecorder = null, chunks = [], recordedBlob = null, removeAudioFlag = false;
    let timerInt = null, seconds = 0, stream = null;

    function fmtTime(s) { return `${String(Math.floor(s / 60)).padStart(1, '0')}:${String(s % 60).padStart(2, '0')}`; }

    function drawIdle() {
      voiceRow.innerHTML = '';
      const recBtn = document.createElement('button');
      recBtn.type = 'button';
      recBtn.className = 'voice-rec-btn';
      recBtn.innerHTML = `🎙️ ${isEN() ? 'Record a voice reply' : 'سجّلي ردًا صوتيًا'}`;
      recBtn.addEventListener('click', startRecording);
      voiceRow.appendChild(recBtn);

      if (recordedBlob) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(recordedBlob);
        voiceRow.appendChild(audio);
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'voice-remove';
        rm.textContent = isEN() ? '✕ remove' : '✕ حذف التسجيل';
        rm.addEventListener('click', () => { recordedBlob = null; drawIdle(); });
        voiceRow.appendChild(rm);
      } else if (existingAudio && !removeAudioFlag) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = existingAudio;
        voiceRow.appendChild(audio);
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'voice-remove';
        rm.textContent = isEN() ? '✕ remove' : '✕ حذف التسجيل';
        rm.addEventListener('click', () => { removeAudioFlag = true; drawIdle(); });
        voiceRow.appendChild(rm);
      }
    }

    async function startRecording() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        showToast(isEN() ? 'Microphone access denied' : 'تعذّر الوصول إلى الميكروفون');
        return;
      }
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerInt);
        drawIdle();
      };
      mediaRecorder.start();
      seconds = 0;
      voiceRow.innerHTML = `
        <button type="button" class="voice-rec-btn recording" id="stop-rec-btn">
          <span class="voice-dot"></span> ${isEN() ? 'Stop' : 'إيقاف'} <span class="voice-timer" id="voice-timer">0:00</span>
        </button>`;
      overlay.querySelector('#stop-rec-btn').addEventListener('click', () => mediaRecorder.stop());
      timerInt = setInterval(() => {
        seconds++;
        const t = overlay.querySelector('#voice-timer');
        if (t) t.textContent = fmtTime(seconds);
        if (seconds >= 120) mediaRecorder.stop(); /* حد أقصى دقيقتان */
      }, 1000);
    }

    drawIdle();

    const close = val => {
      clearInterval(timerInt);
      if (stream) stream.getTracks().forEach(t => t.stop());
      overlay.remove();
      resolve(val);
    };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => close({
      text: ta.value.trim(), audioBlob: recordedBlob, removeAudio: removeAudioFlag,
    }));
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        close({ text: ta.value.trim(), audioBlob: recordedBlob, removeAudio: removeAudioFlag });
      }
      if (e.key === 'Escape') close(null);
    });
    document.body.appendChild(overlay);
    ta.focus();
  });
}

async function loadWallPage(pageIndex) {
  if (wallLoading) return;
  if (wallPages[pageIndex]) { wallPageIndex = pageIndex; renderPosts(); return; }
  wallLoading = true;
  renderPosts();
  try {
    let q;
    if (pageIndex === 0) {
      q = query(collection(db, 'posts'), orderBy('time', 'desc'), limit(WALL_PAGE));
    } else {
      const prevPage = wallPages[pageIndex - 1] || [];
      const cursor = prevPage[prevPage.length - 1];
      q = query(collection(db, 'posts'), orderBy('time', 'desc'),
        startAfter(cursor ? cursor.time : Date.now()), limit(WALL_PAGE));
    }
    const snap = await getDocs(q);
    wallPages[pageIndex] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    wallHasMore = snap.docs.length === WALL_PAGE;
    wallPageIndex = pageIndex;
  } catch {
    showToast(isEN() ? 'Could not load posts' : 'تعذر تحميل المنشورات');
  }
  wallLoading = false;
  renderPosts();
}

async function ensureWallSearchCache() {
  if (wallSearchCache) return;
  wallLoading = true;
  renderPosts();
  try {
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('time', 'desc')));
    wallSearchCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    wallSearchCache = [];
    showToast(isEN() ? 'Could not search' : 'تعذر البحث');
  }
  wallLoading = false;
  renderPosts();
}

function wallFilterActive() { return !!(wallSearchQuery.trim() || wallSearchTag); }

function tagPickerModal(currentTags) {
  return new Promise(resolve => {
    const tags = isEN() ? WALL_TAGS_EN : WALL_TAGS;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">🏷️ ${isEN() ? 'Tag this post' : 'صنّفي هذا المنشور'}</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin:10px 0;">
          ${tags.map((t, i) => `
            <label style="display:flex; align-items:center; gap:6px; background:var(--bg); border:1.5px solid var(--line); border-radius:999px; padding:6px 12px; cursor:pointer; font-size:.82rem;">
              <input type="checkbox" value="${esc(WALL_TAGS[i])}" ${currentTags.includes(WALL_TAGS[i]) ? 'checked' : ''} />
              ${esc(t)}
            </label>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Save' : 'حفظ'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => {
      const picked = [...overlay.querySelectorAll('input[type=checkbox]:checked')].map(el => el.value);
      close(picked);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.body.appendChild(overlay);
  });
}

function renderPosts() {
  const list = document.getElementById('posts-list');
  const pagerEl = document.getElementById('wall-pager');
  if (!list) return;
  list.innerHTML = '';

  if (wallLoading && !wallFilterActive() && !wallPages[wallPageIndex]) {
    list.innerHTML = `<div class="mission-empty">${isEN() ? 'Loading…' : 'جارٍ التحميل…'}</div>`;
    if (pagerEl) pagerEl.innerHTML = '';
    return;
  }

  let sorted, showPager;
  if (wallFilterActive()) {
    showPager = false;
    if (!wallSearchCache) {
      list.innerHTML = `<div class="mission-empty">${isEN() ? 'Loading…' : 'جارٍ التحميل…'}</div>`;
      if (pagerEl) pagerEl.innerHTML = '';
      return;
    }
    const q = wallSearchQuery.trim().toLowerCase();
    sorted = wallSearchCache.filter(p => {
      const matchesQuery = !q || (p.text || '').toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q);
      const matchesTag = !wallSearchTag || (p.tags || []).includes(wallSearchTag);
      return matchesQuery && matchesTag;
    }).sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.time - a.time);
  } else {
    showPager = true;
    const page = wallPages[wallPageIndex] || [];
    sorted = [...page].sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.time - a.time);
  }

  if (sorted.length === 0) {
    list.innerHTML = `<div class="mission-empty">${wallFilterActive()
      ? (isEN() ? 'No matching posts' : 'لا يوجد منشورات مطابقة')
      : (isEN() ? 'No posts yet — be the first 🤍' : 'ما في منشورات بعد — كوني أول من يشارك 🤍')}</div>`;
  }

  sorted.forEach(p => {
    const el = document.createElement('div');
    el.className = 'post-item' + (p.pinned ? ' pinned' : '');
    const canDelete = isAdmin || (me && p.uid === me.uid);
    const tags = p.tags || [];
    const tagLabels = tags.map(t => {
      const i = WALL_TAGS.indexOf(t);
      return i === -1 ? t : (isEN() ? WALL_TAGS_EN[i] : WALL_TAGS[i]);
    });
    el.innerHTML = `
      <div class="post-head">
        <span class="post-author">${esc(p.author)}</span>
        ${p.admin ? `<span class="post-badge">${isEN() ? 'Host' : 'المشرفة'}</span>` : ''}
        ${p.pinned ? `<span class="post-badge" style="background:var(--accent);color:var(--text)">${isEN() ? '📌 Pinned' : '📌 مثبّت'}</span>` : ''}
        ${tagLabels.map(t => `<span class="status-badge status-planned">${esc(t)}</span>`).join('')}
        <span class="post-time">${timeAgo(p.time)}</span>
        ${isAdmin ? `<button class="post-delete" data-act="tag" data-id="${p.id}">🏷️ ${isEN() ? 'tag' : 'تصنيف'}</button>
                     <button class="post-delete" data-act="reply" data-id="${p.id}">${p.reply ? (isEN() ? '✏️ edit reply' : '✏️ تعديل الرد') : (isEN() ? '↩ reply' : '↩ رد')}</button>
                     <button class="post-delete" data-act="pin" data-id="${p.id}">${p.pinned ? (isEN() ? 'unpin' : 'إلغاء التثبيت') : (isEN() ? '📌 pin' : '📌 تثبيت')}</button>` : ''}
        ${canDelete ? `<button class="post-delete" data-act="del" data-id="${p.id}">${isEN() ? 'delete' : 'حذف'}</button>` : ''}
      </div>
      <div class="post-body">${esc(p.text)}</div>
      ${p.reply ? `
        <div class="post-reply">
          <div class="post-head">
            <span class="post-author">${esc(p.reply.author)}</span>
            <span class="post-badge">${isEN() ? 'Host' : 'المشرفة'}</span>
          </div>
          ${p.reply.text ? esc(p.reply.text) : ''}
          ${p.reply.audio ? `<div class="reply-audio"><audio controls src="${esc(p.reply.audio)}"></audio></div>` : ''}
        </div>` : ''}`;
    list.appendChild(el);
  });

  /* تحديث فوري محلي — يشمل كل الصفحات المحمّلة وكاش البحث */
  function findLocal(id) {
    for (const page of wallPages) { const f = page?.find(x => x.id === id); if (f) return f; }
    return wallSearchCache?.find(x => x.id === id);
  }
  function patchLocal(id, patch) {
    wallPages.forEach(page => {
      const i = page?.findIndex(x => x.id === id);
      if (i > -1) page[i] = { ...page[i], ...patch };
    });
    if (wallSearchCache) {
      const i = wallSearchCache.findIndex(x => x.id === id);
      if (i > -1) wallSearchCache[i] = { ...wallSearchCache[i], ...patch };
    }
  }
  function removeLocal(id) {
    wallPages = wallPages.map(page => page?.filter(x => x.id !== id));
    if (wallSearchCache) wallSearchCache = wallSearchCache.filter(x => x.id !== id);
  }

  list.querySelectorAll('.post-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = btn.dataset.id;
      const act = btn.dataset.act;
      try {
        if (act === 'del') {
          removeLocal(id);
          renderPosts();
          await deleteDoc(doc(db, 'posts', id));
          showToast('تم حذف المنشور');
        } else if (act === 'pin') {
          const p = findLocal(id);
          const newPinned = !p.pinned;
          patchLocal(id, { pinned: newPinned });
          renderPosts();
          await updateDoc(doc(db, 'posts', id), { pinned: newPinned });
        } else if (act === 'tag') {
          const p = findLocal(id);
          const picked = await tagPickerModal(p?.tags || []);
          if (picked === null) return;
          patchLocal(id, { tags: picked });
          renderPosts();
          await updateDoc(doc(db, 'posts', id), { tags: picked });
        } else if (act === 'reply') {
          const p = findLocal(id);
          const existing = p && p.reply ? p.reply : null;
          const result = await replyModal(p ? p.text : '', existing);
          if (result === null) return; /* إلغاء */
          const { text, audioBlob, removeAudio } = result;
          const keepingOldAudio = existing?.audio && !removeAudio && !audioBlob;

          if (!text && !audioBlob && !keepingOldAudio) {
            /* لا نص ولا صوت — إزالة الرد بالكامل */
            if (existing?.audio) deleteObject(storageRef(storage, existing.audio)).catch(() => {});
            patchLocal(id, { reply: null });
            renderPosts();
            await updateDoc(doc(db, 'posts', id), { reply: null });
            showToast('أُزيل الرد');
          } else {
            showToast(audioBlob ? 'جارٍ رفع التسجيل الصوتي…' : 'جارٍ الحفظ…');
            let audioUrl = keepingOldAudio ? existing.audio : null;
            if (audioBlob) {
              try {
                const ext = (audioBlob.type.split('/')[1] || 'webm').split(';')[0];
                const path = `replies/${id}_${Date.now()}.${ext}`;
                const ref = storageRef(storage, path);
                await uploadBytes(ref, audioBlob, { contentType: audioBlob.type });
                audioUrl = await getDownloadURL(ref);
                if (existing?.audio) deleteObject(storageRef(storage, existing.audio)).catch(() => {});
              } catch {
                showToast('تعذّر رفع التسجيل الصوتي — تحققي من تفعيل Storage');
                return;
              }
            } else if (removeAudio && existing?.audio) {
              deleteObject(storageRef(storage, existing.audio)).catch(() => {});
              audioUrl = null;
            }
            const reply = { author: ADMIN_NAME, text: text || '', audio: audioUrl || null };
            patchLocal(id, { reply });
            renderPosts();
            await updateDoc(doc(db, 'posts', id), { reply });
            showToast(existing ? 'عُدّل ردك 🤍' : 'نُشر ردك 🤍');
          }
        }
      } catch (err) {
        showToast('لم تنجح العملية — تحققي من الصلاحيات');
        console.error('wall action failed:', act, err);
      }
    });
  });

  if (pagerEl) {
    if (showPager) {
      pagerEl.innerHTML = `
        <div class="week-nav" style="display:flex; align-items:center; justify-content:space-between; margin-top:14px;">
          <button type="button" class="week-nav-btn" id="wall-page-prev" aria-label="${isEN() ? 'Newer' : 'أحدث'}" ${wallPageIndex === 0 ? 'disabled' : ''}>‹</button>
          <div class="week-month-label">${isEN() ? `Page ${wallPageIndex + 1}` : `صفحة ${AR_NUMS[wallPageIndex + 1] || wallPageIndex + 1}`}</div>
          <button type="button" class="week-nav-btn" id="wall-page-next" aria-label="${isEN() ? 'Older' : 'أقدم'}" ${!wallHasMore ? 'disabled' : ''}>›</button>
        </div>`;
      document.getElementById('wall-page-prev')?.addEventListener('click', () => {
        if (wallPageIndex > 0) loadWallPage(wallPageIndex - 1);
      });
      document.getElementById('wall-page-next')?.addEventListener('click', () => {
        if (wallHasMore) loadWallPage(wallPageIndex + 1);
      });
    } else {
      pagerEl.innerHTML = '';
    }
  }
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
      admin: isAdmin, pinned: false, tags: [],
      text, time: Date.now(), reply: null,
    });
    input.value = '';
    showToast(isEN() ? 'Posted 🤍' : 'نُشر سؤالك 🤍');
  } catch {
    showToast('تعذر النشر — تحققي من الاتصال');
  }
});

let wallSearchDebounce;
document.getElementById('wall-search-input')?.addEventListener('input', e => {
  wallSearchQuery = e.target.value;
  clearTimeout(wallSearchDebounce);
  wallSearchDebounce = setTimeout(() => {
    if (wallFilterActive()) ensureWallSearchCache(); else renderPosts();
  }, 250);
});
document.getElementById('wall-tag-select')?.addEventListener('change', e => {
  wallSearchTag = e.target.value;
  if (wallFilterActive()) ensureWallSearchCache(); else renderPosts();
});

/* ── صور المهمات — حائط صور فقط، بدون إعجابات (قرارها) ──── */
async function uploadPhoto(file, caption, questInfo) {
  if (!me || !nickname || !file) return;
  if (!file.type.startsWith('image/')) {
    showToast(isEN() ? 'Please choose an image file' : 'الرجاء اختيار ملف صورة');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast(isEN() ? 'Image too large (max 5MB)' : 'الصورة كبيرة جدًا (الحد الأقصى ٥ ميجا)');
    return;
  }
  showToast(isEN() ? 'Uploading…' : 'جارٍ الرفع…');
  try {
    const ext = (file.type.split('/')[1] || 'jpg').split(';')[0];
    const path = `photos/${me.uid}_${Date.now()}.${ext}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type });
    const imageUrl = await getDownloadURL(ref);
    await addDoc(collection(db, 'photos'), {
      uid: me.uid, author: isAdmin ? ADMIN_NAME : nickname,
      imageUrl, caption: caption || '',
      questId: questInfo?.id || null, questAr: questInfo?.ar || null,
      questEn: questInfo?.en || null, questEmoji: questInfo?.emoji || null,
      time: Date.now(),
    });
    showToast(isEN() ? 'Posted 🤍' : 'نُشرت الصورة 🤍');
  } catch (err) {
    console.error('uploadPhoto failed:', err);
    showToast(isEN() ? 'Could not upload — check Storage is enabled' : 'تعذّر الرفع — تحققي من تفعيل Storage');
  }
}

function renderPhotos() {
  const list = document.getElementById('photos-list');
  if (!list) return;
  if (photosCache.length === 0) {
    list.innerHTML = `<div class="mission-empty">${isEN() ? 'No photos yet — be the first 🤍' : 'ما في صور بعد — كوني أول من يشارك 🤍'}</div>`;
    return;
  }
  list.innerHTML = photosCache.map(p => {
    const canDelete = isAdmin || (me && p.uid === me.uid);
    const questLabel = isEN() ? (p.questEn || p.questAr) : (p.questAr || p.questEn);
    const questTag = p.questId
      ? `<span class="photo-quest-tag">${p.questEmoji || ''} ${esc(questLabel || '')}</span>`
      : '';
    return `
      <div class="photo-card">
        <img src="${esc(p.imageUrl)}" alt="" loading="lazy" />
        <div class="photo-card-body">
          ${questTag}
          ${p.caption ? `<div class="photo-caption">${esc(p.caption)}</div>` : ''}
          <div class="post-head" style="margin-bottom:0;">
            <span class="post-author">${esc(p.author)}</span>
            <span class="post-time">${timeAgo(p.time)}</span>
            ${canDelete ? `<button class="post-delete" data-act="pdelphoto" data-id="${p.id}">${isEN() ? 'delete' : 'حذف'}</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-act="pdelphoto"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const p = photosCache.find(x => x.id === id);
      photosCache = photosCache.filter(x => x.id !== id);
      renderPhotos();
      try {
        await deleteDoc(doc(db, 'photos', id));
        if (p?.imageUrl) deleteObject(storageRef(storage, p.imageUrl)).catch(() => {});
      } catch { showToast(isEN() ? 'Could not delete' : 'تعذر الحذف'); }
    });
  });
}

document.getElementById('photo-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const fileInput = document.getElementById('photo-file-input');
  const captionInput = document.getElementById('photo-caption-input');
  const file = fileInput.files[0];
  if (!file) { showToast(isEN() ? 'Choose a photo first' : 'اختاري صورة أولًا'); return; }
  await uploadPhoto(file, captionInput.value.trim(), null);
  fileInput.value = '';
  captionInput.value = '';
});

function photoUploadModal(questInfo) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">📷 ${isEN() ? `Photo for “${questInfo.en}”` : `صورة لمهمة «${questInfo.ar}»`}</div>
        <input type="file" id="modal-photo-file" accept="image/*" style="margin-top:8px; width:100%;" />
        <textarea id="modal-photo-caption" maxlength="200" style="margin-top:10px; min-height:60px;" placeholder="${isEN() ? 'Caption (optional)…' : 'تعليق (اختياري)…'}"></textarea>
        <div class="modal-actions">
          <button class="btn btn-deep btn-small" data-act="send">${isEN() ? 'Post' : 'نشر'}</button>
          <button class="btn btn-small" style="background:var(--bg); border:1.5px solid var(--line);" data-act="cancel">${isEN() ? 'Cancel' : 'إلغاء'}</button>
        </div>
      </div>`;
    const fileInput = overlay.querySelector('#modal-photo-file');
    const capInput = overlay.querySelector('#modal-photo-caption');
    const close = val => { overlay.remove(); resolve(val); };
    overlay.querySelector('[data-act="send"]').addEventListener('click', () => {
      const file = fileInput.files[0];
      if (!file) { showToast(isEN() ? 'Choose a photo first' : 'اختاري صورة أولًا'); return; }
      close({ file, caption: capInput.value.trim() });
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.body.appendChild(overlay);
  });
}

async function openPhotoUploadForQuest(h) {
  if (!me || !nickname) return;
  const result = await photoUploadModal(h);
  if (!result) return;
  await uploadPhoto(result.file, result.caption, { id: h.id, ar: h.ar, en: h.en, emoji: h.emoji });
}

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
  updateWhyTab();
  renderWhy(); /* لإظهار/إخفاء بطاقات المشرفة فقط (مثل ميزات الأمهات) بعد تسجيل الدخول أو الخروج */
  renderMyProgress();
  renderCustomHabits();
  renderReflectTab();
  if (isAdmin) renderPosts();
}

/* تبويب "لماذا؟" ظاهر للجميع بعد مراجعة الأحاديث */
const SHOW_WHY_PUBLIC = true;
/* ميزات الأمهات — اعتُمدت للجميع ٢٠٢٦-٠٨-٠٦ */
const MOM_FEATURES_PUBLIC = true;
/* تقدمي الشخصي (أسبوع/شهر بكل مهمة) والعادات الخاصة — اعتُمدت للجميع ٢٠٢٦-٠٧-٢٨ */
const PROGRESS_VIEW_PUBLIC = true;
const CUSTOM_HABITS_PUBLIC = true;
const REFLECT_PUBLIC = true;
/* السماح بتسجيل مهمات أمس (نسيت تسجّل قبل بداية يوم جديد) — اعتُمدت للجميع ٢٠٢٦-٠٨-٠١ */
const YESTERDAY_GRACE_PUBLIC = true;
/* حائط الصور — اعتُمدت للجميع ٢٠٢٦-٠٨-١٣ */
const PHOTOS_PUBLIC = true;
function updateWhyTab() {
  const whyBtn = document.querySelector('.tab-btn[data-tab="why"]');
  if (whyBtn) whyBtn.hidden = !(SHOW_WHY_PUBLIC || isAdmin);
  const photosBtn = document.querySelector('.tab-btn[data-tab="photos"]');
  if (photosBtn) photosBtn.hidden = !(PHOTOS_PUBLIC || isAdmin);
}

/* ── لوحة المشرفة (تظهر لها فقط) ─────────────────────────── */
/* قائمة كل الأسابيع منذ الانطلاقة حتى الآن، الأحدث أولًا */
function allWeeksList() {
  const weeks = [];
  const cursor = weekStart(START_DATE);
  const last = weekStart(effectiveNow());
  while (cursor <= last) {
    const startK = dateKey(cursor);
    const endD = new Date(cursor); endD.setDate(endD.getDate() + 6);
    const label = `${cursor.toLocaleDateString('ar', { day: 'numeric', month: 'short' })} – ${endD.toLocaleDateString('ar', { day: 'numeric', month: 'short' })}`;
    weeks.push({ key: startK, label });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks.reverse();
}

/* ملخص شامل بحسب الأسبوع — تُجلب وتُخزَّن مؤقتًا لكل أسبوع يُطلب */
async function fetchStatsForWeek(wk, force) {
  if (!force && statsWeeks[wk]) return statsWeeks[wk];
  try {
    const snap = await getDocs(collection(db, `stats/${wk}/shards`));
    const agg = { dayCounts: {}, habitCounts: {}, cellCounts: {} };
    snap.forEach(s => {
      const d = s.data();
      Object.entries(d.dayCounts || {}).forEach(([k, v]) => { agg.dayCounts[k] = (agg.dayCounts[k] || 0) + v; });
      Object.entries(d.habitCounts || {}).forEach(([k, v]) => { agg.habitCounts[k] = (agg.habitCounts[k] || 0) + v; });
      Object.entries(d.cellCounts || {}).forEach(([k, v]) => { agg.cellCounts[k] = (agg.cellCounts[k] || 0) + v; });
    });
    statsWeeks[wk] = agg;
  } catch { statsWeeks[wk] = { dayCounts: {}, habitCounts: {}, cellCounts: {} }; }
  return statsWeeks[wk];
}

async function renderWeekStats(wk) {
  const block = document.getElementById('week-stats-block');
  if (!block) return;
  block.innerHTML = '<div class="card-desc">جارٍ تحميل أرقام هذا الأسبوع…</div>';

  const countOf = path => getDocs(collection(db, path)).then(s => s.size).catch(() => '؟');
  const top30Of = wkKey => getDocs(query(collection(db, `weeks/${wkKey}/players`), orderBy('points', 'desc'), limit(30)))
    .then(s => s.docs.map(d => ({ uid: d.id, ...d.data() })))
    .catch(() => []);
  const [playersC, agg, top30] = await Promise.all([countOf(`weeks/${wk}/players`), fetchStatsForWeek(wk, true), top30Of(wk)]);
  const weekTotal = Object.values(agg.dayCounts || {}).reduce((s, v) => s + Math.max(0, v), 0);
  const isCurrent = wk === thisWeekKey();
  const dayCount = Math.max(1, Object.keys(agg.dayCounts || {}).length);
  const avgPerDay = Math.round((weekTotal / dayCount) * 10) / 10;

  let html = `
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${playersC}</div><div class="stat-lbl">${isCurrent ? 'لعبن هذا الأسبوع' : 'لعبن ذلك الأسبوع'}</div></div>
      <div class="stat-box"><div class="stat-num">${weekTotal}</div><div class="stat-lbl">مهمات هذا الأسبوع</div></div>
      ${isCurrent
        ? `<div class="stat-box"><div class="stat-num">${Math.max(0, agg.dayCounts?.[myDayKey()] || 0)}</div><div class="stat-lbl">مهمات أُنجزت اليوم</div></div>`
        : `<div class="stat-box"><div class="stat-num">${avgPerDay}</div><div class="stat-lbl">متوسط يوميًا</div></div>`}
    </div>`;

  /* لوحة الصدارة — أفضل ٣٠ لهذا الأسبوع بعينه */
  const lbRowsWk = top30.filter(r => r.nick !== ADMIN_NAME);
  const lbMax = Math.max(1, lbRowsWk[0]?.points || 0);
  html += `
    <div class="card-title" style="font-size:1rem">لوحة الصدارة — ${isCurrent ? 'هذا الأسبوع' : 'ذلك الأسبوع'}</div>
    <div class="card-desc">أفضل ٣٠ لاعبة</div>
    <div id="admin-week-lb" style="margin-bottom:18px">`;
  if (lbRowsWk.length === 0) {
    html += `<div class="prelaunch-note">اللوحة فارغة لهذا الأسبوع</div>`;
  } else {
    lbRowsWk.forEach((r, i) => {
      html += `
        <div class="lb-row">
          <div class="lb-rank">${i + 1}</div>
          <div class="lb-name">${esc(r.nick || '')}</div>
          <div class="lb-bar-wrap"><div class="lb-bar" style="width:${((r.points || 0) / lbMax) * 100}%"></div></div>
          <div class="lb-pts">${r.points || 0} نقطة</div>
        </div>`;
    });
  }
  html += `</div>`;

  /* بطاقة المعدلات — متوسط الأداء اليومي لكل مهمة (مثل daily_tracker) */
  const perQuestDailyAvg = HABITS.map(h => ({
    h, avg: (Math.max(0, agg.habitCounts?.[h.id] || 0)) / dayCount,
  }));
  const overallAvg = perQuestDailyAvg.reduce((s, x) => s + x.avg, 0) / Math.max(1, HABITS.length);
  const maxAvg = Math.max(1, ...perQuestDailyAvg.map(x => x.avg));
  html += `
    <div class="card-title" style="font-size:1rem">المعدلات — ${isCurrent ? 'هذا الأسبوع' : 'ذلك الأسبوع'}</div>
    <div class="card-desc">متوسط عدد المرات يوميًا لكل مهمة</div>
    <div class="avg-total-box">${overallAvg.toFixed(1)}<small>المتوسط العام لكل مهمة يوميًا</small></div>
    <div style="margin-bottom:18px">`;
  perQuestDailyAvg.forEach(({ h, avg }) => {
    html += `
      <div class="avg-legend-row">
        <span class="avg-legend-name">${h.emoji} ${h.ar}</span>
        <span class="avg-legend-track"><span class="avg-legend-fill" style="width:${(avg / maxAvg) * 100}%; background:${habitColor(h)}"></span></span>
        <span class="avg-legend-score">${avg.toFixed(1)}</span>
      </div>`;
  });
  html += `</div>`;

  /* اللوحة الأسبوعية — كل مهمة × كل يوم (تبدأ من تاريخ إضافة هذه الميزة) */
  const weekDays = [];
  const wkStartDate = new Date(wk + 'T12:00:00');
  for (let i = 0; i < 7; i++) { const d = new Date(wkStartDate); d.setDate(d.getDate() + i); weekDays.push(d); }
  html += `
    <div class="card-title" style="font-size:1rem">اللوحة الأسبوعية — ${isCurrent ? 'هذا الأسبوع' : 'ذلك الأسبوع'}</div>
    <div class="card-desc">كل مهمة وعدد مرات إنجازها كل يوم من المجتمع — تبدأ البيانات من ٢٧ يوليو ٢٠٢٦</div>
    <div class="week-table-wrap"><table class="week-table"><thead><tr><th></th>
      ${weekDays.map(d => `<th>${DAY_LETTERS[d.getDay()]}<small>${pad(d.getDate())}/${pad(d.getMonth() + 1)}</small></th>`).join('')}
    </tr></thead><tbody>`;
  HABITS.forEach(h => {
    html += `<tr><td class="week-question">${h.emoji} ${h.ar}</td>`;
    weekDays.forEach(d => {
      const n = Math.max(0, agg.cellCounts?.[`${dateKey(d)}_${h.id}`] || 0);
      html += `<td>${n > 0 ? `<span class="week-cell-val" style="background:${habitColor(h)}">${n}</span>` : ''}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;

  block.innerHTML = html;
}

async function renderAdminDash() {
  if (!isAdmin) return;
  const el = document.getElementById('admin-stats');
  if (!el) return;
  el.innerHTML = '<div class="card-desc">جارٍ تحميل الأرقام…</div>';

  /* getDocs بدل getCountFromServer — بعض المتصفحات/إضافات الخصوصية تحجب استعلامات العدّ */
  const countOf = path => getDocs(collection(db, path))
    .then(s => s.size).catch(() => '؟');

  const [usersC, mailsC, postsC] = await Promise.all([
    countOf('users'), countOf('mails'), countOf('posts'),
  ]);

  const weeks = allWeeksList();
  let html = `
    <div style="margin-bottom:14px"><button class="btn btn-deep btn-small" id="export-json">⬇️ تنزيل نسخة احتياطية (JSON)</button></div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${usersC}</div><div class="stat-lbl">إجمالي المسجلات</div></div>
      <div class="stat-box"><div class="stat-num">${postsC}</div><div class="stat-lbl">منشورات الحائط</div></div>
      <div class="stat-box"><div class="stat-num">${mailsC}</div><div class="stat-lbl">تركن بريدهن</div></div>
    </div>
    <div class="hello-row" style="margin-bottom:6px;">
      <div class="card-title" style="font-size:1rem; margin:0;">أرقام اللعبة بحسب الأسبوع</div>
      <select id="admin-week-select" class="status-select">
        ${weeks.map((w, i) => `<option value="${w.key}" ${i === 0 ? 'selected' : ''}>${i === 0 ? 'الأسبوع الحالي' : w.label}</option>`).join('')}
      </select>
    </div>
    <div id="week-stats-block" style="margin-bottom:18px"></div>
    <div class="card-title" style="font-size:1rem">البريد الإلكتروني</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-deep btn-small" id="download-mails">⬇️ تنزيل البريد (JSON)</button>
      <button class="btn btn-soft btn-small" id="copy-mails">نسخ الكل كنص</button>
    </div>
    <div class="card-desc" style="margin-top:6px;">لا تُعرض هنا — فقط للتنزيل، حتى لا تحتاجي للتمرير بينها.</div>`;
  el.innerHTML = html;
  document.getElementById('export-json').addEventListener('click', exportBackup);
  document.getElementById('admin-week-select').addEventListener('change', e => renderWeekStats(e.target.value));
  renderWeekStats(weeks[0]?.key || thisWeekKey());

  try {
    const snap = await getDocs(collection(db, 'mails'));
    const rows = snap.docs.map(d => d.data());
    document.getElementById('download-mails').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `play-over-mood-emails-${dateKey(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast(rows.length ? `نُزّل ${rows.length} بريدًا 🤍` : 'لا يوجد بريد بعد');
    });
    document.getElementById('copy-mails').addEventListener('click', async () => {
      await navigator.clipboard.writeText(rows.map(r => r.email).join('\n')).catch(() => {});
      showToast(rows.length ? `نُسخ ${rows.length} بريدًا 🤍` : 'لا يوجد بريد بعد');
    });
  } catch {
    showToast('تعذر تحميل البريد');
  }

  /* أرشيف مهمات الأسابيع الماضية — للمرجعية فقط، لا يراه اللاعبات */
  const archiveEl = document.createElement('div');
  archiveEl.innerHTML = `<div class="card-title" style="font-size:1rem; margin-top:22px;">🗂️ أرشيف مهمات الأسابيع</div>
    <div class="card-desc">مرجع خاص بكِ — لا تراه اللاعبات، حتى لا نثقل على من تنضم متأخرة</div>
    <div id="mission-archive" class="card-desc">جارٍ التحميل…</div>`;
  el.appendChild(archiveEl);
  try {
    const snap = await getDocs(query(collection(db, 'missionHistory'), orderBy('toDate', 'desc'), limit(20)));
    const rows = snap.docs.map(d => d.data());
    const archBox = document.getElementById('mission-archive');
    if (rows.length === 0) {
      archBox.textContent = 'لا يوجد أرشيف بعد — يُحفظ تلقائيًا كل ما تستبدلين مهمة أسبوع بأخرى';
    } else {
      archBox.innerHTML = rows.map(r => {
        const from = r.fromDate ? new Date(r.fromDate).toLocaleDateString('ar', { day: 'numeric', month: 'short' }) : '؟';
        const to = new Date(r.toDate).toLocaleDateString('ar', { day: 'numeric', month: 'short' });
        const stepsLine = (r.steps || []).length ? `<br><span style="color:rgba(74,57,45,.5)">خطوات: ${r.steps.map(esc).join(' · ')}</span>` : '';
        return `<div class="mail-row" style="direction:rtl; flex-direction:column; align-items:flex-start; gap:2px;">
          <strong style="color:var(--deep)">${from} → ${to}</strong>
          <span>${esc(r.text || '(بدون نص)')}</span>${stepsLine}
        </div>`;
      }).join('');
    }
  } catch {
    const archBox = document.getElementById('mission-archive');
    if (archBox) archBox.textContent = 'تعذر تحميل الأرشيف';
  }

  /* إجابات التدبرات والتأملات لهذا الأسبوع */
  const reflectEl = document.createElement('div');
  reflectEl.innerHTML = `<div class="card-title" style="font-size:1rem; margin-top:22px;">📝 إجابات هذا الأسبوع — «${esc(reflectQuestion)}»</div>
    <div id="reflect-answers" class="card-desc">جارٍ التحميل…</div>`;
  el.appendChild(reflectEl);
  try {
    const wk = thisWeekKey();
    const snap = await getDocs(query(collection(db, 'reflections'), where('week', '==', wk)));
    const rows = snap.docs.map(d => d.data()).filter(r => r.text);
    const box = document.getElementById('reflect-answers');
    box.innerHTML = rows.length === 0
      ? 'ما في إجابات بعد هذا الأسبوع'
      : rows.map(r => `<div class="mail-row" style="direction:rtl; flex-direction:column; align-items:flex-start; gap:2px;">
          <strong style="color:var(--deep)">${esc(r.nick)}</strong>
          <span>${esc(r.text)}</span>
        </div>`).join('');
  } catch {
    const box = document.getElementById('reflect-answers');
    if (box) box.textContent = 'تعذر تحميل الإجابات';
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
    const out = { exportedAt: new Date().toISOString(), users: {}, mails: {}, posts: {}, days: {}, weeks: {}, stats: {}, missionHistory: {} };
    out.users = await grab('users');
    out.mails = await grab('mails');
    out.posts = await grab('posts');
    out.days  = await grab('days');
    out.missionHistory = await grab('missionHistory');
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
const TAB_IDS = ['quests', 'growth', 'why', 'wall', 'photos', 'rules', 'features', 'procrastination', 'reflect', 'admin'];

/* طبّقي اللغة أولًا حتى ينسخ تبويب القواعد النسخة الصحيحة */
applyEnglish();
updateWhyTab();

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
