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
