const __volatileStore = new Map();
function getSharedDatabase(){
  try { if(window.parent && window.parent !== window && window.parent.AppDB) return window.parent.AppDB; } catch(e) {}
  return null;
}
const safeLocalStorage = {
  getItem(key){
    if(__volatileStore.has(key)) return __volatileStore.get(key);
    try { const db=getSharedDatabase(); return db ? db.getRaw(key) : window.localStorage.getItem(key); }
    catch(e) { return null; }
  },
  setItem(key, value){
    const v = String(value);
    try { const db=getSharedDatabase(); if(db) db.setRaw(key,v); else window.localStorage.setItem(key,v); }
    catch(e) { __volatileStore.set(key, v); }
  },
  removeItem(key){
    try { const db=getSharedDatabase(); if(db) db.removeRaw(key); else window.localStorage.removeItem(key); } catch(e) {}
    __volatileStore.delete(key);
  }
};

const STORAGE_BOOKMARKS = 'pharm_flashcards_bookmarks_v1';
const PATTERNS = [
  { key:'sales_to_generic', label:'販売名 → 一般名', ask:'salesName', ans:'genericName' },
  { key:'generic_to_sales', label:'一般名 → 販売名', ask:'genericName', ans:'salesName' },
  { key:'sales_to_effect', label:'販売名 → 薬効', ask:'salesName', ans:'effect' },
  { key:'effect_to_sales', label:'薬効 → 販売名', ask:'effect', ans:'salesName' },
  { key:'generic_to_effect', label:'一般名 → 薬効', ask:'genericName', ans:'effect' },
  { key:'effect_to_generic', label:'薬効 → 一般名', ask:'effect', ans:'genericName' },
];
const COLOR_OPTIONS = ['amber','emerald','sky','violet','rose','slate'];

const els = {
  homeScreen:document.getElementById('homeScreen'),
  quizScreen:document.getElementById('quizScreen'),
  dataInput:document.getElementById('dataInput'),
  loadBtn:document.getElementById('loadBtn'),
  startBtn:document.getElementById('startBtn'),
  bookmarkedOnlyStart:document.getElementById('bookmarkedOnlyStart'),
  toggleBookmarkListBtn:document.getElementById('toggleBookmarkListBtn'),
  clearBookmarksBtn:document.getElementById('clearBookmarksBtn'),
  homeBtnTop:document.getElementById('homeBtnTop'),
  endBtn:document.getElementById('endBtn'),
  mainActionBtn:document.getElementById('mainActionBtn'),
  prevBtn:document.getElementById('prevBtn'),
  nextBtn:document.getElementById('nextBtn'),
  toggleBookmarkOnlyBtn:document.getElementById('toggleBookmarkOnlyBtn'),
  questionText:document.getElementById('questionText'),
  patternText:document.getElementById('patternText'),
  answerTitle:document.getElementById('answerTitle'),
  answerMeta:document.getElementById('answerMeta'),
  answerText:document.getElementById('answerText'),
  srcSales:document.getElementById('srcSales'),
  srcGeneric:document.getElementById('srcGeneric'),
  srcEffect:document.getElementById('srcEffect'),
  quizCounter:document.getElementById('quizCounter'),
  progressFill:document.getElementById('progressFill'),
  flashcard:document.getElementById('flashcard'),
  bookmarkBtn:document.getElementById('bookmarkBtn'),
  bookmarkBtnBack:document.getElementById('bookmarkBtnBack'),
  bookmarkMenu:document.getElementById('bookmarkMenu'),
  bookmarkMenuSwatches:document.getElementById('bookmarkMenuSwatches'),
  bookmarkMenuCloseBtn:document.getElementById('bookmarkMenuCloseBtn'),
  bookmarkMenuSaveBtn:document.getElementById('bookmarkMenuSaveBtn'),
  bookmarkCountBadge:document.getElementById('bookmarkCountBadge'),
  bookmarkHomeArea:document.getElementById('bookmarkHomeArea'),
  loadStatus:document.getElementById('loadStatus'),
  patternList:document.getElementById('patternList'),
};

const state = {
  items: [],
  selectedPatterns: new Set(PATTERNS.map(p=>p.key)),
  questions: [],
  currentIndex: 0,
  flipped: false,
  currentQuestion: null,
  bookmarks: loadBookmarks(),
  showBookmarkList: true,
  bookmarkOnlySession: false,
  bookmarkDraftColor: 'sky',
  bookmarkMenuOpen: false,
  cardTransitionLocked: false,
};

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function showScreen(name){
  if(name==='home'){
    try{ if(window.parent && window.parent !== window && window.parent.AppShell){ window.parent.AppShell.returnToMenu('flashcards'); return; } }catch(e){}
  }
  [els.homeScreen, els.quizScreen].forEach(el=>el.classList.remove('active'));
  if(name==='home') els.homeScreen.classList.add('active');
  if(name==='quiz') els.quizScreen.classList.add('active');
  if(name==='home') renderHome();
}

function splitLines(text){
  return String(text || '').replaceAll('\r','\n').split('\n').map(s=>s.trim()).filter(Boolean);
}

function parseRows(text){
  const rows = splitLines(text);
  const items = [];
  for(const row of rows){
    const i1 = row.indexOf(',');
    if(i1 < 0) continue;
    const i2 = row.indexOf(',', i1 + 1);
    if(i2 < 0) continue;
    const salesName = row.slice(0, i1).trim();
    const genericName = row.slice(i1 + 1, i2).trim();
    const effect = row.slice(i2 + 1).trim();
    if(salesName && genericName && effect) items.push({ salesName, genericName, effect });
  }
  return dedupeRows(items);
}

function rowKey(item){
  return [item.salesName, item.genericName, item.effect].join('\u0001');
}

function dedupeRows(items){
  const map = new Map();
  for(const item of items){
    const key = rowKey(item);
    if(!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function splitByCommaOnly(value){
  return String(value ?? '').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
}

function displayJoined(value){
  const parts = [...new Set(splitByCommaOnly(value))];
  return parts.length ? parts.join(' / ') : '-';
}

function normalizeText(value){
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function loadBookmarks(){
  try{
    const raw = JSON.parse(safeLocalStorage.getItem(STORAGE_BOOKMARKS) || '[]');
    return Array.isArray(raw) ? raw : [];
  }catch{
    return [];
  }
}

function saveBookmarks(){
  safeLocalStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify(state.bookmarks));
}

function bookmarkKey(item, patternKey){
  return [rowKey(item), patternKey].join('::');
}

function getSelectedPatterns(){
  return PATTERNS.filter(p=>state.selectedPatterns.has(p.key));
}

function renderPatternCheckboxes(){
  els.patternList.innerHTML = '';
  PATTERNS.forEach(p=>{
    const label = document.createElement('label');
    label.className = 'check';
    label.innerHTML = `
      <input type="checkbox" ${state.selectedPatterns.has(p.key) ? 'checked' : ''} data-pattern="${p.key}">
      <div><b>${escapeHtml(p.label)}</b><span>この方向で出題します</span></div>
    `;
    els.patternList.appendChild(label);
  });
  els.patternList.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const key = cb.getAttribute('data-pattern');
      if(cb.checked) state.selectedPatterns.add(key);
      else state.selectedPatterns.delete(key);
    });
  });
}

function buildQuestions(items, patterns){
  if(!items.length) throw new Error('問題の元データがありません。');
  if(!patterns.length) throw new Error('出題パターンを1つ以上選んでください。');
  if(state.bookmarkOnlySession){
    const bookmarked = state.bookmarks
      .filter(b => patterns.some(p => p.key === b.patternKey))
      .map(b => ({ item: b.item, pattern: patterns.find(p => p.key === b.patternKey) || PATTERNS[0], fromBookmark: true }))
      .sort(()=>Math.random() - 0.5);
    if(!bookmarked.length) throw new Error('ブックマークされたカードがありません。');
    return bookmarked;
  }
  const shuffled = [...items].sort(()=>Math.random() - 0.5);
  return shuffled.map(item=>({
    item,
    pattern: patterns[Math.floor(Math.random() * patterns.length)]
  }));
}

function isBookmarked(item, patternKey){
  return state.bookmarks.some(b => b.key === bookmarkKey(item, patternKey));
}

function getBookmark(item, patternKey){
  return state.bookmarks.find(b => b.key === bookmarkKey(item, patternKey)) || null;
}

function setBookmarkColor(item, patternKey, color){
  const key = bookmarkKey(item, patternKey);
  const existing = state.bookmarks.find(b => b.key === key);
  if(existing){
    existing.color = color;
    existing.updatedAt = new Date().toISOString();
  }else{
    state.bookmarks.unshift({
      key,
      color,
      item,
      patternKey,
      patternLabel: PATTERNS.find(p=>p.key === patternKey)?.label || patternKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  saveBookmarks();
}

function removeBookmark(item, patternKey){
  const key = bookmarkKey(item, patternKey);
  state.bookmarks = state.bookmarks.filter(b => b.key !== key);
  saveBookmarks();
}

function toggleBookmark(item, patternKey){
  const existing = getBookmark(item, patternKey);
  if(existing) removeBookmark(item, patternKey);
  else setBookmarkColor(item, patternKey, state.bookmarkDraftColor || 'sky');
}


function renderBookmarkMenu(){
  els.bookmarkMenuSwatches.innerHTML = '';
  COLOR_OPTIONS.forEach(color=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch' + (state.bookmarkDraftColor === color ? ' active' : '');
    btn.dataset.color = color;
    btn.title = color;
    btn.addEventListener('click', ()=>{
      state.bookmarkDraftColor = color;
      renderBookmarkMenu();
    });
    els.bookmarkMenuSwatches.appendChild(btn);
  });
}

function openBookmarkMenu(){
  if(!state.currentQuestion) return;
  const bm = getBookmark(state.currentQuestion.item, state.currentQuestion.pattern.key);
  state.bookmarkDraftColor = bm?.color || state.bookmarkDraftColor || 'sky';
  state.bookmarkMenuOpen = true;
  els.bookmarkMenu.hidden = false;
  renderBookmarkMenu();
}

function closeBookmarkMenu(){
  state.bookmarkMenuOpen = false;
  els.bookmarkMenu.hidden = true;
}

function saveBookmarkFromMenu(){
  if(!state.currentQuestion) return;
  setBookmarkColor(state.currentQuestion.item, state.currentQuestion.pattern.key, state.bookmarkDraftColor || 'sky');
  closeBookmarkMenu();
  updateBookmarkUI();
  renderHome();
}

function updateBookmarkUI(){
  if(!state.currentQuestion) return;
  const bm = getBookmark(state.currentQuestion.item, state.currentQuestion.pattern.key);
  const saved = !!bm;
  const color = bm?.color || state.bookmarkDraftColor || 'sky';
  els.bookmarkBtn.classList.toggle('saved', saved);
  els.bookmarkBtnBack.classList.toggle('saved', saved);
  els.bookmarkBtn.title = saved ? `保存済み (${color})` : '未保存';
  els.bookmarkBtnBack.title = saved ? `保存済み (${color})` : '未保存';
  if(saved) state.bookmarkDraftColor = color;
  renderBookmarkMenu();
}
function prepareSession(){
  const loaded = parseRows(els.dataInput.value);
  if(loaded.length) state.items = loaded;
  const patterns = getSelectedPatterns();
  if(!state.items.length){
    alert('データが読み込まれていません。販売名,一般名,薬効を貼り付けて読み込んでください。');
    return false;
  }
  if(!patterns.length){
    alert('出題パターンを1つ以上選んでください。');
    return false;
  }
  state.questions = buildQuestions(state.items, patterns);
  if(state.bookmarkOnlySession && !state.questions.length){
    alert('ブックマークされたカードがありません。');
    return false;
  }
  state.currentIndex = 0;
  state.flipped = false;
  state.currentQuestion = null;
  return true;
}

function startSession(){
  state.bookmarkOnlySession = els.bookmarkedOnlyStart.checked;
  if(!prepareSession()) return;
  showScreen('quiz');
  renderCard();
  updateActionButtonState();
}

function setCardFaceInstantly(flipped = false){
  state.cardTransitionLocked = true;
  els.flashcard.classList.add('no-transition');
  els.flashcard.classList.toggle('flipped', flipped);
  void els.flashcard.offsetHeight;
  requestAnimationFrame(() => {
    els.flashcard.classList.remove('no-transition');
    state.cardTransitionLocked = false;
  });
}

function renderCard(){
  const q = state.questions[state.currentIndex];
  if(!q) return;
  state.currentQuestion = q;
  state.flipped = false;
  setCardFaceInstantly(false);
  closeBookmarkMenu();
  els.quizCounter.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
  els.progressFill.style.width = `${(state.currentIndex / state.questions.length) * 100}%`;
  els.questionText.textContent = displayJoined(q.item[q.pattern.ask]);
  els.patternText.textContent = q.pattern.label;
  els.answerTitle.textContent = displayJoined(q.item[q.pattern.ans]);
  els.answerMeta.textContent = `出題元: ${displayJoined(q.pattern.ask)} → ${displayJoined(q.pattern.ans)}`;
  els.srcSales.textContent = displayJoined(q.item.salesName);
  els.srcGeneric.textContent = displayJoined(q.item.genericName);
  els.srcEffect.textContent = displayJoined(q.item.effect);
  updateBookmarkUI();
  updateActionButtonState();
}

function updateActionButtonState(){
  const hasQuestion = !!state.currentQuestion;
  els.mainActionBtn.disabled = !hasQuestion || state.flipped;
  els.mainActionBtn.textContent = '裏返す';
  els.mainActionBtn.classList.remove('next');
  els.mainActionBtn.classList.add('flip');

  els.prevBtn.disabled = !hasQuestion || state.currentIndex <= 0;
  els.nextBtn.disabled = !hasQuestion;
  els.nextBtn.textContent = (hasQuestion && state.currentIndex >= state.questions.length - 1) ? '終了' : '次へ進む';
}

function flipCard(){
  if(!state.currentQuestion) return;
  state.flipped = !state.flipped;
  els.flashcard.classList.toggle('flipped', state.flipped);
  updateActionButtonState();
}

function goPrevCard(){
  if(!state.currentQuestion || state.currentIndex <= 0) return;
  state.currentIndex -= 1;
  renderCard();
}

function goNextCard(){
  if(!state.currentQuestion) return;
  if(state.currentIndex >= state.questions.length - 1){
    finishSession();
    return;
  }
  state.currentIndex += 1;
  renderCard();
}

function finishSession(){
  state.currentQuestion = null;
  state.flipped = false;
  setCardFaceInstantly(false);
  alert('セッションを終了しました。');
  showScreen('home');
}

function renderBookmarkList(){
  const list = [...state.bookmarks].slice(0, 200);
  els.bookmarkCountBadge.textContent = `${list.length}件`;
  els.bookmarkHomeArea.innerHTML = '';
  if(!list.length){
    els.bookmarkHomeArea.innerHTML = '<div class="muted">まだブックマークはありません。</div>';
    return;
  }
  for(const b of list){
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="itemTop">
        <div class="itemTitle">${escapeHtml(b.patternLabel || '問題')}</div>
        <span class="badge bookmarked"><span class="dot ${escapeHtml(b.color || 'sky')}"></span>${escapeHtml(b.color || 'sky')}</span>
      </div>
      <div class="itemMeta">問題: ${escapeHtml(displayJoined(b.item?.[PATTERNS.find(p=>p.key===b.patternKey)?.ask || 'salesName']))}</div>
      <div class="itemMeta">答え: <b>${escapeHtml(displayJoined(b.item?.[PATTERNS.find(p=>p.key===b.patternKey)?.ans || 'genericName']))}</b></div>
      <div class="itemMeta">販売名: ${escapeHtml(displayJoined(b.item?.salesName))} / 一般名: ${escapeHtml(displayJoined(b.item?.genericName))} / 薬効: ${escapeHtml(displayJoined(b.item?.effect))}</div>
      <div class="row" style="margin-top:10px;">
        <button class="btn secondary" data-bookmark-edit="${escapeHtml(b.key)}">色を編集</button>
        <button class="btn danger" data-bookmark-remove="${escapeHtml(b.key)}">削除</button>
      </div>
    `;
    els.bookmarkHomeArea.appendChild(item);
  }
  els.bookmarkHomeArea.querySelectorAll('[data-bookmark-edit]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key = btn.getAttribute('data-bookmark-edit');
      const bm = state.bookmarks.find(x=>x.key === key);
      if(!bm) return;
      const color = prompt('ブックマーク色を入力してください (amber / emerald / sky / violet / rose / slate)', bm.color || 'sky');
      if(!color) return;
      if(!COLOR_OPTIONS.includes(color.trim())){
        alert('指定できる色は amber / emerald / sky / violet / rose / slate です。');
        return;
      }
      bm.color = color.trim();
      bm.updatedAt = new Date().toISOString();
      saveBookmarks();
      renderHome();
      if(state.currentQuestion && bookmarkKey(state.currentQuestion.item, state.currentQuestion.pattern.key) === key){
        updateBookmarkUI();
      }
    });
  });
  els.bookmarkHomeArea.querySelectorAll('[data-bookmark-remove]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key = btn.getAttribute('data-bookmark-remove');
      state.bookmarks = state.bookmarks.filter(x=>x.key !== key);
      saveBookmarks();
      renderHome();
      if(state.currentQuestion && bookmarkKey(state.currentQuestion.item, state.currentQuestion.pattern.key) === key){
        updateBookmarkUI();
      }
    });
  });
}

function renderHome(){
  const loadedCount = state.items.length;
  els.loadStatus.textContent = loadedCount ? `${loadedCount}件のデータを読み込み済み` : '未読み込み';
  els.toggleBookmarkListBtn.textContent = state.showBookmarkList ? '表示 / 非表示' : '表示 / 非表示';
  els.bookmarkCountBadge.textContent = `${state.bookmarks.length}件`;
  if(state.showBookmarkList) renderBookmarkList();
  else els.bookmarkHomeArea.innerHTML = '<div class="muted">一覧は非表示です。「表示 / 非表示」で開けます。</div>';
}

function loadData(){
  state.items = parseRows(els.dataInput.value);
  els.loadStatus.textContent = state.items.length ? `${state.items.length}件のデータを読み込みました` : '読み込み失敗: 3列のデータが見つかりません';
  renderHome();
}

function handleMainAction(){
  if(!state.currentQuestion) return;
  flipCard();
}

function clearBookmarks(){
  if(!confirm('ブックマークをすべて消去しますか？')) return;
  state.bookmarks = [];
  saveBookmarks();
  renderHome();
  updateBookmarkUI();
}

function endSession(){
  if(confirm('セッションを終了してホームに戻りますか？')){
    finishSession();
  }
}

document.addEventListener('keydown', e=>{
  if(!els.quizScreen.classList.contains('active')) return;
  if(e.key === 'Enter'){
    e.preventDefault();
    flipCard();
  }else if(e.key === 'ArrowLeft'){
    e.preventDefault();
    goPrevCard();
  }else if(e.key === 'ArrowRight'){
    e.preventDefault();
    goNextCard();
  }
});

els.loadBtn.addEventListener('click', loadData);
els.startBtn.addEventListener('click', startSession);
els.toggleBookmarkListBtn.addEventListener('click', ()=>{
  state.showBookmarkList = !state.showBookmarkList;
  renderHome();
});
els.clearBookmarksBtn.addEventListener('click', clearBookmarks);
els.homeBtnTop.addEventListener('click', ()=>showScreen('home'));
els.endBtn.addEventListener('click', endSession);
els.mainActionBtn.addEventListener('click', handleMainAction);
els.flashcard.addEventListener('click', ()=>{
  if(!state.currentQuestion) return;
  flipCard();
});
els.prevBtn.addEventListener('click', goPrevCard);
els.nextBtn.addEventListener('click', goNextCard);
els.bookmarkBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  if(!state.currentQuestion) return;
  if(state.bookmarkMenuOpen) closeBookmarkMenu();
  else openBookmarkMenu();
});
els.bookmarkBtnBack.addEventListener('click', (e)=>{
  e.stopPropagation();
  if(!state.currentQuestion) return;
  if(state.bookmarkMenuOpen) closeBookmarkMenu();
  else openBookmarkMenu();
});
els.bookmarkMenuCloseBtn.addEventListener('click', closeBookmarkMenu);
els.bookmarkMenuSaveBtn.addEventListener('click', saveBookmarkFromMenu);
document.addEventListener('click', e=>{
  if(!state.bookmarkMenuOpen) return;
  const clickedInside = els.bookmarkMenu.contains(e.target) || els.bookmarkBtn.contains(e.target) || els.bookmarkBtnBack.contains(e.target);
  if(!clickedInside) closeBookmarkMenu();
});
els.toggleBookmarkOnlyBtn.addEventListener('click', ()=>{
  state.bookmarkOnlySession = !state.bookmarkOnlySession;
  els.bookmarkedOnlyStart.checked = state.bookmarkOnlySession;
  els.toggleBookmarkOnlyBtn.textContent = `保存済みのみで開始: ${state.bookmarkOnlySession ? 'ON' : 'OFF'}`;
});


renderPatternCheckboxes();
renderBookmarkMenu();
els.toggleBookmarkOnlyBtn.textContent = `保存済みのみで開始: ${state.bookmarkOnlySession ? 'ON' : 'OFF'}`;
renderHome();

window.appBridge = {
  setSetup(data, patterns){
    els.dataInput.value = String(data || '');
    state.selectedPatterns = new Set(patterns || PATTERNS.map(p=>p.key));
    renderPatternCheckboxes();
    loadData();
    return state.items.length;
  },
  launch(data, patterns, bookmarkedOnly){
    this.setSetup(data, patterns);
    els.bookmarkedOnlyStart.checked = !!bookmarkedOnly;
    state.bookmarkOnlySession = !!bookmarkedOnly;
    startSession();
  },
  refresh(){ renderHome(); },
  getBookmarks(){ return state.bookmarks.map(b=>JSON.parse(JSON.stringify(b))); },
  editBookmark(key, color){
    if(!COLOR_OPTIONS.includes(color)) return false;
    const bm = state.bookmarks.find(x=>x.key===key);
    if(!bm) return false;
    bm.color = color; bm.updatedAt = new Date().toISOString();
    saveBookmarks(); renderHome(); updateBookmarkUI(); return true;
  },
  removeBookmark(key){
    state.bookmarks = state.bookmarks.filter(x=>x.key!==key);
    saveBookmarks(); renderHome(); updateBookmarkUI();
  },
  clearBookmarks(){ state.bookmarks=[]; saveBookmarks(); renderHome(); updateBookmarkUI(); }
};
