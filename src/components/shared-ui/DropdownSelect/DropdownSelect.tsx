import * as React from "react"
import { ChevronDown, Search, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./DropdownSelect.module.css"

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
  hidden?: boolean
  meta?: string // optional subtitle/description
}

interface BaseProps {
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  label?: string
  error?: string
  /** Async fetch options on search change */
  onSearch?: (query: string) => void | Promise<void>
  /** Called when dropdown opens */
  onOpen?: () => void
}

// Single select
interface SingleSelectProps extends BaseProps {
  multiple?: false
  value?: string | number | null
  onChange: (value: string | number | null) => void
}

// Multi select
interface MultiSelectProps extends BaseProps {
  multiple: true
  value?: (string | number)[]
  onChange: (value: (string | number)[]) => void
}

type DropdownSelectProps = SingleSelectProps | MultiSelectProps

const DropdownSelect = React.forwardRef<HTMLDivElement, DropdownSelectProps>(
  (props, ref) => {
    const {
      options = [],
      placeholder = "Select...",
      disabled = false,
      loading = false,
      searchable = true,
      searchPlaceholder = "Search...",
      className,
      label,
      error,
      onSearch,
      onOpen,
      multiple,
    } = props

    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const searchRef = React.useRef<HTMLInputElement>(null)

    // Close on outside click
    React.useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
          setSearch("")
        }
      }
      document.addEventListener("mousedown", handler)
      return () => document.removeEventListener("mousedown", handler)
    }, [])

    // Focus search on open
    React.useEffect(() => {
      if (open && searchable) {
        setTimeout(() => searchRef.current?.focus(), 50)
      }
    }, [open, searchable])

    const handleOpen = () => {
      if (disabled) return
      const next = !open
      setOpen(next)
      if (next) {
        onOpen?.()
        setSearch("")
      }
    }

    const handleSearchChange = (val: string) => {
      setSearch(val)
      onSearch?.(val)
    }

    const clearSearch = () => {
      setSearch("")
      onSearch?.("")
      searchRef.current?.focus()
    }

    // Filter visible options
    const filteredOptions = options.filter((o) => {
      if (o.hidden) return false
      if (!search) return true
      return o.label.toLowerCase().includes(search.toLowerCase())
    })

    // Single select helpers
    const singleValue = !multiple ? (props as SingleSelectProps).value : undefined
    const singleOnChange = !multiple ? (props as SingleSelectProps).onChange : undefined

    // Multi select helpers
    const multiValue = multiple ? ((props as MultiSelectProps).value ?? []) : []
    const multiOnChange = multiple ? (props as MultiSelectProps).onChange : undefined

    const isSelected = (val: string | number) => {
      if (multiple) return multiValue.includes(val)
      return singleValue === val
    }

    const handleSelect = (option: SelectOption) => {
      if (option.disabled) return
      if (multiple) {
        const current = multiValue
        const next = current.includes(option.value)
          ? current.filter((v) => v !== option.value)
          : [...current, option.value]
        multiOnChange!(next)
      } else {
        const next = singleValue === option.value ? null : option.value
        singleOnChange!(next)
        setOpen(false)
        setSearch("")
      }
    }

    const clearAll = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (multiple) {
        multiOnChange!([])
      } else {
        singleOnChange!(null)
      }
    }

    const removeTag = (val: string | number, e: React.MouseEvent) => {
      e.stopPropagation()
      if (multiple) {
        multiOnChange!(multiValue.filter((v) => v !== val))
      }
    }

    const getLabelFor = (val: string | number) =>
      options.find((o) => o.value === val)?.label ?? String(val)

    const hasValue = multiple ? multiValue.length > 0 : singleValue != null && singleValue !== ""

    // Render trigger display
    const renderTriggerContent = () => {
      if (!hasValue) {
        return <span className={styles.placeholder}>{placeholder}</span>
      }

      if (multiple) {
        if (multiValue.length <= 2) {
          return (
            <div className={styles.tagList}>
              {multiValue.map((v) => (
                <span key={v} className={styles.tag}>
                  {getLabelFor(v)}
                  <button
                    type="button"
                    className={styles.tagRemove}
                    onClick={(e) => removeTag(v, e)}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )
        }
        return (
          <span className={styles.multiCount}>
            {multiValue.length} selected
          </span>
        )
      }

      return <span className={styles.selectedValue}>{getLabelFor(singleValue!)}</span>
    }

    return (
      <div className={cn(styles.container, className)} ref={containerRef}>
        {label && <label className={styles.label}>{label}</label>}

        {/* Trigger */}
        <button
          type="button"
          className={cn(
            styles.trigger,
            open && styles.triggerOpen,
            error && styles.triggerError,
            disabled && styles.triggerDisabled
          )}
          onClick={handleOpen}
          disabled={disabled}
        >
          <div className={styles.triggerInner}>
            {renderTriggerContent()}
          </div>

          <div className={styles.triggerRight}>
            {hasValue && !disabled && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={clearAll}
                title="Clear"
              >
                <X size={12} />
              </button>
            )}
            <ChevronDown
              className={cn(styles.chevron, open && styles.chevronOpen)}
              size={15}
            />
          </div>
        </button>

        {/* Error */}
        {error && <p className={styles.errorText}>{error}</p>}

        {/* Dropdown */}
        {open && (
          <div className={styles.dropdown} ref={ref}>
            {/* Search */}
            {searchable && (
              <div className={styles.searchBox}>
                <Search className={styles.searchIcon} size={13} />
                <input
                  ref={searchRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    onClick={clearSearch}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Multi-select: select all / clear all */}
            {multiple && filteredOptions.length > 0 && (
              <div className={styles.multiActions}>
                <button
                  type="button"
                  className={styles.multiAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    const allVals = filteredOptions
                      .filter((o) => !o.disabled)
                      .map((o) => o.value)
                    const combined = [...new Set([...multiValue, ...allVals])]
                    multiOnChange!(combined)
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className={styles.multiAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    multiOnChange!([])
                  }}
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Options list */}
            <ul className={styles.optionList} role="listbox">
              {loading && (
                <li className={styles.stateRow}>
                  <span className={styles.loadingDot} />
                  <span className={styles.loadingDot} style={{ animationDelay: "0.15s" }} />
                  <span className={styles.loadingDot} style={{ animationDelay: "0.30s" }} />
                </li>
              )}

              {!loading && filteredOptions.length === 0 && (
                <li className={styles.stateRow}>
                  <span className={styles.noOptions}>
                    {search ? `No results for "${search}"` : "No options available"}
                  </span>
                </li>
              )}

              {!loading && filteredOptions.map((option) => {
                const selected = isSelected(option.value)
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      styles.option,
                      selected && styles.optionSelected,
                      option.disabled && styles.optionDisabled
                    )}
                    onClick={() => handleSelect(option)}
                  >
                    {multiple && (
                      <span className={cn(styles.checkbox, selected && styles.checkboxChecked)}>
                        {selected && <Check size={10} strokeWidth={3} />}
                      </span>
                    )}
                    <span className={styles.optionLabel}>
                      {option.label}
                      {option.meta && <span className={styles.optionMeta}>{option.meta}</span>}
                    </span>
                    {!multiple && selected && (
                      <Check className={styles.optionCheck} size={13} />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }
)

DropdownSelect.displayName = "DropdownSelect"

export { DropdownSelect }
export default DropdownSelect
