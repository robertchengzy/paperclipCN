import { Children, Fragment, isValidElement, type ComponentProps, useState, type ReactNode } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./ui/select";

interface ConfigSelectProps extends Omit<ComponentProps<typeof SelectTrigger>, "value" | "defaultValue" | "onChange" | "children"> {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  name?: string;
  required?: boolean;
}

// Prefix every value, including the empty default. Radix reserves the empty
// string for placeholders; encoding all values avoids sentinel collisions.
const encode = (value: string | number) => `value:${value}`;

function options(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return null;
    if (child.type === Fragment) return options(child.props.children);
    if (child.type === "optgroup") {
      return <SelectGroup><SelectLabel>{child.props.label}</SelectLabel>{options(child.props.children)}</SelectGroup>;
    }
    return <SelectItem value={encode(child.props.value ?? String(child.props.children ?? ""))} disabled={child.props.disabled}>{child.props.children}</SelectItem>;
  });
}

function selectedLabel(children: ReactNode, value: string | number | undefined): ReactNode {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) continue;
    if (child.type === Fragment || child.type === "optgroup") {
      const label = selectedLabel(child.props.children, value);
      if (label !== undefined) return label;
    } else if (String(child.props.value ?? child.props.children) === String(value)) return child.props.children;
  }
  return undefined;
}

/** Theme-aware configuration select. Option values remain storage values. */
export function ConfigSelect({ value, defaultValue, onValueChange, children, name, required, disabled, ...trigger }: ConfigSelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const currentValue = value ?? uncontrolledValue;
  return (
    <Select value={value === undefined ? undefined : encode(value)} defaultValue={defaultValue === undefined ? undefined : encode(defaultValue)} onValueChange={(next) => { setUncontrolledValue(next.slice(6)); onValueChange(next.slice(6)); }} name={name} required={required} disabled={disabled}>
      <SelectTrigger {...trigger}><SelectValue>{selectedLabel(children, currentValue)}</SelectValue></SelectTrigger>
      <SelectContent position="popper">{options(children)}</SelectContent>
    </Select>
  );
}
