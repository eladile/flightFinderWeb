import { useState, useMemo, type CSSProperties } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { StreamState } from '../api/useSearchStream';
import { parsePrice, parseDuration, flightKey } from '../lib/flightUtils';

type Props = {
  state: StreamState;
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  onSetAll?: (keys: string[]) => void;
  onRemoveMany?: (keys: string[]) => void;
};

type FlightWithJobId = StreamState['flights'][0];

const columnHelper = createColumnHelper<FlightWithJobId>();

function createColumns(hasSelection: boolean, hasMasterCheckbox: boolean) {
  const cols = [];

  if (hasSelection) {
    cols.push(
      columnHelper.display({
        id: 'select',
        header: hasMasterCheckbox
          ? ({ table }) => {
              const allKeys = table
                .getFilteredRowModel()
                .rows.map((r) => flightKey(r.original));
              const meta = table.options.meta as
                | { selected?: Set<string>; setAll?: (keys: string[]) => void; removeMany?: (keys: string[]) => void }
                | undefined;
              const selected = meta?.selected ?? new Set();
              const selectedCount = allKeys.filter((k) => selected.has(k)).length;
              const checked = selectedCount === allKeys.length && allKeys.length > 0;
              const indeterminate = selectedCount > 0 && selectedCount < allKeys.length;

              return (
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = indeterminate;
                  }}
                  checked={checked}
                  onChange={() => {
                    if (checked || indeterminate) {
                      meta?.removeMany?.(allKeys);
                    } else {
                      const existingKeys = Array.from(selected);
                      const newKeys = allKeys.filter((k) => !selected.has(k));
                      meta?.setAll?.([...existingKeys, ...newKeys]);
                    }
                  }}
                  className="h-4 w-4"
                />
              );
            }
          : '',
        cell: () => null,
        enableSorting: false,
      })
    );
  }

  cols.push(columnHelper.accessor('destination', {
    header: 'Destination',
    cell: (info) => <span className="font-mono font-semibold">{info.getValue()}</span>,
    filterFn: 'arrIncludesSome',
  }),
  columnHelper.accessor(
    (row) => (row.returnDate ? `${row.date} ↔ ${row.returnDate}` : row.date),
    {
      id: 'dates',
      header: 'Dates',
      cell: (info) => <span className="whitespace-nowrap text-sm">{info.getValue()}</span>,
    }
  ),
  columnHelper.accessor('airline', {
    header: 'Airline',
    cell: (info) => {
      const value = info.getValue();
      return (
        <span className="block truncate" title={value}>
          {value}
        </span>
      );
    },
    filterFn: 'arrIncludesSome',
  }),
  columnHelper.accessor((row) => `${row.departureTime} → ${row.arrivalTime}`, {
    id: 'times',
    header: 'Dep → Arr',
    cell: (info) => <span className="whitespace-nowrap text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('duration', {
    header: 'Duration',
    cell: (info) => <span className="whitespace-nowrap text-sm">{info.getValue()}</span>,
    sortingFn: (rowA, rowB) => {
      const a = parseDuration(rowA.original.duration);
      const b = parseDuration(rowB.original.duration);
      return a - b;
    },
  }),
  columnHelper.accessor('stops', {
    header: 'Stops',
    cell: (info) => <span className="text-sm">{info.getValue()}</span>,
    filterFn: (row, _columnId, filterValue: string) => {
      const stops = row.original.stops.toLowerCase();
      if (filterValue === 'nonstop') return stops.includes('nonstop') || stops === '0';
      if (filterValue === '<=1')
        return stops.includes('nonstop') || stops === '0' || stops === '1' || stops.includes('1 stop');
      return true;
    },
  }),
  columnHelper.accessor('price', {
    header: 'Price',
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
    sortingFn: (rowA, rowB) => {
      const a = parsePrice(rowA.original.price);
      const b = parsePrice(rowB.original.price);
      return a - b;
    },
  }),
  columnHelper.accessor('source', {
    header: 'Source',
    cell: (info) => {
      const val = info.getValue();
      const color = val === 'google' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
      return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{val}</span>;
    },
  }),
  columnHelper.accessor('link', {
    header: 'Link',
    cell: (info) => {
      const link = info.getValue();
      if (!link) return null;
      return (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          title="Open flight"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      );
    },
    enableSorting: false,
  }));

  return cols;
}

export default function FlightsTable({ state, selected, onToggle, onSetAll, onRemoveMany }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'price', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const hasSelection = Boolean(selected && onToggle);
  const hasMasterCheckbox = Boolean(selected && onToggle && onSetAll && onRemoveMany);
  const columns = useMemo(() => createColumns(hasSelection, hasMasterCheckbox), [hasSelection, hasMasterCheckbox]);

  // Google Flights returns near-duplicate rows; collapse by booking link so
  // the user sees one checkbox per distinct booking. Flights without a link
  // (e.g., skyscanner deep-link entries) always pass through.
  const dedupedFlights = useMemo(() => {
    const seen = new Set<string>();
    return state.flights.filter((f) => {
      if (!f.link) return true;
      if (seen.has(f.link)) return false;
      seen.add(f.link);
      return true;
    });
  }, [state.flights]);

  const table = useReactTable({
    data: dedupedFlights,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      selected,
      setAll: onSetAll,
      removeMany: onRemoveMany,
    },
  });

  const uniqueDestinations = useMemo(
    () => Array.from(new Set(dedupedFlights.map((f) => f.destination))).sort(),
    [dedupedFlights]
  );
  const uniqueAirlines = useMemo(
    () => Array.from(new Set(dedupedFlights.map((f) => f.airline))).sort(),
    [dedupedFlights]
  );

  if (dedupedFlights.length === 0) return null;

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-4 rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        {expanded ? '▼ Hide all flights' : `▶ Show all ${dedupedFlights.length} flights`}
      </button>

      {expanded && (
        <div className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search flights..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                {selected && <col style={{ width: 40 }} />}
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const columnId = header.column.id;
                      const currentFilter = columnFilters.find((f) => f.id === columnId);

                      const filterWrapStyle: CSSProperties =
                        columnId === 'destination' || columnId === 'airline'
                          ? { width: 160, maxWidth: 160 }
                          : columnId === 'stops'
                          ? { width: 130, maxWidth: 130 }
                          : {};
                      return (
                        <th key={header.id} className="px-4 py-3 align-top font-semibold text-gray-700" style={filterWrapStyle}>
                          <div className="flex flex-col gap-2">
                            <div
                              className={canSort ? 'cursor-pointer select-none hover:text-blue-600' : ''}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {canSort && (
                                <span className="ml-1">
                                  {{
                                    asc: '↑',
                                    desc: '↓',
                                  }[header.column.getIsSorted() as string] ?? '↕'}
                                </span>
                              )}
                            </div>

                            {columnId === 'destination' && (
                              <select
                                value={(currentFilter?.value as string[]) || []}
                                onChange={(e) => {
                                  const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                                  header.column.setFilterValue(opts.length ? opts : undefined);
                                }}
                                multiple
                                size={4}
                                className="block w-full rounded border border-gray-300 px-2 py-1 text-xs"
                              >
                                {uniqueDestinations.map((dest) => (
                                  <option key={dest} value={dest}>
                                    {dest}
                                  </option>
                                ))}
                              </select>
                            )}

                            {columnId === 'airline' && (
                              <select
                                value={(currentFilter?.value as string[]) || []}
                                onChange={(e) => {
                                  const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                                  header.column.setFilterValue(opts.length ? opts : undefined);
                                }}
                                multiple
                                size={4}
                                className="block w-full rounded border border-gray-300 px-2 py-1 text-xs"
                              >
                                {uniqueAirlines.map((airline) => (
                                  <option key={airline} value={airline} title={airline}>
                                    {airline.length > 22 ? airline.slice(0, 20) + '…' : airline}
                                  </option>
                                ))}
                              </select>
                            )}

                            {columnId === 'stops' && (
                              <select
                                value={(currentFilter?.value as string) || 'any'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  header.column.setFilterValue(val === 'any' ? undefined : val);
                                }}
                                className="w-full max-w-[150px] rounded border border-gray-300 px-2 py-1 text-xs"
                              >
                                <option value="any">Any</option>
                                <option value="nonstop">Nonstop only</option>
                                <option value="<=1">≤ 1 stop</option>
                              </select>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, idx) => {
                  const flight = row.original;
                  const hasReturn = flight.returnDeparture && flight.returnArrival;
                  const isExpanded = expandedRows.has(idx);

                  return (
                    <>
                      <tr
                        key={row.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          hasReturn ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => {
                          if (hasReturn) {
                            setExpandedRows((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              return next;
                            });
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => {
                          if (cell.column.id === 'select' && hasSelection) {
                            const key = flightKey(flight);
                            const isChecked = selected?.has(key) ?? false;
                            return (
                              <td key={cell.id} className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onToggle?.(key);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-4 w-4"
                                />
                              </td>
                            );
                          }
                          return (
                            <td key={cell.id} className="overflow-hidden px-4 py-3 align-top">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                      {hasReturn && isExpanded && (
                        <tr key={`${row.id}-return`} className="border-b border-gray-100 bg-blue-50">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="text-xs text-gray-700">
                              <span className="font-semibold">Return: </span>
                              {flight.returnAirline && `${flight.returnAirline} · `}
                              {flight.returnDeparture} → {flight.returnArrival}
                              {flight.returnDuration && ` · ${flight.returnDuration}`}
                              {flight.returnStops && ` · ${flight.returnStops}`}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
