var fileSystem = {
    addFile(file) {
        "use strict";

        let path = file.pathName.slice(0, -file.name.length);
        let dir = path.split('/').filter(part => !!part).reduce((tree, dir) => {
            return tree[dir] || (tree[dir] = {
                    parent: tree,
                    name: dir,
                    get pathName() {
                        let parent, parts = [this.name], part = this;
                        while(parent = part.parent) {
                            parts.unshift(parent.name);
                            part = parent
                        }
                        return parts.join('/')
                    }
                })
        }, this);
        dir[file.path.split('/').slice(-1)] = file;
    },

    isPathRelative(path) {
        "use strict";

        return path.startsWith('./') || path.startsWith('../')
    },

    getDir(path, root) {
        "use strict";

        if(typeof root == 'string') {
            if(this.isPathRelative(path)) {
                root = this.getDir(root, this)
            } else {
                root = this
            }
        } else if(typeof root != 'object') {
            root = this
        }

        return path.split('/').reduce((path, part) => {
            try {
                if(part.trim() == '.' || part.trim() == '') {
                    return path
                }
                if(part.trim() == '..') {
                    return path.parent
                }
                return path[part]
            } catch(e) {
                console.log(arguments[0], path, part);
                console.log(e, e.stack)
            }
        }, root)
    },

    getFile(path, __dirname) {
        "use strict";

        return this.getDir(path, __dirname)
    },

    getContent(dir) {
        "use strict";

        let result = {};
        for(let key in dir) {
            let value = dir[key];
            if(this.isObject(value)) {
                result[key] = value
            }
        }
        return result
    },

    isObject(obj) {
        "use strict";

        return Object.prototype.toString.call(obj).includes('[object Object]')
    },

    isDir(obj) {
        "use strict";

        return this.isObject(obj) && !this.isFile(obj)
    },

    isFile(obj) {
        "use strict";

        return !!obj && !!obj.contents
    }
};

window.loadFile = (file) => {
    "use strict";

    fileSystem.addFile(file)
};

function readDir(__baseDir, path) {
    try {
        let dir = fileSystem.getDir(path, __baseDir);
        return Object.keys(dir).map(key => [key, dir[key]]).filter(pair => {
            return (fileSystem.isFile(pair[1]) || fileSystem.isDir(pair[1]))
                && !['parent'].includes(pair[0])
        }).reduce((obj, pair) => {
            return obj[pair[0]] = pair[1]
        }, {})
    } catch(e) {
        console.log(e);
        throw new Error(`${path} is not a directory`)
    }
}

function readFile(__baseDir, path) {
    try {
        return fileSystem.getFile(path, __baseDir)
    } catch(e) {
        //console.log(e);
        throw new Error(`${path} is not a file`)
    }
}