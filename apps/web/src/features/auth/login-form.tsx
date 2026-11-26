"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest, type StaffMe } from "@quiq/shared/auth";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Alert, Button, Field, IconButton, Input, type FieldControlProps } from "@/components/ui";
import { postLoginPath } from "@/features/shell/nav-config";
import { api, ApiError } from "@/lib/api-client";

type FormNotice = { tone: "danger" | "info"; message: string };

const NO_AREA_MESSAGE = "Chưa có giao diện cho vai trò này. Vui lòng quay lại sau khi hệ thống cập nhật.";

function throttleMessage(error: ApiError): string {
  const seconds = (error.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
  if (typeof seconds !== "number") return error.message;
  return `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(seconds / 60)} phút.`;
}

function noticeFromError(error: unknown): FormNotice {
  if (!(error instanceof ApiError)) return { tone: "danger", message: "Đã có lỗi xảy ra, vui lòng thử lại sau." };
  // Thông điệp tiếng Việt lấy từ máy chủ (sai thông tin, trường bị khóa, mất mạng...).
  return { tone: "danger", message: error.code === "LOGIN_THROTTLED" ? throttleMessage(error) : error.message };
}

function PasswordInput({ control, registration }: { control: FieldControlProps; registration: UseFormRegisterReturn }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...control} {...registration} type={visible ? "text" : "password"} autoComplete="current-password" className="pr-12" />
      <IconButton
        label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        size="sm"
        variant="subtle"
        className="absolute top-1/2 right-1.5 -translate-y-1/2"
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <IconEyeOff size={18} aria-hidden="true" /> : <IconEye size={18} aria-hidden="true" />}
      </IconButton>
    </div>
  );
}

/** Thẻ đăng nhập cán bộ (design-spec §4.2). Mật khẩu chỉ đi trong body POST, không vào URL hay log. */
export function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema), defaultValues: { username: "", password: "" } });

  const onSubmit = handleSubmit(async (credentials) => {
    setNotice(null);
    try {
      // Sai mật khẩu trả 401 là kết quả bình thường ở đây, không phải "hết phiên".
      const user = await api.post<StaffMe>("/auth/login", credentials, { skipUnauthenticatedEvent: true });
      const target = postLoginPath(user.role, returnTo);
      if (target) {
        router.replace(target);
        return;
      }
      // Vai trò chưa có màn: không để lại phiên treo.
      await api.post("/auth/logout", undefined, { skipUnauthenticatedEvent: true }).catch(() => undefined);
      setNotice({ tone: "info", message: NO_AREA_MESSAGE });
    } catch (error) {
      setNotice(noticeFromError(error));
    }
  });

  // method="post": nếu bấm Enter trước khi JS hydrate, trình duyệt gửi POST thay vì GET (mật khẩu không vào URL).
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-label="Đăng nhập cán bộ">
      <Field label="Tên đăng nhập" required error={errors.username?.message}>
        {(control) => <Input {...control} {...register("username")} autoComplete="username" autoFocus />}
      </Field>
      <Field label="Mật khẩu" required error={errors.password?.message}>
        {(control) => <PasswordInput control={control} registration={register("password")} />}
      </Field>
      {notice ? <Alert tone={notice.tone}>{notice.message}</Alert> : null}
      <Button type="submit" size="lg" loading={isSubmitting} loadingLabel="Đang đăng nhập…">
        Đăng nhập
      </Button>
    </form>
  );
}
