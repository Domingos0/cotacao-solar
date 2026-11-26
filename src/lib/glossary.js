// Explicações curtas de termos técnicos usados no Monte seu Kit e no
// Dimensionar Bateria — fonte única pro componente InfoTip (item 27),
// pra não espalhar o mesmo texto reescrito em cada lugar que usa o termo.
export const GLOSSARY = {
  overload: 'Quanto a potência CC dos módulos pode superar a potência CA do inversor, dentro do limite do fabricante. Em dias/horários de pico a geração fica "cortada" (clipping), mas no total do ano o ganho extra de potência instalada costuma compensar.',
  superdim: 'Oposto do overload: a potência instalada de módulos fica abaixo da potência do inversor. O sistema funciona normalmente, só não aproveita 100% da capacidade do inversor.',
  mesaDupla: 'Estrutura de solo projetada pra um número PAR de módulos (duas fileiras simétricas). Com quantidade ímpar ainda funciona, mas o preço é cobrado pelo par cheio seguinte.',
  regiaoVento: 'Região climática conforme o mapa de isopletas de vento da WEG — define a velocidade de vento de projeto (m/s) usada pra calcular a estrutura de fixação correta pro telhado ou solo.',
  hsp: 'Horas de Sol Pico: quantidade de horas-equivalentes de sol a 1.000 W/m² que a região recebe por dia. Quanto maior o HSP, mais energia o sistema gera por kWp instalado.',
  cRate: 'Taxa relativa de carga/descarga de uma bateria em relação à sua capacidade nominal (ex: 0,5C = carrega ou descarrega totalmente em 2h). Não é fator de potência nem tensão.',
}
