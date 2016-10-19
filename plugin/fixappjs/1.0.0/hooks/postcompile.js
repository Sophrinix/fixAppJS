var fs = require('fs')
var path = require('path')
var spawn = require('child_process').spawn
var utils = require('../utils')

/* Needed paths for the plugin */
var paths = {}
//var blacklist = ['Resources', 'build', 'README', 'LICENSE', 'node_modules']

exports.cliVersion = ">=3.x"
exports.version = "1.0"
exports.init = function (logger, config, cli) {
    /* Handle brutal stops */
    process.on('SIGINT', function () {
        paths.toProject && utils.cleanSync(paths.toProject)
        process.exit(2)
    })
    process.on('exit', function () {
        paths.toProject && utils.cleanSync(paths.toProject)
    })



    cli.on('build.pre.compile', executeSeq(logger, [
        cleanResources,
        symlinkResources
    ]))

    cli.on('build.post.compile', executeSeq(logger, [
        cleanResources,
        copyCompiledResources,
        cleanProject
    ]))
}

function executeSeq(logger, tasks) {
    var current = 0
    var errored = false
    var fixappjs = null

    return function task(data, terminate) {
        if (fixappjs === null && data.cli) {
            var propFixAppJS = data.cli.tiapp.properties.fixappjs && data.cli.tiapp.properties.fixappjs.value
            var optionFixAppJS = data.cli.argv.$_.indexOf('--fixappjs') !== -1
            fixappjs = propFixAppJS || optionFixAppJS
        }
        if (!fixappjs) { return terminate() }
        tasks[current](logger, data, function next(err, type) {
            if (err) {
                if (errored) { return }
                errored = true
                logger[type || 'error'](err)
                return terminate(type && type !== 'error' ? undefined : "Unable to Fix app.js problem")
            }
            if (++current >= tasks.length) { return terminate() }
            task(data, terminate)
        })
    }
}


function symlinkResources (logger, data, next) {
    logger.info("Symlinking resources")
    fs.symlink(paths.toResources, paths.fromResources, next)
}

function cleanProject (logger, data, next) {
    logger.info("Cleaning fixAppJS tempdata")
    utils.clean(paths.toProject, next)
}

function copyCompiledResources (logger, data, next) {
    logger.info("Copying compiled resources")
    utils.cp(paths.toResources, paths.fromResources, next)
}
