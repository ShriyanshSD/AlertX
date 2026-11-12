export function getVercelRequestPath(requestUrl) {
  const parsedUrl = new URL(requestUrl, 'http://localhost');
  const path = parsedUrl.searchParams.get('__vercel_path');
  if (path !== '/api' && !path?.startsWith('/api/')) return null;
  parsedUrl.searchParams.delete('__vercel_path');
  return `${path}${parsedUrl.search}`;
}
