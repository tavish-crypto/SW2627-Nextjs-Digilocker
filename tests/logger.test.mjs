import test from "node:test";
import assert from "node:assert/strict";

const loggerModule = await import("../src/lib/logger.js");

const { logger, createTraceId, getTraceId, withTraceId } = loggerModule;

test("shared logger singleton and default level are configured for server use", () => {
  const reloaded = import("../src/lib/logger.js");

  assert.equal(typeof logger.info, "function");
  assert.equal(typeof logger.error, "function");
  assert.equal(logger.level, "info");

  return reloaded.then((module) => {
    assert.equal(module.logger, logger);
  });
});

test("trace context is created and propagated within a request-scoped execution", () => {
  const traceId = createTraceId();

  withTraceId(traceId, () => {
    assert.equal(getTraceId(), traceId);
  });

  assert.equal(getTraceId(), null);
});
