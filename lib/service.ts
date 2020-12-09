import { Inject, Injectable } from "@nestjs/common";
import { QUEUE_OPTIONS } from "./constants";
import { SqsQueueDriver } from "./drivers/sqs";
import { QueueDriver, QueueOptions, SqsBrokerOption } from "./interfaces";
import { QueueMetadata } from "./metadata";

@Injectable()
export class QueueService {
  private static connections: Record<string, any> = {};
  private connectionDrivers = { sqs: SqsQueueDriver, sync: SqsQueueDriver };

  constructor(@Inject(QUEUE_OPTIONS) private options: QueueOptions) {
    for (const connName in this.options.connections) {
      const connection = this.options.connections[connName];
      QueueService.connections[connName] = new this.connectionDrivers[
        connection.driver
      ](connection as SqsBrokerOption);
    }
  }

  static getConnection(connection: string | undefined): QueueDriver {
    const options = QueueMetadata.getData();
    if (!connection) connection = options.default;
    return QueueService.connections[connection];
  }
}
