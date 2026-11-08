"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth, type YearMonth } from "@/domain/attendance";
import { formatYearMonth } from "@/shared/format";

export function MonthSwitcher({
  month,
  onChange,
  headingId,
  suffix,
}: {
  month: YearMonth;
  onChange: (month: YearMonth) => void;
  headingId: string;
  suffix: string;
}) {
  return (
    <div className="month-switcher">
      <button
        type="button"
        className="icon-button"
        aria-label="前月"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft size={16} />
      </button>
      <h2 id={headingId} className="num">
        {formatYearMonth(month)}
        {suffix}
      </h2>
      <button
        type="button"
        className="icon-button"
        aria-label="翌月"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
