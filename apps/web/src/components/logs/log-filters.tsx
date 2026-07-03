'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  source?: string
}

interface LogFiltersProps {
  filters: LogFiltersState
  onFiltersChange: (filters: LogFiltersState) => void
}

export function LogFilters({ filters, onFiltersChange }: LogFiltersProps) {
  const update = (patch: Partial<LogFiltersState>) =>
    onFiltersChange({ ...filters, ...patch })

  const clearFilters = () => onFiltersChange({ level: '', search: '', source: '' })

  const hasActive = !!(filters.level || filters.search || filters.source)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="relative w-full flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search logs or metadata..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.level || 'all'}
        onValueChange={(value) => update({ level: value === 'all' ? '' : value })}
      >
        <SelectTrigger className="w-full sm:w-28">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All levels</SelectItem>
          <SelectItem value="debug">Debug</SelectItem>
          <SelectItem value="info">Info</SelectItem>
          <SelectItem value="warn">Warn</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="fatal">Fatal</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.source || 'all'}
        onValueChange={(value) => update({ source: value === 'all' ? '' : value })}
      >
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="console">console.*</SelectItem>
          <SelectItem value="sdk">sdk (explicit)</SelectItem>
        </SelectContent>
      </Select>

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  )
}
