# Meu Caixa — versão mais simples

🚧 Projeto em desenvolvimento (MVP)

Aplicação de controle financeiro pessoal desenvolvida com React e Vite. Atualmente possui gerenciamento de receitas, despesas e investimentos, com armazenamento local.
Próximas etapas: integração com Supabase, autenticação, sincronização dos dados e melhorias na experiência do usuário.
Projeto React + Vite com dois temas: **grafite azulado** (escuro) e **marfim** (claro).

## Comece aqui

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite. Para testar os cálculos financeiros:

```bash
npm test
```

## O que foi mudado

- **Uma única navegação** no topo, sem menus duplicados.
- **Um único botão de tema**, no canto superior direito (claro/escuro).
- Tipografia de valores corrigida: números em fonte sem serifa, espaçamento natural, sem distorção.
- Home editorial: saldo disponível como prioridade, entradas/saídas claras, últimos lançamentos e dinheiro guardado.
- Campos e botões em linguagem simples: **Anotar gasto**, **Recebi dinheiro**, **Guardei mais**, **Retirei dinheiro**, **Conferir saldo**.
- O antigo botão “Rendimento” foi substituído por **Conferir saldo**. Basta olhar quanto aparece no banco e informar esse total; o sistema lança a diferença (pode ser um rendimento, uma taxa ou outro ajuste).
- Os 103% do CDI ficam cadastrados como **taxa contratada**, sem cálculo automático fictício.
- Aportes e resgates são transferências: não alteram receitas/despesas, mas alteram dinheiro na conta e dinheiro guardado.
- Versão mantém a chave local do projeto anterior (`meu-caixa-dual-v3`) para aproveitar dados, caso seja executada na mesma origem do navegador.

## Para usar com suas finanças reais

1. Clique em **Começar com meus dados**, para remover a demonstração.
2. Em **Ajustes**, informe quanto tem disponível na conta **sem incluir o CDB**, e a data inicial de acompanhamento.
3. Em **Dinheiro guardado**, cadastre o CDB PagBank. Digite quanto já estava lá na data escolhida — não vai sair da sua conta novamente.
4. Quando gastar, use **Anotar gasto**. Quando receber salário, use **Recebi dinheiro**.
5. Quando transferir da conta para o CDB, use **Guardei mais**; quando tirar, use **Retirei dinheiro**.
6. Para conferir o valor que o CDB mostra no banco, use **Conferir saldo**.
7. Em **Ajustes**, faça backup JSON regularmente.

## Limitações importantes

- Dados **somente no navegador** (localStorage). Sem Supabase/login ainda.
- Não há conexão com PagBank, consulta automática de CDI ou cálculo automático de impostos. A taxa % CDI é uma descrição do investimento.
- **Conferência de saldo não mede isoladamente os juros líquidos:** diferença entre valor mostrado e valor registrado pode resultar de movimentações não lançadas, impostos e tarifas. Registre aportes e retiradas primeiro.
- Valor disponível é calculado a partir de saldo inicial + entradas − despesas − transferências ao CDB + retiradas, **até a data de hoje**.
- As metas são ilustrativas: não transferem dinheiro automaticamente.
- Use o extrato do banco como fonte de verdade; o app ajuda a organizar os registros, mas não substitui o extrato.

## Estrutura

- `src/App.jsx`: interface, navegação, formulários.
- `src/App.css`: design dos dois temas, responsividade.
- `src/lib/finance.js`: cálculos testáveis e formatação.
- `src/lib/storage.js`: leitura, normalização, demonstração e migração de dados.
- `tests/finance.test.mjs`: testes do fluxo de dinheiro.
- `docs/`: documentação e prévias.

## Prévia do design

As imagens em `docs/preview-dark.png`, `docs/preview-light.png` e `docs/preview-mobile.png` são **composições estáticas feitas com o CSS do projeto e dados de exemplo**; não substituem a validação do React no seu navegador.
