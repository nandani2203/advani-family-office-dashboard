import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({ description: 'Free-text search across the main text columns.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Column to sort by.' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function paginate<T>(data: T[], total: number, query: PaginationQueryDto): Paginated<T> {
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/**
 * Guards against SQL-injection-by-orderBy: only columns we explicitly allow can
 * reach Prisma's `orderBy`.
 */
export function resolveOrderBy<T extends string>(
  query: PaginationQueryDto,
  allowed: readonly T[],
  fallback: T,
  /** Direction used when the caller did not ask for a specific sort column. */
  defaultDir: 'asc' | 'desc' = 'desc',
): Record<string, 'asc' | 'desc'> {
  const column = allowed.includes(query.sortBy as T) ? (query.sortBy as T) : fallback;
  const direction = query.sortBy ? query.sortDir : defaultDir;
  return { [column]: direction };
}
