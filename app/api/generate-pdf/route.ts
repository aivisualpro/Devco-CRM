import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { html, filename = 'document.pdf' } = await request.json();

        if (!html) {
            return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
        }

        // Split content at page break markers and wrap each section
        const pageBreakPatterns = [
            /___PAGE_BREAK___/g,
            /<!-- PAGEBREAK -->/g,
            /<div class="page-break"><\/div>/g,
            /<div style="page-break-after:\s*always[^"]*"[^>]*><\/div>/gi
        ];
        
        // First normalize all page break markers to a single format
        let normalizedHtml = html;
        pageBreakPatterns.forEach(pattern => {
            normalizedHtml = normalizedHtml.replace(pattern, '___PAGE_BREAK___');
        });
        
        // Split into pages and wrap each in a section
        const pageSections = normalizedHtml.split('___PAGE_BREAK___').filter((s: string) => s.trim());
        const cleanedHtml = pageSections
            .map((section: string, index: number) => {
                const isLastSection = index === pageSections.length - 1;
                // Wrap each section - add page break after except for last section
                return `<div class="page-section">${section}</div>${isLastSection ? '' : '<div class="page-break"></div>'}`;
            })
            .join('');

        console.log(`[PDF] Generating PDF with Playwright - ${pageSections.length} page(s)`);

        // Full HTML document with proper Letter page sizing
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://cdn.jsdelivr.net/npm/quill@2.0.0/dist/quill.snow.css" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    /* CSS @page controls PDF page size and margins */
                    @page {
                        size: letter;
                        margin: 0.5in;
                    }
                    
                    /* Reset */
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    
                    html, body {
                        background: #ffffff;
                        font-family: Arial, sans-serif;
                        font-size: 11pt;
                        line-height: 1.15;
                        color: #1a1a1a;
                        margin: 0;
                        padding: 0;
                    }
                    
                    /* Content container - uses full printable area */
                    .content {
                        width: auto;
                        margin: 0;
                        background: #fff;
                    }
                    
                    /* Page break element - CSS handles pagination */
                    .page-break {
                        break-after: page;
                        page-break-after: always;
                        height: 0;
                        margin: 0;
                        padding: 0;
                        border: none;
                        display: block;
                    }
                    
                    /* Page section wrapper - each page section starts fresh */
                    .page-section {
                        break-inside: avoid-page;
                        page-break-inside: avoid;
                    }
                    
                    /* Quill editor reset */
                    .ql-container.ql-snow { 
                        border: none !important;
                        font-size: inherit;
                    }
                    
                    .ql-editor { 
                        padding: 0 !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                    }
                    
                    /* Tables */
                    table {
                        width: 100% !important;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    
                    table td, table th {
                        border: 1px solid #333 !important;
                        padding: 2px 4px;
                        vertical-align: top;
                    }
                    
                    /* Typography */
                    h1, h2, h3, h4, h5, h6 {
                        margin-top: 0;
                        margin-bottom: 6px;
                        font-weight: 600;
                    }
                    
                    h1 { font-size: 16pt; }
                    h2 { font-size: 14pt; }
                    h3 { font-size: 12pt; }
                    h4 { font-size: 11pt; }
                    
                    p {
                        margin: 0;
                    }
                    
                    ul, ol {
                        margin: 0;
                        padding-left: 1.5em;
                    }
                    
                    li {
                        margin-bottom: 0;
                    }
                    
                    strong, b {
                        font-weight: 600;
                    }
                    
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                <div class="content">
                    <div class="ql-container ql-snow">
                        <div class="ql-editor">
                            ${cleanedHtml}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Launch Browser based on environment
        let browser;
        const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

        if (isProd) {
            // Production (Vercel)
            const chromium = await import('@sparticuz/chromium-min').then(mod => mod.default);
            const { chromium: playwrightChromium } = await import('playwright-core');
            
            // Standard Vercel configuration
            const executablePath = await chromium.executablePath(
                'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
            );
            
            browser = await playwrightChromium.launch({
                args: chromium.args,
                executablePath,
                headless: true, // Standard for serverless
            });
        } else {
            // Development (Local)
            const { chromium: playwrightChromium } = await import('playwright');
            browser = await playwrightChromium.launch({
                headless: true
            });
        }

        const context = await browser.newContext({
            viewport: { width: 816, height: 1056 },  // Letter at 96 DPI
            deviceScaleFactor: 2
        });

        const page = await context.newPage();
        
        // Set content and wait for everything to load
        await page.setContent(fullHtml, { 
            waitUntil: 'networkidle'
        });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);
        
        // Small delay to ensure rendering is complete
        await page.waitForTimeout(500);

        // Generate PDF - let CSS handle page size and margins
        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true,  // CSS @page is source of truth
            margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
        });

        await browser.close();

        console.log(`[PDF] Generated PDF: ${pdfBuffer.length} bytes`);

        // Return PDF as downloadable file
        // Convert Buffer to Uint8Array for NextResponse compatibility
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        });

    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
