import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { InvestmentStatus, VehicleType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateInvestmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assetId!: string;

  @ApiProperty({ enum: VehicleType, default: VehicleType.SPV })
  @IsEnum(VehicleType)
  vehicle!: VehicleType;

  @ApiProperty({ example: 'Advani SPV VII — SpaceX' })
  @IsString()
  @MaxLength(160)
  vehicleName!: string;

  @ApiProperty({ example: 25_000_000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  committedAmount!: number;

  @ApiProperty({ example: 25_000_000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  investedAmount!: number;

  @ApiProperty({ example: 25_000_000, description: 'What we paid, for gain/loss maths.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costBasis!: number;

  @ApiProperty({ example: 41_500_000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentValuation!: number;

  @ApiPropertyOptional({ example: 0.42, description: 'Percent, 0–100.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  ownershipPct?: number;

  @ApiPropertyOptional({ enum: InvestmentStatus, default: InvestmentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(InvestmentStatus)
  status?: InvestmentStatus;

  @ApiProperty({ example: '2023-04-18' })
  @IsDateString()
  investedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateInvestmentDto extends PartialType(CreateInvestmentDto) {}

export class InvestmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvestmentStatus })
  @IsOptional()
  @IsEnum(InvestmentStatus)
  status?: InvestmentStatus;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicle?: VehicleType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assetId?: string;
}

export class CreateValuationDto {
  @ApiProperty({ example: '2025-06-30' })
  @IsDateString()
  asOf!: string;

  @ApiProperty({ example: 41_500_000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ example: 'Q2 2025 secondary mark' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200)
  source?: string;
}
