import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: {
    key: string;
    label: string;
    options: FilterOption[];
    value?: string;
    onChange: (value: string) => void;
  }[];
  activeFilters?: { key: string; value: string; label: string }[];
  onClearFilter?: (key: string) => void;
  onClearAll?: () => void;
}

export function FilterBar({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  filters = [],
  activeFilters = [],
  onClearFilter,
  onClearAll,
}: FilterBarProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 mono-input"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Select key={filter.key} value={filter.value} onValueChange={(value) => value && filter.onChange(value)}>
            <SelectTrigger className="w-[180px] mono-input">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent className="mono-card">
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-400">Active filters:</span>
          {activeFilters.map((filter) => (
            <Badge key={filter.key} variant="secondary" className="gap-1 mono-badge">
              {filter.label}: {filter.value}
              {onClearFilter && (
                <button
                  onClick={() => onClearFilter(filter.key)}
                  className="ml-1 hover:text-zinc-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="mono-btn-ghost">
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}