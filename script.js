/* ===== توليد النجوم المتلألئة عشوائيًا ===== */
function buildStars(){
  const wrap = document.getElementById('stars');
  const count = 45;
  for(let i = 0; i < count; i++){
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 55 + '%';
    s.style.animationDelay = (Math.random() * 3) + 's';
    s.style.animationDuration = (2 + Math.random() * 3) + 's';
    wrap.appendChild(s);
  }
}

/* ===== التنقل بين الشاشات + حالة القمر — مستقل تمامًا عن Supabase ===== */
const moonPhase = { welcome:'10px', email:'24px', sent:'40px', profile:'56px', home:'80px' };

function goTo(name){
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if(panel) panel.classList.add('active');
  document.querySelector('.moon-shadow').style.setProperty('--moon-dx', moonPhase[name] || '10px');
  document.getElementById('backBtn').classList.toggle('show', name === 'email');
}

/* ===== اللغة والثيم ===== */
const translations = {
  ar: {
    eyebrow_welcome:"مرحبًا بك", title_welcome:"شمسك تشرق<br>من جديد",
    subtitle_welcome:"سجّل دخولك وابدأ رحلتك معنا",
    hint_terms:"بالمتابعة، أنت توافق على الشروط وسياسة الخصوصية",
    eyebrow_step1:"الخطوة الأولى", title_email:"أدخل بريدك<br>الإلكتروني",
    btn_send:"إرسال رابط التوثيق", divider_or:"أو تابع عبر", btn_google:"تسجيل عبر Google",
    title_sent:"تحقق من بريدك", subtitle_sent_pre:"أرسلنا رابط توثيق إلى",
    subtitle_sent_post:"افتحه لتأكيد حسابك",
    hint_sent:"هذي الصفحة بتتحدث تلقائيًا لما توثق الرابط<br>(لا تحتاج تسوي شي هنا)",
    eyebrow_step2:"الخطوة الأخيرة", title_profile:"أكمل حسابك",
    btn_create:"إنشاء الحساب", title_home:"أهلًا بك مجددًا",
    pill_session:"الجلسة محفوظة تلقائيًا",
    hint_home:"في المرة القادمة، بيفتح التطبيق مباشرة على حسابك<br>بدون ما تسجل دخول من جديد",
    btn_logout:"تسجيل خروج (لإعادة العرض)", ph_username:"اسم المستخدم",
    alert_need_email:"اكتب إيميلك أول", alert_error:"صار خطأ: ",
    alert_need_profile:"اكتب اسم مستخدم وباسورد لا يقل عن 6 أحرف"
  },
  en: {
    eyebrow_welcome:"Welcome", title_welcome:"Your sunrise<br>begins here",
    subtitle_welcome:"Sign in and start your journey",
    hint_terms:"By continuing, you agree to the Terms and Privacy Policy",
    eyebrow_step1:"Step One", title_email:"Enter your<br>email",
    btn_send:"Send verification link", divider_or:"or continue with", btn_google:"Continue with Google",
    title_sent:"Check your email", subtitle_sent_pre:"We sent a verification link to",
    subtitle_sent_post:"Open it to confirm your account",
    hint_sent:"This page updates automatically once verified<br>(no action needed here)",
    eyebrow_step2:"Last Step", title_profile:"Complete your account",
    btn_create:"Create account", title_home:"Welcome back",
    pill_session:"Session saved automatically",
    hint_home:"Next time, the app opens straight to your account<br>no need to sign in again",
    btn_logout:"Sign out (replay demo)", ph_username:"Username",
    alert_need_email:"Enter your email first", alert_error:"Something went wrong: ",
    alert_need_profile:"Enter a username and a password of at least 6 characters"
  }
};

let currentLang = 'ar';
let currentTheme = 'dark';
function t(key){ return translations[currentLang][key] || key; }

function applyLang(lang){
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(translations[lang][key] !== undefined) el.innerHTML = translations[lang][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if(translations[lang][key] !== undefined) el.placeholder = translations[lang][key];
  });
  document.getElementById('langBtn').textContent = lang === 'ar' ? 'EN' : 'AR';
}
function toggleLang(){ applyLang(currentLang === 'ar' ? 'en' : 'ar'); }

function applyTheme(theme){
  currentTheme = theme;
  document.body.classList.toggle('light', theme === 'light');
  document.getElementById('themeBtn').textContent = theme === 'light' ? '🌙' : '☀️';
}
function toggleTheme(){ applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); }

/* ===== Supabase — بمحاولة منفصلة، لو فشلت ما توقف باقي الموقع ===== */
let supabase = null;
function initSupabase(){
  try{
    const SUPABASE_URL = "https://olqbxnppgpcxflnuowzu.supabase.co";
    const SUPABASE_KEY = "sb_publishable_r6pHno2nYyUiwMQzhci0Jg_quQI9aFS";
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    supabase.auth.onAuthStateChange((event, session) => {
      if(event === 'SIGNED_IN' && session) goTo('profile');
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if(session) goTo('home');
    });
  }catch(err){ console.error('Supabase init failed:', err); }
}

async function sendLink(){
  const val = document.getElementById('emailInput').value.trim();
  if(!val){ alert(t('alert_need_email')); return; }
  document.getElementById('sentEmail').textContent = val;
  goTo('sent');
  if(!supabase){ console.warn('Supabase not ready'); return; }
  try{
    const { error } = await supabase.auth.signInWithOtp({
      email: val, options:{ emailRedirectTo: window.location.href }
    });
    if(error){ alert(t('alert_error') + error.message); goTo('email'); }
  }catch(err){ alert(t('alert_error') + err.message); goTo('email'); }
}

async function completeProfile(){
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  if(!username || password.length < 6){ alert(t('alert_need_profile')); return; }
  if(!supabase){ goTo('home'); return; }
  try{
    const { error } = await supabase.auth.updateUser({ password, data:{ username } });
    if(error){ alert(t('alert_error') + error.message); return; }
  }catch(err){ alert(t('alert_error') + err.message); return; }
  goTo('home');
}

/* ===== التشغيل عند تحميل الصفحة ===== */
buildStars();
applyLang('ar');
applyTheme('dark');
goTo('welcome');
