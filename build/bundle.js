
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var html2canvas = createCommonjsModule(function (module, exports) {
    /*!
     * html2canvas 1.4.1 <https://html2canvas.hertzen.com>
     * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
     * Released under MIT License
     */
    (function (global, factory) {
        module.exports = factory() ;
    }(commonjsGlobal, (function () {
        /*! *****************************************************************************
        Copyright (c) Microsoft Corporation.

        Permission to use, copy, modify, and/or distribute this software for any
        purpose with or without fee is hereby granted.

        THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
        REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
        AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
        INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
        LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
        OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
        PERFORMANCE OF THIS SOFTWARE.
        ***************************************************************************** */
        /* global Reflect, Promise */

        var extendStatics = function(d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };

        function __extends(d, b) {
            if (typeof b !== "function" && b !== null)
                throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        }

        var __assign = function() {
            __assign = Object.assign || function __assign(t) {
                for (var s, i = 1, n = arguments.length; i < n; i++) {
                    s = arguments[i];
                    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
                }
                return t;
            };
            return __assign.apply(this, arguments);
        };

        function __awaiter(thisArg, _arguments, P, generator) {
            function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
            return new (P || (P = Promise))(function (resolve, reject) {
                function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
                step((generator = generator.apply(thisArg, _arguments || [])).next());
            });
        }

        function __generator(thisArg, body) {
            var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
            return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
            function verb(n) { return function (v) { return step([n, v]); }; }
            function step(op) {
                if (f) throw new TypeError("Generator is already executing.");
                while (_) try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                    if (y = 0, t) op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0: case 1: t = op; break;
                        case 4: _.label++; return { value: op[1], done: false };
                        case 5: _.label++; y = op[1]; op = [0]; continue;
                        case 7: op = _.ops.pop(); _.trys.pop(); continue;
                        default:
                            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                            if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                            if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                            if (t[2]) _.ops.pop();
                            _.trys.pop(); continue;
                    }
                    op = body.call(thisArg, _);
                } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
                if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
            }
        }

        function __spreadArray(to, from, pack) {
            if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
                if (ar || !(i in from)) {
                    if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                    ar[i] = from[i];
                }
            }
            return to.concat(ar || from);
        }

        var Bounds = /** @class */ (function () {
            function Bounds(left, top, width, height) {
                this.left = left;
                this.top = top;
                this.width = width;
                this.height = height;
            }
            Bounds.prototype.add = function (x, y, w, h) {
                return new Bounds(this.left + x, this.top + y, this.width + w, this.height + h);
            };
            Bounds.fromClientRect = function (context, clientRect) {
                return new Bounds(clientRect.left + context.windowBounds.left, clientRect.top + context.windowBounds.top, clientRect.width, clientRect.height);
            };
            Bounds.fromDOMRectList = function (context, domRectList) {
                var domRect = Array.from(domRectList).find(function (rect) { return rect.width !== 0; });
                return domRect
                    ? new Bounds(domRect.left + context.windowBounds.left, domRect.top + context.windowBounds.top, domRect.width, domRect.height)
                    : Bounds.EMPTY;
            };
            Bounds.EMPTY = new Bounds(0, 0, 0, 0);
            return Bounds;
        }());
        var parseBounds = function (context, node) {
            return Bounds.fromClientRect(context, node.getBoundingClientRect());
        };
        var parseDocumentSize = function (document) {
            var body = document.body;
            var documentElement = document.documentElement;
            if (!body || !documentElement) {
                throw new Error("Unable to get document size");
            }
            var width = Math.max(Math.max(body.scrollWidth, documentElement.scrollWidth), Math.max(body.offsetWidth, documentElement.offsetWidth), Math.max(body.clientWidth, documentElement.clientWidth));
            var height = Math.max(Math.max(body.scrollHeight, documentElement.scrollHeight), Math.max(body.offsetHeight, documentElement.offsetHeight), Math.max(body.clientHeight, documentElement.clientHeight));
            return new Bounds(0, 0, width, height);
        };

        /*
         * css-line-break 2.1.0 <https://github.com/niklasvh/css-line-break#readme>
         * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var toCodePoints$1 = function (str) {
            var codePoints = [];
            var i = 0;
            var length = str.length;
            while (i < length) {
                var value = str.charCodeAt(i++);
                if (value >= 0xd800 && value <= 0xdbff && i < length) {
                    var extra = str.charCodeAt(i++);
                    if ((extra & 0xfc00) === 0xdc00) {
                        codePoints.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
                    }
                    else {
                        codePoints.push(value);
                        i--;
                    }
                }
                else {
                    codePoints.push(value);
                }
            }
            return codePoints;
        };
        var fromCodePoint$1 = function () {
            var codePoints = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                codePoints[_i] = arguments[_i];
            }
            if (String.fromCodePoint) {
                return String.fromCodePoint.apply(String, codePoints);
            }
            var length = codePoints.length;
            if (!length) {
                return '';
            }
            var codeUnits = [];
            var index = -1;
            var result = '';
            while (++index < length) {
                var codePoint = codePoints[index];
                if (codePoint <= 0xffff) {
                    codeUnits.push(codePoint);
                }
                else {
                    codePoint -= 0x10000;
                    codeUnits.push((codePoint >> 10) + 0xd800, (codePoint % 0x400) + 0xdc00);
                }
                if (index + 1 === length || codeUnits.length > 0x4000) {
                    result += String.fromCharCode.apply(String, codeUnits);
                    codeUnits.length = 0;
                }
            }
            return result;
        };
        var chars$2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        // Use a lookup table to find the index.
        var lookup$2 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
        for (var i$2 = 0; i$2 < chars$2.length; i$2++) {
            lookup$2[chars$2.charCodeAt(i$2)] = i$2;
        }

        /*
         * utrie 1.0.2 <https://github.com/niklasvh/utrie>
         * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var chars$1$1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        // Use a lookup table to find the index.
        var lookup$1$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
        for (var i$1$1 = 0; i$1$1 < chars$1$1.length; i$1$1++) {
            lookup$1$1[chars$1$1.charCodeAt(i$1$1)] = i$1$1;
        }
        var decode$1 = function (base64) {
            var bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
            if (base64[base64.length - 1] === '=') {
                bufferLength--;
                if (base64[base64.length - 2] === '=') {
                    bufferLength--;
                }
            }
            var buffer = typeof ArrayBuffer !== 'undefined' &&
                typeof Uint8Array !== 'undefined' &&
                typeof Uint8Array.prototype.slice !== 'undefined'
                ? new ArrayBuffer(bufferLength)
                : new Array(bufferLength);
            var bytes = Array.isArray(buffer) ? buffer : new Uint8Array(buffer);
            for (i = 0; i < len; i += 4) {
                encoded1 = lookup$1$1[base64.charCodeAt(i)];
                encoded2 = lookup$1$1[base64.charCodeAt(i + 1)];
                encoded3 = lookup$1$1[base64.charCodeAt(i + 2)];
                encoded4 = lookup$1$1[base64.charCodeAt(i + 3)];
                bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
                bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
                bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
            }
            return buffer;
        };
        var polyUint16Array$1 = function (buffer) {
            var length = buffer.length;
            var bytes = [];
            for (var i = 0; i < length; i += 2) {
                bytes.push((buffer[i + 1] << 8) | buffer[i]);
            }
            return bytes;
        };
        var polyUint32Array$1 = function (buffer) {
            var length = buffer.length;
            var bytes = [];
            for (var i = 0; i < length; i += 4) {
                bytes.push((buffer[i + 3] << 24) | (buffer[i + 2] << 16) | (buffer[i + 1] << 8) | buffer[i]);
            }
            return bytes;
        };

        /** Shift size for getting the index-2 table offset. */
        var UTRIE2_SHIFT_2$1 = 5;
        /** Shift size for getting the index-1 table offset. */
        var UTRIE2_SHIFT_1$1 = 6 + 5;
        /**
         * Shift size for shifting left the index array values.
         * Increases possible data size with 16-bit index values at the cost
         * of compactability.
         * This requires data blocks to be aligned by UTRIE2_DATA_GRANULARITY.
         */
        var UTRIE2_INDEX_SHIFT$1 = 2;
        /**
         * Difference between the two shift sizes,
         * for getting an index-1 offset from an index-2 offset. 6=11-5
         */
        var UTRIE2_SHIFT_1_2$1 = UTRIE2_SHIFT_1$1 - UTRIE2_SHIFT_2$1;
        /**
         * The part of the index-2 table for U+D800..U+DBFF stores values for
         * lead surrogate code _units_ not code _points_.
         * Values for lead surrogate code _points_ are indexed with this portion of the table.
         * Length=32=0x20=0x400>>UTRIE2_SHIFT_2. (There are 1024=0x400 lead surrogates.)
         */
        var UTRIE2_LSCP_INDEX_2_OFFSET$1 = 0x10000 >> UTRIE2_SHIFT_2$1;
        /** Number of entries in a data block. 32=0x20 */
        var UTRIE2_DATA_BLOCK_LENGTH$1 = 1 << UTRIE2_SHIFT_2$1;
        /** Mask for getting the lower bits for the in-data-block offset. */
        var UTRIE2_DATA_MASK$1 = UTRIE2_DATA_BLOCK_LENGTH$1 - 1;
        var UTRIE2_LSCP_INDEX_2_LENGTH$1 = 0x400 >> UTRIE2_SHIFT_2$1;
        /** Count the lengths of both BMP pieces. 2080=0x820 */
        var UTRIE2_INDEX_2_BMP_LENGTH$1 = UTRIE2_LSCP_INDEX_2_OFFSET$1 + UTRIE2_LSCP_INDEX_2_LENGTH$1;
        /**
         * The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
         * Length 32=0x20 for lead bytes C0..DF, regardless of UTRIE2_SHIFT_2.
         */
        var UTRIE2_UTF8_2B_INDEX_2_OFFSET$1 = UTRIE2_INDEX_2_BMP_LENGTH$1;
        var UTRIE2_UTF8_2B_INDEX_2_LENGTH$1 = 0x800 >> 6; /* U+0800 is the first code point after 2-byte UTF-8 */
        /**
         * The index-1 table, only used for supplementary code points, at offset 2112=0x840.
         * Variable length, for code points up to highStart, where the last single-value range starts.
         * Maximum length 512=0x200=0x100000>>UTRIE2_SHIFT_1.
         * (For 0x100000 supplementary code points U+10000..U+10ffff.)
         *
         * The part of the index-2 table for supplementary code points starts
         * after this index-1 table.
         *
         * Both the index-1 table and the following part of the index-2 table
         * are omitted completely if there is only BMP data.
         */
        var UTRIE2_INDEX_1_OFFSET$1 = UTRIE2_UTF8_2B_INDEX_2_OFFSET$1 + UTRIE2_UTF8_2B_INDEX_2_LENGTH$1;
        /**
         * Number of index-1 entries for the BMP. 32=0x20
         * This part of the index-1 table is omitted from the serialized form.
         */
        var UTRIE2_OMITTED_BMP_INDEX_1_LENGTH$1 = 0x10000 >> UTRIE2_SHIFT_1$1;
        /** Number of entries in an index-2 block. 64=0x40 */
        var UTRIE2_INDEX_2_BLOCK_LENGTH$1 = 1 << UTRIE2_SHIFT_1_2$1;
        /** Mask for getting the lower bits for the in-index-2-block offset. */
        var UTRIE2_INDEX_2_MASK$1 = UTRIE2_INDEX_2_BLOCK_LENGTH$1 - 1;
        var slice16$1 = function (view, start, end) {
            if (view.slice) {
                return view.slice(start, end);
            }
            return new Uint16Array(Array.prototype.slice.call(view, start, end));
        };
        var slice32$1 = function (view, start, end) {
            if (view.slice) {
                return view.slice(start, end);
            }
            return new Uint32Array(Array.prototype.slice.call(view, start, end));
        };
        var createTrieFromBase64$1 = function (base64, _byteLength) {
            var buffer = decode$1(base64);
            var view32 = Array.isArray(buffer) ? polyUint32Array$1(buffer) : new Uint32Array(buffer);
            var view16 = Array.isArray(buffer) ? polyUint16Array$1(buffer) : new Uint16Array(buffer);
            var headerLength = 24;
            var index = slice16$1(view16, headerLength / 2, view32[4] / 2);
            var data = view32[5] === 2
                ? slice16$1(view16, (headerLength + view32[4]) / 2)
                : slice32$1(view32, Math.ceil((headerLength + view32[4]) / 4));
            return new Trie$1(view32[0], view32[1], view32[2], view32[3], index, data);
        };
        var Trie$1 = /** @class */ (function () {
            function Trie(initialValue, errorValue, highStart, highValueIndex, index, data) {
                this.initialValue = initialValue;
                this.errorValue = errorValue;
                this.highStart = highStart;
                this.highValueIndex = highValueIndex;
                this.index = index;
                this.data = data;
            }
            /**
             * Get the value for a code point as stored in the Trie.
             *
             * @param codePoint the code point
             * @return the value
             */
            Trie.prototype.get = function (codePoint) {
                var ix;
                if (codePoint >= 0) {
                    if (codePoint < 0x0d800 || (codePoint > 0x0dbff && codePoint <= 0x0ffff)) {
                        // Ordinary BMP code point, excluding leading surrogates.
                        // BMP uses a single level lookup.  BMP index starts at offset 0 in the Trie2 index.
                        // 16 bit data is stored in the index array itself.
                        ix = this.index[codePoint >> UTRIE2_SHIFT_2$1];
                        ix = (ix << UTRIE2_INDEX_SHIFT$1) + (codePoint & UTRIE2_DATA_MASK$1);
                        return this.data[ix];
                    }
                    if (codePoint <= 0xffff) {
                        // Lead Surrogate Code Point.  A Separate index section is stored for
                        // lead surrogate code units and code points.
                        //   The main index has the code unit data.
                        //   For this function, we need the code point data.
                        // Note: this expression could be refactored for slightly improved efficiency, but
                        //       surrogate code points will be so rare in practice that it's not worth it.
                        ix = this.index[UTRIE2_LSCP_INDEX_2_OFFSET$1 + ((codePoint - 0xd800) >> UTRIE2_SHIFT_2$1)];
                        ix = (ix << UTRIE2_INDEX_SHIFT$1) + (codePoint & UTRIE2_DATA_MASK$1);
                        return this.data[ix];
                    }
                    if (codePoint < this.highStart) {
                        // Supplemental code point, use two-level lookup.
                        ix = UTRIE2_INDEX_1_OFFSET$1 - UTRIE2_OMITTED_BMP_INDEX_1_LENGTH$1 + (codePoint >> UTRIE2_SHIFT_1$1);
                        ix = this.index[ix];
                        ix += (codePoint >> UTRIE2_SHIFT_2$1) & UTRIE2_INDEX_2_MASK$1;
                        ix = this.index[ix];
                        ix = (ix << UTRIE2_INDEX_SHIFT$1) + (codePoint & UTRIE2_DATA_MASK$1);
                        return this.data[ix];
                    }
                    if (codePoint <= 0x10ffff) {
                        return this.data[this.highValueIndex];
                    }
                }
                // Fall through.  The code point is outside of the legal range of 0..0x10ffff.
                return this.errorValue;
            };
            return Trie;
        }());

        /*
         * base64-arraybuffer 1.0.2 <https://github.com/niklasvh/base64-arraybuffer>
         * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var chars$3 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        // Use a lookup table to find the index.
        var lookup$3 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
        for (var i$3 = 0; i$3 < chars$3.length; i$3++) {
            lookup$3[chars$3.charCodeAt(i$3)] = i$3;
        }

        var base64$1 = 'KwAAAAAAAAAACA4AUD0AADAgAAACAAAAAAAIABAAGABAAEgAUABYAGAAaABgAGgAYgBqAF8AZwBgAGgAcQB5AHUAfQCFAI0AlQCdAKIAqgCyALoAYABoAGAAaABgAGgAwgDKAGAAaADGAM4A0wDbAOEA6QDxAPkAAQEJAQ8BFwF1AH0AHAEkASwBNAE6AUIBQQFJAVEBWQFhAWgBcAF4ATAAgAGGAY4BlQGXAZ8BpwGvAbUBvQHFAc0B0wHbAeMB6wHxAfkBAQIJAvEBEQIZAiECKQIxAjgCQAJGAk4CVgJeAmQCbAJ0AnwCgQKJApECmQKgAqgCsAK4ArwCxAIwAMwC0wLbAjAA4wLrAvMC+AIAAwcDDwMwABcDHQMlAy0DNQN1AD0DQQNJA0kDSQNRA1EDVwNZA1kDdQB1AGEDdQBpA20DdQN1AHsDdQCBA4kDkQN1AHUAmQOhA3UAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AKYDrgN1AHUAtgO+A8YDzgPWAxcD3gPjA+sD8wN1AHUA+wMDBAkEdQANBBUEHQQlBCoEFwMyBDgEYABABBcDSARQBFgEYARoBDAAcAQzAXgEgASIBJAEdQCXBHUAnwSnBK4EtgS6BMIEyAR1AHUAdQB1AHUAdQCVANAEYABgAGAAYABgAGAAYABgANgEYADcBOQEYADsBPQE/AQEBQwFFAUcBSQFLAU0BWQEPAVEBUsFUwVbBWAAYgVgAGoFcgV6BYIFigWRBWAAmQWfBaYFYABgAGAAYABgAKoFYACxBbAFuQW6BcEFwQXHBcEFwQXPBdMF2wXjBeoF8gX6BQIGCgYSBhoGIgYqBjIGOgZgAD4GRgZMBmAAUwZaBmAAYABgAGAAYABgAGAAYABgAGAAYABgAGIGYABpBnAGYABgAGAAYABgAGAAYABgAGAAYAB4Bn8GhQZgAGAAYAB1AHcDFQSLBmAAYABgAJMGdQA9A3UAmwajBqsGqwaVALMGuwbDBjAAywbSBtIG1QbSBtIG0gbSBtIG0gbdBuMG6wbzBvsGAwcLBxMHAwcbByMHJwcsBywHMQcsB9IGOAdAB0gHTgfSBkgHVgfSBtIG0gbSBtIG0gbSBtIG0gbSBiwHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAdgAGAALAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAdbB2MHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsB2kH0gZwB64EdQB1AHUAdQB1AHUAdQB1AHUHfQdgAIUHjQd1AHUAlQedB2AAYAClB6sHYACzB7YHvgfGB3UAzgfWBzMB3gfmB1EB7gf1B/0HlQENAQUIDQh1ABUIHQglCBcDLQg1CD0IRQhNCEEDUwh1AHUAdQBbCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIaQhjCGQIZQhmCGcIaAhpCGMIZAhlCGYIZwhoCGkIYwhkCGUIZghnCGgIcAh3CHoIMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIgggwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAALAcsBywHLAcsBywHLAcsBywHLAcsB4oILAcsB44I0gaWCJ4Ipgh1AHUAqgiyCHUAdQB1AHUAdQB1AHUAdQB1AHUAtwh8AXUAvwh1AMUIyQjRCNkI4AjoCHUAdQB1AO4I9gj+CAYJDgkTCS0HGwkjCYIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiCCIIIggiAAIAAAAFAAYABgAGIAXwBgAHEAdQBFAJUAogCyAKAAYABgAEIA4ABGANMA4QDxAMEBDwE1AFwBLAE6AQEBUQF4QkhCmEKoQrhCgAHIQsAB0MLAAcABwAHAAeDC6ABoAHDCwMMAAcABwAHAAdDDGMMAAcAB6MM4wwjDWMNow3jDaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAGgAaABoAEjDqABWw6bDqABpg6gAaABoAHcDvwOPA+gAaABfA/8DvwO/A78DvwO/A78DvwO/A78DvwO/A78DvwO/A78DvwO/A78DvwO/A78DvwO/A78DvwO/A78DpcPAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcAB9cPKwkyCToJMAB1AHUAdQBCCUoJTQl1AFUJXAljCWcJawkwADAAMAAwAHMJdQB2CX4JdQCECYoJjgmWCXUAngkwAGAAYABxAHUApgn3A64JtAl1ALkJdQDACTAAMAAwADAAdQB1AHUAdQB1AHUAdQB1AHUAowYNBMUIMAAwADAAMADICcsJ0wnZCRUE4QkwAOkJ8An4CTAAMAB1AAAKvwh1AAgKDwoXCh8KdQAwACcKLgp1ADYKqAmICT4KRgowADAAdQB1AE4KMAB1AFYKdQBeCnUAZQowADAAMAAwADAAMAAwADAAMAAVBHUAbQowADAAdQC5CXUKMAAwAHwBxAijBogEMgF9CoQKiASMCpQKmgqIBKIKqgquCogEDQG2Cr4KxgrLCjAAMADTCtsKCgHjCusK8Qr5CgELMAAwADAAMAB1AIsECQsRC3UANAEZCzAAMAAwADAAMAB1ACELKQswAHUANAExCzkLdQBBC0kLMABRC1kLMAAwADAAMAAwADAAdQBhCzAAMAAwAGAAYABpC3ELdwt/CzAAMACHC4sLkwubC58Lpwt1AK4Ltgt1APsDMAAwADAAMAAwADAAMAAwAL4LwwvLC9IL1wvdCzAAMADlC+kL8Qv5C/8LSQswADAAMAAwADAAMAAwADAAMAAHDDAAMAAwADAAMAAODBYMHgx1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1ACYMMAAwADAAdQB1AHUALgx1AHUAdQB1AHUAdQA2DDAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AD4MdQBGDHUAdQB1AHUAdQB1AEkMdQB1AHUAdQB1AFAMMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQBYDHUAdQB1AF8MMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUA+wMVBGcMMAAwAHwBbwx1AHcMfwyHDI8MMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAYABgAJcMMAAwADAAdQB1AJ8MlQClDDAAMACtDCwHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsB7UMLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHdQB1AHUAdQB1AHUAdQB1AHUAdQB1AHUAdQB1AA0EMAC9DDAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAsBywHLAcsBywHLAcsBywHLQcwAMEMyAwsBywHLAcsBywHLAcsBywHLAcsBywHzAwwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwAHUAdQB1ANQM2QzhDDAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMABgAGAAYABgAGAAYABgAOkMYADxDGAA+AwADQYNYABhCWAAYAAODTAAMAAwADAAFg1gAGAAHg37AzAAMAAwADAAYABgACYNYAAsDTQNPA1gAEMNPg1LDWAAYABgAGAAYABgAGAAYABgAGAAUg1aDYsGVglhDV0NcQBnDW0NdQ15DWAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAlQCBDZUAiA2PDZcNMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAnw2nDTAAMAAwADAAMAAwAHUArw23DTAAMAAwADAAMAAwADAAMAAwADAAMAB1AL8NMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAB1AHUAdQB1AHUAdQDHDTAAYABgAM8NMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAA1w11ANwNMAAwAD0B5A0wADAAMAAwADAAMADsDfQN/A0EDgwOFA4wABsOMAAwADAAMAAwADAAMAAwANIG0gbSBtIG0gbSBtIG0gYjDigOwQUuDsEFMw7SBjoO0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIGQg5KDlIOVg7SBtIGXg5lDm0OdQ7SBtIGfQ6EDooOjQ6UDtIGmg6hDtIG0gaoDqwO0ga0DrwO0gZgAGAAYADEDmAAYAAkBtIGzA5gANIOYADaDokO0gbSBt8O5w7SBu8O0gb1DvwO0gZgAGAAxA7SBtIG0gbSBtIGYABgAGAAYAAED2AAsAUMD9IG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIGFA8sBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAccD9IGLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHJA8sBywHLAcsBywHLAccDywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywPLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAc0D9IG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIGLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAccD9IG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIGFA8sBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHLAcsBywHPA/SBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gbSBtIG0gYUD0QPlQCVAJUAMAAwADAAMACVAJUAlQCVAJUAlQCVAEwPMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAA//8EAAQABAAEAAQABAAEAAQABAANAAMAAQABAAIABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQACgATABcAHgAbABoAHgAXABYAEgAeABsAGAAPABgAHABLAEsASwBLAEsASwBLAEsASwBLABgAGAAeAB4AHgATAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABYAGwASAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAWAA0AEQAeAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAFAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAJABYAGgAbABsAGwAeAB0AHQAeAE8AFwAeAA0AHgAeABoAGwBPAE8ADgBQAB0AHQAdAE8ATwAXAE8ATwBPABYAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AHgAeAFAATwBAAE8ATwBPAEAATwBQAFAATwBQAB4AHgAeAB4AHgAeAB0AHQAdAB0AHgAdAB4ADgBQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgBQAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAJAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAkACQAJAAkACQAJAAkABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgAeAFAAHgAeAB4AKwArAFAAUABQAFAAGABQACsAKwArACsAHgAeAFAAHgBQAFAAUAArAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUAAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAYAA0AKwArAB4AHgAbACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQADQAEAB4ABAAEAB4ABAAEABMABAArACsAKwArACsAKwArACsAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAKwArACsAKwBWAFYAVgBWAB4AHgArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AGgAaABoAGAAYAB4AHgAEAAQABAAEAAQABAAEAAQABAAEAAQAEwAEACsAEwATAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABLAEsASwBLAEsASwBLAEsASwBLABoAGQAZAB4AUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQABMAUAAEAAQABAAEAAQABAAEAB4AHgAEAAQABAAEAAQABABQAFAABAAEAB4ABAAEAAQABABQAFAASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUAAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAFAABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQAUABQAB4AHgAYABMAUAArACsABAAbABsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAFAABAAEAAQABAAEAFAABAAEAAQAUAAEAAQABAAEAAQAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAArACsAHgArAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAUAAEAAQABAAEAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAABAAEAA0ADQBLAEsASwBLAEsASwBLAEsASwBLAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUAArACsAKwBQAFAAUABQACsAKwAEAFAABAAEAAQABAAEAAQABAArACsABAAEACsAKwAEAAQABABQACsAKwArACsAKwArACsAKwAEACsAKwArACsAUABQACsAUABQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUAAaABoAUABQAFAAUABQAEwAHgAbAFAAHgAEACsAKwAEAAQABAArAFAAUABQAFAAUABQACsAKwArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQACsAUABQACsAKwAEACsABAAEAAQABAAEACsAKwArACsABAAEACsAKwAEAAQABAArACsAKwAEACsAKwArACsAKwArACsAUABQAFAAUAArAFAAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLAAQABABQAFAAUAAEAB4AKwArACsAKwArACsAKwArACsAKwAEAAQABAArAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQAFAAUABQACsAKwAEAFAABAAEAAQABAAEAAQABAAEACsABAAEAAQAKwAEAAQABAArACsAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAB4AGwArACsAKwArACsAKwArAFAABAAEAAQABAAEAAQAKwAEAAQABAArAFAAUABQAFAAUABQAFAAUAArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAArACsABAAEACsAKwAEAAQABAArACsAKwArACsAKwArAAQABAAEACsAKwArACsAUABQACsAUABQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAB4AUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArAAQAUAArAFAAUABQAFAAUABQACsAKwArAFAAUABQACsAUABQAFAAUAArACsAKwBQAFAAKwBQACsAUABQACsAKwArAFAAUAArACsAKwBQAFAAUAArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArAAQABAAEAAQABAArACsAKwAEAAQABAArAAQABAAEAAQAKwArAFAAKwArACsAKwArACsABAArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAHgAeAB4AHgAeAB4AGwAeACsAKwArACsAKwAEAAQABAAEAAQAUABQAFAAUABQAFAAUABQACsAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAUAAEAAQABAAEAAQABAAEACsABAAEAAQAKwAEAAQABAAEACsAKwArACsAKwArACsABAAEACsAUABQAFAAKwArACsAKwArAFAAUAAEAAQAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKwAOAFAAUABQAFAAUABQAFAAHgBQAAQABAAEAA4AUABQAFAAUABQAFAAUABQACsAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAKwArAAQAUAAEAAQABAAEAAQABAAEACsABAAEAAQAKwAEAAQABAAEACsAKwArACsAKwArACsABAAEACsAKwArACsAKwArACsAUAArAFAAUAAEAAQAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwBQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAAQABAAEAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAFAABAAEAAQABAAEAAQABAArAAQABAAEACsABAAEAAQABABQAB4AKwArACsAKwBQAFAAUAAEAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQABoAUABQAFAAUABQAFAAKwAEAAQABAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQACsAUAArACsAUABQAFAAUABQAFAAUAArACsAKwAEACsAKwArACsABAAEAAQABAAEAAQAKwAEACsABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArAAQABAAeACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAXAAqACoAKgAqACoAKgAqACsAKwArACsAGwBcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAeAEsASwBLAEsASwBLAEsASwBLAEsADQANACsAKwArACsAKwBcAFwAKwBcACsAXABcAFwAXABcACsAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAXAArAFwAXABcAFwAXABcAFwAXABcAFwAKgBcAFwAKgAqACoAKgAqACoAKgAqACoAXAArACsAXABcAFwAXABcACsAXAArACoAKgAqACoAKgAqACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwBcAFwAXABcAFAADgAOAA4ADgAeAA4ADgAJAA4ADgANAAkAEwATABMAEwATAAkAHgATAB4AHgAeAAQABAAeAB4AHgAeAB4AHgBLAEsASwBLAEsASwBLAEsASwBLAFAAUABQAFAAUABQAFAAUABQAFAADQAEAB4ABAAeAAQAFgARABYAEQAEAAQAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQADQAEAAQABAAEAAQADQAEAAQAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAA0ADQAeAB4AHgAeAB4AHgAEAB4AHgAeAB4AHgAeACsAHgAeAA4ADgANAA4AHgAeAB4AHgAeAAkACQArACsAKwArACsAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgBcAEsASwBLAEsASwBLAEsASwBLAEsADQANAB4AHgAeAB4AXABcAFwAXABcAFwAKgAqACoAKgBcAFwAXABcACoAKgAqAFwAKgAqACoAXABcACoAKgAqACoAKgAqACoAXABcAFwAKgAqACoAKgBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAqACoAKgAqAFwAKgBLAEsASwBLAEsASwBLAEsASwBLACoAKgAqACoAKgAqAFAAUABQAFAAUABQACsAUAArACsAKwArACsAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgBQAFAAUABQAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAKwBQACsAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsABAAEAAQAHgANAB4AHgAeAB4AHgAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUAArACsADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAWABEAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAA0ADQANAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAANAA0AKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUAArAAQABAArACsAKwArACsAKwArACsAKwArACsAKwBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqAA0ADQAVAFwADQAeAA0AGwBcACoAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwAeAB4AEwATAA0ADQAOAB4AEwATAB4ABAAEAAQACQArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAFAAUABQAFAAUAAEAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAHgArACsAKwATABMASwBLAEsASwBLAEsASwBLAEsASwBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAArACsAXABcAFwAXABcACsAKwArACsAKwArACsAKwArACsAKwBcAFwAXABcAFwAXABcAFwAXABcAFwAXAArACsAKwArAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAXAArACsAKwAqACoAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAArACsAHgAeAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcACoAKgAqACoAKgAqACoAKgAqACoAKwAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKwArAAQASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArACoAKgAqACoAKgAqACoAXAAqACoAKgAqACoAKgArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABABQAFAAUABQAFAAUABQACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwANAA0AHgANAA0ADQANAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAEAAQABAAEAAQAHgAeAB4AHgAeAB4AHgAeAB4AKwArACsABAAEAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwAeAB4AHgAeAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArAA0ADQANAA0ADQBLAEsASwBLAEsASwBLAEsASwBLACsAKwArAFAAUABQAEsASwBLAEsASwBLAEsASwBLAEsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAA0ADQBQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUAAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArAAQABAAEAB4ABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAAQAUABQAFAAUABQAFAABABQAFAABAAEAAQAUAArACsAKwArACsABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAKwBQACsAUAArAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAFAAUABQACsAHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQACsAKwAeAB4AHgAeAB4AHgArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAFAAUABQACsAHgAeAB4AHgAeAB4AHgAOAB4AKwANAA0ADQANAA0ADQANAAkADQANAA0ACAAEAAsABAAEAA0ACQANAA0ADAAdAB0AHgAXABcAFgAXABcAFwAWABcAHQAdAB4AHgAUABQAFAANAAEAAQAEAAQABAAEAAQACQAaABoAGgAaABoAGgAaABoAHgAXABcAHQAVABUAHgAeAB4AHgAeAB4AGAAWABEAFQAVABUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ADQAeAA0ADQANAA0AHgANAA0ADQAHAB4AHgAeAB4AKwAEAAQABAAEAAQABAAEAAQABAAEAFAAUAArACsATwBQAFAAUABQAFAAHgAeAB4AFgARAE8AUABPAE8ATwBPAFAAUABQAFAAUAAeAB4AHgAWABEAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArABsAGwAbABsAGwAbABsAGgAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGgAbABsAGwAbABoAGwAbABoAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbABsAGwAbAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAHgAeAFAAGgAeAB0AHgBQAB4AGgAeAB4AHgAeAB4AHgAeAB4AHgBPAB4AUAAbAB4AHgBQAFAAUABQAFAAHgAeAB4AHQAdAB4AUAAeAFAAHgBQAB4AUABPAFAAUAAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAHgBQAFAAUABQAE8ATwBQAFAAUABQAFAATwBQAFAATwBQAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAFAAUABQAFAATwBPAE8ATwBPAE8ATwBPAE8ATwBQAFAAUABQAFAAUABQAFAAUAAeAB4AUABQAFAAUABPAB4AHgArACsAKwArAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHQAdAB4AHgAeAB0AHQAeAB4AHQAeAB4AHgAdAB4AHQAbABsAHgAdAB4AHgAeAB4AHQAeAB4AHQAdAB0AHQAeAB4AHQAeAB0AHgAdAB0AHQAdAB0AHQAeAB0AHgAeAB4AHgAeAB0AHQAdAB0AHgAeAB4AHgAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB4AHgAeAB0AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAeAB0AHQAdAB0AHgAeAB0AHQAeAB4AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAeAB4AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAeAB4AHgAdAB4AHgAeAB4AHgAeAB4AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAWABEAHgAeAB4AHgAeAB4AHQAeAB4AHgAeAB4AHgAeACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAWABEAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAFAAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB4AHgAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAeAB4AHQAdAB0AHQAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHQAeAB0AHQAdAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB0AHQAeAB4AHQAdAB4AHgAeAB4AHQAdAB4AHgAeAB4AHQAdAB0AHgAeAB0AHgAeAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlAB4AHQAdAB4AHgAdAB4AHgAeAB4AHQAdAB4AHgAeAB4AJQAlAB0AHQAlAB4AJQAlACUAIAAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAeAB4AHgAeAB0AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHgAdAB0AHQAeAB0AJQAdAB0AHgAdAB0AHgAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHQAdAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAdAB0AHQAdACUAHgAlACUAJQAdACUAJQAdAB0AHQAlACUAHQAdACUAHQAdACUAJQAlAB4AHQAeAB4AHgAeAB0AHQAlAB0AHQAdAB0AHQAdACUAJQAlACUAJQAdACUAJQAgACUAHQAdACUAJQAlACUAJQAlACUAJQAeAB4AHgAlACUAIAAgACAAIAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB0AHgAeAB4AFwAXABcAFwAXABcAHgATABMAJQAeAB4AHgAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAFgARABYAEQAWABEAFgARAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAWABEAFgARABYAEQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAWABEAFgARAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AFgARAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAdAB0AHQAdAB0AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUABQAFAAUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAEAAQABAAeAB4AKwArACsAKwArABMADQANAA0AUAATAA0AUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUAANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAA0ADQANAA0ADQANAA0ADQAeAA0AFgANAB4AHgAXABcAHgAeABcAFwAWABEAFgARABYAEQAWABEADQANAA0ADQATAFAADQANAB4ADQANAB4AHgAeAB4AHgAMAAwADQANAA0AHgANAA0AFgANAA0ADQANAA0ADQANAA0AHgANAB4ADQANAB4AHgAeACsAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAKwArACsAKwArACsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArAA0AEQARACUAJQBHAFcAVwAWABEAFgARABYAEQAWABEAFgARACUAJQAWABEAFgARABYAEQAWABEAFQAWABEAEQAlAFcAVwBXAFcAVwBXAFcAVwBXAAQABAAEAAQABAAEACUAVwBXAFcAVwA2ACUAJQBXAFcAVwBHAEcAJQAlACUAKwBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBRAFcAUQBXAFEAVwBXAFcAVwBXAFcAUQBXAFcAVwBXAFcAVwBRAFEAKwArAAQABAAVABUARwBHAFcAFQBRAFcAUQBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFEAVwBRAFcAUQBXAFcAVwBXAFcAVwBRAFcAVwBXAFcAVwBXAFEAUQBXAFcAVwBXABUAUQBHAEcAVwArACsAKwArACsAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwAlACUAVwBXAFcAVwAlACUAJQAlACUAJQAlACUAJQAlACsAKwArACsAKwArACsAKwArACsAKwArAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAUQBRAFEAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBPAE8ATwBPAE8ATwBPAE8AJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADQATAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABLAEsASwBLAEsASwBLAEsASwBLAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAABAAEAAQABAAeAAQABAAEAAQABAAEAAQABAAEAAQAHgBQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUABQAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAeAA0ADQANAA0ADQArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AUAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAB4AHgAeAB4AHgAeAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AUABQAFAAUABQAFAAUABQAFAAUABQAAQAUABQAFAABABQAFAAUABQAAQAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAeAB4AHgAeAAQAKwArACsAUABQAFAAUABQAFAAHgAeABoAHgArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAADgAOABMAEwArACsAKwArACsAKwArACsABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwANAA0ASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUAAeAB4AHgBQAA4AUABQAAQAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAA0ADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArAB4AWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYAFgAWABYACsAKwArAAQAHgAeAB4AHgAeAB4ADQANAA0AHgAeAB4AHgArAFAASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArAB4AHgBcAFwAXABcAFwAKgBcAFwAXABcAFwAXABcAFwAXABcAEsASwBLAEsASwBLAEsASwBLAEsAXABcAFwAXABcACsAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArAFAAUABQAAQAUABQAFAAUABQAFAAUABQAAQABAArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAHgANAA0ADQBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKgAqACoAXAAqACoAKgBcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXAAqAFwAKgAqACoAXABcACoAKgBcAFwAXABcAFwAKgAqAFwAKgBcACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFwAXABcACoAKgBQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAA0ADQBQAFAAUAAEAAQAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQADQAEAAQAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAVABVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBUAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVAFUAVQBVACsAKwArACsAKwArACsAKwArACsAKwArAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAWQBZAFkAKwArACsAKwBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAWgBaAFoAKwArACsAKwAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAKwArACsAKwArAFYABABWAFYAVgBWAFYAVgBWAFYAVgBWAB4AVgBWAFYAVgBWAFYAVgBWAFYAVgBWAFYAVgArAFYAVgBWAFYAVgArAFYAKwBWAFYAKwBWAFYAKwBWAFYAVgBWAFYAVgBWAFYAVgBWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAEQAWAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUAAaAB4AKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAGAARABEAGAAYABMAEwAWABEAFAArACsAKwArACsAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACUAJQAlACUAJQAWABEAFgARABYAEQAWABEAFgARABYAEQAlACUAFgARACUAJQAlACUAJQAlACUAEQAlABEAKwAVABUAEwATACUAFgARABYAEQAWABEAJQAlACUAJQAlACUAJQAlACsAJQAbABoAJQArACsAKwArAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAcAKwATACUAJQAbABoAJQAlABYAEQAlACUAEQAlABEAJQBXAFcAVwBXAFcAVwBXAFcAVwBXABUAFQAlACUAJQATACUAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXABYAJQARACUAJQAlAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwAWACUAEQAlABYAEQARABYAEQARABUAVwBRAFEAUQBRAFEAUQBRAFEAUQBRAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAEcARwArACsAVwBXAFcAVwBXAFcAKwArAFcAVwBXAFcAVwBXACsAKwBXAFcAVwBXAFcAVwArACsAVwBXAFcAKwArACsAGgAbACUAJQAlABsAGwArAB4AHgAeAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwAEAAQABAAQAB0AKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsADQANAA0AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAAQAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAA0AUABQAFAAUAArACsAKwArAFAAUABQAFAAUABQAFAAUAANAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwAeACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAKwArAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUAArACsAKwBQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwANAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAB4AUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAUABQAFAAUABQAAQABAAEACsABAAEACsAKwArACsAKwAEAAQABAAEAFAAUABQAFAAKwBQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEACsAKwArACsABABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAA0ADQANAA0ADQANAA0ADQAeACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAArACsAKwArAFAAUABQAFAAUAANAA0ADQANAA0ADQAUACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsADQANAA0ADQANAA0ADQBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAB4AHgAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArAFAAUABQAFAAUABQAAQABAAEAAQAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUAArAAQABAANACsAKwBQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAB4AHgAeAB4AHgArACsAKwArACsAKwAEAAQABAAEAAQABAAEAA0ADQAeAB4AHgAeAB4AKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwAeACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEACsASwBLAEsASwBLAEsASwBLAEsASwANAA0ADQANAFAABAAEAFAAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAeAA4AUAArACsAKwArACsAKwArACsAKwAEAFAAUABQAFAADQANAB4ADQAEAAQABAAEAB4ABAAEAEsASwBLAEsASwBLAEsASwBLAEsAUAAOAFAADQANAA0AKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAANAA0AHgANAA0AHgAEACsAUABQAFAAUABQAFAAUAArAFAAKwBQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAA0AKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsABAAEAAQABAArAFAAUABQAFAAUABQAFAAUAArACsAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQAFAAUABQACsABAAEAFAABAAEAAQABAAEAAQABAArACsABAAEACsAKwAEAAQABAArACsAUAArACsAKwArACsAKwAEACsAKwArACsAKwBQAFAAUABQAFAABAAEACsAKwAEAAQABAAEAAQABAAEACsAKwArAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsABAAEAAQABAAEAAQABABQAFAAUABQAA0ADQANAA0AHgBLAEsASwBLAEsASwBLAEsASwBLAA0ADQArAB4ABABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAAQABAAEAFAAUAAeAFAAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAArACsABAAEAAQABAAEAAQABAAEAAQADgANAA0AEwATAB4AHgAeAA0ADQANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAFAAUABQAFAABAAEACsAKwAEAA0ADQAeAFAAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAFAAKwArACsAKwArACsAKwBLAEsASwBLAEsASwBLAEsASwBLACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAXABcAFwAKwArACoAKgAqACoAKgAqACoAKgAqACoAKgAqACoAKgAqACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBcAFwADQANAA0AKgBQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAKwArAFAAKwArAFAAUABQAFAAUABQAFAAUAArAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQAKwAEAAQAKwArAAQABAAEAAQAUAAEAFAABAAEAA0ADQANACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAArACsABAAEAAQABAAEAAQABABQAA4AUAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAABAAEAAQABAAEAAQABAAEAAQABABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAFAABAAEAAQABAAOAB4ADQANAA0ADQAOAB4ABAArACsAKwArACsAKwArACsAUAAEAAQABAAEAAQABAAEAAQABAAEAAQAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAA0ADQANAFAADgAOAA4ADQANACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAEAAQABAAEACsABAAEAAQABAAEAAQABAAEAFAADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwAOABMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQACsAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAArACsAKwAEACsABAAEACsABAAEAAQABAAEAAQABABQAAQAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAUABQAFAAUABQAFAAKwBQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQAKwAEAAQAKwAEAAQABAAEAAQAUAArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAABAAEAAQABAAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAaABoAGgAaAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArAA0AUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsADQANAA0ADQANACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABIAEgAQwBDAEMAUABQAFAAUABDAFAAUABQAEgAQwBIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAASABDAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwAJAAkACQAJAAkACQAJABYAEQArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABIAEMAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwANAA0AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArAAQABAAEAAQABAANACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEAA0ADQANAB4AHgAeAB4AHgAeAFAAUABQAFAADQAeACsAKwArACsAKwArACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAANAA0AHgAeACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwAEAFAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwAEAAQABAAEAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAARwBHABUARwAJACsAKwArACsAKwArACsAKwArACsAKwAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACsAKwArACsAKwArACsAKwBXAFcAVwBXAFcAVwBXAFcAVwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUQBRAFEAKwArACsAKwArACsAKwArACsAKwArACsAKwBRAFEAUQBRACsAKwArACsAKwArACsAKwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUAArACsAHgAEAAQADQAEAAQABAAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAAQABAAEAAQABAAeAB4AHgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAB4AHgAEAAQABAAEAAQABAAEAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQABAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4ABAAEAAQAHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwArACsAKwArACsAKwArACsAKwArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwBQAFAAKwArAFAAKwArAFAAUAArACsAUABQAFAAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACsAUAArAFAAUABQAFAAUABQAFAAKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwBQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAHgAeAFAAUABQAFAAUAArAFAAKwArACsAUABQAFAAUABQAFAAUAArAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAB4AHgAeAB4AHgAeAB4AHgAeACsAKwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAEsASwBLAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgAeAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAeAB4AHgAeAB4AHgAeAB4ABAAeAB4AHgAeAB4AHgAeAB4AHgAeAAQAHgAeAA0ADQANAA0AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAEAAQABAAEAAQAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAEAAQAKwAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArAAQABAAEAAQABAAEAAQAKwAEAAQAKwAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwAEAAQABAAEAAQABAAEAFAAUABQAFAAUABQAFAAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwBQAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArABsAUABQAFAAUABQACsAKwBQAFAAUABQAFAAUABQAFAAUAAEAAQABAAEAAQABAAEACsAKwArACsAKwArACsAKwArAB4AHgAeAB4ABAAEAAQABAAEAAQABABQACsAKwArACsASwBLAEsASwBLAEsASwBLAEsASwArACsAKwArABYAFgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAGgBQAFAAUAAaAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAeAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQACsAKwBQAFAAUABQACsAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwBQAFAAKwBQACsAKwBQACsAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAKwBQACsAUAArACsAKwArACsAKwBQACsAKwArACsAUAArAFAAKwBQACsAUABQAFAAKwBQAFAAKwBQACsAKwBQACsAUAArAFAAKwBQACsAUAArAFAAUAArAFAAKwArAFAAUABQAFAAKwBQAFAAUABQAFAAUABQACsAUABQAFAAUAArAFAAUABQAFAAKwBQACsAUABQAFAAUABQAFAAUABQAFAAUAArAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAArACsAKwArACsAUABQAFAAKwBQAFAAUABQAFAAKwBQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwAeAB4AKwArACsAKwArACsAKwArACsAKwArACsAKwArAE8ATwBPAE8ATwBPAE8ATwBPAE8ATwBPAE8AJQAlACUAHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHgAeAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB4AHgAeACUAJQAlAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAdAB0AHQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAKQApACkAJQAlACUAJQAlACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAlACUAJQAlACUAHgAlACUAJQAlACUAIAAgACAAJQAlACAAJQAlACAAIAAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACEAIQAhACEAIQAlACUAIAAgACUAJQAgACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAJQAlACUAIAAlACUAJQAlACAAIAAgACUAIAAgACAAJQAlACUAJQAlACUAJQAgACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAlAB4AJQAeACUAJQAlACUAJQAgACUAJQAlACUAHgAlAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAlACUAJQAlACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAJQAlACUAJQAgACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACAAIAAgACUAJQAlACAAIAAgACAAIAAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeABcAFwAXABUAFQAVAB4AHgAeAB4AJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAgACUAJQAlACUAJQAlACUAJQAlACAAJQAlACUAJQAlACUAJQAlACUAJQAlACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlACUAJQAeAB4AHgAeAB4AHgAeAB4AHgAeACUAJQAlACUAJQAlAB4AHgAeAB4AHgAeAB4AHgAlACUAJQAlACUAJQAlACUAHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAgACUAJQAgACUAJQAlACUAJQAlACUAJQAgACAAIAAgACAAIAAgACAAJQAlACUAJQAlACUAIAAlACUAJQAlACUAJQAlACUAJQAgACAAIAAgACAAIAAgACAAIAAgACUAJQAgACAAIAAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAgACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACAAIAAlACAAIAAlACAAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAgACAAIAAlACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAJQAlAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AKwAeAB4AHgAeAB4AHgAeAB4AHgAeAB4AHgArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAEsASwBLAEsASwBLAEsASwBLAEsAKwArACsAKwArACsAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAKwArAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwAlACUAJQAlACUAJQAlACUAJQAlACUAVwBXACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQBXAFcAVwBXAFcAVwBXAFcAVwBXAFcAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAJQAlACUAKwAEACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArACsAKwArAA==';

        var LETTER_NUMBER_MODIFIER = 50;
        // Non-tailorable Line Breaking Classes
        var BK = 1; //  Cause a line break (after)
        var CR$1 = 2; //  Cause a line break (after), except between CR and LF
        var LF$1 = 3; //  Cause a line break (after)
        var CM = 4; //  Prohibit a line break between the character and the preceding character
        var NL = 5; //  Cause a line break (after)
        var WJ = 7; //  Prohibit line breaks before and after
        var ZW = 8; //  Provide a break opportunity
        var GL = 9; //  Prohibit line breaks before and after
        var SP = 10; // Enable indirect line breaks
        var ZWJ$1 = 11; // Prohibit line breaks within joiner sequences
        // Break Opportunities
        var B2 = 12; //  Provide a line break opportunity before and after the character
        var BA = 13; //  Generally provide a line break opportunity after the character
        var BB = 14; //  Generally provide a line break opportunity before the character
        var HY = 15; //  Provide a line break opportunity after the character, except in numeric context
        var CB = 16; //   Provide a line break opportunity contingent on additional information
        // Characters Prohibiting Certain Breaks
        var CL = 17; //  Prohibit line breaks before
        var CP = 18; //  Prohibit line breaks before
        var EX = 19; //  Prohibit line breaks before
        var IN = 20; //  Allow only indirect line breaks between pairs
        var NS = 21; //  Allow only indirect line breaks before
        var OP = 22; //  Prohibit line breaks after
        var QU = 23; //  Act like they are both opening and closing
        // Numeric Context
        var IS = 24; //  Prevent breaks after any and before numeric
        var NU = 25; //  Form numeric expressions for line breaking purposes
        var PO = 26; //  Do not break following a numeric expression
        var PR = 27; //  Do not break in front of a numeric expression
        var SY = 28; //  Prevent a break before; and allow a break after
        // Other Characters
        var AI = 29; //  Act like AL when the resolvedEAW is N; otherwise; act as ID
        var AL = 30; //  Are alphabetic characters or symbols that are used with alphabetic characters
        var CJ = 31; //  Treat as NS or ID for strict or normal breaking.
        var EB = 32; //  Do not break from following Emoji Modifier
        var EM = 33; //  Do not break from preceding Emoji Base
        var H2 = 34; //  Form Korean syllable blocks
        var H3 = 35; //  Form Korean syllable blocks
        var HL = 36; //  Do not break around a following hyphen; otherwise act as Alphabetic
        var ID = 37; //  Break before or after; except in some numeric context
        var JL = 38; //  Form Korean syllable blocks
        var JV = 39; //  Form Korean syllable blocks
        var JT = 40; //  Form Korean syllable blocks
        var RI$1 = 41; //  Keep pairs together. For pairs; break before and after other classes
        var SA = 42; //  Provide a line break opportunity contingent on additional, language-specific context analysis
        var XX = 43; //  Have as yet unknown line breaking behavior or unassigned code positions
        var ea_OP = [0x2329, 0xff08];
        var BREAK_MANDATORY = '!';
        var BREAK_NOT_ALLOWED$1 = '×';
        var BREAK_ALLOWED$1 = '÷';
        var UnicodeTrie$1 = createTrieFromBase64$1(base64$1);
        var ALPHABETICS = [AL, HL];
        var HARD_LINE_BREAKS = [BK, CR$1, LF$1, NL];
        var SPACE$1 = [SP, ZW];
        var PREFIX_POSTFIX = [PR, PO];
        var LINE_BREAKS = HARD_LINE_BREAKS.concat(SPACE$1);
        var KOREAN_SYLLABLE_BLOCK = [JL, JV, JT, H2, H3];
        var HYPHEN = [HY, BA];
        var codePointsToCharacterClasses = function (codePoints, lineBreak) {
            if (lineBreak === void 0) { lineBreak = 'strict'; }
            var types = [];
            var indices = [];
            var categories = [];
            codePoints.forEach(function (codePoint, index) {
                var classType = UnicodeTrie$1.get(codePoint);
                if (classType > LETTER_NUMBER_MODIFIER) {
                    categories.push(true);
                    classType -= LETTER_NUMBER_MODIFIER;
                }
                else {
                    categories.push(false);
                }
                if (['normal', 'auto', 'loose'].indexOf(lineBreak) !== -1) {
                    // U+2010, – U+2013, 〜 U+301C, ゠ U+30A0
                    if ([0x2010, 0x2013, 0x301c, 0x30a0].indexOf(codePoint) !== -1) {
                        indices.push(index);
                        return types.push(CB);
                    }
                }
                if (classType === CM || classType === ZWJ$1) {
                    // LB10 Treat any remaining combining mark or ZWJ as AL.
                    if (index === 0) {
                        indices.push(index);
                        return types.push(AL);
                    }
                    // LB9 Do not break a combining character sequence; treat it as if it has the line breaking class of
                    // the base character in all of the following rules. Treat ZWJ as if it were CM.
                    var prev = types[index - 1];
                    if (LINE_BREAKS.indexOf(prev) === -1) {
                        indices.push(indices[index - 1]);
                        return types.push(prev);
                    }
                    indices.push(index);
                    return types.push(AL);
                }
                indices.push(index);
                if (classType === CJ) {
                    return types.push(lineBreak === 'strict' ? NS : ID);
                }
                if (classType === SA) {
                    return types.push(AL);
                }
                if (classType === AI) {
                    return types.push(AL);
                }
                // For supplementary characters, a useful default is to treat characters in the range 10000..1FFFD as AL
                // and characters in the ranges 20000..2FFFD and 30000..3FFFD as ID, until the implementation can be revised
                // to take into account the actual line breaking properties for these characters.
                if (classType === XX) {
                    if ((codePoint >= 0x20000 && codePoint <= 0x2fffd) || (codePoint >= 0x30000 && codePoint <= 0x3fffd)) {
                        return types.push(ID);
                    }
                    else {
                        return types.push(AL);
                    }
                }
                types.push(classType);
            });
            return [indices, types, categories];
        };
        var isAdjacentWithSpaceIgnored = function (a, b, currentIndex, classTypes) {
            var current = classTypes[currentIndex];
            if (Array.isArray(a) ? a.indexOf(current) !== -1 : a === current) {
                var i = currentIndex;
                while (i <= classTypes.length) {
                    i++;
                    var next = classTypes[i];
                    if (next === b) {
                        return true;
                    }
                    if (next !== SP) {
                        break;
                    }
                }
            }
            if (current === SP) {
                var i = currentIndex;
                while (i > 0) {
                    i--;
                    var prev = classTypes[i];
                    if (Array.isArray(a) ? a.indexOf(prev) !== -1 : a === prev) {
                        var n = currentIndex;
                        while (n <= classTypes.length) {
                            n++;
                            var next = classTypes[n];
                            if (next === b) {
                                return true;
                            }
                            if (next !== SP) {
                                break;
                            }
                        }
                    }
                    if (prev !== SP) {
                        break;
                    }
                }
            }
            return false;
        };
        var previousNonSpaceClassType = function (currentIndex, classTypes) {
            var i = currentIndex;
            while (i >= 0) {
                var type = classTypes[i];
                if (type === SP) {
                    i--;
                }
                else {
                    return type;
                }
            }
            return 0;
        };
        var _lineBreakAtIndex = function (codePoints, classTypes, indicies, index, forbiddenBreaks) {
            if (indicies[index] === 0) {
                return BREAK_NOT_ALLOWED$1;
            }
            var currentIndex = index - 1;
            if (Array.isArray(forbiddenBreaks) && forbiddenBreaks[currentIndex] === true) {
                return BREAK_NOT_ALLOWED$1;
            }
            var beforeIndex = currentIndex - 1;
            var afterIndex = currentIndex + 1;
            var current = classTypes[currentIndex];
            // LB4 Always break after hard line breaks.
            // LB5 Treat CR followed by LF, as well as CR, LF, and NL as hard line breaks.
            var before = beforeIndex >= 0 ? classTypes[beforeIndex] : 0;
            var next = classTypes[afterIndex];
            if (current === CR$1 && next === LF$1) {
                return BREAK_NOT_ALLOWED$1;
            }
            if (HARD_LINE_BREAKS.indexOf(current) !== -1) {
                return BREAK_MANDATORY;
            }
            // LB6 Do not break before hard line breaks.
            if (HARD_LINE_BREAKS.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB7 Do not break before spaces or zero width space.
            if (SPACE$1.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB8 Break before any character following a zero-width space, even if one or more spaces intervene.
            if (previousNonSpaceClassType(currentIndex, classTypes) === ZW) {
                return BREAK_ALLOWED$1;
            }
            // LB8a Do not break after a zero width joiner.
            if (UnicodeTrie$1.get(codePoints[currentIndex]) === ZWJ$1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // zwj emojis
            if ((current === EB || current === EM) && UnicodeTrie$1.get(codePoints[afterIndex]) === ZWJ$1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB11 Do not break before or after Word joiner and related characters.
            if (current === WJ || next === WJ) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB12 Do not break after NBSP and related characters.
            if (current === GL) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB12a Do not break before NBSP and related characters, except after spaces and hyphens.
            if ([SP, BA, HY].indexOf(current) === -1 && next === GL) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB13 Do not break before ‘]’ or ‘!’ or ‘;’ or ‘/’, even after spaces.
            if ([CL, CP, EX, IS, SY].indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB14 Do not break after ‘[’, even after spaces.
            if (previousNonSpaceClassType(currentIndex, classTypes) === OP) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB15 Do not break within ‘”[’, even with intervening spaces.
            if (isAdjacentWithSpaceIgnored(QU, OP, currentIndex, classTypes)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB16 Do not break between closing punctuation and a nonstarter (lb=NS), even with intervening spaces.
            if (isAdjacentWithSpaceIgnored([CL, CP], NS, currentIndex, classTypes)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB17 Do not break within ‘——’, even with intervening spaces.
            if (isAdjacentWithSpaceIgnored(B2, B2, currentIndex, classTypes)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB18 Break after spaces.
            if (current === SP) {
                return BREAK_ALLOWED$1;
            }
            // LB19 Do not break before or after quotation marks, such as ‘ ” ’.
            if (current === QU || next === QU) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB20 Break before and after unresolved CB.
            if (next === CB || current === CB) {
                return BREAK_ALLOWED$1;
            }
            // LB21 Do not break before hyphen-minus, other hyphens, fixed-width spaces, small kana, and other non-starters, or after acute accents.
            if ([BA, HY, NS].indexOf(next) !== -1 || current === BB) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB21a Don't break after Hebrew + Hyphen.
            if (before === HL && HYPHEN.indexOf(current) !== -1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB21b Don’t break between Solidus and Hebrew letters.
            if (current === SY && next === HL) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB22 Do not break before ellipsis.
            if (next === IN) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB23 Do not break between digits and letters.
            if ((ALPHABETICS.indexOf(next) !== -1 && current === NU) || (ALPHABETICS.indexOf(current) !== -1 && next === NU)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB23a Do not break between numeric prefixes and ideographs, or between ideographs and numeric postfixes.
            if ((current === PR && [ID, EB, EM].indexOf(next) !== -1) ||
                ([ID, EB, EM].indexOf(current) !== -1 && next === PO)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB24 Do not break between numeric prefix/postfix and letters, or between letters and prefix/postfix.
            if ((ALPHABETICS.indexOf(current) !== -1 && PREFIX_POSTFIX.indexOf(next) !== -1) ||
                (PREFIX_POSTFIX.indexOf(current) !== -1 && ALPHABETICS.indexOf(next) !== -1)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB25 Do not break between the following pairs of classes relevant to numbers:
            if (
            // (PR | PO) × ( OP | HY )? NU
            ([PR, PO].indexOf(current) !== -1 &&
                (next === NU || ([OP, HY].indexOf(next) !== -1 && classTypes[afterIndex + 1] === NU))) ||
                // ( OP | HY ) × NU
                ([OP, HY].indexOf(current) !== -1 && next === NU) ||
                // NU ×	(NU | SY | IS)
                (current === NU && [NU, SY, IS].indexOf(next) !== -1)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // NU (NU | SY | IS)* × (NU | SY | IS | CL | CP)
            if ([NU, SY, IS, CL, CP].indexOf(next) !== -1) {
                var prevIndex = currentIndex;
                while (prevIndex >= 0) {
                    var type = classTypes[prevIndex];
                    if (type === NU) {
                        return BREAK_NOT_ALLOWED$1;
                    }
                    else if ([SY, IS].indexOf(type) !== -1) {
                        prevIndex--;
                    }
                    else {
                        break;
                    }
                }
            }
            // NU (NU | SY | IS)* (CL | CP)? × (PO | PR))
            if ([PR, PO].indexOf(next) !== -1) {
                var prevIndex = [CL, CP].indexOf(current) !== -1 ? beforeIndex : currentIndex;
                while (prevIndex >= 0) {
                    var type = classTypes[prevIndex];
                    if (type === NU) {
                        return BREAK_NOT_ALLOWED$1;
                    }
                    else if ([SY, IS].indexOf(type) !== -1) {
                        prevIndex--;
                    }
                    else {
                        break;
                    }
                }
            }
            // LB26 Do not break a Korean syllable.
            if ((JL === current && [JL, JV, H2, H3].indexOf(next) !== -1) ||
                ([JV, H2].indexOf(current) !== -1 && [JV, JT].indexOf(next) !== -1) ||
                ([JT, H3].indexOf(current) !== -1 && next === JT)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB27 Treat a Korean Syllable Block the same as ID.
            if ((KOREAN_SYLLABLE_BLOCK.indexOf(current) !== -1 && [IN, PO].indexOf(next) !== -1) ||
                (KOREAN_SYLLABLE_BLOCK.indexOf(next) !== -1 && current === PR)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB28 Do not break between alphabetics (“at”).
            if (ALPHABETICS.indexOf(current) !== -1 && ALPHABETICS.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB29 Do not break between numeric punctuation and alphabetics (“e.g.”).
            if (current === IS && ALPHABETICS.indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB30 Do not break between letters, numbers, or ordinary symbols and opening or closing parentheses.
            if ((ALPHABETICS.concat(NU).indexOf(current) !== -1 &&
                next === OP &&
                ea_OP.indexOf(codePoints[afterIndex]) === -1) ||
                (ALPHABETICS.concat(NU).indexOf(next) !== -1 && current === CP)) {
                return BREAK_NOT_ALLOWED$1;
            }
            // LB30a Break between two regional indicator symbols if and only if there are an even number of regional
            // indicators preceding the position of the break.
            if (current === RI$1 && next === RI$1) {
                var i = indicies[currentIndex];
                var count = 1;
                while (i > 0) {
                    i--;
                    if (classTypes[i] === RI$1) {
                        count++;
                    }
                    else {
                        break;
                    }
                }
                if (count % 2 !== 0) {
                    return BREAK_NOT_ALLOWED$1;
                }
            }
            // LB30b Do not break between an emoji base and an emoji modifier.
            if (current === EB && next === EM) {
                return BREAK_NOT_ALLOWED$1;
            }
            return BREAK_ALLOWED$1;
        };
        var cssFormattedClasses = function (codePoints, options) {
            if (!options) {
                options = { lineBreak: 'normal', wordBreak: 'normal' };
            }
            var _a = codePointsToCharacterClasses(codePoints, options.lineBreak), indicies = _a[0], classTypes = _a[1], isLetterNumber = _a[2];
            if (options.wordBreak === 'break-all' || options.wordBreak === 'break-word') {
                classTypes = classTypes.map(function (type) { return ([NU, AL, SA].indexOf(type) !== -1 ? ID : type); });
            }
            var forbiddenBreakpoints = options.wordBreak === 'keep-all'
                ? isLetterNumber.map(function (letterNumber, i) {
                    return letterNumber && codePoints[i] >= 0x4e00 && codePoints[i] <= 0x9fff;
                })
                : undefined;
            return [indicies, classTypes, forbiddenBreakpoints];
        };
        var Break = /** @class */ (function () {
            function Break(codePoints, lineBreak, start, end) {
                this.codePoints = codePoints;
                this.required = lineBreak === BREAK_MANDATORY;
                this.start = start;
                this.end = end;
            }
            Break.prototype.slice = function () {
                return fromCodePoint$1.apply(void 0, this.codePoints.slice(this.start, this.end));
            };
            return Break;
        }());
        var LineBreaker = function (str, options) {
            var codePoints = toCodePoints$1(str);
            var _a = cssFormattedClasses(codePoints, options), indicies = _a[0], classTypes = _a[1], forbiddenBreakpoints = _a[2];
            var length = codePoints.length;
            var lastEnd = 0;
            var nextIndex = 0;
            return {
                next: function () {
                    if (nextIndex >= length) {
                        return { done: true, value: null };
                    }
                    var lineBreak = BREAK_NOT_ALLOWED$1;
                    while (nextIndex < length &&
                        (lineBreak = _lineBreakAtIndex(codePoints, classTypes, indicies, ++nextIndex, forbiddenBreakpoints)) ===
                            BREAK_NOT_ALLOWED$1) { }
                    if (lineBreak !== BREAK_NOT_ALLOWED$1 || nextIndex === length) {
                        var value = new Break(codePoints, lineBreak, lastEnd, nextIndex);
                        lastEnd = nextIndex;
                        return { value: value, done: false };
                    }
                    return { done: true, value: null };
                },
            };
        };

        // https://www.w3.org/TR/css-syntax-3
        var FLAG_UNRESTRICTED = 1 << 0;
        var FLAG_ID = 1 << 1;
        var FLAG_INTEGER = 1 << 2;
        var FLAG_NUMBER = 1 << 3;
        var LINE_FEED = 0x000a;
        var SOLIDUS = 0x002f;
        var REVERSE_SOLIDUS = 0x005c;
        var CHARACTER_TABULATION = 0x0009;
        var SPACE = 0x0020;
        var QUOTATION_MARK = 0x0022;
        var EQUALS_SIGN = 0x003d;
        var NUMBER_SIGN = 0x0023;
        var DOLLAR_SIGN = 0x0024;
        var PERCENTAGE_SIGN = 0x0025;
        var APOSTROPHE = 0x0027;
        var LEFT_PARENTHESIS = 0x0028;
        var RIGHT_PARENTHESIS = 0x0029;
        var LOW_LINE = 0x005f;
        var HYPHEN_MINUS = 0x002d;
        var EXCLAMATION_MARK = 0x0021;
        var LESS_THAN_SIGN = 0x003c;
        var GREATER_THAN_SIGN = 0x003e;
        var COMMERCIAL_AT = 0x0040;
        var LEFT_SQUARE_BRACKET = 0x005b;
        var RIGHT_SQUARE_BRACKET = 0x005d;
        var CIRCUMFLEX_ACCENT = 0x003d;
        var LEFT_CURLY_BRACKET = 0x007b;
        var QUESTION_MARK = 0x003f;
        var RIGHT_CURLY_BRACKET = 0x007d;
        var VERTICAL_LINE = 0x007c;
        var TILDE = 0x007e;
        var CONTROL = 0x0080;
        var REPLACEMENT_CHARACTER = 0xfffd;
        var ASTERISK = 0x002a;
        var PLUS_SIGN = 0x002b;
        var COMMA = 0x002c;
        var COLON = 0x003a;
        var SEMICOLON = 0x003b;
        var FULL_STOP = 0x002e;
        var NULL = 0x0000;
        var BACKSPACE = 0x0008;
        var LINE_TABULATION = 0x000b;
        var SHIFT_OUT = 0x000e;
        var INFORMATION_SEPARATOR_ONE = 0x001f;
        var DELETE = 0x007f;
        var EOF = -1;
        var ZERO = 0x0030;
        var a = 0x0061;
        var e = 0x0065;
        var f = 0x0066;
        var u = 0x0075;
        var z = 0x007a;
        var A = 0x0041;
        var E = 0x0045;
        var F = 0x0046;
        var U = 0x0055;
        var Z = 0x005a;
        var isDigit = function (codePoint) { return codePoint >= ZERO && codePoint <= 0x0039; };
        var isSurrogateCodePoint = function (codePoint) { return codePoint >= 0xd800 && codePoint <= 0xdfff; };
        var isHex = function (codePoint) {
            return isDigit(codePoint) || (codePoint >= A && codePoint <= F) || (codePoint >= a && codePoint <= f);
        };
        var isLowerCaseLetter = function (codePoint) { return codePoint >= a && codePoint <= z; };
        var isUpperCaseLetter = function (codePoint) { return codePoint >= A && codePoint <= Z; };
        var isLetter = function (codePoint) { return isLowerCaseLetter(codePoint) || isUpperCaseLetter(codePoint); };
        var isNonASCIICodePoint = function (codePoint) { return codePoint >= CONTROL; };
        var isWhiteSpace = function (codePoint) {
            return codePoint === LINE_FEED || codePoint === CHARACTER_TABULATION || codePoint === SPACE;
        };
        var isNameStartCodePoint = function (codePoint) {
            return isLetter(codePoint) || isNonASCIICodePoint(codePoint) || codePoint === LOW_LINE;
        };
        var isNameCodePoint = function (codePoint) {
            return isNameStartCodePoint(codePoint) || isDigit(codePoint) || codePoint === HYPHEN_MINUS;
        };
        var isNonPrintableCodePoint = function (codePoint) {
            return ((codePoint >= NULL && codePoint <= BACKSPACE) ||
                codePoint === LINE_TABULATION ||
                (codePoint >= SHIFT_OUT && codePoint <= INFORMATION_SEPARATOR_ONE) ||
                codePoint === DELETE);
        };
        var isValidEscape = function (c1, c2) {
            if (c1 !== REVERSE_SOLIDUS) {
                return false;
            }
            return c2 !== LINE_FEED;
        };
        var isIdentifierStart = function (c1, c2, c3) {
            if (c1 === HYPHEN_MINUS) {
                return isNameStartCodePoint(c2) || isValidEscape(c2, c3);
            }
            else if (isNameStartCodePoint(c1)) {
                return true;
            }
            else if (c1 === REVERSE_SOLIDUS && isValidEscape(c1, c2)) {
                return true;
            }
            return false;
        };
        var isNumberStart = function (c1, c2, c3) {
            if (c1 === PLUS_SIGN || c1 === HYPHEN_MINUS) {
                if (isDigit(c2)) {
                    return true;
                }
                return c2 === FULL_STOP && isDigit(c3);
            }
            if (c1 === FULL_STOP) {
                return isDigit(c2);
            }
            return isDigit(c1);
        };
        var stringToNumber = function (codePoints) {
            var c = 0;
            var sign = 1;
            if (codePoints[c] === PLUS_SIGN || codePoints[c] === HYPHEN_MINUS) {
                if (codePoints[c] === HYPHEN_MINUS) {
                    sign = -1;
                }
                c++;
            }
            var integers = [];
            while (isDigit(codePoints[c])) {
                integers.push(codePoints[c++]);
            }
            var int = integers.length ? parseInt(fromCodePoint$1.apply(void 0, integers), 10) : 0;
            if (codePoints[c] === FULL_STOP) {
                c++;
            }
            var fraction = [];
            while (isDigit(codePoints[c])) {
                fraction.push(codePoints[c++]);
            }
            var fracd = fraction.length;
            var frac = fracd ? parseInt(fromCodePoint$1.apply(void 0, fraction), 10) : 0;
            if (codePoints[c] === E || codePoints[c] === e) {
                c++;
            }
            var expsign = 1;
            if (codePoints[c] === PLUS_SIGN || codePoints[c] === HYPHEN_MINUS) {
                if (codePoints[c] === HYPHEN_MINUS) {
                    expsign = -1;
                }
                c++;
            }
            var exponent = [];
            while (isDigit(codePoints[c])) {
                exponent.push(codePoints[c++]);
            }
            var exp = exponent.length ? parseInt(fromCodePoint$1.apply(void 0, exponent), 10) : 0;
            return sign * (int + frac * Math.pow(10, -fracd)) * Math.pow(10, expsign * exp);
        };
        var LEFT_PARENTHESIS_TOKEN = {
            type: 2 /* LEFT_PARENTHESIS_TOKEN */
        };
        var RIGHT_PARENTHESIS_TOKEN = {
            type: 3 /* RIGHT_PARENTHESIS_TOKEN */
        };
        var COMMA_TOKEN = { type: 4 /* COMMA_TOKEN */ };
        var SUFFIX_MATCH_TOKEN = { type: 13 /* SUFFIX_MATCH_TOKEN */ };
        var PREFIX_MATCH_TOKEN = { type: 8 /* PREFIX_MATCH_TOKEN */ };
        var COLUMN_TOKEN = { type: 21 /* COLUMN_TOKEN */ };
        var DASH_MATCH_TOKEN = { type: 9 /* DASH_MATCH_TOKEN */ };
        var INCLUDE_MATCH_TOKEN = { type: 10 /* INCLUDE_MATCH_TOKEN */ };
        var LEFT_CURLY_BRACKET_TOKEN = {
            type: 11 /* LEFT_CURLY_BRACKET_TOKEN */
        };
        var RIGHT_CURLY_BRACKET_TOKEN = {
            type: 12 /* RIGHT_CURLY_BRACKET_TOKEN */
        };
        var SUBSTRING_MATCH_TOKEN = { type: 14 /* SUBSTRING_MATCH_TOKEN */ };
        var BAD_URL_TOKEN = { type: 23 /* BAD_URL_TOKEN */ };
        var BAD_STRING_TOKEN = { type: 1 /* BAD_STRING_TOKEN */ };
        var CDO_TOKEN = { type: 25 /* CDO_TOKEN */ };
        var CDC_TOKEN = { type: 24 /* CDC_TOKEN */ };
        var COLON_TOKEN = { type: 26 /* COLON_TOKEN */ };
        var SEMICOLON_TOKEN = { type: 27 /* SEMICOLON_TOKEN */ };
        var LEFT_SQUARE_BRACKET_TOKEN = {
            type: 28 /* LEFT_SQUARE_BRACKET_TOKEN */
        };
        var RIGHT_SQUARE_BRACKET_TOKEN = {
            type: 29 /* RIGHT_SQUARE_BRACKET_TOKEN */
        };
        var WHITESPACE_TOKEN = { type: 31 /* WHITESPACE_TOKEN */ };
        var EOF_TOKEN = { type: 32 /* EOF_TOKEN */ };
        var Tokenizer = /** @class */ (function () {
            function Tokenizer() {
                this._value = [];
            }
            Tokenizer.prototype.write = function (chunk) {
                this._value = this._value.concat(toCodePoints$1(chunk));
            };
            Tokenizer.prototype.read = function () {
                var tokens = [];
                var token = this.consumeToken();
                while (token !== EOF_TOKEN) {
                    tokens.push(token);
                    token = this.consumeToken();
                }
                return tokens;
            };
            Tokenizer.prototype.consumeToken = function () {
                var codePoint = this.consumeCodePoint();
                switch (codePoint) {
                    case QUOTATION_MARK:
                        return this.consumeStringToken(QUOTATION_MARK);
                    case NUMBER_SIGN:
                        var c1 = this.peekCodePoint(0);
                        var c2 = this.peekCodePoint(1);
                        var c3 = this.peekCodePoint(2);
                        if (isNameCodePoint(c1) || isValidEscape(c2, c3)) {
                            var flags = isIdentifierStart(c1, c2, c3) ? FLAG_ID : FLAG_UNRESTRICTED;
                            var value = this.consumeName();
                            return { type: 5 /* HASH_TOKEN */, value: value, flags: flags };
                        }
                        break;
                    case DOLLAR_SIGN:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return SUFFIX_MATCH_TOKEN;
                        }
                        break;
                    case APOSTROPHE:
                        return this.consumeStringToken(APOSTROPHE);
                    case LEFT_PARENTHESIS:
                        return LEFT_PARENTHESIS_TOKEN;
                    case RIGHT_PARENTHESIS:
                        return RIGHT_PARENTHESIS_TOKEN;
                    case ASTERISK:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return SUBSTRING_MATCH_TOKEN;
                        }
                        break;
                    case PLUS_SIGN:
                        if (isNumberStart(codePoint, this.peekCodePoint(0), this.peekCodePoint(1))) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeNumericToken();
                        }
                        break;
                    case COMMA:
                        return COMMA_TOKEN;
                    case HYPHEN_MINUS:
                        var e1 = codePoint;
                        var e2 = this.peekCodePoint(0);
                        var e3 = this.peekCodePoint(1);
                        if (isNumberStart(e1, e2, e3)) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeNumericToken();
                        }
                        if (isIdentifierStart(e1, e2, e3)) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeIdentLikeToken();
                        }
                        if (e2 === HYPHEN_MINUS && e3 === GREATER_THAN_SIGN) {
                            this.consumeCodePoint();
                            this.consumeCodePoint();
                            return CDC_TOKEN;
                        }
                        break;
                    case FULL_STOP:
                        if (isNumberStart(codePoint, this.peekCodePoint(0), this.peekCodePoint(1))) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeNumericToken();
                        }
                        break;
                    case SOLIDUS:
                        if (this.peekCodePoint(0) === ASTERISK) {
                            this.consumeCodePoint();
                            while (true) {
                                var c = this.consumeCodePoint();
                                if (c === ASTERISK) {
                                    c = this.consumeCodePoint();
                                    if (c === SOLIDUS) {
                                        return this.consumeToken();
                                    }
                                }
                                if (c === EOF) {
                                    return this.consumeToken();
                                }
                            }
                        }
                        break;
                    case COLON:
                        return COLON_TOKEN;
                    case SEMICOLON:
                        return SEMICOLON_TOKEN;
                    case LESS_THAN_SIGN:
                        if (this.peekCodePoint(0) === EXCLAMATION_MARK &&
                            this.peekCodePoint(1) === HYPHEN_MINUS &&
                            this.peekCodePoint(2) === HYPHEN_MINUS) {
                            this.consumeCodePoint();
                            this.consumeCodePoint();
                            return CDO_TOKEN;
                        }
                        break;
                    case COMMERCIAL_AT:
                        var a1 = this.peekCodePoint(0);
                        var a2 = this.peekCodePoint(1);
                        var a3 = this.peekCodePoint(2);
                        if (isIdentifierStart(a1, a2, a3)) {
                            var value = this.consumeName();
                            return { type: 7 /* AT_KEYWORD_TOKEN */, value: value };
                        }
                        break;
                    case LEFT_SQUARE_BRACKET:
                        return LEFT_SQUARE_BRACKET_TOKEN;
                    case REVERSE_SOLIDUS:
                        if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                            this.reconsumeCodePoint(codePoint);
                            return this.consumeIdentLikeToken();
                        }
                        break;
                    case RIGHT_SQUARE_BRACKET:
                        return RIGHT_SQUARE_BRACKET_TOKEN;
                    case CIRCUMFLEX_ACCENT:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return PREFIX_MATCH_TOKEN;
                        }
                        break;
                    case LEFT_CURLY_BRACKET:
                        return LEFT_CURLY_BRACKET_TOKEN;
                    case RIGHT_CURLY_BRACKET:
                        return RIGHT_CURLY_BRACKET_TOKEN;
                    case u:
                    case U:
                        var u1 = this.peekCodePoint(0);
                        var u2 = this.peekCodePoint(1);
                        if (u1 === PLUS_SIGN && (isHex(u2) || u2 === QUESTION_MARK)) {
                            this.consumeCodePoint();
                            this.consumeUnicodeRangeToken();
                        }
                        this.reconsumeCodePoint(codePoint);
                        return this.consumeIdentLikeToken();
                    case VERTICAL_LINE:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return DASH_MATCH_TOKEN;
                        }
                        if (this.peekCodePoint(0) === VERTICAL_LINE) {
                            this.consumeCodePoint();
                            return COLUMN_TOKEN;
                        }
                        break;
                    case TILDE:
                        if (this.peekCodePoint(0) === EQUALS_SIGN) {
                            this.consumeCodePoint();
                            return INCLUDE_MATCH_TOKEN;
                        }
                        break;
                    case EOF:
                        return EOF_TOKEN;
                }
                if (isWhiteSpace(codePoint)) {
                    this.consumeWhiteSpace();
                    return WHITESPACE_TOKEN;
                }
                if (isDigit(codePoint)) {
                    this.reconsumeCodePoint(codePoint);
                    return this.consumeNumericToken();
                }
                if (isNameStartCodePoint(codePoint)) {
                    this.reconsumeCodePoint(codePoint);
                    return this.consumeIdentLikeToken();
                }
                return { type: 6 /* DELIM_TOKEN */, value: fromCodePoint$1(codePoint) };
            };
            Tokenizer.prototype.consumeCodePoint = function () {
                var value = this._value.shift();
                return typeof value === 'undefined' ? -1 : value;
            };
            Tokenizer.prototype.reconsumeCodePoint = function (codePoint) {
                this._value.unshift(codePoint);
            };
            Tokenizer.prototype.peekCodePoint = function (delta) {
                if (delta >= this._value.length) {
                    return -1;
                }
                return this._value[delta];
            };
            Tokenizer.prototype.consumeUnicodeRangeToken = function () {
                var digits = [];
                var codePoint = this.consumeCodePoint();
                while (isHex(codePoint) && digits.length < 6) {
                    digits.push(codePoint);
                    codePoint = this.consumeCodePoint();
                }
                var questionMarks = false;
                while (codePoint === QUESTION_MARK && digits.length < 6) {
                    digits.push(codePoint);
                    codePoint = this.consumeCodePoint();
                    questionMarks = true;
                }
                if (questionMarks) {
                    var start_1 = parseInt(fromCodePoint$1.apply(void 0, digits.map(function (digit) { return (digit === QUESTION_MARK ? ZERO : digit); })), 16);
                    var end = parseInt(fromCodePoint$1.apply(void 0, digits.map(function (digit) { return (digit === QUESTION_MARK ? F : digit); })), 16);
                    return { type: 30 /* UNICODE_RANGE_TOKEN */, start: start_1, end: end };
                }
                var start = parseInt(fromCodePoint$1.apply(void 0, digits), 16);
                if (this.peekCodePoint(0) === HYPHEN_MINUS && isHex(this.peekCodePoint(1))) {
                    this.consumeCodePoint();
                    codePoint = this.consumeCodePoint();
                    var endDigits = [];
                    while (isHex(codePoint) && endDigits.length < 6) {
                        endDigits.push(codePoint);
                        codePoint = this.consumeCodePoint();
                    }
                    var end = parseInt(fromCodePoint$1.apply(void 0, endDigits), 16);
                    return { type: 30 /* UNICODE_RANGE_TOKEN */, start: start, end: end };
                }
                else {
                    return { type: 30 /* UNICODE_RANGE_TOKEN */, start: start, end: start };
                }
            };
            Tokenizer.prototype.consumeIdentLikeToken = function () {
                var value = this.consumeName();
                if (value.toLowerCase() === 'url' && this.peekCodePoint(0) === LEFT_PARENTHESIS) {
                    this.consumeCodePoint();
                    return this.consumeUrlToken();
                }
                else if (this.peekCodePoint(0) === LEFT_PARENTHESIS) {
                    this.consumeCodePoint();
                    return { type: 19 /* FUNCTION_TOKEN */, value: value };
                }
                return { type: 20 /* IDENT_TOKEN */, value: value };
            };
            Tokenizer.prototype.consumeUrlToken = function () {
                var value = [];
                this.consumeWhiteSpace();
                if (this.peekCodePoint(0) === EOF) {
                    return { type: 22 /* URL_TOKEN */, value: '' };
                }
                var next = this.peekCodePoint(0);
                if (next === APOSTROPHE || next === QUOTATION_MARK) {
                    var stringToken = this.consumeStringToken(this.consumeCodePoint());
                    if (stringToken.type === 0 /* STRING_TOKEN */) {
                        this.consumeWhiteSpace();
                        if (this.peekCodePoint(0) === EOF || this.peekCodePoint(0) === RIGHT_PARENTHESIS) {
                            this.consumeCodePoint();
                            return { type: 22 /* URL_TOKEN */, value: stringToken.value };
                        }
                    }
                    this.consumeBadUrlRemnants();
                    return BAD_URL_TOKEN;
                }
                while (true) {
                    var codePoint = this.consumeCodePoint();
                    if (codePoint === EOF || codePoint === RIGHT_PARENTHESIS) {
                        return { type: 22 /* URL_TOKEN */, value: fromCodePoint$1.apply(void 0, value) };
                    }
                    else if (isWhiteSpace(codePoint)) {
                        this.consumeWhiteSpace();
                        if (this.peekCodePoint(0) === EOF || this.peekCodePoint(0) === RIGHT_PARENTHESIS) {
                            this.consumeCodePoint();
                            return { type: 22 /* URL_TOKEN */, value: fromCodePoint$1.apply(void 0, value) };
                        }
                        this.consumeBadUrlRemnants();
                        return BAD_URL_TOKEN;
                    }
                    else if (codePoint === QUOTATION_MARK ||
                        codePoint === APOSTROPHE ||
                        codePoint === LEFT_PARENTHESIS ||
                        isNonPrintableCodePoint(codePoint)) {
                        this.consumeBadUrlRemnants();
                        return BAD_URL_TOKEN;
                    }
                    else if (codePoint === REVERSE_SOLIDUS) {
                        if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                            value.push(this.consumeEscapedCodePoint());
                        }
                        else {
                            this.consumeBadUrlRemnants();
                            return BAD_URL_TOKEN;
                        }
                    }
                    else {
                        value.push(codePoint);
                    }
                }
            };
            Tokenizer.prototype.consumeWhiteSpace = function () {
                while (isWhiteSpace(this.peekCodePoint(0))) {
                    this.consumeCodePoint();
                }
            };
            Tokenizer.prototype.consumeBadUrlRemnants = function () {
                while (true) {
                    var codePoint = this.consumeCodePoint();
                    if (codePoint === RIGHT_PARENTHESIS || codePoint === EOF) {
                        return;
                    }
                    if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                        this.consumeEscapedCodePoint();
                    }
                }
            };
            Tokenizer.prototype.consumeStringSlice = function (count) {
                var SLICE_STACK_SIZE = 50000;
                var value = '';
                while (count > 0) {
                    var amount = Math.min(SLICE_STACK_SIZE, count);
                    value += fromCodePoint$1.apply(void 0, this._value.splice(0, amount));
                    count -= amount;
                }
                this._value.shift();
                return value;
            };
            Tokenizer.prototype.consumeStringToken = function (endingCodePoint) {
                var value = '';
                var i = 0;
                do {
                    var codePoint = this._value[i];
                    if (codePoint === EOF || codePoint === undefined || codePoint === endingCodePoint) {
                        value += this.consumeStringSlice(i);
                        return { type: 0 /* STRING_TOKEN */, value: value };
                    }
                    if (codePoint === LINE_FEED) {
                        this._value.splice(0, i);
                        return BAD_STRING_TOKEN;
                    }
                    if (codePoint === REVERSE_SOLIDUS) {
                        var next = this._value[i + 1];
                        if (next !== EOF && next !== undefined) {
                            if (next === LINE_FEED) {
                                value += this.consumeStringSlice(i);
                                i = -1;
                                this._value.shift();
                            }
                            else if (isValidEscape(codePoint, next)) {
                                value += this.consumeStringSlice(i);
                                value += fromCodePoint$1(this.consumeEscapedCodePoint());
                                i = -1;
                            }
                        }
                    }
                    i++;
                } while (true);
            };
            Tokenizer.prototype.consumeNumber = function () {
                var repr = [];
                var type = FLAG_INTEGER;
                var c1 = this.peekCodePoint(0);
                if (c1 === PLUS_SIGN || c1 === HYPHEN_MINUS) {
                    repr.push(this.consumeCodePoint());
                }
                while (isDigit(this.peekCodePoint(0))) {
                    repr.push(this.consumeCodePoint());
                }
                c1 = this.peekCodePoint(0);
                var c2 = this.peekCodePoint(1);
                if (c1 === FULL_STOP && isDigit(c2)) {
                    repr.push(this.consumeCodePoint(), this.consumeCodePoint());
                    type = FLAG_NUMBER;
                    while (isDigit(this.peekCodePoint(0))) {
                        repr.push(this.consumeCodePoint());
                    }
                }
                c1 = this.peekCodePoint(0);
                c2 = this.peekCodePoint(1);
                var c3 = this.peekCodePoint(2);
                if ((c1 === E || c1 === e) && (((c2 === PLUS_SIGN || c2 === HYPHEN_MINUS) && isDigit(c3)) || isDigit(c2))) {
                    repr.push(this.consumeCodePoint(), this.consumeCodePoint());
                    type = FLAG_NUMBER;
                    while (isDigit(this.peekCodePoint(0))) {
                        repr.push(this.consumeCodePoint());
                    }
                }
                return [stringToNumber(repr), type];
            };
            Tokenizer.prototype.consumeNumericToken = function () {
                var _a = this.consumeNumber(), number = _a[0], flags = _a[1];
                var c1 = this.peekCodePoint(0);
                var c2 = this.peekCodePoint(1);
                var c3 = this.peekCodePoint(2);
                if (isIdentifierStart(c1, c2, c3)) {
                    var unit = this.consumeName();
                    return { type: 15 /* DIMENSION_TOKEN */, number: number, flags: flags, unit: unit };
                }
                if (c1 === PERCENTAGE_SIGN) {
                    this.consumeCodePoint();
                    return { type: 16 /* PERCENTAGE_TOKEN */, number: number, flags: flags };
                }
                return { type: 17 /* NUMBER_TOKEN */, number: number, flags: flags };
            };
            Tokenizer.prototype.consumeEscapedCodePoint = function () {
                var codePoint = this.consumeCodePoint();
                if (isHex(codePoint)) {
                    var hex = fromCodePoint$1(codePoint);
                    while (isHex(this.peekCodePoint(0)) && hex.length < 6) {
                        hex += fromCodePoint$1(this.consumeCodePoint());
                    }
                    if (isWhiteSpace(this.peekCodePoint(0))) {
                        this.consumeCodePoint();
                    }
                    var hexCodePoint = parseInt(hex, 16);
                    if (hexCodePoint === 0 || isSurrogateCodePoint(hexCodePoint) || hexCodePoint > 0x10ffff) {
                        return REPLACEMENT_CHARACTER;
                    }
                    return hexCodePoint;
                }
                if (codePoint === EOF) {
                    return REPLACEMENT_CHARACTER;
                }
                return codePoint;
            };
            Tokenizer.prototype.consumeName = function () {
                var result = '';
                while (true) {
                    var codePoint = this.consumeCodePoint();
                    if (isNameCodePoint(codePoint)) {
                        result += fromCodePoint$1(codePoint);
                    }
                    else if (isValidEscape(codePoint, this.peekCodePoint(0))) {
                        result += fromCodePoint$1(this.consumeEscapedCodePoint());
                    }
                    else {
                        this.reconsumeCodePoint(codePoint);
                        return result;
                    }
                }
            };
            return Tokenizer;
        }());

        var Parser = /** @class */ (function () {
            function Parser(tokens) {
                this._tokens = tokens;
            }
            Parser.create = function (value) {
                var tokenizer = new Tokenizer();
                tokenizer.write(value);
                return new Parser(tokenizer.read());
            };
            Parser.parseValue = function (value) {
                return Parser.create(value).parseComponentValue();
            };
            Parser.parseValues = function (value) {
                return Parser.create(value).parseComponentValues();
            };
            Parser.prototype.parseComponentValue = function () {
                var token = this.consumeToken();
                while (token.type === 31 /* WHITESPACE_TOKEN */) {
                    token = this.consumeToken();
                }
                if (token.type === 32 /* EOF_TOKEN */) {
                    throw new SyntaxError("Error parsing CSS component value, unexpected EOF");
                }
                this.reconsumeToken(token);
                var value = this.consumeComponentValue();
                do {
                    token = this.consumeToken();
                } while (token.type === 31 /* WHITESPACE_TOKEN */);
                if (token.type === 32 /* EOF_TOKEN */) {
                    return value;
                }
                throw new SyntaxError("Error parsing CSS component value, multiple values found when expecting only one");
            };
            Parser.prototype.parseComponentValues = function () {
                var values = [];
                while (true) {
                    var value = this.consumeComponentValue();
                    if (value.type === 32 /* EOF_TOKEN */) {
                        return values;
                    }
                    values.push(value);
                    values.push();
                }
            };
            Parser.prototype.consumeComponentValue = function () {
                var token = this.consumeToken();
                switch (token.type) {
                    case 11 /* LEFT_CURLY_BRACKET_TOKEN */:
                    case 28 /* LEFT_SQUARE_BRACKET_TOKEN */:
                    case 2 /* LEFT_PARENTHESIS_TOKEN */:
                        return this.consumeSimpleBlock(token.type);
                    case 19 /* FUNCTION_TOKEN */:
                        return this.consumeFunction(token);
                }
                return token;
            };
            Parser.prototype.consumeSimpleBlock = function (type) {
                var block = { type: type, values: [] };
                var token = this.consumeToken();
                while (true) {
                    if (token.type === 32 /* EOF_TOKEN */ || isEndingTokenFor(token, type)) {
                        return block;
                    }
                    this.reconsumeToken(token);
                    block.values.push(this.consumeComponentValue());
                    token = this.consumeToken();
                }
            };
            Parser.prototype.consumeFunction = function (functionToken) {
                var cssFunction = {
                    name: functionToken.value,
                    values: [],
                    type: 18 /* FUNCTION */
                };
                while (true) {
                    var token = this.consumeToken();
                    if (token.type === 32 /* EOF_TOKEN */ || token.type === 3 /* RIGHT_PARENTHESIS_TOKEN */) {
                        return cssFunction;
                    }
                    this.reconsumeToken(token);
                    cssFunction.values.push(this.consumeComponentValue());
                }
            };
            Parser.prototype.consumeToken = function () {
                var token = this._tokens.shift();
                return typeof token === 'undefined' ? EOF_TOKEN : token;
            };
            Parser.prototype.reconsumeToken = function (token) {
                this._tokens.unshift(token);
            };
            return Parser;
        }());
        var isDimensionToken = function (token) { return token.type === 15 /* DIMENSION_TOKEN */; };
        var isNumberToken = function (token) { return token.type === 17 /* NUMBER_TOKEN */; };
        var isIdentToken = function (token) { return token.type === 20 /* IDENT_TOKEN */; };
        var isStringToken = function (token) { return token.type === 0 /* STRING_TOKEN */; };
        var isIdentWithValue = function (token, value) {
            return isIdentToken(token) && token.value === value;
        };
        var nonWhiteSpace = function (token) { return token.type !== 31 /* WHITESPACE_TOKEN */; };
        var nonFunctionArgSeparator = function (token) {
            return token.type !== 31 /* WHITESPACE_TOKEN */ && token.type !== 4 /* COMMA_TOKEN */;
        };
        var parseFunctionArgs = function (tokens) {
            var args = [];
            var arg = [];
            tokens.forEach(function (token) {
                if (token.type === 4 /* COMMA_TOKEN */) {
                    if (arg.length === 0) {
                        throw new Error("Error parsing function args, zero tokens for arg");
                    }
                    args.push(arg);
                    arg = [];
                    return;
                }
                if (token.type !== 31 /* WHITESPACE_TOKEN */) {
                    arg.push(token);
                }
            });
            if (arg.length) {
                args.push(arg);
            }
            return args;
        };
        var isEndingTokenFor = function (token, type) {
            if (type === 11 /* LEFT_CURLY_BRACKET_TOKEN */ && token.type === 12 /* RIGHT_CURLY_BRACKET_TOKEN */) {
                return true;
            }
            if (type === 28 /* LEFT_SQUARE_BRACKET_TOKEN */ && token.type === 29 /* RIGHT_SQUARE_BRACKET_TOKEN */) {
                return true;
            }
            return type === 2 /* LEFT_PARENTHESIS_TOKEN */ && token.type === 3 /* RIGHT_PARENTHESIS_TOKEN */;
        };

        var isLength = function (token) {
            return token.type === 17 /* NUMBER_TOKEN */ || token.type === 15 /* DIMENSION_TOKEN */;
        };

        var isLengthPercentage = function (token) {
            return token.type === 16 /* PERCENTAGE_TOKEN */ || isLength(token);
        };
        var parseLengthPercentageTuple = function (tokens) {
            return tokens.length > 1 ? [tokens[0], tokens[1]] : [tokens[0]];
        };
        var ZERO_LENGTH = {
            type: 17 /* NUMBER_TOKEN */,
            number: 0,
            flags: FLAG_INTEGER
        };
        var FIFTY_PERCENT = {
            type: 16 /* PERCENTAGE_TOKEN */,
            number: 50,
            flags: FLAG_INTEGER
        };
        var HUNDRED_PERCENT = {
            type: 16 /* PERCENTAGE_TOKEN */,
            number: 100,
            flags: FLAG_INTEGER
        };
        var getAbsoluteValueForTuple = function (tuple, width, height) {
            var x = tuple[0], y = tuple[1];
            return [getAbsoluteValue(x, width), getAbsoluteValue(typeof y !== 'undefined' ? y : x, height)];
        };
        var getAbsoluteValue = function (token, parent) {
            if (token.type === 16 /* PERCENTAGE_TOKEN */) {
                return (token.number / 100) * parent;
            }
            if (isDimensionToken(token)) {
                switch (token.unit) {
                    case 'rem':
                    case 'em':
                        return 16 * token.number; // TODO use correct font-size
                    case 'px':
                    default:
                        return token.number;
                }
            }
            return token.number;
        };

        var DEG = 'deg';
        var GRAD = 'grad';
        var RAD = 'rad';
        var TURN = 'turn';
        var angle = {
            name: 'angle',
            parse: function (_context, value) {
                if (value.type === 15 /* DIMENSION_TOKEN */) {
                    switch (value.unit) {
                        case DEG:
                            return (Math.PI * value.number) / 180;
                        case GRAD:
                            return (Math.PI / 200) * value.number;
                        case RAD:
                            return value.number;
                        case TURN:
                            return Math.PI * 2 * value.number;
                    }
                }
                throw new Error("Unsupported angle type");
            }
        };
        var isAngle = function (value) {
            if (value.type === 15 /* DIMENSION_TOKEN */) {
                if (value.unit === DEG || value.unit === GRAD || value.unit === RAD || value.unit === TURN) {
                    return true;
                }
            }
            return false;
        };
        var parseNamedSide = function (tokens) {
            var sideOrCorner = tokens
                .filter(isIdentToken)
                .map(function (ident) { return ident.value; })
                .join(' ');
            switch (sideOrCorner) {
                case 'to bottom right':
                case 'to right bottom':
                case 'left top':
                case 'top left':
                    return [ZERO_LENGTH, ZERO_LENGTH];
                case 'to top':
                case 'bottom':
                    return deg(0);
                case 'to bottom left':
                case 'to left bottom':
                case 'right top':
                case 'top right':
                    return [ZERO_LENGTH, HUNDRED_PERCENT];
                case 'to right':
                case 'left':
                    return deg(90);
                case 'to top left':
                case 'to left top':
                case 'right bottom':
                case 'bottom right':
                    return [HUNDRED_PERCENT, HUNDRED_PERCENT];
                case 'to bottom':
                case 'top':
                    return deg(180);
                case 'to top right':
                case 'to right top':
                case 'left bottom':
                case 'bottom left':
                    return [HUNDRED_PERCENT, ZERO_LENGTH];
                case 'to left':
                case 'right':
                    return deg(270);
            }
            return 0;
        };
        var deg = function (deg) { return (Math.PI * deg) / 180; };

        var color$1 = {
            name: 'color',
            parse: function (context, value) {
                if (value.type === 18 /* FUNCTION */) {
                    var colorFunction = SUPPORTED_COLOR_FUNCTIONS[value.name];
                    if (typeof colorFunction === 'undefined') {
                        throw new Error("Attempting to parse an unsupported color function \"" + value.name + "\"");
                    }
                    return colorFunction(context, value.values);
                }
                if (value.type === 5 /* HASH_TOKEN */) {
                    if (value.value.length === 3) {
                        var r = value.value.substring(0, 1);
                        var g = value.value.substring(1, 2);
                        var b = value.value.substring(2, 3);
                        return pack(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), 1);
                    }
                    if (value.value.length === 4) {
                        var r = value.value.substring(0, 1);
                        var g = value.value.substring(1, 2);
                        var b = value.value.substring(2, 3);
                        var a = value.value.substring(3, 4);
                        return pack(parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), parseInt(a + a, 16) / 255);
                    }
                    if (value.value.length === 6) {
                        var r = value.value.substring(0, 2);
                        var g = value.value.substring(2, 4);
                        var b = value.value.substring(4, 6);
                        return pack(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), 1);
                    }
                    if (value.value.length === 8) {
                        var r = value.value.substring(0, 2);
                        var g = value.value.substring(2, 4);
                        var b = value.value.substring(4, 6);
                        var a = value.value.substring(6, 8);
                        return pack(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a, 16) / 255);
                    }
                }
                if (value.type === 20 /* IDENT_TOKEN */) {
                    var namedColor = COLORS[value.value.toUpperCase()];
                    if (typeof namedColor !== 'undefined') {
                        return namedColor;
                    }
                }
                return COLORS.TRANSPARENT;
            }
        };
        var isTransparent = function (color) { return (0xff & color) === 0; };
        var asString = function (color) {
            var alpha = 0xff & color;
            var blue = 0xff & (color >> 8);
            var green = 0xff & (color >> 16);
            var red = 0xff & (color >> 24);
            return alpha < 255 ? "rgba(" + red + "," + green + "," + blue + "," + alpha / 255 + ")" : "rgb(" + red + "," + green + "," + blue + ")";
        };
        var pack = function (r, g, b, a) {
            return ((r << 24) | (g << 16) | (b << 8) | (Math.round(a * 255) << 0)) >>> 0;
        };
        var getTokenColorValue = function (token, i) {
            if (token.type === 17 /* NUMBER_TOKEN */) {
                return token.number;
            }
            if (token.type === 16 /* PERCENTAGE_TOKEN */) {
                var max = i === 3 ? 1 : 255;
                return i === 3 ? (token.number / 100) * max : Math.round((token.number / 100) * max);
            }
            return 0;
        };
        var rgb = function (_context, args) {
            var tokens = args.filter(nonFunctionArgSeparator);
            if (tokens.length === 3) {
                var _a = tokens.map(getTokenColorValue), r = _a[0], g = _a[1], b = _a[2];
                return pack(r, g, b, 1);
            }
            if (tokens.length === 4) {
                var _b = tokens.map(getTokenColorValue), r = _b[0], g = _b[1], b = _b[2], a = _b[3];
                return pack(r, g, b, a);
            }
            return 0;
        };
        function hue2rgb(t1, t2, hue) {
            if (hue < 0) {
                hue += 1;
            }
            if (hue >= 1) {
                hue -= 1;
            }
            if (hue < 1 / 6) {
                return (t2 - t1) * hue * 6 + t1;
            }
            else if (hue < 1 / 2) {
                return t2;
            }
            else if (hue < 2 / 3) {
                return (t2 - t1) * 6 * (2 / 3 - hue) + t1;
            }
            else {
                return t1;
            }
        }
        var hsl = function (context, args) {
            var tokens = args.filter(nonFunctionArgSeparator);
            var hue = tokens[0], saturation = tokens[1], lightness = tokens[2], alpha = tokens[3];
            var h = (hue.type === 17 /* NUMBER_TOKEN */ ? deg(hue.number) : angle.parse(context, hue)) / (Math.PI * 2);
            var s = isLengthPercentage(saturation) ? saturation.number / 100 : 0;
            var l = isLengthPercentage(lightness) ? lightness.number / 100 : 0;
            var a = typeof alpha !== 'undefined' && isLengthPercentage(alpha) ? getAbsoluteValue(alpha, 1) : 1;
            if (s === 0) {
                return pack(l * 255, l * 255, l * 255, 1);
            }
            var t2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
            var t1 = l * 2 - t2;
            var r = hue2rgb(t1, t2, h + 1 / 3);
            var g = hue2rgb(t1, t2, h);
            var b = hue2rgb(t1, t2, h - 1 / 3);
            return pack(r * 255, g * 255, b * 255, a);
        };
        var SUPPORTED_COLOR_FUNCTIONS = {
            hsl: hsl,
            hsla: hsl,
            rgb: rgb,
            rgba: rgb
        };
        var parseColor = function (context, value) {
            return color$1.parse(context, Parser.create(value).parseComponentValue());
        };
        var COLORS = {
            ALICEBLUE: 0xf0f8ffff,
            ANTIQUEWHITE: 0xfaebd7ff,
            AQUA: 0x00ffffff,
            AQUAMARINE: 0x7fffd4ff,
            AZURE: 0xf0ffffff,
            BEIGE: 0xf5f5dcff,
            BISQUE: 0xffe4c4ff,
            BLACK: 0x000000ff,
            BLANCHEDALMOND: 0xffebcdff,
            BLUE: 0x0000ffff,
            BLUEVIOLET: 0x8a2be2ff,
            BROWN: 0xa52a2aff,
            BURLYWOOD: 0xdeb887ff,
            CADETBLUE: 0x5f9ea0ff,
            CHARTREUSE: 0x7fff00ff,
            CHOCOLATE: 0xd2691eff,
            CORAL: 0xff7f50ff,
            CORNFLOWERBLUE: 0x6495edff,
            CORNSILK: 0xfff8dcff,
            CRIMSON: 0xdc143cff,
            CYAN: 0x00ffffff,
            DARKBLUE: 0x00008bff,
            DARKCYAN: 0x008b8bff,
            DARKGOLDENROD: 0xb886bbff,
            DARKGRAY: 0xa9a9a9ff,
            DARKGREEN: 0x006400ff,
            DARKGREY: 0xa9a9a9ff,
            DARKKHAKI: 0xbdb76bff,
            DARKMAGENTA: 0x8b008bff,
            DARKOLIVEGREEN: 0x556b2fff,
            DARKORANGE: 0xff8c00ff,
            DARKORCHID: 0x9932ccff,
            DARKRED: 0x8b0000ff,
            DARKSALMON: 0xe9967aff,
            DARKSEAGREEN: 0x8fbc8fff,
            DARKSLATEBLUE: 0x483d8bff,
            DARKSLATEGRAY: 0x2f4f4fff,
            DARKSLATEGREY: 0x2f4f4fff,
            DARKTURQUOISE: 0x00ced1ff,
            DARKVIOLET: 0x9400d3ff,
            DEEPPINK: 0xff1493ff,
            DEEPSKYBLUE: 0x00bfffff,
            DIMGRAY: 0x696969ff,
            DIMGREY: 0x696969ff,
            DODGERBLUE: 0x1e90ffff,
            FIREBRICK: 0xb22222ff,
            FLORALWHITE: 0xfffaf0ff,
            FORESTGREEN: 0x228b22ff,
            FUCHSIA: 0xff00ffff,
            GAINSBORO: 0xdcdcdcff,
            GHOSTWHITE: 0xf8f8ffff,
            GOLD: 0xffd700ff,
            GOLDENROD: 0xdaa520ff,
            GRAY: 0x808080ff,
            GREEN: 0x008000ff,
            GREENYELLOW: 0xadff2fff,
            GREY: 0x808080ff,
            HONEYDEW: 0xf0fff0ff,
            HOTPINK: 0xff69b4ff,
            INDIANRED: 0xcd5c5cff,
            INDIGO: 0x4b0082ff,
            IVORY: 0xfffff0ff,
            KHAKI: 0xf0e68cff,
            LAVENDER: 0xe6e6faff,
            LAVENDERBLUSH: 0xfff0f5ff,
            LAWNGREEN: 0x7cfc00ff,
            LEMONCHIFFON: 0xfffacdff,
            LIGHTBLUE: 0xadd8e6ff,
            LIGHTCORAL: 0xf08080ff,
            LIGHTCYAN: 0xe0ffffff,
            LIGHTGOLDENRODYELLOW: 0xfafad2ff,
            LIGHTGRAY: 0xd3d3d3ff,
            LIGHTGREEN: 0x90ee90ff,
            LIGHTGREY: 0xd3d3d3ff,
            LIGHTPINK: 0xffb6c1ff,
            LIGHTSALMON: 0xffa07aff,
            LIGHTSEAGREEN: 0x20b2aaff,
            LIGHTSKYBLUE: 0x87cefaff,
            LIGHTSLATEGRAY: 0x778899ff,
            LIGHTSLATEGREY: 0x778899ff,
            LIGHTSTEELBLUE: 0xb0c4deff,
            LIGHTYELLOW: 0xffffe0ff,
            LIME: 0x00ff00ff,
            LIMEGREEN: 0x32cd32ff,
            LINEN: 0xfaf0e6ff,
            MAGENTA: 0xff00ffff,
            MAROON: 0x800000ff,
            MEDIUMAQUAMARINE: 0x66cdaaff,
            MEDIUMBLUE: 0x0000cdff,
            MEDIUMORCHID: 0xba55d3ff,
            MEDIUMPURPLE: 0x9370dbff,
            MEDIUMSEAGREEN: 0x3cb371ff,
            MEDIUMSLATEBLUE: 0x7b68eeff,
            MEDIUMSPRINGGREEN: 0x00fa9aff,
            MEDIUMTURQUOISE: 0x48d1ccff,
            MEDIUMVIOLETRED: 0xc71585ff,
            MIDNIGHTBLUE: 0x191970ff,
            MINTCREAM: 0xf5fffaff,
            MISTYROSE: 0xffe4e1ff,
            MOCCASIN: 0xffe4b5ff,
            NAVAJOWHITE: 0xffdeadff,
            NAVY: 0x000080ff,
            OLDLACE: 0xfdf5e6ff,
            OLIVE: 0x808000ff,
            OLIVEDRAB: 0x6b8e23ff,
            ORANGE: 0xffa500ff,
            ORANGERED: 0xff4500ff,
            ORCHID: 0xda70d6ff,
            PALEGOLDENROD: 0xeee8aaff,
            PALEGREEN: 0x98fb98ff,
            PALETURQUOISE: 0xafeeeeff,
            PALEVIOLETRED: 0xdb7093ff,
            PAPAYAWHIP: 0xffefd5ff,
            PEACHPUFF: 0xffdab9ff,
            PERU: 0xcd853fff,
            PINK: 0xffc0cbff,
            PLUM: 0xdda0ddff,
            POWDERBLUE: 0xb0e0e6ff,
            PURPLE: 0x800080ff,
            REBECCAPURPLE: 0x663399ff,
            RED: 0xff0000ff,
            ROSYBROWN: 0xbc8f8fff,
            ROYALBLUE: 0x4169e1ff,
            SADDLEBROWN: 0x8b4513ff,
            SALMON: 0xfa8072ff,
            SANDYBROWN: 0xf4a460ff,
            SEAGREEN: 0x2e8b57ff,
            SEASHELL: 0xfff5eeff,
            SIENNA: 0xa0522dff,
            SILVER: 0xc0c0c0ff,
            SKYBLUE: 0x87ceebff,
            SLATEBLUE: 0x6a5acdff,
            SLATEGRAY: 0x708090ff,
            SLATEGREY: 0x708090ff,
            SNOW: 0xfffafaff,
            SPRINGGREEN: 0x00ff7fff,
            STEELBLUE: 0x4682b4ff,
            TAN: 0xd2b48cff,
            TEAL: 0x008080ff,
            THISTLE: 0xd8bfd8ff,
            TOMATO: 0xff6347ff,
            TRANSPARENT: 0x00000000,
            TURQUOISE: 0x40e0d0ff,
            VIOLET: 0xee82eeff,
            WHEAT: 0xf5deb3ff,
            WHITE: 0xffffffff,
            WHITESMOKE: 0xf5f5f5ff,
            YELLOW: 0xffff00ff,
            YELLOWGREEN: 0x9acd32ff
        };

        var backgroundClip = {
            name: 'background-clip',
            initialValue: 'border-box',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return tokens.map(function (token) {
                    if (isIdentToken(token)) {
                        switch (token.value) {
                            case 'padding-box':
                                return 1 /* PADDING_BOX */;
                            case 'content-box':
                                return 2 /* CONTENT_BOX */;
                        }
                    }
                    return 0 /* BORDER_BOX */;
                });
            }
        };

        var backgroundColor = {
            name: "background-color",
            initialValue: 'transparent',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'color'
        };

        var parseColorStop = function (context, args) {
            var color = color$1.parse(context, args[0]);
            var stop = args[1];
            return stop && isLengthPercentage(stop) ? { color: color, stop: stop } : { color: color, stop: null };
        };
        var processColorStops = function (stops, lineLength) {
            var first = stops[0];
            var last = stops[stops.length - 1];
            if (first.stop === null) {
                first.stop = ZERO_LENGTH;
            }
            if (last.stop === null) {
                last.stop = HUNDRED_PERCENT;
            }
            var processStops = [];
            var previous = 0;
            for (var i = 0; i < stops.length; i++) {
                var stop_1 = stops[i].stop;
                if (stop_1 !== null) {
                    var absoluteValue = getAbsoluteValue(stop_1, lineLength);
                    if (absoluteValue > previous) {
                        processStops.push(absoluteValue);
                    }
                    else {
                        processStops.push(previous);
                    }
                    previous = absoluteValue;
                }
                else {
                    processStops.push(null);
                }
            }
            var gapBegin = null;
            for (var i = 0; i < processStops.length; i++) {
                var stop_2 = processStops[i];
                if (stop_2 === null) {
                    if (gapBegin === null) {
                        gapBegin = i;
                    }
                }
                else if (gapBegin !== null) {
                    var gapLength = i - gapBegin;
                    var beforeGap = processStops[gapBegin - 1];
                    var gapValue = (stop_2 - beforeGap) / (gapLength + 1);
                    for (var g = 1; g <= gapLength; g++) {
                        processStops[gapBegin + g - 1] = gapValue * g;
                    }
                    gapBegin = null;
                }
            }
            return stops.map(function (_a, i) {
                var color = _a.color;
                return { color: color, stop: Math.max(Math.min(1, processStops[i] / lineLength), 0) };
            });
        };
        var getAngleFromCorner = function (corner, width, height) {
            var centerX = width / 2;
            var centerY = height / 2;
            var x = getAbsoluteValue(corner[0], width) - centerX;
            var y = centerY - getAbsoluteValue(corner[1], height);
            return (Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2);
        };
        var calculateGradientDirection = function (angle, width, height) {
            var radian = typeof angle === 'number' ? angle : getAngleFromCorner(angle, width, height);
            var lineLength = Math.abs(width * Math.sin(radian)) + Math.abs(height * Math.cos(radian));
            var halfWidth = width / 2;
            var halfHeight = height / 2;
            var halfLineLength = lineLength / 2;
            var yDiff = Math.sin(radian - Math.PI / 2) * halfLineLength;
            var xDiff = Math.cos(radian - Math.PI / 2) * halfLineLength;
            return [lineLength, halfWidth - xDiff, halfWidth + xDiff, halfHeight - yDiff, halfHeight + yDiff];
        };
        var distance = function (a, b) { return Math.sqrt(a * a + b * b); };
        var findCorner = function (width, height, x, y, closest) {
            var corners = [
                [0, 0],
                [0, height],
                [width, 0],
                [width, height]
            ];
            return corners.reduce(function (stat, corner) {
                var cx = corner[0], cy = corner[1];
                var d = distance(x - cx, y - cy);
                if (closest ? d < stat.optimumDistance : d > stat.optimumDistance) {
                    return {
                        optimumCorner: corner,
                        optimumDistance: d
                    };
                }
                return stat;
            }, {
                optimumDistance: closest ? Infinity : -Infinity,
                optimumCorner: null
            }).optimumCorner;
        };
        var calculateRadius = function (gradient, x, y, width, height) {
            var rx = 0;
            var ry = 0;
            switch (gradient.size) {
                case 0 /* CLOSEST_SIDE */:
                    // The ending shape is sized so that that it exactly meets the side of the gradient box closest to the gradient’s center.
                    // If the shape is an ellipse, it exactly meets the closest side in each dimension.
                    if (gradient.shape === 0 /* CIRCLE */) {
                        rx = ry = Math.min(Math.abs(x), Math.abs(x - width), Math.abs(y), Math.abs(y - height));
                    }
                    else if (gradient.shape === 1 /* ELLIPSE */) {
                        rx = Math.min(Math.abs(x), Math.abs(x - width));
                        ry = Math.min(Math.abs(y), Math.abs(y - height));
                    }
                    break;
                case 2 /* CLOSEST_CORNER */:
                    // The ending shape is sized so that that it passes through the corner of the gradient box closest to the gradient’s center.
                    // If the shape is an ellipse, the ending shape is given the same aspect-ratio it would have if closest-side were specified.
                    if (gradient.shape === 0 /* CIRCLE */) {
                        rx = ry = Math.min(distance(x, y), distance(x, y - height), distance(x - width, y), distance(x - width, y - height));
                    }
                    else if (gradient.shape === 1 /* ELLIPSE */) {
                        // Compute the ratio ry/rx (which is to be the same as for "closest-side")
                        var c = Math.min(Math.abs(y), Math.abs(y - height)) / Math.min(Math.abs(x), Math.abs(x - width));
                        var _a = findCorner(width, height, x, y, true), cx = _a[0], cy = _a[1];
                        rx = distance(cx - x, (cy - y) / c);
                        ry = c * rx;
                    }
                    break;
                case 1 /* FARTHEST_SIDE */:
                    // Same as closest-side, except the ending shape is sized based on the farthest side(s)
                    if (gradient.shape === 0 /* CIRCLE */) {
                        rx = ry = Math.max(Math.abs(x), Math.abs(x - width), Math.abs(y), Math.abs(y - height));
                    }
                    else if (gradient.shape === 1 /* ELLIPSE */) {
                        rx = Math.max(Math.abs(x), Math.abs(x - width));
                        ry = Math.max(Math.abs(y), Math.abs(y - height));
                    }
                    break;
                case 3 /* FARTHEST_CORNER */:
                    // Same as closest-corner, except the ending shape is sized based on the farthest corner.
                    // If the shape is an ellipse, the ending shape is given the same aspect ratio it would have if farthest-side were specified.
                    if (gradient.shape === 0 /* CIRCLE */) {
                        rx = ry = Math.max(distance(x, y), distance(x, y - height), distance(x - width, y), distance(x - width, y - height));
                    }
                    else if (gradient.shape === 1 /* ELLIPSE */) {
                        // Compute the ratio ry/rx (which is to be the same as for "farthest-side")
                        var c = Math.max(Math.abs(y), Math.abs(y - height)) / Math.max(Math.abs(x), Math.abs(x - width));
                        var _b = findCorner(width, height, x, y, false), cx = _b[0], cy = _b[1];
                        rx = distance(cx - x, (cy - y) / c);
                        ry = c * rx;
                    }
                    break;
            }
            if (Array.isArray(gradient.size)) {
                rx = getAbsoluteValue(gradient.size[0], width);
                ry = gradient.size.length === 2 ? getAbsoluteValue(gradient.size[1], height) : rx;
            }
            return [rx, ry];
        };

        var linearGradient = function (context, tokens) {
            var angle$1 = deg(180);
            var stops = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                if (i === 0) {
                    var firstToken = arg[0];
                    if (firstToken.type === 20 /* IDENT_TOKEN */ && firstToken.value === 'to') {
                        angle$1 = parseNamedSide(arg);
                        return;
                    }
                    else if (isAngle(firstToken)) {
                        angle$1 = angle.parse(context, firstToken);
                        return;
                    }
                }
                var colorStop = parseColorStop(context, arg);
                stops.push(colorStop);
            });
            return { angle: angle$1, stops: stops, type: 1 /* LINEAR_GRADIENT */ };
        };

        var prefixLinearGradient = function (context, tokens) {
            var angle$1 = deg(180);
            var stops = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                if (i === 0) {
                    var firstToken = arg[0];
                    if (firstToken.type === 20 /* IDENT_TOKEN */ &&
                        ['top', 'left', 'right', 'bottom'].indexOf(firstToken.value) !== -1) {
                        angle$1 = parseNamedSide(arg);
                        return;
                    }
                    else if (isAngle(firstToken)) {
                        angle$1 = (angle.parse(context, firstToken) + deg(270)) % deg(360);
                        return;
                    }
                }
                var colorStop = parseColorStop(context, arg);
                stops.push(colorStop);
            });
            return {
                angle: angle$1,
                stops: stops,
                type: 1 /* LINEAR_GRADIENT */
            };
        };

        var webkitGradient = function (context, tokens) {
            var angle = deg(180);
            var stops = [];
            var type = 1 /* LINEAR_GRADIENT */;
            var shape = 0 /* CIRCLE */;
            var size = 3 /* FARTHEST_CORNER */;
            var position = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                var firstToken = arg[0];
                if (i === 0) {
                    if (isIdentToken(firstToken) && firstToken.value === 'linear') {
                        type = 1 /* LINEAR_GRADIENT */;
                        return;
                    }
                    else if (isIdentToken(firstToken) && firstToken.value === 'radial') {
                        type = 2 /* RADIAL_GRADIENT */;
                        return;
                    }
                }
                if (firstToken.type === 18 /* FUNCTION */) {
                    if (firstToken.name === 'from') {
                        var color = color$1.parse(context, firstToken.values[0]);
                        stops.push({ stop: ZERO_LENGTH, color: color });
                    }
                    else if (firstToken.name === 'to') {
                        var color = color$1.parse(context, firstToken.values[0]);
                        stops.push({ stop: HUNDRED_PERCENT, color: color });
                    }
                    else if (firstToken.name === 'color-stop') {
                        var values = firstToken.values.filter(nonFunctionArgSeparator);
                        if (values.length === 2) {
                            var color = color$1.parse(context, values[1]);
                            var stop_1 = values[0];
                            if (isNumberToken(stop_1)) {
                                stops.push({
                                    stop: { type: 16 /* PERCENTAGE_TOKEN */, number: stop_1.number * 100, flags: stop_1.flags },
                                    color: color
                                });
                            }
                        }
                    }
                }
            });
            return type === 1 /* LINEAR_GRADIENT */
                ? {
                    angle: (angle + deg(180)) % deg(360),
                    stops: stops,
                    type: type
                }
                : { size: size, shape: shape, stops: stops, position: position, type: type };
        };

        var CLOSEST_SIDE = 'closest-side';
        var FARTHEST_SIDE = 'farthest-side';
        var CLOSEST_CORNER = 'closest-corner';
        var FARTHEST_CORNER = 'farthest-corner';
        var CIRCLE = 'circle';
        var ELLIPSE = 'ellipse';
        var COVER = 'cover';
        var CONTAIN = 'contain';
        var radialGradient = function (context, tokens) {
            var shape = 0 /* CIRCLE */;
            var size = 3 /* FARTHEST_CORNER */;
            var stops = [];
            var position = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                var isColorStop = true;
                if (i === 0) {
                    var isAtPosition_1 = false;
                    isColorStop = arg.reduce(function (acc, token) {
                        if (isAtPosition_1) {
                            if (isIdentToken(token)) {
                                switch (token.value) {
                                    case 'center':
                                        position.push(FIFTY_PERCENT);
                                        return acc;
                                    case 'top':
                                    case 'left':
                                        position.push(ZERO_LENGTH);
                                        return acc;
                                    case 'right':
                                    case 'bottom':
                                        position.push(HUNDRED_PERCENT);
                                        return acc;
                                }
                            }
                            else if (isLengthPercentage(token) || isLength(token)) {
                                position.push(token);
                            }
                        }
                        else if (isIdentToken(token)) {
                            switch (token.value) {
                                case CIRCLE:
                                    shape = 0 /* CIRCLE */;
                                    return false;
                                case ELLIPSE:
                                    shape = 1 /* ELLIPSE */;
                                    return false;
                                case 'at':
                                    isAtPosition_1 = true;
                                    return false;
                                case CLOSEST_SIDE:
                                    size = 0 /* CLOSEST_SIDE */;
                                    return false;
                                case COVER:
                                case FARTHEST_SIDE:
                                    size = 1 /* FARTHEST_SIDE */;
                                    return false;
                                case CONTAIN:
                                case CLOSEST_CORNER:
                                    size = 2 /* CLOSEST_CORNER */;
                                    return false;
                                case FARTHEST_CORNER:
                                    size = 3 /* FARTHEST_CORNER */;
                                    return false;
                            }
                        }
                        else if (isLength(token) || isLengthPercentage(token)) {
                            if (!Array.isArray(size)) {
                                size = [];
                            }
                            size.push(token);
                            return false;
                        }
                        return acc;
                    }, isColorStop);
                }
                if (isColorStop) {
                    var colorStop = parseColorStop(context, arg);
                    stops.push(colorStop);
                }
            });
            return { size: size, shape: shape, stops: stops, position: position, type: 2 /* RADIAL_GRADIENT */ };
        };

        var prefixRadialGradient = function (context, tokens) {
            var shape = 0 /* CIRCLE */;
            var size = 3 /* FARTHEST_CORNER */;
            var stops = [];
            var position = [];
            parseFunctionArgs(tokens).forEach(function (arg, i) {
                var isColorStop = true;
                if (i === 0) {
                    isColorStop = arg.reduce(function (acc, token) {
                        if (isIdentToken(token)) {
                            switch (token.value) {
                                case 'center':
                                    position.push(FIFTY_PERCENT);
                                    return false;
                                case 'top':
                                case 'left':
                                    position.push(ZERO_LENGTH);
                                    return false;
                                case 'right':
                                case 'bottom':
                                    position.push(HUNDRED_PERCENT);
                                    return false;
                            }
                        }
                        else if (isLengthPercentage(token) || isLength(token)) {
                            position.push(token);
                            return false;
                        }
                        return acc;
                    }, isColorStop);
                }
                else if (i === 1) {
                    isColorStop = arg.reduce(function (acc, token) {
                        if (isIdentToken(token)) {
                            switch (token.value) {
                                case CIRCLE:
                                    shape = 0 /* CIRCLE */;
                                    return false;
                                case ELLIPSE:
                                    shape = 1 /* ELLIPSE */;
                                    return false;
                                case CONTAIN:
                                case CLOSEST_SIDE:
                                    size = 0 /* CLOSEST_SIDE */;
                                    return false;
                                case FARTHEST_SIDE:
                                    size = 1 /* FARTHEST_SIDE */;
                                    return false;
                                case CLOSEST_CORNER:
                                    size = 2 /* CLOSEST_CORNER */;
                                    return false;
                                case COVER:
                                case FARTHEST_CORNER:
                                    size = 3 /* FARTHEST_CORNER */;
                                    return false;
                            }
                        }
                        else if (isLength(token) || isLengthPercentage(token)) {
                            if (!Array.isArray(size)) {
                                size = [];
                            }
                            size.push(token);
                            return false;
                        }
                        return acc;
                    }, isColorStop);
                }
                if (isColorStop) {
                    var colorStop = parseColorStop(context, arg);
                    stops.push(colorStop);
                }
            });
            return { size: size, shape: shape, stops: stops, position: position, type: 2 /* RADIAL_GRADIENT */ };
        };

        var isLinearGradient = function (background) {
            return background.type === 1 /* LINEAR_GRADIENT */;
        };
        var isRadialGradient = function (background) {
            return background.type === 2 /* RADIAL_GRADIENT */;
        };
        var image = {
            name: 'image',
            parse: function (context, value) {
                if (value.type === 22 /* URL_TOKEN */) {
                    var image_1 = { url: value.value, type: 0 /* URL */ };
                    context.cache.addImage(value.value);
                    return image_1;
                }
                if (value.type === 18 /* FUNCTION */) {
                    var imageFunction = SUPPORTED_IMAGE_FUNCTIONS[value.name];
                    if (typeof imageFunction === 'undefined') {
                        throw new Error("Attempting to parse an unsupported image function \"" + value.name + "\"");
                    }
                    return imageFunction(context, value.values);
                }
                throw new Error("Unsupported image type " + value.type);
            }
        };
        function isSupportedImage(value) {
            return (!(value.type === 20 /* IDENT_TOKEN */ && value.value === 'none') &&
                (value.type !== 18 /* FUNCTION */ || !!SUPPORTED_IMAGE_FUNCTIONS[value.name]));
        }
        var SUPPORTED_IMAGE_FUNCTIONS = {
            'linear-gradient': linearGradient,
            '-moz-linear-gradient': prefixLinearGradient,
            '-ms-linear-gradient': prefixLinearGradient,
            '-o-linear-gradient': prefixLinearGradient,
            '-webkit-linear-gradient': prefixLinearGradient,
            'radial-gradient': radialGradient,
            '-moz-radial-gradient': prefixRadialGradient,
            '-ms-radial-gradient': prefixRadialGradient,
            '-o-radial-gradient': prefixRadialGradient,
            '-webkit-radial-gradient': prefixRadialGradient,
            '-webkit-gradient': webkitGradient
        };

        var backgroundImage = {
            name: 'background-image',
            initialValue: 'none',
            type: 1 /* LIST */,
            prefix: false,
            parse: function (context, tokens) {
                if (tokens.length === 0) {
                    return [];
                }
                var first = tokens[0];
                if (first.type === 20 /* IDENT_TOKEN */ && first.value === 'none') {
                    return [];
                }
                return tokens
                    .filter(function (value) { return nonFunctionArgSeparator(value) && isSupportedImage(value); })
                    .map(function (value) { return image.parse(context, value); });
            }
        };

        var backgroundOrigin = {
            name: 'background-origin',
            initialValue: 'border-box',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return tokens.map(function (token) {
                    if (isIdentToken(token)) {
                        switch (token.value) {
                            case 'padding-box':
                                return 1 /* PADDING_BOX */;
                            case 'content-box':
                                return 2 /* CONTENT_BOX */;
                        }
                    }
                    return 0 /* BORDER_BOX */;
                });
            }
        };

        var backgroundPosition = {
            name: 'background-position',
            initialValue: '0% 0%',
            type: 1 /* LIST */,
            prefix: false,
            parse: function (_context, tokens) {
                return parseFunctionArgs(tokens)
                    .map(function (values) { return values.filter(isLengthPercentage); })
                    .map(parseLengthPercentageTuple);
            }
        };

        var backgroundRepeat = {
            name: 'background-repeat',
            initialValue: 'repeat',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return parseFunctionArgs(tokens)
                    .map(function (values) {
                    return values
                        .filter(isIdentToken)
                        .map(function (token) { return token.value; })
                        .join(' ');
                })
                    .map(parseBackgroundRepeat);
            }
        };
        var parseBackgroundRepeat = function (value) {
            switch (value) {
                case 'no-repeat':
                    return 1 /* NO_REPEAT */;
                case 'repeat-x':
                case 'repeat no-repeat':
                    return 2 /* REPEAT_X */;
                case 'repeat-y':
                case 'no-repeat repeat':
                    return 3 /* REPEAT_Y */;
                case 'repeat':
                default:
                    return 0 /* REPEAT */;
            }
        };

        var BACKGROUND_SIZE;
        (function (BACKGROUND_SIZE) {
            BACKGROUND_SIZE["AUTO"] = "auto";
            BACKGROUND_SIZE["CONTAIN"] = "contain";
            BACKGROUND_SIZE["COVER"] = "cover";
        })(BACKGROUND_SIZE || (BACKGROUND_SIZE = {}));
        var backgroundSize = {
            name: 'background-size',
            initialValue: '0',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return parseFunctionArgs(tokens).map(function (values) { return values.filter(isBackgroundSizeInfoToken); });
            }
        };
        var isBackgroundSizeInfoToken = function (value) {
            return isIdentToken(value) || isLengthPercentage(value);
        };

        var borderColorForSide = function (side) { return ({
            name: "border-" + side + "-color",
            initialValue: 'transparent',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'color'
        }); };
        var borderTopColor = borderColorForSide('top');
        var borderRightColor = borderColorForSide('right');
        var borderBottomColor = borderColorForSide('bottom');
        var borderLeftColor = borderColorForSide('left');

        var borderRadiusForSide = function (side) { return ({
            name: "border-radius-" + side,
            initialValue: '0 0',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return parseLengthPercentageTuple(tokens.filter(isLengthPercentage));
            }
        }); };
        var borderTopLeftRadius = borderRadiusForSide('top-left');
        var borderTopRightRadius = borderRadiusForSide('top-right');
        var borderBottomRightRadius = borderRadiusForSide('bottom-right');
        var borderBottomLeftRadius = borderRadiusForSide('bottom-left');

        var borderStyleForSide = function (side) { return ({
            name: "border-" + side + "-style",
            initialValue: 'solid',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, style) {
                switch (style) {
                    case 'none':
                        return 0 /* NONE */;
                    case 'dashed':
                        return 2 /* DASHED */;
                    case 'dotted':
                        return 3 /* DOTTED */;
                    case 'double':
                        return 4 /* DOUBLE */;
                }
                return 1 /* SOLID */;
            }
        }); };
        var borderTopStyle = borderStyleForSide('top');
        var borderRightStyle = borderStyleForSide('right');
        var borderBottomStyle = borderStyleForSide('bottom');
        var borderLeftStyle = borderStyleForSide('left');

        var borderWidthForSide = function (side) { return ({
            name: "border-" + side + "-width",
            initialValue: '0',
            type: 0 /* VALUE */,
            prefix: false,
            parse: function (_context, token) {
                if (isDimensionToken(token)) {
                    return token.number;
                }
                return 0;
            }
        }); };
        var borderTopWidth = borderWidthForSide('top');
        var borderRightWidth = borderWidthForSide('right');
        var borderBottomWidth = borderWidthForSide('bottom');
        var borderLeftWidth = borderWidthForSide('left');

        var color = {
            name: "color",
            initialValue: 'transparent',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'color'
        };

        var direction = {
            name: 'direction',
            initialValue: 'ltr',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, direction) {
                switch (direction) {
                    case 'rtl':
                        return 1 /* RTL */;
                    case 'ltr':
                    default:
                        return 0 /* LTR */;
                }
            }
        };

        var display = {
            name: 'display',
            initialValue: 'inline-block',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return tokens.filter(isIdentToken).reduce(function (bit, token) {
                    return bit | parseDisplayValue(token.value);
                }, 0 /* NONE */);
            }
        };
        var parseDisplayValue = function (display) {
            switch (display) {
                case 'block':
                case '-webkit-box':
                    return 2 /* BLOCK */;
                case 'inline':
                    return 4 /* INLINE */;
                case 'run-in':
                    return 8 /* RUN_IN */;
                case 'flow':
                    return 16 /* FLOW */;
                case 'flow-root':
                    return 32 /* FLOW_ROOT */;
                case 'table':
                    return 64 /* TABLE */;
                case 'flex':
                case '-webkit-flex':
                    return 128 /* FLEX */;
                case 'grid':
                case '-ms-grid':
                    return 256 /* GRID */;
                case 'ruby':
                    return 512 /* RUBY */;
                case 'subgrid':
                    return 1024 /* SUBGRID */;
                case 'list-item':
                    return 2048 /* LIST_ITEM */;
                case 'table-row-group':
                    return 4096 /* TABLE_ROW_GROUP */;
                case 'table-header-group':
                    return 8192 /* TABLE_HEADER_GROUP */;
                case 'table-footer-group':
                    return 16384 /* TABLE_FOOTER_GROUP */;
                case 'table-row':
                    return 32768 /* TABLE_ROW */;
                case 'table-cell':
                    return 65536 /* TABLE_CELL */;
                case 'table-column-group':
                    return 131072 /* TABLE_COLUMN_GROUP */;
                case 'table-column':
                    return 262144 /* TABLE_COLUMN */;
                case 'table-caption':
                    return 524288 /* TABLE_CAPTION */;
                case 'ruby-base':
                    return 1048576 /* RUBY_BASE */;
                case 'ruby-text':
                    return 2097152 /* RUBY_TEXT */;
                case 'ruby-base-container':
                    return 4194304 /* RUBY_BASE_CONTAINER */;
                case 'ruby-text-container':
                    return 8388608 /* RUBY_TEXT_CONTAINER */;
                case 'contents':
                    return 16777216 /* CONTENTS */;
                case 'inline-block':
                    return 33554432 /* INLINE_BLOCK */;
                case 'inline-list-item':
                    return 67108864 /* INLINE_LIST_ITEM */;
                case 'inline-table':
                    return 134217728 /* INLINE_TABLE */;
                case 'inline-flex':
                    return 268435456 /* INLINE_FLEX */;
                case 'inline-grid':
                    return 536870912 /* INLINE_GRID */;
            }
            return 0 /* NONE */;
        };

        var float = {
            name: 'float',
            initialValue: 'none',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, float) {
                switch (float) {
                    case 'left':
                        return 1 /* LEFT */;
                    case 'right':
                        return 2 /* RIGHT */;
                    case 'inline-start':
                        return 3 /* INLINE_START */;
                    case 'inline-end':
                        return 4 /* INLINE_END */;
                }
                return 0 /* NONE */;
            }
        };

        var letterSpacing = {
            name: 'letter-spacing',
            initialValue: '0',
            prefix: false,
            type: 0 /* VALUE */,
            parse: function (_context, token) {
                if (token.type === 20 /* IDENT_TOKEN */ && token.value === 'normal') {
                    return 0;
                }
                if (token.type === 17 /* NUMBER_TOKEN */) {
                    return token.number;
                }
                if (token.type === 15 /* DIMENSION_TOKEN */) {
                    return token.number;
                }
                return 0;
            }
        };

        var LINE_BREAK;
        (function (LINE_BREAK) {
            LINE_BREAK["NORMAL"] = "normal";
            LINE_BREAK["STRICT"] = "strict";
        })(LINE_BREAK || (LINE_BREAK = {}));
        var lineBreak = {
            name: 'line-break',
            initialValue: 'normal',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, lineBreak) {
                switch (lineBreak) {
                    case 'strict':
                        return LINE_BREAK.STRICT;
                    case 'normal':
                    default:
                        return LINE_BREAK.NORMAL;
                }
            }
        };

        var lineHeight = {
            name: 'line-height',
            initialValue: 'normal',
            prefix: false,
            type: 4 /* TOKEN_VALUE */
        };
        var computeLineHeight = function (token, fontSize) {
            if (isIdentToken(token) && token.value === 'normal') {
                return 1.2 * fontSize;
            }
            else if (token.type === 17 /* NUMBER_TOKEN */) {
                return fontSize * token.number;
            }
            else if (isLengthPercentage(token)) {
                return getAbsoluteValue(token, fontSize);
            }
            return fontSize;
        };

        var listStyleImage = {
            name: 'list-style-image',
            initialValue: 'none',
            type: 0 /* VALUE */,
            prefix: false,
            parse: function (context, token) {
                if (token.type === 20 /* IDENT_TOKEN */ && token.value === 'none') {
                    return null;
                }
                return image.parse(context, token);
            }
        };

        var listStylePosition = {
            name: 'list-style-position',
            initialValue: 'outside',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, position) {
                switch (position) {
                    case 'inside':
                        return 0 /* INSIDE */;
                    case 'outside':
                    default:
                        return 1 /* OUTSIDE */;
                }
            }
        };

        var listStyleType = {
            name: 'list-style-type',
            initialValue: 'none',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, type) {
                switch (type) {
                    case 'disc':
                        return 0 /* DISC */;
                    case 'circle':
                        return 1 /* CIRCLE */;
                    case 'square':
                        return 2 /* SQUARE */;
                    case 'decimal':
                        return 3 /* DECIMAL */;
                    case 'cjk-decimal':
                        return 4 /* CJK_DECIMAL */;
                    case 'decimal-leading-zero':
                        return 5 /* DECIMAL_LEADING_ZERO */;
                    case 'lower-roman':
                        return 6 /* LOWER_ROMAN */;
                    case 'upper-roman':
                        return 7 /* UPPER_ROMAN */;
                    case 'lower-greek':
                        return 8 /* LOWER_GREEK */;
                    case 'lower-alpha':
                        return 9 /* LOWER_ALPHA */;
                    case 'upper-alpha':
                        return 10 /* UPPER_ALPHA */;
                    case 'arabic-indic':
                        return 11 /* ARABIC_INDIC */;
                    case 'armenian':
                        return 12 /* ARMENIAN */;
                    case 'bengali':
                        return 13 /* BENGALI */;
                    case 'cambodian':
                        return 14 /* CAMBODIAN */;
                    case 'cjk-earthly-branch':
                        return 15 /* CJK_EARTHLY_BRANCH */;
                    case 'cjk-heavenly-stem':
                        return 16 /* CJK_HEAVENLY_STEM */;
                    case 'cjk-ideographic':
                        return 17 /* CJK_IDEOGRAPHIC */;
                    case 'devanagari':
                        return 18 /* DEVANAGARI */;
                    case 'ethiopic-numeric':
                        return 19 /* ETHIOPIC_NUMERIC */;
                    case 'georgian':
                        return 20 /* GEORGIAN */;
                    case 'gujarati':
                        return 21 /* GUJARATI */;
                    case 'gurmukhi':
                        return 22 /* GURMUKHI */;
                    case 'hebrew':
                        return 22 /* HEBREW */;
                    case 'hiragana':
                        return 23 /* HIRAGANA */;
                    case 'hiragana-iroha':
                        return 24 /* HIRAGANA_IROHA */;
                    case 'japanese-formal':
                        return 25 /* JAPANESE_FORMAL */;
                    case 'japanese-informal':
                        return 26 /* JAPANESE_INFORMAL */;
                    case 'kannada':
                        return 27 /* KANNADA */;
                    case 'katakana':
                        return 28 /* KATAKANA */;
                    case 'katakana-iroha':
                        return 29 /* KATAKANA_IROHA */;
                    case 'khmer':
                        return 30 /* KHMER */;
                    case 'korean-hangul-formal':
                        return 31 /* KOREAN_HANGUL_FORMAL */;
                    case 'korean-hanja-formal':
                        return 32 /* KOREAN_HANJA_FORMAL */;
                    case 'korean-hanja-informal':
                        return 33 /* KOREAN_HANJA_INFORMAL */;
                    case 'lao':
                        return 34 /* LAO */;
                    case 'lower-armenian':
                        return 35 /* LOWER_ARMENIAN */;
                    case 'malayalam':
                        return 36 /* MALAYALAM */;
                    case 'mongolian':
                        return 37 /* MONGOLIAN */;
                    case 'myanmar':
                        return 38 /* MYANMAR */;
                    case 'oriya':
                        return 39 /* ORIYA */;
                    case 'persian':
                        return 40 /* PERSIAN */;
                    case 'simp-chinese-formal':
                        return 41 /* SIMP_CHINESE_FORMAL */;
                    case 'simp-chinese-informal':
                        return 42 /* SIMP_CHINESE_INFORMAL */;
                    case 'tamil':
                        return 43 /* TAMIL */;
                    case 'telugu':
                        return 44 /* TELUGU */;
                    case 'thai':
                        return 45 /* THAI */;
                    case 'tibetan':
                        return 46 /* TIBETAN */;
                    case 'trad-chinese-formal':
                        return 47 /* TRAD_CHINESE_FORMAL */;
                    case 'trad-chinese-informal':
                        return 48 /* TRAD_CHINESE_INFORMAL */;
                    case 'upper-armenian':
                        return 49 /* UPPER_ARMENIAN */;
                    case 'disclosure-open':
                        return 50 /* DISCLOSURE_OPEN */;
                    case 'disclosure-closed':
                        return 51 /* DISCLOSURE_CLOSED */;
                    case 'none':
                    default:
                        return -1 /* NONE */;
                }
            }
        };

        var marginForSide = function (side) { return ({
            name: "margin-" + side,
            initialValue: '0',
            prefix: false,
            type: 4 /* TOKEN_VALUE */
        }); };
        var marginTop = marginForSide('top');
        var marginRight = marginForSide('right');
        var marginBottom = marginForSide('bottom');
        var marginLeft = marginForSide('left');

        var overflow = {
            name: 'overflow',
            initialValue: 'visible',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return tokens.filter(isIdentToken).map(function (overflow) {
                    switch (overflow.value) {
                        case 'hidden':
                            return 1 /* HIDDEN */;
                        case 'scroll':
                            return 2 /* SCROLL */;
                        case 'clip':
                            return 3 /* CLIP */;
                        case 'auto':
                            return 4 /* AUTO */;
                        case 'visible':
                        default:
                            return 0 /* VISIBLE */;
                    }
                });
            }
        };

        var overflowWrap = {
            name: 'overflow-wrap',
            initialValue: 'normal',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, overflow) {
                switch (overflow) {
                    case 'break-word':
                        return "break-word" /* BREAK_WORD */;
                    case 'normal':
                    default:
                        return "normal" /* NORMAL */;
                }
            }
        };

        var paddingForSide = function (side) { return ({
            name: "padding-" + side,
            initialValue: '0',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'length-percentage'
        }); };
        var paddingTop = paddingForSide('top');
        var paddingRight = paddingForSide('right');
        var paddingBottom = paddingForSide('bottom');
        var paddingLeft = paddingForSide('left');

        var textAlign = {
            name: 'text-align',
            initialValue: 'left',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, textAlign) {
                switch (textAlign) {
                    case 'right':
                        return 2 /* RIGHT */;
                    case 'center':
                    case 'justify':
                        return 1 /* CENTER */;
                    case 'left':
                    default:
                        return 0 /* LEFT */;
                }
            }
        };

        var position = {
            name: 'position',
            initialValue: 'static',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, position) {
                switch (position) {
                    case 'relative':
                        return 1 /* RELATIVE */;
                    case 'absolute':
                        return 2 /* ABSOLUTE */;
                    case 'fixed':
                        return 3 /* FIXED */;
                    case 'sticky':
                        return 4 /* STICKY */;
                }
                return 0 /* STATIC */;
            }
        };

        var textShadow = {
            name: 'text-shadow',
            initialValue: 'none',
            type: 1 /* LIST */,
            prefix: false,
            parse: function (context, tokens) {
                if (tokens.length === 1 && isIdentWithValue(tokens[0], 'none')) {
                    return [];
                }
                return parseFunctionArgs(tokens).map(function (values) {
                    var shadow = {
                        color: COLORS.TRANSPARENT,
                        offsetX: ZERO_LENGTH,
                        offsetY: ZERO_LENGTH,
                        blur: ZERO_LENGTH
                    };
                    var c = 0;
                    for (var i = 0; i < values.length; i++) {
                        var token = values[i];
                        if (isLength(token)) {
                            if (c === 0) {
                                shadow.offsetX = token;
                            }
                            else if (c === 1) {
                                shadow.offsetY = token;
                            }
                            else {
                                shadow.blur = token;
                            }
                            c++;
                        }
                        else {
                            shadow.color = color$1.parse(context, token);
                        }
                    }
                    return shadow;
                });
            }
        };

        var textTransform = {
            name: 'text-transform',
            initialValue: 'none',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, textTransform) {
                switch (textTransform) {
                    case 'uppercase':
                        return 2 /* UPPERCASE */;
                    case 'lowercase':
                        return 1 /* LOWERCASE */;
                    case 'capitalize':
                        return 3 /* CAPITALIZE */;
                }
                return 0 /* NONE */;
            }
        };

        var transform$1 = {
            name: 'transform',
            initialValue: 'none',
            prefix: true,
            type: 0 /* VALUE */,
            parse: function (_context, token) {
                if (token.type === 20 /* IDENT_TOKEN */ && token.value === 'none') {
                    return null;
                }
                if (token.type === 18 /* FUNCTION */) {
                    var transformFunction = SUPPORTED_TRANSFORM_FUNCTIONS[token.name];
                    if (typeof transformFunction === 'undefined') {
                        throw new Error("Attempting to parse an unsupported transform function \"" + token.name + "\"");
                    }
                    return transformFunction(token.values);
                }
                return null;
            }
        };
        var matrix = function (args) {
            var values = args.filter(function (arg) { return arg.type === 17 /* NUMBER_TOKEN */; }).map(function (arg) { return arg.number; });
            return values.length === 6 ? values : null;
        };
        // doesn't support 3D transforms at the moment
        var matrix3d = function (args) {
            var values = args.filter(function (arg) { return arg.type === 17 /* NUMBER_TOKEN */; }).map(function (arg) { return arg.number; });
            var a1 = values[0], b1 = values[1]; values[2]; values[3]; var a2 = values[4], b2 = values[5]; values[6]; values[7]; values[8]; values[9]; values[10]; values[11]; var a4 = values[12], b4 = values[13]; values[14]; values[15];
            return values.length === 16 ? [a1, b1, a2, b2, a4, b4] : null;
        };
        var SUPPORTED_TRANSFORM_FUNCTIONS = {
            matrix: matrix,
            matrix3d: matrix3d
        };

        var DEFAULT_VALUE = {
            type: 16 /* PERCENTAGE_TOKEN */,
            number: 50,
            flags: FLAG_INTEGER
        };
        var DEFAULT = [DEFAULT_VALUE, DEFAULT_VALUE];
        var transformOrigin = {
            name: 'transform-origin',
            initialValue: '50% 50%',
            prefix: true,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                var origins = tokens.filter(isLengthPercentage);
                if (origins.length !== 2) {
                    return DEFAULT;
                }
                return [origins[0], origins[1]];
            }
        };

        var visibility = {
            name: 'visible',
            initialValue: 'none',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, visibility) {
                switch (visibility) {
                    case 'hidden':
                        return 1 /* HIDDEN */;
                    case 'collapse':
                        return 2 /* COLLAPSE */;
                    case 'visible':
                    default:
                        return 0 /* VISIBLE */;
                }
            }
        };

        var WORD_BREAK;
        (function (WORD_BREAK) {
            WORD_BREAK["NORMAL"] = "normal";
            WORD_BREAK["BREAK_ALL"] = "break-all";
            WORD_BREAK["KEEP_ALL"] = "keep-all";
        })(WORD_BREAK || (WORD_BREAK = {}));
        var wordBreak = {
            name: 'word-break',
            initialValue: 'normal',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, wordBreak) {
                switch (wordBreak) {
                    case 'break-all':
                        return WORD_BREAK.BREAK_ALL;
                    case 'keep-all':
                        return WORD_BREAK.KEEP_ALL;
                    case 'normal':
                    default:
                        return WORD_BREAK.NORMAL;
                }
            }
        };

        var zIndex = {
            name: 'z-index',
            initialValue: 'auto',
            prefix: false,
            type: 0 /* VALUE */,
            parse: function (_context, token) {
                if (token.type === 20 /* IDENT_TOKEN */) {
                    return { auto: true, order: 0 };
                }
                if (isNumberToken(token)) {
                    return { auto: false, order: token.number };
                }
                throw new Error("Invalid z-index number parsed");
            }
        };

        var time = {
            name: 'time',
            parse: function (_context, value) {
                if (value.type === 15 /* DIMENSION_TOKEN */) {
                    switch (value.unit.toLowerCase()) {
                        case 's':
                            return 1000 * value.number;
                        case 'ms':
                            return value.number;
                    }
                }
                throw new Error("Unsupported time type");
            }
        };

        var opacity = {
            name: 'opacity',
            initialValue: '1',
            type: 0 /* VALUE */,
            prefix: false,
            parse: function (_context, token) {
                if (isNumberToken(token)) {
                    return token.number;
                }
                return 1;
            }
        };

        var textDecorationColor = {
            name: "text-decoration-color",
            initialValue: 'transparent',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'color'
        };

        var textDecorationLine = {
            name: 'text-decoration-line',
            initialValue: 'none',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                return tokens
                    .filter(isIdentToken)
                    .map(function (token) {
                    switch (token.value) {
                        case 'underline':
                            return 1 /* UNDERLINE */;
                        case 'overline':
                            return 2 /* OVERLINE */;
                        case 'line-through':
                            return 3 /* LINE_THROUGH */;
                        case 'none':
                            return 4 /* BLINK */;
                    }
                    return 0 /* NONE */;
                })
                    .filter(function (line) { return line !== 0 /* NONE */; });
            }
        };

        var fontFamily = {
            name: "font-family",
            initialValue: '',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                var accumulator = [];
                var results = [];
                tokens.forEach(function (token) {
                    switch (token.type) {
                        case 20 /* IDENT_TOKEN */:
                        case 0 /* STRING_TOKEN */:
                            accumulator.push(token.value);
                            break;
                        case 17 /* NUMBER_TOKEN */:
                            accumulator.push(token.number.toString());
                            break;
                        case 4 /* COMMA_TOKEN */:
                            results.push(accumulator.join(' '));
                            accumulator.length = 0;
                            break;
                    }
                });
                if (accumulator.length) {
                    results.push(accumulator.join(' '));
                }
                return results.map(function (result) { return (result.indexOf(' ') === -1 ? result : "'" + result + "'"); });
            }
        };

        var fontSize = {
            name: "font-size",
            initialValue: '0',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'length'
        };

        var fontWeight = {
            name: 'font-weight',
            initialValue: 'normal',
            type: 0 /* VALUE */,
            prefix: false,
            parse: function (_context, token) {
                if (isNumberToken(token)) {
                    return token.number;
                }
                if (isIdentToken(token)) {
                    switch (token.value) {
                        case 'bold':
                            return 700;
                        case 'normal':
                        default:
                            return 400;
                    }
                }
                return 400;
            }
        };

        var fontVariant = {
            name: 'font-variant',
            initialValue: 'none',
            type: 1 /* LIST */,
            prefix: false,
            parse: function (_context, tokens) {
                return tokens.filter(isIdentToken).map(function (token) { return token.value; });
            }
        };

        var fontStyle = {
            name: 'font-style',
            initialValue: 'normal',
            prefix: false,
            type: 2 /* IDENT_VALUE */,
            parse: function (_context, overflow) {
                switch (overflow) {
                    case 'oblique':
                        return "oblique" /* OBLIQUE */;
                    case 'italic':
                        return "italic" /* ITALIC */;
                    case 'normal':
                    default:
                        return "normal" /* NORMAL */;
                }
            }
        };

        var contains = function (bit, value) { return (bit & value) !== 0; };

        var content = {
            name: 'content',
            initialValue: 'none',
            type: 1 /* LIST */,
            prefix: false,
            parse: function (_context, tokens) {
                if (tokens.length === 0) {
                    return [];
                }
                var first = tokens[0];
                if (first.type === 20 /* IDENT_TOKEN */ && first.value === 'none') {
                    return [];
                }
                return tokens;
            }
        };

        var counterIncrement = {
            name: 'counter-increment',
            initialValue: 'none',
            prefix: true,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                if (tokens.length === 0) {
                    return null;
                }
                var first = tokens[0];
                if (first.type === 20 /* IDENT_TOKEN */ && first.value === 'none') {
                    return null;
                }
                var increments = [];
                var filtered = tokens.filter(nonWhiteSpace);
                for (var i = 0; i < filtered.length; i++) {
                    var counter = filtered[i];
                    var next = filtered[i + 1];
                    if (counter.type === 20 /* IDENT_TOKEN */) {
                        var increment = next && isNumberToken(next) ? next.number : 1;
                        increments.push({ counter: counter.value, increment: increment });
                    }
                }
                return increments;
            }
        };

        var counterReset = {
            name: 'counter-reset',
            initialValue: 'none',
            prefix: true,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                if (tokens.length === 0) {
                    return [];
                }
                var resets = [];
                var filtered = tokens.filter(nonWhiteSpace);
                for (var i = 0; i < filtered.length; i++) {
                    var counter = filtered[i];
                    var next = filtered[i + 1];
                    if (isIdentToken(counter) && counter.value !== 'none') {
                        var reset = next && isNumberToken(next) ? next.number : 0;
                        resets.push({ counter: counter.value, reset: reset });
                    }
                }
                return resets;
            }
        };

        var duration = {
            name: 'duration',
            initialValue: '0s',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (context, tokens) {
                return tokens.filter(isDimensionToken).map(function (token) { return time.parse(context, token); });
            }
        };

        var quotes = {
            name: 'quotes',
            initialValue: 'none',
            prefix: true,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                if (tokens.length === 0) {
                    return null;
                }
                var first = tokens[0];
                if (first.type === 20 /* IDENT_TOKEN */ && first.value === 'none') {
                    return null;
                }
                var quotes = [];
                var filtered = tokens.filter(isStringToken);
                if (filtered.length % 2 !== 0) {
                    return null;
                }
                for (var i = 0; i < filtered.length; i += 2) {
                    var open_1 = filtered[i].value;
                    var close_1 = filtered[i + 1].value;
                    quotes.push({ open: open_1, close: close_1 });
                }
                return quotes;
            }
        };
        var getQuote = function (quotes, depth, open) {
            if (!quotes) {
                return '';
            }
            var quote = quotes[Math.min(depth, quotes.length - 1)];
            if (!quote) {
                return '';
            }
            return open ? quote.open : quote.close;
        };

        var boxShadow = {
            name: 'box-shadow',
            initialValue: 'none',
            type: 1 /* LIST */,
            prefix: false,
            parse: function (context, tokens) {
                if (tokens.length === 1 && isIdentWithValue(tokens[0], 'none')) {
                    return [];
                }
                return parseFunctionArgs(tokens).map(function (values) {
                    var shadow = {
                        color: 0x000000ff,
                        offsetX: ZERO_LENGTH,
                        offsetY: ZERO_LENGTH,
                        blur: ZERO_LENGTH,
                        spread: ZERO_LENGTH,
                        inset: false
                    };
                    var c = 0;
                    for (var i = 0; i < values.length; i++) {
                        var token = values[i];
                        if (isIdentWithValue(token, 'inset')) {
                            shadow.inset = true;
                        }
                        else if (isLength(token)) {
                            if (c === 0) {
                                shadow.offsetX = token;
                            }
                            else if (c === 1) {
                                shadow.offsetY = token;
                            }
                            else if (c === 2) {
                                shadow.blur = token;
                            }
                            else {
                                shadow.spread = token;
                            }
                            c++;
                        }
                        else {
                            shadow.color = color$1.parse(context, token);
                        }
                    }
                    return shadow;
                });
            }
        };

        var paintOrder = {
            name: 'paint-order',
            initialValue: 'normal',
            prefix: false,
            type: 1 /* LIST */,
            parse: function (_context, tokens) {
                var DEFAULT_VALUE = [0 /* FILL */, 1 /* STROKE */, 2 /* MARKERS */];
                var layers = [];
                tokens.filter(isIdentToken).forEach(function (token) {
                    switch (token.value) {
                        case 'stroke':
                            layers.push(1 /* STROKE */);
                            break;
                        case 'fill':
                            layers.push(0 /* FILL */);
                            break;
                        case 'markers':
                            layers.push(2 /* MARKERS */);
                            break;
                    }
                });
                DEFAULT_VALUE.forEach(function (value) {
                    if (layers.indexOf(value) === -1) {
                        layers.push(value);
                    }
                });
                return layers;
            }
        };

        var webkitTextStrokeColor = {
            name: "-webkit-text-stroke-color",
            initialValue: 'currentcolor',
            prefix: false,
            type: 3 /* TYPE_VALUE */,
            format: 'color'
        };

        var webkitTextStrokeWidth = {
            name: "-webkit-text-stroke-width",
            initialValue: '0',
            type: 0 /* VALUE */,
            prefix: false,
            parse: function (_context, token) {
                if (isDimensionToken(token)) {
                    return token.number;
                }
                return 0;
            }
        };

        var CSSParsedDeclaration = /** @class */ (function () {
            function CSSParsedDeclaration(context, declaration) {
                var _a, _b;
                this.animationDuration = parse(context, duration, declaration.animationDuration);
                this.backgroundClip = parse(context, backgroundClip, declaration.backgroundClip);
                this.backgroundColor = parse(context, backgroundColor, declaration.backgroundColor);
                this.backgroundImage = parse(context, backgroundImage, declaration.backgroundImage);
                this.backgroundOrigin = parse(context, backgroundOrigin, declaration.backgroundOrigin);
                this.backgroundPosition = parse(context, backgroundPosition, declaration.backgroundPosition);
                this.backgroundRepeat = parse(context, backgroundRepeat, declaration.backgroundRepeat);
                this.backgroundSize = parse(context, backgroundSize, declaration.backgroundSize);
                this.borderTopColor = parse(context, borderTopColor, declaration.borderTopColor);
                this.borderRightColor = parse(context, borderRightColor, declaration.borderRightColor);
                this.borderBottomColor = parse(context, borderBottomColor, declaration.borderBottomColor);
                this.borderLeftColor = parse(context, borderLeftColor, declaration.borderLeftColor);
                this.borderTopLeftRadius = parse(context, borderTopLeftRadius, declaration.borderTopLeftRadius);
                this.borderTopRightRadius = parse(context, borderTopRightRadius, declaration.borderTopRightRadius);
                this.borderBottomRightRadius = parse(context, borderBottomRightRadius, declaration.borderBottomRightRadius);
                this.borderBottomLeftRadius = parse(context, borderBottomLeftRadius, declaration.borderBottomLeftRadius);
                this.borderTopStyle = parse(context, borderTopStyle, declaration.borderTopStyle);
                this.borderRightStyle = parse(context, borderRightStyle, declaration.borderRightStyle);
                this.borderBottomStyle = parse(context, borderBottomStyle, declaration.borderBottomStyle);
                this.borderLeftStyle = parse(context, borderLeftStyle, declaration.borderLeftStyle);
                this.borderTopWidth = parse(context, borderTopWidth, declaration.borderTopWidth);
                this.borderRightWidth = parse(context, borderRightWidth, declaration.borderRightWidth);
                this.borderBottomWidth = parse(context, borderBottomWidth, declaration.borderBottomWidth);
                this.borderLeftWidth = parse(context, borderLeftWidth, declaration.borderLeftWidth);
                this.boxShadow = parse(context, boxShadow, declaration.boxShadow);
                this.color = parse(context, color, declaration.color);
                this.direction = parse(context, direction, declaration.direction);
                this.display = parse(context, display, declaration.display);
                this.float = parse(context, float, declaration.cssFloat);
                this.fontFamily = parse(context, fontFamily, declaration.fontFamily);
                this.fontSize = parse(context, fontSize, declaration.fontSize);
                this.fontStyle = parse(context, fontStyle, declaration.fontStyle);
                this.fontVariant = parse(context, fontVariant, declaration.fontVariant);
                this.fontWeight = parse(context, fontWeight, declaration.fontWeight);
                this.letterSpacing = parse(context, letterSpacing, declaration.letterSpacing);
                this.lineBreak = parse(context, lineBreak, declaration.lineBreak);
                this.lineHeight = parse(context, lineHeight, declaration.lineHeight);
                this.listStyleImage = parse(context, listStyleImage, declaration.listStyleImage);
                this.listStylePosition = parse(context, listStylePosition, declaration.listStylePosition);
                this.listStyleType = parse(context, listStyleType, declaration.listStyleType);
                this.marginTop = parse(context, marginTop, declaration.marginTop);
                this.marginRight = parse(context, marginRight, declaration.marginRight);
                this.marginBottom = parse(context, marginBottom, declaration.marginBottom);
                this.marginLeft = parse(context, marginLeft, declaration.marginLeft);
                this.opacity = parse(context, opacity, declaration.opacity);
                var overflowTuple = parse(context, overflow, declaration.overflow);
                this.overflowX = overflowTuple[0];
                this.overflowY = overflowTuple[overflowTuple.length > 1 ? 1 : 0];
                this.overflowWrap = parse(context, overflowWrap, declaration.overflowWrap);
                this.paddingTop = parse(context, paddingTop, declaration.paddingTop);
                this.paddingRight = parse(context, paddingRight, declaration.paddingRight);
                this.paddingBottom = parse(context, paddingBottom, declaration.paddingBottom);
                this.paddingLeft = parse(context, paddingLeft, declaration.paddingLeft);
                this.paintOrder = parse(context, paintOrder, declaration.paintOrder);
                this.position = parse(context, position, declaration.position);
                this.textAlign = parse(context, textAlign, declaration.textAlign);
                this.textDecorationColor = parse(context, textDecorationColor, (_a = declaration.textDecorationColor) !== null && _a !== void 0 ? _a : declaration.color);
                this.textDecorationLine = parse(context, textDecorationLine, (_b = declaration.textDecorationLine) !== null && _b !== void 0 ? _b : declaration.textDecoration);
                this.textShadow = parse(context, textShadow, declaration.textShadow);
                this.textTransform = parse(context, textTransform, declaration.textTransform);
                this.transform = parse(context, transform$1, declaration.transform);
                this.transformOrigin = parse(context, transformOrigin, declaration.transformOrigin);
                this.visibility = parse(context, visibility, declaration.visibility);
                this.webkitTextStrokeColor = parse(context, webkitTextStrokeColor, declaration.webkitTextStrokeColor);
                this.webkitTextStrokeWidth = parse(context, webkitTextStrokeWidth, declaration.webkitTextStrokeWidth);
                this.wordBreak = parse(context, wordBreak, declaration.wordBreak);
                this.zIndex = parse(context, zIndex, declaration.zIndex);
            }
            CSSParsedDeclaration.prototype.isVisible = function () {
                return this.display > 0 && this.opacity > 0 && this.visibility === 0 /* VISIBLE */;
            };
            CSSParsedDeclaration.prototype.isTransparent = function () {
                return isTransparent(this.backgroundColor);
            };
            CSSParsedDeclaration.prototype.isTransformed = function () {
                return this.transform !== null;
            };
            CSSParsedDeclaration.prototype.isPositioned = function () {
                return this.position !== 0 /* STATIC */;
            };
            CSSParsedDeclaration.prototype.isPositionedWithZIndex = function () {
                return this.isPositioned() && !this.zIndex.auto;
            };
            CSSParsedDeclaration.prototype.isFloating = function () {
                return this.float !== 0 /* NONE */;
            };
            CSSParsedDeclaration.prototype.isInlineLevel = function () {
                return (contains(this.display, 4 /* INLINE */) ||
                    contains(this.display, 33554432 /* INLINE_BLOCK */) ||
                    contains(this.display, 268435456 /* INLINE_FLEX */) ||
                    contains(this.display, 536870912 /* INLINE_GRID */) ||
                    contains(this.display, 67108864 /* INLINE_LIST_ITEM */) ||
                    contains(this.display, 134217728 /* INLINE_TABLE */));
            };
            return CSSParsedDeclaration;
        }());
        var CSSParsedPseudoDeclaration = /** @class */ (function () {
            function CSSParsedPseudoDeclaration(context, declaration) {
                this.content = parse(context, content, declaration.content);
                this.quotes = parse(context, quotes, declaration.quotes);
            }
            return CSSParsedPseudoDeclaration;
        }());
        var CSSParsedCounterDeclaration = /** @class */ (function () {
            function CSSParsedCounterDeclaration(context, declaration) {
                this.counterIncrement = parse(context, counterIncrement, declaration.counterIncrement);
                this.counterReset = parse(context, counterReset, declaration.counterReset);
            }
            return CSSParsedCounterDeclaration;
        }());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        var parse = function (context, descriptor, style) {
            var tokenizer = new Tokenizer();
            var value = style !== null && typeof style !== 'undefined' ? style.toString() : descriptor.initialValue;
            tokenizer.write(value);
            var parser = new Parser(tokenizer.read());
            switch (descriptor.type) {
                case 2 /* IDENT_VALUE */:
                    var token = parser.parseComponentValue();
                    return descriptor.parse(context, isIdentToken(token) ? token.value : descriptor.initialValue);
                case 0 /* VALUE */:
                    return descriptor.parse(context, parser.parseComponentValue());
                case 1 /* LIST */:
                    return descriptor.parse(context, parser.parseComponentValues());
                case 4 /* TOKEN_VALUE */:
                    return parser.parseComponentValue();
                case 3 /* TYPE_VALUE */:
                    switch (descriptor.format) {
                        case 'angle':
                            return angle.parse(context, parser.parseComponentValue());
                        case 'color':
                            return color$1.parse(context, parser.parseComponentValue());
                        case 'image':
                            return image.parse(context, parser.parseComponentValue());
                        case 'length':
                            var length_1 = parser.parseComponentValue();
                            return isLength(length_1) ? length_1 : ZERO_LENGTH;
                        case 'length-percentage':
                            var value_1 = parser.parseComponentValue();
                            return isLengthPercentage(value_1) ? value_1 : ZERO_LENGTH;
                        case 'time':
                            return time.parse(context, parser.parseComponentValue());
                    }
                    break;
            }
        };

        var elementDebuggerAttribute = 'data-html2canvas-debug';
        var getElementDebugType = function (element) {
            var attribute = element.getAttribute(elementDebuggerAttribute);
            switch (attribute) {
                case 'all':
                    return 1 /* ALL */;
                case 'clone':
                    return 2 /* CLONE */;
                case 'parse':
                    return 3 /* PARSE */;
                case 'render':
                    return 4 /* RENDER */;
                default:
                    return 0 /* NONE */;
            }
        };
        var isDebugging = function (element, type) {
            var elementType = getElementDebugType(element);
            return elementType === 1 /* ALL */ || type === elementType;
        };

        var ElementContainer = /** @class */ (function () {
            function ElementContainer(context, element) {
                this.context = context;
                this.textNodes = [];
                this.elements = [];
                this.flags = 0;
                if (isDebugging(element, 3 /* PARSE */)) {
                    debugger;
                }
                this.styles = new CSSParsedDeclaration(context, window.getComputedStyle(element, null));
                if (isHTMLElementNode(element)) {
                    if (this.styles.animationDuration.some(function (duration) { return duration > 0; })) {
                        element.style.animationDuration = '0s';
                    }
                    if (this.styles.transform !== null) {
                        // getBoundingClientRect takes transforms into account
                        element.style.transform = 'none';
                    }
                }
                this.bounds = parseBounds(this.context, element);
                if (isDebugging(element, 4 /* RENDER */)) {
                    this.flags |= 16 /* DEBUG_RENDER */;
                }
            }
            return ElementContainer;
        }());

        /*
         * text-segmentation 1.0.3 <https://github.com/niklasvh/text-segmentation>
         * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var base64 = 'AAAAAAAAAAAAEA4AGBkAAFAaAAACAAAAAAAIABAAGAAwADgACAAQAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAIABAAQABIAEQATAAIABAACAAQAAgAEAAIABAAVABcAAgAEAAIABAACAAQAGAAaABwAHgAgACIAI4AlgAIABAAmwCjAKgAsAC2AL4AvQDFAMoA0gBPAVYBWgEIAAgACACMANoAYgFkAWwBdAF8AX0BhQGNAZUBlgGeAaMBlQGWAasBswF8AbsBwwF0AcsBYwHTAQgA2wG/AOMBdAF8AekB8QF0AfkB+wHiAHQBfAEIAAMC5gQIAAsCEgIIAAgAFgIeAggAIgIpAggAMQI5AkACygEIAAgASAJQAlgCYAIIAAgACAAKBQoFCgUTBRMFGQUrBSsFCAAIAAgACAAIAAgACAAIAAgACABdAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACABoAmgCrwGvAQgAbgJ2AggAHgEIAAgACADnAXsCCAAIAAgAgwIIAAgACAAIAAgACACKAggAkQKZAggAPADJAAgAoQKkAqwCsgK6AsICCADJAggA0AIIAAgACAAIANYC3gIIAAgACAAIAAgACABAAOYCCAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAkASoB+QIEAAgACAA8AEMCCABCBQgACABJBVAFCAAIAAgACAAIAAgACAAIAAgACABTBVoFCAAIAFoFCABfBWUFCAAIAAgACAAIAAgAbQUIAAgACAAIAAgACABzBXsFfQWFBYoFigWKBZEFigWKBYoFmAWfBaYFrgWxBbkFCAAIAAgACAAIAAgACAAIAAgACAAIAMEFCAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAMgFCADQBQgACAAIAAgACAAIAAgACAAIAAgACAAIAO4CCAAIAAgAiQAIAAgACABAAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAD0AggACAD8AggACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIANYFCAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAMDvwAIAAgAJAIIAAgACAAIAAgACAAIAAgACwMTAwgACAB9BOsEGwMjAwgAKwMyAwsFYgE3A/MEPwMIAEUDTQNRAwgAWQOsAGEDCAAIAAgACAAIAAgACABpAzQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFOgU0BTUFNgU3BTgFOQU6BTQFNQU2BTcFOAU5BToFNAU1BTYFNwU4BTkFIQUoBSwFCAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACABtAwgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACABMAEwACAAIAAgACAAIABgACAAIAAgACAC/AAgACAAyAQgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACACAAIAAwAAgACAAIAAgACAAIAAgACAAIAAAARABIAAgACAAIABQASAAIAAgAIABwAEAAjgCIABsAqAC2AL0AigDQAtwC+IJIQqVAZUBWQqVAZUBlQGVAZUBlQGrC5UBlQGVAZUBlQGVAZUBlQGVAXsKlQGVAbAK6wsrDGUMpQzlDJUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAZUBlQGVAfAKAAuZA64AtwCJALoC6ADwAAgAuACgA/oEpgO6AqsD+AAIAAgAswMIAAgACAAIAIkAuwP5AfsBwwPLAwgACAAIAAgACADRA9kDCAAIAOED6QMIAAgACAAIAAgACADuA/YDCAAIAP4DyQAIAAgABgQIAAgAXQAOBAgACAAIAAgACAAIABMECAAIAAgACAAIAAgACAD8AAQBCAAIAAgAGgQiBCoECAExBAgAEAEIAAgACAAIAAgACAAIAAgACAAIAAgACAA4BAgACABABEYECAAIAAgATAQYAQgAVAQIAAgACAAIAAgACAAIAAgACAAIAFoECAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgAOQEIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAB+BAcACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAEABhgSMBAgACAAIAAgAlAQIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAwAEAAQABAADAAMAAwADAAQABAAEAAQABAAEAAQABHATAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgAdQMIAAgACAAIAAgACAAIAMkACAAIAAgAfQMIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACACFA4kDCAAIAAgACAAIAOcBCAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAIcDCAAIAAgACAAIAAgACAAIAAgACAAIAJEDCAAIAAgACADFAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACABgBAgAZgQIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgAbAQCBXIECAAIAHkECAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACABAAJwEQACjBKoEsgQIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAC6BMIECAAIAAgACAAIAAgACABmBAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgAxwQIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAGYECAAIAAgAzgQIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgAigWKBYoFigWKBYoFigWKBd0FXwUIAOIF6gXxBYoF3gT5BQAGCAaKBYoFigWKBYoFigWKBYoFigWKBYoFigXWBIoFigWKBYoFigWKBYoFigWKBYsFEAaKBYoFigWKBYoFigWKBRQGCACKBYoFigWKBQgACAAIANEECAAIABgGigUgBggAJgYIAC4GMwaKBYoF0wQ3Bj4GigWKBYoFigWKBYoFigWKBYoFigWKBYoFigUIAAgACAAIAAgACAAIAAgAigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWKBYoFigWLBf///////wQABAAEAAQABAAEAAQABAAEAAQAAwAEAAQAAgAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAQADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAUAAAAFAAUAAAAFAAUAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUAAQAAAAUABQAFAAUABQAFAAAAAAAFAAUAAAAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAFAAUAAQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABwAFAAUABQAFAAAABwAHAAcAAAAHAAcABwAFAAEAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABwAFAAUABQAFAAcABwAFAAUAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAQABAAAAAAAAAAAAAAAFAAUABQAFAAAABwAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAHAAcABwAHAAcAAAAHAAcAAAAAAAUABQAHAAUAAQAHAAEABwAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABwABAAUABQAFAAUAAAAAAAAAAAAAAAEAAQABAAEAAQABAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABwAFAAUAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUAAQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABQANAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAABQAHAAUABQAFAAAAAAAAAAcABQAFAAUABQAFAAQABAAEAAQABAAEAAQABAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUAAAAFAAUABQAFAAUAAAAFAAUABQAAAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAAAAAAAAAAAAUABQAFAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAHAAUAAAAHAAcABwAFAAUABQAFAAUABQAFAAUABwAHAAcABwAFAAcABwAAAAUABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABwAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAUABwAHAAUABQAFAAUAAAAAAAcABwAAAAAABwAHAAUAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAABQAFAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAABwAHAAcABQAFAAAAAAAAAAAABQAFAAAAAAAFAAUABQAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAFAAUABQAFAAUAAAAFAAUABwAAAAcABwAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAFAAUABwAFAAUABQAFAAAAAAAHAAcAAAAAAAcABwAFAAAAAAAAAAAAAAAAAAAABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAcABwAAAAAAAAAHAAcABwAAAAcABwAHAAUAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAABQAHAAcABwAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABwAHAAcABwAAAAUABQAFAAAABQAFAAUABQAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAcABQAHAAcABQAHAAcAAAAFAAcABwAAAAcABwAFAAUAAAAAAAAAAAAAAAAAAAAFAAUAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAcABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAUABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAFAAcABwAFAAUABQAAAAUAAAAHAAcABwAHAAcABwAHAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAHAAUABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAABwAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAUAAAAFAAAAAAAAAAAABwAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABwAFAAUABQAFAAUAAAAFAAUAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABwAFAAUABQAFAAUABQAAAAUABQAHAAcABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABQAFAAAAAAAAAAAABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAcABQAFAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAHAAUABQAFAAUABQAFAAUABwAHAAcABwAHAAcABwAHAAUABwAHAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABwAHAAcABwAFAAUABwAHAAcAAAAAAAAAAAAHAAcABQAHAAcABwAHAAcABwAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAcABwAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABQAHAAUABQAFAAUABQAFAAUAAAAFAAAABQAAAAAABQAFAAUABQAFAAUABQAFAAcABwAHAAcABwAHAAUABQAFAAUABQAFAAUABQAFAAUAAAAAAAUABQAFAAUABQAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABwAFAAcABwAHAAcABwAFAAcABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAUABQAFAAUABwAHAAUABQAHAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAcABQAFAAcABwAHAAUABwAFAAUABQAHAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAcABwAHAAcABwAHAAUABQAFAAUABQAFAAUABQAHAAcABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUAAAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAcABQAFAAUABQAFAAUABQAAAAAAAAAAAAUAAAAAAAAAAAAAAAAABQAAAAAABwAFAAUAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAAABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUAAAAFAAUABQAFAAUABQAFAAUABQAFAAAAAAAAAAAABQAAAAAAAAAFAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAUABQAHAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABwAHAAcABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAUABQAFAAUABQAHAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAcABwAFAAUABQAFAAcABwAFAAUABwAHAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAFAAcABwAFAAUABwAHAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAFAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAFAAUABQAAAAAABQAFAAAAAAAAAAAAAAAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABQAFAAcABwAAAAAAAAAAAAAABwAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABwAFAAcABwAFAAcABwAAAAcABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAAAAAAAAAAAAAAAAAFAAUABQAAAAUABQAAAAAAAAAAAAAABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABQAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABwAFAAUABQAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAcABQAFAAUABQAFAAUABQAFAAUABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABwAFAAUABQAHAAcABQAHAAUABQAAAAAAAAAAAAAAAAAFAAAABwAHAAcABQAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABwAHAAcABwAAAAAABwAHAAAAAAAHAAcABwAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAAAAAAFAAUABQAFAAUABQAFAAAAAAAAAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABwAFAAUABQAFAAUABQAFAAUABwAHAAUABQAFAAcABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAHAAcABQAFAAUABQAFAAUABwAFAAcABwAFAAcABQAFAAcABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAHAAcABQAFAAUABQAAAAAABwAHAAcABwAFAAUABwAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABwAHAAUABQAFAAUABQAFAAUABQAHAAcABQAHAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABwAFAAcABwAFAAUABQAFAAUABQAHAAUAAAAAAAAAAAAAAAAAAAAAAAcABwAFAAUABQAFAAcABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABwAFAAUABQAFAAUABQAFAAUABQAHAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABwAFAAUABQAFAAAAAAAFAAUABwAHAAcABwAFAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABwAHAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABQAFAAUABQAFAAUABQAAAAUABQAFAAUABQAFAAcABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUAAAAHAAUABQAFAAUABQAFAAUABwAFAAUABwAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUAAAAAAAAABQAAAAUABQAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAcABwAHAAcAAAAFAAUAAAAHAAcABQAHAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABwAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAAAAAAAAAAAAAAAAAAABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAAAAUABQAFAAAAAAAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAAAAAAAAAAABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUABQAFAAUABQAAAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABQAAAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAAAAAABQAFAAUABQAFAAUABQAAAAUABQAAAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAUABQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAFAAUABQAFAAUABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAFAAUABQAFAAUADgAOAA4ADgAOAA4ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAAAAAAAAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAMAAwADAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAAAAAAAAAAAAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAAAAAAAAAAAAsADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwACwAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ADgAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAA4ADgAOAA4ADgAOAA4ADgAOAAAAAAAAAAAADgAOAA4AAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAA4ADgAAAA4ADgAOAA4ADgAOAAAADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4AAAAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4AAAAAAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAAAA4AAAAOAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAADgAAAAAAAAAAAA4AAAAOAAAAAAAAAAAADgAOAA4AAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAOAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ADgAOAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAADgAOAA4ADgAOAA4ADgAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAAAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAA4ADgAOAA4ADgAOAA4ADgAOAAAADgAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4AAAAAAAAAAAAAAAAADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAA4ADgAOAA4ADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAOAA4ADgAOAA4AAAAAAAAAAAAAAAAAAAAAAA4ADgAOAA4ADgAOAA4ADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4AAAAOAA4ADgAOAA4ADgAAAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4AAAAAAAAAAAA=';

        /*
         * utrie 1.0.2 <https://github.com/niklasvh/utrie>
         * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var chars$1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        // Use a lookup table to find the index.
        var lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
        for (var i$1 = 0; i$1 < chars$1.length; i$1++) {
            lookup$1[chars$1.charCodeAt(i$1)] = i$1;
        }
        var decode = function (base64) {
            var bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
            if (base64[base64.length - 1] === '=') {
                bufferLength--;
                if (base64[base64.length - 2] === '=') {
                    bufferLength--;
                }
            }
            var buffer = typeof ArrayBuffer !== 'undefined' &&
                typeof Uint8Array !== 'undefined' &&
                typeof Uint8Array.prototype.slice !== 'undefined'
                ? new ArrayBuffer(bufferLength)
                : new Array(bufferLength);
            var bytes = Array.isArray(buffer) ? buffer : new Uint8Array(buffer);
            for (i = 0; i < len; i += 4) {
                encoded1 = lookup$1[base64.charCodeAt(i)];
                encoded2 = lookup$1[base64.charCodeAt(i + 1)];
                encoded3 = lookup$1[base64.charCodeAt(i + 2)];
                encoded4 = lookup$1[base64.charCodeAt(i + 3)];
                bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
                bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
                bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
            }
            return buffer;
        };
        var polyUint16Array = function (buffer) {
            var length = buffer.length;
            var bytes = [];
            for (var i = 0; i < length; i += 2) {
                bytes.push((buffer[i + 1] << 8) | buffer[i]);
            }
            return bytes;
        };
        var polyUint32Array = function (buffer) {
            var length = buffer.length;
            var bytes = [];
            for (var i = 0; i < length; i += 4) {
                bytes.push((buffer[i + 3] << 24) | (buffer[i + 2] << 16) | (buffer[i + 1] << 8) | buffer[i]);
            }
            return bytes;
        };

        /** Shift size for getting the index-2 table offset. */
        var UTRIE2_SHIFT_2 = 5;
        /** Shift size for getting the index-1 table offset. */
        var UTRIE2_SHIFT_1 = 6 + 5;
        /**
         * Shift size for shifting left the index array values.
         * Increases possible data size with 16-bit index values at the cost
         * of compactability.
         * This requires data blocks to be aligned by UTRIE2_DATA_GRANULARITY.
         */
        var UTRIE2_INDEX_SHIFT = 2;
        /**
         * Difference between the two shift sizes,
         * for getting an index-1 offset from an index-2 offset. 6=11-5
         */
        var UTRIE2_SHIFT_1_2 = UTRIE2_SHIFT_1 - UTRIE2_SHIFT_2;
        /**
         * The part of the index-2 table for U+D800..U+DBFF stores values for
         * lead surrogate code _units_ not code _points_.
         * Values for lead surrogate code _points_ are indexed with this portion of the table.
         * Length=32=0x20=0x400>>UTRIE2_SHIFT_2. (There are 1024=0x400 lead surrogates.)
         */
        var UTRIE2_LSCP_INDEX_2_OFFSET = 0x10000 >> UTRIE2_SHIFT_2;
        /** Number of entries in a data block. 32=0x20 */
        var UTRIE2_DATA_BLOCK_LENGTH = 1 << UTRIE2_SHIFT_2;
        /** Mask for getting the lower bits for the in-data-block offset. */
        var UTRIE2_DATA_MASK = UTRIE2_DATA_BLOCK_LENGTH - 1;
        var UTRIE2_LSCP_INDEX_2_LENGTH = 0x400 >> UTRIE2_SHIFT_2;
        /** Count the lengths of both BMP pieces. 2080=0x820 */
        var UTRIE2_INDEX_2_BMP_LENGTH = UTRIE2_LSCP_INDEX_2_OFFSET + UTRIE2_LSCP_INDEX_2_LENGTH;
        /**
         * The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
         * Length 32=0x20 for lead bytes C0..DF, regardless of UTRIE2_SHIFT_2.
         */
        var UTRIE2_UTF8_2B_INDEX_2_OFFSET = UTRIE2_INDEX_2_BMP_LENGTH;
        var UTRIE2_UTF8_2B_INDEX_2_LENGTH = 0x800 >> 6; /* U+0800 is the first code point after 2-byte UTF-8 */
        /**
         * The index-1 table, only used for supplementary code points, at offset 2112=0x840.
         * Variable length, for code points up to highStart, where the last single-value range starts.
         * Maximum length 512=0x200=0x100000>>UTRIE2_SHIFT_1.
         * (For 0x100000 supplementary code points U+10000..U+10ffff.)
         *
         * The part of the index-2 table for supplementary code points starts
         * after this index-1 table.
         *
         * Both the index-1 table and the following part of the index-2 table
         * are omitted completely if there is only BMP data.
         */
        var UTRIE2_INDEX_1_OFFSET = UTRIE2_UTF8_2B_INDEX_2_OFFSET + UTRIE2_UTF8_2B_INDEX_2_LENGTH;
        /**
         * Number of index-1 entries for the BMP. 32=0x20
         * This part of the index-1 table is omitted from the serialized form.
         */
        var UTRIE2_OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> UTRIE2_SHIFT_1;
        /** Number of entries in an index-2 block. 64=0x40 */
        var UTRIE2_INDEX_2_BLOCK_LENGTH = 1 << UTRIE2_SHIFT_1_2;
        /** Mask for getting the lower bits for the in-index-2-block offset. */
        var UTRIE2_INDEX_2_MASK = UTRIE2_INDEX_2_BLOCK_LENGTH - 1;
        var slice16 = function (view, start, end) {
            if (view.slice) {
                return view.slice(start, end);
            }
            return new Uint16Array(Array.prototype.slice.call(view, start, end));
        };
        var slice32 = function (view, start, end) {
            if (view.slice) {
                return view.slice(start, end);
            }
            return new Uint32Array(Array.prototype.slice.call(view, start, end));
        };
        var createTrieFromBase64 = function (base64, _byteLength) {
            var buffer = decode(base64);
            var view32 = Array.isArray(buffer) ? polyUint32Array(buffer) : new Uint32Array(buffer);
            var view16 = Array.isArray(buffer) ? polyUint16Array(buffer) : new Uint16Array(buffer);
            var headerLength = 24;
            var index = slice16(view16, headerLength / 2, view32[4] / 2);
            var data = view32[5] === 2
                ? slice16(view16, (headerLength + view32[4]) / 2)
                : slice32(view32, Math.ceil((headerLength + view32[4]) / 4));
            return new Trie(view32[0], view32[1], view32[2], view32[3], index, data);
        };
        var Trie = /** @class */ (function () {
            function Trie(initialValue, errorValue, highStart, highValueIndex, index, data) {
                this.initialValue = initialValue;
                this.errorValue = errorValue;
                this.highStart = highStart;
                this.highValueIndex = highValueIndex;
                this.index = index;
                this.data = data;
            }
            /**
             * Get the value for a code point as stored in the Trie.
             *
             * @param codePoint the code point
             * @return the value
             */
            Trie.prototype.get = function (codePoint) {
                var ix;
                if (codePoint >= 0) {
                    if (codePoint < 0x0d800 || (codePoint > 0x0dbff && codePoint <= 0x0ffff)) {
                        // Ordinary BMP code point, excluding leading surrogates.
                        // BMP uses a single level lookup.  BMP index starts at offset 0 in the Trie2 index.
                        // 16 bit data is stored in the index array itself.
                        ix = this.index[codePoint >> UTRIE2_SHIFT_2];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint <= 0xffff) {
                        // Lead Surrogate Code Point.  A Separate index section is stored for
                        // lead surrogate code units and code points.
                        //   The main index has the code unit data.
                        //   For this function, we need the code point data.
                        // Note: this expression could be refactored for slightly improved efficiency, but
                        //       surrogate code points will be so rare in practice that it's not worth it.
                        ix = this.index[UTRIE2_LSCP_INDEX_2_OFFSET + ((codePoint - 0xd800) >> UTRIE2_SHIFT_2)];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint < this.highStart) {
                        // Supplemental code point, use two-level lookup.
                        ix = UTRIE2_INDEX_1_OFFSET - UTRIE2_OMITTED_BMP_INDEX_1_LENGTH + (codePoint >> UTRIE2_SHIFT_1);
                        ix = this.index[ix];
                        ix += (codePoint >> UTRIE2_SHIFT_2) & UTRIE2_INDEX_2_MASK;
                        ix = this.index[ix];
                        ix = (ix << UTRIE2_INDEX_SHIFT) + (codePoint & UTRIE2_DATA_MASK);
                        return this.data[ix];
                    }
                    if (codePoint <= 0x10ffff) {
                        return this.data[this.highValueIndex];
                    }
                }
                // Fall through.  The code point is outside of the legal range of 0..0x10ffff.
                return this.errorValue;
            };
            return Trie;
        }());

        /*
         * base64-arraybuffer 1.0.2 <https://github.com/niklasvh/base64-arraybuffer>
         * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
         * Released under MIT License
         */
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        // Use a lookup table to find the index.
        var lookup = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
        for (var i = 0; i < chars.length; i++) {
            lookup[chars.charCodeAt(i)] = i;
        }

        var Prepend = 1;
        var CR = 2;
        var LF = 3;
        var Control = 4;
        var Extend = 5;
        var SpacingMark = 7;
        var L = 8;
        var V = 9;
        var T = 10;
        var LV = 11;
        var LVT = 12;
        var ZWJ = 13;
        var Extended_Pictographic = 14;
        var RI = 15;
        var toCodePoints = function (str) {
            var codePoints = [];
            var i = 0;
            var length = str.length;
            while (i < length) {
                var value = str.charCodeAt(i++);
                if (value >= 0xd800 && value <= 0xdbff && i < length) {
                    var extra = str.charCodeAt(i++);
                    if ((extra & 0xfc00) === 0xdc00) {
                        codePoints.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
                    }
                    else {
                        codePoints.push(value);
                        i--;
                    }
                }
                else {
                    codePoints.push(value);
                }
            }
            return codePoints;
        };
        var fromCodePoint = function () {
            var codePoints = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                codePoints[_i] = arguments[_i];
            }
            if (String.fromCodePoint) {
                return String.fromCodePoint.apply(String, codePoints);
            }
            var length = codePoints.length;
            if (!length) {
                return '';
            }
            var codeUnits = [];
            var index = -1;
            var result = '';
            while (++index < length) {
                var codePoint = codePoints[index];
                if (codePoint <= 0xffff) {
                    codeUnits.push(codePoint);
                }
                else {
                    codePoint -= 0x10000;
                    codeUnits.push((codePoint >> 10) + 0xd800, (codePoint % 0x400) + 0xdc00);
                }
                if (index + 1 === length || codeUnits.length > 0x4000) {
                    result += String.fromCharCode.apply(String, codeUnits);
                    codeUnits.length = 0;
                }
            }
            return result;
        };
        var UnicodeTrie = createTrieFromBase64(base64);
        var BREAK_NOT_ALLOWED = '×';
        var BREAK_ALLOWED = '÷';
        var codePointToClass = function (codePoint) { return UnicodeTrie.get(codePoint); };
        var _graphemeBreakAtIndex = function (_codePoints, classTypes, index) {
            var prevIndex = index - 2;
            var prev = classTypes[prevIndex];
            var current = classTypes[index - 1];
            var next = classTypes[index];
            // GB3 Do not break between a CR and LF
            if (current === CR && next === LF) {
                return BREAK_NOT_ALLOWED;
            }
            // GB4 Otherwise, break before and after controls.
            if (current === CR || current === LF || current === Control) {
                return BREAK_ALLOWED;
            }
            // GB5
            if (next === CR || next === LF || next === Control) {
                return BREAK_ALLOWED;
            }
            // Do not break Hangul syllable sequences.
            // GB6
            if (current === L && [L, V, LV, LVT].indexOf(next) !== -1) {
                return BREAK_NOT_ALLOWED;
            }
            // GB7
            if ((current === LV || current === V) && (next === V || next === T)) {
                return BREAK_NOT_ALLOWED;
            }
            // GB8
            if ((current === LVT || current === T) && next === T) {
                return BREAK_NOT_ALLOWED;
            }
            // GB9 Do not break before extending characters or ZWJ.
            if (next === ZWJ || next === Extend) {
                return BREAK_NOT_ALLOWED;
            }
            // Do not break before SpacingMarks, or after Prepend characters.
            // GB9a
            if (next === SpacingMark) {
                return BREAK_NOT_ALLOWED;
            }
            // GB9a
            if (current === Prepend) {
                return BREAK_NOT_ALLOWED;
            }
            // GB11 Do not break within emoji modifier sequences or emoji zwj sequences.
            if (current === ZWJ && next === Extended_Pictographic) {
                while (prev === Extend) {
                    prev = classTypes[--prevIndex];
                }
                if (prev === Extended_Pictographic) {
                    return BREAK_NOT_ALLOWED;
                }
            }
            // GB12 Do not break within emoji flag sequences.
            // That is, do not break between regional indicator (RI) symbols
            // if there is an odd number of RI characters before the break point.
            if (current === RI && next === RI) {
                var countRI = 0;
                while (prev === RI) {
                    countRI++;
                    prev = classTypes[--prevIndex];
                }
                if (countRI % 2 === 0) {
                    return BREAK_NOT_ALLOWED;
                }
            }
            return BREAK_ALLOWED;
        };
        var GraphemeBreaker = function (str) {
            var codePoints = toCodePoints(str);
            var length = codePoints.length;
            var index = 0;
            var lastEnd = 0;
            var classTypes = codePoints.map(codePointToClass);
            return {
                next: function () {
                    if (index >= length) {
                        return { done: true, value: null };
                    }
                    var graphemeBreak = BREAK_NOT_ALLOWED;
                    while (index < length &&
                        (graphemeBreak = _graphemeBreakAtIndex(codePoints, classTypes, ++index)) === BREAK_NOT_ALLOWED) { }
                    if (graphemeBreak !== BREAK_NOT_ALLOWED || index === length) {
                        var value = fromCodePoint.apply(null, codePoints.slice(lastEnd, index));
                        lastEnd = index;
                        return { value: value, done: false };
                    }
                    return { done: true, value: null };
                },
            };
        };
        var splitGraphemes = function (str) {
            var breaker = GraphemeBreaker(str);
            var graphemes = [];
            var bk;
            while (!(bk = breaker.next()).done) {
                if (bk.value) {
                    graphemes.push(bk.value.slice());
                }
            }
            return graphemes;
        };

        var testRangeBounds = function (document) {
            var TEST_HEIGHT = 123;
            if (document.createRange) {
                var range = document.createRange();
                if (range.getBoundingClientRect) {
                    var testElement = document.createElement('boundtest');
                    testElement.style.height = TEST_HEIGHT + "px";
                    testElement.style.display = 'block';
                    document.body.appendChild(testElement);
                    range.selectNode(testElement);
                    var rangeBounds = range.getBoundingClientRect();
                    var rangeHeight = Math.round(rangeBounds.height);
                    document.body.removeChild(testElement);
                    if (rangeHeight === TEST_HEIGHT) {
                        return true;
                    }
                }
            }
            return false;
        };
        var testIOSLineBreak = function (document) {
            var testElement = document.createElement('boundtest');
            testElement.style.width = '50px';
            testElement.style.display = 'block';
            testElement.style.fontSize = '12px';
            testElement.style.letterSpacing = '0px';
            testElement.style.wordSpacing = '0px';
            document.body.appendChild(testElement);
            var range = document.createRange();
            testElement.innerHTML = typeof ''.repeat === 'function' ? '&#128104;'.repeat(10) : '';
            var node = testElement.firstChild;
            var textList = toCodePoints$1(node.data).map(function (i) { return fromCodePoint$1(i); });
            var offset = 0;
            var prev = {};
            // ios 13 does not handle range getBoundingClientRect line changes correctly #2177
            var supports = textList.every(function (text, i) {
                range.setStart(node, offset);
                range.setEnd(node, offset + text.length);
                var rect = range.getBoundingClientRect();
                offset += text.length;
                var boundAhead = rect.x > prev.x || rect.y > prev.y;
                prev = rect;
                if (i === 0) {
                    return true;
                }
                return boundAhead;
            });
            document.body.removeChild(testElement);
            return supports;
        };
        var testCORS = function () { return typeof new Image().crossOrigin !== 'undefined'; };
        var testResponseType = function () { return typeof new XMLHttpRequest().responseType === 'string'; };
        var testSVG = function (document) {
            var img = new Image();
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            if (!ctx) {
                return false;
            }
            img.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>";
            try {
                ctx.drawImage(img, 0, 0);
                canvas.toDataURL();
            }
            catch (e) {
                return false;
            }
            return true;
        };
        var isGreenPixel = function (data) {
            return data[0] === 0 && data[1] === 255 && data[2] === 0 && data[3] === 255;
        };
        var testForeignObject = function (document) {
            var canvas = document.createElement('canvas');
            var size = 100;
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            if (!ctx) {
                return Promise.reject(false);
            }
            ctx.fillStyle = 'rgb(0, 255, 0)';
            ctx.fillRect(0, 0, size, size);
            var img = new Image();
            var greenImageSrc = canvas.toDataURL();
            img.src = greenImageSrc;
            var svg = createForeignObjectSVG(size, size, 0, 0, img);
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, size, size);
            return loadSerializedSVG$1(svg)
                .then(function (img) {
                ctx.drawImage(img, 0, 0);
                var data = ctx.getImageData(0, 0, size, size).data;
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, size, size);
                var node = document.createElement('div');
                node.style.backgroundImage = "url(" + greenImageSrc + ")";
                node.style.height = size + "px";
                // Firefox 55 does not render inline <img /> tags
                return isGreenPixel(data)
                    ? loadSerializedSVG$1(createForeignObjectSVG(size, size, 0, 0, node))
                    : Promise.reject(false);
            })
                .then(function (img) {
                ctx.drawImage(img, 0, 0);
                // Edge does not render background-images
                return isGreenPixel(ctx.getImageData(0, 0, size, size).data);
            })
                .catch(function () { return false; });
        };
        var createForeignObjectSVG = function (width, height, x, y, node) {
            var xmlns = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(xmlns, 'svg');
            var foreignObject = document.createElementNS(xmlns, 'foreignObject');
            svg.setAttributeNS(null, 'width', width.toString());
            svg.setAttributeNS(null, 'height', height.toString());
            foreignObject.setAttributeNS(null, 'width', '100%');
            foreignObject.setAttributeNS(null, 'height', '100%');
            foreignObject.setAttributeNS(null, 'x', x.toString());
            foreignObject.setAttributeNS(null, 'y', y.toString());
            foreignObject.setAttributeNS(null, 'externalResourcesRequired', 'true');
            svg.appendChild(foreignObject);
            foreignObject.appendChild(node);
            return svg;
        };
        var loadSerializedSVG$1 = function (svg) {
            return new Promise(function (resolve, reject) {
                var img = new Image();
                img.onload = function () { return resolve(img); };
                img.onerror = reject;
                img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
            });
        };
        var FEATURES = {
            get SUPPORT_RANGE_BOUNDS() {
                var value = testRangeBounds(document);
                Object.defineProperty(FEATURES, 'SUPPORT_RANGE_BOUNDS', { value: value });
                return value;
            },
            get SUPPORT_WORD_BREAKING() {
                var value = FEATURES.SUPPORT_RANGE_BOUNDS && testIOSLineBreak(document);
                Object.defineProperty(FEATURES, 'SUPPORT_WORD_BREAKING', { value: value });
                return value;
            },
            get SUPPORT_SVG_DRAWING() {
                var value = testSVG(document);
                Object.defineProperty(FEATURES, 'SUPPORT_SVG_DRAWING', { value: value });
                return value;
            },
            get SUPPORT_FOREIGNOBJECT_DRAWING() {
                var value = typeof Array.from === 'function' && typeof window.fetch === 'function'
                    ? testForeignObject(document)
                    : Promise.resolve(false);
                Object.defineProperty(FEATURES, 'SUPPORT_FOREIGNOBJECT_DRAWING', { value: value });
                return value;
            },
            get SUPPORT_CORS_IMAGES() {
                var value = testCORS();
                Object.defineProperty(FEATURES, 'SUPPORT_CORS_IMAGES', { value: value });
                return value;
            },
            get SUPPORT_RESPONSE_TYPE() {
                var value = testResponseType();
                Object.defineProperty(FEATURES, 'SUPPORT_RESPONSE_TYPE', { value: value });
                return value;
            },
            get SUPPORT_CORS_XHR() {
                var value = 'withCredentials' in new XMLHttpRequest();
                Object.defineProperty(FEATURES, 'SUPPORT_CORS_XHR', { value: value });
                return value;
            },
            get SUPPORT_NATIVE_TEXT_SEGMENTATION() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                var value = !!(typeof Intl !== 'undefined' && Intl.Segmenter);
                Object.defineProperty(FEATURES, 'SUPPORT_NATIVE_TEXT_SEGMENTATION', { value: value });
                return value;
            }
        };

        var TextBounds = /** @class */ (function () {
            function TextBounds(text, bounds) {
                this.text = text;
                this.bounds = bounds;
            }
            return TextBounds;
        }());
        var parseTextBounds = function (context, value, styles, node) {
            var textList = breakText(value, styles);
            var textBounds = [];
            var offset = 0;
            textList.forEach(function (text) {
                if (styles.textDecorationLine.length || text.trim().length > 0) {
                    if (FEATURES.SUPPORT_RANGE_BOUNDS) {
                        var clientRects = createRange(node, offset, text.length).getClientRects();
                        if (clientRects.length > 1) {
                            var subSegments = segmentGraphemes(text);
                            var subOffset_1 = 0;
                            subSegments.forEach(function (subSegment) {
                                textBounds.push(new TextBounds(subSegment, Bounds.fromDOMRectList(context, createRange(node, subOffset_1 + offset, subSegment.length).getClientRects())));
                                subOffset_1 += subSegment.length;
                            });
                        }
                        else {
                            textBounds.push(new TextBounds(text, Bounds.fromDOMRectList(context, clientRects)));
                        }
                    }
                    else {
                        var replacementNode = node.splitText(text.length);
                        textBounds.push(new TextBounds(text, getWrapperBounds(context, node)));
                        node = replacementNode;
                    }
                }
                else if (!FEATURES.SUPPORT_RANGE_BOUNDS) {
                    node = node.splitText(text.length);
                }
                offset += text.length;
            });
            return textBounds;
        };
        var getWrapperBounds = function (context, node) {
            var ownerDocument = node.ownerDocument;
            if (ownerDocument) {
                var wrapper = ownerDocument.createElement('html2canvaswrapper');
                wrapper.appendChild(node.cloneNode(true));
                var parentNode = node.parentNode;
                if (parentNode) {
                    parentNode.replaceChild(wrapper, node);
                    var bounds = parseBounds(context, wrapper);
                    if (wrapper.firstChild) {
                        parentNode.replaceChild(wrapper.firstChild, wrapper);
                    }
                    return bounds;
                }
            }
            return Bounds.EMPTY;
        };
        var createRange = function (node, offset, length) {
            var ownerDocument = node.ownerDocument;
            if (!ownerDocument) {
                throw new Error('Node has no owner document');
            }
            var range = ownerDocument.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + length);
            return range;
        };
        var segmentGraphemes = function (value) {
            if (FEATURES.SUPPORT_NATIVE_TEXT_SEGMENTATION) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                var segmenter = new Intl.Segmenter(void 0, { granularity: 'grapheme' });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return Array.from(segmenter.segment(value)).map(function (segment) { return segment.segment; });
            }
            return splitGraphemes(value);
        };
        var segmentWords = function (value, styles) {
            if (FEATURES.SUPPORT_NATIVE_TEXT_SEGMENTATION) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                var segmenter = new Intl.Segmenter(void 0, {
                    granularity: 'word'
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return Array.from(segmenter.segment(value)).map(function (segment) { return segment.segment; });
            }
            return breakWords(value, styles);
        };
        var breakText = function (value, styles) {
            return styles.letterSpacing !== 0 ? segmentGraphemes(value) : segmentWords(value, styles);
        };
        // https://drafts.csswg.org/css-text/#word-separator
        var wordSeparators = [0x0020, 0x00a0, 0x1361, 0x10100, 0x10101, 0x1039, 0x1091];
        var breakWords = function (str, styles) {
            var breaker = LineBreaker(str, {
                lineBreak: styles.lineBreak,
                wordBreak: styles.overflowWrap === "break-word" /* BREAK_WORD */ ? 'break-word' : styles.wordBreak
            });
            var words = [];
            var bk;
            var _loop_1 = function () {
                if (bk.value) {
                    var value = bk.value.slice();
                    var codePoints = toCodePoints$1(value);
                    var word_1 = '';
                    codePoints.forEach(function (codePoint) {
                        if (wordSeparators.indexOf(codePoint) === -1) {
                            word_1 += fromCodePoint$1(codePoint);
                        }
                        else {
                            if (word_1.length) {
                                words.push(word_1);
                            }
                            words.push(fromCodePoint$1(codePoint));
                            word_1 = '';
                        }
                    });
                    if (word_1.length) {
                        words.push(word_1);
                    }
                }
            };
            while (!(bk = breaker.next()).done) {
                _loop_1();
            }
            return words;
        };

        var TextContainer = /** @class */ (function () {
            function TextContainer(context, node, styles) {
                this.text = transform(node.data, styles.textTransform);
                this.textBounds = parseTextBounds(context, this.text, styles, node);
            }
            return TextContainer;
        }());
        var transform = function (text, transform) {
            switch (transform) {
                case 1 /* LOWERCASE */:
                    return text.toLowerCase();
                case 3 /* CAPITALIZE */:
                    return text.replace(CAPITALIZE, capitalize);
                case 2 /* UPPERCASE */:
                    return text.toUpperCase();
                default:
                    return text;
            }
        };
        var CAPITALIZE = /(^|\s|:|-|\(|\))([a-z])/g;
        var capitalize = function (m, p1, p2) {
            if (m.length > 0) {
                return p1 + p2.toUpperCase();
            }
            return m;
        };

        var ImageElementContainer = /** @class */ (function (_super) {
            __extends(ImageElementContainer, _super);
            function ImageElementContainer(context, img) {
                var _this = _super.call(this, context, img) || this;
                _this.src = img.currentSrc || img.src;
                _this.intrinsicWidth = img.naturalWidth;
                _this.intrinsicHeight = img.naturalHeight;
                _this.context.cache.addImage(_this.src);
                return _this;
            }
            return ImageElementContainer;
        }(ElementContainer));

        var CanvasElementContainer = /** @class */ (function (_super) {
            __extends(CanvasElementContainer, _super);
            function CanvasElementContainer(context, canvas) {
                var _this = _super.call(this, context, canvas) || this;
                _this.canvas = canvas;
                _this.intrinsicWidth = canvas.width;
                _this.intrinsicHeight = canvas.height;
                return _this;
            }
            return CanvasElementContainer;
        }(ElementContainer));

        var SVGElementContainer = /** @class */ (function (_super) {
            __extends(SVGElementContainer, _super);
            function SVGElementContainer(context, img) {
                var _this = _super.call(this, context, img) || this;
                var s = new XMLSerializer();
                var bounds = parseBounds(context, img);
                img.setAttribute('width', bounds.width + "px");
                img.setAttribute('height', bounds.height + "px");
                _this.svg = "data:image/svg+xml," + encodeURIComponent(s.serializeToString(img));
                _this.intrinsicWidth = img.width.baseVal.value;
                _this.intrinsicHeight = img.height.baseVal.value;
                _this.context.cache.addImage(_this.svg);
                return _this;
            }
            return SVGElementContainer;
        }(ElementContainer));

        var LIElementContainer = /** @class */ (function (_super) {
            __extends(LIElementContainer, _super);
            function LIElementContainer(context, element) {
                var _this = _super.call(this, context, element) || this;
                _this.value = element.value;
                return _this;
            }
            return LIElementContainer;
        }(ElementContainer));

        var OLElementContainer = /** @class */ (function (_super) {
            __extends(OLElementContainer, _super);
            function OLElementContainer(context, element) {
                var _this = _super.call(this, context, element) || this;
                _this.start = element.start;
                _this.reversed = typeof element.reversed === 'boolean' && element.reversed === true;
                return _this;
            }
            return OLElementContainer;
        }(ElementContainer));

        var CHECKBOX_BORDER_RADIUS = [
            {
                type: 15 /* DIMENSION_TOKEN */,
                flags: 0,
                unit: 'px',
                number: 3
            }
        ];
        var RADIO_BORDER_RADIUS = [
            {
                type: 16 /* PERCENTAGE_TOKEN */,
                flags: 0,
                number: 50
            }
        ];
        var reformatInputBounds = function (bounds) {
            if (bounds.width > bounds.height) {
                return new Bounds(bounds.left + (bounds.width - bounds.height) / 2, bounds.top, bounds.height, bounds.height);
            }
            else if (bounds.width < bounds.height) {
                return new Bounds(bounds.left, bounds.top + (bounds.height - bounds.width) / 2, bounds.width, bounds.width);
            }
            return bounds;
        };
        var getInputValue = function (node) {
            var value = node.type === PASSWORD ? new Array(node.value.length + 1).join('\u2022') : node.value;
            return value.length === 0 ? node.placeholder || '' : value;
        };
        var CHECKBOX = 'checkbox';
        var RADIO = 'radio';
        var PASSWORD = 'password';
        var INPUT_COLOR = 0x2a2a2aff;
        var InputElementContainer = /** @class */ (function (_super) {
            __extends(InputElementContainer, _super);
            function InputElementContainer(context, input) {
                var _this = _super.call(this, context, input) || this;
                _this.type = input.type.toLowerCase();
                _this.checked = input.checked;
                _this.value = getInputValue(input);
                if (_this.type === CHECKBOX || _this.type === RADIO) {
                    _this.styles.backgroundColor = 0xdededeff;
                    _this.styles.borderTopColor =
                        _this.styles.borderRightColor =
                            _this.styles.borderBottomColor =
                                _this.styles.borderLeftColor =
                                    0xa5a5a5ff;
                    _this.styles.borderTopWidth =
                        _this.styles.borderRightWidth =
                            _this.styles.borderBottomWidth =
                                _this.styles.borderLeftWidth =
                                    1;
                    _this.styles.borderTopStyle =
                        _this.styles.borderRightStyle =
                            _this.styles.borderBottomStyle =
                                _this.styles.borderLeftStyle =
                                    1 /* SOLID */;
                    _this.styles.backgroundClip = [0 /* BORDER_BOX */];
                    _this.styles.backgroundOrigin = [0 /* BORDER_BOX */];
                    _this.bounds = reformatInputBounds(_this.bounds);
                }
                switch (_this.type) {
                    case CHECKBOX:
                        _this.styles.borderTopRightRadius =
                            _this.styles.borderTopLeftRadius =
                                _this.styles.borderBottomRightRadius =
                                    _this.styles.borderBottomLeftRadius =
                                        CHECKBOX_BORDER_RADIUS;
                        break;
                    case RADIO:
                        _this.styles.borderTopRightRadius =
                            _this.styles.borderTopLeftRadius =
                                _this.styles.borderBottomRightRadius =
                                    _this.styles.borderBottomLeftRadius =
                                        RADIO_BORDER_RADIUS;
                        break;
                }
                return _this;
            }
            return InputElementContainer;
        }(ElementContainer));

        var SelectElementContainer = /** @class */ (function (_super) {
            __extends(SelectElementContainer, _super);
            function SelectElementContainer(context, element) {
                var _this = _super.call(this, context, element) || this;
                var option = element.options[element.selectedIndex || 0];
                _this.value = option ? option.text || '' : '';
                return _this;
            }
            return SelectElementContainer;
        }(ElementContainer));

        var TextareaElementContainer = /** @class */ (function (_super) {
            __extends(TextareaElementContainer, _super);
            function TextareaElementContainer(context, element) {
                var _this = _super.call(this, context, element) || this;
                _this.value = element.value;
                return _this;
            }
            return TextareaElementContainer;
        }(ElementContainer));

        var IFrameElementContainer = /** @class */ (function (_super) {
            __extends(IFrameElementContainer, _super);
            function IFrameElementContainer(context, iframe) {
                var _this = _super.call(this, context, iframe) || this;
                _this.src = iframe.src;
                _this.width = parseInt(iframe.width, 10) || 0;
                _this.height = parseInt(iframe.height, 10) || 0;
                _this.backgroundColor = _this.styles.backgroundColor;
                try {
                    if (iframe.contentWindow &&
                        iframe.contentWindow.document &&
                        iframe.contentWindow.document.documentElement) {
                        _this.tree = parseTree(context, iframe.contentWindow.document.documentElement);
                        // http://www.w3.org/TR/css3-background/#special-backgrounds
                        var documentBackgroundColor = iframe.contentWindow.document.documentElement
                            ? parseColor(context, getComputedStyle(iframe.contentWindow.document.documentElement).backgroundColor)
                            : COLORS.TRANSPARENT;
                        var bodyBackgroundColor = iframe.contentWindow.document.body
                            ? parseColor(context, getComputedStyle(iframe.contentWindow.document.body).backgroundColor)
                            : COLORS.TRANSPARENT;
                        _this.backgroundColor = isTransparent(documentBackgroundColor)
                            ? isTransparent(bodyBackgroundColor)
                                ? _this.styles.backgroundColor
                                : bodyBackgroundColor
                            : documentBackgroundColor;
                    }
                }
                catch (e) { }
                return _this;
            }
            return IFrameElementContainer;
        }(ElementContainer));

        var LIST_OWNERS = ['OL', 'UL', 'MENU'];
        var parseNodeTree = function (context, node, parent, root) {
            for (var childNode = node.firstChild, nextNode = void 0; childNode; childNode = nextNode) {
                nextNode = childNode.nextSibling;
                if (isTextNode(childNode) && childNode.data.trim().length > 0) {
                    parent.textNodes.push(new TextContainer(context, childNode, parent.styles));
                }
                else if (isElementNode(childNode)) {
                    if (isSlotElement(childNode) && childNode.assignedNodes) {
                        childNode.assignedNodes().forEach(function (childNode) { return parseNodeTree(context, childNode, parent, root); });
                    }
                    else {
                        var container = createContainer(context, childNode);
                        if (container.styles.isVisible()) {
                            if (createsRealStackingContext(childNode, container, root)) {
                                container.flags |= 4 /* CREATES_REAL_STACKING_CONTEXT */;
                            }
                            else if (createsStackingContext(container.styles)) {
                                container.flags |= 2 /* CREATES_STACKING_CONTEXT */;
                            }
                            if (LIST_OWNERS.indexOf(childNode.tagName) !== -1) {
                                container.flags |= 8 /* IS_LIST_OWNER */;
                            }
                            parent.elements.push(container);
                            childNode.slot;
                            if (childNode.shadowRoot) {
                                parseNodeTree(context, childNode.shadowRoot, container, root);
                            }
                            else if (!isTextareaElement(childNode) &&
                                !isSVGElement(childNode) &&
                                !isSelectElement(childNode)) {
                                parseNodeTree(context, childNode, container, root);
                            }
                        }
                    }
                }
            }
        };
        var createContainer = function (context, element) {
            if (isImageElement(element)) {
                return new ImageElementContainer(context, element);
            }
            if (isCanvasElement(element)) {
                return new CanvasElementContainer(context, element);
            }
            if (isSVGElement(element)) {
                return new SVGElementContainer(context, element);
            }
            if (isLIElement(element)) {
                return new LIElementContainer(context, element);
            }
            if (isOLElement(element)) {
                return new OLElementContainer(context, element);
            }
            if (isInputElement(element)) {
                return new InputElementContainer(context, element);
            }
            if (isSelectElement(element)) {
                return new SelectElementContainer(context, element);
            }
            if (isTextareaElement(element)) {
                return new TextareaElementContainer(context, element);
            }
            if (isIFrameElement(element)) {
                return new IFrameElementContainer(context, element);
            }
            return new ElementContainer(context, element);
        };
        var parseTree = function (context, element) {
            var container = createContainer(context, element);
            container.flags |= 4 /* CREATES_REAL_STACKING_CONTEXT */;
            parseNodeTree(context, element, container, container);
            return container;
        };
        var createsRealStackingContext = function (node, container, root) {
            return (container.styles.isPositionedWithZIndex() ||
                container.styles.opacity < 1 ||
                container.styles.isTransformed() ||
                (isBodyElement(node) && root.styles.isTransparent()));
        };
        var createsStackingContext = function (styles) { return styles.isPositioned() || styles.isFloating(); };
        var isTextNode = function (node) { return node.nodeType === Node.TEXT_NODE; };
        var isElementNode = function (node) { return node.nodeType === Node.ELEMENT_NODE; };
        var isHTMLElementNode = function (node) {
            return isElementNode(node) && typeof node.style !== 'undefined' && !isSVGElementNode(node);
        };
        var isSVGElementNode = function (element) {
            return typeof element.className === 'object';
        };
        var isLIElement = function (node) { return node.tagName === 'LI'; };
        var isOLElement = function (node) { return node.tagName === 'OL'; };
        var isInputElement = function (node) { return node.tagName === 'INPUT'; };
        var isHTMLElement = function (node) { return node.tagName === 'HTML'; };
        var isSVGElement = function (node) { return node.tagName === 'svg'; };
        var isBodyElement = function (node) { return node.tagName === 'BODY'; };
        var isCanvasElement = function (node) { return node.tagName === 'CANVAS'; };
        var isVideoElement = function (node) { return node.tagName === 'VIDEO'; };
        var isImageElement = function (node) { return node.tagName === 'IMG'; };
        var isIFrameElement = function (node) { return node.tagName === 'IFRAME'; };
        var isStyleElement = function (node) { return node.tagName === 'STYLE'; };
        var isScriptElement = function (node) { return node.tagName === 'SCRIPT'; };
        var isTextareaElement = function (node) { return node.tagName === 'TEXTAREA'; };
        var isSelectElement = function (node) { return node.tagName === 'SELECT'; };
        var isSlotElement = function (node) { return node.tagName === 'SLOT'; };
        // https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
        var isCustomElement = function (node) { return node.tagName.indexOf('-') > 0; };

        var CounterState = /** @class */ (function () {
            function CounterState() {
                this.counters = {};
            }
            CounterState.prototype.getCounterValue = function (name) {
                var counter = this.counters[name];
                if (counter && counter.length) {
                    return counter[counter.length - 1];
                }
                return 1;
            };
            CounterState.prototype.getCounterValues = function (name) {
                var counter = this.counters[name];
                return counter ? counter : [];
            };
            CounterState.prototype.pop = function (counters) {
                var _this = this;
                counters.forEach(function (counter) { return _this.counters[counter].pop(); });
            };
            CounterState.prototype.parse = function (style) {
                var _this = this;
                var counterIncrement = style.counterIncrement;
                var counterReset = style.counterReset;
                var canReset = true;
                if (counterIncrement !== null) {
                    counterIncrement.forEach(function (entry) {
                        var counter = _this.counters[entry.counter];
                        if (counter && entry.increment !== 0) {
                            canReset = false;
                            if (!counter.length) {
                                counter.push(1);
                            }
                            counter[Math.max(0, counter.length - 1)] += entry.increment;
                        }
                    });
                }
                var counterNames = [];
                if (canReset) {
                    counterReset.forEach(function (entry) {
                        var counter = _this.counters[entry.counter];
                        counterNames.push(entry.counter);
                        if (!counter) {
                            counter = _this.counters[entry.counter] = [];
                        }
                        counter.push(entry.reset);
                    });
                }
                return counterNames;
            };
            return CounterState;
        }());
        var ROMAN_UPPER = {
            integers: [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1],
            values: ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']
        };
        var ARMENIAN = {
            integers: [
                9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 90, 80, 70,
                60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
            ],
            values: [
                'Ք',
                'Փ',
                'Ւ',
                'Ց',
                'Ր',
                'Տ',
                'Վ',
                'Ս',
                'Ռ',
                'Ջ',
                'Պ',
                'Չ',
                'Ո',
                'Շ',
                'Ն',
                'Յ',
                'Մ',
                'Ճ',
                'Ղ',
                'Ձ',
                'Հ',
                'Կ',
                'Ծ',
                'Խ',
                'Լ',
                'Ի',
                'Ժ',
                'Թ',
                'Ը',
                'Է',
                'Զ',
                'Ե',
                'Դ',
                'Գ',
                'Բ',
                'Ա'
            ]
        };
        var HEBREW = {
            integers: [
                10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 400, 300, 200, 100, 90, 80, 70, 60, 50, 40, 30, 20,
                19, 18, 17, 16, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
            ],
            values: [
                'י׳',
                'ט׳',
                'ח׳',
                'ז׳',
                'ו׳',
                'ה׳',
                'ד׳',
                'ג׳',
                'ב׳',
                'א׳',
                'ת',
                'ש',
                'ר',
                'ק',
                'צ',
                'פ',
                'ע',
                'ס',
                'נ',
                'מ',
                'ל',
                'כ',
                'יט',
                'יח',
                'יז',
                'טז',
                'טו',
                'י',
                'ט',
                'ח',
                'ז',
                'ו',
                'ה',
                'ד',
                'ג',
                'ב',
                'א'
            ]
        };
        var GEORGIAN = {
            integers: [
                10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 90,
                80, 70, 60, 50, 40, 30, 20, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
            ],
            values: [
                'ჵ',
                'ჰ',
                'ჯ',
                'ჴ',
                'ხ',
                'ჭ',
                'წ',
                'ძ',
                'ც',
                'ჩ',
                'შ',
                'ყ',
                'ღ',
                'ქ',
                'ფ',
                'ჳ',
                'ტ',
                'ს',
                'რ',
                'ჟ',
                'პ',
                'ო',
                'ჲ',
                'ნ',
                'მ',
                'ლ',
                'კ',
                'ი',
                'თ',
                'ჱ',
                'ზ',
                'ვ',
                'ე',
                'დ',
                'გ',
                'ბ',
                'ა'
            ]
        };
        var createAdditiveCounter = function (value, min, max, symbols, fallback, suffix) {
            if (value < min || value > max) {
                return createCounterText(value, fallback, suffix.length > 0);
            }
            return (symbols.integers.reduce(function (string, integer, index) {
                while (value >= integer) {
                    value -= integer;
                    string += symbols.values[index];
                }
                return string;
            }, '') + suffix);
        };
        var createCounterStyleWithSymbolResolver = function (value, codePointRangeLength, isNumeric, resolver) {
            var string = '';
            do {
                if (!isNumeric) {
                    value--;
                }
                string = resolver(value) + string;
                value /= codePointRangeLength;
            } while (value * codePointRangeLength >= codePointRangeLength);
            return string;
        };
        var createCounterStyleFromRange = function (value, codePointRangeStart, codePointRangeEnd, isNumeric, suffix) {
            var codePointRangeLength = codePointRangeEnd - codePointRangeStart + 1;
            return ((value < 0 ? '-' : '') +
                (createCounterStyleWithSymbolResolver(Math.abs(value), codePointRangeLength, isNumeric, function (codePoint) {
                    return fromCodePoint$1(Math.floor(codePoint % codePointRangeLength) + codePointRangeStart);
                }) +
                    suffix));
        };
        var createCounterStyleFromSymbols = function (value, symbols, suffix) {
            if (suffix === void 0) { suffix = '. '; }
            var codePointRangeLength = symbols.length;
            return (createCounterStyleWithSymbolResolver(Math.abs(value), codePointRangeLength, false, function (codePoint) { return symbols[Math.floor(codePoint % codePointRangeLength)]; }) + suffix);
        };
        var CJK_ZEROS = 1 << 0;
        var CJK_TEN_COEFFICIENTS = 1 << 1;
        var CJK_TEN_HIGH_COEFFICIENTS = 1 << 2;
        var CJK_HUNDRED_COEFFICIENTS = 1 << 3;
        var createCJKCounter = function (value, numbers, multipliers, negativeSign, suffix, flags) {
            if (value < -9999 || value > 9999) {
                return createCounterText(value, 4 /* CJK_DECIMAL */, suffix.length > 0);
            }
            var tmp = Math.abs(value);
            var string = suffix;
            if (tmp === 0) {
                return numbers[0] + string;
            }
            for (var digit = 0; tmp > 0 && digit <= 4; digit++) {
                var coefficient = tmp % 10;
                if (coefficient === 0 && contains(flags, CJK_ZEROS) && string !== '') {
                    string = numbers[coefficient] + string;
                }
                else if (coefficient > 1 ||
                    (coefficient === 1 && digit === 0) ||
                    (coefficient === 1 && digit === 1 && contains(flags, CJK_TEN_COEFFICIENTS)) ||
                    (coefficient === 1 && digit === 1 && contains(flags, CJK_TEN_HIGH_COEFFICIENTS) && value > 100) ||
                    (coefficient === 1 && digit > 1 && contains(flags, CJK_HUNDRED_COEFFICIENTS))) {
                    string = numbers[coefficient] + (digit > 0 ? multipliers[digit - 1] : '') + string;
                }
                else if (coefficient === 1 && digit > 0) {
                    string = multipliers[digit - 1] + string;
                }
                tmp = Math.floor(tmp / 10);
            }
            return (value < 0 ? negativeSign : '') + string;
        };
        var CHINESE_INFORMAL_MULTIPLIERS = '十百千萬';
        var CHINESE_FORMAL_MULTIPLIERS = '拾佰仟萬';
        var JAPANESE_NEGATIVE = 'マイナス';
        var KOREAN_NEGATIVE = '마이너스';
        var createCounterText = function (value, type, appendSuffix) {
            var defaultSuffix = appendSuffix ? '. ' : '';
            var cjkSuffix = appendSuffix ? '、' : '';
            var koreanSuffix = appendSuffix ? ', ' : '';
            var spaceSuffix = appendSuffix ? ' ' : '';
            switch (type) {
                case 0 /* DISC */:
                    return '•' + spaceSuffix;
                case 1 /* CIRCLE */:
                    return '◦' + spaceSuffix;
                case 2 /* SQUARE */:
                    return '◾' + spaceSuffix;
                case 5 /* DECIMAL_LEADING_ZERO */:
                    var string = createCounterStyleFromRange(value, 48, 57, true, defaultSuffix);
                    return string.length < 4 ? "0" + string : string;
                case 4 /* CJK_DECIMAL */:
                    return createCounterStyleFromSymbols(value, '〇一二三四五六七八九', cjkSuffix);
                case 6 /* LOWER_ROMAN */:
                    return createAdditiveCounter(value, 1, 3999, ROMAN_UPPER, 3 /* DECIMAL */, defaultSuffix).toLowerCase();
                case 7 /* UPPER_ROMAN */:
                    return createAdditiveCounter(value, 1, 3999, ROMAN_UPPER, 3 /* DECIMAL */, defaultSuffix);
                case 8 /* LOWER_GREEK */:
                    return createCounterStyleFromRange(value, 945, 969, false, defaultSuffix);
                case 9 /* LOWER_ALPHA */:
                    return createCounterStyleFromRange(value, 97, 122, false, defaultSuffix);
                case 10 /* UPPER_ALPHA */:
                    return createCounterStyleFromRange(value, 65, 90, false, defaultSuffix);
                case 11 /* ARABIC_INDIC */:
                    return createCounterStyleFromRange(value, 1632, 1641, true, defaultSuffix);
                case 12 /* ARMENIAN */:
                case 49 /* UPPER_ARMENIAN */:
                    return createAdditiveCounter(value, 1, 9999, ARMENIAN, 3 /* DECIMAL */, defaultSuffix);
                case 35 /* LOWER_ARMENIAN */:
                    return createAdditiveCounter(value, 1, 9999, ARMENIAN, 3 /* DECIMAL */, defaultSuffix).toLowerCase();
                case 13 /* BENGALI */:
                    return createCounterStyleFromRange(value, 2534, 2543, true, defaultSuffix);
                case 14 /* CAMBODIAN */:
                case 30 /* KHMER */:
                    return createCounterStyleFromRange(value, 6112, 6121, true, defaultSuffix);
                case 15 /* CJK_EARTHLY_BRANCH */:
                    return createCounterStyleFromSymbols(value, '子丑寅卯辰巳午未申酉戌亥', cjkSuffix);
                case 16 /* CJK_HEAVENLY_STEM */:
                    return createCounterStyleFromSymbols(value, '甲乙丙丁戊己庚辛壬癸', cjkSuffix);
                case 17 /* CJK_IDEOGRAPHIC */:
                case 48 /* TRAD_CHINESE_INFORMAL */:
                    return createCJKCounter(value, '零一二三四五六七八九', CHINESE_INFORMAL_MULTIPLIERS, '負', cjkSuffix, CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case 47 /* TRAD_CHINESE_FORMAL */:
                    return createCJKCounter(value, '零壹貳參肆伍陸柒捌玖', CHINESE_FORMAL_MULTIPLIERS, '負', cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case 42 /* SIMP_CHINESE_INFORMAL */:
                    return createCJKCounter(value, '零一二三四五六七八九', CHINESE_INFORMAL_MULTIPLIERS, '负', cjkSuffix, CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case 41 /* SIMP_CHINESE_FORMAL */:
                    return createCJKCounter(value, '零壹贰叁肆伍陆柒捌玖', CHINESE_FORMAL_MULTIPLIERS, '负', cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS | CJK_HUNDRED_COEFFICIENTS);
                case 26 /* JAPANESE_INFORMAL */:
                    return createCJKCounter(value, '〇一二三四五六七八九', '十百千万', JAPANESE_NEGATIVE, cjkSuffix, 0);
                case 25 /* JAPANESE_FORMAL */:
                    return createCJKCounter(value, '零壱弐参四伍六七八九', '拾百千万', JAPANESE_NEGATIVE, cjkSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
                case 31 /* KOREAN_HANGUL_FORMAL */:
                    return createCJKCounter(value, '영일이삼사오육칠팔구', '십백천만', KOREAN_NEGATIVE, koreanSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
                case 33 /* KOREAN_HANJA_INFORMAL */:
                    return createCJKCounter(value, '零一二三四五六七八九', '十百千萬', KOREAN_NEGATIVE, koreanSuffix, 0);
                case 32 /* KOREAN_HANJA_FORMAL */:
                    return createCJKCounter(value, '零壹貳參四五六七八九', '拾百千', KOREAN_NEGATIVE, koreanSuffix, CJK_ZEROS | CJK_TEN_COEFFICIENTS | CJK_TEN_HIGH_COEFFICIENTS);
                case 18 /* DEVANAGARI */:
                    return createCounterStyleFromRange(value, 0x966, 0x96f, true, defaultSuffix);
                case 20 /* GEORGIAN */:
                    return createAdditiveCounter(value, 1, 19999, GEORGIAN, 3 /* DECIMAL */, defaultSuffix);
                case 21 /* GUJARATI */:
                    return createCounterStyleFromRange(value, 0xae6, 0xaef, true, defaultSuffix);
                case 22 /* GURMUKHI */:
                    return createCounterStyleFromRange(value, 0xa66, 0xa6f, true, defaultSuffix);
                case 22 /* HEBREW */:
                    return createAdditiveCounter(value, 1, 10999, HEBREW, 3 /* DECIMAL */, defaultSuffix);
                case 23 /* HIRAGANA */:
                    return createCounterStyleFromSymbols(value, 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわゐゑをん');
                case 24 /* HIRAGANA_IROHA */:
                    return createCounterStyleFromSymbols(value, 'いろはにほへとちりぬるをわかよたれそつねならむうゐのおくやまけふこえてあさきゆめみしゑひもせす');
                case 27 /* KANNADA */:
                    return createCounterStyleFromRange(value, 0xce6, 0xcef, true, defaultSuffix);
                case 28 /* KATAKANA */:
                    return createCounterStyleFromSymbols(value, 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヰヱヲン', cjkSuffix);
                case 29 /* KATAKANA_IROHA */:
                    return createCounterStyleFromSymbols(value, 'イロハニホヘトチリヌルヲワカヨタレソツネナラムウヰノオクヤマケフコエテアサキユメミシヱヒモセス', cjkSuffix);
                case 34 /* LAO */:
                    return createCounterStyleFromRange(value, 0xed0, 0xed9, true, defaultSuffix);
                case 37 /* MONGOLIAN */:
                    return createCounterStyleFromRange(value, 0x1810, 0x1819, true, defaultSuffix);
                case 38 /* MYANMAR */:
                    return createCounterStyleFromRange(value, 0x1040, 0x1049, true, defaultSuffix);
                case 39 /* ORIYA */:
                    return createCounterStyleFromRange(value, 0xb66, 0xb6f, true, defaultSuffix);
                case 40 /* PERSIAN */:
                    return createCounterStyleFromRange(value, 0x6f0, 0x6f9, true, defaultSuffix);
                case 43 /* TAMIL */:
                    return createCounterStyleFromRange(value, 0xbe6, 0xbef, true, defaultSuffix);
                case 44 /* TELUGU */:
                    return createCounterStyleFromRange(value, 0xc66, 0xc6f, true, defaultSuffix);
                case 45 /* THAI */:
                    return createCounterStyleFromRange(value, 0xe50, 0xe59, true, defaultSuffix);
                case 46 /* TIBETAN */:
                    return createCounterStyleFromRange(value, 0xf20, 0xf29, true, defaultSuffix);
                case 3 /* DECIMAL */:
                default:
                    return createCounterStyleFromRange(value, 48, 57, true, defaultSuffix);
            }
        };

        var IGNORE_ATTRIBUTE = 'data-html2canvas-ignore';
        var DocumentCloner = /** @class */ (function () {
            function DocumentCloner(context, element, options) {
                this.context = context;
                this.options = options;
                this.scrolledElements = [];
                this.referenceElement = element;
                this.counters = new CounterState();
                this.quoteDepth = 0;
                if (!element.ownerDocument) {
                    throw new Error('Cloned element does not have an owner document');
                }
                this.documentElement = this.cloneNode(element.ownerDocument.documentElement, false);
            }
            DocumentCloner.prototype.toIFrame = function (ownerDocument, windowSize) {
                var _this = this;
                var iframe = createIFrameContainer(ownerDocument, windowSize);
                if (!iframe.contentWindow) {
                    return Promise.reject("Unable to find iframe window");
                }
                var scrollX = ownerDocument.defaultView.pageXOffset;
                var scrollY = ownerDocument.defaultView.pageYOffset;
                var cloneWindow = iframe.contentWindow;
                var documentClone = cloneWindow.document;
                /* Chrome doesn't detect relative background-images assigned in inline <style> sheets when fetched through getComputedStyle
                 if window url is about:blank, we can assign the url to current by writing onto the document
                 */
                var iframeLoad = iframeLoader(iframe).then(function () { return __awaiter(_this, void 0, void 0, function () {
                    var onclone, referenceElement;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                this.scrolledElements.forEach(restoreNodeScroll);
                                if (cloneWindow) {
                                    cloneWindow.scrollTo(windowSize.left, windowSize.top);
                                    if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent) &&
                                        (cloneWindow.scrollY !== windowSize.top || cloneWindow.scrollX !== windowSize.left)) {
                                        this.context.logger.warn('Unable to restore scroll position for cloned document');
                                        this.context.windowBounds = this.context.windowBounds.add(cloneWindow.scrollX - windowSize.left, cloneWindow.scrollY - windowSize.top, 0, 0);
                                    }
                                }
                                onclone = this.options.onclone;
                                referenceElement = this.clonedReferenceElement;
                                if (typeof referenceElement === 'undefined') {
                                    return [2 /*return*/, Promise.reject("Error finding the " + this.referenceElement.nodeName + " in the cloned document")];
                                }
                                if (!(documentClone.fonts && documentClone.fonts.ready)) return [3 /*break*/, 2];
                                return [4 /*yield*/, documentClone.fonts.ready];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2:
                                if (!/(AppleWebKit)/g.test(navigator.userAgent)) return [3 /*break*/, 4];
                                return [4 /*yield*/, imagesReady(documentClone)];
                            case 3:
                                _a.sent();
                                _a.label = 4;
                            case 4:
                                if (typeof onclone === 'function') {
                                    return [2 /*return*/, Promise.resolve()
                                            .then(function () { return onclone(documentClone, referenceElement); })
                                            .then(function () { return iframe; })];
                                }
                                return [2 /*return*/, iframe];
                        }
                    });
                }); });
                documentClone.open();
                documentClone.write(serializeDoctype(document.doctype) + "<html></html>");
                // Chrome scrolls the parent document for some reason after the write to the cloned window???
                restoreOwnerScroll(this.referenceElement.ownerDocument, scrollX, scrollY);
                documentClone.replaceChild(documentClone.adoptNode(this.documentElement), documentClone.documentElement);
                documentClone.close();
                return iframeLoad;
            };
            DocumentCloner.prototype.createElementClone = function (node) {
                if (isDebugging(node, 2 /* CLONE */)) {
                    debugger;
                }
                if (isCanvasElement(node)) {
                    return this.createCanvasClone(node);
                }
                if (isVideoElement(node)) {
                    return this.createVideoClone(node);
                }
                if (isStyleElement(node)) {
                    return this.createStyleClone(node);
                }
                var clone = node.cloneNode(false);
                if (isImageElement(clone)) {
                    if (isImageElement(node) && node.currentSrc && node.currentSrc !== node.src) {
                        clone.src = node.currentSrc;
                        clone.srcset = '';
                    }
                    if (clone.loading === 'lazy') {
                        clone.loading = 'eager';
                    }
                }
                if (isCustomElement(clone)) {
                    return this.createCustomElementClone(clone);
                }
                return clone;
            };
            DocumentCloner.prototype.createCustomElementClone = function (node) {
                var clone = document.createElement('html2canvascustomelement');
                copyCSSStyles(node.style, clone);
                return clone;
            };
            DocumentCloner.prototype.createStyleClone = function (node) {
                try {
                    var sheet = node.sheet;
                    if (sheet && sheet.cssRules) {
                        var css = [].slice.call(sheet.cssRules, 0).reduce(function (css, rule) {
                            if (rule && typeof rule.cssText === 'string') {
                                return css + rule.cssText;
                            }
                            return css;
                        }, '');
                        var style = node.cloneNode(false);
                        style.textContent = css;
                        return style;
                    }
                }
                catch (e) {
                    // accessing node.sheet.cssRules throws a DOMException
                    this.context.logger.error('Unable to access cssRules property', e);
                    if (e.name !== 'SecurityError') {
                        throw e;
                    }
                }
                return node.cloneNode(false);
            };
            DocumentCloner.prototype.createCanvasClone = function (canvas) {
                var _a;
                if (this.options.inlineImages && canvas.ownerDocument) {
                    var img = canvas.ownerDocument.createElement('img');
                    try {
                        img.src = canvas.toDataURL();
                        return img;
                    }
                    catch (e) {
                        this.context.logger.info("Unable to inline canvas contents, canvas is tainted", canvas);
                    }
                }
                var clonedCanvas = canvas.cloneNode(false);
                try {
                    clonedCanvas.width = canvas.width;
                    clonedCanvas.height = canvas.height;
                    var ctx = canvas.getContext('2d');
                    var clonedCtx = clonedCanvas.getContext('2d');
                    if (clonedCtx) {
                        if (!this.options.allowTaint && ctx) {
                            clonedCtx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
                        }
                        else {
                            var gl = (_a = canvas.getContext('webgl2')) !== null && _a !== void 0 ? _a : canvas.getContext('webgl');
                            if (gl) {
                                var attribs = gl.getContextAttributes();
                                if ((attribs === null || attribs === void 0 ? void 0 : attribs.preserveDrawingBuffer) === false) {
                                    this.context.logger.warn('Unable to clone WebGL context as it has preserveDrawingBuffer=false', canvas);
                                }
                            }
                            clonedCtx.drawImage(canvas, 0, 0);
                        }
                    }
                    return clonedCanvas;
                }
                catch (e) {
                    this.context.logger.info("Unable to clone canvas as it is tainted", canvas);
                }
                return clonedCanvas;
            };
            DocumentCloner.prototype.createVideoClone = function (video) {
                var canvas = video.ownerDocument.createElement('canvas');
                canvas.width = video.offsetWidth;
                canvas.height = video.offsetHeight;
                var ctx = canvas.getContext('2d');
                try {
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        if (!this.options.allowTaint) {
                            ctx.getImageData(0, 0, canvas.width, canvas.height);
                        }
                    }
                    return canvas;
                }
                catch (e) {
                    this.context.logger.info("Unable to clone video as it is tainted", video);
                }
                var blankCanvas = video.ownerDocument.createElement('canvas');
                blankCanvas.width = video.offsetWidth;
                blankCanvas.height = video.offsetHeight;
                return blankCanvas;
            };
            DocumentCloner.prototype.appendChildNode = function (clone, child, copyStyles) {
                if (!isElementNode(child) ||
                    (!isScriptElement(child) &&
                        !child.hasAttribute(IGNORE_ATTRIBUTE) &&
                        (typeof this.options.ignoreElements !== 'function' || !this.options.ignoreElements(child)))) {
                    if (!this.options.copyStyles || !isElementNode(child) || !isStyleElement(child)) {
                        clone.appendChild(this.cloneNode(child, copyStyles));
                    }
                }
            };
            DocumentCloner.prototype.cloneChildNodes = function (node, clone, copyStyles) {
                var _this = this;
                for (var child = node.shadowRoot ? node.shadowRoot.firstChild : node.firstChild; child; child = child.nextSibling) {
                    if (isElementNode(child) && isSlotElement(child) && typeof child.assignedNodes === 'function') {
                        var assignedNodes = child.assignedNodes();
                        if (assignedNodes.length) {
                            assignedNodes.forEach(function (assignedNode) { return _this.appendChildNode(clone, assignedNode, copyStyles); });
                        }
                    }
                    else {
                        this.appendChildNode(clone, child, copyStyles);
                    }
                }
            };
            DocumentCloner.prototype.cloneNode = function (node, copyStyles) {
                if (isTextNode(node)) {
                    return document.createTextNode(node.data);
                }
                if (!node.ownerDocument) {
                    return node.cloneNode(false);
                }
                var window = node.ownerDocument.defaultView;
                if (window && isElementNode(node) && (isHTMLElementNode(node) || isSVGElementNode(node))) {
                    var clone = this.createElementClone(node);
                    clone.style.transitionProperty = 'none';
                    var style = window.getComputedStyle(node);
                    var styleBefore = window.getComputedStyle(node, ':before');
                    var styleAfter = window.getComputedStyle(node, ':after');
                    if (this.referenceElement === node && isHTMLElementNode(clone)) {
                        this.clonedReferenceElement = clone;
                    }
                    if (isBodyElement(clone)) {
                        createPseudoHideStyles(clone);
                    }
                    var counters = this.counters.parse(new CSSParsedCounterDeclaration(this.context, style));
                    var before = this.resolvePseudoContent(node, clone, styleBefore, PseudoElementType.BEFORE);
                    if (isCustomElement(node)) {
                        copyStyles = true;
                    }
                    if (!isVideoElement(node)) {
                        this.cloneChildNodes(node, clone, copyStyles);
                    }
                    if (before) {
                        clone.insertBefore(before, clone.firstChild);
                    }
                    var after = this.resolvePseudoContent(node, clone, styleAfter, PseudoElementType.AFTER);
                    if (after) {
                        clone.appendChild(after);
                    }
                    this.counters.pop(counters);
                    if ((style && (this.options.copyStyles || isSVGElementNode(node)) && !isIFrameElement(node)) ||
                        copyStyles) {
                        copyCSSStyles(style, clone);
                    }
                    if (node.scrollTop !== 0 || node.scrollLeft !== 0) {
                        this.scrolledElements.push([clone, node.scrollLeft, node.scrollTop]);
                    }
                    if ((isTextareaElement(node) || isSelectElement(node)) &&
                        (isTextareaElement(clone) || isSelectElement(clone))) {
                        clone.value = node.value;
                    }
                    return clone;
                }
                return node.cloneNode(false);
            };
            DocumentCloner.prototype.resolvePseudoContent = function (node, clone, style, pseudoElt) {
                var _this = this;
                if (!style) {
                    return;
                }
                var value = style.content;
                var document = clone.ownerDocument;
                if (!document || !value || value === 'none' || value === '-moz-alt-content' || style.display === 'none') {
                    return;
                }
                this.counters.parse(new CSSParsedCounterDeclaration(this.context, style));
                var declaration = new CSSParsedPseudoDeclaration(this.context, style);
                var anonymousReplacedElement = document.createElement('html2canvaspseudoelement');
                copyCSSStyles(style, anonymousReplacedElement);
                declaration.content.forEach(function (token) {
                    if (token.type === 0 /* STRING_TOKEN */) {
                        anonymousReplacedElement.appendChild(document.createTextNode(token.value));
                    }
                    else if (token.type === 22 /* URL_TOKEN */) {
                        var img = document.createElement('img');
                        img.src = token.value;
                        img.style.opacity = '1';
                        anonymousReplacedElement.appendChild(img);
                    }
                    else if (token.type === 18 /* FUNCTION */) {
                        if (token.name === 'attr') {
                            var attr = token.values.filter(isIdentToken);
                            if (attr.length) {
                                anonymousReplacedElement.appendChild(document.createTextNode(node.getAttribute(attr[0].value) || ''));
                            }
                        }
                        else if (token.name === 'counter') {
                            var _a = token.values.filter(nonFunctionArgSeparator), counter = _a[0], counterStyle = _a[1];
                            if (counter && isIdentToken(counter)) {
                                var counterState = _this.counters.getCounterValue(counter.value);
                                var counterType = counterStyle && isIdentToken(counterStyle)
                                    ? listStyleType.parse(_this.context, counterStyle.value)
                                    : 3 /* DECIMAL */;
                                anonymousReplacedElement.appendChild(document.createTextNode(createCounterText(counterState, counterType, false)));
                            }
                        }
                        else if (token.name === 'counters') {
                            var _b = token.values.filter(nonFunctionArgSeparator), counter = _b[0], delim = _b[1], counterStyle = _b[2];
                            if (counter && isIdentToken(counter)) {
                                var counterStates = _this.counters.getCounterValues(counter.value);
                                var counterType_1 = counterStyle && isIdentToken(counterStyle)
                                    ? listStyleType.parse(_this.context, counterStyle.value)
                                    : 3 /* DECIMAL */;
                                var separator = delim && delim.type === 0 /* STRING_TOKEN */ ? delim.value : '';
                                var text = counterStates
                                    .map(function (value) { return createCounterText(value, counterType_1, false); })
                                    .join(separator);
                                anonymousReplacedElement.appendChild(document.createTextNode(text));
                            }
                        }
                        else ;
                    }
                    else if (token.type === 20 /* IDENT_TOKEN */) {
                        switch (token.value) {
                            case 'open-quote':
                                anonymousReplacedElement.appendChild(document.createTextNode(getQuote(declaration.quotes, _this.quoteDepth++, true)));
                                break;
                            case 'close-quote':
                                anonymousReplacedElement.appendChild(document.createTextNode(getQuote(declaration.quotes, --_this.quoteDepth, false)));
                                break;
                            default:
                                // safari doesn't parse string tokens correctly because of lack of quotes
                                anonymousReplacedElement.appendChild(document.createTextNode(token.value));
                        }
                    }
                });
                anonymousReplacedElement.className = PSEUDO_HIDE_ELEMENT_CLASS_BEFORE + " " + PSEUDO_HIDE_ELEMENT_CLASS_AFTER;
                var newClassName = pseudoElt === PseudoElementType.BEFORE
                    ? " " + PSEUDO_HIDE_ELEMENT_CLASS_BEFORE
                    : " " + PSEUDO_HIDE_ELEMENT_CLASS_AFTER;
                if (isSVGElementNode(clone)) {
                    clone.className.baseValue += newClassName;
                }
                else {
                    clone.className += newClassName;
                }
                return anonymousReplacedElement;
            };
            DocumentCloner.destroy = function (container) {
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                    return true;
                }
                return false;
            };
            return DocumentCloner;
        }());
        var PseudoElementType;
        (function (PseudoElementType) {
            PseudoElementType[PseudoElementType["BEFORE"] = 0] = "BEFORE";
            PseudoElementType[PseudoElementType["AFTER"] = 1] = "AFTER";
        })(PseudoElementType || (PseudoElementType = {}));
        var createIFrameContainer = function (ownerDocument, bounds) {
            var cloneIframeContainer = ownerDocument.createElement('iframe');
            cloneIframeContainer.className = 'html2canvas-container';
            cloneIframeContainer.style.visibility = 'hidden';
            cloneIframeContainer.style.position = 'fixed';
            cloneIframeContainer.style.left = '-10000px';
            cloneIframeContainer.style.top = '0px';
            cloneIframeContainer.style.border = '0';
            cloneIframeContainer.width = bounds.width.toString();
            cloneIframeContainer.height = bounds.height.toString();
            cloneIframeContainer.scrolling = 'no'; // ios won't scroll without it
            cloneIframeContainer.setAttribute(IGNORE_ATTRIBUTE, 'true');
            ownerDocument.body.appendChild(cloneIframeContainer);
            return cloneIframeContainer;
        };
        var imageReady = function (img) {
            return new Promise(function (resolve) {
                if (img.complete) {
                    resolve();
                    return;
                }
                if (!img.src) {
                    resolve();
                    return;
                }
                img.onload = resolve;
                img.onerror = resolve;
            });
        };
        var imagesReady = function (document) {
            return Promise.all([].slice.call(document.images, 0).map(imageReady));
        };
        var iframeLoader = function (iframe) {
            return new Promise(function (resolve, reject) {
                var cloneWindow = iframe.contentWindow;
                if (!cloneWindow) {
                    return reject("No window assigned for iframe");
                }
                var documentClone = cloneWindow.document;
                cloneWindow.onload = iframe.onload = function () {
                    cloneWindow.onload = iframe.onload = null;
                    var interval = setInterval(function () {
                        if (documentClone.body.childNodes.length > 0 && documentClone.readyState === 'complete') {
                            clearInterval(interval);
                            resolve(iframe);
                        }
                    }, 50);
                };
            });
        };
        var ignoredStyleProperties = [
            'all',
            'd',
            'content' // Safari shows pseudoelements if content is set
        ];
        var copyCSSStyles = function (style, target) {
            // Edge does not provide value for cssText
            for (var i = style.length - 1; i >= 0; i--) {
                var property = style.item(i);
                if (ignoredStyleProperties.indexOf(property) === -1) {
                    target.style.setProperty(property, style.getPropertyValue(property));
                }
            }
            return target;
        };
        var serializeDoctype = function (doctype) {
            var str = '';
            if (doctype) {
                str += '<!DOCTYPE ';
                if (doctype.name) {
                    str += doctype.name;
                }
                if (doctype.internalSubset) {
                    str += doctype.internalSubset;
                }
                if (doctype.publicId) {
                    str += "\"" + doctype.publicId + "\"";
                }
                if (doctype.systemId) {
                    str += "\"" + doctype.systemId + "\"";
                }
                str += '>';
            }
            return str;
        };
        var restoreOwnerScroll = function (ownerDocument, x, y) {
            if (ownerDocument &&
                ownerDocument.defaultView &&
                (x !== ownerDocument.defaultView.pageXOffset || y !== ownerDocument.defaultView.pageYOffset)) {
                ownerDocument.defaultView.scrollTo(x, y);
            }
        };
        var restoreNodeScroll = function (_a) {
            var element = _a[0], x = _a[1], y = _a[2];
            element.scrollLeft = x;
            element.scrollTop = y;
        };
        var PSEUDO_BEFORE = ':before';
        var PSEUDO_AFTER = ':after';
        var PSEUDO_HIDE_ELEMENT_CLASS_BEFORE = '___html2canvas___pseudoelement_before';
        var PSEUDO_HIDE_ELEMENT_CLASS_AFTER = '___html2canvas___pseudoelement_after';
        var PSEUDO_HIDE_ELEMENT_STYLE = "{\n    content: \"\" !important;\n    display: none !important;\n}";
        var createPseudoHideStyles = function (body) {
            createStyles(body, "." + PSEUDO_HIDE_ELEMENT_CLASS_BEFORE + PSEUDO_BEFORE + PSEUDO_HIDE_ELEMENT_STYLE + "\n         ." + PSEUDO_HIDE_ELEMENT_CLASS_AFTER + PSEUDO_AFTER + PSEUDO_HIDE_ELEMENT_STYLE);
        };
        var createStyles = function (body, styles) {
            var document = body.ownerDocument;
            if (document) {
                var style = document.createElement('style');
                style.textContent = styles;
                body.appendChild(style);
            }
        };

        var CacheStorage = /** @class */ (function () {
            function CacheStorage() {
            }
            CacheStorage.getOrigin = function (url) {
                var link = CacheStorage._link;
                if (!link) {
                    return 'about:blank';
                }
                link.href = url;
                link.href = link.href; // IE9, LOL! - http://jsfiddle.net/niklasvh/2e48b/
                return link.protocol + link.hostname + link.port;
            };
            CacheStorage.isSameOrigin = function (src) {
                return CacheStorage.getOrigin(src) === CacheStorage._origin;
            };
            CacheStorage.setContext = function (window) {
                CacheStorage._link = window.document.createElement('a');
                CacheStorage._origin = CacheStorage.getOrigin(window.location.href);
            };
            CacheStorage._origin = 'about:blank';
            return CacheStorage;
        }());
        var Cache = /** @class */ (function () {
            function Cache(context, _options) {
                this.context = context;
                this._options = _options;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._cache = {};
            }
            Cache.prototype.addImage = function (src) {
                var result = Promise.resolve();
                if (this.has(src)) {
                    return result;
                }
                if (isBlobImage(src) || isRenderable(src)) {
                    (this._cache[src] = this.loadImage(src)).catch(function () {
                        // prevent unhandled rejection
                    });
                    return result;
                }
                return result;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Cache.prototype.match = function (src) {
                return this._cache[src];
            };
            Cache.prototype.loadImage = function (key) {
                return __awaiter(this, void 0, void 0, function () {
                    var isSameOrigin, useCORS, useProxy, src;
                    var _this = this;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                isSameOrigin = CacheStorage.isSameOrigin(key);
                                useCORS = !isInlineImage(key) && this._options.useCORS === true && FEATURES.SUPPORT_CORS_IMAGES && !isSameOrigin;
                                useProxy = !isInlineImage(key) &&
                                    !isSameOrigin &&
                                    !isBlobImage(key) &&
                                    typeof this._options.proxy === 'string' &&
                                    FEATURES.SUPPORT_CORS_XHR &&
                                    !useCORS;
                                if (!isSameOrigin &&
                                    this._options.allowTaint === false &&
                                    !isInlineImage(key) &&
                                    !isBlobImage(key) &&
                                    !useProxy &&
                                    !useCORS) {
                                    return [2 /*return*/];
                                }
                                src = key;
                                if (!useProxy) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.proxy(src)];
                            case 1:
                                src = _a.sent();
                                _a.label = 2;
                            case 2:
                                this.context.logger.debug("Added image " + key.substring(0, 256));
                                return [4 /*yield*/, new Promise(function (resolve, reject) {
                                        var img = new Image();
                                        img.onload = function () { return resolve(img); };
                                        img.onerror = reject;
                                        //ios safari 10.3 taints canvas with data urls unless crossOrigin is set to anonymous
                                        if (isInlineBase64Image(src) || useCORS) {
                                            img.crossOrigin = 'anonymous';
                                        }
                                        img.src = src;
                                        if (img.complete === true) {
                                            // Inline XML images may fail to parse, throwing an Error later on
                                            setTimeout(function () { return resolve(img); }, 500);
                                        }
                                        if (_this._options.imageTimeout > 0) {
                                            setTimeout(function () { return reject("Timed out (" + _this._options.imageTimeout + "ms) loading image"); }, _this._options.imageTimeout);
                                        }
                                    })];
                            case 3: return [2 /*return*/, _a.sent()];
                        }
                    });
                });
            };
            Cache.prototype.has = function (key) {
                return typeof this._cache[key] !== 'undefined';
            };
            Cache.prototype.keys = function () {
                return Promise.resolve(Object.keys(this._cache));
            };
            Cache.prototype.proxy = function (src) {
                var _this = this;
                var proxy = this._options.proxy;
                if (!proxy) {
                    throw new Error('No proxy defined');
                }
                var key = src.substring(0, 256);
                return new Promise(function (resolve, reject) {
                    var responseType = FEATURES.SUPPORT_RESPONSE_TYPE ? 'blob' : 'text';
                    var xhr = new XMLHttpRequest();
                    xhr.onload = function () {
                        if (xhr.status === 200) {
                            if (responseType === 'text') {
                                resolve(xhr.response);
                            }
                            else {
                                var reader_1 = new FileReader();
                                reader_1.addEventListener('load', function () { return resolve(reader_1.result); }, false);
                                reader_1.addEventListener('error', function (e) { return reject(e); }, false);
                                reader_1.readAsDataURL(xhr.response);
                            }
                        }
                        else {
                            reject("Failed to proxy resource " + key + " with status code " + xhr.status);
                        }
                    };
                    xhr.onerror = reject;
                    var queryString = proxy.indexOf('?') > -1 ? '&' : '?';
                    xhr.open('GET', "" + proxy + queryString + "url=" + encodeURIComponent(src) + "&responseType=" + responseType);
                    if (responseType !== 'text' && xhr instanceof XMLHttpRequest) {
                        xhr.responseType = responseType;
                    }
                    if (_this._options.imageTimeout) {
                        var timeout_1 = _this._options.imageTimeout;
                        xhr.timeout = timeout_1;
                        xhr.ontimeout = function () { return reject("Timed out (" + timeout_1 + "ms) proxying " + key); };
                    }
                    xhr.send();
                });
            };
            return Cache;
        }());
        var INLINE_SVG = /^data:image\/svg\+xml/i;
        var INLINE_BASE64 = /^data:image\/.*;base64,/i;
        var INLINE_IMG = /^data:image\/.*/i;
        var isRenderable = function (src) { return FEATURES.SUPPORT_SVG_DRAWING || !isSVG(src); };
        var isInlineImage = function (src) { return INLINE_IMG.test(src); };
        var isInlineBase64Image = function (src) { return INLINE_BASE64.test(src); };
        var isBlobImage = function (src) { return src.substr(0, 4) === 'blob'; };
        var isSVG = function (src) { return src.substr(-3).toLowerCase() === 'svg' || INLINE_SVG.test(src); };

        var Vector = /** @class */ (function () {
            function Vector(x, y) {
                this.type = 0 /* VECTOR */;
                this.x = x;
                this.y = y;
            }
            Vector.prototype.add = function (deltaX, deltaY) {
                return new Vector(this.x + deltaX, this.y + deltaY);
            };
            return Vector;
        }());

        var lerp = function (a, b, t) {
            return new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        };
        var BezierCurve = /** @class */ (function () {
            function BezierCurve(start, startControl, endControl, end) {
                this.type = 1 /* BEZIER_CURVE */;
                this.start = start;
                this.startControl = startControl;
                this.endControl = endControl;
                this.end = end;
            }
            BezierCurve.prototype.subdivide = function (t, firstHalf) {
                var ab = lerp(this.start, this.startControl, t);
                var bc = lerp(this.startControl, this.endControl, t);
                var cd = lerp(this.endControl, this.end, t);
                var abbc = lerp(ab, bc, t);
                var bccd = lerp(bc, cd, t);
                var dest = lerp(abbc, bccd, t);
                return firstHalf ? new BezierCurve(this.start, ab, abbc, dest) : new BezierCurve(dest, bccd, cd, this.end);
            };
            BezierCurve.prototype.add = function (deltaX, deltaY) {
                return new BezierCurve(this.start.add(deltaX, deltaY), this.startControl.add(deltaX, deltaY), this.endControl.add(deltaX, deltaY), this.end.add(deltaX, deltaY));
            };
            BezierCurve.prototype.reverse = function () {
                return new BezierCurve(this.end, this.endControl, this.startControl, this.start);
            };
            return BezierCurve;
        }());
        var isBezierCurve = function (path) { return path.type === 1 /* BEZIER_CURVE */; };

        var BoundCurves = /** @class */ (function () {
            function BoundCurves(element) {
                var styles = element.styles;
                var bounds = element.bounds;
                var _a = getAbsoluteValueForTuple(styles.borderTopLeftRadius, bounds.width, bounds.height), tlh = _a[0], tlv = _a[1];
                var _b = getAbsoluteValueForTuple(styles.borderTopRightRadius, bounds.width, bounds.height), trh = _b[0], trv = _b[1];
                var _c = getAbsoluteValueForTuple(styles.borderBottomRightRadius, bounds.width, bounds.height), brh = _c[0], brv = _c[1];
                var _d = getAbsoluteValueForTuple(styles.borderBottomLeftRadius, bounds.width, bounds.height), blh = _d[0], blv = _d[1];
                var factors = [];
                factors.push((tlh + trh) / bounds.width);
                factors.push((blh + brh) / bounds.width);
                factors.push((tlv + blv) / bounds.height);
                factors.push((trv + brv) / bounds.height);
                var maxFactor = Math.max.apply(Math, factors);
                if (maxFactor > 1) {
                    tlh /= maxFactor;
                    tlv /= maxFactor;
                    trh /= maxFactor;
                    trv /= maxFactor;
                    brh /= maxFactor;
                    brv /= maxFactor;
                    blh /= maxFactor;
                    blv /= maxFactor;
                }
                var topWidth = bounds.width - trh;
                var rightHeight = bounds.height - brv;
                var bottomWidth = bounds.width - brh;
                var leftHeight = bounds.height - blv;
                var borderTopWidth = styles.borderTopWidth;
                var borderRightWidth = styles.borderRightWidth;
                var borderBottomWidth = styles.borderBottomWidth;
                var borderLeftWidth = styles.borderLeftWidth;
                var paddingTop = getAbsoluteValue(styles.paddingTop, element.bounds.width);
                var paddingRight = getAbsoluteValue(styles.paddingRight, element.bounds.width);
                var paddingBottom = getAbsoluteValue(styles.paddingBottom, element.bounds.width);
                var paddingLeft = getAbsoluteValue(styles.paddingLeft, element.bounds.width);
                this.topLeftBorderDoubleOuterBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 3, bounds.top + borderTopWidth / 3, tlh - borderLeftWidth / 3, tlv - borderTopWidth / 3, CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 3, bounds.top + borderTopWidth / 3);
                this.topRightBorderDoubleOuterBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top + borderTopWidth / 3, trh - borderRightWidth / 3, trv - borderTopWidth / 3, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 3, bounds.top + borderTopWidth / 3);
                this.bottomRightBorderDoubleOuterBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh - borderRightWidth / 3, brv - borderBottomWidth / 3, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 3, bounds.top + bounds.height - borderBottomWidth / 3);
                this.bottomLeftBorderDoubleOuterBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 3, bounds.top + leftHeight, blh - borderLeftWidth / 3, blv - borderBottomWidth / 3, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 3, bounds.top + bounds.height - borderBottomWidth / 3);
                this.topLeftBorderDoubleInnerBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + (borderTopWidth * 2) / 3, tlh - (borderLeftWidth * 2) / 3, tlv - (borderTopWidth * 2) / 3, CORNER.TOP_LEFT)
                        : new Vector(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + (borderTopWidth * 2) / 3);
                this.topRightBorderDoubleInnerBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top + (borderTopWidth * 2) / 3, trh - (borderRightWidth * 2) / 3, trv - (borderTopWidth * 2) / 3, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth * 2) / 3, bounds.top + (borderTopWidth * 2) / 3);
                this.bottomRightBorderDoubleInnerBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh - (borderRightWidth * 2) / 3, brv - (borderBottomWidth * 2) / 3, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth * 2) / 3, bounds.top + bounds.height - (borderBottomWidth * 2) / 3);
                this.bottomLeftBorderDoubleInnerBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + leftHeight, blh - (borderLeftWidth * 2) / 3, blv - (borderBottomWidth * 2) / 3, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + (borderLeftWidth * 2) / 3, bounds.top + bounds.height - (borderBottomWidth * 2) / 3);
                this.topLeftBorderStroke =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 2, bounds.top + borderTopWidth / 2, tlh - borderLeftWidth / 2, tlv - borderTopWidth / 2, CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 2, bounds.top + borderTopWidth / 2);
                this.topRightBorderStroke =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top + borderTopWidth / 2, trh - borderRightWidth / 2, trv - borderTopWidth / 2, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 2, bounds.top + borderTopWidth / 2);
                this.bottomRightBorderStroke =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh - borderRightWidth / 2, brv - borderBottomWidth / 2, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth / 2, bounds.top + bounds.height - borderBottomWidth / 2);
                this.bottomLeftBorderStroke =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth / 2, bounds.top + leftHeight, blh - borderLeftWidth / 2, blv - borderBottomWidth / 2, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth / 2, bounds.top + bounds.height - borderBottomWidth / 2);
                this.topLeftBorderBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left, bounds.top, tlh, tlv, CORNER.TOP_LEFT)
                        : new Vector(bounds.left, bounds.top);
                this.topRightBorderBox =
                    trh > 0 || trv > 0
                        ? getCurvePoints(bounds.left + topWidth, bounds.top, trh, trv, CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width, bounds.top);
                this.bottomRightBorderBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + bottomWidth, bounds.top + rightHeight, brh, brv, CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width, bounds.top + bounds.height);
                this.bottomLeftBorderBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left, bounds.top + leftHeight, blh, blv, CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left, bounds.top + bounds.height);
                this.topLeftPaddingBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth, bounds.top + borderTopWidth, Math.max(0, tlh - borderLeftWidth), Math.max(0, tlv - borderTopWidth), CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth, bounds.top + borderTopWidth);
                this.topRightPaddingBox =
                    trh > 0 || trv > 0
                        ? getCurvePoints(bounds.left + Math.min(topWidth, bounds.width - borderRightWidth), bounds.top + borderTopWidth, topWidth > bounds.width + borderRightWidth ? 0 : Math.max(0, trh - borderRightWidth), Math.max(0, trv - borderTopWidth), CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth, bounds.top + borderTopWidth);
                this.bottomRightPaddingBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + Math.min(bottomWidth, bounds.width - borderLeftWidth), bounds.top + Math.min(rightHeight, bounds.height - borderBottomWidth), Math.max(0, brh - borderRightWidth), Math.max(0, brv - borderBottomWidth), CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - borderRightWidth, bounds.top + bounds.height - borderBottomWidth);
                this.bottomLeftPaddingBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth, bounds.top + Math.min(leftHeight, bounds.height - borderBottomWidth), Math.max(0, blh - borderLeftWidth), Math.max(0, blv - borderBottomWidth), CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth, bounds.top + bounds.height - borderBottomWidth);
                this.topLeftContentBox =
                    tlh > 0 || tlv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth + paddingLeft, bounds.top + borderTopWidth + paddingTop, Math.max(0, tlh - (borderLeftWidth + paddingLeft)), Math.max(0, tlv - (borderTopWidth + paddingTop)), CORNER.TOP_LEFT)
                        : new Vector(bounds.left + borderLeftWidth + paddingLeft, bounds.top + borderTopWidth + paddingTop);
                this.topRightContentBox =
                    trh > 0 || trv > 0
                        ? getCurvePoints(bounds.left + Math.min(topWidth, bounds.width + borderLeftWidth + paddingLeft), bounds.top + borderTopWidth + paddingTop, topWidth > bounds.width + borderLeftWidth + paddingLeft ? 0 : trh - borderLeftWidth + paddingLeft, trv - (borderTopWidth + paddingTop), CORNER.TOP_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth + paddingRight), bounds.top + borderTopWidth + paddingTop);
                this.bottomRightContentBox =
                    brh > 0 || brv > 0
                        ? getCurvePoints(bounds.left + Math.min(bottomWidth, bounds.width - (borderLeftWidth + paddingLeft)), bounds.top + Math.min(rightHeight, bounds.height + borderTopWidth + paddingTop), Math.max(0, brh - (borderRightWidth + paddingRight)), brv - (borderBottomWidth + paddingBottom), CORNER.BOTTOM_RIGHT)
                        : new Vector(bounds.left + bounds.width - (borderRightWidth + paddingRight), bounds.top + bounds.height - (borderBottomWidth + paddingBottom));
                this.bottomLeftContentBox =
                    blh > 0 || blv > 0
                        ? getCurvePoints(bounds.left + borderLeftWidth + paddingLeft, bounds.top + leftHeight, Math.max(0, blh - (borderLeftWidth + paddingLeft)), blv - (borderBottomWidth + paddingBottom), CORNER.BOTTOM_LEFT)
                        : new Vector(bounds.left + borderLeftWidth + paddingLeft, bounds.top + bounds.height - (borderBottomWidth + paddingBottom));
            }
            return BoundCurves;
        }());
        var CORNER;
        (function (CORNER) {
            CORNER[CORNER["TOP_LEFT"] = 0] = "TOP_LEFT";
            CORNER[CORNER["TOP_RIGHT"] = 1] = "TOP_RIGHT";
            CORNER[CORNER["BOTTOM_RIGHT"] = 2] = "BOTTOM_RIGHT";
            CORNER[CORNER["BOTTOM_LEFT"] = 3] = "BOTTOM_LEFT";
        })(CORNER || (CORNER = {}));
        var getCurvePoints = function (x, y, r1, r2, position) {
            var kappa = 4 * ((Math.sqrt(2) - 1) / 3);
            var ox = r1 * kappa; // control point offset horizontal
            var oy = r2 * kappa; // control point offset vertical
            var xm = x + r1; // x-middle
            var ym = y + r2; // y-middle
            switch (position) {
                case CORNER.TOP_LEFT:
                    return new BezierCurve(new Vector(x, ym), new Vector(x, ym - oy), new Vector(xm - ox, y), new Vector(xm, y));
                case CORNER.TOP_RIGHT:
                    return new BezierCurve(new Vector(x, y), new Vector(x + ox, y), new Vector(xm, ym - oy), new Vector(xm, ym));
                case CORNER.BOTTOM_RIGHT:
                    return new BezierCurve(new Vector(xm, y), new Vector(xm, y + oy), new Vector(x + ox, ym), new Vector(x, ym));
                case CORNER.BOTTOM_LEFT:
                default:
                    return new BezierCurve(new Vector(xm, ym), new Vector(xm - ox, ym), new Vector(x, y + oy), new Vector(x, y));
            }
        };
        var calculateBorderBoxPath = function (curves) {
            return [curves.topLeftBorderBox, curves.topRightBorderBox, curves.bottomRightBorderBox, curves.bottomLeftBorderBox];
        };
        var calculateContentBoxPath = function (curves) {
            return [
                curves.topLeftContentBox,
                curves.topRightContentBox,
                curves.bottomRightContentBox,
                curves.bottomLeftContentBox
            ];
        };
        var calculatePaddingBoxPath = function (curves) {
            return [
                curves.topLeftPaddingBox,
                curves.topRightPaddingBox,
                curves.bottomRightPaddingBox,
                curves.bottomLeftPaddingBox
            ];
        };

        var TransformEffect = /** @class */ (function () {
            function TransformEffect(offsetX, offsetY, matrix) {
                this.offsetX = offsetX;
                this.offsetY = offsetY;
                this.matrix = matrix;
                this.type = 0 /* TRANSFORM */;
                this.target = 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */;
            }
            return TransformEffect;
        }());
        var ClipEffect = /** @class */ (function () {
            function ClipEffect(path, target) {
                this.path = path;
                this.target = target;
                this.type = 1 /* CLIP */;
            }
            return ClipEffect;
        }());
        var OpacityEffect = /** @class */ (function () {
            function OpacityEffect(opacity) {
                this.opacity = opacity;
                this.type = 2 /* OPACITY */;
                this.target = 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */;
            }
            return OpacityEffect;
        }());
        var isTransformEffect = function (effect) {
            return effect.type === 0 /* TRANSFORM */;
        };
        var isClipEffect = function (effect) { return effect.type === 1 /* CLIP */; };
        var isOpacityEffect = function (effect) { return effect.type === 2 /* OPACITY */; };

        var equalPath = function (a, b) {
            if (a.length === b.length) {
                return a.some(function (v, i) { return v === b[i]; });
            }
            return false;
        };
        var transformPath = function (path, deltaX, deltaY, deltaW, deltaH) {
            return path.map(function (point, index) {
                switch (index) {
                    case 0:
                        return point.add(deltaX, deltaY);
                    case 1:
                        return point.add(deltaX + deltaW, deltaY);
                    case 2:
                        return point.add(deltaX + deltaW, deltaY + deltaH);
                    case 3:
                        return point.add(deltaX, deltaY + deltaH);
                }
                return point;
            });
        };

        var StackingContext = /** @class */ (function () {
            function StackingContext(container) {
                this.element = container;
                this.inlineLevel = [];
                this.nonInlineLevel = [];
                this.negativeZIndex = [];
                this.zeroOrAutoZIndexOrTransformedOrOpacity = [];
                this.positiveZIndex = [];
                this.nonPositionedFloats = [];
                this.nonPositionedInlineLevel = [];
            }
            return StackingContext;
        }());
        var ElementPaint = /** @class */ (function () {
            function ElementPaint(container, parent) {
                this.container = container;
                this.parent = parent;
                this.effects = [];
                this.curves = new BoundCurves(this.container);
                if (this.container.styles.opacity < 1) {
                    this.effects.push(new OpacityEffect(this.container.styles.opacity));
                }
                if (this.container.styles.transform !== null) {
                    var offsetX = this.container.bounds.left + this.container.styles.transformOrigin[0].number;
                    var offsetY = this.container.bounds.top + this.container.styles.transformOrigin[1].number;
                    var matrix = this.container.styles.transform;
                    this.effects.push(new TransformEffect(offsetX, offsetY, matrix));
                }
                if (this.container.styles.overflowX !== 0 /* VISIBLE */) {
                    var borderBox = calculateBorderBoxPath(this.curves);
                    var paddingBox = calculatePaddingBoxPath(this.curves);
                    if (equalPath(borderBox, paddingBox)) {
                        this.effects.push(new ClipEffect(borderBox, 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */));
                    }
                    else {
                        this.effects.push(new ClipEffect(borderBox, 2 /* BACKGROUND_BORDERS */));
                        this.effects.push(new ClipEffect(paddingBox, 4 /* CONTENT */));
                    }
                }
            }
            ElementPaint.prototype.getEffects = function (target) {
                var inFlow = [2 /* ABSOLUTE */, 3 /* FIXED */].indexOf(this.container.styles.position) === -1;
                var parent = this.parent;
                var effects = this.effects.slice(0);
                while (parent) {
                    var croplessEffects = parent.effects.filter(function (effect) { return !isClipEffect(effect); });
                    if (inFlow || parent.container.styles.position !== 0 /* STATIC */ || !parent.parent) {
                        effects.unshift.apply(effects, croplessEffects);
                        inFlow = [2 /* ABSOLUTE */, 3 /* FIXED */].indexOf(parent.container.styles.position) === -1;
                        if (parent.container.styles.overflowX !== 0 /* VISIBLE */) {
                            var borderBox = calculateBorderBoxPath(parent.curves);
                            var paddingBox = calculatePaddingBoxPath(parent.curves);
                            if (!equalPath(borderBox, paddingBox)) {
                                effects.unshift(new ClipEffect(paddingBox, 2 /* BACKGROUND_BORDERS */ | 4 /* CONTENT */));
                            }
                        }
                    }
                    else {
                        effects.unshift.apply(effects, croplessEffects);
                    }
                    parent = parent.parent;
                }
                return effects.filter(function (effect) { return contains(effect.target, target); });
            };
            return ElementPaint;
        }());
        var parseStackTree = function (parent, stackingContext, realStackingContext, listItems) {
            parent.container.elements.forEach(function (child) {
                var treatAsRealStackingContext = contains(child.flags, 4 /* CREATES_REAL_STACKING_CONTEXT */);
                var createsStackingContext = contains(child.flags, 2 /* CREATES_STACKING_CONTEXT */);
                var paintContainer = new ElementPaint(child, parent);
                if (contains(child.styles.display, 2048 /* LIST_ITEM */)) {
                    listItems.push(paintContainer);
                }
                var listOwnerItems = contains(child.flags, 8 /* IS_LIST_OWNER */) ? [] : listItems;
                if (treatAsRealStackingContext || createsStackingContext) {
                    var parentStack = treatAsRealStackingContext || child.styles.isPositioned() ? realStackingContext : stackingContext;
                    var stack = new StackingContext(paintContainer);
                    if (child.styles.isPositioned() || child.styles.opacity < 1 || child.styles.isTransformed()) {
                        var order_1 = child.styles.zIndex.order;
                        if (order_1 < 0) {
                            var index_1 = 0;
                            parentStack.negativeZIndex.some(function (current, i) {
                                if (order_1 > current.element.container.styles.zIndex.order) {
                                    index_1 = i;
                                    return false;
                                }
                                else if (index_1 > 0) {
                                    return true;
                                }
                                return false;
                            });
                            parentStack.negativeZIndex.splice(index_1, 0, stack);
                        }
                        else if (order_1 > 0) {
                            var index_2 = 0;
                            parentStack.positiveZIndex.some(function (current, i) {
                                if (order_1 >= current.element.container.styles.zIndex.order) {
                                    index_2 = i + 1;
                                    return false;
                                }
                                else if (index_2 > 0) {
                                    return true;
                                }
                                return false;
                            });
                            parentStack.positiveZIndex.splice(index_2, 0, stack);
                        }
                        else {
                            parentStack.zeroOrAutoZIndexOrTransformedOrOpacity.push(stack);
                        }
                    }
                    else {
                        if (child.styles.isFloating()) {
                            parentStack.nonPositionedFloats.push(stack);
                        }
                        else {
                            parentStack.nonPositionedInlineLevel.push(stack);
                        }
                    }
                    parseStackTree(paintContainer, stack, treatAsRealStackingContext ? stack : realStackingContext, listOwnerItems);
                }
                else {
                    if (child.styles.isInlineLevel()) {
                        stackingContext.inlineLevel.push(paintContainer);
                    }
                    else {
                        stackingContext.nonInlineLevel.push(paintContainer);
                    }
                    parseStackTree(paintContainer, stackingContext, realStackingContext, listOwnerItems);
                }
                if (contains(child.flags, 8 /* IS_LIST_OWNER */)) {
                    processListItems(child, listOwnerItems);
                }
            });
        };
        var processListItems = function (owner, elements) {
            var numbering = owner instanceof OLElementContainer ? owner.start : 1;
            var reversed = owner instanceof OLElementContainer ? owner.reversed : false;
            for (var i = 0; i < elements.length; i++) {
                var item = elements[i];
                if (item.container instanceof LIElementContainer &&
                    typeof item.container.value === 'number' &&
                    item.container.value !== 0) {
                    numbering = item.container.value;
                }
                item.listValue = createCounterText(numbering, item.container.styles.listStyleType, true);
                numbering += reversed ? -1 : 1;
            }
        };
        var parseStackingContexts = function (container) {
            var paintContainer = new ElementPaint(container, null);
            var root = new StackingContext(paintContainer);
            var listItems = [];
            parseStackTree(paintContainer, root, root, listItems);
            processListItems(paintContainer.container, listItems);
            return root;
        };

        var parsePathForBorder = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createPathFromCurves(curves.topLeftBorderBox, curves.topLeftPaddingBox, curves.topRightBorderBox, curves.topRightPaddingBox);
                case 1:
                    return createPathFromCurves(curves.topRightBorderBox, curves.topRightPaddingBox, curves.bottomRightBorderBox, curves.bottomRightPaddingBox);
                case 2:
                    return createPathFromCurves(curves.bottomRightBorderBox, curves.bottomRightPaddingBox, curves.bottomLeftBorderBox, curves.bottomLeftPaddingBox);
                case 3:
                default:
                    return createPathFromCurves(curves.bottomLeftBorderBox, curves.bottomLeftPaddingBox, curves.topLeftBorderBox, curves.topLeftPaddingBox);
            }
        };
        var parsePathForBorderDoubleOuter = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createPathFromCurves(curves.topLeftBorderBox, curves.topLeftBorderDoubleOuterBox, curves.topRightBorderBox, curves.topRightBorderDoubleOuterBox);
                case 1:
                    return createPathFromCurves(curves.topRightBorderBox, curves.topRightBorderDoubleOuterBox, curves.bottomRightBorderBox, curves.bottomRightBorderDoubleOuterBox);
                case 2:
                    return createPathFromCurves(curves.bottomRightBorderBox, curves.bottomRightBorderDoubleOuterBox, curves.bottomLeftBorderBox, curves.bottomLeftBorderDoubleOuterBox);
                case 3:
                default:
                    return createPathFromCurves(curves.bottomLeftBorderBox, curves.bottomLeftBorderDoubleOuterBox, curves.topLeftBorderBox, curves.topLeftBorderDoubleOuterBox);
            }
        };
        var parsePathForBorderDoubleInner = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createPathFromCurves(curves.topLeftBorderDoubleInnerBox, curves.topLeftPaddingBox, curves.topRightBorderDoubleInnerBox, curves.topRightPaddingBox);
                case 1:
                    return createPathFromCurves(curves.topRightBorderDoubleInnerBox, curves.topRightPaddingBox, curves.bottomRightBorderDoubleInnerBox, curves.bottomRightPaddingBox);
                case 2:
                    return createPathFromCurves(curves.bottomRightBorderDoubleInnerBox, curves.bottomRightPaddingBox, curves.bottomLeftBorderDoubleInnerBox, curves.bottomLeftPaddingBox);
                case 3:
                default:
                    return createPathFromCurves(curves.bottomLeftBorderDoubleInnerBox, curves.bottomLeftPaddingBox, curves.topLeftBorderDoubleInnerBox, curves.topLeftPaddingBox);
            }
        };
        var parsePathForBorderStroke = function (curves, borderSide) {
            switch (borderSide) {
                case 0:
                    return createStrokePathFromCurves(curves.topLeftBorderStroke, curves.topRightBorderStroke);
                case 1:
                    return createStrokePathFromCurves(curves.topRightBorderStroke, curves.bottomRightBorderStroke);
                case 2:
                    return createStrokePathFromCurves(curves.bottomRightBorderStroke, curves.bottomLeftBorderStroke);
                case 3:
                default:
                    return createStrokePathFromCurves(curves.bottomLeftBorderStroke, curves.topLeftBorderStroke);
            }
        };
        var createStrokePathFromCurves = function (outer1, outer2) {
            var path = [];
            if (isBezierCurve(outer1)) {
                path.push(outer1.subdivide(0.5, false));
            }
            else {
                path.push(outer1);
            }
            if (isBezierCurve(outer2)) {
                path.push(outer2.subdivide(0.5, true));
            }
            else {
                path.push(outer2);
            }
            return path;
        };
        var createPathFromCurves = function (outer1, inner1, outer2, inner2) {
            var path = [];
            if (isBezierCurve(outer1)) {
                path.push(outer1.subdivide(0.5, false));
            }
            else {
                path.push(outer1);
            }
            if (isBezierCurve(outer2)) {
                path.push(outer2.subdivide(0.5, true));
            }
            else {
                path.push(outer2);
            }
            if (isBezierCurve(inner2)) {
                path.push(inner2.subdivide(0.5, true).reverse());
            }
            else {
                path.push(inner2);
            }
            if (isBezierCurve(inner1)) {
                path.push(inner1.subdivide(0.5, false).reverse());
            }
            else {
                path.push(inner1);
            }
            return path;
        };

        var paddingBox = function (element) {
            var bounds = element.bounds;
            var styles = element.styles;
            return bounds.add(styles.borderLeftWidth, styles.borderTopWidth, -(styles.borderRightWidth + styles.borderLeftWidth), -(styles.borderTopWidth + styles.borderBottomWidth));
        };
        var contentBox = function (element) {
            var styles = element.styles;
            var bounds = element.bounds;
            var paddingLeft = getAbsoluteValue(styles.paddingLeft, bounds.width);
            var paddingRight = getAbsoluteValue(styles.paddingRight, bounds.width);
            var paddingTop = getAbsoluteValue(styles.paddingTop, bounds.width);
            var paddingBottom = getAbsoluteValue(styles.paddingBottom, bounds.width);
            return bounds.add(paddingLeft + styles.borderLeftWidth, paddingTop + styles.borderTopWidth, -(styles.borderRightWidth + styles.borderLeftWidth + paddingLeft + paddingRight), -(styles.borderTopWidth + styles.borderBottomWidth + paddingTop + paddingBottom));
        };

        var calculateBackgroundPositioningArea = function (backgroundOrigin, element) {
            if (backgroundOrigin === 0 /* BORDER_BOX */) {
                return element.bounds;
            }
            if (backgroundOrigin === 2 /* CONTENT_BOX */) {
                return contentBox(element);
            }
            return paddingBox(element);
        };
        var calculateBackgroundPaintingArea = function (backgroundClip, element) {
            if (backgroundClip === 0 /* BORDER_BOX */) {
                return element.bounds;
            }
            if (backgroundClip === 2 /* CONTENT_BOX */) {
                return contentBox(element);
            }
            return paddingBox(element);
        };
        var calculateBackgroundRendering = function (container, index, intrinsicSize) {
            var backgroundPositioningArea = calculateBackgroundPositioningArea(getBackgroundValueForIndex(container.styles.backgroundOrigin, index), container);
            var backgroundPaintingArea = calculateBackgroundPaintingArea(getBackgroundValueForIndex(container.styles.backgroundClip, index), container);
            var backgroundImageSize = calculateBackgroundSize(getBackgroundValueForIndex(container.styles.backgroundSize, index), intrinsicSize, backgroundPositioningArea);
            var sizeWidth = backgroundImageSize[0], sizeHeight = backgroundImageSize[1];
            var position = getAbsoluteValueForTuple(getBackgroundValueForIndex(container.styles.backgroundPosition, index), backgroundPositioningArea.width - sizeWidth, backgroundPositioningArea.height - sizeHeight);
            var path = calculateBackgroundRepeatPath(getBackgroundValueForIndex(container.styles.backgroundRepeat, index), position, backgroundImageSize, backgroundPositioningArea, backgroundPaintingArea);
            var offsetX = Math.round(backgroundPositioningArea.left + position[0]);
            var offsetY = Math.round(backgroundPositioningArea.top + position[1]);
            return [path, offsetX, offsetY, sizeWidth, sizeHeight];
        };
        var isAuto = function (token) { return isIdentToken(token) && token.value === BACKGROUND_SIZE.AUTO; };
        var hasIntrinsicValue = function (value) { return typeof value === 'number'; };
        var calculateBackgroundSize = function (size, _a, bounds) {
            var intrinsicWidth = _a[0], intrinsicHeight = _a[1], intrinsicProportion = _a[2];
            var first = size[0], second = size[1];
            if (!first) {
                return [0, 0];
            }
            if (isLengthPercentage(first) && second && isLengthPercentage(second)) {
                return [getAbsoluteValue(first, bounds.width), getAbsoluteValue(second, bounds.height)];
            }
            var hasIntrinsicProportion = hasIntrinsicValue(intrinsicProportion);
            if (isIdentToken(first) && (first.value === BACKGROUND_SIZE.CONTAIN || first.value === BACKGROUND_SIZE.COVER)) {
                if (hasIntrinsicValue(intrinsicProportion)) {
                    var targetRatio = bounds.width / bounds.height;
                    return targetRatio < intrinsicProportion !== (first.value === BACKGROUND_SIZE.COVER)
                        ? [bounds.width, bounds.width / intrinsicProportion]
                        : [bounds.height * intrinsicProportion, bounds.height];
                }
                return [bounds.width, bounds.height];
            }
            var hasIntrinsicWidth = hasIntrinsicValue(intrinsicWidth);
            var hasIntrinsicHeight = hasIntrinsicValue(intrinsicHeight);
            var hasIntrinsicDimensions = hasIntrinsicWidth || hasIntrinsicHeight;
            // If the background-size is auto or auto auto:
            if (isAuto(first) && (!second || isAuto(second))) {
                // If the image has both horizontal and vertical intrinsic dimensions, it's rendered at that size.
                if (hasIntrinsicWidth && hasIntrinsicHeight) {
                    return [intrinsicWidth, intrinsicHeight];
                }
                // If the image has no intrinsic dimensions and has no intrinsic proportions,
                // it's rendered at the size of the background positioning area.
                if (!hasIntrinsicProportion && !hasIntrinsicDimensions) {
                    return [bounds.width, bounds.height];
                }
                // TODO If the image has no intrinsic dimensions but has intrinsic proportions, it's rendered as if contain had been specified instead.
                // If the image has only one intrinsic dimension and has intrinsic proportions, it's rendered at the size corresponding to that one dimension.
                // The other dimension is computed using the specified dimension and the intrinsic proportions.
                if (hasIntrinsicDimensions && hasIntrinsicProportion) {
                    var width_1 = hasIntrinsicWidth
                        ? intrinsicWidth
                        : intrinsicHeight * intrinsicProportion;
                    var height_1 = hasIntrinsicHeight
                        ? intrinsicHeight
                        : intrinsicWidth / intrinsicProportion;
                    return [width_1, height_1];
                }
                // If the image has only one intrinsic dimension but has no intrinsic proportions,
                // it's rendered using the specified dimension and the other dimension of the background positioning area.
                var width_2 = hasIntrinsicWidth ? intrinsicWidth : bounds.width;
                var height_2 = hasIntrinsicHeight ? intrinsicHeight : bounds.height;
                return [width_2, height_2];
            }
            // If the image has intrinsic proportions, it's stretched to the specified dimension.
            // The unspecified dimension is computed using the specified dimension and the intrinsic proportions.
            if (hasIntrinsicProportion) {
                var width_3 = 0;
                var height_3 = 0;
                if (isLengthPercentage(first)) {
                    width_3 = getAbsoluteValue(first, bounds.width);
                }
                else if (isLengthPercentage(second)) {
                    height_3 = getAbsoluteValue(second, bounds.height);
                }
                if (isAuto(first)) {
                    width_3 = height_3 * intrinsicProportion;
                }
                else if (!second || isAuto(second)) {
                    height_3 = width_3 / intrinsicProportion;
                }
                return [width_3, height_3];
            }
            // If the image has no intrinsic proportions, it's stretched to the specified dimension.
            // The unspecified dimension is computed using the image's corresponding intrinsic dimension,
            // if there is one. If there is no such intrinsic dimension,
            // it becomes the corresponding dimension of the background positioning area.
            var width = null;
            var height = null;
            if (isLengthPercentage(first)) {
                width = getAbsoluteValue(first, bounds.width);
            }
            else if (second && isLengthPercentage(second)) {
                height = getAbsoluteValue(second, bounds.height);
            }
            if (width !== null && (!second || isAuto(second))) {
                height =
                    hasIntrinsicWidth && hasIntrinsicHeight
                        ? (width / intrinsicWidth) * intrinsicHeight
                        : bounds.height;
            }
            if (height !== null && isAuto(first)) {
                width =
                    hasIntrinsicWidth && hasIntrinsicHeight
                        ? (height / intrinsicHeight) * intrinsicWidth
                        : bounds.width;
            }
            if (width !== null && height !== null) {
                return [width, height];
            }
            throw new Error("Unable to calculate background-size for element");
        };
        var getBackgroundValueForIndex = function (values, index) {
            var value = values[index];
            if (typeof value === 'undefined') {
                return values[0];
            }
            return value;
        };
        var calculateBackgroundRepeatPath = function (repeat, _a, _b, backgroundPositioningArea, backgroundPaintingArea) {
            var x = _a[0], y = _a[1];
            var width = _b[0], height = _b[1];
            switch (repeat) {
                case 2 /* REPEAT_X */:
                    return [
                        new Vector(Math.round(backgroundPositioningArea.left), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + backgroundPositioningArea.width), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + backgroundPositioningArea.width), Math.round(height + backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left), Math.round(height + backgroundPositioningArea.top + y))
                    ];
                case 3 /* REPEAT_Y */:
                    return [
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.top)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.top)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.height + backgroundPositioningArea.top)),
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.height + backgroundPositioningArea.top))
                    ];
                case 1 /* NO_REPEAT */:
                    return [
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.top + y)),
                        new Vector(Math.round(backgroundPositioningArea.left + x + width), Math.round(backgroundPositioningArea.top + y + height)),
                        new Vector(Math.round(backgroundPositioningArea.left + x), Math.round(backgroundPositioningArea.top + y + height))
                    ];
                default:
                    return [
                        new Vector(Math.round(backgroundPaintingArea.left), Math.round(backgroundPaintingArea.top)),
                        new Vector(Math.round(backgroundPaintingArea.left + backgroundPaintingArea.width), Math.round(backgroundPaintingArea.top)),
                        new Vector(Math.round(backgroundPaintingArea.left + backgroundPaintingArea.width), Math.round(backgroundPaintingArea.height + backgroundPaintingArea.top)),
                        new Vector(Math.round(backgroundPaintingArea.left), Math.round(backgroundPaintingArea.height + backgroundPaintingArea.top))
                    ];
            }
        };

        var SMALL_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        var SAMPLE_TEXT = 'Hidden Text';
        var FontMetrics = /** @class */ (function () {
            function FontMetrics(document) {
                this._data = {};
                this._document = document;
            }
            FontMetrics.prototype.parseMetrics = function (fontFamily, fontSize) {
                var container = this._document.createElement('div');
                var img = this._document.createElement('img');
                var span = this._document.createElement('span');
                var body = this._document.body;
                container.style.visibility = 'hidden';
                container.style.fontFamily = fontFamily;
                container.style.fontSize = fontSize;
                container.style.margin = '0';
                container.style.padding = '0';
                container.style.whiteSpace = 'nowrap';
                body.appendChild(container);
                img.src = SMALL_IMAGE;
                img.width = 1;
                img.height = 1;
                img.style.margin = '0';
                img.style.padding = '0';
                img.style.verticalAlign = 'baseline';
                span.style.fontFamily = fontFamily;
                span.style.fontSize = fontSize;
                span.style.margin = '0';
                span.style.padding = '0';
                span.appendChild(this._document.createTextNode(SAMPLE_TEXT));
                container.appendChild(span);
                container.appendChild(img);
                var baseline = img.offsetTop - span.offsetTop + 2;
                container.removeChild(span);
                container.appendChild(this._document.createTextNode(SAMPLE_TEXT));
                container.style.lineHeight = 'normal';
                img.style.verticalAlign = 'super';
                var middle = img.offsetTop - container.offsetTop + 2;
                body.removeChild(container);
                return { baseline: baseline, middle: middle };
            };
            FontMetrics.prototype.getMetrics = function (fontFamily, fontSize) {
                var key = fontFamily + " " + fontSize;
                if (typeof this._data[key] === 'undefined') {
                    this._data[key] = this.parseMetrics(fontFamily, fontSize);
                }
                return this._data[key];
            };
            return FontMetrics;
        }());

        var Renderer = /** @class */ (function () {
            function Renderer(context, options) {
                this.context = context;
                this.options = options;
            }
            return Renderer;
        }());

        var MASK_OFFSET = 10000;
        var CanvasRenderer = /** @class */ (function (_super) {
            __extends(CanvasRenderer, _super);
            function CanvasRenderer(context, options) {
                var _this = _super.call(this, context, options) || this;
                _this._activeEffects = [];
                _this.canvas = options.canvas ? options.canvas : document.createElement('canvas');
                _this.ctx = _this.canvas.getContext('2d');
                if (!options.canvas) {
                    _this.canvas.width = Math.floor(options.width * options.scale);
                    _this.canvas.height = Math.floor(options.height * options.scale);
                    _this.canvas.style.width = options.width + "px";
                    _this.canvas.style.height = options.height + "px";
                }
                _this.fontMetrics = new FontMetrics(document);
                _this.ctx.scale(_this.options.scale, _this.options.scale);
                _this.ctx.translate(-options.x, -options.y);
                _this.ctx.textBaseline = 'bottom';
                _this._activeEffects = [];
                _this.context.logger.debug("Canvas renderer initialized (" + options.width + "x" + options.height + ") with scale " + options.scale);
                return _this;
            }
            CanvasRenderer.prototype.applyEffects = function (effects) {
                var _this = this;
                while (this._activeEffects.length) {
                    this.popEffect();
                }
                effects.forEach(function (effect) { return _this.applyEffect(effect); });
            };
            CanvasRenderer.prototype.applyEffect = function (effect) {
                this.ctx.save();
                if (isOpacityEffect(effect)) {
                    this.ctx.globalAlpha = effect.opacity;
                }
                if (isTransformEffect(effect)) {
                    this.ctx.translate(effect.offsetX, effect.offsetY);
                    this.ctx.transform(effect.matrix[0], effect.matrix[1], effect.matrix[2], effect.matrix[3], effect.matrix[4], effect.matrix[5]);
                    this.ctx.translate(-effect.offsetX, -effect.offsetY);
                }
                if (isClipEffect(effect)) {
                    this.path(effect.path);
                    this.ctx.clip();
                }
                this._activeEffects.push(effect);
            };
            CanvasRenderer.prototype.popEffect = function () {
                this._activeEffects.pop();
                this.ctx.restore();
            };
            CanvasRenderer.prototype.renderStack = function (stack) {
                return __awaiter(this, void 0, void 0, function () {
                    var styles;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                styles = stack.element.container.styles;
                                if (!styles.isVisible()) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.renderStackContent(stack)];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderNode = function (paint) {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (contains(paint.container.flags, 16 /* DEBUG_RENDER */)) {
                                    debugger;
                                }
                                if (!paint.container.styles.isVisible()) return [3 /*break*/, 3];
                                return [4 /*yield*/, this.renderNodeBackgroundAndBorders(paint)];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, this.renderNodeContent(paint)];
                            case 2:
                                _a.sent();
                                _a.label = 3;
                            case 3: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderTextWithLetterSpacing = function (text, letterSpacing, baseline) {
                var _this = this;
                if (letterSpacing === 0) {
                    this.ctx.fillText(text.text, text.bounds.left, text.bounds.top + baseline);
                }
                else {
                    var letters = segmentGraphemes(text.text);
                    letters.reduce(function (left, letter) {
                        _this.ctx.fillText(letter, left, text.bounds.top + baseline);
                        return left + _this.ctx.measureText(letter).width;
                    }, text.bounds.left);
                }
            };
            CanvasRenderer.prototype.createFontStyle = function (styles) {
                var fontVariant = styles.fontVariant
                    .filter(function (variant) { return variant === 'normal' || variant === 'small-caps'; })
                    .join('');
                var fontFamily = fixIOSSystemFonts(styles.fontFamily).join(', ');
                var fontSize = isDimensionToken(styles.fontSize)
                    ? "" + styles.fontSize.number + styles.fontSize.unit
                    : styles.fontSize.number + "px";
                return [
                    [styles.fontStyle, fontVariant, styles.fontWeight, fontSize, fontFamily].join(' '),
                    fontFamily,
                    fontSize
                ];
            };
            CanvasRenderer.prototype.renderTextNode = function (text, styles) {
                return __awaiter(this, void 0, void 0, function () {
                    var _a, font, fontFamily, fontSize, _b, baseline, middle, paintOrder;
                    var _this = this;
                    return __generator(this, function (_c) {
                        _a = this.createFontStyle(styles), font = _a[0], fontFamily = _a[1], fontSize = _a[2];
                        this.ctx.font = font;
                        this.ctx.direction = styles.direction === 1 /* RTL */ ? 'rtl' : 'ltr';
                        this.ctx.textAlign = 'left';
                        this.ctx.textBaseline = 'alphabetic';
                        _b = this.fontMetrics.getMetrics(fontFamily, fontSize), baseline = _b.baseline, middle = _b.middle;
                        paintOrder = styles.paintOrder;
                        text.textBounds.forEach(function (text) {
                            paintOrder.forEach(function (paintOrderLayer) {
                                switch (paintOrderLayer) {
                                    case 0 /* FILL */:
                                        _this.ctx.fillStyle = asString(styles.color);
                                        _this.renderTextWithLetterSpacing(text, styles.letterSpacing, baseline);
                                        var textShadows = styles.textShadow;
                                        if (textShadows.length && text.text.trim().length) {
                                            textShadows
                                                .slice(0)
                                                .reverse()
                                                .forEach(function (textShadow) {
                                                _this.ctx.shadowColor = asString(textShadow.color);
                                                _this.ctx.shadowOffsetX = textShadow.offsetX.number * _this.options.scale;
                                                _this.ctx.shadowOffsetY = textShadow.offsetY.number * _this.options.scale;
                                                _this.ctx.shadowBlur = textShadow.blur.number;
                                                _this.renderTextWithLetterSpacing(text, styles.letterSpacing, baseline);
                                            });
                                            _this.ctx.shadowColor = '';
                                            _this.ctx.shadowOffsetX = 0;
                                            _this.ctx.shadowOffsetY = 0;
                                            _this.ctx.shadowBlur = 0;
                                        }
                                        if (styles.textDecorationLine.length) {
                                            _this.ctx.fillStyle = asString(styles.textDecorationColor || styles.color);
                                            styles.textDecorationLine.forEach(function (textDecorationLine) {
                                                switch (textDecorationLine) {
                                                    case 1 /* UNDERLINE */:
                                                        // Draws a line at the baseline of the font
                                                        // TODO As some browsers display the line as more than 1px if the font-size is big,
                                                        // need to take that into account both in position and size
                                                        _this.ctx.fillRect(text.bounds.left, Math.round(text.bounds.top + baseline), text.bounds.width, 1);
                                                        break;
                                                    case 2 /* OVERLINE */:
                                                        _this.ctx.fillRect(text.bounds.left, Math.round(text.bounds.top), text.bounds.width, 1);
                                                        break;
                                                    case 3 /* LINE_THROUGH */:
                                                        // TODO try and find exact position for line-through
                                                        _this.ctx.fillRect(text.bounds.left, Math.ceil(text.bounds.top + middle), text.bounds.width, 1);
                                                        break;
                                                }
                                            });
                                        }
                                        break;
                                    case 1 /* STROKE */:
                                        if (styles.webkitTextStrokeWidth && text.text.trim().length) {
                                            _this.ctx.strokeStyle = asString(styles.webkitTextStrokeColor);
                                            _this.ctx.lineWidth = styles.webkitTextStrokeWidth;
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            _this.ctx.lineJoin = !!window.chrome ? 'miter' : 'round';
                                            _this.ctx.strokeText(text.text, text.bounds.left, text.bounds.top + baseline);
                                        }
                                        _this.ctx.strokeStyle = '';
                                        _this.ctx.lineWidth = 0;
                                        _this.ctx.lineJoin = 'miter';
                                        break;
                                }
                            });
                        });
                        return [2 /*return*/];
                    });
                });
            };
            CanvasRenderer.prototype.renderReplacedElement = function (container, curves, image) {
                if (image && container.intrinsicWidth > 0 && container.intrinsicHeight > 0) {
                    var box = contentBox(container);
                    var path = calculatePaddingBoxPath(curves);
                    this.path(path);
                    this.ctx.save();
                    this.ctx.clip();
                    this.ctx.drawImage(image, 0, 0, container.intrinsicWidth, container.intrinsicHeight, box.left, box.top, box.width, box.height);
                    this.ctx.restore();
                }
            };
            CanvasRenderer.prototype.renderNodeContent = function (paint) {
                return __awaiter(this, void 0, void 0, function () {
                    var container, curves, styles, _i, _a, child, image, image, iframeRenderer, canvas, size, _b, fontFamily, fontSize, baseline, bounds, x, textBounds, img, image, url, fontFamily, bounds;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                this.applyEffects(paint.getEffects(4 /* CONTENT */));
                                container = paint.container;
                                curves = paint.curves;
                                styles = container.styles;
                                _i = 0, _a = container.textNodes;
                                _c.label = 1;
                            case 1:
                                if (!(_i < _a.length)) return [3 /*break*/, 4];
                                child = _a[_i];
                                return [4 /*yield*/, this.renderTextNode(child, styles)];
                            case 2:
                                _c.sent();
                                _c.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4:
                                if (!(container instanceof ImageElementContainer)) return [3 /*break*/, 8];
                                _c.label = 5;
                            case 5:
                                _c.trys.push([5, 7, , 8]);
                                return [4 /*yield*/, this.context.cache.match(container.src)];
                            case 6:
                                image = _c.sent();
                                this.renderReplacedElement(container, curves, image);
                                return [3 /*break*/, 8];
                            case 7:
                                _c.sent();
                                this.context.logger.error("Error loading image " + container.src);
                                return [3 /*break*/, 8];
                            case 8:
                                if (container instanceof CanvasElementContainer) {
                                    this.renderReplacedElement(container, curves, container.canvas);
                                }
                                if (!(container instanceof SVGElementContainer)) return [3 /*break*/, 12];
                                _c.label = 9;
                            case 9:
                                _c.trys.push([9, 11, , 12]);
                                return [4 /*yield*/, this.context.cache.match(container.svg)];
                            case 10:
                                image = _c.sent();
                                this.renderReplacedElement(container, curves, image);
                                return [3 /*break*/, 12];
                            case 11:
                                _c.sent();
                                this.context.logger.error("Error loading svg " + container.svg.substring(0, 255));
                                return [3 /*break*/, 12];
                            case 12:
                                if (!(container instanceof IFrameElementContainer && container.tree)) return [3 /*break*/, 14];
                                iframeRenderer = new CanvasRenderer(this.context, {
                                    scale: this.options.scale,
                                    backgroundColor: container.backgroundColor,
                                    x: 0,
                                    y: 0,
                                    width: container.width,
                                    height: container.height
                                });
                                return [4 /*yield*/, iframeRenderer.render(container.tree)];
                            case 13:
                                canvas = _c.sent();
                                if (container.width && container.height) {
                                    this.ctx.drawImage(canvas, 0, 0, container.width, container.height, container.bounds.left, container.bounds.top, container.bounds.width, container.bounds.height);
                                }
                                _c.label = 14;
                            case 14:
                                if (container instanceof InputElementContainer) {
                                    size = Math.min(container.bounds.width, container.bounds.height);
                                    if (container.type === CHECKBOX) {
                                        if (container.checked) {
                                            this.ctx.save();
                                            this.path([
                                                new Vector(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79),
                                                new Vector(container.bounds.left + size * 0.16, container.bounds.top + size * 0.5549),
                                                new Vector(container.bounds.left + size * 0.27347, container.bounds.top + size * 0.44071),
                                                new Vector(container.bounds.left + size * 0.39694, container.bounds.top + size * 0.5649),
                                                new Vector(container.bounds.left + size * 0.72983, container.bounds.top + size * 0.23),
                                                new Vector(container.bounds.left + size * 0.84, container.bounds.top + size * 0.34085),
                                                new Vector(container.bounds.left + size * 0.39363, container.bounds.top + size * 0.79)
                                            ]);
                                            this.ctx.fillStyle = asString(INPUT_COLOR);
                                            this.ctx.fill();
                                            this.ctx.restore();
                                        }
                                    }
                                    else if (container.type === RADIO) {
                                        if (container.checked) {
                                            this.ctx.save();
                                            this.ctx.beginPath();
                                            this.ctx.arc(container.bounds.left + size / 2, container.bounds.top + size / 2, size / 4, 0, Math.PI * 2, true);
                                            this.ctx.fillStyle = asString(INPUT_COLOR);
                                            this.ctx.fill();
                                            this.ctx.restore();
                                        }
                                    }
                                }
                                if (isTextInputElement(container) && container.value.length) {
                                    _b = this.createFontStyle(styles), fontFamily = _b[0], fontSize = _b[1];
                                    baseline = this.fontMetrics.getMetrics(fontFamily, fontSize).baseline;
                                    this.ctx.font = fontFamily;
                                    this.ctx.fillStyle = asString(styles.color);
                                    this.ctx.textBaseline = 'alphabetic';
                                    this.ctx.textAlign = canvasTextAlign(container.styles.textAlign);
                                    bounds = contentBox(container);
                                    x = 0;
                                    switch (container.styles.textAlign) {
                                        case 1 /* CENTER */:
                                            x += bounds.width / 2;
                                            break;
                                        case 2 /* RIGHT */:
                                            x += bounds.width;
                                            break;
                                    }
                                    textBounds = bounds.add(x, 0, 0, -bounds.height / 2 + 1);
                                    this.ctx.save();
                                    this.path([
                                        new Vector(bounds.left, bounds.top),
                                        new Vector(bounds.left + bounds.width, bounds.top),
                                        new Vector(bounds.left + bounds.width, bounds.top + bounds.height),
                                        new Vector(bounds.left, bounds.top + bounds.height)
                                    ]);
                                    this.ctx.clip();
                                    this.renderTextWithLetterSpacing(new TextBounds(container.value, textBounds), styles.letterSpacing, baseline);
                                    this.ctx.restore();
                                    this.ctx.textBaseline = 'alphabetic';
                                    this.ctx.textAlign = 'left';
                                }
                                if (!contains(container.styles.display, 2048 /* LIST_ITEM */)) return [3 /*break*/, 20];
                                if (!(container.styles.listStyleImage !== null)) return [3 /*break*/, 19];
                                img = container.styles.listStyleImage;
                                if (!(img.type === 0 /* URL */)) return [3 /*break*/, 18];
                                image = void 0;
                                url = img.url;
                                _c.label = 15;
                            case 15:
                                _c.trys.push([15, 17, , 18]);
                                return [4 /*yield*/, this.context.cache.match(url)];
                            case 16:
                                image = _c.sent();
                                this.ctx.drawImage(image, container.bounds.left - (image.width + 10), container.bounds.top);
                                return [3 /*break*/, 18];
                            case 17:
                                _c.sent();
                                this.context.logger.error("Error loading list-style-image " + url);
                                return [3 /*break*/, 18];
                            case 18: return [3 /*break*/, 20];
                            case 19:
                                if (paint.listValue && container.styles.listStyleType !== -1 /* NONE */) {
                                    fontFamily = this.createFontStyle(styles)[0];
                                    this.ctx.font = fontFamily;
                                    this.ctx.fillStyle = asString(styles.color);
                                    this.ctx.textBaseline = 'middle';
                                    this.ctx.textAlign = 'right';
                                    bounds = new Bounds(container.bounds.left, container.bounds.top + getAbsoluteValue(container.styles.paddingTop, container.bounds.width), container.bounds.width, computeLineHeight(styles.lineHeight, styles.fontSize.number) / 2 + 1);
                                    this.renderTextWithLetterSpacing(new TextBounds(paint.listValue, bounds), styles.letterSpacing, computeLineHeight(styles.lineHeight, styles.fontSize.number) / 2 + 2);
                                    this.ctx.textBaseline = 'bottom';
                                    this.ctx.textAlign = 'left';
                                }
                                _c.label = 20;
                            case 20: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderStackContent = function (stack) {
                return __awaiter(this, void 0, void 0, function () {
                    var _i, _a, child, _b, _c, child, _d, _e, child, _f, _g, child, _h, _j, child, _k, _l, child, _m, _o, child;
                    return __generator(this, function (_p) {
                        switch (_p.label) {
                            case 0:
                                if (contains(stack.element.container.flags, 16 /* DEBUG_RENDER */)) {
                                    debugger;
                                }
                                // https://www.w3.org/TR/css-position-3/#painting-order
                                // 1. the background and borders of the element forming the stacking context.
                                return [4 /*yield*/, this.renderNodeBackgroundAndBorders(stack.element)];
                            case 1:
                                // https://www.w3.org/TR/css-position-3/#painting-order
                                // 1. the background and borders of the element forming the stacking context.
                                _p.sent();
                                _i = 0, _a = stack.negativeZIndex;
                                _p.label = 2;
                            case 2:
                                if (!(_i < _a.length)) return [3 /*break*/, 5];
                                child = _a[_i];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 3:
                                _p.sent();
                                _p.label = 4;
                            case 4:
                                _i++;
                                return [3 /*break*/, 2];
                            case 5: 
                            // 3. For all its in-flow, non-positioned, block-level descendants in tree order:
                            return [4 /*yield*/, this.renderNodeContent(stack.element)];
                            case 6:
                                // 3. For all its in-flow, non-positioned, block-level descendants in tree order:
                                _p.sent();
                                _b = 0, _c = stack.nonInlineLevel;
                                _p.label = 7;
                            case 7:
                                if (!(_b < _c.length)) return [3 /*break*/, 10];
                                child = _c[_b];
                                return [4 /*yield*/, this.renderNode(child)];
                            case 8:
                                _p.sent();
                                _p.label = 9;
                            case 9:
                                _b++;
                                return [3 /*break*/, 7];
                            case 10:
                                _d = 0, _e = stack.nonPositionedFloats;
                                _p.label = 11;
                            case 11:
                                if (!(_d < _e.length)) return [3 /*break*/, 14];
                                child = _e[_d];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 12:
                                _p.sent();
                                _p.label = 13;
                            case 13:
                                _d++;
                                return [3 /*break*/, 11];
                            case 14:
                                _f = 0, _g = stack.nonPositionedInlineLevel;
                                _p.label = 15;
                            case 15:
                                if (!(_f < _g.length)) return [3 /*break*/, 18];
                                child = _g[_f];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 16:
                                _p.sent();
                                _p.label = 17;
                            case 17:
                                _f++;
                                return [3 /*break*/, 15];
                            case 18:
                                _h = 0, _j = stack.inlineLevel;
                                _p.label = 19;
                            case 19:
                                if (!(_h < _j.length)) return [3 /*break*/, 22];
                                child = _j[_h];
                                return [4 /*yield*/, this.renderNode(child)];
                            case 20:
                                _p.sent();
                                _p.label = 21;
                            case 21:
                                _h++;
                                return [3 /*break*/, 19];
                            case 22:
                                _k = 0, _l = stack.zeroOrAutoZIndexOrTransformedOrOpacity;
                                _p.label = 23;
                            case 23:
                                if (!(_k < _l.length)) return [3 /*break*/, 26];
                                child = _l[_k];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 24:
                                _p.sent();
                                _p.label = 25;
                            case 25:
                                _k++;
                                return [3 /*break*/, 23];
                            case 26:
                                _m = 0, _o = stack.positiveZIndex;
                                _p.label = 27;
                            case 27:
                                if (!(_m < _o.length)) return [3 /*break*/, 30];
                                child = _o[_m];
                                return [4 /*yield*/, this.renderStack(child)];
                            case 28:
                                _p.sent();
                                _p.label = 29;
                            case 29:
                                _m++;
                                return [3 /*break*/, 27];
                            case 30: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.mask = function (paths) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(this.canvas.width, 0);
                this.ctx.lineTo(this.canvas.width, this.canvas.height);
                this.ctx.lineTo(0, this.canvas.height);
                this.ctx.lineTo(0, 0);
                this.formatPath(paths.slice(0).reverse());
                this.ctx.closePath();
            };
            CanvasRenderer.prototype.path = function (paths) {
                this.ctx.beginPath();
                this.formatPath(paths);
                this.ctx.closePath();
            };
            CanvasRenderer.prototype.formatPath = function (paths) {
                var _this = this;
                paths.forEach(function (point, index) {
                    var start = isBezierCurve(point) ? point.start : point;
                    if (index === 0) {
                        _this.ctx.moveTo(start.x, start.y);
                    }
                    else {
                        _this.ctx.lineTo(start.x, start.y);
                    }
                    if (isBezierCurve(point)) {
                        _this.ctx.bezierCurveTo(point.startControl.x, point.startControl.y, point.endControl.x, point.endControl.y, point.end.x, point.end.y);
                    }
                });
            };
            CanvasRenderer.prototype.renderRepeat = function (path, pattern, offsetX, offsetY) {
                this.path(path);
                this.ctx.fillStyle = pattern;
                this.ctx.translate(offsetX, offsetY);
                this.ctx.fill();
                this.ctx.translate(-offsetX, -offsetY);
            };
            CanvasRenderer.prototype.resizeImage = function (image, width, height) {
                var _a;
                if (image.width === width && image.height === height) {
                    return image;
                }
                var ownerDocument = (_a = this.canvas.ownerDocument) !== null && _a !== void 0 ? _a : document;
                var canvas = ownerDocument.createElement('canvas');
                canvas.width = Math.max(1, width);
                canvas.height = Math.max(1, height);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
                return canvas;
            };
            CanvasRenderer.prototype.renderBackgroundImage = function (container) {
                return __awaiter(this, void 0, void 0, function () {
                    var index, _loop_1, this_1, _i, _a, backgroundImage;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                index = container.styles.backgroundImage.length - 1;
                                _loop_1 = function (backgroundImage) {
                                    var image, url, _c, path, x, y, width, height, pattern, _d, path, x, y, width, height, _e, lineLength, x0, x1, y0, y1, canvas, ctx, gradient_1, pattern, _f, path, left, top_1, width, height, position, x, y, _g, rx, ry, radialGradient_1, midX, midY, f, invF;
                                    return __generator(this, function (_h) {
                                        switch (_h.label) {
                                            case 0:
                                                if (!(backgroundImage.type === 0 /* URL */)) return [3 /*break*/, 5];
                                                image = void 0;
                                                url = backgroundImage.url;
                                                _h.label = 1;
                                            case 1:
                                                _h.trys.push([1, 3, , 4]);
                                                return [4 /*yield*/, this_1.context.cache.match(url)];
                                            case 2:
                                                image = _h.sent();
                                                return [3 /*break*/, 4];
                                            case 3:
                                                _h.sent();
                                                this_1.context.logger.error("Error loading background-image " + url);
                                                return [3 /*break*/, 4];
                                            case 4:
                                                if (image) {
                                                    _c = calculateBackgroundRendering(container, index, [
                                                        image.width,
                                                        image.height,
                                                        image.width / image.height
                                                    ]), path = _c[0], x = _c[1], y = _c[2], width = _c[3], height = _c[4];
                                                    pattern = this_1.ctx.createPattern(this_1.resizeImage(image, width, height), 'repeat');
                                                    this_1.renderRepeat(path, pattern, x, y);
                                                }
                                                return [3 /*break*/, 6];
                                            case 5:
                                                if (isLinearGradient(backgroundImage)) {
                                                    _d = calculateBackgroundRendering(container, index, [null, null, null]), path = _d[0], x = _d[1], y = _d[2], width = _d[3], height = _d[4];
                                                    _e = calculateGradientDirection(backgroundImage.angle, width, height), lineLength = _e[0], x0 = _e[1], x1 = _e[2], y0 = _e[3], y1 = _e[4];
                                                    canvas = document.createElement('canvas');
                                                    canvas.width = width;
                                                    canvas.height = height;
                                                    ctx = canvas.getContext('2d');
                                                    gradient_1 = ctx.createLinearGradient(x0, y0, x1, y1);
                                                    processColorStops(backgroundImage.stops, lineLength).forEach(function (colorStop) {
                                                        return gradient_1.addColorStop(colorStop.stop, asString(colorStop.color));
                                                    });
                                                    ctx.fillStyle = gradient_1;
                                                    ctx.fillRect(0, 0, width, height);
                                                    if (width > 0 && height > 0) {
                                                        pattern = this_1.ctx.createPattern(canvas, 'repeat');
                                                        this_1.renderRepeat(path, pattern, x, y);
                                                    }
                                                }
                                                else if (isRadialGradient(backgroundImage)) {
                                                    _f = calculateBackgroundRendering(container, index, [
                                                        null,
                                                        null,
                                                        null
                                                    ]), path = _f[0], left = _f[1], top_1 = _f[2], width = _f[3], height = _f[4];
                                                    position = backgroundImage.position.length === 0 ? [FIFTY_PERCENT] : backgroundImage.position;
                                                    x = getAbsoluteValue(position[0], width);
                                                    y = getAbsoluteValue(position[position.length - 1], height);
                                                    _g = calculateRadius(backgroundImage, x, y, width, height), rx = _g[0], ry = _g[1];
                                                    if (rx > 0 && ry > 0) {
                                                        radialGradient_1 = this_1.ctx.createRadialGradient(left + x, top_1 + y, 0, left + x, top_1 + y, rx);
                                                        processColorStops(backgroundImage.stops, rx * 2).forEach(function (colorStop) {
                                                            return radialGradient_1.addColorStop(colorStop.stop, asString(colorStop.color));
                                                        });
                                                        this_1.path(path);
                                                        this_1.ctx.fillStyle = radialGradient_1;
                                                        if (rx !== ry) {
                                                            midX = container.bounds.left + 0.5 * container.bounds.width;
                                                            midY = container.bounds.top + 0.5 * container.bounds.height;
                                                            f = ry / rx;
                                                            invF = 1 / f;
                                                            this_1.ctx.save();
                                                            this_1.ctx.translate(midX, midY);
                                                            this_1.ctx.transform(1, 0, 0, f, 0, 0);
                                                            this_1.ctx.translate(-midX, -midY);
                                                            this_1.ctx.fillRect(left, invF * (top_1 - midY) + midY, width, height * invF);
                                                            this_1.ctx.restore();
                                                        }
                                                        else {
                                                            this_1.ctx.fill();
                                                        }
                                                    }
                                                }
                                                _h.label = 6;
                                            case 6:
                                                index--;
                                                return [2 /*return*/];
                                        }
                                    });
                                };
                                this_1 = this;
                                _i = 0, _a = container.styles.backgroundImage.slice(0).reverse();
                                _b.label = 1;
                            case 1:
                                if (!(_i < _a.length)) return [3 /*break*/, 4];
                                backgroundImage = _a[_i];
                                return [5 /*yield**/, _loop_1(backgroundImage)];
                            case 2:
                                _b.sent();
                                _b.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderSolidBorder = function (color, side, curvePoints) {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        this.path(parsePathForBorder(curvePoints, side));
                        this.ctx.fillStyle = asString(color);
                        this.ctx.fill();
                        return [2 /*return*/];
                    });
                });
            };
            CanvasRenderer.prototype.renderDoubleBorder = function (color, width, side, curvePoints) {
                return __awaiter(this, void 0, void 0, function () {
                    var outerPaths, innerPaths;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(width < 3)) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.renderSolidBorder(color, side, curvePoints)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                            case 2:
                                outerPaths = parsePathForBorderDoubleOuter(curvePoints, side);
                                this.path(outerPaths);
                                this.ctx.fillStyle = asString(color);
                                this.ctx.fill();
                                innerPaths = parsePathForBorderDoubleInner(curvePoints, side);
                                this.path(innerPaths);
                                this.ctx.fill();
                                return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderNodeBackgroundAndBorders = function (paint) {
                return __awaiter(this, void 0, void 0, function () {
                    var styles, hasBackground, borders, backgroundPaintingArea, side, _i, borders_1, border;
                    var _this = this;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                this.applyEffects(paint.getEffects(2 /* BACKGROUND_BORDERS */));
                                styles = paint.container.styles;
                                hasBackground = !isTransparent(styles.backgroundColor) || styles.backgroundImage.length;
                                borders = [
                                    { style: styles.borderTopStyle, color: styles.borderTopColor, width: styles.borderTopWidth },
                                    { style: styles.borderRightStyle, color: styles.borderRightColor, width: styles.borderRightWidth },
                                    { style: styles.borderBottomStyle, color: styles.borderBottomColor, width: styles.borderBottomWidth },
                                    { style: styles.borderLeftStyle, color: styles.borderLeftColor, width: styles.borderLeftWidth }
                                ];
                                backgroundPaintingArea = calculateBackgroundCurvedPaintingArea(getBackgroundValueForIndex(styles.backgroundClip, 0), paint.curves);
                                if (!(hasBackground || styles.boxShadow.length)) return [3 /*break*/, 2];
                                this.ctx.save();
                                this.path(backgroundPaintingArea);
                                this.ctx.clip();
                                if (!isTransparent(styles.backgroundColor)) {
                                    this.ctx.fillStyle = asString(styles.backgroundColor);
                                    this.ctx.fill();
                                }
                                return [4 /*yield*/, this.renderBackgroundImage(paint.container)];
                            case 1:
                                _a.sent();
                                this.ctx.restore();
                                styles.boxShadow
                                    .slice(0)
                                    .reverse()
                                    .forEach(function (shadow) {
                                    _this.ctx.save();
                                    var borderBoxArea = calculateBorderBoxPath(paint.curves);
                                    var maskOffset = shadow.inset ? 0 : MASK_OFFSET;
                                    var shadowPaintingArea = transformPath(borderBoxArea, -maskOffset + (shadow.inset ? 1 : -1) * shadow.spread.number, (shadow.inset ? 1 : -1) * shadow.spread.number, shadow.spread.number * (shadow.inset ? -2 : 2), shadow.spread.number * (shadow.inset ? -2 : 2));
                                    if (shadow.inset) {
                                        _this.path(borderBoxArea);
                                        _this.ctx.clip();
                                        _this.mask(shadowPaintingArea);
                                    }
                                    else {
                                        _this.mask(borderBoxArea);
                                        _this.ctx.clip();
                                        _this.path(shadowPaintingArea);
                                    }
                                    _this.ctx.shadowOffsetX = shadow.offsetX.number + maskOffset;
                                    _this.ctx.shadowOffsetY = shadow.offsetY.number;
                                    _this.ctx.shadowColor = asString(shadow.color);
                                    _this.ctx.shadowBlur = shadow.blur.number;
                                    _this.ctx.fillStyle = shadow.inset ? asString(shadow.color) : 'rgba(0,0,0,1)';
                                    _this.ctx.fill();
                                    _this.ctx.restore();
                                });
                                _a.label = 2;
                            case 2:
                                side = 0;
                                _i = 0, borders_1 = borders;
                                _a.label = 3;
                            case 3:
                                if (!(_i < borders_1.length)) return [3 /*break*/, 13];
                                border = borders_1[_i];
                                if (!(border.style !== 0 /* NONE */ && !isTransparent(border.color) && border.width > 0)) return [3 /*break*/, 11];
                                if (!(border.style === 2 /* DASHED */)) return [3 /*break*/, 5];
                                return [4 /*yield*/, this.renderDashedDottedBorder(border.color, border.width, side, paint.curves, 2 /* DASHED */)];
                            case 4:
                                _a.sent();
                                return [3 /*break*/, 11];
                            case 5:
                                if (!(border.style === 3 /* DOTTED */)) return [3 /*break*/, 7];
                                return [4 /*yield*/, this.renderDashedDottedBorder(border.color, border.width, side, paint.curves, 3 /* DOTTED */)];
                            case 6:
                                _a.sent();
                                return [3 /*break*/, 11];
                            case 7:
                                if (!(border.style === 4 /* DOUBLE */)) return [3 /*break*/, 9];
                                return [4 /*yield*/, this.renderDoubleBorder(border.color, border.width, side, paint.curves)];
                            case 8:
                                _a.sent();
                                return [3 /*break*/, 11];
                            case 9: return [4 /*yield*/, this.renderSolidBorder(border.color, side, paint.curves)];
                            case 10:
                                _a.sent();
                                _a.label = 11;
                            case 11:
                                side++;
                                _a.label = 12;
                            case 12:
                                _i++;
                                return [3 /*break*/, 3];
                            case 13: return [2 /*return*/];
                        }
                    });
                });
            };
            CanvasRenderer.prototype.renderDashedDottedBorder = function (color, width, side, curvePoints, style) {
                return __awaiter(this, void 0, void 0, function () {
                    var strokePaths, boxPaths, startX, startY, endX, endY, length, dashLength, spaceLength, useLineDash, multiplier, numberOfDashes, minSpace, maxSpace, path1, path2, path1, path2;
                    return __generator(this, function (_a) {
                        this.ctx.save();
                        strokePaths = parsePathForBorderStroke(curvePoints, side);
                        boxPaths = parsePathForBorder(curvePoints, side);
                        if (style === 2 /* DASHED */) {
                            this.path(boxPaths);
                            this.ctx.clip();
                        }
                        if (isBezierCurve(boxPaths[0])) {
                            startX = boxPaths[0].start.x;
                            startY = boxPaths[0].start.y;
                        }
                        else {
                            startX = boxPaths[0].x;
                            startY = boxPaths[0].y;
                        }
                        if (isBezierCurve(boxPaths[1])) {
                            endX = boxPaths[1].end.x;
                            endY = boxPaths[1].end.y;
                        }
                        else {
                            endX = boxPaths[1].x;
                            endY = boxPaths[1].y;
                        }
                        if (side === 0 || side === 2) {
                            length = Math.abs(startX - endX);
                        }
                        else {
                            length = Math.abs(startY - endY);
                        }
                        this.ctx.beginPath();
                        if (style === 3 /* DOTTED */) {
                            this.formatPath(strokePaths);
                        }
                        else {
                            this.formatPath(boxPaths.slice(0, 2));
                        }
                        dashLength = width < 3 ? width * 3 : width * 2;
                        spaceLength = width < 3 ? width * 2 : width;
                        if (style === 3 /* DOTTED */) {
                            dashLength = width;
                            spaceLength = width;
                        }
                        useLineDash = true;
                        if (length <= dashLength * 2) {
                            useLineDash = false;
                        }
                        else if (length <= dashLength * 2 + spaceLength) {
                            multiplier = length / (2 * dashLength + spaceLength);
                            dashLength *= multiplier;
                            spaceLength *= multiplier;
                        }
                        else {
                            numberOfDashes = Math.floor((length + spaceLength) / (dashLength + spaceLength));
                            minSpace = (length - numberOfDashes * dashLength) / (numberOfDashes - 1);
                            maxSpace = (length - (numberOfDashes + 1) * dashLength) / numberOfDashes;
                            spaceLength =
                                maxSpace <= 0 || Math.abs(spaceLength - minSpace) < Math.abs(spaceLength - maxSpace)
                                    ? minSpace
                                    : maxSpace;
                        }
                        if (useLineDash) {
                            if (style === 3 /* DOTTED */) {
                                this.ctx.setLineDash([0, dashLength + spaceLength]);
                            }
                            else {
                                this.ctx.setLineDash([dashLength, spaceLength]);
                            }
                        }
                        if (style === 3 /* DOTTED */) {
                            this.ctx.lineCap = 'round';
                            this.ctx.lineWidth = width;
                        }
                        else {
                            this.ctx.lineWidth = width * 2 + 1.1;
                        }
                        this.ctx.strokeStyle = asString(color);
                        this.ctx.stroke();
                        this.ctx.setLineDash([]);
                        // dashed round edge gap
                        if (style === 2 /* DASHED */) {
                            if (isBezierCurve(boxPaths[0])) {
                                path1 = boxPaths[3];
                                path2 = boxPaths[0];
                                this.ctx.beginPath();
                                this.formatPath([new Vector(path1.end.x, path1.end.y), new Vector(path2.start.x, path2.start.y)]);
                                this.ctx.stroke();
                            }
                            if (isBezierCurve(boxPaths[1])) {
                                path1 = boxPaths[1];
                                path2 = boxPaths[2];
                                this.ctx.beginPath();
                                this.formatPath([new Vector(path1.end.x, path1.end.y), new Vector(path2.start.x, path2.start.y)]);
                                this.ctx.stroke();
                            }
                        }
                        this.ctx.restore();
                        return [2 /*return*/];
                    });
                });
            };
            CanvasRenderer.prototype.render = function (element) {
                return __awaiter(this, void 0, void 0, function () {
                    var stack;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (this.options.backgroundColor) {
                                    this.ctx.fillStyle = asString(this.options.backgroundColor);
                                    this.ctx.fillRect(this.options.x, this.options.y, this.options.width, this.options.height);
                                }
                                stack = parseStackingContexts(element);
                                return [4 /*yield*/, this.renderStack(stack)];
                            case 1:
                                _a.sent();
                                this.applyEffects([]);
                                return [2 /*return*/, this.canvas];
                        }
                    });
                });
            };
            return CanvasRenderer;
        }(Renderer));
        var isTextInputElement = function (container) {
            if (container instanceof TextareaElementContainer) {
                return true;
            }
            else if (container instanceof SelectElementContainer) {
                return true;
            }
            else if (container instanceof InputElementContainer && container.type !== RADIO && container.type !== CHECKBOX) {
                return true;
            }
            return false;
        };
        var calculateBackgroundCurvedPaintingArea = function (clip, curves) {
            switch (clip) {
                case 0 /* BORDER_BOX */:
                    return calculateBorderBoxPath(curves);
                case 2 /* CONTENT_BOX */:
                    return calculateContentBoxPath(curves);
                case 1 /* PADDING_BOX */:
                default:
                    return calculatePaddingBoxPath(curves);
            }
        };
        var canvasTextAlign = function (textAlign) {
            switch (textAlign) {
                case 1 /* CENTER */:
                    return 'center';
                case 2 /* RIGHT */:
                    return 'right';
                case 0 /* LEFT */:
                default:
                    return 'left';
            }
        };
        // see https://github.com/niklasvh/html2canvas/pull/2645
        var iOSBrokenFonts = ['-apple-system', 'system-ui'];
        var fixIOSSystemFonts = function (fontFamilies) {
            return /iPhone OS 15_(0|1)/.test(window.navigator.userAgent)
                ? fontFamilies.filter(function (fontFamily) { return iOSBrokenFonts.indexOf(fontFamily) === -1; })
                : fontFamilies;
        };

        var ForeignObjectRenderer = /** @class */ (function (_super) {
            __extends(ForeignObjectRenderer, _super);
            function ForeignObjectRenderer(context, options) {
                var _this = _super.call(this, context, options) || this;
                _this.canvas = options.canvas ? options.canvas : document.createElement('canvas');
                _this.ctx = _this.canvas.getContext('2d');
                _this.options = options;
                _this.canvas.width = Math.floor(options.width * options.scale);
                _this.canvas.height = Math.floor(options.height * options.scale);
                _this.canvas.style.width = options.width + "px";
                _this.canvas.style.height = options.height + "px";
                _this.ctx.scale(_this.options.scale, _this.options.scale);
                _this.ctx.translate(-options.x, -options.y);
                _this.context.logger.debug("EXPERIMENTAL ForeignObject renderer initialized (" + options.width + "x" + options.height + " at " + options.x + "," + options.y + ") with scale " + options.scale);
                return _this;
            }
            ForeignObjectRenderer.prototype.render = function (element) {
                return __awaiter(this, void 0, void 0, function () {
                    var svg, img;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                svg = createForeignObjectSVG(this.options.width * this.options.scale, this.options.height * this.options.scale, this.options.scale, this.options.scale, element);
                                return [4 /*yield*/, loadSerializedSVG(svg)];
                            case 1:
                                img = _a.sent();
                                if (this.options.backgroundColor) {
                                    this.ctx.fillStyle = asString(this.options.backgroundColor);
                                    this.ctx.fillRect(0, 0, this.options.width * this.options.scale, this.options.height * this.options.scale);
                                }
                                this.ctx.drawImage(img, -this.options.x * this.options.scale, -this.options.y * this.options.scale);
                                return [2 /*return*/, this.canvas];
                        }
                    });
                });
            };
            return ForeignObjectRenderer;
        }(Renderer));
        var loadSerializedSVG = function (svg) {
            return new Promise(function (resolve, reject) {
                var img = new Image();
                img.onload = function () {
                    resolve(img);
                };
                img.onerror = reject;
                img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
            });
        };

        var Logger = /** @class */ (function () {
            function Logger(_a) {
                var id = _a.id, enabled = _a.enabled;
                this.id = id;
                this.enabled = enabled;
                this.start = Date.now();
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.debug = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.debug === 'function') {
                        // eslint-disable-next-line no-console
                        console.debug.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                    else {
                        this.info.apply(this, args);
                    }
                }
            };
            Logger.prototype.getTime = function () {
                return Date.now() - this.start;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.info = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.info === 'function') {
                        // eslint-disable-next-line no-console
                        console.info.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.warn = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.warn === 'function') {
                        // eslint-disable-next-line no-console
                        console.warn.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                    else {
                        this.info.apply(this, args);
                    }
                }
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Logger.prototype.error = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                if (this.enabled) {
                    // eslint-disable-next-line no-console
                    if (typeof window !== 'undefined' && window.console && typeof console.error === 'function') {
                        // eslint-disable-next-line no-console
                        console.error.apply(console, __spreadArray([this.id, this.getTime() + "ms"], args));
                    }
                    else {
                        this.info.apply(this, args);
                    }
                }
            };
            Logger.instances = {};
            return Logger;
        }());

        var Context = /** @class */ (function () {
            function Context(options, windowBounds) {
                var _a;
                this.windowBounds = windowBounds;
                this.instanceName = "#" + Context.instanceCount++;
                this.logger = new Logger({ id: this.instanceName, enabled: options.logging });
                this.cache = (_a = options.cache) !== null && _a !== void 0 ? _a : new Cache(this, options);
            }
            Context.instanceCount = 1;
            return Context;
        }());

        var html2canvas = function (element, options) {
            if (options === void 0) { options = {}; }
            return renderElement(element, options);
        };
        if (typeof window !== 'undefined') {
            CacheStorage.setContext(window);
        }
        var renderElement = function (element, opts) { return __awaiter(void 0, void 0, void 0, function () {
            var ownerDocument, defaultView, resourceOptions, contextOptions, windowOptions, windowBounds, context, foreignObjectRendering, cloneOptions, documentCloner, clonedElement, container, _a, width, height, left, top, backgroundColor, renderOptions, canvas, renderer, root, renderer;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return __generator(this, function (_u) {
                switch (_u.label) {
                    case 0:
                        if (!element || typeof element !== 'object') {
                            return [2 /*return*/, Promise.reject('Invalid element provided as first argument')];
                        }
                        ownerDocument = element.ownerDocument;
                        if (!ownerDocument) {
                            throw new Error("Element is not attached to a Document");
                        }
                        defaultView = ownerDocument.defaultView;
                        if (!defaultView) {
                            throw new Error("Document is not attached to a Window");
                        }
                        resourceOptions = {
                            allowTaint: (_b = opts.allowTaint) !== null && _b !== void 0 ? _b : false,
                            imageTimeout: (_c = opts.imageTimeout) !== null && _c !== void 0 ? _c : 15000,
                            proxy: opts.proxy,
                            useCORS: (_d = opts.useCORS) !== null && _d !== void 0 ? _d : false
                        };
                        contextOptions = __assign({ logging: (_e = opts.logging) !== null && _e !== void 0 ? _e : true, cache: opts.cache }, resourceOptions);
                        windowOptions = {
                            windowWidth: (_f = opts.windowWidth) !== null && _f !== void 0 ? _f : defaultView.innerWidth,
                            windowHeight: (_g = opts.windowHeight) !== null && _g !== void 0 ? _g : defaultView.innerHeight,
                            scrollX: (_h = opts.scrollX) !== null && _h !== void 0 ? _h : defaultView.pageXOffset,
                            scrollY: (_j = opts.scrollY) !== null && _j !== void 0 ? _j : defaultView.pageYOffset
                        };
                        windowBounds = new Bounds(windowOptions.scrollX, windowOptions.scrollY, windowOptions.windowWidth, windowOptions.windowHeight);
                        context = new Context(contextOptions, windowBounds);
                        foreignObjectRendering = (_k = opts.foreignObjectRendering) !== null && _k !== void 0 ? _k : false;
                        cloneOptions = {
                            allowTaint: (_l = opts.allowTaint) !== null && _l !== void 0 ? _l : false,
                            onclone: opts.onclone,
                            ignoreElements: opts.ignoreElements,
                            inlineImages: foreignObjectRendering,
                            copyStyles: foreignObjectRendering
                        };
                        context.logger.debug("Starting document clone with size " + windowBounds.width + "x" + windowBounds.height + " scrolled to " + -windowBounds.left + "," + -windowBounds.top);
                        documentCloner = new DocumentCloner(context, element, cloneOptions);
                        clonedElement = documentCloner.clonedReferenceElement;
                        if (!clonedElement) {
                            return [2 /*return*/, Promise.reject("Unable to find element in cloned iframe")];
                        }
                        return [4 /*yield*/, documentCloner.toIFrame(ownerDocument, windowBounds)];
                    case 1:
                        container = _u.sent();
                        _a = isBodyElement(clonedElement) || isHTMLElement(clonedElement)
                            ? parseDocumentSize(clonedElement.ownerDocument)
                            : parseBounds(context, clonedElement), width = _a.width, height = _a.height, left = _a.left, top = _a.top;
                        backgroundColor = parseBackgroundColor(context, clonedElement, opts.backgroundColor);
                        renderOptions = {
                            canvas: opts.canvas,
                            backgroundColor: backgroundColor,
                            scale: (_o = (_m = opts.scale) !== null && _m !== void 0 ? _m : defaultView.devicePixelRatio) !== null && _o !== void 0 ? _o : 1,
                            x: ((_p = opts.x) !== null && _p !== void 0 ? _p : 0) + left,
                            y: ((_q = opts.y) !== null && _q !== void 0 ? _q : 0) + top,
                            width: (_r = opts.width) !== null && _r !== void 0 ? _r : Math.ceil(width),
                            height: (_s = opts.height) !== null && _s !== void 0 ? _s : Math.ceil(height)
                        };
                        if (!foreignObjectRendering) return [3 /*break*/, 3];
                        context.logger.debug("Document cloned, using foreign object rendering");
                        renderer = new ForeignObjectRenderer(context, renderOptions);
                        return [4 /*yield*/, renderer.render(clonedElement)];
                    case 2:
                        canvas = _u.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        context.logger.debug("Document cloned, element located at " + left + "," + top + " with size " + width + "x" + height + " using computed rendering");
                        context.logger.debug("Starting DOM parsing");
                        root = parseTree(context, clonedElement);
                        if (backgroundColor === root.styles.backgroundColor) {
                            root.styles.backgroundColor = COLORS.TRANSPARENT;
                        }
                        context.logger.debug("Starting renderer for element at " + renderOptions.x + "," + renderOptions.y + " with size " + renderOptions.width + "x" + renderOptions.height);
                        renderer = new CanvasRenderer(context, renderOptions);
                        return [4 /*yield*/, renderer.render(root)];
                    case 4:
                        canvas = _u.sent();
                        _u.label = 5;
                    case 5:
                        if ((_t = opts.removeContainer) !== null && _t !== void 0 ? _t : true) {
                            if (!DocumentCloner.destroy(container)) {
                                context.logger.error("Cannot detach cloned iframe as it is not in the DOM anymore");
                            }
                        }
                        context.logger.debug("Finished rendering");
                        return [2 /*return*/, canvas];
                }
            });
        }); };
        var parseBackgroundColor = function (context, element, backgroundColorOverride) {
            var ownerDocument = element.ownerDocument;
            // http://www.w3.org/TR/css3-background/#special-backgrounds
            var documentBackgroundColor = ownerDocument.documentElement
                ? parseColor(context, getComputedStyle(ownerDocument.documentElement).backgroundColor)
                : COLORS.TRANSPARENT;
            var bodyBackgroundColor = ownerDocument.body
                ? parseColor(context, getComputedStyle(ownerDocument.body).backgroundColor)
                : COLORS.TRANSPARENT;
            var defaultBackgroundColor = typeof backgroundColorOverride === 'string'
                ? parseColor(context, backgroundColorOverride)
                : backgroundColorOverride === null
                    ? COLORS.TRANSPARENT
                    : 0xffffffff;
            return element === ownerDocument.documentElement
                ? isTransparent(documentBackgroundColor)
                    ? isTransparent(bodyBackgroundColor)
                        ? defaultBackgroundColor
                        : bodyBackgroundColor
                    : documentBackgroundColor
                : defaultBackgroundColor;
        };

        return html2canvas;

    })));

    });

    // Simple color name lookup for common colors
    // Source: https://github.com/meodai/color-names/blob/master/src/colornames.bestof.json (truncated for brevity)
    // You can expand this list as needed
    // Minimal color list; expand as needed
    const colors = [{"name":"100 Mph","hex":"#c93f38"},{"name":"20000 Leagues Under the Sea","hex":"#191970"},{"name":"24 Carrot","hex":"#e56e24"},{"name":"24 Karat","hex":"#dfc685"},{"name":"3AM in Shibuya","hex":"#225577"},{"name":"3am Latte","hex":"#c0a98e"},{"name":"8 Bit Eggplant","hex":"#990066"},{"name":"A Dime a Dozen","hex":"#d3dde4"},{"name":"À L’Orange","hex":"#f2850d"},{"name":"A Smell of Bakery","hex":"#f3e9d9"},{"name":"A State of Mint","hex":"#88ffcc"},{"name":"Abandoned Spaceship","hex":"#747a8a"},{"name":"Abloom","hex":"#f1cbcd"},{"name":"Abyssal","hex":"#404c57"},{"name":"Abyssal Waters","hex":"#005765"},{"name":"Acapulco Dive","hex":"#65a7dd"},{"name":"Acid","hex":"#00ff22"},{"name":"Acid Green","hex":"#8ffe09"},{"name":"Acorn","hex":"#7f5e50"},{"name":"Acoustic Brown","hex":"#766b69"},{"name":"Active Volcano","hex":"#bb1133"},{"name":"Admiral Blue","hex":"#50647f"},{"name":"Adrift on the Nile","hex":"#93b8e3"},{"name":"After Midnight","hex":"#38393f"},{"name":"After the Storm","hex":"#33616a"},{"name":"Afternoon Coffee","hex":"#6e544b"},{"name":"Aged Antics","hex":"#886b2e"},{"name":"Agressive Aqua","hex":"#00fbff"},{"name":"Ahoy! Blue","hex":"#0082a1"},{"name":"Air-Kiss","hex":"#f6dcd2"},{"name":"Airborne","hex":"#a2c2d0"},{"name":"Akari Red","hex":"#c90b42"},{"name":"Alarm","hex":"#ec0003"},{"name":"Alaska","hex":"#dadad1"},{"name":"Alien Abduction","hex":"#0cff0c"},{"name":"Alienated","hex":"#00cc55"},{"name":"Alley Cat","hex":"#656874"},{"name":"Alligator","hex":"#886600"},{"name":"Alligator Alley","hex":"#c5d17b"},{"name":"Almond","hex":"#eddcc8"},{"name":"Almond Milk","hex":"#d2c9b8"},{"name":"Aloe Tip","hex":"#8a9480"},{"name":"Aloe Vera","hex":"#678779"},{"name":"Alone in the Dark","hex":"#000066"},{"name":"Alpaca","hex":"#f7e5da"},{"name":"Alpine Expedition","hex":"#99eeff"},{"name":"Aluminium","hex":"#848789"},{"name":"Always Green Grass","hex":"#11aa00"},{"name":"Amaretto","hex":"#ab6f60"},{"name":"Amaretto Sour","hex":"#c09856"},{"name":"Amazon","hex":"#387b54"},{"name":"Amber","hex":"#ffbf00"},{"name":"Ambrosia","hex":"#c6e1bc"},{"name":"Ambrosial Oceanside","hex":"#47ae9c"},{"name":"Amnesiac White","hex":"#f8fbeb"},{"name":"Amor","hex":"#ee3377"},{"name":"Amora Purple","hex":"#bb22aa"},{"name":"Amore","hex":"#ae2f48"},{"name":"Anarchist","hex":"#db304a"},{"name":"Anchovy","hex":"#756f6b"},{"name":"Ancient Pine","hex":"#444b43"},{"name":"Ancient Scroll","hex":"#f0e4d1"},{"name":"Andromeda Blue","hex":"#abcdee"},{"name":"Angel Wing","hex":"#f3dfd7"},{"name":"Angel’s Trumpet","hex":"#f6dd34"},{"name":"Angelic White","hex":"#f4ede4"},{"name":"Anger","hex":"#dd0055"},{"name":"Angry Flamingo","hex":"#f04e45"},{"name":"Angry Ghost","hex":"#eebbbb"},{"name":"Angry Pasta","hex":"#ffcc55"},{"name":"Angry Tomato","hex":"#d82029"},{"name":"Animal Kingdom","hex":"#bcc09e"},{"name":"Anime Blush","hex":"#ff7a83"},{"name":"Anise Biscotti","hex":"#e5d5ae"},{"name":"Anna Banana","hex":"#f5d547"},{"name":"Annatto","hex":"#8c5341"},{"name":"Another One Bites the Dust","hex":"#c7bba4"},{"name":"Antarctic Love","hex":"#eddee6"},{"name":"Anthracite","hex":"#28282d"},{"name":"Antique","hex":"#8b846d"},{"name":"Antique Brass","hex":"#6c461f"},{"name":"Antique Port Wine","hex":"#98211a"},{"name":"Aphrodisiac","hex":"#e35a63"},{"name":"Aphrodite Aqua","hex":"#45e9c1"},{"name":"Aphroditean Fuchsia","hex":"#dd14ab"},{"name":"Apocalyptic Orange","hex":"#f4711e"},{"name":"Apollo Landing","hex":"#e5e5e1"},{"name":"Apple Cherry","hex":"#f81404"},{"name":"Apricot","hex":"#ffb16d"},{"name":"Apricot Freeze","hex":"#f3cfb7"},{"name":"Apricot Haze","hex":"#ffaaaa"},{"name":"Apricot Sherbet","hex":"#fbcd9f"},{"name":"Apricotta","hex":"#d8a48f"},{"name":"April Showers","hex":"#dadeb5"},{"name":"Aqua","hex":"#00ffff"},{"name":"Aqua Fiesta","hex":"#96e2e1"},{"name":"Aquamarine","hex":"#2ee8bb"},{"name":"Aquarius","hex":"#2db0ce"},{"name":"Aquatic","hex":"#99c1cc"},{"name":"Aquatic Edge","hex":"#bfd6d1"},{"name":"Arabica Mint","hex":"#c0ffee"},{"name":"Arancio","hex":"#ff7013"},{"name":"Arcade Fire","hex":"#ee3311"},{"name":"Arcane Red","hex":"#6a2f2f"},{"name":"Archeology","hex":"#6e6a5e"},{"name":"Arctic","hex":"#648589"},{"name":"Arctic Ice","hex":"#b6bdd0"},{"name":"Arctic Water","hex":"#00fcfc"},{"name":"Argan Oil","hex":"#9d6646"},{"name":"Argent","hex":"#888888"},{"name":"Argento","hex":"#cecac3"},{"name":"Ariel","hex":"#aed7ea"},{"name":"Aristocratic Velvet","hex":"#980b4a"},{"name":"Armadillo","hex":"#484a46"},{"name":"Armor","hex":"#74857f"},{"name":"Aromatic Herbs","hex":"#98c945"},{"name":"Around the Gills","hex":"#a1b670"},{"name":"Arrowwood","hex":"#b3861e"},{"name":"Arsenic","hex":"#3b444b"},{"name":"Artichoke","hex":"#8f9779"},{"name":"Artisans Gold","hex":"#f2ab46"},{"name":"Artist’s Charcoal","hex":"#37393e"},{"name":"Arugula","hex":"#75ad5b"},{"name":"Ash","hex":"#bebaa7"},{"name":"Ashes to Ashes","hex":"#bbb3a2"},{"name":"Asian Spice","hex":"#118822"},{"name":"Asparagus","hex":"#77ab56"},{"name":"Asphalt","hex":"#130a06"},{"name":"Assassin","hex":"#2d4f83"},{"name":"Assassin’s Red","hex":"#f60206"},{"name":"Aster","hex":"#867ba9"},{"name":"Astral","hex":"#376f89"},{"name":"Atlantic Navy","hex":"#13336f"},{"name":"Atlantis","hex":"#336172"},{"name":"Atlas Cedar","hex":"#5ca0a7"},{"name":"Atomic Lime","hex":"#b9ff03"},{"name":"Atomic Orange","hex":"#f88605"},{"name":"Atomic Pink","hex":"#fb7efd"},{"name":"Atomic Tangerine","hex":"#ff9966"},{"name":"Aubergine","hex":"#372528"},{"name":"Augustus Asparagus","hex":"#90aa0b"},{"name":"Aurora","hex":"#ebd147"},{"name":"Autumn Crocodile","hex":"#447744"},{"name":"Autumn Fire","hex":"#c44e4f"},{"name":"Autumn Gold","hex":"#7d623c"},{"name":"Autumnal","hex":"#ad5928"},{"name":"Avant-Garde Pink","hex":"#ff77ee"},{"name":"Avocado","hex":"#568203"},{"name":"Avocado Stone","hex":"#4e3e1f"},{"name":"Award Winning White","hex":"#fef0de"},{"name":"Awkward Purple","hex":"#d208cc"},{"name":"Ayahuasca Vine","hex":"#665500"},{"name":"Aztec","hex":"#293432"},{"name":"Aztec Temple","hex":"#84705b"},{"name":"Aztec Warrior","hex":"#bb0066"},{"name":"Azulado","hex":"#211d49"},{"name":"Azure","hex":"#007fff"},{"name":"Baba Ganoush","hex":"#eebb88"},{"name":"Babe","hex":"#dc7b7c"},{"name":"Baby Bear","hex":"#6f5944"},{"name":"Baby Blue","hex":"#a2cffe"},{"name":"Baby Pink","hex":"#ffb7ce"},{"name":"Back In Black","hex":"#16141c"},{"name":"Backyard","hex":"#879877"},{"name":"Bacon Strips","hex":"#df3f32"},{"name":"Badass Grass","hex":"#b4da55"},{"name":"Baker’s Bread","hex":"#d0b393"},{"name":"Baker’s Dream","hex":"#c98f70"},{"name":"Bakery Brown","hex":"#ab9078"},{"name":"Baklava","hex":"#efb435"},{"name":"Ballerina","hex":"#f2cfdc"},{"name":"Ballet","hex":"#f7d5d4"},{"name":"Ballet Slippers","hex":"#fca2ad"},{"name":"Balsamico","hex":"#130d07"},{"name":"Baltic","hex":"#279d9f"},{"name":"Baltic Amber","hex":"#fbb782"},{"name":"Bambino","hex":"#8edacc"},{"name":"Bamboo Forest","hex":"#b1a979"},{"name":"Banan-appeal","hex":"#faf3a6"},{"name":"Banana","hex":"#fffc79"},{"name":"Banana Bandanna","hex":"#f8f739"},{"name":"Banana Bombshell","hex":"#f7e82e"},{"name":"Banana Bread","hex":"#ffcf73"},{"name":"Banana Brick","hex":"#e8d82c"},{"name":"Banana Cream","hex":"#fff49c"},{"name":"Banana Drama","hex":"#f1d548"},{"name":"Banana Flash","hex":"#eefe02"},{"name":"Banana Frappé","hex":"#ddd5b6"},{"name":"Banana King","hex":"#fffb08"},{"name":"Banana Mania","hex":"#fbe7b2"},{"name":"Banana Milk","hex":"#fff7ad"},{"name":"Banana Pepper","hex":"#fdd630"},{"name":"Banana Propaganda","hex":"#f3db00"},{"name":"Banana Republic","hex":"#ffe292"},{"name":"Banana Split","hex":"#f7eec8"},{"name":"Bancha","hex":"#666a47"},{"name":"Bane of Royalty","hex":"#871466"},{"name":"Bangalore","hex":"#bbaa88"},{"name":"Bank Vault","hex":"#757374"},{"name":"Banner Gold","hex":"#a28557"},{"name":"Barbara","hex":"#ff0ff3"},{"name":"Barbarossa","hex":"#a84734"},{"name":"Barbecue","hex":"#c26157"},{"name":"Barbera","hex":"#8b031c"},{"name":"Barberry","hex":"#ee1133"},{"name":"Barista’s Favorite","hex":"#bb8d4e"},{"name":"Bark","hex":"#5f5854"},{"name":"Barolo","hex":"#71000e"},{"name":"Barrel Aged","hex":"#8b6945"},{"name":"Basil","hex":"#879f84"},{"name":"Basil Smash","hex":"#b7e1a1"},{"name":"Basketball","hex":"#ee6730"},{"name":"Basswood Green","hex":"#839e83"},{"name":"Bat Wing","hex":"#7e7466"},{"name":"Bat-Signal","hex":"#feff00"},{"name":"Bat’s Blood Soup","hex":"#ee3366"},{"name":"Bath Bubbles","hex":"#e6f2ea"},{"name":"Bath Water","hex":"#88eeee"},{"name":"Batman","hex":"#656e72"},{"name":"Bats Cloak","hex":"#1f1518"},{"name":"Battletoad","hex":"#11cc55"},{"name":"Bavarian Green","hex":"#749a54"},{"name":"Bay","hex":"#b3e2d3"},{"name":"Bay Leaf","hex":"#86793d"},{"name":"Bay View","hex":"#6a819e"},{"name":"Beach Dune","hex":"#c6bb9c"},{"name":"Beach Glass","hex":"#96dfce"},{"name":"Beach View","hex":"#4f7694"},{"name":"Beaches of Cancun","hex":"#fbedd7"},{"name":"Bear Hug","hex":"#796359"},{"name":"Beat Around the Bush","hex":"#6e6a44"},{"name":"Beau Monde","hex":"#7db39e"},{"name":"Beau Vert","hex":"#0c6064"},{"name":"Beautiful Darkness","hex":"#686d70"},{"name":"Beauty and the Beach","hex":"#c99680"},{"name":"Béchamel","hex":"#f4eee0"},{"name":"Becquerel","hex":"#4bec13"},{"name":"Bee Yellow","hex":"#feff32"},{"name":"Beefy Pink","hex":"#debeef"},{"name":"Beekeeper","hex":"#f6e491"},{"name":"Beer","hex":"#fcaa12"},{"name":"Beeswax","hex":"#e9d7ab"},{"name":"Beet Red","hex":"#7e203f"},{"name":"Beetroot Purple","hex":"#d33376"},{"name":"Begonia","hex":"#fa6e79"},{"name":"Beige","hex":"#e6daa6"},{"name":"Beige and Sage","hex":"#bbc199"},{"name":"Bejewelled","hex":"#25a26f"},{"name":"Belgian Waffle","hex":"#f3dfb6"},{"name":"Bell Tower","hex":"#dad0bb"},{"name":"Belladonna","hex":"#220011"},{"name":"Bellflower","hex":"#5d66aa"},{"name":"Bellini","hex":"#f4c9b1"},{"name":"Beloved Sunflower","hex":"#ffba24"},{"name":"Below the Surface","hex":"#0a2f7c"},{"name":"Below Zero","hex":"#87cded"},{"name":"Beluga","hex":"#eff2f1"},{"name":"Benevolent Pink","hex":"#dd1188"},{"name":"Bengal","hex":"#cc974d"},{"name":"Bento Box","hex":"#cc363c"},{"name":"Berber","hex":"#d8cfb6"},{"name":"Bergamot","hex":"#95c703"},{"name":"Bermuda","hex":"#1b7d8d"},{"name":"Bermuda Grass","hex":"#a19f79"},{"name":"Bermuda Onion","hex":"#9d5a8f"},{"name":"Berries Galore","hex":"#ab7cb4"},{"name":"Berries n Cream","hex":"#f2b8ca"},{"name":"Berry","hex":"#990f4b"},{"name":"Berry Blast","hex":"#ff017f"},{"name":"Berry Butter","hex":"#efcedc"},{"name":"Berry Good","hex":"#edc3c5"},{"name":"Berry Jam","hex":"#655883"},{"name":"Berrylicious","hex":"#d75e6c"},{"name":"Bethlehem Superstar","hex":"#eaeeda"},{"name":"Beurre Blanc","hex":"#ede1be"},{"name":"Beveled Glass","hex":"#7accb8"},{"name":"Beyond the Pines","hex":"#688049"},{"name":"Beyond the Sea","hex":"#005784"},{"name":"Beyond the Stars","hex":"#0a3251"},{"name":"Bianca","hex":"#f4efe0"},{"name":"Big Bang Pink","hex":"#ff0099"},{"name":"Big Fish to Fry","hex":"#dadbe1"},{"name":"Big Spender","hex":"#acddaf"},{"name":"Big Yellow Taxi","hex":"#ffff33"},{"name":"Bigfoot","hex":"#715145"},{"name":"Billiard","hex":"#00af9f"},{"name":"Bindi Red","hex":"#b0003c"},{"name":"Biohazard Suit","hex":"#fbfb4c"},{"name":"BioShock","hex":"#889900"},{"name":"Birch White","hex":"#f6eedf"},{"name":"Bird Bath Blue","hex":"#cddfe7"},{"name":"Biscuit","hex":"#feedca"},{"name":"Biscuit Dough","hex":"#e8dbbd"},{"name":"Bison","hex":"#6e4f3a"},{"name":"Bisque","hex":"#ffe4c4"},{"name":"Bite My Tongue","hex":"#d47d72"},{"name":"Bitter Chocolate","hex":"#4f2923"},{"name":"Bitter Lemon","hex":"#d2db32"},{"name":"Bitter Liquorice","hex":"#262926"},{"name":"Bitter Melon","hex":"#cfd1b2"},{"name":"Bittersweet","hex":"#fea051"},{"name":"Black","hex":"#000000"},{"name":"Black Box","hex":"#0f282f"},{"name":"Black Cherry","hex":"#2c1620"},{"name":"Black Chocolate","hex":"#441100"},{"name":"Black Forest","hex":"#5e6354"},{"name":"Black Hole","hex":"#010203"},{"name":"Black Knight","hex":"#010b13"},{"name":"Black Magic","hex":"#4f4554"},{"name":"Black Mana","hex":"#858585"},{"name":"Black Market","hex":"#222244"},{"name":"Black Metal","hex":"#060606"},{"name":"Black Olive","hex":"#3b3c36"},{"name":"Black Orchid","hex":"#525463"},{"name":"Black Out","hex":"#222222"},{"name":"Black Panther","hex":"#424242"},{"name":"Black Pearl","hex":"#1e272c"},{"name":"Black Power","hex":"#654b37"},{"name":"Black Sabbath","hex":"#220022"},{"name":"Black Sea Night","hex":"#052462"},{"name":"Black Sheep","hex":"#0f0d0d"},{"name":"Black Stallion","hex":"#0e191c"},{"name":"Black Truffle","hex":"#463d3e"},{"name":"Black Turmeric","hex":"#2c4364"},{"name":"Black Velvet","hex":"#222233"},{"name":"Black Wash","hex":"#0c0c0c"},{"name":"Black-Hearted","hex":"#3e1825"},{"name":"Blackberry","hex":"#43182f"},{"name":"Blackberry Yogurt","hex":"#e5bddf"},{"name":"Blackn’t","hex":"#020f03"},{"name":"Blackout","hex":"#0e0702"},{"name":"Blackwater","hex":"#545663"},{"name":"Blanc Cassé","hex":"#f1eee2"},{"name":"Blanco","hex":"#ebeae5"},{"name":"Blank Canvas","hex":"#ffefd6"},{"name":"Blank Stare","hex":"#8b9cac"},{"name":"Blasphemous Blue","hex":"#3356aa"},{"name":"Blazing","hex":"#e94e41"},{"name":"Blazing Dragonfruit","hex":"#ff0054"},{"name":"Bleached Olive","hex":"#55bb88"},{"name":"Bleached Sunflower","hex":"#fbe8a8"},{"name":"Bleeding Crimson","hex":"#9b1414"},{"name":"Bleeding Heart","hex":"#c02e4c"},{"name":"Bleu Ciel","hex":"#007ba1"},{"name":"Blindfolded","hex":"#5a5e61"},{"name":"Blinking Terminal","hex":"#66cc00"},{"name":"Blissful Serenity","hex":"#eaeed8"},{"name":"Blister Pearl","hex":"#aaffee"},{"name":"Blizzard Blue","hex":"#a3e3ed"},{"name":"Blond","hex":"#faf0be"},{"name":"Blood Brother","hex":"#770011"},{"name":"Blood Burst","hex":"#ff474c"},{"name":"Blood Donor","hex":"#ea1822"},{"name":"Blood Kiss","hex":"#c30b0a"},{"name":"Blood of My Enemies","hex":"#e0413a"},{"name":"Blood Orange","hex":"#d1001c"},{"name":"Blood Rush","hex":"#aa2222"},{"name":"Bloodhound","hex":"#bb5511"},{"name":"Bloodsport","hex":"#b52f3a"},{"name":"Bloodthirsty","hex":"#880011"},{"name":"Bloodthirsty Beige","hex":"#f8d7d0"},{"name":"Bloodthirsty Lips","hex":"#c6101e"},{"name":"Bloody Mary","hex":"#ba0105"},{"name":"Bloody Salmon","hex":"#cc4433"},{"name":"Blossom","hex":"#fee9d8"},{"name":"Blossoming Dynasty","hex":"#de5346"},{"name":"Blowing Kisses","hex":"#f6dee0"},{"name":"Blue","hex":"#0000ff"},{"name":"Blue Bay","hex":"#619ad6"},{"name":"Blue Bell","hex":"#88afd3"},{"name":"Blue Bikini","hex":"#00bbee"},{"name":"Blue Blood","hex":"#6b7f81"},{"name":"Blue Bobbin","hex":"#52b4ca"},{"name":"Blue Burst","hex":"#309cd0"},{"name":"Blue Chip","hex":"#1d5699"},{"name":"Blue Eye Samurai","hex":"#75aebd"},{"name":"Blue Funk","hex":"#2d4470"},{"name":"Blue Haze","hex":"#bdbace"},{"name":"Blue Hour","hex":"#0034ab"},{"name":"Blue Lips","hex":"#a6bce2"},{"name":"Blue Mana","hex":"#68c2f5"},{"name":"Blue Martini","hex":"#52b4d3"},{"name":"Blue Moon","hex":"#3992a8"},{"name":"Blue Overdose","hex":"#0020ef"},{"name":"Blue Ribbon","hex":"#0066ff"},{"name":"Blue Screen of Death","hex":"#0033bb"},{"name":"Blue Silk","hex":"#d0dce8"},{"name":"Blue Triumph","hex":"#4376ab"},{"name":"Blue Velvet","hex":"#0d6183"},{"name":"Blue Whale","hex":"#1e3442"},{"name":"Blue-Collar","hex":"#005f7a"},{"name":"Bluebell","hex":"#333399"},{"name":"Blueberry","hex":"#464196"},{"name":"Bluebonnet","hex":"#1c1cf0"},{"name":"Bluerocratic","hex":"#1f66ff"},{"name":"Blues White Shoes","hex":"#99badd"},{"name":"Bluetiful","hex":"#3c69e7"},{"name":"Blush Bomb","hex":"#dd99aa"},{"name":"Blush d’Amour","hex":"#de5d83"},{"name":"Blush Hour","hex":"#ff6f91"},{"name":"Blush Kiss","hex":"#eabcc0"},{"name":"Blush Rush","hex":"#f0bcbe"},{"name":"Blushing Cinnamon","hex":"#ffbf99"},{"name":"Blushing Coconut","hex":"#ebd5ca"},{"name":"Blushing Rose","hex":"#e09b81"},{"name":"Blushing Sky","hex":"#d9b1d6"},{"name":"Blustering Blue","hex":"#4411ff"},{"name":"Boa","hex":"#7f7755"},{"name":"Bohemian Blue","hex":"#0000aa"},{"name":"Boho Blush","hex":"#e58787"},{"name":"Boho Copper","hex":"#b96033"},{"name":"Boiling Magma","hex":"#ff3300"},{"name":"Bok Choy","hex":"#bccab3"},{"name":"Bold Irish","hex":"#2a814d"},{"name":"Bollywood Gold","hex":"#fffbab"},{"name":"Bolognese","hex":"#bb4400"},{"name":"Bone","hex":"#e0d7c6"},{"name":"Bone-Chilling","hex":"#e1f2f0"},{"name":"Bonfire","hex":"#f78058"},{"name":"Bonne Nuit","hex":"#3a4866"},{"name":"Bonsai","hex":"#787b54"},{"name":"Bonsai Garden","hex":"#9e9e7c"},{"name":"Bookworm","hex":"#ebe3de"},{"name":"Bordeaux","hex":"#7b002c"},{"name":"Borderline Pink","hex":"#ee1166"},{"name":"Borlotti Bean","hex":"#d9b1aa"},{"name":"Botanical","hex":"#4d6e2f"},{"name":"Botanical Garden","hex":"#44aa11"},{"name":"Botanical Night","hex":"#12403c"},{"name":"Botticelli","hex":"#b70272"},{"name":"Bottom of my Heart","hex":"#cc0077"},{"name":"Boulevardier","hex":"#d40701"},{"name":"Bountiful Gold","hex":"#e4c36c"},{"name":"Bourbon","hex":"#af6c3e"},{"name":"Bourbon Peach","hex":"#ec842f"},{"name":"Boutique Beige","hex":"#e1cead"},{"name":"Brain Freeze","hex":"#00eeff"},{"name":"Brandy","hex":"#dcb68a"},{"name":"Brandy Bear","hex":"#aa5412"},{"name":"Brandywine Spritz","hex":"#e69dad"},{"name":"Brass","hex":"#b5a642"},{"name":"Brass Buttons","hex":"#dfac4c"},{"name":"Bread and Butter","hex":"#faedd2"},{"name":"Bread Crumb","hex":"#e4d4be"},{"name":"Break the Ice","hex":"#b2e1ee"},{"name":"Breath of Celery","hex":"#dce7cb"},{"name":"Breath of Fire","hex":"#ee0011"},{"name":"Breath of Fresh Air","hex":"#c7dbe4"},{"name":"Breeze","hex":"#aec9ea"},{"name":"Breeze of Chilli","hex":"#f4706e"},{"name":"Breezy","hex":"#c2dde6"},{"name":"Brick","hex":"#a03623"},{"name":"Brick by Brick","hex":"#b22122"},{"name":"Brick Red","hex":"#8f1402"},{"name":"Bricky Brick","hex":"#b33a22"},{"name":"Bridal Scent","hex":"#e5d3cc"},{"name":"Bride","hex":"#efe7eb"},{"name":"Bright Star","hex":"#dde2e6"},{"name":"Brilliance","hex":"#fdfdfd"},{"name":"Brilliant Blue","hex":"#0075b3"},{"name":"Brilliant Gold","hex":"#f0dbaa"},{"name":"Brink Pink","hex":"#fb607f"},{"name":"Brisket","hex":"#6e4534"},{"name":"British Phone Booth","hex":"#ff0015"},{"name":"British Racing Green","hex":"#05480d"},{"name":"Broad Daylight","hex":"#bbddff"},{"name":"Broccoli","hex":"#87b364"},{"name":"Broccoli Green","hex":"#4b5338"},{"name":"Broccoli Paradise","hex":"#008833"},{"name":"Bronze","hex":"#a87900"},{"name":"Bronzed","hex":"#dd6633"},{"name":"Broom","hex":"#eecc24"},{"name":"Brown","hex":"#653700"},{"name":"Brown Alpaca","hex":"#b86d29"},{"name":"Brown Coffee","hex":"#4a2c2a"},{"name":"Brown Sugar","hex":"#ab764e"},{"name":"Brown Sugar Glaze","hex":"#cf7a4b"},{"name":"Brownie","hex":"#964b00"},{"name":"Bruise","hex":"#7e4071"},{"name":"Bruised Plum","hex":"#3b1921"},{"name":"Brume","hex":"#c6c6c2"},{"name":"Brunette","hex":"#664238"},{"name":"Bruschetta","hex":"#b2654e"},{"name":"Brutal Pink","hex":"#ff00bb"},{"name":"Brutally Blue","hex":"#0022dd"},{"name":"Bubbelgum Heart","hex":"#ffbadf"},{"name":"Bubblegum","hex":"#ff85ff"},{"name":"Bubblegum Baby Girl","hex":"#cc55ee"},{"name":"Bubblegum Crisis","hex":"#eeccee"},{"name":"Bubblegum Kisses","hex":"#f092d6"},{"name":"Bubbles","hex":"#e7feff"},{"name":"Büchel Cherry","hex":"#aa1111"},{"name":"Buckeye","hex":"#674834"},{"name":"Buckingham Gardens","hex":"#89a068"},{"name":"Bucolic","hex":"#1b6634"},{"name":"Bud Green","hex":"#79b465"},{"name":"Buddha’s Love Handles","hex":"#ffbb33"},{"name":"Buff It","hex":"#d9cfbe"},{"name":"Bullet Hell","hex":"#faf1c8"},{"name":"Bullfrog","hex":"#8a966a"},{"name":"Bulma Hair","hex":"#359e6b"},{"name":"Bumblebee","hex":"#ffc82a"},{"name":"Bunny Tail","hex":"#ffe3f4"},{"name":"Bureaucracy","hex":"#746c8f"},{"name":"Buried Gold","hex":"#dbbc4b"},{"name":"Buried Lust","hex":"#772200"},{"name":"Burned","hex":"#520b00"},{"name":"Burning Fireflies","hex":"#ff1166"},{"name":"Burning Flame","hex":"#ffb162"},{"name":"Burning Orange","hex":"#ff7124"},{"name":"Burning Raspberry","hex":"#ff0599"},{"name":"Burning Trail","hex":"#ee9922"},{"name":"Burning Ultrablue","hex":"#150aec"},{"name":"Burnt Coffee","hex":"#271b10"},{"name":"Burnt Red","hex":"#9f2305"},{"name":"Burrito","hex":"#eed7c1"},{"name":"Busty Blue","hex":"#3300cc"},{"name":"Busy Bee","hex":"#f4ff00"},{"name":"Butter","hex":"#ffff81"},{"name":"Butter Bronze","hex":"#c88849"},{"name":"Butter Honey","hex":"#f5e5ab"},{"name":"Butter Muffin","hex":"#f6dfb2"},{"name":"Butter Up","hex":"#f4e0bb"},{"name":"Butterbeer","hex":"#af7934"},{"name":"Buttercream","hex":"#efe0cd"},{"name":"Buttercup Glow","hex":"#f1f458"},{"name":"Buttered","hex":"#ece2b7"},{"name":"Buttered Popcorn","hex":"#fff0a4"},{"name":"Buttered Up","hex":"#f7f0d2"},{"name":"Butterfly Kisses","hex":"#f0dedc"},{"name":"Buttermelon","hex":"#fff7db"},{"name":"Buttermilk","hex":"#fffee4"},{"name":"Butternut","hex":"#ffa177"},{"name":"Butternut Squash","hex":"#fc7604"},{"name":"Butterscotch","hex":"#fdb147"},{"name":"Butterscotch Cake","hex":"#f1c882"},{"name":"Butterum","hex":"#c68f65"},{"name":"Buttery","hex":"#ffc283"},{"name":"Buttery Croissant","hex":"#f6e19c"},{"name":"Buzz","hex":"#f0c641"},{"name":"C64 Blue","hex":"#003aff"},{"name":"Cabaret","hex":"#cd526c"},{"name":"Cabbage","hex":"#87d7be"},{"name":"Cacao Nibs","hex":"#80442f"},{"name":"Cacodemon Red","hex":"#9f0000"},{"name":"Cactus","hex":"#5b6f55"},{"name":"Cadillac Coupe","hex":"#c0362c"},{"name":"Caduceus Staff","hex":"#eedd22"},{"name":"Café au Lait","hex":"#a57c5b"},{"name":"Café Crème","hex":"#c79685"},{"name":"Cafe Latte","hex":"#d6c6b4"},{"name":"Café Noir","hex":"#4b3621"},{"name":"Cafe Royale","hex":"#6a4928"},{"name":"Cajeta","hex":"#c46d29"},{"name":"Cake Frosting","hex":"#f9dfe5"},{"name":"Cakepop Sorbet","hex":"#f8c649"},{"name":"Calabrese","hex":"#f4a6a3"},{"name":"Calcium Rock","hex":"#eee9d9"},{"name":"Call It a Night","hex":"#42364c"},{"name":"Calm Waters","hex":"#e7fafa"},{"name":"Calypso","hex":"#3d7188"},{"name":"Camel","hex":"#c69f59"},{"name":"Camel Cardinal","hex":"#cc9944"},{"name":"Camellia","hex":"#f6685a"},{"name":"Cameo","hex":"#f2debc"},{"name":"Camo Clay","hex":"#747f71"},{"name":"Campanula","hex":"#3473b7"},{"name":"Campfire","hex":"#ce5f38"},{"name":"Camping Trip","hex":"#67786e"},{"name":"Canadian Maple","hex":"#cab266"},{"name":"Canadian Tuxedo","hex":"#579aca"},{"name":"Canary","hex":"#fdff63"},{"name":"Candied Apple","hex":"#b95b6d"},{"name":"Candied Snow","hex":"#d8fff3"},{"name":"Candle Glow","hex":"#ffe8c3"},{"name":"Candle in the Wind","hex":"#f9ebbf"},{"name":"Candlelight","hex":"#fcd917"},{"name":"Candy","hex":"#ff9b87"},{"name":"Candy Apple Red","hex":"#ff0800"},{"name":"Candy Bar","hex":"#ffb7d5"},{"name":"Candy Cane","hex":"#f7bfc2"},{"name":"Candy Corn","hex":"#fcfc5d"},{"name":"Candy Dreams","hex":"#e9aef2"},{"name":"Candy Floss","hex":"#e8a7e2"},{"name":"Candy Grape Fizz","hex":"#7755ee"},{"name":"Candy Green","hex":"#33cc00"},{"name":"Candy Pink","hex":"#ff63e9"},{"name":"Cane Sugar","hex":"#e3b982"},{"name":"Cannoli Cream","hex":"#edecdb"},{"name":"Cantaloupe","hex":"#ffd479"},{"name":"Canyon Sunset","hex":"#dd8869"},{"name":"Cape Verde","hex":"#01554f"},{"name":"Capers","hex":"#897a3e"},{"name":"Capital Blue","hex":"#1a4157"},{"name":"Caponata","hex":"#822a10"},{"name":"Cappuccino","hex":"#704a3a"},{"name":"Cappuccino Cosmico","hex":"#e1ddcd"},{"name":"Capri","hex":"#00bfff"},{"name":"Captain Kirk","hex":"#9b870c"},{"name":"Caramel","hex":"#af6f09"},{"name":"Caramel Coating","hex":"#bb7711"},{"name":"Caramel Crumb","hex":"#c39355"},{"name":"Caramel Dream","hex":"#b8623b"},{"name":"Caramel Drizzle","hex":"#d9ad7f"},{"name":"Caramel Finish","hex":"#ffd59a"},{"name":"Caramel Gold","hex":"#b1936d"},{"name":"Caramel Macchiato","hex":"#c58d4b"},{"name":"Caramel Mousse","hex":"#e5caa4"},{"name":"Caramelize","hex":"#d58a37"},{"name":"Caramelized Pecan","hex":"#a17b4d"},{"name":"Carbon","hex":"#333333"},{"name":"Carbon Fiber","hex":"#2e2e2e"},{"name":"Cardamom","hex":"#aaaa77"},{"name":"Cardboard","hex":"#c19a6c"},{"name":"Cardinal","hex":"#c41e3a"},{"name":"Caribbean","hex":"#caf0e5"},{"name":"Caribbean Blue","hex":"#1ac1dd"},{"name":"Caribou","hex":"#816c5e"},{"name":"Carmine","hex":"#d60036"},{"name":"Carnivore","hex":"#991111"},{"name":"Carolina Reaper","hex":"#ff1500"},{"name":"Carona","hex":"#fba52e"},{"name":"Carpaccio","hex":"#e34234"},{"name":"Carrot","hex":"#fd6f3b"},{"name":"Carrot Lava","hex":"#fc5a1f"},{"name":"Cartoon Violence","hex":"#d01722"},{"name":"Cascade Twilight","hex":"#234893"},{"name":"Cascara","hex":"#ee4433"},{"name":"Cashew Nut","hex":"#edccb3"},{"name":"Cashmere","hex":"#d1b399"},{"name":"Cashmere Clay","hex":"#cda291"},{"name":"Casino Lights","hex":"#f9f2b3"},{"name":"Casper","hex":"#aab5b8"},{"name":"Castaway","hex":"#6dbac0"},{"name":"Castaway Beach","hex":"#d0c19f"},{"name":"Castle in the Sky","hex":"#d1eaed"},{"name":"Castro","hex":"#44232f"},{"name":"Catacomb Walls","hex":"#dbd7d0"},{"name":"Catfish","hex":"#657d82"},{"name":"Cathedral","hex":"#acaaa7"},{"name":"Cathode Green","hex":"#00ff55"},{"name":"Catnip","hex":"#80aa95"},{"name":"Cauliflower","hex":"#ebe5d0"},{"name":"Caveman","hex":"#625c58"},{"name":"Caviar","hex":"#2b2c30"},{"name":"Cavolo Nero","hex":"#72939e"},{"name":"Cayenne","hex":"#941100"},{"name":"Cedar Chest","hex":"#c95a49"},{"name":"Celadon","hex":"#ace1af"},{"name":"Celadon Porcelain","hex":"#7ebea5"},{"name":"Celery","hex":"#b4c04c"},{"name":"Celery Mousse","hex":"#c1fd95"},{"name":"Celery Scepter","hex":"#e1df9a"},{"name":"Celestial","hex":"#007894"},{"name":"Celestial Cathedral","hex":"#daeaf6"},{"name":"Celestial Crown","hex":"#ead97c"},{"name":"Celestial Horizon","hex":"#7c94b3"},{"name":"Cement Feet","hex":"#7b737b"},{"name":"Ceramic","hex":"#fcfff9"},{"name":"Cereal Flake","hex":"#efd7ab"},{"name":"Cerulean","hex":"#55aaee"},{"name":"Chai Latte","hex":"#f9cba0"},{"name":"Chai Tea","hex":"#a97b2d"},{"name":"Chain Mail","hex":"#81777f"},{"name":"Chalet","hex":"#c29867"},{"name":"Champagne","hex":"#e9d2ac"},{"name":"Champagne Gold","hex":"#e8d6b3"},{"name":"Channel","hex":"#f1c3c2"},{"name":"Chantilly","hex":"#edb8c7"},{"name":"Chaotic Roses","hex":"#bb2266"},{"name":"Charcoal","hex":"#343837"},{"name":"Charismatic Red","hex":"#ee2244"},{"name":"Charm","hex":"#d0748b"},{"name":"Charming Peach","hex":"#f5ad75"},{"name":"Chartreuse","hex":"#c1f80a"},{"name":"Che Guevara Red","hex":"#ed214d"},{"name":"Cheddar","hex":"#ee9a09"},{"name":"Cheek Red","hex":"#a55a55"},{"name":"Cheeky Chestnut","hex":"#7b4d3a"},{"name":"Cheerly Kiwi","hex":"#bccb08"},{"name":"Cheese","hex":"#ffa600"},{"name":"Cheese It Up","hex":"#fdde45"},{"name":"Cheese Please","hex":"#ff9613"},{"name":"Cheesecake","hex":"#fffcda"},{"name":"Cheesus","hex":"#ffcc77"},{"name":"Cheesy Cheetah","hex":"#eeb033"},{"name":"Cheesy Frittata","hex":"#f0e093"},{"name":"Chef’s Hat","hex":"#f3f4f5"},{"name":"Chef’s Kiss","hex":"#cc3b3b"},{"name":"Cherry","hex":"#cf0234"},{"name":"Cherry Berry","hex":"#9f4d65"},{"name":"Cherry Blossom","hex":"#f5c1d5"},{"name":"Cherry Bomb","hex":"#b73d3f"},{"name":"Cherry Crush","hex":"#c71414"},{"name":"Cherry Paddle Pop","hex":"#fe314b"},{"name":"Cherry Picking","hex":"#620b15"},{"name":"Cherry Sangria","hex":"#c92435"},{"name":"Cherry Soda","hex":"#ff0044"},{"name":"Cherry Static","hex":"#e76178"},{"name":"Cherry Tomato","hex":"#f2013f"},{"name":"Cherry Velvet","hex":"#e10646"},{"name":"Cherryade","hex":"#b22743"},{"name":"Chess Ivory","hex":"#ffe9c5"},{"name":"Chestnut","hex":"#742802"},{"name":"Chewing Gum","hex":"#e6b0af"},{"name":"Chickadee","hex":"#ffcf65"},{"name":"Chicken Comb","hex":"#dd2222"},{"name":"Chicken Masala","hex":"#cc8822"},{"name":"Chickery Chick","hex":"#fbe98e"},{"name":"Child of the Night","hex":"#220077"},{"name":"Chili Con Carne","hex":"#985e2b"},{"name":"Chili Crab","hex":"#e93a0e"},{"name":"Chili Pepper","hex":"#ac1e3a"},{"name":"Chill of the Night","hex":"#256d8d"},{"name":"Chimera","hex":"#74626d"},{"name":"China Silk","hex":"#e3d1cc"},{"name":"Chinese New Year","hex":"#ff3366"},{"name":"Chinotto","hex":"#554747"},{"name":"Chipmunk","hex":"#cfa14a"},{"name":"Chivalrous Fox","hex":"#c7662a"},{"name":"Chivalrous Walrus","hex":"#816558"},{"name":"Choco Chic","hex":"#993311"},{"name":"Chocoholic","hex":"#993300"},{"name":"Chocolate","hex":"#d2691e"},{"name":"Chocolate Bells","hex":"#775130"},{"name":"Chocolate Bliss","hex":"#7f6054"},{"name":"Chocolate Castle","hex":"#452207"},{"name":"Chocolate Chili","hex":"#ab4231"},{"name":"Chocolate Covered","hex":"#8b4121"},{"name":"Chocolate Escape","hex":"#623d2e"},{"name":"Chocolate Explosion","hex":"#8e473b"},{"name":"Chocolate Fantasies","hex":"#5c3612"},{"name":"Chocolate Kiss","hex":"#3c1421"},{"name":"Chocolate Lust","hex":"#993322"},{"name":"Chocolate Magma","hex":"#7a463a"},{"name":"Chocolate Pretzel","hex":"#60504b"},{"name":"Chocolate Rain","hex":"#714f29"},{"name":"Chocolate Rush","hex":"#4e1b0b"},{"name":"Chocolate Temptation","hex":"#956e5f"},{"name":"Chocolate Truffle","hex":"#612e32"},{"name":"Chocolate Velvet","hex":"#7f7453"},{"name":"Chorizo","hex":"#aa0011"},{"name":"Choux à la Crème","hex":"#ebcf7d"},{"name":"Christmas Red","hex":"#b01b2e"},{"name":"Chrome White","hex":"#cac7b7"},{"name":"Chubby Kiss","hex":"#b43548"},{"name":"Chutney","hex":"#9f5e4e"},{"name":"Cigar","hex":"#7d4e38"},{"name":"Cigarette Glow","hex":"#ee5500"},{"name":"Cinder","hex":"#242a2e"},{"name":"Cinderella","hex":"#fbd7cc"},{"name":"Cinnamon","hex":"#d26911"},{"name":"Cinnamon Buff","hex":"#ffbf6e"},{"name":"Cinnamon Sparkle","hex":"#9c5736"},{"name":"Cinnapink","hex":"#a6646f"},{"name":"Citadel","hex":"#6a7f8b"},{"name":"Citrus","hex":"#9fb70a"},{"name":"Citrus Splash","hex":"#ffc400"},{"name":"City Dweller","hex":"#c0b9ac"},{"name":"Clairvoyant","hex":"#480656"},{"name":"Clam Up","hex":"#ebdbc1"},{"name":"Classic Movie","hex":"#728284"},{"name":"Classy Mauve","hex":"#bb99aa"},{"name":"Clay","hex":"#b66a50"},{"name":"Clean Slate","hex":"#577396"},{"name":"Clear Sky","hex":"#8eccfe"},{"name":"Clear Water","hex":"#aad5db"},{"name":"Clementine","hex":"#e96e00"},{"name":"Cloak and Dagger","hex":"#550055"},{"name":"Cloak Grey","hex":"#605e63"},{"name":"Cloisonné","hex":"#0773af"},{"name":"Clotted Cream","hex":"#f3efcd"},{"name":"Cloud Break","hex":"#f6f1fe"},{"name":"Cloud Dancer","hex":"#f0eee9"},{"name":"Cloud of Cream","hex":"#f1e2c4"},{"name":"Clouded Pine","hex":"#628468"},{"name":"Cloudless","hex":"#d6eafc"},{"name":"Cloudy Valley","hex":"#b1c6d6"},{"name":"Clover","hex":"#008f00"},{"name":"Coal Hard Truth","hex":"#3b3b3d"},{"name":"Coalmine","hex":"#220033"},{"name":"Cobalt","hex":"#030aa7"},{"name":"Coca Mocha","hex":"#bd9d95"},{"name":"Cockatoo","hex":"#58c8b6"},{"name":"Coco Malt","hex":"#e4dcc9"},{"name":"Coco Muck","hex":"#994a25"},{"name":"Coco’s Black","hex":"#1c1c1a"},{"name":"Cocoa","hex":"#875f42"},{"name":"Cocoloco","hex":"#aa8f7a"},{"name":"Coconut","hex":"#965a3e"},{"name":"Coconut Agony","hex":"#ebe8e7"},{"name":"Coconut Macaroon","hex":"#dacac0"},{"name":"Coconut Milk","hex":"#eeebe2"},{"name":"Cocoon","hex":"#dedbcc"},{"name":"Coffee","hex":"#6f4e37"},{"name":"Coffee Adept","hex":"#775511"},{"name":"Coffee Diva","hex":"#bea88d"},{"name":"Cognac","hex":"#d48c46"},{"name":"Coin Slot","hex":"#ff4411"},{"name":"Cola","hex":"#3c2f23"},{"name":"Cold and Dark","hex":"#154250"},{"name":"Cold Blue","hex":"#88dddd"},{"name":"Cold Brew Coffee","hex":"#785736"},{"name":"Cold Canada","hex":"#dbfffe"},{"name":"Cold Light of Day","hex":"#00eeee"},{"name":"Cold Lips","hex":"#9ba0ef"},{"name":"Cold Press Coffee","hex":"#6c2e09"},{"name":"Cold Shoulder","hex":"#d4e0ef"},{"name":"Cold Turkey","hex":"#cab5b2"},{"name":"Cold Wave","hex":"#c2e2e3"},{"name":"Cold White","hex":"#edfcfb"},{"name":"Columbo’s Coat","hex":"#d0cbce"},{"name":"Communist","hex":"#cc0000"},{"name":"Concord","hex":"#827f79"},{"name":"Concrete","hex":"#d2d1cd"},{"name":"Concrete Jungle","hex":"#999988"},{"name":"Concrete Landscape","hex":"#5c606e"},{"name":"Conifer","hex":"#b1dd52"},{"name":"Conker","hex":"#b94e41"},{"name":"Continental Waters","hex":"#98c6cb"},{"name":"Cookie Crumb","hex":"#b19778"},{"name":"Cookie Crust","hex":"#e3b258"},{"name":"Cookie Dough","hex":"#ab7100"},{"name":"Cool","hex":"#96b3b3"},{"name":"Cool as a Cucumber","hex":"#c6d86b"},{"name":"Cooler Than Ever","hex":"#77bbff"},{"name":"Copacabana","hex":"#006c8d"},{"name":"Copious Caramel","hex":"#d0851d"},{"name":"Copper","hex":"#b87333"},{"name":"Copper Coin","hex":"#da8a67"},{"name":"Copper Hopper","hex":"#bf4000"},{"name":"Copper Patina","hex":"#9db4a0"},{"name":"Copperhead","hex":"#d68755"},{"name":"Coquelicot","hex":"#ff3800"},{"name":"Coral","hex":"#ff7f50"},{"name":"Coral Commander","hex":"#ee6666"},{"name":"Coral Kiss","hex":"#ffddc7"},{"name":"Coral Paradise","hex":"#e76682"},{"name":"Coral Red","hex":"#ff4040"},{"name":"Coralistic","hex":"#ff917a"},{"name":"Corbeau","hex":"#111122"},{"name":"Corfu Waters","hex":"#008aad"},{"name":"Cork Wood","hex":"#cc7744"},{"name":"Corn","hex":"#fbec5d"},{"name":"Cornflake","hex":"#f0e68c"},{"name":"Cornsilk","hex":"#fff8dc"},{"name":"Corona","hex":"#ffb437"},{"name":"Corrosive Green","hex":"#54d905"},{"name":"Cortex","hex":"#a99592"},{"name":"Cosmic","hex":"#b8b9cb"},{"name":"Cosmic Bit Flip","hex":"#001000"},{"name":"Cosmic Explorer","hex":"#551155"},{"name":"Cosmic Green","hex":"#30a877"},{"name":"Cosmic Heart","hex":"#9601f4"},{"name":"Cosmic Latte","hex":"#fff8e7"},{"name":"Cosmic Red","hex":"#da244b"},{"name":"Cotinga Purple","hex":"#340059"},{"name":"Cotton Ball","hex":"#f2f7fd"},{"name":"Cotton Boll","hex":"#e7effb"},{"name":"Cotton Candy","hex":"#ffbcd9"},{"name":"Cotton Candy Comet","hex":"#ffc3cb"},{"name":"Cotton Candy Explosions","hex":"#dd22ff"},{"name":"Cotton Clouds","hex":"#c2e1ec"},{"name":"Cotton Field","hex":"#f2f0e8"},{"name":"Couch","hex":"#4e2a20"},{"name":"Count Chocula","hex":"#5e2d10"},{"name":"Countryside","hex":"#a4a404"},{"name":"Court-Bouillon","hex":"#cecb97"},{"name":"Couscous","hex":"#ffe29b"},{"name":"Cousteau","hex":"#55a9d6"},{"name":"Cover of Night","hex":"#494e4f"},{"name":"Cow’s Milk","hex":"#f1ede5"},{"name":"Cowboy","hex":"#443736"},{"name":"Coyote","hex":"#dc9b68"},{"name":"Cozy Summer Sunset","hex":"#eb9f9f"},{"name":"Cozy Wool","hex":"#d1b99b"},{"name":"Cranberry","hex":"#9e003a"},{"name":"Cranberry Splash","hex":"#da5265"},{"name":"Crash Dummy","hex":"#eeee66"},{"name":"Crashing Waves","hex":"#3e6f87"},{"name":"Cream","hex":"#ffffc2"},{"name":"Cream and Butter","hex":"#feeea5"},{"name":"Cream and Sugar","hex":"#ddcfb9"},{"name":"Cream Puff","hex":"#ffbb99"},{"name":"Creamed Caramel","hex":"#b79c94"},{"name":"Creamy","hex":"#efe8db"},{"name":"Creamy Apricot","hex":"#ffe8bd"},{"name":"Creamy Avocado","hex":"#d8f19c"},{"name":"Creamy Berry","hex":"#debccd"},{"name":"Creamy Cloud Dreams","hex":"#fff5e0"},{"name":"Creamy Garlic","hex":"#ecefe3"},{"name":"Creamy Ivory","hex":"#eeddaa"},{"name":"Creamy Lemon","hex":"#fff0b2"},{"name":"Creamy Mint","hex":"#aaffaa"},{"name":"Creamy Peach","hex":"#f4a384"},{"name":"Creamy Strawberry","hex":"#fcd2df"},{"name":"Creamy Sweet Corn","hex":"#f7c34c"},{"name":"Creamy Vanilla","hex":"#f2e5bf"},{"name":"Crème Brûlée","hex":"#ffe39b"},{"name":"Crème de la Crème","hex":"#f3e7b4"},{"name":"Crème de Pêche","hex":"#fdf5e0"},{"name":"Crème Fraîche","hex":"#eceee6"},{"name":"Creole","hex":"#393227"},{"name":"Crepe","hex":"#d4bc94"},{"name":"Crepuscular","hex":"#e7dcce"},{"name":"Crimson Blaze","hex":"#ad3d1e"},{"name":"Crimson Boy","hex":"#b44933"},{"name":"Crimson Cloud","hex":"#c32f40"},{"name":"Crimson Glow","hex":"#c13939"},{"name":"Crimson Velvet Sunset","hex":"#b52604"},{"name":"Crisps","hex":"#e2bd67"},{"name":"Crispy Crunch","hex":"#7a8f68"},{"name":"Croissant","hex":"#c4ab86"},{"name":"Crow","hex":"#180614"},{"name":"Crown Jewel","hex":"#4f325e"},{"name":"Crown of Thorns","hex":"#763c33"},{"name":"Crude Banana","hex":"#21c40e"},{"name":"Crumbling Statue","hex":"#cabfb4"},{"name":"Crunchy Carrot","hex":"#ea5013"},{"name":"Crusade King","hex":"#dbc364"},{"name":"Crushed Ice","hex":"#c4fff7"},{"name":"Cry Me a River","hex":"#427898"},{"name":"Cry of a Rose","hex":"#b23c5d"},{"name":"Cryo Freeze","hex":"#ddece0"},{"name":"Crystal","hex":"#a7d8de"},{"name":"Crystal Gem","hex":"#79d0a7"},{"name":"Crystal Lake","hex":"#88b5c4"},{"name":"Crystal Palace","hex":"#d3cfab"},{"name":"Cuba Libre","hex":"#73383c"},{"name":"Cucumber","hex":"#006400"},{"name":"Cucumber Bomber","hex":"#bbdd11"},{"name":"Cucumber Milk","hex":"#c2f177"},{"name":"Cucumber Queen","hex":"#3c773c"},{"name":"Cumin","hex":"#a58459"},{"name":"Cumulus","hex":"#f3f3e6"},{"name":"Cupid","hex":"#f5b2c5"},{"name":"Cupid’s Eye","hex":"#ff22dd"},{"name":"Curry","hex":"#d6a332"},{"name":"Curry Bubbles","hex":"#f5b700"},{"name":"Curry Sauce","hex":"#be9e6f"},{"name":"Currywurst","hex":"#ddaa33"},{"name":"Cursed Black","hex":"#131313"},{"name":"Cute Crab","hex":"#dd4444"},{"name":"Cuttlefish","hex":"#7fbbc2"},{"name":"Cyan","hex":"#0ff0fe"},{"name":"Cyantific","hex":"#77c9c2"},{"name":"Cyber Neon Green","hex":"#00ff26"},{"name":"Cyber Yellow","hex":"#ffd400"},{"name":"Cyberpink","hex":"#ff2077"},{"name":"Cypress","hex":"#585d40"},{"name":"Daffodil","hex":"#ffff31"},{"name":"Dainty Peach","hex":"#ffcdb9"},{"name":"Daisy Desi","hex":"#fcdf8a"},{"name":"Dallas Dust","hex":"#ece0d6"},{"name":"Dampened Black","hex":"#4a4747"},{"name":"Dancing Sea","hex":"#1c4d8f"},{"name":"Dandelion","hex":"#fedf08"},{"name":"Danger","hex":"#ff0e0e"},{"name":"Dangerous Affair","hex":"#d00220"},{"name":"Dangerous Robot","hex":"#cbc5c6"},{"name":"Dark","hex":"#1b2431"},{"name":"Dark & Stormy","hex":"#353f51"},{"name":"Dark Ages","hex":"#9698a3"},{"name":"Dark as Night","hex":"#495252"},{"name":"Dark Blue","hex":"#315b7d"},{"name":"Dark Charcoal","hex":"#333232"},{"name":"Dark Chocolate","hex":"#624a49"},{"name":"Dark Crypt","hex":"#3f4551"},{"name":"Dark Cyan","hex":"#008b8b"},{"name":"Dark Denim","hex":"#005588"},{"name":"Dark Dreams","hex":"#332266"},{"name":"Dark Eclipse","hex":"#112244"},{"name":"Dark Forest","hex":"#556962"},{"name":"Dark Galaxy","hex":"#0018a8"},{"name":"Dark Knight","hex":"#151931"},{"name":"Dark Matter","hex":"#110101"},{"name":"Dark Moon","hex":"#161718"},{"name":"Dark Olive","hex":"#373e02"},{"name":"Dark Orange","hex":"#c65102"},{"name":"Dark Orchestra","hex":"#251b19"},{"name":"Dark Pink","hex":"#cb416b"},{"name":"Dark Prince","hex":"#6b6c89"},{"name":"Dark Purple","hex":"#35063e"},{"name":"Dark Red","hex":"#840000"},{"name":"Dark Rift","hex":"#060b14"},{"name":"Dark Roast","hex":"#4a2d2f"},{"name":"Dark Rum","hex":"#45362b"},{"name":"Dark Salmon Injustice","hex":"#e8957a"},{"name":"Dark Sanctuary","hex":"#3f012c"},{"name":"Dark Sapphire","hex":"#082567"},{"name":"Dark Secret","hex":"#3e5361"},{"name":"Dark Serpent","hex":"#113311"},{"name":"Dark Soul","hex":"#112255"},{"name":"Dark Souls","hex":"#a3a3a2"},{"name":"Dark Space","hex":"#414a4c"},{"name":"Dark Veil","hex":"#141311"},{"name":"Dark Void","hex":"#151517"},{"name":"Dark Wood","hex":"#855e42"},{"name":"Darkest Dungeon","hex":"#660011"},{"name":"Darkest Forest","hex":"#223311"},{"name":"Darth Vader","hex":"#27252a"},{"name":"Day On Mercury","hex":"#d5d2d1"},{"name":"Dazzling Red","hex":"#d82c0d"},{"name":"Dead Forest","hex":"#434b4f"},{"name":"Dead Pixel","hex":"#3b3a3a"},{"name":"Deadly Depths","hex":"#111144"},{"name":"Deadly Mustard","hex":"#dead11"},{"name":"Dear Darling","hex":"#a30112"},{"name":"Dear Reader","hex":"#f5f3e6"},{"name":"Death by Chocolate","hex":"#60443f"},{"name":"Death of a Star","hex":"#e760d2"},{"name":"Debian Red","hex":"#d70a53"},{"name":"Decadial Pink","hex":"#decade"},{"name":"Decreasing Brown","hex":"#987654"},{"name":"Deep Blue","hex":"#040273"},{"name":"Deep Forest","hex":"#3c463e"},{"name":"Deep Forestial Escapade","hex":"#335500"},{"name":"Deep Fried","hex":"#f0b054"},{"name":"Deep Fried Sun Rays","hex":"#f6c75e"},{"name":"Deep Green","hex":"#02590f"},{"name":"Deep Indigo","hex":"#4c567a"},{"name":"Deep Lagoon","hex":"#005a6f"},{"name":"Deep Night","hex":"#494c55"},{"name":"Deep Pond","hex":"#014420"},{"name":"Deep Pool Teal","hex":"#366d68"},{"name":"Deep Saffron","hex":"#ff9932"},{"name":"Deep Sea Base","hex":"#2c2c57"},{"name":"Deep Sea Diver","hex":"#255c61"},{"name":"Deep Sea Nightmare","hex":"#002366"},{"name":"Deep Sky Blue","hex":"#0d75f8"},{"name":"Deep Space Rodeo","hex":"#332277"},{"name":"Deeply Embarrassed","hex":"#ecb2b3"},{"name":"Deepsea Kraken","hex":"#082599"},{"name":"Deer","hex":"#ba8759"},{"name":"Delayed Yellow","hex":"#fdf901"},{"name":"Deli Yellow","hex":"#e8b523"},{"name":"Delicate Bliss","hex":"#ede0d5"},{"name":"Delicate Cloud","hex":"#dddfe8"},{"name":"Delicate Ice","hex":"#b7d2e3"},{"name":"Delicate Lemon","hex":"#eedd77"},{"name":"Delicate Seashell","hex":"#ffefdd"},{"name":"Délicieux au Chocolat","hex":"#412010"},{"name":"Delightful Pastry","hex":"#f9e7c8"},{"name":"Delta Mint","hex":"#c5e6cf"},{"name":"Demeter Green","hex":"#02cc02"},{"name":"Demonic Kiss","hex":"#d02b48"},{"name":"Denim","hex":"#2243b6"},{"name":"Densetsu Green","hex":"#889911"},{"name":"Depths of Night","hex":"#2c319b"},{"name":"Desert","hex":"#ccad60"},{"name":"Desert Dessert","hex":"#ffba6b"},{"name":"Desert Dune","hex":"#b5ab9c"},{"name":"Desert Locust","hex":"#a9a450"},{"name":"Desert Temple","hex":"#ddcc99"},{"name":"Deserted Beach","hex":"#e7dbbf"},{"name":"Desirable","hex":"#a93435"},{"name":"Desire","hex":"#ea3c53"},{"name":"Desired Dawn","hex":"#d8d7d9"},{"name":"Detective Coat","hex":"#8b8685"},{"name":"Devil’s Advocate","hex":"#ff3344"},{"name":"Deviled Eggs","hex":"#fecd82"},{"name":"Devilish","hex":"#dd3322"},{"name":"Devilish Diva","hex":"#ce7790"},{"name":"Diamond","hex":"#faf7e2"},{"name":"Diamond Cut","hex":"#e9e9f0"},{"name":"Diamond White","hex":"#e2eff3"},{"name":"Diesel","hex":"#322c2b"},{"name":"Dijon Mustard","hex":"#e2ca73"},{"name":"Dill","hex":"#6f7755"},{"name":"Dim","hex":"#c8c2be"},{"name":"Dinosaur Egg","hex":"#cabaa9"},{"name":"Dipped in Cream","hex":"#fcf6eb"},{"name":"Dire Wolf","hex":"#282828"},{"name":"Disappearing Memories","hex":"#eae3e0"},{"name":"Disco Ball","hex":"#d4d4d4"},{"name":"Discreet Orange","hex":"#ffad98"},{"name":"Discrete Pink","hex":"#ebdbdd"},{"name":"Distant Cloud","hex":"#e5eae6"},{"name":"Distant Homeworld","hex":"#acdcee"},{"name":"Distant Landscape","hex":"#e1efdd"},{"name":"Diva","hex":"#c9a0ff"},{"name":"Diva Mecha","hex":"#ee99ee"},{"name":"Diva Pink","hex":"#fa427e"},{"name":"Diver’s Eden","hex":"#3a797e"},{"name":"Divine Pleasure","hex":"#f4efe1"},{"name":"Dockside Red","hex":"#813533"},{"name":"Doctor","hex":"#f9f9f9"},{"name":"Dogwood","hex":"#faeae2"},{"name":"Dolce Pink","hex":"#f0d9e0"},{"name":"Dollar Bill","hex":"#85bb65"},{"name":"Dolly","hex":"#f5f171"},{"name":"Dolly Cheek","hex":"#fcc9b6"},{"name":"Dolphin","hex":"#86c4da"},{"name":"Don’t Be Shy","hex":"#ed2c1a"},{"name":"Donegal Green","hex":"#115500"},{"name":"Döner Kebab","hex":"#bb7766"},{"name":"Donkey Kong","hex":"#ab4210"},{"name":"Dorn Yellow","hex":"#fff200"},{"name":"Double Cream","hex":"#f2d9a3"},{"name":"Dove","hex":"#b3ada7"},{"name":"Dove Wing","hex":"#d7d9d5"},{"name":"Down Feathers","hex":"#fff9e7"},{"name":"Dr Who","hex":"#78587d"},{"name":"Dr. White","hex":"#fafafa"},{"name":"Dragon Ball","hex":"#ff9922"},{"name":"Dragon Fire","hex":"#fc4a14"},{"name":"Dragon Fruit","hex":"#d75969"},{"name":"Dragon’s Blood","hex":"#b84048"},{"name":"Dragon’s Breath","hex":"#d41003"},{"name":"Dragon’s Gold","hex":"#e7e04e"},{"name":"Dragonfly","hex":"#314a76"},{"name":"Drama Queen","hex":"#a37298"},{"name":"Dramatic Blue","hex":"#240093"},{"name":"Dream Land","hex":"#edabe6"},{"name":"Dream of Spring","hex":"#f7cf26"},{"name":"Dream Setting","hex":"#ff77bb"},{"name":"Dream Vapor","hex":"#cc99ee"},{"name":"Dreamless Sleep","hex":"#111111"},{"name":"Dreamy Candy Forest","hex":"#b195e4"},{"name":"Dried Tomatoes","hex":"#ab6057"},{"name":"Drifting Cloud","hex":"#dbe0e1"},{"name":"Driftwood","hex":"#a67a45"},{"name":"Drip Coffee","hex":"#7a280a"},{"name":"Dripping Wisteria","hex":"#bb99bb"},{"name":"Droplet","hex":"#aaddff"},{"name":"Dropped Brick","hex":"#bb3300"},{"name":"Drover","hex":"#fbeb9b"},{"name":"Drunk-Tank Pink","hex":"#dd11dd"},{"name":"Drunken Flamingo","hex":"#ff55cc"},{"name":"Dry Bone","hex":"#eadfce"},{"name":"Dry Rose","hex":"#c22f4d"},{"name":"Duck Butter","hex":"#ddc75b"},{"name":"Duck Hunt","hex":"#005800"},{"name":"Duckling Fluff","hex":"#fafc5d"},{"name":"Dumpling","hex":"#f7ddaa"},{"name":"Dune","hex":"#d5c0a1"},{"name":"Dungeon Keeper","hex":"#ef3038"},{"name":"Durian White","hex":"#e6d0ab"},{"name":"Dusk","hex":"#4e5481"},{"name":"Dusky Mood","hex":"#979ba8"},{"name":"Dust of the Moon","hex":"#cfc9df"},{"name":"Dust Storm","hex":"#e7d3b7"},{"name":"Dust to Dust","hex":"#bbbcbc"},{"name":"Dusty Boots","hex":"#f3c090"},{"name":"Dusty Chimney","hex":"#888899"},{"name":"Dusty Duchess","hex":"#b18377"},{"name":"Dwarf Fortress","hex":"#1d0200"},{"name":"Dwarven Bronze","hex":"#bf652e"},{"name":"Dwindling Dandelion","hex":"#f9e9d7"},{"name":"Dying Storm Blue","hex":"#111166"},{"name":"Dynamite","hex":"#ff4422"},{"name":"Dynasty Green","hex":"#00988e"},{"name":"Eagle","hex":"#a26c36"},{"name":"Earl Grey","hex":"#a6978a"},{"name":"Earthbound","hex":"#a48a80"},{"name":"Earthworm","hex":"#c3816e"},{"name":"Easter Egg","hex":"#8e97c7"},{"name":"Eat Your Greens","hex":"#696845"},{"name":"Ebi Brown","hex":"#773c30"},{"name":"Ebony","hex":"#313337"},{"name":"Eclipse","hex":"#3f3939"},{"name":"Eclipse Elixir","hex":"#1f2133"},{"name":"Ecological","hex":"#677f70"},{"name":"Ecstatic Red","hex":"#aa1122"},{"name":"Edamame","hex":"#9ca389"},{"name":"EGA Green","hex":"#01ff07"},{"name":"Egg Toast","hex":"#f2c911"},{"name":"Egg Yolk","hex":"#ffce81"},{"name":"Eggnog","hex":"#fdea9f"},{"name":"Eggplant","hex":"#430541"},{"name":"Eggshell","hex":"#f0ead6"},{"name":"Eiffel Tower","hex":"#998e83"},{"name":"Eigengrau","hex":"#16161d"},{"name":"Eight Ball","hex":"#03050a"},{"name":"Elastic Pink","hex":"#eca6ca"},{"name":"Elden Ring Orange","hex":"#ed8a09"},{"name":"Electra","hex":"#55b492"},{"name":"Electric Banana","hex":"#fbff00"},{"name":"Electric Blood","hex":"#e23d2a"},{"name":"Electric Eel","hex":"#88bbee"},{"name":"Electric Indigo","hex":"#6600ff"},{"name":"Electric Laser Lime","hex":"#26ff2a"},{"name":"Electric Lettuce","hex":"#7bd181"},{"name":"Electric Yellow","hex":"#fffc00"},{"name":"Electrifying Kiss","hex":"#d41c4e"},{"name":"Elegant Purple Gown","hex":"#552367"},{"name":"Elephant in the Room","hex":"#a8a9a8"},{"name":"Elf","hex":"#1b8a6b"},{"name":"Elite Teal","hex":"#133337"},{"name":"Embarrassed","hex":"#ee7799"},{"name":"Embarrassed Frog","hex":"#996611"},{"name":"Embarrassment","hex":"#ff7777"},{"name":"Emerald","hex":"#028f1e"},{"name":"Emerald Bliss","hex":"#4cbdac"},{"name":"Emerald Forest","hex":"#224347"},{"name":"Emerald Glitter","hex":"#66bb00"},{"name":"Emerald Ice Palace","hex":"#2af589"},{"name":"Emerald Oasis","hex":"#67a195"},{"name":"Emerald Rain","hex":"#80c872"},{"name":"Emerald Whispers","hex":"#2b8478"},{"name":"Emergency","hex":"#911911"},{"name":"Eminence","hex":"#6e3974"},{"name":"Emoji Yellow","hex":"#ffde34"},{"name":"Emperor Jade","hex":"#007b75"},{"name":"Empress","hex":"#7c7173"},{"name":"Emptiness","hex":"#fcfdfc"},{"name":"Enchanted Emerald","hex":"#7ed89a"},{"name":"Enchanted Forest","hex":"#5c821a"},{"name":"Enchanted Glen","hex":"#166d29"},{"name":"Enchanted Lavender","hex":"#bfa3d9"},{"name":"Enchanted Lilac","hex":"#a893c1"},{"name":"Enchanting Ivy","hex":"#315955"},{"name":"End of Summer","hex":"#cc8f15"},{"name":"Endive","hex":"#cee1c8"},{"name":"Endless Galaxy","hex":"#000044"},{"name":"Endless Horizon","hex":"#b1dbf5"},{"name":"Endless River","hex":"#567aad"},{"name":"Endless Summer","hex":"#f7cf00"},{"name":"Endo","hex":"#5da464"},{"name":"English Breakfast","hex":"#441111"},{"name":"English Manor","hex":"#7181a4"},{"name":"English Walnut","hex":"#3e2b23"},{"name":"Engulfed in Light","hex":"#f5f3e9"},{"name":"Enoki","hex":"#f8faee"},{"name":"Enraged","hex":"#ee0044"},{"name":"Envy","hex":"#8ba58f"},{"name":"Envy’s Love","hex":"#2dd78d"},{"name":"Eosin Pink","hex":"#ff5ec4"},{"name":"Ephemeral Blue","hex":"#cbd4df"},{"name":"Ephemeral Red","hex":"#e4cfd7"},{"name":"Epic Blue","hex":"#0066ee"},{"name":"Epink","hex":"#dd33ff"},{"name":"Equanimity","hex":"#83a9b3"},{"name":"Equestrienne","hex":"#a07569"},{"name":"Errigal White","hex":"#f2f2f4"},{"name":"Escalope","hex":"#cc8866"},{"name":"Escargot","hex":"#fff1d8"},{"name":"Espresso","hex":"#4e312d"},{"name":"Espresso Bar","hex":"#5b3f34"},{"name":"Espresso Crema","hex":"#d09c43"},{"name":"Espresso Macchiato","hex":"#4f4744"},{"name":"Espresso Martini","hex":"#8c3a00"},{"name":"Estragon","hex":"#a5af76"},{"name":"Eternal Flame","hex":"#a13f49"},{"name":"Eternal Summer","hex":"#f7e504"},{"name":"Eternal Winter","hex":"#9cfaff"},{"name":"Ether","hex":"#98b2b4"},{"name":"Ethereal Espresso","hex":"#3e2723"},{"name":"Ethereal Mist","hex":"#b0b8cc"},{"name":"Ethereal Moonlight","hex":"#d5e4ec"},{"name":"Ethereal Woods","hex":"#3e5e4e"},{"name":"Eucalyptus","hex":"#329760"},{"name":"Evening Glow","hex":"#fdd792"},{"name":"Everglade","hex":"#264334"},{"name":"Evergreen","hex":"#125b49"},{"name":"Everlasting Ice","hex":"#f6fdfa"},{"name":"Evil Cigar","hex":"#522000"},{"name":"Evil Forces","hex":"#770022"},{"name":"Excalibur","hex":"#676168"},{"name":"Exclusive Elixir","hex":"#f9f1dd"},{"name":"Exclusive Ivory","hex":"#e2d8c3"},{"name":"Exhilarating Green","hex":"#81c784"},{"name":"Exit Light","hex":"#55bb33"},{"name":"Exotic Escape","hex":"#96d9df"},{"name":"Exotic Lilac","hex":"#d198b5"},{"name":"Exploding Star","hex":"#fed83a"},{"name":"Explorer of the Galaxies","hex":"#3a1f76"},{"name":"Explosive Grey","hex":"#c4c4c4"},{"name":"Explosive Purple","hex":"#cc11bb"},{"name":"Extra Fuchsia","hex":"#ef347c"},{"name":"Extra Life","hex":"#6ab417"},{"name":"Extravagant Blush","hex":"#b55067"},{"name":"Extraviolet","hex":"#661188"},{"name":"Extreme Carrot","hex":"#ff7133"},{"name":"Eyeball","hex":"#fffbf8"},{"name":"Fabric of Love","hex":"#aa1177"},{"name":"Fabric of Space","hex":"#341758"},{"name":"Fabulous Fawn","hex":"#e5c1a3"},{"name":"Fabulous Fuchsia","hex":"#ee1188"},{"name":"Faded Letter","hex":"#bfac86"},{"name":"Fading Horizon","hex":"#442266"},{"name":"Fading Love","hex":"#c973a2"},{"name":"Fading Night","hex":"#3377cc"},{"name":"Fail Whale","hex":"#99ccee"},{"name":"Faint Gold","hex":"#b59410"},{"name":"Fairy Dust","hex":"#ffe8f4"},{"name":"Fairy Floss","hex":"#ebc9c6"},{"name":"Fairy Tale","hex":"#efb4ca"},{"name":"Fairy Tale Green","hex":"#88cc55"},{"name":"Fake Blonde","hex":"#efe6c1"},{"name":"Fake Jade","hex":"#13eac9"},{"name":"Fake Love","hex":"#cc77ee"},{"name":"Falafel","hex":"#aa7711"},{"name":"Fallen Blossoms","hex":"#edb2c4"},{"name":"Fallen Petals","hex":"#f2e0da"},{"name":"Fanatic Fuchsia","hex":"#ee1199"},{"name":"Fancy Fuchsia","hex":"#ff0088"},{"name":"Fancy Red Wine","hex":"#b40441"},{"name":"Fandango","hex":"#b53389"},{"name":"Fantasy Romance","hex":"#e83a72"},{"name":"Far Horizons","hex":"#7fa2bf"},{"name":"Farmer’s Market","hex":"#8f917c"},{"name":"Fat Gold","hex":"#e6bc00"},{"name":"Fat Smooch","hex":"#c1537d"},{"name":"Fatal Fury","hex":"#da321c"},{"name":"Fatback","hex":"#fff7ed"},{"name":"Fatty Fuchsia","hex":"#ee0077"},{"name":"Fatty Sashimi","hex":"#eec4b4"},{"name":"Fawn","hex":"#cfaf7b"},{"name":"Feasty Fuchsia","hex":"#ee0088"},{"name":"Feather","hex":"#dad9ce"},{"name":"Featherbed","hex":"#afcbe5"},{"name":"Federation of Love","hex":"#b71010"},{"name":"Fedora","hex":"#625665"},{"name":"Feijoa","hex":"#a5d785"},{"name":"Feminism","hex":"#9d5783"},{"name":"Femme Fatale","hex":"#948593"},{"name":"Fennec Fox","hex":"#dad7c8"},{"name":"Fennel Fiasco","hex":"#00aa44"},{"name":"Fennel Fiesta","hex":"#00bb77"},{"name":"Fennel Flower","hex":"#77aaff"},{"name":"Fennelly","hex":"#9a9e80"},{"name":"Fern","hex":"#548d44"},{"name":"Ferntastic","hex":"#71ab62"},{"name":"Fernweh","hex":"#977b2f"},{"name":"Ferocious","hex":"#e2261f"},{"name":"Ferocious Flamingo","hex":"#ee00cc"},{"name":"Ferocious Fox","hex":"#e25d1b"},{"name":"Ferocious Fuchsia","hex":"#aa00cc"},{"name":"Fertility Green","hex":"#66fc00"},{"name":"Festive Bordeaux","hex":"#6e0f12"},{"name":"Festive Ferret","hex":"#dfdfe5"},{"name":"Feta","hex":"#dbe0d0"},{"name":"Fever Dream","hex":"#dd5577"},{"name":"Feverish","hex":"#dd6677"},{"name":"Feverish Passion","hex":"#de4d7b"},{"name":"Fibonacci Blue","hex":"#112358"},{"name":"Ficus","hex":"#3b593a"},{"name":"Ficus Elastica","hex":"#006131"},{"name":"Fiddle-Leaf Fig","hex":"#a6c875"},{"name":"Fierce Red","hex":"#cc0021"},{"name":"Fiery Glow","hex":"#f0531c"},{"name":"Fiesta","hex":"#edd8d2"},{"name":"Fiji Sands","hex":"#d8caa9"},{"name":"Film Noir","hex":"#473933"},{"name":"Final Departure","hex":"#f1f5db"},{"name":"Fine Pine","hex":"#008800"},{"name":"Finger Banana","hex":"#e1c12f"},{"name":"Finnish Fiord","hex":"#5db0be"},{"name":"Fiord","hex":"#4b5a62"},{"name":"Fire","hex":"#8f3f2a"},{"name":"Fire Ant","hex":"#be6400"},{"name":"Fire Bolt","hex":"#cc4411"},{"name":"Fire Engine","hex":"#fe0002"},{"name":"Fire Hydrant","hex":"#ff0d00"},{"name":"Fireball","hex":"#ce2029"},{"name":"Firebug","hex":"#cd5c51"},{"name":"Firecracker","hex":"#f2643a"},{"name":"Firefly Glow","hex":"#fff3a1"},{"name":"Firewatch","hex":"#ee8866"},{"name":"First Crush","hex":"#f6e2ea"},{"name":"First Day of Summer","hex":"#f1e798"},{"name":"First Love","hex":"#cf758a"},{"name":"First Snow","hex":"#e8eff8"},{"name":"Fish Bone","hex":"#e4d9c5"},{"name":"Fish Boy","hex":"#11dddd"},{"name":"Fish Ceviche","hex":"#e1e1d5"},{"name":"Fish Pond","hex":"#86c8ed"},{"name":"Fisher King","hex":"#5182b9"},{"name":"Fist of the North Star","hex":"#225599"},{"name":"Five Star","hex":"#ffaa4a"},{"name":"Fizz","hex":"#b1dbaa"},{"name":"Fizzy Peach","hex":"#f7bc5c"},{"name":"Flamazing Pink","hex":"#fe6fff"},{"name":"Flamboyant","hex":"#f73d37"},{"name":"Flamboyant Flamingo","hex":"#f74480"},{"name":"Flame","hex":"#e25822"},{"name":"Flame Lily","hex":"#ce0644"},{"name":"Flame of Prometheus","hex":"#db3c02"},{"name":"Flame Seal","hex":"#f4e25a"},{"name":"Flamenco","hex":"#ea8645"},{"name":"Flaming Cauldron","hex":"#f6a374"},{"name":"Flaming Cherry","hex":"#d4202a"},{"name":"Flaming Flamingo","hex":"#dd55ff"},{"name":"Flaming Hot Flamingoes","hex":"#ff005d"},{"name":"Flaming June","hex":"#eebb66"},{"name":"Flaming Orange","hex":"#ee6633"},{"name":"Flamingo Queen","hex":"#cc33ff"},{"name":"Flan","hex":"#f6e3b4"},{"name":"Flash in the Pan","hex":"#ff9977"},{"name":"Flashlight","hex":"#f9eed6"},{"name":"Flattered Flamingo","hex":"#ee6655"},{"name":"Fleur de Sel Caramel","hex":"#da8704"},{"name":"Fleur-De-Lis","hex":"#b090c7"},{"name":"Flickering Firefly","hex":"#f8f6e6"},{"name":"Flickering Light","hex":"#fff1dc"},{"name":"Flickr Pink","hex":"#fb0081"},{"name":"Flint Rock","hex":"#989493"},{"name":"Flip a Coin","hex":"#ccddcc"},{"name":"Flirt","hex":"#7a2e4d"},{"name":"Flirtatious Flamingo","hex":"#cc22ff"},{"name":"Flirty Rose","hex":"#d65e93"},{"name":"Flirty Salmon","hex":"#fa7069"},{"name":"Floating Feather","hex":"#e9d8c2"},{"name":"Flood","hex":"#6677bb"},{"name":"Flora","hex":"#73fa79"},{"name":"Florida’s Alligator","hex":"#664422"},{"name":"Fluffy Duckling","hex":"#fcdf39"},{"name":"Fluorescence","hex":"#89d178"},{"name":"Fluorescent Green","hex":"#08ff08"},{"name":"Fluorescent Pink","hex":"#fe1493"},{"name":"Flush Orange","hex":"#ff6f01"},{"name":"Fly a Kite","hex":"#c8daf5"},{"name":"Fly Away","hex":"#85b3f3"},{"name":"Fly by Night","hex":"#1c1e4d"},{"name":"Fly-by-Night","hex":"#495a67"},{"name":"Flying Carpet","hex":"#787489"},{"name":"Flying Fish Blue","hex":"#024aca"},{"name":"Fog","hex":"#d6d7d2"},{"name":"Fog Syringa","hex":"#c4bad2"},{"name":"Foggy Day","hex":"#e7e3db"},{"name":"Foggy Love","hex":"#d5c7e8"},{"name":"Foggy Plateau","hex":"#cfcbe5"},{"name":"Fogtown","hex":"#eef0e7"},{"name":"Foil","hex":"#c0c3c4"},{"name":"Foliage","hex":"#95b388"},{"name":"Fondant","hex":"#f4e2cf"},{"name":"Fondue","hex":"#fdf5c4"},{"name":"Fool’s Gold","hex":"#cad175"},{"name":"Forbidden Fruit","hex":"#fe7b7c"},{"name":"Forbidden Peanut","hex":"#a38052"},{"name":"Force of Nature","hex":"#d5ce69"},{"name":"Forest","hex":"#0b5509"},{"name":"Forest Empress","hex":"#3d7016"},{"name":"Forest Serenade","hex":"#336644"},{"name":"Forester","hex":"#9aa77c"},{"name":"Forestial","hex":"#007733"},{"name":"Forestial Outpost","hex":"#556611"},{"name":"Forestry","hex":"#2f441f"},{"name":"Forget-Me-Not","hex":"#0087bd"},{"name":"Forgiven Sin","hex":"#ff1199"},{"name":"Forgotten Mosque","hex":"#e2d9db"},{"name":"Forgotten Sandstone","hex":"#afa696"},{"name":"Formosan Green","hex":"#a69a51"},{"name":"Fortune Cookie","hex":"#e0c5a1"},{"name":"Fossil Stone","hex":"#e3ddcc"},{"name":"Foundation White","hex":"#efeeff"},{"name":"Four Leaf Clover","hex":"#738f5d"},{"name":"Fox","hex":"#ca4e33"},{"name":"Foxy Pink","hex":"#db95ab"},{"name":"Frail Fuchsia","hex":"#ee88ee"},{"name":"Framboise","hex":"#e40058"},{"name":"Frankenstein","hex":"#7ba05b"},{"name":"Frappé","hex":"#ceae99"},{"name":"Frappé au Chocolat","hex":"#9a6840"},{"name":"Free Spirit","hex":"#deeeed"},{"name":"Freefall","hex":"#565266"},{"name":"Freeze Up","hex":"#dee9f4"},{"name":"Freezing Vapor","hex":"#d4e9f5"},{"name":"Freezy Breezy","hex":"#99eeee"},{"name":"French Blue","hex":"#0072bb"},{"name":"French Fry","hex":"#ebc263"},{"name":"French Oak","hex":"#bb9e7c"},{"name":"French Porcelain","hex":"#f6f4f6"},{"name":"French Vanilla","hex":"#efe1a7"},{"name":"French Wine","hex":"#ac1e44"},{"name":"French Winery","hex":"#991133"},{"name":"Fresco","hex":"#f4dbd9"},{"name":"Fresh Air","hex":"#a6e7ff"},{"name":"Fresh Blue of Bel Air","hex":"#069af3"},{"name":"Fresh Breeze","hex":"#beeddc"},{"name":"Fresh Cut Grass","hex":"#91cb7d"},{"name":"Fresh Gum","hex":"#ffaadd"},{"name":"Fresh Snow","hex":"#f6efe1"},{"name":"Freshly Baked","hex":"#e9c180"},{"name":"Freshly Purpleized","hex":"#5c5083"},{"name":"Freshly Roasted Coffee","hex":"#663322"},{"name":"Fricassée","hex":"#ffe6c2"},{"name":"Friendly Frost","hex":"#bffbff"},{"name":"Frog","hex":"#58bc08"},{"name":"Frog on a Log","hex":"#8fb943"},{"name":"Frog Pond","hex":"#73b683"},{"name":"Frog Prince","hex":"#bbd75a"},{"name":"Frogger","hex":"#8cd612"},{"name":"Froggy Pond","hex":"#7fba9e"},{"name":"Frost","hex":"#e1e4c5"},{"name":"Frost Fairy","hex":"#bbcfef"},{"name":"Frostbite","hex":"#acfffc"},{"name":"Frosted Blueberries","hex":"#0055dd"},{"name":"Frosted Fir","hex":"#b4d5bd"},{"name":"Frosted Mint Hills","hex":"#ccffc2"},{"name":"Frosty Pink","hex":"#dfe9e3"},{"name":"Frothy Milk","hex":"#faede6"},{"name":"Frozen Boubble","hex":"#00eedd"},{"name":"Frozen Civilization","hex":"#e1f5e5"},{"name":"Frozen Forest","hex":"#cfe8b6"},{"name":"Frozen Landscape","hex":"#aee4ff"},{"name":"Frozen Mammoth","hex":"#dfd9da"},{"name":"Frozen Periwinkle","hex":"#c9d1ef"},{"name":"Frozen Salmon","hex":"#fea993"},{"name":"Frozen Tomato","hex":"#dd5533"},{"name":"Frozen Turquoise","hex":"#53f6ff"},{"name":"Frozen Wave","hex":"#56acca"},{"name":"Fruit of Passion","hex":"#946985"},{"name":"Fruity Licious","hex":"#f69092"},{"name":"Fuchsia","hex":"#ed0dd9"},{"name":"Fuchsia Felicity","hex":"#f44772"},{"name":"Fuchsia Fever","hex":"#ff5599"},{"name":"Fuchsia Nebula","hex":"#7722aa"},{"name":"Fuchsia Pheromone","hex":"#9f4cb7"},{"name":"Fuego","hex":"#ee5533"},{"name":"Fugitive Flamingo","hex":"#ee66aa"},{"name":"Fuji Peak","hex":"#f6eee2"},{"name":"Full Moon","hex":"#f4f3e0"},{"name":"Funki Porcini","hex":"#ee9999"},{"name":"Funky Frog","hex":"#98bd3c"},{"name":"Furious Fox","hex":"#e35519"},{"name":"Furious Frog","hex":"#55ee00"},{"name":"Furious Fuchsia","hex":"#ee2277"},{"name":"Furious Piñata","hex":"#e34d41"},{"name":"Furious Red","hex":"#ff1100"},{"name":"Furious Tiger","hex":"#ea5814"},{"name":"Furnace","hex":"#dd4124"},{"name":"Furry Lion","hex":"#f09338"},{"name":"Fusilli","hex":"#f1e8d6"},{"name":"Fusion Red","hex":"#ff6163"},{"name":"Futon","hex":"#edf6db"},{"name":"Future Fuchsia","hex":"#ff2040"},{"name":"Fuzzy Duckling","hex":"#ffea70"},{"name":"Fuzzy Sheep","hex":"#f0e9d1"},{"name":"Fuzzy Wuzzy","hex":"#cc6666"},{"name":"Galactic Civilization","hex":"#442288"},{"name":"Galactic Cruise","hex":"#111188"},{"name":"Galactic Federation","hex":"#330077"},{"name":"Galactic Gossamer","hex":"#7f8cb8"},{"name":"Galactic Grapevine","hex":"#6b327b"},{"name":"Galactic Highway","hex":"#3311bb"},{"name":"Galactic Purple","hex":"#472e97"},{"name":"Galaxea","hex":"#2e305e"},{"name":"Galaxy Blue","hex":"#2d5284"},{"name":"Galaxy Express","hex":"#444499"},{"name":"Gale of the Wind","hex":"#007844"},{"name":"Gallant Green","hex":"#99aa66"},{"name":"Gameboy Screen","hex":"#8bac0f"},{"name":"Gangsters Gold","hex":"#ffdd22"},{"name":"Garden Goddess","hex":"#99cea0"},{"name":"Garden of Eden","hex":"#7fa771"},{"name":"Garden Snail","hex":"#cdb1ab"},{"name":"Garden Weed","hex":"#786e38"},{"name":"Gardenia","hex":"#f1e8df"},{"name":"Garfield","hex":"#a75429"},{"name":"Gargoyle","hex":"#abb39e"},{"name":"Garlic Butter","hex":"#eddf5e"},{"name":"Garlic Clove","hex":"#e2d7c1"},{"name":"Garlic Toast","hex":"#dddd88"},{"name":"Gateway Grey","hex":"#a0a09c"},{"name":"Gatsby Glitter","hex":"#eed683"},{"name":"Gauntlet Grey","hex":"#78736e"},{"name":"Gazelle","hex":"#947e68"},{"name":"Gecko","hex":"#9d913c"},{"name":"Gecko’s Dream","hex":"#669900"},{"name":"Genie","hex":"#3e4364"},{"name":"Gentian Blue","hex":"#312297"},{"name":"Gentle Caress","hex":"#fcd7ba"},{"name":"Gentle Cold","hex":"#c3ece9"},{"name":"Gentle Frost","hex":"#dce0cd"},{"name":"Gentle Glow","hex":"#f6e5b9"},{"name":"Gentle Sky","hex":"#99bdd2"},{"name":"Georgia Peach","hex":"#f97272"},{"name":"German Hop","hex":"#89ac27"},{"name":"Getting Wet","hex":"#c3dae3"},{"name":"Ghost","hex":"#c0bfc7"},{"name":"Ghost Lichen","hex":"#dfedda"},{"name":"Ghost Pepper","hex":"#c10102"},{"name":"Ghost Whisperer","hex":"#cbd1d0"},{"name":"Ghost White","hex":"#f8f8ff"},{"name":"Ghosted","hex":"#e2e0dc"},{"name":"Ghoul","hex":"#667744"},{"name":"Giggle","hex":"#eff0d3"},{"name":"Gin","hex":"#d9dfcd"},{"name":"Gin Fizz","hex":"#f8eaca"},{"name":"Gin Tonic","hex":"#ecebe5"},{"name":"Ginger","hex":"#b06500"},{"name":"Ginger Ale","hex":"#c9a86a"},{"name":"Ginger Beer","hex":"#c27f38"},{"name":"Ginger Dough","hex":"#b06d3b"},{"name":"Ginger Lemon Tea","hex":"#ffffaa"},{"name":"Ginger Scent","hex":"#cb8f7b"},{"name":"Gingerbread","hex":"#8c4a2f"},{"name":"Gingerbread Crumble","hex":"#9c5e33"},{"name":"Gingerbread House","hex":"#ca994e"},{"name":"Giraffe","hex":"#fefe33"},{"name":"Girl Crush","hex":"#d1c0dc"},{"name":"Girl Power","hex":"#d39bcb"},{"name":"Girlie","hex":"#ffd3cf"},{"name":"Glacial Ice","hex":"#eae9e7"},{"name":"Glacier","hex":"#78b1bf"},{"name":"Glamour Pink","hex":"#ff1dcd"},{"name":"Glamour White","hex":"#fffcec"},{"name":"Glassmith","hex":"#46b5c0"},{"name":"Glaucous Green","hex":"#b3e8c2"},{"name":"Glazed Chestnut","hex":"#967217"},{"name":"Glazed Sugar","hex":"#ffdccc"},{"name":"Glimpse into Space","hex":"#121210"},{"name":"Glimpse of Void","hex":"#335588"},{"name":"Glistening Dawn","hex":"#f6ba25"},{"name":"Glitter is not Gold","hex":"#fedc57"},{"name":"Glitter Lake","hex":"#44bbff"},{"name":"Glitter Shower","hex":"#88ffff"},{"name":"Glorious Green Glitter","hex":"#aaee11"},{"name":"Glorious Sunset","hex":"#f88517"},{"name":"Glossy Black","hex":"#110011"},{"name":"Glow in the Dark","hex":"#befdb7"},{"name":"Glow Worm","hex":"#bed565"},{"name":"Glowing Lantern","hex":"#fbb736"},{"name":"Glowing Meteor","hex":"#ee4400"},{"name":"Glowlight","hex":"#fff6b9"},{"name":"Go Go Green","hex":"#008a7d"},{"name":"Go to Hell Black","hex":"#342c21"},{"name":"Goblin Green","hex":"#76ff7a"},{"name":"God of Rain","hex":"#4466cc"},{"name":"Goddess","hex":"#d0e1e8"},{"name":"Godzilla","hex":"#3c4d03"},{"name":"Goku Orange","hex":"#f0833a"},{"name":"Gold","hex":"#ffd700"},{"name":"Gold Buttercup","hex":"#ffe8bb"},{"name":"Gold Digger","hex":"#d1b075"},{"name":"Gold Grillz","hex":"#ece086"},{"name":"Gold Rush","hex":"#c4a777"},{"name":"Gold Tooth","hex":"#dbb40c"},{"name":"Gold Vein","hex":"#d6b956"},{"name":"Gold Winged","hex":"#e6d682"},{"name":"Golden Blood","hex":"#ff1155"},{"name":"Golden Boy","hex":"#ffdd44"},{"name":"Golden Churro","hex":"#f4ce74"},{"name":"Golden Coin","hex":"#fcd975"},{"name":"Golden Frame","hex":"#e2b31b"},{"name":"Golden Ginkgo","hex":"#f9f525"},{"name":"Golden Glitter Storm","hex":"#ead771"},{"name":"Golden Harvest","hex":"#cccc11"},{"name":"Golden Hour","hex":"#f1b457"},{"name":"Golden Kingdom","hex":"#e0c84b"},{"name":"Golden Lion","hex":"#f3ca6c"},{"name":"Golden Mean","hex":"#c49b35"},{"name":"Golden Mist","hex":"#d4c990"},{"name":"Golden Nugget","hex":"#d78e48"},{"name":"Golden Opportunity","hex":"#f7c070"},{"name":"Golden Period","hex":"#fedb2d"},{"name":"Golden Relic","hex":"#e8ce49"},{"name":"Golden Retriever","hex":"#eedec7"},{"name":"Golden Rod","hex":"#e1ae20"},{"name":"Golden Spell","hex":"#fecc36"},{"name":"Golden Sprinkles","hex":"#f6d263"},{"name":"Golden Talisman","hex":"#e9c89b"},{"name":"Goldfinch","hex":"#f8e462"},{"name":"Goldfinger","hex":"#eebb11"},{"name":"Goldfish","hex":"#f2ad62"},{"name":"Goldie","hex":"#c89d3f"},{"name":"Goldilocks","hex":"#fff39a"},{"name":"Goldzilla","hex":"#cdd80d"},{"name":"Golem","hex":"#836e59"},{"name":"Golf Course","hex":"#5a9e4b"},{"name":"Good Karma","hex":"#333c76"},{"name":"Good Morning","hex":"#fcfcda"},{"name":"Good Night!","hex":"#46565f"},{"name":"Goose Bill","hex":"#ffba80"},{"name":"Gory Red","hex":"#a30800"},{"name":"Gossip","hex":"#9fd385"},{"name":"Gotham","hex":"#807872"},{"name":"Gothic","hex":"#698890"},{"name":"Gothic Gold","hex":"#bb852f"},{"name":"Gourmet Honey","hex":"#e3cba8"},{"name":"Grain of Salt","hex":"#d8dbe1"},{"name":"Gramps Shoehorn","hex":"#a3896c"},{"name":"Grand Bleu","hex":"#015482"},{"name":"Grand Canyon","hex":"#a05d4d"},{"name":"Grand Casino Gold","hex":"#edcd62"},{"name":"Grand Sunset","hex":"#c38d87"},{"name":"Grandma’s Cameo","hex":"#f7e7dd"},{"name":"Grandma’s Pink Tiles","hex":"#e0b8c0"},{"name":"Granite","hex":"#746a5e"},{"name":"Granola","hex":"#f5ce9f"},{"name":"Grape","hex":"#6c3461"},{"name":"Grape Candy","hex":"#905284"},{"name":"Grape Fizz","hex":"#64435f"},{"name":"Grape Green","hex":"#a8e4a0"},{"name":"Grape Kiss","hex":"#82476f"},{"name":"Grape Riot","hex":"#9b4682"},{"name":"Grape Taffy","hex":"#f4daf1"},{"name":"Grapefruit","hex":"#fd5956"},{"name":"Grapes of Italy","hex":"#714a8b"},{"name":"Grapest","hex":"#880066"},{"name":"Graphite","hex":"#383428"},{"name":"Graphite Black","hex":"#262a2b"},{"name":"Grass","hex":"#5cac2d"},{"name":"Grasshopper","hex":"#77824a"},{"name":"Gratin Dauphinois","hex":"#e0d2a9"},{"name":"Grauzone","hex":"#85a3b2"},{"name":"Gravlax","hex":"#ec834f"},{"name":"Greasy Greens","hex":"#117755"},{"name":"Great Void","hex":"#3b5760"},{"name":"Greedy Gecko","hex":"#aa9922"},{"name":"Greek Goddess","hex":"#ede9ef"},{"name":"Greek Olive","hex":"#a08650"},{"name":"Green","hex":"#00ff00"},{"name":"Green Bell Pepper","hex":"#228800"},{"name":"Green Commando","hex":"#828039"},{"name":"Green Envy","hex":"#77aa00"},{"name":"Green Field","hex":"#88aa77"},{"name":"Green Glimmer","hex":"#00bb00"},{"name":"Green Glint","hex":"#dcf1c7"},{"name":"Green Goblin","hex":"#11bb33"},{"name":"Green Goddess","hex":"#76ad83"},{"name":"Green Mana","hex":"#26b467"},{"name":"Green not Found","hex":"#404404"},{"name":"Green Olive","hex":"#8d8b55"},{"name":"Green Priestess","hex":"#11dd55"},{"name":"Green Relict","hex":"#7b8762"},{"name":"Green Revolution","hex":"#009944"},{"name":"Green Screen","hex":"#22ff00"},{"name":"Green Symphony","hex":"#66aa22"},{"name":"Green Tea","hex":"#b5b68f"},{"name":"Green Tea Mochi","hex":"#90a96e"},{"name":"Green Thumb","hex":"#779900"},{"name":"Green Venom","hex":"#b8f818"},{"name":"Green With Envy","hex":"#22bb33"},{"name":"Greenfinch","hex":"#bda928"},{"name":"Greenhorn","hex":"#b2cc9a"},{"name":"Greenhouse","hex":"#3e6334"},{"name":"Greenivorous","hex":"#cae03b"},{"name":"Greensleeves","hex":"#39766c"},{"name":"Gremlin","hex":"#a79954"},{"name":"Grenadine Pink","hex":"#ff616b"},{"name":"Grey","hex":"#808080"},{"name":"Grey Area","hex":"#8f9394"},{"name":"Grey Marble","hex":"#b9b4b1"},{"name":"Grey Sheep","hex":"#baaaaa"},{"name":"Grey Web","hex":"#616669"},{"name":"Greybeard","hex":"#d4d0c5"},{"name":"Greystone","hex":"#b7b9b5"},{"name":"Griffin","hex":"#838585"},{"name":"Grilled","hex":"#633f2e"},{"name":"Grilled Tomato","hex":"#af3519"},{"name":"Grim Grey","hex":"#e3dcd6"},{"name":"Grim White","hex":"#f6f1f4"},{"name":"Grisaille","hex":"#91979f"},{"name":"Grizzly","hex":"#885818"},{"name":"Groovy Giraffe","hex":"#eeaa11"},{"name":"Groovy Lemon Pie","hex":"#d6be01"},{"name":"Grotesque Green","hex":"#64e986"},{"name":"Gruyère Cheese","hex":"#f5deb3"},{"name":"Guacamole","hex":"#95986b"},{"name":"Guardian of Gardens","hex":"#88aa22"},{"name":"Guava Glow","hex":"#eec0d2"},{"name":"Guinea Pig","hex":"#987652"},{"name":"Gull","hex":"#918c8f"},{"name":"Gum Leaf","hex":"#acc9b2"},{"name":"Gummy Dolphins","hex":"#06a9ca"},{"name":"Gun Powder","hex":"#484753"},{"name":"Gunmetal","hex":"#536267"},{"name":"Guns N’ Roses","hex":"#ff0077"},{"name":"Gunsmoke","hex":"#7a7c76"},{"name":"H₂O","hex":"#bfe1e6"},{"name":"Habañero","hex":"#f98513"},{"name":"Habañero Gold","hex":"#fecf3c"},{"name":"Haddock’s Sweater","hex":"#277aba"},{"name":"Hadfield Blue","hex":"#1177ff"},{"name":"Hairy Heath","hex":"#633528"},{"name":"Haiti","hex":"#2c2a35"},{"name":"Halloween","hex":"#fe653c"},{"name":"Halloween Punch","hex":"#dd2211"},{"name":"Halo","hex":"#e2c392"},{"name":"Halt Red","hex":"#ff004f"},{"name":"Hammam Blue","hex":"#65dcd6"},{"name":"Hamster Fur","hex":"#a6814c"},{"name":"Hamtaro Brown","hex":"#b07426"},{"name":"Hanami Pink","hex":"#f2abe1"},{"name":"Handmade","hex":"#7f735f"},{"name":"Hanging Gardens of Babylon","hex":"#11aa44"},{"name":"Happy Cement","hex":"#979ea1"},{"name":"Happy Hearts","hex":"#d46362"},{"name":"Happy Hippo","hex":"#818581"},{"name":"Happy Piglets","hex":"#f6cbca"},{"name":"Happy Skeleton","hex":"#faeed7"},{"name":"Harbor Mist","hex":"#88aaaa"},{"name":"Harbour Blue","hex":"#417491"},{"name":"Hard Candy","hex":"#ffbbbb"},{"name":"Harem Silk","hex":"#006383"},{"name":"Harlock’s Cape","hex":"#bb0000"},{"name":"Harvest at Dusk","hex":"#cb862c"},{"name":"Harvest Gold","hex":"#eab76a"},{"name":"Harvest Time","hex":"#cf875f"},{"name":"Hatoba Pigeon","hex":"#95859c"},{"name":"Haunted Candelabra","hex":"#57446a"},{"name":"Haunted Forest","hex":"#032e0e"},{"name":"Haunted Hills","hex":"#003311"},{"name":"Haunted Purple","hex":"#991177"},{"name":"Haute Couture","hex":"#a0252a"},{"name":"Havana","hex":"#3b2b2c"},{"name":"Hawaii Morning","hex":"#00bbff"},{"name":"Hawaiian Raspberry","hex":"#ff0051"},{"name":"Hay Day","hex":"#dacd81"},{"name":"Haystacks","hex":"#cfac47"},{"name":"Hazel","hex":"#a36b4b"},{"name":"Hazelnut","hex":"#a8715a"},{"name":"Hazelnut Chocolate","hex":"#7b3f00"},{"name":"Hazelwood","hex":"#fff3d5"},{"name":"Hazy Moon","hex":"#f1dca1"},{"name":"Head in the Clouds","hex":"#d1dde1"},{"name":"Heart of Ice","hex":"#f7fcff"},{"name":"Heart Potion","hex":"#a97fb1"},{"name":"Heartbeat","hex":"#aa0000"},{"name":"Heartless","hex":"#623b70"},{"name":"Heartwarming","hex":"#bf1818"},{"name":"Heat Signature","hex":"#e3000e"},{"name":"Heat Wave","hex":"#ff7a00"},{"name":"Heather Berry","hex":"#e75480"},{"name":"Heaven Gates","hex":"#c7f1ff"},{"name":"Heavenly Sky","hex":"#6b90b3"},{"name":"Heavy Brown","hex":"#73624a"},{"name":"Heavy Charcoal","hex":"#565350"},{"name":"Heavy Cream","hex":"#e8ddc6"},{"name":"Heavy Green","hex":"#49583e"},{"name":"Heavy Heart","hex":"#771122"},{"name":"Heavy Metal","hex":"#46473e"},{"name":"Heavy Orange","hex":"#ee4328"},{"name":"Heavy Red","hex":"#9e1212"},{"name":"Heavy Violet","hex":"#4f566c"},{"name":"Hedge Garden","hex":"#00aa11"},{"name":"Heirloom Blush","hex":"#e3664c"},{"name":"Helium","hex":"#eae5d8"},{"name":"Hellbound","hex":"#710101"},{"name":"Hello Darkness My Old Friend","hex":"#802280"},{"name":"Hello Fall","hex":"#995533"},{"name":"Hello Spring","hex":"#44dd66"},{"name":"Hello Summer","hex":"#55bbff"},{"name":"Hello Winter","hex":"#99ffee"},{"name":"Helvetia Red","hex":"#f00000"},{"name":"Hemp","hex":"#987d73"},{"name":"Her Fierceness","hex":"#6f123c"},{"name":"Her Highness","hex":"#432e6f"},{"name":"Her Majesty","hex":"#f9a4a4"},{"name":"Her Velour","hex":"#bb5f62"},{"name":"Herbal","hex":"#29ab87"},{"name":"Herbal Vapors","hex":"#ddffcc"},{"name":"Herbal Whispers","hex":"#6b6d4e"},{"name":"Herbalist","hex":"#969e86"},{"name":"Herbalist’s Garden","hex":"#119900"},{"name":"Herbivore","hex":"#88ee77"},{"name":"Here Comes the Sun","hex":"#fcdf63"},{"name":"Heroic Red","hex":"#d1191c"},{"name":"Heron","hex":"#6a6887"},{"name":"Herring Silver","hex":"#c6c8cf"},{"name":"Hey Blue!","hex":"#16f8ff"},{"name":"Hibernation","hex":"#6f5166"},{"name":"Hibiscus","hex":"#b6316c"},{"name":"Hickory","hex":"#b7a28e"},{"name":"Hidden Paradise","hex":"#5e8b3d"},{"name":"Hidden Sea Glass","hex":"#6fd1c9"},{"name":"Hidden Valley","hex":"#689938"},{"name":"High Blue","hex":"#4ca8e0"},{"name":"High Dive","hex":"#59b9cc"},{"name":"High Grass","hex":"#bbdd00"},{"name":"High Seas","hex":"#7dabd8"},{"name":"High Sierra","hex":"#cedee2"},{"name":"High Tide","hex":"#85a6c8"},{"name":"High Voltage","hex":"#eeff11"},{"name":"Highland","hex":"#7a9461"},{"name":"Highlander","hex":"#3a533d"},{"name":"Highlands","hex":"#449084"},{"name":"Highway to Hell","hex":"#cd1102"},{"name":"Himalaya","hex":"#736330"},{"name":"Himalayan Salt","hex":"#c07765"},{"name":"Hindu Lotus","hex":"#ee4d83"},{"name":"Hint of Blue","hex":"#cee1f2"},{"name":"Hint of Green","hex":"#dfeade"},{"name":"Hint of Mint","hex":"#dff1d6"},{"name":"Hint of Orange","hex":"#f8e6d9"},{"name":"Hint of Pink","hex":"#f1e4e1"},{"name":"Hint of Red","hex":"#f6dfe0"},{"name":"Hint of Yellow","hex":"#faf1cd"},{"name":"Hinterland","hex":"#616c51"},{"name":"Hippie Trail","hex":"#c6aa2b"},{"name":"Hippy","hex":"#eae583"},{"name":"Hipster Hippo","hex":"#bfb3ab"},{"name":"Hipster Salmon","hex":"#fd7c6e"},{"name":"Hive","hex":"#ffff77"},{"name":"Hobgoblin","hex":"#01ad8f"},{"name":"Hokkaido Lavender","hex":"#7736d9"},{"name":"Hold Your Horses","hex":"#705446"},{"name":"Hole In One","hex":"#4aae97"},{"name":"Holland Tulip","hex":"#f89851"},{"name":"Hollandaise","hex":"#ffee44"},{"name":"Hollow Knight","hex":"#330055"},{"name":"Holy Cannoli","hex":"#db783e"},{"name":"Holy Crow","hex":"#332f2c"},{"name":"Holy Ghost","hex":"#efe9e6"},{"name":"Holy Grail","hex":"#e8d720"},{"name":"Home Brew","hex":"#897b66"},{"name":"Homegrown","hex":"#63884a"},{"name":"Homeopathic Blue","hex":"#dbe7e3"},{"name":"Homeopathic Green","hex":"#e1ebd8"},{"name":"Homeopathic Lavender","hex":"#e5e0ec"},{"name":"Homeopathic Lilac","hex":"#e1e0eb"},{"name":"Homeopathic Lime","hex":"#e9f6e2"},{"name":"Homeopathic Mint","hex":"#e5ead8"},{"name":"Homeopathic Orange","hex":"#f2e6e1"},{"name":"Homeopathic Red","hex":"#ecdbe0"},{"name":"Homeopathic Rose","hex":"#e8dbdd"},{"name":"Homeopathic Yellow","hex":"#ede7d7"},{"name":"Homeworld","hex":"#2299dd"},{"name":"Honey","hex":"#ae8934"},{"name":"Honey and Thyme","hex":"#aaaa00"},{"name":"Honey Bee","hex":"#fcdfa4"},{"name":"Honey Bunny","hex":"#dbb881"},{"name":"Honey Crisp","hex":"#e9c160"},{"name":"Honey Do","hex":"#ededc7"},{"name":"Honey Glow","hex":"#e8b447"},{"name":"Honey Gold","hex":"#e1b67c"},{"name":"Honey Teriyaki","hex":"#ee6611"},{"name":"Honeycomb","hex":"#ddaa11"},{"name":"Honeycomb Glow","hex":"#e4cf99"},{"name":"Honeydew","hex":"#f0fff0"},{"name":"Honeydew Sand","hex":"#eece8d"},{"name":"Honeyed Glow","hex":"#efc488"},{"name":"Honeypot","hex":"#ffc863"},{"name":"Honeysuckle","hex":"#e8ed69"},{"name":"Hong Kong Mist","hex":"#948e90"},{"name":"Hong Kong Taxi","hex":"#a8102a"},{"name":"Honied White","hex":"#fcefd1"},{"name":"Honolulu Blue","hex":"#007fbf"},{"name":"Horizon","hex":"#648894"},{"name":"Hornet Sting","hex":"#ff0033"},{"name":"Horror Snob","hex":"#d34d4d"},{"name":"Horseradish","hex":"#e6dfc4"},{"name":"Hot Beach","hex":"#fff6d9"},{"name":"Hot Brown","hex":"#984218"},{"name":"Hot Butter","hex":"#e69d00"},{"name":"Hot Cacao","hex":"#a5694f"},{"name":"Hot Caramel","hex":"#cc6e3b"},{"name":"Hot Chilli","hex":"#b7513a"},{"name":"Hot Chocolate","hex":"#683939"},{"name":"Hot Cuba","hex":"#bb0033"},{"name":"Hot Curry","hex":"#815b28"},{"name":"Hot Flamin Chilli","hex":"#dd180e"},{"name":"Hot Flamingo","hex":"#b35966"},{"name":"Hot Fudge","hex":"#5e2912"},{"name":"Hot Jazz","hex":"#bc3033"},{"name":"Hot Lava","hex":"#aa0033"},{"name":"Hot Lips","hex":"#c9312b"},{"name":"Hot Magenta","hex":"#ff00cc"},{"name":"Hot Pink","hex":"#ff028d"},{"name":"Hot Sand","hex":"#ccaa00"},{"name":"Hot Sauce","hex":"#ab4f41"},{"name":"Hot Shot","hex":"#ec4f28"},{"name":"Hotspot","hex":"#ff4433"},{"name":"Hotter Butter","hex":"#e68a00"},{"name":"Hotter Than Hell","hex":"#ff4455"},{"name":"Hottest Of Pinks","hex":"#ff80ff"},{"name":"Hourglass","hex":"#e5e0d5"},{"name":"Howling Pink","hex":"#e50752"},{"name":"Hulk","hex":"#008000"},{"name":"Humble Blush","hex":"#e3cdc2"},{"name":"Humble Hippo","hex":"#aaaa99"},{"name":"Hummus","hex":"#eecc99"},{"name":"Hunter","hex":"#33534b"},{"name":"Hurricane","hex":"#8b7e77"},{"name":"Hydra","hex":"#006995"},{"name":"Hydro","hex":"#49747f"},{"name":"Hyper Blue","hex":"#015f97"},{"name":"Hyper Light Drifter","hex":"#eddbda"},{"name":"Hyper Pink","hex":"#ec006c"},{"name":"Hyperlink Blue","hex":"#0000ee"},{"name":"Hyperpop Green","hex":"#17f9a6"},{"name":"Hypnotic Green","hex":"#73e608"},{"name":"Hypnotic Red","hex":"#cf0d14"},{"name":"I Love You Pink","hex":"#d97d8f"},{"name":"Ibis","hex":"#f4b3c2"},{"name":"Ice","hex":"#d6fffa"},{"name":"Ice Citadel","hex":"#b2f8f8"},{"name":"Ice Climber","hex":"#25e2cd"},{"name":"Ice Cold","hex":"#d2eaf1"},{"name":"Ice Cube","hex":"#afe3d6"},{"name":"Ice Dagger","hex":"#cee5df"},{"name":"Ice Desert","hex":"#d1dce8"},{"name":"Ice Ice","hex":"#baebae"},{"name":"Ice Ice Baby","hex":"#00ffdd"},{"name":"Ice Temple","hex":"#11ffee"},{"name":"Iceberg","hex":"#dae4ee"},{"name":"Icebreaker","hex":"#b7c2cc"},{"name":"Iced Coffee","hex":"#aa895d"},{"name":"Icelandic Winter","hex":"#d9e7e3"},{"name":"Icy Breeze","hex":"#c4ecf0"},{"name":"Icy Pink","hex":"#f5ced8"},{"name":"Icy Plains","hex":"#cfdafb"},{"name":"Igniting","hex":"#f4d69a"},{"name":"Iguana","hex":"#878757"},{"name":"Illicit Darkness","hex":"#00022e"},{"name":"Illicit Green","hex":"#56fca2"},{"name":"Illicit Pink","hex":"#ff5ccd"},{"name":"Illicit Purple","hex":"#bf77f6"},{"name":"Illuminati Green","hex":"#419168"},{"name":"Illuminating","hex":"#eeee77"},{"name":"Imperial","hex":"#602f6b"},{"name":"Imperial Ivory","hex":"#f1e8d2"},{"name":"Imperial Lilac","hex":"#a99fcf"},{"name":"Imperial Purple","hex":"#5b3167"},{"name":"Imperial Red","hex":"#ec2938"},{"name":"Imperial Yellow","hex":"#ffb200"},{"name":"In A Pickle","hex":"#978c59"},{"name":"In for a Penny","hex":"#ee8877"},{"name":"In Good Taste","hex":"#b6d4a0"},{"name":"In the Dark","hex":"#3b3c41"},{"name":"In the Pink","hex":"#f4c4d0"},{"name":"In the Red","hex":"#ff2233"},{"name":"In the Shadows","hex":"#cbc4c0"},{"name":"In the Twilight","hex":"#84838e"},{"name":"In the Vines","hex":"#5c457b"},{"name":"Inca Gold","hex":"#aa6d28"},{"name":"Inca Yellow","hex":"#ffd301"},{"name":"Incense","hex":"#af9a7e"},{"name":"Inchworm","hex":"#b2ec5d"},{"name":"Incision","hex":"#ff0022"},{"name":"Incubation Red","hex":"#da1d38"},{"name":"Indian Mesa","hex":"#d5a193"},{"name":"Indian Pale Ale","hex":"#d5bc26"},{"name":"Indian Red","hex":"#850e04"},{"name":"Indian Saffron","hex":"#ff9933"},{"name":"Indian Silk","hex":"#8a5773"},{"name":"Indica","hex":"#588c3a"},{"name":"Indigo","hex":"#4b0082"},{"name":"Indochine","hex":"#9c5b34"},{"name":"Indocile Tiger","hex":"#b96b00"},{"name":"Inescapable Lover","hex":"#820e3b"},{"name":"Infectious Love","hex":"#bb1177"},{"name":"Inferno Orange","hex":"#ff4400"},{"name":"Infinite Night","hex":"#071037"},{"name":"Infinity","hex":"#222831"},{"name":"Infinity and Beyond","hex":"#6e7e99"},{"name":"Infinity Pool","hex":"#94d4e4"},{"name":"Infrared","hex":"#fe486c"},{"name":"Infusion","hex":"#c8d0ca"},{"name":"Ink Black","hex":"#252024"},{"name":"Inkblot","hex":"#393f4b"},{"name":"Inkjet","hex":"#44556b"},{"name":"Inkwell Inception","hex":"#1e1e21"},{"name":"Inland Waters","hex":"#7c939d"},{"name":"Innocent Snowdrop","hex":"#d0c7ff"},{"name":"Insomniac Blue","hex":"#110077"},{"name":"Instant Noodles","hex":"#f4d493"},{"name":"Intense Passion","hex":"#df3163"},{"name":"Intergalactic","hex":"#4d516c"},{"name":"Intergalactic Cowboy","hex":"#222266"},{"name":"Intergalactic Highway","hex":"#273287"},{"name":"Intergalactic Settlement","hex":"#5b1e8b"},{"name":"International Klein Blue","hex":"#002fa6"},{"name":"Interstellar Blue","hex":"#001155"},{"name":"Intimate Journal","hex":"#ccbb99"},{"name":"Into the Blue","hex":"#4f7ba7"},{"name":"Into the Green","hex":"#0d6c49"},{"name":"Into the Night","hex":"#1e3642"},{"name":"Into the Stratosphere","hex":"#425267"},{"name":"Intoxicate","hex":"#11bb55"},{"name":"Intrigue Red","hex":"#b24648"},{"name":"Inuit Blue","hex":"#d8e4e7"},{"name":"Iridescent","hex":"#3a5b52"},{"name":"Irish Clover","hex":"#53734c"},{"name":"Irish Coffee","hex":"#62422b"},{"name":"Irish Moor","hex":"#b5c0b3"},{"name":"Irish Spring","hex":"#90cca3"},{"name":"Iron","hex":"#5e5e5e"},{"name":"Iron Fist","hex":"#cbcdcd"},{"name":"Iron Maiden","hex":"#d6d1dc"},{"name":"Ironside","hex":"#7e8082"},{"name":"Islamic Green","hex":"#009900"},{"name":"Island Coral","hex":"#d8877a"},{"name":"Isle of Dreams","hex":"#bcccb5"},{"name":"Isolation","hex":"#494d55"},{"name":"It’s a Girl!","hex":"#ffdae2"},{"name":"Italian Basil","hex":"#5f6957"},{"name":"Italian Grape","hex":"#413d4b"},{"name":"Italian Roast","hex":"#221111"},{"name":"Ivory","hex":"#fffff0"},{"name":"Ivory Buff","hex":"#ebd999"},{"name":"Ivory Tower","hex":"#fbf3f1"},{"name":"Ivory Wedding","hex":"#edede4"},{"name":"Ivy","hex":"#277b74"},{"name":"Ivy Topiary","hex":"#67614f"},{"name":"Jack and Coke","hex":"#920f0e"},{"name":"Jack-O","hex":"#fb9902"},{"name":"Jackpot","hex":"#d19431"},{"name":"Jacuzzi","hex":"#007cac"},{"name":"Jade","hex":"#00a86b"},{"name":"Jade Jewel","hex":"#247e81"},{"name":"Jade Palace","hex":"#d0eed7"},{"name":"Jade Sea","hex":"#b8e0d0"},{"name":"Jaffa","hex":"#e27945"},{"name":"Jaguar","hex":"#29292f"},{"name":"Jakarta","hex":"#efddc3"},{"name":"Jalapeño","hex":"#9a8d3f"},{"name":"Jalapeño Red","hex":"#c01141"},{"name":"Jambalaya","hex":"#f7b572"},{"name":"James Blonde","hex":"#f2e3b5"},{"name":"Japanese Bonsai","hex":"#829f96"},{"name":"Jasmine","hex":"#fff4bb"},{"name":"Java","hex":"#259797"},{"name":"Jazz","hex":"#5f2c2f"},{"name":"Jazzy Jade","hex":"#55ddcc"},{"name":"Jealous Jellyfish","hex":"#bb0099"},{"name":"Jedi Night","hex":"#041108"},{"name":"Jelly Berry","hex":"#ee1177"},{"name":"Jelly Slug","hex":"#de6646"},{"name":"Jellyfish Sting","hex":"#ee6688"},{"name":"Jet Black","hex":"#353337"},{"name":"Jet d’Eau","hex":"#d1eaec"},{"name":"Jewel","hex":"#136843"},{"name":"Jewel Beetle","hex":"#8cc90b"},{"name":"Jewel Weed","hex":"#46a795"},{"name":"Jigglypuff","hex":"#ffaaff"},{"name":"Jinza Safflower","hex":"#ee827c"},{"name":"Jittery Jade","hex":"#77eebb"},{"name":"John Lemon","hex":"#eeff22"},{"name":"Joker’s Smile","hex":"#d70141"},{"name":"Jolly Jade","hex":"#77ccbb"},{"name":"Jovial Jade","hex":"#88ddaa"},{"name":"Joyous Red","hex":"#ae2719"},{"name":"Jubilant Jade","hex":"#44aa77"},{"name":"Jubilant Meadow","hex":"#7bb92b"},{"name":"Juggernaut","hex":"#255367"},{"name":"Juicy Lime","hex":"#b1cf5d"},{"name":"Juicy Peach","hex":"#d99290"},{"name":"Jumbo","hex":"#878785"},{"name":"June Bud","hex":"#bdda57"},{"name":"June Ivy","hex":"#416858"},{"name":"Jungle","hex":"#00a466"},{"name":"Jungle Civilization","hex":"#69673a"},{"name":"Jungle Jam","hex":"#115511"},{"name":"Jungle Jewels","hex":"#58a64b"},{"name":"Jungle King","hex":"#4f4d32"},{"name":"Jupiter","hex":"#e1e1e2"},{"name":"Jurassic Park","hex":"#3c663e"},{"name":"Just Pink Enough","hex":"#ffebee"},{"name":"Juvie","hex":"#8abbd0"},{"name":"Kabuki","hex":"#a73a3e"},{"name":"Kabul","hex":"#6c5e53"},{"name":"Kaiser Cheese","hex":"#eed484"},{"name":"Kale","hex":"#648251"},{"name":"Kaltes Klares Wasser","hex":"#0ffef9"},{"name":"Kashmir","hex":"#6f8d6a"},{"name":"Kathmandu","hex":"#ad9a5d"},{"name":"Katy Berry","hex":"#aa0077"},{"name":"Kefir","hex":"#d5d5ce"},{"name":"Kelp","hex":"#4d503c"},{"name":"Kelp Forest","hex":"#448811"},{"name":"Kendall Rose","hex":"#f7cccd"},{"name":"Kenyan Copper","hex":"#6c322e"},{"name":"Kermit Green","hex":"#5cb200"},{"name":"Ketchup","hex":"#9a382d"},{"name":"Ketchup Later","hex":"#a91c1c"},{"name":"Khaki","hex":"#c3b091"},{"name":"Kid Icarus","hex":"#a81000"},{"name":"Kilimanjaro","hex":"#3a3532"},{"name":"Kimchi","hex":"#ed4b00"},{"name":"Kimono","hex":"#6d86b6"},{"name":"Kindleflame","hex":"#e9967a"},{"name":"King Kong","hex":"#161410"},{"name":"King Lime","hex":"#add900"},{"name":"King Lizard","hex":"#77dd22"},{"name":"King Nacho","hex":"#ffb800"},{"name":"King Neptune","hex":"#7794c0"},{"name":"King of Waves","hex":"#c6dce7"},{"name":"King Triton","hex":"#3c85be"},{"name":"King’s Plum Pie","hex":"#b3107a"},{"name":"Kingfisher Daisy","hex":"#583580"},{"name":"Kingly Cloud","hex":"#dedede"},{"name":"Kingpin Gold","hex":"#de9930"},{"name":"Kings Yellow","hex":"#ead665"},{"name":"Kinky Pinky","hex":"#ee55cc"},{"name":"Kirby","hex":"#d74894"},{"name":"Kirsch","hex":"#b2132b"},{"name":"Kiss","hex":"#d28ca7"},{"name":"Kiss A Frog","hex":"#bec187"},{"name":"Kiss Me More","hex":"#de6b86"},{"name":"Kiss of a Vampire","hex":"#8a0009"},{"name":"Kiss of the Scorpion","hex":"#dc331a"},{"name":"Kissable","hex":"#fd8f79"},{"name":"Kissed by Mist","hex":"#fcccf5"},{"name":"Kisses","hex":"#ff66bb"},{"name":"Kisses and Hugs","hex":"#ff6677"},{"name":"Kitten’s Eye","hex":"#8aadf7"},{"name":"Kitty Kitty","hex":"#c7bdb3"},{"name":"Kiwi","hex":"#749e4e"},{"name":"Kiwi Crush","hex":"#7bc027"},{"name":"Kiwi Kiss","hex":"#eef9c1"},{"name":"Knight Rider","hex":"#0f0707"},{"name":"Knight’s Armor","hex":"#5c5d5d"},{"name":"Knit Cardigan","hex":"#6d6c5f"},{"name":"Knock On Wood","hex":"#9f9b84"},{"name":"Knockout","hex":"#c42b2d"},{"name":"Kobe","hex":"#882d17"},{"name":"Köfte Brown","hex":"#773644"},{"name":"Koi","hex":"#d2663b"},{"name":"Kombucha","hex":"#d89f66"},{"name":"Komodo Dragon","hex":"#b38052"},{"name":"Koopa Green Shell","hex":"#58d854"},{"name":"Koromiko","hex":"#feb552"},{"name":"Kosher Khaki","hex":"#888877"},{"name":"Kryptonite Green","hex":"#439946"},{"name":"La La Love","hex":"#bf90bb"},{"name":"La Luna","hex":"#ffffe5"},{"name":"La Palma","hex":"#428929"},{"name":"LA Vibes","hex":"#eeccdd"},{"name":"La Vie en Rose","hex":"#d2a5a3"},{"name":"Labrador","hex":"#f2ecd9"},{"name":"Lacquered Liquorice","hex":"#383838"},{"name":"Lacrosse","hex":"#2e5c58"},{"name":"Lagoon","hex":"#4b9b93"},{"name":"Laguna","hex":"#36a5c9"},{"name":"Lake Lucerne","hex":"#689db7"},{"name":"Laksa","hex":"#e6bf95"},{"name":"Lama","hex":"#e0bb95"},{"name":"Lambs Wool","hex":"#e6d1b2"},{"name":"Landjäger","hex":"#af403c"},{"name":"Langoustine","hex":"#dc5226"},{"name":"Lapis on Neptune","hex":"#1f22d2"},{"name":"Larb Gai","hex":"#dfc6aa"},{"name":"Laser Lemon","hex":"#ffff66"},{"name":"Laser Trap","hex":"#ff3f6a"},{"name":"Last of Lettuce","hex":"#aadd66"},{"name":"Last of the Lilacs","hex":"#cbbbcd"},{"name":"Last Straw","hex":"#e3dbcd"},{"name":"Last Warning","hex":"#d30f3f"},{"name":"Lasting Lime","hex":"#88ff00"},{"name":"Later Gator","hex":"#008a51"},{"name":"Latte","hex":"#c5a582"},{"name":"Lava","hex":"#cf1020"},{"name":"Lava Pit","hex":"#e46f34"},{"name":"Lava Rock","hex":"#535e64"},{"name":"Lava Stone","hex":"#3c4151"},{"name":"Lavender","hex":"#b56edc"},{"name":"Lavender Ash","hex":"#9998a7"},{"name":"Lavender Bliss","hex":"#cec3dd"},{"name":"Lavender Candy","hex":"#fcb4d5"},{"name":"Lavendless","hex":"#b86fc2"},{"name":"Lavish Spending","hex":"#8469bc"},{"name":"Lawn Green","hex":"#4da409"},{"name":"Lazy Daisy","hex":"#f6eba1"},{"name":"Lazy Lizard","hex":"#9c9c4b"},{"name":"Le Grand Bleu","hex":"#244e94"},{"name":"Lead","hex":"#212121"},{"name":"Leaf","hex":"#71aa34"},{"name":"Leafy","hex":"#679b6a"},{"name":"Leafy Canopy","hex":"#aacc11"},{"name":"Leafy Greens","hex":"#80bb66"},{"name":"Leafy Lemon","hex":"#c0f000"},{"name":"Leafy Lush","hex":"#08690e"},{"name":"Leafy Woodland","hex":"#aabb11"},{"name":"Leapfrog","hex":"#41a94f"},{"name":"Leather","hex":"#906a54"},{"name":"Leek","hex":"#98d98e"},{"name":"Left on Red","hex":"#ff0303"},{"name":"Legendary Lavender","hex":"#9d61d4"},{"name":"Lemon","hex":"#fff700"},{"name":"Lemon Burst","hex":"#fed67e"},{"name":"Lemon Curd","hex":"#ffee11"},{"name":"Lemon Grass","hex":"#999a86"},{"name":"Lemon Meringue","hex":"#f6e199"},{"name":"Lemon Tart","hex":"#ffdd66"},{"name":"Lemon Zest","hex":"#f9d857"},{"name":"Lemonade","hex":"#efe499"},{"name":"Les Demoiselles d’Avignon","hex":"#e59d7b"},{"name":"Let it Snow","hex":"#d8f1f4"},{"name":"Lethal Lime","hex":"#88ff11"},{"name":"Liaison","hex":"#8c3f52"},{"name":"Lichen","hex":"#8ebaa6"},{"name":"Lick and Kiss","hex":"#ee5577"},{"name":"Lifeguard","hex":"#e50000"},{"name":"Lifeline","hex":"#990033"},{"name":"Light Blue","hex":"#add8e6"},{"name":"Light Blush","hex":"#e9c4cc"},{"name":"Light Brown","hex":"#b5651d"},{"name":"Light Green","hex":"#76ff7b"},{"name":"Light Grey","hex":"#d8dcd6"},{"name":"Light Lilac","hex":"#dcc6d2"},{"name":"Light Mint","hex":"#b6ffbb"},{"name":"Light My Fire","hex":"#f8611a"},{"name":"Light Pink","hex":"#ffd1df"},{"name":"Light Red","hex":"#ff7f7f"},{"name":"Light Spirited","hex":"#d8eee7"},{"name":"Light Yellow","hex":"#fffe7a"},{"name":"Lighthouse","hex":"#f3f4f4"},{"name":"Lighthouse Glow","hex":"#f8d568"},{"name":"Lightning Bolt","hex":"#e5ebe6"},{"name":"Lightning Bug","hex":"#efde74"},{"name":"Lights Out","hex":"#3d474b"},{"name":"Lilac","hex":"#cea2fd"},{"name":"Lilac Lace","hex":"#c6a1cf"},{"name":"Lilac Lotion","hex":"#ff3388"},{"name":"Lilac Spring","hex":"#8822cc"},{"name":"Lily","hex":"#c19fb3"},{"name":"Lily Pads","hex":"#6db083"},{"name":"Lima","hex":"#a9f971"},{"name":"Lime","hex":"#aaff32"},{"name":"Lime Fizz","hex":"#cfe838"},{"name":"Lime It or Leave It","hex":"#8ca94a"},{"name":"Lime Mist","hex":"#ddffaa"},{"name":"Lime Punch","hex":"#c0d725"},{"name":"Lime Twist","hex":"#c6d624"},{"name":"Lime Zest","hex":"#ddff00"},{"name":"Limestoned","hex":"#a7cca4"},{"name":"Limolicious","hex":"#97b73a"},{"name":"Limon","hex":"#f7eb73"},{"name":"Limonana","hex":"#11dd66"},{"name":"Limoncello","hex":"#bfff00"},{"name":"Lincoln Green","hex":"#195905"},{"name":"Lindworm Green","hex":"#172808"},{"name":"Linen","hex":"#faf0e6"},{"name":"Lingering Storm","hex":"#858381"},{"name":"Link to the Past","hex":"#d2b48c"},{"name":"Lion","hex":"#c19a62"},{"name":"Lion King","hex":"#dd9933"},{"name":"Lion’s Roar","hex":"#f5dab3"},{"name":"Lionheart","hex":"#cc2222"},{"name":"Lip Gloss","hex":"#dfcdc7"},{"name":"Lipstick","hex":"#c95b83"},{"name":"Lipstick Illusion","hex":"#d4696d"},{"name":"Liquid Denim","hex":"#2d3796"},{"name":"Liquid Gold","hex":"#fdc675"},{"name":"Liquid Lava","hex":"#f77511"},{"name":"Liquid Lime","hex":"#cdf80c"},{"name":"Liquid Neon","hex":"#c8ff00"},{"name":"Liquorice","hex":"#0a0502"},{"name":"Liquorice Red","hex":"#740900"},{"name":"Lit","hex":"#fffed8"},{"name":"Little Ladybug","hex":"#ff1414"},{"name":"Little Lamb","hex":"#eae6d7"},{"name":"Little Mermaid","hex":"#2d454a"},{"name":"Little Princess","hex":"#e6aac1"},{"name":"Liver","hex":"#654a46"},{"name":"Lizard","hex":"#7b6943"},{"name":"Llilacquered","hex":"#c35b99"},{"name":"Lobster","hex":"#bb240c"},{"name":"Local Curry","hex":"#cb9e34"},{"name":"Loch Ness","hex":"#5f6db0"},{"name":"Lolita","hex":"#bf2735"},{"name":"Lollipop","hex":"#d91e3f"},{"name":"Lone Hunter","hex":"#94c84c"},{"name":"Lonely Chocolate","hex":"#4a0a00"},{"name":"Lonestar","hex":"#522426"},{"name":"Long Beach","hex":"#faefdf"},{"name":"Long-Haul Flight","hex":"#002277"},{"name":"Looney Blue","hex":"#11ffff"},{"name":"Lords of the Night","hex":"#664488"},{"name":"Lost at Sea","hex":"#8d9ca7"},{"name":"Lost Golfer","hex":"#74af54"},{"name":"Lost in Heaven","hex":"#002489"},{"name":"Lost in Space","hex":"#03386a"},{"name":"Lost in the Woods","hex":"#014426"},{"name":"Lost in Time","hex":"#9fafbd"},{"name":"Lost Space","hex":"#969389"},{"name":"Lotion","hex":"#fefdfa"},{"name":"Lotus Flower","hex":"#f4f0da"},{"name":"Loud Lime","hex":"#88ff22"},{"name":"Loudicious Pink","hex":"#d92fb4"},{"name":"Love Affair","hex":"#ffbec8"},{"name":"Love Dust","hex":"#eb94da"},{"name":"Love Fumes","hex":"#fdd0d5"},{"name":"Love Goddess","hex":"#cd0d0d"},{"name":"Love Juice","hex":"#cc1155"},{"name":"Love Letter","hex":"#e4658e"},{"name":"Love Potion","hex":"#ce145e"},{"name":"Love Priestess","hex":"#bb55cc"},{"name":"Love Spell","hex":"#f8b4c4"},{"name":"Love Surge","hex":"#ce1d51"},{"name":"Love Vessel","hex":"#ee0099"},{"name":"Loveland","hex":"#e6718d"},{"name":"Lovely Breeze","hex":"#f9d8e4"},{"name":"Lovely Little Rosy","hex":"#e35f66"},{"name":"Lox","hex":"#ec9079"},{"name":"Lucid Dream","hex":"#632f92"},{"name":"Lucid Dreams","hex":"#cceeff"},{"name":"Lucius Lilac","hex":"#baa2ce"},{"name":"Lucky","hex":"#ab9a1c"},{"name":"Lucky Clover","hex":"#008400"},{"name":"Lucky Grey","hex":"#777777"},{"name":"Lucky Lobster","hex":"#cc3322"},{"name":"Lucky Penny","hex":"#bc6f37"},{"name":"Ludicrous Lemming","hex":"#bb8877"},{"name":"Luigi","hex":"#4cbb17"},{"name":"Lumberjack","hex":"#9d4542"},{"name":"Luna","hex":"#d4d8ce"},{"name":"Lunar Base","hex":"#878786"},{"name":"Lunar Landing","hex":"#d2cfc1"},{"name":"Lunar Light","hex":"#9b959c"},{"name":"Lunar Luxury","hex":"#fbf4d6"},{"name":"Lunar Outpost","hex":"#828287"},{"name":"Lunatic Lynx","hex":"#ddaa88"},{"name":"Lurid Lettuce","hex":"#b4f319"},{"name":"Luscious Lemongrass","hex":"#517933"},{"name":"Lush","hex":"#c5bda0"},{"name":"Lush Bamboo","hex":"#afbb33"},{"name":"Lush Garden","hex":"#008811"},{"name":"Lush Grass","hex":"#468d45"},{"name":"Lush Green","hex":"#bbee00"},{"name":"Lush Paradise","hex":"#2e7d32"},{"name":"Lush Plains","hex":"#22bb22"},{"name":"Lust","hex":"#e62020"},{"name":"Lustful Wishes","hex":"#cc4499"},{"name":"Lusty Lavender","hex":"#8d5eb7"},{"name":"Lusty Lips","hex":"#d5174e"},{"name":"Lusty Lizard","hex":"#00bb11"},{"name":"Luxor Gold","hex":"#ab8d3f"},{"name":"Luxurious","hex":"#d4b75d"},{"name":"Luxurious Lime","hex":"#88ee22"},{"name":"Lynx","hex":"#604d47"},{"name":"M. Bison","hex":"#b4023d"},{"name":"Macabre","hex":"#880033"},{"name":"Macadamia","hex":"#e1ccaf"},{"name":"Macaroni","hex":"#f3d085"},{"name":"Macaroni and Cheese","hex":"#ffb97b"},{"name":"Macaroon","hex":"#b38b71"},{"name":"Macau","hex":"#46c299"},{"name":"Machinery","hex":"#9999aa"},{"name":"Machu Picchu Gardens","hex":"#99bb33"},{"name":"Mad For Mango","hex":"#f8a200"},{"name":"Made in the Shade","hex":"#6b717a"},{"name":"Mademoiselle Pink","hex":"#f504c9"},{"name":"Madonna","hex":"#3f4250"},{"name":"Madras","hex":"#473e23"},{"name":"Magenta","hex":"#ff00ff"},{"name":"Magenta Affair","hex":"#aa44dd"},{"name":"Magenta Elephant","hex":"#de0170"},{"name":"Magenta Fizz","hex":"#ed24ed"},{"name":"Magenta Memoir","hex":"#b4559b"},{"name":"Magentarama","hex":"#cf3476"},{"name":"Magentle","hex":"#aa11aa"},{"name":"Magentleman","hex":"#aa22bb"},{"name":"Magento","hex":"#bf3cff"},{"name":"Magic Carpet","hex":"#9488be"},{"name":"Magic Ink","hex":"#0247fe"},{"name":"Magic Magenta","hex":"#7f4774"},{"name":"Magic Potion","hex":"#ff4466"},{"name":"Magical Merlin","hex":"#3d8ed0"},{"name":"Magical Moonlight","hex":"#f0eeeb"},{"name":"Magical Stardust","hex":"#eaeadb"},{"name":"Magma","hex":"#ff4e01"},{"name":"Magna Cum Laude","hex":"#dd0066"},{"name":"Magnesium","hex":"#c1c2c3"},{"name":"Magnet","hex":"#525054"},{"name":"Magnetic","hex":"#b2b5af"},{"name":"Magnificent Magenta","hex":"#ee22aa"},{"name":"Magnolia","hex":"#fff9e4"},{"name":"Magnolia Petal","hex":"#f7eee3"},{"name":"Maharaja","hex":"#3f354f"},{"name":"Mahogany","hex":"#c04000"},{"name":"Mai Tai","hex":"#a56531"},{"name":"Maiden’s Blush","hex":"#f3d3bf"},{"name":"Maison Verte","hex":"#e5f0d9"},{"name":"Maize","hex":"#f4d054"},{"name":"Maizena","hex":"#fbec5e"},{"name":"Majestic Dune","hex":"#f3bc80"},{"name":"Majestic Eggplant","hex":"#443388"},{"name":"Majestic Elk","hex":"#ad9a84"},{"name":"Majestic Evergreen","hex":"#7d8878"},{"name":"Majestic Magenta","hex":"#ee4488"},{"name":"Majestic Magic","hex":"#555570"},{"name":"Majesty","hex":"#673e6e"},{"name":"Major Brown","hex":"#61574e"},{"name":"Major Magenta","hex":"#f246a7"},{"name":"Majorelle Gardens","hex":"#337766"},{"name":"Makin it Rain","hex":"#88bb55"},{"name":"Malevolent Mauve","hex":"#bb6688"},{"name":"Malibu","hex":"#66b7e1"},{"name":"Malibu Sun","hex":"#fff2d9"},{"name":"Mallard","hex":"#254855"},{"name":"Malt","hex":"#ddcfbc"},{"name":"Mamba","hex":"#766d7c"},{"name":"Man Cave","hex":"#816045"},{"name":"Mana Tree","hex":"#4f7942"},{"name":"Mandarin","hex":"#f37a48"},{"name":"Mandarin Rind","hex":"#f1903d"},{"name":"Manga Pink","hex":"#f5b9d8"},{"name":"Mangala Pink","hex":"#e781a6"},{"name":"Mango","hex":"#ffa62b"},{"name":"Mango Cheesecake","hex":"#fbedda"},{"name":"Mango Latte","hex":"#ffbb4d"},{"name":"Mango Madness","hex":"#fd8c23"},{"name":"Mango Tango","hex":"#ff8243"},{"name":"Mangrove","hex":"#757461"},{"name":"Manhattan","hex":"#e2af80"},{"name":"Maniac Green","hex":"#009000"},{"name":"Maniac Mansion","hex":"#004058"},{"name":"Mantis","hex":"#74c365"},{"name":"Maple Syrup","hex":"#bb9351"},{"name":"Maraschino","hex":"#ff2600"},{"name":"Marble Grape","hex":"#dee2c7"},{"name":"Marble Quarry","hex":"#e2dcd7"},{"name":"Marble White","hex":"#f2f0e6"},{"name":"Marigold","hex":"#fcc006"},{"name":"Marilyn MonRouge","hex":"#c9001e"},{"name":"Marina","hex":"#5a88c8"},{"name":"Marinara Red","hex":"#ff0008"},{"name":"Marine","hex":"#042e60"},{"name":"Mario","hex":"#e4000f"},{"name":"Maritime","hex":"#bdcfea"},{"name":"Maritime Outpost","hex":"#1e4581"},{"name":"Maroon","hex":"#800000"},{"name":"Mars","hex":"#ad6242"},{"name":"Marsh Fog","hex":"#c6d8c7"},{"name":"Marshland","hex":"#2b2e26"},{"name":"Marshmallow","hex":"#f0eee4"},{"name":"Marshmallow Heart","hex":"#f9dce3"},{"name":"Marsupilami","hex":"#fdf200"},{"name":"Martian","hex":"#aea132"},{"name":"Martian Cerulean","hex":"#57958b"},{"name":"Martian Colony","hex":"#e5750f"},{"name":"Martini","hex":"#b7a8a3"},{"name":"Masala","hex":"#57534b"},{"name":"Mascarpone","hex":"#ece6d4"},{"name":"Master Chief","hex":"#507d2a"},{"name":"Master Key","hex":"#ddcc88"},{"name":"Master Nacho","hex":"#ffb81b"},{"name":"Master Sword Blue","hex":"#00ffee"},{"name":"Matcha Mecha","hex":"#9faf6c"},{"name":"Matt Black","hex":"#151515"},{"name":"Matt Blue","hex":"#2c6fbb"},{"name":"Matt Demon","hex":"#dd4433"},{"name":"Matt Green","hex":"#39ad48"},{"name":"Matt Lilac","hex":"#dec6d3"},{"name":"Matt Pink","hex":"#ffb6c1"},{"name":"Matt Purple","hex":"#9370db"},{"name":"Matt White","hex":"#ffffd4"},{"name":"Matterhorn","hex":"#524b4b"},{"name":"Mature Cognac","hex":"#9a463d"},{"name":"Mauve","hex":"#e0b0ff"},{"name":"Mauve It","hex":"#bb4466"},{"name":"Mauve Magic","hex":"#bf91b2"},{"name":"Mauvelous","hex":"#d6b3c0"},{"name":"May Green","hex":"#4c9141"},{"name":"Mayan Treasure","hex":"#ce9844"},{"name":"Mayonnaise","hex":"#f6eed1"},{"name":"McNuke","hex":"#33ff11"},{"name":"Meadow Morn","hex":"#aebea6"},{"name":"Meadow Yellow","hex":"#f7da90"},{"name":"Mean Girls Lipstick","hex":"#ff00ae"},{"name":"Meat","hex":"#f08080"},{"name":"Meatloaf","hex":"#663311"},{"name":"Mecha Kitty","hex":"#d0c4d3"},{"name":"Mecha Metal","hex":"#848393"},{"name":"Medallion","hex":"#c3a679"},{"name":"Medieval Blue","hex":"#2e3858"},{"name":"Mediterranea","hex":"#39636a"},{"name":"Mediterranean Blue","hex":"#1682b9"},{"name":"Mediterranean Sea","hex":"#1e8cab"},{"name":"Medium Roast","hex":"#3c2005"},{"name":"Medlar","hex":"#d5d7bf"},{"name":"Mega Metal Mecha","hex":"#dfcbcf"},{"name":"Megaman","hex":"#3cbcfc"},{"name":"Melancholia","hex":"#12390d"},{"name":"Melanzane","hex":"#342931"},{"name":"Mellow Apricot","hex":"#f8b878"},{"name":"Mellow Drama","hex":"#ffc65f"},{"name":"Mellow Mango","hex":"#cc4400"},{"name":"Mellow Melon","hex":"#ee2266"},{"name":"Mellow Mint","hex":"#ddedbd"},{"name":"Mellow Yellow","hex":"#f8de7f"},{"name":"Melodramatic Magenta","hex":"#dd22aa"},{"name":"Melon","hex":"#ff7855"},{"name":"Melondrama","hex":"#ee8170"},{"name":"Melting Glacier","hex":"#e9f9f5"},{"name":"Melting Point","hex":"#cbe1e4"},{"name":"Memory Lane","hex":"#c7d1db"},{"name":"Mental Floss","hex":"#deb4c5"},{"name":"Menthol Kiss","hex":"#a0e2d4"},{"name":"Mercurial","hex":"#b6b0a9"},{"name":"Mercury","hex":"#ebebeb"},{"name":"Merguez","hex":"#650021"},{"name":"Meringue","hex":"#f3e4b3"},{"name":"Merino","hex":"#e1dbd0"},{"name":"Merlot","hex":"#730039"},{"name":"Merlot Fields","hex":"#712735"},{"name":"Merlot Magic","hex":"#b64055"},{"name":"Mermaid Blues","hex":"#004477"},{"name":"Mermaid Dreams","hex":"#0088bb"},{"name":"Mermaid Tears","hex":"#d9e6a6"},{"name":"Mermaid’s Kiss","hex":"#59c8a5"},{"name":"Metal","hex":"#babfbc"},{"name":"Metal Gear","hex":"#a2c3db"},{"name":"Metal Petal","hex":"#b090b2"},{"name":"Metallic","hex":"#bcc3c7"},{"name":"Meteor","hex":"#bb7431"},{"name":"Meteor Shower","hex":"#5533ff"},{"name":"Meteorite","hex":"#4a3b6a"},{"name":"Methadone","hex":"#cc2233"},{"name":"Metroid Red","hex":"#f83800"},{"name":"Metropolis","hex":"#61584f"},{"name":"Metropolitan Silhouette","hex":"#3e4244"},{"name":"Mexican Chile","hex":"#d16d76"},{"name":"Mexican Standoff","hex":"#ec9f76"},{"name":"Microchip","hex":"#babcc0"},{"name":"Midnight","hex":"#03012d"},{"name":"Midnight Aubergine","hex":"#853c69"},{"name":"Midnight Dreams","hex":"#002233"},{"name":"Midnight Edition","hex":"#0c121b"},{"name":"Midnight Express","hex":"#21263a"},{"name":"Midnight in Tokyo","hex":"#000088"},{"name":"Midnight Interlude","hex":"#32496f"},{"name":"Midnight Masquerade","hex":"#2c2e47"},{"name":"Midnight Melancholia","hex":"#002266"},{"name":"Midnight Mirage","hex":"#001f3f"},{"name":"Midnight Ocean","hex":"#0f2d4d"},{"name":"Midnight Pie","hex":"#372d52"},{"name":"Midnight Pines","hex":"#17240b"},{"name":"Midnight Serenade","hex":"#41434e"},{"name":"Midnight Shadow","hex":"#566373"},{"name":"Midnight Sky","hex":"#424753"},{"name":"Midnight Velvet","hex":"#2a2243"},{"name":"Midori","hex":"#2a603b"},{"name":"Midsummer Nights","hex":"#0011ee"},{"name":"Mighty Mauve","hex":"#8f7f85"},{"name":"Mikado Yellow","hex":"#ffc40c"},{"name":"Militant Vegan","hex":"#229955"},{"name":"Milk","hex":"#fdfff5"},{"name":"Milk and Cookies","hex":"#e9e1df"},{"name":"Milk Chocolate","hex":"#7f4e1e"},{"name":"Milk Foam","hex":"#f6ffe8"},{"name":"Milk Mustache","hex":"#faf3e6"},{"name":"Milk Tooth","hex":"#faebd7"},{"name":"Milky Waves","hex":"#6bb3db"},{"name":"Mille-Feuille","hex":"#efc87d"},{"name":"Millennial Pink","hex":"#f6c8c1"},{"name":"Million Grey","hex":"#999999"},{"name":"Mimi Pink","hex":"#ffdae9"},{"name":"Mimosa","hex":"#f5e9d5"},{"name":"Mindaro","hex":"#daea6f"},{"name":"Minestrone","hex":"#c72616"},{"name":"Ming","hex":"#407577"},{"name":"Minion Yellow","hex":"#fece4e"},{"name":"Mink","hex":"#8a7561"},{"name":"Minotaurus Brown","hex":"#882211"},{"name":"Mint","hex":"#3eb489"},{"name":"Mint Bliss","hex":"#7effba"},{"name":"Mint Chip","hex":"#cfebea"},{"name":"Mint Coffee","hex":"#ccffee"},{"name":"Mint to Be","hex":"#98ff97"},{"name":"Mint Twist","hex":"#98cbba"},{"name":"Mint-o-licious","hex":"#b6e9c8"},{"name":"Mintastic","hex":"#afffd5"},{"name":"Minted Blueberry Lemonade","hex":"#b32651"},{"name":"Minted Elegance","hex":"#6ec9a3"},{"name":"Mintnight","hex":"#7cbbae"},{"name":"Minty Fresh","hex":"#d2f2e7"},{"name":"Minty Paradise","hex":"#00ffbb"},{"name":"Minute Mauve","hex":"#f2e4f5"},{"name":"Mississippi River","hex":"#3b638c"},{"name":"Mistletoe","hex":"#8aa282"},{"name":"Misty Cold Sea","hex":"#83bbc1"},{"name":"Misty Harbor","hex":"#65769a"},{"name":"Misty Haze","hex":"#cec9c3"},{"name":"Misty Marsh","hex":"#d3e1d3"},{"name":"Misty Morning","hex":"#b2c8bd"},{"name":"Misty Mountains","hex":"#c0d0e6"},{"name":"Mithril","hex":"#878787"},{"name":"Miyamoto Red","hex":"#e4030f"},{"name":"Moccasin","hex":"#fbebd6"},{"name":"Mocha","hex":"#9d7651"},{"name":"Mocha Delight","hex":"#8e664e"},{"name":"Mocha Ice","hex":"#dfd2ca"},{"name":"Mocha Madness","hex":"#8b6b58"},{"name":"Mochaccino","hex":"#945200"},{"name":"Mochito","hex":"#8efa00"},{"name":"Modern Monument","hex":"#d6d6d1"},{"name":"Moelleux Au Chocolat","hex":"#553311"},{"name":"Mohalla","hex":"#a79b7e"},{"name":"Mojito","hex":"#e4f3e0"},{"name":"Molasses","hex":"#574a47"},{"name":"Mole","hex":"#392d2b"},{"name":"Molten Caramel","hex":"#bb7a39"},{"name":"Molten Core","hex":"#ff5800"},{"name":"Molten Gold","hex":"#e8c690"},{"name":"Mom’s Pancake","hex":"#f5c553"},{"name":"Momo Peach","hex":"#f47983"},{"name":"Mona Lisa","hex":"#ff9889"},{"name":"Monet Magic","hex":"#c1acc3"},{"name":"Money","hex":"#7b9a6d"},{"name":"Monkey Island","hex":"#553b39"},{"name":"Monstera","hex":"#5f674b"},{"name":"Monstrous Green","hex":"#22cc11"},{"name":"Mont Blanc","hex":"#9eb6d8"},{"name":"Montezuma Gold","hex":"#eecc44"},{"name":"Montreux Blue","hex":"#5879a2"},{"name":"Monument","hex":"#84898c"},{"name":"Monument Valley","hex":"#ad5c34"},{"name":"Monza","hex":"#c7031e"},{"name":"Moon Base","hex":"#7d7d77"},{"name":"Moon Glow","hex":"#f5f3ce"},{"name":"Moon Landing","hex":"#a7a7a7"},{"name":"Moon Rock","hex":"#897d76"},{"name":"Moon Veil","hex":"#8d99b1"},{"name":"Moonbeam","hex":"#c2b8ae"},{"name":"Moondance","hex":"#e5decc"},{"name":"Moonless Mystery","hex":"#1e2433"},{"name":"Moonless Night","hex":"#3c393d"},{"name":"Moonless Sky","hex":"#444b4a"},{"name":"Moonlight","hex":"#f6eed5"},{"name":"Moonlight Mauve","hex":"#ca83a7"},{"name":"Moonlit Forest","hex":"#3e6d6a"},{"name":"Moonraker","hex":"#c0b2d7"},{"name":"Moonscape","hex":"#806b77"},{"name":"Moonwalk","hex":"#bebec4"},{"name":"Moor-Monster","hex":"#1f5429"},{"name":"Moorland","hex":"#a6ab9b"},{"name":"Morbid Princess","hex":"#9e0e64"},{"name":"Morel","hex":"#73645c"},{"name":"Morning Bread","hex":"#e7e6de"},{"name":"Morning Mist","hex":"#e5edf1"},{"name":"Morning Snow","hex":"#f5f4ed"},{"name":"Moroccan Blue","hex":"#115674"},{"name":"Morocco","hex":"#b67267"},{"name":"Morrel","hex":"#ac8f6c"},{"name":"Morris Leaf","hex":"#c2d3af"},{"name":"Mortal Yellow","hex":"#dead00"},{"name":"Mosque","hex":"#005f5b"},{"name":"Moss","hex":"#009051"},{"name":"Moss Gardens","hex":"#768b59"},{"name":"Mosslands","hex":"#779966"},{"name":"Mossy","hex":"#857349"},{"name":"Mossy Glossy","hex":"#789b4a"},{"name":"Moth","hex":"#cbc1a2"},{"name":"Mother Earth","hex":"#849c8d"},{"name":"Mother Nature","hex":"#bde1c4"},{"name":"Mother’s Milk","hex":"#f7edca"},{"name":"Motherland","hex":"#bcb667"},{"name":"Mothy","hex":"#cebbb3"},{"name":"Mount Eden","hex":"#e7efe0"},{"name":"Mount Olympus","hex":"#d4ffff"},{"name":"Mountain Dew","hex":"#cfe2e0"},{"name":"Mountain Peak","hex":"#e9e0d4"},{"name":"Mountain View","hex":"#394c3b"},{"name":"Moutarde de Bénichon","hex":"#bf9005"},{"name":"Mr. Krabs","hex":"#d04127"},{"name":"Ms. Pac-Man Kiss","hex":"#ff00aa"},{"name":"Mt. Rushmore","hex":"#7f8181"},{"name":"Muddy","hex":"#a13905"},{"name":"Muddy Brown","hex":"#886806"},{"name":"Muddy Green","hex":"#657432"},{"name":"Muddy Mauve","hex":"#e4b3cc"},{"name":"Muddy Olive","hex":"#4b5d46"},{"name":"Muddy Quicksand","hex":"#c3988b"},{"name":"Muddy Rose","hex":"#e2beb4"},{"name":"Muddy Yellow","hex":"#bfac05"},{"name":"Muesli","hex":"#9e7e53"},{"name":"Muffled White","hex":"#dadbe2"},{"name":"Mulberry","hex":"#920a4e"},{"name":"Mule","hex":"#827b77"},{"name":"Mulled Cider","hex":"#a18162"},{"name":"Mummy’s Tomb","hex":"#828e84"},{"name":"Munch On Melon","hex":"#f23e67"},{"name":"Munsell Blue","hex":"#0093af"},{"name":"Munsell Yellow","hex":"#efcc00"},{"name":"Murasaki","hex":"#4f284b"},{"name":"Murderous Magenta","hex":"#b3205f"},{"name":"Murmur","hex":"#c7cfc7"},{"name":"Muscat Blanc","hex":"#ebe2cf"},{"name":"Mushroom","hex":"#bdaca3"},{"name":"Mushroom Forest","hex":"#8e8062"},{"name":"Mushroom Risotto","hex":"#dbd0ca"},{"name":"Mustang","hex":"#5e4a47"},{"name":"Mustard","hex":"#ceb301"},{"name":"Mustard Musketeers","hex":"#d5a129"},{"name":"Mustard Seed","hex":"#c69f26"},{"name":"Mutabilis","hex":"#c29594"},{"name":"Muted Berry","hex":"#91788c"},{"name":"Muted Blue","hex":"#3b719f"},{"name":"Muted Clay","hex":"#cf8a78"},{"name":"Muted Green","hex":"#5fa052"},{"name":"Muted Lime","hex":"#d0c678"},{"name":"Muted Mauve","hex":"#b3a9a3"},{"name":"Muted Pink","hex":"#d1768f"},{"name":"Muted Purple","hex":"#805b87"},{"name":"MVS Red","hex":"#ee0000"},{"name":"Mykonos","hex":"#387abe"},{"name":"Myrtle","hex":"#21421e"},{"name":"Mysterious Blue","hex":"#3e7a85"},{"name":"Mysterious Depths","hex":"#060929"},{"name":"Mysterious Mixture","hex":"#0f521a"},{"name":"Mysterious Waters","hex":"#27454a"},{"name":"Mystery Mint","hex":"#bbefd3"},{"name":"Mystic Blue","hex":"#48a8d0"},{"name":"Mystic Magenta","hex":"#e02e82"},{"name":"Mystic Nights","hex":"#4b2c74"},{"name":"Mystic White","hex":"#ebebe9"},{"name":"Mystical Shadow","hex":"#352b30"},{"name":"Mystifying Magenta","hex":"#c920b0"},{"name":"Mythical Night","hex":"#1c2e63"},{"name":"Nacho","hex":"#ffcb5d"},{"name":"Nacho Cheese","hex":"#ffbb00"},{"name":"Naga Viper Pepper","hex":"#ed292b"},{"name":"Naked Noodle","hex":"#f7cb6e"},{"name":"Namibia","hex":"#7c6d61"},{"name":"Naples Yellow","hex":"#fada5f"},{"name":"Napoleonic Blue","hex":"#2c4170"},{"name":"Narwhal Grey","hex":"#080813"},{"name":"Nattō","hex":"#c79843"},{"name":"Natural Light","hex":"#f1ebc8"},{"name":"Natural Orchestra","hex":"#4c9c77"},{"name":"Natural Order","hex":"#77b033"},{"name":"Natural Wool","hex":"#fff6d7"},{"name":"Nature","hex":"#bfd5b3"},{"name":"Naughty Hottie","hex":"#ba403a"},{"name":"Nautical","hex":"#2e4a7d"},{"name":"Nautical Creatures","hex":"#295c7a"},{"name":"Nautilus","hex":"#273c5a"},{"name":"Naval","hex":"#41729f"},{"name":"Naval Adventures","hex":"#072688"},{"name":"Naval Blue","hex":"#384b6b"},{"name":"Naval Night","hex":"#011c39"},{"name":"Near Moon","hex":"#5ee7df"},{"name":"Nebula","hex":"#a104c3"},{"name":"Nebulous","hex":"#c4b9b8"},{"name":"Necklace Pearl","hex":"#f6eeed"},{"name":"Nectar","hex":"#ecdacd"},{"name":"Nectar Jackpot","hex":"#f0d38f"},{"name":"Nectarine","hex":"#ff8656"},{"name":"Negishi Green","hex":"#938b4b"},{"name":"Negroni","hex":"#eec7a2"},{"name":"Neo Mint","hex":"#aaffcc"},{"name":"Neon Blue","hex":"#04d9ff"},{"name":"Neon Boneyard","hex":"#dfc5fe"},{"name":"Neon Carrot","hex":"#ff9832"},{"name":"Neon Fuchsia","hex":"#fe4164"},{"name":"Neon Green","hex":"#39ff14"},{"name":"Neon Pink","hex":"#fe019a"},{"name":"Neon Purple","hex":"#bc13fe"},{"name":"Neon Red","hex":"#ff073a"},{"name":"Neon Romance","hex":"#e9023a"},{"name":"Neon Rose","hex":"#ff0080"},{"name":"Neon Violet","hex":"#674876"},{"name":"Neon Yellow","hex":"#cfff04"},{"name":"Neptune Green","hex":"#7fbb9e"},{"name":"Neptune’s Dream","hex":"#003368"},{"name":"Nero","hex":"#252525"},{"name":"Nervous Neon Pink","hex":"#ff6ec7"},{"name":"Netherworld","hex":"#881111"},{"name":"Nettle","hex":"#bbac7d"},{"name":"Never Forget","hex":"#a67283"},{"name":"Nevermind Nirvana","hex":"#7bc8f6"},{"name":"New Gold","hex":"#ead151"},{"name":"New Heights","hex":"#d0e5f2"},{"name":"New Love","hex":"#c6bbdb"},{"name":"Niagara Falls","hex":"#cbe3ee"},{"name":"Nickel","hex":"#929292"},{"name":"Nicotine Gold","hex":"#eebb33"},{"name":"Night Demons","hex":"#201b20"},{"name":"Night Edition","hex":"#20586d"},{"name":"Night Kite","hex":"#005572"},{"name":"Night Market","hex":"#4c6177"},{"name":"Night Mode","hex":"#234e86"},{"name":"Night Owl","hex":"#5d7b89"},{"name":"Night Rendezvous","hex":"#66787e"},{"name":"Night Rider","hex":"#332e2e"},{"name":"Night Shift","hex":"#2a5c6a"},{"name":"Night Sky","hex":"#292b31"},{"name":"Night Snow","hex":"#aaccff"},{"name":"Night Watch","hex":"#3c4f4e"},{"name":"Nightfall","hex":"#43535e"},{"name":"Nightlife","hex":"#27426b"},{"name":"Nightly Activities","hex":"#2e5090"},{"name":"Nightly Expedition","hex":"#221188"},{"name":"Nightly Walk","hex":"#544563"},{"name":"Nightmare","hex":"#112211"},{"name":"Nightmare Fuel","hex":"#293135"},{"name":"Nile","hex":"#afb982"},{"name":"Nimbus Cloud","hex":"#c8c8cc"},{"name":"Ninja Princess","hex":"#75528b"},{"name":"Ninja Turtle","hex":"#94b1a9"},{"name":"Nipple","hex":"#bb7777"},{"name":"Nippon","hex":"#bc002c"},{"name":"Nirvana","hex":"#a2919b"},{"name":"No Way Rosé","hex":"#fbaa95"},{"name":"№5","hex":"#f8d68b"},{"name":"Noble Black","hex":"#202124"},{"name":"Noble Chocolate","hex":"#6d4433"},{"name":"Noble Cream","hex":"#e1dace"},{"name":"Noble Knight","hex":"#394d78"},{"name":"Noble Plum","hex":"#871f78"},{"name":"Noble Red","hex":"#92181d"},{"name":"Nocturnal","hex":"#767d86"},{"name":"Nocturnal Expedition","hex":"#114c5a"},{"name":"Nocturne","hex":"#344d58"},{"name":"Nocturne Blue","hex":"#37525f"},{"name":"Nocturne Red","hex":"#7a4b56"},{"name":"Noir","hex":"#312b27"},{"name":"Noir Fiction","hex":"#150811"},{"name":"Noir Mystique","hex":"#1f180a"},{"name":"Nomad","hex":"#a19986"},{"name":"Noodles","hex":"#f9e3b4"},{"name":"Nordic Breeze","hex":"#d3dde7"},{"name":"Nordic Forest","hex":"#317362"},{"name":"Nordic Noir","hex":"#003344"},{"name":"North Atlantic","hex":"#5e7b7f"},{"name":"North Star","hex":"#f2dea4"},{"name":"Northern Star","hex":"#ffffea"},{"name":"Northwind","hex":"#cee5e9"},{"name":"Norway","hex":"#a4b88f"},{"name":"Not Yet Caramel","hex":"#b1714c"},{"name":"Not Yo Cheese","hex":"#ffc12c"},{"name":"Nougat","hex":"#ae8a78"},{"name":"Nouveau-Riche","hex":"#ffbb77"},{"name":"Novel Lilac","hex":"#c2a4c2"},{"name":"Noxious","hex":"#89a203"},{"name":"Nuclear Acid","hex":"#ecf474"},{"name":"Nuclear Blast","hex":"#bbff00"},{"name":"Nuclear Mango","hex":"#ee9933"},{"name":"Nuclear Meltdown","hex":"#44ee00"},{"name":"Nuclear Throne","hex":"#00de00"},{"name":"Nude Flamingo","hex":"#e58f7c"},{"name":"Nude Lips","hex":"#b5948d"},{"name":"Nugget","hex":"#bc9229"},{"name":"Nuit Blanche","hex":"#1e488f"},{"name":"Nut Cracker","hex":"#816c5b"},{"name":"Nutmeg","hex":"#7e4a3b"},{"name":"NYC Taxi","hex":"#f7b731"},{"name":"Nylon","hex":"#e9e3cb"},{"name":"Nymph’s Delight","hex":"#7b6c8e"},{"name":"O Tannenbaum","hex":"#005522"},{"name":"Oak Barrel","hex":"#715636"},{"name":"Oak Palace","hex":"#bb6b41"},{"name":"Oakwood","hex":"#bda58b"},{"name":"Oasis","hex":"#0092a3"},{"name":"Oat Milk","hex":"#dedacd"},{"name":"Oatmeal","hex":"#c9c1b1"},{"name":"Oatmeal Cookie","hex":"#eadac6"},{"name":"Oblivion","hex":"#000435"},{"name":"Obscure Ogre","hex":"#771908"},{"name":"Obsidian","hex":"#445055"},{"name":"Obsidian Shard","hex":"#060313"},{"name":"Ocean Blue","hex":"#009dc4"},{"name":"Ocean Blues","hex":"#508693"},{"name":"Ocean Breeze","hex":"#d3e5eb"},{"name":"Ocean Slumber","hex":"#41767b"},{"name":"Ocean’s Embrace","hex":"#306a78"},{"name":"Oceanic Motion","hex":"#1d5c83"},{"name":"Oceanic Noir","hex":"#172b36"},{"name":"Ochre Spice","hex":"#e96d03"},{"name":"Oh Boy!","hex":"#bbdaf8"},{"name":"Oh Em Ghee","hex":"#e3c81c"},{"name":"Oh My Gold","hex":"#eebb55"},{"name":"Oh Pistachio","hex":"#abca99"},{"name":"Oil","hex":"#313330"},{"name":"Old Gold","hex":"#cfb53b"},{"name":"Old Heart","hex":"#e66a77"},{"name":"Old Rose","hex":"#c08081"},{"name":"Old Silver","hex":"#848482"},{"name":"Old Study","hex":"#431705"},{"name":"Old Whiskey","hex":"#ddaa55"},{"name":"Old World","hex":"#91a8cf"},{"name":"Oldies but Goldies","hex":"#d6b63d"},{"name":"Olivary","hex":"#6e592c"},{"name":"Olive","hex":"#808010"},{"name":"Olive Bark","hex":"#5f5537"},{"name":"Olive Conquering White","hex":"#e4e5d8"},{"name":"Olive Leaf","hex":"#4e4b35"},{"name":"Olive Niçoise","hex":"#88432e"},{"name":"Olive Tree","hex":"#aba77c"},{"name":"Olivia","hex":"#996622"},{"name":"Olympian Blue","hex":"#1c4c8c"},{"name":"Olympic Blue","hex":"#4f8fe6"},{"name":"Olympus White","hex":"#d4d8d7"},{"name":"OMGreen","hex":"#8ca891"},{"name":"On Cloud Nine","hex":"#c2e7e8"},{"name":"Once Bitten","hex":"#bd2f10"},{"name":"Once in a Blue Moon","hex":"#0044bb"},{"name":"One Minute to Midnight","hex":"#003388"},{"name":"One Year of Rain","hex":"#29465b"},{"name":"Onion Skin","hex":"#eeeddf"},{"name":"Onsen","hex":"#66eebb"},{"name":"Onyx","hex":"#464544"},{"name":"Opal","hex":"#aee0e4"},{"name":"Opal Fire","hex":"#e49c86"},{"name":"Opal Flame","hex":"#e95c4b"},{"name":"Opal Green","hex":"#157954"},{"name":"Open Book","hex":"#f5f1e5"},{"name":"Open Seas","hex":"#83afbc"},{"name":"Opera","hex":"#816575"},{"name":"Opium","hex":"#987e7e"},{"name":"Opulent Blue","hex":"#0055ee"},{"name":"Opulent Lime","hex":"#88dd11"},{"name":"Opulent Orange","hex":"#f16640"},{"name":"Opulent Purple","hex":"#673362"},{"name":"Opulent Turquoise","hex":"#88ddcc"},{"name":"Orange","hex":"#ffa500"},{"name":"Orange Clown Fish","hex":"#ff550e"},{"name":"Orange Crush","hex":"#ee7733"},{"name":"Orange Delight","hex":"#ffc355"},{"name":"Orange Juice","hex":"#ff7f00"},{"name":"Orange Piñata","hex":"#ff6611"},{"name":"Orange Soda","hex":"#fa5b3d"},{"name":"Orange You Glad","hex":"#ffa601"},{"name":"Orangealicious","hex":"#ee5511"},{"name":"Orangina","hex":"#fec615"},{"name":"Orb of Discord","hex":"#772299"},{"name":"Orb of Harmony","hex":"#eedd44"},{"name":"Orbital","hex":"#6d83bb"},{"name":"Orbital Kingdom","hex":"#220088"},{"name":"Orchid","hex":"#7a81ff"},{"name":"Organic","hex":"#747261"},{"name":"Oriole","hex":"#ff8008"},{"name":"Otterly Brown","hex":"#8c4512"},{"name":"Ottoman Red","hex":"#ee2222"},{"name":"Our Little Secret","hex":"#a84b7a"},{"name":"Out of the Blue","hex":"#1199ee"},{"name":"Outback","hex":"#c9a375"},{"name":"Outer Space","hex":"#314e64"},{"name":"Over the Hills","hex":"#4d6d08"},{"name":"Over the Moon","hex":"#abb8d5"},{"name":"Over the Sky","hex":"#98d5ea"},{"name":"Overdue Blue","hex":"#4400ff"},{"name":"Overgrown","hex":"#88dd00"},{"name":"Overgrown Citadel","hex":"#888844"},{"name":"Overgrown Mausoleum","hex":"#448833"},{"name":"Overgrown Temple","hex":"#116611"},{"name":"Overgrowth","hex":"#88cc33"},{"name":"Oxblood","hex":"#800020"},{"name":"Oyster","hex":"#e3d3bf"},{"name":"Oyster Island","hex":"#efefe5"},{"name":"Pac-Man","hex":"#ffe737"},{"name":"Pacific","hex":"#24646b"},{"name":"Pacific Blue","hex":"#1ca9c9"},{"name":"Pacific Depths","hex":"#004488"},{"name":"Pacific Navy","hex":"#25488a"},{"name":"Pacific Pleasure","hex":"#167d97"},{"name":"Packing Paper","hex":"#ba9b5d"},{"name":"Paella","hex":"#dcc61f"},{"name":"Paid in Full","hex":"#8c8e65"},{"name":"Painter’s Canvas","hex":"#f9f2de"},{"name":"Pale Canary","hex":"#f1efa6"},{"name":"Pale King’s Blue","hex":"#abf5ed"},{"name":"Pale Sky","hex":"#bdf6fe"},{"name":"Pale Whale","hex":"#b6d3df"},{"name":"Palladian","hex":"#eee9df"},{"name":"Palm","hex":"#afaf5e"},{"name":"Palm Leaf","hex":"#36482f"},{"name":"Pan Purple","hex":"#657aef"},{"name":"Pancake","hex":"#f7d788"},{"name":"Pandora’s Box","hex":"#fedbb7"},{"name":"Panela","hex":"#9b5227"},{"name":"Pani Puri","hex":"#f4aa53"},{"name":"Panorama","hex":"#327a88"},{"name":"Pansy","hex":"#f75394"},{"name":"Paolo Veronese Green","hex":"#009b7d"},{"name":"Papaya","hex":"#fe985c"},{"name":"Paper Heart","hex":"#f7dbc7"},{"name":"Paper Hearts","hex":"#cc4466"},{"name":"Paper Plane","hex":"#f1ece0"},{"name":"Paper White","hex":"#f6efdf"},{"name":"Paprika","hex":"#7c2d37"},{"name":"Paprika Kisses","hex":"#c24325"},{"name":"Papyrus","hex":"#999911"},{"name":"Paradise Bird","hex":"#ff8c55"},{"name":"Paradise Island","hex":"#5aa7a0"},{"name":"Paradise Pink","hex":"#e4445e"},{"name":"Paradiso","hex":"#488084"},{"name":"Parchment","hex":"#fefcaf"},{"name":"Parfait","hex":"#c8a6a1"},{"name":"Paris Paving","hex":"#737274"},{"name":"Parisian Patina","hex":"#7d9b89"},{"name":"Parma Ham","hex":"#f89882"},{"name":"Parmesan","hex":"#ffffdd"},{"name":"Parsley Sprig","hex":"#3d7049"},{"name":"Partial Pink","hex":"#ffedf8"},{"name":"Party Pig","hex":"#ee99ff"},{"name":"Party Sponge Cake","hex":"#eedf91"},{"name":"Passion Flower","hex":"#6f5698"},{"name":"Passion for Revenge","hex":"#dd0d06"},{"name":"Passion Plum","hex":"#9c5f77"},{"name":"Passion Potion","hex":"#e398af"},{"name":"Passionate Plum","hex":"#753a58"},{"name":"Pasta","hex":"#f7dfaf"},{"name":"Pasta Luego","hex":"#fae17f"},{"name":"Pasta Rasta","hex":"#eec474"},{"name":"Pastel Blue","hex":"#a2bffe"},{"name":"Pastel Brown","hex":"#836953"},{"name":"Pastel Day","hex":"#dfd8e1"},{"name":"Pastel de Nata","hex":"#f2c975"},{"name":"Pastel Green","hex":"#77dd77"},{"name":"Pastel Grey","hex":"#cfcfc4"},{"name":"Pastel Lavender","hex":"#d8a1c4"},{"name":"Pastel Lilac","hex":"#bdb0d0"},{"name":"Pastel Magenta","hex":"#f49ac2"},{"name":"Pastel Mint","hex":"#cef0cc"},{"name":"Pastel Orange","hex":"#ff964f"},{"name":"Pastel Pea","hex":"#bee7a5"},{"name":"Pastel Pink","hex":"#dea5a4"},{"name":"Pastel Purple","hex":"#b39eb5"},{"name":"Pastel Red","hex":"#ff6961"},{"name":"Pastel Smirk","hex":"#deece1"},{"name":"Pastel Turquoise","hex":"#99c5c4"},{"name":"Pastel Violet","hex":"#cb99c9"},{"name":"Pastel Yellow","hex":"#fdfd96"},{"name":"Pastrami","hex":"#e87175"},{"name":"Pastry","hex":"#f8deb8"},{"name":"Patina","hex":"#639283"},{"name":"Patisserie","hex":"#eddbc8"},{"name":"Pāua","hex":"#2a2551"},{"name":"Paved With Gold","hex":"#e8d284"},{"name":"Paying Mantis","hex":"#70916c"},{"name":"PCB Green","hex":"#002d04"},{"name":"Pea","hex":"#a4bf20"},{"name":"Peace & Quiet","hex":"#e0dac8"},{"name":"Peach","hex":"#ffb07c"},{"name":"Peach and Quiet","hex":"#ffccb6"},{"name":"Peach Beach","hex":"#fdcfa1"},{"name":"Peach Bud","hex":"#fdb2ab"},{"name":"Peach Cream","hex":"#fff0db"},{"name":"Peach Crème Brûlée","hex":"#ffe19d"},{"name":"Peach Dunes","hex":"#b3695f"},{"name":"Peach Fizz","hex":"#ffa883"},{"name":"Peach Fury","hex":"#f88435"},{"name":"Peach Fuzz","hex":"#ffc7b9"},{"name":"Peach Puff","hex":"#ffdab9"},{"name":"Peach Punch","hex":"#f59997"},{"name":"Peach Scone","hex":"#ffbcbc"},{"name":"Peach Taffy","hex":"#f3b68e"},{"name":"Peach Velour","hex":"#f7b28b"},{"name":"Peach’s Daydream","hex":"#fd9b88"},{"name":"Peaches of Immortality","hex":"#d98586"},{"name":"Peachy Feeling","hex":"#ed8666"},{"name":"Peachy Milk","hex":"#f3e0d8"},{"name":"Peachy Pinky","hex":"#ff775e"},{"name":"Peachy-Kini","hex":"#f1bf92"},{"name":"Peacock Pride","hex":"#006663"},{"name":"Peanut","hex":"#7a4434"},{"name":"Peanut Butter","hex":"#be893f"},{"name":"Peanut Butter Biscuit","hex":"#f7b565"},{"name":"Peanut Butter Chicken","hex":"#ffb75f"},{"name":"Peanut Butter Jelly","hex":"#ce4a2d"},{"name":"Pear","hex":"#d1e231"},{"name":"Pearl","hex":"#eae0c8"},{"name":"Pearl Brite","hex":"#e6e6e3"},{"name":"Pearl Powder","hex":"#faffed"},{"name":"Pearl White","hex":"#f3f2ed"},{"name":"Pearly","hex":"#f4e3df"},{"name":"Pearly Pink","hex":"#ee99cc"},{"name":"Peas Please","hex":"#8c7f3c"},{"name":"Peat Brown","hex":"#5a3d29"},{"name":"Pebble","hex":"#9d9880"},{"name":"Pebble Beach","hex":"#7f8285"},{"name":"Pecan","hex":"#a67253"},{"name":"Pedigrey","hex":"#8f8e8c"},{"name":"Peek a Blue","hex":"#c5e1e1"},{"name":"Peekaboo","hex":"#e6dee6"},{"name":"Pegasus","hex":"#e8e9e4"},{"name":"Pelati","hex":"#ff3333"},{"name":"Pelican","hex":"#c1bcac"},{"name":"Pepper Green","hex":"#007d58"},{"name":"Peppermint","hex":"#d7e7d0"},{"name":"Peppermint Swirl","hex":"#d35d7d"},{"name":"Pepperoni","hex":"#aa4400"},{"name":"Peppy Peacock","hex":"#55ccbb"},{"name":"Peppy Pineapple","hex":"#ffff44"},{"name":"Perfect Dark","hex":"#313390"},{"name":"Perfect Pink","hex":"#e5b3b2"},{"name":"Perfume Cloud","hex":"#e2c9ce"},{"name":"Perfume Haze","hex":"#f3e9f7"},{"name":"Pergament","hex":"#bfa58a"},{"name":"Peri Peri","hex":"#c62d2c"},{"name":"Periwinkle","hex":"#8e82fe"},{"name":"Perkin Mauve","hex":"#733c8e"},{"name":"Permafrost","hex":"#98eff9"},{"name":"Perrywinkle","hex":"#8f8ce7"},{"name":"Persian Luxury Purple","hex":"#990077"},{"name":"Persian Melon","hex":"#ffdcbf"},{"name":"Persian Mosaic","hex":"#206874"},{"name":"Persian Red","hex":"#cc3333"},{"name":"Persicus","hex":"#ffb49b"},{"name":"Persimmon","hex":"#e59b34"},{"name":"Peru","hex":"#cd853f"},{"name":"Pestering Pesto","hex":"#119922"},{"name":"Pesto","hex":"#c1b23e"},{"name":"Pesto Alla Genovese","hex":"#558800"},{"name":"Pesto di Pistacchio","hex":"#a7c437"},{"name":"Pesto di Rucola","hex":"#748a35"},{"name":"Pesto Rosso","hex":"#bb3333"},{"name":"Petal of a Dying Rose","hex":"#9f0630"},{"name":"Petal Pink","hex":"#f4e5e0"},{"name":"Petite Pink","hex":"#eacacb"},{"name":"Petrichor","hex":"#66cccc"},{"name":"Petrified","hex":"#8b8680"},{"name":"Petrified Purple","hex":"#9c87c1"},{"name":"Petrol Slumber","hex":"#243640"},{"name":"Phantom","hex":"#6e797b"},{"name":"Phantom Ship","hex":"#2f3434"},{"name":"Pharmaceutical Green","hex":"#087e34"},{"name":"Phaser Beam","hex":"#ff4d00"},{"name":"Pheasant","hex":"#c17c54"},{"name":"Philodendron","hex":"#116356"},{"name":"Phoenix Red","hex":"#e2725b"},{"name":"Phosphor Green","hex":"#00aa00"},{"name":"Pi","hex":"#314159"},{"name":"Piano Black","hex":"#17171a"},{"name":"Picante","hex":"#a04933"},{"name":"Piccadilly Purple","hex":"#51588e"},{"name":"Pickled","hex":"#b3a74b"},{"name":"Pickled Pineapple","hex":"#eeff33"},{"name":"Pickled Radish","hex":"#ee1144"},{"name":"Pie Crust","hex":"#f1d99f"},{"name":"Piercing Pink","hex":"#dd00ee"},{"name":"Piercing Red","hex":"#dd1122"},{"name":"Pig Pink","hex":"#fdd7e4"},{"name":"Pigeon","hex":"#a9afaa"},{"name":"Piggy","hex":"#ef98aa"},{"name":"Piggy Bank","hex":"#ffccbb"},{"name":"Piglet","hex":"#ffc0c6"},{"name":"Pika Yellow","hex":"#eee92d"},{"name":"Pilsener","hex":"#f8f753"},{"name":"Piment Piquant","hex":"#cc2200"},{"name":"Pimento","hex":"#dc5d47"},{"name":"Pimm’s","hex":"#c3585c"},{"name":"Pina Colada","hex":"#f4deb3"},{"name":"Pinball","hex":"#d3d3d3"},{"name":"Pinch Me","hex":"#c88ca4"},{"name":"Pine","hex":"#2b5d34"},{"name":"Pine Needle","hex":"#334d41"},{"name":"Pine Scented Lagoon","hex":"#066f6c"},{"name":"Pineapple","hex":"#563c0d"},{"name":"Pineapple Gold","hex":"#ffc72c"},{"name":"Pineapple Perfume","hex":"#eeee88"},{"name":"Pineapple Sorbet","hex":"#f7f4da"},{"name":"Pineapple Whip","hex":"#ead988"},{"name":"Pink","hex":"#ffc0cb"},{"name":"Pink Bliss","hex":"#e3abce"},{"name":"Pink Blush","hex":"#f4acb6"},{"name":"Pink Champagne","hex":"#e8dfed"},{"name":"Pink Elephants","hex":"#ff99ee"},{"name":"Pink Fit","hex":"#f5a8b2"},{"name":"Pink Flamingo","hex":"#ff66ff"},{"name":"Pink Floyd","hex":"#eb9a9d"},{"name":"Pink Glitter","hex":"#fddfda"},{"name":"Pink Horror","hex":"#90305d"},{"name":"Pink Hysteria","hex":"#fe01b1"},{"name":"Pink Ink","hex":"#ff1476"},{"name":"Pink Lemonade","hex":"#ffeaeb"},{"name":"Pink Macaroon","hex":"#eaacc6"},{"name":"Pink Marshmallow","hex":"#f4b6d1"},{"name":"Pink Mist","hex":"#e6bccd"},{"name":"Pink Orchid","hex":"#da70d6"},{"name":"Pink Palazzo","hex":"#df9f8f"},{"name":"Pink Panther","hex":"#ff0090"},{"name":"Pink Party","hex":"#ff55ee"},{"name":"Pink Pepper","hex":"#ef586c"},{"name":"Pink Pleasure","hex":"#ffdfe5"},{"name":"Pink Poison","hex":"#ff007e"},{"name":"Pink Porky","hex":"#ee9091"},{"name":"Pink Prestige","hex":"#ee99aa"},{"name":"Pink Pride","hex":"#ef1de7"},{"name":"Pink Punk","hex":"#d983bd"},{"name":"Pink Supremecy","hex":"#ffd9e6"},{"name":"Pink Swirl","hex":"#fceae6"},{"name":"Pinkalicious","hex":"#ff99ff"},{"name":"Pinkling","hex":"#eb84f5"},{"name":"Pinkman","hex":"#dd11ff"},{"name":"Pinky","hex":"#fc86aa"},{"name":"Pinky Pickle","hex":"#b96d8e"},{"name":"Pinky Swear","hex":"#eeaaee"},{"name":"Pinot Noir","hex":"#605258"},{"name":"Pirate Gold","hex":"#ba782a"},{"name":"Pirate Treasure","hex":"#ddca69"},{"name":"Pirate’s Hook","hex":"#b08f42"},{"name":"Pisco Sour","hex":"#beeb71"},{"name":"Pistachio","hex":"#93c572"},{"name":"Pistachio Shell","hex":"#cfc5af"},{"name":"Pita","hex":"#f5e7d2"},{"name":"Pitch Black","hex":"#483c41"},{"name":"Pitch-Black Forests","hex":"#003322"},{"name":"Pixel Bleeding","hex":"#bb0022"},{"name":"Pizza","hex":"#bf8d3c"},{"name":"Pizza Flame","hex":"#cd2217"},{"name":"Placebo","hex":"#e7e7e7"},{"name":"Placebo Yellow","hex":"#fcfbeb"},{"name":"Planet Earth","hex":"#daddc3"},{"name":"Planet of the Apes","hex":"#883333"},{"name":"Plantation","hex":"#3e594c"},{"name":"Plaster","hex":"#eaeaea"},{"name":"Plastic Carrot","hex":"#f65d20"},{"name":"Plastic Cheese","hex":"#ffcc04"},{"name":"Plastic Clouds","hex":"#f5f0f1"},{"name":"Plastic Lips","hex":"#aa2266"},{"name":"Plastic Veggie","hex":"#22ff22"},{"name":"Platinum","hex":"#e5e4e2"},{"name":"Platinum Blonde","hex":"#f0e8d7"},{"name":"Pleasant Pomegranate","hex":"#cc3300"},{"name":"Pleasant Purple","hex":"#8833aa"},{"name":"Pleasing Pink","hex":"#f5cdd2"},{"name":"Pleasure","hex":"#80385c"},{"name":"Plein Air","hex":"#b9c4d2"},{"name":"Plum","hex":"#66386a"},{"name":"Plum Cheese","hex":"#670728"},{"name":"Plum Highness","hex":"#885577"},{"name":"Plum Kingdom","hex":"#aa3377"},{"name":"Plum Perfect","hex":"#aa1155"},{"name":"Plumbeous","hex":"#5c7287"},{"name":"Plummy","hex":"#675a75"},{"name":"Plunge","hex":"#035568"},{"name":"Plunge Pool","hex":"#00ffcc"},{"name":"Plushy Pink","hex":"#eab7a8"},{"name":"Plutonium","hex":"#35fa00"},{"name":"Poached Egg","hex":"#f5d893"},{"name":"Poblano","hex":"#077f1b"},{"name":"Poison Ivy","hex":"#00ad43"},{"name":"Poison Purple","hex":"#7f01fe"},{"name":"Poison Purple Paradise","hex":"#b300ff"},{"name":"Poisonous","hex":"#55ff11"},{"name":"Poisonous Dart","hex":"#77ff66"},{"name":"Poisonous Pesto","hex":"#cae80a"},{"name":"Poisonous Pistachio","hex":"#88ee11"},{"name":"Poisonous Potion","hex":"#99dd33"},{"name":"Polar","hex":"#e5f2e7"},{"name":"Polar Bear","hex":"#eae9e0"},{"name":"Polar Bear In A Blizzard","hex":"#fcffff"},{"name":"Polar Expedition","hex":"#c9e7e3"},{"name":"Polar Glow","hex":"#5097fc"},{"name":"Polar Opposite","hex":"#c2d6ec"},{"name":"Polar Wind","hex":"#b4dfed"},{"name":"Polenta","hex":"#efc47f"},{"name":"Polished Apple","hex":"#862a2e"},{"name":"Polished Bronze","hex":"#cd7f32"},{"name":"Polished Copper","hex":"#b66325"},{"name":"Polished Gold","hex":"#eeaa55"},{"name":"Polished Limestone","hex":"#dcd5c8"},{"name":"Polished Pearl","hex":"#f8edd3"},{"name":"Polished Silver","hex":"#c5d1da"},{"name":"Pollen","hex":"#eeeeaa"},{"name":"Pollination","hex":"#eedd66"},{"name":"Polly","hex":"#ffcaa4"},{"name":"Pomegranate","hex":"#c35550"},{"name":"Pomelo Red","hex":"#e38fac"},{"name":"Pomodoro","hex":"#c30232"},{"name":"Pompeian Red","hex":"#a82a38"},{"name":"Pompelmo","hex":"#ff6666"},{"name":"Pony","hex":"#c6aa81"},{"name":"Poodle Skirt","hex":"#ffaebb"},{"name":"Pool Table","hex":"#039578"},{"name":"Pool Water","hex":"#2188ff"},{"name":"Poolside","hex":"#bee0e2"},{"name":"Pop That Gum","hex":"#f771b3"},{"name":"Popcorn","hex":"#f7d07a"},{"name":"Poppy","hex":"#c23c47"},{"name":"Poppy Flower","hex":"#ec5800"},{"name":"Poppy Pompadour","hex":"#6b3fa0"},{"name":"Poppy Red","hex":"#dd3845"},{"name":"Porcelain","hex":"#dddcdb"},{"name":"Porcelain Mint","hex":"#dbe7e1"},{"name":"Porcelain Skin","hex":"#ffe7eb"},{"name":"Porcini","hex":"#d9ae86"},{"name":"Pork Belly","hex":"#f8e0e7"},{"name":"Poseidon","hex":"#143c5d"},{"name":"Poseidon Jr.","hex":"#66eeee"},{"name":"Possessed Purple","hex":"#881166"},{"name":"Possessed Red","hex":"#c2264d"},{"name":"Pot of Gold","hex":"#f6cd23"},{"name":"Potato Chip","hex":"#fddc57"},{"name":"Powder Blush","hex":"#d8948b"},{"name":"Powder Puff","hex":"#ffeff3"},{"name":"Powder Room","hex":"#eee0dd"},{"name":"Powdered","hex":"#f9f2e7"},{"name":"Prairie","hex":"#0b9d6a"},{"name":"Prairie Land","hex":"#e2cc9c"},{"name":"Prairie Winds","hex":"#e8e6d9"},{"name":"Praise the Sun","hex":"#f3f4d9"},{"name":"Precious","hex":"#f1dab2"},{"name":"Precious Copper","hex":"#885522"},{"name":"Precious Persimmon","hex":"#ff7744"},{"name":"Precious Pumpkin","hex":"#e16233"},{"name":"Prehistoric Pink","hex":"#c3738d"},{"name":"Preppy Rose","hex":"#d1668f"},{"name":"Pressing my Luck","hex":"#00cc11"},{"name":"Pretty in Pink","hex":"#fabfe4"},{"name":"Pretty in Prune","hex":"#6b295a"},{"name":"Pretty Pastry","hex":"#dfcdb2"},{"name":"Pretty Twilight Night","hex":"#254770"},{"name":"Prickly Pink","hex":"#f42c93"},{"name":"Prickly Purple","hex":"#a264ba"},{"name":"Primal Green","hex":"#11875d"},{"name":"Primal Rage","hex":"#f4301c"},{"name":"Primavera","hex":"#6fa77a"},{"name":"Primrose","hex":"#d6859f"},{"name":"Prince Charming","hex":"#cc2277"},{"name":"Princess Peach","hex":"#f878f8"},{"name":"Prism Pink","hex":"#f0a1bf"},{"name":"Prismarine","hex":"#117777"},{"name":"Pristine Oceanic","hex":"#00ccbb"},{"name":"Pristine Seas","hex":"#007799"},{"name":"Professor Plum","hex":"#393540"},{"name":"Prom Corsage","hex":"#e7c3e7"},{"name":"Prom Queen","hex":"#9b1dcd"},{"name":"Promenade","hex":"#f8f6df"},{"name":"Prometheus Orange","hex":"#f4581e"},{"name":"Promiscuous Pink","hex":"#bb11ee"},{"name":"Prophet Violet","hex":"#6f58a6"},{"name":"Prosciutto","hex":"#e0b4a4"},{"name":"Prosecco","hex":"#fad6a5"},{"name":"Protoss","hex":"#e0c778"},{"name":"Prune","hex":"#701c11"},{"name":"Prunella","hex":"#864788"},{"name":"Psychedelic Purple","hex":"#dd00ff"},{"name":"Pucker Up","hex":"#ff1177"},{"name":"Puff of Pink","hex":"#ffcbee"},{"name":"Puffy Cloud","hex":"#d2def2"},{"name":"Puffy Pillow","hex":"#e8e5de"},{"name":"Pulp","hex":"#e18289"},{"name":"Puma","hex":"#96711c"},{"name":"Pumpernickel","hex":"#6c462d"},{"name":"Pumping Spice","hex":"#f7504a"},{"name":"Pumpkin","hex":"#ff7518"},{"name":"Pumpkin Cat","hex":"#eb7b07"},{"name":"Pumpkin Pie","hex":"#e99e56"},{"name":"Punch","hex":"#dc4333"},{"name":"Punk Rock Purple","hex":"#bb11aa"},{"name":"Pure Blue","hex":"#0203e2"},{"name":"Pure Passion","hex":"#b40039"},{"name":"Pure Pleasure","hex":"#f51360"},{"name":"Pure Sunshine","hex":"#ffee15"},{"name":"Purple","hex":"#800080"},{"name":"Purple Climax","hex":"#8800ff"},{"name":"Purple Emperor","hex":"#6633bb"},{"name":"Purple Excellency","hex":"#943589"},{"name":"Purple Haze","hex":"#807396"},{"name":"Purple Heart","hex":"#69359c"},{"name":"Purple Illusion","hex":"#b8b8f8"},{"name":"Purple Ink","hex":"#9a2ca0"},{"name":"Purple Noir","hex":"#322c56"},{"name":"Purple Passion","hex":"#784674"},{"name":"Purple Patch","hex":"#5c2e88"},{"name":"Purple Pirate","hex":"#bb00aa"},{"name":"Purple Pizzazz","hex":"#fe4eda"},{"name":"Purple Pleasures","hex":"#81459e"},{"name":"Purple Poodle","hex":"#dab4cc"},{"name":"Purple Pristine","hex":"#7733aa"},{"name":"Purple Prose","hex":"#543254"},{"name":"Purple Protégé","hex":"#593569"},{"name":"Purple Rain","hex":"#7442c8"},{"name":"Purple Sultan","hex":"#853682"},{"name":"Purple Velour","hex":"#581a57"},{"name":"Purple Void","hex":"#442244"},{"name":"Purple Zergling","hex":"#a15589"},{"name":"Purple’s Baby Sister","hex":"#eec3ee"},{"name":"Put on Ice","hex":"#c8ddea"},{"name":"Pyramid","hex":"#9f7d4f"},{"name":"Quack Quack","hex":"#ffe989"},{"name":"Queen Blue","hex":"#436b95"},{"name":"Queen of Gardens","hex":"#bbdd55"},{"name":"Queen of Hearts","hex":"#98333a"},{"name":"Queen of Trees","hex":"#1c401f"},{"name":"Queer Blue","hex":"#88ace0"},{"name":"Quercitron","hex":"#e5b03d"},{"name":"Quiche Lorraine","hex":"#fed56f"},{"name":"Quick-Freeze","hex":"#bddbe1"},{"name":"Quicksand","hex":"#ac9884"},{"name":"Quicksilver","hex":"#a6a6a6"},{"name":"Quiet Abyss","hex":"#160435"},{"name":"Quiet Harbour","hex":"#5a789a"},{"name":"Quill Grey","hex":"#cbc9c0"},{"name":"Quince","hex":"#d4cb60"},{"name":"Race the Sun","hex":"#eef3d0"},{"name":"Racing Red","hex":"#c21727"},{"name":"Radiant Foliage","hex":"#659c35"},{"name":"Radiant Hulk","hex":"#10f144"},{"name":"Radiant Raspberry","hex":"#e31b5d"},{"name":"Radiant Sunrise","hex":"#eebe1b"},{"name":"Radical Red","hex":"#ff355e"},{"name":"Radioactive","hex":"#89fe05"},{"name":"Radish","hex":"#a42e41"},{"name":"Radishical","hex":"#ec4872"},{"name":"Rage","hex":"#ff1133"},{"name":"Raging Raisin","hex":"#aa3333"},{"name":"Raging Thunderstorm","hex":"#004f63"},{"name":"Rainforest","hex":"#009a70"},{"name":"Rainy Mood","hex":"#4499aa"},{"name":"Rajah","hex":"#fbab60"},{"name":"Rampant Rhubarb","hex":"#603231"},{"name":"Rampart","hex":"#bcb7b1"},{"name":"Ranch House","hex":"#7b645a"},{"name":"Rapeseed","hex":"#c19a13"},{"name":"Rapture’s Light","hex":"#f6f3e7"},{"name":"Rapunzel Silver","hex":"#d2d2d4"},{"name":"Rare Blue","hex":"#0044ff"},{"name":"Rare Red","hex":"#dd1133"},{"name":"Raspberry","hex":"#b00149"},{"name":"Raspberry Mousse","hex":"#e06f8b"},{"name":"Raspberry Romantic","hex":"#972b51"},{"name":"Raven","hex":"#0b0b0b"},{"name":"Raven’s Coat","hex":"#030205"},{"name":"Ravenclaw","hex":"#0a0555"},{"name":"Ravioli al Limone","hex":"#fade79"},{"name":"Razzle Dazzle","hex":"#ba417b"},{"name":"Re-Entry Red","hex":"#cd0317"},{"name":"Reading Tea Leaves","hex":"#7d5d5e"},{"name":"Realm of the Underworld","hex":"#114411"},{"name":"Rebellion Red","hex":"#cc0404"},{"name":"Red","hex":"#ff0000"},{"name":"Red Alert","hex":"#ff0f0f"},{"name":"Red Arremer","hex":"#e44e4d"},{"name":"Red Baron","hex":"#bb0011"},{"name":"Red Carpet","hex":"#bc2026"},{"name":"Red Cent","hex":"#ad654c"},{"name":"Red Devil","hex":"#860111"},{"name":"Red Elegance","hex":"#85464b"},{"name":"Red Flag","hex":"#ff2244"},{"name":"Red Herring","hex":"#dd1144"},{"name":"Red Hot Chili Pepper","hex":"#db1d27"},{"name":"Red Inferno","hex":"#bb1e1e"},{"name":"Red Mana","hex":"#f95554"},{"name":"Red Menace","hex":"#aa2121"},{"name":"Red Mist","hex":"#c92b1e"},{"name":"Red My Mind","hex":"#994341"},{"name":"Red Octopus","hex":"#773243"},{"name":"Red Panda","hex":"#c34b1b"},{"name":"Red Pegasus","hex":"#dd0000"},{"name":"Red Radish","hex":"#ee3344"},{"name":"Red Reign","hex":"#800707"},{"name":"Red Republic","hex":"#d70200"},{"name":"Red Ribbon","hex":"#ed0a3f"},{"name":"Red Riding Hood","hex":"#fe2713"},{"name":"Red Robin","hex":"#7d4138"},{"name":"Red Stop","hex":"#ff2222"},{"name":"Red Tape","hex":"#cc1133"},{"name":"Red Wrath of Zeus","hex":"#e0180c"},{"name":"Red-Handed","hex":"#dd2233"},{"name":"Redolenc","hex":"#ea8a7a"},{"name":"Redstone","hex":"#e46b71"},{"name":"Redsurrection","hex":"#d90b0b"},{"name":"RedЯum","hex":"#ff2200"},{"name":"Reign of Tomatoes","hex":"#f7250b"},{"name":"Rendez-Blue","hex":"#abbed0"},{"name":"Reptile Revenge","hex":"#5e582b"},{"name":"Resplendent Growth","hex":"#3d8b37"},{"name":"Restful Rain","hex":"#f1f2dd"},{"name":"Retro Nectarine","hex":"#ef7d16"},{"name":"Retro Pink Pop","hex":"#ff0073"},{"name":"Retro Vibe","hex":"#cb9711"},{"name":"Rich Black","hex":"#004040"},{"name":"Rich Gold","hex":"#aa8833"},{"name":"Ridgeback","hex":"#ef985c"},{"name":"Ripasso","hex":"#94312f"},{"name":"Ripe Malinka","hex":"#f5576c"},{"name":"Rising Star","hex":"#f7f6d5"},{"name":"Riverbed","hex":"#86bebe"},{"name":"Roasted","hex":"#785246"},{"name":"Roasted Pepper","hex":"#890a01"},{"name":"Roastery","hex":"#692302"},{"name":"Robotic Gods","hex":"#94a2b1"},{"name":"Rock Lobster","hex":"#f00b52"},{"name":"Rock’n’Rose","hex":"#fc8aaa"},{"name":"Roland-Garros","hex":"#bb5522"},{"name":"Romanic Scene","hex":"#3b0346"},{"name":"Romantic Embers","hex":"#b23e4f"},{"name":"Romantic Thriller","hex":"#a2101b"},{"name":"Romantic Vampire","hex":"#991166"},{"name":"Romesco","hex":"#f48101"},{"name":"Rooftop Garden","hex":"#9ead92"},{"name":"Root Beer","hex":"#81544a"},{"name":"Rosé","hex":"#f7746b"},{"name":"Rose Ashes","hex":"#b5acab"},{"name":"Rose Elegance","hex":"#e9a1b8"},{"name":"Rose Haze","hex":"#ecc5c0"},{"name":"Rose Laffy Taffy","hex":"#a6465b"},{"name":"Roseate Spoonbill","hex":"#e0adc4"},{"name":"Rosecco","hex":"#eebbdd"},{"name":"Rosemarried","hex":"#819b4f"},{"name":"Rosemary","hex":"#405e5c"},{"name":"Roses are Red","hex":"#aa3646"},{"name":"Roses in the Snow","hex":"#e7aecd"},{"name":"Rosetti","hex":"#cf929a"},{"name":"Rosewood","hex":"#65000b"},{"name":"Rosewood Dreams","hex":"#ebbeb5"},{"name":"Rosy Brown","hex":"#bc8f8f"},{"name":"Rouge","hex":"#ab1239"},{"name":"Rough Asphalt","hex":"#bdbebf"},{"name":"Royal","hex":"#0c1793"},{"name":"Royal Blush","hex":"#f26e54"},{"name":"Royal Decree","hex":"#403547"},{"name":"Royal Flush","hex":"#a0365f"},{"name":"Royal Goblet","hex":"#d4ca8e"},{"name":"Royal Lavender","hex":"#7851a9"},{"name":"Royal Milk Tea","hex":"#f7cfb4"},{"name":"Royal Neptune","hex":"#1c3b42"},{"name":"Royal Night","hex":"#2b3191"},{"name":"Royal Plum","hex":"#654161"},{"name":"Royal Purpleness","hex":"#881177"},{"name":"Royal Robe","hex":"#614a7b"},{"name":"Royal Star","hex":"#fede4f"},{"name":"Royalty","hex":"#5930a9"},{"name":"Rrosy-Fingered Dawn","hex":"#c11c84"},{"name":"Rubber Ducky","hex":"#facf58"},{"name":"Ruby","hex":"#ca0147"},{"name":"Ruby Fire","hex":"#f20769"},{"name":"Ruby Queen","hex":"#b0063d"},{"name":"Rubylicious","hex":"#db1459"},{"name":"Ruined Smores","hex":"#0f1012"},{"name":"Ruins of Civilization","hex":"#cadece"},{"name":"Ruins of Metal","hex":"#9b8b84"},{"name":"Rum","hex":"#716675"},{"name":"Rum Swizzle","hex":"#f1edd4"},{"name":"Run Lola Run","hex":"#da2811"},{"name":"Rural Green","hex":"#8d844d"},{"name":"Rural Red","hex":"#bb1144"},{"name":"Rust","hex":"#a83c09"},{"name":"Rustic Rouge","hex":"#9d2626"},{"name":"Rustling Leaves","hex":"#ad6961"},{"name":"Rusty Heart","hex":"#a04039"},{"name":"Rusty Red","hex":"#af2f0d"},{"name":"Ruthless Empress","hex":"#573894"},{"name":"Sablé","hex":"#f6d8be"},{"name":"Sable Cloaked","hex":"#c4a7a1"},{"name":"Sacred Scarlet","hex":"#950c1b"},{"name":"Sacrifice Altar","hex":"#850101"},{"name":"Sacro Bosco","hex":"#229911"},{"name":"Saddle Up","hex":"#ab927a"},{"name":"Safety Orange","hex":"#ff6600"},{"name":"Safflower","hex":"#fdae44"},{"name":"Saffron","hex":"#f4c430"},{"name":"Saffron Desires","hex":"#c24359"},{"name":"Saffronaut","hex":"#932a25"},{"name":"Sage","hex":"#87ae73"},{"name":"Sage Sensation","hex":"#b2e191"},{"name":"Sail into the Horizon","hex":"#a3bbdc"},{"name":"Sail On","hex":"#4575ad"},{"name":"Sail to the Sea","hex":"#99c3f0"},{"name":"Sailing","hex":"#869cbb"},{"name":"Sailor","hex":"#445780"},{"name":"Sailor Boy","hex":"#aebbd0"},{"name":"Sailor Moon","hex":"#ffee00"},{"name":"Sakura","hex":"#dfb1b6"},{"name":"Sakura Night","hex":"#7b6c7c"},{"name":"Salametti","hex":"#e25e31"},{"name":"Salami","hex":"#820000"},{"name":"Salmon","hex":"#ff796c"},{"name":"Salmon Flush","hex":"#f1c9cc"},{"name":"Salmon Glow","hex":"#ebb9af"},{"name":"Salmon Nigiri","hex":"#f9906f"},{"name":"Salmon Poké Bowl","hex":"#ee7777"},{"name":"Salmon Sashimi","hex":"#ff7e79"},{"name":"Salsa Picante","hex":"#ab250b"},{"name":"Salsa Verde","hex":"#cec754"},{"name":"Salt","hex":"#efede6"},{"name":"Salt Caramel","hex":"#d3934d"},{"name":"Salt Mountain","hex":"#d7fefe"},{"name":"Salt n Pepa","hex":"#dcd9db"},{"name":"Salted","hex":"#ebeadc"},{"name":"Salted Capers","hex":"#a69151"},{"name":"Salted Caramel Popcorn","hex":"#fdb251"},{"name":"Saltwater Denim","hex":"#145c78"},{"name":"Salty Ice","hex":"#cce2f3"},{"name":"Salvia","hex":"#a8b59e"},{"name":"Samba","hex":"#aa262b"},{"name":"Sand","hex":"#e2ca76"},{"name":"Sand Dune","hex":"#e3d2c0"},{"name":"Sand Ripples","hex":"#c1b7b0"},{"name":"Sand Storm","hex":"#f9f1d7"},{"name":"Sandstorm","hex":"#ecd540"},{"name":"Sandworm","hex":"#fce883"},{"name":"Sanguinary","hex":"#f01a4d"},{"name":"Sanguine","hex":"#6c110e"},{"name":"Sapling","hex":"#a3c05a"},{"name":"Sappanwood","hex":"#9e3d3f"},{"name":"Sapphire Glitter","hex":"#0033cc"},{"name":"Sapphire Siren","hex":"#662288"},{"name":"Sapphire Splendour","hex":"#2425b9"},{"name":"Sassy Lime","hex":"#dfe289"},{"name":"Sassy Salmon","hex":"#ee7c54"},{"name":"Satin Chocolate","hex":"#773344"},{"name":"Satin Cream White","hex":"#fdf3d5"},{"name":"Satin Deep Black","hex":"#1c1e21"},{"name":"Satin Lime","hex":"#33ee00"},{"name":"Saturn","hex":"#fae5bf"},{"name":"Sauerkraut","hex":"#eee0b9"},{"name":"Sauna Steam","hex":"#edebe1"},{"name":"Savannah Grass","hex":"#babc72"},{"name":"Savory Salmon","hex":"#d19c97"},{"name":"Savoy Blue","hex":"#4b61d1"},{"name":"Scampi","hex":"#6f63a0"},{"name":"Scandinavian Liquorice","hex":"#1a1110"},{"name":"Scarlet","hex":"#ff2400"},{"name":"Scarlet Blaze","hex":"#b21f1f"},{"name":"Scarlet Glow","hex":"#cb0103"},{"name":"Scarlet Splendour","hex":"#cc0c1b"},{"name":"Scented Spring","hex":"#eed5ee"},{"name":"Schiaparelli Pink","hex":"#e84998"},{"name":"School Bus","hex":"#ffd800"},{"name":"Scoville Highness","hex":"#900405"},{"name":"Screamin’ Green","hex":"#66ff66"},{"name":"Sea","hex":"#3c9992"},{"name":"Sea Creature","hex":"#00586d"},{"name":"Sea Foam","hex":"#87e0cf"},{"name":"Sea Foam Mist","hex":"#cbdce2"},{"name":"Sea Glass Teal","hex":"#a0e5d9"},{"name":"Sea Goddess","hex":"#216987"},{"name":"Sea Lion","hex":"#7f8793"},{"name":"Sea of Galilee","hex":"#466590"},{"name":"Sea of Stars","hex":"#0b334d"},{"name":"Sea Paint","hex":"#00507a"},{"name":"Sea Salt Rivers","hex":"#5087bd"},{"name":"Sea Serpent","hex":"#4bc7cf"},{"name":"Sea Serpent’s Tears","hex":"#5511cc"},{"name":"Seaborn","hex":"#85c2b2"},{"name":"Seafarer","hex":"#204d68"},{"name":"Seafoam Slate","hex":"#a6bcbe"},{"name":"Seafoam Splashes","hex":"#b0efce"},{"name":"Seafoam Whisper","hex":"#a1bdbf"},{"name":"Seashell","hex":"#fff5ee"},{"name":"Seaside","hex":"#66a4b0"},{"name":"Seaweed","hex":"#18d17b"},{"name":"Secret Affair","hex":"#c41661"},{"name":"Secret Blush","hex":"#e1d2d5"},{"name":"Secret Garden","hex":"#11aa66"},{"name":"Secret of Mana","hex":"#4166f5"},{"name":"Secret Passage","hex":"#372a05"},{"name":"Secret Path","hex":"#737054"},{"name":"Secret Scarlet","hex":"#7a0e0e"},{"name":"Seedling","hex":"#c0cba1"},{"name":"Self-Love","hex":"#d22b6d"},{"name":"Semolina","hex":"#c7ab8b"},{"name":"Serene","hex":"#dce3e4"},{"name":"Serene Sea","hex":"#78a7c3"},{"name":"Sereni Teal","hex":"#76baa8"},{"name":"Serenity’s Reign","hex":"#507bce"},{"name":"Serial Kisses","hex":"#dd3744"},{"name":"Serious Cloud","hex":"#7d848b"},{"name":"Serpent Scepter","hex":"#bbcc00"},{"name":"Serrano Pepper","hex":"#556600"},{"name":"Sesame","hex":"#baa38b"},{"name":"Sesame Seed","hex":"#e1d9b8"},{"name":"Seven Seas","hex":"#4a5c6a"},{"name":"Shades of Ruby","hex":"#9c0009"},{"name":"Shadow of Night","hex":"#2a4f61"},{"name":"Shadow of the Colossus","hex":"#a3a2a1"},{"name":"Shadow Purple","hex":"#4e334e"},{"name":"Shadows","hex":"#6b6d6a"},{"name":"Shady Character","hex":"#4c4b4c"},{"name":"Shallot Peel","hex":"#eec378"},{"name":"Shallow Sea","hex":"#9ab8c2"},{"name":"Shallow Water","hex":"#8af1fe"},{"name":"Shamrock","hex":"#009e60"},{"name":"Shark","hex":"#cadcde"},{"name":"Shattered Ice","hex":"#daeee6"},{"name":"Shaving Cream","hex":"#e1e5e5"},{"name":"She Loves Pink","hex":"#e39b96"},{"name":"Sheaf","hex":"#d2ae84"},{"name":"Sheikh White","hex":"#efecee"},{"name":"Shiitake","hex":"#a5988a"},{"name":"Shimmering Blue","hex":"#82dbcc"},{"name":"Shimmering Love","hex":"#ff88cc"},{"name":"Shin Godzilla","hex":"#9a373f"},{"name":"Shiny Trumpet","hex":"#ecae58"},{"name":"Shipmate","hex":"#7aa3cc"},{"name":"Shipwreck","hex":"#968772"},{"name":"Shipyard","hex":"#4f6f85"},{"name":"Shivering Green","hex":"#24dd7e"},{"name":"Shocking Crimson","hex":"#ff0d04"},{"name":"Shocking Orange","hex":"#ff6e1c"},{"name":"Shocking Pink","hex":"#fe02a2"},{"name":"Shocking Rose","hex":"#ff006a"},{"name":"Shōji","hex":"#ded5c7"},{"name":"Shore","hex":"#81d5c6"},{"name":"Shortbread","hex":"#f5e6d3"},{"name":"Shrimp","hex":"#e29a86"},{"name":"Shrimp Cocktail","hex":"#f4a461"},{"name":"Shrimp Toast","hex":"#f7c5a0"},{"name":"Shrine of Pleasures","hex":"#cc3388"},{"name":"Shuriken","hex":"#333344"},{"name":"Shy Champagne Blush","hex":"#dea392"},{"name":"Shy Young Salmon","hex":"#dfb8bc"},{"name":"Sienna","hex":"#a9561e"},{"name":"Signal Green","hex":"#33ff00"},{"name":"Silence","hex":"#eaede5"},{"name":"Silent Film","hex":"#9fa5a5"},{"name":"Silent Night","hex":"#526771"},{"name":"Silent Sea","hex":"#3a4a63"},{"name":"Silent Snowfall","hex":"#eef7fa"},{"name":"Silk Dessou","hex":"#eee9dc"},{"name":"Silk for the Gods","hex":"#ecddc9"},{"name":"Silk Lining","hex":"#fcefe0"},{"name":"Silk Satin","hex":"#8b4248"},{"name":"Silk Star","hex":"#f5eec6"},{"name":"Silken Chocolate","hex":"#b77d5f"},{"name":"Silken Gold","hex":"#fce17c"},{"name":"Silken Jade","hex":"#11a39e"},{"name":"Silken Pebble","hex":"#d0d0c9"},{"name":"Silken Ruby","hex":"#e81320"},{"name":"Silkworm","hex":"#eeeecc"},{"name":"Silky Green","hex":"#bdc2bb"},{"name":"Silky Mint","hex":"#d7ecd9"},{"name":"Silky White","hex":"#efebe2"},{"name":"Silver","hex":"#c0c0c0"},{"name":"Silver Birch","hex":"#d2cfc4"},{"name":"Silver Bird","hex":"#fbf5f0"},{"name":"Silver Fern","hex":"#e1ddbf"},{"name":"Silver Fox","hex":"#bdbcc4"},{"name":"Silver Lake","hex":"#dedddd"},{"name":"Silver Lining","hex":"#b8b1a5"},{"name":"Silver Mistral","hex":"#b4b9b9"},{"name":"Silver Phoenix","hex":"#ebecf5"},{"name":"Silver Surfer","hex":"#7e7d88"},{"name":"Silver-Tongued","hex":"#cdc7c7"},{"name":"Silverback","hex":"#cbcbcb"},{"name":"Silverfish","hex":"#8d95aa"},{"name":"Silverplate","hex":"#c2c0ba"},{"name":"Simply Purple","hex":"#715bb1"},{"name":"Single Origin","hex":"#713e39"},{"name":"Sinister","hex":"#12110e"},{"name":"Sinsemilla","hex":"#b6bd4a"},{"name":"Sip of Mint","hex":"#dedfc9"},{"name":"Siren","hex":"#69293b"},{"name":"Siren Scarlet","hex":"#b21d1d"},{"name":"Sizzling Bacon","hex":"#8e3537"},{"name":"Sizzling Watermelon","hex":"#fa005c"},{"name":"Skeleton","hex":"#ebdecc"},{"name":"Sky","hex":"#76d6ff"},{"name":"Sky Dancer","hex":"#4499ff"},{"name":"Sky Dive","hex":"#60bfd3"},{"name":"Sky Fall","hex":"#89c6df"},{"name":"Sky High","hex":"#a7c2eb"},{"name":"Skydive","hex":"#83acd3"},{"name":"Skyscraper","hex":"#d3dbe2"},{"name":"Skyvory","hex":"#dcd7cd"},{"name":"Sleepless Blue","hex":"#badbed"},{"name":"Sleepy Hollows","hex":"#839c6d"},{"name":"Slice of Heaven","hex":"#0022ee"},{"name":"Slightly in Love","hex":"#fce6db"},{"name":"Slime Girl","hex":"#00bb88"},{"name":"Slipper Satin","hex":"#bfc1cb"},{"name":"Slippery Salmon","hex":"#f87e63"},{"name":"Slippery Soap","hex":"#efedd8"},{"name":"Slumber","hex":"#2d517c"},{"name":"Sly Fox","hex":"#804741"},{"name":"Smalt","hex":"#003399"},{"name":"Smashing Pumpkins","hex":"#ff5522"},{"name":"Smell of Garlic","hex":"#d9ddcb"},{"name":"Smell the Mint","hex":"#bef7cf"},{"name":"Smidgen of Love","hex":"#f0ccd9"},{"name":"Smiley Face","hex":"#ffc962"},{"name":"Smoke and Mirrors","hex":"#d9e6e8"},{"name":"Smoke Dragon","hex":"#ccbbaa"},{"name":"Smoked Black Coffee","hex":"#3b2f2f"},{"name":"Smoked Oyster","hex":"#d9d2cd"},{"name":"Smoked Salmon","hex":"#fa8072"},{"name":"Smokescreen","hex":"#5e5755"},{"name":"Smoking Mirror","hex":"#a29587"},{"name":"Smoky","hex":"#605d6b"},{"name":"Smoky Charcoal","hex":"#34282c"},{"name":"Smoky Studio","hex":"#7e8590"},{"name":"Smooch Rouge","hex":"#d13d4b"},{"name":"Smooth Pebbles","hex":"#cabab1"},{"name":"Smouldering Red","hex":"#ca3434"},{"name":"Snake Fruit","hex":"#db2217"},{"name":"Snakes in the Grass","hex":"#889717"},{"name":"Snarky Mint","hex":"#9ae37d"},{"name":"Sneaky Devil","hex":"#840014"},{"name":"Sneaky Sesame","hex":"#896a46"},{"name":"Snow","hex":"#fffafa"},{"name":"Snow White","hex":"#eeffee"},{"name":"Snowflake","hex":"#eff0f0"},{"name":"Snowman","hex":"#fefafb"},{"name":"Snowy Mint","hex":"#d6f0cd"},{"name":"Snowy Summit","hex":"#c5d8e9"},{"name":"So Sour","hex":"#00ff11"},{"name":"Soaked in Sun","hex":"#f7d163"},{"name":"Soba","hex":"#d1b49f"},{"name":"Socialist","hex":"#921a1c"},{"name":"Soda Pop","hex":"#c3c67e"},{"name":"Soft Blush","hex":"#e3bcbc"},{"name":"Soft Boiled","hex":"#ffb737"},{"name":"Soft Butter","hex":"#f4e1b6"},{"name":"Soft Cashmere","hex":"#efb6d8"},{"name":"Soft Pillow","hex":"#fff5e7"},{"name":"Soft Pumpkin","hex":"#dc8e31"},{"name":"Solar","hex":"#fbeab8"},{"name":"Solar Ash","hex":"#cc6622"},{"name":"Solar Flare","hex":"#e67c41"},{"name":"Solar Power","hex":"#f4b435"},{"name":"Solar Relic","hex":"#d2ab51"},{"name":"Solar Storm","hex":"#ffc16c"},{"name":"Sombrero","hex":"#b39c8c"},{"name":"Somewhere in a Fairytale","hex":"#cc99dd"},{"name":"Song of the Sea","hex":"#4a73a8"},{"name":"Soothing Sapphire","hex":"#307dd3"},{"name":"Sooty","hex":"#141414"},{"name":"Sorreno Lemon","hex":"#f1d058"},{"name":"Soufflé","hex":"#edd1a8"},{"name":"Soulless","hex":"#1b150d"},{"name":"Sour","hex":"#e5edb5"},{"name":"Sour Apple Candy","hex":"#aaee22"},{"name":"Sour Apple Rings","hex":"#33bb00"},{"name":"Sour Cherry","hex":"#e24736"},{"name":"Sour Green","hex":"#c1e613"},{"name":"Sour Lemon","hex":"#ffeea5"},{"name":"Sour Lime","hex":"#acc326"},{"name":"Sour Yellow","hex":"#eeff04"},{"name":"Sovereign Red","hex":"#ce243f"},{"name":"Soviet Gold","hex":"#ffd900"},{"name":"Soy Milk","hex":"#d5d2c7"},{"name":"Spa","hex":"#ceece7"},{"name":"Space Battle Blue","hex":"#440099"},{"name":"Space Colonization","hex":"#150f5b"},{"name":"Space Dust","hex":"#002299"},{"name":"Space Exploration","hex":"#001199"},{"name":"Space Missions","hex":"#324471"},{"name":"Space Opera","hex":"#5511dd"},{"name":"Spacescape","hex":"#222255"},{"name":"Spaghetti Monster","hex":"#eecc88"},{"name":"Sparkling Champagne","hex":"#efcf98"},{"name":"Sparkling Cider","hex":"#fffdeb"},{"name":"Sparkling Cosmo","hex":"#f9736e"},{"name":"Sparkling Snow","hex":"#f5fefd"},{"name":"Sparky Blue","hex":"#22eeff"},{"name":"Spätzle Yellow","hex":"#ffee88"},{"name":"Spearmint","hex":"#64bfa4"},{"name":"Spectacular Purple","hex":"#bb02fe"},{"name":"Spectacular Saffron","hex":"#edd924"},{"name":"Spectacular Scarlet","hex":"#f72305"},{"name":"Sphinx","hex":"#a99593"},{"name":"Spice Market","hex":"#b84823"},{"name":"Spiced","hex":"#bb715b"},{"name":"Spiced Up Orange","hex":"#e67a37"},{"name":"Spicy Berry","hex":"#cc3366"},{"name":"Spicy Cinnamon","hex":"#a85624"},{"name":"Spicy Paella","hex":"#f38f39"},{"name":"Spicy Purple","hex":"#b9396e"},{"name":"Spicy Sweetcorn","hex":"#f6ac00"},{"name":"Spikey Red","hex":"#600000"},{"name":"Splashdown","hex":"#d4e8d8"},{"name":"Splashing Wave","hex":"#44ddff"},{"name":"Splatter Movie","hex":"#d01a2c"},{"name":"Sprig of Sage","hex":"#f2f6db"},{"name":"Spring Bud","hex":"#a7fc00"},{"name":"Spring Forth","hex":"#11bb22"},{"name":"Springtide Melodies","hex":"#9aa955"},{"name":"Sprinkled With Pink","hex":"#e7a2ae"},{"name":"Sprouted","hex":"#f3d48b"},{"name":"Squid’s Ink","hex":"#041330"},{"name":"Stainless Steel","hex":"#b4bdc7"},{"name":"Star","hex":"#ffe500"},{"name":"Star Dust","hex":"#f9f3dd"},{"name":"Star of Life","hex":"#057bc1"},{"name":"Stardust Evening","hex":"#b8bfdc"},{"name":"Stargazer","hex":"#3f5865"},{"name":"Stargazing","hex":"#414549"},{"name":"Starlet","hex":"#854e51"},{"name":"Starlit Night","hex":"#3b476b"},{"name":"Starry Night","hex":"#286492"},{"name":"Starship Tonic","hex":"#cce7e8"},{"name":"Starstruck","hex":"#4664a5"},{"name":"Statuary","hex":"#9ea4a5"},{"name":"Stay the Night","hex":"#314662"},{"name":"Steam","hex":"#dddddd"},{"name":"Steam Bath","hex":"#ccd0da"},{"name":"Steam Engine","hex":"#b2b2ad"},{"name":"Steampunk Gold","hex":"#c39c55"},{"name":"Steamy Dumpling","hex":"#eae9b4"},{"name":"Steel Mist","hex":"#c6ceda"},{"name":"Steely Grey","hex":"#90979b"},{"name":"Stellar","hex":"#46647e"},{"name":"Stellar Strawberry","hex":"#ff5c8d"},{"name":"Stereotypical Duck","hex":"#fff5cf"},{"name":"Sterling","hex":"#d1d4d1"},{"name":"Still Water","hex":"#4a5d5f"},{"name":"Stone Cold","hex":"#555555"},{"name":"Stone Fortress","hex":"#c5c0b0"},{"name":"Stone Guardians","hex":"#caba97"},{"name":"Stop","hex":"#c33a36"},{"name":"Stoplight","hex":"#dd1111"},{"name":"Storm","hex":"#000b44"},{"name":"Storm Is Coming","hex":"#3d3d63"},{"name":"Stormy","hex":"#b0bcc3"},{"name":"Stormy Bay","hex":"#9aafaf"},{"name":"Stormy Horizon","hex":"#777799"},{"name":"Stormy Night","hex":"#372354"},{"name":"Stormy Oceans","hex":"#70818e"},{"name":"Stormy Passion","hex":"#c36666"},{"name":"Stormy Sea","hex":"#6e8082"},{"name":"Stormy Waters","hex":"#84a9b0"},{"name":"Straw Gold","hex":"#fcf679"},{"name":"Strawberry","hex":"#fb2943"},{"name":"Strawberry Avalanche","hex":"#ef4f41"},{"name":"Strawberry Blonde","hex":"#ffdadc"},{"name":"Strawberry Bonbon","hex":"#ffebfa"},{"name":"Strawberry Buttercream","hex":"#f8b3ff"},{"name":"Strawberry Cheesecake","hex":"#ffdbe9"},{"name":"Strawberry Dreams","hex":"#ff88aa"},{"name":"Strawberry Field","hex":"#fa8383"},{"name":"Strawberry Frappé","hex":"#ffa2aa"},{"name":"Strawberry Latte","hex":"#d2adb5"},{"name":"Strawberry Memory","hex":"#e2958d"},{"name":"Strawberry Milk","hex":"#ffd9e7"},{"name":"Strawberry Milkshake","hex":"#d47186"},{"name":"Strawberry Moon","hex":"#cf5570"},{"name":"Strawberry Ripple","hex":"#f7cdce"},{"name":"Strawberry Risotto","hex":"#eec6bf"},{"name":"Stroopwafel","hex":"#a86f48"},{"name":"Sub-Zero","hex":"#57a1ce"},{"name":"Submerged","hex":"#4a7d82"},{"name":"Subnautical","hex":"#012253"},{"name":"Subterrain Kingdom","hex":"#4f4e4a"},{"name":"Subtle Breeze","hex":"#b5d2d8"},{"name":"Succubus","hex":"#990022"},{"name":"Succulent","hex":"#8ba477"},{"name":"Succulent Lime","hex":"#dcdd65"},{"name":"Succulents","hex":"#007744"},{"name":"Such a Peach","hex":"#fbddaf"},{"name":"Sugar Chic","hex":"#ffccff"},{"name":"Sugar Coated","hex":"#ffedf1"},{"name":"Sugar Cookie","hex":"#f2e2a4"},{"name":"Sugar Cookie Crust","hex":"#e8cfb1"},{"name":"Sugar Glaze","hex":"#fff0e1"},{"name":"Sugar High","hex":"#efc9ec"},{"name":"Sugar Milk","hex":"#fff9f5"},{"name":"Sugar Mint","hex":"#c0e2c5"},{"name":"Sugar Quill","hex":"#ebe5d7"},{"name":"Sugar Rush","hex":"#d85da1"},{"name":"Sugarwinkle","hex":"#fdc5e3"},{"name":"Sugo Della Nonna","hex":"#a32e1d"},{"name":"Sulfur Pit","hex":"#e5cc69"},{"name":"Sulfuric","hex":"#eeed56"},{"name":"Sulphur","hex":"#cab012"},{"name":"Sultan Gold","hex":"#f6ac17"},{"name":"Sultan of Pink","hex":"#e89bc7"},{"name":"Summer Crush","hex":"#f2d6da"},{"name":"Summer Glow","hex":"#eeaa44"},{"name":"Summer Mist","hex":"#cbeaee"},{"name":"Summer of ’82","hex":"#74cdd8"},{"name":"Summer’s End","hex":"#dc9367"},{"name":"Summit","hex":"#8bb6b8"},{"name":"Sumptuous Purple","hex":"#604c81"},{"name":"Sun Flooded Woods","hex":"#d0d418"},{"name":"Sun Kissed Coral","hex":"#ea6777"},{"name":"Sun-Kissed Sands","hex":"#ffedbc"},{"name":"Sunbathed","hex":"#f5dd98"},{"name":"Sunbathed Beach","hex":"#fad28f"},{"name":"Sunbathing Beauty","hex":"#7e4730"},{"name":"Sunbeam","hex":"#f5edb2"},{"name":"Sunburst","hex":"#f5b57b"},{"name":"Sunflower","hex":"#ffc512"},{"name":"Sunflower Island","hex":"#ffcd01"},{"name":"Sunflower Mango","hex":"#ffb700"},{"name":"Sunflower Valley","hex":"#fdbd27"},{"name":"Sunken Gold","hex":"#b29700"},{"name":"Sunken Harbor","hex":"#1c3d44"},{"name":"Sunken Mystery","hex":"#23505a"},{"name":"Sunken Ship","hex":"#10252a"},{"name":"Sunken Treasure","hex":"#cccf86"},{"name":"Sunkissed Beach","hex":"#deab9b"},{"name":"Sunlight","hex":"#ebcd95"},{"name":"Sunny Disposition","hex":"#dba637"},{"name":"Sunny Glory","hex":"#e8d99c"},{"name":"Sunny Honey","hex":"#f8f0d8"},{"name":"Sunny Yellow","hex":"#fff917"},{"name":"Sunray","hex":"#e3ab57"},{"name":"Sunset Blaze","hex":"#e95e2a"},{"name":"Sunset Gold","hex":"#f6c362"},{"name":"Sunset Orange","hex":"#fd5e53"},{"name":"Sunshine Mellow","hex":"#f5c20b"},{"name":"Sunshone Plum","hex":"#886688"},{"name":"Sunspill","hex":"#ddc283"},{"name":"Super Banana","hex":"#fffe71"},{"name":"Super Pink","hex":"#ce6ba6"},{"name":"Super Rare Jade","hex":"#14bab4"},{"name":"Super Rose Red","hex":"#cb1028"},{"name":"Super Saiyan","hex":"#ffdd00"},{"name":"Super Silver","hex":"#eeeeee"},{"name":"Superstar","hex":"#ffcc11"},{"name":"Supremely Cool","hex":"#afbed4"},{"name":"Surgical","hex":"#59a4c1"},{"name":"Swamp Monster","hex":"#005511"},{"name":"Swan Dive","hex":"#e5e4dd"},{"name":"Swan Lake","hex":"#c5e5e2"},{"name":"Sweet and Sassy","hex":"#e1c9d1"},{"name":"Sweet Butter","hex":"#fffcd7"},{"name":"Sweet Chilli","hex":"#f5160b"},{"name":"Sweet Corn","hex":"#f9e176"},{"name":"Sweet Desire","hex":"#aa33ee"},{"name":"Sweet Lilac","hex":"#e8b5ce"},{"name":"Sweet Lucid Dreams","hex":"#ccbbdd"},{"name":"Sweet Mint Pesto","hex":"#bbee99"},{"name":"Sweet Perfume","hex":"#d49ab9"},{"name":"Sweet Pimento","hex":"#fe6346"},{"name":"Sweet Potato","hex":"#d87c3b"},{"name":"Sweet Venom","hex":"#b6ff1a"},{"name":"Sweetly","hex":"#ffe5ef"},{"name":"Swimmer","hex":"#0a91bf"},{"name":"Swimming","hex":"#c2e5e5"},{"name":"Tabasco","hex":"#a02712"},{"name":"Taco","hex":"#f3c7b3"},{"name":"Tadorna Teal","hex":"#7ad7ad"},{"name":"Tahini Brown","hex":"#9b856b"},{"name":"Tamahagane","hex":"#3b3f40"},{"name":"Tamed Beast","hex":"#9c2626"},{"name":"Tamed Beauty","hex":"#cfbccf"},{"name":"Tandoori","hex":"#bb5c4d"},{"name":"Tangent Periwinkle","hex":"#50507f"},{"name":"Tangerine Tango","hex":"#ff9e4b"},{"name":"Tangled Web","hex":"#b2b2b2"},{"name":"Tapioca","hex":"#dac9b9"},{"name":"Tardis Blue","hex":"#003b6f"},{"name":"Tartan Red","hex":"#b1282a"},{"name":"Tatami","hex":"#deccaf"},{"name":"Taupe","hex":"#b9a281"},{"name":"Tea Green","hex":"#d0f0c0"},{"name":"Teak","hex":"#ab8953"},{"name":"Teakwood","hex":"#8d7e6d"},{"name":"Teal","hex":"#008080"},{"name":"Teal Me No Lies","hex":"#0daca7"},{"name":"Teal With It","hex":"#01697a"},{"name":"Teardrop","hex":"#d1eaea"},{"name":"Techno Taupe","hex":"#bfb9aa"},{"name":"Technolust","hex":"#ff80f9"},{"name":"Telemagenta","hex":"#aa22cc"},{"name":"Tempest","hex":"#79839b"},{"name":"Templar’s Gold","hex":"#f2e688"},{"name":"Temptatious Tangerine","hex":"#ff7733"},{"name":"Tender Shoot","hex":"#e8eace"},{"name":"Tender Taupe","hex":"#c4b198"},{"name":"Tennis Ball","hex":"#dfff4f"},{"name":"Terrestrial","hex":"#276757"},{"name":"Testosterose","hex":"#ddaaff"},{"name":"Thai Chili","hex":"#ce0001"},{"name":"Thai Hot","hex":"#fe1c06"},{"name":"Thalassa","hex":"#53b1ba"},{"name":"Thalassophile","hex":"#44aadd"},{"name":"The Count’s Black","hex":"#102030"},{"name":"The Devil’s Grass","hex":"#666420"},{"name":"The End","hex":"#2a2a2a"},{"name":"The Grape War of 97’","hex":"#bb00ff"},{"name":"The Legend of Green","hex":"#558844"},{"name":"The Vast of Night","hex":"#110066"},{"name":"Think Pink","hex":"#e5a5c1"},{"name":"Thor’s Thunder","hex":"#44ccff"},{"name":"Threatening Red","hex":"#c30305"},{"name":"Thrilling Lime","hex":"#8cc34b"},{"name":"Thunder & Lightning","hex":"#f9f5db"},{"name":"Thunderbird","hex":"#923830"},{"name":"Thunderbolt","hex":"#fdefad"},{"name":"Thundercloud","hex":"#698589"},{"name":"Thyme and Place","hex":"#6f8770"},{"name":"Tiger","hex":"#be9c67"},{"name":"Tiger King","hex":"#dd9922"},{"name":"Tiger Lily","hex":"#e1583f"},{"name":"Tiger of Mysore","hex":"#ff8855"},{"name":"Timeless Beauty","hex":"#b6273e"},{"name":"Timid White","hex":"#d9d6cf"},{"name":"Tin","hex":"#919191"},{"name":"Titian Red","hex":"#bd5620"},{"name":"Toad","hex":"#748d70"},{"name":"Toad King","hex":"#3d6c54"},{"name":"Toadstool","hex":"#b8282f"},{"name":"Toast and Butter","hex":"#d2ad84"},{"name":"Toasted Husk","hex":"#ed8a53"},{"name":"Toasted Marshmallow Fluff","hex":"#fff9eb"},{"name":"Toasted Paprika","hex":"#a34631"},{"name":"Tobacco","hex":"#684f3c"},{"name":"Tobacco Leaf","hex":"#8c724f"},{"name":"Toes in the Sand","hex":"#f8dcbf"},{"name":"Toffee","hex":"#755139"},{"name":"Tofu","hex":"#e6e5d6"},{"name":"Tomato","hex":"#ef4026"},{"name":"Tomato Baby","hex":"#e10d18"},{"name":"Tomato Bisque","hex":"#d15915"},{"name":"Tomato Burst","hex":"#d6201a"},{"name":"Tomato Queen","hex":"#dd4422"},{"name":"Tonkatsu","hex":"#edac36"},{"name":"Too Big to Whale","hex":"#9596a4"},{"name":"Too Blue to be True","hex":"#0088ff"},{"name":"Too Dark Tonight","hex":"#0011bb"},{"name":"Topiary Green","hex":"#667700"},{"name":"Torchlight","hex":"#ffc985"},{"name":"Toreador","hex":"#cd123f"},{"name":"Torrefacto Roast","hex":"#4e241e"},{"name":"Tortilla","hex":"#efdba7"},{"name":"Tostada","hex":"#e3c19c"},{"name":"Tosty Crust","hex":"#a67e4b"},{"name":"Total Eclipse","hex":"#303543"},{"name":"Totally Broccoli","hex":"#909853"},{"name":"Touch of Glamor","hex":"#dd8844"},{"name":"Toupe","hex":"#c7ac7d"},{"name":"Toxic Boyfriend","hex":"#ccff11"},{"name":"Toxic Frog","hex":"#98fb98"},{"name":"Toxic Latte","hex":"#e1f8e7"},{"name":"Toxic Sludge","hex":"#00bb33"},{"name":"Toxic Steam","hex":"#c1fdc9"},{"name":"Track and Field","hex":"#d66352"},{"name":"Tractor Beam","hex":"#00bffe"},{"name":"Tradewind","hex":"#b7c5c6"},{"name":"Traffic Green","hex":"#55ff22"},{"name":"Traffic Red","hex":"#ff1c1c"},{"name":"Traffic Yellow","hex":"#fedc39"},{"name":"Trail Dust","hex":"#d0c4ac"},{"name":"Tranquili Teal","hex":"#6c9da9"},{"name":"Transcendence","hex":"#f8f4d8"},{"name":"Transfusion","hex":"#ea1833"},{"name":"Translucent Unicorn","hex":"#ffedef"},{"name":"Trapped Darkness","hex":"#0e1d32"},{"name":"Treasure","hex":"#e7d082"},{"name":"Treasure Chest","hex":"#726854"},{"name":"Treasure Map","hex":"#d0bb9d"},{"name":"Treasure Map Waters","hex":"#658faa"},{"name":"Treasured Teal","hex":"#52c1b3"},{"name":"Treasures","hex":"#ba8b36"},{"name":"Treasury","hex":"#dbd186"},{"name":"Tree Hugger","hex":"#79774a"},{"name":"Tree of Life","hex":"#595d45"},{"name":"Treetop","hex":"#91b6ac"},{"name":"Treetop Cathedral","hex":"#2f4a15"},{"name":"Trippy Velvet","hex":"#cc00ee"},{"name":"Tropical Dream","hex":"#d9eae5"},{"name":"Tropical Escape","hex":"#4dbbaf"},{"name":"Tropical Fog","hex":"#cbcab6"},{"name":"Tropical Forest","hex":"#024a43"},{"name":"Tropical Freeze","hex":"#99ddcc"},{"name":"Tropical Funk","hex":"#55dd00"},{"name":"Tropical Mist","hex":"#cae8e8"},{"name":"Tropical Rain","hex":"#447777"},{"name":"Tropical Rainforest","hex":"#00755e"},{"name":"Tropical Turquoise","hex":"#04cdff"},{"name":"Trout","hex":"#4c5356"},{"name":"Trout Caviar","hex":"#f75300"},{"name":"True Blue","hex":"#010fcc"},{"name":"Truffle Trouble","hex":"#a35139"},{"name":"Trumpet Gold","hex":"#e9b413"},{"name":"Tulip","hex":"#ff878d"},{"name":"Tuna","hex":"#46494e"},{"name":"Tunic Green","hex":"#00cc00"},{"name":"Turf","hex":"#415b36"},{"name":"Turf Master","hex":"#009922"},{"name":"Turkish Jade","hex":"#2b888d"},{"name":"Turnip Crown","hex":"#bb9ecd"},{"name":"Turnip the Pink","hex":"#e5717b"},{"name":"Turquoise","hex":"#06c2ac"},{"name":"Turquoise Fantasies","hex":"#6dafa7"},{"name":"Turquoise Pearl","hex":"#89f5e3"},{"name":"Turquoise Tortoise","hex":"#457b74"},{"name":"Turtle","hex":"#523f31"},{"name":"Turtle Warrior","hex":"#35b76d"},{"name":"Tuscan","hex":"#fbd5a6"},{"name":"Tuscan Sun","hex":"#ffd84d"},{"name":"Tussie-Mussie","hex":"#edc5d7"},{"name":"Tutu","hex":"#f8e4e3"},{"name":"Tuxedo","hex":"#3f3c43"},{"name":"Twilight","hex":"#4e518b"},{"name":"Twilight Express","hex":"#1c3378"},{"name":"Twilight Meadow","hex":"#51a5a4"},{"name":"Twilight Zone","hex":"#191916"},{"name":"Twinkle Night","hex":"#636ca8"},{"name":"Twinkle Pink","hex":"#fbd8cc"},{"name":"Twinkly Pinkily","hex":"#cf4796"},{"name":"Two Peas in a Pod","hex":"#a5ca4f"},{"name":"Ultimate Grey","hex":"#a9a8a9"},{"name":"Ultra Green","hex":"#7eba4d"},{"name":"Ultra Mint","hex":"#a3efb8"},{"name":"Ultra Moss","hex":"#d1f358"},{"name":"Ultraberry","hex":"#770088"},{"name":"Umbra","hex":"#211e1f"},{"name":"Under the Sea","hex":"#395d68"},{"name":"Under the Sun","hex":"#efd100"},{"name":"Underclover","hex":"#428c49"},{"name":"Underground","hex":"#665a51"},{"name":"Underpass Shrine","hex":"#cc4422"},{"name":"Underwater Moonlight","hex":"#4488aa"},{"name":"Underwater World","hex":"#657f7a"},{"name":"Underworld","hex":"#1e231c"},{"name":"Unicorn Dust","hex":"#ff2f92"},{"name":"Untamed Red","hex":"#dd0022"},{"name":"Upset Tomato","hex":"#b52923"},{"name":"Urban Chic","hex":"#424c4a"},{"name":"Urban Snowfall","hex":"#dbd8da"},{"name":"Va Va Voom","hex":"#e3b34c"},{"name":"Valentine Lava","hex":"#ba0728"},{"name":"Valentine’s Kiss","hex":"#b63364"},{"name":"Valkyrie","hex":"#eecc22"},{"name":"Valley of Tears","hex":"#d1e1e4"},{"name":"Vampire Bite","hex":"#c40233"},{"name":"Vampire Fangs","hex":"#cc2255"},{"name":"Vampire Fiction","hex":"#9b0f11"},{"name":"Vampire Hunter","hex":"#610507"},{"name":"Vampire Love Story","hex":"#dd0077"},{"name":"Vampire Red","hex":"#dd4132"},{"name":"Vampire State Building","hex":"#cc1100"},{"name":"Vampirella","hex":"#9b2848"},{"name":"Vampiric Bloodlust","hex":"#cc0066"},{"name":"Van Dyke Brown","hex":"#664228"},{"name":"Vanilla","hex":"#f3e5ab"},{"name":"Vanilla Blush","hex":"#fcede4"},{"name":"Vanilla Cake","hex":"#fcf0ca"},{"name":"Vanilla Cream","hex":"#f8e3ab"},{"name":"Vanilla Drop","hex":"#ffffeb"},{"name":"Vanilla Ice","hex":"#fdf2d1"},{"name":"Vanilla Sugar","hex":"#f1e8dc"},{"name":"Vanishing Point","hex":"#ddeedd"},{"name":"Vapor","hex":"#f0ffff"},{"name":"Vapor Trail","hex":"#f5eedf"},{"name":"Vaporized","hex":"#cbf4f8"},{"name":"Vaporwave","hex":"#ff66ee"},{"name":"Vaporwave Blue","hex":"#22ddff"},{"name":"Varnished Ivory","hex":"#e6dccc"},{"name":"Vegas Gold","hex":"#c5b358"},{"name":"Vegetarian","hex":"#22aa00"},{"name":"Vegetation","hex":"#5ccd97"},{"name":"Veiled Rose","hex":"#f7cdc8"},{"name":"Veiled Treasure","hex":"#f6edb6"},{"name":"Veiling Waterfalls","hex":"#d4eaff"},{"name":"Velour Scar","hex":"#8e5164"},{"name":"Velvet","hex":"#750851"},{"name":"Velvet Black","hex":"#241f20"},{"name":"Velvet Cosmos","hex":"#441144"},{"name":"Velvet Horizon","hex":"#d39ed2"},{"name":"Velvet Magic","hex":"#bb1155"},{"name":"Velvet Scarf","hex":"#e3dfec"},{"name":"Velvet Volcano","hex":"#ab0102"},{"name":"Velvet Vortex","hex":"#540d6e"},{"name":"Velvet Wine","hex":"#9a435d"},{"name":"Venom Dart","hex":"#01ff01"},{"name":"Venomous Green","hex":"#66ff22"},{"name":"Venus","hex":"#eed053"},{"name":"Venus Mist","hex":"#5f606e"},{"name":"Venus Slipper Orchid","hex":"#df73ff"},{"name":"Venus Violet","hex":"#7a6dc0"},{"name":"Veranda Gold","hex":"#af9968"},{"name":"Verdant Forest","hex":"#28615d"},{"name":"Verdant Haven","hex":"#84a97c"},{"name":"Verdant Hush","hex":"#4e5a4a"},{"name":"Verdant Leaf","hex":"#817c4a"},{"name":"Verde","hex":"#7fb383"},{"name":"Verdigris","hex":"#43b3ae"},{"name":"Vermicelles","hex":"#dabe82"},{"name":"Vermilion","hex":"#f4320c"},{"name":"Vermilion Scarlet","hex":"#d1062b"},{"name":"Verminal","hex":"#55cc11"},{"name":"Vertigo Cherry","hex":"#990055"},{"name":"Very Berry","hex":"#bb3381"},{"name":"Very Coffee","hex":"#664411"},{"name":"Vibrant Amber","hex":"#d1902e"},{"name":"Vibrant Blue","hex":"#0339f8"},{"name":"Vibrant Honey","hex":"#ffbd31"},{"name":"Vibrant Mint","hex":"#00ffe5"},{"name":"Vibrant Orange","hex":"#ff6216"},{"name":"Vibrant Purple","hex":"#ad03de"},{"name":"Vibrant Velvet","hex":"#bb0088"},{"name":"Vibrant Vine","hex":"#4b373a"},{"name":"Vibrant Yellow","hex":"#ffda29"},{"name":"Vice City","hex":"#ee00dd"},{"name":"Vicious Violet","hex":"#8f509d"},{"name":"Victorian Crown","hex":"#c38b36"},{"name":"Victorian Garden","hex":"#558e4c"},{"name":"Vienna Roast","hex":"#330022"},{"name":"Viking","hex":"#4db1c8"},{"name":"Viking Diva","hex":"#cabae0"},{"name":"Vin Cuit","hex":"#b47463"},{"name":"Vinaceous","hex":"#f59994"},{"name":"Vinaceous Cinnamon","hex":"#f48b8b"},{"name":"Vinaceous Tawny","hex":"#c74300"},{"name":"Vinaigrette","hex":"#efdaae"},{"name":"Vineyard","hex":"#819e84"},{"name":"Vintage","hex":"#847592"},{"name":"Vintage Bloom","hex":"#c0b0d0"},{"name":"Vintage Copper","hex":"#9d5f46"},{"name":"Vintage Porcelain","hex":"#f2edec"},{"name":"Viola","hex":"#966ebd"},{"name":"Violaceous","hex":"#bf8fc4"},{"name":"Violent Violet","hex":"#7f00ff"},{"name":"Violet","hex":"#9a0eea"},{"name":"Violet Heaven","hex":"#cdb7fa"},{"name":"Violet Kiss","hex":"#f0a0d1"},{"name":"Violet Pink","hex":"#fb5ffc"},{"name":"Violet Poison","hex":"#8601bf"},{"name":"Violet Vapor","hex":"#e5dae1"},{"name":"Violet Velvet","hex":"#b19cd9"},{"name":"Violet Vision","hex":"#b7bdd1"},{"name":"Violet Vixen","hex":"#883377"},{"name":"Violet Vogue","hex":"#e9e1e8"},{"name":"Virgin Olive Oil","hex":"#e2dcab"},{"name":"Viridian","hex":"#1e9167"},{"name":"Virtual Boy","hex":"#fe0215"},{"name":"Virtual Golf","hex":"#c1ee13"},{"name":"Vitality","hex":"#8f9b5b"},{"name":"Vitamin C","hex":"#ff9900"},{"name":"Vivid Blue","hex":"#152eff"},{"name":"Vivid Green","hex":"#2fef10"},{"name":"Vivid Orange","hex":"#ff5f00"},{"name":"Vivid Raspberry","hex":"#ff006c"},{"name":"Vivid Violet","hex":"#9f00ff"},{"name":"Void","hex":"#050d25"},{"name":"Voila!","hex":"#af8ba8"},{"name":"Volcanic Ash","hex":"#6f7678"},{"name":"Volcanic Island","hex":"#605244"},{"name":"Volcanic Rock","hex":"#6b6965"},{"name":"Voldemort","hex":"#2d135f"},{"name":"Volt","hex":"#ceff00"},{"name":"Voluptuous Violet","hex":"#7711dd"},{"name":"Voodoo","hex":"#443240"},{"name":"Voracious White","hex":"#feeeed"},{"name":"Vulcan","hex":"#36383c"},{"name":"Vulcan Fire","hex":"#e6390d"},{"name":"Vulcanized","hex":"#424443"},{"name":"Waffle Cone","hex":"#e2c779"},{"name":"Waikiki","hex":"#218ba0"},{"name":"Wakame Green","hex":"#00656e"},{"name":"Walk in the Park","hex":"#88bb11"},{"name":"Walkie Chalkie","hex":"#faf5fa"},{"name":"Walking on Sunshine","hex":"#fcfc9d"},{"name":"Walkway","hex":"#a3999c"},{"name":"Walled Garden","hex":"#11cc44"},{"name":"Walnut","hex":"#773f1a"},{"name":"Walnut Milkies","hex":"#fff0cf"},{"name":"Walrus","hex":"#999b9b"},{"name":"Wandering River","hex":"#73a4c6"},{"name":"War Paint Red","hex":"#dc571d"},{"name":"Warlord","hex":"#ba0033"},{"name":"Warm Ashes","hex":"#cfc9c7"},{"name":"Warm Blue","hex":"#4b57db"},{"name":"Warm Brown","hex":"#964e02"},{"name":"Warm Light","hex":"#fff9d8"},{"name":"Warm Neutral","hex":"#c1b19d"},{"name":"Warm Oats","hex":"#d8cfba"},{"name":"Warm Pink","hex":"#fb5581"},{"name":"Warm Purple","hex":"#952e8f"},{"name":"Warm Spring","hex":"#4286bc"},{"name":"Warm Welcome","hex":"#ea9073"},{"name":"Warm White","hex":"#efebd8"},{"name":"Warming Heart","hex":"#d44b3b"},{"name":"Warp Drive","hex":"#eaf2f1"},{"name":"Warrior","hex":"#7d685b"},{"name":"Warrior Queen","hex":"#a32d48"},{"name":"Wasabi","hex":"#afd77f"},{"name":"Wasabi Nori","hex":"#333300"},{"name":"Washed Canvas","hex":"#f3f0da"},{"name":"Washed Dollar","hex":"#e1e3d7"},{"name":"Wasteland","hex":"#9c8855"},{"name":"Water","hex":"#d4f1f9"},{"name":"Water Leaf","hex":"#b6ecde"},{"name":"Water Lily","hex":"#dde3d5"},{"name":"Water Nymph","hex":"#81d0df"},{"name":"Water Park","hex":"#54af9c"},{"name":"Waterfall","hex":"#3ab0a2"},{"name":"Watermelon","hex":"#fd4659"},{"name":"Watermelon Gelato","hex":"#c0686e"},{"name":"Watermelon Milk","hex":"#dfcfca"},{"name":"Watermelon Mousse","hex":"#fbe0e8"},{"name":"Watermelon Sugar","hex":"#e42b73"},{"name":"Watermelonade","hex":"#eb4652"},{"name":"Waterworld","hex":"#00718a"},{"name":"Wave","hex":"#a5ced5"},{"name":"Wave Splash","hex":"#cbe4e7"},{"name":"Wavelet","hex":"#7dc4cd"},{"name":"Wavy Navy","hex":"#006597"},{"name":"Wax","hex":"#ddbb33"},{"name":"Wax Flower","hex":"#eeb39e"},{"name":"Waxy Corn","hex":"#f8b500"},{"name":"Way Beyond the Blue","hex":"#1188cc"},{"name":"We Peep","hex":"#fdd7d8"},{"name":"Weathered Leather","hex":"#90614a"},{"name":"Weathered Stone","hex":"#c4c5c6"},{"name":"Weathered Wood","hex":"#b19c86"},{"name":"Wedding Dress","hex":"#fefee7"},{"name":"Wedding in White","hex":"#fffee5"},{"name":"Weissbier","hex":"#b3833b"},{"name":"Wet Asphalt","hex":"#989cab"},{"name":"Wet Concrete","hex":"#353838"},{"name":"Wet Taupe","hex":"#907e6c"},{"name":"Whale","hex":"#7c8181"},{"name":"Whale Shark","hex":"#607c8e"},{"name":"Whale’s Tale","hex":"#115a82"},{"name":"What We Do in the Shadows","hex":"#441122"},{"name":"Wheat","hex":"#fbdd7e"},{"name":"Wheat Sheaf","hex":"#dfd4c4"},{"name":"Where There Is Smoke","hex":"#c7ccce"},{"name":"Whipped Cream","hex":"#f2f0e7"},{"name":"Whirlpool","hex":"#a5d8cd"},{"name":"Whiskers","hex":"#f6f1e2"},{"name":"Whiskey","hex":"#d29062"},{"name":"Whiskey and Wine","hex":"#49463f"},{"name":"Whiskey Sour","hex":"#d4915d"},{"name":"Whisky","hex":"#c2877b"},{"name":"Whisky Barrel","hex":"#96745b"},{"name":"Whisky Cola","hex":"#772233"},{"name":"Whisky Sour","hex":"#eeaa33"},{"name":"Whisper of Smoke","hex":"#cbcecf"},{"name":"Whisper of White","hex":"#eadbca"},{"name":"Whisper White","hex":"#eae2d3"},{"name":"Whispering Frost","hex":"#d7e5d8"},{"name":"Whispering Smoke","hex":"#d8d8d4"},{"name":"Whispering Willow","hex":"#919c81"},{"name":"Whispery Breeze","hex":"#d6e9e6"},{"name":"White","hex":"#ffffff"},{"name":"White Asparagus","hex":"#eceabe"},{"name":"White Beach","hex":"#f5efe5"},{"name":"White Bullet","hex":"#dfdfda"},{"name":"White Chalk","hex":"#f6f4f1"},{"name":"White Chocolate","hex":"#f0e3c7"},{"name":"White Christmas","hex":"#f4e8e8"},{"name":"White Elephant","hex":"#dedee5"},{"name":"White Frost","hex":"#dee6ec"},{"name":"White Glove","hex":"#f0efed"},{"name":"White Mecca","hex":"#ecf3e1"},{"name":"White Pearl","hex":"#ede1d1"},{"name":"White Porcelain","hex":"#f8fbf8"},{"name":"White Russian","hex":"#f0e0dc"},{"name":"White Sand","hex":"#f5ebd8"},{"name":"White Smoke","hex":"#f5f5f5"},{"name":"White Strawberry","hex":"#fde3b5"},{"name":"White Truffle","hex":"#efdbcd"},{"name":"White Warm Wool","hex":"#efe6d1"},{"name":"Wicked Green","hex":"#9bca47"},{"name":"Wicked Witch","hex":"#5b984f"},{"name":"Widowmaker","hex":"#99aaff"},{"name":"Wild Berry","hex":"#7e3a3c"},{"name":"Wild Chocolate","hex":"#665134"},{"name":"Wild Forest","hex":"#38914a"},{"name":"Wild Horses","hex":"#8d6747"},{"name":"Wild Violet","hex":"#63209b"},{"name":"Wild West","hex":"#7e5c52"},{"name":"Wild Wheat","hex":"#e0e1d1"},{"name":"Wilderness","hex":"#8f886c"},{"name":"Wildfire","hex":"#ff8833"},{"name":"Willow Leaf","hex":"#a1a46d"},{"name":"Wind Blown","hex":"#dde3e7"},{"name":"Wind Chime","hex":"#dfe0e2"},{"name":"Wind Chimes","hex":"#cac5c2"},{"name":"Windfall","hex":"#84a7ce"},{"name":"Windjammer","hex":"#62a5df"},{"name":"Windows 95 Desktop","hex":"#018281"},{"name":"Windsor Toffee","hex":"#ccb490"},{"name":"Windstorm","hex":"#6d98c4"},{"name":"Windsurfing","hex":"#3a7099"},{"name":"Windy","hex":"#bdd1d2"},{"name":"Windy Meadow","hex":"#b0a676"},{"name":"Wine & Roses","hex":"#a33540"},{"name":"Wine Barrel","hex":"#aa5522"},{"name":"Wine Cellar","hex":"#70403d"},{"name":"Wine Grape","hex":"#941751"},{"name":"Wine Stain","hex":"#69444f"},{"name":"Wine Tasting","hex":"#492a34"},{"name":"Wine Tour","hex":"#653b66"},{"name":"Wineberry","hex":"#663366"},{"name":"Wing Commander","hex":"#0065ac"},{"name":"Winter Duvet","hex":"#ffffe0"},{"name":"Winter Lakes","hex":"#5c97cf"},{"name":"Winter Scene","hex":"#becedb"},{"name":"Winter Storm","hex":"#4b7079"},{"name":"Winter Wizard","hex":"#a0e6ff"},{"name":"Wintermint","hex":"#94d2bf"},{"name":"Wishing Well","hex":"#d0d1c1"},{"name":"Wisteria","hex":"#a87dc2"},{"name":"Wisteria Blue","hex":"#84a2d4"},{"name":"Witch Brew","hex":"#888738"},{"name":"Witch Hazel","hex":"#fbf073"},{"name":"Witchcraft","hex":"#474c50"},{"name":"Wizard","hex":"#4d5b88"},{"name":"Wizard’s Brew","hex":"#a090b8"},{"name":"Wolf Pack","hex":"#78776f"},{"name":"Wolfram","hex":"#b5b6b7"},{"name":"Wonder Wine","hex":"#635d63"},{"name":"Wondrous Wisteria","hex":"#a3b1f2"},{"name":"Wood Bark","hex":"#302621"},{"name":"Woodgrain","hex":"#996633"},{"name":"Woodhaven","hex":"#9e7b6c"},{"name":"Woodland Grass","hex":"#004400"},{"name":"Woodland Night","hex":"#475c5d"},{"name":"Woodland Soul","hex":"#127a49"},{"name":"Woodland Wonder","hex":"#0d6323"},{"name":"Worcestershire Sauce","hex":"#572b26"},{"name":"Worn Silver","hex":"#c9c0bb"},{"name":"Wrapped in Twilight","hex":"#5f6d6e"},{"name":"Wreath","hex":"#76856a"},{"name":"Wu-Tang Gold","hex":"#f8d106"},{"name":"X Marks the Spot","hex":"#e6474a"},{"name":"Xanthic","hex":"#f4e216"},{"name":"Xmas Candy","hex":"#990020"},{"name":"Xoxo","hex":"#f08497"},{"name":"Yacht Club","hex":"#566062"},{"name":"Yakitori","hex":"#ecab3f"},{"name":"Yang Mist","hex":"#ede8dd"},{"name":"Yearning Desire","hex":"#ca135e"},{"name":"Yell for Yellow","hex":"#fffe00"},{"name":"Yell Yellow","hex":"#ffffbf"},{"name":"Yellow","hex":"#ffff00"},{"name":"Yellow Buzzing","hex":"#eedd11"},{"name":"Yellow Chalk","hex":"#f5f9ad"},{"name":"Yellow Mana","hex":"#fdfcbf"},{"name":"Yellow Mellow","hex":"#f0d31e"},{"name":"Yellow Press","hex":"#e6e382"},{"name":"Yellow Submarine","hex":"#ffff14"},{"name":"Yellow Tang","hex":"#ffd300"},{"name":"Yellow-Bellied","hex":"#ffee33"},{"name":"Yellowish","hex":"#faee66"},{"name":"Yeti Footprint","hex":"#c7d7e0"},{"name":"Yippie Ya Yellow","hex":"#f9f59f"},{"name":"Yoghurt Brûlée","hex":"#f5e9ce"},{"name":"York Pink","hex":"#d7837f"},{"name":"York Plum","hex":"#d3bfe5"},{"name":"Yorkshire Cloud","hex":"#bac3cc"},{"name":"Yoshi","hex":"#55aa00"},{"name":"Young Apricot","hex":"#fcd8b5"},{"name":"Young Crab","hex":"#f6a09d"},{"name":"Young Night","hex":"#232323"},{"name":"Young Salmon","hex":"#ffb6b4"},{"name":"Your Darkness","hex":"#220044"},{"name":"Your Majesty","hex":"#61496e"},{"name":"Your Shadow","hex":"#787e93"},{"name":"Yours Truly","hex":"#fbd9cd"},{"name":"Yucca","hex":"#75978f"},{"name":"Yuma Gold","hex":"#ffd678"},{"name":"Yuzu Marmalade","hex":"#ffd766"},{"name":"Yuzukoshō","hex":"#d4de49"},{"name":"Zen","hex":"#cfd9de"},{"name":"Zen Garden","hex":"#d1dac0"},{"name":"Zen Garden Olive","hex":"#445533"},{"name":"Zenith","hex":"#497a9f"},{"name":"Zeus’s Bolt","hex":"#eeff00"},{"name":"Zinc","hex":"#92898a"},{"name":"Zodiac Constellation","hex":"#ee8844"},{"name":"Zombie","hex":"#dadead"},{"name":"Zoodles","hex":"#b8bf71"},{"name":"Zucchini","hex":"#17462e"},{"name":"Zucchini Noodles","hex":"#c8d07f"},{"name":"Zunda Green","hex":"#6bc026"}];



    /**
     * @param {string} hex
     * @returns {string}
     */
    function getColorName(hex) {
      // Normalize hex to 6 digits, uppercase
      hex = hex.toUpperCase();
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      // Try exact match
      for (const c of colors) {
        if (c.hex.toUpperCase() === hex) return c.name;
      }
      // If not found, find closest by Euclidean distance in RGB
      /**
       * @param {string} h
       */
      function hexToRgb(h) {
        return [parseInt(h.substr(1,2),16), parseInt(h.substr(3,2),16), parseInt(h.substr(5,2),16)];
      }
      const [r1,g1,b1] = hexToRgb(hex);
      let minDist = Infinity, closest = null;
      for (const c of colors) {
        const [r2,g2,b2] = hexToRgb(c.hex);
        const dist = Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
        if (dist < minDist) {
          minDist = dist;
          closest = c.name;
        }
      }
      return closest || hex;
    }

    /* src/App.svelte generated by Svelte v3.49.0 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (193:4) {#if colorName}
    function create_if_block(ctx) {
    	let span;
    	let b;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			b = element("b");
    			t = text(/*colorName*/ ctx[3]);
    			add_location(b, file, 193, 12, 5406);
    			attr_dev(span, "class", "svelte-1uvbwcf");
    			add_location(span, file, 193, 6, 5400);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, b);
    			append_dev(b, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*colorName*/ 8) set_data_dev(t, /*colorName*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(193:4) {#if colorName}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let h1;
    	let t1;
    	let button0;
    	let span0;
    	let t2;
    	let t3;
    	let div1;
    	let t4;
    	let div2;
    	let button1;
    	let t6;
    	let div4;
    	let button2;
    	let video_1;
    	let t7;
    	let div3;
    	let t8;
    	let p;
    	let span1;
    	let t9_value = /*pixel*/ ctx[1]?.data[0].toString().padStart(3, '0') + "";
    	let t9;
    	let t10;
    	let span2;
    	let t11_value = /*pixel*/ ctx[1]?.data[1].toString().padStart(3, '0') + "";
    	let t11;
    	let t12;
    	let span3;
    	let t13_value = /*pixel*/ ctx[1]?.data[2].toString().padStart(3, '0') + "";
    	let t13;
    	let mounted;
    	let dispose;
    	let if_block = /*colorName*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Seyan";
    			t1 = space();
    			button0 = element("button");
    			span0 = element("span");
    			t2 = text(/*buttonstr*/ ctx[2]);
    			t3 = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t4 = space();
    			div2 = element("div");
    			button1 = element("button");
    			button1.textContent = "💾";
    			t6 = space();
    			div4 = element("div");
    			button2 = element("button");
    			video_1 = element("video");
    			t7 = space();
    			div3 = element("div");
    			t8 = space();
    			p = element("p");
    			span1 = element("span");
    			t9 = text(t9_value);
    			t10 = space();
    			span2 = element("span");
    			t11 = text(t11_value);
    			t12 = space();
    			span3 = element("span");
    			t13 = text(t13_value);
    			attr_dev(h1, "class", "svelte-1uvbwcf");
    			add_location(h1, file, 186, 4, 5178);
    			add_location(div0, file, 185, 2, 5168);
    			set_style(span0, "font-size", "1em ");
    			attr_dev(span0, "id", "compliment1");
    			attr_dev(span0, "class", "svelte-1uvbwcf");
    			add_location(span0, file, 189, 4, 5233);
    			attr_dev(button0, "class", "svelte-1uvbwcf");
    			add_location(button0, file, 188, 2, 5204);
    			set_style(div1, "color", "white");
    			set_style(div1, "font-size", "1rem");
    			set_style(div1, "margin-bottom", "0.5em");
    			add_location(div1, file, 191, 2, 5312);
    			attr_dev(button1, "class", "share-btn svelte-1uvbwcf");
    			attr_dev(button1, "title", "Save or Share Color Card");
    			add_location(button1, file, 197, 4, 5491);
    			attr_dev(div2, "class", "share-btn-container svelte-1uvbwcf");
    			add_location(div2, file, 196, 2, 5453);
    			attr_dev(video_1, "id", "myvideo");
    			video_1.autoplay = true;
    			video_1.playsInline = true;
    			attr_dev(video_1, "class", "svelte-1uvbwcf");
    			add_location(video_1, file, 208, 6, 5779);
    			attr_dev(button2, "id", "compliment");
    			attr_dev(button2, "class", "pauseButton svelte-1uvbwcf");
    			add_location(button2, file, 207, 4, 5706);
    			attr_dev(div3, "id", "c2");
    			attr_dev(div3, "class", "aimline svelte-1uvbwcf");
    			add_location(div3, file, 209, 4, 5854);
    			attr_dev(div4, "class", "parent svelte-1uvbwcf");
    			add_location(div4, file, 206, 2, 5681);
    			set_style(span1, "background-color", "#FF0000");
    			set_style(span1, "color", "white");
    			attr_dev(span1, "class", "svelte-1uvbwcf");
    			add_location(span1, file, 212, 4, 5905);
    			set_style(span2, "background-color", "#00FF00");
    			attr_dev(span2, "class", "svelte-1uvbwcf");
    			add_location(span2, file, 215, 4, 6026);
    			set_style(span3, "background-color", "#0000FF");
    			set_style(span3, "color", "white");
    			attr_dev(span3, "class", "svelte-1uvbwcf");
    			add_location(span3, file, 218, 4, 6135);
    			attr_dev(p, "class", "svelte-1uvbwcf");
    			add_location(p, file, 211, 2, 5897);
    			attr_dev(main, "id", "change");
    			attr_dev(main, "class", "svelte-1uvbwcf");
    			add_location(main, file, 184, 0, 5147);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h1);
    			append_dev(main, t1);
    			append_dev(main, button0);
    			append_dev(button0, span0);
    			append_dev(span0, t2);
    			append_dev(main, t3);
    			append_dev(main, div1);
    			if (if_block) if_block.m(div1, null);
    			append_dev(main, t4);
    			append_dev(main, div2);
    			append_dev(div2, button1);
    			append_dev(main, t6);
    			append_dev(main, div4);
    			append_dev(div4, button2);
    			append_dev(button2, video_1);
    			/*video_1_binding*/ ctx[9](video_1);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(main, t8);
    			append_dev(main, p);
    			append_dev(p, span1);
    			append_dev(span1, t9);
    			append_dev(p, t10);
    			append_dev(p, span2);
    			append_dev(span2, t11);
    			append_dev(p, t12);
    			append_dev(p, span3);
    			append_dev(span3, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*copy*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*shareColorCard*/ ctx[6], false, false, false),
    					listen_dev(button2, "click", /*pauseVideo*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*buttonstr*/ 4) set_data_dev(t2, /*buttonstr*/ ctx[2]);

    			if (/*colorName*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*pixel*/ 2 && t9_value !== (t9_value = /*pixel*/ ctx[1]?.data[0].toString().padStart(3, '0') + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*pixel*/ 2 && t11_value !== (t11_value = /*pixel*/ ctx[1]?.data[1].toString().padStart(3, '0') + "")) set_data_dev(t11, t11_value);
    			if (dirty & /*pixel*/ 2 && t13_value !== (t13_value = /*pixel*/ ctx[1]?.data[2].toString().padStart(3, '0') + "")) set_data_dev(t13, t13_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			/*video_1_binding*/ ctx[9](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getComplimentColor(input) {
    	let r = input.data[0];
    	let g = input.data[1];
    	let b = input.data[2];
    	const pixelarray = new Uint8ClampedArray([255 - r, 255 - g, 255 - b, input.data[3]]);
    	let cc = new ImageData(pixelarray, 1, 1);
    	return cc;
    }

    /**
     * @param {{ toString: (arg0: number) => any; }} c
     */
    function componentToHex(c) {
    	var hex = c.toString(16);
    	return hex.length === 1 ? '0' + hex : hex;
    }

    /**
     * @param {{ toString: (arg0: number) => any; }} r
     * @param {{ toString: (arg0: number) => any; }} g
     * @param {{ toString: (arg0: number) => any; }} b
     */
    function rgbToHex(r, g, b) {
    	return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let paused = false;
    	let video = document.createElement('video');
    	let data;

    	/**
     * @type {number}
     */
    	let target_x;

    	/**
     * @type {number}
     */
    	let target_y;

    	let canvas;

    	/**
     * @type {CanvasRenderingContext2D| null}
     */
    	let ctx;

    	/**
     * @type {ImageData}
     */
    	let pixel;

    	/**
     * @type {string}
     */
    	let hex;

    	/**
     * @type {string}
     */
    	let buttonstr;

    	let colorName = '';

    	/**
     * @param {HTMLVideoElement} videoObject
     */
    	const mediaStream = window.navigator.mediaDevices.getUserMedia({
    		video: { facingMode: 'environment' },
    		audio: false
    	}).then(videoStream => {
    		// yay we can now assign srcObject to videoStream
    		if (video !== null) {
    			$$invalidate(0, video.srcObject = videoStream, video);
    		}
    	}).catch(e => {
    		// tell the user something went wrong, e has the reason for why it failed
    		console.error('something is wrong :c', e);
    	});

    	/**
     * @type {HTMLVideoElement}
     */
    	let vid = document.createElement('video');

    	let lastUpdate = 0;

    	let refreshIntervalId = setInterval(
    		() => {
    			const now = Date.now();
    			if (now - lastUpdate < 500) return;
    			lastUpdate = now;
    			target_x = video.videoWidth / 2;
    			target_y = video.videoHeight / 2;
    			canvas = document.createElement('canvas');

    			// console.log('video width here', video.videoWidth);
    			canvas.width = video.videoWidth;

    			canvas.height = video.videoHeight;
    			ctx = canvas.getContext('2d');

    			// console.log(canvas.width);
    			if (ctx) {
    				ctx.drawImage(video, 0, 0);
    				data = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);

    				// console.log(target_x, target_y);
    				$$invalidate(1, pixel = ctx.getImageData(target_x, target_y, 1, 1));

    				$$invalidate(7, hex = rgbToHex(pixel.data[0], pixel.data[1], pixel.data[2]));
    				$$invalidate(3, colorName = getColorName(hex));
    				$$invalidate(2, buttonstr = hex);
    				let changeObject = document.getElementById('change');
    				let complimentObject = document.getElementById('compliment');
    				let complimentObject1 = document.getElementById('compliment1');
    				let c2 = document.getElementById('c2');

    				if (changeObject && complimentObject && c2 && complimentObject1) {
    					changeObject.style.background = 'rgba(' + pixel.data + ')';
    					complimentObject.style.color = 'rgba(' + getComplimentColor(pixel).data + ')';
    					complimentObject1.style.color = 'rgba(' + getComplimentColor(pixel).data + ')';
    					complimentObject1.style.borderBottom = 'rgba(' + getComplimentColor(pixel).data + ')  solid 2px';
    					c2.style.border = 'rgba(' + getComplimentColor(pixel).data + ') solid 4px';
    				}
    			}
    		},
    		100
    	);

    	function pauseVideo() {
    		paused = !paused;

    		if (paused) {
    			video.pause();
    		} else {
    			video.play();
    		}
    	}

    	let copyIndicator = false;

    	function copy() {
    		$$invalidate(8, copyIndicator = true);

    		setTimeout(
    			function () {
    				$$invalidate(8, copyIndicator = false);
    			},
    			1000
    		);
    	}

    	let shareCanvas;

    	async function shareColorCard() {
    		const cardElem = document.getElementById('change');
    		if (!cardElem) return;

    		const canvas = await html2canvas(cardElem, {
    			backgroundColor: null,
    			useCORS: true,
    			scale: 2
    		});

    		canvas.toBlob(
    			async blob => {
    				if (!blob) return;
    				const file = new File([blob], 'color-card.png', { type: 'image/png' });

    				if (navigator.canShare && navigator.canShare({ files: [file] })) {
    					try {
    						await navigator.share({
    							files: [file],
    							title: colorName || hex,
    							text: `Check out this color: ${colorName || hex}`
    						});
    					} catch(e) {
    						
    					} // User cancelled or error
    				} else {
    					// Fallback: download
    					const url = URL.createObjectURL(blob);

    					const a = document.createElement('a');
    					a.href = url;
    					a.download = 'color-card.png';
    					document.body.appendChild(a);
    					a.click();

    					setTimeout(
    						() => {
    							document.body.removeChild(a);
    							URL.revokeObjectURL(url);
    						},
    						100
    					);
    				}
    			},
    			'image/png'
    		);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function video_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			video = $$value;
    			$$invalidate(0, video);
    		});
    	}

    	$$self.$capture_state = () => ({
    		html2canvas,
    		paused,
    		video,
    		data,
    		target_x,
    		target_y,
    		canvas,
    		ctx,
    		pixel,
    		hex,
    		buttonstr,
    		colorName,
    		mediaStream,
    		vid,
    		getColorName,
    		lastUpdate,
    		refreshIntervalId,
    		getComplimentColor,
    		pauseVideo,
    		copyIndicator,
    		copy,
    		componentToHex,
    		rgbToHex,
    		shareCanvas,
    		shareColorCard
    	});

    	$$self.$inject_state = $$props => {
    		if ('paused' in $$props) paused = $$props.paused;
    		if ('video' in $$props) $$invalidate(0, video = $$props.video);
    		if ('data' in $$props) data = $$props.data;
    		if ('target_x' in $$props) target_x = $$props.target_x;
    		if ('target_y' in $$props) target_y = $$props.target_y;
    		if ('canvas' in $$props) canvas = $$props.canvas;
    		if ('ctx' in $$props) ctx = $$props.ctx;
    		if ('pixel' in $$props) $$invalidate(1, pixel = $$props.pixel);
    		if ('hex' in $$props) $$invalidate(7, hex = $$props.hex);
    		if ('buttonstr' in $$props) $$invalidate(2, buttonstr = $$props.buttonstr);
    		if ('colorName' in $$props) $$invalidate(3, colorName = $$props.colorName);
    		if ('vid' in $$props) vid = $$props.vid;
    		if ('lastUpdate' in $$props) lastUpdate = $$props.lastUpdate;
    		if ('refreshIntervalId' in $$props) refreshIntervalId = $$props.refreshIntervalId;
    		if ('copyIndicator' in $$props) $$invalidate(8, copyIndicator = $$props.copyIndicator);
    		if ('shareCanvas' in $$props) shareCanvas = $$props.shareCanvas;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*copyIndicator, hex*/ 384) {
    			$$invalidate(2, buttonstr = copyIndicator ? hex + ' copied' : hex);
    		}
    	};

    	return [
    		video,
    		pixel,
    		buttonstr,
    		colorName,
    		pauseVideo,
    		copy,
    		shareColorCard,
    		hex,
    		copyIndicator,
    		video_1_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }
    App.$compile = {"vars":[{"name":"html2canvas","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":false,"referenced_from_script":true},{"name":"paused","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"video","export_name":null,"injected":false,"module":false,"mutated":true,"reassigned":true,"referenced":true,"writable":true,"referenced_from_script":true},{"name":"data","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"target_x","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"target_y","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"canvas","export_name":null,"injected":false,"module":false,"mutated":true,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"ctx","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"pixel","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":true,"writable":true,"referenced_from_script":true},{"name":"hex","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"buttonstr","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":true,"writable":true,"referenced_from_script":true},{"name":"colorName","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":true,"writable":true,"referenced_from_script":true},{"name":"mediaStream","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":false,"referenced_from_script":false},{"name":"vid","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":true,"referenced_from_script":false},{"name":"getColorName","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":false,"referenced_from_script":true},{"name":"lastUpdate","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"refreshIntervalId","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":true,"referenced_from_script":false},{"name":"getComplimentColor","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":false,"referenced_from_script":true},{"name":"pauseVideo","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":true,"writable":false,"referenced_from_script":false},{"name":"copyIndicator","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":true,"referenced":false,"writable":true,"referenced_from_script":true},{"name":"copy","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":true,"writable":false,"referenced_from_script":false},{"name":"componentToHex","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":false,"referenced_from_script":true},{"name":"rgbToHex","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":false,"referenced_from_script":true},{"name":"shareCanvas","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":false,"writable":true,"referenced_from_script":false},{"name":"shareColorCard","export_name":null,"injected":false,"module":false,"mutated":false,"reassigned":false,"referenced":true,"writable":false,"referenced_from_script":false}]};

    const app = new App({
      target: document.body,
      props: {
        name: 'world',
      },
    });

    // recreate the whole app if an HMR update touches this module
    if (typeof module !== "undefined" && module.hot) {
      typeof module !== "undefined" && module.hot.dispose(() => {
        app.$destroy();
      });
      typeof module !== "undefined" && module.hot.accept();
    }

    return app;

})();
//# sourceMappingURL=bundle.js.map
