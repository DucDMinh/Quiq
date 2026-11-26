"use client";

import { IconCheck } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ANSWER_LETTERS, LetterBadge, type AnswerLetter } from "./letter-badge";

// Chữ trắng trên A, B, D; chữ tối trên C (trắng trên hổ phách chỉ 1.79:1).
const TILE_TONE: Record<AnswerLetter, string> = {
  A: "border-answer-a border-b-quiq-rose-lip bg-answer-a text-on-brand",
  B: "border-answer-b border-b-quiq-indigo-lip bg-answer-b text-on-brand",
  C: "border-answer-c border-b-quiq-amber-lip bg-answer-c text-quiq-amber-ink",
  D: "border-answer-d border-b-quiq-green-lip bg-answer-d text-on-brand",
};

export interface AnswerTileProps extends Omit<ComponentProps<"button">, "children"> {
  letter: AnswerLetter;
  selected?: boolean;
  /** Làm mờ ô chưa chọn sau khi chọn (chỉ câu chọn 1 đáp án). */
  dimmed?: boolean;
  children: ReactNode;
}

// Trạng thái chọn có dấu tick và viền trắng, không chỉ đổi màu.
export function AnswerTile({
  letter,
  selected = false,
  dimmed = false,
  className,
  children,
  type = "button",
  ...props
}: AnswerTileProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
      className={cn(
        "relative flex min-h-(--answer-min-height) w-full items-center gap-3.5 rounded-md border-(length:--tile-border-width) border-b-(length:--lip-width-answer) px-4 py-3.5 text-left font-display text-lg font-bold select-none",
        "transition-[transform,filter,opacity,box-shadow] duration-150 ease-fast",
        "enabled:hover:brightness-105 enabled:active:translate-y-0.5 enabled:active:border-b-(length:--lip-width)",
        "disabled:cursor-not-allowed disabled:opacity-[0.48]",
        TILE_TONE[letter],
        selected && "border-x-on-brand border-t-on-brand shadow-selected",
        dimmed && !selected && "opacity-60",
        className,
      )}
      {...props}
    >
      <LetterBadge letter={letter} />
      <span className="min-w-0 flex-1">{children}</span>
      {selected ? (
        <span
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink"
          data-testid="answer-tick"
        >
          <IconCheck size={18} stroke={3} aria-hidden="true" />
          <span className="sr-only">Đã chọn</span>
        </span>
      ) : null}
    </button>
  );
}

export interface AnswerOption {
  id: string;
  label: ReactNode;
}

export interface AnswerTileGroupProps {
  options: readonly AnswerOption[];
  selectedIds: readonly string[];
  onChange: (selectedIds: string[]) => void;
  /** Câu chọn nhiều đáp án: bật chọn/bỏ chọn từng ô và KHÔNG làm mờ ô còn lại (design-spec D-5). */
  multiple?: boolean;
  disabled?: boolean;
  "aria-label": string;
  className?: string;
}

// Tối đa 4 đáp án (A đến D); đáp án dư bị bỏ qua vì hệ màu và chữ cái chỉ có 4 ô.
export function AnswerTileGroup({
  options,
  selectedIds,
  onChange,
  multiple = false,
  disabled,
  className,
  "aria-label": ariaLabel,
}: AnswerTileGroupProps) {
  const dimUnselected = !multiple && selectedIds.length > 0;

  function handleSelect(id: string) {
    if (!multiple) {
      onChange([id]);
      return;
    }
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div role="group" aria-label={ariaLabel} className={cn("grid grid-cols-2 gap-4", className)}>
      {options.slice(0, ANSWER_LETTERS.length).map((option, index) => {
        const letter = ANSWER_LETTERS[index];
        if (!letter) return null;
        const selected = selectedIds.includes(option.id);
        return (
          <AnswerTile
            key={option.id}
            letter={letter}
            selected={selected}
            dimmed={dimUnselected && !selected}
            disabled={disabled}
            onClick={() => handleSelect(option.id)}
          >
            {option.label}
          </AnswerTile>
        );
      })}
    </div>
  );
}
