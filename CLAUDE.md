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

- Sem conta e sem login visível. O acesso é compartilhado por link.
- O link é por casa, não por lista: ao criar uma casa, o app gera um código longo e aleatório na URL (ex.: `/c/x7Kp9...`). Todas as listas (atuais e antigas) ficam dentro dela. Quem tem o link edita tudo; o código funciona como senha.
- Por baixo, cada celular usa login anônimo do Supabase (automático, sem tela). Ao abrir o link, o app chama `join_home(code)` e o celular vira membro da casa. As regras de segurança por linha (RLS) liberam os dados só para membros, e o Realtime respeita essas regras.
- Decisão provisória: depois dos testes de uso, a autora avisa se será preciso mudar (por exemplo, para login).

## Modelo de dados

Migrações em `supabase/migrations/`.

- `homes`: código secreto e nome. Criada via `create_home(name)`.
- `home_members`: quais usuários (anônimos) acessam cada casa. Entrada via `join_home(code)`.
- `lists`: listas da casa (nome, aberta/finalizada).
- `items`: planejamento (nome, categoria, medida, quantidade desejada, preço previsto) e compra (status, quantidade comprada, preço unitário, medida real, opção escolhida).
- `options`: opções de um item (marca, medida, preço).

Decisões:
- Unidades de medida: `g`, `kg`, `ml`, `L`, `un`. Para R$/kg e R$/L, g vira kg e ml vira L no navegador.
- Categorias: lista fixa no código (Hortifruti, Carnes, Laticínios, Padaria, Mercearia, Bebidas, Limpeza, Higiene, Congelados, Outros), guardada como texto.
- Último preço pago: buscado pelo nome do item na compra mais recente da casa (sem catálogo de produtos).
- Reaproveitar lista: copia os itens de uma lista antiga para uma nova.
- `items` e `options` têm duas ligações (opção pertence ao item; item aponta a opção escolhida). Ao buscar opções junto com itens, usar `options!options_item_id_fkey(...)`.

## Identidade visual

Paleta base (coolors.co/086788-07a0c3-f0c808-fff1d0-dd1c1a), com escalas de tons definidas em `src/index.css` (`@theme` do Tailwind). Estilo moderno/futurista.

- `sapphire` (#086788): cor principal (títulos, botões principais, cabeçalho).
- `lagoon` (#07A0C3): acento interativo (links, foco, tempo real); degradê com `sapphire`.
- `jonquil` (#F0C808): destaques (total, opção mais barata).
- `papaya` (#FFF1D0): fundo e superfícies.
- `cherry` (#DD1C1A): alertas e ações destrutivas (real acima do previsto, apagar).
- Fonte: Space Grotesk. Cantos bem arredondados, degradês e brilhos sutis.

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
