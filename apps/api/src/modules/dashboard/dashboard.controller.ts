import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService, DashboardSummary } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Every KPI, chart series and panel on the overview screen, in one call.',
  })
  summary(): Promise<DashboardSummary> {
    return this.dashboardService.summary();
  }
}
