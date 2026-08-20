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
import { Distribution, PermissionResource, Role } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Permission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { DistributionsService } from './distributions.service';
import {
  CreateDistributionDto,
  DistributionQueryDto,
  UpdateDistributionDto,
  UpdateDistributionStatusDto,
} from './dto/distribution.dto';

@ApiTags('distributions')
@ApiBearerAuth('access-token')
@Controller('distributions')
@Permission(PermissionResource.DISTRIBUTIONS)
export class DistributionsController {
  constructor(private readonly distributionsService: DistributionsService) {}

  @Get()
  @ApiOperation({ summary: 'List distributions with status and date-range filters.' })
  findAll(@Query() query: DistributionQueryDto): Promise<Paginated<Distribution>> {
    return this.distributionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Distribution> {
    return this.distributionsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('create', 'distribution')
  @Post()
  create(@Body() dto: CreateDistributionDto): Promise<Distribution> {
    return this.distributionsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('update', 'distribution')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDistributionDto,
  ): Promise<Distribution> {
    return this.distributionsService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('status', 'distribution')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Advance the declared → approved → paid workflow.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDistributionStatusDto,
  ): Promise<Distribution> {
    return this.distributionsService.updateStatus(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('delete', 'distribution')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.distributionsService.remove(id);
  }
}
