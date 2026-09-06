import React, { useState, useRef, useEffect } from "react";

export interface SearchableSelectProps {
  options: any[]; // Array of objects
  value: number | string;
  onChange: (value: number | string) => void;
  placeholder: string;
  labelKey?: string; // which key to display as selected
  searchKeys?: string[]; // keys to search on
  columns?: {
    key: string;
    title: string;
    render?: (opt: any) => React.ReactNode;
  }[]; // display as table in dropdown
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  labelKey = "label",
  searchKeys = ["label", "barcode"],
  columns,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي");
  };

  const filteredOptions = options.filter((opt) => {
    if (!opt) return false;
    const searchString = normalizeText(searchTerm);
    if (!searchString) return true;

    // Fuzzy Search: Check if any of the search keys contain the search string
    return searchKeys.some((key) => {
      const val = opt[key];
      if (val === undefined || val === null) return false;
      return normalizeText(val.toString()).includes(searchString);
    });
  });

  const selectedOption = options.find((opt) => opt.id === value);
  const dropdownWidth = columns ? Math.max(300, columns.length * 150) : "none"; // wider for tables

  // Display the selected item text if not open, otherwise show what the user is typing
  const displayValue = isOpen
    ? searchTerm
    : selectedOption
      ? selectedOption[labelKey]
      : "";

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative w-full">
        <input
          type="text"
          className="w-full p-4 pr-12 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-slate-800 text-lg shadow-sm transition-all placeholder:text-slate-400 font-medium"
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (value !== "") {
              onChange("");
            }
          }}
          onClick={() => {
            setIsOpen(true);
            setSearchTerm("");
            if (value !== "") {
              onChange("");
            }
          }}
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <svg
            className="h-6 w-6 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col"
          style={{
            width: columns
              ? Math.max(
                  wrapperRef.current?.offsetWidth || 0,
                  typeof dropdownWidth === "number" ? dropdownWidth : 0,
                )
              : "100%",
            minWidth: "100%",
            right: 0,
          }}
        >
          <div className="overflow-y-auto w-full max-h-80">
            {filteredOptions.length > 0 ? (
              columns ? (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm border-b border-slate-200">
                    <tr>
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="p-3 text-slate-600 font-bold whitespace-nowrap"
                        >
                          {col.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOptions.map((opt) => (
                      <tr
                        key={opt.id}
                        onClick={() => {
                          onChange(opt.id);
                          setIsOpen(false);
                          setSearchTerm("");
                        }}
                        className={`cursor-pointer hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0 ${value === opt.id ? "bg-emerald-50 text-emerald-700" : "text-slate-700"}`}
                      >
                        {columns.map((col, idx) => (
                          <td
                            key={idx}
                            className={`p-4 font-medium ${idx === 0 ? "text-slate-900 border-r-2 border-transparent" : ""} ${value === opt.id && idx === 0 ? "border-emerald-500" : ""}`}
                          >
                            {col.render ? col.render(opt) : opt[col.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className={`p-4 hover:bg-emerald-50 cursor-pointer text-base font-medium transition-colors border-b border-slate-50 last:border-0 ${value === opt.id ? "bg-emerald-50 text-emerald-700 border-r-2 border-emerald-500" : "text-slate-700 border-r-2 border-transparent"}`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    {opt[labelKey]}
                  </div>
                ))
              )
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                <div className="text-3xl mb-3">🔍</div>
                <div className="font-medium text-lg text-slate-700">
                  لا توجد نتائج للبحث
                </div>
                <div className="mt-1">حاول البحث باستخدام اسم أو كود آخر</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
