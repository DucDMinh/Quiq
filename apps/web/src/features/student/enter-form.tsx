"use client";

import { normalizeExamCode, normalizeStudentCode } from "@quiq/shared/student";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { examPath, studentApi, toApiError } from "./student-api";

export interface EnterFormProps {
  /** Mở bằng link /thi/[mã]: ô mã bài thi đã điền và khóa. */
  initialExamCode?: string;
}

interface FieldErrors {
  examCode?: string;
  studentCode?: string;
}

function validate(examCode: string, studentCode: string): FieldErrors {
  return {
    examCode: normalizeExamCode(examCode)
      ? undefined
      : "Hãy nhập mã bài thi hoặc dán đường dẫn bài thi.",
    studentCode: normalizeStudentCode(studentCode) ? undefined : "Hãy nhập mã học sinh/sinh viên.",
  };
}

/** Trạng thái và lệnh gửi của form vào thi; thành công thì sang phòng chờ theo mã chuẩn của máy chủ. */
function useEnterForm(initialExamCode: string | undefined) {
  const router = useRouter();
  const [examCode, setExamCode] = useState(initialExamCode ?? "");
  const [studentCode, setStudentCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(examCode, studentCode);
    setFieldErrors(errors);
    setFormError(null);
    if (errors.examCode || errors.studentCode) return;

    setSubmitting(true);
    try {
      const entered = await studentApi.enter({ examCode, studentCode });
      router.push(examPath(entered.examCode, "phong-cho"));
    } catch (cause) {
      setFormError(toApiError(cause).message);
      setSubmitting(false);
    }
  }

  return {
    examCode,
    setExamCode,
    studentCode,
    setStudentCode,
    fieldErrors,
    formError,
    submitting,
    handleSubmit,
  };
}

interface CodeFieldProps {
  label: string;
  value: string;
  error?: string;
  readOnly?: boolean;
  autoFocus: boolean;
  onChange: (value: string) => void;
}

function CodeField({ label, value, error, readOnly, autoFocus, onChange }: CodeFieldProps) {
  return (
    <Field label={label} required error={error}>
      {(control) => (
        <Input
          {...control}
          value={value}
          readOnly={readOnly}
          autoFocus={autoFocus}
          autoComplete="off"
          className="font-mono uppercase"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/** Vào thi (design-spec §4.1, FR-040): mã bài thi + mã học sinh, Enter để gửi. */
export function EnterForm({ initialExamCode }: EnterFormProps) {
  const locked = Boolean(initialExamCode);
  const form = useEnterForm(initialExamCode);
  return (
    <Card className="flex flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-ink">Vào thi</h1>
        <p className="mt-1 text-base text-ink-secondary">
          Nhập mã bài thi giáo viên đưa và mã học sinh của bạn.
        </p>
      </div>
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit} noValidate>
        <CodeField
          label="Mã bài thi hoặc đường dẫn"
          value={form.examCode}
          error={form.fieldErrors.examCode}
          readOnly={locked}
          autoFocus={!locked}
          onChange={form.setExamCode}
        />
        <CodeField
          label="Mã học sinh/sinh viên"
          value={form.studentCode}
          error={form.fieldErrors.studentCode}
          autoFocus={locked}
          onChange={form.setStudentCode}
        />
        {form.formError ? <Alert tone="danger">{form.formError}</Alert> : null}
        <Button
          type="submit"
          size="lg"
          loading={form.submitting}
          loadingLabel="Đang kiểm tra…"
          className="self-start"
        >
          Vào phòng chờ
        </Button>
      </form>
    </Card>
  );
}
