"use client";

import { questionInputSchema, type Question } from "@quiq/shared/questions";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, Button, Dialog, DialogClose, DialogContent, Field, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { DifficultyPicker } from "./difficulty-picker";
import { OptionsEditor } from "./options-editor";
import {
  initialDraft,
  shiftErrorsAfterRemoval,
  toFieldErrors,
  toInput,
  withAddedOption,
  withCorrectMark,
  withMultiSelect,
  withOptionContent,
  withoutOption,
  type Draft,
  type FieldErrors,
} from "./question-draft";
import { createQuestion, updateQuestion } from "./use-questions";

const issueListSchema = z.array(z.object({ path: z.string(), message: z.string() }));

export interface QuestionEditorDialogProps {
  open: boolean;
  /** null = thêm câu mới. */
  question: Question | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (question: Question) => void;
}

// Form nằm trong DialogContent nên mỗi lần mở dialog là một lần dựng state mới từ câu đang sửa.
export function QuestionEditorDialog({ open, question, onOpenChange, onSaved }: QuestionEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={question ? "Sửa câu hỏi" : "Thêm câu hỏi"} size="lg">
        <QuestionEditorForm question={question} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

/** Kiểm ở client trước; lỗi 422 của API cũng đổ về cùng bảng lỗi theo trường. */
function useQuestionSubmit(question: Question | null, onSaved: (question: Question) => void) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(draft: Draft) {
    setFormError(null);
    const parsed = questionInputSchema.safeParse(toInput(draft));
    if (!parsed.success) {
      setErrors(
        toFieldErrors(parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))),
      );
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = question ? await updateQuestion(question.id, parsed.data) : await createQuestion(parsed.data);
      onSaved(saved);
    } catch (cause) {
      setSaving(false);
      const details = cause instanceof ApiError ? issueListSchema.safeParse(cause.details) : null;
      if (details?.success && details.data.length > 0) setErrors(toFieldErrors(details.data));
      else setFormError(cause instanceof Error ? cause.message : "Không lưu được câu hỏi, vui lòng thử lại.");
    }
  }

  return { errors, setErrors, formError, saving, submit };
}

function QuestionEditorForm({ question, onSaved }: { question: Question | null; onSaved: (q: Question) => void }) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(question));
  const { errors, setErrors, formError, saving, submit } = useQuestionSubmit(question, onSaved);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(draft);
  };

  const removeOption = (index: number) => {
    setDraft((current) => withoutOption(current, index));
    setErrors((current) => shiftErrorsAfterRemoval(current, index));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <Field label="Nội dung câu hỏi" required error={errors.content}>
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            value={draft.content}
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
          />
        )}
      </Field>
      <OptionsEditor
        draft={draft}
        errors={errors}
        onContentChange={(index, content) => setDraft((current) => withOptionContent(current, index, content))}
        onCorrectChange={(index, checked) => setDraft((current) => withCorrectMark(current, index, checked))}
        onToggleMultiSelect={(multiSelect) => setDraft((current) => withMultiSelect(current, multiSelect))}
        onAdd={() => setDraft(withAddedOption)}
        onRemove={removeOption}
      />
      <DifficultyPicker
        value={draft.difficulty}
        error={errors.difficulty}
        onChange={(difficulty) => setDraft((current) => ({ ...current, difficulty }))}
      />
      <div className="mt-1 flex justify-end gap-3">
        <DialogClose asChild>
          <Button variant="secondary">Hủy</Button>
        </DialogClose>
        <Button type="submit" loading={saving}>
          Lưu câu hỏi
        </Button>
      </div>
    </form>
  );
}
