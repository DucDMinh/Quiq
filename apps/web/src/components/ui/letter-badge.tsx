import { cn } from "@/lib/cn";

export const ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

// Chữ đậm màu của ô đáp án, trên nền trắng 90% (contrast đã đo: 6.29, 7.90, 18.24, 5.02).
const LETTER_COLOR: Record<AnswerLetter, string> = {
  A: "text-quiq-rose",
  B: "text-quiq-indigo",
  C: "text-quiq-amber-ink",
  D: "text-quiq-green",
};

export interface LetterBadgeProps {
  letter: AnswerLetter;
  className?: string;
}

/** Huy hiệu chữ cái 36px trong ô bo tròn; chữ cái giúp phân biệt đáp án không chỉ bằng màu. */
export function LetterBadge({ letter, className }: LetterBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface/90 font-display text-lg font-extrabold",
        LETTER_COLOR[letter],
        className,
      )}
    >
      {letter}
    </span>
  );
}
