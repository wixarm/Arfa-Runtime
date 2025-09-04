interface VNode {
    type: string | Function;
    props: Record<string, any>;
    key?: string | number | null;
    ref?: any;
}
export declare function h(type: string | Function, props: Record<string, any> | null, ...children: any[]): VNode;
export declare function Fragment(props: {
    children?: any;
}): any;
export {};
