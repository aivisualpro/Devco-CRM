import { NextRequest, NextResponse } from 'next/server';
import { processGoogleDoc } from '@/lib/googleService';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const { templateId, variables, items } = await req.json();

        if (!templateId) {
            return NextResponse.json({ success: false, error: 'Missing templateId' }, { status: 400 });
        }

        // Build the full variable set: header vars + numbered rod item vars
        const allVars: Record<string, any> = { ...variables };

        // Generate numbered variables for each rod log item (dynamic count)
        const itemCount = items?.length || 0;

        // Fill enough rows to cover the template. Assume template has up to 50 rows.
        const maxTemplateRows = 50;
        const totalSlots = Math.max(itemCount, maxTemplateRows);

        for (let i = 0; i < totalSlots; i++) {
            const idx = i + 1;
            const item = items?.[i];

            if (item) {
                allVars[`rod_number_${idx}`] = item.rodNumber || String(idx);
                allVars[`distance_${idx}`] = item.distance || '';
                allVars[`top_depth_${idx}`] = item.topDepth || '';
                allVars[`bottom_depth_${idx}`] = item.bottomDepth || '';
                allVars[`over_under_${idx}`] = item.overOrUnder || '';
                allVars[`existing_utilities_${idx}`] = item.existingUtilities || '';
                allVars[`picture_${idx}`] = item.picture || '';
            } else {
                // Clear placeholder for unused slots
                allVars[`rod_number_${idx}`] = '';
                allVars[`distance_${idx}`] = '';
                allVars[`top_depth_${idx}`] = '';
                allVars[`bottom_depth_${idx}`] = '';
                allVars[`over_under_${idx}`] = '';
                allVars[`existing_utilities_${idx}`] = '';
                allVars[`picture_${idx}`] = '';
            }
        }

        // Collect original photo URLs for linking images in the PDF
        const originalPhotoUrls: string[] = [];
        for (let i = 0; i < itemCount; i++) {
            const item = items[i];
            if (item.picture) originalPhotoUrls.push(item.picture);
        }

        // Generate PDF using processGoogleDoc
        const pdfBuffer = await processGoogleDoc(templateId, allVars, {
            imageSize: { width: 130, height: 100 },

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
                    doc = await docsApi.documents.get({ documentId: docId });
                    body = doc.data.body?.content || [];

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
                } catch (err) {
                    console.error('PostProcess error:', err);
                }
            }
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="Pre_Bore_Log.pdf"'
            }
        });
    } catch (error: any) {
        console.error('Generate Pre-Bore PDF Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to generate PDF' }, { status: 500 });
    }
}
