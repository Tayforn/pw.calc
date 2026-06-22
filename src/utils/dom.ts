// Короткі хелпери для вибірки DOM-елементів.

export const $ = <T extends Element = Element>(
  sel: string,
  el: ParentNode = document,
): T | null => el.querySelector<T>(sel);

export const $$ = <T extends Element = Element>(
  sel: string,
  el: ParentNode = document,
): T[] => Array.from(el.querySelectorAll<T>(sel));
