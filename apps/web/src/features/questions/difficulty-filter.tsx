import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from "@quiq/shared/questions";
import { cn } from "@/lib/cn";

const PILLS: ReadonlyArray<{ value: Difficulty | undefined; label: string }> = [
  { value: undefined, label: "Tất cả" },
  ...DIFFICULTIES.map((difficulty) => ({ value: difficulty, label: DIFFICULTY_LABELS[difficulty] })),
];

export interface DifficultyFilterProps {
  value: Difficulty | undefined;
  onChange: (next: Difficulty | undefined) => void;
}

/** Lọc pill theo mức khó; trạng thái chọn đọc qua `aria-pressed`, không chỉ bằng màu. */
export function DifficultyFilter({ value, onChange }: DifficultyFilterProps) {
  return (
    <div role="group" aria-label="Lọc theo mức khó" className="flex gap-2">
      {PILLS.map((pill) => {
        const active = pill.value === value;
        return (
          <button
            key={pill.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(pill.value)}
            className={cn(
              "min-h-11 rounded-full border px-5 text-sm font-bold transition-colors duration-150 ease-fast",
              active ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink hover:bg-subtle",
            )}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
