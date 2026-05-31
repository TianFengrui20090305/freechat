/* CDN globals from unpkg */
declare const Vue: {
  createApp(obj: any): any;
  reactive<T extends object>(obj: T): T;
  computed<T>(fn: () => T): any;
  ref<T>(val: T): { value: T };
  defineComponent(obj: any): any;
};

declare namespace VueRouter {
  function createRouter(opts: any): any;
  function createWebHashHistory(): any;
}

/* Cloudflare Turnstile (loaded from challenges.cloudflare.com) */
interface TurnstileObject {
  render(container: HTMLElement | string, options: {
    sitekey: string;
    callback?: (token: string) => void;
    ['error-callback']?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
  }): string | undefined;
  reset(widgetId: string | undefined): void;
  getResponse(widgetId: string | undefined): string;
  remove(widgetId: string | undefined): void;
}

declare const turnstile: TurnstileObject;
