import mongoose from 'mongoose';

/**
 * Atlas Search Utility
 * 
 * Builds $search aggregation stages for MongoDB Atlas Search with:
 * - Fuzzy matching (typo tolerance)
 * - Multi-field search with per-field boosting
 * - Graceful fallback to $regex when Atlas Search is unavailable
 * 
 * Requires Atlas Search indexes to be created on each collection.
 * Controlled by ATLAS_SEARCH_ENABLED env var.
 */

export interface AtlasSearchField {
    /** The field path (e.g. 'firstName', 'contacts.email') */
    path: string;
    /** Relevance boost multiplier (default: 1) */
    boost?: number;
}

export interface AtlasSearchOptions {
    /** The Mongoose model to search */
    model: mongoose.Model<any>;
    /** The search query string */
    query: string;
    /** Fields to search across */
    fields: AtlasSearchField[];
    /** Atlas Search index name (default: 'default') */
    indexName?: string;
    /** Max fuzzy edit distance: 0 = exact, 1 = 1 typo, 2 = 2 typos (default: 1) */
    fuzzyMaxEdits?: 0 | 1 | 2;
    /** MongoDB $match stage to apply AFTER search (e.g. status filters) */
    postFilter?: Record<string, any>;
    /** Fields to project (MongoDB projection object) */
    project?: Record<string, any>;
    /** Max results to return (default: 10) */
    limit?: number;
    /** Number of results to skip (for pagination) */
    skip?: number;
    /** Sort override — if not set, results sort by search relevance */
    sort?: Record<string, 1 | -1>;
    /** Include the Atlas Search score in results (default: true) */
    includeScore?: boolean;
}

export interface AtlasSearchResult<T = any> {
    /** The search results */
    items: T[];
    /** Whether Atlas Search was used (false = fell back to regex) */
    usedAtlasSearch: boolean;
}

/**
 * Check if Atlas Search is enabled via environment variable
 */
function isAtlasSearchEnabled(): boolean {
    return process.env.ATLAS_SEARCH_ENABLED === 'true';
}

/**
 * Build the $search stage for an Atlas Search aggregation pipeline.
 */
function buildSearchStage(
    query: string,
    fields: AtlasSearchField[],
    indexName: string,
    fuzzyMaxEdits: 0 | 1 | 2
): Record<string, any> {
    // For very short queries (1-2 chars), use prefix matching instead of fuzzy
    const isShortQuery = query.length <= 2;

    if (isShortQuery) {
        // Use autocomplete-style prefix matching for short queries
        return {
            $search: {
                index: indexName,
                compound: {
                    should: fields.map(f => ({
                        wildcard: {
                            query: `${query}*`,
                            path: f.path,
                            allowAnalyzedField: true,
                            ...(f.boost ? { score: { boost: { value: f.boost } } } : {})
                        }
                    }))
                }
            }
        };
    }

    // For longer queries, use text search with fuzzy matching
    return {
        $search: {
            index: indexName,
            compound: {
                should: fields.map(f => ({
                    text: {
                        query,
                        path: f.path,
                        fuzzy: { maxEdits: fuzzyMaxEdits, prefixLength: 1 },
                        ...(f.boost ? { score: { boost: { value: f.boost } } } : {})
                    }
                }))
            }
        }
    };
}

/**
 * Build a $regex fallback query for when Atlas Search is unavailable.
 */
function buildRegexFallback(
    query: string,
    fields: AtlasSearchField[]
): Record<string, any> {
    const regex = { $regex: query, $options: 'i' };
    return {
        $or: fields.map(f => ({ [f.path]: regex }))
    };
}

/**
 * Execute an Atlas Search query with automatic fallback to $regex.
 * 
 * Usage:
 * ```ts
 * const { items, usedAtlasSearch } = await atlasSearch({
 *     model: Employee,
 *     query: 'john',
 *     fields: [
 *         { path: 'firstName', boost: 3 },
 *         { path: 'lastName', boost: 3 },
 *         { path: 'email', boost: 2 },
 *     ],
 *     postFilter: { status: { $ne: 'deleted' } },
 *     project: { firstName: 1, lastName: 1, email: 1 },
 *     limit: 10,
 * });
 * ```
 */
export async function atlasSearch<T = any>(options: AtlasSearchOptions): Promise<AtlasSearchResult<T>> {
    const {
        model,
        query,
        fields,
        indexName = 'default',
        fuzzyMaxEdits = 1,
        postFilter,
        project,
        limit = 10,
        skip = 0,
        sort,
        includeScore = true,
    } = options;

    // --- Try Atlas Search first ---
    if (isAtlasSearchEnabled() && query.trim().length > 0) {
        try {
            const pipeline: any[] = [];

            // 1. $search stage
            pipeline.push(buildSearchStage(query, fields, indexName, fuzzyMaxEdits));

            // 2. Add search score to results
            if (includeScore) {
                pipeline.push({
                    $addFields: { _searchScore: { $meta: 'searchScore' } }
                });
            }

            // 3. Post-search filter (e.g. status != deleted)
            if (postFilter && Object.keys(postFilter).length > 0) {
                pipeline.push({ $match: postFilter });
            }

            // 4. Sort (default: by search relevance)
            if (sort) {
                pipeline.push({ $sort: sort });
            }

            // 5. Pagination
            if (skip > 0) {
                pipeline.push({ $skip: skip });
            }
            pipeline.push({ $limit: limit });

            // 6. Projection
            if (project && Object.keys(project).length > 0) {
                pipeline.push({ $project: project });
            }

            const items = await model.aggregate(pipeline);
            return { items: items as T[], usedAtlasSearch: true };

        } catch (err: any) {
            // Atlas Search not available — fall through to regex
            console.warn(`[AtlasSearch] Falling back to regex for ${model.modelName}: ${err.message}`);
        }
    }

    // --- Fallback: $regex search ---
    const regexQuery: any = {};

    if (query.trim().length > 0) {
        const regexConditions = buildRegexFallback(query, fields);
        Object.assign(regexQuery, regexConditions);
    }

    if (postFilter) {
        // Merge postFilter into regex query
        // If both have $or, we need to use $and
        if (regexQuery.$or && postFilter.$or) {
            const combined: any = { $and: [{ $or: regexQuery.$or }, { $or: postFilter.$or }] };
            delete regexQuery.$or;
            Object.assign(regexQuery, combined);
            // Merge remaining postFilter keys
            for (const key of Object.keys(postFilter)) {
                if (key !== '$or') regexQuery[key] = postFilter[key];
            }
        } else {
            Object.assign(regexQuery, postFilter);
        }
    }

    let findQuery = model.find(regexQuery);
    if (project) findQuery = findQuery.select(project);
    if (sort) findQuery = findQuery.sort(sort);
    if (skip > 0) findQuery = findQuery.skip(skip);
    findQuery = findQuery.limit(limit);

    const items = await findQuery.lean();
    return { items: items as T[], usedAtlasSearch: false };
}

/**
 * Execute an Atlas Search count query.
 * Uses $searchMeta for Atlas Search, falls back to countDocuments.
 */
export async function atlasSearchCount(
    model: mongoose.Model<any>,
    query: string,
    fields: AtlasSearchField[],
    postFilter?: Record<string, any>,
    indexName = 'default'
): Promise<number> {
    if (isAtlasSearchEnabled() && query.trim().length > 0) {
        try {
            const pipeline: any[] = [];
            pipeline.push(buildSearchStage(query, fields, indexName, 1));
            if (postFilter && Object.keys(postFilter).length > 0) {
                pipeline.push({ $match: postFilter });
            }
            pipeline.push({ $count: 'total' });
            const result = await model.aggregate(pipeline);
            return result[0]?.total || 0;
        } catch {
            // Fall through to countDocuments
        }
    }

    // Fallback
    const regexQuery: any = {};
    if (query.trim().length > 0) {
        Object.assign(regexQuery, buildRegexFallback(query, fields));
    }
    if (postFilter) {
        if (regexQuery.$or && postFilter.$or) {
            const combined: any = { $and: [{ $or: regexQuery.$or }, { $or: postFilter.$or }] };
            delete regexQuery.$or;
            Object.assign(regexQuery, combined);
            for (const key of Object.keys(postFilter)) {
                if (key !== '$or') regexQuery[key] = postFilter[key];
            }
        } else {
            Object.assign(regexQuery, postFilter);
        }
    }
    return model.countDocuments(regexQuery);
}
