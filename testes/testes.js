/* ============================================================
   SOLARIS — testes do motor
   Roda no navegador, sem dependência. Abra testes/index.html.

   O que se testa aqui é o que a banca pode questionar: se a energia
   fecha, se o ranking bate com o medidor, se a lei foi aplicada e se
   o sistema não quebra em datas de borda.
   ============================================================ */
'use strict';

const T = { casos: [], grupo: '' };
function grupo(nome, fn) { T.grupo = nome; fn(); }
function teste(nome, fn) {
  const g = T.grupo;
  try {
    fn();
    T.casos.push({ grupo: g, nome: nome, ok: true });
  } catch (e) {
    T.casos.push({ grupo: g, nome: nome, ok: false, erro: e.message });
  }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'esperava verdadeiro'); }
function igual(a, b, msg) {
  if (a !== b) throw new Error((msg || 'valores diferentes') + ': ' + a + ' ≠ ' + b);
}
function perto(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error((msg || 'fora da tolerância') + ': ' + a + ' vs ' + b + ' (tol ' + tol + ')');
}

/* congela o relógio do motor durante um teste */
const RELOGIO_REAL = agora;
function em(y, m, d, h, mi, fn) {
  agora = () => new Date(y, m, d, h, mi || 0);
  _visao = null; _cacheLedger.clear();
  try { return fn(); } finally { agora = RELOGIO_REAL; _visao = null; _cacheLedger.clear(); }
}
function comPerfil(p, fn) {
  const antes = S.perfil;
  S.perfil = p; _visao = null;
  try { return fn(); } finally { S.perfil = antes; _visao = null; }
}

/* ================= física do medidor ================= */
grupo('Medidor', () => {

  teste('cada hora fecha: autoconsumo + injetado = geração', () => {
    const md = mesSimulado('residencial', 2026, 7);
    md.dias.forEach(dia => {
      let auto = 0, inj = 0;
      for (let h = 0; h < 24; h++) {
        auto += Math.min(dia.cons[h], dia.ger[h]);
        inj += Math.max(0, dia.ger[h] - dia.cons[h]);
      }
      perto(auto + inj, dia.tg, 0.001, 'dia ' + dia.dia);
    });
  });

  teste('cada hora fecha: autoconsumo + rede = consumo', () => {
    const md = mesSimulado('negocio', 2026, 7);
    md.dias.forEach(dia => {
      let auto = 0, rede = 0;
      for (let h = 0; h < 24; h++) {
        auto += Math.min(dia.cons[h], dia.ger[h]);
        rede += Math.max(0, dia.cons[h] - dia.ger[h]);
      }
      perto(auto + rede, dia.tc, 0.001, 'dia ' + dia.dia);
    });
  });

  teste('não há geração antes do nascer nem depois do pôr do sol', () => {
    const md = mesSimulado('residencial', 2026, 5); /* junho, dia curto */
    const dia = md.dias[10];
    igual(dia.ger[2] > 0, false, 'gerando às 2h');
    igual(dia.ger[23] > 0, false, 'gerando às 23h');
    ok(dia.ger[12] > 0, 'não gera ao meio-dia');
  });

  teste('o dia é mais curto em junho que em dezembro', () => {
    const horasLuz = m => {
      const md = mesSimulado('residencial', 2026, m);
      return md.dias[14].ger.filter(g => g > 0.001).length;
    };
    ok(horasLuz(5) < horasLuz(11), 'junho deveria ter menos horas de luz que dezembro');
  });

  teste('a simulação é determinística: mesmo dia, mesmo resultado', () => {
    _cacheMes.clear();
    const a = mesSimulado('residencial', 2026, 7).dias[9].tg;
    _cacheMes.clear();
    const b = mesSimulado('residencial', 2026, 7).dias[9].tg;
    igual(a, b, 'geração mudou entre execuções');
  });

  teste('soma parcial nunca passa da soma cheia', () => {
    const md = mesSimulado('residencial', 2026, 7);
    const meio = ate(md, 15 * 24), cheio = ate(md, null);
    ok(meio.tc <= cheio.tc && meio.tg <= cheio.tg, 'parcial maior que total');
    ok(meio.tc > 0, 'parcial vazia');
  });
});

/* ================= desagregação ================= */
grupo('Aparelhos', () => {

  teste('o ranking fecha exatamente com a projeção do medidor', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      const v = visao(), total = soma(aparelhos().map(e => e.kwh));
      perto(total, v.projConsumo, 0.5, p);
    }));
  });

  teste('continua fechando depois de cadastrar um aparelho', () => {
    const antes = S.extras;
    S.extras = [{
      id: 'teste1', perfil: 'residencial', nome: 'Teste', local: 'Sala', cat: 'Outros',
      pot: 800, horas: 2, dias: 30, cor: '#000', conf: 'alta', fonte: 'manual', tend: 0
    }];
    _visao = null;
    comPerfil('residencial', () => {
      const v = visao(), total = soma(aparelhos().map(e => e.kwh));
      perto(total, v.projConsumo, 0.5);
      ok(aparelhos().some(e => e.nome === 'Teste'), 'aparelho cadastrado sumiu');
    });
    S.extras = antes; _visao = null;
  });

  teste('horas de uso deduzidas batem com o kWh mostrado', () => {
    comPerfil('residencial', () => {
      const v = visao();
      aparelhos().filter(e => !e.sintetico && e.pot > 0).forEach(e => {
        perto((e.pot / 1000) * e.horas * e.dias, e.kwh, 0.01, e.nome);
      });
    });
  });

  teste('remover aparelho joga o consumo para Não identificado', () => {
    const antes = S.removidos;
    comPerfil('residencial', () => {
      _visao = null;
      const nidAntes = (aparelhos().filter(e => e.id === 'nid')[0] || { kwh: 0 }).kwh;
      S.removidos = ['residencial:gel'];
      const nidDepois = (aparelhos().filter(e => e.id === 'nid')[0] || { kwh: 0 }).kwh;
      ok(nidDepois > nidAntes, 'Não identificado não cresceu');
      perto(soma(aparelhos().map(e => e.kwh)), visao().projConsumo, 0.5);
    });
    S.removidos = antes; _visao = null;
  });
});

/* ================= Lei 14.300 ================= */
grupo('Lei 14.300', () => {

  teste('a escada do Fio B segue o texto da lei', () => {
    igual(percentualFioB(2022, false), 0);
    igual(percentualFioB(2023, false), 0.15);
    igual(percentualFioB(2024, false), 0.30);
    igual(percentualFioB(2025, false), 0.45);
    igual(percentualFioB(2026, false), 0.60);
    igual(percentualFioB(2027, false), 0.75);
    igual(percentualFioB(2028, false), 0.90);
    igual(percentualFioB(2029, false), 1);
  });

  teste('direito adquirido não paga Fio B em nenhum ano', () => {
    [2023, 2026, 2030, 2044].forEach(a => igual(percentualFioB(a, true), 0, 'ano ' + a));
  });

  teste('as duas unidades entraram depois do corte, então pagam', () => {
    em(2026, 7, 24, 14, 0, () => {
      ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
        igual(temDireitoAdquirido(p), false, p);
        ok(visao().projFioB > 0, p + ' deveria pagar Fio B');
      }));
    });
  });

  teste('o Fio B incide sobre a energia compensada, não sobre a injetada', () => {
    em(2026, 7, 24, 14, 0, () => comPerfil('residencial', () => {
      const v = visao(), u = unidade(), l = v.linhaAtual;
      perto(l.fioB, l.usado * u.fioB * l.percFioB, 0.01);
      ok(l.usado <= l.inj + 1e6, 'sanidade');
    }));
  });

  teste('o Fio B derruba a economia declarada', () => {
    em(2026, 7, 24, 14, 0, () => comPerfil('residencial', () => {
      const v = visao(), l = v.linhaAtual, u = unidade();
      const semLei = (l.auto + l.usado) * tarifaAtual();
      ok(v.economia < semLei, 'economia deveria ser menor com a lei');
      perto(v.economia, semLei - l.fioB, 0.01);
    }));
  });
});

/* ================= créditos ================= */
grupo('Créditos', () => {

  teste('crédito nunca abate abaixo do mínimo faturável', () => {
    em(2026, 7, 24, 14, 0, () => {
      ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
        const u = unidade();
        visao().ledger.linhas.forEach(l => {
          if (l.rede >= u.minFatura) {
            ok(l.faturado >= u.minFatura - 0.01, p + ': faturou ' + l.faturado.toFixed(1) + ' abaixo do mínimo');
          }
        });
      }));
    });
  });

  teste('saldo de créditos nunca fica negativo', () => {
    em(2026, 7, 24, 14, 0, () => {
      ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
        visao().ledger.linhas.forEach(l => ok(l.creditos >= -0.01, p + ': crédito negativo'));
      }));
    });
  });

  teste('a padaria consome muito mais do que gera, então não acumula crédito', () => {
    em(2026, 7, 24, 14, 0, () => comPerfil('negocio', () => {
      perto(visao().creditos, 0, 1, 'padaria não deveria ter saldo');
    }));
  });

  teste('a casa acumula crédito por causa do mínimo faturável', () => {
    em(2026, 7, 24, 14, 0, () => comPerfil('residencial', () => {
      ok(visao().creditos > 50, 'casa deveria ter saldo relevante');
    }));
  });
});

/* ================= datas de borda ================= */
grupo('Datas', () => {

  const datas = [
    [2026, 8, 1, 0, 20, 'dia 1 de madrugada'],
    [2026, 8, 1, 12, 0, 'dia 1 ao meio-dia'],
    [2026, 8, 15, 12, 0, 'meio do mês'],
    [2026, 8, 30, 23, 59, 'último instante do mês'],
    [2026, 11, 31, 23, 59, 'virada de ano'],
    [2027, 0, 1, 0, 1, 'primeiro minuto do ano'],
    [2028, 1, 29, 12, 0, 'ano bissexto']
  ];

  teste('a projeção do mês é estável em qualquer data', () => {
    const proj = datas.map(d => em(d[0], d[1], d[2], d[3], d[4], () => visao().projConsumo));
    proj.forEach((p, i) => ok(p > 50, datas[i][5] + ': projeção absurda (' + p.toFixed(1) + ')'));
    /* dentro do mesmo mês a projeção não pode variar */
    perto(proj[0], proj[1], 0.01, 'dia 1 madrugada vs meio-dia');
    perto(proj[0], proj[2], 0.01, 'dia 1 vs meio do mês');
    perto(proj[0], proj[3], 0.01, 'dia 1 vs fim do mês');
  });

  teste('o ranking fecha em todas as datas de borda', () => {
    datas.forEach(d => em(d[0], d[1], d[2], d[3], d[4], () => {
      perto(soma(aparelhos().map(e => e.kwh)), visao().projConsumo, 0.5, d[5]);
    }));
  });

  teste('nenhuma tela quebra em nenhuma data', () => {
    datas.forEach(d => em(d[0], d[1], d[2], d[3], d[4], () => {
      ['painel', 'historico', 'equipamentos', 'cadastro', 'alertas', 'relatorio', 'config'].forEach(tela => {
        const antes = S.tela; S.tela = tela;
        try {
          const html = corpoDesktop();
          ok(html.length > 1500, d[5] + '/' + tela + ': html curto');
          ok(!/undefined|NaN|\[object/.test(html), d[5] + '/' + tela + ': valor inválido no html');
        } finally { S.tela = antes; }
      });
    }));
  });

  teste('fevereiro bissexto tem 29 dias simulados', () => {
    igual(mesSimulado('residencial', 2028, 1).nd, 29);
    igual(mesSimulado('residencial', 2027, 1).nd, 28);
  });
});

/* ================= consistência da conta ================= */
grupo('Fatura', () => {

  teste('a conta com painéis é menor que sem painéis', () => {
    em(2026, 7, 24, 14, 0, () => {
      ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
        const v = visao();
        ok(v.contaProj < v.semSolarProj, p + ': solar não economizou');
      }));
    });
  });

  teste('autossuficiência fica entre 0 e 100 por cento', () => {
    em(2026, 7, 24, 14, 0, () => {
      ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
        const a = visao().autoPct;
        ok(a >= 0 && a <= 100, p + ': autoPct = ' + a);
      }));
    });
  });

  teste('tarifa editada muda a conta proporcionalmente', () => {
    em(2026, 7, 24, 14, 0, () => comPerfil('residencial', () => {
      const antes = S.tarifa.residencial;
      S.tarifa.residencial = 0.92; _visao = null;
      const c1 = visao().contaProj;
      S.tarifa.residencial = 1.84; _visao = null;
      const c2 = visao().contaProj;
      ok(c2 > c1 * 1.5, 'dobrar a tarifa deveria subir bem a conta');
      S.tarifa.residencial = antes; _visao = null;
    }));
  });
});

/* ================= unidades do usuário ================= */
grupo('Unidades', () => {

  const RASCUNHO = {
    chave: 'teste-un', nome: 'Casa de Teste', arquetipo: 'casaVazia', telhado: 'bom',
    distribuidora: 'CPFL', tarifa: 1.05, consumoMes: 450,
    potenciaKwp: 4.5, paineis: 11, investimento: 22000, mesesOperacao: 18
  };
  function comUnidade(fn) {
    const antesU = S.unidades, antesP = S.perfil;
    S.unidades = [RASCUNHO];
    S.perfil = RASCUNHO.chave;
    S.metas[RASCUNHO.chave] = 420;
    _visao = null; _cacheMes.clear(); _cacheLedger.clear();
    try { return fn(); } finally {
      S.unidades = antesU; S.perfil = antesP;
      delete S.metas[RASCUNHO.chave];
      _visao = null; _cacheMes.clear(); _cacheLedger.clear();
    }
  }

  teste('número em português: vírgula decimal e ponto de milhar', () => {
    igual(numeroBR('1,05'), 1.05);
    igual(numeroBR('1.05'), 1.05);
    igual(numeroBR('26.000'), 26000);
    igual(numeroBR('1.234,56'), 1234.56);
    igual(numeroBR('1.000.000'), 1000000);
    igual(numeroBR(''), 0);
    igual(numeroBR('abc'), 0);
  });

  teste('a unidade montada tem todos os campos que o motor usa', () => {
    const u = montarUnidade(RASCUNHO);
    ['nome', 'tipo', 'curto', 'distribuidora', 'tarifa', 'tarifaComp', 'fioB', 'ilum',
      'minFatura', 'potenciaKwp', 'paineis', 'investimento', 'mesesOperacao',
      'fatorInstalacao', 'consumoMes', 'geracaoMes', 'metaPadrao', 'consumoH',
      'semana', 'comodos', 'equipamentos', 'deteccoes'].forEach(k => {
        ok(u[k] !== undefined && u[k] !== null, 'faltou o campo ' + k);
      });
    igual(u.consumoH.length, 24, 'curva horária incompleta');
    igual(u.semana.length, 7, 'fatores de semana incompletos');
  });

  teste('a geração é calculada, não digitada', () => {
    const u = montarUnidade(RASCUNHO);
    const irr = soma(IRRADIACAO_SP) / 12;
    perto(u.geracaoMes, RASCUNHO.potenciaKwp * irr * RAZAO_DESEMPENHO * 0.80 * 30, 0.5);
  });

  teste('telhado melhor gera mais que telhado pior', () => {
    const bom = montarUnidade(Object.assign({}, RASCUNHO, { telhado: 'ideal' }));
    const ruim = montarUnidade(Object.assign({}, RASCUNHO, { telhado: 'ruim' }));
    ok(bom.geracaoMes > ruim.geracaoMes * 1.5, 'a condição do telhado não mudou nada');
  });

  teste('cada arquétipo tem curva de 24 horas e shares somando menos de 1', () => {
    Object.keys(ARQUETIPOS).forEach(k => {
      const a = ARQUETIPOS[k];
      igual(a.consumoH.length, 24, k + ': curva incompleta');
      igual(a.semana.length, 7, k + ': semana incompleta');
      const s = soma(a.equipamentos.map(e => e.share));
      ok(s > 0.8 && s < 1, k + ': shares somam ' + s.toFixed(3) + ', deveria sobrar algo para Não identificado');
    });
  });

  teste('unidade criada aparece na lista e é selecionável', () => {
    comUnidade(() => {
      ok(chavesUnidades().indexOf(RASCUNHO.chave) >= 0, 'não entrou na lista');
      igual(unidade().nome, 'Casa de Teste');
    });
  });

  teste('o ranking fecha com o medidor na unidade criada', () => {
    comUnidade(() => {
      perto(soma(aparelhos().map(e => e.kwh)), visao().projConsumo, 0.5);
    });
  });

  teste('nenhuma tela quebra com a unidade criada', () => {
    comUnidade(() => {
      ['painel', 'historico', 'equipamentos', 'cadastro', 'alertas', 'relatorio', 'config', 'unidade'].forEach(tela => {
        const antes = S.tela; S.tela = tela;
        try {
          const html = corpoDesktop();
          ok(html.length > 1500, tela + ': html curto');
          ok(!/undefined|NaN|\[object/.test(html), tela + ': valor inválido no html');
        } finally { S.tela = antes; }
      });
    });
  });

  teste('a unidade criada respeita a Lei 14.300 pela data de ligação', () => {
    em(2026, 7, 24, 14, 0, () => {
      const antesU = S.unidades, antesP = S.perfil;
      /* 18 meses atrás de ago/2026 = mar/2025, depois do corte: paga */
      S.unidades = [RASCUNHO]; S.perfil = RASCUNHO.chave; _visao = null; _cacheLedger.clear();
      igual(temDireitoAdquirido(RASCUNHO.chave), false, 'ligada em 2025 deveria pagar');
      /* 60 meses atrás = 2021, antes do corte: não paga */
      S.unidades = [Object.assign({}, RASCUNHO, { mesesOperacao: 60 })];
      _visao = null; _cacheLedger.clear();
      igual(temDireitoAdquirido(RASCUNHO.chave), true, 'ligada em 2021 tem direito adquirido');
      S.unidades = antesU; S.perfil = antesP; _visao = null; _cacheLedger.clear();
    });
  });

  teste('unidade de demonstração não pode ser removida por engano', () => {
    ok(!UNIDADES_BASE.residencial.propria, 'a de demo não deveria ser marcada como própria');
    ok(montarUnidade(RASCUNHO).propria === true, 'a do usuário deveria ser marcada como própria');
  });
});

/* ================= contas e sessão ================= */
/* Estes precisam de await, então entram numa fila separada que roda
   depois dos síncronos. O armazenamento é salvo antes e restaurado
   depois, para o teste nunca comer os dados de quem estiver usando. */
const ASSINC = [];
function testeAsync(nome, fn) { ASSINC.push({ grupo: T.grupo, nome: nome, fn: fn }); }

grupo('Contas', () => {
  const EMAIL = '__teste__@solaris.local';
  const SENHA = 'senhaDeTeste123';

  /* a conta de teste é removida do banco antes e depois, para os casos
     não contaminarem uns aos outros nem os dados de quem estiver usando */
  async function limpo(fn) {
    const guardaSessao = localStorage.getItem('solaris.sessao.v1');
    const sessaoAntes = sessao();
    const faxina = async () => {
      await Banco.apagarConta(EMAIL);
      await Banco.apagarEstado(EMAIL);
      delete _contas[EMAIL];
    };
    try { await faxina(); sair(); await fn(); }
    finally {
      await faxina();
      sair();
      if (guardaSessao === null) localStorage.removeItem('solaris.sessao.v1');
      else localStorage.setItem('solaris.sessao.v1', guardaSessao);
      if (sessaoAntes) carregarSessao();
    }
  }

  teste('SHA-256 bate com os vetores conhecidos', () => {
    igual(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    igual(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    igual(sha256('The quick brown fox jumps over the lazy dog'),
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });

  teste('cada salt é diferente', () => {
    const s = new Set();
    for (let i = 0; i < 50; i++) s.add(saltAleatorio());
    igual(s.size, 50, 'salt repetiu');
    igual(saltAleatorio().length, 32, 'salt deveria ter 16 bytes em hex');
  });

  teste('comparação segura não aceita tamanhos diferentes nem valor errado', () => {
    igual(iguaisSeguro('abc', 'abc'), true);
    igual(iguaisSeguro('abc', 'abd'), false);
    igual(iguaisSeguro('abc', 'abcd'), false);
    igual(iguaisSeguro('', ''), true);
  });

  teste('e-mail é normalizado para minúsculas sem espaço', () => {
    igual(normalizarEmail('  RICHARD@Teste.COM '), 'richard@teste.com');
  });

  testeAsync('a senha nunca é guardada, só a derivação', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    const c = await Banco.conta(EMAIL);
    ok(c, 'a conta não chegou ao banco');
    ok(JSON.stringify(c).indexOf(SENHA) < 0, 'a senha apareceu no registro gravado');
    igual(c.hash.length, 64, 'hash deveria ter 256 bits em hex');
    ok(c.salt && c.salt.length === 32, 'faltou salt');
    ok(c.metodo === 'pbkdf2' || c.metodo === 'sha256x', 'método desconhecido: ' + c.metodo);
  }));

  testeAsync('a mesma senha com salts diferentes gera hashes diferentes', () => limpo(async () => {
    const a = await derivar(SENHA, saltAleatorio());
    const b = await derivar(SENHA, saltAleatorio());
    ok(a.valor !== b.valor, 'o salt não está sendo usado');
  }));

  testeAsync('entra com a senha certa e recusa a errada', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    sair();
    let recusou = false;
    try { await entrar(EMAIL, 'errada', false); } catch (e) { recusou = true; }
    ok(recusou, 'entrou com senha errada');
    igual(sessao(), null, 'deixou sessão aberta após falhar');
    await entrar(EMAIL, SENHA, false);
    ok(sessao() && sessao().id === EMAIL, 'não entrou com a senha certa');
  }));

  testeAsync('não revela se o e-mail existe', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    let m1 = '', m2 = '';
    try { await entrar(EMAIL, 'errada', false); } catch (e) { m1 = e.message; }
    try { await entrar('naoexiste@x.com', 'errada', false); } catch (e) { m2 = e.message; }
    igual(m1, m2, 'mensagens diferentes entregam quais e-mails existem');
  }));

  testeAsync('recusa senha curta, e-mail inválido e duplicado', () => limpo(async () => {
    let n = 0;
    try { await criarConta('Teste', EMAIL, '123'); } catch (e) { n++; }
    try { await criarConta('Teste', 'sem-arroba', SENHA); } catch (e) { n++; }
    try { await criarConta('A', EMAIL, SENHA); } catch (e) { n++; }
    igual(n, 3, 'alguma validação passou batido');
    await criarConta('Teste', EMAIL, SENHA);
    let dup = false;
    try { await criarConta('Outro', EMAIL.toUpperCase(), SENHA); } catch (e) { dup = true; }
    ok(dup, 'aceitou o mesmo e-mail em outra caixa');
  }));

  testeAsync('cada conta tem o seu balde de dados', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    await entrar(EMAIL, SENHA, false);
    igual(contaAtual(), EMAIL, 'a conta ativa deveria ser a que entrou');
    await Banco.salvarEstado(EMAIL, { marca: 'da conta' });
    entrarComoVisitante();
    igual(contaAtual(), 'visitante', 'visitante deveria ter balde próprio');
    const doVisitante = await Banco.estado('visitante');
    ok(!doVisitante || doVisitante.marca !== 'da conta', 'o dado da conta vazou para o visitante');
  }));

  testeAsync('sessão expirada é descartada', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    await entrar(EMAIL, SENHA, true);
    const s = JSON.parse(localStorage.getItem('solaris.sessao.v1'));
    ok(s.ate > Date.now(), 'sessão com manter deveria ter prazo');
    s.ate = Date.now() - 1000;
    localStorage.setItem('solaris.sessao.v1', JSON.stringify(s));
    sair();
    igual(carregarSessao(), null, 'aceitou sessão vencida');
  }));

  testeAsync('trocar a senha invalida a anterior', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    await entrar(EMAIL, SENHA, false);
    let bloqueou = false;
    try { await trocarSenha('errada', 'novaSenha456'); } catch (e) { bloqueou = true; }
    ok(bloqueou, 'trocou a senha sem saber a atual');
    await trocarSenha(SENHA, 'novaSenha456');
    sair();
    let antigaFalha = false;
    try { await entrar(EMAIL, SENHA, false); } catch (e) { antigaFalha = true; }
    ok(antigaFalha, 'a senha antiga continuou valendo');
    await entrar(EMAIL, 'novaSenha456', false);
    ok(sessao(), 'a senha nova não funcionou');
  }));

  testeAsync('apagar a conta leva os dados junto', () => limpo(async () => {
    await criarConta('Teste', EMAIL, SENHA);
    await entrar(EMAIL, SENHA, false);
    await Banco.salvarEstado(EMAIL, { teste: 1 });
    await apagarConta();
    igual(contas()[EMAIL], undefined, 'a conta continuou cadastrada');
    igual(await Banco.conta(EMAIL), undefined, 'a conta continuou no banco');
    igual(await Banco.estado(EMAIL), null, 'os dados ficaram para trás');
    igual(sessao(), null, 'a sessão continuou aberta');
  }));
});

/* ================= banco de dados ================= */
grupo('Banco', () => {
  const CONTA = '__teste_bd__';

  /* assincrono de proposito: os sincronos rodam antes de Banco.iniciar() */
  testeAsync('o banco abriu', async () => {
    ok(Banco.pronto, 'Banco.iniciar() não rodou');
    ok(typeof Banco.usandoIndexedDB === 'boolean', 'nao reportou qual motor esta em uso');
  });

  testeAsync('estado vai e volta inteiro', async () => {
    const dados = { metas: { residencial: 999 }, extras: [{ nome: 'X' }], texto: 'acentuação é preservada' };
    await Banco.salvarEstado(CONTA, dados);
    const volta = await Banco.estado(CONTA);
    igual(JSON.stringify(volta), JSON.stringify(dados), 'o estado voltou diferente');
    await Banco.apagarEstado(CONTA);
    igual(await Banco.estado(CONTA), null, 'apagar não funcionou');
  });

  testeAsync('leituras são gravadas e lidas em ordem', async () => {
    if (!Banco.usandoIndexedDB) return; /* na reserva não há histórico */
    await Banco.limparLeituras(CONTA);
    await Banco.registrarLeitura(CONTA, 1.5, 0.8);
    await Banco.registrarLeitura(CONTA, 2.5, 1.2);
    const l = await Banco.leituras(CONTA, 0);
    igual(l.length, 2, 'deveriam ser duas leituras');
    ok(l[0].t <= l[1].t, 'vieram fora de ordem');
    igual(l[0].c, 1.5); igual(l[1].g, 1.2);
    await Banco.limparLeituras(CONTA);
    igual((await Banco.leituras(CONTA, 0)).length, 0, 'limpar não funcionou');
  });

  testeAsync('leitura de uma conta não aparece na outra', async () => {
    if (!Banco.usandoIndexedDB) return;
    await Banco.limparLeituras(CONTA);
    await Banco.limparLeituras(CONTA + '2');
    await Banco.registrarLeitura(CONTA, 1, 1);
    igual((await Banco.leituras(CONTA + '2', 0)).length, 0, 'vazou entre contas');
    await Banco.limparLeituras(CONTA);
  });

  testeAsync('as estatísticas respondem', async () => {
    const e = await Banco.estatisticas();
    ok(e.motor === 'IndexedDB' || e.motor.indexOf('localStorage') === 0, 'motor estranho: ' + e.motor);
    ok(typeof e.leituras === 'number', 'contagem de leituras inválida');
    ok(e.janelaDias > 0 && e.intervaloSeg > 0, 'parâmetros de histórico zerados');
  });
});

/* ================= execução ================= */
function rodar() {
  const alvo = document.getElementById('saida');
  const grupos = {};
  T.casos.forEach(c => { (grupos[c.grupo] = grupos[c.grupo] || []).push(c); });

  const total = T.casos.length, falhas = T.casos.filter(c => !c.ok).length;
  let html = '<div class="resumo ' + (falhas ? 'ruim' : 'bom') + '">' +
    '<b>' + (total - falhas) + '</b> de <b>' + total + '</b> testes passaram' +
    (falhas ? ' · <span>' + falhas + ' falha' + (falhas > 1 ? 's' : '') + '</span>' : ' · tudo verde') +
    '</div>';

  Object.keys(grupos).forEach(g => {
    const cs = grupos[g];
    const ruins = cs.filter(c => !c.ok).length;
    html += '<section><h2>' + g + ' <span>' + (cs.length - ruins) + '/' + cs.length + '</span></h2>';
    cs.forEach(c => {
      html += '<div class="caso ' + (c.ok ? 'ok' : 'falhou') + '">' +
        '<span class="marca">' + (c.ok ? '✓' : '✕') + '</span>' +
        '<span>' + c.nome + (c.ok ? '' : '<em>' + c.erro + '</em>') + '</span></div>';
    });
    html += '</section>';
  });
  alvo.innerHTML = html;
  document.title = (falhas ? '✕ ' : '✓ ') + (total - falhas) + '/' + total + ' — Testes Solaris';
}

async function rodarAssincronos() {
  for (const a of ASSINC) {
    try { await a.fn(); T.casos.push({ grupo: a.grupo, nome: a.nome, ok: true }); }
    catch (e) { T.casos.push({ grupo: a.grupo, nome: a.nome, ok: false, erro: e.message }); }
  }
}

document.getElementById('saida').innerHTML = '<div class="resumo">Rodando…</div>';
Banco.iniciar().then(carregarContas).then(rodarAssincronos).then(rodar);
