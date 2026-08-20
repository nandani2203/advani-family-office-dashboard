import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FilingStatus, FilingType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FilingQueryDto } from './dto/filing.dto';
import { DUE_SOON_WINDOW_DAYS, FilingsService } from './filings.service';

const queryDto = (overrides: Partial<FilingQueryDto> = {}): FilingQueryDto =>
  Object.assign(new PaginationQueryDto(), overrides) as FilingQueryDto;

describe('FilingsService', () => {
  let service: FilingsService;
  let prisma: {
    filing: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      filing: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'existing', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { count: jest.fn().mockResolvedValue(1) },
      // The service composes findMany + count into one transaction.
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FilingsService,
        { provide: PrismaService, useValue: prisma as unknown as PrismaService },
      ],
    }).compile();

    service = moduleRef.get(FilingsService);
  });

  /** The `where` clause the service handed to `findMany`. */
  const whereFromFindMany = (): Prisma.FilingWhereInput =>
    prisma.filing.findMany.mock.calls[0][0].where;

  describe('findAll', () => {
    it('lists the nearest deadline first when no sort is requested', async () => {
      await service.findAll(queryDto());

      expect(prisma.filing.findMany.mock.calls[0][0].orderBy).toEqual({ dueDate: 'asc' });
    });

    it('honours an explicit sort over the deadline default', async () => {
      await service.findAll(queryDto({ sortBy: 'vehicleName', sortDir: 'desc' }));

      expect(prisma.filing.findMany.mock.calls[0][0].orderBy).toEqual({ vehicleName: 'desc' });
    });

    it('scopes dueSoon to open work inside the 30-day window', async () => {
      await service.findAll(queryDto({ dueSoon: true }));

      const where = whereFromFindMany();
      const cutoff = (where.dueDate as { lte: Date }).lte;
      const expected = Date.now() + DUE_SOON_WINDOW_DAYS * 86_400_000;

      expect(where.status).toEqual({ not: FilingStatus.CLOSED });
      // Within a second of the expected cutoff — the clock moves during the test.
      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(1_000);
    });

    it('does not filter on a deadline when dueSoon is absent', async () => {
      await service.findAll(queryDto({ status: FilingStatus.OPEN }));

      const where = whereFromFindMany();
      expect(where.dueDate).toBeUndefined();
      expect(where.status).toBe(FilingStatus.OPEN);
    });

    it('searches the vehicle, jurisdiction and notes together', async () => {
      await service.findAll(queryDto({ search: 'DIFC' }));

      expect(whereFromFindMany().OR).toHaveLength(3);
    });
  });

  describe('create', () => {
    it('leaves submittedAt empty for a filing that is still open', async () => {
      const filing = await service.create({
        vehicleName: 'Advani Holdings DIFC Ltd',
        type: FilingType.VAT,
        dueDate: '2025-09-30',
      });

      expect((filing as { submittedAt: Date | null }).submittedAt).toBeNull();
    });

    it('stamps submittedAt when a filing is created as already submitted', async () => {
      const filing = await service.create({
        vehicleName: 'Advani Holdings DIFC Ltd',
        type: FilingType.VAT,
        dueDate: '2025-09-30',
        status: FilingStatus.SUBMITTED,
      });

      expect((filing as { submittedAt: Date | null }).submittedAt).toBeInstanceOf(Date);
    });

    it('rejects an assignee who does not exist', async () => {
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.create({
          vehicleName: 'Advani Holdings DIFC Ltd',
          type: FilingType.KYC,
          dueDate: '2025-09-30',
          assigneeId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('keeps the original submission date when a submitted filing is closed', async () => {
      const submittedAt = new Date('2025-04-02T09:00:00.000Z');
      prisma.filing.findUnique.mockResolvedValue({
        id: 'existing',
        status: FilingStatus.SUBMITTED,
        submittedAt,
      });

      const filing = await service.update('existing', { status: FilingStatus.CLOSED });

      expect((filing as { submittedAt: Date | null }).submittedAt).toEqual(submittedAt);
    });

    it('clears the submission date when a filing is reopened', async () => {
      prisma.filing.findUnique.mockResolvedValue({
        id: 'existing',
        status: FilingStatus.SUBMITTED,
        submittedAt: new Date(),
      });

      const filing = await service.update('existing', { status: FilingStatus.IN_PROGRESS });

      expect((filing as { submittedAt: Date | null }).submittedAt).toBeNull();
    });

    it('leaves the submission date alone when the status is not part of the update', async () => {
      prisma.filing.findUnique.mockResolvedValue({
        id: 'existing',
        status: FilingStatus.OPEN,
        submittedAt: null,
      });

      await service.update('existing', { notes: 'Chased the registered agent.' });

      expect(prisma.filing.update.mock.calls[0][0].data).not.toHaveProperty('submittedAt');
    });

    it('404s on an unknown filing', async () => {
      prisma.filing.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { notes: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
