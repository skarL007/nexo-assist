import type { Employee } from "@/domain/employee";
import { demoScopeOf } from "@/domain/demo";
import { createServices } from "@/infrastructure/container";

/** O espaço da demo vem sempre da identidade autenticada, nunca do pedido. */
export function servicesFor(employee: Employee) {
  return createServices({ demoScope: demoScopeOf(employee.id) });
}
