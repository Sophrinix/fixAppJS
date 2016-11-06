var xcode = require('xcode'),
    fs = require('fs-extra'),
    path = require('path'),
    spawn = require('child_process').spawn,
    utils = require('../../../../utils'),
    tiapp = require('tiapp.xml').load('./tiapp.xml');

/* Needed paths for the plugin */
var paths = {}
exports.cliVersion = ">=3.x"
exports.version = "1.0.3"

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

function failWithAngryMessage(data) {
    console.log("[ERROR] You can't run --fixappjs for " + data.cli.argv["platform"] + " Projects!\n It's for iOS projects only!!! ");
    process.exit(2)
}

function prepare(logger, data, next) {

    data.cli.argv["platform"] === ('android' || 'mobileweb' || 'windows') ? failWithAngryMessage(data) : console.log('Preparing to fix app.js issue for your iOS project');
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

        // read for hyperloop..we are going to skip over this for the first release.


        function alloyResourcesPath(parentDir) {
            return parentDir + '/Resources/iphone/';
            console.log('[INFO] Alloy resources represent')
        }

        function classicResourcesPath(parentDir) {
            return parentDir + '/Resources/';
            console.log('[INFO] classic resources represent')
        }

        var projectPath = parentDir + '/build/iphone/' + tiapp.name + '.xcodeproj/project.pbxproj',
            myProj = xcode.project(projectPath),
            isAlloy = false,
            projectFailure = false,
            resourcesPath = parentDir + '/Resources/';

        myProj.parse(function(err) {
            var plugins = tiapp.getPlugins();
            plugins.forEach(function(plugin) {
                if (plugin.id === 'ti.alloy') {
                    console.log('[INFO] fixappjs has detected that this is an alloy project!')
                    return isAlloy = true;
                }
            });
            var android = new RegExp('android', 'i'),
                mobileweb = new RegExp('mobileweb', 'i'),
                ios = new RegExp('ios', 'i'),
                iphone = new RegExp('iphone', 'i');

            isAlloy ? resourcesPath = alloyResourcesPath(parentDir) : classicResourcesPath(parentDir);

            // we are copying {parentDir (where tiapp.xml is)}/Resources/alloy folder into
            // {parentDir}/Resources/iphone/alloy if this is an alloy project.
            if(isAlloy){
              fs.copy(parentDir+'/Resources/alloy/', resourcesPath+'/alloy/', function (err) {
                if (err) {
                  console.error(err);
                  projectFailure = true;
                }
                });
            }



            var tiSourceAddToResources =fs.readdirSync(resourcesPath);
            for (var i in tiSourceAddToResources) {
              if (String(tiSourceAddToResources[i]).match(android) || String(tiSourceAddToResources[i]).match(mobileweb)) {
                  logger.trace((tiSourceAddToResources[i] + ' ignored').grey);
              }else {
                  logger.info((tiSourceAddToResources[i] + ' added to Xcode Project').grey);
                  myProj.addResourceFile( resourcesPath + tiSourceAddToResources[i]);
                }
              fs.writeFileSync(projectPath, myProj.writeSync());
            }


              /*
                //We need to specifically grab any commonJS the project has
                // this is a first past aprox of what I will need to write
                // this code is currently broken. do not uncomment.
                var commonJSModules =fs.readdirSync(commonJSModulePath);
                /*
                *  BTW, a for loop is WAY faster than a forEach
                * https://coderwall.com/p/kvzbpa/don-t-use-array-foreach-use-for-instead
                */
                /*
                for (var i in commonJSModules) {

                      logger.info((commonJSModules[i] + '  added to Xcode Project').grey);
                      myProj.addResourceFile( commonJSModulesPath + commonJSModules[i]);
                    }
                  fs.writeFileSync(projectPath, myProj.writeSync());
                }
                */

                //we should make this a conditionally true line. 
           logger.info('Congrats, you now have a corrected xcodeproj!');
        });
    });
}
