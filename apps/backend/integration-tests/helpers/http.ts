/**
 * Typed view of the axios instance @medusajs/test-utils hands to suites
 * (it is typed as any there).
 */
export interface HttpResponse<T> {
  status: number
  data: T
  headers: Record<string, string | string[] | undefined>
}

export interface RequestConfig {
  headers?: Record<string, string>
}

export interface HttpClient {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
  post<T = unknown>(url: string, body?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
  put<T = unknown>(url: string, body?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
  delete<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
  options<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
}

/** Resolves with the response for 4xx/5xx too, so tests can assert on it. */
export async function settle<T>(request: Promise<HttpResponse<T>>): Promise<HttpResponse<T>> {
  try {
    return await request
  } catch (error) {
    const response = (error as { response?: HttpResponse<T> }).response
    if (response) {
      return response
    }
    throw error
  }
}
