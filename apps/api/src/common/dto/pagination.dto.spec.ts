import { PaginationQueryDto, paginate, resolveOrderBy } from './pagination.dto';

const query = (overrides: Partial<PaginationQueryDto> = {}): PaginationQueryDto =>
  Object.assign(new PaginationQueryDto(), overrides);

describe('pagination helpers', () => {
  describe('skip', () => {
    it('is zero on the first page', () => {
      expect(query({ page: 1, pageSize: 25 }).skip).toBe(0);
    });

    it('advances by a whole page at a time', () => {
      expect(query({ page: 4, pageSize: 25 }).skip).toBe(75);
    });
  });

  describe('paginate', () => {
    it('reports the page count for a partial last page', () => {
      const result = paginate([1, 2], 51, query({ page: 3, pageSize: 25 }));

      expect(result.meta).toEqual({ page: 3, pageSize: 25, total: 51, totalPages: 3 });
    });

    it('reports one page rather than zero when there is nothing to show', () => {
      expect(paginate([], 0, query()).meta.totalPages).toBe(1);
    });
  });

  describe('resolveOrderBy', () => {
    const allowed = ['name', 'createdAt'] as const;

    it('uses the requested column and direction when both are allowed', () => {
      expect(resolveOrderBy(query({ sortBy: 'name', sortDir: 'asc' }), allowed, 'createdAt')).toEqual(
        { name: 'asc' },
      );
    });

    it('falls back to the default column and direction when no sort is requested', () => {
      expect(resolveOrderBy(query(), allowed, 'createdAt')).toEqual({ createdAt: 'desc' });
      expect(resolveOrderBy(query(), allowed, 'name', 'asc')).toEqual({ name: 'asc' });
    });

    it('ignores a column that is not on the allow-list', () => {
      // Anything else would let a query string steer the SQL ORDER BY clause.
      const injected = query({ sortBy: 'password"; DROP TABLE users; --', sortDir: 'asc' });

      expect(resolveOrderBy(injected, allowed, 'createdAt')).toEqual({ createdAt: 'asc' });
    });
  });
});
