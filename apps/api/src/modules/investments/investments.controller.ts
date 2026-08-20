import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Investment, PermissionResource, Role, Valuation } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Permission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { InvestmentSummary, InvestmentsService } from './investments.service';
import {
  CreateInvestmentDto,
  CreateValuationDto,
  InvestmentQueryDto,
  UpdateInvestmentDto,
} from './dto/investment.dto';

@ApiTags('investments')
@ApiBearerAuth('access-token')
@Controller('investments')
@Permission(PermissionResource.INVESTMENTS)
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List investments with search, filters and pagination.' })
  findAll(@Query() query: InvestmentQueryDto): Promise<Paginated<Investment>> {
    return this.investmentsService.findAll(query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Minimal investment list for select inputs.' })
  options(): Promise<Array<{ id: string; label: string; assetName: string }>> {
    return this.investmentsService.options();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Totals for whatever the current filters match.' })
  summary(@Query() query: InvestmentQueryDto): Promise<InvestmentSummary> {
    return this.investmentsService.summary(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Investment> {
    return this.investmentsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('create', 'investment')
  @Post()
  create(@Body() dto: CreateInvestmentDto): Promise<Investment> {
    return this.investmentsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('update', 'investment')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvestmentDto,
  ): Promise<Investment> {
    return this.investmentsService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('valuation', 'investment')
  @Post(':id/valuations')
  @ApiOperation({ summary: 'Record a new mark; also updates the current valuation.' })
  addValuation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateValuationDto,
  ): Promise<Valuation> {
    return this.investmentsService.addValuation(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('delete', 'investment')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.investmentsService.remove(id);
  }
}
