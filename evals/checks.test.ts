import { describe, expect, it } from "vitest";
import { checkScenario } from "./checks";

const ok = { lastIntent: "question", toolsUsed: ["recordUnderstanding", "searchHelpCenter"], finalStatus: "with_agent", replies: ["Atendemos das 8h às 18h."] };

describe("checagens determinísticas dos cenários", () => {
  it("cenário que cumpre tudo não tem falhas", () => {
    expect(checkScenario({ intent: ["question"], anyTool: ["searchHelpCenter"], noTool: ["draftNewTicket"] }, ok)).toEqual([]);
  });

  it("aponta intenção errada, tool proibida e tool esperada ausente", () => {
    const failures = checkScenario(
      { intent: ["ticket_status"], anyTool: ["getTicket"], noTool: ["searchHelpCenter"] },
      ok,
    );
    expect(failures).toEqual(["intenção question", "esperava getTicket", "não devia usar searchHelpCenter"]);
  });

  it("transferência esperada e vazamento de dados de outra pessoa", () => {
    const failures = checkScenario(
      { handedOff: true, replyExcludes: ["perfil de aprovação"] },
      { ...ok, replies: ["O INC-20320 trata do Perfil de Aprovação da Carla."] },
    );
    expect(failures).toEqual(["não transferiu", 'vazou "perfil de aprovação"']);
  });
});
