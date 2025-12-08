/* eslint-env worker */
/* eslint-disable no-undef */
/* eslint-disable vars-on-top */
/* eslint-disable no-underscore-dangle */

importScripts("../lib/lz4/lz4_decoder.js");

let frameCount = 0,
    totalFrameDecodingTime = 0;

self.onmessage = function (e) {
    let start,
        end,
        dur,
        height,
        width,
        x,
        y,
        model,
        usingWebGLDecoder,
        encodedSize,
        maxSize,
        encoded,
        destPtr,
        inPtr,
        input,
        decoded,
        output,
        decodedSize;

    if (e.data.type === "frame") {
        start = (new Date()).getTime();
        height = e.data.height;
        width = e.data.width;
        x = e.data.x;
        y = e.data.y;
        model = e.data.model;
        usingWebGLDecoder = e.data.usingWebGLDecoder;
        encodedSize = e.data.frame.byteLength;
        encoded = new Uint8Array(e.data.frame);

        // TODO: extend supported colorspace/chroma subsampling
        if (model === 888) {
            maxSize = 3 * width * height;
        } else {
            maxSize = width * (height + height / 2);
        }

        destPtr = Module._malloc(maxSize);
        decoded = new Uint8Array(Module.HEAPU8.buffer, destPtr, maxSize);
        inPtr = Module._malloc(encodedSize);
        input = new Uint8Array(Module.HEAPU8.buffer, inPtr, encodedSize);
        input.set(new Uint8Array(encoded.buffer));

        /*
         * postMessage({
         * type: "info",
         * message: "[LZ4-Worker] Received size: " + encodedSize + " maxSize: " + maxSize + " w: " + width + " h: " + height
         *});
         */
        e.data.frame = null;
        decodedSize = _LZ4_decompress_safe(input.byteOffset, decoded.byteOffset, encodedSize, maxSize);
        Module._free(inPtr);
        Module._free(destPtr);
        encoded = null;
        e.data.frame = null;
        end = (new Date()).getTime();
        dur = end - start;
        frameCount++;
        totalFrameDecodingTime += dur;

        if (decodedSize < 0) {
            postMessage({
                type: "info",
                message: "[LZ4-Worker] Error in worker: decodedSize (" + decodedSize + ") must be positive!!!"
            });
        } else {
            if (usingWebGLDecoder) {
                output = new Uint8Array(decoded);
            } else {
                output = new Uint8ClampedArray(width * height * 4);
                i = 0;
                for (j = 0; j < decodedSize; j += 3) {
                    output[i] = decoded[j];
                    output[i + 1] = decoded[j + 1];
                    output[i + 2] = decoded[j + 2];
                    output[i + 3] = 255;
                    i += 4;
                }
            }

            decoded = null;
            postMessage({
                type: "frame",
                buffer: output,
                width: width,
                height: height,
                x: x,
                y: y,
                decodedSize: decodedSize
            }, [output.buffer]);
        }

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
            message: "Closing LZ4 worker"
        });
        close();
    }
};

/* ex:set ts=4 et: */
