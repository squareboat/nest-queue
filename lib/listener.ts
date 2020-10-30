import { ListenerOptions, QueueDriver } from "./interfaces";
import { DriverJob } from "./jobs";
import { QueueMetadata } from "./metadata";
import { QueueService } from "./service";
import { QueueWorker } from "./worker";

export class QueueListener {
  private options: ListenerOptions;

  constructor(options?: ListenerOptions) {
    const defaultOptions = QueueMetadata.getDefaultOptions();
    this.options = options || {};
    this.options = {
      ...defaultOptions,
      queue: undefined,
      ...this.options,
    };

    if (!this.options.queue) {
      const data = QueueMetadata.getData();
      this.options["queue"] =
        data.connections[
          this.options.connection || defaultOptions.connection
        ].queue;
    }
  }

  static init(options?: ListenerOptions): QueueListener {
    return new QueueListener(options);
  }

  private async poll(connection: QueueDriver): Promise<DriverJob | null> {
    const job = await connection.pull({ queue: this.options.queue });
    return job;
  }

  async run() {
    const connection = QueueService.getConnection(this.options.connection);
    const worker = new QueueWorker(this.options, connection);

    while (1) {
      const job = await this.poll(connection);
      if (job) {
        await worker.run(job);
      } else {
        await new Promise((resolve) => setTimeout(resolve, this.options.sleep));
      }
    }
  }
}
