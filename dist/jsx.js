export function h(type, props, ...children) {
    const normalizedProps = props ? { ...props } : {};
    let key = null;
    let ref = null;
    if (normalizedProps.hasOwnProperty("key")) {
        key = normalizedProps.key;
        delete normalizedProps.key;
    }
    if (normalizedProps.hasOwnProperty("ref")) {
        ref = normalizedProps.ref;
        delete normalizedProps.ref;
    }
    const flatChildren = children.flat(Infinity);
    const filteredChildren = flatChildren.filter((child) => child != null && child !== false && child !== true);
    normalizedProps.children =
        filteredChildren.length === 1 ? filteredChildren[0] : filteredChildren;
    const vnode = { type, props: normalizedProps };
    if (key !== null && key !== undefined) {
        vnode.key = key;
    }
    if (ref !== null && ref !== undefined) {
        vnode.ref = ref;
    }
    return vnode;
}
export function Fragment(props) {
    const children = Array.isArray(props.children)
        ? props.children
        : [props.children];
    return children.filter((child) => child != null && child !== false && child !== true);
}
