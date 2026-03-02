export type EventHandler = (...args: unknown[]) => unknown | Promise<unknown>

export interface DefinedEventHandler {
  readonly __flowDockEventHandler: true
  readonly handler: EventHandler
}
