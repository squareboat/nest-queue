import { ListensTo } from "@squareboat/nest-events";

export const QUEUE_OPTIONS = "__QUEUE_OPTIONS__";
export const JOB_NAME = "__JOB_NAME__";
export const JOB_OPTIONS = "__JOB_OPTIONS__";

export const events = {
  jobFailed: "sqb-queue::job-failed",
  jobProcessing: "sqb-queue::job-processing",
  jobProcessed: "sqb-queue::job-processed",
};

export function OnJobFailed() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    ListensTo(events.jobFailed)(target, propertyKey, descriptor);
  };
}

export function OnJobProcessing() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    ListensTo(events.jobProcessing)(target, propertyKey, descriptor);
  };
}

export function OnJobProcessed() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    ListensTo(events.jobProcessed)(target, propertyKey, descriptor);
  };
}
