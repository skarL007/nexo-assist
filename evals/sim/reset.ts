/**
 * Estado inicial de cada execução do funcionário simulado.
 *
 * O pass^k do τ-bench pressupõe k tentativas da MESMA tarefa. Sem reset, o chamado que a
 * execução #1 abre continua no banco, e nas execuções #2 e #3 o agent (corretamente) o trata
 * como duplicado e atualiza em vez de abrir outro: a checagem "1 chamado novo" reprova e o
 * pass^k mede outra coisa. Aqui o banco do eval:sim (descartável) volta ao seed antes de cada
 * execução: chamados, conversas, mensagens, rascunhos e contadores de uso.
 */
import type { Database } from "@/infrastructure/db/client";
import { seedDemoData } from "@/infrastructure/db/seed";

export async function resetSimState(db: Database): Promise<void> {
  await seedDemoData(db);
}
