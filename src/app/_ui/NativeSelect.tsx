"use client";

import { ChevronDown } from "lucide-react";

export type NativeSelectOption = {
  value: string;
  label: string;
};

type NativeSelectProps = {
  ariaLabel: string;
  options: NativeSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export function NativeSelect({ ariaLabel, options, value, onValueChange }: NativeSelectProps) {
  return (
    <span className="lg-native-select">
      <select
        aria-label={ariaLabel}
        className="lg-native-select-control"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="lg-native-select-icon" size={16} strokeWidth={1.8} />
    </span>
  );
}
