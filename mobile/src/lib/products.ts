import { useQuery } from '@tanstack/react-query';

import { api } from './api';
import type { Product } from './types';

/**
 * Catalogue queries (PRD-LESSON3 §7.4, FR-M2.x).
 *
 * One endpoint, one cache key: Home and Product detail read the same
 * `GET /api/mobile/products` response, so the menu is fetched once per
 * minute no matter how many screens mount. Detail selects from the cached
 * list — no second round-trip per product.
 */

export const PRODUCTS_QUERY_KEY = ['products'] as const;

interface ProductsResponse {
  products: Product[];
}

async function fetchProducts(): Promise<Product[]> {
  const data = await api.get<ProductsResponse>('/api/mobile/products');
  return data.products;
}

/** Every active product, cached 60 s to match the route's Cache-Control. */
export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: fetchProducts,
    staleTime: 60_000,
  });
}

/** One product by slug, selected from the cached list (FR-M2.2). */
export function useProduct(slug: string | undefined) {
  const query = useProducts();
  const product = slug
    ? query.data?.find((item) => item.slug === slug)
    : undefined;
  return { ...query, product };
}
