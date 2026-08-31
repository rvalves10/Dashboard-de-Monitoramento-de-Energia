-- esquema.sql — o banco do Solaris no Supabase
--
-- COMO USAR: Supabase -> seu projeto -> SQL Editor -> New query -> cole este
-- arquivo inteiro -> Run. Pode rodar de novo quantas vezes quiser: tudo aqui
-- e "create if not exists" e os dados da regiao sao regravados por cima.
--
-- ANTES DE RODAR, em Authentication -> Providers -> Email:
--   * deixe "Enable email provider" ligado;
--   * para o teste de campo, DESLIGUE "Confirm email". Com a confirmacao
--     ligada, a pessoa cria a conta e nao consegue entrar ate clicar num
--     link no e-mail — e no teste de campo isso derruba metade dos
--     participantes. Em producao, ligue de volta.
--
-- ============================================================
-- A IDEIA GERAL
--
-- Sao dois blocos de tabela, com regras opostas de proposito:
--
--   DADOS DA PESSOA (perfis, estado, leituras, perfil_conversa, conversas)
--   Cada linha carrega o dono. O RLS so devolve as linhas de quem esta
--   autenticado. Ninguem le a casa de ninguem, nem com a chave anon na mao.
--
--   CONHECIMENTO DA REGIAO (distribuidoras, cidades)
--   Leitura liberada para todo mundo, escrita para ninguem pelo site. Nao ha
--   nada de privado em saber que Sorocaba e atendida pela CPFL Piratininga —
--   e o assistente de IA precisa ler isso do banco para responder direito.
--
-- POR QUE A REGIAO ESTA NO BANCO E TAMBEM EM dados/regiao-sorocaba.js:
-- o site le do arquivo JS porque assim funciona offline e sem ida ao
-- servidor; a Edge Function le do banco porque assim da para corrigir um
-- telefone sem publicar o site de novo.
--
-- E COMO OS DOIS NAO DIVERGEM: so um deles e escrito a mao. A fonte e o
-- arquivo JS; o bloco de dados la embaixo e GERADO por
-- backend/ferramentas/gerar-regiao-sql.mjs. Mudou a regiao? Mude o JS, rode
-- o gerador e cole este arquivo de novo no SQL Editor.
-- ============================================================


-- ============================================================
-- 1. DADOS DA PESSOA
-- ============================================================

-- Espelho publico do usuario. auth.users e do Supabase e nao da para
-- consultar do navegador; esta tabela existe para o site saber o nome de
-- quem entrou sem precisar de permissao de administrador.
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  email       text,
  criado_em   timestamptz not null default now()
);

-- Tudo que a pessoa configurou: unidades, aparelhos, metas, tarifa, tela
-- aberta. Uma linha por conta, um jsonb dentro.
--
-- Por que jsonb e nao vinte colunas: este objeto e o estado da interface e
-- muda a cada sprint. Como coluna, cada campo novo viraria uma migracao e um
-- deploy fora de hora. Como jsonb, o formato e definido em um lugar so
-- (PADRAO, em backend/motor.js) e o banco so guarda.
create table if not exists public.estado (
  conta       uuid primary key references auth.users(id) on delete cascade,
  dados       jsonb not null default '{}'::jsonb,
  em          timestamptz not null default now()
);

-- O historico do medidor: uma linha por minuto, por conta.
-- E a tabela que justifica existir um banco neste projeto.
create table if not exists public.leituras (
  id          bigint generated always as identity primary key,
  conta       uuid not null references auth.users(id) on delete cascade,
  t           timestamptz not null default now(),
  c           numeric(9,3) not null,   -- consumo naquele minuto, em kW
  g           numeric(9,3) not null    -- geracao naquele minuto, em kW
);

-- O indice e por (conta, t) porque toda consulta do site e "as leituras
-- DESTA conta a partir DESTE instante". Sem ele, o Postgres varre a tabela
-- inteira para desenhar o grafico das ultimas duas horas.
create index if not exists leituras_conta_t on public.leituras (conta, t desc);

-- O papo rapido do cadastro: como esta pessoa quer ser tratada.
-- E daqui que sai o tom do assistente. Fica em tabela propria, e nao dentro
-- de estado.dados, porque quem le isto e a Edge Function no servidor — e ela
-- nao deveria precisar carregar o estado inteiro da interface para saber que
-- a pessoa prefere ser chamada de "voce" e nao entende de kWh.
create table if not exists public.perfil_conversa (
  conta       uuid primary key references auth.users(id) on delete cascade,
  respostas   jsonb not null default '{}'::jsonb,
  resumo      text,
  em          timestamptz not null default now()
);

-- O historico da conversa com o assistente. Serve para duas coisas: a pessoa
-- reabrir o site e continuar de onde parou, e o assistente lembrar do que ja
-- foi dito sem a pessoa repetir.
create table if not exists public.conversas (
  id          bigint generated always as identity primary key,
  conta       uuid not null references auth.users(id) on delete cascade,
  papel       text not null check (papel in ('pessoa', 'assistente')),
  texto       text not null,
  em          timestamptz not null default now()
);
create index if not exists conversas_conta_em on public.conversas (conta, em desc);


-- ============================================================
-- 2. CONHECIMENTO DA REGIAO
-- ============================================================

create table if not exists public.distribuidoras (
  id            text primary key,
  nome          text not null,
  grupo         text,
  area          text,
  clientes      text,
  reajuste_mes  smallint,   -- mes do reajuste anual (1-12)
  vigencia      text,
  telefone      text,
  site          text,
  emergencia    text,
  notas         text
);

create table if not exists public.cidades (
  id               text primary key,
  nome             text not null,
  uf               char(2) not null default 'SP',
  populacao        integer,          -- IBGE 2022, arredondado ao milhar
  distancia_km     integer,          -- ate o centro de Sorocaba
  distribuidora_id text references public.distribuidoras(id),
  perfil           text,
  nota             text,
  -- irradiacao global horizontal, kWh/m² por dia, de janeiro a dezembro
  irradiacao       numeric(4,2)[] not null default
                   '{5.6,5.8,5.2,4.7,4.0,3.7,3.9,4.7,4.8,5.3,5.7,6.0}'
);


-- Quais avisos por e-mail ja foram mandados para cada conta.
--
-- Existe por uma razao so: nao mandar o mesmo aviso duas vezes. Um sistema
-- que avisa "voce vai estourar a meta" todo dia durante duas semanas nao
-- avisa nada — vira spam, a pessoa cria uma regra no e-mail e nunca mais le
-- nenhum aviso nosso, inclusive os que importam.
create table if not exists public.avisos_enviados (
  id          bigint generated always as identity primary key,
  conta       uuid not null references auth.users(id) on delete cascade,
  tipo        text not null,        -- 'meta' por enquanto
  referencia  text not null,        -- o que identifica o caso: '2026-08'
  em          timestamptz not null default now(),
  unique (conta, tipo, referencia)
);

-- ============================================================
-- 3. SEGURANCA (RLS)
--
-- Sem isto, a chave anon que vai no navegador leria o banco inteiro. Ligue
-- primeiro, crie a politica depois: tabela com RLS ligado e sem politica
-- nenhuma nao devolve nada, que e o lado seguro de errar.
-- ============================================================

alter table public.perfis          enable row level security;
alter table public.estado          enable row level security;
alter table public.leituras        enable row level security;
alter table public.perfil_conversa enable row level security;
alter table public.conversas       enable row level security;
alter table public.avisos_enviados enable row level security;
alter table public.distribuidoras  enable row level security;
alter table public.cidades         enable row level security;

-- Um bloco por tabela. "for all ... using ... with check" cobre select,
-- insert, update e delete de uma vez: using filtra o que ja existe, with
-- check impede gravar linha com o dono trocado.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'perfis' and policyname = 'perfil proprio') then
    create policy "perfil proprio" on public.perfis
      for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'estado' and policyname = 'estado proprio') then
    create policy "estado proprio" on public.estado
      for all to authenticated using (auth.uid() = conta) with check (auth.uid() = conta);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'leituras' and policyname = 'leituras proprias') then
    create policy "leituras proprias" on public.leituras
      for all to authenticated using (auth.uid() = conta) with check (auth.uid() = conta);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'perfil_conversa' and policyname = 'perfil de conversa proprio') then
    create policy "perfil de conversa proprio" on public.perfil_conversa
      for all to authenticated using (auth.uid() = conta) with check (auth.uid() = conta);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'conversas' and policyname = 'conversa propria') then
    create policy "conversa propria" on public.conversas
      for all to authenticated using (auth.uid() = conta) with check (auth.uid() = conta);
  end if;

  -- So leitura, e so os proprios: quem manda o aviso e a funcao agendada,
  -- que roda com chave de servico e passa por cima do RLS de proposito.
  if not exists (select 1 from pg_policies where tablename = 'avisos_enviados' and policyname = 'avisos proprios') then
    create policy "avisos proprios" on public.avisos_enviados
      for select to authenticated using (auth.uid() = conta);
  end if;

  -- Conhecimento da regiao: qualquer um le, ninguem escreve pelo site.
  -- Para corrigir um dado, use o SQL Editor (que roda como dono da tabela).
  if not exists (select 1 from pg_policies where tablename = 'distribuidoras' and policyname = 'regiao e publica') then
    create policy "regiao e publica" on public.distribuidoras
      for select to anon, authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'cidades' and policyname = 'cidades sao publicas') then
    create policy "cidades sao publicas" on public.cidades
      for select to anon, authenticated using (true);
  end if;
end $$;


-- ============================================================
-- 4. CONTA NOVA JA NASCE COM PERFIL
--
-- Sem este gatilho, a linha em perfis dependeria de o navegador lembrar de
-- criar — e se a aba fechasse no meio do cadastro, a conta ficaria sem nome
-- para sempre. O banco resolve isso sozinho, no mesmo instante do cadastro.
-- ============================================================

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();


-- ============================================================
-- 5. PODA DO HISTORICO
--
-- No navegador, cada aba podava o proprio banco na abertura. Aqui isso seria
-- N clientes brigando pela mesma tabela, entao a poda e trabalho do servidor.
--
-- Rode a mao quando quiser (select public.podar_leituras();) ou agende:
--   Supabase -> Database -> Extensions -> ligue pg_cron, e depois
--   select cron.schedule('podar-solaris', '0 4 * * *', 'select public.podar_leituras()');
--
-- 90 dias em vez dos 7 do navegador: no Postgres cabe, e tres meses de
-- historico e o que permite comparar um mes com o mesmo mes do trimestre.
-- ============================================================

create or replace function public.podar_leituras()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  apagadas integer;
begin
  delete from public.leituras where t < now() - interval '90 days';
  get diagnostics apagadas = row_count;
  return apagadas;
end;
$$;


-- ============================================================
-- 6. A REGIAO DE SOROCABA  (bloco gerado — nao edite a mao)
--
-- De onde vem cada coisa esta explicado em dados/regiao-sorocaba.js, que e a
-- fonte deste bloco. Em resumo: concessao pelas listas da ARSESP e paginas do
-- Grupo CPFL e da Neoenergia (agosto/2026); populacao pelo Censo 2022 do
-- IBGE, arredondada ao milhar; irradiacao como UMA serie para a regiao
-- inteira, porque a diferenca real entre cidades vizinhas e menor que a
-- incerteza da medida.
--
-- Tarifa NAO esta aqui de proposito: muda todo ano e varia por bandeira e
-- por classe. O sistema le a tarifa da conta de luz da propria pessoa, que e
-- o unico numero certo. O que guardamos e QUANDO ela e reajustada.
-- ============================================================

-- >>> GERADO POR backend/ferramentas/gerar-regiao-sql.mjs — NAO EDITE A MAO
-- A fonte e banco-de-dados/dados/regiao-sorocaba.js. Mude la e rode de novo:
--   node backend/ferramentas/gerar-regiao-sql.mjs

insert into public.distribuidoras
  (id, nome, grupo, area, clientes, reajuste_mes, vigencia, telefone, site, emergencia, notas)
values
('cpfl-piratininga', 'CPFL Piratininga', 'Grupo CPFL Energia (State Grid)', '27 municípios do interior e do litoral de São Paulo, incluindo Sorocaba, Jundiaí e Santos', '1,7 milhão de unidades consumidoras, sendo mais de 300 mil em Sorocaba', 10, 'de 23 de outubro a 22 de outubro do ano seguinte', '0800 010 1010', 'https://www.cpfl.com.br/piratininga', 'Falta de energia pelo 0800 010 1010, pelo app CPFL Energia ou por SMS', 'Reajuste anual homologado pela ANEEL em outubro. A agência de atendimento presencial de Sorocaba mudou de endereço recentemente — confirme no site antes de ir.'),
('cpfl-santa-cruz', 'CPFL Santa Cruz', 'Grupo CPFL Energia (State Grid)', '45 municípios em três estados — 39 em São Paulo, 3 no Paraná e 3 em Minas Gerais — cobrindo 20.249 km²', 'mais de 500 mil unidades consumidoras', 2, 'anual, em fevereiro', '0800 701 0102', 'https://www.cpfl.com.br/santa-cruz', 'Falta de energia pelo 0800 701 0102 ou pelo app CPFL Energia', 'Mesmo grupo da Piratininga, mas concessão e tarifa separadas: quem mora em Sarapuí não paga a mesma tarifa de quem mora em Sorocaba.'),
('neoenergia-elektro', 'Neoenergia Elektro', 'Grupo Neoenergia (Iberdrola)', 'municípios do interior de São Paulo e do Mato Grosso do Sul', 'atende parte da região de Sorocaba pelo lado leste e sul', 8, 'anual, em agosto', '0800 701 0102', 'https://www.neoenergia.com/web/sp', 'Falta de energia pelo 0800 701 0102, pelo site ou pelo WhatsApp da distribuidora', 'Antiga Elektro. Confirme o número de atendimento na sua fatura: a Neoenergia usa centrais diferentes por estado.')
on conflict (id) do update set
  nome = excluded.nome, grupo = excluded.grupo, area = excluded.area,
  clientes = excluded.clientes, reajuste_mes = excluded.reajuste_mes,
  vigencia = excluded.vigencia, telefone = excluded.telefone,
  site = excluded.site, emergencia = excluded.emergencia, notas = excluded.notas;

insert into public.cidades
  (id, nome, uf, populacao, distancia_km, distribuidora_id, perfil, nota)
values
('sorocaba', 'Sorocaba', 'SP', 687000, 0, 'cpfl-piratininga', 'Capital regional, quarta maior cidade do interior paulista. Forte indústria metalúrgica e de autopeças, comércio grande e muita casa de alvenaria com laje. Sede da Região Metropolitana de Sorocaba.', 'Cidade com mais de 300 mil unidades consumidoras da CPFL Piratininga.'),
('votorantim', 'Votorantim', 'SP', 124000, 8, 'cpfl-piratininga', 'Colada em Sorocaba, historicamente industrial (cimento e metalurgia). Bairros residenciais grandes e muita casa com telhado de duas águas.', 'Na prática funciona como um bairro de Sorocaba para efeito de rede elétrica.'),
('aracoiaba-da-serra', 'Araçoiaba da Serra', 'SP', 40000, 22, 'cpfl-piratininga', 'Cidade de chácaras e condomínios, muita área rural. Sem gás encanado na maior parte, o que joga chuveiro elétrico e aquecimento para cima da conta de luz.', 'Perfil clássico para solar: telhado grande, terreno amplo, pouca sombra de prédio.'),
('salto-de-pirapora', 'Salto de Pirapora', 'SP', 46000, 26, 'cpfl-piratininga', 'Mistura de área urbana pequena e zona rural com sítios. Bombeamento de água pesa na conta de quem mora fora do centro.', 'Bomba d’água costuma ser o aparelho invisível que ninguém lembra de cadastrar.'),
('ipero', 'Iperó', 'SP', 35000, 28, 'cpfl-piratininga', 'Cidade pequena com forte presença rural e a Fábrica de Aramar por perto. Consumo residencial concentrado de manhã e à noite.', null),
('capela-do-alto', 'Capela do Alto', 'SP', 21000, 30, 'cpfl-piratininga', 'Cidade pequena, agricultura e pequenas indústrias. Muita residência unifamiliar com telhado amplo.', null),
('aluminio', 'Alumínio', 'SP', 18000, 28, 'cpfl-piratininga', 'Cidade formada em volta da indústria de alumínio. Base residencial pequena e concentrada.', null),
('mairinque', 'Mairinque', 'SP', 48000, 32, 'cpfl-piratininga', 'Serra, clima mais ameno e mais nublado que Sorocaba. Ferroviária de origem, hoje dormitório e chácaras.', 'Região de serra: dias encobertos são mais frequentes, e o sistema solar rende um pouco menos que no vale.'),
('sao-roque', 'São Roque', 'SP', 91000, 40, 'cpfl-piratininga', 'Turismo, vinícolas e restaurantes. Muito pequeno negócio com câmara fria e cozinha elétrica, que é o perfil onde a conta de luz mais dói.', 'Restaurante e adega: refrigeração roda 24 h e domina a fatura.'),
('aracariguama', 'Araçariguama', 'SP', 20000, 45, 'cpfl-piratininga', 'Cidade pequena às margens da Castello Branco, com galpões e logística.', null),
('ibiuna', 'Ibiúna', 'SP', 76000, 55, 'cpfl-piratininga', 'Maior área rural da região, cinturão verde de hortaliças. Muita propriedade com irrigação, estufa e câmara fria — consumo bem diferente do urbano.', 'Região de serra e neblina: a geração real costuma ficar abaixo do que a média do interior sugere.'),
('itu', 'Itu', 'SP', 175000, 50, 'cpfl-piratininga', 'Cidade histórica com indústria e muitos condomínios fechados de alto padrão. Consumo residencial alto: ar-condicionado, piscina aquecida e bomba.', 'Piscina com bomba e aquecimento é um dos maiores consumos escondidos em condomínio.'),
('salto', 'Salto', 'SP', 121000, 55, 'cpfl-piratininga', 'Industrial e residencial, colada em Itu. Base têxtil e metalúrgica.', null),
('porto-feliz', 'Porto Feliz', 'SP', 53000, 45, 'cpfl-piratininga', 'Agroindústria, cana e usinas. Área rural grande com consumo sazonal.', null),
('boituva', 'Boituva', 'SP', 63000, 35, 'cpfl-piratininga', 'Crescimento rápido em loteamentos e condomínios, capital do paraquedismo. Muita construção nova, que já sai preparada para solar.', 'Casa nova com telhado limpo e sem sombra é o melhor caso de instalação da região.'),
('piedade', 'Piedade', 'SP', 55000, 40, 'neoenergia-elektro', 'Agrícola, forte em fruticultura (caqui e uva). Propriedades rurais com bomba, câmara fria e secador.', 'ATENÇÃO: aqui a distribuidora NÃO é a CPFL. É Neoenergia Elektro, com tarifa e reajuste próprios.'),
('tatui', 'Tatuí', 'SP', 120000, 55, 'neoenergia-elektro', 'Cidade média, conhecida pelo conservatório de música. Comércio de rua forte e indústria leve.', 'ATENÇÃO: distribuidora Neoenergia Elektro, não CPFL.'),
('sarapui', 'Sarapuí', 'SP', 10000, 40, 'cpfl-santa-cruz', 'Cidade pequena, base rural e pecuária.', 'ATENÇÃO: é CPFL, mas é a CPFL SANTA CRUZ — concessão, tarifa e mês de reajuste diferentes dos de Sorocaba.'),
('itapetininga', 'Itapetininga', 'SP', 157000, 70, 'cpfl-santa-cruz', 'Polo regional ao sul, agropecuária e indústria de papel e celulose.', 'ATENÇÃO: CPFL Santa Cruz, não Piratininga.'),
('sao-miguel-arcanjo', 'São Miguel Arcanjo', 'SP', 33000, 65, 'cpfl-santa-cruz', 'Agrícola, fruticultura e turismo rural na divisa do Parque Estadual Carlos Botelho.', null)
on conflict (id) do update set
  nome = excluded.nome, populacao = excluded.populacao,
  distancia_km = excluded.distancia_km, distribuidora_id = excluded.distribuidora_id,
  perfil = excluded.perfil, nota = excluded.nota;
-- <<< FIM DO BLOCO GERADO


-- Confere se deu tudo certo.
select
  (select count(*) from public.distribuidoras) as distribuidoras,
  (select count(*) from public.cidades)        as cidades,
  (select count(*) from pg_policies where schemaname = 'public') as politicas_rls,
  (select count(*) from information_schema.tables
     where table_schema = 'public') as tabelas;
