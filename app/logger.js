export const log = (...a) => console.log(new Date().toISOString(), ...a);
export const warn = (...a) => console.warn(new Date().toISOString(), ...a);
export const err  = (...a) => console.error(new Date().toISOString(), ...a);
