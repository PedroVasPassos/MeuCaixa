# Meu Caixa

🚧 **Em desenvolvimento**

O Meu Caixa é uma aplicação web de controle financeiro pessoal desenvolvida com React e Vite.

O projeto tem como objetivo facilitar a organização das finanças do dia a dia, permitindo registrar receitas e despesas, acompanhar o saldo disponível e controlar o dinheiro guardado em investimentos.

A interface possui modos claro e escuro e foi pensada para apresentar as informações financeiras de forma simples e fácil de entender.

## Funcionalidades

- Cadastro, edição e exclusão de receitas e despesas
- Organização dos gastos por categorias
- Acompanhamento do saldo disponível
- Resumo de receitas e despesas mensais
- Gráficos e relatórios de gastos
- Cadastro e acompanhamento de investimentos
- Registro de depósitos e retiradas de dinheiro investido
- Planejamento financeiro e metas pessoais
- Exportação de movimentações em CSV
- Backup e restauração dos dados em JSON
- Alternância entre tema claro e escuro

## Tecnologias utilizadas

- **React** — desenvolvimento da interface
- **JavaScript** — lógica e funcionalidades
- **Vite** — ambiente de desenvolvimento
- **CSS** — estilização e responsividade
- **LocalStorage** — armazenamento local dos dados

## Como executar

Para rodar o projeto, é necessário ter o Node.js instalado.

Clone o repositório:

```bash
git clone https://github.com/PedroVasPassos/MeuCaixa.git
```

Entre na pasta do projeto:

```bash
cd MeuCaixa
```

Instale as dependências:

```bash
npm install
```

Inicie o servidor:

```bash
npm run dev
```

Depois, abra o endereço informado no terminal.

Para executar os testes:

```bash
npm test
```

## Investimentos

O Meu Caixa também permite acompanhar valores guardados em investimentos, como CDBs.

É possível cadastrar o investimento, informar a taxa contratada, registrar novos depósitos e retiradas e atualizar o saldo conforme os valores apresentados pela instituição financeira.

Atualmente, o acompanhamento dos rendimentos é manual. O sistema ainda não realiza consultas automáticas às instituições financeiras nem calcula a rentabilidade com base nas taxas de mercado.

## Próximas etapas

- [ ] Integração com Supabase e PostgreSQL
- [ ] Sistema de cadastro e login
- [ ] Armazenamento e sincronização dos dados na nuvem
- [ ] Melhorias na interface e na experiência do usuário
- [ ] Aprimoramento do acompanhamento de investimentos
- [ ] Publicação de uma versão estável

## Observações

O projeto ainda está em desenvolvimento e utiliza o armazenamento local do navegador. Por isso, os dados não são sincronizados entre dispositivos.

É possível exportar um backup para evitar a perda das informações.

O Meu Caixa é um projeto pessoal de aprendizado e organização financeira, não substituindo os extratos e informações oficiais das instituições financeiras.
