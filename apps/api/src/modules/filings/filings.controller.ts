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
import { Filing, PermissionResource, Role } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Permission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { FilingsService } from './filings.service';
import { CreateFilingDto, FilingQueryDto, UpdateFilingDto } from './dto/filing.dto';

@ApiTags('filings')
@ApiBearerAuth('access-token')
@Controller('filings')
@Permission(PermissionResource.FILINGS)
export class FilingsController {
  constructor(private readonly filingsService: FilingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Compliance filings, soonest deadline first, with a due-soon filter.',
  })
  findAll(@Query() query: FilingQueryDto): Promise<Paginated<Filing>> {
    return this.filingsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Filing> {
    return this.filingsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('create', 'filing')
  @Post()
  create(@Body() dto: CreateFilingDto): Promise<Filing> {
    return this.filingsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('update', 'filing')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFilingDto,
  ): Promise<Filing> {
    return this.filingsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('delete', 'filing')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.filingsService.remove(id);
  }
}
