/* eslint-env worker */
/* eslint-disable no-undef */

importScripts("../lib/broadway/Decoder.js");

/* eslint-disable vars-on-top */

let frameCount = 0,
    totalFrameDecodingTime = 0,
    broadway = new Decoder();

broadway.onPictureDecoded = function (buffer, width, height) {
    let copyU8;

    copyU8 = new Uint8Array(buffer.length);
    copyU8.set(buffer, 0, buffer.length);
    postMessage({type: "frame", buffer: copyU8, width: width, height: height}, [copyU8.buffer]);
};

self.onmessage = function (e) {
    if (e.data.type === "frame") {
        let start = (new Date()).getTime(), end, dur;

        broadway.decode(new Uint8Array(e.data.frame));
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
            message: "Closing H264 worker"
        });
        close();
    }
};

/* ex:set ts=4 et: */
