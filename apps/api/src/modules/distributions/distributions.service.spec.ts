import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DistributionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DistributionsService } from './distributions.service';

const decimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

interface PrismaMock {
  distribution: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  investment: { count: jest.Mock };
}

describe('DistributionsService', () => {
  let service: DistributionsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      distribution: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'existing', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      investment: { count: jest.fn().mockResolvedValue(1) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DistributionsService,
        { provide: PrismaService, useValue: prisma as unknown as PrismaService },
      ],
    }).compile();

    service = moduleRef.get(DistributionsService);
  });

  describe('create', () => {
    const dto = {
      investmentId: '2f1c9d7e-0000-4000-8000-000000000001',
      declaredDate: '2025-02-10',
      grossAmount: 3_200_000,
      withholdingTax: 480_000,
    };

    it('derives the net amount rather than trusting the client', async () => {
      await service.create(dto);

      expect(prisma.distribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grossAmount: 3_200_000,
            withholdingTax: 480_000,
            netAmount: 2_720_000,
          }),
        }),
      );
    });

    it('treats a missing withholding tax as zero', async () => {
      await service.create({ ...dto, withholdingTax: undefined });

      expect(prisma.distribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ withholdingTax: 0, netAmount: 3_200_000 }),
        }),
      );
    });

    it('rejects withholding tax larger than the gross amount', async () => {
      await expect(
        service.create({ ...dto, withholdingTax: dto.grossAmount + 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.distribution.create).not.toHaveBeenCalled();
    });

    it('rejects a distribution against an investment that does not exist', async () => {
      prisma.investment.count.mockResolvedValue(0);

      await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('starts a distribution as DECLARED when no status is given', async () => {
      await service.create(dto);

      expect(prisma.distribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DistributionStatus.DECLARED }),
        }),
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.distribution.findUnique.mockResolvedValue({
        id: 'existing',
        grossAmount: decimal(1_000_000),
        withholdingTax: decimal(100_000),
        status: DistributionStatus.DECLARED,
      });
    });

    it('recomputes the net when only the gross changes', async () => {
      await service.update('existing', { grossAmount: 2_000_000 });

      expect(prisma.distribution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grossAmount: 2_000_000,
            withholdingTax: 100_000,
            netAmount: 1_900_000,
          }),
        }),
      );
    });

    it('recomputes the net when only the withholding changes', async () => {
      await service.update('existing', { withholdingTax: 250_000 });

      expect(prisma.distribution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ netAmount: 750_000 }),
        }),
      );
    });

    it('rejects an update that would push withholding past the stored gross', async () => {
      await expect(service.update('existing', { withholdingTax: 1_500_000 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('status workflow', () => {
    const current = (status: DistributionStatus) => {
      prisma.distribution.findUnique.mockResolvedValue({ id: 'existing', status });
    };

    it('moves declared to approved', async () => {
      current(DistributionStatus.DECLARED);

      await service.updateStatus('existing', { status: DistributionStatus.APPROVED });

      expect(prisma.distribution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DistributionStatus.APPROVED }),
        }),
      );
    });

    it('stamps a payment date when a distribution is paid', async () => {
      current(DistributionStatus.APPROVED);

      await service.updateStatus('existing', { status: DistributionStatus.PAID });

      const call = prisma.distribution.update.mock.calls[0][0];
      expect(call.data.status).toBe(DistributionStatus.PAID);
      expect(call.data.paymentDate).toBeInstanceOf(Date);
    });

    it('honours an explicit payment date', async () => {
      current(DistributionStatus.APPROVED);

      await service.updateStatus('existing', {
        status: DistributionStatus.PAID,
        paymentDate: '2025-03-01',
      });

      const call = prisma.distribution.update.mock.calls[0][0];
      expect((call.data.paymentDate as Date).toISOString()).toBe('2025-03-01T00:00:00.000Z');
    });

    it('refuses to skip approval and pay a declared distribution', async () => {
      current(DistributionStatus.DECLARED);

      await expect(
        service.updateStatus('existing', { status: DistributionStatus.PAID }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.distribution.update).not.toHaveBeenCalled();
    });

    it('refuses to reopen a paid distribution all the way back to declared', async () => {
      current(DistributionStatus.PAID);

      await expect(
        service.updateStatus('existing', { status: DistributionStatus.DECLARED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('treats a no-op transition as a read', async () => {
      prisma.distribution.findUnique.mockResolvedValue({
        id: 'existing',
        status: DistributionStatus.PAID,
      });

      await service.updateStatus('existing', { status: DistributionStatus.PAID });

      expect(prisma.distribution.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a distribution that has not been paid', async () => {
      prisma.distribution.findUnique.mockResolvedValue({
        id: 'existing',
        status: DistributionStatus.DECLARED,
      });

      await expect(service.remove('existing')).resolves.toEqual({ id: 'existing' });
    });

    it('refuses to delete money that has already left the account', async () => {
      prisma.distribution.findUnique.mockResolvedValue({
        id: 'existing',
        status: DistributionStatus.PAID,
      });

      await expect(service.remove('existing')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.distribution.delete).not.toHaveBeenCalled();
    });

    it('404s on an unknown id', async () => {
      prisma.distribution.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
