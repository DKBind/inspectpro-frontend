import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./DateRangePicker.module.css"

interface DateRange {
  from?: Date
  to?: Date
}

interface DateRangePickerProps {
  className?: string
  date?: DateRange
  setDate: (date: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
}

// Lightweight date formatter — avoids a date-fns dependency.
// Outputs e.g. "Mar 16, 2026"
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

// Converts a yyyy-MM-dd string (from <input type="date">) into a local Date
// without the UTC-offset shift that `new Date("yyyy-MM-dd")` produces.
function parseLocalDate(val: string): Date {
  const [year, month, day] = val.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function toInputValue(d: Date | undefined): string {
  if (!d) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function todayInputValue(): string {
  return toInputValue(new Date())
}

export function DateRangePicker({
  className,
  date,
  setDate,
  placeholder = "Pick a date range",
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [fromInput, setFromInput] = React.useState(
    date?.from ? toInputValue(date.from) : ""
  )
  const [toInput, setToInput] = React.useState(
    date?.to ? toInputValue(date.to) : ""
  )
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const today = todayInputValue()

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Sync controlled `date` prop → local input state when it changes externally
  React.useEffect(() => {
    setFromInput(date?.from ? toInputValue(date.from) : "")
    setToInput(date?.to ? toInputValue(date.to) : "")
  }, [date])

  const handleFromChange = (val: string) => {
    setFromInput(val)
    if (!val) {
      setDate(undefined)
      setToInput("")
      return
    }
    const fromDate = parseLocalDate(val)
    const toDate = toInput ? parseLocalDate(toInput) : undefined
    // Reset "to" if it falls before the new "from"
    if (toDate && fromDate > toDate) {
      setToInput("")
      setDate({ from: fromDate, to: undefined })
    } else {
      setDate({ from: fromDate, to: toDate })
    }
  }

  const handleToChange = (val: string) => {
    setToInput(val)
    if (!val) {
      setDate({ from: date?.from, to: undefined })
      return
    }
    const toDate = parseLocalDate(val)
    setDate({ from: date?.from, to: toDate })
    // Auto-close once both ends are picked
    if (date?.from) setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFromInput("")
    setToInput("")
    setDate(undefined)
  }

  const hasValue = !!date?.from

  const displayValue = hasValue
    ? date?.to
      ? `${formatDate(date.from!)} → ${formatDate(date.to)}`
      : formatDate(date.from!)
    : null

  return (
    <div className={cn(styles.wrapper, className)} ref={wrapperRef}>
      {/* Trigger */}
      <button
        type="button"
        className={cn(
          styles.trigger,
          !hasValue && styles.placeholder,
          disabled && styles.disabled
        )}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <CalendarIcon className={styles.calendarIcon} />
        <span className={styles.value}>
          {displayValue ?? (
            <span className={styles.placeholderText}>{placeholder}</span>
          )}
        </span>
        {hasValue && !disabled && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            title="Clear"
          >
            <X size={12} />
          </button>
        )}
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Select Date Range</span>
          </div>

          <div className={styles.inputs}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>From</label>
              <input
                type="date"
                className={styles.dateInput}
                value={fromInput}
                max={today}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </div>

            <div className={styles.inputSep}>→</div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>To</label>
              <input
                type="date"
                className={styles.dateInput}
                value={toInput}
                min={fromInput || undefined}
                max={today}
                onChange={(e) => handleToChange(e.target.value)}
                disabled={!fromInput}
              />
            </div>
          </div>

          <div className={styles.dropdownFooter}>
            <button
              type="button"
              className={styles.clearAllBtn}
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className={styles.applyBtn}
              onClick={() => setOpen(false)}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangePicker
