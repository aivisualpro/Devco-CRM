import { NextRequest } from "next/server";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: { [key: string]: 1 | -1 } | null;
}

export function parsePagination(request: NextRequest): PaginationParams {
  const { searchParams } = new URL(request.url);
  
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const sortParam = searchParams.get("sort");

  let page = 1;
  if (pageParam) {
    const parsedPage = parseInt(pageParam, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  let limit = 25;
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 100);
    }
  }

  const skip = (page - 1) * limit;

  let sort: { [key: string]: 1 | -1 } | null = null;
  if (sortParam) {
    sort = {};
    const parts = sortParam.split(",");
    for (const part of parts) {
      const [field, order] = part.split(":");
      if (field) {
        sort[field] = order === "desc" ? -1 : 1;
      }
    }
    if (Object.keys(sort).length === 0) {
      sort = null;
    }
  }

  return { page, limit, skip, sort };
}

export interface PaginationResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextPage: number | null;
}

export function buildPaginationResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginationResponse<T> {
  const hasMore = page * limit < total;
  const nextPage = hasMore ? page + 1 : null;

  return {
    items,
    page,
    limit,
    total,
    hasMore,
    nextPage,
  };
}

export function parseSearch(request: NextRequest): { q: string | null } {
  const { searchParams } = new URL(request.url);
  const qParam = searchParams.get("q");

  let q: string | null = null;
  if (qParam && qParam.trim() !== "") {
    q = qParam.trim();
  }

  return { q };
}
