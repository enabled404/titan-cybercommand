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
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private volume: number = 0.4;
  private isInitialized: boolean = false;

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
   * Tactical background reactor drone (55Hz sub-bass ambient hum)
   */
  public startDrone() {
    if (this.isMuted || !this.ctx || !this.masterGain || this.droneOsc) return;

    try {
      const now = this.ctx.currentTime;
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = "sine";
      this.droneOsc.frequency.setValueAtTime(55, now);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = "lowpass";
      this.droneFilter.frequency.setValueAtTime(110, now);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.08, now + 2);

      this.droneOsc.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc.start(now);
    } catch {
      // Audio error fallback
    }
  }

  public stopDrone() {
    if (this.droneOsc && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        if (this.droneGain) {
          this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        }
        this.droneOsc.stop(now + 0.5);
      } catch {
        // Ignored
      }
      this.droneOsc = null;
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
}

export const soundEngine = new SoundEngine();
