"use client";

import type { LookupSchool } from "@quiq/shared/lookup";
import { IconSearch } from "@tabler/icons-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Input, type FieldControlProps } from "@/components/ui";
import { cn } from "@/lib/cn";
import { foldForSearch } from "./lookup-api";

function matchSchools(schools: readonly LookupSchool[], query: string): readonly LookupSchool[] {
  const needle = foldForSearch(query);
  if (!needle) return schools;
  return schools.filter((school) => foldForSearch(school.name).includes(needle));
}

/** Trạng thái combobox: chuỗi tìm, mở/đóng, mục đang trỏ; phím mũi tên/Enter/Escape. */
function useSchoolCombobox(schools: readonly LookupSchool[], onChange: (schoolId: string) => void) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = open ? matchSchools(schools, query) : [];
  const lastIndex = Math.max(matches.length - 1, 0);
  const activeIndex = Math.min(active, lastIndex);

  function choose(school: LookupSchool) {
    onChange(school.id);
    setOpen(false);
    setQuery("");
  }
  function openWith(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    setActive(0);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(Math.min(Math.max(activeIndex + step, 0), lastIndex));
    } else if (event.key === "Enter" && open) {
      // Enter khi danh sách đang mở là chọn trường, không gửi form.
      event.preventDefault();
      const school = matches[activeIndex];
      if (school) choose(school);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }
  return { query, open, close: () => setOpen(false), openWith, matches, activeIndex, choose, handleKeyDown };
}

interface SchoolOptionsProps {
  listId: string;
  open: boolean;
  matches: readonly LookupSchool[];
  activeIndex: number;
  selectedId: string | null;
  optionId: (index: number) => string;
  onChoose: (school: LookupSchool) => void;
}

function SchoolOptions({ listId, open, matches, activeIndex, selectedId, optionId, onChoose }: SchoolOptionsProps) {
  return (
    <ul
      id={listId}
      role="listbox"
      hidden={!open}
      className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface p-1 shadow-lg"
    >
      {matches.length === 0 ? (
        <li className="px-3 py-2 text-base text-ink-muted">Không có trường phù hợp</li>
      ) : (
        matches.map((school, index) => (
          <li
            key={school.id}
            id={optionId(index)}
            role="option"
            aria-selected={school.id === selectedId}
            // Giữ focus ở ô nhập để onBlur không đóng danh sách trước khi nhận click.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(school)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center rounded-sm px-3 text-base text-ink",
              index === activeIndex && "bg-brand-tint-soft text-brand-dark",
            )}
          >
            {school.name}
          </li>
        ))
      )}
    </ul>
  );
}

export interface SchoolPickerProps {
  control: FieldControlProps;
  schools: readonly LookupSchool[];
  value: string | null;
  onChange: (schoolId: string) => void;
}

/** Ô chọn trường có tìm kiếm (danh sách có thể dài): gõ tên có dấu hoặc không dấu để lọc. */
export function SchoolPicker({ control, schools, value, onChange }: SchoolPickerProps) {
  const listId = useId();
  const combo = useSchoolCombobox(schools, onChange);
  const selected = schools.find((school) => school.id === value);
  const optionId = (index: number) => `${listId}-option-${index}`;
  return (
    <div className="relative">
      <IconSearch
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
      />
      <Input
        {...control}
        role="combobox"
        aria-expanded={combo.open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={combo.open && combo.matches.length > 0 ? optionId(combo.activeIndex) : undefined}
        autoComplete="off"
        placeholder="Gõ tên trường để tìm"
        className="min-h-11 pl-10"
        value={combo.open ? combo.query : (selected?.name ?? "")}
        onFocus={() => combo.openWith("")}
        onBlur={combo.close}
        onChange={(event) => combo.openWith(event.target.value)}
        onKeyDown={combo.handleKeyDown}
      />
      <SchoolOptions
        listId={listId}
        open={combo.open}
        matches={combo.matches}
        activeIndex={combo.activeIndex}
        selectedId={value}
        optionId={optionId}
        onChoose={combo.choose}
      />
    </div>
  );
}
