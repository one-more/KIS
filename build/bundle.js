'use strict';

let process = require('process'),
    build = require(process.cwd()+'/configuration/build'),
    gulp = require('gulp'),
    gulpMerge = require('gulp-merge'),
    crypto = require('crypto'),
    concat = require('gulp-concat'),
    through = require('through2'),
    fs = require('fs'),
    traceur = require('gulp-traceur'),
    uglify = require('gulp-uglify'),
    combiner = require('stream-combiner2'),
    lazypipe = require('lazypipe'),
    cssmin = require('gulp-cssmin'),
    htmlmin = require('gulp-htmlmin'),
    watch = require('gulp-watch'),
    svgSprite = require('gulp-svg-sprite');

function addWatch(src, cb) {
    watch(src, cb);
}

function isDev() {
    return process.env.NODE_ENV ? process.env.NODE_ENV == 'development' : true
}

function buildJS(name, bundle) {
    let fileName = isDev() ? `${name}.js` : `${getFileName(bundle.js)}.${name}.js`;
    writeToResultFile(name, 'js', fileName);
    let options = Object.assign({
        transforms: {}
    }, bundle.options);

    if(options.watchJS) {
        bundle.options.watchJS = false;
        addWatch(bundle.js, buildJS.bind(null, name, bundle))
    }

    return combiner.obj([
        gulp.src(bundle.js),
        (options.transforms.js || emptyTransforms)(),
        require('./gulp-modules')(),
        concat(fileName),
        (options.minifyJS ? uglify : emptyTransforms)(),
        gulp.dest(build.build)
    ]).on('error', console.error.bind(console))
}

function buildStyles(name, bundle) {
    let fileName = isDev() ? `${name}.css` : `${getFileName(bundle.styles)}.${name}.css`;
    writeToResultFile(name, 'styles', fileName);
    let options = Object.assign({
        transforms: {}
    }, bundle.options);

    if(options.watchStyles) {
        bundle.options.watchStyles = false;
        addWatch(bundle.styles, buildStyles.bind(null, name, bundle))
    }

    return combiner.obj([
        gulp.src(bundle.styles),
        (options.transforms.styles || emptyTransforms)(),
        concat(fileName),
        (options.minifyStyles ? cssmin : emptyTransforms)(),
        gulp.dest(build.build)
    ]).on('error', console.error.bind(console))
}

function buildTemplates(name, bundle) {
    let fileName = isDev() ? `${name}.tpl.js` : `${getFileName(bundle.templates)}.${name}.tpl.js`;
    writeToResultFile(name, 'templates', fileName);
    let options = Object.assign({
        transforms: {}
    }, bundle.options);

    if(options.watchTemplates) {
        bundle.options.watchTemplates = false;
        addWatch(bundle.templates, buildTemplates.bind(null, name, bundle))
    }

    return combiner.obj([
        gulp.src(bundle.templates),
        (options.transforms.templates || emptyTransforms)(),
        (options.minifyTemplates ? htmlmin : emptyTransforms)(),
        require('./gulp-modules')(),
        concat(fileName),
        uglify(),
        gulp.dest(build.build)
    ]).on('error', console.error.bind(console))
}

function buildSVG (name, bundle) {

    gulp.src([bundle.svg])
        .pipe(svgSprite({
            shape: {
                id: {
                    generator: function(name) {
                        var _name = name.split('/');
                        return _name.pop();
                    }
                },
                transform: [
                    {svgo: {
                        plugins: [
                            {removeTitle: true}
                        ]
                    }}
                ]
            },
            svg: {
                namespaceClassnames: false,
                doctypeDeclaration: false,
                transform: function (svg) {
                    return svg.replace(/\#[\w]*/gi, 'currentColor').replace(/<symbol/gi, "\n<symbol");
                }
            },
            mode: {
                symbol: {
                    dest: ''
                }
            }
        }))
        .on('error', console.log)
        .pipe(gulp.dest(dest));
}

function buildRuntime() {
    let src = ['./build/runtime/**/*.js'];
    let coreModulesSrc = ['./build/core-modules/**/*.js'];
    let fileName = isDev() ? 'runtime.js' : `${getFileName(src)}.runtime.js`;
    writeToResultFile('runtime', 'js', fileName);

    return gulpMerge(
        gulp.src(src)
            .pipe(traceur())
            .pipe(uglify())
            .pipe(concat('essentials.js'))
            .pipe(wrapCode()),
        gulp.src(coreModulesSrc)
            .pipe(traceur())
            .pipe(uglify())
            .pipe(require('./gulp-modules')())
            .pipe(concat('core-modules.js'))
    )
        .pipe(concat(fileName))
        .pipe(gulp.dest(build.build))
}

function getFileName(src) {
    return crypto.randomBytes(12).toString('hex')
}

function writeToResultFile(bundle, section, fileName) {
    try {
        var buildResult = require(build.bundleResult);
    } catch(e) {
        buildResult = {}
    }
    !buildResult[bundle] && (buildResult[bundle] = {});
    buildResult[bundle][section] = fileName;
    fs.writeFileSync(build.bundleResult, `module.exports = ${JSON.stringify(buildResult, null, 4)}`)
}

function emptyTransforms() {
    return through.obj((file, encoding, callback) => {
        return callback(null, file)
    });
}

function wrapCode() {
    return through.obj((file, encoding, callback) => {
        let content = file.contents.toString();
        let result = `(function() { 'use strict'; ${content} })()`;
        if(file.isStream()) {
            let stream = through();
            stream.write(result);
            file.contents = stream
        } else if(file.isBuffer()) {
            file.contents = new Buffer(result)
        }
        return callback(null, file)
    });
}

module.exports = {
    build(name, bundle) {
        return new Promise(done => {
            if(bundle.js) {
                let stream = buildJS(name, bundle);
                if(!bundle.styles && !bundle.templates) {
                    stream.on('finish', done)
                }
            }
            if(bundle.styles) {
                let stream = buildStyles(name, bundle);
                if(!bundle.templates) {
                    stream.on('finish', done)
                }
            }
            if(bundle.templates) {
                buildTemplates(name, bundle).on('finish', done)
            }
        })
    },

    buildRuntime: () => {
        return new Promise(done => {
            buildRuntime().on('end', done)
        })
    }
};