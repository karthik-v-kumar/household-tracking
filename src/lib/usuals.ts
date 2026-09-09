import type { Usual } from "./types";

export function usualBelongsToList(usual: Usual, listId: number) {
  if (usual.listIds.length > 0) return usual.listIds.includes(listId);
  if (usual.defaultListId == null) return true;
  return usual.defaultListId === listId;
}
