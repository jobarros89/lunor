import type { Metadata } from "next";
import Link from "next/link";
import { Doc, H, P, UL, Nota } from "@/app/privacidade/page";
import { DIAS_TRIAL, PRECO_ANUAL, PRECO_MENSAL } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "As regras de uso do LUNOR, em linguagem direta.",
};

export default function TermosPage() {
  return (
    <Doc titulo="Termos de Uso" atualizado="28 de agosto de 2026">
      <P>
        Estas são as regras de uso do LUNOR. Escrevemos em linguagem direta de
        propósito: você deve conseguir entender o que está aceitando sem
        precisar de tradutor.
      </P>

      <H>O que o LUNOR é</H>
      <P>
        Um sistema de gestão para igrejas: escalas de culto, equipe,
        ministérios, patrimônio e LUNOR Kids. É oferecido como serviço pela
        internet, sem instalação.
      </P>

      <H>Quem pode usar</H>
      <P>
        Igrejas e seus voluntários. Cada conta pertence a uma pessoa e não deve
        ser compartilhada — o histórico de quem fez o quê depende disso,
        especialmente no registro de retirada de crianças.
      </P>

      <H>Quanto custa</H>
      <UL
        itens={[
          `Os primeiros ${DIAS_TRIAL} dias são gratuitos e não pedimos cartão.`,
          `Depois, R$ ${PRECO_MENSAL} por mês ou R$ ${PRECO_ANUAL} por ano, por igreja.`,
          "O valor cobre servidor e domínio. Não há plano premium: toda igreja usa o sistema inteiro.",
          "Igreja sem condição de pagar pode pedir isenção — sem constrangimento e sem perder funcionalidade.",
          "O pagamento é por Pix e confirmado manualmente. Não guardamos dados de cartão.",
        ]}
      />

      <H>O que acontece se o pagamento atrasar</H>
      <P>
        Existe um período de tolerância com avisos. Passado esse prazo,
        restringimos apenas ações administrativas (como criar novos eventos e
        cadastros). <strong>Escalas e o check-in do LUNOR Kids continuam
        funcionando</strong> — travar a igreja durante um culto seria
        irresponsável, e no Kids teria consequência física.
      </P>

      <H>De quem são os dados</H>
      <P>
        Da igreja. Não vendemos, não cedemos e não usamos os dados da sua
        igreja para outra finalidade que não seja operar o serviço. Você pode
        pedir exportação ou exclusão a qualquer momento — veja a{" "}
        <Link href="/privacidade" className="underline underline-offset-4">
          Política de Privacidade
        </Link>
        .
      </P>

      <H>Responsabilidades da igreja</H>
      <UL
        itens={[
          "Obter o consentimento dos responsáveis antes de cadastrar dados de crianças.",
          "Manter atualizada a lista de quem está autorizado a retirar cada criança.",
          "Conceder acesso apenas a quem de fato serve no ministério.",
          "Não usar o sistema para fins ilícitos nem inserir dados de terceiros sem base legal.",
        ]}
      />

      <H>Nossas responsabilidades e limites</H>
      <P>
        Trabalhamos para manter o serviço disponível, seguro e com rotinas de
        proteção de dados, mas ele é fornecido &quot;como está&quot;. Não garantimos
        funcionamento ininterrupto — falhas de internet, de provedores de
        infraestrutura e erros de software acontecem. O LUNOR é uma ferramenta
        de apoio: a responsabilidade pela guarda das crianças e pela condução
        dos cultos permanece integralmente da igreja.
      </P>

      <H>Encerramento</H>
      <P>
        A igreja pode encerrar o uso quando quiser. Podemos suspender contas
        que violem estes termos ou que coloquem em risco os dados de outras
        igrejas. Em qualquer caso, os dados podem ser exportados antes da
        exclusão.
      </P>

      <H>Mudanças</H>
      <P>
        Se estes termos mudarem de forma relevante, avisaremos pelo próprio
        sistema antes de a mudança valer.
      </P>

      <Nota>
        Documento escrito para ser claro e honesto — não substitui orientação
        jurídica. Para uma igreja com exigências específicas, vale a leitura de
        um advogado.
      </Nota>
    </Doc>
  );
}
