import React from 'react';
import dbConnect from '@/lib/db';
import { WebVital } from '@/lib/models';
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';

// Force dynamic rendering since we are reading from the DB for reporting
export const dynamic = 'force-dynamic';

export default async function VitalsReportPage() {
  await dbConnect();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // We want to calculate the p75 of value for each metric name per route.
  // Using MongoDB aggregation pipeline
  const aggregatedData = await WebVital.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $sort: { value: 1 },
    },
    {
      $group: {
        _id: { route: '$route', name: '$name' },
        values: { $push: '$value' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        route: '$_id.route',
        name: '$_id.name',
        count: 1,
        // Approximate p75 calculation in mongo
        p75: {
          $arrayElemAt: [
            '$values',
            {
              $floor: {
                $multiply: [0.75, { $size: '$values' }],
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$route',
        metrics: {
          $push: {
            name: '$name',
            p75: '$p75',
            count: '$count',
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Core Web Vitals Report (Last 7 Days)</h1>
      <p className="text-gray-500">Showing the 75th percentile (p75) values for each metric across routes.</p>
      
      {aggregatedData.map((routeData) => (
        <Card key={routeData._id || 'unknown'} className="shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-semibold">Route: {routeData._id || 'Unknown'}</h2>
          </div>
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>p75 Value</TableHead>
                  <TableHead>Sample Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeData.metrics.map((m: any) => (
                  <TableRow key={m.name}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      {Math.round(m.p75 * 10) / 10}
                      {m.name === 'CLS' ? '' : ' ms'}
                    </TableCell>
                    <TableCell>{m.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}

      {aggregatedData.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No vitals data collected yet for the last 7 days.
        </Card>
      )}
    </div>
  );
}
