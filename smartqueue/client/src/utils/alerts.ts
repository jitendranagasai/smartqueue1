// Browser Native Notifications, Web Audio Chime, and Speech Synthesis
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthesizes a modern 2-tone melodic chime (D5 -> A5) using the Web Audio API.
 * Works 100% offline, zero latency, no external mp3 assets needed.
 */
export function playChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First bell chime (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Second bell chime (880.00 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.14);
    gain2.gain.setValueAtTime(0.22, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.65);
  } catch (e) {
    console.warn('[Alerts] Audio playback warning:', e);
  }
}

/**
 * Voice announcement using browser SpeechSynthesis API.
 */
export function speakAnnouncement(text: string): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn('[Alerts] Speech synthesis warning:', e);
  }
}

/**
 * Requests permission for native OS browser desktop/mobile notifications.
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Checks if browser notification permission is granted.
 */
export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

/**
 * Shows an OS-level native desktop or phone notification popup.
 */
export function showBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'smartqueue-alert'
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('[Alerts] Notification display warning:', e);
    }
  }
}

/**
 * Unified alert dispatcher: plays chime, shows native notification,
 * and speaks the announcement if it's an actionable call to counter.
 */
export function triggerCustomerAlert(message: string): void {
  // 1. Audible chime sound
  playChime();

  // 2. Native OS Notification
  showBrowserNotification('SmartQueue Alert 🎟️', message);

  // 3. Voice Callout for customer turn / counter alerts
  const isCallout =
    message.includes('proceed to') ||
    message.includes('now being served') ||
    message.includes('Calling') ||
    message.includes('is next');

  if (isCallout) {
    speakAnnouncement(message);
  }
}
