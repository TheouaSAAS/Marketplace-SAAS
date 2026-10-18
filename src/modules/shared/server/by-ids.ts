/**
 * Remet des lignes lues par identifiants dans l'ordre demandé (celui du
 * classement de la recherche). Une ligne devenue invisible entre-temps
 * (retirée, expirée) est simplement absente.
 */
export function orderByIds<T extends { id: string }>(rows: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
