import mongoose from 'mongoose';
import { connectToDatabase } from './lib/db';
import { DevcoQuickBooks } from './lib/models';

async function test() {
    await connectToDatabase();
    console.time('agg');
    const projects = await DevcoQuickBooks.aggregate([
        {
            $project: {
                projectId: 1,
                project: 1,
                customer: 1,
                startDate: 1,
                createdAt: 1,
                status: 1,
                proposalNumber: 1,
                manualOriginalContract: 1,
                manualChangeOrders: 1,
                endDate: 1,
                income: {
                    $sum: {
                        $map: {
                            input: {
                                $filter: {
                                    input: { $ifNull: ["$transactions", []] },
                                    as: "t",
                                    cond: { $eq: [{ $toLower: "$$t.transactionType" }, "invoice"] }
                                }
                            },
                            as: "t",
                            in: "$$t.amount"
                        }
                    }
                },
                qbCost: {
                    $sum: {
                        $map: {
                            input: {
                                $filter: {
                                    input: { $ifNull: ["$transactions", []] },
                                    as: "t",
                                    cond: { $ne: [{ $toLower: "$$t.transactionType" }, "invoice"] }
                                }
                            },
                            as: "t",
                            in: "$$t.amount"
                        }
                    }
                }
            }
        },
        { $sort: { createdAt: -1 } }
    ]);
    console.timeEnd('agg');
    console.log(`Found ${projects.length} projects. First one:`, projects[0]);
    process.exit(0);
}
test();
