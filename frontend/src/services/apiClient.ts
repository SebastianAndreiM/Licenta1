export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem('auth_token');

    const headers = new Headers(options.headers);

    if(!headers.has('Content-Type')){
    headers.set('Content-Type','application/json');
    }
    if(token){
        headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if(!response.ok){
        let message = 'An error occurred';
        try {
            const errorData = await response.json();

            if (typeof errorData.detail === 'string') {
                message = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
                message = errorData.detail
                    .map((item: { msg?: string }) => item.msg)
                    .filter(Boolean)
                    .join(', ');
            }
        } catch {
            message = response.statusText || message;
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json();
}