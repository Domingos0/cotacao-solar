// Normaliza texto pra busca: minúsculas + sem acento. Usado pela busca do
// catálogo e pela busca de cidade — nenhuma das duas tolerava acento antes
// (ex: buscar "sao paulo" não encontrava "São Paulo", "ferreira" não achava
// "Ferreira" com acento em outro lugar do nome).
export function normalizeSearch(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Igual a normalizeSearch, mas também remove espaços — usado pra comparar
// códigos de modelo, onde "siw 300h" precisa achar "SIW300H" mesmo com
// espaço(s) extra em qualquer um dos dois lados.
export function normalizeSearchCompact(s) {
  return normalizeSearch(s).replace(/\s+/g, '')
}
