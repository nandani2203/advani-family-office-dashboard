import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

const normaliseEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RequestOtpDto {
  @ApiProperty({ example: 'ops@advanifamilyoffice.com' })
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'ops@advanifamilyoffice.com' })
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @ApiProperty({ example: '361893', description: 'The 6-digit one-time code.' })
  @IsString()
  @Length(6, 6, { message: 'The code is 6 digits.' })
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits.' })
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
