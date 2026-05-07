import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Constant } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';

const VIEW_TYPE = 'AppSettings';
const valueKey = (email: string, slug: string) => `financialView_${email}_${slug}`;
const listPrefix = (email: string) => `financialView_${email}_`;

/** GET — list all saved views for this user */
export async function GET(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await connectToDatabase();
        const docs = await Constant.find({
            type: VIEW_TYPE,
            value: { $regex: `^financialView_${user.email}_` },
        }).lean();

        const views = docs.map(d => ({
            id: d._id.toString(),
            slug: d.value!.replace(listPrefix(user.email), ''),
            ...(d.data || {}),
        }));

        return NextResponse.json({ views });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** POST — create a new saved view */
export async function POST(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { slug, name, datePreset, dateFrom, dateTo, proposalWriters, statuses, customers, drill, drillValue } = body;

        if (!slug || !name) {
            return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
        }

        // Sanitize slug: lowercase, only alphanumeric + dash
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
        const value = valueKey(user.email, cleanSlug);

        await connectToDatabase();

        // Upsert
        await Constant.findOneAndUpdate(
            { type: VIEW_TYPE, value },
            {
                $set: {
                    type: VIEW_TYPE,
                    value,
                    data: { name, slug: cleanSlug, datePreset, dateFrom, dateTo, proposalWriters, statuses, customers, drill, drillValue, owner: user.email, updatedAt: new Date() },
                },
            },
            { upsert: true, new: true },
        );

        return NextResponse.json({ ok: true, slug: cleanSlug });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** DELETE — remove a saved view by slug */
export async function DELETE(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { slug } = await req.json();
        if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

        await connectToDatabase();
        await Constant.deleteOne({ type: VIEW_TYPE, value: valueKey(user.email, slug) });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** PATCH — rename a saved view */
export async function PATCH(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { slug, name } = await req.json();
        if (!slug || !name) return NextResponse.json({ error: 'slug + name required' }, { status: 400 });

        await connectToDatabase();
        await Constant.updateOne(
            { type: VIEW_TYPE, value: valueKey(user.email, slug) },
            { $set: { 'data.name': name, 'data.updatedAt': new Date() } },
        );

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
