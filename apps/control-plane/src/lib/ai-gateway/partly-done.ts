/**
 * A change that stopped partway: `done` is what had already been written
 * when `step` threw `failure` (#384 review, low). The owner's AI routes
 * catch it, put `done` on the request's audit row and throw `failure` on,
 * so the answer is the error it always was while the row still says what
 * moved (a key retired, settings saved).
 *
 * Why an error and not a callback or an out-parameter: the audit row is
 * written by the audit middleware from what the handler noted, error
 * answers included (`noteAuditChanges`); carrying the partial result up
 * leaves that pattern, the lib's signatures and the happy path as they
 * are. `failure` is never put in the row or a log as it is: only its
 * class name and loggable code (`codeSummary`).
 */
export class PartlyDoneError<T> extends Error {
  constructor(
    readonly done: T,
    readonly step: string,
    readonly failure: unknown
  ) {
    super("cp.ai_partly_done")
    this.name = "PartlyDoneError"
  }
}
