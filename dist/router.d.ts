type PageComponent = (props?: any) => any;
export declare function initRouter(routeModules: Record<string, any>, renderFn: (comp: PageComponent) => void): void;
export declare function getCurrentPath(): string;
export declare function getCurrentQuery(): Record<string, string>;
export declare function getCurrentHash(): string;
export declare function navigateTo(pathOrHref: string, renderFn: (comp: PageComponent) => void, push?: boolean): Promise<void>;
export {};
