import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { DistributionStatus } from '@prisma/client';
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

export class CreateDistributionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  investmentId!: string;

  @ApiProperty({ example: '2025-02-10' })
  @IsDateString()
  declaredDate!: string;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ example: 3_200_000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grossAmount!: number;

  @ApiPropertyOptional({ example: 480_000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  withholdingTax?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: DistributionStatus, default: DistributionStatus.DECLARED })
  @IsOptional()
  @IsEnum(DistributionStatus)
  status?: DistributionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// investmentId is immutable once a distribution exists — reassigning a payout
// to a different position would silently corrupt both positions' history.
export class UpdateDistributionDto extends PartialType(
  OmitType(CreateDistributionDto, ['investmentId'] as const),
) {}

export class DistributionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  investmentId?: string;

  @ApiPropertyOptional({ enum: DistributionStatus })
  @IsOptional()
  @IsEnum(DistributionStatus)
  status?: DistributionStatus;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class UpdateDistributionStatusDto {
  @ApiProperty({ enum: DistributionStatus })
  @IsEnum(DistributionStatus)
  status!: DistributionStatus;

  @ApiPropertyOptional({ example: '2025-03-01', description: 'Required when moving to PAID.' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
