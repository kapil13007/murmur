// File: src/Insights/components/Heatmap.jsx
// Year-long daily activity grid (weeks as columns, Sun..Sat as rows).
import { useLayoutEffect, useRef } from 'react';
import { formatNumber } from '../../utils/formatter';

const COLORS = ['bg-subtle', 'bg-fathom-100', 'bg-fathom-300', 'bg-fathom-600', 'bg-fathom-950'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 'h-[10px] w-[10px] rounded-[3px]';

function level(words, max) {
  if (!words) return 0;
  const ratio = words / (max || 1);
  if (ratio > 0.75) return 4;
  if (ratio > 0.45) return 3;
  if (ratio > 0.15) return 2;
  return 1;
}

const utcDate = (iso) => new Date(`${iso}T00:00:00Z`);

export default function Heatmap({ data }) {
  const scrollRef = useRef(null);
  // On narrow windows, start scrolled to the most recent weeks.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  const days = data.days;
  // Pad the front so the first column starts on a Sunday.
  const cells = [...Array(utcDate(days[0].date).getUTCDay()).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="card p-5">
      <div ref={scrollRef} className="overflow-x-auto">
        <div className="inline-flex gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-[17px] text-[10px] text-faint">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
              <span key={i} className="h-[10px] leading-[10px]">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const first = week.find(Boolean);
            const showMonth = first && utcDate(first.date).getUTCDate() <= 7;
            return (
              <div key={wi} className="flex flex-col gap-[3px]">
                {/* Absolutely positioned so a label never widens its week column. */}
                <span className="relative h-[14px]">
                  {showMonth && (
                    <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-[14px] text-faint">
                      {MONTHS[utcDate(first.date).getUTCMonth()]}
                    </span>
                  )}
                </span>
                {week.map((day, di) =>
                  day ? (
                    <span
                      key={day.date}
                      title={`${formatNumber(day.words)} words on ${utcDate(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`}
                      className={`${CELL} ${COLORS[level(day.words, data.max)]}`}
                    />
                  ) : (
                    <span key={`pad${di}`} className={CELL} />
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        Less
        {COLORS.map((c) => (
          <span key={c} className={`h-[10px] w-[10px] rounded-[3px] ${c}`} />
        ))}
        More
      </div>
    </div>
  );
}
