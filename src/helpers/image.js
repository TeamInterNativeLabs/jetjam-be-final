const directory = require('path')
const fs = require('fs')

const makeFolders = (() => {

    const uploadFolder = directory.join(__dirname, "../../uploads")

    if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder)
    }

    const audioFolder = directory.join(__dirname, "../../uploads/audio")
    const imagesFolder = directory.join(__dirname, "../../uploads/images")
    const videosFolder = directory.join(__dirname, "../../uploads/videos")

    if (!fs.existsSync(audioFolder)) {
        fs.mkdirSync(audioFolder)
    }

    if (!fs.existsSync(imagesFolder)) {
        fs.mkdirSync(imagesFolder)
    }

    if (!fs.existsSync(videosFolder)) {
        fs.mkdirSync(videosFolder)
    }

})

const removeImage = ((path) => {
    const root = directory.join(__dirname, "../../")
    if (path && fs.existsSync(root + path)) {
        fs.unlinkSync(root + path)
    }
})

module.exports = { removeImage, makeFolders }