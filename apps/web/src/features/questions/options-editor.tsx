"use client";

import { QUESTION_OPTION_MAX, QUESTION_OPTION_MIN } from "@quiq/shared/questions";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { ANSWER_LETTERS, Button, IconButton, Input, LetterBadge, type AnswerLetter } from "@/components/ui";
import { InlineError } from "./inline-error";
import type { Draft, DraftOption, FieldErrors } from "./question-draft";

export interface OptionsEditorProps {
  draft: Draft;
  errors: FieldErrors;
  onContentChange: (index: number, content: string) => void;
  onCorrectChange: (index: number, checked: boolean) => void;
  onToggleMultiSelect: (multiSelect: boolean) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** 2 đến 4 đáp án A-D (design-spec D-6); câu một đáp án dùng radio, câu nhiều đáp án dùng checkbox. */
export function OptionsEditor({ draft, errors, onToggleMultiSelect, onAdd, ...handlers }: OptionsEditorProps) {
  const groupError = errors.options;
  const canRemove = draft.options.length > QUESTION_OPTION_MIN;
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={groupError ? "options-error" : undefined}>
      <legend className="text-sm font-semibold text-ink">
        Đáp án (2 đến 4, đánh dấu đáp án đúng)
        <span className="ml-0.5 text-quiq-red" aria-hidden="true">
          *
        </span>
      </legend>
      <div className="flex items-center justify-end">
        <MultiSelectSwitch checked={draft.multiSelect} onChange={onToggleMultiSelect} />
      </div>
      <ul className="flex flex-col gap-2">
        {draft.options.map((option, index) => (
          <OptionRow
            key={option.key}
            option={option}
            index={index}
            letter={ANSWER_LETTERS[index]!}
            multiSelect={draft.multiSelect}
            error={errors[`options.${index}.content`]}
            canRemove={canRemove}
            {...handlers}
          />
        ))}
      </ul>
      {groupError ? <InlineError id="options-error">{groupError}</InlineError> : null}
      <div>
        <Button variant="subtle" size="sm" onClick={onAdd} disabled={draft.options.length >= QUESTION_OPTION_MAX}>
          <IconPlus size={16} aria-hidden="true" />
          Thêm đáp án
        </Button>
      </div>
    </fieldset>
  );
}

function MultiSelectSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-brand"
      />
      Cho phép chọn nhiều đáp án
    </label>
  );
}

interface OptionRowProps {
  option: DraftOption;
  index: number;
  letter: AnswerLetter;
  multiSelect: boolean;
  error: string | undefined;
  canRemove: boolean;
  onContentChange: (index: number, content: string) => void;
  onCorrectChange: (index: number, checked: boolean) => void;
  onRemove: (index: number) => void;
}

function OptionRow({ option, index, letter, multiSelect, error, canRemove, ...handlers }: OptionRowProps) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <LetterBadge letter={letter} className="border border-line" />
        <Input
          aria-label={`Nội dung đáp án ${letter}`}
          aria-invalid={error ? true : undefined}
          value={option.content}
          onChange={(event) => handlers.onContentChange(index, event.target.value)}
        />
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type={multiSelect ? "checkbox" : "radio"}
            name="correct-option"
            aria-label={`Đáp án ${letter} đúng`}
            checked={option.isCorrect}
            onChange={(event) => handlers.onCorrectChange(index, event.target.checked)}
            className="size-5 accent-quiq-green"
          />
          <span aria-hidden="true">Đúng</span>
        </label>
        <IconButton
          label={`Xóa đáp án ${letter}`}
          size="sm"
          variant="secondary"
          disabled={!canRemove}
          onClick={() => handlers.onRemove(index)}
        >
          <IconTrash size={18} aria-hidden="true" />
        </IconButton>
      </div>
      {error ? <InlineError>{error}</InlineError> : null}
    </li>
  );
}
