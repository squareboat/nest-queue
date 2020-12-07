import { InternalMessage, QueueDriver, SqsBrokerOption } from "../interfaces";
import AWS = require("aws-sdk");
import { SqsJob } from "../jobs/sqsJob";

export class SqsQueueDriver implements QueueDriver {
  private client: AWS.SQS;
  private queueUrl: string;

  constructor(private options: SqsBrokerOption) {
    AWS.config.update({ region: options.region });
    const credential = new AWS.SharedIniFileCredentials({
      profile: options.profile,
    });
    AWS.config.credentials = credential;
    this.client = new AWS.SQS({ apiVersion: options.apiVersion });
    this.queueUrl = options.prefix + "/" + options.queue;
  }

  async push(message: string, rawPayload: InternalMessage): Promise<void> {
    const params = {
      DelaySeconds: rawPayload.delay,
      MessageBody: message,
      QueueUrl: this.options.prefix + "/" + rawPayload.queue,
    };

    await this.client.sendMessage(params).promise().then();
    return;
  }

  async pull(options: Record<string, any>): Promise<SqsJob | null> {
    const params = {
      MaxNumberOfMessages: 1,
      MessageAttributeNames: ["All"],
      QueueUrl: this.options.prefix + "/" + options.queue,
      VisibilityTimeout: 30,
      WaitTimeSeconds: 0,
    };
    const response = await this.client.receiveMessage(params).promise();
    const message = response.Messages ? response.Messages[0] : null;
    return message ? new SqsJob(message) : null;
  }

  async remove(job: SqsJob, options: Record<string, any>): Promise<void> {
    const params = {
      QueueUrl: this.options.prefix + "/" + options.queue,
      ReceiptHandle: job.data.ReceiptHandle,
    };

    await this.client.deleteMessage(params).promise();

    return;
  }

  async purge(options: Record<string, any>): Promise<void> {
    const params = {
      QueueUrl: this.options.prefix + "/" + options.queue,
    };

    await this.client.purgeQueue(params).promise();

    return;
  }
}
