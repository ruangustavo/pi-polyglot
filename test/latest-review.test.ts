import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { LatestReview } from "../src/latest-review.ts";
import type { Review } from "../src/review.ts";
import { deferred, flush } from "./helpers.ts";

const review: Review = { text: "hello", edits: [] };
test("starts asynchronously and only the latest result wins, even when abort is ignored", async () => {
  const runner = new LatestReview();
  const first = deferred<Review>(); const second = deferred<Review>();
  const results: Review[] = []; const errors: Error[] = [];
  let signal: AbortSignal | undefined;
  runner.start((value) => { signal = value; return first.promise; }, (r) => results.push(r), (e) => errors.push(e));
  assert.equal(Boolean(signal), false);
  await flush();
  runner.start(() => second.promise, (r) => results.push(r), (e) => errors.push(e));
  assert.equal(signal?.aborted, true);
  second.resolve(review); await flush(); first.resolve({ ...review, text: "old" }); await flush();
  assert.deepEqual(results, [review]); assert.deepEqual(errors, []);
});
test("off, reconfiguration and shutdown cancellation prevent success and failure callbacks", async () => {
  for (const fail of [false, true]) {
    const runner = new LatestReview(); const job = deferred<Review>();
    let signal: AbortSignal | undefined; let publications = 0;
    runner.start((s) => { signal = s; return job.promise; }, () => publications++, () => publications++);
    await flush(); runner.cancel(); runner.cancel();
    assert.equal(signal?.aborted, true);
    if (fail) job.reject(new Error("late")); else job.resolve(review);
    await flush(); assert.equal(publications, 0);
  }
});
test("deadline ends the UI lifecycle even if a provider never settles, with no late resurrection", async () => {
  const runner = new LatestReview(); const job = deferred<Review>();
  let results = 0; const errors: Error[] = []; let signal: AbortSignal | undefined;
  runner.start((s) => { signal = s; return job.promise; }, () => results++, (error) => errors.push(error), 10);
  await sleep(25);
  assert.equal(signal?.aborted, true); assert.equal(errors.length, 1);
  assert.match(errors[0]!.message, /timed out/);
  job.resolve(review); await flush(); assert.equal(results, 0); assert.equal(errors.length, 1);
});
