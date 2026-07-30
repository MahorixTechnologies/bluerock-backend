import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

function getErrorMessage(payload: unknown, exception: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') return maybeMessage;
    if (Array.isArray(maybeMessage)) {
      const first = (maybeMessage as unknown[])[0];
      if (typeof first === 'string') return first;
    }
  }
  if (exception && typeof exception === 'object') {
    const maybeMessage = (exception as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') return maybeMessage;
  }
  return 'Request failed';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp ? exception.getResponse() : null;
    const message = getErrorMessage(payload, exception);

    response.status(status).json({
      success: false,
      message,
      data: null,
    });
  }
}
