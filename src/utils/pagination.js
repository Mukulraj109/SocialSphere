export const getPagination = (query, defaultLimit = 50) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  hasMore: page * limit < total,
});
