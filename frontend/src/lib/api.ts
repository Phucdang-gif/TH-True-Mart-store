// Lấy URL từ biến môi trường (file .env), dự phòng về localhost:3001 nếu chưa có
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hàm gọi API dùng chung cho toàn bộ frontend
 * Tự động gắn Base URL và cấu hình Header JSON
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Tự động thiết lập Content-Type là JSON
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Gọi fetch với Base URL + endpoint (VD: /api/products)
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Xử lý khi API trả về lỗi (400, 404, 409, 500...)
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    // Bắt đúng field message từ NestJS trả về
    const errorMessage = errorData?.message || errorData?.error || `Lỗi kết nối tới server: HTTP ${response.status}`;
    throw new Error(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
  }

  // Xử lý trường hợp API trả về 204 No Content (thường dùng ở hàm DELETE)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Ghép URL đầy đủ cho file tĩnh do backend phục vụ (VD: ảnh sản phẩm /uploads/abc.png)
 */
export function assetUrl(path: string): string {
  return `${API_URL}${path}`;
}