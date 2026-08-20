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
import { Asset, PermissionResource, Role } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Permission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { AssetsService } from './assets.service';
import { AssetQueryDto, CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

@ApiTags('assets')
@ApiBearerAuth('access-token')
@Controller('assets')
@Permission(PermissionResource.ASSETS)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List assets with search, filters and pagination.' })
  findAll(@Query() query: AssetQueryDto): Promise<Paginated<Asset>> {
    return this.assetsService.findAll(query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Minimal asset list for select inputs.' })
  options(): Promise<Array<{ id: string; name: string; type: string }>> {
    return this.assetsService.options();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Asset> {
    return this.assetsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('create', 'asset')
  @Post()
  create(@Body() dto: CreateAssetDto): Promise<Asset> {
    return this.assetsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('update', 'asset')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<Asset> {
    return this.assetsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('archive', 'asset')
  @Delete(':id')
  @ApiOperation({ summary: 'Archive (soft delete) an asset. History against it is preserved. ADMIN only.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.assetsService.remove(id);
  }

  @Roles(Role.ADMIN)
  @Audit('restore', 'asset')
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore an archived asset. ADMIN only.' })
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<Asset> {
    return this.assetsService.restore(id);
  }
}
