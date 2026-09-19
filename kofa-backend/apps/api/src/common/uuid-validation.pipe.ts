import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export class UuidValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const parsed = z.string().uuid().safeParse(value);
    if (!parsed.success) throw new BadRequestException('Route identifier must be a UUID');
    return parsed.data;
  }
}
