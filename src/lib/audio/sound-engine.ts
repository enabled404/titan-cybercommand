"use client";

/**
 * Procedural Web Audio Synthesizer ("DEFCON Audio Engine")
 * Generates all sound effects in real-time via the Web Audio API without needing any external audio assets.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneOscBinaural: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private volume: number = 0.4;
  private isInitialized: boolean = false;
  private lastLaunchTime: number = 0;
  private lastImpactTime: number = 0;
  private lastPulseTime: number = 0;
  private lastScanTime: number = 0;

  private init() {
    if (this.isInitialized || typeof window === "undefined") return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch {
      // AudioContext may be restricted by autoplay policy until user gesture
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!this.isInitialized && !muted) {
      this.init();
    }
    if (this.ctx && this.masterGain) {
      if (this.ctx.state === "suspended" && !muted) {
        void this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, now, 0.05);

      if (!muted && !this.droneOsc) {
        this.startDrone();
      } else if (muted && this.droneOsc) {
        this.stopDrone();
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Tactical background command bunker drone:
   * Multi-oscillator binaural sub-bass hum (55Hz primary + 55.4Hz binaural beat)
   * with subtle atmospheric low-pass breathing modulation.
   */
  public startDrone() {
    if (this.isMuted || !this.ctx || !this.masterGain || this.droneOsc) return;

    try {
      const now = this.ctx.currentTime;
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = "sine";
      this.droneOsc.frequency.setValueAtTime(55, now);

      this.droneOscBinaural = this.ctx.createOscillator();
      this.droneOscBinaural.type = "sine";
      this.droneOscBinaural.frequency.setValueAtTime(55.4, now);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = "lowpass";
      this.droneFilter.frequency.setValueAtTime(115, now);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.07, now + 2);

      this.droneOsc.connect(this.droneFilter);
      this.droneOscBinaural.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc.start(now);
      this.droneOscBinaural.start(now);
    } catch {
      // Audio error fallback
    }
  }

  public stopDrone() {
    if (this.ctx) {
      try {
        const now = this.ctx.currentTime;
        if (this.droneGain) {
          this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        }
        if (this.droneOsc) this.droneOsc.stop(now + 0.5);
        if (this.droneOscBinaural) this.droneOscBinaural.stop(now + 0.5);
      } catch {
        // Ignored
      }
      this.droneOsc = null;
      this.droneOscBinaural = null;
      this.droneGain = null;
      this.droneFilter = null;
    }
  }

  public playLaser(originLongitude: number = 0) {
    this.playAttackLaunch(originLongitude);
  }

  /**
   * Attack launch sound: high-speed frequency swoop panned in stereo
   */
  public playAttackLaunch(originLongitude: number = 0) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      // Prevent sound saturation during high-speed barrage / 4x replay
      if (now - this.lastLaunchTime < 0.11) return;
      this.lastLaunchTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

      osc.type = "sawtooth";
      // Pan based on geographic longitude (-180 to 180 -> -1 to 1)
      const pan = Math.max(-1, Math.min(1, originLongitude / 180));
      if (panner) {
        panner.pan.setValueAtTime(pan, now);
      }

      // Fast laser whoosh: 850Hz -> 180Hz
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(600, now);
      filter.Q.setValueAtTime(3, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(filter);
      if (panner) {
        filter.connect(panner);
        panner.connect(gain);
      } else {
        filter.connect(gain);
      }
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignored
    }
  }

  /**
   * Target impact sound: low resonant thud with subtle transient
   */
  public playImpact(severity: 1 | 2 | 3 | 4 = 2) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      // Prevent low-end clipping from multiple simultaneous impacts
      if (now - this.lastImpactTime < 0.08) return;
      this.lastImpactTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      const startFreq = 120 + severity * 20;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);

      const amp = 0.08 + severity * 0.05;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.33);
    } catch {
      // Ignored
    }
  }

  /**
   * Critical threat alert chime (dual-tone harmonic ping)
   */
  public playAlert() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      [880, 1320].forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.46);
      });
    } catch {
      // Ignored
    }
  }

  /**
   * Crisp tactical terminal key / HUD click
   */
  public playClick() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.015);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch {
      // Ignored
    }
  }

  /**
   * DEFCON 1 Emergency Klaxon siren (warbling dual-frequency alarm)
   */
  public playKlaxon() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.linearRampToValueAtTime(740, now + 0.25);
      osc.frequency.linearRampToValueAtTime(480, now + 0.5);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.56);
    } catch {
      // Ignored
    }
  }

  /**
   * Satellite Radar / Sonar pulse ping
   */
  public playRadarPing() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(2150, now);
      osc.frequency.exponentialRampToValueAtTime(1950, now + 0.6);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.72);
    } catch {
      // Ignored
    }
  }

  public playSonarPing() {
    this.playRadarPing();
  }

  /**
   * EMP / Defensive mitigation countermeasure discharge
   */
  public playEmpDischarge() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(3200, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // Ignored
    }
  }

  /**
   * High-orbit satellite reconnaissance telemetry scan chirp
   */
  public playOrbitalScan() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      if (now - this.lastScanTime < 0.25) return;
      this.lastScanTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1750, now);
      osc.frequency.exponentialRampToValueAtTime(2600, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.28);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(4.5, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.31);
    } catch {
      // Ignored
    }
  }

  /**
   * Defensive kinetic interception: metallic deflection ring
   */
  public playInterception() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      [1480, 2220].forEach((freq) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.22);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.26);
      });
    } catch {
      // Ignored
    }
  }

  /**
   * Undersea fiber optic packet data pulse chirp
   */
  public playSubseaPacketPulse() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      if (now - this.lastPulseTime < 0.18) return;
      this.lastPulseTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(3100, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.04);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignored
    }
  }

  /**
   * Tactical situation alert: DEFCON computer detection sequence
   */
  public playThreatDetection() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      const pitches = [520, 780, 1040];
      pitches.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.001, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.07 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.17);
      });
    } catch {
      // Ignored
    }
  }

  /**
   * Subterranean kinetic impact detonation: sub-bass shockwave with explosive punch
   */
  public playKineticDetonation(severity: 1 | 2 | 3 | 4 = 3) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    try {
      const now = this.ctx.currentTime;
      if (now - this.lastImpactTime < 0.1) return;
      this.lastImpactTime = now;

      // Layer 1: Sub-bass shockwave punch (180Hz -> 24Hz)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(140 + severity * 25, now);
      subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.45);

      const subAmp = 0.12 + severity * 0.06;
      subGain.gain.setValueAtTime(subAmp, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 0.52);

      // Layer 2: Fast transient burst crackle
      const burstOsc = this.ctx.createOscillator();
      const burstGain = this.ctx.createGain();
      burstOsc.type = "sawtooth";
      burstOsc.frequency.setValueAtTime(650, now);
      burstOsc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

      burstGain.gain.setValueAtTime(0.08, now);
      burstGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      burstOsc.connect(burstGain);
      burstGain.connect(this.masterGain);
      burstOsc.start(now);
      burstOsc.stop(now + 0.15);
    } catch {
      // Ignored
    }
  }
}

export const soundEngine = new SoundEngine();
