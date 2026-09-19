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
export class InternalExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      error instanceof ZodError
        ? 'Request validation failed'
        : error instanceof HttpException
          ? error.message
          : 'Internal server error';
    void reply.status(status).send({
      statusCode: status,
      message,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });
  }
}
