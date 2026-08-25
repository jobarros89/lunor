import Link from "next/link";
import type { Metadata } from "next";
import { DIAS_TRIAL } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o LUNOR trata os dados da sua igreja, da sua equipe e das crianças.",
};

export default function PrivacidadePage() {
  return (
    <Doc titulo="Política de Privacidade" atualizado="22 de julho de 2026">
      <P>
        Esta política explica, em linguagem direta, quais dados o LUNOR guarda,
        por quê, quem consegue vê-los e o que você pode exigir. Ela vale para
        toda igreja que usa o sistema.
      </P>

      <H>Quem é responsável</H>
      <P>
        Cada <strong>igreja</strong> é a controladora dos dados que cadastra
        (equipe, escalas, patrimônio, crianças). O LUNOR é a operadora: guarda e
        processa esses dados para entregar o serviço, seguindo as instruções da
        igreja.
      </P>

      <H>Que dados são tratados</H>
      <UL
        itens={[
          "Conta: nome, e-mail e senha (a senha é armazenada com hash — nem nós conseguimos lê-la).",
          "Perfil de voluntário: telefone, profissão, aptidões, disponibilidade e interesses — usados para montar escalas de forma justa.",
          "Escalas e avaliações: onde a pessoa serve e o retorno da liderança sobre o serviço.",
          "Patrimônio: equipamentos da igreja e histórico de uso.",
          "Crianças (ministério infantil): nome, data de nascimento, alergias, condições de saúde, necessidades especiais, responsáveis autorizados e registro de entrada/saída.",
        ]}
      />

      <H>Dados de crianças — tratamento reforçado</H>
      <P>
        Dados de menores recebem proteção específica (art. 14 da LGPD) e são
        tratados no <strong>melhor interesse da criança</strong>:
      </P>
      <UL
        itens={[
          "O cadastro só é feito com consentimento de um responsável, registrado com data no sistema.",
          "A autorização de uso de imagem é um consentimento separado e opcional — quem não autoriza fica sinalizado, para a igreja não publicar fotos indevidamente.",
          "Alergias e condições de saúde são coletadas porque existem para uso em emergência e no cuidado diário, não por conveniência.",
          "Esses dados são visíveis apenas a quem serve no ministério infantil daquela igreja e à coordenação dela. Nenhum outro ministério enxerga.",
          "A retirada da criança só é registrada para responsáveis autorizados; exceções exigem justificativa e ficam gravadas com o nome de quem autorizou.",
        ]}
      />

      <H>Quem consegue ver o quê</H>
      <P>
        O isolamento é aplicado no banco de dados, não apenas na tela. Cada
        igreja só acessa os próprios dados, e dentro dela cada ministério só vê
        o que é seu. Avaliações de desempenho são visíveis à própria pessoa, à
        liderança do seu ministério e à coordenação da igreja.
      </P>
      <P>
        A operação da plataforma tem acesso técnico necessário para manutenção,
        suporte e segurança — usado apenas com essa finalidade.
      </P>

      <H>Por quanto tempo guardamos</H>
      <P>
        Enquanto a igreja usar o serviço. Encerrada a conta, os dados podem ser
        excluídos mediante solicitação. Registros de auditoria e de retirada de
        crianças podem ser mantidos por prazo maior, por serem justamente a
        prova de que algo foi feito corretamente.
      </P>

      <H>Seus direitos</H>
      <P>
        Você pode pedir acesso, correção, portabilidade ou exclusão dos seus
        dados, além de revogar consentimentos. Para dados de uma criança, o
        pedido é feito pelo responsável legal. Basta falar com a liderança da
        sua igreja ou com a operação da plataforma.
      </P>

      <H>Segurança</H>
      <P>
        Os dados trafegam criptografados, ficam em banco gerenciado com backup
        e o acesso é controlado por regras aplicadas no próprio banco. Nenhum
        sistema é imune a falhas: se ocorrer um incidente relevante, as igrejas
        afetadas serão comunicadas.
      </P>

      <H>Cookies</H>
      <P>
        Usamos apenas o necessário para manter você conectado e lembrar o setor
        ativo. Não há rastreamento publicitário nem venda de dados — a nenhum
        terceiro, em nenhuma hipótese.
      </P>

      <H>Contato</H>
      <P>
        Para qualquer pedido relacionado a dados, fale com a liderança da sua
        igreja ou com a operação da plataforma pelo canal informado no cadastro.
      </P>

      <Nota>
        Este documento foi escrito para ser claro e honesto, mas não substitui
        orientação jurídica. Se a sua igreja tiver exigências específicas,
        vale a leitura de um advogado. Período de teste: {DIAS_TRIAL} dias.
      </Nota>
    </Doc>
  );
}

// ---------- casca compartilhada dos documentos ----------
export function Doc({
  titulo,
  atualizado,
  children,
}: {
  titulo: string;
  atualizado: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          LUNOR
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-24">
        <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atualizado em {atualizado}
        </p>
        <div className="mt-8 space-y-4">{children}</div>
      </main>
    </div>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-4 text-lg font-semibold tracking-tight">{children}</h2>
  );
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed text-muted-foreground">{children}</p>;
}
export function UL({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 rounded-2xl border px-5 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

