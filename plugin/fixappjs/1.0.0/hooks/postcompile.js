var fs = require('fs')
var path = require('path')
var spawn = require('child_process').spawn
var utils = require('../../../../utils')

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


/**
    cli.on('build.pre.compile', executeSeq(logger, [
    ]))
**/
    cli.on('build.post.compile', executeSeq(logger, [
        copyCompiledResources
    ]))
}


function executeSeq(logger, tasks) {
    var current = 0
    var errored = false
    var es6 = null

    return function task(data, terminate) {
        /* No task are done if es6 isn't needed */
        if (es6 === null && data.cli) {
            var propES6 = data.cli.tiapp.properties.es6 && data.cli.tiapp.properties.es6.value
            var optiES6 = data.cli.argv.$_.indexOf('--es6') !== -1
            es6 = propES6 || optiES6
        }
        if (!es6) { return terminate() }
        tasks[current](logger, data, function next(err, type) {
            if (err) {
                if (errored) { return }
                errored = true
                logger[type || 'error'](err)
                return terminate(type && type !== 'error' ? undefined : "Unable to fix app.js issue")
            }
            if (++current >= tasks.length) { return terminate() }
            task(data, terminate)
        })
    }
}

function prepare(logger, data, next) {
    logger.info("Setup project for ES6 transpiling")
    paths.fromProject = data.cli.argv['project-dir']
    paths.toProject = path.join(paths.fromProject, '.project')
    paths.fromSources = path.join(paths.fromProject, 'app')
    paths.toSources = path.join(paths.toProject, 'app')
    paths.fromResources = path.join(paths.fromProject, 'Resources')
    paths.toResources = path.join(paths.toProject, 'Resources')
    data.cli.argv.$_.push('--project-dir', paths.toProject)
    data.cli.argv['project-dir'] = paths.toProject
    utils.clean(paths.toProject, next)
}

function copyProject (logger, data, next) {
    logger.info("Ensuring xcodeproj has linked js assets.")
    fs.mkdir(paths.toProject, function (e) {
        if (e) { return next(e) }
        fs.readdir(paths.fromProject, function (e, files) {
            var n = files.length
            if (n === 0) { return next() }
            var after = function (e) {
                if (e) { return next(e) }
                if (--n === 0) { return next() }
            }
            files.forEach(function (f) {
                if (blacklist.indexOf(f) !== -1 || f.match(/^\..*/)) { return after() }
                utils.cp(path.join(paths.fromProject, f), path.join(paths.toProject, f), after)
            })
        })
    })
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
