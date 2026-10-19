import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";

export async function createBase({ logger = false, bodyLimit = 8192 } = {}) {
  const app = Fastify({
    logger,
    bodyLimit,
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(request.hostname))
      return reply.code(403).send({ message: "Local access only." });
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (
        request.headers.origin &&
        request.headers.origin !== `http://${request.headers.host}`
      )
        return reply.code(403).send({ message: "Origin is not permitted." });
      if (request.headers["x-commit-zero"] !== "local-demo")
        return reply
          .code(403)
          .send({ message: "Missing local operator header." });
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error.validation)
      return reply
        .code(400)
        .send({ message: "Please check the submitted fields." });
    const code = error.statusCode || 500;
    if (code >= 500) request.log.error({ err: error }, "Request failed");
    return reply.code(code).send({
      message:
        code >= 500 ? "Service unavailable. Please try again." : error.message,
    });
  });
  return app;
}

export function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}
