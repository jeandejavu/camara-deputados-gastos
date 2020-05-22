import axios from 'axios';
import { JSDOM } from 'jsdom';

import api from '../services/api';

import { writeFileSync, readdirSync } from 'fs';

function createDeputados() {
  function convertNumber(domElement) {
    return domElement.textContent.replace(/([^\d])+/gim, '') / 100;
  }

  function getSelectTextContentTrim(dom, query) {
    try {
      return dom.querySelector(query).textContent.trim();
    } catch (error) {
      return 'problema na solicitacao';
    }
  }

  async function getVerbas({ idDeputado, ano }) {
    const recursos = await axios.get(
      `https://www.camara.leg.br/deputados/${idDeputado}/_gastos?ano=${ano}`
    );
    const dom = new JSDOM(recursos.data).window.document;

    const [
      ,
      gastoValor,
      gastoPercentual,
      ,
      disponivelValor,
      disponivelPercentual,
    ] = Array.from(dom.querySelectorAll('#percentualgastoverbagabinete td'));

    const gabinete = Array.from(
      dom.querySelectorAll('#gastomensalverbagabinete td')
    );

    const mensal = [];

    for (let i = 0; i < gabinete.length; i += 3) {
      mensal.push({
        mes: gabinete[i].textContent,
        valor: convertNumber(gabinete[i + 1]),
        percentual: convertNumber(gabinete[i + 2]),
      });
    }

    return {
      gasto: {
        valor: convertNumber(gastoValor),
        percentual: convertNumber(gastoPercentual),
      },
      disponivel: {
        valor: convertNumber(disponivelValor),
        percentual: convertNumber(disponivelPercentual),
      },
      mensal,
    };
  }

  async function getVerbasPeriodo({ idDeputado }) {
    const anos = [2019, 2020];
    const resultado = [];
    for (let i = 0; i < anos.length; i++) {
      const verbas = await getVerbas({ idDeputado, ano: anos[i] });
      resultado.push({ ano: anos[i], verbas });
    }
    return resultado;
  }

  async function getRecursos({ idDeputado, ano }) {
    const recursos = await axios.get(
      `https://www.camara.leg.br/deputados/${idDeputado}/_recursos?ano=${ano}`
    );
    const dom = new JSDOM(recursos.data).window.document;

    const gabinete = getSelectTextContentTrim(
      dom,
      '[href*="/pessoal-gabinete"]'
    );

    const salario =
      getSelectTextContentTrim(dom, '[href*="/remuneracao"]').replace(
        /\D/gim,
        ''
      ) / 100;

    const imovel = getSelectTextContentTrim(
      dom,
      'span[class*="beneficio--icone-imovel-funcional"]'
    );

    const auxilioMoradia = getSelectTextContentTrim(
      dom,
      'div[class*="beneficio__auxilio-moradia"] span'
    );

    const viagens = getSelectTextContentTrim(
      dom,
      'div[class*="beneficio__viagens"] span'
    );

    const [acessorAno, acessorAtivo] = gabinete
      .split(',')
      .map((d) => d.replace(/([^\d])+/gim, ''));

    return {
      gabinete,
      acessorAno,
      acessorAtivo: acessorAtivo ? acessorAtivo : acessorAno,
      salario,
      imovel,
      auxilioMoradia,
      viagens,
    };
  }

  async function getRecursosPeriodo({ idDeputado }) {
    // return Promise.all([
    //   getRecursos({ idDeputado, ano: 2019 }),
    //   getRecursos({ idDeputado, ano: 2020 }),
    // ]);
    const recursos2019 = await getRecursos({ idDeputado, ano: 2019 });
    const recursos2020 = await getRecursos({ idDeputado, ano: 2020 });
    return {
      recursos2019,
      recursos2020,
    };
  }

  async function getAtuacoes({ idDeputado, ano }) {
    const recursos = await axios.get(
      `https://www.camara.leg.br/deputados/${idDeputado}/_atuacao?ano=${ano}`
    );
    const dom = new JSDOM(recursos.data).window.document;

    const quantidades = dom.querySelectorAll('*[class="atuacao__quantidade"]');

    const resultado = {};

    if (typeof quantidades !== 'string') {
      resultado.autoria = {
        quantidade: quantidades[0].textContent.trim(),
        link: quantidades[0].href,
      };
      resultado.relatada = {
        quantidade: quantidades[1].textContent.trim(),
        link: quantidades[1].href,
      };
    } else {
      resultado.autoria = {
        quantidade: quantidades,
        link: quantidades,
      };
      resultado.relatada = {
        quantidade: quantidades,
        link: quantidades,
      };
    }

    const [
      plenarioPresenca,
      plenarioJustificada,
      plenarioNaoJustificada,
      comissaoPresenca,
      comissaoJustificada,
      comissaoNaoJustificada,
    ] = Array.from(
      dom.querySelectorAll('dd[class="list-table__definition-description"]')
    ).map((d) => d.textContent.trim());

    resultado.presencas = {
      plenario: {
        url: `https://www.camara.leg.br/deputados/${idDeputado}/presenca-plenario/${ano}`,
        presenca: plenarioPresenca,
        justificada: plenarioJustificada,
        naoJustificada: plenarioNaoJustificada,
      },
      comissao: {
        url: `https://www.camara.leg.br/deputados/${idDeputado}/presenca-comissoes?ano=${ano}`,
        presenca: comissaoPresenca,
        justificada: comissaoJustificada,
        naoJustificada: comissaoNaoJustificada,
      },
    };

    return resultado;
  }

  async function getAtuacoesPeriodo({ idDeputado }) {
    const atuacao2019 = await getAtuacoes({ idDeputado, ano: 2019 });
    const atuacao2020 = await getAtuacoes({ idDeputado, ano: 2020 });
    return [
      { ano: 2019, atuacao: atuacao2019 },
      { ano: 2020, atuacao: atuacao2020 },
    ];
  }

  async function getGastosPeriodo({ idDeputado }) {
    const periodo = [
      { ano: 2019, mes: [...Array(12).keys()].map((m) => m + 1) },
      { ano: 2020, mes: [...Array(4).keys()].map((m) => m + 1) },
    ];

    const urlPeriodo = [];

    periodo.forEach((p) => {
      p.mes.forEach((mes) =>
        urlPeriodo.push({
          periodo: `${p.ano}-${`0${mes}`.substr(-2)}`,
          url: `deputados/${idDeputado}/despesas?ano=${
            p.ano
          }&mes=${`0${mes}`.substr(-2)}&itens=100`,
        })
      );
    });

    // return Promise.all(
    //   urlPeriodo.map(async (p) => {
    //     return { periodo: p.periodo, dados: (await api.get(p.url)).data.dados };
    //   })
    // );

    const resultado = [];
    for (let i = 0; i < urlPeriodo.length; i += 1) {
      const p = urlPeriodo[i];
      resultado.push({
        periodo: p.periodo,
        dados: (await api.get(p.url)).data.dados,
      });
    }
    return resultado;
  }

  async function getInfo({ idDeputado }) {
    return (await api.get(`deputados/${idDeputado}`)).data.dados;
  }

  async function getInfoDeputados(deputadosGeral, siglaPartido) {
    const deputados = deputadosGeral.filter(
      (deputado) => deputado.siglaPartido === siglaPartido
    );

    // const deputadosGastos = await Promise.all(
    //   deputados.map(async (deputado) => {
    //     const { id: idDeputado } = deputado;
    //     const info = await Promise.all([
    //       getInfo({ idDeputado }),
    //       getRecursos({ idDeputado }),
    //       getGastos({ idDeputado }),
    //     ]);
    //     return info;
    //   })
    // );

    console.log(siglaPartido, deputados.length);

    const deputadosGastos = [];
    for (let i = 0; i < deputados.length; i += 1) {
      const deputado = deputados[i];
      const { id: idDeputado } = deputado;
      const info = {};
      info.info = await getInfo({ idDeputado });
      info.gastos = await getGastosPeriodo({ idDeputado });
      info.recursos = await getRecursosPeriodo({ idDeputado });
      info.atuacoes = await getAtuacoesPeriodo({ idDeputado });
      info.verbas = await getVerbasPeriodo({ idDeputado });
      deputadosGastos.push(info);
    }

    return deputadosGastos;
  }

  async function getPartidos() {
    const { data: partidos } = await api.get(
      'partidos?ordem=ASC&ordenarPor=sigla&itens=200'
    );
    const { dados: partidosDados } = partidos;
    const siglas = partidosDados.map((partido) => partido.sigla);

    const { data: deputados } = await api.get('deputados');
    const { dados: deputadosDados } = deputados;

    const arquivosPartidos = readdirSync('tmp');

    const siglasNaoBaixadas = siglas.filter(
      (s) => !arquivosPartidos.map((a) => a.replace('.json', '')).includes(s)
    );

    for (let i = 0; i < siglasNaoBaixadas.length; i++) {
      const sigla = siglasNaoBaixadas[i];
      const deputadosPartido = await getInfoDeputados(deputadosDados, sigla);
      writeFileSync(`tmp/${sigla}.json`, JSON.stringify(deputadosPartido));
    }
    console.log('fim');
  }

  function converteNumberText(text) {
    if (text.replace(/([^\d])+/gim, '') === '') return 0;
    return text.replace(/([^\d])+/gim, '') / 100;
  }

  async function run() {
    await getPartidos();
    const arquivosPartidos = readdirSync('tmp');
    const arquivos = arquivosPartidos.map((a) => a.replace('.json', ''));
    const todos = {};
    for (let k = 0; k < arquivos.length; k++) {
      const sigla = arquivos[k];
      const db = require(`../../../tmp/${sigla}.json`);
      todos[sigla] = db;
    }
    writeFileSync(`tmp/TODOS.json`, JSON.stringify(todos));

    const partidos = require(`../../../tmp/TODOS.json`);
    let deputados = [];
    Object.keys(partidos).forEach(
      (sigla) => (deputados = [...deputados, ...partidos[sigla]])
    );

    // 1.340.107,08‬ teto da verba de gabinete
    // maiores gasto somados

    const deputadoTotalizadorAno = deputados.map((deputado) => ({
      id: deputado.info.id,
      siglaPartido: deputado.info.ultimoStatus.siglaPartido,
      siglaUf: deputado.info.ultimoStatus.siglaUf,
      cpf: deputado.info.cpf,
      nome: deputado.info.nomeCivil,
      nomeEleitoral: deputado.info.ultimoStatus.nomeEleitoral,
      email: deputado.info.ultimoStatus.email,
      uri: `https://www.camara.leg.br/deputados/${deputado.info.id}`,

      salario2019: deputado.recursos.recursos2020.salario,
      salario2020: deputado.recursos.recursos2020.salario,

      imovel2019: deputado.recursos.recursos2019.imovel,
      imovel2020: deputado.recursos.recursos2020.imovel,

      auxilioMoradia2019: converteNumberText(
        deputado.recursos.recursos2019.auxilioMoradia
      ),
      auxilioMoradia2020: converteNumberText(
        deputado.recursos.recursos2020.auxilioMoradia
      ),

      atuacoesAutoria2019: deputado.atuacoes[0].atuacao.autoria.quantidade * 1,
      atuacoesRelatada2019:
        deputado.atuacoes[0].atuacao.relatada.quantidade * 1,
      atuacoesAutoria2020: deputado.atuacoes[1].atuacao.autoria.quantidade * 1,
      atuacoesRelatada2020:
        deputado.atuacoes[1].atuacao.relatada.quantidade * 1,

      presencaComissao2019:
        deputado.atuacoes[0].atuacao.presencas.comissao.presenca * 1,
      faltaComissao2019:
        deputado.atuacoes[0].atuacao.presencas.comissao.justificada * 1 +
        deputado.atuacoes[0].atuacao.presencas.comissao.naoJustificada * 1,
      presencaPlenario2019:
        deputado.atuacoes[0].atuacao.presencas.plenario.presenca * 1,
      faltaPlenario2019:
        deputado.atuacoes[0].atuacao.presencas.plenario.justificada * 1 +
        deputado.atuacoes[0].atuacao.presencas.plenario.naoJustificada * 1,

      presencaComissao2020:
        deputado.atuacoes[1].atuacao.presencas.comissao.presenca * 1,
      faltaComissao2020:
        deputado.atuacoes[1].atuacao.presencas.comissao.justificada * 1 +
        deputado.atuacoes[1].atuacao.presencas.comissao.naoJustificada * 1,
      presencaPlenario2020:
        deputado.atuacoes[1].atuacao.presencas.plenario.presenca * 1,
      faltaPlenario2020:
        deputado.atuacoes[1].atuacao.presencas.plenario.justificada * 1 +
        deputado.atuacoes[1].atuacao.presencas.plenario.naoJustificada * 1,

      acessores2019: deputado.recursos.recursos2019.acessorAtivo * 1,
      verbasGabinete2019: deputado.verbas[0].verbas.gasto.valor,
      acessores2020: deputado.recursos.recursos2020.acessorAtivo * 1,
      verbasGabinete2020: deputado.verbas[1].verbas.gasto.valor,

      cotaPalamentar2019: deputado.gastos
        .filter((g) => g.periodo.substring(0, 4) === '2019')
        .map((g) =>
          g.dados.map((d) => d.valorLiquido).reduce((a, b) => a + b, 0)
        )
        .reduce((a, b) => a + b, 0),

      cotaPalamentar2020: deputado.gastos
        .filter((g) => g.periodo.substring(0, 4) === '2020')
        .map((g) =>
          g.dados.map((d) => d.valorLiquido).reduce((a, b) => a + b, 0)
        )
        .reduce((a, b) => a + b, 0),
    }));

    const deputadoTotalizador = deputadoTotalizadorAno
      .map((d) => ({
        id: d.id,
        siglaPartido: d.siglaPartido,
        siglaUf: d.siglaUf,
        cpf: d.cpf,
        nome: d.nome,
        nomeEleitoral: d.nomeEleitoral,
        email: d.email,
        uri: d.uri,

        salario: d.salario2020,

        imovel2019: d.imovel2019,
        imovel2020: d.imovel2020,

        auxilioMoradia: d.auxilioMoradia2019 + d.auxilioMoradia2020,

        atuacoesAutoria: d.atuacoesAutoria2019 + d.atuacoesAutoria2020,
        atuacoesRelatada: d.atuacoesRelatada2019 + d.atuacoesRelatada2020,

        presencaComissao: d.presencaComissao2019 + d.presencaComissao2020,
        faltaComissao: d.faltaComissao2019 + d.faltaComissao2020,
        presencaPlenario: d.presencaPlenario2019 + d.presencaPlenario2020,
        faltaPlenario: d.faltaPlenario2019 + d.faltaPlenario2020,

        acessores2019: d.acessores2019,
        acessores2020: d.acessores2020,
        verbasGabinete: d.verbasGabinete2019 + d.verbasGabinete2020,

        cotaPalamentar: d.cotaPalamentar2019 + d.cotaPalamentar2020,
      }))
      .map((d) => ({
        ...d,
        auxilioCotaVerbas:
          d.auxilioMoradia + d.cotaPalamentar + d.verbasGabinete,
      }));

    deputadoTotalizador.sort((current, next) => {
      const campos = ['auxilioCotaVerbas']; // ['auxilioMoradia', 'cotaPalamentar', 'verbasGabinete'];
      const currentTotal = campos
        .map((c) => current[c])
        .reduce((a, b) => a + b);
      const nextTotal = campos.map((c) => next[c]).reduce((a, b) => a + b);

      if (currentTotal > nextTotal) return 1;
      if (currentTotal < nextTotal) return -1;
      return 0;
    });

    const gastos = new Map();
    deputados.forEach((d) =>
      d.gastos.forEach((g) =>
        g.dados.forEach((c) => {
          let gasto = gastos.get(d.info.id);
          if (!gasto) {
            gastos.set(d.info.id, {
              id: d.info.id,
              siglaPartido: d.info.ultimoStatus.siglaPartido,
              siglaUf: d.info.ultimoStatus.siglaUf,
              cpf: d.info.cpf,
              nome: d.info.nomeCivil,
              nomeEleitoral: d.info.ultimoStatus.nomeEleitoral,
              email: d.info.ultimoStatus.email,
              uri: `https://www.camara.leg.br/deputados/${d.info.id}`,
            });
            gasto = gastos.get(d.info.id);
          }
          if (!gasto[c.tipoDespesa]) gasto[c.tipoDespesa] = 0;

          gasto[c.tipoDespesa] += c.valorLiquido;
        })
      )
    );

    writeFileSync(
      `tmp/TOTALIZADORES.json`,
      JSON.stringify(deputadoTotalizador)
    );

    writeFileSync(
      `tmp/TOTALIZADORES_CONTAS.json`,
      JSON.stringify([...gastos.values()])
    );

    return deputadoTotalizador;
  }

  return { run };
}

export default createDeputados;
