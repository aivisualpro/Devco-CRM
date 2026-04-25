export function cld(
  url: string | null | undefined,
  options: { w?: number; h?: number; q?: string; f?: string; crop?: string } = {}
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;

  const { w, h, q = 'auto', f = 'auto', crop = 'fill' } = options;

  const transforms: string[] = [];
  if (w) transforms.push(`w_${w}`);
  if (h) transforms.push(`h_${h}`);
  if (crop) transforms.push(`c_${crop}`);
  if (q) transforms.push(`q_${q}`);
  if (f) transforms.push(`f_${f}`);

  const transformStr = transforms.join(',');

  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return url;

  const preUpload = url.substring(0, uploadIndex + 8); // includes '/upload/'
  const postUpload = url.substring(uploadIndex + 8);

  const pathParts = postUpload.split('/');
  
  // If the first part doesn't start with 'v' followed by digits and isn't a file (no dot),
  // it might be an existing transformation string. We can remove it to replace with ours.
  if (!pathParts[0].match(/^v\d+$/) && !pathParts[0].includes('.')) {
    pathParts.shift();
  }

  return `${preUpload}${transformStr}/${pathParts.join('/')}`;
}
