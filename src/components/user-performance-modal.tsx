
'use client';

import { useMemo } from 'react';
import type { Visit } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

interface UserPerformanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    visits: Visit[];
}

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(210, 100%, 70%)',
    'hsl(180, 100%, 70%)',
    'hsl(300, 100%, 70%)',
];

export default function UserPerformanceModal({ isOpen, onClose, visits }: UserPerformanceModalProps) {
    const closedDeals = useMemo(() => visits.filter(v => v.dealClosed), [visits]);

    const coolerDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        closedDeals.forEach(visit => {
            if (visit.interestedUnits) {
                visit.interestedUnits.forEach(unit => {
                    counts[unit] = (counts[unit] || 0) + 1;
                });
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [closedDeals]);

    const salesByLocation = useMemo(() => {
        const counts: Record<string, number> = {};
        closedDeals.forEach(visit => {
            if (visit.city) {
                counts[visit.city] = (counts[visit.city] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([city, sales]) => ({ city, sales })).sort((a, b) => b.sales - a.sales);
    }, [closedDeals]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>User Performance Dashboard</DialogTitle>
                    <DialogDescription>
                        A visual summary of your sales performance based on closed deals.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto pr-4 grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cooler Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {coolerDistribution.length > 0 ? (
                                <ChartContainer config={{}} className="h-[300px] w-full">
                                    <PieChart>
                                        <RechartsTooltip content={<ChartTooltipContent nameKey="name" />} />
                                        <Pie
                                            data={coolerDistribution}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            fill="#8884d8"
                                            labelLine={false}
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                                const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                                return (
                                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                        {`${(percent * 100).toFixed(0)}%`}
                                                    </text>
                                                );
                                            }}
                                        >
                                            {coolerDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Legend />
                                    </PieChart>
                                </ChartContainer>
                            ) : (
                                <p className="text-muted-foreground text-center">No cooler data from closed deals yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sales by Location</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {salesByLocation.length > 0 ? (
                                <ChartContainer config={{}} className="h-[300px] w-full">
                                    <BarChart data={salesByLocation} layout="vertical" margin={{ left: 20, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="city" type="category" width={80} tick={{ fontSize: 12 }} />
                                        <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <p className="text-muted-foreground text-center">No location data from closed deals yet.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
