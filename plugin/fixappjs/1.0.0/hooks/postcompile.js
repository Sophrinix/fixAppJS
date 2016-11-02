var xcode = require('xcode'),
    fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    utils = require('../../../../utils'),
    tiapp = require('tiapp.xml').load('./tiapp.xml');

/* Needed paths for the plugin */
var paths = {}
exports.cliVersion = ">=3.x"
exports.version = "1.0"
exports.init = function(logger, config, cli) {
    /* Handle brutal stops */
    process.on('SIGINT', function() {
        process.exit(2)
    })
    process.on('exit', function() {})

    cli.on('build.pre.construct', executeSeq(logger, [
        prepare
    ]))
    cli.on('build.post.compile', executeSeq(logger, [
        copyCompiledResources
    ]))
}

function executeSeq(logger, tasks) {
    var current = 0,
        errored = false,
        fixappjs = null;

    return function task(data, terminate) {
        /* No task are done if es6 isn't needed */
        if (fixappjs === null && data.cli) {
            var propFixAppJS = data.cli.tiapp.properties.fixappjs && data.cli.tiapp.properties.fixappjs.value
            var optiFixAppJS = data.cli.argv.$_.indexOf('--fixappjs') !== -1
            fixappjs = propFixAppJS || optiFixAppJS
        }
        if (!fixappjs) {
            return terminate()
        }
        tasks[current](logger, data, function next(err, type) {
            if (err) {
                if (errored) {
                    return
                }
                errored = true
                logger[type || 'error'](err)
                return terminate(type && type !== 'error' ? undefined : "Unable to fix app.js issue")
            }
            if (++current >= tasks.length) {
                return terminate()
            }
            task(data, terminate)
        })
    }
}

function prepare(logger, data, next) {
    logger.info("preparing to fix the app.js issue")
    utils.clean('', next)
}

// I think we can back this code out
function symlinkResources(logger, data, next) {
    logger.info("Symlinking resources")
}

function cleanProject(logger, data, next) {
    logger.info("Another function that I think I can give the axe to")
}

function copyCompiledResources(logger, data, next) {
    logger.info("Copying compiled resources")
    utils.clean('', next)
    var exec = require('child_process').exec,
        path = require('path'),
        parentDir = path.resolve(process.cwd(), '.');

    exec('NowWeFixAppJS', {
        cwd: parentDir
    }, function(error, stdout, stderr) {
        //console.log("our parent directory is: " + parentDir);

        // read for hyperloop..we are going to skip over this for the first release.
        /*
        var modules = tiapp.getModules();
        // iterate through a list of modules from the tiapp.xml
        modules.forEach(function(mod) {
        // read access to properties on module object
        console.log('id=%s,version=%s,platform=%s',
        mod.id, mod.version || '<no version>', mod.platform || '<no platform>');
        });
        */

        var projectPath = parentDir + '/build/iphone/' + tiapp.name + '.xcodeproj/project.pbxproj',
            myProj = xcode.project(projectPath),
            isAlloy = false,
            resourcesPath = parentDir + '/Resources/';

        myProj.parse(function(err) {
            var plugins = tiapp.getPlugins();
            plugins.forEach(function(plugin) {
                if (plugin.id === 'ti.alloy') {
                    var isAlloy = true;
                }
            });
            //we should REALLLY skip android.
            //FIXME this can still be improved upon
            //when we read dir, we need to recursively copy
            isAlloy ? resourcesPath = parentDir + '/Resources/iphone/' : resourcesPath = parentDir + '/Resources/';

            fs.readdir(resourcesPath, (err, files) => {
                files.forEach(file => {
                    console.log(file + 'Added to xcodeproj');
                    myProj.addResourceFile(resourcesPath + file);
                    fs.writeFileSync(projectPath, myProj.writeSync());
                });
            });
            console.log('Congrats, you now have a corrected xcodeproj!');
        });
    });
}
