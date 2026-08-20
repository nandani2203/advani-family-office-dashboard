/**
 * Seeds a portfolio that looks like the real Advani book: $2B+ in private
 * equity, $1B+ in crypto, spread over 200+ positions held through SPVs, funds
 * and direct holdings, plus the cashflow, distribution and compliance history
 * the dashboard reports on.
 *
 * Two properties matter for a reviewer:
 *
 *  - It is **deterministic**. All randomness comes from a seeded PRNG, so the
 *    numbers on the dashboard are the same on every machine.
 *  - Dates are **relative to today**, so the trailing-12-month cashflow chart
 *    and the "filings due in 30 days" KPI are never empty, no matter when the
 *    seed is run.
 *
 * Run with `npm run seed`.
 */
import {
  AssetType,
  DistributionStatus,
  FilingStatus,
  FilingType,
  InvestmentStatus,
  Prisma,
  PrismaClient,
  Role,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  UserStatus,
  VehicleType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

// ---------------------------------------------------------------- determinism

/** mulberry32 — small, fast, and identical across runs for a given seed. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(20240818);

const between = (min: number, max: number): number => min + rng() * (max - min);
const intBetween = (min: number, max: number): number => Math.floor(between(min, max + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
/** Weighted coin flip. */
const chance = (probability: number): boolean => rng() < probability;

const MILLION = 1_000_000;
const DAY = 86_400_000;

const round2 = (value: number): number => Math.round(value * 100) / 100;
const money = (value: number): Prisma.Decimal => new Prisma.Decimal(round2(value));

const NOW = new Date();

/** Midnight UTC, `days` from today. */
const daysFromNow = (days: number): Date => {
  const date = new Date(NOW.getTime() + days * DAY);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

/**
 * Splits a target total into `parts` uneven slices that still sum to the total,
 * so per-asset valuations add up exactly to the headline figures.
 */
function splitAmount(total: number, parts: number): number[] {
  const weights = Array.from({ length: parts }, () => between(0.5, 1.5));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const slices = weights.map((weight) => (weight / weightSum) * total);
  // Push the rounding remainder into the first slice.
  const drift = total - slices.reduce((sum, slice) => sum + round2(slice), 0);
  slices[0] += drift;
  return slices.map(round2);
}

// --------------------------------------------------------------------- people

const STAFF: Array<{ email: string; name: string; role: Role; status: UserStatus }> = [
  {
    email: 'rohan.advani@advanifamilyoffice.com',
    name: 'Rohan Advani',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  },
  {
    email: 'meera.advani@advanifamilyoffice.com',
    name: 'Meera Advani',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  },
  {
    email: 'priya.nair@advanifamilyoffice.com',
    name: 'Priya Nair',
    role: Role.EDITOR,
    status: UserStatus.ACTIVE,
  },
  {
    email: 'daniel.okafor@advanifamilyoffice.com',
    name: 'Daniel Okafor',
    role: Role.EDITOR,
    status: UserStatus.ACTIVE,
  },
  {
    email: 'sofia.marchetti@advanifamilyoffice.com',
    name: 'Sofia Marchetti',
    role: Role.EDITOR,
    status: UserStatus.ACTIVE,
  },
  {
    email: 'auditor@kpmg-dubai.example.com',
    name: 'External Auditor',
    role: Role.VIEWER,
    status: UserStatus.ACTIVE,
  },
  {
    email: 'james.whitfield@advanifamilyoffice.com',
    name: 'James Whitfield',
    role: Role.VIEWER,
    status: UserStatus.INVITED,
  },
];

// --------------------------------------------------------------------- assets

interface AssetSpec {
  name: string;
  type: AssetType;
  ticker?: string;
  sector: string;
  description: string;
  /** Target ACTIVE valuation for this asset, in USD millions. */
  valuationM: number;
  /** Number of positions (SPV vintages / tranches) to spread it across. */
  positions: number;
  /** Valuation ÷ cost basis. Above 1 is a mark-up, below 1 a mark-down. */
  multiple: number;
  vehicle: VehicleType;
}

const ASSETS: AssetSpec[] = [
  // ---- private equity / venture: the $2B core of the book
  { name: 'SpaceX', type: AssetType.PRIVATE_EQUITY, sector: 'Aerospace', description: 'Launch services and Starlink. Held across six SPV vintages from Series J onward.', valuationM: 340, positions: 10, multiple: 3.4, vehicle: VehicleType.SPV },
  { name: 'Anthropic', type: AssetType.PRIVATE_EQUITY, sector: 'Artificial Intelligence', description: 'Frontier AI research lab. Entered at Series C, followed on twice.', valuationM: 280, positions: 8, multiple: 4.1, vehicle: VehicleType.SPV },
  { name: 'OpenAI', type: AssetType.PRIVATE_EQUITY, sector: 'Artificial Intelligence', description: 'Secondary purchases of employee tender shares.', valuationM: 225, positions: 8, multiple: 3.8, vehicle: VehicleType.SPV },
  { name: 'Stripe', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'Payments infrastructure. Long-held secondary position.', valuationM: 150, positions: 7, multiple: 2.2, vehicle: VehicleType.SPV },
  { name: 'Databricks', type: AssetType.PRIVATE_EQUITY, sector: 'Data Infrastructure', description: 'Lakehouse platform. Series H and I.', valuationM: 135, positions: 6, multiple: 2.6, vehicle: VehicleType.SPV },
  { name: 'Anduril Industries', type: AssetType.PRIVATE_EQUITY, sector: 'Defence Technology', description: 'Autonomous defence systems.', valuationM: 110, positions: 6, multiple: 3.1, vehicle: VehicleType.SPV },
  { name: 'xAI', type: AssetType.PRIVATE_EQUITY, sector: 'Artificial Intelligence', description: 'Series B participation via a co-investment SPV.', valuationM: 95, positions: 4, multiple: 1.9, vehicle: VehicleType.SPV },
  { name: 'Figma', type: AssetType.PRIVATE_EQUITY, sector: 'Design Software', description: 'Held through the failed-acquisition period; marked back up post-IPO filing.', valuationM: 65, positions: 4, multiple: 2.4, vehicle: VehicleType.SPV },
  { name: 'Revolut', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'Neobank. Secondary at the 2024 employee tender.', valuationM: 62, positions: 4, multiple: 2.8, vehicle: VehicleType.SPV },
  { name: 'Canva', type: AssetType.PRIVATE_EQUITY, sector: 'Design Software', description: 'Secondary position acquired from an early employee pool.', valuationM: 58, positions: 4, multiple: 2.1, vehicle: VehicleType.SPV },
  { name: 'Rippling', type: AssetType.PRIVATE_EQUITY, sector: 'HR Software', description: 'Series E and F.', valuationM: 52, positions: 4, multiple: 2.3, vehicle: VehicleType.SPV },
  { name: 'Neuralink', type: AssetType.PRIVATE_EQUITY, sector: 'Medical Devices', description: 'Brain-computer interfaces. High variance, small cheque.', valuationM: 48, positions: 3, multiple: 3.6, vehicle: VehicleType.SPV },
  { name: 'Ramp', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'Corporate spend management.', valuationM: 45, positions: 4, multiple: 2.7, vehicle: VehicleType.SPV },
  { name: 'Scale AI', type: AssetType.PRIVATE_EQUITY, sector: 'Artificial Intelligence', description: 'Data labelling and model evaluation.', valuationM: 44, positions: 3, multiple: 2.0, vehicle: VehicleType.SPV },
  { name: 'Groq', type: AssetType.PRIVATE_EQUITY, sector: 'Semiconductors', description: 'Inference accelerators.', valuationM: 42, positions: 3, multiple: 2.5, vehicle: VehicleType.SPV },
  { name: 'Deel', type: AssetType.PRIVATE_EQUITY, sector: 'HR Software', description: 'Global payroll and compliance.', valuationM: 40, positions: 3, multiple: 1.8, vehicle: VehicleType.SPV },
  { name: 'Epic Games', type: AssetType.PRIVATE_EQUITY, sector: 'Gaming', description: 'Unreal Engine and Fortnite. Marked down from the 2022 peak.', valuationM: 38, positions: 3, multiple: 0.9, vehicle: VehicleType.SPV },
  { name: 'Perplexity AI', type: AssetType.PRIVATE_EQUITY, sector: 'Artificial Intelligence', description: 'Answer engine. Two rapid follow-ons.', valuationM: 35, positions: 4, multiple: 4.6, vehicle: VehicleType.SPV },
  { name: 'Klarna', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'Buy-now-pay-later. Recovered from the 2022 down round.', valuationM: 32, positions: 3, multiple: 1.1, vehicle: VehicleType.SPV },
  { name: 'Anysphere (Cursor)', type: AssetType.PRIVATE_EQUITY, sector: 'Developer Tools', description: 'AI-native code editor.', valuationM: 30, positions: 3, multiple: 5.2, vehicle: VehicleType.SPV },
  { name: 'Chime', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'Consumer banking.', valuationM: 28, positions: 3, multiple: 1.4, vehicle: VehicleType.SPV },
  { name: 'Plaid', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'Bank data connectivity.', valuationM: 26, positions: 3, multiple: 1.2, vehicle: VehicleType.SPV },
  { name: 'Monzo', type: AssetType.PRIVATE_EQUITY, sector: 'Fintech', description: 'UK challenger bank. GBP-denominated entry, USD book.', valuationM: 24, positions: 3, multiple: 1.7, vehicle: VehicleType.SPV },
  { name: 'Sierra AI', type: AssetType.PRIVATE_EQUITY, sector: 'Artificial Intelligence', description: 'Enterprise agent platform. Newest position in the book.', valuationM: 22, positions: 3, multiple: 1.6, vehicle: VehicleType.SPV },

  // ---- crypto: the $1B digital-asset treasury
  { name: 'Bitcoin', type: AssetType.CRYPTO, ticker: 'BTC', sector: 'Digital Assets', description: 'Core treasury reserve, custodied with Coinbase Prime and Fireblocks.', valuationM: 420, positions: 11, multiple: 3.9, vehicle: VehicleType.DIRECT },
  { name: 'Ethereum', type: AssetType.CRYPTO, ticker: 'ETH', sector: 'Digital Assets', description: 'Treasury holding, majority staked through institutional validators.', valuationM: 300, positions: 10, multiple: 3.2, vehicle: VehicleType.DIRECT },
  { name: 'Solana', type: AssetType.CRYPTO, ticker: 'SOL', sector: 'Digital Assets', description: 'Accumulated through the 2023 drawdown; staked.', valuationM: 185, positions: 8, multiple: 5.8, vehicle: VehicleType.DIRECT },
  { name: 'Chainlink', type: AssetType.CRYPTO, ticker: 'LINK', sector: 'Digital Assets', description: 'Oracle network. Locked in the staking pool.', valuationM: 45, positions: 4, multiple: 1.9, vehicle: VehicleType.DIRECT },
  { name: 'Avalanche', type: AssetType.CRYPTO, ticker: 'AVAX', sector: 'Digital Assets', description: 'Subnet thesis. Marked down from entry.', valuationM: 35, positions: 4, multiple: 0.7, vehicle: VehicleType.DIRECT },
  { name: 'Sui', type: AssetType.CRYPTO, ticker: 'SUI', sector: 'Digital Assets', description: 'Node-operator allocation plus secondary purchases.', valuationM: 28, positions: 3, multiple: 2.4, vehicle: VehicleType.DIRECT },
  { name: 'Aptos', type: AssetType.CRYPTO, ticker: 'APT', sector: 'Digital Assets', description: 'Locked allocation from the 2022 launch round.', valuationM: 25, positions: 3, multiple: 0.8, vehicle: VehicleType.DIRECT },
  { name: 'Arbitrum', type: AssetType.CRYPTO, ticker: 'ARB', sector: 'Digital Assets', description: 'L2 exposure, partially in the DAO treasury programme.', valuationM: 22, positions: 3, multiple: 1.1, vehicle: VehicleType.DIRECT },
  { name: 'Uniswap', type: AssetType.CRYPTO, ticker: 'UNI', sector: 'Digital Assets', description: 'Governance position in the DEX protocol.', valuationM: 20, positions: 3, multiple: 1.3, vehicle: VehicleType.DIRECT },
  { name: 'Celestia', type: AssetType.CRYPTO, ticker: 'TIA', sector: 'Digital Assets', description: 'Modular data-availability layer. Vesting through 2026.', valuationM: 18, positions: 2, multiple: 0.6, vehicle: VehicleType.DIRECT },
  { name: 'Render Network', type: AssetType.CRYPTO, ticker: 'RENDER', sector: 'Digital Assets', description: 'Distributed GPU rendering.', valuationM: 15, positions: 2, multiple: 2.2, vehicle: VehicleType.DIRECT },
  { name: 'Helium', type: AssetType.CRYPTO, ticker: 'HNT', sector: 'Digital Assets', description: 'Decentralised wireless. Written down substantially.', valuationM: 8, positions: 2, multiple: 0.4, vehicle: VehicleType.DIRECT },

  // ---- tokenized / pre-IPO share trading run through Allocations
  { name: 'SpaceX Series N (tokenized)', type: AssetType.TOKENIZED, sector: 'Aerospace', description: 'Tokenized pre-IPO share class traded through the Allocations platform.', valuationM: 55, positions: 4, multiple: 2.3, vehicle: VehicleType.SPV },
  { name: 'OpenAI tokenized SPV', type: AssetType.TOKENIZED, sector: 'Artificial Intelligence', description: 'Tokenized feeder into a third-party OpenAI SPV.', valuationM: 40, positions: 3, multiple: 2.9, vehicle: VehicleType.SPV },
  { name: 'Stripe tokenized units', type: AssetType.TOKENIZED, sector: 'Fintech', description: 'Fractionalised secondary units.', valuationM: 25, positions: 3, multiple: 1.8, vehicle: VehicleType.SPV },

  // ---- fund commitments
  { name: 'Sequoia Capital Growth Fund IV', type: AssetType.FUND, sector: 'Venture Capital', description: '10-year growth fund, 2021 vintage. Capital called on a quarterly schedule.', valuationM: 85, positions: 3, multiple: 1.7, vehicle: VehicleType.FUND },
  { name: 'Tiger Global PIP 15', type: AssetType.FUND, sector: 'Growth Equity', description: '2021 vintage. Marked down heavily in 2022, recovering.', valuationM: 60, positions: 3, multiple: 0.95, vehicle: VehicleType.FUND },
  { name: 'Founders Fund Growth VIII', type: AssetType.FUND, sector: 'Venture Capital', description: '2023 vintage, roughly half called.', valuationM: 55, positions: 3, multiple: 1.5, vehicle: VehicleType.FUND },
  { name: 'a16z Growth Fund III', type: AssetType.FUND, sector: 'Venture Capital', description: '2022 vintage.', valuationM: 50, positions: 3, multiple: 1.35, vehicle: VehicleType.FUND },
  { name: 'Insight Partners XII', type: AssetType.FUND, sector: 'Growth Equity', description: '2020 vintage, now returning capital.', valuationM: 45, positions: 3, multiple: 1.6, vehicle: VehicleType.FUND },
  { name: 'Pantera Blockchain Fund', type: AssetType.FUND, sector: 'Digital Assets', description: 'Liquid-token and venture blend.', valuationM: 38, positions: 3, multiple: 2.1, vehicle: VehicleType.FUND },

  // ---- listed positions
  { name: 'Coinbase Global', type: AssetType.PUBLIC_EQUITY, ticker: 'COIN', sector: 'Digital Assets', description: 'Listed proxy for digital-asset volumes; held since the direct listing.', valuationM: 65, positions: 4, multiple: 2.6, vehicle: VehicleType.DIRECT },
  { name: 'NVIDIA', type: AssetType.PUBLIC_EQUITY, ticker: 'NVDA', sector: 'Semiconductors', description: 'Listed AI infrastructure exposure.', valuationM: 55, positions: 3, multiple: 4.8, vehicle: VehicleType.DIRECT },
  { name: 'MicroStrategy', type: AssetType.PUBLIC_EQUITY, ticker: 'MSTR', sector: 'Digital Assets', description: 'Levered bitcoin proxy.', valuationM: 40, positions: 3, multiple: 3.3, vehicle: VehicleType.DIRECT },
  { name: 'Palantir Technologies', type: AssetType.PUBLIC_EQUITY, ticker: 'PLTR', sector: 'Enterprise Software', description: 'Listed since the 2020 direct listing.', valuationM: 30, positions: 3, multiple: 3.9, vehicle: VehicleType.DIRECT },

  // ---- real estate and private credit
  { name: 'Dubai Marina Tower — Floors 40-48', type: AssetType.REAL_ESTATE, sector: 'Commercial Real Estate', description: 'Office and residential floors held through a DIFC holding company.', valuationM: 80, positions: 3, multiple: 1.45, vehicle: VehicleType.DIRECT },
  { name: 'Mayfair Residential Portfolio', type: AssetType.REAL_ESTATE, sector: 'Residential Real Estate', description: 'Four London freeholds held through a Jersey structure.', valuationM: 65, positions: 3, multiple: 1.2, vehicle: VehicleType.DIRECT },
  { name: 'Orchard Road Retail Unit', type: AssetType.REAL_ESTATE, sector: 'Retail Real Estate', description: 'Singapore retail frontage, long lease in place.', valuationM: 40, positions: 2, multiple: 1.3, vehicle: VehicleType.DIRECT },
  { name: 'Advani Private Credit Note 2027', type: AssetType.DEBT, sector: 'Private Credit', description: 'Senior secured note to a mid-market logistics operator, 11.5% coupon.', valuationM: 45, positions: 3, multiple: 1.05, vehicle: VehicleType.DIRECT },
  { name: 'Bridge Facility — Anduril Secondary', type: AssetType.DEBT, sector: 'Private Credit', description: 'Short-dated bridge extended against a secondary purchase.', valuationM: 20, positions: 2, multiple: 1.02, vehicle: VehicleType.DIRECT },
];

/** Positions that are no longer marked in the portfolio total. */
const CLOSED_POSITIONS: Array<{
  assetName: string;
  status: InvestmentStatus;
  investedM: number;
  exitM: number;
  notes: string;
}> = [
  { assetName: 'Figma', status: InvestmentStatus.EXITED, investedM: 12, exitM: 38, notes: 'Sold into the 2024 tender at a 3.2x return.' },
  { assetName: 'Klarna', status: InvestmentStatus.EXITED, investedM: 9, exitM: 11.5, notes: 'Partial exit to fund the Anthropic follow-on.' },
  { assetName: 'Coinbase Global', status: InvestmentStatus.EXITED, investedM: 15, exitM: 44, notes: 'Trimmed the listed position after the 2024 run-up.' },
  { assetName: 'Solana', status: InvestmentStatus.EXITED, investedM: 8, exitM: 46, notes: 'Realised a tranche to rebalance towards BTC.' },
  { assetName: 'Helium', status: InvestmentStatus.WRITTEN_OFF, investedM: 6.5, exitM: 0, notes: 'Network economics did not hold. Written off in full.' },
  { assetName: 'Epic Games', status: InvestmentStatus.WRITTEN_OFF, investedM: 4, exitM: 0.4, notes: 'Small 2021 SPV written down to a nominal value.' },
  { assetName: 'Aptos', status: InvestmentStatus.WRITTEN_OFF, investedM: 3.2, exitM: 0, notes: 'Locked allocation from a defunct counterparty.' },
];

// ------------------------------------------------------------------- vehicles

const JURISDICTIONS = [
  'Delaware, US',
  'DIFC, UAE',
  'ADGM, UAE',
  'Cayman Islands',
  'Jersey',
  'Singapore',
  'Luxembourg',
];

function vehicleNameFor(spec: AssetSpec, index: number, year: number): string {
  switch (spec.vehicle) {
    case VehicleType.FUND:
      return `${spec.name} — Commitment ${index + 1}`;
    case VehicleType.DIRECT:
      return spec.type === AssetType.CRYPTO
        ? `Advani Digital Treasury — ${spec.ticker ?? spec.name} Tranche ${index + 1}`
        : `Advani Direct Holdings — ${spec.name} (${year})`;
    case VehicleType.SPV:
    default:
      return `Advani SPV ${String(index + 1).padStart(2, '0')} — ${spec.name} (${year})`;
  }
}

// ----------------------------------------------------------------------- main

async function main(): Promise<void> {
  console.log('Clearing existing data…');
  // Child rows first: several relations are Restrict rather than Cascade.
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.distribution.deleteMany();
  await prisma.valuation.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.filing.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany();

  // ------------------------------------------------------------------- users

  const users = STAFF.map((staff) => ({
    id: randomUUID(),
    ...staff,
    lastLoginAt:
      staff.status === UserStatus.ACTIVE ? daysFromNow(-intBetween(0, 12)) : null,
  }));

  await prisma.user.createMany({ data: users });
  const editors = users.filter((user) => user.role !== Role.VIEWER);
  console.log(`Seeded ${users.length} staff accounts`);

  // ------------------------------------------------------------------ assets

  const assets = ASSETS.map((spec) => ({
    spec,
    row: {
      id: randomUUID(),
      name: spec.name,
      type: spec.type,
      ticker: spec.ticker ?? null,
      sector: spec.sector,
      currency: 'USD',
      description: spec.description,
    },
  }));

  await prisma.asset.createMany({ data: assets.map((asset) => asset.row) });
  console.log(`Seeded ${assets.length} assets`);

  // ------------------------------------------------------- investments & marks

  const investments: Prisma.InvestmentCreateManyInput[] = [];
  const valuations: Prisma.ValuationCreateManyInput[] = [];
  const transactions: Prisma.TransactionCreateManyInput[] = [];
  const distributions: Prisma.DistributionCreateManyInput[] = [];

  for (const { spec, row } of assets) {
    const slices = splitAmount(spec.valuationM * MILLION, spec.positions);

    slices.forEach((valuation, index) => {
      const investmentId = randomUUID();
      // Older vintages for the earlier tranches of a position.
      const ageDays = intBetween(120, 2400) + (spec.positions - index) * 45;
      const investedAt = daysFromNow(-ageDays);
      const year = investedAt.getUTCFullYear();

      const costBasis = round2(valuation / spec.multiple);
      const isFund = spec.vehicle === VehicleType.FUND;
      // Funds draw capital down over time, so part of the commitment is uncalled.
      const invested = isFund ? round2(costBasis * between(0.55, 0.9)) : costBasis;
      const committed = isFund ? round2(costBasis * between(1.15, 1.6)) : costBasis;

      investments.push({
        id: investmentId,
        assetId: row.id,
        vehicle: spec.vehicle,
        vehicleName: vehicleNameFor(spec, index, year),
        committedAmount: money(committed),
        investedAmount: money(invested),
        costBasis: money(costBasis),
        currentValuation: money(valuation),
        ownershipPct:
          spec.type === AssetType.PRIVATE_EQUITY || spec.type === AssetType.TOKENIZED
            ? new Prisma.Decimal(round2(between(0.05, 2.4)))
            : null,
        status: InvestmentStatus.ACTIVE,
        investedAt,
      });

      valuations.push(...buildValuationHistory(investmentId, investedAt, costBasis, valuation));
      transactions.push(...buildTransactions(investmentId, investedAt, invested, spec));

      // Roughly a third of mature positions have returned something to LPs.
      if (ageDays > 400 && chance(0.34)) {
        distributions.push(...buildDistributions(investmentId, valuation));
      }
    });
  }

  // Closed positions sit outside the active marks so the headline valuation is
  // exactly the sum of what we still hold.
  for (const closed of CLOSED_POSITIONS) {
    const asset = assets.find((entry) => entry.row.name === closed.assetName);
    if (!asset) continue;

    const investmentId = randomUUID();
    const investedAt = daysFromNow(-intBetween(900, 2600));
    const exitAt = daysFromNow(-intBetween(20, 500));
    const invested = round2(closed.investedM * MILLION);
    const exitValue = round2(closed.exitM * MILLION);

    investments.push({
      id: investmentId,
      assetId: asset.row.id,
      vehicle: asset.spec.vehicle,
      vehicleName: `${vehicleNameFor(asset.spec, 90, investedAt.getUTCFullYear())} [realised]`,
      committedAmount: money(invested),
      investedAmount: money(invested),
      costBasis: money(invested),
      currentValuation: money(exitValue),
      ownershipPct: null,
      status: closed.status,
      investedAt,
      notes: closed.notes,
    });

    transactions.push({
      id: randomUUID(),
      investmentId,
      type: TransactionType.PURCHASE,
      direction: TransactionDirection.OUTFLOW,
      amount: money(invested),
      occurredAt: investedAt,
      status: TransactionStatus.SETTLED,
      description: 'Initial subscription',
    });

    if (exitValue > 0) {
      transactions.push({
        id: randomUUID(),
        investmentId,
        type: TransactionType.SALE,
        direction: TransactionDirection.INFLOW,
        amount: money(exitValue),
        occurredAt: exitAt,
        status: TransactionStatus.SETTLED,
        reference: `EXIT-${exitAt.getUTCFullYear()}-${intBetween(1000, 9999)}`,
        description: closed.notes,
      });
    }
  }

  await prisma.investment.createMany({ data: investments });
  await prisma.valuation.createMany({ data: valuations, skipDuplicates: true });
  await prisma.transaction.createMany({ data: transactions });
  await prisma.distribution.createMany({ data: distributions });

  console.log(`Seeded ${investments.length} investments`);
  console.log(`Seeded ${valuations.length} valuation marks`);
  console.log(`Seeded ${transactions.length} transactions`);
  console.log(`Seeded ${distributions.length} distributions`);

  // ----------------------------------------------------------------- filings

  const filings = buildFilings(editors.map((editor) => editor.id));
  await prisma.filing.createMany({ data: filings });
  console.log(`Seeded ${filings.length} compliance filings`);

  // -------------------------------------------------------------- audit trail

  await prisma.auditLog.createMany({ data: buildAuditTrail(users) });

  await report();
}

/**
 * Marks are recorded every two quarters, walking from cost basis to the current
 * valuation, so the history a reviewer opens is monotone with the headline.
 */
function buildValuationHistory(
  investmentId: string,
  investedAt: Date,
  costBasis: number,
  currentValuation: number,
): Prisma.ValuationCreateManyInput[] {
  const marks: Prisma.ValuationCreateManyInput[] = [];
  const monthsHeld = Math.max(
    1,
    Math.round((NOW.getTime() - investedAt.getTime()) / (30.44 * DAY)),
  );
  const steps = Math.min(8, Math.max(2, Math.floor(monthsHeld / 6)));

  for (let step = 0; step < steps; step += 1) {
    const progress = step / (steps - 1 || 1);
    const asOf = new Date(investedAt.getTime() + progress * (NOW.getTime() - investedAt.getTime()));
    // Interpolate, with a little noise so the series is not a straight line.
    const noise = step === 0 || step === steps - 1 ? 1 : between(0.93, 1.07);
    const value = step === 0 ? costBasis : (costBasis + (currentValuation - costBasis) * progress) * noise;

    marks.push({
      id: randomUUID(),
      investmentId,
      asOf: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)),
      value: money(value),
      source: step === 0 ? 'Initial mark' : pick(['Lead round mark', 'Secondary print', 'Manager statement', 'Internal review']),
    });
  }

  return marks;
}

/**
 * Builds the cashflow story for one position: the money that went out to acquire
 * it, ongoing fees, and any income it threw off. Recent-dated rows are what the
 * trailing-12-month chart on the overview reads.
 */
function buildTransactions(
  investmentId: string,
  investedAt: Date,
  invested: number,
  spec: AssetSpec,
): Prisma.TransactionCreateManyInput[] {
  const rows: Prisma.TransactionCreateManyInput[] = [];
  const isFund = spec.vehicle === VehicleType.FUND;

  // Acquisition. Funds call capital in tranches; everything else settles once.
  if (isFund) {
    const calls = intBetween(3, 6);
    const tranches = splitAmount(invested, calls);
    tranches.forEach((amount, index) => {
      const occurredAt = new Date(investedAt.getTime() + index * intBetween(80, 140) * DAY);
      if (occurredAt > NOW) return;
      rows.push({
        id: randomUUID(),
        investmentId,
        type: TransactionType.CAPITAL_CALL,
        direction: TransactionDirection.OUTFLOW,
        amount: money(amount),
        occurredAt,
        status: TransactionStatus.SETTLED,
        reference: `CALL-${occurredAt.getUTCFullYear()}-${String(index + 1).padStart(2, '0')}`,
        description: `Capital call ${index + 1} of ${calls}`,
      });
    });
  } else {
    rows.push({
      id: randomUUID(),
      investmentId,
      type: TransactionType.PURCHASE,
      direction: TransactionDirection.OUTFLOW,
      amount: money(invested),
      occurredAt: investedAt,
      status: TransactionStatus.SETTLED,
      reference: `SUB-${investedAt.getUTCFullYear()}-${intBetween(1000, 9999)}`,
      description:
        spec.type === AssetType.CRYPTO
          ? `Spot purchase of ${spec.ticker} to treasury custody`
          : 'Initial subscription',
    });
  }

  // Management and admin fees over the last four quarters.
  const feeQuarters = intBetween(2, 4);
  for (let quarter = 0; quarter < feeQuarters; quarter += 1) {
    const occurredAt = daysFromNow(-(quarter * 91 + intBetween(2, 25)));
    if (occurredAt < investedAt) continue;
    rows.push({
      id: randomUUID(),
      investmentId,
      type: TransactionType.FEE,
      direction: TransactionDirection.OUTFLOW,
      amount: money(invested * between(0.002, 0.006)),
      occurredAt,
      status: TransactionStatus.SETTLED,
      description: isFund ? 'Quarterly management fee' : 'Vehicle administration fee',
    });
  }

  // Income: staking and coupons pay regularly, equities occasionally.
  if (spec.type === AssetType.CRYPTO && chance(0.6)) {
    for (let month = 1; month <= intBetween(3, 9); month += 1) {
      const occurredAt = daysFromNow(-month * 30 - intBetween(0, 6));
      if (occurredAt < investedAt) continue;
      rows.push({
        id: randomUUID(),
        investmentId,
        type: TransactionType.INTEREST,
        direction: TransactionDirection.INFLOW,
        amount: money(invested * between(0.002, 0.005)),
        occurredAt,
        status: TransactionStatus.SETTLED,
        description: `Staking rewards — ${spec.ticker}`,
      });
    }
  }

  if (spec.type === AssetType.DEBT) {
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const occurredAt = daysFromNow(-(quarter * 91 + intBetween(1, 14)));
      if (occurredAt < investedAt) continue;
      rows.push({
        id: randomUUID(),
        investmentId,
        type: TransactionType.INTEREST,
        direction: TransactionDirection.INFLOW,
        amount: money((invested * 0.115) / 4),
        occurredAt,
        status: TransactionStatus.SETTLED,
        description: 'Quarterly coupon, 11.5% p.a.',
      });
    }
  }

  if (spec.type === AssetType.PUBLIC_EQUITY && chance(0.5)) {
    rows.push({
      id: randomUUID(),
      investmentId,
      type: TransactionType.DIVIDEND,
      direction: TransactionDirection.INFLOW,
      amount: money(invested * between(0.004, 0.012)),
      occurredAt: daysFromNow(-intBetween(30, 200)),
      status: TransactionStatus.SETTLED,
      description: 'Dividend receipt',
    });
  }

  if (spec.type === AssetType.REAL_ESTATE) {
    for (let quarter = 0; quarter < intBetween(2, 4); quarter += 1) {
      rows.push({
        id: randomUUID(),
        investmentId,
        type: TransactionType.DIVIDEND,
        direction: TransactionDirection.INFLOW,
        amount: money(invested * between(0.008, 0.018)),
        occurredAt: daysFromNow(-(quarter * 91 + intBetween(3, 20))),
        status: TransactionStatus.SETTLED,
        description: 'Net rental income distribution',
      });
    }
  }

  // A few rows that are not settled, so the status filters have something to
  // show and the VOID exclusion in the KPI maths is actually exercised.
  if (chance(0.07)) {
    rows.push({
      id: randomUUID(),
      investmentId,
      type: TransactionType.CAPITAL_CALL,
      direction: TransactionDirection.OUTFLOW,
      amount: money(invested * between(0.05, 0.2)),
      occurredAt: daysFromNow(intBetween(3, 40)),
      status: TransactionStatus.PENDING,
      description: 'Capital call notice received, wire not yet sent',
    });
  }

  if (chance(0.04)) {
    rows.push({
      id: randomUUID(),
      investmentId,
      type: TransactionType.FEE,
      direction: TransactionDirection.OUTFLOW,
      amount: money(invested * between(0.001, 0.004)),
      occurredAt: daysFromNow(-intBetween(20, 300)),
      status: TransactionStatus.VOID,
      description: 'Duplicate fee invoice — voided by finance',
    });
  }

  return rows;
}

function buildDistributions(
  investmentId: string,
  valuation: number,
): Prisma.DistributionCreateManyInput[] {
  const rows: Prisma.DistributionCreateManyInput[] = [];
  const count = intBetween(1, 3);

  for (let index = 0; index < count; index += 1) {
    // The newest distribution is the one most likely to still be in flight.
    const status = index === 0 ? pick([
      DistributionStatus.DECLARED,
      DistributionStatus.APPROVED,
      DistributionStatus.PAID,
      DistributionStatus.PAID,
    ]) : DistributionStatus.PAID;

    const declaredDate = daysFromNow(-(index * intBetween(90, 200) + intBetween(5, 60)));
    const gross = round2(valuation * between(0.01, 0.06));
    const withholding = round2(gross * pick([0, 0, 0.05, 0.1, 0.15]));

    rows.push({
      id: randomUUID(),
      investmentId,
      declaredDate,
      paymentDate:
        status === DistributionStatus.PAID
          ? new Date(declaredDate.getTime() + intBetween(10, 45) * DAY)
          : null,
      grossAmount: money(gross),
      withholdingTax: money(withholding),
      netAmount: money(gross - withholding),
      status,
      notes: pick([
        'Proceeds from a partial secondary sale',
        'Recycled management-fee rebate',
        'Realisation distribution',
        'Income distribution for the period',
      ]),
    });
  }

  return rows;
}

/**
 * Compliance work is only useful if some of it is late and some is imminent —
 * that is the whole point of the tracker — so the due dates straddle today.
 */
function buildFilings(assigneeIds: string[]): Prisma.FilingCreateManyInput[] {
  const vehicles = [
    'Advani SPV 01 — SpaceX (2021)',
    'Advani SPV 02 — Anthropic (2023)',
    'Advani SPV 03 — OpenAI (2024)',
    'Advani Digital Treasury — BTC Tranche 1',
    'Advani Digital Treasury — ETH Tranche 1',
    'Advani Holdings DIFC Ltd',
    'Advani Ventures Cayman SPC',
    'Advani Real Estate Jersey Ltd',
    'Advani Family Trust',
    'Sequoia Capital Growth Fund IV — Commitment 1',
  ];

  const plan: Array<{ offsetDays: number; status: FilingStatus }> = [
    // Overdue and still open — the rows that should shout on the dashboard.
    { offsetDays: -24, status: FilingStatus.IN_PROGRESS },
    { offsetDays: -11, status: FilingStatus.OPEN },
    { offsetDays: -5, status: FilingStatus.IN_PROGRESS },
    // Due inside the 30-day KPI window.
    { offsetDays: 3, status: FilingStatus.IN_PROGRESS },
    { offsetDays: 6, status: FilingStatus.OPEN },
    { offsetDays: 9, status: FilingStatus.IN_PROGRESS },
    { offsetDays: 14, status: FilingStatus.OPEN },
    { offsetDays: 18, status: FilingStatus.SUBMITTED },
    { offsetDays: 21, status: FilingStatus.OPEN },
    { offsetDays: 27, status: FilingStatus.IN_PROGRESS },
    // Further out.
    { offsetDays: 38, status: FilingStatus.OPEN },
    { offsetDays: 45, status: FilingStatus.OPEN },
    { offsetDays: 63, status: FilingStatus.OPEN },
    { offsetDays: 74, status: FilingStatus.OPEN },
    { offsetDays: 92, status: FilingStatus.OPEN },
    { offsetDays: 121, status: FilingStatus.OPEN },
    { offsetDays: 168, status: FilingStatus.OPEN },
    { offsetDays: 210, status: FilingStatus.OPEN },
    // Already dealt with.
    { offsetDays: -210, status: FilingStatus.CLOSED },
    { offsetDays: -180, status: FilingStatus.CLOSED },
    { offsetDays: -150, status: FilingStatus.CLOSED },
    { offsetDays: -120, status: FilingStatus.CLOSED },
    { offsetDays: -95, status: FilingStatus.CLOSED },
    { offsetDays: -70, status: FilingStatus.CLOSED },
    { offsetDays: -60, status: FilingStatus.SUBMITTED },
    { offsetDays: -45, status: FilingStatus.CLOSED },
    { offsetDays: -30, status: FilingStatus.SUBMITTED },
    { offsetDays: -20, status: FilingStatus.SUBMITTED },
  ];

  const notesByType: Record<FilingType, string> = {
    [FilingType.KYC]: 'Annual KYC refresh for the beneficial owners and signatories.',
    [FilingType.VAT]: 'Quarterly VAT return for the UAE management entity.',
    [FilingType.MRV]: 'Management representation and valuation review pack.',
    [FilingType.ANNUAL_RETURN]: 'Statutory annual return and confirmation statement.',
    [FilingType.TAX]: 'Corporate tax computation and payment on account.',
  };

  const types = Object.values(FilingType);

  return plan.map((entry, index) => {
    const type = types[index % types.length];
    const isDone = entry.status === FilingStatus.SUBMITTED || entry.status === FilingStatus.CLOSED;
    const dueDate = daysFromNow(entry.offsetDays);

    return {
      id: randomUUID(),
      vehicleName: vehicles[index % vehicles.length],
      type,
      jurisdiction: JURISDICTIONS[index % JURISDICTIONS.length],
      dueDate,
      submittedAt: isDone ? new Date(dueDate.getTime() - intBetween(1, 12) * DAY) : null,
      status: entry.status,
      assigneeId: chance(0.85) ? pick(assigneeIds) : null,
      notes: notesByType[type],
    };
  });
}

function buildAuditTrail(
  users: Array<{ id: string; email: string }>,
): Prisma.AuditLogCreateManyInput[] {
  const entries: Array<[string, string]> = [
    ['create', 'investment'],
    ['update', 'investment'],
    ['valuation', 'investment'],
    ['create', 'transaction'],
    ['update', 'transaction'],
    ['status', 'distribution'],
    ['create', 'filing'],
    ['update', 'filing'],
    ['role', 'user'],
    ['create', 'asset'],
  ];

  return entries.map(([action, resource], index) => {
    const actor = users[index % users.length];
    return {
      id: randomUUID(),
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      resource,
      resourceId: randomUUID(),
      ip: `102.36.${intBetween(0, 255)}.${intBetween(1, 254)}`,
      createdAt: daysFromNow(-intBetween(1, 45)),
    };
  });
}

/** Prints the headline numbers so a reviewer can sanity-check the seed. */
async function report(): Promise<void> {
  const [active, byType, investmentCount] = await Promise.all([
    prisma.investment.aggregate({
      where: { status: InvestmentStatus.ACTIVE },
      _sum: { currentValuation: true, costBasis: true },
    }),
    prisma.$queryRaw<Array<{ type: string; value: string }>>`
      SELECT a.type::text AS type, SUM(i.current_valuation)::text AS value
      FROM investments i JOIN assets a ON a.id = i.asset_id
      WHERE i.status = 'ACTIVE'
      GROUP BY a.type ORDER BY 2 DESC
    `,
    prisma.investment.count(),
  ]);

  const usd = (value: number): string => `$${(value / 1_000_000_000).toFixed(2)}B`;

  console.log('\n─────────────────────────────────────────────');
  console.log(`Positions:            ${investmentCount}`);
  console.log(`Portfolio valuation:  ${usd(Number(active._sum.currentValuation ?? 0))}`);
  console.log(`Cost basis:           ${usd(Number(active._sum.costBasis ?? 0))}`);
  for (const row of byType) {
    console.log(`  ${row.type.padEnd(16)} ${usd(Number(row.value))}`);
  }
  console.log('─────────────────────────────────────────────');
  console.log('Sign in with any email — the OTP is returned in the response.\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
