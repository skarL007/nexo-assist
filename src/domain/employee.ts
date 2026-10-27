export type EmployeeRole = "employee" | "analyst";

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  department: string;
  passwordChangedAt: Date;
}

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const firstName = (name: string) => name.split(" ")[0] ?? name;
