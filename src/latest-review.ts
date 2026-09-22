import { REVIEW_TIMEOUT_MS, ReviewError, type Review } from "./review.ts";

/** Owns cancellation, deadline, and publication; providers may ignore abort. */
export class LatestReview {
  private generation = 0;
  private controller?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;

  cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  start(
    task: (signal: AbortSignal) => Promise<Review>,
    onResult: (review: Review) => void,
    onError: (error: ReviewError) => void,
    timeoutMs = REVIEW_TIMEOUT_MS,
  ): void {
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.cancel();
      onError(new ReviewError("The review timed out. Your work continues normally."));
    }, timeoutMs);
    this.timer.unref?.();

    // Defer even synchronous setup so the input hook returns immediately.
    void Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return task(controller.signal);
    }).then((review) => {
      if (generation === this.generation && !controller.signal.aborted) onResult(review);
    }).catch((error: unknown) => {
      if (generation !== this.generation || controller.signal.aborted) return;
      onError(error instanceof ReviewError ? error : new ReviewError("Could not complete the review."));
    }).finally(() => {
      if (generation !== this.generation) return;
      clearTimeout(this.timer);
      this.timer = undefined;
      this.controller = undefined;
    });
  }
}
