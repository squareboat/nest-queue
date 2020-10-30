import { DriverJob } from './driverJob';

export class SqsJob extends DriverJob {
  public getMessage(): string {
    return this.data.Body;
  }
}
