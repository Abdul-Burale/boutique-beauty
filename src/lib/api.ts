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
export type Customer = { id: number; email: string; firstName: string; lastName: string; role?: string }
export type AuthResult = { token: string; expiresAt: string; customer: Customer }

export const getToken = () => sessionStorage.getItem('boutique-beauty-retail-session-token')
export const saveToken = (token: string | null) => token ? sessionStorage.setItem('boutique-beauty-retail-session-token', token) : sessionStorage.removeItem('boutique-beauty-retail-session-token')

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (authenticated && token) headers.set('Authorization', `Bearer ${token}`)
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
  login: (email: string, password: string) => request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (body: { firstName: string; lastName: string; email: string; password: string }) => request<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }, true),
  me: () => request<Customer>('/account/me', {}, true),
  basket: () => request<Basket>('/basket', {}, true),
  putBasketLine: (variantId: number, quantity: number) => request<Basket>('/basket/lines', { method: 'PUT', body: JSON.stringify({ variantId, quantity }) }, true),
  removeBasketLine: (variantId: number) => request<Basket>(`/basket/lines/${variantId}`, { method: 'DELETE' }, true),
  subscribe: (email: string) => request<{ status: string }>('/newsletter', { method: 'POST', body: JSON.stringify({ email }) }),
}
