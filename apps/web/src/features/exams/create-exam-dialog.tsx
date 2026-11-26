"use client";

import {
  createExamBodySchema,
  DIFFICULTY_LABELS,
  DIFFICULTY_LEVELS,
  insufficientQuestionsMessage,
  type BankCounts,
  type DifficultyLevel,
  type ExamListItem,
} from "@quiq/shared/exams";
import { useState, type FormEvent } from "react";
import { Alert, Button, Dialog, DialogClose, DialogContent, Field, Input, Skeleton } from "@/components/ui";
import { examsApi, toApiError, useCreateExamOptions } from "./use-exams";

type NumberField = "durationMinutes" | "total" | DifficultyLevel;
type FieldErrors = Partial<Record<NumberField | "title" | "classIds", string>>;

interface FormState {
  title: string;
  numbers: Record<NumberField, string>;
  classIds: string[];
}

const EMPTY_FORM: FormState = {
  title: "",
  numbers: { durationMinutes: "15", total: "", easy: "", medium: "", hard: "" },
  classIds: [],
};

const FORM_ID = "create-exam-form";

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

function buildBody(form: FormState) {
  return {
    title: form.title,
    durationMinutes: toNumber(form.numbers.durationMinutes),
    drawConfig: {
      total: toNumber(form.numbers.total),
      easy: toNumber(form.numbers.easy),
      medium: toNumber(form.numbers.medium),
      hard: toNumber(form.numbers.hard),
    },
    classIds: form.classIds,
  };
}

/** Lỗi tại chỗ: thiếu câu theo số câu hiện có, rồi lỗi kiểm dữ liệu dùng chung với API. */
function validate(form: FormState, bankCounts: BankCounts | null): FieldErrors {
  const errors: FieldErrors = {};
  const parsed = createExamBodySchema.safeParse(buildBody(form));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.at(-1);
      const field = (key === "drawConfig" ? "total" : key) as keyof FieldErrors;
      errors[field] ??= issue.message;
    }
  }
  for (const level of DIFFICULTY_LEVELS) {
    const need = toNumber(form.numbers[level]);
    if (bankCounts && need > bankCounts[level]) {
      errors[level] = insufficientQuestionsMessage(level, bankCounts[level], need);
    }
  }
  return errors;
}

export interface CreateExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (exam: ExamListItem) => void;
}

export function CreateExamDialog({ open, onOpenChange, onCreated }: CreateExamDialogProps) {
  const { classes, bankCounts, error: loadError } = useCreateExamOptions(open);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setNumber = (field: NumberField, value: string) =>
    setForm((prev) => ({ ...prev, numbers: { ...prev.numbers, [field]: value } }));
  const toggleClass = (classId: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      classIds: checked ? [...prev.classIds, classId] : prev.classIds.filter((id) => id !== classId),
    }));

  const changeOpen = (next: boolean) => {
    if (!next) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form, bankCounts);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      const exam = await examsApi.create(buildBody(form));
      onCreated(exam);
      changeOpen(false);
    } catch (cause) {
      const apiError = toApiError(cause);
      const details = apiError.details as { difficulty?: DifficultyLevel } | undefined;
      if (apiError.code === "INSUFFICIENT_QUESTIONS" && details?.difficulty) {
        setErrors({ [details.difficulty]: apiError.message });
      } else {
        setSubmitError(apiError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <DialogClose asChild>
        <Button variant="secondary">Hủy</Button>
      </DialogClose>
      <Button type="submit" form={FORM_ID} loading={submitting} loadingLabel="Đang tạo…">
        Tạo bài thi
      </Button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent title="Tạo bài thi" size="lg" footer={footer}>
        {loadError ? <Alert tone="danger">{loadError.message}</Alert> : null}
        <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-5">
          {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
          <div className="grid grid-cols-[1fr_12rem] gap-4">
            <Field label="Tên bài thi" required error={errors.title}>
              {(control) => (
                <Input
                  {...control}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              )}
            </Field>
            <NumberInput
              label="Thời gian (phút)"
              value={form.numbers.durationMinutes}
              error={errors.durationMinutes}
              onChange={(value) => setNumber("durationMinutes", value)}
            />
          </div>
          <DrawConfigFields form={form} errors={errors} bankCounts={bankCounts} setNumber={setNumber} />
          <ClassPicker
            classes={classes}
            selected={form.classIds}
            error={errors.classIds}
            onToggle={toggleClass}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface NumberInputProps {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}

function NumberInput({ label, value, error, hint, onChange }: NumberInputProps) {
  return (
    <Field label={label} required hint={hint} error={error}>
      {(control) => (
        <Input
          {...control}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

interface DrawConfigFieldsProps {
  form: FormState;
  errors: FieldErrors;
  bankCounts: BankCounts | null;
  setNumber: (field: NumberField, value: string) => void;
}

function DrawConfigFields({ form, errors, bankCounts, setNumber }: DrawConfigFieldsProps) {
  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <NumberInput
        label="Tổng số câu"
        value={form.numbers.total}
        error={errors.total}
        hint="Bằng Dễ + Trung bình + Khó"
        onChange={(value) => setNumber("total", value)}
      />
      {DIFFICULTY_LEVELS.map((level) => (
        <NumberInput
          key={level}
          label={`Số câu ${DIFFICULTY_LABELS[level]}`}
          value={form.numbers[level]}
          error={errors[level]}
          hint={bankCounts ? `Hiện có ${bankCounts[level]} câu` : "Đang đếm câu hiện có…"}
          onChange={(value) => setNumber(level, value)}
        />
      ))}
    </div>
  );
}

interface ClassPickerProps {
  classes: { classId: string; className: string; academicYearName: string }[] | null;
  selected: string[];
  error?: string;
  onToggle: (classId: string, checked: boolean) => void;
}

function ClassPicker({ classes, selected, error, onToggle }: ClassPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-ink">
        Lớp được gán<span className="ml-0.5 text-quiq-red" aria-hidden="true">*</span>
      </legend>
      {classes === null ? (
        <Skeleton className="h-11 w-full" />
      ) : classes.length === 0 ? (
        <p className="text-sm text-ink-muted">Bạn chưa được phân công lớp nào trong năm học hiện tại.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {classes.map((item) => (
            <label
              key={item.classId}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line px-3"
            >
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={selected.includes(item.classId)}
                onChange={(e) => onToggle(item.classId, e.target.checked)}
              />
              <span>
                {item.className} <span className="text-sm text-ink-muted">({item.academicYearName})</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
