# DataTable Migration Guide

This guide details the pattern for migrating existing list pages (e.g., `/employees`, `/schedules`, `/estimates`, `/tasks`, `/catalogue`) to use the unified `<DataTable>` component.

## 1. Import `DataTable` and `ColumnDef`

```tsx
import { DataTable, ColumnDef } from '@/components/data-table/DataTable';
```

## 2. Define Columns Array

Extract the `TableHead` and `TableCell` logic into a structured `columns` array. 

**Before:**
```tsx
<TableHead className="w-[200px]">Name</TableHead>
...
<TableCell>
    <span className="line-clamp-2">{client.name}</span>
</TableCell>
```

**After:**
```tsx
const columns: ColumnDef<Client>[] = [
    {
        key: 'name',
        header: 'Name',
        width: '200px', // Applies inline style width to TableHead
        cell: (client) => <span className="line-clamp-2">{client.name}</span>
    },
    // ...
];
```
*(Note: If actions require components from the parent scope like `openEditModal` or `can()`, define the `columns` array inside the functional component).*

## 3. Extract Mobile Card Component

Extract the mobile card view logic from the old mapped block into a `mobileCard` render prop.

**Before:**
```tsx
<div className="md:hidden grid grid-cols-2 gap-2 pb-8">
    {clients.map(client => (
        <div key={client._id} className="...">
            ...
        </div>
    ))}
</div>
```

**After:**
```tsx
const mobileCard = (client: Client) => (
    <div className="..." onClick={() => router.push(`/clients/${client._id}`)}>
        ...
    </div>
);
```

## 4. Extract Toolbar (Optional)

Wrap the existing top `Header`, `SearchInput`, actions, and any `BadgeTabs` into a `toolbar` fragment. The `<DataTable>` will inject this seamlessly above the scrollable table view.

```tsx
const toolbar = (
    <>
        <Header rightContent={<SearchInput ... />} />
        <div className="hidden lg:flex justify-center mb-2 px-4">
            <BadgeTabs tabs={tabs} />
        </div>
    </>
);
```

## 5. Implement `<DataTable>`

Replace the massive conditional skeleton/mobile/desktop UI blocks with the `<DataTable>` component.

```tsx
<div className="h-full w-full flex flex-col">
    <DataTable
        columns={columns}
        data={filteredClients}
        isLoading={loading}
        isLoadingMore={isValidating && !loading}
        hasMore={hasMore}
        onLoadMore={() => setSize(size + 1)}
        emptyState={{ 
            icon: <Building2 className="w-12 h-12" />, 
            title: 'No clients found', 
            description: 'Get started by adding a new client.' 
        }}
        onRowClick={(client) => router.push(`/clients/${client._id}`)}
        toolbar={toolbar}
        mobileCard={mobileCard}
    />
</div>
```

This drastically reduces boilerplate, standardizes the loading Skeletons, unifies the `IntersectionObserver` logic for infinite scrolls, and enforces uniform table layouts across all modules.
