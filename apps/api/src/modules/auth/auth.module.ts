import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // Global so the app-wide JwtAuthGuard can inject JwtService without every
  // module having to re-import JwtModule.
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
