import { Inject, Injectable } from "@nestjs/common";
import { QUEUE_OPTIONS } from "./constants";
import { QueueOptions } from "./interfaces";
import { QueueMetadata } from "./metadata";
import { QueueDriver } from "@squareboat/nest-queue-strategy";

@Injectable()
export class QueueService {
  private static connections: Record<string, any> = {};

  constructor(@Inject(QUEUE_OPTIONS) private options: QueueOptions) {
    for (const connName in this.options.connections) {
      const connection = this.options.connections[connName];
      const driver: any = connection.driver;
      QueueService.connections[connName] = new driver(connection);
    }
  }

  static getConnection(connection: string | undefined): QueueDriver {
    const options = QueueMetadata.getData();
    if (!connection) connection = options.default;
    return QueueService.connections[connection];
  }
}
