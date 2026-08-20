import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLog, Role, UserPermission } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { PublicUserRecord, UsersService } from './users.service';
import {
  AuditLogQueryDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateUserPermissionsDto,
  UpdateUserRoleDto,
  UserQueryDto,
} from './dto/user.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List staff accounts with role and status filters.' })
  findAll(@Query() query: UserQueryDto): Promise<Paginated<PublicUserRecord>> {
    return this.usersService.findAll(query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Minimal user list for assignee pickers.' })
  options(): Promise<Array<{ id: string; name: string | null; email: string }>> {
    return this.usersService.options();
  }

  // Declared before `:id` so "audit-logs" is not parsed as a UUID parameter.
  @Roles(Role.ADMIN)
  @Get('audit-logs')
  @ApiOperation({ summary: 'Who changed what. ADMIN only.' })
  auditLogs(@Query() query: AuditLogQueryDto): Promise<Paginated<AuditLog>> {
    return this.usersService.auditLogs(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUserRecord> {
    return this.usersService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Audit('create', 'user')
  @Post()
  @ApiOperation({ summary: 'Invite a staff account. ADMIN only.' })
  create(@Body() dto: CreateUserDto): Promise<PublicUserRecord> {
    return this.usersService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Audit('update', 'user')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PublicUserRecord> {
    return this.usersService.update(id, dto, actor.id);
  }

  @Roles(Role.ADMIN)
  @Audit('role', 'user')
  @Patch(':id/role')
  @ApiOperation({ summary: 'Change a user’s role. ADMIN only.' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PublicUserRecord> {
    return this.usersService.update(id, { role: dto.role }, actor.id);
  }

  @Roles(Role.ADMIN)
  @Get(':id/permissions')
  @ApiOperation({ summary: 'This user’s per-resource grants. ADMIN only.' })
  getPermissions(@Param('id', ParseUUIDPipe) id: string): Promise<UserPermission[]> {
    return this.usersService.getPermissions(id);
  }

  @Roles(Role.ADMIN)
  @Audit('permissions', 'user')
  @Put(':id/permissions')
  @ApiOperation({ summary: 'Set this user’s per-resource grants. ADMIN only.' })
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionsDto,
  ): Promise<UserPermission[]> {
    return this.usersService.setPermissions(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('delete', 'user')
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ id: string }> {
    return this.usersService.remove(id, actor.id);
  }
}
