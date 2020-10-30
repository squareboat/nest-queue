import { Inject, Injectable } from "@nestjs/common";
import { QUEUE_OPTIONS } from "./constants";
import { SqsQueueDriver } from "./drivers/sqs";
import { QueueDriver, QueueOptions } from "./interfaces";
import { QueueMetadata } from "./metadata";

@Injectable()
export class QueueService {
  private connectionDrivers = { sqs: SqsQueueDriver };
  private static connections: Record<string, QueueDriver> = {};
  constructor(@Inject(QUEUE_OPTIONS) private options: QueueOptions) {
    for (const connName in this.options.connections) {
      const connection = this.options.connections[connName];
      QueueService.connections[connName] = new this.connectionDrivers[
        connection.driver
      ](connection);
    }
  }

  static getConnection(connection: string | undefined): QueueDriver {
    const options = QueueMetadata.getData();
    if (!connection) connection = options.default;
    return QueueService.connections[connection];
  }
}
