import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from "@quiq/shared/questions";
import { cn } from "@/lib/cn";
import { InlineError } from "./inline-error";

export interface DifficultyPickerProps {
  value: Difficulty;
  error?: string;
  onChange: (difficulty: Difficulty) => void;
}

/** Chọn đúng 1 mức khó (FR-023): nhóm radio, mũi tên đổi lựa chọn như radio gốc. */
export function DifficultyPicker({ value, error, onChange }: DifficultyPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink">
        Mức khó
        <span className="ml-0.5 text-quiq-red" aria-hidden="true">
          *
        </span>
      </legend>
      <div className="flex gap-2">
        {DIFFICULTIES.map((difficulty) => (
          <label
            key={difficulty}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-4 text-sm font-semibold",
              value === difficulty ? "border-brand bg-brand-tint text-brand-dark" : "border-line-strong text-ink",
            )}
          >
            <input
              type="radio"
              name="difficulty"
              value={difficulty}
              checked={value === difficulty}
              onChange={() => onChange(difficulty)}
              className="size-4 accent-brand"
            />
            {DIFFICULTY_LABELS[difficulty]}
          </label>
        ))}
      </div>
      {error ? <InlineError>{error}</InlineError> : null}
    </fieldset>
  );
}
