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
  if(!input){ showDebugBanner('عنصر رفع الصورة غير موجود: ' + inputId); return; }
  const label = document.querySelector('label[for="' + inputId + '"]');
  if(!label){ showDebugBanner('ما لقيت label لـ: ' + inputId); return; }
  const preview = label.querySelector('img');
  const placeholder = label.querySelector('.avatar-placeholder');
  input.addEventListener('change', () => {
    try{
      const file = input.files[0];
      if(!file) return;
      onFile(file);
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.style.display = 'block';
      if(placeholder) placeholder.style.display = 'none';
    }catch(err){
      showDebugBanner('فشل عرض الصورة: ' + err.message);
    }
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

/* ===== بروفايل عام — يُشاهد عبر رابط ?u=username، أو من داخل الفيد ===== */
let viewedUserId = null;

async function loadPublicProfile(username){
  const notFound = document.getElementById('publicNotFound');
  const img = document.getElementById('publicAvatarImg');
  const followBtn = document.getElementById('followBtn');
  notFound.style.display = 'none';
  followBtn.style.display = 'none';
  viewedUserId = null;

  if(!supabase){ showDebugBanner('Supabase غير جاهز بعد'); return; }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar')
    .eq('username', username)
    .single();

  if(error || !data){
    document.getElementById('publicUsername').textContent = '@' + username;
    document.getElementById('publicBio').textContent = '';
    img.style.display = 'none';
    notFound.textContent = t('public_not_found');
    notFound.style.display = 'block';
    return;
  }

  viewedUserId = data.id;
  document.getElementById('publicUsername').textContent = '@' + data.username;
  document.getElementById('publicBio').textContent = data.bio || '';
  if(data.avatar && data.avatar.startsWith('http')){
    img.src = data.avatar;
    img.style.display = 'block';
  }else{
    img.style.display = 'none';
  }

  if(currentUserId && currentUserId !== viewedUserId){
    followBtn.style.display = 'flex';
    const { data: followRow } = await supabase
      .from('follows').select('follower_id')
      .eq('follower_id', currentUserId).eq('following_id', viewedUserId)
      .maybeSingle();
    updateFollowBtn(!!followRow);
  }
}

function updateFollowBtn(isFollowing){
  const btn = document.getElementById('followBtn');
  btn.textContent = isFollowing ? t('btn_following') : t('btn_follow');
  btn.classList.toggle('btn-ghost', isFollowing);
  btn.classList.toggle('btn-jumbo', !isFollowing);
}

async function toggleFollow(){
  if(!supabase || !currentUserId || !viewedUserId) return;
  const isFollowing = document.getElementById('followBtn').textContent === t('btn_following');
  if(isFollowing){
    await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', viewedUserId);
    updateFollowBtn(false);
  }else{
    await supabase.from('follows').insert({ follower_id: currentUserId, following_id: viewedUserId });
    updateFollowBtn(true);
  }
}

async function goToUserProfile(username){
  await loadPublicProfile(username);
  goTo('public');
}

function goBackFromPublic(){
  if(currentUserId){ goTo('home'); switchHomeTab('feed'); }
  else{ goTo('welcome'); }
}

function checkPublicProfileLink(){
  const params = new URLSearchParams(window.location.search);
  const username = params.get('u');
  if(username){
    goTo('public');
    loadPublicProfile(username);
    return true;
  }
  return false;
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

async function shareProfileLink(){
  const username = document.getElementById('usernameEditInput').value.trim();
  const hint = document.getElementById('saveHint');
  if(!username){ hint.textContent = t('alert_need_username'); return; }
  const link = window.location.origin + window.location.pathname + '?u=' + encodeURIComponent(username);
  try{
    await navigator.clipboard.writeText(link);
    hint.textContent = t('link_copied');
  }catch(err){
    hint.textContent = link;
  }
  setTimeout(() => { hint.textContent = ''; }, 3500);
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

/* ===== تبديل تبويب البروفايل/المنشورات ===== */
function switchHomeTab(name){
  document.getElementById('tabBtnProfile').classList.toggle('active', name === 'profile');
  document.getElementById('tabBtnFeed').classList.toggle('active', name === 'feed');
  document.getElementById('homeTabProfile').classList.toggle('active', name === 'profile');
  document.getElementById('homeTabFeed').classList.toggle('active', name === 'feed');
  if(name === 'feed') loadFeed();
}

async function loadFeed(){
  if(!supabase) return;
  const list = document.getElementById('postsList');
  list.innerHTML = '<div class="posts-empty">' + t('loading') + '</div>';

  const { data, error } = await supabase
    .from('posts')
    .select('id, content, created_at, profiles(username, avatar)')
    .order('created_at', { ascending: false })
    .limit(50);

  if(error){ list.innerHTML = '<div class="posts-empty">' + t('alert_error') + error.message + '</div>'; return; }
  if(!data || data.length === 0){ list.innerHTML = '<div class="posts-empty">' + t('no_posts') + '</div>'; return; }

  const postIds = data.map(p => p.id);
  const likesByPost = {};
  if(postIds.length){
    const { data: likesData } = await supabase.from('likes').select('post_id, user_id').in('post_id', postIds);
    (likesData || []).forEach(l => {
      if(!likesByPost[l.post_id]) likesByPost[l.post_id] = { count: 0, likedByMe: false };
      likesByPost[l.post_id].count++;
      if(l.user_id === currentUserId) likesByPost[l.post_id].likedByMe = true;
    });
  }

  list.innerHTML = data.map(post => {
    const prof = post.profiles || {};
    const uname = (prof.username || 'مستخدم').replace(/'/g, '');
    const avatar = prof.avatar && prof.avatar.startsWith('http')
      ? '<img class="post-avatar" src="' + prof.avatar + '">'
      : '<div class="post-avatar"></div>';
    const when = timeAgo(post.created_at);
    const safeContent = post.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const like = likesByPost[post.id] || { count: 0, likedByMe: false };
    return '<div class="post-card">' +
      '<div class="post-head" style="cursor:pointer" onclick="goToUserProfile(\'' + uname + '\')">' + avatar +
      '<span class="post-username">@' + uname + '</span>' +
      '<span class="post-time">' + when + '</span></div>' +
      '<div class="post-content">' + safeContent + '</div>' +
      '<button class="like-btn' + (like.likedByMe ? ' liked' : '') + '" onclick="toggleLike(\'' + post.id + '\', this)">' +
        '<span class="like-heart">' + (like.likedByMe ? '❤️' : '🤍') + '</span>' +
        '<span class="like-count">' + like.count + '</span>' +
      '</button></div>';
  }).join('');
}

async function toggleLike(postId, btnEl){
  if(!supabase || !currentUserId) return;
  const heart = btnEl.querySelector('.like-heart');
  const countEl = btnEl.querySelector('.like-count');
  const isLiked = btnEl.classList.contains('liked');

  btnEl.classList.toggle('liked', !isLiked);
  heart.textContent = !isLiked ? '❤️' : '🤍';
  countEl.textContent = (parseInt(countEl.textContent) || 0) + (!isLiked ? 1 : -1);

  if(isLiked){
    await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
  }else{
    await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
  }
}

function timeAgo(dateStr){
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if(diff < 60) return t('time_now');
  if(diff < 3600) return Math.floor(diff / 60) + t('time_min');
  if(diff < 86400) return Math.floor(diff / 3600) + t('time_hour');
  return Math.floor(diff / 86400) + t('time_day');
}

async function submitPost(){
  if(!supabase || !currentUserId) return;
  const input = document.getElementById('postInput');
  const content = input.value.trim();
  if(!content) return;

  const { error } = await supabase.from('posts').insert({ user_id: currentUserId, content });
  if(error){ alert(t('alert_error') + error.message); return; }

  input.value = '';
  loadFeed();
}

function goTo(name){
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if(panel) panel.classList.add('active');
  document.querySelector('.moon-shadow').style.setProperty('--moon-dx', moonPhase[name] || '10px');
  document.getElementById('backBtn').classList.toggle('show', name === 'email');
  if(name === 'home'){ loadProfile(); switchHomeTab('profile'); }
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
    btn_back_app:"رجوع للتطبيق", public_not_found:"ما فيه مستخدم بهذا الاسم",
    btn_share_profile:"نسخ رابط بروفايلي", link_copied:"تم نسخ الرابط ✓",
    tab_profile:"البروفايل", tab_feed:"المنشورات", ph_post:"وش بخاطرك؟", btn_post:"نشر",
    btn_follow:"متابعة", btn_following:"متابَع ✓",
    loading:"جاري التحميل...", no_posts:"ولا منشور بعد، كن أول من ينشر!",
    time_now:"الآن", time_min:"د", time_hour:"س", time_day:"ي",
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
    btn_back_app:"Back to app", public_not_found:"No user with this name",
    btn_share_profile:"Copy my profile link", link_copied:"Link copied ✓",
    tab_profile:"Profile", tab_feed:"Posts", ph_post:"What's on your mind?", btn_post:"Post",
    btn_follow:"Follow", btn_following:"Following ✓",
    loading:"Loading...", no_posts:"No posts yet, be the first!",
    time_now:"now", time_min:"m", time_hour:"h", time_day:"d",
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
    if(!checkPublicProfileLink()){
      supabase.auth.getSession().then(({ data: { session } }) => {
        if(session) goTo('home');
      });
    }
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
