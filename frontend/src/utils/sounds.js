// Sound utility for clock in/out and break actions
// Uses Web Audio API to generate pleasant notification sounds

const audioContext = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;

// Play a pleasant "ding" sound for clock in
export const playClockInSound = () => {
  if (!audioContext) return;

  // Resume audio context if suspended (required by browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Pleasant ascending tone
  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
  oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
  oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.4);
};

// Play a "completion" sound for clock out
export const playClockOutSound = () => {
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Pleasant descending tone
  oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime); // G5
  oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15); // E5
  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.3); // C5

  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

// Play a soft "pause" sound for break start
export const playBreakStartSound = () => {
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Soft two-tone notification
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
  oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime + 0.15); // F4

  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
};

// Play a "resume" sound for break end
export const playBreakEndSound = () => {
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Energetic two-tone notification
  oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime); // F4
  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime + 0.1); // C5

  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.25);
};

// Play emergency lunch warning: "ehh-ehh-ehh" alarm + spoken voiceover, loops up to 3×.
// Returns a stop() function — call it when the warning is dismissed.
export const playLunchWarningSound = () => {
  if (!audioContext) return () => {};

  let stopped = false;
  const pendingTimeouts = [];

  const after = (ms, fn) => {
    const id = setTimeout(() => { fn(); }, ms);
    pendingTimeouts.push(id);
  };

  const stop = () => {
    stopped = true;
    pendingTimeouts.forEach(clearTimeout);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  // 3 descending "ehh" sawtooth beeps (~1.35 s total)
  const playBeepCycle = () => {
    if (stopped || !audioContext) return;
    for (let i = 0; i < 3; i++) {
      const t = i * 0.45;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, audioContext.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(240, audioContext.currentTime + t + 0.32);
      gain.gain.setValueAtTime(0.0, audioContext.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.55, audioContext.currentTime + t + 0.02);
      gain.gain.setValueAtTime(0.55, audioContext.currentTime + t + 0.26);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + t + 0.38);
      osc.start(audioContext.currentTime + t);
      osc.stop(audioContext.currentTime + t + 0.38);
    }
  };

  const speakVoiceover = (onDone) => {
    if (stopped || !window.speechSynthesis) { onDone(); return; }
    const u = new SpeechSynthesisUtterance(
      'Lunch break is ending. Please remember to press End Lunch Break so you get paid.'
    );
    u.rate = 0.85;
    u.volume = 1.0;
    u.onend = onDone;
    u.onerror = onDone;
    window.speechSynthesis.speak(u);
  };

  const runCycle = (n) => {
    if (stopped || n >= 3) return;
    playBeepCycle();
    // Beeps finish at ~1.35 s; wait 1.4 s then speak
    after(1400, () => {
      if (stopped) return;
      speakVoiceover(() => {
        if (stopped) return;
        after(1500, () => runCycle(n + 1));
      });
    });
  };

  if (audioContext.state === 'suspended') {
    audioContext.resume().then(() => { if (!stopped) runCycle(0); });
  } else {
    runCycle(0);
  }

  return stop;
};

// Play a success sound (for general confirmations)
export const playSuccessSound = () => {
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.15);
};
