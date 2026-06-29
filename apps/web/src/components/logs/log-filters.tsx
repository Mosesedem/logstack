'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'

interface LogFiltersState {
  level: string
  search: string
}

interface LogFiltersProps {
  filters: LogFiltersState
  onFiltersChange: (filters: LogFiltersState) => void
}

export function LogFilters({ filters, onFiltersChange }: LogFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative w-full flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search logs..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9"
        />
      </div>
      <Select
        value={filters.level || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, level: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder="All levels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All levels</SelectItem>
          <SelectItem value="info">Info</SelectItem>
          <SelectItem value="warn">Warning</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
