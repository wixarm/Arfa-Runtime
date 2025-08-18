let routes = [];
let layoutsByDir = {};
let layoutGuardsByDir = {};
let layoutGuardRedirectByDir = {};
let appWrapper = null;
let notFoundPage = null;
const NotFound = () => ({
    type: "div",
    props: { children: "404 - Not Found" },
});
function filePathToRouteInfo(filePath, component) {
    let routePath = filePath
        .replace(/^\.\/pages/, "")
        .replace(/\.(t|j)sx?$/, "")
        .replace(/\/index$/, "") || "/";
    const paramNames = [];
    let isDynamic = false;
    const segments = routePath.split("/").filter(Boolean);
    if (segments.length === 0) {
        return {
            filePath,
            routePath: "/",
            isDynamic: false,
            paramNames: [],
            component,
            dirPath: "/",
        };
    }
    const regexParts = segments.map((seg) => {
        const match = seg.match(/^\[(\.\.\.)?(.+?)\]$/);
        if (match) {
            isDynamic = true;
            const isCatchAll = !!match[1];
            const name = match[2];
            paramNames.push(name);
            return isCatchAll ? "(.+)" : "([^/]+)";
        }
        else {
            return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
    });
    const regex = new RegExp("^/" + regexParts.join("/") + "/?$");
    return {
        filePath,
        routePath: routePath === "" ? "/" : routePath,
        isDynamic,
        paramNames,
        regex,
        component,
        dirPath: "/" + routePath.split("/").filter(Boolean).slice(0, -1).join("/"),
    };
}
function buildRoutesAndLayouts(routeModules) {
    layoutsByDir = {};
    layoutGuardsByDir = {};
    layoutGuardRedirectByDir = {};
    appWrapper = null;
    notFoundPage = null;
    const records = [];
    for (const [filePath, mod] of Object.entries(routeModules)) {
        const normalized = filePath
            .replace(/^\.\/pages/, "")
            .replace(/\.(t|j)sx?$/, "");
        if (normalized === "/404") {
            notFoundPage = mod.default;
            continue;
        }
        if (normalized.endsWith("/_layout")) {
            const dir = normalized.replace(/\/_layout$/, "") || "/";
            const key = dir === "" ? "/" : dir;
            layoutsByDir[key] = mod.default;
            const guard = typeof mod.protect === "function"
                ? mod.protect
                : typeof mod.default?.protect === "function"
                    ? mod.default.protect
                    : undefined;
            const redirect = typeof mod.protectRedirect === "string"
                ? mod.protectRedirect
                : typeof mod.default?.protectRedirect === "string"
                    ? mod.default.protectRedirect
                    : undefined;
            layoutGuardsByDir[key] = guard;
            layoutGuardRedirectByDir[key] = redirect;
            continue;
        }
        if (normalized === "/_app") {
            appWrapper = mod.default;
            continue;
        }
        const rec = filePathToRouteInfo(filePath, mod.default);
        const dirPath = filePath
            .replace(/^\.\/pages/, "")
            .replace(/\.(t|j)sx?$/, "")
            .replace(/\/[^/]+$/, "") || "/";
        rec.dirPath = dirPath === "" ? "/" : dirPath;
        records.push(rec);
    }
    records.sort((a, b) => {
        if (a.isDynamic === b.isDynamic) {
            const aSegs = a.routePath.split("/").filter(Boolean).length;
            const bSegs = b.routePath.split("/").filter(Boolean).length;
            return bSegs - aSegs;
        }
        return a.isDynamic ? 1 : -1;
    });
    routes = records;
}
function matchRoute(pathname) {
    for (const r of routes) {
        if (!r.isDynamic && r.routePath === pathname)
            return { record: r, params: {} };
    }
    for (const r of routes) {
        if (r.isDynamic && r.regex) {
            const m = pathname.match(r.regex);
            if (m) {
                const params = {};
                for (let i = 0; i < r.paramNames.length; i++) {
                    const raw = m[i + 1] ?? "";
                    const name = r.paramNames[i];
                    if (raw.includes("/"))
                        params[name] = raw.split("/").map(decodeURIComponent);
                    else
                        params[name] = decodeURIComponent(raw);
                }
                return { record: r, params };
            }
        }
    }
    return { record: undefined, params: {} };
}
function getLayoutDirsForPath(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    const dirs = ["/"];
    let acc = "";
    for (const p of parts) {
        acc += "/" + p;
        dirs.push(acc);
    }
    return dirs;
}
function getLayoutsForPath(pathname) {
    const dirs = getLayoutDirsForPath(pathname);
    const matched = [];
    for (const d of dirs)
        if (layoutsByDir[d])
            matched.push(layoutsByDir[d]);
    return matched;
}
export function initRouter(routeModules, renderFn) {
    buildRoutesAndLayouts(routeModules);
    void navigateTo(location.href, renderFn, false);
    window.addEventListener("popstate", () => void navigateTo(location.href, renderFn, false));
    document.addEventListener("click", (e) => {
        const target = e.target;
        const el = target && target.closest ? target.closest("a") : null;
        if (!el)
            return;
        const href = el.getAttribute("href");
        if (!href)
            return;
        if (href.startsWith("/") && !href.startsWith("//")) {
            e.preventDefault();
            void navigateTo(href, renderFn);
        }
    });
}
async function runLayoutGuardsForPath(pathname, params) {
    const dirs = getLayoutDirsForPath(pathname);
    for (const d of dirs) {
        const guard = layoutGuardsByDir[d];
        if (!guard)
            continue;
        try {
            const res = await Promise.resolve(guard(params, pathname));
            if (!Boolean(res)) {
                const redirect = layoutGuardRedirectByDir[d] ?? "/";
                return { ok: false, redirect };
            }
        }
        catch {
            const redirect = layoutGuardRedirectByDir[d] ?? "/";
            return { ok: false, redirect };
        }
    }
    return { ok: true };
}
function buildWrappedComponent(PageComp, pathname, params) {
    let inner = () => PageComp({ params });
    const layouts = getLayoutsForPath(pathname);
    for (let i = layouts.length - 1; i >= 0; i--) {
        const Layout = layouts[i];
        const Prev = inner;
        inner = (() => {
            return () => Layout({ children: Prev(), params });
        })();
    }
    if (appWrapper) {
        const Prev = inner;
        inner = (() => {
            return () => appWrapper({ Component: () => Prev(), pageProps: { params } });
        })();
    }
    return inner;
}
async function renderWrappedNotFound(renderFn) {
    const PageComp = notFoundPage ?? NotFound;
    const Wrapper = buildWrappedComponent(PageComp, "/404", {});
    renderFn(Wrapper);
}
export async function navigateTo(pathOrHref, renderFn, push = true) {
    const url = new URL(pathOrHref, location.origin);
    const pathname = url.pathname;
    const { record, params } = matchRoute(pathname);
    if (push)
        history.pushState({}, "", pathname + url.search + url.hash);
    if (!record) {
        await renderWrappedNotFound(renderFn);
        return;
    }
    const guardResult = await runLayoutGuardsForPath(pathname, params);
    if (!guardResult.ok) {
        const target = guardResult.redirect ?? "/";
        if (target === pathname) {
            await renderWrappedNotFound(renderFn);
            return;
        }
        await navigateTo(target, renderFn);
        return;
    }
    const Page = record.component;
    const Wrapper = buildWrappedComponent(Page, pathname, params);
    renderFn(Wrapper);
}
