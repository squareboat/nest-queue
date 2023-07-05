import { EmitsEvent, Event } from "@squareboat/nest-events";
import { events } from "../constants";

@Event(events.jobFailed)
export class JobFailed extends EmitsEvent {
  constructor(public message: any, public job: any) {
    super();
  }
}
