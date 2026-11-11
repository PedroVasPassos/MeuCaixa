# Regras financeiras e arquitetura v4

O app mantém `localStorage` com a chave `meu-caixa-dual-v3` para migrar sem apagar os dados da versão anterior, caso executado na mesma origem.

## Registros

- `receita`: aumenta a conta, integra receita do mês.
- `despesa`: diminui a conta, integra gasto do mês.
- `aporte`: diminui a conta e aumenta o CDB; não entra nas despesas.
- `resgate`: aumenta a conta e diminui o CDB; não entra nas receitas.
- `rendimento`: usado internamente como **conferência/ajuste de saldo**, não equivale necessariamente a juros líquidos. Esse tipo foi mantido para compatibilidade com a versão antiga.

## Primeira utilização

O cadastro inicial do CDB representa o dinheiro que já estava guardado antes do acompanhamento. O valor inicial da conta **não** deve incluir essa aplicação.

## Conferir saldo

Depois de lançar as transferências, o usuário informa o valor total mostrado no aplicativo do banco. O sistema calcula `diferença = saldo_no_banco - saldo_registrado` e adiciona **apenas essa diferença** (positiva ou negativa). Conferir o mesmo saldo duas vezes não duplica o ajuste.

## Segurança dos dados

Dados ficam somente no navegador. Exportação/importação de backup JSON disponível em Ajustes. Supabase, autenticação, sincronização entre dispositivos, integração bancária, rendimento automático de CDI e impostos ainda **não** estão implementados.

## Dados e interfaces

`src/lib/finance.js` — cálculos puros. `src/lib/storage.js` — normalização e leitura local. `src/App.jsx` — interface e operações. `src/App.css` — tokens e layout.
