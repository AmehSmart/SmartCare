import type { FastifyRequest } from 'fastify';

export type RequestPrincipal = {
  subject: string;
  sessionId: string;
  tokenExpiresAt: Date;
};

export type AuthenticatedRequest = FastifyRequest & { principal: RequestPrincipal };
