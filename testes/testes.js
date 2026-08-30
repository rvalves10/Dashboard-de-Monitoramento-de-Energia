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
          const html = corpoAmplo();
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
    const irr = soma(IRRADIACAO_REGIAO) / 12;
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
          const html = corpoAmplo();
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

/* ================= conta vazia ================= */
grupo('Conta vazia', () => {

  function comExemplos(v, fn) {
    const antes = S.exemplos, antesP = S.perfil, antesU = S.unidades;
    S.exemplos = v; _visao = null; _cacheLedger.clear();
    try { return fn(); }
    finally {
      S.exemplos = antes; S.perfil = antesP; S.unidades = antesU;
      _visao = null; _cacheLedger.clear();
    }
  }

  teste('com exemplos ligados aparecem as duas unidades de demonstracao', () => {
    comExemplos(true, () => {
      const c = chavesUnidades();
      ok(c.indexOf('residencial') >= 0, 'faltou a casa de exemplo');
      ok(c.indexOf('negocio') >= 0, 'faltou a padaria de exemplo');
      igual(semUnidade(), false);
    });
  });

  teste('com exemplos desligados e sem unidade propria, a conta fica vazia', () => {
    comExemplos(false, () => {
      S.unidades = [];
      igual(chavesUnidades().length, 0, 'sobrou unidade em conta vazia');
      igual(semUnidade(), true, 'deveria pedir a primeira unidade');
      igual(uni('residencial'), null, 'a casa de exemplo vazou');
      igual(uni('negocio'), null, 'a padaria de exemplo vazou');
    });
  });

  teste('com exemplos desligados so aparece o que a pessoa cadastrou', () => {
    comExemplos(false, () => {
      S.unidades = [{
        chave: 'minha', nome: 'Minha casa', arquetipo: 'casaVazia', telhado: 'bom',
        distribuidora: 'CPFL', tarifa: 0.98, consumoMes: 380,
        potenciaKwp: 5.2, paineis: 12, investimento: 24000, mesesOperacao: 8
      }];
      igual(chavesUnidades().length, 1);
      igual(chavesUnidades()[0], 'minha');
      igual(semUnidade(), false);
      S.perfil = 'minha';
      igual(unidade().nome, 'Minha casa');
    });
  });

  teste('a tela de primeira unidade oferece as duas saidas', () => {
    const d = document.createElement('div');
    d.innerHTML = vPrimeiraUnidade();
    ok(d.querySelector('[data-tela="unidade"]'), 'faltou o caminho de cadastrar');
    ok(d.querySelector('[data-act="ligar-exemplos"]'), 'faltou o caminho de ver exemplos');
    igual(d.querySelectorAll('h1').length, 1, 'deveria ter um h1');
  });

  teste('o perfil se ajusta sozinho quando a unidade ativa some', () => {
    comExemplos(true, () => {
      S.perfil = 'nao-existe-mais';
      ok(ajustarPerfil(), 'deveria ter encontrado outra unidade');
      ok(chavesUnidades().indexOf(S.perfil) >= 0, 'perfil continuou invalido');
    });
    comExemplos(false, () => {
      S.unidades = []; S.perfil = 'nao-existe-mais';
      igual(ajustarPerfil(), false, 'sem unidade deveria devolver false');
      igual(S.perfil, null, 'perfil deveria ficar nulo');
    });
  });

  teste('a tarifa nao quebra quando ainda nao ha unidade', () => {
    comExemplos(false, () => {
      S.unidades = []; S.perfil = null;
      const t = tarifaAtual();
      ok(isFinite(t) && t > 0, 'tarifaAtual devolveu ' + t);
    });
  });
});

/* ================= contas e sess\u00e3o ================= */
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

  /* Antes isto era provado contra o modo visitante. Sem visitante, a prova
     ficou melhor: duas contas de verdade, que e o caso que acontece. */
  testeAsync('cada conta tem o seu balde de dados', () => limpo(async () => {
    const OUTRO = 'outra@exemplo.com';
    await criarConta('Teste', EMAIL, SENHA);
    await entrar(EMAIL, SENHA, false);
    igual(contaAtual(), EMAIL, 'a conta ativa deveria ser a que entrou');
    await Banco.salvarEstado(EMAIL, { marca: 'da primeira' });

    try {
      await criarConta('Outra', OUTRO, SENHA);
      await entrar(OUTRO, SENHA, false);
      igual(contaAtual(), OUTRO, 'a conta ativa deveria ter trocado');
      const daOutra = await Banco.estado(OUTRO);
      ok(!daOutra || daOutra.marca !== 'da primeira', 'o dado de uma conta vazou para a outra');
    } finally {
      /* a segunda conta e desta prova, e nao pode sobrar no banco de quem
         estiver rodando a suite — nem se a assercao acima falhar */
      await Banco.apagarConta(OUTRO);
      await Banco.apagarEstado(OUTRO);
      delete _contas[OUTRO];
    }
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
    ok(/^(IndexedDB|localStorage|Supabase)/.test(e.motor), 'motor estranho: ' + e.motor);
    ok(typeof e.leituras === 'number', 'contagem de leituras inválida');
    ok(e.janelaDias > 0 && e.intervaloSeg > 0, 'parâmetros de histórico zerados');
  });
});

/* ================= texto e numeros ================= */
grupo('Formatacao', () => {

  teste('numeros saem no formato brasileiro', () => {
    igual(nf(1234567), '1.234.567');
    igual(nf(1234.5, 1), '1.234,5');
    igual(nf(0.5, 2), '0,50');
    igual(nf(0), '0');
  });

  teste('dinheiro sai com R$ e sem centavo quando nao pedimos', () => {
    igual(brl(1234), 'R$ 1.234');
    igual(brl(12.34, 2), 'R$ 12,34');
  });

  teste('sinal usa o menos de verdade, nao o hifen', () => {
    ok(sinal(-5).indexOf('\u2212') === 0, 'deveria comecar com o sinal de menos tipografico');
    igual(sinal(5), '+5');
    igual(sinal(0), '+0');
  });

  teste('porcentagem arredonda como esperado', () => {
    igual(pct(33.333), '33%');
    igual(pct(33.333, 1), '33,3%');
  });

  teste('numeroBR e nf sao inversos um do outro', () => {
    [0, 1, 1.5, 1234, 1234.56, 26000].forEach(v => {
      const casas = v % 1 === 0 ? 0 : 2;
      perto(numeroBR(nf(v, casas)), v, 0.01, 'ida e volta de ' + v);
    });
  });
});

/* ================= seguranca do que o usuario digita ================= */
grupo('Injecao', () => {

  const MALDADE = '<img src=x onerror="alert(1)">';

  teste('esc neutraliza tag, aspas e ampersand', () => {
    const r = esc(MALDADE);
    ok(r.indexOf('<') < 0, 'sobrou < no texto escapado');
    ok(r.indexOf('>') < 0, 'sobrou > no texto escapado');
    ok(r.indexOf('&lt;img') === 0, 'nao escapou como esperado: ' + r);
    igual(esc('a & b'), 'a &amp; b');
    igual(esc("aspas ' e \""), 'aspas &#39; e &quot;');
    igual(esc(null), '');
    igual(esc(undefined), '');
  });

  /* O texto escapado CONTEM a palavra "onerror=" como texto comum, e isso
     esta certo. O que importa e se o navegador cria um elemento de verdade.
     Por isso a checagem e no DOM montado, nao na string. */
  function viraElemento(html, seletor) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.querySelector(seletor);
  }

  teste('nome de aparelho com HTML nao vira elemento de verdade', () => {
    const antes = S.extras, antesTela = S.tela;
    try {
      S.extras = [{
        id: 'xss', perfil: 'residencial', nome: MALDADE, local: 'Sala', cat: 'Outros',
        pot: 100, horas: 1, dias: 30, cor: '#7A6BA8', conf: 'alta', fonte: 'manual', tend: 0
      }];
      _visao = null; S.tela = 'equipamentos';
      comPerfil('residencial', () => {
        const html = corpoAmplo();
        igual(viraElemento(html, 'img'), null, 'o navegador criou uma tag img de verdade');
        igual(viraElemento(html, '[onerror]'), null, 'sobrou um atributo onerror ativo');
        ok(html.indexOf('&lt;img') >= 0, 'o nome nem chegou a aparecer escapado');
      });
    } finally {
      /* restaurar no finally: se a asercao falhar no meio, o estado sujo
         nao pode vazar para os proximos testes */
      S.extras = antes; S.tela = antesTela; _visao = null;
    }
  });

  teste('nome de unidade com HTML tambem nao vira elemento', () => {
    const antes = S.unidades, antesP = S.perfil, antesT = S.tela;
    try {
      S.unidades = [{
        chave: 'xss-un', nome: MALDADE, arquetipo: 'casaVazia', telhado: 'bom',
        distribuidora: MALDADE, tarifa: 1, consumoMes: 300, potenciaKwp: 4,
        paineis: 10, investimento: 20000, mesesOperacao: 12
      }];
      S.perfil = 'xss-un'; S.tela = 'config'; _visao = null; _cacheLedger.clear();
      const html = corpoAmplo();
      igual(viraElemento(html, 'img'), null, 'o navegador criou uma tag img de verdade');
      igual(viraElemento(html, '[onerror]'), null, 'sobrou um atributo onerror ativo');
    } finally {
      S.unidades = antes; S.perfil = antesP; S.tela = antesT;
      _visao = null; _cacheLedger.clear();
    }
  });
  /* Varredura completa: envenena TODO campo que o usuario consegue digitar
     e passa por todas as telas, nas duas cascas. Este teste nasceu de um
     furo de verdade — o nome da distribuidora aparecia sem escape no KPI
     de creditos do painel. Sem esta varredura, so descobrimos por acaso. */
  teste('nenhuma tela transforma texto do usuario em HTML', () => {
    const furos = [];
    const olhar = (rotulo, html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      if (d.querySelector('img') || d.querySelector('[onerror]') || d.querySelector('script')) {
        furos.push(rotulo);
      }
    };
    const guarda = {
      extras: JSON.parse(JSON.stringify(S.extras)),
      unidades: JSON.parse(JSON.stringify(S.unidades)),
      novo: JSON.parse(JSON.stringify(S.novo)),
      nova: JSON.parse(JSON.stringify(S.nova)),
      perfil: S.perfil, tela: S.tela, tab: S.tab, msub: S.msub, detalhe: S.detalhe
    };
    /* a varredura roda as telas de dentro do app, que so existem com sessao.
       Nao ha mais visitante, entao montamos uma sessao direto. */
    const sessaoAntes = SESSAO;
    if (!SESSAO) SESSAO = { id: 'varredura@exemplo.com', nome: 'Varredura', email: 'varredura@exemplo.com', ate: null };
    const TELAS_AMPLAS = ['painel', 'historico', 'equipamentos', 'cadastro',
      'alertas', 'relatorio', 'config', 'unidade', 'assistente'];
    const ABAS = ['painel', 'historico', 'aparelhos', 'assistente', 'mais'];
    const SUBS = [null, 'conta', 'cadastro', 'config', 'metas'];

    try {
      /* 1. aparelho cadastrado com nome e local envenenados */
      S.extras = [{
        id: 'varredura', perfil: 'residencial', nome: MALDADE, local: MALDADE,
        cat: 'Outros', pot: 100, horas: 1, dias: 30,
        cor: '#7A6BA8', conf: 'alta', fonte: 'manual', tend: 0
      }];
      S.perfil = 'residencial'; S.detalhe = 'varredura'; _visao = null;
      TELAS_AMPLAS.forEach(t => { S.tela = t; olhar('amplo/' + t, corpoAmplo()); });
      ABAS.forEach(tab => SUBS.forEach(sub => {
        S.tab = tab; S.msub = sub; olhar('movel/' + tab + '/' + (sub || 'raiz'), vMovel());
      }));
      S.msub = null;

      /* 2. formularios com o campo sendo digitado agora */
      S.novo = Object.assign({}, S.novo, { nome: MALDADE, comodo: MALDADE });
      S.tela = 'cadastro'; olhar('cadastro em digitacao', corpoAmplo());
      S.nova = Object.assign({}, S.nova, { nome: MALDADE, distribuidora: MALDADE });
      S.tela = 'unidade'; olhar('unidade em digitacao', corpoAmplo());

      /* 3. unidade propria com nome e distribuidora envenenados */
      S.unidades = [{
        chave: 'varredura-un', nome: MALDADE, arquetipo: 'casaVazia', telhado: 'bom',
        distribuidora: MALDADE, tarifa: 1, consumoMes: 300, potenciaKwp: 4,
        paineis: 10, investimento: 20000, mesesOperacao: 12
      }];
      S.perfil = 'varredura-un'; _visao = null; _cacheLedger.clear();
      TELAS_AMPLAS.forEach(t => { S.tela = t; olhar('unidade propria/' + t, corpoAmplo()); });
      ABAS.forEach(tab => { S.tab = tab; olhar('unidade propria movel/' + tab, vMovel()); });
    } finally {
      Object.keys(guarda).forEach(k => { S[k] = guarda[k]; });
      if (!sessaoAntes) sair();
      _visao = null; _cacheLedger.clear();
    }

    igual(furos.length, 0, 'texto do usuario virou HTML em: ' + furos.join(', '));
  });
});

/* ================= acessibilidade ================= */
grupo('Acessibilidade', () => {

  function html(tela) {
    const antes = S.tela; S.tela = tela;
    try { return corpoAmplo(); } finally { S.tela = antes; }
  }
  function comoDOM(txt) {
    const d = document.createElement('div');
    d.innerHTML = txt;
    return d;
  }

  teste('a tela de entrada tem rotulo em tudo', () => {
    const antes = sessao();
    sair();
    try {
      const d = document.createElement('div');
      d.innerHTML = vLogin();
      ok(d.querySelector('.entrada'), 'a tela de entrada nao montou');
      igual(d.querySelectorAll('h1').length, 1, 'deveria ter um h1');
      d.querySelectorAll('button').forEach(b => {
        const nome = (b.textContent || '').trim() || b.getAttribute('aria-label') || '';
        ok(nome.length > 0, 'botao sem nome na tela de entrada');
      });
      d.querySelectorAll('input').forEach(i => {
        const dentro = i.closest && i.closest('label');
        ok(dentro || i.getAttribute('aria-label'), 'campo sem rotulo: ' + i.id);
      });
      /* O contrario do que este teste cobrava antes: agora o login e a unica
         porta, e qualquer atalho que reapareca aqui quebra o requisito. */
      ok(!d.querySelector('[data-act="auth-visitante"]'),
        'voltou a saida de visitante: o login e obrigatorio');
    } finally { if (antes) carregarSessao(); }
  });

  teste('todo botao tem nome acessivel', () => {
    ['painel', 'historico', 'equipamentos', 'cadastro', 'alertas', 'relatorio', 'config', 'unidade', 'assistente'].forEach(t => {
      const d = comoDOM(html(t));
      d.querySelectorAll('button').forEach(b => {
        const nome = (b.textContent || '').trim() || b.getAttribute('aria-label') || '';
        ok(nome.length > 0, t + ': existe botao sem texto nem aria-label');
      });
    });
  });

  teste('todo campo de formulario tem rotulo ligado', () => {
    ['cadastro', 'unidade', 'config', 'assistente'].forEach(t => {
      const d = comoDOM(html(t));
      d.querySelectorAll('input').forEach(i => {
        const temLabel = i.id && d.querySelector('label[for="' + i.id + '"]');
        const dentroDeLabel = i.closest && i.closest('label');
        const aria = i.getAttribute('aria-label');
        ok(temLabel || dentroDeLabel || aria, t + ': input sem rotulo (' + (i.id || i.type) + ')');
      });
    });
  });

  teste('so existe um h1 por tela', () => {
    ['painel', 'historico', 'relatorio'].forEach(t => {
      const d = comoDOM(html(t));
      igual(d.querySelectorAll('h1').length, 1, t + ': deveria ter exatamente um h1');
    });
  });

  teste('graficos tem descricao para leitor de tela', () => {
    const d = comoDOM(html('painel'));
    const g = d.querySelector('#chartDia');
    ok(g, 'grafico do dia sumiu');
    ok((g.getAttribute('aria-label') || '').length > 40, 'faltou descricao no grafico');
    igual(g.getAttribute('tabindex'), '0', 'grafico deveria receber foco');
  });

  teste('svg decorativo fica escondido do leitor de tela', () => {
    const d = comoDOM(html('painel'));
    const soltos = [...d.querySelectorAll('svg')].filter(s =>
      !s.getAttribute('aria-hidden') && !s.getAttribute('role') && !s.getAttribute('aria-label'));
    igual(soltos.length, 0, soltos.length + ' svg sem aria-hidden nem rotulo');
  });

  teste('o menu marca em qual pagina voce esta', () => {
    const d = comoDOM(html('alertas'));
    const atual = d.querySelectorAll('[aria-current="page"]');
    igual(atual.length, 1, 'deveria haver exatamente um item marcado');
  });
});

/* ================= estado ================= */
grupo('Estado', () => {

  teste('o estado padrao tem todos os campos que o site usa', () => {
    ['perfil', 'tela', 'periodo', 'tab', 'msub', 'detalhe', 'metas', 'regras',
      'tarifa', 'extras', 'removidos', 'respondidas', 'dispensados', 'unidades',
      'novo', 'nova', 'editando', 'salvo', 'medidor'].forEach(k => {
        ok(PADRAO[k] !== undefined, 'faltou ' + k + ' no estado padrao');
      });
  });

  teste('o estado sobrevive a ida e volta em JSON', () => {
    const copia = JSON.parse(JSON.stringify(S));
    igual(typeof copia.metas, 'object');
    igual(typeof copia.regras, 'object');
    ok(Array.isArray(copia.extras), 'extras deveria ser lista');
  });

  testeAsync('gravar e ler o estado devolve o mesmo objeto', async () => {
    const CONTA = '__teste_estado__';
    const original = JSON.parse(JSON.stringify(S));
    original.metas.residencial = 4242;
    await Banco.salvarEstado(CONTA, original);
    const volta = await Banco.estado(CONTA);
    igual(volta.metas.residencial, 4242, 'a meta nao voltou igual');
    igual(JSON.stringify(volta), JSON.stringify(original), 'o estado voltou diferente');
    await Banco.apagarEstado(CONTA);
  });

  teste('trocar de unidade nao mistura os dados', () => {
    const antes = JSON.stringify(S.metas);
    S.metas.residencial = 111; S.metas.negocio = 222;
    comPerfil('residencial', () => igual(S.metas[S.perfil], 111));
    comPerfil('negocio', () => igual(S.metas[S.perfil], 222));
    S.metas = JSON.parse(antes);
  });
});

/* ================= integridade do calculo ================= */
grupo('Integridade', () => {

  teste('nenhum numero da visao e NaN ou infinito', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      const v = visao();
      ['projConsumo', 'projGeracao', 'projRede', 'projInj', 'economia', 'economiaCheia',
        'creditos', 'contaProj', 'semSolarProj', 'autoPct', 'co2', 'desempenho',
        'potencial', 'esperada', 'projFioB'].forEach(k => {
          ok(isFinite(v[k]), p + ': ' + k + ' = ' + v[k]);
          ok(v[k] >= 0, p + ': ' + k + ' ficou negativo (' + v[k] + ')');
        });
    }));
  });

  teste('a conta com sol nunca passa da conta sem sol', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      const v = visao();
      ok(v.contaProj <= v.semSolarProj, p + ': o solar encareceu a conta');
    }));
  });

  teste('autoconsumo nunca passa nem do consumo nem da geracao', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      const v = visao();
      ok(v.mtd.auto <= v.mtd.tc + 0.01, p + ': autoconsumo maior que o consumo');
      ok(v.mtd.auto <= v.mtd.tg + 0.01, p + ': autoconsumo maior que a geracao');
    }));
  });

  teste('todo aparelho tem cor, categoria e consumo valido', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      aparelhos().forEach(e => {
        ok(/^#[0-9A-Fa-f]{6}$/.test(e.cor), p + '/' + e.nome + ': cor invalida (' + e.cor + ')');
        ok(e.nome && e.nome.length > 1, p + ': aparelho sem nome');
        ok(isFinite(e.kwh) && e.kwh >= 0, p + '/' + e.nome + ': kwh invalido');
        ok(CATS.indexOf(e.cat) >= 0, p + '/' + e.nome + ': categoria desconhecida (' + e.cat + ')');
      });
    }));
  });

  teste('as fatias dos aparelhos somam 100 por cento', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      const eq = aparelhos(), total = soma(eq.map(e => e.kwh));
      const somaPct = soma(eq.map(e => (e.kwh / total) * 100));
      perto(somaPct, 100, 0.01, p);
    }));
  });

  teste('todo perfil horario tem 24 valores positivos', () => {
    Object.keys(PERFIS).forEach(c => {
      igual(PERFIS[c].length, 24, c + ': deveria ter 24 horas');
      ok(PERFIS[c].every(v => v >= 0), c + ': tem valor negativo');
      ok(soma(PERFIS[c]) > 0, c + ': soma zero');
    });
  });

  teste('os alertas sempre trazem titulo, texto e tipo conhecido', () => {
    ['residencial', 'negocio'].forEach(p => comPerfil(p, () => {
      alertas().forEach(a => {
        ok(a.titulo && a.titulo.length > 3, p + ': alerta sem titulo');
        ok(a.txt && a.txt.length > 10, p + ': alerta sem texto');
        ok(['alto', 'medio', 'bom'].indexOf(a.tipo) >= 0, p + ': tipo estranho (' + a.tipo + ')');
        ok(a.chave && a.chave.indexOf(p) === 0, p + ': chave de dispensa errada');
      });
    }));
  });
});

/* ================= execucao ================= */

/* ================= conta nova é conta da pessoa =================
   Este grupo nasceu de tres defeitos que chegaram juntos, todos com a
   mesma cara para quem usa: "criei uma conta e veio a casa de outra
   pessoa dentro". Cada teste aqui trava um deles. */
grupo('Conta nova é conta da pessoa', () => {

  /* Defeito 1: o painel dizia "Bom dia, Marina" para qualquer um. */
  teste('a saudação usa o nome de quem está logado', () => {
    const antes = SESSAO;
    try {
      SESSAO = { id: 'a@b.com', nome: 'Ana Carolina de Souza', email: 'a@b.com', ate: null };
      const s = saudacao();
      ok(s.indexOf('Ana') >= 0, 'não usou o nome da conta: ' + s);
      ok(s.indexOf('Carolina') < 0, 'deveria usar só o primeiro nome: ' + s);
      ok(s.indexOf('Marina') < 0, 'voltou o nome fixo de demonstração: ' + s);
    } finally { SESSAO = antes; }
  });

  teste('sessão sem nome não ganha nome inventado', () => {
    const antes = SESSAO;
    try {
      SESSAO = { id: 'x@y.com', nome: '', email: 'x@y.com', ate: null };
      const s = saudacao();
      ok(/^(Bom dia|Boa tarde|Boa noite)$/.test(s), 'não deveria inventar nome: ' + s);
    } finally { SESSAO = antes; }
  });

  /* Defeito 2: a unidade nascia com os aparelhos do arquétipo dentro,
     todos marcados como "detectado por IA", sem ninguém ter cadastrado. */
  teste('a unidade só tem os aparelhos que a pessoa marcou', () => {
    const u = montarUnidade({
      chave: 'u-teste', nome: 'Casa teste', arquetipo: 'casaVazia', telhado: 'bom',
      distribuidora: 'X', tarifa: 1, consumoMes: 300, potenciaKwp: 4,
      paineis: 10, investimento: 20000, mesesOperacao: 12,
      aparelhos: ['gel', 'luz']
    });
    igual(u.equipamentos.length, 2, 'deveria ter só os dois marcados');
    const ids = u.equipamentos.map(e => e.id).sort().join(',');
    igual(ids, 'gel,luz', 'trouxe aparelho que não foi marcado: ' + ids);
  });

  teste('marcar nenhum aparelho deixa a unidade sem nenhum', () => {
    const u = montarUnidade({
      chave: 'u-vazia', nome: 'Casa', arquetipo: 'casaVazia', telhado: 'bom',
      distribuidora: 'X', tarifa: 1, consumoMes: 300, potenciaKwp: 4,
      paineis: 10, investimento: 20000, mesesOperacao: 12,
      aparelhos: []
    });
    igual(u.equipamentos.length, 0, 'lista vazia deveria produzir zero aparelhos');
  });

  /* Unidade salva antes desta versão não tem a lista. Não pode esvaziar
     o painel de quem já usava o sistema. */
  teste('unidade antiga, sem a lista, continua com tudo', () => {
    const u = montarUnidade({
      chave: 'u-antiga', nome: 'Casa antiga', arquetipo: 'casaVazia', telhado: 'bom',
      distribuidora: 'X', tarifa: 1, consumoMes: 300, potenciaKwp: 4,
      paineis: 10, investimento: 20000, mesesOperacao: 12
    });
    igual(u.equipamentos.length, ARQUETIPOS.casaVazia.equipamentos.length,
      'unidade sem a lista deveria manter todos os aparelhos');
  });

  teste('as fatias não são renormalizadas quando sobram poucos aparelhos', () => {
    /* Se a pessoa declara só a geladeira, a geladeira não pode virar 100%
       da conta dela. O que falta tem que aparecer como não identificado. */
    const cheia = montarUnidade({
      chave: 'u-c', nome: 'A', arquetipo: 'casaVazia', telhado: 'bom', distribuidora: 'X',
      tarifa: 1, consumoMes: 300, potenciaKwp: 4, paineis: 10, investimento: 20000,
      mesesOperacao: 12, aparelhos: ['gel']
    });
    const gel = cheia.equipamentos[0];
    const original = ARQUETIPOS.casaVazia.equipamentos.filter(e => e.id === 'gel')[0];
    igual(gel.share, original.share, 'a fatia da geladeira foi inflada');
  });

  /* Defeito 3: o medidor chamava o motor de 2 em 2 segundos e estourava
     enquanto a conta ainda não tinha unidade. */
  teste('o motor não quebra quando não há unidade nenhuma', () => {
    const antes = S.perfil;
    S.perfil = null; _visao = null; _cacheLedger.clear();
    try {
      const md = mesSimulado(S.perfil, 2026, 7);
      igual(md.tc, 0, 'mês sem unidade deveria ser zero');
      igual(md.dias.length, md.nd, 'o mês vazio tem que ter a forma de um mês de verdade');
      igual(md.dias[0].cons.length, 24, 'faltaram as 24 horas no dia vazio');
      const v = visao(true);
      igual(v.mtd.tc, 0, 'a visão sem unidade deveria estar zerada');
      const p = potenciaAgora();
      ok(isFinite(p.cons) && isFinite(p.ger), 'a potência virou NaN sem unidade');
    } finally { S.perfil = antes; _visao = null; _cacheLedger.clear(); }
  });

  teste('perfil apontando para unidade apagada também não quebra', () => {
    const antes = S.perfil;
    S.perfil = 'unidade-que-nao-existe'; _visao = null; _cacheLedger.clear();
    try {
      const l = ledger(S.perfil, 2026, 7, 100);
      ok(l.linhas.length > 0, 'o livro precisa de pelo menos uma linha');
      igual(l.creditos, 0, 'não deveria haver crédito sem unidade');
      ok(isFinite(visao(true).economia), 'a economia virou NaN');
    } finally { S.perfil = antes; _visao = null; _cacheLedger.clear(); }
  });

  teste('a tarifa continua plausível sem unidade cadastrada', () => {
    const antes = S.perfil;
    S.perfil = null;
    try {
      const t = tarifaAtual();
      ok(t > 0.1 && t < 3, 'tarifa fora de qualquer realidade: ' + t);
    } finally { S.perfil = antes; }
  });

  teste('a lista de aparelhos do arquétipo é o que o cadastro oferece', () => {
    Object.keys(ARQUETIPOS).forEach(k => {
      const lista = aparelhosDoArquetipo(k);
      igual(lista.length, ARQUETIPOS[k].equipamentos.length, k + ': lista de tamanho errado');
      lista.forEach(e => {
        ok(e.id && e.nome && e.local, k + ': aparelho sem id, nome ou local');
        ok(typeof e.pot === 'number', k + '/' + e.nome + ': potência inválida');
      });
    });
  });
});

/* ================= leitor da conta de luz ================= */
grupo('Leitor da conta de luz', () => {

  teste('reconhece a distribuidora pelo nome', () => {
    const r = interpretarConta('COPEL DISTRIBUICAO S.A. NOTA FISCAL/CONTA DE ENERGIA');
    igual(r.distribuidora, 'Copel');
  });

  teste('pega o consumo em kWh', () => {
    const r = interpretarConta('Consumo faturado 347 kWh no mes de referencia');
    igual(r.consumo, 347);
  });

  teste('entende o número no formato brasileiro', () => {
    const r = interpretarConta('CONSUMO 1.284 kWh');
    igual(r.consumo, 1284, 'o ponto de milhar foi lido como decimal');
  });

  teste('pega a tarifa quando ela está escrita', () => {
    const r = interpretarConta('Tarifa 0,89210 R$/kWh');
    ok(r.tarifa > 0.89 && r.tarifa < 0.893, 'tarifa lida errado: ' + r.tarifa);
  });

  teste('deduz a tarifa do total quando ela não aparece', () => {
    const r = interpretarConta('Consumo 300 kWh TOTAL A PAGAR 270,00');
    ok(r.tarifaDeduzida, 'deveria ter marcado que a tarifa foi deduzida');
    perto(r.tarifa, 0.9, 0.01, 'dedução errada');
  });

  teste('recusa número fora de qualquer realidade', () => {
    igual(interpretarConta('Tarifa 98,50 R$/kWh').tarifa, null, 'aceitou tarifa impossível');
    igual(interpretarConta('Consumo 3 kWh').consumo, null, 'aceitou consumo impossível');
  });

  teste('não inventa campo quando não achou nada', () => {
    const r = interpretarConta('texto sem nada de útil aqui dentro');
    igual(r.distribuidora, null);
    igual(r.consumo, null);
    igual(r.tarifa, null);
    igual(r.total, null);
  });

  teste('texto vazio ou nulo não quebra o leitor', () => {
    [null, undefined, '', '   '].forEach(v => {
      const r = interpretarConta(v);
      igual(r.consumo, null, 'entrada ' + JSON.stringify(v) + ' deveria dar nada');
    });
  });
});

/* ================= apagar do banco =================
   Estes dois testes existem por causa de um defeito real: "Apagar meus
   dados" removia a chave do localStorage enquanto o estado de verdade morava
   no IndexedDB. A tela dizia "apagado", nada era apagado, e no salvamento
   seguinte tudo voltava. O sintoma so aparecia depois de recarregar. */
grupo('Apagar do banco', () => {

  testeAsync('apagarEstado remove de verdade, e nao volta', async () => {
    const conta = '__apagar__@solaris.local';
    await Banco.salvarEstado(conta, { perfil: 'x', extras: [1, 2, 3] });
    ok(await Banco.estado(conta), 'o estado nao chegou a ser gravado');

    await Banco.apagarEstado(conta);
    const depois = await Banco.estado(conta);
    ok(!depois, 'o estado continuou no banco depois de apagar');
  });

  testeAsync('apagarTudo esvazia as tres tabelas', async () => {
    /* guarda o que existe para devolver no fim: a suite nao pode destruir
       o banco de quem esta rodando ela */
    const contasAntes = await Banco.contas();
    const estadosAntes = {};
    for (const c of contasAntes) estadosAntes[c.id] = await Banco.estado(c.id);

    try {
      await Banco.salvarConta({ id: '__t1__@x.com', nome: 'T1' });
      await Banco.salvarConta({ id: '__t2__@x.com', nome: 'T2' });
      await Banco.salvarEstado('__t1__@x.com', { perfil: 'a' });
      await Banco.registrarLeitura('__t1__@x.com', 1, 2);
      await Banco.registrarLeitura('__t2__@x.com', 1, 2);

      ok((await Banco.contas()).length >= 2, 'as contas de teste nao entraram');
      ok((await Banco.contarLeituras()) >= 2, 'as leituras de teste nao entraram');

      const antes = await Banco.apagarTudo();
      ok(antes && typeof antes.contas === 'number', 'apagarTudo deveria devolver o que havia antes');

      igual((await Banco.contas()).length, 0, 'sobrou conta depois de apagar tudo');
      igual(await Banco.contarLeituras(), 0, 'sobrou leitura depois de apagar tudo');
      ok(!(await Banco.estado('__t1__@x.com')), 'sobrou estado depois de apagar tudo');

      const soltas = Object.keys(localStorage).filter(k => k.indexOf('solaris') === 0);
      igual(soltas.length, 0, 'sobraram chaves no localStorage: ' + soltas.join(', '));
    } finally {
      /* devolve o banco como estava, senao o resto da suite roda no vazio */
      for (const c of contasAntes) await Banco.salvarConta(c);
      for (const id of Object.keys(estadosAntes)) {
        if (estadosAntes[id]) await Banco.salvarEstado(id, estadosAntes[id]);
      }
    }
  });
});


/* ================= a regiao de Sorocaba =================
   Esta base alimenta tres coisas ao mesmo tempo: a irradiacao do calculo, a
   distribuidora que o cadastro sugere e o contexto que o assistente recebe.
   Um dado errado aqui nao quebra a tela — ele faz o sistema afirmar com
   confianca uma coisa que nao e verdade, que e pior. */
grupo('Regiao', () => {

  teste('toda cidade aponta para uma distribuidora que existe', () => {
    CIDADES_REGIAO.forEach(c => {
      ok(DISTRIBUIDORAS[c.distribuidora],
        c.nome + ' aponta para uma distribuidora inexistente: ' + c.distribuidora);
    });
  });

  teste('nao ha cidade repetida', () => {
    const vistos = {};
    CIDADES_REGIAO.forEach(c => {
      ok(!vistos[c.id], 'cidade duplicada: ' + c.id);
      vistos[c.id] = true;
    });
  });

  teste('toda cidade tem nome, perfil e distancia coerentes', () => {
    CIDADES_REGIAO.forEach(c => {
      ok(c.nome && c.nome.length > 2, 'cidade sem nome: ' + c.id);
      ok(c.perfil && c.perfil.length > 30, c.nome + ' sem perfil descrito');
      ok(c.distancia >= 0 && c.distancia < 200, c.nome + ': distancia implausivel');
      ok(c.populacao > 0, c.nome + ': populacao zerada');
    });
  });

  teste('Sorocaba e a sede, e a distancia dela e zero', () => {
    const s = cidade('sorocaba');
    ok(s, 'Sorocaba sumiu da base');
    igual(s.distancia, 0, 'Sorocaba deveria ser o ponto de referencia');
    igual(s.distribuidora, 'cpfl-piratininga', 'Sorocaba e atendida pela CPFL Piratininga');
  });

  /* O caso que motivou a base existir: cidade vizinha com OUTRA
     distribuidora. Se isto quebrar, o assistente volta a dar o telefone e o
     mes de reajuste errados para quem mora la. */
  teste('cidade vizinha pode ter outra distribuidora', () => {
    igual(distribuidoraDaCidade('piedade').id, 'neoenergia-elektro',
      'Piedade e Neoenergia Elektro, nao CPFL');
    igual(distribuidoraDaCidade('sarapui').id, 'cpfl-santa-cruz',
      'Sarapui e CPFL Santa Cruz, nao Piratininga');
    igual(distribuidoraDaCidade('votorantim').id, 'cpfl-piratininga');
  });

  teste('toda distribuidora tem canal de atendimento e mes de reajuste', () => {
    Object.keys(DISTRIBUIDORAS).forEach(k => {
      const d = DISTRIBUIDORAS[k];
      igual(d.id, k, 'id de distribuidora fora de sincronia: ' + k);
      ok(d.telefone && /[0-9]/.test(d.telefone), d.nome + ' sem telefone');
      ok(d.reajusteMes >= 1 && d.reajusteMes <= 12, d.nome + ': mes de reajuste invalido');
    });
  });

  teste('a contagem de meses ate o reajuste fica entre 1 e 12', () => {
    for (let m = 0; m < 12; m++) {
      const n = mesesAteReajuste('cpfl-piratininga', new Date(2026, m, 15));
      ok(n >= 1 && n <= 12, 'mes ' + m + ' deu ' + n);
    }
  });

  teste('a irradiacao da regiao tem doze meses plausiveis', () => {
    igual(IRRADIACAO_REGIAO.length, 12, 'faltou mes na serie de irradiacao');
    IRRADIACAO_REGIAO.forEach((v, i) => {
      ok(v > 2 && v < 8, 'irradiacao implausivel no mes ' + i + ': ' + v);
    });
    /* Hemisferio sul: o verao (dez-jan) gera mais que o inverno (jun-jul).
       Se isto inverter, alguem copiou uma serie do hemisferio norte. */
    ok(IRRADIACAO_REGIAO[11] > IRRADIACAO_REGIAO[5],
      'dezembro deveria ter mais sol que junho no hemisferio sul');
  });

  teste('a cidade escolhida define a distribuidora da unidade', () => {
    const u = montarUnidade({
      chave: 'u-cid', nome: 'Casa', cidade: 'tatui', arquetipo: 'casaVazia',
      telhado: 'bom', distribuidora: '', tarifa: 1, consumoMes: 300,
      potenciaKwp: 4, paineis: 10, investimento: 20000, mesesOperacao: 12
    });
    igual(u.distribuidora, 'Neoenergia Elektro', 'nao herdou a distribuidora da cidade');
    igual(u.cidade, 'tatui');
  });

  teste('quem esta fora da regiao digita a distribuidora na mao', () => {
    const u = montarUnidade({
      chave: 'u-fora', nome: 'Casa', cidade: 'outra', arquetipo: 'casaVazia',
      telhado: 'bom', distribuidora: 'Light', tarifa: 1, consumoMes: 300,
      potenciaKwp: 4, paineis: 10, investimento: 20000, mesesOperacao: 12
    });
    igual(u.distribuidora, 'Light', 'o que foi digitado tem que valer');
  });
});

/* ================= a escolha do banco =================
   O router e simples demais para ter defeito sutil, e por isso mesmo e onde
   um erro passaria despercebido: se ele deixasse de repassar um metodo, a
   falha apareceria em producao como "nao salva", sem erro nenhum no console. */
grupo('Escolha do banco', () => {

  teste('sem credenciais, o Supabase nem e tentado', () => {
    igual(supabaseConfigurado(), false,
      'config.js do repositorio deveria vir sem credenciais preenchidas');
  });

  /* Assincrono de proposito, como o grupo Banco: os testes sincronos rodam
     enquanto testes.js e avaliado, e Banco.iniciar() so e chamado depois. */
  testeAsync('o banco escolhido e um dos tres conhecidos', async () => {
    ok(['supabase', 'indexeddb', 'localStorage'].indexOf(Banco.motor) >= 0,
      'motor desconhecido: ' + Banco.motor);
    igual(Banco.online, Banco.motor === 'supabase',
      'online e motor contam historias diferentes');
  });

  teste('o router repassa toda a interface do banco', () => {
    ['contas', 'conta', 'salvarConta', 'apagarConta',
      'estado', 'salvarEstado', 'apagarEstado',
      'registrarLeitura', 'leituras', 'contarLeituras', 'podarLeituras',
      'limparLeituras', 'apagarTudo', 'estatisticas'].forEach(m => {
      igual(typeof Banco[m], 'function', 'o router nao repassa ' + m);
      igual(typeof BancoLocal[m], 'function', 'local.js nao tem ' + m);
      igual(typeof BancoSupabase[m], 'function', 'supabase.js nao tem ' + m);
    });
  });

  testeAsync('offline, o que so existe na nuvem responde vazio em vez de quebrar', async () => {
    if (Banco.online) return;
    igual(await Banco.perfilConversa('x'), null, 'perfil deveria vir nulo offline');
    igual((await Banco.historicoConversa('x')).length, 0, 'conversa deveria vir vazia offline');
    const r = await Banco.chamarAgente({ pergunta: 'oi' });
    igual(r.ok, false, 'o agente nao pode responder sem servidor');
    ok(r.erro && r.erro.length > 10, 'e precisa dizer por que');
  });

  testeAsync('a tela diz por que caiu para o banco local', async () => {
    if (Banco.online) return;
    ok(Banco.motivoLocal && Banco.motivoLocal.length > 30,
      'sem motivo, quem configurou o Supabase acha que os dados subiram');
  });
});

/* ================= o assistente ================= */
grupo('Assistente', () => {

  teste('o papo rapido tem cinco perguntas bem formadas', () => {
    igual(PERGUNTAS_PERFIL.length, 5, 'mudou a quantidade de perguntas');
    const ids = {};
    PERGUNTAS_PERFIL.forEach(q => {
      ok(!ids[q.id], 'pergunta com id repetido: ' + q.id);
      ids[q.id] = true;
      ok(q.pergunta && q.pergunta.indexOf('?') > 0, q.id + ': pergunta sem interrogacao');
      ok(q.porque && q.porque.length > 20, q.id + ': falta dizer por que a pergunta existe');
      ok(q.opcoes.length >= 3, q.id + ': poucas opcoes');
      q.opcoes.forEach(o => {
        ok(o.v && o.r, q.id + ': opcao sem valor ou sem rotulo');
      });
    });
  });

  teste('perfil so conta como respondido depois de gravado', () => {
    const antes = S.perfilCliente;
    try {
      S.perfilCliente = null;
      igual(perfilRespondido(), false, 'perfil nulo nao pode contar como respondido');
      S.perfilCliente = { tratamento: 'neutro' };
      igual(perfilRespondido(), false, 'sem carimbo de tempo ainda nao esta pronto');
      S.perfilCliente = { tratamento: 'neutro', em: Date.now() };
      igual(perfilRespondido(), true, 'perfil gravado deveria contar');
    } finally { S.perfilCliente = antes; }
  });

  teste('o contexto do painel leva os numeros e nao inventa nenhum', () => {
    comPerfil('residencial', () => {
      const c = contextoDoPainel();
      ok(c.unidade, 'faltou a unidade no contexto');
      ok(c.cidade, 'faltou a cidade — e ela que puxa a distribuidora certa');
      ok(c.consumoMes && c.geracaoMes, 'faltaram os numeros do mes');
      Object.keys(c).forEach(k => {
        const v = c[k];
        ok(typeof v !== 'number' || isFinite(v), k + ' veio NaN ou infinito');
        ok(String(v).indexOf('undefined') < 0, k + ' veio com undefined dentro');
      });
    });
  });

  teste('sem unidade, o contexto vem vazio em vez de zerado', () => {
    const guardaPerfil = S.perfil, guardaUn = S.unidades, guardaEx = S.exemplos;
    try {
      S.unidades = []; S.exemplos = false; S.perfil = 'nao-existe'; _visao = null;
      igual(Object.keys(contextoDoPainel()).length, 0,
        'mandar zeros faria o assistente falar de uma casa que nao existe');
    } finally {
      S.perfil = guardaPerfil; S.unidades = guardaUn; S.exemplos = guardaEx;
      _visao = null;
    }
  });

  teste('as sugestoes mudam com o estado e nunca vem vazias', () => {
    comPerfil('residencial', () => {
      const g = sugestoesDoAgente();
      ok(g.length >= 3, 'poucas sugestoes de partida');
      g.forEach(t => ok(t.indexOf('?') > 0, 'sugestao que nao e pergunta: ' + t));
    });
  });

  teste('assistente desligado explica o que fazer', () => {
    if (Banco.online) return;
    const m = agenteIndisponivel();
    ok(m && m.length > 40, '"indisponivel" sozinho nao ajuda ninguem');
    ok(m.indexOf('config.js') > 0, 'a mensagem deveria dizer onde configurar');
  });

  /* O modelo responde em texto. Se esse texto virasse HTML, uma resposta com
     tag dentro executaria na tela de quem perguntou. */
  teste('resposta do modelo nunca vira HTML de verdade', () => {
    const d = document.createElement('div');
    d.innerHTML = textoDaFala('<img src=x onerror=alert(1)> **negrito** e <b>tag</b>');
    igual(d.querySelectorAll('img').length, 0, 'a tag do modelo virou elemento');
    igual(d.querySelectorAll('b').length, 1, 'so o negrito de markdown pode virar tag');
    ok(d.textContent.indexOf('<b>tag</b>') >= 0, 'a tag literal deveria aparecer como texto');
  });
});

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
