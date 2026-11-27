"use client";

import type { LookupSchool, LookupYear } from "@quiq/shared/lookup";
import type { FormEvent } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { SchoolPicker } from "./school-picker";
import type { YearsStatus } from "./use-lookup";

// Token --control-height-md là 42px; trang tra cứu dùng được trên màn cảm ứng nên nâng lên 44px.
const TOUCH_TARGET = "min-h-11";

export interface LookupFormErrors {
  school?: string;
  studentCode?: string;
}

export interface YearFieldProps {
  years: readonly LookupYear[];
  yearId: string | null;
  status: YearsStatus;
  onChange: (yearId: string) => void;
  onRetry: () => void;
}

const YEAR_PLACEHOLDER: Record<YearsStatus, string> = {
  idle: "Chọn trường trước",
  loading: "Đang tải năm học…",
  error: "Không tải được năm học",
  ready: "Chưa có năm học",
};

function YearField({ years, yearId, status, onChange, onRetry }: YearFieldProps) {
  const options = years.map((year) => ({
    value: year.id,
    label: year.isCurrent ? `${year.name} (hiện tại)` : year.name,
  }));
  const error = status === "error" ? "Không tải được danh sách năm học." : undefined;
  return (
    <Field label="Năm học" error={error}>
      {(control) => (
        <div className="flex flex-col gap-2">
          <Select
            id={control.id}
            aria-describedby={control["aria-describedby"]}
            aria-invalid={control["aria-invalid"]}
            className={TOUCH_TARGET}
            options={options}
            // Chuỗi rỗng ở Root (không phải ở Item) đưa Radix về placeholder mà vẫn là controlled.
            value={yearId ?? ""}
            onValueChange={onChange}
            placeholder={YEAR_PLACEHOLDER[status]}
            disabled={options.length === 0}
          />
          {status === "error" ? (
            <Button variant="secondary" className={`${TOUCH_TARGET} self-start`} onClick={onRetry}>
              Tải lại năm học
            </Button>
          ) : null}
        </div>
      )}
    </Field>
  );
}

export interface LookupFormProps {
  schools: readonly LookupSchool[];
  schoolId: string | null;
  onSchoolChange: (schoolId: string) => void;
  studentCode: string;
  onStudentCodeChange: (value: string) => void;
  year: YearFieldProps;
  errors: LookupFormErrors;
  submitting: boolean;
  onSubmit: () => void;
}

/** Thẻ lọc 3 ô một hàng (từ 1024px) + nút "Tra cứu"; màn hẹp xếp dọc (design-spec §4.3 + §1 ngoại lệ). */
export function LookupForm(props: LookupFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onSubmit();
  }
  return (
    <Card className="p-6">
      <form
        noValidate
        onSubmit={handleSubmit}
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <Field label="Trường" required error={props.errors.school}>
          {(control) => (
            <SchoolPicker control={control} schools={props.schools} value={props.schoolId} onChange={props.onSchoolChange} />
          )}
        </Field>
        <Field label="Mã học sinh" required error={props.errors.studentCode}>
          {(control) => (
            <Input
              {...control}
              value={props.studentCode}
              autoComplete="off"
              className={`${TOUCH_TARGET} font-mono uppercase`}
              onChange={(event) => props.onStudentCodeChange(event.target.value)}
            />
          )}
        </Field>
        <YearField {...props.year} />
        <Button type="submit" loading={props.submitting} loadingLabel="Đang tra cứu…" className={`${TOUCH_TARGET} lg:mt-[1.625rem]`}>
          Tra cứu
        </Button>
      </form>
    </Card>
  );
}
