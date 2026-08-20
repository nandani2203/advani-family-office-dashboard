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
import { PermissionResource, Role, Transaction } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Permission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/dto/pagination.dto';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  TransactionQueryDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';

@ApiTags('transactions')
@ApiBearerAuth('access-token')
@Controller('transactions')
@Permission(PermissionResource.TRANSACTIONS)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Cashflow ledger with type, status and date-range filters.' })
  findAll(@Query() query: TransactionQueryDto): Promise<Paginated<Transaction>> {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Transaction> {
    return this.transactionsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('create', 'transaction')
  @Post()
  create(@Body() dto: CreateTransactionDto): Promise<Transaction> {
    return this.transactionsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Audit('update', 'transaction')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('delete', 'transaction')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.transactionsService.remove(id);
  }
}
