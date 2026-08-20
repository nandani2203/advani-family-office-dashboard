import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PermissionLevel, PermissionResource, Role, UserStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const normaliseEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** The fields an administrator may change on an existing account. */
export class MutableUserFieldsDto {
  @ApiPropertyOptional({ example: 'Priya Advani' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class CreateUserDto extends MutableUserFieldsDto {
  @ApiProperty({ example: 'priya@advanifamilyoffice.com' })
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;
}

// Email is the sign-in identity, so it is immutable — changing it would hand
// one person's account and audit trail to another address.
export class UpdateUserDto extends PartialType(MutableUserFieldsDto) {}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

/** One resource's grant. `level: null` clears the override back to base role. */
export class UpdateGrantDto {
  @ApiProperty({ enum: PermissionResource })
  @IsEnum(PermissionResource)
  resource!: PermissionResource;

  @ApiProperty({ enum: PermissionLevel, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsEnum(PermissionLevel)
  level!: PermissionLevel | null;
}

export class UpdateUserPermissionsDto {
  @ApiProperty({ type: [UpdateGrantDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => UpdateGrantDto)
  grants!: UpdateGrantDto[];
}

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ example: 'investment' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ example: 'update' })
  @IsOptional()
  @IsString()
  action?: string;
}
