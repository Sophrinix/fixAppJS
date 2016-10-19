var fs = require('fs')
var path = require('path')

/*
 * If an .app folder exists, it will remove the replace the app/ folder by the .app folder
 * and then, remove the .app folder. It assumes that the .app folder is the sources backup
 */
exports.clean = function clean (folder, next) {
    if (arguments.length <= 1) { return exports.cleanSync(folder) }
    fs.stat(folder, function (e, stats) {
        if (e || !stats.isDirectory()) { return next() }
        exports.rm(folder, next)
    })
}

exports.cleanSync = function cleanSync (folder) {
    try {
        var stats = fs.statSync(folder)
        if (!stats.isDirectory()) { throw("Nothing to clean") }
    } catch (e) { return }

    try {
        exports.rmSync(folder)
    } catch (e) {
        return e
    }
}

/*
 * Copy a bunch of file recursively from a folder into another one. Synchronous
 */
exports.cpSync = function cpSync (src, dest) {
    try {
        var stats = fs.statSync(src)
        if (!stats.isDirectory()) { fs.writeFileSync(dest, fs.readFileSync(src)); return }
    } catch (e) { return e }

    try { fs.mkdirSync(dest)}
    catch (e) { if (e.code !== 'EEXIST') { return e } }

    try {
        fs.readdirSync(src).forEach(function (file) {
            cpSync(path.join(src, file), path.join(dest, file))
        })
    } catch (e) { return e }
}

/*
 * Recursively delete files or folder. WARNING DANGEROUS. Synchronous
 */
exports.rmSync = function rmSync (src) {
    try {
        var stats = fs.statSync(src)
        if (!stats.isDirectory()) { fs.unlinkSync(src); return }
        fs.readdirSync(src).forEach(function (file) { rmSync(path.join(src, file)) })
        fs.rmdirSync(src)
    } catch (e) { return e }
}


/*
 * Copy a bunch of file recursively from a folder into another one.
 */
exports.cp = function cp (src, dest, next) {
    fs.stat(src, function (e, stats) {
        if (e) { return next(e) }
        if (!stats.isDirectory()) {
            var read = fs.createReadStream(src), write = fs.createWriteStream(dest)
            var after = (function () {
                var called = false
                return function (e) { if (!called) { called = true; next(e) } }
            }())
            read.on('error', after)
            write.on('error', after)
            write.on('finish', after)
            return read.pipe(write)
        }
        fs.mkdir(dest, function (e) {
            if (e && e.code !== 'EEXIST') { return next(e) }
            fs.readdir(src, function (e, files) {
                if (e) { return next(e) }
                var n = files.length
                if (n === 0) { return next() }
                files.forEach(function(file) {
                    cp(path.join(src, file), path.join(dest, file), function (e) {
                        if (e) { return next(e) }
                        if (--n === 0) { next() }
                    })
                })
            })
        })
    })
}

/*
 * Recursively delete files or folder. WARNING DANGEROUS.
 */
exports.rm = function rm (src, next) {
    fs.stat(src, function (e, stats) {
        if (e) { return next(e) }
        if (!stats.isDirectory()) { return fs.unlink(src, next) }
        fs.readdir(src, function (e, files) {
            if (e) { return next(e) }
            var n = files.length
            if (n === 0) { return fs.rmdir(src, next) }
            files.forEach(function(file) {
                rm(path.join(src, file), function (e) {
                    if (e) { return next(e) }
                    if (--n === 0) { fs.rmdir(src, next) }
                })
            })
        })
    })
}
