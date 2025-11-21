export const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const randomInRange = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

