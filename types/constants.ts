// TypeScript type definitions for Constants

export interface Constant {
    _id?: string;
    category?: string;
    description?: string;
    value?: string;
    color?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export type ConstantCategory =
    | 'Fringe'
    | 'Markup'
    | 'Status'
    | 'PayrollTax'
    | 'WComp'
    | 'Planning';
