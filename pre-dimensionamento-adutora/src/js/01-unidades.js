/* ------------------------------------------------------------------
 * Unidades e conversões
 * Todas as conversões levam para as unidades internas (SI):
 *   vazão      -> m³/s
 *   extensão   -> m
 *   diâmetro   -> m
 *   pressão    -> mca
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var U = {};

  U.vazao = {
    'L/s':    { f: 1e-3,          rot: 'L/s' },
    'm³/h':   { f: 1 / 3600,      rot: 'm³/h' },
    'm³/s':   { f: 1,             rot: 'm³/s' },
    'm³/dia': { f: 1 / 86400,     rot: 'm³/dia' },
    'L/min':  { f: 1e-3 / 60,     rot: 'L/min' },
    'L/dia':  { f: 1e-3 / 86400,  rot: 'L/dia' },
    'gpm':    { f: 6.30902e-5,    rot: 'gpm (US)' }
  };

  U.extensao = {
    'm':  { f: 1,      rot: 'm' },
    'km': { f: 1000,   rot: 'km' },
    'cm': { f: 0.01,   rot: 'cm' },
    'ft': { f: 0.3048, rot: 'ft' },
    'mi': { f: 1609.34, rot: 'mi' }
  };

  U.diametro = {
    'mm': { f: 1e-3,    rot: 'mm' },
    'cm': { f: 1e-2,    rot: 'cm' },
    'm':  { f: 1,       rot: 'm' },
    'pol':{ f: 0.0254,  rot: 'pol' }
  };

  U.cota = {
    'm':  { f: 1,      rot: 'm' },
    'cm': { f: 0.01,   rot: 'cm' },
    'ft': { f: 0.3048, rot: 'ft' }
  };

  U.pressao = {
    'mca': { f: 1,        rot: 'mca' },
    'kPa': { f: 0.101972, rot: 'kPa' },
    'bar': { f: 10.1972,  rot: 'bar' },
    'MPa': { f: 101.972,  rot: 'MPa' },
    'kgf/cm²': { f: 10,   rot: 'kgf/cm²' },
    'psi': { f: 0.703070, rot: 'psi' }
  };

  U.potencia = {
    'cv': { f: 1,          rot: 'cv' },
    'kW': { f: 1 / 0.7355, rot: 'kW' },
    'hp': { f: 1.01387,    rot: 'hp' }
  };

  /* converte valor da unidade informada para a unidade interna */
  U.para = function (grandeza, valor, unidade) {
    var t = U[grandeza];
    if (!t) throw new Error('Grandeza desconhecida: ' + grandeza);
    var u = t[unidade];
    if (!u) throw new Error('Unidade desconhecida: ' + unidade + ' (' + grandeza + ')');
    return Number(valor) * u.f;
  };

  /* converte da unidade interna para a unidade informada */
  U.de = function (grandeza, valorSI, unidade) {
    var t = U[grandeza];
    var u = t[unidade];
    if (!u) throw new Error('Unidade desconhecida: ' + unidade + ' (' + grandeza + ')');
    return Number(valorSI) / u.f;
  };

  U.lista = function (grandeza) {
    return Object.keys(U[grandeza]);
  };

  PDA.U = U;
})(window.PDA = window.PDA || {});
