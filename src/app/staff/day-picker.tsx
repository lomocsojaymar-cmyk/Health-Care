"use client";

import Link from "next/link";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DayPicker({ date }: { date: string }) {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d, 12);
  // Show the 7 days centred on the selected date.
  const days = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + i - 3);
    return dt;
  });
  return (
    <div className="date-strip" style={{ marginBottom: 20 }}>
      {days.map((dt) => {
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        return (
          <Link
            key={key}
            href={`/staff?date=${key}`}
            className={`date-chip ${key === date ? "selected" : ""}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="dow">{DOW[dt.getDay()]}</span>
            <span className="dom">{dt.getDate()}</span>
            <span className="avail" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}
