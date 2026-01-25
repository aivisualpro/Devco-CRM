import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Tag } from 'lucide-react';

export const maxDuration = 60; // Increase timeout to 60 seconds

export async function POST(request: NextRequest) {
    try {
        let { html, filename = 'document.pdf', coverImage, coverData } = await request.json();

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
        const pageSections = normalizedHtml
            .split('___PAGE_BREAK___')
            .map((s: string) => {
                // Trim trailing empty paragraphs/breaks that cause extra pages
                let trimmed = s.trim();
                // Remove trailing <p><br></p> or similar empty blocks
                while (trimmed.endsWith('<p><br></p>') || trimmed.endsWith('<p></p>') || trimmed.endsWith('<br>') || trimmed.endsWith('<p>&nbsp;</p>')) {
                    if (trimmed.endsWith('<p><br></p>')) trimmed = trimmed.slice(0, -11).trim();
                    else if (trimmed.endsWith('<p></p>')) trimmed = trimmed.slice(0, -7).trim();
                    else if (trimmed.endsWith('<p>&nbsp;</p>')) trimmed = trimmed.slice(0, -13).trim();
                    else if (trimmed.endsWith('<br>')) trimmed = trimmed.slice(0, -4).trim();
                }
                return trimmed;
            })
            .filter((s: string) => {
                // More aggressive filtering of empty content
                const stripped = s.replace(/<[^>]*>/g, '').trim(); // Remove all HTML tags
                return stripped.length > 0 && s.trim().length > 0;
            });

        // Read images for header and footer
        const publicDir = path.join(process.cwd(), 'public');
        let logoDataUrl = '';
        let footerDataUrl = '';

        try {
            const logoPath = path.join(publicDir, 'devco-logo-header.png');
            if (fs.existsSync(logoPath)) {
                const logoBase64 = fs.readFileSync(logoPath).toString('base64');
                logoDataUrl = `data:image/png;base64,${logoBase64}`;
            }

            const footerPath = path.join(publicDir, 'pdf-footer.png');
            if (fs.existsSync(footerPath)) {
                const footerBase64 = fs.readFileSync(footerPath).toString('base64');
                footerDataUrl = `data:image/png;base64,${footerBase64}`;
            }
        } catch (e) {
            console.error('Error reading assets for PDF:', e);
        }

        let coverFrameDataUrl = '';
        try {
            const coverFramePath = path.join(publicDir, 'template-cover-frame.png');
            if (fs.existsSync(coverFramePath)) {
                const base64 = fs.readFileSync(coverFramePath).toString('base64');
                coverFrameDataUrl = `data:image/png;base64,${base64}`;
            }
        } catch (e) {}

        let coverPageHtml = '';
        if (coverImage || coverFrameDataUrl) {
             // Convert to base64 if it's a local public file
             if (coverImage.startsWith('/')) {
                  const coverPath = path.join(process.cwd(), 'public', coverImage);
                  if (fs.existsSync(coverPath)) {
                       const coverBase64 = fs.readFileSync(coverPath).toString('base64');
                       // assume png/jpg
                       const ext = path.extname(coverPath).substring(1) || 'png';
                       coverImage = `data:image/${ext};base64,${coverBase64}`;
                  }
             }

             // Text Overlay Logic
             const { proposalNo = '', services = '', jobAddress = '', customerName = '' } = coverData || {};
             
             coverPageHtml = `
             <div class="page-section cover-page" style="height: 11in; width: 8.5in; margin: 0; padding: 0; position: relative; overflow: hidden; page-break-after: always; break-after: page;">
                 ${coverImage ? `<img src="${coverImage}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" />` : ''}
                 ${coverFrameDataUrl ? `<img src="${coverFrameDataUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 5;" />` : ''}
                 
                 <!-- Top Dynamic Info (Project Details) -->
                 <div style="position: absolute; top: 30%; left: 8%; width: 80%; z-index: 10; font-family: 'Lovelo', sans-serif;">
                    ${proposalNo ? `<div style="font-size: 38pt; font-weight: 900; color: #000; margin-bottom: 2px;">${proposalNo}</div>` : ''}
                    ${jobAddress ? `<div style="font-size: 28pt; width: 60%; font-weight: 900; color: #a91b3b; margin-bottom: 12px; line-height: 1.1;">${jobAddress.toUpperCase()}</div>` : ''}
                    
                    <div style="font-size: 34pt; font-weight: 900; color: #000; margin-bottom: 0px; width: 60%; line-height: 1.15; text-transform: uppercase;">
                        ${services}
                    </div>
                 </div>

                 <!-- Bottom Dynamic Info (Client Name - Aligned to Frame) -->
                 <div style="position: absolute; bottom: 4%; left: 10.5%; width: 50%; z-index: 10; font-family: 'Lovelo', sans-serif;">
                    <div style="font-size: 16pt; width: 70%; font-weight: 900; color: #1a365d; text-transform: uppercase; line-height: 1.2;">
                        ${customerName || ''}
                    </div>
                 </div>
             </div>
             `;
        }

        const cleanedHtml = pageSections
            .map((section: string) => {
                // Return each section wrapped in a page-section div with header/footer
                return `
                <div class="page-section">
                    <div class="pdf-header">
                        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="DEVCO" />` : ''}
                    </div>
                    <div class="pdf-content">
                        ${section}
                    </div>
                    <div class="pdf-footer">
                        ${footerDataUrl ? `<img src="${footerDataUrl}" alt="Footer" />` : ''}
                    </div>
                </div>`;
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
                <link href="https://fonts.cdnfonts.com/css/lovelo" rel="stylesheet">
                <style>
                    /* CSS @page controls PDF page size and margins */
                    @page {
                        size: letter;
                        margin-top: 0in;
                        margin-right: 0in;
                        margin-bottom: 0in;
                        margin-left: 0in;
                    }
                    
                    /* Reset */
                    * {
                        box-sizing: border-box !important;
                        margin: 0;
                        padding: 0;
                    }
                    
                    html, body {
                        background: #ffffff;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 10pt;
                        line-height: 1;
                        color: #1a1a1a;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    /* Content container - uses full printable area */
                    .content {
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                    }
                    

                    
                    /* Page section wrapper - Each section starts on a new page */
                    .page-section {
                        width: 100%;
                        min-height: 11in;
                        padding: 0.5in; /* Add padding here to simulate margins */
                        padding-top: 0;
                        padding-bottom: 0;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        page-break-after: always;
                        break-after: page;
                    }
                    
                    /* Cover page override */
                    .page-section.cover-page {
                        padding: 0 !important;
                        min-height: 11in;
                        height: 11in;
                    }

                    .pdf-header {
                        margin-bottom: 0px;
                        margin-top: 0px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .pdf-header img {
                        height: 80px; /* Adjust as needed */
                        width: auto;
                        display: block; /* Eliminate whitespace */
                    }

                    .pdf-content {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .pdf-footer {
                        margin-top: 0px;
                        width: 100%;
                    }
                    
                    .pdf-footer img {
                        width: 100%;
                        height: auto;
                    }
                    
                    /* Don't break after the last section to avoid trailing empty page */
                    .page-section:last-child {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    
                    /* Quill editor reset */
                    .ql-container.ql-snow { 
                        border: none !important;
                        font-size: inherit;
                        height: 100%;
                    }
                    
                    .ql-editor { 
                        padding: 0 !important;
                        height: 100% !important;
                        overflow: hidden !important;
                        line-height: 1.1;
                        white-space: normal;
                    }
                    
                    /* Tables */
                    table {
                        width: 100% !important;
                        border-collapse: collapse;
                        margin-bottom: 8px;
                        table-layout: fixed;
                    }
                    
                    table td, table th {
                        border: 1px solid #333 !important;
                        padding: 3px 5px;
                        vertical-align: top;
                        word-wrap: break-word;
                    }
                    
                    /* Typography matching */
                    h1, h2, h3, h4, h5, h6 {
                        margin-top: 0;
                        margin-bottom: 6px;
                        font-weight: 600;
                        line-height: 1.1;
                    }
                    
                    h1 { font-size: 18pt; }
                    h2 { font-size: 15pt; }
                    h3 { font-size: 13pt; }
                    h4 { font-size: 11pt; }
                    
                    p {
                        margin-bottom: 0px; /* Quill handles spacing usually with empty paragraphs */
                    }
                    
                    ul, ol {
                        margin-bottom: 0px;
                        padding-left: 1.5em;
                    }
                    
                    li {
                        margin-bottom: 0px;
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
                <div class="content"><div class="ql-container ql-snow"><div class="ql-editor">${coverPageHtml}${cleanedHtml}</div></div></div>
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

        // Generate PDF - allow multiple pages based on content
        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true,  // CSS @page is source of truth
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
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
