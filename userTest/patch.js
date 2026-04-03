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
