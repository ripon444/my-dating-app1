// Real-time Web Audio API sound generator for Calling (WhatsApp / Messenger style)

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private outgoingRingTimer: any = null;
  private isOutgoingRinging = false;

  public getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public unlock() {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  // Outgoing Ringtone (Caller hears this while waiting for receiver to answer)
  public startOutgoingRingtone() {
    if (this.isOutgoingRinging) return;
    this.isOutgoingRinging = true;
    this.unlock();

    const playBurst = () => {
      if (!this.isOutgoingRinging) return;
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // WhatsApp / European PBX dual tone: 425Hz & 450Hz (or standard 440Hz & 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(425, now);
        osc2.frequency.setValueAtTime(450, now);

        // Pulse 1: 0.4s tone
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 0.4);
        gain.gain.linearRampToValueAtTime(0, now + 0.45);

        // Pulse 2: 0.4s tone
        gain.gain.setValueAtTime(0, now + 0.65);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.7);
        gain.gain.setValueAtTime(0.12, now + 1.1);
        gain.gain.linearRampToValueAtTime(0, now + 1.15);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch (err) {
        console.warn('Outgoing ring error:', err);
      }
    };

    playBurst();
    this.outgoingRingTimer = setInterval(playBurst, 3200);
  }

  public stopOutgoingRingtone() {
    this.isOutgoingRinging = false;
    if (this.outgoingRingTimer) {
      clearInterval(this.outgoingRingTimer);
      this.outgoingRingTimer = null;
    }
  }

  // Connected Ding / Harp Chime
  public playConnectedChime() {
    try {
      this.stopOutgoingRingtone();
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.5);
      });
    } catch (e) {}
  }

  // Call Ended Descent Tone
  public playEndTone() {
    try {
      this.stopOutgoingRingtone();
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [440, 330, 220].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      });
    } catch (e) {}
  }

  // Authentic Facebook-Style Notification Pop / Chime (Glassy high chime ping)
  public playNotificationPop() {
    try {
      this.unlock();
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5) - Warm pleasant strike
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.22, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: 880 Hz (A5) - High bright chime triggered 85ms after Note 1
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.085);

      gain2.gain.setValueAtTime(0, now + 0.085);
      gain2.gain.linearRampToValueAtTime(0.26, now + 0.10);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.085);
      osc2.stop(now + 0.7);

      // Sparkle Harmonic: 1760 Hz (A6) subtle crystal overtone
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(1760, now + 0.095);

      gain3.gain.setValueAtTime(0, now + 0.095);
      gain3.gain.linearRampToValueAtTime(0.07, now + 0.11);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.095);
      osc3.stop(now + 0.4);
    } catch (e) {
      console.warn('Notification sound error:', e);
    }
  }
}

export const soundManager = new SoundManager();
