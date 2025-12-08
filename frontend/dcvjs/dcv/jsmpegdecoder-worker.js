/* eslint-env worker */
/* eslint-disable one-var */
/* eslint-disable no-undef */

importScripts("../lib/jsmpeg/jsmpeg.min.js");

/* eslint-disable vars-on-top */

let CustomRenderer = function () {
};

CustomRenderer.prototype.resize = function (width, height) {
    this.width = width;
    this.height = height;
};

CustomRenderer.prototype.render = function (y, cb, cr) {
    let buf = new Uint8Array(y.byteLength + cb.byteLength + cr.byteLength);

    buf.set(y);
    buf.set(cr, y.byteLength);
    buf.set(cb, y.byteLength + cb.byteLength);

    postMessage({type: "frame", buffer: buf, width: this.width, height: this.height}, [buf.buffer]);
};

let frameCount = 0,
    totalFrameDecodingTime = 0,
    decoder = new JSMpeg.Decoder.MPEG1Video({}),
    renderer = new CustomRenderer();

decoder.connect(renderer);

self.onmessage = function (e) {
    if (e.data.type === "frame") {
        let start = (new Date()).getTime(), end, dur;

        decoder.write(0, new Uint8Array(e.data.frame));
        decoder.decode();
        end = (new Date()).getTime();
        dur = end - start;
        frameCount++;
        totalFrameDecodingTime += dur;
    } else if (e.data.type === "stats") {
        postMessage({
            type: "stats",
            frameCount: frameCount,
            totalFrameDecodingTime: totalFrameDecodingTime,
            averageDecodingTime: totalFrameDecodingTime / frameCount,
            averageDecodingFPS: frameCount / (totalFrameDecodingTime / 1000)
        });
        frameCount = 0;
        totalFrameDecodingTime = 0;
    } else if (e.data.type === "close") {
        postMessage({
            type: "info",
            message: "Closing MPEG1 worker"
        });
        close();
    }
};

/* ex:set ts=4 et: */
