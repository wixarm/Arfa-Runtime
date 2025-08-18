import {
  createComponentInstance,
  setCurrentInstance,
  clearCurrentInstance,
  runMounted,
  cleanupComponentInstance,
  registerInstanceRerender,
  triggerEffectsForAllInstances,
} from "arfa-reactives";

export interface VNode {
  type: string | Function;
  props: Record<string, any> & { children?: any };
}

type Child = VNode | string | number | boolean | null | Child[];

type TrackedInstance = {
  id: symbol;
  parent: Node;
  anchor: Node | null;
  rootNode: Node;
  componentFn: Function;
  props: any;
};

const trackedInstances: TrackedInstance[] = [];

function findTracked(id: symbol): TrackedInstance | undefined {
  return trackedInstances.find((t) => t.id === id);
}

export function cleanupAll() {
  for (let i = trackedInstances.length - 1; i >= 0; i--) {
    try {
      cleanupComponentInstance(trackedInstances[i].id);
    } catch {}
  }
  trackedInstances.length = 0;
}

export function render(vnode: Child | any, container: HTMLElement) {
  const dom = createDomElement(vnode);
  container.appendChild(dom);

  if ((dom as any).__instanceId) {
    const id: symbol = (dom as any).__instanceId;
    const compFn: Function = (dom as any).__componentFn;
    const props = (dom as any).__props;

    if (!trackedInstances.some((t) => t.id === id)) {
      trackedInstances.push({
        id,
        parent: container,
        anchor: null,
        rootNode: dom,
        componentFn: compFn,
        props,
      });

      try {
        runMounted(id);
      } catch (e) {
        console.error("Error running mounted hooks:", e);
      }
    }
  }
}

function isVNode(node: any): node is VNode {
  return typeof node === "object" && node !== null && "type" in node;
}

function createDomElement(vnode: Child): Node {
  if (vnode == null || vnode === false || vnode === true) {
    return document.createTextNode("");
  }

  if (Array.isArray(vnode)) {
    const fragment = document.createDocumentFragment();
    vnode.forEach((child) => fragment.appendChild(createDomElement(child)));
    return fragment;
  }

  if (typeof vnode === "string" || typeof vnode === "number") {
    return document.createTextNode(String(vnode));
  }

  if (isVNode(vnode)) {
    if (typeof vnode.type === "function") {
      if (vnode.props?.__instanceId) {
        const id = vnode.props.__instanceId;
        const tracked = findTracked(id);
        if (tracked) {
          tracked.props = vnode.props ?? {};
          setCurrentInstance(id);
          const newVNode = tracked.componentFn(tracked.props || {});
          clearCurrentInstance();
          return createDomElement(newVNode);
        }
      }

      const instanceId = createComponentInstance();

      const rerender = () => {
        const tracked = findTracked(instanceId);
        if (!tracked) return;
        try {
          setCurrentInstance(instanceId);
          const newVNode = tracked.componentFn({
            ...(tracked.props || {}),
            __instanceId: instanceId,
          });
          clearCurrentInstance();

          const newDom = createDomElement(newVNode);

          // preserve instance metadata on the new root node
          (newDom as any).__instanceId = instanceId;
          (newDom as any).__componentFn = tracked.componentFn;
          (newDom as any).__props = tracked.props ?? {};

          // replace old root node with the new one
          tracked.parent.replaceChild(newDom, tracked.rootNode);
          tracked.rootNode = newDom;

          requestAnimationFrame(() => {
            try {
              triggerEffectsForAllInstances();
            } catch (e) {
              console.error(e);
            }
          });
        } catch (err) {
          console.error("instance rerender error", err);
        } finally {
          clearCurrentInstance();
        }
      };

      registerInstanceRerender(instanceId, rerender);

      setCurrentInstance(instanceId);
      let componentResult: any;
      try {
        componentResult = vnode.type({
          ...(vnode.props || {}),
          __instanceId: instanceId,
        });
      } finally {
        clearCurrentInstance();
      }

      const dom = createDomElement(componentResult);
      (dom as any).__instanceId = instanceId;
      (dom as any).__componentFn = vnode.type;
      (dom as any).__props = vnode.props ?? {};

      return dom;
    }

    const domElement = document.createElement(vnode.type as string);

    const { children, ...props } = vnode.props ?? {};
    if (props && typeof props === "object") {
      Object.keys(props).forEach((name) => {
        const value = props[name];
        if (name.startsWith("on") && typeof value === "function") {
          const event = name.slice(2).toLowerCase();
          domElement.addEventListener(event, value);
        } else if (name === "class" || name === "className") {
          domElement.setAttribute("class", value);
        } else {
          domElement.setAttribute(name, value);
        }
      });
    }

    renderChildren(children, domElement);
    return domElement;
  }

  return document.createTextNode("");
}

function renderChildren(children: any, parent: Node) {
  if (Array.isArray(children)) {
    children.forEach((child) => {
      const childNode = createDomElement(child);
      parent.appendChild(childNode);
      if ((childNode as any).__instanceId) {
        const id: symbol = (childNode as any).__instanceId;
        if (!trackedInstances.some((t) => t.id === id)) {
          const compFn: Function = (childNode as any).__componentFn;
          const props = (childNode as any).__props;
          trackedInstances.push({
            id,
            parent,
            anchor: null,
            rootNode: childNode,
            componentFn: compFn,
            props,
          });
          try {
            runMounted(id);
          } catch {}
        }
      }
    });
  } else if (children != null && children !== false && children !== true) {
    const childNode = createDomElement(children);
    parent.appendChild(childNode);
    if ((childNode as any).__instanceId) {
      const id: symbol = (childNode as any).__instanceId;
      if (!trackedInstances.some((t) => t.id === id)) {
        const compFn: Function = (childNode as any).__componentFn;
        const props = (childNode as any).__props;
        trackedInstances.push({
          id,
          parent,
          anchor: null,
          rootNode: childNode,
          componentFn: compFn,
          props,
        });
        try {
          runMounted(id);
        } catch {}
      }
    }
  }
}
