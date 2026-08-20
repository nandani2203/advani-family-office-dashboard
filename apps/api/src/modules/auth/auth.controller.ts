import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuthService, OtpChallenge, PublicUser, SessionResponse } from './auth.service';
import { RefreshTokenDto, RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Public sign-in configuration for the login screen.' })
  config(): { openSignup: boolean } {
    return this.authService.getPublicConfig();
  }

  @Public()
  // OTP issuance is the most abusable endpoint here, so it gets its own limit.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a one-time sign-in code to an email address.' })
  requestOtp(@Body() dto: RequestOtpDto): Promise<OtpChallenge> {
    return this.authService.requestOtp(dto.email);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a one-time code for an access + refresh token pair.' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<SessionResponse> {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a fresh session.' })
  refresh(@Body() dto: RefreshTokenDto): Promise<SessionResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session.' })
  logout(
    @Body() dto: Partial<RefreshTokenDto>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    return this.authService.logout(dto?.refreshToken, user.id);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user.' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.authService.me(user.id);
  }
}
