import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe with a database round-trip.' })
  async check(): Promise<{ status: string; database: string; uptime: number }> {
    const database = (await this.prisma.ping()) ? 'up' : 'down';
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: process.uptime(),
    };
  }
}
