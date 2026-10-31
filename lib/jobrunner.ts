import {
  DriverJob,
  InternalMessage,
  QueueDriver,
} from "@squareboat/nest-queue-strategy";
import { ListenerOptions } from "./interfaces";
import { QueueMetadata } from "./metadata";
import { Dispatch } from "./queue";
import { EmitsEvent } from "@squareboat/nest-events";
import { JobFailed, JobProcessed, JobProcessing } from "./events";
import { ConsoleIO, Logger } from "@squareboat/nest-console";

export class JobRunner {
  private consoleIo: ConsoleIO;

  constructor(
    private options: ListenerOptions,
    private connection: QueueDriver
  ) {
    this.consoleIo = new ConsoleIO("", {});
  }

  async run(job: DriverJob) {
    const message = this.fetchMessage(job);
    const { data } = message;
    this.log("info", `LOG [${message.job}] Job Processing...`);
    try {
      const targetJob = QueueMetadata.getJob(message.job);
      if (!targetJob || !targetJob.target) {
        // fail like a throwing job (logged, JobFailed, retried up to `tries`)
        // instead of dropping the message silently
        throw new Error(`No handler is registered for job "${message.job}"`);
      }
      await this.emit(new JobProcessing(message, job), message);
      await targetJob.target(data);
    } catch (e) {
      this.log(
        "error",
        `LOG [${message.job}] Job Failed | Error: ${errorMessage(e)}`
      );
      await this.emit(new JobFailed(message, job, e), message);
      await this.retry(message, job);
      return;
    }

    // outside the try: a failing remove() is not a failed job (no retry)
    await this.success(message, job);
    this.log("success", `LOG [${message.job}] Job Processed`);
  }

  /**
   * Run the event's listeners and wait for them. A throwing listener is
   * logged and never fails the job or crashes the worker.
   */
  private async emit(event: EmitsEvent, message: InternalMessage): Promise<void> {
    try {
      await event.emit();
    } catch (e) {
      this.log(
        "error",
        `LOG [${message.job}] ${event.constructor.name} listener failed | Error: ${errorMessage(e)}`
      );
    }
  }

  log(level: string, msg: string): void {
    if (!this.options.logger) return;
    let logger = undefined;
    switch (level) {
      case "info":
        logger = Logger.info;
        break;
      case "success":
        logger = Logger.success;
        break;
      case "error":
        logger = Logger.error;
        break;
      case "warn":
        logger = Logger.warn;
        break;
    }

    logger && logger(msg);
  }

  /**
   * Job processed succesfully method
   * @param message
   * @param job
   */
  async success(message: InternalMessage, job: DriverJob): Promise<void> {
    await this.removeJobFromQueue(job);
    await this.emit(new JobProcessed(message, job), message);
  }

  /**
   * Retry job after it has failed
   * @param message
   * @param job
   */
  async retry(message: InternalMessage, job: DriverJob): Promise<void> {
    // remove exactly once: SQS rejects a second DeleteMessage for the same
    // receipt handle, which used to skip the re-dispatch below (job lost)
    await this.removeJobFromQueue(job);
    message.attemptCount += 1;
    if (message.attemptCount === message.tries) return;
    await Dispatch(message);
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

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
