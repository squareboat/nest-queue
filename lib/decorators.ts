import { ListensTo } from "@squareboat/nest-events";
import { JobOptions } from "@squareboat/nest-queue-strategy";
import "reflect-metadata";
import { events, JOB_NAME, JOB_OPTIONS } from "./constants";

export function Job(job: string, options?: JobOptions) {
  options = options || {};
  return function (target: Record<string, any>, propertyKey: string) {
    Reflect.defineMetadata(JOB_NAME, job, target, propertyKey);
    Reflect.defineMetadata(JOB_OPTIONS, options, target, propertyKey);
  };
}

/**
 * Decorator for running methods on any failed jobs
 */
export function OnJobFailed() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    ListensTo(events.jobFailed)(target, propertyKey, descriptor);
  };
}

/**
 * Decorator for running methods on job processing
 */
export function OnJobProcessing() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    ListensTo(events.jobProcessing)(target, propertyKey, descriptor);
  };
}

/**
 * Decorator for running methods on any processed jobs
 */
export function OnJobProcessed() {
  return function (
    target: Record<string, any>,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    ListensTo(events.jobProcessed)(target, propertyKey, descriptor);
  };
}
