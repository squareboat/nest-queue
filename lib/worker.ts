import { ListenerOptions } from "./interfaces";
import { QueueMetadata } from "./metadata";
import { QueueService } from "./service";
import { JobRunner } from "./jobrunner";
import { DriverJob, QueueDriver } from "@squareboat/nest-queue-strategy";
import { Logger } from "@squareboat/nest-console";

export class QueueWorker {
  private options: ListenerOptions;

  constructor(options?: ListenerOptions) {
    const defaultOptions = QueueMetadata.getDefaultOptions();
    this.options = options || {};
    this.options = {
      ...defaultOptions,
      schedulerInterval: 10000,
      queue: undefined,
      logger: true,
      ...this.options,
    };

    if (!this.options.queue) {
      const data = QueueMetadata.getData();
      this.options["queue"] = data.connections[
        this.options.connection || defaultOptions.connection
      ].queue as string;
    }
  }

  static init(options?: ListenerOptions): QueueWorker {
    return new QueueWorker(options);
  }

  private async poll(connection: QueueDriver): Promise<DriverJob | null> {
    const job = await connection.pull({ queue: this.options.queue });
    return job;
  }

  /**
   * Listen to the queue
   */
  async listen() {
    this.log("info", "LOG [QueueWorker] Queue Worker Initialised");
    const connection = QueueService.getConnection(this.options.connection);

    // perform scheduled task of the driver
    if (connection.scheduledTask) this.performScheduledTask(connection);

    const runner = new JobRunner(this.options, connection);
    while (1) {
      let job: DriverJob | null;
      try {
        job = await this.poll(connection);
      } catch (e) {
        // e.g. a network error: log it and try again after `sleep`
        this.log("error", `LOG [QueueWorker] Could not fetch a job | Error: ${errorMessage(e)}`);
        await new Promise((resolve) => setTimeout(resolve, this.options.sleep));
        continue;
      }

      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, this.options.sleep));
        continue;
      }

      // a failing run (e.g. the driver could not remove or re-dispatch the job)
      // must not end the worker loop
      try {
        await runner.run(job);
      } catch (e) {
        this.log("error", `LOG [QueueWorker] Job run failed | Error: ${errorMessage(e)}`);
      }
    }
  }

  private async performScheduledTask(connection: QueueDriver) {
    if (!connection || !connection.scheduledTask) return;
    let running = false;
    setInterval(async () => {
      // skip a tick while the previous one is still running, and never let a
      // failing tick become an unhandled rejection
      if (running || !connection.scheduledTask) return;
      running = true;
      try {
        await connection.scheduledTask(this.options);
      } catch (e) {
        this.log("error", `LOG [QueueWorker] Scheduled task failed | Error: ${errorMessage(e)}`);
      } finally {
        running = false;
      }
    }, this.options.schedulerInterval || 10000);
  }

  async purge(): Promise<void> {
    const connection = QueueService.getConnection(this.options.connection);
    await connection.purge({ queue: this.options.queue });
    return;
  }

  async count(): Promise<number> {
    const connection = QueueService.getConnection(this.options.connection);
    return await connection.count({ queue: this.options.queue });
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
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
