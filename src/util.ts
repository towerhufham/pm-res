export const shuffle = <T>(array: T[]) => {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

// Move an object one step lower (towards start)
export const moveDown = <T>(arr: T[], obj: T): T[] => {
  const index = arr.indexOf(obj);
  if (index > 0) {
    arr.splice(index, 1);
    arr.splice(index - 1, 0, obj);
  }
  return arr;
}

// Move an object one step up (towards end)
export const moveUp = <T>(arr: T[], obj: T): T[] => {
  const index = arr.indexOf(obj);
  if (index !== -1 && index < arr.length - 1) {
    arr.splice(index, 1);
    arr.splice(index + 1, 0, obj);
  }
  return arr;
}
