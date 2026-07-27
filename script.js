/* ===== شريط أخطاء مؤقت يظهر على الشاشة (عشان الجوال ما فيه Console سهل) ===== */
window.addEventListener('error', function(e){
  showDebugBanner('خطأ: ' + e.message + ' (سطر ' + e.lineno + ')');
});
function showDebugBanner(msg){
  let b = document.getElementById('debugBanner');
  if(!b){
    b = document.createElement('div');
    b.id = 'debugBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff3b3b;color:#fff;padding:10px;font-size:12px;z-index:9999;direction:ltr;text-align:left;';
    document.body.appendChild(b);
  }
  b.textContent = msg;
}

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

/* ===== اختيار صورة البروفايل (يشتغل بخطوة التسجيل وصفحة البروفايل) ===== */
let selectedAvatarFile = null;
let selectedAvatarFileHome = null;

function setupAvatarUploader(inputId, onFile){
  const input = document.getElementById(inputId);
  if(!input) return;
  const label = document.querySelector('label[for="' + inputId + '"]');
  const preview = label.querySelector('img');
  const placeholder = label.querySelector('.avatar-placeholder');
  input.addEventListener('change', () => {
    const file = input.files[0];
    if(!file) return;
    onFile(file);
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    if(placeholder) placeholder.style.display = 'none';
  });
}

function setupAvatarUpload(){
  setupAvatarUploader('avatarFileInput', file => { selectedAvatarFile = file; });
  setupAvatarUploader('avatarFileInputHome', file => { selectedAvatarFileHome = file; });
}

/* ===== رفع صورة لتخزين Supabase، يرجع الرابط العام ===== */
async function uploadAvatarFile(file, userId){
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = userId + '/' + Date.now() + '.' + ext;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if(error) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

/* ===== صفحة البروفايل: تحميل وحفظ ===== */
let selectedAvatar = '🌙';
let currentUserId = null;

async function loadProfile(){
  if(!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return;
  currentUserId = user.id;

  const { data, error } = await supabase
    .from('profiles')
    .select('username, bio, avatar')
    .eq('id', user.id)
    .single();

  if(error){ console.error('loadProfile error:', error); return; }

  document.getElementById('usernameEditInput').value = data.username || '';
  document.getElementById('bioInput').value = data.bio || '';

  const preview = document.getElementById('avatarPreviewHome');
  const placeholder = document.querySelector('label[for="avatarFileInputHome"] .avatar-placeholder');
  if(data.avatar && data.avatar.startsWith('http')){
    preview.src = data.avatar;
    preview.style.display = 'block';
    if(placeholder) placeholder.style.display = 'none';
  }else{
    preview.style.display = 'none';
    if(placeholder) placeholder.style.display = 'block';
  }
}

async function saveProfile(){
  if(!supabase || !currentUserId) return;
  const username = document.getElementById('usernameEditInput').value.trim();
  const bio = document.getElementById('bioInput').value.trim();
  const hint = document.getElementById('saveHint');

  if(!username){ hint.textContent = t('alert_need_username'); return; }

  const updates = { username, bio };
  if(selectedAvatarFileHome){
    const url = await uploadAvatarFile(selectedAvatarFileHome, currentUserId);
    if(url) updates.avatar = url;
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', currentUserId);
  if(!error) await supabase.auth.updateUser({ data: { username } });

  hint.textContent = error ? (t('alert_error') + error.message) : t('saved_ok');
  if(!error) setTimeout(() => { hint.textContent = ''; }, 2500);
}

/* ===== التنقل بين الشاشات + حالة القمر — مستقل تمامًا عن Supabase ===== */
const moonPhase = { welcome:'10px', email:'24px', sent:'40px', profile:'56px', home:'80px' };

function goTo(name){
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if(panel) panel.classList.add('active');
  document.querySelector('.moon-shadow').style.setProperty('--moon-dx', moonPhase[name] || '10px');
  document.getElementById('backBtn').classList.toggle('show', name === 'email');
  if(name === 'home') loadProfile();
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
    label_bio:"نبذة عنك", ph_bio:"اكتب نبذة قصيرة...", btn_save_profile:"حفظ البروفايل", saved_ok:"تم الحفظ ✓",
    alert_need_username:"اكتب اسم المستخدم",
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
    label_bio:"About you", ph_bio:"Write a short bio...", btn_save_profile:"Save profile", saved_ok:"Saved ✓",
    alert_need_username:"Enter a username",
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
    if(!window.supabase || !window.supabase.createClient){
      showDebugBanner('مكتبة Supabase تحمّلت لكن بصيغة غير متوقعة');
      return;
    }
    const SUPABASE_URL = "https://olqbxnppgpcxflnuowzu.supabase.co";
    const SUPABASE_KEY = "sb_publishable_r6pHno2nYyUiwMQzhci0Jg_quQI9aFS";
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    supabase.auth.onAuthStateChange((event, session) => {
      if(event === 'SIGNED_IN' && session) goTo('profile');
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if(session) goTo('home');
    });
  }catch(err){
    console.error('Supabase init failed:', err);
    showDebugBanner('فشل تهيئة Supabase: ' + err.message);
  }
}

async function signInWithGoogle(){
  if(!supabase){
    alert('مكتبة الاتصال (Supabase) ما تحمّلت بعد. جرب: 1) تأكد من اتصال الإنترنت 2) أوقف أي حاجب إعلانات 3) حدّث الصفحة وانتظر ثانيتين قبل ما تضغط الزر');
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if(error){ alert(t('alert_error') + error.message); }
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

    const { data: { user } } = await supabase.auth.getUser();
    let avatarUrl = null;

    if(selectedAvatarFile && user){
      avatarUrl = await uploadAvatarFile(selectedAvatarFile, user.id);
    }

    if(user){
      const updates = { username };
      if(avatarUrl) updates.avatar = avatarUrl;
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }
  }catch(err){ alert(t('alert_error') + err.message); return; }
  goTo('home');
}

/* ===== التشغيل عند تحميل الصفحة ===== */
buildStars();
setupAvatarUpload();
applyLang('ar');
applyTheme('dark');
goTo('welcome');
