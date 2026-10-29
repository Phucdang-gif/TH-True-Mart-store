// Lấy URL từ biến môi trường (file .env), dự phòng về localhost:3001 nếu chưa có
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hàm gọi API dùng chung cho toàn bộ frontend
 * Tự động gắn Base URL, Header JSON và JWT Authorization nếu đã đăng nhập
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('th_access_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.message || errorData?.error || `Lỗi kết nối tới server: HTTP ${response.status}`;
    throw new Error(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Ghép URL đầy đủ cho file tĩnh do backend phục vụ (VD: ảnh sản phẩm /uploads/products/TH-FRESH-1L.webp).
 * Hỗ trợ đường dẫn tuyệt đối (http/https), đường dẫn bắt đầu bằng / hoặc không có /.
 */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
}
