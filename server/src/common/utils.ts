import { Prisma } from '@prisma/client';

export const VN_TZ = 'Asia/Ho_Chi_Minh';
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Ngày theo giờ Việt Nam dạng YYYYMMDD (dùng cho mã hóa đơn, mã ca...) */
export function vnDateStamp(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/-/g, '');
}

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export function buildMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Chuyển from/to thành DateTimeFilter.
 * Nếu client gửi dạng ngày (YYYY-MM-DD) thì hiểu theo giờ VN: from = 00:00, to = hết ngày.
 */
export function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const filter: Prisma.DateTimeFilter = {};
  if (from) filter.gte = new Date(isDateOnly(from) ? `${from}T00:00:00+07:00` : from);
  if (to) filter.lte = new Date(isDateOnly(to) ? `${to}T23:59:59.999+07:00` : to);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

export const formatVnd = (v: Prisma.Decimal | number | string) =>
  Number(v).toLocaleString('vi-VN');
