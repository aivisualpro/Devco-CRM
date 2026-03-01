import { NextRequest, NextResponse } from 'next/server';
import { processGoogleDoc } from '@/lib/googleService';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const { templateId, variables, items } = await req.json();

        if (!templateId) {
            return NextResponse.json({ success: false, error: 'Missing templateId' }, { status: 400 });
        }

        // Build the full variable set: header vars + numbered item vars
        const allVars: Record<string, any> = { ...variables };

        // Generate numbered variables for each pothole item (dynamic count)
        const itemCount = items?.length || 0;

        // We need to fill enough rows to cover the template. Assume template has up to 50 rows.
        // Items that exist get their data, remaining get empty strings (to clear placeholders).
        const maxTemplateRows = 50;
        const totalSlots = Math.max(itemCount, maxTemplateRows);

        for (let i = 0; i < totalSlots; i++) {
            const idx = i + 1;
            const item = items?.[i];

            if (item) {
                allVars[`pothole_no_${idx}`] = item.potholeNo || String(idx);
                allVars[`utility_type_${idx}`] = item.typeOfUtility || '';
                allVars[`soil_type_${idx}`] = item.soilType || '';
                allVars[`top_depth_${idx}`] = item.topDepthOfUtility || '';
                allVars[`bottom_depth_${idx}`] = item.bottomDepthOfUtility || '';
                allVars[`pin_${idx}`] = item.pin || '';
                allVars[`latitude_${idx}`] = item.latitude ? String(item.latitude) : '';
                allVars[`longitude_${idx}`] = item.longitude ? String(item.longitude) : '';

                // Photos as separate vars — processGoogleDoc detects URLs > 50 chars as images
                const photos = [
                    ...(item.photos || []),
                    ...(item.photo1 ? [item.photo1] : []),
                    ...(item.photo2 ? [item.photo2] : [])
                ].filter((v: string, vi: number, a: string[]) => a.indexOf(v) === vi);

                allVars[`photo_${idx}_1`] = photos[0] || '';
                allVars[`photo_${idx}_2`] = photos[1] || '';
            } else {
                // Clear placeholder for unused slots
                allVars[`pothole_no_${idx}`] = '';
                allVars[`utility_type_${idx}`] = '';
                allVars[`soil_type_${idx}`] = '';
                allVars[`top_depth_${idx}`] = '';
                allVars[`bottom_depth_${idx}`] = '';
                allVars[`pin_${idx}`] = '';
                allVars[`latitude_${idx}`] = '';
                allVars[`longitude_${idx}`] = '';
                allVars[`photo_${idx}_1`] = '';
                allVars[`photo_${idx}_2`] = '';
            }
        }

        // Collect original photo URLs in order for linking images in the PDF
        const originalPhotoUrls: string[] = [];
        // Collect coordinate info for Google Maps links
        const coordInfo: { lat: string; lng: string; mapsUrl: string }[] = [];

        for (let i = 0; i < itemCount; i++) {
            const item = items[i];
            const photos = [
                ...(item.photos || []),
                ...(item.photo1 ? [item.photo1] : []),
                ...(item.photo2 ? [item.photo2] : [])
            ].filter((v: string, vi: number, a: string[]) => a.indexOf(v) === vi);
            if (photos[0]) originalPhotoUrls.push(photos[0]);
            if (photos[1]) originalPhotoUrls.push(photos[1]);

            // Coordinates for Google Maps links
            if (item.latitude && item.longitude) {
                const lat = String(item.latitude);
                const lng = String(item.longitude);
                coordInfo.push({
                    lat,
                    lng,
                    mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`
                });
            }
        }

        // Generate PDF using processGoogleDoc with custom options
        const pdfBuffer = await processGoogleDoc(templateId, allVars, {
            // Larger images — fill the photo column width (~1.8" × 1.4")
            imageSize: { width: 130, height: 100 },

            // Post-process: 1) delete empty table rows, 2) add hyperlinks to images
            postProcess: async (docId: string, docsApi: any, _driveApi: any) => {
                try {
                    // ── Step 1: Delete empty table rows ──
                    let doc = await docsApi.documents.get({ documentId: docId });
                    let body = doc.data.body?.content || [];
                    const deleteRequests: any[] = [];

                    for (const element of body) {
                        if (!element.table) continue;

                        const rows = element.table.tableRows || [];
                        // Skip header row (index 0), check data rows from BOTTOM to TOP
                        for (let rowIdx = rows.length - 1; rowIdx >= 1; rowIdx--) {
                            const row = rows[rowIdx];
                            const cells = row.tableCells || [];
                            let isRowEmpty = true;

                            for (const cell of cells) {
                                for (const contentEl of cell.content || []) {
                                    const elements = contentEl.paragraph?.elements || [];
                                    for (const el of elements) {
                                        if (el.inlineObjectElement) {
                                            isRowEmpty = false;
                                            break;
                                        }
                                        const text = (el.textRun?.content || '').replace(/\n/g, '').trim();
                                        if (text) {
                                            isRowEmpty = false;
                                            break;
                                        }
                                    }
                                    if (!isRowEmpty) break;
                                }
                                if (!isRowEmpty) break;
                            }

                            if (isRowEmpty) {
                                deleteRequests.push({
                                    deleteTableRow: {
                                        tableCellLocation: {
                                            tableStartLocation: { index: element.startIndex },
                                            rowIndex: rowIdx,
                                            columnIndex: 0
                                        }
                                    }
                                });
                            }
                        }
                    }

                    if (deleteRequests.length > 0) {
                        await docsApi.documents.batchUpdate({
                            documentId: docId,
                            requestBody: { requests: deleteRequests }
                        });
                    }

                    // ── Step 2: Add hyperlinks to inline images ──
                    // Re-read the document after row deletions (indices changed)
                    doc = await docsApi.documents.get({ documentId: docId });
                    body = doc.data.body?.content || [];

                    // Find all inline objects in document order
                    const inlineImages: { startIndex: number; endIndex: number }[] = [];
                    const scanForImages = (content: any[]) => {
                        for (const el of content) {
                            if (el.paragraph?.elements) {
                                for (const e of el.paragraph.elements) {
                                    if (e.inlineObjectElement) {
                                        inlineImages.push({
                                            startIndex: e.startIndex,
                                            endIndex: e.endIndex
                                        });
                                    }
                                }
                            } else if (el.table?.tableRows) {
                                for (const r of el.table.tableRows) {
                                    for (const cell of r.tableCells || []) {
                                        if (cell.content) scanForImages(cell.content);
                                    }
                                }
                            }
                        }
                    };
                    scanForImages(body);

                    // Apply hyperlinks — match images to original URLs in order
                    if (inlineImages.length > 0 && originalPhotoUrls.length > 0) {
                        const linkRequests: any[] = [];
                        for (let i = 0; i < inlineImages.length && i < originalPhotoUrls.length; i++) {
                            const img = inlineImages[i];
                            const url = originalPhotoUrls[i];
                            if (url && img.startIndex != null && img.endIndex != null) {
                                linkRequests.push({
                                    updateTextStyle: {
                                        range: {
                                            startIndex: img.startIndex,
                                            endIndex: img.endIndex
                                        },
                                        textStyle: {
                                            link: { url }
                                        },
                                        fields: 'link'
                                    }
                                });
                            }
                        }

                        if (linkRequests.length > 0) {
                            await docsApi.documents.batchUpdate({
                                documentId: docId,
                                requestBody: { requests: linkRequests }
                            });
                        }
                    }

                    // ── Step 3: Make coordinates clickable (Google Maps links) ──
                    if (coordInfo.length > 0) {
                        // Re-read document after image link changes
                        doc = await docsApi.documents.get({ documentId: docId });
                        body = doc.data.body?.content || [];

                        const coordLinkRequests: any[] = [];
                        const usedLats = new Set<string>();

                        const scanForCoordLinks = (content: any[]) => {
                            for (const el of content) {
                                if (el.paragraph?.elements) {
                                    for (const e of el.paragraph.elements) {
                                        const text = e.textRun?.content || '';
                                        for (const coord of coordInfo) {
                                            if (text.includes(coord.lat) && !usedLats.has(coord.lat)) {
                                                usedLats.add(coord.lat);
                                                const paraStart = el.paragraph.elements[0]?.startIndex;
                                                const paraEnd = el.paragraph.elements[el.paragraph.elements.length - 1]?.endIndex;
                                                if (paraStart != null && paraEnd != null && paraEnd > paraStart) {
                                                    coordLinkRequests.push({
                                                        updateTextStyle: {
                                                            range: { startIndex: paraStart, endIndex: paraEnd },
                                                            textStyle: {
                                                                link: { url: coord.mapsUrl },
                                                                foregroundColor: { color: { rgbColor: { red: 0.06, green: 0.3, blue: 0.46 } } }
                                                            },
                                                            fields: 'link,foregroundColor'
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    }
                                } else if (el.table?.tableRows) {
                                    for (const r of el.table.tableRows) {
                                        for (const cell of r.tableCells || []) {
                                            if (cell.content) scanForCoordLinks(cell.content);
                                        }
                                    }
                                }
                            }
                        };
                        scanForCoordLinks(body);

                        if (coordLinkRequests.length > 0) {
                            await docsApi.documents.batchUpdate({
                                documentId: docId,
                                requestBody: { requests: coordLinkRequests }
                            });
                        }
                    }
                } catch (err) {
                    console.error('PostProcess error:', err);
                    // Don't throw — still export the PDF even if post-processing fails
                }
            }
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="Pothole_Log.pdf"'
            }
        });
    } catch (error: any) {
        console.error('Generate Pothole PDF Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to generate PDF' }, { status: 500 });
    }
}
