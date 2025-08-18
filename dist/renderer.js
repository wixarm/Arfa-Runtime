"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAll = cleanupAll;
exports.render = render;
const arfa_reactives_1 = require("arfa-reactives");
const trackedInstances = [];
function findTracked(id) {
    return trackedInstances.find((t) => t.id === id);
}
function cleanupAll() {
    for (let i = trackedInstances.length - 1; i >= 0; i--) {
        try {
            (0, arfa_reactives_1.cleanupComponentInstance)(trackedInstances[i].id);
        }
        catch { }
    }
    trackedInstances.length = 0;
}
function render(vnode, container) {
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
                (0, arfa_reactives_1.runMounted)(id);
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
                    (0, arfa_reactives_1.setCurrentInstance)(id);
                    const newVNode = tracked.componentFn(tracked.props || {});
                    (0, arfa_reactives_1.clearCurrentInstance)();
                    return createDomElement(newVNode);
                }
            }
            const instanceId = (0, arfa_reactives_1.createComponentInstance)();
            const rerender = () => {
                const tracked = findTracked(instanceId);
                if (!tracked)
                    return;
                try {
                    (0, arfa_reactives_1.setCurrentInstance)(instanceId);
                    const newVNode = tracked.componentFn({
                        ...(tracked.props || {}),
                        __instanceId: instanceId,
                    });
                    (0, arfa_reactives_1.clearCurrentInstance)();
                    const newDom = createDomElement(newVNode);
                    // preserve instance metadata on the new root node
                    newDom.__instanceId = instanceId;
                    newDom.__componentFn = tracked.componentFn;
                    newDom.__props = tracked.props ?? {};
                    // replace old root node with the new one
                    tracked.parent.replaceChild(newDom, tracked.rootNode);
                    tracked.rootNode = newDom;
                    requestAnimationFrame(() => {
                        try {
                            (0, arfa_reactives_1.triggerEffectsForAllInstances)();
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
                    (0, arfa_reactives_1.clearCurrentInstance)();
                }
            };
            (0, arfa_reactives_1.registerInstanceRerender)(instanceId, rerender);
            (0, arfa_reactives_1.setCurrentInstance)(instanceId);
            let componentResult;
            try {
                componentResult = vnode.type({
                    ...(vnode.props || {}),
                    __instanceId: instanceId,
                });
            }
            finally {
                (0, arfa_reactives_1.clearCurrentInstance)();
            }
            const dom = createDomElement(componentResult);
            dom.__instanceId = instanceId;
            dom.__componentFn = vnode.type;
            dom.__props = vnode.props ?? {};
            return dom;
        }
        const domElement = document.createElement(vnode.type);
        const { children, ...props } = vnode.props ?? {};
        if (props && typeof props === "object") {
            Object.keys(props).forEach((name) => {
                const value = props[name];
                if (name.startsWith("on") && typeof value === "function") {
                    const event = name.slice(2).toLowerCase();
                    domElement.addEventListener(event, value);
                }
                else if (name === "class" || name === "className") {
                    domElement.setAttribute("class", value);
                }
                else {
                    domElement.setAttribute(name, value);
                }
            });
        }
        renderChildren(children, domElement);
        return domElement;
    }
    return document.createTextNode("");
}
function renderChildren(children, parent) {
    if (Array.isArray(children)) {
        children.forEach((child) => {
            const childNode = createDomElement(child);
            parent.appendChild(childNode);
            if (childNode.__instanceId) {
                const id = childNode.__instanceId;
                if (!trackedInstances.some((t) => t.id === id)) {
                    const compFn = childNode.__componentFn;
                    const props = childNode.__props;
                    trackedInstances.push({
                        id,
                        parent,
                        anchor: null,
                        rootNode: childNode,
                        componentFn: compFn,
                        props,
                    });
                    try {
                        (0, arfa_reactives_1.runMounted)(id);
                    }
                    catch { }
                }
            }
        });
    }
    else if (children != null && children !== false && children !== true) {
        const childNode = createDomElement(children);
        parent.appendChild(childNode);
        if (childNode.__instanceId) {
            const id = childNode.__instanceId;
            if (!trackedInstances.some((t) => t.id === id)) {
                const compFn = childNode.__componentFn;
                const props = childNode.__props;
                trackedInstances.push({
                    id,
                    parent,
                    anchor: null,
                    rootNode: childNode,
                    componentFn: compFn,
                    props,
                });
                try {
                    (0, arfa_reactives_1.runMounted)(id);
                }
                catch { }
            }
        }
    }
}
