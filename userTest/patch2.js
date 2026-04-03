function generateAndShowSequence(){
  let seq = generateSequence(); // Removed args since P+T+P handled internally
  let attempts = 0;
  // 將嘗試次數拉高到 2000，確保一定能刷出 >= 28 bits (考量到 P+T+P 架構整體簡化了)
  while (estimateEntropy(seq) < 28 && attempts < 2000) {
    seq = generateSequence();
    attempts++;
  }
