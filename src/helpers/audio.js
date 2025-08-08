const ffmpeg = require('fluent-ffmpeg');

const getDuration = (buffer) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(buffer, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(metadata.format.duration);
        });
    });
}

module.exports = { 
    getDuration
}