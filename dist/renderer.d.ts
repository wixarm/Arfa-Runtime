export interface VNode {
    type: string | Function;
    props: Record<string, any> & {
        children?: any;
    };
}
type Child = VNode | string | number | boolean | null | Child[];
export declare function cleanupAll(): void;
export declare function render(vnode: Child | any, container: HTMLElement): void;
export {};
