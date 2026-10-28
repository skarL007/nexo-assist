/**
 * Perguntas do benchmark de recuperação da central, escritas como um funcionário escreveria:
 * paráfrases e sinônimos (o que palavras-chave não pegam) e perguntas SEM artigo certo,
 * em que o melhor resultado é nenhum (o agent não deve responder com um artigo sem relação).
 */
export interface RetrievalQuery {
  query: string;
  /** Artigo certo, ou null quando nenhum artigo da central responde. */
  expected: string | null;
}

export const retrievalQueries: RetrievalQuery[] = [
  { query: "não consigo acessar a rede da empresa de casa", expected: "kb-vpn-809" },
  { query: "a conexão remota com a Nexo dá 809", expected: "kb-vpn-809" },
  { query: "trabalho em home office e não conecto no sistema interno", expected: "kb-vpn-809" },
  { query: "até que horas o suporte atende?", expected: "kb-horario" },
  { query: "o service desk abre no sábado?", expected: "kb-horario" },
  { query: "tem plantão de madrugada para emergência?", expected: "kb-horario" },
  { query: "esqueci minha senha do computador", expected: "kb-senha-rede" },
  { query: "minha senha expirou e não consigo logar no Windows", expected: "kb-senha-rede" },
  { query: "como reseto a senha de rede", expected: "kb-senha-rede" },
  { query: "o SAP travou meu usuário depois que errei a senha", expected: "kb-sap-bloqueio" },
  { query: "usuário bloqueado no sistema de pedidos SAP", expected: "kb-sap-bloqueio" },
  { query: "quero receber os e-mails do trabalho no meu iPhone", expected: "kb-email-celular" },
  { query: "o Gmail do celular não sincroniza o e-mail da empresa", expected: "kb-email-celular" },
  { query: "como configurar o Outlook no Android", expected: "kb-email-celular" },
  { query: "não sai nada da impressora", expected: "kb-impressora" },
  { query: "o documento fica preso na fila e não imprime", expected: "kb-impressora" },
  { query: "a multifuncional do 2º andar mostra erro", expected: "kb-impressora" },
  { query: "a internet sem fio não conecta no notebook", expected: "kb-wifi" },
  { query: "qual a senha da rede para visitante?", expected: "kb-wifi" },
  { query: "o wi-fi da sala de reunião caiu", expected: "kb-wifi" },
  { query: "preciso instalar o Photoshop", expected: "kb-software" },
  { query: "como baixo o Zoom no computador da empresa", expected: "kb-software" },
  { query: "quero um programa que não está no portal", expected: "kb-software" },
  { query: "quero um segundo monitor", expected: "kb-equipamento" },
  { query: "meu headset quebrou, como peço outro", expected: "kb-equipamento" },
  { query: "preciso de um teclado novo", expected: "kb-equipamento" },
  { query: "como faço para ter um mouse sem fio", expected: "kb-equipamento" },
  // Sem artigo certo: o resultado ideal é nenhum.
  { query: "quando cai o meu holerite?", expected: null },
  { query: "como marco minhas férias?", expected: null },
  { query: "o ar-condicionado da sala está pingando", expected: null },
  { query: "qual o cardápio do refeitório hoje?", expected: null },
  { query: "meu notebook está esquentando muito", expected: null },
  { query: "a tela do computador está piscando", expected: null },
];

/**
 * Conjunto separado, escrito DEPOIS de escolher o algoritmo e a margem com o conjunto acima.
 * Serve para conferir que a escolha não foi decorada para aquelas 33 perguntas.
 */
export const holdoutQueries: RetrievalQuery[] = [
  { query: "a VPN não conecta quando estou viajando", expected: "kb-vpn-809" },
  { query: "aparece erro 809 na conexão", expected: "kb-vpn-809" },
  { query: "vocês atendem em feriado?", expected: "kb-horario" },
  { query: "minha senha de login venceu", expected: "kb-senha-rede" },
  { query: "como troco a senha do Windows", expected: "kb-senha-rede" },
  { query: "travei meu acesso no SAP", expected: "kb-sap-bloqueio" },
  { query: "não chegam e-mails no meu celular", expected: "kb-email-celular" },
  { query: "o Authenticator pede aprovação e o e-mail não abre no telefone", expected: "kb-email-celular" },
  { query: "a impressora aparece offline", expected: "kb-impressora" },
  { query: "não acho a rede wifi da empresa", expected: "kb-wifi" },
  { query: "quero instalar o Notepad++", expected: "kb-software" },
  { query: "preciso de um headset para as reuniões", expected: "kb-equipamento" },
  { query: "posso levar meu cachorro para o escritório?", expected: null },
  { query: "como peço reembolso de táxi?", expected: null },
  { query: "a cadeira da minha mesa quebrou", expected: null },
  { query: "qual o ramal do RH?", expected: null },
  { query: "o elevador está parado", expected: null },
];
