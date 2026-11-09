import { supabase } from './supabase'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')

export type ApiError = Error & { status?: number }
export type Category = { id: number; name: string; slug: string }
export type Product = {
  id: number
  variantId: number
  brand: string
  name: string
  slug: string
  imageUrl: string | null
  tag: string | null
  category: string | null
  categorySlug: string | null
  priceMinor: number
  stock: number
  optionName?: string
  optionValue?: string
}
export type ProductPage = { items: Product[]; total: number; page: number; pages: number; size: number }
export type BasketLine = {
  variantId: number
  productId: number
  name: string
  brand: string
  imageUrl: string | null
  priceMinor: number
  quantity: number
  stock: number
  optionName?: string
  optionValue?: string
}
export type Basket = { items: BasketLine[]; subtotalMinor: number; currency: string }
export type Customer = { id: number | string; email: string; firstName: string; lastName: string; role?: string }
export type CustomerAddress = { id: number; recipientName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string; countryCode: string; isDefault: boolean }
export type CustomerOrder = { id: number; status: string; subtotalMinor: number; currency: string; createdAt: string }
export type AdminProduct = {
  id: number; variantId: number | null; brand: string; name: string; slug: string; description?: string | null
  ingredients?: string | null; imageUrl: string | null; tag: string | null; categoryId: number | null; active: boolean
  sku: string | null; optionName: string | null; optionValue: string | null; priceMinor: number | null; stock: number | null
}
export type AdminProductPage = { items: AdminProduct[]; page: number; size: number; total: number }
export type AdminVariantWrite = { sku: string; optionName: string; optionValue: string; priceMinor: number; stock: number }
export type AdminOrder = { id: number; customerId: number; email: string; status: string; subtotalMinor: number; currency: string; createdAt: string }
export type AdminProductWrite = { brand: string; name: string; slug: string; description: string; ingredients: string; imageUrl: string; tag: string; categoryId: number | null }
export type ProductImageUploadAuthorization = { bucket: string; path: string; contentType: string; signedUrl: string; token: string; publicUrl: string; expiresInSeconds: number }

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (authenticated) {
    if (!supabase) throw Object.assign(new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'), { status: 0 }) as ApiError
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw Object.assign(new Error(error.message), { status: 0 }) as ApiError
    if (!session?.access_token) throw Object.assign(new Error('Sign in to your Boutique Beauty Retail account to continue.'), { status: 401 }) as ApiError
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw Object.assign(new Error('Could not reach the shop service. Check that the backend is running.'), { status: 0 }) as ApiError
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json() as { message?: string; error?: string }
      message = body.message || body.error || message
    } catch { /* response had no JSON error body */ }
    if (response.status === 401 && authenticated) message = 'Your sign-in session is missing or has expired. Sign in again to continue.'
    else if (response.status === 401) message = 'The public catalogue request was rejected by the shop API. Check that the frontend API URL points to the current backend and that catalog routes are public.'
    if (response.status === 403) message = 'You are signed in, but your account does not have permission for this action.'
    throw Object.assign(new Error(message), { status: response.status }) as ApiError
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  categories: () => request<Category[]>('/catalog/categories'),
  products: (params: { page: number; size: number; q: string; category: string; sort: string }, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(params.page), size: String(params.size), sort: params.sort })
    if (params.q) query.set('q', params.q)
    if (params.category) query.set('category', params.category)
    return request<ProductPage>(`/catalog/products?${query}`, { signal })
  },
  me: () => request<Customer>('/account/me', {}, true),
  addresses: () => request<CustomerAddress[]>('/account/addresses', {}, true),
  addAddress: (body: Omit<CustomerAddress, 'id'>) => request<CustomerAddress>('/account/addresses', { method: 'POST', body: JSON.stringify(body) }, true),
  removeAddress: (id: number) => request<void>(`/account/addresses/${id}`, { method: 'DELETE' }, true),
  customerOrders: () => request<CustomerOrder[]>('/orders', {}, true),
  basket: () => request<Basket>('/basket', {}, true),
  putBasketLine: (variantId: number, quantity: number) => request<Basket>('/basket/lines', { method: 'PUT', body: JSON.stringify({ variantId, quantity }) }, true),
  removeBasketLine: (variantId: number) => request<Basket>(`/basket/lines/${variantId}`, { method: 'DELETE' }, true),
  adminProducts: (page = 0, size = 50) => request<AdminProductPage>(`/admin/products?page=${page}&size=${size}`, {}, true),
  createAdminProduct: (body: { brand: string; name: string; slug: string; description: string; ingredients: string; imageUrl: string; tag: string; categoryId: number | null; priceMinor: number; sku: string; optionName: string; optionValue: string; stock: number }) => request<{ id: number; variantId: number }>('/admin/products', { method: 'POST', body: JSON.stringify(body) }, true),
  updateAdminProduct: (id: number, body: AdminProductWrite) => request<{ id: number; updated: boolean }>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  addAdminVariant: (id: number, body: AdminVariantWrite) => request<{ variantId: number }>(`/admin/products/${id}/variants`, { method: 'POST', body: JSON.stringify(body) }, true),
  updateAdminVariant: (productId: number, variantId: number, body: Omit<AdminVariantWrite, 'stock'>) => request<{ variantId: number; sku: string; optionName: string; optionValue: string; priceMinor: number }>(`/admin/products/${productId}/variants/${variantId}`, { method: 'PUT', body: JSON.stringify(body) }, true),
  requestProductImageUpload: (contentType: string) => request<ProductImageUploadAuthorization>('/admin/storage/product-images/upload-url', { method: 'POST', body: JSON.stringify({ contentType }) }, true),
  setProductActive: (id: number, active: boolean) => request<{ id: number; active: boolean }>(`/admin/products/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }, true),
  updateInventory: (variantId: number, quantity: number) => request<{ variantId: number; quantity: number }>(`/admin/inventory/${variantId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }, true),
  adminOrders: () => request<AdminOrder[]>('/admin/orders', {}, true),
  updateOrderStatus: (id: number, status: 'CONFIRMED' | 'CANCELLED' | 'FULFILLED') => request<{ id: number; status: string }>(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, true),
  subscribe: (email: string) => request<{ status: string }>('/newsletter', { method: 'POST', body: JSON.stringify({ email }) }),
}
