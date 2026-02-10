import type { FastifyInstance } from 'fastify';

export const registerNotFound = (app: FastifyInstance) => {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'not_found' });
  });
};
