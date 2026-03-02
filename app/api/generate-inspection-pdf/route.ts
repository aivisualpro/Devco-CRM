import { NextRequest, NextResponse } from 'next/server';
import { processGoogleDoc } from '@/lib/googleService';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const { templateId, variables, items } = await req.json();

        if (!templateId) {
            return NextResponse.json({ success: false, error: 'Missing templateId' }, { status: 400 });
        }

        const allVars: Record<string, any> = { ...variables };

        // Generate numbered variables for each inspection item
        const itemCount = items?.length || 0;
        const maxRows = 20;
        const totalSlots = Math.max(itemCount, maxRows);

        for (let i = 0; i < totalSlots; i++) {
            const idx = i + 1;
            const item = items?.[i];

            if (item) {
                allVars[`item_name_${idx}`] = item.name || '';
                allVars[`item_status_${idx}`] = item.status === 'ok' ? '✓ OK' : item.status === 'needs_attention' ? '⚠ Needs Attention' : '';
                allVars[`item_notes_${idx}`] = item.notes || '';
            } else {
                allVars[`item_name_${idx}`] = '';
                allVars[`item_status_${idx}`] = '';
                allVars[`item_notes_${idx}`] = '';
            }
        }

        const pdfBuffer = await processGoogleDoc(templateId, allVars, {
            postProcess: async (docId: string, docsApi: any) => {
                try {
                    const doc = await docsApi.documents.get({ documentId: docId });
                    const body = doc.data.body?.content || [];
                    const deleteRequests: any[] = [];

                    for (const element of body) {
                        if (!element.table) continue;
                        const rows = element.table.tableRows || [];
                        for (let rowIdx = rows.length - 1; rowIdx >= 1; rowIdx--) {
                            const row = rows[rowIdx];
                            const cells = row.tableCells || [];
                            let isRowEmpty = true;

                            for (const cell of cells) {
                                for (const contentEl of cell.content || []) {
                                    const elements = contentEl.paragraph?.elements || [];
                                    for (const el of elements) {
                                        const text = (el.textRun?.content || '').replace(/\n/g, '').trim();
                                        if (text) { isRowEmpty = false; break; }
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
                } catch (err) {
                    console.error('PostProcess error:', err);
                }
            }
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="Equipment_Inspection_Checklist.pdf"'
            }
        });
    } catch (error: any) {
        console.error('Generate Equipment Inspection PDF Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to generate PDF' }, { status: 500 });
    }
}
