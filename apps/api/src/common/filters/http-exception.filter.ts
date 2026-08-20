import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}

/**
 * Every error leaves the API in the same shape, so the frontend has exactly one
 * thing to parse.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errors } = this.normalise(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${request.method} ${request.url} — ${message}`, exception as Error);
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private normalise(exception: unknown): {
    status: number;
    message: string;
    errors?: string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { status, message: payload };
      }

      const record = payload as { message?: string | string[]; error?: string };
      if (Array.isArray(record.message)) {
        return {
          status,
          message: record.error ?? 'Validation failed.',
          errors: record.message,
        };
      }
      return { status, message: record.message ?? exception.message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid data supplied.' };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again.',
    };
  }

  private fromPrisma(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    const target = (error.meta?.target as string[] | undefined)?.join(', ');

    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: target ? `A record with this ${target} already exists.` : 'Duplicate record.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist.',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found.' };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error.',
        };
    }
  }
}
