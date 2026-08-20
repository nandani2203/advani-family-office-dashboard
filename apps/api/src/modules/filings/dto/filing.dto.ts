import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FilingStatus, FilingType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateFilingDto {
  @ApiProperty({ example: 'Advani SPV VII — SpaceX' })
  @IsString()
  @MaxLength(160)
  vehicleName!: string;

  @ApiProperty({ enum: FilingType })
  @IsEnum(FilingType)
  type!: FilingType;

  @ApiPropertyOptional({ example: 'Delaware, US' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  jurisdiction?: string;

  @ApiProperty({ example: '2025-09-30' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ enum: FilingStatus, default: FilingStatus.OPEN })
  @IsOptional()
  @IsEnum(FilingStatus)
  status?: FilingStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateFilingDto extends PartialType(CreateFilingDto) {}

export class FilingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FilingType })
  @IsOptional()
  @IsEnum(FilingType)
  type?: FilingType;

  @ApiPropertyOptional({ enum: FilingStatus })
  @IsOptional()
  @IsEnum(FilingStatus)
  status?: FilingStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Only filings due within the next 30 days that are not closed.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  dueSoon?: boolean;
}
