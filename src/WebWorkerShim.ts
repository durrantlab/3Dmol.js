let windowToUse: any = undefined;
let documentToUse: any = undefined;

export function inWorker(): boolean {
    // @ts-ignore
    return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
}

function makeFakeWindow() {
    // @ts-ignore
    self.ResizeObserver = function () {
        this.observe = function () {};
    };

    return self;
}

function makeFakeDocument() {
    return {
        querySelectorAll: function (s: string) {
            return [];
        },
        querySelector: function (s: string) {
            return {
                getBoundingClientRect: function () {
                    return {
                        width: function () {},
                        height: function () {},
                    };
                },
                style: {
                    display: "none"
                }
            }
        },
        // @ts-ignore
        createElement: function () {
            return {
                style: {},
                getContext: function () {
                    return {
                        activeTexture: function () {},
                        attachShader: function () {},
                        bindBuffer: function () {},
                        bindFramebuffer: function () {},
                        bindTexture: function () {},
                        blendEquation: function () {},
                        blendEquationSeparate: function () {},
                        blendFunc: function () {},
                        blendFuncSeparate: function () {},
                        bufferData: function () {},
                        clear: function () {},
                        clearColor: function () {},
                        clearDepth: function () {},
                        clearStencil: function () {},
                        compileShader: function () {},
                        createBuffer: function () {},
                        createFramebuffer: function () {},
                        createProgram: function () {
                            return {};
                        },
                        createShader: function () {},
                        createTexture: function () {},
                        cullFace: function () {},
                        deleteBuffer: function () {},
                        deleteProgram: function () {},
                        deleteTexture: function () {},
                        depthFunc: function () {},
                        depthMask: function () {},
                        disable: function () {},
                        disableVertexAttribArray: function () {},
                        drawArrays: function () {},
                        drawElements: function () {},
                        enable: function () {},
                        enableVertexAttribArray: function () {},
                        framebufferTexture2D: function () {},
                        frontFace: function () {},
                        getAttribLocation: function () {},
                        getExtension: function () {},
                        getParameter: function () {
                            return ["a", "b", "c", "d", "e", "f", "g"];
                        },
                        getProgramParameter: function () {
                            return true;
                        },
                        getShaderInfoLog: function () {},
                        getShaderParameter: function () {
                            return true;
                        },
                        getUniformLocation: function () {},
                        isContextLost: function () {},
                        lineWidth: function () {},
                        linkProgram: function () {},
                        pixelStorei: function () {},
                        scissor: function () {},
                        shaderSource: function () {},
                        texImage2D: function () {},
                        texImage3D: function () {},
                        texParameteri: function () {},
                        uniform1f: function () {},
                        uniform1i: function () {},
                        uniform2f: function () {},
                        uniform2fv: function () {},
                        uniform3f: function () {},
                        uniform3fv: function () {},
                        uniform4f: function () {},
                        uniformMatrix3fv: function () {},
                        uniformMatrix4fv: function () {},
                        useProgram: function () {},
                        vertexAttribPointer: function () {},
                        viewport: function () {},
                    };
                },
            };
        },
    };
}

export function getWindow() {
    if (windowToUse === undefined) {
        if (inWorker()) {
            windowToUse = makeFakeWindow();
        } else {
            windowToUse = window;
        }
    }
    return windowToUse;
}

export function getDocument() {
    if (documentToUse === undefined) {
        if (inWorker()) {
            documentToUse = makeFakeDocument();
        } else {
            documentToUse = document;
        }
    }
    return documentToUse;
}