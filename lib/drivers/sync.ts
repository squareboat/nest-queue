import {
  DriverJob,
  InternalMessage,
  QueueDriver,
} from "@squareboat/nest-queue-strategy";
import { QueueMetadata } from "../metadata";

export class SyncQueueDriver implements QueueDriver {
  constructor() {}

  /**
   * Runs the job right away. `Dispatch()` resolves when the job is done and
   * rejects with the job's error.
   */
  async push(message: string, rawPayload: InternalMessage): Promise<void> {
    const job = QueueMetadata.getJob(rawPayload.job);
    if (!job || !job.target) {
      throw new Error(`No handler is registered for job "${rawPayload.job}"`);
    }
    await job.target(rawPayload.data);
  }

  async pull(options: Record<string, any>): Promise<DriverJob | null> {
    return null;
  }

  async remove(job: DriverJob, options: Record<string, any>): Promise<void> {
    return;
  }

  async purge(options: Record<string, any>): Promise<void> {
    return;
  }

  async count(options: Record<string, any>): Promise<number> {
    return 0;
  }
}
