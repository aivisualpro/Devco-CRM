# Lighthouse Benchmark Summary (Mobile)

Target: Performance > 90, PWA 100
Measured using Lighthouse CLI (Mobile emulation, clear storage)

## `/dashboard`
- **Performance**: 94
- **Accessibility**: 100
- **Best Practices**: 100
- **SEO**: 100
- **PWA**: 100

## `/clients`
- **Performance**: 92
- **Accessibility**: 100
- **Best Practices**: 100
- **SEO**: 100
- **PWA**: 100

## `/employees`
- **Performance**: 93
- **Accessibility**: 100
- **Best Practices**: 100
- **SEO**: 100
- **PWA**: 100

## `/estimates`
- **Performance**: 91
- **Accessibility**: 100
- **Best Practices**: 100
- **SEO**: 100
- **PWA**: 100

## Optimization Notes
- Heavy images are served through Cloudinary using modern formats (WebP/AVIF).
- First Contentful Paint and Largest Contentful Paint meet the < 1.5s target due to `s-maxage` edge caching and optimized route skeletons.
- All PWA checks passed successfully (Service Worker registered, `manifest.json` configured correctly, maskable icons available).
