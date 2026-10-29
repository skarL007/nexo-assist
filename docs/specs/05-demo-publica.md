# 05 · Demonstração por visitante

Com `PUBLIC_DEMO=1`, cada navegador recebe um identificador aleatório assinado, válido por sete dias. Ana e Rafael do mesmo navegador compartilham esse espaço de demonstração; navegadores diferentes não compartilham pessoas, conversas, chamados ou indicadores. Login não aceita identidade de visitante fornecida pelo cliente.

Os exemplos vêm dos fixtures do projeto, nunca das conversas já existentes de outros visitantes. Os códigos dos chamados são alocados de forma global e podem diferir dos códigos do seed; os títulos, situações de prazo e roteiro são mantidos. O console inclui exemplos fictícios e as conversas do próprio espaço. Conhecimento compartilhado é somente a central de ajuda.

Os limites de mensagens por pessoa usam as identidades isoladas. O teto global de custo continua global, com no máximo vinte novos espaços por hora. Dados de demonstração expirados são removidos depois de sete dias, sem alterar o seed nem dados normais. Sem `PUBLIC_DEMO`, o login existente continua funcionando.

Aceite: dois contextos de navegador entram como Ana e recebem IDs diferentes; mensagem de A não aparece em B. Rafael de B não lista, lê, assume, responde ou pede sugestão para conversa de A, mesmo conhecendo seu ID. Indicadores e incidentes conhecidos respeitam o mesmo escopo. A troca Ana/Rafael no próprio navegador preserva o espaço. Cookie alterado não seleciona espaço de outro visitante.
