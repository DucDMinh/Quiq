"use client";

import { normalizeStudentCode } from "@quiq/shared/student";
import { useState } from "react";
import { Alert, Button, Card, Skeleton } from "@/components/ui";
import { LookupForm, type LookupFormErrors } from "./lookup-form";
import { ScoreTable, ScoreTableSkeleton } from "./score-table";
import { useSchools, useScoreLookup, useYears, type LookupState } from "./use-lookup";

function throttledMessage(retryAfter: number | null): string {
  const wait = retryAfter ? `sau ${retryAfter} giây` : "sau ít phút";
  return `Bạn đã tra cứu quá nhiều lần. Hãy thử lại ${wait}.`;
}

/** Lỗi đặt gần chỗ lỗi + nút "Thử lại" cao 44px (trang dùng được trên màn cảm ứng). */
function RetryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const action = (
    <Button size="sm" variant="secondary" className="min-h-11" onClick={onRetry}>
      Thử lại
    </Button>
  );
  return (
    <Alert tone="danger" action={action}>
      {message}
    </Alert>
  );
}

function LookupResults({ state, onRetry }: { state: LookupState; onRetry: () => void }) {
  switch (state.status) {
    case "idle":
      return null;
    case "loading":
      return <ScoreTableSkeleton />;
    case "done":
      return <ScoreTable items={state.items} />;
    case "throttled":
      return <Alert tone="warning">{throttledMessage(state.retryAfter)}</Alert>;
    case "error":
      return <RetryError message={state.message} onRetry={onRetry} />;
  }
}

function FormSkeleton() {
  return (
    <Card className="flex flex-col gap-4 p-6" aria-busy="true">
      <span className="sr-only">Đang tải danh sách trường…</span>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-40" />
    </Card>
  );
}

function LookupHeading() {
  return (
    <div>
      {/* Co giãn từ 24px (màn 375) tới 30px (màn rộng) vì trang này dùng được trên điện thoại. */}
      <h1 className="font-display text-[clamp(1.5rem,1.2rem+1.5vw,1.875rem)] font-extrabold text-ink">
        Tra cứu điểm
      </h1>
      <p className="mt-1 text-base text-ink-secondary">
        Chọn trường, nhập mã học sinh và năm học để xem điểm các bài thi đã công bố.
      </p>
    </div>
  );
}

/** Tra cứu điểm công khai (FR-064, design-spec §4.3): chọn trường, nhập mã, chọn năm học. */
export function LookupPage() {
  return (
    <>
      <LookupHeading />
      <LookupPanel />
    </>
  );
}

function validateLookup(schoolId: string | null, code: string): LookupFormErrors {
  return {
    school: schoolId ? undefined : "Hãy chọn trường.",
    studentCode: code ? undefined : "Hãy nhập mã học sinh.",
  };
}

function LookupPanel() {
  const schools = useSchools();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [errors, setErrors] = useState<LookupFormErrors>({});
  const years = useYears(schoolId);
  const lookup = useScoreLookup();

  // Đổi bất kỳ ô nào thì bỏ bảng cũ: không để điểm của lựa chọn trước nằm dưới lựa chọn mới.
  function changed<T>(apply: (value: T) => void) {
    return (value: T) => {
      apply(value);
      lookup.reset();
    };
  }

  function submit() {
    const code = normalizeStudentCode(studentCode);
    setErrors(validateLookup(schoolId, code));
    if (!schoolId || !code) return;
    void lookup.run({ schoolId, studentCode: code, academicYearId: years.yearId ?? undefined });
  }

  if (schools.state.status === "loading") return <FormSkeleton />;
  if (schools.state.status === "error") {
    return <RetryError message={schools.state.message} onRetry={schools.reload} />;
  }
  return (
    <>
      <LookupForm
        schools={schools.state.data}
        schoolId={schoolId}
        onSchoolChange={changed(setSchoolId)}
        studentCode={studentCode}
        onStudentCodeChange={changed(setStudentCode)}
        year={{
          years: years.years,
          yearId: years.yearId,
          status: years.status,
          onChange: changed(years.setYearId),
          onRetry: years.reload,
        }}
        errors={errors}
        submitting={lookup.state.status === "loading"}
        onSubmit={submit}
      />
      <LookupResults state={lookup.state} onRetry={lookup.retry} />
    </>
  );
}
