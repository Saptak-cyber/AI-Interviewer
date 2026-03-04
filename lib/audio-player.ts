/**
 * lib/audio-player.ts  (browser-only)
 *
 * Plays a stream of MP3 audio segments (one per sentence from the server)
 * without gaps between them.
 *
 * How it works:
 *  - Each call to `enqueue(mp3Buffer)` decodes an MP3 segment via Web Audio API
 *    and schedules it to play immediately after the previous segment.
 *  - A generation counter ensures that a stop() call cancels all pending
 *    decodes from the previous queue, even if they're already in flight.
 *  - `onPlaybackEnd` fires when the last queued segment finishes playing.
 */

export class AudioStreamPlayer {
  private ctx: AudioContext | null = null;
  private chain: Promise<void> = Promise.resolve();
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private generation = 0;
  private pendingDecodes = 0; // chunks enqueued but not yet scheduled
  onPlaybackEnd: (() => void) | null = null;

  // Lazily create AudioContext on first use (requires user gesture on some browsers)
  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    // Resume if suspended (e.g. after calling ctx.suspend() while muted)
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Enqueue an MP3 segment (as raw ArrayBuffer).
   * Decoding and scheduling happen asynchronously but in strict order.
   */
  enqueue(mp3Buffer: ArrayBuffer): void {
    const gen = this.generation;
    this.pendingDecodes++;

    this.chain = this.chain.then(async () => {
      // If stop() was called since this enqueue, bail out
      if (this.generation !== gen) {
        this.pendingDecodes--;
        return;
      }

      const ctx = this.getCtx();
      let audioBuffer: AudioBuffer;

      try {
        // decodeAudioData consumes the buffer — clone it first
        audioBuffer = await ctx.decodeAudioData(mp3Buffer.slice(0));
      } catch (err) {
        console.warn("[AudioStreamPlayer] Failed to decode MP3 segment:", err);
        this.pendingDecodes--;
        return;
      }

      if (this.generation !== gen) {
        this.pendingDecodes--;
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Schedule back-to-back: start right after the previous segment ends
      const startTime = Math.max(ctx.currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
      this.activeSources.push(source);
      this.pendingDecodes--; // now scheduled — no longer pending

      source.onended = () => {
        // Remove from active list
        this.activeSources = this.activeSources.filter((s) => s !== source);
        // Only fire end callback when nothing is playing AND nothing still decoding
        if (this.activeSources.length === 0 && this.pendingDecodes === 0 && this.generation === gen) {
          this.onPlaybackEnd?.();
        }
      };
    });
  }

  /**
   * Immediately stop all playing and queued audio.
   * Safe to call at any time (e.g. on user barge-in).
   */
  stop(): void {
    this.generation++; // invalidates all pending enqueue callbacks
    this.pendingDecodes = 0;

    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        // Already stopped — ignore
      }
    }
    this.activeSources = [];
    this.nextStartTime = 0;
    this.chain = Promise.resolve(); // let GC collect the old chain
  }

  /** Check if any audio is currently playing or scheduled. */
  get isPlaying(): boolean {
    return this.activeSources.length > 0 || this.pendingDecodes > 0;
  }

  /** Fully tear down (call when the component unmounts). */
  destroy(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
