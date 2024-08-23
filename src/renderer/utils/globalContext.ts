import mitt, { Emitter } from 'mitt';

export const globalContext: {
  emitter: Emitter<any>;
} = {
  emitter: mitt(),
};

// import mitt, { Emitter } from 'mitt';

// export type Events = {
//   SEAM_EVENT_TOGGLE_MOBILE: "mobile" | "desktop";
//   SEAM_EVENT_TOGGLE_MODE: "edit" | "view";
// };

// declare global {
//   interface Window {
//     emitter: Emitter<Any>;
//   }
// }

// window.emitter = mitt();
