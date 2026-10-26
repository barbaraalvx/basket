# basket

Webapp de lista de compras de supermercado, com cálculo automático do total durante a ida ao mercado.

Descrição curta do repo: "Lista de compras com cálculo automático do total durante a ida ao supermercado."

## Contexto

- Usado por duas pessoas (a autora e a esposa), ao mesmo tempo, em celulares diferentes.
- Uso típico: uma pessoa atualiza o checklist (marca itens, preenche quantidades e preços) e a outra calcula o valor final e compara tamanhos/opções. As duas decidem juntas o que levar.
- Nome segue o padrão dos outros webapps da autora (trackr, ledge, finapp): uma palavra, em inglês, minúscula.
- Idioma da interface e dos textos: português do Brasil.

## Funcionalidades

**Lista (em casa ou no mercado)**
- Item com nome, medida (2 L, 500 g etc.), quantidade desejada, categoria e preço previsto (opcional).
- Visão de pendentes e comprados, agrupada por categoria.

**Compra (no mercado)**
- Marcar item como comprado, informando quantidade comprada, preço unitário e medida real.
- Subtotal por item e total geral calculados automaticamente.
- Total estimado vs. total real.

**Comparar opções**
- Para um mesmo item, cadastrar várias opções (marca, tamanho, preço).
- Calcular o preço por unidade de medida (R$/kg, R$/L), destacar a mais barata e permitir escolher qual vai para o carrinho.
- A escolha aparece na hora para as duas pessoas.

**Uso em dupla**
- Sincronização em tempo real: o que uma altera aparece no outro celular sem recarregar a página.

**Histórico**
- Listas antigas para reaproveitar.
- Último preço pago de cada produto.

**Fora do escopo**
- Modo offline / PWA (não faz parte do caso de uso).
- Contas e login (ver abaixo).

## Acesso e compartilhamento

- Sem conta e sem login. A lista é compartilhada por link.
- Ao criar uma lista, o app gera um código longo e aleatório na URL (ex.: `/l/x7Kp9...`). Quem tem o link edita a lista; o código funciona como senha.
- O código precisa ser difícil de adivinhar, e o banco deve limitar o acesso aos dados de cada lista a quem tem o código (ex.: regras de segurança por linha no Supabase).
- Decisão provisória: depois dos testes de uso, a autora avisa se será preciso mudar (por exemplo, para login).

## Stack

- Frontend: React + Vite.
- Banco e tempo real: Supabase (Postgres + Realtime), plano gratuito.
- Hospedagem: Vercel, com deploy automático a cada push no GitHub.
- Cálculos (subtotal, total, R$/kg, R$/L): feitos no navegador, sem backend próprio.

Detalhes de implementação (modelo de dados, estrutura de pastas, telas) ainda serão definidos em conversa com a autora.

## Como trabalhar neste repo

- A autora costuma acompanhar a sessão pelo celular (Remote Control). Prefira respostas curtas e diretas, e explique o raciocínio antes da conclusão.
- Antes de tomar decisões de implementação que não estejam acima, pergunte.
- Mantenha o código simples e legível. É um app pequeno.
