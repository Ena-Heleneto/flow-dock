export type EventHandler<TEvent = unknown, TResult = unknown> =
  (event: TEvent) => TResult | Promise<TResult>

export interface DefinedEventHandler<TEvent = unknown, TResult = unknown> {
  readonly __flowDockEventHandler: true
  readonly handler: EventHandler<TEvent, TResult>
}
