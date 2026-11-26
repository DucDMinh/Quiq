import "@testing-library/jest-dom/vitest";

// jsdom thiếu API pointer capture mà Radix (Toast, Select, Dialog) gọi khi nhận sự kiện chuột.
// Đặt ở setupFiles để mọi test của các layer sau dùng chung, không phải copy.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;

// Radix Select gọi scrollIntoView khi mở danh sách; jsdom không có.
Element.prototype.scrollIntoView ??= () => undefined;
