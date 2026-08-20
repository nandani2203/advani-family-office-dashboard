import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * Money leaves the office for calls, purchases and fees; it comes back on
 * sales, dividends and interest. Clients may override, but this is the default.
 */
export const DIRECTION_BY_TYPE: Record<TransactionType, TransactionDirection> = {
  [TransactionType.CAPITAL_CALL]: TransactionDirection.OUTFLOW,
  [TransactionType.PURCHASE]: TransactionDirection.OUTFLOW,
  [TransactionType.FEE]: TransactionDirection.OUTFLOW,
  [TransactionType.SALE]: TransactionDirection.INFLOW,
  [TransactionType.DIVIDEND]: TransactionDirection.INFLOW,
  [TransactionType.INTEREST]: TransactionDirection.INFLOW,
};

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  investmentId!: string;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiPropertyOptional({
    enum: TransactionDirection,
    description: 'Defaults to the natural direction for the transaction type.',
  })
  @IsOptional()
  @IsEnum(TransactionDirection)
  direction?: TransactionDirection;

  @ApiProperty({ example: 1_500_000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  fxRate?: number;

  @ApiProperty({ example: '2025-03-14' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ enum: TransactionStatus, default: TransactionStatus.SETTLED })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ example: 'WIRE-2025-0314-08' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}

export class TransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  investmentId?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: TransactionDirection })
  @IsOptional()
  @IsEnum(TransactionDirection)
  direction?: TransactionDirection;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
