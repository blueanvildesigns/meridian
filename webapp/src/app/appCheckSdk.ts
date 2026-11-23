// The Firebase SDK parts App Check needs, in one module so that `appCheck.ts`'s single dynamic
// import makes one lazy chunk: one request on Send, and no preload map in the entry script.

export { initializeApp } from 'firebase/app';
export {
  getLimitedUseToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
