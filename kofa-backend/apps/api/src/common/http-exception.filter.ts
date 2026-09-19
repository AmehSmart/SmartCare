import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof ZodError
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const value = error instanceof HttpException ? error.getResponse() : undefined;
    const message =
      typeof value === 'string'
        ? value
        : isRecord(value) && typeof value.message === 'string'
          ? value.message
          : error instanceof ZodError
            ? 'Request validation failed'
            : status === 500
              ? 'Internal server error'
              : 'Request failed';
    const code = isRecord(value) && typeof value.code === 'string' ? value.code : `HTTP_${status}`;
    void response.status(status).send({
      statusCode: status,
      code,
      message,
      ...(error instanceof ZodError
        ? { issues: error.issues }
        : isRecord(value) && Array.isArray(value.issues)
          ? { issues: value.issues }
          : {}),
      ...(isRecord(value) && typeof value.emergencyEligible === 'boolean'
        ? { emergencyEligible: value.emergencyEligible }
        : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
