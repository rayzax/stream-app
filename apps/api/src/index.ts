import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

const port = parseInt(process.env.PORT || "8080", 10);
const host = process.env.HOST || "0.0.0.0";

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors);
await fastify.register(cookie);

// Health check route
fastify.get("/healthz", async (request, reply) => {
  return { status: "ok" };
});

// Start server
try {
  await fastify.listen({ port, host });
  console.log(`Server listening on http://${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
