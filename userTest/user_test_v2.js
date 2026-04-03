// ============================================
// PTH Authentication Usability Testing System
// Supports both user-created and generated passwords
// Includes smooth pattern drawing and questionnaire
// ============================================

// Test state management
let testState = {
  phase: 'welcome', // welcome, mode, create, memorization, practice, test, questionnaire, results
  participantId: '',
  testMode: '', // 'generate' or 'create'
  generatedSequence: [],
  sequenceString: '',
  entropy: 0,
  
  practice: {
    attempts: [],
    currentAttempt: 0,
    totalAttempts: 3
  },
  
  test: {
    attempts: [],
    currentAttempt: 0,
    totalAttempts: 5,
    startTime: null,
    currentStartTime: null
  },
  
  currentInput: [],
  currentStepIndex: 0
};

// Test data recording
let testData = {
  participantId: '',
  testDate: '',
  testMode: '', // 'generate' or 'create'
  sequence: [],
  sequenceString: '',
  sequenceLength: 0,
  entropy: 0,
  practiceAttempts: [],
  testAttempts: [],
  questionnaire: {},



  summary: {}
};

// Constants
const TAP_COLS = 2, TAP_ROWS = 2, TAP_GRID_SIZE = TAP_COLS * TAP_ROWS;
const PAT_SIZE = 3;

// Android intermediate map
const intermediate = {
  '1,3':2,'3,1':2,'1,7':4,'7,1':4,'3,9':6,'9,3':6,'7,9':8,'9,7':8,
  '1,9':5,'9,1':5,'3,7':5,'7,3':5,'2,8':5,'8,2':5,'4,6':5,'6,4':5
};

// ============================================
// Core Functions
// ============================================

function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

function nodeToPoint(node){ 
  const idx = Number(node)-1; 
  return {x: idx%3, y: Math.floor(idx/3)}; 
}

function segIntersect(a1,a2,b1,b2){
  const eps=1e-9; 
  function orient(p,q,r){ return (q.x-p.x)*(r.y-p.y) - (q.y-p.y)*(r.x-p.x); }
  if ((Math.abs(a1.x-b1.x)<eps && Math.abs(a1.y-b1.y)<eps) || 
      (Math.abs(a1.x-b2.x)<eps && Math.abs(a1.y-b2.y)<eps) ||
      (Math.abs(a2.x-b1.x)<eps && Math.abs(a2.y-b1.y)<eps) || 
      (Math.abs(a2.x-b2.x)<eps && Math.abs(a2.y-b2.y)<eps)) return false;
  const o1=orient(a1,a2,b1), o2=orient(a1,a2,b2), o3=orient(b1,b2,a1), o4=orient(b1,b2,a2);
  return (o1*o2<0) && (o3*o4<0);
}

function analyzePatternNodes(nodes){
  const pts = nodes.map(nodeToPoint);
  const segs = []; 
  for (let i=0;i<pts.length-1;i++) segs.push({a:pts[i],b:pts[i+1],i});
  
  let intersections=0; 
  const seen=new Set();
  for (let i=0;i<segs.length;i++) {
    for (let j=i+1;j<segs.length;j++){
      if (Math.abs(segs[i].i - segs[j].i) <= 1) continue;
      if (segIntersect(segs[i].a,segs[i].b,segs[j].a,segs[j].b)){
        const key=`${i}-${j}`; 
        if (!seen.has(key)){ 
          intersections++; 
          seen.add(key); 
        }
      }
    }
  }
  
  const edgeMap={};
  for (let i=0;i<nodes.length-1;i++){
    const a=nodes[i], b=nodes[i+1];
    const k=a<b?`${a}-${b}`:`${b}-${a}`;
    edgeMap[k]=(edgeMap[k]||0)+1;
  }
  
  let overlaps=0;
  for (const k in edgeMap) {
    if (edgeMap[k]>1) overlaps += (edgeMap[k]-1);
  }
  
  let physicalLength=0;
  for (let i=0;i<pts.length-1;i++){
    const dx=pts[i+1].x-pts[i].x, dy=pts[i+1].y-pts[i].y;
    physicalLength += Math.sqrt(dx*dx+dy*dy);
  }
  
  return {intersections, overlaps, physicalLength};
}

function patternEntropy(patStr){
  const parts = patStr.slice(1).split('-').filter(Boolean);
  const SP = parts.length;
  const {intersections:IP, overlaps:OP, physicalLength:PL} = analyzePatternNodes(parts);
  const denom = PL + IP + OP;
  return SP * Math.log2(denom);
}

function estimateEntropy(seq){
  let bits = 0, tapsCount = 0;
  for (const s of seq){
    if (s.startsWith('T')) tapsCount++;
    else if (s.startsWith('P')) bits += patternEntropy(s);
  }
  bits += tapsCount * Math.log2(TAP_GRID_SIZE);
  return bits;
}

function isValidPattern(nodes){
  if (!nodes || nodes.length < 4) return false;
  const used = new Set();
  for (let i=0;i<nodes.length;i++){
    const n = nodes[i];
    if (used.has(n)) return false;
    if (i>0){
      const prev = nodes[i-1];
      const key = `${prev},${n}`;
      if (intermediate[key]) {
        const mid = String(intermediate[key]);
        if (!used.has(mid)) return false;
      }
    }
    used.add(n);
  }
  return true;
}

function generatePattern(minNodes=4, maxNodes=9){
  const candidates = [];
  for (let t=0;t<500;t++){
    const len = randInt(minNodes, Math.min(maxNodes,9));
    const arr=[]; 
    const used=new Set();
    while (arr.length < len){
      const cand = String(randInt(1,9));
      if (used.has(cand)) continue;
      const prev = arr.length ? arr[arr.length-1] : null;
      const key = prev ? `${prev},${cand}` : null;
      if (key && intermediate[key] && !used.has(String(intermediate[key]))) {
        arr.push(String(intermediate[key])); 
        used.add(String(intermediate[key]));
      }
      if (!used.has(cand)){ 
        arr.push(cand); 
        used.add(cand); 
      }
    }
    if (isValidPattern(arr)) {
      candidates.push(arr);
      if (candidates.length >= 20) break; // Gather valid candidates
    }
  }
  
  if (candidates.length === 0) return ['1','2','3','6'];
  
  // Sort by entropy descending: P(Sp) = Sp * log2(Lp + Ip + Op)
  candidates.sort((a, b) => {
    return patternEntropy('P' + b.join('-')) - patternEntropy('P' + a.join('-'));
  });
  
  // Pick from the top 3 highest entropy patterns to ensure complexity
  const topK = Math.min(3, candidates.length);
  return candidates[randInt(0, topK - 1)];
}

function generateSequence(minL=8, maxL=12, maxPatternPct=40){
  // 按照教授要求，轉換為 P1 + Taps + P2 的「三明治架構」
  // 1. 簡化 Pattern 複雜度，限制節點數量為 4~6
  // 2. 縮短 Tap 長度，設定為 3~5 次
  const seq = [];
  
  // 第一個 Pattern (P1)
  seq.push('P' + generatePattern(4, 6).join('-'));
  
  // 中間的 Taps (作為認知分隔符 Cognitive Delimiter)
  const numTaps = randInt(3, 5);
  for (let i = 0; i < numTaps; i++){
    seq.push('T' + randInt(1, TAP_GRID_SIZE));
  }
  
  // 第二個 Pattern (P2)
  seq.push('P' + generatePattern(4, 6).join('-'));
  
  return seq;
}

// ============================================
// Canvas Drawing Setup with Smooth Curves
// ============================================

let currentCanvas = null;
let currentCtx = null;
let nodeCenters = [];
let cellCenters = [];
let nodeRadius = 20;
let margin = 48;
let step = 0;

function initializeCanvas(canvasId) {
  currentCanvas = document.getElementById(canvasId);
  if (!currentCanvas) return;
  
  currentCtx = currentCanvas.getContext('2d');
  margin = 48;
  step = (currentCanvas.width - margin*2) / (PAT_SIZE - 1);
  nodeRadius = 20;
  
  // Pattern nodes (3x3 grid)
  nodeCenters = [];
  for (let y=0;y<PAT_SIZE;y++) {
    for (let x=0;x<PAT_SIZE;x++) {
      nodeCenters.push({
        cx: margin + x*step,
        cy: margin + y*step,
        id: String(y*PAT_SIZE + x + 1)
      });
    }
  }
  
  // Tap cells (2x2 grid centers)
  cellCenters = [
    { cx: (nodeCenters[0].cx + nodeCenters[4].cx)/2, cy: (nodeCenters[0].cy + nodeCenters[4].cy)/2, id:1 },
    { cx: (nodeCenters[1].cx + nodeCenters[5].cx)/2, cy: (nodeCenters[1].cy + nodeCenters[5].cy)/2, id:2 },
    { cx: (nodeCenters[3].cx + nodeCenters[7].cx)/2, cy: (nodeCenters[3].cy + nodeCenters[7].cy)/2, id:3 },
    { cx: (nodeCenters[4].cx + nodeCenters[8].cx)/2, cy: (nodeCenters[4].cy + nodeCenters[8].cy)/2, id:4 }
  ];
  
  setupCanvasInteraction();
  drawBase();
}

function drawBase(){
  if (!currentCtx) return;
  currentCtx.clearRect(0,0,currentCanvas.width,currentCanvas.height);
  currentCtx.fillStyle='#fff';
  currentCtx.fillRect(0,0,currentCanvas.width,currentCanvas.height);
  
  // Draw pattern nodes
  currentCtx.fillStyle='#eef';
  for (const n of nodeCenters){
    currentCtx.beginPath();
    currentCtx.arc(n.cx,n.cy,nodeRadius,0,Math.PI*2);
    currentCtx.fill();
    currentCtx.strokeStyle='#136';
    currentCtx.lineWidth=3;
    currentCtx.stroke();
  }
  
  // Draw tap cell markers
  currentCtx.save();
  currentCtx.fillStyle='rgba(255,220,200,0.12)';
  currentCtx.strokeStyle='rgba(220,80,80,0.45)';
  currentCtx.lineWidth=2;
  const size = step;
  for (const c of cellCenters){
    currentCtx.beginPath();
    currentCtx.rect(c.cx - size/2, c.cy - size/2, size, size);
    currentCtx.fill();
    currentCtx.stroke();
    
    // Add numbers during practice/create/memorization to help user remember
    if (testState.phase === 'practice' || testState.phase === 'create' || testState.phase === 'memorization') {
      currentCtx.save();
      currentCtx.fillStyle = 'rgba(220,80,80,0.6)';
      currentCtx.font = 'bold 36px Arial';
      currentCtx.textAlign = 'center';
      currentCtx.textBaseline = 'middle';
      currentCtx.fillText(c.id, c.cx, c.cy);
      currentCtx.restore();
    }
  }
  currentCtx.restore();
}

// ============================================
// Canvas Interaction with Smooth Drawing
// ============================================

let isDrawing = false;
let currentNodes = [];
let visited = new Set();
let sampledPoints = []; // For smooth bezier curves
let pointerPreview = null;
let pointerState = null;
const MOVE_THRESHOLD = 8;
const HOLD_MS = 220;

// Drawing loop with dirty flag
let isDirty = false;
function markDirty(){ isDirty = true; }
function drawLoop(){ 
  if (isDirty){ 
    drawCurrent(); 
    isDirty = false; 
  } 
  requestAnimationFrame(drawLoop); 
}
requestAnimationFrame(drawLoop);

function toLocal(e){
  const rect = currentCanvas.getBoundingClientRect();
  const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : (e.clientX ?? e.pageX);
  const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : (e.clientY ?? e.pageY);
  return {
    x: (clientX - rect.left) * (currentCanvas.width / rect.width),
    y: (clientY - rect.top) * (currentCanvas.height / rect.height)
  };
}

function nodeAt(x,y){
  for(const n of nodeCenters){
    const dx=x-n.cx, dy=y-n.cy;
    if (Math.hypot(dx,dy) <= nodeRadius + 8) return n.id;
  }
  return null;
}

function isNearAnyNode(x,y, radius = nodeRadius + 12){
  for (const n of nodeCenters){
    if (Math.hypot(x-n.cx,y-n.cy) <= radius) return true;
  }
  return false;
}

function nearestCellIndex(x,y){
  if (isNearAnyNode(x,y)) return null;
  let best=null, bestD=Infinity;
  for (let i=0;i<cellCenters.length;i++){
    const c=cellCenters[i];
    const d=Math.hypot(x-c.cx,y-c.cy);
    if (d<bestD){
      bestD=d;
      best=i;
    }
  }
  if (bestD <= step * 0.9) return best;
  return null;
}

function startDrawNode(hit){
  if (!hit) return;
  currentNodes = [];
  visited = new Set();
  sampledPoints = [];
  pointerPreview = null;
  currentNodes.push(hit);
  visited.add(hit);
  isDrawing = true;
  
  drawCurrent();
}

function moveDrawNode(hit){
  if (!isDrawing) return;
  if (!hit) return;
  if (visited.has(hit)) return;
  
  const prev = currentNodes[currentNodes.length-1];
  const key = `${prev},${hit}`;
  if (intermediate[key] && !visited.has(String(intermediate[key]))){
    currentNodes.push(String(intermediate[key]));
    visited.add(String(intermediate[key]));
  }
  currentNodes.push(hit);
  visited.add(hit);
  
  drawCurrent();
}

function endDrawNode(){
  if (!isDrawing) return;
  isDrawing = false;
  drawCurrent();
  
  if (currentNodes && currentNodes.length >= 4){
    const token = 'P' + currentNodes.join('-');
    handleInput(token);
    currentNodes = [];
    visited = new Set();
    sampledPoints = [];
    pointerPreview = null;
    drawCurrent();
  } else if (currentNodes && currentNodes.length > 0) {
    showTempFeedback('Pattern 至少需要 4 個節點 / Pattern must have at least 4 nodes', 'error');
    currentNodes = [];
    visited = new Set();
    sampledPoints = [];
    pointerPreview = null;
    drawCurrent();
  }
}

function drawCurrent(){
  if (!currentCtx) return;
  drawBase();
  
  if (currentNodes.length > 0){
    // Draw straighter node-to-node polyline
    currentCtx.strokeStyle = '#007bff';
    currentCtx.lineWidth = 8;
    currentCtx.lineCap = 'round';
    currentCtx.lineJoin = 'round';
    currentCtx.beginPath();
    
    currentNodes.forEach((id,i)=>{
      const c = nodeCenters[Number(id)-1];
      if (i===0) currentCtx.moveTo(c.cx,c.cy);
      else currentCtx.lineTo(c.cx,c.cy);
    });
    currentCtx.stroke();

    // Preview one straight segment from last node to current pointer while drawing
    if (isDrawing && pointerPreview && currentNodes.length > 0) {
      const last = nodeCenters[Number(currentNodes[currentNodes.length - 1]) - 1];
      currentCtx.save();
      currentCtx.strokeStyle = 'rgba(0,123,255,0.55)';
      currentCtx.lineWidth = 6;
      currentCtx.lineCap = 'round';
      currentCtx.beginPath();
      currentCtx.moveTo(last.cx, last.cy);
      currentCtx.lineTo(pointerPreview.x, pointerPreview.y);
      currentCtx.stroke();
      currentCtx.restore();
    }
    
    // Draw node indicators
    currentNodes.forEach((id, idx)=>{
      const c = nodeCenters[Number(id)-1];
      if (idx === 0) {
        // First node in red
        currentCtx.fillStyle = '#e74c3c';
        currentCtx.beginPath();
        currentCtx.arc(c.cx, c.cy, nodeRadius-6, 0, Math.PI*2);
        currentCtx.fill();
        currentCtx.fillStyle = '#fff';
        currentCtx.beginPath();
        currentCtx.arc(c.cx, c.cy, 6, 0, Math.PI*2);
        currentCtx.fill();
      } else {
        currentCtx.fillStyle = '#007bff';
        currentCtx.beginPath();
        currentCtx.arc(c.cx, c.cy, nodeRadius-8, 0, Math.PI*2);
        currentCtx.fill();
        currentCtx.fillStyle = '#fff';
        currentCtx.beginPath();
        currentCtx.arc(c.cx, c.cy, 6, 0, Math.PI*2);
        currentCtx.fill();
      }
    });
  }
}

function registerTapAtCellIndex(idx){
  if (idx == null) return;
  const token = 'T' + (idx + 1);
  handleInput(token);
  flashCell(idx);
}

function flashCell(idx){
  drawCurrent();
  const c = cellCenters[idx];
  currentCtx.save();
  currentCtx.fillStyle = 'rgba(0,123,255,0.9)';
  const sizeRect = step * 0.8;
  currentCtx.fillRect(c.cx - sizeRect/2, c.cy - sizeRect/2, sizeRect, sizeRect);
  currentCtx.restore();
  setTimeout(()=>drawCurrent(), 140);
}

function onPointerDown(e){
  e.preventDefault();
  const pos = toLocal(e);
  pointerState = {
    id: e.pointerId || 'p',
    startX: pos.x,
    startY: pos.y,
    startTime: Date.now(),
    moved: false,
    drawStarted: false,
    isHeld: false,
    holdTimer: null
  };
  
  pointerState.holdTimer = setTimeout(()=>{
    if (pointerState) pointerState.isHeld = true;
  }, HOLD_MS);
  
  try {
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
  } catch(_) {}
}

function onPointerMove(e){
  if (!pointerState) return;
  const pos = toLocal(e);
  const dx = pos.x - pointerState.startX, dy = pos.y - pointerState.startY;
  
  if (!pointerState.moved && Math.hypot(dx,dy) > MOVE_THRESHOLD) {
    pointerState.moved = true;
  }
  
  if (!pointerState.drawStarted && pointerState.isHeld && pointerState.moved){
    const startHit = nodeAt(pointerState.startX, pointerState.startY) || nodeAt(pos.x,pos.y);
    if (startHit){
      pointerState.drawStarted = true;
      startDrawNode(startHit);
    } else {
      const near = nodeAt(pos.x,pos.y);
      if (near){
        pointerState.drawStarted = true;
        startDrawNode(near);
      }
    }
  }
  
  if (pointerState.drawStarted){
    pointerPreview = {x: pos.x, y: pos.y};
    markDirty();
    
    const hitNow = nodeAt(pos.x,pos.y);
    if (hitNow) moveDrawNode(hitNow);
  }
}

function onPointerUp(e){
  if (!pointerState) return;
  const pos = toLocal(e);
  const duration = Date.now() - pointerState.startTime;
  
  if (pointerState.holdTimer){
    clearTimeout(pointerState.holdTimer);
    pointerState.holdTimer = null;
  }
  
  if (pointerState.drawStarted) {
    endDrawNode();
  } else {
    if (!pointerState.moved || duration >= HOLD_MS){
      const idx = nearestCellIndex(pos.x,pos.y);
      registerTapAtCellIndex(idx);
    }
  }
  
  try {
    if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
  } catch(_) {}
  
  pointerState = null;
}

function setupCanvasInteraction(){
  if (!currentCanvas) return;
  
  // Remove old listeners
  currentCanvas.replaceWith(currentCanvas.cloneNode(true));
  currentCanvas = document.getElementById(currentCanvas.id);
  currentCtx = currentCanvas.getContext('2d');
  
  currentCanvas.addEventListener('pointerdown', onPointerDown, {passive:false});
  currentCanvas.addEventListener('pointermove', onPointerMove, {passive:false});
  currentCanvas.addEventListener('pointerup', onPointerUp, {passive:false});
  currentCanvas.addEventListener('touchstart', (e)=>onPointerDown(e.changedTouches ? e.changedTouches[0] : e), {passive:false});
  currentCanvas.addEventListener('touchmove', (e)=>onPointerMove(e.changedTouches ? e.changedTouches[0] : e), {passive:false});
  currentCanvas.addEventListener('touchend', (e)=>onPointerUp(e.changedTouches ? e.changedTouches[0] : e), {passive:false});
}

// ============================================
// Input Handling
// ============================================

function handleInput(token){
  testState.currentInput.push(token);
  updateInputDisplay();
  checkSequenceProgress();
}

function updateInputDisplay(){
  const displayIds = ['createInput', 'practiceInput', 'testInput'];
  const text = '您的輸入 Your input: ' + testState.currentInput.join(' - ');
  
  for (const id of displayIds) {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) { // visible
      el.textContent = text;
    }
  }
  
  // Update create screen visualizations
  if (testState.phase === 'create') {
    const seq = testState.currentInput;
    document.getElementById('createSequence').textContent = 
      seq.length > 0 ? seq.join(' - ') : '（尚未創建） (Not created yet)';
    document.getElementById('createLength').textContent = seq.length;
    document.getElementById('createEntropy').textContent = estimateEntropy(seq).toFixed(2);
    
    const confirmBtn = document.getElementById('confirmCreateBtn');
    if (seq.length >= 8 && seq.length <= 12 && 
        seq.some(s=>s.startsWith('P')) && seq.some(s=>s.startsWith('T'))) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    } else {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
    }
    
    renderCreateSteps();
  }
}

function checkSequenceProgress(){
  const expected = testState.generatedSequence;
  const input = testState.currentInput;
  
  // Update step visualization
  updateStepVisualization();
  
  // Only auto-check step correctness in Practice phase
  if (testState.phase === 'practice' && input.length > 0) {
    const lastInput = input[input.length - 1];
    const expectedStep = expected[input.length - 1];
    
    if (lastInput !== expectedStep) {
      handleWrongInput();
      return;
    }
  }
  
  // Auto-complete only in Practice phase when length equals expected
  if (testState.phase === 'practice') {
    if (input.length === expected.length) {
      handleSequenceComplete();
    } else {
      updatePracticeHint();
    }
  }
  
  // In Test phase, we rely on submitTestPassword(), thus do nothing here.
}

function handleWrongInput(){
  if (testState.phase === 'practice') {
    showFeedback('practiceFeedback', '錯誤！請再試一次 / Incorrect. Please try again.', 'error');
    setTimeout(()=>{
      testState.currentInput = [];
      updateInputDisplay();
      updateStepVisualization();
      updatePracticeHint();
      document.getElementById('practiceFeedback').innerHTML = '';
    }, 1500);
  } else if (testState.phase === 'test') {
    recordTestAttempt(false);
    showFeedback('testFeedback', '密碼錯誤！ / Incorrect password!', 'error');
    setTimeout(()=>{
      nextTestAttempt();
    }, 1500);
  }
}

function handleSequenceComplete(){
  if (testState.phase === 'practice') {
    recordPracticeAttempt(true);
    showFeedback('practiceFeedback', '✓ 正確！ / Correct!', 'success');
    setTimeout(()=>{
      nextPracticeAttempt();
    }, 1000);
  } else if (testState.phase === 'test') {
    recordTestAttempt(true);
    showFeedback('testFeedback', '✓ 解鎖成功！ / Unlock successful!', 'success');
    setTimeout(()=>{
      nextTestAttempt();
    }, 1000);
  }
}

// ============================================
// Test Flow Functions
// ============================================

function startTest(){
  const pid = document.getElementById('participantId').value.trim();
  if (!pid) {
    alert('請輸入測試編號！ / Please enter participant ID!');
    return;
  }
  
  testState.participantId = pid;
  testData.participantId = pid;
  testData.testDate = new Date().toISOString();
  
  // Set mode to generate
  testState.testMode = 'generate';
  testData.testMode = testState.testMode;
  
  document.getElementById('welcomeScreen').classList.add('hidden');
  
  generateAndShowSequence();
}

function proceedWithMode(){
  document.getElementById('modeScreen').classList.add('hidden');
  
  if (testState.testMode === 'create') {
    showCreateScreen();
  } else {
    generateAndShowSequence();
  }
}

function showCreateScreen(){
  testState.phase = 'create';
  testState.currentInput = [];
  
  document.getElementById('createScreen').classList.remove('hidden');
  document.getElementById('phaseText').textContent = '創建您的密碼 Create your password';
  
  initializeCanvas('createCanvas');
}

function resetCreate(){
  testState.currentInput = [];
  updateInputDisplay();
  drawBase();
}

function confirmCreate(){
  const seq = testState.currentInput;
  
  if (seq.length < 8 || seq.length > 12) {
    alert('密碼長度應為 8-12 步！ / Password length must be 8-12 steps!');
    return;
  }
  
  if (!seq.some(s=>s.startsWith('P')) || !seq.some(s=>s.startsWith('T'))) {
    alert('密碼必須包含至少一個 Pattern 和一個 Tap！ / Password must include at least one Pattern and one Tap!');
    return;
  }
  
  testState.generatedSequence = seq.slice();
  testState.sequenceString = seq.join(' - ');
  testState.entropy = estimateEntropy(seq);
  
  testData.sequence = seq.slice();
  testData.sequenceString = testState.sequenceString;
  testData.sequenceLength = seq.length;
  testData.entropy = testState.entropy;
  
  // Show memorization phase
  testState.currentInput = [];
  document.getElementById('createScreen').classList.add('hidden');
  showMemorizationPhase();
}

function generateAndShowSequence(){
  let seq = generateSequence(); // Removed args since P+T+P handled internally
  let attempts = 0;
  // 將嘗試次數拉高到 2000，確保一定能刷出 >= 28 bits (考量到 P+T+P 架構整體簡化了)
  while (estimateEntropy(seq) < 43 && attempts < 2000) {
    seq = generateSequence();
    attempts++;
  }
  
  testState.generatedSequence = seq;
  testState.sequenceString = seq.join(' - ');
  testState.entropy = estimateEntropy(seq);
  
  testData.sequence = seq;
  testData.sequenceString = testState.sequenceString;
  testData.sequenceLength = seq.length;
  testData.entropy = testState.entropy;
  
  showMemorizationPhase();
}

function showMemorizationPhase(){
  testState.phase = 'memorization';
  
  document.getElementById('memorizationScreen').classList.remove('hidden');
  
  document.getElementById('memorizationTitle').textContent = '📝 請記住這組密碼 Please memorize this password';
  
  document.getElementById('phaseText').innerHTML = 
    '<span class="current">第一階段：記憶密碼 Phase 1: Memorization</span> → 第二階段：引導練習 Phase 2: Practice → 第三階段：測試 Phase 3: Test';
  
  document.getElementById('generatedSequence').textContent = testState.sequenceString;
  document.getElementById('sequenceEntropy').textContent = testState.entropy.toFixed(2);
  
  renderMemorizationSteps();
}

function renderMemorizationSteps(){
  const container = document.getElementById('memorizationSteps');
  container.innerHTML = '';
  
  testState.generatedSequence.forEach((step, idx) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'step-item';
    canvas.width = 56;
    canvas.height = 56;
    drawSmallGrid(canvas, step);
    container.appendChild(canvas);
  });
}

function renderCreateSteps(){
  const container = document.getElementById('createSteps');
  container.innerHTML = '';
  
  testState.currentInput.forEach((step, idx) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'step-item';
    canvas.width = 56;
    canvas.height = 56;
    drawSmallGrid(canvas, step);
    container.appendChild(canvas);
  });
}

function drawSmallGrid(canvasEl, symbol){
  const ctx2 = canvasEl.getContext('2d');
  const w = canvasEl.width, h = canvasEl.height;
  ctx2.clearRect(0,0,w,h);
  
  const margin2 = 6;
  if (!symbol) return;
  
  if (symbol.startsWith('P')){
    const parts = symbol.slice(1).split('-');
    const stepX = (w - margin2*2) / (PAT_SIZE - 1);
    const stepY = (h - margin2*2) / (PAT_SIZE - 1);
    
    ctx2.fillStyle = '#eee';
    for (let y=0;y<PAT_SIZE;y++) {
      for (let x=0;x<PAT_SIZE;x++){
        const cx = margin2+x*stepX, cy = margin2+y*stepY;
        ctx2.beginPath();
        ctx2.arc(cx,cy,4,0,Math.PI*2);
        ctx2.fill();
      }
    }
    
    const pts = parts.map(n=>{
      const idx = Number(n)-1;
      return {
        x: margin2 + (idx%3)*stepX,
        y: margin2 + Math.floor(idx/3)*stepY
      };
    });
    
    ctx2.strokeStyle = '#007bff';
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    pts.forEach((p,i)=> i===0 ? ctx2.moveTo(p.x,p.y) : ctx2.lineTo(p.x,p.y));
    ctx2.stroke();
    
    pts.forEach((p, i) => {
      if (i === 0) {
        ctx2.fillStyle = '#e74c3c';
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, 5, 0, Math.PI*2);
        ctx2.fill();
        ctx2.fillStyle = '#fff';
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, 2, 0, Math.PI*2);
        ctx2.fill();
      } else {
        ctx2.fillStyle = '#007bff';
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx2.fill();
        ctx2.fillStyle = '#fff';
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, 2, 0, Math.PI*2);
        ctx2.fill();
      }
    });
  } else if (symbol.startsWith('T')){
    const cols = TAP_COLS, rows = TAP_ROWS;
    const stepX = (w - margin2*2) / (cols - 1 || 1);
    const stepY = (h - margin2*2) / (rows - 1 || 1);
    
    ctx2.fillStyle = '#f6f6f6';
    for (let ry=0; ry<rows; ry++) {
      for (let rx=0; rx<cols; rx++){
        const cx = margin2 + rx*stepX, cy = margin2 + ry*stepY;
        const cw = stepX*0.8, ch = stepY*0.8;
        ctx2.fillRect(cx-cw/2, cy-ch/2, cw, ch);
      }
    }
    
    const idx = Number(symbol.slice(1)) - 1;
    const tx = idx % cols, ty = Math.floor(idx/cols);
    const tcx = margin2 + tx*stepX, tcy = margin2 + ty*stepY;
    ctx2.fillStyle = 'rgba(0,123,255,0.95)';
    const tw = stepX*0.8, th = stepY*0.8;
    ctx2.fillRect(tcx-tw/2, tcy-th/2, tw, th);
  }
  
  // Keep only tap number label; hide pattern "P" to avoid covering nodes.
  if (symbol.startsWith('T')) {
    const label = symbol.replace('T', '');
    ctx2.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx2.fillRect(0, 0, 18, 16);
    ctx2.fillStyle = '#000';
    ctx2.font = 'bold 12px Arial';
    ctx2.textAlign = 'left';
    ctx2.textBaseline = 'top';
    ctx2.fillText(label, 2, 2);
  }
}

function startPractice(){
  testState.phase = 'practice';
  testState.practice.currentAttempt = 0;
  testState.currentInput = [];
  
  document.getElementById('memorizationScreen').classList.add('hidden');
  document.getElementById('practiceScreen').classList.remove('hidden');
  
  document.getElementById('phaseText').innerHTML = 
    '第一階段：記憶密碼 Phase 1 → <span class="current">第二階段：引導練習 Phase 2: Practice</span> → 第三階段：測試 Phase 3: Test';
  
  initializeCanvas('practiceCanvas');
  updatePracticeProgress();
  updatePracticeHint();
  renderPracticeSteps();
}

function updatePracticeProgress(){
  const progressEl = document.getElementById('practiceProgress');
  const current = testState.practice.currentAttempt;
  const total = testState.practice.totalAttempts;
  const percentage = (current / total) * 100;
  
  progressEl.style.width = percentage + '%';
  progressEl.textContent = `練習 Practice ${current}/${total}`;
}

function updatePracticeHint(){
  const nextStepIndex = testState.currentInput.length;
  if (nextStepIndex >= testState.generatedSequence.length) return;
  
  const nextStep = testState.generatedSequence[nextStepIndex];
  let hint = '';
  
  if (nextStep.startsWith('P')) {
    const nodes = nextStep.slice(1).split('-');
    hint = `📍 模式 Pattern: ${nodes.join(' → ')}`;
  } else if (nextStep.startsWith('T')) {
    const cell = nextStep.slice(1);
    hint = `👆 點擊格 Tap cell ${cell}`;
  }
  
  document.getElementById('hintText').textContent = `第 ${nextStepIndex + 1} 步 Step ${nextStepIndex + 1}: ${hint}`;
}

function renderPracticeSteps(){
  const container = document.getElementById('practiceSteps');
  container.innerHTML = '';
  
  testState.generatedSequence.forEach((step, idx) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'step-item';
    canvas.width = 56;
    canvas.height = 56;
    
    if (idx < testState.currentInput.length) {
      canvas.classList.add('completed');
    } else if (idx === testState.currentInput.length) {
      canvas.classList.add('current');
    }
    
    drawSmallGrid(canvas, step);
    container.appendChild(canvas);
  });
}

function updateStepVisualization(){
  if (testState.phase === 'practice') {
    renderPracticeSteps();
  } else if (testState.phase === 'test') {
    renderTestSteps();
  }
}

function recordPracticeAttempt(success){
  const attempt = {
    attemptNumber: testState.practice.currentAttempt + 1,
    success: success,
    input: testState.currentInput.slice(),
    timestamp: new Date().toISOString()
  };
  
  testState.practice.attempts.push(attempt);
  testData.practiceAttempts.push(attempt);
}

function nextPracticeAttempt(){
  testState.currentInput = [];
  testState.practice.currentAttempt++;
  
  document.getElementById('practiceFeedback').innerHTML = '';
  
  if (testState.practice.currentAttempt >= testState.practice.totalAttempts) {
    startDistractionPhase();
  } else {
    updatePracticeProgress();
    updatePracticeHint();
    renderPracticeSteps();
    updateInputDisplay();
    drawBase();
  }
}

// ============================================
// Distraction Phase (HCI Interference Task)
// ============================================

let currentMathAnswer = 0;
let distractionTimeLeft = 60; // 60 seconds of distraction
let distractionInterval = null;

function startDistractionPhase(){
  testState.phase = 'distraction';
  
  document.getElementById('practiceScreen').classList.add('hidden');
  document.getElementById('distractionScreen').classList.remove('hidden');
  
  document.getElementById('phaseText').innerHTML = 
    '第一階段：記憶密碼 Phase 1 → 第二階段：引導練習 Phase 2 → <span class="current">干擾任務 Distraction</span> → 測試 Test';
  
  // Initialize timer and first problem
  distractionTimeLeft = 60;
  updateDistractionTimerDisplay();
  generateMathProblem();
  
  const inputEl = document.getElementById('mathAnswer');
  inputEl.value = '';
  inputEl.focus();
  
  // Enter key support for math problem
  inputEl.onkeypress = function(e) {
    if (e.key === 'Enter') {
      checkMathAnswer();
    }
  };
  
  if (distractionInterval) clearInterval(distractionInterval);
  
  distractionInterval = setInterval(() => {
    distractionTimeLeft--;
    updateDistractionTimerDisplay();
    
    if (distractionTimeLeft <= 0) {
      endDistractionPhase();
    }
  }, 1000);
}

function updateDistractionTimerDisplay() {
  const mins = Math.floor(distractionTimeLeft / 60);
  const secs = distractionTimeLeft % 60;
  document.getElementById('distractionTimer').textContent = 
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function generateMathProblem() {
  // Generate random 2-digit additions or subtractions
  const isAddition = Math.random() > 0.5;
  let num1, num2;
  
  if (isAddition) {
    num1 = Math.floor(Math.random() * 80) + 10; // 10-89
    num2 = Math.floor(Math.random() * 80) + 10;
    currentMathAnswer = num1 + num2;
    document.getElementById('mathProblem').textContent = `${num1} + ${num2} = ?`;
  } else {
    num1 = Math.floor(Math.random() * 80) + 20; // 20-99
    num2 = Math.floor(Math.random() * (num1 - 9)) + 10; // ensure positive result
    currentMathAnswer = num1 - num2;
    document.getElementById('mathProblem').textContent = `${num1} - ${num2} = ?`;
  }
}

function checkMathAnswer() {
  const inputEl = document.getElementById('mathAnswer');
  const feedbackEl = document.getElementById('mathFeedback');
  const userAns = parseInt(inputEl.value.trim(), 10);
  
  if (isNaN(userAns)) return;
  
  if (userAns === currentMathAnswer) {
    feedbackEl.textContent = "正確！ / Correct!";
    feedbackEl.style.color = "#28a745";
  } else {
    feedbackEl.textContent = `錯誤！答案是 ${currentMathAnswer} / Incorrect! The answer is ${currentMathAnswer}`;
    feedbackEl.style.color = "#dc3545";
  }
  
  setTimeout(() => {
    if (testState.phase === 'distraction') {
      feedbackEl.textContent = "";
      inputEl.value = '';
      inputEl.focus();
      generateMathProblem();
    }
  }, 800);
}

function endDistractionPhase() {
  if (distractionInterval) {
    clearInterval(distractionInterval);
    distractionInterval = null;
  }
  
  // Clear enter key listener
  document.getElementById('mathAnswer').onkeypress = null;
  
  document.getElementById('distractionScreen').classList.add('hidden');
  startTestPhase();
}

function startTestPhase(){
  testState.phase = 'test';
  testState.test.currentAttempt = 0;
  testState.test.startTime = Date.now();
  testState.currentInput = [];
  
  document.getElementById('practiceScreen').classList.add('hidden');
  document.getElementById('testScreen').classList.remove('hidden');
  
  document.getElementById('phaseText').innerHTML = 
    '第一階段：記憶密碼 Phase 1 → 第二階段：引導練習 Phase 2 → <span class="current">第三階段：測試 Phase 3: Test</span>';
 
  initializeCanvas('testCanvas');
  startTimer();
  updateTestProgress();
  renderTestSteps();
  updateTestStats();
}

let timerInterval = null;

function startTimer(){
  testState.test.currentStartTime = Date.now();
  
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(()=>{
    const elapsed = Date.now() - testState.test.currentStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const ms = Math.floor((elapsed % 1000) / 10);
    
    const timerEl = document.getElementById('timer');
    if (timerEl) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerEl.textContent = 
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }
  }, 10);
}

function stopTimer(){
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  return Date.now() - testState.test.currentStartTime;
}

function updateTestProgress(){
  const progressEl = document.getElementById('testProgress');
  const current = testState.test.currentAttempt;
  const total = testState.test.totalAttempts;
  const percentage = (current / total) * 100;
  
  progressEl.style.width = percentage + '%';
  progressEl.textContent = `測試 Test ${current}/${total}`;
}

function renderTestSteps(){
  const container = document.getElementById('testSteps');
  container.innerHTML = '';
  
  testState.generatedSequence.forEach((step, idx) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'step-item';
    canvas.width = 56;
    canvas.height = 56;
    
    if (idx < testState.currentInput.length) {
      canvas.classList.add('completed');
    } else if (idx === testState.currentInput.length) {
      canvas.classList.add('current');
    }
    
    // Don't show the actual pattern/tap
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, 56, 56);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 56, 56);
    
    container.appendChild(canvas);
  });
}

function updateTestStats(){
  const successCount = testState.test.attempts.filter(a => a.success).length;
  document.getElementById('currentAttempt').textContent = 
    `${testState.test.currentAttempt + 1}/${testState.test.totalAttempts}`;
  document.getElementById('successCount').textContent = successCount;
}

function recordTestAttempt(success){
  const duration = stopTimer();
  
  const attempt = {
    attemptNumber: testState.test.currentAttempt + 1,
    success: success,
    duration: duration,
    durationSeconds: (duration / 1000).toFixed(2),
    input: testState.currentInput.slice(),
    expectedLength: testState.generatedSequence.length,
    inputLength: testState.currentInput.length,
    timestamp: new Date().toISOString()
  };
  
  testState.test.attempts.push(attempt);
  testData.testAttempts.push(attempt);
}

function submitTestPassword() {
  if (testState.phase !== 'test') return;
  if (testState.currentInput.length === 0) {
    showTempFeedback('請先輸入密碼！ / Please enter your password first!', 'error');
    return;
  }
  
  const expected = testState.generatedSequence;
  const input = testState.currentInput;
  
  // Check if lengths match and all elements match
  let isCorrect = (input.length === expected.length);
  if (isCorrect) {
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== expected[i]) {
        isCorrect = false;
        break;
      }
    }
  }
  
  if (isCorrect) {
    handleSequenceComplete();
  } else {
    handleWrongInput();
  }
}

function nextTestAttempt(){
  testState.currentInput = [];
  testState.test.currentAttempt++;
  
  document.getElementById('testFeedback').innerHTML = '';
  
  if (testState.test.currentAttempt >= testState.test.totalAttempts) {
    showResults();
  } else {
    startTimer();
    updateTestProgress();
    renderTestSteps();
    updateTestStats();
    updateInputDisplay();
    drawBase();
  }
}

function showResults(){
  testState.phase = 'results';
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  document.getElementById('testScreen').classList.add('hidden');
  document.getElementById('resultsScreen').classList.remove('hidden');
  
  document.getElementById('phaseText').innerHTML = 
    '<span style="color: #28a745;">✓ 測試完成 Test complete</span>';
  
  calculateSummary();
  displayResults();
  // Removed generateRetestToken() as retest is dropped
}

function calculateSummary(){
  const successAttempts = testData.testAttempts.filter(a => a.success);
  const successCount = successAttempts.length;
  const successRate = (successCount / testData.testAttempts.length) * 100;
  
  const durations = successAttempts.map(a => a.duration);
  const avgTime = durations.length > 0 
    ? durations.reduce((a,b) => a+b, 0) / durations.length 
    : 0;
  const bestTime = durations.length > 0 ? Math.min(...durations) : 0;
  
  testData.summary = {
    totalAttempts: testData.testAttempts.length,
    successCount: successCount,
    failCount: testData.testAttempts.length - successCount,
    successRate: successRate.toFixed(2),
    avgTimeMs: avgTime,
    avgTimeSeconds: (avgTime / 1000).toFixed(2),
    bestTimeMs: bestTime,
    bestTimeSeconds: (bestTime / 1000).toFixed(2),
    practiceAttempts: testData.practiceAttempts.length
  };
}

function displayResults(){
  document.getElementById('finalParticipantId').textContent = testData.participantId;
  const finalModeEl = document.getElementById('finalMode');
  if(finalModeEl) finalModeEl.textContent = '生成密碼 Generated Password';
  
  const finalSequenceTextEl = document.getElementById('finalSequenceText');
  if (finalSequenceTextEl) {
    finalSequenceTextEl.textContent = testData.sequenceString || '-';
  }

  const finalStepsEl = document.getElementById('finalSequenceSteps');
  if (finalStepsEl) {
    finalStepsEl.innerHTML = '';
    (testData.sequence || []).forEach((step) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'step-item';
      canvas.width = 56;
      canvas.height = 56;
      drawSmallGrid(canvas, step);
      finalStepsEl.appendChild(canvas);
    });
  }

  document.getElementById('finalSuccess').textContent = 
    `${testData.summary.successCount}/${testData.summary.totalAttempts}`;
  document.getElementById('finalAvgTime').textContent = 
    testData.summary.avgTimeSeconds + ' 秒 / seconds';
  document.getElementById('finalSuccessRate').textContent = 
    testData.summary.successRate + '%';
}



// ============================================
// Utility Functions
// ============================================

function showFeedback(elementId, message, type){
  const el = document.getElementById(elementId);
  if (!el) return;
  
  el.innerHTML = `<div class="feedback ${type}">${message}</div>`;
}

function showTempFeedback(message, type){
  const feedbackId = testState.phase === 'practice' ? 'practiceFeedback' : 'testFeedback';
  showFeedback(feedbackId, message, type);
  setTimeout(()=>{
    const el = document.getElementById(feedbackId);
    if (el) el.innerHTML = '';
  }, 2000);
}

function clearCurrentInput(){
  testState.currentInput = [];
  currentNodes = [];
  visited = new Set();
  sampledPoints = [];
  isDrawing = false;
  
  updateInputDisplay();
  updateStepVisualization();
  pointerPreview = null;
  
  if (testState.phase === 'practice') {
    updatePracticeHint();
  }
  
  drawBase();
}

function showSequenceAgain(){
  if (confirm('要再次查看密碼嗎？這會重置當前練習。 / Show password again? This will reset current practice.')) {
    testState.currentInput = [];
    updateInputDisplay();
    renderPracticeSteps();
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white; padding: 30px; border-radius: 12px;
      max-width: 600px; text-align: center;
    `;
    
    content.innerHTML = `
      <h2>密碼提醒 Password Reminder</h2>
      <div style="font-size: 18px; font-weight: 600; margin: 20px 0; letter-spacing: 2px;">
        ${testState.sequenceString}
      </div>
      <div id="modalSteps" class="step-grid" style="justify-content: center; margin: 20px 0;"></div>
      <button class="btn-primary" onclick="this.closest('div[style*=fixed]').remove()">
        關閉 Close
      </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Render steps in modal
    const modalSteps = content.querySelector('#modalSteps');
    testState.generatedSequence.forEach(step => {
      const canvas = document.createElement('canvas');
      canvas.className = 'step-item';
      canvas.width = 56;
      canvas.height = 56;
      drawSmallGrid(canvas, step);
      modalSteps.appendChild(canvas);
    });
  }
}

function downloadResults(){
  testData.downloadDate = new Date().toISOString();
  
  const dataStr = JSON.stringify(testData, null, 2);
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pth_usability_${testData.participantId}_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('PTH Usability Testing System initialized');
  
  // Allow Enter key to start test
  document.getElementById('participantId')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      startTest();
    }
  });
});
