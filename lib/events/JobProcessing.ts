import { EmitsEvent, Event } from "@squareboat/nest-events";
import { events } from "../constants";

@Event(events.jobProcessing)
export class JobProcessing extends EmitsEvent {
  constructor(public message: any, public job: any) {
    super();
  }
}
