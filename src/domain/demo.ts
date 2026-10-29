/** O namespace faz parte de identidades criadas no servidor, nunca de argumento de tool. */
export function demoScopeOf(employeeId: string): string | undefined {
  return /^demo:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):/.exec(employeeId)?.[1];
}
