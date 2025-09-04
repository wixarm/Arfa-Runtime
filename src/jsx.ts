export function h(
  type: string | Function,
  props: Record<string, any> | null,
  ...children: any[]
) {
  props = props ? { ...props } : {};
  const flat = children.flat().filter((c) => c != null);
  props.children = flat.length === 1 ? flat[0] : flat;
  return { type, props };
}

export function Fragment(props: { children?: any }) {
  return props.children;
}
