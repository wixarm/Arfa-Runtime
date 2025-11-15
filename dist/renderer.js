import { createComponentInstance, setCurrentInstance, clearCurrentInstance, runMounted, cleanupComponentInstance, registerInstanceRerender, triggerEffectsForAllInstances, } from "arfa-reactives";
const trackedInstances = [];
function findTracked(id) {
    return trackedInstances.find((t) => t.id === id);
}
export function cleanupAll() {
    for (let i = trackedInstances.length - 1; i >= 0; i--) {
        try {
            cleanupComponentInstance(trackedInstances[i].id);
        }
        catch { }
    }
    trackedInstances.length = 0;
}
export function render(vnode, container) {
    const dom = createDomElement(vnode);
    container.appendChild(dom);
    if (dom.__instanceId) {
        const id = dom.__instanceId;
        const compFn = dom.__componentFn;
        const props = dom.__props;
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
            }
            catch (e) {
                console.error("Error running mounted hooks:", e);
            }
        }
    }
}
function isVNode(node) {
    return typeof node === "object" && node !== null && "type" in node;
}
function createDomElement(vnode) {
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
                if (!tracked)
                    return;
                try {
                    setCurrentInstance(instanceId);
                    const newVNode = tracked.componentFn({
                        ...(tracked.props || {}),
                        __instanceId: instanceId,
                    });
                    clearCurrentInstance();
                    patchElement(tracked.rootNode, newVNode, tracked.parent);
                    requestAnimationFrame(() => {
                        try {
                            triggerEffectsForAllInstances();
                        }
                        catch (e) {
                            console.error(e);
                        }
                    });
                }
                catch (err) {
                    console.error("instance rerender error", err);
                }
                finally {
                    clearCurrentInstance();
                }
            };
            registerInstanceRerender(instanceId, rerender);
            setCurrentInstance(instanceId);
            let componentResult;
            try {
                componentResult = vnode.type({
                    ...(vnode.props || {}),
                    __instanceId: instanceId,
                });
            }
            finally {
                clearCurrentInstance();
            }
            const dom = createDomElement(componentResult);
            dom.__instanceId = instanceId;
            dom.__componentFn = vnode.type;
            dom.__props = vnode.props ?? {};
            dom.__vnode = vnode;
            return dom;
        }
        const domElement = document.createElement(vnode.type);
        const { children, ref, ...props } = vnode.props ?? {};
        if (props && typeof props === "object") {
            Object.keys(props).forEach((name) => {
                const value = props[name];
                if (name.startsWith("on") && typeof value === "function") {
                    const event = name.slice(2).toLowerCase();
                    domElement.addEventListener(event, value);
                }
                else if (name === "class" || name === "className") {
                    if (value != null) {
                        domElement.setAttribute("class", String(value));
                    }
                }
                else if (name === "style" && typeof value === "object") {
                    Object.assign(domElement.style, value);
                }
                else if (name === "dangerouslySetInnerHTML" &&
                    value &&
                    value.__html) {
                    domElement.innerHTML = value.__html;
                }
                else if (value != null && value !== false) {
                    domElement.setAttribute(name, String(value));
                }
            });
        }
        if (ref) {
            if (typeof ref === "function") {
                ref(domElement);
            }
            else if (ref && typeof ref === "object" && "current" in ref) {
                ref.current = domElement;
            }
        }
        renderChildren(children, domElement);
        domElement.__vnode = vnode;
        return domElement;
    }
    return document.createTextNode("");
}
function patchElement(oldNode, newVNode, parent) {
    if (oldNode.nodeType === Node.TEXT_NODE) {
        if (typeof newVNode === "string" || typeof newVNode === "number") {
            if (oldNode.textContent !== String(newVNode)) {
                oldNode.textContent = String(newVNode);
            }
            return;
        }
        const newNode = createDomElement(newVNode);
        parent.replaceChild(newNode, oldNode);
        trackNewInstances(newNode, parent);
        return;
    }
    if (oldNode.nodeType === Node.ELEMENT_NODE) {
        const oldEl = oldNode;
        const oldVNode = oldEl.__vnode;
        if (isVNode(newVNode)) {
            if (typeof newVNode.type === "function") {
                const instanceId = oldEl.__instanceId;
                if (instanceId) {
                    const tracked = findTracked(instanceId);
                    if (tracked) {
                        tracked.props = newVNode.props ?? {};
                        setCurrentInstance(instanceId);
                        const rendered = tracked.componentFn(tracked.props || {});
                        clearCurrentInstance();
                        patchElement(oldNode, rendered, parent);
                        return;
                    }
                }
            }
            if (typeof newVNode.type === "string" &&
                oldEl.tagName.toLowerCase() === newVNode.type) {
                patchProps(oldEl, oldVNode?.props, newVNode.props);
                patchChildren(oldEl, oldVNode?.props?.children, newVNode.props?.children);
                oldEl.__vnode = newVNode;
                return;
            }
        }
        const newNode = createDomElement(newVNode);
        parent.replaceChild(newNode, oldNode);
        trackNewInstances(newNode, parent);
    }
    else {
        const newNode = createDomElement(newVNode);
        parent.replaceChild(newNode, oldNode);
        trackNewInstances(newNode, parent);
    }
}
function patchProps(el, oldProps, newProps) {
    const old = oldProps ?? {};
    const next = newProps ?? {};
    const allKeys = new Set([...Object.keys(old), ...Object.keys(next)]);
    for (const key of allKeys) {
        if (key === "children" || key === "ref" || key === "key")
            continue;
        const oldVal = old[key];
        const newVal = next[key];
        if (oldVal === newVal)
            continue;
        if (key.startsWith("on") && typeof newVal === "function") {
            const event = key.slice(2).toLowerCase();
            if (typeof oldVal === "function") {
                el.removeEventListener(event, oldVal);
            }
            el.addEventListener(event, newVal);
        }
        else if (key === "class" || key === "className") {
            if (newVal != null) {
                el.setAttribute("class", String(newVal));
            }
            else {
                el.removeAttribute("class");
            }
        }
        else if (key === "style" && typeof newVal === "object") {
            if (oldVal && typeof oldVal === "object") {
                Object.keys(oldVal).forEach((k) => {
                    if (!(k in newVal)) {
                        el.style[k] = "";
                    }
                });
            }
            Object.assign(el.style, newVal);
        }
        else if (key === "dangerouslySetInnerHTML") {
            if (newVal && newVal.__html) {
                el.innerHTML = newVal.__html;
            }
            else {
                el.innerHTML = "";
            }
        }
        else if (newVal != null && newVal !== false) {
            el.setAttribute(key, String(newVal));
        }
        else {
            el.removeAttribute(key);
        }
    }
}
function patchChildren(parent, oldChildren, newChildren) {
    const oldNodes = Array.from(parent.childNodes);
    const oldKeys = new Map();
    const newVNodes = Array.isArray(newChildren)
        ? newChildren
        : newChildren != null
            ? [newChildren]
            : [];
    oldNodes.forEach((node, idx) => {
        const vnode = node.__vnode;
        const key = vnode?.key ?? idx;
        oldKeys.set(key, node);
    });
    const newKeys = new Map();
    newVNodes.forEach((vnode, idx) => {
        const key = isVNode(vnode) ? vnode.key ?? idx : idx;
        newKeys.set(key, vnode);
    });
    let oldIdx = 0;
    let newIdx = 0;
    while (newIdx < newVNodes.length) {
        const newVNode = newVNodes[newIdx];
        const newKey = isVNode(newVNode) ? newVNode.key ?? newIdx : newIdx;
        const oldNode = oldKeys.get(newKey);
        if (oldNode && oldIdx < oldNodes.length && oldNode === oldNodes[oldIdx]) {
            patchElement(oldNode, newVNode, parent);
            oldIdx++;
        }
        else if (oldNode) {
            const nextOld = oldIdx < oldNodes.length ? oldNodes[oldIdx] : null;
            if (nextOld) {
                parent.insertBefore(oldNode, nextOld);
            }
            else {
                parent.appendChild(oldNode);
            }
            patchElement(oldNode, newVNode, parent);
        }
        else {
            const newNode = createDomElement(newVNode);
            const nextOld = oldIdx < oldNodes.length ? oldNodes[oldIdx] : null;
            if (nextOld) {
                parent.insertBefore(newNode, nextOld);
            }
            else {
                parent.appendChild(newNode);
            }
            trackNewInstances(newNode, parent);
        }
        newIdx++;
    }
    while (oldIdx < oldNodes.length) {
        const oldNode = oldNodes[oldIdx];
        if (!newKeys.has(oldNode.__vnode?.key ?? oldIdx)) {
            parent.removeChild(oldNode);
        }
        oldIdx++;
    }
}
function trackNewInstances(node, parent) {
    if (node.__instanceId) {
        const id = node.__instanceId;
        if (!trackedInstances.some((t) => t.id === id)) {
            const compFn = node.__componentFn;
            const props = node.__props;
            trackedInstances.push({
                id,
                parent,
                anchor: null,
                rootNode: node,
                componentFn: compFn,
                props,
            });
            try {
                runMounted(id);
            }
            catch { }
        }
    }
    if (node.nodeType === Node.ELEMENT_NODE ||
        node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        Array.from(node.childNodes).forEach((child) => {
            trackNewInstances(child, node);
        });
    }
}
function renderChildren(children, parent) {
    if (Array.isArray(children)) {
        children.forEach((child) => {
            const childNode = createDomElement(child);
            parent.appendChild(childNode);
            trackNewInstances(childNode, parent);
        });
    }
    else if (children != null && children !== false && children !== true) {
        const childNode = createDomElement(children);
        parent.appendChild(childNode);
        trackNewInstances(childNode, parent);
    }
}
