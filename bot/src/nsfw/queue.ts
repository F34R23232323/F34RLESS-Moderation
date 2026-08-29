export interface QueueJob {
  id: string;
  run: () => Promise<void>;
}

/**
 * Bounded in-memory FIFO queue with a fixed worker pool. Jobs that arrive when
 * the queue is full are rejected (caller decides what to do). A job id can
 * never be queued or running twice at the same time.
 */
export class BoundedQueue {
  private readonly capacity: number;
  private readonly concurrency: number;
  private readonly pending: QueueJob[] = [];
  private readonly inFlight = new Set<string>();
  private running = 0;
  private accepting = true;

  public onError: ((err: unknown, jobId: string) => void) | null = null;

  constructor(capacity: number, concurrency: number) {
    this.capacity = Math.max(1, capacity);
    this.concurrency = Math.max(1, concurrency);
  }

  public enqueue(job: QueueJob): boolean {
    if (!this.accepting) return false;
    if (this.inFlight.has(job.id)) return false;
    if (this.pending.length >= this.capacity) return false;
    this.pending.push(job);
    this.inFlight.add(job.id);
    this.pump();
    return true;
  }

  public has(id: string): boolean {
    return this.inFlight.has(id);
  }

  public get size(): number {
    return this.pending.length;
  }

  /** Stop accepting new jobs (graceful shutdown). Queued work keeps running. */
  public stop(): void {
    this.accepting = false;
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.running++;
      void this.run(job);
    }
  }

  private async run(job: QueueJob): Promise<void> {
    try {
      await job.run();
    } catch (err) {
      this.onError?.(err, job.id);
    } finally {
      this.running--;
      this.inFlight.delete(job.id);
      this.pump();
    }
  }
}