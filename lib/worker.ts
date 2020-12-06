import { EmitEvent } from "@squareboat/nest-events";
import { JobFailed, JobProcessed, JobProcessing } from "./events";
import { InternalMessage, ListenerOptions, QueueDriver } from "./interfaces";
import { DriverJob } from "./jobs";
import { QueueMetadata } from "./metadata";
import { Dispatch } from "./queue";

export class QueueWorker {
  constructor(
    private options: ListenerOptions,
    private connection: QueueDriver
  ) {}

  async run(job: DriverJob) {
    const message = this.fetchMessage(job);
    EmitEvent(new JobProcessing(), { job: message });
    const { data } = message;
    try {
      const targetJob = QueueMetadata.getJob(message.job);
      if (!targetJob || !targetJob.target) return;

      await targetJob.target(data);
      await this.success(message, job);
      EmitEvent(new JobProcessed(), { job: message });
    } catch (e) {
      EmitEvent(new JobFailed(), { job: message, error: e });
      await this.retry(message, job);
    }
  }

  /**
   * Job processed succesfully method
   * @param message
   * @param job
   */
  async success(message: InternalMessage, job: DriverJob): Promise<void> {
    await this.removeJobFromQueue(job);
  }

  /**
   * Retry job after it has failed
   * @param message
   * @param job
   */
  async retry(message: InternalMessage, job: DriverJob): Promise<void> {
    this.removeJobFromQueue(job);
    await this.removeJobFromQueue(job);
    message.attemptCount += 1;
    if (message.attemptCount === message.tries) return;
    Dispatch(message);
  }

  /**
   * Remove job from the queue method
   * @param job
   */
  async removeJobFromQueue(job: DriverJob): Promise<void> {
    await this.connection.remove(job, this.options);
  }

  /**
   * Fetch message out of the driver message
   * @param job
   */
  fetchMessage(job: DriverJob): InternalMessage {
    return JSON.parse(job.getMessage());
  }
}
