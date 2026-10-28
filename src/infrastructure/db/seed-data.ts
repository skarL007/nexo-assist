/**
 * Dados de exemplo (Anexo B). As datas são relativas ao momento do seed,
 * para que "vencido" e "resolvido há 4 dias" façam sentido em qualquer dia.
 */
import type { Employee } from "@/domain/employee";
import type { Article } from "@/domain/knowledge";
import type { Ticket } from "@/domain/ticket";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const ago = (ms: number, now = Date.now()) => new Date(now - ms);

export const employees = (): Employee[] => [
  { id: "emp-ana", name: "Ana Souza", email: "ana.souza@nexo.com.br", role: "employee", department: "Financeiro", passwordChangedAt: ago(42 * DAY) },
  { id: "emp-carla", name: "Carla Mendes", email: "carla.mendes@nexo.com.br", role: "employee", department: "Comercial", passwordChangedAt: ago(10 * DAY) },
  { id: "emp-bruno", name: "Bruno Tavares", email: "bruno.tavares@nexo.com.br", role: "employee", department: "Marketing", passwordChangedAt: ago(70 * DAY) },
  { id: "emp-diego", name: "Diego Ramos", email: "diego.ramos@nexo.com.br", role: "employee", department: "Jurídico", passwordChangedAt: ago(5 * DAY) },
  { id: "emp-elisa", name: "Elisa Prado", email: "elisa.prado@nexo.com.br", role: "employee", department: "RH", passwordChangedAt: ago(30 * DAY) },
  // Conversas antigas que alimentam "Lacunas da central" (projetor da sala de reunião, sem artigo).
  { id: "emp-gustavo", name: "Gustavo Alves", email: "gustavo.alves@nexo.com.br", role: "employee", department: "Operações", passwordChangedAt: ago(60 * DAY) },
  { id: "emp-helena", name: "Helena Ribeiro", email: "helena.ribeiro@nexo.com.br", role: "employee", department: "Financeiro", passwordChangedAt: ago(25 * DAY) },
  { id: "emp-igor", name: "Igor Nunes", email: "igor.nunes@nexo.com.br", role: "employee", department: "Compras", passwordChangedAt: ago(12 * DAY) },
  { id: "analyst-rafael", name: "Rafael Lima", email: "rafael.lima@nexo.com.br", role: "analyst", department: "Suporte N2", passwordChangedAt: ago(20 * DAY) },
  { id: "analyst-juliana", name: "Juliana Costa", email: "juliana.costa@nexo.com.br", role: "analyst", department: "Suporte N1", passwordChangedAt: ago(15 * DAY) },
];

export const articles: Article[] = [
  {
    id: "kb-vpn-809",
    title: "VPN com erro 809",
    body: "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
    tags: ["vpn", "809", "conexão", "home office", "windows 10"],
  },
  {
    id: "kb-horario",
    title: "Horário do service desk",
    body: "De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
    tags: ["horário", "atendimento", "plantão", "funcionamento"],
  },
  {
    id: "kb-senha-rede",
    title: "Trocar ou redefinir a senha de rede",
    body: "A senha de rede expira a cada 90 dias. Para trocar ou redefinir, acesse senha.nexo.com.br com seu e-mail corporativo e confirme o código enviado ao celular cadastrado.",
    tags: ["senha", "rede", "expirada", "redefinir", "login", "windows"],
  },
  {
    id: "kb-sap-bloqueio",
    title: "Senha do SAP bloqueada",
    body: "Após 3 tentativas erradas o SAP bloqueia por 30 minutos. Para desbloquear na hora, use a opção 'Desbloquear usuário' no portal de autoatendimento. Se o usuário continuar bloqueado, abra um chamado de Acesso.",
    tags: ["sap", "bloqueada", "bloqueio", "senha", "acesso"],
  },
  {
    id: "kb-email-celular",
    title: "Configurar o e-mail corporativo no celular",
    body: "Instale o app Outlook, entre com o e-mail corporativo e aprove o login no Microsoft Authenticator. Outros apps de e-mail não são suportados.",
    tags: ["email", "e-mail", "outlook", "celular", "sincroniza", "mfa"],
  },
  {
    id: "kb-impressora",
    title: "Impressora não imprime",
    body: "Confira se a impressora está como padrão e limpe a fila de impressão em Configurações > Impressoras. Se a impressora mostrar erro no painel, abra um chamado de Hardware informando o andar.",
    tags: ["impressora", "imprimir", "impressão", "fila"],
  },
  {
    id: "kb-wifi",
    title: "Wi-Fi corporativo",
    body: "Conecte na rede Nexo-Corp com seu e-mail e senha de rede. Visitantes usam a rede Nexo-Guest, com senha na recepção.",
    tags: ["wifi", "wi-fi", "rede", "internet", "sem fio"],
  },
  {
    id: "kb-software",
    title: "Instalar ou solicitar software",
    body: "Softwares gratuitos homologados estão no portal de softwares, para instalar sem chamado. Softwares pagos ou fora do portal exigem uma requisição (REQ) com aprovação do gestor.",
    tags: ["software", "instalar", "programa", "licença", "portal"],
  },
  {
    id: "kb-equipamento",
    title: "Pedir equipamento",
    body: "Monitor, teclado, mouse e headset são pedidos por requisição (REQ) de Hardware. A entrega leva até 5 dias úteis após a aprovação do gestor.",
    tags: ["equipamento", "monitor", "teclado", "mouse", "headset", "notebook"],
  },
];

export const tickets = (): Ticket[] => {
  const base = { impact: "me" as const, resolvedAt: null };
  return [
    {
      ...base,
      code: "INC-20311",
      type: "INC",
      title: "Notebook lento após atualização do Windows",
      description: "Lentidão geral desde a última atualização do Windows. Reiniciar e rodar o diagnóstico da central não resolveu.",
      category: "hardware",
      priority: "medium",
      status: "waiting_analyst",
      ownerId: "emp-ana",
      createdAt: ago(12 * DAY),
      updatedAt: ago(6 * DAY),
    },
    {
      ...base,
      code: "INC-20298",
      type: "INC",
      title: "Acesso à pasta Financeiro no SharePoint",
      description: "Sem permissão para abrir a pasta Financeiro/Fechamento no SharePoint.",
      category: "access",
      priority: "medium",
      status: "in_progress",
      ownerId: "emp-ana",
      createdAt: ago(13 * DAY),
      updatedAt: ago(1 * DAY),
    },
    {
      ...base,
      code: "REQ-10442",
      type: "REQ",
      title: "Segundo monitor para home office",
      description: "Pedido de um segundo monitor de 24 polegadas para trabalho remoto.",
      category: "hardware",
      priority: "low",
      status: "approved",
      ownerId: "emp-ana",
      createdAt: ago(9 * DAY),
      updatedAt: ago(3 * DAY),
    },
    {
      ...base,
      code: "INC-20150",
      type: "INC",
      title: "Senha do SAP bloqueada",
      description: "Usuário do SAP bloqueado após tentativas de login.",
      category: "access",
      priority: "medium",
      status: "resolved",
      ownerId: "emp-ana",
      createdAt: ago(6 * DAY),
      updatedAt: ago(4 * DAY),
      resolvedAt: ago(4 * DAY),
    },
    {
      ...base,
      code: "INC-19877",
      type: "INC",
      title: "Outlook não sincroniza no celular",
      description: "E-mails não chegam no app Outlook do celular.",
      category: "email",
      priority: "low",
      status: "resolved",
      ownerId: "emp-ana",
      createdAt: ago(25 * DAY),
      updatedAt: ago(20 * DAY),
      resolvedAt: ago(20 * DAY),
    },
    {
      ...base,
      code: "INC-20320",
      type: "INC",
      title: "Acesso ao SAP para fechamento",
      description: "Usuário do SAP sem perfil de aprovação; precisa fechar pedidos hoje.",
      category: "access",
      priority: "high",
      status: "waiting_analyst",
      ownerId: "emp-carla",
      createdAt: ago(3 * HOUR),
      updatedAt: ago(3 * HOUR),
    },
    {
      ...base,
      code: "REQ-10450",
      type: "REQ",
      title: "Licença do Adobe Illustrator",
      description: "Licença para a nova designer do time de marketing.",
      category: "software",
      priority: "low",
      status: "open",
      ownerId: "emp-bruno",
      createdAt: ago(2 * DAY),
      updatedAt: ago(2 * DAY),
    },
    {
      ...base,
      code: "INC-20319",
      type: "INC",
      title: "Wi-Fi caindo na sala 3",
      description: "A conexão cai a cada poucos minutos na sala de reuniões 3.",
      category: "network",
      priority: "medium",
      impact: "team",
      status: "in_progress",
      ownerId: "emp-elisa",
      createdAt: ago(1 * DAY),
      updatedAt: ago(5 * HOUR),
    },
    // Três pessoas com o sistema de ponto fora do ar na última hora e meia: incidente em massa.
    ...([
      ["INC-20330", "emp-gustavo", "Sistema de ponto fora do ar", 40],
      ["INC-20331", "emp-helena", "Ponto eletrônico não abre", 70],
      ["INC-20332", "emp-igor", "Erro 500 no sistema de ponto", 100],
    ] as const).map(
      ([code, ownerId, title, minutesAgo]): Ticket => ({
        ...base,
        code,
        type: "INC",
        title,
        description: "O sistema de ponto mostra erro 500 ao abrir; não dá para registrar o ponto.",
        category: "software",
        priority: "medium",
        status: "open",
        ownerId,
        createdAt: ago(minutesAgo * 60_000),
        updatedAt: ago(minutesAgo * 60_000),
      }),
    ),
  ];
};
