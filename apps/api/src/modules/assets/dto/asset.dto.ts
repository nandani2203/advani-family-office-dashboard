import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateAssetDto {
  @ApiProperty({ example: 'SpaceX' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiPropertyOptional({ example: 'SPCX' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ticker?: string;

  @ApiPropertyOptional({ example: 'Aerospace' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sector?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {}

export class AssetQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AssetType })
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sector?: string;
}
