/**
 * Cloudflare Worker: R2 File Server
 * Serves files from R2 bucket via files.devcohq.com
 * 
 * URL format: https://files.devcohq.com/{key}
 * Example:    https://files.devcohq.com/uploads/1707312345_aerial.pdf
 * Download:   https://files.devcohq.com/uploads/1707312345_aerial.pdf?download=true
 */

export interface Env {
  STORAGE: R2Bucket;
  ALLOWED_ORIGINS: string;
}

// Content type mapping for common extensions
const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

function getContentType(key: string): string {
  const ext = '.' + key.split('.').pop()?.toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function getCleanFilename(key: string): string {
  const filename = key.split('/').pop() || 'file';
  // Remove timestamp prefix (e.g., "1707312345_filename.pdf" → "filename.pdf")
  return filename.replace(/^\d+_/, '');
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  
  // Allow the origin if it's in the allowed list, or allow all in development
  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow GET and HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'r2-file-server' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get the R2 key from the URL path (remove leading slash)
    const key = decodeURIComponent(url.pathname.slice(1));

    if (!key) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    try {
      // Check if download is requested
      const forceDownload = url.searchParams.get('download') === 'true';

      // Fetch from R2
      const object = await env.STORAGE.get(key);

      if (!object) {
        return new Response('File not found', { status: 404, headers: corsHeaders });
      }

      // Determine content type
      const contentType = object.httpMetadata?.contentType || getContentType(key);
      const cleanFilename = getCleanFilename(key);

      // Build response headers
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'ETag': object.httpEtag,
        // Cache for 1 year — files are immutable (unique filenames with timestamps)
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...corsHeaders,
      };

      if (object.size !== undefined) {
        headers['Content-Length'] = object.size.toString();
      }

      // Set Content-Disposition based on download flag
      if (forceDownload) {
        headers['Content-Disposition'] = `attachment; filename="${cleanFilename}"`;
      } else {
        headers['Content-Disposition'] = `inline; filename="${cleanFilename}"`;
      }

      // Handle HEAD request
      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
      }

      return new Response(object.body, { status: 200, headers });

    } catch (error: any) {
      console.error('R2 fetch error:', error);
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
  },
};
