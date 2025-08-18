export function h(type, props, ...children) {
    props = props ? { ...props } : {};
    const flat = children.flat().filter((c) => c != null);
    props.children = flat.length === 1 ? flat[0] : flat;
    return { type, props };
}
export function Fragment(props) {
    return props.children;
}
