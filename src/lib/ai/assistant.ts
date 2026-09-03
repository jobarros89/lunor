import {
  LUNOR_AI_MODEL,
  runLunorAiTurn,
  type LunorAiMessage,
  type LunorAiTurn,
} from "@/lib/ai/cloudflare";
import {
  executeInternalAiTool,
  internalAiTools,
  isAssignmentProposal,
  isInternalAiTool,
  isScheduleDraft,
  isWorshipSetlistProposal,
  type WorshipSetlistProposal,
} from "@/lib/ai/internal-tools";
import type { AssignmentProposal } from "@/lib/ai/scheduling";
import {
  executeLunorTool,
  lunorAiTools,
  type LunorToolContext,
} from "@/lib/ai/tools";

const SYSTEM_PROMPT = `Você é o assistente operacional do LUNOR para líderes de igreja.
Responda em português do Brasil, com clareza e objetividade.
Use as ferramentas do LUNOR para fatos sobre cultos, escalas, pessoas, disponibilidade, Louvor ou Kids.
Baseie respostas factuais atuais nos dados retornados pelas ferramentas.
"Sem resposta" é diferente de "indisponível".
O escopo de igreja e ministério é definido pelo servidor.
Para sugerir uma pessoa para uma função, consulte primeiro get_schedule_candidates e depois use propose_assignment.
Para montar um rascunho da próxima escala ou de uma escala completa, descubra o culto com get_operational_summary e use draft_schedule_from_previous_service.
O rascunho usa a escala anterior apenas como referência de funções; deixe isso claro ao líder.
Nunca proponha uma pessoa marcada como indisponível.
Quando o ministério atual for Louvor, use get_worship_library_insights para perguntas sobre acervo, repetição, tom, BPM, compasso, materiais ou sugestões de músicas.
Ao sugerir repertório para um culto, descubra o culto com get_operational_summary quando necessário, consulte get_worship_library_insights e depois use propose_worship_setlist com 2 a 6 IDs retornados pelo acervo, na ordem musical sugerida.
Uma proposta de repertório deve usar somente músicas realmente retornadas por get_worship_library_insights. Não invente títulos, artistas, tons, BPMs ou IDs.
Para analisar um repertório já montado, descubra o culto com get_operational_summary quando necessário e use analyze_worship_setlist. Diferencie fatos objetivos (tom, BPM, repetição, distância tonal) de opinião musical.
Quando o usuário pedir para refinar uma proposta anterior de repertório — por exemplo "troque a segunda música", "quero algo menos repetido", "coloque uma música mais calma no final", "mude a ordem" ou "evite mudanças grandes de tom" — use a proposta atual descrita no histórico como ponto de partida.
Em refinamentos, preserve o mesmo culto e preserve as músicas/posições que o usuário não pediu para mudar. Para referências como "segunda", "última" ou "a terceira", use a ordem explícita da proposta atual no histórico.
Antes de trocar ou inserir uma música, consulte get_worship_library_insights (use uma janela ampla e até 100 músicas quando precisar de alternativas) e depois chame propose_worship_setlist com a sequência completa resultante.
Para "menos repetido", priorize usageCountInWindow menor. Para "mais calma", use BPM como sinal objetivo quando não houver outro dado musical disponível e deixe essa limitação clara. Para suavizar transições, considere tom e BPM; se propose_worship_setlist ainda retornar alerta de mudança ampla e houver alternativas viáveis, tente uma nova ordem ou seleção uma vez.
propose_worship_setlist NÃO grava dados. A proposta só é adicionada ao repertório quando o líder tocar explicitamente em "Adicionar ao repertório" no LUNOR. A confirmação é aditiva: preserva músicas que já existem no culto.
Quando o ministério atual for Kids ou Infantil, use get_kids_operational_insights para perguntas sobre operação atual, presença por turma, chamadas pendentes, prontidão dos cadastros, autorização de retirada e frequência histórica.
Dados do Kids envolvem menores. Prefira sempre indicadores agregados e o mínimo necessário para a operação. Não exponha pelo assistente nomes de crianças, códigos de retirada, telefones, nomes de responsáveis, motivos de chamadas, notas de saúde, detalhes de alergias ou detalhes de necessidades especiais.
No Kids, trate alergia e necessidade especial apenas como sinal agregado de cuidado. Não infira diagnóstico, gravidade, condição médica ou conduta clínica. Se houver sinal de cuidado, oriente o líder a consultar a tela operacional autorizada do Kids para os detalhes necessários.
Chamadas pendentes devem ser descritas por quantidade e tempo de espera, nunca pelo motivo ou identidade da criança. Autorizações de retirada devem ser descritas por quantidade de cadastros incompletos, nunca por códigos ou dados do responsável.
get_kids_operational_insights é somente leitura e não faz check-in, check-out, retirada, chamada de responsável nem alteração cadastral.
Uma proposta de escala NÃO altera dados: a gravação só acontece depois que o líder tocar em "Confirmar escala" no LUNOR.
As demais ferramentas desta versão são somente leitura.
Prefira respostas curtas, salvo quando o usuário pedir detalhes.`;

export type LunorAssistantHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type LunorAssistantResult = {
  answer: string;
  model: string;
  usedTools: string[];
  proposals: AssignmentProposal[];
  worshipSetlistProposals: WorshipSetlistProposal[];
};

type TurnRunner = (input: {
  messages: LunorAiMessage[];
  tools?: ReturnType<typeof lunorAiTools>;
  maxTokens?: number;
  temperature?: number;
}) => Promise<LunorAiTurn>;

type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  context: LunorToolContext
) => Promise<unknown>;

async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  context: LunorToolContext
) {
  if (isInternalAiTool(name)) return executeInternalAiTool(name, args, context);
  return executeLunorTool(name, args, context);
}

/**
 * O binding tradicional do Workers AI espera o tool call anterior serializado
 * no conteúdo da mensagem `assistant`; a mensagem `tool` seguinte contém apenas
 * o resultado. Como desabilitamos chamadas paralelas, o caso normal é um único
 * tool call por rodada.
 */
function toolCallMessage(turn: LunorAiTurn) {
  const calls = turn.toolCalls.map((call) => ({
    name: call.name,
    arguments: call.arguments,
  }));
  return JSON.stringify(calls.length === 1 ? calls[0] : calls);
}

function proposalKey(proposal: AssignmentProposal) {
  return `${proposal.eventId}:${proposal.userId}:${proposal.roleName.toLocaleLowerCase("pt-BR")}`;
}

function appendProposal(proposals: AssignmentProposal[], proposal: AssignmentProposal) {
  const key = proposalKey(proposal);
  if (!proposals.some((item) => proposalKey(item) === key)) proposals.push(proposal);
}

function worshipProposalKey(proposal: WorshipSetlistProposal) {
  return `${proposal.event.id}:${proposal.songs.map((song) => song.songId).join(",")}`;
}

function appendWorshipProposal(
  proposals: WorshipSetlistProposal[],
  proposal: WorshipSetlistProposal
) {
  const key = worshipProposalKey(proposal);
  if (!proposals.some((item) => worshipProposalKey(item) === key)) proposals.push(proposal);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function withWorshipProposalHistoryContext(
  answer: string,
  proposals: WorshipSetlistProposal[]
) {
  const latest = proposals.at(-1);
  if (!latest) return answer;

  const normalizedAnswer = normalizeText(answer);
  const alreadyListsSongs = latest.songs.every((song) =>
    normalizedAnswer.includes(normalizeText(song.title))
  );
  if (alreadyListsSongs) return answer;

  const orderedSongs = latest.songs
    .map((song) => `${song.position}. ${song.title}`)
    .join(" · ");

  return `${answer.trim()}\n\nProposta atual para refinamento — ${latest.event.title}: ${orderedSongs}.`;
}

export async function runLunorAssistant({
  question,
  history = [],
  context,
  maxToolRounds = 5,
  runner = runLunorAiTurn,
  toolExecutor = executeAssistantTool,
}: {
  question: string;
  history?: LunorAssistantHistoryItem[];
  context: LunorToolContext;
  maxToolRounds?: number;
  runner?: TurnRunner;
  toolExecutor?: ToolExecutor;
}): Promise<LunorAssistantResult> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) throw new Error("assistant_question_empty");
  if (cleanQuestion.length > 1_500) throw new Error("assistant_question_too_large");

  const recentHistory = history
    .slice(-8)
    .map((item) => ({ ...item, content: item.content.trim().slice(0, 1_500) }))
    .filter((item) => item.content.length > 0);
  const messages: LunorAiMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nEscopo atual: ministério ${context.ministryName}.`,
    },
    ...recentHistory,
    { role: "user", content: cleanQuestion },
  ];
  const usedTools: string[] = [];
  const proposals: AssignmentProposal[] = [];
  const worshipSetlistProposals: WorshipSetlistProposal[] = [];
  const tools = [...lunorAiTools(), ...internalAiTools()];
  let usedModel = LUNOR_AI_MODEL;

  for (let round = 0; round < maxToolRounds; round += 1) {
    const turn = await runner({
      messages,
      tools,
      maxTokens: 620,
      temperature: 0.1,
    });
    if (turn.model) usedModel = turn.model;

    if (turn.toolCalls.length === 0) {
      if (!turn.text) throw new Error("assistant_empty_answer");
      return {
        answer: withWorshipProposalHistoryContext(
          turn.text,
          worshipSetlistProposals
        ),
        model: usedModel,
        usedTools: [...new Set(usedTools)],
        proposals,
        worshipSetlistProposals,
      };
    }

    messages.push({ role: "assistant", content: toolCallMessage(turn) });

    for (const call of turn.toolCalls.slice(0, 3)) {
      let payload: unknown;
      try {
        const data = await toolExecutor(call.name, call.arguments, context);
        payload = { ok: true, data };
        usedTools.push(call.name);
        if (call.name === "propose_assignment" && isAssignmentProposal(data)) {
          appendProposal(proposals, data);
        }
        if (call.name === "draft_schedule_from_previous_service" && isScheduleDraft(data)) {
          data.proposals.forEach((proposal) => appendProposal(proposals, proposal));
        }
        if (call.name === "propose_worship_setlist" && isWorshipSetlistProposal(data)) {
          appendWorshipProposal(worshipSetlistProposals, data);
        }
      } catch (error) {
        payload = {
          ok: false,
          error: error instanceof Error ? error.message : "tool_error",
        };
      }

      messages.push({
        role: "tool",
        content: JSON.stringify(payload),
      });
    }
  }

  messages.push({
    role: "user",
    content: "Responda usando somente os resultados das ferramentas acima. Se faltar um dado, informe que ele não foi encontrado.",
  });
  const finalTurn = await runner({ messages, tools: [], maxTokens: 620, temperature: 0.1 });
  if (finalTurn.model) usedModel = finalTurn.model;
  if (!finalTurn.text) throw new Error("assistant_empty_answer");

  return {
    answer: withWorshipProposalHistoryContext(
      finalTurn.text,
      worshipSetlistProposals
    ),
    model: usedModel,
    usedTools: [...new Set(usedTools)],
    proposals,
    worshipSetlistProposals,
  };
}
